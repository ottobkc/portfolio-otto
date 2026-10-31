// Zona de socios de mirardespacio.es: entrar con enlace al correo (Firebase) y saber qué acceso tiene.
// La llama la función edge «socios» de mirardespacio.es (servidor a servidor) con la cabecera
// x-md-clave = SESION_SOCIOS (la misma variable en los dos sitios). Sin ella no responde: el navegador
// nunca habla con esta función directamente. La edge pasa la IP real en x-md-ip.
//
//  POST {accion:'enlace', email, a}  -> si el email tiene cuenta con algún acceso, le manda el enlace para entrar.
//                                       Siempre responde lo mismo (no se puede averiguar quién es socio).
//  POST {accion:'codigo', email, codigo} -> el código de 6 cifras del mismo correo (vale 15 min, un solo uso, 5 intentos):
//                                       devuelve {enlace} para entrar sin salir de la app (en el iPhone la app instalada
//                                       no comparte sesión con Safari, así que el enlace del correo no le sirve).
//  POST {accion:'quien', entrada}    (Authorization: Bearer <idToken de Firebase>)
//                                    -> {uid, email, nombre, roles}. Con entrada: true apunta el login.
const { db, FieldValue, registrar, conLimite } = require('../lib/firestore');
const { permitir } = require('../lib/limite');
const { enviar } = require('../lib/correo');
const { usuarioDe, cuentaPorEmail } = require('../lib/cuentas');
const fb = require('../lib/firebase-cuentas');
const { correoEnlace, WEB } = require('../lib/correos-socios');

const res = (code, obj) => ({ statusCode: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(obj) });
const crypto = require('crypto');
function deLaEdge(event) {
  const clave = process.env.SESION_SOCIOS || '';
  const dada = String((event.headers || {})['x-md-clave'] || '');
  return clave.length >= 32 && dada.length === clave.length && crypto.timingSafeEqual(Buffer.from(dada), Buffer.from(clave));
}
const huella = (s) => crypto.createHmac('sha256', process.env.SESION_SOCIOS || 'md').update(String(s)).digest('hex');
const CODIGO_MIN = 15;
const DESTINO_OK = /^(socios|cuaderno|retos|manual-[a-z0-9-]{1,30})$/;

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return res(405, {});
  if (!deLaEdge(event)) return res(403, { error: 'origen' });
  const ip = String(event.headers['x-md-ip'] || '').slice(0, 64);
  let b;
  try { b = JSON.parse(event.body || '{}'); } catch (e) { return res(400, { error: 'datos' }); }
  try {
    const fs = db();

    if (b.accion === 'enlace') {
      const email = fb.normal(b.email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) return res(400, { error: 'email' });
      // Como mucho 5 enlaces por hora desde el mismo sitio y 5 por email
      if (!(await permitir(fs, { headers: { 'x-nf-client-connection-ip': ip } }, 'enlace', 5)) || !(await permitir(fs, { headers: { 'x-nf-client-connection-ip': 'email:' + email } }, 'enlace-email', 5))) {
        return res(429, { error: 'demasiadas' });
      }
      const d = await cuentaPorEmail(email);
      const roles = d ? d.data().roles || [] : [];
      if (d && roles.length) {
        const a = DESTINO_OK.test(b.a || '') ? b.a : '';
        // La web desde la que se pide (producción o una Deploy Preview de mirar-despacio)
        const web = /^https:\/\/((www\.)?mirardespacio\.es|([a-z0-9-]+--)?mirar-despacio\.netlify\.app)$/.test(b.web || '') ? b.web : WEB;
        const vuelta = `${web}/acceso/?e=${encodeURIComponent(email)}${a ? '&a=' + encodeURIComponent(a) : ''}`;
        const enlace = await fb.enlaceEntrada(email, vuelta);
        // Código de 6 cifras para entrar desde la app (se guarda solo su huella, nunca el código)
        const codigo = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
        await fs.collection('codigos_acceso').doc(huella('e:' + email)).set({ h: huella(email + ':' + codigo), enlace, expira: Date.now() + CODIGO_MIN * 60e3, intentos: 0 });
        const c = correoEnlace({ email, enlace, a, codigo });
        const ok = await enviar({ para: email, asunto: c.asunto, html: c.html, texto: c.texto });
        if (!ok) { console.error('socios: sin SMTP'); return res(500, { error: 'correo' }); }
      } else {
        // Sin cuenta o sin acceso: no se manda nada, pero la respuesta es la misma
        await fs.collection('cambios_acceso').add({ tipo: 'enlace-sin-cuenta', email, fecha: FieldValue.serverTimestamp() }).catch(() => {});
      }
      return res(200, { ok: true });
    }

    if (b.accion === 'codigo') {
      const email = fb.normal(b.email);
      const codigo = String(b.codigo || '').replace(/\D/g, '');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || codigo.length !== 6) return res(400, { error: 'datos' });
      if (!(await permitir(fs, { headers: { 'x-nf-client-connection-ip': ip } }, 'codigo', 10))) return res(429, { error: 'demasiadas' });
      const ref = fs.collection('codigos_acceso').doc(huella('e:' + email));
      const snap = await ref.get();
      const d = snap.exists ? snap.data() : null;
      if (!d || d.expira < Date.now() || (d.intentos || 0) >= 5) { if (d) await ref.delete().catch(() => {}); return res(400, { error: 'caducado' }); }
      const a = Buffer.from(huella(email + ':' + codigo)), z = Buffer.from(String(d.h));
      if (a.length !== z.length || !crypto.timingSafeEqual(a, z)) {
        await ref.set({ intentos: (d.intentos || 0) + 1 }, { merge: true });
        return res(400, { error: 'codigo', quedan: Math.max(0, 4 - (d.intentos || 0)) });
      }
      await ref.delete();
      return res(200, { enlace: d.enlace });
    }

    if (b.accion === 'quien') {
      const u = await usuarioDe(event, context);
      if (!u || u.origen !== 'firebase') return res(401, { error: 'sesion' });
      if (b.entrada) {
        const ref = fs.collection('cuentas').doc(u.id);
        const snap = await ref.get();
        if (snap.exists) {
          await ref.set({ ultimoLogin: FieldValue.serverTimestamp(), ...(snap.data().primeraEntrada ? {} : { primeraEntrada: FieldValue.serverTimestamp() }) }, { merge: true });
        }
        await conLimite(registrar({ user: { id: u.id, email: u.email, user_metadata: { full_name: u.nombre } }, tipo: 'login' })).catch(() => {});
      }
      return res(200, { uid: u.id, email: u.email, nombre: u.nombre, roles: u.roles });
    }

    return res(400, { error: 'accion' });
  } catch (e) {
    console.error('socios', e.message);
    return res(500, { error: 'servidor' });
  }
};
