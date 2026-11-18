// DepthX Linea 1.2: provino. Scrive i controlli automatici e i fotogrammi ai tempi indicati, poi un mosaico.
// node provino.js <radice> <pagina relativa con parametri> <cartella uscita> <t1,t2,...> <orizzontale|verticale> [colonne]
const { apri, entro, ora } = require('./registra.js');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
(async () => {
  const [, , radice, pagina, dir, tempi, modo, col = '4'] = process.argv;
  fs.mkdirSync(dir, { recursive: true }); for (const f of fs.readdirSync(dir)) if (/^\d{3}\.jpg$/.test(f)) fs.unlinkSync(path.join(dir, f));
  const t0 = Date.now();
  const { p, chiudi } = await apri(radice, pagina, modo);
  console.log(ora(), 'pronto in', ((Date.now() - t0) / 1000).toFixed(1), 's');
  const c = await p.evaluate(() => window.__controlli());
  fs.writeFileSync(path.join(dir, 'controlli.json'), JSON.stringify(c, null, 1));
  console.log('durata', c.lung.toFixed(2), 's | arredo', c.arredo.length, 'problemi | camera', c.camera.length, 'problemi');
  for (const e of c.arredo) console.log('  arredo:', e); for (const e of c.camera) console.log('  camera:', e);
  const T = tempi.split(',').map(Number); let i = 0;
  for (const t of T) {
    const a = Date.now();
    await entro(p.evaluate(t => window.__vai(t), t), 300000, 'vai');
    await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    fs.writeFileSync(path.join(dir, String(i++).padStart(3, '0') + '.jpg'), await p.screenshot({ type: 'jpeg', quality: 88 }));
    console.log(ora(), 't', t, ((Date.now() - a) / 1000).toFixed(1), 's');
  }
  await chiudi();
  const v = modo !== 'orizzontale', w = v ? 270 : 480, righe = Math.ceil(T.length / +col);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(dir, '%03d.jpg'), '-vf', `scale=${w}:-1,tile=${col}x${righe}:padding=4:color=white`, '-frames:v', '1', '-update', '1', path.join(dir, 'mosaico.jpg')]);
  console.log('mosaico', path.join(dir, 'mosaico.jpg'));
  process.exit(0);
})().catch(e => { console.log('ERRORE', e.message); process.exit(3); });
