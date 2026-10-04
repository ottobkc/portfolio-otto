// Monturas del juego del fotógrafo (mirardespacio.es/juego/). Se usan en el juego y en la zona MD+
// (colección de monturas descubiertas). El juego carga este archivo desde mirardespacio.es/assets/.
(function () {
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

  // crear(ctx, C) devuelve las funciones de dibujo sobre ese lienzo
  function crear(ctx, C) {
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


    // El fotógrafo (el mismo del juego), para dibujarlo encima de la montura
    function fotografo(x, suelo, paso, disparando, montado) {
      var p = Math.sin(paso * 2.2);
      ctx.strokeStyle = C.tinta; ctx.fillStyle = C.tinta; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath();
      if (montado) { ctx.moveTo(x, suelo - 30); ctx.lineTo(x + 6, suelo - 18); ctx.lineTo(x + 3, suelo - 6); }
      else { ctx.moveTo(x, suelo - 30); ctx.lineTo(x - 8 * p, suelo - 2); ctx.moveTo(x, suelo - 30); ctx.lineTo(x + 8 * p, suelo - 2); }
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, suelo - 30); ctx.lineTo(x + 2, suelo - 60); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 3, suelo - 70, 8, 0, 7); ctx.fill();
      ctx.fillStyle = C.naranja; ctx.fillRect(x - 4, suelo - 80, 14, 4); ctx.fillRect(x + 6, suelo - 78, 8, 3);
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(x + 2, suelo - 54); ctx.lineTo(x + 14, suelo - 62); ctx.stroke();
      ctx.fillStyle = C.tinta; ctx.fillRect(x + 12, suelo - 70, 16, 11);
      ctx.fillStyle = disparando ? '#fff' : C.rosa; ctx.beginPath(); ctx.arc(x + 25, suelo - 64.5, 3.2, 0, 7); ctx.fill();
      ctx.strokeStyle = C.rosa; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 12, suelo - 68); ctx.lineTo(x + 1, suelo - 50); ctx.stroke();
    }
    // Montura con su jinete
    function escena(tipo, x, suelo, paso) {
      var m = dibujarMontura(tipo, x, suelo, paso);
      fotografo(x, suelo - m.alto, 0, false, !m.dePie);
      if (m.cupula) cupula(x, suelo, paso);
    }

    return { dibujar: dibujarMontura, cupula: cupula, fotografo: fotografo, escena: escena };
  }

  window.MDMonturas = { MONTURAS: MONTURAS, CLAVES: CLAVES, crear: crear };

  // ---------- Imagen para compartir en Instagram (post 1080×1350 o historia 1080×1920) ----------
  // o = { formato, antetitulo, titulo, subtitulo, pie, logo, dibujar(ctx, cx, cy, ancho, alto) }
  var PAL = { tinta: '#1a1814', naranja: '#e8821a', rosa: '#e8347a', crema: '#f5f3ef', gris: '#7a756f' };
  function cargar(src) { return new Promise(function (ok) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = src; }); }
  function tarjeta(o) {
    var historia = o.formato === 'historia', W = 1080, H = historia ? 1920 : 1350;
    var fuentes = document.fonts ? Promise.all(['400 60px Georgia', '400 32px Jost', '500 32px Jost'].map(function (f) { return document.fonts.load(f); })).catch(function () {}) : Promise.resolve();
    return fuentes.then(function () { return cargar(o.logo || '/assets/logo-md-ig.png'); }).then(function (logo) {
      var c = document.createElement('canvas'); c.width = W; c.height = H;
      var x = c.getContext('2d');
      x.fillStyle = PAL.crema; x.fillRect(0, 0, W, H);
      var g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, PAL.naranja); g.addColorStop(1, PAL.rosa);
      x.fillStyle = g; x.fillRect(0, 0, W, 14);
      // Ilustración
      var ix = W / 2, iy = historia ? 820 : 520, iw = 860, ih = historia ? 760 : 640;
      x.save(); o.dibujar(x, ix, iy, iw, ih); x.restore();
      // Textos
      var ty = historia ? 1290 : 930;
      x.textAlign = 'center';
      if (o.antetitulo) { x.fillStyle = PAL.rosa; x.font = '500 30px Jost, sans-serif'; x.fillText(o.antetitulo.toUpperCase(), W / 2, ty - 78); }
      x.fillStyle = PAL.tinta; x.font = '400 68px Georgia, serif'; x.fillText(o.titulo, W / 2, ty);
      x.fillStyle = PAL.gris; x.font = '400 34px Jost, sans-serif'; if (o.subtitulo) x.fillText(o.subtitulo, W / 2, ty + 62);
      x.fillStyle = PAL.tinta; x.font = '500 30px Jost, sans-serif'; if (o.pie) x.fillText(o.pie, W / 2, ty + 116);
      // Logo (en la historia, arriba, bajo la barra de Instagram)
      if (logo) {
        var lw = historia ? 420 : 320, lh = logo.naturalHeight * lw / logo.naturalWidth;
        x.drawImage(logo, (W - lw) / 2, historia ? 230 : H - 70 - lh, lw, lh);
      }
      return new Promise(function (ok, ko) { c.toBlob(function (b) { b ? ok(b) : ko(new Error('canvas')); }, 'image/png'); });
    });
  }
  function compartir(blob, nombre, texto) {
    var file = new File([blob], nombre, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file], text: texto || '' }).catch(function (e) { if (e && e.name !== 'AbortError') throw e; });
    }
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    return Promise.resolve();
  }
  // Imagen de una montura (con el fotógrafo encima)
  function compartirMontura(k, o) {
    o = o || {};
    var M = MONTURAS[k];
    return tarjeta({
      formato: o.formato, logo: o.logo, antetitulo: 'Montura desbloqueada',
      titulo: M.nombre, subtitulo: (o.cuantas ? o.cuantas + ' de ' + CLAVES.length + ' monturas' : 'El juego del fotógrafo') + (o.jugador ? ' · ' + o.jugador : ''),
      pie: '¿Me superas? mirardespacio.es/juego',
      dibujar: function (x, cx, cy) {
        var esc = 5.2;
        x.translate(cx - 6 * esc, cy + 70 * esc / 1.6); x.scale(esc, esc);
        x.fillStyle = PAL.tinta; x.fillRect(-80, 0, 175, 1.2);
        crear(x, PAL).escena(k, 0, 0, 1.3);
      },
    }).then(function (b) {
      try { window.umami && window.umami.track('compartir-montura', { montura: k, formato: o.formato || 'post' }); } catch (e) {}
      return compartir(b, 'mirar-despacio-' + k + '.png', 'He desbloqueado ' + M.nombre.toLowerCase() + ' en el juego del fotógrafo de Mirar Despacio');
    });
  }
  window.MDCompartir = { tarjeta: tarjeta, compartir: compartir, montura: compartirMontura };
})();
