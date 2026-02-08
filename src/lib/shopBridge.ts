export const SHOP_BRIDGE_SCHEMA_VERSION = '0.1' as const;
export const SHOP_BRIDGE_KIND = 'pivota_shop_bridge' as const;
export const AURORA_BRIDGE_KIND = 'aurora_shop_bridge' as const;

type BridgeEnvelope<TKind extends string, TEvent extends string, TPayload> = {
  schema_version: typeof SHOP_BRIDGE_SCHEMA_VERSION;
  kind: TKind;
  event: TEvent;
  payload: TPayload;
};

export type ShopCartItemSnapshot = {
  id: string;
  product_id?: string;
  variant_id?: string;
  sku?: string;
  merchant_id?: string;
  offer_id?: string;
  title: string;
  price: number;
  currency?: string;
  quantity: number;
  image_url?: string;
};

export type ShopCartSnapshot = {
  item_count: number;
  updated_at: string;
  items: ShopCartItemSnapshot[];
};

export type ShopReadyPayload = {
  occurred_at: string;
  pathname?: string;
};

export type ShopOrderSuccessPayload = {
  order_id: string;
  occurred_at: string;
  seller_name?: string | null;
  seller_domain?: string | null;
  ucp_checkout_session_id?: string | null;
  has_save_token?: boolean;
};

export type ShopBridgeMessage =
  | BridgeEnvelope<typeof SHOP_BRIDGE_KIND, 'ready', ShopReadyPayload>
  | BridgeEnvelope<typeof SHOP_BRIDGE_KIND, 'cart_snapshot', ShopCartSnapshot>
  | BridgeEnvelope<typeof SHOP_BRIDGE_KIND, 'order_success', ShopOrderSuccessPayload>;

export type AuroraOpenCartMessage = BridgeEnvelope<typeof AURORA_BRIDGE_KIND, 'open_cart', { occurred_at: string }>;

const isObject = (v: unknown): v is Record<string, any> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && Boolean(v.trim());

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const hasProp = <K extends string>(obj: Record<string, any>, key: K): obj is Record<K, unknown> & Record<string, any> => key in obj;

export const isShopBridgeMessage = (input: unknown): input is ShopBridgeMessage => {
  if (!isObject(input)) return false;
  if (input.schema_version !== SHOP_BRIDGE_SCHEMA_VERSION) return false;
  if (input.kind !== SHOP_BRIDGE_KIND) return false;
  if (!isNonEmptyString(input.event)) return false;
  if (!hasProp(input, 'payload')) return false;

  const event = input.event as string;
  const payload = (input as any).payload;

  if (event === 'ready') {
    if (!isObject(payload)) return false;
    return isNonEmptyString(payload.occurred_at);
  }

  if (event === 'cart_snapshot') {
    if (!isObject(payload)) return false;
    if (!isNumber(payload.item_count)) return false;
    if (!isNonEmptyString(payload.updated_at)) return false;
    if (!Array.isArray(payload.items)) return false;
    for (const it of payload.items) {
      if (!isObject(it)) return false;
      if (!isNonEmptyString(it.id)) return false;
      if (!isNonEmptyString(it.title)) return false;
      if (!isNumber(it.price)) return false;
      if (!isNumber(it.quantity)) return false;
    }
    return true;
  }

  if (event === 'order_success') {
    if (!isObject(payload)) return false;
    return isNonEmptyString(payload.order_id) && isNonEmptyString(payload.occurred_at);
  }

  return false;
};

export const buildAuroraOpenCartMessage = (): AuroraOpenCartMessage => ({
  schema_version: SHOP_BRIDGE_SCHEMA_VERSION,
  kind: AURORA_BRIDGE_KIND,
  event: 'open_cart',
  payload: { occurred_at: new Date().toISOString() },
});

