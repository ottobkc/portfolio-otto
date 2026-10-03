// Ayudas para Netlify Identity desde las funciones.
// Roles:
//   member       -> Mirar Despacio+ completo (recursos, herramientas, retos, cuaderno)
//   participante -> solo el cuaderno: sube fotos de las salidas y recibe comentarios
//   admin        -> Otto
// Quitar el acceso = quitarle los roles. La cuenta y todos sus datos se quedan.
// Para llamar a la API de administración, Netlify pasa a cada función un token en
// context.clientContext.identity (solo existe en el servidor, nunca llega al navegador).

const ROLES_ACCESO = ['member', 'participante'];

// Usuario que llama a la función (si mandó su sesión en la cabecera Authorization)
function usuarioDe(context) {
  const u = context && context.clientContext && context.clientContext.user;
  if (!u || !u.sub) return null;
  const roles = (u.app_metadata && u.app_metadata.roles) || [];
  return {
    id: u.sub,
    email: (u.email || '').toLowerCase(),
    nombre: (u.user_metadata && u.user_metadata.full_name) || '',
    roles,
    plus: roles.includes('member') || roles.includes('admin'),
    fotos: roles.some((r) => ['member', 'participante', 'admin'].includes(r)),
  };
}

function api(context) {
  const id = context && context.clientContext && context.clientContext.identity;
  if (!id || !id.url || !id.token) return null;
  return async (ruta, opciones = {}) => {
    const r = await fetch(id.url + ruta, {
      ...opciones,
      headers: { Authorization: 'Bearer ' + id.token, 'Content-Type': 'application/json' },
    });
    const texto = await r.text();
    let json = null;
    try { json = texto ? JSON.parse(texto) : null; } catch (e) { /* nada */ }
    return { ok: r.ok, status: r.status, json };
  };
}

async function listarUsuarios(context) {
  const llamar = api(context);
  if (!llamar) throw new Error('sin-identity');
  const todos = [];
  for (let pag = 1; pag <= 20; pag++) {
    const r = await llamar(`/admin/users?per_page=200&page=${pag}`);
    if (!r.ok) throw new Error('identity-' + r.status);
    const lista = (r.json && r.json.users) || [];
    todos.push(...lista);
    if (lista.length < 200) break;
  }
  return todos;
}

async function usuarioPorEmail(context, email) {
  email = String(email || '').toLowerCase();
  return (await listarUsuarios(context)).find((u) => (u.email || '').toLowerCase() === email) || null;
}

// acceso: 'plus' | 'fotos' | 'ninguno'. Nunca toca el rol admin.
function rolesPara(actuales, acceso) {
  const base = (actuales || []).filter((r) => !ROLES_ACCESO.includes(r));
  if (acceso === 'plus') base.push('member');
  if (acceso === 'fotos') base.push('participante');
  return base;
}

async function ponerRoles(context, id, roles) {
  const llamar = api(context);
  if (!llamar) throw new Error('sin-identity');
  const r = await llamar('/admin/users/' + encodeURIComponent(id), {
    method: 'PUT', body: JSON.stringify({ app_metadata: { roles } }),
  });
  if (!r.ok) throw new Error('identity-' + r.status);
  return r.json;
}

// Invita a alguien con un acceso concreto. Si ya tenía cuenta, solo le cambia el acceso
// (si ya era MD+ y se le da 'fotos', se queda en MD+: nunca se baja el acceso sin querer).
async function invitarCon(context, email, acceso, { bajar = false } = {}) {
  const llamar = api(context);
  if (!llamar) return 'sin-identity';
  try {
    const r = await llamar('/invite', { method: 'POST', body: JSON.stringify({ email }) });
    let usuario = r.ok ? r.json : null;
    let estado = r.ok ? 'invitado' : null;
    if (!r.ok) {
      if (r.status !== 422) return 'error-' + r.status;
      usuario = await usuarioPorEmail(context, email);
      if (!usuario) return 'error-no-encontrado';
      estado = 'ya-existe';
    }
    const actuales = (usuario.app_metadata && usuario.app_metadata.roles) || [];
    if (!bajar && acceso === 'fotos' && actuales.includes('member')) return estado;
    await ponerRoles(context, usuario.id, rolesPara(actuales, acceso));
    return estado;
  } catch (e) {
    console.error('invitarCon', e.message);
    return 'error';
  }
}

module.exports = { usuarioDe, listarUsuarios, usuarioPorEmail, rolesPara, ponerRoles, invitarCon };
