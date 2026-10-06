import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';

export const FONT_TITLE = '"Fraunces", Georgia, serif';
export const FONT_HAND = '"Cormorant Garamond", Georgia, serif';

export async function loadFonts() {
  try {
    await Promise.all([
      document.fonts.load(`700 80px ${FONT_TITLE}`),
      document.fonts.load(`500 80px ${FONT_TITLE}`),
      document.fonts.load(`italic 600 80px ${FONT_HAND}`),
    ]);
  } catch { /* si no es carreguen, fem servir les de reserva */ }
}

// ── Material amb aparició progressiva. mode: 0 escorça, 1 núvols, 2 aigua, 3 pintura
const REVEAL_GLSL = `
uniform float uReveal; uniform float uTime; uniform int uMode;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ return vnoise(p)*0.55 + vnoise(p*2.1)*0.3 + vnoise(p*4.3)*0.15; }
`;

export function revealMaterial(kind, map, mode, extra = {}) {
  const Base = kind === 'basic' ? THREE.MeshBasicMaterial : THREE.MeshLambertMaterial;
  const mat = new Base({ map, transparent: true, depthWrite: false, ...extra });
  const uniforms = { uReveal: { value: 0 }, uTime: { value: 0 }, uMode: { value: mode } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + REVEAL_GLSL)
      .replace('#include <map_fragment>', `
        vec2 uvR = vMapUv;
        if (uMode == 2) uvR += vec2(sin(vMapUv.y * 38.0 + uTime * 2.2), cos(vMapUv.x * 26.0 + uTime * 1.7)) * 0.0045 * (1.6 - uReveal);
        if (uMode == 1) uvR += vec2(sin(vMapUv.y * 6.0 + uTime * 0.4), cos(vMapUv.x * 5.0 + uTime * 0.3)) * 0.004;
        vec4 sampledDiffuseColor = texture2D(map, uvR);
        diffuseColor *= sampledDiffuseColor;
        float n = fbm(vMapUv * vec2(9.0, 7.0));
        float m;
        if (uMode == 1) {
          m = smoothstep(0.0, 0.18, uReveal * 1.45 - n - 0.2 + (1.0 - vMapUv.y) * 0.1);
        } else if (uMode == 2) {
          float d = distance(vMapUv, vec2(0.5, 0.15));
          m = smoothstep(0.0, 0.1, uReveal * 1.25 - d + n * 0.08);
        } else {
          float front = vMapUv.x * 0.75 + (1.0 - vMapUv.y) * 0.35 + n * 0.12;
          m = smoothstep(0.0, 0.03, uReveal * 1.3 - front);
        }
        diffuseColor.a *= m;
      `);
  };
  mat.customProgramCacheKey = () => `reveal-${kind}`;
  return { mat, uniforms };
}

function swapCanvas(tex, canvas) {
  tex.image = canvas;
  tex.needsUpdate = true;
}

function canvasTex(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function wrapLines(g, text, maxW) {
  const words = text.split(' ');
  const out = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
  }
  if (line) out.push(line);
  return out;
}

function fitFont(g, text, font, size, maxW) {
  let s = size;
  do { g.font = font.replace('SIZE', s); s -= 2; } while (g.measureText(text).width > maxW && s > 12);
}

// ─────────────────────────────────────── Escorça
// Lletres espaiades (versaletes) en un canvas
function spaced(g, text, x, y, spacing) {
  g.letterSpacing = `${spacing}px`;
  g.fillText(text, x + spacing / 2, y);
  g.letterSpacing = '0px';
}

// Gravat a la fusta: solc fosc, vora clara a sota (la llum entra al tall) i lleugera cremada
function engrave(g, draw) {
  g.save();
  g.fillStyle = 'rgba(255, 236, 205, 0.55)';
  g.translate(1.5, 2.5); draw(); g.translate(-1.5, -2.5);
  g.shadowColor = 'rgba(40, 18, 6, 0.55)';
  g.shadowBlur = 3;
  g.fillStyle = '#3b2010';
  draw();
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(20, 8, 2, 0.35)';
  g.translate(-0.8, -1.2); draw();
  g.restore();
}

// Tall a l'escorça: fusta clara del centre, anells, i la vora fosca on comença l'escorça
function blazeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const cx = w / 2, cy = h / 2, rx = w * 0.45, ry = h * 0.47;
  const shape = (k) => {
    g.beginPath();
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      const j = 1 + Math.sin(a * 3 + 0.4) * 0.025 + Math.sin(a * 7 + 1.3) * 0.015 + Math.sin(a * 17) * 0.006;
      const x = cx + Math.cos(a) * rx * j * k, y = cy + Math.sin(a) * ry * j * k;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
  };
  shape(1);
  g.save();
  g.clip();
  const grd = g.createRadialGradient(cx, cy * 0.9, 10, cx, cy, Math.max(rx, ry));
  grd.addColorStop(0, '#d9bc8f'); grd.addColorStop(0.65, '#c7a576'); grd.addColorStop(1, '#a37f55');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  // veta vertical fina i ondulada
  for (let k = 0; k < 70; k++) {
    const x0 = (k / 70) * w + (Math.random() - 0.5) * 6;
    g.strokeStyle = `rgba(110, 72, 36, ${0.06 + Math.random() * 0.1})`;
    g.lineWidth = 0.8 + Math.random() * 1.6;
    g.beginPath();
    for (let y = 0; y <= h; y += 16) {
      const dx = Math.sin(y * 0.012 + k * 0.7) * 4 + Math.exp(-(((y - h * 0.72) / 40) ** 2)) * Math.exp(-(((x0 - w * 0.68) / 30) ** 2)) * 18;
      y ? g.lineTo(x0 + dx, y) : g.moveTo(x0 + dx, y);
    }
    g.stroke();
  }
  // un nus discret
  const kx = w * 0.7, ky = h * 0.72;
  for (let r = 4; r < 22; r += 4) {
    g.strokeStyle = 'rgba(95, 58, 28, 0.22)';
    g.lineWidth = 1.2;
    g.beginPath(); g.ellipse(kx, ky, r * 0.7, r, 0, 0, Math.PI * 2); g.stroke();
  }
  // vora fosca: la fusta s'enfosqueix on toca l'escorça
  const edge = g.createRadialGradient(cx, cy, Math.min(rx, ry) * 0.75, cx, cy, Math.max(rx, ry) * 1.02);
  edge.addColorStop(0, 'rgba(60, 34, 14, 0)'); edge.addColorStop(1, 'rgba(60, 34, 14, 0.55)');
  g.fillStyle = edge;
  g.fillRect(0, 0, w, h);
  g.restore();
  shape(1);
  g.lineWidth = 7;
  g.strokeStyle = 'rgba(52, 30, 12, 0.85)';
  g.stroke();
  shape(0.985);
  g.lineWidth = 2;
  g.strokeStyle = 'rgba(240, 214, 170, 0.35)';
  g.stroke();
  return c;
}

// Gravat: número, títol en cursiva, ornament, nom en versaletes i la invitació a obrir el quadern
function carvedTextCanvas(w, h, title, lines, hint, index = '01') {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const cx = w / 2;

  g.font = `600 30px ${FONT_TITLE}`;
  engrave(g, () => spaced(g, `— ${index} —`, cx, h * 0.22, 10));

  fitFont(g, title, `italic 600 SIZEpx ${FONT_HAND}`, 168, w * 0.78);
  engrave(g, () => g.fillText(title, cx, h * 0.34));

  // ornament: dues línies i un rombe
  engrave(g, () => {
    g.fillRect(cx - 150, h * 0.445 - 1.5, 125, 3);
    g.fillRect(cx + 25, h * 0.445 - 1.5, 125, 3);
    g.beginPath();
    g.moveTo(cx, h * 0.445 - 11); g.lineTo(cx + 11, h * 0.445); g.lineTo(cx, h * 0.445 + 11); g.lineTo(cx - 11, h * 0.445);
    g.closePath(); g.fill();
  });

  const [first = '', ...rest] = lines;
  if (first) {
    let size = 40;
    const up = first.toUpperCase();
    do { g.font = `600 ${size}px ${FONT_TITLE}`; g.letterSpacing = `${size * 0.18}px`; size -= 2; } while (g.measureText(up).width > w * 0.74 && size > 20);
    g.letterSpacing = '0px';
    const sp = (size + 2) * 0.18;
    engrave(g, () => spaced(g, up, cx, h * 0.53, sp));
  }
  rest.forEach((l, i) => {
    fitFont(g, l, `italic 500 SIZEpx ${FONT_HAND}`, 56, w * 0.76);
    engrave(g, () => g.fillText(l, cx, h * 0.6 + i * 58));
  });

  if (hint) {
    // la invitació, dins d'un requadre gravat
    g.font = `600 26px ${FONT_TITLE}`;
    const label = hint.replace(/\s*→\s*$/, '').toUpperCase();
    g.letterSpacing = '6px';
    const tw = g.measureText(label).width + 70;
    g.letterSpacing = '0px';
    const by = h * 0.76, bh = 64;
    engrave(g, () => {
      g.beginPath();
      g.roundRect(cx - tw / 2, by - bh / 2, tw, bh, 32);
      g.lineWidth = 3;
      g.strokeStyle = g.fillStyle;
      g.stroke();
    });
    g.font = `600 26px ${FONT_TITLE}`;
    engrave(g, () => spaced(g, `${label}  →`, cx, by + 1, 6));
  }
  return c;
}

export function createBarkSurface({ tree, camEye, content }) {
  tree.updateMatrixWorld(true);
  const meshes = [];
  tree.traverse((o) => o.isMesh && meshes.push(o));
  const base = tree.position;
  const target = new THREE.Vector3(base.x, camEye.y + 0.3, base.z);
  const dir = target.clone().sub(camEye).normalize();
  const hit = new THREE.Raycaster(camEye, dir).intersectObjects(meshes, false)[0];
  const point = hit ? hit.point : target;
  const toCam = camEye.clone().sub(point).setY(0).normalize();
  const helper = new THREE.Object3D();
  helper.position.copy(point);
  helper.lookAt(point.clone().add(toCam));
  const size = new THREE.Vector3(1.25, 1.7, 0.9);

  const mesh = meshes[0];
  const geoBlaze = new DecalGeometry(mesh, point, helper.rotation, size);
  const blazeTex = canvasTex(blazeCanvas(512, 680));
  const blaze = new THREE.Mesh(geoBlaze, new THREE.MeshLambertMaterial({
    map: blazeTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4,
  }));
  const draw = (c) => carvedTextCanvas(768, 1024, c.title, c.lines, c.hint);
  const textTex = canvasTex(draw(content));
  const { mat, uniforms } = revealMaterial('lambert', textTex, 0, { polygonOffset: true, polygonOffsetFactor: -8 });
  const text = new THREE.Mesh(geoBlaze.clone(), mat);
  blaze.receiveShadow = text.receiveShadow = true;
  blaze.renderOrder = 2; text.renderOrder = 3;
  const group = new THREE.Group();
  group.add(blaze, text);
  return { group, uniforms, focus: point.clone(), fov: 30, redraw: (c) => swapCanvas(textTex, draw(c)) };
}

// ─────────────────────────────────────── Cel
function cloudTextCanvas(title, items, hint) {
  const w = 2048, h = 1024;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const cloudText = (text, x, y) => {
    g.save();
    g.shadowColor = 'rgba(30,40,60,0.7)';
    g.shadowBlur = 40;
    g.shadowOffsetY = 10;
    g.fillStyle = 'rgba(70,82,104,0.55)';
    g.fillText(text, x, y + 5);
    g.restore();
    g.save();
    g.shadowColor = 'rgba(255,255,255,0.95)';
    g.shadowBlur = 34;
    g.fillStyle = '#ffffff';
    g.fillText(text, x, y);
    g.fillText(text, x, y);
    g.restore();
  };
  g.font = `italic 600 230px ${FONT_HAND}`;
  cloudText(title, w / 2, 170);
  const hotspots = [];
  const n = items.length;
  const step = Math.min(185, 700 / Math.max(1, n));
  items.forEach((it, i) => {
    const y = 380 + i * step;
    fitFont(g, it.title, `italic 600 SIZEpx ${FONT_HAND}`, 104, w * 0.8);
    cloudText(it.title, w / 2, y);
    g.font = `italic 600 58px ${FONT_HAND}`;
    let s = it.summary;
    while (g.measureText(s).width > w * 0.84 && s.length > 10) s = s.slice(0, -2);
    if (s !== it.summary) s = s.trimEnd() + '…';
    cloudText(s, w / 2, y + 74);
    if (it.url) {
      g.font = `italic 600 104px ${FONT_HAND}`;
      const tw = Math.max(g.measureText(it.title).width, w * 0.5);
      hotspots.push({ x: w / 2 - tw / 2, y: y - 60, w: tw, h: 170, url: it.url });
    }
  });
  if (hint) {
    g.font = `600 46px ${FONT_TITLE}`;
    const label = `${hint.replace(/\s*→\s*$/, '').toUpperCase()}  →`;
    g.save();
    g.letterSpacing = '12px';
    g.shadowColor = 'rgba(30,40,60,0.6)';
    g.shadowBlur = 20;
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.fillText(label, w / 2 + 6, Math.min(h - 70, 380 + n * step + 40));
    g.restore();
  }
  return { canvas: c, hotspots };
}

export function createSkySurface({ position, camEye, title, projects, hint }) {
  const { canvas, hotspots } = cloudTextCanvas(title, projects.slice(0, 4), hint);
  const tex = canvasTex(canvas);
  const { mat, uniforms } = revealMaterial('basic', tex, 1, { fog: false });
  const W = 48;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, W / 2), mat);
  mesh.position.copy(position);
  mesh.lookAt(camEye);
  mesh.renderOrder = -5;
  const redraw = (c) => swapCanvas(tex, cloudTextCanvas(c.title, c.projects.slice(0, 4), c.hint).canvas);
  return { group: mesh, uniforms, focus: position.clone(), fov: 48, mesh, hotspots, canvasSize: [canvas.width, canvas.height], redraw };
}

// ─────────────────────────────────────── Aigua
function waterTextCanvas(title, lines, hint) {
  const w = 1024, h = 640;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  // reflex de llum càlida sobre l'aigua fosca
  const glow = (draw, blur, color, alpha) => {
    g.save();
    g.globalAlpha = alpha;
    g.shadowColor = color;
    g.shadowBlur = blur;
    g.fillStyle = color;
    draw();
    g.restore();
  };
  const headline = lines[0] || title;
  fitFont(g, headline, `italic 600 SIZEpx ${FONT_HAND}`, 230, w * 0.86);
  const draw = () => g.fillText(headline, w / 2, h * 0.36);
  glow(draw, 60, 'rgba(255, 214, 150, 1)', 0.35);
  glow(draw, 18, 'rgba(255, 236, 205, 1)', 0.6);
  glow(draw, 0, '#fff7ea', 0.95);
  // ornament
  g.fillStyle = 'rgba(255, 236, 205, 0.75)';
  g.fillRect(w / 2 - 140, h * 0.58, 110, 2);
  g.fillRect(w / 2 + 30, h * 0.58, 110, 2);
  g.beginPath(); g.arc(w / 2, h * 0.58 + 1, 6, 0, Math.PI * 2); g.fill();
  if (hint) {
    g.font = `600 34px ${FONT_TITLE}`;
    const label = `${hint.replace(/\s*→\s*$/, '').toUpperCase()}  →`;
    glow(() => spaced(g, label, w / 2, h * 0.74, 9), 12, 'rgba(255, 236, 205, 1)', 0.85);
  }
  return c;
}

export function createWaterSurface({ center, level, camEye, content }) {
  const tex = canvasTex(waterTextCanvas(content.title, content.lines, content.hint));
  const { mat, uniforms } = revealMaterial('basic', tex, 2, { fog: false });
  const W = 5.6, D = W * (640 / 1024) * 1.9;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat);
  mesh.rotation.x = -Math.PI / 2;
  const holder = new THREE.Group();
  holder.position.set(center.x, level + 0.012, center.z);
  holder.rotation.y = Math.atan2(camEye.x - center.x, camEye.z - center.z);
  holder.add(mesh);
  mesh.renderOrder = 2;
  const redraw = (c) => swapCanvas(tex, waterTextCanvas(c.title, c.lines, c.hint));
  return { group: holder, uniforms, focus: new THREE.Vector3(center.x, level, center.z), fov: 44, redraw };
}

// ─────────────────────────────────────── Rètol
function paintedTextCanvas(title, lines, aspect) {
  const w = 1024, h = Math.round(1024 / aspect);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const paint = (text, x, y) => {
    g.fillStyle = 'rgba(255,230,190,0.35)';
    g.fillText(text, x + 2, y + 2);
    g.fillStyle = '#2e1a0c';
    g.fillText(text, x, y);
  };
  fitFont(g, title, `700 SIZEpx ${FONT_TITLE}`, 120, w * 0.85);
  paint(title, w / 2, h * 0.19);
  g.fillStyle = '#2e1a0c';
  g.fillRect(w * 0.36, h * 0.3, w * 0.28, 4);
  const hotspots = [];
  const step = Math.min(92, (h * 0.58) / Math.max(1, lines.length));
  lines.forEach((l, i) => {
    const text = typeof l === 'string' ? l : l.text;
    const y = h * 0.42 + i * step;
    fitFont(g, text, `500 SIZEpx ${FONT_TITLE}`, 60, w * 0.86);
    paint(text, w / 2, y);
    if (l.url) {
      const tw = g.measureText(text).width;
      g.fillStyle = 'rgba(46,26,12,0.5)';
      g.fillRect(w / 2 - tw / 2, y + 30, tw, 3);
      hotspots.push({ x: w / 2 - tw / 2 - 20, y: y - step / 2, w: tw + 40, h: step, url: l.url });
    }
  });
  return { canvas: c, hotspots };
}

export function createSignSurface({ sign, content }) {
  const { canvas, hotspots } = paintedTextCanvas(content.title, content.lines, sign.width / sign.height);
  const tex = canvasTex(canvas);
  const { mat, uniforms } = revealMaterial('lambert', tex, 3, { polygonOffset: true, polygonOffsetFactor: -4 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(sign.width * 0.96, sign.height * 0.96), mat);
  mesh.position.copy(sign.faceCenter);
  mesh.receiveShadow = true;
  sign.group.add(mesh);
  sign.group.updateMatrixWorld(true);
  return { group: null, uniforms, focus: mesh.getWorldPosition(new THREE.Vector3()), fov: 34, mesh, hotspots, canvasSize: [canvas.width, canvas.height] };
}

// ─────────────────────────────────────── Cartell d'inici del sender
function trailheadCanvas({ name, role, tagline, stops, hint, credits, kicker, here }, aspect) {
  const w = 1400, h = Math.round(1400 / aspect);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const ink = '#2e1a0c';
  const paint = (text, x, y, align = 'left') => {
    g.textAlign = align;
    g.fillStyle = 'rgba(255,230,190,0.35)';
    g.fillText(text, x + 2, y + 2);
    g.fillStyle = ink;
    g.fillText(text, x, y);
  };
  g.textBaseline = 'middle';
  const L = w * 0.06, colW = w * 0.5;
  g.font = `600 34px ${FONT_TITLE}`;
  paint(kicker, L, h * 0.13);
  fitFont(g, name, `700 SIZEpx ${FONT_TITLE}`, 124, colW);
  paint(name, L, h * 0.3);
  g.font = `500 46px ${FONT_TITLE}`;
  paint(role, L, h * 0.46);
  g.font = `italic 600 50px ${FONT_HAND}`;
  wrapLines(g, tagline, colW).slice(0, 3).forEach((l, i) => paint(l, L, h * 0.6 + i * 56));
  g.font = `italic 600 60px ${FONT_HAND}`;
  paint(hint, L, h * 0.88);

  // Mapa del sender amb les parades (costa amunt fins al mirador)
  const mx = w * 0.62, my = h * 0.12, mw = w * 0.33, mh = h * 0.76;
  g.strokeStyle = 'rgba(46,26,12,0.35)';
  g.lineWidth = 4;
  g.strokeRect(mx, my, mw, mh);
  const pts = stops.map((_, i) => [mx + mw * (0.25 + (i % 2 ? 0.45 : 0.1) + (i === stops.length - 1 ? 0.2 : 0)), my + mh * (0.86 - (i + 1) * (0.72 / stops.length))]);
  const start = [mx + mw * 0.45, my + mh * 0.93];
  g.setLineDash([14, 12]);
  g.lineWidth = 6;
  g.strokeStyle = ink;
  g.beginPath();
  g.moveTo(...start);
  pts.forEach(([x, y], i) => {
    const [px, py] = i ? pts[i - 1] : start;
    g.quadraticCurveTo(px + (x - px) * 0.1 + 40, (py + y) / 2, x, y);
  });
  g.stroke();
  g.setLineDash([]);
  g.font = `600 30px ${FONT_TITLE}`;
  pts.forEach(([x, y], i) => {
    g.fillStyle = ink;
    g.beginPath(); g.arc(x, y, 13, 0, Math.PI * 2); g.fill();
    paint(stops[i], x + (x > mx + mw * 0.5 ? -24 : 24), y, x > mx + mw * 0.5 ? 'right' : 'left');
  });
  g.fillStyle = '#b8452d';
  g.beginPath(); g.arc(...start, 15, 0, Math.PI * 2); g.fill();
  g.font = `600 28px ${FONT_TITLE}`;
  paint(here, start[0] + 26, start[1]);
  if (credits) {
    g.font = `500 22px ${FONT_TITLE}`;
    g.globalAlpha = 0.7;
    paint(credits, w - L, h * 0.965, 'right');
    g.globalAlpha = 1;
  }
  return c;
}

export function createTrailheadSurface({ sign, content }) {
  const tex = canvasTex(trailheadCanvas(content, sign.width / sign.height));
  const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, polygonOffset: true, polygonOffsetFactor: -4 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(sign.width * 0.96, sign.height * 0.96), mat);
  mesh.position.copy(sign.faceCenter);
  mesh.receiveShadow = true;
  sign.group.add(mesh);
  sign.group.updateMatrixWorld(true);
  const redraw = (c) => swapCanvas(tex, trailheadCanvas(c, sign.width / sign.height));
  return { focus: mesh.getWorldPosition(new THREE.Vector3()), redraw };
}
