"""MOTORE DEL DOWNLOAD, Ufficio 1.2 Planimetrie 3D, area Download (capo area Mike).

Ogni membro della squadra di Mike lavora una sola fonte:
  Kevin  agenzie       (righe di Anna, Max, Brian, Mia)      -> Drive _01_SitiDelleAgenzie
  Rosa   costruttori   (righe di Liam, Mark, Elen, Leo)      -> Drive _02_SitiDiCostruttoriEStudi
  Sara   portali       (righe di Nora)                       -> Drive _03_SubitoImmobiliareIdealista
  Paul   casevacanza   (righe di Kera ed Ester)                     -> Drive _04_BookingECaseVacanza
  Noah   progetti      (righe di Sam)                        -> Drive _05_NuoveCostruzioniECrowdfunding
  Lia    aste          (ferma, come Tom)

Il lavoro arriva da Adrian nella scheda PassaggiAlDownload del foglio _00_ZoneEQuote (Stato "da scaricare").
Per ogni contatto scarica SOLO il minimo necessario e lo manda dritto su Drive, in una cartella col suo ID:
  - scheda.txt: ID, nome, tipo, città, sito, link, email, titolo e descrizione della pagina, testo utile (max 3.000 caratteri);
  - le planimetrie trovate (immagini o PDF con planimetria, pianta, floor plan nel nome o nel testo alternativo), al massimo 4;
  - al massimo 4 foto (prima l'immagine di anteprima og:image, poi le immagini grandi della pagina).
Legge al massimo 3 pagine per contatto (il link e fino a 2 pagine di annunci dello stesso sito), con 3 secondi di pausa.
Mai aggirare blocchi o captcha: se il sito risponde 403 o 429 scrive "bloccato dal sito" e passa oltre.
Scrive ogni contatto scaricato nella scheda Download e il suo stato dal vivo nella scheda StatoDownload (letta dal Centro Gestione).
Google Sheet: una richiesta ogni 6 secondi (regola di tutta l'azienda).

Uso:  python -I _01_MotoreDelDownload.py --dipendente Kevin [--massimo 40]
"""
import argparse, base64, datetime, html, json, os, re, sys, time, urllib.parse
import requests

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(QUI, "..", "..", "_01_Ricerca", "_01_Adrian_DirettoreAreaRicerca"))
import importlib
M = importlib.import_module("_01_MotoreDellaRicercaSuMaps")   # sessione Google Sheet, turni di 6 secondi, riprova

ZQ = "1Sr9qOixgP9_snFesfBHcBoVSBxW8YKCAIJvPLHmGRIA"
URL = f"https://sheets.googleapis.com/v4/spreadsheets/{ZQ}/values"
SQUADRA = {"Kevin": "agenzie", "Rosa": "costruttori", "Sara": "portali", "Paul": "casevacanza", "Noah": "progetti"}
AGENTE = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"
PAUSA = 3
RE_PLAN = re.compile(r"planimetri|pianta|piantina|floor[ _-]?plan|floorplan|layout[ _-]?casa", re.I)
CARTELLA_CHIAVI = r"C:\_02_DepthXSoftware\_01_CentroGestioneDepthX\V1.0(161126_1124)\_01_StrumentiDiLavoroPerIlServer\_01_ChiaviAccessiServiziTerzeParti\_02_Google"

STATO = {"registro": []}


def segreto():
    s = os.environ.get("SEGRETO_DOWNLOAD_DRIVE") or open(os.path.join(CARTELLA_CHIAVI, "_05_SegretoDownloadSuDriveUfficio1.2.txt"), encoding="utf-8").read()
    return s.strip()


def indirizzo_drive():
    u = os.environ.get("INDIRIZZO_DOWNLOAD_DRIVE") or open(os.path.join(CARTELLA_CHIAVI, "_06_IndirizzoAppDownloadSuDrive.txt"), encoding="utf-8").read()
    return u.strip()


def leggi(intervallo, foglio=ZQ):
    r = M.con_riprova(lambda: M.SESSIONE.get(f"https://sheets.googleapis.com/v4/spreadsheets/{foglio}/values/{intervallo}"))
    r.raise_for_status()
    return r.json().get("values", [])


def scrivi(intervallo, valori):
    M.con_riprova(lambda: M.SESSIONE.put(f"{URL}/{intervallo}", params={"valueInputOption": "USER_ENTERED"}, json={"values": valori})).raise_for_status()


def aggiungi(scheda, righe):
    M.con_riprova(lambda: M.SESSIONE.post(f"{URL}/{scheda}!A1:append", params={"valueInputOption": "USER_ENTERED", "insertDataOption": "INSERT_ROWS"},
                                          json={"values": righe})).raise_for_status()


def registro(testo):
    STATO["registro"].insert(0, datetime.datetime.now().strftime("%H:%M:%S") + "  " + testo)
    del STATO["registro"][60:]


ULTIMO_STATO = {"t": 0.0}


def stato(nome, riga_stato, forza=False, **valori):
    """Una riga per dipendente nella scheda StatoDownload: Dipendente | Al lavoro | Attività | Aggiornato | Fatti | Da fare | Fine stimata | Registro"""
    if valori.get("attivita"):
        registro(valori["attivita"])
    STATO.update(valori)
    if not forza and time.time() - ULTIMO_STATO["t"] < 30:
        return
    ULTIMO_STATO["t"] = time.time()
    scrivi(f"StatoDownload!A{riga_stato}:H{riga_stato}", [[nome, "sì" if STATO.get("inCorso") else "no", STATO.get("attivita", ""),
            datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"), STATO.get("fatti", 0), STATO.get("daFare", 0), STATO.get("fineStimata", ""),
            json.dumps(STATO["registro"][:40], ensure_ascii=False)]])


def scarica(url, binario=False):
    try:
        r = requests.get(url, timeout=25, headers={"User-Agent": AGENTE, "Accept-Language": "it-IT"})
        if r.status_code in (403, 429):
            return None, "bloccato"
        if r.status_code != 200:
            return None, f"risposta {r.status_code}"
        if not binario and "text/html" not in r.headers.get("Content-Type", ""):
            return None, "non è una pagina"
        return (r.content if binario else r.text), r.headers.get("Content-Type", "")
    except requests.RequestException as e:
        return None, type(e).__name__


def immagini(pagina, base):
    """Restituisce (planimetrie, foto) come liste di URL assoluti."""
    plan, foto, visti = [], [], set()
    og = re.findall(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)', pagina, re.I)
    for tag in re.findall(r"<img\b[^>]*>", pagina, re.I):
        src = re.search(r'(?:data-src|data-lazy-src|src)=["\']([^"\']+)', tag, re.I)
        if not src or src.group(1).startswith("data:"):
            continue
        u = urllib.parse.urljoin(base, html.unescape(src.group(1)))
        if u in visti or re.search(r"logo|icon|sprite|avatar|placeholder|\.svg|\.gif", u, re.I):
            continue
        visti.add(u)
        (plan if RE_PLAN.search(tag) else foto).append(u)
    for a in re.findall(r'<a\b[^>]+href=["\']([^"\']+\.(?:pdf|jpe?g|png|webp))["\'][^>]*>(.*?)</a>', pagina, re.I | re.S):
        u = urllib.parse.urljoin(base, html.unescape(a[0]))
        if u not in visti and RE_PLAN.search(a[0] + " " + a[1]):
            visti.add(u); plan.append(u)
    return plan, [urllib.parse.urljoin(base, x) for x in og] + foto


def testo_utile(pagina):
    t = re.sub(r"<(script|style|noscript)[\s\S]*?</\1>", " ", pagina, flags=re.I)
    t = html.unescape(re.sub(r"<[^>]+>", " ", t))
    return re.sub(r"\s+", " ", t).strip()[:3000]


def carica(fonte, contatto, nome, contenuto, tipo):
    r = requests.post(indirizzo_drive(), timeout=120, json={"segreto": segreto(), "fonte": fonte, "contatto": contatto, "nome": nome,
                      "tipo": tipo, "base64": base64.b64encode(contenuto).decode()})
    d = r.json() if r.headers.get("Content-Type", "").startswith("application/json") else {"ok": False, "errore": f"risposta {r.status_code}"}
    if not d.get("ok"):
        raise RuntimeError("Drive: " + str(d.get("errore")))
    return d.get("cartella", "")


def lavora_contatto(fonte, c):
    """c: riga del foglio della Ricerca (A:Q). Ritorna (cartella, planimetrie, foto, esito)."""
    c = c + [""] * (17 - len(c))
    ident, nome, tipo, citta, sito, email, link = c[0], c[4], c[3], c[5], c[7], c[8], c[12] or c[7]
    if not link:
        return "", 0, 0, "senza link"
    pagine, testi, piani, fotos = [link], [], [], []
    primo, info = scarica(link)
    if primo is None:
        cartella = carica(fonte, ident, "scheda.txt", scheda(c, "", "", f"pagina non letta: {info}").encode(), "text/plain")
        return cartella, 0, 0, "bloccato dal sito" if info == "bloccato" else f"pagina non letta ({info})"
    titolo = html.unescape((re.search(r"<title[^>]*>(.*?)</title>", primo, re.I | re.S) or [None, ""])[1]).strip()[:200]
    descr = html.unescape((re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']*)', primo, re.I) or [None, ""])[1]).strip()[:400]
    dominio = urllib.parse.urlparse(link).netloc
    for h in re.findall(r'href=["\']([^"\'#]+)["\']', primo, re.I):
        u = urllib.parse.urljoin(link, h)
        if urllib.parse.urlparse(u).netloc == dominio and re.search(r"immobil|annunc|vendita|propert|progett|residenz|appartament|cantier", u, re.I) and u not in pagine:
            pagine.append(u)
        if len(pagine) >= 3:
            break
    p, f = immagini(primo, link); piani += p; fotos += f; testi.append(testo_utile(primo))
    for u in pagine[1:]:
        time.sleep(PAUSA)
        t, _ = scarica(u)
        if t:
            p, f = immagini(t, u); piani += p; fotos += f
    piani = list(dict.fromkeys(piani))[:4]
    fotos = [x for x in dict.fromkeys(fotos) if x not in piani][:4]
    cartella = carica(fonte, ident, "scheda.txt", scheda(c, titolo, descr, " ".join(testi)[:3000], pagine).encode(), "text/plain")
    salvati_p = salvati_f = 0
    for i, u in enumerate(piani, 1):
        dati, tipo_f = scarica(u, binario=True)
        if dati and len(dati) < 15_000_000:
            est = ".pdf" if "pdf" in tipo_f or u.lower().endswith(".pdf") else os.path.splitext(urllib.parse.urlparse(u).path)[1][:5] or ".jpg"
            carica(fonte, ident, f"planimetria_{i}{est}", dati, tipo_f or "application/octet-stream"); salvati_p += 1
        time.sleep(1)
    for i, u in enumerate(fotos, 1):
        dati, tipo_f = scarica(u, binario=True)
        if dati and 20_000 < len(dati) < 10_000_000:
            est = os.path.splitext(urllib.parse.urlparse(u).path)[1][:5] or ".jpg"
            carica(fonte, ident, f"foto_{i}{est}", dati, tipo_f or "image/jpeg"); salvati_f += 1
        time.sleep(1)
    return cartella, salvati_p, salvati_f, "scaricato"


def scheda(c, titolo, descr, testo, pagine=()):
    return "\n".join([f"ID: {c[0]}", f"Nome: {c[4]}", f"Tipo: {c[3]}", f"Città: {c[5]} ({c[6]})", f"Sito: {c[7]}", f"Link: {c[12]}",
                      f"Email: {c[8]}", f"Telefono: {c[9]}", f"Planimetria indicata dalla Ricerca: {c[13]}", f"Trovato da: {c[2]} il {c[1]}",
                      "", f"Titolo della pagina: {titolo}", f"Descrizione: {descr}", "Pagine lette: " + ", ".join(pagine), "", "Testo utile:", testo])


def main():
    a = argparse.ArgumentParser()
    a.add_argument("--dipendente", required=True, choices=list(SQUADRA))
    a.add_argument("--massimo", type=int, default=40, help="contatti al massimo in questo giro")
    p = a.parse_args()
    nome, fonte = p.dipendente, SQUADRA[p.dipendente]
    riga_stato = 2 + list(SQUADRA).index(nome)
    M.FOGLIO["id"] = ""  # il motore della Ricerca non deve scrivere la sua scheda Stato
    STATO.update(inCorso=True, fatti=0, daFare=0, fineStimata="")
    stato(nome, riga_stato, forza=True, attivita="Avvio: legge il lavoro passato da Adrian")
    passaggi = leggi("PassaggiAlDownload!A2:K2000")
    miei = [(i, x + [""] * (11 - len(x))) for i, x in enumerate(passaggi, start=2) if len(x) > 9 and x[4] == fonte and x[9] == "da scaricare"]
    if not miei:
        STATO["inCorso"] = False
        stato(nome, riga_stato, forza=True, attivita="Niente da scaricare: nessun passaggio nuovo da Adrian")
        print(json.dumps({"dipendente": nome, "contatti": 0}, ensure_ascii=False)); return
    lavoro = []
    for i, x in miei:
        foglio = re.search(r"/d/([A-Za-z0-9_-]+)", x[5]).group(1)
        righe = leggi(f"Contatti!A{x[6]}:Q{x[7]}", foglio)
        lavoro.append((i, x, righe))
        scrivi(f"PassaggiAlDownload!J{i}", [["in download"]])
    totale = min(p.massimo, sum(len(r) for _, _, r in lavoro))
    STATO["daFare"] = totale
    inizio, fatti = time.time(), 0
    for i, x, righe in lavoro:
        risultati = []
        for c in righe:
            if fatti >= p.massimo:
                break
            stato(nome, riga_stato, attivita=f"Scarica {c[0]} {c[4] if len(c) > 4 else ''}")
            try:
                cartella, np_, nf, esito = lavora_contatto(fonte, c)
            except Exception as e:
                cartella, np_, nf, esito = "", 0, 0, f"errore: {type(e).__name__}: {str(e)[:120]}"
            fatti += 1
            medio = (time.time() - inizio) / fatti
            STATO.update(fatti=fatti, daFare=totale - fatti,
                         fineStimata=(datetime.datetime.now() + datetime.timedelta(seconds=medio * (totale - fatti))).strftime("%Y-%m-%d %H:%M"))
            registro(f"{c[0]}: {esito}, planimetrie {np_}, foto {nf}")
            risultati.append([datetime.datetime.now().strftime("%Y-%m-%d %H:%M"), nome, c[0], c[4] if len(c) > 4 else "", fonte,
                              cartella, np_, nf, esito, x[3]])
            time.sleep(PAUSA)
        if risultati:
            aggiungi("Download", risultati)
        completo = len(risultati) == len(righe)
        p_tot = sum(r[6] for r in risultati)
        scrivi(f"PassaggiAlDownload!J{i}:K{i}", [["scaricato" if completo else "da scaricare",
               f"{x[10]} · {len(risultati)} contatti scaricati da {nome}, {p_tot} planimetrie"]])
    STATO["inCorso"] = False
    stato(nome, riga_stato, forza=True, attivita=f"Finito: {fatti} contatti scaricati")
    print(json.dumps({"dipendente": nome, "fonte": fonte, "contatti": fatti}, ensure_ascii=False))


if __name__ == "__main__":
    main()
