import type {
  CompatibilityContext,
  CompatibilityLanguage,
  CompatibilityRating,
  CompatibilityResult,
  IngredientFamily,
  TaggedProduct,
} from '@/lib/routineCompatibility/types';

const isStrongActive = (family: IngredientFamily) =>
  family === 'exfoliation_acids' ||
  family === 'retinoids' ||
  family === 'benzoyl_peroxide' ||
  family === 'vitamin_c_strong';

const hasFamily = (product: TaggedProduct, family: IngredientFamily) => product.families.has(family);

const anyHasFamily = (products: TaggedProduct[], family: IngredientFamily) => products.some((p) => hasFamily(p, family));

const t = (language: CompatibilityLanguage | undefined, en: string, cn: string) => (language === 'CN' ? cn : en);

function buildQuickChips(base: TaggedProduct, language: CompatibilityLanguage | undefined) {
  const hasStrongSignal =
    hasFamily(base, 'retinoids') ||
    hasFamily(base, 'exfoliation_acids') ||
    hasFamily(base, 'benzoyl_peroxide') ||
    hasFamily(base, 'vitamin_c_strong');

  const avoidTargets: string[] = [];
  if (hasFamily(base, 'exfoliation_acids')) avoidTargets.push(t(language, 'retinoids', '维A类'));
  if (hasFamily(base, 'retinoids')) avoidTargets.push(t(language, 'strong exfoliants', '强去角质'));
  if (hasFamily(base, 'benzoyl_peroxide')) avoidTargets.push(t(language, 'retinoids', '维A类'));

  const uniqueAvoidTargets = Array.from(new Set(avoidTargets));

  return {
    compatible: t(
      language,
      'Generally compatible with: Hydrators, moisturizers, SPF',
      '通常可搭配：补水、保湿、防晒',
    ),
    caution: hasStrongSignal
      ? t(language, 'Use caution with: Retinoids, strong exfoliants', '谨慎搭配：维A类、强去角质')
      : undefined,
    avoid:
      uniqueAvoidTargets.length > 0
        ? t(
            language,
            `Avoid same routine with: ${uniqueAvoidTargets.join(', ')}`,
            `同一套流程尽量避免：${uniqueAvoidTargets.join('、')}`,
          )
        : undefined,
  };
}

function buildRecommendations(
  rating: CompatibilityRating,
  base: TaggedProduct,
  others: TaggedProduct[],
  ctx: CompatibilityContext,
) {
  const language = ctx.language;
  const all = [base, ...others];
  const hasStrongInSet = all.some((product) => Array.from(product.families).some((family) => isStrongActive(family)));

  const layering = [
    t(language, 'Layer thinnest to thickest.', '建议从轻薄到厚重叠加。'),
    t(language, 'Follow hydrating layers with a moisturizer.', '补水层后加保湿层。'),
  ];

  if (ctx.timing === 'AM' || ctx.timing === 'Both') {
    layering.push(t(language, 'Finish AM with sunscreen.', '早间最后一步请用防晒。'));
  }

  const frequency =
    rating === 'avoid_same_routine'
      ? [
          t(language, 'Use in separate routines (AM vs PM) or alternate nights.', '建议分开时段（早晚分开）或隔夜使用。'),
          t(language, 'Do not stack both strong-active products in the same routine.', '避免在同一套流程叠加两个强活性产品。'),
        ]
      : rating === 'caution'
        ? [
            t(language, 'Start 2–3x/week and increase as tolerated.', '建议从每周 2–3 次开始，再按耐受增加。'),
            t(language, 'Keep active layering simple when skin feels reactive.', '皮肤反应期请减少活性叠加。'),
          ]
        : [
            t(language, 'No major conflict detected; keep your routine simple and consistent.', '未发现明显冲突，建议保持流程简洁稳定。'),
            t(language, 'Adjust frequency based on comfort and tolerance.', '按皮肤舒适度和耐受度调整频率。'),
          ];

  let schedule: string[] | undefined;
  if (ctx.timing === 'AM') {
    schedule = hasStrongInSet
      ? [t(language, 'Prefer PM for strong actives when possible.', '若可选，强活性更建议放在晚间。')]
      : [t(language, 'AM routine can stay focused on hydration + SPF.', '早间以补水和防晒为主即可。')];
  } else if (ctx.timing === 'PM') {
    schedule = [t(language, 'Use stronger actives in PM and keep the rest soothing.', '晚间可放强活性，其余步骤尽量舒缓。')];
  } else if (ctx.timing === 'Both') {
    schedule = hasStrongInSet
      ? [
          t(language, 'AM: hydrators/moisturizer/SPF.', '早间：补水/保湿/防晒。'),
          t(language, 'PM: strong actives + barrier-support steps.', '晚间：强活性 + 屏障修护。'),
        ]
      : [t(language, 'AM: hydration + SPF. PM: hydration + repair.', '早间：补水+防晒；晚间：补水+修护。')];
  }

  return {
    layering,
    frequency,
    ...(schedule && schedule.length ? { schedule } : {}),
  };
}

export function analyzeCompatibility(base: TaggedProduct, others: TaggedProduct[], ctx: CompatibilityContext): CompatibilityResult {
  const language = ctx.language;
  const reasons: string[] = [];
  const chips = buildQuickChips(base, language);
  const hasOthers = others.length > 0;

  const hasAcidsPair =
    (hasFamily(base, 'exfoliation_acids') && anyHasFamily(others, 'retinoids')) ||
    (hasFamily(base, 'retinoids') && anyHasFamily(others, 'exfoliation_acids'));
  const hasBpRetinoidPair = hasFamily(base, 'benzoyl_peroxide') && anyHasFamily(others, 'retinoids');

  let rating: CompatibilityRating = 'good';
  if (hasOthers && (hasAcidsPair || hasBpRetinoidPair)) {
    rating = 'avoid_same_routine';
    if (hasAcidsPair) {
      reasons.push(
        t(
          language,
          'Exfoliation acids + retinoids can be too strong in the same routine.',
          '去角质酸与维A类同用，强度可能过高。',
        ),
      );
    }
    if (hasBpRetinoidPair) {
      reasons.push(
        t(
          language,
          'Benzoyl peroxide + retinoids may increase irritation in one routine.',
          '过氧化苯甲酰与维A类同用，可能增加刺激风险。',
        ),
      );
    }
  }

  const overlapAcids = hasFamily(base, 'exfoliation_acids') && anyHasFamily(others, 'exfoliation_acids');
  const overlapRetinoids = hasFamily(base, 'retinoids') && anyHasFamily(others, 'retinoids');
  const strongCWithAcids =
    (hasFamily(base, 'vitamin_c_strong') && anyHasFamily(others, 'exfoliation_acids')) ||
    (hasFamily(base, 'exfoliation_acids') && anyHasFamily(others, 'vitamin_c_strong'));
  const highSensitivity = ctx.sensitivity === 'High';
  const irritationSignal = base.irritationSignal === true;

  if (rating !== 'avoid_same_routine') {
    if (overlapAcids) {
      reasons.push(
        t(
          language,
          'Multiple exfoliation-acid products in one routine may raise irritation risk.',
          '同一流程叠加多个酸类产品，可能提高刺激风险。',
        ),
      );
    }
    if (overlapRetinoids) {
      reasons.push(
        t(
          language,
          'Using more than one retinoid product together may be too intense.',
          '同一流程叠加多个维A产品，可能过于刺激。',
        ),
      );
    }
    if (strongCWithAcids) {
      reasons.push(
        t(
          language,
          'Strong vitamin C with exfoliation acids may be too intense in one routine.',
          '高强度维C与酸类同用，可能过于刺激。',
        ),
      );
    }
    if (highSensitivity) {
      reasons.push(
        t(
          language,
          'High sensitivity profile: keep active layering conservative.',
          '敏感度较高：建议更保守地叠加活性产品。',
        ),
      );
    }
    if (irritationSignal) {
      reasons.push(
        t(
          language,
          'Current product has irritation signals, so layering should stay simple.',
          '当前产品存在刺激提示，叠加建议保持简化。',
        ),
      );
    }

    if (reasons.length > 0) rating = 'caution';
  }

  if (reasons.length === 0) {
    reasons.push(
      hasOthers
        ? t(
            language,
            'No high-risk active conflict detected across selected products.',
            '在已选产品之间未发现高风险活性冲突。',
          )
        : t(
            language,
            'Add products to check pair-specific compatibility.',
            '可继续添加产品，查看具体搭配兼容性。',
          ),
    );
  }

  return {
    rating,
    reasons: reasons.slice(0, 3),
    chips,
    recommendations: buildRecommendations(rating, base, others, ctx),
  };
}
