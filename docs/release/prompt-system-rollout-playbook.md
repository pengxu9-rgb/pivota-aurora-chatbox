# /chat Prompt System Rollout Playbook (24h/48h/72h)

## Goal
Validate that standardized prompt UX improves action hierarchy and completion quality without behavior regressions.

## Scope
Covers migrated `/chat` prompt flows:
- Diagnosis
- Quick profile
- Photo upload
- Routine intake
- Profile edit
- Daily check-in
- Ingredient report next-questions

## Pre-Release Checklist (T-0)
1. `npm run lint` / `npm run test -- --run` / `npm run build` all green.
2. Manual smoke in EN + CN:
   - Diagnosis: next/back/not-now
   - QuickProfile: continue/back/not-now
   - PhotoUpload: without photo path + with photo + consent path
   - Routine: `Save & analyze` vs `Use baseline only`
   - Profile: section scroll + save
   - Check-in: slider helper comprehension + save
   - Ingredient next-questions: no English leakage under CN
3. Confirm `/qa/prompt-harness` route is dev-only (not available in production).

## Metrics To Watch
Use existing events only (no schema changes):

1. Diagnosis completion quality
- `diagnosis_submit / (diagnosis_submit + diagnosis_skip)`
- Watch for sudden drop in submit ratio.

2. Photo adoption quality
- `photo_upload / (photo_upload + photo_skip)`
- Watch for upload ratio decline after UI rollout.

3. Routine intent quality
- Routine analysis invocation rate vs low-confidence baseline path.
- Track whether baseline-only usage spikes unexpectedly.

## Observation Windows
### First 24 hours
- Confirm no severe drop (>15% relative) on the three core ratios.
- Confirm no new high-frequency UI break reports.

### 48 hours
- Compare by language (EN/CN) and device class (mobile/desktop).
- Check if any single flow regresses while others remain stable.

### 72 hours
- Decide keep/iterate/rollback:
  - Keep: metrics stable or improved.
  - Iterate: minor drop with clear UI-specific cause.
  - Rollback: sustained severe regression with user-impact evidence.

## Triage Guide
1. If `diagnosis_submit` drops:
- Inspect step progression, disabled-state logic, and tertiary exposure.

2. If `photo_upload` drops:
- Verify Step 2 consent entry condition and confirm CTA enablement.

3. If routine baseline path spikes:
- Re-check tertiary prominence and primary CTA affordance.

## Rollback Criteria
Rollback if both conditions hold:
1. Core ratio drops exceed ~15% relative for >24h, and
2. Regression aligns with migrated prompt surfaces (not traffic/source mix change).

## Rollback Action
- Revert PR commit range.
- Re-run lint/test/build.
- Redeploy previous stable tag.

## Communication Template (short)
"Prompt-system rollout monitoring update: [24h/48h/72h]. Diagnosis ratio: X, Photo ratio: Y, Routine path split: Z. Status: [stable/needs-iteration/rollback]."
