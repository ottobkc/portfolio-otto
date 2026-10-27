// Tienda del CRM: productos (zine, baraja, camisetas…) con fotos, tallas y stock, y los pedidos.
//
// Colecciones de Firestore:
//   productos   nombre, tipo, descripción, precio con IVA, IVA, envío, estado, fotos, variantes [{nombre, stock}]
//   pedidos     número P-0001, cliente, líneas, envío, total, pago, estado, seguimiento, factura
//   contadores  "pedidos": último número de pedido
//
// El stock se descuenta al crear el pedido y se devuelve si se cancela (en una transacción, para
// que dos pedidos a la vez no vendan la misma unidad). La tienda pública de mirardespacio.es y el
// cobro con Stripe leerán estos mismos productos cuando se lance la parte de pago.
import {
  collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, runTransaction, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { eur, calcular, apuntarCobro, archivos } from './contabilidad.js';

const C = window.crm;
const { db } = C;
const $ = (id) => document.getElementById(id);
const esc = (s) => C.esc(s == null ? '' : String(s));
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : 0; };
const coma = (n) => String(n == null ? '' : n).replace('.', ',');
const hoyISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const fechaES = (iso) => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const normal = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const mini = (url, w) => String(url || '').replace('/image/upload/', `/image/upload/c_limit,w_${w},q_auto,f_auto/`);

const TIPOS = { zine: 'Zine', baraja: 'Baraja', camiseta: 'Camiseta', lamina: 'Lámina', otro: 'Otro' };
const ESTADOS_P = { venta: ['A la venta', 't-plus'], borrador: ['Borrador', 't-off'], agotado: ['Agotado', 't-man'], retirado: ['Retirado', 't-dup'] };
const ESTADOS_PED = {
  nuevo: ['Nuevo', 't-man'], preparando: ['Preparando', 't-fotos'], enviado: ['Enviado', 't-fotos'], entregado: ['Entregado', 't-plus'], cancelado: ['Cancelado', 't-dup'],
};
const SIGUIENTE = { nuevo: 'preparando', preparando: 'enviado', enviado: 'entregado' };
const ENTREGAS = { envio: 'Envío por correo', mano: 'En mano (salida, taller…)', recogida: 'Recogida' };
const METODOS = { bizum: 'Bizum', transferencia: 'Transferencia', tarjeta: 'Tarjeta', efectivo: 'Efectivo', stripe: 'Stripe', paypal: 'PayPal' };
const POCO = 3; // aviso de poco stock

let productos = [], pedidos = [];
let desuscribir = [];
let sub = 'pedidos';
let prodEditando = null;   // copia del producto en edición
let pedidoAbierto = null;  // id
let nuevoPedido = null;    // líneas del pedido que se está creando

const stockDe = (p) => (p.variantes || []).reduce((n, v) => n + (Number(v.stock) || 0), 0);
const conTallas = (p) => (p.variantes || []).some((v) => v.nombre);

export function iniciar() {
  detener();
  desuscribir.push(onSnapshot(collection(db, 'productos'), (s) => { productos = s.docs.map((d) => ({ id: d.id, ...d.data() })); pintarSiVisible(); }));
  desuscribir.push(onSnapshot(collection(db, 'pedidos'), (s) => { pedidos = s.docs.map((d) => ({ id: d.id, ...d.data() })); pintarSiVisible(); avisoMenu(); }));
}
export function detener() { desuscribir.forEach((f) => { try { f(); } catch (e) { /* nada */ } }); desuscribir = []; }
const visible = () => { const v = $('view-tienda'); return v && v.classList.contains('active'); };
function pintarSiVisible() { if (visible()) pintar(); }
function avisoMenu() {
  const b = $('tiendaPendientes'); if (!b) return;
  const n = pedidos.filter((p) => p.estado === 'nuevo' || p.estado === 'preparando').length;
  b.textContent = n; b.style.display = n ? '' : 'none';
}

function esqueleto() {
  const v = $('view-tienda');
  if (v.dataset.listo) return;
  v.dataset.listo = '1';
  v.innerHTML = `<div class="card"><div class="stat-grid" style="margin:0;" id="tdStats"></div></div>
    <div class="subtabs"><button type="button" class="subtab" data-tsub="pedidos" onclick="td.ver('pedidos')">Pedidos</button><button type="button" class="subtab" data-tsub="productos" onclick="td.ver('productos')">Productos</button></div>
    <div class="cx-vista" id="td-pedidos"><div id="tdPedido"></div><div id="tdNuevo"></div><div id="tdCabPed"></div><div class="cx-lista" id="tdListaPed"></div></div>
    <div class="cx-vista" id="td-productos"><div id="tdEditor"></div><div id="tdCabProd"></div><div class="td-productos" id="tdListaProd"></div></div>`;
}
export function mostrar() {
  esqueleto();
  try { sub = sessionStorage.getItem('crm-tienda') || sub; } catch (e) { /* nada */ }
  pintar();
}
function ver(k) { sub = k; try { sessionStorage.setItem('crm-tienda', k); } catch (e) { /* nada */ } pintar(); }
function pintar() {
  esqueleto();
  document.querySelectorAll('[data-tsub]').forEach((b) => b.classList.toggle('on', b.dataset.tsub === sub));
  $('td-pedidos').classList.toggle('on', sub === 'pedidos');
  $('td-productos').classList.toggle('on', sub === 'productos');
  pintarStats();
  if (sub === 'pedidos') pintarPedidos(); else pintarProductos();
}
function pintarStats() {
  const mes = hoyISO().slice(0, 7);
  const delMes = pedidos.filter((p) => p.estado !== 'cancelado' && String(p.fecha).slice(0, 7) === mes);
  const uds = delMes.reduce((n, p) => n + (p.lineas || []).reduce((m, l) => m + (Number(l.cantidad) || 0), 0), 0);
  const porHacer = pedidos.filter((p) => p.estado === 'nuevo' || p.estado === 'preparando').length;
  const pocos = productos.filter((p) => p.estado === 'venta' && stockDe(p) <= POCO).length;
  $('tdStats').innerHTML = `<div class="stat-box"><div class="stat-num">${porHacer}</div><div class="stat-label">por preparar</div></div>
    <div class="stat-box"><div class="stat-num">${eur(delMes.reduce((n, p) => n + num(p.total), 0))}</div><div class="stat-label">vendido este mes</div></div>
    <div class="stat-box"><div class="stat-num">${uds}</div><div class="stat-label">unidades este mes</div></div>
    <div class="stat-box" style="cursor:pointer" onclick="td.ver('productos')"><div class="stat-num" style="${pocos ? 'color:var(--warn)' : ''}">${pocos}</div><div class="stat-label">con poco stock</div></div>`;
}

// ===================== Productos =====================
function pintarProductos() {
  const q = normal(($('tdBuscaProd') || {}).value || '');
  if (!$('tdCabProd').innerHTML) $('tdCabProd').innerHTML = `<div class="card"><div class="row" style="align-items:center;flex-wrap:wrap;">
    <button style="flex:0 0 auto;" onclick="td.editarProducto()">+ Nuevo producto</button>
    <input id="tdBuscaProd" placeholder="Buscar productos" oninput="td.pintar()" style="margin:0;flex:1 1 200px;"></div></div>`;
  let lista = productos.slice();
  if (q) lista = lista.filter((p) => normal([p.nombre, p.descripcion, TIPOS[p.tipo], p.sku].join(' ')).includes(q));
  const orden = { venta: 0, agotado: 1, borrador: 2, retirado: 3 };
  lista.sort((a, b) => (orden[a.estado] ?? 9) - (orden[b.estado] ?? 9) || String(a.nombre).localeCompare(b.nombre, 'es'));
  $('tdListaProd').innerHTML = lista.map((p) => {
    const s = stockDe(p), [et, cl] = ESTADOS_P[p.estado] || ESTADOS_P.borrador;
    const foto = (p.fotos || [])[0];
    return `<div class="td-prod" onclick="td.editarProducto('${p.id}')">
      <div class="td-foto">${foto ? `<img src="${esc(mini(foto.url, 400))}" alt="" loading="lazy">` : '<span>sin foto</span>'}</div>
      <div class="td-info"><b>${esc(p.nombre)}</b>
        <div class="person-meta">${esc(TIPOS[p.tipo] || '')} · ${eur(p.precio)}</div>
        <div style="margin-top:6px;"><span class="tag ${cl}">${et}</span><span class="tag ${s === 0 ? 't-dup' : s <= POCO ? 't-man' : 't-off'}">${s} en stock</span></div>
        ${conTallas(p) ? `<div class="person-meta" style="margin-top:4px;">${(p.variantes || []).map((v) => `${esc(v.nombre)}: ${Number(v.stock) || 0}`).join(' · ')}</div>` : ''}
      </div></div>`;
  }).join('') || '<div class="empty" style="padding:16px;">Aún no hay productos. Empieza por el zine o la baraja.</div>';
  if (prodEditando && !$('tdEditor').innerHTML) pintarEditorProducto();
}
function editarProducto(id) {
  const p = id ? productos.find((x) => x.id === id) : null;
  prodEditando = p ? JSON.parse(JSON.stringify(p)) : { id: null, nombre: '', tipo: 'zine', descripcion: '', precio: '', iva: 21, envio: '', estado: 'borrador', fotos: [], variantes: [{ nombre: '', stock: 0 }], sku: '', enlacePago: '' };
  ver('productos');
  pintarEditorProducto();
  $('tdEditor').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function leerProducto() {
  const p = prodEditando; if (!p || !$('tpNombre')) return;
  p.nombre = $('tpNombre').value.trim(); p.tipo = $('tpTipo').value; p.descripcion = $('tpDesc').value.trim();
  p.precio = num($('tpPrecio').value); p.iva = Number($('tpIva').value); p.envio = num($('tpEnvio').value);
  p.estado = $('tpEstado').value; p.sku = $('tpSku').value.trim(); p.enlacePago = $('tpEnlace').value.trim();
  p.variantes = [...document.querySelectorAll('#tpVariantes .td-var')].map((el) => ({ nombre: el.querySelector('[data-k=nombre]').value.trim(), stock: Math.max(0, Math.round(num(el.querySelector('[data-k=stock]').value))) }));
  if (!p.variantes.length) p.variantes = [{ nombre: '', stock: 0 }];
}
const varHtml = (v) => `<div class="td-var"><input data-k="nombre" placeholder="Talla o versión (vacío si no tiene)" value="${esc(v.nombre)}"><input data-k="stock" type="number" min="0" step="1" value="${Number(v.stock) || 0}" title="Unidades"><button class="small danger" type="button" onclick="this.parentNode.remove()">✕</button></div>`;
function pintarEditorProducto() {
  const p = prodEditando, el = $('tdEditor');
  if (!p) { el.innerHTML = ''; return; }
  const vendidos = pedidos.filter((x) => x.estado !== 'cancelado' && (x.lineas || []).some((l) => l.productoId === p.id)).length;
  el.innerHTML = `<div class="card cx-editor">
    <div class="row" style="align-items:center;justify-content:space-between;"><div class="card-title" style="margin:0;flex:1 1 auto;">${p.id ? esc(p.nombre) : 'Nuevo producto'}</div>
      <button class="small secondary" style="flex:0 0 auto;" onclick="td.cerrarProducto()">Cerrar</button></div>
    <div class="cx-dos" style="margin-top:12px;">
      <div>
        <input id="tpNombre" data-vivo placeholder="Nombre (p. ej. Zine Mirar Despacio nº 1)" value="${esc(p.nombre)}">
        <div class="row"><select id="tpTipo">${Object.entries(TIPOS).map(([k, t]) => `<option value="${k}" ${p.tipo === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
          <select id="tpEstado">${Object.entries(ESTADOS_P).map(([k, [t]]) => `<option value="${k}" ${p.estado === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <textarea id="tpDesc" data-vivo rows="4" placeholder="Descripción para la tienda (tamaño, papel, páginas…)">${esc(p.descripcion)}</textarea>
        <div class="row"><input id="tpPrecio" data-vivo inputmode="decimal" placeholder="Precio con IVA €" value="${esc(coma(p.precio))}" title="Precio con IVA incluido">
          <select id="tpIva" title="IVA">${[[21, 'IVA 21 %'], [10, 'IVA 10 %'], [4, 'IVA 4 %'], [0, 'Exento']].map(([k, t]) => `<option value="${k}" ${Number(p.iva) === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
          <input id="tpEnvio" data-vivo inputmode="decimal" placeholder="Envío €" value="${esc(coma(p.envio))}" title="Gastos de envío"></div>
        <div class="row"><input id="tpSku" data-vivo placeholder="Referencia (opcional)" value="${esc(p.sku)}"><input id="tpEnlace" data-vivo placeholder="Enlace de pago de Stripe (cuando lo haya)" value="${esc(p.enlacePago)}"></div>
      </div>
      <div>
        <div class="cx-etq">Fotos <span class="person-meta">(la primera es la portada)</span></div>
        <div class="td-fotos">${(p.fotos || []).map((f, i) => `<div class="td-mini"><img src="${esc(mini(f.url, 240))}" alt="">
          <div>${i ? `<button class="small secondary" type="button" onclick="td.moverFoto(${i},-1)" title="Antes">←</button>` : ''}${i < p.fotos.length - 1 ? `<button class="small secondary" type="button" onclick="td.moverFoto(${i},1)" title="Después">→</button>` : ''}<button class="small danger" type="button" onclick="td.quitarFoto(${i})" title="Quitar">✕</button></div></div>`).join('')}</div>
        <input type="file" id="tpFotos" accept="image/*" multiple onchange="td.subirFotos()">
        <div class="cx-etq">Stock</div>
        <div id="tpVariantes">${(p.variantes || []).map(varHtml).join('')}</div>
        <div class="row" style="flex-wrap:wrap;"><button class="small secondary" type="button" onclick="td.masVariante()">+ Talla o versión</button>
          <button class="small secondary" type="button" onclick="td.tallasCamiseta()">Tallas S a XXL</button></div>
      </div>
    </div>
    <div class="row" style="margin-top:12px;flex-wrap:wrap;">
      <button onclick="td.guardarProducto()">Guardar producto</button>
      ${p.id ? (vendidos ? `<span class="person-meta" style="flex:1 1 200px;align-self:center;">Tiene ${vendidos} pedido${vendidos > 1 ? 's' : ''}: para quitarlo de la venta, ponlo como «Retirado».</span>` : `<button class="danger" onclick="td.borrarProducto()">Borrar producto</button>`) : ''}
    </div>
  </div>`;
}
function cerrarProducto() { prodEditando = null; $('tdEditor').innerHTML = ''; }
function masVariante() { leerProducto(); prodEditando.variantes.push({ nombre: '', stock: 0 }); pintarEditorProducto(); }
function tallasCamiseta() {
  leerProducto();
  const ya = Object.fromEntries(prodEditando.variantes.filter((v) => v.nombre).map((v) => [v.nombre, v.stock]));
  prodEditando.variantes = ['S', 'M', 'L', 'XL', 'XXL'].map((t) => ({ nombre: t, stock: ya[t] || 0 }));
  pintarEditorProducto();
}
function moverFoto(i, d) { leerProducto(); const f = prodEditando.fotos; [f[i], f[i + d]] = [f[i + d], f[i]]; pintarEditorProducto(); }
let fotosQuitadas = [];
function quitarFoto(i) { leerProducto(); fotosQuitadas.push(prodEditando.fotos[i]); prodEditando.fotos.splice(i, 1); pintarEditorProducto(); }
async function reducir(file) {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    if (k === 1 && file.size < 4e6) return file;
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    const blob = await new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.9));
    return blob ? new File([blob], 'foto.jpg', { type: 'image/jpeg' }) : file;
  } catch (e) { return file; }
}
async function subirFotos() {
  const files = [...$('tpFotos').files].slice(0, 12);
  if (!files.length) return;
  leerProducto();
  try {
    C.aviso(`Subiendo ${files.length} foto${files.length > 1 ? 's' : ''}…`);
    const { url, firmas } = await archivos({ accion: 'subir-foto-producto', n: files.length });
    for (let i = 0; i < files.length; i++) {
      const fd = new FormData();
      Object.entries(firmas[i]).forEach(([k, v]) => fd.append(k, v));
      fd.append('file', await reducir(files[i]));
      const r = await fetch(url, { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j.error && j.error.message) || 'error ' + r.status);
      prodEditando.fotos.push({ id: j.public_id, url: j.secure_url, ancho: j.width, alto: j.height });
    }
    C.aviso('Fotos subidas: guarda el producto ✓');
    pintarEditorProducto();
  } catch (e) { C.aviso('No se pudo subir: ' + e.message, true); }
}
async function guardarProducto() {
  leerProducto();
  const p = prodEditando;
  if (!p.nombre) return C.aviso('Ponle un nombre', true);
  if (!(p.precio > 0)) return C.aviso('Pon el precio', true);
  const nombres = p.variantes.map((v) => v.nombre);
  if (p.variantes.length > 1 && nombres.some((n) => !n)) return C.aviso('Si tiene varias tallas, cada una necesita su nombre', true);
  if (new Set(nombres).size !== nombres.length) return C.aviso('Hay dos tallas con el mismo nombre', true);
  if (p.estado === 'venta' && !stockDe(p)) p.estado = 'agotado';
  const id = p.id || 'p-' + C.uid();
  const { id: _, ...datos } = p;
  try {
    await setDoc(doc(db, 'productos', id), { ...datos, actualizado: serverTimestamp(), creado: p.creado || serverTimestamp() });
    fotosQuitadas.forEach((f) => archivos({ accion: 'borrar-foto-producto', id: f.id }).catch(() => {}));
    fotosQuitadas = [];
    C.aviso('Producto guardado ✓');
    cerrarProducto();
  } catch (e) { C.aviso('Error: ' + e.message, true); }
}
async function borrarProducto() {
  const p = prodEditando; if (!p || !p.id) return;
  if (!confirm(`¿Borrar «${p.nombre}» y sus fotos?`)) return;
  try {
    await deleteDoc(doc(db, 'productos', p.id));
    [...(p.fotos || []), ...fotosQuitadas].forEach((f) => archivos({ accion: 'borrar-foto-producto', id: f.id }).catch(() => {}));
    fotosQuitadas = [];
    cerrarProducto(); C.aviso('Producto borrado');
  } catch (e) { C.aviso('Error: ' + e.message, true); }
}

// ===================== Pedidos =====================
function pintarPedidos() {
  const q = normal(($('tdBuscaPed') || {}).value || '');
  const filtro = ($('tdFiltroPed') || {}).value || 'abiertos';
  if (!$('tdCabPed').innerHTML) $('tdCabPed').innerHTML = `<div class="card"><div class="row" style="align-items:center;flex-wrap:wrap;">
    <button style="flex:0 0 auto;" onclick="td.empezarPedido()">+ Nuevo pedido</button>
    <input id="tdBuscaPed" placeholder="Buscar por cliente, número o producto" oninput="td.pintar()" style="margin:0;flex:2 1 200px;">
    <select id="tdFiltroPed" onchange="td.pintar()" style="margin:0;flex:1 1 150px;"><option value="abiertos">Por preparar o enviar</option><option value="sinpagar">Sin pagar</option><option value="todos">Todos</option>
      ${Object.entries(ESTADOS_PED).map(([k, [t]]) => `<option value="${k}">${t}</option>`).join('')}</select></div></div>`;
  let lista = pedidos.slice();
  if (filtro === 'abiertos') lista = lista.filter((p) => ['nuevo', 'preparando', 'enviado'].includes(p.estado));
  else if (filtro === 'sinpagar') lista = lista.filter((p) => !p.pagado && p.estado !== 'cancelado');
  else if (filtro !== 'todos') lista = lista.filter((p) => p.estado === filtro);
  if (q) lista = lista.filter((p) => normal([p.numero, p.cliente && p.cliente.nombre, p.cliente && p.cliente.email, (p.lineas || []).map((l) => l.nombre + ' ' + l.variante).join(' '), p.seguimiento].join(' ')).includes(q));
  lista.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || (b.n || 0) - (a.n || 0));
  $('tdListaPed').innerHTML = lista.map((p) => {
    const [et, cl] = ESTADOS_PED[p.estado] || ESTADOS_PED.nuevo;
    return `<div class="cx-fila" onclick="td.abrirPedido('${p.id}')">
      <div class="cx-num">${esc(p.numero)}</div>
      <div class="cx-quien"><b>${esc((p.cliente && p.cliente.nombre) || 'Sin nombre')}</b><div class="person-meta">${esc((p.lineas || []).map((l) => `${l.cantidad} × ${l.nombre}${l.variante ? ' (' + l.variante + ')' : ''}`).join(' · '))}</div></div>
      <div class="cx-fecha">${fechaES(p.fecha)}</div>
      <div class="cx-tags"><span class="tag ${cl}">${et}</span>${p.estado !== 'cancelado' ? (p.pagado ? '<span class="tag t-plus">pagado</span>' : '<span class="tag t-man">sin pagar</span>') : ''}${p.facturaNumero ? `<span class="tag t-off">${esc(p.facturaNumero)}</span>` : ''}</div>
      <div class="cx-imp">${eur(p.total)}</div>
    </div>`;
  }).join('') || `<div class="empty" style="padding:16px;">${pedidos.length ? 'No hay pedidos con este filtro' : 'Aún no hay pedidos. Los de la web llegarán aquí solos cuando se lance la tienda; mientras, puedes apuntar a mano los que vendas en salidas y talleres.'}</div>`;
  if (pedidoAbierto) pintarPedido();
}

// ---------- Nuevo pedido ----------
const vendibles = () => productos.filter((p) => p.estado === 'venta' || p.estado === 'agotado' || p.estado === 'borrador');
function empezarPedido() {
  nuevoPedido = { lineas: [{ productoId: '', variante: '', cantidad: 1 }] };
  pedidoAbierto = null; $('tdPedido').innerHTML = '';
  ver('pedidos');
  pintarNuevo();
  $('tdNuevo').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function lineaPedidoHtml(l, i) {
  const p = productos.find((x) => x.id === l.productoId);
  return `<div class="td-lped">
    <select data-k="producto" onchange="td.cambiarLinea(${i})"><option value="">Elige un producto</option>${vendibles().map((x) => `<option value="${x.id}" ${x.id === l.productoId ? 'selected' : ''}>${esc(x.nombre)} · ${eur(x.precio)}${x.estado !== 'venta' ? ' (' + ESTADOS_P[x.estado][0].toLowerCase() + ')' : ''}</option>`).join('')}</select>
    ${p && conTallas(p) ? `<select data-k="variante" onchange="td.leerNuevo();td.totalNuevo()">${p.variantes.map((v) => `<option value="${esc(v.nombre)}" ${v.nombre === l.variante ? 'selected' : ''}>${esc(v.nombre)} (${Number(v.stock) || 0})</option>`).join('')}</select>` : `<span class="person-meta td-stock">${p ? stockDe(p) + ' en stock' : ''}</span>`}
    <input data-k="cantidad" type="number" min="1" step="1" value="${Number(l.cantidad) || 1}" oninput="td.leerNuevo();td.totalNuevo()">
    <button class="small danger" type="button" onclick="td.quitarLinea(${i})">✕</button>
  </div>`;
}
function pintarNuevo() {
  const n = nuevoPedido, el = $('tdNuevo');
  if (!n) { el.innerHTML = ''; return; }
  const personas = C.personas().filter((p) => p.name || p.email);
  el.innerHTML = `<div class="card cx-editor">
    <div class="row" style="align-items:center;justify-content:space-between;"><div class="card-title" style="margin:0;flex:1 1 auto;">Nuevo pedido</div>
      <button class="small secondary" style="flex:0 0 auto;" onclick="td.cancelarNuevo()">Cerrar</button></div>
    <div class="cx-dos" style="margin-top:12px;">
      <div>
        <input id="tnNombre" data-vivo list="tnPersonas" placeholder="Nombre de quien compra" oninput="td.elegirComprador()" value="${esc(n.nombre || '')}">
        <datalist id="tnPersonas">${personas.map((p) => `<option value="${esc([p.name, p.apellidos].filter(Boolean).join(' '))}">${esc(p.email || '')}</option>`).join('')}</datalist>
        <div class="row"><input id="tnEmail" data-vivo type="email" placeholder="Email" value="${esc(n.email || '')}"><input id="tnTel" data-vivo placeholder="Teléfono" value="${esc(n.telefono || '')}"></div>
        <select id="tnEntrega" onchange="td.leerNuevo();td.pintarNuevo()">${Object.entries(ENTREGAS).map(([k, t]) => `<option value="${k}" ${(n.entrega || 'mano') === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
        ${(n.entrega || 'mano') === 'envio' ? `<textarea id="tnDir" data-vivo rows="3" placeholder="Dirección de envío completa">${esc(n.direccion || '')}</textarea>` : ''}
      </div>
      <div>
        <div class="cx-etq">Productos</div>
        <div id="tnLineas">${n.lineas.map(lineaPedidoHtml).join('')}</div>
        <button class="small secondary" type="button" onclick="td.masLineaPedido()">+ Otro producto</button>
        <div class="row" style="margin-top:10px;"><input id="tnEnvio" data-vivo inputmode="decimal" placeholder="Envío €" value="${esc(coma(n.envio != null ? n.envio : ''))}" oninput="td.leerNuevo();td.totalNuevo()" title="Gastos de envío que paga el cliente">
          <select id="tnMetodo">${Object.entries(METODOS).map(([k, t]) => `<option value="${k}" ${(n.metodo || 'bizum') === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <label class="consent-toggle"><input type="checkbox" id="tnPagado" ${n.pagado !== false ? 'checked' : ''}> Ya está pagado (se apunta el cobro)</label>
        <input id="tnNotas" data-vivo placeholder="Notas (dedicatoria, cuándo se entrega…)" value="${esc(n.notas || '')}" style="margin-top:8px;">
        <div class="cx-linea cx-total" id="tnTotal"></div>
      </div>
    </div>
    <button onclick="td.crearPedido()">Crear pedido</button>
    <div class="person-meta" style="margin-top:6px;">Al crearlo se descuenta el stock. Si lo cancelas, vuelve.</div>
  </div>`;
  totalNuevo();
}
function leerNuevo() {
  const n = nuevoPedido; if (!n || !$('tnNombre')) return;
  n.nombre = $('tnNombre').value.trim(); n.email = $('tnEmail').value.trim(); n.telefono = $('tnTel').value.trim();
  n.entrega = $('tnEntrega').value; n.direccion = $('tnDir') ? $('tnDir').value.trim() : (n.direccion || '');
  n.envio = num($('tnEnvio').value); n.metodo = $('tnMetodo').value; n.pagado = $('tnPagado').checked; n.notas = $('tnNotas').value.trim();
  n.lineas = [...document.querySelectorAll('#tnLineas .td-lped')].map((el) => ({
    productoId: el.querySelector('[data-k=producto]').value,
    variante: el.querySelector('[data-k=variante]') ? el.querySelector('[data-k=variante]').value : '',
    cantidad: Math.max(1, Math.round(num(el.querySelector('[data-k=cantidad]').value))),
  }));
}
function lineasPedido(n) {
  return n.lineas.filter((l) => l.productoId).map((l) => {
    const p = productos.find((x) => x.id === l.productoId) || {};
    return { productoId: l.productoId, nombre: p.nombre || '', tipo: p.tipo || 'otro', variante: l.variante || '', cantidad: l.cantidad, precio: num(p.precio), iva: Number(p.iva != null ? p.iva : 21) };
  });
}
function totalNuevo() {
  const n = nuevoPedido; if (!n || !$('tnTotal')) return;
  const ls = lineasPedido(n);
  const total = r2(ls.reduce((s, l) => s + l.cantidad * l.precio, 0) + num(n.envio));
  $('tnTotal').innerHTML = `<span>Total</span><span>${eur(total)}</span>`;
}
function cambiarLinea(i) {
  leerNuevo();
  const l = nuevoPedido.lineas[i], p = productos.find((x) => x.id === l.productoId);
  l.variante = p && conTallas(p) ? (p.variantes.find((v) => Number(v.stock) > 0) || p.variantes[0]).nombre : '';
  // El envío se propone con el del producto más caro de enviar
  const envios = nuevoPedido.lineas.map((x) => num((productos.find((y) => y.id === x.productoId) || {}).envio));
  if (nuevoPedido.entrega === 'envio' && !num($('tnEnvio').value)) nuevoPedido.envio = Math.max(0, ...envios);
  pintarNuevo();
}
function masLineaPedido() { leerNuevo(); nuevoPedido.lineas.push({ productoId: '', variante: '', cantidad: 1 }); pintarNuevo(); }
function quitarLinea(i) { leerNuevo(); nuevoPedido.lineas.splice(i, 1); if (!nuevoPedido.lineas.length) nuevoPedido.lineas.push({ productoId: '', variante: '', cantidad: 1 }); pintarNuevo(); }
function cancelarNuevo() { nuevoPedido = null; $('tdNuevo').innerHTML = ''; }
function elegirComprador() {
  const nombre = normal($('tnNombre').value);
  const p = C.personas().find((x) => normal([x.name, x.apellidos].filter(Boolean).join(' ')) === nombre);
  if (p) { nuevoPedido.personId = p.id; if (!$('tnEmail').value && p.email) $('tnEmail').value = p.email; }
}
const categoriaDe = (lineas) => lineas.length && lineas.every((l) => l.tipo === 'zine') ? 'zine' : 'tienda';

async function crearPedido() {
  leerNuevo();
  const n = nuevoPedido, lineas = lineasPedido(n);
  if (!lineas.length) return C.aviso('Elige al menos un producto', true);
  if (!n.nombre && !n.email) return C.aviso('Pon el nombre o el email de quien compra', true);
  if (n.entrega === 'envio' && !n.direccion) return C.aviso('Falta la dirección de envío', true);
  const total = r2(lineas.reduce((s, l) => s + l.cantidad * l.precio, 0) + num(n.envio));
  const id = 'o-' + C.uid();
  try {
    const numero = await runTransaction(db, async (tx) => {
      // Primero se leen todos los productos (las transacciones piden leer antes de escribir)
      const ids = [...new Set(lineas.map((l) => l.productoId))];
      const snaps = {};
      for (const pid of ids) snaps[pid] = await tx.get(doc(db, 'productos', pid));
      const cont = await tx.get(doc(db, 'contadores', 'pedidos'));
      const variantes = {};
      ids.forEach((pid) => { if (!snaps[pid].exists()) throw new Error('Un producto ya no existe'); variantes[pid] = JSON.parse(JSON.stringify(snaps[pid].data().variantes || [])); });
      lineas.forEach((l) => {
        const v = variantes[l.productoId].find((x) => (x.nombre || '') === (l.variante || '')) || variantes[l.productoId][0];
        if (!v || (Number(v.stock) || 0) < l.cantidad) throw new Error(`No hay stock suficiente de ${l.nombre}${l.variante ? ' (' + l.variante + ')' : ''}`);
        v.stock = (Number(v.stock) || 0) - l.cantidad;
      });
      ids.forEach((pid) => {
        const cambios = { variantes: variantes[pid] };
        if (snaps[pid].data().estado === 'venta' && !variantes[pid].some((v) => Number(v.stock) > 0)) cambios.estado = 'agotado';
        tx.update(doc(db, 'productos', pid), cambios);
      });
      const nn = ((cont.exists() && Number(cont.data().ultimo)) || 0) + 1;
      tx.set(doc(db, 'contadores', 'pedidos'), { ultimo: nn });
      const numero = 'P-' + String(nn).padStart(4, '0');
      tx.set(doc(db, 'pedidos', id), {
        n: nn, numero, fecha: hoyISO(), creado: serverTimestamp(), origen: 'manual', estado: n.entrega === 'mano' && n.pagado ? 'entregado' : 'nuevo',
        cliente: { nombre: n.nombre, email: n.email, telefono: n.telefono, direccion: n.direccion || '', personId: n.personId || '' },
        entrega: n.entrega, lineas, envio: num(n.envio), total, metodo: n.metodo, pagado: false, notas: n.notas, stockDescontado: true,
      });
      return numero;
    });
    if (n.pagado) await cobrar(id, { numero, lineas, envio: num(n.envio), total, metodo: n.metodo, cliente: { nombre: n.nombre, email: n.email, personId: n.personId || '' } });
    C.aviso(`Pedido ${numero} creado ✓`);
    cancelarNuevo();
    setTimeout(() => abrirPedido(id), 300);
  } catch (e) { C.aviso(e.message, true); }
}

// Apunta el cobro del pedido en la contabilidad (con su IVA: el envío lleva el del producto principal)
async function cobrar(id, p, fecha) {
  const ivaPrincipal = (p.lineas[0] || {}).iva != null ? p.lineas[0].iva : 21;
  const t = calcular({ ivaIncluido: true, lineas: [...p.lineas, ...(num(p.envio) ? [{ cantidad: 1, precio: p.envio, iva: ivaPrincipal }] : [])] });
  const ingresoId = await apuntarCobro({
    id: 'o-' + id, fecha: fecha || hoyISO(), importe: t.total, base: t.base, ivaPct: ivaPrincipal, categoria: categoriaDe(p.lineas),
    metodo: p.metodo || 'bizum', concepto: `Pedido ${p.numero} · ${p.lineas.map((l) => `${l.cantidad} × ${l.nombre}`).join(', ')}`,
    quien: p.cliente.nombre || '', email: p.cliente.email || '', personId: p.cliente.personId || '', pedidoId: id,
  });
  await updateDoc(doc(db, 'pedidos', id), { pagado: true, fechaPago: fecha || hoyISO(), ingresoId });
  return ingresoId;
}

// ---------- Ficha de un pedido ----------
function abrirPedido(id) { pedidoAbierto = id; cancelarNuevo(); pintarPedido(); $('tdPedido').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function cerrarPedido() { pedidoAbierto = null; $('tdPedido').innerHTML = ''; }
function pintarPedido() {
  const p = pedidos.find((x) => x.id === pedidoAbierto), el = $('tdPedido');
  if (!p) { el.innerHTML = ''; return; }
  if (el.contains(document.activeElement) && document.activeElement.id === 'tdSeguimiento') return;
  const [et, cl] = ESTADOS_PED[p.estado] || ESTADOS_PED.nuevo;
  const sig = SIGUIENTE[p.estado];
  el.innerHTML = `<div class="card cx-editor">
    <div class="row" style="align-items:center;justify-content:space-between;"><div class="card-title" style="margin:0;flex:1 1 auto;">${esc(p.numero)} · ${esc(p.cliente.nombre || p.cliente.email)}</div>
      <button class="small secondary" style="flex:0 0 auto;" onclick="td.cerrarPedido()">Cerrar</button></div>
    <div style="margin:6px 0 10px;"><span class="tag ${cl}">${et}</span>${p.estado !== 'cancelado' ? (p.pagado ? `<span class="tag t-plus">pagado ${fechaES(p.fechaPago)}</span>` : '<span class="tag t-man">sin pagar</span>') : ''}</div>
    <div class="cx-dos">
      <div>
        ${(p.lineas || []).map((l) => `<div class="cx-linea"><span>${l.cantidad} × ${esc(l.nombre)}${l.variante ? ' (' + esc(l.variante) + ')' : ''}</span><span>${eur(l.cantidad * l.precio)}</span></div>`).join('')}
        ${num(p.envio) ? `<div class="cx-linea"><span>Envío</span><span>${eur(p.envio)}</span></div>` : ''}
        <div class="cx-linea cx-total"><span>Total</span><span>${eur(p.total)}</span></div>
        ${p.notas ? `<div class="person-meta" style="margin-top:8px;">${esc(p.notas)}</div>` : ''}
      </div>
      <div>
        <div class="person-meta">${fechaES(p.fecha)} · ${esc(ENTREGAS[p.entrega] || '')} · ${esc(METODOS[p.metodo] || p.metodo || '')}</div>
        ${p.cliente.email ? `<div class="person-meta"><a href="mailto:${esc(p.cliente.email)}">${esc(p.cliente.email)}</a>${p.cliente.telefono ? ' · ' + esc(p.cliente.telefono) : ''}</div>` : p.cliente.telefono ? `<div class="person-meta">${esc(p.cliente.telefono)}</div>` : ''}
        ${p.cliente.direccion ? `<div class="sub-panel" style="white-space:pre-line;">${esc(p.cliente.direccion)}</div><button class="small secondary" style="margin-top:6px;" onclick="td.copiarDireccion('${p.id}')">Copiar dirección</button>` : ''}
        ${p.entrega === 'envio' && p.estado !== 'cancelado' ? `<input id="tdSeguimiento" placeholder="Nº de seguimiento del envío" value="${esc(p.seguimiento || '')}" onchange="td.guardarSeguimiento('${p.id}')" style="margin-top:8px;">` : ''}
      </div>
    </div>
    <div class="row" style="margin-top:12px;flex-wrap:wrap;">
      ${sig && p.estado !== 'cancelado' ? `<button onclick="td.estado('${p.id}','${sig}')">Pasar a «${ESTADOS_PED[sig][0]}»</button>` : ''}
      ${!p.pagado && p.estado !== 'cancelado' ? `<button class="secondary" onclick="td.marcarPagado('${p.id}')">Marcar pagado</button>` : ''}
      ${p.facturaId ? `<button class="secondary" onclick="showTab('contabilidad');cx.ver('facturas');cx.abrirFactura('${p.facturaId}')">Ver factura ${esc(p.facturaNumero || '')}</button>` : p.estado !== 'cancelado' ? `<button class="secondary" onclick="td.hacerFactura('${p.id}')">Hacer factura</button>` : ''}
      ${p.estado !== 'cancelado' && p.estado !== 'entregado' ? `<button class="danger" onclick="td.cancelar('${p.id}')">Cancelar pedido</button>` : ''}
    </div>
  </div>`;
}
async function estado(id, nuevo) {
  try { await updateDoc(doc(db, 'pedidos', id), { estado: nuevo, ['fecha_' + nuevo]: hoyISO() }); C.aviso('Pedido: ' + ESTADOS_PED[nuevo][0].toLowerCase() + ' ✓'); } catch (e) { C.aviso('Error: ' + e.message, true); }
}
async function guardarSeguimiento(id) {
  try { await updateDoc(doc(db, 'pedidos', id), { seguimiento: $('tdSeguimiento').value.trim() }); C.aviso('Seguimiento guardado ✓'); } catch (e) { C.aviso('Error: ' + e.message, true); }
}
async function marcarPagado(id) {
  const p = pedidos.find((x) => x.id === id); if (!p) return;
  if (p.facturaId) { C.aviso('Este pedido ya tiene factura: márcala como cobrada en Contabilidad', true); return; }
  try { await cobrar(id, p); C.aviso('Cobro apuntado ✓'); } catch (e) { C.aviso('Error: ' + e.message, true); }
}
function hacerFactura(id) {
  const p = pedidos.find((x) => x.id === id); if (!p) return;
  const ivaPrincipal = (p.lineas[0] || {}).iva != null ? p.lineas[0].iva : 21;
  showTab('contabilidad');
  window.cx.nuevaFactura({
    fecha: p.fechaPago || p.fecha, categoria: categoriaDe(p.lineas),
    cliente: { nombre: p.cliente.nombre || '', nif: '', direccion: p.cliente.direccion || '', email: p.cliente.email || '', personId: p.cliente.personId || '' },
    lineas: [...p.lineas.map((l) => ({ concepto: l.nombre + (l.variante ? ' (' + l.variante + ')' : ''), cantidad: l.cantidad, precio: coma(l.precio), iva: l.iva })),
      ...(num(p.envio) ? [{ concepto: 'Gastos de envío', cantidad: 1, precio: coma(p.envio), iva: ivaPrincipal }] : [])],
    ivaIncluido: true, cobro: { cobrada: !!p.pagado, metodo: p.metodo || 'bizum', fecha: p.fechaPago || p.fecha },
    origen: { pedidoId: id, ...(p.ingresoId ? { ingresoId: p.ingresoId } : {}) },
  });
}
async function cancelar(id) {
  const p = pedidos.find((x) => x.id === id); if (!p) return;
  if (!confirm(`¿Cancelar el pedido ${p.numero}? El stock vuelve a los productos.${p.pagado ? '\nYa estaba pagado: si devuelves el dinero, apúntalo como gasto o haz una factura rectificativa.' : ''}`)) return;
  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'pedidos', id);
      const snap = await tx.get(ref);
      const d = snap.data();
      const ids = d.stockDescontado ? [...new Set((d.lineas || []).map((l) => l.productoId))] : [];
      const prods = {};
      for (const pid of ids) prods[pid] = await tx.get(doc(db, 'productos', pid));
      ids.forEach((pid) => {
        if (!prods[pid].exists()) return;
        const vs = JSON.parse(JSON.stringify(prods[pid].data().variantes || []));
        d.lineas.filter((l) => l.productoId === pid).forEach((l) => {
          const v = vs.find((x) => (x.nombre || '') === (l.variante || '')) || vs[0];
          if (v) v.stock = (Number(v.stock) || 0) + Number(l.cantidad);
        });
        const cambios = { variantes: vs };
        if (prods[pid].data().estado === 'agotado') cambios.estado = 'venta';
        tx.update(doc(db, 'productos', pid), cambios);
      });
      tx.update(ref, { estado: 'cancelado', stockDescontado: false, fecha_cancelado: hoyISO() });
    });
    C.aviso('Pedido cancelado y stock devuelto');
  } catch (e) { C.aviso('Error: ' + e.message, true); }
}
function copiarDireccion(id) {
  const p = pedidos.find((x) => x.id === id); if (!p) return;
  const t = [p.cliente.nombre, p.cliente.direccion, p.cliente.telefono].filter(Boolean).join('\n');
  navigator.clipboard.writeText(t).then(() => C.aviso('Dirección copiada ✓')).catch(() => C.aviso('No se pudo copiar', true));
}

window.td = {
  ver, pintar, editarProducto, cerrarProducto, masVariante, tallasCamiseta, moverFoto, quitarFoto, subirFotos, guardarProducto, borrarProducto,
  empezarPedido, pintarNuevo, leerNuevo, totalNuevo, cambiarLinea, masLineaPedido, quitarLinea, cancelarNuevo, elegirComprador, crearPedido,
  abrirPedido, cerrarPedido, estado, guardarSeguimiento, marcarPagado, hacerFactura, cancelar, copiarDireccion,
};
