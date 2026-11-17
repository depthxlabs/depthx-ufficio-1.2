"""PROVA DEI PORTALI CON CHROME, Ufficio 1.2 Planimetrie 3D, area Ricerca.

Una sola visita lenta per portale, con Chrome senza finestra, dalle macchine di GitHub.
Per ogni portale dice: risposta, titolo della pagina, se compare un blocco o un captcha, quanti annunci si vedono.
Serve a sapere con quali portali i ricercatori con Chrome possono lavorare (regola 7: mai aggirare i blocchi).
"""
import json, re, time
from playwright.sync_api import sync_playwright

PORTALI = {
    "Immobiliare.it (Max, Nora)": "https://www.immobiliare.it/vendita-case/milano/",
    "Idealista (Max, Sam)": "https://www.idealista.it/vendita-case/milano-milano/",
    "Casa.it (Max)": "https://www.casa.it/vendita/residenziale/milano/",
    "Subito.it Immobili (Nora)": "https://www.subito.it/annunci-lombardia/vendita/appartamenti/milano/",
    "Immobiliare.it nuove costruzioni (Sam)": "https://www.immobiliare.it/nuove-costruzioni/milano/",
    "Airbnb (Kera)": "https://www.airbnb.it/milano-italia/stays",
    "Booking (Kera)": "https://www.booking.com/searchresults.it.html?ss=Milano",
    "Portale Vendite Pubbliche (Tom)": "https://pvp.giustizia.it/pvp/it/lista_annunci.page",
    "Astegiudiziarie.it (Tom)": "https://www.astegiudiziarie.it/",
    "Google ricerca (Brian)": "https://www.google.com/search?q=agente+immobiliare+Milano&hl=it",
    "Instagram profilo pubblico (Brian)": "https://www.instagram.com/explore/search/keyword/?q=agente%20immobiliare%20milano",
}
SEGNI_BLOCCO = re.compile(r"captcha|datadome|are you a robot|sei un robot|access denied|accesso negato|unusual traffic|traffico insolito|verify you are human|verifica di essere|blocked|cloudflare ray id", re.I)

risultati = {}
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(locale="it-IT", user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36", viewport={"width": 1366, "height": 900})
    for nome, url in PORTALI.items():
        pag = ctx.new_page()
        try:
            r = pag.goto(url, wait_until="domcontentloaded", timeout=45000)
            time.sleep(6)
            testo = pag.inner_text("body")[:20000]
            risultati[nome] = {"codice": r.status if r else None, "titolo": pag.title()[:80],
                               "blocco": bool(SEGNI_BLOCCO.search(testo + pag.title())),
                               "planimetria_nel_testo": "planimetri" in testo.lower(),
                               "lunghezza_testo": len(testo)}
        except Exception as e:
            risultati[nome] = {"errore": f"{type(e).__name__}: {str(e)[:120]}"}
        pag.close()
        time.sleep(5)
    b.close()
print(json.dumps(risultati, ensure_ascii=False, indent=1))
