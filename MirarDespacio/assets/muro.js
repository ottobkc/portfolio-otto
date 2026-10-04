// Muro de Mirar Despacio: fotos de la gente de las salidas y de MD+ que Otto ha comentado
// y cuyos autores dejan publicar. Datos: ottokols.es/.netlify/functions/fotos?muro=1
(function () {
  var cont = document.getElementById('muro');
  var dest = document.getElementById('muroDestacadas');
  if (!cont) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var fotos = [], filtro = '';
  var filtros = document.getElementById('muroFiltros');

  function pintar() {
    var vis = fotos.filter(function (f) { return !filtro || (f.tipo === 'reto') === (filtro === 'reto'); });
    var d = vis.filter(function (f) { return f.destacada; });
    if (dest) {
      dest.hidden = !d.length;
      dest.querySelector('.muro-grid').innerHTML = d.map(function (f) { return tarjeta(f, fotos.indexOf(f)); }).join('');
    }
    var resto = vis.filter(function (f) { return !f.destacada; });
    cont.innerHTML = resto.length ? resto.map(function (f) { return tarjeta(f, fotos.indexOf(f)); }).join('') : (d.length ? '' : '<p class="aviso">Todavía no hay fotos aquí.</p>');
  }
  if (filtros) filtros.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    filtro = b.dataset.f;
    Array.prototype.forEach.call(filtros.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    pintar();
  });

  function tarjeta(f, i) {
    return '<figure class="muro-foto' + (f.destacada ? ' destacada' : '') + '">' +
      '<button type="button" data-i="' + i + '" aria-label="Ver la foto de ' + esc(f.nombre) + '">' +
      '<img src="' + esc(f.url) + '" alt="Foto de ' + esc(f.nombre) + '" loading="lazy"' +
      (f.ancho && f.alto ? ' width="' + f.ancho + '" height="' + f.alto + '"' : '') + '></button>' +
      '<figcaption><span class="muro-autor">' + esc(f.nombre) + (window.MDMedallas ? MDMedallas.junto(f.retos, f.mejorRacha, 18) : '') + '</span>' + (f.donde ? '<span class="muro-donde">' + (f.tipo === 'reto' ? 'Reto del mes · ' : '') + esc(f.donde) + '</span>' : '') +
      (f.comentario ? '<span class="muro-comentario">' + esc(f.comentario) + '</span>' : '') + '</figcaption></figure>';
  }

  fetch('https://ottokols.es/.netlify/functions/fotos?muro=1').then(function (r) { return r.json(); }).then(function (lista) {
    fotos = Array.isArray(lista) ? lista : [];
    if (!fotos.length) { cont.innerHTML = '<p class="aviso">Muy pronto, las primeras fotos.</p>'; return; }
    if (filtros) filtros.hidden = false;
    pintar();
  }).catch(function () { cont.innerHTML = '<p class="aviso">No se ha podido cargar el muro. Prueba en un rato.</p>'; });

  // Visor a pantalla completa con el comentario
  var visor = document.createElement('div');
  visor.className = 'muro-visor'; visor.hidden = true;
  document.body.appendChild(visor);
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.muro-foto button');
    if (b) {
      var f = fotos[+b.dataset.i];
      visor.innerHTML = '<img src="' + esc(f.grande) + '" alt=""><div class="muro-visor-texto"><span class="muro-autor">' + esc(f.nombre) + '</span>' +
        (f.donde ? ' · <span class="muro-donde">' + esc(f.donde) + '</span>' : '') + (f.comentario ? '<p class="muro-comentario">' + esc(f.comentario) + '</p>' : '') + '</div>';
      visor.hidden = false;
      try { window.umami && window.umami.track('muro-ver'); } catch (x) {}
    } else if (!visor.hidden && visor.contains(e.target)) visor.hidden = true;
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') visor.hidden = true; });
})();
