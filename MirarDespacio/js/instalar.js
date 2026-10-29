/* Mirar Despacio · «Ten Mirar Despacio en tu móvil»
 * Tarjeta pequeña (se puede cerrar y no vuelve a salir en 60 días) que ayuda a instalar la zona de socios como app:
 *  - Android y Chrome/Edge en ordenador: el botón abre la ventana de instalar del sistema.
 *  - iPhone/iPad: Apple no deja instalar desde un botón; se enseñan los dos toques (Compartir → Añadir a pantalla de inicio).
 *  - Dentro de Instagram, Facebook o similares no se puede: se pide abrirla en Safari o Chrome.
 * No sale si ya está instalada (se abre como app) ni en ordenadores sin instalación posible.
 */
(function () {
  var CLAVE = 'md_instalar_cerrado';
  var ua = navigator.userAgent || '';
  var ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var android = /Android/.test(ua);
  var dentroDeApp = /Instagram|FBAN|FBAV|Line\/|TikTok|Twitter/i.test(ua);
  var instalada = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var aviso = null;

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(function () {});
  function evento(n) { try { if (window.umami) umami.track(n); } catch (e) { /* nada */ } }
  window.addEventListener('appinstalled', function () { evento('app-instalada'); cerrar(true); });
  if (instalada) { try { if (!sessionStorage.getItem('md_app_abierta')) { sessionStorage.setItem('md_app_abierta', '1'); evento('app-abierta'); } } catch (e) { /* nada */ } return; }
  try { var c = Number(localStorage.getItem(CLAVE) || 0); if (c && Date.now() - c < 60 * 864e5) return; } catch (e) { /* nada */ }

  var css = '.md-inst{position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;max-width:440px;margin:0 auto;background:#1a1814;color:#f5f3ef;' +
    'border-radius:16px;padding:14px 16px 14px 16px;box-shadow:0 10px 30px rgba(0,0,0,.25);font:15px/1.45 Inter,"Helvetica Neue",Arial,sans-serif;display:flex;gap:12px;align-items:flex-start}' +
    '.md-inst img{width:44px;height:44px;border-radius:10px;flex:0 0 auto}.md-inst b{display:block;font-weight:600;margin-bottom:2px}' +
    '.md-inst p{margin:0;color:#d9d4ca}.md-inst .md-acc{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}' +
    '.md-inst button{font:inherit;border:0;border-radius:999px;padding:8px 14px;cursor:pointer}.md-inst .md-si{background:linear-gradient(100deg,#e8821a,#e8347a);color:#fff;font-weight:600}' +
    '.md-inst .md-no{background:transparent;color:#d9d4ca;padding:8px 6px}.md-inst ol{margin:6px 0 0;padding-left:18px;color:#d9d4ca}' +
    '.md-inst .md-x{position:absolute;top:6px;right:8px;background:none;color:#8a8378;font-size:18px;padding:4px 8px}';

  function cerrar(sinGuardar) {
    if (aviso) aviso.remove(); aviso = null;
    if (!sinGuardar) { try { localStorage.setItem(CLAVE, String(Date.now())); } catch (e) { /* nada */ } }
  }
  function mostrar(html, alPulsar) {
    if (aviso) return;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    aviso = document.createElement('div'); aviso.className = 'md-inst'; aviso.setAttribute('role', 'dialog'); aviso.setAttribute('aria-label', 'Instalar Mirar Despacio');
    aviso.innerHTML = '<img src="/assets/app-192.png" alt=""><div style="flex:1;padding-right:18px">' + html + '</div><button type="button" class="md-x" aria-label="Cerrar">×</button>';
    document.body.appendChild(aviso);
    aviso.querySelector('.md-x').onclick = function () { evento('app-aviso-cerrado'); cerrar(); };
    var no = aviso.querySelector('.md-no'); if (no) no.onclick = function () { cerrar(); };
    var si = aviso.querySelector('.md-si'); if (si && alPulsar) si.onclick = alPulsar;
    evento('app-aviso-visto');
  }
  var TIT = '<b>Ten Mirar Despacio en tu móvil</b>';

  if (dentroDeApp) {
    if (ios || android) setTimeout(function () { mostrar(TIT + '<p>Para guardarla en tu pantalla de inicio, abre esta página en ' + (ios ? 'Safari' : 'Chrome') + ' (menú ··· → «Abrir en el navegador»).</p>'); }, 2500);
    return;
  }
  if (ios) {
    setTimeout(function () {
      mostrar(TIT + '<p>Un toque y la tienes junto a tus apps, como una más.</p><div class="md-acc"><button type="button" class="md-si">Cómo se hace</button><button type="button" class="md-no">Ahora no</button></div>', function () {
        evento('app-guia-ios');
        aviso.querySelector('div').innerHTML = TIT + '<ol><li>Pulsa <b style="display:inline">Compartir</b> (el cuadrado con la flecha hacia arriba).</li><li>Elige <b style="display:inline">«Añadir a pantalla de inicio»</b>.</li></ol><p style="margin-top:6px">Luego entra desde el icono nuevo.</p>';
      });
    }, 2500);
    return;
  }
  // Android y ordenadores con Chrome/Edge: el navegador avisa cuando se puede instalar
  var pedido = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); pedido = e;
    mostrar(TIT + '<p>Instálala y entra con un toque, sin buscar la web.</p><div class="md-acc"><button type="button" class="md-si">Instalar</button><button type="button" class="md-no">Ahora no</button></div>', function () {
      evento('app-instalar-pulsado');
      pedido.prompt();
      pedido.userChoice.then(function (r) { if (r && r.outcome === 'accepted') cerrar(true); else cerrar(); });
    });
  });
  // Android sin ese aviso (Firefox…): se explica a mano
  if (android) setTimeout(function () { if (!pedido) mostrar(TIT + '<p>Abre el menú del navegador (⋮) y elige «Instalar» o «Añadir a pantalla de inicio».</p><div class="md-acc"><button type="button" class="md-no">Entendido</button></div>'); }, 6000);
})();
