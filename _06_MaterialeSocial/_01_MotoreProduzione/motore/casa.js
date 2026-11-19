// DepthX, Linea 1.2 FloorView e Unfold: costruzione della casa a partire dai dati della pianta.
// Coordinate di pianta: x da ovest a est, z da nord a sud, in metri. Nel mondo: X = x - OX, Z = z - OZ.
// Arredo: ogni pezzo ha l'origine al centro della sua impronta a terra, il fronte verso +z e il retro verso -z.
// Rotazione r in gradi: 0 fronte a sud, 180 fronte a nord, 90 fronte a est, -90 fronte a ovest.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { arredaAuto } from './arredoAuto.js';
import { LIBRERIA, modello, applicaMateriali } from './libreria.js';
import { portaAuto, giroAuto } from './giroAuto.js';

export const H = 2.7;
let OX = 0, OZ = 0, BX = 0, BZ = 0;
export const W = (x, z, y = 0) => new THREE.Vector3(x - OX, y, z - OZ);
export const inPianta = v => [v.x + OX, v.z + OZ];
const RAD = Math.PI / 180;

// ---------- texture procedurali ----------
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function texLegno() {
  const N = 2048, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); const R = rnd(7);
  g.fillStyle = '#b48a5e'; g.fillRect(0, 0, N, N);
  const listelli = 12, lw = N / listelli;
  for (let i = 0; i < listelli; i++) {
    let y = -R() * N;
    while (y < N) {
      const L = N * (0.38 + R() * 0.4); const h = 26 + R() * 10, l = 52 + R() * 12, s = 30 + R() * 14;
      const x0 = i * lw;
      const grd = g.createLinearGradient(x0, y, x0 + lw, y + L);
      grd.addColorStop(0, `hsl(${h},${s}%,${l}%)`); grd.addColorStop(1, `hsl(${h + 2},${s - 4}%,${l - 5 + R() * 4}%)`);
      g.fillStyle = grd; g.fillRect(x0, y, lw, L);
      g.save(); g.beginPath(); g.rect(x0, y, lw, L); g.clip();
      for (let k = 0; k < 26; k++) {
        g.strokeStyle = `rgba(${70 + R() * 30},${45 + R() * 20},${25},${0.05 + R() * 0.09})`; g.lineWidth = 0.8 + R() * 2.2;
        const xx = x0 + R() * lw, f = 0.004 + R() * 0.01, a = 2 + R() * 6; g.beginPath();
        for (let yy = y; yy < y + L; yy += 8) g.lineTo(xx + Math.sin(yy * f + k) * a, yy);
        g.stroke();
      }
      g.restore();
      g.fillStyle = 'rgba(40,25,12,0.55)'; g.fillRect(x0, y, lw, 2.2); g.fillRect(x0, y, 2.2, L);
      y += L;
    }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function texPietra() {
  const N = 1024, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); const R = rnd(3);
  g.fillStyle = '#d9d6d0'; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const v = 206 + R() * 14; g.fillStyle = `rgb(${v},${v - 3},${v - 8})`; g.fillRect(i * N / 2, j * N / 2, N / 2, N / 2);
    for (let k = 0; k < 900; k++) { const q = R() * 30 - 15; g.fillStyle = `rgba(${120 + q},${118 + q},${112 + q},0.05)`; g.fillRect(i * N / 2 + R() * N / 2, j * N / 2 + R() * N / 2, 2 + R() * 7, 2 + R() * 7); }
  }
  g.fillStyle = '#b9b5ae'; g.fillRect(0, 0, N, 4); g.fillRect(0, N / 2 - 2, N, 4); g.fillRect(0, 0, 4, N); g.fillRect(N / 2 - 2, 0, 4, N);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function texDeck() {
  const N = 1024, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); const R = rnd(17);
  g.fillStyle = '#6f655a'; g.fillRect(0, 0, N, N);
  const n = 8, lw = N / n;
  for (let i = 0; i < n; i++) {
    const v = 150 + R() * 18; g.fillStyle = `rgb(${v},${v - 14},${v - 30})`; g.fillRect(i * lw + 3, 0, lw - 6, N);
    for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(80,62,44,${0.05 + R() * 0.07})`; g.lineWidth = 1 + R() * 2; const xx = i * lw + 6 + R() * (lw - 12); g.beginPath(); g.moveTo(xx, 0); g.lineTo(xx + (R() - 0.5) * 6, N); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function texTessuto(col, seed) {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); const R = rnd(seed);
  g.fillStyle = col; g.fillRect(0, 0, N, N);
  for (let k = 0; k < 5000; k++) { g.fillStyle = `rgba(${R() < .5 ? 255 : 0},${R() < .5 ? 255 : 0},${R() < .5 ? 255 : 0},0.035)`; g.fillRect(R() * N, R() * N, 1, 2 + R() * 3); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(3, 3); return t;
}
function quadro(fondo, a, b, seed, tondo = true) {
  const N = 512, c = document.createElement('canvas'); c.width = N; c.height = Math.round(N * 0.66); const g = c.getContext('2d'); const R = rnd(seed);
  g.fillStyle = fondo; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = a; g.beginPath(); if (tondo) g.arc(c.width * 0.36, c.height * 0.55, c.height * 0.3, 0, Math.PI * 2); else g.rect(c.width * 0.18, c.height * 0.3, c.width * 0.3, c.height * 0.5); g.fill();
  g.fillStyle = b; g.fillRect(c.width * 0.55, c.height * 0.18, c.width * 0.08, c.height * 0.66);
  g.strokeStyle = b; g.lineWidth = 3; g.beginPath(); g.moveTo(c.width * 0.12, c.height * 0.86); g.lineTo(c.width * 0.88, c.height * 0.86); g.stroke();
  for (let k = 0; k < 3000; k++) { g.fillStyle = `rgba(0,0,0,${R() * 0.04})`; g.fillRect(R() * c.width, R() * c.height, 1, 1); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- materiali (palette neutra del V1) ----------
export function materiali() {
  const legno = texLegno(), pietra = texPietra(), deck = texDeck();
  const M = {
    muro: new THREE.MeshStandardMaterial({ color: 0xf3f1ec, roughness: 0.92 }),
    battiscopa: new THREE.MeshStandardMaterial({ color: 0xfaf9f6, roughness: 0.5 }),
    tela: [quadro('#d9cbb6', '#b8735a', '#2f4858', 11), quadro('#e9e4da', '#8e9a86', '#1d1f22', 12), quadro('#efe9df', '#2f4858', '#c8a46a', 13, false)].map(t => new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 })),
    taglio: new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.75 }),
    pavLegno: new THREE.MeshStandardMaterial({ map: legno, roughness: 0.48, metalness: 0, transparent: true }),
    pavPietra: new THREE.MeshStandardMaterial({ map: pietra, roughness: 0.32, transparent: true }),
    pavDeck: new THREE.MeshStandardMaterial({ map: deck, roughness: 0.7, transparent: true }),
    soffitto: new THREE.MeshStandardMaterial({ color: 0xf7f6f2, roughness: 0.95 }),
    prato: Object.assign(new THREE.MeshStandardMaterial({ color: 0x7a9a5a, roughness: 0.95 }), { userData: { metriTrama: 2.0 } }), // versione 3: prato del contesto, la trama Grass004 arriva dalla libreria
    rovere: new THREE.MeshStandardMaterial({ map: legno, color: 0xe9d6bc, roughness: 0.5 }),
    noce: new THREE.MeshStandardMaterial({ map: legno, color: 0x8a6a50, roughness: 0.45 }),
    teak: new THREE.MeshStandardMaterial({ map: deck, color: 0xd9c4a8, roughness: 0.6 }),
    laccatoB: new THREE.MeshStandardMaterial({ color: 0xf1efe9, roughness: 0.35 }),
    laccatoG: new THREE.MeshStandardMaterial({ color: 0xc9c4ba, roughness: 0.4 }),
    salvia: new THREE.MeshStandardMaterial({ color: 0x8e9a86, roughness: 0.55 }),
    quarzo: new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.18 }),
    nero: new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: 0.4, metalness: 0.4 }),
    antracite: new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.5, metalness: 0.3 }),
    ottone: new THREE.MeshStandardMaterial({ color: 0xc8a46a, roughness: 0.3, metalness: 1 }),
    acciaio: new THREE.MeshStandardMaterial({ color: 0xd0d2d4, roughness: 0.25, metalness: 1 }),
    tessuto: new THREE.MeshPhysicalMaterial({ map: texTessuto('#cfc9bf', 1), roughness: 0.95, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffffff) }),
    tessutoScuro: new THREE.MeshPhysicalMaterial({ map: texTessuto('#5d6168', 2), roughness: 0.95, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xaaaaaa) }),
    terracotta: new THREE.MeshPhysicalMaterial({ map: texTessuto('#b8735a', 3), roughness: 0.95, sheen: 0.8, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffd0b0) }),
    lino: new THREE.MeshPhysicalMaterial({ map: texTessuto('#f2efe9', 4), roughness: 0.95, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffffff) }),
    esterno: new THREE.MeshStandardMaterial({ map: texTessuto('#e4e0d8', 8), roughness: 0.95 }),
    tappeto: new THREE.MeshStandardMaterial({ map: texTessuto('#d8d0c2', 5), roughness: 1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), // sempre sopra il pavimento: niente sfarfallio da lontano
    tappetoScuro: new THREE.MeshStandardMaterial({ map: texTessuto('#7a746c', 6), roughness: 1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
    vetro: new THREE.MeshPhysicalMaterial({ color: 0xdfe9ee, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16, envMapIntensity: 1.6, depthWrite: false }),
    telaio: new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.45, metalness: 0.5 }),
    ceramica: new THREE.MeshStandardMaterial({ color: 0xfbfbfa, roughness: 0.12 }),
    internoVasca: new THREE.MeshStandardMaterial({ color: 0xe6ecee, roughness: 0.1 }),
    foglia: new THREE.MeshStandardMaterial({ color: 0x4f6b3f, roughness: 0.6, side: THREE.DoubleSide }),
    vaso: new THREE.MeshStandardMaterial({ color: 0xe6e1d8, roughness: 0.7 }),
    schermo: new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.12, metalness: 0.2 }),
    paralume: new THREE.MeshStandardMaterial({ color: 0xf6efe2, roughness: 0.8, emissive: 0xffc88a, emissiveIntensity: 0 }),
    libri: [0x8a6a50, 0x2f4858, 0xc9b79c, 0x6b7d6a, 0xa65f46, 0xe8e2d6].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })),
  };
  // davanzali: pietra chiara opaca (il marmo venato e lucido brilla a puntini sul listello sottile)
  M.davanzale = new THREE.MeshStandardMaterial({ color: 0xe9e5dd, roughness: 0.7, metalness: 0 });
  applicaMateriali(M);
  return M;
}

// ---------- geometrie di base ----------
const geoCache = new Map();
function rbox(w, h, d, r = 0.02) { const k = [w, h, d, r].map(v => v.toFixed(3)).join('|'); if (!geoCache.has(k)) geoCache.set(k, new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2) * 0.999)); return geoCache.get(k); }
function box(w, h, d) { const k = 'b' + [w, h, d].map(v => v.toFixed(3)).join('|'); if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d)); return geoCache.get(k); }
function mesh(geo, mat, x, y, z, ry = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; return m; }
function blocco(g, mat, cx, y0, cz, w, h, d, r = 0.02) { const m = mesh(r > 0 ? rbox(w, h, d, r) : box(w, h, d), mat, cx, y0 + h / 2, cz); g.add(m); return m; }
function cil(g, mat, cx, y0, cz, rt, rb, h, seg = 24) { const m = mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, cx, y0 + h / 2, cz); g.add(m); return m; }
const PRED = { fin: [0.9, 2.3], pf: [0, 2.4], porta: [0, 2.1], blindata: [0, 2.2], varco: [0, 2.4] };
function leggiAp(a) { const [p0, p1, tipo] = a; const d = PRED[tipo]; return { p0, p1, tipo, dav: a[3] ?? d[0], arch: a[4] ?? d[1], verso: a[5] ?? 1, cardine: a[6] ?? 0 }; }

// ---------- libreria degli arredi ----------
function libreria(M, casa) {
  const luce = (g, x, y, z, dist = 4.5) => { const L = new THREE.PointLight(0xffb978, 0, dist, 2); L.position.set(x, y, z); L.castShadow = false; g.add(L); casa.lampade.push(L); return L; };
  const L = {
    tappeto(g, o) { blocco(g, o.scuro ? M.tappetoScuro : M.tappeto, 0, 0, 0, o.w || 2.4, 0.012, o.d || 1.7, 0.004); },
    divano(g, o) {
      const L = o.L || 2.4, P = o.P || 0.95, m = M[o.mat || 'tessuto'];
      blocco(g, m, 0, 0.08, 0, L, 0.34, P, 0.06);
      blocco(g, m, 0, 0.08, -P / 2 + 0.11, L, 0.78, 0.22, 0.07);
      blocco(g, m, -L / 2 + 0.11, 0.08, 0.02, 0.22, 0.6, P - 0.04, 0.07); blocco(g, m, L / 2 - 0.11, 0.08, 0.02, 0.22, 0.6, P - 0.04, 0.07);
      const n = L > 2 ? 3 : 2;
      for (let i = 0; i < n; i++) blocco(g, m, -L / 2 + 0.22 + (i + 0.5) * (L - 0.44) / n, 0.42, 0.06, (L - 0.44) / n - 0.02, 0.16, P - 0.28, 0.07);
      blocco(g, M.terracotta, -L / 2 + 0.6, 0.55, -P / 2 + 0.25, 0.48, 0.42, 0.14, 0.06); blocco(g, M.tessutoScuro, L / 2 - 0.6, 0.55, -P / 2 + 0.25, 0.48, 0.42, 0.14, 0.06);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cil(g, M.nero, sx * (L / 2 - 0.08), 0, sz * (P / 2 - 0.08), 0.02, 0.02, 0.08, 8);
      if (o.chaise) { const s = o.chaise; blocco(g, m, s * (L / 2 - 0.45), 0.08, P / 2 + 0.45, 0.9, 0.34, 0.9, 0.06); blocco(g, m, s * (L / 2 - 0.45), 0.42, P / 2 + 0.45, 0.86, 0.16, 0.86, 0.07); }
    },
    poltrona(g, o) {
      const m = M[o.mat || 'terracotta'];
      blocco(g, m, 0, 0.18, 0, 0.8, 0.26, 0.8, 0.08); blocco(g, m, 0, 0.18, -0.32, 0.8, 0.62, 0.18, 0.08);
      blocco(g, m, -0.34, 0.18, 0.02, 0.14, 0.44, 0.74, 0.06); blocco(g, m, 0.34, 0.18, 0.02, 0.14, 0.44, 0.74, 0.06);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cil(g, M.noce, sx * 0.3, 0, sz * 0.3, 0.02, 0.015, 0.18, 8);
    },
    tavolino(g, o) {
      const r = o.r || 0.5; cil(g, M.rovere, 0, 0.36, 0, r, r, 0.04, 48); cil(g, M.nero, 0, 0, 0, 0.05, 0.12, 0.36, 16);
      blocco(g, M.libri[3], -0.15, 0.4, 0.05, 0.24, 0.035, 0.32, 0.004); blocco(g, M.libri[0], -0.15, 0.435, 0.05, 0.2, 0.03, 0.28, 0.004); cil(g, M.vaso, r * 0.4, 0.4, -0.12, 0.06, 0.05, 0.18, 20);
    },
    mobileTV(g, o) {
      const L = o.L || 2.2; blocco(g, M.noce, 0, 0.12, 0, L, 0.42, 0.42, 0.01); for (const sx of [-1, 1]) blocco(g, M.nero, sx * (L / 2 - 0.1), 0, 0, 0.04, 0.12, 0.36, 0.005);
      blocco(g, M.schermo, 0, 0.6, -0.08, Math.min(1.45, L * 0.66), 0.83, 0.03, 0.008); blocco(g, M.nero, 0, 0.54, -0.08, 0.3, 0.06, 0.18, 0.01);
      blocco(g, M.vaso, L / 2 - 0.25, 0.54, 0, 0.16, 0.3, 0.16, 0.06);
    },
    tavolo(g, o) {
      const L = o.L || 1.8, P = o.P || 0.92, n = o.n ?? 3;
      blocco(g, M[o.piano || 'rovere'], 0, 0.71, 0, L, 0.04, P, 0.01);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) blocco(g, M.nero, sx * (L / 2 - 0.1), 0, sz * (P / 2 - 0.08), 0.04, 0.71, 0.04, 0.004);
      const sedia = (x, z, ry) => { const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = ry; g.add(s); blocco(s, M.lino, 0, 0.43, 0, 0.44, 0.05, 0.44, 0.02); blocco(s, M.lino, 0, 0.48, -0.2, 0.44, 0.4, 0.04, 0.02); for (const a of [-1, 1]) for (const b of [-1, 1]) blocco(s, M.noce, a * 0.19, 0, b * 0.19, 0.03, 0.43, 0.03, 0.004); };
      for (let i = 0; i < n; i++) { const x = -L / 2 + (i + 0.5) * L / n; sedia(x, -(P / 2 + 0.26), 0); sedia(x, P / 2 + 0.26, Math.PI); }
      if (o.testate) { sedia(-(L / 2 + 0.26), 0, Math.PI / 2); sedia(L / 2 + 0.26, 0, -Math.PI / 2); }
      cil(g, M.vaso, 0, 0.75, 0, 0.09, 0.07, 0.2, 20);
      if (o.luce !== false) { const p = cil(g, M.ottone, 0, 1.92, 0, 0.04, 0.3, 0.2, 32); p.castShadow = false; cil(g, M.nero, 0, 2.12, 0, 0.004, 0.004, H - 2.12, 4); luce(g, 0, 1.85, 0); }
    },
    cucina(g, o) {
      const L = o.L || 3.2, m = M[o.colore || 'salvia'];
      blocco(g, m, 0, 0.1, 0, L, 0.78, 0.62, 0.01); blocco(g, M.quarzo, 0, 0.88, 0.01, L + 0.02, 0.04, 0.66, 0.006);
      blocco(g, M.nero, 0, 0, 0.03, L, 0.1, 0.56, 0.002);
      const n = Math.max(2, Math.round(L / 0.6)); for (let i = 0; i < n; i++) blocco(g, M.nero, -L / 2 + (i + 0.5) * L / n, 0.8, 0.32, 0.22, 0.012, 0.012, 0.004);
      const lav = o.lav ?? -L * 0.18, fu = o.fuochi ?? L * 0.25;
      blocco(g, M.acciaio, lav, 0.905, 0.02, 0.62, 0.012, 0.42, 0.01); cil(g, M.acciaio, lav, 0.9, -0.24, 0.012, 0.012, 0.32, 8);
      blocco(g, M.nero, fu, 0.905, 0.04, 0.6, 0.008, 0.5, 0.01);
      if (o.cappa !== false) { blocco(g, M.acciaio, fu, 1.62, -0.06, 0.62, 0.06, 0.48, 0.006); blocco(g, M.acciaio, fu, 1.68, -0.2, 0.26, H - 1.68, 0.2, 0.004); }
      if (o.pensili) { const lp = (L - 0.7) / 2; for (const s of [-1, 1]) { const cx = s * (L / 2 - lp / 2); if (lp > 0.3) blocco(g, m, cx, 1.5, -0.13, lp, 0.7, 0.36, 0.01); } }
    },
    colonne(g, o) {
      const L = o.L || 1.2, m = M[o.colore || 'salvia']; blocco(g, m, 0, 0, 0, L, 2.3, 0.62, 0.01);
      blocco(g, M.nero, -L / 4, 1.0, 0.315, Math.min(0.56, L / 2 - 0.04), 0.5, 0.012, 0.004);
      blocco(g, M.nero, L / 2 - 0.08, 1.4, 0.32, 0.012, 0.5, 0.012, 0.003); blocco(g, M.nero, -L / 2 + 0.08, 0.5, 0.32, 0.012, 0.4, 0.012, 0.003);
    },
    isola(g, o) {
      const L = o.L || 2.3, P = o.P || 1.0; blocco(g, M[o.colore || 'rovere'], 0, 0, 0, L, 0.9, P, 0.02); blocco(g, M.quarzo, 0, 0.9, 0.07, L + 0.1, 0.04, P + 0.14, 0.008);
      cil(g, M.vaso, -L * 0.3, 0.94, -0.15, 0.12, 0.09, 0.08, 24);
      const ns = o.sgabelli ?? 3; for (let i = 0; i < ns; i++) { const x = ns === 1 ? 0 : -L * 0.32 + i * (L * 0.64) / (ns - 1); const s = new THREE.Group(); s.position.set(x, 0, P / 2 + 0.32); g.add(s); cil(s, M.lino, 0, 0.66, 0, 0.19, 0.18, 0.06, 24); cil(s, M.nero, 0, 0, 0, 0.02, 0.02, 0.66, 8); cil(s, M.nero, 0, 0, 0, 0.17, 0.18, 0.015, 24); cil(s, M.nero, 0, 0.28, 0, 0.16, 0.16, 0.012, 24); }
      for (let i = 0; i < 3; i++) { const x = -L / 3 + i * L / 3; const p = cil(g, M.nero, x, 1.82, 0, 0.05, 0.13, 0.18, 24); p.castShadow = false; cil(g, M.nero, x, 2.0, 0, 0.003, 0.003, H - 2.0, 4); }
      if (o.luce !== false) luce(g, 0, 1.75, 0, 5);
    },
    letto(g, o) {
      const w = o.w || 1.8, L = o.L || 2.0;
      blocco(g, M.rovere, 0, 0.12, 0, w, 0.2, L, 0.02); blocco(g, M.lino, 0, 0.32, 0.02, w - 0.04, 0.2, L - 0.08, 0.06);
      blocco(g, M.lino, 0, 0.5, L * 0.12, w, 0.06, L * 0.78, 0.03); blocco(g, M[o.plaid || 'salvia'], 0, 0.53, L / 2 - 0.27, w + 0.04, 0.05, 0.45, 0.02);
      if (w > 1.3) { for (const sx of [-1, 1]) blocco(g, M.lino, sx * w / 4, 0.5, -L / 2 + 0.23, w / 2 - 0.1, 0.15, 0.36, 0.07); } else blocco(g, M.lino, 0, 0.5, -L / 2 + 0.23, w - 0.2, 0.15, 0.36, 0.07);
      blocco(g, M[o.testata || 'tessutoScuro'], 0, 0.12, -L / 2 - 0.03, w + 0.3, 1.05, 0.08, 0.03);
    },
    comodino(g, o) {
      blocco(g, M.noce, 0, 0.12, 0, 0.42, 0.38, 0.42, 0.015); for (const a of [-1, 1]) for (const b of [-1, 1]) blocco(g, M.nero, a * 0.18, 0, b * 0.18, 0.02, 0.12, 0.02, 0.003);
      const lt = cil(g, M.paralume, 0, 0.52, 0, 0.1, 0.12, 0.2, 20); lt.castShadow = false; cil(g, M.ottone, 0, 0.5, 0, 0.015, 0.015, 0.02, 8);
    },
    armadio(g, o) {
      const L = o.L || 2.4, P = o.P || 0.62, h = o.h || 2.4; blocco(g, M[o.colore || 'laccatoB'], 0, 0, 0, L, h, P, 0.01);
      const n = Math.max(2, Math.round(L / 0.6)); for (let i = 1; i < n; i++) blocco(g, M.laccatoG, -L / 2 + i * L / n, 0.05, P / 2 + 0.002, 0.006, h - 0.1, 0.004, 0.001);
    },
    scrivania(g, o) {
      const L = o.L || 1.4; blocco(g, M.rovere, 0, 0.72, 0, L, 0.035, 0.65, 0.008); for (const sx of [-1, 1]) blocco(g, M.nero, sx * (L / 2 - 0.05), 0, 0, 0.035, 0.72, 0.6, 0.004);
      blocco(g, M.acciaio, 0.1, 0.755, 0.05, 0.36, 0.012, 0.25, 0.006); blocco(g, M.schermo, -0.2, 0.76, -0.2, 0.5, 0.32, 0.02, 0.004); blocco(g, M.nero, -0.2, 0.755, -0.2, 0.12, 0.01, 0.12, 0.003);
      const ch = new THREE.Group(); ch.position.set(0, 0, 0.62); g.add(ch); blocco(ch, M.tessutoScuro, 0, 0.42, 0, 0.5, 0.08, 0.48, 0.03); blocco(ch, M.tessutoScuro, 0, 0.5, 0.22, 0.48, 0.5, 0.06, 0.03); cil(ch, M.acciaio, 0, 0, 0, 0.025, 0.025, 0.42, 8); cil(ch, M.nero, 0, 0, 0, 0.28, 0.3, 0.03, 5);
    },
    libreria(g, o) {
      const L = o.L || 1.6, h = o.h || 2.1, R = rnd(o.seed || 31); const m = M[o.mat || 'noce'];
      blocco(g, m, 0, 0, -0.15, L, h, 0.02, 0.004); for (const sx of [-1, 1]) blocco(g, m, sx * (L / 2 - 0.015), 0, 0, 0.03, h, 0.32, 0.004);
      const nr = Math.floor(h / 0.42);
      for (let r = 0; r <= nr; r++) { const y = Math.min(r * 0.42, h - 0.025); blocco(g, m, 0, y, 0, L - 0.04, 0.025, 0.3, 0.003); if (r === nr) break; let x = -L / 2 + 0.05; while (x < L / 2 - 0.12) { const w = 0.03 + R() * 0.04, hh = 0.24 + R() * 0.12; if (R() < 0.78) blocco(g, M.libri[Math.floor(R() * 6)], x + w / 2, y + 0.025, -0.03, w, hh, 0.22, 0.003); x += w + 0.004; } }
    },
    lavabo(g, o) {
      const L = o.L || 1.0; blocco(g, M.noce, 0, 0.45, 0, L, 0.42, 0.5, 0.01); blocco(g, M.quarzo, 0, 0.87, 0, L + 0.02, 0.03, 0.52, 0.006);
      const xs = o.doppio ? [-L / 4, L / 4] : [0]; for (const x of xs) { cil(g, M.ceramica, x, 0.9, 0.02, 0.2, 0.17, 0.12, 32); cil(g, M.nero, x, 0.9, -0.17, 0.012, 0.012, 0.22, 8); }
      blocco(g, M.acciaio, 0, 1.15, -0.24, L * 0.9, 0.75, 0.02, 0.01);
    },
    wc(g) { blocco(g, M.ceramica, 0, 0, 0.05, 0.38, 0.4, 0.55, 0.12); blocco(g, M.ceramica, 0, 0.28, -0.2, 0.38, 0.5, 0.16, 0.04); },
    bidet(g) { blocco(g, M.ceramica, 0, 0, 0.04, 0.36, 0.4, 0.52, 0.12); cil(g, M.nero, 0, 0.4, -0.15, 0.012, 0.012, 0.1, 8); },
    doccia(g, o) {
      const w = o.w || 0.9, d = o.d || 0.9; blocco(g, M.quarzo, 0, 0, 0, w, 0.04, d, 0.01);
      const vz = blocco(g, M.vetro, (o.aperta || 0) * 0.2, 0.04, d / 2, w - 0.4 * Math.abs(o.aperta || 0) - 0.01, 1.95, 0.012, 0.002); vz.castShadow = false;
      if (o.lato) { const v = blocco(g, M.vetro, o.lato * w / 2, 0.04, 0, 0.012, 1.95, d, 0.002); v.castShadow = false; blocco(g, M.nero, o.lato * w / 2, 1.98, 0, 0.02, 0.02, d, 0.004); }
      blocco(g, M.nero, 0, 1.98, d / 2, w - 0.02, 0.02, 0.02, 0.004); cil(g, M.nero, 0, 2.05, -d / 2 + 0.25, 0.12, 0.12, 0.01, 24); cil(g, M.nero, 0, 1.0, -d / 2 + 0.03, 0.012, 0.012, 1.05, 8);
    },
    vasca(g, o) {
      const L = o.L || 1.7, P = o.P || 0.75; blocco(g, M.ceramica, 0, 0, 0, L, 0.56, P, 0.06); blocco(g, M.internoVasca, 0, 0.47, 0, L - 0.14, 0.1, P - 0.14, 0.05);
      cil(g, M.nero, -L / 2 + 0.12, 0.56, -P / 2 + 0.1, 0.015, 0.015, 0.2, 8);
    },
    lavatrice(g) { blocco(g, M.laccatoB, 0, 0, 0, 0.6, 0.85, 0.6, 0.02); const o = cil(g, M.nero, 0, 0.42, 0.3, 0.17, 0.17, 0.02, 32); o.rotation.x = Math.PI / 2; o.position.y = 0.45; },
    pianta(g, o) {
      const s = o.s || 1, R = rnd(o.seed || 1); if (!o.senzaVaso) cil(g, M.vaso, 0, 0, 0, 0.2 * s, 0.15 * s, 0.42 * s, 24);
      const fg = new THREE.SphereGeometry(1, 10, 6);
      for (let i = 0; i < 26; i++) { const a = R() * Math.PI * 2, e = 0.25 + R() * 0.9; const f = new THREE.Mesh(fg, M.foglia); const Lf = (0.32 + R() * 0.25) * s;
        f.scale.set(0.1 * s, 0.012 * s, Lf / 2); const r = (0.1 + R() * 0.12) * s; f.position.set(Math.cos(a) * r, (0.5 + e * 0.75) * s, Math.sin(a) * r); f.rotation.set(-0.9 + R() * 0.5, -a + Math.PI / 2, 0, 'YXZ'); f.castShadow = true; g.add(f); }
      for (let i = 0; i < 5; i++) { const st = mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.9 * s, 5), M.noce, 0, 0.75 * s, 0); st.rotation.set((R() - .5) * .4, 0, (R() - .5) * .4); g.add(st); }
    },
    lampada(g, o) {
      const h = o.h || 1.6; cil(g, M.nero, 0, 0, 0, 0.14, 0.15, 0.025, 24); cil(g, M.nero, 0, 0.02, 0, 0.02, 0.02, h - 0.3, 20);
      const pl = cil(g, M.paralume, 0, h - 0.3, 0, 0.17, 0.22, 0.3, 28); pl.castShadow = false; if (o.luce !== false) luce(g, 0, h - 0.2, 0);
    },
    sospensione(g, o) { const y = o.y || 1.95; const p = cil(g, M[o.mat || 'nero'], 0, y, 0, 0.05, 0.2, 0.2, 28); p.castShadow = false; cil(g, M.nero, 0, y + 0.2, 0, 0.003, 0.003, H - y - 0.2, 4); if (o.luce !== false) luce(g, 0, y - 0.08, 0); },
    plafoniera(g, o) { const d = cil(g, M.paralume, 0, H - 0.06, 0, 0.22, 0.22, 0.06, 32); d.castShadow = false; if (o.luce !== false) luce(g, 0, H - 0.3, 0, 6); },
    quadro(g, o) { const w = o.w || 1.0, h = o.h || 0.7, y = o.y || 1.35; blocco(g, M.noce, 0, y, 0.0175, w, h, 0.035, 0.004); blocco(g, M.tela[o.v || 0], 0, y + 0.03, 0.036, w - 0.06, h - 0.06, 0.02, 0.002); },
    tende(g, o) { // superficie unica a onde morbide: niente spigoli sottili che sfarfallano
      const L = o.L || 0.4, h = o.h || 2.55, onda = 0.14, amp = 0.022;
      const geo = new THREE.PlaneGeometry(L, h, Math.max(24, Math.round(L / onda) * 12), 1); const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setZ(i, 0.06 + amp * Math.sin((x + L / 2) / onda * Math.PI * 2)); }
      geo.computeVertexNormals(); const mt = M.lino.clone(); mt.side = THREE.DoubleSide;
      const m = mesh(geo, mt, 0, 0.02 + h / 2, 0); g.add(m); },
    consolle(g, o) {
      const L = o.L || 1.2; blocco(g, M.noce, 0, 0.78, 0, L, 0.05, 0.36, 0.01); for (const sx of [-1, 1]) blocco(g, M.nero, sx * (L / 2 - 0.05), 0, 0, 0.03, 0.78, 0.3, 0.005);
      blocco(g, M.acciaio, 0, 1.05, -0.17, Math.min(0.8, L * 0.7), 0.9, 0.02, 0.01); cil(g, M.vaso, L / 2 - 0.2, 0.83, 0, 0.07, 0.06, 0.26, 16); blocco(g, M.libri[2], -L / 2 + 0.25, 0.83, 0, 0.3, 0.04, 0.22, 0.004);
    },
    panca(g, o) { const L = o.L || 1.1; blocco(g, M.rovere, 0, 0.42, 0, L, 0.05, 0.38, 0.01); for (const sx of [-1, 1]) blocco(g, M.nero, sx * (L / 2 - 0.05), 0, 0, 0.03, 0.42, 0.34, 0.004); },
    divanoEsterno(g, o) {
      const L = o.L || 2.0; blocco(g, M.teak, 0, 0.04, 0, L, 0.22, 0.85, 0.02); blocco(g, M.esterno, 0, 0.26, 0.04, L - 0.06, 0.14, 0.76, 0.05); blocco(g, M.esterno, 0, 0.26, -0.33, L - 0.06, 0.42, 0.16, 0.05);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) blocco(g, M.antracite, sx * (L / 2 - 0.05), 0, sz * 0.36, 0.05, 0.05, 0.05, 0.005);
    },
    poltronaEsterna(g) { blocco(g, M.antracite, 0, 0.05, 0, 0.72, 0.2, 0.72, 0.02); blocco(g, M.esterno, 0, 0.25, 0.04, 0.66, 0.12, 0.62, 0.05); blocco(g, M.esterno, 0, 0.25, -0.28, 0.66, 0.42, 0.14, 0.05); blocco(g, M.antracite, 0, 0, 0, 0.6, 0.05, 0.6, 0.005); },
    tavolinoEsterno(g, o) { const r = o.r || 0.35; cil(g, M.antracite, 0, 0.42, 0, r, r, 0.03, 32); cil(g, M.antracite, 0, 0, 0, 0.03, 0.18, 0.42, 12); },
    tavoloEsterno(g, o) {
      const L = o.L || 1.6, P = 0.85, n = o.n ?? 2; blocco(g, M.teak, 0, 0.72, 0, L, 0.04, P, 0.008); for (const sx of [-1, 1]) for (const sz of [-1, 1]) blocco(g, M.antracite, sx * (L / 2 - 0.08), 0, sz * (P / 2 - 0.08), 0.05, 0.72, 0.05, 0.004);
      const sedia = (x, z, ry) => { const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = ry; g.add(s); blocco(s, M.esterno, 0, 0.42, 0, 0.46, 0.06, 0.46, 0.02); blocco(s, M.antracite, 0, 0.45, -0.21, 0.46, 0.4, 0.03, 0.01); for (const a of [-1, 1]) for (const b of [-1, 1]) blocco(s, M.antracite, a * 0.2, 0, b * 0.2, 0.025, 0.42, 0.025, 0.004); };
      for (let i = 0; i < n; i++) { const x = -L / 2 + (i + 0.5) * L / n; sedia(x, -(P / 2 + 0.28), 0); sedia(x, P / 2 + 0.28, Math.PI); }
    },
    lettino(g) { blocco(g, M.teak, 0, 0.08, 0.1, 0.68, 0.18, 1.6, 0.02); blocco(g, M.esterno, 0, 0.26, 0.2, 0.64, 0.08, 1.38, 0.03); const sc = blocco(g, M.esterno, 0, 0.3, -0.62, 0.64, 0.08, 0.6, 0.03); sc.rotation.x = -0.55; sc.position.y += 0.14; for (const sx of [-1, 1]) for (const sz of [-0.65, 0.85]) blocco(g, M.antracite, sx * 0.28, 0, sz, 0.04, 0.08, 0.04, 0.004); },
    vasoGrande(g, o) { const s = o.s || 1.3; blocco(g, M.antracite, 0, 0, 0, 0.5 * s, 0.5 * s, 0.5 * s, 0.02); L.pianta(g, { s: s * 0.95, seed: o.seed || 5, senzaVaso: true }); },
  };
  // modelli veri della libreria (Poly Haven CC0) al posto delle forme semplici, se caricati
  if (LIBRERIA.pronta) {
    const P0 = { ...L };
    const metti = (g, m, x = 0, y = 0, z = 0, ry = 0) => { m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m; };
    L.poltrona = (g, o) => { const m = modello(o.girevole ? 'poltronaGirevole' : 'poltrona', { x: 0.8 }); if (!m) return P0.poltrona(g, o); metti(g, m); };
    L.tavolino = (g, o) => { const r = o.r || 0.5, m = modello('tavolino', { x: 2 * r, y: 0.4 }); if (!m) return P0.tavolino(g, o); metti(g, m); const h = m.userData.dim.y;
      blocco(g, M.libri[3], -0.15, h, 0.05, 0.24, 0.035, 0.32, 0.004); blocco(g, M.libri[0], -0.15, h + 0.035, 0.05, 0.2, 0.03, 0.28, 0.004); cil(g, M.vaso, r * 0.4, h, -0.12, 0.06, 0.05, 0.18, 20); };
    L.comodino = (g, o) => { const m = modello('comodino', { x: 0.45, y: 0.5 }); if (!m) return P0.comodino(g, o); metti(g, m); const h = m.userData.dim.y;
      const lt = cil(g, M.paralume, 0, h + 0.02, 0, 0.1, 0.12, 0.2, 20); lt.castShadow = false; cil(g, M.ottone, 0, h, 0, 0.015, 0.015, 0.02, 8); };
    L.pianta = (g, o) => { if (o.senzaVaso) return P0.pianta(g, o); const s = o.s || 1, R = rnd(o.seed || 1); const k = (o.seed || 1) % 2 ? 'pianta0' : 'pianta1';
      const m = modello(k, { y: (k === 'pianta0' ? 1.3 : 0.95) * s }); if (!m) return P0.pianta(g, o); metti(g, m, 0, 0, 0, R() * Math.PI * 2); };
    // mobile TV: il modello della libreria ha listelli fini che creano moire in movimento; resta quello del motore
    L.libreria = (g, o) => { const m = modello('libreria', { x: o.L || 1.6, y: o.h || 2.1, z: 0.34 }); if (!m) return P0.libreria(g, o); metti(g, m); };
    const lampada = (g, y0) => { const m = modello('sospensione', { x: 0.34 }); if (!m) return false; const d = m.userData.dim.y; m.scale.y *= (H - y0) / d; metti(g, m, 0, y0, 0); return true; };
    L.sospensione = (g, o) => { const y = o.y || 1.95; if (!lampada(g, y - 0.25)) return P0.sospensione(g, o); if (o.luce !== false) luce(g, 0, y - 0.3, 0); };
    L.tavolo = (g, o) => {
      if (!LIBRERIA.modelli.sedia) return P0.tavolo(g, o);
      const Lt = o.L || 1.8, Pt = o.P || 0.92, n = o.n ?? 3;
      blocco(g, M[o.piano || 'rovere'], 0, 0.71, 0, Lt, 0.04, Pt, 0.01);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) blocco(g, M.nero, sx * (Lt / 2 - 0.1), 0, sz * (Pt / 2 - 0.08), 0.04, 0.71, 0.04, 0.004);
      const sedia = (x, z, ry) => metti(g, modello('sedia', { y: 0.95 }), x, 0, z, ry);
      for (let i = 0; i < n; i++) { const x = -Lt / 2 + (i + 0.5) * Lt / n; sedia(x, -(Pt / 2 + 0.2), 0); sedia(x, Pt / 2 + 0.2, Math.PI); }
      if (o.testate) { sedia(-(Lt / 2 + 0.24), 0, Math.PI / 2); sedia(Lt / 2 + 0.24, 0, -Math.PI / 2); }
      cil(g, M.vaso, 0, 0.75, 0, 0.09, 0.07, 0.2, 20);
      if (o.luce !== false) { if (!lampada(g, 1.62)) { const p = cil(g, M.ottone, 0, 1.92, 0, 0.04, 0.3, 0.2, 32); p.castShadow = false; } luce(g, 0, 1.6, 0); }
    };
  }
  return L;
}

// ---------- costruzione ----------
// versione 3: rettangolo del contesto fuori dalla porta d'ingresso (in pianta), per allargare l'inquadratura
export function rettContesto(P) {
  const pa = portaAuto(P); if (!pa) return null;
  const villa = P.stanze.some(s => /portic|giardin/i.test(s.id));
  if (villa) { const [x0, z0, x1, z1] = P.box; return { villa: true, r: [x0 - 3, z0 - 3, x1 + 3, z1 + 4.5], pa }; }
  const n = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] }[pa.lato], lar = 1.9, pro = 5.2;
  const r = n[1] ? [pa.x - lar, Math.min(pa.z, pa.z + n[1] * pro), pa.x + lar, Math.max(pa.z, pa.z + n[1] * pro)] : [Math.min(pa.x, pa.x + n[0] * pro), pa.z - lar, Math.max(pa.x, pa.x + n[0] * pro), pa.z + lar];
  return { villa: false, r, pa, n };
}

export function costruisci(scene, M, P, opz = {}) {
  const [x0, z0, x1, z1] = P.box; OX = (x0 + x1) / 2; OZ = (z0 + z1) / 2; BX = x0; BZ = z0;
  const kDi = (cx, cz) => Math.hypot(cx + OX - BX, cz + OZ - BZ);
  const casa = { pezziMuro: [], tagli: [], aperture: [], pavimenti: [], arredi: {}, ordine: [], lampade: [], soffitti: [], porte: [], vani: [] };
  const radice = new THREE.Group(); scene.add(radice); casa.radice = radice;

  // pavimenti: un rettangolo per voce di stanza
  for (const s of P.stanze) {
    const [a0, b0, a1, b1] = s.r, w = a1 - a0, d = b1 - b0;
    const geo = new THREE.PlaneGeometry(w, d); geo.rotateX(-Math.PI / 2);
    const mBase = s.pav === 'pietra' ? M.pavPietra : s.pav === 'deck' ? M.pavDeck : M.pavLegno;
    const uv = geo.attributes.uv, pos = geo.attributes.position, sc = 1 / (mBase.userData.metriTrama || (s.pav === 'pietra' ? 1.2 : s.pav === 'deck' ? 1.6 : 2.2));
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + (a0 + a1) / 2) * sc, (pos.getZ(i) + (b0 + b1) / 2) * sc);
    const mat = (s.pav === 'pietra' ? M.pavPietra : s.pav === 'deck' ? M.pavDeck : M.pavLegno).clone(); mat.opacity = 1;
    mat.polygonOffset = true; mat.polygonOffsetFactor = -1; mat.polygonOffsetUnits = -1; // anti tremolio sul piano bianco
    const m = new THREE.Mesh(geo, mat); m.position.copy(W((a0 + a1) / 2, (b0 + b1) / 2, s.pav === 'deck' ? 0.002 : 0.004)); m.receiveShadow = true;
    radice.add(m); casa.pavimenti.push(m);
    if (opz.soffitti && !s.esterno) { const gs = new THREE.PlaneGeometry(w, d); gs.rotateX(Math.PI / 2); const c = new THREE.Mesh(gs, M.soffitto); c.position.copy(W((a0 + a1) / 2, (b0 + b1) / 2, H)); c.receiveShadow = true; c.castShadow = false; radice.add(c); casa.soffitti.push(c); }
  }

  // muri
  const vetroR = M.vetro.clone(); vetroR.opacity = 0.22;
  for (const mu of P.muri) {
    const oriz = mu.a[1] === mu.b[1]; const L0 = Math.min(oriz ? mu.a[0] : mu.a[1], oriz ? mu.b[0] : mu.b[1]), L1 = Math.max(oriz ? mu.a[0] : mu.a[1], oriz ? mu.b[0] : mu.b[1]);
    const fisso = oriz ? mu.a[1] : mu.a[0];
    if (mu.ringhiera) {
      const len = L1 - L0, mid = (L0 + L1) / 2, c = oriz ? W(mid, fisso) : W(fisso, mid), w = oriz ? len : 0.025, d = oriz ? 0.025 : len;
      for (const [y0, y1, mat] of [[0, 1.0, vetroR], [1.0, 1.05, M.antracite]]) {
        const g = new THREE.BoxGeometry(y1 === 1.05 ? (oriz ? len : 0.05) : w, 1, y1 === 1.05 ? (oriz ? 0.05 : len) : d); g.translate(0, 0.5, 0);
        const m = new THREE.Mesh(g, mat); m.position.set(c.x, y0, c.z); m.scale.y = y1 - y0; m.castShadow = mat !== vetroR; m.receiveShadow = true; m.userData = { y0, y1, k: kDi(c.x, c.z), ringhiera: 1 };
        radice.add(m); casa.pezziMuro.push(m);
      }
      continue;
    }
    const est = mu.t > 0.2 ? mu.t / 2 : mu.t / 2; /* mezzo spessore esatto: l'angolo e' chiuso e le facce restano allineate (niente fessure, niente scalini) */
    const tratti = []; let cur = L0 - est; const fine = L1 + est;
    const ap = mu.ap.map(leggiAp).sort((p, q) => p.p0 - q.p0);
    for (const a of ap) { tratti.push([cur, a.p0, 0, H]); if (a.dav > 0) tratti.push([a.p0, a.p1, 0, a.dav]); if (a.arch < H) tratti.push([a.p0, a.p1, a.arch, H]); cur = a.p1; }
    tratti.push([cur, fine, 0, H]);
    for (const [p0, p1, y0, y1] of tratti) {
      if (p1 - p0 < 0.005) continue;
      const len = p1 - p0, mid = (p0 + p1) / 2;
      const w = oriz ? len : mu.t, d = oriz ? mu.t : len;
      const c = oriz ? W(mid, fisso) : W(fisso, mid);
      const g = new THREE.BoxGeometry(w, 1, d); g.translate(0, 0.5, 0);
      const m = new THREE.Mesh(g, M.muro); m.position.set(c.x, y0, c.z); m.scale.y = y1 - y0; m.castShadow = m.receiveShadow = true;
      m.userData = { y0, y1, k: kDi(c.x, c.z) };
      radice.add(m); casa.pezziMuro.push(m);
      if (y0 === 0) {
        const gb = new THREE.BoxGeometry(w + (oriz ? 0 : 0.024), 1, d + (oriz ? 0.024 : 0)); gb.translate(0, 0.5, 0);
        const b = new THREE.Mesh(gb, M.battiscopa); b.position.set(c.x, 0, c.z); b.scale.y = 0.08; b.castShadow = false; b.receiveShadow = true;
        b.userData = { y0: 0, y1: 0.08, k: m.userData.k, battiscopa: 1 }; radice.add(b); casa.pezziMuro.push(b);
      }
      if (y1 >= H - 0.001) {
        const tg = new THREE.Mesh(new THREE.BoxGeometry(w + 0.002, 0.012, d + 0.002), M.taglio); tg.position.set(c.x, H + 0.006, c.z);
        tg.userData = { k: m.userData.k, y0 }; radice.add(tg); casa.tagli.push(tg);
      }
    }
    for (const a of ap) {
      const { p0, p1, tipo, dav, arch } = a; const len = p1 - p0, mid = (p0 + p1) / 2;
      const c = oriz ? W(mid, fisso) : W(fisso, mid);
      casa.vani.push({ oriz, fisso, p0, p1, tipo, t: mu.t });
      const g = new THREE.Group(); g.position.set(c.x, 0, c.z); if (!oriz) g.rotation.y = Math.PI / 2;
      g.userData = { tipo, k: kDi(c.x, c.z) };
      if (tipo === 'fin' || tipo === 'pf') {
        const hh = arch - dav, f = 0.05;
        blocco(g, M.telaio, 0, dav, 0, len, f, 0.07, 0.005); blocco(g, M.telaio, 0, arch - f, 0, len, f, 0.07, 0.005);
        blocco(g, M.telaio, -len / 2 + f / 2, dav, 0, f, hh, 0.07, 0.005); blocco(g, M.telaio, len / 2 - f / 2, dav, 0, f, hh, 0.07, 0.005);
        if (len > 1.7) blocco(g, M.telaio, 0, dav, 0, 0.06, hh, 0.07, 0.005);
        const vetro = new THREE.Mesh(new THREE.PlaneGeometry(len - 2 * f, hh - 2 * f), M.vetro); vetro.position.set(0, dav + hh / 2, 0); g.add(vetro);
        if (dav > 0) blocco(g, M.davanzale, 0, dav - 0.03, 0, len + 0.08, 0.03, mu.t + 0.06, 0.006);
      } else if (tipo === 'porta' || tipo === 'blindata') {
        // lato dell'anta e cardine nelle coordinate locali del vano (asse locale x lungo il muro)
        // nei muri verticali l'asse locale x punta verso -z, l'asse locale z verso +x
        const v0 = a.verso, card = oriz ? a.cardine : 1 - a.cardine;
        const spT = mu.t + 0.02, ft = 0.06;
        const mt = tipo === 'blindata' ? M.telaio : M.laccatoB;
        blocco(g, mt, -len / 2 + ft / 2, 0, 0, ft, arch, spT, 0.006); blocco(g, mt, len / 2 - ft / 2, 0, 0, ft, arch, spT, 0.006);
        blocco(g, mt, 0, arch - ft, 0, len, ft, spT, 0.006);
        const anta = new THREE.Group(); const hx = card === 0 ? -len / 2 + ft : len / 2 - ft;
        const zl = oriz ? v0 : v0; anta.position.set(hx, 0, zl * spT / 2);
        const lw = len - 2 * ft; const dir = card === 0 ? 1 : -1;
        blocco(anta, tipo === 'blindata' ? M.noce : M.laccatoB, dir * lw / 2, 0.01, 0, lw, arch - ft - 0.015, 0.044, 0.008);
        blocco(anta, M.nero, dir * (lw - 0.07), 1.0, zl * 0.04, 0.02, 0.02, 0.05, 0.005);
        blocco(anta, M.nero, dir * (lw - 0.11), 1.0, zl * 0.065, 0.12, 0.018, 0.018, 0.006);
        anta.rotation.y = -dir * zl * 1.62;
        anta.userData.zl = zl;
        g.add(anta); casa.porte.push(anta);
      }
      radice.add(g); casa.aperture.push(g);
    }
  }

  // arredo automatico se la pianta non ha la voce arredo, o con ?auto nell'indirizzo
  const auto = !P.arredo || P.arredo === 'auto' || (typeof location !== 'undefined' && new URLSearchParams(location.search).has('auto'));
  if (auto) {
    const LM = libreria(M, { lampade: [] }); const cache = new Map();
    const misura = (tipo, o = {}) => { const k = tipo + JSON.stringify(o); if (!cache.has(k)) { const g = new THREE.Group(); LM[tipo](g, { ...o, luce: false }); g.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(g); cache.set(k, { lx0: b.min.x, lx1: b.max.x, lz0: b.min.z, lz1: b.max.z, h: b.max.y }); } return cache.get(k); };
    const r = arredaAuto(P, misura); P.arredo = r.arredo; if (!P.ordine) P.ordine = r.ordine;
    if (typeof window !== 'undefined') window.__arredoAuto = r;
  }

  // Unfold senza porta o percorso nella pianta: porta dalla blindata e percorso a piedi automatici
  const unfold = (typeof location !== 'undefined' && new URLSearchParams(location.search).get('modo')) || P.modo;
  if (unfold === 'unfold' && (!P.porta || !P.giro)) {
    const LM = libreria(M, { lampade: [] }); const cache = new Map();
    const misura = (tipo, o = {}) => { const k = tipo + JSON.stringify(o); if (!cache.has(k)) { const g = new THREE.Group(); LM[tipo](g, { ...o, luce: false }); g.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(g); cache.set(k, { lx0: b.min.x, lx1: b.max.x, lz0: b.min.z, lz1: b.max.z, h: b.max.y }); } return cache.get(k); };
    if (!P.porta) P.porta = portaAuto(P);
    if (!P.giro) P.giro = giroAuto(P, misura).giro;
  }

  // arredo per stanza
  const LIB = libreria(M, casa);
  const A = casa.arredi;
  for (const [id, tipo, x, z, r = 0, o = {}] of P.arredo) {
    if (!A[id]) { const g = new THREE.Group(); radice.add(g); A[id] = g; casa.ordine.push(id); }
    const g = new THREE.Group(); g.position.copy(W(x, z)); g.rotation.y = r * RAD; g.userData = { tipo, id, x, z, o };
    if (!LIB[tipo]) throw new Error('arredo sconosciuto: ' + tipo);
    LIB[tipo](g, o); A[id].add(g);
  }
  if (P.ordine) casa.ordine = P.ordine.filter(id => A[id]).concat(casa.ordine.filter(id => !P.ordine.includes(id)));

  // versione 2: ornamenti sui mobili (figli del mobile: restano dentro il suo ingombro)
  if (opz.ornamenti && LIBRERIA.pronta) {
    const orna = (g, chiave, x, y, z, misura, ry = 0) => { const m = modello(chiave, misura); if (!m) return; m.position.set(x, y, z); m.rotation.y = ry; g.add(m); };
    for (const id in A) for (const g of A[id].children) {
      const { tipo, o = {} } = g.userData;
      if (tipo === 'divano') { const L = o.L || 2.4, Pp = o.P || 0.95; orna(g, 'cuscini', -(L / 2 - 0.55), 0.42, -Pp / 2 + 0.3, { x: 0.75 }, 0.08); orna(g, 'cuscini', L / 2 - 0.55, 0.42, -Pp / 2 + 0.3, { x: 0.75 }, -0.1); }
      else if (tipo === 'letto') { const w = o.w || 1.8, L = o.L || 2.0; orna(g, 'cuscini', 0, 0.53, -L / 2 + 0.55, { x: Math.min(1.0, w * 0.62) }); }
      else if (tipo === 'consolle') { const L = o.L || 1.2; orna(g, 'vaso1', -L / 2 + 0.22, 0.83, 0, { y: 0.34 }); }
      else if (tipo === 'mobileTV') { const L = o.L || 2.2; orna(g, 'vaso3', -(L / 2 - 0.25), 0.54, 0, { y: 0.3 }); }
      else if (tipo === 'comodino') { orna(g, 'cornice', 0.12, LIBRERIA.modelli.comodino ? 0.5 : 0.5, 0.05, { y: 0.18 }, -0.3); }
      else if (tipo === 'tavolo') { orna(g, 'grassa', 0.32, 0.75, 0.05, { y: 0.2 }); }
      else if (tipo === 'tavolino') { const r = o.r || 0.5; orna(g, 'grassa', -r * 0.35, 0.4, -r * 0.3, { y: 0.18 }); }
      else if (tipo === 'cucina') { const L = o.L || 3.2; orna(g, 'grassa', L / 2 - 0.2, 0.92, -0.1, { y: 0.2 }); orna(g, 'vaso2', -(L / 2 - 0.3), 0.92, -0.12, { y: 0.26 }); }
    }
  }
  // versione 2: ingresso riconoscibile da fuori (gradino in pietra, zerbino, lampada a muro accanto alla porta)
  if (opz.ingresso) {
    const pa = portaAuto(P);
    if (pa) {
      const mu = P.muri.find(m => !m.ringhiera && (m.ap || []).some(a => a[2] === 'blindata')); const t = mu ? mu.t : 0.3;
      const n = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] }[pa.lato]; const lungo = n[1] !== 0;
      const g = new THREE.Group(); g.position.copy(W(pa.x, pa.z)); g.rotation.y = lungo ? (n[1] > 0 ? 0 : Math.PI) : (n[0] > 0 ? Math.PI / 2 : -Math.PI / 2); radice.add(g); casa.ingresso = g;
      const d0 = t / 2;
      blocco(g, M.davanzale, 0, 0, d0 + 0.45, 1.6, 0.06, 0.9, 0.01);
      blocco(g, M.tappetoScuro, 0, 0.06, d0 + 0.38, 0.9, 0.014, 0.55, 0.004);
      blocco(g, M.antracite, 0.82, 1.95, d0 + 0.05, 0.12, 0.26, 0.1, 0.01);
      const lt = blocco(g, M.paralume, 0.82, 2.0, d0 + 0.1, 0.08, 0.16, 0.012, 0.004); lt.castShadow = false;
      const L = new THREE.PointLight(0xffc488, 0, 3.5, 2); L.position.set(0.82, 2.05, d0 + 0.35); g.add(L); casa.lampade.push(L);
    }
  }

  // versione 3: contesto fuori casa
  if (opz.contesto) {
    const C = rettContesto(P); casa.contesto = null;
    if (C && C.villa) {
      const g = new THREE.Group(); radice.add(g); casa.contesto = g; const [x0, z0, x1, z1] = C.r;
      const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0); geo.rotateX(-Math.PI / 2); const uv = geo.attributes.uv, pos = geo.attributes.position, sc = 1 / (M.prato.userData.metriTrama || 2);
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + (x0 + x1) / 2) * sc, (pos.getZ(i) + (z0 + z1) / 2) * sc);
      const mp = M.prato.clone(); mp.polygonOffset = true; mp.polygonOffsetFactor = 2; mp.polygonOffsetUnits = 2;
      const prato = new THREE.Mesh(geo, mp); prato.position.copy(W((x0 + x1) / 2, (z0 + z1) / 2, -0.004)); prato.receiveShadow = true; g.add(prato);
      // vialetto in lastre di pietra dalla porta verso fuori, siepi basse sui bordi
      const pa = C.pa, n = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] }[pa.lato];
      const fine = n[1] > 0 ? z1 : n[1] < 0 ? z0 : n[0] > 0 ? x1 : x0; const inizio = n[1] ? Math.max(...P.stanze.filter(s => s.esterno).map(s => n[1] > 0 ? s.r[3] : -s.r[1]).map(Math.abs), pa.z) : pa.x;
      for (let d = 0.5; ; d += 0.75) { const p = n[1] ? [pa.x, (n[1] > 0 ? Math.max(inizio, pa.z) : Math.min(pa.z, inizio)) + n[1] * d] : [pa.x + n[0] * d, pa.z]; if ((n[1] && (n[1] > 0 ? p[1] > fine - 0.4 : p[1] < fine + 0.4)) || (n[0] && (n[0] > 0 ? p[0] > fine - 0.4 : p[0] < fine + 0.4))) break; const c = W(p[0], p[1]); blocco(g, M.davanzale, c.x, 0, c.z, n[1] ? 1.1 : 0.55, 0.03, n[1] ? 0.55 : 1.1, 0.01); }
      const siepe = new THREE.MeshStandardMaterial({ color: 0x5f7d45, roughness: 0.95 });
      for (const [a, b, c, d] of [[x0 + 0.4, z0 + 0.4, x1 - 0.4, z0 + 0.4], [x0 + 0.4, z0 + 0.4, x0 + 0.4, z1 - 0.4], [x1 - 0.4, z0 + 0.4, x1 - 0.4, z1 - 0.4]]) { const cA = W(a, b), cB = W(c, d); blocco(g, siepe, (cA.x + cB.x) / 2, 0, (cA.z + cB.z) / 2, Math.abs(cB.x - cA.x) + 0.45, 0.6, Math.abs(cB.z - cA.z) + 0.45, 0.18); }
    } else if (C) {
      // pianerottolo condominiale: pavimento in pietra su tutta la larghezza, pareti chiare delle parti comuni unite al muro della casa,
      // ascensore a destra, porta del vicino con zerbino a sinistra, lampada a parete; nella FloorView il fondo è chiuso da un muro con finestra
      const pa = C.pa, n = C.n; const mu = P.muri.find(m => !m.ringhiera && (m.ap || []).some(a => a[2] === 'blindata')); const t = mu ? mu.t : 0.3, d0 = t / 2;
      const g = new THREE.Group(); g.position.copy(W(pa.x, pa.z)); g.rotation.y = n[1] ? (n[1] > 0 ? 0 : Math.PI) : (n[0] > 0 ? Math.PI / 2 : -Math.PI / 2); radice.add(g); casa.contesto = g;
      const lar = 1.9, pro = 5.2, tm = 0.2;
      const geoP = new THREE.PlaneGeometry(2 * lar, pro); geoP.rotateX(-Math.PI / 2);
      { const uv = geoP.attributes.uv, pos = geoP.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 1.2, (pos.getZ(i) + d0 + pro / 2) / 1.2); }
      const mPav = M.pavPietra.clone(); mPav.opacity = 1; mPav.transparent = false; mPav.color = new THREE.Color(0xd9d4cb);
      const pav = new THREE.Mesh(geoP, mPav); pav.position.set(0, 0.001, d0 + pro / 2); pav.receiveShadow = true; g.add(pav);
      const muroC = M.muro.clone(); muroC.color = new THREE.Color(0xe9e5de);
      for (const sx of [-1, 1]) { blocco(g, muroC, sx * (lar + tm / 2), 0, d0 + pro / 2, tm, H, pro + (opz.soffitti ? 0 : tm), 0.005); const tg = blocco(g, M.taglio, sx * (lar + tm / 2), H, d0 + pro / 2, tm + 0.002, 0.012, pro + 0.002, 0); tg.castShadow = false; }
      if (!opz.soffitti) {
        blocco(g, muroC, 0, 0, d0 + pro + tm / 2, 2 * lar, H, tm, 0.005); const tg = blocco(g, M.taglio, 0, H, d0 + pro + tm / 2, 2 * lar + 2 * tm + 0.002, 0.012, tm + 0.002, 0); tg.castShadow = false;
        blocco(g, M.nero, 0, 1.0, d0 + pro - 0.012, 1.3, 1.25, 0.03, 0.004); blocco(g, M.vetro, 0, 1.04, d0 + pro - 0.03, 1.2, 1.17, 0.01, 0.002).castShadow = false;
      }
      // ascensore sul muro di destra
      blocco(g, M.antracite, lar - 0.03, 0, d0 + 2.2, 0.06, 2.25, 1.25, 0.006); blocco(g, M.acciaio, lar - 0.07, 0.02, d0 + 1.9, 0.02, 2.1, 0.52, 0.003); blocco(g, M.acciaio, lar - 0.07, 0.02, d0 + 2.5, 0.02, 2.1, 0.52, 0.003);
      blocco(g, M.nero, lar - 0.06, 1.1, d0 + 3.05, 0.03, 0.14, 0.08, 0.004);
      // porta del vicino sul muro di sinistra, con telaio e zerbino
      blocco(g, M.nero, -lar + 0.02, 0, d0 + 3.4, 0.04, 2.25, 1.12, 0.004); blocco(g, M.noce, -lar + 0.045, 0.01, d0 + 3.4, 0.03, 2.15, 1.0, 0.004); blocco(g, M.acciaio, -lar + 0.07, 1.0, d0 + 3.05, 0.03, 0.03, 0.14, 0.004);
      blocco(g, M.antracite, -lar + 0.5, 0.002, d0 + 3.4, 0.55, 0.012, 0.85, 0.004);
      // lampada a parete
      blocco(g, M.laccatoB, lar - 0.04, 2.15, d0 + 4.4, 0.06, 0.18, 0.3, 0.02);
      const L = new THREE.PointLight(0xfff1dc, 0, 6, 2); L.position.set(0, 2.5, d0 + 2.4); g.add(L); casa.lampade.push(L);
    }
  }

  casa.disegno = disegno2D(M, P, casa);
  radice.add(casa.disegno);
  return casa;
}

// disegno architettonico vettoriale, senza scritte: campiture dei muri, simboli di finestre e porte
function disegno2D(M, P, casa) {
  const g = new THREE.Group(); const Y = 0.008;
  const nero = new THREE.MeshBasicMaterial({ color: 0x1b1d21 }); // opaco: i pezzi sovrapposti negli angoli non si contendono la trasparenza
  const linea = new THREE.MeshBasicMaterial({ color: 0x1b1d21, transparent: true });
  const fine = new THREE.MeshBasicMaterial({ color: 0x5b6068, transparent: true });
  g.userData = { muri: [], simboli: [], mats: [nero, linea, fine] };
  const rett = (mat, cx, cz, w, d, lista, ordine) => { const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2); const m = new THREE.Mesh(geo, mat); m.position.copy(W(cx, cz, Y)); m.scale.set(w, 1, d); m.userData = { w, d, ordine }; m.renderOrder = 2; g.add(m); lista.push(m); return m; };
  let ord = 0;
  for (const mu of P.muri) {
    const oriz = mu.a[1] === mu.b[1]; const L0 = Math.min(oriz ? mu.a[0] : mu.a[1], oriz ? mu.b[0] : mu.b[1]), L1 = Math.max(oriz ? mu.a[0] : mu.a[1], oriz ? mu.b[0] : mu.b[1]); const fisso = oriz ? mu.a[1] : mu.a[0];
    if (mu.ringhiera) { const m = oriz ? rett(linea, (L0 + L1) / 2, fisso, L1 - L0, 0.03, g.userData.simboli, ord) : rett(linea, fisso, (L0 + L1) / 2, 0.03, L1 - L0, g.userData.simboli, ord); ord++; continue; }
    const est = mu.t > 0.2 ? mu.t / 2 : mu.t / 2; /* mezzo spessore esatto: l'angolo e' chiuso e le facce restano allineate (niente fessure, niente scalini) */ let cur = L0 - est; const ap = mu.ap.map(leggiAp).sort((p, q) => p.p0 - q.p0);
    const pezzi = []; for (const a of ap) { pezzi.push([cur, a.p0]); cur = a.p1; } pezzi.push([cur, L1 + est]);
    for (const [p0, p1] of pezzi) { if (p1 - p0 < 0.005) continue; const mid = (p0 + p1) / 2, len = p1 - p0;
      const m = oriz ? rett(nero, mid, fisso, len, mu.t, g.userData.muri, ord) : rett(nero, fisso, mid, mu.t, len, g.userData.muri, ord); m.userData.oriz = oriz; ord++; }
    for (const a of ap) {
      const { p0, p1, tipo } = a; const len = p1 - p0, mid = (p0 + p1) / 2;
      if (tipo === 'fin' || tipo === 'pf') {
        for (const off of [-mu.t / 2 + 0.01, 0, mu.t / 2 - 0.01]) { const lw = off === 0 ? 0.03 : 0.018; if (oriz) rett(linea, mid, fisso + off, len, lw, g.userData.simboli, ord); else rett(linea, fisso + off, mid, lw, len, g.userData.simboli, ord); }
        if (oriz) { rett(linea, p0, fisso, 0.02, mu.t, g.userData.simboli, ord); rett(linea, p1, fisso, 0.02, mu.t, g.userData.simboli, ord); } else { rett(linea, fisso, p0, mu.t, 0.02, g.userData.simboli, ord); rett(linea, fisso, p1, mu.t, 0.02, g.userData.simboli, ord); }
      } else if (tipo === 'porta' || tipo === 'blindata') {
        // anta disegnata aperta a 90 gradi dal cardine, arco dal filo del muro
        const r = len - 0.12, sg = a.verso, cp = a.cardine === 0 ? p0 + 0.06 : p1 - 0.06, sl = a.cardine === 0 ? 1 : -1;
        const fil = fisso + sg * mu.t / 2;
        if (oriz) rett(linea, cp, fil + sg * r / 2, 0.035, r, g.userData.simboli, ord); else rett(linea, fil + sg * r / 2, cp, r, 0.035, g.userData.simboli, ord);
        const arco = new THREE.RingGeometry(r - 0.008, r + 0.008, 48, 1, 0, Math.PI / 2); arco.rotateX(-Math.PI / 2);
        const am = new THREE.Mesh(arco, fine); am.renderOrder = 2;
        // quarto di cerchio tra la direzione lungo il muro (sl) e la direzione dell'anta (sg)
        const ang = (dx, dz) => Math.atan2(-dz, dx);
        let u, v; if (oriz) { u = [sl, 0]; v = [0, sg]; } else { u = [0, sl]; v = [sg, 0]; }
        const a1 = ang(...u), a2 = ang(...v); let base = a1; let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; if (d < 0) base = a2;
        am.rotation.y = base; am.position.copy(oriz ? W(cp, fil, Y) : W(fil, cp, Y)); am.userData = { ordine: ord, arco: 1 }; g.add(am); g.userData.simboli.push(am);
      }
    }
  }
  return g;
}

// ---------- controlli automatici ----------
const NON_PASSAGGIO = new Set(['tappeto', 'quadro', 'tende', 'sospensione', 'plafoniera']);
export function controlliArredo(casa, P) {
  const err = []; casa.radice.updateMatrixWorld(true);
  const bm = casa.pezziMuro.filter(m => !m.userData.battiscopa).map(m => new THREE.Box3().setFromObject(m).expandByScalar(-0.006));
  const bAnte = casa.porte.map(p => new THREE.Box3().setFromObject(p));
  const zone = [];
  for (const v of casa.vani) {
    if (v.tipo === 'fin') continue; const pr = v.t / 2 + 0.5;
    const [a0, a1] = [v.p0 + 0.02, v.p1 - 0.02]; const z = v.oriz ? [a0, v.fisso - pr, a1, v.fisso + pr] : [v.fisso - pr, a0, v.fisso + pr, a1];
    zone.push({ z, v });
  }
  const rett = {}; for (const s of P.stanze) { const r = rett[s.id] || [1e9, 1e9, -1e9, -1e9]; rett[s.id] = [Math.min(r[0], s.r[0]), Math.min(r[1], s.r[1]), Math.max(r[2], s.r[2]), Math.max(r[3], s.r[3])]; }
  for (const id in casa.arredi) for (const p of casa.arredi[id].children) {
    const { tipo, x, z } = p.userData; const nome = `${tipo} in ${id} (${x}, ${z})`;
    const b = new THREE.Box3().setFromObject(p); if (b.isEmpty()) continue; const bi = b.clone().expandByScalar(-0.01);
    const [bx0, bz0] = inPianta(b.min), [bx1, bz1] = inPianta(b.max);
    if (!['quadro', 'tende'].includes(tipo)) for (const w of bm) if (w.intersectsBox(bi)) { err.push(`MURO: ${nome}`); break; }
    const r = rett[id]; if (r && (bx0 < r[0] - 0.02 || bz0 < r[1] - 0.02 || bx1 > r[2] + 0.02 || bz1 > r[3] + 0.02)) err.push(`FUORI STANZA: ${nome} [${bx0.toFixed(2)}, ${bz0.toFixed(2)}, ${bx1.toFixed(2)}, ${bz1.toFixed(2)}]`);
    if (NON_PASSAGGIO.has(tipo)) continue;
    for (const { z: q, v } of zone) if (bx0 < q[2] - 0.01 && bx1 > q[0] + 0.01 && bz0 < q[3] - 0.01 && bz1 > q[1] + 0.01) err.push(`PASSAGGIO ${v.tipo} ${v.oriz ? 'z' : 'x'}=${v.fisso} [${v.p0}-${v.p1}]: ${nome}`);
    for (const a of bAnte) if (a.intersectsBox(bi)) { err.push(`ANTA: ${nome}`); break; }
  }
  return err;
}
