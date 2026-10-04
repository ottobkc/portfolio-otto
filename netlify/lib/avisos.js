// Avisos por email a los miembros de Mirar Despacio+ (reto nuevo, recordatorio, galería abierta)
// y enlaces de baja firmados (sin cuenta ni contraseña).
// Son comunicaciones del propio servicio MD+; aun así cada email lleva su enlace para dejar de recibirlas.
const crypto = require('crypto');
const { listarUsuarios } = require('./identidad');
const { enviar, esc } = require('./correo');
const { tarjeta, aTexto } = require('./plantillas-salida');

const BAJA = 'https://ottokols.es/.netlify/functions/baja-avisos';
const RETOS = 'https://ottokols.es/retos/';

function secreto() {
  const s = process.env.AVISOS_SECRET || process.env.FIREBASE_PRIVATE_KEY || '';
  if (!s) throw new Error('sin-secreto');
  return s;
}
const firmar = (email, tipo) => crypto.createHmac('sha256', secreto()).update(tipo + ':' + String(email).toLowerCase()).digest('hex').slice(0, 32);
function firmaValida(email, tipo, t) {
  const a = Buffer.from(firmar(email, tipo)), b = Buffer.from(String(t || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const urlBaja = (email, tipo) => `${BAJA}?tipo=${tipo}&e=${encodeURIComponent(String(email).toLowerCase())}&t=${firmar(email, tipo)}`;

// Miembros MD+ con cuenta confirmada que no se han dado de baja de los avisos del reto
async function miembrosConAvisos(context, fs) {
  const usuarios = (await listarUsuarios(context)).filter((u) => {
    const roles = (u.app_metadata && u.app_metadata.roles) || [];
    return u.confirmed_at && roles.includes('member') && u.email;
  });
  const prefs = await fs.collection('preferencias').where('sinAvisosRetos', '==', true).get();
  const fuera = new Set(prefs.docs.map((d) => d.id));
  return usuarios.filter((u) => !fuera.has(u.email.toLowerCase()))
    .map((u) => ({ email: u.email.toLowerCase(), nombre: ((u.user_metadata && u.user_metadata.full_name) || '').split(' ')[0] }));
}

const fechaCierre = (iso) => {
  if (!iso) return '';
  const t = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' }).format(new Date(iso + 'T12:00:00'));
  return t.charAt(0).toUpperCase() + t.slice(1).replace(',', '');
};

// tipo: 'nuevo' | 'recordatorio' | 'galeria'
function correoReto(tipo, reto, m) {
  const baja = `<span style="font-size:13px;color:#8a8378;">Te escribo porque eres de Mirar Despacio+. ¿No quieres estos avisos? <a href="${urlBaja(m.email, 'retos')}" style="color:#8a8378;">Deja de recibirlos</a>.</span>`;
  const T = {
    nuevo: {
      asunto: `Nuevo reto del mes: ${reto.titulo}`,
      intro: ['Ya está abierto el reto de este mes. Lo puedes hacer donde vivas, con la cámara que tengas.'],
      filas: [['📷', esc(reto.titulo)], ...(reto.cierre ? [['⏳', 'Hasta el ' + esc(fechaCierre(reto.cierre).toLowerCase())]] : [])],
      boton: { url: RETOS, texto: 'Ver el reto', antes: reto.enunciado ? esc(reto.enunciado).replace(/\n/g, '<br>') : '' },
      cuerpo: ['Cuando cierre, podrás ver cómo lo han resuelto los demás.'],
    },
    recordatorio: {
      asunto: `Quedan 3 días para el reto: ${reto.titulo}`,
      intro: ['El reto de este mes cierra en tres días y todavía no tengo tu foto. No tiene que ser perfecta: lo interesante es ponerse a mirar.'],
      filas: [['📷', esc(reto.titulo)], ['⏳', 'Cierra el ' + esc(fechaCierre(reto.cierre).toLowerCase())]],
      boton: { url: RETOS, texto: 'Mandar mi foto', antes: '' },
      cuerpo: [],
    },
    galeria: {
      asunto: `Ya puedes ver las fotos del reto: ${reto.titulo}`,
      intro: ['El reto ha cerrado y ya puedes ver cómo lo han resuelto los demás miembros.'],
      filas: [['🖼️', esc(reto.titulo)], ...(reto.fotos ? [['👀', reto.fotos + ' fotos compartidas']] : [])],
      boton: { url: RETOS, texto: 'Ver la galería', antes: '' },
      cuerpo: [],
    },
  }[tipo];
  const html = tarjeta({ titulo: T.asunto, nombre: m.nombre, intro: T.intro, filas: T.filas, calendario: null, boton: T.boton, cuerpo: [...T.cuerpo, baja] });
  return { asunto: T.asunto, html, texto: aTexto(html) };
}

// Envía a una lista, de 5 en 5, y devuelve cuántos han salido
async function enviarATodos(lista, crear) {
  let ok = 0;
  for (let i = 0; i < lista.length; i += 5) {
    const r = await Promise.all(lista.slice(i, i + 5).map((m) => {
      const c = crear(m);
      return enviar({ para: m.email, asunto: c.asunto, html: c.html, texto: c.texto }).catch((e) => { console.error('aviso', m.email, e.message); return false; });
    }));
    ok += r.filter(Boolean).length;
  }
  return ok;
}

module.exports = { firmar, firmaValida, urlBaja, miembrosConAvisos, correoReto, enviarATodos, fechaCierre };
