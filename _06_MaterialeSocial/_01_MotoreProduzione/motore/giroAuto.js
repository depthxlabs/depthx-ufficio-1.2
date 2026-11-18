// DepthX Linea 1.2: porta d'ingresso e percorso a piedi automatici per Unfold.
// portaAuto(P): la porta 'blindata' su un muro esterno, con il lato verso fuori.
// giroAuto(P, misura): percorso dall'ingresso alle stanze principali, lontano almeno 0,4 m da muri, ante e mobili.
// Uscita nel formato di P.giro: [x, z, direzione dello sguardo in gradi (0 nord, 90 ovest, -90 est, 180 sud), secondi].
const R = 0.05;

export function portaAuto(P) {
  const dentro = (x, z) => P.stanze.some(s => !s.esterno && x > s.r[0] && x < s.r[2] && z > s.r[1] && z < s.r[3]);
  for (const mu of P.muri) {
    if (mu.ringhiera) continue; const oriz = mu.a[1] === mu.b[1], fisso = oriz ? mu.a[1] : mu.a[0];
    for (const a of mu.ap || []) {
      if (a[2] !== 'blindata') continue; const c = (a[0] + a[1]) / 2, d = mu.t / 2 + 0.3;
      const [xp, zp] = oriz ? [c, fisso + d] : [fisso + d, c], [xm, zm] = oriz ? [c, fisso - d] : [fisso - d, c];
      const fuoriPiu = !dentro(xp, zp) && dentro(xm, zm), fuoriMeno = !dentro(xm, zm) && dentro(xp, zp);
      if (!fuoriPiu && !fuoriMeno) continue;
      const lato = oriz ? (fuoriPiu ? 's' : 'n') : (fuoriPiu ? 'e' : 'w');
      return { x: oriz ? c : fisso, z: oriz ? fisso : c, lato };
    }
  }
  return null;
}

export function giroAuto(P, misura, opz = {}) {
  const porta = P.porta || portaAuto(P); if (!porta) throw new Error('giro automatico: nessuna porta blindata su un muro esterno');
  const [X0, Z0, X1, Z1] = P.box; const nx = Math.ceil((X1 - X0) / R), nz = Math.ceil((Z1 - Z0) / R), N = nx * nz;
  const ost = new Uint8Array(N); const stanza = new Int16Array(N).fill(-1); const ids = [];
  const segna = (x0, z0, x1, z1, fn) => { const i0 = Math.max(0, Math.floor((x0 - X0) / R)), i1 = Math.min(nx, Math.ceil((x1 - X0) / R)), j0 = Math.max(0, Math.floor((z0 - Z0) / R)), j1 = Math.min(nz, Math.ceil((z1 - Z0) / R)); for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) fn(j * nx + i); };
  for (const s of P.stanze) { if (s.esterno) continue; if (!ids.includes(s.id)) ids.push(s.id); const k = ids.indexOf(s.id); segna(...s.r, c => stanza[c] = k); }
  // muri (le aperture porta, varco e porta-finestra restano libere), ante aperte, mobili
  for (const mu of P.muri) {
    const oriz = mu.a[1] === mu.b[1], L0 = Math.min(oriz ? mu.a[0] : mu.a[1], oriz ? mu.b[0] : mu.b[1]), L1 = Math.max(oriz ? mu.a[0] : mu.a[1], oriz ? mu.b[0] : mu.b[1]), f = oriz ? mu.a[1] : mu.a[0], t = mu.ringhiera ? 0.06 : mu.t;
    const pezzi = []; let cur = L0 - t / 2; for (const a of [...(mu.ap || [])].sort((p, q) => p[0] - q[0])) { if (a[2] === 'fin') continue; pezzi.push([cur, a[0]]); cur = a[1];
      if (a[2] === 'porta' || a[2] === 'blindata') { const v = a[5] ?? 1, len = a[1] - a[0], c0 = (a[6] ?? 0) === 0 ? a[0] : a[1] - 0.06; const z0 = f + v * t / 2, z1 = f + v * (t / 2 + len);
        if (oriz) segna(c0, Math.min(z0, z1), c0 + 0.06, Math.max(z0, z1), c => ost[c] = 1); else segna(Math.min(z0, z1), c0, Math.max(z0, z1), c0 + 0.06, c => ost[c] = 1); } }
    pezzi.push([cur, L1 + t / 2]);
    for (const [p0, p1] of pezzi) if (p1 > p0) { if (oriz) segna(p0, f - t / 2, p1, f + t / 2, c => ost[c] = 1); else segna(f - t / 2, p0, f + t / 2, p1, c => ost[c] = 1); }
  }
  const ruota = (m, r) => r === 0 ? [m.lx0, m.lz0, m.lx1, m.lz1] : (r === 180 || r === -180) ? [-m.lx1, -m.lz1, -m.lx0, -m.lz0] : r === 90 ? [m.lz0, -m.lx1, m.lz1, -m.lx0] : r === -90 ? [-m.lz1, m.lx0, -m.lz0, m.lx1] : null;
  for (const [, tipo, x, z, r = 0, o = {}] of P.arredo || []) {
    if (['tappeto', 'quadro', 'tende', 'plafoniera', 'sospensione'].includes(tipo)) continue;
    const m = misura(tipo, o); let q = ruota(m, r); if (!q) { const e = Math.max(Math.abs(m.lx0), m.lx1, Math.abs(m.lz0), m.lz1); q = [-e, -e, e, e]; }
    segna(x + q[0], z + q[1], x + q[2], z + q[3], c => ost[c] = 1);
  }
  // distanza dagli ostacoli (trasformata a due passate, in celle)
  const dist = new Float32Array(N).fill(1e9);
  for (let c = 0; c < N; c++) if (ost[c] || stanza[c] < 0) dist[c] = 0;
  const D1 = 1, D2 = Math.SQRT2;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const c = j * nx + i; let d = dist[c]; if (i > 0) d = Math.min(d, dist[c - 1] + D1); if (j > 0) { d = Math.min(d, dist[c - nx] + D1); if (i > 0) d = Math.min(d, dist[c - nx - 1] + D2); if (i < nx - 1) d = Math.min(d, dist[c - nx + 1] + D2); } dist[c] = d; }
  for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) { const c = j * nx + i; let d = dist[c]; if (i < nx - 1) d = Math.min(d, dist[c + 1] + D1); if (j < nz - 1) { d = Math.min(d, dist[c + nx] + D1); if (i < nx - 1) d = Math.min(d, dist[c + nx + 1] + D2); if (i > 0) d = Math.min(d, dist[c + nx - 1] + D2); } dist[c] = d; }
  const MIN = Math.round((opz.margine ?? 0.4) / R);
  const cella = (x, z) => Math.floor((z - Z0) / R) * nx + Math.floor((x - X0) / R);
  const xz = c => [X0 + (c % nx + 0.5) * R, Z0 + (Math.floor(c / nx) + 0.5) * R];
  // partenza: 0,9 m dentro la porta
  const n = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] }[porta.lato];
  let inizio = cella(porta.x - n[0] * 0.9, porta.z - n[1] * 0.9);
  // mete: le stanze principali, nel punto piu' aperto
  const prio = id => /^(soggiorno|salotto|living|loft|openspace|giorno)/i.test(id) ? 0 : /^cucina/i.test(id) ? 1 : /^(matrimonial|padronal)/i.test(id) ? 2 : /^camera|^cameretta/i.test(id) ? 3 : /^studio/i.test(id) ? 4 : 9;
  const mete = ids.map((id, k) => ({ id, k, p: prio(id) })).filter(m => m.p < 9).sort((a, b) => a.p - b.p).slice(0, opz.stanze ?? 4);
  for (const m of mete) { let best = -1, bv = -1; for (let c = 0; c < N; c++) if (stanza[c] === m.k && dist[c] > bv) { bv = dist[c]; best = c; } m.c = best; m.libero = bv; }
  // Dijkstra con costo che preferisce il centro dei passaggi
  const cammino = (a, b) => {
    const g = new Float32Array(N).fill(Infinity), da = new Int32Array(N).fill(-1); g[a] = 0; const heap = [[0, a]];
    const push = e => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    while (heap.length) { const [gc, c] = pop(); if (c === b) break; if (gc > g[c]) continue; const i = c % nx, j = (c / nx) | 0;
      for (const [di, dj, w] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, D2], [1, -1, D2], [-1, 1, D2], [-1, -1, D2]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue; const cc = jj * nx + ii; if (dist[cc] < MIN) continue;
        const ng = gc + w * (1 + 6 / Math.max(1, dist[cc])); if (ng < g[cc]) { g[cc] = ng; da[cc] = c; push([ng, cc]); } } }
    if (!isFinite(g[b])) return null; const out = []; for (let c = b; c !== -1; c = da[c]) out.push(c); return out.reverse();
  };
  if (dist[inizio] < MIN) { let best = -1, bd = 1e9; const [sx, sz] = xz(inizio); for (let c = 0; c < N; c++) if (dist[c] >= MIN) { const [x, z] = xz(c); const d = Math.hypot(x - sx, z - sz); if (d < bd) { bd = d; best = c; } } inizio = best; }
  // ordine delle mete: la piu' vicina a ogni passo
  const punti = [xz(inizio)]; const soste = []; let cur = inizio; const restanti = mete.filter(m => m.c >= 0 && m.libero >= MIN);
  while (restanti.length) {
    let bi = -1, bp = null; for (let i = 0; i < restanti.length; i++) { const p = cammino(cur, restanti[i].c); if (p && (!bp || p.length < bp.length)) { bp = p; bi = i; } }
    if (bi < 0) break; const m = restanti.splice(bi, 1)[0]; for (const c of bp.slice(1)) punti.push(xz(c)); soste.push({ i: punti.length - 1, m }); cur = m.c;
  }
  // semplificazione (Douglas-Peucker 0,2 m), poi chiavi ogni 1,8 m circa
  const dp = (pts, eps) => { if (pts.length < 3) return pts; const [a, b] = [pts[0], pts[pts.length - 1]]; let im = 0, dm = 0; for (let i = 1; i < pts.length - 1; i++) { const [x, z] = pts[i]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9; const d = Math.abs((b[0] - a[0]) * (a[1] - z) - (a[0] - x) * (b[1] - a[1])) / L; if (d > dm) { dm = d; im = i; } } return dm > eps ? dp(pts.slice(0, im + 1), eps).slice(0, -1).concat(dp(pts.slice(im), eps)) : [a, b]; };
  const yawDi = (dx, dz) => Math.atan2(-dx, -dz) * 180 / Math.PI;
  const giro = []; let prec = 0;
  const tratti = [0, ...soste.map(s => s.i)];
  for (let t = 1; t < tratti.length; t++) {
    const seg = dp(punti.slice(tratti[t - 1], tratti[t] + 1), 0.2); const m = soste[t - 1].m;
    // punti intermedi ogni 1,8 m
    const fitti = [seg[0]]; for (let i = 1; i < seg.length; i++) { const [a, b] = [seg[i - 1], seg[i]]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const k = Math.max(1, Math.round(L / 1.8)); for (let s = 1; s <= k; s++) fitti.push([a[0] + (b[0] - a[0]) * s / k, a[1] + (b[1] - a[1]) * s / k]); }
    for (let i = (t === 1 ? 0 : 1); i < fitti.length; i++) {
      const p = fitti[i], q = fitti[Math.min(fitti.length - 1, i + 1)], r = i > 0 ? fitti[i - 1] : p;
      const dx = q[0] - r[0], dz = q[1] - r[1]; const y = Math.hypot(dx, dz) > 0.05 ? yawDi(dx, dz) : prec; prec = y;
      giro.push([+p[0].toFixed(2), +p[1].toFixed(2), +y.toFixed(1), 2.0]);
    }
    // sosta: sguardo lungo verso il punto piu' lontano della stanza, poi un po' di rotazione
    const [px, pz] = fitti[fitti.length - 1]; let fx = px, fz = pz, fd = 0;
    for (let c = 0; c < N; c++) if (stanza[c] === m.k && !ost[c]) { const [x, z] = xz(c); const d = Math.hypot(x - px, z - pz); if (d > fd) { fd = d; fx = x; fz = z; } }
    const y0 = yawDi(fx - px, fz - pz); giro.push([+px.toFixed(2), +pz.toFixed(2), +y0.toFixed(1), 2.0]); giro.push([+(px + 0.01).toFixed(2), +pz.toFixed(2), +(y0 + 35).toFixed(1), 2.0]); prec = y0 + 35;
  }
  return { giro, porta, soste: soste.map(s => s.m.id) };
}
