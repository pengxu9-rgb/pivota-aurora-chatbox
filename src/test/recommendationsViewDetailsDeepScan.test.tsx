import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/use-toast', () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: vi.fn() }),
}));

import type { Card } from '@/lib/pivotaAgentBff';
import { buildGoogleSearchFallbackUrl } from '@/lib/externalSearchFallback';
import { RecommendationsCard } from '@/pages/BffChat';

const buildRecoCard = (args: {
  brand?: string;
  name?: string;
  subjectProductGroupId?: string | null;
  canonicalProductRef?: { product_id: string; merchant_id?: string } | null;
  pdpOpen?: { path?: string; resolve_reason_code?: string; external?: { query?: string; url?: string } } | null;
  alternatives?: Array<Record<string, unknown>>;
  evidencePack?: Record<string, unknown> | null;
}): Card => ({
  card_id: 'reco_card_1',
  type: 'recommendations',
  payload: {
    recommendations: [
      {
        step: 'treatment',
        ...(args.subjectProductGroupId
          ? {
              subject: { product_group_id: args.subjectProductGroupId },
              product_group_id: args.subjectProductGroupId,
            }
          : {}),
        ...(args.canonicalProductRef
          ? {
              canonical_product_ref: args.canonicalProductRef,
            }
          : {}),
        ...(args.pdpOpen
          ? {
              pdp_open: args.pdpOpen,
            }
          : {}),
        sku: {
          brand: args.brand ?? 'The Ordinary',
          display_name: args.name ?? 'Niacinamide 10% + Zinc 1%',
        },
        ...(Array.isArray(args.alternatives) ? { alternatives: args.alternatives } : {}),
        ...(args.evidencePack ? { evidence_pack: args.evidencePack } : {}),
      },
    ],
  },
});

describe('RecommendationsCard View details routing', () => {
  it('1) uses subject.product_group_id first: opens internal only, no resolve, no new tab', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const onOpenPdp = vi.fn();
    const resolveProductRef = vi.fn();

    render(
      <RecommendationsCard
        card={buildRecoCard({ subjectProductGroupId: 'pg:merch_pg:prod_pg' })}
        language="EN"
        debug={false}
        onOpenPdp={onOpenPdp}
        resolveProductRef={resolveProductRef}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    await waitFor(() => {
      expect(onOpenPdp).toHaveBeenCalledTimes(1);
    });
    expect(onOpenPdp.mock.calls[0][0].url).toContain('/products/prod_pg');
    expect(onOpenPdp.mock.calls[0][0].url).toContain('merchant_id=merch_pg');
    expect(resolveProductRef).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('2) uses canonical_product_ref second: opens internal only, no resolve, no new tab', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const onOpenPdp = vi.fn();
    const resolveProductRef = vi.fn();

    render(
      <RecommendationsCard
        card={buildRecoCard({
          canonicalProductRef: {
            product_id: '9886499864904',
            merchant_id: 'merch_efbc46b4619cfbdf',
          },
        })}
        language="EN"
        debug={false}
        onOpenPdp={onOpenPdp}
        resolveProductRef={resolveProductRef}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    await waitFor(() => {
      expect(onOpenPdp).toHaveBeenCalledTimes(1);
    });
    expect(onOpenPdp.mock.calls[0][0].url).toContain('/products/9886499864904');
    expect(resolveProductRef).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('3) no stable key + resolve fail: opens one Google new tab only once', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const onOpenPdp = vi.fn();
    const resolveProductRef = vi.fn().mockResolvedValue({
      resolved: false,
      reason_code: 'NO_CANDIDATES',
      candidates: [],
    });

    render(
      <RecommendationsCard
        card={buildRecoCard({ brand: 'IPSA', name: 'Time Reset Aqua' })}
        language="EN"
        debug={false}
        onOpenPdp={onOpenPdp}
        resolveProductRef={resolveProductRef}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    await waitFor(() => {
      expect(resolveProductRef).toHaveBeenCalledTimes(1);
      expect(openSpy).toHaveBeenCalledTimes(1);
    });
    expect(openSpy).toHaveBeenCalledWith(
      buildGoogleSearchFallbackUrl('IPSA Time Reset Aqua', 'EN'),
      '_blank',
      'noopener,noreferrer',
    );
    expect(onOpenPdp).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('3b) pdp_open.path=external + upstream_timeout retries resolve first and opens internal when resolved', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const onOpenPdp = vi.fn();
    const resolveProductRef = vi.fn().mockResolvedValue({
      resolved: true,
      canonical_product_ref: { product_id: '9886500127048', merchant_id: 'merch_efbc46b4619cfbdf' },
    });

    render(
      <RecommendationsCard
        card={buildRecoCard({
          brand: 'IPSA',
          name: 'Time Reset Aqua',
          pdpOpen: {
            path: 'external',
            resolve_reason_code: 'UPSTREAM_TIMEOUT',
            external: { query: 'IPSA Time Reset Aqua' },
          },
        })}
        language="EN"
        debug={false}
        onOpenPdp={onOpenPdp}
        resolveProductRef={resolveProductRef}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    await waitFor(() => {
      expect(resolveProductRef).toHaveBeenCalledTimes(1);
      expect(onOpenPdp).toHaveBeenCalledTimes(1);
    });
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('3c) pdp_open.path=external + no_candidates with weak hint opens external directly', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const onOpenPdp = vi.fn();
    const resolveProductRef = vi.fn();

    render(
      <RecommendationsCard
        card={buildRecoCard({
          brand: '',
          name: 'Serum',
          pdpOpen: {
            path: 'external',
            resolve_reason_code: 'NO_CANDIDATES',
            external: { query: 'serum' },
          },
        })}
        language="EN"
        debug={false}
        onOpenPdp={onOpenPdp}
        resolveProductRef={resolveProductRef}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledTimes(1);
    });
    expect(resolveProductRef).not.toHaveBeenCalled();
    expect(onOpenPdp).not.toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledWith(
      buildGoogleSearchFallbackUrl('serum', 'EN'),
      '_blank',
      'noopener,noreferrer',
    );
    openSpy.mockRestore();
  });

  it('3d) pdp_open.path=external + db_error retries resolve and falls back external when unresolved', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const onOpenPdp = vi.fn();
    const resolveProductRef = vi.fn().mockResolvedValue({
      resolved: false,
      reason_code: 'NO_CANDIDATES',
      candidates: [],
    });

    render(
      <RecommendationsCard
        card={buildRecoCard({
          brand: 'IPSA',
          name: 'Time Reset Aqua',
          pdpOpen: {
            path: 'external',
            resolve_reason_code: 'DB_ERROR',
            external: { query: 'IPSA Time Reset Aqua' },
          },
        })}
        language="EN"
        debug={false}
        onOpenPdp={onOpenPdp}
        resolveProductRef={resolveProductRef}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    await waitFor(() => {
      expect(resolveProductRef).toHaveBeenCalledTimes(1);
      expect(openSpy).toHaveBeenCalledTimes(1);
    });
    expect(onOpenPdp).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('3e) pdp_open.path=external + no_candidates with strong hint retries resolve first', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const onOpenPdp = vi.fn();
    const resolveProductRef = vi.fn().mockResolvedValue({
      resolved: true,
      canonical_product_ref: { product_id: '9886500127048', merchant_id: 'merch_efbc46b4619cfbdf' },
    });

    render(
      <RecommendationsCard
        card={buildRecoCard({
          brand: 'IPSA',
          name: 'Time Reset Aqua',
          pdpOpen: {
            path: 'external',
            resolve_reason_code: 'NO_CANDIDATES',
            external: { query: 'IPSA Time Reset Aqua' },
          },
        })}
        language="EN"
        debug={false}
        onOpenPdp={onOpenPdp}
        resolveProductRef={resolveProductRef}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    await waitFor(() => {
      expect(resolveProductRef).toHaveBeenCalledTimes(1);
      expect(onOpenPdp).toHaveBeenCalledTimes(1);
    });
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('4) unresolved without allowed reason_code: does not open external tab', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const onOpenPdp = vi.fn();
    const resolveProductRef = vi.fn().mockResolvedValue({
      resolved: false,
      reason_code: 'UNAUTHORIZED',
      candidates: [],
    });

    render(
      <RecommendationsCard
        card={buildRecoCard({ brand: 'IPSA', name: 'Time Reset Aqua' })}
        language="EN"
        debug={false}
        onOpenPdp={onOpenPdp}
        resolveProductRef={resolveProductRef}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    await waitFor(() => {
      expect(resolveProductRef).toHaveBeenCalledTimes(1);
      expect(onOpenPdp).not.toHaveBeenCalled();
      expect(openSpy).not.toHaveBeenCalled();
    });
    openSpy.mockRestore();
  });

  it('4b) resolve request error falls back to external search', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const onOpenPdp = vi.fn();
    const resolveProductRef = vi.fn().mockRejectedValue(new Error('network_error'));

    render(
      <RecommendationsCard
        card={buildRecoCard({ brand: 'IPSA', name: 'Time Reset Aqua' })}
        language="EN"
        debug={false}
        onOpenPdp={onOpenPdp}
        resolveProductRef={resolveProductRef}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    await waitFor(() => {
      expect(resolveProductRef).toHaveBeenCalledTimes(1);
      expect(openSpy).toHaveBeenCalledTimes(1);
    });
    expect(openSpy).toHaveBeenCalledWith(
      buildGoogleSearchFallbackUrl('IPSA Time Reset Aqua', 'EN'),
      '_blank',
      'noopener,noreferrer',
    );
    expect(onOpenPdp).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('4c) opaque canonical ref does not open internal directly and can fall back externally', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const onOpenPdp = vi.fn();
    const resolveProductRef = vi.fn().mockResolvedValue({
      resolved: false,
      reason_code: 'NO_CANDIDATES',
      candidates: [],
    });

    render(
      <RecommendationsCard
        card={buildRecoCard({
          brand: 'IPSA',
          name: 'Time Reset Aqua',
          canonicalProductRef: {
            product_id: '7af2cdf9-6e10-472b-b766-67f27d37e991',
            merchant_id: 'merch_efbc46b4619cfbdf',
          },
        })}
        language="EN"
        debug={false}
        onOpenPdp={onOpenPdp}
        resolveProductRef={resolveProductRef}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    await waitFor(() => {
      expect(resolveProductRef).toHaveBeenCalledTimes(1);
      expect(openSpy).toHaveBeenCalledTimes(1);
    });
    expect(onOpenPdp).not.toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledWith(
      buildGoogleSearchFallbackUrl('IPSA Time Reset Aqua', 'EN'),
      '_blank',
      'noopener,noreferrer',
    );
    openSpy.mockRestore();
  });

  it('internal resolve success: opens PDP drawer and never opens a new tab', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const onOpenPdp = vi.fn();
    const resolveProductRef = vi.fn().mockResolvedValue({
      resolved: true,
      canonical_product_ref: { product_id: '9886499864904', merchant_id: 'merch_efbc46b4619cfbdf' },
    });

    render(
      <RecommendationsCard
        card={buildRecoCard({ brand: 'The Ordinary', name: 'Niacinamide 10% + Zinc 1%' })}
        language="EN"
        debug={false}
        onOpenPdp={onOpenPdp}
        resolveProductRef={resolveProductRef}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    await waitFor(() => {
      expect(onOpenPdp).toHaveBeenCalledTimes(1);
    });
    expect(resolveProductRef).toHaveBeenCalledTimes(1);
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('5) never opens blank tab', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const resolveProductRef = vi.fn().mockResolvedValue({
      resolved: false,
      reason_code: 'NO_CANDIDATES',
      candidates: [],
    });

    render(
      <RecommendationsCard
        card={buildRecoCard({ brand: 'The Ordinary', name: 'Niacinamide 10% + Zinc 1%' })}
        language="EN"
        debug={false}
        resolveProductRef={resolveProductRef}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledTimes(1);
    });
    const firstUrl = String(openSpy.mock.calls[0]?.[0] || '');
    expect(firstUrl).toMatch(/^https:\/\/www\.google\./);
    expect(firstUrl).not.toBe('');
    expect(firstUrl).not.toBe('about:blank');
    openSpy.mockRestore();
  });

  it('6) never routes to shopping-agent browse', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const resolveProductRef = vi.fn().mockResolvedValue({
      resolved: false,
      reason_code: 'NO_CANDIDATES',
      candidates: [],
    });

    const card: Card = {
      card_id: 'reco_card_browse_guard',
      type: 'recommendations',
      payload: {
        recommendations: [
          {
            step: 'treatment',
            sku: {
              brand: 'The Ordinary',
              display_name: 'Niacinamide 10% + Zinc 1%',
              url: 'https://agent.pivota.cc/products?open=browse',
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
        resolveProductRef={resolveProductRef}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledTimes(1);
    });
    const openedUrl = String(openSpy.mock.calls[0]?.[0] || '');
    expect(openedUrl).toMatch(/^https:\/\/www\.google\./);
    expect(openedUrl).not.toContain('agent.pivota.cc/products');
    expect(openedUrl).not.toContain('open=browse');
    openSpy.mockRestore();
  });

  it('7) same click is idempotent: one gateway resolve request only', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window);

    let finishResolve: ((value: unknown) => void) | null = null;
    const resolvePromise = new Promise((resolve) => {
      finishResolve = resolve;
    });
    const resolveProductRef = vi.fn().mockReturnValue(resolvePromise);

    render(
      <RecommendationsCard
        card={buildRecoCard({ brand: 'The Ordinary', name: 'Niacinamide 10% + Zinc 1%' })}
        language="EN"
        debug={false}
        resolveProductRef={resolveProductRef}
      />,
    );

    const button = screen.getByRole('button', { name: /view details/i });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(resolveProductRef).toHaveBeenCalledTimes(1);

    finishResolve?.({
      resolved: false,
      reason_code: 'NO_CANDIDATES',
      candidates: [],
    });

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledTimes(1);
    });
    openSpy.mockRestore();
  });

  it('8) repeated click after completion opens internal again', async () => {
    const onOpenPdp = vi.fn();
    const resolveProductRef = vi.fn();

    render(
      <RecommendationsCard
        card={buildRecoCard({ subjectProductGroupId: 'pg:merch_pg:prod_pg' })}
        language="EN"
        debug={false}
        onOpenPdp={onOpenPdp}
        resolveProductRef={resolveProductRef}
      />,
    );

    const button = screen.getByRole('button', { name: /view details/i });
    fireEvent.click(button);
    await waitFor(() => {
      expect(onOpenPdp).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(button);
    await waitFor(() => {
      expect(onOpenPdp).toHaveBeenCalledTimes(2);
    });
    expect(resolveProductRef).not.toHaveBeenCalled();
  });

  it('9) recommendation action buttons keep compact no-wrap style', () => {
    render(
      <RecommendationsCard
        card={buildRecoCard({ subjectProductGroupId: 'pg:merch_pg:prod_pg' })}
        language="EN"
        debug={false}
      />,
    );

    expect(screen.getByRole('button', { name: /view details/i })).toHaveClass('reco-step-action-button', 'whitespace-nowrap');
    expect(screen.getByRole('button', { name: /see alternatives/i })).toHaveClass('reco-step-action-button', 'whitespace-nowrap');
  });

  it('10) pair-only local tracks open first, then refresh with remote alternatives payload', async () => {
    const onOpenAlternativesSheet = vi.fn();
    const loadAlternativesForItem = vi.fn().mockResolvedValue({
      ok: true,
      alternatives: [
        {
          kind: 'dupe',
          reasons: ['Cheaper option'],
          tradeoffs: ['Usually cheaper'],
          product: {
            brand: 'AltLab',
            name: 'Budget Serum Alt',
            price: { usd: 18.5 },
          },
        },
      ],
    });

    render(
      <RecommendationsCard
        card={buildRecoCard({
          brand: 'The Ordinary',
          name: 'Niacinamide 10% + Zinc 1%',
          alternatives: [],
          evidencePack: { pairingRules: ['Good budget option'] },
        })}
        language="EN"
        debug={false}
        onOpenAlternativesSheet={onOpenAlternativesSheet}
        loadAlternativesForItem={loadAlternativesForItem}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /see alternatives/i }));

    await waitFor(() => {
      expect(onOpenAlternativesSheet).toHaveBeenCalledTimes(1);
    });
    const firstTracks = onOpenAlternativesSheet.mock.calls[0][0];
    expect(firstTracks.some((track: any) => track.key === 'pair')).toBe(true);
    expect(firstTracks.some((track: any) => track.key === 'replace')).toBe(false);

    await waitFor(() => {
      expect(loadAlternativesForItem).toHaveBeenCalledTimes(1);
      expect(onOpenAlternativesSheet).toHaveBeenCalledTimes(2);
    });
    const secondTracks = onOpenAlternativesSheet.mock.calls[1][0];
    const replaceTrack = secondTracks.find((track: any) => track.key === 'replace');
    expect(replaceTrack).toBeTruthy();
    expect(replaceTrack.items.length).toBe(1);
    expect(replaceTrack.items[0].candidate.brand).toBe('AltLab');
    expect(replaceTrack.items[0].candidate.name).toBe('Budget Serum Alt');
    expect(replaceTrack.items[0].candidate.product.price.usd).toBe(18.5);
  });

  it('11) empty remote alternatives keep local pairing notes and append empty reason track', async () => {
    const onOpenAlternativesSheet = vi.fn();
    const loadAlternativesForItem = vi.fn().mockResolvedValue({
      ok: true,
      alternatives: [],
      noResultReason: 'upstream_missing_or_empty',
    });

    render(
      <RecommendationsCard
        card={buildRecoCard({
          brand: 'The Ordinary',
          name: 'Niacinamide 10% + Zinc 1%',
          alternatives: [],
          evidencePack: { pairingRules: ['Good budget option'] },
        })}
        language="EN"
        debug={false}
        onOpenAlternativesSheet={onOpenAlternativesSheet}
        loadAlternativesForItem={loadAlternativesForItem}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /see alternatives/i }));

    await waitFor(() => {
      expect(onOpenAlternativesSheet).toHaveBeenCalledTimes(2);
    });
    const mergedTracks = onOpenAlternativesSheet.mock.calls[1][0];
    expect(mergedTracks.some((track: any) => track.key === 'pair')).toBe(true);
    expect(mergedTracks.some((track: any) => track.key === 'empty')).toBe(true);
  });
});
