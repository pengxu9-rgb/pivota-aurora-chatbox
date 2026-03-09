import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CardRenderBoundary } from '@/components/chat/CardRenderBoundary';
import { analytics } from '@/lib/analytics';

const ThrowingCard = () => {
  throw new Error('render boom');
};

describe('CardRenderBoundary', () => {
  it('downgrades only the failed card and keeps sibling content visible', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <div>
          <CardRenderBoundary language="EN" cardType="photo_modules_v1" cardId="card_1">
            <ThrowingCard />
          </CardRenderBoundary>
          <div data-testid="healthy-card">healthy card</div>
        </div>,
      );

      expect(
        screen.getByText('This card failed to render and was safely downgraded. Other results remain available.'),
      ).toBeInTheDocument();
      expect(screen.getByTestId('healthy-card')).toBeInTheDocument();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('emits a telemetry event when analytics context is available', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const analyticsSpy = vi.spyOn(analytics, 'emit').mockImplementation(() => {});
    try {
      render(
        <CardRenderBoundary
          language="EN"
          cardType="product_analysis"
          cardId="card_analysis_1"
          analyticsCtx={{
            brief_id: 'brief_test_1',
            trace_id: 'trace_test_1',
            aurora_uid: 'aurora_test_1',
            lang: 'en',
            state: 'PRODUCT_LINK_EVAL',
          }}
        >
          <ThrowingCard />
        </CardRenderBoundary>,
      );

      expect(analyticsSpy).toHaveBeenCalledWith(
        'ui_card_render_failed',
        'brief_test_1',
        'trace_test_1',
        expect.objectContaining({
          aurora_uid: 'aurora_test_1',
          lang: 'en',
          state: 'PRODUCT_LINK_EVAL',
          card_type: 'product_analysis',
          card_id: 'card_analysis_1',
          error_name: 'Error',
          error_message: 'render boom',
        }),
      );
    } finally {
      analytics.clear();
      analyticsSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
