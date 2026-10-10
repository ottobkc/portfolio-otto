// Galerías privadas de clientes (ottokols.es/galeria/).
//
// Dos almacenes, cada uno para lo suyo:
//  - Cloudinary: las VISTAS PREVIAS (JPG ~2000 px) que el cliente ve para elegir. Se suben como
//    "authenticated": no se pueden abrir sin una URL firmada, y la firma incluye la marca de agua,
//    así que nadie puede pedir la foto limpia quitando trozos de la URL.
//  - Cloudflare R2: las fotos FINALES en HD. Se guardan byte a byte tal como salen de Lightroom
//    (sin límite de 10 MB ni recompresión) y se descargan con enlaces temporales.
//
// Variables de entorno en Netlify:
//   CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET   (ya existen para la limpieza de fotos)
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET   (fase de entrega)
//   R2_JURISDICTION = eu  -> el bucket está en la jurisdicción europea (datos garantizados en la UE)
const crypto = require('crypto');

const CLOUD = 'dybxateci';
const CARPETA = 'galerias';
const ESTADOS = ['seleccion', 'enviada', 'entregada'];
const DIAS_ENTREGA = 30; // las HD se pueden descargar 30 días desde la entrega

// ---------- Código de acceso ----------
// Letras sin las que se confunden (I, O) y 4 cifras: "RTKA-4821". Se comparan siempre en mayúsculas.
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
function nuevoCodigo() {
  const b = crypto.randomBytes(8);
  const l = Array.from(b.subarray(0, 4), (x) => LETRAS[x % LETRAS.length]).join('');
  const n = String(b.readUInt32BE(4) % 10000).padStart(4, '0');
  return `${l}-${n}`;
}
const normalCodigo = (c) => String(c || '').trim().toUpperCase().replace(/\s+/g, '').slice(0, 24);
const CODIGO_OK = /^[A-Z0-9-]{6,24}$/;

// ---------- Cloudinary ----------
const sha1 = (s) => crypto.createHash('sha1').update(s).digest();
const secretoCld = () => process.env.CLOUDINARY_API_SECRET || '';
const hayCloudinary = () => !!(process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

// Parámetros firmados para que el navegador de Otto suba directamente a Cloudinary
function firmaSubida(galeriaId) {
  const params = { folder: `${CARPETA}/${galeriaId}`, timestamp: Math.floor(Date.now() / 1000), type: 'authenticated' };
  const cadena = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
  return {
    url: `https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`,
    campos: { ...params, api_key: process.env.CLOUDINARY_API_KEY, signature: sha1(cadena + secretoCld()).toString('hex') },
  };
}

// Marca de agua de texto, centrada y girada. Solo caracteres que no hay que codificar en la URL
// (así la firma no depende de cómo se escapen).
const AGUA = 'l_text:Arial_70_bold:ottokols.es,co_rgb:FFFFFF,o_32,a_-28,fl_relative,w_0.55/fl_layer_apply,g_center';
const TRANSFORMACION = {
  mini: `c_limit,w_640,h_640/${AGUA}/q_auto,f_auto`,
  grande: `c_limit,w_1800,h_1800/${AGUA}/q_auto:good,f_auto`,
  // Miniatura de una foto ya entregada: sin marca de agua (la HD de verdad está en R2)
  final: 'c_limit,w_640,h_640/q_auto,f_auto',
};

// URL firmada de una vista previa (public_id sin extensión + formato)
function urlPrevia(foto, tamano) {
  const tr = TRANSFORMACION[tamano] || TRANSFORMACION.mini;
  const origen = `${foto.id}.${foto.formato || 'jpg'}`;
  const firma = sha1(`${tr}/${origen}${secretoCld()}`).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').slice(0, 8);
  return `https://res.cloudinary.com/${CLOUD}/image/authenticated/s--${firma}--/${tr}/${origen}`;
}

// Borra todas las vistas previas de una galería (por prefijo de carpeta)
async function borrarPrevias(galeriaId) {
  if (!hayCloudinary()) return false;
  const auth = 'Basic ' + Buffer.from(process.env.CLOUDINARY_API_KEY + ':' + secretoCld()).toString('base64');
  const prefijo = encodeURIComponent(`${CARPETA}/${galeriaId}/`);
  // La API borra hasta 1000 por llamada; se repite por si hubiera más
  for (let i = 0; i < 5; i++) {
    const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/resources/image/authenticated?prefix=${prefijo}`, { method: 'DELETE', headers: { Authorization: auth } });
    if (!r.ok) throw new Error('cloudinary ' + r.status);
    const j = await r.json();
    if (!j.partial) break;
  }
  return true;
}

// Borra una o varias vistas previas (hasta 100 por llamada a la API)
async function borrarPrevia(ids) {
  if (!hayCloudinary()) return false;
  const lista = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
  const auth = 'Basic ' + Buffer.from(process.env.CLOUDINARY_API_KEY + ':' + secretoCld()).toString('base64');
  for (let i = 0; i < lista.length; i += 100) {
    const qs = lista.slice(i, i + 100).map((x) => 'public_ids[]=' + encodeURIComponent(x)).join('&');
    const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/resources/image/authenticated?${qs}`, { method: 'DELETE', headers: { Authorization: auth } });
    if (!r.ok) throw new Error('cloudinary ' + r.status);
  }
  return true;
}

// ---------- Cloudflare R2 (API compatible con S3, firma AWS v4 en la URL) ----------
const hayR2 = () => !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);
const hmac = (k, s) => crypto.createHmac('sha256', k).update(s).digest();
const sha256hex = (s) => crypto.createHash('sha256').update(s).digest('hex');
// Codificación RFC 3986 que exige la firma v4
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

// metodo: 'GET' | 'PUT' | 'DELETE'. extra: parámetros de consulta firmados (p. ej. la descarga con nombre).
function urlR2(metodo, clave, segundos = 3600, extra = {}) {
  // Los buckets con jurisdicción (p. ej. UE) tienen su propia dirección: <cuenta>.eu.r2.cloudflarestorage.com
  const jur = String(process.env.R2_JURISDICTION || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  const host = `${process.env.R2_ACCOUNT_ID}${jur ? '.' + jur : ''}.r2.cloudflarestorage.com`;
  const ruta = '/' + [process.env.R2_BUCKET, ...clave.split('/')].map(enc).join('/');
  const ahora = new Date();
  const fecha = ahora.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); // 20261010T120000Z
  const dia = fecha.slice(0, 8);
  const ambito = `${dia}/auto/s3/aws4_request`;
  const q = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${process.env.R2_ACCESS_KEY_ID}/${ambito}`,
    'X-Amz-Date': fecha,
    'X-Amz-Expires': String(segundos),
    'X-Amz-SignedHeaders': 'host',
    ...extra,
  };
  const consulta = Object.keys(q).sort().map((k) => `${enc(k)}=${enc(q[k])}`).join('&');
  const canonica = [metodo, ruta, consulta, `host:${host}`, '', 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const aFirmar = ['AWS4-HMAC-SHA256', fecha, ambito, sha256hex(canonica)].join('\n');
  let k = hmac('AWS4' + process.env.R2_SECRET_ACCESS_KEY, dia);
  k = hmac(k, 'auto'); k = hmac(k, 's3'); k = hmac(k, 'aws4_request');
  const firma = crypto.createHmac('sha256', k).update(aFirmar).digest('hex');
  return `https://${host}${ruta}?${consulta}&X-Amz-Signature=${firma}`;
}

// Enlace de descarga que guarda el archivo con su nombre original
const descargaR2 = (clave, nombre, segundos = 3600) => urlR2('GET', clave, segundos, {
  'response-content-disposition': `attachment; filename="${String(nombre).replace(/[^\w.\- ]+/g, '_')}"`,
});

async function borrarR2(clave) {
  if (!hayR2()) return false;
  const r = await fetch(urlR2('DELETE', clave, 300), { method: 'DELETE' });
  return r.ok || r.status === 404;
}

// ---------- Utilidades ----------
const limpio = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const ms = (t) => (t && t.toMillis ? t.toMillis() : t ? new Date(t).getTime() : 0);
const nombreArchivo = (s) => String(s || '').split(/[\\/]/).pop().replace(/[^\w.\- ]+/g, '_').slice(0, 120);
const sinExtension = (s) => String(s || '').replace(/\.[a-z0-9]{2,5}$/i, '');

module.exports = {
  CLOUD, CARPETA, ESTADOS, DIAS_ENTREGA,
  nuevoCodigo, normalCodigo, CODIGO_OK,
  hayCloudinary, firmaSubida, urlPrevia, borrarPrevias, borrarPrevia,
  hayR2, urlR2, descargaR2, borrarR2,
  limpio, ms, nombreArchivo, sinExtension,
};
