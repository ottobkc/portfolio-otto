// Ejercicios de después del taller, dentro de la página de cada manual (ottokols.es/manuales/<id>/).
// Cada persona sube una foto por ejercicio; Otto la comenta desde el CRM (pestaña Fotos) y le llega
// un email con el enlace a este manual, donde puede leer el comentario y responder en el hilo.
//
// En la página:
//   <div class="ej-despues" data-n="1"> … enunciado … <div class="ej-zona"></div></div>
//   <script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>
//   <script src="/js/hilo.js"></script>
//   <script src="/js/ejercicios-taller.js" data-taller="atardecer"></script>
// Usa la función fotos (tipo 'taller'); solo funciona con la sesión de alguien que tiene ese manual.
(function () {
  var script = document.currentScript;
  var TALLER = script && script.getAttribute('data-taller');
  if (!TALLER) return;
  var API = '/.netlify/functions/fotos';
  var CLOUD = 'https://api.cloudinary.com/v1_1/dybxateci/image/upload';
  var PRESET = 'cuaderno_fotos';
  var LADO = 2000;
  var datos = null;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var ERRORES = {
    'ya-comentada': 'Esa foto ya está comentada: no se puede cambiar.',
    'demasiadas': 'Tienes muchas fotos pendientes de comentar. Espera a que las vea.',
    'grande': 'La foto es demasiado grande. Prueba con otra.',
    'formato': 'Este navegador no puede leer ese formato. Exporta la foto como JPG y vuelve a probar.',
    'sin-manual': 'Tu cuenta no tiene este manual. Escríbeme y lo miro.',
    'sesion': 'Tu sesión ha caducado. Vuelve a entrar.',
    'url': 'No se ha podido subir la foto. Prueba otra vez.',
  };

  var css = document.createElement('style');
  css.textContent =
    '.ej-zona{margin-top:12px}.ej-zona [hidden]{display:none!important}' +
    '.ej-zona .foto{background:#fff;border:1px solid #d8d1c4;border-radius:12px;padding:12px}' +
    '.ej-zona .foto img{display:block;width:100%;height:auto;border-radius:8px}' +
    '.ej-estado{font-size:14px;color:#6b655a;margin:10px 0 0}' +
    '.ej-comentario{margin:10px 0 0;padding:10px 12px;border-left:3px solid #e8347a;background:rgba(232,52,122,.07);border-radius:6px;white-space:pre-line}' +
    '.ej-comentario small{display:block;font-size:12px;color:#6b655a;margin-bottom:2px}' +
    '.ej-boton{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border:0;border-radius:999px;background:#1a1814;color:#fff;font:500 15px/1 Inter,system-ui,sans-serif;cursor:pointer}' +
    '.ej-boton.claro{background:#fff;color:#1a1814;border:1px solid #d8d1c4}' +
    '.ej-boton[disabled]{opacity:.5}' +
    '.ej-form{display:grid;gap:10px;margin-top:12px;background:#fff;border:1px solid #d8d1c4;border-radius:12px;padding:14px}' +
    '.ej-form label{font-size:14px;color:#6b655a;display:grid;gap:4px}' +
    '.ej-form textarea,.ej-form input[type=text]{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #d8d1c4;border-radius:8px;font:inherit;font-size:15px;background:#f5f3ef;color:#1a1814}' +
    '.ej-form .check{display:flex;gap:8px;align-items:flex-start;color:#1a1814}' +
    '.ej-form .previa{max-width:100%;border-radius:8px}' +
    '.ej-msg{font-size:14px;min-height:1.2em;margin:0}.ej-msg.error{color:#b5654f}.ej-msg.ok{color:#1a7f4b}' +
    '.ej-barra{height:3px;background:#ebe6dd;border-radius:2px;overflow:hidden}.ej-barra i{display:block;height:100%;width:0;background:linear-gradient(90deg,#e8821a,#e8347a);transition:width .2s}' +
    '.ej-acciones{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}';
  document.head.appendChild(css);

  function token() {
    var u = window.netlifyIdentity && netlifyIdentity.currentUser();
    return u ? u.jwt() : Promise.reject(new Error('sesion'));
  }
  function llamar(metodo, cuerpo, query) {
    return token().then(function (t) {
      return fetch(API + (query || ''), { method: metodo, headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.error || 'error'); e.codigo = r.status === 401 ? 'sesion' : j.error; throw e; }
        return j;
      });
    });
  }

  function reducir(file) {
    return new Promise(function (ok, ko) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, LADO / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? ok({ blob: b, ancho: c.width, alto: c.height }) : ko(new Error('formato')); }, 'image/jpeg', 0.86);
      };
      img.onerror = function () { URL.revokeObjectURL(url); ko(new Error('formato')); };
      img.src = url;
    });
  }
  function subirCloudinary(b, barra) {
    return new Promise(function (ok, ko) {
      var fd = new FormData(); fd.append('file', b, 'foto.jpg'); fd.append('upload_preset', PRESET);
      var x = new XMLHttpRequest(); x.open('POST', CLOUD);
      barra.hidden = false;
      x.upload.onprogress = function (e) { if (e.lengthComputable) barra.firstChild.style.width = (e.loaded / e.total * 100) + '%'; };
      x.onload = function () { try { var j = JSON.parse(x.responseText); j.secure_url ? ok(j) : ko(new Error('url')); } catch (e) { ko(new Error('url')); } };
      x.onerror = function () { ko(new Error('url')); };
      x.send(fd);
    });
  }

  var refId = function (n) { return TALLER + '-' + n; };
  var miFoto = function (n) { return datos && datos.mias.filter(function (f) { return f.refId === refId(n); })[0]; };

  function formulario(n) {
    var nombre = datos && datos.yo ? (datos.yo.nombreCorto || datos.yo.nombre || '') : '';
    return '<form class="ej-form" data-form="' + n + '">' +
      '<label>Tu foto<input type="file" accept="image/*" data-archivo="' + n + '"></label>' +
      '<img class="previa" data-previa="' + n + '" hidden alt="">' +
      '<label>¿Qué querías contar? <small>(opcional)</small><textarea maxlength="600" rows="3" data-texto="' + n + '"></textarea></label>' +
      '<label class="check"><input type="checkbox" data-publicable="' + n + '"> <span>Si me gusta, Otto puede colgarla en el muro de Mirar Despacio</span></label>' +
      '<label>Firma en el muro<input type="text" maxlength="40" data-nombre="' + n + '" value="' + esc(nombre) + '"></label>' +
      '<div class="ej-barra" data-barra="' + n + '" hidden><i></i></div>' +
      '<p class="ej-msg" data-msg="' + n + '"></p>' +
      '<div><button class="ej-boton" type="submit">Subir la foto</button></div></form>';
  }

  function pintarZona(el) {
    var n = el.closest('.ej-despues').getAttribute('data-n');
    var f = miFoto(n);
    if (!f) {
      el.innerHTML = '<button type="button" class="ej-boton" data-abrir="' + n + '">📷 Subir mi foto</button>';
      return;
    }
    var estado = f.estado === 'pendiente'
      ? '<p class="ej-estado">Pendiente de comentar. Te aviso por email cuando la vea.</p>'
      : f.estado === 'vista' || !f.comentario ? '<p class="ej-estado">Vista ✓</p>'
      : '<div class="ej-comentario"><small>Otto</small>' + esc(f.comentario) + '</div>' + (window.MDHilo ? MDHilo.html(f) : '');
    el.innerHTML = '<article class="foto" id="foto-' + esc(f.id) + '"><img src="' + esc(f.url) + '" alt="Tu foto del ejercicio" loading="lazy">' +
      (f.texto ? '<p class="ej-estado">“' + esc(f.texto) + '”</p>' : '') + estado +
      (f.enMuro ? '<p class="ej-estado">Está en el <a href="https://mirardespacio.es/muro/">muro</a>.</p>' : '') +
      (f.estado === 'pendiente' ? '<div class="ej-acciones"><button type="button" class="ej-boton claro" data-abrir="' + n + '">Cambiar la foto</button>' +
        '<button type="button" class="ej-boton claro" data-borrar="' + esc(f.id) + '">Borrar</button></div>' : '') + '</article>';
  }

  function pintar() {
    document.querySelectorAll('.ej-despues .ej-zona').forEach(pintarZona);
    if (window.MDHilo) MDHilo.irA();
  }
  function cargar() {
    return llamar('GET', null, '?taller=' + encodeURIComponent(TALLER)).then(function (d) { datos = d; pintar(); }).catch(function (e) {
      var msg = e.codigo === 'sesion' ? 'Para subir tus fotos, <a href="/acceso.html?a=manual-' + esc(TALLER) + '">vuelve a entrar con tu cuenta</a>.'
        : 'No se han podido cargar tus fotos. Recarga la página.';
      document.querySelectorAll('.ej-despues .ej-zona').forEach(function (z) { z.innerHTML = '<p class="ej-estado">' + msg + '</p>'; });
    });
  }

  var archivos = {};
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t.dataset || !t.dataset.archivo) return;
    var n = t.dataset.archivo, f = t.files && t.files[0], msg = document.querySelector('[data-msg="' + n + '"]');
    delete archivos[n]; msg.textContent = ''; msg.className = 'ej-msg';
    if (!f) return;
    if (f.size > 40 * 1048576) { msg.textContent = 'Ese archivo es demasiado grande (más de 40 MB).'; msg.className = 'ej-msg error'; return; }
    msg.textContent = 'Preparando…';
    reducir(f).then(function (r) {
      archivos[n] = r; msg.textContent = '';
      var p = document.querySelector('[data-previa="' + n + '"]'); p.src = URL.createObjectURL(r.blob); p.hidden = false;
    }).catch(function () { msg.textContent = ERRORES.formato; msg.className = 'ej-msg error'; });
  });

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form.dataset || !form.dataset.form) return;
    e.preventDefault();
    var n = form.dataset.form, msg = form.querySelector('[data-msg]'), boton = form.querySelector('button[type=submit]');
    var a = archivos[n];
    if (!a) { msg.textContent = 'Elige primero una foto.'; msg.className = 'ej-msg error'; return; }
    boton.disabled = true; msg.className = 'ej-msg'; msg.textContent = 'Subiendo…';
    subirCloudinary(a.blob, form.querySelector('[data-barra]')).then(function (c) {
      return llamar('POST', { accion: 'subir', tipo: 'taller', refId: refId(n), url: c.secure_url, ancho: c.width, alto: c.height,
        texto: form.querySelector('[data-texto]').value, nombreMuro: form.querySelector('[data-nombre]').value,
        publicable: form.querySelector('[data-publicable]').checked });
    }).then(function () {
      try { window.umami && window.umami.track('manual-subir', { taller: TALLER, ejercicio: n }); } catch (x) {}
      delete archivos[n];
      return cargar();
    }).catch(function (err) {
      msg.textContent = ERRORES[err.codigo || err.message] || 'No se ha podido subir. Prueba otra vez.'; msg.className = 'ej-msg error';
      boton.disabled = false;
    });
  });

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('button') : null;
    if (!t) return;
    if (window.MDHilo && MDHilo.alPulsar(t, function (id, texto) {
      return llamar('POST', { accion: 'responder', id: id, texto: texto }).then(cargar);
    })) return;
    if (t.dataset.abrir) {
      var zona = t.closest('.ej-zona');
      if (!zona.querySelector('.ej-form')) zona.insertAdjacentHTML('beforeend', formulario(t.dataset.abrir));
      t.hidden = true;
      return;
    }
    if (t.dataset.borrar) {
      if (!confirm('¿Borrar esta foto? Podrás subir otra.')) return;
      t.disabled = true;
      llamar('POST', { accion: 'borrar', id: t.dataset.borrar }).then(cargar).catch(function () { t.disabled = false; });
    }
  });

  if (!window.netlifyIdentity) {
    document.querySelectorAll('.ej-despues .ej-zona').forEach(function (z) { z.innerHTML = '<p class="ej-estado">No se ha podido cargar la subida de fotos. Recarga la página.</p>'; });
    return;
  }
  netlifyIdentity.on('init', function (u) {
    if (u) cargar();
    else document.querySelectorAll('.ej-despues .ej-zona').forEach(function (z) {
      z.innerHTML = '<p class="ej-estado">Para subir tus fotos, <a href="/acceso.html?a=manual-' + esc(TALLER) + '">entra con tu cuenta</a>.</p>';
    });
  });
})();
