#!/bin/sh
set -eu
PROJECT_ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$PROJECT_ROOT"
if [ -x "$PROJECT_ROOT/.tools/cargo/bin/cargo" ]; then
  export CARGO_HOME="$PROJECT_ROOT/.tools/cargo"
  export RUSTUP_HOME="$PROJECT_ROOT/.tools/rustup"
  export PATH="$CARGO_HOME/bin:$PATH"
fi
if [ -x "$PROJECT_ROOT/.tools/node/bin/node" ]; then
  export PATH="$PROJECT_ROOT/.tools/node/bin:$PATH"
fi
node scripts/npm.mjs ci
node scripts/npm.mjs run tauri -- build --bundles app,dmg
