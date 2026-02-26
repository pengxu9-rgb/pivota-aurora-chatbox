import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PhotoModulesCard } from '@/components/aurora/cards/PhotoModulesCard';
import { normalizePhotoModulesUiModelV1 } from '@/lib/photoModulesContract';

const HEATMAP_VALUES = Array.from({ length: 64 * 64 }, () => 0.2);

const buildPayload = (withMask: boolean, skinmaskReliable: boolean | null = true) => ({
  used_photos: true,
  quality_grade: 'pass',
  photo_notice: '',
  face_crop: {
    crop_id: 'crop_mask_priority',
    coord_space: 'orig_px_v1',
    bbox_px: { x: 40, y: 40, w: 240, h: 240 },
    orig_size_px: { w: 480, h: 480 },
    render_size_px_hint: { w: 320, h: 320 },
    crop_image_url: 'https://example.com/crop.png',
    original_image_url: 'https://example.com/original.png',
  },
  regions: [
    {
      region_id: 'bbox_1',
      type: 'bbox',
      issue_type: 'redness',
      coord_space: 'face_crop_norm_v1',
      bbox: { x: 0.2, y: 0.2, w: 0.4, h: 0.3 },
      style: { intensity: 0.8, priority: 0.2, label_hint: 'redness' },
    },
    {
      region_id: 'hm_1',
      type: 'heatmap',
      issue_type: 'shine',
      coord_space: 'face_crop_norm_v1',
      heatmap: {
        coord_space: 'face_crop_norm_v1',
        grid: { w: 64, h: 64 },
        values: HEATMAP_VALUES,
        value_range: { min: 0, max: 1 },
      },
      style: { intensity: 0.7, priority: 0.4, label_hint: 'shine' },
    },
    {
      region_id: 'bbox_2',
      type: 'bbox',
      issue_type: 'tone',
      coord_space: 'face_crop_norm_v1',
      bbox: { x: 0.62, y: 0.18, w: 0.25, h: 0.22 },
      style: { intensity: 0.6, priority: 0.3, label_hint: 'tone' },
    },
  ],
  modules: [
    {
      module_id: 'left_cheek',
      issues: [
        {
          issue_type: 'redness',
          severity_0_4: 3,
          confidence_0_1: 0.9,
          evidence_region_ids: ['bbox_1'],
          explanation_short: 'Mild redness',
        },
        {
          issue_type: 'shine',
          severity_0_4: 2,
          confidence_0_1: 0.7,
          evidence_region_ids: ['hm_1'],
          explanation_short: 'Mild shine',
        },
      ],
      actions: [],
      products: [],
      ...(withMask
        ? {
            mask_grid: { w: 8, h: 8 },
            mask_rle_norm: {
              grid: { w: 8, h: 8 },
              values: Array.from({ length: 64 }, (_, idx) => (idx % 2 === 0 ? 1 : 0)),
            },
          }
        : {}),
    },
  ],
  ...(withMask
    ? {
        module_overlay_debug: {
          module_box_mode: 'dynamic_skinmask',
          module_box_dynamic_applied: true,
          skinmask_reliable: skinmaskReliable,
          degraded_reasons: skinmaskReliable === false ? ['SKINMASK_UNRELIABLE'] : [],
        },
      }
    : {}),
  disclaimers: { non_medical: true, seek_care_triggers: [] },
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
  if (originalResizeObserver === undefined) delete (globalThis as any).ResizeObserver;
  else (globalThis as any).ResizeObserver = originalResizeObserver;

  if (originalClientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
  if (originalClientHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight);
  if (originalCanvasGetContext) HTMLCanvasElement.prototype.getContext = originalCanvasGetContext;
});

describe('photo modules mask overlay priority', () => {
  it('uses module mask as highlight when mask is available', () => {
    const normalized = normalizePhotoModulesUiModelV1(buildPayload(true));
    expect(normalized.model).not.toBeNull();

    render(<PhotoModulesCard model={normalized.model!} language="EN" />);
    fireEvent.click(screen.getByTestId('photo-modules-module-left_cheek'));

    const highlightCanvas = screen.getByTestId('photo-modules-highlight-canvas');
    expect(highlightCanvas).toHaveAttribute('data-highlight-mode', 'mask');
    expect(highlightCanvas).toHaveAttribute('data-highlight-count', '1');
  });

  it('prioritizes issue evidence overlay over module mask after issue selection', () => {
    const normalized = normalizePhotoModulesUiModelV1(buildPayload(true));
    expect(normalized.model).not.toBeNull();

    render(<PhotoModulesCard model={normalized.model!} language="EN" />);
    fireEvent.click(screen.getByTestId('photo-modules-module-left_cheek'));

    const highlightCanvas = screen.getByTestId('photo-modules-highlight-canvas');
    expect(highlightCanvas).toHaveAttribute('data-highlight-mode', 'mask');

    fireEvent.click(screen.getByTestId('photo-modules-issue-shine'));
    expect(highlightCanvas).toHaveAttribute('data-highlight-mode', 'region');
    expect(highlightCanvas).toHaveAttribute('data-highlight-count', '1');
  });

  it('falls back to region highlight when mask is missing', () => {
    const normalized = normalizePhotoModulesUiModelV1(buildPayload(false));
    expect(normalized.model).not.toBeNull();

    render(<PhotoModulesCard model={normalized.model!} language="EN" />);
    fireEvent.click(screen.getByTestId('photo-modules-module-left_cheek'));

    const highlightCanvas = screen.getByTestId('photo-modules-highlight-canvas');
    expect(highlightCanvas).toHaveAttribute('data-highlight-mode', 'region');
  });

  it('falls back to region highlight when skinmask is marked unreliable', () => {
    const normalized = normalizePhotoModulesUiModelV1(buildPayload(true, false));
    expect(normalized.model).not.toBeNull();

    render(<PhotoModulesCard model={normalized.model!} language="EN" />);
    fireEvent.click(screen.getByTestId('photo-modules-module-left_cheek'));

    const highlightCanvas = screen.getByTestId('photo-modules-highlight-canvas');
    expect(highlightCanvas).toHaveAttribute('data-highlight-mode', 'region');
  });
});
