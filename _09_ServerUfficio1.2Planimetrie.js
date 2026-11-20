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
// Reparto Ricerca collaborazioni B2B e B2C: i contatti vanno nel CRM di ricerca con i nomi per tipo di business,
// zone, quote e stato della ricerca nella memoria dati del server
const REPARTO_B2B = 'C:/_01_DepthX/_01_Linea1_ProductionDepartement/_02_Linea_1.2_PLANIMETRIE_3D/_04_RicercaCollaborazioniB2BeB2C';
const CRM_RICERCA = REPARTO_B2B + '/_03_ListaCRM/_01_CRMDiRicerca';
const ZONE_E_STATO = path.join(__dirname, '..', '..', '..', '_03_MemoriaDatiDelCentroGestione', '_24_Ufficio1.2Planimetrie', '_01_RicercaZoneEStato');
const NOMI_NEL_CRM = { '_01_Anna_AgenzieDaMaps': '_01_AgenzieImmobiliariDaMaps', '_02_Max_AgenzieDagliAnnunciSuiPortali': '_02_AgenzieImmobiliariDagliAnnunciSuiPortali',
  '_03_Brian_AgentiImmobiliariSingoli': '_03_AgentiImmobiliariSingoli', '_04_Nora_PrivatiSuiPortali': '_04_PrivatiSuiPortali',
  '_05_Liam_CostruttoriEImpreseEdili': '_05_CostruttoriEImpreseEdili', '_06_Kera_CaseVacanza': '_06_CaseVacanza', '_07_Ester_AffittiBrevi': '_07_AffittiBrevi',
  '_08_Mark_Architetti': '_08_Architetti', '_09_Elen_StudiDiInterni': '_09_StudiDiInterni', '_10_Leo_Geometri': '_10_Geometri',
  '_11_Tom_AsteImmobiliari': '_11_AsteImmobiliari', '_12_Sam_ProgettiNonAncoraPronti': '_12_ProgettiNonAncoraPronti',
  '_13_Mia': '_13_AgenzieImmobiliariDiLusso' };
// dove sta sul disco un file del repository dei dati (percorso relativo a _01_ListaCRM); null se non va sul disco
const sulDisco = rel => {
  if (/^_00_/.test(rel)) return path.join(ZONE_E_STATO, ...rel.split('/'));
  const nome = rel.replace(/\.csv$/, '');
  return NOMI_NEL_CRM[nome] ? path.join(CRM_RICERCA, NOMI_NEL_CRM[nome] + '.csv') : null;
};
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
const leggiDalDisco = rel => { try { return leggiCSV(fs.readFileSync(sulDisco(rel), 'utf8').replace(/^\uFEFF/, '')); } catch { return []; } };
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
    // only the research list goes to the disk: the old download and reading folders are no longer part of the flow
    if (radice !== '_01_ListaCRM' || !resto.length) continue;
    const da = path.join(COPIA_GITHUB, rel), a = sulDisco(resto.join('/'));
    if (!a) continue;
    if (!fs.existsSync(da)) continue;
    fs.mkdirSync(path.dirname(a), { recursive: true });
    // the research CSVs reach the disk without the Ricercatore column
    if (a.startsWith(path.normalize(CRM_RICERCA))) {
      const righe = leggiCSV(fs.readFileSync(da, 'utf8').replace(/^﻿/, '')).filter(r => r.some(Boolean));
      const k = (righe[0] || []).indexOf('Ricercatore');
      fs.writeFileSync(a, scriviCSV(k < 0 ? righe : righe.map(r => r.filter((_, i) => i !== k))));
    } else fs.copyFileSync(da, a);
  }
}
function leggiDaGitHub() {
  if (letturaInCorso) return;
  letturaInCorso = true;
  try {
    if (!fs.existsSync(path.join(COPIA_GITHUB, '.git'))) {
      execFileSync('git', [...accessoGit(), 'clone', '-q', 'https://github.com/depthxlabs/depthx-dati-1.2.git', COPIA_GITHUB], { windowsHide: true });
      scriviSulDisco(git('ls-files').split('\n').filter(Boolean));
    }
    const prima = git('rev-parse', 'HEAD');
    git('fetch', '-q', 'origin', 'main');
    const dopo = git('rev-parse', 'origin/main');
    if (dopo !== prima) {
      const cambiati = git('diff', '--name-only', '--no-renames', '--diff-filter=AM', prima, dopo).split('\n').filter(Boolean);
      git('reset', '-q', '--hard', 'origin/main');
      scriviSulDisco(cambiati);
      for (const k of ['adrian', 'crm', 'mike', 'chi', 'capacita', 'risorseumane']) delete cache[k];
    }
    if (!fs.existsSync(path.join(ZONE_E_STATO, '_00_ZoneEQuote'))) scriviSulDisco(git('ls-files').split('\n').filter(Boolean));
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
// modifica di righe esistenti in un CSV del repository dei dati: fare(righe) restituisce le righe nuove; caricata subito su GitHub, poi sul disco
function modificaRighe(rel, fare, messaggio) {
  for (let n = 0; n < 6; n++) {
    try {
      git('fetch', '-q', 'origin', 'main'); git('reset', '-q', '--hard', 'origin/main');
      const f = path.join(COPIA_GITHUB, '_01_ListaCRM', rel);
      fs.writeFileSync(f, scriviCSV(fare(leggiCSV(fs.readFileSync(f, 'utf8')).filter(r => r.some(Boolean)))));
      git('add', '-A');
      git('-c', 'user.name=DepthX Centro Gestione', '-c', 'user.email=outbound@depthxlabs.com', 'commit', '-q', '-m', messaggio);
      git('push', '-q', 'origin', 'HEAD:main');
      scriviSulDisco(['_01_ListaCRM/' + rel]);
      return true;
    } catch (e) { console.error('modifica su GitHub non riuscita:', String(e.message).split('\n')[0]); }
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
  for (const m of leggi('_03_MotoreDellaRicercaSuGoogle.py').matchAll(/"(\w+)":\s*\{"ruolo"[\s\S]*?"ricerche":\s*\[([\s\S]*?)\],/g))
    out[m[1]] = { ...(out[m[1]] || {}), ricercheGoogle: (m[2].match(/\{citta\}/g) || []).length };
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
  const zone = await leggiIntervallo(ZONE_E_QUOTE, 'Zone!A2:E2000');
  let braveRimaste = '';
  for (const n of ['Max', 'Sam', 'Mia', 'Brian', 'Nora']) {
    const s = await leggiStato(FOGLI_RICERCA[n]);
    if (s.esiste && s.braveRimasteMese && (!braveRimaste.quando || s.aggiornato > braveRimaste.quando)) braveRimaste = { valore: s.braveRimasteMese, quando: s.aggiornato };
  }
  const github = await conCache('github', 30 * 60000, minutiGitHub);
  return { obiettivi, assegnazioni, ricercatori, zone, quote: { brave: braveRimaste, github },
           crm: CRM_RICERCA };
};

// ---- Reparto B2B, pannello Ricerca: le aree di ricerca, il codice RicercaNNN, la zona di partenza con i dintorni, lo stato ----
// ogni area è un motore su GitHub (nome del motore nel repository) con il suo CSV nel CRM di ricerca
const AREE_RICERCA = [
  { motore: 'Anna', nome: 'Agenzie immobiliari da Maps', file: '_01_AgenzieImmobiliariDaMaps.csv' },
  { motore: 'Max', nome: 'Agenzie immobiliari dai portali', file: '_02_AgenzieImmobiliariDagliAnnunciSuiPortali.csv' },
  { motore: 'Mia', nome: 'Agenzie immobiliari di lusso', file: '_13_AgenzieImmobiliariDiLusso.csv' },
  { motore: 'Brian', nome: 'Agenti immobiliari singoli', file: '_03_AgentiImmobiliariSingoli.csv' },
  { motore: 'Nora', nome: 'Privati sui portali', file: '_04_PrivatiSuiPortali.csv' },
  { motore: 'Liam', nome: 'Costruttori e imprese edili', file: '_05_CostruttoriEImpreseEdili.csv' },
  { motore: 'Kera', nome: 'Case vacanza', file: '_06_CaseVacanza.csv' },
  { motore: 'Ester', nome: 'Affitti brevi', file: '_07_AffittiBrevi.csv' },
  { motore: 'Mark', nome: 'Architetti', file: '_08_Architetti.csv' },
  { motore: 'Elen', nome: 'Studi di interni', file: '_09_StudiDiInterni.csv' },
  { motore: 'Leo', nome: 'Geometri', file: '_10_Geometri.csv' },
  { motore: 'Sam', nome: 'Progetti non ancora pronti', file: '_12_ProgettiNonAncoraPronti.csv' },
];
const AREA_DEL_MOTORE = Object.fromEntries(AREE_RICERCA.map(a => [a.motore, a]));
const CICLO_RICERCA = '_01_Ricerca_00_GiornataDellaRicerca.yml';
const datiWeb = (url, testo) => new Promise((ok, ko) => {
  const r = https.request(url, { method: testo ? 'POST' : 'GET', headers: { 'User-Agent': 'DepthX-CentroGestione/1.0', Accept: 'application/json',
    ...(testo ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) } }, res => { let t = ''; res.on('data', p => (t += p)); res.on('end', () => { try { ok(JSON.parse(t)); } catch { ko(new Error('risposta non leggibile ' + res.statusCode)); } }); });
  r.on('error', ko); if (testo) r.write(testo); r.end();
});
const datiWebConRiprova = async (url, testo) => { let errore; for (let n = 0; n < 4; n++) { try { return await datiWeb(url, testo); } catch (e) { errore = e; await pausa(4000 * (n + 1)); } } throw errore; };
const ZONE_GIA_TROVATE = {};
// la città di partenza e i comuni intorno, dal più vicino, con la sigla della provincia (OpenStreetMap per il punto, Wikidata per i comuni)
async function zoneIntorno(citta, raggioKm) {
  const chiave = citta.trim().toLowerCase() + '|' + raggioKm;
  if (ZONE_GIA_TROVATE[chiave]) return ZONE_GIA_TROVATE[chiave];
  const p = (await datiWebConRiprova('https://nominatim.openstreetmap.org/search?' + new URLSearchParams({ city: citta, country: 'Italia', format: 'jsonv2', limit: '1' })))[0];
  if (!p) throw new Error(`Città "${citta}" non trovata.`);
  const q = `SELECT ?nome ?sigla ?pop ?dist WHERE { SERVICE wikibase:around { ?c wdt:P625 ?pos . bd:serviceParam wikibase:center "Point(${p.lon} ${p.lat})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "${raggioKm}" . bd:serviceParam wikibase:distance ?dist . } ?c wdt:P31 wd:Q747074 . ?c wdt:P131 ?prov . ?prov wdt:P395 ?sigla .
    OPTIONAL { ?c wdt:P1082 ?pop . } ?c rdfs:label ?nome . FILTER(lang(?nome)="it") } ORDER BY ?dist LIMIT 400`;
  const r = await datiWebConRiprova('https://query.wikidata.org/sparql?' + new URLSearchParams({ query: q, format: 'json' }));
  // every town in the radius, nearest first: when the engines have done them all, the planner widens the radius by itself
  const viste = new Set(), zone = [];
  for (const x of r.results.bindings) {
    const nome = x.nome.value, pop = +(x.pop && x.pop.value) || 0, dist = +x.dist.value;
    if (viste.has(nome.toLowerCase())) continue;
    viste.add(nome.toLowerCase()); zone.push({ citta: nome, provincia: x.sigla.value, km: Math.round(dist * 10) / 10, abitanti: pop });
  }
  if (!zone.length) throw new Error(`Nessun comune trovato intorno a "${citta}".`);
  zone.centro = { lat: p.lat, lon: p.lon };
  ZONE_GIA_TROVATE[chiave] = zone;
  return zone;
}
// measured rhythm of the past researches: contacts written per hour, from the first assignment to the last finished turn
function ritmoStorico(assegnazioni) {
  const perObiettivo = {};
  for (const a of assegnazioni) {
    const m = (a[6] || '').match(/fatto: (\d+) righe/);
    if (!m || !a[8] || (a[0] || '').length < 16) continue;
    const x = perObiettivo[a[8]] || (perObiettivo[a[8]] = { righe: 0, da: a[0], a: a[0] });
    x.righe += +m[1]; if (a[0] < x.da) x.da = a[0]; if (a[0] > x.a) x.a = a[0];
  }
  let righe = 0, ore = 0;
  for (const x of Object.values(perObiettivo)) { righe += x.righe; ore += (new Date(x.a.replace(' ', 'T')) - new Date(x.da.replace(' ', 'T'))) / 36e5 + 0.25; }
  return ore > 0 && righe > 0 ? Math.round(righe / ore * 10) / 10 : null;
}
const numeroDi = v => (/^\d+$/.test(String(v || '').trim()) ? +v : 0);
async function statoRicerca() {
  const obiettivi = await leggiIntervallo(ZONE_E_QUOTE, 'Obiettivi!A2:H500');
  const assegnazioni = await leggiIntervallo(ZONE_E_QUOTE, 'Assegnazioni!A2:I5000');
  const vivi = cache.chi ? cache.chi.dati : {};
  const ricerche = obiettivi.filter(o => /^Ricerca\d{3}$/.test(o[0] || '')).map(o => {
    const mie = assegnazioni.filter(a => a[8] === o[0]);
    const perArea = {};
    for (const a of mie) {
      const area = AREA_DEL_MOTORE[a[1]]; if (!area) continue;
      const x = perArea[area.nome] || (perArea[area.nome] = { area: area.nome, contatti: 0, zoneFatte: [], inCorso: '' });
      const m = (a[6] || '').match(/fatto: (\d+) righe/);
      if (m) { x.contatti += +m[1]; x.zoneFatte.push(a[2]); }
      if (a[6] === 'assegnata') {
        // live: the rows arrived in the area CSV since the assignment
        const arrivate = Math.max(0, tabella(path.join(CRM_RICERCA, area.file)).length - numeroDi(a[7]));
        const vivo = vivi[FOGLI_RICERCA[a[1]]] || {};
        x.inCorso = `${a[2]}: ${arrivate} su ${a[4]} arrivati${vivo.inCorso || !arrivate ? ', al lavoro' : ', giro finito'}`;
        x.contatti += arrivate;
      }
    }
    const raggiunti = Math.max(numeroDi(o[6]), Object.values(perArea).reduce((s, x) => s + x.contatti, 0));
    const obiettivo = numeroDi(o[2]), mancano = Math.max(0, obiettivo - raggiunti);
    const inizio = mie.length ? new Date(mie[0][0].replace(' ', 'T')) : null;
    const ore = inizio ? (Date.now() - inizio) / 36e5 : 0;
    const ritmo = ore > 0.2 && raggiunti > 0 ? raggiunti / ore : null;
    const aree = (o[1] || '').toLowerCase() === 'tutti' ? AREE_RICERCA.map(a => a.nome) : (o[1] || '').split(',').map(n => (AREA_DEL_MOTORE[n.trim()] || {}).nome).filter(Boolean);
    return { codice: o[0], obiettivo, raggiunti, mancano, percentuale: obiettivo ? Math.min(100, Math.round(raggiunti / obiettivo * 100)) : 0,
             dal: o[3] || '', stato: o[7] || '', zone: (o[5] || '').split(',').map(z => z.trim()).filter(Boolean), aree,
             perArea: Object.values(perArea).sort((a, b) => b.contatti - a.contatti), giri: mie.length,
             ritmoOra: ritmo ? Math.round(ritmo * 10) / 10 : null, stimaOre: ritmo && mancano ? Math.round(mancano / ritmo * 10) / 10 : null,
             ritmoStorico: ritmoStorico(assegnazioni), stimaIniziale: !ritmo };
  });
  for (const r of ricerche) if (r.stimaOre == null && r.ritmoStorico && r.mancano) { r.ritmoOra = r.ritmoStorico; r.stimaOre = Math.round(r.mancano / r.ritmoStorico * 10) / 10; }
  const attiva = ricerche.find(r => r.stato === 'attivo' && r.mancano > 0) || null;
  if (attiva) {
    // sign of life: the latest update written by any researcher, and the last assignment of the planner
    let vivo = '', chi = '', cosa = '';
    for (const f of fs.existsSync(path.join(ZONE_E_STATO, '_00_Stato')) ? fs.readdirSync(path.join(ZONE_E_STATO, '_00_Stato')) : []) {
      try {
        const s = Object.fromEntries(leggiCSV(fs.readFileSync(path.join(ZONE_E_STATO, '_00_Stato', f), 'utf8')).filter(x => x[0]).map(x => [x[0], x[1] || '']));
        if ((s.aggiornato || '') > vivo) { vivo = s.aggiornato; chi = s.dipendente || ''; cosa = s.attivita || ''; }
      } catch {}
    }
    const ultimaAssegnazione = assegnazioni.filter(a => a[8] === attiva.codice).map(a => a[0] || '').sort().pop() || '';
    attiva.segnoDiVita = { aggiornato: vivo, chi, cosa, ultimaAssegnazione, adesso: new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 19) };
    if (attiva.stimaOre != null) attiva.arrivoPrevisto = new Date(Date.now() + attiva.stimaOre * 36e5 - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16).replace('T', ' ');
  }
  const ultimo = Math.max(0, ...obiettivi.map(o => +(((o[0] || '').match(/^Ricerca(\d{3})$/) || [0, 0])[1])));
  return { attiva, avvio: AVVIO_RICERCA, storico: ricerche.reverse(), prossimoCodice: 'Ricerca' + String(ultimo + 1).padStart(3, '0'), aree: AREE_RICERCA.map(a => a.nome) };
}
let AVVIO_RICERCA = null;   // the start in progress: { codice, fase } while zones are found and the research is written
async function avviaRicerca(d) {
  const stato = await statoRicerca();
  if (stato.attiva) return { ok: false, errore: `C'è già una ricerca attiva: ${stato.attiva.codice}.` };
  if (AVVIO_RICERCA && !AVVIO_RICERCA.errore) return { ok: false, errore: `Avvio già in corso: ${AVVIO_RICERCA.codice}.` };
  const quanti = parseInt(d.obiettivo, 10), raggio = Math.min(80, Math.max(5, parseInt(d.raggioKm, 10) || 30));
  const citta = String(d.citta || '').trim();
  const aree = AREE_RICERCA.filter(a => (d.aree || []).includes(a.nome));
  if (!(quanti > 0)) return { ok: false, errore: "Serve l'obiettivo di contatti." };
  if (!citta) return { ok: false, errore: 'Serve la zona di partenza.' };
  if (!aree.length) return { ok: false, errore: 'Serve almeno un\'area di ricerca.' };
  AVVIO_RICERCA = { codice: stato.prossimoCodice, fase: 'trovo la zona di partenza e i comuni intorno', citta };
  avviaInFondo(stato, quanti, raggio, citta, aree).catch(e => { AVVIO_RICERCA = { ...AVVIO_RICERCA, errore: e.message, fase: 'NOTGO: ' + e.message }; });
  return { ok: true, codice: stato.prossimoCodice, inAvvio: true };
}
async function avviaInFondo(stato, quanti, raggio, citta, aree) {
  const zone = await zoneIntorno(citta, raggio);
  AVVIO_RICERCA.fase = `scrivo la ricerca su ${zone.length} zone per i motori`;
  // the zones not yet known to the engines are added, active, after the existing ones
  const esistenti = await leggiIntervallo(ZONE_E_QUOTE, 'Zone!A2:E500');
  const note = new Set(esistenti.map(z => (z[0] || '').toLowerCase()));
  let priorita = Math.max(0, ...esistenti.map(z => numeroDi(z[4])));
  const nuoveZone = zone.filter(z => !note.has(z.citta.toLowerCase())).map(z => [z.citta, z.provincia, '', 'sì', ++priorita]);
  if (nuoveZone.length && !aggiungiRighe('_00_ZoneEQuote/Zone.csv', nuoveZone)) throw new Error('scrittura delle zone su GitHub non riuscita');
  const tutte = aree.length === AREE_RICERCA.length;
  const riga = [[stato.prossimoCodice, tutte ? 'tutti' : aree.map(a => a.motore).join(', '), quanti, oggiISO(), '', zone.map(z => z.citta).join(', '), 0, 'attivo']];
  if (!aggiungiRighe('_00_ZoneEQuote/Obiettivi.csv', riga)) throw new Error('scrittura della ricerca su GitHub non riuscita');
  // the starting point and the radius: the planner widens it by 20 km when every town has been done
  const raggi = path.join(COPIA_GITHUB, '_01_ListaCRM', '_00_ZoneEQuote', 'RaggiDelleRicerche.csv');
  aggiungiRighe('_00_ZoneEQuote/RaggiDelleRicerche.csv', [...(fs.existsSync(raggi) ? [] : [['Obiettivo', 'Città di partenza', 'Latitudine', 'Longitudine', 'Raggio km']]),
    [stato.prossimoCodice, citta, zone.centro.lat, zone.centro.lon, raggio]]);
  delete cache.adrian;
  // the research cycle starts now, without waiting for its next 10 minute turn
  const token = fs.readFileSync(TOKEN_GITHUB, 'utf8').trim();
  await richiesta(`https://api.github.com/repos/${REPO_UFFICIO}/actions/workflows/${CICLO_RICERCA}/dispatches`,
    { method: 'POST', headers: { 'User-Agent': 'DepthX-CentroGestione', Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } },
    JSON.stringify({ ref: 'main' })).catch(() => null);
  AVVIO_RICERCA = null;
}

// ferma la ricerca attiva: stato "fermata" nel CSV delle ricerche e stop dei giri dei motori in corso su GitHub
async function fermaRicerca() {
  const stato = await statoRicerca();
  if (!stato.attiva) return { ok: false, errore: 'Nessuna ricerca attiva da fermare.' };
  const codice = stato.attiva.codice;
  if (!modificaRighe('_00_ZoneEQuote/Obiettivi.csv', righe => righe.map(r => (r[0] === codice ? [...r.slice(0, 7), 'fermata'] : r)), `Ricerca ${codice} fermata dal Centro Gestione`))
    return { ok: false, errore: 'Scrittura su GitHub non riuscita.' };
  const token = fs.readFileSync(TOKEN_GITHUB, 'utf8').trim();
  const h = { 'User-Agent': 'DepthX-CentroGestione', Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token };
  let fermati = 0;
  for (const s of ['in_progress', 'queued']) {
    const giri = ((await apiGitHub(`repos/${REPO_UFFICIO}/actions/runs?status=${s}&per_page=50`)).workflow_runs || []).filter(g => /^Ricerca/.test(g.name));
    for (const g of giri) { await richiesta(`https://api.github.com/repos/${REPO_UFFICIO}/actions/runs/${g.id}/cancel`, { method: 'POST', headers: h }).catch(() => null); fermati++; }
  }
  delete cache.adrian;
  return { ok: true, codice, fermati };
}

// ---- Reparto B2B: i dati delle quattro stanze del flusso (ricerca, programmazione, invio, raccolta esito) ----
const CRM_ESCLUSI = REPARTO_B2B + '/_03_ListaCRM/_02_CRMDegliEsclusi';
const MAIL_B2B = REPARTO_B2B + '/_04_MailInviate';
const CALENDARIO_B2B = MAIL_B2B + '/_02_CalendarioDegliInvii.csv';
// the calendar rows still open: waiting for approval, approved, or of the old calendar
const APERTA = stato => ['in attesa', 'da approvare', 'approvata'].includes(stato);
const COLONNE_ESCLUSI = ['ID', 'Tipo', 'Nome', 'Città', 'Provincia', 'Sito', 'Email', 'Instagram', 'Data invio', 'Canale Invio', 'Tipo di esclusione', 'Data esito', 'Note', 'Testo Messaggio'];
const GIORNO_UNO_B2B = new Date('2026-11-20T00:00:00');
const tabella = file => { try { const [testa, ...righe] = leggiCSV(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')).filter(r => r.some(Boolean));
  return righe.map(r => Object.fromEntries(testa.map((c, i) => [c, r[i] || '']))); } catch { return []; } };
const salvaTabella = (file, colonne, righe) => fs.writeFileSync(file, scriviCSV([colonne, ...righe.map(r => colonne.map(c => r[c] || ''))]));
const csvDi = cartella => { try { return fs.readdirSync(cartella).filter(n => /^_\d\d_.+\.csv$/.test(n)).sort(); } catch { return []; } };
const emailDi = t => ((t || '').match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [''])[0].toLowerCase().replace(/\.$/, '');
const mailPerIndirizzo = giorno => { const n = Math.floor((giorno - GIORNO_UNO_B2B) / 864e5) + 1; return n <= 13 ? 15 : n <= 24 ? 20 : 25; };
const oggiISO = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const adessoISO = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16).replace('T', ' '); };
// the real estate portals of the skills: the domain itself, never a site that contains the word
const PORTALI = /^https?:\/\/(www\.)?(immobiliare|idealista|casa|subito)\.it\//i;
const ordineB2B = nomi => [...nomi.filter(n => n.includes('AgenzieImmobiliari')), ...nomi.filter(n => !n.includes('AgenzieImmobiliari'))];

function datiB2B() {
  const esclusi = {}, escluse = new Set();
  for (const n of csvDi(CRM_ESCLUSI)) { esclusi[n] = tabella(path.join(CRM_ESCLUSI, n)); for (const r of esclusi[n]) if (r.Email) escluse.add(emailDi(r.Email)); }
  const calendario = tabella(CALENDARIO_B2B);
  const inCalendario = new Set(calendario.filter(r => APERTA(r.Stato)).map(r => r.Email));
  const ricerca = [], instagram = [], portali = [];
  for (const n of ordineB2B(csvDi(CRM_RICERCA))) {
    const righe = tabella(path.join(CRM_RICERCA, n));
    const conEmail = righe.filter(r => emailDi(r.Email));
    ricerca.push({ file: n, contatti: righe.length, conEmail: conEmail.length,
                   liberi: conEmail.filter(r => !escluse.has(emailDi(r.Email)) && !inCalendario.has(emailDi(r.Email))).length });
    for (const r of righe) {
      const e = emailDi(r.Email); if (e && (escluse.has(e) || inCalendario.has(e))) continue;
      if (instagram.length < 25 && /instagram\.com\/|^@/.test(r.Instagram || '')) instagram.push({ file: n, id: r.ID, nome: r.Nome, citta: r['Città'], instagram: r.Instagram });
      if (portali.length < 20 && PORTALI.test(r['Link annuncio o progetto'] || '')) portali.push({ file: n, id: r.ID, nome: r.Nome, citta: r['Città'], link: r['Link annuncio o progetto'] });
    }
  }
  const tutti = Object.entries(esclusi).flatMap(([file, righe]) => righe.map(r => ({ file, ...r })));
  const esiti = { 'In attesa': 0, 'Già in trattativa': 0, 'Non interessato': 0, STOP: 0, 'Nessuna risposta': 0 };
  for (const r of tutti) esiti[r['Tipo di esclusione'] || 'In attesa'] = (esiti[r['Tipo di esclusione'] || 'In attesa'] || 0) + 1;
  const oggi = oggiISO();
  let registro = [];
  try { registro = fs.readFileSync(MAIL_B2B + '/_03_RegistroDelReparto.log', 'utf8').trim().split('\n').slice(-40).reverse(); } catch {}
  let reputazione = null;
  try { reputazione = JSON.parse(fs.readFileSync(MAIL_B2B + '/_05_ReputazioneDomini.json', 'utf8')); } catch {}
  return {
    oggi, mailPerIndirizzo: mailPerIndirizzo(new Date(oggi + 'T00:00:00')), indirizzi: INDIRIZZI_B2B,
    ricerca, calendario: calendario.filter(r => r.Giorno >= oggi), inviateOggi: tutti.filter(r => (r['Canale Invio'] || '').startsWith('Email') && (r['Data invio'] || '').startsWith(oggi)).length,
    esiti, positivi: tutti.filter(r => r['Tipo di esclusione'] === 'Già in trattativa').reverse(),
    ultimiEsiti: tutti.filter(r => r['Tipo di esclusione']).sort((a, b) => (b['Data esito'] || '').localeCompare(a['Data esito'] || '')).slice(0, 30),
    contattati: tutti.length, instagram, portali, registro, reputazione,
  };
}

// ---- Reparto B2B, pannello Programmazione: impostazioni per indirizzo, calendario, coda dei contatti, giorni di copertura ----
const IMPOSTAZIONI_B2B = MAIL_B2B + '/_05_ImpostazioniProgrammazione.json';
// orari e intervallo valgono per dominio (una mail ogni 5 minuti per dominio); attivo, giorno 1 e quantità valgono per indirizzo
// the sending mailboxes: one subdomain for each group of areas; the portals are a channel of their own, never an email
const CASELLE_B2B = [
  { indirizzo: 'partnership@contacts.depthxlabs.com', aree: ['Agenzie immobiliari da Maps'], priorita: 2, attivo: true },
  { indirizzo: 'growth@contacts.depthxlabs.com', aree: ['Agenzie di lusso', 'Progetti non ancora pronti', 'Aste immobiliari'], priorita: 2, attivo: true },
  { indirizzo: 'partnership@reagents.depthxlabs.com', aree: ['Agenti immobiliari singoli'], priorita: 2, attivo: true },
  { indirizzo: 'partnership@costruttori.depthxlabs.com', aree: ['Costruttori e imprese edili'], priorita: 2, attivo: true },
  { indirizzo: 'partnership@casevacanze.depthxlabs.com', aree: ['Case vacanza', 'Affitti brevi'], priorita: 2, attivo: true },
  { indirizzo: 'partnership@architetti.depthxlabs.com', aree: ['Architetti'], priorita: 1, attivo: true },
  { indirizzo: 'partnership@geometri.depthxlabs.com', aree: ['Geometri'], priorita: 1, attivo: true },
  { indirizzo: 'partnership@interiordesign.depthxlabs.com', aree: ['Studi di interni'], priorita: 2, attivo: true },
];
// the categories written by email: every CRM file except the two of the portals
const PORTALI_CSV = ['_02_AgenzieImmobiliariDagliAnnunciSuiPortali.csv', '_04_PrivatiSuiPortali.csv'];
// the mailbox of every CRM file, the same of the calendar program
const CASELLA_DEL_FILE = { '_01_AgenzieImmobiliariDaMaps.csv': 'partnership@contacts.depthxlabs.com', '_13_AgenzieImmobiliariDiLusso.csv': 'growth@contacts.depthxlabs.com',
  '_12_ProgettiNonAncoraPronti.csv': 'growth@contacts.depthxlabs.com', '_11_AsteImmobiliari.csv': 'growth@contacts.depthxlabs.com',
  '_03_AgentiImmobiliariSingoli.csv': 'partnership@reagents.depthxlabs.com', '_05_CostruttoriEImpreseEdili.csv': 'partnership@costruttori.depthxlabs.com',
  '_06_CaseVacanza.csv': 'partnership@casevacanze.depthxlabs.com', '_07_AffittiBrevi.csv': 'partnership@casevacanze.depthxlabs.com',
  '_08_Architetti.csv': 'partnership@architetti.depthxlabs.com', '_10_Geometri.csv': 'partnership@geometri.depthxlabs.com',
  '_09_StudiDiInterni.csv': 'partnership@interiordesign.depthxlabs.com' };
const nomeCategoria = file => file.replace(/^_\d\d_|\.csv$/g, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
const RAMPA_B2B = [{ finoAlGiorno: 13, mail: 15 }, { finoAlGiorno: 24, mail: 20 }, { finoAlGiorno: null, mail: 25 }];
const abilitatiInGmail = () => { try { return JSON.parse(fs.readFileSync(MAIL_B2B + '/_06_IndirizziAbilitatiInGmail.json', 'utf8')); } catch { return { aggiornato: '', abilitati: [] }; } };
const INDIRIZZI_B2B = CASELLE_B2B.map(c => c.indirizzo);
const TETTO_B2B = 300;
const DOMINIO_INIZIALE = dominio => ({ dominio, inizio: '08:15', fine: '17:00', pausaDa: '12:00', pausaA: '13:00', sabato: true, fineSabato: '12:00', intervallo: 5, intervalloStretto: 3 });
const INDIRIZZO_INIZIALE = indirizzo => ({ ...CASELLE_B2B.find(c => c.indirizzo === indirizzo), giornoUno: '2026-11-21', rampa: RAMPA_B2B });
const dominioDi = indirizzo => indirizzo.split('@')[1];
const leggiImpostazioni = () => {
  let s = {};
  try { s = JSON.parse(fs.readFileSync(IMPOSTAZIONI_B2B, 'utf8')); } catch {}
  const domini = [...new Set(INDIRIZZI_B2B.map(dominioDi))];
  return { tetto: +s.tetto || TETTO_B2B, domini: domini.map(d => ({ ...DOMINIO_INIZIALE(d), ...((s.domini || []).find(x => x.dominio === d) || {}) })),
           indirizzi: INDIRIZZI_B2B.map(i => ({ ...INDIRIZZO_INIZIALE(i), ...((s.indirizzi || []).find(x => x.indirizzo === i) || {}),
             aree: CASELLE_B2B.find(c => c.indirizzo === i).aree, priorita: CASELLE_B2B.find(c => c.indirizzo === i).priorita })) };
};
const dataLocale = d => new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const giornoDi = iso => new Date(iso + 'T00:00:00');
// mail previste in un giorno per un indirizzo: zero la domenica, il sabato se il suo dominio non invia, prima del giorno 1 o con l'indirizzo spento
const previsteNelGiorno = (tutte, imp, iso) => {
  const dom = tutte.domini.find(d => d.dominio === dominioDi(imp.indirizzo)) || DOMINIO_INIZIALE('');
  const g = giornoDi(iso), n = Math.floor((g - giornoDi(imp.giornoUno)) / 864e5) + 1;
  if (!imp.attivo || n < 1 || g.getDay() === 0 || (g.getDay() === 6 && !dom.sabato)) return 0;
  return (imp.rampa.find(r => r.finoAlGiorno == null || n <= r.finoAlGiorno) || { mail: 0 }).mail;
};
function esclusiTutti() {
  return csvDi(CRM_ESCLUSI).flatMap(file => tabella(path.join(CRM_ESCLUSI, file)).map(r => ({ file, ...r })));
}
function codaDeiContatti() {
  const escluse = new Set(esclusiTutti().map(r => emailDi(r.Email)).filter(Boolean));
  const inCalendario = new Set(tabella(CALENDARIO_B2B).filter(r => APERTA(r.Stato)).map(r => r.Email));
  const coda = [];
  for (const file of ordineB2B(csvDi(CRM_RICERCA)).filter(f => !PORTALI_CSV.includes(f))) for (const r of tabella(path.join(CRM_RICERCA, file))) {
    const e = emailDi(r.Email);
    if (e && !escluse.has(e) && !inCalendario.has(e) && !/^(dpo|privacy|gdpr|pec)@|@(pec\.|legalmail\.)|\.pec\.it$/i.test(e) && !/\bno\b|non contattare|rifiut/i.test(r.Stato || ''))
      { escluse.add(e); coda.push({ categoria: file.replace(/^_\d\d_|\.csv$/g, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2'), id: r.ID, nome: r.Nome, citta: r['Città'], email: e }); }
  }
  return coda;
}
function datiProgrammazione() {
  const imp = leggiImpostazioni(), oggi = oggiISO(), calendario = tabella(CALENDARIO_B2B), esclusi = esclusiTutti(), coda = codaDeiContatti();
  const inviatiNelGiorno = (iso, ind) => esclusi.filter(r => (r['Data invio'] || '').startsWith(iso) && (r['Canale Invio'] || '') === 'Email ' + ind).length;
  const perIndirizzo = imp.indirizzi.map(i => ({ indirizzo: i.indirizzo, attivo: i.attivo, previsteOggi: previsteNelGiorno(imp, i, oggi), inviateOggi: inviatiNelGiorno(oggi, i.indirizzo),
    giorno: Math.floor((giornoDi(oggi) - giornoDi(i.giornoUno)) / 864e5) + 1 }));
  // the other DepthX addresses that sent mails today, also by hand, outside the programming
  const altri = {};
  for (const r of esclusi) if ((r['Data invio'] || '').startsWith(oggi) && /^Email /.test(r['Canale Invio'] || '')) {
    const ind = r['Canale Invio'].slice(6); if (!imp.indirizzi.some(i => i.indirizzo === ind)) altri[ind] = (altri[ind] || 0) + 1;
  }
  for (const [indirizzo, n] of Object.entries(altri)) perIndirizzo.push({ indirizzo, attivo: false, fuori: true, previsteOggi: 0, inviateOggi: n, giorno: null });
  // weeks from Monday four weeks ago to eight weeks ahead, with the category of every mail:
  // past days the mails really sent; today and the next days the mails of the calendar, or the planned ones of every active mailbox when the calendar is not there yet
  const lunedi = giornoDi(oggi); lunedi.setDate(lunedi.getDate() - ((lunedi.getDay() + 6) % 7) - 28);
  const contaPer = (righe, chiave) => Object.entries(righe.reduce((m, r) => { const k = chiave(r); m[k] = (m[k] || 0) + 1; return m; }, {})).map(([categoria, n]) => ({ categoria, n })).sort((a, b) => b.n - a.n);
  const nonPartita = s => /^(scaduta|non inviata)/.test(s || '');
  const settimane = [];
  for (let s = 0; s < 12; s++) {
    const giorni = [];
    for (let k = 0; k < 6; k++) {
      const g = new Date(lunedi); g.setDate(lunedi.getDate() + s * 7 + k); const iso = dataLocale(g);
      const inviati = esclusi.filter(r => (r['Data invio'] || '').startsWith(iso) && /^Email /.test(r['Canale Invio'] || ''));
      const delCalendario = calendario.filter(r => r.Giorno === iso && !nonPartita(r.Stato));
      let previste = 0, categorie = [];
      if (iso < oggi) { previste = inviati.length; categorie = contaPer(inviati, r => nomeCategoria(r.file)); }
      else if (delCalendario.length) { previste = delCalendario.length; categorie = contaPer(delCalendario, r => nomeCategoria(r['File CRM'])); }
      else { const pr = imp.indirizzi.map(i => ({ categoria: i.aree.join(', '), n: previsteNelGiorno(imp, i, iso) })).filter(x => x.n);
        previste = pr.reduce((t, x) => t + x.n, 0); categorie = pr; }
      giorni.push({ data: iso, previste, categorie, dalCalendario: iso >= oggi && delCalendario.length > 0,
        inviate: iso <= oggi ? inviati.length : null, inCalendario: delCalendario.length,
        daApprovare: delCalendario.filter(r => r.Stato === 'da approvare').length });
    }
    settimane.push({ giorni, totale: giorni.reduce((t, x) => t + x.previste, 0) });
  }
  // one complete mail for every category written by email, the first one of its queue in the calendar
  const esempi = csvDi(CRM_RICERCA).filter(f => !PORTALI_CSV.includes(f)).map(file => ({ categoria: nomeCategoria(file),
    casella: CASELLA_DEL_FILE[file] || '',
    mail: calendario.filter(r => r['File CRM'] === file && APERTA(r.Stato)).sort((a, b) => (a.Giorno + a.Ora).localeCompare(b.Giorno + b.Ora))[0] || null }));
  // how many sending days the free contacts cover at this rhythm: the planned mails of each day are taken from the queue
  let restano = coda.length + calendario.filter(r => APERTA(r.Stato) && r.Giorno >= oggi).length, giorniCopertura = 0, finoAl = null;
  for (let k = 0, g = giornoDi(oggi); restano > 0 && k < 3650; k++, g.setDate(g.getDate() + 1)) {
    const tot = Math.min(imp.tetto, imp.indirizzi.reduce((t, i) => t + previsteNelGiorno(imp, i, dataLocale(g)), 0));
    if (!tot) continue;
    restano -= tot; giorniCopertura++; finoAl = dataLocale(g);
  }
  const daInviareOggi = calendario.filter(r => r.Giorno === oggi && APERTA(r.Stato)).length;
  // the mails sent today are all the emails that left today, from any DepthX address, also by hand
  return { oggi, impostazioni: imp, perIndirizzo, previsteOggi: perIndirizzo.reduce((t, i) => t + i.previsteOggi, 0),
           inviateOggi: esclusi.filter(r => (r['Data invio'] || '').startsWith(oggi) && (r['Canale Invio'] || '').startsWith('Email')).length,
           daInviareOggi, inCoda: coda.length, giorniCopertura, finoAl, coda: coda.slice(0, 300), settimane, esempi,
           abilitati: abilitatiInGmail(), calendario: calendario.filter(r => r.Giorno >= oggi) };
}
function salvaImpostazioni(d) {
  const ora = leggiImpostazioni(), orario = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (+d.tetto >= 0 && +d.tetto <= 5000) ora.tetto = +d.tetto;
  for (const n of d.domini || []) {
    const x = ora.domini.find(i => i.dominio === n.dominio); if (!x) continue;
    for (const k of ['inizio', 'fine', 'pausaDa', 'pausaA', 'fineSabato']) if (orario.test(n[k] || '')) x[k] = n[k];
    for (const k of ['intervallo', 'intervalloStretto']) if (+n[k] >= 1 && +n[k] <= 60) x[k] = +n[k];
    x.sabato = !!n.sabato;
  }
  for (const n of d.indirizzi || []) {
    const x = ora.indirizzi.find(i => i.indirizzo === n.indirizzo); if (!x) continue;
    if (/^\d{4}-\d{2}-\d{2}$/.test(n.giornoUno || '')) x.giornoUno = n.giornoUno;
    x.attivo = !!n.attivo;
    if (Array.isArray(n.rampa) && n.rampa.length >= 1 && n.rampa.length <= 6 && n.rampa.every(r => +r.mail >= 0 && +r.mail <= 200))
      x.rampa = n.rampa.map((r, k) => ({ finoAlGiorno: k === n.rampa.length - 1 ? null : Math.max(1, +r.finoAlGiorno || 1), mail: +r.mail }));
  }
  fs.writeFileSync(IMPOSTAZIONI_B2B, JSON.stringify(ora, null, 1));
  return { ok: true };
}

// ---- Reparto B2B: le attività di Windows che rendono il flusso automatico, lette dal Pianificatore di Windows ----
const ESITI_ATTIVITA = { 0: 'ultimo giro senza errori', 267009: 'al lavoro adesso', 267011: 'non ancora partita', 267010: 'disattivata', 1: 'ultimo giro NOTGO' };
function attivitaB2B() {
  return conCache('attivitaB2B', 30000, () => new Promise(ok => {
    const comando = "Get-ScheduledTask -TaskPath '\\DepthX B2B\\' |ForEach-Object { $i = $_ | Get-ScheduledTaskInfo; [pscustomobject]@{ nome = $_.TaskName; stato = [string]$_.State; " +
      "ultimo = if ($i.LastRunTime.Year -gt 2000) { $i.LastRunTime.ToString('yyyy-MM-dd HH:mm') } else { '' }; esito = $i.LastTaskResult; " +
      "prossimo = if ($i.NextRunTime) { $i.NextRunTime.ToString('yyyy-MM-dd HH:mm') } else { '' } } } | ConvertTo-Json -Compress";
    execFile('powershell', ['-NoProfile', '-Command', comando], { windowsHide: true, timeout: 60000 }, (errore, uscita) => {
      let lista = [];
      try { lista = [].concat(JSON.parse(uscita || '[]')); } catch {}
      ok(lista.map(x => ({ ...x, attiva: x.stato !== 'Disabled', descrizione: ESITI_ATTIVITA[x.esito] || `ultimo giro NOTGO (codice ${x.esito})` })));
    });
  }));
}

// ---- Reparto B2B, pannello Invio: inviati oggi e finora per indirizzo, per categoria e per tipologia di esclusione ----
function datiInvio() {
  const oggi = oggiISO(), esclusi = esclusiTutti(), conta = (righe, chiave) => righe.reduce((m, r) => { const k = chiave(r) || '(vuoto)'; m[k] = (m[k] || 0) + 1; return m; }, {});
  const categoria = r => r.file.replace(/^_\d\d_|\.csv$/g, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
  const tipologie = ['Già in trattativa', 'Non interessato', 'STOP', 'Nessuna risposta'];
  return {
    oggi, inviatiOggi: esclusi.filter(r => (r['Data invio'] || '').startsWith(oggi)).length, totale: esclusi.length,
    oggiPerCanale: conta(esclusi.filter(r => (r['Data invio'] || '').startsWith(oggi)), r => r['Canale Invio']),
    finoraPerCanale: conta(esclusi, r => r['Canale Invio']),
    perTipologia: Object.fromEntries(['In attesa di esito', ...tipologie].map(t => [t, esclusi.filter(r => (r['Tipo di esclusione'] || 'In attesa di esito') === t).length])),
    perCategoria: Object.entries(conta(esclusi, categoria)).map(([cat, n]) => ({ categoria: cat, totale: n,
      tipologie: Object.fromEntries(['In attesa di esito', ...tipologie].map(t => [t, esclusi.filter(r => categoria(r) === cat && (r['Tipo di esclusione'] || 'In attesa di esito') === t).length])) })),
    // every send of today, newest first, with the sending domain: the page shows the whole list and one tab per domain
    invioDiOggi: esclusi.filter(r => (r['Data invio'] || '').startsWith(oggi)).sort((a, b) => (b['Data invio'] || '').localeCompare(a['Data invio'] || ''))
      .map(r => ({ ora: (r['Data invio'] || '').slice(11, 16), canale: r['Canale Invio'], dominio: (((r['Canale Invio'] || '').match(/@([\w.-]+)/) || [])[1]) || (r['Canale Invio'] || '(senza canale)'),
                   categoria: categoria(r), nome: r.Nome, citta: r['Città'], email: r.Email, esclusione: r['Tipo di esclusione'] || 'In attesa di esito' })),
    // the sending addresses of the programming and the ones used by hand outside it
    indirizziProgrammazione: INDIRIZZI_B2B,
  };
}

// ---- Reparto B2B, pannello Raccolta esito: tasso di risposta e analisi per indirizzo, categoria, oggetto, giorno e tempi ----
function datiEsiti() {
  const esclusi = esclusiTutti(), adesso = Date.now();
  const risposta = r => ['Già in trattativa', 'Non interessato', 'STOP'].includes(r['Tipo di esclusione']);
  const chiuso = r => !!r['Tipo di esclusione'];
  const oggetto = r => (((r['Testo Messaggio'] || '').match(/^Oggetto: (.*)$/m) || [])[1] || '(senza oggetto)').trim();
  const categoria = r => r.file.replace(/^_\d\d_|\.csv$/g, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
  const gruppo = chiave => Object.values(esclusi.reduce((m, r) => { const k = chiave(r) || '(vuoto)';
    const x = m[k] || (m[k] = { voce: k, inviati: 0, chiusi: 0, risposte: 0, trattativa: 0, nonInteressati: 0, stop: 0 });
    x.inviati++; if (chiuso(r)) x.chiusi++; if (risposta(r)) x.risposte++;
    if (r['Tipo di esclusione'] === 'Già in trattativa') x.trattativa++; if (r['Tipo di esclusione'] === 'Non interessato') x.nonInteressati++; if (r['Tipo di esclusione'] === 'STOP') x.stop++;
    return m; }, {})).map(x => ({ ...x, tasso: x.inviati ? Math.round(x.risposte / x.inviati * 1000) / 10 : 0 })).sort((a, b) => b.inviati - a.inviati);
  const tempi = esclusi.filter(r => risposta(r) && r['Data invio'] && r['Data esito']).map(r => (new Date(r['Data esito'].replace(' ', 'T')) - new Date(r['Data invio'].replace(' ', 'T'))) / 36e5).filter(h => h >= 0);
  const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  const risposte = esclusi.filter(risposta).length;
  return {
    contattati: esclusi.length, risposte, tasso: esclusi.length ? Math.round(risposte / esclusi.length * 1000) / 10 : 0,
    inAttesa: esclusi.filter(r => !chiuso(r)).length,
    inAttesaEntro100Ore: esclusi.filter(r => !chiuso(r) && r['Data invio'] && adesso - new Date(r['Data invio'].replace(' ', 'T')) < 100 * 36e5).length,
    perEsito: { 'Già in trattativa': esclusi.filter(r => r['Tipo di esclusione'] === 'Già in trattativa').length, 'Non interessato': esclusi.filter(r => r['Tipo di esclusione'] === 'Non interessato').length,
      STOP: esclusi.filter(r => r['Tipo di esclusione'] === 'STOP').length, 'Nessuna risposta': esclusi.filter(r => r['Tipo di esclusione'] === 'Nessuna risposta').length },
    tempoMedioOre: tempi.length ? Math.round(tempi.reduce((s, h) => s + h, 0) / tempi.length * 10) / 10 : null,
    perIndirizzo: gruppo(r => r['Canale Invio']), perCategoria: gruppo(categoria), perOggetto: gruppo(oggetto),
    perGiorno: gruppo(r => r['Data invio'] ? GIORNI[new Date(r['Data invio'].slice(0, 10) + 'T00:00:00').getDay()] : ''),
    inTrattativa: esclusi.filter(r => r['Tipo di esclusione'] === 'Già in trattativa').map(r => ({ nome: r.Nome, citta: r['Città'], email: r.Email, data: r['Data esito'], categoria: categoria(r), note: r.Note })),
    ultimi: esclusi.filter(chiuso).sort((a, b) => (b['Data esito'] || '').localeCompare(a['Data esito'] || '')).slice(0, 40)
      .map(r => ({ data: r['Data esito'], esito: r['Tipo di esclusione'], nome: r.Nome, email: r.Email, categoria: categoria(r) })),
  };
}

// ---- Reparto B2B: il CRM di ricerca o degli esclusi, un CSV per categoria con tutte le colonne ----
function datiCRM(tipo) {
  const cartella = tipo === 'esclusi' ? CRM_ESCLUSI : CRM_RICERCA;
  return { tipo, categorie: csvDi(cartella).map(file => {
    let colonne = [];
    try { colonne = leggiCSV(fs.readFileSync(path.join(cartella, file), 'utf8').replace(/^﻿/, ''))[0] || []; } catch {}
    return { file, nome: file.replace(/^_\d\d_|\.csv$/g, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2'), colonne, righe: tabella(path.join(cartella, file)) };
  }) };
}

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
    // read by column name from the research CSVs: the category is the name of the CSV, never an employee
    const righe = [];
    for (const n of csvDi(CRM_RICERCA))
      for (const r of tabella(path.join(CRM_RICERCA, n))) if (r.ID)
        righe.push([r.ID, r.Data, n.replace(/^_\d\d_|\.csv$/g, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2'), r.Tipo, r.Nome, r['Città'], r.Email || '', r['Link annuncio o progetto'] || r.Sito || '', r.Stato || '']);
    return { colonne: ['ID', 'Data', 'Categoria', 'Tipo', 'Nome', 'Città', 'Email', 'Link', 'Stato'], righe };
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
  // GET /B2B  ->  i dati delle quattro stanze del reparto B2B: ricerca, calendario, esclusi ed esiti, liste di Instagram e portali, registro
  'GET /B2B': async () => datiB2B(),
  // GET /B2BRicerca  ->  la ricerca attiva (codice, obiettivo, raggiunti, mancano, ritmo, stima, aree e zone), lo storico, il prossimo codice
  'GET /B2BRicerca': async () => statoRicerca(),
  // POST /B2BAvviaRicerca { aree, citta, raggioKm, obiettivo }  ->  nuova ricerca RicercaNNN: zone di partenza e dintorni, motori avviati subito
  'POST /B2BAvviaRicerca': async ({ datiInviati: d }) => { try { return await avviaRicerca(d); } catch (e) { return { ok: false, errore: e.message }; } },
  // POST /B2BFermaRicerca  ->  la ricerca attiva diventa "fermata" e i giri dei motori in corso si fermano
  'POST /B2BFermaRicerca': async () => { try { return await fermaRicerca(); } catch (e) { return { ok: false, errore: e.message }; } },
  // GET /B2BZone?citta=Brescia&raggioKm=30  ->  anteprima delle zone: la città di partenza e i comuni intorno
  'GET /B2BZone': async ({ indirizzo }) => { try { return { ok: true, zone: await zoneIntorno(indirizzo.searchParams.get('citta') || '', Math.min(80, Math.max(5, +indirizzo.searchParams.get('raggioKm') || 30))) }; } catch (e) { return { ok: false, errore: e.message }; } },
  // GET /B2BCRM?tipo=ricerca|esclusi  ->  il CRM completo, un CSV per categoria con tutte le colonne
  'GET /B2BCRM': async ({ indirizzo }) => datiCRM(indirizzo.searchParams.get('tipo') === 'esclusi' ? 'esclusi' : 'ricerca'),
  // GET /B2BProgrammazione  ->  calendario a settimane, oggi per indirizzo, coda dei contatti, giorni di copertura, impostazioni
  'GET /B2BProgrammazione': async () => datiProgrammazione(),
  // POST /B2BImpostazioni { indirizzi: [...] }  ->  Michele gestisce la programmazione di ogni indirizzo
  'POST /B2BImpostazioni': async ({ datiInviati: d }) => salvaImpostazioni(d),
  // GET /B2BInvio  ->  inviati oggi e finora per indirizzo, per categoria e per tipologia di esclusione
  'GET /B2BInvio': async () => datiInvio(),
  // GET /B2BAttivita  ->  le attività di Windows del reparto: attiva, ultimo giro, esito, prossimo giro
  'GET /B2BAttivita': async () => ({ attivita: await attivitaB2B() }),
  // GET /B2BEsiti  ->  tasso di risposta e analisi per indirizzo, categoria, oggetto, giorno della settimana, tempi di risposta
  'GET /B2BEsiti': async () => datiEsiti(),
  // POST /B2BSaluto { giorno, ora, email, nome }  ->  Michele corregge il nome nel saluto di una mail ancora in attesa
  'POST /B2BSaluto': async ({ datiInviati: d }) => {
    const nome = String(d.nome || '').trim().slice(0, 60);
    if (!nome) return { ok: false, errore: 'Serve il nome.' };
    const righe = tabella(CALENDARIO_B2B), r = righe.find(x => x.Giorno === d.giorno && x.Ora === d.ora && x.Email === d.email && APERTA(x.Stato));
    if (!r) return { ok: false, errore: 'Mail non trovata o già partita.' };
    // the new name replaces the old one also in the subject and in the text already composed
    if (r['Nome nel saluto']) for (const k of ['Oggetto', 'Testo']) if (r[k]) r[k] = r[k].split(r['Nome nel saluto']).join(nome);
    r['Nome nel saluto'] = nome;
    salvaTabella(CALENDARIO_B2B, Object.keys(righe[0]), righe);
    return { ok: true };
  },
  // POST /B2BApprova { giorno, ora, email }  ->  Michele approva una mail: "OK invia", parte alla sua ora
  'POST /B2BApprova': async ({ datiInviati: d }) => {
    const righe = tabella(CALENDARIO_B2B), r = righe.find(x => x.Giorno === d.giorno && x.Ora === d.ora && x.Email === d.email);
    if (!r) return { ok: false, errore: 'Mail non trovata.' };
    if (r.Stato !== 'da approvare') return { ok: false, errore: `La mail è già: ${r.Stato}.` };
    if (!r.Oggetto || !r.Testo) return { ok: false, errore: 'La mail non ha oggetto o testo.' };
    r.Stato = 'approvata';
    salvaTabella(CALENDARIO_B2B, Object.keys(righe[0]), righe);
    fs.appendFileSync(MAIL_B2B + '/_03_RegistroDelReparto.log', `${adessoISO()}:00  approvazione: ${d.giorno} ${d.ora} ${d.email} approvata da Michele
`);
    return { ok: true };
  },
  // POST /B2BInviato { file, id, canale: 'Instagram' | 'Portale' }  ->  il messaggio mandato a mano: il contatto entra negli esclusi del suo tipo di business
  'POST /B2BInviato': async ({ datiInviati: d }) => {
    if (!['Instagram', 'Portale'].includes(d.canale) || !/^_\d\d_[A-Za-z]+\.csv$/.test(d.file || '')) return { ok: false, errore: 'Richiesta non valida.' };
    const contatto = tabella(path.join(CRM_RICERCA, d.file)).find(r => r.ID === d.id);
    if (!contatto) return { ok: false, errore: 'Contatto non trovato.' };
    const percorso = path.join(CRM_ESCLUSI, d.file), righe = tabella(percorso);
    if (righe.some(r => r.ID === d.id)) return { ok: true, gia: true };
    const da = d.canale === 'Instagram' ? '@DepthXmedia' : (((contatto['Link annuncio o progetto'] || '').match(PORTALI) || [])[2] ? (contatto['Link annuncio o progetto'].match(PORTALI)[2] + '.it') : 'portale');
    righe.push({ ...Object.fromEntries(COLONNE_ESCLUSI.map(c => [c, contatto[c] || ''])), Email: emailDi(contatto.Email), 'Data invio': adessoISO(), 'Canale Invio': d.canale + ' ' + da, 'Testo Messaggio': String(d.testo || '').slice(0, 4000) });
    salvaTabella(percorso, COLONNE_ESCLUSI, righe);
    fs.appendFileSync(MAIL_B2B + '/_03_RegistroDelReparto.log', `${adessoISO()}:00  esclusi: ${d.id} in ${d.file}, ${d.canale} da ${da}\n`);
    return { ok: true };
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
