import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';

import type { MobileShellContext } from '@/layouts/MobileShell';
import { listActivity, type ActivityItem } from '@/lib/activityApi';
import { useLanguage } from '@/contexts/LanguageContext';
import { openActivityItem } from '@/lib/activityPresentation';

const PAGE_SIZE = 20;

type TFn = (key: string, params?: Record<string, string | number>) => string;

export default function ActivityPage() {
  const navigate = useNavigate();
  const { startChat } = useOutletContext<MobileShellContext>();
  const { language, t } = useLanguage();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cursor: string | null, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const response = await listActivity(language, { limit: PAGE_SIZE, cursor });
      const nextItems = Array.isArray(response?.items) ? response.items : [];
      setItems((prev) => (append ? [...prev, ...nextItems] : nextItems));
      setNextCursor(response?.next_cursor || null);
      setError(null);
    } catch {
      if (!append) setItems([]);
      setError(t('activity.error'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [language, t]);

  useEffect(() => {
    void load(null, false);
  }, [load]);

  return (
    <div className="font-aurora-body bg-[hsl(var(--aurora-home-background))] px-[var(--aurora-page-x)] pb-8 pt-[var(--aurora-page-top)] text-[hsl(var(--aurora-home-foreground))]">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[hsl(var(--aurora-home-border)/0.72)] bg-[hsl(var(--aurora-home-card)/var(--aurora-home-glass-alpha))]"
          onClick={() => navigate('/')}
          aria-label={t('common.back')}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="font-aurora-heading text-[18px] font-semibold tracking-[-0.02em]">{t('activity.title')}</div>
        <div className="h-10 w-10" />
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="rounded-[24px] border border-[hsl(var(--aurora-home-border)/0.72)] bg-[hsl(var(--aurora-home-card)/var(--aurora-home-glass-alpha))] p-5 text-[13px] text-[hsl(var(--aurora-home-muted-foreground))] shadow-card">
            {t('activity.loading')}
          </div>
        ) : error ? (
          <div className="rounded-[24px] border border-[hsl(var(--aurora-home-border)/0.72)] bg-[hsl(var(--aurora-home-card)/var(--aurora-home-glass-alpha))] p-5 text-[13px] text-[hsl(var(--aurora-home-muted-foreground))] shadow-card">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[24px] border border-[hsl(var(--aurora-home-border)/0.72)] bg-[hsl(var(--aurora-home-card)/var(--aurora-home-glass-alpha))] p-6 text-center shadow-card">
            <div
              className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl text-[hsl(var(--aurora-home-primary))]"
              style={{ backgroundColor: 'hsl(var(--aurora-home-primary) / 0.12)' }}
            >
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="font-aurora-heading mt-3 text-[15px] font-semibold">{t('activity.no_activity')}</div>
            <div className="mt-1 text-[12px] text-[hsl(var(--aurora-home-muted-foreground))]">
              {t('activity.no_activity_desc')}
            </div>
            <button
              type="button"
              className="mt-4 inline-flex items-center justify-center rounded-2xl bg-[hsl(var(--aurora-home-primary))] px-4 py-2.5 text-[14px] font-semibold text-[hsl(var(--aurora-home-primary-foreground))]"
              onClick={() => startChat({ kind: 'chip', title: t('composer.action.skin_diagnosis'), chip_id: 'chip.start.diagnosis' })}
            >
              {t('activity.start_diagnosis')}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <button
                key={String(item.activity_id || `${item.event_type}_${item.occurred_at_ms}`)}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-[22px] border border-[hsl(var(--aurora-home-border)/0.72)] bg-[hsl(var(--aurora-home-card)/var(--aurora-home-glass-alpha))] px-4 py-3 text-left shadow-card"
                onClick={() => openActivityItem(item, navigate)}
              >
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold text-[hsl(var(--aurora-home-foreground))]">{formatActivityTitle(item, t)}</div>
                  <div className="mt-0.5 truncate text-[12px] text-[hsl(var(--aurora-home-muted-foreground))]">{formatActivitySubtitle(item, t)}</div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-[hsl(var(--aurora-home-muted-foreground))]" />
              </button>
            ))}

            {nextCursor ? (
              <button
                type="button"
                className="mt-2 inline-flex w-full items-center justify-center rounded-2xl border border-[hsl(var(--aurora-home-border)/0.72)] px-4 py-2.5 text-[13px] font-semibold text-[hsl(var(--aurora-home-foreground))]"
                onClick={() => void load(nextCursor, true)}
                disabled={loadingMore}
              >
                {loadingMore ? t('loading') : t('activity.load_more')}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
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
