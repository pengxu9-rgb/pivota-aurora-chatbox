import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

import BffChat from '@/pages/BffChat';
import { ShopProvider } from '@/contexts/shop';
import { toast } from '@/components/ui/use-toast';
import { bffJson } from '@/lib/pivotaAgentBff';
import type { Card, V1Envelope } from '@/lib/pivotaAgentBff';

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

function makeIngredientReportCard(): Card {
  return {
    card_id: 'ingredient_report_palmitoyl_tripeptide_38',
    type: 'aurora_ingredient_report',
    payload: {
      schema_version: 'aurora.ingredient_report.v1',
      locale: 'en-US',
      ingredient: {
        inci: 'Palmitoyl Tripeptide-38',
        display_name: 'Palmitoyl Tripeptide-38',
        aliases: [],
        category: 'peptide',
      },
      verdict: {
        one_liner: 'Conservative peptide anti-aging direction; results vary by formulation.',
        top_benefits: ['fine-lines', 'firmness', 'texture'],
        evidence_grade: 'unknown',
        irritation_risk: 'low',
        time_to_results: 'unknown',
        confidence: 0.45,
      },
      benefits: [
        {
          concern: 'fine-lines',
          strength: 2,
          what_it_means: 'May help mild lines; outcomes vary by formula and concentration.',
        },
      ],
      how_to_use: {
        frequency: 'daily',
        routine_step: 'serum',
        pair_well: ['niacinamide'],
        consider_separating: ['strong_acids'],
        notes: [],
      },
      watchouts: [
        {
          issue: 'irritation',
          likelihood: 'uncommon',
          what_to_do: 'Reduce frequency if persistent irritation appears.',
        },
      ],
      use_cases: [
        {
          title: 'Gentle anti-aging',
          who_for: 'Users preferring lower-irritation options.',
          routine_tip: 'Start with once daily and monitor tolerance.',
          products_from_kb: ['pid_1'],
        },
      ],
      evidence: {
        summary: 'Category-level peptide evidence; ingredient-specific high-quality human data is limited.',
        citations: [],
        show_citations_by_default: false,
      },
      next_questions: [
        {
          id: 'goal',
          label: 'What is your top goal?',
          chips: ['Fine lines/firmness', 'Sensitive repair', 'Acne', 'Brightening'],
        },
        {
          id: 'sensitivity',
          label: 'How sensitive is your skin?',
          chips: ['Sensitive', 'Normal', 'Resilient'],
        },
      ],
    },
  };
}

function setupBffMock(args?: {
  bootstrapProfile?: Record<string, unknown> | null;
  onProfileUpdate?: (init?: RequestInit) => Promise<unknown> | unknown;
}) {
  const mock = vi.mocked(bffJson);

  mock.mockImplementation((path: string, _headers: unknown, init?: RequestInit) => {
    if (path === '/v1/session/bootstrap') {
      const profile = args?.bootstrapProfile;
      return Promise.resolve(
        makeEnvelope({
          request_id: 'req_bootstrap',
          trace_id: 'trace_bootstrap',
          session_patch: profile ? { profile } : {},
        }),
      );
    }

    if (path === '/v1/chat') {
      return Promise.resolve(
        makeEnvelope({
          request_id: 'req_chat',
          trace_id: 'trace_chat',
          assistant_message: {
            role: 'assistant',
            format: 'markdown',
            content: 'I put this ingredient into a 1-minute report below.',
          },
          cards: [makeIngredientReportCard()],
        }),
      );
    }

    if (path === '/v1/profile/update') {
      if (args?.onProfileUpdate) {
        return Promise.resolve(args.onProfileUpdate(init));
      }
      return Promise.resolve(makeEnvelope({ request_id: 'req_update', trace_id: 'trace_update' }));
    }

    return Promise.resolve(makeEnvelope());
  });
}

async function renderChatAndOpenIngredientCard() {
  render(
    <MemoryRouter initialEntries={['/chat']}>
      <ShopProvider>
        <BffChat />
      </ShopProvider>
    </MemoryRouter>,
  );

  await waitFor(() => {
    const bootstrapCalls = vi.mocked(bffJson).mock.calls.filter((call) => call[0] === '/v1/session/bootstrap');
    expect(bootstrapCalls.length).toBeGreaterThan(0);
  });

  const input = screen.getByPlaceholderText(/ask a question/i);
  fireEvent.change(input, { target: { value: 'Analyze Palmitoyl Tripeptide-38' } });
  const form = input.closest('form');
  expect(form).toBeTruthy();
  fireEvent.submit(form as HTMLFormElement);

  await screen.findByText('Palmitoyl Tripeptide-38');
}

function getProfileUpdateBodyFromLatestCall(): Record<string, unknown> {
  const calls = vi
    .mocked(bffJson)
    .mock.calls.filter((call) => call[0] === '/v1/profile/update');
  const latest = calls[calls.length - 1];
  expect(latest).toBeTruthy();
  const init = latest?.[2] as RequestInit | undefined;
  const bodyRaw = typeof init?.body === 'string' ? init.body : '{}';
  return JSON.parse(bodyRaw);
}

describe('BffChat ingredient next-questions flow', () => {
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

  it('Case A: clicking goal chip posts mapped goals payload', async () => {
    setupBffMock();
    await renderChatAndOpenIngredientCard();

    fireEvent.click(screen.getByRole('button', { name: 'Fine lines/firmness' }));

    await waitFor(() => {
      const calls = vi.mocked(bffJson).mock.calls.filter((call) => call[0] === '/v1/profile/update');
      expect(calls.length).toBe(1);
    });

    const body = getProfileUpdateBodyFromLatestCall();
    expect(body.goals).toEqual(['wrinkles']);
  });

  it('Case B: clicking sensitivity chip posts low|medium|high mapping', async () => {
    setupBffMock();
    await renderChatAndOpenIngredientCard();

    fireEvent.click(screen.getByRole('button', { name: 'Sensitive' }));

    await waitFor(() => {
      const calls = vi.mocked(bffJson).mock.calls.filter((call) => call[0] === '/v1/profile/update');
      expect(calls.length).toBe(1);
    });

    const body = getProfileUpdateBodyFromLatestCall();
    expect(body.sensitivity).toBe('high');
  });

  it('Case C: when goals + sensitivity are complete, Next questions are hidden', async () => {
    setupBffMock({
      bootstrapProfile: {
        goals: ['acne'],
        sensitivity: 'medium',
      },
    });
    await renderChatAndOpenIngredientCard();

    expect(screen.queryByText('Next questions')).not.toBeInTheDocument();
    expect(screen.getByText(/Saved your goal and sensitivity/i)).toBeInTheDocument();
  });

  it('Case D: when only sensitivity is missing, only sensitivity question is rendered', async () => {
    setupBffMock({
      bootstrapProfile: {
        goals: ['acne'],
      },
    });
    await renderChatAndOpenIngredientCard();

    expect(screen.getByText('Next questions')).toBeInTheDocument();
    expect(screen.queryByText('What is your top goal?')).not.toBeInTheDocument();
    expect(screen.getByText('How sensitive is your skin?')).toBeInTheDocument();
  });

  it('Case E: timeout/failure releases busy state, rolls back optimistic state, and shows error toast', async () => {
    setupBffMock({
      onProfileUpdate: (init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          const signal = (init?.signal as AbortSignal | undefined) ?? undefined;
          const abortError = Object.assign(new Error('Aborted'), { name: 'AbortError' });
          if (!signal) {
            reject(abortError);
            return;
          }
          if (signal.aborted) {
            reject(abortError);
            return;
          }
          signal.addEventListener(
            'abort',
            () => {
              reject(abortError);
            },
            { once: true },
          );
        }),
    });

    await renderChatAndOpenIngredientCard();
    vi.useFakeTimers();

    const goalQuestionLabel = 'What is your top goal?';
    const sensitivityButtonLabel = 'Sensitive';

    try {
      fireEvent.click(screen.getByRole('button', { name: 'Fine lines/firmness' }));

      expect(screen.queryByText(goalQuestionLabel)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: sensitivityButtonLabel })).toBeDisabled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(4100);
      });

      expect(vi.mocked(toast)).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Save failed',
          description: 'Save timed out/failed. Please retry; profile was not updated.',
        }),
      );

      expect(screen.getByText(goalQuestionLabel)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: sensitivityButtonLabel })).not.toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });
});
