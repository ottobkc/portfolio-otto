// Migración de las cuentas de Netlify Identity a Firebase (cuentas/{uid} en Firestore).
// Solo para Otto, desde el CRM (pestaña Accesos y MD+ → Migración). No borra nada de Identity.
//
//  POST {accion:'respaldo'}                -> copia íntegra de los usuarios de Identity en respaldo_identity/{id}
//                                             y la devuelve (el CRM la descarga como JSON)
//  POST {accion:'informe'}                 -> qué pasaría: cada cuenta, sus roles y si ya está en Firebase
//  POST {accion:'migrar', desde, cuantos}  -> copia a Firebase un tramo de cuentas (el CRM va pidiendo tramos
//                                             para no pasarse del tiempo máximo de una función)
//  POST {accion:'unir-actividad', desde, cuantos} -> junta miembros_actividad/{idIdentity} en miembros_actividad/{uid}
//                                             (se usa al final, cuando la gente ya entra por Firebase)
//  POST {accion:'avisar', prueba}          -> correo «cambia la forma de entrar» a cada cuenta con acceso, una sola vez
//                                             (marca avisoNuevoAcceso). Con prueba: true solo se lo manda a Otto.
// Se puede repetir sin miedo: si una cuenta ya está copiada, solo se actualizan sus roles.
const { verificarToken } = require('../lib/sesion-firebase');
const { db, FieldValue } = require('../lib/firestore');
const { listarUsuarios } = require('../lib/identidad');
const cuentas = require('../lib/cuentas');
const fb = require('../lib/firebase-cuentas');

const ADMIN = (process.env.CRM_ADMIN || 'ottobkc@gmail.com').toLowerCase();
const res = (code, obj) => ({ statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });
const ms = (t) => (t && t.toMillis ? t.toMillis() : 0);

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return res(405, {});
  try {
    const fs = db();
    const token = (event.headers.authorization || '').replace(/^Bearer\s+/i, '');
    let quien;
    try { quien = await verificarToken(token); } catch (e) { return res(401, { error: 'sesion' }); }
    if ((quien.email || '').toLowerCase() !== ADMIN) return res(403, { error: 'no-admin' });
    const b = JSON.parse(event.body || '{}');
    const desde = Math.max(0, Number(b.desde) || 0), cuantos = Math.min(25, Math.max(1, Number(b.cuantos) || 10));

    if (b.accion === 'respaldo') {
      const usuarios = await listarUsuarios(context);
      const fecha = new Date().toISOString();
      for (let i = 0; i < usuarios.length; i += 400) {
        const lote = fs.batch();
        usuarios.slice(i, i + 400).forEach((u) => lote.set(fs.collection('respaldo_identity').doc(u.id), { ...u, respaldadoEn: fecha }));
        await lote.commit();
      }
      return res(200, { fecha, total: usuarios.length, usuarios });
    }

    const identity = (await listarUsuarios(context)).map(cuentas.desdeIdentity)
      .filter((u) => u.email).sort((a, x) => a.email.localeCompare(x.email));

    if (b.accion === 'informe') {
      const copiadas = new Map((await fs.collection('cuentas').get()).docs.map((d) => [d.data().email, { uid: d.id, roles: d.data().roles || [] }]));
      const personas = new Set((await fs.collection('people').get()).docs.map((d) => String(d.data().email || '').toLowerCase()).filter(Boolean));
      const emails = identity.map((u) => u.email);
      const repetidos = emails.filter((e, i) => emails.indexOf(e) !== i);
      const filas = identity.map((u) => {
        const c = copiadas.get(u.email);
        return {
          id: u.id, email: u.email, nombre: u.nombre, roles: u.roles, confirmada: u.confirmada, ultimoLogin: u.ultimoLogin,
          enCrm: personas.has(u.email),
          firebase: c ? (JSON.stringify([...c.roles].sort()) === JSON.stringify([...u.roles].sort()) ? 'copiada' : 'roles-distintos') : 'pendiente',
        };
      });
      const conAcceso = filas.filter((f) => f.roles.length);
      return res(200, {
        total: filas.length, conAcceso: conAcceso.length, copiadas: filas.filter((f) => f.firebase === 'copiada').length,
        sinCrm: filas.filter((f) => !f.enCrm && f.roles.length).length, repetidos, filas,
      });
    }

    if (b.accion === 'migrar') {
      const tramo = identity.slice(desde, desde + cuantos);
      const hechos = [];
      for (const u of tramo) {
        try {
          const uid = await cuentas.guardarEnFirebase(u.email, u.roles, {
            identityId: u.id, nombre: u.nombre || undefined, migradaEn: FieldValue.serverTimestamp(),
            ...(u.ultimoLogin ? { ultimoLoginIdentity: u.ultimoLogin } : {}),
          });
          hechos.push({ email: u.email, uid, ok: true });
        } catch (e) {
          hechos.push({ email: u.email, ok: false, error: e.message });
        }
      }
      await fs.collection('cambios_acceso').add({ tipo: 'migracion', desde, cuantos: tramo.length, fallos: hechos.filter((h) => !h.ok).length, fecha: FieldValue.serverTimestamp() });
      return res(200, { total: identity.length, siguiente: desde + tramo.length < identity.length ? desde + tramo.length : null, hechos });
    }

    if (b.accion === 'avisar') {
      const { enviar } = require('../lib/correo');
      const { correoCambio, destinoDe } = require('../lib/correos-socios');
      if (b.prueba) {
        const c = correoCambio({ email: ADMIN, a: 'socios' });
        const ok = await enviar({ para: ADMIN, asunto: '[PRUEBA] ' + c.asunto, html: c.html, texto: c.texto });
        return res(ok ? 200 : 500, { enviados: ok ? 1 : 0, prueba: true });
      }
      const pendientes = (await fs.collection('cuentas').get()).docs
        .filter((d) => (d.data().roles || []).some((r) => r !== 'admin') && !d.data().avisoNuevoAcceso && d.data().email !== ADMIN)
        .sort((a, x) => a.id.localeCompare(x.id));
      const tramo = pendientes.slice(0, 8);
      const hechos = [];
      for (const d of tramo) {
        const c = correoCambio({ email: d.data().email, a: destinoDe(d.data().roles || []) });
        try {
          if (!(await enviar({ para: d.data().email, asunto: c.asunto, html: c.html, texto: c.texto }))) throw new Error('sin-smtp');
          await d.ref.set({ avisoNuevoAcceso: FieldValue.serverTimestamp() }, { merge: true });
          hechos.push({ email: d.data().email, ok: true });
        } catch (e) { hechos.push({ email: d.data().email, ok: false, error: e.message }); }
      }
      if (hechos.some((h) => !h.ok)) return res(200, { hechos, quedan: null, parado: true });
      return res(200, { hechos, quedan: pendientes.length - tramo.length });
    }

    if (b.accion === 'unir-actividad') {
      const lista = (await fs.collection('cuentas').get()).docs.filter((d) => d.data().identityId)
        .sort((a, x) => a.id.localeCompare(x.id)).slice(desde, desde + cuantos);
      let unidas = 0;
      for (const d of lista) {
        const viejo = await fs.collection('miembros_actividad').doc(d.data().identityId).get();
        if (!viejo.exists || viejo.data().unidaA) continue;
        const v = viejo.data();
        const nuevoRef = fs.collection('miembros_actividad').doc(d.id);
        const n = (await nuevoRef.get()).data() || {};
        const masReciente = (k) => (ms(n[k]) >= ms(v[k]) ? n[k] : v[k]);
        const datos = {
          userId: d.id, email: v.email || n.email || d.data().email, nombre: n.nombre || v.nombre || '',
          logins: (Number(n.logins) || 0) + (Number(v.logins) || 0),
          paginasVistas: (Number(n.paginasVistas) || 0) + (Number(v.paginasVistas) || 0),
          identityId: d.data().identityId,
        };
        ['ultimaActividad', 'ultimoLogin', 'ultimaSalida'].forEach((k) => { const x = masReciente(k); if (x) datos[k] = x; });
        if (!n.ultimoTipo || ms(v.ultimaActividad) > ms(n.ultimaActividad)) datos.ultimoTipo = v.ultimoTipo || n.ultimoTipo || null;
        await nuevoRef.set(datos, { merge: true });
        await viejo.ref.set({ unidaA: d.id }, { merge: true });
        unidas++;
      }
      return res(200, { unidas, siguiente: lista.length === cuantos ? desde + cuantos : null });
    }

    return res(400, { error: 'accion' });
  } catch (e) {
    console.error('migrar-cuentas', e.message);
    return res(500, { error: e.message || 'servidor' });
  }
};

// Para las pruebas
exports._fb = fb;
