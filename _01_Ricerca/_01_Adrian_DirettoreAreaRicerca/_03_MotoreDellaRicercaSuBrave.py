"""MOTORE DELLA RICERCA SU BRAVE, Ufficio 1.2 Planimetrie 3D, area Ricerca (capo area Adrian).

Lo usano i ricercatori che partono dai portali: Max (agenzie presenti sui portali) e Sam (progetti non ancora pronti).
I portali bloccano le visite automatiche, quindi non si aprono mai: si usa Brave Search API, la ricerca ufficiale
che restituisce le pagine dei portali già pubblicate sul web (regola 7: mai aggirare blocchi o captcha).
1. Brave trova le pagine della zona sui portali (agenzie per Max, nuove costruzioni e crowdfunding per Sam).
2. Dal titolo della pagina prende il nome; una seconda ricerca Brave trova il sito ufficiale.
3. Dal sito ufficiale prende l'email pubblicata, con le stesse regole del motore di Maps.
4. Scarta chi non ha sito o email e chi è già in un foglio della Ricerca; scrive fino alla quota.

Brave: credito gratuito di circa 1.000 ricerche al mese. Ogni contatto costa al massimo 2 ricerche.
Uso:  python -I _03_MotoreDellaRicercaSuBrave.py --dipendente Max --citta Milano --provincia MI --quota 10
"""
import argparse, datetime, json, os, re, sys, time, urllib.parse
import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib
M = importlib.import_module("_01_MotoreDellaRicercaSuMaps")  # stato, registro, turni di Google Sheet, lettura dei siti

CHIAVE_BRAVE = r"C:\_02_DepthXSoftware\_01_CentroGestioneDepthX\V1.0(161126_1124)\_01_StrumentiDiLavoroPerIlServer\_01_ChiaviAccessiServiziTerzeParti\_05_Brave\_01_ChiaveBraveSearchUfficio1.2.txt"
PORTALI = ("immobiliare.it", "idealista.it", "casa.it", "subito.it", "wikicasa.it", "walliance.eu", "recrowd.com",
           "concrete-investing.com", "rendimentoetico.it", "facebook.com", "instagram.com", "linkedin.com", "paginegialle.it",
           "youtube.com", "tiktok.com", "google.", "wikipedia.org", "tripadvisor.", "virgilio.it", "kijiji", "trovit.",
           "immobiliare.com", "bakeca.it", "houzz.", "cylex", "infobel", "prontopro.it", "habitissimo.it", "misterimprese.it")

RICERCATORI = {
    "Max": {"ruolo": "Ricerca agenzie dagli annunci sui portali", "tipo": "agenzia", "sigla": "MAX",
            "foglio": "12FYuOBjRHmsMpAw7zQ6xkqBPBNFzjATExikSSiskM08",
            "ricerche": ["site:immobiliare.it/agenzie-immobiliari {citta}", "site:idealista.it/pro {citta} agenzia",
                         "site:casa.it/agenzie {citta}"],
            "strumento": "Brave Search API (pagina agenzia sul portale) + sito"},
    "Sam": {"ruolo": "Ricerca progetti non ancora pronti", "tipo": "progetto non ancora pronto", "sigla": "SAM",
            "foglio": "1HpITMZXbXpEdVjUhiShQpH-TARhIjORwzEL2Ie9l1gE",
            "ricerche": ["site:immobiliare.it/nuove-costruzioni {citta}", "nuova costruzione residenziale {citta} appartamenti in vendita classe A",
                         "nuovo complesso residenziale {citta} cantiere", "site:walliance.eu {citta}", "site:recrowd.com {citta}"],
            "strumento": "Brave Search API (nuove costruzioni e crowdfunding) + sito"},
}
ULTIMA_BRAVE = {"t": 0.0, "usate": 0}


def chiave_brave():
    k = (os.environ.get("CHIAVE_BRAVE_SEARCH") or open(CHIAVE_BRAVE, encoding="utf-8-sig").read()).strip().lstrip("Feff")
    if not k.startswith("BSA"):
        sys.exit("Chiave Brave non trovata.")
    return k


def brave(q, chiave, quanti=20):
    attesa = ULTIMA_BRAVE["t"] + 1.2 - time.time()  # mai più di una ricerca al secondo
    if attesa > 0:
        time.sleep(attesa)
    ULTIMA_BRAVE["t"] = time.time(); ULTIMA_BRAVE["usate"] += 1
    r = requests.get("https://api.search.brave.com/res/v1/web/search", timeout=30,
                     headers={"X-Subscription-Token": chiave, "Accept": "application/json"},
                     params={"q": q, "count": quanti, "country": "IT", "search_lang": "it"})
    if r.status_code == 429:
        M.scrivi_registro("Brave chiede di rallentare: attendo 20 secondi"); time.sleep(20)
        return brave(q, chiave, quanti)
    if r.status_code != 200:
        sys.exit(f"Brave Search: HTTP {r.status_code}")
    return r.json().get("web", {}).get("results", [])


def dominio(u):
    return urllib.parse.urlparse(u).netloc.lower().replace("www.", "")


def e_portale(u):
    d = dominio(u)
    return any(p in d for p in PORTALI)


def nome_dal_titolo(titolo):
    t = re.split(r"\s[|\-–·]\s", titolo)[0]
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
    chiave = chiave_brave()
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
        M.stato(attivita=f"Cerca su Brave: {q}")
        for ris in brave(q, chiave):
            u, nome = ris.get("url", ""), nome_dal_titolo(ris.get("title", ""))
            testo = (ris.get("title", "") + " " + ris.get("description", "")).lower()
            if not nome or nome.lower() in visti or p.citta.lower() not in testo + u.lower():
                continue
            if "immobiliare.it/agenzie-immobiliari/" in u and not re.search(r"/agenzie-immobiliari/\d+/", u):
                continue  # pagina elenco delle agenzie, non una singola agenzia
            visti.add(nome.lower()); candidati.append((nome, u))
    M.stato(attivita=f"Brave: {len(candidati)} candidati, controllo uno per uno", agenzieTrovate=len(candidati))

    for nome, link in candidati:
        if len(nuove) >= p.quota:
            break
        # 2. il sito ufficiale: se il risultato è già un sito proprio lo usa, altrimenti lo cerca
        sito = "" if e_portale(link) else f"https://{dominio(link)}/"
        if not sito:
            M.stato(attivita=f"Cerca il sito ufficiale di {nome}")
            for ris in brave(f'"{nome}" {p.citta}', chiave, 10):
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
            esito=f"{len(nuove)} righe scritte su quota {p.quota}, {ULTIMA_BRAVE['usate']} ricerche Brave usate", scartati=scarti)
    print(json.dumps({"dipendente": p.dipendente, "zona": f"{p.citta} ({p.provincia})", "righe_scritte": len(nuove),
                      "ricerche_brave": ULTIMA_BRAVE["usate"], "scartati": scarti}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except SystemExit as e:
        if e.code not in (0, None) and M.FOGLIO["id"]:
            M.stato(inCorso=False, attivita="Fermata per errore", esito=str(e.code), fine=datetime.datetime.now().isoformat(timespec="seconds"))
        raise
    except Exception as e:
        if M.FOGLIO["id"]:
            M.stato(inCorso=False, attivita="Fermata per errore", esito=f"{type(e).__name__}: {e}", fine=datetime.datetime.now().isoformat(timespec="seconds"))
        raise
