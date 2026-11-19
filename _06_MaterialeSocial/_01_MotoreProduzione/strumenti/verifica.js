// Verifica di una casa e versione: controlli automatici, mobili per stanza, 6 fotogrammi su tutta la durata.
// node verifica.js <radice> <pagina> <modo> <cartella uscita>
const { apri, entro } = require('./registra.js');
const fs = require('fs'), path = require('path');
(async () => {
  const [, , radice, pagina, modo, dir] = process.argv;
  fs.mkdirSync(dir, { recursive: true });
  const errori = [];
  const { p, chiudi } = await apri(radice, pagina, modo);
  p.on('pageerror', e => errori.push(e.message));
  const c = await p.evaluate(() => window.__controlli());
  const info = await p.evaluate(() => {
    const a = window.__arredoAuto, perStanza = {};
    if (a) for (const x of a.arredo) perStanza[x[0]] = (perStanza[x[0]] || 0) + 1;
    return { mobili: a ? a.arredo.length : -1, perStanza };
  });
  const T = [1, 2, 3, 4, 5, 6].map(k => +(c.lung * k / 7).toFixed(2));
  for (let i = 0; i < T.length; i++) {
    await entro(p.evaluate(t => window.__vai(t), T[i]), 300000, 'vai');
    await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    fs.writeFileSync(path.join(dir, `f${i + 1}.jpg`), await p.screenshot({ type: 'jpeg', quality: 85 }));
  }
  await chiudi();
  const esito = { pagina, durata: c.lung, arredo: c.arredo, camera: c.camera, ...info, errori, tempi: T };
  fs.writeFileSync(path.join(dir, 'esito.json'), JSON.stringify(esito, null, 1));
  console.log(`${pagina} | arredo ${c.arredo.length} | camera ${c.camera.length} | mobili ${info.mobili} | stanze ${JSON.stringify(info.perStanza)} | errori ${errori.length}`);
  process.exit(0);
})().catch(e => { console.log('ERRORE', e.message); process.exit(3); });
