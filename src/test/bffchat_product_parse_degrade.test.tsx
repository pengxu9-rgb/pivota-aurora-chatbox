import React from 'react';
import { fireEvent, render, screen, waitFor } from '@/test/testProviders';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/use-toast', () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/pivotaAgentBff', async () => {
  const actual = await vi.importActual<typeof import('@/lib/pivotaAgentBff')>('@/lib/pivotaAgentBff');
  return {
    ...actual,
    bffJson: vi.fn(),
    bffChatStream: vi.fn().mockRejectedValue(new Error('stream unavailable in test')),
    sendRecoEmployeeFeedback: vi.fn(),
  };
});

vi.mock('@/lib/auroraAnalytics', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auroraAnalytics')>('@/lib/auroraAnalytics');
  return {
    ...actual,
    emitAuroraSkillRouteResult: vi.fn(),
  };
});

import BffChat from '@/pages/BffChat';
import { ShopProvider } from '@/contexts/shop';
import { bffJson } from '@/lib/pivotaAgentBff';
import type { V1Envelope } from '@/lib/pivotaAgentBff';
import { emitAuroraSkillRouteResult } from '@/lib/auroraAnalytics';

function makeEnvelope(args?: Partial<V1Envelope>): V1Envelope {
  return {
    request_id: args?.request_id ?? 'req_1',
    trace_id: args?.trace_id ?? 'trace_1',
    assistant_message: args?.assistant_message ?? null,
    suggested_chips: args?.suggested_chips ?? [],
    cards: args?.cards ?? [],
    session_patch: args?.session_patch ?? {},
    events: args?.events ?? [],
  };
}

function makeProductVerdictSkillResponse() {
  return {
    request_id: 'req_chat_product_verdict',
    trace_id: 'trace_chat_product_verdict',
    cards: [
      {
        card_type: 'product_verdict',
        sections: [
          {
            type: 'product_verdict_structured',
            product_name: 'Nivea Creme',
            brand: 'Nivea',
            product_type: 'moisturizer',
            suitability: 'good_match',
            usage: {
              time_of_day: 'both',
              frequency: 'daily',
            },
            key_ingredients: [],
            risk_flags: [],
            safety_warnings: [],
          },
        ],
      },
    ],
    ops: {
      thread_ops: [],
      profile_patch: {},
      routine_patch: {},
      experiment_events: [],
    },
    next_actions: [],
  };
}

async function openProductEvaluateFlow() {
  const entry = await screen.findByRole('button', { name: /evaluate a product/i });
  fireEvent.click(entry);
  return screen.findByPlaceholderText(/nivea creme/i);
}

describe('BffChat product deep scan mainline-only routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    window.localStorage.clear();
    if (!HTMLElement.prototype.scrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        value: vi.fn(),
        writable: true,
      });
    }
  });

  it('routes a bare product URL from the composer through /v1/chat only', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap_direct_url', trace_id: 'trace_bootstrap_direct_url' }));
      }
      if (path === '/v1/chat') {
        return Promise.resolve(makeProductVerdictSkillResponse());
      }
      if (path === '/v1/product/parse' || path === '/v1/product/analyze') {
        throw new Error(`mainline-only product analyze should not hit ${path}`);
      }
      return Promise.resolve(makeEnvelope());
    });

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    const composer = await screen.findByPlaceholderText(/paste a product link/i);
    fireEvent.change(composer, {
      target: {
        value: 'https://www.nivea.co.uk/products/nivea-creme-40059001030700045.html',
      },
    });
    fireEvent.submit(composer.closest('form') as HTMLFormElement);

    await waitFor(() => {
      const chatCall = mock.mock.calls.find((call) => call[0] === '/v1/chat');
      expect(chatCall).toBeTruthy();
    });

    const chatCall = mock.mock.calls.find((call) => call[0] === '/v1/chat');
    expect(chatCall).toBeTruthy();
    expect(JSON.parse(String((chatCall?.[2] as any)?.body || '{}'))).toMatchObject({
      action: {
        action_id: 'chip.action.analyze_product',
        data: {
          reply_text: 'https://www.nivea.co.uk/products/nivea-creme-40059001030700045.html',
          product_anchor: {
            url: 'https://www.nivea.co.uk/products/nivea-creme-40059001030700045.html',
          },
        },
      },
    });
    expect(mock.mock.calls.some((call) => call[0] === '/v1/product/parse')).toBe(false);
    expect(mock.mock.calls.some((call) => call[0] === '/v1/product/analyze')).toBe(false);
  });

  it('routes modal product input through /v1/chat and renders product_verdict', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap_modal_product', trace_id: 'trace_bootstrap_modal_product' }));
      }
      if (path === '/v1/chat') {
        return Promise.resolve(makeProductVerdictSkillResponse());
      }
      if (path === '/v1/product/parse' || path === '/v1/product/analyze') {
        throw new Error(`mainline-only product analyze should not hit ${path}`);
      }
      return Promise.resolve(makeEnvelope());
    });

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    const productInput = await openProductEvaluateFlow();
    fireEvent.change(productInput, { target: { value: 'Nivea Creme' } });
    fireEvent.click(screen.getByRole('button', { name: /^analyze$/i }));

    await waitFor(() => {
      expect(mock.mock.calls.some((call) => call[0] === '/v1/chat')).toBe(true);
    });

    expect(mock.mock.calls.some((call) => call[0] === '/v1/product/parse')).toBe(false);
    expect(mock.mock.calls.some((call) => call[0] === '/v1/product/analyze')).toBe(false);
    await waitFor(() => {
      expect(screen.getAllByText(/nivea creme/i).length).toBeGreaterThan(1);
    });
    expect(vi.mocked(emitAuroraSkillRouteResult)).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        entry_source: 'product_deep_scan',
        requested_skill: 'product.analyze',
        route: 'skill',
        fallback_used: false,
      }),
    );
  });

  it('shows an explicit empty state when chat returns no product_verdict card', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap_product_blocked', trace_id: 'trace_bootstrap_product_blocked' }));
      }
      if (path === '/v1/chat') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_chat_empty_product', trace_id: 'trace_chat_empty_product' }));
      }
      if (path === '/v1/product/parse' || path === '/v1/product/analyze') {
        throw new Error(`mainline-only product analyze should not hit ${path}`);
      }
      return Promise.resolve(makeEnvelope());
    });

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    const productInput = await openProductEvaluateFlow();
    fireEvent.change(productInput, { target: { value: 'Mystery Serum' } });
    fireEvent.click(screen.getByRole('button', { name: /^analyze$/i }));

    expect(await screen.findByText(/need clearer product details/i)).toBeInTheDocument();
    expect(mock.mock.calls.some((call) => call[0] === '/v1/product/parse')).toBe(false);
    expect(mock.mock.calls.some((call) => call[0] === '/v1/product/analyze')).toBe(false);
    expect(vi.mocked(emitAuroraSkillRouteResult)).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        entry_source: 'product_deep_scan',
        requested_skill: 'product.analyze',
        route: 'blocked',
        fallback_used: false,
        mainline_blocked: true,
        mainline_blocked_reason: 'missing_expected_card',
      }),
    );
  });
});
