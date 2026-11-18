"""MOTORE DELLA LETTURA PLANIMETRIE, Ufficio 1.2 Planimetrie 3D, area Lettura planimetrie (capo area Lucas).

Programma indipendente: legge il materiale scaricato dal repository privato depthx-dati-1.2 e scrive una bolla JSON
per ogni planimetria in _03_BollePerOgniPlanimetria/<ID>/<planimetria>.json, con la sua chiave di accesso separata.

Per ogni planimetria (immagine o PDF, prima pagina):
  1. Tesseract (gratuito) legge le scritte: nomi delle stanze, metri quadri, altezza, quote in metri.
  2. OpenCV trova i muri: linee scure spesse, orizzontali e verticali; i muri perimetrali sono i più spessi.
  3. Le aperture sono i vuoti lungo i muri: sul perimetro finestre e porta d'ingresso, all'interno porte.
  4. Le stanze sono gli spazi chiusi tra i muri; ognuna prende il nome della scritta che contiene.
  5. La scala in metri viene dai metri quadri scritti nelle stanze, poi dalla superficie dell'annuncio, poi da una porta di 0,80 m.
  6. La bolla ha box, muri con aperture, stanze e ordine nel formato del motore (pianta.js), più i controlli di affidabilità.

Uso:  python -I _01_MotoreDellaLettura.py --dati dati [--massimo 50] [--rifai]
"""
import argparse, datetime, glob, json, os, re, subprocess, sys, tempfile, time
import cv2
import numpy as np

STANZE = [  # parola nella planimetria -> (id del motore, pavimento, esterno)
    (r"cucin|angolo cottura|kitchen", ("cucina", "pietra", False)),
    (r"anti.?bagno|bagno|wc|servizi|toilet|bath", ("bagno", "pietra", False)),
    (r"soggiorno|salotto|sala|living|pranzo|giorno", ("soggiorno", "legno", False)),
    (r"matrimonial|camera|letto|notte|bed", ("matrimoniale", "legno", False)),
    (r"camerett", ("cameretta", "legno", False)),
    (r"studio|ufficio", ("studio", "legno", False)),
    (r"ingresso|entrata|hall", ("ingresso", "legno", False)),
    (r"corridoio", ("corridoio", "legno", False)),
    (r"disimpegno|disimp|dis\.", ("disimpegno", "legno", False)),
    (r"ripostiglio|rip\.|lavanderia|cabina|armadi", ("disimpegno", "pietra", False)),
    (r"balcon|terrazz|portico|loggia|veranda|giardino", ("balcone", "pietra", True)),
]
RE_MQ = re.compile(r"(\d+(?:[.,]\d+)?)\s*(?:mq|m2|m²|sqm)", re.I)
RE_ALTEZZA = re.compile(r"\bh\.?\s*(\d[.,]\d{2})", re.I)


def immagine(percorso):
    """Legge l'immagine; per i PDF converte la prima pagina a 200 dpi con pdftoppm."""
    if percorso.lower().endswith(".pdf"):
        with tempfile.TemporaryDirectory() as d:
            subprocess.run(["pdftoppm", "-r", "200", "-png", "-f", "1", "-l", "1", percorso, os.path.join(d, "p")], check=True, capture_output=True)
            png = glob.glob(os.path.join(d, "p*.png"))
            return cv2.imread(png[0]) if png else None
    dati = np.fromfile(percorso, dtype=np.uint8)
    return cv2.imdecode(dati, cv2.IMREAD_COLOR)


def leggi_scritte(img):
    """Tesseract: parole con riquadro. Senza Tesseract la lettura continua senza scritte."""
    try:
        import pytesseract
        d = pytesseract.image_to_data(img, lang="ita+eng", config="--psm 11", output_type=pytesseract.Output.DICT)
    except Exception:
        return []
    out = []
    for i, t in enumerate(d["text"]):
        t = (t or "").strip()
        if t and float(d["conf"][i]) > 40:
            out.append({"testo": t, "x": d["left"][i], "y": d["top"][i], "l": d["width"][i], "a": d["height"][i]})
    return out


def segmenti(maschera, orizzontale, minimo):
    """Linee della maschera come segmenti [x0, y0, x1, y1, spessore] in pixel."""
    out = []
    n, _, st, _ = cv2.connectedComponentsWithStats(maschera)
    for i in range(1, n):
        x, y, l, a, px = st[i]
        if px < 0.6 * l * a:
            continue  # non è una linea dritta (linee oblique, scritte, simboli)
        if orizzontale and l >= minimo:
            out.append([x, y + a / 2, x + l, y + a / 2, a])
        elif not orizzontale and a >= minimo:
            out.append([x + l / 2, y, x + l / 2, y + a, l])
    return out


def muri_e_aperture(img, scritte):
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    nero = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    for s in scritte:  # le scritte non sono muri
        cv2.rectangle(nero, (s["x"] - 2, s["y"] - 2), (s["x"] + s["l"] + 2, s["y"] + s["a"] + 2), 0, -1)
    H, W = g.shape
    lato = max(8, int(min(H, W) * 0.02))
    oriz = cv2.morphologyEx(nero, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (lato, 1)))
    vert = cv2.morphologyEx(nero, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, lato)))
    tutti = segmenti(oriz, True, lato) + segmenti(vert, False, lato)
    if not tutti:
        return [], 0, (0, 0, W, H)
    spessori = np.array([s[4] for s in tutti])
    sottile = max(1.0, float(np.percentile(spessori, 30)))
    # muri: almeno il doppio delle linee sottili (le linee sottili sono confini, arredi, quote)
    muri = [s for s in tutti if s[4] >= 2 * sottile] or [s for s in tutti if s[4] >= np.median(spessori)]
    # la casa è il gruppo di muri con più muri interni: il confine della proprietà è un contorno vuoto
    m = np.zeros((H, W), np.uint8)
    for s in muri:
        cv2.line(m, (int(s[0]), int(s[1])), (int(s[2]), int(s[3])), 255, max(2, int(s[4])))
    m = cv2.dilate(m, np.ones((lato, lato), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    migliore, punti, scelti = None, (-1, -1), []
    for i in range(1, n):
        x, y, l, a, _ = st[i]
        dentro = [s for s in muri if lab[int((s[1] + s[3]) / 2), int((s[0] + s[2]) / 2)] == i]
        interni = sum(1 for s in dentro if min(abs(s[1] - y), abs(s[1] - y - a)) > lato and min(abs(s[0] - x), abs(s[0] - x - l)) > lato)
        if (interni, len(dentro)) > punti:
            migliore, punti, scelti = i, (interni, len(dentro)), dentro
    muri = scelti or muri
    xs = [v for s in muri for v in (s[0], s[2])]; ys = [v for s in muri for v in (s[1], s[3])]
    riquadro = (min(xs), min(ys), max(xs), max(ys))
    return muri, sottile, riquadro


def unisci(muri, toll):
    """Unisce i segmenti sulla stessa linea; i vuoti tra due pezzi diventano aperture."""
    linee = []
    for oriz in (True, False):
        gruppo = sorted([s for s in muri if (s[1] == s[3]) == oriz], key=lambda s: (round((s[1] if oriz else s[0]) / toll), s[0] if oriz else s[1]))
        for s in gruppo:
            fisso, a, b = (s[1], s[0], s[2]) if oriz else (s[0], s[1], s[3])
            for L in linee:
                if L["oriz"] == oriz and abs(L["fisso"] - fisso) <= toll and a <= L["b"] + toll * 8:
                    if a > L["b"] + toll:
                        L["vuoti"].append([L["b"], a])
                    L["b"] = max(L["b"], b); L["t"] = max(L["t"], s[4]); break
            else:
                linee.append({"oriz": oriz, "fisso": fisso, "a": a, "b": b, "t": s[4], "vuoti": []})
    return linee


def stanze_chiuse(img_forma, muri, riquadro):
    H, W = img_forma
    m = np.zeros((H, W), np.uint8)
    for s in muri:
        cv2.line(m, (int(s[0]), int(s[1])), (int(s[2]), int(s[3])), 255, max(2, int(s[4])))
    m = cv2.dilate(m, np.ones((5, 5), np.uint8))  # chiude i vuoti delle porte
    libero = cv2.bitwise_not(m)
    n, lab, st, cen = cv2.connectedComponentsWithStats(libero)
    x0, y0, x1, y1 = riquadro
    area_casa = max(1, (x1 - x0) * (y1 - y0))
    out = []
    for i in range(1, n):
        x, y, l, a, px = st[i]
        if x <= x0 - 2 or y <= y0 - 2 or x + l >= x1 + 2 or y + a >= y1 + 2:
            continue  # fuori dalla casa
        if px < area_casa * 0.01:
            continue
        out.append({"px": int(px), "r": [int(x), int(y), int(x + l), int(y + a)], "c": [float(cen[i][0]), float(cen[i][1])]})
    return out


def superficie_annuncio(scheda):
    m = RE_MQ.findall(scheda or "")
    v = [float(x.replace(",", ".")) for x in m]
    v = [x for x in v if 25 <= x <= 600]
    return max(v) if v else None


def leggi_planimetria(percorso, scheda):
    img = immagine(percorso)
    if img is None:
        return {"stato": "non leggibile", "note": "file non apribile"}
    if max(img.shape[:2]) < 1400:
        k = 1400 / max(img.shape[:2]); img = cv2.resize(img, None, fx=k, fy=k, interpolation=cv2.INTER_CUBIC)
    H, W = img.shape[:2]
    scritte = leggi_scritte(img)
    muri, sottile, riquadro = muri_e_aperture(img, scritte)
    if len(muri) < 4:
        return {"stato": "non è una planimetria", "note": f"muri trovati: {len(muri)}", "immagine": [W, H]}
    toll = max(4.0, sottile * 2)
    linee = unisci(muri, toll)
    stanze = stanze_chiuse((H, W), muri, riquadro)
    # nomi e metri quadri dalle scritte, assegnati alla stanza che le contiene
    for s in scritte:
        cx, cy = s["x"] + s["l"] / 2, s["y"] + s["a"] / 2
        for st in stanze:
            r = st["r"]
            if r[0] <= cx <= r[2] and r[1] <= cy <= r[3]:
                st.setdefault("scritte", []).append(s["testo"])
    piene = []
    for st in stanze:
        testo = " ".join(st.get("scritte", []))
        st["nome_letto"] = testo[:60]
        st["tipo"] = next((v for rx, v in STANZE if re.search(rx, testo, re.I)), None)
        mq = RE_MQ.search(testo)
        st["mq_letti"] = float(mq.group(1).replace(",", ".")) if mq else None
        piene.append(st)
    # scala: metri per pixel
    scala, fonte_scala = None, "assente"
    stime = [(st["mq_letti"] / st["px"]) ** 0.5 for st in piene if st["mq_letti"] and st["px"] > 0]
    if stime:
        scala, fonte_scala = float(np.median(stime)), "metri quadri scritti nelle stanze"
    else:
        sup = superficie_annuncio(scheda)
        px_interni = sum(st["px"] for st in piene)
        if sup and px_interni:
            scala, fonte_scala = (sup / px_interni) ** 0.5, "superficie dell'annuncio"
    vuoti = [v[1] - v[0] for L in linee for v in L["vuoti"]]
    if not scala and vuoti:
        scala, fonte_scala = 0.80 / float(np.median(vuoti)), "porta di 0,80 m"
    if not scala:
        scala, fonte_scala = 10.0 / (riquadro[2] - riquadro[0]), "nessuna: larghezza ipotetica di 10 m"
    x0, y0 = riquadro[0], riquadro[1]
    m = lambda v: round(float(v) * scala, 2)
    perimetro = lambda L: abs(L["fisso"] - (riquadro[1] if L["oriz"] else riquadro[0])) <= toll * 2 or abs(L["fisso"] - (riquadro[3] if L["oriz"] else riquadro[2])) <= toll * 2
    muri_out, ingresso = [], False
    for L in sorted(linee, key=lambda L: -(L["b"] - L["a"])):
        if (L["b"] - L["a"]) * scala < 0.5:
            continue
        esterno = perimetro(L)
        a = [m(L["a"] - x0), m(L["fisso"] - y0)] if L["oriz"] else [m(L["fisso"] - x0), m(L["a"] - y0)]
        b = [m(L["b"] - x0), m(L["fisso"] - y0)] if L["oriz"] else [m(L["fisso"] - x0), m(L["b"] - y0)]
        ap = []
        for v0, v1 in L["vuoti"]:
            lung = (v1 - v0) * scala
            if lung < 0.5 or lung > 3.0:
                continue
            da, a_ = m(v0 - L["a"]), m(v1 - L["a"])
            if esterno and not ingresso and 0.8 <= lung <= 1.3:
                ap.append([da, a_, "blindata", 0, 2.2, 1, 0]); ingresso = True
            elif esterno:
                ap.append([da, a_, "fin", 1.0, 2.2])
            else:
                ap.append([da, a_, "porta", 0, 2.1, 1, 0])
        muri_out.append({"a": a, "b": b, "t": 0.3 if esterno else 0.12, "ap": ap})
    contati, stanze_out = {}, []
    for st in sorted(piene, key=lambda s: -s["px"]):
        tipo = st["tipo"] or (("soggiorno", "legno", False) if not stanze_out else ("disimpegno", "legno", False))
        ident, pav, est = tipo
        if ident == "matrimoniale" and contati.get("matrimoniale"):
            ident = "cameretta"
        contati[ident] = contati.get(ident, 0) + 1
        r = st["r"]
        voce = {"id": ident, "r": [m(r[0] - x0), m(r[1] - y0), m(r[2] - x0), m(r[3] - y0)], "pav": pav,
                "nome_letto": st["nome_letto"], "mq": round(st["px"] * scala * scala, 1), "mq_letti": st["mq_letti"]}
        if est:
            voce["esterno"] = True
        stanze_out.append(voce)
    ordine = list(dict.fromkeys(s["id"] for s in stanze_out if not s.get("esterno")))
    alt = RE_ALTEZZA.search(" ".join(s["testo"] for s in scritte))
    nominate = sum(1 for s in piene if s["tipo"])
    affid = min(100, 20 * (fonte_scala.startswith("metri")) + 15 * (fonte_scala.startswith("superficie")) + 10 * ingresso
                + min(30, 6 * nominate) + min(20, 2 * len(muri_out)) + 20 * bool(stanze_out))
    return {
        "stato": "pronta" if affid >= 70 else "da verificare",
        "affidabilita": affid,
        "immagine": [W, H],
        "scala": {"metri_per_pixel": round(scala, 5), "fonte": fonte_scala},
        "altezza": float(alt.group(1).replace(",", ".")) if alt else 2.7,
        "superficie_annuncio": superficie_annuncio(scheda),
        "scritte_lette": [s["testo"] for s in scritte][:200],
        "pianta": {"modo": "floorview", "box": [0, 0, m(riquadro[2] - x0), m(riquadro[3] - y0)],
                   "muri": muri_out, "stanze": stanze_out, "ordine": ordine},
        "controlli": {"muri": len(muri_out), "stanze": len(stanze_out), "stanze_con_nome": nominate, "porta_ingresso": ingresso,
                      "note": "" if ingresso else "porta d'ingresso non trovata: va indicata prima del render"},
    }


def git(radice, *a):
    return subprocess.run(["git", "-C", radice, *a], capture_output=True, text=True)


def carica(radice, n):
    r = git(radice, "add", "-A", "_03_BollePerOgniPlanimetria")
    if r.returncode:
        print("aggiunta non riuscita:", r.stderr.strip()[:300]); return False
    if not git(radice, "status", "--porcelain").stdout.strip():
        return True
    r = git(radice, "-c", "user.name=DepthX Lettura", "-c", "user.email=outbound@depthxlabs.com", "commit", "-q", "-m", f"Lettura planimetrie: {n} bolle")
    if r.returncode:
        print("commit non riuscito:", (r.stderr or r.stdout).strip()[:300]); return False
    for k in range(8):
        r = git(radice, "push", "-q", "origin", "HEAD:main")
        if r.returncode == 0:
            return True
        print("caricamento rifiutato, riprovo:", r.stderr.strip()[:200])
        git(radice, "pull", "-q", "--rebase", "origin", "main"); time.sleep(3 + 3 * k)
    return False


def main():
    a = argparse.ArgumentParser()
    a.add_argument("--dati", default="dati")
    a.add_argument("--massimo", type=int, default=50)
    a.add_argument("--rifai", action="store_true", help="rifà anche le planimetrie che hanno già la bolla")
    p = a.parse_args()
    mat = os.path.join(p.dati, "_02_MaterialeScaricato")
    piani = sorted(glob.glob(os.path.join(mat, "*", "*", "planimetria_*")))
    fatte = 0
    for f in piani:
        if fatte >= p.massimo:
            break
        fonte, ident, nome = f.replace("\\", "/").split("/")[-3:]
        bolla = os.path.join(p.dati, "_03_BollePerOgniPlanimetria", ident, os.path.splitext(nome)[0] + ".json")
        if os.path.exists(bolla) and not p.rifai:
            continue
        sc = os.path.join(os.path.dirname(f), "scheda.txt")
        scheda = open(sc, encoding="utf-8", errors="replace").read() if os.path.exists(sc) else ""
        try:
            letto = leggi_planimetria(f, scheda)
        except Exception as e:
            letto = {"stato": "errore", "note": f"{type(e).__name__}: {str(e)[:200]}"}
        dati = {"id": ident, "fonte": fonte, "planimetria": f"_02_MaterialeScaricato/{fonte}/{ident}/{nome}",
                "letta_il": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"), "lettore": "Lucas, Tesseract e OpenCV",
                "contatto": {k: v.strip() for k, v in (r.split(":", 1) for r in scheda.splitlines()[:10] if ":" in r)}, **letto}
        os.makedirs(os.path.dirname(bolla), exist_ok=True)
        with open(bolla, "w", encoding="utf-8") as o:
            json.dump(dati, o, ensure_ascii=False, indent=1)
        fatte += 1
        print(f"{ident}/{nome}: {dati['stato']}" + (f", affidabilità {dati.get('affidabilita')}" if "affidabilita" in dati else f", {dati.get('note', '')}"))
    if os.path.isdir(os.path.join(p.dati, ".git")) and fatte:
        print("bolle caricate su GitHub:", carica(p.dati, fatte))
    print(json.dumps({"planimetrie": len(piani), "bolle_nuove": fatte}, ensure_ascii=False))


if __name__ == "__main__":
    main()
