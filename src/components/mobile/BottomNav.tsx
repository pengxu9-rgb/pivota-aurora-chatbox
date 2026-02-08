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
      <div className="mx-auto w-full max-w-[var(--aurora-shell-max)] px-[var(--aurora-page-x)] pb-[calc(env(safe-area-inset-bottom)+var(--aurora-nav-bottom-gap))] pt-[var(--aurora-nav-top-gap)]">
        <div
          className="relative overflow-visible border border-border/60 bg-card/80 shadow-card backdrop-blur-2xl"
          style={{ borderRadius: 'var(--aurora-nav-radius)' }}
        >
          <div className="grid grid-cols-5 items-end px-1 py-1.5">
            <NavSlot item={NAV[0]} />
            <NavSlot item={NAV[1]} />

            <div className="flex items-end justify-center px-1 pb-2">
              <button
                type="button"
                onClick={onChat}
                className={cn(
                  'inline-flex items-center justify-center rounded-full',
                  'border border-primary/40 bg-primary text-primary-foreground shadow-card',
                  'active:scale-[0.97] touch-manipulation',
                )}
                style={{
                  width: 'var(--aurora-nav-chat-size)',
                  height: 'var(--aurora-nav-chat-size)',
                  marginTop: 'calc(var(--aurora-nav-chat-offset) * -1)',
                }}
                aria-label="Open chat"
              >
                <MessageCircle className="h-[var(--aurora-nav-icon-size)] w-[var(--aurora-nav-icon-size)]" />
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
      className="flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      activeClassName="text-primary"
      aria-label={label}
    >
      <Icon className="h-[var(--aurora-nav-icon-size)] w-[var(--aurora-nav-icon-size)]" />
      <span className="leading-none" style={{ fontSize: 'var(--aurora-nav-label-size)' }}>
        {label}
      </span>
    </NavLink>
  );
}
