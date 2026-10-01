// Inscripción a las salidas de Mirar Despacio (formulario de mirardespacio.es/salidas/).
// 1. Guarda a la persona y su inscripción en el CRM (Firestore: people + signups).
// 2. Decide si tiene plaza o va a lista de espera (PLAZAS por salida; el campo "plazas"
//    de la salida en el CRM lo cambia). Sin fecha todavía: siempre tiene plaza.
// 3. Le contesta por email desde info@mirardespacio.es y te avisa a ti.
// Si algo falla devuelve error y la web manda el formulario por Formspree como antes.
const { db, FieldValue } = require('../lib/firestore');
const { enviar, esc, hayCorreo } = require('../lib/correo');

const PLAZAS = 10;
const DATOS = 'https://mirardespacio.es/salidas-data.json';
const SIN_FECHA = 'web-sin-fecha';
const ORIGENES = /^https:\/\/((www\.)?mirardespacio\.es|([a-z0-9-]+--)?mirar-despacio\.netlify\.app)$/;

function cabeceras(origen) {
  return {
    'Access-Control-Allow-Origin': ORIGENES.test(origen || '') ? origen : 'https://mirardespacio.es',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    Vary: 'Origin',
  };
}

const pendiente = (v) => !v || /^por (determinar|confirmar|anunciar)/i.test(String(v).trim());
const pasada = (x) => x.fechaISO && new Date(x.fechaISO).getTime() + 4 * 3600e3 < Date.now();

// La próxima salida, igual que la calcula la web.
async function proximaSalida() {
  const r = await fetch(DATOS + '?t=' + Date.now(), { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error('No se pudo leer salidas-data.json');
  const d = await r.json();
  const s = (d.proximas || []).filter((x) => x.activa && !pendiente(x.fecha) && !pasada(x))[0];
  if (!s) return { conFecha: false };
  const dia = s.fechaISO ? s.fechaISO.slice(0, 10) : null;
  return {
    conFecha: true,
    dia,
    fecha: s.fecha,
    zona: pendiente(s.zona) ? '' : s.zona,
    hora: pendiente(s.hora) ? '' : s.hora,
  };
}

function leerCuerpo(event) {
  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString() : event.body || '';
  const tipo = (event.headers['content-type'] || '').toLowerCase();
  if (tipo.includes('application/json')) return JSON.parse(raw || '{}');
  return Object.fromEntries(new URLSearchParams(raw));
}

const limpio = (v, max = 200) => String(v == null ? '' : v).trim().slice(0, max);

function esMiembro(p) {
  if (!p) return false;
  if (p.subscription && p.subscription.active) return true;
  if (p.trialStart) return Date.now() - new Date(p.trialStart).getTime() < 30 * 864e5;
  return false;
}

// Busca la salida del CRM para esa fecha (o la crea). Sin fecha: una salida "Próxima salida (sin fecha)".
async function salidaDelCRM(fs, salida) {
  if (!salida.conFecha) {
    const ref = fs.collection('events').doc(SIN_FECHA);
    const snap = await ref.get();
    if (!snap.exists) await ref.set({ name: 'Próxima salida (sin fecha)', date: '', location: '', creadaDesdeWeb: true });
    return ref;
  }
  if (salida.dia) {
    const q = await fs.collection('events').where('date', '==', salida.dia).limit(1).get();
    if (!q.empty) return q.docs[0].ref;
  }
  const id = 'web-' + (salida.dia || salida.fecha.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  const ref = fs.collection('events').doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ name: salida.zona || 'Salida', date: salida.dia || '', location: '', creadaDesdeWeb: true });
  }
  return ref;
}

// Cuando ya hay fecha, la gente que se apuntó "sin fecha" pasa a esa salida (conserva su plaza).
async function pasarSinFechaA(fs, eventRef) {
  const q = await fs.collection('signups').where('eventId', '==', SIN_FECHA).get();
  if (q.empty) return 0;
  const batch = fs.batch();
  q.docs.forEach((d) => batch.update(d.ref, { eventId: eventRef.id, movidaDesdeSinFecha: true }));
  await batch.commit();
  return q.size;
}

async function personaDelCRM(fs, datos) {
  const email = datos.email.toLowerCase();
  const variantes = [...new Set([datos.email, email])];
  const q = await fs.collection('people').where('email', 'in', variantes).limit(1).get();
  if (!q.empty) {
    const doc = q.docs[0];
    const p = doc.data();
    const cambios = {};
    if (datos.apellidos && !p.apellidos) cambios.apellidos = datos.apellidos;
    if (datos.telefono && !p.telefono) cambios.telefono = datos.telefono;
    if (datos.instagram && !p.instagram) cambios.instagram = datos.instagram;
    if (datos.aceptaImagen && !p.consentImagen) cambios.consentImagen = true;
    if (Object.keys(cambios).length) await doc.ref.set(cambios, { merge: true });
    return { id: doc.id, ...p, ...cambios };
  }
  const ref = fs.collection('people').doc();
  const nueva = {
    name: datos.nombre,
    apellidos: datos.apellidos,
    email,
    telefono: datos.telefono,
    instagram: datos.instagram,
    consentImagen: datos.aceptaImagen,
    origen: 'web',
    createdAt: FieldValue.serverTimestamp(),
  };
  await ref.set(nueva);
  return { id: ref.id, ...nueva };
}

// Decide el estado dentro de una transacción para que dos inscripciones a la vez no se pisen la última plaza.
async function inscribir(fs, eventRef, persona, datos, salida) {
  return fs.runTransaction(async (tx) => {
    const ev = (await tx.get(eventRef)).data() || {};
    const lista = await tx.get(fs.collection('signups').where('eventId', '==', eventRef.id));
    const plazas = Number(ev.plazas) || PLAZAS;
    const previa = lista.docs.find((d) => d.data().personId === persona.id);
    const enEspera = (docs) => docs.filter((d) => d.data().status === 'espera');
    if (previa) {
      const st = previa.data().status;
      const pos = st === 'espera' ? enEspera(lista.docs).findIndex((d) => d.id === previa.id) + 1 : 0;
      return { status: st, yaEstaba: true, posicion: pos, plazas };
    }
    const ocupadas = lista.docs.filter((d) => d.data().status !== 'espera').length;
    const hayPlaza = !salida.conFecha || esMiembro(persona) || ocupadas < plazas;
    const status = hayPlaza ? 'confirmado' : 'espera';
    tx.set(fs.collection('signups').doc(), {
      personId: persona.id,
      eventId: eventRef.id,
      status,
      attended: false,
      origen: 'web',
      camara: datos.camara,
      mensaje: datos.mensaje,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { status, yaEstaba: false, posicion: hayPlaza ? 0 : enEspera(lista.docs).length + 1, plazas };
  });
}

function textoSalida(s) {
  return [s.fecha, s.zona, s.hora && s.hora + ' h'].filter(Boolean).join(' · ');
}

function correoPersona(datos, salida, r) {
  const hola = `Hola, ${esc(datos.nombre)}:`;
  const ya = r.yaEstaba ? ['Ya te habías apuntado antes, así que no tienes que hacer nada más. Te recuerdo cómo está tu inscripción:'] : [];
  const whatsapp = datos.telefono
    ? ['Como me has dejado tu teléfono, te añadiré a la comunidad de WhatsApp de Mirar Despacio, donde aviso de las salidas y compartimos fotos.']
    : [];
  const baja = 'Si al final no puedes venir, contéstame a este correo y le paso tu plaza a otra persona.';

  if (!salida.conFecha) {
    return {
      asunto: 'Tienes plaza en la próxima salida de Mirar Despacio',
      parrafos: [hola, ...ya,
        '<strong>Tienes plaza para la próxima salida de Mirar Despacio.</strong>',
        'Todavía no hay fecha cerrada. En cuanto la tenga te escribo con el día, la hora y el punto de encuentro.',
        'Las salidas duran unas tres horas, de 10:00 a 13:00 más o menos, y a veces acabamos con unas cervezas.',
        ...whatsapp, 'Gracias por apuntarte. ¡Nos vemos mirando despacio!'],
    };
  }
  const cuando = esc(textoSalida(salida));
  if (r.status === 'espera') {
    return {
      asunto: `Lista de espera · Salida del ${salida.fecha}`,
      parrafos: [hola, ...ya,
        `Gracias por apuntarte a la salida del <strong>${cuando}</strong>.`,
        `Esta vez ya están cubiertas las ${r.plazas} plazas, así que te he puesto en <strong>lista de espera</strong>${r.posicion ? ` (eres el número ${r.posicion})` : ''}.`,
        'Si alguien no puede venir, te escribo enseguida. Y si esta vez no hay suerte, habrá más salidas: te avisaré de la próxima.',
        ...whatsapp],
    };
  }
  return {
    asunto: `Tienes plaza · Salida del ${salida.fecha}`,
    parrafos: [hola, ...ya,
      `<strong>Tienes plaza para la salida del ${cuando}.</strong>`,
      'Dura unas tres horas y a veces acabamos con unas cervezas. Unos días antes te mando el punto exacto de encuentro.',
      baja, ...whatsapp, '¡Nos vemos mirando despacio!'],
  };
}

function correoOtto(datos, salida, r) {
  const estado = !salida.conFecha ? 'plaza (aún sin fecha)' : r.status === 'espera' ? `lista de espera (nº ${r.posicion})` : 'plaza';
  const filas = [
    ['Salida', salida.conFecha ? textoSalida(salida) : 'Próxima salida (sin fecha)'],
    ['Estado', estado + (r.yaEstaba ? ' · ya estaba apuntado/a' : '')],
    ['Nombre', `${datos.nombre} ${datos.apellidos}`],
    ['Email', datos.email],
    ['Teléfono', datos.telefono || '—'],
    ['Instagram', datos.instagram || '—'],
    ['Cámara', datos.camara || '—'],
    ['Mensaje', datos.mensaje || '—'],
  ];
  const html = `<!doctype html><html><body style="font:15px/1.5 system-ui,sans-serif;color:#1a1814;">
<p>Nueva inscripción desde mirardespacio.es. Ya está en el CRM y se le ha contestado automáticamente.</p>
<table style="border-collapse:collapse;">${filas.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6b655a;vertical-align:top;">${k}</td><td style="padding:4px 0;">${esc(v)}</td></tr>`).join('')}</table>
<p><a href="https://ottokols.es/crm/">Abrir el CRM</a></p></body></html>`;
  return {
    asunto: `Inscripción: ${datos.nombre} ${datos.apellidos} · ${estado}`,
    parrafos: filas.map(([k, v]) => `${k}: ${esc(v)}`),
    html,
  };
}

exports.handler = async (event) => {
  const h = cabeceras(event.headers.origin);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: h, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: h, body: '{}' };

  let b;
  try { b = leerCuerpo(event); } catch (e) { return { statusCode: 400, headers: h, body: '{"error":"datos"}' }; }
  // Campo trampa para bots: las personas no lo ven
  if (b.web) return { statusCode: 200, headers: h, body: JSON.stringify({ estado: 'plaza' }) };

  const datos = {
    nombre: limpio(b.nombre, 80),
    apellidos: limpio(b.apellidos, 120),
    email: limpio(b.email, 160),
    telefono: limpio(b.telefono, 40),
    instagram: limpio(b.instagram, 80),
    camara: limpio(b.camara, 60),
    mensaje: limpio(b.mensaje, 2000),
    aceptaImagen: b.acepta_imagen === 'si',
  };
  if (!datos.nombre || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email) || b.acepta_datos !== 'si') {
    return { statusCode: 400, headers: h, body: '{"error":"faltan datos"}' };
  }

  let salida, r;
  try {
    const fs = db();
    salida = await proximaSalida();
    const eventRef = await salidaDelCRM(fs, salida);
    if (salida.conFecha) await pasarSinFechaA(fs, eventRef);
    const persona = await personaDelCRM(fs, datos);
    r = await inscribir(fs, eventRef, persona, datos, salida);
  } catch (e) {
    console.error('inscripcion', e);
    return { statusCode: 500, headers: h, body: '{"error":"crm"}' };
  }

  // Los correos no deben tumbar la inscripción, que ya está guardada.
  let correoEnviado = false;
  try {
    const c = correoPersona(datos, salida, r);
    correoEnviado = await enviar({ para: datos.email, asunto: c.asunto, parrafos: c.parrafos });
    const o = correoOtto(datos, salida, r);
    await enviar({ para: process.env.GMAIL_USER, asunto: o.asunto, parrafos: o.parrafos, html: o.html, responderA: datos.email });
  } catch (e) {
    console.error('correo', e);
  }

  const estado = !salida.conFecha ? 'sin-fecha' : r.status === 'espera' ? 'espera' : 'plaza';
  return {
    statusCode: 200,
    headers: h,
    body: JSON.stringify({
      estado,
      posicion: r.posicion,
      yaEstaba: r.yaEstaba,
      salida: salida.conFecha ? textoSalida(salida) : '',
      correo: correoEnviado,
      avisos: hayCorreo() ? undefined : 'sin-correo',
    }),
  };
};
