"""ADRIAN ORGANIZZA IL LAVORO, Ufficio 1.2 Planimetrie 3D, area Ricerca.

Adrian gestisce l'area Ricerca: obiettivi, zone, quote e agenti. Hector coordina il flusso intero.
Il suo strumento è il foglio "_00_ZoneEQuote" (schede Obiettivi, Zone, Ricercatori, Assegnazioni, Quote servizi).
Michele scrive l'obiettivo dal pannello di Adrian nel Centro Gestione; Adrian lo divide tra i suoi ricercatori.

  --fase piano      a ogni giro: per ogni obiettivo attivo non ancora raggiunto dà a ogni suo ricercatore libero
                    la prossima zona che quel ricercatore non ha mai fatto, con quota = il minimo tra la sua quota e quanto manca.
                    Le zone sono tutti i comuni nel raggio della ricerca, dal più vicino; quando un ricercatore li ha fatti tutti
                    il raggio si allarga di 20 km e i comuni nuovi si aggiungono in fondo: nessuna città si ripete.
                    Senza obiettivi attivi non assegna niente e non consuma minuti.
  --fase controllo  ogni ora: per ogni assegnazione aperta guarda se il ricercatore ha finito, scrive l'esito
                    e le righe scritte davvero (righe del foglio adesso meno righe al momento dell'assegnazione),
                    aggiorna i contatti raggiunti di ogni obiettivo e le quote dei servizi.
Google Sheet: una richiesta ogni 6 secondi, come tutti i dipendenti.
"""
import argparse, datetime, json, os, re, sys
import requests
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib
M = importlib.import_module("_01_MotoreDellaRicercaSuMaps")
G = importlib.import_module("_03_MotoreDellaRicercaSuGoogle")

ZONE_E_QUOTE = "1Sr9qOixgP9_snFesfBHcBoVSBxW8YKCAIJvPLHmGRIA"
URL = f"https://sheets.googleapis.com/v4/spreadsheets/{ZONE_E_QUOTE}/values"
FOGLI = {**{n: c["foglio"] for n, c in M.RICERCATORI.items()}, **{n: c["foglio"] for n, c in G.RICERCATORI.items()}}
MOTORI = {n: (["maps"] if n in M.RICERCATORI else []) + (["google"] if n in G.RICERCATORI else []) for n in FOGLI}
# La fonte di ogni ricercatore, cioè la cartella del Download su Drive dove finirà il suo materiale
FONTE = {"Anna": "agenzie", "Max": "agenzie", "Brian": "agenzie", "Mia": "agenzie",
         "Liam": "costruttori", "Mark": "costruttori", "Elen": "costruttori", "Leo": "costruttori",
         "Nora": "portali", "Kera": "casevacanza", "Ester": "casevacanza", "Sam": "progetti", "Tom": "aste"}
ORA = lambda: datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
# Assegnazioni: Data e ora | Ricercatore | Città | Provincia | Quota | Assegnata da | Esito | Righe prima | Obiettivo
# Passaggi al Download: Data e ora | Da | A | Ricercatore | Fonte | Foglio | Prima riga | Ultima riga | Quanti | Stato | Note
# Obiettivi:    Obiettivo | Ricercatori | Contatti da raggiungere | Dal | Entro | Zone | Raggiunti | Stato
# RaggiDelleRicerche: Obiettivo | Città di partenza | Latitudine | Longitudine | Raggio km
PASSO_KM, RAGGIO_INIZIALE_KM, RAGGIO_MASSIMO_KM = 20, 30, 400
AGENTE_WEB = {"User-Agent": "DepthX-Ricerca/1.0 (zone della ricerca)", "Accept": "application/json"}


def leggi(intervallo):
    r = M.con_riprova(lambda: M.SESSIONE.get(f"{URL}/{intervallo}"))
    r.raise_for_status()
    return r.json().get("values", [])


def scrivi(intervallo, valori):
    M.con_riprova(lambda: M.SESSIONE.put(f"{URL}/{intervallo}", params={"valueInputOption": "USER_ENTERED"},
                                         json={"values": valori})).raise_for_status()


def righe_del_foglio(nome):
    r = M.con_riprova(lambda: M.SESSIONE.get(f"https://sheets.googleapis.com/v4/spreadsheets/{FOGLI[nome]}/values/{M.SCHEDA}!A2:A"))
    return len(r.json().get("values", []))


def comuni_intorno(lat, lon, km):
    """Tutti i comuni italiani entro km dal punto, dal più vicino, con la sigla della provincia (Wikidata)."""
    q = ('SELECT ?nome ?sigla ?dist WHERE { SERVICE wikibase:around { ?c wdt:P625 ?pos . '
         f'bd:serviceParam wikibase:center "Point({lon} {lat})"^^geo:wktLiteral . bd:serviceParam wikibase:radius "{km}" . '
         'bd:serviceParam wikibase:distance ?dist . } ?c wdt:P31 wd:Q747074 . ?c wdt:P131 ?prov . ?prov wdt:P395 ?sigla . '
         '?c rdfs:label ?nome . FILTER(lang(?nome)="it") } ORDER BY ?dist LIMIT 3000')
    r = requests.get("https://query.wikidata.org/sparql", params={"query": q, "format": "json"}, headers=AGENTE_WEB, timeout=120)
    r.raise_for_status()
    visti, comuni = set(), []
    for x in r.json()["results"]["bindings"]:
        nome = x["nome"]["value"]
        if nome.lower() not in visti:
            visti.add(nome.lower()); comuni.append((nome, x["sigla"]["value"]))
    return comuni


def allarga_le_zone(o, riga_obiettivo, zone_note):
    """Il raggio della ricerca si allarga di 20 km finché trova comuni nuovi: si aggiungono in fondo alle zone dell'obiettivo."""
    raggi = leggi("RaggiDelleRicerche!A2:E200")
    k = next((n for n, r in enumerate(raggi) if r and r[0] == o[0]), None)
    if k is None:
        partenza = o[5].split(",")[0].strip()
        luogo = requests.get("https://nominatim.openstreetmap.org/search", headers=AGENTE_WEB, timeout=60,
                             params={"city": partenza, "country": "Italia", "format": "jsonv2", "limit": 1}).json()
        if not luogo:
            return []
        r = [o[0], partenza, luogo[0]["lat"], luogo[0]["lon"], str(RAGGIO_INIZIALE_KM)]
    else:
        r = raggi[k] + [""] * (5 - len(raggi[k]))
    gia = {c.strip().lower() for c in o[5].split(",") if c.strip()}
    raggio, nuovi = int(float(r[4] or RAGGIO_INIZIALE_KM)), []
    while not nuovi and raggio < RAGGIO_MASSIMO_KM:
        raggio += PASSO_KM
        nuovi = [(c, s) for c, s in comuni_intorno(r[2], r[3], raggio) if c.lower() not in gia]
    r[4] = str(raggio)
    if os.environ.get("SOLO_PROVA"):
        return nuovi
    if k is None:
        M.con_riprova(lambda: M.SESSIONE.post(f"{URL}/RaggiDelleRicerche!A1:append", params={"valueInputOption": "USER_ENTERED",
                      "insertDataOption": "INSERT_ROWS"}, json={"values": ([["Obiettivo", "Città di partenza", "Latitudine", "Longitudine", "Raggio km"]] if not raggi else []) + [r]})).raise_for_status()
    else:
        scrivi(f"RaggiDelleRicerche!A{k + 2}:E{k + 2}", [r])
    if nuovi:
        scrivi(f"Obiettivi!F{riga_obiettivo}", [[", ".join([o[5]] + [c for c, _ in nuovi])]])
        priorita = max([int(z[4]) for z in zone_note if len(z) > 4 and str(z[4]).isdigit()] + [0])
        note = {z[0].lower() for z in zone_note if z}
        righe = []
        for c, s in nuovi:
            if c.lower() not in note:
                priorita += 1; righe.append([c, s, "", "sì", priorita])
        if righe:
            M.con_riprova(lambda: M.SESSIONE.post(f"{URL}/Zone!A1:append", params={"valueInputOption": "USER_ENTERED",
                          "insertDataOption": "INSERT_ROWS"}, json={"values": righe})).raise_for_status()
    print(f"{o[0]}: raggio {raggio} km, {len(nuovi)} comuni nuovi")
    return nuovi


def piano():
    zone = sorted([z for z in leggi("Zone!A2:E2000") if len(z) >= 4 and z[3].strip().lower() == "sì"],
                  key=lambda z: int(z[4]) if len(z) > 4 and str(z[4]).isdigit() else 999)
    quote = {r[0]: int(r[2]) for r in leggi("Ricercatori!A2:E50")
             if len(r) >= 3 and r[1].strip().lower() == "sì" and str(r[2]).isdigit() and r[0] in FOGLI}
    storia = leggi("Assegnazioni!A2:I2000")
    obiettivi = leggi("Obiettivi!A2:H100")
    occupati = {a[1] for a in storia if len(a) > 6 and a[6] == "assegnata"}
    lavori, nuove = [], []
    for i, o in enumerate(obiettivi, start=2):
        o = o + [""] * (8 - len(o))
        if o[7].strip().lower() != "attivo" or not str(o[2]).isdigit():
            continue
        if o[4] and o[4] < datetime.date.today().isoformat():
            continue  # scaduto
        manca = int(o[2]) - (int(o[6]) if str(o[6]).isdigit() else 0)
        if manca <= 0:
            continue
        chi = list(quote) if o[1].strip().lower() in ("", "tutti") else [n.strip() for n in o[1].split(",") if n.strip() in quote]
        # with the zones of the research (starting city and its surroundings, nearest first) the engines stay there, in that order;
        # without zones, every active city in order of priority
        fatte_da = lambda nome: {a[2] for a in storia if len(a) > 2 and a[1] == nome}
        scelte = [c.strip().lower() for c in o[5].split(",") if c.strip()]
        zone_ob = sorted([z for z in zone if z[0].lower() in scelte], key=lambda z: scelte.index(z[0].lower())) if scelte else zone
        # a free researcher with every zone already done: the radius widens before it is given work, so no city repeats
        if scelte and any(n not in occupati and all(z[0] in fatte_da(n) for z in zone_ob) for n in chi):
            nuovi = allarga_le_zone(o, i, leggi("Zone!A2:E2000"))
            if nuovi:
                o[5] = ", ".join([o[5]] + [c for c, _ in nuovi])
                zone += [[c, s, "", "sì", ""] for c, s in nuovi if c.lower() not in {z[0].lower() for z in zone}]
                scelte = [c.strip().lower() for c in o[5].split(",") if c.strip()]
                zone_ob = sorted([z for z in zone if z[0].lower() in scelte], key=lambda z: scelte.index(z[0].lower()))
        for nome in chi:
            if manca <= 0 or nome in occupati or not zone_ob:
                continue
            fatte = {}
            for a in storia:
                if len(a) > 2 and a[1] == nome:
                    fatte[a[2]] = max(fatte.get(a[2], ""), a[0])
            mai = [z for z in zone_ob if z[0] not in fatte]
            z = mai[0] if mai else min(zone_ob, key=lambda z: fatte.get(z[0], ""))
            q = min(quote[nome], manca)
            manca -= q
            occupati.add(nome)
            lavori.append(f"{nome}|{z[0]}|{z[1]}|{q}|{'maps' if 'maps' in MOTORI[nome] else ''}|{'google' if 'google' in MOTORI[nome] else ''}")
            nuove.append([ORA(), nome, z[0], z[1], q, "Adrian", "assegnata", righe_del_foglio(nome), o[0]])
    if nuove and not os.environ.get("SOLO_PROVA"):
        M.con_riprova(lambda: M.SESSIONE.post(f"{URL}/Assegnazioni!A1:append", params={"valueInputOption": "USER_ENTERED",
                      "insertDataOption": "INSERT_ROWS"}, json={"values": nuove})).raise_for_status()
    print(json.dumps(lavori, ensure_ascii=False, indent=1))
    if os.environ.get("GITHUB_OUTPUT"):
        # niente parentesi graffe: GitHub nasconderebbe l'elenco scambiandolo per un pezzo della chiave Google
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
            f.write("lavori=" + json.dumps(lavori, ensure_ascii=False) + "\n")


def controllo():
    storia = leggi("Assegnazioni!A2:I2000")
    adesso = datetime.datetime.now()
    for i, a in enumerate(storia, start=2):
        a = a + [""] * (9 - len(a))
        if a[6] != "assegnata" or a[1] not in FOGLI:
            continue
        r = M.con_riprova(lambda: M.SESSIONE.get(f"https://sheets.googleapis.com/v4/spreadsheets/{FOGLI[a[1]]}/values/Stato!A2:B50"))
        stato = {x[0]: (x + [""])[1] for x in r.json().get("values", []) if x}
        assegnata = datetime.datetime.strptime(a[0][:16], "%Y-%m-%d %H:%M") if len(a[0]) >= 16 else adesso
        iniziato = stato.get("inizio", "") >= assegnata.strftime("%Y-%m-%dT%H:%M") and stato.get("zona", "").startswith(a[2])
        if iniziato and stato.get("inCorso") == "True":
            continue  # sta ancora lavorando
        if not iniziato and adesso - assegnata < datetime.timedelta(hours=3):
            continue  # non è ancora partito: si aspetta
        if iniziato:
            prima = int(a[7]) if str(a[7]).isdigit() else None
            scritte = righe_del_foglio(a[1]) - prima if prima is not None else None
            esito = f"fatto: {scritte} righe scritte" if scritte is not None else f"fatto: {stato.get('esito', '')}"
            if scritte:
                # Adrian passa a Mike (Download) le righe nuove: riga 1 è l'intestazione, quindi i dati partono dalla 2
                M.con_riprova(lambda: M.SESSIONE.post(f"{URL}/PassaggiAlDownload!A1:append", params={"valueInputOption": "USER_ENTERED",
                              "insertDataOption": "INSERT_ROWS"}, json={"values": [[ORA(), "Adrian", "Mike", a[1], FONTE.get(a[1], ""),
                              f"https://docs.google.com/spreadsheets/d/{FOGLI[a[1]]}/edit", prima + 2, prima + 1 + scritte, scritte,
                              "da scaricare", f"{a[2]}, obiettivo: {a[8]}"]]}))
        else:
            esito = "non ha lavorato"
        scrivi(f"Assegnazioni!G{i}", [[esito]])
        print(a[1], a[2], esito)
    aggiorna_obiettivi()


def aggiorna_obiettivi():
    storia = leggi("Assegnazioni!A2:I2000")
    obiettivi = leggi("Obiettivi!A2:H100")
    for i, o in enumerate(obiettivi, start=2):
        o = o + [""] * (8 - len(o))
        if not o[0]:
            continue
        fatti = sum(int(m.group(1)) for a in storia if len(a) > 8 and a[8] == o[0]
                    for m in [re.match(r"fatto: (\d+) righe", a[6] if len(a) > 6 else "")] if m)
        stato = o[7] or "attivo"
        if str(o[2]).isdigit() and fatti >= int(o[2]) and stato == "attivo":
            stato = "raggiunto"
        scrivi(f"Obiettivi!G{i}:H{i}", [[fatti, stato]])



def stato():
    """Per la ripartenza senza sosta: c'è un obiettivo attivo non raggiunto? quanti passaggi sono ancora da scaricare?"""
    oggi = datetime.date.today().isoformat()
    attivo = any(len(o) >= 8 and o[7].strip().lower() == "attivo" and str(o[2]).isdigit()
                 and int(o[2]) > (int(o[6]) if str(o[6]).isdigit() else 0) and not (o[4] and o[4] < oggi)
                 for o in [o + [""] * (8 - len(o)) for o in leggi("Obiettivi!A2:H100")])
    da_scaricare = sum(1 for p in leggi("PassaggiAlDownload!A2:K5000") if len(p) > 9 and p[9] == "da scaricare")
    print(f"attivo={'si' if attivo else 'no'} da_scaricare={da_scaricare}")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
            f.write("attivo=" + ("si" if attivo else "no") + chr(10) + "da_scaricare=" + str(da_scaricare) + chr(10))

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--fase", choices=["piano", "controllo", "chiusura", "stato"], required=True)
    f = p.parse_args().fase
    piano() if f == "piano" else stato() if f == "stato" else controllo()
