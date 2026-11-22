 planes-feature: 3D plane head (Asaro manner) + fitted Loomis sphere/neck, planned not built.
 research in RESEARCH.md (part 2 adds Loomis, Krita plugin, Loomism, canons, neck); plan in PLAN.md.
 fix for the failed 2D warp: lift corrected front vertices to 3D, rigid per-frame landmark fit, depth-buffer occlusion, 3D iris discs.
 user corrections on any angle are 2D observations that triangulate vertices; canon layer measures only; ships behind a build flag (FL-015).
 validation planned against the user's 4 angles by leave-one-view-out reprojection vs the 2D-warp baseline; no registration claims.
 priority 1: automatic public deployment on every passing commit pushed to main, following Shallot's Actions trigger; publish to rikiyanai.github.io/drawloom/ (D0 in PLAN.md).
 review in REVIEW.md: reconcile exact pins with the solver, persist topology and 3D edits, define face regeneration and interaction checks.
 M0 still needs the final working scripts, 3D head build and topology recovered from the originating machine; private face fixtures stay outside the public repo.
DONE
