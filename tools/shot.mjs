// Captures de pantalla automàtiques per revisar l'escena: node tools/shot.mjs
import puppeteer from 'puppeteer-core';
import fs from 'fs';

const URL = process.env.URL || 'http://localhost:5173/';
const OUT = new globalThis.URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
fs.mkdirSync(OUT, { recursive: true });
const W = +(process.env.W || 1280), H = +(process.env.H || 720);

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1, isMobile: !!process.env.MOBILE, hasTouch: !!process.env.MOBILE },
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 120000 });
await page.waitForFunction(() => document.querySelector('#loader').classList.contains('gone'), { timeout: 120000 }).catch(() => logs.push('TIMEOUT waiting load'));
const snap = async (name) => { await page.screenshot({ path: OUT + name + '.png' }); console.log('shot', name); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (process.env.LOGS) console.log(logs.join('\n'));
const steps = (process.env.STEPS || 'intro').split(',');
for (const s of steps) {
  const i = s.indexOf(':'); const cmd = i < 0 ? s : s.slice(0, i); const arg = i < 0 ? '' : s.slice(i + 1);
  if (cmd === 'intro') await snap('00-intro');
  else if (cmd === 'enter') { await sleep(1600); }
  else if (cmd === 'go') { await page.evaluate((u) => window.__pf.go(+u), arg); await sleep(1500); }
  else if (cmd === 'snap') await snap(arg);
  else if (cmd === 'wait') await sleep(+arg);
  else if (cmd === 'click') { await page.mouse.click(W / 2, H / 2); }
  else if (cmd === 'clickat') { const [x, y] = arg.split('x').map(Number); await page.mouse.move(x, y); await sleep(150); await page.mouse.click(x, y); }
  else if (cmd === 'hover') { const [x, y] = arg.split('x').map(Number); await page.mouse.move(x, y); await sleep(200); }
  else if (cmd === 'wheelup') { for (let i = 0; i < +arg; i++) { await page.mouse.wheel({ deltaY: -100 }); await sleep(60); } }
  else if (cmd === 'wheel') { for (let i = 0; i < +arg; i++) { await page.mouse.wheel({ deltaY: 100 }); await sleep(60); } }
  else if (cmd === 'jscroll') { await page.evaluate((y) => document.querySelector('.jr-scroll').scrollTo(0, +y), arg); await sleep(400); }
  else if (cmd === 'clicksel') { await page.evaluate((q) => document.querySelector(q.replace(/~/g, ' ')).click(), arg); await sleep(500); }
  else if (cmd === 'clickn') { const [q, n] = arg.split('|'); await page.evaluate((q, n) => document.querySelectorAll(q)[+n].click(), q, n); await sleep(500); }
  else if (cmd === 'key') { await page.keyboard.press(arg); await sleep(600); }
  else if (cmd === 'raise') await page.evaluate(() => window.__pf.raise());
  else if (cmd === 'shoot') await page.evaluate(() => window.__pf.shoot());
  else if (cmd === 'complete') await page.evaluate((i) => window.__pf.complete(+i), arg);
  else if (cmd === 'eval') console.log(await page.evaluate(arg));
  else if (cmd === 'evalfile') console.log(await page.evaluate(fs.readFileSync(arg, 'utf8')));
  else if (cmd === 'info') console.log(JSON.stringify(await page.evaluate(() => ({ ...window.__pf.info(), mode: window.__pf.state.mode, gl: (() => { const c = document.createElement('canvas').getContext('webgl2'); const e = c.getExtension('WEBGL_debug_renderer_info'); return c.getParameter(e.UNMASKED_RENDERER_WEBGL); })() }))));
}
console.log(logs.join('\n'));
await browser.close();
