// Recibe los avisos de pago de Stripe.
// En Stripe → Desarrolladores → Webhooks → Añadir destino:
//   URL: https://ottokols.es/.netlify/functions/stripe-webhook
//   Eventos: checkout.session.completed, checkout.session.async_payment_succeeded,
//            invoice.paid, invoice.payment_failed, customer.subscription.deleted
// y el "Signing secret" (whsec_…) en la variable de entorno STRIPE_WEBHOOK_SECRET de Netlify
// (más STRIPE_SECRET_KEY; ver netlify/lib/stripe.js).
//
// Según lo que se haya pagado:
//  - Taller (enlace de pago de una edición con fecha): plaza en el CRM + correo de confirmación.
//    Si con esa compra se llena, se desactiva su enlace de pago.
//  - Bono regalo (taller o Mirar Despacio+): crea un código y manda la tarjeta regalo al comprador.
//  - Mirar Despacio+ (suscripción mensual): acceso a la zona de miembros (invitación) y fecha
//    "pagado hasta"; cada renovación mensual suma un mes.
// Todo pago queda apuntado en el control de ingresos del CRM (colección "ingresos").
const { db, FieldValue } = require('../lib/firestore');
const T = require('../lib/talleres');
const S = require('../lib/stripe');

const ok = (msg) => ({ statusCode: 200, body: msg || 'ok' });
const euros = (centimos) => Math.round(Number(centimos) || 0) / 100;

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: '' };
  if (!process.env.STRIPE_WEBHOOK_SECRET) return { statusCode: 500, body: 'Falta STRIPE_WEBHOOK_SECRET' };

  let ev;
  try { ev = S.verificar(event, process.env.STRIPE_WEBHOOK_SECRET); } catch (e) { return { statusCode: 400, body: e.message }; }
  T.fuenteDatos((event.headers || {}).host);
  T.modoPrueba(ev.livemode === false);

  const fs = db();
  const o = (ev.data && ev.data.object) || {};
  try {
    switch (ev.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        // Con pagos que tardan (p. ej. transferencia) el primer aviso llega sin cobrar: se espera al segundo
        if (o.payment_status === 'unpaid') return ok('pendiente');
        return await compra(fs, context, o);
      case 'invoice.paid':
        return await renovacion(fs, o);
      case 'invoice.payment_failed':
        return await cobroFallido(fs, o);
      case 'customer.subscription.deleted':
        return await bajaSuscripcion(fs, o);
      default:
        return ok('ignorado');
    }
  } catch (e) {
    console.error('stripe-webhook', ev.type, e);
    // Aunque falle lo demás, que el dinero quede apuntado (si era un pago)
    const importe = euros(o.amount_total != null ? o.amount_total : o.amount_paid);
    const email = T.limpio((o.customer_details && o.customer_details.email) || o.customer_email, 160).toLowerCase();
    if (importe) {
      await fs.collection('ingresos').doc('stripe-' + o.id).set({
        tipo: 'ingreso', fecha: FieldValue.serverTimestamp(), metodo: 'stripe', origen: 'auto', importe, email,
        pagoId: o.id, categoria: 'revisar', concepto: 'Pago de Stripe a revisar (error: ' + String(e.message).slice(0, 100) + ')',
      }, { merge: true }).catch(() => {});
    }
    await T.avisoOtto('⚠️ Aviso de Stripe con error, revísalo', [['Evento', ev.type], ['Email', email || '—'], ['Importe', T.eur(importe)], ['Error', e.message]], email).catch(() => {});
    return ok('error-registrado');
  }
};

// ---------- Primer pago: talleres, regalos y alta en Mirar Despacio+ ----------
async function compra(fs, context, s) {
  const idPago = 'stripe-' + s.id;
  const ingresoRef = fs.collection('ingresos').doc(idPago);
  if ((await ingresoRef.get()).exists) return ok('repetido'); // Stripe puede reenviar el mismo aviso

  const cd = s.customer_details || {};
  const email = T.limpio(cd.email || s.customer_email, 160).toLowerCase();
  const nombre = T.limpio(cd.name, 80);
  const importe = euros(s.amount_total);
  const base = { importe, moneda: String(s.currency || 'eur').toUpperCase(), email, nombre, pagoId: s.id };
  const avisos = [];

  const d = await T.datos();
  let prod = T.producto(d, s.client_reference_id);
  if (!prod && s.payment_link) prod = T.producto(d, null, await S.urlDeEnlace(s.payment_link).catch(() => ''));

  // ---------- Mirar Despacio+ (suscripción) ----------
  if (s.mode === 'subscription' || (prod && prod.tipo === 'plus')) {
    const nivel = prod && prod.tipo === 'plus' ? prod.nivel : 'sin-salidas';
    if (!prod) avisos.push(['Ojo', 'No sé qué nivel es: lo he dado como "sin salidas". Revisa el enlace de pago en talleres-data.json']);
    const persona = await T.personaPorEmail(fs, { email, nombre, origen: 'stripe' });
    const hasta = await T.darPlus(fs, persona, { meses: 1, nivel, origen: 'stripe' });
    if (s.subscription) {
      // Para reconocer las renovaciones mensuales (llegan como facturas, sin los datos de la web)
      await fs.collection('stripeSuscripciones').doc(String(s.subscription)).set({
        email, nombre, nivel, personId: persona.id, cliente: s.customer || null, alta: FieldValue.serverTimestamp(), activa: true,
      }, { merge: true });
    }
    await T.ingreso(fs, idPago, { ...base, categoria: 'mirar-despacio-plus', concepto: 'Mirar Despacio+' + (nivel === 'con-salidas' ? ' con salidas' : '') + ' · alta' });
    const inv = await T.invitarIdentity(context, email);
    await T.correoBienvenidaPlus({ email, nombre, hasta: T.fechaCorta(hasta), nivel, portal: d.plus && d.plus.portal }).catch(() => {});
    avisos.push(['Acceso', inv === 'invitado' ? 'Invitación enviada' : inv === 'ya-existe' ? 'Ya tenía cuenta' : 'Revisar invitación (' + inv + ')']);
    await T.avisoOtto(`Mirar Despacio+: ${nombre || email} · ${T.eur(importe)} · NUEVO`,
      [['Nivel', nivel === 'con-salidas' ? 'Con salidas' : 'Sin salidas'], ['Email', email], ['Pagado hasta', T.fechaCorta(hasta)], ['Importe', T.eur(importe)], ...avisos], email).catch(() => {});
    return ok();
  }

  // Cuántas unidades se han comprado (si el enlace deja cambiar la cantidad)
  let qty = 1;
  try {
    const li = await S.api(`/checkout/sessions/${s.id}/line_items`, { params: { limit: 10 } });
    qty = Math.max(1, (li.data || []).reduce((n, x) => n + (Number(x.quantity) || 0), 0));
  } catch (e) { avisos.push(['Ojo', 'No he podido leer la cantidad comprada; cuento 1']); }

  // ---------- Taller ----------
  if (prod && prod.tipo === 'taller') {
    const ed = prod.edicion;
    const evRef = await T.eventoTaller(fs, d, ed);
    const antes = await T.ocupadas(fs, ed.id);
    const plazas = Number(ed.plazas || (prod.taller && prod.taller.plazas)) || 8;
    const persona = await T.personaPorEmail(fs, { email, nombre, origen: 'stripe' });
    await fs.collection('signups').add({
      personId: persona.id, eventId: evRef.id, status: 'confirmado', attended: false,
      origen: 'stripe', pagado: true, plazasCompradas: qty, importe, pagoId: s.id, createdAt: FieldValue.serverTimestamp(),
    });
    await T.correoPlazaTaller({ d, ed, nombre, email }).catch(() => {});
    const concepto = `Taller ${prod.taller ? prod.taller.titulo : ed.taller} (${ed.fecha})${qty > 1 ? ' ×' + qty : ''}`;
    avisos.push(['Plazas', `${antes + qty} de ${plazas}` + (antes + qty > plazas ? ' ⚠️ SE HA PASADO DE PLAZAS' : '')]);
    if (qty > 1) avisos.push(['Ojo', `Ha comprado ${qty} plazas: pídele los datos de los acompañantes`]);
    const cierre = await T.cerrarSiCompleto(fs, d, ed);
    if (cierre) avisos.push(['Enlace de pago', cierre === 'desactivado' ? 'Completo: he desactivado el enlace en Stripe'
      : cierre === 'ya-cerrado' ? 'Completo: Stripe ya ha cerrado el enlace solo (límite de pagos)'
      : 'Completo, pero no he podido desactivar el enlace (' + cierre + '): hazlo a mano en Stripe']);
    await T.ingreso(fs, idPago, { ...base, categoria: 'taller', concepto });
    await T.avisoOtto(`Pago: ${concepto} · ${T.eur(importe)}`,
      [['Comprador', `${nombre} <${email}>`], ['Importe', T.eur(importe)], ...avisos], email).catch(() => {});
    return ok();
  }

  // ---------- Bono regalo ----------
  if (prod && (prod.tipo === 'bono-taller' || prod.tipo === 'bono-plus')) {
    const titulo = prod.tipo === 'bono-taller'
      ? 'Taller ' + prod.taller.titulo
      : `Mirar Despacio+ · ${prod.regalo.meses} ${prod.regalo.meses === 1 ? 'mes' : 'meses'}${prod.regalo.nivel === 'con-salidas' ? ' con salidas' : ' online'}`;
    const caduca = new Date(Date.now() + T.VALIDEZ_BONO_DIAS * 864e5);
    for (let i = 0; i < qty; i++) {
      const codigo = T.nuevoCodigo();
      await fs.collection('bonos').doc(codigo).set({
        codigo, tipo: prod.tipo === 'bono-taller' ? 'taller' : 'plus', titulo,
        tallerId: prod.taller ? prod.taller.id : null,
        meses: prod.regalo ? prod.regalo.meses : null, nivel: prod.regalo ? prod.regalo.nivel : null,
        compradorEmail: email, compradorNombre: nombre, pagoId: s.id, usado: false,
        caduca: caduca.toISOString(), creado: FieldValue.serverTimestamp(),
      });
      await T.correoBonoComprador({ email, nombre, codigo, titulo, caduca: T.fechaCorta(caduca) }).catch(() => {});
      avisos.push(['Bono', codigo]);
    }
    const concepto = `Regalo: ${titulo}${qty > 1 ? ' ×' + qty : ''}`;
    await T.ingreso(fs, idPago, { ...base, categoria: prod.tipo === 'bono-taller' ? 'regalo-taller' : 'regalo-plus', concepto });
    await T.avisoOtto(`Pago: ${concepto} · ${T.eur(importe)}`,
      [['Comprador', `${nombre} <${email}>`], ['Importe', T.eur(importe)], ...avisos], email).catch(() => {});
    return ok();
  }

  // ---------- Producto de la tienda (su enlace de pago está puesto en el CRM → Tienda) ----------
  const urlPago = s.payment_link ? await S.urlDeEnlace(s.payment_link).catch(() => '') : '';
  const deTienda = urlPago ? await pedidoTienda(fs, { s, urlPago, qty, importe, email, nombre, idPago, base }) : null;
  if (deTienda) return ok();

  // ---------- Cualquier otro pago (enlace que no está en talleres-data.json ni en la tienda) ----------
  await T.ingreso(fs, idPago, { ...base, categoria: 'otros', concepto: 'Stripe · pago sin asignar' + (s.client_reference_id ? ' (' + T.limpio(s.client_reference_id, 60) + ')' : '') });
  await T.avisoOtto(`Pago de Stripe sin asignar: ${nombre || email} · ${T.eur(importe)}`,
    [['Email', email], ['Importe', T.eur(importe)], ['Ojo', 'Este enlace de pago no está en talleres-data.json: no he dado plaza, bono ni acceso. Revísalo.'], ...avisos], email).catch(() => {});
  return ok();
}

// Pedido de un producto de la tienda pagado con su enlace de Stripe: crea el pedido en el CRM
// (número P-0001…), descuenta el stock o suma la reserva de la preventa, apunta el cobro y avisa a Otto
// con la dirección de envío. Devuelve el número de pedido o null si el enlace no es de ningún producto.
async function pedidoTienda(fs, { s, urlPago, qty, importe, email, nombre, idPago, base }) {
  const norm = (u) => String(u || '').trim().split('?')[0].replace(/\/+$/, '').toLowerCase();
  const prods = await fs.collection('productos').get();
  const pdoc = prods.docs.find((d) => d.data().enlacePago && norm(d.data().enlacePago) === norm(urlPago));
  if (!pdoc) return null;
  const p = pdoc.data();
  const envioDatos = (s.collected_information && s.collected_information.shipping_details) || s.shipping_details || null;
  const dir = (envioDatos && envioDatos.address) || null;
  const direccion = dir ? [dir.line1, dir.line2, [dir.postal_code, dir.city].filter(Boolean).join(' '), dir.state, dir.country].filter(Boolean).join(', ') : '';
  const telefono = T.limpio((s.customer_details || {}).phone, 30);
  const pedidoRef = fs.collection('pedidos').doc('s-' + s.id);
  const avisos = [];
  const numero = await fs.runTransaction(async (tx) => {
    const ps = await tx.get(pdoc.ref);
    const cont = await tx.get(fs.collection('contadores').doc('pedidos'));
    const prod = ps.data();
    const variantes = JSON.parse(JSON.stringify(prod.variantes || []));
    const pv = prod.preventa && prod.preventa.activa ? prod.preventa : null;
    const linea = { productoId: pdoc.id, nombre: prod.nombre || '', tipo: prod.tipo || 'otro', variante: '', cantidad: qty, precio: Math.round((importe / qty) * 100) / 100, iva: Number(prod.iva != null ? prod.iva : 21) };
    if (pv) {
      linea.preventa = true;
      tx.update(pdoc.ref, { 'preventa.reservadas': (Number(pv.reservadas) || 0) + qty });
    } else if (prod.bajoPedido) {
      linea.bajoPedido = true;
    } else {
      // Un enlace de pago no dice qué variante: se descuenta de la primera que tenga stock
      const v = variantes.find((x) => Number(x.stock) >= qty) || variantes[0];
      if (v) {
        linea.variante = v.nombre || '';
        if ((Number(v.stock) || 0) < qty) avisos.push(['Ojo', 'No quedaba stock suficiente: revisa el pedido']);
        v.stock = Math.max(0, (Number(v.stock) || 0) - qty);
        const cambios = { variantes };
        if (prod.estado === 'venta' && !variantes.some((x) => Number(x.stock) > 0)) { cambios.estado = 'agotado'; avisos.push(['Stock', 'Se ha agotado: la tienda ya lo muestra como agotado']); }
        tx.update(pdoc.ref, cambios);
      }
    }
    const nn = ((cont.exists && Number(cont.data().ultimo)) || 0) + 1;
    tx.set(fs.collection('contadores').doc('pedidos'), { ultimo: nn });
    const num = 'P-' + String(nn).padStart(4, '0');
    const hoy = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).slice(0, 10);
    tx.set(pedidoRef, {
      n: nn, numero: num, fecha: hoy, creado: FieldValue.serverTimestamp(), origen: 'stripe', estado: 'nuevo',
      cliente: { nombre, email, telefono, direccion, personId: '' }, entrega: direccion ? 'envio' : 'mano',
      lineas: [linea], envio: 0, total: importe, metodo: 'stripe', pagado: true, fechaPago: hoy, ingresoId: idPago,
      notas: direccion ? '' : 'Stripe no ha recogido dirección: pregúntale cómo se lo das', stockDescontado: true, pagoId: s.id,
    });
    return num;
  });
  await T.ingreso(fs, idPago, { ...base, categoria: p.tipo === 'zine' ? 'zine' : 'tienda', pedidoId: pedidoRef.id,
    concepto: `Pedido ${numero} · ${qty} × ${p.nombre || 'producto'}` });
  await T.avisoOtto(`🛍️ Pedido ${numero}: ${qty} × ${p.nombre || 'producto'} · ${T.eur(importe)}`, [
    ['Comprador', `${nombre} <${email}>`], ['Importe', T.eur(importe)],
    ['Entrega', direccion ? 'Envío a: ' + direccion : 'Sin dirección: pregúntale (o activa «Recopilar direcciones» en el enlace)'],
    ...(telefono ? [['Teléfono', telefono]] : []), ...avisos,
  ], email).catch(() => {});
  return numero;
}

// ---------- Renovación mensual de Mirar Despacio+ ----------
const suscripcionDe = (inv) => inv.subscription
  || (inv.parent && inv.parent.subscription_details && inv.parent.subscription_details.subscription) || null;

async function renovacion(fs, inv) {
  // El primer cobro ya lo gestiona checkout.session.completed
  if (inv.billing_reason === 'subscription_create') return ok('alta');
  const subId = suscripcionDe(inv);
  if (!subId || !(Number(inv.amount_paid) > 0)) return ok('ignorado');

  const idPago = 'stripe-' + inv.id;
  const ingresoRef = fs.collection('ingresos').doc(idPago);
  if ((await ingresoRef.get()).exists) return ok('repetido');

  const subSnap = await fs.collection('stripeSuscripciones').doc(String(subId)).get();
  const sub = subSnap.exists ? subSnap.data() : {};
  const email = T.limpio(sub.email || inv.customer_email, 160).toLowerCase();
  const nombre = T.limpio(sub.nombre || inv.customer_name, 80);
  const nivel = sub.nivel || 'sin-salidas';
  const importe = euros(inv.amount_paid);
  const avisos = subSnap.exists ? [] : [['Ojo', 'No tenía apuntada esta suscripción: he renovado como "sin salidas". Revisa el nivel en el CRM']];

  const persona = await T.personaPorEmail(fs, { email, nombre, origen: 'stripe' });
  const hasta = await T.darPlus(fs, persona, { meses: 1, nivel, origen: 'stripe' });
  await T.ingreso(fs, idPago, {
    importe, moneda: String(inv.currency || 'eur').toUpperCase(), email, nombre, pagoId: inv.id,
    categoria: 'mirar-despacio-plus', concepto: 'Mirar Despacio+' + (nivel === 'con-salidas' ? ' con salidas' : '') + ' · renovación',
  });
  await T.avisoOtto(`Mirar Despacio+ renovado: ${nombre || email} · ${T.eur(importe)}`,
    [['Email', email], ['Pagado hasta', T.fechaCorta(hasta)], ...avisos], email).catch(() => {});
  return ok();
}

async function cobroFallido(fs, inv) {
  const subId = suscripcionDe(inv);
  const subSnap = subId ? await fs.collection('stripeSuscripciones').doc(String(subId)).get() : null;
  const sub = subSnap && subSnap.exists ? subSnap.data() : {};
  const email = T.limpio(sub.email || inv.customer_email, 160).toLowerCase();
  await T.avisoOtto(`⚠️ No se ha podido cobrar Mirar Despacio+ a ${sub.nombre || email}`, [
    ['Email', email], ['Importe', T.eur(euros(inv.amount_due))],
    ['Qué pasa ahora', 'Stripe lo reintentará solo. Si al final no se cobra, el acceso caduca solo en su fecha "pagado hasta".'],
  ], email).catch(() => {});
  return ok();
}

async function bajaSuscripcion(fs, sub) {
  const ref = fs.collection('stripeSuscripciones').doc(String(sub.id));
  const snap = await ref.get();
  const datos = snap.exists ? snap.data() : {};
  if (snap.exists) await ref.set({ activa: false, baja: FieldValue.serverTimestamp() }, { merge: true });
  let hasta = '';
  if (datos.personId) {
    const p = await fs.collection('people').doc(datos.personId).get();
    const until = p.exists && p.data().subscription && p.data().subscription.until;
    if (until) hasta = T.fechaCorta(new Date(until + 'T12:00:00'));
  }
  await T.avisoOtto(`Baja de Mirar Despacio+: ${datos.nombre || datos.email || sub.customer}`, [
    ['Email', datos.email || '—'],
    ['Acceso', hasta ? 'Mantiene el acceso hasta el ' + hasta + ' (lo que ya pagó) y luego caduca solo' : 'Caduca solo en su fecha "pagado hasta"'],
  ], datos.email).catch(() => {});
  return ok();
}
