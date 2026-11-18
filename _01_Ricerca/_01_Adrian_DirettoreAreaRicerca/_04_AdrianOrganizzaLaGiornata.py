"""ADRIAN ORGANIZZA IL LAVORO, Ufficio 1.2 Planimetrie 3D, area Ricerca.

Adrian gestisce l'area Ricerca: obiettivi, zone, quote e agenti. Hector coordina il flusso intero.
Il suo strumento è il foglio "_00_ZoneEQuote" (schede Obiettivi, Zone, Ricercatori, Assegnazioni, Quote servizi).
Michele scrive l'obiettivo dal pannello di Adrian nel Centro Gestione; Adrian lo divide tra i suoi ricercatori.

  --fase piano      ogni 3 ore: per ogni obiettivo attivo non ancora raggiunto dà a ogni suo ricercatore libero
                    la prossima zona non ancora fatta, con quota = il minimo tra la sua quota e quanto manca.
                    Senza obiettivi attivi non assegna niente e non consuma minuti.
  --fase controllo  ogni ora: per ogni assegnazione aperta guarda se il ricercatore ha finito, scrive l'esito
                    e le righe scritte davvero (righe del foglio adesso meno righe al momento dell'assegnazione),
                    aggiorna i contatti raggiunti di ogni obiettivo e le quote dei servizi.
Google Sheet: una richiesta ogni 6 secondi, come tutti i dipendenti.
"""
import argparse, datetime, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib
M = importlib.import_module("_01_MotoreDellaRicercaSuMaps")
B = importlib.import_module("_03_MotoreDellaRicercaSuBrave")

ZONE_E_QUOTE = "1Sr9qOixgP9_snFesfBHcBoVSBxW8YKCAIJvPLHmGRIA"
URL = f"https://sheets.googleapis.com/v4/spreadsheets/{ZONE_E_QUOTE}/values"
FOGLI = {**{n: c["foglio"] for n, c in M.RICERCATORI.items()}, **{n: c["foglio"] for n, c in B.RICERCATORI.items()}}
MOTORI = {n: (["maps"] if n in M.RICERCATORI else []) + (["brave"] if n in B.RICERCATORI else []) for n in FOGLI}
# La fonte di ogni ricercatore, cioè la cartella del Download su Drive dove finirà il suo materiale
FONTE = {"Anna": "agenzie", "Max": "agenzie", "Brian": "agenzie", "Mia": "agenzie",
         "Liam": "costruttori", "Mark": "costruttori", "Elen": "costruttori", "Leo": "costruttori",
         "Nora": "portali", "Kera": "casevacanza", "Sam": "progetti", "Tom": "aste"}
ORA = lambda: datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
# Assegnazioni: Data e ora | Ricercatore | Città | Provincia | Quota | Assegnata da | Esito | Righe prima | Obiettivo
# Passaggi al Download: Data e ora | Da | A | Ricercatore | Fonte | Foglio | Prima riga | Ultima riga | Quanti | Stato | Note
# Obiettivi:    Obiettivo | Ricercatori | Contatti da raggiungere | Dal | Entro | Zone | Raggiunti | Stato


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


def piano():
    zone = sorted([z for z in leggi("Zone!A2:E200") if len(z) >= 4 and z[3].strip().lower() == "sì"],
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
        zone_ob = [z for z in zone if not o[5].strip() or z[0].lower() in [c.strip().lower() for c in o[5].split(",")]]
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
            lavori.append(f"{nome}|{z[0]}|{z[1]}|{q}|{'maps' if 'maps' in MOTORI[nome] else ''}|{'brave' if 'brave' in MOTORI[nome] else ''}")
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


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--fase", choices=["piano", "controllo", "chiusura"], required=True)
    f = p.parse_args().fase
    piano() if f == "piano" else controllo()
