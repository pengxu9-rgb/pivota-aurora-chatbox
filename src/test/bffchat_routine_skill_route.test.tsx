import React from 'react';
import { render, screen, waitFor, fireEvent } from '@/test/testProviders';
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

function makeEnvelope(args?: Partial<V1Envelope>): V1Envelope {
  return {
    request_id: args?.request_id ?? 'req_bootstrap',
    trace_id: args?.trace_id ?? 'trace_bootstrap',
    assistant_message: args?.assistant_message ?? null,
    suggested_chips: args?.suggested_chips ?? [],
    cards: args?.cards ?? [],
    session_patch: args?.session_patch ?? {},
    events: args?.events ?? [],
  };
}

function makeRoutineSkillResponse(overrides?: Partial<Record<string, unknown>>) {
  return {
    cards: [
      {
        card_type: 'routine',
        sections: [
          {
            type: 'routine_structured',
            routine_id: 'routine_test_1',
            am_steps: [{ step_id: 'am_cleanser', name_en: 'Cleanser', name_zh: '洁面' }],
            pm_steps: [{ step_id: 'pm_moisturizer', name_en: 'Moisturizer', name_zh: '面霜/乳液' }],
            notes_en: 'Start with this framework.',
            notes_zh: '先从这个框架开始。',
          },
        ],
      },
    ],
    ops: {
      thread_ops: [{ op: 'set', key: 'routine_id', value: 'routine_test_1' }],
      profile_patch: {},
      routine_patch: {},
      experiment_events: [],
    },
    next_actions: [
      {
        action_type: 'navigate_skill',
        target_skill_id: 'routine.intake_products',
        label: { en: 'Add my products', zh: '添加我的产品' },
      },
    ],
    ...(overrides ?? {}),
  };
}

describe('Routine builder skill route', () => {
  const originalFlag = import.meta.env.VITE_FF_AURORA_ROUTINE_BUILDER_VIA_SKILL;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    import.meta.env.VITE_FF_AURORA_ROUTINE_BUILDER_VIA_SKILL = 'true';
    if (!HTMLElement.prototype.scrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        value: vi.fn(),
        writable: true,
      });
    }
  });

  afterEach(() => {
    if (typeof originalFlag === 'undefined') {
      delete import.meta.env.VITE_FF_AURORA_ROUTINE_BUILDER_VIA_SKILL;
    } else {
      import.meta.env.VITE_FF_AURORA_ROUTINE_BUILDER_VIA_SKILL = originalFlag;
    }
  });

  it('opens the local routine sheet directly when the routine-builder skill flag is off', async () => {
    import.meta.env.VITE_FF_AURORA_ROUTINE_BUILDER_VIA_SKILL = 'false';
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope());
      }
      if (path === '/v1/chat') {
        return Promise.resolve(makeRoutineSkillResponse());
      }
      return Promise.resolve(makeEnvelope());
    });

    render(
      <MemoryRouter initialEntries={['/chat?chip_id=chip.start.routine']}>
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Add your AM\/PM products/i)).toBeInTheDocument();
    });

    const chatCalls = mock.mock.calls.filter((call) => call[0] === '/v1/chat');
    expect(chatCalls).toHaveLength(0);
  });

  it('routes chip.start.routine through /v1/chat when the routine-builder skill flag is on', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope());
      }
      if (path === '/v1/chat') {
        return Promise.resolve(makeRoutineSkillResponse());
      }
      return Promise.resolve(makeEnvelope());
    });

    render(
      <MemoryRouter initialEntries={['/chat?chip_id=chip.start.routine']}>
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Your Personalized Routine/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Add my products/i)).toBeInTheDocument();
    expect(screen.queryByText(/Add your AM\/PM products/i)).not.toBeInTheDocument();

    const chatCalls = mock.mock.calls.filter((call) => call[0] === '/v1/chat');
    expect(chatCalls).toHaveLength(1);
  });

  it('falls back to the local routine sheet when /v1/chat does not return a routine card', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope());
      }
      if (path === '/v1/chat') {
        return Promise.resolve({
          cards: [
            {
              card_type: 'empty_state',
              sections: [{ type: 'empty_state_message', message_en: 'No blueprint available' }],
            },
          ],
          ops: { thread_ops: [], profile_patch: {}, routine_patch: {}, experiment_events: [] },
          next_actions: [],
        });
      }
      return Promise.resolve(makeEnvelope());
    });

    render(
      <MemoryRouter initialEntries={['/chat?chip_id=chip.start.routine']}>
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Add your AM\/PM products/i)).toBeInTheDocument();
    });

    const chatCalls = mock.mock.calls.filter((call) => call[0] === '/v1/chat');
    expect(chatCalls).toHaveLength(1);
  });

  it('maps routine.intake_products follow-up to the local routine intake sheet instead of looping back through chip.start.routine', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope());
      }
      if (path === '/v1/chat') {
        return Promise.resolve(makeRoutineSkillResponse());
      }
      return Promise.resolve(makeEnvelope());
    });

    render(
      <MemoryRouter initialEntries={['/chat?chip_id=chip.start.routine']}>
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    const addProductsButton = await screen.findByRole('button', { name: /Add my products/i });
    fireEvent.click(addProductsButton);

    await waitFor(() => {
      expect(screen.getByText(/Add your AM\/PM products/i)).toBeInTheDocument();
    });

    const chatCalls = mock.mock.calls.filter((call) => call[0] === '/v1/chat');
    expect(chatCalls).toHaveLength(1);
  });
});
