# Implementation status

Updated 2026-11-21. Experimental mesh overlays remain disabled in the public build.

## D0 automatic deployment

- Actions enabled and a dedicated publication-repository write key configured as the source repo's `DRAWLOOM_PUBLISH_KEY` secret. The temporary local private-key file was removed after setup.
- Workflow builds and tests the static export, records its source SHA, publishes only the existing site's `drawloom/` directory, then verifies the public SHA and assets.
- Both repositories enforce main-only branches. Publication checks a temporary destination tag with the existing attribution workflow before fast-forwarding `main`. Neither policy is disabled or bypassed.
- First successful automatic deployment: source `14f08d2f8e8011e27b8fb3ee60addb3853f16a6a`, destination `8e3fba5b44b66c5392e57b5a4634401e02614bf9`. [Source workflow](https://github.com/rikiyanai/drawloom/actions/runs/44967706691), [Pages deployment](https://github.com/rikiyanai/rikiyanai.github.io/actions/runs/44967860698). The public receipt matched and eight JS/CSS assets responded successfully.
- Controlled failure: [run 44967925182](https://github.com/rikiyanai/drawloom/actions/runs/44967925182) used a deliberately failing test revision on a temporary source tag. The build failed, publication was skipped, and the public receipt remained at `14f08d2`.
- Second successful automatic update: recovery commit `8146135b80ed2acdbf74087da97c0ba9a2bb24dc`, [run 44968270562](https://github.com/rikiyanai/drawloom/actions/runs/44968270562); the public SHA and eight assets matched. Manual rollback to `14f08d2` also became public, [run 44968573184](https://github.com/rikiyanai/drawloom/actions/runs/44968573184). An isolated browser saved a synthetic study before rollback and confirmed its name and front shot survived after deployment. Restoration to latest `main` follows with the next push.
- Deployment checkouts include app/test source and root configuration without fetching the large research/render archive.
- Next.js updated to 16.4.6; the dependency audit is clean. The skull reference renders on pose/size/mesh changes rather than continuously. Local and hosted surface/study checks pass.

## M0 data and geometry

Implemented independently of subject data:

- `src/lib/planes/register.ts`: normalized head frame, proper 3D similarity registration with robust Huber reweighting, per-point residuals and fit summaries. The quaternion rotation solve is Horn's closed-form method with forward least-squares scale, an equivalent proper-similarity objective to the planned Umeyama SVD solve. It rejects degenerate input and never reflects a subject.
- `src/lib/planes/topology.ts`: typed vertex/face/edge data and validation of IDs, references, mirror pairs, regions, seeds and duplicates. Stable IDs are lowercase, up to 64 characters, allowing dots and hyphens; display names remain separate. No replacement for the recovered final topology is fabricated.
- `src/lib/planes/mesh.ts`: deterministic three-cycle candidates independent of tessellation edge order/direction. The installed MediaPipe version produces 854 candidates. They are not yet admitted as a validated surface or used for occlusion.
- `npm run test:planes`: synthetic recovery at the validation yaws, general 3D rotation, no reflections, outlier resistance, degenerate/weighted inputs, head-frame normalization, candidate invariance and topology validation. These checks run in deployment CI too.

Recovery commit `8146135` is integrated. Its `work/README.md` indexes the head/capture, hand pins, topology, scripts and authoring sources. It identifies this as a snapshot of an ongoing session, without a uniquely designated final script; the latest named scripts are `P.py`, `P_v10.py` and `I3_build.py`. The local checkout omits bulk renders and embedded-image `packet.json` blobs; measured `pose.json` files, code and topology remain available, and individual reference images can be fetched as needed.

Still required for M0's exit gate: review/port the recovered topology, establish actual surface faces and winding, verify image-side/mirroring conventions, and reproduce the measured V1 residuals on the real fixture. Synthetic checks do not establish V1 or mesh-placement accuracy. M1–M5 have not passed their gates.
