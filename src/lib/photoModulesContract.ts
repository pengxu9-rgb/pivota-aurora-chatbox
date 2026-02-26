import { z } from 'zod';

const FACE_CROP_NORM_COORD_SPACE = 'face_crop_norm_v1' as const;
const ORIG_PX_COORD_SPACE = 'orig_px_v1' as const;

const MODULE_IDS = [
  'forehead',
  'left_cheek',
  'right_cheek',
  'nose',
  'chin',
  'under_eye_left',
  'under_eye_right',
] as const;

const ISSUE_TYPES = ['redness', 'shine', 'texture', 'tone', 'acne'] as const;
const QUALITY_FLAGS = ['glare_confounded', 'shadow_confounded', 'filter_suspected', 'blurred'] as const;

const CLAMP_EPSILON = 0.0001;
const HEATMAP_GRID_W = 64;
const HEATMAP_GRID_H = 64;

const asPositiveInt = z.number().int().nonnegative();
const asNormNumber = z.number();
const asNonEmptyString = z.string().trim().min(1);

const pointSchema = z.object({
  x: asNormNumber,
  y: asNormNumber,
});

const bboxSchema = z.object({
  x: asNormNumber,
  y: asNormNumber,
  w: asNormNumber,
  h: asNormNumber,
});

const heatmapSchema = z.object({
  coord_space: z.literal(FACE_CROP_NORM_COORD_SPACE),
  grid: z.object({
    w: asPositiveInt,
    h: asPositiveInt,
  }),
  values: z.array(z.number()),
  value_range: z.object({
    min: z.number(),
    max: z.number(),
  }),
  smoothing_hint: z.enum(['bilinear', 'nearest']).optional(),
});

const regionStyleSchema = z.object({
  intensity: z.number(),
  priority: z.number(),
  label_hint: z.string().trim().min(1).max(64),
});

const regionSchema = z
  .object({
    region_id: asNonEmptyString,
    type: z.enum(['bbox', 'polygon', 'heatmap']),
    issue_type: z.enum(ISSUE_TYPES).optional(),
    coord_space: z.literal(FACE_CROP_NORM_COORD_SPACE),
    bbox: bboxSchema.optional(),
    polygon: z
      .object({
        points: z.array(pointSchema).min(3),
        closed: z.literal(true).optional(),
      })
      .optional(),
    heatmap: heatmapSchema.optional(),
    style: regionStyleSchema,
    quality_flags: z.array(z.enum(QUALITY_FLAGS)).optional(),
  })
  .passthrough();

const issueSchema = z
  .object({
    issue_type: z.enum(ISSUE_TYPES),
    severity_0_4: z.number(),
    confidence_0_1: z.number(),
    evidence_region_ids: z.array(asNonEmptyString).default([]),
    explanation_short: z.string().trim().min(1).max(220),
  })
  .passthrough();

const actionSchema = z
  .object({
    action_type: z.literal('ingredient'),
    ingredient_id: asNonEmptyString,
    ingredient_name: asNonEmptyString,
    why: z.string().trim().min(1).max(300),
    how_to_use: z
      .object({
        time: z.enum(['AM', 'PM', 'AM_PM']).default('AM_PM'),
        frequency: z.enum(['daily', '2-3x_week', 'weekly']).default('2-3x_week'),
        notes: z.string().trim().max(300).default(''),
      })
      .default({ time: 'AM_PM', frequency: '2-3x_week', notes: '' }),
    cautions: z.array(z.string().trim().min(1).max(200)).default([]),
    evidence_issue_types: z.array(z.enum(ISSUE_TYPES)).default([]),
    timeline: z.string().trim().max(200).optional(),
    do_not_mix: z.array(z.string().trim().min(1).max(140)).optional(),
  })
  .passthrough();

const moduleMaskRleSchema = z
  .object({
    grid: z
      .object({
        w: asPositiveInt,
        h: asPositiveInt,
      })
      .optional(),
    counts: z.union([z.array(asPositiveInt), z.string().trim().min(1)]).optional(),
    values: z.array(z.number()).optional(),
    starts_with: z.union([z.literal(0), z.literal(1)]).optional(),
  })
  .passthrough();

const productSchema = z
  .object({
    product_id: z.string().trim().optional(),
    merchant_id: z.string().trim().optional(),
    title: z.string().trim().optional(),
    name: z.string().trim().optional(),
    brand: z.string().trim().optional(),
    image_url: z.string().trim().optional(),
    why_match: z.string().trim().optional(),
    how_to_use: z.string().trim().optional(),
    price: z.number().optional(),
    currency: z.string().trim().optional(),
    price_tier: z.string().trim().optional(),
    source_block: z.string().trim().optional(),
    cautions: z.array(z.string().trim().min(1).max(180)).optional(),
  })
  .passthrough();

const moduleSchema = z
  .object({
    module_id: z.enum(MODULE_IDS),
    issues: z.array(issueSchema).default([]),
    actions: z.array(actionSchema).default([]),
    products: z.array(productSchema).optional(),
    mask_rle_norm: z.union([moduleMaskRleSchema, z.string().trim().min(1)]).optional(),
    mask_grid: z
      .union([
        asPositiveInt,
        z.object({
          w: asPositiveInt,
          h: asPositiveInt,
        }),
      ])
      .optional(),
    module_pixels: z.array(z.number()).optional(),
    box: bboxSchema.optional(),
    degraded_reason: z.string().trim().optional(),
    evidence_region_ids: z.array(asNonEmptyString).optional(),
  })
  .passthrough();

const faceCropSchema = z
  .object({
    crop_id: asNonEmptyString,
    coord_space: z.literal(ORIG_PX_COORD_SPACE),
    bbox_px: z.object({
      x: asPositiveInt,
      y: asPositiveInt,
      w: asPositiveInt,
      h: asPositiveInt,
    }),
    orig_size_px: z.object({
      w: asPositiveInt,
      h: asPositiveInt,
    }),
    render_size_px_hint: z.object({
      w: asPositiveInt,
      h: asPositiveInt,
    }),
    crop_image_url: z.string().trim().optional(),
    original_image_url: z.string().trim().optional(),
    image_url: z.string().trim().optional(),
    source_image_url: z.string().trim().optional(),
    face_crop_url: z.string().trim().optional(),
    src: z.string().trim().optional(),
  })
  .passthrough();

const photoModulesPayloadSchema = z
  .object({
    used_photos: z.boolean(),
    quality_grade: z.enum(['pass', 'degraded', 'fail']),
    photo_notice: z.string().trim().optional(),
    face_crop: faceCropSchema,
    regions: z.array(regionSchema),
    modules: z.array(moduleSchema),
    disclaimers: z
      .object({
        non_medical: z.boolean().optional(),
        seek_care_triggers: z.array(z.string().trim().min(1).max(180)).optional(),
      })
      .default({ non_medical: true, seek_care_triggers: [] }),
  })
  .passthrough();

type RawPayload = z.infer<typeof photoModulesPayloadSchema>;
type RawRegion = z.infer<typeof regionSchema>;
type RawIssue = z.infer<typeof issueSchema>;
type RawAction = z.infer<typeof actionSchema>;
type RawModule = z.infer<typeof moduleSchema>;
type RawProduct = z.infer<typeof productSchema>;

type SanitizerDropReason =
  | 'bbox_invalid'
  | 'bbox_empty'
  | 'polygon_invalid'
  | 'polygon_empty'
  | 'heatmap_grid_invalid'
  | 'heatmap_length_mismatch'
  | 'heatmap_invalid';

export type PhotoModulesSanitizerDrop = {
  reason: SanitizerDropReason;
  region_type: 'bbox' | 'polygon' | 'heatmap';
  region_id: string;
};

type Point = { x: number; y: number };
type Bbox = { x: number; y: number; w: number; h: number };

export type PhotoModulesRegion = {
  region_id: string;
  type: 'bbox' | 'polygon' | 'heatmap';
  issue_type: (typeof ISSUE_TYPES)[number] | null;
  coord_space: typeof FACE_CROP_NORM_COORD_SPACE;
  bbox?: Bbox;
  polygon?: { points: Point[]; closed: true };
  heatmap?: {
    coord_space: typeof FACE_CROP_NORM_COORD_SPACE;
    grid: { w: number; h: number };
    values: number[];
    value_range: { min: 0; max: 1 };
    smoothing_hint: 'bilinear' | 'nearest';
  };
  style: {
    intensity: number;
    priority: number;
    label_hint: string;
  };
  quality_flags: Array<(typeof QUALITY_FLAGS)[number]>;
  notes?: string[];
};

export type PhotoModulesIssue = {
  issue_type: (typeof ISSUE_TYPES)[number];
  severity_0_4: number;
  confidence_0_1: number;
  evidence_region_ids: string[];
  explanation_short: string;
};

export type PhotoModulesAction = {
  action_type: 'ingredient';
  ingredient_id: string;
  ingredient_name: string;
  why: string;
  how_to_use: {
    time: 'AM' | 'PM' | 'AM_PM';
    frequency: 'daily' | '2-3x_week' | 'weekly';
    notes: string;
  };
  cautions: string[];
  evidence_issue_types: Array<(typeof ISSUE_TYPES)[number]>;
  timeline: string;
  do_not_mix: string[];
  products: PhotoModulesProduct[];
  products_empty_reason: string | null;
  external_search_ctas: PhotoModulesExternalSearchCta[];
};

export type PhotoModulesProduct = {
  product_id: string;
  merchant_id: string;
  title: string;
  brand: string;
  image_url: string;
  why_match: string;
  how_to_use: string;
  price?: number;
  currency?: string;
  price_tier?: string;
  source_block?: string;
  cautions: string[];
  product_url: string;
  retrieval_source: string;
  retrieval_reason: string;
  suitability_score: number | null;
};

export type PhotoModulesExternalSearchCta = {
  title: string;
  url: string;
  source: string;
  reason: string;
};

export type PhotoModulesModule = {
  module_id: (typeof MODULE_IDS)[number];
  issues: PhotoModulesIssue[];
  actions: PhotoModulesAction[];
  products: PhotoModulesProduct[];
  mask_rle_norm?:
    | {
        grid?: { w: number; h: number } | null;
        counts?: number[] | string | null;
        values?: number[] | null;
        starts_with?: 0 | 1 | null;
      }
    | null;
  mask_grid?: { w: number; h: number } | null;
  module_pixels?: number[];
  box?: Bbox;
  degraded_reason?: string;
  evidence_region_ids?: string[];
};

export type PhotoModulesOverlayDebug = {
  module_box_mode: string;
  module_box_dynamic_applied: boolean;
  skinmask_reliable: boolean | null;
  degraded_reasons: string[];
};

export type PhotoModulesUiModelV1 = {
  used_photos: boolean;
  quality_grade: 'pass' | 'degraded' | 'fail';
  photo_notice: string;
  face_crop: {
    crop_id: string;
    coord_space: typeof ORIG_PX_COORD_SPACE;
    bbox_px: { x: number; y: number; w: number; h: number };
    orig_size_px: { w: number; h: number };
    render_size_px_hint: { w: number; h: number };
    crop_image_url: string | null;
    original_image_url: string | null;
    slot_id: string | null;
    photo_id: string | null;
  };
  regions: PhotoModulesRegion[];
  modules: PhotoModulesModule[];
  module_overlay_debug?: PhotoModulesOverlayDebug;
  disclaimers: {
    non_medical: boolean;
    seek_care_triggers: string[];
  };
};

export type NormalizePhotoModulesResult = {
  model: PhotoModulesUiModelV1 | null;
  errors: string[];
  sanitizer_drops: PhotoModulesSanitizerDrop[];
};

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
};

const clampSeverity = (value: number) => Math.max(0, Math.min(4, Math.round(Number.isFinite(value) ? value : 0)));
const clampConfidence = (value: number) => clamp01(value);

const normalizeLabelHint = (value: string): string => value.trim().slice(0, 64);

const toUniqueList = (values: Array<string | null | undefined>, max = 12): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const value = String(raw || '').trim();
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
    if (out.length >= max) break;
  }
  return out;
};

const bboxFromPoints = (points: Point[]): Bbox => {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return {
    x: clamp01(minX),
    y: clamp01(minY),
    w: clamp01(maxX - minX),
    h: clamp01(maxY - minY),
  };
};

const canonicalPolygonFromBbox = (bbox: Bbox): Point[] => [
  { x: bbox.x, y: bbox.y },
  { x: clamp01(bbox.x + bbox.w), y: bbox.y },
  { x: clamp01(bbox.x + bbox.w), y: clamp01(bbox.y + bbox.h) },
  { x: bbox.x, y: clamp01(bbox.y + bbox.h) },
];

const normalizeBbox = (bbox: Bbox): Bbox => {
  const x0 = clamp01(bbox.x);
  const y0 = clamp01(bbox.y);
  const x1 = clamp01(bbox.x + bbox.w);
  const y1 = clamp01(bbox.y + bbox.h);
  return {
    x: x0,
    y: y0,
    w: Math.max(0, x1 - x0),
    h: Math.max(0, y1 - y0),
  };
};

const pointsEqual = (a: Point, b: Point) => Math.abs(a.x - b.x) <= 1e-6 && Math.abs(a.y - b.y) <= 1e-6;

const normalizePolygonPoints = (points: Point[]): Point[] => {
  const out: Point[] = [];
  for (const raw of points) {
    const point = { x: clamp01(raw.x), y: clamp01(raw.y) };
    if (!out.length || !pointsEqual(out[out.length - 1], point)) out.push(point);
  }
  if (out.length >= 2 && pointsEqual(out[0], out[out.length - 1])) out.pop();
  return out;
};

const polygonAreaAbs = (points: Point[]): number => {
  if (points.length < 3) return 0;
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area) * 0.5;
};

const orientation = (a: Point, b: Point, c: Point): number => {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) <= 1e-9) return 0;
  return value > 0 ? 1 : 2;
};

const onSegment = (a: Point, b: Point, c: Point): boolean =>
  b.x <= Math.max(a.x, c.x) + 1e-9 &&
  b.x + 1e-9 >= Math.min(a.x, c.x) &&
  b.y <= Math.max(a.y, c.y) + 1e-9 &&
  b.y + 1e-9 >= Math.min(a.y, c.y);

const segmentsIntersect = (a1: Point, a2: Point, b1: Point, b2: Point): boolean => {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a1, b1, a2)) return true;
  if (o2 === 0 && onSegment(a1, b2, a2)) return true;
  if (o3 === 0 && onSegment(b1, a1, b2)) return true;
  if (o4 === 0 && onSegment(b1, a2, b2)) return true;
  return false;
};

const polygonSelfIntersects = (points: Point[]): boolean => {
  const length = points.length;
  if (length < 4) return false;
  for (let a = 0; a < length; a += 1) {
    const a1 = points[a];
    const a2 = points[(a + 1) % length];
    for (let b = a + 1; b < length; b += 1) {
      if (Math.abs(a - b) <= 1) continue;
      if (a === 0 && b === length - 1) continue;
      const b1 = points[b];
      const b2 = points[(b + 1) % length];
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
};

const firstNonEmpty = (...values: Array<string | undefined>): string | null => {
  for (const value of values) {
    const current = String(value || '').trim();
    if (current) return current;
  }
  return null;
};

const sanitizeBboxRegion = (region: RawRegion): { region: PhotoModulesRegion | null; drop?: PhotoModulesSanitizerDrop } => {
  if (!region.bbox) {
    return { region: null, drop: { reason: 'bbox_invalid', region_type: 'bbox', region_id: region.region_id } };
  }
  const bbox = normalizeBbox(region.bbox);
  if (bbox.w <= CLAMP_EPSILON || bbox.h <= CLAMP_EPSILON) {
    return { region: null, drop: { reason: 'bbox_empty', region_type: 'bbox', region_id: region.region_id } };
  }
  return {
    region: {
      region_id: region.region_id,
      type: 'bbox',
      issue_type: region.issue_type ?? null,
      coord_space: FACE_CROP_NORM_COORD_SPACE,
      bbox,
      style: {
        intensity: clamp01(region.style.intensity),
        priority: clamp01(region.style.priority),
        label_hint: normalizeLabelHint(region.style.label_hint),
      },
      quality_flags: Array.isArray(region.quality_flags) ? region.quality_flags : [],
    },
  };
};

const sanitizePolygonRegion = (region: RawRegion): { region: PhotoModulesRegion | null; drop?: PhotoModulesSanitizerDrop } => {
  if (!region.polygon || !Array.isArray(region.polygon.points)) {
    return { region: null, drop: { reason: 'polygon_invalid', region_type: 'polygon', region_id: region.region_id } };
  }
  let points = normalizePolygonPoints(region.polygon.points);
  if (points.length < 3 || polygonAreaAbs(points) <= CLAMP_EPSILON) {
    return { region: null, drop: { reason: 'polygon_empty', region_type: 'polygon', region_id: region.region_id } };
  }

  const notes: string[] = [];
  if (polygonSelfIntersects(points)) {
    const bbox = normalizeBbox(bboxFromPoints(points));
    if (bbox.w <= CLAMP_EPSILON || bbox.h <= CLAMP_EPSILON) {
      return { region: null, drop: { reason: 'polygon_empty', region_type: 'polygon', region_id: region.region_id } };
    }
    points = canonicalPolygonFromBbox(bbox);
    notes.push('self_intersection_replaced_with_bbox');
  }

  return {
    region: {
      region_id: region.region_id,
      type: 'polygon',
      issue_type: region.issue_type ?? null,
      coord_space: FACE_CROP_NORM_COORD_SPACE,
      polygon: { points, closed: true },
      style: {
        intensity: clamp01(region.style.intensity),
        priority: clamp01(region.style.priority),
        label_hint: normalizeLabelHint(region.style.label_hint),
      },
      quality_flags: Array.isArray(region.quality_flags) ? region.quality_flags : [],
      ...(notes.length ? { notes } : {}),
    },
  };
};

const sanitizeHeatmapRegion = (region: RawRegion): { region: PhotoModulesRegion | null; drop?: PhotoModulesSanitizerDrop } => {
  if (!region.heatmap) {
    return { region: null, drop: { reason: 'heatmap_invalid', region_type: 'heatmap', region_id: region.region_id } };
  }

  const { grid, values } = region.heatmap;
  if (grid.w !== HEATMAP_GRID_W || grid.h !== HEATMAP_GRID_H) {
    return { region: null, drop: { reason: 'heatmap_grid_invalid', region_type: 'heatmap', region_id: region.region_id } };
  }
  if (!Array.isArray(values) || values.length !== grid.w * grid.h) {
    return { region: null, drop: { reason: 'heatmap_length_mismatch', region_type: 'heatmap', region_id: region.region_id } };
  }

  const normalizedValues = values.map((value) => clamp01(Number.isFinite(value) ? value : 0));
  return {
    region: {
      region_id: region.region_id,
      type: 'heatmap',
      issue_type: region.issue_type ?? null,
      coord_space: FACE_CROP_NORM_COORD_SPACE,
      heatmap: {
        coord_space: FACE_CROP_NORM_COORD_SPACE,
        grid: { w: HEATMAP_GRID_W, h: HEATMAP_GRID_H },
        values: normalizedValues,
        value_range: { min: 0, max: 1 },
        smoothing_hint: region.heatmap.smoothing_hint ?? 'bilinear',
      },
      style: {
        intensity: clamp01(region.style.intensity),
        priority: clamp01(region.style.priority),
        label_hint: normalizeLabelHint(region.style.label_hint),
      },
      quality_flags: Array.isArray(region.quality_flags) ? region.quality_flags : [],
    },
  };
};

const sanitizeRegion = (region: RawRegion): { region: PhotoModulesRegion | null; drop?: PhotoModulesSanitizerDrop } => {
  if (region.type === 'bbox') return sanitizeBboxRegion(region);
  if (region.type === 'polygon') return sanitizePolygonRegion(region);
  return sanitizeHeatmapRegion(region);
};

const normalizeIssue = (issue: RawIssue, validRegionIds: Set<string>): PhotoModulesIssue => ({
  issue_type: issue.issue_type,
  severity_0_4: clampSeverity(issue.severity_0_4),
  confidence_0_1: clampConfidence(issue.confidence_0_1),
  evidence_region_ids: toUniqueList(issue.evidence_region_ids).filter((id) => validRegionIds.has(id)),
  explanation_short: issue.explanation_short.trim(),
});

const defaultTimeline = (action: RawAction): string => {
  const timeLabel =
    action.how_to_use.time === 'AM' ? 'AM' : action.how_to_use.time === 'PM' ? 'PM' : 'AM/PM';
  const frequencyLabel =
    action.how_to_use.frequency === 'daily'
      ? 'daily'
      : action.how_to_use.frequency === 'weekly'
        ? 'weekly'
        : '2-3x/week';
  return `${timeLabel}, ${frequencyLabel}`;
};

const defaultDoNotMix = (issueTypes: Array<(typeof ISSUE_TYPES)[number]>): string[] => {
  if (issueTypes.includes('redness')) return ['Avoid stacking strong acids and retinoids on the same night.'];
  if (issueTypes.includes('acne')) return ['Avoid combining multiple exfoliants in one routine.'];
  return ['Patch test before introducing new actives together.'];
};

const normalizeAction = (action: RawAction): PhotoModulesAction => ({
  action_type: 'ingredient',
  ingredient_id: action.ingredient_id,
  ingredient_name: action.ingredient_name,
  why: action.why,
  how_to_use: {
    time: action.how_to_use.time,
    frequency: action.how_to_use.frequency,
    notes: action.how_to_use.notes,
  },
  cautions: toUniqueList(action.cautions, 6),
  evidence_issue_types: action.evidence_issue_types,
  timeline: action.timeline?.trim() || defaultTimeline(action),
  do_not_mix: toUniqueList(action.do_not_mix ?? [], 6).length
    ? toUniqueList(action.do_not_mix ?? [], 6)
    : defaultDoNotMix(action.evidence_issue_types),
  products: (Array.isArray((action as any).products) ? (action as any).products : [])
    .map((product: RawProduct) => normalizeProduct(product))
    .filter((product: PhotoModulesProduct) => Boolean(product.title))
    .slice(0, 3),
  products_empty_reason: String((action as any).products_empty_reason || '').trim() || null,
  external_search_ctas: (Array.isArray((action as any).external_search_ctas) ? (action as any).external_search_ctas : [])
    .map((cta: any) => ({
      title: firstNonEmpty(cta?.title, cta?.name, cta?.query) || '',
      url: String(cta?.url || '').trim(),
      source: String(cta?.source || '').trim(),
      reason: String(cta?.reason || '').trim(),
    }))
    .filter((cta: PhotoModulesExternalSearchCta) => Boolean(cta.title || cta.url))
    .slice(0, 6),
});

const normalizeMaskGrid = (value: unknown): { w: number; h: number } | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const size = Math.max(1, Math.min(1024, Math.round(value)));
    return { w: size, h: size };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const w = Math.max(1, Math.min(1024, Math.round(Number((value as any).w || 0))));
  const h = Math.max(1, Math.min(1024, Math.round(Number((value as any).h || 0))));
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  return { w, h };
};

const normalizeMaskRleNorm = (
  value: unknown,
  fallbackGrid: { w: number; h: number } | null,
): PhotoModulesModule['mask_rle_norm'] => {
  if (value == null) return null;
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;
    return {
      grid: fallbackGrid,
      counts: text,
      values: null,
      starts_with: 0,
    };
  }
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as any;
  const grid = normalizeMaskGrid(raw.grid) || fallbackGrid;
  const counts =
    Array.isArray(raw.counts) && raw.counts.length
      ? raw.counts
          .map((n: unknown) => Math.max(0, Math.round(Number(n || 0))))
          .filter((n: number) => Number.isFinite(n))
      : typeof raw.counts === 'string' && raw.counts.trim()
        ? raw.counts.trim()
        : null;
  const values =
    Array.isArray(raw.values) && raw.values.length
      ? raw.values
          .map((n: unknown) => clamp01(Number.isFinite(Number(n)) ? Number(n) : 0))
          .slice(0, 1024 * 1024)
      : null;
  const startsWith = raw.starts_with === 1 ? 1 : 0;
  if (!grid && !counts && !values) return null;
  return {
    grid,
    counts,
    values,
    starts_with: startsWith,
  };
};

const normalizeProduct = (product: RawProduct): PhotoModulesProduct => ({
  product_id: String(product.product_id || '').trim(),
  merchant_id: String(product.merchant_id || '').trim(),
  title: firstNonEmpty(product.title, product.name) || 'Recommended product',
  brand: String(product.brand || '').trim(),
  image_url: String(product.image_url || '').trim(),
  why_match: String(product.why_match || '').trim(),
  how_to_use: String(product.how_to_use || '').trim(),
  ...(Number.isFinite(Number(product.price)) ? { price: Number(product.price) } : {}),
  ...(String(product.currency || '').trim() ? { currency: String(product.currency || '').trim() } : {}),
  ...(String(product.price_tier || '').trim() ? { price_tier: String(product.price_tier || '').trim() } : {}),
  ...(String(product.source_block || '').trim() ? { source_block: String(product.source_block || '').trim() } : {}),
  cautions: toUniqueList(product.cautions ?? [], 6),
  product_url: firstNonEmpty((product as any).pdp_url, (product as any).url, (product as any).product_url, (product as any).purchase_path) || '',
  retrieval_source: String((product as any).retrieval_source || '').trim(),
  retrieval_reason: String((product as any).retrieval_reason || '').trim(),
  suitability_score: Number.isFinite(Number((product as any).suitability_score))
    ? Number((product as any).suitability_score)
    : null,
});

const normalizeModule = (module: RawModule, validRegionIds: Set<string>): PhotoModulesModule => {
  const issues = module.issues.map((issue) => normalizeIssue(issue, validRegionIds));
  const flattenedIssueEvidence = toUniqueList(issues.flatMap((issue) => issue.evidence_region_ids));
  const moduleEvidenceRegionIds = toUniqueList(module.evidence_region_ids || flattenedIssueEvidence).filter((id) =>
    validRegionIds.has(id),
  );
  const maskGrid = normalizeMaskGrid(module.mask_grid);
  const normalizedMaskRle = normalizeMaskRleNorm(module.mask_rle_norm, maskGrid);

  return {
    module_id: module.module_id,
    issues,
    actions: module.actions.map((action) => normalizeAction(action)),
    products: (Array.isArray(module.products) ? module.products : []).map((product) => normalizeProduct(product)).slice(0, 3),
    ...(normalizedMaskRle ? { mask_rle_norm: normalizedMaskRle } : {}),
    ...(maskGrid ? { mask_grid: maskGrid } : {}),
    ...(Array.isArray(module.module_pixels)
      ? {
          module_pixels: module.module_pixels
            .map((n) => Math.round(Number(n)))
            .filter((n) => Number.isFinite(n) && n >= 0)
            .slice(0, 200000),
        }
      : {}),
    ...(module.box ? { box: normalizeBbox(module.box) } : {}),
    ...(String(module.degraded_reason || '').trim() ? { degraded_reason: String(module.degraded_reason).trim() } : {}),
    ...(moduleEvidenceRegionIds.length ? { evidence_region_ids: moduleEvidenceRegionIds } : {}),
  };
};

const normalizeFaceCrop = (payload: RawPayload) => {
  const faceCrop = payload.face_crop;
  const hintW = Math.max(64, Math.min(faceCrop.render_size_px_hint.w, 2048));
  const hintH = Math.max(64, Math.min(faceCrop.render_size_px_hint.h, 2048));

  const cropImageUrl = firstNonEmpty(
    faceCrop.crop_image_url,
    faceCrop.face_crop_url,
    faceCrop.image_url,
    faceCrop.src,
    String((payload as any).face_crop_url || '').trim() || undefined,
  );

  const originalImageUrl = firstNonEmpty(
    faceCrop.original_image_url,
    faceCrop.source_image_url,
    String((payload as any).original_image_url || '').trim() || undefined,
    String((payload as any).photo_url || '').trim() || undefined,
    String((payload as any).image_url || '').trim() || undefined,
  );

  const slotId = firstNonEmpty(
    faceCrop.slot_id,
    String((payload as any).slot_id || '').trim() || undefined,
  );

  const photoId = firstNonEmpty(
    faceCrop.photo_id,
    String((payload as any).photo_id || '').trim() || undefined,
  );

  return {
    crop_id: faceCrop.crop_id,
    coord_space: ORIG_PX_COORD_SPACE,
    bbox_px: {
      x: faceCrop.bbox_px.x,
      y: faceCrop.bbox_px.y,
      w: faceCrop.bbox_px.w,
      h: faceCrop.bbox_px.h,
    },
    orig_size_px: {
      w: faceCrop.orig_size_px.w,
      h: faceCrop.orig_size_px.h,
    },
    render_size_px_hint: {
      w: hintW,
      h: hintH,
    },
    crop_image_url: cropImageUrl,
    original_image_url: originalImageUrl,
    slot_id: slotId,
    photo_id: photoId,
  };
};

const normalizeModuleOverlayDebug = (payload: RawPayload): PhotoModulesOverlayDebug | null => {
  const rawPayload = payload as any;
  const overlayDebug =
    rawPayload?.module_overlay_debug &&
    typeof rawPayload.module_overlay_debug === 'object' &&
    !Array.isArray(rawPayload.module_overlay_debug)
      ? rawPayload.module_overlay_debug
      : null;
  const internalDebug =
    rawPayload?.internal_debug &&
    typeof rawPayload.internal_debug === 'object' &&
    !Array.isArray(rawPayload.internal_debug)
      ? rawPayload.internal_debug
      : null;

  const moduleBoxMode = firstNonEmpty(
    String(overlayDebug?.module_box_mode || '').trim() || undefined,
    String(internalDebug?.module_box_mode || '').trim() || undefined,
  );
  const moduleBoxDynamicAppliedRaw = overlayDebug?.module_box_dynamic_applied ?? internalDebug?.module_box_dynamic_applied;
  const skinmaskReliableRaw = overlayDebug?.skinmask_reliable ?? internalDebug?.skinmask_reliable;
  const degradedReasons = toUniqueList(
    [
      ...(Array.isArray(overlayDebug?.degraded_reasons) ? overlayDebug.degraded_reasons : []),
      ...(Array.isArray(internalDebug?.degraded_reasons) ? internalDebug.degraded_reasons : []),
    ],
    8,
  );

  const hasAny =
    Boolean(moduleBoxMode) ||
    typeof moduleBoxDynamicAppliedRaw === 'boolean' ||
    typeof skinmaskReliableRaw === 'boolean' ||
    degradedReasons.length > 0;
  if (!hasAny) return null;

  return {
    module_box_mode: moduleBoxMode || 'unknown',
    module_box_dynamic_applied: Boolean(moduleBoxDynamicAppliedRaw),
    skinmask_reliable: typeof skinmaskReliableRaw === 'boolean' ? skinmaskReliableRaw : null,
    degraded_reasons: degradedReasons,
  };
};

const formatIssuePath = (path: Array<string | number>): string => {
  if (!path.length) return 'root';
  return path.map((segment) => String(segment)).join('.');
};

export function normalizePhotoModulesUiModelV1(value: unknown): NormalizePhotoModulesResult {
  const parsed = photoModulesPayloadSchema.safeParse(value);
  if (!parsed.success) {
    return {
      model: null,
      errors: parsed.error.issues.map((issue) => `${formatIssuePath(issue.path)}:${issue.code}`),
      sanitizer_drops: [],
    };
  }

  const payload = parsed.data;
  const sanitizerDrops: PhotoModulesSanitizerDrop[] = [];
  const normalizedRegions: PhotoModulesRegion[] = [];

  for (const region of payload.regions) {
    const result = sanitizeRegion(region);
    if (result.region) normalizedRegions.push(result.region);
    if (result.drop) sanitizerDrops.push(result.drop);
  }

  const validRegionIds = new Set(normalizedRegions.map((region) => region.region_id));
  const modules = payload.modules.map((module) => normalizeModule(module, validRegionIds));
  const overlayDebug = normalizeModuleOverlayDebug(payload);

  const model: PhotoModulesUiModelV1 = {
    used_photos: payload.used_photos,
    quality_grade: payload.quality_grade,
    photo_notice: payload.photo_notice?.trim() || '',
    face_crop: normalizeFaceCrop(payload),
    regions: normalizedRegions,
    modules,
    ...(overlayDebug ? { module_overlay_debug: overlayDebug } : {}),
    disclaimers: {
      non_medical: payload.disclaimers.non_medical !== false,
      seek_care_triggers: toUniqueList(payload.disclaimers.seek_care_triggers ?? [], 8),
    },
  };

  return {
    model,
    errors: [],
    sanitizer_drops: sanitizerDrops,
  };
}

export function decodeRleBinaryMask(rle: string, expectedLength: number): Uint8Array {
  const chunks = String(rle || '')
    .split(',')
    .map((part) => Number(part))
    .filter((part) => Number.isFinite(part) && part >= 0);
  const length = Math.max(0, Number(expectedLength) || 0);
  const out = new Uint8Array(length);
  let value = 0;
  let offset = 0;
  for (const count of chunks) {
    const runLength = Math.trunc(count);
    if (runLength <= 0) {
      value = value ? 0 : 1;
      continue;
    }
    const end = Math.min(length, offset + runLength);
    if (value) out.fill(1, offset, end);
    offset = end;
    value = value ? 0 : 1;
    if (offset >= length) break;
  }
  return out;
}
