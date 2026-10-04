// Tarjeta para Instagram: la foto + el comentario de Otto + el logo de Mirar Despacio.
// Se dibuja en el navegador (no ocupa nada en el servidor ni en Cloudinary).
//   TarjetaIG.compartir({ url, comentario, nombre, donde, formato: 'post' | 'historia' })
// En el móvil abre el menú de compartir (Instagram incluido); en el ordenador, descarga la imagen.
(function () {
  // Logo recortado y servido desde la propia web (así el navegador siempre puede dibujarlo)
  var LOGO = '/assets/logo-md-ig.png';
  var C = { fondo: '#f5f3ef', tinta: '#1a1814', gris: '#7a756f', naranja: '#e8821a', rosa: '#e8347a' };

  function cargar(src) {
    return new Promise(function (ok, ko) {
      var i = new Image(); i.crossOrigin = 'anonymous';
      i.onload = function () { ok(i); }; i.onerror = ko; i.src = src;
    });
  }
  function lineas(ctx, texto, ancho) {
    var res = [];
    String(texto || '').split('\n').forEach(function (parrafo) {
      var l = '';
      parrafo.split(/\s+/).forEach(function (p) {
        var prueba = l ? l + ' ' + p : p;
        if (ctx.measureText(prueba).width > ancho && l) { res.push(l); l = p; } else l = prueba;
      });
      if (l) res.push(l);
    });
    return res;
  }

  function dibujar(o, foto, logo) {
    var historia = o.formato === 'historia';
    var W = 1080, H = historia ? 1920 : 1350, M = 80;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d');
    x.fillStyle = C.fondo; x.fillRect(0, 0, W, H);
    var g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, C.naranja); g.addColorStop(1, C.rosa);
    x.fillStyle = g; x.fillRect(0, 0, W, 12);

    // Comentario: se calcula primero para saber cuánto sitio deja a la foto
    var tam = historia ? 54 : 46;
    x.font = '500 ' + tam + 'px Caveat, cursive';
    var max = historia ? 7 : 5;
    var ls = o.comentario ? lineas(x, o.comentario, W - 2 * M - 40) : [];
    if (ls.length > max) { ls = ls.slice(0, max); ls[max - 1] = ls[max - 1].replace(/\s*\S*$/, '') + '…'; }
    var lh = tam * 1.12;
    var altoTexto = ls.length ? ls.length * lh + 56 : 0;      // comentario + firma
    // En las historias Instagram tapa arriba y abajo: el logo va arriba (bajo la barra de perfil)
    // y el autor abajo, dejando margen. En el post, autor y logo van juntos abajo.
    var pieAlto = historia ? 380 : 170;
    var arriba = historia ? 420 : 70;
    var hueco = H - arriba - pieAlto;                          // sitio para foto + texto
    var sep = ls.length ? 70 : 0;
    var cajaW = W - 2 * M, cajaH = hueco - altoTexto - sep - 40;
    var k = Math.min(cajaW / foto.naturalWidth, cajaH / foto.naturalHeight);
    var fw = foto.naturalWidth * k, fh = foto.naturalHeight * k;
    // El bloque foto + comentario va centrado en vertical
    var bloque = fh + 28 + sep + altoTexto;
    var fy = arriba + Math.max(20, (hueco - bloque) / 2) + 14, fx = (W - fw) / 2;
    x.save(); x.shadowColor = 'rgba(26,24,20,.18)'; x.shadowBlur = 30; x.shadowOffsetY = 8;
    x.fillStyle = '#fff'; x.fillRect(fx - 14, fy - 14, fw + 28, fh + 28); x.restore();
    x.drawImage(foto, fx, fy, fw, fh);

    if (ls.length) {
      var y = fy + fh + 14 + sep + tam * 0.85;
      x.fillStyle = C.rosa; x.fillRect(M, y - tam * 0.85, 6, ls.length * lh);
      x.fillStyle = C.tinta; x.font = '500 ' + tam + 'px Caveat, cursive';
      ls.forEach(function (l, i) { x.fillText(l, M + 30, y + i * lh); });
      x.fillStyle = C.gris; x.font = '400 26px Jost, sans-serif';
      x.fillText('— Otto, Mirar Despacio', M + 30, y + (ls.length - 1) * lh + 56);
    }

    // Logo de Mirar Despacio (si no cargara, se escribe el nombre con la misma gama de color)
    function logoEn(cx, cy, ancho, alinear) {
      var lx;
      if (logo) {
        var lh2 = logo.naturalHeight * ancho / logo.naturalWidth;
        lx = alinear === 'centro' ? cx - ancho / 2 : cx - ancho;
        x.drawImage(logo, lx, cy - lh2 / 2, ancho, lh2);
      } else {
        x.font = '600 ' + Math.round(ancho / 6.5) + 'px Jost, sans-serif';
        var tw = x.measureText('Mirar Despacio').width;
        lx = alinear === 'centro' ? cx - tw / 2 : cx - tw;
        var gl = x.createLinearGradient(lx, 0, lx + tw, 0); gl.addColorStop(0, C.naranja); gl.addColorStop(1, C.rosa);
        x.fillStyle = gl; x.fillText('Mirar Despacio', lx, cy + ancho / 20);
      }
    }

    if (historia) {
      logoEn(W / 2, 290, 420, 'centro');
      var hy = H - 320;
      x.fillStyle = C.tinta; x.font = '500 34px Jost, sans-serif';
      x.textAlign = 'center';
      if (o.nombre) x.fillText('📷 ' + o.nombre, W / 2, hy);
      x.fillStyle = C.gris; x.font = '400 26px Jost, sans-serif';
      x.fillText((o.donde ? o.donde + ' · ' : '') + 'mirardespacio.es', W / 2, hy + 44);
      x.textAlign = 'left';
    } else {
      var py = H - 85;
      x.fillStyle = C.tinta; x.font = '500 30px Jost, sans-serif';
      if (o.nombre) x.fillText('📷 ' + o.nombre, M, py - 14);
      x.fillStyle = C.gris; x.font = '400 24px Jost, sans-serif';
      x.fillText(o.donde || 'mirardespacio.es', M, py + 24);
      logoEn(W - M, py, 300, 'derecha');
    }
    return c;
  }

  function crear(o) {
    var fuentes = document.fonts ? Promise.all([document.fonts.load('500 46px Caveat'), document.fonts.load('400 26px Jost'), document.fonts.load('500 30px Jost')]).catch(function () {}) : Promise.resolve();
    return fuentes.then(function () {
      return Promise.all([cargar(o.url), cargar(LOGO).catch(function () { return null; })]);
    }).then(function (imgs) {
      var c = dibujar(o, imgs[0], imgs[1]);
      return new Promise(function (ok, ko) { c.toBlob(function (b) { b ? ok(b) : ko(new Error('canvas')); }, 'image/jpeg', 0.92); });
    });
  }

  function compartir(o) {
    return crear(o).then(function (blob) {
      var nombre = 'mirar-despacio-' + (o.formato === 'historia' ? 'historia' : 'post') + '.jpg';
      var file = new File([blob], nombre, { type: 'image/jpeg' });
      try { window.umami && window.umami.track('tarjeta-ig', { formato: o.formato || 'post' }); } catch (e) {}
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], text: 'Mirar Despacio · mirardespacio.es' }).catch(function (e) { if (e && e.name !== 'AbortError') throw e; });
      }
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    });
  }

  window.TarjetaIG = { crear: crear, compartir: compartir };
})();
