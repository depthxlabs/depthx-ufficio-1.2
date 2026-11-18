const { apri } = require('./registra.js');
(async () => { const [, , R, pag, modo, ...tt] = process.argv; const { p, chiudi } = await apri(R, pag, modo);
  const r = await p.evaluate(ts => ts.map(t => { const c = window.__cam(+t); return [t, ...c.map(v => +v.toFixed(2))]; }), tt); console.log(JSON.stringify(r)); await chiudi(); process.exit(0); })();
