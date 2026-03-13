import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';

import type { MobileShellContext } from '@/layouts/MobileShell';
import { listActivity, type ActivityItem } from '@/lib/activityApi';
import { formatActivitySubtitle, formatActivityTitle, openActivityItem } from '@/lib/activityPresentation';
import { getLangPref } from '@/lib/persistence';

const PAGE_SIZE = 20;

export default function ActivityPage() {
  const navigate = useNavigate();
  const { startChat } = useOutletContext<MobileShellContext>();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cursor: string | null, append: boolean) => {
    const language = getLangPref() === 'cn' ? 'CN' : 'EN';
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
      setError('Failed to load activity. Please try again.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

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
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="font-aurora-heading text-[18px] font-semibold tracking-[-0.02em]">Activity</div>
        <div className="h-10 w-10" />
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="rounded-[24px] border border-[hsl(var(--aurora-home-border)/0.72)] bg-[hsl(var(--aurora-home-card)/var(--aurora-home-glass-alpha))] p-5 text-[13px] text-[hsl(var(--aurora-home-muted-foreground))] shadow-card">
            Loading activity...
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
            <div className="font-aurora-heading mt-3 text-[15px] font-semibold">No activity yet</div>
            <div className="mt-1 text-[12px] text-[hsl(var(--aurora-home-muted-foreground))]">
              Start a diagnosis or log a check-in to build your timeline.
            </div>
            <button
              type="button"
              className="mt-4 inline-flex items-center justify-center rounded-2xl bg-[hsl(var(--aurora-home-primary))] px-4 py-2.5 text-[14px] font-semibold text-[hsl(var(--aurora-home-primary-foreground))]"
              onClick={() => startChat({ kind: 'chip', title: 'Skin Diagnosis', chip_id: 'chip.start.diagnosis' })}
            >
              Start diagnosis
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
                  <div className="truncate text-[14px] font-semibold text-[hsl(var(--aurora-home-foreground))]">{formatActivityTitle(item)}</div>
                  <div className="mt-0.5 truncate text-[12px] text-[hsl(var(--aurora-home-muted-foreground))]">{formatActivitySubtitle(item)}</div>
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
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
