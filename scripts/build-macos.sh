#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
node scripts/npm.mjs ci
node scripts/npm.mjs run tauri -- build --bundles app,dmg
