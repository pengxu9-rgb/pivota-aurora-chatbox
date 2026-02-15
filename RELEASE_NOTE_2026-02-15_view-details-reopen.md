# Aurora Chatbox Release Note (2026-02-15)

## Scope
- Frontend bugfix for PDP drawer reopen flow after closing `View details`.

## Shipped
- Commit: `813ace2`
- Branch: `main`

## Fix Summary
- Fixed a stale close/open state race that could block reopening after first close.
- Added drawer epoch gating to ignore stale close events.
- Forced drawer remount per open cycle to reset stale internal dialog state.
- Unmounted drawer when closed to avoid lingering overlay/pointer lock.
- Improved same-card repeated click behavior after prior completion.

## Validation
- `src/test/recommendationsViewDetailsDeepScan.test.tsx`
- `src/test/shopDrawerClose.test.tsx`
- `src/test/shopProviderReopen.test.tsx`
- Result: 3 test files passed, 14 tests passed.
