import * as THREE from 'three';
import { Terrain, mulberry32, CLIFF_Z } from './terrain.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildLayout, distToPath } from './layout.js';

// Llum de capvespre: sol baix, des de l'esquerra i una mica per darrere del caminant
export const SUN_DIR = new THREE.Vector3(-0.9, 0.3, 0.32).normalize();
export const SKY_TOP = new THREE.Color('#4f6f93');
export const SKY_HORIZON = new THREE.Color('#d9c3a1');
export const FOG_COLOR = new THREE.Color('#9d9f8c');

function buildSky() {
  const geo = new THREE.SphereGeometry(1500, 48, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: SKY_TOP.clone() }, horizon: { value: SKY_HORIZON.clone() }, fogColor: { value: FOG_COLOR.clone() },
      sunDir: { value: SUN_DIR.clone() }, uTime: { value: 0 }, uHaze: { value: 1 }, uGlow: { value: 0 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 fogColor; uniform vec3 sunDir; uniform float uTime; uniform float uHaze; uniform float uGlow;
      varying vec3 vDir;
      float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += vn(p) * a; p *= 2.03; a *= 0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        float sd = max(dot(d, sunDir), 0.0);
        vec3 c = mix(horizon, top, pow(h, 0.55));
        c = mix(c, vec3(1.0, 0.78, 0.52), pow(sd, 6.0) * 0.55 * (1.0 - h));
        // capvespre: resplendor ampli al voltant del sol i franja calenta a l'horitzó
        c = mix(c, vec3(1.0, 0.55, 0.28), uGlow * (pow(sd, 3.0) * 0.7 + 0.25) * (1.0 - smoothstep(0.0, 0.35, d.y)));
        // núvols estratificats molt tènues
        vec2 uv = d.xz / (d.y + 0.12) * 1.4 + vec2(uTime * 0.004, 0.0);
        float cl = smoothstep(0.52, 0.85, fbm(uv)) * smoothstep(0.02, 0.25, d.y);
        vec3 cloudCol = mix(vec3(0.62, 0.62, 0.64), vec3(1.0, 0.86, 0.68), pow(sd, 3.0));
        c = mix(c, cloudCol, cl * 0.55);
        // sol i halo
        c += vec3(1.0, 0.82, 0.55) * (pow(sd, 900.0) * 6.0 + pow(sd, 60.0) * 0.35);
        // cap a l'horitzó es fon amb la boira
        c = mix(c, fogColor, (1.0 - smoothstep(0.0, 0.22, d.y)) * uHaze);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.renderOrder = -10;
  return sky;
}

function buildClouds(rand) {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#c9d8ea', emissiveIntensity: 0.55, flatShading: true, fog: false });
  const geo = new THREE.IcosahedronGeometry(1, 0);
  for (let i = 0; i < 16; i++) {
    const cloud = new THREE.Group();
    const puffs = 4 + Math.floor(rand() * 4);
    for (let j = 0; j < puffs; j++) {
      const m = new THREE.Mesh(geo, mat);
      const s = 6 + rand() * 7;
      m.scale.set(s * 1.4, s * 0.8, s);
      m.position.set((j - puffs / 2) * 8 + rand() * 4, rand() * 3, rand() * 6);
      cloud.add(m);
    }
    const a = rand() * Math.PI * 2, r = 180 + rand() * 120;
    cloud.position.set(Math.cos(a) * r, 115 + rand() * 60, -110 + Math.sin(a) * r);
    cloud.lookAt(0, cloud.position.y, -110);
    group.add(cloud);
  }
  return group;
}

// Col·loca instàncies d'un model agrupades per trossos de 40 m (així el frustum culling funciona).
class Scatter {
  constructor(models) { this.models = models; this.items = new Map(); }
  add(name, x, y, z, rotY, scale) {
    const C = /Tree/.test(name) ? 60 : 36;
    const cx = Math.floor(x / C), cz = Math.floor(z / C);
    const key = `${name}|${cx},${cz}`;
    if (!this.items.has(key)) this.items.set(key, { name, list: [], C, center: new THREE.Vector3((cx + 0.5) * C, 0, (cz + 0.5) * C) });
    this.items.get(key).list.push([x, y, z, rotY, scale]);
  }
  build({ castShadow, shadowFor }) {
    const group = new THREE.Group();
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const chunks = [];
    for (const { name, list, center, C } of this.items.values()) {
      const chunk = new THREE.Group();
      chunk.userData = { center, small: !/Tree/.test(name), half: C * 0.7 };
      chunks.push(chunk);
      group.add(chunk);
      for (const part of this.models[name].parts) {
        const inst = new THREE.InstancedMesh(part.geometry, part.material, list.length);
        list.forEach(([x, y, z, r, sc], i) => {
          inst.setMatrixAt(i, m4.compose(p.set(x, y, z), q.setFromAxisAngle(up, r), s.setScalar(sc)));
        });
        inst.castShadow = castShadow && shadowFor(name);
        inst.receiveShadow = true;
        inst.computeBoundingSphere();
        chunk.add(inst);
      }
    }
    // Amaga els trossos que la boira ja tapa (les plantes petites, abans)
    group.userData.cull = (camPos, far) => {
      for (const c of chunks) {
        const d = Math.hypot(c.userData.center.x - camPos.x, c.userData.center.z - camPos.z) - c.userData.half;
        c.visible = d < (c.userData.small ? far * 0.4 : far);
      }
    };
    return group;
  }
}

const pickWeighted = (rand, table) => {
  let r = rand() * table.reduce((a, [, w]) => a + w, 0);
  for (const [v, w] of table) { if ((r -= w) <= 0) return v; }
  return table[0][0];
};

// Només arbres de tronc recte (els NormalTree, aurons i arbres secs fan corbes)
const TREES = [
  // (PineTree_4 tret: té el tronc exageradament corbat)
  ['PineTree_1', 14], ['PineTree_2', 20], ['PineTree_5', 8],
  ['BirchTree_1', 2], ['BirchTree_5', 1.5],
];
const SMALL = [
  ['Grass_Large', 12], ['Grass_Small', 10],
  ['Plant_1', 9], ['Plant_2', 9],
  ['Rock_1', 1], ['Rock_2', 1], ['Rock_3', 0.6], ['Rock_5', 0.6],
];

function distToSegment2D(px, pz, a, b) {
  const abx = b.x - a.x, abz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((px - a.x) * abx + (pz - a.z) * abz) / (abx * abx + abz * abz)));
  return Math.hypot(px - (a.x + abx * t), pz - (a.z + abz * t));
}

export function buildWorld({ scene, assets, quality }) {
  const { models, materials } = assets;
  const layout = buildLayout();
  const terrain = new Terrain(layout.pond);
  const rand = mulberry32(2024);
  const S = layout.stops;

  scene.background = FOG_COLOR.clone();
  // Boira exponencial: dona profunditat entre els troncs
  scene.fog = new THREE.FogExp2(FOG_COLOR.clone(), quality.low ? 0.02 : 0.017);
  const sky = buildSky();
  scene.add(sky);
  const clouds = new THREE.Group();

  // Llums: capvespre daurat, ombres llargues
  const hemi = new THREE.HemisphereLight('#b3c1cf', '#3d4a30', 1.45);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffc48a', 3.4);
  sun.position.copy(SUN_DIR).multiplyScalar(80);
  if (quality.shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    const c = sun.shadow.camera;
    c.left = -32; c.right = 32; c.top = 32; c.bottom = -32; c.near = 1; c.far = 160;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.04;
  }
  scene.add(sun, sun.target);

  scene.add(terrain.build());
  scene.add(terrain.buildPath());

  // Zones on no hi pot haver arbres (claros de les parades i línies de visió)
  const cams = Object.values(S).map((s) => s.cam);
  // Res de vegetació davant del que fotografies o llegeixes
  const clearShots = [
    [S.about.cam, S.about.heroTree, 2.2], [S.letter.cam, S.letter.wolf, 1.6], [S.letter.cam, layout.pond.center, 2.4],
  ];
  const inShot = (x, z) => clearShots.some(([a, b, r]) => distToSegment2D(x, z, a, b) < r) ||
    Math.hypot(x - S.letter.wolf.x, z - S.letter.wolf.z) < 3;
  const noTree = [
    { c: S.about.heroTree, r: 6.5 },

    { c: S.projects.meadow.center, r: S.projects.meadow.radius },
    { c: layout.pond.center, r: layout.pond.radius + 3 },
    { c: layout.intro.sign, r: 3.5 },
    // cel obert per veure l'aligot des d'on et pares
    { c: S.projects.cam, r: 9 }, { c: S.projects.orbit, r: 14 },
  ];
  const M = layout.mirador.center;
  // Davant del mirador no hi pot haver arbres alts que tapin les vistes
  const blocksView = (x, z) => z < M.z + 9 && z > CLIFF_Z - 24 && Math.abs(x - M.x) < 18 + (M.z + 9 - z) * 1.4;
  const sightLines = [
    [S.about.cam, S.about.heroTree], [S.projects.cam, S.projects.orbit],
    [S.letter.cam, layout.pond.center],
  ];
  const blockedTree = (x, z) => blocksView(x, z) ||
    noTree.some(({ c, r }) => Math.hypot(x - c.x, z - c.z) < r) ||
    sightLines.some(([a, b]) => distToSegment2D(x, z, a, b) < 2.5);
  const inPond = (x, z) => Math.hypot(x - layout.pond.center.x, z - layout.pond.center.z) < layout.pond.radius + 0.4;

  const scatter = new Scatter(models);
  const density = quality.low ? 0.65 : 1;

  // Arbres
  for (let gx = -95; gx <= 95; gx += 3.9) {
    for (let gz = 40; gz >= -265; gz -= 3.9) {
      const x = gx + (rand() - 0.5) * 3.4, z = gz + (rand() - 0.5) * 3.4;
      const d = distToPath(x, z, 80);
      if (d < 3.2 + rand() * 1.5 || d > 70) continue;
      const p = (d < 10 ? 0.55 : d < 22 ? 0.6 : d < 45 ? 0.42 : 0.25) * density;
      if (rand() > p || blockedTree(x, z)) continue;
      const name = d > 22 ? (rand() < 0.75 ? 'PineTree_5' : 'PineTree_1') : pickWeighted(rand, TREES);
      const sc = (name.startsWith('Pine') ? 2.1 : 1.7) + rand() * 1.1;
      scatter.add(name, x, terrain.heightAt(x, z) - 0.05, z, rand() * Math.PI * 2, sc);
    }
  }
  // Vora del camí: herba, flors, arbustos i roques
  for (let gx = -60; gx <= 60; gx += 1.5) {
    for (let gz = 30; gz >= -240; gz -= 1.5) {
      const x = gx + (rand() - 0.5) * 1.4, z = gz + (rand() - 0.5) * 1.4;
      const d = distToPath(x, z, 45);
      if (d < 1.35 || d > 40 || inPond(x, z) || z < CLIFF_Z + 1 || Math.hypot(x - M.x, z - M.z) < 4.5) continue;
      const p = (d < 6 ? 0.62 : d < 16 ? 0.3 : 0.1) * density;
      if (rand() > p) continue;
      const name = pickWeighted(rand, SMALL);
      const big = name.startsWith('Rock') || name.startsWith('Bush');
      if (inShot(x, z)) continue;
      if (big && (d < 2.2 || cams.some((c) => Math.hypot(x - c.x, z - c.z) < 3) || sightLines.some(([a, b]) => distToSegment2D(x, z, a, b) < 2))) continue;
      const sc = name.startsWith('Grass') ? 1.6 + rand() * 1.4 : name.startsWith('Rock') ? 0.7 + rand() * 1.8 : name.startsWith('Plant') ? 1.3 + rand() * 1.0 : 1 + rand() * 0.8;
      scatter.add(name, x, terrain.heightAt(x, z) - 0.03, z, rand() * Math.PI * 2, sc);
    }
  }
  // Roques i jonc al voltant de l'estany
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rand() * 0.2;
    const r = layout.pond.radius + 0.3 + rand() * 1.2;
    const x = layout.pond.center.x + Math.cos(a) * r, z = layout.pond.center.z + Math.sin(a) * r;
    if (distToSegment2D(x, z, S.letter.cam, layout.pond.center) < 2.2 || inShot(x, z)) continue;
    const name = rand() < 0.55 ? ['Rock_1', 'Rock_2', 'Rock_3'][i % 3] : 'Grass_Large';
    scatter.add(name, x, terrain.heightAt(x, z) - 0.1, z, rand() * 6.28, name.startsWith('Rock') ? 0.9 + rand() : 2.2);
  }

  const forest = scatter.build({
    castShadow: quality.shadows,
    shadowFor: (n) => /Tree/.test(n),
  });
  scene.add(forest);

  // ── Parada 1: l'arbre gegant (Sobre mi)
  const heroTree = models.MapleTree_1.group.clone();
  heroTree.scale.setScalar(4.2);
  const ht = S.about.heroTree;
  ht.y = terrain.heightAt(ht.x, ht.z) - 0.1;
  heroTree.position.copy(ht);
  heroTree.rotation.y = Math.atan2(S.about.cam.x - ht.x, S.about.cam.z - ht.z) + 0.5;
  heroTree.traverse((o) => { if (o.isMesh) { o.castShadow = quality.shadows; o.receiveShadow = true; } });
  scene.add(heroTree);

  // ── Parada 2: el soc on es posa el pit-roig


  // ── Parada 3: l'estany
  const water = buildWater(layout.pond, terrain.waterLevel);
  scene.add(water.mesh);
  const pads = buildLilyPads(layout.pond, terrain.waterLevel, S.letter.pad, S.letter.text, rand);
  scene.add(pads.group);

  const placeSign = (sign, pos, lookAt) => {
    pos.y = terrain.heightAt(pos.x, pos.z);
    sign.group.position.copy(pos);
    sign.group.rotation.y = Math.atan2(lookAt.x - pos.x, lookAt.z - pos.z);
    sign.group.traverse((o) => { if (o.isMesh) { o.castShadow = quality.shadows; o.receiveShadow = true; } });
    scene.add(sign.group);
    sign.group.updateMatrixWorld(true);
  };


  // ── Inici: el cartell del sender
  const introSign = buildSign(materials, { W: 3.4, H: 2.0, y: 1.75, roof: true });
  placeSign(introSign, layout.intro.sign, layout.intro.cam);

  // ── El mirador i la vall
  const mirador = buildMirador(materials, terrain, layout.mirador);
  mirador.traverse((o) => { if (o.isMesh) { o.castShadow = quality.shadows; o.receiveShadow = true; } });
  scene.add(mirador);
  const valley = new THREE.Group();
  valley.add(terrain.buildValley(M, layout.mirador.dir));
  valley.add(buildValleyTrees(terrain, M, rand));
  scene.add(valley);

  return { layout, terrain, hemi, sun, clouds, sky, heroTree, water, pads, introSign, forest, valley, mirador, fog: scene.fog, fogFar: scene.fog.far };
}

function buildMirador(materials, terrain, { center, dir }) {
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: '#9b6b3f', map: materials.MapleTree_Bark.map });
  const plank = new THREE.MeshLambertMaterial({ color: '#b98a5a', flatShading: true });
  const y0 = terrain.heightAt(center.x - dir.x * 2, center.z - dir.z * 2) + 0.12;
  g.position.set(center.x, y0, center.z);
  g.rotation.y = Math.atan2(dir.x, dir.z);
  g.userData.floor = y0 + 0.05;
  // En local: +z cap a les vistes
  const W = 5.2, D = 5.6;
  for (let i = 0; i < 11; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(W, 0.1, D / 11 - 0.03), plank);
    p.position.set(0, 0, -D / 2 + (i + 0.5) * (D / 11));
    g.add(p);
  }
  const beam = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood); m.position.set(x, y, z); g.add(m); return m; };
  // Pilars fins a terra (al davant baixen pel penya-segat)
  const cos = Math.cos(g.rotation.y), sin = Math.sin(g.rotation.y);
  for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) {
    const lx = sx * (W / 2 - 0.15), lz = sz * (D / 2 - 0.15);
    const wx = center.x + cos * lx + sin * lz;
    const wz = center.z - sin * lx + cos * lz;
    const len = Math.max(0.3, y0 - terrain.heightAt(wx, wz) + 0.3);
    beam(0.2, len, 0.2, lx, -len / 2, lz);
  }
  // Barana (davant i laterals)
  const railH = 1.05;
  const rail = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 1.1));
    for (let i = 0; i <= n; i++) beam(0.1, railH, 0.1, x0 + ((x1 - x0) * i) / n, railH / 2, z0 + ((z1 - z0) * i) / n);
    const ang = Math.atan2(-(z1 - z0), x1 - x0);
    beam(len, 0.09, 0.14, (x0 + x1) / 2, railH, (z0 + z1) / 2).rotation.y = ang;
    beam(len, 0.06, 0.08, (x0 + x1) / 2, railH * 0.5, (z0 + z1) / 2).rotation.y = ang;
  };
  rail(-W / 2 + 0.1, D / 2 - 0.1, W / 2 - 0.1, D / 2 - 0.1);
  rail(-W / 2 + 0.1, -D / 2 + 1.4, -W / 2 + 0.1, D / 2 - 0.1);
  rail(W / 2 - 0.1, -D / 2 + 1.4, W / 2 - 0.1, D / 2 - 0.1);
  // Un banc per seure a mirar
  beam(1.8, 0.08, 0.45, 1.45, 0.45, -1.3);
  beam(0.08, 0.45, 0.4, 0.65, 0.22, -1.3);
  beam(0.08, 0.45, 0.4, 2.25, 0.22, -1.3);
  return g;
}

// Arbres molt senzills (pocs triangles) per omplir la vall llunyana
function buildValleyTrees(terrain, M, rand) {
  const cone = new THREE.ConeGeometry(1, 3, 6).translate(0, 2.6, 0).toNonIndexed();
  const trunk = new THREE.CylinderGeometry(0.2, 0.25, 1.2, 5).translate(0, 0.6, 0).toNonIndexed();
  cone.deleteAttribute('uv'); trunk.deleteAttribute('uv');
  const geo = mergeGeometries([cone, trunk]);
  const mat = new THREE.MeshLambertMaterial({ flatShading: true });
  const N = 6000;
  const inst = new THREE.InstancedMesh(geo, mat, N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const greens = ['#2f5a2c', '#3b6b31', '#4a7a35', '#35602e', '#6b8a3a'].map((c) => new THREE.Color(c));
  let n = 0;
  for (let tries = 0; tries < N * 3 && n < N; tries++) {
    const a = -Math.PI / 2 + (rand() - 0.5) * Math.PI * 1.6;
    const r = 40 + rand() ** 0.8 * 1100;
    const x = M.x + Math.cos(a) * r, z = M.z + Math.sin(a) * r;
    const h = terrain.valleyHeight(x, z);
    if (h - terrain.valleyBase > 110 || h < terrain.valleyBase - 0.8 || terrain.nearTrail(x, z, 9)) continue;
    const sc = 3 + rand() * 3.5;
    inst.setMatrixAt(n, m4.compose(p.set(x, h - 0.3, z), q.setFromAxisAngle(up, rand() * 6.28), s.set(sc, sc * (0.9 + rand() * 0.5), sc)));
    inst.setColorAt(n, greens[Math.floor(rand() * greens.length)]);
    n++;
  }
  inst.count = n;
  inst.computeBoundingSphere();
  return inst;
}

function buildStump(materials) {
  const g = new THREE.Group();
  const bark = new THREE.MeshLambertMaterial({ map: materials.PineTree_Bark.map, color: '#b8a08a' });
  const wood = new THREE.MeshLambertMaterial({ color: '#d7b385', flatShading: true });
  const H = 1.25;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, H, 10, 1), [bark, wood, wood]);
  trunk.position.y = H / 2;
  g.add(trunk);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.2, 10).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#b48a5c' }));
  ring.position.y = H + 0.005;
  g.add(ring);
  for (let i = 0; i < 4; i++) {
    const root = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.9, 5), bark);
    const a = (i / 4) * Math.PI * 2 + 0.4;
    root.position.set(Math.cos(a) * 0.5, 0.12, Math.sin(a) * 0.5);
    root.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
    g.add(root);
  }
  g.userData.top = H;
  return g;
}

function findPerch(stump, base) {
  const ray = new THREE.Raycaster(new THREE.Vector3(base.x, base.y + 20, base.z), new THREE.Vector3(0, -1, 0));
  let best = null;
  for (let dx = -0.4; dx <= 0.4; dx += 0.2) {
    for (let dz = -0.4; dz <= 0.4; dz += 0.2) {
      ray.ray.origin.set(base.x + dx, base.y + 20, base.z + dz);
      const hit = ray.intersectObject(stump, true)[0];
      if (hit && (!best || hit.point.y > best.y)) best = hit.point.clone();
    }
  }
  return best || base.clone().setY(base.y + 2);
}

function buildWater(pond, level) {
  const geo = new THREE.CircleGeometry(pond.radius + 1.2, 48).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshPhongMaterial({
    color: '#2c3f3c', emissive: '#121c1c', specular: '#ffd9a8', shininess: 120,
    transparent: true, opacity: 0.93, depthWrite: false,
  });
  const uTime = { value: 0 };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = 'varying vec3 vWp;\n' + shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWp = (modelMatrix * vec4(transformed,1.0)).xyz;');
    shader.fragmentShader = 'uniform float uTime; varying vec3 vWp;\n' + shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
       vec2 q = vWp.xz;
       float a = sin(q.x * 1.3 + uTime * 1.1) + sin(q.y * 1.7 - uTime * 0.9) + sin((q.x + q.y) * 2.3 + uTime * 1.6) * 0.5;
       float b = cos(q.x * 1.1 - uTime * 0.7) + cos(q.y * 1.9 + uTime * 1.2);
       normal = normalize(normal + (viewMatrix * vec4(a * 0.05, 0.0, b * 0.05, 0.0)).xyz);`,
    );
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pond.center.x, level, pond.center.z);
  mesh.renderOrder = 1;
  return { mesh, uTime, level };
}

function buildLilyPads(pond, level, mainPad, textCenter, rand) {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: '#3f5a2c', side: THREE.DoubleSide });
  const flowerMat = new THREE.MeshLambertMaterial({ color: '#f5c6d8', flatShading: true });
  const make = (r) => {
    const g = new THREE.CircleGeometry(r, 14, 0.35, Math.PI * 2 - 0.35).rotateX(-Math.PI / 2);
    return new THREE.Mesh(g, mat);
  };
  const main = null;
  const others = [];
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2, r = 1.5 + rand() * (pond.radius - 2.2);
    const x = pond.center.x + Math.cos(a) * r, z = pond.center.z + Math.sin(a) * r;
    if (Math.hypot(x - mainPad.x, z - mainPad.z) < 2 || Math.hypot(x - textCenter.x, z - textCenter.z) < 4) continue;
    const pad = make(0.3 + rand() * 0.35);
    pad.position.set(x, level + 0.02, z);
    pad.rotation.y = rand() * 6.28;
    if (false) {
      const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), flowerMat);
      f.scale.y = 0.6; f.position.y = 0.06;
      pad.add(f);
    }
    group.add(pad);
    others.push(pad);
  }
  return { group, main, others };
}

function buildSign(materials, { W, H, y, roof: bigRoof = false }) {
  const group = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: '#9b6b3f', map: materials.MapleTree_Bark.map });
  const plankCanvas = document.createElement('canvas');
  plankCanvas.width = 1024; plankCanvas.height = 600;
  const g = plankCanvas.getContext('2d');
  const planks = 4;
  for (let i = 0; i < planks; i++) {
    const y0 = (i * plankCanvas.height) / planks;
    g.fillStyle = ['#c49463', '#b88756', '#c8996a', '#bb8a59'][i];
    g.fillRect(0, y0, plankCanvas.width, plankCanvas.height / planks);
    g.strokeStyle = 'rgba(80,45,20,0.18)';
    for (let k = 0; k < 14; k++) {
      g.lineWidth = 1 + Math.random() * 2;
      g.beginPath();
      const yy = y0 + Math.random() * (plankCanvas.height / planks);
      g.moveTo(0, yy);
      for (let x = 0; x <= plankCanvas.width; x += 64) g.lineTo(x, yy + Math.sin(x * 0.01 + k) * 4);
      g.stroke();
    }
    g.fillStyle = 'rgba(60,30,10,0.55)';
    g.fillRect(0, y0, plankCanvas.width, 4);
  }
  const plankTex = new THREE.CanvasTexture(plankCanvas);
  plankTex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.09), [wood, wood, wood, wood, new THREE.MeshLambertMaterial({ map: plankTex }), wood]);
  board.position.y = y;
  group.add(board);
  for (const sx of [-1, 1]) {
    const ph = y + H / 2 + 0.25;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, ph, 7), wood);
    post.position.set(sx * (W / 2 - 0.12), ph / 2, -0.1);
    group.add(post);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.35, 0.08, 0.4), wood);
  roof.position.set(0, y + H / 2 + 0.1, -0.02);
  group.add(roof);
  if (bigRoof) {
    for (const s of [-1, 1]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(W / 2 + 0.55, 0.07, 0.9), wood);
      r.position.set(s * (W / 4 + 0.05), y + H / 2 + 0.45, 0);
      r.rotation.z = -s * 0.42;
      group.add(r);
    }
  }
  return { group, width: W, height: H, faceCenter: new THREE.Vector3(0, y, 0.05) };
}
