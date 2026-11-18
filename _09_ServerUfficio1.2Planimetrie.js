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
const gettoni = {};

const richiesta = (url, opzioni = {}, corpo) => new Promise((ok, ko) => {
  const r = https.request(url, opzioni, res => { let t = ''; res.on('data', p => (t += p)); res.on('end', () => ok({ codice: res.statusCode, testo: t })); });
  r.on('error', ko); if (corpo) r.write(corpo); r.end();
});

// lettura per tutto; scrittura solo per gli obiettivi che Michele mette dal pannello di Adrian
async function gettoneGoogle(scrittura = false) {
  const scope = 'https://www.googleapis.com/auth/spreadsheets' + (scrittura ? '' : '.readonly');
  const gettone = gettoni[scope] || {};
  if (gettone.valore && Date.now() < gettone.scade) return gettone.valore;
  const k = JSON.parse(fs.readFileSync(CHIAVE, 'utf8')), ora = Math.floor(Date.now() / 1000);
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const testa = b64({ alg: 'RS256', typ: 'JWT' });
  const dati = b64({ iss: k.client_email, scope, aud: 'https://oauth2.googleapis.com/token', iat: ora, exp: ora + 3600 });
  const firma = crypto.createSign('RSA-SHA256').update(testa + '.' + dati).sign(k.private_key, 'base64url');
  const corpo = 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + testa + '.' + dati + '.' + firma;
  const r = await richiesta('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, corpo);
  const j = JSON.parse(r.testo); if (!j.access_token) throw new Error('Accesso a Google Sheet non riuscito');
  gettoni[scope] = { valore: j.access_token, scade: Date.now() + 50 * 60 * 1000 };
  return j.access_token;
}

// Le skill dei dipendenti: cartella dell'ufficio 1.2 nelle skill DepthX (sola lettura)
const CARTELLA_SKILL = 'C:\\Users\\Administrator\\.claude\\skills\\_02_Business\\_01_ClaudeInDepthXLabs\\_02_LineeAziendali\\_01_Linea1_ProductionDepartement\\_02_Linea_1.2_TOURPLANIMETRIA3D\\_02_Ufficio_1.2_Planimetrie';

async function leggiStato(foglio) {
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
}
// Google Sheet gratuito: 60 letture al minuto per l'account di servizio, condivise con i dipendenti.
// Il Centro Gestione ne usa al massimo circa 30: chi lavora ogni 30 secondi, la scheda aperta ogni 6 secondi.
// ---- Pannello di Adrian: obiettivi, calendario di lavoro, CRM, quote dei servizi ----
const ZONE_E_QUOTE = '1Sr9qOixgP9_snFesfBHcBoVSBxW8YKCAIJvPLHmGRIA';
const FOGLI_RICERCA = { Anna: '11Xfyu2Q3laVgP5pzw003xML0ZUur_4bq-lac9cb3T-E', Max: '12FYuOBjRHmsMpAw7zQ6xkqBPBNFzjATExikSSiskM08',
  Brian: '1oLoNTwnXOpvMdt2OsgD7R_eIxZOiiTo8iyk9dYPVlyA', Nora: '1INosFpaC02tQIKCvgZBUkTWaCceWz7HVa9Ce0ELivSQ',
  Liam: '1NsTzPQL3q60XnrZTV_DfKqvI56VVFAeJ4wK0ovPBVt0', Kera: '1mnTcNUB9ZG0h12b9tWinbGDKYted-22hxVDB-_qeYwY',
  Ester: '1gV9wtsHOLLpT65YQy85dhO1vcYj3HilvLmFn4ISrsAo', Mark: '1k6ITm11B3cqDor36ZuV_9eFstFSZc3AiT_GVWNp7pi0',
  Elen: '13a46HtzCDMseN8WXiO9JsLx66ADDVUZE71_vHQ-5lFw', Leo: '1RCLlxhoPB2eMDOiY8DeVdGaHXIRVHT8MooE-5RqxiSg',
  Tom: '1-TSOMAI41Km1Y5JH55Kr-W0P3r3bfHCnc80RuKMBspQ', Sam: '1HpITMZXbXpEdVjUhiShQpH-TARhIjORwzEL2Ie9l1gE',
  Mia: '1ZduNopPwanAVeuAFMZa12AghAkMyA351-Fswn5-ttyU' };
const leggiIntervallo = async (foglio, intervallo) => {
  const r = await richiesta(`https://sheets.googleapis.com/v4/spreadsheets/${foglio}/values/${encodeURIComponent(intervallo)}`, { headers: { Authorization: 'Bearer ' + await gettoneGoogle() } });
  if (r.codice !== 200) throw new Error('Foglio non leggibile (' + r.codice + ')');
  return JSON.parse(r.testo).values || [];
};
const pausa = ms => new Promise(ok => setTimeout(ok, ms));
const cache = {};
const conCache = async (chiave, ms, fare) => {
  if (cache[chiave] && Date.now() - cache[chiave].quando < ms) return cache[chiave].dati;
  const dati = await fare(); cache[chiave] = { quando: Date.now(), dati }; return dati;
};
// minuti di GitHub del mese: somma della durata di ogni lavoro, arrotondata al minuto come fa GitHub
const { execFile } = require('child_process');
const gh = args => new Promise(ok => execFile('C:\\Program Files\\GitHub CLI\\gh.exe', args, { maxBuffer: 20e6 }, (e, out) => ok(e ? '' : out)));
async function minutiGitHub() {
  const inizio = new Date(); inizio.setDate(1); const dal = inizio.toISOString().slice(0, 10);
  const giri = (await gh(['api', `repos/depthxlabs/depthx-ufficio-1.2/actions/runs?per_page=100&created=%3E%3D${dal}`, '--jq', '.workflow_runs[].id'])).split('\n').filter(Boolean);
  let minuti = 0;
  for (const id of giri) {
    const righe = (await gh(['api', `repos/depthxlabs/depthx-ufficio-1.2/actions/runs/${id}/jobs`, '--jq', '.jobs[]|[.started_at,.completed_at]|@tsv'])).split('\n').filter(Boolean);
    for (const r of righe) { const [a, b] = r.split('\t'); if (a && b) minuti += Math.ceil((new Date(b) - new Date(a)) / 60000); }
  }
  return { minuti, giri: giri.length, gratis: 2000 };
}

let cacheChiLavora = { quando: 0, dati: {} };
const cacheStato = {};

require('../../../_07_BaseCondivisaDaTuttiIServer/_02_MotoreCheAvviaOgniServerConLogEControlloAcceso').avviaServer('Ufficio12Planimetrie', {
  // GET /ChiStaLavorando?fogli=id1,id2,...  ->  { id: { inCorso, attivita, zona, scritte, quota, ... } } per i puntini, il conteggio e i capi area
  'GET /ChiStaLavorando': async ({ indirizzo }) => {
    const fogli = (indirizzo.searchParams.get('fogli') || '').split(',').filter(f => /^[A-Za-z0-9_-]{20,}$/.test(f)).slice(0, 60);
    if (Date.now() - cacheChiLavora.quando > 30000) {
      const dati = {};
      for (const f of fogli) {
        try {
          const s = await leggiStato(f);
          dati[f] = s.esiste ? { inCorso: !!s.inCorso, attivita: s.attivita || '', zona: s.zona || '', scritte: s.scritte || 0, quota: s.quota || 0,
                                 aggiornato: s.aggiornato || '', fine: s.fine || '', esito: s.esito || '' } : { inCorso: false, mai: true };
        } catch { dati[f] = { inCorso: false, errore: true }; }
      }
      cacheChiLavora = { quando: Date.now(), dati };
    }
    return cacheChiLavora.dati;
  },
  // GET /Adrian  ->  obiettivi, calendario di lavoro (assegnazioni) e quote dei servizi
  'GET /Adrian': async () => conCache('adrian', 60000, async () => {
    const obiettivi = await leggiIntervallo(ZONE_E_QUOTE, 'Obiettivi!A2:H100');
    const assegnazioni = (await leggiIntervallo(ZONE_E_QUOTE, 'Assegnazioni!A2:I2000')).slice(-80).reverse();
    const ricercatori = await leggiIntervallo(ZONE_E_QUOTE, 'Ricercatori!A2:E50');
    const zone = await leggiIntervallo(ZONE_E_QUOTE, 'Zone!A2:E200');
    let braveRimaste = '';
    for (const n of ['Max', 'Sam', 'Mia', 'Brian', 'Nora']) {
      const s = await leggiStato(FOGLI_RICERCA[n]);
      if (s.esiste && s.braveRimasteMese && (!braveRimaste.quando || s.aggiornato > braveRimaste.quando)) braveRimaste = { valore: s.braveRimasteMese, quando: s.aggiornato };
    }
    const github = await conCache('github', 30 * 60000, minutiGitHub);
    return { obiettivi, assegnazioni, ricercatori, zone, quote: { brave: braveRimaste, github },
             foglio: `https://docs.google.com/spreadsheets/d/${ZONE_E_QUOTE}/edit` };
  }),
  // POST /Obiettivo { obiettivo, ricercatori, quanti, entro, zone }  ->  nuova riga attiva nella scheda Obiettivi
  'POST /Obiettivo': async ({ datiInviati: d }) => {
    const quanti = parseInt(d.quanti, 10);
    if (!d.obiettivo || !(quanti > 0)) return { ok: false, errore: "Servono il nome dell'obiettivo e il numero di contatti." };
    const riga = [[String(d.obiettivo).slice(0, 120), String(d.ricercatori || 'tutti').slice(0, 300), quanti, new Date().toISOString().slice(0, 10),
                   String(d.entro || ''), String(d.zone || '').slice(0, 300), 0, 'attivo']];
    const r = await richiesta(`https://sheets.googleapis.com/v4/spreadsheets/${ZONE_E_QUOTE}/values/Obiettivi!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      { method: 'POST', headers: { Authorization: 'Bearer ' + await gettoneGoogle(true), 'Content-Type': 'application/json' } }, JSON.stringify({ values: riga }));
    delete cache.adrian;
    return r.codice === 200 ? { ok: true } : { ok: false, errore: 'Scrittura non riuscita (' + r.codice + ')' };
  },
  // GET /CRM  ->  tutte le righe dei fogli della Ricerca (si rilegge al massimo ogni 5 minuti)
  'GET /CRM': async () => conCache('crm', 5 * 60000, async () => {
    const righe = [];
    for (const [nome, foglio] of Object.entries(FOGLI_RICERCA)) {
      try { for (const x of await leggiIntervallo(foglio, 'Contatti!A2:Q5000')) if (x[0]) righe.push([x[0], x[1], x[2] || nome, x[3], x[4], x[5], x[8] || '', x[12] || x[7] || '', x[15] || '']); }
      catch {}
      await pausa(1100);
    }
    return { colonne: ['ID', 'Data', 'Ricercatore', 'Tipo', 'Nome', 'Città', 'Email', 'Link', 'Stato'], righe };
  }),
  // GET /Skill?cartella=_01_Ricerca/_02_Anna_AgenzieDaMaps  ->  il testo delle skill del dipendente, file per file in ordine
  'GET /Skill': async ({ indirizzo }) => {
    const cartella = indirizzo.searchParams.get('cartella') || '';
    if (!/^_\d{2}_[A-Za-z]+\/_\d{2}_[A-Za-z0-9]+_[A-Za-z0-9]+$/.test(cartella)) return { esiste: false };
    const dove = path.join(CARTELLA_SKILL, ...cartella.split('/'));
    if (!fs.existsSync(dove)) return { esiste: false };
    const file = fs.readdirSync(dove).filter(n => n.endsWith('.md')).sort();
    return { esiste: true, file: file.map(n => ({ nome: n, testo: fs.readFileSync(path.join(dove, n), 'utf8') })) };
  },
  // GET /StatoDipendente?foglio=<id del foglio Google del dipendente>  ->  il contenuto della sua scheda "Stato"
  'GET /StatoDipendente': async ({ indirizzo }) => {
    const foglio = indirizzo.searchParams.get('foglio') || '';
    if (!/^[A-Za-z0-9_-]{20,}$/.test(foglio)) return { esiste: false, errore: 'Foglio non valido' };
    if (cacheStato[foglio] && Date.now() - cacheStato[foglio].quando < 6000) return cacheStato[foglio].dati;
    const dati = await leggiStato(foglio);
    cacheStato[foglio] = { quando: Date.now(), dati };
    return dati;
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
