// Ranking del juego del fotógrafo (mirardespacio.es/juego/)
//  GET  -> las 10 mejores puntuaciones (una por usuario de Instagram)
//  POST {nombre, puntos, nivel, segundos} -> guarda la puntuación si es la mejor de ese jugador y
//       devuelve {top, puesto, total, mejor, puestoMejor} (puesto de esta partida entre todos los jugadores)
//  (nombre = un nombre o un @ de Instagram; con @ se enlaza a su perfil)
// Comprueba que la puntuación sea posible para el tiempo jugado, para frenar trampas fáciles.
// Además apunta a cada jugador en 'jugadores' (partidas jugadas, mejor marca, primera y última vez),
// también si hace 0 puntos, para saber cuánta gente juega. Todo se ve en la pestaña Juego del CRM.
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
    if (!(segundos > 0 && segundos < 7200) || !(puntos >= 0) || puntos % 5 !== 0 ||
        Math.abs(nivel - nivelEsperado) > 1 || puntos > 150 * nivel * segundos) {
      return { statusCode: 400, headers: h, body: '{"error":"puntuacion"}' };
    }

    const clave = nombre.replace(/^@/, '').toLowerCase().replace(/[^\p{L}\p{N}._]+/gu, '_').slice(0, 40);
    // Registro de jugadores (cuenta todas las partidas, aunque sean de 0 puntos)
    const jRef = fs.collection('jugadores').doc(clave);
    const jSnap = await jRef.get();
    const jPrev = jSnap.exists ? jSnap.data() : null;
    await jRef.set({
      nombre, partidas: FieldValue.increment(1), ultimaVez: FieldValue.serverTimestamp(),
      mejor: Math.max(puntos, (jPrev && jPrev.mejor) || 0), nivelMax: Math.max(nivel, (jPrev && jPrev.nivelMax) || 0),
      segundosJugados: FieldValue.increment(Math.round(segundos)),
      ...(jPrev ? {} : { primeraVez: FieldValue.serverTimestamp() }),
    }, { merge: true });
    if (puntos === 0) return { statusCode: 200, headers: h, body: JSON.stringify({ top: await top(fs), puesto: null }) };
    const ref = fs.collection('ranking').doc(clave);
    const actual = await ref.get();
    const anterior = actual.exists ? actual.data().puntos : 0;
    if (puntos > anterior) {
      await ref.set({ nombre, puntos, nivel, segundos: Math.round(segundos), fecha: FieldValue.serverTimestamp() });
    }
    const col = fs.collection('ranking');
    const porEncima = async (p) => (await col.where('puntos', '>', p).count().get()).data().count;
    const mejor = Math.max(puntos, anterior);
    const [puesto, puestoMejor, total, lista] = await Promise.all([
      porEncima(puntos).then((n) => n + 1),
      porEncima(mejor).then((n) => n + 1),
      col.count().get().then((r) => r.data().count),
      top(fs),
    ]);
    return { statusCode: 200, headers: h, body: JSON.stringify({ top: lista, puesto, total: Math.max(total, puesto), mejor, puestoMejor }) };
  } catch (e) {
    console.error('ranking', e);
    return { statusCode: 500, headers: h, body: '{"error":"servidor"}' };
  }
};
