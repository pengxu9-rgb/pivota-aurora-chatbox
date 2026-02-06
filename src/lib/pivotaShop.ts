export type PdpTarget = {
  product_id: string;
  merchant_id?: string | null;
};

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/+$/, '');

export const getPivotaShopBaseUrl = (): string => {
  const explicit = import.meta.env.VITE_PIVOTA_SHOP_URL?.trim();
  if (explicit) return normalizeBaseUrl(explicit);
  return 'https://agent.pivota.cc';
};

const asNonEmptyString = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s : null;
};

const asObject = (v: unknown): Record<string, any> | null => {
  if (!v || typeof v !== 'object') return null;
  if (Array.isArray(v)) return null;
  return v as Record<string, any>;
};

const parseProductGroupId = (value: string | null): { merchant_id: string; product_id: string } | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith('pg:')) return null;
  const parts = trimmed.split(':').map((p) => p.trim()).filter(Boolean);
  // Expected: pg:{merchant_id}:{product_id}
  if (parts.length >= 3 && parts[0] === 'pg' && parts[1] && parts[2]) {
    return { merchant_id: parts[1], product_id: parts[2] };
  }
  return null;
};

const parseOfferIdForProduct = (value: string | null): { merchant_id: string; product_id: string } | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Common format: of:v1:{merchant_id}:{product_group_id}:{fulfillment}:{tier}
  const parts = trimmed.split(':').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 4 && parts[0] === 'of' && parts[1] === 'v1') {
    const merchant_id = parts[2] || '';
    const productGroupId = parts.slice(3).join(':');
    const parsedGroup = parseProductGroupId(productGroupId);
    if (parsedGroup?.product_id) {
      return { merchant_id: parsedGroup.merchant_id || merchant_id, product_id: parsedGroup.product_id };
    }
  }

  return null;
};

export const extractPdpTargetFromOffersResolveResponse = (input: unknown): PdpTarget | null => {
  const resp = asObject(input);
  if (!resp) return null;

  const rootProduct = asObject(resp.product) || asObject(resp.data?.product);
  const rootProductId =
    asNonEmptyString(resp.product_id) ||
    asNonEmptyString(resp.productId) ||
    asNonEmptyString(rootProduct?.product_id) ||
    asNonEmptyString(rootProduct?.productId) ||
    asNonEmptyString(rootProduct?.id) ||
    null;
  const rootMerchantId =
    asNonEmptyString(resp.merchant_id) ||
    asNonEmptyString(resp.merchantId) ||
    asNonEmptyString(rootProduct?.merchant_id) ||
    asNonEmptyString(rootProduct?.merchantId) ||
    asNonEmptyString(rootProduct?.merchant?.id) ||
    null;
  if (rootProductId) {
    return { product_id: rootProductId, ...(rootMerchantId ? { merchant_id: rootMerchantId } : {}) };
  }

  const offersRaw =
    Array.isArray(resp.offers) ? resp.offers : Array.isArray(resp.data?.offers) ? resp.data.offers : [];
  const offers = offersRaw.map(asObject).filter(Boolean) as Array<Record<string, any>>;

  for (const offer of offers) {
    const productId =
      asNonEmptyString(offer.product_id) ||
      asNonEmptyString(offer.productId) ||
      asNonEmptyString(offer.product?.product_id) ||
      asNonEmptyString(offer.product?.productId) ||
      asNonEmptyString(offer.product?.id) ||
      null;
    const merchantId =
      asNonEmptyString(offer.merchant_id) ||
      asNonEmptyString(offer.merchantId) ||
      asNonEmptyString(offer.merchant?.id) ||
      null;

    if (productId) return { product_id: productId, ...(merchantId ? { merchant_id: merchantId } : {}) };

    const productGroupId = asNonEmptyString(offer.product_group_id) || asNonEmptyString(offer.productGroupId) || null;
    const parsedGroup = parseProductGroupId(productGroupId);
    if (parsedGroup?.product_id) return { product_id: parsedGroup.product_id, merchant_id: parsedGroup.merchant_id };

    const offerId = asNonEmptyString(offer.offer_id) || asNonEmptyString(offer.offerId) || null;
    const parsedOffer = parseOfferIdForProduct(offerId);
    if (parsedOffer?.product_id) return { product_id: parsedOffer.product_id, merchant_id: parsedOffer.merchant_id };
  }

  return null;
};

export const buildPdpUrl = (args: { product_id: string; merchant_id?: string | null; baseUrl?: string }): string => {
  const baseUrl = normalizeBaseUrl(args.baseUrl ?? getPivotaShopBaseUrl());
  const productId = encodeURIComponent(String(args.product_id || '').trim());
  const url = new URL(`${baseUrl}/products/${productId}`);
  const merchantId = String(args.merchant_id || '').trim();
  if (merchantId) url.searchParams.set('merchant_id', merchantId);
  url.searchParams.set('entry', 'aurora_chatbox');
  return url.toString();
};

