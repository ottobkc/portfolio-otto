/* Mirar Despacio · El juego del fotógrafo
 * Un fotógrafo camina por la calle y le vienen cosas. Hay que hacerles la foto
 * (espacio, clic o tocar la pantalla) cuando están dentro del visor; si llegan
 * hasta él sin foto, le golpean. 3 vidas. Cada 15 s se sube de nivel y, mientras
 * no te golpeen, todo va un poco más rápido. */
(function () {
  var canvas = document.getElementById('juego');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var C = { crema: '#f5f3ef', papel: '#ebe7df', tinta: '#1a1814', suave: '#4a453c', gris: '#9a9387', linea: '#d8d2c6', naranja: '#e8821a', rosa: '#e8347a' };
  var W = 0, H = 0, SUELO = 0, dpr = 1;

  function medir() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = Math.round(Math.max(220, Math.min(320, W * 0.42)));
    canvas.style.height = H + 'px';
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    SUELO = H - 38;
  }
  medir();
  window.addEventListener('resize', medir);

  // ---------- Sonido (muy discreto) ----------
  var audio = null;
  function clic(frec, dur, vol) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      var o = audio.createOscillator(), g = audio.createGain();
      o.type = 'square'; o.frequency.value = frec;
      g.gain.setValueAtTime(vol || 0.05, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + (dur || 0.06));
      o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime + (dur || 0.06));
    } catch (e) {}
  }

  // ---------- Lo que pasa por la calle ----------
  var TIPOS = {
    paloma:   { uno: 'paloma', nombre: 'palomas', pts: 10, w: 26, h: 18, alto: [40, 90], vel: 1.15 },
    perro:    { uno: 'perro', nombre: 'perros', pts: 10, w: 34, h: 24, alto: [0, 0], vel: 1.0 },
    bici:     { uno: 'bici', nombre: 'bicis', pts: 15, w: 46, h: 40, alto: [0, 0], vel: 1.45 },
    globo:    { uno: 'globo', nombre: 'globos', pts: 20, w: 22, h: 46, alto: [70, 120], vel: 0.8 },
    paraguas: { uno: 'paraguas', nombre: 'paraguas', pts: 15, w: 30, h: 54, alto: [0, 0], vel: 0.9 },
    gato:     { uno: 'gato', nombre: 'gatos', pts: 25, w: 24, h: 18, alto: [0, 0], vel: 1.6 },
  };
  var LISTA = Object.keys(TIPOS);

  var estado, record = 0;
  try { record = parseInt(localStorage.getItem('md-juego-record') || '0', 10) || 0; } catch (e) {}

  function nuevo() {
    estado = {
      fase: 'inicio', t: 0, puntos: 0, vidas: 3, nivel: 1, racha: 0, cosas: [], textos: [],
      proximo: 1.2, enfriar: 0, flash: 0, golpe: 0, temblor: 0, banner: 0, paso: 0, fondo: 0,
      fotos: {}, perfectas: 0,
    };
  }
  nuevo();

  // Velocidad: sube con el nivel y con el tiempo que llevas sin que te golpeen
  function velocidad() { return (190 + W * 0.06) * (1 + 0.09 * (estado.nivel - 1)) * (1 + Math.min(0.6, estado.racha * 0.012)); }
  function cadencia() { return Math.max(0.45, 1.7 - 0.12 * (estado.nivel - 1) - Math.min(0.5, estado.racha * 0.008)); }

  var FX = function () { return 62; };                      // posición del fotógrafo
  var VISOR = function () { return { x: 96, w: Math.max(120, Math.min(200, W * 0.28)) }; };

  function aparecer() {
    var disponibles = LISTA.slice(0, Math.min(LISTA.length, 2 + estado.nivel));
    var tipo = disponibles[Math.floor(Math.random() * disponibles.length)];
    var d = TIPOS[tipo];
    var alto = d.alto[0] + Math.random() * (d.alto[1] - d.alto[0]);
    estado.cosas.push({ tipo: tipo, x: W + 20, y: SUELO - d.h - alto, w: d.w, h: d.h, vel: d.vel * (0.9 + Math.random() * 0.25), fase: Math.random() * 6 });
  }

  // ---------- Disparo ----------
  function disparar() {
    if (estado.fase === 'inicio' || estado.fase === 'fin') {
      if (estado.fase === 'fin' && performance.now() - estado.finEn < 1200) return; // evita reiniciar sin querer
      if (!nombreValido()) { pedirNombre(); return; }
      empezar(); return;
    }
    if (estado.fase !== 'jugando' || estado.enfriar > 0) return;
    var v = VISOR();
    // Todo lo que esté (al menos en buena parte) dentro del visor sale en la foto
    var dentro = estado.cosas.filter(function (c) {
      var visible = Math.min(c.x + c.w, v.x + v.w) - Math.max(c.x, v.x);
      return visible >= c.w * 0.5;
    });
    estado.flash = 1;
    if (!dentro.length) { estado.enfriar = 0.5; clic(180, 0.08, 0.04); flotante('fuera de plano', v.x + v.w / 2, SUELO - 120, C.gris); return; }
    estado.enfriar = 0.28;
    var medio = v.x + v.w / 2, total = 0, algunaPerfecta = false;
    dentro.forEach(function (c) {
      var centro = c.x + c.w / 2;
      var perfecta = Math.abs(centro - medio) < v.w * 0.2;
      var pts = TIPOS[c.tipo].pts * estado.nivel * (perfecta ? 2 : 1);
      total += pts;
      estado.fotos[c.tipo] = (estado.fotos[c.tipo] || 0) + 1;
      if (perfecta) { estado.perfectas++; algunaPerfecta = true; }
      flotante((perfecta ? '¡Perfecta! ' : '') + '+' + pts, centro, c.y - 8, perfecta ? C.rosa : C.naranja);
      estado.cosas.splice(estado.cosas.indexOf(c), 1);
    });
    // Bonus por meter varias cosas en el mismo encuadre
    if (dentro.length > 1) {
      var bonus = (dentro.length === 2 ? 25 : 60) * estado.nivel;
      total += bonus;
      estado.composiciones = (estado.composiciones || 0) + 1;
      flotante((dentro.length === 2 ? '¡Bonus composición! +' : '¡Composición triple! +') + bonus, medio, SUELO - 140, C.rosa);
      clic(1800, 0.09, 0.05);
    }
    estado.puntos += total;
    clic(algunaPerfecta ? 1400 : 900, 0.05, 0.05);
  }

  function flotante(txt, x, y, color) { estado.textos.push({ txt: txt, x: x, y: y, vida: 1, color: color }); }

  function empezar() {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); // que el espacio dispare, no escriba
    nuevo();
    var c = document.getElementById('juegoCompartir'); if (c) c.hidden = true;
    estado.fase = 'jugando';
    estado.banner = 1.4;
    if (window.umami) window.umami.track('juego-empezar');
  }

  function terminar() {
    estado.fase = 'fin';
    estado.finEn = performance.now();
    if (estado.puntos > record) { record = estado.puntos; try { localStorage.setItem('md-juego-record', String(record)); } catch (e) {} }
    var resumen = document.getElementById('juegoResumen');
    if (resumen) {
      var partes = LISTA.filter(function (k) { return estado.fotos[k]; }).map(function (k) { return estado.fotos[k] + ' ' + (estado.fotos[k] === 1 ? TIPOS[k].uno : TIPOS[k].nombre); });
      resumen.textContent = partes.length ? 'Has fotografiado: ' + partes.join(', ') + (estado.perfectas ? ' (' + estado.perfectas + ' perfectas)' : '') + (estado.composiciones ? ' y ' + estado.composiciones + (estado.composiciones === 1 ? ' composición' : ' composiciones') + ' con varias cosas' : '') + '.' : 'Ni una foto. A veces hay que mirar más despacio.';
    }
    var comp = document.getElementById('juegoCompartir');
    if (comp && estado.puntos > 0) comp.hidden = false;
    if (window.umami) window.umami.track('juego-fin', { puntos: estado.puntos, nivel: estado.nivel });
  }

  // Compartir la puntuación (para retar a otros)
  var comp = document.getElementById('juegoCompartir');
  if (comp) comp.addEventListener('click', function () {
    var texto = 'He hecho ' + estado.puntos + ' puntos (nivel ' + estado.nivel + ') en el juego del fotógrafo de Mirar Despacio. ¿Me superas?';
    var url = 'https://mirardespacio.es/juego/';
    if (window.umami) window.umami.track('juego-compartir');
    if (navigator.share) { navigator.share({ title: 'El juego del fotógrafo', text: texto, url: url }).catch(function () {}); return; }
    try {
      navigator.clipboard.writeText(texto + ' ' + url).then(function () { comp.textContent = '¡Copiado! Pégalo donde quieras'; setTimeout(function () { comp.textContent = 'Retar a alguien'; }, 2500); });
    } catch (e) {}
  });

  // ---------- Bucle ----------
  var antes = performance.now();
  function bucle(ahora) {
    var dt = Math.min(0.05, (ahora - antes) / 1000);
    antes = ahora;
    if (estado.fase === 'jugando') actualizar(dt);
    else { estado.paso += dt * 2; estado.fondo += dt * 20; }
    dibujar();
    requestAnimationFrame(bucle);
  }

  function actualizar(dt) {
    var e = estado;
    e.t += dt; e.racha += dt;
    var nivel = 1 + Math.floor(e.t / 15);
    if (nivel > e.nivel) { e.nivel = nivel; e.banner = 1.4; clic(660, 0.12, 0.04); }
    var vel = velocidad();
    e.paso += dt * (6 + vel / 80);
    e.fondo += dt * vel * 0.25;
    e.enfriar = Math.max(0, e.enfriar - dt);
    e.flash = Math.max(0, e.flash - dt * 5);
    e.golpe = Math.max(0, e.golpe - dt);
    e.temblor = Math.max(0, e.temblor - dt * 3);
    e.banner = Math.max(0, e.banner - dt);
    e.proximo -= dt;
    if (e.proximo <= 0) { aparecer(); e.proximo = cadencia() * (0.7 + Math.random() * 0.6); }

    for (var i = e.cosas.length - 1; i >= 0; i--) {
      var c = e.cosas[i];
      c.x -= vel * c.vel * dt;
      c.fase += dt * 10;
      if (c.x <= FX() + 14) {
        e.cosas.splice(i, 1);
        if (e.golpe > 0) continue;              // invulnerable un momento tras un golpe
        e.vidas--; e.golpe = 1.2; e.temblor = 1; e.racha = 0;
        flotante('¡Pum!', FX() + 10, SUELO - 90, C.tinta);
        clic(90, 0.2, 0.08);
        if (e.vidas <= 0) { terminar(); return; }
      }
    }
    e.textos.forEach(function (t) { t.y -= dt * 40; t.vida -= dt * 1.2; });
    e.textos = e.textos.filter(function (t) { return t.vida > 0; });
  }

  // ---------- Dibujo ----------
  function dibujar() {
    var e = estado;
    ctx.save();
    if (e.temblor > 0) ctx.translate((Math.random() - 0.5) * 8 * e.temblor, (Math.random() - 0.5) * 6 * e.temblor);
    ctx.fillStyle = C.crema; ctx.fillRect(-10, -10, W + 20, H + 20);

    // Fondo: edificios que pasan despacio
    ctx.fillStyle = C.papel;
    var anchos = [70, 46, 90, 58, 76, 40, 64];
    var altos = [90, 130, 70, 150, 110, 80, 120];
    var total = anchos.reduce(function (a, b) { return a + b + 14; }, 0);
    var off = -(e.fondo % total);
    for (var vuelta = 0; off < W; vuelta++) {
      for (var i = 0; i < anchos.length && off < W; i++) {
        ctx.fillRect(off, SUELO - altos[i], anchos[i], altos[i]);
        ctx.fillStyle = C.crema;
        for (var vy = SUELO - altos[i] + 12; vy < SUELO - 20; vy += 22)
          for (var vx = off + 8; vx < off + anchos[i] - 12; vx += 16) ctx.fillRect(vx, vy, 7, 10);
        ctx.fillStyle = C.papel;
        off += anchos[i] + 14;
      }
    }

    // Suelo
    ctx.fillStyle = C.tinta; ctx.fillRect(0, SUELO, W, 2);
    ctx.fillStyle = C.linea;
    var guion = 34, d0 = -((e.fondo * 4) % guion);
    for (var gx = d0; gx < W; gx += guion) ctx.fillRect(gx, SUELO + 12, 14, 2);

    // Visor
    var v = VISOR();
    ctx.strokeStyle = e.enfriar > 0.3 ? C.gris : C.naranja;
    ctx.lineWidth = 2;
    var vy0 = 20, vh = SUELO - 24, l = 14;
    [[v.x, vy0, 1, 1], [v.x + v.w, vy0, -1, 1], [v.x, vy0 + vh, 1, -1], [v.x + v.w, vy0 + vh, -1, -1]].forEach(function (p) {
      ctx.beginPath(); ctx.moveTo(p[0], p[1] + l * p[3]); ctx.lineTo(p[0], p[1]); ctx.lineTo(p[0] + l * p[2], p[1]); ctx.stroke();
    });
    ctx.globalAlpha = 0.35; ctx.beginPath();
    ctx.moveTo(v.x + v.w / 2 - 6, vy0 + vh / 2); ctx.lineTo(v.x + v.w / 2 + 6, vy0 + vh / 2);
    ctx.moveTo(v.x + v.w / 2, vy0 + vh / 2 - 6); ctx.lineTo(v.x + v.w / 2, vy0 + vh / 2 + 6); ctx.stroke();
    ctx.globalAlpha = 1;

    // Cosas
    e.cosas.forEach(dibujarCosa);

    // Fotógrafo
    if (!(e.golpe > 0 && Math.floor(e.golpe * 10) % 2 === 0)) fotografo(FX(), SUELO, e.paso, e.enfriar > 0 && e.flash > 0.4);

    // Textos flotantes
    ctx.textAlign = 'center';
    e.textos.forEach(function (t) {
      ctx.globalAlpha = Math.max(0, t.vida);
      ctx.fillStyle = t.color; ctx.font = '600 15px Jost, system-ui, sans-serif';
      ctx.fillText(t.txt, t.x, t.y);
    });
    ctx.globalAlpha = 1;

    // Marcador
    ctx.textAlign = 'left'; ctx.fillStyle = C.tinta; ctx.font = '500 14px Jost, system-ui, sans-serif';
    ctx.fillText('Puntos ' + e.puntos, 14, 24);
    ctx.fillStyle = C.gris; ctx.fillText('Nivel ' + e.nivel + (record ? '   ·   Récord ' + record : ''), 14, 44);
    for (var k = 0; k < 3; k++) camarita(W - 26 - k * 30, 14, k < e.vidas);

    // Destello del disparo
    if (e.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (e.flash * 0.55) + ')'; ctx.fillRect(0, 0, W, H); }

    // Banner de nivel
    if (e.banner > 0 && e.fase === 'jugando') {
      ctx.globalAlpha = Math.min(1, e.banner * 1.5);
      ctx.textAlign = 'center'; ctx.font = 'italic 34px Georgia, serif';
      var gr = ctx.createLinearGradient(W / 2 - 80, 0, W / 2 + 80, 0);
      gr.addColorStop(0, C.naranja); gr.addColorStop(1, C.rosa);
      ctx.fillStyle = gr; ctx.fillText('Nivel ' + e.nivel, W / 2, H / 2 - 20);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    if (e.fase !== 'jugando') pantalla(e);
  }

  function pantalla(e) {
    ctx.fillStyle = 'rgba(245,243,239,.86)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.fillStyle = C.tinta;
    if (e.fase === 'inicio') {
      ctx.font = '400 ' + Math.min(34, W / 12) + 'px Georgia, serif';
      ctx.fillText('Mira, encuadra, dispara.', W / 2, H / 2 - 24);
      ctx.font = '400 15px Jost, system-ui, sans-serif'; ctx.fillStyle = C.suave;
      ctx.fillText('Haz la foto cuando algo entre en el visor naranja.', W / 2, H / 2 + 6);
      ctx.fillText('Si te llega sin foto, te golpea. Tienes 3 vidas.', W / 2, H / 2 + 28);
      ctx.fillStyle = C.rosa; ctx.font = '600 15px Jost, system-ui, sans-serif';
      ctx.fillText(nombreValido()
        ? ('ontouchstart' in window ? 'Toca' : 'Pulsa espacio o haz clic') + ' para empezar'
        : 'Escribe arriba tu nombre o tu @ para jugar', W / 2, H / 2 + 62);
    } else {
      ctx.font = 'italic ' + Math.min(36, W / 11) + 'px Georgia, serif';
      ctx.fillText(e.puntos + ' puntos', W / 2, H / 2 - 22);
      ctx.font = '400 15px Jost, system-ui, sans-serif'; ctx.fillStyle = C.suave;
      ctx.fillText('Nivel ' + e.nivel + (e.puntos >= record && e.puntos > 0 ? '  ·  ¡Nuevo récord!' : '  ·  Récord ' + record), W / 2, H / 2 + 8);
      ctx.fillStyle = C.rosa; ctx.font = '600 15px Jost, system-ui, sans-serif';
      ctx.fillText(performance.now() - e.finEn < 1200 ? '' : ('ontouchstart' in window ? 'Toca' : 'Pulsa espacio') + ' para volver a jugar', W / 2, H / 2 + 44);
    }
  }

  function camarita(x, y, llena) {
    ctx.fillStyle = llena ? C.tinta : C.linea;
    ctx.fillRect(x, y + 4, 22, 14); ctx.fillRect(x + 6, y, 9, 5);
    ctx.fillStyle = llena ? C.naranja : C.crema;
    ctx.beginPath(); ctx.arc(x + 11, y + 11, 4, 0, 7); ctx.fill();
  }

  function fotografo(x, suelo, paso, disparando) {
    var p = Math.sin(paso * 2.2);
    ctx.strokeStyle = C.tinta; ctx.fillStyle = C.tinta; ctx.lineWidth = 4; ctx.lineCap = 'round';
    // piernas
    ctx.beginPath(); ctx.moveTo(x, suelo - 30); ctx.lineTo(x - 8 * p, suelo - 2);
    ctx.moveTo(x, suelo - 30); ctx.lineTo(x + 8 * p, suelo - 2); ctx.stroke();
    // cuerpo
    ctx.beginPath(); ctx.moveTo(x, suelo - 30); ctx.lineTo(x + 2, suelo - 60); ctx.stroke();
    // cabeza y gorra
    ctx.beginPath(); ctx.arc(x + 3, suelo - 70, 8, 0, 7); ctx.fill();
    ctx.fillStyle = C.naranja; ctx.fillRect(x - 4, suelo - 80, 14, 4); ctx.fillRect(x + 6, suelo - 78, 8, 3);
    // brazos hacia la cámara
    ctx.strokeStyle = C.tinta; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(x + 2, suelo - 54); ctx.lineTo(x + 14, suelo - 62); ctx.stroke();
    // cámara
    ctx.fillStyle = C.tinta; ctx.fillRect(x + 12, suelo - 70, 16, 11);
    ctx.fillStyle = disparando ? '#fff' : C.rosa; ctx.beginPath(); ctx.arc(x + 25, suelo - 64.5, 3.2, 0, 7); ctx.fill();
    // correa
    ctx.strokeStyle = C.rosa; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 12, suelo - 68); ctx.lineTo(x + 1, suelo - 50); ctx.stroke();
  }

  function dibujarCosa(c) {
    var x = c.x, y = c.y, f = c.fase;
    ctx.lineCap = 'round';
    switch (c.tipo) {
      case 'paloma':
        ctx.fillStyle = C.gris; ctx.beginPath(); ctx.ellipse(x + 13, y + 11, 11, 7, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 3, y + 7, 5, 0, 7); ctx.fill();
        ctx.fillStyle = C.naranja; ctx.fillRect(x - 3, y + 6, 4, 2);
        ctx.fillStyle = C.suave; ctx.beginPath(); ctx.moveTo(x + 10, y + 9); ctx.lineTo(x + 20, y + 9 - 10 * Math.sin(f)); ctx.lineTo(x + 22, y + 10); ctx.fill();
        break;
      case 'perro':
        ctx.fillStyle = C.suave; ctx.fillRect(x + 6, y + 6, 24, 11);
        ctx.beginPath(); ctx.arc(x + 5, y + 6, 6, 0, 7); ctx.fill(); ctx.fillRect(x - 3, y + 6, 6, 4);
        ctx.strokeStyle = C.suave; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x + 9, y + 16); ctx.lineTo(x + 9 + 3 * Math.sin(f), y + 24);
        ctx.moveTo(x + 26, y + 16); ctx.lineTo(x + 26 - 3 * Math.sin(f), y + 24);
        ctx.moveTo(x + 30, y + 8); ctx.lineTo(x + 36, y + 2 + 2 * Math.sin(f)); ctx.stroke();
        break;
      case 'bici':
        ctx.strokeStyle = C.tinta; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(x + 8, y + 32, 8, 0, 7); ctx.arc(x + 38, y + 32, 8, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 8, y + 32); ctx.lineTo(x + 20, y + 20); ctx.lineTo(x + 34, y + 20); ctx.lineTo(x + 38, y + 32);
        ctx.moveTo(x + 20, y + 20); ctx.lineTo(x + 24, y + 32); ctx.stroke();
        ctx.strokeStyle = C.rosa; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(x + 24, y + 18); ctx.lineTo(x + 20, y + 4); ctx.lineTo(x + 12, y + 14); ctx.stroke();
        ctx.fillStyle = C.tinta; ctx.beginPath(); ctx.arc(x + 20, y, 5, 0, 7); ctx.fill();
        break;
      case 'globo':
        ctx.fillStyle = C.rosa; ctx.beginPath(); ctx.ellipse(x + 11, y + 13 + 2 * Math.sin(f / 3), 11, 13, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = C.gris; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 11, y + 26);
        ctx.quadraticCurveTo(x + 6 + 4 * Math.sin(f / 2), y + 36, x + 11, y + 46); ctx.stroke();
        break;
      case 'paraguas':
        ctx.fillStyle = C.naranja; ctx.beginPath(); ctx.arc(x + 15, y + 12, 15, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 15, y + 12); ctx.lineTo(x + 15, y + 22); ctx.stroke();
        ctx.fillStyle = C.tinta; ctx.beginPath(); ctx.arc(x + 15, y + 22, 5, 0, 7); ctx.fill();
        ctx.fillRect(x + 11, y + 26, 8, 16);
        ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 13, y + 42); ctx.lineTo(x + 13 - 4 * Math.sin(f / 2), y + 54);
        ctx.moveTo(x + 17, y + 42); ctx.lineTo(x + 17 + 4 * Math.sin(f / 2), y + 54); ctx.stroke();
        break;
      case 'gato':
        ctx.fillStyle = C.tinta; ctx.beginPath(); ctx.ellipse(x + 14, y + 10, 10, 5, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 4, y + 7, 4.5, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + 1, y + 4); ctx.lineTo(x + 2, y - 1); ctx.lineTo(x + 5, y + 3); ctx.fill();
        ctx.strokeStyle = C.tinta; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x + 24, y + 9); ctx.quadraticCurveTo(x + 30, y + 2 * Math.sin(f), x + 28, y - 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 8, y + 13); ctx.lineTo(x + 8 + 3 * Math.sin(f), y + 18);
        ctx.moveTo(x + 20, y + 13); ctx.lineTo(x + 20 - 3 * Math.sin(f), y + 18); ctx.stroke();
        break;
    }
  }

  // ---------- Jugador y ranking (top 10) ----------
  var API = 'https://ottokols.es/.netlify/functions/ranking';
  var lista = document.getElementById('rankingLista');
  var campo = document.getElementById('jugadorNombre');
  var aviso = document.getElementById('jugadorAviso');
  var resumenEl = document.getElementById('juegoResumen');
  var ranking = [];
  var NOMBRE_OK = /^@?[\p{L}\p{N}._ ]{2,24}$/u;
  try { if (campo) campo.value = localStorage.getItem('md-juego-nombre') || localStorage.getItem('md-juego-ig') || ''; } catch (e) {}
  function jugador() { return campo ? campo.value.trim().replace(/\s+/g, ' ') : ''; }
  function nombreValido() { return NOMBRE_OK.test(jugador()); }
  function pedirNombre() {
    if (!campo) return;
    campo.focus();
    campo.classList.add('falta');
    if (aviso) aviso.hidden = false;
    setTimeout(function () { campo.classList.remove('falta'); }, 900);
  }
  if (campo) campo.addEventListener('input', function () {
    if (aviso) aviso.hidden = true;
    try { localStorage.setItem('md-juego-nombre', jugador()); } catch (e) {}
  });
  if (campo) campo.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter') { ev.preventDefault(); campo.blur(); if (nombreValido()) empezar(); else pedirNombre(); }
  });

  function textoNombre(r) { return String(r.nombre || r.ig || ''); }
  function pintarRanking(resaltar) {
    if (!lista) return;
    if (!ranking.length) { lista.innerHTML = '<li class="aviso">Todavía no hay nadie. Sé el primero.</li>'; return; }
    lista.innerHTML = ranking.map(function (r, i) {
      var n = textoNombre(r);
      var limpio = n.replace(/[<>&"]/g, '');
      var esIg = /^@[A-Za-z0-9._]{1,30}$/.test(n);
      var nombreHtml = esIg ? '<a href="https://instagram.com/' + n.slice(1) + '" target="_blank" rel="noopener nofollow">' + limpio + '</a>' : '<span class="nombre">' + limpio + '</span>';
      var yo = resaltar && n.toLowerCase() === resaltar.toLowerCase() ? ' class="yo"' : '';
      return '<li' + yo + '><span class="pos">' + (i + 1) + '</span>' + nombreHtml + '<span class="pts">' + r.puntos + '</span></li>';
    }).join('');
  }
  function cargarRanking() {
    fetch(API).then(function (r) { return r.json(); }).then(function (d) { if (Array.isArray(d)) { ranking = d; pintarRanking(); } }).catch(function () {});
  }
  cargarRanking();

  // Al terminar, la puntuación se guarda sola con el nombre del jugador
  var finAntes = terminar;
  terminar = function () {
    finAntes();
    var quien = jugador(), pts = estado.puntos;
    if (!nombreValido()) return;
    if (!pts) { // también se apuntan las partidas de 0 puntos (para saber cuánta gente juega)
      fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: quien, puntos: 0, nivel: estado.nivel, segundos: estado.t }) }).catch(function () {});
      return;
    }
    var linea = document.createElement('span');
    linea.className = 'guardado';
    linea.textContent = ' Guardando puntuación…';
    if (resumenEl) resumenEl.appendChild(linea);
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: quien, puntos: pts, nivel: estado.nivel, segundos: estado.t }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !Array.isArray(d.top)) throw d;
        ranking = d.top;
        var fmt = function (n) { return Number(n).toLocaleString('es-ES'); };
        var enTop = d.puesto <= 10;
        var txt = enTop
          ? ' ¡Entras en el top 10, puesto ' + d.puesto + '!'
          : ' Tu puntuación queda en el puesto ' + fmt(d.puesto) + ' de ' + fmt(d.total) + ' jugadores.';
        if (d.mejor > pts) txt += ' Tu mejor marca (' + fmt(d.mejor) + ') sigue en el puesto ' + fmt(d.puestoMejor) + '.';
        else if (!enTop && d.puesto > 10) txt += ' Te faltan ' + fmt(ranking.length ? ranking[ranking.length - 1].puntos - pts + 5 : 0) + ' puntos para el top 10.';
        linea.textContent = txt;
        pintarRanking(d.puestoMejor <= 10 ? quien : null);
        if (window.umami) window.umami.track('juego-puesto', { puesto: d.puesto });
      })
      .catch(function () { linea.textContent = ' No se ha podido guardar la puntuación.'; });
  };

  // ---------- Controles ----------
  window.addEventListener('keydown', function (ev) {
    if ((ev.code === 'Space' || ev.code === 'Enter') && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      var r = canvas.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return; // solo si el juego está a la vista
      ev.preventDefault(); disparar();
    }
  });
  canvas.addEventListener('pointerdown', function (ev) { ev.preventDefault(); disparar(); });
  document.addEventListener('visibilitychange', function () { antes = performance.now(); });

  requestAnimationFrame(bucle);
})();
