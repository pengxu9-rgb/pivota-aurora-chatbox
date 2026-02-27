import React from 'react';
import { Activity, Beaker, CalendarDays, Camera, Compass, Copy, FlaskConical, Menu, MessageCircle, Search, Sparkles, Workflow } from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';

import type { MobileShellContext } from '@/layouts/MobileShell';
import { cn } from '@/lib/utils';

export default function Home() {
  const { openSidebar, openComposer, startChat } = useOutletContext<MobileShellContext>();
  const navigate = useNavigate();

  return (
    <div className="font-aurora-body bg-[hsl(var(--aurora-home-background))] pb-6 text-[hsl(var(--aurora-home-foreground))]">
      <div
        className="-mx-[var(--aurora-page-x)] overflow-hidden rounded-b-[34px] text-white shadow-elevated"
        style={{
          backgroundImage:
            'linear-gradient(var(--aurora-home-hero-angle), hsl(var(--aurora-home-hero-from)), hsl(var(--aurora-home-hero-via)), hsl(var(--aurora-home-hero-to)))',
        }}
      >
        <div className="relative px-[var(--aurora-page-x)] pb-14 pt-[var(--aurora-page-top)]">
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

          <div className="relative flex items-center justify-between">
            <button
              type="button"
              onClick={openSidebar}
              className="ml-1 inline-flex h-[var(--aurora-home-menu-size)] w-[var(--aurora-home-menu-size)] items-center justify-center rounded-2xl border border-white/35 bg-white/25 text-white shadow-card backdrop-blur active:scale-[0.97]"
              aria-label="Open menu"
            >
              <Menu className="h-[var(--aurora-nav-icon-size)] w-[var(--aurora-nav-icon-size)]" />
            </button>
            <div className="h-[var(--aurora-home-menu-size)] w-[var(--aurora-home-menu-size)]" />
          </div>

          <div className="relative mt-7 text-center">
            <div className="font-aurora-heading font-semibold tracking-[-0.03em]" style={{ fontSize: 'var(--aurora-home-title-size)' }}>
              24/7 Skin Agent
            </div>
            <div className="mt-1 text-white/80" style={{ fontSize: 'var(--aurora-home-subtitle-size)' }}>
              Diagnose. Match. Optimize.
            </div>
          </div>

          <div className="relative mt-5 flex flex-wrap justify-center gap-2">
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

      <div className="-mt-[var(--aurora-home-search-overlap)] px-[var(--aurora-page-x)]">
        <button
          type="button"
          onClick={() => openComposer()}
          className={cn(
            'flex w-full items-center gap-3 rounded-[22px] border px-4 py-3 shadow-card',
            'text-left transition hover:shadow-card-hover active:scale-[0.99]',
          )}
          style={{
            borderColor: 'hsl(var(--aurora-home-border) / 0.72)',
            backgroundColor: 'hsl(var(--aurora-home-card) / var(--aurora-home-glass-alpha))',
            backdropFilter: 'blur(var(--aurora-home-search-blur))',
          }}
          aria-label="Open chat composer"
        >
          <Sparkles className="h-[var(--aurora-nav-icon-size)] w-[var(--aurora-nav-icon-size)] text-[hsl(var(--aurora-home-primary))]" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] text-[hsl(var(--aurora-home-muted-foreground))]">Ask Aurora anything...</div>
          </div>
          <div
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border text-[hsl(var(--aurora-home-primary-foreground))]"
            style={{
              borderColor: 'hsl(var(--aurora-home-primary) / 0.32)',
              backgroundColor: 'hsl(var(--aurora-home-primary))',
            }}
          >
            <MessageCircle className="h-[var(--aurora-nav-icon-size)] w-[var(--aurora-nav-icon-size)]" />
          </div>
        </button>
      </div>

      <div className="mt-4 px-[var(--aurora-page-x)]">
        <div className="section-label text-[hsl(var(--aurora-home-muted-foreground))]">Quick actions</div>
      </div>
      <div className="scrollbar-hide -mx-[var(--aurora-page-x)] mt-1.5 overflow-x-auto px-[var(--aurora-page-x)]">
        <div className="flex w-max gap-2.5 pb-1">
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
            onClick={() => startChat({ kind: 'chip', title: 'Ingredient Science', chip_id: 'chip.start.ingredients.entry' })}
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

      <div className="mt-6 px-[var(--aurora-page-x)]">
        <div className="flex items-center justify-between">
          <div className="ios-section-title font-aurora-heading text-[hsl(var(--aurora-home-foreground))]">More for your skin</div>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <FeatureCard
            title="Daily Routine"
            subtitle="Personalized for you"
            tone="indigo"
            onClick={() => startChat({ kind: 'open', title: 'Routine Analysis', open: 'routine' })}
          />
          <FeatureCard
            title="Plan A Trip"
            subtitle="Travel-ready skin plan"
            tone="emerald"
            onClick={() => navigate('/plans')}
          />
        </div>
      </div>

      <div className="mt-6 px-[var(--aurora-page-x)]">
        <div className="flex items-center justify-between">
          <div className="ios-section-title font-aurora-heading text-[hsl(var(--aurora-home-foreground))]">Recent activity</div>
          <button
            type="button"
            className="text-[12px] font-semibold text-[hsl(var(--aurora-home-primary))] hover:opacity-90"
            onClick={() => openComposer()}
          >
            See all
          </button>
        </div>

        <div
          className="mt-2.5 rounded-[24px] border p-5 text-center shadow-card"
          style={{
            borderColor: 'hsl(var(--aurora-home-border) / 0.72)',
            backgroundColor: 'hsl(var(--aurora-home-card) / var(--aurora-home-glass-alpha))',
            backdropFilter: 'blur(var(--aurora-home-search-blur))',
          }}
        >
          <div
            className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl text-[hsl(var(--aurora-home-primary))]"
            style={{ backgroundColor: 'hsl(var(--aurora-home-primary) / 0.12)' }}
          >
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="font-aurora-heading mt-3 text-[15px] font-semibold tracking-[-0.01em] text-[hsl(var(--aurora-home-foreground))]">
            Start your first skin diagnosis
          </div>
          <div className="mt-1 text-[12px] text-[hsl(var(--aurora-home-muted-foreground))]">Takes ~1 minute and helps personalize everything.</div>
          <button
            type="button"
            className="mt-4 inline-flex items-center justify-center rounded-2xl bg-[hsl(var(--aurora-home-primary))] px-4 py-2.5 text-[14px] font-semibold text-[hsl(var(--aurora-home-primary-foreground))] shadow-card active:scale-[0.99]"
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
      className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white backdrop-blur transition hover:bg-white/15 active:scale-[0.98]"
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5" />
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
      className={cn('relative flex w-[var(--aurora-quick-tile-w)] flex-none flex-col items-center gap-1 rounded-2xl p-1', 'active:scale-[0.98]')}
      onClick={onClick}
      aria-label={label}
    >
      <div
        className={cn(
          'relative inline-flex h-[var(--aurora-quick-icon-size)] w-[var(--aurora-quick-icon-size)] items-center justify-center rounded-2xl',
          'aurora-home-quick-icon border shadow-card',
        )}
        style={{
          borderColor: 'hsl(var(--aurora-home-border) / 0.72)',
          backgroundColor: 'hsl(var(--aurora-home-accent))',
          color: 'hsl(var(--aurora-home-accent-foreground))',
        }}
      >
        <Icon className="h-[var(--aurora-quick-glyph-size)] w-[var(--aurora-quick-glyph-size)]" />
        {badge ? (
          <span className="absolute -right-1 -top-1 rounded-full bg-[hsl(var(--aurora-home-primary))] px-1.5 py-0.5 text-[10px] font-semibold text-[hsl(var(--aurora-home-primary-foreground))]">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="min-h-[22px] text-center font-medium leading-tight text-[hsl(var(--aurora-home-muted-foreground))]" style={{ fontSize: 'var(--aurora-quick-label-size)' }}>
        {label}
      </div>
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
      ? 'linear-gradient(135deg, hsl(var(--aurora-home-feature-warm-from)), hsl(var(--aurora-home-feature-warm-to)))'
      : 'linear-gradient(135deg, hsl(var(--aurora-home-feature-cool-from)), hsl(var(--aurora-home-feature-cool-to)))';

  return (
    <button
      type="button"
      className="rounded-[22px] p-5 text-left text-[hsl(var(--aurora-home-foreground))] shadow-card transition hover:shadow-card-hover active:scale-[0.99]"
      style={{ backgroundImage: bg }}
      onClick={onClick}
    >
      <div className="font-aurora-heading text-[17px] font-semibold tracking-[-0.02em]">{title}</div>
      <div className="mt-1 text-[12px] text-[hsl(var(--aurora-home-muted-foreground))]">{subtitle}</div>
    </button>
  );
}
