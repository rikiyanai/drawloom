# Feature Notes — drawloom

Tracking user feedback items and the plan for each.
Status legend: `LOGGED` (captured) · `PLANNED` (approach drafted) · `IN_PROGRESS` · `LANDED` (annotated with commit hash) · `PARTIAL` (LANDED with caveats) · `DEFERRED` (rationale)

---

## Reference materials (provided 2026-06-09)

- `~/Downloads/y49dkoykhgi51.jpg` — three-panel layout: **Tracing | Reference | Lay-In · 06**. Left panel shows red Reilly rhythm lines overlaid on a faded portrait in 3/4 view. Right panel shows a clean planar "lay-in" mannequin head (Asaro-style) at the same head angle. This is the canonical spec for the two-panel-view item below.
- `~/Downloads/Reilly_Rhythms_drawing_practice_-_by_Khang_Ta.jpg` — six-cell grid by Khang Ta. Top row: front / 3/4 / profile photos with Reilly rhythms drawn over, plus horizontal proportion lines labelled `top of head · hair · brow · eye · nose · chin · sternal notch`. Bottom row: same three views as pure Reilly rhythm drawings (no photo). This is the reference for the exact rhythm-curve shapes the current Loomis-Reilly overlay was approximating poorly.

---

## Feedback items

### FR-001 — Jawline accuracy · LANDED (commit `0be2848`)
Jaw line redrawn as a single smooth quadratic-bezier chain anchored to ear (234, 454) → jaw angles → mid-jaw → chin, replacing the FACE_OVAL lower-half segments that bulged at the angle and undershot the chin in 3/4 view. Used across Skeleton and Feature-Lines overlays via `drawJawLine` in `src/lib/pose/landmarks.ts`.

### FR-002 — Skull view as an actual skull · LANDED (commits `7dc4a5a`, `368274e`)
Procedural three.js skull built from primitives is the fallback. `mountSkullScene` now probes `/skull.glb` (and an optional `window.__DRAWLOOM_SKULL_URL`) at startup; on a successful fetch the GLB is loaded via `GLTFLoader`, normalized to the same view-volume as the procedural skull (centered, longest dimension ≈ 2.0), and hot-swapped into the pivot. The rotation API and selfie-mirror math are unchanged across both code paths.
**How to attach a real skull:** drop a CC-BY/CC0 `.glb` at `public/skull.glb` and it auto-loads on next render. No code changes needed.

### FR-003 — Two-panel view (split screen) · LANDED (commit `7dc4a5a`)
Layout toggle in the header (`single` / `split + skull`) wired to the `layout` store field. Split mode renders a `grid-cols-2` with the active source (Webcam or Canvas stage) on the left and `SkullPanel` on the right. See `src/components/Studio.tsx`.

### FR-004 — Side-panel skull follows head orientation · LANDED (commit `7dc4a5a`)
`SkullPanel` subscribes to `pose.matrix` and calls `scene.setRotation(matrix)` on every change. `setRotation` extracts the rotation component of MediaPipe's column-major 4×4 matrix, converts via `THREE.Quaternion → Euler YXZ`, and flips yaw + roll so the skull mirrors the user's selfie-mirrored on-screen face. See `src/lib/skull/scene.ts:154-168`.

### FR-005 — Pause / snapshot · LANDED (commit `70fdf1d`)
Pause toggle freezes the RAF loop and leaves the last canvas intact for study; a second click resumes. Snapshot button calls `canvas.toBlob` → object URL → anchor download, producing a PNG of the current frame + overlays.

### FR-006 — Face-mesh wireframe overlay · LANDED (commit `4c4f037`)
New `mesh-wireframe.ts` overlay using `FaceLandmarker.FACE_LANDMARKS_TESSELATION` (~2700 edges). Batched into 8 depth buckets so closer triangles render brighter cyan via HSL lightness shading; optional triangle-fill mode toggle. Replaces the discarded filled-polygon "muscle" groups; overlay label is honest about being a mesh wrap, not anatomy.

### FR-007 — Black & white view · LANDED (commit `e6f953e`)
Grayscale toggle in the new `view filters` panel above the overlay list. Implemented as a `ctx.filter = "grayscale(1)"` on the webcam composite so it costs nothing per-frame.

### FR-008 — Background blur · LANDED (commit `e6f953e`)
MediaPipe `ImageSegmenter` with `selfie_segmenter.tflite` produces a person mask each frame; the WebcamStage composites a blurred background (via `ctx.filter = "blur(Npx)"`) with the sharp person region cut back in. Blur amount is exposed as a slider in the `view filters` panel.

### FR-009 — Reilly rhythms matched to Khang Ta sheet · LANDED (commits `43c74cb`, `368274e`)
`loomis-reilly.ts` rewritten to three canonical shapes from the Khang Ta reference: the eye-cheek "C" (left and right, 4-anchor bezier), the central vertical lozenge (brow → chin almond through nose & mouth column), and the jaw ovoid (ear-to-ear ellipse tilted by detected roll). Optional proportion labels overlay horizontal reference lines at `top · hair · brow · eye · nose · chin · sternal notch`. The sternal-notch line uses MediaPipe Pose Landmarker (`src/lib/pose/body.ts`) — gated behind a new `view filters → Body pose` toggle since the model adds ~5MB. Notch position is computed as the shoulder-midpoint shifted up by 10% of shoulder width; line is suppressed if the body model accidentally picks up the head (notch landing above chin).

---

## Open follow-ups

- **CC-BY skull asset selection:** the runtime GLB loader is wired; user still needs to pick a license-cleared `.glb` (Sketchfab CC0 / Smithsonian 3D / Z-Anatomy) and drop it at `public/skull.glb`. No code work remaining.

---

---

## Future external references — 2026-07-07

Recorded so they are not lost. Plan: use shape-similarity ASCII-art / structure-based glyph selection
in drawloom construction or edge-map overlays, or in the asciicker-Y9-2 glyph-rendering paper lane,
or both. No commitment to either project yet.

- **Structure-based ASCII Art** — Xu, Xuemiao; Zhang, Linling; Wong, Tien-Tsin. *ACM Transactions
  on Graphics (Proc. SIGGRAPH)*, vol. 29, no. 4, 2010. Key contribution: alignment-insensitive shape
  similarity (AISS) — a log-polar shape descriptor that tolerates position/orientation/scale
  misalignment — plus constrained deformation, formulated as an optimization that minimizes shape
  dissimilarity and deformation to approximate a reference image's major line structure with ASCII
  character shapes. This is the paper cited in the unrelated asciicker-Y9-2 repo's glyph-rendering
  bibliography (`xu2010structureascii`) and recorded there as a future role-specific structural
  scorer. Project page (paper + result galleries, no source code):
  `http://www.cse.cuhk.edu.hk/~ttwong/papers/asciiart/asciiart.html`. Mirror PDF:
  `https://www.cg.tuwien.ac.at/courses/CA/material/papers/AsciiArt.pdf`.
- **Runnable reimplementation (closest match): `MacLeek/ascii-art`** — GitHub, Python/Cython.
  Implements a Shape-Context class with log-polar bins (`nbins_r=5, nbins_theta=12,
  r_inner=0.5, r_outer=2.0`), the same log-polar descriptor family the paper's AISS is built on.
  Ships the paper's own test images (`monk_1.bmp`, `queen.gif`) matching the CUHK project galleries.
  Run: `pip install numpy scipy scikit-image`, `python setup.py build_ext --i`, then
  `import ascii; ascii.image_to_ascii('monk_1.bmp', 0.3, Rw=48)`. Caveat: Python-2-era Cython
  (`xrange`, `scipy.misc.toimage/imresize`) — needs porting to Python 3 / modern scikit-image
  before it runs. This is the most relevant runnable artifact for testing the algorithm.
- **Runnable reimplementation (narrower): `arduinocc04/AAC`** — GitHub, C++, Sogang University
  CSE2035 term project, "heavily influenced by structure-based ascii art". Implements log-polar
  transform + Bhattacharyya distance image comparison, Suzuki topological structural analysis,
  monotone-chain convex hull, grassfire transform. Deps: libpng + eigen. Narrower term-project
  scope than MacLeek.
- **Computer-Generated Pen-and-Ink Illustration of Trees** — Deussen, Oliver; Strothotte, Thomas.
  *Proceedings of SIGGRAPH*, 2000. Key contribution: depth-difference algorithm for pen-and-ink
  foliage using abstract drawing primitives (disks/ellipses/interpolated leaf polygons) with
  depth-buffer-driven outline admission and level-of-abstraction via depth-buffer non-linearity;
  input tree models via xfrog (Greenworks, commercial). Less directly relevant to drawloom's
  portrait-overlay scope, but recorded alongside because it shares the depth-buffer-driven
  stroke-placement family and may inform any future scene/foliage rendering in either project.
  No public reference implementation found. PDF:
  `https://www.cs.princeton.edu/courses/archive/fall00/cs597b/papers/plantsketch.pdf`.

Drawloom relevance note: the AISS log-polar shape-similarity approach is a candidate for an
edge-map / silhouette / "squint" overlay that selects rendering strokes (or simplification levels)
by matching detected portrait contours to a library of construction-curve templates, rather than
the current fixed landmark-chain bezier overlays. Not started; this is a reference capture only.

*Status snapshot 2026-06-09: all 9 items LANDED. Commit refs: `0be2848`, `7dc4a5a` (×3), `70fdf1d`, `4c4f037`, `e6f953e` (×2), `43c74cb`, `368274e` (body pose + GLB loader).*
