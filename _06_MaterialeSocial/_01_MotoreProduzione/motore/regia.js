// DepthX, Linea 1.2: regia di FloorView e Unfold. Tempo deterministico: window.__adv(dt), window.__frame(), window.__vai(t).
// Parametri: ?modo=floorview|unfold  &o=o|v|p (orizzontale 1920x1080, verticale 1080x1920, post 1080x1350)  &ver=1|2|3  &ss=campioni  &t=secondi  &play
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { TexturePass } from 'three/addons/postprocessing/TexturePass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { caricaLibreria } from './libreria.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { materiali, costruisci, controlliArredo, rettContesto, W, H } from './casa.js';

const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const pr = (t, a, b) => cl((t - a) / (b - a));
const eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eo = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
const es = x => x * x * (3 - 2 * x);
const mix = (a, b, f) => a + (b - a) * f;
const RAD = Math.PI / 180;
const ASP_LOGO = 1.122 / 1.08;

// interpolazione di Hermite con tangenti di Catmull-Rom su chiavi [t, ...valori]
function hermite(chiavi) {
  const K = chiavi.map(k => ({ t: k[0], v: k.slice(1) }));
  return T => {
    if (T <= K[0].t) return K[0].v.slice(); if (T >= K[K.length - 1].t) return K[K.length - 1].v.slice();
    let i = 0; while (T > K[i + 1].t) i++;
    const a = K[i], b = K[i + 1], dt = b.t - a.t, u = (T - a.t) / dt;
    const tan = j => { if (j === 0 || j === K.length - 1) return K[j].v.map(() => 0); const p = K[j - 1], n = K[j + 1]; return K[j].v.map((_, c) => (n.v[c] - p.v[c]) / (n.t - p.t)); };
    const ma = tan(i), mb = tan(i + 1);
    const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2;
    return a.v.map((_, c) => h00 * a.v[c] + h10 * dt * ma[c] + h01 * b.v[c] + h11 * dt * mb[c]);
  };
}

// versione 1: solo interni (niente balconi, terrazzi, portici, ringhiere e loro arredo); il riquadro si stringe alla casa
function soloInterni(P) {
  const est = new Set(P.stanze.filter(s => s.esterno).map(s => s.id));
  const stanze = P.stanze.filter(s => !s.esterno); const b = [1e9, 1e9, -1e9, -1e9];
  for (const s of stanze) { b[0] = Math.min(b[0], s.r[0]); b[1] = Math.min(b[1], s.r[1]); b[2] = Math.max(b[2], s.r[2]); b[3] = Math.max(b[3], s.r[3]); }
  return { ...P, box: b, stanze, muri: P.muri.filter(m => !m.ringhiera), arredo: P.arredo && P.arredo !== 'auto' ? P.arredo.filter(a => !est.has(a[0])) : P.arredo, ordine: P.ordine ? P.ordine.filter(id => !est.has(id)) : P.ordine };
}

export async function avvia(P) {
  const Q = new URLSearchParams(location.search);
  const UNF = (Q.get('modo') || P.modo || 'floorview') === 'unfold';
  const POST = Q.get('o') === 'p', VERT = Q.get('o') === 'v' || POST;
  const OUTW = VERT ? 1080 : 1920, OUTH = POST ? 1350 : VERT ? 1920 : 1080;
  const AO = Q.get('ao') !== '0';
  // campioni per fotogramma (antialias e leggero mosso) e frazione di fotogramma coperta dal mosso
  const NS = Math.max(1, +(Q.get('ss') || 8)), OTT = +(Q.get('otturatore') || 0.5);
  const SC = +(Q.get('scala') || (NS > 1 ? 1 : 0.8)); const RW = Math.round(OUTW * SC), RH = Math.round(OUTH * SC);
  // versione: 1 interni e luce del giorno; 2 con esterni, ornamenti, ingresso; 3 con sera e contesto
  const VER = +(Q.get('ver') || 1);
  if (VER === 1) P = soloInterni(P);
  if (VER >= 3) { const C = rettContesto(P); if (C) { const b = P.box.slice(), r = C.r; P = { ...P, box: [Math.min(b[0], r[0]), Math.min(b[1], r[1]), Math.max(b[2], r[2]), Math.max(b[3], r[3])] }; } }
  const PAROLA = UNF ? 'Unfold' : 'FloorView';

  // ---------- pagina ----------
  const font = new URL('../assets/fonts/Montserrat.ttf', import.meta.url).href;
  const st = document.createElement('style');
  st.textContent = `@font-face { font-family: Montserrat; src: url(${font}) format('truetype'); font-weight: 100 900; }
html, body { margin: 0; height: 100%; overflow: hidden; background: #f4f4f2; }
#tela { position: fixed; inset: 0; width: 100vw; height: 100vh; display: block; }
#velo { position: fixed; inset: 0; background: #f4f4f2; opacity: 1; pointer-events: none; }
#marchio { position: fixed; inset: 0; pointer-events: none; }
#logo { position: absolute; left: 0; top: 0; display: block; z-index: 2; }
#clip { position: absolute; overflow: hidden; z-index: 1; }
#parola { position: absolute; left: 0; top: 0; white-space: nowrap; font-family: Montserrat, sans-serif; font-weight: 600; color: #00a6fb; letter-spacing: -0.02em; line-height: 1; will-change: transform; }`;
  document.head.appendChild(st);
  document.body.innerHTML = `<canvas id="tela"></canvas><div id="velo"></div><div id="marchio"><div id="clip"><span id="parola">${PAROLA}</span></div><img id="logo" src="${new URL('../assets/marchio.svg', import.meta.url).href}"></div>`;
  const tela = document.getElementById('tela'), velo = document.getElementById('velo'), logo = document.getElementById('logo'), clip = document.getElementById('clip'), parola = document.getElementById('parola');

  // ---------- motore ----------
  const renderer = new THREE.WebGLRenderer({ canvas: tela, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(RW / innerWidth);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4f4f2);
  const camera = new THREE.PerspectiveCamera(30, OUTW / OUTH, 0.05, 300);

  const [bx0, bz0, bx1, bz1] = P.box; const LX = bx1 - bx0, LZ = bz1 - bz0, CX = (bx0 + bx1) / 2, CZ = (bz0 + bz1) / 2;
  const terreno = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }));
  terreno.receiveShadow = true; terreno.material.emissive = new THREE.Color(0xffffff); terreno.material.emissiveIntensity = 0.22; terreno.position.y = -0.01; scene.add(terreno);
  // anti tremolio: il piano bianco cede sempre la profondita' a pavimenti e deck
  terreno.material.polygonOffset = true; terreno.material.polygonOffsetFactor = 4; terreno.material.polygonOffsetUnits = 4;

  const sole = new THREE.DirectionalLight(0xffffff, 2.4); sole.castShadow = true;
  sole.shadow.mapSize.set(4096, 4096); const sc = sole.shadow.camera; const mz = Math.max(LX, LZ) * 0.62 + 2.5; sc.left = -mz; sc.right = mz; sc.top = mz; sc.bottom = -mz; sc.near = 1; sc.far = 90;
  sole.shadow.bias = -0.0008; sole.shadow.normalBias = 0.045; sole.shadow.radius = 4;
  scene.add(sole); scene.add(sole.target);
  const posSole = (az, el) => { const a = az * RAD, e = el * RAD; sole.position.set(Math.sin(a) * Math.cos(e) * 34, Math.sin(e) * 34, Math.cos(a) * Math.cos(e) * 34); };

  await document.fonts.load('600 100px Montserrat');
  if (Q.get('lib') !== '0') await caricaLibreria(renderer);
  const M = materiali();
  const casa = costruisci(scene, M, P, { soffitti: UNF, ornamenti: VER >= 2, ingresso: VER >= 2, contesto: VER >= 3 });
  const D = casa.disegno.userData;
  if (Q.has('vecchio')) { terreno.position.y = -0.002; terreno.material.polygonOffset = false; for (const p of casa.pavimenti) p.material.polygonOffset = false; sole.shadow.bias = -0.0004; sole.shadow.normalBias = 0.02; }

  // fusione delle geometrie per materiale dentro ogni pezzo: meno chiamate di disegno
  function fondi(gruppo, escludi = new Set()) {
    gruppo.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(gruppo.matrixWorld).invert();
    const per = new Map(), via = [];
    const visita = o => { for (const c of [...o.children]) { if (escludi.has(c)) continue; if (c.isMesh) { if (!c.visible) continue; const k = c.material.uuid + (c.castShadow ? 'o' : 'n'); if (!per.has(k)) per.set(k, { mat: c.material, ombra: c.castShadow, geo: [] }); const g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, c.matrixWorld)); for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(n)) g.deleteAttribute(n); per.get(k).geo.push(g); via.push(c); } else if (!c.isLight) visita(c); } };
    visita(gruppo);
    for (const c of via) c.parent.remove(c);
    for (const { mat, ombra, geo } of per.values()) { const m = new THREE.Mesh(mergeGeometries(geo), mat); m.castShadow = ombra; m.receiveShadow = true; gruppo.add(m); }
  }
  for (const id in casa.arredi) for (const p of [...casa.arredi[id].children]) fondi(p);
  for (const a of casa.aperture) fondi(a, new Set(casa.porte));
  for (const p of casa.porte) fondi(p);

  // post produzione come nel V1
  // anti tremolio: profondita' a 32 bit in virgola mobile (con 24 bit i pavimenti lontani fanno bande che si muovono)
  const VECCHIO = Q.has('vecchio'); const P32 = Q.get('pz') !== '24' && !VECCHIO; // vecchio=1: impostazioni di prima, solo per tarare il controllo
  const rt = new THREE.WebGLRenderTarget(RW, RH, { type: THREE.HalfFloatType });
  if (P32) { rt.depthTexture = new THREE.DepthTexture(RW, RH); rt.depthTexture.format = THREE.DepthFormat; rt.depthTexture.type = THREE.FloatType; }
  const composer = new EffectComposer(renderer, rt); composer.setPixelRatio(1); composer.setSize(RW, RH);
  composer.addPass(new RenderPass(scene, camera));
  if (AO) {
    const gtao = new GTAOPass(scene, camera, RW, RH); gtao.output = GTAOPass.OUTPUT.Default; gtao.blendIntensity = 1.0;
    if (P32) { gtao.depthTexture.format = THREE.DepthFormat; gtao.depthTexture.type = THREE.FloatType; }
    gtao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.6, thickness: 1.2, scale: 1.0, samples: 12, distanceFallOff: 1.0, screenSpaceRadius: false });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 9, radiusExponent: 1.5, rings: 3, samples: 16 });
    composer.addPass(gtao);
  }
  const rifinitura = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, t: { value: 0 }, vign: { value: 0.18 }, grana: { value: 0.018 }, asp: { value: OUTW / OUTH } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float t, vign, grana, asp; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + t*37.0) * 43758.5453); }
    void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; vec2 q = vUv - 0.5; q.x *= asp; float v = smoothstep(0.35, 1.25, length(q) / max(asp, 1.0) * 1.15);
      c *= 1.0 - vign * v; c += (h(vUv * 1000.0) - 0.5) * grana; gl_FragColor = vec4(c, 1.0); }`
  });
  // accumulo dei campioni in alta dinamica, poi mappatura dei toni, vignetta e grana una volta per fotogramma
  composer.renderToScreen = false;
  const acc = new THREE.WebGLRenderTarget(RW, RH, { type: THREE.HalfFloatType, depthBuffer: false }); // 16 bit: la fusione additiva a 32 bit non e' garantita
  const quadAcc = new FullScreenQuad(new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, peso: { value: 1 } }, depthTest: false, depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D tDiffuse; uniform float peso; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb * peso, peso); }' }));
  const finale = new EffectComposer(renderer, new THREE.WebGLRenderTarget(RW, RH, { type: THREE.HalfFloatType })); finale.setPixelRatio(1); finale.setSize(RW, RH);
  finale.addPass(new TexturePass(acc.texture)); finale.addPass(new OutputPass()); if (NS === 1) finale.addPass(new SMAAPass(RW, RH)); finale.addPass(rifinitura);
  renderer.setClearColor(0x000000, 0);
  // spostamenti di frazioni di pixel (Halton 2, 3)
  const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
  const JIT = Array.from({ length: NS }, (_, k) => NS === 1 ? [0, 0] : [halton(k + 1, 2) - 0.5, halton(k + 1, 3) - 0.5]);

  // ---------- stati della casa ----------
  const muri = casa.pezziMuro, tagli = casa.tagli;
  const kMax = Math.max(...muri.map(m => m.userData.k));
  function alzaMuri(t, t0, lung, onda) {
    for (const m of muri) { const s = t0 + (m.userData.k / kMax) * onda; const h = (m.userData.ringhiera ? 1.05 : H) * eio(pr(t, s, s + lung)); const v = cl(h - m.userData.y0, 0, m.userData.y1 - m.userData.y0); m.visible = v > 0.002; m.scale.y = Math.max(v, 0.002); }
    for (const tg of tagli) { const s = t0 + (tg.userData.k / kMax) * onda; const h = H * eio(pr(t, s, s + lung)); tg.position.y = h + 0.006; tg.visible = t >= t0 - 0.001 && h > (tg.userData.y0 || 0) + 0.002; }
  }
  // gli infissi compaiono quando il muro raggiunge l'architrave (circa il 65% della salita), insieme all'architrave
  function aperture(t, t0, onda, lung = 0.9) { for (const a of casa.aperture) { const s = t0 + (a.userData.k / kMax) * onda + 0.62 * lung; const f = es(pr(t, s, s + 0.45)); a.visible = f > 0.001; a.scale.set(1, Math.max(f, 0.001), 1); } }
  const angoliPorte = casa.porte.map(p => p.rotation.y);
  function porte(t, t0, lung) { casa.porte.forEach((p, i) => { p.rotation.y = angoliPorte[i] * eio(pr(t, t0 + i * 0.08, t0 + i * 0.08 + lung)); }); }
  const nPav = casa.pavimenti.length, passoPav = Math.min(0.18, 1.3 / nPav);
  function pavimenti(t, t0, lung) { casa.pavimenti.forEach((p, i) => { const f = es(pr(t, t0 + i * passoPav, t0 + i * passoPav + lung)); p.material.opacity = f; p.visible = f > 0.001; p.material.transparent = f < 0.999; p.material.depthWrite = f > 0.5; }); }
  const ORDINE = casa.ordine;
  const posArredo = new Map();
  for (const id of ORDINE) for (const p of casa.arredi[id].children) posArredo.set(p, { y: p.position.y, s: p.scale.clone() });
  function arredo(t, t0, durata, passoPezzo, lung = 0.85) {
    const ps = Math.min(0.62, durata / ORDINE.length);
    ORDINE.forEach((id, j) => casa.arredi[id].children.forEach((p, i) => {
      const s = t0 + j * ps + i * passoPezzo; const f = eo(pr(t, s, s + lung)); const o = posArredo.get(p);
      p.visible = f > 0.001; p.position.y = o.y + (1 - f) * 0.9; const k = 0.92 + 0.08 * f; p.scale.set(o.s.x * k, o.s.y * k, o.s.z * k);
    }));
  }
  const nMuri2 = D.muri.length;
  for (const m of D.muri) m.userData.p0 = m.position.clone(), m.userData.s0 = m.scale.clone();
  function disegna(t, t0, lung) {
    for (const m of D.muri) {
      const s = t0 + (m.userData.ordine / nMuri2) * lung * 0.55; const f = es(pr(t, s, s + lung * 0.5)); m.visible = f > 0.001;
      const { p0, s0 } = m.userData;
      if (m.userData.oriz) { m.scale.x = Math.max(s0.x * f, 1e-4); m.position.x = p0.x - s0.x * (1 - f) / 2; } else { m.scale.z = Math.max(s0.z * f, 1e-4); m.position.z = p0.z - s0.z * (1 - f) / 2; }
    }
  }
  function opacita(lista, f) { for (const m of lista) { m.material.opacity = f; m.visible = f > 0.002; } }
  function luci(az, el, col, int, env, lamp) {
    posSole(az, el); sole.color.copy(col); sole.intensity = int; scene.environmentIntensity = env;
    for (const L of casa.lampade) { L.intensity = lamp; L.visible = lamp > 0.001; } M.paralume.emissiveIntensity = lamp / 6;
  }
  const BIANCO = new THREE.Color(1, 0.985, 0.96), ORO = new THREE.Color(1, 0.8, 0.62), CALDO = new THREE.Color(1, 0.95, 0.88);
  const tmpC = new THREE.Color();

  // ---------- tempi ----------
  const O = 3.4; // inizio della scena, dopo l'apertura con il logo
  const TT = 2 * Math.tan(15 * RAD), asp = OUTW / OUTH;
  const baseAz = UNF ? null : (VERT ? (LX >= LZ ? 90 : 0) : (LX >= LZ ? 0 : 90));
  const dTop = az => { const ruota = Math.abs(Math.sin(az * RAD)) > 0.5; const sw = ruota ? LZ : LX, sh = ruota ? LX : LZ; return VERT ? Math.max(sh / (TT * 0.60), sw / (TT * asp * 0.68)) : Math.max(sh / (TT * 0.70), sw / (TT * asp * 0.66)); };
  const orbita = (o) => { // o = [quota, distanza, azimut, inclinazione, fov]
    const [q, d, az, pit, fov] = o; const a = az * RAD, p = pit * RAD; const c = W(CX, CZ, q);
    return [c.x + d * Math.sin(a) * Math.cos(p), c.y + d * Math.sin(p), c.z + d * Math.cos(a) * Math.cos(p), az, -pit, fov];
  };
  let SX = 0, SY = 0, TC, LUNG, statoScena, chiavi = [], TA = 0, TD1 = 0;
  const FW = POST ? 60 : VERT ? 70 : 52; // campo visivo nella visita

  if (!UNF) {
    const d = dTop(baseAz);
    const pat = VERT ? [[0, 1.067, 0, 89.9, 0], [3.2, 1, 0, 89.9, 0], [7.0, 1.14, -24, 54, 0.3], [10.5, 1.08, -10, 56, 0.4], [13.4, 1.08, 12, 55, 0.4], [16.6, 1.12, 36, 52, 0.3], [18.8, 1.04, 0, 89.9, 0], [22, 1, 0, 89.9, 0]]
      : [[0, 1.064, 0, 89.9, 0], [3.2, 1, 0, 89.9, 0], [7.0, 1.15, -28, 50, 0.3], [10.5, 1.04, -16, 52, 0.4], [13.4, 1.04, 8, 51, 0.4], [16.6, 1.106, 34, 48, 0.3], [18.8, 1.04, 0, 89.9, 0], [22, 1, 0, 89.9, 0]];
    const orb = hermite(pat.map(([t, r, da, pit, q]) => [t + O, q, d * r, baseAz + da, pit, 30]));
    for (let t = 0; t <= O + 22.01; t += 0.25) chiavi.push([t, ...orbita(orb(t))]);
    SX = VERT ? 0 : 0.02; SY = VERT ? -0.035 : -0.03;
    TC = O + 18.8; LUNG = TC + 2.6;
    const nSt = ORDINE.length;
    statoScena = t => {
      disegna(t, 0.35, 2.6);
      opacita(D.muri, t < 7.0 ? 1 : 0); // il disegno resta pieno sotto i muri che salgono e sparisce quando sono tutti alti: nessuna sovrapposizione trasparente
      opacita(D.simboli, es(pr(t, 1.5, 2.4)) * (1 - es(pr(t, 4.4, 5.4))));
      alzaMuri(t, 3.9, 1.6, 1.4);
      aperture(t, 3.9, 1.4, 1.6); porte(t, 6.6, 1.3);
      pavimenti(t, 6.1, 1.1);
      arredo(t, 8.5, Math.min(3.9, 0.62 * nSt), 0.045, 0.8);
      if (casa.ingresso) casa.ingresso.visible = t > 6.2; if (casa.contesto) casa.contesto.visible = t > 6.2;
      const f = VER >= 3 ? eio(pr(t, 12.8, 16.6)) : 0;
      tmpC.copy(BIANCO).lerp(ORO, f);
      luci(mix(150, 250, f), mix(52, 22, f), tmpC, mix(2.3, 3.0, f), mix(0.95, 0.78, f), VER >= 3 ? mix(0, 4, es(pr(t, 15.2, 16.8))) : 0);
    };
  } else {
    const lato = P.porta.lato, n = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] }[lato];
    const aD = Math.atan2(n[0], n[1]) / RAD;
    TA = 12.0; // fine della parte aerea, rispetto a O
    // vista dall'alto iniziale con il lato lungo della casa sul lato lungo dello schermo, poi rotazione verso il lato della porta
    let azS = VERT ? (LX >= LZ ? 90 : 0) : (LX >= LZ ? 0 : 90); while (aD - azS > 180) azS += 360; while (aD - azS < -180) azS -= 360;
    const pat = [[0, 1.06, azS, 89.9, 0], [2.4, 1.0, azS, 89.9, 0], [5.0, 0.98, mix(azS, aD, 0.25) - 22, 56, 0.3], [8.0, 0.9, mix(azS, aD, 0.65) - 14, 48, 0.3], [10.6, 0.84, aD - 7, 40, 0.4], [TA, 0.8, aD, 34, 0.5]];
    const orb = hermite(pat.map(([t, r, az, pit, q]) => [t + O, q, dTop(az) * r, az, pit, 30]));
    // la parte aerea si campiona fino a 1 s prima della fine: cosi' non si ferma e prosegue verso la porta senza pause
    for (let t = 0; t <= O + TA - 1.0 + 0.001; t += 0.25) chiavi.push([t, ...orbita(orb(t))]);
    const fuori = (dist, y) => { const p = W(P.porta.x + n[0] * dist, P.porta.z + n[1] * dist, y); return [p.x, p.y, p.z]; };
    // discesa e visita: tempi calcolati da distanza e rotazione, velocita' che cala con continuita' da fuori a dentro
    const PIT = POST ? -6 : VERT ? -9 : -3;
    const seq = [[...fuori(8.0, 3.6), aD, -17, mix(30, FW, 0.6)], [...fuori(2.4, 1.6), aD, PIT, FW]];
    for (const g of P.giro) { const [x, z, yaw, , pit = PIT] = g; const p = W(x, z, 1.6); seq.push([p.x, p.y, p.z, yaw, pit, FW]); }
    let prev = chiavi[chiavi.length - 1], tt = prev[0]; prev = prev.slice(1); let yawPrec = prev[3];
    seq.forEach((k, i) => {
      let y = k[3]; while (y - yawPrec > 180) y -= 360; while (y - yawPrec < -180) y += 360; k[3] = y;
      const d = Math.hypot(k[0] - prev[0], k[1] - prev[1], k[2] - prev[2]), rot = Math.max(Math.abs(y - yawPrec), Math.abs(k[4] - prev[4]));
      const v = i === 0 ? 3.0 : i === 1 ? 2.0 : i === 2 ? 1.2 : 0.95;
      const dt = i === 0 ? Math.max(2.4, d / v) : Math.max(1.0, Math.hypot(d / v, rot / 50));
      tt += dt; chiavi.push([tt, ...k]); prev = k; yawPrec = y; if (i === 1) TD1 = tt - O;
    });
    TC = tt + 0.2; LUNG = TC + 2.6;
    chiavi.push([LUNG, ...chiavi[chiavi.length - 1].slice(1)]);
    const nSt = ORDINE.length;
    let ultimoTetto = null;
    statoScena = t => {
      disegna(t, 0.2, 2.0);
      opacita(D.muri, t < 5.3 ? 1 : 0);
      opacita(D.simboli, es(pr(t, 1.0, 1.6)) * (1 - es(pr(t, 3.0, 3.8))));
      alzaMuri(t, 2.6, 1.4, 1.2);
      aperture(t, 2.6, 1.2, 1.4); porte(t, 4.7, 1.1);
      pavimenti(t, 4.3, 0.9);
      arredo(t, 5.6, Math.min(3.4, 0.5 * nSt), 0.04, 0.75);
      if (casa.ingresso) casa.ingresso.visible = t > 4.4; if (casa.contesto) casa.contesto.visible = t > 4.4;
      const g = es(pr(t, TA - 0.5, TD1));
      tmpC.copy(BIANCO).lerp(CALDO, g);
      const sera = VER >= 3 ? es(pr(t, TD1, TC - O)) : 0; if (sera > 0) tmpC.lerp(ORO, sera);
      luci(mix(150, aD + 35, g) + 25 * sera, mix(mix(50, 34, g), 9, sera), tmpC, mix(mix(2.4, 3.8, g), 2.2, sera), mix(mix(0.95, 0.62, g), 0.3, sera), VER >= 3 ? mix(0, 1.6, g) + 2.2 * sera : 0);
      // soffitti che crescono dal centro di ogni stanza: l'ombra entra gradualmente, niente salto di luce
      const fT = es(pr(t, TA + 0.6, TA + 3.6)); if (fT !== ultimoTetto) { for (const s of casa.soffitti) { s.castShadow = true; s.visible = fT > 0.001; s.scale.set(Math.max(fT, 0.001), 1, Math.max(fT, 0.001)); } ultimoTetto = fT; ombraCambiata = true; }
    };
  }
  // camera: yaw srotolato per continuita'
  for (let i = 1; i < chiavi.length; i++) { while (chiavi[i][4] - chiavi[i - 1][4] > 180) chiavi[i][4] -= 360; while (chiavi[i][4] - chiavi[i - 1][4] < -180) chiavi[i][4] += 360; }
  const cam = hermite(chiavi);
  const eul = new THREE.Euler(0, 0, 0, 'YXZ'); const CAMY = 0;
  function piazzaCamera(v, jx = 0, jy = 0) {
    const [x, y, z, yaw, pit, fov] = v; camera.position.set(x, y, z); eul.set(pit * RAD, yaw * RAD, 0); camera.quaternion.setFromEuler(eul);
    // piano vicino adattivo: lontano quando la camera e' in alto, piu' precisione di profondita'
    const nr = P32 ? cl((y + CAMY - 3.2) * 0.25, 0.05, 1.5) : 0.05;
    if (camera.fov !== fov || Math.abs(camera.near - nr) > 1e-4) { camera.fov = fov; camera.near = nr; camera.updateProjectionMatrix(); }
    camera.setViewOffset(OUTW, OUTH, -SX * OUTW + jx * OUTW / RW, -SY * OUTH + jy * OUTH / RH, OUTW, OUTH);
  }

  // ---------- logo e parola ----------
  const PXU = innerWidth / OUTW;
  const hB = POST ? 140 : VERT ? 132 : 150, hS = POST ? 68 : VERT ? 76 : 62, fB = hB * 0.6, gap = hB * 0.2, mx = POST ? 52 : VERT ? 56 : 48, my = POST ? 56 : VERT ? 72 : 46;
  let parolaW = 0;
  function marchio(T) {
    if (!parolaW) { parola.style.fontSize = (fB * PXU) + 'px'; parolaW = parola.offsetWidth / PXU; }
    const intro = T < TC;
    const m = intro ? eio(pr(T, 3.0, 3.9)) : 1 - eio(pr(T, TC + 0.1, TC + 1.0));
    const app = eo(pr(T, 0.15, 0.85));
    const f = intro ? eo(pr(T, 0.85, 1.55)) * (1 - eio(pr(T, 2.35, 2.95))) : eo(pr(T, TC + 1.0, TC + 1.7));
    const fl = intro ? eio(pr(T, 0.85, 1.55)) * (1 - eio(pr(T, 2.35, 2.95))) : eio(pr(T, TC + 1.0, TC + 1.7));
    velo.style.opacity = Math.max(1 - es(pr(T, 3.1, 3.9)), es(pr(T, TC, TC + 0.75)));
    const lwB = hB * ASP_LOGO, gruppo = lwB + gap + parolaW;
    const bigLeft = mix((OUTW - lwB) / 2, (OUTW - gruppo) / 2, fl), bigTop = (OUTH - hB) / 2;
    const h = mix(hB, hS, m), left = mix(bigLeft, mx, m), top = mix(bigTop, OUTH - my - hS, m), lw = h * ASP_LOGO;
    const s = 0.9 + 0.1 * app;
    logo.style.width = (lw * s * PXU) + 'px'; logo.style.height = (h * s * PXU) + 'px';
    logo.style.transform = `translate(${(left + lw * (1 - s) / 2) * PXU}px, ${(top + h * (1 - s) / 2) * PXU}px)`; logo.style.opacity = app;
    const vis = m < 0.001 && f > 0.001; clip.style.display = vis ? 'block' : 'none';
    if (vis) {
      clip.style.left = ((left + lw / 2) * PXU) + 'px'; clip.style.top = ((top + h / 2 - fB * 0.62) * PXU) + 'px';
      clip.style.width = ((lw / 2 + gap + parolaW + 30) * PXU) + 'px'; clip.style.height = (fB * 1.24 * PXU) + 'px';
      parola.style.top = (fB * 0.14 * PXU) + 'px';
      parola.style.transform = `translateX(${((lw / 2 + gap) - (1 - f) * (lw / 2 + gap + parolaW + 12)) * PXU}px)`;
    }
  }

  // ---------- ciclo ----------
  let T = +(Q.get('t') || 0), ombraFatta = false, ombraCambiata = false;
  const ombraServe = t => UNF ? (t > 2.4 && t < 10.4) || (t > TA - 0.6 && t < (VER >= 3 ? TC - O + 0.1 : TD1 + 0.1)) : (t > 3.85 && t < 16.95);
  function frame() {
    marchio(T);
    rifinitura.uniforms.t.value = T;
    for (let k = 0; k < NS; k++) {
      const ts = NS === 1 ? T : T + ((k + 0.5) / NS - 0.5) * OTT / 60, t = ts - O;
      statoScena(t); piazzaCamera(cam(ts), JIT[k][0], JIT[k][1]);
      renderer.shadowMap.needsUpdate = !ombraFatta || ombraCambiata || ombraServe(t); ombraFatta = true; ombraCambiata = false;
      composer.render();
      quadAcc.material.uniforms.tDiffuse.value = composer.readBuffer.texture; quadAcc.material.uniforms.peso.value = 1 / NS;
      renderer.setRenderTarget(acc); if (k === 0) renderer.clear(); const ac = renderer.autoClear; renderer.autoClear = false; quadAcc.render(renderer); renderer.autoClear = ac;
    }
    renderer.setRenderTarget(null); finale.render();
  }

  // ---------- controlli ----------
  function controlli() {
    const salva = T; statoScena(99); casa.radice.updateMatrixWorld(true);
    const arr = controlliArredo(casa, P), camErr = [];
    if (UNF) {
      const bm = muri.filter(m => !m.userData.battiscopa).map(m => ({ b: new THREE.Box3().setFromObject(m), n: 'muro' }));
      const ba = casa.porte.map(p => ({ b: new THREE.Box3().setFromObject(p), n: 'anta' }));
      const bf = []; for (const id in casa.arredi) for (const p of casa.arredi[id].children) { const b = new THREE.Box3().setFromObject(p); if (!b.isEmpty() && b.max.y > 1.2) bf.push({ b, n: `${p.userData.tipo} in ${id}` }); }
      const v = new THREE.Vector3(); let ultimo = '';
      for (let tt = O + TA; tt <= TC; tt += 0.02) {
        const c = cam(tt); v.set(c[0], c[1], c[2]); if (v.y > H + 0.3) continue;
        for (const { b, n } of [...bm, ...ba, ...bf]) {
          const m = n === 'muro' ? 0.2 : n === 'anta' ? 0.12 : 0.15;
          if (v.x > b.min.x - m && v.x < b.max.x + m && v.z > b.min.z - m && v.z < b.max.z + m && v.y > b.min.y - 0.05 && v.y < b.max.y + 0.05) { const s = `${n} a t=${tt.toFixed(2)} (${(c[0] + CX).toFixed(2)}, ${(c[2] + CZ).toFixed(2)})`; if (s.split(' a t=')[0] !== ultimo) camErr.push(s); ultimo = s.split(' a t=')[0]; break; }
        }
      }
    }
    T = salva; frame();
    return { arredo: arr, camera: camErr, lung: LUNG };
  }

  window.__lung = LUNG;
  window.__adv = dt => { T += dt; };
  window.__frame = frame;
  window.__vai = t => { T = t; ombraFatta = false; frame(); };
  window.__controlli = controlli;
  window.__cam = t => cam(t);
  // anti tremolio: per ogni tempo tre fotogrammi consecutivi; un pixel trema se si discosta dalla media dei vicini nel tempo
  const g2 = document.createElement('canvas');
  window.__glitch = (tempi, soglia = 0.05) => tempi.map(t0 => {
    const fr = []; const w = 480, h = Math.round(480 * tela.height / tela.width); g2.width = w; g2.height = h; const cx = g2.getContext('2d', { willReadFrequently: true });
    for (let k = 0; k < 3; k++) { if (k === 0) { T = t0 - 0.25 / 60; ombraFatta = false; } else T += 0.25 / 60; frame(); cx.drawImage(tela, 0, 0, w, h); const px = cx.getImageData(0, 0, w, h).data; const L = new Float32Array(w * h); for (let i = 0; i < w * h; i++) L[i] = (px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114) / 255; fr.push(L); }
    const N = fr[0].length, Mk = new Uint8Array(N); for (let i = 0; i < N; i++) Mk[i] = Math.abs(2 * fr[1][i] - fr[0][i] - fr[2][i]) / 2 > soglia && Math.abs(fr[0][i] - fr[2][i]) < soglia * 0.5 ? 1 : 0; // lampo: diverso da prima e dopo, che sono uguali tra loro
    // conta solo le macchie: pixel con tutti gli 8 vicini sopra soglia (i contorni in movimento sono linee sottili e si scartano)
    let n = 0; for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (Mk[i] && Mk[i - 1] && Mk[i + 1] && Mk[i - w] && Mk[i + w] && Mk[i - w - 1] && Mk[i - w + 1] && Mk[i + w - 1] && Mk[i + w + 1]) n++; }
    return { t: t0, frazione: +(n / N).toFixed(5) };
  });

  const hdr = await new RGBELoader().loadAsync(new URL('../assets/hdr/studio.hdr', import.meta.url).href);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(hdr).texture; hdr.dispose(); pm.dispose();
  scene.environmentRotation = new THREE.Euler(0, 1.2, 0);
  frame();
  window.__ready = true;
  if (Q.has('play')) { const t0 = performance.now(), T0 = T; const ciclo = () => { T = T0 + (performance.now() - t0) / 1000; frame(); requestAnimationFrame(ciclo); }; ciclo(); }
}
