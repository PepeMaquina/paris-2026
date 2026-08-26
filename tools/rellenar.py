import json, time, urllib.parse, urllib.request

UA="paris-2026-guia/0.1 (uso personal)"
RETRY={
 "cafe-de-flore":"Café de Flore, Paris",
 "bon-marche":"Le Bon Marché, Paris",
 "rer-champ-de-mars":"Champ de Mars - Tour Eiffel, Paris",
 "rer-bfm":"Bibliothèque François Mitterrand, métro, Paris",
 "versalles-gran-canal":"Grand Canal, Versailles",
 "versalles-jardines":"Parterre d'Eau, Versailles",
 "marche-aux-fleurs":"Marché aux fleurs Reine Elizabeth II, Paris",
 "louvre-explanada":"Pyramide du Louvre, Paris",
 "saint-paul":"Église Saint-Paul-Saint-Louis, Paris",
 "memorial-shoah":"Mémorial de la Shoah, Paris",
 "hotel-de-sens":"Bibliothèque Forney, Paris",
 "hotel-de-sully":"Hôtel de Sully, Paris",
 "carnavalet":"Musée Carnavalet, Paris",
 "hediard":"21 Place de la Madeleine, Paris",
 "ritz":"Ritz, Place Vendôme, Paris",
}
def nom(q):
    url="https://nominatim.openstreetmap.org/search?"+urllib.parse.urlencode({"q":q,"format":"jsonv2","limit":1})
    with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":UA}),timeout=20) as r:
        return json.load(r)

d=json.load(open('data/lugares.geo.json'))
for x in d:
    if x['id'] in RETRY:
        q=RETRY[x['id']]
        try: data=nom(q)
        except Exception as e: data=[]; print("ERR",x['id'],e)
        if data:
            x['lat']=round(float(data[0]['lat']),6); x['lon']=round(float(data[0]['lon']),6)
            x['osm']=data[0].get('display_name','')[:90]; x['q_usada']=q
        print(f"{x['id']:26} {x['lat']} {x['lon']}  {x.get('osm','')[:55]}")
        time.sleep(1.1)
json.dump(d,open('data/lugares.geo.json','w'),ensure_ascii=False,indent=1)
