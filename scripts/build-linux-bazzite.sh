#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "$(uname -m)" != "x86_64" ]]; then
  echo "AULA Studio's Linux release is x86_64; this machine reports $(uname -m)." >&2
  exit 1
fi

if ! command -v podman >/dev/null 2>&1; then
  echo "Podman is not available. Bazzite normally includes Podman; see https://docs.bazzite.gg/Installing_and_Managing_Software/Containers/." >&2
  exit 1
fi

mkdir -p "$PROJECT_DIR/.tools/npm" "$PROJECT_DIR/.tools/cargo" "$PROJECT_DIR/.tools/rustup" "$PROJECT_DIR/.tools/home" "$PROJECT_DIR/.tools/cache" "$PROJECT_DIR/dist"

podman run --rm --platform linux/amd64 \
  --security-opt label=disable \
  --volume "$PROJECT_DIR:/workspace" \
  --workdir /workspace \
  --env CARGO_HOME=/workspace/.tools/cargo \
  --env RUSTUP_HOME=/workspace/.tools/rustup \
  --env HOME=/workspace/.tools/home \
  --env XDG_CACHE_HOME=/workspace/.tools/cache \
  --env npm_config_cache=/workspace/.tools/npm \
  docker.io/library/node:22-bookworm \
  bash -lc '
    set -euo pipefail
    export DEBIAN_FRONTEND=noninteractive

    apt-get update
    apt-get install --yes --no-install-recommends \
      build-essential ca-certificates curl file \
      libayatana-appindicator3-dev libfuse2 libssl-dev libudev-dev \
      librsvg2-dev libwebkit2gtk-4.1-dev libxdo-dev pkg-config tar wget

    mkdir -p "$CARGO_HOME" "$RUSTUP_HOME"
    curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
    export PATH="$CARGO_HOME/bin:$PATH"

    npm ci
    npm run test:ui
    cargo test --release --locked --manifest-path src-tauri/Cargo.toml
    npm run tauri -- build --config scripts/tauri-ci.json --bundles appimage

    artifact="$(find src-tauri/target/release/bundle/appimage -maxdepth 1 -type f -name "*.AppImage" -print -quit)"
    if [[ -z "$artifact" ]]; then
      echo "Tauri completed without producing an AppImage." >&2
      exit 1
    fi

    install -m 0755 "$artifact" dist/AULA-Studio-Linux-x86_64.AppImage
    echo "Built: /workspace/dist/AULA-Studio-Linux-x86_64.AppImage"
  '
