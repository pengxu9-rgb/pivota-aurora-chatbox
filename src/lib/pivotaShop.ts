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

const looksLikeOpaqueId = (value: string | null): boolean => {
  if (!value) return false;
  const s = String(value || '').trim();
  if (!s) return false;
  if (/^kb:/i.test(s)) return true;
  if (/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s)) return true;
  const compactUuid = s.replace(/[\s_-]/g, '').replace(/-/g, '');
  if (/^[0-9a-f]{32}$/i.test(compactUuid)) return true;
  if (/^[0-9a-f]{24,}$/i.test(s) && /[a-f]/i.test(s)) return true;
  return false;
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

export const extractPdpTargetFromProductGroupId = (value: unknown): PdpTarget | null => {
  const parsed = parseProductGroupId(asNonEmptyString(value));
  if (!parsed?.product_id) return null;
  return {
    product_id: parsed.product_id,
    ...(parsed.merchant_id ? { merchant_id: parsed.merchant_id } : {}),
  };
};

export const extractPdpTargetFromOffersResolveResponse = (input: unknown): PdpTarget | null => {
  const resp = asObject(input);
  if (!resp) return null;

  const readTargetFromRef = (refRaw: unknown): PdpTarget | null => {
    const ref = asObject(refRaw);
    if (!ref) return null;
    const productId =
      asNonEmptyString(ref.product_id) ||
      asNonEmptyString(ref.productId) ||
      asNonEmptyString(ref.id) ||
      null;
    const merchantId =
      asNonEmptyString(ref.merchant_id) ||
      asNonEmptyString(ref.merchantId) ||
      asNonEmptyString(ref.merchant?.id) ||
      null;
    if (!productId) return null;
    return { product_id: productId, ...(merchantId ? { merchant_id: merchantId } : {}) };
  };

  const canonicalRef =
    readTargetFromRef(resp.canonical_product_ref) ||
    readTargetFromRef(resp.canonicalProductRef) ||
    readTargetFromRef(resp.product_ref) ||
    readTargetFromRef(resp.productRef);
  if (canonicalRef) return canonicalRef;

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

  const membersRaw =
    Array.isArray(resp.members) ? resp.members
      : Array.isArray(resp.data?.members) ? resp.data.members
        : [];
  const members = membersRaw.map(asObject).filter(Boolean) as Array<Record<string, any>>;
  for (const member of members) {
    const fromMember =
      readTargetFromRef(member.product_ref) ||
      readTargetFromRef(member.productRef) ||
      readTargetFromRef(member.canonical_product_ref) ||
      readTargetFromRef(member.canonicalProductRef) ||
      readTargetFromRef(member.product);
    if (fromMember) return fromMember;
  }

  const mappingCandidatesRaw = Array.isArray(resp.mapping?.candidates) ? resp.mapping.candidates : [];
  const mappingCandidates = mappingCandidatesRaw.map(asObject).filter(Boolean) as Array<Record<string, any>>;
  for (const candidate of mappingCandidates) {
    const fromCandidate =
      readTargetFromRef(candidate.product_ref) ||
      readTargetFromRef(candidate.productRef) ||
      readTargetFromRef(candidate.canonical_product_ref) ||
      readTargetFromRef(candidate.canonicalProductRef) ||
      readTargetFromRef(candidate.product);
    if (fromCandidate) return fromCandidate;
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

export const extractPdpTargetFromProductsSearchResponse = (
  input: unknown,
  opts: { prefer_brand?: string | null } = {},
): PdpTarget | null => {
  const resp = asObject(input);
  if (!resp) return null;

  const productsRaw = (
    [
      resp.products,
      resp.data?.products,
      (resp as any).result?.products,
      (resp as any).result?.data?.products,
      (resp as any).data?.result?.products,
      (resp as any).payload?.products,
      (resp as any).data?.payload?.products,
      (resp as any).response?.products,
    ].find((value) => Array.isArray(value)) || []
  ) as unknown[];
  const products = productsRaw.map(asObject).filter(Boolean) as Array<Record<string, any>>;

  const normalizeBrand = (v: unknown) => String(typeof v === 'string' ? v : '').trim().toLowerCase();
  const preferBrand = normalizeBrand(opts.prefer_brand);

  const candidates = products
    .map((p) => {
      const productId =
        asNonEmptyString(p.product_id) ||
        asNonEmptyString(p.productId) ||
        asNonEmptyString(p.id) ||
        null;
      const merchantId =
        asNonEmptyString(p.merchant_id) ||
        asNonEmptyString(p.merchantId) ||
        asNonEmptyString(p.merchant?.id) ||
        null;
      const brand = normalizeBrand(p.brand ?? (p as any).brand_name ?? (p as any).brandName);
      if (!productId || looksLikeOpaqueId(productId)) return null;
      return { product_id: productId, merchant_id: merchantId, brand };
    })
    .filter(Boolean) as Array<{ product_id: string; merchant_id: string | null; brand: string }>;

  if (!candidates.length) return null;

  const picked =
    (preferBrand
      ? candidates.find((c) => c.brand === preferBrand || c.brand.includes(preferBrand) || preferBrand.includes(c.brand))
      : null) ||
    candidates.find((c) => Boolean(c.merchant_id)) ||
    candidates[0];

  return { product_id: picked.product_id, ...(picked.merchant_id ? { merchant_id: picked.merchant_id } : {}) };
};

export const extractPdpTargetFromProductsResolveResponse = (input: unknown): PdpTarget | null => {
  const strictTarget = extractStablePdpTargetFromProductsResolveResponse(input);
  if (strictTarget?.product_id) return strictTarget;

  const resp = asObject(input);
  if (!resp) return null;
  const resolvedFlag = (resp as any).resolved;
  const isResolved = resolvedFlag === true;

  const ref =
    asObject((resp as any).product_ref) ||
    asObject((resp as any).productRef) ||
    asObject((resp as any).data?.product_ref) ||
    asObject((resp as any).data?.productRef) ||
    null;

  const productId =
    asNonEmptyString((ref as any)?.product_id) ||
    asNonEmptyString((ref as any)?.productId) ||
    null;
  const merchantId =
    asNonEmptyString((ref as any)?.merchant_id) ||
    asNonEmptyString((ref as any)?.merchantId) ||
    null;

  if (productId && !looksLikeOpaqueId(productId)) {
    return { product_id: productId, ...(merchantId ? { merchant_id: merchantId } : {}) };
  }

  // Backward compatibility: only trust root fields when backend explicitly marks resolved=true.
  if (!isResolved) return null;
  const rootProductId =
    asNonEmptyString((resp as any).product_id) ||
    asNonEmptyString((resp as any).productId) ||
    null;
  const rootMerchantId =
    asNonEmptyString((resp as any).merchant_id) ||
    asNonEmptyString((resp as any).merchantId) ||
    null;
  if (!rootProductId || looksLikeOpaqueId(rootProductId)) return null;
  return { product_id: rootProductId, ...(rootMerchantId ? { merchant_id: rootMerchantId } : {}) };
};

export const extractStablePdpTargetFromProductsResolveResponse = (input: unknown): PdpTarget | null => {
  const resp = asObject(input);
  if (!resp) return null;
  if ((resp as any).resolved !== true) return null;

  const readRef = (raw: unknown): PdpTarget | null => {
    const ref = asObject(raw);
    if (!ref) return null;
    const productId = asNonEmptyString((ref as any).product_id) || asNonEmptyString((ref as any).productId) || null;
    const merchantId = asNonEmptyString((ref as any).merchant_id) || asNonEmptyString((ref as any).merchantId) || null;
    if (!productId) return null;
    return { product_id: productId, ...(merchantId ? { merchant_id: merchantId } : {}) };
  };

  return (
    readRef((resp as any).canonical_product_ref) ||
    readRef((resp as any).canonicalProductRef) ||
    readRef((resp as any).product_ref) ||
    readRef((resp as any).productRef) ||
    readRef((resp as any).data?.canonical_product_ref) ||
    readRef((resp as any).data?.canonicalProductRef) ||
    readRef((resp as any).data?.product_ref) ||
    readRef((resp as any).data?.productRef) ||
    null
  );
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

export const buildProductsSearchUrl = (args: { query: string; baseUrl?: string }): string | null => {
  const q = String(args.query || '').trim();
  if (!q) return null;
  const baseUrl = normalizeBaseUrl(args.baseUrl ?? getPivotaShopBaseUrl());
  const url = new URL(`${baseUrl}/products`);
  url.searchParams.set('q', q);
  url.searchParams.set('entry', 'aurora_chatbox');
  return url.toString();
};
