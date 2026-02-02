import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Card, SuggestedChip, V1Action, V1Envelope } from '@/lib/pivotaAgentBff';
import { bffJson, makeDefaultHeaders } from '@/lib/pivotaAgentBff';

type ChatItem =
  | { id: string; role: 'user' | 'assistant'; kind: 'text'; content: string }
  | { id: string; role: 'assistant'; kind: 'cards'; cards: Card[] }
  | { id: string; role: 'assistant'; kind: 'chips'; chips: SuggestedChip[] };

const nextId = (() => {
  let n = 0;
  return () => `m_${Date.now()}_${++n}`;
})();

const renderJson = (obj: unknown) => {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
};

export default function BffChat() {
  const [language, setLanguage] = useState<'EN' | 'CN'>('CN');
  const [headers, setHeaders] = useState(() => makeDefaultHeaders('CN'));
  const [sessionState, setSessionState] = useState<string>('idle');
  const [input, setInput] = useState('');
  const [items, setItems] = useState<ChatItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHeaders((prev) => ({ ...prev, lang: language }));
  }, [language]);

  const applyEnvelope = useCallback((env: V1Envelope) => {
    setError(null);

    if (env.session_patch && typeof env.session_patch === 'object') {
      const next = (env.session_patch as Record<string, unknown>)['next_state'];
      if (typeof next === 'string' && next.trim()) setSessionState(next.trim());
    }

    const nextItems: ChatItem[] = [];
    if (env.assistant_message?.content) {
      nextItems.push({ id: nextId(), role: 'assistant', kind: 'text', content: env.assistant_message.content });
    }

    if (Array.isArray(env.cards) && env.cards.length) {
      nextItems.push({ id: nextId(), role: 'assistant', kind: 'cards', cards: env.cards });
    }

    if (Array.isArray(env.suggested_chips) && env.suggested_chips.length) {
      nextItems.push({ id: nextId(), role: 'assistant', kind: 'chips', chips: env.suggested_chips });
    }

    if (nextItems.length) setItems((prev) => [...prev, ...nextItems]);
  }, []);

  const bootstrap = useCallback(async () => {
    setIsLoading(true);
    try {
      const env = await bffJson<V1Envelope>('/v1/session/bootstrap', headers, { method: 'GET' });
      applyEnvelope(env);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [applyEnvelope, headers]);

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendChat = useCallback(
    async (message?: string, action?: V1Action) => {
      setIsLoading(true);
      try {
        const body: Record<string, unknown> = {
          session: { state: sessionState },
          ...(message ? { message } : {}),
          ...(action ? { action } : {}),
          language,
        };

        const env = await bffJson<V1Envelope>('/v1/chat', headers, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        applyEnvelope(env);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    },
    [applyEnvelope, headers, language, sessionState]
  );

  const onSubmit = useCallback(async () => {
    const msg = input.trim();
    if (!msg) return;
    setItems((prev) => [...prev, { id: nextId(), role: 'user', kind: 'text', content: msg }]);
    setInput('');
    await sendChat(msg);
  }, [input, sendChat]);

  const onChip = useCallback(
    async (chip: SuggestedChip) => {
      setItems((prev) => [...prev, { id: nextId(), role: 'user', kind: 'text', content: chip.label }]);
      await sendChat(undefined, { action_id: chip.chip_id, kind: 'chip', data: chip.data });
    },
    [sendChat]
  );

  const canSend = useMemo(() => !isLoading && input.trim().length > 0, [isLoading, input]);

  const onGenerateRoutine = useCallback(async () => {
    setIsLoading(true);
    try {
      const env = await bffJson<V1Envelope>('/v1/reco/generate', headers, {
        method: 'POST',
        body: JSON.stringify({ focus: 'daily routine', constraints: { simplicity: 'high' } }),
      });
      applyEnvelope(env);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [applyEnvelope, headers]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col">
        <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex flex-col">
              <div className="text-sm font-semibold text-foreground">Aurora Chat</div>
              <div className="text-xs text-muted-foreground">state: {sessionState}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className={`chip-button ${language === 'CN' ? 'chip-button-primary' : ''}`}
                onClick={() => setLanguage('CN')}
                disabled={isLoading}
              >
                中文
              </button>
              <button
                className={`chip-button ${language === 'EN' ? 'chip-button-primary' : ''}`}
                onClick={() => setLanguage('EN')}
                disabled={isLoading}
              >
                EN
              </button>
              <button className="action-button action-button-ghost" onClick={bootstrap} disabled={isLoading}>
                Bootstrap
              </button>
              <button className="action-button action-button-outline" onClick={onGenerateRoutine} disabled={isLoading}>
                {language === 'EN' ? 'Generate routine' : '生成 routine'}
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 space-y-3 px-4 py-4">
          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {items.map((item) => {
            if (item.kind === 'text') {
              const isUser = item.role === 'user';
              return (
                <div key={item.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                      isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                    }`}
                  >
                    {item.content}
                  </div>
                </div>
              );
            }

            if (item.kind === 'chips') {
              return (
                <div key={item.id} className="flex flex-wrap gap-2">
                  {item.chips.map((chip) => (
                    <button
                      key={chip.chip_id}
                      className="chip-button"
                      onClick={() => onChip(chip)}
                      disabled={isLoading}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              );
            }

            return (
              <div key={item.id} className="space-y-2">
                {item.cards.map((card) => (
                  <details key={card.card_id} className="rounded-xl border border-border bg-card p-3">
                    <summary className="cursor-pointer text-sm font-medium text-foreground">
                      {card.type}
                      {card.title ? ` — ${card.title}` : ''}
                    </summary>
                    <pre className="mt-2 max-h-[420px] overflow-auto rounded-lg bg-muted p-3 text-xs text-foreground">
                      {renderJson(card.payload)}
                    </pre>
                  </details>
                ))}
              </div>
            );
          })}

          {isLoading ? (
            <div className="text-xs text-muted-foreground">{language === 'EN' ? 'Loading…' : '加载中…'}</div>
          ) : null}
        </main>

        <footer className="sticky bottom-0 border-t border-border bg-background/80 backdrop-blur">
          <form
            className="flex items-center gap-2 px-4 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              void onSubmit();
            }}
          >
            <input
              className="h-10 flex-1 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={language === 'EN' ? 'Type a message…' : '输入消息…'}
              disabled={isLoading}
            />
            <button className="action-button action-button-primary" type="submit" disabled={!canSend}>
              {language === 'EN' ? 'Send' : '发送'}
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
}
