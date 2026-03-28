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

function makeDupeSuggestSkillResponse() {
  return {
    request_id: 'req_chat_dupe_search',
    trace_id: 'trace_chat_dupe_search',
    cards: [
      {
        card_type: 'dupe_suggest',
        metadata: {
          original: { brand: 'Glow Lab', name: 'Barrier Cloud Cream', product_id: 'anchor_1' },
          dupes: [
            {
              kind: 'dupe',
              similarity: 84,
              product: { brand: 'Budget Lab', name: 'Barrier Daily Cream', product_id: 'dupe_1' },
              reasons: ['Similar barrier-supporting cream texture.'],
              tradeoffs: ['Lighter finish'],
            },
          ],
          comparables: [],
        },
        sections: [
          {
            type: 'dupe_suggest_structured',
            anchor_product: { brand: 'Glow Lab', name: 'Barrier Cloud Cream', product_id: 'anchor_1' },
            dupe_count: 1,
            comparable_count: 0,
          },
        ],
      },
    ],
    ops: { thread_ops: [], profile_patch: {}, routine_patch: {}, experiment_events: [] },
    next_actions: [],
  };
}

async function openDupeCompareFlow() {
  const openButton = await screen.findByRole('button', { name: /find dupes \/ cheaper alternatives/i });
  fireEvent.click(openButton);
  const targetInput = await screen.findByPlaceholderText(/nivea creme/i);
  fireEvent.change(targetInput, { target: { value: 'Glow Lab Barrier Cloud Cream' } });
  fireEvent.click(screen.getByRole('button', { name: /^find$/i }));
  return screen.findByRole('button', { name: /^compare$/i });
}

describe('BffChat dupe compare mainline-only routing', () => {
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

  it('routes dupe compare through /v1/chat and blocks legacy compare', async () => {
    const mock = vi.mocked(bffJson);
    let chatCalls = 0;
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap_dupe_compare', trace_id: 'trace_bootstrap_dupe_compare' }));
      }
      if (path === '/v1/chat') {
        chatCalls += 1;
        if (chatCalls === 1) return Promise.resolve(makeDupeSuggestSkillResponse());
        return Promise.resolve({
          request_id: 'req_chat_dupe_compare',
          trace_id: 'trace_chat_dupe_compare',
          cards: [
            {
              card_type: 'compatibility',
              sections: [
                {
                  type: 'compatibility_structured',
                  anchor: { brand: 'Glow Lab', name: 'Barrier Cloud Cream' },
                  comparisons: [
                    {
                      target: { brand: 'Budget Lab', name: 'Barrier Daily Cream' },
                      key_ingredients_match: 'Both focus on barrier-supporting humectants and emollients.',
                      texture_comparison: 'The dupe is a little lighter.',
                      suitability_comparison: 'Good option for combo skin.',
                      price_comparison: 'Meaningfully cheaper.',
                      verdict_en: 'Good budget alternative',
                      verdict_zh: '更便宜的替代选择',
                    },
                  ],
                  comparison_mode: 'full',
                },
              ],
            },
          ],
          ops: { thread_ops: [], profile_patch: {}, routine_patch: {}, experiment_events: [] },
          next_actions: [],
        });
      }
      if (path === '/v1/dupe/compare' || path === '/v1/dupe/suggest') {
        throw new Error(`mainline-only dupe compare should not hit ${path}`);
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

    const compareButton = await openDupeCompareFlow();
    fireEvent.click(compareButton);

    await waitFor(() => {
      const compareCall = mock.mock.calls.find((call) => {
        if (call[0] !== '/v1/chat') return false;
        const body = JSON.parse(String((call?.[2] as any)?.body || '{}'));
        return body?.action?.action_id === 'chip.action.dupe_compare';
      });
      expect(compareCall).toBeTruthy();
    });

    expect(mock.mock.calls.some((call) => call[0] === '/v1/dupe/compare')).toBe(false);
    expect(vi.mocked(emitAuroraSkillRouteResult)).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        entry_source: 'chip.action.dupe_compare',
        requested_skill: 'dupe.compare',
        route: 'skill',
        fallback_used: false,
      }),
    );
  });
});
