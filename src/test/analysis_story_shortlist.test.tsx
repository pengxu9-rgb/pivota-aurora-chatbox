import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AnalysisStoryCard } from '@/components/aurora/cards/AnalysisStoryCard';

describe('analysis_story_v2 shortlist', () => {
  it('renders up to two shortlist items and opens similar products callback', () => {
    const onAction = vi.fn();
    const onOpenSimilarProducts = vi.fn();
    const shortlist = [
      { product_id: 'p1', brand: 'Brand A', name: 'Serum A', price_label: '$19' },
      { product_id: 'p2', brand: 'Brand B', name: 'Serum B', price_label: '$25' },
      { product_id: 'p3', brand: 'Brand C', name: 'Serum C', price_label: '$30' },
    ];

    render(
      <AnalysisStoryCard
        language="EN"
        payload={{}}
        onAction={onAction}
        recoShortlist={shortlist}
        onOpenSimilarProducts={onOpenSimilarProducts}
      />,
    );

    expect(screen.getByText('Brand A · Serum A')).toBeInTheDocument();
    expect(screen.getByText('Brand B · Serum B')).toBeInTheDocument();
    expect(screen.queryByText('Brand C · Serum C')).not.toBeInTheDocument();

    const similarButtons = screen.getAllByRole('button', { name: 'Similar products' });
    fireEvent.click(similarButtons[0]);
    expect(onOpenSimilarProducts).toHaveBeenCalledWith(shortlist[0]);

    fireEvent.click(screen.getByRole('button', { name: 'See product recommendations' }));
    expect(onAction).toHaveBeenCalledWith(
      'analysis_get_recommendations',
      expect.objectContaining({ trigger_source: 'analysis_story_v2' }),
    );
  });

  it('shows empty shortlist state while keeping recommendation CTA', () => {
    render(
      <AnalysisStoryCard
        language="EN"
        payload={{}}
      />,
    );

    expect(screen.getByText('No shortlist yet. Tap below to generate recommendations.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'See product recommendations' })).toBeInTheDocument();
  });
});
