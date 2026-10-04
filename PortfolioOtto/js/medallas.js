// Medallas de Mirar Despacio+: se ganan por constancia (retos hechos y retos seguidos), nunca por notas.
//   MDMedallas.junto(retos, racha)     -> medallas pequeñas para poner junto al nombre (la mejor de cada tipo)
//   MDMedallas.panel(retos, racha)     -> todas las medallas, ganadas y por ganar, para la página del reto
(function () {
  var LISTA = [
    { id: 'r1', tipo: 'retos', n: 1, nombre: 'Primera mirada', desc: 'Tu primer reto' },
    { id: 'r3', tipo: 'retos', n: 3, nombre: 'Tres meses', desc: '3 retos hechos' },
    { id: 'r6', tipo: 'retos', n: 6, nombre: 'Medio año', desc: '6 retos hechos' },
    { id: 'r12', tipo: 'retos', n: 12, nombre: 'Un año despacio', desc: '12 retos hechos' },
    { id: 's3', tipo: 'racha', n: 3, nombre: 'Sin fallar', desc: '3 retos seguidos' },
    { id: 's6', tipo: 'racha', n: 6, nombre: 'Constancia', desc: '6 retos seguidos' }
  ];
  // Colores de cada medalla: [claro, oscuro, cinta]
  var COLOR = {
    r1: ['#f1c9a0', '#c98a4b', '#e8821a'],
    r3: ['#f6b15e', '#e8821a', '#e8821a'],
    r6: ['#f39a5a', '#e8347a', '#e8347a'],
    r12: ['#e8347a', '#7a1f4a', '#1a1814'],
    s3: ['#4a453c', '#1a1814', '#e8821a'],
    s6: ['#4a453c', '#1a1814', '#e8347a']
  };
  var n = 0;

  function svg(m, tam, apagada) {
    var id = 'mdm' + (++n), c = COLOR[m.id];
    var gris = apagada ? ' filter="url(#' + id + 'g)"' : '';
    var centro = m.tipo === 'racha'
      // llama + número
      ? '<path d="M20 22c3 3 5 5.5 5 8.6 0 3.2-2.3 5.4-5 5.4s-5-2.2-5-5.4c0-1.8.9-3.2 2-4.2 0 1.5.6 2.6 1.6 3 .2-2.7.9-5 1.4-7.4z" fill="#e8821a"/>' +
        '<text x="20" y="45" text-anchor="middle" font-family="Georgia,serif" font-size="7.5" fill="#f5f3ef">' + m.n + '×</text>'
      : '<text x="20" y="' + (m.n >= 10 ? 37.5 : 38.5) + '" text-anchor="middle" font-family="Georgia,serif" font-size="' + (m.n >= 10 ? 13 : 15) + '" fill="#fff" font-weight="bold">' + m.n + '</text>' +
        (m.id === 'r12' ? '<path d="M20 20.5l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z" fill="#f6c76a"/>' : '');
    return '<svg class="md-medalla" width="' + Math.round(tam * 40 / 52) + '" height="' + tam + '" viewBox="0 0 40 52" role="img" aria-label="' + m.nombre + '"' + gris + '>' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c[0] + '"/><stop offset="1" stop-color="' + c[1] + '"/></linearGradient>' +
      (apagada ? '<filter id="' + id + 'g"><feColorMatrix type="saturate" values="0"/></filter>' : '') + '</defs>' +
      '<path d="M11 0h8l4 14h-8z" fill="' + c[2] + '"/><path d="M29 0h-8l-4 14h8z" fill="' + c[2] + '" opacity=".8"/>' +
      '<circle cx="20" cy="33" r="17" fill="url(#' + id + ')"/>' +
      '<circle cx="20" cy="33" r="13.5" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/>' + centro + '</svg>';
  }

  function ganadas(retos, racha) {
    return LISTA.filter(function (m) { return m.tipo === 'retos' ? (retos || 0) >= m.n : (racha || 0) >= m.n; });
  }

  // La mejor medalla de cada tipo, pequeñas, para ir junto al nombre
  function junto(retos, racha, tam) {
    var g = ganadas(retos, racha);
    var mejor = ['retos', 'racha'].map(function (t) { return g.filter(function (m) { return m.tipo === t; }).pop(); }).filter(Boolean);
    if (!mejor.length) return '';
    return '<span class="md-medallas" title="' + mejor.map(function (m) { return m.nombre + ' (' + m.desc + ')'; }).join(' · ') + '">' +
      mejor.map(function (m) { return svg(m, tam || 20); }).join('') + '</span>';
  }

  function panel(retos, racha) {
    return '<div class="md-panel-medallas">' + LISTA.map(function (m) {
      var ok = m.tipo === 'retos' ? (retos || 0) >= m.n : (racha || 0) >= m.n;
      var falta = m.n - (m.tipo === 'retos' ? (retos || 0) : (racha || 0));
      return '<div class="md-med' + (ok ? ' si' : '') + '">' + svg(m, 58, !ok) + '<b>' + m.nombre + '</b><small>' +
        (ok ? m.desc : (falta === 1 ? 'Te falta 1' : 'Te faltan ' + falta)) + '</small></div>';
    }).join('') + '</div>';
  }

  var css = '.md-medallas{display:inline-flex;gap:2px;vertical-align:-4px;margin-left:6px}.md-medalla{display:inline-block;flex:none}' +
    '.md-panel-medallas{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:14px}' +
    '.md-med{text-align:center;padding:14px 8px;border:1px solid #d8d4ce;background:#f5f3ef}.md-med b{display:block;font-family:Georgia,serif;font-weight:400;margin-top:8px;font-size:1rem;color:#7a756f}' +
    '.md-med small{color:#7a756f;font-size:.8rem}.md-med:not(.si) svg{opacity:.35}.md-med.si{background:#fff;border-color:transparent;box-shadow:0 2px 10px rgba(26,24,20,.08)}.md-med.si b{color:#1a1814}';
  if (!document.getElementById('md-medallas-css')) {
    var st = document.createElement('style'); st.id = 'md-medallas-css'; st.textContent = css; document.head.appendChild(st);
  }

  window.MDMedallas = { lista: LISTA, svg: svg, ganadas: ganadas, junto: junto, panel: panel };
})();
