# Application type checking

The previous `tsc --noEmit` command read the solution config with `files: []` and did not follow its references. It could report success without checking the application.

`npm run typecheck` now checks both application and Vite projects through the TypeScript compiler API. Empty or invalid projects fail closed. Build runs this command, so deployment builds and CI share the same guard.

Main currently has **185 known diagnostics** (155 distinct fingerprints), down from the initial 220 after fixing runtime scope/callback errors, missing diagnosis contracts and bilingual label fallbacks. The reviewed `typecheck-baseline.json` is explicit technical debt, not evidence of a type-clean application. It records compiler version, project, relative file, diagnostic code/message, source line and occurrence count. Paths and line numbers are normalized for portable builds; changing or adding an error is not covered by a generic file/code allowance.

- New diagnostics or increased occurrence counts fail.
- Fixed diagnostics leave stale entries and fail until the unused allowance is removed.
- Compiler version changes require explicit baseline review.
- `npm run typecheck:strict` reports all errors and fails without exemptions.
- `npm run test:typecheck` checks the guard itself, including a real source type error and empty-project rejection.

When resolving debt, remove only the resolved baseline entries. `node scripts/typecheck.mjs --print-baseline` can show the current inventory for review; it does not write or automatically accept it. Do not refresh the baseline to accept regressions. Any deliberate new allowance requires an explicit PR explanation and review.

The baseline is transitional. Eliminate it as existing errors are fixed, then make the strict check the default. Do not weaken compiler options, add blanket casts, or suppress diagnostics merely to reduce its size.
