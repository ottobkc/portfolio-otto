// Hilo de conversación de cada foto comentada: solo lo ven la persona dueña de la foto y Otto.
//   MDHilo.html(f)            -> HTML del hilo y de la caja para responder (f = foto con .id, .comentario, .hilo)
//   MDHilo.alPulsar(t, envia) -> llamar desde el click de la página; envia(id, texto) devuelve una promesa
//   MDHilo.irA()              -> tras pintar, abre la foto que indica el #foto-ID del enlace del email
(function () {
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function fecha(ms) { var d = new Date(ms); return isNaN(d) ? '' : d.getDate() + ' ' + MESES[d.getMonth()]; }

  var css = document.createElement('style');
  css.textContent =
    '.hilo{margin-top:12px;border-top:1px dashed rgba(122,117,111,.45);padding-top:10px}' +
    '.hilo-msg{margin:8px 0;padding:8px 12px;border-radius:10px;font-size:.95rem;line-height:1.45;white-space:pre-line;max-width:92%}' +
    '.hilo-msg small{display:block;opacity:.65;font-size:.75rem;margin-bottom:2px;white-space:normal}' +
    '.hilo-msg.otto{background:rgba(232,52,122,.09);border-left:3px solid #e8347a}' +
    '.hilo-msg.persona{background:rgba(26,24,20,.07);margin-left:auto}' +
    '.hilo-form{display:grid;gap:6px;margin-top:8px}' +
    '.hilo-form textarea{width:100%;box-sizing:border-box;min-height:64px;padding:8px 10px;border:1px solid rgba(122,117,111,.5);border-radius:8px;font:inherit;font-size:.95rem;background:#fff;color:inherit}' +
    '.hilo-form button{justify-self:start;padding:8px 16px;border:0;border-radius:999px;background:#1a1814;color:#fff;font:inherit;font-size:.9rem;cursor:pointer}' +
    '.hilo-form button[disabled]{opacity:.5}' +
    '.hilo-wa{display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:7px 14px;border:1px solid rgba(122,117,111,.55);border-radius:999px;background:#fff;color:inherit;font:inherit;font-size:.85rem;cursor:pointer}' +
    '.hilo-wa:hover{border-color:#25a244}.hilo-wa[disabled]{opacity:.5}' +
    '.hilo-nota{font-size:.78rem;opacity:.6;margin:2px 0 0}' +
    '.foto.hilo-resaltada{outline:3px solid #e8347a;outline-offset:3px}';
  document.head.appendChild(css);

  function html(f) {
    if (!f || !f.comentario) return '';
    var msgs = (f.hilo || []).map(function (m) {
      return '<div class="hilo-msg ' + (m.de === 'otto' ? 'otto' : 'persona') + '"><small>' + (m.de === 'otto' ? 'Otto' : 'Tú') + ' · ' + fecha(m.en) + '</small>' + esc(m.texto) + '</div>';
    }).join('');
    return '<div class="hilo" data-hilo="' + esc(f.id) + '">' + msgs +
      '<div class="hilo-form"><textarea maxlength="1500" placeholder="' + ((f.hilo || []).length ? 'Escribe tu respuesta…' : 'Responde a Otto o pregúntale lo que quieras…') + '" data-hilo-texto="' + esc(f.id) + '"></textarea>' +
      '<button type="button" data-hilo-enviar="' + esc(f.id) + '">Enviar</button>' +
      '<p class="hilo-nota">Esta conversación solo la ves tú y la veo yo. Te aviso por email cuando te conteste.</p></div></div>';
  }

  // Botón "Compartir en WhatsApp": la persona decide si su foto (y mi comentario) llega a la comunidad
  var fotos = {};
  function wa(f) {
    if (!f || !f.grande) return '';
    fotos[f.id] = f;
    return '<button type="button" class="hilo-wa" data-wa="' + esc(f.id) + '">💬 Compartir en la comunidad de WhatsApp</button>';
  }
  function textoWA(f) {
    var base = 'mirardespacio.es';
    if (f.comentario) return '📷 Mi foto en Mirar Despacio' + (f.donde ? ' · ' + f.donde : '') + '\n\nOtto dice: ' + f.comentario + '\n\n' + base;
    return '📷 Mi foto en Mirar Despacio' + (f.donde ? ' · ' + f.donde : '') + '\n\n' + base;
  }
  function compartirWA(t) {
    var f = fotos[t.dataset.wa]; if (!f) return;
    var txt = textoWA(f), etq = t.textContent;
    var abrir = function () {
      var u = 'https://wa.me/?text=' + encodeURIComponent(txt + '\n' + f.grande);
      if (!window.open(u, '_blank')) location.href = u;
    };
    t.disabled = true; t.textContent = 'Preparando…';
    fetch(f.grande).then(function (r) { return r.blob(); }).then(function (b) {
      var file = new File([b], 'mirar-despacio.jpg', { type: b.type || 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], text: txt }).catch(function (e) { if (!e || e.name !== 'AbortError') abrir(); });
      }
      abrir();
    }).catch(abrir).then(function () { t.disabled = false; t.textContent = etq; });
  }

  function alPulsar(t, envia) {
    if (t && t.dataset && t.dataset.wa) { compartirWA(t); return true; }
    if (!t || !t.dataset || !t.dataset.hiloEnviar) return false;
    var id = t.dataset.hiloEnviar;
    var ta = document.querySelector('textarea[data-hilo-texto="' + id + '"]');
    var texto = ta ? ta.value.trim() : '';
    if (!texto) { if (ta) ta.focus(); return true; }
    t.disabled = true; t.textContent = 'Enviando…';
    envia(id, texto).catch(function () {
      t.disabled = false; t.textContent = 'Enviar'; alert('No se ha podido enviar. Prueba otra vez.');
    });
    return true;
  }

  function irA() {
    var m = /^#foto-(.+)$/.exec(location.hash || '');
    if (!m) return;
    var h = document.querySelector('[data-hilo="' + m[1].replace(/"/g, '') + '"]');
    var art = h && h.closest('.foto');
    if (!art) return;
    art.classList.add('hilo-resaltada');
    art.scrollIntoView({ behavior: 'smooth', block: 'center' });
    var ta = h.querySelector('textarea');
    if (ta) { try { ta.focus({ preventScroll: true }); } catch (e) {} }
    location.hash = '';
  }

  window.MDHilo = { html: html, wa: wa, alPulsar: alPulsar, irA: irA };
})();
