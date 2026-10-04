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
      fotos: {}, perfectas: 0, montura: null, nueva: false, monturasPartida: [],
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
    if (resumen) {
      var d = descubiertas();
      var col = document.createElement('span');
      col.className = 'coleccion';
      col.textContent = d.length
        ? ' Monturas descubiertas: ' + d.length + ' de ' + CLAVES.length + ' (' + d.map(function (k) { return MONTURAS[k].nombre; }).join(', ') + ').'
        : ' Llega al nivel 5 para descubrir la primera montura… hay ' + CLAVES.length + '.';
      resumen.appendChild(col);
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
    if (nivel > e.nivel) {
      e.nivel = nivel; e.banner = 1.4; clic(660, 0.12, 0.04);
      // Cada 5 niveles, montura nueva al azar (nunca la misma que la anterior)
      if (nivel % 5 === 0) {
        e.montura = elegirMontura(e.montura);
        e.nueva = descubrir(e.montura);
        e.monturasPartida.push(e.montura);
        if (window.umami) window.umami.track('juego-montura', { montura: e.montura });
      }
    }
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

    // Fotógrafo (desde el nivel 5, montado en algo distinto cada 5 niveles)
    if (!(e.golpe > 0 && Math.floor(e.golpe * 10) % 2 === 0)) {
      if (e.montura) {
        var m = dibujarMontura(e.montura, FX(), SUELO, e.paso);
        fotografo(FX(), SUELO - m.alto, 0, e.enfriar > 0 && e.flash > 0.4, !m.dePie);
        if (m.cupula) cupula(FX(), SUELO, e.paso);
      } else fotografo(FX(), SUELO, e.paso, e.enfriar > 0 && e.flash > 0.4);
    }

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
      if (e.montura && e.nivel % 5 === 0) {
        ctx.font = '600 16px Jost, system-ui, sans-serif'; ctx.fillStyle = C.tinta;
        ctx.fillText('¡Ahora vas ' + MONTURAS[e.montura].texto + '!', W / 2, H / 2 + 8);
        if (e.nueva) { ctx.fillStyle = C.rosa; ctx.font = '600 13px Jost, system-ui, sans-serif'; ctx.fillText('Nueva montura descubierta · ' + descubiertas().length + ' de ' + CLAVES.length, W / 2, H / 2 + 30); }
      }
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

  // ---------- Monturas: cada 5 niveles el fotógrafo cambia de montura, al azar entre 20 ----------
  // Cada una devuelve { alto, dePie }: a qué altura va el fotógrafo y si va de pie (patinete, monopatín…)
  var MONTURAS = {
    trex: { nombre: 'T-Rex', texto: 'en T-Rex' }, ovni: { nombre: 'Ovni', texto: 'en ovni' }, conejo: { nombre: 'Conejo gigante', texto: 'en conejo gigante' },
    cerdo: { nombre: 'Cerdo', texto: 'en cerdo' }, caballo: { nombre: 'Caballo', texto: 'a caballo' }, unicornio: { nombre: 'Unicornio', texto: 'en unicornio' },
    camello: { nombre: 'Camello', texto: 'en camello' }, elefante: { nombre: 'Elefante', texto: 'en elefante' }, avestruz: { nombre: 'Avestruz', texto: 'en avestruz' },
    tortuga: { nombre: 'Tortuga', texto: 'en tortuga (sin prisa)' }, caracol: { nombre: 'Caracol', texto: 'en caracol (más despacio imposible)' },
    pato: { nombre: 'Patito de goma', texto: 'en patito de goma' }, vaca: { nombre: 'Vaca', texto: 'en vaca' }, patinete: { nombre: 'Patinete', texto: 'en patinete' },
    monopatin: { nombre: 'Monopatín', texto: 'en monopatín' }, carrito: { nombre: 'Carrito del súper', texto: 'en carrito del súper' },
    alfombra: { nombre: 'Alfombra voladora', texto: 'en alfombra voladora' }, nube: { nombre: 'Nube', texto: 'en una nube' },
    escoba: { nombre: 'Escoba', texto: 'en escoba' }, cohete: { nombre: 'Cohete', texto: 'en cohete' }
  };
  var CLAVES = Object.keys(MONTURAS);
  function elegirMontura(actual) {
    var opciones = CLAVES.filter(function (k) { return k !== actual; });
    return opciones[Math.floor(Math.random() * opciones.length)];
  }
  // Monturas descubiertas en este navegador (para la colección)
  function descubiertas() { try { return JSON.parse(localStorage.getItem('md-juego-monturas') || '[]'); } catch (e) { return []; } }
  function descubrir(k) {
    var d = descubiertas(); if (d.indexOf(k) !== -1) return false;
    d.push(k); try { localStorage.setItem('md-juego-monturas', JSON.stringify(d)); } catch (e) {}
    return true;
  }

  function elipse(x, y, rx, ry, color, borde) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill();
    if (borde) { ctx.strokeStyle = borde; ctx.lineWidth = 1.6; ctx.stroke(); }
  }
  function linea(x1, y1, x2, y2, color, ancho) { ctx.strokeStyle = color; ctx.lineWidth = ancho; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  function circulo(x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
  function rueda(x, y, r) { circulo(x, y, r, C.tinta); circulo(x, y, r * 0.4, '#9a9387'); }
  // Animal de cuatro patas genérico (caballo, unicornio, vaca, camello)
  function cuadrupedo(x, s, p, q, o) {
    var top = s - o.altoPatas - o.ry * 2;
    [[-o.rx + 8, p], [-o.rx + 16, q], [o.rx - 14, q], [o.rx - 6, p]].forEach(function (pt) { linea(x + pt[0], s - o.altoPatas - 2, x + pt[0] + 5 * pt[1], s - 2, o.patas || o.color, o.grosor || 5); });
    if (o.cola) { ctx.strokeStyle = o.cola; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - o.rx + 2, top + 8); ctx.quadraticCurveTo(x - o.rx - 12, top + 12 + 3 * p, x - o.rx - 8, top + 26); ctx.stroke(); }
    elipse(x, top + o.ry, o.rx, o.ry, o.color, o.borde);
    ctx.fillStyle = o.color; ctx.beginPath();
    ctx.moveTo(x + o.rx - 10, top + 4); ctx.lineTo(x + o.rx + 6, top - o.cuello); ctx.lineTo(x + o.rx + 14, top - o.cuello + 6); ctx.lineTo(x + o.rx + 2, top + o.ry + 2); ctx.fill();
    if (o.borde) { ctx.strokeStyle = o.borde; ctx.lineWidth = 1.6; ctx.stroke(); }
    elipse(x + o.rx + 16, top - o.cuello + 4, 12, 7, o.color, o.borde);
    circulo(x + o.rx + 16, top - o.cuello + 1, 1.8, C.tinta);
    return top;
  }

  function dibujarMontura(tipo, x, s, paso) {
    var p = Math.sin(paso * 2.2), q = Math.sin(paso * 2.2 + Math.PI), bob = Math.sin(paso * 1.3) * 3;
    ctx.lineCap = 'round';
    var top;
    switch (tipo) {
      case 'trex': {
        var verde = '#5f7f4f', oscuro = '#3f5a34';
        linea(x - 4, s - 30, x - 6 + 7 * p, s - 2, oscuro, 7); linea(x + 10, s - 30, x + 8 + 7 * q, s - 2, oscuro, 7);
        ctx.fillStyle = verde; ctx.beginPath();
        ctx.moveTo(x - 10, s - 46); ctx.quadraticCurveTo(x - 40, s - 44, x - 52, s - 30 + 3 * p); ctx.quadraticCurveTo(x - 34, s - 34, x - 8, s - 30); ctx.fill();
        elipse(x + 3, s - 40, 20, 14, verde);
        ctx.beginPath(); ctx.moveTo(x + 14, s - 48); ctx.lineTo(x + 26, s - 70); ctx.lineTo(x + 32, s - 64); ctx.lineTo(x + 22, s - 40); ctx.fill();
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x + 20, s - 84, 32, 18, 7); else ctx.rect(x + 20, s - 84, 32, 18); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(x + 36, s - 68, 14, 3);
        circulo(x + 38, s - 78, 2.4, C.tinta);
        linea(x + 20, s - 46, x + 27, s - 41 + 2 * p, oscuro, 3);
        return { alto: 24 };
      }
      case 'ovni': {
        var base = s - 34 + bob;
        ctx.fillStyle = 'rgba(232,130,26,.18)';
        ctx.beginPath(); ctx.moveTo(x - 8, base + 4); ctx.lineTo(x + 14, base + 4); ctx.lineTo(x + 28, s); ctx.lineTo(x - 22, s); ctx.fill();
        elipse(x + 3, base, 38, 9, '#8d8a85'); elipse(x + 3, base - 3, 30, 5, '#b9b5ae');
        for (var i = 0; i < 5; i++) circulo(x - 21 + i * 12, base + 3, 2.2, (Math.floor(paso * 4) + i) % 2 ? C.naranja : C.rosa);
        return { alto: 26 - bob, cupula: true };
      }
      case 'conejo': {
        var salto = Math.abs(Math.sin(paso * 1.6)) * 12, b = s - salto, blanco = '#f3eee6', rosa = '#f2a7b8', ln = '#bdb2a2';
        elipse(x - 4, b - 8, 16, 7, '#e5ddd1');
        elipse(x + 1, b - 34, 26, 22, blanco, ln); elipse(x - 25, b - 36, 7, 7, '#fff', ln);
        elipse(x + 33, b - 80, 4.5, 15, blanco, ln); elipse(x + 42, b - 78, 4.5, 15, blanco, ln);
        elipse(x + 36, b - 54, 13, 12, blanco, ln);
        elipse(x + 33, b - 80, 2.2, 11, rosa); elipse(x + 42, b - 78, 2.2, 11, rosa);
        circulo(x + 41, b - 57, 2, C.tinta); elipse(x + 48, b - 52, 2.4, 2, rosa);
        return { alto: 26 + salto };
      }
      case 'cerdo': {
        var cer = '#f2a7b8', cerO = '#d9849a';
        [[-14, p], [-4, q], [10, p], [18, q]].forEach(function (pt) { linea(x + pt[0], s - 18, x + pt[0] + 3 * pt[1], s - 2, cerO, 6); });
        elipse(x + 2, s - 28, 30, 16, cer); elipse(x + 32, s - 32, 12, 11, cer); elipse(x + 42, s - 30, 5, 4.5, cerO);
        circulo(x + 41, s - 30, 1, C.tinta); circulo(x + 44, s - 30, 1, C.tinta); circulo(x + 34, s - 37, 1.8, C.tinta);
        ctx.fillStyle = cerO; ctx.beginPath(); ctx.moveTo(x + 26, s - 42); ctx.lineTo(x + 30, s - 50); ctx.lineTo(x + 33, s - 41); ctx.fill();
        ctx.strokeStyle = cerO; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x - 30, s - 32, 4, 0, 5); ctx.stroke();
        return { alto: 14 };
      }
      case 'caballo':
        top = cuadrupedo(x, s, p, q, { rx: 26, ry: 12, altoPatas: 30, color: '#8a5a3c', cola: '#3a2a20', cuello: 22 });
        linea(x + 28, top - 4, x + 38, top - 22, '#3a2a20', 4);                                    // crin
        return { alto: s - top - 30 };
      case 'unicornio': {
        top = cuadrupedo(x, s, p, q, { rx: 26, ry: 12, altoPatas: 30, color: '#f6f1ea', borde: '#bdb2a2', patas: '#e2d9cc', cola: C.rosa, cuello: 22 });
        ['#e8821a', '#e8347a', '#9b6fd0'].forEach(function (c, i) { linea(x + 26 + i * 3, top - 2 + i * 2, x + 36 + i * 3, top - 20 + i * 2, c, 3); });
        ctx.fillStyle = '#f6c76a'; ctx.beginPath(); ctx.moveTo(x + 44, top - 24); ctx.lineTo(x + 50, top - 42); ctx.lineTo(x + 50, top - 24); ctx.fill();   // cuerno
        return { alto: s - top - 30 };
      }
      case 'vaca': {
        top = cuadrupedo(x, s, p, q, { rx: 27, ry: 14, altoPatas: 26, color: '#f6f1ea', borde: '#8a8378', patas: '#d8d0c4', cola: '#8a8378', cuello: 8 });
        elipse(x - 10, top + 10, 7, 5, C.tinta); elipse(x + 8, top + 18, 6, 4, C.tinta); elipse(x + 14, top + 6, 4, 3, C.tinta);
        elipse(x + 50, top + 0, 6, 4, '#f2a7b8');                                                // hocico
        linea(x + 38, top - 10, x + 34, top - 16, '#d8c49a', 2.5); linea(x + 44, top - 10, x + 48, top - 16, '#d8c49a', 2.5);   // cuernos
        elipse(x + 2, top + 30, 6, 4, '#f2a7b8');                                               // ubre
        return { alto: s - top - 30 };
      }
      case 'camello': {
        top = cuadrupedo(x, s, p, q, { rx: 26, ry: 12, altoPatas: 34, color: '#c9a46a', cuello: 30, grosor: 4 });
        elipse(x - 12, top - 2, 13, 12, '#c9a46a');                                             // joroba (detrás del jinete)
        return { alto: s - top - 30 };
      }
      case 'elefante': {
        var gris = '#9a9a9e', grisO = '#7c7c82';
        [[-20, p], [-8, q], [10, p], [20, q]].forEach(function (pt) { linea(x + pt[0], s - 26, x + pt[0] + 2 * pt[1], s - 3, grisO, 9); });
        elipse(x, s - 40, 30, 22, gris);
        elipse(x + 32, s - 46, 14, 14, gris);
        elipse(x + 24, s - 46, 9, 13, grisO);                                                   // oreja
        ctx.strokeStyle = gris; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x + 42, s - 42); ctx.quadraticCurveTo(x + 50, s - 24, x + 46 + 3 * p, s - 12); ctx.stroke(); // trompa
        circulo(x + 36, s - 50, 1.8, C.tinta);
        linea(x - 30, s - 42, x - 36, s - 30, grisO, 2);
        return { alto: 32 };
      }
      case 'avestruz': {
        linea(x - 2, s - 50, x - 4 + 8 * p, s - 2, '#e8a0a8', 3); linea(x + 6, s - 50, x + 4 + 8 * q, s - 2, '#e8a0a8', 3);
        elipse(x, s - 60, 22, 12, '#2a2622');
        elipse(x - 20, s - 64, 8, 6, '#f5f3ef', '#bdb2a2');                                     // plumas de la cola
        linea(x + 16, s - 64, x + 26, s - 100, '#e8a0a8', 4);
        elipse(x + 28, s - 102, 6, 5, '#e8a0a8'); ctx.fillStyle = '#d8a35a'; ctx.beginPath(); ctx.moveTo(x + 33, s - 103); ctx.lineTo(x + 40, s - 101); ctx.lineTo(x + 33, s - 99); ctx.fill();
        circulo(x + 29, s - 104, 1.4, C.tinta);
        return { alto: 42 };
      }
      case 'tortuga': {
        [[-18, p], [16, q]].forEach(function (pt) { elipse(x + pt[0] + 2 * pt[1], s - 4, 7, 4, '#8aa36a'); });
        elipse(x + 34, s - 12, 9, 7, '#8aa36a'); circulo(x + 38, s - 14, 1.5, C.tinta);
        ctx.fillStyle = '#6f8a4f'; ctx.beginPath(); ctx.ellipse(x, s - 8, 30, 26, 0, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = '#4f6a36'; ctx.lineWidth = 2;
        [[-14, -18], [0, -24], [14, -18]].forEach(function (c) { ctx.beginPath(); ctx.arc(x + c[0], s + c[1], 6, 0, 7); ctx.stroke(); });
        return { alto: 4 };
      }
      case 'caracol': {
        ctx.fillStyle = '#d9c7a3'; ctx.beginPath(); ctx.moveTo(x - 34, s - 2); ctx.quadraticCurveTo(x, s - 14, x + 30, s - 10); ctx.lineTo(x + 38, s - 34); ctx.lineTo(x + 44, s - 30); ctx.lineTo(x + 40, s - 2); ctx.fill();
        linea(x + 38, s - 34, x + 36, s - 50, '#d9c7a3', 2.5); linea(x + 42, s - 32, x + 46, s - 48, '#d9c7a3', 2.5);
        circulo(x + 36, s - 51, 2.5, C.tinta); circulo(x + 46, s - 49, 2.5, C.tinta);
        circulo(x - 4, s - 32, 24, '#c98a4b');
        ctx.strokeStyle = '#8a5a2c'; ctx.lineWidth = 2.5; ctx.beginPath();
        for (var a = 0; a < 12; a += 0.2) { var r = 2 + a * 1.7, px = x - 4 + Math.cos(a) * r, py = s - 32 + Math.sin(a) * r; if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
        ctx.stroke();
        return { alto: 26 };
      }
      case 'pato': {
        var am = '#f6c744';
        ctx.fillStyle = 'rgba(120,180,220,.35)'; ctx.fillRect(x - 40, s - 6, 90, 6);           // charquito
        elipse(x - 2, s - 22, 30, 17, am); elipse(x - 26, s - 32, 8, 10, am);                   // cuerpo y cola
        elipse(x + 24, s - 50, 13, 13, am);
        ctx.fillStyle = C.naranja; ctx.beginPath(); ctx.ellipse(x + 39, s - 47, 7, 3.5, 0, 0, 7); ctx.fill();
        circulo(x + 28, s - 53, 2, C.tinta);
        return { alto: 9 };
      }
      case 'patinete':
        linea(x - 26, s - 10, x + 26, s - 10, C.tinta, 4); linea(x + 26, s - 10, x + 30, s - 68, '#9a9387', 3); linea(x + 22, s - 68, x + 38, s - 68, C.tinta, 3);
        rueda(x - 24, s - 5, 5); rueda(x + 28, s - 5, 5);
        return { alto: 10, dePie: true };
      case 'monopatin': {
        var t = Math.sin(paso * 0.9) * 2;
        ctx.fillStyle = C.rosa; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - 28, s - 12 + t, 58, 5, 3); else ctx.rect(x - 28, s - 12 + t, 58, 5); ctx.fill();
        rueda(x - 18, s - 4, 4); rueda(x + 20, s - 4, 4);
        return { alto: 10 - t, dePie: true };
      }
      case 'carrito': {
        rueda(x - 20, s - 5, 5); rueda(x + 22, s - 5, 5);
        linea(x - 24, s - 12, x + 26, s - 12, '#7c7c82', 2);
        ctx.strokeStyle = '#9a9387'; ctx.lineWidth = 2; ctx.strokeRect(x - 26, s - 46, 54, 30);
        for (var k = -20; k < 28; k += 8) linea(x + k, s - 46, x + k, s - 16, '#b9b5ae', 1);
        linea(x - 26, s - 46, x - 38, s - 56, '#7c7c82', 2.5); linea(x - 38, s - 56, x - 44, s - 56, C.rosa, 4);   // asa
        return { alto: 12 };
      }
      case 'alfombra': {
        var y = s - 42 + bob;
        ctx.fillStyle = '#b4322a'; ctx.beginPath(); ctx.moveTo(x - 34, y); 
        for (var w = -34; w <= 36; w += 6) ctx.lineTo(x + w, y + Math.sin(paso * 3 + w * 0.15) * 2.5);
        ctx.lineTo(x + 36, y + 7); for (var w2 = 36; w2 >= -34; w2 -= 6) ctx.lineTo(x + w2, y + 7 + Math.sin(paso * 3 + w2 * 0.15) * 2.5); ctx.fill();
        linea(x - 30, y + 3.5, x + 32, y + 3.5, '#f6c76a', 1.5);
        [-36, 38].forEach(function (b) { for (var f = 0; f < 3; f++) linea(x + b, y + 1 + f * 2.5, x + b + (b > 0 ? 5 : -5), y + 2 + f * 2.5, '#f6c76a', 1); });
        return { alto: s - y - 30 + 2 };
      }
      case 'nube': {
        var y2 = s - 52 + bob;
        [[-22, 6, 14], [-6, 0, 18], [14, 2, 16], [28, 8, 11], [2, 10, 16]].forEach(function (c) { elipse(x + c[0], y2 + c[1], c[2], c[2] * 0.8, '#fff', '#cfc8bb'); });
        [[-22, 6, 13], [-6, 0, 17], [14, 2, 15], [28, 8, 10], [2, 10, 15]].forEach(function (c) { elipse(x + c[0], y2 + c[1], c[2], c[2] * 0.8, '#fff'); });
        return { alto: s - (y2 - 12) - 30 };
      }
      case 'escoba': {
        var y3 = s - 46 + bob;
        linea(x - 30, y3 + 4, x + 40, y3 - 4, '#8a5a3c', 3.5);
        ctx.fillStyle = '#d8b46a'; ctx.beginPath(); ctx.moveTo(x - 28, y3 + 1); ctx.lineTo(x - 52, y3 - 6 + 2 * p); ctx.lineTo(x - 54, y3 + 12 + 2 * q); ctx.lineTo(x - 28, y3 + 8); ctx.fill();
        for (var e2 = 0; e2 < 3; e2++) circulo(x - 60 - e2 * 8 - (paso * 20 % 8), y3 + 3 + Math.sin(paso * 5 + e2) * 3, 1.5, C.naranja);   // chispas
        return { alto: s - y3 - 30 };
      }
      case 'cohete': {
        var y4 = s - 54 + bob;
        ctx.fillStyle = C.naranja; ctx.beginPath(); ctx.moveTo(x - 36, y4 - 6); ctx.lineTo(x - 50 - 8 * Math.abs(p), y4); ctx.lineTo(x - 36, y4 + 6); ctx.fill();   // llama
        ctx.fillStyle = '#e9e5de'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - 36, y4 - 10, 64, 20, 8); else ctx.rect(x - 36, y4 - 10, 64, 20); ctx.fill();
        ctx.strokeStyle = '#9a9387'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = C.rosa; ctx.beginPath(); ctx.moveTo(x + 26, y4 - 10); ctx.lineTo(x + 44, y4); ctx.lineTo(x + 26, y4 + 10); ctx.fill();       // punta
        ctx.beginPath(); ctx.moveTo(x - 30, y4 - 10); ctx.lineTo(x - 38, y4 - 20); ctx.lineTo(x - 22, y4 - 10); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - 30, y4 + 10); ctx.lineTo(x - 38, y4 + 20); ctx.lineTo(x - 22, y4 + 10); ctx.fill();
        circulo(x + 12, y4, 4.5, '#aad6e8');
        return { alto: s - (y4 - 10) - 30 };
      }
    }
    return { alto: 0 };
  }

  // Cúpula del ovni, encima del fotógrafo (va dentro)
  function cupula(x, suelo, paso) {
    var base = suelo - 34 + Math.sin(paso * 1.3) * 3;
    ctx.fillStyle = 'rgba(170,215,232,.35)'; ctx.strokeStyle = 'rgba(120,160,175,.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(x + 3, base - 4, 27, 60, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
  }

  function fotografo(x, suelo, paso, disparando, montado) {
    var p = Math.sin(paso * 2.2);
    ctx.strokeStyle = C.tinta; ctx.fillStyle = C.tinta; ctx.lineWidth = 4; ctx.lineCap = 'round';
    // piernas (montado: sentado a horcajadas, colgando)
    ctx.beginPath();
    if (montado) { ctx.moveTo(x, suelo - 30); ctx.lineTo(x + 6, suelo - 18); ctx.lineTo(x + 3, suelo - 6); }
    else { ctx.moveTo(x, suelo - 30); ctx.lineTo(x - 8 * p, suelo - 2); ctx.moveTo(x, suelo - 30); ctx.lineTo(x + 8 * p, suelo - 2); }
    ctx.stroke();
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
