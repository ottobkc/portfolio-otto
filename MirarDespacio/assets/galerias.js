/* Mirar Despacio · galerías de salidas
 * Lee /salidas-data.json. Para cada salida intenta traer de Cloudinary todas las fotos
 * con su etiqueta (tag); si no puede, usa la lista "fotos" del JSON.
 * Así, para añadir fotos basta con subirlas a Cloudinary con la etiqueta de la salida. */
(function () {
  var CLOUD = 'https://res.cloudinary.com/dybxateci/image/';
  var contenedor = document.querySelector('[data-galerias-salidas]');
  var ultima = document.querySelector('[data-galeria-ultima]');
  if (!contenedor && !ultima) return;

  function url(publicId, formato, version, t) {
    return CLOUD + 'upload/' + t + '/' + (version ? 'v' + version + '/' : '') + publicId + '.' + (formato || 'jpg');
  }
  function conTransformacion(src, t) { return src.replace('/upload/', '/upload/' + t + '/'); }

  function fotosDeSalida(s) {
    var respaldo = (s.fotos || []).map(function (src) {
      return { mini: conTransformacion(src, 'f_auto,q_auto,h_640'), grande: conTransformacion(src, 'f_auto,q_auto,w_1800') };
    });
    if (!s.tag) return Promise.resolve(respaldo);
    return fetch(CLOUD + 'list/' + encodeURIComponent(s.tag) + '.json')
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function (d) {
        var lista = (d.resources || []).sort(function (a, b) { return (a.created_at || '').localeCompare(b.created_at || ''); });
        if (!lista.length) return respaldo;
        return lista.map(function (f) {
          return { mini: url(f.public_id, f.format, f.version, 'f_auto,q_auto,h_640'), grande: url(f.public_id, f.format, f.version, 'f_auto,q_auto,w_1800') };
        });
      })
      .catch(function () { return respaldo; });
  }

  function carrusel(fotos, alt) {
    var div = document.createElement('div');
    div.className = 'carrusel';
    div.setAttribute('data-visor', '');
    fotos.forEach(function (f) {
      var b = document.createElement('button');
      b.setAttribute('data-foto', f.grande);
      var img = document.createElement('img');
      img.src = f.mini; img.alt = alt; img.loading = 'lazy';
      b.appendChild(img); div.appendChild(b);
    });
    return div;
  }

  fetch('/salidas-data.json').then(function (r) { return r.json(); }).then(function (d) {
    var salidas = d.salidas || [];
    Promise.all(salidas.map(fotosDeSalida)).then(function (todas) {
      var primeraConFotos = -1;
      salidas.forEach(function (s, i) {
        if (!todas[i].length) return;
        if (primeraConFotos < 0) primeraConFotos = i;
        if (!contenedor) return;
        var bloque = document.createElement('div');
        bloque.className = 'salida-galeria';
        var h = document.createElement('h3');
        h.textContent = s.titulo;
        if (s.fecha) { var sp = document.createElement('span'); sp.textContent = s.fecha; h.appendChild(sp); }
        bloque.appendChild(h);
        bloque.appendChild(carrusel(todas[i], 'Foto de la salida por ' + s.titulo));
        contenedor.appendChild(bloque);
      });
      if (ultima && primeraConFotos >= 0) {
        var c = carrusel(todas[primeraConFotos], 'Foto de la última salida por ' + salidas[primeraConFotos].titulo);
        ultima.innerHTML = c.innerHTML;
      }
    });
  }).catch(function () {});
})();
