import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CardRenderBoundary } from '@/components/chat/CardRenderBoundary';

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
});
