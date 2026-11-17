// SERVERUFFICIO1.2PLANIMETRIE
// Cosa fa:           Dà alla pagina dell'ufficio 1.2 lo stato dal vivo di ogni dipendente.
//                    I dipendenti lavorano su GitHub Actions e scrivono il loro stato nella scheda "Stato"
//                    del proprio foglio Google: questo server la legge con l'account di servizio DepthX.
// Porta:             8828
// Dati che usa:      la chiave Google Sheet in _01_ChiaviAccessiServiziTerzeParti\_02_Google (mai stampata)
// Chi lo chiama:     la scheda del dipendente nella stanza dell'ufficio 1.2 (indirizzo /Server/Ufficio12Planimetrie/...)

'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), https = require('https');
const CHIAVE = path.resolve(__dirname, '../../../_01_ChiaviAccessiServiziTerzeParti/_02_Google/_02_ChiaveGoogleSheet.json');
let gettone = { valore: '', scade: 0 };

const richiesta = (url, opzioni = {}, corpo) => new Promise((ok, ko) => {
  const r = https.request(url, opzioni, res => { let t = ''; res.on('data', p => (t += p)); res.on('end', () => ok({ codice: res.statusCode, testo: t })); });
  r.on('error', ko); if (corpo) r.write(corpo); r.end();
});

async function gettoneGoogle() {
  if (gettone.valore && Date.now() < gettone.scade) return gettone.valore;
  const k = JSON.parse(fs.readFileSync(CHIAVE, 'utf8')), ora = Math.floor(Date.now() / 1000);
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const testa = b64({ alg: 'RS256', typ: 'JWT' });
  const dati = b64({ iss: k.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets.readonly', aud: 'https://oauth2.googleapis.com/token', iat: ora, exp: ora + 3600 });
  const firma = crypto.createSign('RSA-SHA256').update(testa + '.' + dati).sign(k.private_key, 'base64url');
  const corpo = 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + testa + '.' + dati + '.' + firma;
  const r = await richiesta('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, corpo);
  const j = JSON.parse(r.testo); if (!j.access_token) throw new Error('Accesso a Google Sheet non riuscito');
  gettone = { valore: j.access_token, scade: Date.now() + 50 * 60 * 1000 };
  return gettone.valore;
}

require('../../../_07_BaseCondivisaDaTuttiIServer/_02_MotoreCheAvviaOgniServerConLogEControlloAcceso').avviaServer('Ufficio12Planimetrie', {
  // GET /StatoDipendente?foglio=<id del foglio Google del dipendente>  ->  il contenuto della sua scheda "Stato"
  'GET /StatoDipendente': async ({ indirizzo }) => {
    const foglio = indirizzo.searchParams.get('foglio') || '';
    if (!/^[A-Za-z0-9_-]{20,}$/.test(foglio)) return { esiste: false, errore: 'Foglio non valido' };
    const r = await richiesta(`https://sheets.googleapis.com/v4/spreadsheets/${foglio}/values/Stato!A2:B50`, { headers: { Authorization: 'Bearer ' + await gettoneGoogle() } });
    if (r.codice !== 200) return { esiste: false, errore: 'Scheda Stato non leggibile (' + r.codice + ')' };
    const righe = (JSON.parse(r.testo).values || []).filter(x => x[0]);
    if (!righe.length) return { esiste: false };
    const stato = { esiste: true };
    for (const [chiave, valore = ''] of righe) {
      try { stato[chiave] = /^[\[{]/.test(valore) ? JSON.parse(valore) : valore === 'True' ? true : valore === 'False' ? false : /^\d+$/.test(valore) ? Number(valore) : valore; }
      catch { stato[chiave] = valore; }
    }
    return stato;
  },
});
