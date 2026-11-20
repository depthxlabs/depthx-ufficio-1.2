"""MOTORE DELLA RICERCA SU GOOGLE, Ufficio 1.2 Planimetrie 3D, area Ricerca (capo area Adrian).

Lo usano Max (agenzie presenti sui portali), Sam (progetti non ancora pronti), Brian (profili Instagram pubblici degli agenti),
Mia (agenzie di lusso) e Nora (annunci di privati).
I portali bloccano le visite automatiche, quindi non si aprono mai: si usa la ricerca classica di Google, aperta con Chrome
senza nessun account, che restituisce le pagine dei portali già pubblicate sul web.
Se Google mostra la verifica anti robot, la ricerca non la aggira mai: quella ricerca si salta e il giro continua (regola 7).
1. Google trova le pagine della zona sui portali (agenzie per Max, nuove costruzioni e crowdfunding per Sam).
2. Dal titolo della pagina prende il nome; una seconda ricerca Google trova il sito ufficiale.
3. Dal sito ufficiale prende l'email pubblicata, con le stesse regole del motore di Maps.
4. Scarta chi non ha sito o email e chi è già in un foglio della Ricerca; scrive fino alla quota.

Uso:  python -I _03_MotoreDellaRicercaSuGoogle.py --dipendente Max --citta Milano --provincia MI --quota 10
"""
import argparse, datetime, json, os, re, sys, time, urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib
M = importlib.import_module("_01_MotoreDellaRicercaSuMaps")  # stato, registro, CSV della ricerca, lettura dei siti

PORTALI = ("immobiliare.it", "idealista.it", "casa.it", "subito.it", "wikicasa.it", "walliance.eu", "recrowd.com",
           "concrete-investing.com", "rendimentoetico.it", "facebook.com", "instagram.com", "linkedin.com", "paginegialle.it",
           "youtube.com", "tiktok.com", "google.", "wikipedia.org", "tripadvisor.", "virgilio.it", "kijiji", "trovit.",
           "immobiliare.com", "bakeca.it", "houzz.", "cylex", "infobel", "prontopro.it", "habitissimo.it", "misterimprese.it")

RICERCATORI = {
    "Max": {"ruolo": "Ricerca agenzie dagli annunci sui portali", "tipo": "agenzia", "sigla": "AGP",
            "foglio": "12FYuOBjRHmsMpAw7zQ6xkqBPBNFzjATExikSSiskM08",
            "ricerche": ["site:immobiliare.it/agenzie-immobiliari {citta}", "site:idealista.it/pro {citta} agenzia",
                         "site:casa.it/agenzie {citta}"],
            "strumento": "Ricerca Google (pagina agenzia sul portale) + sito"},
    "Brian": {"ruolo": "Ricerca agenti immobiliari singoli", "tipo": "agente", "sigla": "AGS",
              "foglio": "1oLoNTwnXOpvMdt2OsgD7R_eIxZOiiTo8iyk9dYPVlyA",
              "ricerche": ['site:instagram.com "real estate agent" {citta}', 'site:instagram.com "RE/MAX" agent {citta}',
                           'site:instagram.com Tecnocasa agente {citta}', 'site:instagram.com "Engel & Völkers" {citta}',
                           'site:instagram.com Gabetti agente {citta}', 'site:instagram.com "agente immobiliare" {citta}'],
              "strumento": "Ricerca Google (profilo Instagram pubblico)"},
    "Nora": {"ruolo": "Ricerca privati con annunci sui portali", "tipo": "privato", "sigla": "PRV",
             "foglio": "1INosFpaC02tQIKCvgZBUkTWaCceWz7HVa9Ce0ELivSQ",
             "ricerche": ['site:subito.it vendita appartamento privato planimetria {citta}', 'site:immobiliare.it privato planimetria vendita {citta}',
                          'site:idealista.it privato planimetria {citta}'],
             "strumento": "Ricerca Google (annuncio di privato sul portale)"},
    "Mia": {"ruolo": "Ricerca agenzie di immobili di lusso", "tipo": "agenzia lusso", "sigla": "LUS",
            "foglio": "1ZduNopPwanAVeuAFMZa12AghAkMyA351-Fswn5-ttyU",
            "ricerche": ["agenzia immobiliare di lusso {citta}", "immobili di prestigio {citta} agenzia", "luxury real estate {citta}",
                         "Lionard {citta}", "Engel & Völkers {citta}", "Sotheby's International Realty {citta}", "Coldwell Banker {citta} prestigio"],
            "strumento": "Ricerca Google (agenzie di lusso) + sito"},
    "Sam": {"ruolo": "Ricerca progetti non ancora pronti", "tipo": "progetto non ancora pronto", "sigla": "PRG",
            "foglio": "1HpITMZXbXpEdVjUhiShQpH-TARhIjORwzEL2Ie9l1gE",
            "ricerche": ["site:immobiliare.it/nuove-costruzioni {citta}", "nuova costruzione residenziale {citta} appartamenti in vendita classe A",
                         "nuovo complesso residenziale {citta} cantiere", "site:walliance.eu {citta}", "site:recrowd.com {citta}"],
            "strumento": "Ricerca Google (nuove costruzioni e crowdfunding) + sito"},
}
GOOGLE = {"t": 0.0, "usate": 0, "saltate": 0, "verifica": 0, "pagina": None, "chrome": None, "pw": None}
PAUSA_GOOGLE = 4          # secondi tra due ricerche Google
VERIFICHE_MASSIME = 2     # dopo due verifiche anti robot di fila il giro smette di usare Google e scrive ciò che ha trovato
# i risultati organici della pagina: titolo, indirizzo e testo di ognuno
LEGGI_RISULTATI = """() => [...document.querySelectorAll('#search a h3')].map(h => {
  const a = h.closest('a'), box = a.closest('div.MjjYud, div.g, div[data-hveid]') || a.parentElement;
  const testo = box ? ((box.querySelector('.VwiC3b, [data-sncf], .IsZvec') || {}).innerText || '') : '';
  return { url: a.href, title: h.innerText, description: testo };
})"""


def apri_chrome():
    """Chrome già presente sulla macchina di GitHub, senza account e senza profilo salvato."""
    from playwright.sync_api import sync_playwright
    GOOGLE["pw"] = sync_playwright().start()
    try:
        chrome = GOOGLE["pw"].chromium.launch(channel="chrome", headless=True)
    except Exception:
        chrome = GOOGLE["pw"].chromium.launch(headless=True)
    contesto = chrome.new_context(locale="it-IT", user_agent=M.AGENTE, viewport={"width": 1280, "height": 900})
    GOOGLE["chrome"], GOOGLE["pagina"] = chrome, contesto.new_page()


def google(q, quanti=20):
    """Una ricerca classica su Google; con la verifica anti robot la ricerca si salta, mai aggirata."""
    if GOOGLE["verifica"] >= VERIFICHE_MASSIME:
        return []
    if GOOGLE["pagina"] is None:
        apri_chrome()
    attesa = GOOGLE["t"] + PAUSA_GOOGLE - time.time()
    if attesa > 0:
        time.sleep(attesa)
    GOOGLE["t"] = time.time(); GOOGLE["usate"] += 1
    pagina = GOOGLE["pagina"]
    try:
        pagina.goto("https://www.google.com/search?" + urllib.parse.urlencode({"q": q, "hl": "it", "gl": "it", "num": quanti}),
                    wait_until="domcontentloaded", timeout=45000)
        if "consent.google" in pagina.url:
            # la scelta più riservata sui cookie: rifiuta tutto
            for testo in ("Rifiuta tutto", "Reject all"):
                bottone = pagina.get_by_role("button", name=testo)
                if bottone.count():
                    bottone.first.click(); pagina.wait_for_load_state("domcontentloaded"); break
        if "/sorry/" in pagina.url or pagina.locator("#captcha-form, iframe[src*='recaptcha']").count():
            GOOGLE["verifica"] += 1; GOOGLE["saltate"] += 1
            M.scrivi_registro(f"Google mostra la verifica anti robot: ricerca saltata ({q})")
            return []
        GOOGLE["verifica"] = 0
        pagina.wait_for_selector("#search", timeout=15000)
        return [r for r in pagina.evaluate(LEGGI_RISULTATI) if r.get("url", "").startswith("http") and "google." not in dominio(r["url"])]
    except Exception as e:
        GOOGLE["saltate"] += 1
        M.scrivi_registro(f"Google non ha risposto ({type(e).__name__}): ricerca saltata ({q})")
        return []


def chiudi_chrome():
    try:
        if GOOGLE["chrome"]:
            GOOGLE["chrome"].close()
        if GOOGLE["pw"]:
            GOOGLE["pw"].stop()
    except Exception:
        pass


def dominio(u):
    return urllib.parse.urlparse(u).netloc.lower().replace("www.", "")


def e_portale(u):
    d = dominio(u)
    return any(p in d for p in PORTALI)


def nome_dal_titolo(titolo):
    t = re.split(r"\s\(@|\s[|\-–·:]\s|:\s", titolo)[0]
    t = re.sub(r"^(Agenzia immobiliare|Nuove costruzioni|Nuova costruzione)\s*:?\s*", "", t, flags=re.I)
    return t.strip()[:80]


def main():
    a = argparse.ArgumentParser()
    a.add_argument("--dipendente", required=True, choices=list(RICERCATORI))
    a.add_argument("--citta", required=True)
    a.add_argument("--provincia", required=True)
    a.add_argument("--quota", type=int, default=10)
    p = a.parse_args()
    cfg = RICERCATORI[p.dipendente]
    M.FOGLIO["id"] = cfg["foglio"]
    M.stato(dipendente=p.dipendente, ruolo=cfg["ruolo"], inCorso=True, attivita="Avvio", zona=f"{p.citta} ({p.provincia})",
            quota=p.quota, scritte=0, rimanenti=p.quota, sitiLetti=0, agenzieTrovate=0, scartati={}, sitoAttuale="", ultime=[],
            foglio=f"https://docs.google.com/spreadsheets/d/{cfg['foglio']}/edit",
            inizio=datetime.datetime.now().isoformat(timespec="seconds"), fine="", esito="")
    r = M.con_riprova(lambda: M.SESSIONE.get(f"https://sheets.googleapis.com/v4/spreadsheets/{cfg['foglio']}/values/{M.SCHEDA}!A2:A"))
    r.raise_for_status()
    numero = len(r.json().get("values", []))
    M.stato(attivita="Controlla i 12 fogli della Ricerca per non prendere doppioni")
    siti_noti, email_note = M.gia_noti()
    oggi = datetime.date.today().isoformat()
    nuove, scarti, visti = [], {}, set()

    def scarta(motivo, nome=""):
        scarti[motivo] = scarti.get(motivo, 0) + 1
        M.scrivi_registro(f"Scartato {nome}: {motivo}")

    # 1. le pagine della zona sui portali (o i siti dei progetti, per Sam)
    candidati = []
    for modello in cfg["ricerche"]:
        q = modello.format(citta=p.citta)
        M.stato(attivita=f"Cerca su Google: {q}")
        for ris in google(q):
            u, nome = ris.get("url", ""), nome_dal_titolo(ris.get("title", ""))
            testo = (ris.get("title", "") + " " + ris.get("description", "")).lower()
            # per i profili Instagram la città è già nella ricerca: non si chiede che compaia anche nel risultato
            if not nome or nome.lower() in visti or ("instagram.com/" not in u and p.citta.lower() not in testo + u.lower()):
                continue
            if "immobiliare.it/agenzie-immobiliari/" in u and not re.search(r"/agenzie-immobiliari/\d+/", u):
                continue  # pagina elenco delle agenzie, non una singola agenzia
            visti.add(nome.lower()); candidati.append((nome, u, ris.get("description", "")))
    M.stato(attivita=f"Google: {len(candidati)} candidati, controllo uno per uno", agenzieTrovate=len(candidati))

    link_noti = set()
    if p.dipendente == "Nora":  # gli annunci già scritti da Nora, per non ripeterli
        r = M.con_riprova(lambda: M.SESSIONE.get(f"https://sheets.googleapis.com/v4/spreadsheets/{cfg['foglio']}/values/{M.SCHEDA}!M2:M"))
        link_noti = {x[0] for x in r.json().get("values", []) if x}
    for nome, link, descrizione in candidati:
        if len(nuove) >= p.quota:
            break
        # annuncio di un privato (Nora): niente email, si contatta dal modulo del portale
        if p.dipendente == "Nora":
            if not re.search(r"subito\.it/.+\d+\.htm|immobiliare\.it/annunci/\d+|idealista\.it/immobile/\d+", link):
                scarta("non è un singolo annuncio", nome); continue
            if link in link_noti:
                scarta("già nel foglio di Nora", nome); continue
            if re.search(r"agenzia|immobiliare srl|real estate", descrizione, re.I):
                scarta("pubblicato da un'agenzia", nome); continue
            numero += 1
            pl = "sì" if re.search(r"planimetri", descrizione, re.I) else ""
            nuove.append([f"{cfg['sigla']}-{numero:04d}", oggi, p.dipendente, cfg["tipo"], nome, p.citta, p.provincia,
                          "", "", "", "", "", link, pl, cfg["strumento"], "da contattare", "contatto dal modulo del portale"])
            link_noti.add(link)
            M.scrivi_registro(f"Trovato annuncio privato: {nome} (riga {nuove[-1][0]})")
            M.stato(scritte=len(nuove), rimanenti=p.quota - len(nuove),
                    ultime=([{"id": nuove[-1][0], "nome": nome, "email": "modulo del portale"}] + M.STATO["ultime"])[:5])
            continue
        # profilo Instagram (Brian): l'email si prende solo se è scritta nella bio pubblica mostrata da Google
        if "instagram.com/" in link:
            if not re.match(r"https?://(www\.)?instagram\.com/[A-Za-z0-9_.]+/?$", link):
                scarta("non è un profilo", nome); continue
            email = [e.lower() for e in M.RE_EMAIL.findall(descrizione) if not M.SCARTA_EMAIL.search(e)]
            if not email:
                scarta("nessuna email nella bio pubblica", nome); continue
            if email[0] in email_note:
                scarta("già in un foglio della Ricerca", nome); continue
            numero += 1
            nuove.append([f"{cfg['sigla']}-{numero:04d}", oggi, p.dipendente, cfg["tipo"], nome, p.citta, p.provincia,
                          "", email[0], "", link, "", link, "", cfg["strumento"], "da contattare", "email dalla bio Instagram"])
            email_note.add(email[0])
            M.scrivi_registro(f"Trovato {nome} su Instagram: {email[0]} (riga {nuove[-1][0]})")
            M.stato(scritte=len(nuove), rimanenti=p.quota - len(nuove),
                    ultime=([{"id": nuove[-1][0], "nome": nome, "email": email[0]}] + M.STATO["ultime"])[:5])
            continue
        # 2. il sito ufficiale: se il risultato è già un sito proprio lo usa, altrimenti lo cerca
        sito = "" if e_portale(link) else f"https://{dominio(link)}/"
        if not sito:
            M.stato(attivita=f"Cerca il sito ufficiale di {nome}")
            for ris in google(f'"{nome}" {p.citta}', 10):
                if not e_portale(ris.get("url", "")):
                    sito = f"https://{dominio(ris['url'])}/"; break
        if not sito:
            scarta("sito ufficiale non trovato", nome); continue
        if dominio(sito) in siti_noti:
            scarta("già in un foglio della Ricerca", nome); continue
        # 3. l'email pubblicata sul sito
        M.stato(attivita=f"Legge il sito di {nome}", sitoAttuale=sito, scartati=scarti)
        info = M.leggi_sito(sito)
        M.stato(sitiLetti=M.STATO.get("sitiLetti", 0) + 1)
        if not info["letto"]:
            scarta("sito non raggiungibile", nome); continue
        if not info["email"]:
            scarta("nessuna email pubblica", nome); continue
        if info["email"] in email_note:
            scarta("già in un foglio della Ricerca", nome); continue
        numero += 1
        nuove.append([f"{cfg['sigla']}-{numero:04d}", oggi, p.dipendente, cfg["tipo"], nome, p.citta, p.provincia,
                      sito, info["email"], "", info["instagram"], "", link, info["planimetria"], cfg["strumento"], "da contattare",
                      "" if info["planimetria"] else "planimetria non verificata sul sito"])
        siti_noti.add(dominio(sito)); email_note.add(info["email"])
        M.scrivi_registro(f"Trovato {nome}: {info['email']} (riga {nuove[-1][0]})")
        M.stato(scritte=len(nuove), rimanenti=p.quota - len(nuove),
                ultime=([{"id": nuove[-1][0], "nome": nome, "email": info["email"]}] + M.STATO["ultime"])[:5])
        time.sleep(M.PAUSA_SITO)

    M.stato(attivita="Scrive le righe nel foglio", sitoAttuale="", scartati=scarti)
    if nuove:
        r = M.con_riprova(lambda: M.SESSIONE.post(f"https://sheets.googleapis.com/v4/spreadsheets/{cfg['foglio']}/values/{M.SCHEDA}!A1:append",
                          params={"valueInputOption": "RAW", "insertDataOption": "INSERT_ROWS"}, json={"values": nuove}))
        r.raise_for_status()
    M.stato(inCorso=False, attivita="Finito", fine=datetime.datetime.now().isoformat(timespec="seconds"),
            esito=f"{len(nuove)} righe scritte su quota {p.quota}, {GOOGLE['usate']} ricerche Google, {GOOGLE['saltate']} saltate", scartati=scarti)
    print(json.dumps({"dipendente": p.dipendente, "zona": f"{p.citta} ({p.provincia})", "righe_scritte": len(nuove),
                      "ricerche_google": GOOGLE["usate"], "saltate": GOOGLE["saltate"], "scartati": scarti}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
        chiudi_chrome()
    except SystemExit as e:
        if e.code not in (0, None) and M.FOGLIO["id"]:
            M.stato(inCorso=False, attivita="Fermata per errore", esito=str(e.code), fine=datetime.datetime.now().isoformat(timespec="seconds"))
        raise
    except Exception as e:
        if M.FOGLIO["id"]:
            M.stato(inCorso=False, attivita="Fermata per errore", esito=f"{type(e).__name__}: {e}", fine=datetime.datetime.now().isoformat(timespec="seconds"))
        raise
