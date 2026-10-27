// Tienda de mirardespacio.es: pinta los productos que hay a la venta en el CRM.
// Cada producto nuevo del CRM aparece aquí solo. Si no hay ninguno (o falla la carga),
// se queda el contenido fijo de la página (el zine).
(function () {
  var caja = document.getElementById('tienda-productos');
  if (!caja) return;
  var EMAIL = caja.getAttribute('data-email') || 'info@mirardespacio.es';
  var TIPOS = { zine: 'Zine', baraja: 'Baraja', camiseta: 'Camiseta', lamina: 'Lámina', otro: '' };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var eur = function (n) { n = Number(n) || 0; return (n % 1 ? n.toFixed(2).replace('.', ',') : String(n)) + ' €'; };
  var img = function (u, t) { return String(u).replace('/image/upload/', '/image/upload/' + t + '/'); };
  var lista = [];

  function tarjeta(p, i) {
    var tallas = p.variantes.filter(function (v) { return v.nombre; });
    var agotado = p.estado !== 'venta';
    var pocas = !agotado && (tallas.length ? false : p.variantes.some(function (v) { return v.pocas; }));
    var fotos = p.fotos.length ? p.fotos : [];
    return '<article class="producto" id="p-' + esc(p.id) + '">' +
      '<div class="producto-fotos">' +
        (fotos.length ? '<img class="producto-foto" src="' + esc(img(fotos[0], 'f_auto,q_auto,c_limit,w_1100')) + '" alt="' + esc(p.nombre) + '" loading="' + (i ? 'lazy' : 'eager') + '">' : '<div class="producto-foto vacia"></div>') +
        (fotos.length > 1 ? '<div class="producto-minis">' + fotos.map(function (f, k) {
          return '<button type="button" aria-label="Ver foto ' + (k + 1) + '" data-i="' + i + '" data-f="' + k + '"' + (k ? '' : ' class="activa"') + '><img src="' + esc(img(f, 'f_auto,q_auto,c_fill,w_160,h_160')) + '" alt="" loading="lazy"></button>';
        }).join('') + '</div>' : '') +
      '</div>' +
      '<div class="producto-info">' +
        (TIPOS[p.tipo] ? '<p class="antetitulo">' + esc(TIPOS[p.tipo]) + '</p>' : '') +
        '<h2>' + esc(p.nombre) + '</h2>' +
        '<p class="producto-precio">' + eur(p.precio) + (agotado ? ' <span class="producto-estado">Agotado</span>' : pocas ? ' <span class="producto-estado">Quedan pocos</span>' : '') + '</p>' +
        (p.descripcion ? '<div class="producto-desc">' + esc(p.descripcion).replace(/\n+/g, '</p><p>').replace(/^/, '<p>') + '</p></div>' : '') +
        (tallas.length && !agotado ? '<div class="producto-tallas" role="radiogroup" aria-label="Talla">' + tallas.map(function (v, k) {
          return '<label class="' + (v.disponible ? '' : 'sin') + '"><input type="radio" name="talla-' + i + '" value="' + esc(v.nombre) + '"' + (v.disponible ? '' : ' disabled') + (v.disponible && !tallas.slice(0, k).some(function (x) { return x.disponible; }) ? ' checked' : '') + '><span>' + esc(v.nombre) + '</span></label>';
        }).join('') + '</div>' : '') +
        '<div class="botones">' + (agotado
          ? '<a class="boton claro" href="mailto:' + EMAIL + '?subject=' + encodeURIComponent('Avísame cuando haya: ' + p.nombre) + '">Avísame cuando vuelva</a>'
          : '<a class="boton" data-comprar="' + i + '" href="#">' + (p.enlacePago ? 'Comprar' : 'Lo quiero') + '</a>') + '</div>' +
        (!agotado && !p.enlacePago ? '<p class="producto-nota">Escríbeme y te digo cómo pagarlo. Si vienes a una salida o a un taller te lo llevo en mano' + (p.envio ? '; si no, el envío son ' + eur(p.envio) : '') + '.</p>' : '') +
        (!agotado && p.enlacePago && p.envio ? '<p class="producto-nota">Envío: ' + eur(p.envio) + '.</p>' : '') +
      '</div></article>';
  }

  function pintar() {
    caja.innerHTML = lista.map(tarjeta).join('');
    var fijo = document.getElementById('tienda-fijo');
    if (fijo) fijo.hidden = true;
    caja.hidden = false;
  }

  caja.addEventListener('click', function (e) {
    var mini = e.target.closest('.producto-minis button');
    if (mini) {
      var p = lista[Number(mini.getAttribute('data-i'))], f = Number(mini.getAttribute('data-f'));
      var art = mini.closest('.producto');
      art.querySelector('.producto-foto').src = img(p.fotos[f], 'f_auto,q_auto,c_limit,w_1100');
      art.querySelectorAll('.producto-minis button').forEach(function (b) { b.classList.toggle('activa', b === mini); });
      return;
    }
    var boton = e.target.closest('[data-comprar]');
    if (!boton) return;
    e.preventDefault();
    var i = Number(boton.getAttribute('data-comprar')), prod = lista[i];
    var marcada = caja.querySelector('input[name="talla-' + i + '"]:checked');
    var talla = marcada ? marcada.value : '';
    if (window.umami) try { umami.track('tienda-quiero', { producto: prod.nombre, talla: talla }); } catch (x) { /* nada */ }
    if (prod.enlacePago) { location.href = prod.enlacePago; return; }
    var asunto = 'Quiero: ' + prod.nombre + (talla ? ' (talla ' + talla + ')' : '');
    var cuerpo = 'Hola, Otto:\n\nMe gustaría comprar ' + prod.nombre + (talla ? ', talla ' + talla : '') + '.\n\nMe lo llevo en una salida / Me lo envías a: \n\nGracias.';
    location.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(asunto) + '&body=' + encodeURIComponent(cuerpo);
  });

  fetch('/api/tienda', { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (l) { lista = Array.isArray(l) ? l : []; if (lista.length) pintar(); })
    .catch(function () { /* se queda el contenido fijo */ });
})();
