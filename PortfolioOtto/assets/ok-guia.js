// Guía gratis de poses para sesiones de retrato (Otto Kols) a cambio del correo.
// Misma mecánica que la guía de Mirar Despacio, con su propia lista (suscriptores_ok) y su propio permiso.
// - Ventana que aparece a los 15 s o al bajar media página (lo que llegue antes), una vez por visita.
// - En el móvil sale como una franja abajo (no tapa la página: Google penaliza las ventanas a pantalla completa).
// - Si la cierras no vuelve en 30 días; si pides la guía, no vuelve nunca. Se guarda en este navegador
//   (localStorage, sin cookies). Si el navegador no deja guardar, simplemente puede volver a salir.
// - Cualquier elemento [data-guia-form] de la página (p. ej. /guia/) usa el mismo envío.
(function () {
  var CLAVE = 'ok_guia_poses', DIAS = 30, API = '/.netlify/functions/guia';
  var SI = /^\/(|retrato|parejas|mascotas|actores|guia-fotos-casting|navidad)(\/|$)/; // solo donde interesa el retrato
  var leer = function () { try { return JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch (e) { return null; } };
  var guardar = function (v) { try { localStorage.setItem(CLAVE, JSON.stringify(v)); } catch (e) {} };
  var track = function (n) { try { window.umami && window.umami.track(n); } catch (e) {} };
  var CSS = '.gd-fondo{position:fixed;inset:0;background:rgba(23,25,28,.45);z-index:900;display:flex;align-items:center;justify-content:center;padding:16px}' +
    '.gd{background:#fbfbfa;color:#17191c;max-width:440px;width:100%;padding:28px 26px 22px;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.25);position:relative;font-family:var(--f-cuerpo,system-ui,sans-serif)}' +
    '.gd h3{font-family:var(--f-disp,Georgia,serif);font-weight:400;font-size:1.7rem;line-height:1.15;margin:0 0 10px}.gd h3 em{color:var(--lapiz,#e8821a)}' +
    '.gd p{margin:0 0 14px;font-size:.95rem;line-height:1.5}.gd form{display:grid;gap:10px}' +
    '.gd input[type=email]{border:1px solid #dcdcd8;background:#fff;padding:11px 12px;font:inherit;border-radius:6px}' +
    '.gd label.ck{display:flex;gap:8px;align-items:flex-start;font-size:.82rem;color:#4a463f;line-height:1.4}.gd label.ck input{margin-top:3px}' +
    '.gd button.enviar{background:#17191c;color:#fff;border:0;padding:12px;font:inherit;font-weight:500;border-radius:6px;cursor:pointer}' +
    '.gd .cerrar{position:absolute;top:8px;right:10px;background:none;border:0;font-size:1.5rem;line-height:1;color:#62676e;cursor:pointer;padding:6px}' +
    '.gd .legal{font-size:.75rem;color:#7a746a;margin:4px 0 0}.gd .legal a{color:inherit}.gd .gd-trampa{position:absolute;left:-9999px}' +
    '.gd-barra{position:fixed;left:10px;right:10px;bottom:10px;z-index:900;max-width:none;width:auto;padding:16px 16px 14px}.gd-barra h3{font-size:1.15rem;padding-right:28px}.gd-barra p{font-size:.88rem;margin-bottom:10px}' +
    '.gd-barra:not(.abierta) form{display:none}';
  var FORM = '<form data-guia-form><input type="email" name="email" placeholder="Tu correo" required autocomplete="email">' +
    '<input class="gd-trampa" type="text" name="web" tabindex="-1" autocomplete="off" aria-hidden="true">' +
    '<label class="ck"><input type="checkbox" name="avisos"> Quiero recibir también avisos de sesiones y huecos libres (pocos, lo prometo).</label>' +
    '<button class="enviar" type="submit">Mándamela</button>' +
    '<p class="legal">Te la mando por correo. Tus datos solo los uso para eso y, si lo marcas, para los avisos. <a href="/privacidad/">Privacidad</a>.</p></form>';

  // Envío (vale para la ventana y para cualquier formulario [data-guia-form] de la página)
  function conectar(form, origen, alTerminar) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var b = form.querySelector('button[type=submit]'); b.disabled = true; b.textContent = 'Enviando…';
      var datos = { tipo: 'poses', email: form.email.value, avisos: !!(form.avisos && form.avisos.checked), web: form.web ? form.web.value : '', origen: origen + ' ' + location.pathname };
      fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) })
        .then(function (r) { if (!r.ok) throw r.status; guardar({ hecho: Date.now() }); track('guia-poses-pedida');
          form.innerHTML = '<p><strong>¡Hecho!</strong> Te la he mandado a ' + datos.email.replace(/[<>&"]/g, '') + '. Si no la ves, mira en promociones o spam.</p>';
          if (alTerminar) alTerminar();
        })
        .catch(function (s) { b.disabled = false; b.textContent = 'Mándamela';
          var e = form.querySelector('.gd-error') || form.appendChild(document.createElement('p')); e.className = 'gd-error legal';
          e.textContent = s === 400 ? 'Revisa el correo, parece que falta algo.' : 'No se ha podido enviar. Prueba otra vez en un momento.'; });
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-guia-form]'), function (f) { conectar(f, 'pagina'); });

  // Ventana emergente
  var est = leer();
  if (!SI.test(location.pathname) || (est && (est.hecho || (est.cerrado && Date.now() - est.cerrado < DIAS * 864e5)))) return;
  var mostrada = false;
  function mostrar() {
    if (mostrada) return;
    // En Navidad hay otro aviso: si está en pantalla, no se pisan; se vuelve a intentar en 20 s
    if (document.querySelector('.pop-navidad')) { setTimeout(mostrar, 20000); return; }
    mostrada = true;
    window.removeEventListener('scroll', alBajar);
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    var movil = window.innerWidth < 700;
    var caja = document.createElement('div');
    caja.className = 'gd' + (movil ? ' gd-barra' : '');
    caja.setAttribute('role', 'dialog'); caja.setAttribute('aria-label', 'Guía gratis de poses');
    caja.innerHTML = '<button class="cerrar" type="button" aria-label="Cerrar">×</button>' +
      '<h3>¿No sabes cómo <em>ponerte</em> en una foto?</h3>' +
      '<p>Te mando gratis mi guía de poses: en la calle, en estudio, en pareja y con tu perro. Para llegar a una sesión sin nervios.</p>' +
      (movil ? '<button class="enviar" type="button" data-abrir style="width:100%">Quiero la guía</button>' : '') + FORM;
    var fondo = null;
    if (movil) document.body.appendChild(caja);
    else { fondo = document.createElement('div'); fondo.className = 'gd-fondo'; fondo.appendChild(caja); document.body.appendChild(fondo);
      fondo.addEventListener('click', function (e) { if (e.target === fondo) cerrar(); }); }
    function quitar() { (fondo || caja).remove(); document.removeEventListener('keydown', tecla); }
    function cerrar() { guardar({ cerrado: Date.now() }); track('guia-poses-cerrada'); quitar(); }
    function tecla(e) { if (e.key === 'Escape') cerrar(); }
    document.addEventListener('keydown', tecla);
    caja.querySelector('.cerrar').addEventListener('click', cerrar);
    var abrir = caja.querySelector('[data-abrir]');
    if (abrir) abrir.addEventListener('click', function () { caja.classList.add('abierta'); abrir.remove(); caja.querySelector('input[type=email]').focus(); });
    conectar(caja.querySelector('form'), movil ? 'barra' : 'ventana', function () { setTimeout(quitar, 6000); });
    track('guia-poses-vista');
  }
  function alBajar() { if (window.scrollY > (document.documentElement.scrollHeight - window.innerHeight) * 0.5) mostrar(); }
  window.addEventListener('scroll', alBajar, { passive: true });
  setTimeout(mostrar, 15000);
})();
