import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ShopDrawer } from '@/components/shop/ShopDrawer';

describe('ShopDrawer close action', () => {
  it('calls close handlers when the close button is clicked', () => {
    const onOpenChange = vi.fn();
    const onIframe = vi.fn();

    render(
      <ShopDrawer
        open={true}
        url="https://aurora.pivota.cc/products/123"
        title="Product"
        epoch={7}
        onOpenChange={onOpenChange}
        onIframe={onIframe}
        language="EN"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false, 7);
    expect(onIframe).toHaveBeenCalledWith(null);
  });
});
