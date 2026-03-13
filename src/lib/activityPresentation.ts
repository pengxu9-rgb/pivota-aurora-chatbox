import type { ActivityItem } from '@/lib/activityApi';

export function formatRelativeTime(occurredAtMs: number): string {
  const deltaMs = Date.now() - Number(occurredAtMs || 0);
  if (!Number.isFinite(deltaMs)) return 'Just now';
  const deltaSeconds = Math.max(0, Math.floor(deltaMs / 1000));
  if (deltaSeconds < 60) return 'Just now';
  const minutes = Math.floor(deltaSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(occurredAtMs).toLocaleDateString();
}

export function formatActivityTitle(item: ActivityItem): string {
  switch (item.event_type) {
    case 'chat_started':
      return 'Started a chat';
    case 'skin_analysis':
      return 'Completed skin analysis';
    case 'tracker_logged':
      return 'Logged a check-in';
    case 'profile_updated':
      return 'Updated profile';
    case 'travel_plan_created':
      return 'Created a travel plan';
    case 'travel_plan_updated':
      return 'Updated a travel plan';
    case 'travel_plan_archived':
      return 'Archived a travel plan';
    default:
      return 'Activity';
  }
}

export function formatActivitySubtitle(item: ActivityItem): string {
  const payload = item.payload && typeof item.payload === 'object' ? item.payload : {};
  if (item.event_type === 'skin_analysis') {
    const usedPhotos = payload.used_photos === true;
    const failureCode = typeof payload.photo_failure_code === 'string' ? payload.photo_failure_code.trim() : '';
    if (usedPhotos) return `Photo-based analysis · ${formatRelativeTime(item.occurred_at_ms)}`;
    if (failureCode) return `No-photo (${failureCode}) · ${formatRelativeTime(item.occurred_at_ms)}`;
    return `No-photo analysis · ${formatRelativeTime(item.occurred_at_ms)}`;
  }
  if (
    (item.event_type === 'travel_plan_created' || item.event_type === 'travel_plan_updated' || item.event_type === 'travel_plan_archived') &&
    typeof payload.destination === 'string' &&
    payload.destination.trim()
  ) {
    return `${payload.destination.trim()} · ${formatRelativeTime(item.occurred_at_ms)}`;
  }
  if (item.event_type === 'tracker_logged' && typeof payload.date === 'string' && payload.date.trim()) {
    return `${payload.date.trim()} · ${formatRelativeTime(item.occurred_at_ms)}`;
  }
  return formatRelativeTime(item.occurred_at_ms);
}

export function isResultActivity(item: ActivityItem): boolean {
  return item.event_type !== 'chat_started';
}

export function prioritizeRecentActivity(items: ActivityItem[], limit: number): ActivityItem[] {
  const list = Array.isArray(items) ? items : [];
  const resultFirst = list.filter(isResultActivity);
  const fallback = list.filter((item) => !isResultActivity(item));
  return [...resultFirst, ...fallback].slice(0, Math.max(1, limit));
}

export function resolveActivityNavigationTarget(item: ActivityItem): string | null {
  if (item.detail_available && item.activity_id) {
    return `/activity/${encodeURIComponent(item.activity_id)}`;
  }
  const deeplink = String(item.deeplink || '').trim();
  return deeplink || null;
}

export function openActivityItem(item: ActivityItem, navigate: (to: string) => void) {
  const target = resolveActivityNavigationTarget(item);
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
