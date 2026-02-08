import React from 'react';
import { Activity, Beaker, CalendarDays, Camera, Compass, Copy, FlaskConical, Menu, MessageCircle, Package, Search, ShoppingCart, Sparkles, Workflow } from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';

import type { MobileShellContext } from '@/layouts/MobileShell';
import { cn } from '@/lib/utils';
import { useShop } from '@/contexts/shop';

export default function Home() {
  const { openSidebar, openComposer, startChat } = useOutletContext<MobileShellContext>();
  const navigate = useNavigate();
  const shop = useShop();
  const cartCount = Math.max(0, Number(shop.cart?.item_count) || 0);
  const lastOrder = shop.recent_orders?.[0] || null;

  return (
    <div className="pb-6">
      <div className="-mx-4 overflow-hidden rounded-b-[36px] bg-gradient-to-b from-indigo-500 via-violet-500 to-blue-500 text-white shadow-elevated">
        <div className="relative px-4 pb-16 pt-4">
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

          <div className="relative flex items-center justify-between">
            <button
              type="button"
              onClick={openSidebar}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur active:scale-[0.97]"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="h-10 w-10" />
          </div>

          <div className="relative mt-8 text-center">
            <div className="text-2xl font-semibold">Your AI Skin Consultant</div>
            <div className="mt-1 text-xs text-white/80">Powered by Aurora v4.0</div>
          </div>

          <div className="relative mt-6 flex flex-wrap justify-center gap-2">
            <Pill
              label="My Routine"
              Icon={Workflow}
              onClick={() => navigate('/routine')}
            />
            <Pill
              label="Plans"
              Icon={CalendarDays}
              onClick={() => navigate('/plans')}
            />
            <Pill
              label="Explore"
              Icon={Compass}
              onClick={() => navigate('/explore')}
            />
          </div>
        </div>
      </div>

      <div className="-mt-8 px-4">
        <button
          type="button"
          onClick={() => openComposer()}
          className={cn(
            'flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-background/95 px-4 py-3 shadow-card',
            'text-left backdrop-blur transition hover:shadow-card-hover active:scale-[0.99]',
          )}
          aria-label="Open chat composer"
        >
          <Search className="h-5 w-5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-muted-foreground">Search products, ingredients...</div>
          </div>
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-primary">
            <MessageCircle className="h-5 w-5" />
          </div>
        </button>
      </div>

      <div className="mt-5 px-4">
        <div className="section-label">Quick actions</div>
      </div>
      <div className="scrollbar-hide -mx-4 mt-3 overflow-x-auto px-4">
        <div className="flex w-max gap-4 pb-1">
          <QuickActionIcon
            label="Cart"
            Icon={ShoppingCart}
            badge={cartCount ? String(cartCount) : null}
            onClick={() => shop.openCart()}
          />
          <QuickActionIcon
            label="Orders"
            Icon={Package}
            badge={lastOrder ? '1' : null}
            onClick={() => shop.openOrders()}
          />
          <QuickActionIcon
            label="Diagnosis"
            Icon={Sparkles}
            onClick={() => startChat({ kind: 'chip', title: 'Skin Diagnosis', chip_id: 'chip.start.diagnosis' })}
          />
          <QuickActionIcon
            label="Photo"
            Icon={Camera}
            onClick={() => startChat({ kind: 'open', title: 'Photo Analysis', open: 'photo' })}
          />
          <QuickActionIcon
            label="Product"
            Icon={Search}
            onClick={() => startChat({ kind: 'chip', title: 'Product Check', chip_id: 'chip.start.evaluate' })}
          />
          <QuickActionIcon
            label="Routine"
            Icon={Beaker}
            onClick={() => startChat({ kind: 'chip', title: 'Routine Builder', chip_id: 'chip.start.routine' })}
          />
          <QuickActionIcon
            label="Ingredients"
            Icon={FlaskConical}
            onClick={() => startChat({ kind: 'chip', title: 'Ingredient Science', chip_id: 'chip.start.ingredients' })}
          />
          <QuickActionIcon
            label="Dupes"
            Icon={Copy}
            onClick={() => startChat({ kind: 'chip', title: 'Find Dupes', chip_id: 'chip.start.dupes' })}
          />
          <QuickActionIcon
            label="Check-in"
            Icon={Activity}
            onClick={() => startChat({ kind: 'chip', title: 'Check-in', chip_id: 'chip_checkin_now' })}
          />
        </div>
      </div>

      <div className="mt-6 px-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-foreground">More for your skin</div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <FeatureCard
            title="Daily Routine"
            subtitle="Personalized for you"
            tone="indigo"
            onClick={() => startChat({ kind: 'open', title: 'Routine Analysis', open: 'routine' })}
          />
          <FeatureCard
            title="Skin Plan"
            subtitle="AI-powered analysis"
            tone="emerald"
            onClick={() => startChat({ kind: 'chip', title: 'Skin Diagnosis', chip_id: 'chip.start.diagnosis' })}
          />
        </div>
      </div>

      <div className="mt-6 px-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-foreground">Recent activity</div>
          <button type="button" className="text-xs font-semibold text-primary hover:text-primary/90" onClick={() => openComposer()}>
            See all
          </button>
        </div>

        <div className="mt-3 rounded-3xl border border-border/60 bg-card/60 p-6 text-center shadow-card">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="mt-3 text-sm font-semibold text-foreground">Start your first skin diagnosis</div>
          <div className="mt-1 text-xs text-muted-foreground">Takes ~1 minute and helps personalize everything.</div>
          <button
            type="button"
            className="mt-4 inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-card active:scale-[0.99]"
            onClick={() => startChat({ kind: 'chip', title: 'Skin Diagnosis', chip_id: 'chip.start.diagnosis' })}
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
}

function Pill({ label, Icon, onClick }: { label: string; Icon: React.ComponentType<{ className?: string }>; onClick: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/15 active:scale-[0.98]"
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function QuickActionIcon({
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
      className={cn('relative flex w-[86px] flex-none flex-col items-center gap-2 rounded-3xl px-2 py-2', 'active:scale-[0.98]')}
      onClick={onClick}
      aria-label={label}
    >
      <div
        className={cn(
          'relative inline-flex h-14 w-14 items-center justify-center rounded-3xl',
          'border border-border/60 bg-card/70 text-primary shadow-card',
        )}
      >
        <Icon className="h-6 w-6" />
        {badge ? (
          <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="min-h-[28px] text-center text-[11px] font-medium leading-tight text-muted-foreground">{label}</div>
    </button>
  );
}

function FeatureCard({
  title,
  subtitle,
  tone,
  onClick,
}: {
  title: string;
  subtitle: string;
  tone: 'indigo' | 'emerald';
  onClick: () => void;
}) {
  const bg =
    tone === 'indigo'
      ? 'bg-gradient-to-br from-indigo-500 via-violet-500 to-blue-500'
      : 'bg-gradient-to-br from-emerald-500 via-teal-500 to-green-500';

  return (
    <button
      type="button"
      className={cn('rounded-3xl p-5 text-left text-white shadow-card transition hover:shadow-card-hover active:scale-[0.99]', bg)}
      onClick={onClick}
    >
      <div className="text-base font-semibold">{title}</div>
      <div className="mt-1 text-xs text-white/80">{subtitle}</div>
    </button>
  );
}
