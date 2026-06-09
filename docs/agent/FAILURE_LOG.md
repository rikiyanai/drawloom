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
| FL-006 | Loomis side-plane cut draws one yaw-offset ellipse, but the requested Loomis construction needs two vertical temple disks visible as paired side planes. | High | `src/lib/overlays/loomis.ts`, `src/lib/overlays/loomis-reilly.ts` | Replace the single `cutOffset` side-cut owner with paired left/right temple disks, with yaw/roll/pitch-aware visibility and consistent behavior in both Loomis overlays. | OPEN |  |
| FL-007 | Ovoid overlay is mislabeled as "doveline"; it traces `FACE_OVAL` perimeter, while the requested doveline is a central contour through brow/nose/philtrum/lips/chin, usually angled in 3/4 view. | High | `src/lib/overlays/ovoid.ts`, `src/lib/overlays/registry.ts` | Rename the existing overlay to ovoid/face egg only, then add a separate doveline/center-contour overlay using central face landmarks instead of perimeter landmarks. | OPEN |  |
| FL-008 | Lip-line toggle draws inner mouth-opening landmarks, but the requested lip line is a gullwing closure/M-curve over the lips. | High | `src/lib/overlays/feature-lines.ts` | Rework `lipLine` to draw the lip-closure gullwing contour and stop conflating it with the inner mouth opening. | OPEN |  |
| FL-009 | Pink feature/Reilly rhythm curves are crude: midpoint-quadratic smoothing and fixed magic offsets do not accurately hug eyelids, brows, cupid bow, nose underside, eye-cheek C, central lozenge, or jaw ovoid across head angles. | High | `src/lib/overlays/feature-lines.ts`, `src/lib/overlays/loomis-reilly.ts` | Replace naive curves with anatomy-aware landmark chains or spline/projected-guide geometry; verify against the Khang Ta/reference materials for front, 3/4, and profile views. | OPEN |  |
| FL-010 | Skull view only exists as split-panel skull; there is no option to overlap the actual skull on the single portrait view, and skull scale/position is not matched to the face bbox/head size. | High | `src/components/Studio.tsx`, `src/lib/store.ts`, `src/components/SkullPanel.tsx`, `src/lib/skull/scene.ts` | Add a single-view skull overlap layout/mode and drive skull projection scale/position from detected face/head bounds so the skull matches the head size. | OPEN |  |
| FL-011 | Skeleton underlay is still a crude 2D landmark-expansion approximation; cranium uses the face oval, orbits are expanded eyelid blobs, nasal aperture and zygomatic arches are simple Beziers, so it does not read like a real skull underlay. | High | `src/lib/overlays/skeleton.ts`, `src/lib/skull/scene.ts`, `public/skull.glb` | Replace or demote the 2D skeleton overlay in favor of the real/procedural skull projection matched to the portrait; keep individual bone toggles only if they can be derived from a credible skull asset/projection. | OPEN |  |

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
