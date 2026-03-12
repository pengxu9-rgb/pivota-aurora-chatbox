import type { Language } from './types';

export type QuickProfileStatus = 'incomplete' | 'complete_guest' | 'complete_signed';

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const asGoals = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => asString(item)).filter(Boolean);
  }
  const one = asString(value);
  return one ? [one] : [];
};

export function isQuickProfileComplete(profile: Record<string, unknown> | null | undefined): boolean {
  const p = asObject(profile);
  if (!p) return false;

  const skinType = asString(p.skinType);
  const sensitivity = asString(p.sensitivity);
  const goals = asGoals(p.goals);

  return Boolean(skinType) && Boolean(sensitivity) && goals.length > 0;
}

export function deriveQuickProfileStatus(
  profile: Record<string, unknown> | null | undefined,
  isSignedIn: boolean,
): QuickProfileStatus {
  if (!isQuickProfileComplete(profile)) return 'incomplete';
  return isSignedIn ? 'complete_signed' : 'complete_guest';
}

export function formatQuickProfileSummary(
  profile: Record<string, unknown> | null | undefined,
  language: Language,
): string {
  const p = asObject(profile);
  if (!p) return language === 'CN' ? '未填写快速画像。' : 'Quick profile not completed yet.';

  const ageBand = asString((p as any).age_band || (p as any).ageBand);
  const budget = asString(p.budgetTier);
  const region = asString(p.region || (p as any).home_region || (p as any).homeRegion);
  const meds = Array.isArray((p as any).high_risk_medications)
    ? (p as any).high_risk_medications.map((m: unknown) => asString(m)).filter(Boolean).slice(0, 3).join(', ')
    : '';

  const parts: string[] = [];
  if (language === 'CN') {
    if (ageBand && ageBand !== 'unknown') parts.push(`年龄：${ageBand}`);
    if (budget) parts.push(`预算：${budget}`);
    if (region) parts.push(`地区：${region}`);
    if (meds) parts.push(`用药：${meds}`);
    return parts.length ? parts.join(' · ') : '尚未填写补充信息。';
  }
  if (ageBand && ageBand !== 'unknown') parts.push(`Age: ${ageBand}`);
  if (budget) parts.push(`Budget: ${budget}`);
  if (region) parts.push(`Region: ${region}`);
  if (meds) parts.push(`Meds: ${meds}`);
  return parts.length ? parts.join(' · ') : 'No additional info yet.';
}

