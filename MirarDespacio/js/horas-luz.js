// Calculadora de horas de luz de los manuales (hora dorada, puesta, hora azul y noche)
// para cualquier ciudad de la lista o para donde esté la persona (GPS del móvil).
// Las horas salen siempre en la hora local de esa ciudad. Recuerda la última ciudad elegida.
//
// En la página: <div class="luz" id="calculadora"> con #dia, #ciudad, #h-dorada, #h-puesta, #h-azul,
// #h-noche, #falta y #luz-nota. Cálculo solar: mismo método que la librería suncalc.
(function () {
  var caja = document.getElementById('calculadora');
  if (!caja) return;
  var C = function (n, lat, lng, tz) { return { n: n, lat: lat, lng: lng, tz: tz || 'Europe/Madrid' }; };
  var CANARIAS = 'Atlantic/Canary';
  var GRUPOS = [
    ['España', [
      C('A Coruña', 43.3623, -8.4115), C('Albacete', 38.9943, -1.8585), C('Alicante', 38.3452, -0.4810), C('Almería', 36.8340, -2.4637),
      C('Ávila', 40.6566, -4.6818), C('Badajoz', 38.8794, -6.9707), C('Barcelona', 41.3874, 2.1686), C('Bilbao', 43.2630, -2.9350),
      C('Burgos', 42.3439, -3.6969), C('Cáceres', 39.4753, -6.3724), C('Cádiz', 36.5271, -6.2886), C('Castellón', 39.9864, -0.0513),
      C('Ceuta', 35.8894, -5.3213), C('Ciudad Real', 38.9848, -3.9274), C('Córdoba', 37.8882, -4.7794), C('Cuenca', 40.0704, -2.1374),
      C('Gijón', 43.5322, -5.6611), C('Girona', 41.9794, 2.8214), C('Granada', 37.1773, -3.5986), C('Guadalajara', 40.6337, -3.1667),
      C('Huelva', 37.2614, -6.9447), C('Huesca', 42.1401, -0.4089), C('Ibiza', 38.9067, 1.4206), C('Jaén', 37.7796, -3.7849),
      C('Las Palmas de Gran Canaria', 28.1235, -15.4363, CANARIAS), C('León', 42.5987, -5.5671), C('Lleida', 41.6176, 0.6200),
      C('Logroño', 42.4627, -2.4450), C('Lugo', 43.0097, -7.5568), C('Madrid', 40.4168, -3.7038), C('Málaga', 36.7213, -4.4214),
      C('Melilla', 35.2923, -2.9381), C('Murcia', 37.9922, -1.1307), C('Ourense', 42.3358, -7.8639), C('Oviedo', 43.3614, -5.8494),
      C('Palencia', 42.0095, -4.5288), C('Palma', 39.5696, 2.6502), C('Pamplona', 42.8125, -1.6458), C('Pontevedra', 42.4310, -8.6444),
      C('Salamanca', 40.9701, -5.6635), C('San Sebastián', 43.3183, -1.9812), C('Santa Cruz de Tenerife', 28.4636, -16.2518, CANARIAS),
      C('Santander', 43.4623, -3.8100), C('Santiago de Compostela', 42.8782, -8.5448), C('Segovia', 40.9429, -4.1088),
      C('Sevilla', 37.3891, -5.9845), C('Soria', 41.7666, -2.4790), C('Tarragona', 41.1189, 1.2445), C('Teruel', 40.3456, -1.1065),
      C('Toledo', 39.8628, -4.0273), C('Valencia', 39.4699, -0.3763), C('Valladolid', 41.6523, -4.7245), C('Vigo', 42.2406, -8.7207),
      C('Vitoria-Gasteiz', 42.8467, -2.6716), C('Zamora', 41.5034, -5.7467), C('Zaragoza', 41.6488, -0.8891),
    ]],
    ['Europa', [
      C('Ámsterdam', 52.3676, 4.9041, 'Europe/Amsterdam'), C('Berlín', 52.5200, 13.4050, 'Europe/Berlin'), C('Lisboa', 38.7223, -9.1393, 'Europe/Lisbon'),
      C('Londres', 51.5074, -0.1278, 'Europe/London'), C('Oporto', 41.1579, -8.6291, 'Europe/Lisbon'), C('París', 48.8566, 2.3522, 'Europe/Paris'),
      C('Roma', 41.9028, 12.4964, 'Europe/Rome'),
    ]],
    ['América', [
      C('Bogotá', 4.7110, -74.0721, 'America/Bogota'), C('Buenos Aires', -34.6037, -58.3816, 'America/Argentina/Buenos_Aires'),
      C('Ciudad de México', 19.4326, -99.1332, 'America/Mexico_City'), C('Lima', -12.0464, -77.0428, 'America/Lima'),
      C('Montevideo', -34.9011, -56.1645, 'America/Montevideo'), C('Nueva York', 40.7128, -74.0060, 'America/New_York'),
      C('Santiago de Chile', -33.4489, -70.6693, 'America/Santiago'),
    ]],
  ];
  var TODAS = [];
  GRUPOS.forEach(function (g) { g[1].forEach(function (c) { TODAS.push(c); }); });
  var CLAVE = 'md-ciudad-luz';
  var ciudad = TODAS.filter(function (c) { return c.n === 'Madrid'; })[0];
  try {
    var g = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    if (g && typeof g.lat === 'number' && typeof g.lng === 'number') ciudad = g;
  } catch (e) { /* sin almacenamiento: Madrid */ }

  // ---- Cálculo solar ----
  var rad = Math.PI / 180, dia = 864e5, J1970 = 2440588, J2000 = 2451545, e = rad * 23.4397, J0 = 0.0009;
  function horas(fecha, lat, lng) {
    var lw = rad * -lng, phi = rad * lat, d = fecha.valueOf() / dia - 0.5 + J1970 - J2000;
    var n = Math.round(d - J0 - lw / (2 * Math.PI));
    var ap = function (h) { return J0 + (h + lw) / (2 * Math.PI) + n; };
    var ds = ap(0), M = rad * (357.5291 + 0.98560028 * ds);
    var L = M + rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + rad * 102.9372 + Math.PI;
    var dec = Math.asin(Math.sin(L) * Math.sin(e));
    function cuando(alt) {
      var c = (Math.sin(alt * rad) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
      if (c < -1 || c > 1) return null; // ese día el sol no llega a esa altura (cerca de los polos)
      var w = Math.acos(c);
      var j = J2000 + ap(w) + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
      return new Date((j + 0.5 - J1970) * dia);
    }
    return { dorada: cuando(6), puesta: cuando(-0.833), azul: cuando(-4), noche: cuando(-8) };
  }

  var tz = function () { return ciudad.tz || 'Europe/Madrid'; };
  var fmt = function (d) { return d ? d.toLocaleTimeString('es-ES', { timeZone: tz(), hour: '2-digit', minute: '2-digit' }) : '—'; };
  var hoyAlli = function () { return new Date().toLocaleString('sv-SE', { timeZone: tz() }).slice(0, 10); };
  var $ = function (id) { return document.getElementById(id); };
  var input = $('dia'), sel = $('ciudad');

  // ---- Selector ----
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  sel.innerHTML = '<option value="gps">📍 Mi ubicación</option>' + GRUPOS.map(function (g) {
    return '<optgroup label="' + esc(g[0]) + '">' + g[1].map(function (c) { return '<option>' + esc(c.n) + '</option>'; }).join('') + '</optgroup>';
  }).join('');
  if (ciudad.gps) sel.insertAdjacentHTML('afterbegin', '<option value="actual" selected>' + esc(ciudad.n) + '</option>');
  else sel.value = ciudad.n;

  function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(ciudad)); } catch (e) { /* no pasa nada */ } }
  sel.addEventListener('change', function () {
    if (sel.value === 'actual') return;
    if (sel.value !== 'gps') {
      ciudad = TODAS.filter(function (c) { return c.n === sel.value; })[0] || ciudad;
      guardar(); input.value = hoyAlli(); pintar(); return;
    }
    if (!navigator.geolocation) { $('falta').textContent = 'Este navegador no puede darnos tu ubicación'; return; }
    $('falta').textContent = 'Buscando dónde estás…';
    navigator.geolocation.getCurrentPosition(function (p) {
      var zona = 'Europe/Madrid';
      try { zona = Intl.DateTimeFormat().resolvedOptions().timeZone || zona; } catch (e) { /* Madrid */ }
      ciudad = { n: 'Mi ubicación (' + p.coords.latitude.toFixed(2) + ', ' + p.coords.longitude.toFixed(2) + ')', lat: p.coords.latitude, lng: p.coords.longitude, tz: zona, gps: true };
      guardar();
      var vieja = sel.querySelector('option[value="actual"]'); if (vieja) vieja.remove();
      sel.insertAdjacentHTML('afterbegin', '<option value="actual" selected>' + esc(ciudad.n) + '</option>');
      input.value = hoyAlli(); pintar();
    }, function () {
      $('falta').textContent = 'No hemos podido saber dónde estás: elige una ciudad de la lista';
      sel.value = ciudad.gps ? 'actual' : ciudad.n;
    }, { timeout: 10000, maximumAge: 600000 });
  });

  // ---- Pintar ----
  function pintar() {
    var iso = input.value || hoyAlli();
    var h = horas(new Date(iso + 'T12:00:00Z'), ciudad.lat, ciudad.lng);
    $('h-dorada').textContent = fmt(h.dorada);
    $('h-puesta').textContent = fmt(h.puesta);
    $('h-azul').textContent = fmt(h.azul);
    $('h-noche').textContent = fmt(h.noche);
    var nota = $('luz-nota');
    if (nota) nota.textContent = 'Calculado para ' + (ciudad.gps ? 'tu ubicación' : 'el centro de ' + ciudad.n) + ', en su hora local' +
      (tz() !== 'Europe/Madrid' ? ' (' + tz().replace(/_/g, ' ') + ')' : '') + '. Son horas astronómicas: en la calle, los edificios tapan el sol bastante antes.';
    var falta = $('falta'), ahora = Date.now();
    if (iso !== hoyAlli() || !h.dorada || !h.noche) { falta.textContent = ''; return; }
    var min = function (t) { return Math.round((t - ahora) / 6e4); };
    var dura = function (m) { return m >= 90 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ' min'; };
    if (ahora < h.dorada) falta.textContent = 'faltan ' + dura(min(h.dorada)) + ' para la hora dorada';
    else if (ahora < h.puesta) falta.textContent = '¡hora dorada! el sol se pone en ' + min(h.puesta) + ' min';
    else if (ahora < h.azul) falta.textContent = 'el sol se ha puesto: la hora azul empieza en ' + min(h.azul) + ' min';
    else if (ahora < h.noche) falta.textContent = '¡hora azul! te quedan ' + min(h.noche) + ' min';
    else falta.textContent = 'por hoy se acabó la luz: mañana más';
  }
  input.value = hoyAlli();
  input.addEventListener('change', pintar);
  pintar();
  setInterval(pintar, 30000);
})();
