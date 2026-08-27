# -*- coding: utf-8 -*-
"""Genera la narracion con la voz del sistema y deja un manifiesto.

Solo rehace los archivos cuyo texto ha cambiado, asi que se puede volver a lanzar
tantas veces como haga falta. Para cambiar de voz: python3 tools/audio.py "Nombre".
"""
import json, os, subprocess, sys, hashlib

VOZ = sys.argv[1] if len(sys.argv) > 1 else "Mónica"
DIR = "audio"
MANIFIESTO = "data/audio.json"

os.makedirs(DIR, exist_ok=True)
viejo = json.load(open(MANIFIESTO)) if os.path.exists(MANIFIESTO) else {}
nuevo = {}

def duracion(ruta):
    try:
        s = subprocess.run(["afinfo", ruta], capture_output=True, text=True).stdout
        for l in s.splitlines():
            if "estimated duration" in l:
                return round(float(l.split(":")[1].strip().split()[0]), 1)
    except Exception:
        pass
    return 0

def genera(clave, texto, titulo):
    ruta = f"{DIR}/{clave}.m4a"
    firma = hashlib.sha1((VOZ + "|" + texto).encode()).hexdigest()[:12]
    if viejo.get(clave, {}).get("firma") == firma and os.path.exists(ruta):
        nuevo[clave] = viejo[clave]
        return False
    subprocess.run(["say", "-v", VOZ, "-o", ruta, "--data-format=aac", texto], check=True)
    nuevo[clave] = {"archivo": ruta, "firma": firma, "voz": VOZ, "titulo": titulo,
                    "seg": duracion(ruta), "kb": round(os.path.getsize(ruta) / 1024)}
    return True

fichas = json.load(open("data/fichas.json"))
lugares = {x["id"]: x for x in json.load(open("data/lugares.geo.json"))}
inter = json.load(open("data/interiores.json"))

hechos = 0
for lid, f in fichas.items():
    if not f.get("audio"):
        continue
    texto = lugares[lid]["nombre"] + ". " + f["corto"] + " " + " ".join(f["largo"])
    if f.get("mirar"):
        texto += " Qué mirar. " + " ".join(f["mirar"])
    if genera("f-" + lid, texto, lugares[lid]["nombre"]):
        hechos += 1
        print("  ficha  ", lid, nuevo["f-" + lid]["seg"], "s")

for lid, bloque in inter.items():
    for t in bloque["tramos"]:
        clave = f"i-{lid}-{t['id']}"
        if genera(clave, t["t"] + ". " + t["x"], t["t"]):
            hechos += 1
            print("  interior", clave, nuevo[clave]["seg"], "s")

json.dump(nuevo, open(MANIFIESTO, "w"), ensure_ascii=False, indent=1)
seg = sum(v["seg"] for v in nuevo.values())
kb = sum(v["kb"] for v in nuevo.values())
print(f"\npistas: {len(nuevo)} | generadas ahora: {hechos} | duración total: {int(seg//60)} min {int(seg%60)} s | tamaño: {kb/1024:.1f} MB")
