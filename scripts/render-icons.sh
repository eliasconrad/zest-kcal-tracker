#!/usr/bin/env bash
# Draws each mascot through ?icon=<id> on a booted iPhone 17 Pro simulator (1206 px wide)
# and crops the middle into a 1024 px app icon. Needs Maestro, because the simulator
# asks before it opens a link.
set -euo pipefail
: "${SIMULATOR_UDID:?Set SIMULATOR_UDID}"
cd "$(dirname "$0")/.."
mkdir -p assets/images/icons
rm -rf .qa/icons
FF=$(command -v ffmpeg || echo /opt/homebrew/bin/ffmpeg)
maestro --device "$SIMULATOR_UDID" test --test-output-dir .qa/icons scripts/render-icons.yaml
for id in pebble fig mochi bao olive pip; do
  "$FF" -loglevel error -y -i "$(find .qa/icons -path "*/takeScreenshot/$id.png")" -vf "crop=1024:1024:(iw-1024)/2:(ih-1024)/2" "assets/images/icons/$id.png"
done
