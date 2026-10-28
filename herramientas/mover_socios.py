# Copia la zona de socios de ottokols.es (PortfolioOtto/) a mirardespacio.es (MirarDespacio/),
# cambiando lo necesario para que funcione con la sesión de Firebase en lugar de Netlify Identity.
# Uso: python3 mover_socios.py   (se puede repetir: siempre parte de los originales de PortfolioOtto)
#
# Mientras dure la migración, los originales siguen en ottokols.es. Al terminar (fase 3) se borran de
# allí y MirarDespacio/ pasa a ser el original: entonces este script deja de usarse.
import os, re, shutil

AQUI = os.path.dirname(os.path.abspath(__file__))
ORIGEN = os.path.join(AQUI, '..', 'PortfolioOtto')
DESTINO = os.path.join(AQUI, '..', 'MirarDespacio')

# (origen, destino) relativos
# (members va antes que recursos.html: la carpeta socios/ se vacía antes de copiarla)
COPIAS = [('members', 'socios'), ('recursos.html', 'socios/index.html'), ('cuaderno', 'cuaderno'), ('retos', 'retos'),
          ('subir', 'subir'), ('manuales', 'manuales')]
JS = ['hilo.js', 'ejercicios-taller.js', 'tarjeta-ig.js', 'medallas.js', 'horas-luz.js', 'monturas.js', 'agenda.js']
ASSETS = ['logo-md-blanco.png']

WIDGET = '<script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>'
CAMBIOS = [
    (WIDGET, '<script src="/js/sesion.js"></script>'),
    # Las funciones de ottokols.es: por la misma web (mirardespacio.es/api/f/ -> ottokols.es, ver netlify.toml).
    # Las que ya iban con la dirección completa (agenda, calendario) se quedan como están.
    (re.compile(r'(?<!ottokols\.es)/\.netlify/functions/'), '/api/f/'),
    ('https://mirardespacio.es/assets/', '/assets/'),
    # «Vista previa» = cualquier sitio que no sea la web de verdad (en la de verdad, sin sesión se va a /acceso/)
    ("!window.location.hostname.includes('ottokols')", "!/mirar/.test(window.location.hostname)"),
    ('https://ottokols.es/acceso.html', '/acceso/'),
    ('/acceso.html', '/acceso/'),
    ('/recursos.html', '/socios/'),
    ('/members/', '/socios/'),
    ('https://ottokols.es/js/agenda.js', '/js/agenda.js'),
    ('ottokols.es/manuales/<id>/', 'mirardespacio.es/manuales/<id>/'),
    # Pies de página: la zona ya vive en mirardespacio.es
    ('<p>ottokols.es<span class="dot">·</span>', '<p>mirardespacio.es<span class="dot">·</span>'),
    ('<p>ottokols.es</p>', '<p>mirardespacio.es</p>'),
    ('Mirar Despacio + · ottokols.es', 'Mirar Despacio + · mirardespacio.es'),
    ('<a href="/">ottokols.es</a>', '<a href="/">mirardespacio.es</a>'),
    ('mailto:info@ottokols.es', 'mailto:info@mirardespacio.es'),
]
# Cambios concretos de una página (lo que no se resuelve con buscar y reemplazar)
ESPECIALES = {
    'socios/index.html': [
        # Los roles ya no van dentro del pase: los trae la sesión
        ("user.jwt(true).then(function (t) { pintarManuales(rolesDe(t)); }).catch(function () {});",
         "user.jwt(true).then(function () { var u2 = netlifyIdentity.currentUser(); pintarManuales((u2 && u2.app_metadata.roles) || []); }).catch(function () {});"),
    ],
}
# El aviso de "solo funciona con tu cuenta" de acceso.html no hace falta; tampoco el registro antiguo
TEXTO = ('.html', '.js', '.css', '.json', '.svg')


def cambiar(texto, rel):
    for a, b in CAMBIOS:
        texto = a.sub(b, texto) if hasattr(a, 'sub') else texto.replace(a, b)
    for a, b in ESPECIALES.get(rel, []):
        assert a in texto, f'{rel}: no encuentro {a[:60]}'
        texto = texto.replace(a, b)
    return texto


def copiar_archivo(o, d, rel):
    os.makedirs(os.path.dirname(d), exist_ok=True)
    if o.endswith(TEXTO):
        t = cambiar(open(o, encoding='utf-8').read(), rel)
        assert 'identity.netlify.com' not in t, f'{rel}: aún carga el widget de Identity'
        open(d, 'w', encoding='utf-8').write(t)
    else:
        shutil.copyfile(o, d)


def main():
    hechos = 0
    for o, d in COPIAS:
        po, pd = os.path.join(ORIGEN, o), os.path.join(DESTINO, d)
        if os.path.isdir(po):
            if os.path.isdir(pd):
                shutil.rmtree(pd)
            for raiz, _, archivos in os.walk(po):
                for a in archivos:
                    ro = os.path.join(raiz, a)
                    rel = os.path.join(d, os.path.relpath(ro, po)).replace(os.sep, '/')
                    copiar_archivo(ro, os.path.join(DESTINO, rel), rel)
                    hechos += 1
        else:
            copiar_archivo(po, pd, d)
            hechos += 1
    for j in JS:
        copiar_archivo(os.path.join(ORIGEN, 'js', j), os.path.join(DESTINO, 'js', j), 'js/' + j)
        hechos += 1
    for a in ASSETS:
        copiar_archivo(os.path.join(ORIGEN, 'assets', a), os.path.join(DESTINO, 'assets', a), 'assets/' + a)
        hechos += 1
    print(f'{hechos} archivos copiados a MirarDespacio/')


if __name__ == '__main__':
    main()
