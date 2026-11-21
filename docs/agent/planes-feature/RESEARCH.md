# Research: face-plane construction overlays (web search, 2026-11-21)

All URLs below were returned by live web search for this task. Each item says
what it does and does not solve for the Drawloom "Head planes" feature.

## 1. Asaro head / planes-of-the-head references and open plane data

- Proko, "How to Draw the Head from Any Angle" ([proko.com](https://www.proko.com/course-lesson/how-to-draw-the-head-from-any-angle)): Loomis-derived construction (cranium ball, sliced side planes, brow/center lines, jaw block). Does: teaches the construction Drawloom's Loomis overlay should mirror. Does not: provide any landmark-indexed or 3D data.
- Proko extreme angles + Peter Han brow-anchor lessons ([extreme angles](https://www.proko.com/course-lesson/how-to-draw-the-head-from-extreme-angles), [Han](https://www.proko.com/course-lesson/peter-han-draws-heads-in-every-direction)): brow line as the rotation/perspective anchor; centerline and side-plane ellipse tilt with roll. Does: validates driving plane culling/tilt from yaw/pitch/roll. Does not: give geometry.
- BueskenArt, "The Asaro Head: How To Master The Planes Of The Head" ([bueskenart.com](https://bueskenart.com/asaro-head/)): history (John Asaro, 1976; buy at planesofthehead.com), practice sketches. Does: confirms there is no official open Asaro topology — it is a physical sculpture. Does not: provide open data.
- Asaro Heads Pack 3D models ([artstation](https://www.artstation.com/marketplace/p/W3325/asaro-heads-pack-planes-of-the-head-3d-model), [cgtrader](https://www.cgtrader.com/3d-models/character/anatomy/asaro-heads-pack-planes-of-the-head)): commercial retopologized meshes; community free sculpts exist (e.g. ArtStation free Asaro study). Does: shows purchasable/free meshes whose vertex positions *could* be sampled as a one-time authoring reference for plane corners. Does not: license-free canonical topology; meshes are sculpted art, not registered to MediaPipe indices, and the facet layout is a lighting map, not a per-face fit.
- GridMakerPro Asaro guide ([gridmakerpro.com](https://gridmakerpro.com/learn/asaro-head/)) and ArtAtelier planar-head explainer ([artatelier.app](https://www.artatelier.app/learn/planar-head-explained/)): both argue the Asaro facets are a *lighting/value* map — where each facet lands depends on the individual head and the key light, so no fixed edge set sits correctly on every photo. Does: directly supports the brief's hand-correction requirement and the "no anatomical-registration claims" rule. Does not: solve fitting.
- FaceRef Angle Ref ([faceref.org](https://faceref.org/)): turntable 3D head with Loomis/Asaro modes and light control for artists. Does: proves demand for poseable Loomis/Asaro reference. Does not: fit to the user's photo or export landmark data.

Net: there is **no open Asaro plane topology indexed to face landmarks**. The honest path (used in PLAN.md) is to author an original plane topology *as data over MediaPipe indices* (cf. `src/lib/pose/landmarks.ts` pattern), using Asaro images only as visual guidance, and to label it "planes *in the manner of* Asaro", never a registration claim.

## 2. Tools that fit a planar/Loomis head to a photo or landmarks

- Loomism ([lr.fqdn.pl](https://lr.fqdn.pl/), [manual](https://lr.fqdn.pl/manual), [PDF manual](https://lr.fqdn.pl/static/Loomism_manual_EN.pdf)): free browser tool; detects facial landmarks, estimates 3-axis head orientation, draws Loomis + Reilly construction directly on the uploaded photo. Does: the closest prior art to Drawloom's "Loomis sphere + neck" overlay — proves landmark→pose→construction is feasible client-side. Does not: open-source its fitting code (no repo found); no plane facets, no per-vertex hand correction, no export packet.
- Krita Loomis Head Guide plugin ([krita-artists.org](https://krita-artists.org/t/loomis-head-guide-0-5-0-interactive-head-construction-for-krita-free-gpl), repo `ImBoolean-2/loomis-head-guide`): free GPL Krita docker; draws an adjustable/rotatable 3D Loomis head as drawing construction. Pine885 fork ([thread](https://krita-artists.org/t/plugin-loomis-head-guide-method-fork-by-pine885/193740)). Does: shows the adjustable-construction UX and the value of a 3D-driven (not pixel) construction. Does not: fit to a photo or landmarks — it is manually posed.
- PoseMyArt / Magic Poser / JustSketchMe / Easy Pose ([posemy.art via ask.clip-studio](https://ask.clip-studio.com/en-us/detail?id=132665), [Magic Poser](https://magic-poser-art-pose-tool.updatestar.com/en), [alternatives roundup](https://85ideasindia.blogspot.com/2026/01/7-posemyart-alternatives-for-3d-pose-references-character-drawing-and-digital-illustration-workflows.html), [review](https://doncorgi.com/blog/posemyart-review/)): posable 3D figures with grid guides in three planes. Does: proves artists want poseable guides with plane grids. Does not: fit guides to face landmarks; head detail is too coarse for plane construction.
- KeenTools FaceBuilder for Blender ([keentools.io](https://keentools.io/products/facebuilder-for-blender), [guide](https://medium.com/keentools/facebuilder-for-blender-guide-cbb10c717f7c), [FaceTracker](https://keentools.io/products/facetracker)): place pins on photos, drag them onto features; the mesh deforms "in a smart way" with region-local falloff ([release notes](https://keentools.io/news/2022-2)); FaceTracker pins a FaceBuilder-topology mesh to footage ([tutorial](https://medium.com/keentools/facetracker-tutorial-d1b9e4575186)). Does: the reference interaction for Drawloom's drag-to-correct + offsets model (pin = correction of a derived default, stored per view). Does not: run in-browser, do Asaro planes, or stay cheap — it is a paid desktop photogrammetry tool.
- Generic "head planes overlay" GitHub/Blender searches surfaced only sculpting skills and retopology tools (e.g. HeadWrap: [youtube](https://www.youtube.com/watch?v=DO1mRyRmRbI)), no landmark-fitted plane overlay repo. Honest negative result: **no open-source photo→head-planes fitter was found**.

Net: compose, don't copy — Loomism's auto-fit idea + Krita plugin's 3D-driven construction + FaceBuilder's pin/offset correction model, all re-implemented against Drawloom's existing `PoseResult` + `modelToCamera` matrix.

## 3. MediaPipe 478 landmarks → anatomical regions (for yaw-robust polygons)

- Official Face Landmarker guide ([developers.google.com](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker)): 478 3D landmarks + 52 blendshapes + optional 4x4 `facialTransformationMatrixes` (Drawloom already enables all three in `src/lib/pose/detect.ts`). Does: gives the exact 3D + pose inputs PLAN.md builds on. Does not: label any anatomical region.
- Legacy Face Mesh docs ([mediapipe.readthedocs.io](https://mediapipe.readthedocs.io/en/latest/solutions/face_mesh.html)): mesh = runtime metric landmarks as positions + UV/triangulation inherited from the canonical face model; canonical OBJ + `canonical_face_model_uv_visualization` image. Community transfers of that data: `canonical_face_model.obj` + `uv_map.json` ([deepwiki](https://deepwiki.com/jv12347/mediapipe-facemesh-to-obj-blender/4.1-canonical-face-model-and-uv-map)), deriving per-landmark UV/triangulation ([deepwiki](https://deepwiki.com/jv12347/mediapipe-facemesh-to-obj-blender/2.3-obj-mtl-and-texture-generation)), real-time mask transfer with UVs ([codrops](https://tympanus.net/codrops/2026/09/06/building-a-real-time-3d-face-mask-with-mediapipe-threlte-and-three-js/)). Does: the mechanism for defining plane polygons as index/barycentric data on a fixed topology. Does not: name cheek/chin/jaw regions.
- Named contour constants: `FACEMESH_LIPS / LEFT_EYE / TESSELATION` ([cdn.jsdelivr.net type defs](https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1629159166/index.d.ts), [demo code](https://codepen.io/mozta/embed/preview/KKxLKzJ?default-tabs=js%2Cresult)); per-region index tables incl. eye rings, lip rings, brow arcs, face oval ([pub.dev](https://pub.dev/documentation/face_detection_tflite/6.10.2/face_detection_tflite/faceContourMeshIndices-constant.html)); Drawloom's own translation to ordered rings in `src/lib/pose/landmarks.ts`. Does: eye/lip/oval polygons robust across yaw (they ride the mesh). Does not: cover forehead/temple/cheek/jaw/neck — those must be authored from landmark neighborhoods, not looked up.
- FLAME parametric model region masks (`FLAME_masks.pkl`: `face/forehead/nose/lips/eye_region/scalp/neck/eyeballs`, [deepwiki](https://deepwiki.com/summertight/SurFhead_repo/4.3-flame-implementation), [geoavatar](https://deepwiki.com/seungjun-moon/geoavatar/5-flame-model-system)) and MediaPipe↔FLAME landmark embedding (`mediapipe_landmark_embedding.npz`, [deepwiki](https://deepwiki.com/zjumsj/GaussianBlendshapes/6.3-mediapipe-integration)). Does: the only surveyed open per-vertex anatomical segmentation of a face mesh — usable as a cross-check when assigning plane corners. Does not: map to MediaPipe indices directly; requires a FLAME fit pipeline far heavier than Drawloom's in-browser scope, so it stays a validation reference, not a runtime dependency.

Net: eyes/lips/oval come from established index rings; planes over the rest are authored as landmark-index/barycentric definitions (the brief's lessons — trace eyes from the photo, clip irises by both lids, round the chin — become explicit construction rules, not pixel constants).

## 4. Editable 2D construction overlays (drag vertices, save per-photo corrections)

- KeenTools pinning (above): drag pins, region-local deformation, per-view match. Closest model for "offsets from the landmark-derived default". Proprietary, desktop-only.
- Generic 2D editors all converge on the same pattern — draggable vertices with live edge updates and undo (CAD grips: [OpenCADIrrigation](https://opencadirrigation.com/manual/drawing/); level editor: [CloudedStudio](https://cloudedstudio.com/documentation/level-proto-2d/index.html); canvas Transformer: [infinitecanvus](https://infinitecanvas.cc/guide/lesson-021)). Does: confirms draggable-vertex + stored-offset is the standard, learnable UX. Does not: address landmark-derived defaults or study-session persistence.
- Photo-to-3D alignment patent ([US9123159B2](https://patents.google.com/patent/US9123159B2/en)): drag a 3D point onto the 2D photo, camera estimate updates live. Does: validates showing the construction update live while dragging. Does not: apply to Drawloom (no camera re-estimation; corrections are pure 2D offsets).

Net: no surveyed tool stores *per-photo offsets from a landmark-derived default* with *per-vertex reset + notes* in an IndexedDB study session — that combination is Drawloom-original. PLAN.md fits it into the existing `drawloom-studies` IndexedDB store (`src/lib/capture/study-store.ts`) and the versioned backup format (`src/lib/capture/backup.ts`), plus the `drawloom.underdrawing.v1` packet (`src/lib/export/underdrawing.ts`).

---

# Part 2: Loomis, construction and proportion research (added 2026-11-21)

Scope: the Loomis side of the feature (sphere, side-plane cut, jaw, neck) and the proportion canons. Every URL below was opened by fetch or returned by search in this session. Section 10 lists what could not be opened. Sections 1 to 4 above are Muse's work and were not re-opened.

## 5. Andrew Loomis head method and the Reilly abstraction

Primary source (Loomis, "Drawing the Head and Hands") was not opened; the method below is taken from Proko's lesson notes, one blog summary and the Krita plugin code, and is labelled by source.

- Proko, "How to Draw the Head from Any Angle", notes ([proko.com](https://proko.com/course-lesson/how-to-draw-the-head-from-any-angle/notes)). Extract: start with a "perfect circle" for the cranium; chop a slice from both sides so the oval's height is "2/3 of the height of the circle"; the line on the front plane is the brow (watch its angle); the same distance again above gives the hairline; "a curve identical to the brow line" gives the bottom of the nose; "double that distance to find the chin" (as extracted; I could not reconcile this sentence with equal thirds from the extract alone, so the plan does not use it as a rule); jaw angles run from the brow to the side plane; vertical tilt shows as an angle along the side plane; front-plane angles (hairline, brow, nostrils, lips, chin) repeat the angles of the front plane of the box.
  - Solves: names the construction order, the side-cut ratio and the idea that brow/nose/hairline lines are parallel curves on the sphere that carry head tilt and roll.
  - Does not: give a camera model, a neck, or any way to fit a particular face. The ball is a drawing device; a real cranium is not a sphere.
- Loomis divided-ball summary, Jeff Searle's blog ([jeffsearle.blogspot.com](https://jeffsearle.blogspot.com/2015/09/the-divided-ball-and-plane-method.html), secondary source). Extract: slice "about two-thirds the height of the ball"; the middle line drops from the front of the ball starting at the brow line, divided into thirds (hairline to brow, brow to nose, nose to chin); the side-plane vertical line marks the ear and the back limit of the jaw; ear top near the brow line, ear bottom near the nose line; the jaw joins the centre of the side oval and meets the chin in front.
  - Solves: ear and jaw-hinge placement on the side plane (the ear is a landmark on the side plane, not on the ball).
  - Does not: say anything about the neck (the page extract has none).
- Reilly abstraction ([nma.art](https://www.nma.art/courses/the-frank-reilly-drawing-method/), [finearttutorials](https://finearttutorials.com/?p=12268)). Extract: "a rhythmical representation of the shapes and forms of the head", a constructive/graphic hybrid emphasising line and shape design. The pages I opened gave no geometry (no circle/oval sizes, no rhythm-line coordinates).
  - Solves: names the "rhythm line" idea (cheekbone and side-plane flow lines).
  - Does not: supply any reproducible geometry. FL-015 already removed an unvalidated Reilly overlay from Drawloom. The plan does not reintroduce Reilly rhythms.

## 6. Proko and Asaro plane lessons

- Proko, "Planes and Forms of the Head", notes ([proko.com](https://proko.com/course-lesson/planes-and-forms-of-the-head/notes)). Extract: the side plane (temporal fossa) is bounded by four points (hairline, base of the nasal aperture, temple, back of the skull); the temple is "most often visible as the pointy end of the brow as it turns the corner"; the cheek is a long C-curve "from top of ear ... to the front end of the mandible"; the eye socket is angled up from the outer corner to the inner corner (keystone) and extending that line through the brow ridge gives the forehead planes; jaw angle is relative to the temporomandibular joint. The lesson treats planes as structure (bone, ligament, fat), not as light.
  - Solves: where the forehead, temple, cheekbone and jaw plane breaks sit relative to bone landmarks. This is the authoring reference for the plane topology (what a face polygon is bounded by).
  - Does not: give coordinates, or say which polygon corner moves when the head turns. It teaches by cutting forms, so it supports hand correction, not a fixed fit.
- Asaro references (Muse, section 1) describe the facets as a light and value map. Nothing found in this session contradicts that. The Krita plugin ships an Asaro mesh (section 8), which confirms there is only a retopologized sculpture, not a topology tied to face landmarks.

## 7. Loomism (lr.fqdn.pl)

- Home page and manual ([lr.fqdn.pl](https://lr.fqdn.pl/), [manual](https://lr.fqdn.pl/manual)). Extract: free browser tool; "detects the facial landmarks, estimates the head's orientation in three axes and draws the construction from that"; the Sphere Editor is "an editable Loomis ball, seeded from the detected head pose" with draggable handles for roll, centerline and chin; when "the head is tilted far up or down the automatic fit becomes unreliable". Construction: cranial sphere with flattened side planes, centerline and horizontals (brow, hairline, nose, jaw), quarter and third subdivisions, optional dashed "dot lines" showing the divisions as bands around the tilted head. It omits the neck. It pairs Loomis with Reilly rhythms and a proportions overlay. The page names no landmark library, no licence and no repository; the author handle is "littlesnake".
  - Solves: proves the workflow (landmarks, then pose, then sphere seeded from pose, then user handles) and confirms the automatic sphere is the weak step at extreme pitch.
  - Does not: expose its fitting method or code; no plane facets; no neck; no per-vertex data you can export; no multi-view reasoning (one photo at a time).
  - Consequence for Drawloom: the sphere gets its own editable handles, and the app's multi-view data (several angles of one head) is used to fit the sphere centre and radius, which Loomism cannot do from one photo. This agrees with the user's finding that the automatic Loomis sphere and neck points were moved by up to 200 px.

## 8. Krita Loomis Head Guide (ImBoolean-2/loomis-head-guide), geometry read from source

Opened: README, `docs/ARCHITECTURE.md`, the file tree and `loomis_head/loomis_head_generator.py` ([repo](https://github.com/ImBoolean-2/loomis-head-guide), [generator](https://github.com/ImBoolean-2/loomis-head-guide/blob/HEAD/loomis_head/loomis_head_generator.py), [architecture](https://github.com/ImBoolean-2/loomis-head-guide/blob/HEAD/docs/ARCHITECTURE.md)). The original plugin is by lm0ss ([krita-artists thread](https://krita-artists.org/t/loomis-head-generator-plugin/138278)); the ImBoolean-2 repo is a later, much larger version. Licence: code GPL-3.0, Asaro mesh CC BY 4.0 (derived from "Asaro-head" by ivan4akir, design by John Asaro, per `LICENSE-ASSETS.md` and ARCHITECTURE.md). Drawloom is MIT, so no code or mesh should be copied; the geometry conventions below are described only to show how others parameterize the construction.

How it builds the head (pure Python, no photo input, orthographic):
- Sphere: radius R (times a cranium scale), centre at the origin; pose is a quaternion set by a trackball, not detected. Projection scale is `min(w,h) * 0.3 * scale`. Drawn curves: silhouette (great circle facing the camera), centerline (great circle in the plane x = 0), equator (circle normal to y).
- Side-plane cut: planes x = +/-d with d = side_cut * R, default 0.66; the rim is a circle of radius sqrt(R^2 - d^2) (0.75 R at default) with a cross inside it. Note Proko's "oval height = 2/3 of the circle" implies d = 0.745 R, so the plugin default and Proko differ slightly; implementations disagree and the plan must make this a parameter.
- Feature lines: horizontal circles at height y = (frac - 0.5) * 2R, front arc only. Plugin defaults: brow 0.62, eye 0.50, nose 0.32, mouth 0.18 (the eye line sits on the equator by default). Features (eyes, nose, brows, mouth) are drawn on the sphere surface with z = sqrt(R^2 - x^2 - y^2).
- Jaw: per side, one cubic Bezier from the bottom of the side-plane rim (+/-d, -rim_r, 0) to a jaw corner, then to a chin corner. Jaw corner: down by `0.8 * (1.22 R - rim_r) * (0.65 + 0.35 * age) * jaw_drop`, inward by 10 degrees. Chin corner: forward by R, inward 15 degrees, down by R * tan(12 + 8 * age degrees). With the defaults that puts the chin about 1.5 R below the sphere centre (my arithmetic from the defaults, not a statement in the repo). Controls: taper and `jaw_angle` (corner sharpness), chin width and sharpness.
- Cheekbone: Bezier from a point on the side-plane rim (height set by `cheekbone_height`) to the chin corner, plus a quadratic fill curve to the jaw corner.
- Visibility: curves are split into front and back by z sign (silhouette) or by plane facing (rims); back segments are drawn dashed. This is a per-curve facing test with no depth buffer.
- Asaro mode: static retopologized mesh (122, 242 or 272 faces), painter's algorithm by mean z, per-face shade by normal.
- Neck: only in Asaro mode (a flag on neck faces). The Loomis construction has no neck.
- Tests: 153 unit tests (pure Python geometry).
  - Solves: a complete, parameterized, rotation-correct sphere + side cut + jaw + cheekbone recipe, and a clear editing vocabulary (side cut, jaw angle, chin width, cheekbone height).
  - Does not: fit any photo or landmark; has no neck on the Loomis head; its numeric defaults are drawing conventions (they disagree with Proko by a few percent) and are not validated against faces; its front/back test would fail for a sphere that the nose or cheek hides.

## 9. Other open 3D Loomis / Asaro implementations

Searched GitHub topics, three.js and Blender terms.
- GitHub topic `loomis` returned two repositories: the Krita plugin above and `wren-11/summers-head-head` ([repo](https://github.com/wren-11/summers-head-head)), a PWA tracing table with a rotatable 3D Loomis head. Its licence is personal use only ("Don't redistribute it, publish modified versions or use it commercially without permission"), and I did not read its source. Not reusable, and no fit to photos.
- Blender: only a ZBrush/Blender Grease Pencil render of Loomis planes ([BlenderArtists thread](https://blenderartists.org/t/planes-of-the-head-from-andrew-loomis-method/1412699), Josh Galeto); no download or licence is stated. No Blender add-on for Loomis or Asaro guides was found. Sketchfab Loomis models and a 33d.ch STL were listed by search but not opened.
- three.js: no open Loomis or Asaro head repository found. A three.js GNM head editor appeared in results (a head model editor, not a Loomis tool).
- Honest result: the Krita plugin is the only open implementation with readable geometry; there is no open implementation that fits a Loomis head or planes to landmarks or photos, and none that does multi-view fitting.

## 10. Face landmarks as a 3D head, and proportion canons

### 10a. What the MediaPipe 3D data is (supports the measured rigidity)

- Google Developers Blog, "MediaPipe 3D Face Transform" ([post](https://developers.googleblog.com/en/mediapipe-3d-face-transform/)). Extract: the Face Mesh uses a weak perspective camera model; x and y are screen positions and z is relative depth "scaled as the X coordinate"; the pose matrix is a rigid mapping from a canonical metric face model (centimetres) to the runtime landmarks, estimated by Procrustes analysis.
  - Solves: explains why the landmark cloud is a rigid 3D object with z in the same scale as x, y (the session's measured result: Umeyama median residuals 2.6, 8.1, 11.4 px at yaw 15, 39, 61 degrees at z scale 1.0, and about 3 times worse at z scale 0.5 or 1.5), and why the plan can fit a similarity between frames directly on the landmarks.
  - Does not: promise that z is accurate (it is a network estimate; the session's residuals grow with yaw), and says nothing about the cranium, ears or neck, which have no landmarks.
- Umeyama, "Least-squares estimation of transformation parameters between two point patterns", IEEE TPAMI 13(4), 1991, DOI 10.1109/34.88573 (identified by search, the paper itself was not opened). Closed-form rotation, translation and scale between two point sets. Used for frame-to-frame registration.

### 10b. Proportion canons: what the sources I opened say

| Canon | Source and status |
|---|---|
| Thirds: hairline to brow, brow to nose base, nose base to chin | Proko front view ([notes](https://proko.com/course-lesson/how-to-draw-the-head-front-view/notes)): "hair/brow/nose/chin"; closest third looks larger when the head tilts. Searle (above) agrees. |
| Five eye widths across, one between the eyes | Proko front view: "approximately 5 eyes wide, with 1 eye width between each eye". Clinical literature calls it the rule of fifths, with the intercanthal distance equal to eye width (orbital canon) and nasal width (orbitonasal canon), per search results ([Al-Sebaei 2015 index](https://head-face-med.biomedcentral.com/articles/10.1186/s13005-015-0064-y)). |
| Ear between brow and nose base | Proko front view: ears in the middle third, aligned with where the construction circle ends; ear below the brow line signals the head tilts up. Searle: ear top at brow, bottom at nose line. |
| Eye line at half head height | Not stated in any page I could open. The Krita plugin default puts the eye line on the sphere's equator (0.50). Unverified as a published rule; treat it as a convention to be measured. |
| Mouth corners under the pupils | Not found in any page I could open (Proko says pupils sit at roughly one-third intervals from the outer edges). Unverified; measure and report, do not assert. |
| Neck width / angle | No numeric canon found. Proko: the neck is a tilted cylinder whose axis tilts forward, "lower in the front and higher in the back", slightly wider at the top from the side. |
| Measured populations vs the canon | A search-result snippet of Farkas-based literature reports thirds of 31.0 / 30.5 / 38.5 percent (male) and 29.5 / 32.4 / 38.2 percent (female), i.e. the canon of equal thirds is not what is measured; I could not open the full text to verify. PMC3074358 (opened, [link](https://pmc.ncbi.nlm.nih.gov/articles/PMC3074358)): across 27 ethnic groups forehead height varies most (CV 0.098 to 0.110), ear height and facial widths least (CV 0.042 to 0.056); it does not test the canons themselves. |

Net for Drawloom: canons are teaching conventions, individuals deviate, and FL-015 removed an earlier "canonical proportion" overlay. The canon layer in PLAN.md therefore measures the subject's own vertices against each canon and reports the difference; it never moves a vertex toward a canon and never labels a face wrong.

- Neck anatomy, Proko ([form notes](https://www.proko.com/course-lesson/how-to-draw-neck-muscles-form/notes), [anatomy and motion notes](https://www.proko.com/course-lesson/how-to-draw-neck-muscles-anatomy-and-motion/notes)). Extract: the neck is a cylinder tilted forward; the spine inserts on the back of the skull, "completely behind the jaw", and the throat sits in front of the spine; the sternocleidomastoid makes a V from behind the ear (mastoid process) to the pit of the neck, its clavicular head is the side of the cylinder and its sternal head is a gesture line from skull to rib cage; the hyoid marks the corner between the underside of the jaw and the front of the neck; the thyroid cartilage shows a 90 degree V in profile.
  - Solves: tells the plan where the neck cylinder attaches (behind the jaw, below the mastoid), which edge is the SCM, and where the pit of the neck is.
  - Does not: give sizes. The pit of the neck is below the head; no face landmark reaches it, so it is a user-placed vertex unless a body pose model is on (the app's optional Pose Landmarker adds a sternal-notch line, see `OverlayPanel.tsx`).

## 11. What could not be opened or verified

| Item | Result |
|---|---|
| Loomis, "Drawing the Head and Hands" (primary text) | Not opened; Loomis claims rest on Proko and the Searle blog. |
| Al-Sebaei et al., Head and Face Medicine 2015 (full text and table 2) | Redirected to Springer's login gateway three times; only the search-result snippet is available. Canon percentages above are unverified. |
| Creative Bloq "draw neck and shoulders" | Page returned navigation only, no article text. |
| Reilly abstraction geometry | nma.art and finearttutorials pages contain no geometry in what I could read. |
| Loomism fitting code, licence, source repo | None published or linked; not found. The PDF manual (lr.fqdn.pl/static/Loomism_manual_EN.pdf) was not opened; the HTML manual was. |
| `wren-11/summers-head-head` source | Only the README-level description read; licence is personal use only. |
| Sketchfab and 33d.ch Loomis models, ArtStation or CGTrader Asaro packs | Titles seen in search results; not opened. |
| HeadForge (Superhive) Blender add-on docs | Appeared in search results; not opened. |
| Muse's section 1 to 4 sources | Not re-opened in this pass. |
| Any open photo-to-Loomis or photo-to-planes multi-view fitter | None found. |
