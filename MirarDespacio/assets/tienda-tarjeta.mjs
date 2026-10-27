// Ficha de un producto de la tienda. La usan el servidor (función edge "tienda", que manda la
// página ya escrita para Google y para las vistas previas) y el navegador (tienda.js).
export const TIPOS = { zine: 'Zine', baraja: 'Baraja', camiseta: 'Camiseta', lamina: 'Lámina', otro: '' };
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const eur = (n) => { n = Number(n) || 0; return (n % 1 ? n.toFixed(2).replace('.', ',') : String(n)) + ' €'; };
export const img = (u, t) => String(u).replace('/image/upload/', '/image/upload/' + t + '/');
export const urlProducto = (p) => '/tienda/' + p.slug + '/';

// i: posición en la página. sola: true en la página del propio producto (título h1, sin enlace)
export function tarjeta(p, i, sola) {
  const tallas = p.variantes.filter((v) => v.nombre);
  const agotado = p.estado !== 'venta';
  const pocas = !agotado && !tallas.length && p.variantes.some((v) => v.pocas);
  const fotos = p.fotos || [];
  const titulo = sola ? `<h1>${esc(p.nombre)}</h1>` : `<h2><a href="${urlProducto(p)}">${esc(p.nombre)}</a></h2>`;
  const desc = p.descripcion ? '<div class="producto-desc"><p>' + esc(p.descripcion).replace(/\n+/g, '</p><p>') + '</p></div>' : '';
  return `<article class="producto${sola ? ' sola' : ''}" id="p-${esc(p.slug)}" data-i="${i}">
  <div class="producto-fotos">${fotos.length ? `<img class="producto-foto" src="${esc(img(fotos[0], 'f_auto,q_auto,c_limit,w_1100'))}" alt="${esc(p.nombre)}"${i ? ' loading="lazy"' : ''}>` : '<div class="producto-foto vacia"></div>'}${fotos.length > 1 ? '<div class="producto-minis">' + fotos.map((f, k) => `<button type="button" aria-label="Ver foto ${k + 1}" data-f="${k}"${k ? '' : ' class="activa"'}><img src="${esc(img(f, 'f_auto,q_auto,c_fill,w_160,h_160'))}" alt="" loading="lazy"></button>`).join('') + '</div>' : ''}</div>
  <div class="producto-info">
    ${TIPOS[p.tipo] ? `<p class="antetitulo">${esc(TIPOS[p.tipo])}</p>` : ''}${titulo}
    <p class="producto-precio">${eur(p.precio)}${agotado ? ' <span class="producto-estado">Agotado</span>' : pocas ? ' <span class="producto-estado">Quedan pocos</span>' : ''}</p>
    ${desc}
    ${tallas.length && !agotado ? '<div class="producto-tallas" role="radiogroup" aria-label="Talla">' + tallas.map((v, k) => `<label class="${v.disponible ? '' : 'sin'}"><input type="radio" name="talla-${i}" value="${esc(v.nombre)}"${v.disponible ? '' : ' disabled'}${v.disponible && !tallas.slice(0, k).some((x) => x.disponible) ? ' checked' : ''}><span>${esc(v.nombre)}</span></label>`).join('') + '</div>' : ''}
    <div class="botones">${agotado ? `<a class="boton claro" data-avisar href="#">Avísame cuando vuelva</a>` : `<a class="boton" data-comprar href="${p.enlacePago ? esc(p.enlacePago) : '#'}">${p.enlacePago ? 'Comprar' : 'Lo quiero'}</a>`}</div>
    ${!agotado && !p.enlacePago ? `<p class="producto-nota">Escríbeme y te digo cómo pagarlo. Si vienes a una salida o a un taller te lo llevo en mano${p.envio ? '; si no, el envío son ' + eur(p.envio) : ''}.</p>` : ''}${!agotado && p.enlacePago && p.envio ? `<p class="producto-nota">Envío: ${eur(p.envio)}.</p>` : ''}
    ${sola ? '' : `<p class="producto-nota"><a href="${urlProducto(p)}">Más detalles →</a></p>`}
  </div>
</article>`;
}

// Datos estructurados para Google (precio y disponibilidad en los resultados)
export function schemaProducto(p, dom) {
  return {
    '@type': 'Product', name: p.nombre, description: p.descripcion || p.nombre, url: dom + urlProducto(p),
    image: (p.fotos || []).map((f) => img(f, 'f_auto,q_auto,c_limit,w_1200')),
    brand: { '@type': 'Brand', name: 'Mirar Despacio' },
    offers: { '@type': 'Offer', price: Number(p.precio).toFixed(2), priceCurrency: 'EUR', url: dom + urlProducto(p),
      availability: p.estado === 'venta' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: { '@id': dom + '/#org' } },
  };
}
