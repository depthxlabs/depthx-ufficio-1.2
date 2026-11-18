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
// Le skill del personale dell'Ufficio 4.5 Risorse Umane (sola lettura, per la pagina del riepilogo dei dipendenti)
const CARTELLA_SKILL_RISORSE_UMANE = 'C:\\Users\\Administrator\\.claude\\skills\\_02_Business\\_01_ClaudeInDepthXLabs\\_02_LineeAziendali\\_04_Linea4_Amministrazione\\_05_Ufficio_4.5_RisorseUmane';

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
// Cache "subito e poi aggiorna": se il dato c'è lo dà all'istante, e se è vecchio lo rilegge dietro le quinte.
const inCorso = {};
const conCache = async (chiave, ms, fare) => {
  const c = cache[chiave];
  if (c && Date.now() - c.quando < ms) return c.dati;
  if (!inCorso[chiave]) inCorso[chiave] = fare().then(dati => { cache[chiave] = { quando: Date.now(), dati }; return dati; }).finally(() => delete inCorso[chiave]);
  return c ? c.dati : inCorso[chiave];
};
// Capacità di ogni ricercatore, letta dai programmi su disco: parole di Maps (Google dà al massimo 60 risultati per ricerca) e ricerche Brave
function capacitaDaiProgrammi() {
  const cartella = path.join(__dirname, '_01_Ricerca', '_01_Adrian_DirettoreAreaRicerca');
  const leggi = f => { try { return fs.readFileSync(path.join(cartella, f), 'utf8'); } catch { return ''; } };
  const out = {};
  for (const m of leggi('_01_MotoreDellaRicercaSuMaps.py').matchAll(/"(\w+)":\s*\{"ruolo"[^}]*?"parole":\s*\[([^\]]*)\]/g))
    out[m[1]] = { ...(out[m[1]] || {}), paroleMaps: (m[2].match(/"/g) || []).length / 2 };
  for (const m of leggi('_03_MotoreDellaRicercaSuBrave.py').matchAll(/"(\w+)":\s*\{"ruolo"[\s\S]*?"ricerche":\s*\[([\s\S]*?)\],/g))
    out[m[1]] = { ...(out[m[1]] || {}), ricercheBrave: (m[2].match(/\{citta\}/g) || []).length };
  return out;
}
// minuti di GitHub del mese: somma della durata di ogni lavoro, arrotondata al minuto come fa GitHub
const { execFile } = require('child_process');
// API pubblica di GitHub (il server gira come utente di sistema e non vede l'accesso di gh): il repository è pubblico
const apiGitHub = url => richiesta('https://api.github.com/' + url, { headers: { 'User-Agent': 'DepthX-CentroGestione', Accept: 'application/vnd.github+json' } }).then(r => r.codice === 200 ? JSON.parse(r.testo) : {});
async function minutiGitHub() {
  const inizio = new Date(); inizio.setDate(1); const dal = inizio.toISOString().slice(0, 10);
  const giri = ((await apiGitHub(`repos/depthxlabs/depthx-ufficio-1.2/actions/runs?per_page=100&created=%3E%3D${dal}`)).workflow_runs || []).map(r => r.id);
  let minuti = 0;
  for (const id of giri) {
    for (const j of (await apiGitHub(`repos/depthxlabs/depthx-ufficio-1.2/actions/runs/${id}/jobs`)).jobs || [])
      if (j.started_at && j.completed_at) minuti += Math.ceil((new Date(j.completed_at) - new Date(j.started_at)) / 60000);
  }
  return { minuti, giri: giri.length, gratis: 'illimitati (repository pubblico)' };
}

let cacheChiLavora = { quando: 0, dati: {} };
const cacheStato = {};

// i dati del pannello di Adrian: obiettivi, assegnazioni, ricercatori, zone, quote
const caricaAdrian = async () => {
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
};

require('../../../_07_BaseCondivisaDaTuttiIServer/_02_MotoreCheAvviaOgniServerConLogEControlloAcceso').avviaServer('Ufficio12Planimetrie', {
  // GET /ChiStaLavorando?fogli=id1,id2,...  ->  { id: { inCorso, attivita, zona, scritte, quota, ... } } per i puntini, il conteggio e i capi area
  'GET /ChiStaLavorando': async ({ indirizzo }) => {
    // legge sempre tutti i fogli della Ricerca (la risposta vale per chiunque la chieda): subito dalla cache, aggiornata dietro le quinte
    return conCache('chi', 30000, async () => {
      const dati = {};
      for (const f of Object.values(FOGLI_RICERCA)) {
        try {
          const s = await leggiStato(f);
          dati[f] = s.esiste ? { inCorso: !!s.inCorso, attivita: s.attivita || '', zona: s.zona || '', scritte: s.scritte || 0, quota: s.quota || 0,
                                 aggiornato: s.aggiornato || '', fine: s.fine || '', esito: s.esito || '' } : { inCorso: false, mai: true };
        } catch { dati[f] = { inCorso: false, errore: true }; }
      }
      return dati;
    });
  },
  // GET /Adrian  ->  obiettivi, calendario di lavoro (assegnazioni) e quote dei servizi
  'GET /Adrian': async () => conCache('adrian', 4 * 60000, caricaAdrian),
  // GET /Mike  ->  il Download: lavoro passato da Adrian, contatti scaricati, stato dal vivo di ogni membro della squadra
  'GET /Mike': async () => conCache('mike', 60000, async () => {
    const passaggi = (await leggiIntervallo(ZONE_E_QUOTE, 'PassaggiAlDownload!A2:K2000')).filter(x => x[0]).reverse();
    const download = (await leggiIntervallo(ZONE_E_QUOTE, 'Download!A2:J5000')).filter(x => x[0]).reverse();
    const statoRighe = await leggiIntervallo(ZONE_E_QUOTE, 'StatoDownload!A2:H20');
    const squadra = statoRighe.filter(x => x[0]).map(x => { let reg = []; try { reg = JSON.parse(x[7] || '[]'); } catch {} return { nome: x[0], alLavoro: x[1] === 'sì', attivita: x[2] || '', aggiornato: x[3] || '', fatti: +x[4] || 0, daFare: +x[5] || 0, fineStimata: x[6] || '', registro: reg }; });
    return { passaggi, download, squadra, drive: 'https://drive.google.com/drive/folders/1z2No_Q1avXQBqC0eoP7K6juGUjW6Iqpd' };
  }),
  // GET /Capacita  ->  quanto può dare ogni ricercatore: limiti degli strumenti e resa reale dei giri già fatti
  'GET /Capacita': async () => conCache('capacita', 5 * 60000, async () => {
    const a = await conCache('adrian', 4 * 60000, caricaAdrian);
    const tutte = await leggiIntervallo(ZONE_E_QUOTE, 'Assegnazioni!A2:I5000');
    const prog = capacitaDaiProgrammi();
    const quote = Object.fromEntries((a.ricercatori || []).map(r => [r[0], { attivo: (r[1] || '').toLowerCase() === 'sì', quota: +r[2] || 0 }]));
    const ricercatori = {};
    for (const nome of Object.keys(FOGLI_RICERCA)) {
      const giri = tutte.filter(x => x[1] === nome && /^fatto: \d+ righe/.test(x[6] || '')).map(x => +x[6].match(/\d+/)[0]);
      const brave = tutte.filter(x => x[1] === nome).map(x => (x[6] || '').match(/(\d+) ricerche Brave/)).filter(Boolean).map(m => +m[1]);
      ricercatori[nome] = { ...(prog[nome] || {}), ...(quote[nome] || { attivo: false, quota: 0 }),
        giriMisurati: giri.length, mediaPerGiro: giri.length ? Math.round(giri.reduce((s, x) => s + x, 0) / giri.length * 10) / 10 : null,
        ricercheBravePerGiro: brave.length ? Math.round(brave.reduce((s, x) => s + x, 0) / brave.length) : null };
    }
    const zoneAttive = (a.zone || []).filter(z => (z[3] || '').toLowerCase() === 'sì').length;
    return { ricercatori, zoneAttive, braveRimaste: a.quote && a.quote.brave ? +a.quote.brave.valore || null : null, cicloOre: 3, risultatiMassimiPerRicercaMaps: 60, insiemeAlMassimo: 6 };
  }),
  // POST /Obiettivo { obiettivo, ricercatori, quanti, entro, zone }  ->  nuova riga attiva nella scheda Obiettivi
  'POST /Obiettivo': async ({ datiInviati: d }) => {
    const quanti = parseInt(d.quanti, 10);
    if (!(quanti > 0)) return { ok: false, errore: 'Serve il numero di contatti.' };
    // codice automatico: OB-001, OB-002, ...
    const esistenti = await leggiIntervallo(ZONE_E_QUOTE, 'Obiettivi!A2:A100');
    const ultimo = Math.max(0, ...esistenti.map(x => +((x[0] || '').match(/^OB-(\d+)/) || [0, 0])[1]));
    d.obiettivo = 'OB-' + String(ultimo + 1).padStart(3, '0');
    const riga = [[String(d.obiettivo).slice(0, 120), String(d.ricercatori || 'tutti').slice(0, 300), quanti, new Date().toISOString().slice(0, 10),
                   String(d.entro || ''), String(d.zone || '').slice(0, 300), 0, 'attivo']];
    const r = await richiesta(`https://sheets.googleapis.com/v4/spreadsheets/${ZONE_E_QUOTE}/values/Obiettivi!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      { method: 'POST', headers: { Authorization: 'Bearer ' + await gettoneGoogle(true), 'Content-Type': 'application/json' } }, JSON.stringify({ values: riga }));
    delete cache.adrian;
    return r.codice === 200 ? { ok: true } : { ok: false, errore: 'Scrittura non riuscita (' + r.codice + ')' };
  },
  // GET /CRM  ->  tutte le righe dei fogli della Ricerca (si rilegge al massimo ogni 5 minuti)
  'GET /CRM': async () => conCache('crm', 4 * 60000, async () => {
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
    if (!/^_\d{2}_[A-Za-z0-9]+\/_\d{2}_[A-Za-z0-9]+_[A-Za-z0-9]+$/.test(cartella)) return { esiste: false };
    const dove = path.join(CARTELLA_SKILL, ...cartella.split('/'));
    if (!fs.existsSync(dove)) return { esiste: false };
    const file = fs.readdirSync(dove).filter(n => n.endsWith('.md')).sort();
    return { esiste: true, file: file.map(n => ({ nome: n, testo: fs.readFileSync(path.join(dove, n), 'utf8') })) };
  },
  // GET /RisorseUmane  ->  tutte le assegnazioni (non solo le ultime 80) e i ricercatori, per il riepilogo dell'Ufficio 4.5 Risorse Umane (sola lettura)
  'GET /RisorseUmane': async () => conCache('risorseumane', 60000, async () => ({
    assegnazioni: await leggiIntervallo(ZONE_E_QUOTE, 'Assegnazioni!A2:I5000'),
    ricercatori: await leggiIntervallo(ZONE_E_QUOTE, 'Ricercatori!A2:E50'),
  })),
  // GET /SkillRisorseUmane?cartella=_01_Direzione/_01_Harper_DirettriceRisorseUmane  ->  le skill del personale dell'Ufficio 4.5 (sola lettura)
  'GET /SkillRisorseUmane': async ({ indirizzo }) => {
    const cartella = indirizzo.searchParams.get('cartella') || '';
    if (!/^_\d{2}_[A-Za-z0-9]+\/_\d{2}_[A-Za-z0-9]+_[A-Za-z0-9]+$/.test(cartella)) return { esiste: false };
    const dove = path.join(CARTELLA_SKILL_RISORSE_UMANE, ...cartella.split('/'));
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

// Precaricamento: appena acceso e poi ogni 4 minuti rilegge pannello di Adrian e CRM, così le pagine si aprono all'istante
const precarica = async () => { for (const [k, f] of [['adrian', '/Adrian'], ['crm', '/CRM'], ['mike', '/Mike'], ['chi', '/ChiStaLavorando'], ['capacita', '/Capacita']]) { try { await new Promise(ok => require('http').get(`http://127.0.0.1:8828${f}`, r => { r.resume(); r.on('end', ok); }).on('error', ok)); } catch {} } };
setTimeout(precarica, 3000); setInterval(precarica, 4 * 60000);
setInterval(() => { require('http').get('http://127.0.0.1:8828/ChiStaLavorando', r => r.resume()).on('error', () => {}); }, 30000);
