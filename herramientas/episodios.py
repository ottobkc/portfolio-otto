# Páginas individuales de los episodios del podcast: /podcast/NN-slug/
# La descripción sale VERBATIM del RSS del podcast: guarda el XML en herramientas/podcast_rss.xml
# (abre https://anchor.fm/s/10f57d180/podcast/rss en el navegador y "Guardar como").
# Sin ese archivo las páginas se generan igualmente, pero sin descripción larga.
import os, re, html, unicodedata
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from email.utils import parsedate_to_datetime

AQUI = os.path.dirname(__file__)
RSS = os.path.join(AQUI, 'podcast_rss.xml')
NS = {'itunes': 'http://www.itunes.com/dtds/podcast-1.0.dtd', 'content': 'http://purl.org/rss/1.0/modules/content/'}
MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']


def slug(t):
    t = unicodedata.normalize('NFKD', t).encode('ascii', 'ignore').decode().lower()
    t = re.sub(r'[^a-z0-9]+', '-', t).strip('-')
    w = t.split('-')[:7]
    while len(w) > 2 and w[-1] in {'y', 'a', 'o', 'e', 'de', 'la', 'el', 'en', 'que', 'es', 'un', 'una', 'los', 'las', 'por', 'con', 'si', 'se'}:
        w.pop()
    return '-'.join(w)


class _Limpia(HTMLParser):
    """Deja solo etiquetas de texto seguras; el texto no se toca."""
    OK = {'p', 'br', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'a'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.salta = 0

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.salta += 1
        if tag not in self.OK:
            return
        if tag == 'a':
            href = dict(attrs).get('href', '')
            if re.match(r'https?://', href):
                self.out.append(f'<a href="{html.escape(href, True)}" rel="noopener">')
            else:
                self.out.append('<a>')
        else:
            self.out.append(f'<{tag}>')

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.salta -= 1
        if tag in self.OK and tag != 'br':
            self.out.append(f'</{tag}>')

    def handle_data(self, d):
        if self.salta:
            return
        self.out.append(html.escape(d, False))


def limpiar(raw):
    raw = raw.strip()
    if not re.search(r'<\w+[^>]*>', raw):  # texto plano: párrafos por líneas en blanco
        return ''.join(f'<p>{html.escape(p.strip()).replace(chr(10), "<br>")}</p>' for p in re.split(r'\n\s*\n', raw) if p.strip())
    p = _Limpia()
    p.feed(raw)
    return re.sub(r'<p>(\s|<br>)*</p>', '', ''.join(p.out))


def texto_plano(h):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', h))).strip()


def duracion(s):
    if not s:
        return None
    partes = [int(x) for x in s.split(':') if x.isdigit()]
    seg = sum(x * 60 ** i for i, x in enumerate(reversed(partes))) if ':' in s else int(s)
    return seg


def leer_rss():
    """{n: {desc, fecha(datetime), seg}} para los 20 primeros episodios (por fecha)."""
    if not os.path.exists(RSS):
        return {}
    items = []
    for it in ET.parse(RSS).getroot().iter('item'):
        g = lambda tag, ns=None: (it.find(tag, ns).text if it.find(tag, ns) is not None else None) or ''
        desc = g('content:encoded', NS) or g('description')
        pub = g('pubDate')
        items.append({'titulo': g('title').strip(), 'desc': limpiar(desc) if desc.strip() else '',
                      'fecha': parsedate_to_datetime(pub) if pub else None,
                      'seg': duracion(g('itunes:duration', NS).strip()), 'ep': g('itunes:episode', NS).strip()})
    items.sort(key=lambda x: x['fecha'].timestamp() if x['fecha'] else 0)
    return {i + 1: x for i, x in enumerate(items[:20])}


def ruta_ep(n, titulo):
    return f'/podcast/{n:02d}-{slug(titulo)}/'


def construir_episodios(g, EPISODIOS, URLS, PLATAFORMAS):
    pagina, escribir, DOM = g['pagina'], g['escribir'], g['DOM']
    rss = leer_rss()
    hechos = 0
    for n, titulo, sub in EPISODIOS:
        sid = (URLS.get(n) or '').rsplit('/', 1)[-1]
        if not sid:
            continue
        r = rss.get(n, {})
        ruta = ruta_ep(n, titulo)
        spotify = URLS[n]
        t_esc = html.escape(titulo)
        meta = []
        if r.get('fecha'):
            f = r['fecha']
            meta.append(f'{f.day} de {MESES[f.month - 1]} de {f.year}')
        if r.get('seg'):
            m = max(1, round(r['seg'] / 60))
            meta.append(f'{m} min')
        meta_html = f'<p class="ep-meta">{" · ".join(meta)}</p>' if meta else ''
        desc = r.get('desc') or (f'<p>{html.escape(sub)}</p>' if sub else '')
        plano = texto_plano(desc) if desc else ''
        descripcion = (plano[:155].rsplit(' ', 1)[0] + '…') if len(plano) > 160 else (plano or f'Episodio {n} de Mirar Despacio, el podcast sobre fotografía callejera.')
        otras = ''.join(f'<a class="boton claro" href="{u}" data-umami-event="ep{n}-{nom.lower().split()[0]}">{nom}</a>'
                        for nom, u in PLATAFORMAS if u and nom != 'Spotify')
        prev = next(((m, t) for m, t, _ in EPISODIOS if m == n - 1), None)
        sig = next(((m, t) for m, t, _ in EPISODIOS if m == n + 1), None)
        nav = ''
        if prev:
            nav += f'<a class="ep-nav ant" href="{ruta_ep(*prev)}"><small>← Episodio {prev[0]}</small><span>{html.escape(prev[1])}</span></a>'
        if sig:
            nav += f'<a class="ep-nav sig" href="{ruta_ep(*sig)}"><small>Episodio {sig[0]} →</small><span>{html.escape(sig[1])}</span></a>'
        cuerpo = f'''
    <section class="portada">
      <div class="envoltura estrecho">
        <p class="antetitulo"><a href="/podcast/">Podcast</a> · Temporada 1 · Episodio {n}</p>
        <h1>{t_esc}</h1>
        {meta_html}
        <iframe title="Mirar Despacio #{n} en Spotify" style="border-radius:12px;border:0;width:100%;margin-top:24px;" src="https://open.spotify.com/embed/episode/{sid}?theme=0" height="232" loading="lazy" allow="clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>
        <div class="botones"><a class="boton color" href="{spotify}" data-umami-event="ep{n}-spotify">Escuchar en Spotify</a>{otras}</div>
      </div>
    </section>

    <section class="seccion papel">
      <div class="envoltura estrecho ep-desc">
        <p class="antetitulo">De qué va</p>
        {desc or '<p>Descripción próximamente.</p>'}
      </div>
    </section>

    <section class="seccion">
      <div class="envoltura estrecho">
        <div class="ep-navs">{nav}</div>
        <p style="margin-top:32px;"><a href="/podcast/">← Todos los episodios</a></p>
        <h2>Si te ha gustado, <em>sal a mirar.</em></h2>
        <p>Una vez al mes hacemos una <a href="/salidas/">salida fotográfica por Madrid</a>: sin clases, con tarjetas de misión y fotos al final. Las fotos y las ideas que más resonaron del podcast están en <a href="/zine/">el zine</a>.</p>
      </div>
    </section>'''
        schema = [{
            "@type": "PodcastEpisode", "@id": DOM + ruta + "#episodio", "url": DOM + ruta, "name": titulo,
            "episodeNumber": n, "inLanguage": "es", "description": plano or descripcion,
            "partOfSeason": {"@type": "PodcastSeason", "seasonNumber": 1},
            "partOfSeries": {"@type": "PodcastSeries", "@id": DOM + "/podcast/#podcast", "name": "Mirar Despacio", "url": DOM + "/podcast/"},
            "author": {"@type": "Person", "name": "Otto Kols"},
            "associatedMedia": {"@type": "AudioObject", "embedUrl": f"https://open.spotify.com/embed/episode/{sid}", "url": spotify},
            **({"datePublished": r['fecha'].date().isoformat()} if r.get('fecha') else {}),
            **({"timeRequired": f"PT{r['seg'] // 60}M{r['seg'] % 60}S"} if r.get('seg') else {}),
        }, {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Podcast", "item": DOM + "/podcast/"},
            {"@type": "ListItem", "position": 2, "name": titulo, "item": DOM + ruta}]}]
        escribir(ruta, pagina(ruta, f'#{n} {titulo} · Podcast Mirar Despacio', descripcion, cuerpo, schema=schema))
        hechos += 1
    return hechos
