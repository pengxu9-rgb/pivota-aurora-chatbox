import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Card, SuggestedChip, V1Action, V1Envelope } from '@/lib/pivotaAgentBff';
import { bffJson, makeDefaultHeaders, PivotaAgentBffError } from '@/lib/pivotaAgentBff';
import { AnalysisSummaryCard } from '@/components/chat/cards/AnalysisSummaryCard';
import { DiagnosisCard } from '@/components/chat/cards/DiagnosisCard';
import { PhotoUploadCard } from '@/components/chat/cards/PhotoUploadCard';
import { looksLikeProductPicksRawText, ProductPicksCard } from '@/components/chat/cards/ProductPicksCard';
import { AuroraAnchorCard } from '@/components/aurora/cards/AuroraAnchorCard';
import { AuroraLoadingCard } from '@/components/aurora/cards/AuroraLoadingCard';
import { DupeComparisonCard } from '@/components/aurora/cards/DupeComparisonCard';
import { AuroraRoutineCard } from '@/components/aurora/cards/AuroraRoutineCard';
import { SkinIdentityCard } from '@/components/aurora/cards/SkinIdentityCard';
import type { DiagnosisResult, FlowState, Language as UiLanguage, Offer, Product, Session, SkinConcern, SkinType } from '@/lib/types';
import { t } from '@/lib/i18n';
import { clearAuroraAuthSession, loadAuroraAuthSession, saveAuroraAuthSession } from '@/lib/auth';
import {
  Activity,
  ArrowRight,
  Beaker,
  Camera,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  FlaskConical,
  Globe,
  HelpCircle,
  AlertTriangle,
  ListChecks,
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

type RoutineDraft = {
  am: { cleanser: string; treatment: string; moisturizer: string; spf: string };
  pm: { cleanser: string; treatment: string; moisturizer: string };
  notes: string;
};

const makeEmptyRoutineDraft = (): RoutineDraft => ({
  am: { cleanser: '', treatment: '', moisturizer: '', spf: '' },
  pm: { cleanser: '', treatment: '', moisturizer: '' },
  notes: '',
});

const hasAnyRoutineDraftInput = (draft: RoutineDraft): boolean => {
  const values = [
    draft.am.cleanser,
    draft.am.treatment,
    draft.am.moisturizer,
    draft.am.spf,
    draft.pm.cleanser,
    draft.pm.treatment,
    draft.pm.moisturizer,
    draft.notes,
  ];
  return values.some((v) => Boolean(String(v || '').trim()));
};

const buildCurrentRoutinePayloadFromDraft = (draft: RoutineDraft) => {
  const am: Array<{ step: string; product: string }> = [];
  const pm: Array<{ step: string; product: string }> = [];

  const pushStep = (list: Array<{ step: string; product: string }>, step: string, value: string) => {
    const v = String(value || '').trim();
    if (!v) return;
    list.push({ step, product: v.slice(0, 500) });
  };

  pushStep(am, 'cleanser', draft.am.cleanser);
  pushStep(am, 'treatment', draft.am.treatment);
  pushStep(am, 'moisturizer', draft.am.moisturizer);
  pushStep(am, 'spf', draft.am.spf);

  pushStep(pm, 'cleanser', draft.pm.cleanser);
  pushStep(pm, 'treatment', draft.pm.treatment);
  pushStep(pm, 'moisturizer', draft.pm.moisturizer);

  const notes = String(draft.notes || '').trim();

  return {
    schema_version: 'aurora.routine_intake.v1',
    am,
    pm,
    ...(notes ? { notes: notes.slice(0, 1200) } : {}),
  } as const;
};

const routineDraftToDisplayText = (draft: RoutineDraft, language: UiLanguage) => {
  const lines: string[] = [];

  const add = (label: string, value: string) => {
    const v = String(value || '').trim();
    if (!v) return;
    lines.push(`${label}: ${v}`);
  };

  lines.push('AM');
  add('Cleanser', draft.am.cleanser);
  add('Treatment', draft.am.treatment);
  add('Moisturizer', draft.am.moisturizer);
  add('SPF', draft.am.spf);

  lines.push('');
  lines.push('PM');
  add('Cleanser', draft.pm.cleanser);
  add('Treatment', draft.pm.treatment);
  add('Moisturizer', draft.pm.moisturizer);

  const notes = String(draft.notes || '').trim();
  if (notes) {
    lines.push('');
    lines.push(language === 'CN' ? `备注: ${notes}` : `Notes: ${notes}`);
  }

  return lines.join('\n').trim();
};

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

const toBffErrorMessage = (err: unknown): string => {
  if (err instanceof PivotaAgentBffError) {
    const body = err.responseBody as any;
    const msg = body?.assistant_message?.content;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
};

const LANG_PREF_KEY = 'pivota_aurora_lang_pref_v1';

const getInitialLanguage = (): UiLanguage => {
  try {
    const stored = window.localStorage.getItem(LANG_PREF_KEY);
    if (stored === 'EN' || stored === 'CN') return stored;
  } catch {
    // ignore
  }

  try {
    const nav = (navigator.language || '').toLowerCase();
    if (nav.startsWith('zh')) return 'CN';
  } catch {
    // ignore
  }

  return 'EN';
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
  if (key === 'analysis_summary') return language === 'CN' ? '肤况分析（7 天策略）' : 'Skin assessment (7-day plan)';
  if (key === 'recommendations') return language === 'CN' ? '护肤方案（AM/PM）' : 'Routine (AM/PM)';
  if (key === 'product_parse') return language === 'CN' ? '产品解析' : 'Product parse';
  if (key === 'product_analysis') return language === 'CN' ? '单品评估（Deep Scan）' : 'Product deep scan';
  if (key === 'dupe_compare') return language === 'CN' ? '平替对比（Tradeoffs）' : 'Dupe compare (tradeoffs)';
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

const isEnvStressCard = (card: Card): boolean => {
  const type = String(card?.type || '').trim().toLowerCase();
  if (type === 'env_stress' || type === 'environment_stress') return true;

  const payload = card?.payload;
  const schema =
    payload && typeof payload === 'object' && !Array.isArray(payload) && typeof (payload as any).schema_version === 'string'
      ? String((payload as any).schema_version || '').trim().toLowerCase()
      : '';
  return Boolean(schema && schema.includes('env_stress'));
};

const asArray = (v: unknown) => (Array.isArray(v) ? v : []);
const asObject = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const asString = (v: unknown) => (typeof v === 'string' ? v : v == null ? null : String(v));
const asNumber = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const asNumberRecord = (v: unknown): Record<string, number> | undefined => {
  const o = asObject(v);
  if (!o) return undefined;
  const out: Record<string, number> = {};
  for (const [k, raw] of Object.entries(o)) {
    const key = String(k || '').trim();
    if (!key) continue;
    const n = asNumber(raw);
    if (n == null) continue;
    out[key] = n;
  }
  return Object.keys(out).length ? out : undefined;
};

const uniqueStrings = (items: unknown): string[] => {
  if (!Array.isArray(items)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of items) {
    const v = String(raw ?? '').trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
};

const asSkinType = (v: unknown): SkinType | null => {
  const s = asString(v);
  if (!s) return null;
  const norm = s.trim().toLowerCase();
  if (norm === 'oily' || norm === 'dry' || norm === 'combination' || norm === 'normal' || norm === 'sensitive') return norm as SkinType;
  return null;
};

const GOAL_TO_CONCERN: Record<string, SkinConcern> = {
  acne: 'acne',
  'dark spots': 'dark_spots',
  dark_spots: 'dark_spots',
  hyperpigmentation: 'dark_spots',
  dullness: 'dullness',
  wrinkles: 'wrinkles',
  aging: 'wrinkles',
  redness: 'redness',
  pores: 'pores',
  dehydration: 'dehydration',
  repair: 'dehydration',
  barrier: 'dehydration',
};

const asConcern = (v: unknown): SkinConcern | null => {
  const s = asString(v);
  if (!s) return null;
  const norm = s.trim().toLowerCase();
  return GOAL_TO_CONCERN[norm] ?? null;
};

function toDiagnosisResult(profile: Record<string, unknown> | null): DiagnosisResult {
  const skinType = asSkinType(profile?.skinType);
  const goals = asArray(profile?.goals);
  const concerns = goals.map((g) => asConcern(g)).filter(Boolean) as SkinConcern[];

  const barrierRaw = asString(profile?.barrierStatus);
  const barrier = barrierRaw ? barrierRaw.trim().toLowerCase() : '';
  const barrierStatus: DiagnosisResult['barrierStatus'] =
    barrier === 'healthy' || barrier === 'impaired' || barrier === 'unknown' ? (barrier as DiagnosisResult['barrierStatus']) : 'unknown';

  return {
    ...(skinType ? { skinType } : {}),
    concerns,
    currentRoutine: 'basic',
    ...(barrierStatus ? { barrierStatus } : {}),
  };
}

function toUiProduct(raw: Record<string, unknown>, language: UiLanguage): Product {
  const skuId =
    asString(raw.sku_id ?? raw.skuId ?? raw.product_id ?? raw.productId) ||
    `unknown_${Math.random().toString(16).slice(2)}`.slice(0, 24);
  const brand = asString(raw.brand) || '';
  const name = asString(raw.name) || asString(raw.display_name ?? raw.displayName) || '';
  const category = asString(raw.category) || '';
  const description = asString(raw.description) || '';
  const image_url = asString(raw.image_url ?? raw.imageUrl) || '';
  const size = asString(raw.size) || '';

  const product: Product = {
    sku_id: skuId,
    brand: brand || (language === 'CN' ? '未知品牌' : 'Unknown brand'),
    name: name || (language === 'CN' ? '未知产品' : 'Unknown product'),
    category: category || (language === 'CN' ? '未知品类' : 'Unknown'),
    description,
    image_url,
    size,
  };

  const mechanism = asNumberRecord(raw.mechanism) || asNumberRecord((raw as any).mechanism_vector);
  if (mechanism) product.mechanism = mechanism;

  const socialStats = asObject((raw as any).social_stats) || asObject((raw as any).socialStats);
  if (socialStats) product.social_stats = socialStats as any;

  const evidencePack = asObject((raw as any).evidence_pack) || asObject((raw as any).evidencePack);
  if (evidencePack) product.evidence_pack = evidencePack as any;

  const ingredients = asObject((raw as any).ingredients);
  if (ingredients) product.ingredients = ingredients as any;

  const keyActives = uniqueStrings((raw as any).key_actives);
  if (keyActives.length) product.key_actives = keyActives;

  return product;
}

function toUiOffer(raw: Record<string, unknown>): Offer {
  const offer_id = asString(raw.offer_id ?? (raw as any).offerId) || `offer_${Math.random().toString(16).slice(2)}`.slice(0, 24);
  const seller = asString(raw.seller) || '';
  const currency = asString(raw.currency) || 'USD';

  const price = asNumber(raw.price);
  const originalPrice = asNumber(raw.original_price ?? (raw as any).originalPrice);
  const shippingDays = asNumber(raw.shipping_days ?? (raw as any).shippingDays);
  const reliability = asNumber(raw.reliability_score ?? (raw as any).reliabilityScore);

  const badges = uniqueStrings(raw.badges)
    .filter((b) => ['best_price', 'best_returns', 'fastest_shipping', 'high_reliability'].includes(b))
    .slice(0, 6) as any;

  const purchaseRouteRaw = asString(raw.purchase_route ?? (raw as any).purchaseRoute);
  const affiliate_url = asString(raw.affiliate_url ?? (raw as any).affiliateUrl) || undefined;
  const purchase_route = (purchaseRouteRaw === 'internal_checkout' || purchaseRouteRaw === 'affiliate_outbound'
    ? purchaseRouteRaw
    : affiliate_url
      ? 'affiliate_outbound'
      : 'internal_checkout') as Offer['purchase_route'];

  return {
    offer_id,
    seller,
    price: price == null ? Number.NaN : price,
    currency,
    ...(originalPrice != null ? { original_price: originalPrice } : {}),
    shipping_days: shippingDays == null ? 0 : shippingDays,
    returns_policy: asString(raw.returns_policy ?? (raw as any).returnsPolicy) || '',
    reliability_score: reliability == null ? 0 : reliability,
    badges,
    in_stock: raw.in_stock === false ? false : true,
    purchase_route,
    ...(affiliate_url ? { affiliate_url } : {}),
  };
}

function toDupeProduct(raw: Record<string, unknown> | null, language: UiLanguage) {
  const r = raw ?? {};
  const brand = asString(r.brand) || (language === 'CN' ? '未知品牌' : 'Unknown brand');
  const name = asString(r.name) || asString(r.display_name ?? r.displayName) || (language === 'CN' ? '未知产品' : 'Unknown product');
  const imageUrl = asString((r as any).image_url ?? (r as any).imageUrl) || undefined;

  let price: number | undefined;
  let currency: string | undefined;
  const offers = asArray((r as any).offers).map((v) => asObject(v)).filter(Boolean) as Array<Record<string, unknown>>;
  if (offers.length) {
    price = asNumber(offers[0].price) ?? undefined;
    currency = asString(offers[0].currency) ?? undefined;
  }

  const priceObj = asObject((r as any).price);
  if (price == null && priceObj) {
    const usd = asNumber(priceObj.usd ?? priceObj.USD);
    const cny = asNumber(priceObj.cny ?? priceObj.CNY);
    if (usd != null) {
      price = usd;
      currency = 'USD';
    } else if (cny != null) {
      price = cny;
      currency = 'CNY';
    }
  }

  if (price == null) price = asNumber((r as any).price) ?? undefined;
  if (!currency) currency = asString((r as any).currency) ?? undefined;

  return {
    imageUrl,
    brand,
    name,
    ...(typeof price === 'number' && Number.isFinite(price) ? { price } : {}),
    ...(currency ? { currency } : {}),
    ...(asNumberRecord((r as any).mechanism) ? { mechanism: asNumberRecord((r as any).mechanism) } : {}),
    ...((asObject((r as any).experience) ? { experience: (r as any).experience } : {}) as any),
    ...(uniqueStrings((r as any).risk_flags).length ? { risk_flags: uniqueStrings((r as any).risk_flags) } : {}),
    ...((asObject((r as any).social_stats) ? { social_stats: (r as any).social_stats } : {}) as any),
    ...(uniqueStrings((r as any).key_actives).length ? { key_actives: uniqueStrings((r as any).key_actives) } : {}),
    ...((asObject((r as any).evidence_pack) ? { evidence_pack: (r as any).evidence_pack } : {}) as any),
    ...((asObject((r as any).ingredients) ? { ingredients: (r as any).ingredients } : {}) as any),
  };
}

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
    price_unknown: { CN: '价格未知', EN: 'Price unknown' },
    availability_unknown: { CN: '可购买渠道/地区未知', EN: 'Availability unknown' },
    recent_logs_missing: { CN: '缺少最近 7 天肤况记录', EN: 'No recent 7-day skin logs' },
    itinerary_unknown: { CN: '缺少行程/环境信息', EN: 'No itinerary / upcoming plan context' },
    evidence_missing: { CN: '证据不足', EN: 'Evidence missing' },
    upstream_missing_or_unstructured: { CN: '上游返回缺失/不规范', EN: 'Upstream missing/unstructured' },
    upstream_missing_or_empty: { CN: '上游返回为空', EN: 'Upstream empty' },
    alternatives_partial: { CN: '部分步骤缺少平替/相似选项', EN: 'Alternatives missing for some steps' },
  };
  return map[c]?.[language] ?? c;
}

function RecommendationsCard({
  card,
  language,
  debug,
  resolveSkuOffers,
}: {
  card: Card;
  language: 'EN' | 'CN';
  debug: boolean;
  resolveSkuOffers?: (skuId: string) => Promise<any>;
}) {
  const [offerCache, setOfferCache] = useState<Record<string, string>>({});
  const [offersLoading, setOffersLoading] = useState<string | null>(null);

  const payload = asObject(card.payload) || {};
  const items = asArray(payload.recommendations) as RecoItem[];
  const hasAnyAlternatives = items.some((it) => asArray((it as any).alternatives).length > 0);
  const [detailsOpen, setDetailsOpen] = useState(() => hasAnyAlternatives);

  const openFallback = useCallback((brand: string | null, name: string | null) => {
    const q = [brand, name]
      .map((v) => String(v || '').trim())
      .filter(Boolean)
      .join(' ');
    const url = `https://www.google.com/search?q=${encodeURIComponent(q || 'skincare product')}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const openPurchase = useCallback(
    async ({ skuId, brand, name }: { skuId: string; brand: string | null; name: string | null }) => {
      if (!skuId) return openFallback(brand, name);
      const cached = offerCache[skuId];
      if (cached) {
        window.open(cached, '_blank', 'noopener,noreferrer');
        return;
      }

      if (!resolveSkuOffers) {
        openFallback(brand, name);
        return;
      }

      setOffersLoading(skuId);
      try {
        const resp = await resolveSkuOffers(skuId);
        const offers = Array.isArray(resp?.offers)
          ? resp.offers
          : Array.isArray(resp?.data?.offers)
            ? resp.data.offers
            : [];

        const normalizeUrl = (raw: any) => (typeof raw === 'string' && raw.trim() ? raw.trim() : null);
        const readCheckoutUrl = (o: any) =>
          normalizeUrl(o?.checkout_url ?? o?.checkoutUrl ?? o?.purchase_url ?? o?.purchaseUrl ?? o?.internal_checkout_url ?? o?.internalCheckoutUrl);
        const readAffiliateUrl = (o: any) =>
          normalizeUrl(o?.affiliate_url ?? o?.affiliateUrl ?? o?.external_redirect_url ?? o?.externalRedirectUrl ?? o?.external_url ?? o?.externalUrl);
        const readGenericUrl = (o: any) => normalizeUrl(o?.url);
        const readPurchaseRoute = (o: any) => String(o?.purchase_route ?? o?.purchaseRoute ?? '').trim().toLowerCase();
        const hasInternalPayload = (o: any) => Boolean(o?.internal_checkout ?? o?.internalCheckout);

        const isInternal = (o: any) => readPurchaseRoute(o) === 'internal_checkout' || hasInternalPayload(o) || Boolean(readCheckoutUrl(o));
        const isExternal = (o: any) => readPurchaseRoute(o) === 'affiliate_outbound' || Boolean(readAffiliateUrl(o));

        const internalOffer = offers.find((o: any) => isInternal(o) && (readCheckoutUrl(o) || readGenericUrl(o)));
        const externalOffer = offers.find((o: any) => isExternal(o) && (readAffiliateUrl(o) || readGenericUrl(o)));

        const chosen = internalOffer || externalOffer || offers.find((o: any) => readAffiliateUrl(o) || readCheckoutUrl(o) || readGenericUrl(o)) || null;
        const url = chosen
          ? readCheckoutUrl(chosen) || readAffiliateUrl(chosen) || readGenericUrl(chosen) || ''
          : '';
        if (!url) {
          openFallback(brand, name);
          return;
        }
        setOfferCache((prev) => ({ ...prev, [skuId]: url }));
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch {
        openFallback(brand, name);
      } finally {
        setOffersLoading(null);
      }
    },
    [offerCache, openFallback, resolveSkuOffers],
  );

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
    const skuId = asString((sku as any)?.sku_id) || asString((sku as any)?.skuId) || null;
    const step = asString(item.step) || asString(item.category) || (language === 'CN' ? '步骤' : 'Step');
    const notes = asArray(item.notes).map((n) => asString(n)).filter(Boolean) as string[];
    const alternativesRaw = asArray((item as any).alternatives).map((v) => asObject(v)).filter(Boolean) as Array<Record<string, unknown>>;
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

    const labelKind = (kindRaw: string | null) => {
      const k = String(kindRaw || '').trim().toLowerCase();
      if (k === 'dupe') return language === 'CN' ? '平替' : 'Dupe';
      if (k === 'premium') return language === 'CN' ? '升级款' : 'Premium';
      return language === 'CN' ? '相似' : 'Similar';
    };

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

        {skuId ? (
          <div className="mt-2">
            <button
              type="button"
              className="chip-button"
              disabled={offersLoading === skuId}
              onClick={() => void openPurchase({ skuId, brand, name })}
            >
              {language === 'CN' ? '购买' : 'Buy'}
              {offersLoading === skuId ? <span className="ml-2 text-xs text-muted-foreground">{language === 'CN' ? '加载中…' : 'Loading…'}</span> : null}
            </button>
          </div>
        ) : null}

        {alternativesRaw.length ? (
          <details className="mt-2 rounded-xl border border-border/50 bg-muted/30 p-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium text-primary/90">
              <span>{language === 'CN' ? '相似/平替/升级选择（点击查看差异）' : 'Alternatives (dupe / similar / premium) — see tradeoffs'}</span>
              <ChevronDown className="h-4 w-4" />
            </summary>
            <div className="mt-3 space-y-2">
              {alternativesRaw.slice(0, 3).map((alt, j) => {
                const kind = asString((alt as any).kind);
                const kindLabel = labelKind(kind);
                const similarity = asNumber((alt as any).similarity);
                const altProduct = asObject((alt as any).product) || null;
                const altBrand = asString(altProduct?.brand) || null;
                const altName =
                  asString(altProduct?.name) || asString((altProduct as any)?.display_name) || asString((altProduct as any)?.displayName) || null;
                const altSkuId =
                  asString((altProduct as any)?.sku_id) ||
                  asString((altProduct as any)?.skuId) ||
                  asString((altProduct as any)?.product_id) ||
                  asString((altProduct as any)?.productId) ||
                  '';
                const tradeoffs = uniqueStrings((alt as any).tradeoffs).slice(0, 4);
                const reasons = uniqueStrings((alt as any).reasons).slice(0, 2);
                const reason = reasons.length
                  ? reasons[0]
                    .replace(/^pros:\s*/i, '')
                    .replace(/^优势：\s*/i, '')
                    .trim()
                  : null;

                const availability = uniqueStrings(asArray((altProduct as any)?.availability)).find(Boolean) || null;
                const priceObj = asObject((altProduct as any)?.price);
                const priceUnknown = Boolean(priceObj && (priceObj as any).unknown === true);
                const priceUsd = priceObj ? asNumber((priceObj as any).usd) : null;
                const priceCny = priceObj ? asNumber((priceObj as any).cny) : null;
                const priceNumber = !priceObj ? asNumber((altProduct as any)?.price) : null;
                const currencyRaw = asString((altProduct as any)?.currency) || null;
                const currency = currencyRaw ? currencyRaw.toUpperCase() : null;
                const currencySymbol = currency === 'CNY' || currency === 'RMB' ? '¥' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
                const priceText = priceUnknown
                  ? '—'
                  : priceUsd != null
                    ? `$${Math.round(priceUsd * 100) / 100}`
                    : priceCny != null
                      ? `¥${Math.round(priceCny)}`
                      : priceNumber != null
                        ? `${currencySymbol}${Math.round(priceNumber * 100) / 100}`
                        : '—';

                return (
                  <div key={`${kindLabel}_${j}_${altSkuId || altName || 'alt'}`} className="rounded-xl border border-border/60 bg-background/60 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                          <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-0.5">{kindLabel}</span>
                          {typeof similarity === 'number' ? (
                            <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-0.5">
                              {language === 'CN' ? `相似度 ${Math.round(similarity)}%` : `${Math.round(similarity)}% similar`}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-sm font-semibold text-foreground">
                          {altBrand ? `${altBrand} ` : ''}
                          {altName || (language === 'CN' ? '未知产品' : 'Unknown product')}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="whitespace-nowrap">{priceText}</span>
                          {availability ? (
                            <span className="whitespace-nowrap rounded-full border border-border/60 bg-muted/60 px-2 py-0.5">
                              {availability}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="chip-button"
                        disabled={Boolean(altSkuId) && offersLoading === altSkuId}
                        onClick={() => void openPurchase({ skuId: altSkuId, brand: altBrand, name: altName })}
                      >
                        {language === 'CN' ? '购买' : 'Buy'}
                      </button>
                    </div>

                    {reason ? (
                      <div className="mt-2 text-xs text-foreground/90">
                        <span className="font-semibold text-muted-foreground">{language === 'CN' ? '推荐理由：' : 'Why: '}</span>
                        {reason}
                      </div>
                    ) : null}

                    {tradeoffs.length ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                        {tradeoffs.slice(0, 4).map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {language === 'CN' ? '差异信息缺失（上游未返回 tradeoffs）。' : 'Tradeoffs missing (upstream did not return details).'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
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

  const warningLike = new Set([
    'over_budget',
    'price_unknown',
    'availability_unknown',
    'recent_logs_missing',
    'itinerary_unknown',
    'analysis_missing',
    'evidence_missing',
    'upstream_missing_or_unstructured',
    'upstream_missing_or_empty',
    'alternatives_partial',
  ]);

  const rawMissing = uniqueStrings(
    Array.isArray(payload.missing_info) && payload.missing_info.length ? (payload.missing_info as unknown[]) : [],
  );
  const rawWarnings = uniqueStrings((payload as any)?.warnings ?? (payload as any)?.warning ?? (payload as any)?.context_gaps ?? (payload as any)?.contextGaps);

  const showWarnings = uniqueStrings([...rawWarnings, ...rawMissing.filter((c) => warningLike.has(String(c)))]).slice(0, 6);
  const showMissing = rawMissing.filter((c) => !warningLike.has(String(c))).slice(0, 6);
  const warningLabels = showWarnings
    .map((code) => {
      const label = labelMissing(code, language);
      if (!label) return null;
      if (!debug && label === code) return null;
      return label;
    })
    .filter(Boolean)
    .join(' · ');

  const renderSection = (slot: 'am' | 'pm' | 'other', list: RecoItem[]) => {
    if (!list.length) return null;
    return (
      <section className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground">{sectionTitle(slot)}</div>
        <div className="space-y-2">{list.map(renderStep)}</div>
      </section>
    );
  };

  const normalizeCategory = (raw: string) => {
    const s = String(raw || '').trim().toLowerCase();
    if (!s) return 'treatment';
    if (s.includes('cleanser') || s.includes('洁面')) return 'cleanser';
    if (s.includes('spf') || s.includes('sunscreen') || s.includes('防晒')) return 'sunscreen';
    if (s.includes('moistur') || s.includes('cream') || s.includes('lotion') || s.includes('保湿') || s.includes('面霜') || s.includes('乳液'))
      return 'moisturizer';
    if (s.includes('treatment') || s.includes('serum') || s.includes('精华') || s.includes('功效')) return 'treatment';
    return raw;
  };

  const toRoutineSteps = (list: RecoItem[]) =>
    list
      .map((item, idx) => {
        const sku = asObject(item.sku) || asObject(item.product) || null;
        const brand = asString(sku?.brand) || asString((sku as any)?.Brand) || '';
        const name = asString(sku?.name) || asString(sku?.display_name) || asString((sku as any)?.displayName) || '';
        const step = asString(item.step) || asString(item.category) || '';
        const typeRaw =
          (asString((item as any).type) || asString((item as any).tier) || asString((item as any).kind) || '').toLowerCase();
        const type = typeRaw.includes('dupe') ? 'dupe' : 'premium';

        if (!brand && !name) return null;
        return {
          category: normalizeCategory(step || ''),
          product: { brand: brand || (language === 'CN' ? '未知品牌' : 'Unknown'), name: name || (language === 'CN' ? '未知产品' : 'Unknown') },
          type,
          _idx: idx,
        };
      })
      .filter(Boolean)
      .slice(0, 12) as Array<{ category: string; product: { brand: string; name: string }; type: 'premium' | 'dupe'; _idx: number }>;

  const amSteps = toRoutineSteps(groups.am);
  const pmSteps = toRoutineSteps(groups.pm);

  return (
    <div className="space-y-3">
      {(amSteps.length || pmSteps.length) ? (
        <AuroraRoutineCard
          amSteps={amSteps}
          pmSteps={pmSteps}
          compatibility="unknown"
          language={language}
        />
      ) : null}

      {(groups.am.length || groups.pm.length || groups.other.length) ? (
        <details
          className="rounded-2xl border border-border/60 bg-background/60 p-3"
          open={detailsOpen}
          onToggle={(e) => setDetailsOpen((e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
            <span>
              {hasAnyAlternatives
                ? language === 'CN'
                  ? '查看详细步骤（含相似/平替/升级选择）'
                  : 'View detailed steps (incl. alternatives)'
                : language === 'CN'
                  ? '查看详细步骤与证据'
                  : 'View detailed steps & evidence'}
            </span>
            <ChevronDown className="h-4 w-4" />
          </summary>
          <div className="mt-3 space-y-3">
            {renderSection('am', groups.am)}
            {renderSection('pm', groups.pm)}
            {renderSection('other', groups.other)}
          </div>
        </details>
      ) : null}

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

      {showWarnings.length && (debug || warningLabels) ? (
        <div className="rounded-2xl border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
          {language === 'CN' ? '提示：' : 'Note: '}
          {warningLabels || showWarnings.join(' · ')}
        </div>
      ) : null}
    </div>
  );
}

function BffCardView({
  card,
  language,
  debug,
  session,
  onAction,
  resolveSkuOffers,
  bootstrapInfo,
}: {
  card: Card;
  language: UiLanguage;
  debug: boolean;
  session: Session;
  onAction: (actionId: string, data?: Record<string, any>) => void;
  resolveSkuOffers?: (skuId: string) => Promise<any>;
  bootstrapInfo?: BootstrapInfo | null;
}) {
  const cardType = String(card.type || '').toLowerCase();
  if (
    !debug &&
    (cardType === 'aurora_structured' ||
      cardType === 'gate_notice' ||
      cardType === 'session_bootstrap' ||
      cardType === 'budget_gate')
  )
    return null;

  const payloadObj = asObject(card.payload);
  const payload = payloadObj ?? (card.payload as any);

  if (cardType === 'recommendations') {
    const intent = String((payload as any)?.intent || '').trim().toLowerCase();
    if (intent === 'reco_products') {
      const profileFromPayload = asObject((payload as any)?.profile);
      const profileFromBootstrap = bootstrapInfo?.profile && typeof bootstrapInfo.profile === 'object' ? bootstrapInfo.profile : null;
      const profile = profileFromPayload || profileFromBootstrap || null;
      return (
        <div className="chat-card">
          <ProductPicksCard rawContent={{ ...(payloadObj || {}), profile }} />
        </div>
      );
    }
  }

  if (cardType === 'diagnosis_gate') {
    return <DiagnosisCard onAction={(id, data) => onAction(id, data)} language={language} />;
  }

  if (cardType === 'analysis_summary') {
    const analysisObj = asObject((payload as any).analysis) || {};
    const featuresRaw = asArray((analysisObj as any).features).map((v) => asObject(v)).filter(Boolean) as Array<Record<string, unknown>>;
    const features = featuresRaw
      .map((f) => ({
        observation: asString(f.observation) || '',
        confidence: (asString(f.confidence) || 'somewhat_sure') as 'pretty_sure' | 'somewhat_sure' | 'not_sure',
      }))
      .filter((f) => Boolean(f.observation))
      .slice(0, 8);
    const analysis = {
      features,
      strategy: asString((analysisObj as any).strategy) || '',
      needs_risk_check: (analysisObj as any).needs_risk_check === true,
    };

    const analysisSource = asString((payload as any).analysis_source) || '';
    const missing = Array.isArray(card.field_missing) ? card.field_missing : [];
    const lowConfidence =
      analysisSource === 'baseline_low_confidence' ||
      missing.some((m) => String((m as any)?.field || '').toLowerCase().includes('currentroutine'));
    const photosProvided = (payload as any).photos_provided === true;

    return (
      <AnalysisSummaryCard
        payload={{ analysis: analysis as any, session, low_confidence: lowConfidence, photos_provided: photosProvided }}
        onAction={(id, data) => onAction(id, data)}
        language={language}
      />
    );
  }

  if (cardType === 'profile') {
    const profilePayload = asObject((payload as any)?.profile) ?? asObject(payload) ?? null;
    const diagnosis = toDiagnosisResult(profilePayload);
    return (
      <div className="space-y-3">
        <SkinIdentityCard
          payload={{ diagnosis, avatarUrl: null, photoHint: true }}
          onAction={(id, data) => onAction(id, data)}
          language={language}
        />
      </div>
    );
  }

  const Icon = iconForCard(card.type);
  const title = titleForCard(card.type, language);
  const fieldMissingCount = Array.isArray(card.field_missing) ? card.field_missing.length : 0;

  const qcStatus = asString((payload as any)?.qc_status);
  const qcObj = asObject((payload as any)?.qc);
  const qcAdvice = asObject(qcObj?.advice);
  const qcSummary = asString(qcAdvice?.summary) || null;
  const qcSuggestions = asArray(qcAdvice?.suggestions).map((s) => asString(s)).filter(Boolean) as string[];

  const missingInfo = uniqueStrings((payload as any)?.missing_info);

  const evidence = asObject((payload as any)?.evidence) || null;
  const science = asObject(evidence?.science) || null;
  const social = asObject(evidence?.social_signals || (evidence as any)?.socialSignals) || null;
  const expertNotes = uniqueStrings(evidence?.expert_notes || (evidence as any)?.expertNotes);

  const evidenceKeyIngredients = uniqueStrings(science?.key_ingredients || (science as any)?.keyIngredients).slice(0, 10);
  const evidenceMechanisms = uniqueStrings(science?.mechanisms).slice(0, 8);
  const evidenceFitNotes = uniqueStrings(science?.fit_notes || (science as any)?.fitNotes).slice(0, 6);
  const evidenceRiskNotes = uniqueStrings(science?.risk_notes || (science as any)?.riskNotes).slice(0, 6);

  const platformScores = asObject(social?.platform_scores || (social as any)?.platformScores) || null;
  const socialPositive = uniqueStrings(social?.typical_positive || (social as any)?.typicalPositive).slice(0, 6);
  const socialNegative = uniqueStrings(social?.typical_negative || (social as any)?.typicalNegative).slice(0, 6);
  const socialRisks = uniqueStrings(social?.risk_for_groups || (social as any)?.riskForGroups).slice(0, 6);

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

      {cardType === 'recommendations' ? (
        <RecommendationsCard
          card={card}
          language={language}
          debug={debug}
          resolveSkuOffers={resolveSkuOffers}
        />
      ) : null}

      {cardType === 'routine_simulation' ? (() => {
        const safe = (payload as any)?.safe === true;
        const summary = asString((payload as any)?.summary) || '';
        const conflicts = asArray((payload as any)?.conflicts).map((c) => asObject(c)).filter(Boolean) as Array<Record<string, unknown>>;
        const Icon = safe ? CheckCircle2 : AlertTriangle;
        const tone = safe ? 'text-emerald-700 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-700 bg-amber-500/10 border-amber-500/20';
        return (
          <div className="space-y-3">
            <div className={`flex items-start gap-3 rounded-2xl border p-3 ${tone}`}>
              <Icon className="h-5 w-5" />
              <div className="space-y-1">
                <div className="text-sm font-semibold">
                  {safe
                    ? language === 'CN'
                      ? '看起来兼容 ✅'
                      : 'Looks compatible ✅'
                    : language === 'CN'
                      ? '存在刺激/冲突风险'
                      : 'Irritation/conflict risks detected'}
                </div>
                {summary ? <div className="text-xs text-muted-foreground">{summary}</div> : null}
              </div>
            </div>

            {conflicts.length ? (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? '冲突点' : 'Conflicts'}</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                  {conflicts.slice(0, 6).map((c, idx) => {
                    const rule = asString(c.rule_id) || asString((c as any).ruleId) || '';
                    const msg = asString(c.message) || '';
                    const sev = asString(c.severity) || '';
                    return (
                      <li key={`${rule || 'c'}_${idx}`}>
                        {msg}
                        {(rule || sev) ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {rule ? `(${rule}${sev ? ` · ${sev}` : ''})` : sev ? `(${sev})` : ''}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        );
      })() : null}

      {cardType === 'offers_resolved' ? (() => {
        const items = asArray((payload as any)?.items).map((v) => asObject(v)).filter(Boolean) as Array<Record<string, unknown>>;
        if (!items.length) return null;

        return (
          <div className="space-y-3">
            {items.slice(0, 8).map((item, idx) => {
              const productRaw = asObject(item.product);
              const offerRaw = asObject(item.offer);
              if (!productRaw) return null;
              const product = toUiProduct(productRaw, language);
              const offer = offerRaw ? toUiOffer(offerRaw) : null;
              const outboundUrl = offer?.purchase_route === 'affiliate_outbound' ? offer.affiliate_url : undefined;

              return (
                <div key={`${product.sku_id}_${idx}`} className="space-y-2">
                  <AuroraAnchorCard product={product} offers={offer ? [offer] : []} language={language} />

                  {outboundUrl ? (
                    <button
                      type="button"
                      className="chip-button chip-button-primary w-full"
                      onClick={() => onAction('affiliate_open', { url: outboundUrl, offer_id: offer?.offer_id })}
                    >
                      <ExternalLink className="h-4 w-4" />
                      {language === 'CN' ? '打开购买链接' : 'Open purchase link'}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      })() : null}

      {cardType === 'error' ? (() => {
        const code = asString((payload as any)?.error) || 'UNKNOWN_ERROR';
        const status = asNumber((payload as any)?.status);
        const details = (payload as any)?.details ?? null;
        return (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <div className="font-semibold">
              {code}
              {typeof status === 'number' ? ` (HTTP ${status})` : ''}
            </div>
            {details ? (
              <pre className="mt-2 max-h-[220px] overflow-auto rounded-xl bg-muted p-3 text-[11px] text-foreground">
                {renderJson(details)}
              </pre>
            ) : null}
          </div>
        );
      })() : null}

      {cardType === 'product_parse' ? (() => {
        const productRaw = asObject((payload as any).product);
        const product = productRaw ? toUiProduct(productRaw, language) : null;
        const confidence = asNumber((payload as any).confidence);
        const parsedMissing = uniqueStrings((payload as any).missing_info);

        return (
          <div className="space-y-3">
            {product ? (
              <AuroraAnchorCard product={product} offers={[]} language={language} />
            ) : (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-3 text-sm text-foreground">
                {language === 'CN' ? '未能解析出产品实体（上游缺失）。' : 'Failed to parse a product entity (upstream missing).'}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {typeof confidence === 'number' && Number.isFinite(confidence) ? (
                <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px] font-medium text-muted-foreground">
                  {language === 'CN' ? `置信度 ${(confidence * 100).toFixed(0)}%` : `Confidence ${(confidence * 100).toFixed(0)}%`}
                </span>
              ) : null}
              {parsedMissing.slice(0, 4).map((m) => (
                <span
                  key={m}
                  className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px] font-medium text-muted-foreground"
                >
                  {labelMissing(m, language as any) || m}
                </span>
              ))}
            </div>
          </div>
        );
      })() : null}

      {cardType === 'product_analysis' ? (() => {
        const assessment = asObject((payload as any).assessment);
        const verdictRaw = asString(assessment?.verdict);
        const verdict = verdictRaw ? verdictRaw.trim() : null;
        const reasons = uniqueStrings(assessment?.reasons).slice(0, 6);
        const heroRaw = asObject((assessment as any)?.hero_ingredient || (assessment as any)?.heroIngredient) || null;
        const heroName = asString(heroRaw?.name);
        const heroRole = asString(heroRaw?.role);
        const heroWhy = asString(heroRaw?.why);
        const anchorRaw = asObject((assessment as any)?.anchor_product || (assessment as any)?.anchorProduct);
        const product = anchorRaw ? toUiProduct(anchorRaw, language) : null;
        const howToUse = (assessment as any)?.how_to_use ?? (assessment as any)?.howToUse ?? null;

        const verdictStyle = (() => {
          const v = String(verdict || '').toLowerCase();
          if (v.includes('mismatch') || v.includes('not') || v.includes('avoid') || v.includes('veto')) return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
          if (v.includes('risky') || v.includes('caution') || v.includes('warn')) return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
          if (v.includes('suitable') || v.includes('good') || v.includes('yes')) return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
          return 'bg-muted/60 text-muted-foreground border-border/60';
        })();

        const renderHowToUse = () => {
          if (howToUse == null) return null;
          if (typeof howToUse === 'string') {
            const s = howToUse.trim();
            if (!s) return null;
            return <div className="text-sm text-foreground whitespace-pre-wrap">{s}</div>;
          }
          const o = asObject(howToUse);
          if (!o) return null;

          const timing = asString((o as any).timing) || asString((o as any).time) || null;
          const frequency = asString((o as any).frequency) || null;
          const notes = uniqueStrings((o as any).notes).slice(0, 6);
          const steps = uniqueStrings((o as any).steps).slice(0, 6);

          if (!timing && !frequency && !notes.length && !steps.length) return null;

          return (
            <div className="space-y-2 text-sm text-foreground">
              {(timing || frequency) ? (
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {timing ? (
                    <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-1">
                      {language === 'CN' ? `建议时段：${timing}` : `Timing: ${timing}`}
                    </span>
                  ) : null}
                  {frequency ? (
                    <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-1">
                      {language === 'CN' ? `频率：${frequency}` : `Frequency: ${frequency}`}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {steps.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                  {steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              ) : null}
              {notes.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                  {notes.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        };

        return (
          <div className="space-y-3">
            {product ? <AuroraAnchorCard product={product} offers={[]} language={language} /> : null}

            {verdict ? (
              <div className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold ${verdictStyle}`}>
                {language === 'CN' ? '结论：' : 'Verdict: '} {verdict}
              </div>
            ) : null}

            {(heroName || heroWhy) ? (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? '最关键成分' : 'Most impactful ingredient'}</div>
                {heroName ? <div className="mt-1 text-sm font-semibold text-foreground">{heroName}</div> : null}
                {heroRole ? (
                  <div className="mt-1 text-[11px] font-medium text-muted-foreground">
                    {language === 'CN' ? `角色：${heroRole}` : `Role: ${heroRole}`}
                  </div>
                ) : null}
                {heroWhy ? <div className="mt-2 text-sm text-foreground">{heroWhy}</div> : null}
              </div>
            ) : null}

            {reasons.length ? (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? '为什么' : 'Why'}</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                  {reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {renderHowToUse() ? (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? '怎么用更安全' : 'How to use safely'}</div>
                <div className="mt-2">{renderHowToUse()}</div>
              </div>
            ) : null}

            {(evidenceKeyIngredients.length ||
              evidenceMechanisms.length ||
              evidenceFitNotes.length ||
              evidenceRiskNotes.length ||
              socialPositive.length ||
              socialNegative.length ||
              socialRisks.length ||
              expertNotes.length ||
              platformScores) ? (
              <details className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
                  <span>{language === 'CN' ? '证据与注意事项' : 'Evidence & notes'}</span>
                  <ChevronDown className="h-4 w-4" />
                </summary>
                <div className="mt-3 space-y-3 text-sm text-foreground">
                  {evidenceKeyIngredients.length ? (
                    <div>
                      <div className="text-[11px] font-semibold text-muted-foreground">{language === 'CN' ? '关键成分' : 'Key ingredients'}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {evidenceKeyIngredients.map((x) => (
                          <span key={x} className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px]">
                            {x}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {evidenceMechanisms.length ? (
                    <div>
                      <div className="text-[11px] font-semibold text-muted-foreground">{language === 'CN' ? '机制/作用' : 'Mechanisms'}</div>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                        {evidenceMechanisms.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {evidenceFitNotes.length ? (
                    <div>
                      <div className="text-[11px] font-semibold text-muted-foreground">{language === 'CN' ? '适配提示' : 'Fit notes'}</div>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                        {evidenceFitNotes.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {evidenceRiskNotes.length ? (
                    <div>
                      <div className="text-[11px] font-semibold text-muted-foreground">{language === 'CN' ? '风险点' : 'Risks'}</div>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                        {evidenceRiskNotes.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {platformScores ? (
                    <div className="rounded-xl border border-border/50 bg-muted/40 p-3">
                      <div className="text-[11px] font-semibold text-foreground">{language === 'CN' ? '平台信号' : 'Platform signals'}</div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {Object.entries(platformScores).slice(0, 6).map(([k, v]) => (
                          <span key={k} className="rounded-full border border-border/60 bg-background/60 px-2 py-1">
                            {k}: {typeof v === 'number' ? v : String(v)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {(socialPositive.length || socialNegative.length || socialRisks.length) ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {socialPositive.length ? (
                        <div className="rounded-xl border border-border/50 bg-muted/40 p-3">
                          <div className="text-[11px] font-semibold text-foreground">{language === 'CN' ? '常见好评' : 'Typical positives'}</div>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                            {socialPositive.map((x) => (
                              <li key={x}>{x}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {socialNegative.length ? (
                        <div className="rounded-xl border border-border/50 bg-muted/40 p-3">
                          <div className="text-[11px] font-semibold text-foreground">{language === 'CN' ? '常见差评' : 'Typical negatives'}</div>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                            {socialNegative.map((x) => (
                              <li key={x}>{x}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {socialRisks.length ? (
                        <div className="rounded-xl border border-border/50 bg-muted/40 p-3 sm:col-span-2">
                          <div className="text-[11px] font-semibold text-foreground">{language === 'CN' ? '对人群风险' : 'Risks for groups'}</div>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                            {socialRisks.map((x) => (
                              <li key={x}>{x}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {expertNotes.length ? (
                    <div className="rounded-xl border border-border/50 bg-muted/40 p-3">
                      <div className="text-[11px] font-semibold text-foreground">{language === 'CN' ? '专家/说明' : 'Expert notes'}</div>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                        {expertNotes.slice(0, 6).map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </details>
            ) : null}

            {missingInfo.length ? (
              <div className="flex flex-wrap gap-2">
                {missingInfo.slice(0, 6).map((m) => (
                  <span
                    key={m}
                    className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px] font-medium text-muted-foreground"
                  >
                    {labelMissing(m, language as any) || m}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        );
      })() : null}

      {cardType === 'dupe_compare' ? (() => {
        const originalRaw = asObject((payload as any).original) || asObject((payload as any).original_product) || asObject((payload as any).originalProduct);
        const dupeRaw = asObject((payload as any).dupe) || asObject((payload as any).dupe_product) || asObject((payload as any).dupeProduct);
        const similarity = asNumber((payload as any).similarity);

        const tradeoffs = uniqueStrings((payload as any).tradeoffs);
        const tradeoffsDetail = asObject((payload as any).tradeoffs_detail || (payload as any).tradeoffsDetail) || null;

        const missingActives = uniqueStrings(tradeoffsDetail?.missing_actives || (tradeoffsDetail as any)?.missingActives);
        const addedBenefits = uniqueStrings(tradeoffsDetail?.added_benefits || (tradeoffsDetail as any)?.addedBenefits);
        const textureDiff = uniqueStrings(tradeoffsDetail?.texture_finish_differences || (tradeoffsDetail as any)?.textureFinishDifferences);
        const availabilityNote = asString(tradeoffsDetail?.availability_note || (tradeoffsDetail as any)?.availabilityNote);
        const priceDeltaUsd = asNumber(tradeoffsDetail?.price_delta_usd || (tradeoffsDetail as any)?.priceDeltaUsd);

        const tradeoffNoteParts = [
          ...textureDiff,
          ...(availabilityNote ? [availabilityNote] : []),
          ...(priceDeltaUsd != null ? [`Price delta (USD): ${priceDeltaUsd}`] : []),
        ].filter(Boolean);

        const tradeoffNote = tradeoffNoteParts.length ? tradeoffNoteParts.slice(0, 2).join(' · ') : tradeoffs[0] || undefined;

        const original = toDupeProduct(originalRaw, language);
        const dupe = toDupeProduct(dupeRaw, language);

        const labels =
          language === 'CN'
            ? {
                similarity: '相似度',
                tradeoffsTitle: '取舍分析',
                evidenceTitle: '证据与信号',
                scienceLabel: '科学',
                socialLabel: '口碑',
                keyActives: '关键成分',
                riskFlags: '风险',
                ingredientHighlights: '成分亮点',
                citations: '引用',
                tradeoffNote: '取舍',
                missingActives: '缺失成分',
                addedBenefits: '新增亮点',
                switchToDupe: '选平替',
                keepOriginal: '选原版',
              }
            : undefined;

        return (
          <div className="space-y-3">
            <DupeComparisonCard
              original={original as any}
              dupe={dupe as any}
              similarity={typeof similarity === 'number' && Number.isFinite(similarity) ? similarity : undefined}
              tradeoffNote={tradeoffNote}
              missingActives={missingActives}
              addedBenefits={addedBenefits}
              labels={labels as any}
            />

            {tradeoffs.length ? (
              <details className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
                  <span>{language === 'CN' ? '更多取舍细节' : 'More tradeoffs'}</span>
                  <ChevronDown className="h-4 w-4" />
                </summary>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-foreground">
                  {tradeoffs.slice(0, 10).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        );
      })() : null}

      {cardType === 'photo_confirm' ? (
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

      {cardType !== 'recommendations' && cardType !== 'profile' && cardType !== 'analysis_summary' && debug ? (
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
  const initialLanguageRef = useRef<UiLanguage | null>(null);
  if (!initialLanguageRef.current) initialLanguageRef.current = getInitialLanguage();
  const initialLanguage = initialLanguageRef.current;

  const [language, setLanguage] = useState<UiLanguage>(initialLanguage);
  const [headers, setHeaders] = useState(() => makeDefaultHeaders(initialLanguage));
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
  const [bootstrapInfo, setBootstrapInfo] = useState<BootstrapInfo | null>(null);

  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [checkinSheetOpen, setCheckinSheetOpen] = useState(false);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const [productSheetOpen, setProductSheetOpen] = useState(false);
  const [dupeSheetOpen, setDupeSheetOpen] = useState(false);
  const [authSheetOpen, setAuthSheetOpen] = useState(false);
  const [authSession, setAuthSession] = useState(() => loadAuroraAuthSession());
  const [authMode, setAuthMode] = useState<'code' | 'password'>('code');
  const [authStage, setAuthStage] = useState<'email' | 'code'>('email');
  const [authDraft, setAuthDraft] = useState(() => ({
    email: authSession?.email ?? '',
    code: '',
    password: '',
    newPassword: '',
    newPasswordConfirm: '',
  }));
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [analysisPhotoRefs, setAnalysisPhotoRefs] = useState<Array<{ slot_id: string; photo_id: string; qc_status: string }>>([]);
  const [sessionPhotos, setSessionPhotos] = useState<Session['photos']>({});
  const [routineSheetOpen, setRoutineSheetOpen] = useState(false);
  const [routineDraft, setRoutineDraft] = useState<RoutineDraft>(() => makeEmptyRoutineDraft());

  const [productDraft, setProductDraft] = useState('');
  const [dupeDraft, setDupeDraft] = useState({ original: '', dupe: '' });

  const [profileDraft, setProfileDraft] = useState({
    skinType: '',
    sensitivity: '',
    barrierStatus: '',
    goals: [] as string[],
    region: '',
    budgetTier: '',
    itinerary: '',
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
    setHeaders((prev) => ({ ...prev, auth_token: authSession?.token }));
  }, [authSession?.token]);

  useEffect(() => {
    try {
      window.localStorage.setItem(LANG_PREF_KEY, language);
    } catch {
      // ignore
    }
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

    const cards = Array.isArray(env.cards)
      ? env.cards.filter((c) => (debug ? true : !isEnvStressCard(c)))
      : [];

    if (cards.length) {
      nextItems.push({ id: nextId(), role: 'assistant', kind: 'cards', cards });
    }

    const suppressChips = cards.length
      ? cards.some((c) => {
          const t = String((c as any)?.type || '').toLowerCase();
          return t === 'analysis_summary' || t === 'profile' || t === 'diagnosis_gate';
        })
      : false;

    if (!suppressChips && Array.isArray(env.suggested_chips) && env.suggested_chips.length) {
      nextItems.push({ id: nextId(), role: 'assistant', kind: 'chips', chips: env.suggested_chips });
    }

    if (nextItems.length) setItems((prev) => [...prev, ...nextItems]);
  }, [debug]);

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
            include_alternatives: true,
          },
        },
        {
          chip_id: 'chip.start.routine',
          label: lang === 'CN' ? '生成早晚护肤 routine' : 'Build an AM/PM routine',
          kind: 'quick_reply',
          data: { reply_text: lang === 'CN' ? '生成一套早晚护肤 routine' : 'Build an AM/PM skincare routine', include_alternatives: true },
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
    setAnalysisPhotoRefs([]);
    setSessionPhotos({});
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
    const itineraryRaw = (p as any)?.itinerary;
    const itineraryText =
      typeof itineraryRaw === 'string'
        ? itineraryRaw
        : itineraryRaw && typeof itineraryRaw === 'object'
          ? JSON.stringify(itineraryRaw)
          : '';
    setProfileDraft({
      skinType: asString(p?.skinType) ?? '',
      sensitivity: asString(p?.sensitivity) ?? '',
      barrierStatus: asString(p?.barrierStatus) ?? '',
      goals: (asArray(p?.goals).map((g) => asString(g)).filter(Boolean) as string[]) ?? [],
      region: asString(p?.region) ?? '',
      budgetTier: asString(p?.budgetTier) ?? '',
      itinerary: itineraryText ?? '',
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
      if (profileDraft.itinerary.trim()) patch.itinerary = profileDraft.itinerary.trim().slice(0, 2000);
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

  const refreshBootstrapInfo = useCallback(async () => {
    try {
      const requestHeaders = { ...headers, lang: language };
      const env = await bffJson<V1Envelope>('/v1/session/bootstrap', requestHeaders, { method: 'GET' });
      const info = readBootstrapInfo(env);
      if (info) setBootstrapInfo(info);
    } catch {
      // ignore
    }
  }, [headers, language]);

  const startAuth = useCallback(async () => {
    const email = authDraft.email.trim();
    if (!email) {
      setAuthError(language === 'CN' ? '请输入邮箱。' : 'Please enter your email.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const requestHeaders = { ...headers, lang: language };
      await bffJson<V1Envelope>('/v1/auth/start', requestHeaders, {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setAuthStage('code');
    } catch (err) {
      setAuthError(toBffErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  }, [authDraft.email, headers, language]);

  const verifyAuth = useCallback(async () => {
    const email = authDraft.email.trim();
    const code = authDraft.code.trim();
    if (!email || !code) {
      setAuthError(language === 'CN' ? '请输入邮箱和验证码。' : 'Please enter email + code.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const requestHeaders = { ...headers, lang: language };
      const env = await bffJson<V1Envelope>('/v1/auth/verify', requestHeaders, {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });

      const sessionCard = Array.isArray(env.cards) ? env.cards.find((c) => c && c.type === 'auth_session') : null;
      const token = asString(sessionCard && (sessionCard.payload as any)?.token) || '';
      const userEmail = asString(sessionCard && (sessionCard.payload as any)?.user?.email) || email;
      const expiresAt = asString(sessionCard && (sessionCard.payload as any)?.expires_at) || null;
      if (!token) throw new Error('Missing auth token from server.');

      const nextSession = { token, email: userEmail, expires_at: expiresAt };
      saveAuroraAuthSession(nextSession);
      setAuthSession(nextSession);
      setAuthDraft((prev) => ({ ...prev, code: '' }));
      setAuthSheetOpen(false);
      await refreshBootstrapInfo();
    } catch (err) {
      setAuthError(toBffErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  }, [authDraft.code, authDraft.email, headers, language, refreshBootstrapInfo]);

  const passwordLogin = useCallback(async () => {
    const email = authDraft.email.trim();
    const password = authDraft.password;
    if (!email || !password) {
      setAuthError(language === 'CN' ? '请输入邮箱和密码。' : 'Please enter email + password.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const requestHeaders = { ...headers, lang: language };
      const env = await bffJson<V1Envelope>('/v1/auth/password/login', requestHeaders, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      const sessionCard = Array.isArray(env.cards) ? env.cards.find((c) => c && c.type === 'auth_session') : null;
      const token = asString(sessionCard && (sessionCard.payload as any)?.token) || '';
      const userEmail = asString(sessionCard && (sessionCard.payload as any)?.user?.email) || email;
      const expiresAt = asString(sessionCard && (sessionCard.payload as any)?.expires_at) || null;
      if (!token) throw new Error('Missing auth token from server.');

      const nextSession = { token, email: userEmail, expires_at: expiresAt };
      saveAuroraAuthSession(nextSession);
      setAuthSession(nextSession);
      setAuthDraft((prev) => ({ ...prev, password: '' }));
      setAuthSheetOpen(false);
      await refreshBootstrapInfo();
    } catch (err) {
      setAuthError(toBffErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  }, [authDraft.email, authDraft.password, headers, language, refreshBootstrapInfo]);

  const savePassword = useCallback(async () => {
    const password = authDraft.newPassword;
    const confirm = authDraft.newPasswordConfirm;
    if (!password || password.length < 8) {
      setAuthError(language === 'CN' ? '密码至少 8 位。' : 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setAuthError(language === 'CN' ? '两次输入的密码不一致。' : "Passwords don't match.");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const requestHeaders = { ...headers, lang: language };
      await bffJson<V1Envelope>('/v1/auth/password/set', requestHeaders, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });

      setAuthDraft((prev) => ({ ...prev, newPassword: '', newPasswordConfirm: '' }));
      setAuthNotice(language === 'CN' ? '密码已设置。' : 'Password set.');
    } catch (err) {
      setAuthError(toBffErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  }, [authDraft.newPassword, authDraft.newPasswordConfirm, headers, language]);

  const signOut = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const requestHeaders = { ...headers, lang: language };
      await bffJson<V1Envelope>('/v1/auth/logout', requestHeaders, { method: 'POST' });
    } catch {
      // ignore
    } finally {
      clearAuroraAuthSession();
      setAuthSession(null);
      setAuthStage('email');
      setAuthDraft({ email: '', code: '', password: '', newPassword: '', newPasswordConfirm: '' });
      setAuthSheetOpen(false);
      setAuthLoading(false);
      await refreshBootstrapInfo();
    }
  }, [headers, language, refreshBootstrapInfo]);

  const handlePickPhoto = useCallback(() => {
    setPhotoSheetOpen(true);
  }, [setPhotoSheetOpen]);

  const uploadPhotoViaProxy = useCallback(
    async ({ file, slotId, consent }: { file: File; slotId: string; consent: boolean }) => {
      setIsLoading(true);
      try {
        const requestHeaders = { ...headers, lang: language };
        const form = new FormData();
        form.append('slot_id', slotId);
        form.append('consent', consent ? 'true' : 'false');
        form.append('photo', file, file.name || `photo_${slotId}.jpg`);

        const confirmEnv = await bffJson<V1Envelope>('/v1/photos/upload', requestHeaders, {
          method: 'POST',
          body: form,
        });
        applyEnvelope(confirmEnv);

        const confirmCard = confirmEnv.cards.find((c) => c && c.type === 'photo_confirm');
        const qcStatus = asString(confirmCard && (confirmCard.payload as any)?.qc_status);
        const photoId = asString(confirmCard && (confirmCard.payload as any)?.photo_id);

        if (qcStatus === 'passed' && photoId) {
          setAnalysisPhotoRefs((prev) => {
            const next = prev.filter((p) => p.slot_id !== slotId);
            next.push({ slot_id: slotId, photo_id: photoId, qc_status: qcStatus });
            return next.slice(0, 4);
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    },
    [applyEnvelope, headers, language],
  );

  const onPhotoAction = useCallback(
    async (actionId: string, data?: Record<string, any>) => {
      if (actionId === 'photo_skip') {
        setPhotoSheetOpen(false);
        return;
      }
      if (actionId !== 'photo_upload') {
        setError(language === 'CN' ? '暂不支持该照片操作。' : 'That photo action is not supported yet.');
        return;
      }

      const consent = Boolean(data?.consent);
      if (!consent) {
        setError(language === 'CN' ? '需要勾选同意后才能上传。' : 'Please consent before uploading.');
        return;
      }

      const photos = (data?.photos && typeof data.photos === 'object' ? data.photos : {}) as Record<string, any>;
      const entries: Array<{ slotId: string; file: File }> = [];
      if (photos.daylight?.file instanceof File) entries.push({ slotId: 'daylight', file: photos.daylight.file });
      if (photos.indoor_white?.file instanceof File) entries.push({ slotId: 'indoor_white', file: photos.indoor_white.file });

      if (!entries.length) return;
      setSessionPhotos({ daylight: photos.daylight, indoor_white: photos.indoor_white });
      setPhotoSheetOpen(false);

      for (const entry of entries) {
        const slotLabel =
          entry.slotId === 'daylight'
            ? language === 'CN'
              ? '自然光'
              : 'daylight'
            : language === 'CN'
              ? '室内白光'
              : 'indoor white';
        setItems((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'user',
            kind: 'text',
            content: language === 'CN' ? `上传照片（${slotLabel}）` : `Upload photo (${slotLabel})`,
          },
        ]);
        // eslint-disable-next-line no-await-in-loop
        await uploadPhotoViaProxy({ file: entry.file, slotId: entry.slotId, consent });
      }
    },
    [language, uploadPhotoViaProxy],
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

  const parseMaybeUrl = useCallback((text: string) => {
    const t = String(text || '').trim();
    if (!t) return null;
    try {
      const u = new URL(t);
      if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
    } catch {
      // ignore
    }
    return null;
  }, []);

  const runProductDeepScan = useCallback(
    async (rawInput: string) => {
      const inputText = String(rawInput || '').trim();
      if (!inputText) return;

      setItems((prev) => [...prev, { id: nextId(), role: 'user', kind: 'text', content: inputText }]);
      setIsLoading(true);
      setError(null);

      try {
        setSessionState('P1_PRODUCT_ANALYZING');

        const requestHeaders = { ...headers, lang: language };
        const asUrl = parseMaybeUrl(inputText);

        const parseEnv = await bffJson<V1Envelope>('/v1/product/parse', requestHeaders, {
          method: 'POST',
          body: JSON.stringify(asUrl ? { url: asUrl } : { text: inputText }),
        });
        applyEnvelope(parseEnv);

        const parseCard = Array.isArray(parseEnv.cards) ? parseEnv.cards.find((c) => c && c.type === 'product_parse') : null;
        const parsedProduct = parseCard && parseCard.payload && typeof parseCard.payload === 'object' ? (parseCard.payload as any).product : null;

        const analyzeEnv = await bffJson<V1Envelope>('/v1/product/analyze', requestHeaders, {
          method: 'POST',
          body: JSON.stringify(
            parsedProduct
              ? { product: parsedProduct }
              : asUrl
                ? { url: asUrl }
                : { name: inputText },
          ),
        });
        applyEnvelope(analyzeEnv);
        setSessionState('P2_PRODUCT_RESULT');
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    },
    [applyEnvelope, headers, language, parseMaybeUrl],
  );

  const runDupeCompare = useCallback(
    async (rawOriginal: string, rawDupe: string) => {
      const originalText = String(rawOriginal || '').trim();
      const dupeText = String(rawDupe || '').trim();
      if (!originalText || !dupeText) {
        setError(language === 'CN' ? '需要同时填写「原版」和「平替」。' : 'Please provide both the original and the dupe.');
        return;
      }

      setItems((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'user',
          kind: 'text',
          content: language === 'CN' ? `平替对比：${originalText} vs ${dupeText}` : `Dupe compare: ${originalText} vs ${dupeText}`,
        },
      ]);
      setIsLoading(true);
      setError(null);

      try {
        setSessionState('P1_PRODUCT_ANALYZING');

        const requestHeaders = { ...headers, lang: language };
        const originalUrl = parseMaybeUrl(originalText);
        const dupeUrl = parseMaybeUrl(dupeText);

        const [origParseEnv, dupeParseEnv] = await Promise.all([
          bffJson<V1Envelope>('/v1/product/parse', requestHeaders, {
            method: 'POST',
            body: JSON.stringify(originalUrl ? { url: originalUrl } : { text: originalText }),
          }),
          bffJson<V1Envelope>('/v1/product/parse', requestHeaders, {
            method: 'POST',
            body: JSON.stringify(dupeUrl ? { url: dupeUrl } : { text: dupeText }),
          }),
        ]);

        applyEnvelope(origParseEnv);
        applyEnvelope(dupeParseEnv);

        const origParseCard = Array.isArray(origParseEnv.cards) ? origParseEnv.cards.find((c) => c && c.type === 'product_parse') : null;
        const dupeParseCard = Array.isArray(dupeParseEnv.cards) ? dupeParseEnv.cards.find((c) => c && c.type === 'product_parse') : null;
        const originalProduct =
          origParseCard && origParseCard.payload && typeof origParseCard.payload === 'object' ? (origParseCard.payload as any).product : null;
        const dupeProduct =
          dupeParseCard && dupeParseCard.payload && typeof dupeParseCard.payload === 'object' ? (dupeParseCard.payload as any).product : null;

        const compareBody: Record<string, unknown> = {
          ...(originalProduct ? { original: originalProduct } : originalUrl ? { original_url: originalUrl } : { original: { name: originalText } }),
          ...(dupeProduct ? { dupe: dupeProduct } : dupeUrl ? { dupe_url: dupeUrl } : { dupe: { name: dupeText } }),
        };

        const compareEnv = await bffJson<V1Envelope>('/v1/dupe/compare', requestHeaders, {
          method: 'POST',
          body: JSON.stringify(compareBody),
        });

        applyEnvelope(compareEnv);
        setSessionState('P2_PRODUCT_RESULT');
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    },
    [applyEnvelope, headers, language, parseMaybeUrl],
  );

  const onCardAction = useCallback(
    async (actionId: string, data?: Record<string, any>) => {
      if (actionId === 'diagnosis_skip') {
        setItems((prev) => [
          ...prev,
          { id: nextId(), role: 'user', kind: 'text', content: language === 'CN' ? '跳过诊断' : 'Skip diagnosis' },
        ]);
        setSessionState('idle');
        return;
      }

      if (actionId === 'diagnosis_submit') {
        const skinType = typeof data?.skinType === 'string' ? data.skinType.trim() : '';
        const barrierStatus = typeof data?.barrierStatus === 'string' ? data.barrierStatus.trim() : '';
        const sensitivity = typeof data?.sensitivity === 'string' ? data.sensitivity.trim() : '';
        const concerns = Array.isArray(data?.concerns) ? (data?.concerns as unknown[]).map((c) => String(c || '').trim()).filter(Boolean) : [];

        if (!skinType || !barrierStatus || !sensitivity || concerns.length === 0) {
          setError(language === 'CN' ? '请先完成诊断信息。' : 'Please complete the diagnosis first.');
          return;
        }

        setItems((prev) => [
          ...prev,
          { id: nextId(), role: 'user', kind: 'text', content: language === 'CN' ? '分析我的皮肤' : 'Analyze my skin' },
        ]);

        setIsLoading(true);
        try {
          const requestHeaders = { ...headers, lang: language };
          const env = await bffJson<V1Envelope>('/v1/profile/update', requestHeaders, {
            method: 'POST',
            body: JSON.stringify({
              skinType,
              barrierStatus,
              sensitivity,
              goals: concerns.slice(0, 3),
            }),
          });
          applyEnvelope(env);
          setSessionState('S3_PHOTO_OPTION');
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setIsLoading(false);
        }
        return;
      }

      if (actionId === 'affiliate_open') {
        const url = typeof data?.url === 'string' ? data.url.trim() : '';
        const offerId = typeof data?.offer_id === 'string' ? data.offer_id.trim() : undefined;
        if (!url) return;

        let opened = false;
        try {
          const w = window.open(url, '_blank', 'noopener,noreferrer');
          opened = Boolean(w);
          if (!opened) setError(language === 'CN' ? '浏览器拦截了弹窗，请允许后重试。' : 'Popup blocked by browser. Please allow popups and retry.');
        } catch {
          setError(language === 'CN' ? '打开链接失败。' : 'Failed to open link.');
        }

        // Best-effort tracking (do not render the returned card).
        try {
          const requestHeaders = { ...headers, lang: language };
          await bffJson('/v1/affiliate/outcome', requestHeaders, {
            method: 'POST',
            body: JSON.stringify({ outcome: opened ? 'success' : 'failed', url, ...(offerId ? { offer_id: offerId } : {}) }),
          });
        } catch {
          // ignore tracking errors
        }
        return;
      }

      if (actionId === 'profile_upload_selfie') {
        setPhotoSheetOpen(true);

        const prompt =
          language === 'CN'
            ? '上传照片后，为了把分析做得更准，我强烈建议你把最近在用的产品/步骤也发我（AM/PM：洁面/活性/保湿/SPF，名字或链接都行）。你也可以直接跳过，我会先给低置信度的通用 7 天建议。'
            : 'After uploading, to make this accurate, I strongly recommend sharing your current products/steps (AM/PM: cleanser/actives/moisturizer/SPF — names or links). You can also skip; I’ll give a low-confidence 7‑day baseline.';
        const chips: SuggestedChip[] = [
          {
            chip_id: 'chip.intake.paste_routine',
            label: language === 'CN' ? '填写 AM/PM 产品（更准）' : 'Add AM/PM products (more accurate)',
            kind: 'quick_reply',
            data: {},
          },
          {
            chip_id: 'chip.intake.skip_analysis',
            label: language === 'CN' ? '直接分析（低置信度）' : 'Skip and analyze (low confidence)',
            kind: 'quick_reply',
            data: {},
          },
        ];
        setItems((prev) => [
          ...prev,
          { id: nextId(), role: 'assistant', kind: 'text', content: prompt },
          { id: nextId(), role: 'assistant', kind: 'chips', chips },
        ]);
        return;
      }

      if (actionId === 'profile_confirm') {
        setItems((prev) => [
          ...prev,
          { id: nextId(), role: 'user', kind: 'text', content: language === 'CN' ? '先不传照片，继续' : 'Continue without photos' },
        ]);

        const prompt =
          language === 'CN'
            ? '为了把分析做得更准，我强烈建议你把最近在用的产品/步骤也发我（AM/PM：洁面/活性/保湿/SPF，名字或链接都行）。你也可以直接跳过，我会先给低置信度的通用 7 天建议。'
            : 'To make this analysis accurate, I strongly recommend sharing your current products/steps (AM/PM: cleanser/actives/moisturizer/SPF — names or links). You can also skip; I’ll give a low-confidence 7‑day baseline.';
        const chips: SuggestedChip[] = [
          {
            chip_id: 'chip.intake.upload_photos',
            label: language === 'CN' ? '改为上传照片' : 'Upload photos instead',
            kind: 'quick_reply',
            data: {},
          },
          {
            chip_id: 'chip.intake.paste_routine',
            label: language === 'CN' ? '填写 AM/PM 产品（更准）' : 'Add AM/PM products (more accurate)',
            kind: 'quick_reply',
            data: {},
          },
          {
            chip_id: 'chip.intake.skip_analysis',
            label: language === 'CN' ? '直接分析（低置信度）' : 'Skip and analyze (low confidence)',
            kind: 'quick_reply',
            data: {},
          },
        ];
        setItems((prev) => [
          ...prev,
          { id: nextId(), role: 'assistant', kind: 'text', content: prompt },
          { id: nextId(), role: 'assistant', kind: 'chips', chips },
        ]);
        return;
      }

      if (actionId === 'profile_update_concerns') {
        const concernsRaw = Array.isArray(data?.concerns) ? (data?.concerns as unknown[]) : [];
        const concerns = concernsRaw.map((c) => String(c || '').trim()).filter(Boolean);
        const requestHeaders = { ...headers, lang: language };

        setIsLoading(true);
        try {
          const env = await bffJson<V1Envelope>('/v1/profile/update', requestHeaders, {
            method: 'POST',
            body: JSON.stringify({ goals: concerns }),
          });
          applyEnvelope(env);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setIsLoading(false);
        }
        return;
      }

      if (actionId === 'analysis_review_products') {
        setRoutineDraft(makeEmptyRoutineDraft());
        setRoutineSheetOpen(true);
        setItems((prev) => [
          ...prev,
          { id: nextId(), role: 'user', kind: 'text', content: language === 'CN' ? '评估我现在用的产品' : 'Review my current products' },
          {
            id: nextId(),
            role: 'assistant',
            kind: 'text',
            content:
              language === 'CN'
                ? '把你现在正在用的产品按 AM/PM 填一下（洁面/活性/保湿/SPF，名字或链接都行），我先帮你做兼容性与刺激风险检查，再决定要不要换/加。'
                : 'Fill in your AM/PM products (cleanser/actives/moisturizer/SPF, names or links). I’ll check conflicts and irritation risk first, then decide what to keep/change.',
          },
        ]);
        return;
      }

      const msg =
        actionId === 'analysis_continue'
          ? null
          : actionId === 'analysis_gentler'
            ? language === 'CN'
              ? '给我更温和的方案'
              : 'Make it gentler'
            : actionId === 'analysis_simple'
              ? language === 'CN'
                ? '给我更简单的方案'
                : 'Make it simpler'
              : null;

      if (actionId === 'analysis_continue') {
        // Explicitly request recommendations via a chip trigger so the backend
        // can safely allow recommendation cards (no accidental auto-push).
        setItems((prev) => [
          ...prev,
          { id: nextId(), role: 'user', kind: 'text', content: t('s5.btn.continue', language) },
        ]);
        await sendChat(undefined, {
          action_id: 'chip.action.reco_routine',
          kind: 'chip',
          data: {
            reply_text: language === 'CN' ? '生成一套早晚护肤 routine' : 'Build an AM/PM skincare routine',
            include_alternatives: true,
          },
        });
        return;
      }

      if (msg) {
        setItems((prev) => [...prev, { id: nextId(), role: 'user', kind: 'text', content: msg }]);
        // Make gentler / simpler are explicit *preference* messages (not silent actions).
        // We still send them as chips to keep the recommendation gate explicit.
        if (actionId === 'analysis_gentler' || actionId === 'analysis_simple') {
          const replyText =
            actionId === 'analysis_gentler'
              ? language === 'CN'
                ? '生成一套更温和的早晚护肤 routine（减少刺激，优先修护）。'
                : 'Build a gentler AM/PM routine (minimize irritation, barrier-first).'
              : language === 'CN'
                ? '生成一套更简单的早晚护肤 routine（步骤更少）。'
                : 'Build the simplest AM/PM routine (fewer steps).';
          await sendChat(undefined, {
            action_id: 'chip.action.reco_routine',
            kind: 'chip',
            data: { reply_text: replyText, include_alternatives: true },
          });
          return;
        }

        await sendChat(msg);
        return;
      }

      await sendChat(undefined, { action_id: actionId, kind: 'action', data });
    },
    [applyEnvelope, headers, language, sendChat],
  );

  const getSanitizedAnalysisPhotos = useCallback(() => {
    return analysisPhotoRefs
      .map((p) => ({
        slot_id: String(p?.slot_id || '').trim(),
        photo_id: String(p?.photo_id || '').trim(),
        qc_status: String(p?.qc_status || '').trim(),
      }))
      .filter((p) => p.slot_id && p.photo_id)
      .slice(0, 4);
  }, [analysisPhotoRefs]);

  const runLowConfidenceSkinAnalysis = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setSessionState('S4_ANALYSIS_LOADING');
      const requestHeaders = { ...headers, lang: language };
      const env = await bffJson<V1Envelope>('/v1/analysis/skin', requestHeaders, {
        method: 'POST',
        body: JSON.stringify({ use_photo: false, photos: [] }),
      });
      applyEnvelope(env);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [applyEnvelope, headers, language]);

  const runRoutineSkinAnalysis = useCallback(
    async (routineInput: string | Record<string, unknown>) => {
      const routine =
        typeof routineInput === 'string'
          ? String(routineInput || '').trim()
          : routineInput && typeof routineInput === 'object'
            ? routineInput
            : null;
      if (!routine || (typeof routine === 'string' && !routine.trim())) return;
      setIsLoading(true);
      setError(null);
      try {
        const requestHeaders = { ...headers, lang: language };
        const profile = bootstrapInfo?.profile;
        const patch: Record<string, unknown> = { currentRoutine: routine };
        // Workaround: some deployed BFF versions fail to persist JSONB arrays unless explicitly present in the patch.
        if (profile && Array.isArray((profile as any).goals)) patch.goals = (profile as any).goals;
        if (profile && Array.isArray((profile as any).contraindications)) patch.contraindications = (profile as any).contraindications;
        const envProfile = await bffJson<V1Envelope>('/v1/profile/update', requestHeaders, {
          method: 'POST',
          body: JSON.stringify(patch),
        });
        applyEnvelope(envProfile);

        setSessionState('S4_ANALYSIS_LOADING');
        const photos = getSanitizedAnalysisPhotos();
        const usePhoto = photos.length > 0;
        const envAnalysis = await bffJson<V1Envelope>('/v1/analysis/skin', requestHeaders, {
          method: 'POST',
          body: JSON.stringify({ use_photo: usePhoto, photos }),
        });
        applyEnvelope(envAnalysis);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    },
    [applyEnvelope, bootstrapInfo?.profile, getSanitizedAnalysisPhotos, headers, language],
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
      const id = String(chip.chip_id || '');
      const userItem: ChatItem = { id: nextId(), role: 'user', kind: 'text', content: chip.label };

      if (id === 'chip.start.diagnosis') {
        setSessionState('S2_DIAGNOSIS');
        setItems((prev) => [
          ...prev,
          userItem,
          {
            id: nextId(),
            role: 'assistant',
            kind: 'cards',
            cards: [{ card_id: `local_diagnosis_${Date.now()}`, type: 'diagnosis_gate', payload: {} }],
          },
        ]);
        return;
      }

      setItems((prev) => [...prev, userItem]);
      if (id === 'chip.intake.upload_photos') {
        setPhotoSheetOpen(true);
        return;
      }
      if (id === 'chip.intake.paste_routine') {
        setRoutineDraft(makeEmptyRoutineDraft());
        setRoutineSheetOpen(true);
        return;
      }
      if (id === 'chip.intake.skip_analysis') {
        setRoutineSheetOpen(false);
        await runLowConfidenceSkinAnalysis();
        return;
      }
      if (id === 'chip.start.evaluate') {
        setProductDraft('');
        setProductSheetOpen(true);
        return;
      }
      if (id === 'chip.start.dupes') {
        setDupeDraft({ original: '', dupe: '' });
        setDupeSheetOpen(true);
        return;
      }
      await sendChat(undefined, { action_id: chip.chip_id, kind: 'chip', data: chip.data });
    },
    [runLowConfidenceSkinAnalysis, sendChat]
  );

  const canSend = useMemo(() => !isLoading && input.trim().length > 0, [isLoading, input]);
  const flowState = useMemo(() => {
    const s = String(sessionState || '').trim();
    return ((s && s.startsWith('S')) ? s : 'S0_LANDING') as FlowState;
  }, [sessionState]);
  const sessionForCards = useMemo<Session>(() => {
    return {
      brief_id: headers.brief_id,
      trace_id: headers.trace_id,
      mode: 'live',
      state: flowState,
      clarification_count: 0,
      photos: sessionPhotos,
      selected_offers: {},
    };
  }, [headers.brief_id, headers.trace_id, flowState, sessionPhotos]);

  const resolveSkuOffers = useCallback(
    async (skuId: string) => {
      const requestHeaders = { ...headers, lang: language };
      return await bffJson<any>('/agent/shop/v1/invoke', requestHeaders, {
        method: 'POST',
        body: JSON.stringify({
          operation: 'offers.resolve',
          payload: { offers: { product: { sku_id: skuId }, market: 'US', tool: '*', limit: 5 } },
          metadata: { source: 'chatbox' },
        }),
      });
    },
    [headers, language],
  );

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
            className={`chip-button ${authSession ? 'chip-button-primary' : ''}`}
            onClick={() => {
              setAuthError(null);
              setAuthNotice(null);
              setAuthStage('email');
              setAuthDraft((prev) => ({ ...prev, code: '', password: '', newPassword: '', newPasswordConfirm: '' }));
              setAuthSheetOpen(true);
            }}
            disabled={isLoading}
            title={language === 'CN' ? '账户' : 'Account'}
          >
            <Wallet className="h-4 w-4" />
            {authSession ? (language === 'CN' ? '账户' : 'Account') : language === 'CN' ? '登录' : 'Sign in'}
          </button>
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
            onClick={handlePickPhoto}
            disabled={isLoading}
            title={language === 'CN' ? '上传照片' : 'Upload photo'}
          >
            <Camera className="h-4 w-4" />
            {language === 'CN' ? '照片' : 'Photo'}
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
            className={`chip-button ${bootstrapInfo?.profile?.currentRoutine ? '' : 'chip-button-primary'}`}
            onClick={() => {
              setRoutineDraft(makeEmptyRoutineDraft());
              setRoutineSheetOpen(true);
            }}
            disabled={isLoading}
            title={language === 'CN' ? '填写在用流程' : 'Current routine'}
          >
            <ListChecks className="h-4 w-4" />
            {language === 'CN' ? '在用' : 'Routine'}
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
            open={authSheetOpen}
            title={language === 'CN' ? '登录 / 账户' : 'Sign in / Account'}
            onClose={() => setAuthSheetOpen(false)}
          >
            <div className="space-y-3">
              {authSession ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                    <div className="text-sm font-semibold text-foreground">{language === 'CN' ? '已登录' : 'Signed in'}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{authSession.email}</div>
                    {authSession.expires_at ? (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {language === 'CN' ? '有效期至：' : 'Expires:'} {authSession.expires_at}
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/40 p-3">
                    <div className="text-sm font-semibold text-foreground">{language === 'CN' ? '密码登录' : 'Password sign-in'}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {language === 'CN'
                        ? '可选：设置/更新密码，下次可直接用邮箱 + 密码登录（验证码仍可用）。'
                        : 'Optional: set/update a password so you can sign in with email + password next time (OTP still works).'}
                    </div>
                    <div className="mt-3 space-y-3">
                      <label className="space-y-1 text-xs text-muted-foreground">
                        {language === 'CN' ? '新密码（至少 8 位）' : 'New password (min 8 chars)'}
                        <input
                          className="h-11 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                          value={authDraft.newPassword}
                          onChange={(e) => setAuthDraft((p) => ({ ...p, newPassword: e.target.value }))}
                          placeholder={language === 'CN' ? '输入新密码' : 'Enter new password'}
                          disabled={authLoading}
                          type="password"
                          autoComplete="new-password"
                        />
                      </label>
                      <label className="space-y-1 text-xs text-muted-foreground">
                        {language === 'CN' ? '确认密码' : 'Confirm password'}
                        <input
                          className="h-11 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                          value={authDraft.newPasswordConfirm}
                          onChange={(e) => setAuthDraft((p) => ({ ...p, newPasswordConfirm: e.target.value }))}
                          placeholder={language === 'CN' ? '再次输入' : 'Re-enter'}
                          disabled={authLoading}
                          type="password"
                          autoComplete="new-password"
                        />
                      </label>
                      <button
                        type="button"
                        className="chip-button chip-button-primary"
                        onClick={() => void savePassword()}
                        disabled={authLoading || !authDraft.newPassword || !authDraft.newPasswordConfirm}
                      >
                        {authLoading ? (language === 'CN' ? '保存中…' : 'Saving…') : language === 'CN' ? '保存密码' : 'Save password'}
                      </button>
                      {authNotice ? <div className="text-xs text-emerald-700">{authNotice}</div> : null}
                    </div>
                  </div>
                  <button type="button" className="chip-button chip-button-primary" onClick={() => void refreshBootstrapInfo()} disabled={authLoading}>
                    {language === 'CN' ? '刷新资料' : 'Refresh profile'}
                  </button>
                  <button type="button" className="chip-button" onClick={() => void signOut()} disabled={authLoading}>
                    {language === 'CN' ? '退出登录' : 'Sign out'}
                  </button>
                  {authError ? <div className="text-xs text-red-600">{authError}</div> : null}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={`chip-button ${authMode === 'code' ? 'chip-button-primary' : ''}`}
                      onClick={() => {
                        setAuthMode('code');
                        setAuthStage('email');
                        setAuthError(null);
                        setAuthNotice(null);
                        setAuthDraft((p) => ({ ...p, code: '', password: '' }));
                      }}
                      disabled={authLoading}
                    >
                      {language === 'CN' ? '验证码' : 'Email code'}
                    </button>
                    <button
                      type="button"
                      className={`chip-button ${authMode === 'password' ? 'chip-button-primary' : ''}`}
                      onClick={() => {
                        setAuthMode('password');
                        setAuthError(null);
                        setAuthNotice(null);
                        setAuthDraft((p) => ({ ...p, code: '' }));
                      }}
                      disabled={authLoading}
                    >
                      {language === 'CN' ? '密码' : 'Password'}
                    </button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {authMode === 'password'
                      ? language === 'CN'
                        ? '用邮箱 + 密码登录。如果还没设置密码，请先用验证码登录后在账户里设置。'
                        : "Sign in with email + password. If you haven't set a password, use email code first, then set one in Account."
                      : language === 'CN'
                        ? '输入邮箱获取验证码（用于跨设备保存你的皮肤档案）。'
                        : 'Enter your email to get a sign-in code (for cross-device profile).'}
                  </div>

                  <label className="space-y-1 text-xs text-muted-foreground">
                    {language === 'CN' ? '邮箱' : 'Email'}
                    <input
                      className="h-11 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                      value={authDraft.email}
                      onChange={(e) => setAuthDraft((p) => ({ ...p, email: e.target.value }))}
                      placeholder="name@email.com"
                      disabled={authLoading}
                      inputMode="email"
                      autoComplete="email"
                    />
                  </label>

                  {authMode === 'password' ? (
                    <div className="space-y-3">
                      <label className="space-y-1 text-xs text-muted-foreground">
                        {language === 'CN' ? '密码' : 'Password'}
                        <input
                          className="h-11 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                          value={authDraft.password}
                          onChange={(e) => setAuthDraft((p) => ({ ...p, password: e.target.value }))}
                          placeholder={language === 'CN' ? '输入密码' : 'Enter password'}
                          disabled={authLoading}
                          type="password"
                          autoComplete="current-password"
                        />
                      </label>
                      <button
                        type="button"
                        className="chip-button chip-button-primary"
                        onClick={() => void passwordLogin()}
                        disabled={authLoading || !authDraft.email.trim() || !authDraft.password}
                      >
                        {authLoading ? (language === 'CN' ? '登录中…' : 'Signing in…') : language === 'CN' ? '密码登录' : 'Sign in'}
                      </button>
                    </div>
                  ) : (
                    <>
                      {authStage === 'email' ? (
                        <button type="button" className="chip-button chip-button-primary" onClick={() => void startAuth()} disabled={authLoading}>
                          {authLoading ? (language === 'CN' ? '发送中…' : 'Sending…') : language === 'CN' ? '发送验证码' : 'Send code'}
                        </button>
                      ) : null}

                      {authStage === 'code' ? (
                        <div className="space-y-3">
                          <label className="space-y-1 text-xs text-muted-foreground">
                            {language === 'CN' ? '验证码' : 'Code'}
                            <input
                              className="h-11 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                              value={authDraft.code}
                              onChange={(e) => setAuthDraft((p) => ({ ...p, code: e.target.value }))}
                              placeholder={language === 'CN' ? '6 位数字' : '6-digit code'}
                              disabled={authLoading}
                              inputMode="numeric"
                              autoComplete="one-time-code"
                            />
                          </label>
                          <div className="flex gap-2">
                            <button type="button" className="chip-button" onClick={() => setAuthStage('email')} disabled={authLoading}>
                              {language === 'CN' ? '返回' : 'Back'}
                            </button>
                            <button
                              type="button"
                              className="chip-button chip-button-primary flex-1"
                              onClick={() => void verifyAuth()}
                              disabled={authLoading || !authDraft.code.trim()}
                            >
                              {authLoading ? (language === 'CN' ? '验证中…' : 'Verifying…') : language === 'CN' ? '验证登录' : 'Verify'}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}

                  {authError ? <div className="text-xs text-red-600">{authError}</div> : null}
                  {authNotice ? <div className="text-xs text-emerald-700">{authNotice}</div> : null}
                </div>
              )}
            </div>
          </Sheet>
          <Sheet
            open={photoSheetOpen}
            title={language === 'CN' ? '上传照片（更准确）' : 'Upload photos (recommended)'}
            onClose={() => setPhotoSheetOpen(false)}
          >
            <PhotoUploadCard language={language} onAction={onPhotoAction} />
          </Sheet>
          <Sheet
            open={routineSheetOpen}
            title={language === 'CN' ? '填写你在用的 AM/PM 产品（更准）' : 'Add your AM/PM products (more accurate)'}
            onClose={() => setRoutineSheetOpen(false)}
          >
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                {language === 'CN'
                  ? '强烈建议提供你最近在用的步骤/产品（名字或链接都行）。否则我只能给“低置信度”的通用 7 天建议，不做评分/不推推荐。'
                  : 'Strongly recommended: share what you’re using now (names or links). Otherwise I’ll only give a low-confidence 7‑day baseline (no scoring, no recommendations).'}
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-border/50 bg-background/40 p-3">
                  <div className="text-xs font-semibold text-foreground">{language === 'CN' ? '早上（AM）' : 'Morning (AM)'}</div>
                  <div className="mt-2 grid gap-2">
                    <label className="space-y-1 text-xs text-muted-foreground">
                      {language === 'CN' ? '洁面' : 'Cleanser'}
                      <input
                        className="h-11 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                        value={routineDraft.am.cleanser}
                        onChange={(e) => setRoutineDraft((prev) => ({ ...prev, am: { ...prev.am, cleanser: e.target.value } }))}
                        placeholder={language === 'CN' ? '例如：CeraVe Foaming Cleanser / 链接' : 'e.g., CeraVe Foaming Cleanser / link'}
                        disabled={isLoading}
                      />
                    </label>
                    <label className="space-y-1 text-xs text-muted-foreground">
                      {language === 'CN' ? '活性/精华（可选）' : 'Treatment/active (optional)'}
                      <input
                        className="h-11 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                        value={routineDraft.am.treatment}
                        onChange={(e) => setRoutineDraft((prev) => ({ ...prev, am: { ...prev.am, treatment: e.target.value } }))}
                        placeholder={language === 'CN' ? '例如：烟酰胺 / VC / 无' : 'e.g., niacinamide / vitamin C / none'}
                        disabled={isLoading}
                      />
                    </label>
                    <label className="space-y-1 text-xs text-muted-foreground">
                      {language === 'CN' ? '保湿（可选）' : 'Moisturizer (optional)'}
                      <input
                        className="h-11 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                        value={routineDraft.am.moisturizer}
                        onChange={(e) => setRoutineDraft((prev) => ({ ...prev, am: { ...prev.am, moisturizer: e.target.value } }))}
                        placeholder={language === 'CN' ? '例如：CeraVe PM / 无' : 'e.g., CeraVe PM / none'}
                        disabled={isLoading}
                      />
                    </label>
                    <label className="space-y-1 text-xs text-muted-foreground">
                      {language === 'CN' ? '防晒 SPF（可选但推荐）' : 'SPF (optional but recommended)'}
                      <input
                        className="h-11 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                        value={routineDraft.am.spf}
                        onChange={(e) => setRoutineDraft((prev) => ({ ...prev, am: { ...prev.am, spf: e.target.value } }))}
                        placeholder={language === 'CN' ? '例如：EltaMD UV Clear / 无' : 'e.g., EltaMD UV Clear / none'}
                        disabled={isLoading}
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/50 bg-background/40 p-3">
                  <div className="text-xs font-semibold text-foreground">{language === 'CN' ? '晚上（PM）' : 'Evening (PM)'}</div>
                  <div className="mt-2 grid gap-2">
                    <label className="space-y-1 text-xs text-muted-foreground">
                      {language === 'CN' ? '洁面' : 'Cleanser'}
                      <input
                        className="h-11 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                        value={routineDraft.pm.cleanser}
                        onChange={(e) => setRoutineDraft((prev) => ({ ...prev, pm: { ...prev.pm, cleanser: e.target.value } }))}
                        placeholder={language === 'CN' ? '例如：同 AM / 或不同产品' : 'e.g., same as AM / or different'}
                        disabled={isLoading}
                      />
                    </label>
                    <label className="space-y-1 text-xs text-muted-foreground">
                      {language === 'CN' ? '活性/精华（可选）' : 'Treatment/active (optional)'}
                      <input
                        className="h-11 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                        value={routineDraft.pm.treatment}
                        onChange={(e) => setRoutineDraft((prev) => ({ ...prev, pm: { ...prev.pm, treatment: e.target.value } }))}
                        placeholder={language === 'CN' ? '例如：Retinol / AHA/BHA / 无' : 'e.g., retinol / AHA/BHA / none'}
                        disabled={isLoading}
                      />
                    </label>
                    <label className="space-y-1 text-xs text-muted-foreground">
                      {language === 'CN' ? '保湿（可选）' : 'Moisturizer (optional)'}
                      <input
                        className="h-11 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                        value={routineDraft.pm.moisturizer}
                        onChange={(e) => setRoutineDraft((prev) => ({ ...prev, pm: { ...prev.pm, moisturizer: e.target.value } }))}
                        placeholder={language === 'CN' ? '例如：CeraVe PM / 无' : 'e.g., CeraVe PM / none'}
                        disabled={isLoading}
                      />
                    </label>
                  </div>
                </div>

                <label className="space-y-1 text-xs text-muted-foreground">
                  {language === 'CN' ? '备注（可选）' : 'Notes (optional)'}
                  <textarea
                    className="min-h-[90px] w-full resize-none rounded-2xl border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground"
                    value={routineDraft.notes}
                    onChange={(e) => setRoutineDraft((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder={
                      language === 'CN'
                        ? '例如：用了 retinol 会刺痛；最近泛红…'
                        : 'e.g., stings after retinol; recent redness…'
                    }
                    disabled={isLoading}
                  />
                </label>
              </div>

              <div className="flex gap-2">
                <button type="button" className="chip-button" onClick={() => setRoutineSheetOpen(false)} disabled={isLoading}>
                  {language === 'CN' ? '取消' : 'Cancel'}
                </button>
                <button
                  type="button"
                  className="chip-button"
                  onClick={() => {
                    setRoutineSheetOpen(false);
                    setRoutineDraft(makeEmptyRoutineDraft());
                    setItems((prev) => [
                      ...prev,
                      {
                        id: nextId(),
                        role: 'user',
                        kind: 'text',
                        content: language === 'CN' ? '直接分析（低置信度）' : 'Skip and analyze (low confidence)',
                      },
                    ]);
                    void runLowConfidenceSkinAnalysis();
                  }}
                  disabled={isLoading}
                >
                  {language === 'CN' ? '先给基线' : 'Baseline only'}
                </button>
                <button
                  type="button"
                  className="chip-button chip-button-primary flex-1"
                  disabled={isLoading || !hasAnyRoutineDraftInput(routineDraft)}
                  onClick={() => {
                    const payload = buildCurrentRoutinePayloadFromDraft(routineDraft);
                    const text = routineDraftToDisplayText(routineDraft, language);
                    setRoutineSheetOpen(false);
                    setRoutineDraft(makeEmptyRoutineDraft());
                    setItems((prev) => [...prev, { id: nextId(), role: 'user', kind: 'text', content: text }]);
                    void runRoutineSkinAnalysis(payload);
                  }}
                >
                  {language === 'CN' ? '保存并分析' : 'Save & analyze'}
                </button>
              </div>
            </div>
          </Sheet>
          <Sheet
            open={productSheetOpen}
            title={language === 'CN' ? '单品评估（Deep Scan）' : 'Product deep scan'}
            onClose={() => setProductSheetOpen(false)}
          >
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                {language === 'CN' ? '粘贴产品名或链接，我会先解析再评估。' : 'Paste a product name or link. I will parse it, then deep-scan.'}
              </div>
              <input
                className="h-11 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                value={productDraft}
                onChange={(e) => setProductDraft(e.target.value)}
                placeholder={language === 'CN' ? '例如：Nivea Creme / https://…' : 'e.g., Nivea Creme / https://…'}
                disabled={isLoading}
              />
              <div className="flex gap-2">
                <button type="button" className="chip-button" onClick={() => setProductSheetOpen(false)} disabled={isLoading}>
                  {language === 'CN' ? '取消' : 'Cancel'}
                </button>
                <button
                  type="button"
                  className="chip-button chip-button-primary"
                  disabled={isLoading || !productDraft.trim()}
                  onClick={() => {
                    const text = productDraft.trim();
                    setProductSheetOpen(false);
                    setProductDraft('');
                    void runProductDeepScan(text);
                  }}
                >
                  {language === 'CN' ? '开始评估' : 'Analyze'}
                </button>
              </div>
            </div>
          </Sheet>

          <Sheet
            open={dupeSheetOpen}
            title={language === 'CN' ? '平替对比（Dupe Compare）' : 'Dupe compare'}
            onClose={() => setDupeSheetOpen(false)}
          >
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                {language === 'CN' ? '分别粘贴「原版」和「平替」的产品名或链接。' : 'Paste the original and the dupe (name or link).'}
              </div>

              <label className="space-y-1 text-xs text-muted-foreground">
                {language === 'CN' ? '原版' : 'Original'}
                <input
                  className="h-11 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                  value={dupeDraft.original}
                  onChange={(e) => setDupeDraft((p) => ({ ...p, original: e.target.value }))}
                  placeholder={language === 'CN' ? '例如：Nivea Creme / https://…' : 'e.g., Nivea Creme / https://…'}
                  disabled={isLoading}
                />
              </label>

              <label className="space-y-1 text-xs text-muted-foreground">
                {language === 'CN' ? '平替' : 'Dupe'}
                <input
                  className="h-11 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                  value={dupeDraft.dupe}
                  onChange={(e) => setDupeDraft((p) => ({ ...p, dupe: e.target.value }))}
                  placeholder={language === 'CN' ? '例如：CeraVe Moisturizing Cream / https://…' : 'e.g., CeraVe Moisturizing Cream / https://…'}
                  disabled={isLoading}
                />
              </label>

              <div className="flex gap-2">
                <button type="button" className="chip-button" onClick={() => setDupeSheetOpen(false)} disabled={isLoading}>
                  {language === 'CN' ? '取消' : 'Cancel'}
                </button>
                <button
                  type="button"
                  className="chip-button chip-button-primary"
                  disabled={isLoading || !dupeDraft.original.trim() || !dupeDraft.dupe.trim()}
                  onClick={() => {
                    const original = dupeDraft.original.trim();
                    const dupe = dupeDraft.dupe.trim();
                    setDupeSheetOpen(false);
                    setDupeDraft({ original: '', dupe: '' });
                    void runDupeCompare(original, dupe);
                  }}
                >
                  {language === 'CN' ? '开始对比' : 'Compare'}
                </button>
              </div>
            </div>
          </Sheet>
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

              <label className="space-y-1 text-xs text-muted-foreground">
                {language === 'CN' ? '行程/环境（可选）' : 'Upcoming plan (optional)'}
                <textarea
                  className="min-h-[88px] w-full resize-none rounded-2xl border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
                  value={profileDraft.itinerary}
                  onChange={(e) => setProfileDraft((p) => ({ ...p, itinerary: e.target.value }))}
                  placeholder={
                    language === 'CN'
                      ? '例如：下周出差/旅行（偏干冷/偏潮热），白天户外多；或“最近熬夜/晒太阳多”…'
                      : 'e.g., travel next week (cold/dry or hot/humid), lots of outdoor time; or “late nights / more sun”…'
                  }
                />
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
              const isProductPicks = !isUser && looksLikeProductPicksRawText(item.content);
              if (isProductPicks) {
                return (
                  <div key={item.id} className="chat-card">
                    <ProductPicksCard rawContent={item.content} />
                  </div>
                );
              }
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
                  <BffCardView
                    key={card.card_id}
                    card={card}
                    language={language}
                    debug={debug}
                    session={sessionForCards}
                    onAction={onCardAction}
                    resolveSkuOffers={resolveSkuOffers}
                    bootstrapInfo={bootstrapInfo}
                  />
                ))}
              </div>
            );
          })}

          {isLoading ? <AuroraLoadingCard language={language} /> : null}
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
