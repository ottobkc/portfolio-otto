# Generador de las páginas estáticas de mirardespacio.es
# Uso: python3 generar.py  (escribe en ../MirarDespacio)
import json, os, html

RAIZ = os.path.join(os.path.dirname(__file__), '..', 'MirarDespacio')
DOM = 'https://mirardespacio.es'
LOGO = 'https://res.cloudinary.com/dybxateci/image/upload/v1785276700/logoMD_gizjap.png'
SPOTIFY = 'https://open.spotify.com/show/6G7RStaXJqr4S39eUei6BB'
INSTAGRAM = 'https://instagram.com/ob.kc'
EMAIL = 'info@mirardespacio.es'
UMAMI = '8f2ba4b0-e3aa-4d28-b1ec-282e448736f8'
FORMSPREE = 'https://formspree.io/f/mlgkdlno'
ACCESO = 'https://ottokols.es/acceso.html'
HOY = '2026-09-29'

import hashlib
def v(nombre):
    # Versión del archivo según su contenido: el navegador guarda /assets 7 días,
    # así cada cambio llega a todo el mundo al momento.
    ruta = os.path.join(os.path.dirname(__file__), '..', 'MirarDespacio', 'assets', nombre)
    return '/assets/' + nombre + '?v=' + hashlib.md5(open(ruta, 'rb').read()).hexdigest()[:8]

def cld(url, t='f_auto,q_auto,w_900'):
    return url.replace('/upload/', '/upload/' + t + '/', 1)

datos = json.load(open(os.path.join(os.path.dirname(__file__), '..', 'MirarDespacio', 'salidas-data.json')))
PORTADA = cld(datos['galeria'][0]['src'], 'f_auto,q_auto,w_1100')

NAV = [('/podcast/', 'Podcast'), ('/salidas/', 'Salidas'), ('/talleres/', 'Talleres'), ('/tutorias/', 'Tutorías'),
       ('/zine/', 'Zine'), ('/mirar-despacio-plus/', 'Mirar Despacio+')]

ORG = {
    "@type": "Organization", "@id": DOM + "/#org", "name": "Mirar Despacio", "url": DOM + "/",
    "logo": LOGO, "email": EMAIL,
    "founder": {"@type": "Person", "name": "Otto Kols", "url": "https://ottokols.es/"},
    "sameAs": [INSTAGRAM, SPOTIFY, "https://ottokols.es/"],
    "areaServed": "Madrid",
}

def pagina(ruta, titulo, descripcion, cuerpo, schema=None, og_img=PORTADA, extra_head='', extra_pie=''):
    url = DOM + ruta
    ACT = ' aria-current="page"'
    nav = '\n'.join(
        f'        <li><a href="{h}"{ACT if h == ruta else ""}>{t}</a></li>' for h, t in NAV)
    graph = [ORG] + (schema or [])
    ld = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, indent=1)
    return f'''<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{html.escape(titulo)}</title>
  <meta name="description" content="{html.escape(descripcion)}">
  <link rel="canonical" href="{url}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Mirar Despacio">
  <meta property="og:locale" content="es_ES">
  <meta property="og:url" content="{url}">
  <meta property="og:title" content="{html.escape(titulo)}">
  <meta property="og:description" content="{html.escape(descripcion)}">
  <meta property="og:image" content="{og_img}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#f5f3ef">
  <link rel="icon" href="{cld(LOGO, 'w_64,h_64,c_pad,b_rgb:f5f3ef')}">
  <link rel="apple-touch-icon" href="{cld(LOGO, 'w_180,h_180,c_pad,b_rgb:f5f3ef')}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caveat:wght@500&family=Jost:wght@300;400;500&display=swap">
  <link rel="stylesheet" href="{v('md.css')}">
  <script type="application/ld+json">
{ld}
  </script>
  <script defer src="https://cloud.umami.is/script.js" data-website-id="{UMAMI}"></script>{extra_head}
</head>
<body>
  <a class="oculto-visual" href="#contenido">Saltar al contenido</a>
  <header class="nav">
    <div class="envoltura">
      <a class="marca" href="/"><img src="{cld(LOGO, 'w_80')}" alt="" width="34" height="34"><span>Mirar Despacio</span></a>
      <button class="nav-boton" aria-label="Menú" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 7h18M3 12h18M3 17h18"/></svg></button>
      <ul>
{nav}
      </ul>
    </div>
  </header>
  <main id="contenido">
{cuerpo}
  </main>
  <footer class="pie">
    <div class="envoltura">
      <div>
        <p class="lema">Ver no es mirar.</p>
        <p>Mirar Despacio es un proyecto de fotografía de <a href="https://ottokols.es/" style="text-decoration:underline">Otto Kols</a>, fotógrafo en Madrid.</p>
      </div>
      <div>
        <h4>El proyecto</h4>
        <ul>
{nav.replace('        <li>', '          <li>').replace(' aria-current="page"', '')}
        </ul>
      </div>
      <div>
        <h4>Contacto</h4>
        <ul>
          <li><a href="mailto:{EMAIL}">{EMAIL}</a></li>
          <li><a href="{INSTAGRAM}" rel="me">Instagram · @ob.kc</a></li>
          <li><a href="{SPOTIFY}">Spotify</a></li>
          <li><a href="{ACCESO}">Acceso miembros</a></li>
        </ul>
      </div>
      <p class="legal">© 2026 Mirar Despacio · Otto Kols · Madrid</p>
    </div>
  </footer>
  <script src="{v('md.js')}"></script>{extra_pie}
</body>
</html>
'''

def escribir(ruta, contenido):
    destino = os.path.join(RAIZ, ruta.strip('/'), 'index.html') if ruta != '/404' else os.path.join(RAIZ, '404.html')
    if ruta == '/':
        destino = os.path.join(RAIZ, 'index.html')
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    for js in ('pegatinas.js', 'galerias.js', 'talleres.js'):
        contenido = contenido.replace('"/assets/' + js + '"', '"' + v(js) + '"')
    open(destino, 'w').write(contenido)
    print('✓', ruta)

# Script que pinta la próxima salida desde salidas-data.json
PROXIMA_JS = '''
  <script>
    // Próxima salida. "Por determinar" / "por confirmar" / "por anunciar" en fecha = aún sin fecha.
    // Una salida con fechaISO ya pasada tampoco se muestra.
    fetch('/salidas-data.json').then(function (r) { return r.json(); }).then(function (d) {
      var pendiente = function (v) { return !v || /^por (determinar|confirmar|anunciar)/i.test(String(v).trim()); };
      var pasada = function (x) { return x.fechaISO && new Date(x.fechaISO).getTime() + 4 * 3600e3 < Date.now(); };
      var s = (d.proximas || []).filter(function (x) { return x.activa && !pendiente(x.fecha) && !pasada(x); })[0];
      document.querySelectorAll('[data-proxima]').forEach(function (el) {
        if (!s) { el.textContent = 'Próxima fecha por anunciar. Apúntate y te aviso.'; return; }
        var t = s.fecha;
        if (!pendiente(s.zona)) t += ' · ' + s.zona;
        if (!pendiente(s.hora)) t += ' · ' + s.hora + ' h';
        el.textContent = t;
      });
    }).catch(function () {});
  </script>'''

from paginas import construir
construir(globals())
