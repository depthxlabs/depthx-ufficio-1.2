"""ADRIAN ORGANIZZA LA GIORNATA, Ufficio 1.2 Planimetrie 3D, area Ricerca.

Adrian gestisce l'area Ricerca: zone, quote e agenti. Hector coordina il flusso intero.
Il foglio "_00_ZoneEQuote" è il suo strumento: il Signore lo cambia quando vuole, Adrian lo segue.

  --fase piano      legge Zone, Ricercatori e Assegnazioni; a ogni ricercatore attivo dà la prossima zona
                    che non ha ancora fatto (prima le priorità più alte; finite tutte, riparte dalla più vecchia),
                    scrive le assegnazioni del giorno e passa l'elenco a GitHub.
  --fase chiusura   a fine giornata legge l'esito di ogni ricercatore dalla sua scheda "Stato"
                    e lo scrive accanto all'assegnazione.
Google Sheet: una richiesta ogni 6 secondi, come tutti i dipendenti.
"""
import argparse, datetime, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib
M = importlib.import_module("_01_MotoreDellaRicercaSuMaps")
B = importlib.import_module("_03_MotoreDellaRicercaSuBrave")

ZONE_E_QUOTE = "1Sr9qOixgP9_snFesfBHcBoVSBxW8YKCAIJvPLHmGRIA"
URL = f"https://sheets.googleapis.com/v4/spreadsheets/{ZONE_E_QUOTE}/values"
FOGLI = {**{n: c["foglio"] for n, c in M.RICERCATORI.items()}, **{n: c["foglio"] for n, c in B.RICERCATORI.items()}}
MOTORI = {n: (["maps"] if n in M.RICERCATORI else []) + (["brave"] if n in B.RICERCATORI else []) for n in FOGLI}


def leggi(scheda):
    r = M.con_riprova(lambda: M.SESSIONE.get(f"{URL}/{scheda}!A2:G1000"))
    r.raise_for_status()
    return r.json().get("values", [])


def piano():
    oggi = datetime.date.today().isoformat()
    zone = sorted([z for z in leggi("Zone") if len(z) >= 4 and z[3].strip().lower() == "sì"],
                  key=lambda z: int(z[4]) if len(z) > 4 and str(z[4]).isdigit() else 999)
    ricercatori = [r for r in leggi("Ricercatori") if len(r) >= 3 and r[1].strip().lower() == "sì"]
    storia = leggi("Assegnazioni")
    if not os.environ.get("SOLO_PROVA") and any(a and a[0] == oggi and len(a) > 6 and a[6] == "assegnata" for a in storia):
        sys.exit("Le assegnazioni di oggi ci sono già: Adrian non assegna due volte lo stesso giorno.")
    lavori, nuove = [], []
    for nome, _, quota, *_ in ricercatori:
        if nome not in FOGLI or not str(quota).isdigit() or int(quota) <= 0 or not zone:
            continue
        fatte = {}
        for a in storia:
            if len(a) > 2 and a[1] == nome:
                fatte[a[2]] = max(fatte.get(a[2], ""), a[0])
        mai = [z for z in zone if z[0] not in fatte]
        z = mai[0] if mai else min(zone, key=lambda z: fatte.get(z[0], ""))
        lavori.append({"dipendente": nome, "citta": z[0], "provincia": z[1], "quota": int(quota),
                       "maps": "maps" in MOTORI[nome], "brave": "brave" in MOTORI[nome]})
        nuove.append([oggi, nome, z[0], z[1], int(quota), "Adrian", "assegnata"])
    if nuove and not os.environ.get("SOLO_PROVA"):
        M.con_riprova(lambda: M.SESSIONE.post(f"{URL}/Assegnazioni!A1:append", params={"valueInputOption": "USER_ENTERED",
                      "insertDataOption": "INSERT_ROWS"}, json={"values": nuove})).raise_for_status()
    print(json.dumps(lavori, ensure_ascii=False, indent=1))
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
            # niente parentesi graffe: GitHub nasconderebbe l'elenco scambiandolo per un pezzo della chiave Google
            voci = [f"{l['dipendente']}|{l['citta']}|{l['provincia']}|{l['quota']}|{'maps' if l['maps'] else ''}|{'brave' if l['brave'] else ''}" for l in lavori]
            f.write("lavori=" + json.dumps(voci, ensure_ascii=False) + "\n")


def chiusura():
    oggi = datetime.date.today().isoformat()
    storia = leggi("Assegnazioni")
    for i, a in enumerate(storia, start=2):
        if len(a) > 6 and a[0] == oggi and a[6] == "assegnata" and a[1] in FOGLI:
            r = M.con_riprova(lambda: M.SESSIONE.get(f"https://sheets.googleapis.com/v4/spreadsheets/{FOGLI[a[1]]}/values/Stato!A2:B50"))
            stato = {x[0]: (x + [""])[1] for x in r.json().get("values", []) if x}
            # vale solo lo stato del lavoro di oggi su quella città: altrimenti il ricercatore non ha lavorato
            if not stato.get("inizio", "").startswith(oggi) or not stato.get("zona", "").startswith(a[2]):
                esito = "non ha lavorato"
            else:
                esito = stato.get("esito") or stato.get("attivita") or "nessuno stato"
            M.con_riprova(lambda: M.SESSIONE.put(f"{URL}/Assegnazioni!G{i}", params={"valueInputOption": "RAW"},
                                                 json={"values": [[f"fatto: {esito}"]]}))
            print(a[1], a[2], esito)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--fase", choices=["piano", "chiusura"], required=True)
    piano() if p.parse_args().fase == "piano" else chiusura()
