import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/use-toast', () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: vi.fn() }),
}));

import type { Card } from '@/lib/pivotaAgentBff';
import { RecommendationsCard } from '@/pages/BffChat';
import { buildGoogleSearchFallbackUrl } from '@/lib/externalSearchFallback';

const buildRecoCard = (args: {
  brand?: string;
  name?: string;
  skuId?: string | null;
  productId?: string | null;
}): Card => ({
  card_id: 'reco_card_1',
  type: 'recommendations',
  payload: {
    recommendations: [
      {
        step: 'treatment',
        sku: {
          brand: args.brand ?? 'The Ordinary',
          display_name: args.name ?? 'Niacinamide 10% + Zinc 1%',
          ...(args.skuId != null ? { sku_id: args.skuId } : {}),
          ...(args.productId != null ? { product_id: args.productId } : {}),
        },
      },
    ],
  },
});

describe('RecommendationsCard View details routing', () => {
  it('prefers canonical product_ref id over opaque sku.product_id', async () => {
    const onOpenPdp = vi.fn();
    const resolveOffers = vi.fn();
    const resolveProductRef = vi.fn();

    const card: Card = {
      card_id: 'reco_card_canonical_priority',
      type: 'recommendations',
      payload: {
        recommendations: [
          {
            step: 'treatment',
            sku: {
              brand: 'The Ordinary',
              display_name: 'Niacinamide 10% + Zinc 1%',
              product_id: 'c231aaaa-8b00-4145-a704-684931049303',
            },
            product_ref: {
              canonical_product_ref: {
                product_id: '9886499864904',
                merchant_id: 'merch_efbc46b4619cfbdf',
              },
            },
          },
        ],
      },
    };

    render(
      <RecommendationsCard
        card={card}
        language="EN"
        debug={false}
        onOpenPdp={onOpenPdp}
        resolveOffers={resolveOffers}
        resolveProductRef={resolveProductRef}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    await waitFor(() => {
      expect(onOpenPdp).toHaveBeenCalledTimes(1);
    });
    expect(onOpenPdp.mock.calls[0][0].url).toContain('/products/9886499864904');
    expect(onOpenPdp.mock.calls[0][0].url).toContain('merchant_id=merch_efbc46b4619cfbdf');
    expect(resolveOffers).not.toHaveBeenCalled();
    expect(resolveProductRef).not.toHaveBeenCalled();
  });

  it('opens PDP from offers.resolve target and does not deep-scan', async () => {
    const onDeepScanProduct = vi.fn();
    const onOpenPdp = vi.fn();
    const resolveOffers = vi.fn().mockResolvedValue({
      status: 'success',
      mapping: {
        candidates: [{ product_ref: { product_id: 'prod_123', merchant_id: 'merch_abc' } }],
      },
    });
    const resolveProductRef = vi.fn();

    const card = buildRecoCard({ skuId: 'sku_test_1' });
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

    await waitFor(() => {
      expect(onOpenPdp).toHaveBeenCalledTimes(1);
    });
    expect(onOpenPdp.mock.calls[0][0].url).toContain('/products/prod_123');
    expect(resolveOffers).toHaveBeenCalledTimes(1);
    expect(resolveProductRef).not.toHaveBeenCalled();
    expect(onDeepScanProduct).not.toHaveBeenCalled();
  });

  it('opens PDP directly for product-backed item and skips resolver network calls', async () => {
    const onOpenPdp = vi.fn();
    const resolveOffers = vi.fn();
    const resolveProductRef = vi.fn();

    const card = buildRecoCard({
      brand: 'The Ordinary',
      name: 'Niacinamide 10% + Zinc 1%',
      skuId: 'sku_known',
      productId: 'prod_known',
    });
    render(
      <RecommendationsCard
        card={card}
        language="EN"
        debug={false}
        onOpenPdp={onOpenPdp}
        resolveOffers={resolveOffers}
        resolveProductRef={resolveProductRef}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    await waitFor(() => {
      expect(onOpenPdp).toHaveBeenCalledTimes(1);
    });
    expect(onOpenPdp.mock.calls[0][0].url).toContain('/products/prod_known');
    expect(resolveOffers).not.toHaveBeenCalled();
    expect(resolveProductRef).not.toHaveBeenCalled();
  });

  it('resolves opaque UUID product_id before opening PDP', async () => {
    const onOpenPdp = vi.fn();
    const resolveOffers = vi.fn();
    const resolveProductRef = vi.fn().mockResolvedValue({
      resolved: true,
      product_ref: { product_id: '9886499864904', merchant_id: 'merch_efbc46b4619cfbdf' },
    });

    const card = buildRecoCard({
      brand: 'The Ordinary',
      name: 'Niacinamide 10% + Zinc 1%',
      skuId: null,
      productId: 'c231aaaa-8b00-4145-a704-684931049303',
    });
    render(
      <RecommendationsCard
        card={card}
        language="EN"
        debug={false}
        onOpenPdp={onOpenPdp}
        resolveOffers={resolveOffers}
        resolveProductRef={resolveProductRef}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    await waitFor(() => {
      expect(onOpenPdp).toHaveBeenCalledTimes(1);
    });
    expect(resolveProductRef).toHaveBeenCalledTimes(1);
    expect(resolveOffers).not.toHaveBeenCalled();
    expect(onOpenPdp.mock.calls[0][0].url).toContain('/products/9886499864904');
    expect(onOpenPdp.mock.calls[0][0].url).toContain('merchant_id=merch_efbc46b4619cfbdf');
  });

  it('falls back to Google tab for sku-only item when resolver returns no candidates', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const resolveOffers = vi.fn().mockResolvedValue({
      status: 'success',
      offers: [],
      mapping: { candidates: [] },
    });
    const resolveProductRef = vi.fn().mockResolvedValue({
      resolved: false,
      reason: 'no_candidates',
      candidates: [],
    });

    const card = buildRecoCard({
      brand: 'IPSA',
      name: 'Time Reset Aqua',
      skuId: 'sku_unknown',
      productId: null,
    });
    render(
      <RecommendationsCard
        card={card}
        language="EN"
        debug={false}
        resolveOffers={resolveOffers}
        resolveProductRef={resolveProductRef}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    await waitFor(() => {
      expect(resolveOffers).toHaveBeenCalledTimes(1);
    });
    expect(resolveProductRef).not.toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledWith(
      buildGoogleSearchFallbackUrl('IPSA Time Reset Aqua', 'EN'),
      '_blank',
      'noopener,noreferrer',
    );
    openSpy.mockRestore();
  });

  it('resolves opaque UUID sku_id after empty offers.resolve', async () => {
    const onOpenPdp = vi.fn();
    const resolveOffers = vi.fn().mockResolvedValue({
      status: 'success',
      input: { product_id: null, sku_id: 'c231aaaa-8b00-4145-a704-684931049303' },
      offers: [],
      offers_count: 0,
      mapping: { candidates: [] },
      metadata: { source: 'offers.resolve', has_external: false, has_internal: false },
    });
    const resolveProductRef = vi.fn().mockResolvedValue({
      resolved: true,
      product_ref: { product_id: '9886499864904', merchant_id: 'merch_efbc46b4619cfbdf' },
    });

    const card = buildRecoCard({
      brand: 'The Ordinary',
      name: 'Niacinamide 10% + Zinc 1%',
      skuId: 'c231aaaa-8b00-4145-a704-684931049303',
      productId: null,
    });

    render(
      <RecommendationsCard
        card={card}
        language="EN"
        debug={false}
        onOpenPdp={onOpenPdp}
        resolveOffers={resolveOffers}
        resolveProductRef={resolveProductRef}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    await waitFor(() => {
      expect(onOpenPdp).toHaveBeenCalledTimes(1);
    });
    expect(resolveOffers).toHaveBeenCalledTimes(1);
    expect(resolveProductRef).toHaveBeenCalledTimes(1);
    expect(onOpenPdp.mock.calls[0][0].url).toContain('/products/9886499864904');
    expect(onOpenPdp.mock.calls[0][0].url).toContain('merchant_id=merch_efbc46b4619cfbdf');
  });

  it('does not open opaque resolved ids and falls back to Google', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const onOpenPdp = vi.fn();
    const resolveOffers = vi.fn().mockResolvedValue({
      status: 'success',
      input: { product_id: null, sku_id: 'c231aaaa-8b00-4145-a704-684931049303' },
      offers: [],
      offers_count: 0,
      mapping: { candidates: [] },
      metadata: { source: 'offers.resolve', has_external: false, has_internal: false },
    });
    const resolveProductRef = vi.fn().mockResolvedValue({
      resolved: false,
      product_id: 'c231aaaa-8b00-4145-a704-684931049303',
      merchant_id: 'merch_efbc46b4619cfbdf',
      product_ref: null,
      candidates: [],
    });

    const card = buildRecoCard({
      brand: 'The Ordinary',
      name: 'Niacinamide 10% + Zinc 1%',
      skuId: 'c231aaaa-8b00-4145-a704-684931049303',
      productId: null,
    });

    render(
      <RecommendationsCard
        card={card}
        language="EN"
        debug={false}
        onOpenPdp={onOpenPdp}
        resolveOffers={resolveOffers}
        resolveProductRef={resolveProductRef}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    await waitFor(() => {
      expect(resolveOffers).toHaveBeenCalledTimes(1);
    });
    expect(resolveProductRef).toHaveBeenCalledTimes(1);
    expect(onOpenPdp).not.toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledWith(
      buildGoogleSearchFallbackUrl('The Ordinary Niacinamide 10% + Zinc 1%', 'EN'),
      '_blank',
      'noopener,noreferrer',
    );
    openSpy.mockRestore();
  });

  it('uses products.resolve only for name-only item', async () => {
    const onOpenPdp = vi.fn();
    const resolveOffers = vi.fn();
    const resolveProductRef = vi.fn().mockResolvedValue({
      resolved: true,
      product_ref: { product_id: 'prod_by_query', merchant_id: 'merch_q' },
    });

    const card = buildRecoCard({
      brand: 'The Ordinary',
      name: 'Niacinamide 10% + Zinc 1%',
      skuId: null,
      productId: null,
    });
    render(
      <RecommendationsCard
        card={card}
        language="EN"
        debug={false}
        onOpenPdp={onOpenPdp}
        resolveOffers={resolveOffers}
        resolveProductRef={resolveProductRef}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    await waitFor(() => {
      expect(onOpenPdp).toHaveBeenCalledTimes(1);
    });
    expect(resolveOffers).not.toHaveBeenCalled();
    expect(resolveProductRef).toHaveBeenCalledTimes(1);
    expect(onOpenPdp.mock.calls[0][0].url).toContain('/products/prod_by_query');
  });
});
