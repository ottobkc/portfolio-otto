// Conexión compartida a Firestore (proyecto mirardespaciocrm) para las funciones.
// Credenciales en variables de entorno de Netlify:
//   FIREBASE_CLIENT_EMAIL  -> "client_email" del JSON de la cuenta de servicio
//   FIREBASE_PRIVATE_KEY   -> "private_key" del mismo JSON (con los \n tal cual)
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

function db() {
  if (!process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    throw new Error('Faltan FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY');
  }
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: 'mirardespaciocrm',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }
  return getFirestore();
}

// Registra un evento de acceso y actualiza el resumen del miembro.
// tipo: 'login' | 'pagina' | 'salida' | 'logout'
async function registrar({ user, tipo, ruta }) {
  const firestore = db();
  const ahora = FieldValue.serverTimestamp();
  const id = user.id || user.sub;
  const email = user.email || '';
  const nombre = (user.user_metadata && user.user_metadata.full_name) || '';

  const batch = firestore.batch();
  batch.set(firestore.collection('accesos').doc(), {
    userId: id, email, nombre, tipo, ruta: ruta || null, fecha: ahora,
  });
  const resumen = { userId: id, email, nombre, ultimaActividad: ahora, ultimoTipo: tipo };
  if (tipo === 'login') {
    resumen.ultimoLogin = ahora;
    resumen.logins = FieldValue.increment(1);
  }
  if (tipo === 'pagina') resumen.paginasVistas = FieldValue.increment(1);
  if (tipo === 'salida' || tipo === 'logout') resumen.ultimaSalida = ahora;
  batch.set(firestore.collection('miembros_actividad').doc(id), resumen, { merge: true });
  await batch.commit();
}

// Nunca dejamos que el registro bloquee el acceso: máximo 3 s.
function conLimite(promesa, ms = 3000) {
  return Promise.race([promesa, new Promise((r) => setTimeout(r, ms))]);
}

module.exports = { registrar, conLimite, db, FieldValue };
