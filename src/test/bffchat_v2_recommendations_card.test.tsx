import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

import BffChat from '@/pages/BffChat';
import { ShopProvider } from '@/contexts/shop';
import { bffJson } from '@/lib/pivotaAgentBff';
import type { V1Envelope } from '@/lib/pivotaAgentBff';

function makeEnvelope(args?: Partial<V1Envelope>): V1Envelope {
  return {
    request_id: args?.request_id ?? 'req_v2_reco_card',
    trace_id: args?.trace_id ?? 'trace_v2_reco_card',
    assistant_message: args?.assistant_message ?? null,
    suggested_chips: args?.suggested_chips ?? [],
    cards: args?.cards ?? [],
    session_patch: args?.session_patch ?? {},
    events: args?.events ?? [],
  };
}

const READY_TIMEOUT_MS = 5000;

async function waitForEnabledComposer() {
  const input = await screen.findByPlaceholderText(/ask a question/i);
  await waitFor(() => expect(input).not.toBeDisabled(), { timeout: READY_TIMEOUT_MS });
  return input;
}

function renderChat() {
  render(
    <MemoryRouter initialEntries={['/chat']}>
      <ShopProvider>
        <BffChat />
      </ShopProvider>
    </MemoryRouter>,
  );
}

describe('BffChat V2 recommendations cards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    if (!HTMLElement.prototype.scrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        value: vi.fn(),
        writable: true,
      });
    }
  });

  it('renders V2 recommendations cards from metadata.recommendations via the legacy card renderer', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap', trace_id: 'trace_bootstrap' }));
      }
      if (path === '/v1/chat') {
        return Promise.resolve({
          cards: [
            {
              card_type: 'recommendations',
              metadata: {
                recommendation_meta: {
                  source_mode: 'catalog_grounded',
                  trigger_source: 'text',
                },
                recommendations: [
                  {
                    product_id: 'prod_mask_1',
                    merchant_id: 'merchant_mask_1',
                    brand: 'Winona',
                    name: 'Hydrating Repair Mask',
                    category: 'mask',
                    reasons: ['Supports hydration and barrier comfort.'],
                  },
                ],
              },
            },
          ],
          ops: {},
          next_actions: [],
        });
      }
      return Promise.resolve(makeEnvelope());
    });

    renderChat();
    const input = await waitForEnabledComposer();
    fireEvent.change(input, { target: { value: 'Recommend a facial mask that suits me.' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    expect(await screen.findByText(/Hydrating Repair Mask/i)).toBeInTheDocument();
    expect(screen.getByText(/Why this fits/i)).toBeInTheDocument();
    expect(screen.queryByText(/unknown\.response/i)).not.toBeInTheDocument();
  });

  it('renders V2 no-result text_response messages as plain assistant text', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap', trace_id: 'trace_bootstrap' }));
      }
      if (path === '/v1/chat') {
        return Promise.resolve({
          cards: [
            {
              card_type: 'text_response',
              sections: [
                {
                  type: 'text_answer',
                  text_en: "I couldn't find a strong catalog-grounded mask match yet. Share your main concern or a target ingredient and I can narrow it down.",
                },
              ],
            },
          ],
          ops: {},
          next_actions: [],
        });
      }
      return Promise.resolve(makeEnvelope());
    });

    renderChat();
    const input = await waitForEnabledComposer();
    fireEvent.change(input, { target: { value: 'Recommend a facial mask that suits me.' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    expect(await screen.findByText(/catalog-grounded mask match/i)).toBeInTheDocument();
  });
});
