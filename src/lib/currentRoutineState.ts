export type CurrentRoutineEntry = {
  step?: string | null;
  product?: string | null;
  product_id?: string | null;
  sku_id?: string | null;
};

export type ParsedCurrentRoutine = {
  schema_version: string | null;
  am: CurrentRoutineEntry[];
  pm: CurrentRoutineEntry[];
  notes: string | null;
  source_shape: 'json_string' | 'object' | 'array';
};

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return s ? s : null;
};

const normalizeSlot = (value: unknown): 'am' | 'pm' => {
  const token = String(value || '').trim().toLowerCase();
  if (!token) return 'am';
  if (['pm', 'night', 'evening', 'bedtime'].includes(token) || token.includes('pm')) return 'pm';
  return 'am';
};

const normalizeEntry = (entry: unknown): CurrentRoutineEntry | null => {
  if (!entry || typeof entry === 'boolean') return null;
  if (typeof entry === 'string') {
    const product = asString(entry);
    return product ? { step: null, product } : null;
  }
  const obj = asObject(entry);
  if (!obj) return null;
  const step = asString(obj.step) ?? asString(obj.category) ?? asString(obj.routine_step) ?? asString(obj.type);
  const product =
    asString(obj.product) ??
    asString(obj.name) ??
    asString(obj.display_name) ??
    asString(obj.displayName) ??
    asString(obj.title) ??
    asString(obj.text);
  if (!step && !product) return null;
  return {
    step: step ?? null,
    product: product ?? null,
    product_id: asString(obj.product_id) ?? null,
    sku_id: asString(obj.sku_id) ?? null,
  };
};

const readEntries = (slotValue: unknown): CurrentRoutineEntry[] => {
  if (Array.isArray(slotValue)) {
    return slotValue.map((entry) => normalizeEntry(entry)).filter(Boolean) as CurrentRoutineEntry[];
  }
  const obj = asObject(slotValue);
  if (!obj) return [];
  return Object.entries(obj)
    .map(([step, product]) => {
      const productName = asString(product);
      return productName ? { step, product: productName } : null;
    })
    .filter(Boolean) as CurrentRoutineEntry[];
};

const readEntriesFromArrayRoot = (value: unknown[]): { am: CurrentRoutineEntry[]; pm: CurrentRoutineEntry[] } => {
  const am: CurrentRoutineEntry[] = [];
  const pm: CurrentRoutineEntry[] = [];
  for (const item of value) {
    const normalized = normalizeEntry(item);
    if (!normalized) continue;
    const slotSource = asObject(item);
    const slot = normalizeSlot(slotSource?.slot ?? slotSource?.routine ?? slotSource?.time_of_day ?? slotSource?.timeOfDay);
    if (slot === 'pm') pm.push(normalized);
    else am.push(normalized);
  }
  return { am, pm };
};

export function parseCurrentRoutine(value: unknown): ParsedCurrentRoutine | null {
  if (!value) return null;

  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const slots = readEntriesFromArrayRoot(parsed);
        return slots.am.length || slots.pm.length
          ? { schema_version: null, notes: null, source_shape: 'json_string', ...slots }
          : null;
      }
      const obj = asObject(parsed);
      if (!obj) return null;
      const am = readEntries(obj.am ?? obj.am_steps);
      const pm = readEntries(obj.pm ?? obj.pm_steps);
      const notes = asString(obj.notes);
      return am.length || pm.length || notes
        ? {
            schema_version: asString(obj.schema_version),
            am,
            pm,
            notes,
            source_shape: 'json_string',
          }
        : null;
    } catch {
      return null;
    }
  }

  if (Array.isArray(value)) {
    const slots = readEntriesFromArrayRoot(value);
    return slots.am.length || slots.pm.length
      ? { schema_version: null, notes: null, source_shape: 'array', ...slots }
      : null;
  }

  const obj = asObject(value);
  if (!obj) return null;
  const am = readEntries(obj.am ?? obj.am_steps);
  const pm = readEntries(obj.pm ?? obj.pm_steps);
  const notes = asString(obj.notes);
  return am.length || pm.length || notes
    ? {
        schema_version: asString(obj.schema_version),
        am,
        pm,
        notes,
        source_shape: 'object',
      }
    : null;
}
