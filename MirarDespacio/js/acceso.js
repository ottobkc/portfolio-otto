/* Mirar Despacio · zona de socios: control de acceso y registro de actividad.
 * Incluir en las páginas de socios, después de /js/sesion.js:
 *   <script src="/js/sesion.js"></script>
 *   <script src="/js/acceso.js"></script>
 * - Si no hay sesión, manda a /acceso/ (la protección de verdad está en el servidor: función edge «socios»).
 * - Registra la página vista, cuando se sale de la página y cuando se cierra sesión.
 */
(function () {
  var script = document.currentScript;
  var llamarInit = !(script && script.dataset.init === 'no');
  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var ENDPOINT = '/api/f/track';
  var volver = '/acceso/?volver=' + encodeURIComponent(location.pathname);
  try { sessionStorage.removeItem('md_intentos'); } catch (e) {}
  var token = null;

  function enviar(tipo) {
    if (!token || local) return;
    try {
      fetch(ENDPOINT, {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ tipo: tipo, ruta: location.pathname }),
      }).catch(function () {});
    } catch (e) {}
  }

  if (typeof netlifyIdentity === 'undefined') {
    if (!local) location.replace(volver);
    return;
  }
  netlifyIdentity.on('init', function (user) {
    if (!user) {
      if (llamarInit && !local) location.replace(volver);
      return;
    }
    user.jwt().then(function (t) { token = t; enviar('pagina'); }).catch(function () {});
  });
  netlifyIdentity.on('logout', function () { enviar('logout'); });

  var salidaEnviada = false;
  window.addEventListener('pagehide', function () {
    if (salidaEnviada) return;
    salidaEnviada = true;
    enviar('salida');
  });
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) { salidaEnviada = false; enviar('pagina'); }
  });
  if (llamarInit) netlifyIdentity.init();
})();
