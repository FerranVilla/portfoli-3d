import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// Gradació cinematogràfica: menys saturació, ombres fredes, llums càlides, vinyeta i gra.
// S'aplica en espai lineal, abans del ton filmic (OutputPass).
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uSaturation: { value: 0.86 },
    uContrast: { value: 1.08 },
    uVignette: { value: 0.42 },
    uGrain: { value: 0.035 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uSaturation, uContrast, uVignette, uGrain;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSaturation);
      // split-toning: ombres cap al blau-verd, llums cap a l'ambre
      vec3 shadowTint = vec3(0.92, 1.0, 1.06), highTint = vec3(1.07, 1.0, 0.9);
      c *= mix(shadowTint, highTint, smoothstep(0.05, 0.6, l));
      // contrast al voltant del gris mig (en lineal ~0.18)
      c = max(vec3(0.0), (c - 0.18) * uContrast + 0.18);
      vec2 q = vUv - 0.5;
      c *= 1.0 - uVignette * smoothstep(0.25, 0.85, dot(q, q) * 2.2);
      c += (h(vUv * 1000.0 + fract(uTime) * 61.0) - 0.5) * uGrain * (0.3 + l);
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export function createPost(renderer, scene, camera, { bloom }) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 2 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  let bloomPass = null;
  if (bloom) {
    bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.32, 0.7, 0.92);
    composer.addPass(bloomPass);
  }
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  return {
    composer,
    grade,
    render(time) { grade.uniforms.uTime.value = time; composer.render(); },
    setSize(w, h) { composer.setSize(w, h); },
    setPixelRatio(r) { composer.setPixelRatio(r); },
    dropBloom() { if (bloomPass) { bloomPass.enabled = false; } },
  };
}

// Partícules de pols i pol·len que suren a la llum, al voltant de la càmera
export function createMotes(count) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 30;
    pos[i * 3 + 1] = Math.random() * 8;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 30;
    seed[i] = Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uScale: { value: 1 } },
    vertexShader: `
      attribute float seed; uniform float uTime; uniform vec3 uCam; uniform float uScale; varying float vA;
      void main(){
        vec3 p = position;
        p.x += sin(uTime * 0.21 + seed * 40.0) * 1.2;
        p.y += sin(uTime * 0.13 + seed * 17.0) * 0.8 + uTime * 0.05 * (0.5 + seed);
        p.z += cos(uTime * 0.17 + seed * 23.0) * 1.2;
        // embolcalla les partícules en una capsa de 30 m al voltant de la càmera
        vec3 rel = mod(p - uCam + vec3(15.0, 0.0, 15.0), vec3(30.0, 8.0, 30.0)) - vec3(15.0, 0.0, 15.0);
        vec3 w = uCam + rel - vec3(0.0, 1.5, 0.0);
        vec4 mv = modelViewMatrix * vec4(w, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (2.0 + seed * 3.0) * uScale * (12.0 / -mv.z);
        vA = (0.35 + 0.65 * sin(uTime * 0.8 + seed * 30.0) * 0.5 + 0.5) * smoothstep(30.0, 6.0, -mv.z);
      }`,
    fragmentShader: `
      varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vA * 0.55;
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.6) * a, a);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}
