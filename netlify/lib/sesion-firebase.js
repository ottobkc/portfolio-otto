// Comprueba la sesión de Firebase (idToken) que mandan el CRM y el panel de galerías.
// Se hace a mano con las claves públicas de Google en lugar de con firebase-admin/auth: esa parte
// de firebase-admin depende de «jose», que ya solo se publica como módulo ES y no carga en las
// funciones de Netlify (ERR_REQUIRE_ESM). Es la verificación que documenta Firebase:
// https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
const crypto = require('crypto');

const PROYECTO = 'mirardespaciocrm';
const CERTS = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let cache = { hasta: 0, claves: {} };

async function claves() {
  if (Date.now() < cache.hasta) return cache.claves;
  const r = await fetch(CERTS);
  if (!r.ok) throw new Error('certs-' + r.status);
  const max = Number((/max-age=(\d+)/.exec(r.headers.get('cache-control') || '') || [])[1] || 3600);
  cache = { hasta: Date.now() + max * 1000, claves: await r.json() };
  return cache.claves;
}

const b64 = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

// Devuelve los datos del usuario ({ email, uid, ... }) o lanza un error si el token no es válido
async function verificarToken(token) {
  const partes = String(token || '').split('.');
  if (partes.length !== 3) throw new Error('formato');
  const cab = JSON.parse(b64(partes[0]).toString('utf8'));
  const datos = JSON.parse(b64(partes[1]).toString('utf8'));
  if (cab.alg !== 'RS256' || !cab.kid) throw new Error('algoritmo');
  let cert = (await claves())[cab.kid];
  if (!cert) { cache.hasta = 0; cert = (await claves())[cab.kid]; } // Google rota las claves: se recargan una vez
  if (!cert) throw new Error('clave');
  const ok = crypto.createVerify('RSA-SHA256').update(partes[0] + '.' + partes[1]).verify(cert, b64(partes[2]));
  if (!ok) throw new Error('firma');
  const ahora = Math.floor(Date.now() / 1000);
  if (datos.aud !== PROYECTO || datos.iss !== 'https://securetoken.google.com/' + PROYECTO) throw new Error('proyecto');
  if (!datos.sub || datos.exp <= ahora - 30 || datos.iat > ahora + 300 || (datos.auth_time && datos.auth_time > ahora + 300)) throw new Error('caducado');
  return { ...datos, uid: datos.sub };
}

module.exports = { verificarToken };
