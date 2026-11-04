// Ranking del juego del fotógrafo (mirardespacio.es/juego/)
//  GET  -> las 10 mejores puntuaciones (una por usuario de Instagram)
//  POST {nombre, puntos, nivel, segundos} -> guarda la puntuación si es la mejor de ese jugador y
//       devuelve {top, puesto, total, mejor, puestoMejor} (puesto de esta partida entre todos los jugadores)
//  (nombre = un nombre o un @ de Instagram; con @ se enlaza a su perfil)
//  GET ?mes=AAAA-MM -> top 10 de ese mes (concursos). El POST devuelve también topMes, puestoMes… del mes en curso.
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

// Ranking de cada mes (para los concursos): colección ranking-AAAA-MM, mejor marca de cada jugador ese mes.
// El mes lo pone el servidor (hora de Madrid), nunca el navegador.
const mesMadrid = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit' }).format(d).slice(0, 7);
function inicioMesMadrid(mes) {
  const d = new Date(mes + '-01T00:00:00Z');
  const desfase = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Madrid' })) - new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(d.getTime() - desfase);
}
async function topMes(fs, mes) {
  // Sin índice compuesto: se piden de más y los empates se ordenan aquí (gana quien llegó antes)
  const q = await fs.collection('ranking-' + mes).orderBy('puntos', 'desc').limit(30).get();
  const ms = (f) => (f && f.toMillis ? f.toMillis() : Date.now());
  return q.docs.map((d) => d.data()).sort((a, b) => b.puntos - a.puntos || ms(a.fecha) - ms(b.fecha)).slice(0, 10)
    .map((r) => ({ nombre: r.nombre, puntos: r.puntos, nivel: r.nivel }));
}
// La primera vez que se pide un mes, se rellena con las mejores marcas del ranking general conseguidas ese mes
// (las partidas de antes de que existiera el ranking mensual).
async function sembrarMes(fs, mes) {
  const marca = fs.collection('cache').doc('ranking-' + mes);
  if ((await marca.get()).exists) return;
  const q = await fs.collection('ranking').where('fecha', '>=', inicioMesMadrid(mes)).get();
  const col = fs.collection('ranking-' + mes);
  for (const d of q.docs) {
    const r = d.data();
    if (mesMadrid(r.fecha.toDate()) !== mes) continue;
    const ya = await col.doc(d.id).get();
    if (!ya.exists || ya.data().puntos < r.puntos) await col.doc(d.id).set({ nombre: r.nombre, puntos: r.puntos, nivel: r.nivel, fecha: r.fecha });
  }
  await marca.set({ sembrado: FieldValue.serverTimestamp() });
}

async function top(fs) {
  const q = await fs.collection('ranking').orderBy('puntos', 'desc').limit(10).get();
  return q.docs.map((d) => ({ nombre: d.data().nombre || d.data().ig, puntos: d.data().puntos, nivel: d.data().nivel }));
}

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
    const mesPedido = (event.queryStringParameters || {}).mes;
    if (event.httpMethod === 'GET' && mesPedido) {
      if (!/^20\d\d-(0[1-9]|1[0-2])$/.test(mesPedido)) return { statusCode: 400, headers: h, body: '{"error":"mes"}' };
      if (mesPedido === mesMadrid()) await sembrarMes(fs, mesPedido);
      return { statusCode: 200, headers: { ...h, 'Cache-Control': 'public, max-age=30' }, body: JSON.stringify(await topMes(fs, mesPedido)) };
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
    if (puntos === 0) return { statusCode: 200, headers: h, body: JSON.stringify({ top: await top(fs), puesto: null, monturas }) };
    const ref = fs.collection('ranking').doc(clave);
    const actual = await ref.get();
    const anterior = actual.exists ? actual.data().puntos : 0;
    if (puntos > anterior) {
      await ref.set({ nombre, puntos, nivel, segundos: Math.round(segundos), fecha: FieldValue.serverTimestamp() });
    }
    // Ranking del mes
    const mes = mesMadrid();
    await sembrarMes(fs, mes);
    const colMes = fs.collection('ranking-' + mes);
    const refMes = colMes.doc(clave);
    const actualMes = await refMes.get();
    const anteriorMes = actualMes.exists ? actualMes.data().puntos : 0;
    if (puntos > anteriorMes) await refMes.set({ nombre, puntos, nivel, fecha: FieldValue.serverTimestamp() });
    const mejorMes = Math.max(puntos, anteriorMes);

    const col = fs.collection('ranking');
    const porEncima = async (c, p) => (await c.where('puntos', '>', p).count().get()).data().count;
    const mejor = Math.max(puntos, anterior);
    const [puesto, puestoMejor, total, lista, puestoMes, puestoMejorMes, totalMes, listaMes] = await Promise.all([
      porEncima(col, puntos).then((n) => n + 1),
      porEncima(col, mejor).then((n) => n + 1),
      col.count().get().then((r) => r.data().count),
      top(fs),
      porEncima(colMes, puntos).then((n) => n + 1),
      porEncima(colMes, mejorMes).then((n) => n + 1),
      colMes.count().get().then((r) => r.data().count),
      topMes(fs, mes),
    ]);
    return { statusCode: 200, headers: h, body: JSON.stringify({
      top: lista, puesto, total: Math.max(total, puesto), mejor, puestoMejor, monturas,
      mes, topMes: listaMes, puestoMes, puestoMejorMes, totalMes: Math.max(totalMes, puestoMes), mejorMes,
    }) };
  } catch (e) {
    console.error('ranking', e);
    return { statusCode: 500, headers: h, body: '{"error":"servidor"}' };
  }
};
