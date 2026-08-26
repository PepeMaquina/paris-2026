import json, time, urllib.request, os, subprocess

UA = {"User-Agent": "paris-2026-guia/0.1", "Content-Type": "application/json"}
OUT = "data/rutas.json"

TRAMOS = [
 ("mar1","saint-germain-des-pres","deux-magots"),
 ("mar1","deux-magots","bon-marche"),
 ("mar1","bon-marche","grande-epicerie"),
 ("mar1","la-motte-picquet","tour-eiffel"),
 ("mar1","tour-eiffel","champ-de-mars"),
 ("mar1","champ-de-mars","trocadero"),
 ("mar1","champ-de-mars","rue-saint-dominique"),
 ("mar1","rue-saint-dominique","rer-champ-de-mars"),
 ("mie2","versailles-rer","versalles-palacio"),
 ("mie2","versalles-palacio","versalles-jardines"),
 ("mie2","versalles-jardines","versalles-gran-canal"),
 ("mie2","versalles-jardines","versailles-rer"),
 ("mie2","place-de-clichy","bouillon-pigalle"),
 ("mie2","bouillon-pigalle","place-blanche"),
 ("mie2","place-blanche","sacre-coeur"),
 ("mie2","sacre-coeur","rue-saint-vincent"),
 ("mie2","rue-saint-vincent","vigne-montmartre"),
 ("mie2","vigne-montmartre","relais-gascon"),
 ("mie2","relais-gascon","metro-abbesses"),
 ("jue3","notre-dame","marche-aux-fleurs"),
 ("jue3","marche-aux-fleurs","conciergerie"),
 ("jue3","conciergerie","hotel-de-ville"),
 ("jue3","louvre-explanada","rue-sainte-anne"),
 ("jue3","rue-sainte-anne","galerie-vivienne"),
 ("jue3","galerie-vivienne","galerie-colbert"),
 ("jue3","galerie-colbert","vert-galant"),
 ("jue3","louvre-explanada","vert-galant"),
 ("jue3","vert-galant","pantheon"),
 ("jue3","pantheon","saint-etienne-du-mont"),
 ("jue3","saint-etienne-du-mont","contrescarpe"),
 ("jue3","contrescarpe","ptit-grec"),
 ("jue3","orsay","saint-germain-des-pres"),
 ("vie4","bastille","hotel-de-sens"),
 ("vie4","hotel-de-sens","as-du-fallafel"),
 ("vie4","bastille","as-du-fallafel"),
 ("vie4","as-du-fallafel","place-des-vosges"),
 ("vie4","place-des-vosges","hotel-de-sully"),
 ("vie4","place-des-vosges","carnavalet"),
 ("vie4","carnavalet","metro-chemin-vert"),
 ("vie4","la-madeleine","place-vendome"),
 ("vie4","place-vendome","opera-garnier"),
 ("vie4","opera-garnier","galeries-lafayette"),
 ("vie4","alchimiste","tour-saint-jacques"),
 ("vie4","hotel-sanso","comme-au-vietnam"),
 ("sab5","invalides-entrada-grenelle","dome-invalides"),
 ("sab5","dome-invalides","pont-alexandre-iii"),
 ("sab5","pont-alexandre-iii","petit-palais"),
 ("sab5","petit-palais","metro-champs-elysees"),
 ("sab5","gare-montparnasse","citylocker-maine"),
]

lug = {x["id"]: x for x in json.load(open("data/lugares.geo.json"))}
hechas = {}
if os.path.exists(OUT):
    hechas = {r["id"]: r for r in json.load(open(OUT))}

def valhalla(a, b):
    # La biblioteca TLS de este Python no negocia con el servidor, asi que va por curl
    body = json.dumps({
        "locations": [{"lat": a["lat"], "lon": a["lon"]}, {"lat": b["lat"], "lon": b["lon"]}],
        "costing": "pedestrian",
        "costing_options": {"pedestrian": {"walking_speed": 4.5}},
        "directions_options": {"units": "kilometers", "language": "es-ES"},
    })
    out = subprocess.run(["curl","-s","-m","30","-X","POST",
        "https://valhalla1.openstreetmap.de/route",
        "-H","Content-Type: application/json",
        "-H","User-Agent: paris-2026-guia/0.1",
        "-d", body], capture_output=True, text=True).stdout
    return json.loads(out)

res = []
for dia, a, b in TRAMOS:
    rid = f"{a}--{b}"
    if rid in hechas:
        res.append(hechas[rid]); continue
    try:
        t = valhalla(lug[a], lug[b])["trip"]
        leg = t["legs"][0]
        pasos = [{"t": m["instruction"], "m": round(m.get("length", 0) * 1000)} for m in leg["maneuvers"]]
        res.append({"id": rid, "dia": dia, "de": a, "a": b,
                    "metros": round(t["summary"]["length"] * 1000),
                    "minutos": round(t["summary"]["time"] / 60, 1),
                    "shape": leg["shape"], "pasos": pasos})
        print(f'{rid:52} {res[-1]["metros"]:5} m  {res[-1]["minutos"]:5} min  {len(pasos)} pasos')
    except Exception as e:
        print("ERROR", rid, e)
    time.sleep(1.2)

json.dump(res, open(OUT, "w"), ensure_ascii=False)
print("\ntramos guardados:", len(res), "de", len(TRAMOS))
