import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, waitFor } from '@/test/testProviders';

vi.mock('@/components/mobile/AuroraSidebar', () => ({
  AuroraSidebar: () => null,
}));

vi.mock('@/components/mobile/BottomNav', () => ({
  BottomNav: () => null,
}));

vi.mock('@/components/mobile/ChatComposerDrawer', () => ({
  ChatComposerDrawer: () => null,
}));

vi.mock('@/contexts/shop', () => ({
  useShop: () => ({
    cart: null,
    openOrders: vi.fn(),
  }),
}));

vi.mock('@/lib/chatHistory', () => ({
  loadChatHistory: () => [],
  upsertChatHistoryItem: vi.fn(),
}));

vi.mock('@/lib/activityApi', () => ({
  logActivity: vi.fn(),
}));

vi.mock('@/lib/pivotaAgentBff', async () => {
  const actual = await vi.importActual<typeof import('@/lib/pivotaAgentBff')>('@/lib/pivotaAgentBff');
  return {
    ...actual,
    bffJson: vi.fn(),
    makeDefaultHeaders: vi.fn(() => ({
      aurora_uid: 'uid_shell',
      trace_id: 'trace_shell',
      brief_id: 'brief_shell',
      lang: 'EN',
    })),
  };
});

import { clearAuroraAuthSession, saveAuroraAuthSession } from '@/lib/auth';
import MobileShell from '@/layouts/MobileShell';
import { bffJson } from '@/lib/pivotaAgentBff';

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<MobileShell />}>
          <Route index element={<div>home shell</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('MobileShell auth revalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.mocked(bffJson).mockResolvedValue({
      request_id: 'req_bootstrap',
      trace_id: 'trace_bootstrap',
      assistant_message: null,
      suggested_chips: [],
      cards: [],
      session_patch: {},
      events: [],
    });
  });

  it('revalidates stored auth on cold start even when local expiry is stale', async () => {
    saveAuroraAuthSession({
      token: 'stale_token',
      email: 'user@example.com',
      expires_at: '2026-03-13T01:00:00.000Z',
    });

    renderShell();

    await waitFor(() => {
      expect(vi.mocked(bffJson)).toHaveBeenCalledWith(
        '/v1/session/bootstrap',
        expect.objectContaining({
          auth_token: 'stale_token',
        }),
        expect.objectContaining({ method: 'GET' }),
      );
    });
  });

  it('skips cold-start revalidation when no stored auth exists', async () => {
    clearAuroraAuthSession();

    renderShell();

    await waitFor(() => {
      expect(document.body.textContent).toContain('home shell');
    });
    expect(vi.mocked(bffJson)).not.toHaveBeenCalled();
  });
});
