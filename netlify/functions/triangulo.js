// Practica con el triángulo (mirardespacio.es/juegos/triangulo/ y ottokols.es/members/triangulo.html)
//  POST {accion:'jugada', anon, modo, reto, puntos, estrellas}
//       -> apunta la partida. Sin sesión, la persona es un identificador anónimo del navegador;
//          con la sesión de MD+ (Authorization: Bearer <token de Netlify Identity>) va con su nombre.
//  POST {accion:'dia', ajustes:[velocidad, diafragma, iso], dia}   (solo miembros)
//       -> puntúa aquí el reto del día (la misma escena que ve el navegador) y lo mete en el ranking.
//          Solo cuenta el primer disparo del día de cada miembro.
//  POST {accion:'ranking', dia}                                     (solo miembros)
// Todo se ve en la pestaña Juego del CRM.
const crypto = require('crypto');
const N = require('../../MirarDespacio/assets/triangulo-nucleo.js');
const { db, FieldValue } = require('../lib/firestore');
const { permitir } = require('../lib/limite');

const ORIGENES = /^https:\/\/((www\.)?mirardespacio\.es|([a-z0-9-]+--)?mirar-despacio\.netlify\.app|(www\.)?ottokols\.es)$/;
const cab = (o) => ({
  'Access-Control-Allow-Origin': ORIGENES.test(o || '') ? o : 'https://mirardespacio.es',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
  Vary: 'Origin',
});
const MODOS = new Set(['retos', 'azar', 'dia']);
const huella = (email) => crypto.createHash('sha256').update(String(email).toLowerCase()).digest('hex').slice(0, 20);

// Fecha de hoy en Madrid como clave AAAAMMDD (la misma que calcula el navegador)
function claveMadrid(desplazamientoDias = 0) {
  const d = new Date(Date.now() + desplazamientoDias * 864e5);
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(d).filter((x) => x.type !== 'literal').map((x) => [x.type, +x.value]));
  return N.claveDia(p.year, p.month, p.day);
}
// Acepta el día que dice el navegador si es hoy, ayer o mañana en Madrid (por las zonas horarias); si no, hoy
function diaValido(dia) {
  const ok = [claveMadrid(-1), claveMadrid(0), claveMadrid(1)];
  return ok.includes(Number(dia)) ? Number(dia) : ok[1];
}

// Sesión de Firebase (web nueva) o, durante la migración, de Netlify Identity (lib/cuentas.js)
async function miembro(event, context) {
  const u = await require('../lib/cuentas').usuarioDe(event, context);
  if (!u || !u.email) return null;
  return { email: u.email, roles: u.roles, esMiembro: u.plus, meta: { full_name: u.nombre } };
}

// Nombre para el ranking y el CRM: el de su ficha del CRM, si no el de su cuenta, si no el principio del email
async function nombreDe(fs, m) {
  try {
    const q = await fs.collection('people').where('email', '==', m.email).limit(1).get();
    if (!q.empty) {
      const p = q.docs[0].data();
      const n = [p.name, p.apellidos ? p.apellidos.split(' ')[0] : ''].filter(Boolean).join(' ');
      if (n) return n;
    }
  } catch (e) { console.warn('nombre:', e.message); }
  return m.meta.full_name || m.email.split('@')[0];
}

async function ranking(fs, dia, yoClave) {
  const q = await fs.collection('triangulo_ranking').where('dia', '==', dia).get();
  const lista = q.docs.map((d) => d.data())
    .sort((a, b) => b.puntos - a.puntos || ((a.en && a.en.toMillis ? a.en.toMillis() : 0) - (b.en && b.en.toMillis ? b.en.toMillis() : 0)));
  const i = lista.findIndex((x) => x.clave === yoClave);
  return {
    dia,
    top: lista.slice(0, 20).map((x) => ({ nombre: x.nombre, puntos: x.puntos, yo: x.clave === yoClave })),
    puesto: i >= 0 ? i + 1 : null,
    total: lista.length,
  };
}

exports.handler = async (event, context) => {
  const h = cab(event.headers.origin);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: h, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: h, body: '{}' };
  const res = (code, obj) => ({ statusCode: code, headers: h, body: JSON.stringify(obj) });

  let b;
  try { b = JSON.parse(event.body || '{}'); } catch (e) { return res(400, { error: 'datos' }); }
  const m = await miembro(event, context).catch(() => null);

  try {
    const fs = db();

    if (b.accion === 'jugada') {
      if (!(await permitir(fs, event, 'triangulo', 300))) return res(429, { error: 'demasiadas' });
      const modo = String(b.modo || '');
      const reto = String(b.reto || '');
      const puntos = Math.round(Number(b.puntos));
      if (!MODOS.has(modo) || !/^(l\d{1,2}|azar|dia)$/.test(reto) || !(puntos >= 0 && puntos <= 100)) return res(400, { error: 'datos' });
      const anon = String(b.anon || '');
      let clave, datos;
      if (m && m.esMiembro) {
        clave = 'm_' + huella(m.email);
        datos = { miembro: true, email: m.email, nombre: await nombreDe(fs, m) };
      } else {
        if (!/^[a-z0-9]{20}$/.test(anon)) return res(400, { error: 'datos' });
        clave = 'a_' + anon;
        datos = { miembro: false };
      }
      const ref = fs.collection('triangulo_jugadores').doc(clave);
      await fs.runTransaction(async (tx) => {
        const s = await tx.get(ref);
        const prev = s.exists ? s.data() : {};
        const mejor = Object.assign({}, prev.mejor || {});
        if (reto !== 'azar' && reto !== 'dia') mejor[reto] = Math.max(mejor[reto] || 0, puntos);
        const nuevo = {
          ...datos,
          partidas: (prev.partidas || 0) + 1,
          modos: { ...(prev.modos || {}), [modo]: ((prev.modos || {})[modo] || 0) + 1 },
          mejor,
          ultimaVez: FieldValue.serverTimestamp(),
          web: m && m.esMiembro ? 'md+' : 'publica',
        };
        if (!s.exists) nuevo.primeraVez = FieldValue.serverTimestamp();
        if (modo === 'dia') nuevo.diasDelReto = (prev.diasDelReto || 0) + 1;
        tx.set(ref, nuevo, { merge: true });
      });
      const hoy = String(claveMadrid(0));
      await fs.collection('triangulo_dias').doc(hoy).set({
        dia: hoy, disparos: FieldValue.increment(1), jugadores: FieldValue.arrayUnion(clave),
        porModo: { [modo]: FieldValue.increment(1) },
      }, { merge: true });
      return res(200, { ok: true });
    }

    // Lo que sigue es solo para miembros de MD+
    if (!m) return res(401, { error: 'sesion' });
    if (!m.esMiembro) return res(403, { error: 'solo-miembros' });
    const yo = 'm_' + huella(m.email);

    if (b.accion === 'ranking') {
      return res(200, await ranking(fs, diaValido(b.dia), yo));
    }

    if (b.accion === 'dia') {
      const dia = diaValido(b.dia);
      const a = Array.isArray(b.ajustes) ? b.ajustes.map(Number) : [];
      const fecha = String(dia);
      const etiqueta = new Date(`${fecha.slice(0, 4)}-${fecha.slice(4, 6)}-${fecha.slice(6, 8)}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' });
      const L = N.retoDelDia(dia, etiqueta);
      const [si, ai, ii] = a;
      const valido = a.length === 3 && a.every(Number.isInteger) &&
        si >= 0 && si <= N.shMax(L) && ai >= L.apMin && ai < N.AP.length && ii >= 0 && ii <= L.isoMax;
      if (!valido) return res(400, { error: 'ajustes' });
      const puntos = N.score(L, N.calc(L, si, ai, ii)).total;
      const ref = fs.collection('triangulo_ranking').doc(`${dia}_${yo}`);
      let repetido = false, puntosGuardados = null;
      const nombre = await nombreDe(fs, m);
      await fs.runTransaction(async (tx) => {
        const s = await tx.get(ref);
        if (s.exists) { repetido = true; puntosGuardados = s.data().puntos; return; }
        tx.set(ref, { dia, clave: yo, email: m.email, nombre, puntos, ajustes: [si, ai, ii], en: FieldValue.serverTimestamp() });
      });
      return res(200, { ...(await ranking(fs, dia, yo)), puntos: repetido ? puntosGuardados : puntos, repetido });
    }

    return res(400, { error: 'accion' });
  } catch (e) {
    console.error('triangulo', e);
    return res(500, { error: 'servidor' });
  }
};
