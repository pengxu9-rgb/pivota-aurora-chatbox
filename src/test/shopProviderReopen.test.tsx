import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ShopProvider, useShop } from '@/contexts/shop/ShopContext';

function Harness() {
  const shop = useShop();
  return (
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
  );
}

describe('ShopProvider reopen flow', () => {
  it('reopens drawer after close', async () => {
    render(
      <ShopProvider>
        <Harness />
      </ShopProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /open/i }));
    await waitFor(() => {
      expect(screen.getByTitle('Product')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    await waitFor(() => {
      expect(screen.queryByTitle('Product')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /open/i }));
    await waitFor(() => {
      expect(screen.getByTitle('Product')).toBeInTheDocument();
    });
  });
});
