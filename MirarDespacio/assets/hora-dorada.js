/* Página «Hora dorada hoy en Madrid»: horas de luz calculadas en el navegador para hoy y los próximos 7 días.
 * Ángulos del sol que usamos (los habituales en fotografía):
 *   hora azul:     el sol entre 6° y 4° bajo el horizonte
 *   hora dorada:   el sol entre 4° bajo el horizonte y 6° por encima
 *   salida/puesta: -0,833° (lo que da cualquier calendario)
 * Cálculo NOAA simplificado: margen de un par de minutos, suficiente para salir a hacer fotos. */
(function () {
  var LAT = 40.4168, LON = -3.7038, TZ = 'Europe/Madrid';
  var raiz = document.getElementById('hd-hoy'), semana = document.getElementById('hd-semana');
  if (!raiz) return;

  function solar(d) {
    var n = Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5), g = 2 * Math.PI / 365 * (n - 1);
    return {
      eq: 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g)),
      dec: 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g)
    };
  }
  // Hora (Date) en que el sol pasa por una altura dada, por la mañana (sube) o por la tarde (baja)
  function momento(dia, altura, tarde) {
    var rad = Math.PI / 180, s = solar(dia);
    var c = (Math.sin(altura * rad) - Math.sin(LAT * rad) * Math.sin(s.dec)) / (Math.cos(LAT * rad) * Math.cos(s.dec));
    if (c > 1 || c < -1) return null;
    var ha = Math.acos(c) / rad;
    var utc0 = Date.UTC(dia.getUTCFullYear(), dia.getUTCMonth(), dia.getUTCDate());
    return new Date(utc0 + (720 - 4 * (LON + (tarde ? -ha : ha)) - s.eq) * 6e4);
  }
  var hm = function (d) { return d ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '—'; };
  var fecha = function (d, op) { return d.toLocaleDateString('es-ES', Object.assign({ timeZone: TZ }, op)); };

  function dia(d) {
    // mediodía de ese día en Madrid, para que el cálculo caiga en la fecha correcta
    var base = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12));
    return {
      d: base,
      azulM: [momento(base, -6, false), momento(base, -4, false)],
      doradaM: [momento(base, -4, false), momento(base, 6, false)],
      sale: momento(base, -0.833, false),
      pone: momento(base, -0.833, true),
      doradaT: [momento(base, 6, true), momento(base, -4, true)],
      azulT: [momento(base, -4, true), momento(base, -6, true)]
    };
  }

  function ahoraEs(h) {
    var t = Date.now(), en = function (r) { return r[0] && r[1] && t >= r[0] && t < r[1]; };
    if (en(h.azulM) || en(h.azulT)) return 'Ahora mismo es <b>hora azul</b>.';
    if (en(h.doradaM) || en(h.doradaT)) return 'Ahora mismo es <b>hora dorada</b>. Si puedes, sal ya.';
    if (t > h.doradaM[1] && t < h.doradaT[0]) {
      var min = Math.round((h.doradaT[0] - t) / 6e4);
      return 'Faltan <b>' + (min >= 60 ? Math.floor(min / 60) + ' h ' + (min % 60) + ' min' : min + ' min') + '</b> para la hora dorada de la tarde.';
    }
    return 'Ahora es de noche en Madrid.';
  }

  var hoy = dia(new Date());
  raiz.innerHTML =
    '<p class="hd-fecha">' + fecha(hoy.d, { weekday: 'long', day: 'numeric', month: 'long' }) + '</p>' +
    '<p class="hd-ahora">' + ahoraEs(hoy) + '</p>' +
    '<div class="hd-tramos">' +
      '<div class="hd-t azul"><span>Hora azul</span><b>' + hm(hoy.azulM[0]) + '–' + hm(hoy.azulM[1]) + '</b><small>mañana</small></div>' +
      '<div class="hd-t dorada"><span>Hora dorada</span><b>' + hm(hoy.doradaM[0]) + '–' + hm(hoy.doradaM[1]) + '</b><small>sale el sol a las ' + hm(hoy.sale) + '</small></div>' +
      '<div class="hd-t dorada"><span>Hora dorada</span><b>' + hm(hoy.doradaT[0]) + '–' + hm(hoy.doradaT[1]) + '</b><small>se pone el sol a las ' + hm(hoy.pone) + '</small></div>' +
      '<div class="hd-t azul"><span>Hora azul</span><b>' + hm(hoy.azulT[0]) + '–' + hm(hoy.azulT[1]) + '</b><small>tarde</small></div>' +
    '</div>';

  if (semana) {
    var filas = '';
    for (var i = 1; i <= 7; i++) {
      var h = dia(new Date(Date.now() + i * 864e5));
      filas += '<tr><td>' + fecha(h.d, { weekday: 'short', day: 'numeric', month: 'short' }) + '</td><td>' + hm(h.doradaM[0]) + '–' + hm(h.doradaM[1]) +
        '</td><td>' + hm(h.doradaT[0]) + '–' + hm(h.doradaT[1]) + '</td><td>' + hm(h.azulT[0]) + '–' + hm(h.azulT[1]) + '</td></tr>';
    }
    semana.innerHTML = '<table class="hd-tabla"><thead><tr><th>Día</th><th>Dorada (mañana)</th><th>Dorada (tarde)</th><th>Azul (tarde)</th></tr></thead><tbody>' + filas + '</tbody></table>';
  }
})();
