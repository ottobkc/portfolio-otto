// Guía gratuita «10 ejercicios para volver a disfrutar haciendo fotos» a cambio del correo.
//  POST { email, nombre?, avisos: bool, origen? } -> { ok }
// Guarda la suscripción en Firestore (colección «suscriptores», id = email) y manda el correo con el enlace al PDF.
// «avisos» es el consentimiento aparte para recibir novedades (salidas y talleres); sin él solo se manda la guía.
const { db, FieldValue } = require('../lib/firestore');
const { enviar } = require('../lib/correo');
const { tarjeta, aTexto } = require('../lib/plantillas-salida');
const { urlBaja } = require('../lib/avisos');

const PDF = 'https://mirardespacio.es/descargas/10-ejercicios-mirar-despacio-k7q2.pdf';
const ORIGENES = /^https:\/\/((www\.)?mirardespacio\.es|([a-z0-9-]+--)?mirar-despacio\.netlify\.app)$/;
const cab = (o) => ({
  'Access-Control-Allow-Origin': ORIGENES.test(o || '') ? o : 'https://mirardespacio.es',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin',
});
const limpio = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

function correo(email, nombre, avisos) {
  const pie = avisos
    ? `<span style="font-size:13px;color:#8a8378;">Te escribiré de vez en cuando con salidas y talleres. ¿Prefieres que no? <a href="${urlBaja(email, 'novedades')}" style="color:#8a8378;">Date de baja aquí</a>.</span>`
    : '<span style="font-size:13px;color:#8a8378;">Solo te escribo para mandarte la guía: no te apunto a nada más.</span>';
  const html = tarjeta({
    titulo: 'Tu guía de Mirar Despacio', nombre,
    intro: ['Aquí tienes los 10 ejercicios. No hace falta hacerlos en orden ni con una cámara buena: el móvil vale para todos.',
      'Elige uno, sal a la calle con él y olvídate del resto. La idea es hacer menos fotos y mirar más.'],
    filas: [], calendario: null,
    boton: { url: PDF, texto: '📄 Descargar la guía (PDF)', antes: '' },
    cuerpo: ['Si quieres hacerlos acompañado, en las <a href="https://mirardespacio.es/salidas/?utm_source=email&utm_campaign=guia" style="color:#1a1814;">salidas de Mirar Despacio</a> salimos a la calle con retos parecidos.', 'Un abrazo,<br>Otto', pie],
  });
  return { para: email, asunto: 'Tu guía: 10 ejercicios para volver a disfrutar haciendo fotos', html, texto: aTexto(html) };
}

exports.handler = async (event) => {
  const h = cab((event.headers || {}).origin);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: h, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: h, body: '{"error":"metodo"}' };
  let b; try { b = JSON.parse(event.body || '{}'); } catch { b = {}; }
  if (b.web) return { statusCode: 200, headers: h, body: '{"ok":true}' }; // campo trampa para robots
  const email = limpio(b.email, 120).toLowerCase();
  if (!emailValido(email)) return { statusCode: 400, headers: h, body: '{"error":"email"}' };
  const nombre = limpio(b.nombre, 60);
  const avisos = b.avisos === true;
  const fs = db();
  const ref = fs.collection('suscriptores').doc(email);
  const antes = await ref.get();
  const ultimo = antes.exists && antes.data().guiaEnviadaEn && antes.data().guiaEnviadaEn.toMillis ? antes.data().guiaEnviadaEn.toMillis() : 0;
  if (Date.now() - ultimo < 10 * 60e3) return { statusCode: 200, headers: h, body: '{"ok":true,"repetido":true}' };
  try {
    await enviar(correo(email, nombre, avisos));
  } catch (e) {
    console.error('guia', e.message);
    return { statusCode: 502, headers: h, body: '{"error":"correo"}' };
  }
  await ref.set({
    email, ...(nombre ? { nombre } : {}), origen: limpio(b.origen, 80) || 'web',
    guia: true, guiaEnviadaEn: FieldValue.serverTimestamp(),
    ...(avisos ? { aceptaNovedades: true, consentimientoEn: FieldValue.serverTimestamp() } : {}),
    ...(antes.exists ? {} : { creado: FieldValue.serverTimestamp() }),
  }, { merge: true });
  return { statusCode: 200, headers: h, body: '{"ok":true}' };
};

exports._correo = correo;
