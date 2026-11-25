/* Test «¿Qué fotógrafo de calle eres?» de Mirar Despacio.
 * 10 preguntas. Cada respuesta suma en 10 rasgos (blanco y negro, cercanía, humor, geometría,
 * espera, gente, intimidad, crudeza, poesía, mirada social). El resultado es el autor cuyo perfil
 * se parece más (similitud de coseno), más otros dos parecidos.
 * El resultado se puede compartir con ?r=<autor>. Todo pasa en el navegador: no se guarda nada. */
(function () {
  var RASGOS = ['bn', 'cerca', 'humor', 'geo', 'espera', 'gente', 'intimo', 'crudo', 'poesia', 'social'];

  // [id, nombre, dónde y cuándo, perfil (orden de RASGOS), cómo mira, tu reto, taller recomendado]
  var A = [
    ['cartier-bresson', 'Henri Cartier-Bresson', 'Francia · desde los años 30', [2,0,0,2,2,1,0,-1,1,0], 'Encuentra un escenario con buena geometría y espera a que alguien entre en el sitio justo. Para él la composición y el momento eran una misma cosa.', 'Busca un fondo con líneas claras (una escalera, una pared con sombras) y no te muevas de ahí hasta que pase alguien que lo complete.', 'composicion'],
    ['vivian-maier', 'Vivian Maier', 'Nueva York y Chicago · años 50-70', [1,1,1,0,0,2,1,0,0,1], 'Fotografiaba a la gente de su ciudad con cercanía y mucha curiosidad, y se hacía autorretratos en escaparates y sombras. Casi nadie vio su trabajo hasta después de su muerte.', 'Hazte un autorretrato en un reflejo o en tu sombra sin que se note que es una pose.', 'iniciacion'],
    ['saul-leiter', 'Saul Leiter', 'Nueva York · años 40-60', [-2,0,0,1,1,0,0,-1,2,-1], 'Color, lluvia, vaho y cristales. Fotografiaba a través de las cosas y dejaba que gran parte del encuadre quedara en sombra o desenfocada.', 'Dispara a través de un cristal (un escaparate, la ventanilla del autobús, un paraguas) y deja que lo de delante tape parte de la foto.', 'atardecer'],
    ['winogrand', 'Garry Winogrand', 'Estados Unidos · años 60-70', [2,1,1,-1,-1,2,-1,1,-1,1], 'Disparaba muchísimo, con gran angular y encuadres torcidos, para ver qué pasaba con las cosas al fotografiarlas. La calle como un caos lleno de energía.', 'Haz 100 fotos en una sola calle en una hora. Luego quédate con tres.', 'iniciacion'],
    ['erwitt', 'Elliott Erwitt', 'Estados Unidos y Europa · desde los años 50', [2,0,2,0,1,1,0,-1,0,0], 'El humor como forma de mirar: coincidencias, gestos y muchos perros. Fotos amables que hacen sonreír sin burlarse de nadie.', 'Busca una coincidencia graciosa entre una persona y lo que tiene detrás (un cartel, un animal, una estatua).', 'composicion'],
    ['meyerowitz', 'Joel Meyerowitz', 'Nueva York · años 60-70', [-2,0,1,0,0,1,0,0,1,0], 'Uno de los primeros en apostar por el color en la calle. Le interesan los gestos pequeños que pasan a la vez en distintos puntos del encuadre.', 'Busca una foto en la que pasen dos o tres cosas a la vez en distintas partes del encuadre.', 'atardecer'],
    ['alex-webb', 'Alex Webb', 'Caribe, México y EE. UU. · desde los años 70', [-2,0,0,2,2,1,-1,0,1,1], 'Fotos de color intenso con muchas capas: gente delante, en medio y al fondo, cada una en su hueco, con sombras muy duras.', 'Busca una escena con tres capas (cerca, medio, lejos) y espera a que haya algo en cada una.', 'composicion'],
    ['moriyama', 'Daido Moriyama', 'Tokio · desde los años 60', [2,1,-1,0,-2,0,-1,2,0,0], 'Grano, contraste, movimiento y desenfoque. Fotografía la ciudad como un perro callejero, sin pedir permiso a la técnica.', 'Sube el ISO, contrasta en blanco y negro y dispara sin mirar por el visor durante un paseo de noche.', 'nocturna'],
    ['gilden', 'Bruce Gilden', 'Nueva York · desde los años 80', [2,2,0,-1,-1,2,-1,2,-2,0], 'Muy cerca, con flash y sin disimulo. Retratos de calle que entran en la cara de la gente: un estilo que divide mucho a los fotógrafos.', 'Practica la cercanía sin flash: retrata a alguien a un metro, pidiendo permiso, y habla con él antes.', 'iniciacion'],
    ['parr', 'Martin Parr', 'Reino Unido y el mundo · desde los años 80', [-2,1,2,-1,0,1,-1,1,-1,2], 'Color saturado, flash a pleno sol y mucha ironía sobre el turismo, el consumo y las costumbres. Humor con lectura social.', 'Fotografía una costumbre de tu ciudad (el vermú, las rebajas, la cola de algo) con humor pero sin humillar a nadie.', 'iniciacion'],
    ['fan-ho', 'Fan Ho', 'Hong Kong · años 50-60', [2,-1,-1,2,2,0,0,-1,2,0], 'Haces de luz, humo y sombras enormes en las calles de Hong Kong. Figuras pequeñas dentro de una composición casi teatral.', 'Busca un rayo de luz que entre en una calle en sombra y espera a que alguien lo atraviese.', 'atardecer'],
    ['klein', 'William Klein', 'Nueva York, Roma, Tokio, Moscú · años 50-60', [2,2,0,-1,-2,2,-1,2,-1,1], 'Gran angular, grano, desenfoque y gente mirando a cámara. Rompió las reglas de la foto «bien hecha» y la convirtió en energía.', 'Usa el angular más abierto que tengas y acércate tanto que la foto salga torcida y llena de gente.', 'nocturna'],
    ['robert-frank', 'Robert Frank', 'Estados Unidos · años 50', [2,0,-1,-1,-1,1,1,1,1,2], 'Un viaje por Estados Unidos en fotos aparentemente descuidadas, con mucha melancolía. Cambió lo que se entendía por fotografía documental.', 'Haz una serie corta (5 fotos) sobre algo que se repita en tu barrio: banderas, televisiones, coches aparcados.', 'iniciacion'],
    ['helen-levitt', 'Helen Levitt', 'Nueva York · años 30-70', [1,0,1,0,1,2,1,-1,1,1], 'Niños jugando en la calle, gestos y pequeños teatros de barrio. Una mirada tierna y atenta a lo cotidiano, primero en blanco y negro y luego en color.', 'Pasa una hora en una plaza con niños o gente mayor y fotografía solo gestos de manos.', 'iniciacion'],
    ['arbus', 'Diane Arbus', 'Nueva York · años 60', [2,2,-1,-1,0,2,2,1,-1,1], 'Retratos de frente, con la persona mirando a cámara, a menudo gente al margen de lo «normal». Le interesaba la distancia entre cómo queremos que nos vean y cómo nos ven.', 'Pide un retrato a un desconocido y que mire directamente a cámara. Hazlo de frente, sin trucos.', 'iniciacion'],
    ['friedlander', 'Lee Friedlander', 'Estados Unidos · desde los años 60', [2,-1,1,2,0,-1,-1,0,0,0], 'Reflejos, postes, señales y su propia sombra metida en la foto. Encuadres llenos de cosas que se cruzan, con mucho ingenio.', 'Haz una foto en la que una farola, un poste o un cartel parta el encuadre a propósito.', 'composicion'],
    ['herzog', 'Fred Herzog', 'Vancouver · años 50-60', [-2,-1,0,0,1,0,0,-1,1,1], 'Color de diapositiva, letreros, escaparates y la vida de los barrios obreros. Fotografió en color cuando casi nadie lo tomaba en serio.', 'Fotografía letreros y escaparates antiguos de tu barrio en color, con alguien pasando delante.', 'atardecer'],
    ['haas', 'Ernst Haas', 'Viena y Nueva York · años 50-70', [-2,-1,-1,1,0,-1,-1,-1,2,-1], 'Color, movimiento y abstracción: barridos, reflejos y manchas de luz. Más cerca de la pintura que del reportaje.', 'Haz un barrido a 1/15 siguiendo a alguien que pase en bici o corriendo.', 'atardecer'],
    ['trent-parke', 'Trent Parke', 'Australia · desde los años 90', [1,0,0,2,2,1,0,0,2,0], 'Luz muy dura, sombras largas y gente recortada al sol. Escenas casi cinematográficas sacadas de la calle de todos los días.', 'Sal a la hora dorada, ponte a contraluz y busca siluetas con sombras largas.', 'atardecer'],
    ['matt-stuart', 'Matt Stuart', 'Londres · desde los años 2000', [-1,0,2,1,2,1,-1,-1,0,0], 'Coincidencias increíbles que parecen montadas y no lo están: paciencia, mucha calle y mucho humor.', 'Elige un cartel con una imagen grande y espera a que alguien pase y «encaje» con él.', 'composicion'],
    ['koudelka', 'Josef Koudelka', 'Checoslovaquia y Europa · desde los años 60', [2,0,-1,1,0,1,0,1,1,2], 'Blanco y negro muy contrastado, comunidades gitanas, exilio y paisajes. Fotos con mucho peso y una composición muy fuerte.', 'Haz una foto con mucho contraste en la que el cielo o una pared ocupe casi todo el encuadre.', 'composicion'],
    ['larrain', 'Sergio Larrain', 'Chile · años 50-60', [2,0,0,1,0,1,1,0,2,1], 'Valparaíso, niños de la calle y escaleras que no terminan. Una mirada poética e intuitiva, casi de ensoñación.', 'Fotografía en cuestas o escaleras: busca una figura pequeña en un encuadre inclinado.', 'composicion'],
    ['masats', 'Ramón Masats', 'España · años 50-60', [2,0,1,1,1,1,0,0,0,2], 'La España de los años 50 y 60 con humor y mucha intuición: fiestas, toros, seminaristas jugando al fútbol. Uno de los grandes de la fotografía española.', 'Fotografía una fiesta o romería de tu zona buscando un momento gracioso, no la postal.', 'iniciacion'],
    ['colom', 'Joan Colom', 'Barcelona · años 50-60', [2,1,-1,-1,-2,2,0,1,-1,2], 'El Raval de Barcelona fotografiado con la cámara escondida, disparando desde la cadera. La gente sin pose, tal como era.', 'Dispara desde la cadera durante 20 minutos en una calle con mucha gente y mira luego qué ha salido.', 'iniciacion'],
    ['garcia-rodero', 'Cristina García Rodero', 'España · desde los años 70', [2,1,-1,0,1,2,2,0,1,2], 'Fiestas, ritos y tradiciones de la España rural, con una cercanía y un respeto enormes. Se mete dentro de la fiesta para contarla.', 'Ve a una fiesta popular y quédate toda la tarde: las mejores fotos llegan cuando ya no te miran.', 'iniciacion'],
    ['catala-roca', 'Francesc Català-Roca', 'España · años 50-60', [2,0,1,1,1,1,0,-1,1,1], 'La vida de las ciudades españolas de los años 50 y 60, con elegancia, buen ojo para la composición y un punto de humor.', 'Fotografía una calle grande desde arriba o desde un punto inesperado.', 'composicion'],
    ['perez-siquier', 'Carlos Pérez Siquier', 'Almería · desde los años 50', [0,1,2,1,0,1,-1,0,0,1], 'Primero el barrio de La Chanca y luego el color atrevido de la playa y el turismo: encuadres cerrados, cuerpos y mucho humor.', 'Haz una serie en color con encuadres muy cerrados de detalles de la gente en un sitio de ocio.', 'composicion'],
    ['miserachs', 'Xavier Miserachs', 'Barcelona · años 60', [2,0,1,0,0,1,1,0,1,1], 'La Barcelona de los 60, cercana y viva, con una mirada fresca que rompía con la foto de salón de la época.', 'Recorre tu barrio y haz una foto de cada esquina donde pase algo, aunque sea pequeño.', 'iniciacion'],
    ['iturbide', 'Graciela Iturbide', 'México · desde los años 70', [2,1,0,1,1,1,2,-1,2,1], 'Retratos y escenas de México con mucho simbolismo, especialmente de las mujeres de Juchitán. Poesía y documental a la vez.', 'Busca un objeto o animal en la calle que cuente algo de la persona que lo lleva.', 'composicion'],
    ['alvarez-bravo', 'Manuel Álvarez Bravo', 'México · desde los años 20', [2,0,0,1,1,0,0,-1,2,0], 'Escenas cotidianas con un punto surrealista: sombras, muros, telas y personas que parecen sacadas de un sueño.', 'Encuentra algo cotidiano que, con el encuadre adecuado, parezca extraño o irreal.', 'composicion'],
    ['gruyaert', 'Harry Gruyaert', 'Bélgica, Marruecos y el mundo · desde los años 70', [-2,-1,0,2,1,-1,-1,-1,1,0], 'Grandes planos de color y luz: paredes, cielos y figuras pequeñas que equilibran la composición. El color como tema.', 'Busca una pared de un solo color fuerte y espera a que pase alguien con un color que contraste.', 'atardecer'],
    ['pinkhassov', 'Gueorgui Pinkhassov', 'Rusia y el mundo · desde los años 80', [-2,0,0,2,1,0,-1,-1,2,-1], 'Reflejos, luces y sombras que deshacen la escena en algo casi abstracto. Mira la luz antes que a las personas.', 'Haz una foto en la que el reflejo sea más importante que lo reflejado.', 'nocturna'],
    ['lisette-model', 'Lisette Model', 'Niza y Nueva York · años 30-50', [2,2,1,-1,0,2,1,1,-1,1], 'Retratos de calle muy cercanos y directos, con personajes rotundos. Fue profesora de Diane Arbus.', 'Fotografía a alguien desde abajo y muy cerca, que llene todo el encuadre.', 'iniciacion'],
    ['mary-ellen-mark', 'Mary Ellen Mark', 'Estados Unidos e India · desde los años 60', [1,1,0,0,0,2,2,0,0,2], 'Se implicaba durante mucho tiempo con la gente que fotografiaba, sobre todo personas al margen. Documental con mucha empatía.', 'Vuelve varias veces al mismo sitio y a la misma gente: la tercera vez las fotos cambian.', 'iniciacion'],
    ['sabine-weiss', 'Sabine Weiss', 'París · años 50', [2,0,1,0,1,2,1,-1,1,1], 'Fotografía humanista: niños, trabajadores y la vida de París con ternura y mucha luz.', 'Fotografía a alguien trabajando en la calle (un barrendero, un músico, un vendedor) mostrando su oficio.', 'iniciacion'],
    ['doisneau', 'Robert Doisneau', 'París · años 40-60', [2,0,2,0,1,2,1,-1,1,1], 'El París de la gente corriente, con humor, ternura y escenas que parecen pequeñas historias.', 'Siéntate en una terraza y fotografía las reacciones de la gente a algo que pase delante.', 'iniciacion'],
    ['tatsuo-suzuki', 'Tatsuo Suzuki', 'Tokio · desde los años 2010', [2,2,-1,1,-1,1,-1,2,0,0], 'Blanco y negro durísimo, muy cerca y en movimiento, por las calles más llenas de Tokio.', 'Fotografía en una calle muy concurrida con mucho contraste, dejando grandes zonas en negro.', 'nocturna'],
    ['mermelstein', 'Jeff Mermelstein', 'Nueva York · desde los años 80', [-2,2,2,-1,-1,1,-1,1,-1,0], 'Detalles raros y graciosos muy de cerca: manos, bolsos, objetos, pantallas de móvil. Lo absurdo de cada día.', 'Haz 20 fotos de detalles (manos, bolsas, zapatos) sin que salga ninguna cara.', 'composicion'],
    ['einzig', 'Melanie Einzig', 'Nueva York · desde los años 90', [-2,0,2,1,1,1,0,-1,1,0], 'Momentos raros, poéticos y divertidos en color, a menudo con una coincidencia de formas o colores.', 'Busca dos cosas del mismo color en una escena y haz que dialoguen en la foto.', 'composicion'],
    ['norris-webb', 'Rebecca Norris Webb', 'EE. UU. y Caribe · desde los años 90', [-2,0,0,1,1,-1,1,-1,2,0], 'Color, ventanas, animales y reflejos: fotos íntimas y poéticas que parecen sacadas de un diario.', 'Haz una foto en la que una ventana o un reflejo mezcle el dentro y el fuera.', 'atardecer'],
    ['ruth-orkin', 'Ruth Orkin', 'Nueva York e Italia · años 40-50', [2,0,1,0,1,2,0,-1,0,1], 'Escenas de calle con gente y gestos muy claros, a menudo como pequeñas historias. Su foto de una joven caminando por Florencia es famosísima.', 'Fotografía una reacción: alguien que mira, se gira o se ríe por algo que pasa fuera del encuadre.', 'iniciacion'],
    ['raghubir-singh', 'Raghubir Singh', 'India · años 70-90', [-2,0,0,1,1,1,0,-1,1,1], 'El color de la India en composiciones con muchas capas, ventanas y reflejos. Defendió el color cuando muchos lo despreciaban.', 'Haz una foto con un marco dentro del marco (una ventana, una puerta) y gente en varias capas.', 'composicion']
  ];

  var P = [
    ['¿Blanco y negro o color?', [
      ['Blanco y negro, casi siempre', { bn: 2 }],
      ['Color: la calle es de colores', { bn: -2 }],
      ['Depende de la luz de ese día', { poesia: 1 }]]],
    ['¿A qué distancia te sientes cómodo?', [
      ['Tan cerca que casi rozo', { cerca: 2, crudo: 1 }],
      ['A unos pasos, sin molestar', { cerca: 0, espera: 1 }],
      ['Lejos: que la persona sea parte del sitio', { cerca: -2, gente: -1, geo: 1 }]]],
    ['Ves un rincón precioso con buena luz, pero vacío.', [
      ['Me quedo esperando a que pase alguien', { espera: 2, geo: 1 }],
      ['Lo fotografío tal cual, sin nadie', { gente: -2, poesia: 1 }],
      ['Sigo andando: a mí me interesa la gente', { gente: 2, espera: -1 }]]],
    ['¿Qué te hace parar en seco?', [
      ['Algo que me hace gracia', { humor: 2 }],
      ['Una luz que corta la calle', { geo: 2, poesia: 1 }],
      ['Una cara que cuenta algo', { intimo: 2, gente: 1 }],
      ['Algo que habría que contar', { social: 2 }]]],
    ['Tu forma de disparar', [
      ['Pocas fotos, muy pensadas', { espera: 2, crudo: -1 }],
      ['Muchas: ya elegiré luego', { espera: -2, crudo: 1 }],
      ['Desde la cadera, sin mirar por el visor', { crudo: 2, espera: -1, cerca: 1 }]]],
    ['¿Flash en la calle?', [
      ['Sí, y de frente', { crudo: 2, cerca: 2 }],
      ['Nunca, solo luz natural', { crudo: -1, poesia: 1 }],
      ['Alguna vez, para probar', { crudo: 1, humor: 1 }]]],
    ['Tu foto ideal se parece más a…', [
      ['Un cuadro ordenado, cada cosa en su sitio', { geo: 2, espera: 1 }],
      ['Un poema: niebla, cristales, reflejos', { poesia: 2, geo: 1, bn: -1 }],
      ['Un puñetazo: grano, movimiento, desenfoque', { crudo: 2, poesia: -1 }],
      ['Un chiste visual', { humor: 2 }]]],
    ['Alguien te mira justo cuando disparas…', [
      ['Le sonrío y nos ponemos a hablar', { intimo: 2 }],
      ['Mejor: esa mirada es la foto', { cerca: 1, crudo: 1, intimo: 1 }],
      ['Me hago el despistado', { intimo: -1, gente: -1 }]]],
    ['Para salir a fotografiar prefieres…', [
      ['Fiestas, mercados, multitudes', { gente: 2, social: 1 }],
      ['Calles tranquilas a primera hora', { poesia: 1, gente: -1, geo: 1 }],
      ['La noche y los neones', { crudo: 1, poesia: 1 }],
      ['Me da igual: importa lo que pase', { espera: -1, humor: 1 }]]],
    ['¿Para qué haces fotos?', [
      ['Para guardar cómo es la gente de mi tiempo', { social: 2, gente: 1 }],
      ['Para encontrar belleza donde nadie mira', { poesia: 2 }],
      ['Para reírme del mundo, con cariño', { humor: 2 }],
      ['Para poner orden en el caos', { geo: 2, espera: 1 }]]]
  ];

  var TALLER = {
    nocturna: ['Callejera nocturna', '/talleres/nocturna/'],
    atardecer: ['Callejera al atardecer', '/talleres/atardecer/'],
    composicion: ['Composición en la calle', '/talleres/composicion/'],
    iniciacion: ['Primeros pasos', '/talleres/iniciacion/']
  };

  var raiz = document.getElementById('test-fotografo');
  if (!raiz) return;
  var resp = [], paso = 0;
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var track = function (n, d) { try { window.umami && umami.track(n, d); } catch (e) {} };

  function similitud(u, p) {
    var a = 0, b = 0, c = 0;
    for (var i = 0; i < u.length; i++) { a += u[i] * p[i]; b += u[i] * u[i]; c += p[i] * p[i]; }
    return b && c ? a / Math.sqrt(b * c) : 0;
  }
  function calcular() {
    var u = RASGOS.map(function () { return 0; });
    resp.forEach(function (r, i) {
      var d = P[i][1][r][1];
      RASGOS.forEach(function (k, j) { if (d[k]) u[j] += d[k]; });
    });
    return A.map(function (a) { return [similitud(u, a[3]), a]; }).sort(function (x, y) { return y[0] - x[0]; });
  }

  function pregunta() {
    var q = P[paso];
    raiz.innerHTML =
      '<p class="test-paso">' + (paso + 1) + ' de ' + P.length + '</p>' +
      '<div class="test-barra"><span style="width:' + (paso / P.length * 100) + '%"></span></div>' +
      '<h2 class="test-preg">' + esc(q[0]) + '</h2>' +
      '<div class="test-opciones">' + q[1].map(function (o, i) {
        return '<button type="button" class="test-op" data-i="' + i + '">' + esc(o[0]) + '</button>';
      }).join('') + '</div>' +
      (paso > 0 ? '<button type="button" class="test-atras">← Volver</button>' : '');
    raiz.querySelectorAll('.test-op').forEach(function (b) {
      b.addEventListener('click', function () {
        resp[paso] = +b.dataset.i; paso++;
        if (paso === 1) track('test-fotografo-empieza');
        paso < P.length ? pregunta() : resultado(calcular());
      });
    });
    var at = raiz.querySelector('.test-atras');
    if (at) at.addEventListener('click', function () { paso--; pregunta(); });
    var h = raiz.querySelector('.test-preg'); h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true });
  }

  function resultado(lista, compartido) {
    var a = lista[0][1], t = TALLER[a[6]];
    var otros = compartido ? [] : lista.slice(1, 3).map(function (x) { return x[1][1]; });
    var url = location.origin + location.pathname + '?r=' + a[0];
    if (!compartido) {
      track('test-fotografo-resultado', { autor: a[0] });
      try { history.replaceState(null, '', '?r=' + a[0]); } catch (e) {}
    }
    raiz.innerHTML =
      '<p class="nota">' + (compartido ? 'a esta persona le ha salido' : 'tu forma de mirar se parece a la de') + '</p>' +
      '<h2 class="test-autor">' + esc(a[1]) + '</h2>' +
      '<p class="test-donde">' + esc(a[2]) + '</p>' +
      '<p class="entradilla">' + esc(a[4]) + '</p>' +
      (otros.length ? '<p>También tienes algo de <b>' + esc(otros[0]) + '</b> y de <b>' + esc(otros[1]) + '</b>.</p>' : '') +
      '<p><a href="https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(a[1] + ' fotografía') + '" target="_blank" rel="noopener">Mira sus fotos ↗</a></p>' +
      '<div class="test-reto"><span class="nota">tu reto para la próxima vez que salgas</span><p>' + esc(a[5]) + '</p></div>' +
      '<div class="test-siguiente">' +
        '<p data-test-proxima>Si te apetece probar el reto en compañía, en las <a href="/salidas/" data-umami-event="test-fotografo-salida">salidas de Mirar Despacio</a> salimos en grupo por Madrid.</p>' +
        '<p class="aviso">Para trabajarlo con calma: el taller <a href="' + t[1] + '" data-umami-event="test-fotografo-taller">' + esc(t[0]) + '</a>, o un reto nuevo cada mes en <a href="/mirar-despacio-plus/" data-umami-event="test-fotografo-mdplus">Mirar Despacio+</a>.</p>' +
      '</div>' +
      '<div class="botones">' +
        '<button type="button" class="boton claro test-compartir">Compartir mi resultado</button>' +
        '<button type="button" class="boton claro test-otra">' + (compartido ? 'Hacer el test' : 'Repetir el test') + '</button>' +
      '</div>' +
      '<p class="aviso test-copiado" hidden>Enlace copiado.</p>';

    fetch('/salidas-data.json').then(function (r) { return r.json(); }).then(function (d) {
      var pend = function (v) { return !v || /^por (determinar|confirmar|anunciar)/i.test(String(v).trim()); };
      var s = (d.proximas || []).filter(function (x) {
        return x.activa && !pend(x.fecha) && !(x.fechaISO && new Date(x.fechaISO).getTime() + 4 * 3600e3 < Date.now()) &&
          !(x.publicaDesde && Date.now() < new Date(x.publicaDesde).getTime());
      })[0];
      var el = raiz.querySelector('[data-test-proxima]');
      if (s && el) el.innerHTML = 'Si te apetece probar el reto en compañía, la próxima <a href="/salidas/" data-umami-event="test-fotografo-salida">salida</a> es el ' + esc(s.fecha) + (pend(s.zona) ? '' : ', por ' + esc(s.zona)) + '.';
    }).catch(function () {});

    raiz.querySelector('.test-otra').addEventListener('click', function () {
      resp = []; paso = 0; try { history.replaceState(null, '', location.pathname); } catch (e) {}
      pregunta();
    });
    raiz.querySelector('.test-compartir').addEventListener('click', function () {
      var texto = 'Mi forma de mirar se parece a la de ' + a[1] + '. ¿Y la tuya?';
      track('test-fotografo-compartir', { autor: a[0] });
      if (navigator.share) { navigator.share({ title: '¿Qué fotógrafo de calle eres?', text: texto, url: url }).catch(function () {}); return; }
      try { navigator.clipboard.writeText(texto + ' ' + url); raiz.querySelector('.test-copiado').hidden = false; } catch (e) {}
    });
    raiz.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ¿Viene de un enlace compartido?
  var r = new URLSearchParams(location.search).get('r'), dado = null;
  A.forEach(function (a) { if (a[0] === r) dado = a; });
  if (dado) resultado([[1, dado]], true); else pregunta();
})();
