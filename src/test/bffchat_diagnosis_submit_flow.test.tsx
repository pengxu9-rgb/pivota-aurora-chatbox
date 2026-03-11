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
    request_id: args?.request_id ?? 'req_1',
    trace_id: args?.trace_id ?? 'trace_1',
    assistant_message: args?.assistant_message ?? null,
    suggested_chips: args?.suggested_chips ?? [],
    cards: args?.cards ?? [],
    session_patch: args?.session_patch ?? {},
    events: args?.events ?? [],
  };
}

function renderChat(initialEntry = '/chat') {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ShopProvider>
        <BffChat />
      </ShopProvider>
    </MemoryRouter>,
  );
}

function parseBody(call: unknown[]): Record<string, any> {
  return JSON.parse(String(((call[2] as RequestInit | undefined)?.body || '{}'))) as Record<string, any>;
}

describe('BffChat diagnosis submit flow', () => {
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

  it('routes explicit chip.start.diagnosis through backend diagnosis_v2.start and submits goals back through thread_state', async () => {
    const mock = vi.mocked(bffJson);
    let chatTurn = 0;

    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope());
      }
      if (path === '/v1/chat') {
        chatTurn += 1;
        if (chatTurn === 1) {
          return Promise.resolve({
            cards: [
              {
                card_type: 'diagnosis_gate',
                sections: [
                  {
                    type: 'goal_selection',
                    options: [
                      { id: 'hydration', label_en: 'Deep hydration', label_zh: '深层补水' },
                      { id: 'barrier', label_en: 'Repair skin barrier', label_zh: '修护屏障' },
                    ],
                  },
                  {
                    type: 'follow_up_questions',
                    questions: [
                      {
                        id: 'q1',
                        question: 'How sensitive does your skin feel lately?',
                        options: [
                          { id: 'low', label: 'Low' },
                          { id: 'high', label: 'High' },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
            ops: {
              thread_ops: [{ op: 'set', key: 'diagnosis_state', value: 'goal_selection' }],
              profile_patch: {},
              routine_patch: {},
              experiment_events: [],
            },
            next_actions: [],
          });
        }

        return Promise.resolve({
          cards: [
            {
              card_type: 'skin_status',
              sections: [
                {
                  type: 'skin_status_structured',
                  skin_type: 'combination',
                  primary_concerns: ['dehydration'],
                  severity_scores: {},
                  confidence: 0.7,
                },
              ],
            },
          ],
          ops: {
            thread_ops: [
              { op: 'set', key: 'blueprint_id', value: 'bp_diag_1' },
              { op: 'set', key: 'diagnosis_state', value: 'completed' },
            ],
            profile_patch: { skin_type: 'combination', primary_concerns: ['dehydration'], goals: ['hydration'] },
            routine_patch: {},
            experiment_events: [],
          },
          next_actions: [
            {
              action_type: 'navigate_skill',
              target_skill_id: 'routine.apply_blueprint',
              label: { en: 'Build my routine', zh: '生成我的护肤流程' },
            },
          ],
        });
      }
      return Promise.resolve(makeEnvelope());
    });

    renderChat('/chat?chip_id=chip.start.diagnosis');

    await screen.findByRole('button', { name: 'Deep hydration' });
    expect(screen.queryByRole('button', { name: 'Combination' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Deep hydration' }));
    fireEvent.click(screen.getByRole('radio', { name: 'High' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Analysis' }));

    await screen.findByRole('button', { name: 'Build my routine' });

    const chatCalls = mock.mock.calls.filter(([path]) => path === '/v1/chat');
    expect(chatCalls).toHaveLength(2);

    const firstBody = parseBody(chatCalls[0] as unknown[]);
    const secondBody = parseBody(chatCalls[1] as unknown[]);

    expect(firstBody.action?.action_id).toBe('chip.start.diagnosis');
    expect(firstBody.thread_state).toBeUndefined();
    expect(secondBody.action?.action_id).toBe('chip.start.diagnosis');
    expect(secondBody.thread_state).toMatchObject({
      diagnosis_state: 'goals_selected',
      diagnosis_goals: ['hydration'],
      diagnosis_followup_answers: { q1: 'high' },
    });
    const analysisCalls = mock.mock.calls.filter(([path]) => path === '/v1/analysis/skin');
    expect(analysisCalls).toHaveLength(0);
  });

  it('persists V2 thread_state so diagnosis follow-up chips carry blueprint_id', async () => {
    const mock = vi.mocked(bffJson);
    let chatTurn = 0;

    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope());
      }
      if (path === '/v1/chat') {
        chatTurn += 1;
        if (chatTurn === 1) {
          return Promise.resolve({
            cards: [
              {
                card_type: 'diagnosis_gate',
                sections: [
                  {
                    type: 'goal_selection',
                    options: [{ id: 'hydration', label_en: 'Deep hydration', label_zh: '深层补水' }],
                  },
                ],
              },
            ],
            ops: {
              thread_ops: [{ op: 'set', key: 'diagnosis_state', value: 'goal_selection' }],
              profile_patch: {},
              routine_patch: {},
              experiment_events: [],
            },
            next_actions: [],
          });
        }
        if (chatTurn === 2) {
          return Promise.resolve({
            cards: [
              {
                card_type: 'skin_status',
                sections: [
                  {
                    type: 'skin_status_structured',
                    skin_type: 'combination',
                    primary_concerns: ['dehydration'],
                    severity_scores: {},
                    confidence: 0.7,
                  },
                ],
              },
            ],
            ops: {
              thread_ops: [
                { op: 'set', key: 'blueprint_id', value: 'bp_diag_2' },
                { op: 'set', key: 'diagnosis_state', value: 'completed' },
              ],
              profile_patch: {},
              routine_patch: {},
              experiment_events: [],
            },
            next_actions: [
              {
                action_type: 'navigate_skill',
                target_skill_id: 'routine.apply_blueprint',
                label: { en: 'Build my routine', zh: '生成我的护肤流程' },
              },
            ],
          });
        }
        return Promise.resolve({
          cards: [],
          ops: { thread_ops: [], profile_patch: {}, routine_patch: {}, experiment_events: [] },
          next_actions: [],
        });
      }
      return Promise.resolve(makeEnvelope());
    });

    renderChat('/chat?chip_id=chip.start.diagnosis');

    await screen.findByRole('button', { name: 'Deep hydration' });
    fireEvent.click(screen.getByRole('button', { name: 'Deep hydration' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Analysis' }));

    const routineChip = await screen.findByRole('button', { name: 'Build my routine' });
    fireEvent.click(routineChip);

    await waitFor(() => {
      const chatCalls = mock.mock.calls.filter(([path]) => path === '/v1/chat');
      expect(chatCalls).toHaveLength(3);
    });

    const thirdBody = parseBody(mock.mock.calls.filter(([path]) => path === '/v1/chat')[2] as unknown[]);
    expect(thirdBody.action?.action_id).toBe('chip.start.routine');
    expect(thirdBody.thread_state).toMatchObject({
      blueprint_id: 'bp_diag_2',
      diagnosis_state: 'completed',
      diagnosis_goals: ['hydration'],
    });
  });
});
