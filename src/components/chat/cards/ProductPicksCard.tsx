import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';

type Profile = {
  skinType?: string | null;
  sensitivity?: string | null;
  barrierStatus?: string | null;
  goals?: string[] | null;
  budgetTier?: string | null;
  region?: string | null;
};

type ParsedProduct = {
  rank: number;
  name: string;
  priceText: string | null;
  score: number | null;
  availability: string | null;
  keyActives: string[];
  sensitivityNote: string | null;
  notes: string[];
  kbId: string | null;
};

type ParsedProductPicks = {
  profile: Profile | null;
  meta: Record<string, unknown> | null;
  region: string | null;
  categories: string[];
  riskBarrier: boolean;
  shortlist: ParsedProduct[];
  raw: string;
};

export type ProductPicksCardProps = {
  rawContent: string | Record<string, unknown>;
  onPrimaryClick?: () => void;
  onMakeGentler?: () => void;
  onKeepSimple?: () => void;
};

export const looksLikeProductPicksRawText = (raw: string): boolean => {
  const t = String(raw || '');
  if (!t.trim()) return false;
  const lower = t.toLowerCase();
  return (
    lower.includes('shortlist') &&
    lower.includes('profile=') &&
    /\btotal\s*\d{1,3}\s*\/\s*100\b/i.test(t)
  );
};

function safeJsonParseObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

function extractBalancedJsonAfterKey(raw: string, key: 'profile' | 'meta'): Record<string, unknown> | null {
  const idx = raw.toLowerCase().indexOf(`${key}=`);
  if (idx < 0) return null;
  let i = idx + key.length + 1;
  while (i < raw.length && /\s/.test(raw[i] || '')) i += 1;
  if (raw[i] !== '{') return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let j = i; j < raw.length; j += 1) {
    const ch = raw[j];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (depth === 0) {
      const slice = raw.slice(i, j + 1);
      return safeJsonParseObject(slice);
    }
  }
  return null;
}

function asString(v: unknown): string | null {
  if (typeof v === 'string') {
    const t = v.trim();
    return t ? t : null;
  }
  return null;
}

function asNumber(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => asString(x)).filter(Boolean) as string[];
  const s = asString(v);
  return s ? [s] : [];
}

function humanizeSnake(s: string): string {
  const t = String(s || '').trim();
  if (!t) return '';
  return t
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function titleCaseWord(s: string): string {
  const t = String(s || '').trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function normalizeCategoryLabel(raw: string): string {
  const t = String(raw || '').trim();
  if (!t) return '';
  const lower = t.toLowerCase();
  if (lower === 'serum') return 'Serum';
  if (lower === 'treatment') return 'Treatment';
  return titleCaseWord(t);
}

function normalizeAvailabilityLabel(raw: string | null): string | null {
  const t = String(raw || '').trim();
  if (!t) return null;
  if (/global/i.test(t)) return 'Global';
  return t;
}

function parsePriceDisplay(raw: string | null): string {
  const t = String(raw || '').trim();
  if (!t) return '—';
  if (/unknown/i.test(t) || /—/.test(t)) return '—';
  return t;
}

function parseShortKbId(raw: string | null): string | null {
  const t = String(raw || '').trim();
  if (!t) return null;
  const clean = t.replace(/^kb:/i, '').trim();
  if (!clean) return null;
  return clean.slice(0, 8);
}

function extractKbIdFromText(text: string): string | null {
  const m = String(text || '').match(/\bkb:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{8,})\b/i);
  return m ? m[1] : null;
}

function parseActives(raw: string): string[] {
  const t = String(raw || '').trim();
  if (!t) return [];
  const parts = t
    .replace(/^[-•]\s*/, '')
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean);

  const tokens: string[] = [];
  for (const part of parts) {
    const next = part.split(/[,;·•]/g).map((p) => p.trim()).filter(Boolean);
    tokens.push(...next);
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const tokenRaw of tokens) {
    const token = tokenRaw.replace(/\s+/g, ' ').trim();
    if (!token) continue;

    const lower = token.toLowerCase();
    const normalized =
      lower === 'ha' || lower === 'h.a.'
        ? 'HA'
        : lower.includes('hyaluronic')
          ? 'Hyaluronic Acid'
          : lower.includes('panthenol') || /\bb5\b/i.test(lower)
            ? 'B5 (Panthenol)'
            : lower.includes('niacinamide')
              ? 'Niacinamide'
              : lower.includes('tranexamic')
                ? 'Tranexamic Acid'
                : lower.includes('zinc pca')
                  ? 'Zinc PCA'
                  : token;

    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function normalizeScore01Or100(value: unknown): number | null {
  const n = asNumber(value);
  if (n == null) return null;
  const pct = n <= 1 ? n * 100 : n;
  if (!Number.isFinite(pct)) return null;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

function formatStructuredPrice(product: Record<string, unknown> | null): string | null {
  if (!product) return null;
  const priceObj = product.price && typeof product.price === 'object' && !Array.isArray(product.price) ? (product.price as Record<string, unknown>) : null;
  if (priceObj) {
    const unknown = Boolean((priceObj as any).unknown === true);
    if (unknown) return 'Price unknown';
    const usd = asNumber((priceObj as any).usd);
    const cny = asNumber((priceObj as any).cny);
    if (usd != null) return `$${Math.round(usd * 100) / 100}`;
    if (cny != null) return `¥${Math.round(cny)}`;
  }

  const n = asNumber((product as any).price);
  if (n == null) return null;
  const currency = String((product as any).currency || 'USD').toUpperCase();
  const symbol = currency === 'CNY' || currency === 'RMB' ? '¥' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  return `${symbol}${Math.round(n * 100) / 100}`;
}

function parseProductPicks(input: string | Record<string, unknown>): ParsedProductPicks {
  const raw = typeof input === 'string' ? input : JSON.stringify(input);

  if (typeof input === 'object' && input && !Array.isArray(input)) {
    const profileRaw = input.profile;
    const profileObj = profileRaw && typeof profileRaw === 'object' && !Array.isArray(profileRaw) ? (profileRaw as Record<string, unknown>) : null;
    const shortlistRaw = Array.isArray((input as any).shortlist) ? ((input as any).shortlist as unknown[]) : [];
    const recoRaw = Array.isArray((input as any).recommendations) ? ((input as any).recommendations as unknown[]) : [];

    const structuredShortlist: ParsedProduct[] = shortlistRaw
      .map((it) => (it && typeof it === 'object' && !Array.isArray(it) ? (it as Record<string, unknown>) : null))
      .filter(Boolean)
      .map((it, idx) => ({
        rank: Number((it as any).rank ?? idx + 1) || idx + 1,
        name: asString((it as any).name) || `Product ${idx + 1}`,
        priceText: asString((it as any).price) || null,
        score: typeof (it as any).score === 'number' ? (it as any).score : Number((it as any).score),
        availability: asString((it as any).availability) || null,
        keyActives: parseActives(String((it as any).keyActives ?? (it as any).key_actives ?? '')),
        sensitivityNote: asString((it as any).sensitivity) || null,
        notes: asStringArray((it as any).notes),
        kbId: asString((it as any).kbId ?? (it as any).kb_id) || null,
      }))
      .map((p) => ({ ...p, score: Number.isFinite(p.score ?? NaN) ? Math.max(0, Math.min(100, Math.round(Number(p.score)))) : null }));

    const derivedShortlist: ParsedProduct[] = recoRaw
      .map((it) => (it && typeof it === 'object' && !Array.isArray(it) ? (it as Record<string, unknown>) : null))
      .filter(Boolean)
      .map((it, idx) => {
        const sku =
          it.sku && typeof it.sku === 'object' && !Array.isArray(it.sku)
            ? (it.sku as Record<string, unknown>)
            : it.product && typeof it.product === 'object' && !Array.isArray(it.product)
              ? (it.product as Record<string, unknown>)
              : null;

        const brand = asString(sku?.brand) || asString((it as any).brand) || null;
        const name =
          asString((sku as any)?.display_name) ||
          asString((sku as any)?.displayName) ||
          asString(sku?.name) ||
          asString((it as any).display_name) ||
          asString((it as any).displayName) ||
          asString((it as any).name) ||
          null;

        const score =
          normalizeScore01Or100((it as any).score) ??
          normalizeScore01Or100((it as any).total_score ?? (it as any).totalScore) ??
          normalizeScore01Or100((it as any).fit_score ?? (it as any).fitScore) ??
          normalizeScore01Or100((it as any).aurora_score ?? (it as any).auroraScore) ??
          normalizeScore01Or100((sku as any)?.score) ??
          normalizeScore01Or100((sku as any)?.aurora_score ?? (sku as any)?.auroraScore) ??
          null;

        const evidencePack =
          (it as any).evidence_pack && typeof (it as any).evidence_pack === 'object' && !Array.isArray((it as any).evidence_pack)
            ? ((it as any).evidence_pack as Record<string, unknown>)
            : (it as any).evidencePack && typeof (it as any).evidencePack === 'object' && !Array.isArray((it as any).evidencePack)
              ? ((it as any).evidencePack as Record<string, unknown>)
              : (sku as any)?.evidence_pack && typeof (sku as any).evidence_pack === 'object' && !Array.isArray((sku as any).evidence_pack)
                ? ((sku as any).evidence_pack as Record<string, unknown>)
                : (sku as any)?.evidencePack && typeof (sku as any).evidencePack === 'object' && !Array.isArray((sku as any).evidencePack)
                  ? ((sku as any).evidencePack as Record<string, unknown>)
                  : null;

        const keyActivesRaw = evidencePack ? ((evidencePack as any).keyActives ?? (evidencePack as any).key_actives) : null;
        const keyActives = Array.isArray(keyActivesRaw) ? asStringArray(keyActivesRaw) : parseActives(String(keyActivesRaw ?? ''));

        const sensitivityFlagsRaw = evidencePack ? ((evidencePack as any).sensitivityFlags ?? (evidencePack as any).sensitivity_flags) : null;
        const sensitivityFlags = asStringArray(sensitivityFlagsRaw);
        const sensitivityNote = sensitivityFlags.length ? sensitivityFlags.slice(0, 2).join(' · ') : null;

        const availabilityRaw = Array.isArray((sku as any)?.availability) ? ((sku as any).availability as unknown[]) : (evidencePack as any)?.availability;
        const availability = asStringArray(availabilityRaw)[0] || null;

        const notes = asStringArray((it as any).notes).slice(0, 6);
        const kbId =
          asString((sku as any)?.product_id) ||
          asString((sku as any)?.productId) ||
          asString((sku as any)?.sku_id) ||
          asString((sku as any)?.skuId) ||
          null;

        const displayName = [brand, name].filter(Boolean).join(' ').trim() || `Product ${idx + 1}`;
        const priceText = formatStructuredPrice(sku);

        return {
          rank: idx + 1,
          name: displayName,
          priceText: priceText || null,
          score,
          availability: availability ? normalizeAvailabilityLabel(availability) : null,
          keyActives,
          sensitivityNote,
          notes,
          kbId,
        } satisfies ParsedProduct;
      });

    const categories =
      asStringArray((input as any).categories).map(normalizeCategoryLabel).filter(Boolean);
    const region = normalizeAvailabilityLabel(asString((input as any).region) || null);

    const profile: Profile | null = profileObj
      ? {
          skinType: asString(profileObj.skinType) || null,
          sensitivity: asString(profileObj.sensitivity) || null,
          barrierStatus: asString(profileObj.barrierStatus) || null,
          goals: asStringArray(profileObj.goals),
          region: asString(profileObj.region) || null,
          budgetTier: asString(profileObj.budgetTier) || null,
        }
      : null;

    const barrierImpaired = String(profile?.barrierStatus || '').toLowerCase() === 'impaired';

    const shortlist = structuredShortlist.length ? structuredShortlist : derivedShortlist;
    const inferredCategories = shortlist
      .map((p) => {
        const t = p.name.toLowerCase();
        if (t.includes('spf') || t.includes('sunscreen')) return 'Sunscreen';
        if (t.includes('cleanser')) return 'Cleanser';
        if (t.includes('moist')) return 'Moisturizer';
        if (t.includes('serum')) return 'Serum';
        return '';
      })
      .filter(Boolean);

    return {
      profile,
      meta: null,
      region: region || profile?.region || null,
      categories: categories.length ? categories : inferredCategories.length ? Array.from(new Set(inferredCategories)).slice(0, 2) : ['Serum', 'Treatment'],
      riskBarrier: barrierImpaired,
      shortlist,
      raw,
    };
  }

  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const profileObj = extractBalancedJsonAfterKey(raw, 'profile');
  const metaObj = extractBalancedJsonAfterKey(raw, 'meta');

  const profile: Profile | null = profileObj
    ? {
        skinType: asString(profileObj.skinType) || null,
        sensitivity: asString(profileObj.sensitivity) || null,
        barrierStatus: asString(profileObj.barrierStatus) || null,
        goals: asStringArray(profileObj.goals),
        region: asString(profileObj.region) || null,
        budgetTier: asString(profileObj.budgetTier) || null,
      }
    : null;

  let region: string | null = null;
  let categories: string[] = [];
  let riskBarrier = /possible barrier impairment/i.test(raw);

  const items: ParsedProduct[] = [];
  let current: ParsedProduct | null = null;

  const pushCurrent = () => {
    if (!current) return;
    current.keyActives = Array.from(new Set(current.keyActives.map((a) => a.trim()).filter(Boolean)));
    items.push(current);
    current = null;
  };

  for (const lineRaw of lines) {
    const line = String(lineRaw || '');
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (!region) {
      if (/region\s*:/i.test(trimmed) && /global/i.test(trimmed)) region = 'Global';
      const m = trimmed.match(/^\s*-\s*Region\s*:\s*(.+)$/i);
      if (!region && m) {
        const rawRegion = m[1];
        if (/global/i.test(rawRegion)) region = 'Global';
      }
    }

    if (!categories.length) {
      const m = trimmed.match(/^\s*-\s*Categories\s*:\s*(.+)$/i);
      if (m) {
        categories = m[1]
          .replace(/\.$/, '')
          .split('/')
          .map((c) => normalizeCategoryLabel(c))
          .filter(Boolean);
      }
    }

    if (/possible barrier impairment/i.test(trimmed)) riskBarrier = true;

    const start = trimmed.match(/^\s*(\d+)\)\s*(.+?)(?:[（(]\s*([^）)]*)\s*[）)])?\s*✅?\s*(?:Total\s*)?(\d{1,3})\s*\/\s*100\b(.*)$/i);
    if (start) {
      pushCurrent();
      const rank = Math.max(1, Math.trunc(Number(start[1]) || 1));
      const name = String(start[2] || '').trim();
      const priceText = asString(start[3]) || null;
      const score = Math.max(0, Math.min(100, Math.round(Number(start[4]))));
      const tail = String(start[5] || '');
      const kbIdInline = extractKbIdFromText(tail);
      current = {
        rank,
        name: name || `Product ${rank}`,
        priceText,
        score,
        availability: null,
        keyActives: [],
        sensitivityNote: null,
        notes: [],
        kbId: kbIdInline || null,
      };
      continue;
    }

    if (!current) continue;

    const kbId = extractKbIdFromText(trimmed);
    if (kbId && !current.kbId) {
      current.kbId = kbId;
      continue;
    }

    const activesLine = trimmed.match(/^\s*-\s*Key actives\s*:\s*(.+)$/i);
    if (activesLine) {
      current.keyActives.push(...parseActives(activesLine[1]));
      continue;
    }

    const sensLine = trimmed.match(/^\s*-\s*Sensitivity\s*:\s*(.+)$/i);
    if (sensLine) {
      current.sensitivityNote = String(sensLine[1] || '').trim() || null;
      continue;
    }

    const availLine = trimmed.match(/^\s*-\s*Availability\s*:\s*(.+)$/i);
    if (availLine) {
      current.availability = normalizeAvailabilityLabel(availLine[1]) || null;
      continue;
    }

    if (trimmed.startsWith('-')) current.notes.push(trimmed.replace(/^\s*-\s*/, '').trim());
  }
  pushCurrent();

  const barrierImpaired = String(profile?.barrierStatus || '').toLowerCase() === 'impaired';
  if (barrierImpaired) riskBarrier = true;

  return {
    profile,
    meta: metaObj,
    region: region || normalizeAvailabilityLabel(profile?.region || null) || 'Global',
    categories: categories.length ? categories : ['Serum', 'Treatment'],
    riskBarrier,
    shortlist: items.slice(0, 50),
    raw,
  };
}

function scoreSafest(item: ParsedProduct, { barrierImpaired }: { barrierImpaired: boolean }): number {
  const hay = `${item.name} ${item.keyActives.join(' ')} ${item.sensitivityNote || ''} ${item.notes.join(' ')}`.toLowerCase();

  const prefer = ['minimalist', 'low irritant', 'barrier support', 'hydrating', 'hyaluronic', 'ha', 'b5', 'panthenol', 'ceramide', 'soothing'];
  const avoidImpaired = ['copper peptides', '10% niacinamide', 'mild_acid', 'pha', 'vitamin c', 'ascorb', 'glycolic', 'lactic', 'salicylic'];
  const caution = ['irritat', 'burn', 'sting', 'fragrance', 'pill', 'acid', 'exfoliat'];

  let s = 0;
  for (const w of prefer) if (hay.includes(w)) s += 2;
  if (barrierImpaired) for (const w of avoidImpaired) if (hay.includes(w)) s -= 5;
  for (const w of caution) if (hay.includes(w)) s -= 2;
  if (typeof item.score === 'number') s += item.score / 100;
  return s;
}

function buildWhyLine(item: ParsedProduct): string {
  const actives = item.keyActives.slice(0, 4);
  if (actives.length) return `Key actives: ${actives.slice(0, 2).join(', ')}.`;
  const sens = item.sensitivityNote ? item.sensitivityNote.split('|')[0]?.trim() : '';
  if (sens) return sens.length > 120 ? `${sens.slice(0, 117)}…` : sens;
  const note = item.notes.find(Boolean) || '';
  if (note) return note.length > 120 ? `${note.slice(0, 117)}…` : note;
  return 'Overall fit looks reasonable for your profile.';
}

function buildCautionLine(item: ParsedProduct, { barrierImpaired }: { barrierImpaired: boolean }): string | null {
  const hay = `${item.name} ${item.keyActives.join(' ')} ${item.sensitivityNote || ''} ${item.notes.join(' ')}`.toLowerCase();
  const triggers = ['irritat', 'burn', 'sting', 'fragrance', 'pill', 'acid', 'pha', 'vitamin c', 'copper peptides', '10% niacinamide', 'mild_acid'];
  const hit = triggers.some((w) => hay.includes(w));
  if (!hit) return null;

  const src = item.sensitivityNote || item.notes.join(' · ');
  const parts = src.split('|').map((p) => p.trim()).filter(Boolean);
  const picked = parts.find((p) => /irritat|burn|sting|fragrance|pill|acid|pha|vitamin c|copper peptides|10% niacinamide|mild_acid/i.test(p)) || parts[0] || '';
  if (!picked) return barrierImpaired ? 'Barrier impaired: stick to low-irritation options.' : 'May irritate sensitive skin; patch test.';

  const short = picked.length > 140 ? `${picked.slice(0, 137)}…` : picked;
  return barrierImpaired ? `Barrier impaired: ${short}` : short;
}

const clampStyle = (lines: number): React.CSSProperties => ({
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});

function ProductList({
  items,
  barrierImpaired,
}: {
  items: ParsedProduct[];
  barrierImpaired: boolean;
}) {
  const [open, setOpen] = React.useState<Record<number, boolean>>({});
  const toggle = (rank: number) => setOpen((prev) => ({ ...prev, [rank]: !prev[rank] }));

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const expanded = Boolean(open[item.rank]);
        const detailsId = `pp_details_${item.rank}`;
        const kbShort = parseShortKbId(item.kbId);
        const actives = item.keyActives.slice(0, 4);
        const caution = buildCautionLine(item, { barrierImpaired });
        const why = buildWhyLine(item);
        return (
          <div key={`${item.rank}_${item.name}`} className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-start gap-2">
                  <div className="mt-[2px] w-5 shrink-0 text-xs font-semibold text-slate-500">{item.rank}</div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{item.name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="whitespace-nowrap">{parsePriceDisplay(item.priceText)}</span>
                      {item.availability ? (
                        <Badge variant="secondary" className="whitespace-nowrap">
                          {normalizeAvailabilityLabel(item.availability) || item.availability}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              {typeof item.score === 'number' ? (
                <span className="shrink-0 rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-xs font-semibold text-foreground">
                  {item.score}/100
                </span>
              ) : (
                <span className="shrink-0 rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-xs font-semibold text-slate-500">
                  —/100
                </span>
              )}
            </div>

            <div className="text-sm leading-relaxed text-slate-700">
              <span className="font-medium text-slate-900">Why:</span> {why}
            </div>

            {caution ? (
              <div className="text-sm leading-relaxed text-amber-700">
                <span className="font-medium">Caution:</span> {caution}
              </div>
            ) : null}

            <div className="flex items-center justify-between">
              <button
                type="button"
                className="text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label={`Toggle details for product ${item.rank}`}
                aria-expanded={expanded}
                aria-controls={detailsId}
                onClick={() => toggle(item.rank)}
              >
                Details
              </button>
              {kbShort ? <code className="text-xs text-slate-500">kb:{kbShort}</code> : null}
            </div>

            <div id={detailsId} hidden={!expanded} className="space-y-2">
              {actives.length ? (
                <div className="flex flex-wrap gap-2">
                  {actives.map((a) => (
                    <Badge key={a} variant="outline" className="whitespace-nowrap">
                      {a}
                    </Badge>
                  ))}
                </div>
              ) : null}

              {item.sensitivityNote ? (
                <div className="text-sm text-slate-700" style={clampStyle(2)}>
                  {item.sensitivityNote}
                </div>
              ) : null}

              {item.notes.length ? (
                <div className="text-sm text-slate-700" style={clampStyle(2)}>
                  {item.notes.join(' · ')}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ProductPicksCard({
  rawContent,
  onPrimaryClick,
  onMakeGentler,
  onKeepSimple,
}: ProductPicksCardProps) {
  const parsed = React.useMemo(() => parseProductPicks(rawContent), [rawContent]);
  const profile = parsed.profile;

  const barrierImpaired = String(profile?.barrierStatus || '').toLowerCase() === 'impaired' || parsed.riskBarrier;
  const region = normalizeAvailabilityLabel(parsed.region) || 'Global';
  const categories = parsed.categories.length ? parsed.categories : ['Serum', 'Treatment'];
  const subtitle = `${categories.join(' / ')} · ${region}`;

  const shortlist = parsed.shortlist.slice(0, 5);
  const safest = React.useMemo(() => {
    if (!shortlist.length) return [];
    const scored = [...shortlist].map((p) => ({ p, s: scoreSafest(p, { barrierImpaired }) }));
    scored.sort((a, b) => b.s - a.s);
    const chosen = scored.slice(0, 2).map((x) => x.p);
    if (chosen.length === 2) return chosen;
    return shortlist.slice(0, 2);
  }, [barrierImpaired, shortlist]);

  const [fullOpen, setFullOpen] = React.useState(false);
  const fullId = React.useId();

  const skinChip = profile?.skinType ? `Skin: ${titleCaseWord(profile.skinType)}` : null;
  const sensitivityChip = profile?.sensitivity ? `Sensitivity: ${titleCaseWord(profile.sensitivity)}` : null;
  const barrierChip = profile?.barrierStatus
    ? `Barrier: ${titleCaseWord(profile.barrierStatus)}`
    : null;
  const goals = (profile?.goals || []).map(humanizeSnake).filter(Boolean);
  const goalsChip = goals.length ? `Goals: ${goals.join(' · ')}` : null;
  const budgetChip = profile?.budgetTier ? `Budget: ${profile.budgetTier}` : null;

  const profileChips = [skinChip, sensitivityChip, barrierChip, goalsChip, budgetChip].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="space-y-1">
          <div className="text-base font-semibold text-foreground">Product picks</div>
          <div className="text-sm text-slate-500">{subtitle}</div>
        </div>

        {barrierImpaired ? (
          <div className="text-sm font-medium text-amber-800">
            🚫 Barrier impaired — avoid high-irritation options for now.
          </div>
        ) : null}
      </div>

      {profileChips.length ? (
        <div className="flex flex-wrap gap-2">
          {profileChips.map((label) => (
            <Badge key={label} variant="secondary" className="whitespace-nowrap">
              {label}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="text-sm leading-relaxed text-slate-500">
        Filters: Available in {region} · Category: {categories.join('/')} · Preference: Low-irritation
      </div>

      <div className="space-y-3">
        <div className="text-sm font-semibold text-foreground">Safest picks ({Math.min(2, safest.length) || 2})</div>
        {safest.length ? (
          <ProductList items={safest} barrierImpaired={barrierImpaired} />
        ) : (
          <div className="text-sm text-slate-500">No products found in the shortlist.</div>
        )}
      </div>

      <div className="space-y-3">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Toggle full shortlist"
          aria-expanded={fullOpen}
          aria-controls={fullId}
          onClick={() => setFullOpen((v) => !v)}
        >
          <span>Full shortlist ({shortlist.length || 5})</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${fullOpen ? 'rotate-180' : ''}`} />
        </button>

        <div id={fullId} hidden={!fullOpen}>
          {shortlist.length ? (
            <ProductList items={shortlist} barrierImpaired={barrierImpaired} />
          ) : (
            <div className="text-sm text-slate-500">No products found in the shortlist.</div>
          )}
        </div>
      </div>

      <div className="space-y-2 pt-1">
        <Button className="w-full" onClick={onPrimaryClick} aria-label="See product recommendations">
          See product recommendations
        </Button>
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="link" size="sm" onClick={onMakeGentler} aria-label="Make gentler">
            Make gentler
          </Button>
          <Button variant="link" size="sm" onClick={onKeepSimple} aria-label="Keep simple">
            Keep simple
          </Button>
        </div>
      </div>

      {false ? (
        <pre className="max-h-[220px] overflow-auto rounded-lg bg-muted p-3 text-xs text-slate-700">{parsed.raw}</pre>
      ) : null}
    </div>
  );
}

// Example usage:
// <ProductPicksCard rawContent={rawTextFromAssistant} onPrimaryClick={() => console.log('primary')} />
