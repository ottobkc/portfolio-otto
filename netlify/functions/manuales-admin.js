// Acceso a los manuales de los talleres desde el CRM. Solo para Otto: el CRM manda su sesión
// de Firebase (Authorization: Bearer <idToken>) y aquí se comprueba que es la cuenta de administración.
//
//  POST {accion:'lista'}                 -> manuales y, de cada uno, quién tiene acceso
//  POST {accion:'dar', email, taller}    -> da acceso (si no tiene cuenta, la invita solo con ese manual)
//  POST {accion:'quitar', id, taller}    -> quita el acceso a ese manual (la cuenta y lo demás se quedan)
//
// El acceso es el rol "taller-<id>" de la cuenta (netlify/lib/cuentas.js).
// La sesión se comprueba con sesion-firebase (firebase-admin/auth no carga en las funciones de Netlify)
const { verificarToken } = require('../lib/sesion-firebase');
const { db, FieldValue } = require('../lib/firestore');
const { listar, manualesDe, darManual, quitarManual } = require('../lib/cuentas');
const { MANUALES } = require('../lib/manuales');

const ADMIN = (process.env.CRM_ADMIN || 'ottobkc@gmail.com').toLowerCase();
const res = (code, obj) => ({ statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return res(405, {});
  try {
    const fs = db(); // inicia firebase-admin
    const token = (event.headers.authorization || '').replace(/^Bearer\s+/i, '');
    let quien;
    try { quien = await verificarToken(token); } catch (e) { return res(401, { error: 'sesion' }); }
    if ((quien.email || '').toLowerCase() !== ADMIN) return res(403, { error: 'no-admin' });

    const b = JSON.parse(event.body || '{}');
    const taller = String(b.taller || '');
    const registro = (datos) => fs.collection('cambios_acceso').add({ tipo: 'manual', taller, fecha: FieldValue.serverTimestamp(), ...datos });

    if (b.accion === 'lista') {
      const usuarios = await listar(context);
      const manuales = Object.entries(MANUALES).map(([id, m]) => ({
        id, titulo: m.titulo, listo: m.listo,
        personas: usuarios.filter((u) => manualesDe(u.roles).includes(id))
          .map((u) => ({ id: u.id, email: u.email, nombre: u.nombre, confirmada: u.confirmada }))
          .sort((x, y) => String(x.email).localeCompare(y.email)),
      }));
      return res(200, { manuales });
    }

    if (!MANUALES[taller]) return res(400, { error: 'taller' });

    if (b.accion === 'dar') {
      const email = String(b.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res(400, { error: 'email' });
      const estado = await darManual(context, email, taller);
      if (/^error|sin-identity/.test(estado)) return res(500, { error: estado });
      await registro({ email, accion: 'dar', estado });
      return res(200, { estado });
    }

    if (b.accion === 'quitar') {
      const estado = await quitarManual(context, String(b.id || ''), taller);
      if (estado === 'no-existe') return res(404, { error: estado });
      await registro({ userId: String(b.id || ''), accion: 'quitar', estado });
      return res(200, { estado });
    }

    return res(400, { error: 'accion' });
  } catch (e) {
    console.error('manuales-admin', e.message);
    return res(500, { error: 'servidor' });
  }
};
