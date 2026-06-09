# Feature Notes — drawloom

Tracking user feedback items and the plan for each.
Status legend: `LOGGED` (captured) · `PLANNED` (approach drafted) · `IN_PROGRESS` · `LANDED` (annotated with commit hash) · `DEFERRED` (rationale)

Each entry below should be flipped from LOGGED → PLANNED → IN_PROGRESS → LANDED as the work moves through the pipeline.

---

## Reference materials (provided 2026-06-09)

- `~/Downloads/y49dkoykhgi51.jpg` — three-panel layout: **Tracing | Reference | Lay-In · 06**. Left panel shows red Reilly rhythm lines overlaid on a faded portrait in 3/4 view. Right panel shows a clean planar "lay-in" mannequin head (Asaro-style) at the same head angle. This is the canonical spec for the two-panel-view item below.
- `~/Downloads/Reilly_Rhythms_drawing_practice_-_by_Khang_Ta.jpg` — six-cell grid by Khang Ta. Top row: front / 3/4 / profile photos with Reilly rhythms drawn over, plus horizontal proportion lines labelled `top of head · hair · brow · eye · nose · chin · sternal notch`. Bottom row: same three views as pure Reilly rhythm drawings (no photo). This is the reference for the exact rhythm-curve shapes the current Loomis-Reilly overlay is approximating poorly.

---

## Feedback items

### FR-001 — Jawline not accurate · LOGGED
The current mandible / jaw line in both the Skeleton and Feature-Lines overlays does not track the actual jaw silhouette of the user's face.
**Probable cause:** MANDIBLE chain uses MediaPipe FACE_OVAL indices for the lower half, which traces soft-tissue jaw rather than the bony mandible. Indices also tend to bulge out at the angle and undershoot at the chin in 3/4 view.
**Plan:** Re-anchor jaw to a curated subset of jaw landmarks plus the explicit ear landmarks (234, 454), drawn as a single smooth quadratic-bezier chain from ear → jaw-angle → mid-jaw → chin → mid-jaw → jaw-angle → ear. Tweak by direct visual feedback against webcam.

### FR-002 — Skull view should be an actual skull · LOGGED
The current Skeleton overlay draws skull-like shapes from landmark expansion. User expects an actual skull image / 3D model, low-opacity underlay or side panel.
**Plan:** Two sub-options:
- (a) Use a CC-BY skull SVG (Wikimedia or Z-Anatomy), apply CSS / canvas transforms (translate + scale + rotate) based on detected head angle. Cheap, looks much more skull-like than landmark drawings. Limitations: no perspective deformation under extreme yaw.
- (b) Use a low-poly 3D skull GLB (via three.js), rotated by the actual rotation matrix MediaPipe gives us. Higher fidelity, larger asset (~200 KB), needs a CC-licensed mesh.
Recommend (a) first as quick win, (b) as later upgrade. The side-panel use (FR-004) probably wants (b) since the skull rotates freely.

### FR-003 — Two-panel view (split screen) · LOGGED
Spec: left panel = current view (live webcam + selected overlays). Right panel = a clean reference at the same head angle (skull or planar Asaro lay-in).
**Plan:** Add a layout toggle in the header (`single` / `split`). In split mode, replace the toolbar's column area with a second canvas/render. The right panel shows whichever "reference subject" is active — initial subject is the 3D skull from FR-002b, future subjects could include Asaro plane head, écorché, or a Loomis dummy.

### FR-004 — Side-panel skull follows head orientation · LOGGED
Confirms FR-003's right-panel content: a clean skull (no photo) rotating with the user's detected yaw/pitch/roll in real time. The provided reference (y49dkoykhgi51.jpg) shows this as the rightmost "Lay-In" panel.
**Plan:** Same skull asset as FR-002b. In the WebcamStage loop, after each detection, feed `pose.matrix` (the 4×4 rotation matrix from MediaPipe) into the three.js scene rotating the skull mesh. The matrix is already extracted in `detectPoseForVideo`.

### FR-005 — Pause button to snapshot current state · LOGGED
A pause toggle that freezes the webcam stream + the last detected pose so the user can study a moment without their face moving.
**Plan:** Add a pause button to the WebcamStage. When paused: stop the RAF loop, draw nothing new, keep the last canvas as-is. A second click resumes. Optional: add a "save snapshot" button that toBlob's the current canvas to a PNG download.

### FR-006 — Muscles as a mesh-gridline wireframe hugging the face · LOGGED
User wants the muscle overlay redone as the classic MediaPipe face-mesh wireframe — the 478-point triangulation drawn as thin lines wrapping the facial surface, rather than the discarded filled-polygon muscle groups.
**Plan:** New overlay `mesh-wireframe.ts`. Use MediaPipe's published face-mesh tessellation index list (~2700 triangles). Draw as 1px lines with low opacity, optionally with a color gradient based on depth (z) so the mesh reads as a 3D wrap. This is a different concept from "muscles" — rename overlay to "Face mesh wireframe" to be honest.

### FR-007 — Black & white view · LOGGED
Toggle to desaturate the source image / video.
**Plan:** Add a `view filters` panel above the overlays (separate from overlays — these are global view modifiers, not landmark-driven). First filter: grayscale toggle, implemented as a CSS filter on the canvas OR as a per-frame pixel-loop. CSS approach is much cheaper for webcam mode. Second filter: see FR-008.

### FR-008 — Background blur view · LOGGED
Blur everything that isn't the face.
**Plan:** Two implementation paths:
- (a) MediaPipe SelfieSegmenter / ImageSegmenter task — gives a person mask. Apply Gaussian blur to the inverse-masked area. Cleaner result. Adds another ~5 MB model.
- (b) Use the FACE_OVAL ring as a soft mask, blur outside it. Cheaper, less accurate (misses hair, neck).
Recommend (a) given we already pay the MediaPipe install tax.

### FR-009 — Match the Khang Ta Reilly rhythm shapes · LOGGED (inferred)
Not explicitly listed but implied by sharing the Khang Ta reference. The current Loomis-Reilly overlay's rhythm curves are rough approximations. The reference shows specific repeating shapes: a long "C" wrapping each eye-and-cheek mass, a vertical lozenge for the nose-and-mouth column, a single ellipse from ear around the jaw and back, plus the seven horizontal labels (top, hair, brow, eye, nose, chin, sternal notch).
**Plan:** Rewrite `loomis-reilly.ts` to match these specific shapes one-for-one against the Khang Ta sheet. Add the seven horizontal proportion-label lines (with text labels) as a sub-toggle. Body-length items (sternal notch) probably require switching to MediaPipe Pose Landmarker for body, deferred until pose support lands.

---

## Proposed implementation order

Recommend tackling in this order — each one is its own commit:

1. **FR-005 Pause / snapshot button** — smallest, biggest "feels finished" win. ~20 min.
2. **FR-007 B&W + FR-008 background blur as view filters panel** — both are global view modifiers, ship together. ~45 min for B&W + face-oval-mask blur; +30 min if we want SelfieSegmenter.
3. **FR-001 Jawline accuracy fix** — quick re-anchor + visual iteration. ~20 min, will need a 2nd round after seeing it live.
4. **FR-006 Mesh wireframe overlay** — drop-in replacement for the muscle nonsense. ~30 min.
5. **FR-003 + FR-004 + FR-002b Two-panel view with 3D skull** — biggest item. Needs a CC skull GLB asset, a three.js scene, split-screen layout, matrix-driven rotation. ~90-120 min.
6. **FR-009 Reilly rewrite to match Khang Ta sheet** — deep iteration item, best handled after we can put the reference side-by-side using the split-screen layout from step 5. ~60 min.

## Open questions for user

- **FR-002 (skull asset):** OK to fetch a CC-BY skull GLB at runtime (one-time ~200KB), or do you want it pre-bundled? Source options: Sketchfab CC0 / Smithsonian 3D / Z-Anatomy.
- **FR-008 (background blur):** OK to add the SelfieSegmenter model (~5MB extra download, much better quality)? Or stick with the cheaper face-oval mask?
- **Implementation order:** Approve the order above, or pick which item ships first?

---

*Status: all items LOGGED. No implementation work has started.*
