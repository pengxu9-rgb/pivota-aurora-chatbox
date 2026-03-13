import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPinned,
  MessageCircle,
  Sparkles,
  User,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  getActivityDetail,
  type ActivityDetailAction,
  type ActivityDetailResponse,
} from '@/lib/activityApi';
import { formatActivitySubtitle, formatActivityTitle } from '@/lib/activityPresentation';
import { getLangPref } from '@/lib/persistence';

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function metricText(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'N/A';
  return String(n);
}

function openDeeplink(deeplink: string, navigate: (to: string) => void) {
  const target = String(deeplink || '').trim();
  if (!target) return;
  if (target.startsWith('/')) {
    navigate(target);
    return;
  }
  if (/^https?:\/\//i.test(target) && typeof window !== 'undefined') {
    window.open(target, '_blank', 'noopener,noreferrer');
  }
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[24px] border border-[hsl(var(--aurora-home-border)/0.72)] bg-[hsl(var(--aurora-home-card)/var(--aurora-home-glass-alpha))] p-4 shadow-card">
      <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--aurora-home-muted-foreground))]">{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--aurora-home-border)/0.5)] bg-white/50 px-3 py-2">
      <div className="text-[11px] text-[hsl(var(--aurora-home-muted-foreground))]">{label}</div>
      <div className="mt-0.5 text-[14px] font-semibold text-[hsl(var(--aurora-home-foreground))]">{value}</div>
    </div>
  );
}

function TagList({ values }: { values: string[] }) {
  if (!values.length) return <div className="text-[13px] text-[hsl(var(--aurora-home-muted-foreground))]">None</div>;
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <span
          key={value}
          className="rounded-full bg-[hsl(var(--aurora-home-primary)/0.1)] px-3 py-1 text-[12px] font-medium text-[hsl(var(--aurora-home-primary))]"
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function KeyValueList({ entries }: { entries: Array<[string, string]> }) {
  if (!entries.length) return <div className="text-[13px] text-[hsl(var(--aurora-home-muted-foreground))]">No details</div>;
  return (
    <div className="space-y-2">
      {entries.map(([label, value]) => (
        <div key={label} className="flex items-start justify-between gap-3 border-b border-[hsl(var(--aurora-home-border)/0.32)] pb-2 last:border-b-0 last:pb-0">
          <div className="text-[12px] text-[hsl(var(--aurora-home-muted-foreground))]">{label}</div>
          <div className="max-w-[68%] text-right text-[13px] font-medium text-[hsl(var(--aurora-home-foreground))]">{value}</div>
        </div>
      ))}
    </div>
  );
}

function ActionButtons({ actions, navigate }: { actions: ActivityDetailAction[]; navigate: (to: string) => void }) {
  if (!actions.length) return null;
  return (
    <div className="grid gap-2">
      {actions.map((action) => (
        <button
          key={action.action_id}
          type="button"
          className={
            action.variant === 'primary'
              ? 'inline-flex items-center justify-between rounded-2xl bg-[hsl(var(--aurora-home-primary))] px-4 py-3 text-[14px] font-semibold text-[hsl(var(--aurora-home-primary-foreground))]'
              : 'inline-flex items-center justify-between rounded-2xl border border-[hsl(var(--aurora-home-border)/0.72)] px-4 py-3 text-[14px] font-semibold text-[hsl(var(--aurora-home-foreground))]'
          }
          onClick={() => openDeeplink(action.deeplink, navigate)}
        >
          <span>{action.label}</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

function SkinAnalysisSnapshot({ snapshot }: { snapshot: Record<string, unknown> }) {
  const sourceMix = asArray(snapshot.source_mix).map(asString).filter(Boolean);
  const goals = asArray(snapshot.goals).map(asString).filter(Boolean);
  const concerns = asArray(snapshot.concerns).map(asString).filter(Boolean);
  const plan = asObject(snapshot.ingredient_plan);
  const targets = asArray(plan.targets)
    .map((item) => asObject(item))
    .map((item) => [asString(item.ingredient_name), asString(item.why)].filter(Boolean).join(' - '))
    .filter(Boolean);
  const avoid = asArray(plan.avoid)
    .map((item) => asObject(item))
    .map((item) => [asString(item.ingredient_name), asString(item.why)].filter(Boolean).join(' - '))
    .filter(Boolean);
  const conflicts = asArray(plan.conflicts).map(asString).filter(Boolean);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <MetricChip label="Skin type" value={asString(snapshot.skin_type) || 'N/A'} />
        <MetricChip label="Barrier" value={asString(snapshot.barrier_status) || 'N/A'} />
        <MetricChip label="Sensitivity" value={asString(snapshot.sensitivity) || 'N/A'} />
        <MetricChip label="Confidence" value={asString(snapshot.confidence_level) || 'N/A'} />
      </div>
      <KeyValueList
        entries={[
          ['Analysis source', asString(snapshot.analysis_source) || 'Unknown'],
          ['Photo usage', snapshot.used_photos === true ? 'Used photos' : 'No-photo / fallback'],
          ['Photo quality', asString(snapshot.quality_grade) || 'Unknown'],
          ['Photos submitted', metricText(snapshot.photos_count)],
        ]}
      />
      <div>
        <div className="mb-2 text-[12px] font-semibold text-[hsl(var(--aurora-home-muted-foreground))]">Goals</div>
        <TagList values={goals} />
      </div>
      {concerns.length ? (
        <div>
          <div className="mb-2 text-[12px] font-semibold text-[hsl(var(--aurora-home-muted-foreground))]">Concerns</div>
          <TagList values={concerns} />
        </div>
      ) : null}
      {sourceMix.length ? (
        <div>
          <div className="mb-2 text-[12px] font-semibold text-[hsl(var(--aurora-home-muted-foreground))]">Evidence mix</div>
          <TagList values={sourceMix} />
        </div>
      ) : null}
      {(targets.length || avoid.length || conflicts.length) ? (
        <div className="space-y-3 rounded-2xl bg-white/45 p-3">
          <div className="text-[13px] font-semibold text-[hsl(var(--aurora-home-foreground))]">Ingredient plan</div>
          <KeyValueList
            entries={[
              ['Intensity', asString(plan.intensity) || 'N/A'],
              ['Targets', targets.join(', ') || 'None'],
              ['Avoid', avoid.join(', ') || 'None'],
              ['Conflicts', conflicts.join(', ') || 'None'],
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}

function TrackerSnapshot({ snapshot }: { snapshot: Record<string, unknown> }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <MetricChip label="Date" value={asString(snapshot.date) || 'N/A'} />
        <MetricChip label="Routine" value={asString(snapshot.routine_id) || 'N/A'} />
        <MetricChip label="Redness" value={metricText(snapshot.redness)} />
        <MetricChip label="Acne" value={metricText(snapshot.acne)} />
        <MetricChip label="Hydration" value={metricText(snapshot.hydration)} />
        <MetricChip label="Notes" value={snapshot.has_notes === true ? 'Yes' : 'No'} />
      </div>
      <KeyValueList
        entries={[
          ['Target product', asString(snapshot.target_product) || 'N/A'],
          ['Sensation', asString(snapshot.sensation) || 'N/A'],
          ['Notes', asString(snapshot.notes_excerpt) || 'No notes'],
        ]}
      />
    </div>
  );
}

function ProfileSnapshot({ snapshot }: { snapshot: Record<string, unknown> }) {
  const changedFields = asArray(snapshot.changed_fields).map(asString).filter(Boolean);
  const values = asObject(snapshot.values);
  const entries = Object.entries(values)
    .map(([key, value]) => {
      if (Array.isArray(value)) return [key, value.map(asString).filter(Boolean).join(', ') || 'None'] as [string, string];
      if (value && typeof value === 'object') return [key, JSON.stringify(value)] as [string, string];
      return [key, String(value ?? 'Not set')] as [string, string];
    });

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-2 text-[12px] font-semibold text-[hsl(var(--aurora-home-muted-foreground))]">Changed fields</div>
        <TagList values={changedFields} />
      </div>
      <KeyValueList entries={entries} />
    </div>
  );
}

function TravelPlanSnapshot({ snapshot }: { snapshot: Record<string, unknown> }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <MetricChip label="Destination" value={asString(snapshot.destination) || 'N/A'} />
        <MetricChip label="Status" value={snapshot.is_archived === true ? 'Archived' : 'Active'} />
        <MetricChip label="Start" value={asString(snapshot.start_date) || 'N/A'} />
        <MetricChip label="End" value={asString(snapshot.end_date) || 'N/A'} />
      </div>
      <KeyValueList
        entries={[
          ['Trip ID', asString(snapshot.trip_id) || 'N/A'],
          ['Itinerary', asString(snapshot.itinerary) || 'N/A'],
          ['Indoor / outdoor', snapshot.indoor_outdoor_ratio == null ? 'N/A' : String(snapshot.indoor_outdoor_ratio)],
        ]}
      />
    </div>
  );
}

function ChatStartedSnapshot({ snapshot }: { snapshot: Record<string, unknown> }) {
  return (
    <KeyValueList
      entries={[
        ['Title', asString(snapshot.title) || 'New chat'],
        ['Entry chip', asString(snapshot.chip_id) || 'N/A'],
        ['Open target', asString(snapshot.open) || 'N/A'],
        ['Contains query', snapshot.has_query === true ? 'Yes' : 'No'],
      ]}
    />
  );
}

function ActivityIcon({ kind }: { kind: string }) {
  if (kind === 'skin_analysis') return <Sparkles className="h-5 w-5" />;
  if (kind === 'tracker_logged') return <Clock3 className="h-5 w-5" />;
  if (kind === 'profile_updated') return <User className="h-5 w-5" />;
  if (kind === 'travel_plan') return <MapPinned className="h-5 w-5" />;
  return <MessageCircle className="h-5 w-5" />;
}

export default function ActivityDetailPage() {
  const navigate = useNavigate();
  const { activityId = '' } = useParams();
  const [data, setData] = useState<ActivityDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const language = getLangPref() === 'cn' ? 'CN' : 'EN';
    setLoading(true);
    setError(null);
    void getActivityDetail(language, activityId)
      .then((response) => {
        if (cancelled) return;
        setData(response);
      })
      .catch(() => {
        if (cancelled) return;
        setData(null);
        setError('Failed to load activity details.');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activityId]);

  const item = data?.item || null;
  const detail = data?.detail || null;
  const snapshot = asObject(detail?.snapshot);

  return (
    <div className="font-aurora-body bg-[hsl(var(--aurora-home-background))] px-[var(--aurora-page-x)] pb-8 pt-[var(--aurora-page-top)] text-[hsl(var(--aurora-home-foreground))]">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[hsl(var(--aurora-home-border)/0.72)] bg-[hsl(var(--aurora-home-card)/var(--aurora-home-glass-alpha))]"
          onClick={() => navigate('/activity')}
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="font-aurora-heading text-[18px] font-semibold tracking-[-0.02em]">Activity detail</div>
        <div className="h-10 w-10" />
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <DetailSection title="Loading">
            <div className="text-[13px] text-[hsl(var(--aurora-home-muted-foreground))]">Loading activity details...</div>
          </DetailSection>
        ) : error || !item || !detail ? (
          <DetailSection title="Unavailable">
            <div className="text-[13px] text-[hsl(var(--aurora-home-muted-foreground))]">{error || 'Activity detail is unavailable.'}</div>
          </DetailSection>
        ) : (
          <>
            <div className="rounded-[28px] border border-[hsl(var(--aurora-home-border)/0.72)] bg-[linear-gradient(180deg,hsl(var(--aurora-home-card)),hsl(var(--aurora-home-card)/0.84))] p-4 shadow-card">
              <div className="flex items-start gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--aurora-home-primary)/0.12)] text-[hsl(var(--aurora-home-primary))]">
                  <ActivityIcon kind={detail.kind} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] text-[hsl(var(--aurora-home-muted-foreground))]">{formatActivitySubtitle(item)}</div>
                  <div className="mt-1 text-[20px] font-semibold tracking-[-0.03em] text-[hsl(var(--aurora-home-foreground))]">
                    {formatActivityTitle(item)}
                  </div>
                </div>
              </div>
            </div>

            <DetailSection title="Snapshot">
              {detail.kind === 'skin_analysis' ? <SkinAnalysisSnapshot snapshot={snapshot} /> : null}
              {detail.kind === 'tracker_logged' ? <TrackerSnapshot snapshot={snapshot} /> : null}
              {detail.kind === 'profile_updated' ? <ProfileSnapshot snapshot={snapshot} /> : null}
              {detail.kind === 'travel_plan' ? <TravelPlanSnapshot snapshot={snapshot} /> : null}
              {detail.kind === 'chat_started' ? <ChatStartedSnapshot snapshot={snapshot} /> : null}
            </DetailSection>

            <DetailSection title="Actions">
              <ActionButtons actions={detail.actions || []} navigate={navigate} />
            </DetailSection>
          </>
        )}
      </div>
    </div>
  );
}
