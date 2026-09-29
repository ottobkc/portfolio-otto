/* Mirar Despacio+ · control de acceso y registro de actividad
 * Incluir en todas las páginas de miembros, después del widget de Netlify Identity:
 *   <script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>
 *   <script src="/js/acceso.js"></script>
 * - Si no hay sesión, manda a /acceso.html (la protección real está en netlify.toml).
 * - Registra la página vista, cuando se sale de la página y cuando se cierra sesión.
 */
(function () {
  // data-init="no" en páginas que ya llaman a netlifyIdentity.init() por su cuenta
  var script = document.currentScript;
  var llamarInit = !(script && script.dataset.init === 'no');
  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var ENDPOINT = '/.netlify/functions/track';
  // Si hemos llegado a una página de miembros, el acceso ha ido bien: reinicia el contador anti-bucle de /acceso.html
  try { sessionStorage.removeItem('md_intentos'); } catch (e) {}
  var token = null;

  function enviar(tipo) {
    if (!token || local) return;
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        keepalive: true, // permite enviarlo aunque la pestaña se esté cerrando
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ tipo: tipo, ruta: location.pathname }),
      }).catch(function () {});
    } catch (e) {}
  }

  if (typeof netlifyIdentity === 'undefined') {
    if (!local) location.replace('/acceso.html');
    return;
  }

  netlifyIdentity.on('init', function (user) {
    if (!user) {
      if (llamarInit && !local) location.replace('/acceso.html');
      return;
    }
    // Token fresco (se renueva solo si ha caducado) y registro de la visita.
    user.jwt().then(function (t) {
      token = t;
      enviar('pagina');
    }).catch(function () {});
  });

  netlifyIdentity.on('logout', function () {
    enviar('logout');
  });

  // Salida de la página: cerrar pestaña, navegar fuera o mandar la app al fondo en el móvil.
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
