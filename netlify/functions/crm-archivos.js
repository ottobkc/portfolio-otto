// Archivos de la contabilidad y de la tienda del CRM. Solo Otto: el CRM manda su sesión de Firebase
// (Authorization: Bearer <idToken>) y aquí se comprueba que es la cuenta de administración.
//
// Justificantes de gastos (facturas de compra, tickets): son privados.
//   - Si está configurado Cloudflare R2 (lo mismo que las HD de las galerías) se guardan allí.
//   - Si no, en Cloudinary como "authenticated" (no se pueden abrir sin una URL firmada).
//  {accion:'subir-justificante', nombre, tipo}   -> dónde y cómo subirlo desde el navegador
//  {accion:'ver-justificante', j}                -> enlace temporal (1 hora) para verlo o descargarlo
//  {accion:'borrar-justificante', j}
//
// Fotos de productos de la tienda: son públicas (se verán en la tienda de mirardespacio.es).
//  {accion:'subir-foto-producto', n}             -> n firmas para subir a Cloudinary (carpeta tienda/)
//  {accion:'borrar-foto-producto', id}
const crypto = require('crypto');
const { verificarToken } = require('../lib/sesion-firebase');
const G = require('../lib/galerias');

const ADMIN = (process.env.CRM_ADMIN || 'ottobkc@gmail.com').toLowerCase();
const CLOUD = G.CLOUD;
const res = (code, obj) => ({ statusCode: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(obj) });
const sha1 = (s) => crypto.createHash('sha1').update(s).digest();
const secreto = () => process.env.CLOUDINARY_API_SECRET || '';
const aleatorio = () => crypto.randomBytes(8).toString('hex');

function firmaCloudinary(params) {
  const cadena = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
  return { ...params, api_key: process.env.CLOUDINARY_API_KEY, signature: sha1(cadena + secreto()).toString('hex') };
}

// URL firmada de un archivo "authenticated" de Cloudinary, sin transformaciones
function urlCloudinaryPrivada(j) {
  const tipo = j.recurso === 'raw' ? 'raw' : 'image';
  const origen = tipo === 'raw' ? j.id : `${j.id}.${j.formato || 'jpg'}`;
  const firma = sha1(`${origen}${secreto()}`).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').slice(0, 8);
  return `https://res.cloudinary.com/${CLOUD}/${tipo}/authenticated/s--${firma}--/${origen}`;
}

async function borrarCloudinary(id, tipo, entrega) {
  const auth = 'Basic ' + Buffer.from(process.env.CLOUDINARY_API_KEY + ':' + secreto()).toString('base64');
  const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/resources/${tipo}/${entrega}?public_ids[]=${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: auth } });
  return r.ok;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return res(405, {});
  try {
    const token = (event.headers.authorization || '').replace(/^Bearer\s+/i, '');
    let quien;
    try { quien = await verificarToken(token); } catch (e) { return res(401, { error: 'sesion' }); }
    if ((quien.email || '').toLowerCase() !== ADMIN) return res(403, { error: 'no-admin' });

    const b = JSON.parse(event.body || '{}');
    const anio = new Date().getFullYear();

    if (b.accion === 'subir-justificante') {
      const nombre = G.nombreArchivo(b.nombre) || 'justificante';
      const esPdf = /pdf/i.test(String(b.tipo || '')) || /\.pdf$/i.test(nombre);
      if (G.hayR2()) {
        const clave = `contabilidad/${anio}/${aleatorio()}-${nombre}`;
        return res(200, { almacen: 'r2', clave, nombre, url: G.urlR2('PUT', clave, 3600) });
      }
      if (!G.hayCloudinary()) return res(503, { error: 'sin-almacen' });
      // Los PDF van como "raw": Cloudinary no deja servir PDF como imagen en las cuentas gratuitas
      const recurso = esPdf ? 'raw' : 'image';
      const id = `contabilidad/${anio}/${aleatorio()}${esPdf ? '.pdf' : ''}`;
      const timestamp = Math.floor(Date.now() / 1000);
      return res(200, {
        almacen: 'cloudinary', recurso, nombre,
        url: `https://api.cloudinary.com/v1_1/${CLOUD}/${recurso}/upload`,
        campos: firmaCloudinary({ public_id: id, timestamp, type: 'authenticated' }),
      });
    }

    if (b.accion === 'ver-justificante' || b.accion === 'borrar-justificante') {
      const j = b.j || {};
      if (j.almacen === 'r2') {
        const clave = String(j.clave || '');
        if (!clave.startsWith('contabilidad/')) return res(400, { error: 'clave' });
        if (b.accion === 'borrar-justificante') return res(200, { ok: await G.borrarR2(clave) });
        // Las fotos y PDF se abren en el navegador; con "descargar" se bajan con su nombre
        const url = b.descargar ? G.descargaR2(clave, j.nombre || 'justificante') : G.urlR2('GET', clave, 3600);
        return res(200, { url });
      }
      if (j.almacen === 'cloudinary') {
        const id = String(j.id || '');
        if (!id.startsWith('contabilidad/')) return res(400, { error: 'id' });
        if (b.accion === 'borrar-justificante') return res(200, { ok: await borrarCloudinary(id, j.recurso === 'raw' ? 'raw' : 'image', 'authenticated') });
        return res(200, { url: urlCloudinaryPrivada({ ...j, id }) });
      }
      return res(400, { error: 'almacen' });
    }

    if (b.accion === 'subir-foto-producto') {
      if (!G.hayCloudinary()) return res(503, { error: 'sin-cloudinary' });
      const timestamp = Math.floor(Date.now() / 1000);
      const n = Math.min(12, Math.max(1, Number(b.n) || 1));
      return res(200, {
        url: `https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`,
        firmas: Array.from({ length: n }, () => firmaCloudinary({ public_id: `tienda/${aleatorio()}`, timestamp })),
      });
    }

    if (b.accion === 'borrar-foto-producto') {
      const id = String(b.id || '');
      if (!id.startsWith('tienda/')) return res(400, { error: 'id' });
      return res(200, { ok: await borrarCloudinary(id, 'image', 'upload') });
    }

    return res(400, { error: 'accion' });
  } catch (e) {
    console.error('crm-archivos', e.message);
    return res(500, { error: 'servidor' });
  }
};
