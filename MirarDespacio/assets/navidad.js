/* Toque de Navidad de mirardespacio.es: del 1 de diciembre al 6 de enero se activa solo
 * (para probar: ?navidad=1). Guirnalda de luces bajo el menú, franja «Regala un taller»
 * y nieve suave en la cabecera de la portada. Con «reducir movimiento», sin nieve ni parpadeo. */
(function () {
  var q = null; try { q = new URLSearchParams(location.search).get('navidad'); } catch (e) {}
  var d = new Date(), m = d.getMonth();
  if (q !== '1' && (q === '0' || !(m === 11 || (m === 0 && d.getDate() <= 6)))) return;
  var quieto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var css = document.createElement('style');
  css.textContent =
    ".md-guirnalda{position:absolute;left:0;right:0;bottom:-8px;height:12px;pointer-events:none;background:radial-gradient(ellipse 14px 5px at 50% 0,transparent 4px,rgba(154,147,135,.6) 4.5px,transparent 5.2px) 0 2px/22px 12px repeat-x}.md-guirnalda::before,.md-guirnalda::after{content:'';position:absolute;inset:0}.md-guirnalda::before{background:radial-gradient(circle,#c8312b 2.4px,transparent 2.9px) 11px 1px/88px 12px repeat-x,radial-gradient(circle,#e8821a 2.4px,transparent 2.9px) 33px 1px/88px 12px repeat-x,radial-gradient(circle,#2f7d4f 2.4px,transparent 2.9px) 55px 1px/88px 12px repeat-x,radial-gradient(circle,#e8347a 2.4px,transparent 2.9px) 77px 1px/88px 12px repeat-x}.md-guirnalda::after{background:radial-gradient(circle,#2f7d4f 2.4px,transparent 2.9px) 11px 1px/88px 12px repeat-x,radial-gradient(circle,#e8347a 2.4px,transparent 2.9px) 33px 1px/88px 12px repeat-x,radial-gradient(circle,#c8312b 2.4px,transparent 2.9px) 55px 1px/88px 12px repeat-x,radial-gradient(circle,#e8821a 2.4px,transparent 2.9px) 77px 1px/88px 12px repeat-x;opacity:0;animation:md-guirnalda-luz 2.4s steps(1) infinite}@keyframes md-guirnalda-luz{50%{opacity:1}}@media (prefers-reduced-motion: reduce){.md-guirnalda::after{animation:none}}" +
    '.md-franja{display:block;text-align:center;text-decoration:none;font-size:.88rem;padding:8px 16px;background:var(--tinta,#17191c);color:var(--crema,#fbfbfa)}' +
    '.md-franja b{font-weight:500;background:var(--degradado);-webkit-background-clip:text;background-clip:text;color:transparent}' +
    '.md-franja u{text-underline-offset:3px}' +
    '.md-nieve{position:absolute;inset:0;pointer-events:none;z-index:0}' +
    '';
  document.head.appendChild(css);

  // Guirnalda bajo el menú
  var nav = document.querySelector('header.nav');
  if (nav) {
    var g = document.createElement('div');
    g.className = 'md-guirnalda'; g.setAttribute('aria-hidden', 'true');
    nav.appendChild(g);
  }

  // Franja de regalos (no en la propia página de regalos ni en zonas privadas)
  if (!/^\/(regalo|socios|cuaderno|acceso|talleres\/ficha)(\/|$)/.test(location.pathname) && nav) {
    var a = document.createElement('a');
    a.className = 'md-franja'; a.href = '/regalo/';
    a.innerHTML = '🎁 <b>Regala un taller esta Navidad.</b> Tarjeta regalo al momento y la fecha la elige quien lo recibe · <u>Ver regalos</u>';
    a.addEventListener('click', function () { try { window.umami && umami.track('navidad-franja'); } catch (e) {} });
    nav.parentNode.insertBefore(a, nav);
  }

  // Nieve suave en la cabecera de la portada
  var portada = location.pathname === '/' && document.querySelector('.portada');
  if (portada && !quieto) {
    if (getComputedStyle(portada).position === 'static') portada.style.position = 'relative';
    var cv = document.createElement('canvas'); cv.className = 'md-nieve'; cv.setAttribute('aria-hidden', 'true');
    portada.insertBefore(cv, portada.firstChild);
    Array.prototype.forEach.call(portada.children, function (h) { if (h !== cv && getComputedStyle(h).position === 'static') { h.style.position = 'relative'; h.style.zIndex = 1; } });
    var cx = cv.getContext('2d'), copos = [];
    for (var k = 0; k < 60; k++) copos.push({ x: Math.random(), y: Math.random(), r: 0.8 + Math.random() * 1.4, v: 0.15 + Math.random() * 0.35, f: Math.random() * 6 });
    var medir = function () { var dp = Math.min(devicePixelRatio || 1, 2); cv.width = portada.clientWidth * dp; cv.height = portada.clientHeight * dp; cx.setTransform(dp, 0, 0, dp, 0, 0); };
    medir(); addEventListener('resize', medir);
    (function paso(t) {
      var W = portada.clientWidth, H = portada.clientHeight;
      cx.clearRect(0, 0, W, H); cx.fillStyle = 'rgba(154,147,135,.35)';
      copos.forEach(function (c) {
        c.y += c.v / H * 2; if (c.y > 1.02) { c.y = -0.02; c.x = Math.random(); }
        var x = c.x * W + Math.sin(t / 1500 + c.f) * 10;
        cx.beginPath(); cx.arc(x, c.y * H, c.r, 0, 7); cx.fill();
      });
      if (!document.hidden) requestAnimationFrame(paso); else setTimeout(function () { requestAnimationFrame(paso); }, 1000);
    })(0);
  }
})();
