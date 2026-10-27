// Tienda pública de mirardespacio.es: los productos que Otto tiene "a la venta" o "agotados"
// en el CRM (colección productos). En cuanto creas o cambias un producto en el CRM, aparece aquí.
//  GET -> [{ id, slug, nombre, tipo, descripcion, precio, precioMax, envio, estado, bajoPedido, plazo, fotos:[url],
//           variantes:[{nombre, disponible, pocas, precio, envio}], enlacePago }]
//  · precio es el más bajo de sus variantes ("desde"); precioMax, el más alto (iguales si no cambian).
//  · bajoPedido: no tiene stock y nunca se agota (todas sus variantes están disponibles).
// mirardespacio.es/api/tienda apunta aquí (mismo origen para la web). No se publica el stock exacto.
const { db } = require('../lib/firestore');

const ORIGENES = /^https:\/\/((www\.)?mirardespacio\.es|([a-z0-9-]+--)?mirar-despacio\.netlify\.app|(www\.)?ottokols\.es)$/;
const POCAS = 3;
// Dirección del producto: la que guarda el CRM, o la que sale del nombre
const slugDe = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'producto';
let cache = null;

async function productos() {
  if (cache && Date.now() - cache.t < 60e3) return cache.l;
  const snap = await db().collection('productos').where('estado', 'in', ['venta', 'agotado']).get();
  const lista = snap.docs.map((d) => {
    const p = d.data();
    const bajo = !!p.bajoPedido;
    const base = Number(p.precio) || 0, envioBase = Number(p.envio) || 0;
    const tiene = (x) => x != null && x !== '' && isFinite(Number(x));
    let vs = (p.variantes || []).map((v) => {
      const st = Number(v.stock) || 0;
      return {
        nombre: String(v.nombre || ''), disponible: bajo || st > 0, pocas: !bajo && st > 0 && st <= POCAS,
        precio: tiene(v.precio) && Number(v.precio) > 0 ? Number(v.precio) : base,
        envio: tiene(v.envio) ? Number(v.envio) : envioBase,
      };
    });
    if (!vs.length) vs = [{ nombre: '', disponible: bajo, pocas: false, precio: base, envio: envioBase }];
    const hay = vs.some((v) => v.disponible);
    const ps = vs.map((v) => v.precio).filter((n) => n > 0);
    return {
      id: d.id, slug: p.slug || slugDe(p.nombre), nombre: p.nombre || '', tipo: p.tipo || 'otro', descripcion: p.descripcion || '',
      precio: ps.length ? Math.min(...ps) : base, precioMax: ps.length ? Math.max(...ps) : base, envio: envioBase,
      bajoPedido: bajo, plazo: bajo ? String(p.plazo || '').slice(0, 160) : '',
      estado: p.estado === 'venta' && hay ? 'venta' : 'agotado',
      fotos: (p.fotos || []).map((f) => f.url).filter(Boolean),
      variantes: vs, enlacePago: /^https:\/\//.test(p.enlacePago || '') ? p.enlacePago : '',
      creado: p.creado && p.creado.toMillis ? p.creado.toMillis() : 0,
    };
  }).sort((a, b) => (a.estado === 'venta' ? 0 : 1) - (b.estado === 'venta' ? 0 : 1) || b.creado - a.creado);
  cache = { t: Date.now(), l: lista };
  return lista;
}

exports.handler = async (event) => {
  const o = event.headers.origin || '';
  const cab = { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60', 'Access-Control-Allow-Origin': ORIGENES.test(o) ? o : 'https://mirardespacio.es', Vary: 'Origin' };
  try {
    return { statusCode: 200, headers: cab, body: JSON.stringify(await productos()) };
  } catch (e) {
    console.error('tienda', e.message);
    return { statusCode: 500, headers: cab, body: '[]' };
  }
};
