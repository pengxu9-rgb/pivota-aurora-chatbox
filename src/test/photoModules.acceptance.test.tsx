import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PhotoModulesCard } from '@/components/aurora/cards/PhotoModulesCard';
import { normalizePhotoModulesUiModelV1 } from '@/lib/photoModulesContract';

const HEATMAP_VALUES = Array.from({ length: 64 * 64 }, () => 0.35);

const buildValidPayload = () => ({
  used_photos: true,
  quality_grade: 'degraded',
  photo_notice: 'Photo modules acceptance fixture',
  face_crop: {
    crop_id: 'crop_acceptance',
    coord_space: 'orig_px_v1',
    bbox_px: { x: 48, y: 52, w: 240, h: 240 },
    orig_size_px: { w: 480, h: 480 },
    render_size_px_hint: { w: 320, h: 320 },
    crop_image_url: 'https://example.com/face-crop.png',
    original_image_url: 'https://example.com/original.png',
  },
  regions: [
    {
      region_id: 'reg_bbox_1',
      type: 'bbox',
      issue_type: 'redness',
      coord_space: 'face_crop_norm_v1',
      bbox: { x: 0.12, y: 0.2, w: 0.28, h: 0.22 },
      style: { intensity: 0.8, priority: 0.2, label_hint: 'redness' },
    },
    {
      region_id: 'reg_heat_1',
      type: 'heatmap',
      issue_type: 'shine',
      coord_space: 'face_crop_norm_v1',
      heatmap: {
        coord_space: 'face_crop_norm_v1',
        grid: { w: 64, h: 64 },
        values: HEATMAP_VALUES,
        value_range: { min: 0, max: 1 },
        smoothing_hint: 'bilinear',
      },
      style: { intensity: 0.7, priority: 0.4, label_hint: 'shine' },
    },
    {
      region_id: 'reg_bbox_2',
      type: 'bbox',
      issue_type: 'tone',
      coord_space: 'face_crop_norm_v1',
      bbox: { x: 0.58, y: 0.24, w: 0.26, h: 0.24 },
      style: { intensity: 0.6, priority: 0.6, label_hint: 'tone' },
    },
  ],
  modules: [
    {
      module_id: 'left_cheek',
      issues: [
        {
          issue_type: 'redness',
          severity_0_4: 3,
          confidence_0_1: 0.86,
          evidence_region_ids: ['reg_bbox_1'],
          explanation_short: 'Based on highlighted photo areas, redness is visible on left cheek.',
        },
        {
          issue_type: 'shine',
          severity_0_4: 2,
          confidence_0_1: 0.74,
          evidence_region_ids: ['reg_heat_1'],
          explanation_short: 'Based on highlighted photo areas, shine appears elevated in this module.',
        },
      ],
      actions: [
        {
          action_type: 'ingredient',
          ingredient_id: 'niacinamide',
          ingredient_name: 'Niacinamide',
          why: 'Supports tone and oil balance for highlighted regions.',
          how_to_use: { time: 'AM_PM', frequency: 'daily', notes: 'Start low and increase gradually.' },
          cautions: ['Patch test first'],
          evidence_issue_types: ['redness', 'shine'],
          timeline: 'AM/PM',
          do_not_mix: ['Strong acids in same routine'],
        },
      ],
      products: [],
    },
    {
      module_id: 'right_cheek',
      issues: [
        {
          issue_type: 'tone',
          severity_0_4: 2,
          confidence_0_1: 0.62,
          evidence_region_ids: ['reg_bbox_2'],
          explanation_short: 'Based on highlighted photo areas, tone unevenness is mild on right cheek.',
        },
      ],
      actions: [],
      products: [],
    },
  ],
  disclaimers: {
    non_medical: true,
    seek_care_triggers: ['If redness worsens, seek professional care.'],
  },
});

let originalResizeObserver: unknown;
let originalClientWidth: PropertyDescriptor | undefined;
let originalClientHeight: PropertyDescriptor | undefined;
let originalCanvasGetContext: ((contextId: string, options?: unknown) => unknown) | undefined;

beforeAll(() => {
  originalResizeObserver = (globalThis as any).ResizeObserver;
  originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
  originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
  originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;

  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return 320;
    },
  });

  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get() {
      return 320;
    },
  });

  class ResizeObserverMock {
    private callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe(target: Element) {
      this.callback(
        [
          {
            target,
            contentRect: {
              x: 0,
              y: 0,
              width: 320,
              height: 320,
              top: 0,
              right: 320,
              bottom: 320,
              left: 0,
              toJSON: () => ({}),
            },
          } as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver,
      );
    }

    unobserve() {}

    disconnect() {}
  }

  (globalThis as any).ResizeObserver = ResizeObserverMock;

  const fake2dContext = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    imageSmoothingEnabled: true,
    fillRect: () => {},
    strokeRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    fill: () => {},
    stroke: () => {},
    createImageData: (width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    }),
    putImageData: () => {},
    save: () => {},
    restore: () => {},
    drawImage: () => {},
    setTransform: () => {},
    clearRect: () => {},
  };

  HTMLCanvasElement.prototype.getContext = (() => fake2dContext) as typeof HTMLCanvasElement.prototype.getContext;
});

afterAll(() => {
  if (originalResizeObserver === undefined) {
    delete (globalThis as any).ResizeObserver;
  } else {
    (globalThis as any).ResizeObserver = originalResizeObserver;
  }

  if (originalClientWidth) {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
  }
  if (originalClientHeight) {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight);
  }
  if (originalCanvasGetContext) {
    HTMLCanvasElement.prototype.getContext = originalCanvasGetContext;
  }
});

describe('photo_modules_v1 acceptance', () => {
  it('renders base/highlight canvas and updates highlight scope by module and issue', () => {
    const normalized = normalizePhotoModulesUiModelV1(buildValidPayload());
    expect(normalized.errors).toHaveLength(0);
    expect(normalized.model).not.toBeNull();

    render(<PhotoModulesCard model={normalized.model!} language="EN" />);

    const baseCanvas = screen.getByTestId('photo-modules-base-canvas');
    const highlightCanvas = screen.getByTestId('photo-modules-highlight-canvas');
    expect(baseCanvas).toBeInTheDocument();
    expect(highlightCanvas).toBeInTheDocument();

    expect(baseCanvas).toHaveAttribute('data-focused', '0');
    expect(highlightCanvas).toHaveAttribute('data-highlight-count', '3');
    expect(screen.getByText('Left cheek · Noticeable')).toBeInTheDocument();
    expect(screen.queryByText(/S3/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('photo-modules-module-left_cheek'));
    expect(baseCanvas).toHaveAttribute('data-focused', '1');
    expect(highlightCanvas).toHaveAttribute('data-highlight-count', '2');

    fireEvent.click(screen.getByTestId('photo-modules-issue-shine'));
    expect(highlightCanvas).toHaveAttribute('data-highlight-count', '1');
    expect(highlightCanvas).toHaveAttribute('data-visible-count', '1');
  });

  it('keeps module summary/actions visible in no-image mode without big placeholder canvas', () => {
    const payload = buildValidPayload();
    delete (payload.face_crop as any).crop_image_url;
    delete (payload.face_crop as any).original_image_url;

    const normalized = normalizePhotoModulesUiModelV1(payload);
    expect(normalized.errors).toHaveLength(0);
    expect(normalized.model).not.toBeNull();

    render(<PhotoModulesCard model={normalized.model!} language="EN" />);

    expect(
      screen.getByText('No renderable photo is available right now. Module findings and actions are shown below.'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('photo-modules-base-canvas')).not.toBeInTheDocument();
    expect(screen.queryByTestId('photo-modules-highlight-canvas')).not.toBeInTheDocument();
    expect(screen.getByTestId('photo-modules-module-left_cheek')).toBeInTheDocument();
    expect(screen.getByText('Ingredient actions')).toBeInTheDocument();
  });

  it('returns model=null on schema-fail payload and allows safe downgrade path', () => {
    const normalized = normalizePhotoModulesUiModelV1({
      used_photos: true,
      quality_grade: 'degraded',
      regions: [],
      modules: [],
      disclaimers: {},
    });

    expect(normalized.model).toBeNull();
    expect(normalized.errors.length).toBeGreaterThan(0);
  });
});
