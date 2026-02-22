# Question Prompt Spec (v1)

## Scope
Unified prompt UI primitives for `/chat` ask/survey/questionnaire flows.

## Layout Hierarchy
1. Header:
Back button on the left (multi-step only), optional step label + progress, title (max 2 lines), helper (max 2 lines).
2. Body:
Option Cards for single-select (radio semantics) and multi-select (checkbox semantics), optional secondary text.
3. Footer:
Primary CTA full-width (56px height, 16px radius), tertiary text action under primary (`Not now`), never side-by-side with primary.

## Tokens
Source: `src/components/prompt/promptTokens.ts`

1. Sheet radius: `22`
2. Sheet paddings: `20/16/16` (x/top/bottom)
3. OptionCard height:
single-line `50`, with secondary line `64`
4. OptionCard radius: `16`
5. Primary CTA: height `56`, radius `16`

## Visual Rules
1. Selected OptionCard:
subtle tint + stronger border + checkmark.
2. Avoid saturated fill blocks for selected state.
3. Skip-like action must be tertiary text, not equal-weight secondary button next to primary.

## i18n Rules
All shared prompt text must use `t(key, lang)`.

Required shared keys in `src/lib/i18n.ts`:
1. `prompt.common.continue`
2. `prompt.common.next`
3. `prompt.common.notNow`
4. `prompt.common.back`
5. `prompt.common.stepOf`

## Accessibility
1. Single-select group:
wrapper `role=\"radiogroup\"`, options `role=\"radio\"`, with `aria-checked`.
2. Multi-select group:
wrapper `role=\"group\"`, options `role=\"checkbox\"`, with `aria-checked`.
3. CTA buttons require meaningful labels.
4. Never autofocus tertiary `Not now`.

## Components
1. `QuestionPrompt.tsx`
Container that supports `inline | sheet | drawer | auto`.
2. `PromptHeader.tsx`
Back + step label + progress + title/helper.
3. `PromptFooter.tsx`
Sticky-capable footer with primary CTA + tertiary action.
4. `OptionCard.tsx`
Single prompt option with selected and disabled states.
5. `OptionCardGroup.tsx`
Single/multi selection group with selection limits.

## Do / Don't
1. Do:
keep skip/not-now low emphasis and below primary.
2. Do:
disable primary until required selections are complete.
3. Don't:
present `Skip` as equal visual weight to primary completion actions.
4. Don't:
mix inline hardcoded EN/CN for shared prompt chrome.

## Adoption Guardrail
1. New ask/survey/prompt UI in `/chat` must use the shared prompt system (`PromptHeader`, `PromptFooter`, `OptionCardGroup`).
2. Legacy prompt cards are deprecated and should not be used for new flows:
`src/components/aurora/cards/AuroraProfileCard.tsx`
`src/components/aurora/cards/AuroraBudgetCard.tsx`
`src/components/aurora/cards/AuroraScoringCard.tsx`
`src/components/chat/cards/ContextCard.tsx`
`src/components/chat/cards/BudgetCard.tsx`
`src/components/chat/cards/RiskCheckCard.tsx`
3. Migration policy is one-way:
do not backport new UX work into legacy cards; migrate to prompt primitives instead.

## QA Checklist
1. EN baseline length stress:
verify long English title/helper and long option labels wrap without clipping on narrow widths.
2. Narrow-screen layout:
validate prompt surfaces at ~320px viewport width.
3. Sticky footer safety:
for sticky footer flows, ensure body content includes enough bottom padding so the last interactive field is not covered.
4. Keyboard smoke:
single-select option groups must expose `radiogroup/radio` semantics and support arrow-key traversal; multi-select groups must expose `group/checkbox` semantics with `aria-checked`.
5. Tertiary action hierarchy:
`Not now` (when present) must stay visually weaker than primary CTA.

## Dev Harness
1. Dev-only prompt stress route:
`/qa/prompt-harness` (available in development builds only).
2. Use this harness to manually inspect long-string wrapping, sticky footer overlap, and keyboard focus behavior before shipping.
3. Production safety:
the route is gated in `src/App.tsx` behind `import.meta.env.DEV`; production builds should not expose `/qa/prompt-harness` (falls through to not-found route).

## Automated Guardrails
1. Guardrail tests live in:
`src/test/promptGuardrails.repoScan.test.ts`
2. Run guardrails only:
`npm run test -- --run src/test/promptGuardrails.repoScan.test.ts`
3. Current scan scope:
`src/pages/BffChat.tsx` prompt sheet slices and migrated chat card prompt surfaces.
4. Guardrails check:
hardcoded prompt-like EN literals where i18n is expected, chips-panel priority layering in `/chat`, and best-effort detection for same-level primary/skip footer regressions.
5. Inline whitelist directives (last resort):
`// prompt-guardrail-ignore hardcoded-copy`
`// prompt-guardrail-ignore dual-footer`
`// prompt-guardrail-ignore all`
6. If whitelist is used, always add a short reason on the same line and a TODO owner/date.

## How To Add A New Prompt
1. Build UI with `PromptHeader` + prompt body (`OptionCardGroup` or form controls) + `PromptFooter`.
2. Keep CTA hierarchy:
one full-width primary (`56px`) and optional tertiary `Not now` text below it.
3. Put close/cancel in header (`X` or back), not as a same-level footer button.
4. Add copy via `t(key, language)` in `src/lib/i18n.ts`.
5. Add bottom padding so sticky footer never covers the last field.
6. Verify:
run prompt harness at `/qa/prompt-harness`, then run `npm run test -- --run src/test/promptGuardrails.repoScan.test.ts`.

## Metrics To Watch
Track these existing events/rates after rollout (no schema changes):
1. `diagnosis_submit` vs `diagnosis_skip` ratio.
2. `photo_upload` vs `photo_skip` ratio.
3. Routine analysis invocation rates:
`runRoutineSkinAnalysis` path vs baseline/low-confidence fallback path.
