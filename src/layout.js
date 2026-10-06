import * as THREE from 'three';

// Traçat del sender (x, z). La càmera el recorre de principi a fi.
export const PATH_POINTS = [
  [0, 12], [1, -4], [-3, -20], [-9, -36], [-8, -52], [-1, -66], [8, -80],
  [12, -96], [8, -112], [-2, -126], [-10, -140], [-12, -156], [-6, -172],
  [3, -186], [8, -200], [7, -216],
];

export const curve = new THREE.CatmullRomCurve3(
  PATH_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  false,
  'centripetal',
);

const UP = new THREE.Vector3(0, 1, 0);

export function frameAt(u) {
  const p = curve.getPointAt(u);
  const t = curve.getTangentAt(u).setY(0).normalize();
  const n = new THREE.Vector3().crossVectors(t, UP).normalize(); // dreta
  return { p, t, n };
}

const at = (f, fwd, side) => f.p.clone().addScaledVector(f.t, fwd).addScaledVector(f.n, side);

// Posició (en planta) de cada parada. Les alçades les posa el terreny.
export function buildLayout() {
  const deerF = frameAt(0.16);
  const birdF = frameAt(0.4);
  const pondF = frameAt(0.63);
  const startF = frameAt(0);
  const endF = frameAt(1);

  const heroTree = at(deerF, 6.5, 3.2);
  const pond = { center: at(pondF, 3, 8.6), radius: 6.5 };
  const toCamPond = pondF.p.clone().sub(pond.center).setY(0).normalize();

  return {
    stops: {
      about: { u: 0.16, cam: deerF.p, heroTree },
      projects: {
        u: 0.4,
        cam: birdF.p,
        orbit: at(birdF, 17, -2),
        sky: at(birdF, 70, -14),
        meadow: { center: at(birdF, 38, -6), radius: 32 },
      },
      letter: {
        u: 0.63,
        cam: pondF.p,
        pond,
        pad: pond.center.clone().addScaledVector(toCamPond, pond.radius - 1.1),
        text: pond.center.clone().addScaledVector(toCamPond, 1.2),
        // el llop beu a la vora, una mica de costat respecte de la càmera
        wolf: pond.center.clone().addScaledVector(toCamPond.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.62), pond.radius + 0.35),
      },
    },
    pond,
    // Cartell d'inici del sender (el que veus en entrar)
    intro: { u: 0, cam: startF.p, sign: at(startF, 4.6, 2.1) },
    // Mirador al cim, just abans del penya-segat
    mirador: { center: at(endF, 1.2, 0), dir: endF.t.clone(), side: endF.n.clone() },
  };
}

// Distància mínima d'un punt (x, z) al sender, amb una graella per anar ràpid.
const SAMPLES = 900;
const pathSamples = curve.getSpacedPoints(SAMPLES);
const CELL = 10;
const grid = new Map();
for (const s of pathSamples) {
  const k = `${Math.floor(s.x / CELL)},${Math.floor(s.z / CELL)}`;
  if (!grid.has(k)) grid.set(k, []);
  grid.get(k).push(s);
}

export function distToPath(x, z, maxRange = 40) {
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  const r = Math.ceil(maxRange / CELL);
  let best = Infinity;
  for (let i = -r; i <= r; i++) {
    for (let j = -r; j <= r; j++) {
      const list = grid.get(`${cx + i},${cz + j}`);
      if (!list) continue;
      for (const s of list) {
        const d = (s.x - x) ** 2 + (s.z - z) ** 2;
        if (d < best) best = d;
      }
    }
  }
  return Math.min(Math.sqrt(best), maxRange + 1);
}
