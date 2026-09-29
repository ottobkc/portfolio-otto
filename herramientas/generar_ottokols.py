# Generador de las páginas de ottokols.es
# Uso: python3 herramientas/generar_ottokols.py  (escribe en PortfolioOtto/)
import json, os, html

RAIZ = os.path.join(os.path.dirname(__file__), '..', 'PortfolioOtto')
DOM = 'https://ottokols.es'
EMAIL = 'ottobkc@gmail.com'
INSTAGRAM = 'https://instagram.com/ob.kc'
MD = 'https://mirardespacio.es/'
UMAMI = '8f2ba4b0-e3aa-4d28-b1ec-282e448736f8'
FORMSPREE = 'https://formspree.io/f/xrejydle'
CLD = 'https://res.cloudinary.com/dybxateci/image/upload/'
# Fotos de encargos (coches). Cambia los nombres aquí para elegir otras.
ENCARGOS = ['coches_1_aqa37r', 'coches_2_touevk', 'coches_3_qrnpt4']
# Fotos de sesiones de retrato personal.
SESIONES = ['sesiones_1_eaw0ai', 'sesiones_2_l9favx', 'sesiones_3_pg8z5z']
# Fotos extra de mascotas (además de /fotos/walliot.jpg).
MASCOTAS = ['mascotas_l48usq']

def enc(pid, w=1200):
    return f'{CLD}f_auto,q_auto,w_{w}/{pid}.jpg'

NAV = [('/encargos/', 'Encargos'), ('/#sobre', 'Sobre mí'), ('/contacto/', 'Contacto')]
RETRATOS = [('/actores/', 'Actores'), ('/retrato/', 'Retrato personal'), ('/parejas/', 'Parejas y bodas íntimas'), ('/mascotas/', 'Mascotas')]

NEGOCIO = {
    "@type": "ProfessionalService", "@id": DOM + "/#negocio", "name": "Otto Kols · Fotografía de retrato",
    "url": DOM + "/", "image": DOM + "/fotos/retrato2vert.jpg", "email": EMAIL,
    "address": {"@type": "PostalAddress", "addressLocality": "Madrid", "addressCountry": "ES"},
    "areaServed": "España", "founder": {"@type": "Person", "name": "Otto Kols"},
    "sameAs": [INSTAGRAM, MD],
}

TOKEN_REDIRECT = '''
  <script>
    // Los enlaces de los emails de acceso a Mirar Despacio+ (invitación, recuperar contraseña…)
    // llegan a la portada: se reenvían a la página de acceso, que es la que muestra el formulario.
    if (/(recovery|invite|confirmation|email_change)_token=/.test(location.hash)) {
      location.replace('/acceso.html' + location.hash);
    }
  </script>'''

def pagina(ruta, titulo, descripcion, cuerpo, schema=None, og_img='/fotos/retrato2vert.jpg', extra_head=''):
    url = DOM + ruta
    act = ' aria-current="page"'
    sub = '\n'.join(f'            <li><a href="{h}"{act if h == ruta else ""}>{t}</a></li>' for h, t in RETRATOS)
    en_retrato = ' class="actual"' if ruta in [h for h, _ in RETRATOS] else ''
    nav = f'''        <li class="desplegable"><button type="button" aria-expanded="false"{en_retrato}>Retrato <span aria-hidden="true">▾</span></button>
          <ul>
{sub}
          </ul>
        </li>
''' + '\n'.join(f'        <li><a href="{h}"{act if h == ruta else ""}>{t}</a></li>' for h, t in NAV)
    ld = json.dumps({"@context": "https://schema.org", "@graph": [NEGOCIO] + (schema or [])}, ensure_ascii=False, indent=1)
    return f'''<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">{extra_head}
  <title>{html.escape(titulo)}</title>
  <meta name="description" content="{html.escape(descripcion)}">
  <link rel="canonical" href="{url}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Otto Kols · Fotografía">
  <meta property="og:locale" content="es_ES">
  <meta property="og:url" content="{url}">
  <meta property="og:title" content="{html.escape(titulo)}">
  <meta property="og:description" content="{html.escape(descripcion)}">
  <meta property="og:image" content="{og_img if og_img.startswith('http') else DOM + og_img}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#edece7">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;1,6..96,400&family=Caveat:wght@500&family=Hanken+Grotesk:wght@400;500&family=IBM+Plex+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap">
  <link rel="stylesheet" href="/assets/ok.css">
  <script type="application/ld+json">
{ld}
  </script>
  <script defer src="https://cloud.umami.is/script.js" data-website-id="{UMAMI}"></script>
</head>
<body>
  <a class="oculto" href="#contenido">Saltar al contenido</a>
  <header class="nav">
    <div class="env">
      <a class="marca" href="/">Otto Kols</a>
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
    <div class="env">
      <div>
        <p class="marca">Otto Kols</p>
        <p>Fotografía de retrato. Trabajo desde Madrid y me desplazo donde haga falta.</p>
      </div>
      <div>
        <h4>Retrato</h4>
        <ul>
          <li><a href="/actores/">Actores</a></li>
          <li><a href="/retrato/">Retrato personal</a></li>
          <li><a href="/parejas/">Parejas y bodas íntimas</a></li>
          <li><a href="/mascotas/">Mascotas</a></li>
          <li><a href="/encargos/">Encargos</a></li>
        </ul>
      </div>
      <div>
        <h4>Contacto</h4>
        <ul>
          <li><a href="mailto:{EMAIL}">{EMAIL}</a></li>
          <li><a href="{INSTAGRAM}" rel="me">Instagram · @ob.kc</a></li>
          <li><a href="{MD}">Mirar Despacio</a></li>
        </ul>
      </div>
      <p class="legal">© 2026 Otto Kols · Madrid</p>
    </div>
  </footer>
  <script src="/assets/ok.js"></script>
</body>
</html>
'''

def escribir(ruta, contenido):
    destino = os.path.join(RAIZ, 'index.html') if ruta == '/' else os.path.join(RAIZ, ruta.strip('/'), 'index.html')
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    open(destino, 'w').write(contenido)
    print('✓', ruta)

def img(src, alt, w, h, extra=''):
    return f'<img src="{src}" alt="{html.escape(alt)}" width="{w}" height="{h}" loading="lazy"{extra}>'

def pasos(items):
    return '<div class="pasos">' + ''.join(f'<div><span>{a}</span><h3>{b}</h3><p>{c}</p></div>' for a, b, c in items) + '</div>'

def precios(items):
    return ''.join(f'<div class="precio"><h3>{n}</h3><i></i><b>{p}</b><p>{d}</p></div>' for n, p, d in items)

def otros(actual):
    todos = [('/actores/', 'Actores'), ('/retrato/', 'Retrato personal'), ('/parejas/', 'Parejas y bodas íntimas'), ('/mascotas/', 'Mascotas'), ('/encargos/', 'Encargos')]
    return '<div class="otros">' + ''.join(f'<a href="{h}">{t}</a>' for h, t in todos if h != actual) + '</div>'

def faq(items):
    return '<div class="faq">' + ''.join(f'<h3>{q}</h3><p>{a}</p>' for q, a in items) + '</div>'

def faq_schema(items):
    return {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in items]}

def servicio_schema(nombre, ruta, ofertas):
    s = {"@type": "Service", "name": nombre, "url": DOM + ruta, "provider": {"@id": DOM + "/#negocio"}, "areaServed": "Madrid"}
    if ofertas:
        s["offers"] = [{"@type": "Offer", "name": n, "price": p, "priceCurrency": "EUR"} for n, p in ofertas]
    return s

def cta(tipo, texto='Reservar sesión'):
    return f'<div class="botones"><a class="btn lleno" href="/contacto/?tipo={tipo}">{texto}</a></div>'

# ================================================================ PORTADA
cuerpo = f'''
    <section class="env hero">
      <div>
        <h1>Fotógrafo de retrato <em>en Madrid.</em></h1>
        <p class="entradilla">Actores, personas, parejas y algún que otro perro. Fotos que se parecen a quien sale en ellas.</p>
        <div class="botones"><a class="btn lleno" href="#retrato">Ver sesiones</a><a class="btn" href="/contacto/">Contacto</a></div>
      </div>
      <div>
        <div class="tira">
          <div class="cuadros">
            <figure>{img('/fotos/retrato2vert.jpg', 'Retrato de una mujer con camiseta de rejilla negra', 934, 1400, ' fetchpriority="high"')}<div class="num">24A · retrato</div></figure>
            <figure class="elegida">{img('/fotos/retrato1vert.jpg', 'Retrato en blanco y negro de una actriz con los ojos cerrados', 934, 1400, ' fetchpriority="high"')}<div class="num">25A · actriz</div></figure>
            <figure>{img('/fotos/boda2horiz.jpg', 'Pareja de novios con un ramo', 1740, 1170)}<div class="num">26A · pareja</div></figure>
            <figure>{img('/fotos/walliot.jpg', 'Carlino tumbado mirando a cámara', 1400, 934)}<div class="num">27A · perro</div></figure>
          </div>
        </div>
        <div class="exif"><span>Sony A7R II · 85 mm</span><span class="mano">esta</span></div>
      </div>
    </section>

    <section class="bloque" id="retrato">
      <div class="env">
        <h2>Retrato</h2>
        <p class="sub">Cuatro formas de la misma sesión: tiempo, luz y alguien delante.</p>
        <div class="retratos">
          <a class="destacado" href="/actores/">{img('/fotos/retrato1vert.jpg', 'Retrato de actriz en blanco y negro', 934, 1400)}<div class="etq"><span>especialidad</span><span>desde 80 €</span></div><h3>Actores</h3><p>Book y fotos para casting.</p></a>
          <a href="/retrato/">{img('/fotos/retrato3vert.jpg', 'Retrato de una mujer apoyada en una pared naranja', 934, 1400)}<div class="etq"><span>personal</span><span>90–140 €</span></div><h3>Retrato</h3><p>Para ti, tu web o simplemente porque sí.</p></a>
          <a href="/parejas/">{img('/fotos/boda1horiz.jpg', 'Pareja de novios caminando junto al mar', 1503, 1000)}<div class="etq"><span>dos personas</span><span>desde 90 €</span></div><h3>Parejas y bodas íntimas</h3><p>Preboda, aniversario o una boda pequeña.</p></a>
          <a href="/mascotas/">{img('/fotos/walliot.jpg', 'Retrato de un carlino', 1400, 934)}<div class="etq"><span>mascotas</span><span>70–80 €</span></div><h3>Mascotas</h3><p>A su ritmo y en su sitio favorito.</p></a>
        </div>
      </div>
    </section>

    <section class="bloque">
      <div class="env encargos">
        <div>
          <h2>Encargos</h2>
          <p class="sub">Fotografía para marcas y negocios: lo que haga falta enseñar, bien contado. Trabajo desde Madrid y me desplazo donde haga falta.</p>
          <ul class="lista-mono"><li>Producto</li><li>Marca</li><li>Negocio</li><li>Eventos</li></ul>
          <div class="botones"><a class="btn" href="/encargos/">Ver encargos</a></div>
        </div>
        <div class="mosaico">
          {img(enc(ENCARGOS[0], 1100), 'Fotografía de encargo', 1100, 733)}
          {img(enc(ENCARGOS[1], 600), 'Fotografía de encargo', 600, 400)}
          {img(enc(ENCARGOS[2], 600), 'Fotografía de encargo', 600, 400)}
        </div>
      </div>
    </section>

    <section class="bloque" id="sobre">
      <div class="env sobre">
        {img('/fotos/yovert.jpg', 'Otto Kols con su cámara', 667, 1000)}
        <div>
          <h2>Sobre mí</h2>
          <p class="entradilla" style="max-width:52ch">Soy Otto. Creo que una buena foto no captura un momento: lo construye. Trabajo despacio, con atención y sin poses forzadas, buscando la imagen que sigue funcionando cuando lo demás se olvida.</p>
          <p style="max-width:58ch;color:var(--tinta-2)">También llevo <a href="{MD}">Mirar Despacio</a>, un proyecto de fotografía callejera con podcast, salidas fotográficas por Madrid y tutorías.</p>
          <div class="botones" style="margin-top:22px"><a class="btn lleno" href="/contacto/">Escríbeme</a></div>
        </div>
      </div>
    </section>'''
escribir('/', pagina('/', 'Otto Kols · Fotógrafo de retrato en Madrid',
    'Fotógrafo de retrato en Madrid: sesiones para actores, retrato personal, parejas y bodas íntimas, retratos de mascotas y encargos para marcas.',
    cuerpo, extra_head=TOKEN_REDIRECT))

# ================================================================ ACTORES
FAQ_ACT = [
    ("¿Qué me llevo a la sesión?", "Ropa lisa y sin logos en tonos que te favorezcan, y un cambio por cada look de la sesión que reserves. Si tienes dudas, me mandas fotos de lo que tienes y lo vemos antes."),
    ("¿Hay maquillaje?", "Sí, puedes añadir maquillaje profesional a cualquier sesión. El precio se adapta a la sesión y al número de looks: pregúntame al reservar."),
    ("¿Cuándo tengo las fotos?", "Te paso una galería con todas las fotos buenas, eliges tus favoritas y te las entrego editadas."),
    ("¿Sirven para casting y para el book?", "Sí, es para lo que están pensadas: naturales, que se parezcan a ti el día que entras por la puerta."),
]
cuerpo = f'''
    <section class="escena">
      <div class="env cabecera">
        <figure class="foco">{img('/fotos/retrato1vert.jpg', 'Retrato en blanco y negro de una actriz', 934, 1400, ' fetchpriority="high"')}</figure>
        <div>
          <p class="miga"><a href="/#retrato">Retrato</a> / Actores</p>
          <h1>Sesiones para <em>actores</em> en Madrid.</h1>
          <p class="entradilla">Fotos para tu book y para casting que se parecen a ti el día que entras por la puerta. Luz natural en exterior o estudio, sin retoque de plástico.</p>
          <div class="botones"><a class="btn" href="#sesiones">Ver sesiones</a></div>
        </div>
      </div>
    </section>
    <section class="bloque" id="sesiones" style="border-top:0">
      <div class="env">
        <h2>Sesiones</h2>
        <p class="sub">Todas las sesiones incluyen la selección de fotos y la edición de las elegidas. Si quieres, añadimos maquillaje profesional.</p>
        {precios([("Natural", "80 €", "1 h · 1 look · 8 fotos editadas · exterior"), ("Estudio", "150 €", "1 h 30 · 2 looks · 15 fotos editadas"), ("Completo", "220 €", "2 h · 3 looks · 20 fotos editadas"), ("Maquillaje profesional", "a consultar", "opcional · se adapta a la sesión y a los looks")])}
        <div style="margin-top:28px">{cta('actores')}</div>
      </div>
    </section>
    <section class="bloque">
      <div class="env">
        <h2>Cómo es la sesión</h2>
        {pasos([("antes", "Hablamos", "Qué papeles te llaman, qué looks traes y dónde hacemos las fotos."), ("durante", "Disparamos", "Sin prisa. Te enseño las fotos en cámara para ajustar sobre la marcha."), ("después", "Eliges", "Te paso una galería, eliges tus favoritas y te las entrego editadas.")])}
      </div>
    </section>
    <section class="bloque"><div class="env"><h2>Preguntas</h2>{faq(FAQ_ACT)}</div></section>
    <section class="bloque"><div class="env"><h2>Otros retratos</h2>{otros('/actores/')}</div></section>'''
escribir('/actores/', pagina('/actores/', 'Sesiones de fotos para actores en Madrid · Book y casting · Otto Kols',
    'Sesiones de fotos para actores y actrices en Madrid, para book y casting: sesiones de 1 a 2 horas, de 1 a 3 looks, luz natural o estudio. Desde 80 €.',
    cuerpo, schema=[servicio_schema("Sesiones de fotos para actores", "/actores/", [("Sesión Natural", "80"), ("Sesión Estudio", "150"), ("Sesión Completa", "220")]), faq_schema(FAQ_ACT)],
    og_img='/fotos/retrato1vert.jpg'))

# ================================================================ RETRATO
cuerpo = f'''
    <section class="env cabecera">
      <div>
        <p class="miga"><a href="/#retrato">Retrato</a> / Personal</p>
        <h1>Retrato <em>personal.</em></h1>
        <p class="entradilla">Una sesión para ti: para tu web, tu perfil profesional o porque te apetece tener una foto tuya que te guste de verdad. Sin poses forzadas.</p>
        {cta('retrato')}
      </div>
      <figure>{img('/fotos/retrato3vert.jpg', 'Retrato de cuerpo entero de una mujer apoyada en una pared naranja', 934, 1400, ' fetchpriority="high"')}</figure>
    </section>
    <section class="bloque">
      <div class="env">
        <h2>Precio</h2>
        {precios([("Retrato personal", "90–140 €", "según duración y número de fotos · precio orientativo")])}
        <p class="sub" style="margin-top:16px">Cuéntame qué necesitas y te preparo un presupuesto cerrado, sin compromiso.</p>
      </div>
    </section>
    <section class="bloque">
      <div class="env">
        <h2>Cómo es la sesión</h2>
        {pasos([("antes", "Hablamos", "Para qué quieres las fotos, qué te gustaría transmitir y dónde las hacemos."), ("durante", "Paseamos", "Una sesión tranquila, con luz natural, hablando mientras hacemos fotos."), ("después", "Eliges", "Te paso una galería y te entrego editadas tus favoritas.")])}
        <div class="galeria" style="margin-top:36px">
          {''.join(img(enc(p, 800), 'Sesión de retrato personal', 800, 1000) for p in SESIONES)}
        </div>
      </div>
    </section>
    <section class="bloque"><div class="env"><h2>Otros retratos</h2>{otros('/retrato/')}</div></section>'''
escribir('/retrato/', pagina('/retrato/', 'Sesión de retrato en Madrid · Otto Kols',
    'Sesiones de retrato personal en Madrid con luz natural y sin poses forzadas: para tu web, tu perfil profesional o para ti. 90–140 €.',
    cuerpo, schema=[servicio_schema("Retrato personal", "/retrato/", [("Retrato personal (desde)", "90")])], og_img='/fotos/retrato3vert.jpg'))

# ================================================================ PAREJAS
cuerpo = f'''
    <section class="env cabecera ancha">
      <div>
        <p class="miga"><a href="/#retrato">Retrato</a> / Parejas</p>
        <h1>Parejas y <em>bodas íntimas.</em></h1>
        <p class="entradilla">Retratos de dos: una preboda, un aniversario o una boda pequeña. Documental, sin coreografías, con tiempo para que os olvidéis de la cámara.</p>
        {cta('parejas', 'Contarme vuestra idea')}
      </div>
      <figure>{img('/fotos/boda1horiz.jpg', 'Pareja de novios caminando junto al mar', 1503, 1000, ' fetchpriority="high"')}</figure>
    </section>
    <section class="bloque">
      <div class="env">
        <h2>Precios</h2>
        {precios([("Sesión de pareja o preboda", "90–140 €", "precio orientativo según la sesión"), ("Boda íntima", "a consultar", "ceremonias civiles y bodas pequeñas, donde sea")])}
        <p class="sub" style="margin-top:16px">Me desplazo donde haga falta. Contadme fecha y lugar y os preparo un presupuesto.</p>
      </div>
    </section>
    <section class="bloque">
      <div class="env galeria dos">
        {img('/fotos/boda2horiz.jpg', 'Novios con el ramo', 1740, 1170)}
        {img('/fotos/boda1horiz.jpg', 'Pareja caminando junto al mar', 1503, 1000)}
      </div>
    </section>
    <section class="bloque"><div class="env"><h2>Otros retratos</h2>{otros('/parejas/')}</div></section>'''
escribir('/parejas/', pagina('/parejas/', 'Fotógrafo de parejas y bodas íntimas en Madrid · Otto Kols',
    'Sesiones de pareja, prebodas y bodas íntimas en Madrid y donde haga falta. Fotografía documental, sin coreografías. Desde 90 €.',
    cuerpo, schema=[servicio_schema("Parejas y bodas íntimas", "/parejas/", [("Sesión de pareja o preboda (desde)", "90")])], og_img='/fotos/boda1horiz.jpg'))

# ================================================================ MASCOTAS
cuerpo = f'''
    <section class="env cabecera ancha">
      <div>
        <p class="miga"><a href="/#retrato">Retrato</a> / Mascotas</p>
        <h1>Fotografía de <em>mascotas.</em></h1>
        <p class="entradilla">Para los que también son familia. Una sesión a su ritmo, en su parque o su sofá favorito, para guardar su carácter tal como es.</p>
        {cta('mascotas')}
      </div>
      <figure>{img('/fotos/walliot.jpg', 'Carlino tumbado mirando a cámara', 1400, 934, ' fetchpriority="high"')}</figure>
    </section>
    <section class="bloque">
      <div class="env">
        <h2>Precio</h2>
        {precios([("Sesión de mascotas", "70–80 €", "precio orientativo · también con sus humanos")])}
      </div>
    </section>
    <section class="bloque">
      <div class="env galeria dos">
        {img('/fotos/walliot.jpg', 'Retrato de un carlino', 1400, 934)}
        {''.join(img(enc(p, 1000), 'Sesión de retrato de mascota', 1000, 667) for p in MASCOTAS)}
      </div>
    </section>
    <section class="bloque">
      <div class="env">
        <h2>Cómo es la sesión</h2>
        {pasos([("antes", "Me lo presentas", "Cómo es, qué le gusta y dónde está más a gusto."), ("durante", "A su ritmo", "Sin prisas y con premios. Si se cansa, paramos."), ("después", "Eliges", "Te paso una galería y te entrego editadas tus favoritas.")])}
      </div>
    </section>
    <section class="bloque"><div class="env"><h2>Otros retratos</h2>{otros('/mascotas/')}</div></section>'''
escribir('/mascotas/', pagina('/mascotas/', 'Fotógrafo de mascotas en Madrid · Otto Kols',
    'Sesiones de retrato para perros y mascotas en Madrid, a su ritmo y en su sitio favorito. También con sus humanos. 70–80 €.',
    cuerpo, schema=[servicio_schema("Retrato de mascotas", "/mascotas/", [("Sesión de mascotas (desde)", "70")])], og_img='/fotos/walliot.jpg'))

# ================================================================ ENCARGOS
cuerpo = f'''
    <section class="env cabecera ancha">
      <div>
        <p class="miga">Encargos</p>
        <h1>Fotografía para <em>marcas y negocios.</em></h1>
        <p class="entradilla">Producto, espacios, equipo, eventos o lo que tengas que enseñar. Me cuentas para qué son las fotos y dónde van a vivir, y te preparo una propuesta.</p>
        {cta('encargos', 'Pedir presupuesto')}
      </div>
      <figure>{img(enc(ENCARGOS[0], 1400), 'Fotografía de encargo', 1400, 933, ' fetchpriority="high"')}</figure>
    </section>
    <section class="bloque">
      <div class="env">
        <h2>Algunos encargos</h2>
        <div class="galeria" style="margin-top:20px">
          {''.join(img(enc(p, 900), 'Fotografía de encargo', 900, 600) for p in ENCARGOS)}
        </div>
        <p class="sub" style="margin-top:24px">Trabajo desde Madrid y me desplazo donde haga falta. Precio a consultar según el encargo.</p>
      </div>
    </section>'''
escribir('/encargos/', pagina('/encargos/', 'Fotografía para marcas y negocios · Otto Kols',
    'Fotografía por encargo para marcas y negocios: producto, espacios, equipo y eventos. Desde Madrid, con desplazamiento donde haga falta.',
    cuerpo, schema=[servicio_schema("Fotografía por encargo", "/encargos/", None)], og_img=enc(ENCARGOS[0], 1200)))

# ================================================================ CONTACTO
TIPOS = [('actores', 'Sesión para actores'), ('retrato', 'Retrato personal'), ('parejas', 'Pareja o preboda'),
         ('boda', 'Boda íntima'), ('mascotas', 'Mascotas'), ('encargos', 'Encargo para marca o negocio'), ('otro', 'Otra cosa / no lo sé aún')]
opciones = ''.join(f'<option data-clave="{c}">{t}</option>' for c, t in TIPOS)
cuerpo = f'''
    <section class="env bloque contacto" style="border-top:0">
      <div>
        <h1>Cuéntame <em>tu idea.</em></h1>
        <p class="entradilla">Una sesión, una boda pequeña, un encargo o una idea a medio formar. Respondo yo, en menos de 48 horas.</p>
        <ul class="datos-contacto">
          <li><a href="mailto:{EMAIL}">{EMAIL}</a></li>
          <li><a href="{INSTAGRAM}">Instagram · @ob.kc</a></li>
          <li>Madrid · me desplazo donde haga falta</li>
        </ul>
      </div>
      <div>
        <form class="form" id="contactForm" action="{FORMSPREE}" method="POST">
          <input type="hidden" name="_subject" value="Contacto · ottokols.es">
          <div><label for="c-nombre">Nombre *</label><input type="text" id="c-nombre" name="nombre" required autocomplete="name"></div>
          <div><label for="c-email">Email *</label><input type="email" id="c-email" name="email" required autocomplete="email"></div>
          <div><label for="c-tipo">Qué tienes en mente</label><select id="c-tipo" name="tipo">{opciones}</select></div>
          <div><label for="c-fecha">Fecha aproximada</label><input type="text" id="c-fecha" name="fecha" placeholder="Por ejemplo: noviembre, sin fecha aún…"></div>
          <div><label for="c-mensaje">Cuéntame algo</label><textarea id="c-mensaje" name="mensaje" rows="5"></textarea></div>
          <label class="check"><input type="checkbox" name="acepta_datos" value="si" required> Acepto que uses mis datos solo para responder a este mensaje.</label>
          <div><button class="btn lleno" type="submit">Enviar mensaje</button></div>
        </form>
        <div class="ok" id="contactOk"><strong>Mensaje recibido.</strong> Te escribo pronto.</div>
      </div>
    </section>'''
escribir('/contacto/', pagina('/contacto/', 'Contacto · Otto Kols, fotógrafo de retrato en Madrid',
    'Escríbeme para reservar una sesión de retrato, para actores, de pareja, mascotas o un encargo. Respondo en menos de 48 horas.', cuerpo))
