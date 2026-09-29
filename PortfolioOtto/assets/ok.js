/* Otto Kols · menú móvil, formulario de contacto y tipo de sesión preseleccionado */
(function () {
  var boton = document.querySelector('.nav-boton');
  var menu = document.querySelector('.nav ul');
  if (boton && menu) {
    boton.addEventListener('click', function () {
      var abierto = menu.classList.toggle('abierto');
      boton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
    });
  }

  // Desplegable de Retrato (clic y teclado; en escritorio también se abre al pasar el ratón)
  var desp = document.querySelector('.nav .desplegable');
  if (desp) {
    var b = desp.querySelector('button');
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      var abierto = desp.classList.toggle('abierto');
      b.setAttribute('aria-expanded', abierto ? 'true' : 'false');
    });
    document.addEventListener('click', function () { desp.classList.remove('abierto'); b.setAttribute('aria-expanded', 'false'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { desp.classList.remove('abierto'); b.setAttribute('aria-expanded', 'false'); } });
  }

  // /contacto/?tipo=actores preselecciona el tipo de sesión
  var tipo = new URLSearchParams(location.search).get('tipo');
  var select = document.getElementById('c-tipo');
  if (tipo && select) {
    Array.prototype.forEach.call(select.options, function (o) { if (o.dataset.clave === tipo) select.value = o.value; });
  }

  var form = document.getElementById('contactForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (r) {
          if (!r.ok) throw new Error();
          form.style.display = 'none';
          document.getElementById('contactOk').style.display = 'block';
          if (window.umami) window.umami.track('contacto-enviado', { tipo: select ? select.value : '' });
        })
        .catch(function () {
          btn.disabled = false;
          alert('No se ha podido enviar. Escríbeme a ottobkc@gmail.com');
        });
    });
  }
})();
