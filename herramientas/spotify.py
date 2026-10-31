# Reproductor de Spotify que no se carga hasta que la persona lo pide.
# Spotify instala sus propias cookies en cuanto se carga su reproductor, así que en la
# página solo se muestra un botón; al pulsarlo, md.js cambia el botón por el reproductor.
# Así no hace falta banner de cookies.
import html

def reproductor(sid, n, alto=352, estilo='', clase=''):
    src = f'https://open.spotify.com/embed/episode/{sid}?theme=0'
    titulo = f'Mirar Despacio #{n} en Spotify'
    return (f'<div class="{('spotify-fachada ' + clase).strip()}" style="min-height:{alto}px;{estilo}" '
            f'data-spotify="{src}" data-alto="{alto}" data-titulo="{html.escape(titulo)}">'
            f'<button type="button" class="spotify-cargar" data-umami-event="spotify-cargar">'
            f'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M10 8l6 4-6 4z" fill="currentColor"/></svg>'
            f'<span>Escuchar aquí</span></button>'
            f'<p>Al pulsar se carga el reproductor de Spotify, que usa sus propias cookies. '
            f'<a href="https://open.spotify.com/episode/{sid}">O ábrelo en Spotify</a>.</p></div>')
