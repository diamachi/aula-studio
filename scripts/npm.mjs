// Prefer the user's npm; fall back to the workspace bootstrap on this machine.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const local = fileURLToPath(new URL('../.tools/package/bin/npm-cli.js', import.meta.url));
const args = process.argv.slice(2);
const result = existsSync(local)
  ? spawnSync(process.execPath, [local, ...args], { stdio: 'inherit' })
  : spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { stdio: 'inherit', shell: process.platform === 'win32' });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
