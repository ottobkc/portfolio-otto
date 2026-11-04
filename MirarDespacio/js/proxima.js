// Mirar Despacio · rellena cualquier [data-proxima] con la próxima salida de /salidas-data.json
// Igual que en /salidas/: "Por determinar" en fecha = aún sin fecha; una salida pasada o
// todavía solo para Mirar Despacio+ (publicaDesde) no se muestra.
(function () {
  var huecos = document.querySelectorAll('[data-proxima]');
  if (!huecos.length) return;
  fetch('/salidas-data.json').then(function (r) { return r.json(); }).then(function (d) {
    var pendiente = function (v) { return !v || /^por (determinar|confirmar|anunciar)/i.test(String(v).trim()); };
    var pasada = function (x) { return x.fechaISO && new Date(x.fechaISO).getTime() + 4 * 3600e3 < Date.now(); };
    var oculta = function (x) { return x.publicaDesde && Date.now() < new Date(x.publicaDesde).getTime(); };
    var s = (d.proximas || []).filter(function (x) { return x.activa && !pendiente(x.fecha) && !pasada(x) && !oculta(x); })[0];
    huecos.forEach(function (el) {
      if (!s) { el.textContent = 'Próxima fecha por anunciar. Apúntate y te aviso.'; return; }
      var t = 'Próxima salida: ' + s.fecha;
      if (!pendiente(s.zona)) t += ' · ' + s.zona;
      if (!pendiente(s.hora)) t += ' · ' + s.hora + ' h';
      el.textContent = t;
    });
  }).catch(function () {});
})();
