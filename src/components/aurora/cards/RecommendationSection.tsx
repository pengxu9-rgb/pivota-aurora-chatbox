import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, ExternalLink, Info, Sparkles, Star, Zap } from 'lucide-react';

import type { PhotoModulesAction, PhotoModulesProduct } from '@/lib/photoModulesContract';
import type {
  ConcernSummaryVm,
  IngredientActionVm,
  ModuleRecommendationVm,
  ProductExampleDiscoveryVm,
  ProductCardVm,
} from '@/lib/recommendationViewModel';
import {
  getEvidenceLabelText,
  getPriorityLabelText,
} from '@/lib/recommendationViewModel';
import type { Language } from '@/lib/types';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type OpenProductFn = (opts: {
  moduleId: string;
  action: PhotoModulesAction;
  product: PhotoModulesProduct;
  productIndex: number;
}) => void;

type OpenExternalSearchFn = (opts: {
  moduleId: string;
  action: PhotoModulesAction | null;
  cta: { title: string; url: string };
  ctaIndex: number;
}) => void;

type OpenProductExampleFn = (opts: {
  moduleId: string;
  action: PhotoModulesAction;
  item: ProductExampleDiscoveryVm;
  itemIndex: number;
}) => void;

export type RecommendationSectionProps = {
  vm: ModuleRecommendationVm;
  language: Language;
  title?: string | null;
  onOpenProduct?: OpenProductFn;
  onOpenProductExample?: OpenProductExampleFn;
  onOpenExternalSearch?: OpenExternalSearchFn;
  productsEnabled?: boolean;
  expandedProductsEnabled?: boolean;
  openingProductKey?: string | null;
  showConcernSummary?: boolean;
  alwaysShowExternalSearchCtas?: boolean;
  footerExternalSearchCtas?: { title: string; url: string }[];
};

function buildOpeningProductKey(
  moduleId: string,
  action: PhotoModulesAction,
  product: PhotoModulesProduct,
  productIndex: number,
): string {
  return `${moduleId}::${action.ingredient_id}::${product.product_id || product.title || productIndex}`;
}

// ---------------------------------------------------------------------------
// ConcernSummaryBanner
// ---------------------------------------------------------------------------

function ConcernSummaryBanner({
  summary,
  language,
}: {
  summary: ConcernSummaryVm;
  language: Language;
}) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5" data-testid="concern-summary-banner">
      <div className="text-sm font-semibold text-foreground">{summary.primaryConcern}</div>
      {summary.secondaryConcerns.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {summary.secondaryConcerns.map((concern) => (
            <span
              key={concern}
              className="rounded-full border border-border/60 bg-background/80 px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              {concern}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PriorityBadge
// ---------------------------------------------------------------------------

function PriorityBadge({ priority, language }: { priority: IngredientActionVm['priority']; language: Language }) {
  const label = getPriorityLabelText(priority, language);

  const colorClasses =
    priority === 'best_match'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
      : priority === 'strong_match'
        ? 'border-blue-500/40 bg-blue-500/10 text-blue-700'
        : 'border-border/60 bg-muted/40 text-muted-foreground';

  const Icon = priority === 'best_match' ? Star : priority === 'strong_match' ? Zap : Info;

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold', colorClasses)}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// EvidenceBadgeChip
// ---------------------------------------------------------------------------

function EvidenceBadgeChip({ evidence, language }: { evidence: IngredientActionVm['evidence']; language: Language }) {
  const label = getEvidenceLabelText(evidence.level, language);
  const colorClasses =
    evidence.level === 'high'
      ? 'text-emerald-600'
      : evidence.level === 'moderate'
        ? 'text-blue-600'
        : 'text-muted-foreground';

  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px]', colorClasses)}>
      <Info className="h-3 w-3" />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// UsageRow
// ---------------------------------------------------------------------------

function UsageRow({ usage }: { usage: IngredientActionVm['usage'] }) {
  if (!usage.time && !usage.frequency && !usage.note) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {usage.time ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/80 px-2 py-0.5 text-[10px] text-foreground">
          <Clock className="h-3 w-3 text-muted-foreground" />
          {usage.time}
        </span>
      ) : null}
      {usage.frequency ? (
        <span className="rounded-full border border-border/60 bg-background/80 px-2 py-0.5 text-[10px] text-foreground">
          {usage.frequency}
        </span>
      ) : null}
      {usage.note && (
        <span className="text-[11px] text-muted-foreground">{usage.note}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProductCard
// ---------------------------------------------------------------------------

function ProductCard({
  vm,
  language,
  onOpen,
  isLoading,
}: {
  vm: ProductCardVm;
  language: Language;
  onOpen?: () => void;
  isLoading?: boolean;
}) {
  const ctaLabel = language === 'CN' ? '查看商品' : 'View product';
  const unavailableLabel = language === 'CN' ? '链接暂不可用' : 'Link unavailable';
  const canOpen = Boolean(onOpen) && Boolean(vm.openUrl);

  return (
    <div
      className="rounded-xl border border-border/60 bg-background/80 p-3 transition-colors hover:bg-background"
      data-testid={`reco-product-card-${vm.productId}`}
    >
      <div className="flex items-start gap-3">
        {vm.imageUrl ? (
          <img
            src={vm.imageUrl}
            alt={vm.name}
            className="h-16 w-16 shrink-0 rounded-lg border border-border/60 object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/30">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {vm.brand && <div className="text-[11px] text-muted-foreground">{vm.brand}</div>}
              <div className="truncate text-sm font-semibold text-foreground">{vm.name}</div>
            </div>
            {vm.price && (
              <span className="shrink-0 text-sm font-semibold text-foreground">{vm.price}</span>
            )}
          </div>

          {vm.whyPicked && (
            <div className="mt-1.5 text-[11px] leading-relaxed text-foreground/80">
              {vm.whyPicked}
            </div>
          )}

          {vm.howToUse && (
            <div className="mt-1 text-[11px] text-muted-foreground">
              {vm.howToUse}
            </div>
          )}

          {vm.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {vm.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border/60 bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {vm.socialProof && (
            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
              {vm.socialProof.rating && (
                <span className="inline-flex items-center gap-0.5">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {vm.socialProof.rating}
                </span>
              )}
              {vm.socialProof.reviews && (
                <span>
                  {vm.socialProof.reviews} {language === 'CN' ? '条评价' : 'reviews'}
                </span>
              )}
            </div>
          )}

          {vm.cautions.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {vm.cautions.map((caution) => (
                <span
                  key={caution}
                  className="inline-flex items-center gap-0.5 rounded-full border border-amber-500/30 bg-amber-500/5 px-1.5 py-0.5 text-[10px] text-amber-700"
                >
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {caution}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {canOpen ? (
        <button
          type="button"
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-60"
          aria-label={`${ctaLabel}: ${vm.name}`}
          disabled={isLoading}
          onClick={onOpen}
        >
          {isLoading ? (
            <span className="animate-pulse">{language === 'CN' ? '正在打开…' : 'Opening…'}</span>
          ) : (
            <>
              <ExternalLink className="h-3.5 w-3.5" />
              {ctaLabel}
            </>
          )}
        </button>
      ) : (
        <div className="mt-3 text-xs text-muted-foreground">{unavailableLabel}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProductMatchList
// ---------------------------------------------------------------------------

function ProductMatchList({
  topProducts,
  moreProducts,
  emptyMessage,
  productExamples,
  productExampleItems,
  productExamplesLabel,
  productExamplesNote,
  externalSearchCtas,
  language,
  onOpenProduct,
  onOpenProductExample,
  moduleId,
  rawAction,
  productsEnabled,
  expandedProductsEnabled,
  openingProductKey,
  alwaysShowExternalSearchCtas,
  onOpenExternalSearch,
}: {
  topProducts: ProductCardVm[];
  moreProducts: ProductCardVm[];
  emptyMessage: string | null;
  productExamples: string[];
  productExampleItems: ProductExampleDiscoveryVm[];
  productExamplesLabel?: string | null;
  productExamplesNote?: string | null;
  externalSearchCtas: { title: string; url: string }[];
  language: Language;
  onOpenProduct?: OpenProductFn;
  onOpenProductExample?: OpenProductExampleFn;
  moduleId: string;
  rawAction: PhotoModulesAction;
  productsEnabled: boolean;
  expandedProductsEnabled: boolean;
  openingProductKey?: string | null;
  alwaysShowExternalSearchCtas?: boolean;
  onOpenExternalSearch?: OpenExternalSearchFn;
}) {
  const [showMore, setShowMore] = useState(false);
  if (!productsEnabled) return null;

  const hasProducts = topProducts.length > 0;
  const hasProductExamples = productExamples.length > 0;
  const visibleMoreProducts = expandedProductsEnabled ? moreProducts : [];
  const hasExternalSearch = externalSearchCtas.length > 0;

  if (!hasProducts && !hasProductExamples && !emptyMessage && !hasExternalSearch) return null;

  return (
    <div className="mt-3 space-y-2" data-testid="reco-product-match-list">
      {hasProducts && (
        <div className="text-[11px] font-semibold text-muted-foreground">
          {language === 'CN' ? '推荐商品' : 'Recommended products'}
        </div>
      )}

      {hasProducts ? (
        <div className="space-y-2">
          {topProducts.map((product, index) => {
            const productKey = buildOpeningProductKey(moduleId, rawAction, product.raw, index);
            return (
              <ProductCard
                key={product.productId || index}
                vm={product}
                language={language}
                isLoading={openingProductKey === productKey}
                onOpen={
                  onOpenProduct && product.openUrl
                    ? () =>
                        onOpenProduct({
                          moduleId,
                          action: rawAction,
                          product: product.raw,
                          productIndex: index,
                        })
                    : undefined
                }
              />
            );
          })}
        </div>
      ) : hasProductExamples ? (
        <div
          className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground"
          data-testid="ingredient-guidance-product-examples"
        >
          <div className="text-[11px] font-semibold text-foreground">
            {productExamplesLabel || (language === 'CN' ? '示例产品类型' : 'Example product types')}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {productExampleItems.length > 0
              ? productExampleItems.map((item, index) => (
                  <button
                    key={item.id || `${item.label}_${index}`}
                    type="button"
                    className="rounded-full border border-border/60 bg-background px-2 py-1 text-[11px] text-foreground transition hover:bg-muted/20 disabled:cursor-default disabled:opacity-80"
                    onClick={() =>
                      onOpenProductExample?.({
                        moduleId,
                        action: rawAction,
                        item,
                        itemIndex: index,
                      })
                    }
                    disabled={!onOpenProductExample}
                    aria-label={`${language === 'CN' ? '浏览产品类型' : 'Browse product type'}: ${item.label}`}
                  >
                    {item.label}
                  </button>
                ))
              : productExamples.map((example) => (
                  <span
                    key={example}
                    className="rounded-full border border-border/60 bg-background px-2 py-1 text-[11px] text-foreground"
                  >
                    {example}
                  </span>
                ))}
          </div>
          {productExamplesNote ? (
            <div className="mt-2 text-[11px] text-muted-foreground">{productExamplesNote}</div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
          {emptyMessage}
        </div>
      )}

      {visibleMoreProducts.length > 0 && (
        <>
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1 rounded-lg border border-border/60 bg-background/80 px-3 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted/30"
            onClick={() => setShowMore((prev) => !prev)}
          >
            {showMore
              ? (language === 'CN' ? '收起' : 'Show less')
              : (language === 'CN' ? `查看更多 (${visibleMoreProducts.length})` : `See more (${visibleMoreProducts.length})`)}
            {showMore ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showMore && (
            <div className="space-y-2">
              {visibleMoreProducts.map((product, index) => {
                const productIndex = topProducts.length + index;
                const productKey = buildOpeningProductKey(moduleId, rawAction, product.raw, productIndex);
                return (
                  <ProductCard
                    key={product.productId || `more_${index}`}
                    vm={product}
                    language={language}
                    isLoading={openingProductKey === productKey}
                    onOpen={
                      onOpenProduct && product.openUrl
                        ? () =>
                            onOpenProduct({
                              moduleId,
                              action: rawAction,
                              product: product.raw,
                              productIndex,
                            })
                        : undefined
                    }
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {hasExternalSearch && (!hasProducts || alwaysShowExternalSearchCtas) && (
        <div className="space-y-2">
          {hasProducts && (
            <div className="text-[11px] font-semibold text-muted-foreground">
              {language === 'CN' ? '更多探索' : 'Explore more'}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {externalSearchCtas.map((cta, idx) => {
              const title = cta.title || (language === 'CN' ? '外部搜索' : 'Search online');
              if (!onOpenExternalSearch) {
                return (
                  <a
                    key={`cta_${idx}`}
                    href={cta.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2 py-1 text-[11px] text-foreground hover:bg-muted/20"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {title}
                  </a>
                );
              }

              return (
                <button
                  key={`cta_${idx}`}
                  type="button"
                  aria-label={`${language === 'CN' ? '打开搜索' : 'Open search'}: ${title}`}
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2 py-1 text-[11px] text-foreground hover:bg-muted/20"
                  onClick={() =>
                    onOpenExternalSearch({
                      moduleId,
                      action: rawAction,
                      cta,
                      ctaIndex: idx,
                    })
                  }
                >
                  <ExternalLink className="h-3 w-3" />
                  {title}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// IngredientActionCard
// ---------------------------------------------------------------------------

function IngredientActionCard({
  vm,
  language,
  onOpenProduct,
  onOpenProductExample,
  moduleId,
  productsEnabled,
  expandedProductsEnabled,
  openingProductKey,
  alwaysShowExternalSearchCtas,
  onOpenExternalSearch,
}: {
  vm: IngredientActionVm;
  language: Language;
  onOpenProduct?: OpenProductFn;
  onOpenProductExample?: OpenProductExampleFn;
  moduleId: string;
  productsEnabled: boolean;
  expandedProductsEnabled: boolean;
  openingProductKey?: string | null;
  alwaysShowExternalSearchCtas?: boolean;
  onOpenExternalSearch?: OpenExternalSearchFn;
}) {
  return (
    <div
      className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3"
      data-testid={`reco-ingredient-card-${vm.ingredientId}`}
    >
      {/* Header: name + priority badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-foreground">{vm.ingredientName}</div>
        <PriorityBadge priority={vm.priority} language={language} />
      </div>

      {/* Why block */}
      {vm.why && (
        <div className="rounded-lg border border-border/50 bg-background/70 px-2.5 py-2 text-xs leading-relaxed text-foreground/90">
          {vm.why}
        </div>
      )}

      {/* Concern chips + target area */}
      {(vm.concernChips.length > 0 || vm.targetArea) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {vm.concernChips.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary"
            >
              {chip}
            </span>
          ))}
          {vm.targetArea && (
            <span className="text-[11px] text-muted-foreground">{vm.targetArea}</span>
          )}
        </div>
      )}

      {/* Usage row */}
      <UsageRow usage={vm.usage} />

      {/* Cautions */}
      {vm.cautions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {vm.cautions.map((caution) => (
            <span
              key={caution}
              className="inline-flex items-center gap-0.5 rounded-full border border-amber-500/30 bg-amber-500/5 px-2 py-0.5 text-[10px] text-amber-700"
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              {caution}
            </span>
          ))}
        </div>
      )}

      {/* Evidence badge */}
      <EvidenceBadgeChip evidence={vm.evidence} language={language} />

      {/* Product matches */}
      <ProductMatchList
        topProducts={vm.topProducts}
        moreProducts={vm.moreProducts}
        emptyMessage={vm.productsEmptyMessage}
        productExamples={vm.productExamples}
        productExampleItems={vm.productExampleItems}
        productExamplesLabel={vm.productExamplesLabel}
        productExamplesNote={vm.productExamplesNote}
        externalSearchCtas={vm.externalSearchCtas}
        language={language}
        onOpenProduct={onOpenProduct}
        onOpenProductExample={onOpenProductExample}
        moduleId={moduleId}
        rawAction={vm.rawAction}
        productsEnabled={productsEnabled}
        expandedProductsEnabled={expandedProductsEnabled}
        openingProductKey={openingProductKey}
        alwaysShowExternalSearchCtas={alwaysShowExternalSearchCtas}
        onOpenExternalSearch={onOpenExternalSearch}
      />

      {vm.productsFilteredNote ? (
        <div className="rounded-lg border border-border/50 bg-background/70 px-2.5 py-2 text-[11px] text-muted-foreground">
          {vm.productsFilteredNote}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RecommendationSection (main export)
// ---------------------------------------------------------------------------

export function RecommendationSection({
  vm,
  language,
  title,
  onOpenProduct,
  onOpenProductExample,
  onOpenExternalSearch,
  productsEnabled = true,
  expandedProductsEnabled = true,
  openingProductKey,
  showConcernSummary = true,
  alwaysShowExternalSearchCtas = false,
  footerExternalSearchCtas = [],
}: RecommendationSectionProps) {
  const sectionTitle = title || (language === 'CN' ? '成分与产品推荐' : 'Ingredient & product recommendations');
  if (vm.actions.length === 0) {
    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground">
          {sectionTitle}
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
          {language === 'CN'
            ? '该分区暂无成分建议，建议继续跟踪并复拍。'
            : 'No ingredient action yet for this module. Track progress and retake later.'}
        </div>
        {footerExternalSearchCtas.length > 0 ? (
          <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
            <div className="text-[11px] font-semibold text-muted-foreground">
              {language === 'CN' ? '更多探索' : 'Explore more'}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {footerExternalSearchCtas.map((cta, idx) => {
                const title = cta.title || (language === 'CN' ? '外部搜索' : 'Search online');
                if (!onOpenExternalSearch) {
                  return (
                    <a
                      key={`empty_footer_cta_${idx}`}
                      href={cta.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2 py-1 text-[11px] text-foreground hover:bg-muted/20"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {title}
                    </a>
                  );
                }

                return (
                  <button
                    key={`empty_footer_cta_${idx}`}
                    type="button"
                    aria-label={`${language === 'CN' ? '打开搜索' : 'Open search'}: ${title}`}
                    className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2 py-1 text-[11px] text-foreground hover:bg-muted/20"
                    onClick={() =>
                      onOpenExternalSearch({
                        moduleId: vm.moduleId,
                        action: null,
                        cta,
                        ctaIndex: idx,
                      })
                    }
                  >
                    <ExternalLink className="h-3 w-3" />
                    {title}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="recommendation-section">
      <div className="text-xs font-semibold text-muted-foreground">
        {sectionTitle}
      </div>

      {showConcernSummary ? <ConcernSummaryBanner summary={vm.concernSummary} language={language} /> : null}

      <div className="space-y-3">
        {vm.actions.map((action) => (
          <IngredientActionCard
            key={action.ingredientId}
            vm={action}
            language={language}
            onOpenProduct={onOpenProduct}
            onOpenProductExample={onOpenProductExample}
            moduleId={vm.moduleId}
            productsEnabled={productsEnabled}
            expandedProductsEnabled={expandedProductsEnabled}
            openingProductKey={openingProductKey}
            alwaysShowExternalSearchCtas={alwaysShowExternalSearchCtas}
            onOpenExternalSearch={onOpenExternalSearch}
          />
        ))}
      </div>

      {footerExternalSearchCtas.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
          <div className="text-[11px] font-semibold text-muted-foreground">
            {language === 'CN' ? '更多探索' : 'Explore more'}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {footerExternalSearchCtas.map((cta, idx) => {
              const title = cta.title || (language === 'CN' ? '外部搜索' : 'Search online');
              if (!onOpenExternalSearch) {
                return (
                  <a
                    key={`footer_cta_${idx}`}
                    href={cta.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2 py-1 text-[11px] text-foreground hover:bg-muted/20"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {title}
                  </a>
                );
              }

              return (
                <button
                  key={`footer_cta_${idx}`}
                  type="button"
                  aria-label={`${language === 'CN' ? '打开搜索' : 'Open search'}: ${title}`}
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2 py-1 text-[11px] text-foreground hover:bg-muted/20"
                  onClick={() =>
                    onOpenExternalSearch({
                      moduleId: vm.moduleId,
                      action: null,
                      cta,
                      ctaIndex: idx,
                    })
                  }
                >
                  <ExternalLink className="h-3 w-3" />
                  {title}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
