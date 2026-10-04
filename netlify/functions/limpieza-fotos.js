// Limpieza semanal de fotos en Cloudinary (se programa en netlify.toml).
// Borra la IMAGEN de Cloudinary pero deja la ficha en Firestore marcada como archivada,
// así se conservan el comentario, los retos hechos y las rachas.
//  - Fotos de salidas: SALIDA_DIAS días después de la salida
//  - Fotos de retos: las de retos más antiguos que los RETOS_GUARDADOS últimos cerrados
//  - Nunca: las que están en el muro público
// Necesita en Netlify: CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET (secretas). Sin ellas no borra nada.
// Con ?prueba=1 solo cuenta lo que borraría (útil con "netlify functions:invoke" en local).
const { db, FieldValue } = require('../lib/firestore');
const { enviar, remitente } = require('../lib/correo');
const { SALIDA_DIAS, RETOS_GUARDADOS } = require('../lib/fotos-config');

const CLOUD = 'dybxateci';
const hoy = () => new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).slice(0, 10);
const publicId = (url) => {
  const m = String(url || '').match(/\/image\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i);
  return m ? decodeURIComponent(m[1]) : null;
};

async function borrarEnCloudinary(ids) {
  const { CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
  const auth = 'Basic ' + Buffer.from(key + ':' + secret).toString('base64');
  const hechos = new Set();
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100);
    const qs = lote.map((x) => 'public_ids[]=' + encodeURIComponent(x)).join('&');
    const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/resources/image/upload?${qs}`, { method: 'DELETE', headers: { Authorization: auth } });
    if (!r.ok) throw new Error('cloudinary ' + r.status);
    const j = await r.json();
    Object.entries(j.deleted || {}).forEach(([id, estado]) => { if (estado === 'deleted' || estado === 'not_found') hechos.add(id); });
  }
  return hechos;
}

exports.handler = async (event) => {
  const prueba = !!(event && event.queryStringParameters && event.queryStringParameters.prueba);
  const fs = db();
  const retos = (await fs.collection('retos').get()).docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(b.inicio || '').localeCompare(String(a.inicio || '')));
  const abierto = (r) => r.activo && (!r.cierre || r.cierre >= hoy());
  const guardar = new Set([
    ...retos.filter(abierto).map((r) => r.id),
    ...retos.filter((r) => r.inicio && r.inicio <= hoy() && !abierto(r)).slice(0, RETOS_GUARDADOS).map((r) => r.id),
  ]);
  const limite = new Date(Date.now() - SALIDA_DIAS * 864e5).toISOString().slice(0, 10);

  const fotos = (await fs.collection('fotos').get()).docs.map((d) => ({ ...d.data(), id: d.id, ref: d.ref }));
  const candidatas = fotos.filter((f) => f.url && !f.archivada && !f.enMuro && (
    f.tipo === 'reto' ? !guardar.has(f.refId)
      : (f.refFecha || (f.creada && f.creada.toDate ? f.creada.toDate().toISOString().slice(0, 10) : hoy())) < limite));

  const resumen = { candidatas: candidatas.length, archivadas: 0, prueba };
  if (prueba || !candidatas.length) return { statusCode: 200, body: JSON.stringify(resumen) };
  if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.warn('limpieza-fotos: faltan CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET, no se borra nada');
    return { statusCode: 200, body: JSON.stringify({ ...resumen, error: 'sin-credenciales' }) };
  }

  const porId = new Map(candidatas.map((f) => [publicId(f.url), f]).filter(([id]) => id));
  const borradas = await borrarEnCloudinary(Array.from(porId.keys()));
  const batch = fs.batch();
  borradas.forEach((id) => {
    const f = porId.get(id);
    if (f) { batch.update(f.ref, { archivada: true, url: null, urlArchivada: f.url, archivadaEn: FieldValue.serverTimestamp() }); resumen.archivadas++; }
  });
  await batch.commit();

  const para = process.env.AVISO_A || remitente();
  if (para && resumen.archivadas) {
    await enviar({ para, asunto: `🧹 Limpieza de fotos: ${resumen.archivadas} archivadas`,
      texto: `Se han borrado de Cloudinary ${resumen.archivadas} fotos antiguas (salidas de hace más de ${SALIDA_DIAS} días y retos anteriores a los ${RETOS_GUARDADOS} últimos). Las del muro no se tocan. Los comentarios y los retos hechos se conservan.`,
      html: `<p>Se han borrado de Cloudinary <strong>${resumen.archivadas}</strong> fotos antiguas (salidas de hace más de ${SALIDA_DIAS} días y retos anteriores a los ${RETOS_GUARDADOS} últimos).</p><p>Las del muro no se tocan. Los comentarios y los retos hechos se conservan.</p>` }).catch(() => {});
  }
  return { statusCode: 200, body: JSON.stringify(resumen) };
};
