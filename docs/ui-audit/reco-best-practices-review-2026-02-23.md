# Reco Best Practices Review (2026-02-23)

## Scope
- Module: `photo_modules_v1`
- Module: `ingredient_plan_v2`
- Module: recommendations / competitors / dupes blocks

## 1. Confidence Communication
- Current direction is correct: confidence is now explicit (`low_confidence`), and photo/no-photo paths can continue without hard block.
- Best practice:
  - Always expose one-line confidence context near primary CTA.
  - Separate "quality degraded" from "medical risk" language.
  - For low confidence, keep actionability but reduce treatment aggressiveness.
- Recommended UI copy pattern:
  - EN: `Confidence: conservative due to limited routine/recent logs.`
  - CN: `当前为保守建议：缺少近期护理/打卡信息。`

## 2. Evidence Chain Closure
- Target chain: `issue region -> ingredient rationale -> product candidate`.
- Best practice:
  - Every ingredient card should show "why" tied to detected issues.
  - Every product row should expose a short `why_match` mapped to that ingredient.
  - If evidence is missing, degrade gracefully to ingredient-level advice and surface reason.
- Implemented direction:
  - `ingredient_plan_v2.targets[*].why`
  - `ingredient_plan_v2.targets[*].products.{competitors,dupes}`

## 3. Personalization Transparency
- Best practice:
  - Always disclose budget basis: user-set vs inferred vs diversified fallback.
  - When inferred from behavior, keep policy explicit (window + threshold).
  - Do not silently override explicit user preference.
- Implemented direction:
  - `budget_context.effective_tier`
  - `budget_context.source`
  - `budget_context.diversified_when_unknown`
  - Auto-learn guard: `5 clicks / 14 days / >=60% / lead>=2` and only when budget is unknown.

## 4. Safety UX
- Best practice:
  - Use structured severity language (Mild/Moderate/Noticeable/High), not internal score tokens.
  - Reserve technical codes (`Sx`, `Pxx`) for debug only.
  - Keep avoid/conflict lists concise and actionable.
- Implemented direction:
  - Photo modules now display severity label instead of raw `Sx` by default.
  - Ingredient plan avoids raw `Pxx` in default UI.

## 5. Action Cost Control
- Best practice:
  - Limit top-level decisions per card.
  - Keep each ingredient row to one main intent: understand -> pick product.
  - Constrain per-ingredient product count to avoid choice overload.
- Implemented direction:
  - Fixed quota: `2 competitors + 1 dupe` per ingredient.
  - Higher information density is moved to secondary text and badges.

## 6. Metrics and Experiment Design
- Recommended A/B metrics:
  - `photo_modules_module_tap_rate`
  - `ingredient_plan_product_tap_rate`
  - `reco_outbound_open_rate`
  - `low_confidence_continue_rate`
  - `7d repeat_session_rate`
- Event mapping:
  - `aurora_photo_modules_module_tap`
  - `aurora_photo_modules_issue_tap`
  - `aurora_photo_modules_product_tap`
  - `aurora_ingredient_plan_product_tap`
  - `ui_pdp_opened` / `ui_outbound_opened`

## 7. Next Iteration Recommendations
- Add explicit "why this price tier" tooltip near budget context.
- Add before/after follow-up card after 7 days to close recommendation feedback loop.
- Add micro-feedback on each ingredient row (`too strong`, `not effective`) to improve rule tuning.
