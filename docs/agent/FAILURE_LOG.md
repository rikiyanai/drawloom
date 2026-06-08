# Failure Log

Bugs found in static review, fixes applied, and verification status.

Status legend: `PENDING` (fix written, not verified) · `VERIFIED` (tsc + build pass after fix) · `OPEN` (not yet fixed) · `WONTFIX` (intentional)

| # | Bug | Severity | File(s) | Fix | Status | Verified at |
|---|---|---|---|---|---|---|
| FL-001 | MediaPipe WASM CDN URL pinned to `0.10.22-rc.20250304` but installed npm version is `0.10.35`. Version skew risks API drift between WASM and JS bindings. | High | `src/lib/pose/detect.ts` | Extracted `MEDIAPIPE_VERSION = "0.10.35"` constant, interpolated into CDN URL. Comment instructs keeping it in sync with `package.json`. | VERIFIED | 2026-06-08 |
| FL-002 | `URL.createObjectURL(file)` was never `revokeObjectURL`'d — blob URLs leaked on every new upload and on reset. | Medium | `src/components/UploadDropzone.tsx`, `src/lib/store.ts` | Revoke previous `imageUrl` before setting a new one in `handleFile`; also revoke on `reset()`. Revoke on image-load failure too. | VERIFIED | 2026-06-08 |
| FL-003 | `init()` cached a rejected promise forever — one offline failure killed all future detection attempts in the session. | Medium | `src/lib/pose/detect.ts` | Chained `.catch()` that resets `initPromise = null` before rethrowing, so the next call retries from scratch. | VERIFIED | 2026-06-08 |
| FL-004 | `matrixToYPR` destructured 9 vars but only 7 were used (`r01`, `r21` unused). | Low | `src/lib/pose/detect.ts` | Replaced the destructure block with explicit single-var `const` declarations for the 7 entries actually used. | VERIFIED | 2026-06-08 |
| FL-005 | `img.crossOrigin = "anonymous"` set on an Image whose `src` is always a blob URL — meaningless, misleading copy-paste from cross-origin reference patterns. | Low | `src/components/UploadDropzone.tsx` | Removed the line. | VERIFIED | 2026-06-08 |

## Verification protocol

A fix is `VERIFIED` only when, after the change:
1. `npx tsc --noEmit` exits 0
2. `npm run build` exits 0
3. The specific behavior the bug describes can be reasoned about as corrected from the post-fix code (manual code review)

Runtime verification (actually loading a portrait, watching for leaked blobs in DevTools, simulating offline first load) is **not** part of this log's pass criteria. That will be tracked separately when browser testing happens.

## Verification run — 2026-06-08

After applying FL-001 through FL-005:

```
npx tsc --noEmit   → TSC_EXIT=0
npm run build      → BUILD_EXIT=0
                   → Compiled successfully in 1406ms
                   → 4 static pages prerendered
```

All 5 entries flipped from PENDING to VERIFIED.
