# Build and release

The [Desktop builds workflow](../.github/workflows/desktop.yml) builds Windows x64 and Apple Silicon macOS. Intel Mac builds are excluded. Packages are unsigned; macOS notarization is not configured.

## Build artifacts without publishing

Open **Actions → Desktop builds → Run workflow** and choose the source ref. Both platforms run the UI and Rust checks before building. Download the artifacts from the completed run. Manual dispatch does not publish a release when run against a branch.

## Publish a version

1. Update the matching version in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json` and the sidebar in `src/main.tsx`.
2. Run the checks in the [development guide](DEVELOPMENT.md) and verify the intended behavior on hardware. Record platform-specific testing limits.
3. Commit the release source, then push a matching tag, for example:

```sh
git tag v1.0.0
git push origin main
git push origin v1.0.0
```

Use a new version for each release; do not move an existing published tag. Tags containing a hyphen are marked as prereleases. Tags without one are published as stable/latest releases.

The release job waits for both native builds, then uploads:

- Windows NSIS setup executable.
- `AULA-Studio-Windows-x64.exe` portable executable.
- Apple Silicon `aarch64.dmg`.
- `AULA-Studio-source.zip` with portable source and build instructions.

GitHub also provides its standard tagged-source archives. The workflow currently uses `--clobber` when uploading assets, so rerunning a tagged release job can replace matching assets. Existing releases are not recreated if already present. Review the release text and downloads after completion; update the notes if the generic workflow description does not cover a version’s changes.

CI success is not a hardware test. State which keyboard/firmware and platforms were tested, and retain the wired-only display upload limitation unless a wireless transport is independently verified.
