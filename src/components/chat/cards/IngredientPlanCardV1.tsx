import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Shield, Zap, Leaf, AlertTriangle } from 'lucide-react';

type Language = 'EN' | 'CN';

type Target = {
  ingredient_id?: string;
  ingredientId?: string;
  ingredient_name?: string;
  role?: string;
  priority?: number;
  usage_guidance?: string[];
  confidence?: { score?: number; level?: string; rationale?: unknown };
};

type AvoidItem = {
  ingredient_id?: string;
  ingredient_name?: string;
  severity?: string;
  reason?: string[];
};

type Conflict = {
  id?: string;
  description?: string;
  message?: string;
};

type Props = {
  payload: Record<string, unknown>;
  language: Language;
};

const asString = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asObject = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const INGREDIENT_DISPLAY_NAMES: Record<string, string> = {
  ceramide_np: 'Ceramide NP',
  panthenol: 'Panthenol (B5)',
  niacinamide: 'Niacinamide',
  zinc_pca: 'Zinc PCA',
  salicylic_acid: 'Salicylic acid (BHA)',
  azelaic_acid: 'Azelaic acid',
  ascorbic_acid: 'Vitamin C (Ascorbic acid)',
  retinol: 'Retinol',
  benzoyl_peroxide: 'Benzoyl peroxide',
  sunscreen_filters: 'Sunscreen (UV filters)',
  glycerin: 'Glycerin',
  hyaluronic_acid: 'Hyaluronic acid',
};

const INTENSITY_EXPLANATIONS: Record<string, Record<string, string>> = {
  EN: {
    gentle: 'No strong actives. Focus on hydration and barrier support.',
    balanced: 'Includes mild actives at moderate frequency.',
    active: 'Includes 1-2 stronger actives. Start low and increase only if comfortable.',
  },
  CN: {
    gentle: '无强活性成分，侧重保湿与屏障修复。',
    balanced: '含温和活性成分，频率适中。',
    active: '含1-2种较强活性成分，建议低频起步，耐受后再逐步增加。',
  },
};

const INTENSITY_STYLES: Record<string, { icon: typeof Shield; pillClass: string }> = {
  gentle: { icon: Shield, pillClass: 'bg-green-100 text-green-800 border-green-200' },
  balanced: { icon: Leaf, pillClass: 'bg-blue-100 text-blue-800 border-blue-200' },
  active: { icon: Zap, pillClass: 'bg-amber-100 text-amber-800 border-amber-200' },
};

function friendlyName(target: Target): string {
  const name = asString(target.ingredient_name);
  if (name) return name;
  const id = asString(target.ingredient_id) || asString(target.ingredientId);
  if (!id) return 'Ingredient';
  return INGREDIENT_DISPLAY_NAMES[id] || id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function friendlyAvoidName(item: AvoidItem): string {
  const name = asString(item.ingredient_name);
  if (name) return name;
  const id = asString(item.ingredient_id);
  if (!id) return 'Ingredient';
  return INGREDIENT_DISPLAY_NAMES[id] || id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function highlightIngredients(text: string, targets: Target[]): React.ReactNode {
  const names = targets
    .map((t) => friendlyName(t).toLowerCase())
    .filter((n) => n.length > 3)
    .sort((a, b) => b.length - a.length);
  if (!names.length) return text;

  const ids = targets
    .map((t) => asString(t.ingredient_id) || asString(t.ingredientId))
    .filter(Boolean);

  const aliasMap: Record<string, string> = {};
  for (const t of targets) {
    const id = asString(t.ingredient_id) || asString(t.ingredientId);
    const display = friendlyName(t);
    if (id) aliasMap[id.toLowerCase()] = display;
    aliasMap[display.toLowerCase()] = display;
    if (id === 'retinol') { aliasMap['retinoid'] = display; aliasMap['retinoids'] = display; }
    if (id === 'salicylic_acid') { aliasMap['bha'] = display; aliasMap['exfoliating acid'] = display; aliasMap['exfoliating acids'] = display; }
    if (id === 'ascorbic_acid') { aliasMap['vitamin c'] = display; }
  }

  const allTerms = Object.keys(aliasMap).sort((a, b) => b.length - a.length);
  const pattern = allTerms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  if (!pattern) return text;

  const regex = new RegExp(`(${pattern})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) => {
    const match = aliasMap[part.toLowerCase()];
    if (match) return <strong key={i} className="font-semibold">{part}</strong>;
    return part;
  });
}

function FitBar({ value, size = 'sm' }: { value: number; size?: 'sm' | 'md' }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const color = clamped >= 75 ? 'bg-green-500' : clamped >= 50 ? 'bg-amber-500' : 'bg-red-400';
  const h = size === 'md' ? 'h-2' : 'h-1.5';
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 rounded-full bg-muted/40 ${h}`}>
        <div className={`${h} rounded-full ${color}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{clamped}/100</span>
    </div>
  );
}

export function IngredientPlanCardV1({ payload, language }: Props) {
  const [expanded, setExpanded] = useState(false);

  const planObj = useMemo(() => asObject((payload as any).plan) ?? asObject(payload) ?? {}, [payload]);
  const intensity = useMemo(() => asString((planObj as any).intensity) || asString((payload as any).intensity) || 'balanced', [planObj, payload]);
  const targets = useMemo(() =>
    asArray((planObj as any).targets ?? (payload as any).targets)
      .map((item) => asObject(item))
      .filter(Boolean) as Target[],
    [planObj, payload],
  );
  const avoid = useMemo(() =>
    asArray((planObj as any).avoid ?? (payload as any).avoid)
      .map((item) => asObject(item))
      .filter(Boolean) as AvoidItem[],
    [planObj, payload],
  );
  const conflicts = useMemo(() =>
    asArray((planObj as any).conflicts ?? (payload as any).conflicts)
      .map((item) => asObject(item))
      .filter(Boolean) as Conflict[],
    [planObj, payload],
  );
  const confidence = useMemo(() => asObject((planObj as any).confidence ?? (payload as any).confidence), [planObj, payload]);
  const confidenceLevel = useMemo(() => {
    const level = asString(confidence?.level as unknown);
    if (level) return level.charAt(0).toUpperCase() + level.slice(1);
    return '';
  }, [confidence]);

  const heroTargets = useMemo(() => targets.filter((t) => t.role === 'hero').sort((a, b) => (b.priority || 0) - (a.priority || 0)), [targets]);
  const supportTargets = useMemo(() => targets.filter((t) => t.role !== 'hero').sort((a, b) => (b.priority || 0) - (a.priority || 0)), [targets]);
  const topHeroes = heroTargets.slice(0, 2);
  const firstConflict = conflicts[0];

  const intensityStyle = INTENSITY_STYLES[intensity] || INTENSITY_STYLES.balanced;
  const IntensityIcon = intensityStyle.icon;
  const intensityLabel = intensity.charAt(0).toUpperCase() + intensity.slice(1);
  const lang = language === 'CN' ? 'CN' : 'EN';
  const intensityExplanation = INTENSITY_EXPLANATIONS[lang]?.[intensity] || '';

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${intensityStyle.pillClass}`}>
            <IntensityIcon className="h-3 w-3" />
            {intensityLabel}
          </span>
          {confidenceLevel ? (
            <span className="text-xs text-muted-foreground">
              {lang === 'CN' ? `${confidenceLevel}置信` : `${confidenceLevel} confidence`}
            </span>
          ) : null}
        </div>
      </div>

      {/* Top hero targets */}
      {topHeroes.length ? (
        <div className="space-y-2">
          {topHeroes.map((t, i) => (
            <div key={`hero_${i}`} className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{friendlyName(t)}</span>
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  {lang === 'CN' ? '核心' : 'Core'}
                </span>
              </div>
              {typeof t.priority === 'number' ? (
                <div className="mt-1.5">
                  <FitBar value={t.priority} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {/* Key conflict rule */}
      {firstConflict ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {lang === 'CN' ? '关键规则：' : 'Key rule: '}
            {highlightIngredients(
              asString(firstConflict.description) || asString(firstConflict.message) || '',
              targets,
            )}
          </span>
        </div>
      ) : null}

      {/* CTA */}
      <button
        type="button"
        className="flex w-full items-center justify-center gap-1 rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/30"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded
          ? (lang === 'CN' ? '收起详情' : 'Hide details')
          : (lang === 'CN' ? '查看详情' : 'View details')}
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {/* Expanded detail sheet */}
      {expanded ? (
        <div className="space-y-4 border-t border-border/40 pt-3">
          {/* Intensity explanation */}
          {intensityExplanation ? (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{intensityLabel}: </span>
              {intensityExplanation}
            </div>
          ) : null}

          {/* All hero ingredients */}
          {heroTargets.length ? (
            <div>
              <div className="text-xs font-semibold text-foreground">
                {lang === 'CN' ? '核心成分' : 'Core ingredients'}
              </div>
              <div className="mt-2 space-y-2">
                {heroTargets.map((t, i) => (
                  <div key={`hero_detail_${i}`} className="rounded-xl border border-border/50 bg-muted/10 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{friendlyName(t)}</span>
                    </div>
                    {typeof t.priority === 'number' ? (
                      <div className="mt-1"><FitBar value={t.priority} size="md" /></div>
                    ) : null}
                    {Array.isArray(t.usage_guidance) && t.usage_guidance.length ? (
                      <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                        {t.usage_guidance.slice(0, 2).map((g, gi) => (
                          <li key={gi} className="flex items-start gap-1.5">
                            <span className="mt-1 block h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                            {typeof g === 'string' ? g : ''}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Support ingredients (collapsible) */}
          {supportTargets.length ? (
            <SupportSection targets={supportTargets} language={lang} />
          ) : null}

          {/* Avoid / Caution */}
          {avoid.length ? (
            <div>
              <div className="text-xs font-semibold text-foreground">
                {lang === 'CN' ? '需规避/谨慎' : 'Avoid / Caution'}
              </div>
              <div className="mt-1.5 space-y-1">
                {avoid.slice(0, 6).map((item, i) => (
                  <div key={`avoid_${i}`} className="flex items-center gap-2 text-xs">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      item.severity === 'avoid'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {item.severity === 'avoid'
                        ? (lang === 'CN' ? '避免' : 'Avoid')
                        : (lang === 'CN' ? '谨慎' : 'Caution')}
                    </span>
                    <span className="text-foreground">{friendlyAvoidName(item)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* All conflicts */}
          {conflicts.length > 1 ? (
            <div>
              <div className="text-xs font-semibold text-foreground">
                {lang === 'CN' ? '搭配规则' : 'Pairing rules'}
              </div>
              <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                {conflicts.map((c, i) => (
                  <li key={`conflict_${i}`} className="flex items-start gap-1.5">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                    <span>{highlightIngredients(asString(c.description) || asString(c.message) || '', targets)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SupportSection({ targets, language }: { targets: Target[]; language: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center justify-between text-xs font-semibold text-foreground"
        onClick={() => setOpen(!open)}
      >
        <span>
          {language === 'CN'
            ? `辅助成分 (${targets.length})`
            : `Support ingredients (${targets.length})`}
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open ? (
        <div className="mt-2 space-y-1.5">
          {targets.map((t, i) => (
            <div key={`support_${i}`} className="rounded-lg border border-border/40 bg-muted/10 px-3 py-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{friendlyName(t)}</span>
              </div>
              {typeof t.priority === 'number' ? (
                <div className="mt-1"><FitBar value={t.priority} /></div>
              ) : null}
              {Array.isArray(t.usage_guidance) && t.usage_guidance.length ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  {typeof t.usage_guidance[0] === 'string' ? t.usage_guidance[0] : ''}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default IngredientPlanCardV1;
