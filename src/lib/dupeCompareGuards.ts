export type ProductLike = Record<string, unknown> | null | undefined;

const BUCKET_SUFFIX_PATTERN =
  /\s*\((budget\s+dupe|similar\s+option|premium\s+option|dupe|alternative)\)\s*$/i;
const SPEC_WORDS =
  /\b(\d+\s*)(ml|oz|fl\.?\s*oz|g|gram|mg|l|pack|ct|count|refill|set|kit|duo|trio)\b/gi;

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

function pickFirstString(...values: unknown[]): string {
  for (const raw of values) {
    const text = asString(raw);
    if (text) return text;
  }
  return "";
}

export function unwrapProductLike(input: ProductLike): Record<string, unknown> | null {
  const base = asObject(input);
  if (!base) return null;
  const nestedProduct = asObject(base.product);
  if (nestedProduct) return nestedProduct;
  const nestedSku = asObject(base.sku);
  if (nestedSku) return nestedSku;
  return base;
}

function normalizeBrand(brand: string): string {
  return brand
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(name: string): string {
  return name
    .replace(BUCKET_SUFFIX_PATTERN, "")
    .toLowerCase()
    .replace(SPEC_WORDS, " ")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(url: string): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    parsed.searchParams.forEach((_value, key) => {
      if (
        key.startsWith("utm_") ||
        key === "ref" ||
        key === "entry" ||
        key === "source" ||
        key === "medium" ||
        key === "campaign" ||
        key === "gclid" ||
        key === "fbclid" ||
        key === "affiliate" ||
        key === "clickid" ||
        key === "irclickid" ||
        key === "srsltid" ||
        key.startsWith("mc_")
      ) {
        parsed.searchParams.delete(key);
      }
    });
    return `${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/+$/, "")}${parsed.search}`;
  } catch {
    return url.toLowerCase().replace(/\/+$/, "");
  }
}

function nameSimilarity(left: string, right: string): number {
  const a = normalizeName(left);
  const b = normalizeName(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const toBigrams = (text: string) => {
    const counts = new Map<string, number>();
    for (let index = 0; index < text.length - 1; index += 1) {
      const pair = text.slice(index, index + 2);
      counts.set(pair, (counts.get(pair) || 0) + 1);
    }
    return counts;
  };

  const leftBigrams = toBigrams(a);
  const rightBigrams = toBigrams(b);
  let overlap = 0;

  for (const [pair, count] of leftBigrams.entries()) {
    if (!rightBigrams.has(pair)) continue;
    overlap += Math.min(count, rightBigrams.get(pair) || 0);
  }

  return (2 * overlap) / (a.length - 1 + b.length - 1);
}

export function readComparableIdentity(input: ProductLike): {
  product: Record<string, unknown> | null;
  brand: string;
  name: string;
  url: string;
  productId: string;
} {
  const product = unwrapProductLike(input);
  return {
    product,
    brand: pickFirstString(product?.brand),
    name: pickFirstString(
      product?.display_name,
      product?.displayName,
      product?.name,
      product?.product_name,
      product?.productName,
      product?.title,
    ),
    url: pickFirstString(product?.url, product?.product_url, product?.productUrl),
    productId: pickFirstString(product?.product_id, product?.productId, product?.sku_id, product?.skuId),
  };
}

export function isComparableProductLike(input: ProductLike): boolean {
  const identity = readComparableIdentity(input);
  return Boolean(identity.productId || identity.url || identity.name);
}

export function looksLikeSelfRef(anchor: ProductLike, candidate: ProductLike): boolean {
  const left = readComparableIdentity(anchor);
  const right = readComparableIdentity(candidate);

  if (!left.product || !right.product) return false;

  if (left.productId && right.productId && left.productId.toLowerCase() === right.productId.toLowerCase()) {
    return true;
  }

  const leftUrl = normalizeUrl(left.url);
  const rightUrl = normalizeUrl(right.url);
  if (leftUrl && rightUrl && leftUrl === rightUrl) return true;

  const leftBrand = normalizeBrand(left.brand);
  const rightBrand = normalizeBrand(right.brand);
  const leftName = normalizeName(left.name);
  const rightName = normalizeName(right.name);
  if (!leftName || !rightName) return false;
  if (leftBrand && rightBrand && leftBrand === rightBrand && leftName === rightName) return true;
  if (leftBrand && rightBrand && leftBrand === rightBrand && nameSimilarity(left.name, right.name) >= 0.92) {
    return true;
  }
  return false;
}

export function getComparableDisplayName(input: ProductLike): string {
  const identity = readComparableIdentity(input);
  return [identity.brand, identity.name].filter(Boolean).join(" ").trim() || identity.name;
}
