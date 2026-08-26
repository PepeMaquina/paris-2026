import json, time, urllib.parse, urllib.request, os, sys

UA = "paris-2026-guia/0.1 (uso personal)"
SEED = "data/lugares.seed.json"
OUT  = "data/lugares.geo.json"

cache = {}
if os.path.exists(OUT):
    cache = {x["id"]: x for x in json.load(open(OUT))}

def nominatim(q):
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
        {"q": q, "format": "jsonv2", "limit": 1, "addressdetails": 1})
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)

seed = json.load(open(SEED))
res = []
for i, p in enumerate(seed):
    if p["id"] in cache and cache[p["id"]].get("lat"):
        res.append(cache[p["id"]]); continue
    try:
        data = nominatim(p["q"])
    except Exception as e:
        data = []
        print("ERROR", p["id"], e, file=sys.stderr)
    if data:
        d = data[0]
        p2 = dict(p, lat=round(float(d["lat"]), 6), lon=round(float(d["lon"]), 6),
                  osm=d.get("display_name", "")[:90], tipo_osm=d.get("type", ""))
    else:
        p2 = dict(p, lat=None, lon=None, osm="", tipo_osm="")
    res.append(p2)
    print(f'{i+1:3}/{len(seed)} {p["id"]:32} {p2["lat"]} {p2["lon"]}')
    time.sleep(1.1)

json.dump(res, open(OUT, "w"), ensure_ascii=False, indent=1)
print("escritos", len(res), "en", OUT)
