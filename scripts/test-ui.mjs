import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { JSDOM, VirtualConsole } from 'jsdom';

const asset = (await readdir(new URL('../web-dist/assets/', import.meta.url))).find(n => n.endsWith('.js'));
assert.ok(asset, 'Build the frontend before running its UI test');
const code = await readFile(new URL(`../web-dist/assets/${asset}`, import.meta.url), 'utf8');
const layout = JSON.parse(await readFile(new URL('../src/key-layout.json', import.meta.url), 'utf8'));
const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', error => errors.push(error.message));
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://tauri.localhost/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole,
});
const { window } = dom;
const calls = [];
let connected = true;
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.isTauri = true;
window.__TAURI_INTERNALS__ = {
  invoke: async (command, args) => {
    calls.push({ command, args });
    if (command === 'scan_receivers') return connected ? [{ id: 'test-receiver', name: 'F75 Max', interface: 3, usage: 97 }] : [];
    if (command === 'read_battery') return 84;
    return null;
  },
};
window.localStorage.setItem('aula.perkey.v1', JSON.stringify(Object.fromEntries(layout.map(k => [k.index, '000000']))));
const wait = () => new Promise(resolve => setTimeout(resolve, 40));
const button = label => {
  const found = [...window.document.querySelectorAll('button')].find(b => b.textContent.trim() === label || b.getAttribute('aria-label') === label);
  assert.ok(found, `Button exists: ${label}`);
  return found;
};
try {
  window.eval(code);
  await new Promise(resolve => setTimeout(resolve, 350));
  assert.deepEqual(errors, [], 'App mounts without runtime errors');
  assert.match(window.document.querySelector('.connection-pill').textContent, /Receiver connected/);
  assert.equal(window.document.querySelector('.battery-heading b').textContent, '84%');
  assert.ok(window.document.querySelector('.device-strip').compareDocumentPosition(window.document.querySelector('.lighting-tabs')) & window.Node.DOCUMENT_POSITION_FOLLOWING, 'Connection panel precedes the editor');

  button('Per-key colors').click(); await wait();
  assert.equal(button('Per-key colors').getAttribute('aria-pressed'), 'true');
  button('WASD').click(); await wait();
  assert.equal(window.document.querySelectorAll('.key-selected').length, 4);
  window.document.querySelectorAll('.swatches button')[2].click(); await wait();
  assert.equal(window.document.querySelector('[data-key-index="39"]').getAttribute('aria-label'), 'W, color A8C692');
  button('Apply lighting').click(); await wait();
  const upload = calls.find(c => c.command === 'apply_per_key');
  assert.ok(upload, 'Apply sends a custom layout, not a global RGB effect');
  assert.equal(upload.args.colors.length, 80);
  const green = Array.from(upload.args.colors.filter(k => k.color === 'A8C692'), k => k.index).sort((a,b) => a-b);
  assert.deepEqual(green, [39,56,57,58], 'Exactly WASD receives the picked color');
  assert.ok(upload.args.colors.filter(k => !green.includes(k.index)).every(k => k.color === '000000'));
  assert.equal(JSON.parse(window.localStorage.getItem('aula.settings.v2')).mode, 1, 'Per-key editing preserves valid global settings');

  button('Save color').click(); await wait();
  button('Save color A8C692 to preset 1').click(); await wait();
  assert.equal(JSON.parse(window.localStorage.getItem('aula.palette.v1'))[0], 'A8C692');
  assert.equal(window.document.querySelector('.swatches button').getAttribute('aria-label'), 'Preset 1, color A8C692');

  connected = false;
  button('Scan receivers').click(); await wait();
  assert.match(window.document.querySelector('.connection-pill').textContent, /Receiver disconnected/);
  assert.ok(!window.document.querySelector('.connection-pill').classList.contains('connected'));
  assert.equal(button('Apply lighting').disabled, true);
  assert.deepEqual(errors, []);
  console.log('UI checks passed: mount, battery, top panel, per-key selection/apply, palette persistence, and disconnect status.');
} finally { window.close(); }
