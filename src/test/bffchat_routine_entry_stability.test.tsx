import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@/test/testProviders';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
import { TimeoutError } from '@/utils/requestWithTimeout';

const CHAT_TIMEOUT_MS = 15000;

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

describe('Routine entry stability', () => {
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

  afterEach(() => {
    vi.useRealTimers();
  });

  it('prioritizes open=routine over chip.start.routine and does not auto-send /v1/chat', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_bootstrap',
            trace_id: 'trace_bootstrap',
            session_patch: {},
          }),
        );
      }
      if (path === '/v1/chat') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_chat_should_not_happen' }));
      }
      return Promise.resolve(makeEnvelope());
    });

    render(
      <MemoryRouter initialEntries={['/chat?open=routine&chip_id=chip.start.routine']}>
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Add your AM\/PM products/i)).toBeInTheDocument();
    });

    const cleanserInput = screen.getByPlaceholderText(/CeraVe Foaming Cleanser/i);
    expect(cleanserInput).not.toBeDisabled();
    fireEvent.change(cleanserInput, { target: { value: 'Test cleanser' } });
    expect((cleanserInput as HTMLInputElement).value).toBe('Test cleanser');

    const chatCalls = mock.mock.calls.filter((call) => call[0] === '/v1/chat');
    expect(chatCalls).toHaveLength(0);
  });

  it('opens the routine sheet when clicking the landing Build an AM/PM routine chip after a non-routine /v1/chat fallback', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_bootstrap_landing',
            trace_id: 'trace_bootstrap_landing',
            session_patch: {},
          }),
        );
      }
      if (path === '/v1/chat') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_chat_fallback_to_sheet' }));
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

    const trigger = await screen.findByRole('button', { name: /Build an AM\/PM routine/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/Add your AM\/PM products/i)).toBeInTheDocument();
    });

    const chatCalls = mock.mock.calls.filter((call) => call[0] === '/v1/chat');
    expect(chatCalls).toHaveLength(1);
  });

  it('fills PM fields from AM when tapping Same as AM and submits copied routine', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_bootstrap_same_as_am',
            trace_id: 'trace_bootstrap_same_as_am',
            session_patch: {},
          }),
        );
      }
      if (path === '/v1/analysis/skin') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_analysis_same_as_am',
            trace_id: 'trace_analysis_same_as_am',
            session_patch: {},
          }),
        );
      }
      return Promise.resolve(makeEnvelope());
    });

    render(
      <MemoryRouter initialEntries={['/chat?open=routine']}>
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Add your AM\/PM products/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/CeraVe Foaming Cleanser/i), {
      target: { value: 'Biotherm Force Cleanser' },
    });
    fireEvent.change(screen.getByPlaceholderText(/niacinamide \/ vitamin C \/ none/i), {
      target: { value: 'SkinCeuticals C E Ferulic' },
    });
    fireEvent.change(screen.getByPlaceholderText(/CeraVe PM \/ none/i), {
      target: { value: 'Biotherm Aquasource Hydra Barrier Cream' },
    });

    fireEvent.click(screen.getByRole('tab', { name: /Evening \(PM\)/i }));
    fireEvent.click(screen.getByRole('button', { name: /Same as AM/i }));

    const pmCleanser = screen.getByPlaceholderText(/same as AM \/ or different/i) as HTMLInputElement;
    const pmTreatment = screen.getByPlaceholderText(/retinol \/ AHA\/BHA \/ none/i) as HTMLInputElement;
    const pmMoisturizer = screen.getByPlaceholderText(/CeraVe PM \/ none/i) as HTMLInputElement;

    expect(pmCleanser.value).toBe('Biotherm Force Cleanser');
    expect(pmTreatment.value).toBe('SkinCeuticals C E Ferulic');
    expect(pmMoisturizer.value).toBe('Biotherm Aquasource Hydra Barrier Cream');

    fireEvent.click(screen.getByRole('button', { name: /Save & analyze/i }));

    await waitFor(() => {
      const calls = mock.mock.calls.filter((call) => call[0] === '/v1/analysis/skin');
      expect(calls).toHaveLength(1);
    });

    const analysisCall = mock.mock.calls.find((call) => call[0] === '/v1/analysis/skin');
    expect(analysisCall).toBeTruthy();
    const bodyRaw = String((analysisCall?.[2] as RequestInit | undefined)?.body || '{}');
    const body = JSON.parse(bodyRaw) as Record<string, any>;
    const routine = (body.currentRoutine || {}) as Record<string, any>;
    const amSteps = Array.isArray(routine.am) ? routine.am : [];
    const pmSteps = Array.isArray(routine.pm) ? routine.pm : [];
    const pickStep = (steps: Array<Record<string, any>>, step: string) =>
      String(steps.find((entry) => String(entry.step || '').trim() === step)?.product || '');

    expect(pickStep(amSteps, 'cleanser')).toBe('Biotherm Force Cleanser');
    expect(pickStep(amSteps, 'treatment')).toBe('SkinCeuticals C E Ferulic');
    expect(pickStep(amSteps, 'moisturizer')).toBe('Biotherm Aquasource Hydra Barrier Cream');
    expect(pickStep(pmSteps, 'cleanser')).toBe('Biotherm Force Cleanser');
    expect(pickStep(pmSteps, 'treatment')).toBe('SkinCeuticals C E Ferulic');
    expect(pickStep(pmSteps, 'moisturizer')).toBe('Biotherm Aquasource Hydra Barrier Cream');
  });

  it('renders routine preview after skin analysis and only deep-scans after explicit click', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_bootstrap_preview',
            trace_id: 'trace_bootstrap_preview',
            session_patch: {},
          }),
        );
      }
      if (path === '/v1/analysis/skin') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_analysis_preview',
            trace_id: 'trace_analysis_preview',
            cards: [
              {
                card_id: 'analysis_preview_card',
                type: 'analysis_summary',
                payload: {
                  analysis: {
                    features: [{ observation: 'Barrier looks stressed', confidence: 'somewhat_sure' }],
                    strategy: 'Keep it simple for 7 days.',
                    needs_risk_check: false,
                  },
                  low_confidence: false,
                  photos_provided: false,
                  photo_qc: [],
                  used_photos: false,
                  analysis_source: 'rule_based',
                },
              },
              {
                card_id: 'routine_preview_card',
                type: 'routine_products_preview',
                payload: {
                  contract: 'aurora.routine_products_preview.v1',
                  groups: [
                    {
                      slot: 'am',
                      title: 'AM routine',
                      items: [
                        {
                          item_id: 'routine_preview_1',
                          slot: 'am',
                          step: 'cleanser',
                          step_label: 'Cleanser',
                          display_name: 'Biotherm Force Cleanser',
                          product_text: 'Biotherm Force Cleanser',
                          product_url: 'https://example.com/biotherm-force-cleanser',
                          analysis_input: 'https://example.com/biotherm-force-cleanser',
                        },
                      ],
                    },
                  ],
                },
              },
            ],
            session_patch: {},
          }),
        );
      }
      if (path === '/v1/product/parse') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_product_parse_preview',
            trace_id: 'trace_product_parse_preview',
            cards: [
              {
                card_id: 'parse_card_preview',
                type: 'product_parse',
                payload: {
                  product: {
                    display_name: 'Biotherm Force Cleanser',
                    name: 'Biotherm Force Cleanser',
                    url: 'https://example.com/biotherm-force-cleanser',
                  },
                  confidence: 0.88,
                  parse_source: 'heuristic_url',
                },
              },
            ],
          }),
        );
      }
      if (path === '/v1/product/analyze') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_product_analyze_preview',
            trace_id: 'trace_product_analyze_preview',
            cards: [],
          }),
        );
      }
      return Promise.resolve(makeEnvelope());
    });

    render(
      <MemoryRouter initialEntries={['/chat?open=routine']}>
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Add your AM\/PM products/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/CeraVe Foaming Cleanser/i), {
      target: { value: 'Biotherm Force Cleanser' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Save & analyze/i }));

    const previewButton = await screen.findByRole('button', { name: /Analyze this product/i });
    expect(previewButton).toBeInTheDocument();

    expect(mock.mock.calls.filter((call) => call[0] === '/v1/product/parse')).toHaveLength(0);
    expect(mock.mock.calls.filter((call) => call[0] === '/v1/product/analyze')).toHaveLength(0);

    fireEvent.click(previewButton);

    await waitFor(() => {
      expect(mock.mock.calls.filter((call) => call[0] === '/v1/product/parse')).toHaveLength(1);
      expect(mock.mock.calls.filter((call) => call[0] === '/v1/product/analyze')).toHaveLength(1);
    });
  });

  it('retries skin analysis once after a transient network failure', async () => {
    const mock = vi.mocked(bffJson);
    let analysisAttempts = 0;

    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_bootstrap_retry',
            trace_id: 'trace_bootstrap_retry',
            session_patch: {},
          }),
        );
      }
      if (path === '/v1/analysis/skin') {
        analysisAttempts += 1;
        if (analysisAttempts === 1) {
          return Promise.reject(new TypeError('Failed to fetch'));
        }
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_analysis_retry',
            trace_id: 'trace_analysis_retry',
            session_patch: {},
          }),
        );
      }
      return Promise.resolve(makeEnvelope());
    });

    render(
      <MemoryRouter initialEntries={['/chat?open=routine']}>
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Add your AM\/PM products/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/CeraVe Foaming Cleanser/i), {
      target: { value: 'Biotherm Force Cleanser' },
    });

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    vi.useFakeTimers();

    fireEvent.click(screen.getByRole('button', { name: /Save & analyze/i }));

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1500);
      await Promise.resolve();
    });

    const calls = mock.mock.calls.filter((call) => call[0] === '/v1/analysis/skin');
    expect(calls).toHaveLength(2);

    expect(screen.queryByText(/Failed to fetch/i)).not.toBeInTheDocument();

    randomSpy.mockRestore();
  });

  it('keeps routine form editable while a normal chat request is timing out', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_bootstrap',
            trace_id: 'trace_bootstrap',
            session_patch: {},
          }),
        );
      }
      if (path === '/v1/chat') {
        return new Promise((_resolve, reject) => {
          setTimeout(() => {
            reject(new TimeoutError(CHAT_TIMEOUT_MS));
          }, CHAT_TIMEOUT_MS + 10);
        });
      }
      return Promise.resolve(makeEnvelope());
    });

    render(
      <MemoryRouter initialEntries={['/chat?open=routine']}>
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Add your AM\/PM products/i)).toBeInTheDocument();
    });

    const cleanserInput = screen.getByPlaceholderText(/CeraVe Foaming Cleanser/i);
    expect(cleanserInput).not.toBeDisabled();

    vi.useFakeTimers();

    const input = screen.getByPlaceholderText(/ask a question/i);
    fireEvent.change(input, { target: { value: 'Is this routine okay?' } });
    const form = input.closest('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);

    expect(cleanserInput).not.toBeDisabled();
    fireEvent.change(cleanserInput, { target: { value: 'Biotherm cleanser' } });
    expect((cleanserInput as HTMLInputElement).value).toBe('Biotherm cleanser');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CHAT_TIMEOUT_MS + 20);
    });

    expect(screen.getByText(/Request timed out/i)).toBeInTheDocument();
    expect(cleanserInput).not.toBeDisabled();
  });
});
