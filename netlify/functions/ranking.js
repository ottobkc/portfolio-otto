// Ranking del juego del fotógrafo (mirardespacio.es/juego/)
//  GET  -> las 10 mejores puntuaciones (una por usuario de Instagram)
//  POST {ig, puntos, nivel, segundos} -> guarda la puntuación si es la mejor de ese usuario
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
  return q.docs.map((d) => ({ ig: d.data().ig, puntos: d.data().puntos, nivel: d.data().nivel }));
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
    const ig = String(b.ig || '').trim().replace(/^@+/, '');
    const puntos = Math.floor(Number(b.puntos));
    const nivel = Math.floor(Number(b.nivel));
    const segundos = Number(b.segundos);
    if (!/^[A-Za-z0-9._]{1,30}$/.test(ig)) return { statusCode: 400, headers: h, body: '{"error":"usuario"}' };
    // ¿Es posible esa puntuación? Nivel según el tiempo, puntos múltiplos de 5 y con un máximo por segundo.
    const nivelEsperado = 1 + Math.floor(segundos / 15);
    if (!(segundos > 0 && segundos < 7200) || !(puntos > 0) || puntos % 5 !== 0 ||
        Math.abs(nivel - nivelEsperado) > 1 || puntos > 150 * nivel * segundos) {
      return { statusCode: 400, headers: h, body: '{"error":"puntuacion"}' };
    }

    const ref = fs.collection('ranking').doc(ig.toLowerCase());
    const actual = await ref.get();
    if (!actual.exists || actual.data().puntos < puntos) {
      await ref.set({ ig: '@' + ig, puntos, nivel, segundos: Math.round(segundos), fecha: FieldValue.serverTimestamp() });
    }
    return { statusCode: 200, headers: h, body: JSON.stringify(await top(fs)) };
  } catch (e) {
    console.error('ranking', e);
    return { statusCode: 500, headers: h, body: '{"error":"servidor"}' };
  }
};
