# Implementation status

Updated 2026-11-21. Experimental mesh overlays remain disabled in the public build.

## D0 automatic deployment

- Actions enabled and a dedicated publication-repository write key configured as the source repo's `DRAWLOOM_PUBLISH_KEY` secret. The temporary local private-key file was removed after setup.
- Workflow builds and tests the static export, records its source SHA, publishes only the existing site's `drawloom/` directory, then verifies the public SHA and assets.
- Both repositories enforce main-only branches. Publication checks a temporary destination tag with the existing attribution workflow before fast-forwarding `main`. Neither policy is disabled or bypassed.
- First successful automatic deployment: source `14f08d2f8e8011e27b8fb3ee60addb3853f16a6a`, destination `8e3fba5b44b66c5392e57b5a4634401e02614bf9`. [Source workflow](https://github.com/rikiyanai/drawloom/actions/runs/44967706691), [Pages deployment](https://github.com/rikiyanai/rikiyanai.github.io/actions/runs/44967860698). The public receipt matched and eight JS/CSS assets responded successfully.
- Controlled failure: [run 44967925182](https://github.com/rikiyanai/drawloom/actions/runs/44967925182) used a deliberately failing test revision on a temporary source tag. The build failed, publication was skipped, and the public receipt remained at `14f08d2`.
- Second successful automatic update: recovery commit `8146135b80ed2acdbf74087da97c0ba9a2bb24dc`, [run 44968270562](https://github.com/rikiyanai/drawloom/actions/runs/44968270562); the public SHA and eight assets matched. Manual rollback to `14f08d2` also became public, [run 44968573184](https://github.com/rikiyanai/drawloom/actions/runs/44968573184). An isolated browser saved a synthetic study before rollback and confirmed its name and front shot survived after deployment. Latest `main` was restored by commit `60de679`, [run 44968914425](https://github.com/rikiyanai/drawloom/actions/runs/44968914425), and its public receipt was verified.
- Deployment checkouts include app/test source and root configuration without fetching the large research/render archive.
- Next.js updated to 16.4.6; the dependency audit is clean. The skull reference renders on pose/size/mesh changes rather than continuously. Local and hosted surface/study checks pass.

## M0–M4 experimental implementation

The native editor, shared geometry, persistence and export are implemented. Their scientific validation gates remain separate from functional completion. The public default still has its six audited overlays. A separately built, labelled preview is published at https://rikiworld.com/drawloom/experimental/; it updates in the same workflow and does not enable the feature on the default page.

- `register.ts` fits proper 3D similarities with robust Huber reweighting. Horn's quaternion rotation plus forward least-squares scale solves the planned proper-similarity objective without an SVD dependency. Degenerate/nonfinite inputs and reflections are tested.
- The authoritative recovered `planes-art/data3d.json` supplies 112 named vertices, 74 explicit faces and 183 edges. The latest four hand-placement files supply 364 exact pins, notes and the added chin point/edge. The later `P.py`/`I3_build.py` scripts are glyph authoring, not a newer mesh definition. `prepare-planes-reference.ts` produces versioned normalized seeds with provenance.
- MediaPipe's edge graph yields 854 three-cycle candidates. Two enclosing nose triangles surround degree-three subdivision vertices; excluding them leaves 852 oriented surface triangles. The surface drives barycentric lifting and a depth buffer. Side names describe image sides. Imported recording pixels are unmirrored; webcam capture mirrors both photo and landmark x before saving, so the UI consistently describes the stored image rather than anatomical left/right.
- `solve.ts` is the shared renderer/editor/export resolver. Accepted front x/y and every saved photo pin stay exact. Visible cross-view observations refine shared depth with robust weights and a stronger face/lid depth prior. Model disagreement is reported separately. Explicit 3D surface edits are durable shared geometry overrides; they preserve photo pins through display offsets.
- Facing, depth-buffer and sphere tests distinguish visible, grazing, occluded, back and uncertain vertices. Hidden handles are grey and cannot be dragged in the photo. The high-yaw far side stays uncertain. Eyes use 3D iris discs projected to ellipses and clipped by the eyelid aperture. These estimates still require human visibility review.
- Sphere, side-plane and neck handles preserve exact photo placements. Neck observations fit view-dependent cylinder silhouette lines, rather than incorrectly treating the sides as fixed material points. Quality labels distinguish priors, one-view estimates, weak fits and multi-view fits. Hairline and ear references require explicit placement. Canon rows are read-only and unverified conventions are labelled.
- The editor provides named/region lookup, exact dragging, pan, pointer-centred zoom (0.3–12), pinch, keyboard tools, reset, notes, undo/redo, per-view trails, add/split/connect/remove/delete and linked 3D selection. Crossing/ambiguous topology edits are rejected; unaffected explicit faces survive changes. Splits preserve interpolated pins in all views. The 3D panel has free orbit, capture snap, surface dragging, face orientation readouts/normals and an optional explicitly unregistered skull proxy.
- Version-2 backups validate and preserve pins, notes, topology, 3D edits, orphan IDs and visibility-review labels. Version-1 backups remain readable; the existing IndexedDB version is unchanged. Studies accept up to 12 arbitrary `frame-` keyframes.
- Upload mode can turn a detected portrait into a study. The study exporter uses one common reference-head scale, photo, faint edges, optional subject-masked value block-in, construction, planes and feature contours. Optional geometry metadata includes vertices, visibility, primitives, curves, irises, faces and measurements. Head-frame and packet-pixel coordinates are distinguished. PNG/packet size limits are enforced before download.
- Hatch Studio's actual importer accepted the exported packet and optional unknown geometry block, with every guide using the same scale. Its private source module was used locally and was not copied into this public repository. Geometry metadata is opt-in.

## Evidence

- `npm run test:planes`: 12 tests, including V1 on the real 478-landmark fixture, exact pins/front immobility, held-out observations, topology, version-1/2 backup and cylinder silhouette fitting.
- V1 reproduced 2.6494, 8.1172 and 11.3696 px against the historical 2.6, 8.1 and 11.4 values. `MEASUREMENTS.json` includes count/robustness/z-scale comparisons.
- `EDITOR-MEASUREMENTS.json` records per-angle/per-region single-view and leave-one-view-out predictions against manual pins. At 39° the held-out median is about 10.1 px, above the proposed 5.5 px gate. Exact display pins are not used to manufacture a passing prediction score. The front authored the seeds, so it is not independent validation. The older B0 fixture is not reliably comparable by region.
- The user's requested Shallot recording is `IMG_4288.MOV`, SHA-256 `d4312c4d6afc691c112f630854ef5db7e404a621d01607ab9150dbce0922b841`, 46.223 s / 90 sampled frames. Its recovered `face-riki-scan/receipt.json` identifies the source. Of 90 frames, 39 contain usable detections; failed IDs are recorded, not silently discarded. `RECORDING-MEASUREMENTS.json` exercises every usable frame and compares direct robust registration (median full-face residual 7.31 px), stable subset (12.06 px) and chaining (10.18 px). Direct robust 468 is retained.
- A ten-angle study adds frames 0028, 0032, 0036, 0057, 0061 and 0065 to the original four, covering opposite yaw and pitch. All ten render without browser errors. More poses from the same recording do not establish cross-subject generalization.
- `test:planes-ui` passes on synthetic imagery and the recovered real four-angle study: exact pin/reload/export, undo/redo, note/shortcut focus, topology split/delete/undo, zoom/pinch, 3D orbit/snap/surface drag, v2 backup and Hatch-compatible export. The real-image export also passed with the downloaded MediaPipe subject segmentation model enabled.
- TypeScript, build, deployment helpers, study checks and dependency audit pass. CI separately checks the flag-off public artifact and flag-on preview. Neither archive portraits nor local studies enter either build artifact.

## Remaining gates

M0 data recovery and V1 pass. M1–M4 functionality is present; their accuracy exit gates are not all passed. M5 remains closed: V2 fails the proposed 39° threshold, V3 needs completed human hidden-point labels, iris/primitive/canon accuracy needs the plan's manual comparisons, and V9 requires independent subjects. The supplied recording addresses angle coverage only. The preview is suitable for review and correction, not a claim of anatomical accuracy. No default-on change or failure-log reversal is made.

## Try and reproduce

Open the experimental URL, choose Study board and Import study, or upload a portrait and choose Edit portrait construction. Select a capture, edit visible handles, orbit the mesh, and back up before moving devices. Mark hidden vertices and complete the visibility review per capture before using those labels for V3.

```powershell
npm ci
$env:NEXT_PUBLIC_DRAWLOOM_PLANES='1'
$env:DRAWLOOM_BASE_PATH='/drawloom/experimental'
npm run build
npm run serve:static
# In a second terminal:
npm run test:planes-ui -- http://127.0.0.1:3000/drawloom/experimental/
```

`npm run build:study` reconstructs the original four-angle backup from the recovered source snapshot. Use `--ids 0001,0004,0007,0010,0028,0032,0036,0057,0061,0065 --out ../planes-recording-study.json` for the ten-angle study; those additional captures require their versioned `packet.json` blobs if a sparse checkout omitted them. The cap is 12 and the backup limit is 40 MB. `npm run validate:planes -- ../planes-study.json` reports held-out placement scores. `npx tsx scripts/validate-planes-recording.ts` reproduces recording comparisons. `measure:planes` reproduces V1. The recovered source is an ongoing-session snapshot at commit `8146135`; subsequent authoring changes are not assumed to be included.
