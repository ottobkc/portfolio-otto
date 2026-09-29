// Netlify la ejecuta sola cada vez que alguien inicia sesión con Netlify Identity.
// Registra la entrada en el servidor (no depende del navegador).
// Importante: siempre devuelve 200 para no bloquear nunca el login.
const { registrar, conLimite } = require('../lib/firestore');

exports.handler = async (event) => {
  try {
    const { user } = JSON.parse(event.body || '{}');
    if (user) await conLimite(registrar({ user, tipo: 'login' }));
  } catch (e) {
    console.error('identity-login: no se pudo registrar', e.message);
  }
  return { statusCode: 200, body: '' };
};
