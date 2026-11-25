"""Pone (o actualiza) el tema y el sello en las páginas que no salen de generar.py
(zona MD+, manuales, juegos, salidas por barrio...). Se puede ejecutar las veces que haga falta.
Uso: cd herramientas && python3 tema_estaticas.py"""
import hashlib, pathlib, re
RAIZ = pathlib.Path(__file__).resolve().parent.parent / 'MirarDespacio'
def v(n): return f"/assets/{n}?v=" + hashlib.md5((RAIZ / 'assets' / n).read_bytes()).hexdigest()[:8]
TEMA = f'<link rel="stylesheet" href="{v("tema.css")}">'
SELLO = f'<script defer src="{v("sello.js")}"></script>'
n = 0
for p in RAIZ.rglob('*.html'):
    s = p.read_text(encoding='utf-8'); t = s
    if '/assets/tema.css' in t: t = re.sub(r'<link rel="stylesheet" href="/assets/tema\.css[^"]*">', TEMA, t)
    else: t = t.replace('</head>', '  ' + TEMA + '\n</head>', 1)
    if '/assets/sello.js' in t: t = re.sub(r'<script defer src="/assets/sello\.js[^"]*"></script>', SELLO, t)
    else: t = t.replace('</body>', '  ' + SELLO + '\n</body>', 1)
    # logotipo completo en la cabecera (igual que en generar.py)
    t = re.sub(r'<a class="marca" href="/"><img [^>]*>', '<a class="marca" href="/"><img class="marca-logo" src="/assets/logo-md-cabecera.webp" alt="" width="120" height="40">', t)
    if t != s: p.write_text(t, encoding='utf-8'); n += 1
print(n, 'páginas actualizadas')
