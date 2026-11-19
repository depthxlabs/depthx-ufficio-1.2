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
    const tipi = {};
    if (a) for (const x of a.arredo) { perStanza[x[0]] = (perStanza[x[0]] || 0) + 1; (tipi[x[0]] = tipi[x[0]] || []).push(x[1]); }
    // controllo rigido: letto in ogni camera, divano e TV nel soggiorno, tavolo nella zona giorno, wc in ogni bagno
    const stanze = window.__pianta ? window.__pianta.stanze : [];
    const mancano = [];
    const tipoDi = id => /^bagno|^wc/.test(id) ? 'bagno' : /^(matrimonial|padronal|camera|cameretta)/.test(id) ? 'camera' : /^(soggiorno|salotto|living|giorno)/.test(id) ? 'soggiorno' : /^cucina/.test(id) ? 'cucina' : '';
    const ha = (id, t) => (tipi[id] || []).includes(t);
    const ids = [...new Set(Object.keys(tipi).concat(stanze.map(s => s.id)))];
    for (const id of ids) {
      const ti = tipoDi(id);
      if (ti === 'camera' && !ha(id, 'letto')) mancano.push(id + ': letto');
      if (ti === 'soggiorno' && !(ha(id, 'divano') && ha(id, 'mobileTV'))) mancano.push(id + ': divano o TV');
      if (ti === 'bagno' && !ha(id, 'wc')) mancano.push(id + ': wc');
    }
    if (!ids.some(id => ['soggiorno', 'cucina'].includes(tipoDi(id)) && (ha(id, 'tavolo') || ha(id, 'isola')))) mancano.push('zona giorno: tavolo');
    return { mobili: a ? a.arredo.length : -1, perStanza, tipi, mancano };
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
  console.log(`${pagina} | arredo ${c.arredo.length} | camera ${c.camera.length} | mobili ${info.mobili} | mancano ${info.mancano.length ? info.mancano.join(', ') : 'niente'} | errori ${errori.length}`);
  process.exit(0);
})().catch(e => { console.log('ERRORE', e.message); process.exit(3); });
