// Isolated documentation previews. No Tauri process or hardware access.
// Optional tooling: npm install --prefix .tools/screenshots --no-package-lock playwright-core
// Build first; set BROWSER_PATH if Edge is not installed at the Windows default path.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../.tools/screenshots/package.json', import.meta.url));
const { chromium } = require('playwright-core');
const output = resolve(root, 'docs/screenshots');
const web = resolve(root, 'web-dist');
const layout = JSON.parse(await readFile(resolve(root, 'src/key-layout.json'), 'utf8'));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' };
const server = createServer(async (req, res) => {
  try {
    const path = resolve(web, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
    if (!path.startsWith(web + sep)) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream');
    res.end(await readFile(path));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  await mkdir(output, { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1, colorScheme: 'dark', reducedMotion: 'reduce' });
  await context.addInitScript(({ layout }) => {
    localStorage.setItem('aula.theme', 'dark');
    localStorage.setItem('aula.ui-size', 'auto');
    localStorage.setItem('aula.settings.v2', JSON.stringify({ mode: 1, color: 'C8B2E7', brightness: 4, speed: 3, colorful: false, direction: 0 }));
    const colors = ['C8B2E7', 'D99CB9', 'F2B64D', 'A8C692', '76BFC0', '9CA8ED'];
    localStorage.setItem('aula.perkey.v1', JSON.stringify(Object.fromEntries(layout.map(k => [k.index, [39, 56, 57, 58].includes(k.index) ? 'F2B64D' : colors[k.row % colors.length]]))));
    window.isTauri = true;
    window.__TAURI_INTERNALS__ = {
      invoke: async (command, args) => {
        if (command === 'scan_receivers') return [{ id: 'documentation-preview', name: 'F75 Max', interface: 3, usage: 97 }];
        if (command === 'read_battery') return 84;
        if (command === 'scan_display') return { connected: true, displayAvailable: true, message: 'Wired display ready' };
        if (command === 'prepare_display') {
          const bitmap = await createImageBitmap(new Blob([new Uint8Array(args.bytes)], { type: 'image/png' }));
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
          const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0, 128, 128); bitmap.close();
          return { id: 'preview', frames: 1, chunks: 9, durationMs: 100, pixels: Array.from(ctx.getImageData(0, 0, 128, 128).data) };
        }
        throw new Error('Hardware commands are disabled in documentation previews.');
      },
    };
  }, { layout });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByText('84%', { exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: '*{animation:none!important;transition:none!important;caret-color:transparent!important}' });
  // Make time-dependent text deterministic without modifying the application source.
  await page.locator('.battery-block small').evaluate(el => { el.textContent = 'Updated just now'; });
  await page.setViewportSize({ width: 1600, height: 1500 });
  await page.setViewportSize({ width: 1600, height: await page.evaluate(() => document.documentElement.scrollHeight + 32) });
  await page.screenshot({ path: resolve(output, 'lighting-dark.png'), fullPage: true });
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await page.getByRole('button', { name: 'Per-key colors', exact: true }).click();
  await page.getByRole('button', { name: 'WASD', exact: true }).click();
  await page.setViewportSize({ width: 1600, height: 1350 });
  await page.setViewportSize({ width: 1600, height: await page.evaluate(() => document.documentElement.scrollHeight + 32) });
  await page.screenshot({ path: resolve(output, 'per-key-light.png'), fullPage: true });
  await page.locator('.sleep-panel').screenshot({ path: resolve(output, 'sleep-timer-light.png') });
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.getByRole('button', { name: 'Mini display', exact: true }).click();
  await page.setViewportSize({ width: 1600, height: 1100 });
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#28283e'; x.fillRect(0, 0, 128, 128);
    x.fillStyle = '#eed0b6'; x.beginPath(); x.arc(91, 34, 14, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#9ca8ed'; x.beginPath(); x.moveTo(0, 90); x.lineTo(43, 36); x.lineTo(92, 98); x.lineTo(128, 60); x.lineTo(128, 128); x.lineTo(0, 128); x.fill();
    x.fillStyle = '#c8b2e7'; x.beginPath(); x.moveTo(0, 106); x.lineTo(37, 78); x.lineTo(69, 107); x.lineTo(108, 68); x.lineTo(128, 92); x.lineTo(128, 128); x.lineTo(0, 128); x.fill();
    x.fillStyle = '#76bfc0'; x.fillRect(0, 115, 128, 13);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('Choose display image').setInputFiles({ name: 'pastel-mountains.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.getByText('Still image · 9 transfer blocks', { exact: true }).waitFor();
  await page.screenshot({ path: resolve(output, 'mini-display-dark.png'), fullPage: true });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Saved four isolated UI screenshots to docs/screenshots. Hardware access was disabled.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
