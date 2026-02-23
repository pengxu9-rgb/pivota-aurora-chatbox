import React from 'react';
import { CalendarDays, Clock, Compass, Home, Package, ShoppingCart, Sparkles, User } from 'lucide-react';

import { NavLink } from '@/components/NavLink';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { AuroraCartPreviewDrawer } from '@/components/shop/AuroraCartPreviewDrawer';
import { loadAuroraAuthSession } from '@/lib/auth';
import type { ChatHistoryItem } from '@/lib/chatHistory';
import { AURORA_USER_PROFILE_UPDATED_EVENT, loadAuroraUserProfile } from '@/lib/userProfile';
import { cn } from '@/lib/utils';
import { useShop } from '@/contexts/shop';

type SidebarIdentity = {
  displayName: string;
  subtitle: string;
  avatarUrl: string;
};

function resolveSidebarIdentity(): SidebarIdentity {
  if (typeof window === 'undefined') {
    return { displayName: 'User', subtitle: 'Personal', avatarUrl: '' };
  }

  const authSession = loadAuroraAuthSession();
  const email = String(authSession?.email || '').trim();
  if (!email) {
    return { displayName: 'User', subtitle: 'Personal', avatarUrl: '' };
  }

  const profile = loadAuroraUserProfile(email);
  const displayName = profile?.displayName?.trim() || email.split('@')[0] || 'User';
  return {
    displayName,
    subtitle: email,
    avatarUrl: profile?.avatarUrl || '',
  };
}

export function AuroraSidebar({
  open,
  onOpenChange,
  history,
  onOpenChat,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: ChatHistoryItem[];
  onOpenChat: (briefId: string) => void;
}) {
  const shop = useShop();
  const cartCount = Math.max(0, Number(shop.cart?.item_count) || 0);
  const [cartPreviewOpen, setCartPreviewOpen] = React.useState(false);
  const [identity, setIdentity] = React.useState<SidebarIdentity>(() => resolveSidebarIdentity());
  const [avatarLoadError, setAvatarLoadError] = React.useState(false);

  const syncIdentity = React.useCallback(() => {
    setIdentity(resolveSidebarIdentity());
  }, []);

  React.useEffect(() => {
    syncIdentity();
  }, [open, syncIdentity]);

  React.useEffect(() => {
    setAvatarLoadError(false);
  }, [identity.avatarUrl]);

  React.useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key.startsWith('pivota_aurora_')) syncIdentity();
    };
    const onProfileUpdated = () => syncIdentity();
    window.addEventListener('storage', onStorage);
    window.addEventListener(AURORA_USER_PROFILE_UPDATED_EVENT, onProfileUpdated);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(AURORA_USER_PROFILE_UPDATED_EVENT, onProfileUpdated);
    };
  }, [syncIdentity]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-[84vw] max-w-[var(--aurora-shell-max)] p-0 [&>button]:hidden">
          <div className="flex h-full flex-col bg-background">
            <div className="border-b border-border/60 px-[var(--aurora-page-x)] py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="aurora-home-role-icon inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border">
                    {identity.avatarUrl && !avatarLoadError ? (
                      <img
                        src={identity.avatarUrl}
                        alt="User avatar"
                        className="h-full w-full object-cover"
                        onError={() => setAvatarLoadError(true)}
                      />
                    ) : (
                      <User className="h-[18px] w-[18px]" />
                    )}
                  </div>
                  <div className="leading-tight">
                    <div className="max-w-[180px] truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground">{identity.displayName}</div>
                    <div className="max-w-[180px] truncate text-[12px] text-muted-foreground">{identity.subtitle}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2.5">
              <SideLink to="/" label="Home" Icon={Home} end onNavigate={() => onOpenChange(false)} />
              <SideLink to="/routine" label="My Routine" Icon={Sparkles} end onNavigate={() => onOpenChange(false)} />
              <SideLink to="/plans" label="Plans" Icon={CalendarDays} end onNavigate={() => onOpenChange(false)} />
              <SideLink to="/explore" label="Explore" Icon={Compass} end onNavigate={() => onOpenChange(false)} />
              <SideLink to="/profile" label="Profile" Icon={User} end onNavigate={() => onOpenChange(false)} />

              <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Shop</div>
              <SideAction
                label="Cart"
                Icon={ShoppingCart}
                badge={cartCount ? String(cartCount) : null}
                onClick={() => {
                  onOpenChange(false);
                  window.setTimeout(() => setCartPreviewOpen(true), 120);
                }}
              />
              <SideAction
                label="Orders"
                Icon={Package}
                onClick={() => {
                  onOpenChange(false);
                  shop.openOrders();
                }}
              />
            </div>

            <div className="px-[var(--aurora-page-x)] pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Recent</div>

            <div className="flex-1 overflow-y-auto p-2.5">
              {history.length ? (
                <div className="space-y-1">
                  {history.slice(0, 10).map((it) => (
                    <button
                      key={it.brief_id}
                      type="button"
                      className={cn(
                        'flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left',
                        'hover:bg-muted/50',
                      )}
                      onClick={() => {
                        onOpenChange(false);
                        onOpenChat(it.brief_id);
                      }}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[14px] text-foreground">{it.title}</div>
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          History
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-[12px] text-muted-foreground">
                  No recent chats yet.
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AuroraCartPreviewDrawer open={cartPreviewOpen} onOpenChange={setCartPreviewOpen} />
    </>
  );
}

function SideLink({
  to,
  label,
  Icon,
  end,
  onNavigate,
  disabled,
}: {
  to: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  onNavigate: () => void;
  disabled?: boolean;
}) {
  const base = 'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] transition';
  if (disabled) {
    return (
      <div className={cn(base, 'cursor-not-allowed opacity-50')}>
        <Icon className="h-[18px] w-[18px]" />
        <span>{label}</span>
      </div>
    );
  }

  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={cn(base, 'text-foreground hover:bg-muted/50')}
      activeClassName="bg-muted/60"
    >
      <Icon className="h-[18px] w-[18px]" />
      <span>{label}</span>
    </NavLink>
  );
}

function SideAction({
  label,
  Icon,
  badge,
  onClick,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  badge?: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] transition',
        'text-foreground hover:bg-muted/50',
      )}
      onClick={onClick}
      aria-label={label}
    >
      <Icon className="h-[18px] w-[18px]" />
      <span className="flex-1 text-left">{label}</span>
      {badge ? (
        <span className="aurora-home-role-primary rounded-full px-2 py-0.5 text-[11px] font-semibold">{badge}</span>
      ) : null}
    </button>
  );
}
