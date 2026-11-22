# Public deployment

The `Drawloom public deployment` workflow builds and tests every push to `main`, then publishes the checked `out/` artifact to `rikiyanai/rikiyanai.github.io:main:drawloom/`. GitHub Pages serves it at https://rikiworld.com/drawloom/. Pull requests run the checks without publishing.

The destination uses its existing branch-based Pages build. Its CNAME, `.nojekyll` and sibling directories are preserved. Only `drawloom/` is replaced. A dedicated write deploy key belongs to that destination repository; its private half is the source repository's `DRAWLOOM_PUBLISH_KEY` Actions secret. No personal access token is copied into the workflow. The source repository's default workflow token remains read-only.

Publication is serialized. An older automatic build cannot publish after source `main` advances. Destination pushes retry from its newest `main` if unrelated site edits happen concurrently. Failed builds and regression checks never reach publication. The workflow stays open until the expected source SHA is visible in `/drawloom/build-info.json` and the app's JavaScript and CSS assets respond successfully.

The destination requires its “AI attribution policy” check before `main` accepts a commit and forbids other branches. Its policy workflow checks tag pushes too. Publication pushes a temporary `drawloom-publication/…` candidate tag, waits for that exact commit's check to pass, then fast-forwards `main` to it and deletes the tag. It does not create another branch, bypass checks or disable protection. A failed destination check leaves the current public site intact.

## Checks

Run `npm ci`, `npm run test:deploy`, `npm run build`, and `npx tsc --noEmit`. Start the exported site with `npm run serve:static`, then run `npm run test:surface` and `npm run test:study` against `http://localhost:3000/drawloom/`.

The workflow runs the public build with experimental planes disabled. It does not include portrait captures, private validation fixtures, notes or local IndexedDB studies in the artifact. Publishing at the same origin preserves device studies.

## Rollback

Use Actions → Drawloom public deployment → Run workflow on `main`. Set `ref` to a source SHA from a previous successful deployment. The workflow rebuilds and checks that revision, publishes it through the same path, and verifies the public receipt. Use a known-good revision that contains the deployment scripts. Source history is not rewritten. To restore the latest version, dispatch with `ref: main` or push the next commit to `main`.

The public receipt records the application source SHA and build time. The workflow summary links the public endpoint. Check the deployment logs if the destination commit succeeds but the Pages build or cached public endpoint does not update; that condition fails verification rather than claiming success.
