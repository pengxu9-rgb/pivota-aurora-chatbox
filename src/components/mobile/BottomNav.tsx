import React from 'react';
import { Compass, Droplets, Home, MessageCircle, User } from 'lucide-react';

import { NavLink } from '@/components/NavLink';
import { cn } from '@/lib/utils';

type NavItem = {
  to: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
};

const NAV: NavItem[] = [
  { to: '/', label: 'Home', Icon: Home, end: true },
  { to: '/routine', label: 'Routine', Icon: Droplets, end: true },
  // center chat button handled separately
  { to: '/explore', label: 'Explore', Icon: Compass, end: true },
  { to: '/profile', label: 'Profile', Icon: User, end: true },
];

export function BottomNav({ onChat }: { onChat: () => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50">
      <div className="mx-auto w-full max-w-lg px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2">
        <div className="relative overflow-visible rounded-2xl border border-border/50 bg-card/85 shadow-elevated backdrop-blur-xl">
          <div className="grid grid-cols-5 items-end px-1 py-1">
            <NavSlot item={NAV[0]} />
            <NavSlot item={NAV[1]} />

            <div className="flex items-end justify-center px-1 pb-2">
              <button
                type="button"
                onClick={onChat}
                className={cn(
                  '-mt-7 inline-flex h-14 w-14 items-center justify-center rounded-full',
                  'bg-primary text-primary-foreground shadow-elevated',
                  'active:scale-[0.97] touch-manipulation',
                )}
                aria-label="Open chat"
              >
                <MessageCircle className="h-6 w-6" />
              </button>
            </div>

            <NavSlot item={NAV[2]} />
            <NavSlot item={NAV[3]} />
          </div>
        </div>
      </div>
    </nav>
  );
}

function NavSlot({ item }: { item: NavItem }) {
  const { to, label, Icon, end } = item;
  return (
    <NavLink
      to={to}
      end={end}
      className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
      activeClassName="text-primary"
      aria-label={label}
    >
      <Icon className="h-5 w-5" />
      <span className="text-[11px] leading-none">{label}</span>
    </NavLink>
  );
}

