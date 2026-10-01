/* Mirar Despacio · comportamiento común (menú, apariciones, visor de fotos) */
(function () {
  // Menú móvil
  var boton = document.querySelector('.nav-boton');
  var menu = document.querySelector('.nav ul');
  if (boton && menu) {
    boton.addEventListener('click', function () {
      var abierto = menu.classList.toggle('abierto');
      boton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
    });
  }

  // Aparición suave al hacer scroll
  var revelar = document.querySelectorAll('.revelar');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    revelar.forEach(function (el) { io.observe(el); });
  } else {
    revelar.forEach(function (el) { el.classList.add('visible'); });
  }

  // Visor de fotos: cualquier botón con data-foto dentro de [data-visor]
  var visor = document.createElement('div');
  visor.className = 'visor';
  visor.setAttribute('role', 'dialog');
  visor.setAttribute('aria-label', 'Foto ampliada');
  visor.innerHTML = '<button class="cerrar" aria-label="Cerrar">✕</button>' +
    '<button class="ant" aria-label="Anterior">‹</button><img alt="">' +
    '<button class="sig" aria-label="Siguiente">›</button>';
  document.body.appendChild(visor);
  var img = visor.querySelector('img');
  var lista = [], pos = 0, inicioX = null;

  function mostrar(i) {
    pos = (i + lista.length) % lista.length;
    img.src = lista[pos].dataset.foto;
    img.alt = lista[pos].querySelector('img') ? lista[pos].querySelector('img').alt : '';
  }
  function cerrar() { visor.classList.remove('abierto'); document.body.style.overflow = ''; }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-foto]');
    if (!b) return;
    var grupo = b.closest('[data-visor]');
    lista = grupo ? Array.prototype.slice.call(grupo.querySelectorAll('[data-foto]')) : [b];
    mostrar(lista.indexOf(b));
    visor.classList.add('abierto');
    document.body.style.overflow = 'hidden';
  });
  visor.querySelector('.cerrar').addEventListener('click', cerrar);
  visor.querySelector('.ant').addEventListener('click', function () { mostrar(pos - 1); });
  visor.querySelector('.sig').addEventListener('click', function () { mostrar(pos + 1); });
  visor.addEventListener('click', function (e) { if (e.target === visor) cerrar(); });
  document.addEventListener('keydown', function (e) {
    if (!visor.classList.contains('abierto')) return;
    if (e.key === 'Escape') cerrar();
    if (e.key === 'ArrowLeft') mostrar(pos - 1);
    if (e.key === 'ArrowRight') mostrar(pos + 1);
  });
  visor.addEventListener('touchstart', function (e) { inicioX = e.touches[0].clientX; }, { passive: true });
  visor.addEventListener('touchend', function (e) {
    if (inicioX === null) return;
    var dx = e.changedTouches[0].clientX - inicioX;
    if (Math.abs(dx) > 50) mostrar(pos + (dx < 0 ? 1 : -1));
    inicioX = null;
  });

  // Formularios Formspree sin salir de la página
  document.querySelectorAll('form[data-formspree]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = f.querySelector('button[type=submit]');
      var ok = document.getElementById(f.dataset.ok);
      btn.disabled = true;
      var hecho = function (texto) {
        f.style.display = 'none';
        if (ok) {
          var t = ok.querySelector('[data-ok-texto]');
          if (t && texto) t.textContent = texto;
          ok.style.display = 'block';
        }
        if (window.umami && f.dataset.evento) window.umami.track(f.dataset.evento);
      };
      var formspree = function () {
        return fetch(f.action, { method: 'POST', body: new FormData(f), headers: { Accept: 'application/json' } })
          .then(function (r) { if (!r.ok) throw new Error(); hecho(); });
      };
      // Inscripción a salidas: va directa al CRM y contesta con plaza / lista de espera.
      // Si el CRM falla, se manda por Formspree como siempre.
      var envio = !f.dataset.inscripcion ? formspree() : fetch(f.dataset.inscripcion, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(f))),
      }).then(function (r) {
        if (!r.ok) throw new Error();
        return r.json();
      }).then(function (d) {
        var mail = ' Te acabo de mandar un email con los detalles (mira en spam si no lo ves).';
        var txt = d.estado === 'espera'
          ? 'Esta salida ya está completa: estás en lista de espera' + (d.posicion ? ' (número ' + d.posicion + ')' : '') + '. Si se libera una plaza, te escribo.'
          : d.estado === 'sin-fecha'
            ? 'Tienes plaza en la próxima salida. En cuanto haya fecha te escribo con el día, la hora y el punto de encuentro.'
            : 'Tienes plaza' + (d.salida ? ' para la salida del ' + d.salida : '') + '. Unos días antes te mando el punto de encuentro.';
        if (d.yaEstaba) txt = 'Ya te habías apuntado. ' + txt;
        hecho(txt + (d.correo ? mail : ''));
      }).catch(formspree);
      envio
        .catch(function () {
          btn.disabled = false;
          alert('No se ha podido enviar. Prueba otra vez o escríbeme a info@mirardespacio.es');
        });
    });
  });
})();
