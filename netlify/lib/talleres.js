// Lógica común de talleres, bonos regalo y Mirar Despacio+ (pagos por Ko-fi).
// Lo usan las funciones kofi-webhook (pagos) y talleres (plazas, bonos, canje).
const crypto = require('crypto');
const { FieldValue } = require('./firestore');
const { enviar, esc, remitente } = require('./correo');
const { tarjeta, fechaLarga, enlacesCalendario, aTexto } = require('./plantillas-salida');

const DATOS = 'https://mirardespacio.es/talleres-data.json';
const WEB = 'https://mirardespacio.es';
const ORIGENES = /^https:\/\/((www\.)?mirardespacio\.es|([a-z0-9-]+--)?mirar-despacio\.netlify\.app)$/;
const VALIDEZ_BONO_DIAS = 365;

function cabeceras(origen) {
  return {
    'Access-Control-Allow-Origin': ORIGENES.test(origen || '') ? origen : WEB,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    Vary: 'Origin',
  };
}

const limpio = (v, max = 200) => String(v == null ? '' : v).trim().slice(0, max);
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || '');
const eur = (n) => (Math.round(Number(n) * 100) / 100).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €';

let cache = null;
async function datos() {
  if (cache && Date.now() - cache.t < 60e3) return cache.d;
  const r = await fetch(DATOS + '?t=' + Date.now(), { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error('No se pudo leer talleres-data.json');
  const d = await r.json();
  cache = { t: Date.now(), d };
  return d;
}

const taller = (d, id) => (d.talleres || []).find((t) => t.id === id);
const edicion = (d, id) => (d.ediciones || []).find((e) => e.id === id);
const eventoId = (edicionId) => 'taller-' + edicionId;
const pasada = (ed) => ed.fechaISO && new Date(ed.fechaISO).getTime() < Date.now();

// ¿A qué corresponde un código de producto de Ko-fi?
function producto(d, codigo) {
  if (!codigo) return null;
  const ed = (d.ediciones || []).find((e) => e.kofi && e.kofi === codigo);
  if (ed) return { tipo: 'taller', edicion: ed, taller: taller(d, ed.taller) };
  const t = (d.talleres || []).find((x) => x.bonoKofi && x.bonoKofi === codigo);
  if (t) return { tipo: 'bono-taller', taller: t };
  const rp = (d.regalosPlus || []).find((x) => x.kofi && x.kofi === codigo);
  if (rp) return { tipo: 'bono-plus', regalo: rp };
  return null;
}

// Código de bono legible: MD-XXXX-XXXX (sin 0/O/1/I para que no haya confusiones)
function nuevoCodigo() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = crypto.randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += abc[b[i] % abc.length];
  return 'MD-' + s.slice(0, 4) + '-' + s.slice(4);
}
const normalizarCodigo = (c) => limpio(c, 20).toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^MD/, '').replace(/^(.{4})(.{4})$/, 'MD-$1-$2');

// ---------- CRM ----------
async function personaPorEmail(fs, datosP) {
  const email = datosP.email.toLowerCase();
  const q = await fs.collection('people').where('email', 'in', [...new Set([datosP.email, email])]).limit(1).get();
  if (!q.empty) {
    const doc = q.docs[0];
    const p = doc.data();
    const cambios = {};
    for (const k of ['apellidos', 'telefono']) if (datosP[k] && !p[k]) cambios[k] = datosP[k];
    if (datosP.nombre && !p.name) cambios.name = datosP.nombre;
    if (Object.keys(cambios).length) await doc.ref.set(cambios, { merge: true });
    return { id: doc.id, ref: doc.ref, ...p, ...cambios };
  }
  const ref = fs.collection('people').doc();
  const nueva = {
    name: datosP.nombre || email.split('@')[0],
    apellidos: datosP.apellidos || '',
    email,
    telefono: datosP.telefono || '',
    origen: datosP.origen || 'web',
    createdAt: FieldValue.serverTimestamp(),
  };
  await ref.set(nueva);
  return { id: ref.id, ref, ...nueva };
}

async function eventoTaller(fs, d, ed) {
  const t = taller(d, ed.taller) || {};
  const ref = fs.collection('events').doc(eventoId(ed.id));
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      name: 'Taller · ' + (t.titulo || ed.taller), date: ed.fechaISO ? ed.fechaISO.slice(0, 10) : '',
      location: ed.zona || '', tipo: 'taller', plazas: t.plazas || 8, creadaDesdeWeb: true,
    });
  }
  return ref;
}

async function ocupadas(fs, edicionId) {
  const q = await fs.collection('signups').where('eventId', '==', eventoId(edicionId)).get();
  return q.docs.reduce((n, x) => n + (x.data().status === 'espera' ? 0 : Number(x.data().plazasCompradas) || 1), 0);
}

async function ingreso(fs, id, datosI) {
  await fs.collection('ingresos').doc(id).set({
    tipo: 'ingreso', fecha: FieldValue.serverTimestamp(), metodo: 'kofi', origen: 'auto', ...datosI,
  });
}

// ---------- Correos ----------
function datosEdicion(d, ed) {
  const t = taller(d, ed.taller) || {};
  const filas = [['🎟️', 'Taller · ' + esc(t.titulo || '')], ['📅', esc(fechaLarga(ed.fechaISO, ed.fecha))]];
  const hora = ed.hora || t.hora;
  if (hora) filas.push(['🕙', esc(hora) + 'h']);
  if (ed.zona) filas.push(['📍', 'Zona ' + esc(ed.zona)]);
  const horas = ed.fechaFinISO ? null : 4;
  const cal = enlacesCalendario({
    iso: ed.fechaISO, finISO: ed.fechaFinISO || (ed.fechaISO ? new Date(new Date(ed.fechaISO).getTime() + horas * 3600e3).toISOString() : ''),
    zona: ed.zona, tituloCal: 'Mirar Despacio - Taller ' + (t.titulo || ''),
    detallesCal: 'Taller de Mirar Despacio: ' + (t.titulo || '') + '. El punto de encuentro se enviará por email antes de la fecha.',
  });
  return { t, filas, cal };
}

async function correoPlazaTaller({ d, ed, nombre, email, regalo }) {
  const { t, filas, cal } = datosEdicion(d, ed);
  const html = tarjeta({
    titulo: 'Taller ' + (t.titulo || '') + ' · Mirar Despacio',
    nombre,
    intro: [regalo
      ? 'Ya has canjeado tu regalo: tienes plaza en el taller. Estos son los datos:'
      : 'Te confirmo tu plaza en el taller de Mirar Despacio. Estos son los datos:'],
    filas,
    calendario: cal,
    cuerpo: [
      'El punto de encuentro exacto y lo que conviene llevar te los mando en un mail unos días antes.',
      'Incluye: ' + esc((t.incluye || []).join(', ').toLowerCase()) + '.',
      'Si por lo que sea ese día no puedes, avísame cuanto antes y lo hablamos.',
    ],
  });
  return enviar({ para: email, asunto: `Tienes plaza · Taller ${t.titulo || ''}, ${fechaLarga(ed.fechaISO, ed.fecha).toLowerCase()}`, html, texto: aTexto(html) });
}

async function correoBonoComprador({ email, nombre, codigo, titulo, caduca }) {
  const url = `${WEB}/regalo/?c=${encodeURIComponent(codigo)}`;
  const html = tarjeta({
    titulo: 'Tu regalo de Mirar Despacio',
    nombre,
    intro: ['¡Gracias! Tu regalo ya está listo. Estos son los datos:'],
    filas: [['🎁', esc(titulo)], ['🔑', 'Código <span style="font-family:monospace; letter-spacing:1px;">' + esc(codigo) + '</span>'], ['⏳', 'Válido hasta el ' + esc(caduca)]],
    calendario: null,
    boton: { antes: 'Aquí tienes la tarjeta regalo para imprimir o reenviar. Puedes escribir el nombre y una dedicatoria:', url, texto: '🎁 Ver la tarjeta regalo' },
    cuerpo: [
      'Quien lo reciba solo tiene que entrar en el enlace de la tarjeta (o en mirardespacio.es/regalo/ con el código) y elegir fecha.',
      'Si tienes cualquier duda, contesta a este correo.',
    ],
  });
  return enviar({ para: email, asunto: 'Tu regalo de Mirar Despacio está listo', html, texto: aTexto(html) });
}

async function correoBienvenidaPlus({ email, nombre, hasta, regalo, nivel }) {
  const html = tarjeta({
    titulo: 'Bienvenida a Mirar Despacio+',
    nombre,
    intro: [regalo ? 'Ya has canjeado tu regalo: estás dentro de Mirar Despacio+.' : 'Gracias por unirte a Mirar Despacio+. Ya estás dentro.'],
    filas: [['✨', 'Mirar Despacio+' + (nivel === 'con-salidas' ? ' con salidas' : '')], ...(hasta ? [['⏳', 'Acceso hasta el ' + esc(hasta)]] : [])],
    calendario: null,
    cuerpo: [
      'En unos minutos te llegará otro correo para <strong>crear tu contraseña</strong> de la zona de miembros. Si ya tenías cuenta, entra directamente en ottokols.es/acceso.html.',
      nivel === 'con-salidas' ? 'Las salidas están incluidas: cuando te apuntes a una, tendrás plaza.' : '',
      'Si tienes cualquier duda, contesta a este correo.',
    ].filter(Boolean),
  });
  return enviar({ para: email, asunto: 'Bienvenida a Mirar Despacio+', html, texto: aTexto(html) });
}

async function avisoOtto(asunto, filas, responderA) {
  const html = `<!doctype html><html><body style="font:15px/1.5 system-ui,sans-serif;color:#1a1814;">
<table style="border-collapse:collapse;">${filas.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6b655a;vertical-align:top;">${esc(k)}</td><td style="padding:4px 0;">${esc(v)}</td></tr>`).join('')}</table>
<p><a href="https://ottokols.es/crm/">Abrir el CRM</a></p></body></html>`;
  return enviar({ para: process.env.AVISO_A || remitente(), asunto, html, texto: aTexto(html), responderA });
}

// ---------- Acceso a la zona de miembros (Netlify Identity) ----------
// Invita al email si aún no tiene cuenta. El rol "member" lo pone identity-signup al aceptar.
async function invitarIdentity(context, email) {
  const id = context && context.clientContext && context.clientContext.identity;
  if (!id || !id.url || !id.token) return 'sin-identity';
  try {
    const r = await fetch(id.url + '/invite', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + id.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (r.ok) return 'invitado';
    return r.status === 422 ? 'ya-existe' : 'error-' + r.status;
  } catch (e) {
    return 'error';
  }
}

function sumarMeses(base, meses) {
  const d = new Date(base);
  d.setMonth(d.getMonth() + meses);
  return d;
}
const fechaCorta = (d) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' }).format(d);

// Da o amplía Mirar Despacio+ a una persona del CRM
async function darPlus(fs, persona, { meses, nivel, origen }) {
  const ahora = new Date();
  const actual = persona.plusHasta ? new Date(persona.plusHasta) : null;
  const base = actual && actual > ahora ? actual : ahora;
  const hasta = sumarMeses(base, meses);
  await persona.ref.set({ plusHasta: hasta.toISOString(), plusNivel: nivel, plusOrigen: origen }, { merge: true });
  return hasta;
}

module.exports = {
  cabeceras, limpio, emailValido, eur, datos, taller, edicion, eventoId, pasada, producto,
  nuevoCodigo, normalizarCodigo, personaPorEmail, eventoTaller, ocupadas, ingreso,
  correoPlazaTaller, correoBonoComprador, correoBienvenidaPlus, avisoOtto, invitarIdentity,
  darPlus, fechaCorta, VALIDEZ_BONO_DIAS,
};
