// Cuentas de Firebase Authentication (proyecto mirardespaciocrm) desde las funciones, por la API REST.
// No usamos firebase-admin/auth: depende de «jose», que solo se publica como módulo ES y en Netlify
// falla con ERR_REQUIRE_ESM (502). La credencial es la misma cuenta de servicio de Firestore
// (FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY): firebase-admin/app sí carga bien.
//
// En Firebase → Authentication → Settings tiene que seguir DESACTIVADO «Enable create (sign-up)»:
// así las cuentas solo las crea el servidor (el CRM o un pago) y nadie puede darse de alta solo.
const { getApps } = require('firebase-admin/app');
const { db } = require('./firestore');

const PROYECTO = 'mirardespaciocrm';
const BASE = `https://identitytoolkit.googleapis.com/v1/projects/${PROYECTO}`;

let pase = { hasta: 0, valor: '' };
async function tokenServidor() {
  if (Date.now() < pase.hasta) return pase.valor;
  db(); // inicia firebase-admin/app con la cuenta de servicio
  const t = await getApps()[0].options.credential.getAccessToken();
  pase = { hasta: Date.now() + (Number(t.expires_in) || 3000) * 1000 - 60e3, valor: t.access_token };
  return pase.valor;
}

async function llamar(ruta, cuerpo) {
  const r = await fetch(BASE + ruta, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + (await tokenServidor()), 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo || {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error((j.error && j.error.message) || 'firebase-' + r.status);
    e.codigo = (j.error && j.error.message) || '';
    throw e;
  }
  return j;
}

const normal = (email) => String(email || '').trim().toLowerCase();

// Usuario de Firebase con ese email (o null)
async function buscarPorEmail(email) {
  const j = await llamar('/accounts:lookup', { email: [normal(email)] });
  return (j.users && j.users[0]) || null;
}
async function buscarPorUid(uid) {
  const j = await llamar('/accounts:lookup', { localId: [String(uid)] });
  return (j.users && j.users[0]) || null;
}

// Crea la cuenta si no existe. Devuelve { uid, nueva }
async function asegurarUsuario(email, nombre) {
  email = normal(email);
  const ya = await buscarPorEmail(email);
  if (ya) return { uid: ya.localId, nueva: false };
  try {
    const j = await llamar('/accounts', { email, ...(nombre ? { displayName: String(nombre).slice(0, 100) } : {}) });
    return { uid: j.localId, nueva: true };
  } catch (e) {
    if (/EMAIL_EXISTS/.test(e.codigo)) { const u = await buscarPorEmail(email); if (u) return { uid: u.localId, nueva: false }; }
    throw e;
  }
}

// Enlace para entrar sin contraseña. NO lo envía Firebase: lo mandamos nosotros (en español, desde
// info@mirardespacio.es). continueUrl tiene que estar en un dominio autorizado de Firebase
// (Authentication → Settings → Authorized domains: mirardespacio.es).
async function enlaceEntrada(email, continueUrl) {
  const j = await llamar('/accounts:sendOobCode', {
    requestType: 'EMAIL_SIGNIN', email: normal(email), continueUrl, canHandleCodeInApp: true, returnOobLink: true,
  });
  if (!j.oobLink) throw new Error('sin-enlace');
  return j.oobLink;
}

// Cierra las sesiones abiertas de una cuenta (p. ej. al quitarle el acceso)
async function cerrarSesiones(uid) {
  await llamar('/accounts:update', { localId: String(uid), validSince: String(Math.floor(Date.now() / 1000)) });
}

module.exports = { buscarPorEmail, buscarPorUid, asegurarUsuario, enlaceEntrada, cerrarSesiones, normal, _llamar: llamar };
