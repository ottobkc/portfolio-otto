// Acciones del CRM que necesitan el servidor. Solo para Otto: el CRM manda su sesión de Firebase
// (Authorization: Bearer <idToken>) y aquí se comprueba que es la cuenta de administración.
//
//  POST {accion:'avisar', id}                 -> email al autor: "Otto ha comentado tu foto"
//  POST {accion:'cuentas'}                    -> lista de cuentas de Netlify Identity con su acceso
//  POST {accion:'acceso', id, acceso}         -> acceso = 'plus' | 'fotos' | 'ninguno' (la cuenta no se borra)
//  POST {accion:'invitar', email, acceso}     -> invita a alguien ('fotos' = solo cuaderno de fotos)
//  POST {accion:'enlace', personId}           -> enlace personal para subir fotos sin cuenta (para copiar a WhatsApp)
//  POST {accion:'enlaces', eventId, reenviar} -> manda por email su enlace a la gente de esa salida
//        (si en la salida hay alguien marcado como "asistió", solo a los que asistieron)
const crypto = require('crypto');
const { getAuth } = require('firebase-admin/auth');
const { db, FieldValue } = require('../lib/firestore');
const { listarUsuarios, ponerRoles, rolesPara, invitarCon } = require('../lib/identidad');
const { enviar, esc } = require('../lib/correo');
const { tarjeta, aTexto } = require('../lib/plantillas-salida');

// La misma cuenta que tiene permiso en las reglas de Firestore (crm/firestore.rules)
const ADMIN = (process.env.CRM_ADMIN || 'ottobkc@gmail.com').toLowerCase();
const CUADERNO = 'https://ottokols.es/cuaderno/';
const RETOS = 'https://ottokols.es/retos/';
const MURO = 'https://mirardespacio.es/muro/';
const SUBIR = 'https://ottokols.es/subir/?c=';

// Clave del enlace personal (se crea una vez por persona y se reutiliza)
async function claveDe(ref, p) {
  if (p.claveFotos) return p.claveFotos;
  const clave = crypto.randomBytes(12).toString('hex');
  await ref.update({ claveFotos: clave });
  return clave;
}

function correoEnlace(p, ev, url) {
  const fecha = ev.date ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' }).format(new Date(ev.date + 'T12:00:00')) : '';
  const html = tarjeta({
    titulo: 'Sube tus fotos de la salida · Mirar Despacio',
    nombre: p.name || '',
    intro: [`Gracias por venir a la salida${fecha ? ' del ' + fecha : ''}${ev.location ? ' por ' + esc(ev.location) : ''}.`,
      'Si te apetece, sube tus fotos favoritas (hasta 5) y te digo lo que veo en cada una. Es muy sencillo: pulsas el botón, eliges las fotos del móvil o del ordenador y listo.'],
    filas: [['🔑', 'No necesitas contraseña: el enlace es solo tuyo.'], ['💬', 'Te aviso por email cuando las comente.']],
    calendario: null,
    boton: { url, texto: '📷 Subir mis fotos', antes: '' },
    cuerpo: ['Guarda este email: el mismo enlace te sirve para las próximas salidas y para ver mis comentarios.'],
  });
  return { asunto: 'Sube tus fotos de la salida · Mirar Despacio', html, texto: aTexto(html) };
}

const res = (code, obj) => ({ statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });
const accesoDe = (roles) => (roles.includes('admin') ? 'admin' : roles.includes('member') ? 'plus' : roles.includes('participante') ? 'fotos' : 'ninguno');

function correoComentario(f) {
  const enMuro = f.enMuro && f.publicable;
  const html = tarjeta({
    titulo: 'Te he comentado una foto · Mirar Despacio',
    nombre: (f.nombreCuenta || f.nombreMuro || '').split(' ')[0],
    intro: [f.tipo === 'reto'
      ? `He visto tu foto para el reto <em>${esc(f.refNombre || '')}</em> y te he dejado un comentario.`
      : `He visto la foto que subiste${f.refNombre ? ` de <em>${esc(f.refNombre)}</em>` : ''} y te he dejado un comentario.`],
    filas: [['💬', esc(f.comentario).replace(/\n/g, '<br>')]],
    calendario: null,
    boton: f.tipo === 'reto' ? { url: RETOS, texto: 'Ver el comentario', antes: '' }
      : { url: f.enlace || CUADERNO, texto: 'Ver el comentario', antes: '' },
    cuerpo: [
      enMuro
        ? `Además la he colgado en el <a href="${MURO}" style="color:#e8347a;">muro de Mirar Despacio</a>${f.destacada ? ', como foto destacada' : ''}. Si prefieres que no esté, puedes quitarla desde tu cuaderno.`
        : 'Sigue subiendo: cuantas más vea, mejor te puedo decir hacia dónde tirar.',
    ],
  });
  return { asunto: 'Te he comentado una foto · Mirar Despacio', html, texto: aTexto(html) };
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return res(405, {});
  try {
    const fs = db(); // inicia firebase-admin
    const token = (event.headers.authorization || '').replace(/^Bearer\s+/i, '');
    let quien;
    try { quien = await getAuth().verifyIdToken(token); } catch (e) { return res(401, { error: 'sesion' }); }
    if ((quien.email || '').toLowerCase() !== ADMIN) return res(403, { error: 'no-admin' });

    const b = JSON.parse(event.body || '{}');

    if (b.accion === 'avisar') {
      const ref = fs.collection('fotos').doc(String(b.id || ''));
      const snap = await ref.get();
      if (!snap.exists) return res(404, { error: 'no-existe' });
      const f = snap.data();
      if (!f.comentario || !f.email) return res(400, { error: 'sin-comentario' });
      if (f.origen === 'enlace' && f.personaId) {
        const pRef = fs.collection('people').doc(f.personaId);
        const pSnap = await pRef.get();
        if (pSnap.exists) f.enlace = SUBIR + (await claveDe(pRef, pSnap.data()));
      }
      const c = correoComentario(f);
      const ok = await enviar({ para: f.email, asunto: c.asunto, html: c.html, texto: c.texto });
      if (ok) await ref.update({ avisadoEn: FieldValue.serverTimestamp() });
      return res(200, { ok });
    }

    if (b.accion === 'cuentas') {
      const lista = await listarUsuarios(context);
      return res(200, lista.map((u) => {
        const roles = (u.app_metadata && u.app_metadata.roles) || [];
        return {
          id: u.id, email: u.email, nombre: (u.user_metadata && u.user_metadata.full_name) || '',
          acceso: accesoDe(roles), confirmada: !!u.confirmed_at, creada: u.created_at, ultimoLogin: u.last_sign_in_at || null,
        };
      }));
    }

    if (b.accion === 'acceso') {
      if (!['plus', 'fotos', 'ninguno'].includes(b.acceso)) return res(400, { error: 'acceso' });
      const u = (await listarUsuarios(context)).find((x) => x.id === b.id);
      if (!u) return res(404, { error: 'no-existe' });
      const actuales = (u.app_metadata && u.app_metadata.roles) || [];
      if (actuales.includes('admin')) return res(400, { error: 'es-admin' });
      await ponerRoles(context, u.id, rolesPara(actuales, b.acceso));
      await fs.collection('cambios_acceso').add({
        userId: u.id, email: u.email, antes: accesoDe(actuales), ahora: b.acceso, fecha: FieldValue.serverTimestamp(),
      });
      return res(200, { ok: true });
    }

    if (b.accion === 'invitar') {
      const email = String(b.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res(400, { error: 'email' });
      const acceso = b.acceso === 'plus' ? 'plus' : 'fotos';
      const estado = await invitarCon(context, email, acceso, { bajar: false });
      return res(200, { estado });
    }

    if (b.accion === 'enlace') {
      const ref = fs.collection('people').doc(String(b.personId || ''));
      const snap = await ref.get();
      if (!snap.exists) return res(404, { error: 'no-existe' });
      if (!snap.data().email) return res(400, { error: 'sin-email' });
      return res(200, { url: SUBIR + (await claveDe(ref, snap.data())) });
    }

    if (b.accion === 'enlaces') {
      const evSnap = await fs.collection('events').doc(String(b.eventId || '')).get();
      if (!evSnap.exists) return res(404, { error: 'no-existe' });
      const ev = evSnap.data();
      const q = await fs.collection('signups').where('eventId', '==', evSnap.id).get();
      let lista = q.docs.filter((d) => d.data().status !== 'espera');
      if (lista.some((d) => d.data().attended)) lista = lista.filter((d) => d.data().attended);
      let enviados = 0, saltados = 0, sinEmail = 0;
      for (const s of lista) {
        if (s.data().enlaceFotosEn && !b.reenviar) { saltados++; continue; }
        const pRef = fs.collection('people').doc(s.data().personId);
        const pSnap = await pRef.get();
        const p = pSnap.exists ? pSnap.data() : null;
        if (!p || !p.email) { sinEmail++; continue; }
        const c = correoEnlace(p, ev, SUBIR + (await claveDe(pRef, p)));
        if (await enviar({ para: p.email, asunto: c.asunto, html: c.html, texto: c.texto })) {
          await s.ref.update({ enlaceFotosEn: FieldValue.serverTimestamp() });
          enviados++;
        }
      }
      return res(200, { enviados, saltados, sinEmail });
    }

    return res(400, { error: 'accion' });
  } catch (e) {
    console.error('fotos-admin', e);
    return res(500, { error: 'servidor', detalle: e.message });
  }
};
