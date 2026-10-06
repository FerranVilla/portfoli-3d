// ─────────────────────────────────────────────────────────────────────────────
//  Importa projectes d'itch.io:  npm run itch          (o: npm run itch -- --force)
//
//  Per a cada projecte de src/content.js que tingui `itch: 'https://usuari.itch.io/joc'`:
//   · baixa la portada, les captures i la miniatura del tràiler a public/projects/<id>/itch/
//   · detecta el tràiler de YouTube i si el joc es pot jugar al navegador (build web)
//   · ho desa tot a src/itch-data.json, que el quadern fa servir automàticament
//  El que escriguis tu a content.js (cover, gallery, trailer…) sempre té prioritat.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createHash } from 'crypto';

const hash = (file) => createHash('sha1').update(fs.readFileSync(file)).digest('hex');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FORCE = process.argv.includes('--force');
const MAX_SHOTS = 8;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const { projects } = await import(pathToFileURL(path.join(ROOT, 'src/content.js')).href);
const dataFile = path.join(ROOT, 'src/itch-data.json');
const previous = fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile, 'utf8')) : {};
const out = {};

const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

async function get(url, binary = false) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return binary ? Buffer.from(await res.arrayBuffer()) : res.text();
}

async function download(url, dir, name) {
  const ext = (url.split('?')[0].match(/\.(png|jpe?g|gif|webp)$/i)?.[1] || 'jpg').toLowerCase();
  const file = `${name}.${ext}`;
  const abs = path.join(dir, file);
  if (FORCE || !fs.existsSync(abs)) fs.writeFileSync(abs, await get(url, true));
  return file;
}

function parse(html) {
  if (/Just a moment|challenge-platform/i.test(html) && !/game_title/.test(html)) throw new Error('itch.io ha demanat una verificació anti-robots; torna-ho a provar en uns minuts');
  const title = decode(html.match(/<h1[^>]*class="game_title"[^>]*>([^<]+)</)?.[1] || html.match(/<title>([^<]+?)(?: by [^<]+)?<\/title>/)?.[1] || '').trim();
  const cover = html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)?.[1]
    || html.match(/property="og:image"[^>]+content="([^"]+)"/)?.[1] || '';
  const list = html.match(/class="screenshot_list"[\s\S]*?<\/div>/)?.[0] || '';
  const screenshots = [...list.matchAll(/<a[^>]+href="(https:\/\/img\.itch\.zone\/[^"]+)"/g)].map((m) => m[1]);
  const yt = html.match(/(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([A-Za-z0-9_-]{11})/)?.[1] || '';
  const vimeo = html.match(/player\.vimeo\.com\/video\/(\d+)/)?.[1] || html.match(/vimeo\.com\/(\d{6,})/)?.[1] || '';
  const trailer = yt ? { provider: 'youtube', id: yt } : vimeo ? { provider: 'vimeo', id: vimeo } : null;
  // Joc per a navegador: l'iframe que itch.io carrega en prémer "Run game"
  const iframe = decode(html.match(/data-iframe="([^"]+)"/)?.[1] || '');
  const src = iframe.match(/src="(https:\/\/html(?:-classic)?\.itch\.zone\/html\/[^"]+)"/)?.[1] || '';
  const width = +(html.match(/"width":(\d+)/)?.[1] || iframe.match(/width="(\d+)"/)?.[1] || 960);
  const height = +(html.match(/"height":(\d+)/)?.[1] || iframe.match(/height="(\d+)"/)?.[1] || 600);
  // itch.io bloqueja l'adreça interna (html.itch.zone) fora d'itch.io; el seu reproductor oficial
  // per incrustar jocs (embed-upload) sí que es pot fer servir des de qualsevol web.
  const upload = src.match(/\/html\/(\d+)\//)?.[1];
  const play = upload ? { src: `https://itch.io/embed-upload/${upload}?color=0e0f0c`, width, height } : null;
  return { title, cover, screenshots: screenshots.slice(0, MAX_SHOTS), trailer, play };
}

let ok = 0, fail = 0;
for (const p of projects) {
  if (!p.itch) continue;
  const url = p.itch.replace(/\/+$/, '');
  process.stdout.write(`· ${p.id}  ←  ${url}\n`);
  try {
    const info = parse(await get(url));
    const dir = path.join(ROOT, 'public/projects', p.id, 'itch');
    fs.mkdirSync(dir, { recursive: true });
    const web = (file) => `/projects/${p.id}/itch/${file}`;
    const entry = { url, title: info.title, cover: '', screenshots: [], trailer: '', trailerThumb: '', play: info.play, importedAt: new Date().toISOString() };
    if (info.cover) entry.cover = web(await download(info.cover, dir, 'cover'));
    // Captures, sense repetir imatges (sovint la portada també és una captura)
    const seen = new Set(entry.cover ? [hash(path.join(dir, path.basename(entry.cover)))] : []);
    for (let i = 0; i < info.screenshots.length; i++) {
      const file = await download(info.screenshots[i], dir, `shot-${i + 1}`);
      const h = hash(path.join(dir, file));
      if (seen.has(h)) { fs.rmSync(path.join(dir, file)); continue; }
      seen.add(h);
      entry.screenshots.push(web(file));
    }
    if (info.trailer) {
      entry.trailer = info.trailer;
      try {
        const thumb = info.trailer.provider === 'youtube'
          ? `https://img.youtube.com/vi/${info.trailer.id}/hqdefault.jpg`
          : JSON.parse(await get(`https://vimeo.com/api/oembed.json?width=1280&url=https://vimeo.com/${info.trailer.id}`)).thumbnail_url;
        if (thumb) entry.trailerThumb = web(await download(thumb, dir, 'trailer'));
      } catch { /* sense miniatura */ }
    }
    out[p.id] = entry;
    console.log(`  ✓ "${info.title}" · ${entry.screenshots.length} captures · tràiler: ${entry.trailer ? entry.trailer.provider : 'no'} · jugable al navegador: ${info.play ? `sí (${info.play.width}×${info.play.height})` : 'no'}`);
    ok++;
  } catch (e) {
    console.log(`  ✗ ${e.message}`);
    if (previous[p.id]) { out[p.id] = previous[p.id]; console.log('    (es manté la importació anterior)'); }
    fail++;
  }
}
fs.writeFileSync(dataFile, JSON.stringify(out, null, 2) + '\n');
console.log(`\n${ok} importats${fail ? `, ${fail} amb errors` : ''}. Dades a src/itch-data.json`);
