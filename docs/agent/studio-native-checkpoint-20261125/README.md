# Native Studio engine checkpoint

Drawloom supplies photo person selection, estimated head geometry, plane guides and editable text construction to Shallot's existing Hatch Studio. Studio owns the canvas, frames, history, source guides, corrections and saved projects. Rebuild the browser module with `node scripts/build-studio-engine.mjs <Shallot tools/hatch-studio/drawloom-engine>`.

The general portrait filter remains below the operator's AAHub reference quality. Eyes, hair grouping, expression and contour continuity remain open. Geometry and passing checks do not establish drawing quality or arbitrary-face coverage.

The accompanying `unmerged-photo-workspace.patch` preserves an earlier standalone workspace experiment for history. It is not applied by this checkpoint and is not the requested authoring surface. Continue authoring through native Studio controls.

The native Studio integration and exact exported projects are in Shallot under `docs/agent/studio-native-checkpoint-20261125/`. The left figure has manual Studio corrections; the center and right figures remain unfinished. Do not present those manual corrections as automatic filter output or accepted finished artwork.

Checkpoint policy: commit and push each retained work checkpoint, per the operator's instruction. Both repositories enforce main-only pushes. Preserve upstream commits and combine checkpoints with the current origin/main before a normal fast-forward push; never force-push or overwrite concurrent working trees.
