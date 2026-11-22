# Plan: 3D head planes, Loomis construction and editable corrections for Drawloom

Status: D0 deployment workflow implemented; first live publication pending verification. The planes feature is not built. Revised 2026-11-21 after the hand workflow in section 1 failed on turned views. Supersedes Muse's first draft, whose geometry was 2D offsets from landmark-derived defaults (see section 11 for what changed). Research and sources: `RESEARCH.md`. Reference script (early version, 102 vertices, 70 polylines): `reference-planes0001.py`.

## First priority: automatic public deployment (D0)

Before M0 or any wire-mesh implementation, make every commit pushed to `main` automatically update the public Drawloom endpoint. A local commit must be pushed before GitHub can deploy it. Feature branches must not replace production. A failed check or build keeps the last successful deployment live.

Reference checked on 2026-11-21: Shallot's `.github/workflows/tamanegi-pages.yml` runs on `push` to `main` and supports `workflow_dispatch`; it builds an artifact and publishes through `actions/configure-pages`, `actions/upload-pages-artifact` and `actions/deploy-pages`, with a `github-pages` environment and `contents: read`, `pages: write`, `id-token: write` permissions. Reuse that deployment pattern, not its application-specific build or asset packaging.

Hosting verified on 2026-11-21: `rikiyanai/rikiyanai.github.io` owns the `rikiworld.com` CNAME and publishes `main:/` through legacy GitHub Pages. Its committed `drawloom/` directory contains the existing static export. `https://rikiworld.com/drawloom/` responds with HTTP 200. The Drawloom source repository itself has no committed Actions workflow or Pages site (`has_pages: false`, Pages API 404). The preferred deployment is therefore an automatic handoff into the existing site's `drawloom/` directory, preserving its CNAME and other applications.

Implementation:
1. Use `rikiyanai/drawloom` as the source and `rikiyanai/rikiyanai.github.io:main:drawloom/` as the publication target. Keep the Actions-on-main behavior used by Shallot; adapt publication to this existing parent site instead of assuming Drawloom has its own Pages project. Establish a narrowly scoped credential or GitHub App installation for the cross-repository handoff, stored in GitHub secrets. The default source-repo `GITHUB_TOKEN` cannot write to the other repository. Record any missing access before claiming D0 complete.
2. Add `.github/workflows/drawloom-pages.yml`: run on every push to `main` (no path filters, including documentation commits), plus manual dispatch for recovery. Check out the triggering SHA; use a supported Node version compatible with the lockfile, `npm ci`, `npx tsc --noEmit`, `npm run build`, and the existing surface/study checks against the served static export. Install Playwright Chromium in CI. Publish only after all required checks pass.
3. Preserve `next.config.ts`'s static export, `/drawloom` base path and trailing slashes. Stage `out/` as the checked artifact, then replace only the destination site's `drawloom/` directory with its contents (no nested `drawloom/drawloom/`). Preserve the parent's `.nojekyll`, CNAME and every sibling path. Verify JS/CSS, skull fallback, MediaPipe wasm/model loading, image upload and study backup/import from the deployed path. Webcam must remain on HTTPS.
4. Serialize publication, check the source SHA before handoff, and update the destination on top of its latest `main` without force-pushing so unrelated site edits survive. Ensure the chosen cross-repo credential triggers the parent's Pages build; wait for that build and the public receipt rather than treating a destination commit as a completed deployment. Honor the destination's existing attribution-policy check. Keep `NEXT_PUBLIC_DRAWLOOM_PLANES` unset in production until M5; any flag-on validation build is separate from the artifact published to production. A future switch to Shallot's standalone Pages deploy actions is a separate hosting migration requiring route validation.
5. Generate a public build receipt in `out/build-info.json` containing only the source SHA and build time; this is build output, not a tracked source edit. Record the final URL in the deployment summary. Provide manual redeployment of a known-good SHA for rollback without rewriting source history.

Exit gate: push two successive commits to `main` and confirm each triggers a successful unattended deployment to the same public URL. Fetch `/drawloom/build-info.json` without cache and match each SHA; verify assets and the six-overlay public surface. Confirm a failed required check does not publish, and demonstrate rollback/redeployment. Local studies must survive an update at the same origin. If hosting access or route configuration is missing, D0 stays open with the exact missing dependency recorded.

Implementation: `.github/workflows/drawloom-pages.yml` and `docs/DEPLOYMENT.md`. Actions are enabled, a dedicated destination-repo write key is registered, and its private key is stored in the source repository's `DRAWLOOM_PUBLISH_KEY` secret. The workflow builds the public artifact, checks it, publishes only the destination `drawloom/` directory and waits for the public SHA receipt. Local build, TypeScript, deployment-helper, surface and study checks pass. Next.js is patched to 16.4.6 and the dependency audit is clean. The skull reference now renders on changes instead of continuously; this resolved the local interaction stalls. Complete the live exit gate before marking D0 done. `REVIEW.md` records the mesh implementation blockers.

## 0. Honesty boundary and the FL-015 constraint

- No anatomical registration is claimed. The planes are a drawing construction in the manner of Asaro and Loomis, positioned from MediaPipe landmarks and from the user's own placements. The skull panel stays separate (`README.md`, `src/lib/skull/scene.ts`).
- `docs/agent/FAILURE_LOG.md` FL-015 deleted an earlier public Loomis overlay, Reilly rhythms and "canonical proportion claims" because they were unvalidated. `registry.ts` is documented as the public accuracy boundary, and `scripts/test-surface.mjs` asserts the exact six overlay names and fails if the strings "Loomis head" or "Proportion compare" appear. This feature must not undo that. Therefore:
  - Everything ships behind a build-time flag `NEXT_PUBLIC_DRAWLOOM_PLANES=1` (static export, so it is inlined at build). With the flag unset, `OVERLAYS` is unchanged and `npm run test:surface` passes untouched. Validation runs build with the flag set.
  - Public names avoid the banned strings: "Head planes (experimental)", "Sphere + neck construction (experimental)", "Proportion measurements (experimental)".
  - Flag removal happens only after the section 6 gate passes, in one commit that also updates `test-surface.mjs`, `README.md` and adds an FL entry.
  - The canon layer measures the subject and reports differences. It never moves a vertex toward a canon and never says a face is wrong.
- Numbers marked "measured" below were measured in the session on one subject and one capture. Numbers marked "proposed" are thresholds nobody has measured yet.

## 1. The workflow this feature must reproduce, and why the first transfer failed

What the user did by hand this session:

1. **Capture.** Drawloom capture of 90 frames. Each frame has the MediaPipe 478 3D landmarks (x, y in image pixels, z in the same pixel scale), `modelToCamera` (4x4), yaw/pitch/roll, the photo layer and the edge (line drawing) layer.
2. **Front frame plane vertices.** An ad hoc script placed about 100 named plane vertices on the front frame, Asaro style: skull top; forehead with frontal-eminence splits; temples; brow ridge; glabella; eye sockets; faceted eyes (upper-lid band of 5 facets from lid margin up to the fold, lower-lid band with thickness, inner-canthus wedge, ties to the brow and the orbital rim, iris clipped by both lids); nose bridge, sides, tip, wings, base; front and side cheek, cheekbone line and the hollow under it; nasolabial fold; philtrum ridges; lip planes; chin box with a rounded 3-point bottom; jaw and masseter lines; under-jaw band; neck. Positions came from landmarks, then were hand-corrected against the photo and the line drawing. A subagent did a visual review and corrections were applied. (The early version, `reference-planes0001.py`, has 102 vertices and lacks ears, the lid bands, the canthus wedge and the sphere/neck points; the final script is not in this folder and must be copied in as the M0 reference.)
3. **Transfer to other angles.** The 2D vertices were warped to yaw 15, 39 and 61 degrees by 2D barycentric warping on landmark triangles and shown in a web editor where the user drags vertices, resets them and writes notes per angle and per point (saved to a database).

The user's verdict on step 3, which this plan must fix:
- On turned views the graph is invalid: "can't tell what is what, thus cannot adjust since I don't know which ones would occlude, this applies to eyes too".
- "You can't just warp all the points without letting e.g. the pupil circle become an ellipse; near profile implies half of the planes' points are occluded."
- "The wire mesh needs to be grounded on actual facial proportion geometry."
- The drag corrections moved points by a median of 6 px on the front, 11 px at 15 and 39 degrees, and 35 px at 61 degrees. Loomis neck and sphere points moved by up to 200 px. The median drag distance is exactly the error of the 2D-warp method against the user's own placement, so those numbers are the baseline (B0) the new method must beat.

Measured fact that makes the fix possible: the per-frame MediaPipe 3D landmarks are rigid across angles. A 3D similarity fit (Umeyama) from the front frame to each other frame has median residuals of 2.6 px (15 degrees), 8.1 px (39) and 11.4 px (61) at z scale 1.0. Scaling z by 0.5 or 1.5 is about 3 times worse. Background: MediaPipe's face mesh is a weak-perspective model with z scaled like x ([Google blog](https://developers.googleblog.com/en/mediapipe-3d-face-transform/)), which is consistent with this.

Why the 2D warp fails, in terms the design now respects: a 2D warp moves every point as if the face were a flat rubber sheet. It has no depth, so it cannot decide which points are hidden, cannot turn a circle into an ellipse, and cannot keep points on the cranium or neck (which have no landmarks) consistent with the face. It also treats the front hand corrections as the only truth and gives corrections made on a turned view nowhere to go.

## 2. The design in one paragraph

Build one 3D plane head per study session. Vertices live in a head frame (the front frame's landmark coordinates). Each shot has a rigid similarity transform from the head frame to that shot, fitted on landmarks (Umeyama). Plane vertices are lifted to 3D from the corrected front positions (z from the landmark surface for face points; z from a fitted Loomis sphere for cranium points; z from a neck cylinder for neck points), then for every shot transformed rigidly and projected. Visibility comes from facing tests plus a depth buffer built from that shot's landmark mesh, the sphere and the neck. Faces are explicit polygons with readable names and region colours. Irises are 3D discs, so they project to ellipses and are clipped by the projected lids. Every user drag on any view is stored as a 2D observation; observations from all views triangulate each vertex's 3D position by least squares with a landmark-depth prior, so a fix on one angle carries to the others. Proportion canons are computed from the vertices as a read-only measurement layer.

## 3. Geometry specification

### 3.1 Frames and conventions

- Shot frame: image pixels at capture size, y down, z as stored in `PoseResult.landmarks` (`z = p.z * width`, see `src/lib/pose/detect.ts`). Smaller z is nearer the camera.
- Head frame H: origin at the centroid of the 468 face landmarks of the reference (front) shot, unit = that shot's `bbox.size`, axes = that shot's image axes. All stored 3D positions are in H units, so they are independent of capture and export scale (same habit as `scalePose`).
- Reference shot: the shot with the smallest absolute yaw, user-overridable (`refShotId`).
- Head axes for primitives (sphere, jaw, neck) are derived from landmarks, not from a convention guess: lateral = landmark 454 minus 234, up = from chin 152 toward 10, orthogonalised; forward = lateral x up. M0 compares them with the `matrix` rotation (the app's `matrixToYPR` convention) and records any disagreement.
- Side naming: `L` and `R` mean image left and right of an unmirrored frame, which matches `landmarks.ts` (`LEFT_EYE` is the ring around 33, on image left) and the reference script (`eL*` has the smaller x). It is not anatomical left. Whether webcam shots are stored mirrored is unverified; M0 checks it on the capture before names are shown to the user.

### 3.2 Per-shot registration (rigid similarity on landmarks)

- For each shot f, fit `p = s_f R_f X + t_f` (Umeyama, closed form) from the reference landmarks to shot f's landmarks, over the 468 face points with a Huber IRLS reweighting so blinks, jaw opening and lip motion do not dominate. M0 compares "all 468" against a stable subset (nose bridge, brow, forehead, cheekbone, excluding lids and lips) and against chained registration (front to 15 to 39 to 61) versus direct, and keeps the one with the lowest residual.
- Projection of a head-frame point X in shot f: take `u = (p.x, p.y)` and drop z (weak perspective, consistent with the measured residuals). Depth for occlusion is `p.z`.
- Record `rms_f` and median residual per shot. These feed the observation weights (3.8) and the "far side unreliable" flag.
- Not used for registration: `modelToCamera`. It is a canonical-model pose in centimetres from Procrustes on the same landmarks, and it is kept for the yaw/pitch/roll labels and as a cross-check only.

### 3.3 Plane topology as data (no pixel constants)

`src/lib/planes/topology.ts` is pure data, versioned (`TOPOLOGY_VERSION`). Sketch:

```ts
type Region = "cranium" | "brow" | "socket" | "eye" | "nose" | "cheek" | "mouth" | "chin" | "jaw" | "neck";
type Seed =                                    // where a vertex starts before any user input
  | { tri: [number, number, number]; w: [number, number, number]; off?: [number, number] } // landmark-triangle barycentric + offset (face-size units)
  | { sphere: { dir: [number, number, number] } }                                          // direction from sphere centre (cranium)
  | { neck: { t: number; theta: number } };                                                // along the neck cylinder
type PlaneVertex = {
  id: string;            // "brow.ridge.outer.L"
  label: string;         // "Brow ridge, outer end (image left)"
  region: Region;
  surface: "face" | "cranium" | "neck" | "lid" | "limb";
  mirror?: string;       // partner id, for seeding, naming and the canon layer only
  seed: Seed;
};
type PlaneFace = { id: string; label: string; region: Region; verts: string[]; kind: "plane" | "band" | "wedge" };
type PlaneEdge = { a: string; b: string; kind: "ridge" | "contour" | "construction" };
```

- Vertices: about 100 named vertices (Appendix A groups the 102 vertices of the early script into regions with plain names; the final script adds ear top and bottom, the lid bands, the canthus wedge and the sphere and neck handles).
- Faces: explicit closed polygons, not polylines. The reference script only ever drew polylines, so face closure is new authoring. Appendix A gives a first cut derived from those polylines. It must be reviewed on the front frame in M0 (planarity, winding, no gaps or overlaps) before anything depends on it.
- Edges: ridges and contours that are not face boundaries (nasolabial, cheekbone line, masseter line).
- Symmetry: `mirror` pairs are used to seed a vertex from its partner, to label hover highlights, and by the canon layer. Dragging never auto-mirrors, because faces are asymmetric.
- Regions carry a colour token and a plain-language group name for the editor list.
- Seeds on a new subject: the front-frame positions the user corrected become `tri`/`w`/`off` seeds (the barycentric lookup happens once, at authoring, on the user's own front frame, in 3D on the same-frame landmark mesh). How well these seeds fit other faces is unmeasured; they only start the process, and the user corrects them.
- A topology validator (run in tests) checks: unique ids, every face vertex exists, faces have at least 3 vertices, mirror pairs reciprocal, no duplicate faces, region present.

### 3.4 Lifting the corrected front vertices to 3D

For each vertex, using the reference shot:
- `surface: "face"`: find the landmark-mesh triangle containing the 2D point (nearest triangle if just outside); z is the barycentric interpolation of that triangle's landmark z; optional per-vertex standoff along the mesh normal (zero by default).
- `surface: "cranium"`: intersect the viewing ray (parallel to z) with the front hemisphere of the fitted sphere (3.5); if the 2D point is outside the sphere's projected disc, move it radially to the silhouette.
- `surface: "neck"`: intersect with the neck cylinder (3.5).
- `surface: "lid"`: face-surface rule, plus a small standoff for lid thickness (the lower-lid band has thickness).
- `surface: "limb"`: points defined as silhouette (neck sides, sphere outline); see 3.8.
- The mesh triangle list is derived from `FaceLandmarker.FACE_LANDMARKS_TESSELATION` edges by extracting 3-cycles once and caching them. M0 verifies the triangle count. Do not reuse the "every 3 consecutive edges is a triangle" shortcut in `mesh-wireframe.ts` (`fillTriangles`), which assumes an edge ordering that is not documented.

### 3.5 Loomis primitives as fitted 3D shapes

Sphere (Loomis ball):
- Parameters: centre c (3D in H), radius R, side-cut ratio (default 2/3 of the circle height per Proko, which implies the side planes sit at about 0.745 R from the centre; the Krita plugin's default 0.66 differs, so it is a parameter), brow/hairline/nose line heights as measured values (not constants; implementations disagree, see RESEARCH.md section 8).
- Prior (before any user input): width W = distance between landmarks 234 and 454; the distance between side planes is about 2d with d = 0.745 R, so R0 is about W / 1.49; centre at ear height midway between 234 and 454, with depth such that the sphere's front passes the glabella landmark (168). This is a starting guess, not a fit.
- Fit: nonlinear least squares over four unknowns (c, R) using (a) user-confirmed cranium vertices (skull top, forehead tops, temple tops, back-of-head points), and (b) silhouette-circle observations: in any shot the user can drag the sphere's outline (centre and radius handles, like Loomism's Sphere Editor), which gives a 2D circle observation that constrains `s_f R_f c + t_f` and `s_f R`. With two or more shots at different yaw the centre depth becomes observable, which Loomism cannot do from one photo.
- Derived drawing: silhouette circle, centerline great circle, equator, side-plane rim ellipses (circles of radius sqrt(R^2 - d^2) on planes at +/-d along the lateral axis), brow/nose/hairline parallel curves (front arcs only), tilt shown as the ellipse of the rim.
- Quality label: "estimated (prior)" with fewer than two user-corrected views; "fitted" otherwise, with the residual shown. If the residual is above a proposed threshold the overlay shows "weak fit".

Jaw:
- Per side, a smooth curve from the bottom of the side-plane rim to the jaw corner (the plane's `jaw.corner` vertex) to the chin corner, drawn through the user's jaw/chin vertices. The Krita plugin parameterizes this as one cubic Bezier per side; here the curve is a spline through the corrected 3D vertices, so it follows the subject instead of a template.

Neck (cylinder):
- Parameters: axis top T and bottom B (3D vertices, user-draggable), radius r (and optionally a different bottom radius, since Proko notes the neck is slightly wider at the top from the side). Prior: T behind the jaw (the spine inserts behind the jaw), r from the visible neck width in the reference frame.
- Silhouette (limb) observations: the neck side vertices are points on the cylinder's silhouette, so their residual is the distance from the 2D point to the projected silhouette line, not a point correspondence (3.8).
- The sternocleidomastoid is drawn as a ridge edge from behind the ear (mastoid) to the pit of the neck; both ends are user-placed vertices. The pit of the neck is below any face landmark; it is a user vertex unless the optional Pose Landmarker (webcam only, see `OverlayPanel.tsx`) provides a sternal notch.
- No neck width or angle canon is applied (none found, RESEARCH.md section 10b); the canon layer only reports the measured neck-to-head width ratio and neck axis angle.

### 3.6 Eyes and irises

- The eye is ordinary topology (lid margin vertices, upper-lid band facets, lower-lid band, inner-canthus wedge, ties to the brow and orbital rim) positioned in 3D like any face vertex, so it projects correctly on every view.
- Aperture polygon: the closed loop of upper and lower lid-margin vertices as projected in the current shot.
- Iris: a 3D disc. Centre from landmarks 468 / 473 in the reference frame; radius defaults to the iris-ring landmarks but is overridden by two user handles on the iris edge in the front view (the hand lesson was that landmark eye rings come out too small and high). Normal: the local outward surface normal at the eye in H (looking forward) by default.
- Rendering: sample the 3D circle, transform rigidly, project. The ellipse axis ratio equals the cosine of the angle between the disc normal and the view direction, so the circle becomes an ellipse automatically. Keep only the samples inside the projected aperture polygon, which clips by both lids exactly as the front-frame hand lesson required, and drop it if the eye's vertices fail the visibility test (far eye behind the nose at high yaw).
- Check only: the per-frame iris landmarks (468 to 477) give a measured iris ellipse; it is compared with the projected disc and reported (gaze can differ from head-forward). The flat disc ignores eyeball curvature; that is a stated limit.

### 3.7 Visibility and occlusion

Computed per shot, from that shot's landmarks and the shared primitives:
1. Facing test: each vertex has a normal (the area-weighted mesh normal at its lift triangle, in H; cranium vertices use the sphere normal; neck vertices the cylinder normal), rotated by `R_f`. `n . v` with v toward the camera gives `visible` (clearly facing), `grazing` (near edge-on), or `back` (facing away).
2. Depth test: a low-resolution depth map (about 256 px wide) rasterized from the shot's landmark-mesh triangles (z = landmark z), plus the neck cylinder and the sphere's front hemisphere (the sphere occludes cranium and neck points only, not face points, because the face protrudes from or sits inside a Loomis ball in ways a sphere cannot model). A vertex is `occluded` if its depth is behind the buffer by more than a tolerance (proposed: about 1.5 percent of `bbox.size`).
3. Far-side reliability flag: when the shot's yaw is large (the session saw landmark quality collapse at 61 degrees; the exact threshold is proposed at 50 degrees and must be confirmed in M1), far-side face vertices are flagged `uncertain` because their landmark z is least trustworthy.
4. Face polygons: facing from the Newell normal of the projected 3D vertices; edges are sampled (about 8 samples each) and drawn only where visible. Hidden edge runs are omitted by default, or drawn as faint dotted ghosts when "Show hidden" is on.
5. Cached per shot: the depth map depends only on the shot's landmarks and the primitives, so it is not recomputed while dragging a face vertex.

The depth map is built once per shot and is a drawing aid. It does not claim to know the true surface where landmarks are poor (far side, ears, hair).

### 3.8 Triangulating user corrections across views

- Unknowns: one 3D position X per vertex in H.
- Observation: shot f, normalized 2D position `u` of the vertex as placed by the user in shot f (only for vertices that were `visible` and draggable there, so occluded views never contribute).
- Equations: `A_f X = u - t_f`, where `A_f` is the first two rows of `s_f R_f`. Weighted least squares with a prior:
  `(sum_i w_i A_i^T A_i + P) X = sum_i w_i A_i^T b_i + P X_prior`
  where `X_prior` is the landmark-surface lift (face points), sphere point (cranium) or cylinder point (neck), and `P` is a diagonal prior weight, strongest along the reference view axis for face points. This is a 3x3 solve per vertex.
- Weights: `w = 1 / (sigma_user^2 + sigma_reg_f^2)`, with `sigma_reg_f` the shot's median registration residual (measured 2.6, 8.1, 11.4 px at 15, 39, 61 degrees on this capture) and `sigma_user` a placeholder (proposed 3 px) to be calibrated by the leave-one-view-out run in M2.
- Robustness: Huber IRLS (a few iterations) so a single mis-click does not drag the vertex; the largest residual is shown to the user.
- Observability: if the data-only information matrix has a small minimum eigenvalue (views too similar in yaw), the vertex's depth is flagged "from landmark prior" in the tooltip.
- Limb vertices (neck sides, sphere outline) use a nonlinear residual: signed distance from the 2D point to the current primitive's silhouette in that shot. A small Gauss-Newton loop solves the primitive parameters (3.5).
- Consequence: a correction on 61 degrees moves the 3D vertex, so it moves on 39, 15 and front too, weighted by how reliable each view's registration is. Predictions for unedited vertices are computed from the same model, so editing the eye on one view also corrects the eye on the others. A consistency flag shows "this view disagrees with your placement on shot X by N px" when a new observation conflicts with an existing one beyond twice the combined sigma, and the user decides which to keep.
- Possible later extension, not in scope for v1: refine `s_f, R_f, t_f` from user observations (a small bundle adjustment). It would move shots away from the landmark registration, so it needs its own validation.

### 3.9 Proportion canon as a check layer

`src/lib/planes/canon.ts` computes, from head-frame vertices rotated onto the head axes (so the result does not depend on the shot's yaw), a list of rows `{ id, formula, measured, canon, delta, source, sourceVerified }`:
- Thirds: hairline (user-placed vertex, no default), brow line, nose base, chin bottom, measured along the up axis.
- Five eye widths: face width at the cheekbones versus eye fissure length, and intercanthal distance versus eye width and nasal width (orbital and orbitonasal canons).
- Ear between brow and nose base (uses ear top and bottom vertices).
- Eye line as a fraction of skull-top-to-chin height.
- Mouth corners versus pupil positions, in eye widths.
- Neck width relative to head width and neck axis angle versus the head up axis (reported only; no canon).
- Each row carries a `sourceVerified` flag. The thirds, five-eye and ear rows trace to pages I could read (RESEARCH.md 10b). The eye-line-at-half-height and mouth-under-pupil rows are not verified in a source I could open, so they are labelled as conventions.
- Drawn as dashed ruler lines with the measured difference, in a table. The module has no write path to vertices; a test asserts that enabling the layer leaves all vertices byte-identical.

## 4. Editor UX

Mounted in the existing `children` slot of `CanvasStage` (it is already a `relative` container), as an SVG layer sized to the canvas, so dragging redraws only the planes layer and not the photo.

- Background: photo, line drawing (reuses the existing `edges` overlay render) or both, because the user placed points against both.
- What is shown: faces filled at low alpha in region colours; edges; vertices as handles; primitives (sphere, side planes, jaw, neck); irises; canon rulers; each independently toggled. A region legend and a list with search by plain name ("Left brow ridge, outer") so "what is what" is answerable; hovering a vertex highlights the polygons that contain it and its mirror partner.
- Draggable: only `visible` vertices. `grazing`, `occluded`, `back` and `uncertain` vertices are drawn greyed (hollow, small, not interactive); the tooltip states why ("hidden behind the nose in this view").
- Trail strip: selecting a vertex shows its position in every shot as small thumbnails with a ring, so the user sees where it sits and where it is hidden in the others.
- Drag behaviour: live preview recomputes only the dragged vertex (with the tentative observation) and the polygons that use it; other shots update on pointer-up. One store write per drag.
- Per vertex per shot: Reset removes that observation. Reset everywhere removes all of its observations. Per shot: Reset all. Undo and redo of observation changes within the session (in memory).
- Notes: one note per shot and one per point per shot, each at most 500 characters, saved with the session.
- Sphere and neck: draggable handles (sphere centre and radius, neck top and bottom, neck sides) on the active view; each drag is an observation as in 3.8, shown with the fit label ("estimated", "fitted", "weak fit").
- Eyes: lid vertices behave like any vertex; iris radius has two handles in the front view only.
- Mark hidden: a review tool for the validation run only: the user can flag a vertex "actually hidden in this view" to give visibility ground truth (section 6, V3).

### 4.1 UX direction from the hands-on editor (2026-11-21)

The user corrected the four angles in a stand-in editor (an artifact page built from `reference-planes0001.py` and the 3D head of section 3). What they asked for, and what worked, is the UX spec here. It takes precedence over the bullets above where they differ.

- **What the user places is what the view shows.** A placement on a shot is a pin. That shot draws the vertex exactly there, and the solve in 3.8 uses pins only to predict the shots where the vertex is not pinned. Lines and faces pass through pinned points: per-view offsets are interpolated along each edge. On the reference (front) view, every original vertex counts as fixed at its accepted position. The solve then takes x and y from the front and depth from the turned views, and an edit on a turned view never moves the front.
- **Never silently down-weight earlier work.** A first 3D version blended the user's earlier 2D drags in at 30 percent weight, so the points visibly moved away from where the user had put them. The user had to ask for them back. Migrations of observations are exact, and a check asserts that every stored pin re-renders within 0.2 px of where it was saved.
- **Zoom and pan on the canvas:**
  - a tool strip directly above the drawing, with −, + and Fit and the current percentage;
  - pinch (touch and trackpad, plus Safari gesture events) and Ctrl/⌘ + wheel zoom about the pointer, from 0.3x to 12x;
  - dragging empty paper pans.
  The first version only had zoom buttons in the side rail, and the user did not find them.
- **Topology tools.** The user must be able to change the graph, not only move points:
  - Modes: Move (V), Add point (A), Connect (C) and Remove line (X), plus Delete point and Undo (Ctrl/⌘+Z) covering every change, drags included.
  - Add point splits a tapped line (3D prior = interpolated along the edge), or places a free point on the head surface. The free point is unprojected through the shot's depth map, or onto the front of the Loomis ball off the mesh.
  - Connect chains taps from point to point.
  - Faces are recomputed as the regions of the planar line graph, laid out on the reference view, so a new line immediately splits or merges planes.
  - Topology edits are one document per session (`added`, `addE`, `delE`, `delV`), separate from per-shot pins.
- **Hidden lines are still confusing on the turned views.** Dashed ghosts on the photo do not tell the user which surface hides what. Add a side-by-side rotatable 3D view:
  - It reuses `src/components/SkullPanel.tsx` and `src/lib/skull/scene.ts` (three.js is already a dependency, and the procedural skull already exists).
  - It shows the solved plane mesh, shaded by normal, over a skull proxy scaled to the Loomis ball, with the ball, side planes and neck cylinder.
  - Orbit freely. Buttons snap the camera to each capture's registered pose, and the photo canvas and the 3D view stay in sync.
  - Selecting a point or plane in either view highlights it in both. Faces hidden from the active capture are tinted, so the user can see from the side what the photo view occludes.
  - Dragging in the 3D view moves a point along the surface. The occlusion test of 3.7 is unchanged; this is a reading aid.
  - The skull GLB rule in `scene.ts` still applies: CC-BY or CC0 only, procedural fallback otherwise.
- **Plane orientation readout, and later editing.** Tapping a plane reports its Newell normal relative to the head axes, as yaw and pitch ("faces 34 degrees toward the viewer's left, tilted 12 degrees down"), with optional normal arrows on every plane. Moving any corner re-tilts every plane that uses it. Later, not in M2: a normal gizmo on the selected plane rotates it about its centroid. The solve changes only the corner depths along the active view's rays, so the active view does not move, the other shots update, and neighbouring planes re-tilt through their shared corners.
- **Names over keys.** Every handle has a plain name ("Lower lid edge, outer (viewer left)") in its tooltip, an optional label on the canvas, and region chips. New points can be named.
- **From planes to art: the underdrawing export.** The workflow the user mandated is: construction (Loomis, planes, features) over the line drawing, then an independent visual review, and only then glyph authoring. So the export in 5.3 also renders, for each shot at a common head scale (the reference view's pixel frame, which is the text-art frame), an underdrawing with these layers:
  - the faint line drawing;
  - the notan value block-in, clipped to the subject: dark masses connected to the Loomis ball, half-tones inside the face hull;
  - the Loomis construction;
  - the plane edges;
  - the feature contours drawn heavier.
  Each underdrawing is paired with the photo for review.

## 5. Persistence, backup, export

### 5.1 Study store (`src/lib/capture/study-store.ts`)

- Add an optional session-level field `planes?: HeadPlanesState` (the head is shared by all shots in a session). Optional field, same IndexedDB database `drawloom-studies` version 1, no migration. `save()` persists the entire `{ sessions, activeId }` blob; drag commits are single writes on pointer-up and the existing `storageError` banner is reused.
- Schema (observations are the source of truth; 3D positions are derived on load and not stored):

```ts
type HeadPlanesState = {
  version: 1;
  topologyVersion: number;
  refShotId: string;
  observations: Record<shotId, Record<vertexId, { x: number; y: number; at: number }>>; // normalized to that shot: (px - bbox.cx) / bbox.size
  primitives?: { sphere?: Record<shotId, { cx: number; cy: number; r: number }>; neck?: Record<shotId, Record<string, { x: number; y: number }>>; irisRadius?: Partial<Record<"L" | "R", number>> };
  notes: Record<shotId, { shot?: string; points?: Record<vertexId, string> }>;
  hiddenLabels?: Record<shotId, string[]>;   // validation only
};
```

- Topology changes: observations for ids that still exist are kept; orphans are listed in a banner and never deleted silently.
- Pure reducers live in `src/lib/planes/state.ts` (set/clear observation, set note) and are unit-tested; the store only calls them through `update`.

### 5.2 Backup (`src/lib/capture/backup.ts`)

- `parseBackup` rebuilds the session from whitelisted fields (`name`, `shots`, `order`, `layout`), so any new field is silently dropped unless parsing is extended. Add validation for `planes`: finite numbers within a sane bound, vertex ids match `^[a-z0-9.]{1,48}$`, note length at most 500, a cap on observations per shot (proposed 400) and total note bytes (proposed 100 KB).
- Version: write `version: 2` only when `planes` exists, and accept 1 and 2 on import. An older build then fails cleanly ("Choose a Drawloom study backup (version 1)") instead of silently discarding the corrections.
- Shot ids: the validator currently accepts only the five `CAPTURE_TARGETS` ids. The user's capture is 90 frames at arbitrary yaw (0, 15, 39, 61 degrees are the angles in the corrected set), so extend the accepted id rule to also allow `frame-<n>` ids, and cap keyframes per session (proposed 12) until the 40 MB backup limit and the whole-blob IndexedDB rewrite have been measured with more frames. The "N/5" count in `StudyBoard.tsx` is hard-coded and needs to follow.
- Getting the 90-frame capture in: `scripts/build-study-from-packets.mjs` converts a folder of per-frame packets and photos into a `drawloom-study` backup that the existing Import study button reads. No new UI import path.

### 5.3 Export for Hatch Studio (`src/lib/export/underdrawing.ts`)

- The existing path renders each enabled overlay alone on a transparent canvas. Add three overlay layers: `head-planes`, `head-primitives`, `head-canon` (ids and names flagged as experimental, default disabled). `OverlayContext` gets an optional `planes?: PlanesFrame` (the solved frame for this shot), computed by the caller, so overlay `render` stays pure.
- Add an optional `planes` block to `UnderdrawingPacket` (schema stays `drawloom.underdrawing.v1`):

```
planes?: {
  topologyVersion, source: "triangulated" | "single-view-lift", refShotId?,
  vertices: Record<id, { x, y, depth, visibility, observed, residualPx? }>,   // image px at export scale
  faces: { id, label, region, verts: string[], visible }[],
  irises: { L?: { cx, cy, rx, ry, rot }, R?: ... },
  primitives: { sphere?: { cx, cy, r, quality }, neck?: {...} },
  canon: { id, measured, canon, delta, source, sourceVerified }[],
  notes: { shot?: string, points?: Record<id, string> }
}
```
- A single uploaded photo has no other views, so it exports `source: "single-view-lift"`, flagged estimated, with no multi-view claim.
- The header comment in `underdrawing.ts` ("no inferred construction is added on export") becomes a conditional statement: with the flag on, inferred construction is added and labelled as such in `source`/`quality`.
- Unknown: whether Hatch Studio's importer tolerates an unknown `planes` key. M4 must test it; if it does not, gate the block behind an export option.
- Headless path (`scripts/export-underdrawing.mjs`, `window.drawloom.exportUnderdrawing`) keeps working because it goes through `buildUnderdrawingPacket`; it gets `single-view-lift` only.

## 6. Validation plan (gate before the flag is removed)

Ground truth: the user's own corrections on four angles (front, 15, 39, 61 degrees), exported from the earlier web editor's database as a fixture, together with the user's notes. The fixture contains photos of the user's face and stays outside the repository; the repo holds only the metrics script and a schema.

Method comparison (every metric is reported for B0, B1 and B2):
- B0: the failed method, 2D barycentric warp from the front frame. Its error against the user's placement is the user's drag distance: median 6, 11, 11, 35 px at front, 15, 39, 61 degrees.
- B1: single-view 3D lift from the front only (no triangulation).
- B2: the full method (triangulation with all observations except the held-out view).

Tests:
- V1 Registration reproduces the measured fact: recomputed Umeyama median residuals match 2.6, 8.1 and 11.4 px at 15, 39 and 61 degrees within 10 percent; the z-scale sweep at 0.5 and 1.5 is about 3 times worse. If not, the registration code is wrong before anything else is judged.
- V2 Leave-one-view-out reprojection error: for every vertex the user placed in view f, triangulate from the other views' observations, reproject into f, and compare with the user's placement, in px and in face-size units, reported as median and 90th percentile per angle and per region (eye, nose, mouth, cheek, jaw, cranium, neck). Proposed gate: B2 median at most half of B0 at 39 and 61 degrees (about 5.5 and 17 px), and no region worse than B0 at any angle. These numbers are proposals; Riki confirms them before the end of M2.
- V3 Visibility: using the "mark hidden" labels, report false-visible (a draggable vertex that is actually hidden) and hidden-recall per angle. Proposed: at most 2 percent false-visible among draggable vertices, at least 90 percent hidden recall. False-visible is the one that confuses editing, so it is the stricter number.
- V4 Eyes: the projected iris ellipse axis ratio versus the cosine of the head angle and versus the measured iris-landmark ellipse; visual check that both lids clip the iris in all four angles and that the far eye disappears when the nose hides it.
- V5 Sphere and neck: record the automatic fit error before any correction (the baseline is the user's moves of up to 200 px), then fit from two corrected views and report the held-out views' circle-centre error (as a fraction of R), radius error, and neck silhouette distance. Proposed: centre error at most 0.1 R and radius error at most 10 percent on the held-out views.
- V6 Canon layer: values on the front frame match the user's hand measurements; the byte-identical test (3.9) passes; each row shows its `sourceVerified` flag.
- V7 Round trip: drag 3 vertices on a turned view, reload the tab (observations and notes persist), back up and import as a new session (they survive, still `version: 2`), and the exported packet contains the corrected vertices and `source: "triangulated"`. A version-1 backup without `planes` still imports.
- V8 Regression: `npx tsc --noEmit`, `npm run build`, `npm run test:surface` with the flag off (unchanged six overlays, banned strings absent), and `npm run test:study` with the flag on and off.
- V9 Generalization: at least two more subjects at three or more angles, with the same V2 and V3 protocol, before default-on. A single-subject pass proves the method works for this capture, not for faces in general.

Caveats written into the results: the ground truth is the same person who placed the points, so correlated bias is possible (leave-one-view-out removes train/test leakage but not that); the Umeyama floor of 8 to 11 px at 39 to 61 degrees bounds how well any rigid transfer can do on this capture.

## 7. Milestones

0. **D0 automatic public deployment, first priority.** Complete the workflow, existing-domain routing and exit gate above before mesh implementation. Every passing commit pushed to `main` updates the public endpoint without a separate manual upload.
1. **M0 data and measurement, no UI.** Recover the final working scripts, the 3D head build and face topology from the originating machine's scratchpad before it disappears. Put reusable code and topology in versioned repo paths with provenance; keep face photos, capture packets, corrections and any subject-specific geometry in an external private fixture. Record durable locations and fail with a useful missing-fixture message on this PC. The early reference script is not a replacement for the final build. Then port the vertices into `topology.ts` (kinds, regions, mirrors, seeds); review the face list on the front frame; implement registration and the mesh triangle list; build the study backup from the 90 frames; extract the user-corrections fixture; reproduce V1. Exit: required assets are recoverable, V1 passes, the topology validator passes, mirroring and left/right naming verified on the capture.
2. **M1 3D plane head, read-only.** Lift, project, visibility, iris discs. Exit: V3 and V4 on the four angles; B1 numbers recorded.
3. **M2 triangulation, editor and persistence.** Drag (visible only), exact per-view pins (4.1), greyed hidden points, trail strip, reset, notes, undo, canvas zoom and pan, topology tools (add, split, connect, remove, delete), the side-by-side 3D view synced to the shots, store and backup (version 2, `frame-` ids, keyframe cap). Exit: V2 against the confirmed gate; V7 round trip; the pin re-render check of 4.1 passes.
4. **M3 Loomis primitives and canon layer.** Sphere with side planes and jaw, neck cylinder with handles, canon rows. Exit: V5 and V6.
5. **M4 export.** Three layers, `planes` packet block, Hatch Studio import check. Exit: Tracing shows the aligned layers; the unknown-key question is answered.
6. **M5 gate.** V8 and V9; then, and only then, remove the flag in one commit with `test-surface.mjs`, `README.md` roadmap and an FL entry updated.

## 8. File-level change list

| File | Change |
|---|---|
| `.github/workflows/drawloom-pages.yml` (new, D0) | Publish the checked static export on every push to `main`; manual recovery, serialized deployment, SHA receipt and deployment summary. |
| `rikiyanai/rikiyanai.github.io:main:drawloom/` (existing publication destination) | Automated artifact handoff; retain the parent site's CNAME, `.nojekyll` and sibling content, then verify its Pages build and public source-SHA receipt. |
| `src/lib/planes/topology.ts` (new) | Vertices, faces, edges, regions, seeds, `TOPOLOGY_VERSION`; pure data plus a validator. |
| `src/lib/planes/mesh.ts` (new) | Triangle list from the tessellation edges; point-in-triangle lookup; vertex normals. |
| `src/lib/planes/register.ts` (new) | Umeyama similarity with Huber reweighting; residual report. |
| `src/lib/planes/lift.ts` (new) | Front-frame 2D to 3D (face, cranium, neck, lid). |
| `src/lib/planes/primitives.ts` (new) | Sphere, side-plane rims, jaw spline, neck cylinder; priors and fits. |
| `src/lib/planes/visibility.ts` (new) | Facing tests, low-resolution depth map, reliability flag. |
| `src/lib/planes/triangulate.ts` (new) | Weighted least squares with prior, Huber IRLS, limb residuals. |
| `src/lib/planes/solve.ts` (new) | `solveFrame(session, shotId) -> PlanesFrame` (projected vertices, visibility, faces, irises, primitives, canon). The single resolver used by rendering, the editor and export. |
| `src/lib/planes/canon.ts` (new) | Read-only canon rows. |
| `src/lib/planes/state.ts` (new) | `HeadPlanesState` type and pure reducers. |
| `src/lib/overlays/head-planes.ts`, `head-primitives.ts`, `head-canon.ts` (new) | Overlays; default disabled. |
| `src/lib/overlays/registry.ts` | Add the three overlays only when `NEXT_PUBLIC_DRAWLOOM_PLANES` is set; extend the accuracy-boundary comment. |
| `src/lib/overlays/types.ts` | Optional `planes?: PlanesFrame` on `OverlayContext`. |
| `src/lib/store.ts` | No default change (initial overlays stay `enabled: id === "ovoid"`); optional edit-mode state. |
| `src/components/CanvasStage.tsx` | Pass the solved frame into `overlay.render` when present; mount children unchanged. |
| `src/components/PlanesEditor.tsx`, `PlanesPanel.tsx` (new) | SVG editor layer; list, layers, notes, canon table, trail strip. |
| `src/components/StudyBoard.tsx` | Mount the editor for the selected frozen shot; pass session and shot ids; replace the hard-coded "/5". |
| `src/lib/capture/study-store.ts` | Optional `planes` on `StudySession`; no new database version. |
| `src/lib/capture/backup.ts` | Validate and preserve `planes`; version 1 or 2; accept `frame-<n>` ids. |
| `src/lib/export/underdrawing.ts`, `api.ts` | `planes` block and layers; conditional header comment. |
| `scripts/build-study-from-packets.mjs` (new) | Per-frame packets and photos to a study backup. |
| `scripts/test-planes.mjs` (new) | Pure-math tests (registration, lift, visibility, triangulation, canon read-only). The repo has no unit-test runner today, so decide how the TypeScript is loaded (open decision D2). |
| `scripts/test-study.mjs` | Add the observation persistence round trip with the flag on. |
| `scripts/test-surface.mjs`, `README.md`, `docs/agent/FAILURE_LOG.md` | Changed only at the M5 gate, never before. |

## 9. Risks and open decisions

Risks:
- **Far-side landmarks are unreliable at high yaw** (session: residual 11.4 px at 61 degrees, and the far-side z is a network guess). Mitigation: facing test plus depth test, the `uncertain` flag, user observations override the prior, and V3 measures it.
- **The registration floor bounds every method.** A rigid transfer cannot beat the landmark residual (8 to 11 px at 39 to 61 degrees on this capture); the gate is set relative to B0, and bundle adjustment is a later option.
- **Sphere and neck have no landmarks.** Without two corrected views they are priors only and are labelled "estimated". The user's 200 px moves show the prior is poor, so the handles are first-class.
- **Face polygons are new authoring.** The early script drew polylines only. Mitigation: M0 review on the front frame, validator tests, hover highlight.
- **FL-015 regression.** Mitigation: build flag, no banned strings, measure-only canon, gate commit that updates `test-surface.mjs`.
- **Storage growth and 5-shot assumptions.** `save()` rewrites the whole blob; the backup id whitelist and "/5" label assume five shots. Mitigation: keyframe cap until measured.
- **Hatch Studio may reject unknown keys.** Unverified; M4 tests it.
- **Single-subject validation and correlated user bias.** V9 and the caveats in section 6.
- **Licences.** Do not copy GPL-3.0 Krita plugin code or its CC BY 4.0 Asaro mesh into an MIT project; the plugin was read only to compare conventions. `summers-head-head` is personal-use only.
- **Image-side naming.** `L`/`R` are image sides; webcam mirroring unverified.

Open decisions for Riki:
- D0 dependency: configure narrowly scoped cross-repository publication access from Drawloom to `rikiyanai.github.io`; the destination and public route are verified. Automatic deployment remains the first priority while this is resolved.
- D1: keyframe selection for the 90-frame capture (the proposed cap of 12 and which yaws).
- D2: how to run pure TypeScript math tests (add `tsx` as a dev dependency, or enable `allowImportingTsExtensions` and Node's built-in type stripping, or run them in Playwright). Recommendation: `tsx`, one small dev dependency.
- D3: confirm the proposed thresholds in section 6 before M2 ends.
- D4: whether Hatch Studio should receive `planes` by default or behind an export option.

## 10. Non-goals

No mesh deformation, no face model fitting (FLAME and similar), no machine-learned segmentation, no automatic left/right mirroring of edits, no skull superimposition, no Reilly rhythms, no claim that any canon is the right proportion, no default-on before the gate.

## 11. What changed from Muse's first draft

- 2D offsets from landmark defaults became 2D observations that triangulate 3D vertices.
- Facing-direction culling from canonical polygon normals alone became facing plus depth-buffer visibility, with explicit polygons and an `uncertain` far-side flag.
- "Mirrored far-side fallback" dropped: it asserted symmetry; far-side vertices are now flagged and left to the user.
- Camera re-estimation was out of scope; per-shot registration on landmarks is now core, with a measured residual.
- Loomis and canon moved from "constructed from landmarks" to fitted primitives with editable handles, and canons became measure-only.
- Added the FL-015 build-flag constraint, the backup version rule, the 5-shot assumptions in the code, and the missing unit-test runner.

## Appendix A: first-cut topology from the early script (`reference-planes0001.py`)

Plain names are proposals. `L`/`R` are image sides. Script keys in brackets.

Vertices by region (102 in the early script):

| Region | Script keys | Plain names |
|---|---|---|
| cranium (14) | skL skR; ftL ftR; feL feR; feL1 feR1; trL trR; tsL tsR; tlL tlR | skull top; forehead top corner; frontal-eminence split, top; frontal-eminence split, brow end; temporal ridge top; temple side; temple low |
| brow (10) | brL0 brL1 brL2 gl0 gl1 brR1 brR2 brR0; nas0 nas1 | brow ridge outer / mid / inner; glabella left and right; nasion sides |
| eye socket (8) | soLo soLlo soLli soLi; soRo soRlo soRli soRi | socket rim: outer, lower-outer, lower-inner, inner |
| eye (22) | eLo eLu1 eLu eLu2 eLi eLl2 eLl eLl1 (and R); crL0-2, crR0-2 | lid margin points (outer corner, upper x3, inner corner, lower x3); lid fold points |
| nose (11) | tip0-3; nsL nsR; wL0 wL1 wR0 wR1; sub | tip corners; nose side at the socket; wing outer and lower; subnasale |
| cheek (10) | ckL ckR; hoL hoR; mcL mcR; nlL nlR; zaL zaR | cheekbone; hollow under the cheekbone; mouth corner; nasolabial; zygomatic arch back end |
| mouth (13) | lpL lp0 lpR; pt; llL llR ll0; ml0 ml1; ph0-3 | upper-lip edge points; parting; lower-lip edge points; lip-chin groove; philtrum ridge ends |
| chin and jaw (12) | chL chR; cbL cb0 cbR; jaL jaR; eaL eaR; sjL sjC sjR | chin box corners; chin bottom (3 points, rounded); jaw corner; ear-level side point (jaw hinge region); under-jaw band points |
| neck (2) | nkL nkR | neck side at the image bottom |

Added by the final script and this plan (not in the early file): ear top and bottom, upper-lid band facets (5 from lid margin to fold), lower-lid band with thickness, inner-canthus wedge, brow and orbital-rim ties, hairline (user-placed), sphere and neck handles.

First-cut faces (closed polygons, from the early script's polylines; to be reviewed in M0):

- Cranium: skull top [skL skR ftR ftL]; forehead centre [feL feR feR1 feL1]; forehead outer L [ftL feL feL1 brL1 trL] and R [ftR feR feR1 brR2 trR]; temple L [trL brL0 soLo tlL tsL] and R.
- Brow and socket: glabella [gl0 gl1 nas1 nas0]; eye socket L [brL0 brL1 brL2 gl0 nas0 soLi soLli soLlo soLo] and R.
- Nose: bridge [nas0 nas1 tip1 tip0]; tip [tip0 tip1 tip2 tip3]; side L [nas0 tip0 tip3 nsL soLi] and R; wing L [tip3 nsL wL0 wL1] and R; underside [tip3 wL1 sub wR1 tip2].
- Cheek: cheekbone top L [soLo soLlo ckL]; front L [soLlo soLli nsL nlL ckL]; side L [soLo ckL hoL eaL zaL]; hollow L [ckL nlL mcL hoL]; all mirrored for R.
- Mouth: philtrum [ph0 ph2 ph3 ph1]; upper lip [mcL lpL lp0 lpR mcR pt]; lower lip [mcL pt mcR llR ll0 llL]; groove [llL ml0 ml1 llR ll0].
- Chin and jaw: chin front [ml0 ml1 cbR cb0 cbL]; chin side L [ml0 chL cbL] and R; lip-chin side L [mcL llL ml0 chL] and R; jaw front L [mcL chL cbL jaL] and R; masseter L [hoL mcL jaL] and R; ramus L [eaL hoL jaL] and R; under-jaw [jaL cbL cb0 cbR jaR sjR sjC sjL].
- Eye: aperture L [eLo eLu1 eLu eLu2 eLi eLl2 eLl eLl1] and R; lid bands and canthus wedge from the final script.
- Neck: front band [jaL sjL sjC sjR jaR nkR nkL].

Ridge and construction edges not bounding a face: nasolabial (nsL nlL mcL), cheekbone line (soLo ckL hoL eaL), the tie edges to the brow and orbital rim, the sternocleidomastoid (mastoid to pit of the neck), and the sphere and side-plane curves of section 3.5.
