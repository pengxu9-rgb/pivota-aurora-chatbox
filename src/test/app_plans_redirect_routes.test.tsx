import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { Outlet } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/toaster', () => ({
  Toaster: () => null,
}));

vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => null,
}));

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/contexts/shop', () => ({
  ShopProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/layouts/MobileShell', () => ({
  default: () => (
    <div data-testid="mobile-shell">
      <Outlet />
    </div>
  ),
}));

vi.mock('@/pages/BffChat', () => ({
  default: () => <div>chat-page</div>,
}));

vi.mock('@/pages/Home', () => ({
  default: () => <div>home-page</div>,
}));

vi.mock('@/pages/Routine', () => ({
  default: () => <div>routine-page</div>,
}));

vi.mock('@/pages/Explore', () => ({
  default: () => <div>explore-page</div>,
}));

vi.mock('@/pages/Profile', () => ({
  default: () => <div>profile-page</div>,
}));

vi.mock('@/pages/Plans', () => ({
  default: () => <div>plans-page</div>,
}));

vi.mock('@/pages/PlanDetails', () => ({
  default: () => <div>plan-details-page</div>,
}));

vi.mock('@/pages/NotFound', () => ({
  default: () => <div>not-found-page</div>,
}));

import App from '@/App';

describe('App travel legacy route redirects', () => {
  const legacyRoutes = [
    '/travel',
    '/plan',
    '/travel-plan',
    '/travel-plans',
    '/plan/trip_123',
    '/travel-plan/trip_123',
    '/travel-plans/trip_123',
  ];

  it.each(legacyRoutes)('redirects %s to /plans', async (path) => {
    window.history.pushState({}, '', path);
    const view = render(<App />);

    await screen.findByText('plans-page');
    await waitFor(() => {
      expect(window.location.pathname).toBe('/plans');
    });

    view.unmount();
  });
});
