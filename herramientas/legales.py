# Páginas legales de mirardespacio.es: privacidad, condiciones de venta y aviso legal.
# Lo llama paginas.py. Los datos del titular (nombre, NIF y domicilio) están arriba en generar.py.
import html


def construir_legales(g, escribir, pagina):
    EMAIL = g['EMAIL']
    TITULAR = g.get('TITULAR', '')
    NIF = g.get('NIF', '')
    DOMICILIO = g.get('DOMICILIO', '')
    ACT = g.get('ACTUALIZADO_LEGAL', 'noviembre de 2026')

    if not NIF:
        print('  ⚠️  Falta el NIF del titular (NIF en generar.py): las páginas legales lo marcan como pendiente.')

    def dato(v, falta):
        return html.escape(v) if v else f'<span class="pendiente">{falta}</span>'

    mail = f'<a href="mailto:{EMAIL}">{EMAIL}</a>'
    ficha = f'''<div class="ficha">
          <p><strong>Titular:</strong> {dato(TITULAR, 'nombre y apellidos pendientes')}</p>
          <p><strong>NIF:</strong> {dato(NIF, 'NIF pendiente')}</p>
          <p><strong>Domicilio:</strong> {dato(DOMICILIO, 'domicilio pendiente')}</p>
          <p><strong>Email:</strong> {mail}</p>
        </div>'''

    def portada(ante, titulo_html, entradilla):
        return f'''
    <section class="portada">
      <div class="envoltura estrecho">
        <p class="antetitulo">{ante}</p>
        <h1>{titulo_html}</h1>
        <p class="entradilla">{entradilla}</p>
      </div>
    </section>'''

    # ------------------------------------------------------------ PRIVACIDAD
    cuerpo = portada('Tus datos', 'Política de <em>privacidad.</em>',
                     'Qué datos recojo, para qué los uso, cuánto tiempo los guardo y cómo puedes pedir que los cambie o los borre. Sin letra pequeña.') + f'''
    <section class="seccion">
      <div class="envoltura estrecho texto-legal">
        <h2>Quién es el responsable</h2>
        <p>Mirar Despacio y ottokols.es son proyectos de fotografía de Otto Kols, que es quien decide qué se hace con tus datos y quien responde por ellos:</p>
        {ficha}

        <h2>Qué datos recojo y para qué</h2>
        <div class="tabla"><table>
          <tr><th>Cuándo</th><th>Qué datos</th><th>Para qué</th><th>Por qué puedo hacerlo</th></tr>
          <tr><td>Te apuntas a una salida</td><td>Nombre, apellidos, email y, si los das, teléfono, Instagram y con qué haces fotos</td><td>Gestionar tu plaza o la lista de espera, mandarte la confirmación y el punto de encuentro, avisarte de las salidas, mandarte después el enlace para subir tus fotos y, si dejas el teléfono, añadirte a la comunidad de WhatsApp</td><td>Tu consentimiento y la gestión de la actividad a la que te apuntas</td></tr>
          <tr><td>Reservas un taller, compras un regalo o te suscribes a Mirar Despacio+</td><td>Nombre, email, lo que compras, el importe y, si pides factura, tu NIF y tu dirección</td><td>Cobrar, darte tu plaza o tu acceso, mandarte los avisos de la actividad y hacer la factura</td><td>El contrato y la obligación legal de guardar las facturas</td></tr>
          <tr><td>Pides una tutoría o me escribes</td><td>Lo que pongas en el formulario o en el email</td><td>Contestarte y, si seguimos adelante, organizar la tutoría</td><td>Tu solicitud</td></tr>
          <tr><td>Eres de Mirar Despacio+</td><td>Tu cuenta (nombre y email), tus fotos, comentarios y retos hechos</td><td>Darte acceso, comentar tus fotos y mandarte lo relacionado con el servicio: el reto del mes, fechas de salidas y cambios en tu suscripción</td><td>El contrato</td></tr>
          <tr><td>Subes fotos</td><td>Las fotos y el nombre con el que las firmas</td><td>Comentarlas y, solo si tú lo marcas, mostrarlas en el muro público o en la galería de los retos</td><td>Tu consentimiento</td></tr>
          <tr><td>Marcas una pegatina en el mapa</td><td>La ubicación, la foto y el nombre si lo pones</td><td>Mostrar la pegatina en el mapa. La foto solo aparece si la apruebo</td><td>Tu consentimiento</td></tr>
          <tr><td>Juegas y apareces en el ranking</td><td>El nombre o usuario que elijas y tu puntuación</td><td>Mostrar el ranking</td><td>Tu consentimiento</td></tr>
          <tr><td>Marcas la casilla de novedades</td><td>Nombre y email</td><td>Escribirte sobre talleres y actividades nuevas</td><td>Tu consentimiento. Puedes darte de baja desde cualquier email</td></tr>
          <tr><td>Visitas la web</td><td>Páginas vistas, país aproximado y tipo de dispositivo, sin identificarte</td><td>Saber qué se lee y mejorar la web</td><td>Interés legítimo. Uso Umami, que no usa cookies</td></tr>
        </table></div>
        <p>No vendo tus datos, no los cedo a nadie para publicidad y no tomo decisiones automáticas sobre ti.</p>

        <h2>Fotos del grupo en las salidas y talleres</h2>
        <p>Durante las actividades hago fotos del grupo. Se pueden usar para documentar y dar a conocer Mirar Despacio en la web y en redes, nunca para uso comercial de terceros. Si no quieres aparecer, dímelo y retiro las fotos en las que salgas.</p>

        <h2>Cuánto tiempo los guardo</h2>
        <ul>
          <li><strong>Inscripciones y contacto:</strong> mientras participes en Mirar Despacio. Si pasa un año sin que vengas a nada ni me escribas, los borro.</li>
          <li><strong>Mirar Despacio+:</strong> mientras tengas cuenta.</li>
          <li><strong>Fotos:</strong> las de las salidas se borran del servidor a los 90 días, salvo las que estén en el muro. Las de los retos, cuando hay tres retos más nuevos.</li>
          <li><strong>Compras y facturas:</strong> seis años, porque así lo exige la ley.</li>
          <li><strong>Novedades:</strong> hasta que te des de baja.</li>
        </ul>
        <p>Si me pides que borre tus datos, los borro, salvo lo que la ley me obligue a guardar, como las facturas.</p>

        <h2>Con quién se comparten</h2>
        <p>Con nadie para su propio uso. Para que la web funcione uso servicios que guardan o tratan los datos por mí y solo para esto:</p>
        <ul>
          <li><strong>Netlify:</strong> la web y las cuentas de la zona de miembros.</li>
          <li><strong>Google Firebase:</strong> la lista de inscripciones, los miembros, el muro, el mapa de pegatinas y el ranking del juego.</li>
          <li><strong>Cloudinary:</strong> las fotos.</li>
          <li><strong>Brevo:</strong> el envío de emails.</li>
          <li><strong>Formspree:</strong> algunos formularios de contacto.</li>
          <li><strong>Stripe</strong> y, en algunos casos, <strong>Ko-fi:</strong> los pagos. Los datos de tu tarjeta los tratan ellos; yo nunca los veo.</li>
          <li><strong>WhatsApp:</strong> la comunidad, si das tu teléfono para entrar.</li>
          <li><strong>Mi gestoría</strong>, para la contabilidad, y <strong>Hacienda</strong> u otras administraciones cuando la ley lo exija.</li>
        </ul>
        <p>Algunos de estos servicios guardan datos fuera de la Unión Europea, sobre todo en Estados Unidos. Lo hacen con las garantías que exige la normativa: el Marco de Privacidad de Datos entre la UE y EE. UU. o las cláusulas contractuales tipo de la Comisión Europea. Ko-fi está en el Reino Unido, que la UE considera con un nivel de protección adecuado.</p>

        <h2>Cookies</h2>
        <p>Esta web no usa cookies de publicidad ni de seguimiento, por eso no te sale ningún aviso para aceptarlas:</p>
        <ul>
          <li><strong>Estadísticas:</strong> Umami cuenta las visitas sin cookies y sin identificarte.</li>
          <li><strong>Lo imprescindible:</strong> tu navegador guarda tu sesión si entras en la zona de miembros y tu récord si juegas. Sin eso esas partes no funcionarían, y no hace falta pedirte permiso para ello.</li>
          <li><strong>Reproductor de Spotify:</strong> no se carga hasta que pulsas para escuchar un episodio. A partir de ese momento, Spotify puede usar sus propias cookies según su política.</li>
          <li><strong>Tipografías y mapa:</strong> las tipografías se cargan desde Google Fonts y los mapas desde OpenStreetMap. Para mandártelas, esos servicios reciben la dirección IP de tu conexión, pero no instalan cookies.</li>
        </ul>

        <h2>Tus derechos</h2>
        <p>Escríbeme a {mail} y lo hago: ver qué datos tengo tuyos, corregirlos, borrarlos, dejar de usarlos para algo, limitar su uso o dártelos en un archivo para llevártelos a otro sitio. Si me diste tu consentimiento para algo, puedes retirarlo cuando quieras. Te contesto en menos de un mes.</p>
        <p>Si crees que algo no está bien hecho, dímelo y lo reviso. Y si no quedas conforme, puedes reclamar ante la <a href="https://www.aepd.es/">Agencia Española de Protección de Datos</a>.</p>

        <h2>Menores</h2>
        <p>Para apuntarte o crear una cuenta tienes que tener al menos 14 años. Si tienes menos de 18, para venir a una salida o a un taller necesitas el permiso de tu madre, padre o tutor.</p>

        <p class="aviso">Última actualización: {ACT}. Si cambio algo importante, lo verás aquí y, si te afecta como miembro o cliente, te lo diré por email.</p>
        <p class="aviso">Ver también: <a href="/condiciones/">condiciones de venta</a> y <a href="/aviso-legal/">aviso legal</a>.</p>
      </div>
    </section>'''
    escribir('/privacidad/', pagina('/privacidad/', 'Privacidad · Mirar Despacio',
        'Qué datos recoge Mirar Despacio, para qué los usa, cuánto tiempo los guarda y cómo puedes pedir que los cambie o los borre.', cuerpo))

    # ------------------------------------------------------------ CONDICIONES
    cuerpo = portada('Antes de reservar', 'Condiciones de <em>venta.</em>',
                     'Cómo funcionan las reservas, los pagos, los cambios y las devoluciones de talleres, tutorías, regalos y Mirar Despacio+. Al reservar o comprar, las aceptas.') + f'''
    <section class="seccion">
      <div class="envoltura estrecho texto-legal">
        <h2>Quién vende</h2>
        {ficha}

        <h2>Precios y pago</h2>
        <ul>
          <li>Los precios están en euros y llevan el IVA incluido.</li>
          <li>Se paga con tarjeta en la página de pago segura de Stripe. Yo nunca veo los datos de tu tarjeta.</li>
          <li>Al pagar te llega un email con la confirmación. Si necesitas factura con tus datos fiscales, pídemela a {mail}.</li>
        </ul>

        <h2>Salidas</h2>
        <p>Las salidas son gratuitas. Al final cada persona contribuye lo que considere, y si ese día no puede, no pasa nada. Las plazas son limitadas: cuando se llenan, entras en lista de espera por orden de inscripción. Si te apuntas y al final no puedes venir, avísame para dar tu plaza a otra persona. En Mirar Despacio+ con salidas, las salidas están incluidas.</p>

        <h2>Talleres</h2>
        <ul>
          <li><strong>Tu plaza</strong> queda reservada al pagar.</li>
          <li><strong>Mínimo de personas:</strong> cada taller necesita un mínimo para funcionar como grupo, que se indica en su ficha. Si 72 horas antes no se llega, te escribo y eliges: pasar tu plaza a la siguiente fecha de ese taller o la devolución íntegra.</li>
          <li><strong>Si no puedes ir y avisas con al menos 7 días de antelación:</strong> te devuelvo el importe entero o te paso la plaza a otra fecha, lo que prefieras.</li>
          <li><strong>Si avisas con menos de 7 días:</strong> ya tengo el material y el sitio preparados para ti, así que no hay devolución. Puedes pasar la plaza a otra fecha o regalársela a otra persona, avisándome antes del taller.</li>
          <li><strong>Si no vienes y no avisas,</strong> no hay devolución ni cambio de fecha.</li>
          <li><strong>Si lo tengo que cancelar o aplazar yo</strong> (por lluvia fuerte, enfermedad u otra causa justificada), eliges entre otra fecha o la devolución íntegra.</li>
        </ul>

        <h2>Tutorías</h2>
        <ul>
          <li>Me escribes, te propongo día y lugar (o enlace si es online) y, cuando lo cerramos, la tutoría se paga antes de la sesión.</li>
          <li>Puedes cambiar la fecha sin coste avisando con al menos 48 horas de antelación.</li>
          <li>Si avisas con menos de 48 horas o no te presentas, la tutoría se da por hecha.</li>
          <li>Si el que no puede soy yo, te propongo otra fecha o te devuelvo el importe, lo que prefieras.</li>
        </ul>

        <h2>Mirar Despacio+</h2>
        <ul>
          <li><strong>Qué incluye:</strong> lo que se describe en la <a href="/mirar-despacio-plus/">página de Mirar Despacio+</a> para el nivel que elijas.</li>
          <li><strong>Pago mensual:</strong> se cobra al suscribirte y después cada mes, el mismo día, hasta que te des de baja.</li>
          <li><strong>Sin permanencia:</strong> te das de baja cuando quieras desde tu área de pagos (el enlace está en los emails de Stripe y en la página de Mirar Despacio+) o escribiéndome. Sigues teniendo acceso hasta el final del mes ya pagado y no se te vuelve a cobrar. No se devuelve la parte de un mes ya empezado.</li>
          <li><strong>Cambios de precio:</strong> si el precio cambia, te aviso por email al menos 30 días antes, para que puedas darte de baja si no te encaja.</li>
          <li><strong>Meses de regalo:</strong> el mes de acceso que viene con una salida, un taller o una tutoría es gratis y no se convierte en suscripción de pago a menos que tú te suscribas.</li>
        </ul>

        <h2>Regalos</h2>
        <ul>
          <li>Al pagar te llega una tarjeta regalo con un código. Vale un año desde la compra.</li>
          <li>Quien la recibe la canjea en <a href="/regalo/">mirardespacio.es/regalo</a> y elige fecha, según las plazas que haya.</li>
          <li>El código no se puede cambiar por dinero.</li>
        </ul>

        <h2>Zine y productos impresos</h2>
        <ul>
          <li>Se pueden comprar en mano en las salidas y talleres. Si los pides por email y hay envío, te digo antes el coste y el plazo.</li>
          <li>Si te llega algo dañado o que no es lo que pediste, escríbeme en los 7 días siguientes con una foto y te lo cambio o te devuelvo el dinero, envío incluido.</li>
          <li>Los productos tienen la garantía legal de tres años.</li>
        </ul>

        <h2>Si te arrepientes de una compra online</h2>
        <p>Si compras a distancia como particular, la ley te da 14 días naturales para echarte atrás sin dar explicaciones:</p>
        <ul>
          <li><strong>Regalos:</strong> 14 días desde la compra, si el código no se ha canjeado.</li>
          <li><strong>Mirar Despacio+:</strong> 14 días desde tu primera suscripción. Como el acceso empieza en cuanto pagas porque así lo pides, te devuelvo la parte de los días que queden.</li>
          <li><strong>Productos enviados:</strong> 14 días desde que los recibes. Me los devuelves sin usar y el envío de vuelta corre de tu cuenta.</li>
        </ul>
        <p><strong>Talleres y tutorías:</strong> al ser actividades con una fecha concreta, la ley no da este derecho, pero se aplican las condiciones de cambio y devolución de arriba.</p>
        <p>Para echarte atrás, escríbeme a {mail} con tu nombre, lo que compraste y la fecha. Si lo prefieres, puedes usar este modelo: <em>«Comunico que desisto de mi compra de [lo que compraste], realizada el [fecha]. Nombre: [tu nombre]. Fecha: [hoy]».</em> Te devuelvo el dinero en menos de 14 días, por el mismo medio con el que pagaste.</p>

        <h2>Durante las actividades</h2>
        <ul>
          <li>Las salidas y la mayoría de los talleres son en la calle. Cada persona cuida de su equipo y de sus cosas.</li>
          <li>Respeta a las personas que fotografías: si alguien te pide que no le hagas fotos o que las borres, hazlo.</li>
          <li>Puedo pedir que deje la actividad a quien falte al respeto o ponga en riesgo al grupo, sin devolución.</li>
          <li>Las cámaras de llavero que presto en algunas salidas se devuelven al terminar.</li>
        </ul>

        <h2>Tus fotos y los materiales</h2>
        <p>Las fotos que haces son tuyas. Si las subes y marcas que salgan en el muro o en la galería de los retos, me dejas mostrarlas en la web y en las redes de Mirar Despacio, siempre con tu nombre. Puedes pedirme que las quite cuando quieras.</p>
        <p>Los manuales, guías, retos y demás materiales son para tu uso personal. No se pueden compartir, revender ni publicar sin permiso.</p>

        <h2>Si algo no va bien</h2>
        <p>Escríbeme a {mail} y lo solucionamos: te contesto lo antes posible y siempre en menos de un mes. Si no quedas conforme, tienes a tu disposición hojas de reclamaciones y puedes acudir a los servicios de consumo de tu comunidad autónoma. Estas condiciones se rigen por la ley española.</p>

        <p class="aviso">Última actualización: {ACT}.</p>
        <p class="aviso">Ver también: <a href="/privacidad/">privacidad</a> y <a href="/aviso-legal/">aviso legal</a>.</p>
      </div>
    </section>'''
    escribir('/condiciones/', pagina('/condiciones/', 'Condiciones de venta · Mirar Despacio',
        'Reservas, pagos, cambios y devoluciones de los talleres, tutorías, regalos y Mirar Despacio+.', cuerpo))

    # ------------------------------------------------------------ AVISO LEGAL
    cuerpo = portada('Quién está detrás', 'Aviso <em>legal.</em>',
                     'Los datos de quién es responsable de esta web y las normas básicas para usarla.') + f'''
    <section class="seccion">
      <div class="envoltura estrecho texto-legal">
        <h2>Titular</h2>
        <p>Las webs mirardespacio.es y ottokols.es son de:</p>
        {ficha}
        <p>Otto Kols es fotógrafo en Madrid. Con Mirar Despacio organiza salidas, talleres y tutorías de fotografía, la comunidad Mirar Despacio+, el podcast y publicaciones impresas. En ottokols.es ofrece sesiones de fotografía de retrato y encargos.</p>

        <h2>Uso de la web</h2>
        <p>Puedes usar la web libremente siempre que sea de forma respetuosa y legal. No está permitido intentar entrar en la zona de miembros o en los datos de otras personas sin permiso, alterar los juegos o el ranking, ni subir fotos o comentarios ofensivos o que no sean tuyos. Puedo retirar lo que no cumpla estas normas.</p>

        <h2>Fotos y contenidos</h2>
        <p>Las fotos, textos, juegos, guías y el diseño de la web son de Otto Kols, salvo las fotos de los participantes, que son de sus autores. No se pueden copiar ni usar sin permiso. Si quieres usar algo, escríbeme y lo hablamos.</p>

        <h2>Responsabilidad</h2>
        <p>Intento que todo lo que hay en la web sea correcto y esté al día, pero puede haber algún error o la web puede no estar disponible en algún momento. Los consejos de fotografía son orientativos. Los enlaces a otras webs, como Spotify, Instagram o Stripe, llevan a sitios que no controlo.</p>

        <h2>Datos personales y compras</h2>
        <p>Cómo trato tus datos está en la <a href="/privacidad/">política de privacidad</a>, y cómo funcionan las reservas y los pagos, en las <a href="/condiciones/">condiciones de venta</a>.</p>

        <h2>Ley aplicable</h2>
        <p>Esta web se rige por la ley española. Si eres consumidor, cualquier conflicto se resolverá en los juzgados de tu domicilio.</p>

        <p class="aviso">Última actualización: {ACT}.</p>
      </div>
    </section>'''
    escribir('/aviso-legal/', pagina('/aviso-legal/', 'Aviso legal · Mirar Despacio',
        'Titular de mirardespacio.es y ottokols.es y condiciones de uso de la web.', cuerpo))
