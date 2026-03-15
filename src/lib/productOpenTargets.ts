import { normalizeOutboundFallbackUrl } from '@/lib/externalSearchFallback';
import { buildPdpUrl, extractPdpTargetFromProductGroupId, getPivotaShopBaseUrl } from '@/lib/pivotaShop';

export type ProductRefTarget = {
  product_id: string;
  merchant_id?: string | null;
};

type ProductOpenLike = Record<string, unknown>;

const asObject = (value: unknown): ProductOpenLike | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as ProductOpenLike;
};

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text : null;
};

const normalizeHttpUrl = (value: unknown): string | null => {
  const normalized = normalizeOutboundFallbackUrl(String(value || '').trim());
  return normalized || null;
};

const buildInternalPdpUrl = (target: ProductRefTarget | null): string | null => {
  if (!target?.product_id) return null;
  return buildPdpUrl({
    product_id: target.product_id,
    merchant_id: target.merchant_id || null,
    baseUrl: getPivotaShopBaseUrl(),
  });
};

const readPdpOpen = (row: ProductOpenLike): ProductOpenLike | null =>
  asObject(row.pdp_open) || asObject(row.pdpOpen);

const readSubjectProductGroupId = (row: ProductOpenLike, pdpOpen: ProductOpenLike | null): string | null => {
  const subject = asObject(pdpOpen?.subject);
  return (
    asNonEmptyString(subject?.id) ||
    asNonEmptyString(subject?.product_group_id) ||
    asNonEmptyString(subject?.productGroupId) ||
    asNonEmptyString(row.subject_product_group_id) ||
    asNonEmptyString(row.subjectProductGroupId) ||
    asNonEmptyString(row.product_group_id) ||
    asNonEmptyString(row.productGroupId) ||
    null
  );
};

const readFallbackProductRef = (row: ProductOpenLike): ProductRefTarget | null => {
  const productId = asNonEmptyString(row.product_id) || asNonEmptyString(row.productId);
  const merchantId = asNonEmptyString(row.merchant_id) || asNonEmptyString(row.merchantId);
  if (!productId) return null;
  return merchantId ? { product_id: productId, merchant_id: merchantId } : { product_id: productId };
};

export function readProductRefTarget(raw: unknown): ProductRefTarget | null {
  const ref = asObject(raw);
  if (!ref) return null;
  const productId = asNonEmptyString(ref.product_id) || asNonEmptyString(ref.productId);
  const merchantId = asNonEmptyString(ref.merchant_id) || asNonEmptyString(ref.merchantId);
  if (!productId) return null;
  return merchantId ? { product_id: productId, merchant_id: merchantId } : { product_id: productId };
}

export function isInternalShopPdpUrl(rawUrl: unknown): boolean {
  const normalizedUrl = normalizeHttpUrl(rawUrl);
  if (!normalizedUrl) return false;
  try {
    const parsed = new URL(normalizedUrl);
    const shopBase = new URL(getPivotaShopBaseUrl());
    if (parsed.origin !== shopBase.origin) return false;
    const segments = parsed.pathname.split('/').filter(Boolean);
    return segments.length === 2 && segments[0] === 'products' && Boolean(segments[1]);
  } catch {
    return false;
  }
}

export function deriveInternalPdpUrlFromContract(rawRow: unknown): string | null {
  const row = asObject(rawRow);
  if (!row) return null;
  const pdpOpen = readPdpOpen(row);

  const explicitInternalUrl = [
    row.pdp_url,
    row.pdpUrl,
    row.product_url,
    row.productUrl,
    row.url,
    row.purchase_path,
    row.purchasePath,
  ]
    .map(normalizeHttpUrl)
    .find((value) => Boolean(value) && isInternalShopPdpUrl(value));
  if (explicitInternalUrl) return explicitInternalUrl;

  const directRef =
    readProductRefTarget(pdpOpen?.product_ref) ||
    readProductRefTarget(pdpOpen?.canonical_product_ref) ||
    readProductRefTarget(row.product_ref) ||
    readProductRefTarget(row.canonical_product_ref) ||
    readFallbackProductRef(row);
  const directUrl = buildInternalPdpUrl(directRef);
  if (directUrl) return directUrl;

  const subjectProductGroupId = readSubjectProductGroupId(row, pdpOpen);
  const groupTarget = extractPdpTargetFromProductGroupId(subjectProductGroupId);
  return buildInternalPdpUrl(groupTarget);
}

export function resolveExternalProductUrl(rawRow: unknown): string | null {
  const row = asObject(rawRow);
  if (!row) return null;
  const pdpOpen = readPdpOpen(row);
  const pdpOpenExternal = asObject(pdpOpen?.external);
  const candidates = [
    row.external_redirect_url,
    row.externalRedirectUrl,
    row.external_url,
    row.externalUrl,
    row.url,
    row.product_url,
    row.productUrl,
    row.purchase_path,
    row.purchasePath,
    row.pdp_url,
    row.pdpUrl,
    pdpOpenExternal?.url,
  ]
    .map(normalizeHttpUrl)
    .filter((value): value is string => Boolean(value));
  return candidates.find((value) => !isInternalShopPdpUrl(value)) || null;
}

export function resolveProductOpenTargets(rawRow: unknown): {
  internalUrl: string | null;
  externalUrl: string | null;
  preferredUrl: string | null;
  directRef: ProductRefTarget | null;
  subjectProductGroupId: string | null;
} {
  const row = asObject(rawRow) || {};
  const pdpOpen = readPdpOpen(row);
  const subjectProductGroupId = readSubjectProductGroupId(row, pdpOpen);
  const directRef =
    readProductRefTarget(pdpOpen?.product_ref) ||
    readProductRefTarget(pdpOpen?.canonical_product_ref) ||
    readProductRefTarget(row.product_ref) ||
    readProductRefTarget(row.canonical_product_ref) ||
    readFallbackProductRef(row);
  const internalUrl = deriveInternalPdpUrlFromContract(row);
  const externalUrl = resolveExternalProductUrl(row);
  return {
    internalUrl,
    externalUrl,
    preferredUrl: internalUrl || externalUrl,
    directRef,
    subjectProductGroupId,
  };
}

export function resolvePreferredProductOpenUrl(rawRow: unknown): string | null {
  return resolveProductOpenTargets(rawRow).preferredUrl;
}
