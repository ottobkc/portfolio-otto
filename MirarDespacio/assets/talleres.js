/* Talleres, Mirar Despacio+ y regalos.
 * Lee talleres-data.json (precios, fechas, enlaces de Ko-fi) y pide a ottokols.es
 * las plazas libres y los datos de los bonos regalo. */
(function () {
  var API = 'https://ottokols.es/.netlify/functions/talleres';
  var KOFI = 'https://ko-fi.com/s/';
  var EMAIL = 'info@mirardespacio.es';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var buscar = function (lista, id) { return (lista || []).filter(function (x) { return x.id === id; })[0]; };
  var pasada = function (e) { return e.fechaISO && new Date(e.fechaISO).getTime() < Date.now(); };
  var esc = function (s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; };
  var track = function (n) { if (window.umami) window.umami.track(n); };

  function enlaceKofi(a, codigo, evento) {
    if (!codigo) return;
    a.href = KOFI + codigo;
    a.target = '_blank';
    a.rel = 'noopener';
    a.addEventListener('click', function () { track(evento); });
  }

  fetch('/talleres-data.json').then(function (r) { return r.json(); }).then(function (d) {
    // Precios y enlaces (así basta con cambiar el JSON)
    $$('[data-taller-precio]').forEach(function (e) { var t = buscar(d.talleres, e.dataset.tallerPrecio); if (t) e.textContent = t.precio + ' €'; });
    $$('[data-plus-precio]').forEach(function (e) { var p = d.plus && d.plus[e.dataset.plusPrecio]; if (p) e.textContent = p.precio + ' €'; });
    $$('[data-plus-url]').forEach(function (a) {
      var p = d.plus && d.plus[a.dataset.plusUrl];
      if (p && p.url) { a.href = p.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Unirme'; }
    });
    $$('[data-bono]').forEach(function (a) { var t = buscar(d.talleres, a.dataset.bono); if (t) enlaceKofi(a, t.bonoKofi, 'regalo-taller-comprar'); });
    $$('[data-regalo-plus]').forEach(function (a) { var r = buscar(d.regalosPlus, a.dataset.regaloPlus); if (r) enlaceKofi(a, r.kofi, 'regalo-plus-comprar'); });
    $$('[data-regalo-plus-precio]').forEach(function (e) { var r = buscar(d.regalosPlus, e.dataset.regaloPlusPrecio); if (r) e.textContent = r.precio + ' €'; });

    var cajas = $$('[data-ediciones]');
    var plazas = cajas.length || $('#regalo') ? fetch(API + '?plazas=1').then(function (r) { return r.json(); }).catch(function () { return {}; }) : Promise.resolve({});
    plazas.then(function (pl) {
      cajas.forEach(function (c) { pintarEdiciones(c, d, pl); });
      if ($('#regalo')) regalo(d, pl);
    });
  }).catch(function () {});

  function edicionesDe(d, tallerId) {
    return (d.ediciones || []).filter(function (e) { return e.taller === tallerId && e.activa && !pasada(e); });
  }

  function pintarEdiciones(caja, d, pl) {
    var t = buscar(d.talleres, caja.dataset.ediciones);
    var eds = edicionesDe(d, caja.dataset.ediciones);
    if (!eds.length) {
      caja.innerHTML = '<p class="aviso" style="margin:0">Próximas fechas por anunciar. <a href="mailto:' + EMAIL + '?subject=' +
        encodeURIComponent('Avísame del taller ' + (t ? t.titulo : '')) + '">Avísame</a></p>';
      return;
    }
    caja.innerHTML = '';
    eds.forEach(function (e) {
      var info = pl[e.id];
      var libres = info ? info.libres : null;
      var fila = document.createElement('div');
      fila.className = 'edicion';
      var txt = '<span><strong>' + esc(e.fecha) + '</strong> · ' + esc(e.hora || (t && t.hora) || '') + ' h' + (e.zona ? ' · ' + esc(e.zona) : '') +
        (libres === null ? '' : '<br><span class="aviso">' + (libres === 0 ? 'Completo' : 'Quedan ' + libres + (libres === 1 ? ' plaza' : ' plazas')) + '</span>') + '</span>';
      var boton = libres === 0
        ? '<a class="boton claro" href="mailto:' + EMAIL + '?subject=' + encodeURIComponent('Lista de espera · ' + (t ? t.titulo : '') + ' ' + e.fecha) + '">Lista de espera</a>'
        : '<a class="boton" data-reservar>Reservar</a>';
      fila.innerHTML = txt + boton;
      var a = $('[data-reservar]', fila);
      if (a) {
        if (e.kofi) enlaceKofi(a, e.kofi, 'taller-reservar');
        else a.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('Reserva · ' + (t ? t.titulo : '') + ' ' + e.fecha);
      }
      caja.appendChild(fila);
    });
  }

  // ---------- Página de regalo: tarjeta y canje ----------
  function regalo(d, pl) {
    var codigo = new URLSearchParams(location.search).get('c');
    var sin = $('#sinCodigo'), con = $('#conCodigo'), msg = $('#regaloMsg');
    $('#verCodigo').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var c = $('#codigoInput').value.trim();
      if (c) location.search = '?c=' + encodeURIComponent(c);
    });
    if (!codigo) { sin.hidden = false; return; }

    fetch(API + '?bono=' + encodeURIComponent(codigo)).then(function (r) {
      if (r.status === 404) throw new Error('404');
      return r.json();
    }).then(function (b) {
      con.hidden = false;
      $('#rTitulo').textContent = b.titulo || 'Un regalo';
      $('#rCodigo').textContent = b.codigo;
      $('#rCaduca').textContent = b.caduca ? 'Válido hasta el ' + b.caduca : '';
      if (b.usado) { $('#canje').innerHTML = '<p class="aviso"><strong>Este regalo ya se ha canjeado.</strong> Si crees que es un error, escríbeme a ' + EMAIL + '.</p>'; return; }
      if (b.caducado) { $('#canje').innerHTML = '<p class="aviso"><strong>Este regalo ha caducado.</strong> Escríbeme a ' + EMAIL + ' y lo vemos.</p>'; return; }

      var f = $('#canjeForm');
      f.hidden = false;
      if (b.tipo === 'taller') {
        var eds = edicionesDe(d, b.tallerId).filter(function (e) { return !pl[e.id] || pl[e.id].libres > 0; });
        var sel = $('#rEdicion');
        $('#rEdicionCampo').hidden = false;
        if (!eds.length) {
          f.hidden = true;
          $('#canje').insertAdjacentHTML('beforeend', '<p class="aviso">Todavía no hay fechas con plazas libres para este taller. Guarda el código: en cuanto las haya, podrás canjearlo aquí mismo. <a href="mailto:' + EMAIL + '?subject=' + encodeURIComponent('Avísame · regalo ' + b.codigo) + '">Avísame cuando haya fecha</a></p>');
          return;
        }
        sel.innerHTML = eds.map(function (e) { return '<option value="' + esc(e.id) + '">' + esc(e.fecha) + (e.zona ? ' · ' + esc(e.zona) : '') + '</option>'; }).join('');
        sel.required = true;
      }
      f.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var btn = $('button[type=submit]', f);
        btn.disabled = true;
        var datos = Object.fromEntries(new FormData(f));
        datos.codigo = b.codigo;
        fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) })
          .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (x) {
            if (!x.ok) throw x.j;
            f.hidden = true;
            track('regalo-canjeado');
            msg.hidden = false;
            msg.style.display = 'block';
            msg.innerHTML = x.j.tipo === 'taller'
              ? '<strong>¡Hecho!</strong> Tienes plaza en el taller del ' + esc(x.j.fecha) + '. Te acabo de mandar un email con los detalles.'
              : '<strong>¡Hecho!</strong> Ya estás en Mirar Despacio+ hasta el ' + esc(x.j.hasta) + '. Te llegará un email para crear tu contraseña.';
          })
          .catch(function (e) {
            btn.disabled = false;
            var m = { usado: 'Este regalo ya se había canjeado.', completo: 'Esa fecha se acaba de llenar. Elige otra.', caducado: 'Este regalo ha caducado.', edicion: 'Esa fecha ya no está disponible.' };
            alert((e && m[e.error]) || 'No se ha podido canjear. Prueba otra vez o escríbeme a ' + EMAIL);
          });
      });
    }).catch(function () {
      sin.hidden = false;
      $('#codigoInput').value = codigo;
      $('#codigoError').hidden = false;
    });

    $('#imprimir').addEventListener('click', function () { window.print(); });
  }
})();
