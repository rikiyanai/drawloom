# Failure Log

Bugs found in review, fixes applied, and verification status.

Status legend: `PENDING` (fix written, not verified) · `VERIFIED` (required checks pass after fix) · `OPEN` (not yet fixed) · `WONTFIX` (intentional)

| # | Bug | Severity | File(s) | Fix | Status | Verified at |
|---|---|---|---|---|---|---|
| FL-001 | MediaPipe WASM CDN URL pinned to `0.10.22-rc.20250304` but installed npm version is `0.10.35`. Version skew risks API drift between WASM and JS bindings. | High | `src/lib/pose/detect.ts` | Extracted `MEDIAPIPE_VERSION = "0.10.35"` constant, interpolated into CDN URL. Comment instructs keeping it in sync with `package.json`. | VERIFIED | 2026-06-08 |
| FL-002 | `URL.createObjectURL(file)` was never `revokeObjectURL`'d — blob URLs leaked on every new upload and on reset. | Medium | `src/components/UploadDropzone.tsx`, `src/lib/store.ts` | Revoke previous `imageUrl` before setting a new one in `handleFile`; also revoke on `reset()`. Revoke on image-load failure too. | VERIFIED | 2026-06-08 |
| FL-003 | `init()` cached a rejected promise forever — one offline failure killed all future detection attempts in the session. | Medium | `src/lib/pose/detect.ts` | Chained `.catch()` that resets `initPromise = null` before rethrowing, so the next call retries from scratch. | VERIFIED | 2026-06-08 |
| FL-004 | `matrixToYPR` destructured 9 vars but only 7 were used (`r01`, `r21` unused). | Low | `src/lib/pose/detect.ts` | Replaced the destructure block with explicit single-var `const` declarations for the 7 entries actually used. | VERIFIED | 2026-06-08 |
| FL-005 | `img.crossOrigin = "anonymous"` set on an Image whose `src` is always a blob URL — meaningless, misleading copy-paste from cross-origin reference patterns. | Low | `src/components/UploadDropzone.tsx` | Removed the line. | VERIFIED | 2026-06-08 |
| FL-006 | Loomis side-plane cut was geometrically wrong; the later 3D replacement still had no validated registration to the subject. | High | Removed: `src/lib/overlays/loomis.ts`, `src/lib/loomis/` | Removed the Loomis overlay and its renderer from the public product instead of preserving an unverified construction owner. | VERIFIED | 2026-07-21 |
| FL-007 | Ovoid overlay was mislabeled as "doveline"; it traces `FACE_OVAL` perimeter, while the requested doveline is a central contour through brow/nose/philtrum/lips/chin, usually angled in 3/4 view. | High | `src/lib/overlays/ovoid.ts`, `src/lib/overlays/doveline.ts`, `src/lib/overlays/registry.ts` | Existing ovoid label was corrected and a separate centerline trace was added; still needs visual verification against target references. | PENDING |  |
| FL-008 | Lip-line toggle drew an unvalidated gullwing closure/M-curve over the lips. | High | Removed: `src/lib/overlays/feature-lines.ts` | Removed the feature-lines product surface and implementation; the fabricated upper-lip curl is no longer shipped. | VERIFIED | 2026-07-21 |
| FL-009 | Pink feature/Reilly rhythm curves were artistic construction paths that do not exist as dense MediaPipe landmark paths. | High | Removed: `src/lib/overlays/feature-lines.ts`, `src/lib/overlays/loomis-reilly.ts` | Removed both unvalidated rhythm owners from the product and source tree. | VERIFIED | 2026-07-21 |
| FL-010 | Single-view skull superimposition implied anatomical registration while only fitting the mesh to the face bounding box. | High | `src/components/Studio.tsx`; removed: `src/components/SkullOverlay.tsx` | Removed the superimposition mode. The skull remains only as a separate comparison panel, which is now the default layout. | VERIFIED | 2026-07-21 |
| FL-011 | Skeleton underlay used a skull projection fitted only to the face bounding box and was not a validated anatomical underlay. | High | Removed: `src/lib/overlays/skeleton.ts`, `src/lib/skull/offscreen.ts` | Removed the underlay from the product and source tree. | VERIFIED | 2026-07-21 |
| FL-012 | README was bloated with emojis, verbosity, and a single low-res 8.3MB `.gif` glyph that did not show overlay detail clearly. | Low | `README.md` | Stripped emojis and filler prose. Stale screenshots of the later-removed overlays were unlinked on 2026-07-21. | VERIFIED | 2026-07-21 |
| FL-013 | ARKit/TrueDepth spike was outside the tracked `drawloom` repo and its packet comparison workflow could mislead. | High | `drawloom-ios-spike/`, `src/lib/pose/detect.ts`, `src/lib/pose/packet.ts`, `src/components/OverlayPanel.tsx` | Moved the spike into the repo and added explicit web/iOS packet export surfaces; full topology comparison remains outside this web-surface audit. | PENDING |  |
| FL-014 | ARKit Loomis overlay reads pasted-on and inaccurate despite a measurement-first rewrite. | High | `drawloom-ios-spike/Sources/ARFaceView.swift` | The iOS spike remains non-public and pending validation; it is not registered on the web surface. | PENDING |  |
| FL-015 | The deployed web surface exposed unverified construction/anatomy as valid tools: Loomis, Reilly rhythms, fabricated lip/nose curves, canonical proportion claims, and bbox-fitted skull overlays. | Critical | `src/lib/overlays/registry.ts`, `src/lib/store.ts`, `src/components/Studio.tsx`, `src/app/layout.tsx`, `README.md` | Established the public registry as an accuracy boundary, deleted every unvalidated implementation/owner, retained only direct landmark or deterministic pixel/geometry tools, removed skull superimposition, and made the separate split-skull reference default. ComplaintRefs: FL-006, FL-008, FL-009, FL-010, FL-011. | VERIFIED | 2026-07-21 |

## Verification protocol

A fix is `VERIFIED` only when, after the change:

1. `npx tsc --noEmit` exits 0.
2. `npm run build` exits 0.
3. The specific behavior is covered by a targeted check or can be shown absent from the built public surface.

## Verification run — 2026-07-21 (FL-006, FL-008–FL-012, FL-015)

```text
npm run build        → PASS; production export compiled and generated 4 static pages
npm run test:surface → attempt 1 blocked before page load: Playwright Chromium binary missing
npx playwright install chromium
npm run test:surface → PASS; split default; 6 audited overlays
git diff --check     → PASS
public string audit  → PASS; removed overlay names/claims absent from src and export
```

Retained web overlays after the audit:

- Ovoid silhouette — direct `FACE_OVAL` landmark trace.
- Face centerline trace — direct MediaPipe centerline landmark trace; FL-007 visual validation remains pending.
- Face mesh wireframe — MediaPipe tessellation.
- Eye-line + plumb + grid — direct landmark/canvas geometry.
- Notan — deterministic luminance quantization.
- Edge / squint / silhouette — deterministic pixel transforms.

## Prior verification run — 2026-06-08

After applying FL-001 through FL-005:

```text
npx tsc --noEmit → PASS
npm run build    → PASS; compiled successfully and generated 4 static pages
```

## Target references — 2026-06-09 (historical, not acceptance evidence)

- `/Users/r/Desktop/Screenshot 2026-06-09 at 11.18.46.png` — soft photo underlay with bold black construction.
- `/Users/r/Desktop/Screenshot 2026-06-09 at 11.18.54.png` — colored construction target with Loomis volume and feature rhythms.

These references did not supply a validated fitting model. They cannot justify restoring the deleted public overlays.
