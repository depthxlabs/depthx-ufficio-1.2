// DepthX Linea 1.2: render in parallelo su una macchina con scheda grafica (Vast.ai o altra).
// node vast_rendi.js <radice> <coda> [processi=6] [fotogrammi per parte=400]
// Riga di coda: id|pagina relativa con parametri|orizzontale o verticale|percorso del video (relativo alla radice o con _24_Linea1.2_FloorViewEUnfold\ dentro)
// Ogni video si divide in parti; ogni parte e' un Chrome con registra.js. Appena un video ha tutte le parti si codifica e si fa il mosaico.
// Scrive stato.json e vast_rendi.log nella cartella strumenti.
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const { apri, ora } = require('./registra.js');
const [, , radice, fileCoda, Wa = '6', Pa = '400'] = process.argv;
const W = +Wa, PARTE = +Pa, S = __dirname, LOG = path.join(S, 'vast_rendi.log');
const scrivi = m => { const r = `${new Date().toISOString().slice(0, 19)} ${m}`; console.log(r); fs.appendFileSync(LOG, r + '\n'); };
const esegui = (cmd, args, log) => new Promise(r => { const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }); const f = fs.createWriteStream(log, { flags: 'a' }); p.stdout.pipe(f); p.stderr.pipe(f); p.on('close', c => r(c)); });
const relVideo = v => { const k = v.indexOf('_24_Linea1.2_FloorViewEUnfold'); const r = k >= 0 ? v.slice(k + '_24_Linea1.2_FloorViewEUnfold'.length + 1) : v; return path.join(radice, ...r.split(/[\\/]/)); };

(async () => {
  const lavori = fs.readFileSync(fileCoda, 'utf8').split(/\r?\n/).filter(l => l.includes('|')).map(l => { const [id, pagina, modo, video] = l.replace(/^﻿/, '').split('|'); return { id, pagina, modo, video: relVideo(video), fot: path.join(radice, '_00_Motore', '_fotogrammi', id) }; });
  scrivi(`avvio: ${lavori.length} video, ${W} processi, parti da ${PARTE} fotogrammi`);
  // durata di ogni video e controllo anti tremolio (quattro campioni al secondo, tre fotogrammi consecutivi, solo macchie), in parallelo
  // soglie tarate il 18/11/2026: FloorView vecchia 0,77% contro 0,00% corretta; Unfold, bordi di muri vicini alla camera in movimento fino a 1,28%
  // ordine del 18/11/2026: 0,00% su ogni video; il controllo confronta tre rendering a un quarto di fotogramma
  const sogliaDi = L => +(process.env.SOGLIA_GLITCH || 0); const daFare = [...lavori]; const scartati = new Set();
  await Promise.all(Array.from({ length: Math.min(W, lavori.length) }, async () => { while (daFare.length) { const L = daFare.shift();
    const { p, chiudi } = await apri(radice, L.pagina, L.modo);
    L.lung = await p.evaluate(() => window.__lung); L.N = Math.round(L.lung * 60) + 1;
    const tempi = []; for (let t = 0.5; t < L.lung - 0.2; t += 0.25) tempi.push(+t.toFixed(2));
    const g = await p.evaluate(tt => window.__glitch(tt), tempi); await chiudi();
    const mx = g.reduce((a, x) => x.frazione > a.frazione ? x : a, { frazione: 0 });
    fs.writeFileSync(path.join(S, `antiglitch_${L.id}.json`), JSON.stringify(g));
    scrivi(`${L.id}: ${L.lung} s, ${L.N} fotogrammi, tremolio massimo ${(mx.frazione * 100).toFixed(2)}% a t=${mx.t}`);
    if (mx.frazione > sogliaDi(L) && !process.env.SENZA_ANTIGLITCH) { scrivi(`${L.id}: NOTGO anti tremolio (soglia ${(sogliaDi(L) * 100).toFixed(2)}%), non si registra`); scartati.add(L.id); }
  } }));
  for (const id of scartati) lavori.splice(lavori.findIndex(L => L.id === id), 1);
  for (const L of lavori) {
    L.parti = []; for (let a = 0; a < L.N; a += PARTE) L.parti.push({ a, b: Math.min(L.N - 1, a + PARTE - 1), prove: 0, fatta: false });
    fs.mkdirSync(L.fot, { recursive: true }); fs.mkdirSync(path.dirname(L.video), { recursive: true });
  }
  if (process.env.SOLO_CONTROLLO) { scrivi('solo controllo: fine'); process.exit(0); }
  const tot = lavori.reduce((s, L) => s + L.N, 0), t0 = Date.now();
  const fatti = () => lavori.reduce((s, L) => s + fs.readdirSync(L.fot).filter(f => f.endsWith('.jpg')).length, 0);
  const coda = []; for (const L of lavori) for (const P of L.parti) coda.push({ L, P });
  const codifiche = [];
  const stato = setInterval(() => { const n = fatti(), s = (Date.now() - t0) / 1000; const st = { fotogrammi: n, totale: tot, secondi: Math.round(s), ritmo: +(n / s).toFixed(2), restanti_min: n ? +(((tot - n) / (n / s)) / 60).toFixed(1) : null, video: lavori.map(L => ({ id: L.id, fatto: fs.existsSync(L.video) })) }; fs.writeFileSync(path.join(S, 'stato.json'), JSON.stringify(st, null, 1)); scrivi(`ritmo ${st.ritmo} fotogrammi/s, ${n}/${tot}, restano circa ${st.restanti_min} min`); }, 60000);

  const codifica = async L => {
    const sc = L.modo === 'post' ? '1080:1350' : L.modo === 'verticale' ? '1080:1920' : '1920:1080'; const lg = path.join(S, `cod_${L.id}.log`);
    scrivi(`${L.id}: codifica di ${L.N} fotogrammi`);
    const c = await esegui('ffmpeg', ['-v', 'error', '-y', '-framerate', '60', '-i', path.join(L.fot, '%05d.jpg'), '-vf', `scale=${sc}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-profile:v', 'high', '-level', '4.2', '-r', '60', '-an', '-movflags', '+faststart', L.video], lg);
    if (c !== 0) { scrivi(`${L.id}: NOTGO codifica, vedi ${lg}`); return; }
    const lato = L.modo === 'orizzontale' ? 384 : 216, n = Math.floor(L.lung / 2) + 1, righe = Math.ceil(n / 5);
    await esegui('ffmpeg', ['-v', 'error', '-y', '-i', L.video, '-vf', `fps=1/2,scale=${lato}:-1,tile=5x${righe}:padding=4:color=white`, '-frames:v', '1', '-update', '1', path.join(path.dirname(L.video), `mosaico_${L.modo}.jpg`)], lg);
    scrivi(`${L.id}: FATTO ${L.video}`);
  };

  const lavoratore = async w => {
    while (coda.length) {
      const { L, P } = coda.shift(); P.prove++;
      const lg = path.join(S, `reg_${L.id}_${P.a}.log`);
      const c = await esegui('node', [path.join(S, 'registra.js'), radice, L.pagina, L.fot, L.modo, String(P.a), String(P.b)], lg);
      if (c === 0) { P.fatta = true; if (L.parti.every(q => q.fatta)) codifiche.push(codifica(L)); }
      else if (P.prove < 3) { scrivi(`${L.id} parte ${P.a}: NOTGO, la rimetto in coda`); coda.push({ L, P }); }
      else scrivi(`${L.id} parte ${P.a}: NOTGO dopo 3 prove`);
    }
  };
  await Promise.all(Array.from({ length: W }, (_, i) => lavoratore(i)));
  await Promise.all(codifiche);
  clearInterval(stato);
  const s = (Date.now() - t0) / 1000; scrivi(`FINE: ${tot} fotogrammi in ${(s / 60).toFixed(1)} min, ritmo medio ${(tot / s).toFixed(2)} fotogrammi/s`);
  fs.writeFileSync(path.join(S, 'FINE.txt'), String(Math.round(s)));
  process.exit(0);
})().catch(e => { scrivi('ERRORE ' + e.stack); process.exit(3); });
