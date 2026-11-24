# Studio photo workspace

Open `/drawloom/photo-workspace/` from Studio's **Photo workspace** control. `/drawloom/portrait-shader/` opens the same workspace. Neither route uses the earlier hand-spelled face prototype.

## Construction before extraction

The default route is photo → selected-person cutout → fitted head forms and planes → selected visible structure and bounded value regions → native text. **Generate all portraits** uses the same controls and pipeline for every crop. No identity-specific branch or prewritten face is selected.

The single-view drawing prior is deformed by the current MediaPipe landmarks. Canonically oriented facial-surface triangles provide facing, depth and occlusion; hidden jaw and eye segments are excluded. A robust fit to broadly skin-covered plane patches estimates illumination. Plane ownership, openings, overlaps and supported folds decide which facial lines survive. Broad plane changes remain values rather than emitting the complete wireframe. This is estimated construction from one photo, not a calibrated anatomical scan or a claim of universal Asaro-head accuracy.

**Fit planes & select structure** exposes the intermediate result before encoding. Fitted plane values, Plane-selected lines, Foreground material evidence, and the head/facial-hair mask are selectable study views and exportable guides. The plane diagnostic windows its display contrast over the fitted range and shows inferred geometry beneath foreground materials; saved physical values and actual shadow decisions retain their original scale. **Fit and inspect 3D head planes**, photo pins and numeric corrections change the same saved construction consumed by generation. Generate again after editing the construction.

Photo edges are extracted after the plane study. The bundled MIT TEED model supplies proposals for foreground hair, clothing and material outside facial structural ownership. Material evidence compares the photograph against expected skin-plane values, with texture and protected-feature gates; it can still confuse accessories, albedo and illumination. Facial hair must remain foreground material. Photo contours only, Photo values, and Already prepared line art remain explicit comparison inputs.

The pinned STNK20 encoder articulates the selected input as proportional-font native text. Its trained alphabet omits several useful eye glyphs, so a separate geometry-conditioned eye/brow word planner reserves its footprint before encoding. It uses visible lids, source-supported iris mass, blink state and measured glyph ink; it does not relabel learned weights. Unresolved eyes are reported rather than treated as successful likenesses. Neither encoder nor planner establishes AAHub-quality output for arbitrary faces.

**Inspect eye construction and row phases** shows the actual Generate target against measured native candidates: source-supported lid/iris/pupil, native row boundaries, accepted passages in green and closest rejected ink in red. It exports the same diagnostic PNG. Whole cooperating upper/lower passages may span two rows; glyphs retain their actual font shape. Numeric coverage is diagnostic, not visual approval.

Exact model revisions, checkpoints, weights and licenses are bundled under `public/models/`. This uses the public learned renderer credited by AAHub; AAHub's current private production configuration has not been established. Models run in the browser. Runtime assets may be fetched from documented CDN endpoints; source photographs are not uploaded to a server.

## Controls and saved output

**Upload source photo** proposes individual crops. Source orientation applies a quarter-turn on import. Large photographs retain their original data and use a longest-side 2400 px working copy. **Export original crop** maps the crop back to original pixels and orientation. **Import capture photo** reads the original Photo layer from a Drawloom packet; it does not reuse its previous artwork.

Crop each person, then **Isolate selected person**. Pick person, Erase mask, Restore mask and Undo mask stroke correct difficult boundaries. Face & shoulders framing includes retained hair/headwear. Rows sets the footprint; width remains within the encoder's 640 px limit. Native glyphs are never stretched.

Native text uses Studio's actual Saitamaar font at 16 px with 17 px rows. The encoder's 18 px input rows receive aspect compensation. Gap serialization uses the native profile's full spaces and measured Unicode pixel spaces, preserving each existing ink word's integer pen position with zero shift. The exported TXT renders the PNG. Raw model text, planned words and exact prepared input remain saved for diagnosis. Matching advances does not prove parity with the upstream atlas's undocumented rasterizer.

Plane shadow tone adds bounded native passages in connected fitted shadow regions relative to the subject's own skin-plane median. Hair shadow detail and Hair vocabulary add fields inside dark source pixels of semantic head/facial-hair masks. **Follow source hair flow** uses averaged texture orientation inside those material regions to choose native directional courses; low-coherence regions retain a neutral field. Tone respects existing ink positions and protected corridors. **Apply tone to all** applies shared settings to saved outlines; it does not rerun structural analysis.

**Save workspace** retains original/working photographs, crops, masks, corrections, structure records, guides, raw/native text and controls. **Export Studio project** retains editable text and registered source, cutout, values, contours, plane/structure/material guides. Embedded **Create project in Studio** uses a source-checked message. In a separate tab, use Studio's **Photo workspace → Open prepared photo project**. It validates the document, persists the previous project, checks concurrent edits, and opens/persists a new project through Studio's normal controller.

Studio vocabulary/reference controls open its actual authoring surfaces. No injected script, private layout harness or direct project-store write authors these images. Imported text remains a draft to inspect at native size beside the original. Animation, temporal coherence and general portrait quality are not established by format checks.

## Local use

Development: `npm run dev -- --hostname 127.0.0.1 --port 3002`.

Production static export: `npm run build`, then in PowerShell `$env:PORT='3001'; npm run serve:static`.

Pure format/crop/document checks: `npx tsx --test scripts/test-photo-workspace.ts`. Type checks and production builds verify implementation; inspect actual PNG/TXT for artwork quality.


## Checkpoint verdict — 2026-11-24

The operator authorized committing this starting point, but explicitly stated
that it has not reached the supplied references' quality as a general filter.
This is a development checkpoint, not accepted AAHub-quality output.
Open-eye iris weight, consistent brows, hair grouping, connected contours and
form-following clothing tone remain below the target. The independent front
portrait and turned recording still contain unresolved eye construction.
The target is a reusable filter for different faces, expressions and views;
matching one pose, lowering numeric gates or hand-correcting these samples does
not meet it. The latest supplied portrait references set the quality target;
source photos, saved projects and private reference images are retained only in
private Shallot's checkpoint directory.
