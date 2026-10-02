// Talleres y regalos (lo usa mirardespacio.es):
//  GET  ?plazas=1          -> plazas ocupadas de cada edición activa (sin datos personales)
//  GET  ?bono=MD-XXXX-XXXX -> qué es un bono regalo y si sigue disponible
//  POST {codigo, nombre, apellidos, email, telefono, edicion, acepta_datos} -> canjea un bono
const { db, FieldValue } = require('../lib/firestore');
const T = require('../lib/talleres');

const json = (h, code, obj) => ({ statusCode: code, headers: h, body: JSON.stringify(obj) });

function infoBono(b) {
  const caducado = b.caduca && new Date(b.caduca) < new Date();
  return {
    valido: !b.usado && !caducado, usado: !!b.usado, caducado: !!caducado,
    tipo: b.tipo, titulo: b.titulo, tallerId: b.tallerId || null, meses: b.meses || null, nivel: b.nivel || null,
    caduca: b.caduca ? T.fechaCorta(new Date(b.caduca)) : null,
  };
}

exports.handler = async (event, context) => {
  const h = T.cabeceras(event.headers.origin);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: h, body: '' };
  const q = event.queryStringParameters || {};

  try {
    const fs = db();
    const d = await T.datos();

    if (event.httpMethod === 'GET' && q.plazas) {
      const res = {};
      for (const ed of (d.ediciones || []).filter((e) => e.activa && !T.pasada(e))) {
        const t = T.taller(d, ed.taller) || {};
        const usadas = await T.ocupadas(fs, ed.id);
        const plazas = Number(ed.plazas || t.plazas) || 8;
        res[ed.id] = { ocupadas: usadas, plazas, libres: Math.max(0, plazas - usadas) };
      }
      return { ...json(h, 200, res), headers: { ...h, 'Cache-Control': 'public, max-age=60' } };
    }

    if (event.httpMethod === 'GET' && q.bono) {
      const codigo = T.normalizarCodigo(q.bono);
      const snap = await fs.collection('bonos').doc(codigo).get();
      if (!snap.exists) return json(h, 404, { error: 'no-existe' });
      return json(h, 200, { codigo, ...infoBono(snap.data()) });
    }

    if (event.httpMethod !== 'POST') return json(h, 405, {});

    // ---------- Canjear un bono ----------
    const b = JSON.parse(event.body || '{}');
    const codigo = T.normalizarCodigo(b.codigo);
    const datosP = {
      nombre: T.limpio(b.nombre, 80), apellidos: T.limpio(b.apellidos, 120),
      email: T.limpio(b.email, 160), telefono: T.limpio(b.telefono, 40), origen: 'regalo',
    };
    if (b.web) return json(h, 200, { ok: true });
    if (!datosP.nombre || !T.emailValido(datosP.email) || b.acepta_datos !== 'si') return json(h, 400, { error: 'faltan-datos' });

    const bonoRef = fs.collection('bonos').doc(codigo);
    const bSnap = await bonoRef.get();
    if (!bSnap.exists) return json(h, 404, { error: 'no-existe' });
    const bono = bSnap.data();
    const info = infoBono(bono);
    if (!info.valido) return json(h, 409, { error: info.usado ? 'usado' : 'caducado' });

    const persona = await T.personaPorEmail(fs, datosP);

    if (bono.tipo === 'taller') {
      const ed = T.edicion(d, T.limpio(b.edicion, 80));
      if (!ed || !ed.activa || T.pasada(ed) || ed.taller !== bono.tallerId) return json(h, 400, { error: 'edicion' });
      const t = T.taller(d, ed.taller) || {};
      const plazas = Number(ed.plazas || t.plazas) || 8;
      const evRef = await T.eventoTaller(fs, d, ed);
      // Transacción: que no se canjee dos veces ni se pase de plazas
      const r = await fs.runTransaction(async (tx) => {
        const bb = (await tx.get(bonoRef)).data();
        if (bb.usado) return 'usado';
        const lista = await tx.get(fs.collection('signups').where('eventId', '==', evRef.id));
        const usadas = lista.docs.reduce((n, x) => n + (x.data().status === 'espera' ? 0 : Number(x.data().plazasCompradas) || 1), 0);
        if (usadas >= plazas) return 'completo';
        tx.set(fs.collection('signups').doc(), {
          personId: persona.id, eventId: evRef.id, status: 'confirmado', attended: false,
          origen: 'bono', bono: codigo, pagado: true, createdAt: FieldValue.serverTimestamp(),
        });
        tx.update(bonoRef, { usado: true, canjeadoPor: datosP.email.toLowerCase(), canjeadoEn: FieldValue.serverTimestamp(), edicionId: ed.id });
        return 'ok';
      });
      if (r !== 'ok') return json(h, 409, { error: r });
      await T.correoPlazaTaller({ d, ed, nombre: datosP.nombre, email: datosP.email, regalo: true }).catch(() => {});
      await T.avisoOtto(`Regalo canjeado: ${datosP.nombre} ${datosP.apellidos} · Taller ${t.titulo}`, [
        ['Edición', `${ed.fecha} · ${ed.zona || ''}`], ['Persona', `${datosP.nombre} ${datosP.apellidos} <${datosP.email}>`],
        ['Teléfono', datosP.telefono || '—'], ['Bono', codigo], ['Regalado por', `${bono.compradorNombre || ''} <${bono.compradorEmail || ''}>`],
        ['⚠️ Ko-fi', 'Baja 1 el stock de esta edición en Ko-fi para que no se vendan plazas de más'],
      ], datosP.email).catch(() => {});
      return json(h, 200, { ok: true, tipo: 'taller', titulo: t.titulo, fecha: ed.fecha, zona: ed.zona || '' });
    }

    if (bono.tipo === 'plus') {
      const r = await fs.runTransaction(async (tx) => {
        const bb = (await tx.get(bonoRef)).data();
        if (bb.usado) return 'usado';
        tx.update(bonoRef, { usado: true, canjeadoPor: datosP.email.toLowerCase(), canjeadoEn: FieldValue.serverTimestamp() });
        return 'ok';
      });
      if (r !== 'ok') return json(h, 409, { error: r });
      const hasta = await T.darPlus(fs, persona, { meses: bono.meses || 1, nivel: bono.nivel || 'con-salidas', origen: 'regalo' });
      const inv = await T.invitarIdentity(context, datosP.email);
      await T.correoBienvenidaPlus({ email: datosP.email, nombre: datosP.nombre, hasta: T.fechaCorta(hasta), regalo: true, nivel: bono.nivel }).catch(() => {});
      await T.avisoOtto(`Regalo canjeado: ${datosP.nombre} ${datosP.apellidos} · ${bono.titulo}`, [
        ['Persona', `${datosP.nombre} ${datosP.apellidos} <${datosP.email}>`], ['Acceso hasta', T.fechaCorta(hasta)],
        ['Invitación', inv], ['Bono', codigo], ['Regalado por', `${bono.compradorNombre || ''} <${bono.compradorEmail || ''}>`],
      ], datosP.email).catch(() => {});
      return json(h, 200, { ok: true, tipo: 'plus', hasta: T.fechaCorta(hasta) });
    }
    return json(h, 400, { error: 'tipo' });
  } catch (e) {
    console.error('talleres', e);
    return json(h, 500, { error: 'servidor' });
  }
};
