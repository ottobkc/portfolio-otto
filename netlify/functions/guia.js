// Guía gratuita «10 ejercicios para volver a disfrutar haciendo fotos» a cambio del correo.
//  POST { email, nombre?, avisos: bool, origen?, tipo?: 'poses' } -> { ok }
// tipo 'poses': guía de poses de Otto Kols (ottokols.es), en su propia lista «suscriptores_ok».
// Guarda la suscripción en Firestore (colección «suscriptores», id = email) y manda el correo con el enlace al PDF.
// «avisos» es el consentimiento aparte para recibir novedades (salidas y talleres); sin él solo se manda la guía.
const { db, FieldValue } = require('../lib/firestore');
const { enviar, esc, remitente } = require('../lib/correo');
const { tarjeta, aTexto } = require('../lib/plantillas-salida');
const { urlBaja } = require('../lib/avisos');

const PDF = 'https://mirardespacio.es/descargas/10-ejercicios-mirar-despacio-k7q2.pdf';
const ORIGENES = /^https:\/\/((www\.)?mirardespacio\.es|([a-z0-9-]+--)?mirar-despacio\.netlify\.app|(www\.)?ottokols\.es|([a-z0-9-]+--)?stalwart-panda-3d94db\.netlify\.app)$/;
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
    cuerpo: ['Si quieres hacerlos acompañado, en las <a href="https://mirardespacio.es/salidas/?utm_source=email&utm_campaign=guia" style="color:#1a1814;">salidas de Mirar Despacio</a> salimos a la calle con retos parecidos.', pie],
  });
  return { para: email, asunto: 'Tu guía: 10 ejercicios para volver a disfrutar haciendo fotos', html, texto: aTexto(html) };
}

// ---- Guía de poses de Otto Kols (ottokols.es): otra lista, otra marca, otro consentimiento ----
const PDF_POSES = 'https://ottokols.es/descargas/guia-poses-otto-kols-r4m8.pdf';
function correoPoses(email, nombre, avisos) {
  const pie = avisos
    ? `Te escribiré de vez en cuando con sesiones y huecos libres. ¿Prefieres que no? <a href="${urlBaja(email, 'novedades-ok')}" style="color:#6f6c64;">Date de baja aquí</a>.`
    : 'Solo te escribo para mandarte la guía: no te apunto a nada más.';
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#edece7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#edece7;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:6px;">
<tr><td style="padding:34px 32px 8px;font:15px/1.6 'Helvetica Neue',Arial,sans-serif;color:#151412;">
<p style="margin:0 0 6px;font:13px/1 'Courier New',monospace;letter-spacing:2px;color:#e8821a;text-transform:uppercase;">Otto Kols · fotografía</p>
<h1 style="margin:0 0 18px;font:400 28px/1.2 Georgia,serif;">${nombre ? 'Hola, ' + esc(nombre) + '.' : 'Aquí la tienes.'}</h1>
<p style="margin:0 0 14px;">Te dejo la guía de poses. No hace falta aprenderla de memoria: échale un ojo antes de una sesión y quédate con dos o tres ideas que te encajen.</p>
<p style="margin:0 0 24px;">El truco de casi todas es el mismo: moverse un poco, no quedarse quieto posando. Las mejores fotos salen entre pose y pose.</p>
<p style="margin:0 0 28px;"><a href="${PDF_POSES}" style="display:inline-block;background:#151412;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:4px;font-weight:600;">📄 Descargar la guía de poses (PDF)</a></p>
<p style="margin:0 0 14px;">Y si te apetece ponerla en práctica conmigo, aquí tienes las <a href="https://ottokols.es/retrato/?utm_source=email&utm_campaign=guia-poses" style="color:#151412;">sesiones de retrato</a>, de <a href="https://ottokols.es/parejas/?utm_source=email&utm_campaign=guia-poses" style="color:#151412;">pareja</a> y <a href="https://ottokols.es/mascotas/?utm_source=email&utm_campaign=guia-poses" style="color:#151412;">con tu perro</a>.</p>
<p style="margin:0 0 24px;">Otto</p>
</td></tr>
<tr><td style="padding:16px 32px 28px;border-top:1px solid #e3e1da;font:13px/1.5 'Helvetica Neue',Arial,sans-serif;color:#6f6c64;">${pie}<br>Otto Kols · <a href="https://ottokols.es" style="color:#6f6c64;">ottokols.es</a></td></tr>
</table></td></tr></table></body></html>`;
  return { para: email, asunto: 'Tu guía de poses para sesiones de retrato', html, texto: aTexto(html), nombre: 'Otto Kols' };
}

// Aviso a Otto cuando alguien nuevo pide la guía (no en las repeticiones del mismo correo).
function avisoGuia(email, nombre, avisos, origen, poses) {
  const filas = [['Guía', poses ? 'Poses (Otto Kols)' : '10 ejercicios (Mirar Despacio)'], ['Email', email], ['Nombre', nombre || '—'], ['Desde', origen], ['Acepta novedades', avisos ? 'Sí' : 'No (solo se le puede escribir por la guía)']];
  const html = `<!doctype html><html><body style="font:15px/1.5 system-ui,sans-serif;color:#1a1814;">
<table style="border-collapse:collapse;">${filas.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6b655a;">${esc(k)}</td><td style="padding:4px 0;">${esc(v)}</td></tr>`).join('')}</table>
<p><a href="https://ottokols.es/crm/#suscriptores">Ver suscriptores en el CRM</a></p></body></html>`;
  return enviar({ para: process.env.AVISO_A || remitente(), asunto: `${poses ? 'Guía de poses' : 'Guía'}: nuevo suscriptor (${email})`, html, texto: aTexto(html) });
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
  const poses = b.tipo === 'poses';
  const fs = db();
  // Cada marca tiene su lista: «suscriptores» (Mirar Despacio) y «suscriptores_ok» (Otto Kols, guía de poses)
  const ref = fs.collection(poses ? 'suscriptores_ok' : 'suscriptores').doc(email);
  const antes = await ref.get();
  const ultimo = antes.exists && antes.data().guiaEnviadaEn && antes.data().guiaEnviadaEn.toMillis ? antes.data().guiaEnviadaEn.toMillis() : 0;
  if (Date.now() - ultimo < 10 * 60e3) return { statusCode: 200, headers: h, body: '{"ok":true,"repetido":true}' };
  try {
    await enviar(poses ? correoPoses(email, nombre, avisos) : correo(email, nombre, avisos));
  } catch (e) {
    console.error('guia', e.message);
    return { statusCode: 502, headers: h, body: '{"error":"correo"}' };
  }
  const origen = limpio(b.origen, 80) || 'web';
  await ref.set({
    email, ...(nombre ? { nombre } : {}), origen,
    guia: true, guiaEnviadaEn: FieldValue.serverTimestamp(),
    ...(avisos ? { aceptaNovedades: true, consentimientoEn: FieldValue.serverTimestamp() } : {}),
    ...(antes.exists ? {} : { creado: FieldValue.serverTimestamp() }),
  }, { merge: true });
  if (!antes.exists) await avisoGuia(email, nombre, avisos, origen, poses).catch((e) => console.error('aviso guia', e.message));
  return { statusCode: 200, headers: h, body: '{"ok":true}' };
};

exports._correo = correo;
exports._correoPoses = correoPoses;
