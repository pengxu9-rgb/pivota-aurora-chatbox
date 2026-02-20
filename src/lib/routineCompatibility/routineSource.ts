import type { CompatibilityProductInput } from '@/lib/routineCompatibility/types';

type RoutineEntry = { step?: string | null; product?: string | null };
type RoutineShape = { am?: RoutineEntry[]; pm?: RoutineEntry[] };

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asString = (value: unknown): string => String(value || '').trim();

const parseRoutine = (input: unknown): RoutineShape | null => {
  if (!input) return null;
  if (typeof input === 'string') {
    const raw = input.trim();
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      const obj = asObject(parsed);
      if (!obj) return null;
      return {
        am: asArray(obj.am).map((entry) => asObject(entry) || {}),
        pm: asArray(obj.pm).map((entry) => asObject(entry) || {}),
      };
    } catch {
      return null;
    }
  }

  const obj = asObject(input);
  if (!obj) return null;
  return {
    am: asArray(obj.am).map((entry) => asObject(entry) || {}),
    pm: asArray(obj.pm).map((entry) => asObject(entry) || {}),
  };
};

export function extractRoutineProductsFromProfileCurrentRoutine(profileCurrentRoutine: unknown): CompatibilityProductInput[] {
  const routine = parseRoutine(profileCurrentRoutine);
  if (!routine) return [];

  const merged = [...(Array.isArray(routine.am) ? routine.am : []), ...(Array.isArray(routine.pm) ? routine.pm : [])];
  const out: CompatibilityProductInput[] = [];
  const seen = new Set<string>();

  merged.forEach((entry, idx) => {
    const productName = asString((entry as any)?.product);
    if (!productName) return;
    const normalized = productName.toLowerCase();
    if (normalized === 'none' || normalized === 'n/a' || normalized === 'na') return;
    if (seen.has(normalized)) return;
    seen.add(normalized);

    const step = asString((entry as any)?.step);
    const idSafe = normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || `item_${idx + 1}`;

    out.push({
      id: `routine_${idSafe}_${idx + 1}`,
      name: productName,
      ingredientTokens: [productName, step].filter(Boolean),
      source: 'routine',
    });
  });

  return out.slice(0, 20);
}
