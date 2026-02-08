import { describe, expect, it } from 'vitest';

import {
  AURORA_BRIDGE_KIND,
  SHOP_BRIDGE_KIND,
  SHOP_BRIDGE_SCHEMA_VERSION,
  buildAuroraOpenCartMessage,
  isShopBridgeMessage,
} from '@/lib/shopBridge';

describe('shopBridge', () => {
  it('accepts ready', () => {
    const msg = {
      schema_version: SHOP_BRIDGE_SCHEMA_VERSION,
      kind: SHOP_BRIDGE_KIND,
      event: 'ready',
      payload: { occurred_at: '2026-02-07T00:00:00.000Z' },
    };
    expect(isShopBridgeMessage(msg)).toBe(true);
  });

  it('accepts cart_snapshot', () => {
    const msg = {
      schema_version: SHOP_BRIDGE_SCHEMA_VERSION,
      kind: SHOP_BRIDGE_KIND,
      event: 'cart_snapshot',
      payload: {
        item_count: 2,
        updated_at: '2026-02-07T00:00:00.000Z',
        items: [
          { id: 'a', title: 'Item A', price: 12, quantity: 1 },
          { id: 'b', title: 'Item B', price: 34, quantity: 1 },
        ],
      },
    };
    expect(isShopBridgeMessage(msg)).toBe(true);
  });

  it('rejects cart_snapshot when item missing required fields', () => {
    const msg = {
      schema_version: SHOP_BRIDGE_SCHEMA_VERSION,
      kind: SHOP_BRIDGE_KIND,
      event: 'cart_snapshot',
      payload: {
        item_count: 1,
        updated_at: '2026-02-07T00:00:00.000Z',
        items: [{ id: 'a', price: 12, quantity: 1 }],
      },
    };
    expect(isShopBridgeMessage(msg)).toBe(false);
  });

  it('accepts order_success', () => {
    const msg = {
      schema_version: SHOP_BRIDGE_SCHEMA_VERSION,
      kind: SHOP_BRIDGE_KIND,
      event: 'order_success',
      payload: { order_id: 'ord_1', occurred_at: '2026-02-07T00:00:00.000Z' },
    };
    expect(isShopBridgeMessage(msg)).toBe(true);
  });

  it('buildAuroraOpenCartMessage returns expected envelope', () => {
    const msg = buildAuroraOpenCartMessage();
    expect(msg.schema_version).toBe(SHOP_BRIDGE_SCHEMA_VERSION);
    expect(msg.kind).toBe(AURORA_BRIDGE_KIND);
    expect(msg.event).toBe('open_cart');
    expect(typeof msg.payload.occurred_at).toBe('string');
  });
});

