// Recibe los avisos de pago de Ko-fi (Ko-fi → Settings → API → Webhook URL:
//   https://ottokols.es/.netlify/functions/kofi-webhook
// y el "Verification Token" en la variable de entorno KOFI_TOKEN de Netlify).
//
// Según lo que se haya pagado:
//  - Taller (producto de la tienda con fecha): plaza en el CRM + correo de confirmación.
//  - Bono regalo (taller o Mirar Despacio+): crea un código y manda la tarjeta regalo al comprador.
//  - Membresía Mirar Despacio+: acceso a la zona de miembros (invitación) y fecha "pagado hasta".
// Todo pago queda apuntado en el control de ingresos del CRM (colección "ingresos").
const { db, FieldValue } = require('../lib/firestore');
const T = require('../lib/talleres');

const ok = (msg) => ({ statusCode: 200, body: msg || 'ok' });

function leer(event) {
  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString() : event.body || '';
  const tipo = (event.headers['content-type'] || '').toLowerCase();
  if (tipo.includes('application/json')) {
    const j = JSON.parse(raw);
    return typeof j.data === 'string' ? JSON.parse(j.data) : j.data || j;
  }
  return JSON.parse(new URLSearchParams(raw).get('data') || '{}');
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: '' };
  if (!process.env.KOFI_TOKEN) return { statusCode: 500, body: 'Falta KOFI_TOKEN' };

  let p;
  try { p = leer(event); } catch (e) { return { statusCode: 400, body: 'datos' }; }
  if (p.verification_token !== process.env.KOFI_TOKEN) return { statusCode: 401, body: 'token' };

  const fs = db();
  const idPago = 'kofi-' + String(p.kofi_transaction_id || p.message_id || Date.now()).replace(/[^\w-]/g, '');
  const ingresoRef = fs.collection('ingresos').doc(idPago);
  if ((await ingresoRef.get()).exists) return ok('repetido'); // Ko-fi a veces reenvía el mismo aviso

  const email = T.limpio(p.email, 160).toLowerCase();
  const nombre = T.limpio(p.from_name, 80);
  const importe = Number(p.amount) || 0;
  const base = { importe, moneda: p.currency || 'EUR', email, nombre, kofiId: idPago, kofiTipo: p.type };
  const avisos = [];

  try {
    const d = await T.datos();

    // ---------- Membresía Mirar Despacio+ ----------
    if (p.type === 'Subscription' || p.is_subscription_payment) {
      const tier = T.limpio(p.tier_name, 80);
      const nivel = d.plus && d.plus.conSalidas && tier && tier.toLowerCase() === String(d.plus.conSalidas.tier).toLowerCase() ? 'con-salidas' : 'sin-salidas';
      const persona = await T.personaPorEmail(fs, { email, nombre, origen: 'kofi' });
      const hasta = await T.darPlus(fs, persona, { meses: 1, nivel, origen: 'kofi' });
      await persona.ref.set({ subscription: { active: true, since: persona.subscription && persona.subscription.since || new Date().toISOString().slice(0, 10), until: hasta.toISOString().slice(0, 10) } }, { merge: true });
      await T.ingreso(fs, idPago, { ...base, categoria: 'mirar-despacio-plus', concepto: tier || 'Mirar Despacio+' });
      if (p.is_first_subscription_payment) {
        const inv = await T.invitarIdentity(context, email);
        await T.correoBienvenidaPlus({ email, nombre, hasta: T.fechaCorta(hasta), nivel }).catch(() => {});
        avisos.push(['Acceso', inv === 'invitado' ? 'Invitación enviada' : inv === 'ya-existe' ? 'Ya tenía cuenta' : 'Revisar invitación (' + inv + ')']);
      }
      await T.avisoOtto(`Mirar Despacio+: ${nombre || email} · ${T.eur(importe)}${p.is_first_subscription_payment ? ' · NUEVO' : ''}`,
        [['Nivel', tier || nivel], ['Email', email], ['Pagado hasta', T.fechaCorta(hasta)], ['Importe', T.eur(importe)], ...avisos], email).catch(() => {});
      return ok();
    }

    // ---------- Tienda: talleres y bonos regalo ----------
    if (p.type === 'Shop Order' && Array.isArray(p.shop_items) && p.shop_items.length) {
      const conceptos = [];
      let categoria = 'otros';
      for (const item of p.shop_items) {
        const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
        const prod = T.producto(d, item.direct_link_code);

        if (prod && prod.tipo === 'taller') {
          categoria = 'taller';
          const ed = prod.edicion;
          const evRef = await T.eventoTaller(fs, d, ed);
          const antes = await T.ocupadas(fs, ed.id);
          const plazas = (prod.taller && prod.taller.plazas) || 8;
          const persona = await T.personaPorEmail(fs, { email, nombre, origen: 'kofi' });
          await fs.collection('signups').add({
            personId: persona.id, eventId: evRef.id, status: 'confirmado', attended: false,
            origen: 'kofi', pagado: true, plazasCompradas: qty, importe, kofiId: idPago, createdAt: FieldValue.serverTimestamp(),
          });
          await T.correoPlazaTaller({ d, ed, nombre, email }).catch(() => {});
          conceptos.push(`Taller ${prod.taller ? prod.taller.titulo : ed.taller} (${ed.fecha})${qty > 1 ? ' ×' + qty : ''}`);
          avisos.push(['Plazas', `${antes + qty} de ${plazas}` + (antes + qty > plazas ? ' ⚠️ SE HA PASADO DE PLAZAS, revisa el stock en Ko-fi' : '')]);
          if (qty > 1) avisos.push(['Ojo', `Ha comprado ${qty} plazas: pídele los datos de los acompañantes`]);
        } else if (prod && (prod.tipo === 'bono-taller' || prod.tipo === 'bono-plus')) {
          categoria = prod.tipo === 'bono-taller' ? 'regalo-taller' : 'regalo-plus';
          const titulo = prod.tipo === 'bono-taller'
            ? 'Taller ' + prod.taller.titulo
            : `Mirar Despacio+ · ${prod.regalo.meses} ${prod.regalo.meses === 1 ? 'mes' : 'meses'}${prod.regalo.nivel === 'con-salidas' ? ' con salidas' : ''}`;
          const caduca = new Date(Date.now() + T.VALIDEZ_BONO_DIAS * 864e5);
          for (let i = 0; i < qty; i++) {
            const codigo = T.nuevoCodigo();
            await fs.collection('bonos').doc(codigo).set({
              codigo, tipo: prod.tipo === 'bono-taller' ? 'taller' : 'plus', titulo,
              tallerId: prod.taller ? prod.taller.id : null,
              meses: prod.regalo ? prod.regalo.meses : null, nivel: prod.regalo ? prod.regalo.nivel : null,
              compradorEmail: email, compradorNombre: nombre, kofiId: idPago, usado: false,
              caduca: caduca.toISOString(), creado: FieldValue.serverTimestamp(),
            });
            await T.correoBonoComprador({ email, nombre, codigo, titulo, caduca: T.fechaCorta(caduca) }).catch(() => {});
            avisos.push(['Bono', codigo]);
          }
          conceptos.push(`Regalo: ${titulo}${qty > 1 ? ' ×' + qty : ''}`);
        } else {
          conceptos.push('Producto Ko-fi ' + (item.direct_link_code || '?') + (item.variation_name ? ' · ' + item.variation_name : ''));
          avisos.push(['Ojo', `Producto ${item.direct_link_code} sin asignar en talleres-data.json`]);
        }
      }
      await T.ingreso(fs, idPago, { ...base, categoria, concepto: conceptos.join(' + ') });
      await T.avisoOtto(`Pago Ko-fi: ${conceptos.join(' + ')} · ${T.eur(importe)}`,
        [['Comprador', `${nombre} <${email}>`], ['Importe', T.eur(importe)], ['Concepto', conceptos.join(' + ')], ...avisos], email).catch(() => {});
      return ok();
    }

    // ---------- Donativos y otros ----------
    await T.ingreso(fs, idPago, { ...base, categoria: p.type === 'Donation' ? 'donativo' : 'otros', concepto: 'Ko-fi · ' + (p.type || 'pago') + (p.message ? ' · ' + T.limpio(p.message, 120) : '') });
    await T.avisoOtto(`Ko-fi: ${p.type || 'pago'} de ${nombre || email} · ${T.eur(importe)}`, [['Email', email], ['Mensaje', p.message || '—']], email).catch(() => {});
    return ok();
  } catch (e) {
    console.error('kofi-webhook', e);
    // Aunque falle lo demás, que el dinero quede apuntado
    await ingresoRef.set({ tipo: 'ingreso', fecha: FieldValue.serverTimestamp(), metodo: 'kofi', origen: 'auto', ...base, categoria: 'revisar', concepto: 'Pago Ko-fi a revisar (error: ' + String(e.message).slice(0, 100) + ')' }, { merge: true }).catch(() => {});
    await T.avisoOtto('⚠️ Pago de Ko-fi con error, revísalo', [['Email', email], ['Importe', T.eur(importe)], ['Error', e.message]], email).catch(() => {});
    return ok('error-registrado');
  }
};
