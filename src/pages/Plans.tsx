import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, CalendarDays, ChevronRight, Loader2, MapPin, Menu, MessageCircle, Plus } from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';

import type { MobileShellContext } from '@/layouts/MobileShell';
import type { Language } from '@/lib/pivotaAgentBff';
import { getLangPref } from '@/lib/persistence';
import {
  archiveTravelPlan,
  createTravelPlan,
  listTravelPlans,
  type TravelPlanCardModel,
  type TravelPlansSummary,
} from '@/lib/travelPlansApi';
import { toast } from '@/components/ui/use-toast';

type PlanDraft = {
  destination: string;
  start_date: string;
  end_date: string;
  indoor_outdoor_ratio: string;
  itinerary: string;
};

const makeEmptyDraft = (): PlanDraft => ({
  destination: '',
  start_date: '',
  end_date: '',
  indoor_outdoor_ratio: '',
  itinerary: '',
});

const normalizeRatio = (raw: string): number | null => {
  const token = String(raw || '').trim();
  if (!token) return null;
  const n = Number(token);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1, n));
};

const buildDateRangeLabel = (plan: TravelPlanCardModel): string => `${plan.start_date} - ${plan.end_date}`;

const getStatusLabel = (status: TravelPlanCardModel['status'], language: Language): string => {
  if (status === 'in_trip') return language === 'CN' ? '行程中' : 'In trip';
  if (status === 'upcoming') return language === 'CN' ? '即将出行' : 'Upcoming';
  if (status === 'completed') return language === 'CN' ? '已结束' : 'Completed';
  return language === 'CN' ? '已归档' : 'Archived';
};

const getTimingLabel = (plan: TravelPlanCardModel, language: Language): string => {
  const daysToStart = Number.isFinite(Number(plan.days_to_start)) ? Number(plan.days_to_start) : null;
  const daysToEnd = Number.isFinite(Number(plan.days_to_end)) ? Number(plan.days_to_end) : null;

  if (plan.status === 'upcoming') {
    if (daysToStart == null) return language === 'CN' ? '即将出发' : 'Starts soon';
    if (daysToStart <= 0) return language === 'CN' ? '今天出发' : 'Starts today';
    return language === 'CN' ? `${daysToStart} 天后出发` : `Starts in ${daysToStart} days`;
  }
  if (plan.status === 'in_trip') {
    const dayIndex = daysToStart == null ? null : Math.max(1, Math.abs(daysToStart) + 1);
    if (dayIndex == null) return language === 'CN' ? '行程进行中' : 'Trip in progress';
    return language === 'CN' ? `行程第 ${dayIndex} 天` : `Day ${dayIndex} of trip`;
  }
  if (plan.status === 'completed') {
    if (daysToEnd == null) return language === 'CN' ? '行程已结束' : 'Trip ended';
    const endedDays = Math.max(0, Math.abs(daysToEnd));
    return language === 'CN' ? `${endedDays} 天前结束` : `Ended ${endedDays} days ago`;
  }
  return language === 'CN' ? '已归档' : 'Archived';
};

const buildCreateValidationError = (draft: PlanDraft, language: Language): string | null => {
  if (!draft.destination.trim() || !draft.start_date || !draft.end_date) {
    return language === 'CN' ? '请先填写目的地与日期。' : 'Please fill destination and dates first.';
  }
  if (draft.start_date > draft.end_date) {
    return language === 'CN' ? '开始日期不能晚于结束日期。' : 'Start date cannot be after end date.';
  }
  if (draft.indoor_outdoor_ratio.trim() && normalizeRatio(draft.indoor_outdoor_ratio) == null) {
    return language === 'CN' ? '户外比例需为 0 到 1 之间数字。' : 'Outdoor ratio must be a number between 0 and 1.';
  }
  return null;
};

export default function Plans() {
  const { openSidebar, startChat } = useOutletContext<MobileShellContext>();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<PlanDraft>(makeEmptyDraft());
  const [plans, setPlans] = useState<TravelPlanCardModel[]>([]);
  const [summary, setSummary] = useState<TravelPlansSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingCreate, setSavingCreate] = useState(false);
  const [archivingTripId, setArchivingTripId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const language: Language = useMemo(() => (getLangPref() === 'cn' ? 'CN' : 'EN'), []);

  const refreshPlans = useCallback(
    async (options: { silent?: boolean } = {}) => {
      const silent = Boolean(options.silent);
      if (!silent) setLoading(true);
      setError('');
      try {
        const response = await listTravelPlans(language, { includeArchived: true });
        setPlans(Array.isArray(response.plans) ? response.plans : []);
        setSummary(response.summary ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [language],
  );

  useEffect(() => {
    void refreshPlans();
  }, [refreshPlans]);

  const submitCreate = async () => {
    setError('');
    const validationError = buildCreateValidationError(draft, language);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSavingCreate(true);
      await createTravelPlan(language, {
        destination: draft.destination.trim(),
        start_date: draft.start_date,
        end_date: draft.end_date,
        ...(normalizeRatio(draft.indoor_outdoor_ratio) != null
          ? { indoor_outdoor_ratio: normalizeRatio(draft.indoor_outdoor_ratio) as number }
          : {}),
        ...(draft.itinerary.trim() ? { itinerary: draft.itinerary.trim().slice(0, 1200) } : {}),
      });
      setDraft(makeEmptyDraft());
      toast({ title: language === 'CN' ? '计划已保存' : 'Plan saved' });
      await refreshPlans({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingCreate(false);
    }
  };

  const openDetails = (plan: TravelPlanCardModel) => {
    const tripId = String(plan.trip_id || '').trim();
    if (!tripId) return;
    navigate(`/plans/${encodeURIComponent(tripId)}`, { state: { plan } });
  };

  const openPlanInChat = (plan: TravelPlanCardModel) => {
    const itineraryText = String(plan.itinerary || '').trim();
    const query =
      language === 'CN'
        ? `请基于我的旅行计划给护肤建议。目的地：${plan.destination}；日期：${plan.start_date} 到 ${plan.end_date}。${itineraryText ? `行程备注：${itineraryText}` : ''}`
        : `Please adjust my skincare based on this travel plan. Destination: ${plan.destination}. Dates: ${plan.start_date} to ${plan.end_date}.${itineraryText ? ` Itinerary: ${itineraryText}` : ''}`;

    startChat({
      kind: 'query',
      title: language === 'CN' ? '旅行护肤计划' : 'Travel skincare plan',
      query,
    });
  };

  const archivePlan = async (tripId: string) => {
    try {
      setArchivingTripId(tripId);
      await archiveTravelPlan(language, tripId);
      toast({ title: language === 'CN' ? '计划已归档' : 'Plan archived' });
      await refreshPlans({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setArchivingTripId(null);
    }
  };

  return (
    <div className="ios-page">
      <div className="ios-page-header">
        <button
          type="button"
          onClick={openSidebar}
          className="ios-nav-button"
          aria-label="Open menu"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>
        <div className="ios-page-title">Plans</div>
        <div className="ios-header-spacer" />
      </div>

      <div className="ios-panel mt-4">
        <div className="flex items-start gap-3">
          <div className="aurora-home-role-icon inline-flex h-11 w-11 items-center justify-center rounded-2xl border">
            <Plus className="h-[18px] w-[18px]" />
          </div>
          <div>
            <div className="ios-section-title">{language === 'CN' ? 'Create new plan' : 'Create new plan'}</div>
            <div className="ios-caption mt-1">
              {language === 'CN'
                ? '先创建行程，再到下方查看卡片与详情。'
                : 'Create your trip first, then review cards and details below.'}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <div className="mb-1 text-xs text-muted-foreground">{language === 'CN' ? '目的地' : 'Destination'}</div>
            <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-3 py-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={draft.destination}
                onChange={(e) => setDraft((prev) => ({ ...prev, destination: e.target.value }))}
                placeholder={language === 'CN' ? '例如：Tokyo / Paris' : 'e.g. Tokyo / Paris'}
                className="h-6 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
              />
            </div>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <div className="mb-1 text-xs text-muted-foreground">{language === 'CN' ? '开始日期' : 'Start date'}</div>
              <input
                type="date"
                value={draft.start_date}
                onChange={(e) => setDraft((prev) => ({ ...prev, start_date: e.target.value }))}
                className="h-10 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground outline-none"
              />
            </label>
            <label className="block">
              <div className="mb-1 text-xs text-muted-foreground">{language === 'CN' ? '结束日期' : 'End date'}</div>
              <input
                type="date"
                value={draft.end_date}
                onChange={(e) => setDraft((prev) => ({ ...prev, end_date: e.target.value }))}
                className="h-10 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground outline-none"
              />
            </label>
          </div>

          <label className="block">
            <div className="mb-1 text-xs text-muted-foreground">{language === 'CN' ? '户外比例（0-1，可选）' : 'Outdoor ratio (0-1, optional)'}</div>
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={draft.indoor_outdoor_ratio}
              onChange={(e) => setDraft((prev) => ({ ...prev, indoor_outdoor_ratio: e.target.value }))}
              className="h-10 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground outline-none"
              placeholder="0.5"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-xs text-muted-foreground">{language === 'CN' ? '可选行程备注' : 'Optional itinerary'}</div>
            <textarea
              value={draft.itinerary}
              onChange={(e) => setDraft((prev) => ({ ...prev, itinerary: e.target.value }))}
              className="min-h-[86px] w-full resize-none rounded-2xl border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
              placeholder={
                language === 'CN'
                  ? '如：白天户外较多、飞行、滑雪、跑步、暴晒等'
                  : 'e.g. mostly outdoor daytime, flights, ski, workouts, heavy sun exposure'
              }
            />
          </label>
        </div>

        {error ? <div className="mt-3 text-xs text-red-500">{error}</div> : null}

        <button
          type="button"
          className="aurora-home-role-primary mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-[14px] font-semibold shadow-card active:scale-[0.99] disabled:opacity-70"
          onClick={submitCreate}
          disabled={savingCreate}
        >
          <Plus className="h-4 w-4" />
          {savingCreate ? (language === 'CN' ? '保存中...' : 'Saving...') : language === 'CN' ? '保存计划' : 'Save plan'}
        </button>
      </div>

      <div className="ios-panel mt-4">
        <div className="flex items-start gap-3">
          <div className="aurora-home-role-icon inline-flex h-11 w-11 items-center justify-center rounded-2xl border">
            <CalendarDays className="h-[18px] w-[18px]" />
          </div>
          <div>
            <div className="ios-section-title">{language === 'CN' ? 'Your travel plans' : 'Your travel plans'}</div>
            <div className="ios-caption mt-1">
              {language === 'CN'
                ? '卡片仅展示基础信息。点击查看详情管理完整行程。'
                : 'Cards show essentials only. Tap view details for full trip management.'}
            </div>
          </div>
        </div>

        {summary ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-border/60 px-2.5 py-1 text-xs text-muted-foreground">
              {language === 'CN' ? `行程中 ${summary.counts.in_trip}` : `In trip ${summary.counts.in_trip}`}
            </span>
            <span className="rounded-full border border-border/60 px-2.5 py-1 text-xs text-muted-foreground">
              {language === 'CN' ? `即将出行 ${summary.counts.upcoming}` : `Upcoming ${summary.counts.upcoming}`}
            </span>
            <span className="rounded-full border border-border/60 px-2.5 py-1 text-xs text-muted-foreground">
              {language === 'CN' ? `已结束 ${summary.counts.completed}` : `Completed ${summary.counts.completed}`}
            </span>
            <span className="rounded-full border border-border/60 px-2.5 py-1 text-xs text-muted-foreground">
              {language === 'CN' ? `已归档 ${summary.counts.archived}` : `Archived ${summary.counts.archived}`}
            </span>
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {language === 'CN' ? '加载计划中...' : 'Loading plans...'}
            </div>
          ) : plans.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-background/40 px-3 py-4 text-sm text-muted-foreground">
              {language === 'CN'
                ? '还没有旅行计划。创建后会在这里展示摘要卡片。'
                : 'No travel plans yet. A summary card will appear here after creation.'}
            </div>
          ) : (
            plans.map((plan) => (
              <div key={plan.trip_id} className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[15px] font-semibold text-foreground">{plan.destination}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{buildDateRangeLabel(plan)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{getTimingLabel(plan, language)}</div>
                  </div>
                  <span className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                    {getStatusLabel(plan.status, language)}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-xl border border-border/60 bg-background/60 px-3 py-1.5 text-xs text-foreground"
                    onClick={() => openPlanInChat(plan)}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    {language === 'CN' ? 'Open in chat' : 'Open in chat'}
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-xl border border-border/60 bg-background/60 px-3 py-1.5 text-xs text-foreground disabled:opacity-60"
                    onClick={() => archivePlan(plan.trip_id)}
                    disabled={archivingTripId === plan.trip_id || plan.status === 'archived'}
                  >
                    {archivingTripId === plan.trip_id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Archive className="h-3.5 w-3.5" />
                    )}
                    {plan.status === 'archived'
                      ? language === 'CN'
                        ? '已归档'
                        : 'Archived'
                      : language === 'CN'
                        ? '归档'
                        : 'Archive'}
                  </button>
                  <button
                    type="button"
                    className="ml-auto inline-flex items-center gap-1 rounded-xl border border-border/60 bg-background/60 px-3 py-1.5 text-xs text-foreground"
                    onClick={() => openDetails(plan)}
                  >
                    {language === 'CN' ? '查看详情' : 'View details'}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
