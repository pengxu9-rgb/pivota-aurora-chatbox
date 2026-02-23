// Session and State Types
export type FlowState =
  | 'S0_LANDING'
  | 'S1_OPEN_INTENT'
  | 'S2_DIAGNOSIS'
  | 'S3_PHOTO_OPTION'
  | 'S3a_PHOTO_QC'
  | 'S4_ANALYSIS_LOADING'
  | 'S5_ANALYSIS_SUMMARY'
  | 'S5a_RISK_CHECK'
  | 'S6_BUDGET'
  | 'S7_PRODUCT_RECO'
  | 'S8_CHECKOUT'
  | 'S9_SUCCESS'
  | 'S10_FAILURE'
  | 'S11_RECOVERY'
  // Product analysis flow
  | 'P1_PRODUCT_ANALYZING'
  | 'P2_PRODUCT_RESULT';

export type Language = 'EN' | 'CN';
export type Mode = 'demo' | 'live';
export type Market = 'US' | 'EU' | 'UK' | 'Canada' | 'Singapore' | 'Global';
export type BudgetTier = '$' | '$$' | '$$$';
export type CheckoutOutcome = 'success' | 'failure_payment' | 'failure_expired';

export type RecommendationSourceMode = 'artifact_matcher' | 'upstream_fallback' | 'rules_only';

export interface AuroraAnalysisMeta {
  detector_source: string;
  llm_vision_called: boolean;
  llm_report_called: boolean;
  artifact_usable: boolean;
  degrade_reason?: string | null;
}

export interface AuroraRecommendationMeta {
  source_mode: RecommendationSourceMode;
  used_recent_logs: boolean;
  used_itinerary: boolean;
  used_safety_flags: boolean;
}

export interface AuroraRecoRefreshHint {
  should_refresh: boolean;
  reason: string;
  effective_window_days: number;
}

export type SkinType = 'oily' | 'dry' | 'combination' | 'normal' | 'sensitive';
export type SkinConcern = 'acne' | 'dark_spots' | 'wrinkles' | 'dullness' | 'redness' | 'pores' | 'dehydration';

// Product analysis types
export type MechanismVector = 'oil_control' | 'soothing' | 'repair' | 'brightening' | 'anti_aging' | 'hydrating';

export interface ProductAnalysisResult {
  productName: string;
  brand: string;
  matchScore: number; // 0-100
  suitability: 'excellent' | 'good' | 'moderate' | 'poor';
  mechanisms: { vector: MechanismVector; strength: number }[]; // strength 0-100
  ingredients: {
    beneficial: string[];
    caution: string[];
    veto?: string; // Ingredient that triggers VETO
  };
  usageAdvice: {
    timing: 'AM' | 'PM' | 'both';
    notes: string;
  };
  dupeRecommendation?: {
    name: string;
    brand: string;
    reason: string;
    savingsPercent: number;
  };
  skinProfileMatch?: {
    skinType: SkinType;
    matchedConcerns: SkinConcern[];
    unmatchedConcerns: SkinConcern[];
  };
}

export interface DiagnosisResult {
  skinType?: SkinType;
  concerns: SkinConcern[];
  currentRoutine: 'none' | 'basic' | 'full';
  barrierStatus?: 'healthy' | 'impaired' | 'unknown';
}

export interface ProductPair {
  category: string;
  similarity?: number; // 0-100
  tradeoff_note?: string;
  premium: {
    product: Product;
    offers: Offer[];
  };
  dupe: {
    product: Product;
    offers: Offer[];
  };
}

export interface PhotoSlot {
  id: 'daylight' | 'indoor_white';
  uploadId?: string;
  file?: File;
  preview?: string;
  qcStatus?: 'pending' | 'passed' | 'too_dark' | 'has_filter' | 'blurry';
  qcAdvice?: Record<string, any>;
  frameCheck?: {
    level: 'good' | 'warn' | 'bad' | 'unknown';
    score: number;
    issues: Array<'no_face' | 'off_center' | 'too_small' | 'too_large' | 'cutoff' | 'detector_unavailable'>;
    hint: string;
  };
  retryCount: number;
}

export interface Session {
  brief_id: string;
  trace_id: string;
  mode: Mode;
  state: FlowState;
  clarification_count: number;
  market?: Market;
  budget_tier?: BudgetTier;
  intent_id?: string;
  intent_text?: string;
  diagnosis?: DiagnosisResult;
  photos: {
    daylight?: PhotoSlot;
    indoor_white?: PhotoSlot;
  };
  sample_photo_set_id?: string;
  analysis?: AnalysisResult;
  routine?: RoutineSet;
  productPairs?: { am: ProductPair[]; pm: ProductPair[] };
  selected_offers: Record<string, string>; // sku_id -> offer_id
  product_selections?: Record<string, { type: 'premium' | 'dupe'; offerId?: string }>;
  checkout_result?: CheckoutResult;
  forced_outcome?: CheckoutOutcome;
  // Diagnosis flow control
  isDiagnosisActive?: boolean;
  // Product analysis
  productPhoto?: { file?: File; preview: string };
  productAnalysis?: ProductAnalysisResult;
}

export interface AnalysisResult {
  features: AnalysisFeature[];
  strategy: string;
  needs_risk_check: boolean;
  risk_answered?: boolean;
  using_actives?: boolean;
}

export interface AnalysisFeature {
  observation: string;
  confidence: 'pretty_sure' | 'somewhat_sure' | 'not_sure';
}

export interface RoutineSet {
  am_steps: RoutineStep[];
  pm_steps: RoutineStep[];
  total_estimate: {
    min: number;
    max: number;
    currency: string;
  };
  preference?: 'cheaper' | 'gentler' | 'fastest' | 'keep';
}

export interface RoutineStep {
  order: number;
  category: string;
  product: Product;
  offers: Offer[];
  selected_offer_id?: string;
}

export interface Product {
  sku_id: string;
  name: string;
  brand: string;
  category: string;
  description: string;
  image_url: string;
  size: string;
  fit_tags?: string[]; // e.g., ["gentle", "fragrance-free", "vegan"]
  source_sku_id?: string | null;
  // Scientific + social signals (optional; populated by Aurora / Glow Agent when available)
  mechanism?: Record<string, number>; // 0-1 or 0-100 values (normalize in UI)
  experience?: Record<string, any>;
  risk_flags?: string[];
  social_stats?: {
    platform_scores?: Record<string, number>; // 0-1
    RED_score?: number; // 0-1
    Reddit_score?: number; // 0-1
    burn_rate?: number; // 0-1
    key_phrases?: Partial<Record<string, string[]>>;
  };
  key_actives?: string[];
  evidence_pack?: {
    product_id?: string;
    display_name?: string;
    region?: string;
    availability?: string[];
    keyActives?: string[];
    textureFinish?: string[];
    sensitivityFlags?: string[];
    pairingRules?: string[];
    comparisonNotes?: string[];
    citations?: string[];
  };
  ingredients?: {
    head: string[];
    hero_actives?: unknown;
    highlights: string[];
  };
}

export type PurchaseRoute = 'internal_checkout' | 'affiliate_outbound';

export interface Offer {
  offer_id: string;
  seller: string;
  price: number;
  currency: string;
  original_price?: number;
  shipping_days: number;
  returns_policy: string;
  reliability_score: number;
  badges: OfferBadge[];
  in_stock: boolean;
  purchase_route: PurchaseRoute;
  affiliate_url?: string; // Required when purchase_route is 'affiliate_outbound'
}

export type OfferBadge = 'best_price' | 'best_returns' | 'fastest_shipping' | 'high_reliability';

// Checkout route analysis for a routine
export interface CheckoutRouteAnalysis {
  hasInternal: boolean;
  hasAffiliate: boolean;
  internalOffers: { product: Product; offer: Offer }[];
  affiliateOffers: { product: Product; offer: Offer }[];
  routeType: 'all_internal' | 'all_affiliate' | 'mixed';
}

export interface CheckoutResult {
  success: boolean;
  order_id?: string;
  total?: number;
  currency?: string;
  eta?: string;
  reason_code?: string;
  reason_label?: string;
}

// Message Types
export type MessageType =
  | 'text'
  | 'context_card'
  | 'diagnosis_card'
  | 'diagnosis_progress'
  | 'skin_identity_card'
  | 'budget_card'
  | 'photo_upload_card'
  | 'loading_card'
  | 'analysis_summary'
  | 'risk_check_card'
  | 'routine_card'
  | 'product_comparison_card'
  | 'product_card'
  | 'offer_picker'
  | 'checkout_card'
  | 'success_card'
  | 'failure_card'
  | 'chips'
  | 'product_analysis_card'
  | 'affiliate_outcome_card';

export interface Message {
  id: string;
  type: MessageType;
  role: 'user' | 'assistant' | 'system';
  content?: string;
  payload?: any;
  timestamp: number;
}

// Analytics Events
export interface AnalyticsEvent {
  event_name: string;
  brief_id: string;
  trace_id: string;
  timestamp: number;
  data?: Record<string, any>;
}

// Action Types
export interface CardAction {
  action_id: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  data?: Record<string, any>;
}
