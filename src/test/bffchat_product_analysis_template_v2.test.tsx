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
    emitAuroraProductParseMissing: vi.fn(),
    emitAuroraProductAnalysisDegraded: vi.fn(),
    emitAuroraProductAlternativesFiltered: vi.fn(),
    emitAuroraHowToLayerInlineOpened: vi.fn(),
  };
});

import BffChat from '@/pages/BffChat';
import { ShopProvider } from '@/contexts/shop';
import { bffJson } from '@/lib/pivotaAgentBff';
import type { V1Envelope } from '@/lib/pivotaAgentBff';
import type { ChatResponseV1 } from '@/lib/chatCardsTypes';

function makeEnvelope(args?: Partial<V1Envelope>): V1Envelope {
  return {
    request_id: args?.request_id ?? 'req_v2',
    trace_id: args?.trace_id ?? 'trace_v2',
    assistant_message: args?.assistant_message ?? null,
    suggested_chips: args?.suggested_chips ?? [],
    cards: args?.cards ?? [],
    session_patch: args?.session_patch ?? {},
    events: args?.events ?? [],
  };
}

function makeV1Response(args?: Partial<ChatResponseV1>): ChatResponseV1 {
  return {
    version: '1.0',
    request_id: args?.request_id ?? 'req_chat_v1',
    trace_id: args?.trace_id ?? 'trace_chat_v1',
    assistant_text: args?.assistant_text ?? 'Here is a v1 response.',
    cards: args?.cards ?? [],
    follow_up_questions: args?.follow_up_questions ?? [],
    suggested_quick_replies: args?.suggested_quick_replies ?? [],
    ops: args?.ops ?? {
      thread_ops: [],
      profile_patch: [],
      routine_patch: [],
      experiment_events: [],
    },
    safety: args?.safety ?? {
      risk_level: 'none',
      red_flags: [],
      disclaimer: '',
    },
    telemetry: args?.telemetry ?? {
      intent: 'unknown',
      intent_confidence: 0.4,
      entities: [],
    },
  };
}

function makeProductVerdictResponse({
  requestId = 'req_product_verdict',
  traceId = 'trace_product_verdict',
  sections,
  title = 'Product verdict',
}: {
  requestId?: string;
  traceId?: string;
  sections: Array<Record<string, unknown>>;
  title?: string;
}): ChatResponseV1 {
  return makeV1Response({
    request_id: requestId,
    trace_id: traceId,
    assistant_text: 'Product verdict is ready.',
    cards: [
      {
        id: 'product_verdict_card',
        type: 'product_verdict',
        priority: 1,
        title,
        tags: ['fit'],
        sections,
        actions: [],
      },
    ],
  });
}

const READY_TIMEOUT_MS = 5000;

async function waitForEnabledButton(name: string | RegExp) {
  const button = await screen.findByRole('button', { name });
  await waitFor(() => expect(button).not.toBeDisabled(), { timeout: READY_TIMEOUT_MS });
  return button;
}

async function waitForEnabledInput(placeholder: string | RegExp) {
  const input = await screen.findByPlaceholderText(placeholder);
  await waitFor(() => expect(input).not.toBeDisabled(), { timeout: READY_TIMEOUT_MS });
  return input;
}

async function openProductEvaluateSheet() {
  const entry = await waitForEnabledButton(/evaluate a product/i);
  fireEvent.click(entry);
  return waitForEnabledInput(/nivea creme/i);
}

async function clickAnalyzeButton() {
  await waitFor(() => expect(screen.getByRole('button', { name: /^analyze$/i })).not.toBeDisabled(), { timeout: READY_TIMEOUT_MS });
  fireEvent.click(screen.getByRole('button', { name: /^analyze$/i }));
}

async function submitComposerPrompt(value: string) {
  const input = await waitForEnabledInput(/ask a question/i);
  fireEvent.change(input, { target: { value } });
  fireEvent.submit(input.closest('form') as HTMLFormElement);
}

async function analyzeProduct(value: string) {
  const productInput = await openProductEvaluateSheet();
  fireEvent.change(productInput, { target: { value } });
  await clickAnalyzeButton();
}

function expectMainlineOnlyRouting(mock: ReturnType<typeof vi.mocked<typeof bffJson>>) {
  expect(mock.mock.calls.some((call) => call[0] === '/v1/chat')).toBe(true);
  expect(mock.mock.calls.some((call) => call[0] === '/v1/product/parse')).toBe(false);
  expect(mock.mock.calls.some((call) => call[0] === '/v1/product/analyze')).toBe(false);
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

describe('BffChat product verdict mainline rendering', () => {
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

  it('renders rich product verdict with skin-profile fit, usage guidance, and a budget alternative', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap_fit', trace_id: 'trace_bootstrap_fit' }));
      }
      if (path === '/v1/chat') {
        return Promise.resolve(
          makeProductVerdictResponse({
            requestId: 'req_chat_fit',
            traceId: 'trace_chat_fit',
            sections: [
              {
                kind: 'product_verdict_structured',
                verdict: 'Suitable',
                product_name: 'Defense Lotion SPF 35',
                brand: 'Lab Series',
                suitability: 'good',
                match_score: 82,
                beneficial_ingredients: ['Niacinamide', 'Panthenol'],
                caution_ingredients: ['Fragrance'],
                mechanisms: ['Lightweight hydration support', 'Daily oil control'],
                usage: {
                  timing: 'AM',
                  notes: ['Use as the last step before sun exposure.'],
                },
                skin_profile_match: {
                  skin_type: 'oily',
                  matched_concerns: ['oil_control', 'daily_spf'],
                  unmatched_concerns: ['barrier'],
                },
                dupe_recommendation: {
                  name: 'Defense Moisturizer',
                  brand: 'Demo',
                  reason: 'Lower-cost option for everyday wear.',
                  savingsPercent: 25,
                },
              },
              {
                kind: 'bullets',
                title: 'Why this fits',
                items: ['Lightweight lotion texture suits oily skin.'],
              },
            ],
          }),
        );
      }
      return Promise.resolve(makeEnvelope());
    });

    renderChat();
    await analyzeProduct('Lab Series Defense Lotion SPF 35');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /defense lotion spf 35/i })).toBeInTheDocument();
    });

    expectMainlineOnlyRouting(mock);
    expect(screen.getByText(/^lab series$/i)).toBeInTheDocument();
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText(/good match/i)).toBeInTheDocument();
    expect(screen.getByText(/matched to your oily skin profile/i)).toBeInTheDocument();
    expect(screen.getByText(/oil control/i)).toBeInTheDocument();
    expect(screen.getByText(/does not address/i)).toBeInTheDocument();
    expect(screen.getByText(/dehydration/i)).toBeInTheDocument();
    expect(screen.getByText(/morning use/i)).toBeInTheDocument();
    expect(screen.getByText(/use as the last step before sun exposure/i)).toBeInTheDocument();
    expect(screen.getByText(/niacinamide/i)).toBeInTheDocument();
    expect(screen.getByText(/fragrance/i)).toBeInTheDocument();
    expect(screen.getByText(/budget alternative/i)).toBeInTheDocument();
    expect(screen.getByText(/save 25%/i)).toBeInTheDocument();
    expect(screen.getByText(/defense moisturizer/i)).toBeInTheDocument();
  });

  it('falls back to watchout checklist items when structured caution ingredients are missing', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap_watchouts', trace_id: 'trace_bootstrap_watchouts' }));
      }
      if (path === '/v1/chat') {
        return Promise.resolve(
          makeProductVerdictResponse({
            requestId: 'req_chat_watchouts',
            traceId: 'trace_chat_watchouts',
            sections: [
              {
                kind: 'product_verdict_structured',
                verdict: 'Suitable',
                product_name: 'Barrier Gel SPF',
                brand: 'Demo',
                suitability: 'good',
                match_score: 79,
                beneficial_ingredients: ['Panthenol'],
                caution_ingredients: [],
                mechanisms: ['Barrier support'],
                usage: {
                  timing: 'AM',
                  notes: ['Apply before sun exposure.'],
                },
              },
              {
                kind: 'checklist',
                title: 'Watchouts',
                items: ['Essential oils may sting compromised skin.'],
              },
            ],
          }),
        );
      }
      return Promise.resolve(makeEnvelope());
    });

    renderChat();
    await analyzeProduct('Barrier Gel SPF');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /barrier gel spf/i })).toBeInTheDocument();
    });

    expectMainlineOnlyRouting(mock);
    expect(screen.getByText(/caution/i)).toBeInTheDocument();
    expect(screen.getByText(/essential oils may sting compromised skin/i)).toBeInTheDocument();
  });

  it('normalizes verdict text and PM timing when structured suitability is absent', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap_pm', trace_id: 'trace_bootstrap_pm' }));
      }
      if (path === '/v1/chat') {
        return Promise.resolve(
          makeProductVerdictResponse({
            requestId: 'req_chat_pm',
            traceId: 'trace_chat_pm',
            sections: [
              {
                kind: 'product_verdict_structured',
                verdict: 'Caution',
                product_name: 'Night Peel Serum',
                brand: 'Demo',
                beneficial_ingredients: ['Lactic Acid'],
                caution_ingredients: ['Do not layer with retinoids'],
                mechanisms: ['Resurfacing support'],
                usage: {
                  timing: 'PM only',
                  notes: ['Use on alternate nights only.'],
                },
              },
            ],
          }),
        );
      }
      return Promise.resolve(makeEnvelope());
    });

    renderChat();
    await analyzeProduct('Night Peel Serum');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /night peel serum/i })).toBeInTheDocument();
    });

    expectMainlineOnlyRouting(mock);
    expect(screen.getByText(/use with caution/i)).toBeInTheDocument();
    expect(screen.getByText('68')).toBeInTheDocument();
    expect(screen.getByText(/evening use/i)).toBeInTheDocument();
    expect(screen.getByText(/use on alternate nights only/i)).toBeInTheDocument();
  });

  it('defaults to morning and evening usage when timing is omitted', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap_both', trace_id: 'trace_bootstrap_both' }));
      }
      if (path === '/v1/chat') {
        return Promise.resolve(
          makeProductVerdictResponse({
            requestId: 'req_chat_both',
            traceId: 'trace_chat_both',
            sections: [
              {
                kind: 'product_verdict_structured',
                verdict: 'Suitable',
                product_name: 'Hydration Gel',
                brand: 'Demo',
                suitability: 'good',
                match_score: 78,
                beneficial_ingredients: ['Sodium Hyaluronate'],
                caution_ingredients: [],
                mechanisms: ['Hydration support'],
                usage: {
                  notes: ['Use after cleansing and before moisturizer.'],
                },
              },
            ],
          }),
        );
      }
      return Promise.resolve(makeEnvelope());
    });

    renderChat();
    await analyzeProduct('Hydration Gel');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /hydration gel/i })).toBeInTheDocument();
    });

    expectMainlineOnlyRouting(mock);
    expect(screen.getByText(/morning & evening/i)).toBeInTheDocument();
    expect(screen.getByText(/use after cleansing and before moisturizer/i)).toBeInTheDocument();
  });

  it('uses why-this-fits bullets as usage fallback when usage notes are missing', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap_fallback', trace_id: 'trace_bootstrap_fallback' }));
      }
      if (path === '/v1/chat') {
        return Promise.resolve(
          makeProductVerdictResponse({
            requestId: 'req_chat_fallback',
            traceId: 'trace_chat_fallback',
            sections: [
              {
                kind: 'product_verdict_structured',
                verdict: 'Suitable',
                product_name: 'Calming Essence',
                brand: 'Demo',
                suitability: 'good',
                match_score: 81,
                beneficial_ingredients: ['Beta-Glucan'],
                caution_ingredients: [],
                mechanisms: ['Soothing support'],
                usage: {
                  timing: 'PM',
                  notes: [],
                },
              },
              {
                kind: 'bullets',
                title: 'Why this fits',
                items: ['Comforting texture for redness-prone skin on recovery nights.'],
              },
            ],
          }),
        );
      }
      return Promise.resolve(makeEnvelope());
    });

    renderChat();
    await analyzeProduct('Calming Essence');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /calming essence/i })).toBeInTheDocument();
    });

    expectMainlineOnlyRouting(mock);
    expect(screen.getByText(/evening use/i)).toBeInTheDocument();
    expect(screen.getByText(/comforting texture for redness-prone skin on recovery nights/i)).toBeInTheDocument();
  });

  it('keeps product verdict renderable when optional subsection items are malformed', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap_malformed', trace_id: 'trace_bootstrap_malformed' }));
      }
      if (path === '/v1/chat') {
        return Promise.resolve(
          makeProductVerdictResponse({
            requestId: 'req_chat_malformed',
            traceId: 'trace_chat_malformed',
            sections: [
              {
                kind: 'product_verdict_structured',
                verdict: 'Good fit',
                product_name: 'Hydration Gel',
                brand: 'Demo',
                suitability: 'good',
                match_score: 78,
                beneficial_ingredients: ['Key Ingredients', 'Sodium Hyaluronate', null],
                caution_ingredients: [null, 'Patch test first if your barrier is unstable.'],
                mechanisms: ['Supports hydration retention.', null],
                usage: {
                  timing: 'AM/PM',
                  notes: ['After cleansing', null],
                },
              },
              {
                kind: 'bullets',
                title: 'Why this fits',
                items: ['Hydration-first gel texture with some irritation monitoring.', null],
              },
              {
                kind: 'checklist',
                title: 'Watchouts',
                items: [null, 'Patch test first if your barrier is unstable.'],
              },
            ],
          }),
        );
      }
      return Promise.resolve(makeEnvelope());
    });

    renderChat();
    await analyzeProduct('Demo Hydration Gel');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /hydration gel/i })).toBeInTheDocument();
    });

    expectMainlineOnlyRouting(mock);
    expect(screen.getByText(/sodium hyaluronate/i)).toBeInTheDocument();
    expect(screen.queryByText(/^key ingredients$/i)).toBeNull();
    expect(screen.queryByText(/this card failed to render and was safely downgraded/i)).toBeNull();
  });

  it('dupe_compare limited mode shows compact guidance and supports price.amount', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap_dupe', trace_id: 'trace_bootstrap_dupe' }));
      }
      if (path === '/v1/chat') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_dupe_limited',
            trace_id: 'trace_dupe_limited',
            cards: [
              {
                card_id: 'dupe_limited',
                type: 'dupe_compare',
                payload: {
                  original: {
                    brand: 'Lab Series',
                    name: 'All-In-One Defense Lotion',
                    price: { amount: 52, currency: 'USD' },
                  },
                  dupe: {
                    brand: 'Lab Series',
                    name: 'Defense Moisturizer',
                    price: { amount: 39, currency: 'USD' },
                  },
                  similarity: 0.73,
                  compare_quality: 'limited',
                  limited_reason: 'tradeoffs_detail_missing',
                  tradeoffs: ['No tradeoff details were returned (comparison is limited).'],
                },
              },
            ],
          }),
        );
      }
      return Promise.resolve(makeEnvelope());
    });

    renderChat();
    await submitComposerPrompt('compare tradeoffs');

    await screen.findByText(/tradeoff detail is missing/i, {}, { timeout: READY_TIMEOUT_MS });
    expect(screen.queryByText(/more tradeoffs/i)).toBeNull();
    expect(screen.queryAllByText(/price unavailable/i).length).toBe(0);
    expect(screen.getByText(/\$52/i)).toBeInTheDocument();
    expect(screen.getByText(/\$39/i)).toBeInTheDocument();
  });
});
