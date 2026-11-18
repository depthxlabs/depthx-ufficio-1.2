"""DATI SU CSV, Ufficio 1.2 Planimetrie 3D, Outbound.

Sostituisce i fogli Google: i programmi leggono e scrivono i file CSV del repository privato depthx-dati-1.2,
scaricato nella cartella indicata da DATI_OUTBOUND (su GitHub: "dati").
Ogni foglio diventa un file CSV, ogni scheda del foglio _00_ZoneEQuote un file nella sua cartella:
  _01_ListaCRM/<foglio del ricercatore>.csv          scheda Contatti
  _01_ListaCRM/_00_Stato/<foglio del ricercatore>.csv scheda Stato
  _01_ListaCRM/_00_ZoneEQuote/<scheda>.csv            schede Obiettivi, Zone, Ricercatori, Assegnazioni, PassaggiAlDownload, Download, StatoDownload
Le scritture si registrano come operazioni; alla fine del programma salva() le riapplica sull'ultima versione
del repository e la carica su GitHub, riprovando finché riesce: due programmi insieme non si cancellano mai il lavoro.
Lo stato dal vivo dei dipendenti si pubblica anche come controllo GitHub "Stato <nome>", letto dal Centro Gestione.
"""
import atexit, csv, io, json, os, re, shutil, subprocess, time, urllib.parse

RADICE = os.environ.get("DATI_OUTBOUND", "dati")
CRM = "_01_ListaCRM"
FOGLI = {
    "1Sr9qOixgP9_snFesfBHcBoVSBxW8YKCAIJvPLHmGRIA": "_00_ZoneEQuote",
    "11Xfyu2Q3laVgP5pzw003xML0ZUur_4bq-lac9cb3T-E": "_01_Anna_AgenzieDaMaps",
    "12FYuOBjRHmsMpAw7zQ6xkqBPBNFzjATExikSSiskM08": "_02_Max_AgenzieDagliAnnunciSuiPortali",
    "1oLoNTwnXOpvMdt2OsgD7R_eIxZOiiTo8iyk9dYPVlyA": "_03_Brian_AgentiImmobiliariSingoli",
    "1INosFpaC02tQIKCvgZBUkTWaCceWz7HVa9Ce0ELivSQ": "_04_Nora_PrivatiSuiPortali",
    "1NsTzPQL3q60XnrZTV_DfKqvI56VVFAeJ4wK0ovPBVt0": "_05_Liam_CostruttoriEImpreseEdili",
    "1mnTcNUB9ZG0h12b9tWinbGDKYted-22hxVDB-_qeYwY": "_06_Kera_CaseVacanza",
    "1gV9wtsHOLLpT65YQy85dhO1vcYj3HilvLmFn4ISrsAo": "_07_Ester_AffittiBrevi",
    "1k6ITm11B3cqDor36ZuV_9eFstFSZc3AiT_GVWNp7pi0": "_08_Mark_Architetti",
    "13a46HtzCDMseN8WXiO9JsLx66ADDVUZE71_vHQ-5lFw": "_09_Elen_StudiDiInterni",
    "1RCLlxhoPB2eMDOiY8DeVdGaHXIRVHT8MooE-5RqxiSg": "_10_Leo_Geometri",
    "1-TSOMAI41Km1Y5JH55Kr-W0P3r3bfHCnc80RuKMBspQ": "_11_Tom_AsteImmobiliari",
    "1HpITMZXbXpEdVjUhiShQpH-TARhIjORwzEL2Ie9l1gE": "_12_Sam_ProgettiNonAncoraPronti",
    "1ZduNopPwanAVeuAFMZa12AghAkMyA351-Fswn5-ttyU": "_13_Mia",
}
OPERAZIONI = []          # ("celle", file, riga, colonna, valori) | ("aggiungi", file, valori) | ("file", percorso, contenuto)
STATO_VIVO = {"t": {}, "id": {}}
PAUSA_STATO = 90         # secondi tra due pubblicazioni dello stato dal vivo (limite GitHub: 1.000 richieste all'ora)


def colonna(lettere):
    n = 0
    for c in lettere:
        n = n * 26 + ord(c) - 64
    return n - 1


def file_di(foglio, scheda):
    nome = FOGLI[foglio]
    if nome == "_00_ZoneEQuote":
        return os.path.join(CRM, "_00_ZoneEQuote", scheda + ".csv")
    if scheda == "Contatti":
        return os.path.join(CRM, nome + ".csv")
    if scheda == "Stato":
        return os.path.join(CRM, "_00_Stato", nome + ".csv")
    raise ValueError(f"scheda sconosciuta: {scheda}")


def leggi_file(rel, radice=None):
    p = os.path.join(radice or RADICE, rel)
    if not os.path.exists(p):
        return []
    with open(p, encoding="utf-8", newline="") as f:
        return [r for r in csv.reader(f)]


def scrivi_file(rel, righe, radice=None):
    p = os.path.join(radice or RADICE, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    while righe and not any(righe[-1]):
        righe.pop()
    with open(p, "w", encoding="utf-8", newline="") as f:
        csv.writer(f).writerows(righe)


def testo(v):
    return "" if v is None else str(v)


def applica(op, radice=None):
    if op[0] == "file":
        p = os.path.join(radice or RADICE, op[1])
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "wb") as f:
            f.write(op[2])
        return
    righe = leggi_file(op[1], radice)
    if op[0] == "celle":
        _, _, r0, c0, valori = op
        for i, riga in enumerate(valori):
            while len(righe) <= r0 + i:
                righe.append([])
            dest = righe[r0 + i]
            for j, v in enumerate(riga):
                while len(dest) <= c0 + j:
                    dest.append("")
                dest[c0 + j] = testo(v)
    else:
        while righe and not any(righe[-1]):
            righe.pop()
        righe += [[testo(v) for v in riga] for riga in op[2]]
    scrivi_file(op[1], righe, radice)


class Risposta:
    def __init__(self, dati=None, codice=200):
        self.status_code, self._dati, self.headers = codice, dati or {}, {"Content-Type": "application/json"}

    def json(self):
        return self._dati

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"dati: errore {self.status_code}")


def capisci(url):
    m = re.search(r"/spreadsheets/([A-Za-z0-9_-]+)/values/([^?]+)", url)
    foglio, intervallo = m.group(1), urllib.parse.unquote(m.group(2))
    aggiungi = intervallo.endswith(":append")
    intervallo = intervallo[:-7] if aggiungi else intervallo
    scheda, _, celle = intervallo.partition("!")
    a = re.match(r"([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$", celle or "A1")
    c0, r0 = colonna(a.group(1)), int(a.group(2) or 1) - 1
    if a.group(3) is None:
        c1, r1 = c0, r0                     # una cella sola, per esempio G5
    else:
        c1 = colonna(a.group(3))
        r1 = int(a.group(4)) - 1 if a.group(4) else 10 ** 9   # A2:A arriva fino all'ultima riga
    return foglio, scheda, r0, c0, r1, c1, aggiungi


class Sessione:
    """Risponde come la sessione dei fogli Google (get, put, post), ma lavora sui CSV."""

    def get(self, url, **_):
        foglio, scheda, r0, c0, r1, c1, _ = capisci(url)
        righe = [r[c0:c1 + 1] for r in leggi_file(file_di(foglio, scheda))[r0:r1 + 1]]
        righe = [r[:max([i + 1 for i, v in enumerate(r) if v] + [0])] for r in righe]
        while righe and not righe[-1]:
            righe.pop()
        return Risposta({"values": righe} if righe else {})

    def put(self, url, params=None, json=None, **_):
        foglio, scheda, r0, c0, _, _, _ = capisci(url)
        op = ("celle", file_di(foglio, scheda), r0, c0, (json or {}).get("values", []))
        OPERAZIONI.append(op); applica(op)
        if scheda in ("Stato", "StatoDownload"):
            pubblica_stato(foglio, scheda)
        return Risposta({})

    def post(self, url, params=None, json=None, **_):
        foglio, scheda, *_ = capisci(url)
        op = ("aggiungi", file_di(foglio, scheda), (json or {}).get("values", []))
        OPERAZIONI.append(op); applica(op)
        return Risposta({})


def salva_file(percorso, contenuto):
    """Un file del materiale scaricato o delle bolle: percorso relativo alla radice dei dati."""
    op = ("file", percorso, contenuto)
    OPERAZIONI.append(op); applica(op)


def pubblica_stato(foglio, scheda, forza=False):
    """Lo stato dal vivo come controllo GitHub: una pubblicazione ogni 90 secondi, sempre all'inizio e alla fine."""
    token, repo, sha = os.environ.get("GH_TOKEN"), os.environ.get("GITHUB_REPOSITORY"), os.environ.get("GITHUB_SHA")
    if not (token and repo and sha):
        return
    righe = leggi_file(file_di(foglio, scheda))
    if scheda == "Stato":
        d = {r[0]: (r + [""])[1] for r in righe[1:] if r and r[0]}
        nome = d.get("dipendente", FOGLI[foglio].split("_")[2])
        chiave, fine = nome, d.get("inCorso") == "False"
    else:
        vivo = [r for r in righe[1:] if len(r) > 1 and r[1] == "sì"]
        chiave, fine = "Download", not vivo
        d = {"righe": righe}
    adesso = time.time()
    if not forza and not fine and adesso - STATO_VIVO["t"].get(chiave, 0) < PAUSA_STATO:
        return
    STATO_VIVO["t"][chiave] = adesso
    import requests
    h = {"Authorization": "Bearer " + token, "Accept": "application/vnd.github+json"}
    corpo = {"name": "Stato " + chiave, "head_sha": sha, "status": "completed" if fine else "in_progress",
             "output": {"title": "Stato " + chiave, "summary": json.dumps(d, ensure_ascii=False)[:60000]}}
    if fine:
        corpo["conclusion"] = "success"
    try:
        if chiave in STATO_VIVO["id"]:
            requests.patch(f"https://api.github.com/repos/{repo}/check-runs/{STATO_VIVO['id'][chiave]}", headers=h, json=corpo, timeout=20)
        else:
            r = requests.post(f"https://api.github.com/repos/{repo}/check-runs", headers=h, json=corpo, timeout=20)
            STATO_VIVO["id"][chiave] = r.json().get("id")
    except Exception:
        pass  # lo stato dal vivo non deve mai fermare il lavoro


def git(*a):
    return subprocess.run(["git", "-C", RADICE, *a], capture_output=True, text=True)


def salva(messaggio="Dati Outbound 1.2"):
    """Riapplica le operazioni sull'ultima versione del repository dei dati e la carica, riprovando."""
    if not OPERAZIONI or not os.path.isdir(os.path.join(RADICE, ".git")):
        return True
    ops = list(OPERAZIONI)
    for n in range(8):
        git("fetch", "-q", "origin", "main")
        git("reset", "-q", "--hard", "origin/main")
        for op in ops:
            applica(op)
        git("add", "-A", "--sparse", ".")
        if not git("status", "--porcelain").stdout.strip():
            OPERAZIONI.clear(); return True
        git("-c", "user.name=DepthX Outbound", "-c", "user.email=outbound@depthxlabs.com", "commit", "-q", "-m", messaggio)
        if git("push", "-q", "origin", "HEAD:main").returncode == 0:
            OPERAZIONI.clear(); return True
        time.sleep(3 + 4 * n)
    print("ATTENZIONE: dati non caricati su GitHub dopo 8 tentativi")
    return False


atexit.register(lambda: salva(os.environ.get("MESSAGGIO_DATI", "Dati Outbound 1.2")))
