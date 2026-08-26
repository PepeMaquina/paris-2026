import json, os, html

def decode(s, precision=6):
    """Decodifica el shape de Valhalla (polyline con precision 6)."""
    factor = 10 ** precision
    coords, lat, lon, i = [], 0, 0, 0
    while i < len(s):
        for is_lat in (True, False):
            shift, result = 0, 0
            while True:
                b = ord(s[i]) - 63; i += 1
                result |= (b & 0x1f) << shift; shift += 5
                if b < 0x20: break
            d = ~(result >> 1) if result & 1 else (result >> 1)
            if is_lat: lat += d
            else: lon += d
        coords.append((lat / factor, lon / factor))
    return coords

lug = {x["id"]: x for x in json.load(open("data/lugares.geo.json"))}
dias = json.load(open("data/dias.json"))["dias"]
rutas = {r["id"]: r for r in json.load(open("data/rutas.json"))}
X = html.escape

for d in dias:
    items = d["items"] + d.get("items_tarde", [])
    vistos, wpts = set(), []
    for it in items:
        p = lug[it["lugar"]]
        if p["id"] in vistos: continue
        vistos.add(p["id"])
        wpts.append((p, it))
    trks = [r for r in rutas.values() if r["dia"] == d["id"]]

    g = ['<?xml version="1.0" encoding="UTF-8"?>',
         '<gpx version="1.1" creator="Guia Paris 2026" xmlns="http://www.topografix.com/GPX/1/1">',
         f'<metadata><name>{X(d["fecha"])} {X(d["titulo"])}</name></metadata>']
    for p, it in wpts:
        desc = f'{it["h"]} · {it["tit"]}'
        if it.get("nota"): desc += ". " + it["nota"]
        g.append(f'<wpt lat="{p["lat"]}" lon="{p["lon"]}"><name>{X(it["h"])} {X(p["nombre"])}</name>'
                 f'<desc>{X(desc)}</desc><type>{X(it["tipo"])}</type></wpt>')
    for r in trks:
        g.append(f'<trk><name>{X(lug[r["de"]]["nombre"])} a {X(lug[r["a"]]["nombre"])} '
                 f'({r["metros"]} m, {r["minutos"]} min)</name><trkseg>')
        for la, lo in decode(r["shape"]):
            g.append(f'<trkpt lat="{la:.6f}" lon="{lo:.6f}"/>')
        g.append('</trkseg></trk>')
    g.append('</gpx>')
    open(f'exportables/{d["id"]}.gpx', "w").write("\n".join(g))

# KML unico para Google My Maps, una capa por dia
k = ['<?xml version="1.0" encoding="UTF-8"?>',
     '<kml xmlns="http://www.opengis.net/kml/2.2"><Document>',
     '<name>Paris 1-5 septiembre 2026</name>']
for d in dias:
    k.append(f'<Folder><name>{X(d["fecha"])} · {X(d["titulo"])}</name>')
    vistos = set()
    for it in d["items"] + d.get("items_tarde", []):
        p = lug[it["lugar"]]
        if p["id"] in vistos: continue
        vistos.add(p["id"])
        k.append(f'<Placemark><name>{X(it["h"])} {X(p["nombre"])}</name>'
                 f'<description>{X(it.get("nota","") or it["tit"])}</description>'
                 f'<Point><coordinates>{p["lon"]},{p["lat"]},0</coordinates></Point></Placemark>')
    for r in [r for r in rutas.values() if r["dia"] == d["id"]]:
        pts = " ".join(f"{lo:.6f},{la:.6f},0" for la, lo in decode(r["shape"]))
        k.append(f'<Placemark><name>A pie: {X(lug[r["de"]]["nombre"])} a {X(lug[r["a"]]["nombre"])}</name>'
                 f'<LineString><tessellate>1</tessellate><coordinates>{pts}</coordinates></LineString></Placemark>')
    k.append('</Folder>')
k.append('</Document></kml>')
open("exportables/paris-2026.kml", "w").write("\n".join(k))
print("listo")
