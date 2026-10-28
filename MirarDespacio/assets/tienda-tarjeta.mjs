// Ficha de un producto de la tienda. La usan el servidor (función edge "tienda", que manda la
// página ya escrita para Google y para las vistas previas) y el navegador (tienda.js).
// Si cambias este archivo, sube el ?v= del import en tienda.js (el navegador guarda /assets 7 días).
export const TIPOS = { zine: 'Zine', baraja: 'Baraja', print: 'Print', camiseta: 'Camiseta', lamina: 'Lámina', otro: '' };
// Cómo se llama la elección en cada tipo de producto
const ELIGE = { print: 'Tamaño', lamina: 'Tamaño', camiseta: 'Talla' };
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const eur = (n) => { n = Number(n) || 0; return (n % 1 ? n.toFixed(2).replace('.', ',') : String(n)) + ' €'; };
export const img = (u, t) => String(u).replace('/image/upload/', '/image/upload/' + t + '/');
export const urlProducto = (p) => '/tienda/' + p.slug + '/';
export const eleccion = (p) => ELIGE[p.tipo] || 'Versión';

// Precio y envío de una variante (los datos antiguos no los traen: se usan los del producto)
export const precioVar = (p, v) => (v && Number(v.precio) > 0 ? Number(v.precio) : Number(p.precio) || 0);
export const envioVar = (p, v) => (v && v.envio != null && isFinite(Number(v.envio)) ? Number(v.envio) : Number(p.envio) || 0);
const rango = (l) => { l = l.filter((n) => n > 0); return l.length ? [Math.min(...l), Math.max(...l)] : [0, 0]; };
export const preciosDe = (p) => rango((p.variantes || []).map((v) => precioVar(p, v)).concat((p.variantes || []).length ? [] : [Number(p.precio) || 0]));
export const enviosDe = (p) => { const l = (p.variantes || []).map((v) => envioVar(p, v)); return l.length ? [Math.min(...l), Math.max(...l)] : [Number(p.envio) || 0, Number(p.envio) || 0]; };
// "25 €" o "desde 25 €" cuando cada tamaño tiene su precio
export const precioTexto = (p) => { const [a, b] = preciosDe(p); return (b > a ? 'desde ' : '') + eur(a); };
// Envío: el de la variante elegida, o "desde X € según el tamaño" si cambia. '' si no hay envío puesto.
export function envioTexto(p, v) {
  if (v) { const e = envioVar(p, v); return e ? eur(e) : ''; }
  const [a, b] = enviosDe(p);
  if (!b) return '';
  return b > a ? 'desde ' + eur(a) + ' según el tamaño' : eur(a);
}
// Frase del envío dentro de la nota (se cambia al elegir tamaño)
export const fraseEnvio = (p, v, pago) => { const t = envioTexto(p, v); return !t ? '' : pago ? 'Envío: ' + t + '.' : '; si no, el envío ' + (/^desde/.test(t) ? 'va ' : 'son ') + t; };

// Preventa: se fabrica solo si se llega a un mínimo de reservas antes de una fecha.
// Contador «18 de 30 reservas» con barra, días que quedan y qué pasa si no se llega.
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = (iso) => { const [, m, d] = String(iso).split('-').map(Number); return d && m ? `${d} de ${MESES[m - 1]}` : ''; };
function diasHasta(iso) {
  const hoy = new Date(new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).slice(0, 10) + 'T12:00:00Z');
  return Math.round((new Date(iso + 'T12:00:00Z') - hoy) / 864e5);
}
export function bloquePreventa(pv) {
  if (!pv) return '';
  const pct = Math.min(100, Math.round((pv.reservadas / pv.minimo) * 100));
  const barra = `<div class="preventa-barra" role="progressbar" aria-valuemin="0" aria-valuemax="${pv.minimo}" aria-valuenow="${Math.min(pv.reservadas, pv.minimo)}" aria-label="Reservas"><i style="width:${pct}%"></i></div>`;
  const cuenta = `<b>${pv.reservadas}</b> de ${pv.minimo} reservas`;
  if (pv.estado === 'conseguida') return `<div class="preventa conseguida">${barra}<p>${cuenta} · <strong>¡conseguido, se fabrica!</strong> Aún puedes reservar el tuyo.</p></div>`;
  if (pv.estado === 'cerrada' || pv.estado === 'cancelada') return `<div class="preventa">${barra}<p>${cuenta}. La preventa terminó sin llegar al mínimo: no se fabrica por ahora.</p></div>`;
  const d = pv.hasta ? diasHasta(pv.hasta) : null;
  const plazo = d == null ? '' : d <= 0 ? ' · <strong>último día</strong>' : ` · quedan ${d} ${d === 1 ? 'día' : 'días'}`;
  const faltan = Math.max(0, pv.minimo - pv.reservadas);
  return `<div class="preventa">${barra}<p>${cuenta}${plazo}</p>
    <p class="producto-nota">Es una preventa: solo se fabrica si llegamos a ${pv.minimo} reservas${pv.hasta ? ' antes del ' + fechaLarga(pv.hasta) : ''}${faltan ? ` (faltan ${faltan})` : ''}. Pagas al reservar y, si no se llega, te devuelvo el dinero entero.</p></div>`;
}

// i: posición en la página. sola: true en la página del propio producto (título h1, sin enlace)
export function tarjeta(p, i, sola) {
  const tallas = p.variantes.filter((v) => v.nombre);
  const agotado = p.estado !== 'venta';
  const pv = p.preventa || null;
  const pocas = !agotado && !p.bajoPedido && !tallas.length && p.variantes.some((v) => v.pocas);
  const fotos = p.fotos || [];
  const titulo = sola ? `<h1>${esc(p.nombre)}</h1>` : `<h2><a href="${urlProducto(p)}">${esc(p.nombre)}</a></h2>`;
  const desc = p.descripcion ? '<div class="producto-desc"><p>' + esc(p.descripcion).replace(/\n+/g, '</p><p>') + '</p></div>' : '';
  const cambia = (() => { const [a, b] = preciosDe(p); return b > a; })();
  const notaEnvio = agotado ? '' : !p.enlacePago
    ? `<p class="producto-nota">Escríbeme y te digo cómo pagarlo. Si vienes a una salida o a un taller te lo llevo en mano<span data-envio>${fraseEnvio(p, null, false)}</span>.</p>`
    : enviosDe(p)[1] ? `<p class="producto-nota" data-envio>${fraseEnvio(p, null, true)}</p>` : '';
  return `<article class="producto${sola ? ' sola' : ''}" id="p-${esc(p.slug)}" data-i="${i}">
  <div class="producto-fotos">${fotos.length ? `<img class="producto-foto" src="${esc(img(fotos[0], 'f_auto,q_auto,c_limit,w_1100'))}" alt="${esc(p.nombre)}"${i ? ' loading="lazy"' : ''}>` : '<div class="producto-foto vacia"></div>'}${fotos.length > 1 ? '<div class="producto-minis">' + fotos.map((f, k) => `<button type="button" aria-label="Ver foto ${k + 1}" data-f="${k}"${k ? '' : ' class="activa"'}><img src="${esc(img(f, 'f_auto,q_auto,c_fill,w_160,h_160'))}" alt="" loading="lazy"></button>`).join('') + '</div>' : ''}</div>
  <div class="producto-info">
    ${TIPOS[p.tipo] ? `<p class="antetitulo">${esc(TIPOS[p.tipo])}</p>` : ''}${titulo}
    <p class="producto-precio"><span data-precio${cambia ? ' class="desde"' : ''}>${precioTexto(p)}</span>${pv && !agotado ? ' <span class="producto-estado">Preventa</span>' : agotado && !pv ? ' <span class="producto-estado">Agotado</span>' : pocas ? ' <span class="producto-estado">Quedan pocos</span>' : ''}</p>
    ${bloquePreventa(pv)}
    ${desc}
    ${tallas.length && !agotado ? `<div class="producto-tallas" role="radiogroup" aria-label="${eleccion(p)}">` + tallas.map((v, k) => `<label class="${v.disponible ? '' : 'sin'}"><input type="radio" name="talla-${i}" value="${esc(v.nombre)}"${v.disponible ? '' : ' disabled'}${v.disponible && !tallas.slice(0, k).some((x) => x.disponible) ? ' checked' : ''}><span>${esc(v.nombre)}${cambia ? `<small>${eur(precioVar(p, v))}</small>` : ''}</span></label>`).join('') + '</div>' : ''}
    <div class="botones">${agotado ? `<a class="boton claro" data-avisar href="#">Avísame ${pv ? 'si vuelve' : 'cuando vuelva'}</a>` : `<a class="boton" data-comprar href="${p.enlacePago ? esc(p.enlacePago) : '#'}">${pv ? 'Reservar el mío' : p.enlacePago ? 'Comprar' : 'Lo quiero'}</a>`}</div>
    ${!agotado && p.bajoPedido ? `<p class="producto-nota">Bajo pedido · ${p.plazo ? esc(p.plazo.replace(/[.\s]+$/, '')) : 'lo preparo en cuanto me lo pides'}.</p>` : ''}
    ${notaEnvio || ''}
    ${sola ? '' : `<p class="producto-nota"><a href="${urlProducto(p)}">Más detalles →</a></p>`}
  </div>
</article>`;
}

// Datos estructurados para Google (precio y disponibilidad en los resultados).
// Con varios precios (prints en varios tamaños): AggregateOffer con el más bajo y el más alto,
// y una oferta por tamaño.
export function schemaProducto(p, dom) {
  const url = dom + urlProducto(p);
  const disp = (ok) => (!ok ? 'https://schema.org/OutOfStock' : p.preventa ? 'https://schema.org/PreOrder' : 'https://schema.org/InStock');
  const [a, b] = preciosDe(p);
  const tallas = (p.variantes || []).filter((v) => v.nombre);
  const base = {
    '@type': 'Product', name: p.nombre, description: p.descripcion || p.nombre, url,
    image: (p.fotos || []).map((f) => img(f, 'f_auto,q_auto,c_limit,w_1200')),
    brand: { '@type': 'Brand', name: 'Mirar Despacio' },
  };
  if (b > a && tallas.length) {
    base.offers = {
      '@type': 'AggregateOffer', priceCurrency: 'EUR', lowPrice: a.toFixed(2), highPrice: b.toFixed(2), offerCount: tallas.length,
      availability: disp(p.estado === 'venta'),
      offers: tallas.map((v) => ({ '@type': 'Offer', name: `${p.nombre} · ${v.nombre}`, price: precioVar(p, v).toFixed(2), priceCurrency: 'EUR', url,
        availability: disp(p.estado === 'venta' && v.disponible), seller: { '@id': dom + '/#org' } })),
    };
  } else {
    base.offers = { '@type': 'Offer', price: a.toFixed(2), priceCurrency: 'EUR', url,
      availability: disp(p.estado === 'venta'), seller: { '@id': dom + '/#org' } };
  }
  return base;
}
