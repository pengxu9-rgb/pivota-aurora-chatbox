import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Droplets, Sparkles } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type {
  PhotoModulesAction,
  PhotoModulesProduct,
  PhotoModulesModule,
  PhotoModulesRegion,
  PhotoModulesSanitizerDrop,
  PhotoModulesUiModelV1,
} from '@/lib/photoModulesContract';
import {
  emitAuroraPhotoModulesActionTap,
  emitAuroraPhotoModulesIssueTap,
  emitAuroraPhotoModulesModuleTap,
  emitAuroraPhotoModulesProductTap,
  emitUiOutboundOpened,
  emitUiPdpOpened,
  type AnalyticsContext,
} from '@/lib/auroraAnalytics';
import { buildGoogleSearchFallbackUrl, normalizeOutboundFallbackUrl } from '@/lib/externalSearchFallback';
import { buildPdpUrl, extractPdpTargetFromProductGroupId, extractStablePdpTargetFromProductsResolveResponse } from '@/lib/pivotaShop';
import type { Language } from '@/lib/types';
import { cn } from '@/lib/utils';

const HEATMAP_GRID = 64;

const PRODUCT_REC_ENABLED = (() => {
  const raw = String(import.meta.env.VITE_DIAG_PRODUCT_REC ?? 'true')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
})();
const MORE_PANEL_ENABLED = (() => {
  const raw = String(import.meta.env.VITE_PHOTO_ACTION_MORE_PANEL_ENABLED ?? 'true')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
})();
const CONFIDENCE_LOWVALUE_HIDE_NUMERIC = (() => {
  const raw = String(import.meta.env.VITE_PHOTO_CONFIDENCE_LOWVALUE_HIDE_NUMERIC ?? 'true')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
})();
const CONFIDENCE_LOW_THRESHOLD = (() => {
  const raw = Number(import.meta.env.VITE_PHOTO_CONFIDENCE_LOW_THRESHOLD ?? 0.15);
  if (!Number.isFinite(raw)) return 0.15;
  return Math.max(0.01, Math.min(0.6, raw));
})();

type IssueType = 'redness' | 'acne' | 'tone' | 'shine' | 'texture';
type Rgb = { r: number; g: number; b: number };

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
  const fillAlpha = (0.12 + intensity * 0.2) * alphaScale;
  const strokeAlpha = (0.35 + intensity * 0.45) * alphaScale;

  context.fillStyle = rgba(color, fillAlpha);
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
  const fillAlpha = (0.1 + intensity * 0.18) * alphaScale;
  const strokeAlpha = (0.34 + intensity * 0.48) * alphaScale;

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
  const signalSource = String(region.signal_stats?.source || '').trim().toLowerCase();
  const alphaFloor = signalSource === 'proxy' ? 0.2 : 0.1;
  for (let index = 0; index < values.length; index += 1) {
    const v = clamp01(values[index]);
    const pixelIndex = index * 4;
    imageData.data[pixelIndex] = color.r;
    imageData.data[pixelIndex + 1] = color.g;
    imageData.data[pixelIndex + 2] = color.b;
    const alphaRaw = clamp01(v * intensity * alphaScale);
    const alphaWithFloor = v > 0 ? Math.max(alphaRaw, alphaFloor * Math.min(1, v / 0.25)) : 0;
    imageData.data[pixelIndex + 3] = Math.round(clamp01(alphaWithFloor) * 255);
  }
  bufferContext.putImageData(imageData, 0, 0);

  context.save();
  context.imageSmoothingEnabled = smoothing_hint !== 'nearest';
  context.drawImage(bufferCanvas, 0, 0, width, height);
  context.restore();
};

const parseRleCounts = (counts: unknown): number[] => {
  if (Array.isArray(counts)) {
    return counts
      .map((value) => Math.max(0, Math.round(Number(value))))
      .filter((value) => Number.isFinite(value));
  }
  if (typeof counts === 'string') {
    return counts
      .split(/[\s,]+/)
      .map((token) => Math.max(0, Math.round(Number(token))))
      .filter((value) => Number.isFinite(value));
  }
  return [];
};

const resolveModuleMaskGrid = (module: PhotoModulesModule): { w: number; h: number } | null => {
  const grid = module.mask_grid || module.mask_rle_norm?.grid || null;
  if (!grid) return null;
  const w = Math.max(1, Math.min(1024, Math.round(Number((grid as any).w || 0))));
  const h = Math.max(1, Math.min(1024, Math.round(Number((grid as any).h || 0))));
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  return { w, h };
};

const decodeModuleMaskValues = (module: PhotoModulesModule): { grid: { w: number; h: number }; values: number[] } | null => {
  const grid = resolveModuleMaskGrid(module);
  if (!grid) return null;
  const total = grid.w * grid.h;
  if (total <= 0) return null;

  const valuesRaw = Array.isArray(module.mask_rle_norm?.values) ? module.mask_rle_norm?.values : null;
  if (valuesRaw && valuesRaw.length === total) {
    return {
      grid,
      values: valuesRaw.map((value) => clamp01(Number.isFinite(Number(value)) ? Number(value) : 0)),
    };
  }

  const counts = parseRleCounts(module.mask_rle_norm?.counts);
  if (counts.length) {
    const start = module.mask_rle_norm?.starts_with === 1 ? 1 : 0;
    const out: number[] = new Array(total).fill(0);
    let writeIndex = 0;
    let state = start;
    for (const run of counts) {
      if (run <= 0) continue;
      const end = Math.min(total, writeIndex + run);
      if (state === 1) {
        for (let idx = writeIndex; idx < end; idx += 1) out[idx] = 1;
      }
      writeIndex = end;
      state = state === 1 ? 0 : 1;
      if (writeIndex >= total) break;
    }
    return { grid, values: out };
  }

  if (Array.isArray(module.module_pixels) && module.module_pixels.length) {
    const out: number[] = new Array(total).fill(0);
    for (const raw of module.module_pixels) {
      const idx = Math.round(Number(raw));
      if (!Number.isFinite(idx) || idx < 0 || idx >= total) continue;
      out[idx] = 1;
    }
    return { grid, values: out };
  }

  return null;
};

const drawModuleMask = (
  context: CanvasRenderingContext2D,
  module: PhotoModulesModule,
  width: number,
  height: number,
  alphaScale: number,
): boolean => {
  const decoded = decodeModuleMaskValues(module);
  if (decoded) {
    const issueType = module.issues[0]?.issue_type;
    const color = issueType && ISSUE_COLOR_MAP[issueType as IssueType] ? ISSUE_COLOR_MAP[issueType as IssueType] : ISSUE_COLOR_MAP.texture;
    const bufferCanvas = document.createElement('canvas');
    bufferCanvas.width = decoded.grid.w;
    bufferCanvas.height = decoded.grid.h;
    const bufferContext = bufferCanvas.getContext('2d');
    if (!bufferContext) return false;

    const imageData = bufferContext.createImageData(decoded.grid.w, decoded.grid.h);
    for (let idx = 0; idx < decoded.values.length; idx += 1) {
      const alpha = clamp01(decoded.values[idx] * alphaScale);
      const offset = idx * 4;
      imageData.data[offset] = color.r;
      imageData.data[offset + 1] = color.g;
      imageData.data[offset + 2] = color.b;
      imageData.data[offset + 3] = Math.round(alpha * 255);
    }
    bufferContext.putImageData(imageData, 0, 0);
    context.save();
    context.imageSmoothingEnabled = true;
    context.drawImage(bufferCanvas, 0, 0, width, height);
    context.restore();
    return true;
  }

  if (module.box) {
    const color = ISSUE_COLOR_MAP.texture;
    const x = module.box.x * width;
    const y = module.box.y * height;
    const boxWidth = module.box.w * width;
    const boxHeight = module.box.h * height;
    context.fillStyle = rgba(color, 0.18 * alphaScale);
    context.fillRect(x, y, boxWidth, boxHeight);
    context.strokeStyle = rgba(color, 0.68 * alphaScale);
    context.lineWidth = 2;
    context.strokeRect(x, y, boxWidth, boxHeight);
    return true;
  }

  return false;
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

const scoreIssue = (issue: PhotoModulesModule['issues'][number]): number => {
  const rank = Number(issue.issue_rank_score);
  if (Number.isFinite(rank)) return rank;
  return issue.severity_0_4 * 0.7 + issue.confidence_0_1 * 0.3;
};

const scoreModule = (module: PhotoModulesModule): number => {
  const rank = Number(module.module_rank_score);
  if (Number.isFinite(rank)) return rank;
  const topIssue = [...(module.issues || [])].sort((left, right) => scoreIssue(right) - scoreIssue(left))[0];
  return topIssue ? scoreIssue(topIssue) : 0;
};

const pickTopIssueType = (module: PhotoModulesModule | null): string | null => {
  if (!module || !Array.isArray(module.issues) || !module.issues.length) return null;
  const sorted = [...module.issues].sort((left, right) => {
    const scoreDiff = scoreIssue(right) - scoreIssue(left);
    if (Math.abs(scoreDiff) > 1e-6) return scoreDiff;
    return right.confidence_0_1 - left.confidence_0_1;
  });
  return sorted[0]?.issue_type || null;
};

const explainProductsEmptyReason = (reason: string | null, language: Language): string => {
  const token = String(reason || '').trim().toLowerCase();
  if (!token) {
    return language === 'CN' ? '当前暂无可展示商品。' : 'No suitable product is available right now.';
  }
  if (token === 'ingredient_id_missing') {
    return language === 'CN' ? '成分标识缺失，暂时无法匹配商品。' : 'Ingredient id is missing, so product matching is unavailable.';
  }
  if (token === 'strict_filter_fallback_only') {
    return language === 'CN' ? '严格过滤后暂无直出商品，可先查看外部搜索建议。' : 'Strict filtering removed all direct products. External search suggestions are available.';
  }
  if (token === 'low_evidence') {
    return language === 'CN' ? '当前证据强度不足，暂不直推商品。' : 'Evidence strength is limited, so direct product output is withheld.';
  }
  return language === 'CN'
    ? `暂无直出商品（${token}）。`
    : `No direct product was returned (${token}).`;
};

const sourceBadgeLabel = (source: string, language: Language): string => {
  const token = String(source || '').trim().toLowerCase();
  if (token === 'catalog') return language === 'CN' ? '目录' : 'Catalog';
  if (token === 'external_seed') return language === 'CN' ? '外部候选' : 'External';
  if (token === 'llm_fallback') return language === 'CN' ? 'LLM 兜底' : 'LLM fallback';
  return language === 'CN' ? '推荐' : 'Recommended';
};

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(Boolean(mql.matches));
    onChange();
    if (typeof mql.addEventListener === 'function') mql.addEventListener('change', onChange);
    else mql.addListener(onChange);
    return () => {
      if (typeof mql.removeEventListener === 'function') mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, [query]);

  return matches;
}

const formatPriceText = (product: PhotoModulesProduct): string => {
  const label = String(product.price_label || '').trim();
  if (label) return label;
  if (!Number.isFinite(Number(product.price))) return '';
  const currency = String(product.currency || '').trim().toUpperCase();
  const amount = Number(product.price);
  const symbol = currency === 'CNY' || currency === 'RMB' ? '¥' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  return `${symbol}${Math.round(amount * 100) / 100}`;
};

const formatSocialProofText = (product: PhotoModulesProduct, language: Language): string => {
  const social = product.social_proof;
  if (!social) return '';
  const parts: string[] = [];
  if (Number.isFinite(Number(social.rating))) parts.push(`${Number(social.rating).toFixed(1)}/5`);
  if (Number.isFinite(Number(social.review_count))) {
    const count = Math.max(0, Math.trunc(Number(social.review_count)));
    parts.push(language === 'CN' ? `${count} 条评价` : `${count} reviews`);
  }
  if (String(social.summary || '').trim()) parts.push(String(social.summary || '').trim());
  return parts.join(' · ');
};

const buildActionProductQuery = (action: PhotoModulesAction, product: PhotoModulesProduct): string => {
  const title = String(product.title || '').trim();
  const brand = String(product.brand || '').trim();
  const ingredient = String(action.ingredient_name || '').trim();
  return [brand, title, ingredient].filter(Boolean).join(' ').trim();
};

export function PhotoModulesCard({
  model,
  language,
  analyticsCtx,
  cardId,
  sanitizerDrops,
  resolveProductRef,
  onOpenPdp,
}: {
  model: PhotoModulesUiModelV1;
  language: Language;
  analyticsCtx?: AnalyticsContext;
  cardId?: string;
  sanitizerDrops?: PhotoModulesSanitizerDrop[];
  resolveProductRef?: (args: {
    query: string;
    lang: 'en' | 'cn';
    hints?: {
      product_ref?: { product_id?: string | null; merchant_id?: string | null } | null;
      product_id?: string | null;
      sku_id?: string | null;
      aliases?: Array<string | null | undefined>;
      brand?: string | null;
      title?: string | null;
    };
    signal?: AbortSignal;
  }) => Promise<any>;
  onOpenPdp?: (args: { url: string; title?: string }) => void;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const highlightCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedIssueType, setSelectedIssueType] = useState<string | null>(null);
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [morePanelOpen, setMorePanelOpen] = useState(false);
  const [morePanelModuleId, setMorePanelModuleId] = useState<string | null>(null);
  const [morePanelActionIngredientId, setMorePanelActionIngredientId] = useState<string | null>(null);
  const [openingProductKey, setOpeningProductKey] = useState<string | null>(null);
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const imageAspect = `${model.face_crop.render_size_px_hint.w}/${model.face_crop.render_size_px_hint.h}`;
  const cropImageUrl = model.face_crop.crop_image_url;
  const originalImageUrl = model.face_crop.original_image_url;
  const hasRenderableImage = Boolean(cropImageUrl || originalImageUrl);

  const defaultFocus = useMemo(() => {
    const modules = Array.isArray(model.modules) ? model.modules : [];
    if (!modules.length) return { moduleId: null as string | null, issueType: null as string | null };

    const summaryModuleId = String(model.summary_v1?.top_module_id || '').trim();
    const summaryIssueType = String(model.summary_v1?.top_issue_type || '').trim();
    const summaryModule = modules.find((module) => module.module_id === summaryModuleId) || null;
    const fallbackModule = [...modules].sort((left, right) => scoreModule(right) - scoreModule(left))[0] || null;
    const targetModule = summaryModule || fallbackModule;
    const summaryIssueExists = Boolean(
      targetModule && summaryIssueType && targetModule.issues.some((issue) => issue.issue_type === summaryIssueType),
    );
    const issueType = summaryIssueExists ? summaryIssueType : pickTopIssueType(targetModule);
    return {
      moduleId: targetModule?.module_id || null,
      issueType,
    };
  }, [model.modules, model.summary_v1]);

  useEffect(() => {
    const modules = Array.isArray(model.modules) ? model.modules : [];
    if (!modules.length) {
      if (selectedModuleId != null) setSelectedModuleId(null);
      if (selectedIssueType != null) setSelectedIssueType(null);
      return;
    }
    const activeModule =
      (selectedModuleId ? modules.find((module) => module.module_id === selectedModuleId) : null)
      || null;
    const resolvedModule = activeModule || modules.find((module) => module.module_id === defaultFocus.moduleId) || modules[0];
    if (!resolvedModule) return;
    if (selectedModuleId !== resolvedModule.module_id) setSelectedModuleId(resolvedModule.module_id);
    const issueExists = Boolean(
      selectedIssueType && resolvedModule.issues.some((issue) => issue.issue_type === selectedIssueType),
    );
    const desiredIssueType = issueExists ? selectedIssueType : pickTopIssueType(resolvedModule);
    if (desiredIssueType !== selectedIssueType) setSelectedIssueType(desiredIssueType);
  }, [defaultFocus.moduleId, model.modules, selectedIssueType, selectedModuleId]);

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
  const preferredModuleId = defaultFocus.moduleId;
  const selectedModule = useMemo(
    () =>
      model.modules.find((module) => module.module_id === selectedModuleId)
      ?? model.modules.find((module) => module.module_id === preferredModuleId)
      ?? model.modules[0]
      ?? null,
    [model.modules, preferredModuleId, selectedModuleId],
  );
  const morePanelModule = useMemo(
    () => model.modules.find((module) => module.module_id === morePanelModuleId) ?? null,
    [model.modules, morePanelModuleId],
  );
  const morePanelAction = useMemo(
    () =>
      (morePanelModule?.actions || []).find(
        (action) => `${morePanelModule?.module_id || ''}::${action.ingredient_id}` === morePanelActionIngredientId,
      ) || null,
    [morePanelActionIngredientId, morePanelModule],
  );
  useEffect(() => {
    if (!morePanelOpen) return;
    if (!MORE_PANEL_ENABLED) {
      setMorePanelOpen(false);
      return;
    }
    if (morePanelModule && morePanelAction) return;
    setMorePanelOpen(false);
  }, [morePanelAction, morePanelModule, morePanelOpen]);

  const moduleEvidenceRegionIds = useMemo(() => {
    if (!selectedModule) return allRegionIds;
    if (Array.isArray(selectedModule.evidence_region_ids) && selectedModule.evidence_region_ids.length) {
      return new Set(selectedModule.evidence_region_ids);
    }
    const ids = new Set<string>();
    selectedModule.issues.forEach((issue) => {
      issue.evidence_region_ids.forEach((regionId) => ids.add(regionId));
    });
    if (!ids.size) return allRegionIds;
    return ids;
  }, [allRegionIds, selectedModule]);

  const issueEvidenceRegionIds = useMemo(() => {
    if (!selectedModule || !selectedIssueType) return null;
    const issue = selectedModule.issues.find((current) => current.issue_type === selectedIssueType);
    if (!issue || !issue.evidence_region_ids.length) return null;
    return new Set(issue.evidence_region_ids);
  }, [selectedIssueType, selectedModule]);

  const issueSelectionActive = Boolean(selectedIssueType && issueEvidenceRegionIds && issueEvidenceRegionIds.size > 0);
  const issueSelectionUsesProxy = useMemo(() => {
    if (!issueSelectionActive || !issueEvidenceRegionIds) return false;
    return Array.from(issueEvidenceRegionIds).some((regionId) => {
      const region = regions.find((candidate) => candidate.region_id === regionId);
      return String(region?.signal_stats?.source || '').trim().toLowerCase() === 'proxy';
    });
  }, [issueEvidenceRegionIds, issueSelectionActive, regions]);

  const visibleRegionIds = issueEvidenceRegionIds ?? moduleEvidenceRegionIds;

  const highlightedRegionIds = useMemo(() => {
    const ids = new Set<string>(visibleRegionIds);
    if (hoveredRegionId) ids.add(hoveredRegionId);
    return ids;
  }, [hoveredRegionId, visibleRegionIds]);

  const selectedModuleHasMask = useMemo(() => {
    if (!selectedModule) return false;
    return Boolean(decodeModuleMaskValues(selectedModule) || selectedModule.box);
  }, [selectedModule]);

  const selectedTopIssueType = useMemo(() => {
    return pickTopIssueType(selectedModule);
  }, [selectedModule]);

  const hasFocusedSelection = highlightedRegionIds.size > 0 && highlightedRegionIds.size < allRegionIds.size;

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
    drawRegions(context, regions, stageSize.width, stageSize.height, {
      alphaScale: 0.95,
      lineBoost: 1,
    });
  }, [regions, stageSize.height, stageSize.width]);

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

    if (!issueSelectionActive && selectedModule && drawModuleMask(context, selectedModule, stageSize.width, stageSize.height, 0.92)) return;
    if (!highlightedRegionIds.size || highlightedRegionIds.size === allRegionIds.size) return;

    drawRegions(context, regions, stageSize.width, stageSize.height, {
      includeIds: highlightedRegionIds,
      alphaScale: 1,
      lineBoost: 1.3,
    });
  }, [allRegionIds.size, highlightedRegionIds, issueSelectionActive, regions, selectedModule, stageSize.height, stageSize.width]);

  const hasActionProducts = Boolean(
    PRODUCT_REC_ENABLED &&
      selectedModule &&
      selectedModule.actions.some((action) => Array.isArray(action.products) && action.products.some((product) => Boolean(product.title))),
  );
  const moduleSummaryProducts =
    PRODUCT_REC_ENABLED && selectedModule
      ? selectedModule.products.filter((product) => Boolean(product.title)).slice(0, 3)
      : [];

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

  const handleModuleSelect = (moduleId: string) => {
    setHoveredRegionId(null);
    const module = model.modules.find((row) => row.module_id === moduleId) || null;
    const nextIssueType = pickTopIssueType(module);
    setSelectedModuleId(moduleId);
    setSelectedIssueType(nextIssueType);
    if (analyticsCtx) {
      emitAuroraPhotoModulesModuleTap(analyticsCtx, {
        card_id: cardId ?? null,
        module_id: moduleId,
        selected: true,
        quality_grade: model.quality_grade,
        sanitizer_drop_count: sanitizerDrops?.length ?? 0,
      });
    }
  };

  const handleIssueSelect = (moduleId: string, issueType: string) => {
    setSelectedModuleId(moduleId);
    setHoveredRegionId(null);
    setSelectedIssueType(issueType);
    if (analyticsCtx) {
      emitAuroraPhotoModulesIssueTap(analyticsCtx, {
        card_id: cardId ?? null,
        module_id: moduleId,
        issue_type: issueType,
        selected: true,
        quality_grade: model.quality_grade,
      });
    }
  };

  const openMorePanel = (module: PhotoModulesModule, action: PhotoModulesAction) => {
    if (!MORE_PANEL_ENABLED) return;
    setMorePanelModuleId(module.module_id);
    setMorePanelActionIngredientId(`${module.module_id}::${action.ingredient_id}`);
    setMorePanelOpen(true);
  };

  const openExternal = (url: string, query: string) => {
    const normalizedUrl = normalizeOutboundFallbackUrl(String(url || '').trim());
    if (normalizedUrl) {
      try {
        if (analyticsCtx) {
          let domain = '';
          try {
            domain = new URL(normalizedUrl).hostname;
          } catch {
            domain = '';
          }
          emitUiOutboundOpened(analyticsCtx, {
            merchant_domain: domain || 'external',
            card_position: 0,
            sku_type: 'external_url',
            card_id: cardId ?? null,
          });
        }
        const opened = window.open(normalizedUrl, '_blank', 'noopener,noreferrer');
        if (!opened) window.location.assign(normalizedUrl);
        return true;
      } catch {
        return false;
      }
    }
    const googleUrl = buildGoogleSearchFallbackUrl(query, language);
    if (!googleUrl) return false;
    try {
      const opened = window.open(googleUrl, '_blank', 'noopener,noreferrer');
      if (!opened) window.location.assign(googleUrl);
      return true;
    } catch {
      return false;
    }
  };

  const openProduct = async ({
    moduleId,
    action,
    product,
    productIndex,
  }: {
    moduleId: string;
    action: PhotoModulesAction;
    product: PhotoModulesProduct;
    productIndex: number;
  }) => {
    const productKey = `${moduleId}::${action.ingredient_id}::${product.product_id || product.title || productIndex}`;
    setOpeningProductKey(productKey);
    const title = [String(product.brand || '').trim(), String(product.title || '').trim()].filter(Boolean).join(' ').trim();
    const query = buildActionProductQuery(action, product);
    try {
      if (analyticsCtx) {
        emitAuroraPhotoModulesProductTap(analyticsCtx, {
          card_id: cardId ?? null,
          module_id: moduleId,
          product_id: product.product_id || null,
          merchant_id: product.merchant_id || null,
          title: product.title,
          ingredient_id: action.ingredient_id,
        });
      }

      const groupTarget = extractPdpTargetFromProductGroupId(product.product_group_id || null);
      if (groupTarget?.product_id) {
        const pdpUrl = buildPdpUrl(groupTarget);
        if (analyticsCtx) {
          emitUiPdpOpened(analyticsCtx, {
            product_id: groupTarget.product_id,
            merchant_id: groupTarget.merchant_id ?? null,
            card_position: productIndex,
            sku_type: 'product_group_id',
            card_id: cardId ?? null,
          });
        }
        if (onOpenPdp) onOpenPdp({ url: pdpUrl, ...(title ? { title } : {}) });
        else window.location.assign(pdpUrl);
        return;
      }

      const canonicalRef = product.canonical_product_ref;
      if (canonicalRef?.product_id) {
        const pdpUrl = buildPdpUrl({
          product_id: canonicalRef.product_id,
          merchant_id: canonicalRef.merchant_id || product.merchant_id || null,
        });
        if (analyticsCtx) {
          emitUiPdpOpened(analyticsCtx, {
            product_id: canonicalRef.product_id,
            merchant_id: canonicalRef.merchant_id || product.merchant_id || null,
            card_position: productIndex,
            sku_type: 'canonical_ref',
            card_id: cardId ?? null,
          });
        }
        if (onOpenPdp) onOpenPdp({ url: pdpUrl, ...(title ? { title } : {}) });
        else window.location.assign(pdpUrl);
        return;
      }

      const directUrl = String(product.product_url || '').trim();
      if (directUrl) {
        if (openExternal(directUrl, query || title || action.ingredient_name)) return;
      }

      if (resolveProductRef && query) {
        try {
          const resp = await resolveProductRef({
            query,
            lang: language === 'CN' ? 'cn' : 'en',
            hints: {
              ...(product.product_id ? { product_id: product.product_id } : {}),
              ...(product.brand ? { brand: product.brand } : {}),
              ...(product.title ? { title: product.title } : {}),
              aliases: [title, action.ingredient_name, product.title].filter(Boolean),
              ...(product.product_id || product.merchant_id
                ? {
                    product_ref: {
                      ...(product.product_id ? { product_id: product.product_id } : {}),
                      ...(product.merchant_id ? { merchant_id: product.merchant_id } : {}),
                    },
                  }
                : {}),
            },
          });
          const target = extractStablePdpTargetFromProductsResolveResponse(resp);
          if (target?.product_id) {
            const pdpUrl = buildPdpUrl({
              product_id: target.product_id,
              merchant_id: target.merchant_id || null,
            });
            if (analyticsCtx) {
              emitUiPdpOpened(analyticsCtx, {
                product_id: target.product_id,
                merchant_id: target.merchant_id || null,
                card_position: productIndex,
                sku_type: 'resolve',
                card_id: cardId ?? null,
              });
            }
            if (onOpenPdp) onOpenPdp({ url: pdpUrl, ...(title ? { title } : {}) });
            else window.location.assign(pdpUrl);
            return;
          }
        } catch {
          // Falls through to search fallback.
        }
      }

      openExternal('', query || title || action.ingredient_name);
    } finally {
      setOpeningProductKey((prev) => (prev === productKey ? null : prev));
    }
  };

  const renderMorePanelBody = () => {
    if (!morePanelAction || !morePanelModule) return null;
    const products = (Array.isArray(morePanelAction.products) ? morePanelAction.products : []).filter((row) => Boolean(row.title));
    const hasProducts = products.length > 0;
    return (
      <div className="mt-3 space-y-3 px-4 pb-4">
        <div className="text-xs text-muted-foreground">
          {language === 'CN'
            ? `${morePanelAction.ingredient_name} · 共 ${products.length} 个推荐`
            : `${morePanelAction.ingredient_name} · ${products.length} recommendations`}
        </div>
        {hasProducts ? (
          <div className="space-y-2">
            {products.map((product, index) => (
              <button
                key={`${morePanelModule.module_id}_${morePanelAction.ingredient_id}_${product.product_id || product.title || index}`}
                type="button"
                className="w-full rounded-xl border border-border/60 bg-background/80 p-3 text-left hover:bg-background disabled:opacity-70"
                disabled={openingProductKey === `${morePanelModule.module_id}::${morePanelAction.ingredient_id}::${product.product_id || product.title || index}`}
                onClick={() =>
                  void openProduct({
                    moduleId: morePanelModule.module_id,
                    action: morePanelAction,
                    product,
                    productIndex: index,
                  })
                }
              >
                <div className="flex items-start gap-3">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.title} className="h-14 w-14 rounded-lg border border-border/60 object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-border/60 bg-muted/30">
                      <Sparkles className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-semibold text-foreground">{product.title}</div>
                      {product.retrieval_source ? (
                        <span className="shrink-0 rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                          {sourceBadgeLabel(product.retrieval_source, language)}
                        </span>
                      ) : null}
                    </div>
                    {product.brand ? <div className="mt-0.5 text-xs text-muted-foreground">{product.brand}</div> : null}
                    {product.benefit_tags.length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {product.benefit_tags.slice(0, 4).map((tag) => (
                          <span key={tag} className="rounded-full border border-border/60 bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {(formatPriceText(product) || formatSocialProofText(product, language)) ? (
                      <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        {formatPriceText(product) ? <span>{formatPriceText(product)}</span> : null}
                        {formatSocialProofText(product, language) ? <span>{formatSocialProofText(product, language)}</span> : null}
                      </div>
                    ) : null}
                    {product.why_match ? <div className="mt-1 text-[11px] text-muted-foreground">{product.why_match}</div> : null}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              {explainProductsEmptyReason(morePanelAction.products_empty_reason, language)}
            </div>
            {(Array.isArray(morePanelAction.external_search_ctas) ? morePanelAction.external_search_ctas : []).slice(0, 4).map((cta, idx) => (
              <a
                key={`${morePanelAction.ingredient_id}_cta_${idx}`}
                href={cta.url || '#'}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-full border border-border/60 bg-background px-2 py-1 text-[11px] text-foreground hover:bg-muted/20"
              >
                {cta.title || (language === 'CN' ? '外部搜索' : 'External search')}
              </a>
            ))}
          </div>
        )}
      </div>
    );
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
              {language === 'CN'
                ? '当前未拿到可渲染照片，以下先展示模块结论与行动建议。'
                : 'No renderable photo is available right now. Module findings and actions are shown below.'}
            </div>
          ) : null}

          {hasRenderableImage ? (
            <div
              ref={stageRef}
              className="relative w-full overflow-hidden rounded-2xl border border-border/60 bg-muted/20"
              style={{ aspectRatio: imageAspect }}
            >
              {cropImageUrl ? (
                <img
                  src={cropImageUrl}
                  alt={language === 'CN' ? '脸部裁剪图' : 'Face crop'}
                  className="absolute inset-0 h-full w-full object-cover"
                  draggable={false}
                />
              ) : originalImageUrl && originalCropStyle ? (
                <img
                  src={originalImageUrl}
                  alt={language === 'CN' ? '原图裁剪预览' : 'Original crop preview'}
                  className="absolute"
                  style={originalCropStyle}
                  draggable={false}
                />
              ) : (
                <img
                  src={originalImageUrl}
                  alt={language === 'CN' ? '原图预览' : 'Original image preview'}
                  className="absolute inset-0 h-full w-full object-cover"
                  draggable={false}
                />
              )}

              <canvas
                ref={baseCanvasRef}
                data-testid="photo-modules-base-canvas"
                data-focused={hasFocusedSelection ? '1' : '0'}
                className="pointer-events-none absolute inset-0 h-full w-full"
                style={{ opacity: hasFocusedSelection ? 0.2 : 1 }}
              />
              <canvas
                ref={highlightCanvasRef}
                data-testid="photo-modules-highlight-canvas"
                data-visible-count={visibleRegionIds.size}
                data-highlight-count={issueSelectionActive ? highlightedRegionIds.size : selectedModuleHasMask ? 1 : highlightedRegionIds.size}
                data-highlight-mode={issueSelectionActive ? 'region' : selectedModuleHasMask ? 'mask' : hasFocusedSelection ? 'region' : 'none'}
                className="pointer-events-none absolute inset-0 h-full w-full"
              />
              {issueSelectionActive && issueSelectionUsesProxy ? (
                <div className="pointer-events-none absolute right-2 top-2 rounded-full border border-border/70 bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {language === 'CN' ? '代理高亮' : 'Proxy highlight'}
                </div>
              ) : null}
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
              const isActive = selectedModule?.module_id === module.module_id;
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
                  {getModuleLabel(module.module_id, language)} · S{maxSeverity}
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
                    const topConcern = selectedTopIssueType === issue.issue_type;
                    const confidenceBucket = (() => {
                      const token = String(issue.confidence_bucket || '').trim().toLowerCase();
                      if (token === 'low' || token === 'medium' || token === 'high') return token;
                      if (issue.confidence_0_1 < CONFIDENCE_LOW_THRESHOLD) return 'low';
                      return issue.confidence_0_1 < 0.5 ? 'medium' : 'high';
                    })();
                    const hideConfidenceNumeric = CONFIDENCE_LOWVALUE_HIDE_NUMERIC && confidenceBucket === 'low';
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
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold text-foreground">{getIssueLabel(issue.issue_type, language)}</div>
                            {topConcern ? (
                              <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                                {language === 'CN' ? '重点问题' : 'Top Concern'}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[10px] font-semibold text-foreground">
                              S{issue.severity_0_4}
                            </span>
                            <span className="rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground">
                              {hideConfidenceNumeric
                                ? (language === 'CN' ? '低置信' : 'Low confidence')
                                : toPercent(issue.confidence_0_1)}
                            </span>
                          </div>
                        </div>
                        <div className="mt-1 text-xs font-medium text-foreground/90">{issue.explanation_short}</div>
                        {hideConfidenceNumeric ? (
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {language === 'CN'
                              ? '建议在均匀光线下复拍以提升圈选稳定性。'
                              : 'Retake in even lighting for a more stable highlight.'}
                          </div>
                        ) : null}
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
                  {selectedModule.actions.map((action) => {
                    const actionProducts = PRODUCT_REC_ENABLED
                      ? (Array.isArray(action.products) ? action.products : []).filter((product) => Boolean(product.title)).slice(0, 6)
                      : [];
                    const primaryProduct = actionProducts[0] ?? null;
                    const externalSearchCtas = PRODUCT_REC_ENABLED
                      ? (Array.isArray(action.external_search_ctas) ? action.external_search_ctas : []).slice(0, 2)
                      : [];
                    const showActionFallback = PRODUCT_REC_ENABLED && !actionProducts.length && (Boolean(action.products_empty_reason) || externalSearchCtas.length > 0);
                    return (
                      <div
                        key={`${selectedModule.module_id}_${action.ingredient_id}`}
                        className="rounded-xl border border-border/60 bg-muted/20 p-3"
                      >
                        <button
                          type="button"
                          className="w-full text-left"
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
                          <div className="mt-1 rounded-lg border border-border/50 bg-background/70 px-2 py-1.5 text-xs font-medium text-foreground/90">
                            {language === 'CN' ? '为什么推荐：' : 'Why it matters: '}
                            {action.why}
                          </div>
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

                        {PRODUCT_REC_ENABLED && primaryProduct ? (
                          <div className="mt-2 space-y-2" data-testid={`photo-modules-action-products-${action.ingredient_id}`}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[11px] font-semibold text-muted-foreground">
                                {language === 'CN' ? '主推商品' : 'Top match'}
                              </div>
                              {MORE_PANEL_ENABLED && actionProducts.length > 1 ? (
                                <button
                                  type="button"
                                  className="rounded-full border border-border/60 bg-background/80 px-2 py-0.5 text-[10px] font-semibold text-foreground hover:bg-background"
                                  onClick={() => openMorePanel(selectedModule, action)}
                                >
                                  {language === 'CN' ? '更多' : 'More'}
                                </button>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              className="w-full rounded-lg border border-border/60 bg-background/80 p-2 text-left hover:bg-background disabled:cursor-not-allowed disabled:opacity-70"
                              disabled={openingProductKey === `${selectedModule.module_id}::${action.ingredient_id}::${primaryProduct.product_id || primaryProduct.title || 0}`}
                              onClick={() =>
                                void openProduct({
                                  moduleId: selectedModule.module_id,
                                  action,
                                  product: primaryProduct,
                                  productIndex: 0,
                                })
                              }
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="truncate text-xs font-semibold text-foreground">{primaryProduct.title}</div>
                                  {primaryProduct.brand ? <div className="mt-0.5 text-[11px] text-muted-foreground">{primaryProduct.brand}</div> : null}
                                </div>
                                {primaryProduct.retrieval_source ? (
                                  <span className="shrink-0 rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                                    {sourceBadgeLabel(primaryProduct.retrieval_source, language)}
                                  </span>
                                ) : null}
                              </div>
                              {primaryProduct.why_match ? <div className="mt-1 text-[11px] text-muted-foreground">{primaryProduct.why_match}</div> : null}
                              {primaryProduct.benefit_tags.length ? (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {primaryProduct.benefit_tags.slice(0, 3).map((tag) => (
                                    <span key={tag} className="rounded-full border border-border/60 bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                              {(formatPriceText(primaryProduct) || formatSocialProofText(primaryProduct, language)) ? (
                                <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                                  {formatPriceText(primaryProduct) ? <span>{formatPriceText(primaryProduct)}</span> : null}
                                  {formatSocialProofText(primaryProduct, language) ? <span>{formatSocialProofText(primaryProduct, language)}</span> : null}
                                </div>
                              ) : null}
                            </button>
                          </div>
                        ) : null}

                        {showActionFallback ? (
                          <div className="mt-2 space-y-2 text-xs text-muted-foreground" data-testid={`photo-modules-action-empty-${action.ingredient_id}`}>
                            <div className="rounded-lg border border-border/60 bg-background/70 px-2 py-1.5">
                              {explainProductsEmptyReason(action.products_empty_reason, language)}
                            </div>
                            {externalSearchCtas.length ? (
                              <div className="flex flex-wrap gap-1.5">
                                {externalSearchCtas.map((cta, index) => (
                                  <a
                                    key={`${action.ingredient_id}_cta_${index}`}
                                    href={cta.url || '#'}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full border border-border/60 bg-background/80 px-2 py-1 text-[10px] text-foreground hover:bg-background"
                                  >
                                    {cta.title || (language === 'CN' ? '外部搜索' : 'External search')}
                                  </a>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
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
              <div className="text-xs font-semibold text-muted-foreground">
                {language === 'CN' ? '模块汇总商品（次级）' : 'Module-level product summary'}
              </div>
              {PRODUCT_REC_ENABLED && moduleSummaryProducts.length ? (
                <div className="space-y-2">
                  {moduleSummaryProducts.map((product) => (
                    <button
                      key={`${selectedModule.module_id}_${product.product_id || product.title}`}
                      type="button"
                      className="w-full rounded-xl border border-border/60 bg-muted/20 p-3 text-left hover:bg-muted/30"
                      onClick={() =>
                        void openProduct({
                          moduleId: selectedModule.module_id,
                          action: {
                            action_type: 'ingredient',
                            ingredient_id: 'module_summary',
                            ingredient_canonical_id: null,
                            ingredient_name: language === 'CN' ? '模块汇总' : 'Module summary',
                            why: '',
                            how_to_use: { time: 'AM_PM', frequency: '2-3x_week', notes: '' },
                            cautions: [],
                            action_rank_score: null,
                            group: null,
                            evidence_issue_types: [],
                            timeline: '',
                            do_not_mix: [],
                            products: [],
                            products_empty_reason: null,
                            external_search_ctas: [],
                            rec_debug: null,
                          },
                          product,
                          productIndex: 0,
                        })
                      }
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
                      {product.retrieval_source ? (
                        <div className="mt-2 text-[11px] text-muted-foreground">
                          {language === 'CN' ? '来源：' : 'Source: '}
                          {sourceBadgeLabel(product.retrieval_source, language)}
                          {product.retrieval_reason ? ` · ${product.retrieval_reason}` : ''}
                        </div>
                      ) : null}
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
                  {!PRODUCT_REC_ENABLED
                    ? (language === 'CN'
                      ? '商品推荐已通过开关关闭。'
                      : 'Product recommendations are disabled by feature flag.')
                    : hasActionProducts
                      ? (language === 'CN'
                        ? '优先查看上方每个成分下的商品推荐。'
                        : 'Primary recommendations are shown under each ingredient action above.')
                      : (language === 'CN'
                        ? '当前模块暂无可汇总商品，请先参考成分行动建议。'
                        : 'No module-level products are available right now. Follow ingredient actions first.')}
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
      {MORE_PANEL_ENABLED ? (
        isDesktop ? (
        <Sheet open={morePanelOpen} onOpenChange={setMorePanelOpen}>
          <SheetContent
            side="right"
            className="w-[480px] max-w-[92vw] overflow-y-auto"
            aria-label={language === 'CN' ? '查看更多商品' : 'More products'}
            aria-describedby={undefined}
          >
            <SheetHeader>
              <SheetTitle>{language === 'CN' ? '查看更多商品' : 'More products'}</SheetTitle>
            </SheetHeader>
            {renderMorePanelBody()}
          </SheetContent>
        </Sheet>
      ) : (
        <Drawer open={morePanelOpen} onOpenChange={setMorePanelOpen}>
          <DrawerContent aria-label={language === 'CN' ? '查看更多商品' : 'More products'} aria-describedby={undefined}>
            <DrawerHeader>
              <DrawerTitle>{language === 'CN' ? '查看更多商品' : 'More products'}</DrawerTitle>
            </DrawerHeader>
            {renderMorePanelBody()}
          </DrawerContent>
        </Drawer>
      )
      ) : null}
    </Card>
  );
}
