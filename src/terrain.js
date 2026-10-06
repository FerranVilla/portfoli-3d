import * as THREE from 'three';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';
import { curve, distToPath } from './layout.js';

export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const noise = new SimplexNoise({ random: mulberry32(11) });
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Pujada de la muntanya: replans a cada parada (pendent zero) i costa entre elles.
const CLIMB = [[20, 0], [-26, 8], [-80, 20], [-131, 32], [-205, 52], [-300, 52]];
export const CLIFF_Z = -219.5;
export function climbAt(z) {
  if (z >= CLIMB[0][0]) return CLIMB[0][1];
  for (let i = 1; i < CLIMB.length; i++) {
    const [z1, h1] = CLIMB[i], [z0, h0] = CLIMB[i - 1];
    if (z >= z1) return THREE.MathUtils.lerp(h0, h1, smooth(z0, z1, z));
  }
  return CLIMB[CLIMB.length - 1][1];
}
export const CLIFF_DROP = 80;

function cliffDrop(x, z) {
  const edge = CLIFF_Z + noise.noise(x * 0.08, 7) * 1.5 - Math.max(0, Math.abs(x - 7) - 14) * 0.35;
  return CLIFF_DROP * smooth(edge, edge - 26, z) ** 0.7;
}

function baseHeight(x, z) {
  return climbAt(z) + noise.noise(x * 0.011, z * 0.011) * 5
    + noise.noise(x * 0.035, z * 0.035) * 1.2
    + noise.noise(x * 0.12, z * 0.12) * 0.15;
}

// Alçada del sender: el terreny suavitzat al llarg de la corba.
const PATH_N = 400;
const pathY = [];
{
  const raw = curve.getSpacedPoints(PATH_N).map((p) => baseHeight(p.x, p.z));
  for (let i = 0; i <= PATH_N; i++) {
    let s = 0, c = 0;
    for (let k = -12; k <= 12; k++) { const j = i + k; if (j >= 0 && j <= PATH_N) { s += raw[j]; c++; } }
    pathY.push(s / c);
  }
}
const pathPts = curve.getSpacedPoints(PATH_N);

// Alçada del sender al punt més proper (interpolada, perquè no faci esglaons)
function nearestPathY(x, z) {
  let best = Infinity, bi = 0;
  for (let i = 0; i <= PATH_N; i++) {
    const d = (pathPts[i].x - x) ** 2 + (pathPts[i].z - z) ** 2;
    if (d < best) { best = d; bi = i; }
  }
  const j = bi < PATH_N && (bi === 0 || segT(bi, x, z) > 0) ? bi : bi - 1;
  return THREE.MathUtils.lerp(pathY[j], pathY[j + 1], THREE.MathUtils.clamp(segT(j, x, z), 0, 1));
}
function segT(i, x, z) {
  const a = pathPts[i], b = pathPts[i + 1];
  const abx = b.x - a.x, abz = b.z - a.z;
  return ((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz);
}

export function pathHeightAt(u) {
  const f = u * PATH_N, i = Math.min(PATH_N - 1, Math.floor(f));
  return THREE.MathUtils.lerp(pathY[i], pathY[i + 1], f - i);
}

export class Terrain {
  constructor(pond) {
    this.pond = pond;
    const c = pond.center;
    this.pondRim = nearestPathY(c.x, c.z) - 0.1;
    this.waterLevel = this.pondRim - 0.45;
  }

  heightAt(x, z) {
    const d = distToPath(x, z, 30);
    let h = baseHeight(x, z);
    if (d < 14) h = THREE.MathUtils.lerp(nearestPathY(x, z), h, smooth(2.2, 14, d));
    const { center, radius } = this.pond;
    const pd = Math.hypot(x - center.x, z - center.z);
    if (pd < radius + 6) {
      const k = smooth(radius + 6, radius + 1, pd);
      h = THREE.MathUtils.lerp(h, this.pondRim, k);
      if (pd < radius + 0.6) h -= (1 - (pd / (radius + 0.6)) ** 2) * 1.8 + 0.1;
    }
    if (z < CLIFF_Z + 4) h -= cliffDrop(x, z);
    return h;
  }

  build() {
    const W = 280, D = 318, SX = 175, SZ = 200;
    const geo = new THREE.PlaneGeometry(W, D, SX, SZ).rotateX(-Math.PI / 2);
    geo.translate(0, 0, -97);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const grassA = new THREE.Color('#3f4d26'), grassB = new THREE.Color('#5d6a32');
    const rock = new THREE.Color('#6b675f');
    const dry = new THREE.Color('#5e4c33'), dirt = new THREE.Color('#5a4630'), mud = new THREE.Color('#3a3324');
    const col = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const y = this.heightAt(x, z);
      pos.setY(i, y);
      const n = noise.noise(x * 0.05, z * 0.05) * 0.5 + 0.5;
      col.copy(grassA).lerp(grassB, n);
      col.lerp(dry, Math.max(0, noise.noise(x * 0.02 + 40, z * 0.02) - 0.3) * 0.8);
      const d = distToPath(x, z, 10);
      col.lerp(dirt, smooth(3.4, 1.6, d) * 0.55);
      const pd = Math.hypot(x - this.pond.center.x, z - this.pond.center.z);
      col.lerp(mud, smooth(this.pond.radius + 1.6, this.pond.radius, pd));
      if (z < CLIFF_Z + 4) col.lerp(rock, Math.sin(Math.min(1, cliffDrop(x, z) / CLIFF_DROP) * Math.PI) * 0.9);
      col.toArray(colors, i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    mesh.receiveShadow = true;
    return mesh;
  }

  // La vall i les muntanyes que es veuen des del mirador.
  // La vista del mirador: una vall boscosa, un camí que la travessa i, al fons,
  // una gran muntanya nevada (encara queda molt camí per fer).
  buildValley(mirador, dir) {
    const base = this.heightAt(mirador.x, CLIFF_Z - 40);
    this.valleyBase = base;
    this.vOrigin = mirador.clone();
    this.vDir = dir.clone().setY(0).normalize();
    this.vSide = new THREE.Vector3(-this.vDir.z, 0, this.vDir.x);
    this.buildTrail();

    const S = 3600, N = 300;
    const geo = new THREE.PlaneGeometry(S, S, N, N).rotateX(-Math.PI / 2);
    const c0 = mirador.clone().addScaledVector(this.vDir, 900);
    geo.translate(c0.x, 0, c0.z);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const low = new THREE.Color('#4c6430'), forest = new THREE.Color('#2e4626'), stone = new THREE.Color('#7a746c');
    const darkStone = new THREE.Color('#58534d'), snow = new THREE.Color('#eeeae4');
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = this.valleyHeight(x, z);
      pos.setY(i, h);
      const rel = h - base;
      const n1 = noise.noise(x * 0.01, z * 0.01), n2 = noise.noise(x * 0.03, z * 0.03);
      c.copy(low).lerp(forest, smooth(-2, 20, rel) * 0.8 + n1 * 0.2);
      c.lerp(stone, smooth(90, 170, rel + n1 * 25));
      c.lerp(darkStone, smooth(0.3, 0.9, n2) * smooth(120, 200, rel) * 0.6);
      c.lerp(snow, smooth(250, 320, rel + n2 * 40));
      c.toArray(colors, i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    const lake = new THREE.Mesh(new THREE.PlaneGeometry(S, S).rotateX(-Math.PI / 2), new THREE.MeshPhongMaterial({ color: '#4d6f86', specular: '#ffd2a0', shininess: 80 }));
    lake.position.set(c0.x, base - 1.2, c0.z);
    const g = new THREE.Group();
    g.add(mesh, lake, this.buildTrailMesh());
    return g;
  }

  // Coordenades locals de la vall: d = distància endavant des del mirador, l = desplaçament lateral
  local(x, z) {
    const dx = x - this.vOrigin.x, dz = z - this.vOrigin.z;
    return [dx * this.vDir.x + dz * this.vDir.z, dx * this.vSide.x + dz * this.vSide.z];
  }
  world(d, l) {
    return this.vOrigin.clone().addScaledVector(this.vDir, d).addScaledVector(this.vSide, l);
  }

  valleyHeight(x, z) {
    const base = this.valleyBase;
    const [d, l] = this.local(x, z);
    let h = base + noise.noise(x * 0.006, z * 0.006) * 5 + noise.noise(x * 0.02, z * 0.02) * 1.5;
    // Carenes als costats; obertes al davant perquè es vegi la gran muntanya
    const r = Math.hypot(d, l);
    const cone = smooth(0.25, 0.75, Math.abs(l) / Math.max(1, d + 200));
    const ridge = smooth(170, 650, r) * (90 + noise.noise(x * 0.0035, z * 0.0035) * 70 + Math.abs(noise.noise(x * 0.011, z * 0.011)) * 40);
    h += ridge * (d < 0 ? 1 : cone);
    // Turons baixos a mitja distància, en capes
    h += smooth(250, 600, d) * (1 - smooth(900, 1100, d)) * Math.max(0, noise.noise(x * 0.004 + 9, z * 0.004)) * 90;
    // La gran muntanya
    h = Math.max(h, this.peak(d, l, 1250, 60, 640, 560));
    // Germanes més baixes a la dreta, i una de llunyana a l'esquerra
    h = Math.max(h, this.peak(d, l, 1080, 520, 330, 380));
    h = Math.max(h, this.peak(d, l, 1500, -620, 280, 420));
    return h;
  }

  peak(d, l, pd, pl, H, R) {
    const dd = (d - pd) * 0.9, ll = l - pl;
    const ang = Math.atan2(ll, dd);
    // arestes (contraforts) que fan la silueta més abrupta
    const ribs = 1 + 0.18 * Math.cos(ang * 5 + 0.7) + 0.08 * Math.cos(ang * 11);
    const rr = Math.hypot(dd, ll) / (R * ribs);
    if (rr >= 1) return -1e9;
    const k = (1 - rr) ** 1.45;
    const detail = 1 + noise.noise(d * 0.012, l * 0.012) * 0.07 * k + Math.abs(noise.noise(d * 0.03, l * 0.03)) * 0.05;
    return this.valleyBase + H * k * detail - (1 - k) * 2;
  }

  // El camí que travessa la vall i puja en ziga-zaga cap a la gran muntanya
  buildTrail() {
    const pts = [];
    for (let d = 40; d <= 760; d += 20) pts.push([d, Math.sin(d * 0.011) * 70 * smooth(40, 160, d) + (d / 760) * 40]);
    // llaçades pel vessant
    const zig = [[800, 30], [850, -40], [900, 80], [950, -10], [1000, 110], [1040, 40], [1075, 120]];
    for (const p of zig) pts.push(p);
    this.trailPts = pts.map(([d, l]) => this.world(d, l));
  }

  nearTrail(x, z, r) {
    for (const p of this.trailCurvePts || this.trailPts) {
      if ((p.x - x) ** 2 + (p.z - z) ** 2 < r * r) return true;
    }
    return false;
  }

  buildTrailMesh() {
    const curve = new THREE.CatmullRomCurve3(this.trailPts, false, 'centripetal');
    const N = 600, half = 2.6;
    const pts = curve.getSpacedPoints(N);
    this.trailCurvePts = curve.getSpacedPoints(160);
    const positions = [], index = [];
    for (let i = 0; i <= N; i++) {
      const t = curve.getTangentAt(i / N).setY(0).normalize();
      const n = new THREE.Vector3(-t.z, 0, t.x);
      for (const sgn of [-1, 1]) {
        const x = pts[i].x + n.x * half * sgn, z = pts[i].z + n.z * half * sgn;
        positions.push(x, this.valleyHeight(x, z) + 0.8, z);
      }
      if (i < N) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ color: '#b39a72', emissive: '#3a2a1a', side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 });
    return new THREE.Mesh(geo, mat);
  }

  // Cinta de terra que marca el sender.
  buildPath() {
    const N = 900, half = 1.15, LAT = 6;
    const pts = curve.getSpacedPoints(N);
    const positions = [], uvs = [], colors = [], index = [];
    const base = new THREE.Color('#7d6e57'), dark = new THREE.Color('#5c503f');
    const c = new THREE.Color();
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const t = curve.getTangentAt(u).setY(0).normalize();
      const n = new THREE.Vector3(-t.z, 0, t.x);
      const w = half * (1 + noise.noise(u * 40, 3) * 0.18);
      for (let k = 0; k <= LAT; k++) {
        const s = (k / LAT) * 2 - 1;
        const x = pts[i].x + n.x * w * s, z = pts[i].z + n.z * w * s;
        positions.push(x, this.heightAt(x, z) + 0.09, z);
        uvs.push(k / LAT, u * 120);
        c.copy(base).lerp(dark, Math.abs(s) ** 3 * 0.45 + noise.noise(u * 30, s * 2) * 0.12);
        colors.push(c.r, c.g, c.b);
      }
      if (i < N) {
        const R = LAT + 1, a = i * R;
        for (let k = 0; k < LAT; k++) {
          const p = a + k;
          index.push(p, p + 1, p + R, p + 1, p + R + 1, p + R);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }
}
