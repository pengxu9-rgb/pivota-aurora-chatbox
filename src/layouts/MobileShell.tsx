import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

import { AuroraSidebar } from '@/components/mobile/AuroraSidebar';
import { BottomNav } from '@/components/mobile/BottomNav';
import { ChatComposerDrawer, type ChatStartIntent } from '@/components/mobile/ChatComposerDrawer';
import { logActivity } from '@/lib/activityApi';
import { loadChatHistory, upsertChatHistoryItem, type ChatHistoryItem } from '@/lib/chatHistory';
import { makeDefaultHeaders } from '@/lib/pivotaAgentBff';
import { getLangPref } from '@/lib/persistence';

export type MobileShellContext = {
  openSidebar: () => void;
  openComposer: (preset?: { query?: string }) => void;
  startChat: (intent: ChatStartIntent) => void;
};

const toUiLang = () => (getLangPref() === 'cn' ? 'CN' : 'EN') as const;

export default function MobileShell() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerDefaultQuery, setComposerDefaultQuery] = useState<string>('');
  const [history, setHistory] = useState<ChatHistoryItem[]>(() => loadChatHistory());

  useEffect(() => {
    setHistory(loadChatHistory());
  }, []);

  const openSidebar = useCallback(() => setSidebarOpen(true), []);

  const openComposer = useCallback((preset?: { query?: string }) => {
    setComposerDefaultQuery(String(preset?.query || '').trim());
    setComposerOpen(true);
  }, []);

  const openChatByBriefId = useCallback(
    (briefId: string) => {
      const id = String(briefId || '').trim();
      if (!id) return;
      navigate(`/chat?brief_id=${encodeURIComponent(id)}`);
    },
    [navigate],
  );

  const startChat = useCallback(
    (intent: ChatStartIntent) => {
      const lang = toUiLang();
      const sp = new URLSearchParams();
      let search = '';
      let navigationState: { session_patch: Record<string, unknown> } | undefined;

      try {
        const headers = makeDefaultHeaders(lang);
        const briefId = headers.brief_id;
        navigationState =
          intent.kind === 'query' &&
          intent.session_patch &&
          typeof intent.session_patch === 'object' &&
          !Array.isArray(intent.session_patch)
            ? { session_patch: intent.session_patch }
            : undefined;

        sp.set('brief_id', briefId);
        sp.set('trace_id', headers.trace_id);
        if (intent.kind === 'query') sp.set('q', intent.query);
        if (intent.kind === 'chip') sp.set('chip_id', intent.chip_id);
        if (intent.kind === 'chip' && intent.open) sp.set('open', intent.open);
        if (intent.kind === 'open') sp.set('open', intent.open);
        search = `?${sp.toString()}`;

        // Best-effort history persistence should never block navigation.
        try {
          const title = (() => {
            if (intent.kind === 'chip' || intent.kind === 'open') return String(intent.title || '').trim() || 'New chat';
            return String(intent.title || intent.query || '').trim().slice(0, 64) || 'New chat';
          })();
          upsertChatHistoryItem({ brief_id: briefId, title });
          setHistory(loadChatHistory());
        } catch {
          // no-op
        }

        // Best-effort activity logging should never block navigation.
        void logActivity(lang, {
          event_type: 'chat_started',
          payload:
            intent.kind === 'query'
              ? {
                  title: String(intent.title || '').trim().slice(0, 64) || null,
                  has_query: Boolean(String(intent.query || '').trim()),
                }
              : intent.kind === 'chip'
                ? {
                    title: String(intent.title || '').trim().slice(0, 64) || null,
                    chip_id: String(intent.chip_id || '').trim().slice(0, 120) || null,
                    open: intent.open || null,
                  }
                : {
                    title: String(intent.title || '').trim().slice(0, 64) || null,
                    open: intent.open || null,
                  },
          deeplink: search ? `/chat${search}` : '/chat',
          source: 'mobile_shell',
          occurred_at_ms: Date.now(),
        }).catch(() => {
          // no-op
        });
      } catch {
        // Fallback: still route to chat even if header generation fails.
      }

      setComposerOpen(false);
      setSidebarOpen(false);
      navigate({ pathname: '/chat', ...(search ? { search } : {}) }, navigationState ? { state: navigationState } : undefined);
    },
    [navigate],
  );

  const ctx = useMemo<MobileShellContext>(() => ({ openSidebar, openComposer, startChat }), [openSidebar, openComposer, startChat]);

  return (
    <div className="min-h-[100dvh] bg-chat">
      <div className="mx-auto w-full max-w-[var(--aurora-shell-max)] pb-[var(--aurora-shell-bottom-pad)]">
        <Outlet context={ctx} />
      </div>

      <BottomNav onChat={() => openComposer()} />

      <ChatComposerDrawer
        open={composerOpen}
        onOpenChange={setComposerOpen}
        history={history}
        defaultQuery={composerDefaultQuery}
        onStart={startChat}
      />

      <AuroraSidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        history={history}
        onOpenChat={openChatByBriefId}
      />
    </div>
  );
}
