import * as THREE from 'three';
import './style.css';
import { stops as STOPS, profile } from './content.js';
import { loadAssets, windUniform } from './assets.js';
import { buildWorld, SUN_DIR } from './world.js';
import { createPost, createMotes } from './post.js';
import { frameAt } from './layout.js';
import { pathHeightAt } from './terrain.js';
import { ANIMALS, loadAnimals } from './animals.js';
import {
  loadFonts, createBarkSurface, createSkySurface, createWaterSurface, createTrailheadSurface,
} from './surfaces.js';
import { Sound } from './audio.js';
import * as ui from './ui.js';
import { tr, t, lang, toggleLang, onLangChange } from './i18n.js';
import { createJournal } from './journal.js';
import './journal.css';

const $ = (s) => document.querySelector(s);
const body = document.body;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

const EYE = 1.6;
const PATH_LENGTH = 246;                // metres
const MAX_SPEED = 10 / PATH_LENGTH;     // 10 m/s, en unitats del recorregut (0–1)
const SCROLL_LEAD = 9 / PATH_LENGTH;    // l'scroll pot anar com a molt 9 m per davant
const BASE_FOV = 60;
const isTouch = matchMedia('(pointer: coarse)').matches;
const quality = { low: isTouch || innerWidth < 760, shadows: !(isTouch || innerWidth < 760) };

// Textos de la interfície HTML a l'idioma actual
function applyStaticTexts() {
  document.title = `${profile.name} · ${t('portfolio')}`;
  $('#vf-cta').textContent = t(isTouch ? 'shootTouch' : 'shootClick');
  $('#vf-back').textContent = t(isTouch ? 'lowerTouch' : 'lowerWheel');
  const loaderText = $('#loader p');
  if (loaderText) loaderText.textContent = t('loading');
  const btn = $('#lang');
  btn.setAttribute('aria-label', t('switchLabel'));
  btn.querySelectorAll('[data-lang]').forEach((el) => el.classList.toggle('is-active', el.dataset.lang === lang));
  btn.querySelector('.lang-hint').textContent = isTouch ? '' : t('switchHint');
}
applyStaticTexts();

// ───────────────────────────────── Renderer
const canvas = $('#scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch {
  document.querySelector('#loader p').textContent = t('noWebgl');
  throw new Error('WebGL no disponible');
}
renderer.setPixelRatio(Math.min(devicePixelRatio, quality.low ? 1.5 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.45;
renderer.shadowMap.enabled = quality.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(BASE_FOV, innerWidth / innerHeight, 0.1, 2600);

// ───────────────────────────────── Càrrega
const manager = new THREE.LoadingManager();
manager.onProgress = (_, loaded, total) => { $('#progress-bar').style.width = `${(loaded / total) * 90}%`; };

await loadFonts();
const [assets, animalAssets] = await Promise.all([
  loadAssets(manager, renderer.capabilities.getMaxAnisotropy()),
  loadAnimals(manager),
]);
const world = buildWorld({ scene, assets, quality });
const { terrain, layout } = world;
const post = createPost(renderer, scene, camera, { bloom: !quality.low });
const motes = createMotes(quality.low ? 180 : 420);
scene.add(motes);
const fogDensity = scene.fog.density;
const heightAt = (x, z) => terrain.heightAt(x, z);

// ───────────────────────────────── Inici del sender i mirador
const trailhead = createTrailheadSurface({ sign: world.introSign, content: ui.trailheadContent(isTouch) });
const M = layout.mirador;
// Al mirador, la mirada es perd cap a la vall i les muntanyes, una mica per sota de l'horitzó
// Al mirador es mira la gran muntanya del fons, amb el camí que hi porta
const finalEye = pathHeightAt(1) + EYE;
const viewTarget = terrain.world(1250, 30);
viewTarget.y = THREE.MathUtils.lerp(finalEye, terrain.valleyBase + 640, 0.42);
const VIEW_FOV = 52;

// Posta de sol: el sol baixa just per sobre de la silueta, a l'esquerra de la gran muntanya
const sunset = (() => {
  const az = -0.36; // radiants respecte de la direcció de la vista
  const flat = terrain.vDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -az).normalize();
  let maxEl = 0;
  for (let d = 150; d <= 2400; d += 25) {
    const p = M.center.clone().addScaledVector(flat, d);
    maxEl = Math.max(maxEl, Math.atan2(terrain.valleyHeight(p.x, p.z) - finalEye, d));
  }
  const el = maxEl + THREE.MathUtils.degToRad(2.2);
  const dir = flat.clone().multiplyScalar(Math.cos(el)).setY(Math.sin(el)).normalize();
  return {
    dir,
    top: new THREE.Color('#2c3557'), horizon: new THREE.Color('#ef8f55'), fog: new THREE.Color('#b9876a'),
    sun: new THREE.Color('#ff8442'), hemiSky: new THREE.Color('#b98f92'), hemiGround: new THREE.Color('#2b2a30'),
  };
})();
const day = {
  dir: world.sky.material.uniforms.sunDir.value.clone(),
  top: world.sky.material.uniforms.top.value.clone(),
  horizon: world.sky.material.uniforms.horizon.value.clone(),
  fog: world.fog.color.clone(),
  sun: world.sun.color.clone(), sunI: world.sun.intensity,
  hemiSky: world.hemi.color.clone(), hemiGround: world.hemi.groundColor.clone(), hemiI: world.hemi.intensity,
};
const sunDirNow = new THREE.Vector3().copy(day.dir);
function applySunset(k) {
  const U = world.sky.material.uniforms;
  sunDirNow.copy(day.dir).lerp(sunset.dir, k).normalize();
  U.sunDir.value.copy(sunDirNow);
  U.top.value.copy(day.top).lerp(sunset.top, k);
  U.horizon.value.copy(day.horizon).lerp(sunset.horizon, k);
  U.fogColor.value.copy(day.fog).lerp(sunset.fog, k);
  U.uGlow.value = k;
  world.fog.color.copy(U.fogColor.value);
  scene.background.copy(U.fogColor.value);
  world.sun.color.copy(day.sun).lerp(sunset.sun, k);
  world.sun.intensity = THREE.MathUtils.lerp(day.sunI, 2.4, k);
  world.hemi.color.copy(day.hemiSky).lerp(sunset.hemiSky, k);
  world.hemi.groundColor.copy(day.hemiGround).lerp(sunset.hemiGround, k);
  world.hemi.intensity = THREE.MathUtils.lerp(day.hemiI, 1.05, k);
}

// ───────────────────────────────── Parades
const eyeAt = (u) => frameAt(u).p.setY(pathHeightAt(u) + EYE);

function perpAway(toCam, awayFrom) {
  const h = new THREE.Vector3(toCam.z, 0, -toCam.x).normalize();
  return h.dot(awayFrom) < 0 ? h.negate() : h;
}

const runtime = STOPS.map((content, index) => {
  const L = layout.stops[content.id];
  const camEye = eyeAt(L.u);
  const f = frameAt(L.u);
  const animal = new ANIMALS[content.animal](animalAssets[content.animal]);
  const surfaceContent = () => ({
    title: ui.stopTitle(content.id),
    lines: ui.surfaceLines(content.id),
    projects: ui.surfaceLines(content.id),
    hint: t(content.id === 'letter' ? 'openLetter' : 'openJournal'),
  });
  let surface, animalSize, infoSize, fleeDir, lean = new THREE.Vector3();

  if (content.id === 'about') {
    surface = createBarkSurface({ tree: world.heroTree, camEye, content: surfaceContent() });
    const toCam = camEye.clone().sub(surface.focus).setY(0).normalize();
    const p = surface.focus.clone().addScaledVector(toCam, 1.7);
    animal.root.position.set(p.x, heightAt(p.x, p.z), p.z);
    const h = perpAway(toCam, f.n);
    animal.root.rotation.y = Math.atan2(h.x, h.z);
    fleeDir = h.clone().addScaledVector(toCam, -0.4);
    animalSize = { w: 3.4, h: 2.8 };
    infoSize = { w: 1.25, h: 1.65 };
  } else if (content.id === 'projects') {
    const skyPos = L.sky.clone().setY(camEye.y + 44);
    surface = createSkySurface({ position: skyPos, camEye, title: ui.stopTitle('projects'), projects: surfaceContent().lines, hint: surfaceContent().hint });
    // L'aligot plana en cercles damunt del prat, davant teu
    const orbit = L.orbit.clone();
    orbit.y = heightAt(orbit.x, orbit.z) + 13;
    animal.setOrbit(orbit, 6);
    fleeDir = skyPos.clone().sub(orbit).setY(0).normalize();
    animalSize = { w: 4.5, h: 3.2 };
    infoSize = { w: 50, h: 26 };
  } else {
    surface = createWaterSurface({ center: L.text, level: terrain.waterLevel, camEye, content: surfaceContent() });
    // El llop beu a la vora, de perfil i una mica de costat perquè no tapi el text
    const c = layout.pond.center;
    const toCamDir = camEye.clone().sub(c).setY(0).normalize();
    const p = L.wolf.clone();
    const side = p.clone().sub(c).setY(0).normalize();
    animal.root.position.set(p.x, heightAt(p.x, p.z), p.z);
    animal.root.rotation.y = Math.atan2(c.x - p.x, c.z - p.z);
    const tangent = new THREE.Vector3(side.z, 0, -side.x);
    fleeDir = tangent.dot(camEye.clone().sub(p)) > 0 ? tangent.negate() : tangent;
    fleeDir.addScaledVector(side, 0.6);
    animalSize = { w: 2.8, h: 1.8 };
    infoSize = { w: 6.2, h: 3.4 };
    lean = layout.pond.center.clone().sub(camEye).setY(0).normalize().multiplyScalar(1.1).setY(0.45);
  }
  if (surface.group) scene.add(surface.group);
  animal.root.traverse((o) => { if (o.isMesh) o.castShadow = quality.shadows; });
  scene.add(animal.root);

  return {
    index, content, surfaceContent, u: L.u, camEye, animal, surface, animalSize, infoSize, fleeDir, lean,
    done: false, infoBlend: 0, reveal: 0, revealing: false,
    animalFocus: new THREE.Vector3(),
  };
});

// ───────────────────────────────── Onades de l'estany
const ripples = [];
const rippleGeo = new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2);
function splash(pos, scale = 1) {
  sound.splash();
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(rippleGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false }));
    m.position.set(pos.x, terrain.waterLevel + 0.02, pos.z);
    m.renderOrder = 4;
    scene.add(m);
    ripples.push({ m, t: -i * 0.25, scale });
  }
}

// ───────────────────────────────── Estat
const sound = new Sound();
const state = {
  mode: 'loading', // loading | walk | busy | aiming
  progress: 0,
  target: 0,
  fov: BASE_FOV,
  fovTarget: null,
  lookDir: trailhead.focus.clone().sub(frameAt(0).p.setY(pathHeightAt(0) + EYE)).normalize(),
  pointer: new THREE.Vector2(),
  pointerSmooth: new THREE.Vector2(),
  current: 0,
  captureNext: null,
};
const nextStop = () => runtime.find((s) => !s.done);

// Captura el següent fotograma renderitzat (per a la foto i per al fons difuminat del quadern)
const captureFrame = () => new Promise((resolve) => { state.captureNext = resolve; });

const journal = createJournal({
  isTouch,
  onClose(id, continueWalk) {
    const stop = runtime.find((r) => r.content.id === id);
    state.mode = 'walk';
    // l'impuls de la roda o del trackpad no ha de fer-te passar de llarg
    state.swallowGesture = true;
    state.lastWheel = performance.now();
    if (continueWalk && stop) {
      const gate = nextStop();
      state.target = Math.min(stop.u + 0.035, gate ? gate.u : 1);
    }
  },
});

async function openJournal(stop) {
  state.mode = 'reading';
  const background = await captureFrame();
  journal.open(stop.content.id, { photo: stop.photo, background, index: stop.index });
}

// ───────────────────────────────── Entrada
function addScroll(delta) {
  if (state.mode === 'reading') return;
  // Després de tancar el quadern, s'ignora la resta del gest fins que hi ha una pausa
  if (state.swallowGesture) {
    const now = performance.now();
    if (now - state.lastWheel < 320) { state.lastWheel = now; return; }
    state.swallowGesture = false;
  }
  if (state.mode === 'aiming') {
    if (delta < 0) lowerCamera();
    else { const c = $('#vf-cta'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); return; }
  }
  if (state.mode !== 'walk') return;
  const gate = nextStop();
  const max = gate ? gate.u : 1;
  // L'scroll acumulat no pot anar gaire per davant (ni per darrere) de la càmera
  const lo = Math.max(0, state.progress - SCROLL_LEAD), hi = Math.min(max, state.progress + SCROLL_LEAD);
  state.target = THREE.MathUtils.clamp(state.target + delta, Math.min(lo, state.target), Math.max(hi, Math.min(state.target, max)));
}

addEventListener('wheel', (e) => {
  const px = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
  addScroll(THREE.MathUtils.clamp(px, -120, 120) * 0.000075);
}, { passive: true });

let touchY = null;
canvas.addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
canvas.addEventListener('touchmove', (e) => {
  if (touchY === null) return;
  const y = e.touches[0].clientY;
  addScroll((touchY - y) * 0.00022);
  touchY = y;
}, { passive: true });
canvas.addEventListener('touchend', () => { touchY = null; });

// Canvi d'idioma (tecla F o botó de dalt a la dreta)
$('#lang').addEventListener('click', (e) => { e.stopPropagation(); toggleLang(); });
addEventListener('keydown', (e) => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if ((e.key === 'f' || e.key === 'F') && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) toggleLang();
});
onLangChange(() => {
  applyStaticTexts();
  trailhead.redraw(ui.trailheadContent(isTouch));
  for (const s of runtime) s.surface.redraw?.(s.surfaceContent());
  journal.refresh();
  if (state.mode === 'aiming' || state.mode === 'busy') {
    const s = runtime[state.current];
    if (s) $('#vf-species').textContent = tr(s.content.species).toUpperCase();
  }
});

addEventListener('keydown', (e) => {
  if (['ArrowDown', 'PageDown', 'ArrowRight'].includes(e.key)) addScroll(0.012);
  if (['ArrowUp', 'PageUp', 'ArrowLeft'].includes(e.key)) addScroll(-0.012);
  if ((e.key === ' ' || e.key === 'Enter') && state.mode === 'aiming') { e.preventDefault(); shoot(); }
});

// El so només pot començar després d'un gest de l'usuari
const startSound = () => sound.start();
['pointerdown', 'keydown', 'touchstart'].forEach((ev) => addEventListener(ev, startSound, { once: true, passive: true }));

// Clic sobre una marca ja revelada → torna a obrir el quadern
const raycaster = new THREE.Raycaster();
const surfaceMeshes = (s) => {
  const out = [];
  (s.surface.group || s.surface.mesh)?.traverse?.((o) => { if (o.isMesh) out.push(o); });
  return out;
};
function reopenableUnderPointer() {
  if (state.mode !== 'walk') return null;
  raycaster.setFromCamera(state.pointer, camera);
  for (const s of runtime) {
    if (!s.done) continue;
    if (raycaster.intersectObjects(surfaceMeshes(s), false).length) return s;
  }
  return null;
}

addEventListener('pointermove', (e) => {
  state.pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  if (!isTouch && state.mode === 'walk') body.classList.toggle('hovering-link', !!reopenableUnderPointer());
});
canvas.addEventListener('click', (e) => {
  state.pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  if (state.mode === 'aiming') return shoot();
  const again = reopenableUnderPointer();
  if (again) { body.classList.remove('hovering-link'); openJournal(again); }
});

// ───────────────────────────────── Fotografia
async function raiseCamera(stop) {
  state.mode = 'busy';
  state.current = stop.index;
  $('#vf-species').textContent = tr(stop.content.species).toUpperCase();
  $('#vf-count').textContent = `${stop.index + 1}/${runtime.length}`;
  body.classList.remove('lowering');
  body.classList.add('raising');
  sound.whoosh(0.12);
  await wait(430);
  body.classList.add('aiming', 'blur');
  state.fovTarget = 'animal';
  await wait(330);
  body.classList.remove('raising');
  state.mode = 'aiming';
  await wait(260);
  body.classList.remove('blur');
  await wait(300);
  if (state.mode === 'aiming') { body.classList.add('focused'); sound.focusBeep(); }
}

function lowerCamera() {
  body.classList.remove('aiming', 'focused', 'blur', 'raising');
  body.classList.add('lowering');
  state.fovTarget = null;
  state.mode = 'walk';
  setTimeout(() => body.classList.remove('lowering'), 650);
}

function shoot() {
  const stop = nextStop();
  if (!stop || state.mode !== 'aiming') return;
  state.mode = 'busy';
  sound.shutter();
  body.classList.add('shoot');
  captureFrame().then((url) => { stop.photo = url; });
  setTimeout(() => {
    body.classList.remove('shoot', 'aiming', 'focused');
    body.classList.add('lowering');
    state.fovTarget = null;
  }, 520);
  setTimeout(() => finishStop(stop), 780);
  setTimeout(() => body.classList.remove('lowering'), 1400);
}

async function finishStop(stop) {
  stop.animal.flee(stop.fleeDir);
  sound.whoosh(0.2);
  await wait(650);
  stop.revealing = true;
  state.fovTarget = 'info';
  await wait(2300);
  stop.done = true;
  state.fovTarget = null;
  state.target = Math.max(state.target, stop.u);
  await openJournal(stop);
}

// ───────────────────────────────── Bucle
function fitFov(size, dist) {
  const half = Math.max(size.h / 2, size.w / 2 / camera.aspect) * 1.12;
  return THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(half / dist)), 10, 75);
}
const proximity = (u, at) => {
  const d = u - at;
  return d < 0 ? 1 - smooth(0.008, 0.05, -d) : 1 - smooth(0.004, 0.035, d);
};

const tmp = new THREE.Vector3();
const desired = new THREE.Vector3();
const camPos = new THREE.Vector3();
const clock = new THREE.Clock();
const introSize = { w: 3.8, h: 2.6 };

function frame() {
  if (state.mode === 'reading' && !state.captureNext) {
    clock.getDelta();
    requestAnimationFrame(frame);
    return;
  }
  const dt = Math.min(clock.getDelta(), 1 / 20);
  const time = clock.elapsedTime;
  windUniform.value = time;
  world.water.uTime.value = time;

  // Avanç pel sender (s'atura sol a cada animal i hi aixeca la càmera)
  const prev = state.progress;
  // Limitador de velocitat: per molt ràpid que facis scroll, es camina com a molt a MAX_SPEED
  const step = damp(state.progress, state.target, 2.6, dt) - state.progress;
  state.progress += THREE.MathUtils.clamp(step, -MAX_SPEED * dt, MAX_SPEED * dt);
  const u = state.progress;
  const gate = nextStop();
  if (state.mode === 'walk' && gate && u > gate.u - 0.0015 && state.target >= gate.u - 1e-4) {
    raiseCamera(gate);
  }

  // Posició de la càmera
  const f = frameAt(u);
  const moving = Math.abs(u - prev) / Math.max(dt, 1e-3);
  const bob = Math.sin(u * 246 * 1.9) * 0.035 * Math.min(1, moving * 60);
  camPos.copy(f.p).setY(pathHeightAt(u) + EYE + bob);

  // Cap a on mirem: endavant pel sender, al cartell d'inici, a l'animal, a la informació o a les vistes
  const ua = Math.min(u + 0.025, 1);
  desired.copy(frameAt(ua).p).setY(pathHeightAt(ua) + EYE - 0.25);
  if (ua >= 1) desired.addScaledVector(f.t, 10);
  let fov = BASE_FOV;

  const wIntro = 1 - smooth(0.004, 0.035, u);
  if (wIntro > 0) {
    desired.lerp(trailhead.focus, wIntro);
    fov = THREE.MathUtils.lerp(fov, Math.max(40, fitFov(introSize, camPos.distanceTo(trailhead.focus))), wIntro);
  }
  const wView = smooth(0.975, 0.999, u);
  if (wView > 0) {
    desired.lerp(viewTarget, wView);
    camPos.addScaledVector(M.dir, 2.6 * wView);
    fov = THREE.MathUtils.lerp(fov, VIEW_FOV, ease(wView));
  }

  for (const s of runtime) {
    const w = proximity(u, s.u);
    if (w <= 0) continue;
    if (!s.animal.fleeing) s.animal.focus.getWorldPosition(s.animalFocus);
    if (s.revealing || s.done) s.infoBlend = Math.min(1, s.infoBlend + dt / 1.6);
    const target = tmp.copy(s.animalFocus).lerp(s.surface.focus, ease(s.infoBlend));
    desired.lerp(target, Math.min(1, w * 1.05));
    camPos.addScaledVector(s.lean, w);
    const isCurrent = s.index === state.current;
    if (isCurrent && state.fovTarget === 'animal') fov = fitFov(s.animalSize, camPos.distanceTo(s.animalFocus));
    else if (isCurrent && state.fovTarget === 'info') fov = THREE.MathUtils.lerp(BASE_FOV, fitFov(s.infoSize, camPos.distanceTo(s.surface.focus)), ease(s.infoBlend));
    else if (s.done) fov = THREE.MathUtils.lerp(fov, fitFov(s.infoSize, camPos.distanceTo(s.surface.focus)), w);
  }
  const aiming = state.mode === 'aiming';
  const lk = wIntro > 0.5 ? 6 : 3.5;
  // Es suavitza la DIRECCIÓ de la mirada (no un punt del món), així mai queda enrere
  tmp.copy(desired).sub(camPos).normalize();
  state.lookDir.lerp(tmp, 1 - Math.exp(-lk * dt)).normalize();
  state.fov = damp(state.fov, fov, aiming || state.fovTarget ? 4 : 2.5, dt);
  camera.fov = state.fov;
  camera.updateProjectionMatrix();

  camera.position.copy(camPos);
  camera.lookAt(tmp.copy(camPos).addScaledVector(state.lookDir, 10));
  const pk = aiming ? 0.05 : isTouch ? 0 : 0.07;
  state.pointerSmooth.lerp(state.pointer, 1 - Math.exp(-4 * dt));
  camera.rotateY(-state.pointerSmooth.x * pk);
  camera.rotateX(state.pointerSmooth.y * pk * 0.6);
  if (aiming) { camera.rotateZ(Math.sin(time * 1.3) * 0.004); camera.rotateX(Math.sin(time * 0.9) * 0.003); }

  // Al cim la boira s'obre per veure la vall
  const open = smooth(0.84, 0.99, u);
  world.fog.density = THREE.MathUtils.lerp(fogDensity, 0.00055, open);
  applySunset(smooth(0.8, 0.99, u));
  world.sky.material.uniforms.uHaze.value = 1 - open * 0.7;
  world.sky.material.uniforms.uTime.value = time;
  motes.material.uniforms.uTime.value = time;
  motes.material.uniforms.uCam.value.copy(camPos);
  motes.material.uniforms.uScale.value = renderer.getPixelRatio() * (innerHeight / 800);
  world.valley.visible = open > 0.001;
  world.sky.position.copy(camPos);
  world.forest.userData.cull(camPos, open > 0.01 ? 220 : quality.low ? 95 : 115);
  adaptQuality(dt);

  // Sol i ombres segueixen la càmera
  world.sun.position.copy(camPos).addScaledVector(sunDirNow, 80);
  world.sun.target.position.copy(camPos).addScaledVector(f.t, 15);

  // Animals i superfícies
  const actx = { camPos, heightAt, waterLevel: terrain.waterLevel, splash };
  for (const s of runtime) {
    if (!s.animal.done && Math.abs(u - s.u) < 0.12) {
      s.animal.setAlert(s === nextStop() && ['aiming', 'busy'].includes(state.mode));
      s.animal.update(dt, actx);
    }
    if (s.revealing) s.reveal = Math.min(1, s.reveal + dt / 2.6);
    s.surface.uniforms.uReveal.value = s.reveal;
    s.surface.uniforms.uTime.value = time;
  }
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.t += dt;
    const k = Math.max(0, r.t);
    r.m.visible = r.t > 0;
    r.m.scale.setScalar((0.2 + k * 1.6) * r.scale);
    r.m.material.opacity = Math.max(0, 0.7 - k * 0.5);
    if (k > 1.5) { scene.remove(r.m); ripples.splice(i, 1); }
  }

  post.render(time);
  if (state.captureNext) {
    const done = state.captureNext;
    state.captureNext = null;
    done(renderer.domElement.toDataURL('image/jpeg', 0.88));
  }
  requestAnimationFrame(frame);
}

// Qualitat adaptativa: si l'ordinador o el mòbil no arriba, traiem ombres i després resolució
const perf = { t: 0, frames: 0, step: 0 };
function adaptQuality(dt) {
  if (state.mode === 'loading' || perf.step >= 3 || document.hidden) return;
  perf.t += dt; perf.frames++;
  if (perf.t < 2.5) return;
  const fps = perf.frames / perf.t;
  perf.t = 0; perf.frames = 0;
  if (fps > 45) return;
  if (perf.step === 0 && world.sun.castShadow) { world.sun.castShadow = false; post.dropBloom(); perf.step = 1; }
  else {
    // 2: resolució 1x · 3: resolució al 80 %
    const r = Math.min(1, devicePixelRatio) * (perf.step === 1 ? 1 : 0.8);
    renderer.setPixelRatio(r); post.setPixelRatio(r); post.setSize(innerWidth, innerHeight);
    perf.step = perf.step === 1 ? 2 : 3;
  }
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  post.setSize(innerWidth, innerHeight);
});

// Compila shaders abans de començar i fes entrar el bosc
world.valley.visible = true;
renderer.compile(scene, camera);
$('#progress-bar').style.width = '100%';
requestAnimationFrame(frame);
requestAnimationFrame(() => { $('#loader').classList.add('gone'); state.mode = 'walk'; });

// Eines per provar (només en desenvolupament)
if (import.meta.env.DEV) {
  window.__pf = {
    state, runtime, camera, renderer, world, post, scene,
    go(u) { state.progress = state.target = u; },
    shoot, journal, openJournal: (i) => openJournal(runtime[i]),
    complete(i) {
      const s = runtime[i]; s.done = true; s.reveal = 1; s.infoBlend = 1; s.animal.hide();
      state.mode = 'walk'; state.fovTarget = null; body.classList.remove('aiming', 'focused', 'raising', 'blur');
    },
    info: () => renderer.info.render,
    bench: (ms = 2500) => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else r('fps ' + (n / (ms / 1000)).toFixed(1)); }; requestAnimationFrame(f); }),
    toggle(what) {
      if (what === 'post') post.render = () => renderer.render(scene, camera);
      if (what === 'forest') world.forest.visible = false;
      if (what === 'small') world.forest.children.forEach((c) => { if (c.userData.small) c.visible = false; });
      if (what === 'motes') motes.visible = false;
      if (what === 'stats') {
        const by = {};
        world.forest.traverse((o) => {
          if (!o.isInstancedMesh || !o.parent.visible) return;
          const tris = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
          const k = o.material.name || (Array.isArray(o.material) ? o.material.map((m) => m.name).join('+') : '?');
          by[k] = (by[k] || 0) + tris * o.count;
        });
        return JSON.stringify(Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ':' + Math.round(v / 1000) + 'k'));
      }
      if (what === 'dpr') { renderer.setPixelRatio(0.5); post.setPixelRatio(0.5); post.setSize(innerWidth, innerHeight); }
      return what;
    },
  };
}
