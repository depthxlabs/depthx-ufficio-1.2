// DepthX Linea 1.2: arredo automatico.
// Dalla pianta (muri, aperture, stanze con nome) genera P.arredo senza coordinate scritte a mano.
// Griglia da 5 cm: muri, passaggi davanti a porte e varchi, ante, zone davanti alle finestre, ingombri, spazi di uso.
// Ogni oggetto si cerca su tutte le posizioni libere della stanza; si accetta solo se le porte della stanza restano collegate.
// misura(tipo, o) -> { lx0, lx1, lz0, lz1, h } nelle coordinate locali dell'oggetto (fronte verso +z).

const R = 0.05;
const MURO = 1, PASSO = 2, ANTA = 4, OCC = 8, USO = 16, TAPPETO = 32, RING = 64;

export function arredaAuto(P, misura) {
  const [X0, Z0, X1, Z1] = P.box;
  const nx = Math.ceil((X1 - X0) / R), nz = Math.ceil((Z1 - Z0) / R), N = nx * nz;
  let F = new Uint8Array(N);
  const hFin = new Float32Array(N).fill(99);
  const stanza = new Int16Array(N).fill(-1);
  const ci = x => Math.ceil((x - X0) / R - 0.5), cf = x => Math.floor((x - X0) / R - 0.5) + 1;
  const cj = z => Math.ceil((z - Z0) / R - 0.5), cg = z => Math.floor((z - Z0) / R - 0.5) + 1;
  const segna = (x0, z0, x1, z1, fn) => { const i0 = Math.max(0, ci(x0)), i1 = Math.min(nx, cf(x1)), j0 = Math.max(0, cj(z0)), j1 = Math.min(nz, cg(z1)); for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) fn(j * nx + i); };

  // stanze
  const ids = []; const rett = {};
  for (const s of P.stanze) { if (!ids.includes(s.id)) ids.push(s.id); const k = ids.indexOf(s.id); segna(...s.r, c => stanza[c] = k); const r = rett[s.id] || [1e9, 1e9, -1e9, -1e9]; rett[s.id] = [Math.min(r[0], s.r[0]), Math.min(r[1], s.r[1]), Math.max(r[2], s.r[2]), Math.max(r[3], s.r[3])]; }
  const sInfo = id => P.stanze.find(s => s.id === id);

  // muri, aperture
  const RM = []; const aperture = [];
  for (const mu of P.muri) {
    const oriz = mu.a[1] === mu.b[1]; const L0 = Math.min(oriz ? mu.a[0] : mu.a[1], oriz ? mu.b[0] : mu.b[1]), L1 = Math.max(oriz ? mu.a[0] : mu.a[1], oriz ? mu.b[0] : mu.b[1]);
    const fisso = oriz ? mu.a[1] : mu.a[0], t = mu.ringhiera ? 0.06 : mu.t, est = t > 0.2 ? t / 2 : 0;
    const rr = oriz ? [L0 - est, fisso - t / 2, L1 + est, fisso + t / 2] : [fisso - t / 2, L0 - est, fisso + t / 2, L1 + est];
    RM.push(rr); segna(...rr, c => F[c] |= MURO | (mu.ringhiera ? RING : 0));
    for (const a of mu.ap || []) {
      const [p0, p1, tipo] = a; const dav = a[3] ?? (tipo === 'fin' ? 0.9 : 0), verso = a[5] ?? 1, len = p1 - p0;
      const ap = { oriz, fisso, t, p0, p1, tipo, dav, verso, x: oriz ? (p0 + p1) / 2 : fisso, z: oriz ? fisso : (p0 + p1) / 2 };
      aperture.push(ap);
      const zona = (d0, d1, fn) => oriz ? segna(p0, fisso + d0, p1, fisso + d1, fn) : segna(fisso + d0, p0, fisso + d1, p1, fn);
      if (tipo === 'fin') { const h = dav - 0.04; zona(-t / 2 - 0.55, t / 2 + 0.55, c => { if (!(F[c] & MURO)) hFin[c] = Math.min(hFin[c], h); }); }
      else zona(-t / 2 - 0.6, t / 2 + 0.6, c => F[c] |= PASSO);
      if (tipo === 'porta' || tipo === 'blindata') { const a0 = verso * t / 2, a1 = verso * (t / 2 + len); zona(Math.min(a0, a1), Math.max(a0, a1), c => F[c] |= ANTA); }
    }
  }
  // stanza di ogni apertura (lati)
  const latoStanza = (ap, s) => { const d = s * (ap.t / 2 + 0.12); const x = ap.oriz ? ap.x : ap.fisso + d, z = ap.oriz ? ap.fisso + d : ap.z; const i = Math.floor((x - X0) / R), j = Math.floor((z - Z0) / R); return i >= 0 && j >= 0 && i < nx && j < nz ? stanza[j * nx + i] : -1; };
  for (const ap of aperture) ap.stanze = [latoStanza(ap, -1), latoStanza(ap, 1)];

  const out = []; const messi = [];
  const sat = mask => { const S = new Int32Array((nx + 1) * (nz + 1)); for (let j = 0; j < nz; j++) { let r = 0; for (let i = 0; i < nx; i++) { r += mask(j * nx + i) ? 1 : 0; S[(j + 1) * (nx + 1) + i + 1] = S[j * (nx + 1) + i + 1] + r; } } return S; };
  const somma = (S, i0, j0, i1, j1) => { i0 = Math.max(0, i0); j0 = Math.max(0, j0); i1 = Math.min(nx, i1); j1 = Math.min(nz, j1); if (i1 <= i0 || j1 <= j0) return 0; const W = nx + 1; return S[j1 * W + i1] - S[j0 * W + i1] - S[j1 * W + i0] + S[j0 * W + i0]; };
  const area = (i0, j0, i1, j1) => Math.max(0, Math.min(nx, i1) - Math.max(0, i0)) * Math.max(0, Math.min(nz, j1) - Math.max(0, j0));

  // ingombro ruotato: r in gradi, 0 fronte +z, 180 fronte -z, 90 fronte +x, -90 fronte -x
  const ruota = (m, r) => r === 0 ? [m.lx0, m.lz0, m.lx1, m.lz1] : r === 180 ? [-m.lx1, -m.lz1, -m.lx0, -m.lz0] : r === 90 ? [m.lz0, -m.lx1, m.lz1, -m.lx0] : [-m.lz1, m.lx0, -m.lz0, m.lx1];
  const dirFronte = r => r === 0 ? [0, 1] : r === 180 ? [0, -1] : r === 90 ? [1, 0] : [-1, 0];
  // rettangolo davanti (d>0), dietro (d<0), ai lati (lato +-1, rispetto all'asse lungo il muro)
  const davanti = (fp, r, d) => { const [dx, dz] = dirFronte(r); const s = d > 0 ? 1 : -1; d = Math.abs(d);
    if (dz) return (dz * s > 0) ? [fp[0], fp[3], fp[2], fp[3] + d] : [fp[0], fp[1] - d, fp[2], fp[1]];
    return (dx * s > 0) ? [fp[2], fp[1], fp[2] + d, fp[3]] : [fp[0] - d, fp[1], fp[0], fp[3]]; };
  const lati = (fp, r, d) => { const [, dz] = dirFronte(r); return dz ? [[fp[0] - d, fp[1], fp[0], fp[3]], [fp[2], fp[1], fp[2] + d, fp[3]]] : [[fp[0], fp[1] - d, fp[2], fp[1]], [fp[0], fp[3], fp[2], fp[3] + d]]; };
  const cellR = (x0, z0, x1, z1) => [ci(x0), cj(z0), cf(x1), cg(z1)];

  // collegamento tra le porte della stanza (raggio 0,25 m)
  const base = {};
  const collegata = k => base[k] === false || collegataG(k);
  const collegataG = (k) => {
    const B = sat(c => (F[c] & (MURO | OCC)) || (stanza[c] !== k && !(F[c] & PASSO))); const rg = 5;
    const ok = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz && somma(B, i - rg, j - rg, i + rg + 1, j + rg + 1) === 0;
    const mete = [];
    for (const ap of aperture) { if (ap.tipo === 'fin') continue; const s = ap.stanze[0] === k ? -1 : ap.stanze[1] === k ? 1 : 0; if (!s) continue;
      const d = s * (ap.t / 2 + 0.45); const x = ap.oriz ? ap.x : ap.fisso + d, z = ap.oriz ? ap.fisso + d : ap.z; mete.push([Math.floor((x - X0) / R), Math.floor((z - Z0) / R)]); }
    if (mete.length < 2) return true;
    const vis = new Uint8Array(N); const [si, sj] = mete[0]; if (!ok(si, sj)) return false;
    const q = [sj * nx + si]; vis[q[0]] = 1;
    while (q.length) { const c = q.pop(); const i = c % nx, j = (c / nx) | 0; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + a, jj = j + b; const cc = jj * nx + ii; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz || vis[cc]) continue; if (!ok(ii, jj)) continue; vis[cc] = 1; q.push(cc); } }
    return mete.every(([i, j]) => vis[j * nx + i]);
  };

  // distanza libera ai due lati lungo il muro (fino a muro o fuori stanza)
  const liberoLati = (fp, r, k) => { const [, dz] = dirFronte(r); const res = [];
    for (const s of [-1, 1]) { let d = 0; for (; d < 80; d++) { let x, z; if (dz) { x = (s < 0 ? fp[0] : fp[2]) + s * (d + 0.5) * R; z = (fp[1] + fp[3]) / 2; } else { z = (s < 0 ? fp[1] : fp[3]) + s * (d + 0.5) * R; x = (fp[0] + fp[2]) / 2; }
      const i = Math.floor((x - X0) / R), j = Math.floor((z - Z0) / R); if (i < 0 || j < 0 || i >= nx || j >= nz) break; const c = j * nx + i; if ((F[c] & MURO) || stanza[c] !== k) break; } res.push(d * R); }
    return res; };

  // appoggio esatto al filo del muro
  const accosta = (x, z, r, fp) => { const [dx, dz] = dirFronte(r); let best = null;
    for (const w of RM) {
      if (dz) { if (w[2] < fp[0] + 0.01 || w[0] > fp[2] - 0.01) continue; if (dz > 0) { if (w[3] <= fp[1] + 0.03 && w[3] > fp[1] - 0.1) best = best === null ? w[3] : Math.max(best, w[3]); } else if (w[1] >= fp[3] - 0.03 && w[1] < fp[3] + 0.1) best = best === null ? w[1] : Math.min(best, w[1]); }
      else { if (w[3] < fp[1] + 0.01 || w[1] > fp[3] - 0.01) continue; if (dx > 0) { if (w[2] <= fp[0] + 0.03 && w[2] > fp[0] - 0.1) best = best === null ? w[2] : Math.max(best, w[2]); } else if (w[0] >= fp[2] - 0.03 && w[0] < fp[2] + 0.1) best = best === null ? w[0] : Math.min(best, w[0]); }
    }
    if (best === null) return [x, z];
    if (dz > 0) return [x, z + best + 0.006 - fp[1]]; if (dz < 0) return [x, z + best - 0.006 - fp[3]];
    if (dx > 0) return [x + best + 0.006 - fp[0], z]; return [x + best - 0.006 - fp[2], z]; };

  const fpDi = (m, x, z, r) => { const q = ruota(m, r); return [x + q[0], z + q[1], x + q[2], z + q[3]]; };
  const morbido = tipo => ['tappeto', 'quadro', 'tende', 'plafoniera', 'sospensione'].includes(tipo);

  // verifica e posa di un oggetto in una posizione data
  const libera = (k, rr, bit, esterno = false) => { const [i0, j0, i1, j1] = cellR(...rr); if (i1 <= i0 || j1 <= j0) return true; for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) { if (i < 0 || j < 0 || i >= nx || j >= nz) return false; const c = j * nx + i; if (F[c] & bit) return false; if (!esterno && stanza[c] !== k) return false; } return true; };
  const prova = (k, tipo, o, x, z, r, op = {}) => {
    const m = misura(tipo, o); const fp = fpDi(m, x, z, r); const sh = 0.012; const ri = [fp[0] + sh, fp[1] + sh, fp[2] - sh, fp[3] - sh];
    const [i0, j0, i1, j1] = cellR(...ri);
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
      if (i < 0 || j < 0 || i >= nx || j >= nz) return null; const c = j * nx + i;
      if (stanza[c] !== k) return null;
      if (tipo === 'tappeto') { if (F[c] & (MURO | TAPPETO | ANTA)) return null; continue; }
      if (F[c] & (MURO | OCC | USO | ANTA)) return null; if (!morbido(tipo) && (F[c] & PASSO)) return null; if (m.h > hFin[c]) return null;
    }
    if (op.clr && !libera(k, davanti(fp, r, op.clr), MURO | OCC | ANTA)) return null;
    return { m, fp };
  };
  const posa = (k, tipo, o, x, z, r, fp, op = {}) => {
    const sh = tipo === 'tappeto' ? 0.012 : -0.02; const bit = tipo === 'tappeto' ? TAPPETO : morbido(tipo) ? 0 : OCC;
    if (bit) segna(fp[0] + sh, fp[1] + sh, fp[2] - sh, fp[3] - sh, c => F[c] |= bit);
    if (op.clr) segna(...davanti(fp, r, op.clr), c => { if (!(F[c] & MURO)) F[c] |= USO; });
    const id = ids[k]; const voce = [id, tipo, +x.toFixed(3), +z.toFixed(3), r, o]; out.push(voce); const rec = { k, tipo, o, x, z, r, fp, m: misura(tipo, o) }; messi.push(rec); return rec;
  };
  const stato = () => ({ F: F.slice(), n: out.length, nm: messi.length });
  const ripristina = s => { F = s.F; out.length = s.n; messi.length = s.nm; };
  const metti = (k, tipo, o, x, z, r, op = {}) => { const p = prova(k, tipo, o, x, z, r, op); if (!p) return null; const s = stato(); const rec = posa(k, tipo, o, x, z, r, p.fp, op); if (!morbido(tipo) && !op.senzaCollegamento && !collegata(k)) { ripristina(s); return null; } return rec; };

  // ricerca: tutte le posizioni valide, ordinate per preferenza; poi prova in ordine con il gruppo collegato
  const cerca = (k, tipo, o, op = {}) => {
    const m = misura(tipo, o); const rots = op.rots || [0, 180, 90, -90]; const cand = [];
    const B = sat(c => stanza[c] !== k || (F[c] & (MURO | OCC | USO | ANTA)) || (!morbido(tipo) && (F[c] & PASSO)) || m.h > hFin[c]);
    const Bc = sat(c => (F[c] & (MURO | OCC | ANTA)) || (stanza[c] !== k && !(F[c] & PASSO)));
    const Wl = sat(c => F[c] & MURO), Rg = sat(c => F[c] & RING);
    const ri = op.rett ? cellR(...op.rett) : cellR(...rett[ids[k]]);
    for (const r of rots) {
      const q = ruota(m, r); const fw = q[2] - q[0], fd = q[3] - q[1]; const wc = Math.ceil(fw / R - 1e-6), dc = Math.ceil(fd / R - 1e-6);
      const [dx, dz] = dirFronte(r); const clr = op.clr || 0, cc = Math.ceil(clr / R), lt = Math.ceil((op.lati || 0) / R);
      for (let j = ri[1] - 1; j <= ri[3] - dc + 1; j++) for (let i = ri[0] - 1; i <= ri[2] - wc + 1; i++) {
        if (somma(B, i, j, i + wc, j + dc) || area(i, j, i + wc, j + dc) < wc * dc) continue;
        let addossato = false, suRing = false;
        if (op.muro !== false) {
          const bk = dz > 0 ? [i, j - 1, i + wc, j] : dz < 0 ? [i, j + dc, i + wc, j + dc + 1] : dx > 0 ? [i - 1, j, i, j + dc] : [i + wc, j, i + wc + 1, j + dc];
          const n = area(...bk); addossato = n > 0 && somma(Wl, ...bk) === n; suRing = addossato && somma(Rg, ...bk) > 0;
          if (op.muro && !addossato) continue;
        }
        if (cc) { const fr = dz > 0 ? [i, j + dc, i + wc, j + dc + cc] : dz < 0 ? [i, j - cc, i + wc, j] : dx > 0 ? [i + wc, j, i + wc + cc, j + dc] : [i - cc, j, i, j + dc]; if (somma(Bc, ...fr) || area(...fr) < (fr[2] - fr[0]) * (fr[3] - fr[1])) continue; }
        if (lt) { const ls = dz ? [[i - lt, j, i, j + dc], [i + wc, j, i + wc + lt, j + dc]] : [[i, j - lt, i + wc, j], [i, j + dc, i + wc, j + dc + lt]]; if (ls.some(l => somma(Bc, ...l))) continue; }
        if (op.giro) { const g = Math.ceil(op.giro / R); if (somma(Bc, i - g, j - g, i + wc + g, j + dc + g)) continue; }
        // posizione: ingombro centrato nella cella, poi accostato al muro
        const cx = X0 + (i + wc / 2) * R, cz = Z0 + (j + dc / 2) * R; let x = cx - (q[0] + q[2]) / 2, z = cz - (q[1] + q[3]) / 2;
        if (addossato) [x, z] = accosta(x, z, r, [x + q[0], z + q[1], x + q[2], z + q[3]]);
        const fp = [x + q[0], z + q[1], x + q[2], z + q[3]];
        cand.push({ x, z, r, fp, addossato, suRing, cx, cz });
      }
    }
    const ctx = contesto(k);
    for (const c of cand) { c.ll = liberoLati(c.fp, c.r, k); c.s = (op.pref ? op.pref(c, ctx) : 0) + (op.muro !== false && c.addossato ? 0 : 0); }
    cand.sort((a, b) => b.s - a.s);
    return cand;
  };
  const piazza = (k, tipo, o, op = {}) => {
    const cand = cerca(k, tipo, o, op); const maxP = op.prove || 40; let n = 0;
    for (const c of cand) {
      if (n++ >= maxP) break; const s = stato();
      const rec = posa(k, tipo, o, c.x, c.z, c.r, c.fp, op);
      if (!collegata(k)) { ripristina(s); continue; }
      if (op.poi && op.poi(rec, c) === false) { ripristina(s); continue; }
      rec.c = c; return rec;
    }
    return null;
  };

  // contesto della stanza: porte e finestre
  const contesto = k => ({ porte: aperture.filter(a => a.tipo !== 'fin' && a.stanze.includes(k)), fin: aperture.filter(a => (a.tipo === 'fin' || a.tipo === 'pf') && a.stanze.includes(k)), r: rett[ids[k]] });
  const dist = (c, a) => Math.hypot((c.fp[0] + c.fp[2]) / 2 - a.x, (c.fp[1] + c.fp[3]) / 2 - a.z);
  const lontanoPorte = (c, ctx) => ctx.porte.length ? Math.min(3.5, ...ctx.porte.map(a => dist(c, a))) : 0;
  const angolo = c => -Math.min(...c.ll);
  const centro = c => -Math.abs(c.ll[0] - c.ll[1]) / 2;
  const sulMuroDi = (c, a) => { const [dx, dz] = dirFronte(c.r); if (dz && !a.oriz) return false; if (dx && a.oriz) return false;
    const back = dz > 0 ? c.fp[1] : dz < 0 ? c.fp[3] : dx > 0 ? c.fp[0] : c.fp[2]; return Math.abs(Math.abs(back - a.fisso) - a.t / 2) < 0.06 || Math.abs(back - a.fisso) < a.t; };
  const finestraDietro = (c, ctx) => ctx.fin.some(a => sulMuroDi(c, a) && (a.oriz ? a.p1 > c.fp[0] - 0.3 && a.p0 < c.fp[2] + 0.3 : a.p1 > c.fp[1] - 0.3 && a.p0 < c.fp[3] + 0.3));
  const portaSulMuro = (c, ctx) => ctx.porte.some(a => sulMuroDi(c, a));
  const vicinoFinestra = (c, ctx) => ctx.fin.length ? -Math.min(...ctx.fin.map(a => dist(c, a))) : 0;

  // tende ai lati delle finestre e quadri: origine sul filo del muro
  const tende = (k) => { for (const a of contesto(k).fin) { if (a.p1 - a.p0 < 1.2 || a.tipo === 'pf' && a.p1 - a.p0 < 1.6) continue; const s = a.stanze[0] === k ? -1 : 1; const face = a.fisso + s * a.t / 2;
    const r = a.oriz ? (s > 0 ? 0 : 180) : (s > 0 ? 90 : -90);
    for (const p of [a.p0 - 0.22, a.p1 + 0.22]) { const x = a.oriz ? p : face, z = a.oriz ? face : p; const fp = a.oriz ? [p - 0.2, Math.min(face, face + s * 0.11), p + 0.2, Math.max(face, face + s * 0.11)] : [Math.min(face, face + s * 0.11), p - 0.2, Math.max(face, face + s * 0.11), p + 0.2];
      if (!libera(k, [fp[0] + 0.01, fp[1] + 0.01, fp[2] - 0.01, fp[3] - 0.01], MURO | OCC | ANTA | PASSO)) continue; posa(k, 'tende', { L: 0.4 }, x, z, r, fp); } } };
  // offset locale -> mondo
  const loc = (rec, lx, lz) => { const t = rec.r * Math.PI / 180; return [rec.x + lx * Math.cos(t) + lz * Math.sin(t), rec.z - lx * Math.sin(t) + lz * Math.cos(t)]; };
  const angoli = (k, n, s0, cosa = 'pianta') => { for (let i = 0; i < n; i++) { const o = cosa === 'pianta' ? { s: 0.8 + 0.2 * ((i + k) % 2), seed: s0 + i * 7 } : { s: 0.9 + 0.1 * (i % 2), seed: s0 + i * 4 }; piazza(k, cosa, o, { pref: c => -Math.min(...c.ll) * 3 - Math.max(...c.ll) * 0.05, muro: true, prove: 20 }); } };

  // ---------- tipi di stanza ----------
  const tipoDi = s => { if (s.uso) return s.uso; const id = s.id.toLowerCase();
    if (/^(terrazz|balcon|portic|giardin|loggia)/.test(id) || s.esterno) return 'esterno';
    if (/^bagno|^wc|^servizio/.test(id)) return 'bagno'; if (/^cucina|^cucinotto/.test(id)) return 'cucina';
    if (/^cameretta/.test(id)) return 'cameretta'; if (/^matrimonial|^padronal/.test(id)) return 'matrimoniale'; if (/^camera/.test(id)) return 'camera';
    if (/^studio/.test(id)) return 'studio'; if (/^(ingresso|corridoio|disimpegno|anticamera)/.test(id)) return 'passaggio';
    if (/^(soggiorno|salotto|living|loft|openspace|giorno)/.test(id)) return 'soggiorno'; return 'soggiorno'; };
  const tipi = ids.map(id => tipoDi(sInfo(id)));
  const areaDi = k => P.stanze.filter(s => s.id === ids[k]).reduce((a, s) => a + (s.r[2] - s.r[0]) * (s.r[3] - s.r[1]), 0);
  const conCucina = new Set(); if (!tipi.includes('cucina')) { let best = -1; tipi.forEach((t, k) => { if (t === 'soggiorno' && (best < 0 || areaDi(k) > areaDi(best))) best = k; }); if (best >= 0) conCucina.add(best); }
  for (const k of ids.keys()) if (sInfo(ids[k]).cucina) conCucina.add(k);
  let luci = 0;

  const fCucina = (k, conTavolo) => {
    let rec = null;
    for (const L of [3.6, 3.2, 2.8, 2.4, 2.0, 1.8]) { const o = { L, lav: -+(L * 0.2).toFixed(2), fuochi: +(L * 0.25).toFixed(2), colore: ['laccatoB', 'salvia', 'laccatoB'][k % 3] };
      rec = piazza(k, 'cucina', o, { muro: true, clr: 1.0, pref: (c, ctx) => angolo(c) * 2 + lontanoPorte(c, ctx) * 0.5, prove: 30 }); if (rec) break; }
    if (!rec) return null;
    // colonne a fianco, poi isola davanti negli spazi grandi
    const L = rec.o.L; for (const s of [1, -1]) { const [x, z] = loc(rec, s * (L / 2 + 0.6 + 0.012), 0); if (metti(k, 'colonne', { L: 1.2, colore: rec.o.colore }, x, z, rec.r, { clr: 0.9 })) break; }
    if (!conTavolo && areaDi(k) > 26) for (const IL of [2.2, 1.8]) { const [x, z] = loc(rec, 0, 0.33 + 1.1 + 0.5); if (metti(k, 'isola', { L: IL, P: 1.0, sgabelli: IL > 2 ? 3 : 2, colore: 'noce' }, x, z, rec.r, { clr: 0.6 })) { luci++; break; } }
    return rec;
  };
  const fTavolo = (k, Ls, vicino) => { for (const L of Ls) { const n = L >= 1.8 ? 3 : 2; const r = piazza(k, 'tavolo', { L, P: L >= 1.6 ? 0.92 : 0.8, n, luce: luci < 6 }, { muro: false, rots: [0, 90], giro: 0.45, pref: (c, ctx) => (vicino ? -Math.hypot(c.cx - vicino.x, c.cz - vicino.z) : 0) + lontanoPorte(c, ctx) * 0.3, prove: 30 }); if (r) { if (r.o.luce) luci++; return r; } } return null; };

  const fSoggiorno = (k) => {
    const cu = conCucina.has(k) ? fCucina(k, false) : null;
    let tv = null, div = null;
    for (const TL of [2.0, 1.8, 1.6]) {
      tv = piazza(k, 'mobileTV', { L: TL }, { muro: true, clr: 1.6, prove: 60, pref: (c, ctx) => centro(c) + (finestraDietro(c, ctx) ? -3 : 0) + (cu ? Math.min(4, Math.hypot(c.cx - cu.x, c.cz - cu.z)) * 0.6 : 0) + (portaSulMuro(c, ctx) ? -0.5 : 0),
        poi: (rec) => {
          for (const DL of [2.6, 2.4, 2.2, 2.0]) for (const d of [2.6, 2.4, 2.8, 2.2, 3.0, 2.0]) {
            const [x, z] = loc(rec, 0, 0.21 + d + 0.95 / 2); const r = rec.r === 0 ? 180 : rec.r === 180 ? 0 : -rec.r;
            const p = prova(k, 'divano', { L: DL }, x, z, r); if (!p) continue;
            const dietro = davanti(p.fp, r, -0.6); const aMuro = !libera(k, dietro, MURO, true); if (!aMuro && !libera(k, dietro, MURO | OCC | ANTA)) continue;
            div = metti(k, 'divano', { L: DL }, x, z, r); if (!div) continue; div.aMuro = aMuro;
            const rw = +(DL + 0.2).toFixed(2), rd = +(d - 0.5).toFixed(2); const [tx, tz] = loc(rec, 0, 0.21 + 0.25 + rd / 2 + 0.05);
            const pr = prova(k, 'tappeto', { w: rw, d: rd }, tx, tz, rec.r); if (pr) posa(k, 'tappeto', { w: rw, d: rd }, tx, tz, rec.r, pr.fp);
            const [vx, vz] = loc(rec, 0, 0.21 + d - 0.85); metti(k, 'tavolino', { r: 0.42 }, vx, vz, 0);
            return true;
          }
          return false;
        } });
      if (tv) break;
    }
    if (div) {
      // poltrona di lato, lampada a un capo del divano, quadro sopra se a muro
      for (const s of [1, -1]) { const [x, z] = loc(tv, s * (div.o.L / 2 + 0.75), 0.21 + 1.3); const r = tv.r + (s > 0 ? -90 : 90); const rr = ((r + 540) % 360) - 180; if (metti(k, 'poltrona', {}, x, z, rr === -180 ? 180 : rr)) break; }
      for (const s of [1, -1]) { const [x, z] = loc(div, s * (div.o.L / 2 + 0.3), -0.25); if (metti(k, 'lampada', { luce: luci < 6 }, x, z, 0)) { luci++; break; } }
      if (div.aMuro) { const [dx, dz] = dirFronte(div.r); const fp = div.fp; const x = dz ? (fp[0] + fp[2]) / 2 : (dx > 0 ? fp[0] - 0.006 : fp[2] + 0.006), z = dz ? (dz > 0 ? fp[1] - 0.006 : fp[3] + 0.006) : (fp[1] + fp[3]) / 2; posa(k, 'quadro', { w: 1.2, h: 0.8, y: 1.5, v: k % 3 }, x, z, div.r, [x, z, x, z]); }
    }
    fTavolo(k, [2.0, 1.8, 1.6, 1.4, 1.2], cu ? { x: cu.x, z: cu.z } : null);
    angoli(k, 2, 4); tende(k);
  };

  const fCamera = (k, w, tipo) => {
    const piccolo = tipo === 'cameretta';
    const letto = piazza(k, 'letto', { w, L: 2.0, plaid: ['salvia', 'terracotta', 'salvia'][k % 3], testata: piccolo ? 'salvia' : undefined }, { muro: true, clr: 0.6, lati: piccolo ? 0 : 0.55, prove: 60,
      pref: (c, ctx) => (piccolo ? angolo(c) : centro(c) * 1.5) + (finestraDietro(c, ctx) ? -2 : 0) + (portaSulMuro(c, ctx) ? -1 : 0) + lontanoPorte(c, ctx) * 0.4 });
    if (letto) {
      const lz = letto.m.lz0 + 0.22; for (const s of piccolo ? [1, -1] : [1, -1]) { const [x, z] = loc(letto, s * (w / 2 + 0.15 + 0.23), lz); if (metti(k, 'comodino', {}, x, z, letto.r) && piccolo) break; }
      if (!piccolo) { const [dx, dz] = dirFronte(letto.r); const fp = letto.fp; const x = dz ? (fp[0] + fp[2]) / 2 : (dx > 0 ? fp[0] - 0.006 : fp[2] + 0.006), z = dz ? (dz > 0 ? fp[1] - 0.006 : fp[3] + 0.006) : (fp[1] + fp[3]) / 2; posa(k, 'quadro', { w: 1.0, h: 0.7, y: 1.5, v: (k + 1) % 3 }, x, z, letto.r, [x, z, x, z]); }
      const [tx, tz] = loc(letto, 0, letto.m.lz1 + 0.55); const to = { w: +(w + 0.6).toFixed(2), d: 1.0 }; const pr = prova(k, 'tappeto', to, tx, tz, letto.r); if (pr) posa(k, 'tappeto', to, tx, tz, letto.r, pr.fp);
    }
    for (const L of [2.6, 2.4, 2.0, 1.6, 1.2, 1.0]) if (piazza(k, 'armadio', { L }, { muro: true, clr: 0.7, pref: (c, ctx) => angolo(c) + lontanoPorte(c, ctx) * 0.2 })) break;
    if (piccolo || tipo === 'camera' && areaDi(k) > 14) for (const L of [1.4, 1.2, 1.0]) if (piazza(k, 'scrivania', { L }, { muro: true, pref: vicinoFinestra, prove: 30 })) break;
    if (!piccolo) piazza(k, 'poltrona', { mat: 'tessuto' }, { muro: true, pref: c => angolo(c) * 2, prove: 20 });
    angoli(k, 1, 21); tende(k);
  };

  const fBagno = (k) => {
    const [a0, b0, a1, b1] = rett[ids[k]]; const lato = Math.max(a1 - a0, b1 - b0) - 0.2, A = areaDi(k);
    let box = null;
    if (A >= 5.5 && lato >= 1.8) box = piazza(k, 'vasca', { L: 1.7, P: 0.75 }, { muro: true, pref: c => -Math.min(...c.ll) * 4 - Math.max(...c.ll) * 0.1, prove: 30 });
    if (!box) for (const w of [0.9, 0.8]) { box = piazza(k, 'doccia', { w, d: w, lato: 1 }, { muro: true, pref: c => -Math.min(...c.ll) * 4, prove: 30 }); if (box) break; }
    if (box && box.tipo === 'doccia') { // vetro laterale sul lato libero: segno dell'asse locale x nel mondo
      const ll = box.c.ll; const sw = ll[0] > ll[1] ? -1 : 1; const sx = box.r === 0 || box.r === -90 ? 1 : -1; box.o.lato = sw * sx; }
    piazza(k, 'wc', {}, { muro: true, clr: 0.55, lati: 0.15, pref: (c, ctx) => lontanoPorte(c, ctx) * 0.5 + angolo(c) * 0.3, prove: 40 });
    const Ll = A > 6 ? [1.2, 1.0, 0.8] : [1.0, 0.8, 0.6]; for (const L of Ll) if (piazza(k, 'lavabo', { L, doppio: L >= 1.2 ? 1 : undefined }, { muro: true, clr: 0.6, pref: (c, ctx) => centro(c) - (finestraDietro(c, ctx) ? 2 : 0), prove: 40 })) break;
    if (A > 6) piazza(k, 'bidet', {}, { muro: true, clr: 0.55, lati: 0.15, prove: 30, pref: c => -Math.min(...c.ll) });
  };

  const fStudio = (k) => {
    for (const L of [1.6, 1.4, 1.2]) if (piazza(k, 'scrivania', { L }, { muro: true, clr: 0.3, pref: vicinoFinestra, prove: 40 })) break;
    for (const L of [1.6, 1.2, 1.0]) if (piazza(k, 'libreria', { L }, { muro: true, clr: 0.6, pref: c => centro(c), prove: 30 })) break;
    if (areaDi(k) > 10) piazza(k, 'divano', { L: 1.8, mat: 'tessutoScuro' }, { muro: true, clr: 0.6, pref: c => centro(c), prove: 30 });
    angoli(k, 1, 31); tende(k);
  };

  const fPassaggio = (k, n) => {
    for (const L of [1.2, 1.0, 0.8]) if (piazza(k, 'consolle', { L }, { muro: true, clr: 0.85, pref: (c, ctx) => centro(c) - lontanoPorte(c, ctx) * 0.2, prove: 40 })) break;
    const [a0, b0, a1, b1] = rett[ids[k]]; const oriz = a1 - a0 >= b1 - b0; const lungo = Math.min(6, (oriz ? a1 - a0 : b1 - b0) - 1.2), corto = (oriz ? b1 - b0 : a1 - a0) - 0.6;
    if (lungo > 0.8 && corto > 0.6) { const o = { w: +(oriz ? lungo : Math.min(0.9, corto)).toFixed(2), d: +(oriz ? Math.min(0.9, corto) : lungo).toFixed(2), scuro: 1 }; const x = (a0 + a1) / 2, z = (b0 + b1) / 2; const p = prova(k, 'tappeto', o, x, z, 0); if (p) posa(k, 'tappeto', o, x, z, 0, p.fp); }
    const x = (a0 + a1) / 2, z = (b0 + b1) / 2; posa(k, 'plafoniera', { luce: n === 0 && luci < 6 }, x, z, 0, [x, z, x, z]); if (n === 0) luci++;
  };

  const fEsterno = (k) => {
    const [a0, b0, a1, b1] = rett[ids[k]]; const prof = Math.min(a1 - a0, b1 - b0);
    if (prof < 1.7) { // balcone
      const p = piazza(k, 'poltronaEsterna', {}, { muro: true, clr: 0.4, pref: c => angolo(c), prove: 30 });
      if (p) { const [x, z] = loc(p, 0.8, 0.1); metti(k, 'tavolinoEsterno', { r: 0.28 }, x, z, 0); }
      angoli(k, 1, 11, 'vasoGrande'); return;
    }
    for (const L of [2.2, 2.0, 1.6]) { const d = piazza(k, 'divanoEsterno', { L }, { muro: true, clr: 1.0, pref: c => (c.suRing ? -2 : 0) + centro(c) * 0.3 - (c.cx + c.cz) * 0.01, prove: 40 });
      if (d) { const [x, z] = loc(d, 0, 0.43 + 0.55); metti(k, 'tavolinoEsterno', { r: 0.35 }, x, z, 0); const [px, pz] = loc(d, -(L / 2 + 0.6), 0.9); metti(k, 'poltronaEsterna', {}, px, pz, d.r + 90 > 180 ? d.r - 270 : d.r + 90); break; } }
    if (areaDi(k) > 18) fTavolo2(k);
    if (areaDi(k) > 30) { const l = piazza(k, 'lettino', {}, { muro: false, rots: [0, 180, 90, -90], giro: 0.3, prove: 40, pref: (c, ctx) => lontanoPorte(c, ctx) }); if (l) { const [x, z] = loc(l, 1.0, 0); metti(k, 'lettino', {}, x, z, l.r); } }
    angoli(k, areaDi(k) > 30 ? 3 : 2, 11, 'vasoGrande');
  };
  const fTavolo2 = k => { for (const L of [1.8, 1.6]) if (piazza(k, 'tavoloEsterno', { L, n: 2 }, { muro: false, rots: [0, 90], giro: 0.4, prove: 40, pref: (c, ctx) => -lontanoPorte(c, ctx) * 0.2 })) return; };

  // ordine: prima le stanze dove lo spazio conta di più
  const prio = { soggiorno: 0, cucina: 1, matrimoniale: 2, camera: 3, cameretta: 3, studio: 4, bagno: 5, passaggio: 6, esterno: 7 };
  const seq = [...ids.keys()].sort((a, b) => prio[tipi[a]] - prio[tipi[b]] || areaDi(b) - areaDi(a));
  let nPass = 0;
  for (const k of ids.keys()) base[k] = collegataG(k);
  for (const k of seq) {
    const t = tipi[k];
    if (t === 'soggiorno') fSoggiorno(k);
    else if (t === 'cucina') { const cu = fCucina(k, true); fTavolo(k, [1.6, 1.4, 1.2], cu ? { x: cu.x, z: cu.z } : null); }
    else if (t === 'matrimoniale') fCamera(k, 1.6, t);
    else if (t === 'camera') fCamera(k, areaDi(k) >= 11 ? 1.6 : 1.4, t);
    else if (t === 'cameretta') fCamera(k, 0.9, t);
    else if (t === 'studio') fStudio(k);
    else if (t === 'bagno') fBagno(k);
    else if (t === 'passaggio') fPassaggio(k, nPass++);
    else if (t === 'esterno') fEsterno(k);
  }
  const ordine = seq.filter(k => tipi[k] !== 'esterno').concat(seq.filter(k => tipi[k] === 'esterno')).map(k => ids[k]);
  return { arredo: out, ordine };
}
