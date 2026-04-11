type AnyRecord = Record<string, unknown>;

const asObject = (value: unknown): AnyRecord | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as AnyRecord;
};

const asArray = <T = unknown>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const buildStableRecommendationKey = (row: AnyRecord | null): string => {
  if (!row) return '';
  const productId =
    asString(row.product_id) ||
    asString(row.productId) ||
    asString(asObject(row.canonical_product_ref)?.product_id) ||
    asString(asObject(row.canonicalProductRef)?.product_id) ||
    asString(asObject(row.product_ref)?.product_id) ||
    asString(asObject(row.productRef)?.product_id);
  const merchantId =
    asString(row.merchant_id) ||
    asString(row.merchantId) ||
    asString(asObject(row.canonical_product_ref)?.merchant_id) ||
    asString(asObject(row.canonicalProductRef)?.merchant_id) ||
    asString(asObject(row.product_ref)?.merchant_id) ||
    asString(asObject(row.productRef)?.merchant_id);
  const productGroupId =
    asString(row.product_group_id) ||
    asString(row.productGroupId) ||
    asString(asObject(row.subject)?.product_group_id) ||
    asString(asObject(row.subject)?.productGroupId);
  const brand = asString(row.brand).toLowerCase();
  const name =
    asString(row.name) ||
    asString(row.display_name) ||
    asString(row.displayName) ||
    asString(row.title);
  const normalizedName = name.toLowerCase().replace(/\s+/g, ' ').trim();

  if (productId) return `product:${merchantId}:${productId}`;
  if (productGroupId) return `group:${productGroupId}`;
  if (brand || normalizedName) return `name:${brand}:${normalizedName}`;
  return '';
};

const mergeRecommendationRows = (payloadRow: AnyRecord | null, sectionRow: AnyRecord | null): AnyRecord | null => {
  if (!payloadRow && !sectionRow) return null;
  const left = payloadRow || {};
  const right = sectionRow || {};
  const leftMeta = asObject(left.metadata) || {};
  const rightMeta = asObject(right.metadata) || {};

  return {
    ...left,
    ...right,
    ...(Object.keys(leftMeta).length || Object.keys(rightMeta).length
      ? { metadata: { ...leftMeta, ...rightMeta } }
      : {}),
    ...(right.pdp_open ? { pdp_open: right.pdp_open } : left.pdp_open ? { pdp_open: left.pdp_open } : {}),
    ...(right.alternatives ? { alternatives: right.alternatives } : left.alternatives ? { alternatives: left.alternatives } : {}),
    ...(right.best_for ? { best_for: right.best_for } : left.best_for ? { best_for: left.best_for } : {}),
    ...(right.key_features ? { key_features: right.key_features } : left.key_features ? { key_features: left.key_features } : {}),
  };
};

export const extractRecommendationSectionProducts = (payload: AnyRecord | null | undefined): AnyRecord[] => {
  const safePayload = payload || null;
  if (!safePayload) return [];
  const sections = asArray(safePayload.sections)
    .map((row) => asObject(row))
    .filter(Boolean) as AnyRecord[];
  const products = sections.flatMap((section) => {
    const kind = asString(section.kind || section.type).toLowerCase();
    if (kind !== 'product_cards') return [];
    return asArray(section.products)
      .map((product) => asObject(product))
      .filter(Boolean) as AnyRecord[];
  });
  return products.slice(0, 12);
};

export const buildRecommendationRenderItems = (payload: AnyRecord | null | undefined): AnyRecord[] => {
  const safePayload = payload || null;
  if (!safePayload) return [];
  const sectionProducts = extractRecommendationSectionProducts(safePayload);
  const payloadRecommendations = asArray(safePayload.recommendations)
    .map((row) => asObject(row))
    .filter(Boolean) as AnyRecord[];

  if (sectionProducts.length === 0) return payloadRecommendations;
  if (payloadRecommendations.length === 0) return sectionProducts;

  const payloadByKey = new Map<string, AnyRecord>();
  for (const row of payloadRecommendations) {
    const key = buildStableRecommendationKey(row);
    if (!key || payloadByKey.has(key)) continue;
    payloadByKey.set(key, row);
  }

  const seenKeys = new Set<string>();
  const merged = sectionProducts.map((sectionRow) => {
    const key = buildStableRecommendationKey(sectionRow);
    if (key) seenKeys.add(key);
    const payloadRow = key ? payloadByKey.get(key) || null : null;
    return mergeRecommendationRows(payloadRow, sectionRow);
  }).filter(Boolean) as AnyRecord[];

  for (const payloadRow of payloadRecommendations) {
    const key = buildStableRecommendationKey(payloadRow);
    if (key && seenKeys.has(key)) continue;
    merged.push(payloadRow);
  }

  return merged.slice(0, 12);
};

export const deriveRecommendationBundleMode = (
  payload: AnyRecord | null | undefined,
  items: Array<Record<string, unknown>>,
): 'routine_mix' | 'same_role_comparison' | 'single_pick' => {
  const safePayload = payload || {};
  const recommendationMeta = asObject(safePayload.recommendation_meta) || {};
  const selectedTargetIds = Array.from(
    new Set(
      asArray(recommendationMeta.selected_target_ids)
        .map((value) => asString(value))
        .filter(Boolean),
    ),
  );
  if (selectedTargetIds.length > 1) return 'routine_mix';

  const explicitMode =
    asString((safePayload as AnyRecord).comparison_mode) ||
    asString(recommendationMeta.comparison_mode) ||
    items.map((item) => asString((item as AnyRecord).comparison_mode)).find(Boolean) ||
    '';
  if (explicitMode === 'routine_mix' || explicitMode === 'same_role_comparison') return explicitMode;

  const roleIds = items
    .map((item) =>
      asString((item as AnyRecord).matched_role_id) ||
      asString((item as AnyRecord).selected_target_id) ||
      asString((item as AnyRecord).role_scope),
    )
    .filter(Boolean);
  const uniqueRoleIds = Array.from(new Set(roleIds));
  const hasSameRolePeer = items.some((item) => {
    const peerCount = Number((item as AnyRecord).same_role_peer_count);
    return Number.isFinite(peerCount) && peerCount > 1;
  });
  const hasComparisonFill = items.some((item) => Boolean(asString((item as AnyRecord).comparison_fill_reason)));

  if ((uniqueRoleIds.length <= 1 && items.length > 1) || hasSameRolePeer || hasComparisonFill) {
    return 'same_role_comparison';
  }
  if (items.length > 1) return 'routine_mix';
  return 'single_pick';
};
