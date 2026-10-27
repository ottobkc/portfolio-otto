// Cuentas de la zona de socios: quién es quién y qué acceso tiene.
//
// Roles (los mismos que había en Netlify Identity):
//   member        -> Mirar Despacio+ completo (recursos, herramientas, retos, cuaderno)
//   participante  -> solo el cuaderno: sube fotos de las salidas y recibe comentarios
//   taller-<id>   -> el manual de ese taller (independiente de MD+)
//   admin         -> Otto
// Quitar el acceso = quitarle los roles. La cuenta y todos sus datos se quedan.
//
// Dónde se guardan: Firebase Authentication (la cuenta, para entrar con enlace al correo) y
// Firestore cuentas/{uid} = { email, nombre, roles, identityId, creada, ultimoLogin, ... }.
//
// MIGRACIÓN DESDE NETLIFY IDENTITY, por fases (ver MIGRACION-SOCIOS.md):
//   MODO 'doble'    -> Identity sigue mandando (listas, invitaciones, la web antigua) y cada cambio
//                      se copia también a Firebase/Firestore. Si la copia falla, Identity no se entera.
//   MODO 'firebase' -> solo Firebase/Firestore. Identity deja de usarse.
// Se cambia con la variable de entorno CUENTAS_MODO en Netlify (por defecto 'doble').
const { db, FieldValue } = require('./firestore');
const fb = require('./firebase-cuentas');
const { verificarToken } = require('./sesion-firebase');

const MODO = () => (process.env.CUENTAS_MODO === 'firebase' ? 'firebase' : 'doble');
const ADMIN = () => (process.env.CRM_ADMIN || 'ottobkc@gmail.com').toLowerCase();
const ROLES_ACCESO = ['member', 'participante'];
const identidad = () => require('./identidad'); // solo en modo 'doble'

const rolManual = (tallerId) => 'taller-' + String(tallerId || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
const manualesDe = (roles) => (roles || []).filter((r) => /^taller-/.test(r)).map((r) => r.slice(7));
const accesoDe = (roles) => (roles.includes('admin') ? 'admin' : roles.includes('member') ? 'plus' : roles.includes('participante') ? 'fotos' : 'ninguno');
const ms = (t) => (t && t.toMillis ? t.toMillis() : t ? new Date(t).getTime() || null : null);

// acceso: 'plus' | 'fotos' | 'ninguno'. Nunca toca admin ni los manuales.
function rolesPara(actuales, acceso) {
  const base = (actuales || []).filter((r) => !ROLES_ACCESO.includes(r));
  if (acceso === 'plus') base.push('member');
  if (acceso === 'fotos') base.push('participante');
  return [...new Set(base)];
}

// Forma común de un usuario, venga de donde venga
function desdeIdentity(u) {
  const roles = (u.app_metadata && u.app_metadata.roles) || [];
  return {
    id: u.id, email: String(u.email || '').toLowerCase(), nombre: (u.user_metadata && u.user_metadata.full_name) || '',
    roles, confirmada: !!u.confirmed_at, creada: u.created_at || null, ultimoLogin: u.last_sign_in_at || null, origen: 'identity',
  };
}
function desdeFirestore(d) {
  const c = d.data();
  return {
    id: d.id, email: c.email || '', nombre: c.nombre || '', roles: c.roles || [], confirmada: !!c.primeraEntrada,
    creada: ms(c.creada), ultimoLogin: ms(c.ultimoLogin), identityId: c.identityId || null, origen: 'firebase',
  };
}
const conPermisos = (u) => u && {
  ...u,
  plus: u.roles.includes('member') || u.roles.includes('admin'),
  fotos: u.roles.some((r) => ['member', 'participante', 'admin'].includes(r)),
  admin: u.roles.includes('admin'),
  manuales: manualesDe(u.roles),
};

// ---------- Firestore ----------
async function cuentaPorEmail(email) {
  email = fb.normal(email);
  const q = await db().collection('cuentas').where('email', '==', email).limit(1).get();
  return q.empty ? null : q.docs[0];
}

// Copia (o crea) la cuenta en Firebase con estos roles. Devuelve el uid.
async function guardarEnFirebase(email, roles, extra = {}) {
  email = fb.normal(email);
  const { uid, nueva } = await fb.asegurarUsuario(email, extra.nombre);
  const datos = { email, roles: [...new Set(roles || [])], actualizada: FieldValue.serverTimestamp(), ...extra };
  if (nueva) datos.creada = FieldValue.serverTimestamp();
  Object.keys(datos).forEach((k) => datos[k] === undefined && delete datos[k]);
  await db().collection('cuentas').doc(uid).set(datos, { merge: true });
  return uid;
}

// En modo doble la copia nunca debe romper lo que ya funciona: se apunta el fallo y se sigue
async function espejo(email, roles, extra) {
  try { return await guardarEnFirebase(email, roles, extra); } catch (e) {
    console.error('cuentas: copia a Firebase fallida', email, e.message);
    try { await db().collection('cambios_acceso').add({ tipo: 'copia-firebase-fallida', email, error: e.message, fecha: FieldValue.serverTimestamp() }); } catch (x) { /* nada */ }
    return null;
  }
}

// ---------- API común ----------

// Todas las cuentas (forma común)
async function listar(context) {
  if (MODO() === 'doble') return (await identidad().listarUsuarios(context)).map(desdeIdentity);
  const q = await db().collection('cuentas').get();
  return q.docs.map(desdeFirestore);
}

async function porEmail(context, email) {
  email = fb.normal(email);
  if (MODO() === 'doble') { const u = await identidad().usuarioPorEmail(context, email); return u ? desdeIdentity(u) : null; }
  const d = await cuentaPorEmail(email);
  return d ? desdeFirestore(d) : null;
}

async function porId(context, id) {
  if (MODO() === 'doble') { const u = (await identidad().listarUsuarios(context)).find((x) => x.id === id); return u ? desdeIdentity(u) : null; }
  const d = await db().collection('cuentas').doc(String(id)).get();
  return d.exists ? desdeFirestore(d) : null;
}

// Cambia los roles de una cuenta (u = forma común, con id y email)
async function ponerRoles(context, u, roles) {
  roles = [...new Set(roles)];
  if (MODO() === 'doble') {
    await identidad().ponerRoles(context, u.id, roles);
    await espejo(u.email, roles, { identityId: u.id });
    return;
  }
  await db().collection('cuentas').doc(u.id).set({ roles, actualizada: FieldValue.serverTimestamp() }, { merge: true });
}

// Da un acceso a un email. Si no tiene cuenta, la crea. Si ya era MD+ y se le da 'fotos', se queda
// en MD+ (nunca se baja el acceso sin querer, salvo con bajar: true).
// Devuelve 'invitado' | 'ya-existe' | 'sin-identity' | 'error…'
async function invitarCon(context, email, acceso, { bajar = false } = {}) {
  email = fb.normal(email);
  if (MODO() === 'doble') {
    const estado = await identidad().invitarCon(context, email, acceso, { bajar });
    if (!/^error|sin-identity/.test(estado)) {
      const u = await identidad().usuarioPorEmail(context, email).catch(() => null);
      if (u) await espejo(email, (u.app_metadata && u.app_metadata.roles) || [], { identityId: u.id, nombre: (u.user_metadata && u.user_metadata.full_name) || undefined });
    }
    return estado;
  }
  try {
    const d = await cuentaPorEmail(email);
    const actuales = d ? d.data().roles || [] : [];
    if (!bajar && acceso === 'fotos' && actuales.includes('member')) return d ? 'ya-existe' : 'invitado';
    await guardarEnFirebase(email, rolesPara(actuales, acceso));
    return d ? 'ya-existe' : 'invitado';
  } catch (e) {
    console.error('invitarCon', e.message);
    return 'error';
  }
}

// Manual de un taller. Si no tiene cuenta, se crea solo con ese manual (sin MD+ ni cuaderno).
// Devuelve 'invitado' | 'ya-existe' | 'ya-tenia' | 'sin-identity' | 'error…'
async function darManual(context, email, tallerId) {
  email = fb.normal(email);
  const rol = rolManual(tallerId);
  if (MODO() === 'doble') {
    const estado = await identidad().darManual(context, email, tallerId);
    if (!/^error|sin-identity/.test(estado)) {
      const u = await identidad().usuarioPorEmail(context, email).catch(() => null);
      if (u) await espejo(email, (u.app_metadata && u.app_metadata.roles) || [], { identityId: u.id });
    }
    return estado;
  }
  try {
    const d = await cuentaPorEmail(email);
    const actuales = d ? d.data().roles || [] : [];
    if (actuales.includes(rol)) return 'ya-tenia';
    await guardarEnFirebase(email, [...actuales, rol]);
    return d ? 'ya-existe' : 'invitado';
  } catch (e) {
    console.error('darManual', e.message);
    return 'error';
  }
}

async function quitarManual(context, id, tallerId) {
  const u = await porId(context, id);
  if (!u) return 'no-existe';
  const rol = rolManual(tallerId);
  if (!u.roles.includes(rol)) return 'no-tenia';
  await ponerRoles(context, u, u.roles.filter((r) => r !== rol));
  return 'hecho';
}

// ---------- Quién llama a una función ----------
// Acepta la sesión de Firebase (Authorization: Bearer <idToken>, la de la web nueva) y, en modo
// doble, también la de Netlify Identity (la web antigua). Devuelve la forma común con permisos o null.
async function usuarioDe(event, context) {
  const h = (event && event.headers) || {};
  const token = String(h.authorization || h.Authorization || '').replace(/^Bearer\s+/i, '');
  if (token) {
    try {
      const datos = await verificarToken(token);
      const d = await db().collection('cuentas').doc(datos.uid).get();
      const email = String(datos.email || '').toLowerCase();
      const roles = d.exists ? d.data().roles || [] : [];
      if (email && email === ADMIN() && !roles.includes('admin')) roles.push('admin');
      if (d.exists || roles.length) {
        return conPermisos({ id: datos.uid, email, nombre: d.exists ? d.data().nombre || '' : '', roles, origen: 'firebase' });
      }
      return conPermisos({ id: datos.uid, email, nombre: '', roles: [], origen: 'firebase' });
    } catch (e) { /* no es un token de Firebase: puede ser de Identity */ }
  }
  if (MODO() === 'doble') {
    const u = context && context.clientContext && context.clientContext.user;
    if (u && u.sub) {
      return conPermisos({ id: u.sub, email: String(u.email || '').toLowerCase(), nombre: (u.user_metadata && u.user_metadata.full_name) || '',
        roles: (u.app_metadata && u.app_metadata.roles) || [], origen: 'identity' });
    }
  }
  return null;
}

module.exports = {
  MODO, ROLES_ACCESO, rolesPara, rolManual, manualesDe, accesoDe,
  listar, porEmail, porId, ponerRoles, invitarCon, darManual, quitarManual, usuarioDe,
  guardarEnFirebase, cuentaPorEmail, desdeIdentity, desdeFirestore,
};
