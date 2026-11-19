"""LAVORO DI UNA SCHEDA, Materiale social (Ufficio 1.2 Planimetrie 3D).

Una parte della coda su una scheda Vast, con controlli rigidi:
  1. noleggio di 2 schede in Europa, resta la prima pronta, l'altra si distrugge subito;
  2. pacco e coda sulla scheda, render con vast_rendi.js (anti tremolio con la soglia SOGLIA_GLITCH);
  3. controllo ogni 15 secondi, sfasato per parte: fine del render, fotogrammi che avanzano, tetto di tempo, tetto di spesa;
  4. scheda bloccata (fotogrammi fermi 2 minuti): si distrugge e i video che mancano passano a una scheda nuova, al massimo 2 volte;
  5. scaricamento dei video e distruzione della scheda, sempre, appena il lavoro finisce.
Uso: python3 _01_LavoroDiUnaScheda.py <parte> <file della parte> <pacco>
Variabili: IMMAGINE, PAESI, FLAG_CHROME, SOGLIA_GLITCH, CREDITO_INIZIO, TETTO_SPESA, GITHUB_RUN_ID, GH_TOKEN, GITHUB_ACTOR.
"""
import json, os, subprocess, sys, time

PARTE, FILE_PARTE, PACCO = sys.argv[1], sys.argv[2], sys.argv[3]
SFASA = int(PARTE) * 3
TETTO_MIN, FERMO_S, TENTATIVI = 15 * 60, 120, 3
USCITA = "uscita"; os.makedirs(USCITA, exist_ok=True)
REGISTRO = []


def scrivi(m):
    r = time.strftime("%H:%M:%S") + " " + m; print(r, flush=True); REGISTRO.append(r)


def vast(*a, prove=6):
    for n in range(prove):
        r = subprocess.run(["vastai", *a], capture_output=True, text=True)
        if "429" not in (r.stdout + r.stderr): return r
        time.sleep(5 + 5 * n + SFASA % 7)
    return r


def credito():
    try: return float(json.loads(vast("show", "user", "--raw").stdout)["credit"])
    except Exception: return None


def spesa_superata():
    c, c0 = credito(), float(os.environ.get("CREDITO_INIZIO") or 0)
    return c is not None and c0 and c0 - c > float(os.environ.get("TETTO_SPESA", "1.5"))


def offerte():
    r = vast("search", "offers", "gpu_name=RTX_4090 num_gpus=1 reliability>0.98 cpu_cores_effective>=16 inet_down>300 disk_space>=30 direct_port_count>=1 rentable=true dph_total<1.0", "-o", "dph+", "--raw")
    try: o = json.loads(r.stdout)
    except Exception: return []
    paesi = os.environ["PAESI"].split()
    return [x for x in o if str(x.get("geolocation", "")).split(",")[-1].strip() in paesi]


def crea(x):
    r = vast("create", "instance", str(x["id"]), "--image", os.environ["IMMAGINE"], "--login", f"-u {os.environ['GITHUB_ACTOR']} -p {os.environ['GH_TOKEN']} ghcr.io",
             "--env", "-e NVIDIA_DRIVER_CAPABILITIES=all", "--disk", "30", "--ssh", "--direct", "--label", f"ms|{os.environ['GITHUB_RUN_ID']}|{PARTE}", "--raw")
    try: return json.loads(r.stdout).get("new_contract")
    except Exception: return None


def distruggi(i):
    for _ in range(4):
        r = vast("destroy", "instance", str(i), "-y")
        if r.returncode == 0: scrivi(f"scheda {i} distrutta"); return
        time.sleep(5)


def ssh_di(i):
    u = vast("ssh-url", str(i)).stdout.strip()
    if not u.startswith("ssh://"): return None
    h, p = u[6:].rsplit(":", 1); return h, p


def S(hp, cmd, t=60):
    return subprocess.run(["ssh", "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=8", "-o", "ServerAliveInterval=15", "-p", hp[1], hp[0], cmd], capture_output=True, text=True, timeout=t)


def noleggia(base):
    o = offerte(); scelte = o[base:base + 2] or o[:2]
    ist = {}
    for x in scelte:
        i = crea(x)
        if i: ist[i] = x; scrivi(f"noleggiata {i} {x.get('gpu_name')} {x.get('geolocation')} {x['dph_total']:.3f} $/h")
    t0, vinta = time.time(), None
    while ist and time.time() - t0 < 300 and not vinta:
        time.sleep(15)
        for i in list(ist):
            hp = ssh_di(i)
            if hp:
                try:
                    if S(hp, "test -x /usr/bin/google-chrome", 20).returncode == 0: vinta = (i, hp); break
                except Exception: pass
    for i in ist:
        if not vinta or i != vinta[0]: distruggi(i)
    if vinta: scrivi(f"scheda {vinta[0]} pronta dopo {int(time.time() - t0)} s")
    return (vinta[0], vinta[1], ist[vinta[0]]) if vinta else None


def video_mancanti(righe):
    fatti = set(os.listdir(USCITA))
    return [r for r in righe if os.path.basename(r.split("|")[3]) not in fatti]


def lavora(hp, righe):
    C = ["scp", "-o", "StrictHostKeyChecking=no", "-P", hp[1]]
    open("coda_scheda.txt", "w").write("\n".join(righe) + "\n")
    subprocess.run(C + [PACCO, "coda_scheda.txt", f"{hp[0]}:/root/"], check=True, timeout=600)
    S(hp, "set -e; mkdir -p /root/lavoro && tar -xzf /root/" + os.path.basename(PACCO) + " -C /root/lavoro; ln -sfn /opt/depthx/node_modules /root/lavoro/_00_Motore/strumenti/node_modules; "
          "cp /root/coda_scheda.txt /root/lavoro/_00_Motore/strumenti/coda_vast.txt; rm -f /root/lavoro/_00_Motore/strumenti/stato.json /root/lavoro/_00_Motore/strumenti/vast_rendi.log; "
          f"cd /root/lavoro/_00_Motore/strumenti && SOGLIA_GLITCH='{os.environ.get('SOGLIA_GLITCH', '0')}' FLAG_CHROME='{os.environ['FLAG_CHROME']}' nohup node vast_rendi.js /root/lavoro coda_vast.txt 12 400 > rendi.out 2>&1 &", 120)
    t0, ultimo, fermo_da, esito, inizio_render = time.time(), -1, time.time(), "finito", None
    time.sleep(20 + SFASA % 15)
    while True:
        r = S(hp, "pgrep -f '[v]ast_rendi.js' >/dev/null && echo vivo; cat /root/lavoro/_00_Motore/strumenti/stato.json 2>/dev/null; echo; wc -l < /root/lavoro/_00_Motore/strumenti/vast_rendi.log 2>/dev/null", 30).stdout
        vivo = r.startswith("vivo"); parti = (r[4:] if vivo else r).strip().split(chr(10))
        try: f = json.loads(chr(10).join(parti[:-1])).get("fotogrammi", 0) if len(parti) > 1 and parti[0].strip() else -1
        except Exception: f = -1
        try: righe_log = int(parti[-1])
        except Exception: righe_log = 0
        if not vivo: break
        if f < 0:  # controllo anti tremolio prima del render: avanza se il registro cresce; al massimo 12 minuti
            if righe_log != ultimo: ultimo, fermo_da = righe_log, time.time()
            if time.time() - t0 > 20 * 60: esito = "bloccata"; scrivi("controllo anti tremolio oltre 20 minuti: scheda bloccata"); break
        else:
            if inizio_render is None: inizio_render, ultimo, fermo_da = time.time(), -2, time.time()
            if f != ultimo: ultimo, fermo_da = f, time.time()
            if time.time() - fermo_da > FERMO_S: esito = "bloccata"; scrivi(f"fotogrammi fermi a {f} da 2 minuti: scheda bloccata"); break
            if time.time() - inizio_render > TETTO_MIN: esito = "tetto di tempo"; scrivi("15 minuti di render: si scarica quello che c'è"); break
        if spesa_superata(): esito = "tetto di spesa"; scrivi("tetto di spesa superato: si ferma"); break
        time.sleep(15)
    scrivi(f"render {esito} dopo {int(time.time() - t0)} s, fotogrammi {ultimo}")
    subprocess.run(C + [f"{hp[0]}:/root/lavoro/_0[12]_*/*/*.mp4", USCITA + "/"], timeout=600)
    subprocess.run(C + [f"{hp[0]}:/root/lavoro/_00_Motore/strumenti/vast_rendi.log", f"{USCITA}/vast_rendi_{PARTE}_{int(time.time())}.log"], timeout=120)
    return esito


def main():
    righe = [l.strip() for l in open(FILE_PARTE, encoding="utf-8") if "|" in l]
    time.sleep(SFASA)
    schede = []
    for tentativo in range(TENTATIVI):
        da_fare = video_mancanti(righe)
        if not da_fare or spesa_superata(): break
        n = noleggia((int(PARTE) - 1) * 2 + tentativo * 16)
        if not n: scrivi("nessuna scheda pronta in 5 minuti"); continue
        i, hp, x = n; schede.append({"istanza": i, "gpu": x.get("gpu_name"), "paese": x.get("geolocation"), "prezzo_ora": x["dph_total"]})
        try: esito = lavora(hp, da_fare)
        except Exception as e: esito = f"errore: {e}"; scrivi(esito)
        finally: distruggi(i)
        schede[-1]["esito"] = esito
        if esito == "finito" or esito.startswith("tetto"): break
        # dopo il blocco si rifanno solo i video senza file e senza NOTGO di tremolio
        log = "".join(open(os.path.join(USCITA, f), errors="replace").read() for f in os.listdir(USCITA) if f.endswith(".log"))
        righe = [r for r in righe if f"{r.split('|')[0]}: NOTGO" not in log]
    json.dump({"parte": PARTE, "schede": schede, "registro": REGISTRO}, open(os.path.join(USCITA, f"schede_{PARTE}.json"), "w"))


if __name__ == "__main__":
    main()
