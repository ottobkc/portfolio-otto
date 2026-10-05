// Tareas de cada día (programada en netlify.toml, por la mañana):
//  1. Reto: recordatorio 3 días antes del cierre a quien aún no ha mandado foto
//  2. Reto: aviso «ya puedes ver la galería» el día después del cierre
//  3. MD+: quita el acceso a quien ha caducado (3 días de margen) y avisa a Otto de lo que caduca pronto.
//     Si una prueba gratis termina con un reto abierto, se alarga (una sola vez) hasta el día después
//     del cierre, para que pueda mandar su foto y ver la galería.
// Si en una ejecución programada no hubiera acceso a la administración de cuentas,
// no se rompe nada: Otto recibe la lista para hacerlo a mano desde el CRM.
const { db, FieldValue } = require('../lib/firestore');
const { enviar, esc, remitente } = require('../lib/correo');
const { miembrosConAvisos, correoReto, enviarATodos } = require('../lib/avisos');
const plus = require('../lib/plus');
const limite = require('../lib/limite');

const madrid = (offsetDias = 0) => new Date(Date.now() + offsetDias * 864e5).toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).slice(0, 10);

// Miembros a los que escribir: cuentas MD+ (si hay acceso a Identity) y fichas con MD+ activo
async function destinatarios(context, fs) {
  const porEmail = new Map();
  try { (await miembrosConAvisos(context, fs)).forEach((m) => porEmail.set(m.email, m)); } catch (e) { console.warn('sin lista de cuentas:', e.message); }
  const prefs = await fs.collection('preferencias').where('sinAvisosRetos', '==', true).get();
  const fuera = new Set(prefs.docs.map((d) => d.id));
  (await fs.collection('people').get()).docs.map((d) => d.data()).forEach((p) => {
    const email = String(p.email || '').toLowerCase();
    if (email && plus.estado(p).activo && !fuera.has(email) && !porEmail.has(email)) porEmail.set(email, { email, nombre: p.name || '' });
  });
  return Array.from(porEmail.values());
}

exports.handler = async (event, context) => {
  const fs = db();
  const informe = [];
  const retos = (await fs.collection('retos').get()).docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
  let lista = null;
  const miembros = async () => (lista = lista || await destinatarios(context, fs));

  // 1. Recordatorio
  for (const r of retos.filter((x) => x.activo && x.cierre === madrid(3) && !x.recordatorioEn)) {
    const fotos = await fs.collection('fotos').where('refId', '==', r.id).get();
    const hechos = new Set(fotos.docs.map((d) => d.data().email));
    const faltan = (await miembros()).filter((m) => !hechos.has(m.email));
    const n = await enviarATodos(faltan, (m) => correoReto('recordatorio', r, m));
    await r.ref.update({ recordatorioEn: FieldValue.serverTimestamp() });
    informe.push(`Recordatorio del reto «${r.titulo}»: ${n} emails`);
  }

  // 2. Galería abierta (solo si hay al menos 2 fotos compartidas)
  for (const r of retos.filter((x) => x.cierre && x.cierre === madrid(-1) && !x.galeriaAvisadaEn)) {
    const fotos = (await fs.collection('fotos').where('refId', '==', r.id).get()).docs.map((d) => d.data()).filter((f) => f.compartir);
    if (fotos.length >= 2) {
      const n = await enviarATodos(await miembros(), (m) => correoReto('galeria', { ...r, fotos: fotos.length }, m));
      informe.push(`Galería del reto «${r.titulo}» abierta: ${n} emails`);
    }
    await r.ref.update({ galeriaAvisadaEn: FieldValue.serverTimestamp() });
  }

  // 3. Caducidad de MD+
  const quitados = [], pronto = [], revisar = [], ampliados = [];
  const abierto = retos.filter((x) => x.activo && x.cierre && x.cierre >= madrid(0)).sort((a, b) => a.cierre.localeCompare(b.cierre))[0];
  const diaDespues = (iso) => new Date(new Date(iso + 'T12:00:00Z').getTime() + 864e5).toISOString().slice(0, 10);
  for (const d of (await fs.collection('people').get()).docs) {
    const p = d.data();
    const e = plus.estado(p);
    const nombre = [p.name, p.apellidos].filter(Boolean).join(' ') || p.email;
    if (e.caducada && e.tipo === 'prueba' && abierto && !p.pruebaHasta) {
      const hasta = diaDespues(abierto.cierre);
      await d.ref.set({ pruebaHasta: hasta }, { merge: true });
      ampliados.push(`${nombre}: hasta el ${hasta} (reto «${abierto.titulo}»)`);
    } else if (e.caducada && (p.subscription && p.subscription.active || p.trialStart)) {
      const r = await plus.baja(context, d.ref, p, { dejarFotos: true, motivo: e.tipo === 'prueba' ? 'fin-prueba' : 'caducada' });
      quitados.push(`${nombre} (${e.tipo === 'prueba' ? 'fin de la prueba' : 'caducó el ' + e.hasta})${r.acceso === 'sin-identity' || r.acceso === 'error' ? ' — QUITA EL ACCESO A MANO en el CRM' : ''}`);
    } else if (e.activo && !e.revisar && e.hasta && e.hasta <= madrid(5) && p.avisoCaducidad !== e.hasta) {
      pronto.push(`${nombre}: ${e.tipo === 'prueba' ? 'termina la prueba' : 'MD+ hasta'} el ${e.hasta}`);
      await d.ref.set({ avisoCaducidad: e.hasta }, { merge: true });
    } else if (e.revisar && !p.avisoRevisar) {
      revisar.push(`${nombre}: activo a mano, con fecha ${e.hasta} ya pasada`);
      await d.ref.set({ avisoRevisar: true }, { merge: true });
    }
  }
  if (quitados.length) informe.push('Se ha quitado MD+ (pueden seguir subiendo fotos de salidas):\n- ' + quitados.join('\n- '));
  if (ampliados.length) informe.push('Prueba de MD+ alargada para que terminen el reto abierto (se quita sola después):\n- ' + ampliados.join('\n- '));
  if (pronto.length) informe.push('MD+ que termina en los próximos días:\n- ' + pronto.join('\n- '));
  if (revisar.length) informe.push('Revisa en el CRM (Personas → Mirar Despacio+) y ponles fecha:\n- ' + revisar.join('\n- '));

  await limite.limpiar(fs).catch(() => 0);

  const para = process.env.AVISO_A || remitente();
  if (informe.length && para) {
    await enviar({ para, asunto: '📋 Mirar Despacio: resumen del día', texto: informe.join('\n\n'),
      html: informe.map((b) => `<p>${esc(b).replace(/\n/g, '<br>')}</p>`).join('') + '<p><a href="https://ottokols.es/crm/">Abrir el CRM</a></p>' }).catch(() => {});
  }
  return { statusCode: 200, body: JSON.stringify({ informe }) };
};
