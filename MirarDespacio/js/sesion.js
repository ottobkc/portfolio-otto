/* Mirar Despacio · sesión de socios con Firebase (entrar con enlace al correo).
 * Sustituye al widget de Netlify Identity con la misma forma de uso, para no reescribir las páginas:
 *   netlifyIdentity.on('init' | 'login' | 'logout', fn)   netlifyIdentity.init()
 *   netlifyIdentity.currentUser() -> { email, user_metadata:{full_name}, app_metadata:{roles}, jwt(forzar) }
 *   netlifyIdentity.logout()      netlifyIdentity.open()  (lleva a /acceso/)
 * jwt() da el idToken de Firebase: las funciones de ottokols.es lo comprueban (lib/cuentas.js).
 * La protección de verdad está en el servidor (función edge «socios»): esto solo es la comodidad.
 */
(function () {
  var V = '10.12.2', G = 'https://www.gstatic.com/firebasejs/' + V + '/';
  var CFG = {
    apiKey: 'AIzaSyDfRTs1pF5-iV2dlNFY-dlFv4A-HcxZeTk', authDomain: 'mirardespaciocrm.firebaseapp.com', projectId: 'mirardespaciocrm',
    storageBucket: 'mirardespaciocrm.firebasestorage.app', messagingSenderId: '328402994544', appId: '1:328402994544:web:abab2ce9d54d286eb7fbb5',
  };
  var oyentes = { init: [], login: [], logout: [] };
  var usuario = null, iniciado = false, arrancado = false, F = null, auth = null;
  var GUARDA = 'md_sesion';

  function emitir(ev, u) { oyentes[ev].slice().forEach(function (f) { try { f(u); } catch (e) { console.error(e); } }); }
  function leerGuardado() { try { return JSON.parse(localStorage.getItem(GUARDA) || 'null'); } catch (e) { return null; } }
  function guardar(d) { try { if (d) localStorage.setItem(GUARDA, JSON.stringify(d)); else localStorage.removeItem(GUARDA); } catch (e) { /* nada */ } }

  // Pide (o renueva) la cookie del servidor y los roles. entrada: true la primera vez tras el enlace.
  function sesionServidor(fu, entrada) {
    return fu.getIdToken(!!entrada).then(function (t) {
      return fetch('/api/socios/sesion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ idToken: t, entrada: !!entrada }) });
    }).then(function (r) {
      if (r.status === 401) throw Object.assign(new Error('sin-cuenta'), { sinCuenta: true });
      if (!r.ok) throw new Error('servidor ' + r.status);
      return r.json();
    }).then(function (d) { guardar({ uid: fu.uid, email: d.email, nombre: d.nombre, roles: d.roles, caduca: d.caduca }); return d; });
  }

  function hacerUsuario(fu, d) {
    return {
      id: fu.uid, email: fu.email, user_metadata: { full_name: d.nombre || '' }, app_metadata: { roles: d.roles || [] },
      jwt: function (forzar) {
        // Con forzar se vuelven a pedir los roles (así se ve enseguida un acceso recién dado en el CRM)
        if (!forzar) return fu.getIdToken();
        return sesionServidor(fu).then(function (n) { usuario = hacerUsuario(fu, n); return fu.getIdToken(); });
      },
    };
  }

  function cargar() {
    if (F) return F;
    F = Promise.all([import(G + 'firebase-app.js'), import(G + 'firebase-auth.js')]).then(function (m) {
      var app = m[0].initializeApp(CFG, 'socios');
      auth = m[1].getAuth(app);
      return m[1];
    });
    return F;
  }

  function arrancar(opciones) {
    if (arrancado) return cargar();
    arrancado = true;
    var salir = false;
    try { salir = localStorage.getItem('md_salir') === '1'; } catch (e) { /* nada */ }
    return cargar().then(function (A) {
      // Un cierre de sesión que no terminó (la página cambió antes): se termina ahora
      if (salir) return A.signOut(auth).catch(function () {}).then(function () { try { localStorage.removeItem('md_salir'); } catch (e) { /* nada */ } return A; });
      return A;
    }).then(function (A) {
      A.onAuthStateChanged(auth, function (fu) {
        var antes = usuario;
        if (!fu) {
          guardar(null); usuario = null;
          if (!iniciado) { iniciado = true; emitir('init', null); } else if (antes) emitir('logout');
          return;
        }
        var g = leerGuardado();
        var fresco = g && g.uid === fu.uid && g.caduca * 1000 - Date.now() > 2 * 3600e3;
        var listo = fresco ? Promise.resolve(g) : sesionServidor(fu, opciones && opciones.entrada);
        listo.then(function (d) {
          usuario = hacerUsuario(fu, d);
          if (!iniciado) { iniciado = true; emitir('init', usuario); } else emitir('login', usuario);
        }).catch(function (e) {
          console.warn('sesión:', e.message);
          if (e.sinCuenta) { A.signOut(auth); return; }
          // Sin conexión con el servidor: se sigue con lo guardado si es de esta cuenta
          usuario = g && g.uid === fu.uid ? hacerUsuario(fu, g) : null;
          if (!iniciado) { iniciado = true; emitir('init', usuario); }
        });
      });
      return A;
    });
  }

  window.netlifyIdentity = window.mdSesion = {
    on: function (ev, f) {
      if (!oyentes[ev]) return;
      oyentes[ev].push(f);
      if (ev === 'init' && iniciado) setTimeout(function () { f(usuario); }, 0);
    },
    off: function (ev, f) { if (oyentes[ev]) oyentes[ev] = oyentes[ev].filter(function (x) { return x !== f; }); },
    init: function () { arrancar(); },
    currentUser: function () { return usuario; },
    open: function () { location.href = '/acceso/'; },
    close: function () {},
    logout: function () {
      // Muchas páginas cambian de dirección justo después: se deja la marca para que /acceso/ termine de cerrar
      try { localStorage.setItem('md_salir', '1'); } catch (e) { /* nada */ }
      guardar(null);
      try { fetch('/api/socios/salir', { method: 'POST', credentials: 'same-origin', keepalive: true }).catch(function () {}); } catch (e) { /* nada */ }
      return cargar().then(function (A) {
        return fetch('/api/socios/salir', { method: 'POST', credentials: 'same-origin' }).catch(function () {}).then(function () { return A.signOut(auth); });
      }).then(function () { guardar(null); try { localStorage.removeItem('md_salir'); } catch (e) { /* nada */ } });
    },
    // Para /acceso/
    _arrancar: arrancar, _cargar: cargar, _auth: function () { return auth; }, _sesionServidor: sesionServidor,
  };
  // Como el widget: arranca solo al cargar (llamar a init() otra vez no hace nada)
  if (!(document.currentScript && document.currentScript.dataset.manual === 'si')) arrancar();
})();
