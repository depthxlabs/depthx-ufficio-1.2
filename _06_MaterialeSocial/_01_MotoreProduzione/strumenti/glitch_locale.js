// DepthX Linea 1.2: controllo anti tremolio in locale, solo negli istanti indicati.
// node glitch_locale.js <radice> '[[pagina, [t1,t2], modo], ...]'
const { apri } = require('./registra.js');
(async () => { for (const [pag, tempi, modo] of JSON.parse(process.argv[3])) { const { p, chiudi } = await apri(process.argv[2], pag, modo);
  const r = await p.evaluate(tt => window.__glitch(tt), tempi); console.log(pag, JSON.stringify(r)); await chiudi(); } process.exit(0); })();
