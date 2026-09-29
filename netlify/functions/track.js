// Recibe desde las páginas de miembros: página vista, salida y cierre de sesión.
// Solo acepta peticiones con el token de Netlify Identity (Authorization: Bearer ...),
// así nadie puede inventarse accesos de otra persona.
const { registrar, conLimite } = require('../lib/firestore');

const TIPOS = new Set(['pagina', 'salida', 'logout']);

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: '' };
  const user = context.clientContext && context.clientContext.user;
  if (!user) return { statusCode: 401, body: '' };

  let tipo, ruta;
  try {
    ({ tipo, ruta } = JSON.parse(event.body || '{}'));
  } catch (e) {
    return { statusCode: 400, body: '' };
  }
  if (!TIPOS.has(tipo)) return { statusCode: 400, body: '' };
  ruta = typeof ruta === 'string' ? ruta.slice(0, 200) : null;

  try {
    await conLimite(registrar({ user, tipo, ruta }));
  } catch (e) {
    console.error('track: no se pudo registrar', e.message);
  }
  return { statusCode: 204, body: '' };
};
