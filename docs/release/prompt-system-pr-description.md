# PR Description — /chat Prompt System Standardization (P0 + P1)

## Summary
This PR standardizes prompt/survey UI in `/chat` with a unified prompt system and migrates high-impact flows to enforce clear action hierarchy:
- One full-width primary CTA (`56px`)
- Skip-like actions demoted to tertiary text (`Not now`)
- Header-based close/back
- EN/ZH i18n consistency via `t(key, language)`

No backend contract, payload schema, or analytics event names were changed.

## Scope
### Migrated P0 flows
- `DiagnosisCard` (`src/components/chat/cards/DiagnosisCard.tsx`)
- `QuickProfileFlow` (`src/components/chat/cards/QuickProfileFlow.tsx`)
- Global chips panel (`item.kind === 'chips'` in `src/pages/BffChat.tsx`)
- Photo upload (`src/components/chat/cards/PhotoUploadCard.tsx`, 2-step)
- Routine intake sheet (`src/pages/BffChat.tsx`)

### Migrated P1 flows
- Profile edit sheet (`src/pages/BffChat.tsx`)
- Daily check-in sheet (`src/pages/BffChat.tsx`)
- Ingredient report next-questions bilingual cleanup (`src/components/aurora/cards/IngredientReportCard.tsx`)
- Legacy prompt card deprecation annotations (C-004 components)

### Prompt platform additions
- Shared primitives under `src/components/prompt/*`
- Prompt UX spec and QA docs: `docs/ui-system/question-prompts-spec.md`
- Guardrail tests: `src/test/promptGuardrails.repoScan.test.ts`
- Dev-only QA harness route: `/qa/prompt-harness` (gated by `import.meta.env.DEV`)

## UX Principles Enforced
1. Prompt hierarchy: `PromptHeader` + body + `PromptFooter`
2. Primary/tertiary separation: no same-level primary+skip
3. Step/progress visibility for multi-step flows
4. Sticky footer safety: bottom padding to avoid overlap
5. Accessibility: role semantics for radio/checkbox groups
6. i18n: remove prompt-like hardcoded EN in migrated surfaces

## Guardrails & Hardening
- Chips priority classifier (`primary` / `skip` / `neutral`)
- Repo-scan guardrails for:
  - hardcoded prompt-like EN strings
  - chips hierarchy regression
  - same-level primary/skip footer heuristic
  - dev-gate assertion for `/qa/prompt-harness`
- Keyboard/a11y smoke support for option groups
- Long-string narrow-width stress coverage

## Non-goals
- No business logic/state-machine rewrite
- No analytics schema changes
- No API contract/payload shape changes
- No new npm dependencies

## Validation
### Automated
- `npm run lint` ✅
- `npm run test -- --run` ✅ (35 files / 145 tests)
- `npm run build` ✅

### Manual smoke (recommended pre-merge)
- EN + CN for: Diagnosis, QuickProfile, PhotoUpload (with/without photos), Routine, Profile, Check-in, IngredientReport next-questions
- Dev harness: `/qa/prompt-harness` narrow width + keyboard checks

## Risk Assessment
- Primary risk: UI hierarchy/layout regressions in chat sheets/cards
- Mitigations:
  - Guardrail tests
  - Prompt spec QA checklist
  - Dev-only stress harness

## Rollback
- Revert this PR commit range (UI-only); no data migration or backend rollback required.
