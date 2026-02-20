import type { CompatibilityProductInput, FamilyTriggerMap, IngredientFamily, TaggedProduct } from '@/lib/routineCompatibility/types';

const FAMILY_KEYWORDS: Record<IngredientFamily, string[]> = {
  exfoliation_acids: [
    'glycolic',
    'lactic',
    'mandelic',
    'salicylic',
    'sodium salicylate',
    'capryloyl salicylic',
    'gluconolactone',
    'lactobionic',
    'polyhydroxy',
    'aha',
    'bha',
    'pha',
    'lha',
    'exfoliat',
  ],
  retinoids: [
    'retinol',
    'retinal',
    'retinaldehyde',
    'tretinoin',
    'adapalene',
    'hydroxypinacolone retinoate',
    'retinyl',
    'granactive retinoid',
  ],
  benzoyl_peroxide: ['benzoyl peroxide'],
  vitamin_c_strong: ['ascorbic acid', 'l-ascorbic acid', 'l ascorbic acid', 'pure vitamin c'],
  vitamin_c_derivative: [
    'ascorbyl glucoside',
    'magnesium ascorbyl phosphate',
    'sodium ascorbyl phosphate',
    'tetrahexyldecyl ascorbate',
    '3-o-ethyl ascorbic',
    'ethyl ascorbic',
    'map',
    'sap',
  ],
  copper_peptides: ['copper tripeptide', 'copper peptide', 'ghk-cu', 'ghk cu'],
  peptides: ['peptide', 'hexapeptide', 'tripeptide', 'tetrapeptide', 'pentapeptide', 'oligopeptide'],
  barrier_support: ['ceramide', 'cholesterol', 'fatty acid', 'panthenol', 'glycerin', 'glycerol'],
  soothing: ['allantoin', 'centella', 'oat', 'bisabolol', 'madecassoside'],
  fragrance_irritants: [
    'fragrance',
    'parfum',
    'limonene',
    'linalool',
    'citral',
    'geraniol',
    'eugenol',
    'farnesol',
    'hexyl cinnamal',
    'benzyl salicylate',
    'coumarin',
    'alpha-isomethyl ionone',
  ],
};

const EMPTY_TRIGGERS: FamilyTriggerMap = {
  exfoliation_acids: [],
  retinoids: [],
  benzoyl_peroxide: [],
  vitamin_c_strong: [],
  vitamin_c_derivative: [],
  copper_peptides: [],
  peptides: [],
  barrier_support: [],
  soothing: [],
  fragrance_irritants: [],
};

const normalizeToken = (raw: string) => raw.replace(/\s+/g, ' ').trim();

const dedupe = (values: Array<string | null | undefined>, limit = 120): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const token = normalizeToken(String(raw || ''));
    if (!token) continue;
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(token);
    if (out.length >= limit) break;
  }
  return out;
};

export function parseInciText(text: string): string[] {
  const raw = String(text || '').trim();
  if (!raw) return [];
  return dedupe(
    raw
      .split(/[,\n;，；]+/g)
      .map((part) => part.replace(/^[•\-–\s]+/, '').trim())
      .filter(Boolean),
  );
}

export function tagIngredientFamilies(input: {
  id?: string | null;
  name?: string | null;
  brand?: string | null;
  ingredients?: Array<string | null | undefined>;
  ingredientText?: string | null;
  irritationSignal?: boolean;
  source?: CompatibilityProductInput['source'];
}): TaggedProduct {
  const id = normalizeToken(String(input.id || input.name || 'product'));
  const name = normalizeToken(String(input.name || 'Unknown product'));
  const brand = normalizeToken(String(input.brand || ''));
  const ingredientTokens = dedupe([
    ...(Array.isArray(input.ingredients) ? input.ingredients : []),
    ...parseInciText(String(input.ingredientText || '')),
  ]);

  const searchableTokens = dedupe([...ingredientTokens, name, brand], 180);
  const searchableLower = searchableTokens.map((token) => ({ raw: token, lower: token.toLowerCase() }));

  const triggers: FamilyTriggerMap = {
    exfoliation_acids: [],
    retinoids: [],
    benzoyl_peroxide: [],
    vitamin_c_strong: [],
    vitamin_c_derivative: [],
    copper_peptides: [],
    peptides: [],
    barrier_support: [],
    soothing: [],
    fragrance_irritants: [],
  };

  const families = new Set<IngredientFamily>();

  (Object.keys(FAMILY_KEYWORDS) as IngredientFamily[]).forEach((family) => {
    const keywords = FAMILY_KEYWORDS[family];
    const matched = searchableLower
      .filter((token) => keywords.some((keyword) => token.lower.includes(keyword)))
      .map((token) => token.raw);
    if (!matched.length) return;
    triggers[family] = dedupe(matched, 8);
    families.add(family);
  });

  if (!families.size) {
    return {
      id,
      name,
      ...(brand ? { brand } : {}),
      ingredientTokens,
      triggers: { ...EMPTY_TRIGGERS },
      families,
      irritationSignal: input.irritationSignal === true,
      source: input.source || 'routine',
    };
  }

  return {
    id,
    name,
    ...(brand ? { brand } : {}),
    ingredientTokens,
    triggers,
    families,
    irritationSignal: input.irritationSignal === true,
    source: input.source || 'routine',
  };
}
