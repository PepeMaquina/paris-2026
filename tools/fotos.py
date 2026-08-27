# -*- coding: utf-8 -*-
"""Una foto identificable por sitio, sacada de Wikipedia y Wikimedia Commons.

Estrategia: la imagen principal del articulo de Wikipedia, que esta elegida
precisamente para reconocer el tema. Si el sitio no tiene articulo, se busca en
Commons exigiendo que el titulo case con el nombre. Todo queda con autor,
licencia y enlace al original, que es lo que obliga la licencia.
"""
import json, os, re, subprocess, sys, time, unicodedata, urllib.parse

UA = "paris-2026-guia/0.1 (uso personal)"
SALIDA = "data/fotos.json"

# articulo de Wikipedia (fr) del que sacar la foto, y pie que explica que se ve
SITIOS = {
 "saint-germain-des-pres": ("Abbaye de Saint-Germain-des-Prés", "La fachada y el campanario románico"),
 "deux-magots": ("Les Deux Magots", "La terraza de Les Deux Magots"),
 "cafe-de-flore": ("Café de Flore", "El Café de Flore, treinta metros más allá"),
 "bon-marche": ("", "Le Bon Marché desde la rue de Sèvres"),
 "tour-eiffel": ("Tour Eiffel", "La torre desde el Champ de Mars"),
 "champ-de-mars": ("Champ-de-Mars", "El Champ de Mars con la torre al fondo"),
 "trocadero": ("Palais de Chaillot", "La explanada del Trocadéro"),
 "versalles-palacio": ("Galerie des Glaces", "La Galería de los Espejos"),
 "versalles-jardines": ("Jardins du château de Versailles", "El eje central desde el palacio"),
 "sacre-coeur": ("Basilique du Sacré-Cœur de Montmartre", "La basílica desde el atrio"),
 "moulin-rouge": ("Moulin Rouge", "El Moulin Rouge en la Place Blanche"),
 "place-blanche": ("Moulin Rouge", "El punto de encuentro, delante del molino"),
 "deux-moulins": ("Café des Deux Moulins", "El café de Amélie, en la rue Lepic"),
 "bateau-lavoir": ("Bateau-Lavoir", "La fachada del Bateau-Lavoir"),
 "moulin-galette": ("Moulin de la Galette", "El molino, desde la rue Lepic"),
 "maison-rose": ("La Maison Rose", "La casa rosa de la rue de l'Abreuvoir"),
 "lapin-agile": ("Au Lapin Agile", "El cabaré, con su letrero del conejo"),
 "vigne-montmartre": ("Clos Montmartre", "La viña de la ladera norte"),
 "place-du-tertre": ("Place du Tertre", "La plaza con los retratistas"),
 "notre-dame": ("Cathédrale Notre-Dame de Paris", "La catedral desde la explanada"),
 "marche-aux-fleurs": ("Marché aux fleurs Reine-Elizabeth-II", "Los pabellones del mercado"),
 "conciergerie": ("Conciergerie", "La fachada desde el muelle"),
 "sainte-chapelle": ("Sainte-Chapelle", "Las vidrieras de la capilla alta"),
 "hotel-de-ville": ("Hôtel de ville de Paris", "La fachada del ayuntamiento"),
 "pont-neuf": ("Pont Neuf", "El puente, con sus arcos y sus máscaras"),
 "pont-des-arts": ("Pont des Arts", "La pasarela de hierro"),
 "louvre-explanada": ("Pyramide du Louvre", "La pirámide en la Cour Napoléon"),
 "tuileries": ("Jardin des Tuileries", "El jardín hacia la Concorde"),
 "galerie-vivienne": ("Galerie Vivienne", "El pasaje y sus mosaicos"),
 "galerie-colbert": ("Galerie Colbert", "La rotonda acristalada"),
 "vert-galant": ("Square du Vert-Galant", "La punta de la isla, a ras de agua"),
 "pantheon": ("Panthéon (Paris)", "El pórtico y la cúpula de Soufflot"),
 "saint-etienne-du-mont": ("Église Saint-Étienne-du-Mont", "El jubé que cruza la nave"),
 "rue-mouffetard": ("Rue Mouffetard", "La calle de mercado, bajando"),
 "contrescarpe": ("Place de la Contrescarpe", "La plaza y sus terrazas"),
 "orsay": ("", "La nave de la antigua estación"),
 "cluny": ("", "El palacio medieval de los abades"),
 "saint-paul": ("Église Saint-Paul-Saint-Louis", "La fachada barroca de la rue Saint-Antoine"),
 "memorial-shoah": ("", "El Muro de los Nombres"),
 "rue-des-rosiers": ("Rue des Rosiers", "La calle del barrio judío"),
 "as-du-fallafel": ("Rue des Rosiers", "La rue des Rosiers a mediodía"),
 "hotel-de-sens": ("Hôtel de Sens", "La casa medieval con sus torreones"),
 "hotel-de-sully": ("Hôtel de Sully", "El patio de honor"),
 "place-des-vosges": ("Place des Vosges", "Los pabellones de ladrillo y los soportales"),
 "bastille": ("Colonne de Juillet", "La columna de Julio en la plaza"),
 "carnavalet": ("Musée Carnavalet", "El patio del palacio renacentista"),
 "la-madeleine": ("Église de la Madeleine", "Las 52 columnas corintias"),
 "place-vendome": ("Place Vendôme", "La columna y las fachadas de Hardouin-Mansart"),
 "ritz": ("Ritz Paris", "El Ritz, en el número 15"),
 "opera-garnier": ("Palais Garnier", "La fachada de Charles Garnier"),
 "galeries-lafayette": ("", "La cúpula de vidriera de 1912"),
 "tour-saint-jacques": ("Tour Saint-Jacques", "La torre sola, en su jardín"),
 "alchimiste": ("Tour Saint-Jacques", "La torre, junto al bar"),
 "invalides": ("Hôtel des Invalides", "El conjunto desde la explanada"),
 "invalides-entrada-grenelle": ("Hôtel des Invalides", "El patio de honor"),
 "dome-invalides": ("Dôme des Invalides", "El Domo dorado de Hardouin-Mansart"),
 "pont-alexandre-iii": ("Pont Alexandre-III", "El puente con sus famas doradas"),
 "petit-palais": ("Petit Palais", "El jardín interior con el peristilo"),
 "grand-palais": ("Grand Palais", "La nave de hierro y cristal"),
 "gare-montparnasse": ("Accident ferroviaire de la gare Montparnasse", "El accidente de 1895 en la estación vieja"),
 "comme-au-vietnam": ("Quartier asiatique de Paris", "El barrio asiático del distrito 13"),
 "bnf-richelieu": ("Site Richelieu de la Bibliothèque nationale de France", "La fachada de la rue de Richelieu"),
 "rue-saint-vincent": ("Clos Montmartre", "La calle de la ladera norte"),
 "casa-van-gogh": ("", "El portal del 54 de la rue Lepic"),
 "conciergerie": ("Conciergerie", "La fachada desde el muelle del Reloj"),
 "deux-moulins": ("", "El café de Amélie, en la rue Lepic"),
 "la-madeleine": ("Église de la Madeleine", "Las 52 columnas corintias"),
 "place-vendome": ("Place Vendôme", "La columna y las fachadas"),
 "saint-etienne-du-mont": ("Église Saint-Étienne-du-Mont", "La fachada, pegada al Panteón"),
 "rue-mouffetard": ("Rue Mouffetard", "La calle de mercado"),
 "rue-des-rosiers": ("Rue des Rosiers", "La calle del barrio judío"),
 "as-du-fallafel": ("", "L'As du Fallafel, en el 34"),
 "village-saint-paul": ("Village Saint-Paul", "Uno de los patios de anticuarios"),
 "place-du-tertre": ("Place du Tertre", "La plaza con los retratistas"),
 "champ-de-mars": ("Champ-de-Mars", "El Champ de Mars con la torre"),
 "invalides": ("Hôtel des Invalides", "El conjunto desde la explanada"),
 "invalides-entrada-grenelle": ("", "El patio de honor de los Inválidos"),
 "bouillon-pigalle": ("", "Bouillon Pigalle, en el bulevar de Clichy"),
 "relais-gascon": ("", "La rue des Abbesses"),
 "rue-sainte-anne": ("", "La rue Sainte-Anne, la calle japonesa"),
 "rue-saint-dominique": ("", "La rue Saint-Dominique con la torre al fondo"),
 "grand-palais": ("", "La nave del Grand Palais"),
 "bnf-richelieu": ("", "La fachada de la BnF Richelieu"),
}

COMMONS = {
 "bon-marche": "Le Bon Marché Paris building", "orsay": "Musée d'Orsay nef",
 "cluny": "Hôtel de Cluny Paris", "memorial-shoah": "Mémorial de la Shoah mur des noms",
 "galeries-lafayette": "Coupole Galeries Lafayette", "casa-van-gogh": "54 rue Lepic Paris",
 "deux-moulins": "Café des Deux Moulins", "as-du-fallafel": "As du Fallafel",
 "invalides-entrada-grenelle": "Cour d'honneur des Invalides",
 "bouillon-pigalle": "Bouillon Pigalle", "relais-gascon": "Rue des Abbesses Paris",
 "rue-sainte-anne": "Rue Sainte-Anne Paris", "rue-saint-dominique": "Rue Saint-Dominique Paris",
 "grand-palais": "Grand Palais nef", "bnf-richelieu": "Bibliothèque nationale rue de Richelieu",
}

MALAS = re.compile(r"logo|plaque|panneau|street sign|\bcarte\b|\bmap\b|blason|coat of arms|diagram|schéma|\.svg$", re.I)

def limpio(t):
    t = unicodedata.normalize("NFD", t.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9 ]", " ", t)

def busca_commons(termino):
    r = api("commons.wikimedia.org", {"action": "query", "format": "json", "list": "search",
            "srsearch": termino, "srnamespace": 6, "srlimit": 12})
    palabras = [p for p in limpio(termino).split() if len(p) > 3]
    mejor = None
    for x in r.get("query", {}).get("search", []):
        t = x["title"]
        if MALAS.search(t):
            continue
        n = sum(1 for p in palabras if p in limpio(t))
        if palabras and n / len(palabras) >= .6:
            mejor = t[5:]
            break
    return mejor

def api(host, params):
    url = f"https://{host}/w/api.php?" + urllib.parse.urlencode(params)
    for intento in range(4):
        out = subprocess.run(["curl", "-s", "-m", "30", "-H", f"User-Agent: {UA}", url],
                             capture_output=True, text=True).stdout
        try:
            d = json.loads(out); time.sleep(.5); return d
        except Exception:
            time.sleep(2 + 2 * intento)
    return {}

def foto_de_articulo(titulo):
    r = api("fr.wikipedia.org", {"action": "query", "format": "json", "titles": titulo,
            "prop": "pageimages", "piprop": "original|name", "redirects": 1})
    for pg in r.get("query", {}).get("pages", {}).values():
        if pg.get("original"):
            return pg["original"]["source"], pg.get("pageimage", "")
    return None, None

def licencia_de(archivo):
    r = api("commons.wikimedia.org", {"action": "query", "format": "json",
            "titles": "File:" + archivo, "prop": "imageinfo",
            "iiprop": "url|extmetadata", "iiurlwidth": 1000})
    for pg in r.get("query", {}).get("pages", {}).values():
        ii = (pg.get("imageinfo") or [{}])[0]
        m = ii.get("extmetadata", {})
        return {
            "url": ii.get("thumburl") or ii.get("url", ""),
            "pagina": ii.get("descriptionurl", ""),
            "autor": re.sub(r"<[^>]+>", "", m.get("Artist", {}).get("value", "")).strip()[:70],
            "licencia": m.get("LicenseShortName", {}).get("value", ""),
        }
    return None

previo = json.load(open(SALIDA)) if os.path.exists(SALIDA) else {}
salida = dict(previo)   # se parte de lo ya conseguido: pedir sitios sueltos no debe borrar el resto
solo = sys.argv[1:] or list(SITIOS.keys())
os.makedirs("fotos", exist_ok=True)

for lid in solo:
    if lid not in SITIOS:
        continue
    art, pie = SITIOS[lid]
    if previo.get(lid, {}).get("fijado"):
        salida[lid] = previo[lid]; continue
    url, archivo = foto_de_articulo(art) if art else (None, None)
    if url and MALAS.search(archivo or ""):
        url = None                                   # los logotipos no identifican un sitio
    if not url:
        alt = busca_commons(COMMONS.get(lid, art or ""))
        if alt:
            lic0 = licencia_de(alt)
            if lic0 and lic0.get("url"):
                url, archivo = lic0["url"], alt
    if not url:
        print(f"{lid:26} --- sin foto usable")
        continue
    lic = licencia_de(archivo) if archivo else None
    ruta = f"fotos/{lid}.jpg"
    fuente = (lic or {}).get("url") or url
    subprocess.run(["curl", "-s", "-m", "60", "-H", f"User-Agent: {UA}", "-o", ruta, fuente], check=False)
    if os.path.getsize(ruta) < 4000:
        print(f"{lid:26} --- descarga fallida"); os.remove(ruta); continue
    subprocess.run(["sips", "-Z", "900", "-s", "format", "jpeg", "-s", "formatOptions", "70",
                    ruta, "--out", ruta], capture_output=True)
    salida[lid] = {"archivo": ruta, "pie": pie, "articulo": art, "titulo": archivo,
                   "autor": (lic or {}).get("autor", ""), "licencia": (lic or {}).get("licencia", ""),
                   "pagina": (lic or {}).get("pagina", ""),
                   "kb": round(os.path.getsize(ruta) / 1024)}
    print(f'{lid:26} {salida[lid]["kb"]:4} KB  {archivo[:46]}')

json.dump(salida, open(SALIDA, "w"), ensure_ascii=False, indent=1)
print("\nfotos:", len(salida), "| total:", round(sum(v["kb"] for v in salida.values()) / 1024, 1), "MB")
