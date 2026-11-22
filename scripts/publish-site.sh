#!/usr/bin/env bash
set -euo pipefail

[[ "$SOURCE_SHA" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid source SHA'; exit 1; }
node -e 'const fs=require("fs");const r=JSON.parse(fs.readFileSync("publish-artifact/build-info.json"));if(r.sha!==process.env.SOURCE_SHA)throw Error("Artifact SHA mismatch");if(!fs.existsSync("publish-artifact/index.html"))throw Error("Missing app");'

# Main may have advanced while the build ran. Never let an older automatic run
# replace a newer source. Manual dispatch intentionally permits rollback.
if [[ "$EVENT_NAME" == push ]]; then
  latest=$(gh api repos/rikiyanai/drawloom/git/ref/heads/main --jq .object.sha)
  if [[ "$latest" != "$SOURCE_SHA" ]]; then
    echo 'Source main advanced; this build is superseded.'
    exit 1
  fi
fi

git -C publication-site config user.name 'RIKI YANAI HERNANDEZ'
git -C publication-site config user.email '33168192+rikiyanai@users.noreply.github.com'
for attempt in 1 2 3 4 5; do
  git -C publication-site fetch origin main
  # Only this disposable Actions checkout is reset; no user checkout is used.
  git -C publication-site reset --hard origin/main
  rsync -a --delete publish-artifact/ publication-site/drawloom/
  git -C publication-site add -- drawloom
  if git -C publication-site diff --cached --quiet; then
    echo 'Destination already contains this artifact.'
    exit 0
  fi
  git -C publication-site commit -m "deploy: Drawloom ${SOURCE_SHA}"
  if git -C publication-site push origin HEAD:main; then exit 0; fi
  echo "Destination advanced; retrying publication ($attempt/5)."
done
echo 'Could not publish without overwriting concurrent destination edits.' >&2
exit 1
