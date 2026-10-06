import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

export const MODEL_NAMES = [
  'PineTree_1', 'PineTree_2', 'PineTree_5',
  'BirchTree_1', 'BirchTree_5',
  'MapleTree_1', // l'arbre gegant de «Sobre mi»
  'Rock_1', 'Rock_2', 'Rock_3', 'Rock_5',
  'Plant_1', 'Plant_2',
  'Grass_Large', 'Grass_Small',
];

// material de l'OBJ → textura, si és fulla (retall amb alfa + vent) i gradació de color.
// sat: saturació (1 = original) · tint: multiplicador · recolor: color nou a partir de la lluminància
const MATERIALS = {
  BirchTree_Bark: { map: 'BirchTree_Bark.jpg', sat: 0.6, tint: [0.78, 0.76, 0.72] },
  BirchTree_Leaves: { map: 'BirchTree_Leaves.png', leaf: true, recolor: [0.42, 0.52, 0.27] },
  MapleTree_Bark: { map: 'MapleTree_Bark.jpg', sat: 0.6, tint: [0.7, 0.66, 0.62] },
  MapleTree_Leaves: { map: 'MapleTree_Leaves.png', leaf: true, recolor: [0.3, 0.42, 0.2] },
  PineTree_Bark: { map: 'PineTree_Bark.jpg', sat: 0.6, tint: [0.7, 0.66, 0.62] },
  PineTree_Leaves: { map: 'PineTree_Leaves.png', leaf: true, sat: 0.6, tint: [0.55, 0.64, 0.52] },
  Flowers: { map: 'Flowers.png', leaf: true, sat: 0.4, tint: [0.7, 0.72, 0.6] },
  Grass: { map: 'Grass.png', leaf: true, noAlpha: true, sat: 0.55, tint: [0.66, 0.68, 0.5] },
  Rock: { map: 'Rocks.jpg', sat: 0.55, tint: [0.72, 0.74, 0.7] },
};

function gradeGLSL(def) {
  const v = (a) => `vec3(${a.map((x) => x.toFixed(3)).join(',')})`;
  if (def.recolor) {
    return `{ float l = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
      diffuseColor.rgb = ${v(def.recolor)} * (0.3 + l * 1.15); }`;
  }
  const sat = (def.sat ?? 1).toFixed(3);
  return `{ float l = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
    diffuseColor.rgb = mix(vec3(l), diffuseColor.rgb, ${sat}) * ${v(def.tint || [1, 1, 1])}; }`;
}

export const windUniform = { value: 0 };

function setupMaterial(material, def, wind) {
  const grade = gradeGLSL(def);
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
${grade}`);
    if (!wind) return;
    const { strength, from } = wind;
    shader.uniforms.uWind = windUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec4 wp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp;
          #endif
          wp = modelMatrix * wp;
          float k = max(position.y - ${from.toFixed(2)}, 0.0) * ${strength.toFixed(3)};
          float w = sin(uWind * 1.7 + wp.x * 0.35 + wp.z * 0.21) + 0.5 * sin(uWind * 3.1 + wp.z * 0.6);
          transformed.x += w * k;
          transformed.z += cos(uWind * 1.3 + wp.x * 0.3) * k * 0.6;
        }`);
  };
  material.customProgramCacheKey = () => 'nat-' + (wind ? wind.strength : 0) + grade;
}

export async function loadAssets(manager, maxAniso) {
  const texLoader = new THREE.TextureLoader(manager);
  const objLoader = new OBJLoader(manager);
  const materials = {};

  for (const [name, def] of Object.entries(MATERIALS)) {
    const map = texLoader.load(`/textures/${def.map}`);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = maxAniso;
    const m = new THREE.MeshLambertMaterial({ map });
    let wind = null;
    if (def.leaf) {
      if (!def.noAlpha) m.alphaTest = 0.45;
      m.side = THREE.DoubleSide;
      const small = name === 'Grass' || name === 'Flowers' || name === 'Bush_Leaves';
      wind = { strength: small ? 0.14 : 0.016, from: small ? 0.0 : 1.0 };
    }
    setupMaterial(m, def, wind);
    m.name = name;
    materials[name] = m;
  }
  const fallback = new THREE.MeshLambertMaterial({ color: '#888' });
  const pick = (m) => materials[m.name] || fallback;

  const models = {};
  await Promise.all(MODEL_NAMES.map((name) => new Promise((resolve, reject) => {
    objLoader.load(`/models/${name}.obj`, (group) => {
      const parts = [];
      group.traverse((o) => {
        if (!o.isMesh) return;
        o.material = Array.isArray(o.material) ? o.material.map(pick) : pick(o.material);
        o.geometry.computeBoundingBox();
        parts.push(o);
      });
      const box = new THREE.Box3().setFromObject(group);
      models[name] = { group, parts, box };
      resolve();
    }, undefined, reject);
  })));

  return { models, materials };
}
