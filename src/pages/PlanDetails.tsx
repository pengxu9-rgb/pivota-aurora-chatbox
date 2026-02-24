import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowLeft,
  CalendarDays,
  Loader2,
  MapPin,
  MessageCircle,
  Pencil,
  Save,
} from 'lucide-react';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';

import { toast } from '@/components/ui/use-toast';
import type { MobileShellContext } from '@/layouts/MobileShell';
import { getLangPref } from '@/lib/persistence';
import type { Language } from '@/lib/pivotaAgentBff';
import {
  archiveTravelPlan,
  getTravelPlanById,
  updateTravelPlan,
  type TravelPlanCardModel,
} from '@/lib/travelPlansApi';

type EditDraft = {
  destination: string;
  start_date: string;
  end_date: string;
  indoor_outdoor_ratio: string;
  itinerary: string;
};

type PlanDetailsRouteState = {
  plan?: TravelPlanCardModel | null;
};

const normalizeRatio = (raw: string): number | null => {
  const token = String(raw || '').trim();
  if (!token) return null;
  const n = Number(token);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1, n));
};

const makeDraftFromPlan = (plan: TravelPlanCardModel | null): EditDraft => ({
  destination: String(plan?.destination || ''),
  start_date: String(plan?.start_date || ''),
  end_date: String(plan?.end_date || ''),
  indoor_outdoor_ratio:
    Number.isFinite(Number(plan?.indoor_outdoor_ratio)) && plan?.indoor_outdoor_ratio != null
      ? String(plan.indoor_outdoor_ratio)
      : '',
  itinerary: String(plan?.itinerary || ''),
});

const buildValidationError = (draft: EditDraft, language: Language): string | null => {
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

const formatDateRange = (plan: TravelPlanCardModel): string => `${plan.start_date} - ${plan.end_date}`;

export default function PlanDetails() {
  const { startChat } = useOutletContext<MobileShellContext>();
  const navigate = useNavigate();
  const params = useParams<{ tripId: string }>();
  const location = useLocation();
  const language: Language = useMemo(() => (getLangPref() === 'cn' ? 'CN' : 'EN'), []);

  const tripId = useMemo(() => String(params.tripId || '').trim(), [params.tripId]);
  const routeState = (location.state as PlanDetailsRouteState | null) ?? null;
  const routePlan = routeState?.plan ?? null;
  const initialPlan = useMemo(() => {
    if (!routePlan) return null;
    if (String(routePlan.trip_id || '').trim() !== tripId) return null;
    return routePlan;
  }, [routePlan, tripId]);

  const [plan, setPlan] = useState<TravelPlanCardModel | null>(initialPlan);
  const [loading, setLoading] = useState(!initialPlan);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<EditDraft>(makeDraftFromPlan(initialPlan));

  useEffect(() => {
    if (!tripId) {
      setPlan(null);
      setLoading(false);
      setError(language === 'CN' ? '计划 ID 无效。' : 'Invalid plan id.');
      return;
    }

    if (initialPlan) {
      setPlan(initialPlan);
      setDraft(makeDraftFromPlan(initialPlan));
      setLoading(false);
      setError('');
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await getTravelPlanById(language, tripId);
        if (cancelled) return;
        setPlan(response.plan ?? null);
        setDraft(makeDraftFromPlan(response.plan ?? null));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [initialPlan, language, tripId]);

  const onBack = () => {
    navigate('/plans');
  };

  const onSaveEdit = async () => {
    if (!plan || !tripId) return;
    setError('');
    const validationError = buildValidationError(draft, language);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      const response = await updateTravelPlan(language, tripId, {
        destination: draft.destination.trim(),
        start_date: draft.start_date,
        end_date: draft.end_date,
        ...(normalizeRatio(draft.indoor_outdoor_ratio) != null
          ? { indoor_outdoor_ratio: normalizeRatio(draft.indoor_outdoor_ratio) as number }
          : { indoor_outdoor_ratio: undefined }),
        ...(draft.itinerary.trim() ? { itinerary: draft.itinerary.trim().slice(0, 1200) } : { itinerary: '' }),
      });

      const nextPlan = response.plan ?? null;
      setPlan(nextPlan);
      setDraft(makeDraftFromPlan(nextPlan));
      setEditing(false);
      toast({ title: language === 'CN' ? '计划已更新' : 'Plan updated' });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const onArchive = async () => {
    if (!plan || !tripId) return;
    setError('');
    try {
      setArchiving(true);
      const response = await archiveTravelPlan(language, tripId);
      const archivedPlan =
        response.plan ??
        ({
          ...plan,
          status: 'archived',
          is_archived: true,
          archived_at_ms: Date.now(),
        } as TravelPlanCardModel);
      setPlan(archivedPlan);
      setDraft(makeDraftFromPlan(archivedPlan));
      setEditing(false);
      toast({ title: language === 'CN' ? '计划已归档' : 'Plan archived' });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setArchiving(false);
    }
  };

  const onOpenInChat = () => {
    if (!plan) return;
    const query =
      language === 'CN'
        ? `请根据我在 ${plan.destination}（${plan.start_date} 到 ${plan.end_date}）的行程，给我一套护肤建议。`
        : `Please build a skincare travel plan for ${plan.destination} from ${plan.start_date} to ${plan.end_date}.`;

    startChat({
      kind: 'query',
      title: language === 'CN' ? `旅行护肤：${plan.destination}` : `Travel skincare: ${plan.destination}`,
      query,
    });
  };

  const checklist = Array.isArray(plan?.prep_checklist) ? plan.prep_checklist : [];

  return (
    <div className="ios-page">
      <div className="ios-page-header">
        <button type="button" onClick={onBack} className="ios-nav-button" aria-label={language === 'CN' ? '返回计划' : 'Back to plans'}>
          <ArrowLeft className="h-[18px] w-[18px]" />
        </button>
        <div className="ios-page-title">{language === 'CN' ? 'Trip details' : 'Trip details'}</div>
        <div className="ios-header-spacer" />
      </div>

      {loading ? (
        <div className="ios-panel mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {language === 'CN' ? '加载详情中...' : 'Loading details...'}
        </div>
      ) : !plan ? (
        <div className="ios-panel mt-4 space-y-3">
          <div className="text-sm text-foreground">{language === 'CN' ? '未找到该行程。' : 'Plan not found.'}</div>
          {error ? <div className="text-xs text-red-500">{error}</div> : null}
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-xl border border-border/60 px-3 py-1.5 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            {language === 'CN' ? '返回计划列表' : 'Back to plans'}
          </button>
        </div>
      ) : (
        <>
          <div className="ios-panel mt-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[18px] font-semibold text-foreground">{plan.destination}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>{formatDateRange(plan)}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{getTimingLabel(plan, language)}</div>
              </div>
              <span className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                {getStatusLabel(plan.status, language)}
              </span>
            </div>

            <div className="mt-4 space-y-3 rounded-2xl border border-border/60 bg-background/60 p-3">
              <div className="text-xs font-semibold text-foreground">{language === 'CN' ? 'Itinerary' : 'Itinerary'}</div>
              <div className="text-sm text-muted-foreground">
                {plan.itinerary?.trim()
                  ? plan.itinerary
                  : language === 'CN'
                    ? '暂无详细行程备注。'
                    : 'No itinerary details yet.'}
              </div>
            </div>

            <div className="mt-3 space-y-3 rounded-2xl border border-border/60 bg-background/60 p-3">
              <div className="text-xs font-semibold text-foreground">{language === 'CN' ? 'Prep checklist' : 'Prep checklist'}</div>
              {checklist.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  {language === 'CN' ? '暂无建议清单。' : 'No checklist available.'}
                </div>
              ) : (
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {checklist.map((item, idx) => (
                    <li key={`${idx}_${item}`} className="flex gap-2">
                      <span aria-hidden="true">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={onOpenInChat}
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm"
              >
                <MessageCircle className="h-4 w-4" />
                {language === 'CN' ? '在聊天中打开' : 'Open in chat'}
              </button>

              <button
                type="button"
                onClick={() => setEditing((prev) => !prev)}
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm"
              >
                <Pencil className="h-4 w-4" />
                {editing ? (language === 'CN' ? '取消编辑' : 'Cancel edit') : language === 'CN' ? '编辑' : 'Edit'}
              </button>

              <button
                type="button"
                onClick={onArchive}
                disabled={archiving || plan.status === 'archived'}
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm disabled:opacity-60"
              >
                {archiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                {plan.status === 'archived'
                  ? language === 'CN'
                    ? '已归档'
                    : 'Archived'
                  : language === 'CN'
                    ? '归档'
                    : 'Archive'}
              </button>
            </div>
          </div>

          {editing ? (
            <div className="ios-panel mt-4">
              <div className="mb-3 text-sm font-semibold text-foreground">{language === 'CN' ? '编辑计划' : 'Edit plan'}</div>
              <div className="space-y-3">
                <label className="block">
                  <div className="mb-1 text-xs text-muted-foreground">{language === 'CN' ? '目的地' : 'Destination'}</div>
                  <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-3 py-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={draft.destination}
                      onChange={(e) => setDraft((prev) => ({ ...prev, destination: e.target.value }))}
                      className="h-6 w-full bg-transparent text-sm text-foreground outline-none"
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
                  <div className="mb-1 text-xs text-muted-foreground">
                    {language === 'CN' ? '户外比例（0-1，可选）' : 'Outdoor ratio (0-1, optional)'}
                  </div>
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
                  <div className="mb-1 text-xs text-muted-foreground">{language === 'CN' ? '行程备注' : 'Itinerary'}</div>
                  <textarea
                    value={draft.itinerary}
                    onChange={(e) => setDraft((prev) => ({ ...prev, itinerary: e.target.value }))}
                    className="min-h-[92px] w-full resize-none rounded-2xl border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground outline-none"
                  />
                </label>
              </div>

              {error ? <div className="mt-3 text-xs text-red-500">{error}</div> : null}

              <button
                type="button"
                className="aurora-home-role-primary mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-[14px] font-semibold shadow-card active:scale-[0.99] disabled:opacity-70"
                onClick={onSaveEdit}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? (language === 'CN' ? '保存中...' : 'Saving...') : language === 'CN' ? '保存修改' : 'Save changes'}
              </button>
            </div>
          ) : null}

          {!editing && error ? <div className="mt-3 text-xs text-red-500">{error}</div> : null}
        </>
      )}
    </div>
  );
}
