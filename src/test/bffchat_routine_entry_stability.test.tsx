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
