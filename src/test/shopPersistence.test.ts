import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadShopState, saveShopState } from '@/lib/shopPersistence';

describe('shopPersistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('round-trips persisted shop state', () => {
    saveShopState({
      aurora_uid: 'uid_shop_1',
      cart: {
        item_count: 3,
        updated_at: '2026-02-07T00:00:00.000Z',
        items: [
          { id: 'a', title: 'A', price: 12, quantity: 1 },
          { id: 'b', title: 'B', price: 34, quantity: 2 },
        ],
      },
      recent_orders: [{ order_id: 'ord_1', occurred_at: '2026-02-07T00:00:00.000Z' }],
    });

    const loaded = loadShopState('uid_shop_1');
    expect(loaded?.aurora_uid).toBe('uid_shop_1');
    expect(loaded?.cart.item_count).toBe(3);
    expect(loaded?.cart.items.length).toBe(2);
    expect(loaded?.recent_orders.length).toBe(1);
  });

  it('returns undefined when no state exists', () => {
    expect(loadShopState('uid_shop_missing')).toBeUndefined();
  });

  it('falls back to in-memory when localStorage unavailable', () => {
    const getSpy = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setSpy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() =>
      saveShopState({
        aurora_uid: 'uid_shop_memory',
        cart: { item_count: 1, updated_at: null, items: [{ id: 'a', title: 'A', price: 1, quantity: 1 }] },
        recent_orders: [],
      }),
    ).not.toThrow();

    const loaded = loadShopState('uid_shop_memory');
    expect(loaded?.aurora_uid).toBe('uid_shop_memory');
    expect(loaded?.cart.item_count).toBe(1);

    getSpy.mockRestore();
    setSpy.mockRestore();
  });

  it('truncates large payloads', () => {
    saveShopState({
      aurora_uid: 'uid_shop_big',
      cart: {
        item_count: 999,
        updated_at: '2026-02-07T00:00:00.000Z',
        items: Array.from({ length: 60 }).map((_, i) => ({
          id: `it_${i}`,
          title: `Item ${i}`,
          price: i,
          quantity: 1,
        })),
      },
      recent_orders: Array.from({ length: 30 }).map((_, i) => ({
        order_id: `ord_${i}`,
        occurred_at: '2026-02-07T00:00:00.000Z',
      })),
    });

    const loaded = loadShopState('uid_shop_big');
    expect(loaded?.cart.items.length).toBe(40);
    expect(loaded?.recent_orders.length).toBe(20);
  });
});

