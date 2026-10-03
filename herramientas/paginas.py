# Contenido de cada página de mirardespacio.es. Lo llama generar.py.
import json, html

EPISODIOS_T1 = [
    (1, "Qué es para mí la fotografía callejera (y por qué nos da miedo mirar)", ""),
    (2, "Por qué no por muchas fotos que haga soy mejor fotógrafo", "Y lo que aprendí observando."),
    (3, "Qué pasa si me pillan haciendo fotos en la calle", "Legalidad y ética de fotografiar a desconocidos."),
    (4, "Cómo empezar en fotografía callejera", "Sin sentirte perdido."),
    (5, "Cómo vencer la vergüenza al hacer fotos a desconocidos", ""),
    (6, "La foto con la que alguien te recordará", ""),
    (7, "Ver no es mirar", ""),
    (8, "Hay fotos que te hacen parar", ""),
    (9, "Lo que encontré esperando", ""),
    (10, "Diez episodios mirando despacio", ""),
    (11, "¿Qué harías si te pidieran borrar una foto?", ""),
    (12, "¿Robas la foto o buscas el encuentro?", ""),
    (13, "¿Y si lo dejo todo?", ""),
    (14, "El archivo", ""),
    (15, "Publicar en el vacío del algoritmo", "Para quién fotografías cuando el alcance cae."),
    (16, "El segundo antes de publicar", "El miedo a que te juzguen y el perfeccionismo como forma de no enseñar nada."),
    (17, "Los más cercanos y el apoyo que no llega", "Por qué tu entorno no siempre apoya tus proyectos creativos, y qué esperar de él."),
    (18, "El estilo no es el género, es la mirada", "Encontrar tu mirada sin obsesionarte con buscarla."),
    (19, "El proyecto que no termina de llegar", "Tener una idea que dé sentido a las fotos."),
    (20, "Lo que ha sido este camino", "Cierre de la primera temporada."),
]


# Plataformas del podcast: pon aquí el enlace de cada una. Las vacías no se muestran.
PLATAFORMAS = [
    ("Spotify", "https://open.spotify.com/show/6G7RStaXJqr4S39eUei6BB"),
    ("Podimo", "https://podimo.com/s/mirar-despacio"),
    ("Apple Podcasts", "https://podcasts.apple.com/us/podcast/mirar-despacio/id1882729734?l=es-MX"),
    ("YouTube", "https://www.youtube.com/@mirardespaciopodcast"),
]
# Enlace de pago de Mirar Despacio+ (Ko-fi). Vacío = el botón abre un email de "me interesa".
PLUS_URL = ""
# Fotos del zine (URLs de Cloudinary). Vacío = no se muestra ninguna.
ZINE_FOTOS = []
# Enlace de cada episodio (número: url). Los que falten se muestran sin enlace.
EPISODIO_URL = {
    1: "https://open.spotify.com/episode/1uNhbeNInYusHKHv8UpA0m",
    2: "https://open.spotify.com/episode/2CH64lE0SJuzkxm1XlHL93",
    3: "https://open.spotify.com/episode/1UVwJrMT36Fkkt5V82HKAc",
    4: "https://open.spotify.com/episode/3SqYv22SUftMZEjgszvzgU",
    5: "https://open.spotify.com/episode/6sfCGR69gHTRT1LiVskIs9",
    6: "https://open.spotify.com/episode/4DHK43bChWQp2P8ffuNckB",
    7: "https://open.spotify.com/episode/5wPPJfgcNY0tpnj7I72eCa",
    8: "https://open.spotify.com/episode/15zKtP1OGF2US5f0lNBpit",
    9: "https://open.spotify.com/episode/0VqheFTo3sppnbsN9b6Uip",
    10: "https://open.spotify.com/episode/6G2pfpKWoQ9LITtfxhdPMj",
    11: "https://open.spotify.com/episode/4Dy4knhw0uoMzkIG7CwQlV",
    12: "https://open.spotify.com/episode/2LKIisPRNpFxsQD6hn2ocL",
    13: "https://open.spotify.com/episode/0THlIGzRWx8BQtK8vqe8XJ",
    14: "https://open.spotify.com/episode/2x4yIOTBRijfSxbwbwAP3S",
    15: "https://open.spotify.com/episode/1QFhZfkddMEEeKkMEKX77g",
    16: "https://open.spotify.com/episode/6bZwKw8zFhnyERTeXNgsgr",
    17: "https://open.spotify.com/episode/5g84DOsgXEaOfNzqbwUpsN",
    18: "https://open.spotify.com/episode/64qQonkRCmIWDb6WnWO3t3",
    19: "https://open.spotify.com/episode/4GQgEUw5NBYEB2YscmeoGi",
    20: "https://open.spotify.com/episode/2ylSTymYhY323W6Vn3Rxje",
}


def construir(g):
    pagina, escribir, cld, datos = g['pagina'], g['escribir'], g['cld'], g['datos']
    DOM, SPOTIFY, INSTAGRAM, EMAIL = g['DOM'], g['SPOTIFY'], g['INSTAGRAM'], g['EMAIL']
    FORMSPREE, ACCESO, PORTADA, PROXIMA_JS = g['FORMSPREE'], g['ACCESO'], g['PORTADA'], g['PROXIMA_JS']
    fotos = [cld(f['src']) for f in datos['galeria']]
    salida_fotos = datos.get('ultimaSalida', {}).get('fotos', [])

    # ------------------------------------------------------------ PORTADA
    cuerpo = f'''
    <section class="portada">
      <div class="envoltura rejilla">
        <div class="revelar">
          <p class="antetitulo">Fotografía callejera · Madrid</p>
          <h1>Mirar <em>despacio.</em></h1>
          <p class="entradilla">Un podcast, unas salidas fotográficas por Madrid y una pequeña comunidad para gente que hace fotos y quiere volver a <span class="subrayado">mirar antes de disparar</span>.</p>
          <div class="botones">
            <a class="boton" href="/salidas/">Próxima salida</a>
            <a class="boton claro" href="/podcast/">Escuchar el podcast</a>
          </div>
        </div>
        <figure class="revelar">
          <img src="{PORTADA}" alt="Fotografía de calle en Madrid" width="880" height="1100" fetchpriority="high">
        </figure>
      </div>
    </section>

    <section class="seccion papel">
      <div class="envoltura estrecho" style="text-align:center;">
        <span class="nota">¿por dónde empiezo?</span>
        <h2 class="revelar" style="margin-top:10px;">Ven a una <em>salida.</em></h2>
        <p class="entradilla revelar" style="margin-left:auto;margin-right:auto;">Es la forma más fácil de entender de qué va esto. Una mañana en grupo por un barrio de Madrid, con cualquier cámara, y al final cada uno pone lo que considere.</p>
        <p class="revelar"><strong data-proxima>Cargando próxima fecha…</strong></p>
        <div class="botones" style="justify-content:center;"><a class="boton color" href="/salidas/#apuntarse">Quiero apuntarme</a></div>
      </div>
    </section>

    <section class="seccion">
      <div class="envoltura">
        <p class="antetitulo">Qué es</p>
        <h2 class="revelar">No es una escuela.<br><em>Es una forma de mirar.</em></h2>
        <p class="entradilla revelar">Mirar Despacio empezó como un podcast sobre fotografía callejera y lo que pasa cuando vas por la ciudad con un poco más de calma. Luego llegaron las salidas, el zine y la comunidad. La idea de fondo no ha cambiado: hacer menos fotos y mirar mejor.</p>
        <div class="rejilla-2" style="margin-top:40px;">
          <a class="tarjeta revelar" href="/podcast/"><span class="num">01</span><h3>El podcast</h3><p>Episodios cortos sobre fotografía de calle, miedo a mirar, publicar, el estilo propio. Para escuchar paseando.</p><span class="mas">20 episodios en la primera temporada →</span></a>
          <a class="tarjeta revelar" href="/salidas/"><span class="num">02</span><h3>Salidas fotográficas</h3><p>Mañanas de fotografía en grupo por barrios de Madrid, con tarjetas de misión y visionado al final. Contribución libre.</p><span class="mas" data-proxima>Ver próxima salida →</span></a>
          <a class="tarjeta revelar" href="/tutorias/"><span class="num">03</span><h3>Tutorías</h3><p>Una sesión a solas conmigo, presencial en Madrid u online, sobre tu cámara, tu luz y tus fotos.</p><span class="mas">Online desde 30 € →</span></a>
          <a class="tarjeta revelar" href="/mirar-despacio-plus/"><span class="num">04</span><h3>Mirar Despacio+</h3><p>La comunidad: salidas incluidas, retos y guías cada mes, feedback de tus fotos y grupo privado.</p><span class="mas">Cómo funciona →</span></a>
        </div>
      </div>
    </section>

    <section class="seccion oscura">
      <div class="envoltura rejilla-2" style="align-items:center;gap:48px;">
        <div class="revelar">
          <p class="antetitulo">El podcast</p>
          <h2>Episodios para escuchar <em>caminando.</em></h2>
          <p class="entradilla">Sobre la vergüenza de fotografiar a desconocidos, qué hacer si te piden borrar una foto, publicar en el vacío del algoritmo o encontrar tu estilo sin buscarlo.</p>
          <div class="botones"><a class="boton claro" href="/podcast/">Todos los episodios</a></div>
        </div>
        <iframe class="revelar" title="Mirar Despacio #1 en Spotify" style="border-radius:12px;border:0;width:100%;" src="https://open.spotify.com/embed/episode/1uNhbeNInYusHKHv8UpA0m?theme=0" height="352" loading="lazy" allow="clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>
      </div>
    </section>

    <section class="seccion papel" id="mapa-pegatinas">
      <div class="envoltura">
        <p class="antetitulo">Mapa de pegatinas</p>
        <h2>¿Has visto una <em>pegatina?</em></h2>
        <p>Si te has cruzado con una pegatina de Mirar Despacio, hazle una foto y márcala en el mapa.</p>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css">
        <div id="stickerMap" style="height:420px;border-radius:6px;overflow:hidden;margin:20px 0;"></div>
        <form id="stickerForm" class="formulario" style="max-width:520px;">
          <div class="botones" style="margin-top:0"><button type="button" class="boton claro" id="stickerGeo">📍 Usar mi ubicación</button></div>
          <p id="stickerCoordsHint" class="aviso" style="margin:0">O toca en el mapa el sitio donde la has visto.</p>
          <input type="hidden" id="stickerLat"><input type="hidden" id="stickerLng">
          <div><label for="stickerName">Tu nombre o @ de Instagram *</label><input type="text" id="stickerName" maxlength="60" required autocomplete="nickname"></div>
          <div><label for="stickerFoto">Foto de la pegatina *</label><input type="file" id="stickerFoto" accept="image/*" required>
            <p class="aviso" style="margin:6px 0 0">La foto aparecerá en el mapa cuando la revise.</p>
            <img id="stickerPreview" alt="" style="display:none;max-width:160px;margin-top:10px;border-radius:4px;"></div>
          <div><button class="boton" type="submit">Marcar en el mapa</button></div>
          <p id="stickerMsg" class="aviso" style="margin:0"></p>
          <p class="aviso" style="margin:0">¿La viste pero no le hiciste foto? Escríbeme por <a href="{INSTAGRAM}">Instagram</a> diciéndome dónde está y la añado yo.</p>
        </form>
      </div>
    </section>

    <section class="seccion">
      <div class="envoltura">
        <p class="antetitulo">Desde la calle</p>
        <h2 class="revelar">El tipo de <em>imágenes.</em></h2>
        <div class="galeria revelar" data-visor style="margin-top:28px;">
          {''.join(f'<button data-foto="{cld(f["src"], "f_auto,q_auto,w_1600")}"><img src="{cld(f["src"], "f_auto,q_auto,w_600")}" alt="{f.get("alt","Fotografía de calle en Madrid")}" loading="lazy" width="600" height="800"></button>' for f in datos['galeria'])}
        </div>
      </div>
    </section>'''
    escribir('/', pagina('/', 'Mirar Despacio · Fotografía callejera en Madrid: podcast, salidas y tutorías',
        'Mirar Despacio es un proyecto de fotografía callejera en Madrid: podcast, salidas fotográficas en grupo, tutorías y una comunidad para aprender a mirar antes de disparar.',
        cuerpo, schema=[{"@type": "WebSite", "@id": DOM + "/#web", "url": DOM + "/", "name": "Mirar Despacio", "inLanguage": "es-ES", "publisher": {"@id": DOM + "/#org"}}],
        extra_pie=PROXIMA_JS + MAPA_JS))

    # ------------------------------------------------------------ PODCAST
    lista = '\n'.join(
        f'''          <li class="episodio"><span class="n">{n}</span><div><h3>{f'<a href="{EPISODIO_URL[n]}">{t}</a>' if EPISODIO_URL.get(n) else t}</h3>{f"<p>{d}</p>" if d else ""}</div></li>'''
        for n, t, d in EPISODIOS_T1)
    plataformas = ''.join(f'<a class="boton{" color" if i == 0 else " claro"}" href="{u}" data-umami-event="podcast-{nombre.lower().split()[0]}">{nombre}</a>'
                          for i, (nombre, u) in enumerate([x for x in PLATAFORMAS if x[1]]))
    cuerpo = f'''
    <section class="portada">
      <div class="envoltura estrecho">
        <p class="antetitulo">Podcast</p>
        <h1>El podcast de <em>Mirar Despacio.</em></h1>
        <p class="entradilla">Un podcast en español sobre fotografía callejera, atención y esas cosas pequeñas que se nos escapan cuando vamos con prisa. Episodios cortos, para escuchar paseando o en el metro. No hace falta saber de fotografía.</p>
        <div class="botones">{plataformas}</div>
        <iframe title="Mirar Despacio #1 en Spotify" style="border-radius:12px;border:0;width:100%;margin-top:36px;" src="https://open.spotify.com/embed/episode/1uNhbeNInYusHKHv8UpA0m?theme=0" height="352" loading="lazy" allow="clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>
      </div>
    </section>

    <section class="seccion papel">
      <div class="envoltura estrecho">
        <p class="antetitulo">Temporada 2 · en marcha</p>
        <h2>Técnica, análisis <em>y conversaciones.</em></h2>
        <p>La segunda temporada son 15 episodios, uno cada dos semanas, que rotan entre tres formatos: un episodio técnico, uno de análisis de la obra de un fotógrafo y una conversación con alguien que mira el mundo desde otro sitio. El formato lo decidisteis vosotros en una encuesta que acabó en empate perfecto a tres bandas.</p>
        <p>El primer bloque va de fotografía analógica: la disciplina de tener solo 36 fotos, el análisis de un autor japonés y una entrevista que seguro que os parece muy interesante.</p>
      </div>
    </section>

    <section class="seccion">
      <div class="envoltura estrecho">
        <p class="antetitulo">Temporada 1 · 20 episodios</p>
        <h2>Todos los <em>episodios.</em></h2>
        <p>Veinte episodios sobre empezar en la fotografía de calle, el miedo a mirar, la ética de fotografiar a desconocidos y lo que pasa después: publicar, el algoritmo, el estilo y el proyecto.</p>
        <ol class="episodios">
{lista}
        </ol>
        <p style="margin-top:28px;">La temporada terminó convertida en <a href="/zine/">un zine impreso</a> con las fotos y las ideas que más resonaron.</p>
      </div>
    </section>'''
    podcast_schema = {
        "@type": "PodcastSeries", "@id": DOM + "/podcast/#podcast", "name": "Mirar Despacio",
        "url": DOM + "/podcast/", "inLanguage": "es",
        "description": "Podcast en español sobre fotografía callejera, atención y mirar la ciudad con calma.",
        "webFeed": SPOTIFY, "author": {"@type": "Person", "name": "Otto Kols"},
        "publisher": {"@id": DOM + "/#org"}, "sameAs": [u for _, u in PLATAFORMAS if u],
        "hasPart": [dict({"@type": "PodcastEpisode", "episodeNumber": n, "name": t,
                     "partOfSeason": {"@type": "PodcastSeason", "seasonNumber": 1}}, **({"url": EPISODIO_URL[n]} if EPISODIO_URL.get(n) else {})) for n, t, _ in EPISODIOS_T1],
    }
    podcast_schema.pop("webFeed")  # sin RSS público conocido todavía
    escribir('/podcast/', pagina('/podcast/', 'Podcast de fotografía callejera · Mirar Despacio',
        'Mirar Despacio, el podcast en español sobre fotografía callejera: miedo a mirar, ética en la calle, publicar, estilo propio. Episodios cortos para escuchar paseando.',
        cuerpo, schema=[podcast_schema]))

    # ------------------------------------------------------------ SALIDAS
    cuerpo = f'''
    <section class="portada">
      <div class="envoltura">
        <p class="antetitulo">Salidas fotográficas · Madrid</p>
        <h1>Salidas fotográficas <em>en Madrid.</em></h1>
        <p class="entradilla">Una mañana recorriendo un barrio de Madrid en grupo, con la cámara, sin prisa y sin clases. Al final nos sentamos a ver las fotos juntos.</p>
        <p style="font-size:1.1rem;"><strong>Próxima salida:</strong> <span data-proxima>cargando…</span></p>
        <div class="botones"><a class="boton color" href="#apuntarse">Apuntarme</a><a class="boton claro" href="#como-funciona">Cómo funciona</a></div>
        <div class="carrusel" data-visor data-galeria-salidas style="margin-top:40px;"></div>
      </div>
    </section>

    <section class="seccion papel" id="apuntarse">
      <div class="envoltura rejilla-2" style="gap:48px;">
        <div>
          <p class="antetitulo">Inscripción</p>
          <h2>Apúntate a la <em>próxima salida.</em></h2>
          <p style="font-size:1.1rem;"><strong data-proxima>Cargando fecha…</strong></p>
          <p>Las plazas son limitadas para que el grupo no sea enorme. Van por orden de inscripción y al momento te llega un email diciéndote si tienes plaza o estás en lista de espera.</p>
          <p>Si eres de <a href="/mirar-despacio-plus/">Mirar Despacio+</a>, la salida está incluida y tienes plaza reservada.</p>
          <p class="aviso">Durante las salidas se hacen fotos del grupo. Al apuntarte aceptas que puedan usarse para documentar y dar a conocer Mirar Despacio en la web y en redes, nunca para uso comercial de terceros. Puedes retirar el consentimiento cuando quieras escribiendo a <a href="mailto:{EMAIL}">{EMAIL}</a>.</p>
        </div>
        <div>
          <form class="formulario" action="{FORMSPREE}" method="POST" data-formspree data-inscripcion="https://ottokols.es/.netlify/functions/inscripcion" data-ok="okSalida" data-evento="salida-inscripcion">
            <div aria-hidden="true" style="position:absolute;left:-9999px;"><label>No rellenes esto <input type="text" name="web" tabindex="-1" autocomplete="off"></label></div>
            <input type="hidden" name="_subject" value="Inscripción salida · mirardespacio.es">
            <input type="hidden" name="origen" value="mirardespacio.es/salidas">
            <div class="rejilla-2" style="gap:16px;">
              <div><label for="nombre">Nombre *</label><input type="text" id="nombre" name="nombre" required autocomplete="given-name"></div>
              <div><label for="apellidos">Apellidos *</label><input type="text" id="apellidos" name="apellidos" required autocomplete="family-name"></div>
            </div>
            <div><label for="email">Email *</label><input type="email" id="email" name="email" required autocomplete="email"></div>
            <div><label for="telefono">Teléfono</label><input type="tel" id="telefono" name="telefono" autocomplete="tel" inputmode="tel">
              <p class="aviso" style="margin:6px 0 0">Para añadirte a la comunidad de WhatsApp de Mirar Despacio, donde aviso de las salidas y compartimos fotos.</p></div>
            <div><label for="instagram">Instagram</label><input type="text" id="instagram" name="instagram" placeholder="@tu_usuario"></div>
            <div><label for="camara">¿Con qué haces fotos?</label>
              <select id="camara" name="camara"><option value="">Elige…</option><option>Réflex o mirrorless</option><option>Compacta o analógica</option><option>Móvil</option><option>Lo que tenga a mano</option></select></div>
            <div><label for="mensaje">¿Algo que quieras contarme?</label><textarea id="mensaje" name="mensaje" rows="3"></textarea></div>
            <label class="check"><input type="checkbox" name="acepta_imagen" value="si" required> Acepto el uso de imagen descrito a la izquierda.</label>
            <label class="check"><input type="checkbox" name="acepta_datos" value="si" required> Acepto que uses mis datos solo para gestionar la inscripción, avisarme de las salidas y, si he dejado mi teléfono, añadirme a la comunidad. No se ceden a nadie.</label>
            <div><button class="boton" type="submit">Quiero apuntarme</button></div>
          </form>
          <div class="ok" id="okSalida"><strong>¡Hecho!</strong> <span data-ok-texto>Te escribo para confirmarte la plaza y el punto de encuentro.</span></div>
        </div>
      </div>
    </section>

    <section class="seccion">
      <div class="envoltura estrecho">
        <span class="nota">para quién es</span>
        <p class="cita" style="margin-top:12px;">Para cualquiera que tenga ganas de salir a mirar.</p>
        <p style="margin-top:24px;">Da igual si llevas años disparando o si es la primera vez que sales a hacer fotos, y da igual con qué: réflex, compacta, analógica o el móvil. Las tarjetas de misión se adaptan a cada nivel, y lo importante no es la técnica sino pararse a mirar.</p>
        <div class="rejilla-2" style="margin-top:28px;">
          <div><h3>Encontrarás</h3><ul class="lista"><li>Hacer fotos en grupo, cada uno a su ritmo</li><li>Tarjetas de misión que te sacan de tus costumbres</li><li>Gente con la que compartir lo que has visto</li><li>Perder el miedo a la calle y a la cámara</li></ul></div>
          <div><h3>No encontrarás</h3><ul class="lista no"><li>Un examen ni un nivel mínimo</li><li>Un precio cerrado</li><li>Prisa</li></ul></div>
        </div>
      </div>
    </section>

    <section class="seccion papel" id="como-funciona">
      <div class="envoltura">
        <p class="antetitulo">Cómo funciona</p>
        <h2>Una mañana, <em>de 10 a 13.</em></h2>
        <p class="entradilla">Unas tres horas en total. A veces el visionado se alarga con unas cañas.</p>
        <div class="rejilla-2" style="margin-top:32px;">
          <div class="tarjeta"><span class="num">01</span><h3>Quedada y paseo</h3><p>Nos vemos en un punto del barrio y caminamos sin prisa y sin guion, parando donde algo nos llame.</p></div>
          <div class="tarjeta"><span class="num">02</span><h3>Tarjetas de misión</h3><p>Al empezar, cada persona recibe una tarjeta con una propuesta: un concepto, una restricción, una forma de mirar. Puedes seguirla, ignorarla o usarla de excusa. Nadie sabe la misión de los demás.</p></div>
          <div class="tarjeta"><span class="num">03</span><h3>Visionado</h3><p>Al terminar nos sentamos en una terraza a ver las fotos. Cada uno enseña las suyas y revela su misión. Aquí es donde pasa lo interesante: el mismo barrio, la misma luz, y miradas muy distintas.</p></div>
          <div class="tarjeta"><span class="num">04</span><h3>Contribución libre</h3><p>No hay precio. Si la mañana te ha aportado algo, pones lo que consideres. Si eres de Mirar Despacio+, ya está incluida.</p></div>
        </div>
        <h3 style="margin-top:44px;">Ejemplos de misión</h3>
        <p class="aviso">Las tarjetas van por colores según la dificultad, igual que las que reparto en papel.</p>
        <div class="rejilla-3" style="margin-top:16px;">
          <div class="tarjeta mision verde"><span class="nivel">Fácil</span><h3>La sombra, no el objeto</h3><p>Fotografía sombras sin que aparezca lo que las proyecta.</p></div>
          <div class="tarjeta mision amarilla"><span class="nivel">Medio</span><h3>Espera, no busques</h3><p>Quédate al menos cinco minutos en un encuadre. Fotografía lo que pase dentro.</p></div>
          <div class="tarjeta mision roja"><span class="nivel">Difícil</span><h3>Una historia en tres fotos</h3><p>Una secuencia de exactamente tres imágenes que se entienda en orden.</p></div>
        </div>
      </div>
    </section>



    <section class="seccion papel">
      <div class="envoltura estrecho" style="text-align:center;">
        <span class="nota">¿has visto una pegatina?</span>
        <p style="margin-top:10px;">Márcala en el <a href="/#mapa-pegatinas">mapa de pegatinas</a> de la portada.</p>
      </div>
    </section>

    <section class="seccion">
      <div class="envoltura estrecho">
        <p class="antetitulo">Preguntas</p>
        <h2>Lo que <em>me preguntáis.</em></h2>
        {''.join(f'<h3 style="margin-top:28px;">{q}</h3><p>{a}</p>' for q, a in FAQ_SALIDAS)}
      </div>
    </section>'''
    faq_schema = {"@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in FAQ_SALIDAS]}
    escribir('/salidas/', pagina('/salidas/', 'Salidas fotográficas en Madrid · Mirar Despacio',
        'Salidas de fotografía callejera en grupo por barrios de Madrid, de 10 a 13: paseo, tarjetas de misión y visionado de fotos al final. Contribución libre, cualquier cámara vale.',
        cuerpo, schema=[faq_schema], og_img=cld(datos['galeria'][1]['src'], 'f_auto,q_auto,w_1200'),
        extra_pie=g['PROXIMA_JS'] + EVENTO_JS + GALERIA_JS))

    # ------------------------------------------------------------ TUTORÍAS
    cuerpo = f'''
    <section class="portada">
      <div class="envoltura estrecho">
        <p class="antetitulo">Tutorías · Madrid y online</p>
        <h1>Tutorías de <em>fotografía.</em></h1>
        <p class="entradilla">Una sesión a solas conmigo para resolver lo que te frena: entender tu cámara, la luz, la composición o qué hacer con tus fotos. No es una clase con temario. Partimos de lo que tú necesitas.</p>
        <div class="botones"><a class="boton color" href="#reservar">Pedir una tutoría</a></div>
      </div>
    </section>

    <section class="seccion papel">
      <div class="envoltura">
        <div class="rejilla-2">
          <div class="tarjeta">
            <span class="antetitulo" style="margin:0">Una hora</span>
            <p class="precio">40 €</p>
            <p>Para una duda concreta: dominar tu cámara, un problema de luz, una revisión rápida de tus fotos.</p>
            <ul class="datos"><li><span>Presencial en Madrid</span><span>40 €</span></li><li><span>Online</span><span>30 €</span></li></ul>
          </div>
          <div class="tarjeta" style="border-color:var(--tinta);">
            <span class="antetitulo" style="margin:0">Dos horas · la más pedida</span>
            <p class="precio">70 €</p>
            <p>Tiempo para la teoría y para practicarla. En presencial, la segunda hora la hacemos en la calle disparando.</p>
            <ul class="datos"><li><span>Presencial en Madrid</span><span>70 €</span></li><li><span>Online</span><span>50 €</span></li></ul>
          </div>
        </div>
        <p style="margin-top:22px;"><span class="nota" style="font-size:1.35rem;">incluye</span> un mes de acceso a <a href="/mirar-despacio-plus/">Mirar Despacio+</a>, para que sigas practicando después.</p>
      </div>
    </section>

    <section class="seccion">
      <div class="envoltura rejilla-2" style="gap:48px;">
        <div>
          <p class="antetitulo">Qué podemos ver</p>
          <h2>Lo que tú <em>necesites.</em></h2>
          <ul class="lista">
            <li>Tu cámara, de verdad: modos, enfoque, medición y los ajustes que importan</li>
            <li>El triángulo de exposición sin fórmulas de memoria</li>
            <li>Leer la luz: dura, suave, contraluz, noche</li>
            <li>Composición y cómo romperla con intención</li>
            <li>Fotografía de calle: perder la vergüenza y acercarte</li>
            <li>Revisión de tus fotos y de tu selección</li>
          </ul>
        </div>
        <div>
          <p class="antetitulo">Cómo funciona</p>
          <h2>Tres <em>pasos.</em></h2>
          <ol class="lista" style="counter-reset:none;">
            <li><strong>Me escribes</strong> con qué cámara usas y qué te gustaría trabajar.</li>
            <li><strong>Te propongo día y lugar</strong>, o enlace si es online. Si hace falta, me estudio antes tu modelo de cámara.</li>
            <li><strong>Hacemos la sesión</strong> y te llevas deberes y un mes de Mirar Despacio+.</li>
          </ol>
        </div>
      </div>
    </section>

    <!-- TESTIMONIO: cuando tengas permiso de la alumna para publicar su reseña, descomenta este bloque.
    <section class="seccion papel">
      <div class="envoltura estrecho">
        <p class="cita">«Texto de la reseña»</p>
        <p class="cita-autor">— Nombre, tutoría de 2 horas</p>
      </div>
    </section>
    -->

    <section class="seccion" id="reservar">
      <div class="envoltura estrecho">
        <p class="antetitulo">Reservar</p>
        <h2>Pide tu <em>tutoría.</em></h2>
        <form class="formulario" action="{FORMSPREE}" method="POST" data-formspree data-ok="okTutoria" data-evento="tutoria-solicitud">
          <input type="hidden" name="_subject" value="Solicitud de tutoría · mirardespacio.es">
          <input type="hidden" name="origen" value="mirardespacio.es/tutorias">
          <div><label for="t-nombre">Nombre *</label><input type="text" id="t-nombre" name="nombre" required autocomplete="name"></div>
          <div><label for="t-email">Email *</label><input type="email" id="t-email" name="email" required autocomplete="email"></div>
          <div><label for="t-formato">Formato</label><select id="t-formato" name="formato"><option>Presencial en Madrid</option><option>Online</option><option>Me da igual</option></select></div>
          <div><label for="t-duracion">Duración</label><select id="t-duracion" name="duracion"><option>2 horas</option><option>1 hora</option></select></div>
          <div><label for="t-camara">¿Qué cámara usas?</label><input type="text" id="t-camara" name="camara" placeholder="Modelo, o móvil"></div>
          <div><label for="t-mensaje">¿Qué te gustaría trabajar? *</label><textarea id="t-mensaje" name="mensaje" rows="4" required></textarea></div>
          <label class="check"><input type="checkbox" name="acepta_datos" value="si" required> Acepto que uses mis datos solo para responder a esta solicitud.</label>
          <div><button class="boton" type="submit">Enviar solicitud</button></div>
        </form>
        <div class="ok" id="okTutoria"><strong>Recibido.</strong> Te contesto en un par de días con propuesta de fecha.</div>
      </div>
    </section>'''
    tut_schema = {
        "@type": "Service", "name": "Tutorías de fotografía", "serviceType": "Tutoría de fotografía individual",
        "provider": {"@id": DOM + "/#org"}, "areaServed": ["Madrid", "Online"], "url": DOM + "/tutorias/",
        "offers": [
            {"@type": "Offer", "name": "Tutoría presencial de 1 hora", "price": "40", "priceCurrency": "EUR"},
            {"@type": "Offer", "name": "Tutoría presencial de 2 horas", "price": "70", "priceCurrency": "EUR"},
            {"@type": "Offer", "name": "Tutoría online de 1 hora", "price": "30", "priceCurrency": "EUR"},
            {"@type": "Offer", "name": "Tutoría online de 2 horas", "price": "50", "priceCurrency": "EUR"},
        ],
    }
    escribir('/tutorias/', pagina('/tutorias/', 'Tutorías de fotografía en Madrid y online · Mirar Despacio',
        'Tutorías de fotografía individuales, presenciales en Madrid u online: tu cámara, la luz, composición y fotografía de calle. Presencial desde 40 €, online desde 30 €.',
        cuerpo, schema=[tut_schema]))

    # ------------------------------------------------------------ TALLERES
    import json as _json, os as _os
    td = _json.load(open(_os.path.join(_os.path.dirname(__file__), '..', 'MirarDespacio', 'talleres-data.json')))
    def tarjeta_taller(i, t):
        temas = ''.join(f'<li>{html.escape(x)}</li>' for x in t['temas'])
        incluye = ''.join(f'<li>{html.escape(x)}</li>' for x in t['incluye'])
        return f"""
          <article class="tarjeta taller" id="{t['id']}">
            <span class="num">0{i}</span>
            <h3>{html.escape(t['titulo'])}</h3>
            <p class="sub">{html.escape(t['subtitulo'])}</p>
            <p class="precio" data-taller-precio="{t['id']}">{t['precio']} €</p>
            <ul class="datos"><li><span>Duración</span><span>{html.escape(t['duracion'])}</span></li><li><span>Grupo</span><span>{t['plazas']} personas como mucho</span></li></ul>
            <p style="margin-top:14px;">{html.escape(t['descripcion'])}</p>
            <p class="aviso">{html.escape(t['nivel'])}.</p>
            <details><summary>Qué vemos</summary><ul class="lista">{temas}</ul></details>
            <details><summary>Qué incluye</summary><ul class="lista">{incluye}</ul></details>
            <p class="antetitulo" style="margin:18px 0 8px;">Próximas fechas</p>
            <div data-ediciones="{t['id']}"><p class="aviso" style="margin:0">Cargando fechas…</p></div>
            <a class="boton claro" style="margin-top:14px;" data-bono="{t['id']}" href="mailto:{EMAIL}?subject=Quiero%20regalar%20el%20taller%20{html.escape(t['titulo'])}">🎁 Regalar este taller</a>
          </article>"""
    cuerpo = f"""
    <section class="portada">
      <div class="envoltura estrecho">
        <p class="antetitulo">Talleres · Madrid</p>
        <h1>Aprender <em>disparando.</em></h1>
        <p class="entradilla">Talleres de 3 a 4 horas por las calles de Madrid, en grupos de {max(t['plazas'] for t in td['talleres'])} personas como mucho. Mucha práctica, poca teoría y alguien al lado para resolver dudas en el momento.</p>
        <p><span class="nota" style="font-size:1.35rem;">te llevas</span> un manual impreso, pegatinas y un mes de <a href="/mirar-despacio-plus/">Mirar Despacio+</a> para seguir practicando.</p>
        <div class="botones"><a class="boton" href="#talleres">Ver talleres</a><a class="boton claro" href="/regalo/">🎁 Regalar un taller</a></div>
      </div>
    </section>

    <section class="seccion papel" id="talleres">
      <div class="envoltura">
        <div class="rejilla-3 talleres">{''.join(tarjeta_taller(i + 1, t) for i, t in enumerate(td['talleres']))}
        </div>
      </div>
    </section>

    <section class="seccion">
      <div class="envoltura rejilla-2" style="gap:48px;">
        <div>
          <p class="antetitulo">Para regalar</p>
          <h2>Un regalo que se <em>usa.</em></h2>
          <p>Cualquier taller se puede regalar. Te llega al momento una tarjeta regalo con un código para imprimir o reenviar, y quien la recibe elige la fecha que le venga bien. El código vale un año.</p>
          <div class="botones"><a class="boton color" href="/regalo/">Ver regalos</a></div>
        </div>
        <div>
          <p class="antetitulo">¿Te han regalado un taller?</p>
          <h2>Canjea tu <em>código.</em></h2>
          <form class="formulario" action="/regalo/" method="get">
            <div><label for="c">Código del regalo</label><input type="text" id="c" name="c" placeholder="MD-XXXX-XXXX" required autocomplete="off"></div>
            <div><button class="boton" type="submit">Canjear</button></div>
          </form>
        </div>
      </div>
    </section>

    <section class="seccion">
      <div class="envoltura estrecho">
        <p class="antetitulo">Preguntas</p>
        <h2>Antes de <em>reservar.</em></h2>
        <details class="faq"><summary>¿Necesito una cámara buena?</summary><p>No. Vale cualquier cámara que te deje cambiar ajustes, y en los talleres nocturno y de atardecer también el móvil si lo usas en modo manual. Para el de primeros pasos, trae la cámara que quieras aprender a usar: réflex, mirrorless o compacta. Y para el de composición vale cualquier cosa, también el móvil.</p></details>
        <details class="faq"><summary>¿Cómo se paga?</summary><p>Al reservar, por Ko-fi, con tarjeta o PayPal. Te llega al momento un email con la confirmación y, unos días antes, otro con el punto de encuentro.</p></details>
        <details class="faq"><summary>¿Y si al final no puedo ir?</summary><p>Escríbeme cuanto antes a <a href="mailto:{EMAIL}">{EMAIL}</a> y lo hablamos.</p></details>
        <details class="faq"><summary>¿En qué se diferencian de las salidas?</summary><p>Las salidas son paseos en grupo con retos, gratuitos y con contribución libre al final. Los talleres son más cortos de grupo, con un tema concreto, explicación y práctica guiada, y te llevas material.</p></details>
      </div>
    </section>"""
    taller_schema = {
        "@type": "Service", "name": "Talleres de fotografía callejera", "serviceType": "Taller de fotografía",
        "provider": {"@id": DOM + "/#org"}, "areaServed": "Madrid", "url": DOM + "/talleres/",
        "offers": [{"@type": "Offer", "name": "Taller " + t['titulo'], "price": str(t['precio']), "priceCurrency": "EUR"} for t in td['talleres']],
    }
    escribir('/talleres/', pagina('/talleres/', 'Talleres de fotografía callejera en Madrid · Mirar Despacio',
        'Talleres de fotografía callejera en Madrid: nocturna, atardecer, composición y primeros pasos con tu cámara. Grupos reducidos, mucha práctica, manual impreso y un mes de Mirar Despacio+. También para regalar.',
        cuerpo, schema=[taller_schema], extra_pie=TALLERES_JS))

    # ------------------------------------------------------------ REGALO
    regalos_t = ''.join(f"""<li><span>Taller {html.escape(t['titulo'])}</span><span><span data-taller-precio="{t['id']}">{t['precio']} €</span> · <a data-bono="{t['id']}" href="mailto:{EMAIL}?subject=Quiero%20regalar%20el%20taller%20{html.escape(t['titulo'])}">Regalar</a></span></li>""" for t in td['talleres'])
    regalos_p = ''.join(f"""<li><span>Mirar Despacio+ · {r['meses']} {'mes' if r['meses'] == 1 else 'meses'}{' con salidas' if r['nivel'] == 'con-salidas' else ''}</span><span><span data-regalo-plus-precio="{r['id']}">{r['precio']} €</span> · <a data-regalo-plus="{r['id']}" href="mailto:{EMAIL}?subject=Quiero%20regalar%20Mirar%20Despacio%2B">Regalar</a></span></li>""" for r in td['regalosPlus'])
    cuerpo = f"""
    <section class="portada" id="regalo">
      <div class="envoltura estrecho">
        <div id="sinCodigo" hidden>
          <p class="antetitulo">Regalos</p>
          <h1>Regala <em>mirar despacio.</em></h1>
          <p class="entradilla">Un taller o unos meses de Mirar Despacio+. Al pagar te llega al momento una tarjeta regalo con un código, para imprimir o reenviar. Quien la recibe la canjea aquí y elige fecha. Vale un año.</p>
          <ul class="datos" style="margin-top:28px;">{regalos_t}{regalos_p}</ul>
          <div style="margin-top:56px;">
            <p class="antetitulo">¿Te han regalado algo?</p>
            <h2>Canjea tu <em>código.</em></h2>
            <form class="formulario" id="verCodigo" style="max-width:420px;">
              <div><label for="codigoInput">Código del regalo</label><input type="text" id="codigoInput" placeholder="MD-XXXX-XXXX" required autocomplete="off"></div>
              <p class="aviso" id="codigoError" hidden style="margin:0">No encuentro ese código. Revisa que esté bien escrito.</p>
              <div><button class="boton" type="submit">Ver mi regalo</button></div>
            </form>
          </div>
        </div>

        <div id="conCodigo" hidden>
          <div class="tarjeta-regalo">
            <img src="{cld(g['LOGO'], 'w_200')}" alt="Mirar Despacio" width="96" height="96">
            <p class="nota">un regalo para</p>
            <input class="campo-regalo para" type="text" placeholder="Nombre" aria-label="Para">
            <p class="r-titulo" id="rTitulo">Un regalo</p>
            <textarea class="campo-regalo dedicatoria" rows="2" placeholder="Escribe aquí una dedicatoria (opcional)" aria-label="Dedicatoria"></textarea>
            <p class="r-de">de <input class="campo-regalo de" type="text" placeholder="tu nombre" aria-label="De"></p>
            <p class="r-codigo">Código <strong id="rCodigo"></strong></p>
            <p class="r-pie"><span id="rCaduca"></span> · Canjéalo en mirardespacio.es/regalo</p>
          </div>
          <div class="botones no-imprimir" style="justify-content:center;"><button class="boton claro" type="button" id="imprimir">Imprimir o guardar en PDF</button></div>

          <div id="canje" class="no-imprimir" style="margin-top:56px;">
            <p class="antetitulo">Canjear</p>
            <h2>Tus <em>datos.</em></h2>
            <form class="formulario" id="canjeForm" hidden>
              <div aria-hidden="true" style="position:absolute;left:-9999px;"><label>No rellenes esto <input type="text" name="web" tabindex="-1" autocomplete="off"></label></div>
              <div id="rEdicionCampo" hidden><label for="rEdicion">Elige fecha *</label><select id="rEdicion" name="edicion"></select></div>
              <div class="rejilla-2" style="gap:16px;">
                <div><label for="rNombre">Nombre *</label><input type="text" id="rNombre" name="nombre" required autocomplete="given-name"></div>
                <div><label for="rApellidos">Apellidos *</label><input type="text" id="rApellidos" name="apellidos" required autocomplete="family-name"></div>
              </div>
              <div><label for="rEmail">Email *</label><input type="email" id="rEmail" name="email" required autocomplete="email"></div>
              <div><label for="rTel">Teléfono</label><input type="tel" id="rTel" name="telefono" autocomplete="tel"></div>
              <label class="check"><input type="checkbox" name="acepta_datos" value="si" required> Acepto que uses mis datos solo para gestionar el regalo y avisarme de lo relacionado con él.</label>
              <div><button class="boton color" type="submit">Canjear mi regalo</button></div>
            </form>
            <div class="ok" id="regaloMsg" hidden></div>
          </div>
        </div>
      </div>
    </section>"""
    escribir('/regalo/', pagina('/regalo/', 'Regalos · Mirar Despacio',
        'Regala un taller de fotografía callejera o unos meses de Mirar Despacio+, o canjea el código de tu regalo.',
        cuerpo, extra_pie=TALLERES_JS))

    # ------------------------------------------------------------ ZINE
    cuerpo = f'''
    <section class="portada">
      <div class="envoltura estrecho">
        <p class="antetitulo">Zine · Temporada 1</p>
        <h1>El <em>zine.</em></h1>
        <p class="entradilla">La primera temporada del podcast, en papel. Un zine A5 de 36 páginas, grapado, con fotos de calle y las ideas que más resonaron en los 20 episodios.</p>
        <ul class="datos" style="max-width:460px;">
          <li><span>Formato</span><span>A5 · 36 páginas · grapado</span></li>
          <li><span>Disponibilidad</span><span>Quedan ejemplares</span></li>
          <li><span>Precio</span><span>12 € en mano en las salidas</span></li>
        </ul>
        <p style="margin-top:24px;">Si vienes a una salida te lo llevo en mano y te ahorras el envío. Si no, escríbeme y vemos cómo hacértelo llegar.</p>
        {''.join(f'<img src="{cld(u, "f_auto,q_auto,w_1000")}" alt="Páginas del zine de Mirar Despacio" loading="lazy" style="margin-top:20px;width:100%;">' for u in ZINE_FOTOS)}
        <div class="botones"><a class="boton" href="mailto:{EMAIL}?subject=Quiero%20un%20zine">Quiero uno</a><a class="boton claro" href="/salidas/">Próxima salida</a></div>
      </div>
    </section>'''
    escribir('/zine/', pagina('/zine/', 'Zine de fotografía callejera · Mirar Despacio',
        'Zine impreso de Mirar Despacio: la primera temporada del podcast de fotografía callejera en 36 páginas de fotos e ideas. A5, grapado, 12 €.', cuerpo))

    # ------------------------------------------------------------ MIRAR DESPACIO+
    cuerpo = f'''
    <section class="portada">
      <div class="envoltura estrecho">
        <p class="antetitulo">Comunidad</p>
        <h1>Mirar Despacio<em>+</em></h1>
        <p class="entradilla">Para quien quiere seguir mirando entre salida y salida. Una comunidad pequeña, con retos cada mes y alguien que mira tus fotos de verdad.</p>
        <div class="botones">
          <a class="boton color" href="#niveles">Ver precios</a>
          <a class="boton claro" href="{ACCESO}">Ya soy miembro · Entrar</a>
        </div>
      </div>
    </section>

    <section class="seccion" id="niveles">
      <div class="envoltura">
        <div class="rejilla-2">
          <div class="tarjeta"><h3>Mirar Despacio+</h3><p class="precio"><span data-plus-precio="sinSalidas">{td['plus']['sinSalidas']['precio']} €</span><small> /mes</small></p>
            <ul class="lista" style="margin-top:14px;"><li>Retos y guías cada mes</li><li>Feedback de tus fotos</li><li>Grupo privado</li><li>Herramientas y tarjetas de misión</li></ul>
            <a class="boton" data-plus-url="sinSalidas" data-umami-event="plus-interes" href="mailto:{EMAIL}?subject=Me%20interesa%20Mirar%20Despacio%2B">Me interesa</a></div>
          <div class="tarjeta"><h3>Mirar Despacio+ <em>con salidas</em></h3><p class="precio"><span data-plus-precio="conSalidas">{td['plus']['conSalidas']['precio']} €</span><small> /mes</small></p>
            <ul class="lista" style="margin-top:14px;"><li>Todo lo anterior</li><li><strong>Plaza asegurada en todas las salidas</strong>, sin aportación</li><li>Te enteras de las fechas antes que nadie</li></ul>
            <a class="boton color" data-plus-url="conSalidas" data-umami-event="plus-interes" href="mailto:{EMAIL}?subject=Me%20interesa%20Mirar%20Despacio%2B%20con%20salidas">Me interesa</a></div>
        </div>
        <p style="margin-top:22px;">Sin permanencia: te das de baja cuando quieras. ¿Es para otra persona? <a href="/regalo/">Regala Mirar Despacio+</a>.</p>
      </div>
    </section>

    <section class="seccion papel">
      <div class="envoltura">
        <div class="rejilla-3">
          <div class="tarjeta"><span class="num">01</span><h3>Retos y guías cada mes</h3><p>Un PDF mensual con un reto fotográfico y guías prácticas: calle, noche, retrato urbano, luz difícil.</p></div>
          <div class="tarjeta"><span class="num">02</span><h3>Salidas incluidas</h3><p>Plaza reservada en todas las salidas, sin pagar nada en ellas, antes de que se anuncie la fecha en público.</p></div>
          <div class="tarjeta"><span class="num">03</span><h3>Feedback de tus fotos</h3><p>Un reto cada mes y tu cuaderno de fotos: subes, te digo lo que veo, sin halagos de compromiso. Las mejores van al <a href="/muro/">muro</a>.</p></div>
          <div class="tarjeta"><span class="num">04</span><h3>Grupo privado</h3><p>Una comunidad de WhatsApp para compartir fotos y quedar. También si no vives en Madrid.</p></div>
          <div class="tarjeta"><span class="num">05</span><h3>Herramientas</h3><p>Calculadora de profundidad de campo, simulador visual, generador de retos y mapas de luz de Madrid.</p></div>
          <div class="tarjeta"><span class="num">06</span><h3>Tarjetas de misión</h3><p>Los packs de tarjetas de las salidas, para usarlos por tu cuenta.</p></div>
        </div>
      </div>
    </section>'''
    escribir('/mirar-despacio-plus/', pagina('/mirar-despacio-plus/', 'Mirar Despacio+ · Comunidad de fotografía callejera',
        'Mirar Despacio+ es la comunidad de fotografía callejera de Mirar Despacio: retos mensuales, prioridad en las salidas por Madrid, feedback de tus fotos y grupo privado.', cuerpo, extra_pie=TALLERES_JS))

    # ------------------------------------------------------------ MURO
    cuerpo = """
    <section class="portada">
      <div class="envoltura">
        <p class="antetitulo">Fotos de la comunidad</p>
        <h1>El <em>muro.</em></h1>
        <p class="entradilla">Fotos de la gente que viene a las salidas y de los miembros de Mirar Despacio+. Cada una con lo que vi en ella.</p>
      </div>
    </section>
    <section class="seccion">
      <div class="envoltura">
        <div class="muro-destacadas" id="muroDestacadas" hidden>
          <p class="antetitulo">Destacadas</p>
          <div class="muro-grid"></div>
        </div>
        <div class="muro-grid" id="muro"><p class="aviso">Cargando…</p></div>
      </div>
    </section>
    <section class="seccion papel">
      <div class="envoltura estrecho">
        <h2>¿Quieres que <em>comente las tuyas?</em></h2>
        <p>Si vienes a una salida, después te mando un enlace para subir tus fotos favoritas y te digo lo que veo en cada una. Los miembros de Mirar Despacio+ tienen además un reto cada mes.</p>
        <div class="botones"><a class="boton color" href="/salidas/">Apuntarme a una salida</a><a class="boton claro" href="/mirar-despacio-plus/">Mirar Despacio+</a></div>
      </div>
    </section>"""
    escribir('/muro/', pagina('/muro/', 'El muro · Fotos de la comunidad de Mirar Despacio',
        'Fotos de calle de la gente que viene a las salidas de Mirar Despacio en Madrid y de los miembros de Mirar Despacio+, con los comentarios de Otto.',
        cuerpo, extra_pie=MURO_JS))

    # ------------------------------------------------------------ JUEGO
    cuerpo = """
    <section class="portada">
      <div class="envoltura">
        <p class="antetitulo">Un descanso</p>
        <h1>El juego del <em>fotógrafo.</em></h1>
        <p class="entradilla">Vas por la calle y no paran de pasar cosas. Hazles la foto cuando entren en el visor o te arrollarán. Cada 15 segundos, un nivel más.</p>
        <div class="jugador">
          <label for="jugadorNombre">Tu nombre o tu @ de Instagram</label>
          <input type="text" id="jugadorNombre" maxlength="24" placeholder="@tu_usuario" autocomplete="nickname" autocapitalize="none" spellcheck="false">
          <span class="aviso" id="jugadorAviso" hidden>Escríbelo para poder jugar: tu puntuación se guarda sola al terminar.</span>
        </div>
        <canvas id="juego" class="juego" aria-label="Juego: haz fotos a lo que pasa por la calle"></canvas>
        <p class="aviso" style="margin-top:10px;">Espacio o clic para disparar · En el móvil, toca la pantalla · Foto centrada en el visor = puntos dobles · Varias cosas en la misma foto = bonus composición</p>
        <div class="rejilla-2" style="gap:40px;margin-top:20px;align-items:start;">
          <div>
            <p id="juegoResumen" style="min-height:1.6em;margin-top:0;"></p>
            <button class="boton" type="button" id="juegoCompartir" hidden style="margin-top:12px;">Retar a alguien</button>
          </div>
          <div>
            <p class="antetitulo">Top 10</p>
            <ol class="ranking" id="rankingLista"><li class="aviso">Cargando…</li></ol>
          </div>
        </div>
        <div class="botones"><a class="boton color" href="/salidas/">Ahora, en la calle de verdad</a><a class="boton claro" href="/">Volver al inicio</a></div>
      </div>
    </section>"""
    escribir('/juego/', pagina('/juego/', 'El juego del fotógrafo · Mirar Despacio',
        'Un pequeño juego de Mirar Despacio: un fotógrafo camina por la calle y tiene que fotografiar todo lo que pasa antes de que le arrolle.',
        cuerpo, extra_pie=JUEGO_JS))


    cuerpo = '''
    <section class="portada">
      <div class="envoltura estrecho">
        <span class="nota">vaya</span>
        <h1>Esta página <em>no existe.</em></h1>
        <p class="entradilla">A veces lo interesante está fuera del encuadre. Prueba por aquí:</p>
        <div class="botones"><a class="boton" href="/">Inicio</a><a class="boton claro" href="/salidas/">Salidas</a><a class="boton claro" href="/podcast/">Podcast</a></div>
        <p style="margin-top:28px;"><span class="nota" style="font-size:1.35rem;">o, ya que estás,</span> <a href="/juego/">echa una partida al juego del fotógrafo</a>.</p>
      </div>
    </section>'''
    escribir('/404', pagina('/404', 'Página no encontrada · Mirar Despacio', 'Esta página no existe.', cuerpo))


TALLERES_JS = '''
  <script src="/assets/talleres.js"></script>'''
MURO_JS = '''
  <script src="/assets/muro.js"></script>'''
JUEGO_JS = '''
  <script src="/assets/juego.js"></script>'''

MAPA_JS = '''
  <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>
  <script type="module" src="/assets/pegatinas.js"></script>'''
GALERIA_JS = '''
  <script src="/assets/galerias.js"></script>'''

FAQ_SALIDAS = [
    ("¿Cuánto cuesta una salida?", "No tiene precio fijo. Funciona como un free tour: al final cada persona contribuye lo que considere, y si ese día no puedes, no pasa nada. Si eres de Mirar Despacio+, la salida está incluida."),
    ("¿Necesito saber de fotografía o una cámara buena?", "No. Vienen personas con réflex, con compactas, con analógicas y con el móvil. Las tarjetas de misión se adaptan a cada nivel."),
    ("¿Cuánto dura?", "Unas tres horas, normalmente de 10:00 a 13:00: paseo y después visionado de fotos en una terraza. A veces se alarga con unas cañas. Las consumiciones las paga cada uno."),
    ("¿Dónde son las salidas?", "Cada salida es en un barrio distinto de Madrid: hasta ahora Barrio de las Letras, Malasaña, Chueca y Huertas. El punto de encuentro lo confirmo por email a quien se apunta."),
    ("¿Cuántas personas vienen?", "Somos grupos pequeños, de hasta unas diez personas, para que el ritmo sea tranquilo y dé tiempo a ver las fotos de todos."),
]

EVENTO_JS = '''
  <script>
    // Datos estructurados del próximo evento, generados desde salidas-data.json
    fetch('/salidas-data.json').then(function (r) { return r.json(); }).then(function (d) {
      // Solo si hay fecha real y todavía no ha pasado
      var pendiente = function (v) { return !v || /^por (determinar|confirmar|anunciar)/i.test(String(v).trim()); };
      var s = (d.proximas || []).filter(function (x) {
        return x.activa && x.fechaISO && !pendiente(x.fecha) && new Date(x.fechaISO).getTime() > Date.now();
      })[0];
      if (!s) return;
      // Fin: fechaFinISO si existe; si no, 3 horas después del inicio, manteniendo la zona horaria (+02:00)
      function sumarHoras(iso, h) {
        var m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?(.*)$/);
        if (!m) return iso;
        var dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] + h, +m[5]));
        var p = function (n) { return String(n).padStart(2, '0'); };
        return dt.getUTCFullYear() + '-' + p(dt.getUTCMonth() + 1) + '-' + p(dt.getUTCDate()) + 'T' + p(dt.getUTCHours()) + ':' + p(dt.getUTCMinutes()) + ':00' + (m[6] || '');
      }
      // Apertura de inscripciones: inscripcionDesdeISO si existe; si no, 30 días antes de la salida
      function restarDias(iso, n) {
        var m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?(.*)$/);
        if (!m) return iso;
        var dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] - n, 0, 0));
        var p = function (k) { return String(k).padStart(2, '0'); };
        return dt.getUTCFullYear() + '-' + p(dt.getUTCMonth() + 1) + '-' + p(dt.getUTCDate()) + 'T00:00:00' + (m[6] || '');
      }
      var zona = s.zona || 'Madrid';
      var foto = (d.galeria && d.galeria[0] && d.galeria[0].src) || 'https://res.cloudinary.com/dybxateci/image/upload/v1785276700/logoMD_gizjap.png';
      var ev = {
        "@context": "https://schema.org", "@type": "Event",
        "name": "Salida fotográfica Mirar Despacio · " + zona,
        "startDate": s.fechaISO,
        "endDate": s.fechaFinISO || sumarHoras(s.fechaISO, 3),
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "location": { "@type": "Place", "name": zona + ", Madrid",
          "address": { "@type": "PostalAddress", "addressLocality": "Madrid", "addressRegion": "Madrid", "addressCountry": "ES" } },
        "image": [foto.replace('/upload/', '/upload/f_auto,q_auto,w_1200/')],
        "description": "Salida de fotografía callejera en grupo por " + zona + ": paseo, tarjetas de misión y visionado de fotos. Contribución libre.",
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "EUR",
          "validFrom": s.inscripcionDesdeISO || restarDias(s.fechaISO, 30),
          "availability": "https://schema.org/InStock", "url": "https://mirardespacio.es/salidas/#apuntarse",
          "description": "Contribución libre al final de la salida" },
        "performer": { "@type": "Person", "name": "Otto Kols", "url": "https://ottokols.es/" },
        "organizer": { "@type": "Organization", "name": "Mirar Despacio", "url": "https://mirardespacio.es/" },
        "isAccessibleForFree": true, "url": "https://mirardespacio.es/salidas/"
      };
      var t = document.createElement('script');
      t.type = 'application/ld+json';
      t.textContent = JSON.stringify(ev);
      document.head.appendChild(t);
    }).catch(function () {});
  </script>'''
