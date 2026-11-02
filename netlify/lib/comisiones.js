// Comisiones de Stripe como gasto en la contabilidad del CRM (colección ingresos, tipo «gasto»).
// Stripe ingresa los pagos ya descontados y manda cada mes una factura con las comisiones: aquí se suman
// las comisiones de todos los movimientos del mes y se apunta un gasto «Comisiones de Stripe · mes».
// Lo llama tareas-diarias el día 2 de cada mes con el mes anterior (una sola vez: el id es fijo).
//
// Necesita que la clave restringida de Stripe (STRIPE_SECRET_KEY) tenga también
// «Balance transactions: Lectura». Si no la tiene, devuelve un aviso para Otto y no apunta nada.
const S = require('./stripe');

const PROVEEDOR = 'Stripe Payments Europe, Ltd.';
const NIF_PROVEEDOR = 'IE3206488LH';

// Inicio de un día en Madrid como segundos Unix
function inicioMadrid(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  const enMadrid = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
  const enUtc = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
  return Math.floor((d.getTime() - (enMadrid - enUtc)) / 1000);
}
const mesSiguiente = (mes) => { const [y, m] = mes.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; };
const ultimoDia = (mes) => { const [y, m] = mes.split('-').map(Number); return `${mes}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`; };
const NOMBRE_MES = (mes) => new Date(mes + '-15T12:00:00Z').toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });

async function comisionesDe(mes) {
  const desde = inicioMadrid(mes + '-01'), hasta = inicioMadrid(mesSiguiente(mes) + '-01');
  let total = 0, n = 0, despues = null;
  for (let pagina = 0; pagina < 50; pagina++) {
    const lista = await S.api('/balance_transactions', { params: { limit: 100, 'created[gte]': desde, 'created[lt]': hasta, ...(despues ? { starting_after: despues } : {}) } });
    for (const t of lista.data || []) { total += Number(t.fee) || 0; if (t.fee) n++; }
    if (!lista.has_more || !(lista.data || []).length) break;
    despues = lista.data[lista.data.length - 1].id;
  }
  return { euros: Math.round(total) / 100, movimientos: n };
}

// Devuelve un texto para el resumen del día (o '' si no hay nada que contar)
async function apuntarMes(fs, FieldValue, mes) {
  if (!process.env.STRIPE_SECRET_KEY) return '';
  const ref = fs.collection('ingresos').doc('g-stripe-' + mes);
  if ((await ref.get()).exists) return '';
  let c;
  try { c = await comisionesDe(mes); } catch (e) {
    if (/permission|permiso|rak_|does not have/i.test(e.message)) {
      return 'Comisiones de Stripe: no he podido leerlas. En Stripe → Desarrolladores → Claves de API, edita la clave restringida «web-mirar-despacio» y dale «Balance transactions: Lectura».';
    }
    return 'Comisiones de Stripe de ' + NOMBRE_MES(mes) + ': error al leerlas (' + e.message + '). Apúntalas a mano con la factura de Stripe.';
  }
  if (!c.euros) return '';
  await ref.set({
    tipo: 'gasto', fechaManual: ultimoDia(mes), fecha: FieldValue.serverTimestamp(), importe: c.euros, moneda: 'EUR',
    proveedor: PROVEEDOR, nifProveedor: NIF_PROVEEDOR, numeroFactura: '', quien: PROVEEDOR,
    concepto: `Comisiones de Stripe · ${NOMBRE_MES(mes)} (${c.movimientos} movimientos)`,
    categoria: 'banco', actividad: 'fotografia', metodo: 'stripe',
    // Stripe factura desde Irlanda: sin IVA español (inversión del sujeto pasivo). Confírmalo con la gestoría.
    conFactura: true, ivaPct: 0, base: c.euros, cuotaIva: 0, deducible: 100, origen: 'auto',
    nota: 'Inversión del sujeto pasivo (Stripe, Irlanda). Adjunta la factura de comisiones que manda Stripe.',
  });
  return `Comisiones de Stripe de ${NOMBRE_MES(mes)}: ${c.euros.toFixed(2).replace('.', ',')} € apuntados como gasto. Adjunta en Contabilidad → Gastos la factura que manda Stripe (Configuración → Documentos).`;
}

module.exports = { apuntarMes, comisionesDe, inicioMadrid };
