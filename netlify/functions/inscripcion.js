// Inscripción a las salidas de Mirar Despacio (formulario de mirardespacio.es/salidas/).
// 1. Guarda a la persona y su inscripción en el CRM (Firestore: people + signups).
// 2. Decide si tiene plaza o va a lista de espera (PLAZAS por salida; el campo "plazas"
//    de la salida en el CRM lo cambia). Sin fecha todavía: siempre tiene plaza.
// 3. Le contesta por email desde info@mirardespacio.es y te avisa a ti.
// Si algo falla devuelve error y la web manda el formulario por Formspree como antes.
const { db, FieldValue } = require('../lib/firestore');
const { enviar, esc, remitente, hayCorreo } = require('../lib/correo');
const { tarjeta, recibido, fechaLarga, enlacesCalendario, aTexto } = require('../lib/plantillas-salida');

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
    iso: s.fechaISO || '',
    finISO: s.fechaFinISO || '',
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
  const ya = r.yaEstaba ? 'Por cierto, ya te habías apuntado antes, así que no tienes que hacer nada más.' : '';

  if (!salida.conFecha) {
    const html = recibido({
      titulo: 'Recibido — próxima salida Mirar Despacio',
      cabecera: `Recibido${datos.nombre ? ', ' + esc(datos.nombre) : ''}.`,
      parrafos: [
        'Ya tienes plaza para la próxima salida de Mirar Despacio.',
        'Todavía no hay fecha ni barrio decididos — en cuanto los tenga cerrados, te aviso por aquí con todos los detalles.',
        ...(ya ? [ya] : []),
      ],
      estado: 'Plaza reservada, a la espera de fecha y barrio',
    });
    return { asunto: 'Recibido — próxima salida de Mirar Despacio', html };
  }

  const filas = [['📅', esc(fechaLarga(salida.iso, salida.fecha))]];
  if (salida.hora) filas.push(['🕙', esc(salida.hora) + 'h']);
  if (salida.zona) filas.push(['📍', 'Zona ' + esc(salida.zona)]);

  if (r.status === 'espera') {
    const html = tarjeta({
      titulo: 'Lista de espera · Mirar Despacio',
      nombre: datos.nombre,
      intro: [`Gracias por apuntarte a la próxima salida de Mirar Despacio. Esta vez ya están cubiertas las ${r.plazas} plazas, así que te apunto en la lista de espera:`],
      filas: [...filas, ['⏳', 'Lista de espera' + (r.posicion ? ' · nº ' + r.posicion : '')]],
      calendario: null,
      cuerpo: [
        'Si alguien no puede venir, te escribo enseguida para ofrecerte la plaza.',
        'Y si esta vez no hay suerte, te aviso de la próxima salida.',
        ...(ya ? [ya] : []),
      ],
    });
    return { asunto: `Lista de espera · Salida del ${fechaLarga(salida.iso, salida.fecha).toLowerCase()}`, html };
  }

  const html = tarjeta({
    titulo: 'Próxima salida de Mirar Despacio',
    nombre: datos.nombre,
    intro: ['Te confirmo tu plaza, así como la fecha y el barrio de la próxima salida de Mirar Despacio:'],
    filas,
    calendario: enlacesCalendario(salida),
    cuerpo: [
      'El punto de encuentro exacto y el resto de detalles (dinámica del día, qué traer, duración aproximada) te los mando en un mail unos días antes.',
      'De momento, apunta la fecha. Nos vemos en la calle.',
      'Si por lo que sea ese día no puedes, avísame para liberar la plaza.',
      ...(ya ? [ya] : []),
    ],
  });
  return { asunto: `Tienes plaza · Salida del ${fechaLarga(salida.iso, salida.fecha).toLowerCase()}`, html };
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
    correoEnviado = await enviar({ para: datos.email, asunto: c.asunto, html: c.html, texto: aTexto(c.html) });
    const o = correoOtto(datos, salida, r);
    await enviar({ para: remitente(), asunto: o.asunto, html: o.html, texto: aTexto(o.html), responderA: datos.email });
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

// Para generar las vistas previas de los correos
exports._correoPersona = correoPersona;
