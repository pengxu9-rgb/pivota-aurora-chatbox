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

function makeDiagnosisGateResponse() {
  return {
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

  it('loads the diagnosis goals gate from the backend on chip.start.diagnosis', async () => {
    const mock = vi.mocked(bffJson);

    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') return Promise.resolve(makeEnvelope());
      if (path === '/v1/chat') return Promise.resolve(makeDiagnosisGateResponse() as any);
      return Promise.resolve(makeEnvelope());
    });

    renderChat('/chat?chip_id=chip.start.diagnosis');

    await screen.findByRole('button', { name: 'Deep hydration' });

    const chatCalls = mock.mock.calls.filter(([path]) => path === '/v1/chat');
    expect(chatCalls).toHaveLength(1);
    expect(screen.queryByText('empty_state')).not.toBeInTheDocument();
  });

  it('opens the local photo prompt after goals are selected instead of sending another /v1/chat turn', async () => {
    const mock = vi.mocked(bffJson);

    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') return Promise.resolve(makeEnvelope());
      if (path === '/v1/chat') return Promise.resolve(makeDiagnosisGateResponse() as any);
      return Promise.resolve(makeEnvelope());
    });

    renderChat('/chat?chip_id=chip.start.diagnosis');

    await screen.findByRole('button', { name: 'Deep hydration' });
    fireEvent.click(screen.getByRole('button', { name: 'Deep hydration' }));
    fireEvent.click(screen.getByRole('radio', { name: 'High' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Analysis' }));

    await screen.findByRole('button', { name: 'Take a selfie for better analysis' });
    expect(screen.getByRole('button', { name: 'Skip and continue' })).toBeInTheDocument();

    const chatCalls = mock.mock.calls.filter(([path]) => path === '/v1/chat');
    expect(chatCalls).toHaveLength(1);
  });

  it('enters the photo uploader when the user chooses to take a photo', async () => {
    const mock = vi.mocked(bffJson);

    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') return Promise.resolve(makeEnvelope());
      if (path === '/v1/chat') return Promise.resolve(makeDiagnosisGateResponse() as any);
      return Promise.resolve(makeEnvelope());
    });

    renderChat('/chat?chip_id=chip.start.diagnosis');

    await screen.findByRole('button', { name: 'Deep hydration' });
    fireEvent.click(screen.getByRole('button', { name: 'Deep hydration' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Analysis' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Take a selfie for better analysis' }));

    await screen.findByRole('button', { name: 'Skip photos' });
    const chatCalls = mock.mock.calls.filter(([path]) => path === '/v1/chat');
    expect(chatCalls).toHaveLength(1);
  });

  it('runs low-confidence analysis when the user skips the photo step', async () => {
    const mock = vi.mocked(bffJson);

    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') return Promise.resolve(makeEnvelope());
      if (path === '/v1/chat') return Promise.resolve(makeDiagnosisGateResponse() as any);
      if (path === '/v1/analysis/skin') return Promise.resolve(makeEnvelope());
      return Promise.resolve(makeEnvelope());
    });

    renderChat('/chat?chip_id=chip.start.diagnosis');

    await screen.findByRole('button', { name: 'Deep hydration' });
    fireEvent.click(screen.getByRole('button', { name: 'Deep hydration' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Analysis' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Skip and continue' }));

    await waitFor(() => {
      const analysisCalls = mock.mock.calls.filter(([path]) => path === '/v1/analysis/skin');
      expect(analysisCalls).toHaveLength(1);
    });

    const chatCalls = mock.mock.calls.filter(([path]) => path === '/v1/chat');
    expect(chatCalls).toHaveLength(1);
  });
});
