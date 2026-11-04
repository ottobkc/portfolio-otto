// Ranking del juego del fotógrafo (mirardespacio.es/juego/)
// Hay dos rankings: el de siempre (colección 'ranking') y uno por mes (rankingMensual/AAAA-MM/jugadores),
// que empieza de cero el día 1 a las 00:00 hora de Madrid. Sirve para concursos del tipo «el mejor de noviembre».
//  GET  -> las 10 mejores puntuaciones de siempre (una por usuario de Instagram)
//  GET ?vista=ambos -> {global, mes, mesClave}: el top 10 de siempre y el del mes en curso
//  POST {nombre, puntos, nivel, segundos} -> guarda la puntuación si es la mejor de ese jugador y
//       devuelve {top, puesto, total, mejor, puestoMejor} (puesto de esta partida entre todos los jugadores)
//  (nombre = un nombre o un @ de Instagram; con @ se enlaza a su perfil)
// Comprueba que la puntuación sea posible para el tiempo jugado, para frenar trampas fáciles.
// Además apunta a cada jugador en 'jugadores' (partidas jugadas, mejor marca, primera y última vez),
// también si hace 0 puntos, para saber cuánta gente juega. Todo se ve en la pestaña Juego del CRM.
const { db, FieldValue } = require('../lib/firestore');

// Monturas que existen (las mismas que PortfolioOtto/js/monturas.js). Se guardan por jugador para que
// las vea juegue donde juegue, y en la zona MD+ si enlaza su nombre de jugador.
const MONTURAS = ['trex', 'ovni', 'conejo', 'cerdo', 'caballo', 'unicornio', 'camello', 'elefante', 'avestruz', 'tortuga',
  'caracol', 'pato', 'vaca', 'patinete', 'monopatin', 'carrito', 'alfombra', 'nube', 'escoba', 'cohete'];
const claveDe = (nombre) => String(nombre || '').trim().replace(/^@+/, '').toLowerCase().replace(/[^\p{L}\p{N}._]+/gu, '_').slice(0, 40);

const ORIGENES = /^https:\/\/((www\.)?mirardespacio\.es|([a-z0-9-]+--)?mirar-despacio\.netlify\.app)$/;
const cab = (o) => ({
  'Access-Control-Allow-Origin': ORIGENES.test(o || '') ? o : 'https://mirardespacio.es',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
  Vary: 'Origin',
});

// Mes en curso en hora de Madrid, p. ej. '2026-11'
function mesActual() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return p.find((x) => x.type === 'year').value + '-' + p.find((x) => x.type === 'month').value;
}
const colMes = (fs, mes) => fs.collection('rankingMensual').doc(mes).collection('jugadores');

async function topDe(col) {
  const q = await col.orderBy('puntos', 'desc').limit(10).get();
  return q.docs.map((d) => ({ nombre: d.data().nombre || d.data().ig, puntos: d.data().puntos, nivel: d.data().nivel }));
}
const top = (fs) => topDe(fs.collection('ranking'));

exports.handler = async (event) => {
  const h = cab(event.headers.origin);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: h, body: '' };
  try {
    const fs = db();
    // Monturas de un jugador: GET ?jugador=nombre
    if (event.httpMethod === 'GET' && (event.queryStringParameters || {}).jugador) {
      const clave = claveDe(event.queryStringParameters.jugador);
      const snap = clave ? await fs.collection('jugadores').doc(clave).get() : null;
      return { statusCode: 200, headers: { ...h, 'Cache-Control': 'no-store' }, body: JSON.stringify({ monturas: (snap && snap.exists && snap.data().monturas) || [] }) };
    }
    if (event.httpMethod === 'GET' && (event.queryStringParameters || {}).vista === 'ambos') {
      const mes = mesActual();
      const [global, delMes] = await Promise.all([top(fs), topDe(colMes(fs, mes))]);
      return { statusCode: 200, headers: { ...h, 'Cache-Control': 'public, max-age=30' }, body: JSON.stringify({ global, mes: delMes, mesClave: mes }) };
    }
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

    const clave = claveDe(nombre);
    // Monturas de esta partida: solo nombres válidos y como mucho una cada 5 niveles alcanzados
    const nuevas = Array.from(new Set((Array.isArray(b.monturas) ? b.monturas : []).filter((m) => MONTURAS.includes(m)))).slice(0, Math.floor(nivel / 5));
    // Registro de jugadores (cuenta todas las partidas, aunque sean de 0 puntos)
    const jRef = fs.collection('jugadores').doc(clave);
    const jSnap = await jRef.get();
    const jPrev = jSnap.exists ? jSnap.data() : null;
    await jRef.set({
      nombre, partidas: FieldValue.increment(1), ultimaVez: FieldValue.serverTimestamp(),
      mejor: Math.max(puntos, (jPrev && jPrev.mejor) || 0), nivelMax: Math.max(nivel, (jPrev && jPrev.nivelMax) || 0),
      segundosJugados: FieldValue.increment(Math.round(segundos)),
      ...(nuevas.length ? { monturas: FieldValue.arrayUnion(...nuevas) } : {}),
      ...(jPrev ? {} : { primeraVez: FieldValue.serverTimestamp() }),
    }, { merge: true });
    const monturas = Array.from(new Set([...((jPrev && jPrev.monturas) || []), ...nuevas]));
    const mes = mesActual();
    if (puntos === 0) return { statusCode: 200, headers: h, body: JSON.stringify({ top: await top(fs), topMes: await topDe(colMes(fs, mes)), mesClave: mes, puesto: null, monturas }) };
    const ref = fs.collection('ranking').doc(clave);
    const actual = await ref.get();
    const anterior = actual.exists ? actual.data().puntos : 0;
    if (puntos > anterior) {
      await ref.set({ nombre, puntos, nivel, segundos: Math.round(segundos), fecha: FieldValue.serverTimestamp() });
    }
    // Ranking del mes: la mejor marca de este jugador en el mes en curso
    const cMes = colMes(fs, mes);
    const refMes = cMes.doc(clave);
    const actualMes = await refMes.get();
    const anteriorMes = actualMes.exists ? actualMes.data().puntos : 0;
    if (puntos > anteriorMes) {
      if (!actualMes.exists) await fs.collection('rankingMensual').doc(mes).set({ mes }, { merge: true });
      await refMes.set({ nombre, puntos, nivel, segundos: Math.round(segundos), fecha: FieldValue.serverTimestamp() });
    }
    const col = fs.collection('ranking');
    const encima = (c) => async (p) => (await c.where('puntos', '>', p).count().get()).data().count;
    const porEncima = encima(col), porEncimaMes = encima(cMes);
    const mejor = Math.max(puntos, anterior);
    const mejorMes = Math.max(puntos, anteriorMes);
    const [puesto, puestoMejor, total, lista, puestoMes, puestoMejorMes, totalMes, listaMes] = await Promise.all([
      porEncima(puntos).then((n) => n + 1),
      porEncima(mejor).then((n) => n + 1),
      col.count().get().then((r) => r.data().count),
      top(fs),
      porEncimaMes(puntos).then((n) => n + 1),
      porEncimaMes(mejorMes).then((n) => n + 1),
      cMes.count().get().then((r) => r.data().count),
      topDe(cMes),
    ]);
    return { statusCode: 200, headers: h, body: JSON.stringify({
      top: lista, puesto, total: Math.max(total, puesto), mejor, puestoMejor, monturas,
      topMes: listaMes, puestoMes, totalMes: Math.max(totalMes, puestoMes), mejorMes, puestoMejorMes, mesClave: mes,
    }) };
  } catch (e) {
    console.error('ranking', e);
    return { statusCode: 500, headers: h, body: '{"error":"servidor"}' };
  }
};
