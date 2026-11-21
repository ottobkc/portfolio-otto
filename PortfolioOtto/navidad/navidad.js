/* Otto Kols · Navidad: copos, guirnalda, calendario de huecos y solicitud de reserva */
(function () {
  var API = '/.netlify/functions/navidad';
  var FORMSPREE = 'https://formspree.io/f/xrejydle';

  // Copos de nieve
  var copos = document.querySelector('.copos');
  if (copos) {
    var flake = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M12 2l-2 2.5M12 2l2 2.5M12 22l-2-2.5M12 22l2-2.5"/></svg>';
    for (var i = 0; i < 26; i++) {
      var c = document.createElement('span');
      var t = 8 + Math.random() * 16;
      c.className = 'copo';
      c.innerHTML = flake;
      c.style.left = (Math.random() * 100) + '%';
      c.style.width = c.style.height = t + 'px';
      c.style.opacity = (0.35 + Math.random() * 0.55).toFixed(2);
      c.style.animationDuration = (9 + Math.random() * 12) + 's';
      c.style.animationDelay = (-Math.random() * 20) + 's';
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) c.style.top = (Math.random() * 90) + '%';
      copos.appendChild(c);
    }
  }

  // Guirnalda: cable ondulado con bombillas colgando
  var g = document.querySelector('.guirnalda');
  if (g) {
    var NS = 'http://www.w3.org/2000/svg';
    var y = function (x) { return 10 + 22 * Math.abs(Math.sin(Math.PI * x / 240)); };
    var d = 'M0 ' + y(0);
    for (var px = 8; px <= 1200; px += 8) d += ' L' + px + ' ' + y(px).toFixed(1);
    var cable = document.createElementNS(NS, 'path');
    cable.setAttribute('d', d); cable.setAttribute('fill', 'none'); cable.setAttribute('stroke', '#2d3c4c'); cable.setAttribute('stroke-width', '2');
    g.appendChild(cable);
    var colores = ['#f2b35b', '#b8232f', '#f7f6f2', '#9fd3a8', '#e8821a'];
    for (var bx = 30, n = 0; bx < 1200; bx += 48, n++) {
      var e = document.createElementNS(NS, 'ellipse');
      e.setAttribute('cx', bx); e.setAttribute('cy', (y(bx) + 8).toFixed(1)); e.setAttribute('rx', 4.5); e.setAttribute('ry', 7);
      e.setAttribute('fill', colores[n % colores.length]); e.setAttribute('class', 'bombilla');
      e.style.animationDelay = (n % 5) * 0.4 + 's';
      g.appendChild(e);
    }
  }

  var form = document.getElementById('navForm');
  if (!form) return;
  var datos = null, sinApi = false;
  var sel = { mod: 'mini', dia: null, hora: null };
  var DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  var NOMBRES = { mini: 'Minisesión en la calle · 90 €', paseo: 'Sesión paseo · 150 €', casa: 'En casa · 120 €', bono: 'Bono regalo' };
  var rejilla = document.getElementById('rejilla');
  var horas = document.getElementById('horas');
  var estado = document.getElementById('cal-estado');
  var resumen = document.getElementById('resumen');
  var zonaSel = document.getElementById('n-zona');

  function fechaLarga(dia) {
    var d = new Date(dia + 'T12:00:00');
    return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function libresDe(mod) {
    var m = {};
    ((datos && datos.disponibilidad[mod]) || []).forEach(function (d) { m[d.dia] = d.horas; });
    return m;
  }

  function pintarMes() {
    var libres = libresDe(sel.mod);
    rejilla.innerHTML = DIAS.map(function (d) { return '<span class="ds">' + d + '</span>'; }).join('');
    var primero = new Date('2026-12-01T12:00:00').getDay(); // 0 domingo
    var hueco = (primero + 6) % 7;
    for (var i = 0; i < hueco; i++) rejilla.insertAdjacentHTML('beforeend', '<span class="vacio"></span>');
    for (var dnum = 1; dnum <= 31; dnum++) {
      var dia = '2026-12-' + (dnum < 10 ? '0' : '') + dnum;
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = dnum;
      if (libres[dia]) {
        b.className = 'libre' + (sel.dia === dia ? ' elegido' : '');
        b.setAttribute('aria-label', fechaLarga(dia) + ', ' + libres[dia].length + ' huecos libres');
        b.dataset.dia = dia;
      } else {
        b.disabled = true;
        b.setAttribute('aria-label', fechaLarga(dia) + ', sin huecos');
      }
      rejilla.appendChild(b);
    }
    var total = Object.keys(libres).length;
    estado.textContent = sinApi ? 'no he podido cargar los huecos' : (total ? total + ' días con huecos' : 'sin huecos libres');
    pintarHoras();
  }

  function pintarHoras() {
    if (sinApi) { horas.innerHTML = '<p>Escríbeme en el mensaje qué día y hora te vienen bien y te confirmo.</p>'; return; }
    if (!sel.dia) { horas.innerHTML = '<p>Elige un día marcado con punto rojo.</p>'; return; }
    var lista = libresDe(sel.mod)[sel.dia] || [];
    var fin = sel.mod === 'paseo' ? ' (1 hora)' : '';
    horas.innerHTML = '<p>' + fechaLarga(sel.dia) + fin + '</p><div class="lista">' + lista.map(function (h) {
      return '<button type="button" data-hora="' + h + '" class="' + (sel.hora === h ? 'elegido' : '') + '">' + h + '</button>';
    }).join('') + '</div>';
  }

  function pintarResumen() {
    var t = '<strong>' + NOMBRES[sel.mod] + '</strong>';
    if (sel.mod !== 'bono') t += sel.dia && sel.hora ? '<br>' + fechaLarga(sel.dia) + ' a las ' + sel.hora : '<br><span class="mono">Falta elegir día y hora</span>';
    resumen.innerHTML = t;
    resumen.style.display = 'block';
  }

  function cambiarModo(mod) {
    sel = { mod: mod, dia: null, hora: null };
    var tipo = mod === 'bono' ? 'bono' : (mod === 'casa' ? 'casa' : 'calle');
    document.querySelector('.calendario').hidden = tipo === 'bono';
    document.querySelectorAll('.solo-calle, .solo-casa, .solo-bono').forEach(function (el) {
      el.hidden = !el.classList.contains('solo-' + tipo);
    });
    var r = document.querySelector('.chips input[value="' + mod + '"]');
    if (r) r.checked = true;
    pintarMes();
    pintarResumen();
  }

  document.querySelectorAll('.chips input').forEach(function (r) {
    r.addEventListener('change', function () { cambiarModo(r.value); });
  });
  document.querySelectorAll('[data-elige]').forEach(function (a) {
    a.addEventListener('click', function () { cambiarModo(a.dataset.elige); });
  });
  rejilla.addEventListener('click', function (e) {
    var b = e.target.closest('button.libre');
    if (!b) return;
    sel.dia = b.dataset.dia; sel.hora = null;
    pintarMes(); pintarResumen();
  });
  horas.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-hora]');
    if (!b) return;
    sel.hora = b.dataset.hora;
    pintarHoras(); pintarResumen();
  });

  function cargar() {
    return fetch(API, { headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function (d) {
        datos = d; sinApi = false;
        zonaSel.innerHTML = (d.zonas || []).map(function (z) { return '<option>' + z + '</option>'; }).join('');
      })
      .catch(function () {
        sinApi = true;
        zonaSel.innerHTML = ['Sol y Gran Vía', 'Plaza Mayor y Austrias', 'Barrio de las Letras', 'Malasaña', 'Otro sitio (cuéntamelo)'].map(function (z) { return '<option>' + z + '</option>'; }).join('');
      });
  }

  cargar().then(function () {
    var q = new URLSearchParams(location.search).get('sesion');
    cambiarModo(NOMBRES[q] ? q : 'mini');
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = document.getElementById('n-enviar');
    var fd = new FormData(form);
    if (!form.nombre.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.value.trim())) { alert('Pon tu nombre y un email válido.'); return; }
    if (!form.acepta.checked) { alert('Marca la casilla de privacidad para poder enviarlo.'); return; }
    if (sel.mod !== 'bono' && !sinApi && !(sel.dia && sel.hora)) { alert('Elige un día y una hora en el calendario.'); return; }
    var cuerpo = {
      modalidad: sel.mod, dia: sel.dia, hora: sel.hora,
      nombre: fd.get('nombre'), email: fd.get('email'), telefono: fd.get('telefono'),
      personas: fd.get('personas'), zona: fd.get('zona'), direccion: fd.get('direccion'),
      bono_para: fd.get('bono_para'), bono_sesion: fd.get('bono_sesion'),
      mensaje: fd.get('mensaje'), acepta: true, web: fd.get('web')
    };
    btn.disabled = true;

    function hecho() {
      form.style.display = 'none';
      document.getElementById('navOk').style.display = 'block';
      if (window.umami) window.umami.track('navidad-solicitud', { modalidad: sel.mod });
    }
    function porFormspree() {
      var f = new FormData();
      f.append('_subject', 'Navidad · ' + NOMBRES[sel.mod] + ' · ottokols.es');
      Object.keys(cuerpo).forEach(function (k) { if (cuerpo[k] && k !== 'web' && k !== 'acepta') f.append(k, cuerpo[k]); });
      return fetch(FORMSPREE, { method: 'POST', body: f, headers: { Accept: 'application/json' } })
        .then(function (r) { if (!r.ok) throw new Error(); hecho(); });
    }

    var envio = sinApi ? porFormspree() : fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
      .then(function (r) {
        if (r.status === 409) {
          alert('Vaya, alguien acaba de coger ese hueco. Elige otro, porfa.');
          btn.disabled = false;
          return cargar().then(function () { sel.dia = null; sel.hora = null; pintarMes(); pintarResumen(); });
        }
        if (r.status >= 500) return porFormspree();
        if (!r.ok) throw new Error();
        hecho();
      });
    envio.catch(function () {
      btn.disabled = false;
      alert('No se ha podido enviar. Escríbeme a ottobkc@gmail.com');
    });
  });
})();
