export type IngredientFamily =
  | 'exfoliation_acids'
  | 'retinoids'
  | 'benzoyl_peroxide'
  | 'vitamin_c_strong'
  | 'vitamin_c_derivative'
  | 'copper_peptides'
  | 'peptides'
  | 'barrier_support'
  | 'soothing'
  | 'fragrance_irritants';

export type CompatibilityRating = 'good' | 'caution' | 'avoid_same_routine';

export type CompatibilitySensitivity = 'Low' | 'Medium' | 'High';
export type CompatibilityTiming = 'AM' | 'PM' | 'Both';
export type CompatibilityLanguage = 'EN' | 'CN';

export type FamilyTriggerMap = Record<IngredientFamily, string[]>;

export type CompatibilityProductInput = {
  id: string;
  name: string;
  brand?: string;
  ingredientTokens: string[];
  irritationSignal?: boolean;
  source?: 'base' | 'routine' | 'search' | 'inci' | 'stub';
};

export type TaggedProduct = CompatibilityProductInput & {
  families: Set<IngredientFamily>;
  triggers: FamilyTriggerMap;
};

export type CompatibilityContext = {
  sensitivity: CompatibilitySensitivity;
  timing: CompatibilityTiming;
  language?: CompatibilityLanguage;
};

export type CompatibilityRecommendations = {
  layering: string[];
  frequency: string[];
  schedule?: string[];
};

export type CompatibilityResult = {
  rating: CompatibilityRating;
  reasons: string[];
  chips: {
    compatible?: string;
    caution?: string;
    avoid?: string;
  };
  recommendations: CompatibilityRecommendations;
};
