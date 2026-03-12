import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCircle2, Search } from 'lucide-react';
import { bffJson, type BffHeaders } from '@/lib/pivotaAgentBff';
import { toBackendLanguage } from '@/lib/persistence';
import type { Language } from '@/lib/types';

export type ResolvedProduct = {
  product_id: string;
  sku_id?: string | null;
  brand?: string | null;
  name?: string | null;
  display_name?: string | null;
  image_url?: string | null;
};

export type ProductSearchFieldValue = {
  text: string;
  resolvedProduct: ResolvedProduct | null;
};

type RoutineResolveRow = {
  slot?: string;
  step?: string;
  text?: string;
  product?: Record<string, unknown> | null;
  match_quality?: 'high' | 'medium' | 'low' | 'none' | string;
  name_similarity?: number;
  reason?: string;
};

type RoutineResolveResponse = {
  resolved?: RoutineResolveRow[];
  reason?: string;
};

type ProductSearchInputProps = {
  value: ProductSearchFieldValue | string;
  resolvedProduct?: ResolvedProduct | null;
  onChange?: (next: ProductSearchFieldValue) => void;
  onValueChange?: (text: string) => void;
  onProductSelect?: (product: ResolvedProduct) => void;
  onProductClear?: () => void;
  headers?: BffHeaders;
  language: Language;
  slot?: 'am' | 'pm';
  step?: string;
  placeholder: string;
  disabled?: boolean;
  searchFn?: (args: { query: string; limit?: number; preferBrand?: string | null }) => Promise<unknown>;
};

type ProductOption = {
  product: ResolvedProduct;
  matchQuality: 'high' | 'medium' | 'low';
  nameSimilarity: number | null;
};

const toResolvedProduct = (raw: unknown): ResolvedProduct | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const productId = String(row.product_id || row.sku_id || '').trim();
  if (!productId) return null;
  const skuId = String(row.sku_id || '').trim();
  const brand = String(row.brand || '').trim();
  const name = String(row.name || '').trim();
  const displayName = String(row.display_name || row.displayName || '').trim();
  const imageUrl = String(row.image_url || row.imageUrl || '').trim();
  return {
    product_id: productId,
    ...(skuId ? { sku_id: skuId } : {}),
    ...(brand ? { brand } : {}),
    ...(name ? { name } : {}),
    ...(displayName ? { display_name: displayName } : {}),
    ...(imageUrl ? { image_url: imageUrl } : {}),
  };
};

const normalizeMatchQuality = (value: unknown): 'high' | 'medium' | 'low' | 'none' => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'high' || raw === 'medium' || raw === 'low') return raw;
  return 'none';
};

const getResolvedDisplayName = (product: ResolvedProduct | null): string => {
  if (!product) return '';
  const display = String(product.display_name || '').trim();
  if (display) return display;
  const joined = [String(product.brand || '').trim(), String(product.name || '').trim()].filter(Boolean).join(' ');
  return joined || String(product.product_id || '').trim();
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const extractSearchProducts = (raw: unknown): ResolvedProduct[] => {
  const root = asRecord(raw);
  if (!root) return [];
  const candidateArrays: unknown[] = [
    root.products,
    asRecord(root.result)?.products,
    asRecord(root.payload)?.products,
    asRecord(root.data)?.products,
    asRecord(asRecord(root.result)?.data)?.products,
    asRecord(root.output)?.products,
  ];
  const rows = candidateArrays.find((item) => Array.isArray(item));
  if (!Array.isArray(rows)) return [];
  const normalized: ResolvedProduct[] = [];
  for (const row of rows) {
    const record = asRecord(row);
    if (!record) continue;
    const productId = String(record.product_id || record.sku_id || record.id || '').trim();
    if (!productId) continue;
    const brand = String(record.brand || '').trim();
    const name = String(record.name || record.title || '').trim();
    const displayName = String(record.display_name || record.displayName || '').trim();
    const imageUrl = String(record.image_url || record.imageUrl || record.image || '').trim();
    normalized.push({
      product_id: productId,
      ...(String(record.sku_id || '').trim() ? { sku_id: String(record.sku_id).trim() } : {}),
      ...(brand ? { brand } : {}),
      ...(name ? { name } : {}),
      ...(displayName ? { display_name: displayName } : {}),
      ...(imageUrl ? { image_url: imageUrl } : {}),
    });
  }
  return normalized;
};

export function ProductSearchInput({
  value,
  resolvedProduct,
  onChange,
  onValueChange,
  onProductSelect,
  onProductClear,
  headers,
  language,
  slot,
  step,
  placeholder,
  disabled = false,
  searchFn,
}: ProductSearchInputProps) {
  const valueText =
    typeof value === 'string'
      ? value
      : value && typeof value === 'object' && !Array.isArray(value)
        ? String((value as ProductSearchFieldValue).text || '')
        : '';
  const valueResolvedProduct =
    value && typeof value === 'object' && !Array.isArray(value)
      ? ((value as ProductSearchFieldValue).resolvedProduct ?? null)
      : null;
  const currentResolvedProduct = resolvedProduct ?? valueResolvedProduct;

  const [query, setQuery] = useState(String(valueText || ''));
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ProductOption[]>([]);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    const nextText = String(valueText || '');
    if (nextText !== query) setQuery(nextText);
    if (!nextText.trim()) setOptions([]);
  }, [query, valueText]);

  useEffect(() => {
    if (disabled) {
      setLoading(false);
      return;
    }
    const searchText = String(query || '').trim();
    if (!searchText || searchText.length < 2) {
      setLoading(false);
      setOptions([]);
      return;
    }
    const seq = ++requestSeqRef.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const nextOptions: ProductOption[] = [];
        if (typeof searchFn === 'function') {
          const resp = await searchFn({ query: searchText, limit: 6 });
          if (seq !== requestSeqRef.current) return;
          const products = extractSearchProducts(resp);
          for (const product of products.slice(0, 3)) {
            nextOptions.push({
              product,
              matchQuality: 'medium',
              nameSimilarity: null,
            });
          }
        } else if (headers && slot && step) {
          const resp = await bffJson<RoutineResolveResponse>('/v1/routine/resolve-products', headers, {
            method: 'POST',
            body: JSON.stringify({
              lang: toBackendLanguage(language),
              products: [{ slot, step, text: searchText }],
            }),
            timeoutMs: 8000,
          });
          if (seq !== requestSeqRef.current) return;
          const rows = Array.isArray(resp?.resolved) ? resp.resolved : [];
          for (const row of rows) {
            const quality = normalizeMatchQuality(row?.match_quality);
            if (quality === 'none') continue;
            const product = toResolvedProduct(row?.product);
            if (!product) continue;
            nextOptions.push({
              product,
              matchQuality: quality === 'high' || quality === 'medium' || quality === 'low' ? quality : 'low',
              nameSimilarity: Number.isFinite(Number(row?.name_similarity)) ? Number(row?.name_similarity) : null,
            });
          }
        }
        setOptions(nextOptions.slice(0, 3));
      } catch {
        if (seq === requestSeqRef.current) setOptions([]);
      } finally {
        if (seq === requestSeqRef.current) setLoading(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [disabled, headers, language, query, searchFn, slot, step]);

  const selectedProductId = String(currentResolvedProduct?.product_id || '').trim();
  const fallbackEnabled = useMemo(() => Boolean(String(query || '').trim()), [query]);

  const handleManualInput = (nextText: string) => {
    setQuery(nextText);
    if (typeof onChange === 'function') {
      onChange({
        text: nextText,
        resolvedProduct: null,
      });
    }
    if (typeof onValueChange === 'function') onValueChange(nextText);
    if (typeof onProductClear === 'function') onProductClear();
  };

  const handlePick = (option: ProductOption) => {
    const pickedText = getResolvedDisplayName(option.product);
    setQuery(pickedText);
    setOpen(false);
    if (typeof onChange === 'function') {
      onChange({
        text: pickedText,
        resolvedProduct: option.product,
      });
    }
    if (typeof onValueChange === 'function') onValueChange(pickedText);
    if (typeof onProductSelect === 'function') onProductSelect(option.product);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
        <input
          className="h-9 w-full rounded-2xl border border-border/60 bg-background/60 pl-8 pr-9 text-sm text-foreground"
          value={query}
          onChange={(e) => handleManualInput(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          placeholder={placeholder}
          disabled={disabled}
        />
        {currentResolvedProduct ? (
          <CheckCircle2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
        ) : null}
      </div>
      {open && !disabled ? (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border/60 bg-popover shadow-xl">
          {loading ? <div className="px-3 py-2 text-xs text-muted-foreground">{language === 'CN' ? '搜索中…' : 'Searching...'}</div> : null}
          {!loading && options.length > 0 ? (
            <div className="max-h-56 overflow-y-auto p-1">
              {options.map((option) => {
                const product = option.product;
                const displayName = getResolvedDisplayName(product);
                const subtitle = [String(product.brand || '').trim(), String(product.name || '').trim()].filter(Boolean).join(' • ');
                const isSelected = selectedProductId && selectedProductId === String(product.product_id || '').trim();
                return (
                  <button
                    key={`${product.product_id}_${option.matchQuality}`}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-accent/60"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handlePick(option)}
                  >
                    {String(product.image_url || '').trim() ? (
                      <img src={String(product.image_url)} alt="" className="h-8 w-8 rounded-md object-cover" />
                    ) : (
                      <div className="h-8 w-8 rounded-md bg-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-foreground">{displayName}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {subtitle || product.product_id}
                        {option.nameSimilarity != null ? ` • ${(option.nameSimilarity * 100).toFixed(0)}%` : ''}
                      </div>
                    </div>
                    {isSelected ? <Check className="h-4 w-4 text-emerald-500" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
          {!loading && fallbackEnabled ? (
            <button
              type="button"
              className="w-full border-t border-border/40 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-accent/60"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setOpen(false);
                const plainText = String(query || '').trim();
                if (typeof onChange === 'function') {
                  onChange({
                    text: plainText,
                    resolvedProduct: null,
                  });
                }
                if (typeof onValueChange === 'function') onValueChange(plainText);
                if (typeof onProductClear === 'function') onProductClear();
              }}
            >
              {language === 'CN' ? '按纯文本提交（不绑定产品）' : 'Use plain text (no product binding)'}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default ProductSearchInput;
