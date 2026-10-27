// Tienda pública de mirardespacio.es: los productos que Otto tiene "a la venta" o "agotados"
// en el CRM (colección productos). En cuanto creas o cambias un producto en el CRM, aparece aquí.
//  GET -> [{ id, slug, nombre, tipo, descripcion, precio, envio, estado, fotos:[url], variantes:[{nombre, disponible, pocas}], enlacePago }]
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
    const vs = (p.variantes || []).map((v) => ({ nombre: String(v.nombre || ''), disponible: (Number(v.stock) || 0) > 0, pocas: (Number(v.stock) || 0) > 0 && (Number(v.stock) || 0) <= POCAS }));
    const hay = vs.some((v) => v.disponible);
    return {
      id: d.id, slug: p.slug || slugDe(p.nombre), nombre: p.nombre || '', tipo: p.tipo || 'otro', descripcion: p.descripcion || '',
      precio: Number(p.precio) || 0, envio: Number(p.envio) || 0,
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
