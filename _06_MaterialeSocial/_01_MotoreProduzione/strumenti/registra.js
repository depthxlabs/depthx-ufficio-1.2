// DepthX Linea 1.2: registratore fotogramma per fotogramma con tempo fisso (1/60 s), JPEG su disco, ripresa automatica.
// node registra.js <radice del server> <pagina relativa con parametri> <cartella fotogrammi> <orizzontale|verticale> [primo] [ultimo]
// Con primo e ultimo registra solo quei fotogrammi (piu' processi in parallelo sullo stesso video).
// Variabili: CHROME (percorso di Chrome), FLAG_CHROME (flag separati da spazio). Senza FLAG_CHROME: SwiftShader su Windows, scheda grafica su Linux.
const puppeteer = require(__dirname + '/node_modules/puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path'), { exec } = require('child_process');
const tipi = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.hdr': 'application/octet-stream', '.json': 'application/json' };
const server = dir => new Promise(r => { const s = http.createServer((q, a) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(dir, p); fs.readFile(f, (e, d) => { if (e) { a.writeHead(404); a.end(); return; } a.writeHead(200, { 'Content-Type': tipi[path.extname(f)] || 'application/octet-stream' }); a.end(d); }); }).listen(0, '127.0.0.1', () => r(s)); });
const entro = (pr, ms, cosa) => Promise.race([pr, new Promise((_, no) => setTimeout(() => no(new Error('tempo scaduto: ' + cosa)), ms))]);
const ora = () => new Date().toTimeString().slice(0, 8);
const FPS = 60;
module.exports = { server, entro, ora, apri };
async function apri(radice, pagina, vert) {
  const modo = vert === true ? 'verticale' : vert === false || vert === undefined ? 'orizzontale' : vert;
  const s = await server(radice), base = `http://127.0.0.1:${s.address().port}/`;
  const win = process.platform === 'win32';
  const flag = process.env.FLAG_CHROME ? process.env.FLAG_CHROME.split(' ').filter(Boolean) : win ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=vulkan', '--enable-features=Vulkan', '--disable-vulkan-surface', '--enable-gpu'];
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || (win ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome'), headless: 'new', timeout: 180000, protocolTimeout: 600000, args: [...flag, '--ignore-gpu-blocklist', '--hide-scrollbars', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--no-sandbox', '--disable-dev-shm-usage'] });
  if (win) {
  const abbassa = () => exec(`powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter 'ParentProcessId=${b.process().pid}' | ForEach-Object { try { (Get-Process -Id $_.ProcessId).PriorityClass = 'BelowNormal' } catch {} }"`, () => { });
  abbassa(); setTimeout(abbassa, 4000); setInterval(abbassa, 30000).unref();
  }
  const p = await b.newPage();
  await p.setViewport(modo === 'post' ? { width: 540, height: 675, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : modo === 'verticale' ? { width: 540, height: 960, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1920, height: 1080, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.log('ERRORE pagina', e.message));
  p.on('console', m => { if (m.type() === 'error') console.log('console', m.text()); });
  await p.goto(base + pagina, { waitUntil: 'domcontentloaded', timeout: 300000 });
  let errPag = null; p.on('pageerror', e => { errPag = e.message; });
  await p.waitForFunction(() => window.__ready === true, { timeout: 180000, polling: 500 }).catch(e => { throw new Error(errPag ? 'pagina: ' + errPag : e.message); });
  const gpu = await p.evaluate(() => { const c = document.createElement('canvas').getContext('webgl2'); const e = c && c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'sconosciuta'; });
  console.log(ora(), 'scheda grafica:', gpu);
  const chiudi = async () => { try { await b.close(); } catch (e) { try { b.process().kill(); } catch (e2) { } } s.close(); };
  return { p, b, chiudi };
}
if (require.main === module) (async () => {
  const [, , radice, pagina, dirF, modo, da, a] = process.argv;
  fs.mkdirSync(dirF, { recursive: true });
  const fatti = new Set(fs.readdirSync(dirF).filter(f => f.endsWith('.jpg') && fs.statSync(path.join(dirF, f)).size > 5000));
  let ch = null;
  try {
    const { p, chiudi } = await apri(radice, pagina, modo); ch = chiudi;
    const lung = await p.evaluate(() => window.__lung); const NT = Math.round(lung * FPS) + 1; const n0 = da !== undefined ? +da : 0, N = a !== undefined ? Math.min(NT, +a + 1) : NT;
    console.log(ora(), 'durata', lung, 's, fotogrammi', N, 'gia fatti', fatti.size);
    let t0 = Date.now(), nuovi = 0, saltato = true;
    for (let n = n0; n < N; n++) {
      const nome = String(n).padStart(5, '0') + '.jpg';
      if (fatti.has(nome)) { saltato = true; continue; }
      await entro(p.evaluate(([t, forza]) => { if (forza) window.__vai(t); else { window.__adv(1 / 60); window.__frame(); } }, [n / FPS, saltato]), 180000, 'evaluate');
      saltato = false;
      await entro(p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))), 120000, 'rAF');
      const img = await entro(p.screenshot({ type: 'jpeg', quality: 95, optimizeForSpeed: true }), 180000, 'screenshot');
      fs.writeFileSync(path.join(dirF, nome), img); nuovi++;
      if (nuovi % 60 === 0) console.log(ora(), 'fotogramma', n, 'di', N, ((Date.now() - t0) / nuovi / 1000).toFixed(2), 's/fotogramma');
    }
    fs.writeFileSync(path.join(dirF, da !== undefined ? `PARTE_${n0}_${N - 1}.txt` : 'COMPLETO.txt'), String(NT));
    console.log(ora(), 'ok', N, 'fotogrammi');
    await chiudi(); process.exit(0);
  } catch (e) { console.log(ora(), 'ERRORE', e.message); if (ch) await ch(); process.exit(3); }
})();
