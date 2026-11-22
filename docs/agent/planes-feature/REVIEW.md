# Wire mesh UX plan review

Reviewed 2026-11-21 against `be56382` (editor UX), including `8a6a15c` (planes plan), the current application and Shallot's Pages workflow. This is a plan review; the mesh editor and automatic deployment are not implemented by this update.

## Priority order

1. D0: automatic deployment to the existing public endpoint on every passing commit pushed to `main`, with a source-SHA receipt, failure protection and rollback. See the first section of `PLAN.md`.
2. M0: recover the final working scripts, 3D head build and topology; preserve private capture fixtures outside the public repository; reproduce the geometry baseline.
3. Resolve the editor contracts below, then proceed through M1–M5. Keep the experimental feature off in the production build until the validation gate passes.

## Requirements already covered well

The plan addresses the failed flat warp with shared 3D geometry, facing/depth visibility, iris ellipses clipped by lids, named regions, exact photo-view pins, visible-only handles, prominent zoom controls, topology tools and linked photo/3D selection. Its separate skull reference and measured validation gates are appropriate constraints. These remain requirements.

## Resolve before M2 implementation

| Gap | Required plan resolution and acceptance evidence |
|---|---|
| Exact pins contradict the older solver description | Section 3.8 says a turned-view edit moves the front, while 4.1 explicitly forbids that. Section 4.1 takes precedence: accepted front placements and saved per-shot pins remain exact; the shared 3D solve predicts unpinned views. Specify how the front x/y constraint enters the solve and how residual per-view offsets affect edges, faces, export and visibility. Test front immobility, saved pins within 0.2 image px after reload/zoom/export, and conflicting observations without silently moving either pin. Report the shared-model reprojection error separately from the pin-corrected drawing so exact display pins cannot make V2 pass artificially. |
| Topology edits have no durable schema | Section 4.1 introduces `added`, `addE`, `delE`, `delV`, but `HeadPlanesState` and the backup rules in 5.1–5.2 have no fields for them. Define stable new vertex/edge IDs, labels, regions, seed/depth data, reference-view placement and deletion behavior; validate and preserve them in save, reload, backup/import and export. Splitting a pinned edge must preserve its existing appearance in every pinned view. Deleting a vertex must handle incident edges, faces, pins and notes atomically, with undo. |
| Face regeneration is underspecified | A planar reference-view graph cannot by itself settle 3D overlap, crossings, holes, open chains, winding or face IDs. Define when a crossing creates a vertex, which loops become faces, and how IDs survive splits/merges. Reject ambiguous or degenerate edits with a visible explanation. Test closed loops, crossing edges, disconnected regions, reversed winding and delete/undo, including turned views. Retain the validated explicit base faces until the edit result is valid. |
| 3D dragging has no persistence contract | Section 4.1 allows surface drags in 3D, but the state stores only photo-view observations. Define the drag surface, the value saved, and how it survives a solve and backup/import. Decide how a drag interacts with exact photo pins; it must not silently move or discard them. Keep free orbit separate from capture-pose snap: selecting a shot snaps explicitly, while orbiting only changes the reading view. Verify selection and hidden-face tint in both views. |
| Mesh-on-skull presentation can imply registration | The proposed scaled skull proxy in 4.1 needs an explicit visual distinction and a persistent explanation that it is a construction reference, not the subject's anatomy. A proxy must not be presented as fitted anatomical evidence or change the existing public split-skull default. |
| Interaction acceptance is thinner than the math gate | Add checks for pointer-centered zoom and pan at 0.3x/12x, handle hit targets across zoom/DPR, touch cancellation, dragging outside the canvas, empty-paper pan versus Add/Connect modes, keyboard focus and shortcuts while typing notes. A cancelled drag writes nothing; a completed drag is one undo step and one persistence commit. Verify region/name lookup and hidden-point explanations on the four-angle fixture. |

## Portability and deployment findings

- The repository contains only the early `reference-planes0001.py`, not the final scripts, 3D head build or final topology. This Windows clone cannot recover files that exist only in the other machine's temporary folder. M0 remains blocked on recovery of those sources and the external validation fixture.
- `BRIEF.md` contains four historical `/private/tmp/` references. They are not usable links on this machine. They do not establish a durable source location; recover the assets and replace the references with versioned code paths or private-fixture instructions as appropriate.
- The current configuration exports static files with base path `/drawloom`. Hosting is verified: `rikiyanai/rikiyanai.github.io` owns the `rikiworld.com` CNAME, publishes `main:/` through legacy Pages, and holds the exported `drawloom/` directory. Drawloom has no committed workflow or independent Pages site. D0 should follow Shallot's Actions-on-main behavior while handing the checked export to that existing directory; cross-repo access and successful parent-site publication still need implementation.
- `npm ci` succeeds with the committed lockfile. The 2026-11-21 `npm audit` reports six affected packages (one moderate, four high, one critical), with the critical package being the pinned Next.js version. Review the applicable advisories and plan a compatible patched dependency update before D0 is considered production-ready; re-run the build and regression checks after changes. Static export does not run a Next.js production server, so the audit count alone does not demonstrate exposure of the current public site.
- The public repository must not receive private portrait captures merely to unblock validation. Code, reusable topology and synthetic test cases can be versioned separately from subject data.

## Implementation gate

Resolve the contracts above in the plan before building M2. Extend V7 to round-trip topology, labels, notes, pins and 3D edits together; extend V8 with interaction checks. D0's deployed-SHA checks are separate from the geometry gate. A successful local build proves installation, not public deployment or mesh accuracy.

## Local installation checks

Windows clone at `be56382`; Node 26.13.1, npm 11.20.0. Application source and the lockfile are unchanged by this review.

| Check | Result |
|---|---|
| `npm ci` | Passed; audit findings recorded above. |
| `npm run build` | Passed; static export generated. |
| `npx tsc --noEmit` | Passed. |
| `git diff --check` | Passed. |
| `npm run test:surface -- http://127.0.0.1:3000/drawloom/` | Failed: initial navigation timed out; sequential retry loaded the page but timed out performing the webcam-button click. |
| `npm run test:study -- http://127.0.0.1:3000/drawloom/` | Failed: initial navigation timed out; sequential retry advanced into the study workflow, then timed out clicking Study board after reload. |

The browser checks used installed Playwright Chromium against the unchanged production export served locally at the configured base path. A separate navigation diagnostic reached the page and network idle. The interaction timeouts remain unresolved; they are not a successful regression run and their cause has not been established. D0 must obtain passing browser checks before unattended publication is accepted.
