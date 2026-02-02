import {
  Session,
  FlowState,
  Language,
  Market,
  BudgetTier,
  AnalysisResult,
  RoutineSet,
  RoutineStep,
  Product,
  Offer,
  CheckoutResult,
  CheckoutOutcome,
  PhotoSlot,
  ProductAnalysisResult,
  MechanismVector,
  SkinType,
  SkinConcern,
  ProductPair,
  CheckoutRouteAnalysis,
} from './types';
import { getShopGatewayUrl, isBackendConfigured, pivotaJson, pivotaUpload } from './pivotaApi';

// Deterministic ID generation
let idCounter = 0;
const generateId = (prefix: string) => `${prefix}_${Date.now()}_${++idCounter}`;

type BackendSessionPatch = Partial<Session> & { next_state?: FlowState };

const isLiveSession = (session: Session) => session.mode === 'live' && isBackendConfigured();

const extractSessionPatch = (payload: unknown): BackendSessionPatch => {
  if (!payload || typeof payload !== 'object') return {};

  const obj = payload as Record<string, unknown>;
  const sessionPatch =
    obj.session && typeof obj.session === 'object'
      ? (obj.session as Record<string, unknown>)
      : obj;

  const patch = { ...(sessionPatch as BackendSessionPatch) };

  if (!patch.next_state && typeof obj.next_state === 'string') {
    patch.next_state = obj.next_state as FlowState;
  }

  // Normalize snake_case from backend if present.
  if ((patch as any).budgetTier && !(patch as any).budget_tier) {
    (patch as any).budget_tier = (patch as any).budgetTier;
  }

  if ((patch as any).product_pairs && !(patch as any).productPairs) {
    (patch as any).productPairs = (patch as any).product_pairs;
  }

  if ((patch as any).samplePhotoSetId && !(patch as any).sample_photo_set_id) {
    (patch as any).sample_photo_set_id = (patch as any).samplePhotoSetId;
  }

  return patch;
};

const mergeSession = (current: Session, patch: BackendSessionPatch, fallbackState?: FlowState): Session => {
  const nextState = patch.next_state ?? patch.state ?? fallbackState;

  const merged: Session = {
    ...current,
    ...patch,
    brief_id: current.brief_id,
    trace_id: current.trace_id,
    mode: current.mode,
    state: (nextState ?? current.state) as FlowState,
    photos: patch.photos ? { ...current.photos, ...patch.photos } : current.photos,
    selected_offers: patch.selected_offers ? { ...current.selected_offers, ...patch.selected_offers } : current.selected_offers,
  };

  return merged;
};

const normalizePhotoSlot = (
  slotId: PhotoSlot['id'],
  raw: unknown,
  fallback: PhotoSlot | undefined
): PhotoSlot | undefined => {
  if (!raw || typeof raw !== 'object') return fallback;

  const obj = raw as Record<string, unknown>;
  const qcStatus =
    (obj.qcStatus as PhotoSlot['qcStatus']) ??
    (obj.qc_status as PhotoSlot['qcStatus']) ??
    fallback?.qcStatus;
  const preview =
    (obj.preview as string) ??
    (obj.preview_url as string) ??
    (obj.url as string) ??
    fallback?.preview;
  const retryCount =
    (obj.retryCount as number) ??
    (obj.retry_count as number) ??
    fallback?.retryCount ??
    0;

  return {
    id: slotId,
    file: fallback?.file,
    preview,
    qcStatus,
    retryCount,
  };
};

// Sample photo sets - labeled per spec requirements
export const SAMPLE_PHOTO_SETS = [
  {
    id: 'sample_set_A',
    name: 'Oily / Acne-prone',
    nameEN: 'Oily / Acne-prone',
    nameCN: '油性 / 易长痘',
    daylight: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=400&fit=crop',
    indoor: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop',
    skinType: 'oily' as const,
    concerns: ['acne', 'pores'] as const,
  },
  {
    id: 'sample_set_B',
    name: 'Dry / Sensitive',
    nameEN: 'Dry / Sensitive',
    nameCN: '干性 / 敏感',
    daylight: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=400&fit=crop',
    indoor: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop',
    skinType: 'sensitive' as const,
    concerns: ['redness', 'dehydration'] as const,
  },
  {
    id: 'sample_set_C',
    name: 'Uneven Tone',
    nameEN: 'Uneven Tone',
    nameCN: '肤色不均',
    daylight: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=400&fit=crop',
    indoor: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
    skinType: 'combination' as const,
    concerns: ['dark_spots', 'dullness'] as const,
  },
];

// Mock product catalog
const PRODUCTS: Product[] = [
  {
    sku_id: 'cleanser_001',
    name: 'Gentle Foaming Cleanser',
    brand: 'CeraVe',
    category: 'cleanser',
    description: 'Gentle, non-stripping cleanser with ceramides',
    image_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=200&h=200&fit=crop',
    size: '236ml',
  },
  {
    sku_id: 'moisturizer_001',
    name: 'Daily Moisturizing Lotion',
    brand: 'Cetaphil',
    category: 'moisturizer',
    description: 'Lightweight, non-comedogenic hydration',
    image_url: 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=200&h=200&fit=crop',
    size: '473ml',
  },
  {
    sku_id: 'sunscreen_001',
    name: 'UV Aqua Rich Watery Essence',
    brand: 'Bioré',
    category: 'sunscreen',
    description: 'Lightweight SPF 50+ PA++++ protection',
    image_url: 'https://images.unsplash.com/photo-1556227702-d1e4e7b5c232?w=200&h=200&fit=crop',
    size: '50g',
  },
  {
    sku_id: 'treatment_001',
    name: 'Niacinamide 10% + Zinc 1%',
    brand: 'The Ordinary',
    category: 'treatment',
    description: 'Targets blemishes and oil control',
    image_url: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=200&h=200&fit=crop',
    size: '30ml',
  },
  {
    sku_id: 'treatment_002',
    name: 'Vitamin C Serum 15%',
    brand: 'Timeless',
    category: 'treatment',
    description: 'Brightening antioxidant serum',
    image_url: 'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=200&h=200&fit=crop',
    size: '30ml',
  },
  {
    sku_id: 'treatment_003',
    name: 'Retinol 0.5% in Squalane',
    brand: 'The Ordinary',
    category: 'treatment',
    description: 'Anti-aging retinoid treatment',
    image_url: 'https://images.unsplash.com/photo-1617897903246-719242758050?w=200&h=200&fit=crop',
    size: '30ml',
  },
];

// Generate offers for a product with mixed purchase routes
function generateOffers(product: Product, market: Market, budget: BudgetTier): Offer[] {
  const basePrice = budget === '$' ? 15 : budget === '$$' ? 30 : 55;
  const multiplier = product.category === 'treatment' ? 1.2 : 1;
  
  // Define sellers with their purchase routes
  const sellerConfigs = [
    { name: 'Amazon', route: 'internal_checkout' as const },
    { name: 'iHerb', route: 'internal_checkout' as const },
    { name: 'Sephora', route: 'affiliate_outbound' as const },
    { name: 'Ulta', route: 'affiliate_outbound' as const },
    { name: 'YesStyle', route: 'internal_checkout' as const },
  ];
  
  const shuffledSellers = sellerConfigs.sort(() => Math.random() - 0.5).slice(0, 3);
  
  return shuffledSellers.map((seller, idx) => {
    const price = Math.round((basePrice * multiplier * (0.85 + idx * 0.15)) * 100) / 100;
    const badges: Offer['badges'] = [];
    
    if (idx === 0) badges.push('best_price');
    if (idx === 1) badges.push('best_returns');
    if (idx === 2) badges.push('fastest_shipping');
    if (Math.random() > 0.5) badges.push('high_reliability');
    
    return {
      offer_id: `offer_${product.sku_id}_${seller.name.toLowerCase()}_${idx}`,
      seller: seller.name,
      price,
      currency: market === 'UK' ? 'GBP' : market === 'EU' ? 'EUR' : 'USD',
      original_price: idx === 0 ? Math.round(price * 1.2 * 100) / 100 : undefined,
      shipping_days: 2 + idx * 2,
      returns_policy: idx === 1 ? '60-day returns' : '30-day returns',
      reliability_score: 95 - idx * 5,
      badges,
      in_stock: true,
      purchase_route: seller.route,
      affiliate_url: seller.route === 'affiliate_outbound' 
        ? `https://${seller.name.toLowerCase()}.com/product/${product.sku_id}?ref=pivota`
        : undefined,
    };
  });
}

// Mock orchestrator functions
export function startSession(mode: 'demo' | 'live' = isBackendConfigured() ? 'live' : 'demo'): Session {
  return {
    brief_id: generateId('brief'),
    trace_id: generateId('trace'),
    mode,
    state: 'S0_LANDING',
    clarification_count: 0,
    photos: {},
    selected_offers: {},
  };
}

export function submitIntent(session: Session, intentId: string, intentText?: string): Session {
  return {
    ...session,
    state: 'S2_DIAGNOSIS',
    intent_id: intentId,
    intent_text: intentText || intentId,
  };
}

export type ChatMessageResponse = {
  answer?: string;
  intent?: string;
  clarification?: any;
  context?: any;
};

export async function sendChatMessage(
  session: Session,
  message: string,
  language: Language,
  options: { anchor_product_id?: string; anchor_product_url?: string } = {}
): Promise<ChatMessageResponse> {
  if (!isLiveSession(session)) {
    return {
      answer:
        language === 'EN'
          ? 'Demo mode: set VITE_API_BASE_URL to enable the Aurora-backed agent.'
          : '当前是 Demo 模式：请配置 VITE_API_BASE_URL 来启用 Aurora 后端对话。',
    };
  }

  return pivotaJson<ChatMessageResponse>(session, '/chat', {
    method: 'POST',
    body: JSON.stringify({
      message,
      language,
      trace_id: session.trace_id,
      ...options,
    }),
  });
}

export async function submitDiagnosis(
  session: Session,
  diagnosis: { skinType?: string; concerns: string[]; currentRoutine: string },
  skipped: boolean = false
): Promise<Session> {
  const clarificationCount = skipped ? session.clarification_count : session.clarification_count + 1;

  if (!isLiveSession(session)) {
    return {
      ...session,
      state: 'S3_PHOTO_OPTION',
      diagnosis: diagnosis as any,
      clarification_count: clarificationCount,
    };
  }

  const res = await pivotaJson<any>(session, '/diagnosis', {
    method: 'POST',
    body: JSON.stringify({
      ...diagnosis,
      skipped,
      intent_id: session.intent_id,
      intent_text: session.intent_text,
      market: session.market,
      budget_tier: session.budget_tier,
      trace_id: session.trace_id,
    }),
  });

  const patch = extractSessionPatch(res);
  const merged = mergeSession(session, patch, 'S3_PHOTO_OPTION');

  return {
    ...merged,
    diagnosis: merged.diagnosis ?? (diagnosis as any),
    clarification_count:
      typeof patch.clarification_count === 'number' ? patch.clarification_count : clarificationCount,
  };
}

export async function submitContext(
  session: Session,
  market?: Market,
  budget?: BudgetTier,
  skipped: boolean = false
): Promise<Session> {
  const newClarificationCount = skipped ? session.clarification_count : session.clarification_count + 1;

  const next: Session = {
    ...session,
    state: 'S3_PHOTO_OPTION',
    market: market || 'US',
    budget_tier: budget || '$$',
    clarification_count: newClarificationCount,
  };

  if (!isLiveSession(session)) return next;

  const res = await pivotaJson<any>(session, '/diagnosis', {
    method: 'POST',
    body: JSON.stringify({
      market: next.market,
      budget_tier: next.budget_tier,
      skipped,
      intent_id: session.intent_id,
      trace_id: session.trace_id,
    }),
  });

  const patch = extractSessionPatch(res);
  return mergeSession(next, patch, 'S3_PHOTO_OPTION');
}

export function simulatePhotoQC(photo: PhotoSlot): PhotoSlot['qcStatus'] {
  // Simulate QC with random outcomes for demo
  const rand = Math.random();
  if (rand < 0.2) return 'too_dark';
  if (rand < 0.3) return 'has_filter';
  if (rand < 0.35) return 'blurry';
  return 'passed';
}

export async function attachPhotos(
  session: Session,
  photos: { daylight?: PhotoSlot; indoor_white?: PhotoSlot },
  sampleSetId?: string,
  consent?: boolean
): Promise<{ session: Session; qcIssues: { slot: string; status: PhotoSlot['qcStatus'] }[] }> {
  if (isLiveSession(session)) {
    const res = sampleSetId
      ? await pivotaJson<any>(session, '/photos/sample', {
          method: 'POST',
          body: JSON.stringify({ sample_set_id: sampleSetId, trace_id: session.trace_id }),
        })
      : await pivotaUpload<any>(session, '/photos', (() => {
          const form = new FormData();
          if (photos.daylight?.file) form.append('daylight', photos.daylight.file);
          if (photos.indoor_white?.file) form.append('indoor_white', photos.indoor_white.file);
          form.append('consent', consent ? 'true' : 'false');
          form.append('trace_id', session.trace_id);
          return form;
        })());

    const patch = extractSessionPatch(res);
    let merged = mergeSession(session, patch);

    const processedPhotos: Session['photos'] = { ...session.photos, ...merged.photos };
    processedPhotos.daylight = normalizePhotoSlot(
      'daylight',
      processedPhotos.daylight,
      photos.daylight ?? session.photos.daylight
    );
    processedPhotos.indoor_white = normalizePhotoSlot(
      'indoor_white',
      processedPhotos.indoor_white,
      photos.indoor_white ?? session.photos.indoor_white
    );

    const qcIssues: { slot: string; status: PhotoSlot['qcStatus'] }[] = [];
    (['daylight', 'indoor_white'] as const).forEach((slot) => {
      const status = processedPhotos[slot]?.qcStatus;
      if (status && status !== 'passed') qcIssues.push({ slot, status });
    });

    // Fall back to the same UI gating logic if backend doesn't return a state.
    const hasQcIssues = qcIssues.length > 0;
    const allRetried = qcIssues.every((issue) => {
      const slot = issue.slot === 'daylight' ? processedPhotos.daylight : processedPhotos.indoor_white;
      return slot && slot.retryCount >= 1;
    });

    if (!patch.next_state && !patch.state) {
      merged = { ...merged, state: (hasQcIssues && !allRetried ? 'S3a_PHOTO_QC' : 'S4_ANALYSIS_LOADING') as FlowState };
    }

    return {
      session: {
        ...merged,
        photos: processedPhotos,
        sample_photo_set_id: sampleSetId ?? merged.sample_photo_set_id,
      },
      qcIssues,
    };
  }

  const qcIssues: { slot: string; status: PhotoSlot['qcStatus'] }[] = [];
  
  const processedPhotos = { ...session.photos };
  
  if (sampleSetId) {
    const sampleSet = SAMPLE_PHOTO_SETS.find(s => s.id === sampleSetId);
    if (sampleSet) {
      processedPhotos.daylight = {
        id: 'daylight',
        preview: sampleSet.daylight,
        qcStatus: 'passed',
        retryCount: 0,
      };
      processedPhotos.indoor_white = {
        id: 'indoor_white',
        preview: sampleSet.indoor,
        qcStatus: 'passed',
        retryCount: 0,
      };
    }
  } else {
    if (photos.daylight) {
      const qcStatus = simulatePhotoQC(photos.daylight);
      processedPhotos.daylight = { ...photos.daylight, qcStatus };
      if (qcStatus !== 'passed') {
        qcIssues.push({ slot: 'daylight', status: qcStatus });
      }
    }
    if (photos.indoor_white) {
      const qcStatus = simulatePhotoQC(photos.indoor_white);
      processedPhotos.indoor_white = { ...photos.indoor_white, qcStatus };
      if (qcStatus !== 'passed') {
        qcIssues.push({ slot: 'indoor_white', status: qcStatus });
      }
    }
  }
  
  const hasQcIssues = qcIssues.length > 0;
  const allRetried = qcIssues.every(issue => {
    const slot = issue.slot === 'daylight' ? processedPhotos.daylight : processedPhotos.indoor_white;
    return slot && slot.retryCount >= 1;
  });
  
  return {
    session: {
      ...session,
      state: hasQcIssues && !allRetried ? 'S3a_PHOTO_QC' : 'S4_ANALYSIS_LOADING',
      photos: processedPhotos,
      sample_photo_set_id: sampleSetId,
    },
    qcIssues,
  };
}

export function skipPhotos(session: Session): Session {
  return {
    ...session,
    state: 'S4_ANALYSIS_LOADING',
  };
}

export async function runAnalysis(session: Session): Promise<{ session: Session; analysis: AnalysisResult }> {
  if (isLiveSession(session)) {
    const res = await pivotaJson<any>(session, '/analysis', {
      method: 'POST',
      body: JSON.stringify({
        trace_id: session.trace_id,
        intent_id: session.intent_id,
      }),
    });

    const patch = extractSessionPatch(res);
    const merged = mergeSession(session, patch, 'S5_ANALYSIS_SUMMARY');

    const analysis = (merged.analysis ?? (res as any).analysis) as AnalysisResult | undefined;
    if (!analysis) {
      throw new Error('Missing `analysis` in /analysis response');
    }

    return {
      session: { ...merged, analysis },
      analysis,
    };
  }

  const photoCount = Object.values(session.photos).filter(p => p?.preview).length;
  const intent = session.intent_id || 'routine';
  
  // Generate features based on intent
  const features: AnalysisResult['features'] = [];
  
  if (intent.includes('breakout') || intent.includes('oil')) {
    features.push(
      { observation: 'Some shine in T-zone area', confidence: 'pretty_sure' },
      { observation: 'Minor texture on cheeks', confidence: 'somewhat_sure' },
      { observation: 'Overall hydration looks balanced', confidence: 'not_sure' }
    );
  } else if (intent.includes('dark') || intent.includes('bright')) {
    features.push(
      { observation: 'Some uneven tone around cheeks', confidence: 'pretty_sure' },
      { observation: 'Skin appears to have good elasticity', confidence: 'somewhat_sure' },
      { observation: 'Possible sun damage signs', confidence: 'not_sure' }
    );
  } else {
    features.push(
      { observation: 'Skin appears generally healthy', confidence: 'pretty_sure' },
      { observation: 'Some dryness around mouth area', confidence: 'somewhat_sure' },
      { observation: 'Fine lines might be emerging', confidence: 'not_sure' }
    );
  }
  
  const needsActives = intent.includes('breakout') || intent.includes('dark');
  
  const analysis: AnalysisResult = {
    features,
    strategy: needsActives 
      ? "I'll prioritize gentle, targeted treatments and optimize for your goal while keeping irritation low."
      : "I'll focus on hydration and protection with simple, effective products.",
    needs_risk_check: needsActives,
  };
  
  return {
    session: {
      ...session,
      state: 'S5_ANALYSIS_SUMMARY',
      analysis,
    },
    analysis,
  };
}

export async function answerRiskCheck(
  session: Session,
  answer: 'yes' | 'no' | 'not_sure' | 'skip'
): Promise<Session> {
  const clarificationCount = answer === 'skip' ? session.clarification_count : session.clarification_count + 1;

  if (!isLiveSession(session)) {
    return {
      ...session,
      state: 'S6_BUDGET',
      clarification_count: clarificationCount,
      analysis: session.analysis
        ? {
            ...session.analysis,
            risk_answered: true,
            using_actives: answer === 'yes',
          }
        : undefined,
    };
  }

  const res = await pivotaJson<any>(session, '/analysis/risk', {
    method: 'POST',
    body: JSON.stringify({
      answer,
      trace_id: session.trace_id,
    }),
  });

  const patch = extractSessionPatch(res);
  const merged = mergeSession(session, patch, 'S6_BUDGET');

  return {
    ...merged,
    clarification_count: typeof patch.clarification_count === 'number' ? patch.clarification_count : clarificationCount,
    analysis: merged.analysis
      ? {
          ...merged.analysis,
          risk_answered: true,
          using_actives: answer === 'yes',
        }
      : merged.analysis,
  };
}

export function skipRiskCheck(session: Session): Session {
  return {
    ...session,
    state: 'S6_BUDGET',
    analysis: session.analysis ? {
      ...session.analysis,
      risk_answered: true,
    } : undefined,
  };
}

export function submitBudget(session: Session, budget?: BudgetTier, skipped: boolean = false): Session {
  return {
    ...session,
    state: 'S7_PRODUCT_RECO',
    budget_tier: budget || '$$',
    clarification_count: skipped ? session.clarification_count : session.clarification_count + 1,
  };
}

export function buildRoutine(
  session: Session,
  preference?: 'cheaper' | 'gentler' | 'fastest' | 'keep'
): { session: Session; routine: RoutineSet } {
  const market = session.market || 'US';
  const budget = session.budget_tier || '$$';
  const intent = session.intent_id || 'routine';
  
  // Build AM routine
  const amProducts = [
    PRODUCTS.find(p => p.sku_id === 'cleanser_001')!,
    intent.includes('dark') ? PRODUCTS.find(p => p.sku_id === 'treatment_002')! : null,
    PRODUCTS.find(p => p.sku_id === 'moisturizer_001')!,
    PRODUCTS.find(p => p.sku_id === 'sunscreen_001')!,
  ].filter(Boolean) as Product[];
  
  // Build PM routine
  const pmProducts = [
    PRODUCTS.find(p => p.sku_id === 'cleanser_001')!,
    intent.includes('breakout') ? PRODUCTS.find(p => p.sku_id === 'treatment_001')! : null,
    !intent.includes('breakout') && !intent.includes('dark') ? PRODUCTS.find(p => p.sku_id === 'treatment_003')! : null,
    PRODUCTS.find(p => p.sku_id === 'moisturizer_001')!,
  ].filter(Boolean) as Product[];
  
  const amSteps: RoutineStep[] = amProducts.map((product, idx) => ({
    order: idx + 1,
    category: product.category,
    product,
    offers: generateOffers(product, market, budget),
  }));
  
  const pmSteps: RoutineStep[] = pmProducts.map((product, idx) => ({
    order: idx + 1,
    category: product.category,
    product,
    offers: generateOffers(product, market, budget),
  }));
  
  // Calculate totals
  const allOffers = [...amSteps, ...pmSteps].flatMap(s => s.offers);
  const minPrice = allOffers.reduce((sum, o) => sum + Math.min(...allOffers.filter(x => x.offer_id.includes(o.offer_id.split('_')[1])).map(x => x.price)), 0);
  const maxPrice = allOffers.reduce((sum, o) => sum + Math.max(...allOffers.filter(x => x.offer_id.includes(o.offer_id.split('_')[1])).map(x => x.price)), 0);
  
  const routine: RoutineSet = {
    am_steps: amSteps,
    pm_steps: pmSteps,
    total_estimate: {
      min: Math.round(minPrice / 2),
      max: Math.round(maxPrice / 2),
      currency: market === 'UK' ? 'GBP' : market === 'EU' ? 'EUR' : 'USD',
    },
    preference,
  };
  
  // Auto-select best offers
  const selectedOffers: Record<string, string> = {};
  [...amSteps, ...pmSteps].forEach(step => {
    const bestOffer = step.offers.reduce((best, o) => 
      o.reliability_score > best.reliability_score ? o : best
    );
    selectedOffers[step.product.sku_id] = bestOffer.offer_id;
  });
  
  return {
    session: {
      ...session,
      state: 'S7_PRODUCT_RECO',
      routine,
      selected_offers: selectedOffers,
    },
    routine,
  };
}

// Build product pairs with premium vs dupe options, with preference-based re-ranking
export async function buildProductPairs(
  session: Session,
  preference?: 'cheaper' | 'gentler' | 'fastest' | 'keep'
): Promise<{ session: Session; amPairs: ProductPair[]; pmPairs: ProductPair[] }> {
  if (isLiveSession(session)) {
    const apiPreference =
      preference === 'fastest' ? 'fastest_delivery' : preference === 'keep' ? undefined : preference;

    const res = await pivotaJson<any>(session, '/routine/reorder', {
      method: 'POST',
      body: JSON.stringify({
        preference: apiPreference,
        market: session.market,
        budget_tier: session.budget_tier,
        intent_id: session.intent_id,
        trace_id: session.trace_id,
      }),
    });

    const patch = extractSessionPatch(res);
    const merged = mergeSession(session, patch, 'S7_PRODUCT_RECO');

    const productPairs = (patch.productPairs ??
      (res as any).productPairs ??
      (res as any).product_pairs) as { am?: ProductPair[]; pm?: ProductPair[] } | undefined;

    const amPairs =
      productPairs?.am ?? (res as any).amPairs ?? (res as any).am_pairs ?? merged.productPairs?.am ?? [];
    const pmPairs =
      productPairs?.pm ?? (res as any).pmPairs ?? (res as any).pm_pairs ?? merged.productPairs?.pm ?? [];

    if (amPairs.length === 0 && pmPairs.length === 0) {
      throw new Error('Missing `productPairs` in /routine/reorder response');
    }

    return {
      session: {
        ...merged,
        productPairs: { am: amPairs, pm: pmPairs },
      },
      amPairs,
      pmPairs,
    };
  }

  const budget = session.budget_tier || '$$';
  const intent = session.intent_id || 'routine';
  const concerns = session.diagnosis?.concerns || [];

  // Premium products with fit tags
  const premiumProducts: Record<string, Product> = {
    cleanser: {
      sku_id: 'cleanser_premium',
      name: 'Sulwhasoo Gentle Cleansing Foam',
      brand: 'Sulwhasoo',
      category: 'cleanser',
      description: 'Luxury Korean herbal cleanser',
      image_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=200&h=200&fit=crop',
      size: '200ml',
      fit_tags: ['gentle', 'hydrating'],
    },
    moisturizer: {
      sku_id: 'moisturizer_premium',
      name: 'La Mer Crème de la Mer',
      brand: 'La Mer',
      category: 'moisturizer',
      description: 'Iconic luxury moisturizer',
      image_url: 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=200&h=200&fit=crop',
      size: '60ml',
      fit_tags: ['hydrating', 'rich'],
    },
    sunscreen: {
      sku_id: 'sunscreen_premium',
      name: 'Supergoop Unseen Sunscreen SPF 40',
      brand: 'Supergoop!',
      category: 'sunscreen',
      description: 'Invisible, weightless SPF',
      image_url: 'https://images.unsplash.com/photo-1556227702-d1e4e7b5c232?w=200&h=200&fit=crop',
      size: '50ml',
      fit_tags: ['lightweight', 'invisible'],
    },
    treatment: {
      sku_id: 'treatment_premium',
      name: 'SkinCeuticals C E Ferulic',
      brand: 'SkinCeuticals',
      category: 'treatment',
      description: 'Gold-standard vitamin C serum',
      image_url: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=200&h=200&fit=crop',
      size: '30ml',
      fit_tags: ['potent', 'clinical'],
    },
  };

  // Dupe products (budget-friendly alternatives) with fit tags
  const dupeProducts: Record<string, Product> = {
    cleanser: { ...PRODUCTS.find(p => p.sku_id === 'cleanser_001')!, fit_tags: ['gentle', 'fragrance-free'] },
    moisturizer: { ...PRODUCTS.find(p => p.sku_id === 'moisturizer_001')!, fit_tags: ['lightweight', 'non-comedogenic'] },
    sunscreen: { ...PRODUCTS.find(p => p.sku_id === 'sunscreen_001')!, fit_tags: ['lightweight', 'high-SPF'] },
    treatment: { ...PRODUCTS.find(p => p.sku_id === 'treatment_001')!, fit_tags: ['gentle', 'oil-control'] },
  };

  // Gentler alternatives (for preference = 'gentler')
  const gentlerProducts: Record<string, Product> = {
    cleanser: { ...PRODUCTS.find(p => p.sku_id === 'cleanser_001')!, fit_tags: ['ultra-gentle', 'fragrance-free'] },
    moisturizer: { ...PRODUCTS.find(p => p.sku_id === 'moisturizer_001')!, fit_tags: ['soothing', 'minimal'] },
    sunscreen: { ...PRODUCTS.find(p => p.sku_id === 'sunscreen_001')!, fit_tags: ['mineral', 'sensitive-safe'] },
    treatment: {
      sku_id: 'treatment_gentle',
      name: 'Azelaic Acid Suspension 10%',
      brand: 'The Ordinary',
      category: 'treatment',
      description: 'Gentle brightening treatment',
      image_url: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=200&h=200&fit=crop',
      size: '30ml',
      fit_tags: ['gentle', 'pregnancy-safe'],
    },
  };

  const generatePair = (category: string, useGentler: boolean): ProductPair => {
    const market = session.market || 'US';
    const premiumOffers = generateOffers(premiumProducts[category], market, '$$$');
    const dupeProduct = useGentler ? gentlerProducts[category] : dupeProducts[category];
    const dupeOffers = generateOffers(dupeProduct, market, '$');
    
    // Sort offers based on preference
    const sortOffers = (offers: Offer[]) => {
      if (preference === 'cheaper') {
        return [...offers].sort((a, b) => a.price - b.price);
      } else if (preference === 'fastest') {
        return [...offers].sort((a, b) => a.shipping_days - b.shipping_days);
      }
      // Default: sort by reliability
      return [...offers].sort((a, b) => b.reliability_score - a.reliability_score);
    };

    return {
      category,
      premium: {
        product: premiumProducts[category],
        offers: sortOffers(premiumOffers),
      },
      dupe: {
        product: dupeProduct,
        offers: sortOffers(dupeOffers),
      },
    };
  };

  const useGentler = preference === 'gentler';

  // Build AM pairs
  const amCategories = ['cleanser', 'treatment', 'moisturizer', 'sunscreen'];
  const amPairs = amCategories
    .filter(cat => premiumProducts[cat] && dupeProducts[cat])
    .map(cat => generatePair(cat, useGentler));

  // Build PM pairs (no sunscreen)
  const pmCategories = ['cleanser', 'treatment', 'moisturizer'];
  const pmPairs = pmCategories
    .filter(cat => premiumProducts[cat] && dupeProducts[cat])
    .map(cat => generatePair(cat, useGentler));

  return {
    session: {
      ...session,
      productPairs: { am: amPairs, pm: pmPairs },
    },
    amPairs,
    pmPairs,
  };
}

export async function patchRoutineSelection(
  session: Session,
  selection: {
    key: string;
    type: 'premium' | 'dupe';
    sku_id?: string;
    offer_id?: string;
  }
): Promise<Session> {
  const nextSelections = {
    ...(session.product_selections ?? {}),
    [selection.key]: { type: selection.type, offerId: selection.offer_id },
  };

  if (!isLiveSession(session)) {
    return { ...session, product_selections: nextSelections };
  }

  const res = await pivotaJson<any>(session, '/routine/selection', {
    method: 'PATCH',
    body: JSON.stringify({
      trace_id: session.trace_id,
      selection: {
        key: selection.key,
        category: selection.key,
        type: selection.type,
        sku_id: selection.sku_id,
        offer_id: selection.offer_id,
      },
    }),
  });

  const patch = extractSessionPatch(res);
  const merged = mergeSession(session, patch);

  return {
    ...merged,
    product_selections: merged.product_selections ?? nextSelections,
  };
}

export async function reportAffiliateOutcome(
  session: Session,
  outcome: 'success' | 'failed' | 'save',
  data?: Record<string, unknown>
): Promise<void> {
  if (!isLiveSession(session)) return;

  await pivotaJson<any>(session, '/affiliate/outcome', {
    method: 'POST',
    body: JSON.stringify({
      outcome,
      ...data,
      trace_id: session.trace_id,
    }),
  });
}

export async function resolveAffiliateItems(
  session: Session,
  affiliateItems: { product: Product; offer: Offer }[]
): Promise<{ product: Product; offer: Offer }[]> {
  if (!isLiveSession(session)) return affiliateItems;

  const shopGatewayUrl = getShopGatewayUrl();
  if (!shopGatewayUrl) return affiliateItems;

  const market = (session.market ?? 'US') as Market;

  const resolveOne = async (item: { product: Product; offer: Offer }) => {
    const skuId = item.product?.sku_id;
    if (!skuId) return item;

    const res = await pivotaJson<any>(session, '/agent/shop/v1/invoke', {
      baseUrl: shopGatewayUrl,
      method: 'POST',
      body: JSON.stringify({
        operation: 'offers.resolve',
        payload: {
          offers: {
            product: { sku_id: skuId },
            market,
            tool: '*',
            limit: 10,
          },
        },
        metadata: {
          source: 'chatbox',
          trace_id: session.trace_id,
        },
      }),
    });

    const offers =
      (res as any)?.offers ??
      (res as any)?.payload?.offers ??
      (res as any)?.result?.offers ??
      (res as any)?.data?.offers ??
      [];

    if (!Array.isArray(offers) || offers.length === 0) return item;

    const external =
      offers.find((o: any) => o?.purchase_route === 'affiliate_outbound' && typeof o?.affiliate_url === 'string') ??
      null;

    // Only replace when we can provide a real outbound link.
    if (!external) return item;

    const rawAffiliateUrl = String((external as any).affiliate_url ?? '').trim();
    const normalizedAffiliateUrl =
      rawAffiliateUrl && rawAffiliateUrl.startsWith('/') ? `${shopGatewayUrl}${rawAffiliateUrl}` : rawAffiliateUrl || undefined;

    return {
      product: item.product,
      offer: {
        ...(external as Offer),
        ...(normalizedAffiliateUrl ? { affiliate_url: normalizedAffiliateUrl } : {}),
      },
    };
  };

  // Resolve in parallel; keep best-effort fallbacks per item.
  const resolved = await Promise.all(
    affiliateItems.map(async (item) => {
      try {
        return await resolveOne(item);
      } catch {
        return item;
      }
    })
  );

  return resolved;
}

// Analyze checkout route for a set of selected products
export function analyzeCheckoutRoutes(
  pairs: ProductPair[],
  selections: Record<string, 'premium' | 'dupe'>
): CheckoutRouteAnalysis {
  const internalOffers: { product: Product; offer: Offer }[] = [];
  const affiliateOffers: { product: Product; offer: Offer }[] = [];

  pairs.forEach(pair => {
    const selected = selections[pair.category] || 'dupe';
    const productData = selected === 'premium' ? pair.premium : pair.dupe;
    const bestOffer = productData.offers[0]; // Already sorted by preference
    
    if (bestOffer.purchase_route === 'internal_checkout') {
      internalOffers.push({ product: productData.product, offer: bestOffer });
    } else {
      affiliateOffers.push({ product: productData.product, offer: bestOffer });
    }
  });

  const hasInternal = internalOffers.length > 0;
  const hasAffiliate = affiliateOffers.length > 0;
  
  let routeType: CheckoutRouteAnalysis['routeType'];
  if (hasInternal && hasAffiliate) {
    routeType = 'mixed';
  } else if (hasAffiliate) {
    routeType = 'all_affiliate';
  } else {
    routeType = 'all_internal';
  }

  return { hasInternal, hasAffiliate, internalOffers, affiliateOffers, routeType };
}

export function chooseOffer(session: Session, skuId: string, offerId: string): Session {
  return {
    ...session,
    selected_offers: {
      ...session.selected_offers,
      [skuId]: offerId,
    },
  };
}

export function goToCheckout(session: Session): Session {
  return {
    ...session,
    state: 'S8_CHECKOUT',
  };
}

export async function checkout(
  session: Session,
  input: { offer_ids?: string[]; forcedOutcome?: CheckoutOutcome } = {}
): Promise<{ session: Session; result: CheckoutResult }> {
  if (isLiveSession(session)) {
    const res = await pivotaJson<any>(session, '/checkout', {
      method: 'POST',
      body: JSON.stringify({
        offer_ids: input.offer_ids,
        trace_id: session.trace_id,
      }),
    });

    const patch = extractSessionPatch(res);
    let merged = mergeSession(session, patch);

    const result =
      (merged.checkout_result ??
        (res as any).checkout_result ??
        (res as any).result ??
        (patch as any).checkout_result) as CheckoutResult | undefined;

    if (!result) {
      throw new Error('Missing `checkout_result` in /checkout response');
    }

    // If backend didn't set a state, infer from success/failure.
    if (!patch.next_state && !patch.state) {
      merged = { ...merged, state: (result.success ? 'S9_SUCCESS' : 'S10_FAILURE') as FlowState };
    }

    return {
      session: { ...merged, checkout_result: result },
      result,
    };
  }

  const outcome = input.forcedOutcome || session.forced_outcome || 'success';

  if (outcome === 'success') {
    const result: CheckoutResult = {
      success: true,
      order_id: `ORD-${Date.now().toString(36).toUpperCase()}`,
      total: session.routine?.total_estimate.max || 85,
      currency: session.routine?.total_estimate.currency || 'USD',
      eta: '3-5 business days',
    };

    return {
      session: {
        ...session,
        state: 'S9_SUCCESS',
        checkout_result: result,
      },
      result,
    };
  }

  const reasonMap = {
    failure_payment: { code: 'payment_declined', label: 'Payment was declined' },
    failure_expired: { code: 'offer_expired', label: 'One or more offers have expired' },
  } satisfies Record<CheckoutOutcome, { code: string; label: string }>;

  const reason = reasonMap[outcome];
  const result: CheckoutResult = {
    success: false,
    reason_code: reason.code,
    reason_label: reason.label,
  };

  return {
    session: {
      ...session,
      state: 'S10_FAILURE',
      checkout_result: result,
    },
    result,
  };
}

export function recoveryAction(
  session: Session,
  action: 'switch_offer' | 'switch_payment' | 'try_again' | 'adjust_routine'
): Session {
  switch (action) {
    case 'switch_offer':
      return { ...session, state: 'S7_PRODUCT_RECO' };
    case 'switch_payment':
    case 'try_again':
      return { ...session, state: 'S8_CHECKOUT' };
    case 'adjust_routine':
      return { ...session, state: 'S7_PRODUCT_RECO' };
    default:
      return session;
  }
}

export function restartSession(session: Session): Session {
  return startSession(session.mode);
}

// ==================== Product Analysis Flow ====================

// Mock product database with detailed ingredient/mechanism info
const KNOWN_PRODUCTS: Record<string, { 
  name: string; 
  brand: string; 
  category: string;
  mechanisms: { vector: MechanismVector; strength: number }[];
  keyIngredients: string[];
  cautionIngredients: string[];
  targetConcerns: SkinConcern[];
  avoidForSkinTypes: SkinType[];
  irritationLevel: 'low' | 'medium' | 'high';
}> = {
  'la_mer': { 
    name: 'Crème de la Mer', 
    brand: 'La Mer', 
    category: 'moisturizer',
    mechanisms: [{ vector: 'hydrating', strength: 95 }, { vector: 'repair', strength: 80 }],
    keyIngredients: ['Algae Extract', 'Mineral Oil', 'Petrolatum', 'Glycerin'],
    cautionIngredients: ['Fragrance', 'Mineral Oil'],
    targetConcerns: ['dehydration', 'wrinkles'],
    avoidForSkinTypes: ['oily'],
    irritationLevel: 'low',
  },
  'skinceuticals_ce': { 
    name: 'C E Ferulic', 
    brand: 'SkinCeuticals', 
    category: 'serum',
    mechanisms: [{ vector: 'brightening', strength: 90 }, { vector: 'anti_aging', strength: 85 }],
    keyIngredients: ['Vitamin C 15%', 'Vitamin E', 'Ferulic Acid'],
    cautionIngredients: [],
    targetConcerns: ['dark_spots', 'dullness', 'wrinkles'],
    avoidForSkinTypes: [],
    irritationLevel: 'medium',
  },
  'ordinary_niacinamide': { 
    name: 'Niacinamide 10% + Zinc 1%', 
    brand: 'The Ordinary', 
    category: 'serum',
    mechanisms: [{ vector: 'oil_control', strength: 85 }, { vector: 'soothing', strength: 70 }],
    keyIngredients: ['Niacinamide 10%', 'Zinc PCA'],
    cautionIngredients: [],
    targetConcerns: ['acne', 'pores', 'dullness'],
    avoidForSkinTypes: [],
    irritationLevel: 'low',
  },
  'cerave_cleanser': { 
    name: 'Hydrating Facial Cleanser', 
    brand: 'CeraVe', 
    category: 'cleanser',
    mechanisms: [{ vector: 'hydrating', strength: 70 }, { vector: 'soothing', strength: 65 }],
    keyIngredients: ['Ceramides', 'Hyaluronic Acid', 'Glycerin'],
    cautionIngredients: [],
    targetConcerns: ['dehydration', 'redness'],
    avoidForSkinTypes: [],
    irritationLevel: 'low',
  },
  'drunk_elephant': { 
    name: 'Protini Polypeptide Cream', 
    brand: 'Drunk Elephant', 
    category: 'moisturizer',
    mechanisms: [{ vector: 'anti_aging', strength: 80 }, { vector: 'hydrating', strength: 75 }],
    keyIngredients: ['Peptides', 'Amino Acids', 'Pygmy Waterlily'],
    cautionIngredients: [],
    targetConcerns: ['wrinkles', 'dullness'],
    avoidForSkinTypes: [],
    irritationLevel: 'low',
  },
  'estee_lauder_anr': { 
    name: 'Advanced Night Repair', 
    brand: 'Estée Lauder', 
    category: 'serum',
    mechanisms: [{ vector: 'repair', strength: 85 }, { vector: 'anti_aging', strength: 80 }],
    keyIngredients: ['Bifida Ferment Lysate', 'Hyaluronic Acid', 'Sodium Lactate'],
    cautionIngredients: ['Fragrance'],
    targetConcerns: ['wrinkles', 'dullness', 'dehydration'],
    avoidForSkinTypes: [],
    irritationLevel: 'low',
  },
  'tretinoin': { 
    name: 'Tretinoin 0.05%', 
    brand: 'Generic', 
    category: 'treatment',
    mechanisms: [{ vector: 'anti_aging', strength: 95 }, { vector: 'repair', strength: 90 }],
    keyIngredients: ['Tretinoin 0.05%'],
    cautionIngredients: ['Tretinoin'],
    targetConcerns: ['acne', 'wrinkles', 'dark_spots'],
    avoidForSkinTypes: ['sensitive', 'dry'],
    irritationLevel: 'high',
  },
  'olay_retinol': { 
    name: 'Retinol24 Night Serum', 
    brand: 'Olay', 
    category: 'serum',
    mechanisms: [{ vector: 'anti_aging', strength: 75 }, { vector: 'hydrating', strength: 60 }],
    keyIngredients: ['Retinol', 'Niacinamide', 'Vitamin B3'],
    cautionIngredients: ['Retinol'],
    targetConcerns: ['wrinkles', 'dullness'],
    avoidForSkinTypes: ['sensitive'],
    irritationLevel: 'medium',
  },
  'salicylic_cleanser': { 
    name: 'SA Smoothing Cleanser', 
    brand: 'CeraVe', 
    category: 'cleanser',
    mechanisms: [{ vector: 'oil_control', strength: 80 }, { vector: 'soothing', strength: 50 }],
    keyIngredients: ['Salicylic Acid', 'Ceramides', 'Niacinamide'],
    cautionIngredients: ['Salicylic Acid'],
    targetConcerns: ['acne', 'pores'],
    avoidForSkinTypes: ['dry', 'sensitive'],
    irritationLevel: 'medium',
  },
  'azelaic_acid': { 
    name: 'Azelaic Acid Suspension 10%', 
    brand: 'The Ordinary', 
    category: 'treatment',
    mechanisms: [{ vector: 'brightening', strength: 75 }, { vector: 'soothing', strength: 70 }],
    keyIngredients: ['Azelaic Acid 10%'],
    cautionIngredients: [],
    targetConcerns: ['acne', 'dark_spots', 'redness'],
    avoidForSkinTypes: [],
    irritationLevel: 'low',
  },
};

// Concern to mechanism mapping
const CONCERN_MECHANISM_MAP: Record<SkinConcern, MechanismVector[]> = {
  acne: ['oil_control', 'soothing'],
  dark_spots: ['brightening'],
  wrinkles: ['anti_aging', 'repair'],
  dullness: ['brightening', 'hydrating'],
  redness: ['soothing', 'repair'],
  pores: ['oil_control'],
  dehydration: ['hydrating', 'repair'],
};

// Calculate match score based on skin profile and product
function calculateMatchScore(
  product: typeof KNOWN_PRODUCTS[string],
  skinType: SkinType,
  concerns: SkinConcern[]
): { score: number; matchedConcerns: SkinConcern[]; unmatchedConcerns: SkinConcern[]; vetoReason?: string } {
  let score = 50; // Base score
  const matchedConcerns: SkinConcern[] = [];
  const unmatchedConcerns: SkinConcern[] = [];
  
  // Check for VETO conditions first
  if (product.avoidForSkinTypes.includes(skinType)) {
    const vetoReason = skinType === 'sensitive' 
      ? `High irritation risk for ${skinType} skin`
      : skinType === 'dry' 
        ? `May be too drying for ${skinType} skin`
        : `Not recommended for ${skinType} skin`;
    return { score: 25, matchedConcerns: [], unmatchedConcerns: concerns, vetoReason };
  }
  
  // Skin type compatibility bonus
  if (skinType === 'oily' && product.mechanisms.some(m => m.vector === 'oil_control')) {
    score += 15;
  } else if (skinType === 'dry' && product.mechanisms.some(m => m.vector === 'hydrating')) {
    score += 15;
  } else if (skinType === 'sensitive' && product.irritationLevel === 'low') {
    score += 10;
  } else if (skinType === 'combination') {
    score += 5; // Neutral
  } else if (skinType === 'normal') {
    score += 10;
  }
  
  // Irritation penalty for sensitive skin
  if (skinType === 'sensitive' && product.irritationLevel === 'high') {
    score -= 25;
  } else if (skinType === 'sensitive' && product.irritationLevel === 'medium') {
    score -= 10;
  }
  
  // Concern matching
  concerns.forEach(concern => {
    if (product.targetConcerns.includes(concern)) {
      score += 12;
      matchedConcerns.push(concern);
    } else {
      // Check if product mechanisms align with concern
      const neededMechanisms = CONCERN_MECHANISM_MAP[concern];
      const hasMatchingMechanism = product.mechanisms.some(m => 
        neededMechanisms.includes(m.vector) && m.strength >= 60
      );
      if (hasMatchingMechanism) {
        score += 6;
        matchedConcerns.push(concern);
      } else {
        unmatchedConcerns.push(concern);
      }
    }
  });
  
  // Cap the score
  score = Math.min(98, Math.max(15, score));
  
  return { score, matchedConcerns, unmatchedConcerns };
}

// Mock product analysis with skin profile integration
export function analyzeProduct(
  session: Session,
  preview: string
): { session: Session; result: ProductAnalysisResult } {
  // Simulate product recognition - in demo, randomly pick a known product
  const productKeys = Object.keys(KNOWN_PRODUCTS);
  const randomKey = productKeys[Math.floor(Math.random() * productKeys.length)];
  const product = KNOWN_PRODUCTS[randomKey];
  
  // Get user's skin profile
  const skinType = session.diagnosis?.skinType || 'combination';
  const concerns = session.diagnosis?.concerns || [];
  const hasDiagnosis = !!session.diagnosis?.skinType;
  
  // Calculate match score with skin profile integration
  const { score, matchedConcerns, unmatchedConcerns, vetoReason } = calculateMatchScore(
    product,
    skinType,
    concerns
  );
  
  // Add randomness for demo variety
  const finalScore = Math.min(98, Math.max(15, score + Math.floor(Math.random() * 10) - 5));
  
  // Determine suitability
  let suitability: ProductAnalysisResult['suitability'];
  if (vetoReason) {
    suitability = 'poor';
  } else if (finalScore >= 80) {
    suitability = 'excellent';
  } else if (finalScore >= 65) {
    suitability = 'good';
  } else if (finalScore >= 45) {
    suitability = 'moderate';
  } else {
    suitability = 'poor';
  }
  
  // Generate usage advice based on skin type
  let timing: 'AM' | 'PM' | 'both' = 'both';
  let notes = '';
  
  if (product.category === 'treatment' || product.keyIngredients.some(i => i.includes('Retinol') || i.includes('Tretinoin'))) {
    timing = 'PM';
    notes = skinType === 'sensitive'
      ? 'Start very slowly: once per week, building up gradually. Monitor for irritation.'
      : 'Start with 2-3 nights/week. Always use sunscreen the next day.';
  } else if (product.mechanisms.some(m => m.vector === 'brightening')) {
    timing = 'AM';
    notes = 'Best used in the morning. Follow with SPF to protect from photosensitivity.';
  } else if (product.category === 'cleanser') {
    timing = 'both';
    notes = skinType === 'dry' 
      ? 'Use once daily in the evening to avoid over-cleansing.'
      : 'Can be used morning and evening.';
  } else {
    timing = 'both';
    notes = 'Can be used as part of your daily routine.';
  }
  
  // Add concern-specific notes
  if (matchedConcerns.length > 0 && hasDiagnosis) {
    const concernNames = matchedConcerns.map(c => c.replace('_', ' ')).join(', ');
    notes += ` Good match for your concerns: ${concernNames}.`;
  }
  
  // Generate dupe recommendation
  const expensiveProducts = ['la_mer', 'skinceuticals_ce', 'drunk_elephant', 'estee_lauder_anr'];
  let dupeRecommendation: ProductAnalysisResult['dupeRecommendation'];
  
  if (expensiveProducts.includes(randomKey)) {
    // Find a better-matched dupe if available
    const dupeMap: Record<string, { name: string; brand: string }> = {
      'la_mer': { name: 'Moisturizing Cream', brand: 'CeraVe' },
      'skinceuticals_ce': { name: 'Vitamin C Suspension 23%', brand: 'The Ordinary' },
      'drunk_elephant': { name: 'Buffet', brand: 'The Ordinary' },
      'estee_lauder_anr': { name: 'Snail Mucin 96%', brand: 'COSRX' },
    };
    
    const dupe = dupeMap[randomKey];
    if (dupe) {
      dupeRecommendation = {
        ...dupe,
        reason: hasDiagnosis 
          ? `Similar efficacy for ${skinType} skin at a fraction of the price`
          : 'Similar key ingredients at a fraction of the price',
        savingsPercent: 75 + Math.floor(Math.random() * 15),
      };
    }
  }
  
  const result: ProductAnalysisResult = {
    productName: product.name,
    brand: product.brand,
    matchScore: finalScore,
    suitability,
    mechanisms: product.mechanisms,
    ingredients: {
      beneficial: product.keyIngredients,
      caution: product.cautionIngredients,
      veto: vetoReason,
    },
    usageAdvice: {
      timing,
      notes,
    },
    dupeRecommendation,
    // Extended data for UI
    skinProfileMatch: hasDiagnosis ? {
      skinType,
      matchedConcerns,
      unmatchedConcerns,
    } : undefined,
  };
  
  return {
    session: {
      ...session,
      state: 'P2_PRODUCT_RESULT',
      productPhoto: { preview },
      productAnalysis: result,
    },
    result,
  };
}
