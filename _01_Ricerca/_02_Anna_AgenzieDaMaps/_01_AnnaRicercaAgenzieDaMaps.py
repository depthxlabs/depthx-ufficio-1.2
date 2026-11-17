"""ANNA, Ricerca agenzie immobiliari da Google Maps. Ufficio 1.2 Planimetrie 3D, area Ricerca (capo area Adrian).

Cosa fa, seguendo la sua skill e le regole della Ricerca:
1. Cerca con Google Places API (New) "agenzia immobiliare" nella citta' assegnata.
2. Per ogni agenzia apre il sito (pagina principale e pagina contatti) e prende l'email pubblicata.
3. Scarta chi non ha sito o email pubblica e chi e' gia' nel foglio.
4. Scrive le righe nel suo foglio Google (scheda "Contatti"), fino alla quota del giorno.

Uso:  python -I _01_AnnaRicercaAgenzieDaMaps.py --citta Bergamo --provincia BG --quota 10
Le chiavi si leggono dai file, non si stampano mai.
"""
import argparse, datetime, html, json, re, sys, time, urllib.parse
import requests
from google.oauth2 import service_account
from google.auth.transport.requests import AuthorizedSession

CHIAVE_MAPS = r"C:\Users\Administrator\Desktop\1.1\_01_1.1_A_MotoreGestioneAcquisizioneMaterialeClienti\_01_StrumentiDelMotore\_02_ChiaviDiAccessoAServiziDiTerzeParti\_01_ChiaveGoogleMapsApi.md"
CHIAVE_SHEET = r"C:\_02_DepthXSoftware\_01_CentroGestioneDepthX\V1.0(161126_1124)\_01_StrumentiDiLavoroPerIlServer\_01_ChiaviAccessiServiziTerzeParti\_02_Google\_02_ChiaveGoogleSheet.json"
FOGLIO_ANNA = "11Xfyu2Q3laVgP5pzw003xML0ZUur_4bq-lac9cb3T-E"
SCHEDA = "Contatti"
AGENTE = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"
LINK_FOGLIO = "https://docs.google.com/spreadsheets/d/" + FOGLIO_ANNA + "/edit"
PAUSA_SITO = 3  # secondi tra due pagine dello stesso sito (regola 7)
RE_EMAIL = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
SCARTA_EMAIL = re.compile(r"\.(png|jpe?g|gif|webp|svg)$|example\.|sentry|wixpress|domain\.|@2x|yourdomain|email\.com$", re.I)


import os
# Su GitHub Actions le chiavi arrivano dai segreti del repository (variabili d'ambiente);
# sul server di DepthX si leggono dai file. Non si stampano mai.
def chiave_maps():
    testo = os.environ.get("CHIAVE_GOOGLE_MAPS") or open(CHIAVE_MAPS, encoding="utf-8").read()
    m = re.findall(r"AIza[0-9A-Za-z_\-]{35}", testo)
    if not m:
        sys.exit("Chiave Google Maps non trovata nel file.")
    return m[0]


def cerca_agenzie(citta, chiave, massimo=60):
    campi = "places.displayName,places.formattedAddress,places.websiteUri,places.internationalPhoneNumber,places.addressComponents,nextPageToken"
    corpo, risultati = {"textQuery": f"agenzia immobiliare {citta}", "languageCode": "it", "regionCode": "IT", "pageSize": 20}, []
    while len(risultati) < massimo:
        r = requests.post("https://places.googleapis.com/v1/places:searchText", json=corpo, timeout=30,
                          headers={"X-Goog-Api-Key": chiave, "X-Goog-FieldMask": campi})
        if r.status_code != 200:
            sys.exit(f"Places API: HTTP {r.status_code} {r.json().get('error', {}).get('status', '')}")
        d = r.json()
        risultati += d.get("places", [])
        if not d.get("nextPageToken"):
            break
        corpo = {"textQuery": corpo["textQuery"], "languageCode": "it", "regionCode": "IT", "pageSize": 20, "pageToken": d["nextPageToken"]}
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
    # i testi d'esempio dei moduli (placeholder="mario.rossi@email.it") non sono email dell'agenzia
    testo = re.sub(r'placeholder\s*=\s*["\'][^"\']*["\']', "", testo, flags=re.I)
    trovate = set(urllib.parse.unquote(m) for m in re.findall(r'mailto:([^"\'?>\s]+)', testo, re.I))
    trovate |= set(RE_EMAIL.findall(html.unescape(testo)))
    trovate = {e.strip().strip(".").lower() for e in trovate if not SCARTA_EMAIL.search(e)}
    # prima le email dello stesso dominio del sito
    return sorted(trovate, key=lambda e: (dominio not in e, len(e)))


def leggi_sito(sito):
    """Pagina principale e fino a due pagine contatti dello stesso sito."""
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
            "planimetria": "sì" if re.search(r"planimetri", tutto, re.I) else "", "letto": bool(testi), "dominio": dominio}


STATO = {}
def stato(**valori):
    """Aggiorna il file che la scheda di Anna nel Centro Gestione legge ogni pochi secondi."""
    STATO.update(valori, aggiornato=datetime.datetime.now().isoformat(timespec="seconds"))
    # lo stato va nella scheda "Stato" del foglio di Anna: la scheda del Centro Gestione lo legge da lì
    righe = [["Chiave", "Valore"]] + [[k, json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else str(v)] for k, v in STATO.items()]
    try:
        SESSIONE.put(f"https://sheets.googleapis.com/v4/spreadsheets/{FOGLIO_ANNA}/values/Stato!A1:B50",
                     params={"valueInputOption": "RAW"}, json={"values": righe + [["", ""]] * (50 - len(righe))}, timeout=20)
    except Exception:
        pass  # lo stato non deve mai fermare il lavoro


def sessione_sheet():
    ambiti = ["https://www.googleapis.com/auth/spreadsheets"]
    if os.environ.get("CHIAVE_GOOGLE_SHEET"):
        cred = service_account.Credentials.from_service_account_info(json.loads(os.environ["CHIAVE_GOOGLE_SHEET"]), scopes=ambiti)
    else:
        cred = service_account.Credentials.from_service_account_file(CHIAVE_SHEET, scopes=ambiti)
    return AuthorizedSession(cred)


SESSIONE = sessione_sheet()


def righe_presenti(s):
    r = s.get(f"https://sheets.googleapis.com/v4/spreadsheets/{FOGLIO_ANNA}/values/{SCHEDA}!A2:Q")
    r.raise_for_status()
    return r.json().get("values", [])


def main():
    a = argparse.ArgumentParser()
    a.add_argument("--citta", required=True)
    a.add_argument("--provincia", required=True)
    a.add_argument("--quota", type=int, default=10)
    p = a.parse_args()

    stato(dipendente="Anna", ruolo="Ricerca agenzie immobiliari da Maps", inCorso=True, attivita="Avvio",
          zona=f"{p.citta} ({p.provincia})", quota=p.quota, scritte=0, rimanenti=p.quota, sitiLetti=0,
          scartati={}, sitoAttuale="", ultime=[], foglio=LINK_FOGLIO, inizio=datetime.datetime.now().isoformat(timespec="seconds"),
          fine="", esito="")
    s = SESSIONE
    presenti = righe_presenti(s)
    siti_noti = {urllib.parse.urlparse(r[7]).netloc.replace("www.", "") for r in presenti if len(r) > 7 and r[7]}
    email_note = {r[8].lower() for r in presenti if len(r) > 8 and r[8]}
    numero = len(presenti)
    oggi = datetime.date.today().isoformat()

    nuove, scarti = [], {}
    def scarta(motivo):
        scarti[motivo] = scarti.get(motivo, 0) + 1

    stato(attivita="Cerca le agenzie su Google Maps")
    trovate = cerca_agenzie(p.citta, chiave_maps())
    stato(attivita=f"Google Maps: {len(trovate)} agenzie trovate, controllo una per una", agenzieTrovate=len(trovate))
    for pl in trovate:
        if len(nuove) >= p.quota:
            break
        nome = pl.get("displayName", {}).get("text", "")
        sito = pl.get("websiteUri", "")
        if not sito:
            scarta("senza sito"); continue
        dominio = urllib.parse.urlparse(sito).netloc.replace("www.", "")
        if dominio in siti_noti:
            scarta("già nel foglio"); continue
        stato(attivita=f"Legge il sito di {nome}", sitoAttuale=sito, scartati=scarti)
        info = leggi_sito(sito)
        stato(sitiLetti=STATO.get("sitiLetti", 0) + 1)
        if not info["letto"]:
            scarta("sito non raggiungibile"); continue
        if not info["email"]:
            scarta("nessuna email pubblica"); continue
        if info["email"] in email_note:
            scarta("già nel foglio"); continue
        numero += 1
        nuove.append([f"ANN-{numero:04d}", oggi, "Anna", "agenzia", nome,
                      componente(pl, "locality") or p.citta, componente(pl, "administrative_area_level_2", True) or p.provincia,
                      sito, info["email"], (pl.get("internationalPhoneNumber") or "").replace(" ", ""),
                      info["instagram"], "", sito, info["planimetria"],
                      "Google Places API (New) + sito agenzia", "da contattare",
                      "" if info["planimetria"] else "planimetria non verificata sul sito"])
        siti_noti.add(dominio); email_note.add(info["email"])
        stato(scritte=len(nuove), rimanenti=p.quota - len(nuove), ultime=([{"id": nuove[-1][0], "nome": nome, "email": info["email"]}] + STATO["ultime"])[:5])
        time.sleep(PAUSA_SITO)

    stato(attivita="Scrive le righe nel foglio", sitoAttuale="", scartati=scarti)
    if nuove:
        r = s.post(f"https://sheets.googleapis.com/v4/spreadsheets/{FOGLIO_ANNA}/values/{SCHEDA}!A1:append",
                   params={"valueInputOption": "RAW", "insertDataOption": "INSERT_ROWS"}, json={"values": nuove})
        r.raise_for_status()
    stato(inCorso=False, attivita="Finito", fine=datetime.datetime.now().isoformat(timespec="seconds"),
          esito=f"{len(nuove)} righe scritte su quota {p.quota}", scartati=scarti)
    print(json.dumps({"zona": f"{p.citta} ({p.provincia})", "righe_scritte": len(nuove), "scartati": scarti}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except SystemExit as e:
        if e.code not in (0, None):
            stato(inCorso=False, attivita="Fermata per errore", esito=str(e.code), fine=datetime.datetime.now().isoformat(timespec="seconds"))
        raise
    except Exception as e:
        stato(inCorso=False, attivita="Fermata per errore", esito=f"{type(e).__name__}: {e}", fine=datetime.datetime.now().isoformat(timespec="seconds"))
        raise
