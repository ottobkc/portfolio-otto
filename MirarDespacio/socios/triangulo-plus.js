// Practica con el triángulo · lo que solo ven los miembros de Mirar Despacio+
// (está en /socios/, que Netlify solo sirve a cuentas con rol member o admin).
// Tres retos más con sus escenas y el ranking del reto del día entre miembros.
// Se carga ANTES de triangulo.js, que lee window.TRIANGULO_PLUS.
(function () {
  const W = 720, H = 450;
  function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  const glow = (x, cx, cy, r, c0, c1) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, c0); g.addColorStop(1, c1); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); };

  /* ---------- Reto 4 · Concierto en sala ---------- */
  function bgConcierto(c) {
    const x = c.getContext('2d'), r = rng(404);
    let g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b0a12'); g.addColorStop(1, '#1a1220'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    // estructura de focos
    x.fillStyle = '#26232c'; x.fillRect(60, 40, 600, 10);
    const focos = [[130, '#ff3d7f'], [250, '#5ab4ff'], [360, '#ffd36b'], [470, '#5ab4ff'], [590, '#ff3d7f']];
    focos.forEach(([fx, col], i) => {
      x.save(); x.globalAlpha = .22; x.fillStyle = col; x.beginPath(); x.moveTo(fx - 6, 50); x.lineTo(fx + (i - 2) * 50 - 90, 340); x.lineTo(fx + (i - 2) * 50 + 90, 340); x.closePath(); x.fill(); x.restore();
      glow(x, fx, 52, 22, '#ffffff', 'rgba(255,255,255,0)'); glow(x, fx, 52, 40, col, 'rgba(0,0,0,0)');
    });
    // amplis y batería al fondo
    x.fillStyle = '#16141a'; x.fillRect(90, 250, 90, 90); x.fillRect(540, 250, 90, 90);
    x.strokeStyle = '#3a3640'; x.lineWidth = 3; for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(135, 295, 8 + i * 6, 0, 7); x.stroke(); }
    x.fillStyle = '#2c2833'; x.beginPath(); x.ellipse(600, 300, 30, 30, 0, 0, 7); x.fill();
    // escenario
    g = x.createLinearGradient(0, 335, 0, 360); g.addColorStop(0, '#3a2e3a'); g.addColorStop(1, '#120f16'); x.fillStyle = g; x.fillRect(0, 335, W, 25);
    // pequeñas luces de la sala
    for (let i = 0; i < 18; i++) glow(x, r() * W, 70 + r() * 150, 6 + r() * 6, ['#ffcf7a', '#ff6fa5', '#86c8ff'][(r() * 3) | 0], 'rgba(0,0,0,0)');
    // público en primer término (siluetas)
    x.fillStyle = '#050407';
    for (let i = 0; i < 11; i++) { const hx = 20 + i * 68 + r() * 20, hy = 395 + r() * 20; x.beginPath(); x.arc(hx, hy, 24, 0, 7); x.fill(); x.fillRect(hx - 40, hy + 15, 80, 60); }
    x.beginPath(); x.moveTo(470, 420); x.lineTo(500, 330); x.lineTo(516, 334); x.lineTo(500, 420); x.fill(); // un brazo levantado
  }
  function subjGuitarrista(c) {
    const x = c.getContext('2d'), cx = 360, fy = 340;
    glow(x, cx, fy - 120, 150, 'rgba(255,214,140,.28)', 'rgba(255,214,140,0)');
    x.strokeStyle = '#1b1720'; x.lineCap = 'round'; x.lineWidth = 14;
    x.beginPath(); x.moveTo(cx - 8, fy - 95); x.lineTo(cx - 32, fy); x.moveTo(cx + 8, fy - 95); x.lineTo(cx + 26, fy); x.stroke();
    let g = x.createLinearGradient(cx - 40, 0, cx + 40, 0); g.addColorStop(0, '#e9e1d4'); g.addColorStop(1, '#8f8578'); x.fillStyle = g;
    x.beginPath(); x.moveTo(cx - 34, fy - 205); x.lineTo(cx + 34, fy - 205); x.lineTo(cx + 40, fy - 92); x.lineTo(cx - 40, fy - 92); x.closePath(); x.fill();
    x.fillStyle = '#d6a483'; x.beginPath(); x.arc(cx, fy - 232, 23, 0, 7); x.fill();
    x.fillStyle = '#241812'; x.beginPath(); x.ellipse(cx, fy - 248, 28, 18, 0, Math.PI, 0); x.fill(); x.fillRect(cx - 28, fy - 248, 10, 34); x.fillRect(cx + 18, fy - 248, 10, 34);
    // guitarra
    x.fillStyle = '#b4381f'; x.beginPath(); x.ellipse(cx - 10, fy - 120, 38, 30, -.5, 0, 7); x.fill(); x.beginPath(); x.ellipse(cx + 14, fy - 140, 26, 22, -.5, 0, 7); x.fill();
    x.fillStyle = '#1b1310'; x.beginPath(); x.arc(cx, fy - 128, 9, 0, 7); x.fill();
    x.strokeStyle = '#4a3020'; x.lineWidth = 9; x.beginPath(); x.moveTo(cx + 20, fy - 150); x.lineTo(cx + 120, fy - 220); x.stroke();
    x.strokeStyle = '#d6a483'; x.lineWidth = 10; x.beginPath(); x.moveTo(cx - 30, fy - 190); x.lineTo(cx - 20, fy - 130); x.moveTo(cx + 30, fy - 190); x.lineTo(cx + 95, fy - 205); x.stroke();
  }

  /* ---------- Reto 5 · Larga exposición en el Puente de Segovia ---------- */
  function bgPuente(c) {
    const x = c.getContext('2d'), r = rng(505);
    let g = x.createLinearGradient(0, 0, 0, 260); g.addColorStop(0, '#060a1c'); g.addColorStop(1, '#253159'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(255,255,255,' + (.2 + r() * .5) + ')'; x.fillRect(r() * W, r() * 120, 1.5, 1.5); }
    // silueta de la ciudad con una cúpula al fondo
    x.fillStyle = '#121626';
    let bx = 0; while (bx < W) { const bw = 40 + r() * 60, bh = 40 + r() * 70; x.fillRect(bx, 215 - bh, bw, bh + 10); bx += bw; }
    x.beginPath(); x.ellipse(500, 120, 34, 30, 0, Math.PI, 0); x.fill(); x.fillRect(466, 120, 68, 100); x.fillRect(496, 70, 8, 22);
    for (let i = 0; i < 60; i++) { if (r() < .6) { x.fillStyle = r() < .5 ? '#ffd27a' : '#f2a74e'; x.fillRect(r() * W, 150 + r() * 60, 3, 4); } }
    // río con reflejos
    g = x.createLinearGradient(0, 300, 0, H); g.addColorStop(0, '#141b33'); g.addColorStop(1, '#070a14'); x.fillStyle = g; x.fillRect(0, 300, W, 150);
    for (let i = 0; i < 7; i++) for (let k = 0; k < 9; k++) { x.globalAlpha = .12 + r() * .25; x.fillStyle = '#ffcc77'; x.fillRect(60 + i * 100 - 8 + r() * 10, 322 + k * 13, 6 + r() * 12, 3); } x.globalAlpha = 1;
    // puente de piedra con sus arcos
    x.fillStyle = '#6b5f52'; x.fillRect(0, 218, W, 36);
    x.fillStyle = '#5a4f44'; x.fillRect(0, 254, W, 62);
    x.fillStyle = '#141b33'; for (let i = 0; i < 9; i++) { const ax = 40 + i * 80; x.beginPath(); x.moveTo(ax - 30, 316); x.lineTo(ax - 30, 286); x.arc(ax, 286, 30, Math.PI, 0); x.lineTo(ax + 30, 316); x.closePath(); x.fill(); }
    x.fillStyle = '#7a6d5f'; x.fillRect(0, 210, W, 10);
    // farolas sobre el puente
    for (let i = 0; i < 7; i++) { const lx = 60 + i * 100; x.fillStyle = '#2a2622'; x.fillRect(lx - 1.5, 178, 3, 34); glow(x, lx, 176, 18, '#fff1c9', 'rgba(255,210,140,0)'); }
  }
  function subjCoches(c) {
    // Solo las luces de los coches: con exposición larga se convierten en estelas
    const x = c.getContext('2d'), r = rng(515);
    for (let i = 0; i < 9; i++) { const lx = 30 + i * 78 + r() * 20; glow(x, lx, 203, 7, '#ffffff', 'rgba(255,250,230,0)'); glow(x, lx + 14, 203, 7, '#fff6dc', 'rgba(255,250,230,0)'); }
    for (let i = 0; i < 8; i++) { const lx = 60 + i * 84 + r() * 20; glow(x, lx, 213, 6, '#ff4a36', 'rgba(255,40,30,0)'); glow(x, lx + 12, 213, 6, '#ff4a36', 'rgba(255,40,30,0)'); }
  }

  /* ---------- Reto 6 · Teatro sin flash ---------- */
  function bgTeatro(c) {
    const x = c.getContext('2d');
    let g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0d0907'); g.addColorStop(1, '#1d130d'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    // telón de fondo pintado
    g = x.createLinearGradient(0, 60, 0, 330); g.addColorStop(0, '#2b3a4a'); g.addColorStop(1, '#18222c'); x.fillStyle = g; x.fillRect(110, 60, 500, 270);
    x.fillStyle = 'rgba(220,200,160,.12)'; x.beginPath(); x.arc(470, 140, 46, 0, 7); x.fill();
    // cortinas rojas
    const cortina = (x0, dir) => { for (let i = 0; i < 6; i++) { const cx0 = x0 + dir * i * 18; const gg = x.createLinearGradient(cx0, 0, cx0 + 18, 0); gg.addColorStop(0, '#5e0d12'); gg.addColorStop(.5, '#a3202a'); gg.addColorStop(1, '#4a0a0f'); x.fillStyle = gg; x.fillRect(Math.min(cx0, cx0 + dir * 18), 0, 18, 360); } };
    cortina(0, 1); cortina(702, -1);
    x.fillStyle = '#7d1219'; x.fillRect(0, 0, W, 48); x.fillStyle = '#c9a24a'; x.fillRect(0, 46, W, 4);
    // suelo del escenario
    g = x.createLinearGradient(0, 330, 0, H); g.addColorStop(0, '#5a3a22'); g.addColorStop(1, '#22160d'); x.fillStyle = g; x.fillRect(0, 330, W, 120);
    x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 1; for (let i = 0; i < 14; i++) { x.beginPath(); x.moveTo(i * 60, 330); x.lineTo(i * 80 - 160, H); x.stroke(); }
    // círculo del cañón de seguimiento
    x.fillStyle = 'rgba(255,236,190,.22)'; x.beginPath(); x.ellipse(400, 380, 120, 26, 0, 0, 7); x.fill();
    // una silla de atrezo
    x.fillStyle = '#2a1b12'; x.fillRect(200, 280, 50, 8); x.fillRect(202, 288, 6, 50); x.fillRect(242, 288, 6, 50); x.fillRect(242, 230, 6, 54);
  }
  function subjActriz(c) {
    const x = c.getContext('2d'), cx = 400, fy = 382;
    glow(x, cx, fy - 140, 170, 'rgba(255,236,190,.30)', 'rgba(255,236,190,0)');
    let g = x.createLinearGradient(cx - 60, 0, cx + 60, 0); g.addColorStop(0, '#f2e6c9'); g.addColorStop(1, '#a8916b'); x.fillStyle = g;
    x.beginPath(); x.moveTo(cx - 22, fy - 210); x.lineTo(cx + 22, fy - 210); x.lineTo(cx + 70, fy); x.lineTo(cx - 70, fy); x.closePath(); x.fill();
    x.fillStyle = '#e2b796'; x.beginPath(); x.arc(cx, fy - 236, 20, 0, 7); x.fill();
    x.fillStyle = '#3b2216'; x.beginPath(); x.arc(cx + 2, fy - 246, 20, Math.PI * .9, Math.PI * 2.1); x.fill(); x.beginPath(); x.arc(cx + 18, fy - 232, 9, 0, 7); x.fill();
    x.strokeStyle = '#e2b796'; x.lineCap = 'round'; x.lineWidth = 8;
    x.beginPath(); x.moveTo(cx - 18, fy - 200); x.lineTo(cx - 70, fy - 270); x.moveTo(cx + 18, fy - 200); x.lineTo(cx + 46, fy - 140); x.stroke();
  }

  const scenes = {
    l4: { draw: [bgConcierto, subjGuitarrista], subj: 'El guitarrista', af: [.5, .3], kref: [85, 12],
      dofLow: 'El fondo del escenario compite con el músico. Abre el diafragma para que los focos se conviertan en bolas de luz.',
      dofHigh: 'El escenario se ha deshecho del todo. Cierra un paso para que se intuya la banda.' },
    l5: { draw: [bgPuente, subjCoches], subj: 'Los coches', af: [.5, .55], kref: [24, 6],
      dofLow: 'El puente pierde nitidez. Cierra el diafragma: en paisaje nocturno quieres todo definido.',
      dofHigh: 'El puente pierde nitidez. Cierra el diafragma: en paisaje nocturno quieres todo definido.' },
    l6: { draw: [bgTeatro, subjActriz], subj: 'La actriz', af: [.56, .33], kref: [135, 12],
      dofLow: 'El decorado distrae. Abre el diafragma para que la actriz se despegue del fondo.',
      dofHigh: 'El decorado se ha deshecho. Cierra un poco para que se lea la escena.' },
  };

  const levels = [
    { plus: true, scene: 'l4', kick: 'Reto 4 · MD+ · Concierto', title: 'Concierto en sala',
      text: 'Sala pequeña de Malasaña, sin flash. El guitarrista se mueve con la música bajo un foco cálido y detrás hay luces de colores que quieres convertir en manchas.',
      goals: ['85 mm a pulso', 'Sujeto en movimiento', 'Focos en bokeh'],
      ev: 4, focal: 85, speed: 140, lim: 4, isoTol: 6400, dofMin: 4, dofMax: 99, apMin: 0, isoMax: 7,
      note: 'En conciertos se dispara casi siempre a plena apertura. Asegura la velocidad para el gesto y deja que el ISO cargue con el resto.', start: [3, 4, 1] },
    { plus: true, scene: 'l5', kick: 'Reto 5 · MD+ · Larga exposición', title: 'Puente de Segovia de noche',
      text: 'Noche cerrada sobre el Manzanares, con la cámara en trípode. Quieres que los faros de los coches que cruzan el puente dibujen estelas y que todo lo demás salga limpio y nítido.',
      goals: ['24 mm en trípode', 'Estelas de luz', 'Sin ruido'], rule: 'Con trípode: la velocidad llega hasta 30 s',
      ev: 3, focal: 24, speed: 70, tripod: true, wantBlur: 300, lim: 4, isoTol: 400, dofMin: 0, dofMax: 2.5, apMin: 0, isoMax: 7, shMax: 17,
      note: 'Con trípode el orden cambia: ISO al mínimo, cierra el diafragma para la nitidez y deja que la velocidad se alargue lo que haga falta.', start: [6, 3, 2] },
    { plus: true, scene: 'l6', kick: 'Reto 6 · MD+ · Teatro', title: 'Teatro sin flash',
      text: 'Ensayo general en un teatro de Lavapiés, desde el patio de butacas. La actriz levanta el brazo en pleno monólogo, bajo el cañón de seguimiento. No puedes usar flash.',
      goals: ['135 mm a pulso', 'Gesto en movimiento', 'Separarla del decorado'], rule: 'Tu tele más luminoso es f/2.8',
      ev: 5, focal: 135, speed: 160, lim: 4, isoTol: 3200, dofMin: 3, dofMax: 99, apMin: 2, isoMax: 7,
      note: 'En teatro el tele obliga a velocidades altas y el diafragma no da más de sí: el ISO es la rueda que paga.', start: [4, 4, 1] },
  ];

  /* ---------- sesión y ranking del reto del día ---------- */
  const token = async () => {
    try { const u = window.netlifyIdentity && netlifyIdentity.currentUser(); return u ? await u.jwt() : null; } catch (e) { return null; }
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  async function llamar(cuerpo) {
    const t = await token();
    if (!t) throw new Error('sin-sesion');
    const r = await fetch('/api/f/triangulo', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(cuerpo) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'error');
    return j;
  }
  function pintar(j) {
    const caja = document.getElementById('ranking-dia');
    if (!caja) return;
    caja.hidden = false;
    const filas = (j.top || []).map((f, i) => `<li${f.yo ? ' class="yo"' : ''}><span class="pos">${i + 1}</span><span class="nom">${esc(f.nombre)}</span><span class="pts">${f.puntos}</span></li>`).join('');
    caja.innerHTML = `<h3>Ranking de miembros · hoy</h3>${filas ? `<ol>${filas}</ol>` : '<p>Aún no ha disparado nadie. ¡Estrénalo!</p>'}` +
      (j.puesto ? `<p class="mio">Vas <b>${j.puesto}º</b> de ${j.total}.${j.repetido ? ' Solo cuenta tu primer disparo del día.' : ''}</p>` : '') +
      `<p class="nota">Cuenta el primer disparo de cada miembro. Mañana, reto nuevo.</p>`;
  }
  async function verRanking() { try { pintar(await llamar({ accion: 'ranking' })); } catch (e) { console.warn('ranking', e.message); } }
  async function disparoDelDia(ajustes, dia) {
    try { pintar(await llamar({ accion: 'dia', ajustes, dia })); }
    catch (e) { const caja = document.getElementById('ranking-dia'); if (caja) { caja.hidden = false; caja.innerHTML = '<p>No se ha podido guardar tu disparo en el ranking. Vuelve a cargar la página y prueba otra vez.</p>'; } }
  }

  window.TRIANGULO_PLUS = { levels, scenes, token, disparoDelDia, verRanking, empezarEn: 3 };
})();
