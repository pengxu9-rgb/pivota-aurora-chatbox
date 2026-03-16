import React, { useEffect, useState } from 'react';
import { Activity, Beaker, CalendarDays, Camera, Compass, Copy, FlaskConical, Menu, MessageCircle, Search, Sparkles, Workflow } from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';

import type { MobileShellContext } from '@/layouts/MobileShell';
import { listActivity, type ActivityItem } from '@/lib/activityApi';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

export default function Home() {
  const { openSidebar, openComposer, startChat } = useOutletContext<MobileShellContext>();
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setRecentLoading(true);
    void listActivity(language, { limit: 3 })
      .then((response) => {
        if (cancelled) return;
        setRecentActivity(Array.isArray(response?.items) ? response.items : []);
      })
      .catch(() => {
        if (cancelled) return;
        setRecentActivity([]);
      })
      .finally(() => {
        if (cancelled) return;
        setRecentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [language]);

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
              aria-label={t('common.open_menu')}
            >
              <Menu className="h-[var(--aurora-nav-icon-size)] w-[var(--aurora-nav-icon-size)]" />
            </button>
            <div className="h-[var(--aurora-home-menu-size)] w-[var(--aurora-home-menu-size)]" />
          </div>

          <div className="relative mt-7 text-center">
            <div className="font-aurora-heading font-semibold tracking-[-0.03em]" style={{ fontSize: 'var(--aurora-home-title-size)' }}>
              {t('home.hero.title')}
            </div>
            <div className="mt-1 text-white/80" style={{ fontSize: 'var(--aurora-home-subtitle-size)' }}>
              {t('home.hero.subtitle')}
            </div>
          </div>

          <div className="relative mt-5 flex flex-wrap justify-center gap-2">
            <Pill
              label={t('home.pill.routine')}
              Icon={Workflow}
              onClick={() => navigate('/routine')}
            />
            <Pill
              label={t('home.pill.plans')}
              Icon={CalendarDays}
              onClick={() => navigate('/plans')}
            />
            <Pill
              label={t('home.pill.explore')}
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
          aria-label={t('nav.open_chat')}
        >
          <Sparkles className="h-[var(--aurora-nav-icon-size)] w-[var(--aurora-nav-icon-size)] text-[hsl(var(--aurora-home-primary))]" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] text-[hsl(var(--aurora-home-muted-foreground))]">{t('home.search.placeholder')}</div>
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
        <div className="section-label text-[hsl(var(--aurora-home-muted-foreground))]">{t('home.quick_actions')}</div>
      </div>
      <div className="scrollbar-hide -mx-[var(--aurora-page-x)] mt-1.5 overflow-x-auto px-[var(--aurora-page-x)]">
        <div className="flex w-max gap-2.5 pb-1">
          <QuickActionIcon
            label={t('home.action.diagnosis')}
            Icon={Sparkles}
            onClick={() => startChat({ kind: 'chip', title: t('composer.action.skin_diagnosis'), chip_id: 'chip.start.diagnosis' })}
          />
          <QuickActionIcon
            label={t('home.action.photo')}
            Icon={Camera}
            onClick={() => startChat({ kind: 'open', title: t('composer.action.photo_analysis'), open: 'photo' })}
          />
          <QuickActionIcon
            label={t('home.action.product')}
            Icon={Search}
            onClick={() => startChat({ kind: 'chip', title: t('composer.action.product_check'), chip_id: 'chip.start.evaluate' })}
          />
          <QuickActionIcon
            label={t('home.action.routine')}
            Icon={Beaker}
            onClick={() => startChat({ kind: 'chip', title: t('composer.action.routine_builder'), chip_id: 'chip.start.routine' })}
          />
          <QuickActionIcon
            label={t('home.action.ingredients')}
            Icon={FlaskConical}
            onClick={() => startChat({ kind: 'chip', title: t('composer.action.ingredient_science'), chip_id: 'chip.start.ingredients.entry' })}
          />
          <QuickActionIcon
            label={t('home.action.dupes')}
            Icon={Copy}
            onClick={() => startChat({ kind: 'chip', title: t('composer.action.find_dupes'), chip_id: 'chip.start.dupes' })}
          />
          <QuickActionIcon
            label={t('home.action.checkin')}
            Icon={Activity}
            onClick={() => startChat({ kind: 'chip', title: t('composer.action.checkin'), chip_id: 'chip_checkin_now' })}
          />
        </div>
      </div>

      <div className="mt-6 px-[var(--aurora-page-x)]">
        <div className="flex items-center justify-between">
          <div className="ios-section-title font-aurora-heading text-[hsl(var(--aurora-home-foreground))]">{t('home.more_for_skin')}</div>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <FeatureCard
            title={t('home.feature.daily_routine')}
            subtitle={t('home.feature.daily_routine_sub')}
            tone="indigo"
            onClick={() => startChat({ kind: 'chip', title: t('composer.action.routine_builder'), chip_id: 'chip.start.routine' })}
          />
          <FeatureCard
            title={t('home.feature.plan_trip')}
            subtitle={t('home.feature.plan_trip_sub')}
            tone="emerald"
            onClick={() => navigate('/plans')}
          />
        </div>
      </div>

      <div className="mt-6 px-[var(--aurora-page-x)]">
        <div className="flex items-center justify-between">
          <div className="ios-section-title font-aurora-heading text-[hsl(var(--aurora-home-foreground))]">{t('home.recent_activity')}</div>
          <button
            type="button"
            className="text-[12px] font-semibold text-[hsl(var(--aurora-home-primary))] hover:opacity-90"
            onClick={() => navigate('/activity')}
          >
            {t('home.see_all')}
          </button>
        </div>

        {recentLoading ? (
          <div
            className="mt-2.5 rounded-[24px] border p-5 text-center shadow-card"
            style={{
              borderColor: 'hsl(var(--aurora-home-border) / 0.72)',
              backgroundColor: 'hsl(var(--aurora-home-card) / var(--aurora-home-glass-alpha))',
              backdropFilter: 'blur(var(--aurora-home-search-blur))',
            }}
          >
            <div className="text-[13px] text-[hsl(var(--aurora-home-muted-foreground))]">{t('home.loading_activity')}</div>
          </div>
        ) : recentActivity.length ? (
          <div
            className="mt-2.5 rounded-[24px] border p-2 shadow-card"
            style={{
              borderColor: 'hsl(var(--aurora-home-border) / 0.72)',
              backgroundColor: 'hsl(var(--aurora-home-card) / var(--aurora-home-glass-alpha))',
              backdropFilter: 'blur(var(--aurora-home-search-blur))',
            }}
          >
            {recentActivity.map((item) => (
              <button
                key={String(item.activity_id || `${item.event_type}_${item.occurred_at_ms}`)}
                type="button"
                className="w-full rounded-2xl px-3 py-2.5 text-left hover:bg-[hsl(var(--aurora-home-primary)/0.06)]"
                onClick={() => openActivityDeeplink(item.deeplink, navigate)}
              >
                <div className="text-[14px] font-semibold text-[hsl(var(--aurora-home-foreground))]">{formatActivityTitle(item, t)}</div>
                <div className="mt-0.5 text-[12px] text-[hsl(var(--aurora-home-muted-foreground))]">
                  {formatActivitySubtitle(item, t)}
                </div>
              </button>
            ))}
          </div>
        ) : (
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
              {t('home.empty.title')}
            </div>
            <div className="mt-1 text-[12px] text-[hsl(var(--aurora-home-muted-foreground))]">{t('home.empty.subtitle')}</div>
            <button
              type="button"
              className="mt-4 inline-flex items-center justify-center rounded-2xl bg-[hsl(var(--aurora-home-primary))] px-4 py-2.5 text-[14px] font-semibold text-[hsl(var(--aurora-home-primary-foreground))] shadow-card active:scale-[0.99]"
              onClick={() => startChat({ kind: 'chip', title: t('composer.action.skin_diagnosis'), chip_id: 'chip.start.diagnosis' })}
            >
              {t('home.empty.start')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

type TFn = (key: string, params?: Record<string, string | number>) => string;

function openActivityDeeplink(deeplink: string | null | undefined, navigate: (to: string) => void) {
  const target = String(deeplink || '').trim();
  if (!target) {
    navigate('/activity');
    return;
  }
  if (target.startsWith('/')) {
    navigate(target);
    return;
  }
  if (/^https?:\/\//i.test(target) && typeof window !== 'undefined') {
    window.open(target, '_blank', 'noopener,noreferrer');
  }
}

function formatActivityTitle(item: ActivityItem, t: TFn): string {
  const keyMap: Record<string, string> = {
    chat_started: 'home.activity.chat_started',
    skin_analysis: 'home.activity.skin_analysis',
    tracker_logged: 'home.activity.tracker_logged',
    profile_updated: 'home.activity.profile_updated',
    travel_plan_created: 'home.activity.travel_plan_created',
    travel_plan_updated: 'home.activity.travel_plan_updated',
    travel_plan_archived: 'home.activity.travel_plan_archived',
  };
  return t(keyMap[item.event_type] || 'home.activity.default');
}

function formatActivitySubtitle(item: ActivityItem, t: TFn): string {
  const payload = item.payload && typeof item.payload === 'object' ? item.payload : {};
  if (item.event_type === 'skin_analysis') {
    const usedPhotos = payload.used_photos === true;
    const failureCode = typeof payload.photo_failure_code === 'string' ? payload.photo_failure_code.trim() : '';
    if (usedPhotos) return `${t('home.activity.photo_based')} · ${formatRelativeTime(item.occurred_at_ms, t)}`;
    if (failureCode) return `${t('home.activity.no_photo')} (${failureCode}) · ${formatRelativeTime(item.occurred_at_ms, t)}`;
    return `${t('home.activity.no_photo')} · ${formatRelativeTime(item.occurred_at_ms, t)}`;
  }
  if (
    (item.event_type === 'travel_plan_created' || item.event_type === 'travel_plan_updated' || item.event_type === 'travel_plan_archived') &&
    typeof payload.destination === 'string' &&
    payload.destination.trim()
  ) {
    return `${payload.destination.trim()} · ${formatRelativeTime(item.occurred_at_ms, t)}`;
  }
  if (item.event_type === 'tracker_logged' && typeof payload.date === 'string' && payload.date.trim()) {
    return `${payload.date.trim()} · ${formatRelativeTime(item.occurred_at_ms, t)}`;
  }
  return formatRelativeTime(item.occurred_at_ms, t);
}

function formatRelativeTime(occurredAtMs: number, t: TFn): string {
  const deltaMs = Date.now() - Number(occurredAtMs || 0);
  if (!Number.isFinite(deltaMs)) return t('home.time.just_now');
  const deltaSeconds = Math.max(0, Math.floor(deltaMs / 1000));
  if (deltaSeconds < 60) return t('home.time.just_now');
  const minutes = Math.floor(deltaSeconds / 60);
  if (minutes < 60) return t('home.time.minutes_ago', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('home.time.hours_ago', { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t('home.time.days_ago', { n: days });
  return new Date(occurredAtMs).toLocaleDateString();
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
