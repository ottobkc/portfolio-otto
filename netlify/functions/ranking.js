// Ranking del juego del fotógrafo (mirardespacio.es/juego/)
//  GET  -> las 10 mejores puntuaciones (una por usuario de Instagram)
//  POST {nombre, puntos, nivel, segundos} -> guarda la puntuación si es la mejor de ese jugador
//  (nombre = un nombre o un @ de Instagram; con @ se enlaza a su perfil)
// Comprueba que la puntuación sea posible para el tiempo jugado, para frenar trampas fáciles.
// Desde el CRM (pestaña Pegatinas) se pueden borrar entradas.
const { db, FieldValue } = require('../lib/firestore');

const ORIGENES = /^https:\/\/((www\.)?mirardespacio\.es|([a-z0-9-]+--)?mirar-despacio\.netlify\.app)$/;
const cab = (o) => ({
  'Access-Control-Allow-Origin': ORIGENES.test(o || '') ? o : 'https://mirardespacio.es',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
  Vary: 'Origin',
});

async function top(fs) {
  const q = await fs.collection('ranking').orderBy('puntos', 'desc').limit(10).get();
  return q.docs.map((d) => ({ nombre: d.data().nombre || d.data().ig, puntos: d.data().puntos, nivel: d.data().nivel }));
}

exports.handler = async (event) => {
  const h = cab(event.headers.origin);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: h, body: '' };
  try {
    const fs = db();
    if (event.httpMethod === 'GET') {
      return { statusCode: 200, headers: { ...h, 'Cache-Control': 'public, max-age=30' }, body: JSON.stringify(await top(fs)) };
    }
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers: h, body: '{}' };

    const b = JSON.parse(event.body || '{}');
    const nombre = String(b.nombre || b.ig || '').trim().replace(/\s+/g, ' ').replace(/^@+/, '@');
    const puntos = Math.floor(Number(b.puntos));
    const nivel = Math.floor(Number(b.nivel));
    const segundos = Number(b.segundos);
    if (!/^@?[\p{L}\p{N}._ ]{2,24}$/u.test(nombre)) return { statusCode: 400, headers: h, body: '{"error":"nombre"}' };
    // ¿Es posible esa puntuación? Nivel según el tiempo, puntos múltiplos de 5 y con un máximo por segundo.
    const nivelEsperado = 1 + Math.floor(segundos / 15);
    if (!(segundos > 0 && segundos < 7200) || !(puntos > 0) || puntos % 5 !== 0 ||
        Math.abs(nivel - nivelEsperado) > 1 || puntos > 150 * nivel * segundos) {
      return { statusCode: 400, headers: h, body: '{"error":"puntuacion"}' };
    }

    const clave = nombre.replace(/^@/, '').toLowerCase().replace(/[^\p{L}\p{N}._]+/gu, '_').slice(0, 40);
    const ref = fs.collection('ranking').doc(clave);
    const actual = await ref.get();
    if (!actual.exists || actual.data().puntos < puntos) {
      await ref.set({ nombre, puntos, nivel, segundos: Math.round(segundos), fecha: FieldValue.serverTimestamp() });
    }
    return { statusCode: 200, headers: h, body: JSON.stringify(await top(fs)) };
  } catch (e) {
    console.error('ranking', e);
    return { statusCode: 500, headers: h, body: '{"error":"servidor"}' };
  }
};
