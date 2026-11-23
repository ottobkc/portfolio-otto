// Amigo invisible fotográfico (ver lib/amigo.js).
//  GET                     -> { abierto, config, apuntados }
//  POST {accion:'apuntarse', nombre, email, pista, modalidad:'presencial'|'distancia', acepta, web}
//  GET  ?t=<token>         -> { nombre, para: {nombre, pista}, modalidad, subirHasta, foto }  (después del sorteo)
//  POST {accion:'subir', t, url, ancho, alto}  -> a distancia: guarda la foto para su amigo
const crypto = require('crypto');
const { db, FieldValue } = require('../lib/firestore');
const { enviar, esc, remitente } = require('../lib/correo');
const { tarjeta, aTexto } = require('../lib/plantillas-salida');
const A = require('../lib/amigo');

const ORIGENES = /^https:\/\/((www\.)?mirardespacio\.es|([a-z0-9-]+--)?mirar-despacio\.netlify\.app)$/;
const cab = (o) => ({
  'Access-Control-Allow-Origin': ORIGENES.test(o || '') ? o : 'https://mirardespacio.es',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin',
});
const limpio = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const res = (h, code, obj) => ({ statusCode: code, headers: h, body: JSON.stringify(obj) });

function correoApuntado(p) {
  const C = A.CONFIG;
  const html = tarjeta({
    titulo: 'Estás en el amigo invisible', nombre: p.nombre,
    intro: ['¡Ya estás dentro del amigo invisible fotográfico de Mirar Despacio!',
      `El ${esc(A.fechaBonita(C.sorteo))} hacemos el sorteo y te escribo para decirte a quién le haces la foto y cuál es su pista.`],
    filas: [['🎲', `Tu pista para quien te regale: <strong>«${esc(p.pista)}»</strong>`],
      ['📍', p.modalidad === 'presencial' ? `Presencial: llevarás tu foto impresa (13×18 o 15×20) a la salida de Navidad${C.salida ? ' del ' + esc(C.salida) : ' (fecha por anunciar)'}.` : `A distancia: subirás tu foto desde tu enlace y el ${esc(A.fechaBonita(C.entrega))} te llegará la que te han hecho a ti.`]],
    calendario: null, boton: null,
    cuerpo: ['¿Quieres cambiar algo o borrarte? Responde a este correo.'],
  });
  return { para: p.email, asunto: 'Estás en el amigo invisible de Mirar Despacio 🎁', html, texto: aTexto(html) };
}

exports.handler = async (event) => {
  const h = cab((event.headers || {}).origin);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: h, body: '' };
  const fs = db(), col = fs.collection(A.COLECCION), q = event.queryStringParameters || {};
  const abierto = A.hoy() <= A.CONFIG.apuntarseHasta;

  if (event.httpMethod === 'GET' && q.t) {
    const s = await col.where('token', '==', String(q.t).slice(0, 64)).limit(1).get();
    if (s.empty) return res(h, 404, { error: 'enlace' });
    const yo = s.docs[0].data();
    if (!yo.regalaA) return res(h, 200, { nombre: yo.nombre, sorteado: false });
    const otro = (await col.doc(yo.regalaA).get()).data() || {};
    return res(h, 200, { nombre: yo.nombre, sorteado: true, modalidad: yo.modalidadFinal, para: { nombre: otro.nombre, pista: otro.pista },
      subirHasta: A.CONFIG.subirHasta, cerrado: A.hoy() > A.CONFIG.subirHasta, foto: yo.foto ? yo.foto.url : null });
  }
  if (event.httpMethod === 'GET') {
    const n = (await col.count().get()).data().count;
    return res(h, 200, { abierto, config: A.CONFIG, apuntados: n });
  }
  if (event.httpMethod !== 'POST') return res(h, 405, { error: 'metodo' });
  let b; try { b = JSON.parse(event.body || '{}'); } catch { b = {}; }

  if (b.accion === 'subir') {
    const s = await col.where('token', '==', limpio(b.t, 64)).limit(1).get();
    if (s.empty) return res(h, 404, { error: 'enlace' });
    const ref = s.docs[0].ref, yo = s.docs[0].data();
    if (!yo.regalaA || yo.modalidadFinal !== 'distancia') return res(h, 400, { error: 'modalidad' });
    if (A.hoy() > A.CONFIG.subirHasta) return res(h, 400, { error: 'cerrado' });
    const url = String(b.url || '');
    if (!/^https:\/\/res\.cloudinary\.com\/dybxateci\/image\/upload\//.test(url)) return res(h, 400, { error: 'url' });
    await ref.update({ foto: { url, ancho: Number(b.ancho) || null, alto: Number(b.alto) || null, subida: new Date().toISOString() } });
    return res(h, 200, { ok: true });
  }

  if (b.accion !== 'apuntarse') return res(h, 400, { error: 'accion' });
  if (b.web) return res(h, 200, { ok: true });
  if (!abierto) return res(h, 400, { error: 'cerrado' });
  const email = limpio(b.email, 120).toLowerCase(), nombre = limpio(b.nombre, 60), pista = limpio(b.pista, 80);
  const modalidad = b.modalidad === 'presencial' ? 'presencial' : 'distancia';
  if (!emailValido(email)) return res(h, 400, { error: 'email' });
  if (!nombre || !pista) return res(h, 400, { error: 'faltan' });
  if (b.acepta !== true) return res(h, 400, { error: 'acepta' });
  const ref = col.doc(email), antes = await ref.get();
  await ref.set({ email, nombre, pista, modalidad, token: antes.exists ? antes.data().token : crypto.randomBytes(16).toString('hex'),
    ...(antes.exists ? { cambiado: FieldValue.serverTimestamp() } : { creado: FieldValue.serverTimestamp() }) }, { merge: true });
  const p = { email, nombre, pista, modalidad };
  await enviar(correoApuntado(p)).catch((e) => console.error('amigo correo', e.message));
  if (!antes.exists) {
    const n = (await col.count().get()).data().count;
    const tabla = `<p>${esc(nombre)} &lt;${esc(email)}&gt; · ${modalidad} · pista «${esc(pista)}»</p><p>Ya sois ${n}.</p>`;
    await enviar({ para: process.env.AVISO_A || remitente(), asunto: `Amigo invisible: se apunta ${nombre} (${n})`, html: tabla, texto: aTexto(tabla) }).catch(() => {});
  }
  return res(h, 200, { ok: true, repetido: antes.exists });
};
