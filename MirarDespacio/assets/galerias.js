/* Mirar Despacio · galería de las salidas
 * Una sola galería con fotos de todas las salidas, mezcladas.
 * Lee /salidas-data.json. Para cada salida intenta traer de Cloudinary todas las fotos
 * con su etiqueta (tag); si no puede, usa la lista "fotos" del JSON.
 * Así, para añadir fotos basta con subirlas a Cloudinary con la etiqueta de la salida. */
(function () {
  var CLOUD = 'https://res.cloudinary.com/dybxateci/image/';
  var MAX = 24; // fotos como máximo en la galería
  var destino = document.querySelector('[data-galeria-salidas]');
  if (!destino) return;

  function url(publicId, formato, version, t) {
    return CLOUD + 'upload/' + t + '/' + (version ? 'v' + version + '/' : '') + publicId + '.' + (formato || 'jpg');
  }
  function conT(src, t) { return src.replace('/upload/', '/upload/' + t + '/'); }

  function fotosDeSalida(s) {
    var respaldo = (s.fotos || []).map(function (src) {
      return { mini: conT(src, 'f_auto,q_auto,h_640'), grande: conT(src, 'f_auto,q_auto,w_1800'), zona: s.titulo };
    });
    if (!s.tag) return Promise.resolve(respaldo);
    return fetch(CLOUD + 'list/' + encodeURIComponent(s.tag) + '.json')
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function (d) {
        var lista = d.resources || [];
        if (!lista.length) return respaldo;
        return lista.map(function (f) {
          return { mini: url(f.public_id, f.format, f.version, 'f_auto,q_auto,h_640'),
                   grande: url(f.public_id, f.format, f.version, 'f_auto,q_auto,w_1800'), zona: s.titulo };
        });
      })
      .catch(function () { return respaldo; });
  }

  // Mezcla: una de cada salida por turnos (la más reciente primero), así se ven todas.
  function mezclar(grupos) {
    var out = [], i = 0, quedan = true;
    while (quedan && out.length < MAX) {
      quedan = false;
      grupos.forEach(function (g) {
        if (i < g.length && out.length < MAX) { out.push(g[i]); quedan = true; }
      });
      i++;
    }
    return out;
  }

  fetch('/salidas-data.json').then(function (r) { return r.json(); }).then(function (d) {
    Promise.all((d.salidas || []).map(fotosDeSalida)).then(function (grupos) {
      mezclar(grupos).forEach(function (f) {
        var b = document.createElement('button');
        b.setAttribute('data-foto', f.grande);
        var img = document.createElement('img');
        img.src = f.mini; img.loading = 'lazy';
        img.alt = 'Foto de la salida por ' + f.zona;
        b.appendChild(img);
        destino.appendChild(b);
      });
    });
  }).catch(function () {});
})();
