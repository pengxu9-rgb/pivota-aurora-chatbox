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

  const skinType = asString(p.skinType) || '—';
  const sensitivity = asString(p.sensitivity) || '—';
  const goals = asGoals(p.goals);
  const goalsText = goals.length ? goals.slice(0, 3).join(', ') : '—';

  if (language === 'CN') {
    return `肤质：${skinType} · 敏感：${sensitivity} · 目标：${goalsText}`;
  }
  return `Skin: ${skinType} · Sensitivity: ${sensitivity} · Goals: ${goalsText}`;
}

