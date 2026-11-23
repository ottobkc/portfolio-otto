/* Otto Kols · menú móvil, formulario de contacto y tipo de sesión preseleccionado */
(function () {
  var boton = document.querySelector('.nav-boton');
  var menu = document.querySelector('.nav ul');
  if (boton && menu) {
    boton.addEventListener('click', function () {
      var abierto = menu.classList.toggle('abierto');
      boton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
    });
  }

  // Desplegable de Retrato (clic y teclado; en escritorio también se abre al pasar el ratón)
  var desp = document.querySelector('.nav .desplegable');
  if (desp) {
    var b = desp.querySelector('button');
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      var abierto = desp.classList.toggle('abierto');
      b.setAttribute('aria-expanded', abierto ? 'true' : 'false');
    });
    document.addEventListener('click', function () { desp.classList.remove('abierto'); b.setAttribute('aria-expanded', 'false'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { desp.classList.remove('abierto'); b.setAttribute('aria-expanded', 'false'); } });
  }

  // /contacto/?tipo=actores preselecciona el tipo de sesión
  var tipo = new URLSearchParams(location.search).get('tipo');
  var select = document.getElementById('c-tipo');
  if (tipo && select) {
    Array.prototype.forEach.call(select.options, function (o) { if (o.dataset.clave === tipo) select.value = o.value; });
  }

  var form = document.getElementById('contactForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (r) {
          if (!r.ok) throw new Error();
          form.style.display = 'none';
          document.getElementById('contactOk').style.display = 'block';
          if (window.umami) window.umami.track('contacto-enviado', { tipo: select ? select.value : '' });
        })
        .catch(function () {
          btn.disabled = false;
          alert('No se ha podido enviar. Escríbeme a ottobkc@gmail.com');
        });
    });
  }
})();

/* Aviso emergente de Navidad 2026 (quitar en enero): sale una vez por visitante, a los 4 segundos,
   en las páginas públicas (no en /navidad/ ni en galerías, CRM, cuestionario, webs o privacidad). */
(function () {
  var fin = new Date('2026-12-22T20:00:00+01:00');
  if (Date.now() > fin.getTime()) return;
  if (/^\/(navidad|galeria|crm|cuestionario|webs|privacidad)\b/.test(location.pathname)) return;
  var CLAVE = 'ok-navidad-2026';
  try { if (localStorage.getItem(CLAVE)) return; } catch (e) {}
  var css = document.createElement('style');
  css.textContent =
    '.pop-navidad{position:fixed;right:20px;bottom:20px;z-index:60;width:min(340px,calc(100vw - 32px));background:#16202b;color:#f7f6f2;box-shadow:0 18px 40px rgba(0,0,0,.3);font:15px/1.5 var(--f-cuerpo);transform:translateY(20px);opacity:0;transition:transform .4s,opacity .4s}' +
    '.pop-navidad.ver{transform:none;opacity:1}' +
    '.pop-navidad .rayas{height:8px;background:repeating-linear-gradient(-45deg,#b8232f 0 8px,#f7f6f2 8px 16px)}' +
    '.pop-navidad .cuerpo{display:grid;grid-template-columns:62px 1fr;gap:14px;padding:18px 18px 20px}' +
    '.pop-navidad h3{font:400 1.7rem/1 var(--f-disp);margin:0 0 6px;color:#f7f6f2}.pop-navidad h3 em{color:#f3c6a0}' +
    '.pop-navidad p{margin:0 0 12px;color:#cdd6df;font-size:.92rem}' +
    '.pop-navidad a.btn{display:inline-block;background:#b8232f;border:1px solid #b8232f;color:#fff;padding:10px 14px;font:500 13px var(--f-mono);text-decoration:none}' +
    '.pop-navidad .cerrar{position:absolute;top:12px;right:8px;background:none;border:0;color:#8fa0b3;font-size:22px;line-height:1;cursor:pointer;padding:4px 8px}' +
    '.pop-navidad .cerrar:hover{color:#fff}' +
    '@media (prefers-reduced-motion:reduce){.pop-navidad{transition:none}}' +
    '@media (max-width:520px){.pop-navidad{right:16px;bottom:16px}.pop-navidad .cuerpo{grid-template-columns:44px 1fr}}';
  document.head.appendChild(css);
  var muneco = '<svg viewBox="0 0 60 84" aria-hidden="true"><circle cx="30" cy="62" r="18" fill="#f7f6f2"/><circle cx="30" cy="34" r="13" fill="#f7f6f2"/><rect x="19" y="8" width="22" height="14" fill="#151412"/><rect x="15" y="20" width="30" height="4" fill="#151412"/><rect x="19" y="16" width="22" height="3" fill="#b8232f"/><circle cx="25.5" cy="31" r="1.8" fill="#151412"/><circle cx="34" cy="31" r="1.8" fill="#151412"/><path d="M29 35 L40 38 L29 38.5 Z" fill="#e8821a"/><path d="M18 44 Q30 50 42 44 L42 48 Q30 54 18 48 Z" fill="#b8232f"/><circle cx="30" cy="58" r="1.8" fill="#151412"/><circle cx="30" cy="66" r="1.8" fill="#151412"/></svg>';
  function marcar() { try { localStorage.setItem(CLAVE, '1'); } catch (e) {} }
  setTimeout(function () {
    var el = document.createElement('aside');
    el.className = 'pop-navidad';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Sesiones de Navidad');
    el.innerHTML = '<div class="rayas"></div><button class="cerrar" type="button" aria-label="Cerrar">×</button>' +
      '<div class="cuerpo">' + muneco + '<div><h3>Fotos de <em>Navidad</em></h3>' +
      '<p>Entre las luces de Madrid a la hora azul, o en vuestra casa junto al árbol. Del 1 al 22 de diciembre, y con bono regalo.</p>' +
      '<a class="btn" href="/navidad/">Ver huecos libres</a></div></div>';
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('ver'); });
    marcar();
    if (window.umami) window.umami.track('navidad-popup-visto');
    el.querySelector('.cerrar').addEventListener('click', function () { marcar(); el.classList.remove('ver'); setTimeout(function () { el.remove(); }, 400); });
    el.querySelector('a.btn').addEventListener('click', function () { marcar(); if (window.umami) window.umami.track('navidad-popup-clic'); });
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { marcar(); el.remove(); document.removeEventListener('keydown', esc); } });
  }, 4000);
})();

/* Guirnalda de luces bajo el menú en Navidad: del 1 de diciembre al 6 de enero se pone y se quita sola
   (para probar: ?navidad=1). Sobria: puntos pequeños que parpadean despacio; sin movimiento si se pide. */
(function () {
  var q = null; try { q = new URLSearchParams(location.search).get('navidad'); } catch (e) {}
  var d = new Date(), m = d.getMonth();
  if (q !== '1' && (q === '0' || !(m === 11 || (m === 0 && d.getDate() <= 6)))) return;
  var nav = document.querySelector('header.nav');
  if (!nav) return;
  var css = document.createElement('style');
  css.textContent = ".ok-guirnalda{position:absolute;left:0;right:0;bottom:-8px;height:12px;pointer-events:none;background:radial-gradient(ellipse 14px 5px at 50% 0,transparent 4px,rgba(154,147,135,.6) 4.5px,transparent 5.2px) 0 2px/22px 12px repeat-x}.ok-guirnalda::before,.ok-guirnalda::after{content:'';position:absolute;inset:0}.ok-guirnalda::before{background:radial-gradient(circle,#b8232f 2.4px,transparent 2.9px) 11px 1px/88px 12px repeat-x,radial-gradient(circle,#f3c6a0 2.4px,transparent 2.9px) 33px 1px/88px 12px repeat-x,radial-gradient(circle,#2f6b4f 2.4px,transparent 2.9px) 55px 1px/88px 12px repeat-x,radial-gradient(circle,#f7f6f2 2.4px,transparent 2.9px) 77px 1px/88px 12px repeat-x}.ok-guirnalda::after{background:radial-gradient(circle,#2f6b4f 2.4px,transparent 2.9px) 11px 1px/88px 12px repeat-x,radial-gradient(circle,#f7f6f2 2.4px,transparent 2.9px) 33px 1px/88px 12px repeat-x,radial-gradient(circle,#b8232f 2.4px,transparent 2.9px) 55px 1px/88px 12px repeat-x,radial-gradient(circle,#f3c6a0 2.4px,transparent 2.9px) 77px 1px/88px 12px repeat-x;opacity:0;animation:ok-guirnalda-luz 2.4s steps(1) infinite}@keyframes ok-guirnalda-luz{50%{opacity:1}}@media (prefers-reduced-motion: reduce){.ok-guirnalda::after{animation:none}}";
  document.head.appendChild(css);
  var g = document.createElement('div'); g.className = 'ok-guirnalda'; g.setAttribute('aria-hidden', 'true');
  nav.appendChild(g);
})();
