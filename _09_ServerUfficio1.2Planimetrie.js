// SERVERUFFICIO1.2PLANIMETRIE
// Cosa fa:           Dà alla pagina dell'ufficio 1.2 lo stato dal vivo di ogni dipendente.
//                    I dipendenti lavorano su GitHub Actions e scrivono i dati nel repository privato depthx-dati-1.2:
//                    ogni minuto questo server li legge da GitHub e li scrive nei CSV sul disco, nelle cartelle dei programmi.
// Porta:             8828
// Dati che usa:      il token GitHub in _01_ChiaviAccessiServiziTerzeParti\_10_GitHub (mai stampato)
// Chi lo chiama:     la scheda del dipendente nella stanza dell'ufficio 1.2 (indirizzo /Server/Ufficio12Planimetrie/...)

'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), https = require('https');
const richiesta = (url, opzioni = {}, corpo) => new Promise((ok, ko) => {
  const r = https.request(url, opzioni, res => { let t = ''; res.on('data', p => (t += p)); res.on('end', () => ok({ codice: res.statusCode, testo: t })); });
  r.on('error', ko); if (corpo) r.write(corpo); r.end();
});

// Le skill dei dipendenti: cartella dell'ufficio 1.2 nelle skill DepthX (sola lettura)
const CARTELLA_SKILL = 'C:/_01_DepthX/_01_Linea1_ProductionDepartement/_02_Linea_1.2_PLANIMETRIE_3D';
// Le skill del personale dell'Ufficio 4.5 Risorse Umane (sola lettura, per la pagina del riepilogo dei dipendenti)
const CARTELLA_SKILL_RISORSE_UMANE = 'C:\\Users\\Administrator\\.claude\\skills\\_02_Business\\_01_ClaudeInDepthXLabs\\_02_LineeAziendali\\_04_Linea4_Amministrazione\\_05_Ufficio_4.5_RisorseUmane';

// ---- Dati dell'Outbound: i CSV sul disco, letti da GitHub (repository privato depthx-dati-1.2) ----
// I programmi lavorano su GitHub e scrivono nel repository dei dati; il disco legge da GitHub e scrive i CSV nelle cartelle dei programmi.
const PROGRAMMI_OUTBOUND = 'C:/_01_DepthX/_01_Linea1_ProductionDepartement/_02_Linea_1.2_PLANIMETRIE_3D/_03_OutboundPlanimetrie/_02_Programmi';
const DISCO = { '_01_ListaCRM': PROGRAMMI_OUTBOUND + '/_01_1.2_RicercaPotenzialiNuoviClienti/_02_ListaCRM',
  '_02_MaterialeScaricato': PROGRAMMI_OUTBOUND + '/_02_1.2_DownloadMaterialePotenzialeClienti/_02_MaterialeScaricato',
  '_03_BollePerOgniPlanimetria': PROGRAMMI_OUTBOUND + '/_03_1.2_AreeLetturePlanimetrieScaricate/_02_BollePerOgniPlanimetria' };
const COPIA_GITHUB = 'C:/_02_DepthXSoftware/_04_DatiOutbound1.2DaGitHub';
const NOMI_FOGLI = { '1Sr9qOixgP9_snFesfBHcBoVSBxW8YKCAIJvPLHmGRIA': '_00_ZoneEQuote', '11Xfyu2Q3laVgP5pzw003xML0ZUur_4bq-lac9cb3T-E': '_01_Anna_AgenzieDaMaps',
  '12FYuOBjRHmsMpAw7zQ6xkqBPBNFzjATExikSSiskM08': '_02_Max_AgenzieDagliAnnunciSuiPortali', '1oLoNTwnXOpvMdt2OsgD7R_eIxZOiiTo8iyk9dYPVlyA': '_03_Brian_AgentiImmobiliariSingoli',
  '1INosFpaC02tQIKCvgZBUkTWaCceWz7HVa9Ce0ELivSQ': '_04_Nora_PrivatiSuiPortali', '1NsTzPQL3q60XnrZTV_DfKqvI56VVFAeJ4wK0ovPBVt0': '_05_Liam_CostruttoriEImpreseEdili',
  '1mnTcNUB9ZG0h12b9tWinbGDKYted-22hxVDB-_qeYwY': '_06_Kera_CaseVacanza', '1gV9wtsHOLLpT65YQy85dhO1vcYj3HilvLmFn4ISrsAo': '_07_Ester_AffittiBrevi',
  '1k6ITm11B3cqDor36ZuV_9eFstFSZc3AiT_GVWNp7pi0': '_08_Mark_Architetti', '13a46HtzCDMseN8WXiO9JsLx66ADDVUZE71_vHQ-5lFw': '_09_Elen_StudiDiInterni',
  '1RCLlxhoPB2eMDOiY8DeVdGaHXIRVHT8MooE-5RqxiSg': '_10_Leo_Geometri', '1-TSOMAI41Km1Y5JH55Kr-W0P3r3bfHCnc80RuKMBspQ': '_11_Tom_AsteImmobiliari',
  '1HpITMZXbXpEdVjUhiShQpH-TARhIjORwzEL2Ie9l1gE': '_12_Sam_ProgettiNonAncoraPronti', '1ZduNopPwanAVeuAFMZa12AghAkMyA351-Fswn5-ttyU': '_13_Mia' };
const fileCSV = (foglio, scheda) => { const n = NOMI_FOGLI[foglio]; if (!n) throw new Error('Foglio sconosciuto');
  return n === '_00_ZoneEQuote' ? `_00_ZoneEQuote/${scheda}.csv` : scheda === 'Stato' ? `_00_Stato/${n}.csv` : `${n}.csv`; };
function leggiCSV(testo) {
  const righe = []; let riga = [], campo = '', virgolette = false;
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i];
    if (virgolette) { if (c === '"') { if (testo[i + 1] === '"') { campo += '"'; i++; } else virgolette = false; } else campo += c; }
    else if (c === '"') virgolette = true;
    else if (c === ',') { riga.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && testo[i + 1] === '\n') i++; riga.push(campo); righe.push(riga); riga = []; campo = ''; }
    else campo += c;
  }
  if (campo || riga.length) { riga.push(campo); righe.push(riga); }
  return righe;
}
const scriviCSV = righe => righe.map(r => r.map(v => { v = v == null ? '' : String(v); return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\r\n') + '\r\n';
const leggiDalDisco = rel => { try { return leggiCSV(fs.readFileSync(path.join(DISCO._01_ListaCRM, rel), 'utf8').replace(/^\uFEFF/, '')); } catch { return []; } };
const colonna = l => [...l].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
// lettura di un intervallo come nei fogli Google (Scheda!A2:Q5000), ma dal CSV sul disco
const leggiIntervallo = async (foglio, intervallo) => {
  const [scheda, celle = 'A1'] = intervallo.split('!');
  const a = celle.match(/^([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/);
  const c0 = colonna(a[1]), r0 = (+a[2] || 1) - 1, c1 = a[3] ? colonna(a[3]) : c0, r1 = a[3] ? (a[4] ? +a[4] - 1 : 1e9) : r0;
  const righe = leggiDalDisco(fileCSV(foglio, scheda)).slice(r0, r1 + 1).map(r => { const x = r.slice(c0, c1 + 1); while (x.length && !x[x.length - 1]) x.pop(); return x; });
  while (righe.length && !righe[righe.length - 1].length) righe.pop();
  return righe;
};
const valore = v => { try { return /^[\[{]/.test(v) ? JSON.parse(v) : v === 'True' ? true : v === 'False' ? false : /^\d+$/.test(v) ? Number(v) : v; } catch { return v; } };
// stato dal vivo: i controlli GitHub "Stato <nome>" pubblicati dai programmi mentre lavorano (ogni 90 secondi)
const statoVivo = () => conCache('statoVivo', 30000, async () => {
  const giri = (await apiGitHub(`repos/${REPO_UFFICIO}/actions/runs?status=in_progress&per_page=30`)).workflow_runs || [];
  const out = {};
  for (const sha of [...new Set(giri.map(g => g.head_sha))]) {
    for (const c of (await apiGitHub(`repos/${REPO_UFFICIO}/commits/${sha}/check-runs?per_page=100`)).check_runs || []) {
      if (!/^Stato /.test(c.name) || c.status === 'completed') continue;
      const chi = c.name.slice(6);
      if (out[chi] && out[chi].quando > c.started_at) continue;
      try { out[chi] = { quando: c.started_at, dati: JSON.parse((c.output && c.output.summary) || '{}') }; } catch {}
    }
  }
  return out;
});
async function leggiStato(foglio) {
  const righe = leggiDalDisco(fileCSV(foglio, 'Stato')).slice(1).filter(x => x[0]);
  const stato = { esiste: righe.length > 0 };
  for (const [chiave, v = ''] of righe) stato[chiave] = valore(v);
  const nome = NOMI_FOGLI[foglio].split('_')[2], vivo = (await statoVivo().catch(() => ({})))[nome];
  if (vivo) { stato.esiste = true; for (const k of Object.keys(vivo.dati)) stato[k] = valore(String(vivo.dati[k])); }
  return stato;
}
// il disco legge da GitHub: ogni minuto prende i file nuovi o cambiati del repository dei dati e li scrive nelle cartelle dei programmi
const { execFileSync } = require('child_process');
const accessoGit = () => ['-c', 'safe.directory=*', '-c', 'http.extraHeader=Authorization: Basic ' + Buffer.from('x-access-token:' + fs.readFileSync(TOKEN_GITHUB, 'utf8').trim()).toString('base64')];
const git = (...a) => execFileSync('git', ['-C', COPIA_GITHUB, ...accessoGit(), ...a], { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 }).trim();
let letturaInCorso = false;
function scriviSulDisco(file) {
  for (const rel of file) {
    const [radice, ...resto] = rel.split('/');
    if (!DISCO[radice] || !resto.length) continue;
    const da = path.join(COPIA_GITHUB, rel), a = path.join(DISCO[radice], ...resto);
    if (!fs.existsSync(da)) continue;
    fs.mkdirSync(path.dirname(a), { recursive: true }); fs.copyFileSync(da, a);
  }
}
function leggiDaGitHub() {
  if (letturaInCorso) return;
  letturaInCorso = true;
  try {
    const prima = git('rev-parse', 'HEAD');
    git('fetch', '-q', 'origin', 'main');
    const dopo = git('rev-parse', 'origin/main');
    if (dopo !== prima) {
      const cambiati = git('diff', '--name-only', '--no-renames', '--diff-filter=AM', prima, dopo).split('\n').filter(Boolean);
      git('reset', '-q', '--hard', 'origin/main');
      scriviSulDisco(cambiati);
      for (const k of ['adrian', 'crm', 'mike', 'chi', 'capacita', 'risorseumane']) delete cache[k];
    }
    if (!fs.existsSync(path.join(DISCO._01_ListaCRM, '_00_ZoneEQuote'))) scriviSulDisco(git('ls-files').split('\n').filter(Boolean));
  } catch (e) { console.error('lettura da GitHub non riuscita:', String(e.message).split('\n')[0]); }
  letturaInCorso = false;
}
// scrittura dal pannello (nuovo obiettivo): nella copia del repository, caricata subito su GitHub, poi sul disco
function aggiungiRighe(rel, righe) {
  for (let n = 0; n < 6; n++) {
    try {
      git('fetch', '-q', 'origin', 'main'); git('reset', '-q', '--hard', 'origin/main');
      const f = path.join(COPIA_GITHUB, '_01_ListaCRM', rel), vecchie = fs.existsSync(f) ? leggiCSV(fs.readFileSync(f, 'utf8')) : [];
      while (vecchie.length && !vecchie[vecchie.length - 1].some(Boolean)) vecchie.pop();
      fs.writeFileSync(f, scriviCSV([...vecchie, ...righe]));
      git('add', '-A');
      git('-c', 'user.name=DepthX Centro Gestione', '-c', 'user.email=outbound@depthxlabs.com', 'commit', '-q', '-m', 'Nuovo obiettivo dal pannello di Adrian');
      git('push', '-q', 'origin', 'HEAD:main');
      scriviSulDisco(['_01_ListaCRM/' + rel]);
      return true;
    } catch (e) { console.error('scrittura su GitHub non riuscita:', String(e.message).split('\n')[0]); }
  }
  return false;
}
// ---- Pannello di Adrian: obiettivi, calendario di lavoro, CRM, quote dei servizi ----
const ZONE_E_QUOTE = '1Sr9qOixgP9_snFesfBHcBoVSBxW8YKCAIJvPLHmGRIA';
const FOGLI_RICERCA = { Anna: '11Xfyu2Q3laVgP5pzw003xML0ZUur_4bq-lac9cb3T-E', Max: '12FYuOBjRHmsMpAw7zQ6xkqBPBNFzjATExikSSiskM08',
  Brian: '1oLoNTwnXOpvMdt2OsgD7R_eIxZOiiTo8iyk9dYPVlyA', Nora: '1INosFpaC02tQIKCvgZBUkTWaCceWz7HVa9Ce0ELivSQ',
  Liam: '1NsTzPQL3q60XnrZTV_DfKqvI56VVFAeJ4wK0ovPBVt0', Kera: '1mnTcNUB9ZG0h12b9tWinbGDKYted-22hxVDB-_qeYwY',
  Ester: '1gV9wtsHOLLpT65YQy85dhO1vcYj3HilvLmFn4ISrsAo', Mark: '1k6ITm11B3cqDor36ZuV_9eFstFSZc3AiT_GVWNp7pi0',
  Elen: '13a46HtzCDMseN8WXiO9JsLx66ADDVUZE71_vHQ-5lFw', Leo: '1RCLlxhoPB2eMDOiY8DeVdGaHXIRVHT8MooE-5RqxiSg',
  Tom: '1-TSOMAI41Km1Y5JH55Kr-W0P3r3bfHCnc80RuKMBspQ', Sam: '1HpITMZXbXpEdVjUhiShQpH-TARhIjORwzEL2Ie9l1gE',
  Mia: '1ZduNopPwanAVeuAFMZa12AghAkMyA351-Fswn5-ttyU' };
const pausa = ms => new Promise(ok => setTimeout(ok, ms));
const cache = {};
// Ufficio Materiale social: produzione su GitHub, accesa e spenta da Michele dal pannello di Hector (18/11/2026)
const REPO_UFFICIO = 'depthxlabs/depthx-ufficio-1.2', PRODUZIONE_SOCIAL = '_06_MaterialeSocial_00_Produzione.yml';
const TOKEN_GITHUB = path.join(__dirname, '..', '..', '..', '_01_ChiaviAccessiServiziTerzeParti', '_10_GitHub', '_01_TokenGitHub.txt');
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
// con il token di GitHub nella cartella delle chiavi le letture salgono da 60 a 5000 all'ora
const apiGitHub = url => richiesta('https://api.github.com/' + url, { headers: { 'User-Agent': 'DepthX-CentroGestione', Accept: 'application/vnd.github+json',
  ...(fs.existsSync(TOKEN_GITHUB) ? { Authorization: 'Bearer ' + fs.readFileSync(TOKEN_GITHUB, 'utf8').trim() } : {}) } }).then(r => r.codice === 200 ? JSON.parse(r.testo) : {});
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
           crm: DISCO._01_ListaCRM };
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
    const vivoDownload = (await statoVivo().catch(() => ({}))).Download;
    const statoRighe = vivoDownload ? (vivoDownload.dati.righe || []).slice(1) : await leggiIntervallo(ZONE_E_QUOTE, 'StatoDownload!A2:H20');
    const squadra = statoRighe.filter(x => x[0]).map(x => { let reg = []; try { reg = JSON.parse(x[7] || '[]'); } catch {} return { nome: x[0], alLavoro: x[1] === 'sì', attivita: x[2] || '', aggiornato: x[3] || '', fatti: +x[4] || 0, daFare: +x[5] || 0, fineStimata: x[6] || '', registro: reg }; });
    return { passaggi, download, squadra, materiale: DISCO._02_MaterialeScaricato };
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
  // GET /MaterialeSocial  ->  la produzione dell'ufficio Materiale social su GitHub: acceso o spento, ultimi giri, Nadia e Isla passo per passo
  'GET /MaterialeSocial': async () => conCache('social', 45000, async () => {
    const giri = ((await apiGitHub(`repos/${REPO_UFFICIO}/actions/workflows/${PRODUZIONE_SOCIAL}/runs?per_page=5`)).workflow_runs || []);
    const ultimo = giri[0];
    const lavori = ultimo ? ((await apiGitHub(`repos/${REPO_UFFICIO}/actions/runs/${ultimo.id}/jobs`)).jobs || []) : [];
    // l'avanzamento che ogni produttore pubblica ogni 30 secondi nel suo controllo GitHub "Materiale social <nome>"
    const controlli = [];
    if (ultimo) for (const chi of ['Nadia', 'Isla'])
      controlli.push(...(((await apiGitHub(`repos/${REPO_UFFICIO}/commits/${ultimo.head_sha}/check-runs?check_name=${encodeURIComponent('Materiale social ' + chi)}&per_page=5`)).check_runs) || []));
    const produttori = controlli.filter(c => c.name.startsWith('Materiale social ') && String(c.external_id) === String(ultimo.id))
      .map(c => { try { return JSON.parse(c.output.summary); } catch { return null; } }).filter(Boolean);
    return {
      produttori,
      acceso: !!ultimo && ['queued', 'in_progress', 'waiting', 'pending'].includes(ultimo.status),
      token: fs.existsSync(TOKEN_GITHUB),
      drive: 'https://drive.google.com/drive/folders/1LTHpyPu8mC1g5AQrWtQWKCj8V9pTFLpZ',
      giri: giri.map(g => ({ id: g.id, stato: g.status, esito: g.conclusion, inizio: g.run_started_at || g.created_at, fine: g.updated_at, link: g.html_url })),
      lavori: lavori.map(j => ({ nome: j.name, stato: j.status, esito: j.conclusion, inizio: j.started_at, fine: j.completed_at,
        passo: ((j.steps || []).find(s => s.status === 'in_progress') || (j.steps || []).filter(s => s.status === 'completed').pop() || {}).name || '',
        passi: (j.steps || []).map(s => ({ nome: s.name, stato: s.status, esito: s.conclusion })) })),
    };
  }),
  // POST /MaterialeSocial { azione: 'accendi' | 'spegni', versione }  ->  Michele accende o spegne la produzione dal pannello di Hector
  'POST /MaterialeSocial': async ({ datiInviati: d }) => {
    if (!fs.existsSync(TOKEN_GITHUB)) return { ok: false, errore: 'Manca il token di GitHub nella cartella delle chiavi.' };
    const token = fs.readFileSync(TOKEN_GITHUB, 'utf8').trim();
    const chiama = (url, corpo) => richiesta('https://api.github.com/' + url, { method: 'POST', headers: { 'User-Agent': 'DepthX-CentroGestione', Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } }, corpo ? JSON.stringify(corpo) : '');
    delete cache.social;
    if (d.azione === 'accendi') {
      const versioni = ['1 2 3', '1', '2', '3'].includes(String(d.versioni)) ? String(d.versioni) : '1 2 3';
      const r = await chiama(`repos/${REPO_UFFICIO}/actions/workflows/${PRODUZIONE_SOCIAL}/dispatches`, { ref: 'main', inputs: { versioni } });
      return r.codice === 204 ? { ok: true } : { ok: false, errore: 'GitHub ha risposto ' + r.codice };
    }
    if (d.azione === 'spegni') {
      const giri = ((await apiGitHub(`repos/${REPO_UFFICIO}/actions/workflows/${PRODUZIONE_SOCIAL}/runs?per_page=10`)).workflow_runs || []).filter(g => g.status !== 'completed');
      for (const g of giri) await chiama(`repos/${REPO_UFFICIO}/actions/runs/${g.id}/cancel`);
      return { ok: true, fermati: giri.length };
    }
    return { ok: false, errore: 'Azione sconosciuta.' };
  },
  // GET /MaterialeSocialVivo  ->  ogni scheda del giro di secondo in secondo: parte, GPU, paese, prezzo, fotogrammi, velocità, registro
  'GET /MaterialeSocialVivo': async () => ({ errore: vivoErrore, ora: new Date().toISOString(),
    schede: Object.values(vivoSchede).map(({ ssh, host, ...s }) => s).sort((a, b) => String(a.parte).localeCompare(String(b.parte))) }),
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
    const ok = aggiungiRighe('_00_ZoneEQuote/Obiettivi.csv', riga);
    delete cache.adrian;
    return ok ? { ok: true } : { ok: false, errore: 'Scrittura su GitHub non riuscita.' };
  },
  // GET /CRM  ->  tutte le righe dei fogli della Ricerca (si rilegge al massimo ogni 5 minuti)
  'GET /CRM': async () => conCache('crm', 4 * 60000, async () => {
    const righe = [];
    for (const [nome, foglio] of Object.entries(FOGLI_RICERCA)) {
      try { for (const x of await leggiIntervallo(foglio, 'Contatti!A2:Q5000')) if (x[0]) righe.push([x[0], x[1], x[2] || nome, x[3], x[4], x[5], x[8] || '', x[12] || x[7] || '', x[15] || '']); }
      catch {}
    }
    return { colonne: ['ID', 'Data', 'Ricercatore', 'Tipo', 'Nome', 'Città', 'Email', 'Link', 'Stato'], righe };
  }),
  // GET /Skill?cartella=_01_Ricerca/_02_Anna_AgenzieDaMaps  ->  il testo delle skill del dipendente, file per file in ordine
  'GET /Skill': async ({ indirizzo }) => {
    const cartella = indirizzo.searchParams.get('cartella') || '';
    if (!/^_\d{2}_[A-Za-z0-9]+(_[A-Za-z0-9]+)*(\/_\d{2}_[A-Za-z0-9]+(_[A-Za-z0-9]+)*){0,3}$/.test(cartella)) return { esiste: false };
    const dove = path.join(CARTELLA_SKILL,...cartella.split('/'));
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
  },
});

// Precaricamento: appena acceso e poi ogni 4 minuti rilegge pannello di Adrian e CRM, così le pagine si aprono all'istante
const precarica = async () => { for (const [k, f] of [['adrian', '/Adrian'], ['crm', '/CRM'], ['mike', '/Mike'], ['chi', '/ChiStaLavorando'], ['capacita', '/Capacita']]) { try { await new Promise(ok => require('http').get(`http://127.0.0.1:8828${f}`, r => { r.resume(); r.on('end', ok); }).on('error', ok)); } catch {} } };
setTimeout(() => { leggiDaGitHub(); precarica(); }, 3000); setInterval(precarica, 4 * 60000); setInterval(leggiDaGitHub, 60000);
setInterval(() => { require('http').get('http://127.0.0.1:8828/ChiStaLavorando', r => r.resume()).on('error', () => {}); }, 30000);
// ---- Materiale social: il disco legge da GitHub i video finiti e li scrive in _03_DatabaseMediaProdotti, per formato ----
const MEDIA_DISCO = 'C:/_01_DepthX/_01_Linea1_ProductionDepartement/_02_Linea_1.2_PLANIMETRIE_3D/_07_ProduzioneMaterialeSocialInterno/_03_DatabaseMediaProdotti';
const VIDEO_LETTI = path.join(__dirname, '..', '..', '..', '_03_MemoriaDatiDelCentroGestione', '_24_Ufficio1.2Planimetrie', '_VideoLettiDaGitHub.json');
const scaricaFile = (url, dove, conToken) => new Promise((ok, ko) => {
  const h = { 'User-Agent': 'DepthX-CentroGestione', ...(conToken ? { Authorization: 'Bearer ' + fs.readFileSync(TOKEN_GITHUB, 'utf8').trim() } : {}) };
  https.get(url, { headers: h }, res => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); return scaricaFile(res.headers.location, dove, false).then(ok, ko); }
    if (res.statusCode !== 200) { res.resume(); return ko(new Error('risposta ' + res.statusCode)); }
    const f = fs.createWriteStream(dove); res.pipe(f); f.on('finish', () => f.close(ok)); f.on('error', ko);
  }).on('error', ko);
});
let videoInCorso = false;
async function leggiVideoDaGitHub() {
  if (videoInCorso) return;
  videoInCorso = true;
  try {
    const letti = fs.existsSync(VIDEO_LETTI) ? JSON.parse(fs.readFileSync(VIDEO_LETTI, 'utf8')) : [];
    const pacchi = ((await apiGitHub(`repos/${REPO_UFFICIO}/actions/artifacts?per_page=100`)).artifacts || [])
      .filter(a => /^video-/.test(a.name) && !a.expired && !letti.includes(a.id));
    for (const a of pacchi) {
      const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'video-')), zip = path.join(tmp, 'video.zip');
      await scaricaFile(`https://api.github.com/repos/${REPO_UFFICIO}/actions/artifacts/${a.id}/zip`, zip, true);
      execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${path.join(tmp, 'x')}' -Force`], { windowsHide: true });
      const copia = (da, a2) => { for (const n of fs.readdirSync(da)) { const s = path.join(da, n), d = path.join(a2, n);
        if (fs.statSync(s).isDirectory()) { fs.mkdirSync(d, { recursive: true }); copia(s, d); } else if (n.endsWith('.mp4') && !fs.existsSync(d)) fs.copyFileSync(s, d); } };
      fs.mkdirSync(MEDIA_DISCO, { recursive: true }); copia(path.join(tmp, 'x'), MEDIA_DISCO);
      fs.rmSync(tmp, { recursive: true, force: true });
      letti.push(a.id); fs.writeFileSync(VIDEO_LETTI, JSON.stringify(letti));
    }
  } catch (e) { console.error('video da GitHub non letti:', String(e.message).split('\n')[0]); }
  videoInCorso = false;
}
setTimeout(leggiVideoDaGitHub, 10000); setInterval(leggiVideoDaGitHub, 5 * 60000);

// ---- Materiale social dal vivo: il server legge ogni scheda Vast del giro di secondo in secondo ----
// Le schede del giro hanno l'etichetta ms|<giro>|<parte>. Per ognuna resta aperto un collegamento SSH che ogni secondo
// manda l'avanzamento del render (stato.json di vast_rendi) e le ultime righe del registro.
const CHIAVI_VAST = path.join(__dirname, '..', '..', '..', '_01_ChiaviAccessiServiziTerzeParti', '_12_Vast');
const vivoSchede = {};          // id -> { parte, giro, gpu, paese, prezzo, stato, ssh, render, registro, aggiornato }
let vivoErrore = '';
const leggiSchedeVast = () => new Promise(ok => {
  let chiave = '';
  try { chiave = fs.readFileSync(path.join(CHIAVI_VAST, '_01_ChiaveVast.txt'), 'utf8').trim(); } catch { vivoErrore = 'manca la chiave Vast in _12_Vast'; return ok(null); }
  https.get('https://console.vast.ai/api/v0/instances/?owner=me', { headers: { Authorization: 'Bearer ' + chiave, Accept: 'application/json' } }, r => {
    let t = ''; r.on('data', p => (t += p)); r.on('end', () => { try { ok(JSON.parse(t).instances || []); } catch { ok(null); } });
  }).on('error', () => ok(null));
});
function collegaScheda(id, s) {
  const chiave = path.join(CHIAVI_VAST, '_02_ChiaveSSH');
  if (!fs.existsSync(chiave)) { vivoErrore = 'manca la chiave SSH in _12_Vast'; return; }
  const giro = 'while true; do echo "@@INIZIO"; cat /root/lavoro/_00_Motore/strumenti/stato.json 2>/dev/null; echo; echo "@@REGISTRO"; tail -n 6 /root/lavoro/_00_Motore/strumenti/vast_rendi.log 2>/dev/null; echo "@@FINE"; sleep 1; done';
  const p = require('child_process').spawn('ssh', ['-i', chiave, '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL', '-o', 'ConnectTimeout=8', '-o', 'ServerAliveInterval=15',
    '-p', String(s.porta), 'root@' + s.host, giro], { windowsHide: true });
  let buffer = '';
  p.stdout.on('data', d => {
    buffer += d.toString();
    let k;
    while ((k = buffer.indexOf('@@FINE')) >= 0) {
      const blocco = buffer.slice(0, k); buffer = buffer.slice(k + 6);
      const a = blocco.indexOf('@@INIZIO'), b = blocco.indexOf('@@REGISTRO');
      if (a < 0 || b < 0) continue;
      try { const j = blocco.slice(a + 8, b).trim(); if (j) s.render = JSON.parse(j); } catch {}
      s.registro = blocco.slice(b + 10).trim().split('\n').filter(Boolean).slice(-6);
      s.aggiornato = new Date().toISOString(); s.collegata = true;
    }
  });
  p.on('close', () => { s.ssh = null; s.collegata = false; });
  s.ssh = p;
}
async function aggiornaVivo() {
  const lista = await leggiSchedeVast();
  if (!lista) return;
  vivoErrore = '';
  const viste = new Set();
  for (const x of lista) {
    const et = String(x.label || '');
    if (!et.startsWith('ms|')) continue;
    const [, giro, parte] = et.split('|'), id = String(x.id); viste.add(id);
    const porta = x.ports && x.ports['22/tcp'] && x.ports['22/tcp'][0] ? x.ports['22/tcp'][0].HostPort : x.ssh_port;
    const host = x.public_ipaddr || x.ssh_host;
    const s = vivoSchede[id] || (vivoSchede[id] = { id, giro, parte, inizio: new Date().toISOString() });
    Object.assign(s, { gpu: x.gpu_name, paese: x.geolocation, prezzo: x.dph_total, stato: x.actual_status, host: (host || '').trim(), porta,
      accesa_min: x.start_date ? Math.round((Date.now() / 1000 - x.start_date) / 60) : null });
    if (x.actual_status === 'running' && s.host && s.porta && !s.ssh) collegaScheda(id, s);
  }
  for (const id of Object.keys(vivoSchede)) if (!viste.has(id)) { const s = vivoSchede[id]; if (s.ssh) s.ssh.kill(); s.stato = 'distrutta'; if (!s.fine) s.fine = new Date().toISOString(); }
  for (const id of Object.keys(vivoSchede)) if (vivoSchede[id].fine && Date.now() - new Date(vivoSchede[id].fine) > 30 * 60000) delete vivoSchede[id];
}
setInterval(aggiornaVivo, 3000);
