"""MOTORE DELLA RICERCA SU MAPS, Ufficio 1.2 Planimetrie 3D, area Ricerca (capo area Adrian).

Lo usano i ricercatori che lavorano con Google Maps e i siti: Anna, Brian, Liam, Ester, Mark, Elen, Leo.
Segue le regole della Ricerca (skill di Adrian, _04_LeRegoleFerree.md):
1. Cerca su Google Places API (New) le parole del ricercatore nella città assegnata.
2. Per ogni risultato apre il sito (pagina principale e fino a due pagine contatti) e prende l'email pubblicata.
3. Scarta chi non ha sito o email pubblica e chi è già in uno qualsiasi dei fogli della Ricerca.
4. Scrive le righe nel foglio del ricercatore fino alla quota e aggiorna la scheda "Stato" letta dal Centro Gestione.

Uso:  python -I _01_MotoreDellaRicercaSuMaps.py --dipendente Anna --citta Brescia --provincia BS --quota 10
Le chiavi arrivano dai segreti di GitHub (variabili d'ambiente) o, sul server DepthX, dai file. Non si stampano mai.
"""
import argparse, datetime, html, json, os, re, sys, time, urllib.parse
import requests
from google.oauth2 import service_account
from google.auth.transport.requests import AuthorizedSession

CARTELLA_CHIAVI = r"C:\_02_DepthXSoftware\_01_CentroGestioneDepthX\V1.0(161126_1124)\_01_StrumentiDiLavoroPerIlServer\_01_ChiaviAccessiServiziTerzeParti\_02_Google"
CHIAVE_MAPS = CARTELLA_CHIAVI + r"\_03_ChiavePlacesUfficio1.2.txt"
CHIAVE_SHEET = CARTELLA_CHIAVI + r"\_02_ChiaveGoogleSheet.json"

# I ricercatori su Maps: parole di ricerca, tipo, sigla dell'ID e foglio Google
RICERCATORI = {
    "Anna":  {"ruolo": "Ricerca agenzie immobiliari da Maps", "parole": ["agenzia immobiliare"], "tipo": "agenzia", "sigla": "ANN",
              "foglio": "11Xfyu2Q3laVgP5pzw003xML0ZUur_4bq-lac9cb3T-E"},
    "Brian": {"ruolo": "Ricerca agenti immobiliari singoli", "parole": ["agente immobiliare", "consulente immobiliare"], "tipo": "agente", "sigla": "BRI",
              "foglio": "1oLoNTwnXOpvMdt2OsgD7R_eIxZOiiTo8iyk9dYPVlyA"},
    "Liam":  {"ruolo": "Ricerca costruttori e imprese edili", "parole": ["impresa edile", "impresa di costruzioni"], "tipo": "costruttore", "sigla": "LIA",
              "foglio": "1NsTzPQL3q60XnrZTV_DfKqvI56VVFAeJ4wK0ovPBVt0"},
    "Ester": {"ruolo": "Ricerca affitti brevi, singoli e gestori", "parole": ["gestione affitti brevi", "property manager affitti brevi"], "tipo": "gestore affitti brevi", "sigla": "EST",
              "foglio": "1gV9wtsHOLLpT65YQy85dhO1vcYj3HilvLmFn4ISrsAo"},
    "Mark":  {"ruolo": "Ricerca architetti", "parole": ["studio di architettura", "architetto"], "tipo": "architetto", "sigla": "MAR",
              "foglio": "1k6ITm11B3cqDor36ZuV_9eFstFSZc3AiT_GVWNp7pi0"},
    "Elen":  {"ruolo": "Ricerca studi di interni", "parole": ["interior design", "studio di interior design"], "tipo": "studio interni", "sigla": "ELE",
              "foglio": "13a46HtzCDMseN8WXiO9JsLx66ADDVUZE71_vHQ-5lFw"},
    "Leo":   {"ruolo": "Ricerca geometri", "parole": ["geometra", "studio tecnico geometra"], "tipo": "geometra", "sigla": "LEO",
              "foglio": "1RCLlxhoPB2eMDOiY8DeVdGaHXIRVHT8MooE-5RqxiSg"},
}
# Tutti i fogli della Ricerca, per il controllo dei doppioni (regola 1)
TUTTI_I_FOGLI = [r["foglio"] for r in RICERCATORI.values()] + [
    "12FYuOBjRHmsMpAw7zQ6xkqBPBNFzjATExikSSiskM08",
    "1INosFpaC02tQIKCvgZBUkTWaCceWz7HVa9Ce0ELivSQ", "1mnTcNUB9ZG0h12b9tWinbGDKYted-22hxVDB-_qeYwY",
    "1-TSOMAI41Km1Y5JH55Kr-W0P3r3bfHCnc80RuKMBspQ", "1HpITMZXbXpEdVjUhiShQpH-TARhIjORwzEL2Ie9l1gE"]
SCHEDA = "Contatti"
AGENTE = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"
PAUSA_SITO = 3  # secondi tra due pagine dello stesso sito (regola 7)
RE_EMAIL = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
SCARTA_EMAIL = re.compile(r"\.(png|jpe?g|gif|webp|svg)$|example\.|sentry|wixpress|domain\.|@2x|yourdomain|email\.(com|it)$|nome\.cognome|mario\.rossi", re.I)


def chiave_maps():
    testo = os.environ.get("CHIAVE_GOOGLE_MAPS") or open(CHIAVE_MAPS, encoding="utf-8-sig").read()
    m = re.findall(r"AIza[0-9A-Za-z_\-]{35}", testo)
    if not m:
        sys.exit("Chiave Google Maps non trovata.")
    return m[0]


def sessione_sheet():
    ambiti = ["https://www.googleapis.com/auth/spreadsheets"]
    if os.environ.get("CHIAVE_GOOGLE_SHEET"):
        cred = service_account.Credentials.from_service_account_info(json.loads(os.environ["CHIAVE_GOOGLE_SHEET"]), scopes=ambiti)
    else:
        cred = service_account.Credentials.from_service_account_file(CHIAVE_SHEET, scopes=ambiti)
    return AuthorizedSession(cred)


SESSIONE = sessione_sheet()
STATO, FOGLIO, ULTIMA = {}, {"id": ""}, {"t": 0.0}


def con_riprova(fare, tentativi=6):
    """Google Sheet a volte risponde 429 (troppe richieste): si aspetta e si riprova, mai perdere le righe."""
    for n in range(tentativi):
        r = fare()
        if r.status_code != 429:
            return r
        time.sleep(10 * (n + 1))
    return r


def stato(**valori):
    """Aggiorna la scheda "Stato" del foglio del ricercatore: il Centro Gestione la legge ogni 3 secondi."""
    STATO.update(valori, aggiornato=datetime.datetime.now().isoformat(timespec="seconds"))
    # al massimo un aggiornamento ogni 5 secondi; l'inizio e la fine si scrivono sempre
    if time.time() - ULTIMA["t"] < 5 and "inCorso" not in valori:
        return
    ULTIMA["t"] = time.time()
    righe = [["Chiave", "Valore"]] + [[k, json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else str(v)] for k, v in STATO.items()]
    try:
        SESSIONE.put(f"https://sheets.googleapis.com/v4/spreadsheets/{FOGLIO['id']}/values/Stato!A1:B50",
                     params={"valueInputOption": "RAW"}, json={"values": righe + [["", ""]] * (50 - len(righe))}, timeout=20)
    except Exception:
        pass  # lo stato non deve mai fermare il lavoro


def cerca_su_maps(parole, citta, chiave, massimo=60):
    campi = "places.displayName,places.websiteUri,places.internationalPhoneNumber,places.addressComponents,nextPageToken"
    visti, risultati = set(), []
    for parola in parole:
        corpo = {"textQuery": f"{parola} {citta}", "languageCode": "it", "regionCode": "IT", "pageSize": 20}
        presi = 0
        while presi < massimo:
            r = requests.post("https://places.googleapis.com/v1/places:searchText", json=corpo, timeout=30,
                              headers={"X-Goog-Api-Key": chiave, "X-Goog-FieldMask": campi})
            if r.status_code != 200:
                sys.exit(f"Places API: HTTP {r.status_code} {r.json().get('error', {}).get('status', '')}")
            d = r.json()
            for pl in d.get("places", []):
                k = pl.get("websiteUri") or pl.get("displayName", {}).get("text", "")
                if k not in visti:
                    visti.add(k); risultati.append(pl)
            presi += len(d.get("places", []))
            if not d.get("nextPageToken"):
                break
            corpo = {**corpo, "pageToken": d["nextPageToken"]}
            time.sleep(2)
    return risultati


def componente(place, tipo, breve=False):
    for c in place.get("addressComponents", []):
        if tipo in c.get("types", []):
            return c.get("shortText" if breve else "longText", "")
    return ""


def scarica(url):
    try:
        r = requests.get(url, timeout=15, headers={"User-Agent": AGENTE})
        if r.status_code == 200 and "text/html" in r.headers.get("Content-Type", ""):
            return r.text
    except requests.RequestException:
        pass
    return ""


def email_dalla_pagina(testo, dominio):
    # i testi d'esempio dei moduli (placeholder="mario.rossi@email.it") non sono email del contatto
    testo = re.sub(r'placeholder\s*=\s*["\'][^"\']*["\']', "", testo, flags=re.I)
    trovate = set(urllib.parse.unquote(m) for m in re.findall(r'mailto:([^"\'?>\s]+)', testo, re.I))
    trovate |= set(RE_EMAIL.findall(html.unescape(testo)))
    trovate = {e.strip().strip(".").lower() for e in trovate if not SCARTA_EMAIL.search(e)}
    return sorted(trovate, key=lambda e: (dominio.split(".")[0] not in e, len(e)))  # prima quelle del dominio del sito


def leggi_sito(sito):
    base = sito if sito.startswith("http") else "https://" + sito
    dominio = urllib.parse.urlparse(base).netloc.replace("www.", "")
    pagine, testi = [base], []
    home = scarica(base)
    if home:
        testi.append(home)
        for h in re.findall(r'href=["\']([^"\']+)["\']', home, re.I):
            if re.search(r"contatt|contact|chi-siamo|dove-siamo", h, re.I):
                u = urllib.parse.urljoin(base, h)
                if dominio in urllib.parse.urlparse(u).netloc and u not in pagine:
                    pagine.append(u)
            if len(pagine) >= 3:
                break
        for u in pagine[1:]:
            time.sleep(PAUSA_SITO)
            t = scarica(u)
            if t:
                testi.append(t)
    tutto = "\n".join(testi)
    email = email_dalla_pagina(tutto, dominio)
    insta = re.search(r'https?://(?:www\.)?instagram\.com/[A-Za-z0-9_.]+/?', tutto)
    return {"email": email[0] if email else "", "instagram": insta.group(0) if insta else "",
            "planimetria": "sì" if re.search(r"planimetri", tutto, re.I) else "", "letto": bool(testi)}


def gia_noti():
    """Siti ed email presenti in tutti i fogli della Ricerca (regola 1: mai doppioni)."""
    siti, email = set(), set()
    for f in TUTTI_I_FOGLI:
        r = con_riprova(lambda: SESSIONE.get(f"https://sheets.googleapis.com/v4/spreadsheets/{f}/values/{SCHEDA}!H2:I"))
        if r.status_code == 200:
            for riga in r.json().get("values", []):
                if riga and riga[0]:
                    siti.add(urllib.parse.urlparse(riga[0]).netloc.replace("www.", ""))
                if len(riga) > 1 and riga[1]:
                    email.add(riga[1].lower())
    return siti, email


def main():
    a = argparse.ArgumentParser()
    a.add_argument("--dipendente", required=True, choices=list(RICERCATORI))
    a.add_argument("--citta", required=True)
    a.add_argument("--provincia", required=True)
    a.add_argument("--quota", type=int, default=10)
    p = a.parse_args()
    cfg = RICERCATORI[p.dipendente]
    FOGLIO["id"] = cfg["foglio"]
    link_foglio = f"https://docs.google.com/spreadsheets/d/{cfg['foglio']}/edit"

    stato(dipendente=p.dipendente, ruolo=cfg["ruolo"], inCorso=True, attivita="Avvio", zona=f"{p.citta} ({p.provincia})",
          quota=p.quota, scritte=0, rimanenti=p.quota, sitiLetti=0, agenzieTrovate=0, scartati={}, sitoAttuale="", ultime=[],
          foglio=link_foglio, inizio=datetime.datetime.now().isoformat(timespec="seconds"), fine="", esito="")
    r = con_riprova(lambda: SESSIONE.get(f"https://sheets.googleapis.com/v4/spreadsheets/{cfg['foglio']}/values/{SCHEDA}!A2:A"))
    r.raise_for_status()
    numero = len(r.json().get("values", []))
    siti_noti, email_note = gia_noti()
    oggi = datetime.date.today().isoformat()
    nuove, scarti = [], {}
    def scarta(motivo):
        scarti[motivo] = scarti.get(motivo, 0) + 1

    stato(attivita=f"Cerca su Google Maps: {', '.join(cfg['parole'])}")
    trovati = cerca_su_maps(cfg["parole"], p.citta, chiave_maps())
    stato(attivita=f"Google Maps: {len(trovati)} risultati, controllo uno per uno", agenzieTrovate=len(trovati))
    for pl in trovati:
        if len(nuove) >= p.quota:
            break
        nome = pl.get("displayName", {}).get("text", "")
        sito = pl.get("websiteUri", "")
        if not sito:
            scarta("senza sito"); continue
        dominio = urllib.parse.urlparse(sito).netloc.replace("www.", "")
        if dominio in siti_noti:
            scarta("già in un foglio della Ricerca"); continue
        stato(attivita=f"Legge il sito di {nome}", sitoAttuale=sito, scartati=scarti)
        info = leggi_sito(sito)
        stato(sitiLetti=STATO.get("sitiLetti", 0) + 1)
        if not info["letto"]:
            scarta("sito non raggiungibile"); continue
        if not info["email"]:
            scarta("nessuna email pubblica"); continue
        if info["email"] in email_note:
            scarta("già in un foglio della Ricerca"); continue
        numero += 1
        nuove.append([f"{cfg['sigla']}-{numero:04d}", oggi, p.dipendente, cfg["tipo"], nome,
                      componente(pl, "locality") or p.citta, componente(pl, "administrative_area_level_2", True) or p.provincia,
                      sito, info["email"], (pl.get("internationalPhoneNumber") or "").replace(" ", ""),
                      info["instagram"], "", sito, info["planimetria"],
                      "Google Places API (New) + sito", "da contattare",
                      "" if info["planimetria"] else "planimetria non verificata sul sito"])
        siti_noti.add(dominio); email_note.add(info["email"])
        stato(scritte=len(nuove), rimanenti=p.quota - len(nuove),
              ultime=([{"id": nuove[-1][0], "nome": nome, "email": info["email"]}] + STATO["ultime"])[:5])
        time.sleep(PAUSA_SITO)

    stato(attivita="Scrive le righe nel foglio", sitoAttuale="", scartati=scarti)
    if nuove:
        r = con_riprova(lambda: SESSIONE.post(f"https://sheets.googleapis.com/v4/spreadsheets/{cfg['foglio']}/values/{SCHEDA}!A1:append",
                          params={"valueInputOption": "RAW", "insertDataOption": "INSERT_ROWS"}, json={"values": nuove}))
        r.raise_for_status()
    stato(inCorso=False, attivita="Finito", fine=datetime.datetime.now().isoformat(timespec="seconds"),
          esito=f"{len(nuove)} righe scritte su quota {p.quota}", scartati=scarti)
    print(json.dumps({"dipendente": p.dipendente, "zona": f"{p.citta} ({p.provincia})", "righe_scritte": len(nuove), "scartati": scarti}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except SystemExit as e:
        if e.code not in (0, None) and FOGLIO["id"]:
            stato(inCorso=False, attivita="Fermata per errore", esito=str(e.code), fine=datetime.datetime.now().isoformat(timespec="seconds"))
        raise
    except Exception as e:
        if FOGLIO["id"]:
            stato(inCorso=False, attivita="Fermata per errore", esito=f"{type(e).__name__}: {e}", fine=datetime.datetime.now().isoformat(timespec="seconds"))
        raise
