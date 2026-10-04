// Enlace de baja de los emails (no hace falta cuenta): ?tipo=retos|novedades&e=email&t=firma[&volver=1]
const { db, FieldValue } = require('../lib/firestore');
const { firmaValida, urlBaja } = require('../lib/avisos');
const { esc } = require('../lib/correo');

const pagina = (titulo, texto, extra = '') => ({
  statusCode: 200,
  headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' },
  body: `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title>
<style>body{margin:0;background:#f5f3ef;font-family:Georgia,serif;color:#1a1814;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px}
main{max-width:460px;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 12px rgba(26,24,20,.08);border-top:6px solid #e8347a}
h1{font-weight:400;font-size:1.6rem;margin:0 0 12px}p{line-height:1.6;color:#4a453d}a{color:#e8347a}</style></head>
<body><main><h1>${titulo}</h1><p>${texto}</p>${extra}<p><a href="https://mirardespacio.es/">mirardespacio.es</a></p></main></body></html>`,
});

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const tipo = q.tipo === 'novedades' ? 'novedades' : 'retos';
  const email = String(q.e || '').toLowerCase();
  if (!email || !firmaValida(email, tipo, q.t)) return pagina('Enlace no válido', 'Este enlace no funciona. Escríbeme a info@mirardespacio.es y te doy de baja a mano.');
  const fs = db();
  const volver = q.volver === '1';
  if (tipo === 'retos') {
    await fs.collection('preferencias').doc(email).set({ sinAvisosRetos: !volver, cambiado: FieldValue.serverTimestamp() }, { merge: true });
  } else {
    const p = await fs.collection('people').where('email', '==', email).get();
    await Promise.all(p.docs.map((d) => d.ref.set({ aceptaNovedades: volver, novedadesBaja: volver ? null : new Date().toISOString() }, { merge: true })));
  }
  const que = tipo === 'retos' ? 'los avisos del reto del mes' : 'las novedades de Mirar Despacio';
  return volver
    ? pagina('Hecho', `Vuelves a recibir ${que} en ${esc(email)}.`)
    : pagina('Hecho', `No te mandaré más ${que} a ${esc(email)}.`, `<p style="font-size:.9rem">¿Te has equivocado? <a href="${urlBaja(email, tipo)}&volver=1">Volver a recibirlos</a>.</p>`);
};
