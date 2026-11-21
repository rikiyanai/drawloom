# Brief: face-planes construction overlay for Drawloom (research + plan only)

Output folder: `docs/agent/planes-feature/` only. Do not edit anything else, do not commit, do not push.
Finish by writing `README.md` in this folder whose last line is exactly `DONE`.

## Context
Riki draws portraits (ASCII/text-art and traditional). An ad hoc Python script,
`reference-planes0001.py` (copied here), draws an Asaro-style "planes of the face"
construction over a portrait:
- It takes the MediaPipe 478-point Face Landmarker vertices that Drawloom already
  exports (`packet.json` -> `pose.vertices`, `drawloom.mediapipe.frame.v1`), registers them
  to the target image with a similarity fit on 6 landmarks (eye corners 33/133/362/263,
  mouth corners 61/291),
- then places ~90 named plane vertices (forehead/temple ridges, skull top, brow ridge,
  glabella, eye sockets, traced eye almonds + lid creases, irises clipped by both lids,
  nose bridge/sides/tip/wings/base, front/side cheek, cheekbone line and hollow,
  nasolabial, philtrum ridges, lip planes and parting, chin box with rounded bottom,
  jaw/masseter lines, under-jaw (submental) band, neck), mostly from landmark indices,
  then hand-corrected by eye against the photo and a B/W line drawing,
- and draws them as red polylines. A reviewer then checks the plane placement against the
  photo. Example result (view it): /private/tmp/claude-501/-Users-rikihernandez/5591bff3-64a4-4eda-ad29-a402158ce2b9/scratchpad/face/local/planes-review.png
- The good-workflow references Riki supplied (view them):
  /private/tmp/claude-501/-Users-rikihernandez/5591bff3-64a4-4eda-ad29-a402158ce2b9/images/17.webp
  /private/tmp/claude-501/-Users-rikihernandez/5591bff3-64a4-4eda-ad29-a402158ce2b9/images/18.webp
  /private/tmp/claude-501/-Users-rikihernandez/5591bff3-64a4-4eda-ad29-a402158ce2b9/images/19.jpg

Lessons from doing it by hand: landmark eye rings were too small and sat high; lash/lid
strokes in a line drawing inflate the eye height, so eyes must be traced from the photo;
irises must be clipped by both lids; the chin bottom must be rounded; a single landmark
spike under the chin reads as a pointed chin; head roll must carry through eyes and jaw.

## Step 1: search online FIRST (use your browser / web search)
Find and cite (URLs) existing work, and say what each one does and does not solve:
- Asaro head / planes-of-the-head references, and any open data for the plane topology
  (Proko, Asaro, "planes of the head" 3D models, Loomis/Reilly abstractions).
- Tools or code that fit a planar head or Loomis head to a photo or to face landmarks
  (e.g. Loomis-head fitting apps, PoseMyArt-style head planes, ArtPose, Magic Poser,
  "head planes overlay" GitHub repos, Blender add-ons, MediaPipe -> low-poly face meshes).
- Mapping MediaPipe 478 landmarks to anatomical regions (canonical face mesh UV/regions,
  FLAME/3DMM region segmentations) that could define plane polygons robustly across yaw.
- Prior art on editable 2D construction overlays (vertex dragging, per-photo corrections
  saved as offsets from the landmark-derived default).

## Step 2: plan the Drawloom feature
Read Drawloom's code first (`src/lib/overlays/*`, `registry.ts`, `src/lib/pose`, `src/lib/skull`,
`src/lib/export`, `src/components/OverlayPanel.tsx`, `CanvasStage.tsx`, `StudyBoard.tsx`,
the README). Then write `PLAN.md`:
- An overlay "Head planes" (and "Loomis sphere + neck") built from landmarks in 3D using the
  model-to-camera pose, so it works for front, three-quarter and profile; how hidden planes
  are culled by facing direction.
- Plane topology as data (vertex = landmark index or barycentric/blend of landmarks + offset),
  not hard-coded pixel coordinates.
- Hand adjustment: draggable vertices per shot, corrections stored as offsets (per study
  session, in the existing IndexedDB store and backups), notes per shot, reset per vertex.
- Export: include the planes layer and the corrected vertices in the
  `drawloom.underdrawing.v1` packet for Hatch Studio.
- A validation plan (front/three-quarter/profile shots, what counts as correct placement),
  milestones, file-level change list, risks. Keep claims honest: no anatomical-registration
  claims beyond what is measured.

Also write `RESEARCH.md` (Step 1 findings with links). README.md: 5-line summary, then `DONE`.
