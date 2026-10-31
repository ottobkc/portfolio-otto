// Contabilidad del CRM: facturas emitidas, cobros, gastos con su justificante, suscripciones
// (lo que pagas cada mes o cada año) y el resumen de cada trimestre para la gestoría.
//
// Colecciones de Firestore:
//   facturas              facturas emitidas y borradores (numeración correlativa por serie y año)
//   contadores            facturas-<serie>-<año>: último número y fecha de la última factura de la serie
//   ingresos              movimientos: tipo "ingreso" (cobros) o "gasto" (compras). Es la misma colección
//                         en la que Stripe apunta solo los pagos (rama de pagos), por eso se llama así.
//   suscripciones_gasto   cargos que se repiten (Netlify, Adobe, Brevo, dominio…)
//   ajustes/facturacion   tus datos de emisor y valores por defecto
//
// Válido para facturar hasta que llegue Verifactu (julio de 2027): entonces habrá que pasar a un
// programa homologado o adaptar esto.
import {
  collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, runTransaction, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const C = window.crm;
const { db } = C;
const $ = (id) => document.getElementById(id);
const esc = (s) => C.esc(s == null ? '' : String(s));
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : 0; };
export const eur = (n) => r2(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const hoyISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const fechaES = (iso) => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const fechaLarga = (iso) => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
const isoDe = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const normal = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export const CAT_INGRESO = {
  taller: 'Talleres', tutoria: 'Tutorías', sesion: 'Sesiones de fotos', encargo: 'Encargos', salida: 'Salidas (aportaciones)',
  'mirar-despacio-plus': 'Mirar Despacio+', 'regalo-taller': 'Regalos de talleres', 'regalo-plus': 'Regalos de MD+',
  zine: 'Zine', tienda: 'Tienda (baraja, camisetas…)', reventa: 'Reventa de productos de terceros', marca: 'Marcas y colaboraciones', podcast: 'Podcast (Podimo…)',
  donativo: 'Donativos', otros: 'Otros', revisar: '⚠️ A revisar',
};
export const CAT_GASTO = {
  equipo: 'Equipo fotográfico', imprenta: 'Imprenta y material', mercancia: 'Compras para la tienda', envios: 'Envíos y embalaje',
  consumiciones: 'Consumiciones de talleres', software: 'Software, webs y suscripciones', publicidad: 'Publicidad',
  transporte: 'Transporte', local: 'Alquiler de espacios', formacion: 'Formación', banco: 'Comisiones (banco, Stripe)',
  gestoria: 'Gestoría', cuota: 'Cuota de autónomos', 'otros-gasto': 'Otros gastos',
};
const nombreCat = (c) => CAT_INGRESO[c] || CAT_GASTO[c] || c || '—';

// Actividades dadas de alta (epígrafes del IAE). Indicaciones de la gestoría:
// - una serie de facturas por actividad (FOT2026-001, DOC2026-001…);
// - retención de IRPF solo en las de sección 2.ª (formación e informática) a empresas o profesionales;
// - cada gasto identificado por actividad (los comunes, a fotografía);
// - el comercio va en recargo de equivalencia: el IVA de sus ventas no se declara (no entra en el 303)
//   y el IVA y el recargo de sus compras no se deducen (son coste).
export const ACTIVIDADES = {
  fotografia: { nombre: 'Fotografía', iae: '973.1', serie: 'FOT' },
  docencia: { nombre: 'Formación (talleres, tutorías, MD+)', iae: '826', serie: 'DOC', retencion: true },
  informatica: { nombre: 'Servicios informáticos', iae: '765', serie: 'INF', retencion: true },
  graficas: { nombre: 'Productos de diseño propio (zine, baraja, prints)', iae: '475', serie: 'GRA' },
  comercio: { nombre: 'Comercio · recargo de equivalencia', iae: '653.3', serie: 'COM', recargo: true },
};
const ACT_DE_CAT = {
  taller: 'docencia', tutoria: 'docencia', salida: 'docencia', 'mirar-despacio-plus': 'docencia', 'regalo-taller': 'docencia', 'regalo-plus': 'docencia',
  sesion: 'fotografia', encargo: 'fotografia', marca: 'fotografia', podcast: 'fotografia', donativo: 'fotografia',
  zine: 'graficas', tienda: 'graficas', reventa: 'comercio', mercancia: 'comercio',
};
const actividadDe = (x) => (x && ACTIVIDADES[x.actividad] ? x.actividad : ACT_DE_CAT[x && x.categoria] || 'fotografia');
const nombreAct = (k) => (ACTIVIDADES[k] ? `${ACTIVIDADES[k].nombre} (${ACTIVIDADES[k].iae})` : '—');
const selActividad = (id, valor, alCambiar) => `<select id="${id}" ${alCambiar ? `onchange="${alCambiar}"` : ''} title="Actividad (epígrafe del IAE)">${Object.keys(ACTIVIDADES).map((k) => `<option value="${k}" ${valor === k ? 'selected' : ''}>${nombreAct(k)}</option>`).join('')}</select>`;
// Recargo de equivalencia según el tipo de IVA
const RECARGO = { 21: 5.2, 10: 1.4, 4: 0.5, 0: 0 };
const serieDe = (a, act, rect) => { const pre = ((a.series || {})[act] || ACTIVIDADES[act].serie); return rect ? (a.serieRect || 'R') + pre : pre; };
const METODOS = { transferencia: 'Transferencia', bizum: 'Bizum', tarjeta: 'Tarjeta', efectivo: 'Efectivo', stripe: 'Stripe', domiciliacion: 'Domiciliación', paypal: 'PayPal' };
const IVAS = [[21, '21 %'], [10, '10 %'], [4, '4 %'], [0, 'Exento (0 %)']];
const MARCAS = { 'mirar-despacio': 'Mirar Despacio', 'otto-kols': 'Otto Kols', ninguna: 'Sin marca (solo tu nombre)' };
const LOGO_MD = 'https://res.cloudinary.com/dybxateci/image/upload/v1785276700/logoMD_gizjap.png';

let movimientos = [], facturas = [], suscripciones = [];
let ajustes = {};
let desuscribir = [];
let sub = 'resumen';
let editando = null;      // factura que se está editando (objeto) o null
let gastoEditando = null; // id del gasto que se está editando
let susEditando = null;

const AJ_DEF = {
  nombre: 'Otto Kolschinske Castro', nif: '', direccion: '', cp: '', ciudad: 'Madrid', email: 'info@mirardespacio.es', telefono: '',
  iban: '', ivaDefecto: 21, ivaIncluido: true, retencionDefecto: 0, marcaDefecto: 'mirar-despacio', serie: 'F', serieRect: 'R',
  pie: 'Gracias por mirar despacio.', textoExento: 'Operación exenta de IVA según el artículo 20 de la Ley 37/1992 del IVA.',
};
const aj = () => ({ ...AJ_DEF, ...ajustes });

// ===================== Cálculo de una factura =====================
// Con precios con IVA incluido, el total de cada tipo de IVA es exactamente la suma de los precios
// (la base sale de dividir), para que una factura de 45 € sea de 45 € y no de 44,99.
export function calcular(f) {
  const grupos = {};
  (f.lineas || []).forEach((l) => {
    const iva = Number(l.iva) || 0;
    grupos[iva] = (grupos[iva] || 0) + num(l.cantidad) * num(l.precio);
  });
  let base = 0, cuota = 0;
  const lista = Object.keys(grupos).map(Number).sort((a, b) => b - a).map((iva) => {
    const suma = r2(grupos[iva]);
    const b = f.ivaIncluido ? r2(suma / (1 + iva / 100)) : suma;
    const c = f.ivaIncluido ? r2(suma - b) : r2(b * iva / 100);
    base += b; cuota += c;
    return { iva, base: b, cuota: c };
  });
  base = r2(base); cuota = r2(cuota);
  const retencion = r2(base * (Number(f.retencion) || 0) / 100);
  return { grupos: lista, base, cuota, retencion, total: r2(base + cuota - retencion) };
}

// ===================== Datos =====================
const fechaMov = (m) => m.fechaManual ? m.fechaManual : (m.fecha && m.fecha.toDate ? isoDe(m.fecha.toDate()) : hoyISO());
// Base imponible e IVA de un cobro sin factura (si no los tiene apuntados, con el IVA por defecto)
function partesCobro(m) {
  if (m.base != null && m.cuotaIva != null) return { base: num(m.base), cuota: num(m.cuotaIva) };
  const iva = m.ivaPct != null ? Number(m.ivaPct) : Number(aj().ivaDefecto);
  const total = num(m.importe), base = r2(total / (1 + iva / 100));
  return { base, cuota: r2(total - base) };
}
function partesGasto(m) {
  const total = num(m.importe);
  if (!m.conFactura) return { base: total, cuota: 0, deducible: total, ivaDeducible: 0 };
  // Compras del comercio (recargo de equivalencia): todo lo pagado es coste y no hay IVA que deducir
  if (actividadDe(m) === 'comercio') {
    const pct = m.deducible != null ? Number(m.deducible) : 100;
    return { base: m.base != null ? num(m.base) : total, cuota: num(m.cuotaIva) + num(m.recargo), deducible: r2(total * pct / 100), ivaDeducible: 0 };
  }
  const base = m.base != null ? num(m.base) : r2(total / (1 + (Number(m.ivaPct) || 0) / 100));
  const cuota = m.cuotaIva != null ? num(m.cuotaIva) : r2(total - base);
  const pct = m.deducible != null ? Number(m.deducible) : 100;
  return { base, cuota, deducible: r2(base * pct / 100), ivaDeducible: r2(cuota * pct / 100) };
}

export function iniciar() {
  detener();
  desuscribir.push(onSnapshot(collection(db, 'ingresos'), (s) => { movimientos = s.docs.map((d) => ({ id: d.id, ...d.data() })); pintarSiVisible(); }));
  desuscribir.push(onSnapshot(collection(db, 'facturas'), (s) => { facturas = s.docs.map((d) => ({ id: d.id, ...d.data() })); pintarSiVisible(); }));
  desuscribir.push(onSnapshot(collection(db, 'suscripciones_gasto'), (s) => { suscripciones = s.docs.map((d) => ({ id: d.id, ...d.data() })); pintarSiVisible(); avisoMenu(); }));
  desuscribir.push(onSnapshot(doc(db, 'ajustes', 'facturacion'), (s) => { ajustes = s.exists() ? s.data() : {}; pintarSiVisible(); }));
}
export function detener() { desuscribir.forEach((f) => { try { f(); } catch (e) { /* nada */ } }); desuscribir = []; }
const visible = () => { const v = $('view-contabilidad'); return v && v.classList.contains('active'); };
function pintarSiVisible() { if (visible()) pintar(); }

// Cargos de suscripciones que tocan esta semana: aviso en el menú
function avisoMenu() {
  const b = $('contaPendientes'); if (!b) return;
  const limite = isoDe(new Date(Date.now() + 7 * 864e5));
  const n = suscripciones.filter((s) => s.activa !== false && s.proximo && s.proximo <= limite).length;
  b.textContent = n; b.style.display = n ? '' : 'none';
}

// ===================== Periodos =====================
function opcionesPeriodo() {
  const hoy = new Date(), y = hoy.getFullYear(), tq = Math.floor(hoy.getMonth() / 3) + 1;
  const ops = [['mes', 'Este mes']];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(y, hoy.getMonth() - i, 1);
    ops.push([`M-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase())]);
  }
  ops.push(['T' + tq + '-' + y, `${tq}º trimestre ${y}`]);
  for (let q = tq - 1; q >= 1; q--) ops.push(['T' + q + '-' + y, `${q}º trimestre ${y}`]);
  for (let q = 4; q >= 1; q--) ops.push(['T' + q + '-' + (y - 1), `${q}º trimestre ${y - 1}`]);
  ops.push(['A-' + y, 'Año ' + y], ['A-' + (y - 1), 'Año ' + (y - 1)], ['todo', 'Todo']);
  return ops;
}
function rango(per) {
  const hoy = new Date();
  if (per === 'todo') return ['0000-01-01', '9999-12-31'];
  if (per === 'mes') { const a = new Date(hoy.getFullYear(), hoy.getMonth(), 1), b = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0); return [isoDe(a), isoDe(b)]; }
  if (/^M-\d{4}-\d{2}$/.test(per)) { const [, ys, ms] = per.split('-'); const a = new Date(Number(ys), Number(ms) - 1, 1), b = new Date(Number(ys), Number(ms), 0); return [isoDe(a), isoDe(b)]; }
  const [k, ys] = per.split('-'); const y = Number(ys);
  if (k === 'A') return [`${y}-01-01`, `${y}-12-31`];
  const q = Number(k.slice(1));
  return [isoDe(new Date(y, (q - 1) * 3, 1)), isoDe(new Date(y, q * 3, 0))];
}
const enRango = (iso, [a, b]) => iso >= a && iso <= b;
const selPeriodo = (id, valor, alCambiar) => `<select id="${id}" onchange="${alCambiar}" style="width:auto;margin:0;">${opcionesPeriodo().map(([v, t]) => `<option value="${v}" ${v === valor ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
const periodoDe = (id, def) => ($(id) && $(id).value) || def;
let perResumen = 'T' + (Math.floor(new Date().getMonth() / 3) + 1) + '-' + new Date().getFullYear();
let perFact = 'A-' + new Date().getFullYear(), perCob = perResumen, perGas = perResumen;

// ===================== Estructura de la sección =====================
const SUBS = [['resumen', 'Resumen'], ['facturas', 'Facturas'], ['cobros', 'Cobros'], ['plus', 'Mirar Despacio+'], ['gastos', 'Gastos'], ['suscripciones', 'Suscripciones'], ['ajustes', 'Tus datos']];
function esqueleto() {
  const v = $('view-contabilidad');
  if (v.dataset.listo) return;
  v.dataset.listo = '1';
  v.innerHTML = `<div class="subtabs cx-tabs">${SUBS.map(([k, t]) => `<button type="button" class="subtab" data-csub="${k}" onclick="cx.ver('${k}')">${t}</button>`).join('')}</div>
    ${SUBS.map(([k]) => `<div class="cx-vista" id="cx-${k}"></div>`).join('')}`;
}
export function mostrar() {
  esqueleto();
  try { sub = sessionStorage.getItem('crm-conta') || sub; } catch (e) { /* nada */ }
  pintar();
}
function pintar() {
  esqueleto();
  document.querySelectorAll('[data-csub]').forEach((b) => b.classList.toggle('on', b.dataset.csub === sub));
  document.querySelectorAll('.cx-vista').forEach((x) => x.classList.toggle('on', x.id === 'cx-' + sub));
  ({ resumen: pintarResumen, facturas: pintarFacturas, cobros: pintarCobros, plus: pintarPlus, gastos: pintarGastos, suscripciones: pintarSuscripciones, ajustes: pintarAjustes })[sub]();
}
function ver(k) { sub = k; try { sessionStorage.setItem('crm-conta', k); } catch (e) { /* nada */ } pintar(); }

// No repinta un formulario mientras se está escribiendo en él (los datos llegan en directo)
function conservar(id, html) {
  const el = $(id);
  if (!el) return;
  if (el.contains(document.activeElement) && el.querySelector('[data-vivo]')) return;
  el.innerHTML = html;
}

// ===================== Resumen =====================
function cifras(r) {
  const fac = facturas.filter((f) => f.estado !== 'borrador' && enRango(f.fecha, r));
  const facIds = new Set(facturas.map((f) => f.id));
  const cobSinFac = movimientos.filter((m) => m.tipo !== 'gasto' && !(m.facturaId && facIds.has(m.facturaId)) && enRango(fechaMov(m), r));
  const gas = movimientos.filter((m) => m.tipo === 'gasto' && enRango(fechaMov(m), r));
  let ingBase = 0, ivaRep = 0, ret = 0, gasBase = 0, ivaSop = 0;
  // En recargo de equivalencia (comercio) el IVA cobrado no se ingresa: es ingreso y no va al 303
  fac.forEach((f) => { const t = f.totales || calcular(f); const re = actividadDe(f) === 'comercio'; ingBase += re ? t.base + t.cuota : t.base; if (!re) ivaRep += t.cuota; ret += t.retencion; });
  cobSinFac.forEach((m) => { const p = partesCobro(m); const re = actividadDe(m) === 'comercio'; ingBase += re ? p.base + p.cuota : p.base; if (!re) ivaRep += p.cuota; });
  gas.forEach((m) => { const p = partesGasto(m); gasBase += p.deducible; ivaSop += p.ivaDeducible; });
  return { fac, cobSinFac, gas, ingBase: r2(ingBase), ivaRep: r2(ivaRep), ret: r2(ret), gasBase: r2(gasBase), ivaSop: r2(ivaSop) };
}

function pintarResumen() {
  perResumen = periodoDe('cxPerRes', perResumen);
  const r = rango(perResumen), c = cifras(r);
  const esTrim = /^T\d-/.test(perResumen);
  let modelo130 = '';
  if (esTrim) {
    // Pago fraccionado del IRPF: 20 % del rendimiento acumulado del año menos retenciones y pagos de trimestres anteriores
    const [k, ys] = perResumen.split('-'); const q = Number(k.slice(1));
    let pagado = 0, cuota = 0, rend = 0, retAc = 0;
    for (let i = 1; i <= q; i++) {
      const ac = cifras([`${ys}-01-01`, rango(`T${i}-${ys}`)[1]]);
      rend = r2(ac.ingBase - ac.gasBase); retAc = ac.ret;
      cuota = Math.max(0, r2(rend * 0.2 - retAc - pagado));
      if (i < q) pagado = r2(pagado + cuota);
    }
    modelo130 = `<div class="cx-modelo"><div><b>Modelo 130</b> · IRPF (pago fraccionado)</div>
      <div class="cx-linea"><span>Rendimiento acumulado del año</span><span>${eur(rend)}</span></div>
      <div class="cx-linea"><span>20 %</span><span>${eur(Math.max(0, rend * 0.2))}</span></div>
      <div class="cx-linea"><span>Retenciones que te han hecho</span><span>− ${eur(retAc)}</span></div>
      <div class="cx-linea"><span>Pagado en trimestres anteriores</span><span>− ${eur(pagado)}</span></div>
      <div class="cx-linea cx-total"><span>A pagar (aprox.)</span><span>${eur(cuota)}</span></div></div>`;
  }
  const res303 = r2(c.ivaRep - c.ivaSop);
  const porCat = {};
  c.fac.forEach((f) => { const k = nombreCat(f.categoria || 'otros'); porCat[k] = (porCat[k] || 0) + (f.totales || calcular(f)).base; });
  c.cobSinFac.forEach((m) => { const k = nombreCat(m.categoria); porCat[k] = (porCat[k] || 0) + partesCobro(m).base; });
  const porCatG = {};
  c.gas.forEach((m) => { const k = nombreCat(m.categoria); porCatG[k] = (porCatG[k] || 0) + partesGasto(m).deducible; });
  // Resultado por actividad (los gastos comunes van a fotografía)
  const porAct = {};
  const sumaAct = (k, n) => { const t = nombreAct(k); porAct[t] = r2((porAct[t] || 0) + n); };
  c.fac.forEach((f) => { const t = f.totales || calcular(f); sumaAct(actividadDe(f), actividadDe(f) === 'comercio' ? t.base + t.cuota : t.base); });
  c.cobSinFac.forEach((m) => { const p = partesCobro(m); sumaAct(actividadDe(m), actividadDe(m) === 'comercio' ? p.base + p.cuota : p.base); });
  c.gas.forEach((m) => sumaAct(actividadDe(m), -partesGasto(m).deducible));
  const filas = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="cx-linea"><span>${esc(k)}</span><span>${eur(v)}</span></div>`).join('') || '<div class="empty">Nada en este periodo</div>';

  const sinFactura = c.cobSinFac.filter((m) => m.categoria !== 'donativo');
  const sinJust = c.gas.filter((m) => !m.justificante);
  const pendientesCobro = facturas.filter((f) => f.estado === 'emitida' && f.tipo !== 'rectificativa' && !(f.cobro && f.cobro.cobrada));
  const borradores = facturas.filter((f) => f.estado === 'borrador');
  const tareas = [
    pendientesCobro.length && `<div class="cx-aviso" onclick="cx.ver('facturas')">⏳ ${pendientesCobro.length} factura${pendientesCobro.length > 1 ? 's' : ''} sin cobrar · ${eur(pendientesCobro.reduce((n, f) => n + (f.totales || calcular(f)).total, 0))}</div>`,
    borradores.length && `<div class="cx-aviso" onclick="cx.ver('facturas')">✎ ${borradores.length} borrador${borradores.length > 1 ? 'es' : ''} de factura sin emitir</div>`,
    sinFactura.length && `<div class="cx-aviso" onclick="cx.ver('cobros')">🧾 ${sinFactura.length} cobro${sinFactura.length > 1 ? 's' : ''} sin factura en este periodo (pagos de Stripe, Bizum…)</div>`,
    sinJust.length && `<div class="cx-aviso" onclick="cx.ver('gastos')">📎 ${sinJust.length} gasto${sinJust.length > 1 ? 's' : ''} sin justificante adjunto</div>`,
    !aj().nif && `<div class="cx-aviso" onclick="cx.ver('ajustes')">⚠️ Faltan tu NIF y tu dirección para poder emitir facturas</div>`,
  ].filter(Boolean).join('');

  $('cx-resumen').innerHTML = `
    <div class="card">
      <div class="row" style="align-items:center;justify-content:space-between;flex-wrap:wrap;">
        <div style="flex:0 0 auto;">${selPeriodo('cxPerRes', perResumen, 'cx.pintar()')}</div>
        <div class="person-meta" style="flex:1 1 220px;text-align:right;">Importes sin IVA (base imponible)</div>
      </div>
      <div class="stat-grid" style="margin-top:12px;">
        <div class="stat-box"><div class="stat-num">${eur(c.ingBase)}</div><div class="stat-label">ingresos</div></div>
        <div class="stat-box"><div class="stat-num">${eur(c.gasBase)}</div><div class="stat-label">gastos deducibles</div></div>
        <div class="stat-box"><div class="stat-num" style="color:${c.ingBase - c.gasBase < 0 ? 'var(--danger)' : 'var(--ok)'}">${eur(c.ingBase - c.gasBase)}</div><div class="stat-label">resultado</div></div>
      </div>
      ${tareas ? `<div class="cx-avisos">${tareas}</div>` : ''}
    </div>
    <div class="card"><div class="card-title">Por actividad (ingresos − gastos)</div>${filas(porAct)}</div>
    <div class="cx-dos">
      <div class="card"><div class="card-title">Ingresos por tipo</div>${filas(porCat)}</div>
      <div class="card"><div class="card-title">Gastos por tipo</div>${filas(porCatG)}</div>
    </div>
    <div class="card">
      <div class="card-title">Para la gestoría</div>
      ${esTrim ? `<div class="cx-dos">
        <div class="cx-modelo"><div><b>Modelo 303</b> · IVA del trimestre</div>
          <div class="cx-linea"><span>IVA que has cobrado (repercutido)</span><span>${eur(c.ivaRep)}</span></div>
          <div class="cx-linea"><span>IVA que has pagado (soportado deducible)</span><span>− ${eur(c.ivaSop)}</span></div>
          <div class="cx-linea cx-total"><span>${res303 >= 0 ? 'A ingresar (aprox.)' : 'A compensar (aprox.)'}</span><span>${eur(Math.abs(res303))}</span></div></div>
        ${modelo130}</div>
        <div class="person-meta" style="margin-top:8px;">Son cuentas orientativas con lo apuntado aquí. Quien presenta los modelos es tu gestora, que puede aplicar otros criterios.</div>`
        : '<div class="person-meta">Elige un trimestre arriba para ver las cuentas del IVA (303) y del IRPF (130).</div>'}
      <div class="row" style="margin-top:12px;flex-wrap:wrap;">
        <button onclick="cx.csv('emitidas');setTimeout(()=>cx.csv('gastos'),400);setTimeout(()=>cx.csv('cobros'),800)">Todo para la gestoría (3 archivos)</button>
        <button class="secondary" onclick="cx.csv('emitidas')">Libro de facturas emitidas (CSV)</button>
        <button class="secondary" onclick="cx.csv('gastos')">Libro de gastos (CSV)</button>
        <button class="secondary" onclick="cx.csv('cobros')">Cobros sin factura (CSV)</button>
      </div>
      <div class="person-meta" style="margin-top:6px;">Se descargan los del periodo elegido (arriba puedes elegir un mes). Cada mes, mándale a la gestora estos archivos y las fotos o PDF de las facturas de gastos (en «Gastos», botón «ver» de cada una).</div>
    </div>`;
}

// ===================== Facturas =====================
const numeroDe = (f) => f.numero || 'Borrador';
function etiquetasFactura(f) {
  const t = [];
  if (f.estado === 'borrador') t.push('<span class="tag t-off">borrador</span>');
  else if (f.estado === 'rectificada') t.push('<span class="tag t-dup">rectificada</span>');
  if (f.tipo === 'rectificativa') t.push('<span class="tag t-man">rectificativa</span>');
  if (f.estado !== 'borrador' && f.tipo !== 'rectificativa') t.push(f.cobro && f.cobro.cobrada ? '<span class="tag t-plus">cobrada</span>' : '<span class="tag t-man">sin cobrar</span>');
  if (f.tipo === 'simplificada') t.push('<span class="tag t-off">simplificada</span>');
  return t.join('');
}

function pintarFacturas() {
  perFact = periodoDe('cxPerFac', perFact);
  const q = normal(($('cxBuscaFac') || {}).value || '');
  const filtro = ($('cxFiltroFac') || {}).value || '';
  const r = rango(perFact);
  let lista = facturas.filter((f) => f.estado === 'borrador' || enRango(f.fecha, r));
  if (filtro === 'pendiente') lista = lista.filter((f) => f.estado === 'emitida' && f.tipo !== 'rectificativa' && !(f.cobro && f.cobro.cobrada));
  if (filtro === 'borrador') lista = lista.filter((f) => f.estado === 'borrador');
  if (q) lista = lista.filter((f) => normal([f.numero, f.cliente && f.cliente.nombre, f.cliente && f.cliente.nif, f.cliente && f.cliente.email, (f.lineas || []).map((l) => l.concepto).join(' '), String((f.totales || {}).total || '').replace('.', ',')].join(' ')).includes(q));
  lista.sort((a, b) => (a.estado === 'borrador') - (b.estado === 'borrador') || String(b.fecha).localeCompare(String(a.fecha)) || (b.n || 0) - (a.n || 0));
  const total = lista.filter((f) => f.estado !== 'borrador').reduce((n, f) => n + (f.totales || calcular(f)).total, 0);

  const cab = `<div class="card">
      <div class="row" style="align-items:center;flex-wrap:wrap;">
        <button onclick="cx.nuevaFactura()" style="flex:0 0 auto;">+ Nueva factura</button>
        <input id="cxBuscaFac" placeholder="Buscar por cliente, número, NIF, concepto o importe" value="${esc(($('cxBuscaFac') || {}).value || '')}" oninput="cx.pintar()" style="margin:0;flex:2 1 220px;">
        <select id="cxFiltroFac" onchange="cx.pintar()" style="margin:0;flex:1 1 140px;">
          <option value="">Todas</option><option value="pendiente" ${filtro === 'pendiente' ? 'selected' : ''}>Sin cobrar</option><option value="borrador" ${filtro === 'borrador' ? 'selected' : ''}>Borradores</option>
        </select>
        <div style="flex:0 0 auto;">${selPeriodo('cxPerFac', perFact, 'cx.pintar()')}</div>
      </div>
    </div>`;
  const filas = lista.map((f) => {
    const t = f.totales || calcular(f);
    return `<div class="cx-fila" onclick="cx.abrirFactura('${f.id}')">
      <div class="cx-num">${esc(numeroDe(f))}</div>
      <div class="cx-quien"><b>${esc((f.cliente && f.cliente.nombre) || 'Sin cliente')}</b><div class="person-meta">${esc((f.lineas || []).map((l) => l.concepto).filter(Boolean).join(' · ').slice(0, 90))}</div></div>
      <div class="cx-fecha">${fechaES(f.fecha)}</div>
      <div class="cx-tags">${etiquetasFactura(f)}</div>
      <div class="cx-imp">${eur(t.total)}</div>
    </div>`;
  }).join('');
  // Al buscar no se rehace el buscador (se perdería lo que estás escribiendo)
  const v = $('cx-facturas');
  if (!v.querySelector('#cxListaFac')) v.innerHTML = `<div id="cxEditor"></div><div id="cxCabFac"></div><div class="cx-lista" id="cxListaFac"></div><div class="person-meta" id="cxTotFac" style="text-align:right;margin-top:6px;"></div>`;
  if (!$('cxCabFac').contains(document.activeElement)) $('cxCabFac').innerHTML = cab;
  $('cxListaFac').innerHTML = filas || '<div class="empty" style="padding:16px;">No hay facturas con estos filtros</div>';
  $('cxTotFac').textContent = lista.length ? `${lista.filter((f) => f.estado !== 'borrador').length} emitidas · ${eur(total)}` : '';
  if (editando && !$('cxEditor').innerHTML) pintarEditor();
}

// ---------- Editor ----------
function facturaVacia(pre = {}) {
  const a = aj();
  return {
    id: null, estado: 'borrador', tipo: 'completa', fecha: hoyISO(), marca: a.marcaDefecto,
    cliente: { nombre: '', nif: '', direccion: '', email: '', personId: '' },
    lineas: [{ concepto: '', cantidad: 1, precio: '', iva: Number(a.ivaDefecto) }],
    ivaIncluido: a.ivaIncluido !== false, retencion: 0, categoria: 'otros', actividad: '', notas: '',
    cobro: { cobrada: false, metodo: 'transferencia', fecha: hoyISO() }, ...pre,
  };
}
function nuevaFactura(pre) {
  editando = facturaVacia(pre || {});
  ver('facturas');
  pintarEditor();
  $('cxEditor').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function abrirFactura(id) {
  const f = facturas.find((x) => x.id === id); if (!f) return;
  editando = JSON.parse(JSON.stringify(f));
  pintarEditor();
  $('cxEditor').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function cerrarEditor() { editando = null; $('cxEditor').innerHTML = ''; }

function leerEditor() {
  const f = editando; if (!f || f.estado !== 'borrador') return;
  const val = (id) => ($(id) ? $(id).value : '');
  f.fecha = val('fxFecha') || hoyISO();
  f.marca = val('fxMarca');
  const catAntes = f.categoria;
  f.categoria = val('fxCat');
  // Al cambiar el tipo de ingreso, la actividad se propone sola (se puede cambiar a mano)
  f.actividad = catAntes !== f.categoria && ACT_DE_CAT[f.categoria] ? ACT_DE_CAT[f.categoria] : val('fxAct') || actividadDe(f);
  f.cliente = { nombre: val('fxCliNombre').trim(), nif: val('fxCliNif').trim().toUpperCase(), direccion: val('fxCliDir').trim(), email: val('fxCliEmail').trim(), personId: f.cliente.personId || '' };
  f.lineas = [...document.querySelectorAll('#fxLineas .fx-linea')].map((el) => ({
    concepto: el.querySelector('[data-k=concepto]').value.trim(), cantidad: num(el.querySelector('[data-k=cantidad]').value) || 0,
    precio: el.querySelector('[data-k=precio]').value, iva: Number(el.querySelector('[data-k=iva]').value),
  }));
  f.ivaIncluido = $('fxIvaInc').checked;
  f.retencion = Number(val('fxRet')) || 0;
  // Retención solo en formación e informática, y solo a empresas o profesionales (con NIF)
  if (!ACTIVIDADES[f.actividad].retencion || !f.cliente.nif) f.retencion = 0;
  f.notas = val('fxNotas').trim();
  f.cobro = { cobrada: $('fxCobrada').checked, metodo: val('fxMetodo'), fecha: val('fxFechaCobro') || f.fecha, ingresoId: (f.cobro || {}).ingresoId || null };
  // Sin NIF del cliente es una factura simplificada (vale para particulares)
  if (f.tipo !== 'rectificativa') f.tipo = f.cliente.nif ? 'completa' : 'simplificada';
}
function totalesHtml(t, f) {
  return `${t.grupos.map((g) => `<div class="cx-linea"><span>Base ${g.iva ? 'al ' + g.iva + ' %' : 'exenta'}</span><span>${eur(g.base)}</span></div>${g.iva ? `<div class="cx-linea"><span>IVA ${g.iva} %</span><span>${eur(g.cuota)}</span></div>` : ''}`).join('')}
    ${t.retencion ? `<div class="cx-linea"><span>Retención IRPF ${f.retencion} %</span><span>− ${eur(t.retencion)}</span></div>` : ''}
    <div class="cx-linea cx-total"><span>Total</span><span>${eur(t.total)}</span></div>`;
}
function recalcular() {
  leerEditor();
  const f = editando;
  if ($('fxAct') && $('fxAct').value !== f.actividad) $('fxAct').value = f.actividad;
  const puedeRet = ACTIVIDADES[f.actividad].retencion && f.cliente.nif;
  // Con NIF de empresa (CIF: empieza por letra) se propone el 7 %, salvo que se haya elegido a mano
  if (puedeRet && !f.retencion && /^[ABCDEFGHJNPQRSUVW]/.test(f.cliente.nif) && $('fxRet') && !$('fxRet').dataset.tocado) f.retencion = 7;
  if ($('fxRet')) { $('fxRet').disabled = !puedeRet; $('fxRet').value = String(f.retencion); }
  if ($('fxRetNota')) $('fxRetNota').textContent = !ACTIVIDADES[f.actividad].retencion ? 'Esta actividad no lleva retención.'
    : !f.cliente.nif ? 'Sin NIF del cliente no hay retención (particulares).'
    : 'Retención del 7 % solo si el cliente es una empresa o un autónomo (no a particulares).';
  if ($('fxSerie')) $('fxSerie').textContent = 'Se numerará en la serie ' + serieDe(aj(), f.actividad, f.tipo === 'rectificativa') + (ACTIVIDADES[f.actividad].recargo ? ' · recargo de equivalencia: el IVA de esta venta no se declara' : '');
  const t = calcular(editando);
  $('fxTotales').innerHTML = totalesHtml(t, editando);
  $('fxTipo').textContent = editando.tipo === 'rectificativa' ? 'Factura rectificativa' : editando.tipo === 'completa' ? 'Factura completa' : 'Factura simplificada (sin NIF del cliente: vale para particulares)';
  $('fxCobroCampos').style.display = $('fxCobrada').checked ? '' : 'none';
}
function lineaHtml(l) {
  return `<div class="fx-linea">
    <input data-k="concepto" data-vivo placeholder="Concepto (p. ej. Taller de fotografía nocturna, 12 dic.)" value="${esc(l.concepto)}" oninput="cx.recalcular()">
    <input data-k="cantidad" type="number" min="0" step="1" value="${esc(l.cantidad)}" oninput="cx.recalcular()" title="Cantidad">
    <input data-k="precio" type="text" inputmode="decimal" placeholder="Precio" value="${esc(l.precio)}" oninput="cx.recalcular()" title="Precio por unidad">
    <select data-k="iva" onchange="cx.recalcular()" title="IVA">${IVAS.map(([v, t]) => `<option value="${v}" ${Number(l.iva) === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
    <button class="small danger" type="button" onclick="this.parentNode.remove();cx.recalcular()" title="Quitar línea">✕</button>
  </div>`;
}
function pintarEditor() {
  const f = editando, el = $('cxEditor');
  if (!f) { el.innerHTML = ''; return; }
  const t = f.totales && f.estado !== 'borrador' ? f.totales : calcular(f);
  if (f.estado !== 'borrador') {
    // Factura emitida: solo se puede ver, cobrar, rectificar o duplicar
    const rect = f.rectificadaPor ? facturas.find((x) => x.id === f.rectificadaPor) : null;
    el.innerHTML = `<div class="card cx-editor">
      <div class="row" style="align-items:center;justify-content:space-between;">
        <div class="card-title" style="margin:0;flex:1 1 auto;">${esc(f.numero)} · ${esc(f.cliente.nombre || 'Sin cliente')}</div>
        <button class="small secondary" style="flex:0 0 auto;" onclick="cx.cerrarEditor()">Cerrar</button>
      </div>
      <div style="margin:6px 0 10px;">${etiquetasFactura(f)}</div>
      <div class="cx-dos">
        <div>
          <div class="person-meta">Fecha: ${fechaES(f.fecha)} · ${esc(MARCAS[f.marca] || '')} · ${esc(nombreCat(f.categoria))} · ${esc(nombreAct(actividadDe(f)))}</div>
          ${f.cliente.nif ? `<div class="person-meta">NIF ${esc(f.cliente.nif)}${f.cliente.direccion ? ' · ' + esc(f.cliente.direccion) : ''}</div>` : ''}
          ${f.cliente.email ? `<div class="person-meta">${esc(f.cliente.email)}</div>` : ''}
          <div style="margin-top:10px;">${(f.lineas || []).map((l) => `<div class="cx-linea"><span>${num(l.cantidad) !== 1 ? esc(l.cantidad) + ' × ' : ''}${esc(l.concepto)}</span><span>${eur(num(l.cantidad) * num(l.precio))}</span></div>`).join('')}</div>
          ${f.rectificaA ? `<div class="person-meta" style="margin-top:8px;">Rectifica la factura ${esc(f.rectificaA.numero)}: ${esc(f.rectificaA.motivo || '')}</div>` : ''}
          ${rect ? `<div class="person-meta" style="margin-top:8px;">Rectificada por la ${esc(rect.numero)}</div>` : ''}
          ${f.cobro && f.cobro.cobrada ? `<div class="person-meta" style="margin-top:8px;">Cobrada el ${fechaES(f.cobro.fecha)} · ${esc(METODOS[f.cobro.metodo] || f.cobro.metodo || '')}</div>` : ''}
        </div>
        <div>${totalesHtml(t, f)}</div>
      </div>
      <div class="row" style="margin-top:12px;flex-wrap:wrap;">
        <button onclick="cx.verPdf('${f.id}')">Ver y descargar PDF</button>
        ${f.tipo !== 'rectificativa' && !(f.cobro && f.cobro.cobrada) ? `<button class="secondary" onclick="cx.marcarCobrada('${f.id}')">Marcar cobrada</button>` : ''}
        ${f.cliente.email ? `<button class="secondary" onclick="cx.enviar('${f.id}')">Enviar por correo</button>` : ''}
        <button class="secondary" onclick="cx.duplicar('${f.id}')">Duplicar como borrador</button>
        ${f.estado === 'emitida' && f.tipo !== 'rectificativa' ? `<button class="danger" onclick="cx.rectificar('${f.id}')">Rectificar o anular</button>` : ''}
      </div>
      <div id="fxCobroRapido"></div>
    </div>`;
    return;
  }
  const personas = C.personas().filter((p) => p.name || p.email);
  el.innerHTML = `<div class="card cx-editor">
    <div class="row" style="align-items:center;justify-content:space-between;">
      <div class="card-title" style="margin:0;flex:1 1 auto;">${f.tipo === 'rectificativa' ? 'Factura rectificativa' : f.id ? 'Borrador de factura' : 'Nueva factura'}</div>
      <button class="small secondary" style="flex:0 0 auto;" onclick="cx.cerrarEditor()">Cerrar</button>
    </div>
    <div class="person-meta" id="fxTipo" style="margin:4px 0 12px;"></div>
    <div class="cx-dos">
      <div>
        <div class="cx-etq">Cliente</div>
        <input id="fxCliNombre" data-vivo list="fxPersonas" placeholder="Nombre y apellidos o empresa" value="${esc(f.cliente.nombre)}" oninput="cx.elegirCliente()">
        <datalist id="fxPersonas">${personas.map((p) => `<option value="${esc([p.name, p.apellidos].filter(Boolean).join(' '))}">${esc(p.email || '')}</option>`).join('')}</datalist>
        <div class="row"><input id="fxCliNif" data-vivo placeholder="NIF / CIF (si lo pide)" value="${esc(f.cliente.nif)}" oninput="cx.recalcular()"><input id="fxCliEmail" data-vivo type="email" placeholder="Email" value="${esc(f.cliente.email)}"></div>
        <textarea id="fxCliDir" data-vivo rows="2" placeholder="Dirección (necesaria si pone NIF)">${esc(f.cliente.direccion)}</textarea>
      </div>
      <div>
        <div class="cx-etq">Factura</div>
        <div class="row"><input id="fxFecha" type="date" value="${esc(f.fecha)}" title="Fecha de la factura"><select id="fxMarca" title="Logo de la factura">${Object.entries(MARCAS).map(([k, v]) => `<option value="${k}" ${f.marca === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        ${selActividad('fxAct', actividadDe(f), 'cx.recalcular()')}
        <select id="fxCat" title="Tipo de ingreso (para tus cuentas)" onchange="cx.recalcular()">${Object.entries(CAT_INGRESO).filter(([k]) => k !== 'revisar').map(([k, v]) => `<option value="${k}" ${f.categoria === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <div class="row" style="align-items:center;">
          <label class="consent-toggle" style="margin:0 0 8px;"><input type="checkbox" id="fxIvaInc" ${f.ivaIncluido ? 'checked' : ''} onchange="cx.recalcular()"> Precios con IVA incluido</label>
          <select id="fxRet" onchange="this.dataset.tocado='1';cx.recalcular()" title="Retención de IRPF">${[[0, 'Sin retención'], [7, 'Retención 7 %'], [15, 'Retención 15 %']].map(([v, t]) => `<option value="${v}" ${Number(f.retencion) === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
        </div>
        <div class="person-meta" id="fxRetNota"></div>
        <div class="person-meta" id="fxSerie"></div>
      </div>
    </div>
    <div class="cx-etq">Conceptos</div>
    <div class="fx-cab"><span>Concepto</span><span>Cant.</span><span>Precio</span><span>IVA</span><span></span></div>
    <div id="fxLineas">${(f.lineas || []).map(lineaHtml).join('')}</div>
    <button class="small secondary" type="button" onclick="cx.masLinea()">+ Añadir línea</button>
    <div class="cx-dos" style="margin-top:14px;">
      <div>
        <textarea id="fxNotas" data-vivo rows="2" placeholder="Nota que saldrá en la factura (opcional)">${esc(f.notas)}</textarea>
        <label class="consent-toggle"><input type="checkbox" id="fxCobrada" ${f.cobro && f.cobro.cobrada ? 'checked' : ''} onchange="cx.recalcular()"> Ya está cobrada</label>
        <div class="row" id="fxCobroCampos" style="margin-top:8px;">
          <select id="fxMetodo">${Object.entries(METODOS).map(([k, v]) => `<option value="${k}" ${(f.cobro || {}).metodo === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
          <input id="fxFechaCobro" type="date" value="${esc((f.cobro || {}).fecha || f.fecha)}" title="Fecha del cobro">
        </div>
        ${f.origen && f.origen.ingresoId ? '<div class="person-meta">Se enlaza con el cobro que ya está apuntado: no se apunta dos veces.</div>' : ''}
      </div>
      <div id="fxTotales"></div>
    </div>
    <div class="row" style="margin-top:14px;flex-wrap:wrap;">
      <button onclick="cx.emitir()">Emitir factura</button>
      <button class="secondary" onclick="cx.guardarBorrador()">Guardar borrador</button>
      ${f.id ? `<button class="danger" onclick="cx.borrarBorrador()">Borrar borrador</button>` : ''}
    </div>
    <div class="person-meta" style="margin-top:6px;">Al emitirla recibe el siguiente número de la serie y ya no se puede borrar ni cambiar: si hay un error se hace una rectificativa.</div>
  </div>`;
  recalcular();
}
function masLinea() { leerEditor(); editando.lineas.push({ concepto: '', cantidad: 1, precio: '', iva: Number(aj().ivaDefecto) }); pintarEditor(); }
function elegirCliente() {
  const nombre = normal($('fxCliNombre').value);
  const p = C.personas().find((x) => normal([x.name, x.apellidos].filter(Boolean).join(' ')) === nombre);
  if (p) {
    editando.cliente.personId = p.id;
    if (!$('fxCliEmail').value && p.email) $('fxCliEmail').value = p.email;
    // Si ya se le hizo una factura, recupera su NIF y dirección
    const ant = facturas.filter((f) => f.cliente && f.cliente.personId === p.id && f.cliente.nif).sort((a, b) => String(b.fecha).localeCompare(a.fecha))[0];
    if (ant && !$('fxCliNif').value) { $('fxCliNif').value = ant.cliente.nif; $('fxCliDir').value = ant.cliente.direccion || ''; }
  }
  recalcular();
}

function validar(f, emitir) {
  if (!f.lineas.length || f.lineas.some((l) => !l.concepto)) return 'Cada línea necesita un concepto';
  if (emitir) {
    const a = aj();
    if (!a.nif || !a.direccion) return 'Antes de emitir, rellena tu NIF y tu dirección en «Tus datos»';
    if (f.lineas.some((l) => !num(l.precio) || !num(l.cantidad))) return 'Falta el precio o la cantidad de alguna línea';
    if (f.tipo === 'completa' && (!f.cliente.nombre || !f.cliente.direccion)) return 'Con NIF, la factura necesita también el nombre y la dirección del cliente';
    const hoy = hoyISO(), anioAct = Number(hoy.slice(0, 4)), anioF = Number(String(f.fecha).slice(0, 4));
    if (f.fecha > hoy) return 'La factura no puede tener una fecha futura';
    if (anioF < anioAct - 1) return `La fecha es de ${anioF}: revisa el año`;
    if (anioF < anioAct && !confirm(`La factura es de ${anioF}: se numerará en la serie de ${anioF}. ¿Seguro?`)) return 'Revisa la fecha';
    const t = calcular(f);
    if (f.tipo === 'simplificada' && t.total > 400) return 'Las facturas simplificadas (sin NIF) solo valen hasta 400 €. Pon el NIF y la dirección del cliente';
    if (f.tipo !== 'rectificativa' && t.total <= 0) return 'El total tiene que ser mayor que cero';
  }
  return '';
}
const limpiarFactura = (f) => { const o = { ...f }; delete o.id; return o; };

async function guardarBorrador() {
  leerEditor();
  const f = editando, err = validar(f, false);
  if (err) return C.aviso(err, true);
  if (!f.id) f.id = 'b-' + C.uid();
  f.totales = calcular(f);
  try {
    await setDoc(doc(db, 'facturas', f.id), { ...limpiarFactura(f), actualizada: serverTimestamp(), creada: f.creada || serverTimestamp() });
    C.aviso('Borrador guardado ✓');
    pintarEditor();
  } catch (e) { C.aviso('Error: ' + e.message, true); }
}
async function borrarBorrador() {
  if (!editando || !editando.id || editando.estado !== 'borrador') return;
  if (!confirm('¿Borrar este borrador?')) return;
  try { await deleteDoc(doc(db, 'facturas', editando.id)); cerrarEditor(); C.aviso('Borrador borrado'); } catch (e) { C.aviso('Error: ' + e.message, true); }
}

// Emite: número correlativo en una transacción (el contador y la factura se guardan juntos)
async function emitir() {
  leerEditor();
  const f = editando, err = validar(f, true);
  if (err) return C.aviso(err, true);
  const t = calcular(f);
  if (!confirm(`¿Emitir la factura de ${eur(t.total)} a ${f.cliente.nombre || 'cliente sin nombre'}? Una vez emitida no se puede cambiar.`)) return;
  const a = aj();
  f.actividad = actividadDe(f);
  const serie = serieDe(a, f.actividad, f.tipo === 'rectificativa');
  const anio = Number(f.fecha.slice(0, 4));
  const id = f.id || 'b-' + C.uid();
  const refF = doc(db, 'facturas', id), refC = doc(db, 'contadores', `facturas-${serie}-${anio}`);
  try {
    const numero = await runTransaction(db, async (tx) => {
      const c = await tx.get(refC);
      const ultimo = c.exists() ? c.data() : { ultimo: 0, fecha: '' };
      if (ultimo.fecha && f.fecha < ultimo.fecha) throw new Error(`La fecha no puede ser anterior a la de la última factura de la serie (${fechaES(ultimo.fecha)})`);
      const n = (Number(ultimo.ultimo) || 0) + 1;
      const numero = `${serie}${anio}-${String(n).padStart(3, '0')}`;
      tx.set(refC, { ultimo: n, fecha: f.fecha, serie, anio });
      const emisor = { nombre: a.nombre, nif: a.nif, direccion: a.direccion, cp: a.cp, ciudad: a.ciudad, email: a.email, telefono: a.telefono, iban: a.iban };
      tx.set(refF, { ...limpiarFactura(f), serie, anio, n, numero, estado: 'emitida', totales: t, emisor, pie: a.pie, textoExento: a.textoExento, emitida: serverTimestamp(), creada: f.creada || serverTimestamp() });
      return numero;
    });
    f.id = id;
    // Cobro: si venía de un cobro ya apuntado se enlaza; si no, se apunta uno nuevo
    if (f.tipo !== 'rectificativa') await apuntarCobroDeFactura({ ...f, numero, totales: t });
    if (f.tipo === 'rectificativa' && f.rectificaA) await updateDoc(doc(db, 'facturas', f.rectificaA.id), { estado: 'rectificada', rectificadaPor: id });
    if (f.origen && f.origen.pedidoId) await updateDoc(doc(db, 'pedidos', f.origen.pedidoId), { facturaId: id, facturaNumero: numero }).catch(() => {});
    C.aviso(`Factura ${numero} emitida ✓`);
    editando = null; $('cxEditor').innerHTML = '';
    setTimeout(() => abrirFactura(id), 400);
  } catch (e) { C.aviso(e.message, true); }
}

async function apuntarCobroDeFactura(f) {
  const ingresoId = f.origen && f.origen.ingresoId;
  const t = f.totales;
  if (ingresoId) {
    await updateDoc(doc(db, 'ingresos', ingresoId), { facturaId: f.id, facturaNumero: f.numero, base: t.base, cuotaIva: t.cuota });
    await updateDoc(doc(db, 'facturas', f.id), { cobro: { cobrada: true, fecha: f.cobro.fecha, metodo: f.cobro.metodo, ingresoId } });
    return;
  }
  if (!f.cobro || !f.cobro.cobrada) return;
  const idM = 'f-' + f.id;
  await setDoc(doc(db, 'ingresos', idM), {
    tipo: 'ingreso', fechaManual: f.cobro.fecha || f.fecha, fecha: serverTimestamp(), importe: t.total, moneda: 'EUR',
    base: t.base, cuotaIva: t.cuota, categoria: f.categoria || 'otros', actividad: actividadDe(f), metodo: f.cobro.metodo || 'transferencia',
    concepto: `Factura ${f.numero}`, quien: f.cliente.nombre || '', email: f.cliente.email || '', facturaId: f.id, facturaNumero: f.numero, origen: 'factura',
  });
  await updateDoc(doc(db, 'facturas', f.id), { 'cobro.ingresoId': idM, 'cobro.cobrada': true });
  // Si la factura es de un pedido de la tienda, el pedido queda pagado
  if (f.origen && f.origen.pedidoId) await updateDoc(doc(db, 'pedidos', f.origen.pedidoId), { pagado: true, fechaPago: f.cobro.fecha || f.fecha, ingresoId: idM }).catch(() => {});
}

function marcarCobrada(id) {
  $('fxCobroRapido').innerHTML = `<div class="sub-panel" style="margin-top:10px;">
    <div class="row"><select id="fxMetodoR">${Object.entries(METODOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><input id="fxFechaR" type="date" value="${hoyISO()}"></div>
    <button onclick="cx.confirmarCobro('${id}')">Apuntar el cobro</button></div>`;
}
async function confirmarCobro(id) {
  const f = facturas.find((x) => x.id === id); if (!f) return;
  try {
    await apuntarCobroDeFactura({ ...f, cobro: { cobrada: true, metodo: $('fxMetodoR').value, fecha: $('fxFechaR').value || hoyISO() } });
    await updateDoc(doc(db, 'facturas', id), { 'cobro.metodo': $('fxMetodoR').value, 'cobro.fecha': $('fxFechaR').value || hoyISO() });
    C.aviso('Cobro apuntado ✓');
    setTimeout(() => abrirFactura(id), 300);
  } catch (e) { C.aviso('Error: ' + e.message, true); }
}
function duplicar(id) {
  const f = facturas.find((x) => x.id === id); if (!f) return;
  nuevaFactura({ cliente: { ...f.cliente }, lineas: JSON.parse(JSON.stringify(f.lineas || [])).map((l) => ({ ...l, cantidad: Math.abs(num(l.cantidad)) || 1 })), ivaIncluido: f.ivaIncluido, retencion: f.retencion, categoria: f.categoria, marca: f.marca });
}
function rectificar(id) {
  const f = facturas.find((x) => x.id === id); if (!f) return;
  const motivo = prompt(`Motivo de la rectificación de la ${f.numero} (saldrá en la factura).\nSe crea una rectificativa en negativo por el total; si solo había que corregir algo, después haces una factura nueva bien.`, 'Anulación por error en los datos');
  if (motivo == null) return;
  nuevaFactura({
    tipo: 'rectificativa', cliente: { ...f.cliente }, marca: f.marca, categoria: f.categoria, ivaIncluido: f.ivaIncluido, retencion: f.retencion,
    lineas: (f.lineas || []).map((l) => ({ ...l, cantidad: -Math.abs(num(l.cantidad)) })),
    rectificaA: { id: f.id, numero: f.numero, fecha: f.fecha, motivo: motivo.trim() },
    notas: `Rectifica la factura ${f.numero} del ${fechaES(f.fecha)}. Motivo: ${motivo.trim()}`,
    cobro: { cobrada: false },
  });
}

// ---------- PDF (se imprime la factura; en «Guardar como PDF» sale con su número como nombre) ----------
function facturaHtml(f) {
  const t = f.totales || calcular(f);
  const e = f.emisor || aj();
  const logo = f.marca === 'mirar-despacio' ? `<img src="${LOGO_MD}" alt="Mirar Despacio" class="fp-logo">` : f.marca === 'otto-kols' ? '<div class="fp-marca">OTTO KOLS</div>' : '';
  const titulo = f.tipo === 'rectificativa' ? 'Factura rectificativa' : f.tipo === 'simplificada' ? 'Factura simplificada' : 'Factura';
  const exento = t.grupos.some((g) => !g.iva);
  return `<div class="fp">
    <div class="fp-cab">
      <div>${logo}<div class="fp-tit">${titulo}</div><div class="fp-num">${esc(f.numero || 'BORRADOR')}</div><div class="fp-fecha">Fecha: ${fechaLarga(f.fecha)}</div></div>
      <div class="fp-emisor"><b>${esc(e.nombre)}</b><br>NIF ${esc(e.nif)}<br>${esc(e.direccion)}${e.cp || e.ciudad ? '<br>' + esc([e.cp, e.ciudad].filter(Boolean).join(' ')) : ''}${e.email ? '<br>' + esc(e.email) : ''}${e.telefono ? '<br>' + esc(e.telefono) : ''}</div>
    </div>
    ${f.cliente && (f.cliente.nombre || f.cliente.nif) ? `<div class="fp-cliente"><div class="fp-etq">Cliente</div><b>${esc(f.cliente.nombre)}</b>${f.cliente.nif ? '<br>NIF ' + esc(f.cliente.nif) : ''}${f.cliente.direccion ? '<br>' + esc(f.cliente.direccion).replace(/\n/g, '<br>') : ''}</div>` : ''}
    <table class="fp-tabla"><thead><tr><th>Concepto</th><th class="d">Cant.</th><th class="d">Precio${f.ivaIncluido ? ' (IVA incl.)' : ''}</th><th class="d">IVA</th><th class="d">Importe</th></tr></thead>
      <tbody>${(f.lineas || []).map((l) => `<tr><td>${esc(l.concepto)}</td><td class="d">${esc(l.cantidad)}</td><td class="d">${eur(l.precio)}</td><td class="d">${Number(l.iva) ? l.iva + ' %' : 'Exento'}</td><td class="d">${eur(num(l.cantidad) * num(l.precio))}</td></tr>`).join('')}</tbody></table>
    <div class="fp-totales">${t.grupos.map((g) => `<div><span>Base imponible${t.grupos.length > 1 || !g.iva ? (g.iva ? ' al ' + g.iva + ' %' : ' exenta') : ''}</span><span>${eur(g.base)}</span></div>${g.iva ? `<div><span>IVA ${g.iva} %</span><span>${eur(g.cuota)}</span></div>` : ''}`).join('')}
      ${t.retencion ? `<div><span>Retención IRPF ${f.retencion} %</span><span>− ${eur(t.retencion)}</span></div>` : ''}
      <div class="fp-total"><span>Total</span><span>${eur(t.total)}</span></div></div>
    ${exento ? `<div class="fp-nota">${esc(f.textoExento || aj().textoExento)}</div>` : ''}
    ${f.notas ? `<div class="fp-nota">${esc(f.notas)}</div>` : ''}
    ${f.cobro && f.cobro.cobrada ? `<div class="fp-nota">Pagada el ${fechaLarga(f.cobro.fecha)}${METODOS[f.cobro.metodo] ? ' · ' + METODOS[f.cobro.metodo] : ''}.</div>` : e.iban && f.tipo !== 'rectificativa' ? `<div class="fp-nota">Forma de pago: transferencia a ${esc(e.iban)}</div>` : ''}
    <div class="fp-pie">${esc(f.pie || aj().pie || '')}</div>
  </div>`;
}
function verPdf(id) {
  const f = facturas.find((x) => x.id === id) || editando; if (!f) return;
  let caja = $('cxImpresion');
  if (!caja) { caja = document.createElement('div'); caja.id = 'cxImpresion'; document.body.appendChild(caja); }
  caja.innerHTML = `<div class="fp-barra"><button onclick="cx.imprimir()">Descargar PDF / imprimir</button><button class="secondary" onclick="cx.cerrarPdf()">Cerrar</button>
    <span class="person-meta">En el diálogo de imprimir elige «Guardar como PDF».</span></div>${facturaHtml(f)}`;
  caja.dataset.titulo = `Factura ${f.numero || 'borrador'}${f.cliente && f.cliente.nombre ? ' - ' + f.cliente.nombre : ''}`;
  caja.style.display = 'block';
  document.body.classList.add('cx-imprimiendo');
}
function imprimir() {
  const caja = $('cxImpresion'), antes = document.title;
  document.title = caja.dataset.titulo || antes;
  window.print();
  setTimeout(() => { document.title = antes; }, 1000);
}
function cerrarPdf() { const c = $('cxImpresion'); if (c) c.style.display = 'none'; document.body.classList.remove('cx-imprimiendo'); }
function enviar(id) {
  const f = facturas.find((x) => x.id === id); if (!f) return;
  const t = f.totales || calcular(f);
  const cuerpo = `Hola${f.cliente.nombre ? ' ' + f.cliente.nombre.split(' ')[0] : ''}:\n\nTe adjunto la factura ${f.numero} de ${eur(t.total)}.\n\nUn abrazo,\nOtto`;
  verPdf(id);
  // El PDF se adjunta a mano: primero «Descargar PDF», luego el correo se abre ya escrito
  setTimeout(() => { location.href = `mailto:${encodeURIComponent(f.cliente.email)}?subject=${encodeURIComponent('Factura ' + f.numero)}&body=${encodeURIComponent(cuerpo)}`; }, 50);
  C.aviso('Descarga el PDF y adjúntalo al correo que se ha abierto');
}

// ===================== Cobros =====================
function pintarCobros() {
  perCob = periodoDe('cxPerCob', perCob);
  const q = normal(($('cxBuscaCob') || {}).value || '');
  const r = rango(perCob);
  const facIds = new Set(facturas.map((f) => f.id));
  let lista = movimientos.filter((m) => m.tipo !== 'gasto' && enRango(fechaMov(m), r));
  if (($('cxSinFac') || {}).checked) lista = lista.filter((m) => !(m.facturaId && facIds.has(m.facturaId)));
  if (q) lista = lista.filter((m) => normal([m.concepto, m.quien, m.nombre, m.email, nombreCat(m.categoria), m.facturaNumero, String(m.importe).replace('.', ',')].join(' ')).includes(q));
  lista.sort((a, b) => fechaMov(b).localeCompare(fechaMov(a)));
  const v = $('cx-cobros');
  if (!v.querySelector('#cxListaCob')) {
    v.innerHTML = `<details class="card" id="cxFormCob"><summary class="card-title" style="cursor:pointer;margin:0;">+ Apuntar un cobro sin factura</summary>
        <div style="margin-top:12px;">
          <div class="row"><input type="date" id="cbFecha" value="${hoyISO()}"><input id="cbImporte" type="text" inputmode="decimal" placeholder="Importe con IVA €"></div>
          <div class="row"><select id="cbCat">${Object.entries(CAT_INGRESO).filter(([k]) => k !== 'revisar').map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select>
            <select id="cbMetodo">${Object.entries(METODOS).map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select>
            <select id="cbIva">${IVAS.map(([k, t]) => `<option value="${k}" ${k === Number(aj().ivaDefecto) ? 'selected' : ''}>IVA ${t}</option>`).join('')}</select></div>
          <input id="cbConcepto" data-vivo placeholder="Concepto (p. ej. Tutoría 2 h · Marta)">
          <input id="cbQuien" data-vivo placeholder="Quién paga (opcional)">
          <button onclick="cx.guardarCobro()">Apuntar</button>
          <div class="person-meta" style="margin-top:6px;">Lo normal es hacer factura de cada venta (desde «Facturas» el cobro se apunta solo). Esto es para lo que no la lleva todavía: luego puedes hacérsela con «Hacer factura».</div>
        </div></details>
      <div class="card"><div class="row" style="align-items:center;flex-wrap:wrap;">
        <input id="cxBuscaCob" placeholder="Buscar cobros" oninput="cx.pintar()" style="margin:0;flex:2 1 200px;">
        <label class="consent-toggle" style="margin:0;flex:0 0 auto;"><input type="checkbox" id="cxSinFac" onchange="cx.pintar()"> Solo sin factura</label>
        <div style="flex:0 0 auto;" id="cxPerCobCaja"></div></div></div>
      <div class="cx-lista" id="cxListaCob"></div><div class="person-meta" id="cxTotCob" style="text-align:right;margin-top:6px;"></div>`;
  }
  if (!$('cxPerCobCaja').contains(document.activeElement)) $('cxPerCobCaja').innerHTML = selPeriodo('cxPerCob', perCob, 'cx.pintar()');
  $('cxListaCob').innerHTML = lista.map((m) => {
    const conFac = m.facturaId && facIds.has(m.facturaId);
    return `<div class="cx-fila">
      <div class="cx-fecha">${fechaES(fechaMov(m))}</div>
      <div class="cx-quien"><b>${esc(m.concepto || nombreCat(m.categoria))}</b><div class="person-meta">${esc(nombreCat(m.categoria))} · ${esc(METODOS[m.metodo] || m.metodo || '')}${m.quien || m.nombre || m.email ? ' · ' + esc(m.quien || m.nombre || m.email) : ''}${m.origen === 'auto' ? ' · automático' : ''}</div></div>
      <div class="cx-tags">${conFac ? `<span class="tag t-plus" style="cursor:pointer" onclick="cx.ver('facturas');cx.abrirFactura('${m.facturaId}')">${esc(m.facturaNumero || 'factura')}</span>` : m.categoria === 'donativo' ? '<span class="tag t-off">donativo</span>' : `<button class="small secondary" onclick="cx.facturaDeCobro('${m.id}')">Hacer factura</button>`}</div>
      <div class="cx-imp">${eur(m.importe)}</div>
      <div>${m.origen === 'manual' && !conFac ? `<button class="small danger" onclick="cx.borrarMov('${m.id}')" title="Borrar">✕</button>` : ''}</div>
    </div>`;
  }).join('') || '<div class="empty" style="padding:16px;">Sin cobros en este periodo</div>';
  $('cxTotCob').textContent = lista.length ? `${lista.length} cobros · ${eur(lista.reduce((n, m) => n + num(m.importe), 0))}` : '';
}
async function guardarCobro() {
  const importe = num($('cbImporte').value);
  if (!(importe > 0)) return C.aviso('Pon un importe', true);
  const iva = Number($('cbIva').value), base = r2(importe / (1 + iva / 100));
  try {
    await setDoc(doc(db, 'ingresos', 'm-' + C.uid()), {
      tipo: 'ingreso', fechaManual: $('cbFecha').value || hoyISO(), fecha: serverTimestamp(), importe, moneda: 'EUR', ivaPct: iva, base, cuotaIva: r2(importe - base),
      categoria: $('cbCat').value, actividad: ACT_DE_CAT[$('cbCat').value] || 'fotografia', metodo: $('cbMetodo').value, concepto: $('cbConcepto').value.trim(), quien: $('cbQuien').value.trim(), origen: 'manual',
    });
    ['cbImporte', 'cbConcepto', 'cbQuien'].forEach((i) => { $(i).value = ''; });
    C.aviso('Cobro apuntado ✓');
  } catch (e) { C.aviso('Error: ' + e.message, true); }
}
async function borrarMov(id) {
  const m = movimientos.find((x) => x.id === id);
  if (!confirm('¿Borrar este movimiento?')) return;
  try {
    if (m && m.justificante) await archivos({ accion: 'borrar-justificante', j: m.justificante }).catch(() => {});
    await deleteDoc(doc(db, 'ingresos', id)); C.aviso('Borrado');
  } catch (e) { C.aviso('Error: ' + e.message, true); }
}
function facturaDeCobro(id) {
  const m = movimientos.find((x) => x.id === id); if (!m) return;
  const iva = m.ivaPct != null ? Number(m.ivaPct) : Number(aj().ivaDefecto);
  const p = m.personId ? C.personas().find((x) => x.id === m.personId) : C.personas().find((x) => m.email && x.email && x.email.toLowerCase() === m.email.toLowerCase());
  nuevaFactura({
    fecha: fechaMov(m), categoria: m.categoria && CAT_INGRESO[m.categoria] && m.categoria !== 'revisar' ? m.categoria : 'otros',
    cliente: { nombre: m.quien || m.nombre || (p ? [p.name, p.apellidos].filter(Boolean).join(' ') : ''), nif: '', direccion: '', email: m.email || (p && p.email) || '', personId: p ? p.id : '' },
    lineas: [{ concepto: m.concepto || nombreCat(m.categoria), cantidad: 1, precio: String(m.importe).replace('.', ','), iva }],
    ivaIncluido: true, cobro: { cobrada: true, metodo: m.metodo || 'transferencia', fecha: fechaMov(m) }, origen: { ingresoId: m.id },
  });
}


// ===================== Mirar Despacio+ (cobros de las suscripciones) =====================
// Los cobros de MD+ son los movimientos de las categorías de MD+ (los apunta Stripe solo, o tú al
// renovar desde Accesos y MD+ poniendo lo que te ha pagado). Aquí se ven por persona y por periodo.
const CATS_PLUS = ['mirar-despacio-plus', 'regalo-plus'];
const esPlus = (m) => m.tipo !== 'gasto' && CATS_PLUS.includes(m.categoria);
const nombreP = (p) => [p.name, p.apellidos].filter(Boolean).join(' ') || p.email || 'Sin nombre';
function cobrosDe(p) {
  const em = String(p.email || '').toLowerCase();
  return movimientos.filter((m) => esPlus(m) && (m.personId === p.id || (em && String(m.email || '').toLowerCase() === em)))
    .sort((a, b) => fechaMov(b).localeCompare(fechaMov(a)));
}
function ultimoCobroPlus(p) { return cobrosDe(p)[0] || null; }
let perPlus = perResumen;
function pintarPlus() {
  perPlus = periodoDe('cxPerPlus', perPlus);
  const r = rango(perPlus), hoy = hoyISO();
  const q = normal(($('cxBuscaPlus') || {}).value || '');
  const activos = C.personas().filter((p) => p.subscription && p.subscription.active && (!p.subscription.until || p.subscription.until >= isoDe(new Date(Date.now() - 3 * 864e5))));
  const hace35 = isoDe(new Date(Date.now() - 35 * 864e5));
  const filas = activos.map((p) => {
    const cs = cobrosDe(p), u = cs[0];
    return { p, u, total: cs.reduce((n, m) => n + num(m.importe), 0), sinCobro: !u || fechaMov(u) < hace35 };
  }).filter((x) => !q || normal([nombreP(x.p), x.p.email].join(' ')).includes(q))
    .sort((a, b) => b.sinCobro - a.sinCobro || String(a.p.subscription.until || '9').localeCompare(String(b.p.subscription.until || '9')));
  const delPeriodo = movimientos.filter((m) => esPlus(m) && enRango(fechaMov(m), r)).sort((a, b) => fechaMov(b).localeCompare(fechaMov(a)));
  const listaPer = q ? delPeriodo.filter((m) => normal([m.quien, m.nombre, m.email, m.concepto].join(' ')).includes(q)) : delPeriodo;
  const v = $('cx-plus');
  if (!v.querySelector('#cxListaPlus')) {
    v.innerHTML = `<div class="card"><div class="stat-grid" style="margin:0;" id="cxPlusStats"></div></div>
      <div class="card"><div class="row" style="align-items:center;flex-wrap:wrap;">
        <input id="cxBuscaPlus" placeholder="Buscar por nombre o email" oninput="cx.pintar()" style="margin:0;flex:2 1 200px;">
        <div style="flex:0 0 auto;" id="cxPerPlusCaja"></div></div>
        <div class="person-meta" style="margin-top:8px;">Para apuntar un cobro, renueva o da de alta desde <a href="#" onclick="showTab('accesos');return false;">Accesos y MD+</a> poniendo lo que te ha pagado. Los pagos por Stripe se apuntarán solos.</div></div>
      <div class="card-title" style="margin-top:6px;">Suscripciones activas</div>
      <div class="cx-lista" id="cxListaPlusActivos"></div>
      <div class="card-title" style="margin-top:18px;">Cobros del periodo</div>
      <div class="cx-lista" id="cxListaPlus"></div>`;
  }
  if (!$('cxPerPlusCaja').contains(document.activeElement)) $('cxPerPlusCaja').innerHTML = selPeriodo('cxPerPlus', perPlus, 'cx.pintar()');
  const sin = filas.filter((x) => x.sinCobro).length;
  $('cxPlusStats').innerHTML = `<div class="stat-box"><div class="stat-num">${activos.length}</div><div class="stat-label">activas</div></div>
    <div class="stat-box"><div class="stat-num">${eur(delPeriodo.reduce((n, m) => n + num(m.importe), 0))}</div><div class="stat-label">cobrado en el periodo</div></div>
    <div class="stat-box"><div class="stat-num">${delPeriodo.length}</div><div class="stat-label">cobros</div></div>
    <div class="stat-box"><div class="stat-num" style="${sin ? 'color:var(--warn)' : ''}">${sin}</div><div class="stat-label">sin cobro en el último mes</div></div>`;
  $('cxListaPlusActivos').innerHTML = filas.map(({ p, u, total, sinCobro }) => {
    const s = p.subscription || {};
    return `<div class="cx-fila" onclick="showTab('accesos')">
      <div class="cx-quien"><b>${esc(nombreP(p))}</b><div class="person-meta">${s.nivel === 'online' ? 'Online' : 'Con salidas'}${s.until ? ' · hasta ' + fechaES(s.until) : ''}${s.origen === 'stripe' ? ' · Stripe' : ''}</div></div>
      <div class="cx-tags">${sinCobro ? '<span class="tag t-man">sin cobro apuntado este mes</span>' : `<span class="tag t-off">último ${fechaES(fechaMov(u))} · ${eur(u.importe)}</span>`}</div>
      <div class="cx-imp">${eur(total)}<div class="person-meta">en total</div></div>
    </div>`;
  }).join('') || '<div class="empty" style="padding:16px;">No hay suscripciones activas</div>';
  $('cxListaPlus').innerHTML = listaPer.map((m) => `<div class="cx-fila" style="cursor:default">
      <div class="cx-fecha">${fechaES(fechaMov(m))}</div>
      <div class="cx-quien"><b>${esc(m.quien || m.nombre || m.email || '—')}</b><div class="person-meta">${esc(m.concepto || nombreCat(m.categoria))} · ${esc(METODOS[m.metodo] || m.metodo || '')}${m.origen === 'auto' ? ' · automático' : ''}</div></div>
      <div class="cx-tags">${m.facturaId ? `<span class="tag t-plus">${esc(m.facturaNumero || 'factura')}</span>` : `<button class="small secondary" onclick="cx.facturaDeCobro('${m.id}')">Hacer factura</button>`}</div>
      <div class="cx-imp">${eur(m.importe)}</div>
    </div>`).join('') || '<div class="empty" style="padding:16px;">Sin cobros de MD+ en este periodo</div>';
}

// ===================== Gastos =====================
async function archivos(cuerpo) {
  const token = await C.auth.currentUser.getIdToken();
  const r = await fetch('/.netlify/functions/crm-archivos', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(cuerpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'error ' + r.status);
  return j;
}
export { archivos };

function formGastoHtml(g) {
  const proveedores = [...new Set(movimientos.filter((m) => m.tipo === 'gasto' && m.proveedor).map((m) => m.proveedor))].sort();
  return `<div style="margin-top:12px;">
    <div class="cx-dos">
      <div>
        <input id="gsProveedor" data-vivo list="gsProvs" placeholder="Proveedor (tienda, empresa…)" value="${esc(g.proveedor || '')}" onchange="cx.elegirProveedor()">
        <datalist id="gsProvs">${proveedores.map((p) => `<option value="${esc(p)}">`).join('')}</datalist>
        <div class="row"><input id="gsNif" data-vivo placeholder="NIF del proveedor" value="${esc(g.nifProveedor || '')}"><input id="gsNumero" data-vivo placeholder="Nº de su factura" value="${esc(g.numeroFactura || '')}"></div>
        <input id="gsConcepto" data-vivo placeholder="Qué has comprado (p. ej. Tarjetas de bolsillo, 100 uds.)" value="${esc(g.concepto || '')}">
        ${selActividad('gsAct', actividadDe(g), 'cx.calcGasto()')}
        <div class="row"><input type="date" id="gsFecha" value="${esc(g.fechaManual || hoyISO())}" title="Fecha de la factura"><select id="gsCat" onchange="if(this.value==='mercancia')document.getElementById('gsAct').value='comercio';cx.calcGasto()">${Object.entries(CAT_GASTO).map(([k, t]) => `<option value="${k}" ${g.categoria === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      </div>
      <div>
        <label class="consent-toggle" style="margin:0 0 8px;"><input type="checkbox" id="gsConFactura" ${(g.id ? g.conFactura : g.conFactura !== false) ? 'checked' : ''} onchange="cx.calcGasto()"> Es factura con mi NIF (si es un ticket, desmárcalo: su IVA no se deduce)</label>
        <div class="row"><input id="gsTotal" data-vivo type="text" inputmode="decimal" placeholder="Total pagado €" value="${g.importe != null ? esc(String(g.importe).replace('.', ',')) : ''}" oninput="cx.calcGasto()">
          <select id="gsIva" onchange="cx.calcGasto()">${IVAS.map(([k, t]) => `<option value="${k}" ${Number(g.ivaPct != null ? g.ivaPct : 21) === k ? 'selected' : ''}>IVA ${t}</option>`).join('')}</select></div>
        <div class="row" id="gsPartes"><input id="gsBase" data-vivo type="text" inputmode="decimal" placeholder="Base" title="Base imponible (se calcula sola; cámbiala si la factura mezcla tipos)" value="${g.base != null ? esc(String(g.base).replace('.', ',')) : ''}">
          <input id="gsCuota" data-vivo type="text" inputmode="decimal" placeholder="IVA €" title="Cuota de IVA" value="${g.cuotaIva != null ? esc(String(g.cuotaIva).replace('.', ',')) : ''}">
          <input id="gsRecargo" data-vivo type="text" inputmode="decimal" placeholder="Recargo €" title="Recargo de equivalencia (solo compras para revender)" value="${g.recargo ? esc(String(g.recargo).replace('.', ',')) : ''}">
          <select id="gsDeducible" title="Parte que es de la actividad">${[[100, 'Deducible 100 %'], [50, 'Deducible 50 %'], [30, 'Deducible 30 %'], [0, 'No deducible']].map(([k, t]) => `<option value="${k}" ${Number(g.deducible != null ? g.deducible : 100) === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="person-meta" id="gsActNota"></div>
        <select id="gsMetodo">${Object.entries(METODOS).map(([k, t]) => `<option value="${k}" ${(g.metodo || 'tarjeta') === k ? 'selected' : ''}>Pagado con ${t.toLowerCase()}</option>`).join('')}</select>
      </div>
    </div>
    <div class="cx-etq">Justificante (foto o PDF de la factura)</div>
    <div id="gsJust">${g.justificante ? `<span class="tag t-plus">📎 ${esc(g.justificante.nombre || 'adjunto')}</span> <button class="small secondary" type="button" onclick="cx.verJust('${g.id}')">Ver</button> <button class="small danger" type="button" onclick="cx.quitarJust()">Quitar</button>` : ''}</div>
    <input type="file" id="gsArchivo" accept="image/*,application/pdf" style="${g.justificante ? 'display:none' : ''}">
    <div class="row" style="flex-wrap:wrap;">
      <button onclick="cx.guardarGasto()">${g.id ? 'Guardar cambios' : 'Apuntar gasto'}</button>
      ${g.id ? `<button class="secondary" onclick="cx.cancelarGasto()">Cancelar</button><button class="danger" onclick="cx.borrarMov('${g.id}');cx.cancelarGasto()">Borrar gasto</button>` : ''}
    </div>
  </div>`;
}
let justQuitado = false;
function pintarGastos() {
  perGas = periodoDe('cxPerGas', perGas);
  const q = normal(($('cxBuscaGas') || {}).value || '');
  const r = rango(perGas);
  let lista = movimientos.filter((m) => m.tipo === 'gasto' && enRango(fechaMov(m), r));
  if (($('cxSinJust') || {}).checked) lista = lista.filter((m) => !m.justificante);
  if (q) lista = lista.filter((m) => normal([m.proveedor, m.nifProveedor, m.numeroFactura, m.concepto, m.quien, nombreCat(m.categoria), String(m.importe).replace('.', ',')].join(' ')).includes(q));
  lista.sort((a, b) => fechaMov(b).localeCompare(fechaMov(a)));
  const v = $('cx-gastos');
  if (!v.querySelector('#cxListaGas')) {
    v.innerHTML = `<details class="card" id="cxFormGas"><summary class="card-title" style="cursor:pointer;margin:0;" id="cxFormGasTit">+ Apuntar un gasto</summary><div id="cxFormGasCuerpo"></div></details>
      <div class="card"><div class="row" style="align-items:center;flex-wrap:wrap;">
        <input id="cxBuscaGas" placeholder="Buscar por proveedor, concepto, número o importe" oninput="cx.pintar()" style="margin:0;flex:2 1 200px;">
        <label class="consent-toggle" style="margin:0;flex:0 0 auto;"><input type="checkbox" id="cxSinJust" onchange="cx.pintar()"> Solo sin justificante</label>
        <div style="flex:0 0 auto;" id="cxPerGasCaja"></div></div></div>
      <div class="cx-lista" id="cxListaGas"></div><div class="person-meta" id="cxTotGas" style="text-align:right;margin-top:6px;"></div>`;
    $('cxFormGasCuerpo').innerHTML = formGastoHtml({});
    calcGasto();
  }
  if (!$('cxPerGasCaja').contains(document.activeElement)) $('cxPerGasCaja').innerHTML = selPeriodo('cxPerGas', perGas, 'cx.pintar()');
  $('cxListaGas').innerHTML = lista.map((m) => {
    const p = partesGasto(m);
    return `<div class="cx-fila" onclick="if(!event.target.closest('button,.tag'))cx.editarGasto('${m.id}')">
      <div class="cx-fecha">${fechaES(fechaMov(m))}</div>
      <div class="cx-quien"><b>${esc(m.proveedor || m.quien || m.concepto || nombreCat(m.categoria))}</b><div class="person-meta">${esc([m.concepto && m.proveedor ? m.concepto : '', nombreCat(m.categoria), ACTIVIDADES[actividadDe(m)].nombre.split(' (')[0], m.numeroFactura ? 'nº ' + m.numeroFactura : ''].filter(Boolean).join(' · '))}</div></div>
      <div class="cx-tags">${m.justificante ? `<span class="tag t-plus" style="cursor:pointer" onclick="cx.verJust('${m.id}')">📎 ver</span>` : '<span class="tag t-man">sin justificante</span>'}${!m.conFactura ? '<span class="tag t-off">ticket</span>' : p.ivaDeducible ? `<span class="tag t-off">IVA ${eur(p.ivaDeducible)}</span>` : ''}${m.suscripcionId ? '<span class="tag t-fotos">suscripción</span>' : ''}</div>
      <div class="cx-imp">${eur(m.importe)}</div>
    </div>`;
  }).join('') || '<div class="empty" style="padding:16px;">Sin gastos en este periodo</div>';
  $('cxTotGas').textContent = lista.length ? `${lista.length} gastos · ${eur(lista.reduce((n, m) => n + num(m.importe), 0))} pagados · ${eur(lista.reduce((n, m) => n + partesGasto(m).ivaDeducible, 0))} de IVA deducible` : '';
}
function visGasto() {
  const re = $('gsAct').value === 'comercio';
  $('gsPartes').style.opacity = $('gsConFactura').checked ? '' : '.45';
  $('gsRecargo').style.display = re ? '' : 'none';
  $('gsActNota').textContent = re ? 'Compra para revender: el proveedor te cobra IVA y recargo de equivalencia. Ninguno se deduce: todo cuenta como coste.' : 'Los gastos comunes a todo (equipo, web, gestoría…) van a Fotografía.';
  return re;
}
function calcGasto() {
  const con = $('gsConFactura').checked;
  const re = visGasto();
  const total = num($('gsTotal').value), iva = Number($('gsIva').value);
  if (!con) { $('gsBase').value = ''; $('gsCuota').value = ''; $('gsRecargo').value = ''; return; }
  if (!total) return;
  // Total = base + IVA (+ recargo si es para revender)
  const rec = re ? RECARGO[iva] || 0 : 0;
  const base = r2(total / (1 + (iva + rec) / 100));
  $('gsBase').value = String(base).replace('.', ',');
  $('gsCuota').value = String(r2(base * iva / 100)).replace('.', ',');
  $('gsRecargo').value = re ? String(r2(total - base - r2(base * iva / 100))).replace('.', ',') : '';
}
function elegirProveedor() {
  const p = $('gsProveedor').value.trim();
  const ant = movimientos.filter((m) => m.tipo === 'gasto' && m.proveedor === p).sort((a, b) => fechaMov(b).localeCompare(fechaMov(a)))[0];
  if (!ant) return;
  if (!$('gsNif').value) $('gsNif').value = ant.nifProveedor || '';
  $('gsCat').value = ant.categoria || $('gsCat').value;
  if (ant.actividad) $('gsAct').value = ant.actividad;
  if (ant.ivaPct != null) $('gsIva').value = ant.ivaPct;
  calcGasto();
}
function editarGasto(id) {
  const g = movimientos.find((m) => m.id === id); if (!g) return;
  gastoEditando = id; justQuitado = false;
  const d = $('cxFormGas'); d.open = true;
  $('cxFormGasTit').textContent = '✎ Editar gasto';
  $('cxFormGasCuerpo').innerHTML = formGastoHtml(g);
  visGasto();
  d.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function cancelarGasto() {
  gastoEditando = null; justQuitado = false;
  $('cxFormGasTit').textContent = '+ Apuntar un gasto';
  $('cxFormGasCuerpo').innerHTML = formGastoHtml({});
  $('cxFormGas').open = false;
  calcGasto();
}
function quitarJust() { justQuitado = true; $('gsJust').innerHTML = '<span class="person-meta">Se quitará al guardar</span>'; $('gsArchivo').style.display = ''; }

// Fotos muy grandes se reducen antes de subirlas (para leer una factura sobran 2400 px)
async function reducir(file) {
  if (!/^image\//.test(file.type) || file.size < 1.5e6) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    const blob = await new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch (e) { return file; }
}
async function subirJustificante(file) {
  file = await reducir(file);
  const s = await archivos({ accion: 'subir-justificante', nombre: file.name, tipo: file.type });
  if (s.almacen === 'r2') {
    const r = await fetch(s.url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
    if (!r.ok) throw new Error('No se pudo subir el justificante (' + r.status + ')');
    return { almacen: 'r2', clave: s.clave, nombre: s.nombre, tipo: file.type };
  }
  const fd = new FormData();
  Object.entries(s.campos).forEach(([k, v]) => fd.append(k, v));
  fd.append('file', file);
  const r = await fetch(s.url, { method: 'POST', body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('No se pudo subir el justificante: ' + ((j.error && j.error.message) || r.status));
  return { almacen: 'cloudinary', id: j.public_id, recurso: s.recurso, formato: j.format || '', nombre: s.nombre, tipo: file.type };
}
async function guardarGasto() {
  const total = num($('gsTotal').value);
  if (!(total > 0)) return C.aviso('Pon el total pagado', true);
  const con = $('gsConFactura').checked;
  const datos = {
    tipo: 'gasto', fechaManual: $('gsFecha').value || hoyISO(), importe: total, moneda: 'EUR',
    proveedor: $('gsProveedor').value.trim(), nifProveedor: $('gsNif').value.trim().toUpperCase(), numeroFactura: $('gsNumero').value.trim(),
    concepto: $('gsConcepto').value.trim(), categoria: $('gsCat').value, metodo: $('gsMetodo').value,
    conFactura: con, ivaPct: con ? Number($('gsIva').value) : 0,
    base: con ? num($('gsBase').value) : total, cuotaIva: con ? num($('gsCuota').value) : 0,
    deducible: Number($('gsDeducible').value), quien: $('gsProveedor').value.trim(),
    actividad: $('gsAct').value, recargo: con && $('gsAct').value === 'comercio' ? num($('gsRecargo').value) : 0,
  };
  if (con && Math.abs(datos.base + datos.cuotaIva + datos.recargo - total) > 0.02) return C.aviso('La base más el IVA no suma el total: revisa los importes', true);
  const anterior = gastoEditando ? movimientos.find((m) => m.id === gastoEditando) : null;
  const file = $('gsArchivo').files[0];
  try {
    C.aviso(file ? 'Subiendo el justificante…' : 'Guardando…');
    if (file) datos.justificante = await subirJustificante(file);
    else if (justQuitado) datos.justificante = null;
    if (anterior && anterior.justificante && (file || justQuitado)) archivos({ accion: 'borrar-justificante', j: anterior.justificante }).catch(() => {});
    if (anterior) await updateDoc(doc(db, 'ingresos', anterior.id), datos);
    else await setDoc(doc(db, 'ingresos', 'g-' + C.uid()), { ...datos, fecha: serverTimestamp(), origen: 'manual', suscripcionId: susCargo || null });
    if (!anterior && susCargo) await avanzarSuscripcion(susCargo);
    susCargo = null;
    C.aviso(anterior ? 'Gasto actualizado ✓' : 'Gasto apuntado ✓');
    cancelarGasto();
  } catch (e) { C.aviso('Error: ' + e.message, true); }
}
async function verJust(id) {
  const m = movimientos.find((x) => x.id === id); if (!m || !m.justificante) return;
  // La ventana se abre ya (si no, el navegador la bloquea) y se le pone la dirección al llegar
  const w = window.open('', '_blank');
  try {
    const { url } = await archivos({ accion: 'ver-justificante', j: m.justificante });
    if (w) w.location.href = url; else location.href = url;
  } catch (e) { if (w) w.close(); C.aviso('No se pudo abrir: ' + e.message, true); }
}

// ===================== Suscripciones (cargos que se repiten) =====================
let susCargo = null;
const PERIODOS = { mensual: ['al mes', 1], trimestral: ['al trimestre', 3], anual: ['al año', 12] };
function sumarPeriodo(iso, periodo) {
  const d = new Date(iso + 'T12:00:00'), dia = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + (PERIODOS[periodo] || PERIODOS.mensual)[1]);
  d.setDate(Math.min(dia, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return isoDe(d);
}
function pintarSuscripciones() {
  const q = normal(($('cxBuscaSus') || {}).value || '');
  const hoy = hoyISO(), semana = isoDe(new Date(Date.now() + 7 * 864e5));
  let lista = suscripciones.slice();
  if (q) lista = lista.filter((s) => normal([s.nombre, s.proveedor, s.notas, nombreCat(s.categoria)].join(' ')).includes(q));
  lista.sort((a, b) => (a.activa === false) - (b.activa === false) || String(a.proximo || '9').localeCompare(String(b.proximo || '9')));
  const activas = suscripciones.filter((s) => s.activa !== false);
  const mes = activas.reduce((n, s) => n + num(s.importe) / (PERIODOS[s.periodo] || PERIODOS.mensual)[1], 0);
  const s0 = susEditando ? suscripciones.find((x) => x.id === susEditando) || {} : {};
  const v = $('cx-suscripciones');
  if (!v.querySelector('#cxListaSus')) v.innerHTML = `<div class="card"><div class="stat-grid" style="margin:0;" id="cxSusStats"></div></div>
    <details class="card" id="cxFormSus"><summary class="card-title" style="cursor:pointer;margin:0;" id="cxFormSusTit">+ Añadir una suscripción</summary><div id="cxFormSusCuerpo"></div></details>
    <div class="card"><input id="cxBuscaSus" placeholder="Buscar suscripciones" oninput="cx.pintar()" style="margin:0;"></div>
    <div class="cx-lista" id="cxListaSus"></div>
    <div class="person-meta" style="margin-top:8px;">Cuando llega el cargo, «Apuntar cargo» te abre el gasto ya rellenado para que adjuntes la factura; al guardarlo, la fecha del próximo cargo avanza sola.</div>`;
  $('cxSusStats').innerHTML = `<div class="stat-box"><div class="stat-num">${activas.length}</div><div class="stat-label">activas</div></div>
    <div class="stat-box"><div class="stat-num">${eur(mes)}</div><div class="stat-label">al mes</div></div>
    <div class="stat-box"><div class="stat-num">${eur(mes * 12)}</div><div class="stat-label">al año</div></div>`;
  if (!$('cxFormSusCuerpo').innerHTML || !$('cxFormSus').contains(document.activeElement)) {
    $('cxFormSusCuerpo').innerHTML = `<div style="margin-top:12px;">
      <div class="row"><input id="ssNombre" data-vivo placeholder="Nombre (p. ej. Netlify Pro)" value="${esc(s0.nombre || '')}"><input id="ssProveedor" data-vivo placeholder="Empresa que cobra" value="${esc(s0.proveedor || '')}"></div>
      <div class="row"><input id="ssImporte" data-vivo type="text" inputmode="decimal" placeholder="Importe de cada cargo €" value="${s0.importe != null ? esc(String(s0.importe).replace('.', ',')) : ''}">
        <select id="ssPeriodo">${Object.entries(PERIODOS).map(([k, [t]]) => `<option value="${k}" ${(s0.periodo || 'mensual') === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <input id="ssProximo" type="date" value="${esc(s0.proximo || hoyISO())}" title="Próximo cargo"></div>
      <div class="row"><select id="ssCat">${Object.entries(CAT_GASTO).map(([k, t]) => `<option value="${k}" ${(s0.categoria || 'software') === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <select id="ssIva">${IVAS.map(([k, t]) => `<option value="${k}" ${Number(s0.ivaPct != null ? s0.ivaPct : 21) === k ? 'selected' : ''}>IVA ${t}</option>`).join('')}</select>
        <select id="ssMetodo">${Object.entries(METODOS).map(([k, t]) => `<option value="${k}" ${(s0.metodo || 'tarjeta') === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <input id="ssNotas" data-vivo placeholder="Notas (para qué es, dónde se descarga la factura…)" value="${esc(s0.notas || '')}">
      <div class="row" style="flex-wrap:wrap;"><button onclick="cx.guardarSus()">${susEditando ? 'Guardar cambios' : 'Añadir'}</button>
        ${susEditando ? `<button class="secondary" onclick="cx.editarSus(null)">Cancelar</button><button class="danger" onclick="cx.borrarSus('${susEditando}')">Borrar</button>` : ''}</div>
    </div>`;
  }
  $('cxListaSus').innerHTML = lista.map((s) => {
    const off = s.activa === false, toca = !off && s.proximo && s.proximo <= hoy, pronto = !off && s.proximo && s.proximo <= semana;
    return `<div class="cx-fila" style="${off ? 'opacity:.55' : ''}">
      <div class="cx-quien"><b>${esc(s.nombre)}</b><div class="person-meta">${esc([s.proveedor, nombreCat(s.categoria), s.notas].filter(Boolean).join(' · '))}</div></div>
      <div class="cx-tags">${off ? '<span class="tag t-off">pausada</span>' : `<span class="tag ${toca ? 't-dup' : pronto ? 't-man' : 't-off'}">${toca ? 'toca apuntar · ' : ''}${fechaES(s.proximo)}</span>`}</div>
      <div class="cx-imp">${eur(s.importe)}<div class="person-meta">${(PERIODOS[s.periodo] || PERIODOS.mensual)[0]}</div></div>
      <div class="cx-acc">${!off ? `<button class="small" onclick="cx.cargoSus('${s.id}')">Apuntar cargo</button>` : ''}
        <button class="small secondary" onclick="cx.editarSus('${s.id}')">Editar</button>
        <button class="small secondary" onclick="cx.pausarSus('${s.id}')">${off ? 'Reactivar' : 'Pausar'}</button></div>
    </div>`;
  }).join('') || '<div class="empty" style="padding:16px;">Apunta aquí lo que pagas cada mes o cada año: Netlify, Adobe, Brevo, el dominio…</div>';
}
function editarSus(id) {
  susEditando = id;
  $('cxFormSusCuerpo').innerHTML = '';
  $('cxFormSusTit').textContent = id ? '✎ Editar suscripción' : '+ Añadir una suscripción';
  pintarSuscripciones();
  $('cxFormSus').open = !!id;
  if (id) $('cxFormSus').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function guardarSus() {
  const nombre = $('ssNombre').value.trim(), importe = num($('ssImporte').value);
  if (!nombre || !(importe > 0)) return C.aviso('Pon el nombre y el importe', true);
  const datos = { nombre, proveedor: $('ssProveedor').value.trim(), importe, periodo: $('ssPeriodo').value, proximo: $('ssProximo').value || hoyISO(),
    categoria: $('ssCat').value, ivaPct: Number($('ssIva').value), metodo: $('ssMetodo').value, notas: $('ssNotas').value.trim() };
  try {
    if (susEditando) await updateDoc(doc(db, 'suscripciones_gasto', susEditando), datos);
    else await setDoc(doc(db, 'suscripciones_gasto', 's-' + C.uid()), { ...datos, activa: true, creada: serverTimestamp() });
    C.aviso('Guardada ✓'); editarSus(null);
  } catch (e) { C.aviso('Error: ' + e.message, true); }
}
async function borrarSus(id) {
  if (!confirm('¿Borrar esta suscripción? Los gastos ya apuntados se quedan.')) return;
  try { await deleteDoc(doc(db, 'suscripciones_gasto', id)); editarSus(null); } catch (e) { C.aviso('Error: ' + e.message, true); }
}
async function pausarSus(id) {
  const s = suscripciones.find((x) => x.id === id); if (!s) return;
  try { await updateDoc(doc(db, 'suscripciones_gasto', id), { activa: s.activa === false }); } catch (e) { C.aviso('Error: ' + e.message, true); }
}
function cargoSus(id) {
  const s = suscripciones.find((x) => x.id === id); if (!s) return;
  ver('gastos');
  const ant = movimientos.filter((m) => m.suscripcionId === id).sort((a, b) => fechaMov(b).localeCompare(fechaMov(a)))[0] || {};
  gastoEditando = null; justQuitado = false;
  $('cxFormGasCuerpo').innerHTML = formGastoHtml({
    proveedor: s.proveedor || s.nombre, nifProveedor: ant.nifProveedor || '', concepto: `${s.nombre} · ${new Date(s.proximo + 'T12:00:00').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`,
    fechaManual: s.proximo || hoyISO(), categoria: s.categoria || 'software', importe: s.importe, ivaPct: s.ivaPct, metodo: s.metodo, conFactura: ant.conFactura !== false,
  });
  susCargo = id;
  $('cxFormGasTit').textContent = '+ Cargo de ' + s.nombre;
  $('cxFormGas').open = true;
  calcGasto();
  $('cxFormGas').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function avanzarSuscripcion(id) {
  const s = suscripciones.find((x) => x.id === id); if (!s) return;
  await updateDoc(doc(db, 'suscripciones_gasto', id), { proximo: sumarPeriodo(s.proximo || hoyISO(), s.periodo), ultimoCargo: s.proximo || hoyISO() });
}

// ===================== Tus datos =====================
function pintarAjustes() {
  const a = aj();
  conservar('cx-ajustes', `<div class="card" data-vivo>
    <div class="card-title">Datos que salen en tus facturas</div>
    <div class="cx-dos">
      <div>
        <input id="ajNombre" placeholder="Nombre y apellidos" value="${esc(a.nombre)}">
        <input id="ajNif" placeholder="NIF" value="${esc(a.nif)}">
        <input id="ajDir" placeholder="Dirección (calle, número, piso)" value="${esc(a.direccion)}">
        <div class="row"><input id="ajCp" placeholder="Código postal" value="${esc(a.cp)}"><input id="ajCiudad" placeholder="Ciudad" value="${esc(a.ciudad)}"></div>
        <div class="row"><input id="ajEmail" placeholder="Email" value="${esc(a.email)}"><input id="ajTel" placeholder="Teléfono (opcional)" value="${esc(a.telefono)}"></div>
        <input id="ajIban" placeholder="IBAN para cobrar por transferencia (opcional)" value="${esc(a.iban)}">
      </div>
      <div>
        <div class="cx-etq">Valores por defecto de las facturas nuevas</div>
        <div class="row"><select id="ajIva">${IVAS.map(([k, t]) => `<option value="${k}" ${Number(a.ivaDefecto) === k ? 'selected' : ''}>IVA ${t}</option>`).join('')}</select>
          </div>
        <select id="ajMarca">${Object.entries(MARCAS).map(([k, t]) => `<option value="${k}" ${a.marcaDefecto === k ? 'selected' : ''}>Logo: ${t}</option>`).join('')}</select>
        <label class="consent-toggle" style="margin-bottom:8px;"><input type="checkbox" id="ajIvaInc" ${a.ivaIncluido !== false ? 'checked' : ''}> Mis precios llevan el IVA incluido</label>
        <div class="cx-etq">Series de facturas (una por actividad)</div>
        ${Object.entries(ACTIVIDADES).map(([k, x]) => `<div class="row" style="align-items:center;"><span class="person-meta" style="flex:2 1 0;">${esc(x.nombre)} · ${x.iae}</span><input id="ajSerie-${k}" style="flex:1 1 0;" value="${esc((a.series || {})[k] || x.serie)}" title="Prefijo: ${esc((a.series || {})[k] || x.serie)}2026-001"></div>`).join('')}
        <div class="row" style="align-items:center;"><span class="person-meta" style="flex:2 1 0;">Rectificativas (delante de la serie: RDOC2026-001)</span><input id="ajSerieR" style="flex:1 1 0;" value="${esc(a.serieRect)}"></div>
        <input id="ajPie" placeholder="Texto al pie de la factura" value="${esc(a.pie)}">
        <textarea id="ajExento" rows="2" placeholder="Texto para lo que va exento de IVA">${esc(a.textoExento)}</textarea>
      </div>
    </div>
    <button onclick="cx.guardarAjustes()">Guardar</button>
    <div class="person-meta" style="margin-top:8px;">Según tu gestoría: talleres y tutorías llevan IVA (no son formación reglada). La retención del 7 % (15 % a partir del cuarto año) se pone sola solo en formación e informática cuando el cliente tiene NIF; quítala si es un particular. El zine y otros libros pueden ir al 4 %: pregúntaselo.</div>
  </div>`);
}
async function guardarAjustes() {
  const v = (id) => $(id).value.trim();
  try {
    await setDoc(doc(db, 'ajustes', 'facturacion'), {
      nombre: v('ajNombre'), nif: v('ajNif').toUpperCase(), direccion: v('ajDir'), cp: v('ajCp'), ciudad: v('ajCiudad'), email: v('ajEmail'), telefono: v('ajTel'),
      iban: v('ajIban').toUpperCase(), ivaDefecto: Number($('ajIva').value), marcaDefecto: $('ajMarca').value,
      ivaIncluido: $('ajIvaInc').checked, serieRect: v('ajSerieR').toUpperCase() || 'R',
      series: Object.fromEntries(Object.entries(ACTIVIDADES).map(([k, x]) => [k, (v('ajSerie-' + k) || x.serie).toUpperCase().replace(/[^A-Z0-9]/g, '')])), pie: v('ajPie'), textoExento: v('ajExento'),
    }, { merge: true });
    C.aviso('Datos guardados ✓');
  } catch (e) { C.aviso('Error: ' + e.message, true); }
}

// ===================== CSV para la gestoría =====================
function csv(tipo) {
  const per = periodoDe('cxPerRes', perResumen), r = rango(per);
  const c = cifras(r);
  const f2 = (n) => r2(n).toFixed(2).replace('.', ',');
  let filas, nombre;
  if (tipo === 'emitidas') {
    nombre = 'facturas-emitidas';
    filas = [['Número', 'Fecha', 'Actividad', 'Epígrafe', 'Tipo', 'Cliente', 'NIF cliente', 'Concepto', 'Base', 'Tipo IVA', 'Cuota IVA', 'Retención', 'Total', 'Cobrada', 'Rectifica a']];
    c.fac.slice().sort((a, b) => String(a.numero).localeCompare(b.numero)).forEach((f) => {
      const t = f.totales || calcular(f);
      const act = actividadDe(f);
      t.grupos.forEach((g, i) => filas.push([f.numero, fechaES(f.fecha), ACTIVIDADES[act].nombre, ACTIVIDADES[act].iae, f.tipo, f.cliente.nombre, f.cliente.nif, (f.lineas || []).map((l) => l.concepto).join(' / '),
        f2(g.base), g.iva + '%', f2(g.cuota), i ? '' : f2(t.retencion), i ? '' : f2(t.total), f.cobro && f.cobro.cobrada ? 'sí' : 'no', f.rectificaA ? f.rectificaA.numero : '']));
    });
  } else if (tipo === 'gastos') {
    nombre = 'libro-gastos';
    filas = [['Fecha', 'Proveedor', 'NIF proveedor', 'Nº factura', 'Concepto', 'Categoría', 'Actividad', 'Epígrafe', 'Factura o ticket', 'Base', 'Tipo IVA', 'Cuota IVA', 'Recargo equivalencia', 'Total', '% deducible', 'IVA deducible', 'Justificante']];
    c.gas.slice().sort((a, b) => fechaMov(a).localeCompare(fechaMov(b))).forEach((m) => {
      const p = partesGasto(m);
      const act = actividadDe(m);
      filas.push([fechaES(fechaMov(m)), m.proveedor || m.quien || '', m.nifProveedor || '', m.numeroFactura || '', m.concepto || '', nombreCat(m.categoria), ACTIVIDADES[act].nombre, ACTIVIDADES[act].iae,
        m.conFactura ? 'factura' : 'ticket', f2(p.base), (m.ivaPct || 0) + '%', f2(num(m.cuotaIva) || (act === 'comercio' ? 0 : p.cuota)), f2(m.recargo || 0), f2(m.importe), (m.deducible != null ? m.deducible : 100) + '%', f2(p.ivaDeducible), m.justificante ? 'sí' : 'no']);
    });
  } else {
    nombre = 'cobros-sin-factura';
    filas = [['Fecha', 'Concepto', 'Categoría', 'Actividad', 'Epígrafe', 'Quién', 'Email', 'Método', 'Base', 'IVA', 'Total', 'Origen', 'Referencia']];
    c.cobSinFac.slice().sort((a, b) => fechaMov(a).localeCompare(fechaMov(b))).forEach((m) => {
      const p = partesCobro(m);
      const act = actividadDe(m);
      filas.push([fechaES(fechaMov(m)), m.concepto || '', nombreCat(m.categoria), ACTIVIDADES[act].nombre, ACTIVIDADES[act].iae, m.quien || m.nombre || '', m.email || '', METODOS[m.metodo] || m.metodo || '', f2(p.base), f2(p.cuota), f2(m.importe), m.origen || '', m.pagoId || m.id]);
    });
  }
  const texto = '﻿' + filas.map((f) => f.map((x) => `"${String(x == null ? '' : x).replace(/"/g, '""')}"`).join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8;' }));
  a.download = `mirar-despacio-${nombre}-${per}.csv`;
  a.click();
}

// ===================== Para la tienda =====================
// Apunta un cobro (p. ej. de un pedido) y devuelve su id
export async function apuntarCobro(m) {
  const { id: idPedido, ...resto } = m;
  const id = idPedido || 'm-' + C.uid();
  const iva = m.ivaPct != null ? Number(m.ivaPct) : Number(aj().ivaDefecto);
  const base = m.base != null ? m.base : r2(num(m.importe) / (1 + iva / 100));
  await setDoc(doc(db, 'ingresos', id), { tipo: 'ingreso', fechaManual: m.fecha || hoyISO(), fecha: serverTimestamp(), moneda: 'EUR', origen: 'manual', ...resto, ivaPct: iva, base, cuotaIva: r2(num(m.importe) - base) });
  return id;
}
export const ajustesActuales = aj;
export const facturasActuales = () => facturas;

window.cx = {
  ver, pintar, nuevaFactura, abrirFactura, cerrarEditor, recalcular, masLinea, elegirCliente, guardarBorrador, borrarBorrador, emitir,
  marcarCobrada, confirmarCobro, duplicar, rectificar, verPdf, imprimir, cerrarPdf, enviar,
  guardarCobro, borrarMov, facturaDeCobro, ultimoCobroPlus,
  calcGasto, elegirProveedor, editarGasto, cancelarGasto, quitarJust, guardarGasto, verJust,
  editarSus, guardarSus, borrarSus, pausarSus, cargoSus,
  guardarAjustes, csv,
};
