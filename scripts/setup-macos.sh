#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if ! xcode-select -p >/dev/null 2>&1; then
  echo 'Install Xcode command line tools: xcode-select --install'; exit 1
fi
if ! command -v node >/dev/null || ! command -v cargo >/dev/null; then
  echo 'Install Node.js LTS from https://nodejs.org and Rust from https://rustup.rs, then rerun.'; exit 1
fi
node scripts/doctor.mjs
node scripts/npm.mjs ci
