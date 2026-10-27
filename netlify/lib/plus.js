// Altas y bajas de Mirar Despacio+ desde el CRM, y su caducidad.
// En la ficha de la persona (colección people):
//   subscription: { active, since, until (AAAA-MM-DD), nivel: 'salidas' | 'online', bajaEn, motivoBaja }
//   trialStart: ISO (prueba gratis de 30 días)
//   pruebaHasta: AAAA-MM-DD (opcional) si la prueba se amplió para que termine el reto abierto
// El acceso a la zona de miembros (rol 'member' en Netlify Identity) se pone y se quita a la vez.
const { usuarioPorEmail, ponerRoles, rolesPara, invitarCon } = require('./identidad');

const DIA = 864e5;
const GRACIA_DIAS = 3;
const PRUEBA_DIAS = 30;
const hoy = () => new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).slice(0, 10);
const sumarMeses = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };

function estado(p) {
  const s = (p && p.subscription) || {};
  if (s.active) {
    // Las suscripciones puestas a mano antes de este sistema (sin 'origen') no caducan solas:
    // el CRM las marca para que las revises y les pongas fecha con «Dar de alta / renovar».
    const vencida = s.until && new Date(s.until + 'T23:59:59').getTime() + GRACIA_DIAS * DIA < Date.now();
    const caducada = !!(s.origen && vencida);
    return { activo: !caducada, tipo: 'suscripcion', hasta: s.until || null, nivel: s.nivel || 'salidas', caducada, revisar: !s.origen && !!vencida };
  }
  if (p && p.trialStart) {
    let fin = new Date(new Date(p.trialStart).getTime() + PRUEBA_DIAS * DIA);
    if (p.pruebaHasta) { const amp = new Date(p.pruebaHasta + 'T23:59:59+01:00'); if (amp > fin) fin = amp; }
    return { activo: fin.getTime() > Date.now(), tipo: 'prueba', hasta: fin.toISOString().slice(0, 10), nivel: 'salidas', caducada: fin.getTime() <= Date.now() };
  }
  return { activo: false, tipo: 'ninguno' };
}

// ¿Tiene plaza asegurada en las salidas? (MD+ con salidas, al día)
const conSalidas = (p) => { const e = estado(p); return e.activo && e.nivel !== 'online'; };

// Pone el acceso en Identity sin bajar nunca a un admin. Devuelve un texto con lo que ha pasado.
async function aplicarAcceso(context, email, acceso) {
  if (!email) return 'sin-email';
  try {
    if (acceso === 'plus') return await invitarCon(context, email, 'plus');
    const u = await usuarioPorEmail(context, email);
    if (!u) return 'sin-cuenta';
    const actuales = (u.app_metadata && u.app_metadata.roles) || [];
    if (actuales.includes('admin')) return 'admin';
    await ponerRoles(context, u.id, rolesPara(actuales, acceso));
    return 'hecho';
  } catch (e) {
    return e.message === 'sin-identity' ? 'sin-identity' : 'error';
  }
}

async function alta(context, ref, p, { meses = 1, nivel = 'salidas', desde } = {}) {
  const s = p.subscription || {};
  const base = s.active && s.until && s.until >= hoy() ? s.until : (desde || hoy());
  const sub = {
    active: true, since: s.active && s.since ? s.since : (desde || hoy()), until: sumarMeses(base, Number(meses) || 1),
    nivel: nivel === 'online' ? 'online' : 'salidas', origen: 'crm',
  };
  // Si volvía de una baja, se cierra esa pausa (los retos de esos meses no le rompen la racha)
  const pausas = (p.pausas || []).map((x) => (x.hasta ? x : { ...x, hasta: hoy() }));
  await ref.set({ subscription: sub, avisoCaducidad: null, ...(p.pausas ? { pausas } : {}) }, { merge: true });
  return { sub, acceso: await aplicarAcceso(context, p.email, 'plus') };
}

async function baja(context, ref, p, { dejarFotos = true, motivo = 'manual' } = {}) {
  const s = p.subscription || {};
  // La baja abre una pausa: se conserva todo (fotos, comentarios, medallas, monturas) y la racha queda congelada
  const abierta = (p.pausas || []).some((x) => !x.hasta);
  const pausas = abierta ? (p.pausas || []) : (p.pausas || []).concat({ desde: hoy() });
  await ref.set({ subscription: { ...s, active: false, bajaEn: hoy(), motivoBaja: motivo }, trialStart: null, pruebaHasta: null, pausas }, { merge: true });
  return { acceso: await aplicarAcceso(context, p.email, dejarFotos ? 'fotos' : 'ninguno') };
}

async function prueba(context, ref, p) {
  await ref.set({ trialStart: new Date().toISOString(), pruebaHasta: null }, { merge: true });
  return { acceso: await aplicarAcceso(context, p.email, 'plus') };
}

module.exports = { estado, conSalidas, alta, baja, prueba, aplicarAcceso, hoy, sumarMeses, GRACIA_DIAS, PRUEBA_DIAS };
