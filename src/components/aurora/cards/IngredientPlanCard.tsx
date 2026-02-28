import React, { useMemo } from 'react';

import {
  emitDiscoveryLinkOpenAttempt,
  emitDiscoveryLinkOpenResult,
  emitIngredientProductOpenAttempt,
  emitIngredientProductOpenResult,
  type AnalyticsContext,
} from '@/lib/auroraAnalytics';
import { buildPdpUrl, extractPdpTargetFromProductGroupId } from '@/lib/pivotaShop';
import type { Language } from '@/lib/types';

type ProductLike = {
  product_id?: string;
  merchant_id?: string;
  title?: string;
  name?: string;
  brand?: string;
  source?: string;
  price?: unknown;
  currency?: string;
  pdp_url?: string;
  url?: string;
  product_url?: string;
  purchase_path?: string;
  product_ref?: { product_id?: string; merchant_id?: string };
  canonical_product_ref?: { product_id?: string; merchant_id?: string };
  subject_product_group_id?: string;
  product_group_id?: string;
  pdp_open?: {
    path?: string;
    subject?: { id?: string; product_group_id?: string };
    product_ref?: { product_id?: string; merchant_id?: string };
    external?: { url?: string };
  };
};

type IngredientTargetLike = {
  ingredient_name?: string;
  ingredient?: string;
  display_name?: string;
  products?: {
    competitors?: ProductLike[];
    dupes?: ProductLike[];
  };
};

const asTargets = (value: unknown): IngredientTargetLike[] =>
  (Array.isArray(value) ? value : [])
    .map((item) => (item && typeof item === 'object' && !Array.isArray(item) ? (item as IngredientTargetLike) : null))
    .filter(Boolean) as IngredientTargetLike[];

const asProductRows = (value: unknown): ProductLike[] =>
  (Array.isArray(value) ? value : [])
    .map((item) => (item && typeof item === 'object' && !Array.isArray(item) ? (item as ProductLike) : null))
    .filter(Boolean) as ProductLike[];

const safeUrl = (value: unknown): string => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (!/^https?:\/\//i.test(text)) return '';
  try {
    new URL(text);
    return text;
  } catch {
    return '';
  }
};

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text : null;
};

const readRefTarget = (raw: unknown): { product_id: string; merchant_id?: string } | null => {
  const ref = asObject(raw);
  if (!ref) return null;
  const productId = asNonEmptyString(ref.product_id) || asNonEmptyString(ref.productId) || null;
  const merchantId = asNonEmptyString(ref.merchant_id) || asNonEmptyString(ref.merchantId) || null;
  if (!productId) return null;
  return merchantId ? { product_id: productId, merchant_id: merchantId } : { product_id: productId };
};

const deriveInternalPdpUrlFromContract = (row: ProductLike): string => {
  const pdpOpen = (asObject(row.pdp_open) || asObject((row as any).pdpOpen)) as Record<string, unknown> | null;
  const directRef =
    readRefTarget(pdpOpen?.product_ref) || readRefTarget(row.product_ref) || readRefTarget(row.canonical_product_ref);
  if (directRef?.product_id) {
    return safeUrl(buildPdpUrl(directRef));
  }

  const groupId =
    asNonEmptyString((asObject(pdpOpen?.subject) || null)?.id) ||
    asNonEmptyString((asObject(pdpOpen?.subject) || null)?.product_group_id) ||
    asNonEmptyString(row.subject_product_group_id) ||
    asNonEmptyString(row.product_group_id) ||
    null;
  const targetFromGroup = extractPdpTargetFromProductGroupId(groupId);
  if (targetFromGroup?.product_id) {
    return safeUrl(buildPdpUrl(targetFromGroup));
  }
  return '';
};

const productOpenUrl = (row: ProductLike): string =>
  safeUrl(row.pdp_url) ||
  safeUrl(row.url) ||
  safeUrl(row.product_url) ||
  safeUrl(row.purchase_path) ||
  deriveInternalPdpUrlFromContract(row) ||
  safeUrl(row.pdp_open?.external?.url);

type OpenResult = 'success_new_tab' | 'success_same_tab_fallback' | 'blocked_popup' | 'blocked_invalid_url' | 'failed_unknown';

function openWithAnchorFallback(url: string): { result: OpenResult; blockedReason?: string } {
  if (!url) return { result: 'blocked_invalid_url', blockedReason: 'invalid_url' };
  try {
    const opened = Boolean(window.open(url, '_blank', 'noopener,noreferrer'));
    if (opened) return { result: 'success_new_tab' };
    try {
      window.location.assign(url);
      return { result: 'success_same_tab_fallback', blockedReason: 'popup_blocked_fallback_same_tab' };
    } catch {
      return { result: 'blocked_popup', blockedReason: 'popup_blocked_and_fallback_failed' };
    }
  } catch {
    return { result: 'failed_unknown', blockedReason: 'open_exception' };
  }
}

export function IngredientPlanCard({
  payload,
  language,
  analyticsCtx,
  cardId,
}: {
  payload: Record<string, unknown>;
  language: Language;
  analyticsCtx?: AnalyticsContext;
  cardId?: string;
}) {
  const previewOnly = payload.preview_only === true;
  const targets = asTargets(payload.targets);
  const externalSearchCtas = asProductRows(payload.external_search_ctas);

  const labels =
    language === 'CN'
      ? {
          title: '目标成分与产品',
          preview: '补全 AM/PM routine 后将解锁个性化产品推荐。',
          competitors: '主选',
          dupes: '平替',
          linkUnavailable: '链接暂不可用',
          search: '外部检索',
        }
      : {
          title: 'Target ingredients + products',
          preview: 'Complete AM/PM routine to unlock personalized product picks.',
          competitors: 'Primary picks',
          dupes: 'Alternatives',
          linkUnavailable: 'Link unavailable',
          search: 'External search',
        };

  const sections = useMemo(
    () =>
      targets.map((target, index) => {
        const ingredient =
          String(target.ingredient_name || '').trim() ||
          String(target.ingredient || '').trim() ||
          String(target.display_name || '').trim() ||
          `target_${index + 1}`;
        const competitors = asProductRows(target.products?.competitors);
        const dupes = asProductRows(target.products?.dupes);
        return { ingredient, competitors, dupes };
      }),
    [targets],
  );

  const onOpenProduct = (row: ProductLike, source: 'competitors' | 'dupes' | 'external_search_ctas') => {
    const url = productOpenUrl(row);
    const productId = String(row.product_id || '').trim() || null;
    const isDiscovery = source === 'external_search_ctas';
    if (analyticsCtx && isDiscovery) {
      emitDiscoveryLinkOpenAttempt(analyticsCtx, {
        card_id: cardId ?? null,
        source_card_type: 'ingredient_plan_v2',
        source_bucket: source,
        url: url || null,
      });
    } else if (analyticsCtx) {
      emitIngredientProductOpenAttempt(analyticsCtx, {
        card_id: cardId ?? null,
        product_id: productId,
        source_card_type: 'ingredient_plan_v2',
        source_bucket: source,
        url: url || null,
      });
    }
    const openResult = openWithAnchorFallback(url);
    if (analyticsCtx && isDiscovery) {
      emitDiscoveryLinkOpenResult(analyticsCtx, {
        card_id: cardId ?? null,
        source_card_type: 'ingredient_plan_v2',
        source_bucket: source,
        url: url || null,
        result: openResult.result,
        blocked_reason: openResult.blockedReason ?? null,
      });
    } else if (analyticsCtx) {
      emitIngredientProductOpenResult(analyticsCtx, {
        card_id: cardId ?? null,
        product_id: productId,
        source_card_type: 'ingredient_plan_v2',
        source_bucket: source,
        url: url || null,
        result: openResult.result,
        blocked_reason: openResult.blockedReason ?? null,
      });
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-3" data-testid="ingredient-plan-v2-card">
      <div className="text-sm font-semibold text-foreground">{labels.title}</div>
      {previewOnly ? (
        <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">{labels.preview}</div>
      ) : null}

      {sections.map((section) => (
        <div key={section.ingredient} className="space-y-2 rounded-xl border border-border/60 bg-background/80 p-3">
          <div className="text-sm font-semibold text-foreground">{section.ingredient}</div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">{labels.competitors}</div>
            {section.competitors.length ? (
              section.competitors.slice(0, 5).map((row, index) => {
                const name = String(row.title || row.name || '').trim() || `product_${index + 1}`;
                const brand = String(row.brand || '').trim();
                const source = String(row.source || '').trim();
                const url = productOpenUrl(row);
                return (
                  <div key={`${section.ingredient}_competitor_${index}`} className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                    <div className="text-sm font-medium text-foreground">{name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[brand, source].filter(Boolean).join(' · ') || '-'}
                    </div>
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex text-xs text-primary underline"
                        onClick={(event) => {
                          event.preventDefault();
                          onOpenProduct(row, 'competitors');
                        }}
                      >
                        {url}
                      </a>
                    ) : (
                      <div className="mt-2 text-xs text-muted-foreground">{labels.linkUnavailable}</div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-xs text-muted-foreground">-</div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">{labels.dupes}</div>
            {section.dupes.length ? (
              section.dupes.slice(0, 5).map((row, index) => {
                const name = String(row.title || row.name || '').trim() || `dupe_${index + 1}`;
                const brand = String(row.brand || '').trim();
                const source = String(row.source || '').trim();
                const url = productOpenUrl(row);
                return (
                  <div key={`${section.ingredient}_dupe_${index}`} className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                    <div className="text-sm font-medium text-foreground">{name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[brand, source].filter(Boolean).join(' · ') || '-'}
                    </div>
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex text-xs text-primary underline"
                        onClick={(event) => {
                          event.preventDefault();
                          onOpenProduct(row, 'dupes');
                        }}
                      >
                        {url}
                      </a>
                    ) : (
                      <div className="mt-2 text-xs text-muted-foreground">{labels.linkUnavailable}</div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-xs text-muted-foreground">-</div>
            )}
          </div>
        </div>
      ))}

      {externalSearchCtas.length ? (
        <div className="space-y-2 rounded-xl border border-border/60 bg-background/80 p-3">
          <div className="text-xs font-medium text-muted-foreground">{labels.search}</div>
          {externalSearchCtas.slice(0, 6).map((row, index) => {
            const title = String((row as any).title || row.name || '').trim() || `search_${index + 1}`;
            const url = productOpenUrl(row);
            return (
              <div key={`external_search_${index}`} className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <div className="text-sm font-medium text-foreground">{title}</div>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex text-xs text-primary underline"
                    onClick={(event) => {
                      event.preventDefault();
                      onOpenProduct(row, 'external_search_ctas');
                    }}
                  >
                    {url}
                  </a>
                ) : (
                  <div className="mt-2 text-xs text-muted-foreground">{labels.linkUnavailable}</div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
