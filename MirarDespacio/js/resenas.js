// Opiniones de Google en la web (las trae la función «resenas» de ottokols.es, una vez al día).
// Uso: <section data-resenas-seccion hidden> … <div data-resenas="md"></div> … </section>
// La sección está oculta y solo se enseña a partir de MINIMO opiniones en Google (con menos, resta más que suma).
(function () {
  var MINIMO = 3;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var estrellas = function (n) { var r = Math.round(n); return '<span class="rs-est" aria-label="' + n + ' de 5">' + '★★★★★'.slice(0, r) + '<i>' + '★★★★★'.slice(r) + '</i></span>'; };
  var nota = function (n) { return n.toFixed(1).replace('.', ','); };
  var CSS = '.rs-cab{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px;margin:0 0 20px}' +
    '.rs-cab b{font-family:var(--f-titulo,Georgia,serif);font-weight:400;font-size:2.2rem;line-height:1}' +
    '.rs-est{color:#e8821a;letter-spacing:2px}.rs-est i{font-style:normal;color:var(--linea,#d8d2c6)}' +
    '.rs-lista{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}' +
    '.rs-op{background:#fff;border-radius:10px;padding:18px;box-shadow:0 1px 6px rgba(26,24,20,.06);display:flex;flex-direction:column;gap:10px}' +
    '.rs-op p{margin:0;font-size:.95rem;line-height:1.55}.rs-op p.corto{display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden}' +
    '.rs-op button{align-self:flex-start;background:none;border:0;padding:0;font:inherit;font-size:.85rem;text-decoration:underline;cursor:pointer;color:inherit}' +
    '.rs-autor{font-size:.85rem;color:var(--gris,#6b655a);margin-top:auto}.rs-autor a{color:inherit}' +
    '.rs-pie{margin-top:16px;font-size:.85rem;color:var(--gris,#6b655a)}.rs-pie a{color:inherit}';

  function pintar(el, d) {
    if (!document.getElementById('rs-css')) { var s = document.createElement('style'); s.id = 'rs-css'; s.textContent = CSS; document.head.appendChild(s); }
    el.innerHTML = '<div class="rs-cab"><b>' + nota(d.nota) + '</b>' + estrellas(d.nota) +
      '<span>' + d.total + (d.total === 1 ? ' opinión' : ' opiniones') + ' en Google</span></div>' +
      '<div class="rs-lista">' + (d.resenas || []).map(function (r) {
        return '<article class="rs-op">' + estrellas(r.nota) + '<p class="corto">' + esc(r.texto).replace(/\n+/g, '<br>') + '</p>' +
          '<button type="button" hidden>Leer entera</button>' +
          '<span class="rs-autor">' + (r.autorUrl ? '<a href="' + esc(r.autorUrl) + '" target="_blank" rel="noopener nofollow">' + esc(r.autor) + '</a>' : esc(r.autor)) + ' · en Google</span></article>';
      }).join('') + '</div>' +
      '<p class="rs-pie">Opiniones de Google, tal cual. ' + (d.url ? '<a href="' + esc(d.url) + '" target="_blank" rel="noopener">Ver todas o dejar la tuya en Google →</a>' : '') + '</p>';
    // «Leer entera» solo en las que se cortan
    el.querySelectorAll('.rs-op').forEach(function (op) {
      var p = op.querySelector('p'), b = op.querySelector('button');
      if (p.scrollHeight > p.clientHeight + 4) { b.hidden = false; b.onclick = function () { p.classList.remove('corto'); b.hidden = true; }; }
    });
  }

  document.querySelectorAll('[data-resenas]').forEach(function (el) {
    fetch('/api/f/resenas?ficha=' + encodeURIComponent(el.dataset.resenas || 'md')).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || d.sinDatos || !(d.total >= MINIMO) || !(d.resenas || []).length) return;
      var sec = el.closest('[data-resenas-seccion]');
      if (sec) sec.hidden = false; // antes de pintar, para poder medir qué textos se cortan
      pintar(el, d);
    }).catch(function () {});
  });
})();
