import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Droplets, Sparkles } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type {
  PhotoModulesModule,
  PhotoModulesRegion,
  PhotoModulesSanitizerDrop,
  PhotoModulesUiModelV1,
} from '@/lib/photoModulesContract';
import { decodeRleBinaryMask } from '@/lib/photoModulesContract';
import {
  emitAuroraPhotoModulesActionTap,
  emitAuroraPhotoModulesIssueTap,
  emitAuroraPhotoModulesModuleTap,
  emitAuroraPhotoModulesProductTap,
  type AnalyticsContext,
} from '@/lib/auroraAnalytics';
import type { Language } from '@/lib/types';
import { cn } from '@/lib/utils';

const HEATMAP_GRID = 64;

const PRODUCT_REC_ENABLED = (() => {
  const raw = String(import.meta.env.VITE_DIAG_PRODUCT_REC ?? 'false')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
})();

type IssueType = 'redness' | 'acne' | 'tone' | 'shine' | 'texture';
type Rgb = { r: number; g: number; b: number };
type RenderSourceKind = 'crop' | 'original_crop' | 'original_full';
type RenderSourceCandidate = {
  kind: RenderSourceKind;
  src: string;
};

type ModuleMaskOverlay = {
  module_id: string;
  mask_grid: number;
  mask: Uint8Array;
  box: { x: number; y: number; w: number; h: number } | null;
  color: Rgb;
  degraded_reason: string | null;
};

const ISSUE_COLOR_MAP: Record<IssueType, Rgb> = {
  redness: { r: 255, g: 77, b: 79 },
  acne: { r: 255, g: 159, b: 64 },
  tone: { r: 173, g: 127, b: 255 },
  shine: { r: 255, g: 214, b: 10 },
  texture: { r: 91, g: 192, b: 222 },
};

const MODULE_LABELS: Record<string, { en: string; zh: string }> = {
  forehead: { en: 'Forehead', zh: '额头' },
  left_cheek: { en: 'Left cheek', zh: '左脸颊' },
  right_cheek: { en: 'Right cheek', zh: '右脸颊' },
  nose: { en: 'Nose', zh: '鼻部' },
  chin: { en: 'Chin', zh: '下巴' },
  under_eye_left: { en: 'Left under-eye', zh: '左眼下' },
  under_eye_right: { en: 'Right under-eye', zh: '右眼下' },
};

const ISSUE_LABELS: Record<IssueType, { en: string; zh: string }> = {
  redness: { en: 'Redness', zh: '泛红' },
  acne: { en: 'Acne', zh: '痘痘' },
  tone: { en: 'Uneven tone', zh: '肤色不均' },
  shine: { en: 'Shine/Oil', zh: '出油反光' },
  texture: { en: 'Texture/Pores', zh: '纹理/毛孔' },
};

const normalizeSeverityLevel = (value: number): 1 | 2 | 3 | 4 => {
  const rounded = Math.round(Number.isFinite(value) ? value : 1);
  if (rounded <= 1) return 1;
  if (rounded === 2) return 2;
  if (rounded === 3) return 3;
  return 4;
};

const getSeverityLabel = (level: 1 | 2 | 3 | 4, language: Language): string => {
  if (language === 'CN') {
    if (level === 1) return '轻度';
    if (level === 2) return '中度';
    if (level === 3) return '明显';
    return '重度';
  }
  if (level === 1) return 'Mild';
  if (level === 2) return 'Moderate';
  if (level === 3) return 'Noticeable';
  return 'High';
};

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
};

const rgba = (rgb: Rgb, alpha: number) =>
  `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;

const pickColor = (region: PhotoModulesRegion): Rgb => {
  if (region.issue_type && ISSUE_COLOR_MAP[region.issue_type]) return ISSUE_COLOR_MAP[region.issue_type];
  const hint = String(region.style.label_hint || '').toLowerCase();
  if (hint.includes('red')) return ISSUE_COLOR_MAP.redness;
  if (hint.includes('acne') || hint.includes('breakout')) return ISSUE_COLOR_MAP.acne;
  if (hint.includes('tone')) return ISSUE_COLOR_MAP.tone;
  if (hint.includes('shine') || hint.includes('oil')) return ISSUE_COLOR_MAP.shine;
  return ISSUE_COLOR_MAP.texture;
};

const colorForModule = (module: PhotoModulesModule): Rgb => {
  const issueType = module.issues[0]?.issue_type;
  if (issueType && ISSUE_COLOR_MAP[issueType as IssueType]) return ISSUE_COLOR_MAP[issueType as IssueType];
  return ISSUE_COLOR_MAP.texture;
};

const drawModuleMask = (
  context: CanvasRenderingContext2D,
  overlay: ModuleMaskOverlay,
  width: number,
  height: number,
  fillAlpha: number,
  strokeAlpha: number,
) => {
  const grid = Math.max(1, Math.trunc(Number(overlay.mask_grid) || 0));
  if (!overlay.mask || overlay.mask.length !== grid * grid) return;

  const bufferCanvas = document.createElement('canvas');
  bufferCanvas.width = grid;
  bufferCanvas.height = grid;
  const bufferContext = bufferCanvas.getContext('2d');
  if (!bufferContext) return;
  const imageData = bufferContext.createImageData(grid, grid);
  const alpha = Math.max(0, Math.min(1, fillAlpha));
  for (let index = 0; index < overlay.mask.length; index += 1) {
    if (!overlay.mask[index]) continue;
    const pixelIndex = index * 4;
    imageData.data[pixelIndex] = overlay.color.r;
    imageData.data[pixelIndex + 1] = overlay.color.g;
    imageData.data[pixelIndex + 2] = overlay.color.b;
    imageData.data[pixelIndex + 3] = Math.round(alpha * 255);
  }
  bufferContext.putImageData(imageData, 0, 0);

  context.save();
  context.imageSmoothingEnabled = false;
  context.drawImage(bufferCanvas, 0, 0, width, height);
  context.restore();

  if (!overlay.box) return;
  const box = overlay.box;
  const x = box.x * width;
  const y = box.y * height;
  const boxWidth = box.w * width;
  const boxHeight = box.h * height;
  context.strokeStyle = rgba(overlay.color, Math.max(0, Math.min(1, strokeAlpha)));
  context.lineWidth = 1.4;
  context.strokeRect(x, y, boxWidth, boxHeight);
};

const drawBbox = (
  context: CanvasRenderingContext2D,
  region: PhotoModulesRegion,
  width: number,
  height: number,
  alphaScale: number,
  lineBoost: number,
) => {
  if (!region.bbox) return;
  const color = pickColor(region);
  const x = region.bbox.x * width;
  const y = region.bbox.y * height;
  const boxWidth = region.bbox.w * width;
  const boxHeight = region.bbox.h * height;
  const intensity = clamp01(region.style.intensity);
  const strokeAlpha = (0.28 + intensity * 0.35) * alphaScale;
  const tunedFillAlpha = (0.015 + intensity * 0.06) * alphaScale;

  context.fillStyle = rgba(color, tunedFillAlpha);
  context.fillRect(x, y, boxWidth, boxHeight);
  context.strokeStyle = rgba(color, strokeAlpha);
  context.lineWidth = 1.2 + intensity * 2.2 * lineBoost;
  context.strokeRect(x, y, boxWidth, boxHeight);
};

const drawPolygon = (
  context: CanvasRenderingContext2D,
  region: PhotoModulesRegion,
  width: number,
  height: number,
  alphaScale: number,
  lineBoost: number,
) => {
  const polygon = region.polygon;
  if (!polygon?.points?.length) return;
  const color = pickColor(region);
  const intensity = clamp01(region.style.intensity);
  const fillAlpha = (0.015 + intensity * 0.07) * alphaScale;
  const strokeAlpha = (0.30 + intensity * 0.42) * alphaScale;

  context.beginPath();
  polygon.points.forEach((point, index) => {
    const x = point.x * width;
    const y = point.y * height;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
  context.fillStyle = rgba(color, fillAlpha);
  context.fill();
  context.strokeStyle = rgba(color, strokeAlpha);
  context.lineWidth = 1.2 + intensity * 2 * lineBoost;
  context.stroke();
};

const drawHeatmap = (
  context: CanvasRenderingContext2D,
  region: PhotoModulesRegion,
  width: number,
  height: number,
  alphaScale: number,
) => {
  if (!region.heatmap) return;
  const { grid, values, smoothing_hint } = region.heatmap;
  if (grid.w !== HEATMAP_GRID || grid.h !== HEATMAP_GRID || values.length !== HEATMAP_GRID * HEATMAP_GRID) return;

  const color = pickColor(region);
  const intensity = clamp01(region.style.intensity);
  const bufferCanvas = document.createElement('canvas');
  bufferCanvas.width = HEATMAP_GRID;
  bufferCanvas.height = HEATMAP_GRID;
  const bufferContext = bufferCanvas.getContext('2d');
  if (!bufferContext) return;

  const imageData = bufferContext.createImageData(HEATMAP_GRID, HEATMAP_GRID);
  for (let index = 0; index < values.length; index += 1) {
    const v = clamp01(values[index]);
    const pixelIndex = index * 4;
    imageData.data[pixelIndex] = color.r;
    imageData.data[pixelIndex + 1] = color.g;
    imageData.data[pixelIndex + 2] = color.b;
    imageData.data[pixelIndex + 3] = Math.round(clamp01(v * intensity * alphaScale) * 255);
  }
  bufferContext.putImageData(imageData, 0, 0);

  context.save();
  context.imageSmoothingEnabled = smoothing_hint !== 'nearest';
  context.drawImage(bufferCanvas, 0, 0, width, height);
  context.restore();
};

const drawRegions = (
  context: CanvasRenderingContext2D,
  regions: PhotoModulesRegion[],
  width: number,
  height: number,
  options?: {
    includeIds?: Set<string> | null;
    alphaScale?: number;
    lineBoost?: number;
  },
) => {
  const includeIds = options?.includeIds ?? null;
  const alphaScale = options?.alphaScale ?? 1;
  const lineBoost = options?.lineBoost ?? 1;

  const ordered = [...regions].sort((left, right) => left.style.priority - right.style.priority);
  for (const region of ordered) {
    if (includeIds && !includeIds.has(region.region_id)) continue;
    if (region.type === 'bbox') drawBbox(context, region, width, height, alphaScale, lineBoost);
    if (region.type === 'polygon') drawPolygon(context, region, width, height, alphaScale, lineBoost);
    if (region.type === 'heatmap') drawHeatmap(context, region, width, height, alphaScale);
  }
};

const getIssueLabel = (issueType: string, language: Language): string => {
  const issue = ISSUE_LABELS[issueType as IssueType];
  if (!issue) return issueType;
  return language === 'CN' ? issue.zh : issue.en;
};

const getModuleLabel = (moduleId: string, language: Language): string => {
  const moduleLabel = MODULE_LABELS[moduleId];
  if (!moduleLabel) return moduleId;
  return language === 'CN' ? moduleLabel.zh : moduleLabel.en;
};

const toPercent = (value: number) => `${Math.round(clamp01(value) * 100)}%`;

export function PhotoModulesCard({
  model,
  language,
  analyticsCtx,
  cardId,
  sanitizerDrops,
  debug = false,
}: {
  model: PhotoModulesUiModelV1;
  language: Language;
  analyticsCtx?: AnalyticsContext;
  cardId?: string;
  sanitizerDrops?: PhotoModulesSanitizerDrop[];
  debug?: boolean;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const highlightCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedIssueType, setSelectedIssueType] = useState<string | null>(null);
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const imageAspect = `${model.face_crop.render_size_px_hint.w}/${model.face_crop.render_size_px_hint.h}`;
  const cropImageUrl = model.face_crop.crop_image_url;
  const originalImageUrl = model.face_crop.original_image_url;
  const [failedRenderKinds, setFailedRenderKinds] = useState<RenderSourceKind[]>([]);

  const originalCropStyle = useMemo(() => {
    const bbox = model.face_crop.bbox_px;
    const orig = model.face_crop.orig_size_px;
    if (!bbox.w || !bbox.h || !orig.w || !orig.h) return null;

    return {
      width: `${(orig.w / bbox.w) * 100}%`,
      height: `${(orig.h / bbox.h) * 100}%`,
      left: `${-(bbox.x / bbox.w) * 100}%`,
      top: `${-(bbox.y / bbox.h) * 100}%`,
    };
  }, [model.face_crop.bbox_px, model.face_crop.orig_size_px]);

  const renderCandidates = useMemo<RenderSourceCandidate[]>(() => {
    const candidates: RenderSourceCandidate[] = [];
    if (cropImageUrl) candidates.push({ kind: 'crop', src: cropImageUrl });
    if (originalImageUrl && originalCropStyle) candidates.push({ kind: 'original_crop', src: originalImageUrl });
    if (originalImageUrl) candidates.push({ kind: 'original_full', src: originalImageUrl });
    return candidates;
  }, [cropImageUrl, originalCropStyle, originalImageUrl]);

  const renderCandidatesKey = useMemo(
    () => renderCandidates.map((candidate) => `${candidate.kind}:${candidate.src}`).join('|'),
    [renderCandidates],
  );

  useEffect(() => {
    setFailedRenderKinds([]);
  }, [renderCandidatesKey]);

  const activeRenderCandidate = useMemo(
    () => renderCandidates.find((candidate) => !failedRenderKinds.includes(candidate.kind)) ?? null,
    [failedRenderKinds, renderCandidates],
  );

  const hasRenderableImage = Boolean(activeRenderCandidate);
  const noRenderableReason = renderCandidates.length > 0 ? 'load_failed' : 'missing_source';

  useEffect(() => {
    if (!selectedModuleId || model.modules.some((module) => module.module_id === selectedModuleId)) return;
    setSelectedModuleId(null);
    setSelectedIssueType(null);
  }, [model.modules, selectedModuleId]);

  useEffect(() => {
    if (!hasRenderableImage) {
      setStageSize((previous) => {
        if (previous.width === 0 && previous.height === 0) return previous;
        return { width: 0, height: 0 };
      });
      return;
    }
    const node = stageRef.current;
    if (!node) return;

    const update = () => {
      const nextWidth = Math.max(0, node.clientWidth);
      const nextHeight = Math.max(0, node.clientHeight);
      setStageSize((previous) => {
        if (previous.width === nextWidth && previous.height === nextHeight) return previous;
        return { width: nextWidth, height: nextHeight };
      });
    };

    update();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }

    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasRenderableImage]);

  const regions = model.regions;
  const allRegionIds = useMemo(() => new Set(regions.map((region) => region.region_id)), [regions]);
  const hasModuleSelection = Boolean(selectedModuleId);
  const selectedModule = useMemo(
    () => model.modules.find((module) => module.module_id === selectedModuleId) ?? model.modules[0] ?? null,
    [model.modules, selectedModuleId],
  );
  const moduleMaskOverlays = useMemo<ModuleMaskOverlay[]>(() => {
    const overlays: ModuleMaskOverlay[] = [];
    for (const module of model.modules) {
      const grid = Number(module.mask_grid);
      const rle = String(module.mask_rle_norm || '').trim();
      if (!Number.isFinite(grid) || grid <= 0 || !rle) continue;
      const normalizedGrid = Math.max(1, Math.trunc(grid));
      const mask = decodeRleBinaryMask(rle, normalizedGrid * normalizedGrid);
      let activePixels = 0;
      for (let i = 0; i < mask.length; i += 1) {
        if (mask[i]) activePixels += 1;
      }
      if (!activePixels) continue;
      overlays.push({
        module_id: module.module_id,
        mask_grid: normalizedGrid,
        mask,
        box: module.box ?? null,
        color: colorForModule(module),
        degraded_reason: typeof module.degraded_reason === 'string' && module.degraded_reason.trim() ? module.degraded_reason.trim() : null,
      });
    }
    return overlays;
  }, [model.modules]);
  const moduleMaskById = useMemo(() => {
    const map = new Map<string, ModuleMaskOverlay>();
    moduleMaskOverlays.forEach((overlay) => map.set(overlay.module_id, overlay));
    return map;
  }, [moduleMaskOverlays]);
  const overlayMode = moduleMaskOverlays.length > 0 ? 'mask' : 'region';

  const moduleEvidenceRegionIds = useMemo(() => {
    if (!hasModuleSelection || !selectedModule) return allRegionIds;
    const ids = new Set<string>();
    selectedModule.issues.forEach((issue) => {
      issue.evidence_region_ids.forEach((regionId) => ids.add(regionId));
    });
    if (!ids.size) return allRegionIds;
    return ids;
  }, [allRegionIds, hasModuleSelection, selectedModule]);

  const issueEvidenceRegionIds = useMemo(() => {
    if (!hasModuleSelection || !selectedModule || !selectedIssueType) return null;
    const issue = selectedModule.issues.find((current) => current.issue_type === selectedIssueType);
    if (!issue || !issue.evidence_region_ids.length) return null;
    return new Set(issue.evidence_region_ids);
  }, [hasModuleSelection, selectedIssueType, selectedModule]);

  const visibleRegionIds = issueEvidenceRegionIds ?? moduleEvidenceRegionIds;

  const highlightedRegionIds = useMemo(() => {
    const ids = new Set<string>(visibleRegionIds);
    if (hoveredRegionId) ids.add(hoveredRegionId);
    return ids;
  }, [hoveredRegionId, visibleRegionIds]);

  const hasFocusedSelection = overlayMode === 'mask'
    ? hasModuleSelection
    : highlightedRegionIds.size > 0 && highlightedRegionIds.size < allRegionIds.size;

  useEffect(() => {
    const canvas = baseCanvasRef.current;
    if (!canvas || stageSize.width <= 0 || stageSize.height <= 0) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.round(stageSize.width * dpr);
    canvas.height = Math.round(stageSize.height * dpr);
    canvas.style.width = `${stageSize.width}px`;
    canvas.style.height = `${stageSize.height}px`;

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, stageSize.width, stageSize.height);
    if (overlayMode === 'mask' && moduleMaskOverlays.length) {
      moduleMaskOverlays.forEach((overlay) => {
        drawModuleMask(context, overlay, stageSize.width, stageSize.height, 0.08, 0.12);
      });
      return;
    }

    drawRegions(context, regions, stageSize.width, stageSize.height, {
      alphaScale: 0.45,
      lineBoost: 1,
    });
  }, [moduleMaskOverlays, overlayMode, regions, stageSize.height, stageSize.width]);

  useEffect(() => {
    const canvas = highlightCanvasRef.current;
    if (!canvas || stageSize.width <= 0 || stageSize.height <= 0) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.round(stageSize.width * dpr);
    canvas.height = Math.round(stageSize.height * dpr);
    canvas.style.width = `${stageSize.width}px`;
    canvas.style.height = `${stageSize.height}px`;

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, stageSize.width, stageSize.height);

    if (overlayMode === 'mask') {
      if (hasModuleSelection && selectedModule && selectedIssueType && issueEvidenceRegionIds?.size) {
        drawRegions(context, regions, stageSize.width, stageSize.height, {
          includeIds: issueEvidenceRegionIds,
          alphaScale: 1,
          lineBoost: 1.35,
        });
        return;
      }

      if (hasModuleSelection && selectedModule) {
        const overlay = moduleMaskById.get(selectedModule.module_id);
        if (overlay) {
          drawModuleMask(context, overlay, stageSize.width, stageSize.height, 0.26, 0.78);
          return;
        }
      }

      if (hoveredRegionId) {
        drawRegions(context, regions, stageSize.width, stageSize.height, {
          includeIds: new Set([hoveredRegionId]),
          alphaScale: 1,
          lineBoost: 1.35,
        });
      }
      return;
    }

    if (!highlightedRegionIds.size || highlightedRegionIds.size === allRegionIds.size) return;

    drawRegions(context, regions, stageSize.width, stageSize.height, {
      includeIds: highlightedRegionIds,
      alphaScale: 1,
      lineBoost: 1.3,
    });
  }, [
    allRegionIds.size,
    highlightedRegionIds,
    hoveredRegionId,
    issueEvidenceRegionIds,
    moduleMaskById,
    overlayMode,
    regions,
    hasModuleSelection,
    selectedIssueType,
    selectedModule,
    stageSize.height,
    stageSize.width,
  ]);

  const hasProducts =
    PRODUCT_REC_ENABLED && selectedModule ? selectedModule.products.filter((product) => Boolean(product.title)).length > 0 : false;

  const handleModuleSelect = (moduleId: string) => {
    setSelectedIssueType(null);
    setHoveredRegionId(null);
    setSelectedModuleId((previous) => {
      const next = previous === moduleId ? null : moduleId;
      if (analyticsCtx) {
        emitAuroraPhotoModulesModuleTap(analyticsCtx, {
          card_id: cardId ?? null,
          module_id: moduleId,
          selected: next === moduleId,
          quality_grade: model.quality_grade,
          sanitizer_drop_count: sanitizerDrops?.length ?? 0,
        });
      }
      return next;
    });
  };

  const handleIssueSelect = (moduleId: string, issueType: string) => {
    setSelectedModuleId(moduleId);
    setHoveredRegionId(null);
    setSelectedIssueType((previous) => {
      const next = previous === issueType ? null : issueType;
      if (analyticsCtx) {
        emitAuroraPhotoModulesIssueTap(analyticsCtx, {
          card_id: cardId ?? null,
          module_id: moduleId,
          issue_type: issueType,
          selected: next === issueType,
          quality_grade: model.quality_grade,
        });
      }
      return next;
    });
  };

  return (
    <Card className="w-full max-w-[48rem] border border-border/70 bg-background/90">
      <CardHeader className="space-y-2 p-4 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-foreground">
            {language === 'CN' ? '照片模块分析' : 'Photo Modules Analysis'}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="rounded-full border border-border/60 bg-muted/50 px-2 py-1">
              {model.quality_grade === 'degraded'
                ? language === 'CN'
                  ? '质量：一般'
                  : 'Quality: degraded'
                : language === 'CN'
                  ? '质量：通过'
                  : 'Quality: pass'}
            </span>
            {model.disclaimers.non_medical ? (
              <span className="rounded-full border border-border/60 bg-muted/50 px-2 py-1">
                {language === 'CN' ? '非医疗建议' : 'Non-medical guidance'}
              </span>
            ) : null}
          </div>
        </div>
        {model.photo_notice ? (
          <div className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {model.photo_notice}
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4 p-4 pt-2">
        <div className="space-y-2">
          {!hasRenderableImage ? (
            <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {noRenderableReason === 'load_failed'
                ? language === 'CN'
                  ? '照片预览加载失败。以下先展示模块结论与行动建议；重新上传或重拍后可恢复叠加图。'
                  : 'Photo preview failed to load. Module findings are still shown below; re-uploading or retaking can restore overlays.'
                : language === 'CN'
                  ? '当前未拿到可渲染照片，以下先展示模块结论与行动建议。'
                  : 'Photo overlay preview is unavailable for this response. Module findings and actions are shown below.'}
            </div>
          ) : null}

          {hasRenderableImage ? (
            <div
              ref={stageRef}
              className="relative w-full overflow-hidden rounded-2xl border border-border/60 bg-muted/20"
              style={{ aspectRatio: imageAspect }}
            >
              <img
                src={activeRenderCandidate!.src}
                alt={
                  activeRenderCandidate!.kind === 'crop'
                    ? language === 'CN'
                      ? '脸部裁剪图'
                      : 'Face crop'
                    : activeRenderCandidate!.kind === 'original_crop'
                      ? language === 'CN'
                        ? '原图裁剪预览'
                        : 'Original crop preview'
                      : language === 'CN'
                        ? '原图预览'
                        : 'Original image preview'
                }
                className={
                  activeRenderCandidate!.kind === 'original_crop'
                    ? 'absolute'
                    : 'absolute inset-0 h-full w-full object-cover'
                }
                style={activeRenderCandidate!.kind === 'original_crop' ? originalCropStyle ?? undefined : undefined}
                draggable={false}
                onError={() => {
                  setFailedRenderKinds((previous) => {
                    if (previous.includes(activeRenderCandidate!.kind)) return previous;
                    return [...previous, activeRenderCandidate!.kind];
                  });
                }}
              />

              <canvas
                ref={baseCanvasRef}
                data-testid="photo-modules-base-canvas"
                data-focused={hasFocusedSelection ? '1' : '0'}
                data-overlay-mode={overlayMode}
                data-mask-count={moduleMaskOverlays.length}
                className="pointer-events-none absolute inset-0 h-full w-full"
                style={{
                  opacity:
                    overlayMode === 'mask'
                      ? hasFocusedSelection
                        ? 0.38
                        : 0.48
                      : hasFocusedSelection
                        ? 0.04
                        : 0.3,
                }}
              />
              <canvas
                ref={highlightCanvasRef}
                data-testid="photo-modules-highlight-canvas"
                data-visible-count={visibleRegionIds.size}
                data-highlight-count={highlightedRegionIds.size}
                data-overlay-mode={overlayMode}
                className="pointer-events-none absolute inset-0 h-full w-full"
              />
            </div>
          ) : null}
          {hasRenderableImage && activeRenderCandidate && activeRenderCandidate.kind !== 'crop' ? (
            <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              {activeRenderCandidate.kind === 'original_crop'
                ? language === 'CN'
                  ? '当前使用原图裁剪回退进行叠加渲染。'
                  : 'Using original-photo crop fallback for overlay rendering.'
                : language === 'CN'
                  ? '当前使用原图全幅回退进行叠加渲染，分区位置可能略有偏差。'
                  : 'Using original full-frame fallback; region alignment may be less precise.'}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 text-[11px]">
            {(Object.keys(ISSUE_COLOR_MAP) as IssueType[]).map((issueType) => (
              <span key={issueType} className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: rgba(ISSUE_COLOR_MAP[issueType], 0.95) }} />
                <span className="text-muted-foreground">{getIssueLabel(issueType, language)}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-xs font-semibold text-muted-foreground">
            {language === 'CN' ? '脸部分区（点击联动高亮）' : 'Face modules (tap to highlight)'}
          </div>
          <div className="flex flex-wrap gap-2">
            {model.modules.map((module) => {
              const maxSeverity = module.issues.reduce((max, issue) => Math.max(max, issue.severity_0_4), 0);
              const severityLevel = normalizeSeverityLevel(maxSeverity);
              const severityLabel = getSeverityLabel(severityLevel, language);
              const isActive = selectedModuleId === module.module_id;
              return (
                <button
                  key={module.module_id}
                  type="button"
                  data-testid={`photo-modules-module-${module.module_id}`}
                  onClick={() => handleModuleSelect(module.module_id)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs transition-colors',
                    isActive ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 bg-muted/40 text-muted-foreground hover:text-foreground',
                  )}
                >
                  {getModuleLabel(module.module_id, language)} · {severityLabel}
                  {debug ? ` (S${severityLevel})` : ''}
                </button>
              );
            })}
          </div>
        </div>

        {selectedModule ? (
          <div className="space-y-4 rounded-2xl border border-border/60 bg-background/70 p-3">
            <div className="text-sm font-semibold text-foreground">{getModuleLabel(selectedModule.module_id, language)}</div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? '问题识别' : 'Detected issues'}</div>
              {selectedModule.issues.length ? (
                <div className="space-y-2">
                  {selectedModule.issues.map((issue) => {
                    const active = selectedIssueType === issue.issue_type;
                    return (
                      <button
                        key={`${selectedModule.module_id}_${issue.issue_type}`}
                        type="button"
                        data-testid={`photo-modules-issue-${issue.issue_type}`}
                        className={cn(
                          'w-full rounded-xl border px-3 py-2 text-left transition-colors',
                          active ? 'border-primary bg-primary/10' : 'border-border/60 bg-muted/20 hover:bg-muted/30',
                        )}
                        onClick={() => handleIssueSelect(selectedModule.module_id, issue.issue_type)}
                        onMouseEnter={() => setHoveredRegionId(issue.evidence_region_ids[0] ?? null)}
                        onMouseLeave={() => setHoveredRegionId(null)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium text-foreground">{getIssueLabel(issue.issue_type, language)}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {getSeverityLabel(normalizeSeverityLevel(issue.severity_0_4), language)}
                            {debug ? ` (S${normalizeSeverityLevel(issue.severity_0_4)})` : ''}
                            {' · '}
                            {toPercent(issue.confidence_0_1)}
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{issue.explanation_short}</div>
                        {issue.evidence_region_ids.length ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {issue.evidence_region_ids.slice(0, 3).map((regionId) => (
                              <span key={regionId} className="rounded-full border border-border/60 bg-background/80 px-2 py-0.5 text-[10px] text-muted-foreground">
                                {regionId}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                  {language === 'CN' ? '该分区暂无可展示问题。' : 'No issue is available for this module.'}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? '成分行动建议' : 'Ingredient actions'}</div>
              {selectedModule.actions.length ? (
                <div className="space-y-2">
                  {selectedModule.actions.map((action) => (
                    <button
                      key={`${selectedModule.module_id}_${action.ingredient_id}`}
                      type="button"
                      className="w-full rounded-xl border border-border/60 bg-muted/20 p-3 text-left hover:bg-muted/30"
                      onClick={() => {
                        if (!analyticsCtx) return;
                        emitAuroraPhotoModulesActionTap(analyticsCtx, {
                          card_id: cardId ?? null,
                          module_id: selectedModule.module_id,
                          action_type: action.action_type,
                          ingredient_id: action.ingredient_id,
                          issue_types: action.evidence_issue_types,
                        });
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-foreground">{action.ingredient_name}</div>
                        <div className="text-[11px] text-muted-foreground">{action.timeline || 'AM/PM'}</div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{action.why}</div>
                      <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                        <div className="rounded-lg border border-border/60 bg-background/80 px-2 py-1.5">
                          {language === 'CN' ? '使用方式' : 'How to use'}: {action.how_to_use.time} · {action.how_to_use.frequency}
                          {action.how_to_use.notes ? ` · ${action.how_to_use.notes}` : ''}
                        </div>
                        <div className="rounded-lg border border-border/60 bg-background/80 px-2 py-1.5">
                          {language === 'CN' ? '避免同用' : 'Do not mix'}: {action.do_not_mix.join(' / ')}
                        </div>
                      </div>
                      {action.cautions.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {action.cautions.slice(0, 4).map((caution) => (
                            <span key={caution} className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-700">
                              {caution}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                  {language === 'CN'
                    ? '该分区暂无成分建议，建议继续跟踪并复拍。'
                    : 'No ingredient action yet for this module. Track progress and retake later.'}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? '产品建议（Beta）' : 'Product rec (beta)'}</div>
              {hasProducts ? (
                <div className="space-y-2">
                  {selectedModule.products.slice(0, 3).map((product) => (
                    <button
                      key={`${selectedModule.module_id}_${product.product_id || product.title}`}
                      type="button"
                      className="w-full rounded-xl border border-border/60 bg-muted/20 p-3 text-left hover:bg-muted/30"
                      onClick={() => {
                        if (!analyticsCtx) return;
                        emitAuroraPhotoModulesProductTap(analyticsCtx, {
                          card_id: cardId ?? null,
                          module_id: selectedModule.module_id,
                          product_id: product.product_id || null,
                          merchant_id: product.merchant_id || null,
                          source_block: product.source_block || null,
                          price_tier: product.price_tier || null,
                          price: typeof product.price === 'number' ? product.price : null,
                          currency: product.currency || null,
                          title: product.title,
                        });
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-foreground">{product.title}</div>
                          {product.brand ? <div className="text-xs text-muted-foreground">{product.brand}</div> : null}
                        </div>
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.title} className="h-12 w-12 rounded-lg border border-border/50 object-cover" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border/50 bg-muted/40">
                            <Sparkles className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      {product.why_match ? <div className="mt-2 text-xs text-muted-foreground">{product.why_match}</div> : null}
                      {product.how_to_use ? (
                        <div className="mt-2 rounded-lg border border-border/60 bg-background/80 px-2 py-1.5 text-xs text-muted-foreground">
                          {product.how_to_use}
                        </div>
                      ) : null}
                      {product.cautions.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {product.cautions.slice(0, 3).map((caution) => (
                            <span key={caution} className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-700">
                              {caution}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                  {language === 'CN'
                    ? 'Product rec 为 Beta 或当前不可用，先按成分行动执行。'
                    : 'Product rec is beta/unavailable. Continue with ingredient actions for now.'}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
            {language === 'CN' ? '选择一个分区查看问题与行动建议。' : 'Select a module to view issues and actions.'}
          </div>
        )}

        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 font-medium text-foreground/90">
            <Droplets className="h-3.5 w-3.5" />
            {language === 'CN' ? '安全提示' : 'Safety notes'}
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {(model.disclaimers.seek_care_triggers.length
              ? model.disclaimers.seek_care_triggers
              : [
                  language === 'CN'
                    ? '若持续刺痛、灼热或明显加重，请暂停活性并咨询专业医生。'
                    : 'If stinging, burning, or worsening persists, pause actives and seek professional care.',
                ]
            ).map((trigger) => (
              <li key={trigger}>{trigger}</li>
            ))}
          </ul>
          {sanitizerDrops?.length ? (
            <div className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-700">
              <AlertTriangle className="mt-0.5 h-3 w-3" />
              <span>
                {language === 'CN'
                  ? `已对 ${sanitizerDrops.length} 个几何对象做安全裁剪。`
                  : `${sanitizerDrops.length} geometry segments were sanitized for safe rendering.`}
              </span>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
