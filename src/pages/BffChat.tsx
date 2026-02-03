import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Card, SuggestedChip, V1Action, V1Envelope } from '@/lib/pivotaAgentBff';
import { bffJson, makeDefaultHeaders } from '@/lib/pivotaAgentBff';
import {
  Activity,
  ArrowRight,
  Beaker,
  Camera,
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
  X,
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
  if (id.includes('diagnosis')) return Activity;
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
  if (t === 'profile') return User;
  if (t.includes('photo')) return Camera;
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
  if (key === 'profile') return language === 'CN' ? '肤况资料' : 'Profile';
  if (key === 'photo_presign') return language === 'CN' ? '照片上传' : 'Photo upload';
  if (key === 'photo_confirm') return language === 'CN' ? '照片质检' : 'Photo QC';
  if (key === 'aurora_structured') return language === 'CN' ? '结构化结果' : 'Structured result';
  if (key === 'gate_notice') return language === 'CN' ? '门控提示' : 'Gate notice';
  if (key === 'error') return language === 'CN' ? '错误' : 'Error';
  return t || (language === 'CN' ? '卡片' : 'Card');
};

type RecoItem = Record<string, unknown> & { slot?: string };

const asArray = (v: unknown) => (Array.isArray(v) ? v : []);
const asObject = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const asString = (v: unknown) => (typeof v === 'string' ? v : v == null ? null : String(v));
const asNumber = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

type BootstrapInfo = {
  profile: Record<string, unknown> | null;
  recent_logs: Array<Record<string, unknown>>;
  checkin_due: boolean | null;
  is_returning: boolean | null;
  db_ready: boolean | null;
};

const readBootstrapInfo = (env: V1Envelope): BootstrapInfo | null => {
  const patch = env.session_patch && typeof env.session_patch === 'object' ? (env.session_patch as Record<string, unknown>) : null;
  if (!patch) return null;
  const profile = asObject(patch.profile);
  const recentLogs = asArray(patch.recent_logs).map((v) => asObject(v)).filter(Boolean) as Array<Record<string, unknown>>;
  const checkinDue = typeof patch.checkin_due === 'boolean' ? patch.checkin_due : null;
  const isReturning = typeof patch.is_returning === 'boolean' ? patch.is_returning : null;
  return {
    profile: profile ?? null,
    recent_logs: recentLogs,
    checkin_due: checkinDue,
    is_returning: isReturning,
    db_ready: typeof patch.db_ready === 'boolean' ? patch.db_ready : null,
  };
};

function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60]">
      <button
        className="absolute inset-0 bg-black/35 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="absolute bottom-0 left-0 right-0 mx-auto w-full max-w-lg rounded-t-3xl border border-border/50 bg-card/90 p-4 shadow-elevated backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-muted/70 text-foreground/80"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

function formatProfileLine(profile: Record<string, unknown> | null, language: 'EN' | 'CN') {
  if (!profile) return language === 'CN' ? '未填写肤况资料' : 'No profile yet';
  const skinType = asString(profile.skinType) || '—';
  const sensitivity = asString(profile.sensitivity) || '—';
  const barrier = asString(profile.barrierStatus) || '—';
  const goals = asArray(profile.goals).map((g) => asString(g)).filter(Boolean) as string[];
  const goalsText = goals.length ? goals.slice(0, 3).join(', ') : '—';
  return language === 'CN'
    ? `肤质：${skinType} · 敏感：${sensitivity} · 屏障：${barrier} · 目标：${goalsText}`
    : `Skin: ${skinType} · Sensitivity: ${sensitivity} · Barrier: ${barrier} · Goals: ${goalsText}`;
}

function labelMissing(code: string, language: 'EN' | 'CN') {
  const c = String(code || '').trim();
  if (!c) return '';
  const map: Record<string, { CN: string; EN: string }> = {
    budget_unknown: { CN: '预算信息缺失', EN: 'Budget missing' },
    routine_missing: { CN: '方案缺失', EN: 'Routine missing' },
    over_budget: { CN: '可能超出预算', EN: 'May be over budget' },
    evidence_missing: { CN: '证据不足', EN: 'Evidence missing' },
    upstream_missing_or_unstructured: { CN: '上游返回缺失/不规范', EN: 'Upstream missing/unstructured' },
  };
  return map[c]?.[language] ?? c;
}

function RecommendationsCard({
  card,
  language,
  debug,
}: {
  card: Card;
  language: 'EN' | 'CN';
  debug: boolean;
}) {
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
    const comparisonNotes = asArray(evidencePack?.comparisonNotes ?? evidencePack?.comparison_notes)
      .map((v) => asString(v))
      .filter(Boolean) as string[];
    const sensitivityFlags = asArray(evidencePack?.sensitivityFlags ?? evidencePack?.sensitivity_flags)
      .map((v) => asString(v))
      .filter(Boolean) as string[];
    const pairingRules = asArray(evidencePack?.pairingRules ?? evidencePack?.pairing_rules)
      .map((v) => asString(v))
      .filter(Boolean) as string[];
    const citations = asArray(evidencePack?.citations).map((v) => asString(v)).filter(Boolean) as string[];

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

            <div className="mt-2 space-y-2 text-xs text-muted-foreground">
              {comparisonNotes.length ? (
                <div className="rounded-xl border border-border/50 bg-muted/40 p-3">
                  <div className="text-[11px] font-semibold text-foreground">
                    {language === 'CN' ? '对比/取舍' : 'Tradeoffs'}
                  </div>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {comparisonNotes.slice(0, 4).map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {sensitivityFlags.length ? (
                <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-warning">
                  <div className="text-[11px] font-semibold text-warning">
                    {language === 'CN' ? '敏感风险' : 'Sensitivity risks'}
                  </div>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {sensitivityFlags.slice(0, 4).map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {pairingRules.length ? (
                <div className="rounded-xl border border-border/50 bg-muted/40 p-3">
                  <div className="text-[11px] font-semibold text-foreground">
                    {language === 'CN' ? '搭配建议' : 'Pairing notes'}
                  </div>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {pairingRules.slice(0, 4).map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {citations.length ? (
                <div className="rounded-xl border border-border/50 bg-muted/40 p-3">
                  <div className="text-[11px] font-semibold text-foreground">{language === 'CN' ? '引用' : 'Citations'}</div>
                  <div className="mt-2 space-y-1">
                    {citations.slice(0, 3).map((c) => (
                      <div key={c} className="truncate">
                        {c}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {debug ? (
                <pre className="mt-2 max-h-[260px] overflow-auto rounded-xl bg-muted p-3 text-[11px] text-foreground">
                  {renderJson(evidencePack)}
                </pre>
              ) : null}
            </div>
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
          {showMissing
            .slice(0, 6)
            .map((v) => labelMissing(String(v), language))
            .filter(Boolean)
            .join('、')}
        </div>
      ) : null}
    </div>
  );
}

function BffCardView({ card, language, debug }: { card: Card; language: 'EN' | 'CN'; debug: boolean }) {
  if (!debug && (card.type === 'aurora_structured' || card.type === 'gate_notice')) return null;

  const Icon = iconForCard(card.type);
  const title = titleForCard(card.type, language);
  const fieldMissingCount = Array.isArray(card.field_missing) ? card.field_missing.length : 0;

  const payloadObj = asObject(card.payload);
  const profilePayload = asObject((payloadObj as any)?.profile);
  const qcStatus = asString((payloadObj as any)?.qc_status);
  const qcObj = asObject((payloadObj as any)?.qc);
  const qcAdvice = asObject(qcObj?.advice);
  const qcSummary = asString(qcAdvice?.summary) || null;
  const qcSuggestions = asArray(qcAdvice?.suggestions).map((s) => asString(s)).filter(Boolean) as string[];

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

      {card.type === 'recommendations' ? <RecommendationsCard card={card} language={language} debug={debug} /> : null}

      {card.type === 'profile' ? (
        <div className="rounded-2xl border border-border/60 bg-background/60 p-3 text-sm text-foreground">
          <div className="text-xs text-muted-foreground">
            {language === 'CN' ? '已记录你的肤况。需要修改的话，点顶部「资料」。' : 'Saved. Tap “Profile” on the top bar to edit.'}
          </div>
          <div className="mt-2 text-sm font-medium text-foreground">
            {formatProfileLine(profilePayload ?? null, language)}
          </div>
        </div>
      ) : null}

      {card.type === 'photo_confirm' ? (
        <div className="rounded-2xl border border-border/60 bg-background/60 p-3 text-sm text-foreground">
          <div className="text-xs text-muted-foreground">{language === 'CN' ? '照片质检结果' : 'Photo QC result'}</div>
          <div className="mt-2 text-sm font-semibold text-foreground">
            {qcStatus
              ? qcStatus === 'passed'
                ? language === 'CN'
                  ? '通过 ✅'
                  : 'Passed ✅'
                : language === 'CN'
                  ? `需要重拍：${qcStatus}`
                  : `Needs retry: ${qcStatus}`
              : language === 'CN'
                ? '质检中…'
                : 'Checking…'}
          </div>
          {qcSummary ? <div className="mt-2 text-xs text-muted-foreground">{qcSummary}</div> : null}
          {qcSuggestions.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {qcSuggestions.slice(0, 4).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {card.type !== 'recommendations' && card.type !== 'profile' && debug ? (
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
  const [debug] = useState<boolean>(() => {
    try {
      return new URLSearchParams(window.location.search).get('debug') === '1';
    } catch {
      return false;
    }
  });
  const [input, setInput] = useState('');
  const [items, setItems] = useState<ChatItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bootstrapInfo, setBootstrapInfo] = useState<BootstrapInfo | null>(null);

  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [checkinSheetOpen, setCheckinSheetOpen] = useState(false);

  const [profileDraft, setProfileDraft] = useState({
    skinType: '',
    sensitivity: '',
    barrierStatus: '',
    goals: [] as string[],
    region: '',
    budgetTier: '',
  });

  const [checkinDraft, setCheckinDraft] = useState({
    redness: 0,
    acne: 0,
    hydration: 0,
    notes: '',
  });

  useEffect(() => {
    setHeaders((prev) => ({ ...prev, lang: language }));
  }, [language]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items, isLoading]);

  const applyEnvelope = useCallback((env: V1Envelope) => {
    setError(null);

    if (env.session_patch && typeof env.session_patch === 'object') {
      const patch = env.session_patch as Record<string, unknown>;
      const next = (env.session_patch as Record<string, unknown>)['next_state'];
      if (typeof next === 'string' && next.trim()) setSessionState(next.trim());

      setBootstrapInfo((prev) => {
        const merged: BootstrapInfo = prev
          ? { ...prev }
          : { profile: null, recent_logs: [], checkin_due: null, is_returning: null, db_ready: null };

        const profile = asObject(patch.profile);
        if (profile) merged.profile = profile;

        const recentLogs = asArray(patch.recent_logs).map((v) => asObject(v)).filter(Boolean) as Array<Record<string, unknown>>;
        if (recentLogs.length) merged.recent_logs = recentLogs;

        if (typeof patch.checkin_due === 'boolean') merged.checkin_due = patch.checkin_due;
        if (typeof patch.is_returning === 'boolean') merged.is_returning = patch.is_returning;
        if (typeof patch.db_ready === 'boolean') merged.db_ready = patch.db_ready;

        return merged;
      });
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
      const info = readBootstrapInfo(env);
      setBootstrapInfo(info);
      const profile = info?.profile;
      const isReturning = Boolean(info?.is_returning);

      const lang = language === 'CN' ? 'CN' : 'EN';
      const intro =
        lang === 'CN'
          ? `你好，我是你的护肤搭子。${isReturning && profile ? '欢迎回来！' : ''}你想先做什么？`
          : `Hi — I’m your skincare partner. ${isReturning && profile ? 'Welcome back! ' : ''}What would you like to do?`;

      const startChips: SuggestedChip[] = [
        {
          chip_id: 'chip.start.diagnosis',
          label: lang === 'CN' ? '开始皮肤诊断' : 'Start skin diagnosis',
          kind: 'quick_reply',
          data: { reply_text: lang === 'CN' ? '开始皮肤诊断' : 'Start skin diagnosis' },
        },
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
          {
            id: nextId(),
            role: 'assistant',
            kind: 'text',
            content: formatProfileLine(profile, language),
          },
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

  useEffect(() => {
    if (!profileSheetOpen) return;
    const p = bootstrapInfo?.profile;
    setProfileDraft({
      skinType: asString(p?.skinType) ?? '',
      sensitivity: asString(p?.sensitivity) ?? '',
      barrierStatus: asString(p?.barrierStatus) ?? '',
      goals: (asArray(p?.goals).map((g) => asString(g)).filter(Boolean) as string[]) ?? [],
      region: asString(p?.region) ?? '',
      budgetTier: asString(p?.budgetTier) ?? '',
    });
  }, [profileSheetOpen, bootstrapInfo]);

  const saveProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const patch: Record<string, unknown> = {};
      if (profileDraft.skinType.trim()) patch.skinType = profileDraft.skinType.trim();
      if (profileDraft.sensitivity.trim()) patch.sensitivity = profileDraft.sensitivity.trim();
      if (profileDraft.barrierStatus.trim()) patch.barrierStatus = profileDraft.barrierStatus.trim();
      if (profileDraft.region.trim()) patch.region = profileDraft.region.trim();
      if (profileDraft.budgetTier.trim()) patch.budgetTier = profileDraft.budgetTier.trim();
      if (profileDraft.goals.length) patch.goals = profileDraft.goals;

      const requestHeaders = { ...headers, lang: language };
      const env = await bffJson<V1Envelope>('/v1/profile/update', requestHeaders, {
        method: 'POST',
        body: JSON.stringify(patch),
      });

      setItems((prev) => [
        ...prev,
        { id: nextId(), role: 'user', kind: 'text', content: language === 'CN' ? '更新肤况资料' : 'Update profile' },
      ]);
      applyEnvelope(env);
      setProfileSheetOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [applyEnvelope, headers, language, profileDraft]);

  const saveCheckin = useCallback(async () => {
    setIsLoading(true);
    try {
      const payload: Record<string, unknown> = {
        redness: Math.max(0, Math.min(5, Math.trunc(checkinDraft.redness))),
        acne: Math.max(0, Math.min(5, Math.trunc(checkinDraft.acne))),
        hydration: Math.max(0, Math.min(5, Math.trunc(checkinDraft.hydration))),
      };
      if (checkinDraft.notes.trim()) payload.notes = checkinDraft.notes.trim();

      const requestHeaders = { ...headers, lang: language };
      const env = await bffJson<V1Envelope>('/v1/tracker/log', requestHeaders, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setItems((prev) => [
        ...prev,
        { id: nextId(), role: 'user', kind: 'text', content: language === 'CN' ? '今日打卡' : 'Daily check-in' },
      ]);
      applyEnvelope(env);
      setCheckinSheetOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [applyEnvelope, checkinDraft, headers, language]);

  const handlePickPhoto = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const uploadPhoto = useCallback(
    async (file: File) => {
      setIsLoading(true);
      try {
        const requestHeaders = { ...headers, lang: language };
        const presignEnv = await bffJson<V1Envelope>('/v1/photos/presign', requestHeaders, {
          method: 'POST',
          body: JSON.stringify({
            slot_id: 'daylight',
            content_type: file.type || 'image/jpeg',
            bytes: file.size,
          }),
        });
        applyEnvelope(presignEnv);

        const presignCard = presignEnv.cards.find((c) => c && c.type === 'photo_presign');
        const photoId = asString(presignCard && (presignCard.payload as any)?.photo_id);
        const upload = asObject(presignCard && (presignCard.payload as any)?.upload);
        const uploadUrl = asString(upload && upload.url);
        const uploadMethod = asString(upload && upload.method) || 'PUT';
        const uploadHeaders = asObject(upload && upload.headers) || {};

        if (photoId && uploadUrl) {
          await fetch(uploadUrl, {
            method: uploadMethod,
            headers: Object.fromEntries(Object.entries(uploadHeaders).map(([k, v]) => [k, String(v)])),
            body: file,
          });
        }

        if (photoId) {
          const confirmEnv = await bffJson<V1Envelope>('/v1/photos/confirm', requestHeaders, {
            method: 'POST',
            body: JSON.stringify({ photo_id: photoId, slot_id: 'daylight' }),
          });
          applyEnvelope(confirmEnv);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    },
    [applyEnvelope, headers, language],
  );

  const onPhotoSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      setItems((prev) => [
        ...prev,
        { id: nextId(), role: 'user', kind: 'text', content: language === 'CN' ? '上传照片' : 'Upload a photo' },
      ]);
      await uploadPhoto(file);
    },
    [language, uploadPhoto],
  );

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
            className={`chip-button ${bootstrapInfo?.checkin_due ? 'chip-button-primary' : ''}`}
            onClick={() => setCheckinSheetOpen(true)}
            disabled={isLoading}
            title={language === 'CN' ? '今日打卡' : 'Daily check-in'}
          >
            <Activity className="h-4 w-4" />
            {language === 'CN' ? '打卡' : 'Check-in'}
          </button>
          <button
            className="chip-button"
            onClick={() => setProfileSheetOpen(true)}
            disabled={isLoading}
            title={language === 'CN' ? '编辑资料' : 'Edit profile'}
          >
            <User className="h-4 w-4" />
            {language === 'CN' ? '资料' : 'Profile'}
          </button>
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
          <Sheet
            open={profileSheetOpen}
            title={language === 'CN' ? '编辑肤况资料' : 'Edit profile'}
            onClose={() => setProfileSheetOpen(false)}
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-xs text-muted-foreground">
                  {language === 'CN' ? '肤质' : 'Skin type'}
                  <select
                    className="h-10 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                    value={profileDraft.skinType}
                    onChange={(e) => setProfileDraft((p) => ({ ...p, skinType: e.target.value }))}
                  >
                    <option value="">{language === 'CN' ? '未选择' : '—'}</option>
                    <option value="oily">{language === 'CN' ? '油性' : 'oily'}</option>
                    <option value="dry">{language === 'CN' ? '干性' : 'dry'}</option>
                    <option value="combination">{language === 'CN' ? '混合' : 'combination'}</option>
                    <option value="normal">{language === 'CN' ? '中性' : 'normal'}</option>
                    <option value="sensitive">{language === 'CN' ? '敏感' : 'sensitive'}</option>
                  </select>
                </label>

                <label className="space-y-1 text-xs text-muted-foreground">
                  {language === 'CN' ? '敏感程度' : 'Sensitivity'}
                  <select
                    className="h-10 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                    value={profileDraft.sensitivity}
                    onChange={(e) => setProfileDraft((p) => ({ ...p, sensitivity: e.target.value }))}
                  >
                    <option value="">{language === 'CN' ? '未选择' : '—'}</option>
                    <option value="low">{language === 'CN' ? '低' : 'low'}</option>
                    <option value="medium">{language === 'CN' ? '中' : 'medium'}</option>
                    <option value="high">{language === 'CN' ? '高' : 'high'}</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-xs text-muted-foreground">
                  {language === 'CN' ? '屏障状态' : 'Barrier status'}
                  <select
                    className="h-10 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                    value={profileDraft.barrierStatus}
                    onChange={(e) => setProfileDraft((p) => ({ ...p, barrierStatus: e.target.value }))}
                  >
                    <option value="">{language === 'CN' ? '未选择' : '—'}</option>
                    <option value="healthy">{language === 'CN' ? '稳定' : 'healthy'}</option>
                    <option value="impaired">{language === 'CN' ? '不稳定/刺痛' : 'impaired'}</option>
                    <option value="unknown">{language === 'CN' ? '不确定' : 'unknown'}</option>
                  </select>
                </label>

                <label className="space-y-1 text-xs text-muted-foreground">
                  {language === 'CN' ? '预算' : 'Budget'}
                  <select
                    className="h-10 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                    value={profileDraft.budgetTier}
                    onChange={(e) => setProfileDraft((p) => ({ ...p, budgetTier: e.target.value }))}
                  >
                    <option value="">{language === 'CN' ? '未选择' : '—'}</option>
                    <option value="¥200">¥200</option>
                    <option value="¥500">¥500</option>
                    <option value="¥1000+">¥1000+</option>
                    <option value="不确定">{language === 'CN' ? '不确定' : 'Not sure'}</option>
                  </select>
                </label>
              </div>

              <label className="space-y-1 text-xs text-muted-foreground">
                {language === 'CN' ? '目标（可多选）' : 'Goals (multi-select)'}
                <div className="flex flex-wrap gap-2">
                  {[
                    ['acne', language === 'CN' ? '控痘' : 'Acne'],
                    ['redness', language === 'CN' ? '泛红/敏感' : 'Redness'],
                    ['dark_spots', language === 'CN' ? '淡斑/痘印' : 'Dark spots'],
                    ['dehydration', language === 'CN' ? '补水' : 'Hydration'],
                    ['pores', language === 'CN' ? '毛孔' : 'Pores'],
                    ['wrinkles', language === 'CN' ? '抗老' : 'Anti-aging'],
                  ].map(([key, label]) => {
                    const selected = profileDraft.goals.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`chip-button ${selected ? 'chip-button-primary' : ''}`}
                        onClick={() =>
                          setProfileDraft((p) => ({
                            ...p,
                            goals: selected ? p.goals.filter((g) => g !== key) : [...p.goals, key],
                          }))
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="chip-button"
                  onClick={() => setProfileSheetOpen(false)}
                  disabled={isLoading}
                >
                  {language === 'CN' ? '取消' : 'Cancel'}
                </button>
                <button type="button" className="chip-button chip-button-primary" onClick={saveProfile} disabled={isLoading}>
                  {language === 'CN' ? '保存' : 'Save'}
                </button>
              </div>
            </div>
          </Sheet>

          <Sheet
            open={checkinSheetOpen}
            title={language === 'CN' ? '今日打卡' : 'Daily check-in'}
            onClose={() => setCheckinSheetOpen(false)}
          >
            <div className="space-y-4">
              {(
                [
                  ['redness', language === 'CN' ? '泛红' : 'Redness'],
                  ['acne', language === 'CN' ? '痘痘' : 'Acne'],
                  ['hydration', language === 'CN' ? '干燥/紧绷' : 'Dryness'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{label}</span>
                    <span className="font-medium text-foreground">{(checkinDraft as any)[key]}/5</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={1}
                    value={(checkinDraft as any)[key]}
                    onChange={(e) => {
                      const n = asNumber(e.target.value) ?? 0;
                      setCheckinDraft((p) => ({ ...p, [key]: Math.max(0, Math.min(5, Math.trunc(n))) } as any));
                    }}
                    className="w-full accent-[hsl(var(--primary))]"
                  />
                </div>
              ))}

              <label className="space-y-1 text-xs text-muted-foreground">
                {language === 'CN' ? '备注（可选）' : 'Notes (optional)'}
                <textarea
                  className="min-h-[84px] w-full resize-none rounded-2xl border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground"
                  value={checkinDraft.notes}
                  onChange={(e) => setCheckinDraft((p) => ({ ...p, notes: e.target.value }))}
                  placeholder={language === 'CN' ? '例如：今天有点刺痛/爆痘…' : 'e.g., stinging / breakout today…'}
                />
              </label>

              <div className="flex gap-2">
                <button type="button" className="chip-button" onClick={() => setCheckinSheetOpen(false)} disabled={isLoading}>
                  {language === 'CN' ? '取消' : 'Cancel'}
                </button>
                <button type="button" className="chip-button chip-button-primary" onClick={saveCheckin} disabled={isLoading}>
                  {language === 'CN' ? '保存' : 'Save'}
                </button>
              </div>
            </div>
          </Sheet>

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
                  <BffCardView key={card.card_id} card={card} language={language} debug={debug} />
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
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-muted/70 text-foreground/80"
            onClick={handlePickPhoto}
            disabled={isLoading}
            title={language === 'CN' ? '上传照片' : 'Upload photo'}
          >
            <Camera className="h-5 w-5" />
          </button>
          <input ref={fileInputRef} className="hidden" type="file" accept="image/*" onChange={onPhotoSelected} />
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
