# -*- coding: utf-8 -*-
"""Sube la version en todos los sitios a la vez, que es donde se olvida uno."""
import re, sys, datetime
V = sys.argv[1] if len(sys.argv) > 1 else datetime.date.today().isoformat() + "-1"
for f, pats in {
    "js/app.js": [(r"const VER = '[^']+'", f"const VER = '{V}'")],
    "sw.js": [(r"const V = 'paris-[^']+'", f"const V = 'paris-{V}'"),
              (r"\?v=[\d-]+", f"?v={V}")],
    "index.html": [(r"\?v=[\d-]+", f"?v={V}")],
}.items():
    t = open(f).read()
    for a, b in pats:
        t = re.sub(a, b, t)
    open(f, "w").write(t)
print("versión", V)
