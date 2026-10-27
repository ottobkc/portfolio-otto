// Tienda de mirardespacio.es (en el navegador): fotos, tallas y botón de compra.
// Normalmente la página llega ya escrita desde el servidor (función edge "tienda") con los datos
// en #tienda-datos. Si no, los pide a /api/tienda y la pinta aquí. Sin productos, se queda el zine.
import { tarjeta, img } from './tienda-tarjeta.mjs';

const caja = document.getElementById('tienda-productos');
const EMAIL = (caja && caja.getAttribute('data-email')) || 'info@mirardespacio.es';
let lista = [];
const datos = document.getElementById('tienda-datos');

function mostrar() {
  if (!caja || !lista.length) return;
  if (!caja.dataset.servidor) caja.innerHTML = lista.map((p, i) => tarjeta(p, i, false)).join('');
  const fijo = document.getElementById('tienda-fijo');
  if (fijo) fijo.hidden = true;
  caja.hidden = false;
}

if (datos) {
  try { lista = JSON.parse(datos.textContent) || []; } catch (e) { lista = []; }
  mostrar();
} else if (caja) {
  fetch('/api/tienda', { headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : []))
    .then((l) => { lista = Array.isArray(l) ? l : []; mostrar(); })
    .catch(() => {});
}

document.addEventListener('click', (e) => {
  const art = e.target.closest('.producto');
  if (!art) return;
  const p = lista[Number(art.dataset.i)];
  if (!p) return;
  const mini = e.target.closest('.producto-minis button');
  if (mini) {
    art.querySelector('.producto-foto').src = img(p.fotos[Number(mini.dataset.f)], 'f_auto,q_auto,c_limit,w_1100');
    art.querySelectorAll('.producto-minis button').forEach((b) => b.classList.toggle('activa', b === mini));
    return;
  }
  const avisar = e.target.closest('[data-avisar]');
  if (avisar) { e.preventDefault(); location.href = `mailto:${EMAIL}?subject=${encodeURIComponent('Avísame cuando haya: ' + p.nombre)}`; return; }
  const boton = e.target.closest('[data-comprar]');
  if (!boton) return;
  const marcada = art.querySelector('.producto-tallas input:checked');
  const talla = marcada ? marcada.value : '';
  try { if (window.umami) umami.track('tienda-quiero', { producto: p.nombre, talla }); } catch (x) { /* nada */ }
  if (p.enlacePago) return; // el enlace ya lleva al pago
  e.preventDefault();
  const asunto = 'Quiero: ' + p.nombre + (talla ? ' (talla ' + talla + ')' : '');
  const cuerpo = 'Hola, Otto:\n\nMe gustaría comprar ' + p.nombre + (talla ? ', talla ' + talla : '') + '.\n\nMe lo llevo en una salida / Me lo envías a: \n\nGracias.';
  location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
});
