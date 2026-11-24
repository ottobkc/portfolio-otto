/* Sello de Mirar Despacio: la web como una cámara de carrete en la calle.
 * - Visor abajo: la luz que hay ahora en Madrid (calculada con la puesta de sol real) y una
 *   exposición orientativa para ese momento; a la derecha, el contador de fotogramas del carrete
 *   que avanza al bajar por la página.
 * - Grano muy suave, quieto (no parpadea).
 * - La foto de portada como un fotograma de la hoja de contactos, marcada con lápiz graso.
 * - Cada titular de sección lleva su número de fotograma («14A»).
 * Con «reducir movimiento» no se anima nada; en móvil el visor se simplifica. */
(function () {
  var quieto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var css = document.createElement('style');
  css.textContent = [
    '.md-visor{position:fixed;z-index:30;bottom:14px;font:10.5px/1.5 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--gris,#6b655a);pointer-events:none;font-variant-numeric:tabular-nums;background:color-mix(in srgb,var(--crema,#f5f3ef) 80%,transparent);padding:4px 8px;border-radius:3px}',
    '.md-visor.izq{left:16px}.md-visor.der{right:16px;text-align:right}',
    '.md-visor .piloto{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:7px;vertical-align:1px;background:var(--naranja,#e8821a)}',
    '.md-grano{position:fixed;inset:0;z-index:29;pointer-events:none;opacity:.05;mix-blend-mode:multiply;background-size:180px}',
    '.md-fotograma{font:11px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.1em;color:var(--gris,#6b655a);display:block;margin-bottom:8px}',
    '.md-fotograma::before{content:"▸ "}',
    /* fotograma de la portada */
    '.md-contacto{position:relative;background:#141210;padding:22px 14px;box-shadow:0 18px 40px rgba(26,24,20,.18);transform:rotate(1.2deg);margin-bottom:28px}',
    '.md-contacto::before,.md-contacto::after{content:"";position:absolute;left:14px;right:14px;height:10px;background:radial-gradient(circle at 50% 50%,#3a3631 2.2px,transparent 2.8px) 0 0/16px 10px repeat-x}',
    '.md-contacto::before{top:6px}.md-contacto::after{bottom:6px}',
    '.md-contacto img{display:block;filter:grayscale(1) contrast(1.05)}',
    '.md-borde{position:absolute;left:0;bottom:-24px;font:11px ui-monospace,Menlo,monospace;letter-spacing:.14em;color:var(--gris,#6b655a);text-transform:uppercase}',
    '.md-lapiz{position:absolute;top:14px;left:4px;width:calc(100% - 10px);height:calc(100% - 26px);pointer-events:none;overflow:visible}',
    '.md-nota{position:absolute;right:10px;top:-40px;font:1.7rem/1 var(--f-mano,"Caveat",cursive);color:#c8312b;transform:rotate(-6deg)}',
    '@media (max-width:820px){.md-visor.izq{display:none}.md-visor{bottom:10px}}'
  ].join('');
  document.head.appendChild(css);

  // ---------- Luz de Madrid ahora (puesta y salida de sol, NOAA simplificado) ----------
  var LAT = 40.4168, LON = -3.7038;
  function solMadrid(d) {
    var rad = Math.PI / 180, n = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
    var g = 2 * Math.PI / 365 * (n - 1);
    var eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    var dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    var ha = Math.acos(Math.cos(90.833 * rad) / (Math.cos(LAT * rad) * Math.cos(dec)) - Math.tan(LAT * rad) * Math.tan(dec)) / rad;
    var utc0 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return { sale: new Date(utc0 + (720 - 4 * (LON + ha) - eq) * 6e4), pone: new Date(utc0 + (720 - 4 * (LON - ha) - eq) * 6e4) };
  }
  var hm = function (d) { return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }); };
  function luz() {
    var ahora = new Date(), s = solMadrid(ahora), min = function (a) { return Math.round((a - ahora) / 6e4); };
    var aPuesta = min(s.pone), desdePuesta = -aPuesta, aSalida = min(s.sale);
    if (aSalida > 0 && aSalida <= 40) return ['amanece a las ' + hm(s.sale), 'f/2.8 · 1/60 · ISO 1600'];
    if (aPuesta > 60 && aSalida <= 0) return ['luz de día · el sol se pone a las ' + hm(s.pone), 'f/8 · 1/250 · ISO 200'];
    if (aPuesta > 0) return ['hora dorada · el sol se pone a las ' + hm(s.pone), 'f/5.6 · 1/250 · ISO 400'];
    if (desdePuesta <= 35) return ['hora azul · hasta las ' + hm(new Date(s.pone.getTime() + 35 * 6e4)), 'f/2.8 · 1/60 · ISO 1600'];
    return ['de noche en Madrid · ' + hm(ahora), 'f/2 · 1/60 · ISO 3200'];
  }

  // ---------- Visor ----------
  var izq = document.createElement('div'), der = document.createElement('div');
  izq.className = 'md-visor izq'; der.className = 'md-visor der';
  izq.setAttribute('aria-hidden', 'true'); der.setAttribute('aria-hidden', 'true');
  document.body.appendChild(izq); document.body.appendChild(der);
  var exp = '';
  function pintaLuz() { var l = luz(); exp = l[1]; izq.innerHTML = '<span class="piloto"></span>' + l[0]; pintaContador(); }
  var titulos = Array.prototype.slice.call(document.querySelectorAll('main h2'));
  function pintaContador() {
    var vistos = 0, alto = innerHeight * 0.6;
    titulos.forEach(function (h) { if (h.getBoundingClientRect().top < alto) vistos++; });
    var n = Math.min(36, 1 + vistos);
    der.textContent = exp + ' · ' + (n < 10 ? '0' : '') + n + '/36';
  }
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
  var fig = location.pathname === '/' && document.querySelector('.portada figure');
  if (fig && fig.querySelector('img')) {
    var marco = document.createElement('div'); marco.className = 'md-contacto';
    var im = fig.querySelector('img'); fig.insertBefore(marco, im); marco.appendChild(im);
    var borde = document.createElement('span'); borde.className = 'md-borde'; borde.setAttribute('aria-hidden', 'true');
    borde.textContent = '▸ ' + (base - 1) + 'A · ' + (im.dataset.pie || 'Parque del Retiro · Madrid');
    marco.appendChild(borde);
    var ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'md-lapiz'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<path d="M3 4 C30 1.5 70 2.5 97.5 3.5 C98.5 35 97 70 98 96.5 C70 98.5 30 97.5 2.5 97 C1.5 70 2.5 35 4.5 2" fill="none" stroke="#c8312b" stroke-width="2.4" vector-effect="non-scaling-stroke" stroke-linecap="round" opacity=".9"/>';
    marco.appendChild(svg);
    var nota = document.createElement('span'); nota.className = 'md-nota'; nota.setAttribute('aria-hidden', 'true'); nota.textContent = 'esta ✓';
    marco.appendChild(nota);
  }
})();
