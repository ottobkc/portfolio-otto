// Sesiones navideñas de ottokols.es/navidad/
//  GET  -> días y huecos libres de cada modalidad (para el calendario de la página)
//  POST -> solicitud de reserva: bloquea el hueco, la guarda en Firestore y te avisa por correo.
// La reserva queda "pendiente" hasta que Otto confirma y manda el enlace de pago.
// Para liberar un hueco: borrar sus documentos en la colección navidad_huecos
// (cada documento lleva el id de la reserva) y marcar la reserva como cancelada.
const { db } = require('../lib/firestore');
const { permitir } = require('../lib/limite');
const { enviar, esc, remitente } = require('../lib/correo');
const { CALLE, CASA, BLOQUEA, MODALIDADES, ZONAS } = require('../lib/navidad');

const JSON_H = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const resp = (code, obj) => ({ statusCode: code, headers: JSON_H, body: JSON.stringify(obj) });
const MARGEN_H = 20; // horas mínimas de antelación para reservar

const momento = (dia, hora) => new Date(`${dia}T${hora}:00+01:00`); // diciembre: hora de Madrid = UTC+1
const clave = (tipo, dia, hora) => `${tipo}_${dia}_${hora.replace(':', '')}`;

// Qué huecos (documentos de bloqueo) necesita una reserva
function necesita(modalidad, dia, hora) {
  const m = MODALIDADES[modalidad];
  if (!m || !m.tipo) return null;
  const horas = (m.tipo === 'calle' ? CALLE : CASA)[dia];
  if (!horas) return null;
  const i = horas.indexOf(hora);
  if (i < 0) return null;
  if (m.tipo === 'calle') {
    if (m.huecos === 2) {
      if (!horas[i + 1]) return null;
      return [clave('calle', dia, hora), clave('calle', dia, horas[i + 1])];
    }
    return [clave('calle', dia, hora)];
  }
  const lista = [clave('casa', dia, hora)];
  if (BLOQUEA[hora] && (CALLE[dia] || []).includes(BLOQUEA[hora])) lista.push(clave('calle', dia, BLOQUEA[hora]));
  return lista;
}

async function ocupados(fs) {
  const q = await fs.collection('navidad_huecos').get();
  return new Set(q.docs.map((d) => d.id));
}

function disponibilidad(tomados) {
  const limite = Date.now() + MARGEN_H * 3600e3;
  const out = {};
  for (const mod of ['mini', 'paseo', 'casa']) {
    const tabla = MODALIDADES[mod].tipo === 'calle' ? CALLE : CASA;
    out[mod] = Object.keys(tabla).sort().map((dia) => ({
      dia,
      horas: tabla[dia]
        .filter((h) => momento(dia, h).getTime() > limite)
        .filter((h) => { const n = necesita(mod, dia, h); return n && n.every((k) => !tomados.has(k)); }),
    })).filter((d) => d.horas.length);
  }
  return out;
}

const limpio = (s, n = 200) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

exports.handler = async (event) => {
  let fs;
  try { fs = db(); } catch (e) { return resp(503, { error: 'no-disponible' }); }

  if (event.httpMethod === 'GET') {
    try {
      const tomados = await ocupados(fs);
      const modalidades = Object.fromEntries(Object.entries(MODALIDADES).map(([k, v]) => [k, { nombre: v.nombre, precio: v.precio, detalle: v.detalle }]));
      return resp(200, { disponibilidad: disponibilidad(tomados), modalidades, zonas: ZONAS });
    } catch (e) {
      console.error('navidad GET', e);
      return resp(500, { error: 'error' });
    }
  }

  if (event.httpMethod !== 'POST') return resp(405, { error: 'metodo' });

  let d;
  try { d = JSON.parse(event.body || '{}'); } catch (e) { return resp(400, { error: 'datos' }); }
  if (d.web) return resp(200, { ok: true }); // campo trampa para bots

  const modalidad = limpio(d.modalidad, 10);
  const nombre = limpio(d.nombre, 80);
  const email = limpio(d.email, 120).toLowerCase();
  if (!MODALIDADES[modalidad] || !nombre || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || d.acepta !== true) {
    return resp(400, { error: 'faltan-datos' });
  }
  if (!(await permitir(fs, event, 'navidad', 6))) return resp(429, { error: 'demasiadas' });

  const m = MODALIDADES[modalidad];
  const dia = limpio(d.dia, 10);
  const hora = limpio(d.hora, 5);
  const reserva = {
    modalidad, nombre, email,
    telefono: limpio(d.telefono, 30),
    personas: limpio(d.personas, 40),
    zona: m.tipo === 'calle' ? limpio(d.zona, 60) : '',
    direccion: m.tipo === 'casa' ? limpio(d.direccion, 160) : '',
    bono: modalidad === 'bono' ? { para: limpio(d.bono_para, 80), sesion: limpio(d.bono_sesion, 40) } : null,
    mensaje: limpio(d.mensaje, 1500),
    dia: m.tipo ? dia : '', hora: m.tipo ? hora : '',
    precio: m.precio,
    estado: 'pendiente',
    creada: new Date(),
  };

  const ref = fs.collection('navidad_reservas').doc();
  try {
    if (m.tipo) {
      const claves = necesita(modalidad, dia, hora);
      if (!claves || momento(dia, hora).getTime() < Date.now() + MARGEN_H * 3600e3) return resp(400, { error: 'hueco' });
      await fs.runTransaction(async (t) => {
        const docs = await Promise.all(claves.map((k) => t.get(fs.collection('navidad_huecos').doc(k))));
        if (docs.some((x) => x.exists)) throw Object.assign(new Error('ocupado'), { ocupado: true });
        claves.forEach((k) => t.set(fs.collection('navidad_huecos').doc(k), { reserva: ref.id, creada: new Date() }));
        t.set(ref, { ...reserva, huecos: claves });
      });
    } else {
      await ref.set(reserva);
    }
  } catch (e) {
    if (e.ocupado) return resp(409, { error: 'ocupado' });
    console.error('navidad POST', e);
    return resp(500, { error: 'error' });
  }

  // Aviso a Otto (le puede responder directamente: responder-a es el cliente)
  try {
    const cuando = m.tipo ? `${dia} a las ${hora}` : 'sin fecha (bono)';
    const filas = [
      ['Modalidad', `${m.nombre}${m.precio ? ' · ' + m.precio + ' €' : ''}`],
      ['Cuándo', cuando],
      ['Nombre', nombre], ['Email', email], ['Teléfono', reserva.telefono],
      ['Quiénes', reserva.personas], ['Zona', reserva.zona], ['Dirección / barrio', reserva.direccion],
      ['Bono para', reserva.bono && reserva.bono.para], ['Bono de', reserva.bono && reserva.bono.sesion],
      ['Mensaje', reserva.mensaje], ['Id', ref.id],
    ].filter(([, v]) => v);
    const html = `<p>Nueva solicitud de sesión navideña:</p><table cellpadding="4">${filas.map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join('')}</table><p>Contesta a este correo para escribirle. Recuerda mandarle el enlace de pago.</p>`;
    const texto = filas.map(([k, v]) => `${k}: ${v}`).join('\n');
    await enviar({ para: process.env.AVISO_OTTOKOLS || 'ottobkc@gmail.com', asunto: `Navidad · ${m.nombre} · ${cuando} · ${nombre}`, html, texto, responderA: email, nombre: 'ottokols.es' });
  } catch (e) {
    console.warn('navidad aviso', e.message, remitente());
  }

  return resp(200, { ok: true, id: ref.id });
};
