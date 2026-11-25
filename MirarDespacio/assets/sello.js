/* Sello de Mirar Despacio: la web como una cámara de carrete en la calle.
 * - Visor abajo a la izquierda: la luz que hay ahora (salida y puesta de sol reales) en Madrid o en la
 *   ciudad que elija cada uno (se guarda en su navegador). Al pulsarlo se abre una nota con la
 *   explicación y ajustes orientativos (sin publicidad de salidas: eso ya está en la página).
 * - A la derecha (solo ordenador): los ajustes y el contador del carrete, que avanza al bajar.
 * - Grano muy suave y quieto. Número de fotograma en cada titular. Portada como hoja de contactos.
 * - Puntero de cámara (solo con ratón) y un flash pequeño al hacer clic o al tocar un botón.
 * El visor sale en la web y en los manuales; en las herramientas de MD+ no, para no tapar nada.
 * Con «reducir movimiento» no hay flash. */
(function () {
  var quieto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var css = document.createElement('style');
  css.textContent = [
    '.md-visor{position:fixed;z-index:30;bottom:14px;font:11px/1.5 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.06em;color:var(--gris,#62676e);font-variant-numeric:tabular-nums;background:color-mix(in srgb,var(--crema,#fbfbfa) 88%,transparent);padding:5px 10px;border-radius:4px;border:1px solid color-mix(in srgb,var(--gris,#62676e) 22%,transparent)}',
    '.md-visor.izq{left:16px;cursor:pointer;text-align:left}.md-visor.izq:hover{color:var(--tinta,#17191c)}',
    '.md-visor.izq u{text-decoration-style:dotted;text-underline-offset:3px}',
    '.md-visor.der{right:16px;text-align:right;pointer-events:none}',
    '.md-visor .piloto{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:7px;vertical-align:1px;background:var(--naranja,#e8821a)}',
    '.md-luz{position:fixed;z-index:31;left:16px;bottom:52px;width:min(360px,calc(100vw - 32px));background:var(--crema,#fbfbfa);color:var(--tinta,#17191c);border:1px solid var(--linea,#dcdcd8);border-radius:8px;box-shadow:0 14px 40px rgba(23,25,28,.16);padding:18px 18px 16px;font:15px/1.5 var(--f-texto,system-ui)}',
    '.md-luz p{margin:0 0 8px}.md-luz-tit{font-weight:600}.md-luz-nota{font-size:13px;color:var(--gris,#62676e)}',
    '.md-luz select{font:inherit;font-weight:600;color:inherit;background:transparent;border:0;border-bottom:1.5px dotted currentColor;padding:0 2px;cursor:pointer}',
    '.md-luz-cerrar{position:absolute;top:6px;right:8px;background:none;border:0;font-size:22px;line-height:1;color:var(--gris,#62676e);cursor:pointer;padding:4px}',
    '.md-luz-salida{display:inline-block;margin-top:4px;font-weight:600;color:inherit;text-decoration:underline;text-decoration-color:var(--rosa,#e8347a);text-underline-offset:3px}',
    '@media (max-width:820px){.md-visor.der{display:none}.md-visor{bottom:10px}.md-visor-que{display:none}.md-luz{bottom:46px}}',
    '.md-luz .oculto-visual{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}',
    '.md-grano{position:fixed;inset:0;z-index:29;pointer-events:none;opacity:.05;mix-blend-mode:multiply;background-size:180px}',
    '.md-fotograma{font:11px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.1em;color:var(--gris,#62676e);display:block;margin-bottom:8px}',
    '.md-fotograma::before{content:"▸ "}',
    /* fotograma de la portada */
    '.md-contacto{position:relative;background:#141210;padding:22px 14px;box-shadow:0 18px 40px rgba(23,25,28,.18);transform:rotate(1.2deg);margin-bottom:28px}',
    '.md-contacto::before,.md-contacto::after{content:"";position:absolute;left:14px;right:14px;height:10px;background:radial-gradient(circle at 50% 50%,#3a3631 2.2px,transparent 2.8px) 0 0/16px 10px repeat-x}',
    '.md-contacto::before{top:6px}.md-contacto::after{bottom:6px}',
    '.md-contacto img{display:block;filter:grayscale(1) contrast(1.05)}',
    '.md-borde{position:absolute;left:0;bottom:-24px;font:11px ui-monospace,Menlo,monospace;letter-spacing:.14em;color:var(--gris,#62676e);text-transform:uppercase}',
    '.md-lapiz{position:absolute;top:14px;left:4px;width:calc(100% - 10px);height:calc(100% - 26px);pointer-events:none;overflow:visible}',
    '.md-nota{position:absolute;right:10px;top:-40px;font:1.7rem/1 var(--f-mano,"Caveat",cursive);color:#c8312b;transform:rotate(-6deg)}',
  ].join('');
  document.head.appendChild(css);

  // ---------- Dónde se enseña el visor ----------
  // En las páginas de la web y en los manuales. En las herramientas de MD+ no, para no tapar nada.
  var conVisor = !!document.querySelector('header.nav') || /^\/manuales\//.test(location.pathname);

  // ---------- La luz que hay ahora (salida y puesta de sol, NOAA simplificado) ----------
  var CIUDADES = [
    ['Madrid', 40.4168, -3.7038, 'Europe/Madrid'], ['A Coruña', 43.3623, -8.4115, 'Europe/Madrid'],
    ['Alicante', 38.3452, -0.4810, 'Europe/Madrid'], ['Barcelona', 41.3874, 2.1686, 'Europe/Madrid'],
    ['Bilbao', 43.2630, -2.9350, 'Europe/Madrid'], ['Córdoba', 37.8882, -4.7794, 'Europe/Madrid'],
    ['Granada', 37.1773, -3.5986, 'Europe/Madrid'], ['Las Palmas', 28.1235, -15.4363, 'Atlantic/Canary'],
    ['Málaga', 36.7213, -4.4214, 'Europe/Madrid'], ['Murcia', 37.9922, -1.1307, 'Europe/Madrid'],
    ['Oviedo', 43.3614, -5.8494, 'Europe/Madrid'], ['Palma', 39.5696, 2.6502, 'Europe/Madrid'],
    ['Salamanca', 40.9701, -5.6635, 'Europe/Madrid'], ['San Sebastián', 43.3183, -1.9812, 'Europe/Madrid'],
    ['Santa Cruz de Tenerife', 28.4636, -16.2518, 'Atlantic/Canary'], ['Santiago de Compostela', 42.8782, -8.5448, 'Europe/Madrid'],
    ['Segovia', 40.9429, -4.1088, 'Europe/Madrid'], ['Sevilla', 37.3891, -5.9845, 'Europe/Madrid'],
    ['Toledo', 39.8628, -4.0273, 'Europe/Madrid'], ['Valencia', 39.4699, -0.3763, 'Europe/Madrid'],
    ['Valladolid', 41.6523, -4.7245, 'Europe/Madrid'], ['Vigo', 42.2406, -8.7207, 'Europe/Madrid'],
    ['Zaragoza', 41.6488, -0.8891, 'Europe/Madrid'], ['Lisboa', 38.7223, -9.1393, 'Europe/Lisbon'],
    ['Oporto', 41.1579, -8.6291, 'Europe/Lisbon'], ['París', 48.8566, 2.3522, 'Europe/Paris'],
    ['Londres', 51.5074, -0.1278, 'Europe/London'], ['Roma', 41.9028, 12.4964, 'Europe/Rome'],
    ['Berlín', 52.52, 13.405, 'Europe/Berlin'], ['Nueva York', 40.7128, -74.006, 'America/New_York'],
    ['Ciudad de México', 19.4326, -99.1332, 'America/Mexico_City'], ['Bogotá', 4.711, -74.0721, 'America/Bogota'],
    ['Lima', -12.0464, -77.0428, 'America/Lima'], ['Santiago de Chile', -33.4489, -70.6693, 'America/Santiago'],
    ['Buenos Aires', -34.6037, -58.3816, 'America/Argentina/Buenos_Aires'], ['Montevideo', -34.9011, -56.1645, 'America/Montevideo']
  ];
  var ciudad = CIUDADES[0];
  try { var guardada = localStorage.getItem('md-ciudad'); CIUDADES.forEach(function (c) { if (c[0] === guardada) ciudad = c; }); } catch (e) {}

  function sol(d, lat, lon) {
    var rad = Math.PI / 180, n = Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5);
    var g = 2 * Math.PI / 365 * (n - 1);
    var eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    var dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    var ha = Math.acos(Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(dec)) - Math.tan(lat * rad) * Math.tan(dec)) / rad;
    var utc0 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return { sale: new Date(utc0 + (720 - 4 * (lon + ha) - eq) * 6e4), pone: new Date(utc0 + (720 - 4 * (lon - ha) - eq) * 6e4) };
  }
  function hm(d) { return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: ciudad[3] }); }
  // Devuelve [nombre corto, frase completa, ajustes orientativos]
  function luz() {
    var ahora = new Date(), s = sol(ahora, ciudad[1], ciudad[2]);
    // si ya se ha puesto hoy, la próxima salida es la de mañana
    var m = sol(new Date(ahora.getTime() + 864e5), ciudad[1], ciudad[2]);
    var min = function (a) { return Math.round((a - ahora) / 6e4); };
    var aPuesta = min(s.pone), aSalida = min(s.sale), azulFin = new Date(s.pone.getTime() + 35 * 6e4);
    var proxSalida = aSalida > 0 ? s.sale : m.sale;
    if (aSalida > 40) return ['de noche', 'Es de noche. Hoy el sol sale a las ' + hm(s.sale) + '.', 'f/2 · 1/60 · ISO 3200'];
    if (aSalida > 0) return ['amanecer', 'Está amaneciendo. El sol sale a las ' + hm(s.sale) + '.', 'f/2.8 · 1/60 · ISO 1600'];
    if (aSalida > -60) return ['luz de mañana', 'Primera hora: luz baja y suave hasta las ' + hm(new Date(s.sale.getTime() + 60 * 6e4)) + '.', 'f/5.6 · 1/250 · ISO 400'];
    if (aPuesta > 45) return ['luz de día', 'Luz de día. El sol se pone a las ' + hm(s.pone) + '.', 'f/8 · 1/250 · ISO 200'];
    if (aPuesta > 0) return ['hora dorada', 'Hora dorada: el sol se pone a las ' + hm(s.pone) + '.', 'f/5.6 · 1/250 · ISO 400'];
    if (ahora < azulFin) return ['hora azul', 'Hora azul hasta las ' + hm(azulFin) + ': el mejor rato para fotos de noche con algo de cielo.', 'f/2.8 · 1/60 · ISO 1600'];
    return ['de noche', 'Es de noche. Mañana el sol sale a las ' + hm(proxSalida) + '.', 'f/2 · 1/60 · ISO 3200'];
  }

  if (conVisor) {
    var izq = document.createElement('button'), der = document.createElement('div');
    izq.type = 'button'; izq.className = 'md-visor izq'; der.className = 'md-visor der';
    izq.setAttribute('aria-expanded', 'false'); izq.setAttribute('aria-controls', 'md-luz');
    der.setAttribute('aria-hidden', 'true');
    var panel = document.createElement('div'); panel.id = 'md-luz'; panel.className = 'md-luz'; panel.hidden = true;
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'La luz que hay ahora');
    document.body.appendChild(izq); document.body.appendChild(der); document.body.appendChild(panel);
    var titulos = Array.prototype.slice.call(document.querySelectorAll('main h2'));
    var exp = '';
    function pintaContador() {
      var vistos = 0, alto = innerHeight * 0.6;
      titulos.forEach(function (h) { if (h.getBoundingClientRect().top < alto) vistos++; });
      var n = Math.min(36, 1 + vistos);
      der.textContent = 'si sales ahora: ' + exp + ' · ' + (n < 10 ? '0' : '') + n + '/36';
    }
    function pintaPanel(l) {
      var opciones = CIUDADES.map(function (c) { return '<option' + (c === ciudad ? ' selected' : '') + '>' + c[0] + '</option>'; }).join('');
      panel.innerHTML =
        '<button type="button" class="md-luz-cerrar" aria-label="Cerrar">×</button>' +
        '<p class="md-luz-tit">La luz ahora en <label class="md-luz-sel"><span class="oculto-visual">Ciudad</span><select>' + opciones + '</select></label></p>' +
        '<p class="md-luz-frase">' + l[1] + '</p>' +
        '<p class="md-luz-exp"><b>Si sales ahora a hacer fotos:</b> ' + l[2] + '</p>' +
        '<p class="md-luz-nota">Son ajustes orientativos para empezar; luego mira la foto y corrige. Se calcula con la salida y la puesta de sol reales de cada día.</p>' +
        (ciudad[0] === 'Madrid' ? '<a class="md-luz-salida" href="/hora-dorada-madrid/">Horas de luz de toda la semana →</a>' : '');
      panel.querySelector('select').addEventListener('change', function (e) {
        CIUDADES.forEach(function (c) { if (c[0] === e.target.value) ciudad = c; });
        try { localStorage.setItem('md-ciudad', ciudad[0]); } catch (er) {}
        pintaLuz();
      });
      panel.querySelector('.md-luz-cerrar').addEventListener('click', cerrar);
    }
    function pintaLuz() {
      var l = luz(); exp = l[2];
      izq.innerHTML = '<span class="piloto"></span><span class="md-visor-que">Luz ahora en </span><u>' + ciudad[0] + '</u>: ' + l[0];
      izq.setAttribute('aria-label', 'Luz ahora en ' + ciudad[0] + ': ' + l[0] + '. Pulsa para ver detalles o cambiar de ciudad');
      if (!panel.hidden) pintaPanel(l);
      pintaContador();
    }
    function abrir() {
      panel.hidden = false; izq.setAttribute('aria-expanded', 'true'); pintaPanel(luz());
    }
    function cerrar() { panel.hidden = true; izq.setAttribute('aria-expanded', 'false'); izq.focus(); }
    izq.addEventListener('click', function () { panel.hidden ? abrir() : cerrar(); });
    addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) cerrar(); });
    document.addEventListener('pointerdown', function (e) { if (!panel.hidden && !panel.contains(e.target) && !izq.contains(e.target)) { panel.hidden = true; izq.setAttribute('aria-expanded', 'false'); } });
    pintaLuz(); setInterval(pintaLuz, 60000);
    addEventListener('scroll', pintaContador, { passive: true });

    // ---------- Número de fotograma en cada titular de sección ----------
    var base = 11 + (new Date().getDate() % 7);
    titulos.forEach(function (h, i) {
      if (h.closest('.md-sin-fotograma')) return;
      var s = document.createElement('span'); s.className = 'md-fotograma'; s.setAttribute('aria-hidden', 'true');
      s.textContent = (base + i) + 'A';
      h.parentNode.insertBefore(s, h);
    });
  }

  // ---------- Grano (una sola imagen, quieta) ----------
  try {
    var c = document.createElement('canvas'); c.width = c.height = 180;
    var x = c.getContext('2d'), img = x.createImageData(180, 180);
    for (var i = 0; i < img.data.length; i += 4) { var v = Math.random() * 255 | 0; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    x.putImageData(img, 0, 0);
    var g = document.createElement('div'); g.className = 'md-grano'; g.style.backgroundImage = 'url(' + c.toDataURL() + ')';
    document.body.appendChild(g);
  } catch (e) {}

  // ---------- Portada: fotograma de la hoja de contactos marcado con lápiz graso ----------
  var fig = conVisor && location.pathname === '/' && document.querySelector('.portada figure');
  if (fig && fig.querySelector('img')) {
    var marco = document.createElement('div'); marco.className = 'md-contacto';
    var im = fig.querySelector('img'); fig.insertBefore(marco, im); marco.appendChild(im);
    var borde = document.createElement('span'); borde.className = 'md-borde'; borde.setAttribute('aria-hidden', 'true');
    borde.textContent = '▸ ' + (base - 1) + 'A · ' + (im.dataset.pie || 'Madrid');
    marco.appendChild(borde);
    var ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'md-lapiz'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<path d="M3 4 C30 1.5 70 2.5 97.5 3.5 C98.5 35 97 70 98 96.5 C70 98.5 30 97.5 2.5 97 C1.5 70 2.5 35 4.5 2" fill="none" stroke="#c8312b" stroke-width="2.4" vector-effect="non-scaling-stroke" stroke-linecap="round" opacity=".9"/>';
    marco.appendChild(svg);
    var nota = document.createElement('span'); nota.className = 'md-nota'; nota.setAttribute('aria-hidden', 'true'); nota.textContent = 'esta ✓';
    marco.appendChild(nota);
  }

  // ---------- Puntero de cámara y flash al hacer clic (o al tocar en el móvil) ----------
  var calma = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var raton = matchMedia('(hover: hover) and (pointer: fine)').matches;
  function camara(c) {
    return "url(\"data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' +
      '<path d="M5 10h5l2-3h8l2 3h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V12a2 2 0 0 1 2-2z" fill="#fff" stroke="#17191c" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<circle cx="16" cy="18" r="5" fill="' + c + '" stroke="#17191c" stroke-width="1.6"/>' +
      '<circle cx="25" cy="13.5" r="1.2" fill="#e8347a"/></svg>') + "\") 16 18";
  }
  if (raton) {
    var cur = document.createElement('style');
    cur.textContent = 'html,body{cursor:' + camara('#fff') + ',auto}' +
      'a,button,[role=button],label,summary,select{cursor:' + camara('#e8821a') + ',pointer}' +
      'input,textarea,[contenteditable]{cursor:text}';
    document.head.appendChild(cur);
  }
  if (!calma) {
    var fl = document.createElement('style');
    fl.textContent = '.md-flash{position:fixed;width:180px;height:180px;margin:-90px 0 0 -90px;border-radius:50%;pointer-events:none;z-index:2147483646;' +
      'background:radial-gradient(circle,rgba(255,255,255,.95) 0,rgba(255,250,235,.55) 28%,rgba(255,250,235,0) 70%);animation:mdFlash .32s ease-out forwards}' +
      '@keyframes mdFlash{0%{opacity:0;transform:scale(.3)}18%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.25)}}';
    document.head.appendChild(fl);
    var ultimo = 0;
    addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      // en el móvil, solo al tocar algo que se pueda pulsar
      if (e.pointerType !== 'mouse' && !e.target.closest('a,button,[role=button],label,summary')) return;
      var t = Date.now(); if (t - ultimo < 350) return; ultimo = t;   // nunca más de ~3 flashes por segundo
      var f = document.createElement('div'); f.className = 'md-flash';
      f.style.left = e.clientX + 'px'; f.style.top = e.clientY + 'px';
      document.body.appendChild(f); setTimeout(function () { f.remove(); }, 400);
    }, { passive: true });
  }
})();
