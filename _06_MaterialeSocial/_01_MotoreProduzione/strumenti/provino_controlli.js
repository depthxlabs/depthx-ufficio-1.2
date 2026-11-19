// DepthX Linea 1.2: provino veloce, solo i controlli automatici di arredo e camera, senza fotogrammi.
// Gira anche senza scheda grafica (macchine di GitHub, SwiftShader).
// node provino_controlli.js <radice> <pagina relativa con parametri> <orizzontale|verticale|post>
// Stampa una riga: "<pagina> | durata X s | arredo N problemi | camera M problemi" oppure "ERRORE ...".
const { apri } = require('./registra.js');
(async () => {
  const [, , radice, pagina, modo = 'orizzontale'] = process.argv;
  const { p, chiudi } = await apri(radice, pagina, modo);
  const c = await p.evaluate(() => window.__controlli());
  const mobili = await p.evaluate(() => { const a = window.__arredoAuto; return a ? a.arredo.length : -1; });
  if (mobili === 0) c.arredo.push('nessun mobile nella casa');
  await chiudi();
  console.log(`${pagina} | durata ${c.lung.toFixed(2)} s | arredo ${c.arredo.length} problemi | camera ${c.camera.length} problemi | mobili ${mobili}`);
  for (const e of c.arredo) console.log('  arredo:', e);
  for (const e of c.camera) console.log('  camera:', e);
  process.exit(0);
})().catch(e => { console.log('ERRORE', e.message); process.exit(3); });
