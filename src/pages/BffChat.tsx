import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Card, SuggestedChip, V1Action, V1Envelope } from '@/lib/pivotaAgentBff';
import { bffJson, makeDefaultHeaders } from '@/lib/pivotaAgentBff';
import {
  Activity,
  ArrowRight,
  Beaker,
  ChevronDown,
  Copy,
  FlaskConical,
  Globe,
  HelpCircle,
  RefreshCw,
  Search,
  Sparkles,
  User,
  Wallet,
} from 'lucide-react';

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

type IconType = React.ComponentType<{ className?: string }>;

const iconForChip = (chipId: string): IconType => {
  const id = String(chipId || '').toLowerCase();
  if (id.startsWith('profile.')) return User;
  if (id.startsWith('chip.budget.')) return Wallet;
  if (id.includes('reco_products')) return Sparkles;
  if (id.includes('routine')) return Sparkles;
  if (id.includes('evaluate') || id.includes('analyze')) return Search;
  if (id.includes('dupe')) return Copy;
  if (id.includes('ingredient')) return FlaskConical;
  if (id.startsWith('chip.clarify.')) return HelpCircle;
  if (id.startsWith('chip.aurora.next_action.')) return ArrowRight;
  return ArrowRight;
};

const iconForCard = (type: string): IconType => {
  const t = String(type || '').toLowerCase();
  if (t === 'diagnosis_gate') return Activity;
  if (t === 'budget_gate') return Wallet;
  if (t === 'recommendations') return Sparkles;
  if (t.includes('product')) return Search;
  if (t.includes('dupe')) return Copy;
  if (t.includes('routine')) return Sparkles;
  if (t.includes('offer') || t.includes('checkout')) return Wallet;
  if (t.includes('structured')) return Beaker;
  return Beaker;
};

const titleForCard = (type: string, language: 'EN' | 'CN'): string => {
  const t = String(type || '');
  const key = t.toLowerCase();
  if (key === 'diagnosis_gate') return language === 'CN' ? '先做一个极简肤况确认' : 'Quick skin profile first';
  if (key === 'budget_gate') return language === 'CN' ? '预算确认' : 'Budget';
  if (key === 'recommendations') return language === 'CN' ? '护肤方案（AM/PM）' : 'Routine (AM/PM)';
  if (key === 'routine_simulation') return language === 'CN' ? '兼容性测试' : 'Compatibility test';
  if (key === 'offers_resolved') return language === 'CN' ? '购买渠道/Offer' : 'Offers';
  if (key === 'aurora_structured') return language === 'CN' ? '结构化结果' : 'Structured result';
  if (key === 'gate_notice') return language === 'CN' ? '门控提示' : 'Gate notice';
  if (key === 'error') return language === 'CN' ? '错误' : 'Error';
  return t || (language === 'CN' ? '卡片' : 'Card');
};

type RecoItem = Record<string, unknown> & { slot?: string };

const asArray = (v: unknown) => (Array.isArray(v) ? v : []);
const asObject = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const asString = (v: unknown) => (typeof v === 'string' ? v : v == null ? null : String(v));

function RecommendationsCard({ card, language }: { card: Card; language: 'EN' | 'CN' }) {
  const payload = asObject(card.payload) || {};
  const items = asArray(payload.recommendations) as RecoItem[];

  const groups = items.reduce(
    (acc, item) => {
      const slot = String(item.slot || '').toLowerCase();
      if (slot === 'am') acc.am.push(item);
      else if (slot === 'pm') acc.pm.push(item);
      else acc.other.push(item);
      return acc;
    },
    { am: [] as RecoItem[], pm: [] as RecoItem[], other: [] as RecoItem[] },
  );

  const sectionTitle = (slot: 'am' | 'pm' | 'other') => {
    if (slot === 'am') return language === 'CN' ? '早上 AM' : 'AM';
    if (slot === 'pm') return language === 'CN' ? '晚上 PM' : 'PM';
    return language === 'CN' ? '其他' : 'Other';
  };

  const renderStep = (item: RecoItem, idx: number) => {
    const sku = asObject(item.sku) || asObject(item.product) || null;
    const brand = asString(sku?.brand) || asString((sku as any)?.Brand) || null;
    const name = asString(sku?.name) || asString(sku?.display_name) || asString((sku as any)?.displayName) || null;
    const step = asString(item.step) || asString(item.category) || (language === 'CN' ? '步骤' : 'Step');
    const notes = asArray(item.notes).map((n) => asString(n)).filter(Boolean) as string[];
    const evidencePack = asObject((item as any).evidence_pack) || asObject((item as any).evidencePack) || null;
    const keyActives = asArray(evidencePack?.keyActives ?? evidencePack?.key_actives)
      .map((v) => asString(v))
      .filter(Boolean) as string[];

    return (
      <div key={`${step}_${idx}`} className="rounded-2xl border border-border/60 bg-background/60 p-3 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs font-medium text-muted-foreground">{step}</div>
            <div className="text-sm font-semibold text-foreground">
              {brand ? `${brand} ` : ''}
              {name || (language === 'CN' ? '未知产品' : 'Unknown product')}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">#{idx + 1}</div>
        </div>

        {keyActives.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {keyActives.slice(0, 6).map((k) => (
              <span
                key={k}
                className="rounded-full border border-border/60 bg-muted/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
              >
                {k}
              </span>
            ))}
          </div>
        ) : null}

        {notes.length ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {notes.slice(0, 3).map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}

        {evidencePack ? (
          <details className="mt-2">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-primary/90">
              <ChevronDown className="h-4 w-4" />
              {language === 'CN' ? '证据与注意事项' : 'Evidence & cautions'}
            </summary>
            <pre className="mt-2 max-h-[260px] overflow-auto rounded-xl bg-muted p-3 text-[11px] text-foreground">
              {renderJson(evidencePack)}
            </pre>
          </details>
        ) : null}
      </div>
    );
  };

  const showMissing =
    Array.isArray(payload.missing_info) && payload.missing_info.length ? (payload.missing_info as unknown[]) : [];

  const renderSection = (slot: 'am' | 'pm' | 'other', list: RecoItem[]) => {
    if (!list.length) return null;
    return (
      <section className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground">{sectionTitle(slot)}</div>
        <div className="space-y-2">{list.map(renderStep)}</div>
      </section>
    );
  };

  return (
    <div className="space-y-3">
      {renderSection('am', groups.am)}
      {renderSection('pm', groups.pm)}
      {renderSection('other', groups.other)}

      {showMissing.length ? (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
          {language === 'CN' ? '信息缺失：' : 'Missing info: '}
          {showMissing.slice(0, 6).map((v) => String(v)).join(', ')}
        </div>
      ) : null}
    </div>
  );
}

function BffCardView({ card, language }: { card: Card; language: 'EN' | 'CN' }) {
  const Icon = iconForCard(card.type);
  const title = titleForCard(card.type, language);
  const fieldMissingCount = Array.isArray(card.field_missing) ? card.field_missing.length : 0;

  const payloadObj = asObject(card.payload);

  return (
    <div className="chat-card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/50 bg-muted/60">
            <Icon className="h-5 w-5 text-foreground/80" />
          </div>
          <div className="space-y-0.5">
            <div className="text-sm font-semibold text-foreground">{title}</div>
            {card.title ? <div className="text-xs text-muted-foreground">{card.title}</div> : null}
          </div>
        </div>

        {fieldMissingCount ? (
          <div className="rounded-full border border-border/60 bg-muted/70 px-2 py-1 text-[11px] font-medium text-muted-foreground">
            {language === 'CN' ? `缺字段 ${fieldMissingCount}` : `${fieldMissingCount} missing`}
          </div>
        ) : null}
      </div>

      {card.type === 'recommendations' ? <RecommendationsCard card={card} language={language} /> : null}

      {card.type !== 'recommendations' ? (
        <>
          <details className="rounded-2xl border border-border/50 bg-background/50 p-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
              <span>{language === 'CN' ? '查看详情' : 'Details'}</span>
              <ChevronDown className="h-4 w-4" />
            </summary>
            <pre className="mt-2 max-h-[420px] overflow-auto rounded-xl bg-muted p-3 text-[11px] text-foreground">
              {renderJson(payloadObj ?? card.payload)}
            </pre>
            {fieldMissingCount ? (
              <pre className="mt-2 max-h-[220px] overflow-auto rounded-xl bg-muted p-3 text-[11px] text-foreground">
                {renderJson(card.field_missing)}
              </pre>
            ) : null}
          </details>
        </>
      ) : null}
    </div>
  );
}

export default function BffChat() {
  const [language, setLanguage] = useState<'EN' | 'CN'>('CN');
  const [headers, setHeaders] = useState(() => makeDefaultHeaders('CN'));
  const [sessionState, setSessionState] = useState<string>('idle');
  const [input, setInput] = useState('');
  const [items, setItems] = useState<ChatItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHeaders((prev) => ({ ...prev, lang: language }));
  }, [language]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items, isLoading]);

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
      const requestHeaders = { ...headers, lang: language };
      const env = await bffJson<V1Envelope>('/v1/session/bootstrap', requestHeaders, { method: 'GET' });
      const profile = (env.session_patch as Record<string, unknown> | undefined)?.profile;
      const isReturning = Boolean((env.session_patch as Record<string, unknown> | undefined)?.is_returning);

      const lang = language === 'CN' ? 'CN' : 'EN';
      const intro =
        lang === 'CN'
          ? `你好，我是你的护肤搭子。${isReturning && profile ? '欢迎回来！' : ''}你想先做什么？`
          : `Hi — I’m your skincare partner. ${isReturning && profile ? 'Welcome back! ' : ''}What would you like to do?`;

      const startChips: SuggestedChip[] = [
        {
          chip_id: 'chip.start.reco_products',
          label: lang === 'CN' ? '推荐一些产品（例如：提亮精华）' : 'Recommend a few products (e.g., brightening serum)',
          kind: 'quick_reply',
          data: {
            reply_text: lang === 'CN' ? '推荐一些产品（例如：提亮精华）' : 'Recommend a few products (e.g., brightening serum)',
          },
        },
        {
          chip_id: 'chip.start.routine',
          label: lang === 'CN' ? '生成早晚护肤 routine' : 'Build an AM/PM routine',
          kind: 'quick_reply',
          data: { reply_text: lang === 'CN' ? '生成一套早晚护肤 routine' : 'Build an AM/PM skincare routine' },
        },
        {
          chip_id: 'chip.start.evaluate',
          label: lang === 'CN' ? '评估某个产品适合吗' : 'Evaluate a specific product for me',
          kind: 'quick_reply',
          data: { reply_text: lang === 'CN' ? '评估这款产品是否适合我' : 'Evaluate a specific product for me' },
        },
        {
          chip_id: 'chip.start.dupes',
          label: lang === 'CN' ? '找平替/更便宜替代品' : 'Find dupes / cheaper alternatives',
          kind: 'quick_reply',
          data: { reply_text: lang === 'CN' ? '帮我找平替并比较 tradeoffs' : 'Find dupes/cheaper alternatives' },
        },
        {
          chip_id: 'chip.start.ingredients',
          label: lang === 'CN' ? '问成分机理/证据链' : 'Ask ingredient science (evidence/mechanism)',
          kind: 'quick_reply',
          data: { reply_text: lang === 'CN' ? '解释成分机理并给证据链' : 'Explain ingredient science with evidence/mechanism' },
        },
      ];

      if (!hasBootstrapped) {
        setItems([
          { id: nextId(), role: 'assistant', kind: 'text', content: intro },
          { id: nextId(), role: 'assistant', kind: 'chips', chips: startChips },
        ]);
        setHasBootstrapped(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [hasBootstrapped, headers, language]);

  const startNewChat = useCallback(() => {
    setError(null);
    setSessionState('idle');
    setItems([]);
    setHasBootstrapped(false);
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!hasBootstrapped) return;
    // If the user toggles language before interacting, restart so the intro/chips match.
    if (items.length <= 2) startNewChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendChat = useCallback(
    async (message?: string, action?: V1Action) => {
      setIsLoading(true);
      try {
        const requestHeaders = { ...headers, lang: language };
        const body: Record<string, unknown> = {
          session: { state: sessionState },
          ...(message ? { message } : {}),
          ...(action ? { action } : {}),
          language,
        };

        const env = await bffJson<V1Envelope>('/v1/chat', requestHeaders, {
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

  return (
    <div className="chat-container">
      <header className="chat-header">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/20" />
            <span className="relative z-10 text-base font-semibold text-white">A</span>
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-foreground">Aurora</div>
            <div className="text-[11px] text-muted-foreground">
              {language === 'CN' ? 'Lifecycle Skincare Partner' : 'Lifecycle Skincare Partner'} · {sessionState}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className={`chip-button ${language === 'CN' ? 'chip-button-primary' : ''}`}
            onClick={() => setLanguage('CN')}
            disabled={isLoading}
            title="中文"
          >
            <Globe className="h-4 w-4" />
            中文
          </button>
          <button
            className={`chip-button ${language === 'EN' ? 'chip-button-primary' : ''}`}
            onClick={() => setLanguage('EN')}
            disabled={isLoading}
            title="English"
          >
            <Globe className="h-4 w-4" />
            EN
          </button>
          <button
            className="chip-button"
            onClick={startNewChat}
            disabled={isLoading}
            title={language === 'CN' ? '新对话' : 'New chat'}
          >
            <RefreshCw className="h-4 w-4" />
            {language === 'CN' ? '新对话' : 'New'}
          </button>
        </div>
      </header>

      <main className="chat-messages scrollbar-hide">
        <div className="mx-auto max-w-lg space-y-4">
          {error ? (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {items.map((item) => {
            if (item.kind === 'text') {
              const isUser = item.role === 'user';
              return (
                <div key={item.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={isUser ? 'message-bubble-user whitespace-pre-wrap' : 'message-bubble-assistant whitespace-pre-wrap'}>
                    {item.content}
                  </div>
                </div>
              );
            }

            if (item.kind === 'chips') {
              return (
                <div key={item.id} className="chat-card">
                  <div className="flex flex-wrap gap-2">
                    {item.chips.map((chip) => {
                      const Icon = iconForChip(chip.chip_id);
                      return (
                        <button
                          key={chip.chip_id}
                          className="chip-button"
                          onClick={() => onChip(chip)}
                          disabled={isLoading}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{chip.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }

            return (
              <div key={item.id} className="space-y-3">
                {item.cards.map((card) => (
                  <BffCardView key={card.card_id} card={card} language={language} />
                ))}
              </div>
            );
          })}

          {isLoading ? <div className="text-xs text-muted-foreground">{language === 'EN' ? 'Loading…' : '加载中…'}</div> : null}
          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="chat-input-container">
        <form
          className="mx-auto flex max-w-lg items-center gap-2 rounded-2xl border border-border/50 bg-card p-2 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit();
          }}
        >
          <input
            className="h-10 flex-1 bg-transparent px-3 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/70"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={language === 'EN' ? 'Ask a question… (or paste a product link)' : '输入问题…（或粘贴产品链接）'}
            disabled={isLoading}
          />
          <button className="chip-button chip-button-primary" type="submit" disabled={!canSend}>
            <ArrowRight className="h-4 w-4" />
            {language === 'EN' ? 'Send' : '发送'}
          </button>
        </form>
      </footer>
    </div>
  );
}
