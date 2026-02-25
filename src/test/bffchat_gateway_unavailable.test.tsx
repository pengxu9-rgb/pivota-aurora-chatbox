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
    sendRecoEmployeeFeedback: vi.fn(),
  };
});

vi.mock('@/lib/auroraAnalytics', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auroraAnalytics')>('@/lib/auroraAnalytics');
  return {
    ...actual,
    emitAuroraGatewayUnavailable: vi.fn(),
  };
});

import BffChat from '@/pages/BffChat';
import { ShopProvider } from '@/contexts/shop';
import { emitAuroraGatewayUnavailable } from '@/lib/auroraAnalytics';
import { bffJson, PivotaAgentBffError } from '@/lib/pivotaAgentBff';
import type { V1Envelope } from '@/lib/pivotaAgentBff';

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

describe('BffChat gateway unavailable UX', () => {
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

  it('shows friendly 503 message for /v1/chat and emits gateway event', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap', trace_id: 'trace_bootstrap' }));
      }
      if (path === '/v1/chat') {
        return Promise.reject(new PivotaAgentBffError('Request failed: 503 Service Unavailable', 503, {}));
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

    await waitFor(() => {
      const bootstrapCalls = mock.mock.calls.filter((call) => call[0] === '/v1/session/bootstrap');
      expect(bootstrapCalls.length).toBeGreaterThan(0);
    });

    const input = screen.getByPlaceholderText(/ask a question/i);
    fireEvent.change(input, { target: { value: 'check a product' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText(/Service is temporarily unavailable/i)).toBeInTheDocument();
    });

    expect(vi.mocked(emitAuroraGatewayUnavailable)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(emitAuroraGatewayUnavailable).mock.calls[0][1]).toMatchObject({
      path: '/v1/chat',
      status: 503,
      is_network_error: false,
    });
  });

  it('shows friendly network/CORS message for product analyze failure and emits gateway event', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap_2', trace_id: 'trace_bootstrap_2' }));
      }
      if (path === '/v1/product/parse') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_parse_2',
            trace_id: 'trace_parse_2',
            cards: [
              {
                card_id: 'parse_1',
                type: 'product_parse',
                payload: {
                  product: {
                    brand: 'Lab Series',
                    name: 'All-in-One Defense Lotion',
                  },
                },
              },
            ],
          }),
        );
      }
      if (path === '/v1/product/analyze') {
        return Promise.reject(new TypeError('Failed to fetch'));
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

    const entry = await screen.findByRole('button', { name: /evaluate a specific product for me/i });
    fireEvent.click(entry);

    const productInput = await screen.findByPlaceholderText(/nivea creme/i);
    fireEvent.change(productInput, { target: { value: 'https://example.com/p/test' } });
    fireEvent.click(screen.getByRole('button', { name: /^analyze$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Gateway is temporarily unreachable or restarting/i)).toBeInTheDocument();
    });

    expect(vi.mocked(emitAuroraGatewayUnavailable)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(emitAuroraGatewayUnavailable).mock.calls[0][1]).toMatchObject({
      path: '/v1/product/analyze',
      status: null,
      is_network_error: true,
    });
  });
});
