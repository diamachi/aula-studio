// Usage: node scripts/set-version.mjs 1.1.1
// Update app metadata only; dependency versions and URLs must remain untouched.
import { readFile, writeFile } from 'node:fs/promises';
const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version || '')) throw new Error('Provide a semantic version, e.g. 1.1.1');
const root = new URL('../', import.meta.url);
for (const file of ['package.json', 'package-lock.json', 'src-tauri/tauri.conf.json']) {
  const path = new URL(file, root), data = JSON.parse(await readFile(path, 'utf8'));
  data.version = version;
  if (file === 'package-lock.json') data.packages[''].version = version;
  await writeFile(path, JSON.stringify(data, null, 2) + '\n');
}
for (const [file, pattern] of [
  ['src-tauri/Cargo.toml', /(\[package\]\r?\nname = "aula-studio"\r?\nversion = ")[^"]+(")/],
  ['src-tauri/Cargo.lock', /(\[\[package\]\]\r?\nname = "aula-studio"\r?\nversion = ")[^"]+(")/],
  ['src/main.tsx', /(<span>v)\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(<\/span>)/],
]) {
  const path = new URL(file, root), original = await readFile(path, 'utf8');
  if (!pattern.test(original)) throw new Error(`App version not found in ${file}`);
  await writeFile(path, original.replace(pattern, (_, before, after) => before + version + after));
}
console.log(`App version set to ${version}; dependency metadata preserved.`);
