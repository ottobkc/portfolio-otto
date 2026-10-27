// Tienda de mirardespacio.es escrita en el servidor: cuando alguien (o Google, o WhatsApp al hacer
// la vista previa) pide /tienda/ o /tienda/<producto>/, esta función mete los productos del CRM
// dentro del HTML antes de mandarlo. Así se indexan y cada producto tiene su propia página.
// También añade los productos al mapa del sitio (/sitemap.xml).
//
// Los productos los da la función "tienda" de ottokols.es (lee Firestore). Si falla, la página
// sale tal cual (con el bloque fijo del zine) y el navegador lo vuelve a intentar.
import { tarjeta, schemaProducto, esc, img, eur, TIPOS, urlProducto } from '../../assets/tienda-tarjeta.mjs';

const DOM = 'https://mirardespacio.es';
const API = 'https://ottokols.es/.netlify/functions/tienda';
let cache = { t: 0, l: null };

async function productos() {
  if (cache.l && Date.now() - cache.t < 60e3) return cache.l;
  try {
    const r = await fetch(API, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) throw new Error('api ' + r.status);
    const l = await r.json();
    cache = { t: Date.now(), l: Array.isArray(l) ? l : [] };
  } catch (e) {
    console.error('tienda', e.message);
    if (!cache.l) return null;
  }
  return cache.l;
}

const datosJson = (l) => `<script type="application/json" id="tienda-datos">${JSON.stringify(l).replace(/</g, '\\u003c')}</script>`;
const ld = (o) => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', ...o }).replace(/</g, '\\u003c')}</script>`;

// Cambia el contenido de una etiqueta <meta>/<title>/<link> del HTML base
function meta(html, buscar, valor) { return html.replace(buscar, (m, a, b) => a + esc(valor) + b); }

function paginaLista(html, l) {
  const tarjetas = l.map((p, i) => tarjeta(p, i, false)).join('\n');
  html = html.replace(/<div id="tienda-productos"([^>]*) hidden><\/div>/, `<div id="tienda-productos"$1 data-servidor="1">${tarjetas}</div>`)
    .replace('<div id="tienda-fijo"', '<div id="tienda-fijo" hidden');
  const lista = { '@type': 'ItemList', itemListElement: l.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: DOM + urlProducto(p), name: p.nombre })) };
  return html.replace('</head>', `${ld(lista)}\n${datosJson(l)}\n</head>`);
}

function paginaProducto(html, p) {
  const url = DOM + urlProducto(p);
  const titulo = `${p.nombre} · Tienda Mirar Despacio`;
  const desc = ((p.descripcion || '').replace(/\s+/g, ' ').trim() || `${TIPOS[p.tipo] || 'Producto'} de Mirar Despacio`).slice(0, 150) + ` · ${eur(p.precio)}`;
  html = meta(html, /(<title>)[^<]*(<\/title>)/, titulo);
  html = meta(html, /(<meta name="description" content=")[^"]*(")/, desc);
  html = meta(html, /(<link rel="canonical" href=")[^"]*(")/, url);
  html = meta(html, /(<meta property="og:url" content=")[^"]*(")/, url);
  html = meta(html, /(<meta property="og:title" content=")[^"]*(")/, titulo);
  html = meta(html, /(<meta property="og:description" content=")[^"]*(")/, desc);
  if (p.fotos && p.fotos[0]) html = meta(html, /(<meta property="og:image" content=")[^"]*(")/, img(p.fotos[0], 'f_auto,q_auto,c_fill,w_1200,h_630'));
  // La cabecera de la tienda se cambia por la del producto
  html = html.replace(/<section class="portada">[\s\S]*?<\/section>/, `<section class="portada portada-producto"><div class="envoltura"><p class="producto-volver"><a href="/tienda/">← Toda la tienda</a></p></div></section>`);
  html = html.replace(/<div id="tienda-productos"([^>]*) hidden><\/div>/, `<div id="tienda-productos"$1 data-servidor="1">${tarjeta(p, 0, true)}</div>`)
    .replace('<div id="tienda-fijo"', '<div id="tienda-fijo" hidden');
  const migas = { '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Tienda', item: DOM + '/tienda/' }, { '@type': 'ListItem', position: 2, name: p.nombre, item: url }] };
  return html.replace('</head>', `${ld({ '@graph': [schemaProducto(p, DOM), migas] })}\n${datosJson([p])}\n</head>`);
}

export default async (request, context) => {
  const url = new URL(request.url);
  if (request.headers.get('x-tienda-base')) return context.next(); // la página base, sin tocar

  // Mapa del sitio: se añaden las páginas de los productos
  if (url.pathname === '/sitemap.xml') {
    const res = await context.next();
    const l = await productos();
    if (!l || !l.length) return res;
    const xml = await res.text();
    const extra = l.map((p) => `  <url><loc>${DOM}${urlProducto(p)}</loc></url>`).join('\n');
    return new Response(xml.replace('</urlset>', extra + '\n</urlset>'), { status: res.status, headers: res.headers });
  }

  const m = url.pathname.match(/^\/tienda\/([a-z0-9-]+)\/?$/);
  const l = await productos();

  if (!m) { // /tienda/
    const res = await context.next();
    if (!l || !l.length || !(res.headers.get('content-type') || '').includes('text/html')) return res;
    const h = new Headers(res.headers); h.delete('content-length'); h.set('cache-control', 'public, max-age=0, must-revalidate');
    return new Response(paginaLista(await res.text(), l), { status: res.status, headers: h });
  }

  // /tienda/<producto>/: se parte de la página de la tienda
  const p = l && l.find((x) => x.slug === m[1]);
  if (!url.pathname.endsWith('/') && p) return Response.redirect(url.origin + urlProducto(p), 301);
  const base = await fetch(new URL('/tienda/', url), { headers: { 'x-tienda-base': '1' } });
  if (!p) {
    // Si la tienda no ha podido cargar los productos, se manda a la tienda; si no existe, 404
    if (!l) return Response.redirect(url.origin + '/tienda/', 302);
    const no = await fetch(new URL('/404.html', url));
    return new Response(await no.text(), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
  return new Response(paginaProducto(await base.text(), p), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate' } });
};

export const config = { path: ['/tienda/', '/tienda/*', '/sitemap.xml'], excludedPath: ['/tienda/index.html'] };
