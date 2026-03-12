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
import { DestinationDisambiguationDialog } from '@/components/travel/DestinationDisambiguationDialog';
import type { MobileShellContext } from '@/layouts/MobileShell';
import { useLanguage } from '@/contexts/LanguageContext';
import { t as tl } from '@/locales';
import type { Language } from '@/lib/types';
import {
  archiveTravelPlan,
  getDestinationAmbiguityPayload,
  getTravelPlanById,
  updateTravelPlan,
  type DestinationPlace,
  type TravelPlaceField,
  type TravelPlanCardModel,
  type UpdateTravelPlanInput,
} from '@/lib/travelPlansApi';

type EditDraft = {
  destination: string;
  departure_region: string;
  start_date: string;
  end_date: string;
  indoor_outdoor_ratio: string;
  itinerary: string;
};

type PlanDetailsRouteState = {
  plan?: TravelPlanCardModel | null;
};

type PendingDestinationSelection = {
  field: TravelPlaceField;
  normalizedQuery: string;
  candidates: DestinationPlace[];
  payload: UpdateTravelPlanInput;
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
  departure_region: String(plan?.departure_region || ''),
  start_date: String(plan?.start_date || ''),
  end_date: String(plan?.end_date || ''),
  indoor_outdoor_ratio:
    Number.isFinite(Number(plan?.indoor_outdoor_ratio)) && plan?.indoor_outdoor_ratio != null
      ? String(plan.indoor_outdoor_ratio)
      : '',
  itinerary: String(plan?.itinerary || ''),
});

const buildValidationError = (draft: EditDraft, language: Language): string | null => {
  if (!draft.destination.trim() || !draft.departure_region.trim() || !draft.start_date || !draft.end_date) {
    return tl('plans.validation.fill_required', language);
  }
  if (draft.start_date > draft.end_date) {
    return tl('plans.validation.date_order', language);
  }
  if (draft.indoor_outdoor_ratio.trim() && normalizeRatio(draft.indoor_outdoor_ratio) == null) {
    return tl('plans.validation.outdoor_ratio', language);
  }
  return null;
};

const buildTravelPlanSessionPatch = (plan: TravelPlanCardModel | null): Record<string, unknown> | undefined => {
  if (!plan) return undefined;
  const travelPlan: Record<string, unknown> = {
    destination: String(plan.destination || '').trim(),
    departure_region: String(plan.departure_region || '').trim(),
    start_date: String(plan.start_date || '').trim(),
    end_date: String(plan.end_date || '').trim(),
  };
  if (plan.destination_place && typeof plan.destination_place === 'object') {
    travelPlan.destination_place = plan.destination_place;
  }
  if (plan.departure_place && typeof plan.departure_place === 'object') {
    travelPlan.departure_place = plan.departure_place;
  }
  if (typeof plan.itinerary === 'string' && plan.itinerary.trim()) {
    travelPlan.itinerary = plan.itinerary.trim();
  }
  if (Number.isFinite(Number(plan.indoor_outdoor_ratio)) && plan.indoor_outdoor_ratio != null) {
    travelPlan.indoor_outdoor_ratio = Number(plan.indoor_outdoor_ratio);
  }
  if (typeof plan.trip_id === 'string' && plan.trip_id.trim()) {
    travelPlan.trip_id = plan.trip_id.trim();
  }
  if (!travelPlan.destination || !travelPlan.departure_region || !travelPlan.start_date || !travelPlan.end_date) return undefined;
  return { profile: { travel_plan: travelPlan } };
};

const hasDepartureInfo = (plan: { departure_region?: string | null } | null | undefined): boolean =>
  Boolean(String(plan?.departure_region || '').trim());

const getNeedsDepartureLabel = (language: Language): string =>
  tl('plan_details.needs_departure', language);

const getMissingDepartureMessage = (language: Language): string =>
  tl('plan_details.needs_departure_desc', language);

const getStatusLabel = (status: TravelPlanCardModel['status'], language: Language): string => {
  const map: Record<string, string> = { in_trip: 'plans.status.in_trip', upcoming: 'plans.status.upcoming', completed: 'plans.status.completed' };
  return tl(map[status] || 'plans.status.archived', language);
};

const getTimingLabel = (plan: TravelPlanCardModel, language: Language): string => {
  const daysToStart = Number.isFinite(Number(plan.days_to_start)) ? Number(plan.days_to_start) : null;
  const daysToEnd = Number.isFinite(Number(plan.days_to_end)) ? Number(plan.days_to_end) : null;

  if (plan.status === 'upcoming') {
    if (daysToStart == null) return tl('plans.status.starts_soon', language);
    if (daysToStart <= 0) return tl('plans.status.starts_today', language);
    return tl('plans.status.starts_in_days', language, { days: daysToStart });
  }
  if (plan.status === 'in_trip') {
    const dayIndex = daysToStart == null ? null : Math.max(1, Math.abs(daysToStart) + 1);
    if (dayIndex == null) return tl('plans.status.in_progress', language);
    return tl('plans.status.day_of_trip', language, { day: dayIndex });
  }
  if (plan.status === 'completed') {
    if (daysToEnd == null) return tl('plans.status.ended', language);
    const endedDays = Math.max(0, Math.abs(daysToEnd));
    return tl('plans.status.ended_days_ago', language, { days: endedDays });
  }
  return tl('plans.status.archived', language);
};

const formatDateRange = (plan: TravelPlanCardModel): string => `${plan.start_date} - ${plan.end_date}`;

export default function PlanDetails() {
  const { startChat } = useOutletContext<MobileShellContext>();
  const navigate = useNavigate();
  const params = useParams<{ tripId: string }>();
  const location = useLocation();
  const { language, t } = useLanguage();

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
  const [homeRegion, setHomeRegion] = useState('');
  const [draft, setDraft] = useState<EditDraft>(makeDraftFromPlan(initialPlan));
  const [pendingDestinationSelection, setPendingDestinationSelection] = useState<PendingDestinationSelection | null>(null);
  const [selectingDestination, setSelectingDestination] = useState(false);

  useEffect(() => {
    if (!tripId) {
      setPlan(null);
      setLoading(false);
      setError(t('plan_details.invalid_id'));
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
        setHomeRegion(typeof response.summary?.home_region === 'string' ? response.summary.home_region : '');
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

  useEffect(() => {
    if (!homeRegion) return;
    setDraft((prev) => (prev.departure_region.trim() ? prev : { ...prev, departure_region: homeRegion }));
  }, [homeRegion]);

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
      const payload: UpdateTravelPlanInput = {
        destination: draft.destination.trim(),
        departure_region: draft.departure_region.trim(),
        start_date: draft.start_date,
        end_date: draft.end_date,
        ...(normalizeRatio(draft.indoor_outdoor_ratio) != null
          ? { indoor_outdoor_ratio: normalizeRatio(draft.indoor_outdoor_ratio) as number }
          : { indoor_outdoor_ratio: undefined }),
        ...(draft.itinerary.trim() ? { itinerary: draft.itinerary.trim().slice(0, 1200) } : { itinerary: '' }),
      };
      const response = await updateTravelPlan(language, tripId, payload);

      const nextPlan = response.plan ?? null;
      setPlan(nextPlan);
      setDraft(makeDraftFromPlan(nextPlan));
      setEditing(false);
      setPendingDestinationSelection(null);
      toast({ title: t('plans.toast.updated') });
    } catch (err) {
      const ambiguity = getDestinationAmbiguityPayload(err);
      if (ambiguity) {
        setPendingDestinationSelection({
          field: ambiguity.field || 'destination',
          normalizedQuery: ambiguity.normalized_query || draft.destination.trim(),
          candidates: ambiguity.candidates,
          payload: {
            destination: draft.destination.trim(),
            departure_region: draft.departure_region.trim(),
            start_date: draft.start_date,
            end_date: draft.end_date,
            ...(normalizeRatio(draft.indoor_outdoor_ratio) != null
              ? { indoor_outdoor_ratio: normalizeRatio(draft.indoor_outdoor_ratio) as number }
              : { indoor_outdoor_ratio: undefined }),
            ...(draft.itinerary.trim() ? { itinerary: draft.itinerary.trim().slice(0, 1200) } : { itinerary: '' }),
          },
        });
        setError('');
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const submitDestinationSelection = async (candidate: DestinationPlace) => {
    if (!tripId || !pendingDestinationSelection) return;
    setSelectingDestination(true);
    setError('');
    try {
      const response = await updateTravelPlan(language, tripId, {
        ...pendingDestinationSelection.payload,
        ...(pendingDestinationSelection.field === 'departure'
          ? {
              departure_place: {
                ...candidate,
                resolution_source: 'user_selected',
              },
            }
          : {
              destination_place: {
                ...candidate,
                resolution_source: 'user_selected',
              },
            }),
      });
      const nextPlan = response.plan ?? null;
      setPlan(nextPlan);
      setDraft(makeDraftFromPlan(nextPlan));
      setEditing(false);
      setPendingDestinationSelection(null);
      toast({ title: t('plans.toast.updated') });
    } catch (err) {
      const ambiguity = getDestinationAmbiguityPayload(err);
      if (ambiguity) {
        setPendingDestinationSelection({
          field: ambiguity.field || pendingDestinationSelection.field,
          normalizedQuery: ambiguity.normalized_query || pendingDestinationSelection.normalizedQuery,
          candidates: ambiguity.candidates,
          payload: pendingDestinationSelection.payload,
        });
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSelectingDestination(false);
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
      toast({ title: t('plans.toast.archived') });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setArchiving(false);
    }
  };

  const onOpenInChat = () => {
    if (!plan) return;
    if (!hasDepartureInfo(plan)) {
      const nextError = getMissingDepartureMessage(language);
      setError(nextError);
      setEditing(true);
      toast({ title: getNeedsDepartureLabel(language) });
      return;
    }
    const query =
      language === 'CN'
        ? `请根据我从 ${plan.departure_region} 前往 ${plan.destination}（${plan.start_date} 到 ${plan.end_date}）的行程，给我一套护肤建议。`
        : `Please build a skincare travel plan for a trip from ${plan.departure_region} to ${plan.destination} from ${plan.start_date} to ${plan.end_date}.`;

    startChat({
      kind: 'query',
      title: t('plan_details.chat_title', { destination: plan.destination }),
      query,
      ...(buildTravelPlanSessionPatch(plan) ? { session_patch: buildTravelPlanSessionPatch(plan) } : {}),
    });
  };

  const checklist = Array.isArray(plan?.prep_checklist) ? plan.prep_checklist : [];

  return (
    <div className="ios-page">
      <DestinationDisambiguationDialog
        open={Boolean(pendingDestinationSelection)}
        language={language}
        field={pendingDestinationSelection?.field || 'destination'}
        normalizedQuery={pendingDestinationSelection?.normalizedQuery || ''}
        candidates={pendingDestinationSelection?.candidates || []}
        submitting={selectingDestination}
        onSelect={submitDestinationSelection}
        onOpenChange={(open) => {
          if (open || selectingDestination) return;
          setPendingDestinationSelection(null);
        }}
      />
      <div className="ios-page-header">
        <button type="button" onClick={onBack} className="ios-nav-button" aria-label={t('plan_details.back')}>
          <ArrowLeft className="h-[18px] w-[18px]" />
        </button>
        <div className="ios-page-title">{t('plans.title')}</div>
        <div className="ios-header-spacer" />
      </div>

      {loading ? (
        <div className="ios-panel mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('plan_details.loading')}
        </div>
      ) : !plan ? (
        <div className="ios-panel mt-4 space-y-3">
          <div className="text-sm text-foreground">{t('plan_details.not_found')}</div>
          {error ? <div className="text-xs text-red-500">{error}</div> : null}
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-xl border border-border/60 px-3 py-1.5 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('plan_details.back')}
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
                <div className="mt-1 text-xs text-muted-foreground">
                  {hasDepartureInfo(plan)
                    ? `${t('plans.form.departure')}: ${plan.departure_region}`
                    : getNeedsDepartureLabel(language)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{getTimingLabel(plan, language)}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                  {getStatusLabel(plan.status, language)}
                </span>
                {!hasDepartureInfo(plan) ? (
                  <span className="rounded-full border border-amber-400/60 bg-amber-50/60 px-2 py-0.5 text-[11px] text-amber-700">
                    {getNeedsDepartureLabel(language)}
                  </span>
                ) : null}
              </div>
            </div>

            {!hasDepartureInfo(plan) ? (
              <div className="mt-4 rounded-2xl border border-amber-400/60 bg-amber-50/40 p-3 text-sm text-amber-800">
                {getMissingDepartureMessage(language)}
              </div>
            ) : null}

            <div className="mt-4 space-y-3 rounded-2xl border border-border/60 bg-background/60 p-3">
              <div className="text-xs font-semibold text-foreground">{t('plans.form.itinerary')}</div>
              <div className="text-sm text-muted-foreground">
                {plan.itinerary?.trim()
                  ? plan.itinerary
                  : t('plan_details.no_itinerary')}
              </div>
            </div>

            <div className="mt-3 space-y-3 rounded-2xl border border-border/60 bg-background/60 p-3">
              <div className="text-xs font-semibold text-foreground">{t('plans.prep_checklist')}</div>
              {checklist.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  {t('plan_details.no_checklist')}
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
                {t('plans.btn.open_chat')}
              </button>

              <button
                type="button"
                onClick={() => setEditing((prev) => !prev)}
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm"
              >
                <Pencil className="h-4 w-4" />
                {editing ? t('plan_details.cancel_edit') : t('plans.btn.edit')}
              </button>

              <button
                type="button"
                onClick={onArchive}
                disabled={archiving || plan.status === 'archived'}
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm disabled:opacity-60"
              >
                {archiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                {plan.status === 'archived' ? t('plans.status.archived') : t('plans.btn.archive')}
              </button>
            </div>
          </div>

          {editing ? (
            <div className="ios-panel mt-4">
              <div className="mb-3 text-sm font-semibold text-foreground">{t('plan_details.edit_plan')}</div>
              <div className="space-y-3">
                <label className="block">
                  <div className="mb-1 text-xs text-muted-foreground">{t('plans.form.destination')}</div>
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

                <label className="block">
                  <div className="mb-1 text-xs text-muted-foreground">{t('plans.form.departure')}</div>
                  <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-3 py-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={draft.departure_region}
                      onChange={(e) => setDraft((prev) => ({ ...prev, departure_region: e.target.value }))}
                      className="h-6 w-full bg-transparent text-sm text-foreground outline-none"
                      placeholder={homeRegion || t('plans.form.departure_placeholder')}
                    />
                  </div>
                </label>

                <div className="travel-date-grid">
                  <label className="block">
                    <div className="mb-1 text-xs text-muted-foreground">{t('plans.form.start_date')}</div>
                    <input
                      type="date"
                      value={draft.start_date}
                      onChange={(e) => setDraft((prev) => ({ ...prev, start_date: e.target.value }))}
                      className="travel-date-input h-10 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground outline-none"
                    />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-xs text-muted-foreground">{t('plans.form.end_date')}</div>
                    <input
                      type="date"
                      value={draft.end_date}
                      onChange={(e) => setDraft((prev) => ({ ...prev, end_date: e.target.value }))}
                      className="travel-date-input h-10 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground outline-none"
                    />
                  </label>
                </div>

                <label className="block">
                  <div className="mb-1 text-xs text-muted-foreground">
                    {t('plans.form.outdoor_ratio')}
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
                  <div className="mb-1 text-xs text-muted-foreground">{t('plans.form.itinerary')}</div>
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
                {saving ? t('plans.form.saving') : t('plans.form.save_changes')}
              </button>
            </div>
          ) : null}

          {!editing && error ? <div className="mt-3 text-xs text-red-500">{error}</div> : null}
        </>
      )}
    </div>
  );
}
