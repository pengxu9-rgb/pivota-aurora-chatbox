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

async function openDupeSearchSheet() {
  const openButton = await screen.findByRole('button', { name: /find dupes \/ cheaper alternatives/i });
  fireEvent.click(openButton);
  return screen.findByPlaceholderText(/nivea creme/i);
}

describe('BffChat dupe search mainline-only routing', () => {
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

  it('routes dupe search through /v1/chat and blocks legacy suggest', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap_dupe', trace_id: 'trace_bootstrap_dupe' }));
      }
      if (path === '/v1/chat') {
        return Promise.resolve({
          request_id: 'req_chat_dupe',
          trace_id: 'trace_chat_dupe',
          cards: [
            {
              card_type: 'dupe_suggest',
              sections: [
                {
                  type: 'dupe_suggest_structured',
                  anchor_product: { brand: 'Glow Lab', name: 'Barrier Cloud Cream', product_id: 'anchor_1' },
                  dupe_count: 1,
                  comparable_count: 0,
                },
              ],
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
            },
          ],
          ops: { thread_ops: [], profile_patch: {}, routine_patch: {}, experiment_events: [] },
          next_actions: [],
        });
      }
      if (path === '/v1/dupe/suggest') {
        throw new Error('mainline-only dupe search should not hit legacy /v1/dupe/suggest');
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

    const targetInput = await openDupeSearchSheet();
    fireEvent.change(targetInput, { target: { value: 'Glow Lab Barrier Cloud Cream' } });
    fireEvent.click(screen.getByRole('button', { name: /^find$/i }));

    await waitFor(() => {
      expect(mock.mock.calls.some((call) => call[0] === '/v1/chat')).toBe(true);
    });

    expect(mock.mock.calls.some((call) => call[0] === '/v1/dupe/suggest')).toBe(false);
    expect(await screen.findByRole('button', { name: /^compare$/i })).toBeInTheDocument();
    expect(vi.mocked(emitAuroraSkillRouteResult)).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        entry_source: 'chip.start.dupes',
        requested_skill: 'dupe.suggest',
        route: 'skill',
        fallback_used: false,
      }),
    );
  });
});
