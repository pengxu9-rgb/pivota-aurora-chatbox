import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/use-toast', () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: vi.fn() }),
}));

import type { Card } from '@/lib/pivotaAgentBff';
import { RecommendationsCard } from '@/pages/BffChat';
import { toast } from '@/components/ui/use-toast';

const buildRecoCard = (args: { brand?: string; name?: string; url?: string | null }): Card => ({
  card_id: 'reco_card_1',
  type: 'recommendations',
  payload: {
    recommendations: [
      {
        step: 'treatment',
        sku: {
          brand: args.brand ?? 'The Ordinary',
          display_name: args.name ?? 'Niacinamide 10% + Zinc 1%',
          sku_id: 'sku_test_1',
          url: args.url ?? null,
        },
      },
    ],
  },
});

describe('RecommendationsCard View details', () => {
  it('routes to Aurora product deep scan (no shop drawer)', () => {
    const onDeepScanProduct = vi.fn();
    const onOpenPdp = vi.fn();
    const resolveOffers = vi.fn();
    const resolveProductRef = vi.fn();

    const card = buildRecoCard({ url: 'https://example.com/product/123' });
    render(
      <RecommendationsCard
        card={card}
        language="EN"
        debug={false}
        onDeepScanProduct={onDeepScanProduct}
        onOpenPdp={onOpenPdp}
        resolveOffers={resolveOffers}
        resolveProductRef={resolveProductRef}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    expect(onDeepScanProduct).toHaveBeenCalledTimes(1);
    expect(onDeepScanProduct).toHaveBeenCalledWith('https://example.com/product/123');
    expect(onOpenPdp).not.toHaveBeenCalled();
    expect(resolveOffers).not.toHaveBeenCalled();
    expect(resolveProductRef).not.toHaveBeenCalled();
  });

  it('ignores opaque UUID-like names when building deep scan input', () => {
    const onDeepScanProduct = vi.fn();
    const card = buildRecoCard({
      brand: 'The Ordinary',
      name: 'e7c90e06 8673 4c97 835d 074a26ab2162',
      url: null,
    });

    render(<RecommendationsCard card={card} language="EN" debug={false} onDeepScanProduct={onDeepScanProduct} />);
    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    expect(onDeepScanProduct).toHaveBeenCalledWith('The Ordinary');
  });

  it('does not fall back into shop/PDP flows when deep scan input is missing', () => {
    const onDeepScanProduct = vi.fn();
    const onOpenPdp = vi.fn();
    const resolveOffers = vi.fn();
    const resolveProductRef = vi.fn();

    const card = buildRecoCard({
      brand: 'kb:opaque_brand',
      name: 'e7c90e06 8673 4c97 835d 074a26ab2162',
      url: null,
    });

    render(
      <RecommendationsCard
        card={card}
        language="EN"
        debug={false}
        onDeepScanProduct={onDeepScanProduct}
        onOpenPdp={onOpenPdp}
        resolveOffers={resolveOffers}
        resolveProductRef={resolveProductRef}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    expect(onDeepScanProduct).not.toHaveBeenCalled();
    expect(onOpenPdp).not.toHaveBeenCalled();
    expect(resolveOffers).not.toHaveBeenCalled();
    expect(resolveProductRef).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledTimes(1);
  });
});
