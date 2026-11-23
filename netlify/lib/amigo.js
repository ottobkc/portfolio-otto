// Amigo invisible fotográfico de Mirar Despacio (Navidad 2026).
// Cada persona se apunta con una pista; el día del sorteo a cada una le toca alguien y le hace UNA foto
// inspirada en su pista. Presencial: la lleva impresa (13×18 o 15×20) a la salida de Navidad.
// A distancia: la sube desde su enlace personal y el día de la entrega se la mandamos por correo a quien le tocó,
// en alta, lista para imprimir.
// Si un grupo (presencial o a distancia) se queda con menos de 3 personas, todos pasan a hacerlo a distancia.
const CONFIG = {
  apuntarseHasta: '2026-12-10',   // último día para apuntarse (incluido)
  sorteo: '2026-12-11',           // ese día por la mañana se sortea y se manda a cada uno su amigo
  subirHasta: '2026-12-20',       // a distancia: último día para subir la foto
  entrega: '2026-12-21',          // a distancia: ese día le llega a cada uno su foto
  salida: '',                     // presencial: fecha de la salida de Navidad (texto). Vacío = «por anunciar»
};
const COLECCION = 'amigo_invisible';
const WEB = 'https://mirardespacio.es/amigo-invisible/';
const hoy = () => new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).slice(0, 10);
const fechaBonita = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' });

// Reparte en un solo círculo (nadie se toca a sí mismo y no hay parejas cerradas que dejen a nadie fuera)
function circulo(lista) {
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.map((p, i) => ({ de: p, para: a[(i + 1) % a.length] }));
}

module.exports = { CONFIG, COLECCION, WEB, hoy, fechaBonita, circulo };
