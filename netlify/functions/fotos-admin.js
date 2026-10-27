// Acciones del CRM que necesitan el servidor. Solo para Otto: el CRM manda su sesión de Firebase
// (Authorization: Bearer <idToken>) y aquí se comprueba que es la cuenta de administración.
//
//  POST {accion:'avisar', id}                 -> email al autor: "Otto ha comentado tu foto"
//  POST {accion:'cuentas'}                    -> lista de cuentas de Netlify Identity con su acceso
//  POST {accion:'acceso', id, acceso}         -> acceso = 'plus' | 'fotos' | 'ninguno' (la cuenta no se borra)
//  POST {accion:'invitar', email, acceso}     -> invita a alguien ('fotos' = solo cuaderno de fotos)
//  POST {accion:'enlace', personId}           -> enlace personal para subir fotos sin cuenta (para copiar a WhatsApp)
//  POST {accion:'plus-alta', personId, meses, nivel, desde} / {accion:'plus-baja', personId, dejarFotos} / {accion:'plus-prueba', personId}
//  POST {accion:'avisar-reto', retoId}       -> email «nuevo reto» a los miembros MD+
//  POST {accion:'confirmacion', signupId}     -> le manda el mismo correo que la web (plaza / lista de espera / sin fecha)
//  POST {accion:'enlaces', eventId, reenviar} -> manda por email su enlace a la gente de esa salida
//        (si en la salida hay alguien marcado como "asistió", solo a los que asistieron)
const crypto = require('crypto');
const { verificarToken } = require('../lib/sesion-firebase');
const { db, FieldValue } = require('../lib/firestore');
const cuentas = require('../lib/cuentas');
const { rolesPara, invitarCon, accesoDe } = cuentas;
const { enviar, esc } = require('../lib/correo');
const { tarjeta, aTexto } = require('../lib/plantillas-salida');
const inscripcion = require('./inscripcion');
const { miembrosConAvisos, correoReto, enviarATodos } = require('../lib/avisos');
const plus = require('../lib/plus');
const { SALIDA_DIAS, RETOS_GUARDADOS } = require('../lib/fotos-config');

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
      'Si te apetece, sube tus fotos favoritas (hasta 5) y te digo lo que veo en cada una. Es muy sencillo: pulsas el botón, eliges las fotos del móvil o del ordenador y listo.',
      'Una cosa importante: <strong>en el recuadro de cada foto escribe qué reto era</strong> (el nivel y el número de tu ficha, por ejemplo «Medio 7», o el número de la tarjeta del relato, por ejemplo «Relato 3»). Así sé qué estabas buscando.'],
    filas: [['🔑', 'No necesitas contraseña: el enlace es solo tuyo.'], ['🏷️', 'Escribe en cada foto qué reto era.'], ['💬', 'Te aviso por email cuando las comente.']],
    calendario: null,
    boton: { url, texto: '📷 Subir mis fotos', antes: '' },
    cuerpo: ['Guarda este email: el mismo enlace te sirve para las próximas salidas y para ver mis comentarios.',
      `<span style="font-size:13px;color:#8a8378;">Las fotos se guardan ${SALIDA_DIAS} días después de cada salida.</span>`],
  });
  return { asunto: 'Sube tus fotos de la salida · Mirar Despacio', html, texto: aTexto(html) };
}

const res = (code, obj) => ({ statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });

// Enlace a la foto concreta (abre su hilo para responder)
function enlaceFoto(f) {
  const base = f.tipo === 'reto' ? RETOS : (f.enlace || CUADERNO);
  return base + '#foto-' + f.id;
}

function correoRespuesta(f, texto) {
  const html = tarjeta({
    titulo: 'Te he respondido · Mirar Despacio',
    nombre: (f.nombreCuenta || f.nombreMuro || '').split(' ')[0],
    intro: [`Te he respondido en el hilo de tu foto${f.refNombre ? ` de <em>${esc(f.refNombre)}</em>` : ''}.`],
    filas: [['💬', esc(texto).replace(/\n/g, '<br>')]],
    calendario: null,
    boton: { url: enlaceFoto(f), texto: 'Ver y responder', antes: '' },
    cuerpo: ['Puedes contestarme desde ese botón: la conversación solo la vemos tú y yo.'],
  });
  return { asunto: 'Te he respondido · Mirar Despacio', html, texto: aTexto(html) };
}

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
    boton: { url: enlaceFoto(f), texto: 'Ver y responder', antes: '' },
    cuerpo: [
      'Si quieres contestarme o preguntarme algo, pulsa el botón y escríbelo en el hilo de la foto: solo lo vemos tú y yo.',
      enMuro
        ? `Además la he colgado en el <a href="${MURO}" style="color:#e8347a;">muro de Mirar Despacio</a>${f.destacada ? ', como foto destacada' : ''}. Si prefieres que no esté, puedes quitarla desde ${f.tipo === 'taller' ? 'el manual del taller' : 'tu cuaderno'}.`
        : 'Sigue subiendo: cuantas más vea, mejor te puedo decir hacia dónde tirar.',
      `<span style="font-size:13px;color:#8a8378;">${f.tipo === 'reto'
        ? `Las fotos de los retos se guardan mientras estén entre los ${RETOS_GUARDADOS} últimos`
        : f.tipo === 'taller' ? `Las fotos de los ejercicios del taller se guardan ${SALIDA_DIAS} días`
        : `Las fotos de las salidas se guardan ${SALIDA_DIAS} días`}${enMuro ? ' (las del muro, siempre)' : ''}.${f.tipo === 'taller' ? '' : ' Si quieres conservarla con el comentario, usa el botón «Guardar para Instagram» y quedará en tu móvil.'}</span>`,
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
    try { quien = await verificarToken(token); } catch (e) { return res(401, { error: 'sesion' }); }
    if ((quien.email || '').toLowerCase() !== ADMIN) return res(403, { error: 'no-admin' });

    const b = JSON.parse(event.body || '{}');

    if (b.accion === 'borrar-foto') {
      const ref = fs.collection('fotos').doc(String(b.id || ''));
      const snap = await ref.get();
      if (!snap.exists) return res(404, { error: 'no-existe' });
      const f = snap.data();
      let cloudinary = 'no-aplica';
      const m = String(f.url || '').match(/^https:\/\/res\.cloudinary\.com\/dybxateci\/image\/upload\/(?:[^/]+\/)*?(?:v\d+\/)?(.+)\.[a-z0-9]+$/i);
      if (m && b.cloudinary !== false) {
        const { CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
        if (!key || !secret) return res(500, { error: 'faltan-claves-cloudinary' });
        const auth = 'Basic ' + Buffer.from(key + ':' + secret).toString('base64');
        const r = await fetch('https://api.cloudinary.com/v1_1/dybxateci/resources/image/upload?public_ids[]=' + encodeURIComponent(decodeURIComponent(m[1])) + '&invalidate=true', { method: 'DELETE', headers: { Authorization: auth } });
        if (!r.ok) return res(502, { error: 'cloudinary-' + r.status });
        const j = await r.json();
        cloudinary = Object.values(j.deleted || {})[0] || 'desconocido';
      }
      await ref.delete();
      return res(200, { ok: true, cloudinary });
    }

    if (b.accion === 'responder') {
      const ref = fs.collection('fotos').doc(String(b.id || ''));
      const snap = await ref.get();
      if (!snap.exists) return res(404, { error: 'no-existe' });
      const f = { ...snap.data(), id: snap.id };
      const texto = String(b.texto || '').replace(/\r/g, '').trim().slice(0, 1500);
      if (!texto || !f.email) return res(400, { error: 'vacio' });
      if ((f.hilo || []).length >= 60) return res(400, { error: 'hilo-lleno' });
      if (f.origen === 'enlace' && f.personaId) {
        const pRef = fs.collection('people').doc(f.personaId);
        const pSnap = await pRef.get();
        if (pSnap.exists) f.enlace = SUBIR + (await claveDe(pRef, pSnap.data()));
      }
      await ref.update({ hilo: FieldValue.arrayUnion({ de: 'otto', texto, en: Date.now(), origen: 'crm' }), sinLeer: false });
      const c = correoRespuesta(f, texto);
      const ok = await enviar({ para: f.email, asunto: c.asunto, html: c.html, texto: c.texto }).catch((e) => { console.error('correo respuesta', e.message); return false; });
      return res(200, { ok: true, enviado: !!ok });
    }

    if (b.accion === 'avisar') {
      const ref = fs.collection('fotos').doc(String(b.id || ''));
      const snap = await ref.get();
      if (!snap.exists) return res(404, { error: 'no-existe' });
      const f = { ...snap.data(), id: snap.id };
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
      const lista = await cuentas.listar(context);
      return res(200, lista.map((u) => ({
        id: u.id, email: u.email, nombre: u.nombre,
        acceso: accesoDe(u.roles), manuales: cuentas.manualesDe(u.roles),
        confirmada: u.confirmada, creada: u.creada, ultimoLogin: u.ultimoLogin,
      })));
    }

    if (b.accion === 'acceso') {
      if (!['plus', 'fotos', 'ninguno'].includes(b.acceso)) return res(400, { error: 'acceso' });
      const u = await cuentas.porId(context, String(b.id || ''));
      if (!u) return res(404, { error: 'no-existe' });
      const actuales = u.roles;
      if (actuales.includes('admin')) return res(400, { error: 'es-admin' });
      await cuentas.ponerRoles(context, u, rolesPara(actuales, b.acceso));
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

    // El mismo correo que manda la web al apuntarse, para quien se añade o se mueve desde el CRM
    if (b.accion === 'confirmacion') {
      const sRef = fs.collection('signups').doc(String(b.signupId || ''));
      const sSnap = await sRef.get();
      if (!sSnap.exists) return res(404, { error: 'no-existe' });
      const su = sSnap.data();
      const pSnap = await fs.collection('people').doc(su.personId).get();
      const p = pSnap.exists ? pSnap.data() : null;
      if (!p || !p.email) return res(400, { error: 'sin-email' });
      const evSnap = await fs.collection('events').doc(su.eventId).get();
      const ev = evSnap.exists ? evSnap.data() : {};
      const salida = await inscripcion._salidaDeEvento(su.eventId, ev);
      let posicion = 0;
      if (su.status === 'espera') {
        const q = await fs.collection('signups').where('eventId', '==', su.eventId).where('status', '==', 'espera').get();
        const orden = q.docs.map((d) => ({ id: d.id, t: (d.data().createdAt && d.data().createdAt.toMillis) ? d.data().createdAt.toMillis() : 0 })).sort((a, z) => a.t - z.t);
        posicion = orden.findIndex((x) => x.id === sSnap.id) + 1;
      }
      const r = { status: su.status === 'espera' ? 'espera' : 'confirmado', yaEstaba: false, posicion, plazas: Number(ev.plazas) || inscripcion._PLAZAS };
      const c = inscripcion._correoPersona({ nombre: p.name || '' }, salida, r);
      const ok = await enviar({ para: p.email, asunto: c.asunto, html: c.html, texto: aTexto(c.html) });
      if (!ok) return res(502, { error: 'correo' });
      await sRef.update({ confirmacionEnviadaEn: FieldValue.serverTimestamp() });
      return res(200, { ok: true, email: p.email, asunto: c.asunto });
    }

    if (b.accion === 'enlaces') {
      const evSnap = await fs.collection('events').doc(String(b.eventId || '')).get();
      if (!evSnap.exists) return res(404, { error: 'no-existe' });
      const ev = evSnap.data();
      const q = await fs.collection('signups').where('eventId', '==', evSnap.id).get();
      // Ni lista de espera, ni bajas, ni no presentados
      let lista = q.docs.filter((d) => !['espera', 'baja', 'no-presentado'].includes(d.data().status));
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

    // Altas, renovaciones, bajas y pruebas de MD+ (ficha del CRM + acceso a la zona de miembros a la vez)
    if (['plus-alta', 'plus-baja', 'plus-prueba'].includes(b.accion)) {
      const ref = fs.collection('people').doc(String(b.personId || ''));
      const snap = await ref.get();
      if (!snap.exists) return res(404, { error: 'no-existe' });
      const p = snap.data();
      if (!p.email && b.accion !== 'plus-baja') return res(400, { error: 'sin-email' });
      let r;
      if (b.accion === 'plus-alta') r = await plus.alta(context, ref, p, { meses: b.meses, nivel: b.nivel, desde: b.desde });
      else if (b.accion === 'plus-baja') r = await plus.baja(context, ref, p, { dejarFotos: b.dejarFotos !== false });
      else r = await plus.prueba(context, ref, p);
      await fs.collection('cambios_acceso').add({ personId: ref.id, email: p.email || '', accion: b.accion, detalle: { meses: b.meses || null, nivel: b.nivel || null }, resultado: r.acceso, fecha: FieldValue.serverTimestamp() });
      return res(200, r);
    }

    // Email «nuevo reto» a todos los miembros MD+ (menos quien se dio de baja de los avisos)
    if (b.accion === 'avisar-reto') {
      const ref = fs.collection('retos').doc(String(b.retoId || ''));
      const snap = await ref.get();
      if (!snap.exists) return res(404, { error: 'no-existe' });
      const lista = await miembrosConAvisos(context, fs);
      const enviados = await enviarATodos(lista, (m) => correoReto('nuevo', snap.data(), m));
      await ref.update({ avisadoEn: FieldValue.serverTimestamp(), avisadosA: enviados });
      return res(200, { enviados, total: lista.length });
    }

    return res(400, { error: 'accion' });
  } catch (e) {
    console.error('fotos-admin', e);
    return res(500, { error: 'servidor', detalle: e.message });
  }
};
