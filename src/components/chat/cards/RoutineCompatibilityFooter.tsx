import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Plus, Search, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useIsMobile } from '@/hooks/use-mobile';
import type { AnalyticsContext } from '@/lib/auroraAnalytics';
import {
  emitOpenedCompatibility,
  emitRanCompatibilityCheck,
  emitViewedCompatibilityResult,
} from '@/lib/auroraAnalytics';
import { analyzeCompatibility } from '@/lib/routineCompatibility/engine';
import { parseInciText, tagIngredientFamilies } from '@/lib/routineCompatibility/tagger';
import type {
  CompatibilityContext,
  CompatibilityProductInput,
  CompatibilityRating,
  CompatibilitySensitivity,
  CompatibilityTiming,
} from '@/lib/routineCompatibility/types';

type RoutineCompatibilityFooterProps = {
  language: 'EN' | 'CN';
  baseProduct: CompatibilityProductInput;
  routineProducts: CompatibilityProductInput[];
  resolveProductsSearch?: (args: { query: string; limit?: number; preferBrand?: string | null }) => Promise<any>;
  analyticsCtx?: AnalyticsContext;
};

type TabValue = 'my_routine' | 'search' | 'paste_inci';

const MAX_PRODUCTS = 3;

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asString = (value: unknown) => String(value || '').trim();

const dedupeStrings = (values: Array<string | null | undefined>, limit = 20) => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const value = asString(raw);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
};

const normalizeSearchProducts = (rawResp: unknown): CompatibilityProductInput[] => {
  const root = asObject(rawResp);
  if (!root) return [];

  const buckets = [
    asArray((root as any).items),
    asArray((root as any).results),
    asArray((root as any).products),
    asArray((root as any).candidates),
    asArray((root as any).payload?.items),
    asArray((root as any).payload?.results),
    asArray((root as any).payload?.products),
    asArray((root as any).payload?.search?.results),
    asArray((root as any).data?.items),
    asArray((root as any).data?.results),
    asArray((root as any).data?.products),
  ];

  const out: CompatibilityProductInput[] = [];
  const seen = new Set<string>();

  buckets.forEach((bucket) => {
    bucket.forEach((raw) => {
      const obj = asObject(raw);
      if (!obj) return;
      const product = asObject((obj as any).product) || asObject((obj as any).sku) || obj;
      const name = asString((product as any).display_name || (product as any).displayName || (product as any).name);
      const brand = asString((product as any).brand || (product as any).Brand);
      if (!name && !brand) return;

      const productId = asString(
        (product as any).product_id ||
          (product as any).productId ||
          (product as any).sku_id ||
          (product as any).skuId ||
          (obj as any).product_id ||
          (obj as any).productId,
      );

      const keyId = productId || `${brand}::${name}`.toLowerCase();
      if (!keyId) return;
      if (seen.has(keyId)) return;
      seen.add(keyId);

      const ingredientsObj = asObject((product as any).ingredients);
      const evidencePack = asObject((product as any).evidence_pack || (product as any).evidencePack);
      const ingredientTokens = dedupeStrings(
        [
          ...asArray((ingredientsObj as any)?.head).map((value) => asString(value)),
          ...asArray((ingredientsObj as any)?.highlights).map((value) => asString(value)),
          ...asArray((product as any)?.key_actives).map((value) => asString(value)),
          ...asArray((evidencePack as any)?.keyActives).map((value) => asString(value)),
          name,
          brand,
        ],
        24,
      );

      out.push({
        id: productId || `search_${seen.size}_${Date.now()}`,
        name: name || brand || 'Product',
        ...(brand ? { brand } : {}),
        ingredientTokens,
        source: 'search',
      });
    });
  });

  return out.slice(0, 20);
};

const STUB_PRODUCTS: CompatibilityProductInput[] = [
  {
    id: 'stub_hydrating_serum',
    name: 'Hydrating Serum',
    brand: 'Routine sample',
    ingredientTokens: ['glycerin', 'hyaluronic acid', 'panthenol'],
    source: 'stub',
  },
  {
    id: 'stub_retinol_serum',
    name: 'Retinol Night Serum',
    brand: 'Routine sample',
    ingredientTokens: ['retinol', 'squalane'],
    source: 'stub',
  },
  {
    id: 'stub_moisturizer',
    name: 'Barrier Moisturizer',
    brand: 'Routine sample',
    ingredientTokens: ['ceramide', 'cholesterol', 'fatty acid'],
    source: 'stub',
  },
  {
    id: 'stub_acid_treatment',
    name: 'AHA/BHA Exfoliating Treatment',
    brand: 'Routine sample',
    ingredientTokens: ['glycolic acid', 'salicylic acid'],
    source: 'stub',
  },
];

const localSearch = (query: string, list: CompatibilityProductInput[]) => {
  const token = query.trim().toLowerCase();
  if (!token) return [];
  return list
    .filter((item) => {
      const haystack = [item.name, item.brand, ...item.ingredientTokens].join(' ').toLowerCase();
      return haystack.includes(token);
    })
    .slice(0, 10);
};

const looksLikeUrl = (value: string) => /^https?:\/\/\S+/i.test(String(value || '').trim());

const tokenizeUrlForCompatibility = (value: string) => {
  const text = String(value || '').trim();
  if (!looksLikeUrl(text)) return [];
  try {
    const parsed = new URL(text);
    const hostTokens = parsed.hostname.split('.').filter(Boolean);
    const pathTokens = parsed.pathname
      .split(/[\/_-]+/g)
      .map((part) => part.trim())
      .filter(Boolean);
    return dedupeStrings(
      [...hostTokens, ...pathTokens]
        .map((token) => token.replace(/[^a-zA-Z0-9]+/g, ' ').trim())
        .filter((token) => token.length >= 3),
      24,
    );
  } catch {
    return [];
  }
};

const ratingTitle = (rating: CompatibilityRating, language: 'EN' | 'CN') => {
  if (language === 'CN') {
    if (rating === 'good') return 'Compatibility: 兼容性较好';
    if (rating === 'caution') return 'Compatibility: 需谨慎';
    return 'Compatibility: 不建议同一流程';
  }
  if (rating === 'good') return 'Compatibility: Good';
  if (rating === 'caution') return 'Compatibility: Caution';
  return 'Compatibility: Not recommended same routine';
};

export function RoutineCompatibilityFooter({
  language,
  baseProduct,
  routineProducts,
  resolveProductsSearch,
  analyticsCtx,
}: RoutineCompatibilityFooterProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabValue>('my_routine');
  const [selectedProducts, setSelectedProducts] = useState<CompatibilityProductInput[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchBrand, setSearchBrand] = useState('');
  const [searchResults, setSearchResults] = useState<CompatibilityProductInput[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<string>('');
  const [pasteInciText, setPasteInciText] = useState('');
  const [pasteName, setPasteName] = useState('');
  const [sensitivity, setSensitivity] = useState<CompatibilitySensitivity>('Medium');
  const [timing, setTiming] = useState<CompatibilityTiming>('Both');
  const [result, setResult] = useState<ReturnType<typeof analyzeCompatibility> | null>(null);
  const viewedResultKeyRef = useRef<string>('');

  const baseTagged = useMemo(
    () =>
      tagIngredientFamilies({
        id: baseProduct.id,
        name: baseProduct.name,
        brand: baseProduct.brand,
        ingredients: baseProduct.ingredientTokens,
        irritationSignal: baseProduct.irritationSignal === true,
        source: 'base',
      }),
    [baseProduct],
  );

  const quickChipSource = useMemo(
    () =>
      analyzeCompatibility(baseTagged, [], {
        sensitivity: 'Medium',
        timing: 'Both',
        language,
      }),
    [baseTagged, language],
  );

  const routineOptions = useMemo(() => (routineProducts.length ? routineProducts : STUB_PRODUCTS), [routineProducts]);
  const mergedLocalSearchPool = useMemo(
    () => dedupeLocalProducts([...routineOptions, ...STUB_PRODUCTS]),
    [routineOptions],
  );
  const quickBrandOptions = useMemo(
    () => dedupeStrings(routineOptions.map((item) => item.brand || ''), 8),
    [routineOptions],
  );

  useEffect(() => {
    if (!result || !analyticsCtx) return;
    const key = `${result.rating}_${selectedProducts.length}`;
    if (viewedResultKeyRef.current === key) return;
    viewedResultKeyRef.current = key;
    emitViewedCompatibilityResult(analyticsCtx, {
      rating: result.rating,
      selected_count: selectedProducts.length,
      base_product_name: baseProduct.name,
    });
  }, [analyticsCtx, baseProduct.name, result, selectedProducts.length]);

  const addProduct = useCallback((product: CompatibilityProductInput) => {
    setSelectedProducts((prev) => {
      if (prev.length >= MAX_PRODUCTS) return prev;
      const key = product.id.toLowerCase();
      if (prev.some((item) => item.id.toLowerCase() === key)) return prev;
      return [...prev, product];
    });
  }, []);

  const removeProduct = useCallback((id: string) => {
    setSelectedProducts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const runCompatibility = useCallback(() => {
    const taggedOthers = selectedProducts.map((product) =>
      tagIngredientFamilies({
        id: product.id,
        name: product.name,
        brand: product.brand,
        ingredients: product.ingredientTokens,
        irritationSignal: product.irritationSignal === true,
        source: product.source || 'routine',
      }),
    );

    const context: CompatibilityContext = {
      sensitivity,
      timing,
      language,
    };
    const analysis = analyzeCompatibility(baseTagged, taggedOthers, context);
    setResult(analysis);

    if (analyticsCtx) {
      emitRanCompatibilityCheck(analyticsCtx, {
        base_product_name: baseProduct.name,
        selected_count: selectedProducts.length,
        sensitivity,
        timing,
        rating: analysis.rating,
      });
    }
  }, [analyticsCtx, baseProduct.name, baseTagged, language, selectedProducts, sensitivity, timing]);

  const openPanel = useCallback(
    (source: 'advanced_compatibility_check') => {
      setOpen(true);
      if (analyticsCtx) {
        emitOpenedCompatibility(analyticsCtx, {
          source,
          base_product_name: baseProduct.name,
          selected_count: selectedProducts.length,
        });
      }
    },
    [analyticsCtx, baseProduct.name, selectedProducts.length],
  );

  const runSearch = useCallback(async () => {
    const query = searchQuery.trim();
    const brand = searchBrand.trim();
    if (!query) {
      setSearchResults([]);
      setSearchError('');
      return;
    }

    setSearchBusy(true);
    setSearchError('');

    try {
      if (resolveProductsSearch) {
        const resp = await resolveProductsSearch({ query, limit: 8, preferBrand: brand || null });
        const normalized = normalizeSearchProducts(resp);
        if (normalized.length) {
          setSearchResults(normalized);
          return;
        }
      }

      const fallback = localSearch(brand && !query.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${query}` : query, mergedLocalSearchPool);
      setSearchResults(fallback);
      if (!fallback.length && looksLikeUrl(query)) {
        setSearchError(
          language === 'CN'
            ? '这个 URL 没命中现有搜索库。可切到「粘贴 INCI」继续用 URL/成分表补充。'
            : 'This URL did not match current search sources. Switch to "Paste INCI" and continue with URL/INCI fallback.',
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSearchError(message || (language === 'CN' ? '搜索失败' : 'Search failed'));
      setSearchResults(localSearch(query, mergedLocalSearchPool));
    } finally {
      setSearchBusy(false);
    }
  }, [language, mergedLocalSearchPool, resolveProductsSearch, searchBrand, searchQuery]);

  const addPastedInci = useCallback(() => {
    let tokens = parseInciText(pasteInciText);
    if (!tokens.length && looksLikeUrl(pasteInciText)) {
      tokens = tokenizeUrlForCompatibility(pasteInciText);
    }
    if (!tokens.length) return;
    const name = asString(pasteName) || (looksLikeUrl(pasteInciText) ? pasteInciText : (language === 'CN' ? '粘贴 INCI' : 'Pasted INCI'));
    addProduct({
      id: `inci_${Date.now()}`,
      name,
      ingredientTokens: tokens,
      source: 'inci',
    });
    setPasteInciText('');
    setPasteName('');
  }, [addProduct, language, pasteInciText, pasteName]);

  const panelContent = (
    <div className="space-y-4 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          {language === 'CN' ? 'Close' : 'Close'}
        </Button>
      </div>
      <div className="space-y-2">
        <div className="text-sm font-semibold text-foreground">
          {language === 'CN' ? '添加产品（最多 3 个）' : 'Add products (up to 3)'}
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(value as TabValue)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="my_routine">{language === 'CN' ? '我的流程' : 'My Routine'}</TabsTrigger>
            <TabsTrigger value="search">{language === 'CN' ? '搜索' : 'Search'}</TabsTrigger>
            <TabsTrigger value="paste_inci">{language === 'CN' ? '粘贴 INCI' : 'Paste INCI'}</TabsTrigger>
          </TabsList>

          <TabsContent value="my_routine" className="space-y-2">
            {routineOptions.map((item) => {
              const added = selectedProducts.some((selected) => selected.id === item.id);
              return (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-background/70 p-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{item.name}</div>
                    {item.brand ? <div className="truncate text-xs text-muted-foreground">{item.brand}</div> : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={added ? 'secondary' : 'outline'}
                    disabled={added || selectedProducts.length >= MAX_PRODUCTS}
                    onClick={() => addProduct(item)}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    {added ? (language === 'CN' ? '已添加' : 'Added') : language === 'CN' ? '添加' : 'Add'}
                  </Button>
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="search" className="space-y-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_auto]">
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={language === 'CN' ? '搜索产品名或粘贴 URL' : 'Search product name or paste URL'}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void runSearch();
                  }
                }}
              />
              <Input
                value={searchBrand}
                onChange={(event) => setSearchBrand(event.target.value)}
                placeholder={language === 'CN' ? '品牌（可选）' : 'Brand (optional)'}
              />
              <Button type="button" variant="outline" disabled={searchBusy} onClick={() => void runSearch()}>
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {quickBrandOptions.length ? (
              <div className="flex flex-wrap gap-2">
                {quickBrandOptions.map((brand) => (
                  <Button
                    key={brand}
                    type="button"
                    size="sm"
                    variant={searchBrand.toLowerCase() === brand.toLowerCase() ? 'secondary' : 'outline'}
                    onClick={() => setSearchBrand(brand)}
                  >
                    {brand}
                  </Button>
                ))}
              </div>
            ) : null}

            {searchError ? <div className="text-xs text-rose-600">{searchError}</div> : null}

            <div className="space-y-2">
              {searchResults.map((item) => {
                const added = selectedProducts.some((selected) => selected.id === item.id);
                return (
                  <div key={item.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-background/70 p-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{item.name}</div>
                      {item.brand ? <div className="truncate text-xs text-muted-foreground">{item.brand}</div> : null}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={added ? 'secondary' : 'outline'}
                      disabled={added || selectedProducts.length >= MAX_PRODUCTS}
                      onClick={() => addProduct(item)}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      {added ? (language === 'CN' ? '已添加' : 'Added') : language === 'CN' ? '添加' : 'Add'}
                    </Button>
                  </div>
                );
              })}
              {!searchBusy && !searchResults.length && searchQuery.trim() ? (
                <div className="rounded-xl border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
                  <div>
                    {language === 'CN'
                      ? '没有匹配到产品。你可以切到「粘贴 INCI」，直接粘贴 URL 或成分表继续。'
                      : 'No product match found. Switch to "Paste INCI" and continue with URL or ingredient list.'}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => {
                      setTab('paste_inci');
                      if (looksLikeUrl(searchQuery)) {
                        setPasteInciText(searchQuery.trim());
                      }
                    }}
                  >
                    {language === 'CN' ? 'Use URL/INCI fallback' : 'Use URL/INCI fallback'}
                  </Button>
                </div>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="paste_inci" className="space-y-2">
            <Input
              value={pasteName}
              onChange={(event) => setPasteName(event.target.value)}
              placeholder={language === 'CN' ? '产品名称（可选）' : 'Product name (optional)'}
            />
            <Textarea
              value={pasteInciText}
              onChange={(event) => setPasteInciText(event.target.value)}
              placeholder={language === 'CN' ? '粘贴成分表（逗号分隔）' : 'Paste ingredient list (comma separated)'}
              className="min-h-[120px]"
            />
            <Button type="button" variant="outline" onClick={addPastedInci} disabled={selectedProducts.length >= MAX_PRODUCTS}>
              <Plus className="mr-1 h-4 w-4" />
              {language === 'CN' ? '添加到对比' : 'Add to comparison'}
            </Button>
          </TabsContent>
        </Tabs>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold text-foreground">{language === 'CN' ? '已选产品' : 'Selected products'}</div>
        {selectedProducts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-2 text-xs text-muted-foreground">
            {language === 'CN' ? '还没添加对比产品。' : 'No comparison products yet.'}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedProducts.map((item) => (
              <Badge key={item.id} variant="secondary" className="flex items-center gap-1.5 px-2 py-1">
                <span className="max-w-[180px] truncate">{item.name}</span>
                <button type="button" aria-label="Remove item" onClick={() => removeProduct(item.id)} className="rounded-full">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? 'Sensitivity' : 'Sensitivity'}</div>
          <div className="flex gap-2">
            {(['Low', 'Medium', 'High'] as CompatibilitySensitivity[]).map((level) => (
              <Button
                key={level}
                type="button"
                size="sm"
                variant={sensitivity === level ? 'default' : 'outline'}
                onClick={() => setSensitivity(level)}
              >
                {level}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? 'Routine timing' : 'Routine timing'}</div>
          <div className="flex gap-2">
            {(['AM', 'PM', 'Both'] as CompatibilityTiming[]).map((value) => (
              <Button key={value} type="button" size="sm" variant={timing === value ? 'default' : 'outline'} onClick={() => setTiming(value)}>
                {value}
              </Button>
            ))}
          </div>
        </div>

        <Button type="button" className="w-full" onClick={runCompatibility}>
          {language === 'CN' ? 'Analyze compatibility' : 'Analyze compatibility'}
        </Button>
      </div>

      {result ? (
        <div className="space-y-3 rounded-xl border border-border/60 bg-background/70 p-3">
          <div className="text-base font-semibold text-foreground">{ratingTitle(result.rating, language)}</div>

          <div className="space-y-1">
            <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? 'Why' : 'Why'}</div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
              {result.reasons.slice(0, 3).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? 'How to use together' : 'How to use together'}</div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
              {result.recommendations.layering.map((line) => (
                <li key={line}>{line}</li>
              ))}
              {result.recommendations.frequency.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          {result.recommendations.schedule?.length ? (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? 'Suggested schedule' : 'Suggested schedule'}</div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                {result.recommendations.schedule.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="text-xs text-muted-foreground">
            {language === 'CN'
              ? 'Guidance only—patch test and adjust based on your skin.'
              : 'Guidance only—patch test and adjust based on your skin.'}
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
      <div className="space-y-1">
        <div className="text-sm font-semibold text-foreground">
          {language === 'CN' ? 'Compatibility with your routine' : 'Compatibility with your routine'}
        </div>
        <div className="text-xs text-muted-foreground">
          {language === 'CN'
            ? 'Add 1–3 products to get safe layering + frequency suggestions.'
            : 'Add 1–3 products to get safe layering + frequency suggestions.'}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {quickChipSource.chips.compatible ? (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700">
            ✅ {quickChipSource.chips.compatible}
          </span>
        ) : null}
        {quickChipSource.chips.caution ? (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
            ⚠️ {quickChipSource.chips.caution}
          </span>
        ) : null}
        {quickChipSource.chips.avoid ? (
          <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
            ❌ {quickChipSource.chips.avoid}
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" onClick={() => openPanel('advanced_compatibility_check')}>
          <CheckCircle2 className="mr-1 h-4 w-4" />
          {language === 'CN' ? 'Advanced compatibility check' : 'Advanced compatibility check'}
        </Button>
      </div>

      {isMobile ? (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent aria-label={language === 'CN' ? 'Check compatibility' : 'Check compatibility'}>
            <DrawerHeader>
              <DrawerTitle>{language === 'CN' ? 'Check compatibility' : 'Check compatibility'}</DrawerTitle>
            </DrawerHeader>
            {panelContent}
          </DrawerContent>
        </Drawer>
      ) : (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="right" className="w-[460px] sm:max-w-[460px] overflow-y-auto" aria-label={language === 'CN' ? 'Check compatibility' : 'Check compatibility'}>
            <SheetHeader>
              <SheetTitle>{language === 'CN' ? 'Check compatibility' : 'Check compatibility'}</SheetTitle>
            </SheetHeader>
            <div className="mt-4">{panelContent}</div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

function dedupeLocalProducts(items: CompatibilityProductInput[]) {
  const out: CompatibilityProductInput[] = [];
  const seen = new Set<string>();
  items.forEach((item) => {
    const key = `${item.id}::${item.name}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(item);
  });
  return out;
}
