// Tareas del amigo invisible (cada día, netlify.toml): sorteo, recordatorio de subir la foto y entrega a distancia.
const { db, FieldValue } = require('../lib/firestore');
const { enviar, esc, remitente } = require('../lib/correo');
const { tarjeta, aTexto } = require('../lib/plantillas-salida');
const A = require('../lib/amigo');
const C = A.CONFIG;
const aviso = (asunto, html) => enviar({ para: process.env.AVISO_A || remitente(), asunto, html, texto: aTexto(html) }).catch(() => {});

function correoSorteo(yo, otro) {
  const enlace = A.WEB + '?t=' + yo.token;
  const dist = yo.modalidadFinal === 'distancia';
  const html = tarjeta({
    titulo: 'Tu amigo invisible', nombre: yo.nombre,
    intro: ['¡Ya hemos hecho el sorteo del amigo invisible fotográfico! 🎁', `Te ha tocado hacerle una foto a <strong>${esc(otro.nombre)}</strong>. Su pista es:`],
    filas: [['📷', `<strong style="font-size:18px;">«${esc(otro.pista)}»</strong>`],
      dist ? ['⏳', `Súbela desde tu enlace antes del final del <strong>${esc(A.fechaBonita(C.subirHasta))}</strong>. El ${esc(A.fechaBonita(C.entrega))} le llegará, en alta y lista para imprimir.`]
        : ['🖨️', `Imprímela en 13×18 o 15×20 y tráela a la salida de Navidad${C.salida ? ' del ' + esc(C.salida) : ' (te aviso de la fecha)'}. Allí intercambiamos y toca adivinar quién te ha regalado la tuya.`]],
    calendario: null,
    boton: dist ? { url: enlace, texto: '📤 Subir mi foto', antes: '' } : { url: enlace, texto: 'Ver mi amigo invisible', antes: '' },
    cuerpo: ['Una sola foto, hecha pensando en esa persona. No tiene que ser perfecta: tiene que ser para ella.', 'Y ni una palabra a nadie 🤫'],
  });
  return { para: yo.email, asunto: '🎁 Ya sabes a quién le haces la foto', html, texto: aTexto(html) };
}

function correoEntrega(para, de) {
  const alta = de.foto.url.replace('/upload/', '/upload/fl_attachment:foto-amigo-invisible/');
  const html = tarjeta({
    titulo: 'Tu foto del amigo invisible', nombre: para.nombre,
    intro: ['Tu amigo invisible te ha hecho esta foto pensando en tu pista, «' + esc(para.pista) + '»:',
      `<img src="${esc(de.foto.url.replace('/upload/', '/upload/w_900,q_auto/'))}" alt="Tu foto del amigo invisible" style="width:100%;height:auto;border-radius:6px;">`],
    filas: [['🎁', `Te la ha regalado <strong>${esc(de.nombre)}</strong>.`]],
    calendario: null, boton: { url: alta, texto: '⬇️ Descargar en alta para imprimir', antes: '' },
    cuerpo: ['Imprímela en 13×18 o 15×20 en cualquier tienda de fotos. ¡Feliz Navidad!'],
  });
  return { para: para.email, asunto: '🎁 Tu amigo invisible te ha hecho una foto', html, texto: aTexto(html) };
}

exports.handler = async () => {
  const fs = db(), col = fs.collection(A.COLECCION), hoy = A.hoy(), informe = [];
  const todos = (await col.get()).docs.map((d) => ({ ref: d.ref, ...d.data() }));

  // 1. Sorteo
  if (hoy >= C.sorteo && todos.length && !todos.some((p) => p.regalaA)) {
    if (todos.length < 2) { await aviso('Amigo invisible: solo hay ' + todos.length + ' persona, no hay sorteo', '<p>Escríbele a mano.</p>'); }
    else {
      // Presencial solo tiene sentido con 3 o más; si no, todos a distancia. Si a distancia queda una sola
      // persona, entra en el círculo presencial y las fotos que la tocan (la suya y la que recibe) van a distancia.
      const pres = todos.filter((p) => p.modalidad === 'presencial'), dist = todos.filter((p) => p.modalidad !== 'presencial');
      const circulos = pres.length < 3 ? [[todos, true]] : dist.length === 1 ? [[todos, false]] : [[pres, false], [dist, true]];
      for (const [g, todoDistancia] of circulos) {
        for (const { de, para } of A.circulo(g)) {
          const final = !todoDistancia && de.modalidad === 'presencial' && para.modalidad === 'presencial' ? 'presencial' : 'distancia';
          await de.ref.update({ regalaA: para.email, modalidadFinal: final, sorteadoEn: FieldValue.serverTimestamp() });
          de.regalaA = para.email; de.modalidadFinal = final;
        }
      }
      for (const p of todos) await enviar(correoSorteo(p, todos.find((x) => x.email === p.regalaA))).catch((e) => informe.push('error ' + p.email + ' ' + e.message));
      informe.push(`Sorteo hecho: ${todos.length} personas (${todos.filter((p) => p.modalidadFinal === 'presencial').length} presenciales)`);
      await aviso('Amigo invisible: sorteo hecho', '<p>' + informe.map(esc).join('<br>') + '</p><p>Las parejas están en Firestore (colección amigo_invisible), por si alguien pregunta. No las mires si quieres jugar 😉</p>');
    }
  }

  // 2. Recordatorio 3 días antes del cierre a quien va a distancia y no ha subido
  const tresAntes = new Date(new Date(C.subirHasta + 'T12:00:00Z').getTime() - 3 * 864e5).toISOString().slice(0, 10);
  if (hoy === tresAntes) {
    for (const p of todos.filter((x) => x.modalidadFinal === 'distancia' && !x.foto && !x.recordado)) {
      const html = tarjeta({ titulo: 'Te quedan 3 días', nombre: p.nombre, intro: ['Te quedan 3 días para subir la foto de tu amigo invisible.'], filas: [], calendario: null,
        boton: { url: A.WEB + '?t=' + p.token, texto: '📤 Subir mi foto', antes: '' }, cuerpo: [] });
      await enviar({ para: p.email, asunto: '⏳ Tu amigo invisible te espera', html, texto: aTexto(html) }).catch(() => {});
      await p.ref.update({ recordado: true });
    }
  }

  // 3. Entrega a distancia
  if (hoy >= C.entrega) {
    const faltan = [];
    for (const de of todos.filter((x) => x.modalidadFinal === 'distancia' && x.regalaA && !x.entregada)) {
      const para = todos.find((x) => x.email === de.regalaA);
      if (!de.foto) { faltan.push(de); continue; }
      await enviar(correoEntrega(para, de)).then(() => de.ref.update({ entregada: FieldValue.serverTimestamp() })).catch(() => {});
    }
    if (faltan.length && !todos.some((x) => x.avisoFaltan)) {
      await aviso('Amigo invisible: faltan fotos por subir', '<p>No han subido su foto: ' + faltan.map((p) => esc(p.nombre + ' <' + p.email + '>')).join(', ') + '. En cuanto la suban, se entrega sola al día siguiente.</p>');
      await faltan[0].ref.update({ avisoFaltan: true });
    }
  }
  console.log('amigo invisible', informe.join(' | ') || 'nada');
  return { statusCode: 200, body: 'ok' };
};
