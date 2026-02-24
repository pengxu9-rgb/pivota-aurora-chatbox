import { describe, expect, it } from 'vitest';

import { normalizePhotoModulesUiModelV1 } from '@/lib/photoModulesContract';

const makeHeatmapValues = (value = 0.5) => Array.from({ length: 64 * 64 }, () => value);

const makeBasePayload = () => ({
  used_photos: true,
  quality_grade: 'pass',
  photo_notice: 'ok',
  face_crop: {
    crop_id: 'crop_1',
    coord_space: 'orig_px_v1',
    bbox_px: { x: 20, y: 40, w: 300, h: 300 },
    orig_size_px: { w: 1080, h: 1920 },
    render_size_px_hint: { w: 512, h: 512 },
    crop_image_url: 'https://example.com/crop.jpg',
    original_image_url: 'https://example.com/original.jpg',
  },
  regions: [
    {
      region_id: 'bbox_1',
      type: 'bbox',
      issue_type: 'redness',
      coord_space: 'face_crop_norm_v1',
      bbox: { x: -0.1, y: 0.2, w: 1.3, h: 0.9 },
      style: { intensity: 1.2, priority: -0.2, label_hint: 'redness' },
    },
    {
      region_id: 'poly_1',
      type: 'polygon',
      issue_type: 'texture',
      coord_space: 'face_crop_norm_v1',
      polygon: {
        points: [
          { x: 0.2, y: 0.2 },
          { x: 0.8, y: 0.2 },
          { x: 0.2, y: 0.8 },
          { x: 0.8, y: 0.8 },
        ],
      },
      style: { intensity: 0.8, priority: 0.7, label_hint: 'texture' },
    },
    {
      region_id: 'hm_1',
      type: 'heatmap',
      issue_type: 'shine',
      coord_space: 'face_crop_norm_v1',
      heatmap: {
        coord_space: 'face_crop_norm_v1',
        grid: { w: 64, h: 64 },
        values: makeHeatmapValues(1.4),
        value_range: { min: 0, max: 1 },
        smoothing_hint: 'bilinear',
      },
      style: { intensity: 0.9, priority: 0.9, label_hint: 'shine' },
    },
  ],
  modules: [
    {
      module_id: 'left_cheek',
      issues: [
        {
          issue_type: 'redness',
          severity_0_4: 4.4,
          confidence_0_1: 1.7,
          evidence_region_ids: ['bbox_1', 'missing_region'],
          explanation_short: 'Based on highlighted redness area.',
        },
      ],
      actions: [
        {
          action_type: 'ingredient',
          ingredient_id: 'niacinamide',
          ingredient_name: 'Niacinamide',
          why: 'Supports redness balance in highlighted areas.',
          how_to_use: { time: 'AM_PM', frequency: '2-3x_week', notes: '' },
          cautions: ['Patch test first'],
          evidence_issue_types: ['redness'],
        },
      ],
      products: [
        {
          product_id: 'prod_1',
          merchant_id: 'merchant_1',
          name: 'Niacinamide Serum 10%',
          brand: 'Brand A',
          price: 18.5,
          currency: 'USD',
          price_tier: 'low',
          source_block: 'dupe',
          why_match: 'Budget-friendly niacinamide option.',
        },
      ],
    },
  ],
  disclaimers: {
    non_medical: true,
    seek_care_triggers: ['If persistent irritation occurs, seek professional care.'],
  },
});

describe('photo modules contract', () => {
  it('clamps normalized geometry and value ranges', () => {
    const result = normalizePhotoModulesUiModelV1(makeBasePayload());

    expect(result.errors).toHaveLength(0);
    expect(result.model).not.toBeNull();

    const model = result.model!;
    const bbox = model.regions.find((region) => region.region_id === 'bbox_1')?.bbox;
    expect(bbox).toBeTruthy();
    expect(bbox?.x).toBeGreaterThanOrEqual(0);
    expect(bbox?.y).toBeGreaterThanOrEqual(0);
    expect(bbox?.x).toBeLessThanOrEqual(1);
    expect(bbox?.y).toBeLessThanOrEqual(1);
    expect((bbox?.x ?? 0) + (bbox?.w ?? 0)).toBeLessThanOrEqual(1);
    expect((bbox?.y ?? 0) + (bbox?.h ?? 0)).toBeLessThanOrEqual(1);

    const heatmap = model.regions.find((region) => region.region_id === 'hm_1')?.heatmap;
    expect(heatmap?.values).toHaveLength(64 * 64);
    expect(Math.min(...(heatmap?.values ?? []))).toBeGreaterThanOrEqual(0);
    expect(Math.max(...(heatmap?.values ?? []))).toBeLessThanOrEqual(1);

    const issue = model.modules[0]?.issues[0];
    expect(issue?.evidence_region_ids).toEqual(['bbox_1']);
    const product = model.modules[0]?.products?.[0];
    expect(product?.price).toBe(18.5);
    expect(product?.currency).toBe('USD');
    expect(product?.price_tier).toBe('low');
    expect(product?.source_block).toBe('dupe');
  });

  it('drops invalid heatmap shape and records sanitizer reason', () => {
    const payload = makeBasePayload();
    payload.regions[2] = {
      ...payload.regions[2],
      heatmap: {
        coord_space: 'face_crop_norm_v1',
        grid: { w: 64, h: 64 },
        values: [0.2, 0.3],
        value_range: { min: 0, max: 1 },
      },
    } as any;

    const result = normalizePhotoModulesUiModelV1(payload);
    expect(result.errors).toHaveLength(0);
    expect(result.model).not.toBeNull();
    expect(result.model?.regions.find((region) => region.region_id === 'hm_1')).toBeUndefined();
    expect(result.sanitizer_drops.some((drop) => drop.reason === 'heatmap_length_mismatch')).toBe(true);
  });

  it('returns schema errors when payload is invalid', () => {
    const result = normalizePhotoModulesUiModelV1({
      used_photos: true,
      quality_grade: 'pass',
      regions: [],
    });
    expect(result.model).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
