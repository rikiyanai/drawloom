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
| FL-006 | Loomis side-plane cut is still geometrically wrong after the paired-disk attempt: disk centers sit at the sphere silhouette edge (`±radius * cos(yaw)`) instead of the temporal cut plane (`~±0.707r`), disk radius is hardcoded (`0.78r`), and pitch is not projected correctly. | High | `src/lib/overlays/loomis.ts`, `src/lib/overlays/loomis-reilly.ts` | Replace the 2D ellipse approximation with projected 3D Loomis geometry (sphere wireframe + two side disks + jaw block) or correct the cut-plane math in both Loomis owners. | OPEN |  |
| FL-007 | Ovoid overlay was mislabeled as "doveline"; it traces `FACE_OVAL` perimeter, while the requested doveline is a central contour through brow/nose/philtrum/lips/chin, usually angled in 3/4 view. | High | `src/lib/overlays/ovoid.ts`, `src/lib/overlays/doveline.ts`, `src/lib/overlays/registry.ts` | Existing ovoid label was corrected and a separate `doveline` overlay was added; still needs visual verification against target references. | PENDING |  |
| FL-008 | Lip-line toggle drew inner mouth-opening landmarks, but the requested lip line is a gullwing closure/M-curve over the lips. | High | `src/lib/overlays/feature-lines.ts` | `lipLine` was changed to a gullwing lip-closure landmark chain; still needs visual verification against target references. | PENDING |  |
| FL-009 | Pink feature/Reilly rhythm curves still read crude: Catmull-Rom improves landmark smoothing, but the key Reilly cheek/lozenge rhythms are artistic construction curves that do not exist as dense MediaPipe landmark paths. | High | `src/lib/overlays/feature-lines.ts`, `src/lib/overlays/loomis-reilly.ts` | Move these from landmark-only paths to projected construction geometry or authored 3D head curves; verify against front, 3/4, and profile reference images. | OPEN |  |
| FL-010 | Single-view skull overlay exists, but the Khronos/GLB skull still reads too small because `normalizeSkullMesh` scales by longest axis (depth) instead of visible head height, so the rendered skull height fills only about 56% of the viewport instead of the procedural skull's ~75%. | High | `src/components/Studio.tsx`, `src/components/SkullOverlay.tsx`, `src/lib/skull/scene.ts`, `public/skull.glb` | Normalize loaded skull meshes by Y height for glTF +Y-up skull assets, then visually verify skull overlay scale/position against the face bbox. | OPEN |  |
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

## Target references — 2026-06-09

- `/Users/r/Desktop/Screenshot 2026-06-09 at 11.18.46.png` — soft photo underlay with bold black construction: large cranium sphere, angled central contour, side disk, jaw/chin/neck construction.
- `/Users/r/Desktop/Screenshot 2026-06-09 at 11.18.54.png` — colored construction target: white Loomis volume with side disk, green center contour, red facial proportion arcs, blue/purple jaw/neck forms, yellow shoulder guides.
