import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

// Animals amb models animats (Quaternius CC0 i Sherkiz CC-BY, vegeu public/models/animals/CREDITS.txt).
// API comuna: root, focus (on apunta la càmera), update(dt, ctx), setAlert(bool), flee(dir), done

const DEFS = {
  stag: { file: 'stag.glb', height: 2.35, yaw: 0, focusBone: 'Head' },
  wolf: { file: 'wolf.glb', length: 1.55, yaw: 0, focusBone: 'Head' },
  hawk: { file: 'hawk.glb', span: 1.9, yaw: Math.PI, focusBone: 'head' }, // el model mira cap enrere
};

export async function loadAnimals(manager) {
  const loader = new GLTFLoader(manager);
  const out = {};
  await Promise.all(Object.entries(DEFS).map(async ([key, def]) => {
    const gltf = await loader.loadAsync(`/models/animals/${def.file}`);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.frustumCulled = false; // els SkinnedMesh es mouen fora de la seva caixa
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        m.roughness = 0.85; m.metalness = 0;
        if (key === 'wolf' && m.color) m.color.multiplyScalar(0.8).lerp(new THREE.Color('#4a4f55'), 0.25);
      }
    });
    out[key] = { ...def, gltf };
  }));
  return out;
}

const damp = (a, b, k, dt) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-k * dt));
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

class GltfAnimal {
  constructor(asset) {
    this.root = new THREE.Group();
    this.model = cloneSkinned(asset.gltf.scene);
    this.inner = new THREE.Group();
    this.inner.add(this.model);
    this.root.add(this.inner);
    this.mixer = new THREE.AnimationMixer(this.model);
    this.clips = {};
    for (const c of asset.gltf.animations) this.clips[c.name.split('|').pop()] = c;
    this.actions = {};
    this.current = null;
    this.alert = false;
    this.fleeing = false;
    this.done = false;
    this.t = Math.random() * 10;
    this.fleeT = 0;
    this.speed = 0;
    this.model.updateMatrixWorld(true);

    // Normalitza la mida i posa els peus a terra
    const box = new THREE.Box3().setFromObject(this.model, true);
    const size = box.getSize(new THREE.Vector3());
    let s = 1;
    if (asset.height) s = asset.height / size.y;
    if (asset.length) s = asset.length / Math.max(size.x, size.z);
    if (asset.span) s = asset.span / Math.max(size.x, size.z);
    this.inner.scale.setScalar(s);
    this.inner.rotation.y = asset.yaw;
    this.inner.position.y = -box.min.y * s;

    this.focus = this.model.getObjectByName(asset.focusBone) || this.model;
    this.headBone = this.model.getObjectByName('Neck3') || this.model.getObjectByName('Neck2') || null;
  }

  play(name, { fade = 0.5, loop = true, timeScale = 1 } = {}) {
    const clip = this.clips[name];
    if (!clip || this.current === name) return;
    const a = this.actions[name] || (this.actions[name] = this.mixer.clipAction(clip));
    a.reset();
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    a.clampWhenFinished = !loop;
    a.timeScale = timeScale;
    a.enabled = true;
    a.fadeIn(fade).play();
    if (this.current && this.actions[this.current]) this.actions[this.current].fadeOut(fade);
    this.current = name;
  }

  setAlert(v) { this.alert = v; }
  flee(dir) {
    if (this.fleeing) return;
    this.fleeing = true;
    this.fleeT = 0;
    this.fleeDir = dir.clone().setY(0).normalize();
  }
  hide() { this.root.visible = false; this.done = true; }

  // Gira el coll cap a la càmera (després de l'animació)
  lookAt(camPos, amount) {
    if (!this.headBone) return;
    const p = this.root.worldToLocal(camPos.clone());
    const yaw = THREE.MathUtils.clamp(Math.atan2(p.x, p.z), -1.1, 1.1) * amount;
    this._look = damp(this._look || 0, yaw, 4, this._dt || 0.016);
    if (Math.abs(this._look) < 0.001) return;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this._look * 0.6);
    this.headBone.quaternion.premultiply(q);
  }

  run(dt, ctx, maxSpeed) {
    this.fleeT += dt;
    this.speed = damp(this.speed, maxSpeed, 2.5, dt);
    const heading = Math.atan2(this.fleeDir.x, this.fleeDir.z);
    this.root.rotation.y = damp(this.root.rotation.y, this.root.rotation.y + wrapAngle(heading - this.root.rotation.y), 5, dt);
    const fwd = new THREE.Vector3(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y));
    this.root.position.addScaledVector(fwd, this.speed * dt);
    this.root.position.y = ctx.heightAt(this.root.position.x, this.root.position.z);
  }
}

// ───────────────────────── Cérvol mascle: pastura, aixeca el cap i et mira, fuig al galop
export class Stag extends GltfAnimal {
  constructor(asset) { super(asset); this.play('Idle', { fade: 0 }); this.nextIdle = 4; }
  update(dt, ctx) {
    this._dt = dt;
    this.t += dt;
    if (this.fleeing) {
      this.play('Gallop', { fade: 0.25, timeScale: 1.1 });
      this.run(dt, ctx, 10);
      if (this.fleeT > 3.6) this.hide();
    } else if (this.alert) {
      this.play('Idle_2', { fade: 0.6 });
    } else if (this.t > this.nextIdle) {
      this.nextIdle = this.t + 5 + Math.random() * 4;
      this.play(this.current === 'Eating' ? 'Idle' : 'Eating', { fade: 0.8 });
    }
    this.mixer.update(dt);
    if (!this.fleeing) this.lookAt(ctx.camPos, this.alert ? 1 : 0);
  }
}

// ───────────────────────── Llop: beu a l'estany, aixeca el cap i se'n va
export class Wolf extends GltfAnimal {
  constructor(asset) { super(asset); this.play('Eating', { fade: 0 }); }
  update(dt, ctx) {
    this._dt = dt;
    this.t += dt;
    if (this.fleeing) {
      this.play(this.fleeT < 0.5 ? 'Walk' : 'Gallop', { fade: 0.35 });
      this.run(dt, ctx, this.fleeT < 0.5 ? 2 : 9);
      if (this.fleeT > 3.4) this.hide();
    } else {
      this.play(this.alert ? 'Idle' : 'Eating', { fade: 0.7 });
    }
    this.mixer.update(dt);
    if (!this.fleeing) this.lookAt(ctx.camPos, this.alert ? 1 : 0);
  }
}

// ───────────────────────── Aligot: plana en cercles sobre el prat i s'enlaira cap als núvols
export class Hawk extends GltfAnimal {
  constructor(asset) {
    super(asset);
    this.play('Fly', { fade: 0, timeScale: 0.42 });
    this.center = new THREE.Vector3();
    this.radius = 7;
    this.angle = Math.random() * 6.28;
  }
  setOrbit(center, radius) { this.center.copy(center); this.radius = radius; this.place(0); }
  place(dt) {
    // Gira en sentit antihorari; el cos apunta en la direcció del moviment
    this.angle += (this.alert ? 0.26 : 0.4) * dt;
    const a = this.angle;
    const bob = Math.sin(this.t * 0.7) * 0.6;
    this.root.position.set(this.center.x + Math.cos(a) * this.radius, this.center.y + bob, this.center.z + Math.sin(a) * this.radius);
    this.root.rotation.set(0, Math.atan2(-Math.sin(a), Math.cos(a)), 0);
    this.inner.rotation.z = dt ? damp(this.inner.rotation.z, -0.75, 3, dt) : -0.75; // inclinat dins el gir
  }
  update(dt) {
    this.t += dt;
    if (this.fleeing) {
      this.fleeT += dt;
      const k = Math.min(1, this.fleeT / 1.2);
      this.actions.Fly.timeScale = damp(this.actions.Fly.timeScale, 1.4, 3, dt);
      const heading = Math.atan2(this.fleeDir.x, this.fleeDir.z);
      this.root.rotation.y = damp(this.root.rotation.y, this.root.rotation.y + wrapAngle(heading - this.root.rotation.y), 2.5, dt);
      this.inner.rotation.z = damp(this.inner.rotation.z, 0, 3, dt);
      this.inner.rotation.x = damp(this.inner.rotation.x, -0.25, 2, dt);
      const fwd = new THREE.Vector3(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y));
      this.root.position.addScaledVector(fwd, (5 + 9 * k) * dt);
      this.root.position.y += (1.5 + 4 * k) * dt;
      if (this.fleeT > 5) this.hide();
    } else {
      this.place(dt);
    }
    this.mixer.update(dt);
  }
}

export const ANIMALS = { stag: Stag, wolf: Wolf, hawk: Hawk };
