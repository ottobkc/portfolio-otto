// Calendario de Mirar Despacio: próximas salidas y talleres (y, en la zona de miembros, el cierre del reto).
// Uso:  <div id="agenda"></div>  +  <script src="https://ottokols.es/js/agenda.js"></script>
//       MDAgenda.pintar(document.getElementById('agenda'), { extra: [ {tipo:'reto', titulo, inicio, url} ] })
// Los datos salen de salidas-data.json y talleres-data.json a través de la función "agenda".
(function () {
  var API = 'https://ottokols.es/.netlify/functions/agenda';
  var FEED = 'webcal://mirardespacio.es/agenda.ics';
  var CAL = 'https://ottokols.es/.netlify/functions/calendario';
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var TIPOS = { salida: 'Salida', taller: 'Taller', reto: 'Reto del mes' };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var dia = function (iso) { return new Date(iso).toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).slice(0, 10); };
  var hora = function (iso) { return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }); };

  var CSS = '' +
    '.mda{--mda-tinta:#1a1814;--mda-gris:#6b655a;--mda-linea:#d8d2c6;--mda-papel:#ebe7df;--mda-crema:#f5f3ef;--mda-naranja:#e8821a;--mda-rosa:#e8347a;color:var(--mda-tinta)}' +
    '.mda-grid-wrap{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:32px;align-items:start}' +
    '.mda-cab{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}' +
    '.mda-cab h3{margin:0;font-family:Georgia,serif;font-weight:400;font-size:1.35rem;text-transform:capitalize}' +
    '.mda-cab button{border:1px solid var(--mda-linea);background:transparent;width:38px;height:38px;border-radius:50%;cursor:pointer;font-size:1.1rem;color:inherit}' +
    '.mda-cab button:disabled{opacity:.3;cursor:default}' +
    '.mda-mes{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}' +
    '.mda-mes .sem{font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:var(--mda-gris);text-align:center;padding:4px 0}' +
    '.mda-d{aspect-ratio:1;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:.92rem;position:relative;background:transparent;border:0;color:inherit;font:inherit}' +
    '.mda-d.fuera{opacity:.25}.mda-d.hoy{box-shadow:inset 0 0 0 1px var(--mda-tinta)}.mda-d.pasado{color:var(--mda-gris)}' +
    '.mda-d.con{cursor:pointer;background:var(--mda-papel);font-weight:500}.mda-d.con:hover{background:#e2ddd2}' +
    '.mda-puntos{display:flex;gap:3px}.mda-punto{width:7px;height:7px;border-radius:50%}' +
    '.mda-salida{background:var(--mda-naranja)}.mda-taller{background:var(--mda-rosa)}.mda-reto{background:var(--mda-tinta)}' +
    '.mda-leyenda{display:flex;flex-wrap:wrap;gap:14px;margin-top:12px;font-size:.82rem;color:var(--mda-gris)}' +
    '.mda-leyenda span{display:inline-flex;align-items:center;gap:6px}' +
    '.mda-lista{display:grid;gap:12px}' +
    '.mda-ev{display:grid;grid-template-columns:64px minmax(0,1fr);gap:14px;padding:14px;background:#fff;border-radius:10px;box-shadow:0 1px 6px rgba(26,24,20,.06);border-left:4px solid var(--mda-naranja);transition:box-shadow .2s}' +
    '.mda-ev.taller{border-left-color:var(--mda-rosa)}.mda-ev.reto{border-left-color:var(--mda-tinta)}' +
    '.mda-ev.marcado{box-shadow:0 0 0 2px var(--mda-rosa)}' +
    '.mda-fecha{text-align:center;line-height:1.05}.mda-fecha b{display:block;font-family:Georgia,serif;font-weight:400;font-size:1.9rem}' +
    '.mda-fecha span{font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--mda-gris)}' +
    '.mda-ev h4{margin:0 0 2px;font-size:1rem;font-weight:500}.mda-ev p{margin:0;font-size:.88rem;color:var(--mda-gris)}' +
    '.mda-acc{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;font-size:.85rem}.mda-acc a{color:inherit}' +
    '.mda-tipo{font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:var(--mda-gris)}' +
    '.mda-vacio{padding:18px;background:var(--mda-papel);border-radius:10px;color:var(--mda-gris)}' +
    '.mda-suscribir{margin-top:16px;font-size:.88rem;color:var(--mda-gris)}.mda-suscribir a{color:inherit}' +
    '@media (max-width:760px){.mda-grid-wrap{grid-template-columns:1fr}}';

  function estilos() {
    if (document.getElementById('mda-css')) return;
    var st = document.createElement('style'); st.id = 'mda-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  function pintar(el, op) {
    op = op || {};
    estilos();
    el.classList.add('mda');
    el.innerHTML = '<p class="mda-vacio">Cargando calendario…</p>';
    return fetch(API).then(function (r) { return r.json(); }).catch(function () { return []; }).then(function (lista) {
      var eventos = (Array.isArray(lista) ? lista : []).concat(op.extra || []).filter(function (e) { return e && e.inicio; })
        .sort(function (a, b) { return a.inicio.localeCompare(b.inicio); });
      var porDia = {};
      eventos.forEach(function (e) { (porDia[dia(e.inicio)] = porDia[dia(e.inicio)] || []).push(e); });
      var hoy = dia(new Date().toISOString());
      var actual = new Date(hoy + 'T12:00:00'); actual.setDate(1); // empieza en el mes actual
      var ultimo = eventos.length ? new Date(dia(eventos[eventos.length - 1].inicio) + 'T12:00:00') : actual;
      var primero = new Date(actual);

      el.innerHTML = '<div class="mda-grid-wrap"><div><div class="mda-cab"><button type="button" data-m="-1" aria-label="Mes anterior">‹</button><h3></h3>' +
        '<button type="button" data-m="1" aria-label="Mes siguiente">›</button></div><div class="mda-mes"></div>' +
        '<div class="mda-leyenda"><span><i class="mda-punto mda-salida"></i>Salidas</span>' +
        (eventos.some(function (e) { return e.tipo === 'taller'; }) ? '<span><i class="mda-punto mda-taller"></i>Talleres</span>' : '') +
        (eventos.some(function (e) { return e.tipo === 'reto'; }) ? '<span><i class="mda-punto mda-reto"></i>Reto del mes</span>' : '') + '</div></div>' +
        '<div><div class="mda-lista"></div><p class="mda-suscribir">📅 <a href="' + FEED + '">Suscríbete al calendario</a> y las fechas nuevas aparecerán solas en el tuyo · ' +
        '<a href="https://calendar.google.com/calendar/r?cid=' + encodeURIComponent(FEED) + '" target="_blank" rel="noopener">en Google Calendar</a></p></div></div>';

      var mesEl = el.querySelector('.mda-mes'), tit = el.querySelector('.mda-cab h3');
      function pintarMes() {
        var y = actual.getFullYear(), m = actual.getMonth();
        tit.textContent = MESES[m] + ' ' + y;
        el.querySelector('[data-m="-1"]').disabled = y === primero.getFullYear() && m === primero.getMonth();
        el.querySelector('[data-m="1"]').disabled = new Date(y, m + 1, 1) > new Date(ultimo.getFullYear(), ultimo.getMonth() + 2, 1);
        var html = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(function (d) { return '<span class="sem">' + d + '</span>'; }).join('');
        var ini = (new Date(y, m, 1).getDay() + 6) % 7;
        var d0 = new Date(y, m, 1 - ini);
        for (var i = 0; i < 42; i++) {
          var d = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + i);
          if (i >= 35 && d.getMonth() !== m) break;
          var k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
          var evs = porDia[k] || [];
          var cls = 'mda-d' + (d.getMonth() !== m ? ' fuera' : '') + (k === hoy ? ' hoy' : '') + (k < hoy ? ' pasado' : '') + (evs.length ? ' con' : '');
          html += (evs.length ? '<button type="button" class="' + cls + '" data-dia="' + k + '" title="' + esc(evs.map(function (e) { return e.titulo; }).join(' · ')) + '">' : '<span class="' + cls + '">') +
            d.getDate() + (evs.length ? '<span class="mda-puntos">' + evs.map(function (e) { return '<i class="mda-punto mda-' + e.tipo + '"></i>'; }).join('') + '</span>' : '') +
            (evs.length ? '</button>' : '</span>');
        }
        mesEl.innerHTML = html;
      }
      function pintarLista() {
        var cont = el.querySelector('.mda-lista');
        var prox = eventos.slice(0, op.max || 6);
        if (!prox.length) { cont.innerHTML = '<p class="mda-vacio">Ahora mismo no hay fechas cerradas. En cuanto haya una fecha nueva, aparecerá aquí.</p>'; return; }
        cont.innerHTML = prox.map(function (e) {
          var f = new Date(e.inicio);
          var sem = f.toLocaleDateString('es-ES', { weekday: 'short', timeZone: 'Europe/Madrid' });
          var mes = f.toLocaleDateString('es-ES', { month: 'short', timeZone: 'Europe/Madrid' });
          var cal = e.tipo === 'reto' ? '' : '<a href="' + CAL + '?inicio=' + encodeURIComponent(e.inicio) + '&fin=' + encodeURIComponent(e.fin || '') +
            '&zona=' + encodeURIComponent(e.zona || '') + '&titulo=' + encodeURIComponent('Mirar Despacio · ' + e.titulo) + '">+ A mi calendario</a>';
          var ir = e.url ? '<a href="' + esc(e.url) + '"><strong>' + (e.tipo === 'salida' ? 'Apuntarme' : e.tipo === 'taller' ? 'Ver el taller' : 'Ir al reto') + ' →</strong></a>' : '';
          return '<article class="mda-ev ' + e.tipo + '" data-dia="' + dia(e.inicio) + '"><div class="mda-fecha"><span>' + sem + '</span><b>' +
            Number(dia(e.inicio).slice(8)) + '</b><span>' + mes + '</span></div><div><span class="mda-tipo">' + (TIPOS[e.tipo] || '') + '</span>' +
            '<h4>' + esc(e.titulo) + '</h4><p>' + (e.tipo === 'reto' ? 'Último día para mandar tu foto' : hora(e.inicio) + ' h' + (e.zona ? ' · ' + esc(e.zona) : '') +
            (e.tipo === 'salida' ? ' · gratis' : e.precio ? ' · ' + e.precio + ' €' : '')) + '</p><div class="mda-acc">' + ir + cal + '</div></div></article>';
        }).join('');
      }
      el.addEventListener('click', function (ev) {
        var b = ev.target.closest('button'); if (!b || !el.contains(b)) return;
        if (b.dataset.m) { actual.setMonth(actual.getMonth() + Number(b.dataset.m)); pintarMes(); }
        if (b.dataset.dia) {
          var t = el.querySelector('.mda-ev[data-dia="' + b.dataset.dia + '"]');
          el.querySelectorAll('.mda-ev.marcado').forEach(function (x) { x.classList.remove('marcado'); });
          if (t) { t.classList.add('marcado'); t.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
        }
      });
      pintarMes(); pintarLista();
      return eventos;
    });
  }

  window.MDAgenda = { pintar: pintar };
})();
