export type AuroraProfile = {
  skinType: string | null;
  sensitivity: string | null;
  barrierStatus: string | null;
  goals: string[];
  region: string | null;
  budgetTier: string | null;
  age_band: string;
  pregnancy_status: string;
  lactation_status: string;
  high_risk_medications: string[];
  displayName: string | null;
  avatarUrl: string | null;
};

export type FullProfileDraft = {
  skinType: string;
  sensitivity: string;
  barrierStatus: string;
  goals: string[];
  region: string;
  budgetTier: string;
  age_band: string;
  pregnancy_status: string;
  lactation_status: string;
  high_risk_medications_text: string;
};

type ProfilePatchDraft = Partial<
  FullProfileDraft & {
    displayName: string;
    avatarUrl: string;
    high_risk_medications: string[];
  }
>;

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};

const firstString = (obj: Record<string, unknown>, ...keys: string[]): string => {
  for (const key of keys) {
    const value = asString(obj[key]);
    if (value) return value;
  }
  return '';
};

const toUniqueStrings = (value: unknown, limit: number): string[] => {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of values) {
    const text = asString(entry);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
};

export const makeEmptyFullProfileDraft = (): FullProfileDraft => ({
  skinType: '',
  sensitivity: '',
  barrierStatus: '',
  goals: [],
  region: '',
  budgetTier: '',
  age_band: 'unknown',
  pregnancy_status: 'unknown',
  lactation_status: 'unknown',
  high_risk_medications_text: '',
});

export function normalizeProfileFromBootstrap(value: unknown): AuroraProfile | null {
  const obj = asObject(value);
  if (!obj) return null;

  const medications = toUniqueStrings((obj as any).high_risk_medications, 30);
  return {
    skinType: firstString(obj, 'skinType') || null,
    sensitivity: firstString(obj, 'sensitivity') || null,
    barrierStatus: firstString(obj, 'barrierStatus') || null,
    goals: toUniqueStrings(obj.goals, 20),
    region: firstString(obj, 'region', 'home_region', 'homeRegion') || null,
    budgetTier: firstString(obj, 'budgetTier') || null,
    age_band: firstString(obj, 'age_band', 'ageBand') || 'unknown',
    pregnancy_status: firstString(obj, 'pregnancy_status', 'pregnancyStatus') || 'unknown',
    lactation_status: firstString(obj, 'lactation_status', 'lactationStatus') || 'unknown',
    high_risk_medications: medications,
    displayName: firstString(obj, 'displayName', 'display_name') || null,
    avatarUrl: firstString(obj, 'avatarUrl', 'avatar_url') || null,
  };
}

export function buildFullProfileDraft(profile: AuroraProfile | null | undefined): FullProfileDraft {
  if (!profile) return makeEmptyFullProfileDraft();
  return {
    skinType: String(profile.skinType || ''),
    sensitivity: String(profile.sensitivity || ''),
    barrierStatus: String(profile.barrierStatus || ''),
    goals: Array.isArray(profile.goals) ? profile.goals.slice(0, 20) : [],
    region: String(profile.region || ''),
    budgetTier: String(profile.budgetTier || ''),
    age_band: String(profile.age_band || 'unknown'),
    pregnancy_status: String(profile.pregnancy_status || 'unknown'),
    lactation_status: String(profile.lactation_status || 'unknown'),
    high_risk_medications_text: Array.isArray(profile.high_risk_medications) ? profile.high_risk_medications.join(', ') : '',
  };
}

export function buildProfileUpdatePatch(draft: ProfilePatchDraft): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const appendTrimmed = (key: string, value: unknown, maxLen = 200) => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed) return;
    patch[key] = trimmed.slice(0, maxLen);
  };

  appendTrimmed('skinType', draft.skinType, 80);
  appendTrimmed('sensitivity', draft.sensitivity, 80);
  appendTrimmed('barrierStatus', draft.barrierStatus, 80);
  appendTrimmed('region', draft.region, 120);
  appendTrimmed('budgetTier', draft.budgetTier, 80);
  appendTrimmed('age_band', draft.age_band, 40);
  appendTrimmed('pregnancy_status', draft.pregnancy_status, 40);
  appendTrimmed('lactation_status', draft.lactation_status, 40);
  appendTrimmed('displayName', draft.displayName, 40);
  appendTrimmed('avatarUrl', draft.avatarUrl, 1024);

  const goals = Array.isArray(draft.goals) ? toUniqueStrings(draft.goals, 20) : [];
  if (goals.length) patch.goals = goals;

  const meds = typeof draft.high_risk_medications_text === 'string'
    ? draft.high_risk_medications_text
      .split(/[,\n，]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 30)
    : Array.isArray(draft.high_risk_medications)
      ? toUniqueStrings(draft.high_risk_medications, 30)
      : [];
  if (meds.length) patch.high_risk_medications = meds;

  return patch;
}
