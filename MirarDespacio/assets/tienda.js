// Tienda de mirardespacio.es (en el navegador): fotos, tallas y botón de compra.
// Normalmente la página llega ya escrita desde el servidor (función edge "tienda") con los datos
// en #tienda-datos. Si no, los pide a /api/tienda y la pinta aquí. Sin productos, se queda el zine.
// El ?v= se sube a mano cada vez que cambia tienda-tarjeta.mjs (el navegador guarda /assets 7 días)
import { tarjeta, img, eur, precioVar, fraseEnvio, eleccion } from './tienda-tarjeta.mjs?v=3';

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

// Al elegir tamaño (o talla) cambian el precio y el envío de la ficha
document.addEventListener('change', (e) => {
  const radio = e.target.closest('.producto-tallas input');
  if (!radio) return;
  const art = radio.closest('.producto');
  const p = lista[Number(art.dataset.i)];
  if (!p) return;
  const v = p.variantes.find((x) => x.nombre === radio.value);
  const pr = art.querySelector('[data-precio]');
  if (pr) { pr.textContent = eur(precioVar(p, v)); pr.classList.remove('desde'); }
  const en = art.querySelector('[data-envio]');
  if (en) en.textContent = fraseEnvio(p, v, !!p.enlacePago);
});

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
  const v = p.variantes.find((x) => x.nombre === talla);
  const que = talla ? eleccion(p).toLowerCase() + ' ' + talla : '';
  try { if (window.umami) umami.track('tienda-quiero', { producto: p.nombre, talla }); } catch (x) { /* nada */ }
  if (p.enlacePago) return; // el enlace ya lleva al pago
  e.preventDefault();
  const asunto = (p.preventa ? 'Reserva (preventa): ' : 'Quiero: ') + p.nombre + (talla ? ' (' + que + ')' : '');
  const cuerpo = 'Hola, Otto:\n\n' + (p.preventa ? 'Quiero reservar ' : 'Me gustaría comprar ') + p.nombre + (talla ? ', ' + que : '') + ' (' + eur(precioVar(p, v)) + ').\n\nMe lo llevo en una salida / Me lo envías a: \n\nGracias.';
  location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
});
