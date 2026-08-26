# -*- coding: utf-8 -*-
"""Reescribe las indicaciones del router a un castellano de andar por la calle.

El router habla de usted y llama 'la calzada' a cualquier camino sin nombre, que en
el centro de Paris son casi todos porque las aceras estan cartografiadas aparte y
sin nombre. Aqui se traduce a tuteo y se quita el relleno que no dice nada.
"""
import json, re

REGLAS = [
 (r'^Camine hacia (el \w+) por la calzada\.$',            r'Camina hacia \1.'),
 (r'^Camine hacia (el \w+) por (.+)\.$',                  r'Camina hacia \1 por \2.'),
 (r'^Camine hacia (.+)\.$',                               r'Camina hacia \1.'),
 (r'^Gire completamente a la (derecha|izquierda) hacia la calzada\.$', r'Date la vuelta hacia la \1.'),
 (r'^Gire a la (derecha|izquierda) hacia la calzada\.$',  r'Gira a la \1.'),
 (r'^Gire a la (derecha|izquierda) hacia (.+)\.$',        r'Gira a la \1, por \2.'),
 (r'^Gire a la (derecha|izquierda) para permanecer en (.+)\.$', r'Gira a la \1, sigues por \2.'),
 (r'^Gire a la (derecha|izquierda)\.$',                   r'Gira a la \1.'),
 (r'^Siga por la (derecha|izquierda) en dirección a la calzada\.$', r'Sigue por la \1.'),
 (r'^Siga por la (derecha|izquierda) en dirección a (.+)\.$', r'Sigue por la \1, hacia \2.'),
 (r'^Continúe en la calzada\.$',                          r'Sigue recto.'),
 (r'^Continúe en (.+)\.$',                                r'Sigue por \1.'),
 (r'^Continúe\.$',                                        r'Sigue recto.'),
 (r'^Siga por (.+)\.$',                                   r'Sigue por \1.'),
 (r'^Manténgase a la recto para tomar la calzada\.$',     r'Sigue recto.'),
 (r'^Manténgase a la (derecha|izquierda) para tomar la calzada\.$', r'Mantente a la \1.'),
 (r'^Manténgase a la (derecha|izquierda) para tomar (.+)\.$', r'Mantente a la \1, por \2.'),
 (r'^Manténgase a la (derecha|izquierda) para permanecer en (.+)\.$', r'Mantente a la \1, sigues por \2.'),
 (r'^Tome las escaleras( a Level.*)?\.$',                 r'Toma las escaleras.'),
 (r'^Tome la escalera mecánica( a Level.*)?\.$',          r'Toma la escalera mecánica.'),
 (r'^Suba las escaleras.*$',                              r'Sube las escaleras.'),
 (r'^Baje las escaleras.*$',                              r'Baja las escaleras.'),
]

def contrae(nombre):
    # 'a El Panteon' suena raro; en castellano se contrae en 'al Panteon'
    if nombre.startswith('El '):
        return 'al ' + nombre[3:]
    if nombre.startswith('Los '):
        return 'a los ' + nombre[4:]
    return 'a ' + nombre

def frase(t, destino):
    t = t.strip()
    if not t:
        return t
    if t == 'Ha llegado a su destino.':
        return 'Has llegado ' + contrae(destino) + '.'
    m = re.match(r'^Su destino está a la (derecha|izquierda)\.$', t)
    if m:
        return f'{destino} queda a tu {m.group(1)}.'
    for pat, rep in REGLAS:
        if re.match(pat, t):
            return re.sub(pat, rep, t)
    return t

def limpia(texto, destino):
    # la version hablada encadena varias frases con 'Después'
    partes = re.split(r'(?<=\.)\s+(?=Después\b)', texto)
    salida = []
    for p in partes:
        pref = ''
        if p.startswith('Después '):
            pref, p = 'Después, ', p[len('Después '):]
        salida.append(pref + frase(p, destino))
    return ' '.join(salida)

lug = {x['id']: x for x in json.load(open('data/lugares.geo.json'))}
rutas = json.load(open('data/rutas.json'))
n = 0
for r in rutas:
    destino = lug[r['a']]['nombre']
    for p in r['pasos']:
        antes = p['t']
        p['t'] = limpia(p['t'], destino)
        p['voz'] = limpia(p['voz'], destino)
        if p['t'] != antes:
            n += 1
json.dump(rutas, open('data/rutas.json', 'w'), ensure_ascii=False)
print('indicaciones reescritas:', n)
