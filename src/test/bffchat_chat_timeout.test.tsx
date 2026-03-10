import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
import { bffChatStream, bffJson } from '@/lib/pivotaAgentBff';
import type { V1Envelope } from '@/lib/pivotaAgentBff';
import { TimeoutError } from '@/utils/requestWithTimeout';

const CHAT_TIMEOUT_MS = 30000;

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

const READY_TIMEOUT_MS = 5000;

async function waitForEnabledComposer() {
  const input = await screen.findByPlaceholderText(/ask a question/i);
  await waitFor(() => expect(input).not.toBeDisabled(), { timeout: READY_TIMEOUT_MS });
  return input;
}

describe('/v1/chat timeout behavior', () => {
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

  it('releases loading and avoids partial assistant output when chat request times out', async () => {
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
      <MemoryRouter initialEntries={['/chat']}>
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      const bootstrapCalls = mock.mock.calls.filter((call) => call[0] === '/v1/session/bootstrap');
      expect(bootstrapCalls.length).toBeGreaterThan(0);
    }, { timeout: READY_TIMEOUT_MS });

    const input = await waitForEnabledComposer();

    vi.useFakeTimers();

    fireEvent.change(input, { target: { value: 'Analyze Palmitoyl Tripeptide-38' } });

    const form = input.closest('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);
    const streamCalls = vi.mocked(bffChatStream).mock.calls;
    expect(streamCalls.length).toBe(1);
    expect((streamCalls[0]?.[3] as { timeoutMs?: number } | undefined)?.timeoutMs).toBe(CHAT_TIMEOUT_MS);

    await act(async () => {
      await Promise.resolve();
    });

    const chatCalls = mock.mock.calls.filter((call) => call[0] === '/v1/chat');
    expect(chatCalls.length).toBe(1);
    expect((chatCalls[0]?.[2] as RequestInit & { timeoutMs?: number })?.timeoutMs).toBe(CHAT_TIMEOUT_MS);

    const uploadPhotoButton = screen.getByTitle(/upload photo/i);
    expect(uploadPhotoButton).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CHAT_TIMEOUT_MS + 20);
    });

    vi.useRealTimers();
    expect(screen.getByTitle(/upload photo/i)).toBeInTheDocument();
    expect(screen.getByText(/Request timed out/i)).toBeInTheDocument();
    expect(screen.queryByText('Palmitoyl Tripeptide-38')).not.toBeInTheDocument();
    expect(screen.queryByText(/1-minute report/i)).not.toBeInTheDocument();
  }, 45000);
});
