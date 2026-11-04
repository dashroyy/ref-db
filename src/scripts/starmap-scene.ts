// The 3D star map (concept): the three.js scene, the camera, picking, the floating labels and the warp.
// Data from src/lib/starmap.ts; the HUD markup is in src/components/hud/StarMap.astro.
// Governance as the rest of the HUD: no orbit motion and no warp under PAUSE MOTION or reduced motion; rendering
// stops while the tab is hidden or the map is off screen; any failure leaves the plain index of phases and zones.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { MapData, MapMoon, MapPlanet } from '../lib/starmap';

THREE.ColorManagement.enabled = false;
const PI = Math.PI, TAU = 2 * PI;

// ---------------------------------------------------------------------------------------------------------------
// Shaders

const NOISE = /* glsl */ `
float hash1(vec3 p){ p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash1(i), hash1(i + vec3(1,0,0)), f.x), mix(hash1(i + vec3(0,1,0)), hash1(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash1(i + vec3(0,0,1)), hash1(i + vec3(1,0,1)), f.x), mix(hash1(i + vec3(0,1,1)), hash1(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.02 + vec3(17.1, 3.7, 9.2); a *= 0.5; } return s; }
// cellular noise: nearest and second-nearest distance, and a random value for the nearest cell
vec3 vor(vec3 x){ vec3 n = floor(x), f = fract(x); float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec3 g = vec3(float(i), float(j), float(k));
    vec3 o = vec3(hash1(n + g), hash1(n + g + 19.19), hash1(n + g + 47.3));
    vec3 r = g + o - f; float d = dot(r, r);
    if (d < d1){ d2 = d1; d1 = d; id = hash1(n + g + 3.7); } else if (d < d2) d2 = d; }
  return vec3(sqrt(d1), sqrt(d2), id); }
const float PI = 3.14159265;
`;

const VERT = /* glsl */ `
varying vec3 vObj; varying vec3 vWN; varying vec3 vWP;
void main(){ vObj = position; vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz;
  vWN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * wp; }
`;

// diffuse with a soft terminator, specular, emission, and a rim of the body's colour that brightens on hover
const SHADE = /* glsl */ `
vec3 shade(vec3 alb, vec3 emis, float spec, float sp, vec3 N, vec3 L, vec3 V, vec3 rimCol, float hover, float day){
  float lit = max(dot(N, L), 0.0);
  vec3 H = normalize(L + V);
  float s = pow(max(dot(N, H), 0.0), sp) * spec * day;
  vec3 col = alb * (0.1 + 1.02 * lit) + vec3(s) + emis;
  float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);
  return col + rimCol * fres * (0.12 + 0.5 * day + 1.1 * hover);
}
// width of a line in longitude without the seam at ±180°
float lonWidth(vec3 p, float lat){ return length(fwidth(p.xz)) / max(cos(lat), 0.08); }
`;

const PLANET_FRAG = /* glsl */ `
uniform vec3 uCol; uniform vec3 uSun; uniform float uTime; uniform float uSeed; uniform float uHover; uniform float uDim; uniform int uMotif;
varying vec3 vObj; varying vec3 vWN; varying vec3 vWP;
${NOISE}
${SHADE}
void main(){
  vec3 p = normalize(vObj);
  vec3 N = normalize(vWN), L = normalize(uSun - vWP), V = normalize(cameraPosition - vWP);
  float day = smoothstep(-0.12, 0.25, dot(N, L));
  float lat = asin(clamp(p.y, -1.0, 1.0)), lon = atan(p.z, p.x);
  vec3 lite = mix(uCol, vec3(1.0), 0.35);
  vec3 alb = uCol * 0.5, emis = vec3(0.0); float spec = 0.15, sp = 24.0;
  if (uMotif == 0) {            // ORIENT: oceans, continents, clouds and a survey graticule
    float h = fbm(p * 2.1 + uSeed);
    float land = smoothstep(0.5, 0.53, h);
    vec3 ocean = mix(uCol * 0.14, uCol * 0.42, smoothstep(0.25, 0.5, h));
    alb = mix(ocean, mix(uCol * 0.55, lite * 0.85, fbm(p * 6.0 + uSeed)), land);
    spec = (1.0 - land) * 0.7; sp = 60.0;
    float c = smoothstep(0.56, 0.82, fbm(p * 2.8 + vec3(uTime * 0.012, 0.0, uTime * 0.006) + 4.0));
    alb = mix(alb, vec3(0.9, 0.94, 1.0), c * 0.6);
    float gl = lat / (PI / 12.0), go = lon / (PI / 12.0);
    float dl = abs(fract(gl + 0.5) - 0.5) / max(fwidth(gl), 1e-4);
    float dg = abs(fract(go + 0.5) - 0.5) / max(lonWidth(p, lat) / (PI / 12.0), 1e-4);
    emis += lite * (1.0 - min(min(dl, dg), 1.0)) * 0.26 * (0.35 + 0.65 * day);
  } else if (uMotif == 1) {     // SELECT: crystal facets that glint
    vec3 v = vor(p * 4.5 + uSeed);
    float edge = 1.0 - smoothstep(0.0, 0.07, v.y - v.x);
    alb = mix(uCol * 0.4, lite, 0.25 + 0.75 * v.z);
    alb = mix(alb, uCol * 0.08, edge * 0.85);
    emis += lite * edge * 0.22;
    N = normalize(N + (vec3(hash1(vec3(v.z * 91.0)), hash1(vec3(v.z * 37.0)), hash1(vec3(v.z * 53.0))) - 0.5) * 0.45);
    spec = 1.1; sp = 120.0;
  } else if (uMotif == 2) {     // SIZE: a hot world, cracked crust over glowing seams
    float h = fbm(p * 2.4 + uSeed);
    float r = 1.0 - abs(2.0 * fbm(p * 3.6 + uSeed + 7.0) - 1.0);
    float crack = smoothstep(0.84, 0.97, r);
    alb = mix(vec3(0.07, 0.045, 0.04), uCol * 0.32, h);
    emis += mix(uCol, vec3(1.0, 0.78, 0.35), 0.45) * crack * (0.9 + 0.35 * sin(uTime * 1.2 + h * 14.0)) * 1.25;
    emis += uCol * smoothstep(0.6, 0.9, r) * 0.12;
    spec = 0.1;
  } else if (uMotif == 3) {     // VERIFY: a finite-element mesh, and a scan band that sweeps
    float h = fbm(p * 2.0 + uSeed);
    alb = mix(uCol * 0.16, uCol * 0.55, h);
    vec2 s = vec2(lon + 0.5 * lat, lat) * (12.0 / PI);
    vec2 f = fract(s);
    float d = min(min(min(f.x, f.y), min(1.0 - f.x, 1.0 - f.y)), abs(f.x - f.y) * 0.7071);
    float w = (lonWidth(p, lat) + fwidth(lat)) * (12.0 / PI);
    emis += lite * (1.0 - smoothstep(0.0, w, d)) * 0.24 * (0.3 + 0.7 * day);
    emis += lite * exp(-pow((lat - sin(uTime * 0.32) * 1.25) / 0.05, 2.0)) * 0.85;
    spec = 0.3; sp = 40.0;
  } else if (uMotif == 4) {     // DETAIL: contour lines, every fifth one stronger
    float h = fbm(p * 2.2 + uSeed);
    alb = mix(uCol * 0.2, mix(uCol, vec3(1.0), 0.15), smoothstep(0.2, 0.8, h));
    float c = h * 22.0;
    float iso = 1.0 - min(abs(fract(c + 0.5) - 0.5) / max(fwidth(c), 1e-4), 1.0);
    float major = 1.0 - step(0.5, mod(floor(c + 0.5), 5.0));
    emis += lite * iso * (0.22 + 0.3 * major) * (0.35 + 0.65 * day);
    alb = mix(alb, uCol * 0.1, iso * 0.4);
    spec = 0.2;
  } else if (uMotif == 5) {     // FEATURES: bands that wind round like a thread
    float t = fbm(p * 3.0 + uSeed);
    float b = sin(lat * 18.0 + lon + t * 2.0 + uTime * 0.05);
    alb = mix(uCol * 0.22, mix(uCol, vec3(1.0), 0.28), 0.5 + 0.5 * b);
    alb *= 0.88 + 0.12 * sin(lat * 46.0 + 2.0 * lon + t * 3.0);
    alb *= 0.85 + 0.3 * fbm(p * 7.0 + vec3(uTime * 0.02, 0.0, 0.0));
    spec = 0.25; sp = 30.0;
  } else if (uMotif == 6) {     // MAKE: an industrial world: works lit on the night side
    float h = fbm(p * 2.6 + uSeed);
    alb = mix(uCol * 0.1, uCol * 0.42, h);
    vec3 v = vor(p * 10.0 + uSeed);
    float lights = (1.0 - smoothstep(0.0, 0.16, v.x)) * step(0.55, v.z) * smoothstep(0.42, 0.6, fbm(p * 3.2 + uSeed + 9.0));
    emis += vec3(1.0, 0.76, 0.45) * lights * (1.0 - day) * 1.6;
    emis += mix(uCol, vec3(1.0, 0.6, 0.9), 0.3) * (1.0 - smoothstep(0.0, 0.05, abs(fbm(p * 5.0 + uSeed + 2.0) - 0.5))) * 0.12;
    spec = 0.35; sp = 50.0;
  } else {                      // SPECIFY: plated like drawing sheets, some with a frame
    vec2 uv = vec2(lon, lat) * (8.0 / PI);
    vec2 f = fract(uv), id = floor(uv);
    float r = hash1(vec3(id, uSeed));
    alb = mix(uCol * 0.32, mix(uCol, vec3(1.0), 0.25), 0.3 + 0.35 * r) * (0.85 + 0.3 * fbm(p * 6.0 + uSeed));
    vec2 w = vec2(lonWidth(p, lat), fwidth(lat)) * (8.0 / PI);
    vec2 e = min(f, 1.0 - f) / max(w, vec2(1e-4));
    alb = mix(alb, uCol * 0.06, (1.0 - min(min(e.x, e.y), 1.0)) * 0.85);
    vec2 g = abs(f - 0.5);
    float frame = step(0.8, r) * (1.0 - min(abs(max(g.x, g.y) - 0.36) / max(max(w.x, w.y), 1e-4), 1.0));
    emis += lite * frame * 0.45;
    spec = 0.35; sp = 40.0;
  }
  gl_FragColor = vec4(shade(alb, emis, spec, sp, N, L, V, uCol, uHover, day) * uDim, 1.0);
}
`;

const MOON_FRAG = /* glsl */ `
uniform vec3 uCol; uniform vec3 uSun; uniform float uTime; uniform float uSeed; uniform float uHover; uniform float uV2; uniform float uDim; uniform int uMotif;
varying vec3 vObj; varying vec3 vWN; varying vec3 vWP;
${NOISE}
${SHADE}
void main(){
  vec3 p = normalize(vObj);
  vec3 N = normalize(vWN), L = normalize(uSun - vWP), V = normalize(cameraPosition - vWP);
  float day = smoothstep(-0.1, 0.25, dot(N, L));
  float lat = asin(clamp(p.y, -1.0, 1.0)), lon = atan(p.z, p.x);
  vec3 base = mix(vec3(0.52), uCol, 0.3 + 0.5 * uV2);   // v1 moons are greyer
  vec3 lite = mix(base, vec3(1.0), 0.35);
  float h = fbm(p * 3.0 + uSeed);
  vec3 alb = mix(base * 0.35, base * 0.9, h), emis = vec3(0.0); float spec = 0.1, sp = 20.0;
  vec3 cv = vor(p * 3.5 + uSeed);                      // craters on every moon
  float pit = smoothstep(0.32, 0.18, cv.x) * step(0.6, cv.z);
  alb *= 1.0 - pit * 0.3;
  alb += smoothstep(0.3, 0.34, cv.x) * smoothstep(0.42, 0.34, cv.x) * step(0.6, cv.z) * 0.06;
  if (uMotif == 1) {            // ice
    alb = mix(vec3(0.72, 0.84, 0.94), vec3(0.95, 0.98, 1.0), h);
    vec3 v = vor(p * 5.0 + uSeed); float e = 1.0 - smoothstep(0.0, 0.05, v.y - v.x);
    alb = mix(alb, vec3(0.3, 0.6, 0.82), e * 0.7); emis += vec3(0.4, 0.8, 1.0) * e * 0.15; spec = 0.9; sp = 90.0;
  } else if (uMotif == 2) {     // molten seams
    float c = smoothstep(0.82, 0.96, 1.0 - abs(2.0 * fbm(p * 4.0 + uSeed + 3.0) - 1.0));
    alb = mix(vec3(0.06, 0.05, 0.05), base * 0.3, h);
    emis += mix(vec3(1.0, 0.45, 0.1), vec3(1.0, 0.85, 0.4), c) * c * (1.0 + 0.3 * sin(uTime * 2.0 + h * 10.0));
  } else if (uMotif == 3) {     // crystal
    vec3 v = vor(p * 4.0 + uSeed); float e = 1.0 - smoothstep(0.0, 0.06, v.y - v.x);
    alb = mix(base * 0.5, lite, v.z); alb = mix(alb, base * 0.1, e * 0.8); emis += lite * e * 0.2;
    N = normalize(N + (vec3(hash1(vec3(v.z * 91.0)), hash1(vec3(v.z * 37.0)), hash1(vec3(v.z * 53.0))) - 0.5) * 0.4);
    spec = 1.0; sp = 110.0;
  } else if (uMotif == 4) {     // cracked
    alb = mix(alb, vec3(0.025), smoothstep(0.9, 0.98, 1.0 - abs(2.0 * fbm(p * 5.0 + uSeed) - 1.0)) * 0.9);
  } else if (uMotif == 5) {     // helix
    alb = mix(base * 0.3, lite, 0.5 + 0.5 * sin(lat * 14.0 + lon + h * 2.0)); spec = 0.3;
  } else if (uMotif == 6) {     // panel grid
    vec2 uv = vec2(lon, lat) * (6.0 / PI); vec2 f = fract(uv);
    vec2 w = vec2(lonWidth(p, lat), fwidth(lat)) * (6.0 / PI);
    vec2 e = min(f, 1.0 - f) / max(w, vec2(1e-4)); float g = 1.0 - min(min(e.x, e.y), 1.0);
    alb = mix(alb, base * 0.15, g * 0.6); emis += lite * g * 0.22 * (0.4 + 0.6 * day); spec = 0.5; sp = 50.0;
  } else if (uMotif == 7) {     // electric arcs
    float a = 1.0 - abs(2.0 * fbm(p * 4.0 + vec3(0.0, uTime * 0.9, 0.0) + uSeed) - 1.0);
    emis += vec3(0.55, 0.8, 1.0) * smoothstep(0.93, 0.995, a) * (0.6 + 0.4 * step(0.5, fract(uTime * 3.0 + uSeed))) * 1.4;
  } else if (uMotif == 8) {     // scan line
    emis += lite * exp(-pow((lat - sin(uTime * 0.6 + uSeed) * 1.2) / 0.08, 2.0)) * 0.8;
  } else if (uMotif == 9) {     // haze
    alb = mix(base * 0.55, lite * 0.9, fbm(p * 2.0 + vec3(uTime * 0.03, 0.0, 0.0) + uSeed)); spec = 0.05;
  } else if (uMotif == 10) {    // ripples
    float w = sin(acos(clamp(dot(p, normalize(vec3(0.3, 1.0, 0.2))), -1.0, 1.0)) * 24.0 - uTime * 2.0);
    alb *= 0.85 + 0.15 * w; emis += lite * smoothstep(0.8, 1.0, w) * 0.12;
  }
  gl_FragColor = vec4(shade(alb, emis, spec, sp, N, L, V, mix(base, uCol, 0.5), uHover, day) * uDim, 1.0);
}
`;

const SUN_FRAG = /* glsl */ `
uniform float uTime; uniform float uHover; uniform float uDim;
varying vec3 vObj; varying vec3 vWN; varying vec3 vWP;
${NOISE}
void main(){
  vec3 p = normalize(vObj);
  vec3 N = normalize(vWN), V = normalize(cameraPosition - vWP);
  float t = fbm(p * 3.0 + vec3(0.0, uTime * 0.05, 0.0)) * 0.6 + fbm(p * 9.0 - vec3(uTime * 0.08)) * 0.4;
  vec3 c = mix(vec3(1.0, 0.42, 0.07), vec3(1.0, 0.84, 0.45), t);
  c = mix(c, vec3(1.0, 0.97, 0.86), smoothstep(0.56, 0.8, t));
  c *= 0.9 + 0.16 * smoothstep(0.0, 0.5, vor(p * 24.0 + uTime * 0.03).x);
  float mu = max(dot(N, V), 0.0);
  c *= 0.55 + 0.45 * pow(mu, 0.5);
  c += vec3(1.0, 0.6, 0.2) * pow(1.0 - mu, 3.0) * (0.6 + 0.6 * uHover);
  gl_FragColor = vec4(c * 1.12 * uDim, 1.0);
}
`;

// the glow outside a body: a larger back-facing shell, brightest at the limb and on the sunlit side
const ATMO_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vWP;
void main(){ vN = normalize(normalMatrix * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp; }
`;
const ATMO_FRAG = /* glsl */ `
uniform vec3 uCol; uniform vec3 uSun; uniform vec3 uCenter; uniform float uPow; uniform float uGain; uniform float uHover;
varying vec3 vN; varying vec3 vWP;
void main(){
  float i = pow(max(0.72 - dot(vN, vec3(0.0, 0.0, 1.0)), 0.0), uPow);
  vec3 toSun = uSun - uCenter;
  float side = length(toSun) < 1e-3 ? 1.0 : 0.3 + 0.7 * smoothstep(-0.35, 0.6, dot(normalize(vWP - uCenter), normalize(toSun)));
  gl_FragColor = vec4(uCol * i * uGain * side * (1.0 + 1.2 * uHover), 1.0);
}
`;

// DETAIL's ring: a measuring scale, a tick every 2°, a long one every 10°
const TICK_FRAG = /* glsl */ `
uniform vec3 uCol; uniform float uIn; uniform float uOut;
varying vec3 vObj;
void main(){
  float r = length(vObj.xy), a = atan(vObj.y, vObj.x) * 57.29578;
  float u = (r - uIn) / (uOut - uIn);
  float minor = 1.0 - min(abs(fract(a / 2.0 + 0.5) - 0.5) * 2.0 / max(fwidth(a / 2.0) * 2.0, 1e-4), 1.0);
  float major = 1.0 - min(abs(fract(a / 10.0 + 0.5) - 0.5) * 10.0 / max(fwidth(a) * 1.4, 1e-4), 1.0);
  float edge = 1.0 - min(min(abs(u - 0.02), abs(u - 0.98)) / max(fwidth(u) * 1.2, 1e-4), 1.0);
  float tick = max(minor * step(u, 0.35), major * step(u, 0.75));
  gl_FragColor = vec4(uCol * (tick * 0.55 + edge * 0.5 + 0.035), 1.0);
}
`;

// additive light that leaves the canvas alpha alone: glows add to the page's sky behind the transparent canvas
const ADD = {
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, transparent: true, depthWrite: false,
} as const;

// ---------------------------------------------------------------------------------------------------------------
// Small helpers

const col = (hex: string) => new THREE.Color(hex);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const damp = (dt: number, rate: number) => 1 - Math.exp(-dt * rate);
const angLerp = (a: number, b: number, k: number) => a + ((((b - a) % TAU) + 3 * PI) % TAU - PI) * k;

function radialTexture(stops: [number, string][], size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, s] of stops) gr.addColorStop(o, s);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

function raysTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000'; g.fillRect(0, 0, size, size);
  g.translate(size / 2, size / 2);
  g.globalCompositeOperation = 'lighter';
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 72; i++) {
    const a = rnd() * TAU, len = size * (0.18 + rnd() * 0.32), w = 1 + rnd() * 3;
    const gr = g.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
    gr.addColorStop(0, 'rgba(255,190,120,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.strokeStyle = gr; g.lineWidth = w;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * len, Math.sin(a) * len); g.stroke();
  }
  return new THREE.CanvasTexture(c);
}

function glowSprite(tex: THREE.Texture, color: THREE.Color, scale: number) {
  const m = new THREE.SpriteMaterial({ map: tex, color, ...ADD });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(scale);
  return s;
}

function atmosphere(color: THREE.Color, radius: number, pow: number, gain: number) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG, side: THREE.BackSide, ...ADD,
    uniforms: { uCol: { value: color }, uSun: { value: new THREE.Vector3() }, uCenter: { value: new THREE.Vector3() }, uPow: { value: pow }, uGain: { value: gain }, uHover: { value: 0 } },
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), mat);
  return m;
}

class Helix extends THREE.Curve<THREE.Vector3> {
  constructor(private r: number, private h: number, private turns: number, private y0: number) { super(); }
  getPoint(t: number, target = new THREE.Vector3()) {
    const a = t * this.turns * TAU;
    return target.set(Math.cos(a) * this.r, this.y0 + t * this.h, Math.sin(a) * this.r);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The small topic models that orbit each planet. Built from primitives: no files to load.

function drawingTexture(accent: string) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 360;
  const g = c.getContext('2d')!;
  g.fillStyle = '#071521'; g.fillRect(0, 0, 512, 360);
  g.strokeStyle = accent; g.lineWidth = 3; g.strokeRect(10, 10, 492, 340);
  g.lineWidth = 1.5; g.strokeRect(22, 22, 468, 316);
  g.strokeRect(330, 270, 160, 68); g.beginPath(); g.moveTo(330, 293); g.lineTo(490, 293); g.moveTo(410, 293); g.lineTo(410, 338); g.stroke();
  // a flanged part in section, with hatching, a centre line and two dimensions
  g.lineWidth = 2.2; g.strokeStyle = '#d8e6f0';
  g.beginPath(); g.moveTo(80, 110); g.lineTo(260, 110); g.lineTo(260, 90); g.lineTo(300, 90); g.lineTo(300, 230); g.lineTo(260, 230); g.lineTo(260, 210); g.lineTo(80, 210); g.closePath(); g.stroke();
  g.save(); g.beginPath(); g.rect(80, 110, 180, 20); g.rect(80, 190, 180, 20); g.rect(260, 90, 40, 40); g.rect(260, 190, 40, 40); g.clip();
  g.lineWidth = 1; g.strokeStyle = accent;
  for (let x = 40; x < 340; x += 9) { g.beginPath(); g.moveTo(x, 240); g.lineTo(x + 150, 80); g.stroke(); }
  g.restore();
  g.setLineDash([18, 5, 3, 5]); g.strokeStyle = accent; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(60, 160); g.lineTo(320, 160); g.stroke(); g.setLineDash([]);
  const arrow = (x1: number, y1: number, x2: number, y2: number) => {
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    for (const [x, y, dx] of [[x1, y1, 1], [x2, y2, -1]] as const) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8 * dx, y - 4); g.lineTo(x + 8 * dx, y + 4); g.closePath(); g.fill(); }
  };
  g.fillStyle = '#d8e6f0'; g.strokeStyle = '#d8e6f0'; g.lineWidth = 1.2;
  arrow(80, 265, 300, 265); g.font = '600 18px monospace'; g.fillText('220', 172, 258);
  g.save(); g.translate(330, 160); g.rotate(-PI / 2); g.fillText('Ø140', -24, -6); g.restore();
  g.beginPath(); g.moveTo(312, 90); g.lineTo(312, 230); g.stroke();
  g.fillStyle = accent; g.font = '600 15px monospace'; g.fillText('REF·DB', 340, 288); g.fillText('A3  1:2', 418, 322);
  return new THREE.CanvasTexture(c);
}

function gearShape(teeth: number, ro: number, rr: number, bore: number) {
  const s = new THREE.Shape(), n = teeth * 4;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU, k = i % 4, r = k === 1 || k === 2 ? ro : rr;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const hole = new THREE.Path(); hole.absarc(0, 0, bore, 0, TAU, true); s.holes.push(hole);
  return s;
}

/** A topic model: returns the group and a function that animates it. */
function emblem(model: string, accent: THREE.Color, hex: string): { g: THREE.Group; tick: (t: number, planet: THREE.Vector3) => void } {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xc3ccd4, metalness: 0.85, roughness: 0.3 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x4a5058, metalness: 0.8, roughness: 0.45, side: THREE.DoubleSide });
  const glow = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.7, metalness: 0.2, roughness: 0.35 });
  let tick = (_t: number, _p: THREE.Vector3) => {};
  if (model === 'gyro') {
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.11), glow);
    const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.012, 10, 72), steel), r2 = r1.clone(), r3 = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.008, 8, 72), steel);
    r2.rotation.x = PI / 2; r3.rotation.y = PI / 2;
    g.add(core, r1, r2, r3);
    tick = (t) => { r1.rotation.y = t * 0.9; r2.rotation.z = t * 0.6; r3.rotation.x = t * 0.4; core.rotation.y = t * 1.4; };
  } else if (model === 'crystal') {
    const mat = new THREE.MeshStandardMaterial({ color: accent.clone().lerp(new THREE.Color(1, 1, 1), 0.4), emissive: accent, emissiveIntensity: 0.3, metalness: 0.1, roughness: 0.08, flatShading: true, transparent: true, opacity: 0.9 });
    [[0, 0, 0, 1.0], [0.6, 0.2, 0.3, 0.75], [-0.5, 0.1, -0.4, 0.8], [0.2, -0.6, 0.5, 0.6], [-0.3, -0.3, 0.6, 0.55], [0.5, 0.5, -0.5, 0.5]].forEach(([x, y, z, s]) => {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.07 * s), mat);
      m.scale.set(1, 3.2, 1); m.position.set(x * 0.07, y * 0.07, z * 0.07); m.rotation.set(x * 1.2, y * 0.8, z * 1.1);
      g.add(m);
    });
    tick = (t) => { g.rotation.y = t * 0.5; g.rotation.x = Math.sin(t * 0.3) * 0.3; };
  } else if (model === 'motor') {
    const shell = [[0, 0.3], [0.045, 0.296], [0.075, 0.278], [0.09, 0.25], [0.09, -0.16], [0.082, -0.19], [0.06, -0.212], [0.036, -0.226]].map(([x, y]) => new THREE.Vector2(x, y));
    const bell = [[0.036, -0.226], [0.03, -0.24], [0.034, -0.26], [0.05, -0.3], [0.068, -0.35], [0.074, -0.37]].map(([x, y]) => new THREE.Vector2(x, y));
    const caseMesh = new THREE.Mesh(new THREE.LatheGeometry(shell, 48), new THREE.MeshStandardMaterial({ color: 0xd9dee3, metalness: 0.55, roughness: 0.35 }));
    const nozzle = new THREE.Mesh(new THREE.LatheGeometry(bell, 48), darkSteel);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0915, 0.0915, 0.05, 48, 1, true), glow); band.position.y = 0.17;
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.0915, 0.0915, 0.02, 48, 1, true), darkSteel); skirt.position.y = -0.12;
    const throat = glowSprite(radialTexture([[0, 'rgba(255,160,80,1)'], [1, 'rgba(0,0,0,1)']], 64), new THREE.Color(0.5, 0.25, 0.1), 0.12);
    throat.position.y = -0.37;
    const m = new THREE.Group(); m.add(caseMesh, nozzle, band, skirt, throat);
    m.rotation.x = -PI / 2; // nose first: the model's orbit carries it towards local −z
    g.add(m);
    tick = (t) => { m.rotation.y = t * 0.25; };
  } else if (model === 'probe') {
    const foil = new THREE.MeshStandardMaterial({ color: 0xc9a64a, metalness: 0.9, roughness: 0.4 });
    const panel = new THREE.MeshStandardMaterial({ color: 0x1b2a4a, emissive: 0x0a1630, metalness: 0.6, roughness: 0.3 });
    const bus = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.12), foil);
    const wings = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.004, 0.09), panel);
    const dish = new THREE.Mesh(new THREE.LatheGeometry(Array.from({ length: 9 }, (_, i) => new THREE.Vector2(i * 0.011, (i * 0.011) ** 2 * 6)), 32), steel);
    dish.rotation.x = -PI / 2; dish.position.z = 0.07; (dish.material as THREE.Material).side = THREE.DoubleSide;
    const coneGeo = new THREE.ConeGeometry(0.35, 1, 40, 1, true); coneGeo.rotateX(-PI / 2); coneGeo.translate(0, 0, 0.5);
    const beam = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: accent.clone().multiplyScalar(0.16), side: THREE.DoubleSide, ...ADD }));
    const probe = new THREE.Group(); probe.add(bus, wings, dish, beam);
    g.add(probe);
    const tmp = new THREE.Vector3();
    tick = (t, planet) => {
      probe.lookAt(planet);
      const d = probe.getWorldPosition(tmp).distanceTo(planet);
      beam.scale.set(1 + 0.15 * Math.sin(t * 1.7), 1, Math.max(0.1, d * 0.62 / probe.getWorldScale(tmp).x));
    };
  } else if (model === 'gauge') {
    const knurl = new THREE.MeshStandardMaterial({ color: 0x2b2f35, metalness: 0.6, roughness: 0.7 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.22, 24), knurl);
    const go = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 40), steel); go.position.y = 0.16;
    const goBand = new THREE.Mesh(new THREE.CylinderGeometry(0.051, 0.051, 0.012, 40, 1, true), glow); goBand.position.y = 0.115;
    const nogo = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.045, 40), steel); nogo.position.y = -0.135;
    const red = new THREE.Mesh(new THREE.CylinderGeometry(0.053, 0.053, 0.014, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0xd03a2e, emissive: 0x501008, roughness: 0.4 })); red.position.y = -0.112;
    const m = new THREE.Group(); m.add(handle, go, goBand, nogo, red); m.rotation.z = PI / 2;
    g.add(m);
    tick = (t) => { m.rotation.x = t * 0.7; g.rotation.y = Math.sin(t * 0.4) * 0.4; };
  } else if (model === 'bolt') {
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 6), steel); head.position.y = 0.15;
    const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.27, 24), steel);
    const thread = new THREE.Mesh(new THREE.TubeGeometry(new Helix(0.034, 0.17, 10, -0.14), 240, 0.006, 6, false), steel);
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.05, 6), darkSteel); nut.position.y = -0.06;
    const m = new THREE.Group(); m.add(head, shank, thread, nut); m.rotation.set(0.4, 0, 0.9);
    g.add(m);
    tick = (t) => { m.rotation.y = t * 0.8; };
  } else if (model === 'gear') {
    const geo = new THREE.ExtrudeGeometry(gearShape(14, 0.17, 0.14, 0.05), { depth: 0.04, bevelEnabled: true, bevelSize: 0.005, bevelThickness: 0.005, bevelSegments: 1, curveSegments: 12 });
    geo.center();
    const gear = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: accent.clone().lerp(new THREE.Color(0.8, 0.8, 0.85), 0.55), metalness: 0.85, roughness: 0.3 }));
    const hub = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 32), glow);
    const m = new THREE.Group(); m.add(gear, hub); m.rotation.x = 0.5;
    g.add(m);
    tick = (t) => { gear.rotation.z = t * 0.6; hub.rotation.z = t * 0.6; };
  } else if (model === 'sheet') {
    const tex = drawingTexture(hex);
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.324, 0.006), [darkSteel, darkSteel, darkSteel, darkSteel,
      new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.6 }), darkSteel]);
    g.add(sheet);
    tick = (t) => { sheet.rotation.y = Math.sin(t * 0.35) * 0.6; sheet.rotation.x = Math.sin(t * 0.27) * 0.2; };
  }
  return { g, tick };
}

// ---------------------------------------------------------------------------------------------------------------
// The scene

interface MoonObj { data: MapMoon; planet: PlanetObj; mesh: THREE.Mesh; hit: THREE.Mesh; label: HTMLElement; r: number; ring: THREE.Object3D }
interface PlanetObj {
  data: MapPlanet; anchor: THREE.Object3D; body: THREE.Object3D; mesh: THREE.Mesh; atmo: THREE.Mesh; r: number; color: THREE.Color;
  moons: MoonObj[]; rings: THREE.Object3D[]; moonOrbits: THREE.Line[]; label: HTMLElement; emblemPivot: THREE.Object3D; emblemTick: (t: number, p: THREE.Vector3) => void;
  orbitLine: THREE.Line;
}
type Body = { kind: 'sun' } | { kind: 'planet'; p: PlanetObj } | { kind: 'moon'; m: MoonObj };

/** `here`: the zone of the page the map was opened from (a moon key, or 'home'); `close`: close the map. */
export function initStarMap(root: HTMLElement, data: MapData, opts: { here?: string | null; close?: () => void } = {}) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-gl]')!;
  const labels = root.querySelector<HTMLElement>('[data-labels]')!;
  const warpCv = root.querySelector<HTMLCanvasElement>('[data-warp]')!;
  const reticle = root.querySelector<HTMLElement>('[data-reticle]')!;
  const card = root.querySelector<HTMLElement>('[data-card]')!;
  const live = root.querySelector<HTMLElement>('[data-live]')!;
  const doc = document.documentElement;

  // multisampling only where the frame is small enough to afford it (a large window renders below 1 px a pixel anyway)
  const big = innerWidth * innerHeight * Math.min(window.devicePixelRatio || 1, 1.75) ** 2 > 2.2e6;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !big, premultipliedAlpha: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  root.classList.add('sm-gl');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.02, 4000);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  // a soft studio environment so the metal of the topic models reflects something (only the standard materials use it)
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();
  const sunLight = new THREE.PointLight(0xfff1dd, 3.2, 0, 0);
  scene.add(sunLight);

  const calm = () => doc.classList.contains('motion-off') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  let touchMode = false, dirty = true, warped = false;
  const sunPos = new THREE.Vector3();
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

  // --- the sun: the overview
  const sunMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: SUN_FRAG, uniforms: { uTime: { value: 0 }, uHover: { value: 0 }, uDim: { value: 1 } } });
  const SUN_R = 2.5;
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), sunMat);
  sun.scale.setScalar(SUN_R);
  scene.add(sun);
  const glowTex = radialTexture([[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,200,140,0.9)'], [0.45, 'rgba(120,60,20,0.35)'], [1, 'rgba(0,0,0,1)']]);
  const sunGlow = glowSprite(glowTex, new THREE.Color(0.8, 0.5, 0.26), SUN_R * 5.2);
  const sunHalo = glowSprite(glowTex, new THREE.Color(0.16, 0.08, 0.035), SUN_R * 12);
  const rays = glowSprite(raysTexture(), new THREE.Color(0.32, 0.22, 0.13), SUN_R * 7);
  scene.add(sunHalo, sunGlow, rays);

  // --- the plane of the system: faint radial bearings for the map look
  const system = new THREE.Group();
  scene.add(system);
  const grid = new THREE.Group();
  scene.add(grid);
  const gridMat = new THREE.LineBasicMaterial({ color: 0x4fb3c6, transparent: true, opacity: 0.07 });

  // --- planets
  const PLANET_R = [1.15, 1.25, 1.4, 1.25, 1.15, 1.35, 1.2, 1.1];
  const SYS_RING = 1.2; // in the system view the moons close in to one orbit at 1.2 planet radii
  const TILT = [0.28, -0.2, 0.12, 0.35, -0.3, 0.45, -0.15, 0.22];
  const planets: PlanetObj[] = data.planets.map((pd, i) => {
    const color = col(pd.color);
    const r = PLANET_R[i] ?? 1.2;
    const anchor = new THREE.Object3D();
    system.add(anchor);
    const body = new THREE.Object3D(); // tilted; the moons, rings and the model orbit in this frame
    body.rotation.z = TILT[i] ?? 0.2;
    anchor.add(body);
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: PLANET_FRAG, uniforms: {
      uCol: { value: color }, uSun: { value: sunPos }, uTime: { value: 0 }, uSeed: { value: 3.1 + i * 7.3 }, uHover: { value: 0 }, uDim: { value: 1 }, uMotif: { value: i },
    } });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), mat);
    mesh.scale.setScalar(r);
    body.add(mesh);
    const atmo = atmosphere(color, r * 1.16, 3.0, 0.9);
    anchor.add(atmo);
    const rings: THREE.Object3D[] = [];
    if (pd.k === 'feature') { // an O-ring for a planetary ring
      const oring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.9, r * 0.075, 24, 160), new THREE.MeshStandardMaterial({ color: 0x17171c, emissive: color.clone().multiplyScalar(0.05), metalness: 0.0, roughness: 0.42 }));
      oring.rotation.x = PI / 2; body.add(oring); rings.push(oring);
    }
    if (pd.k === 'detail') { // a measuring scale
      const ri = r * 1.55, ro = r * 2.05;
      const ring = new THREE.Mesh(new THREE.RingGeometry(ri, ro, 180, 1), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: TICK_FRAG, side: THREE.DoubleSide, ...ADD,
        uniforms: { uCol: { value: color }, uIn: { value: ri }, uOut: { value: ro } } }));
      ring.rotation.x = PI / 2; body.add(ring); rings.push(ring);
    }
    // the topic model on its own short orbit
    const em = emblem(pd.emblem, color, pd.color);
    const emblemPivot = new THREE.Object3D();
    emblemPivot.rotation.x = 0.42;
    const emDist = r * 2.4; // half-way between the two moon orbits
    em.g.position.set(emDist, 0, 0);
    em.g.scale.setScalar(r * 1.25);
    emblemPivot.add(em.g);
    emblemPivot.scale.setScalar(0); emblemPivot.visible = false;
    body.add(emblemPivot);
    // moons: one ring, or two for a long phase
    // moon orbits equally spaced from the planet and from each other: 1.6r and 3.2r. The inner orbit is half as long,
    // so it takes a third of the moons. A planet with seven moons or fewer uses the outer orbit only.
    const n = pd.moons.length, two = n > 7, inner = two ? Math.round(n / 3) : n;
    const moonOrbits: THREE.Line[] = [];
    const ringDefs = two ? [{ R: r * 1.6, tilt: 0.1, count: inner }, { R: r * 3.2, tilt: -0.07, count: n - inner }] : [{ R: r * 3.2, tilt: 0.08, count: n }];
    const ringObjs = ringDefs.map((d) => {
      const o = new THREE.Object3D(); o.rotation.x = d.tilt; o.userData = d; o.scale.setScalar((r * SYS_RING) / d.R); body.add(o);
      const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 160 }, (_, k) => new THREE.Vector3(Math.cos((k / 160) * TAU) * d.R, 0, Math.sin((k / 160) * TAU) * d.R))),
        new THREE.LineDashedMaterial({ color, dashSize: 0.18, gapSize: 0.12, transparent: true, opacity: 0.18 }));
      line.computeLineDistances(); o.add(line); moonOrbits.push(line);
      const spin = new THREE.Object3D(); o.add(spin); o.userData.spin = spin;
      return o;
    });
    const label = document.createElement('button');
    label.type = 'button'; label.className = 'sm-plabel off'; label.tabIndex = -1;
    label.style.setProperty('--pc', pd.color);
    label.innerHTML = `<b>${String(i + 1).padStart(2, '0')}</b> ${pd.n}<small>${pd.moons.filter((m) => !m.primer).length}</small>`;
    labels.appendChild(label);
    const pObj: PlanetObj = { data: pd, anchor, body, mesh, atmo, r, color, moons: [], rings, moonOrbits, label, emblemPivot, emblemTick: em.tick, orbitLine: null as unknown as THREE.Line };
    let k = 0;
    ringObjs.forEach((o, ri) => {
      const d = o.userData as { R: number; count: number };
      for (let j = 0; j < d.count; j++, k++) {
        const md = pd.moons[k];
        const mr = md.primer ? 0.24 : md.v2 ? 0.28 : 0.22;
        const a = (j / d.count) * TAU + ri * 0.4;
        const holder = new THREE.Object3D(); holder.position.set(Math.cos(a) * d.R, 0, Math.sin(a) * d.R);
        o.userData.spin.add(holder);
        const mm = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: MOON_FRAG, uniforms: {
          uCol: { value: color }, uSun: { value: sunPos }, uTime: { value: 0 }, uSeed: { value: 11.7 + k * 5.13 + i }, uHover: { value: 0 }, uV2: { value: md.v2 ? 1 : 0 }, uDim: { value: 1 }, uMotif: { value: md.motif },
        } });
        const mesh2 = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), mm);
        mesh2.scale.setScalar(mr); holder.add(mesh2);
        if (md.motif === 9) { const a2 = atmosphere(color, mr * 1.35, 2.2, 0.8); holder.add(a2); a2.userData.atmo = true; }
        if (md.key === 'oring') { const t = new THREE.Mesh(new THREE.TorusGeometry(mr * 1.8, mr * 0.12, 12, 48), new THREE.MeshStandardMaterial({ color: 0x1a1a1f, roughness: 0.4 })); t.rotation.x = PI / 2.4; holder.add(t); }
        const hit = new THREE.Mesh(new THREE.SphereGeometry(Math.max(mr * 2.2, 0.42), 8, 6), new THREE.MeshBasicMaterial());
        hit.visible = false; holder.add(hit);
        const lab = document.createElement('a');
        lab.className = 'sm-mlabel off' + (md.v2 ? '' : ' v1') + (md.primer ? ' primer' : '');
        lab.href = md.href; lab.tabIndex = -1;
        lab.style.setProperty('--pc', pd.color);
        lab.innerHTML = `<b>${md.primer ? '✦' : md.tag}</b><span>${md.label}</span>`;
        labels.appendChild(lab);
        const mObj: MoonObj = { data: md, planet: pObj, mesh: mesh2, hit, label: lab, r: mr, ring: o };
        hit.userData.body = { kind: 'moon', m: mObj } satisfies Body;
        pObj.moons.push(mObj);
      }
    });
    mesh.userData.body = { kind: 'planet', p: pObj } satisfies Body;
    return pObj;
  });
  sun.userData.body = { kind: 'sun' } satisfies Body;

  const sunLabel = document.createElement('button');
  sunLabel.type = 'button'; sunLabel.className = 'sm-plabel sun off'; sunLabel.tabIndex = -1;
  sunLabel.innerHTML = `<b>${data.sun.tag}</b> ${data.sun.label}`;
  labels.appendChild(sunLabel);

  // --- layout: the route spirals out from the sun, phase 1 closest. On a tall screen the orbits are ellipses, long
  // down the screen, and the planets travel along them; the camera then looks along their long axis.
  let R0 = 9, SP = 4.2, pScale = 1, K = 1;
  const STEP = (TAU * 0.875) / 8; // the angle between phases along the spiral
  const orbitPoint = (R: number, a: number, v = new THREE.Vector3()) => v.set(Math.cos(a) * R, 0, Math.sin(a) * R * K);
  const orbitGroup = new THREE.Group(); system.add(orbitGroup);
  const route = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0x9fd8e6, dashSize: 0.5, gapSize: 0.5, transparent: true, opacity: 0.16 }));
  system.add(route);
  const ROUTE_N = 200, rv = new THREE.Vector3();
  function placeOrbits(turn: number) {
    planets.forEach((p, i) => orbitPoint(R0 + i * SP, i * STEP + turn, p.anchor.position));
    const pos = route.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos) return;
    for (let k = 0; k <= ROUTE_N; k++) {
      const a = -0.6 + (k / ROUTE_N) * (7 * STEP + 0.6);
      orbitPoint(R0 + (a / STEP) * SP, a + turn, rv); pos.setXYZ(k, rv.x, 0, rv.z);
    }
    pos.needsUpdate = true; route.computeLineDistances();
  }
  function layout() {
    const aspect = renderer.domElement.clientWidth / Math.max(1, renderer.domElement.clientHeight);
    const narrow = aspect < 0.9;
    // planet orbits equally spaced from the sun and from each other: phase i at (i + 1) steps. The step is as small as
    // it can be: phase 1, with its moons in the system view (none on a phone), just clears the sun.
    pScale = narrow ? 2.1 : 1.75; K = narrow ? 2.3 : 1;
    const r0 = PLANET_R[0] * pScale, moon = 0.28 * pScale * (SYS_RING / 1.6);
    SP = SUN_R + (narrow ? r0 * 1.05 : r0 * SYS_RING + moon) + 0.3; R0 = SP;
    for (const o of [...orbitGroup.children, ...grid.children]) (o as THREE.Line).geometry?.dispose();
    orbitGroup.clear(); grid.clear();
    planets.forEach((p, i) => {
      const R = R0 + i * SP;
      p.anchor.scale.setScalar(pScale);
      const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 256 }, (_, k) => orbitPoint(R, (k / 256) * TAU))),
        new THREE.LineDashedMaterial({ color: p.color, dashSize: 0.6, gapSize: 0.45, transparent: true, opacity: 0.28 }));
      line.computeLineDistances(); orbitGroup.add(line); p.orbitLine = line;
    });
    route.geometry.dispose();
    route.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array((ROUTE_N + 1) * 3), 3));
    placeOrbits(t * SYS_RATE);
    const Rmax = R0 + 7 * SP + 3;
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * TAU;
      grid.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([orbitPoint(SUN_R * 1.5, a), orbitPoint(Rmax * (k % 6 === 0 ? 1.12 : 1.04), a)]), gridMat));
    }
    grid.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 256 }, (_, k) => orbitPoint(Rmax * 1.04, (k / 256) * TAU))), gridMat));
  }

  // --- camera: an orbit about a target that eases to each view
  const view = { target: new THREE.Vector3(), dist: 90, theta: -0.9, phi: 1.02 };
  const want = { target: new THREE.Vector3(), dist: 90, theta: -0.9, phi: 1.02 };
  let user = { theta: 0, phi: 0, zoom: 1 };
  type Mode = 'system' | 'planet' | 'sun' | 'warp';
  let mode: Mode = 'system', focus: PlanetObj | null = null;
  const fovBase = 36;

  // The system view: the distance at which the outermost orbit (with a planet on it) fills the free area of the screen,
  // and the shift that centres it there. The free area is below the HUD's top row and above the route strip.
  const fitCam = new THREE.PerspectiveCamera();
  const sysOff = { x: 0, y: 0 };
  // the band of the map between the top bar and the route strip, px; both grow with the text size
  function freeBand() {
    const box = root.getBoundingClientRect();
    const bar = root.querySelector('.sm-top')?.getBoundingClientRect(), strip = root.querySelector('.sm-route')?.getBoundingClientRect();
    return { top: bar ? bar.bottom - box.top + 10 : 110, bottom: strip ? box.bottom - strip.top + 10 : 80 };
  }
  function systemFit(phi: number) {
    const w = Math.max(1, renderer.domElement.clientWidth), h = Math.max(1, renderer.domElement.clientHeight);
    fitCam.fov = fovBase; fitCam.aspect = w / h; fitCam.near = 0.1; fitCam.far = 5000; fitCam.clearViewOffset();
    const phone = w < 700;
    const band = freeBand(), top = band.top, bottom = band.bottom, side = phone ? 12 : 28;
    const aw = w - 2 * side, ah = h - top - bottom;
    const outer = R0 + 7 * SP + 1.2 * pScale;
    const pts = Array.from({ length: 64 }, (_, k) => orbitPoint(outer, (k / 64) * TAU));
    const v = new THREE.Vector3(), th = want.theta + user.theta;
    const box = (D: number) => {
      fitCam.position.set(D * Math.sin(phi) * Math.cos(th), D * Math.cos(phi), D * Math.sin(phi) * Math.sin(th)); fitCam.lookAt(0, 0, 0); fitCam.updateMatrixWorld();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, ok = true;
      for (const p of pts) {
        v.copy(p).project(fitCam); if (v.z >= 1) ok = false;
        const sx = (v.x * 0.5 + 0.5) * w, sy = (-v.y * 0.5 + 0.5) * h;
        x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
      }
      return { ok, x0, x1, y0, y1 };
    };
    let lo = 5, hi = 3000;
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2, b = box(mid);
      if (b.ok && b.x1 - b.x0 <= aw && b.y1 - b.y0 <= ah) hi = mid; else lo = mid;
    }
    const b = box(hi);
    sysOff.x = (b.x0 + b.x1) / 2 - (side + aw / 2); sysOff.y = (b.y0 + b.y1) / 2 - (top + ah / 2);
    return hi;
  }
  function setWant() {
    if (mode === 'system') { want.target.set(0, 0, 0); want.phi = K > 1 ? 0.62 : 1.1; if (K > 1) want.theta = PI / 2; want.dist = systemFit(want.phi + user.phi); }
    else if (mode === 'sun') { want.target.set(0, 0, 0); want.dist = SUN_R * 7.5; want.phi = 0.5; }
    else if (mode === 'planet' && focus) {
      focus.anchor.getWorldPosition(want.target);
      want.phi = 0.8;
      // look down from above, with the sun behind the camera and a little to one side: the planet is lit and the
      // sun stays out of the frame
      want.theta = Math.atan2(-want.target.z, -want.target.x) + 0.4;
      want.dist = focusDist || focus.r * pScale * 10;
    }
  }
  // the distance at which the focused planet's outer moon ring, with room for its labels, fits beside the panel
  let focusDist = 0;
  function focusDistance(p: PlanetObj) {
    const rings = p.body.children.filter((o) => o.userData.spin);
    const outer = rings.sort((a, b) => (b.userData.R as number) - (a.userData.R as number))[0];
    // measure at full size and full spread, whatever the planet is doing now
    const s0 = outer.scale.x, a0 = p.anchor.scale.x;
    outer.scale.setScalar(1); p.anchor.scale.setScalar(pScale); p.anchor.updateMatrixWorld(true);
    const R = outer.userData.R as number;
    const pts = Array.from({ length: 36 }, (_, k) => outer.localToWorld(new THREE.Vector3(Math.cos((k / 36) * TAU) * R, 0, Math.sin((k / 36) * TAU) * R)));
    outer.scale.setScalar(s0); p.anchor.scale.setScalar(a0); p.anchor.updateMatrixWorld(true);
    const target = p.anchor.getWorldPosition(new THREE.Vector3());
    const box = root.getBoundingClientRect(), pr = panel.hidden ? null : panel.getBoundingClientRect();
    const phone = W < 700, lab = phone ? 28 : Math.min(280, Math.max(110, ...p.moons.map((m) => m.label.offsetWidth))) + 8;
    const band = freeBand();
    let x0 = 36 + lab, x1 = W - 36 - lab, y0 = band.top + 14, y1 = H - band.bottom - 14;
    let ox = 0, oy = 0;
    if (pr && !phone) { x0 = pr.right - box.left + 20 + lab; ox = -(pr.right - box.left) / 2; }
    if (pr && phone) { y1 = pr.top - box.top - 8; oy = (box.bottom - pr.top) / 2; }
    fitCam.fov = fovBase; fitCam.aspect = W / H; fitCam.near = 0.1; fitCam.far = 5000; fitCam.setViewOffset(W, H, ox, oy, W, H);
    const theta = Math.atan2(-target.z, -target.x) + 0.4, phi = 0.8, v = new THREE.Vector3();
    const fits = (D: number) => {
      fitCam.position.set(target.x + D * Math.sin(phi) * Math.cos(theta), target.y + D * Math.cos(phi), target.z + D * Math.sin(phi) * Math.sin(theta));
      fitCam.lookAt(target); fitCam.updateMatrixWorld();
      return pts.every((q) => { v.copy(q).project(fitCam); const sx = (v.x * 0.5 + 0.5) * W, sy = (-v.y * 0.5 + 0.5) * H; return v.z < 1 && sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1; });
    };
    let lo = p.r * pScale * 2, hi = 600;
    for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    fitCam.clearViewOffset();
    return hi;
  }

  // --- size
  let W = 0, H = 0, baseDpr = 1, quality = 1;
  function resize() {
    const r = root.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    // at most about 1.8 million pixels, whatever the screen; the loop lowers `quality` further if frames are slow
    baseDpr = Math.min(window.devicePixelRatio || 1, W < 700 ? 1.5 : 1.75, Math.sqrt(1.8e6 / (W * H)));
    const dpr = baseDpr;
    renderer.setPixelRatio(baseDpr * quality); renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    warpCv.width = Math.round(W * Math.min(dpr, 1.5)); warpCv.height = Math.round(H * Math.min(dpr, 1.5));
    layout();
    if (focus && mode === 'planet') focusDist = focusDistance(focus);
    setWant();
    if (mode === 'system') view.dist = want.dist;
    root.classList.toggle('sm-narrow', W < 700);
    dirty = true;
  }

  // --- picking
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(x: number, y: number): Body | null {
    ndc.set((x / W) * 2 - 1, -(y / H) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const targets: THREE.Object3D[] = [sun, ...planets.map((p) => p.mesh)];
    if (mode === 'planet' && focus) targets.push(...focus.moons.map((m) => m.hit));
    const hits = ray.intersectObjects(targets, false);
    return (hits[0]?.object.userData.body as Body) ?? null;
  }

  // --- HUD text
  const fmt = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  let hovered: Body | null = null, selected: MoonObj | null = null;
  function showCard(b: Body | null) {
    if (!b) { card.hidden = true; return; }
    card.hidden = false;
    if (b.kind === 'sun') {
      card.style.setProperty('--pc', '#ffb35c');
      card.innerHTML = `<span class="k">${data.sun.tag} · THE SUN</span><span class="t">${data.sun.label}</span><span class="d">Three ways in, how every page works, and the status of the rebuild.</span><span class="go">SELECT TO OPEN THE BRIEFING</span>`;
    } else if (b.kind === 'planet') {
      const p = b.p.data, z = p.moons.filter((m) => !m.primer), v2 = z.filter((m) => m.v2).length;
      card.style.setProperty('--pc', p.color);
      card.innerHTML = `<span class="k">PHASE ${p.index + 1} OF ${data.planets.length}</span><span class="t">${p.n}</span><span class="s">${fmt(p.sub)}</span><span class="d">${fmt(p.d)}</span><span class="go">${v2}/${z.length} ZONES IN v2 · SELECT TO APPROACH</span>`;
    } else {
      const m = b.m.data;
      card.style.setProperty('--pc', b.m.planet.data.color);
      card.innerHTML = `<span class="k">${m.primer ? 'PRIMER' : m.tag} · ${b.m.planet.data.n}${m.v2 ? '' : ' · v1 ARCHIVE'}</span><span class="t">${fmt(m.label)}</span><span class="d">${fmt(m.desc)}</span>`
        + (touchMode ? `<button type="button" class="engage" data-engage>ENGAGE WARP ▸</button>` : `<span class="go">CLICK TO WARP</span>`);
    }
  }
  function say(t: string) { live.textContent = t; }

  // --- views
  const panel = root.querySelector<HTMLElement>('[data-panel]')!, brief = root.querySelector<HTMLElement>('[data-brief]')!;
  const crumb = root.querySelector<HTMLElement>('[data-crumb]')!;
  function setHash(h: string) { try { history.replaceState(null, '', h ? `#map/${h}` : '#map'); } catch { /* history can be blocked */ } }
  function goSystem() {
    mode = 'system'; focus = null; selected = null; user = { theta: 0, phi: 0, zoom: 1 };
    panel.hidden = true; brief.hidden = true; root.dataset.mode = 'system';
    crumb.textContent = 'SYSTEM';
    setWant(); setHash(''); say('System map. Eight phases.'); markRoute(null); dirty = true;
  }
  function goPlanet(p: PlanetObj) {
    mode = 'planet'; focus = p; selected = null; user = { theta: 0, phi: 0, zoom: 1 };
    brief.hidden = true; root.dataset.mode = 'planet';
    panel.hidden = false;
    panel.style.setProperty('--pc', p.data.color);
    panel.querySelectorAll<HTMLElement>('[data-phase]').forEach((s) => (s.hidden = s.dataset.phase !== p.data.k));
    crumb.textContent = `SYSTEM › ${p.data.n}`;
    focusDist = focusDistance(p);
    setWant(); setHash(p.data.k); say(`${p.data.n}: ${p.moons.length} zones.`); markRoute(p.data.k); dirty = true;
  }
  function goSun() {
    mode = 'sun'; focus = null; selected = null; user = { theta: 0, phi: 0, zoom: 1 };
    panel.hidden = true; brief.hidden = false; root.dataset.mode = 'sun';
    crumb.textContent = `SYSTEM › ${data.sun.label}`;
    setWant(); setHash('overview'); say('Overview briefing.'); markRoute('sun'); dirty = true;
  }
  const routeBtns = [...root.querySelectorAll<HTMLButtonElement>('[data-go]')];
  function markRoute(k: string | null) { routeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.go === k))); }

  // --- the warp
  const wctx = warpCv.getContext('2d');
  let warpT0 = 0, warpHref = '', warpFrom = { x: 0, y: 0 }, warpCol = '#9fd8e6';
  const streaks = Array.from({ length: 420 }, () => ({ a: Math.random() * TAU, d: Math.pow(Math.random(), 0.6), w: 0.6 + Math.random() * 1.8, c: Math.random() }));
  function prefetch(href: string) {
    if (document.querySelector(`link[rel="prefetch"][href="${CSS.escape(href)}"]`)) return;
    const l = document.createElement('link'); l.rel = 'prefetch'; l.href = href; document.head.appendChild(l);
  }
  function engage(m: MoonObj) {
    if (mode === 'warp') return;
    // the zone of this page: nothing to fly to, so close the map
    const same = (() => { try { return new URL(m.data.href, location.href).pathname.replace(/\/?$/, '/') === location.pathname.replace(/\/?$/, '/'); } catch { return false; } })();
    if (same && opts.close) { opts.close(); return; }
    if (calm() || !wctx) { location.assign(m.data.href); return; }
    prefetch(m.data.href);
    m.mesh.getWorldPosition(tmp); const s = toScreen(tmp);
    warpFrom = s ? { x: s.x, y: s.y } : { x: W / 2, y: H / 2 };
    warpCol = m.planet.data.color; warpHref = m.data.href; warpT0 = last; // the frame clock
    mode = 'warp'; root.dataset.mode = 'warp'; card.hidden = true; reticle.classList.add('lock');
    crumb.textContent = `WARP › ${m.data.primer ? 'PRIMER' : m.data.tag} ${m.data.label}`;
    m.mesh.getWorldPosition(want.target); want.dist = m.r * pScale * 1.4;
    warpCv.hidden = false;
  }
  const WARP_MS = 820;
  function drawWarp(now: number) {
    const t = Math.min(1, (now - warpT0) / WARP_MS);
    camera.fov = fovBase + 78 * Math.pow(t, 2.4); camera.updateProjectionMatrix();
    canvas.style.transform = `scale(${1 + 0.18 * t * t})`; canvas.style.filter = `blur(${(t * t * 3).toFixed(2)}px)`;
    if (!wctx) return t;
    const k = warpCv.width / W, cw = warpCv.width, ch = warpCv.height;
    const cx = (warpFrom.x * (1 - t) + (W / 2) * t) * k, cy = (warpFrom.y * (1 - t) + (H / 2) * t) * k;
    const diag = Math.hypot(cw, ch);
    wctx.clearRect(0, 0, cw, ch);
    wctx.globalCompositeOperation = 'lighter';
    for (const s of streaks) {
      const r1 = diag * (0.02 + s.d * 0.55) * (1 + 5 * Math.pow(t, 3));
      const len = r1 * (0.04 + 0.9 * Math.pow(t, 1.8));
      const x1 = cx + Math.cos(s.a) * r1, y1 = cy + Math.sin(s.a) * r1, x0 = cx + Math.cos(s.a) * (r1 - len), y0 = cy + Math.sin(s.a) * (r1 - len);
      const g = wctx.createLinearGradient(x0, y0, x1, y1);
      const c = s.c < 0.35 ? warpCol : '#e8f6ff';
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, c);
      wctx.globalAlpha = Math.min(1, t * 3.5) * (0.5 + 0.5 * s.d);
      wctx.strokeStyle = g; wctx.lineWidth = s.w * k * (0.6 + 1.6 * t);
      wctx.beginPath(); wctx.moveTo(x0, y0); wctx.lineTo(x1, y1); wctx.stroke();
    }
    wctx.globalAlpha = 1; wctx.globalCompositeOperation = 'source-over';
    const core = wctx.createRadialGradient(cx, cy, 0, cx, cy, diag * (0.05 + 0.4 * t * t));
    core.addColorStop(0, `rgba(235,248,255,${(0.25 + 0.75 * t * t).toFixed(3)})`); core.addColorStop(1, 'rgba(235,248,255,0)');
    wctx.fillStyle = core; wctx.fillRect(0, 0, cw, ch);
    if (t > 0.78) { wctx.fillStyle = `rgba(240,250,255,${((t - 0.78) / 0.22).toFixed(3)})`; wctx.fillRect(0, 0, cw, ch); }
    return t;
  }

  // --- screen projection for labels and the reticle
  function toScreen(v: THREE.Vector3) {
    tmp2.copy(v).project(camera);
    if (tmp2.z > 1) return null;
    return { x: (tmp2.x * 0.5 + 0.5) * W, y: (-tmp2.y * 0.5 + 0.5) * H, z: tmp2.z };
  }
  const pxRadius = (world: THREE.Vector3, r: number) => (r / (world.distanceTo(camera.position) * Math.tan((camera.fov * PI) / 360))) * (H / 2);
  function place(el: HTMLElement, x: number, y: number, show: boolean) {
    if (!show) { if (!el.classList.contains('off')) el.classList.add('off'); return; }
    el.classList.remove('off');
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }

  // keep a label of width w inside the frame; `left` labels hang to the left of x
  const clampX = (x: number, w: number, left: boolean) => (left ? Math.max(x, w + 10) : Math.min(x, W - w - 10));
  function updateLabels() {
    // the sun and the planets
    const s0 = toScreen(sun.getWorldPosition(tmp));
    const sr = pxRadius(tmp, SUN_R);
    place(sunLabel, s0?.x ?? 0, (s0?.y ?? 0) + sr + 10, !!s0 && mode === 'system');
    // planet labels sit outward from the sun; one that would overlap an earlier label is hidden
    const taken: { x0: number; y0: number; x1: number; y1: number }[] = [];
    if (s0 && mode === 'system') { const w = sunLabel.offsetWidth || 100, h = sunLabel.offsetHeight || 20; taken.push({ x0: s0.x - w / 2, y0: s0.y + sr + 10, x1: s0.x + w / 2, y1: s0.y + sr + 10 + h }); }
    for (const p of planets) {
      p.anchor.getWorldPosition(tmp);
      const s = toScreen(tmp), pr = pxRadius(tmp, p.r * pScale);
      if (!s || !s0 || mode !== 'system') { place(p.label, 0, 0, false); continue; }
      const dx = s.x - s0.x, dy = s.y - s0.y, dl = Math.hypot(dx, dy) || 1, left = dx < 0;
      const w = p.label.offsetWidth || 90, h = p.label.offsetHeight || 20;
      const lx = clampX(s.x + (dx / dl) * (pr + 6), w, left), ly = s.y + (dy / dl) * (pr + 6);
      const rect = { x0: left ? lx - w : lx, y0: ly - h / 2, x1: left ? lx : lx + w, y1: ly + h / 2 };
      const hot = hovered?.kind === 'planet' && hovered.p === p;
      const clash = taken.some((r) => r.x0 < rect.x1 && rect.x0 < r.x1 && r.y0 < rect.y1 && rect.y0 < r.y1);
      if (!clash || hot) taken.push(rect);
      p.label.classList.toggle('left', left);
      place(p.label, lx, ly, !clash || hot);
    }
    // the moons of the focused planet, nearest first; a label that would overlap a nearer one is hidden
    const rects: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const pc = focus ? focus.anchor.getWorldPosition(new THREE.Vector3()) : null;
    const pcs = pc ? toScreen(pc) : null, pcr = pc ? pxRadius(pc, (focus?.r ?? 1) * pScale) : 0;
    const camD = pc ? pc.distanceTo(camera.position) : 0;
    const list = focus && mode !== 'warp' ? focus.moons.map((m) => ({ m, w: m.mesh.getWorldPosition(new THREE.Vector3()) })) : [];
    list.sort((a, b) => a.w.distanceTo(camera.position) - b.w.distanceTo(camera.position));
    for (const p of planets) for (const m of p.moons) if (p !== focus || mode === 'warp') place(m.label, 0, 0, false);
    for (const { m, w } of list) {
      const s = toScreen(w);
      if (!s || !pcs) { place(m.label, 0, 0, false); continue; }
      const behind = w.distanceTo(camera.position) > camD && Math.hypot(s.x - pcs.x, s.y - pcs.y) < pcr;
      const mr = pxRadius(w, m.r * pScale);
      const dx = s.x - pcs.x, dy = s.y - pcs.y, dl = Math.hypot(dx, dy) || 1;
      const lw = m.label.offsetWidth || 120, lh = m.label.offsetHeight || 20;
      const left = dx < 0;
      const lx = clampX(s.x + (dx / dl) * (mr + 6), lw, left), ly = s.y + (dy / dl) * (mr + 6);
      const x0 = left ? lx - lw : lx, y0 = ly - lh / 2;
      const rect = { x0, y0, x1: x0 + lw, y1: y0 + lh };
      const hot = (hovered?.kind === 'moon' && hovered.m === m) || selected === m || m.label.classList.contains('here');
      const clash = rects.some((r) => r.x0 < rect.x1 && rect.x0 < r.x1 && r.y0 < rect.y1 && rect.y0 < r.y1);
      const show = !behind && (hot || !clash);
      if (show) rects.push(rect);
      m.label.classList.toggle('left', left);
      m.label.classList.toggle('hot', hot);
      place(m.label, lx, ly, show);
    }
    // the reticle on the hovered or selected body
    const target = mode === 'warp' ? null : selected ? ({ kind: 'moon', m: selected } as Body) : hovered;
    if (target) {
      const w = new THREE.Vector3(); let r = 1;
      if (target.kind === 'sun') { sun.getWorldPosition(w); r = SUN_R; }
      else if (target.kind === 'planet') { target.p.anchor.getWorldPosition(w); r = target.p.r * pScale; }
      else { target.m.mesh.getWorldPosition(w); r = target.m.r * pScale; }
      const s = toScreen(w);
      if (s) {
        const size = Math.max(26, pxRadius(w, r) * 2 + 18);
        reticle.style.width = reticle.style.height = `${size.toFixed(0)}px`;
        reticle.style.setProperty('--pc', target.kind === 'sun' ? '#ffb35c' : target.kind === 'planet' ? target.p.data.color : target.m.planet.data.color);
        place(reticle, s.x - size / 2, s.y - size / 2, true);
      } else place(reticle, 0, 0, false);
    } else if (mode !== 'warp') place(reticle, 0, 0, false);
  }

  // --- input
  let drag: { x: number; y: number; moved: boolean; id: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    touchMode = e.pointerType !== 'mouse';
    drag = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* not supported */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (drag && drag.id === e.pointerId) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 5) drag.moved = true;
      if (drag.moved && mode !== 'warp') {
        user.theta += dx * 0.006; user.phi = Math.max(-0.75, Math.min(0.45, user.phi - dy * 0.004));
        drag.x = e.clientX; drag.y = e.clientY; dirty = true;
      }
      return;
    }
    if (e.pointerType === 'mouse' && mode !== 'warp') setHover(pick(x, y));
  });
  const endDrag = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    const moved = drag.moved; drag = null;
    if (moved || mode === 'warp') return;
    const r = canvas.getBoundingClientRect();
    activate(pick(e.clientX - r.left, e.clientY - r.top), e.pointerType !== 'mouse');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', () => { drag = null; });
  canvas.addEventListener('pointerleave', () => { if (!drag) setHover(null); });
  canvas.addEventListener('wheel', (e) => {
    if (mode === 'warp') return;
    e.preventDefault();
    user.zoom = Math.max(0.45, Math.min(1.8, user.zoom * Math.pow(1.0015, e.deltaY)));
    dirty = true;
  }, { passive: false });

  function setHover(b: Body | null) {
    const same = (a: Body | null, c: Body | null) => a === c || (!!a && !!c && a.kind === c.kind && (a.kind === 'sun' || (a.kind === 'planet' && c.kind === 'planet' && a.p === c.p) || (a.kind === 'moon' && c.kind === 'moon' && a.m === c.m)));
    if (same(b, hovered)) return;
    hovered = b;
    canvas.style.cursor = b ? 'pointer' : drag ? 'grabbing' : 'grab';
    if (!selected) showCard(b);
    if (b?.kind === 'moon') prefetch(b.m.data.href);
    dirty = true;
  }
  function activate(b: Body | null, touch: boolean) {
    if (!b) { if (touch) { selected = null; showCard(null); } return; }
    if (b.kind === 'sun') goSun();
    else if (b.kind === 'planet') { if (focus !== b.p || mode !== 'planet') goPlanet(b.p); }
    else if (touch && selected !== b.m) { selected = b.m; showCard(b); prefetch(b.m.data.href); dirty = true; }
    else engage(b.m);
  }
  card.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('[data-engage]') && selected) engage(selected); });
  labels.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.sm-plabel, .sm-mlabel');
    if (!el) return;
    e.preventDefault();
    if (el === sunLabel) return goSun();
    const p = planets.find((q) => q.label === el); if (p) return goPlanet(p);
    for (const q of planets) { const m = q.moons.find((x) => x.label === el); if (m) return engage(m); }
  });
  // the panel's list of zones: hover highlights the moon, a click warps
  panel.addEventListener('pointerover', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-moon]');
    if (!a || !focus) return;
    const m = focus.moons.find((x) => x.data.key === a.dataset.moon); if (m) setHover({ kind: 'moon', m });
  });
  panel.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-moon]');
    if (!a || !focus || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const m = focus.moons.find((x) => x.data.key === a.dataset.moon); if (!m) return;
    e.preventDefault(); engage(m);
  });
  routeBtns.forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.go!;
    if (k === 'system') goSystem(); else if (k === 'sun') goSun(); else { const p = planets.find((q) => q.data.k === k); if (p) goPlanet(p); }
  }));
  root.querySelectorAll<HTMLElement>('[data-zoom]').forEach((b) => b.addEventListener('click', () => { user.zoom = Math.max(0.45, Math.min(1.8, user.zoom * (b.dataset.zoom === 'in' ? 0.8 : 1.25))); dirty = true; }));
  root.querySelector('[data-route-start]')?.addEventListener('click', () => goPlanet(planets[0]));
  root.querySelector('[data-open-search]')?.addEventListener('click', () => document.querySelector<HTMLButtonElement>('site-search button[data-open-modal]')?.click());
  labels.addEventListener('pointerover', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.sm-mlabel');
    if (!el || !focus || mode === 'warp') return;
    const m = focus.moons.find((x) => x.label === el); if (m) setHover({ kind: 'moon', m });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || mode === 'system' || mode === 'warp' || !visible) return;
    const a = document.activeElement;
    if (a && a !== document.body && !root.contains(a)) return; // the search dialog and other controls keep their Escape
    e.preventDefault(); goSystem();
  });
  // back from the zone page: the browser may restore this page as it was, mid-warp
  addEventListener('pageshow', (e) => { if ((e as PageTransitionEvent).persisted) resetWarp(); });
  function resetWarp() {
    if (mode !== 'warp' && !warped) return;
    warped = false; warpCv.hidden = true; canvas.style.transform = ''; canvas.style.filter = '';
    camera.fov = fovBase; camera.updateProjectionMatrix(); wctx?.clearRect(0, 0, warpCv.width, warpCv.height);
    reticle.classList.remove('lock'); if (focus) goPlanet(focus); else goSystem();
  }

  // --- the loop
  let visible = true, last = performance.now(), t = 0;
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0.01 });
  io.observe(root);
  new ResizeObserver(() => resize()).observe(root);
  new MutationObserver(() => { dirty = true; }).observe(doc, { attributes: true, attributeFilter: ['class', 'data-theme'] });

  const SYS_RATE = TAU / 420; // one turn of the system in 7 minutes
  let sunGlowLevel = 1;
  const viewOff = { x: 0, y: 0 };
  function viewOffset() {
    const R = root.getBoundingClientRect();
    const side = (el: HTMLElement, right: boolean) => {
      if (el.hidden) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      if (W < 700) return { x: 0, y: (R.bottom - r.top) / 2 };
      return right ? { x: (R.right - r.left) / 2, y: 0 } : { x: -(r.right - R.left) / 2, y: 0 };
    };
    if (mode === 'planet') return side(panel, false);
    if (mode === 'sun') return side(brief, true);
    if (mode === 'system') return sysOff;
    return { x: 0, y: 0 };
  }
  // ≤30 frames a second (the warp runs at the display rate); the render scale drops when frames come too slowly and
  // creeps back when they are quick
  let gapAvg = 33, frames = 0, lastDraw = 0;
  function frame(now: number) {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) { last = now; lastDraw = 0; return; }
    if (mode !== 'warp' && now - lastDraw < 1000 / 31) return;
    if (lastDraw) gapAvg += (Math.min(250, now - lastDraw) - gapAvg) * 0.1;
    lastDraw = now;
    tick(now);
    if (++frames % 45 === 0 && mode !== 'warp' && !calm()) {
      const q = gapAvg > 45 ? Math.max(0.5, quality * 0.8) : gapAvg < 36 && quality < 1 ? Math.min(1, quality * 1.12) : quality;
      if (q !== quality) { quality = q; renderer.setPixelRatio(baseDpr * quality); renderer.setSize(W, H, false); }
    }
  }
  function tick(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const still = calm();
    if (still && !dirty && mode !== 'warp') return;
    if (!still) t += dt;
    // motion
    placeOrbits(t * SYS_RATE);
    rays.material.rotation = t * 0.02;
    sunMat.uniforms.uTime.value = t;
    for (const p of planets) {
      p.mesh.rotation.y = t * (0.05 + p.data.index * 0.004);
      p.emblemPivot.rotation.y = t * (TAU / 26) + p.data.index;
      p.anchor.getWorldPosition(tmp);
      p.emblemTick(t, tmp);
      (p.mesh.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      const am = p.atmo.material as THREE.ShaderMaterial; am.uniforms.uCenter.value.copy(tmp);
      for (const o of p.body.children) { const sp = o.userData.spin as THREE.Object3D | undefined; if (sp) sp.rotation.y = t * (TAU / ((o.userData as { R: number }).R > p.r * 2.4 ? 140 : 90)); }
      for (const m of p.moons) (m.mesh.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    }
    // hover glow eases in and out
    const hv = (b: Body) => (hovered && ((hovered.kind === 'sun' && b.kind === 'sun') || (hovered.kind === 'planet' && b.kind === 'planet' && hovered.p === b.p) || (hovered.kind === 'moon' && b.kind === 'moon' && hovered.m === b.m))) || (b.kind === 'moon' && selected === b.m) ? 1 : 0;
    const kH = damp(dt, 10);
    sunMat.uniforms.uHover.value += (hv({ kind: 'sun' }) - sunMat.uniforms.uHover.value) * kH;
    for (const p of planets) {
      const u = (p.mesh.material as THREE.ShaderMaterial).uniforms, a = (p.atmo.material as THREE.ShaderMaterial).uniforms;
      const v = hv({ kind: 'planet', p }) + (focus === p ? 0.25 : 0);
      u.uHover.value += (v - u.uHover.value) * kH; a.uHover.value = u.uHover.value;
      for (const m of p.moons) { const mu = (m.mesh.material as THREE.ShaderMaterial).uniforms; mu.uHover.value += (hv({ kind: 'moon', m }) - mu.uHover.value) * kH; }
      p.orbitLine.material.opacity = mode === 'system' ? 0.38 : focus === p ? 0.4 : 0.1;
      for (const l of p.moonOrbits) (l.material as THREE.LineDashedMaterial).opacity = focus === p ? 0.3 : mode === 'system' ? 0.12 : 0.05;
      // the focused planet's moons spread out to be read; the other planets step back
      const on = focus === p && (mode === 'planet' || mode === 'warp');
      const kS = still ? 1 : damp(dt, 4);
      const dim = on || mode === 'system' ? 1 : mode === 'sun' ? 0.85 : 0.22;
      const shrink = on || mode === 'system' ? pScale : pScale * 0.7;
      p.anchor.scale.setScalar(p.anchor.scale.x + (shrink - p.anchor.scale.x) * kS);
      u.uDim.value += (dim - u.uDim.value) * kS;
      a.uGain.value = 0.9 * u.uDim.value;
      for (const m of p.moons) (m.mesh.material as THREE.ShaderMaterial).uniforms.uDim.value = u.uDim.value;
      // in the system view the moons close in to one tight orbit (on a phone, out of sight), and the model docks
      for (const o of p.body.children) {
        if (!o.userData.spin) continue;
        const goal = on ? 1 : K > 1 ? 0 : (p.r * SYS_RING) / (o.userData.R as number);
        o.scale.setScalar(o.scale.x + (goal - o.scale.x) * kS);
        o.visible = o.scale.x > 0.02;
      }
      p.emblemPivot.scale.setScalar(p.emblemPivot.scale.x + ((on ? 1 : 0) - p.emblemPivot.scale.x) * kS);
      p.emblemPivot.visible = p.emblemPivot.scale.x > 0.02;
    }
    // the sun steps back while a planet is in focus
    const sunDim = mode === 'planet' || mode === 'warp' ? 0.3 : 1;
    sunGlowLevel += (sunDim - sunGlowLevel) * (still ? 1 : damp(dt, 4));
    sunGlow.material.color.setRGB(0.8, 0.5, 0.26).multiplyScalar(sunGlowLevel);
    sunMat.uniforms.uDim.value = 0.25 + 0.75 * ((sunGlowLevel - 0.3) / 0.7);
    sunHalo.material.color.setRGB(0.16, 0.08, 0.035).multiplyScalar(sunGlowLevel);
    rays.material.color.setRGB(0.32, 0.22, 0.13).multiplyScalar(sunGlowLevel);
    // keep the subject clear of the side panel (desktop) or the bottom sheet (phone)
    const off = viewOffset(), kO = still ? 1 : damp(dt, 5);
    viewOff.x += (off.x - viewOff.x) * kO; viewOff.y += (off.y - viewOff.y) * kO;
    camera.setViewOffset(W, H, viewOff.x, viewOff.y, W, H);
    // camera
    if (mode === 'planet' && focus) setWant();
    const k = still && mode !== 'warp' ? 1 : damp(dt, mode === 'warp' ? 5 : 3.2);
    view.target.lerp(want.target, k);
    view.dist = Math.exp(Math.log(view.dist) + (Math.log(want.dist * (mode === 'warp' ? 1 : user.zoom)) - Math.log(view.dist)) * k);
    view.theta = angLerp(view.theta, want.theta + user.theta, k);
    view.phi += (Math.max(0.2, Math.min(1.5, want.phi + user.phi)) - view.phi) * k;
    camera.position.set(
      view.target.x + view.dist * Math.sin(view.phi) * Math.cos(view.theta),
      view.target.y + view.dist * Math.cos(view.phi),
      view.target.z + view.dist * Math.sin(view.phi) * Math.sin(view.theta),
    );
    camera.lookAt(view.target);
    if (mode === 'warp') { const wt = drawWarp(now); if (wt >= 1 && !warped) { warped = true; location.assign(warpHref); } }
    renderer.render(scene, camera);
    updateLabels();
    dirty = false;
  }

  // --- start
  resize();
  const h = (() => { try { return decodeURIComponent(location.hash); } catch { return ''; } })();
  const fromHash = h.match(/^#map\/(.+)$/)?.[1];
  // you are here: the zone of this page is marked, and the map opens on its planet
  const hereMoon = opts.here && opts.here !== 'home' ? planets.flatMap((q) => q.moons).find((m) => m.data.key === opts.here) : undefined;
  if (hereMoon) { hereMoon.label.classList.add('here'); panel.querySelector(`a[data-moon="${CSS.escape(hereMoon.data.key)}"]`)?.classList.add('here'); }
  if (fromHash === 'overview') goSun(); else { const p = planets.find((q) => q.data.k === fromHash) ?? hereMoon?.planet; if (p) goPlanet(p); else goSystem(); }
  view.target.copy(want.target); view.dist = want.dist; view.theta = want.theta; view.phi = want.phi;
  canvas.style.cursor = 'grab';
  requestAnimationFrame(frame);
}
