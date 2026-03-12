import React from 'react';
import { fireEvent, render, screen, waitFor } from '@/test/testProviders';
import { describe, expect, it } from 'vitest';

import { ShopProvider, useShop } from '@/contexts/shop/ShopContext';

function Harness() {
  const shop = useShop();
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          shop.openShop({
            url: 'https://agent.pivota.cc/products/123',
            title: 'Product',
          })
        }
      >
        open
      </button>
      <button type="button" onClick={() => shop.openCart()}>
        open cart
      </button>
    </div>
  );
}

describe('ShopProvider reopen flow', () => {
  it('reopens drawer after close', async () => {
    render(
      <ShopProvider>
        <Harness />
      </ShopProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    await waitFor(() => {
      expect(screen.getByTitle('Product')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    await waitFor(() => {
      expect(screen.queryByTitle('Product')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    await waitFor(() => {
      expect(screen.getByTitle('Product')).toBeInTheDocument();
    });
  });

  it('maps extended locale prefs to english shop embed params and chrome', async () => {
    window.localStorage.setItem('lang_pref', 'fr');

    render(
      <ShopProvider>
        <Harness />
      </ShopProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /open cart/i }));

    await waitFor(() => {
      expect(screen.getByTitle('Cart')).toBeInTheDocument();
    });

    const frame = screen.getByTitle('Cart') as HTMLIFrameElement;
    expect(frame.src).toContain('open=cart');
    expect(frame.src).toContain('lang=en');
    expect(frame.src).not.toContain('lang=fr');
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });
});
