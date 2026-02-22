# PLANS.md — Question Prompt Standardization (P0-first)

## Execution Log
1. 2026-02-22 — Checkpoint 1 complete (shared prompt primitives + spec + prompt common i18n keys).
2. 2026-02-22 — Checkpoint 2 complete (`DiagnosisCard` migrated to PromptHeader/OptionCardGroup/PromptFooter with step/progress and tertiary Not now mapping to existing skip analytics).
3. 2026-02-22 — Checkpoint 3 complete (`QuickProfileFlow` migrated to prompt structure with Step X of 6 + progress, Continue disabled until selection, tertiary Not now).
4. 2026-02-22 — Checkpoint 4 complete:
   - Added `src/components/prompt/chipPriority.ts` (`id` first, label second; primary/skip/neutral classifier + deterministic primary ranking).
   - Updated global chips renderer in `src/pages/BffChat.tsx` (`item.kind === 'chips'`) to:
     - render at most one primary as full-width CTA (`.prompt-primary-cta`, 56px),
     - render skip-like as tertiary Not now text action,
     - keep neutral chips as chips,
     - preserve existing `onChip(chip)` callback path and payload.
   - Added tests `src/test/chipPriority.test.ts`:
     - continue + skip mixed case,
     - multi-primary deterministic selection,
     - CN scenario via `chip_id`,
     - null/undefined safety.
   - Verification: `npm run lint` ✅, `npm run test -- --run` ✅ (29 files / 133 tests), `npm run build` ✅.
5. 2026-02-22 — Checkpoint 5 complete:
   - Refactored `src/components/chat/cards/PhotoUploadCard.tsx` into 2-step flow using `PromptHeader` + `PromptFooter`.
   - Step 1 (`Step 1 of 2`): photo slot selection + camera/album actions; primary `Continue` (full width 56 via prompt footer), tertiary `Continue without photos`.
   - Step 2 (`Step 2 of 2`): consent-only confirmation; header back enabled; primary `Confirm & continue`; tertiary hidden.
   - Kept callbacks/payloads unchanged:
     - tertiary action still triggers `onAction('photo_skip')`,
     - upload still triggers `onAction('photo_upload', { photos, consent })`,
     - sample action remains `onAction('photo_use_sample_sample_set_A')`.
   - Added EN/CN i18n keys in `src/lib/i18n.ts`:
     - `photo.step1.title`, `photo.step1.helper`, `photo.step2.title`, `photo.step2.helper`,
       `photo.btn.confirmContinue`, `photo.btn.continueWithout`.
   - Updated tests in `src/test/photoUploadCard.smoke.test.tsx` for new 2-step behavior and skip mapping.
   - Verification: `npm run lint` ✅, `npm run test -- --run` ✅ (29 files / 134 tests), `npm run build` ✅.
6. 2026-02-22 — Checkpoint 6 complete:
   - Refactored A-002 routine intake UI in `src/pages/BffChat.tsx` to prompt hierarchy:
     - `PromptHeader` for title/helper,
     - `PromptFooter` for CTA hierarchy.
   - CTA hierarchy now:
     - Primary: `routine.cta.saveAnalyze` (`Save & analyze`) full-width via prompt CTA style (56px),
     - Tertiary: `routine.cta.baselineOnly` (`Use baseline only`) mapped to the exact existing low-confidence baseline flow.
   - Removed footer `Cancel` button; close/cancel is now the sheet header close control (`X`) via existing `onClose` behavior.
   - Density reduction (minimal, no data-model changes):
     - stronger spacing/grouping in AM/PM sections,
     - lightweight section headers,
     - increased body bottom padding to avoid sticky-footer overlap.
   - Added routine intake i18n keys (EN/CN) in `src/lib/i18n.ts` for title/helper/tabs/labels/placeholders/CTA/user text.
   - Added test `src/test/routineIntakeI18n.test.ts` to lock core routine keys.
   - Non-obvious decision:
     - kept AM/PM as tabbed single-screen flow (no synthetic Step X/Y) to avoid changing submission/state behavior.
   - Verification: `npm run lint` ✅, `npm run test -- --run` ✅ (30 files / 135 tests), `npm run build` ✅.
7. 2026-02-22 — Checkpoint 7 complete (P1-1: C-004 anti-regression hardening):
   - Verified C-004 legacy prompt cards remain 0-runtime usage in `src/` imports.
   - Added `@deprecated` annotations to legacy components:
     - `src/components/aurora/cards/AuroraProfileCard.tsx`
     - `src/components/aurora/cards/AuroraBudgetCard.tsx`
     - `src/components/aurora/cards/AuroraScoringCard.tsx`
     - `src/components/chat/cards/ContextCard.tsx`
     - `src/components/chat/cards/BudgetCard.tsx`
     - `src/components/chat/cards/RiskCheckCard.tsx`
   - Updated `docs/ui-system/question-prompts-spec.md` with one-way adoption guardrail:
     - new ask/survey UI must use prompt primitives,
     - legacy cards are deprecated and should not be used for new flows.
   - Non-obvious decision:
     - chose deprecation + spec guardrail (not file moves) for lowest merge risk while preventing prompt-style drift.
   - Verification: `npm run lint` ✅, `npm run test -- --run` ✅ (30 files / 135 tests), `npm run build` ✅.
8. 2026-02-22 — Pre-Checkpoint 8 audit note:
   - Checked unexpected dirty files (`index.html`, `src/components/mobile/BottomNav.tsx`, `src/pages/Home.tsx`): no diffs; treated as transient state; no action taken.
9. 2026-02-22 — Checkpoint 8 complete (P1-2: A-003 profile sheet hierarchy + density):
   - Refactored profile edit sheet in `src/pages/BffChat.tsx` to prompt layout:
     - added `PromptHeader` (title + helper),
     - moved Save to sticky `PromptFooter` primary CTA (56px via `.prompt-primary-cta`),
     - removed footer Cancel button; close/cancel remains sheet header close (`X`) with unchanged `onClose`.
   - Reduced form density without behavior changes:
     - grouped fields into lightweight section cards (`skinBasics`, `healthContext`, `travel`, `concerns`, `preferences`),
     - increased vertical spacing and retained bottom body padding (`pb-28`) to avoid sticky-footer overlap.
   - i18n improvements:
     - added profile sheet keys in `src/lib/i18n.ts` for title/helper/section headers/save CTA.
     - sheet title and prompt title/helper/section headers/save CTA now resolve through `t(key, language)`.
   - Added regression test `src/test/profileSheetI18n.test.ts` to lock new EN/CN profile sheet keys.
   - Guardrail confirmation:
     - no changes to `saveProfile` logic, validation, patch/payload schema, or value mappings.
   - Verification: `npm run lint` ✅, `npm run test -- --run` ✅ (31 files / 136 tests), `npm run build` ✅.
10. 2026-02-22 — Checkpoint 9 complete (P1-4: B-005 ingredient next-questions bilingual consistency):
   - Updated `src/components/aurora/cards/IngredientReportCard.tsx` next-questions block:
     - replaced hardcoded visible strings with `t(key, language)`,
     - localized title/helper/complete-profile CTA/saved message via new `ingredientReport.nextQuestions.*` keys,
     - upgraded “Complete profile” visual treatment to explicit primary style without changing callback or payload path.
   - Added EN/CN keys to `src/lib/i18n.ts`:
     - `ingredientReport.nextQuestions.title`
     - `ingredientReport.nextQuestions.helper`
     - `ingredientReport.nextQuestions.completeProfile`
     - `ingredientReport.nextQuestions.saved`
   - Added regression test `src/test/ingredientReportNextQuestionsI18n.test.ts`.
   - Guardrail confirmation:
     - no change to next-question selection behavior (`onSelectNextQuestion`), profile-open callback (`onOpenProfile`), payload shape, or analytics/event pathways.
   - Verification: `npm run lint` ✅, `npm run test -- --run` ✅ (32 files / 137 tests), `npm run build` ✅.
11. 2026-02-22 — Checkpoint 10 complete (P1-3: A-004 daily check-in UX clarity + hierarchy):
   - Refactored check-in sheet in `src/pages/BffChat.tsx` to prompt hierarchy:
     - added `PromptHeader` (title + helper),
     - replaced footer button row with sticky `PromptFooter` primary Save (56px),
     - removed footer Cancel; close/cancel remains header close (`X`) with unchanged `onClose`.
   - Reduced understanding cost for sliders:
     - each metric now includes a 1-line scale explanation under the label (`0..5` semantics),
     - EN baseline and CN translation via i18n keys.
   - Added check-in i18n keys in `src/lib/i18n.ts`:
     - `checkin.sheet.title`, `checkin.sheet.helper`,
     - `checkin.metric.redness|acne|hydration.label`,
     - `checkin.metric.redness|acne|hydration.helper`,
     - `checkin.notes.label`, `checkin.notes.placeholder`,
     - `checkin.cta.save`, `checkin.userText`.
   - Added regression test `src/test/checkinSheetI18n.test.ts`.
   - Non-obvious decision:
     - did not add tertiary “Not now”, because current check-in flow has no dedicated skip event/path; adding one would require inventing new analytics/behavior.
   - Guardrail confirmation:
     - no change to `/v1/tracker/log` payload schema,
     - no change to `saveCheckin` submission logic/endpoint,
     - no new analytics schema introduced.
   - Verification: `npm run lint` ✅, `npm run test -- --run` ✅ (33 files / 138 tests), `npm run build` ✅.
12. 2026-02-22 — Checkpoint 11 complete (prompt system hardening: QA + stress + a11y smoke):
   - Added prompt keyboard/a11y hardening in `src/components/prompt/OptionCardGroup.tsx`:
     - single-select groups now support arrow-key traversal (`ArrowUp/Down/Left/Right`, `Home`, `End`) with focus move + selection update,
     - retained existing `radiogroup/radio` and `group/checkbox` semantics.
   - Added long-copy wrapping hardening in `src/components/prompt/OptionCard.tsx`:
     - option title/description now use `break-words` to avoid clipping on narrow widths.
   - Added dev-only stress harness:
     - new page `src/pages/PromptQAHarness.tsx`,
     - dev-only route `/qa/prompt-harness` wired in `src/App.tsx`.
   - Sticky-footer coverage hardening:
     - `PhotoUploadCard` selection and consent bodies now include bottom padding (`pb-28`) so sticky footer does not overlap last controls.
     - Verified migrated sheet flows with sticky footers have bottom padding:
       - routine intake (`BffChat`),
       - profile sheet (`BffChat`),
       - check-in sheet (`BffChat`),
       - photo upload card (`PhotoUploadCard`).
     - DiagnosisCard and QuickProfileFlow use non-sticky footers, so overlap risk is not applicable.
   - Added QA docs section in `docs/ui-system/question-prompts-spec.md`:
     - EN long-string checklist,
     - narrow-screen checks,
     - sticky-footer checks,
     - keyboard smoke checks,
     - dev harness usage notes.
   - Added smoke tests in `src/test/promptSystemHardening.test.tsx`:
     - long EN prompt stress rendering under narrow width,
     - role semantics and arrow-key navigation for single-select,
     - checkbox group semantics smoke.
   - Guardrail confirmation:
     - no business logic or payload schema changes in diagnosis/quick-profile/photo/routine/profile/check-in submit paths.
   - Verification: `npm run lint` ✅, `npm run test -- --run` ✅ (34 files / 140 tests), `npm run build` ✅.
13. 2026-02-22 — Checkpoint 12 complete (prompt adoption guardrails, no new deps):
   - Added automated guardrail test suite:
     - `src/test/promptGuardrails.repoScan.test.ts`.
   - Guardrails implemented:
     - hardcoded EN prompt-copy detection in migrated card prompt surfaces (`DiagnosisCard`, `QuickProfileFlow`, `PhotoUploadCard`, `IngredientReportCard`),
     - scoped BffChat prompt-sheet scan (routine/profile/check-in slices) for disallowed prompt literals,
     - chips-panel anti-regression checks in `/chat` (`prioritizeChips`, `primary`/`skip` priority markers, tertiary skip action),
     - best-effort heuristic for same-level primary+skip footer reintroduction in prompt surfaces.
   - Low false-positive controls:
     - scoped to chat prompt files/slices instead of full repo,
     - inline whitelist directives documented and supported:
       - `// prompt-guardrail-ignore hardcoded-copy`
       - `// prompt-guardrail-ignore dual-footer`
       - `// prompt-guardrail-ignore all`
   - Docs updated in `docs/ui-system/question-prompts-spec.md`:
     - added “Automated Guardrails” section,
     - added “How To Add A New Prompt” implementation snippet and checklist.
   - Non-obvious decision:
     - guardrail hardcoded-copy rule in BffChat uses disallowed prompt literals (not generic CN/EN ternary detection) to avoid blocking legitimate non-prompt bilingual UI and keep false positives low.
   - Verification: `npm run lint` ✅, `npm run test -- --run` ✅ (35 files / 144 tests), `npm run build` ✅.
14. 2026-02-22 — Checkpoint 13 complete (release readiness + handoff, no behavior changes):
   - Added release-readiness checks/handoff updates only (no business logic/payload changes).
   - Updated guardrails in `src/test/promptGuardrails.repoScan.test.ts`:
     - added dev-gating test for `/qa/prompt-harness` route in `src/App.tsx`,
     - expanded obvious hardcoded EN phrase coverage for prompt-like copy drift.
   - Updated docs in `docs/ui-system/question-prompts-spec.md`:
     - added explicit note that `/qa/prompt-harness` is dev-gated and not exposed in production builds,
     - added “Metrics To Watch” section:
       - `diagnosis_submit` vs `diagnosis_skip`,
       - `photo_upload` vs `photo_skip`,
       - routine analysis invocation rates (routine path vs low-confidence baseline path).
   - Verification: `npm run lint` ✅, `npm run test -- --run` ✅ (35 files / 145 tests), `npm run build` ✅.

## Release Summary
1. Flows standardized:
`DiagnosisCard`, `QuickProfileFlow`, global chips panel (`item.kind === 'chips'`), `PhotoUploadCard` (2-step), routine intake sheet, profile sheet, check-in sheet, and Ingredient Report next-questions block.
2. UX principles enforced:
Prompt hierarchy (`PromptHeader` + body + sticky `PromptFooter`), single primary full-width CTA (`56px`), skip/not-now demoted to tertiary text, header close/back instead of footer cancel, explicit step/progress where applicable, and EN/ZH i18n via `t(key, language)`.
3. Hardening and guardrails:
keyboard/a11y smoke support, long-string stress harness (`/qa/prompt-harness`, dev-only), sticky-footer overlap protections, repo-scan guardrail tests for hardcoded prompt copy + chips priority hierarchy + primary/skip regression heuristic + QA harness dev-gate assertion.

## Summary
1. Checkpoint 0 is complete with read-only reconnaissance.
2. Baseline checks on current branch:
`npm run lint` fails on existing issue `src/utils/requestWithTimeout.ts:37` (`prefer-const`).
`npm run test` passes (28 files, 129 tests).
`npm run build` passes.
3. Chosen gate (approved): continue with baseline lint exception (only this known lint error is tolerated; any new lint error blocks).
4. Plan Mode constraint: I cannot write files in this mode. On execution mode start, first mutation is creating `pivota-aurora-chatbox/PLANS.md` with this exact plan content.

## Checkpoint 0 Findings (captured)
1. Styling system: Tailwind + shared CSS component classes in `src/index.css` (`chip-button`, `action-button`, `chat-card`).
2. UI primitive layers:
`src/components/ui/dialog.tsx`, `src/components/ui/sheet.tsx`, `src/components/ui/drawer.tsx`.
3. `/chat` currently uses a local inline sheet implementation in `src/pages/BffChat.tsx:1120` instead of shared `ui/sheet`.
4. i18n is custom dictionary + `t(key, lang, params?)` in `src/lib/i18n.ts:424` with EN fallback and simple placeholder replacement.
5. P0 current implementations:
`src/components/chat/cards/DiagnosisCard.tsx`, `src/components/chat/cards/QuickProfileFlow.tsx`, chips renderer in `src/pages/BffChat.tsx:7243`, photo flow in `src/components/chat/cards/PhotoUploadCard.tsx` + `src/pages/BffChat.tsx`, routine intake sheet in `src/pages/BffChat.tsx`.

## Public Interfaces / Types To Add
1. `src/components/prompt/promptTokens.ts`
Export prompt sizing/spacing constants (sheet radius, paddings, option heights, CTA height/radius).
2. `src/components/prompt/OptionCard.tsx`
Props: `label`, `description?`, `selected`, `disabled?`, `onSelect`, `selectionMode`, `ariaLabel?`.
3. `src/components/prompt/OptionCardGroup.tsx`
Props: `selectionMode: 'single' | 'multiple'`, `options`, `value`, `onChange`, `maxSelections?`, `ariaLabel`.
A11y: wrapper role `radiogroup`/`group`, item role `radio`/`checkbox`.
4. `src/components/prompt/PromptHeader.tsx`
Props: `title`, `helper?`, `showBack?`, `onBack?`, `step?: {current,total}`, `language`.
5. `src/components/prompt/PromptFooter.tsx`
Props: `primaryLabel`, `onPrimary`, `primaryDisabled?`, `tertiaryLabel?`, `onTertiary?`, `tertiaryHidden?`, `language`.
6. `src/components/prompt/QuestionPrompt.tsx`
Reusable scaffold container with responsive presentation mode (`inline` / `sheet` / `drawer` / `auto`), using existing project primitives.
7. i18n keys in `src/lib/i18n.ts`:
`prompt.common.continue`, `prompt.common.next`, `prompt.common.notNow`, `prompt.common.back`, `prompt.common.stepOf`.

## Checkpoint Execution Plan

### Checkpoint 1 — Shared prompt system only (no P0 migrations)
1. Add `src/components/prompt/*` scaffold and `docs/ui-system/question-prompts-spec.md`.
2. Add prompt common i18n keys in EN/CN.
3. Add base prompt styles in existing style convention (Tailwind + `src/index.css` component layer), no new dependency.
4. Verification:
`npm run lint` (allow only known baseline error), `npm run test`, `npm run build`.
5. Stop gate:
Report changed files + verification output; request approval before Checkpoint 2.

### Checkpoint 2 — Migrate B-001 DiagnosisCard
1. Refactor `src/components/chat/cards/DiagnosisCard.tsx` to PromptHeader + OptionCardGroup + PromptFooter pattern.
2. Add step/progress UI (Step X of Y).
3. Preserve action IDs and payload shape:
`diagnosis_submit`, `diagnosis_skip`.
4. Keep `diagnosis.*` keys wherever available; use `prompt.common.*` for common CTA where suitable.
5. Verification:
`npm run lint`, `npm run test`, `npm run build`.
6. Stop gate:
Show behavior parity summary and approval request.

### Checkpoint 3 — Migrate B-002 QuickProfileFlow
1. Refactor `src/components/chat/cards/QuickProfileFlow.tsx` to option-card selection + explicit Continue CTA.
2. Add 6-step indicator and progress bar.
3. Keep emitted chip payload semantics unchanged by submitting same `SuggestedChip` on Continue.
4. Convert common CTA/step text to `prompt.common.*`.
5. Verification:
`npm run lint`, `npm run test`, `npm run build`.
6. Stop gate:
Summarize state-machine compatibility and approval request.

### Checkpoint 4 — Standardize B-006 global chips priority
1. Add `src/components/prompt/chipPriority.ts` with heuristic classifier:
primary-like, skip-like, neutral.
2. Update chips render block in `src/pages/BffChat.tsx:7243`:
at most one full-width primary CTA (56px),
skip-like rendered as tertiary low-emphasis action,
remaining neutral chips unchanged/minimal.
3. Add tests `src/test/chipPriority.test.ts`.
4. Verification:
`npm run lint`, `npm run test`, `npm run build`.
5. Stop gate:
Provide classifier coverage summary and approval request.

### Checkpoint 5 — Refactor A-001 photo upload into 2-step prompt flow
1. Update `src/components/chat/cards/PhotoUploadCard.tsx` to two-step UX:
Step 1 photo selection, Step 2 consent.
2. Use PromptHeader/PromptFooter hierarchy.
3. Move “Not now / continue without photos” to tertiary action only.
4. Preserve action IDs/payloads:
`photo_upload`, `photo_skip`, `photo_use_sample_sample_set_A`.
5. Update related tests (`src/test/photoUploadCard.smoke.test.tsx`) to new flow.
6. Verification:
`npm run lint`, `npm run test`, `npm run build`.
7. Stop gate:
Report event/payload parity and approval request.

### Checkpoint 6 — Refactor A-002 routine intake hierarchy
1. Update routine sheet section in `src/pages/BffChat.tsx`:
Primary remains `Save & analyze`,
“Baseline only” becomes tertiary Not now,
cancel/back moved to header affordance.
2. Add minimal step/progress labeling when AM/PM is treated as two-step.
3. Convert key inline strings to i18n keys (title + CTA minimum).
4. Keep submission logic/data shape unchanged:
`buildCurrentRoutinePayloadFromDraft`, `runRoutineSkinAnalysis`, `runLowConfidenceSkinAnalysis`.
5. Verification:
`npm run lint`, `npm run test`, `npm run build`.
6. Stop gate:
Final P0 migration summary + residual P1/P2 follow-up list.

## Test Cases and Scenarios
1. A11y:
OptionCardGroup roles and `aria-checked` correctness for single/multi.
2. EN/ZH layout:
Long EN and CN strings stay within 2-line constraints for header helper/title on small widths.
3. CTA hierarchy:
No same-level Skip button next to primary in migrated P0 flows.
4. Behavioral parity:
Diagnosis/QuickProfile/Photo/Routine action IDs and payload shape unchanged.
5. Heuristic safety:
`chip.intake.skip_analysis` always classified as skip-like.
6. Regression:
Existing Vitest suite remains green except documented baseline lint issue.

## Assumptions and Defaults
1. No backend contract changes; UI-only refactor unless unavoidable.
2. Existing local lint issue at `src/utils/requestWithTimeout.ts:37` is baseline and not part of this work.
3. Existing local `Sheet` in `src/pages/BffChat.tsx` remains in place for this phase; prompt components integrate with minimal disruption.
4. No new npm dependencies are introduced.
5. Storybook/e2e screenshot pipeline is out of scope for this P0 migration pass.
