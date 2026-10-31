import { spawnSync } from 'node:child_process';
const checks = [['Node.js', process.execPath, ['--version']], ['Rust', 'rustc', ['--version']], ['Cargo', 'cargo', ['--version']]];
let ok = true;
for (const [name, cmd, args] of checks) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  const passed = r.status === 0;
  console.log(`${passed ? 'OK' : 'MISSING'} ${name}: ${passed ? r.stdout.trim() : 'install and reopen your terminal'}`);
  ok &&= passed;
}
console.log('\nNative prerequisites:');
console.log(process.platform === 'win32' ? 'Microsoft C++ Build Tools (Desktop C++) and WebView2 runtime.' : process.platform === 'darwin' ? 'Xcode command line tools: xcode-select --install' : 'See Tauri prerequisites for your platform.');
console.log('Setup guide: https://v2.tauri.app/start/prerequisites/');
process.exitCode = ok ? 0 : 1;
