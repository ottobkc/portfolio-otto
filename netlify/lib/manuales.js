// Manuales web de los talleres (viven en ottokols.es/manuales/<id>/).
// Solo los ve quien tiene el rol "taller-<id>" en Netlify Identity (o el admin):
//   - automáticamente, quien paga una plaza de ese taller o canjea un bono de ese taller
//   - a mano, a quien Otto le dé acceso desde el CRM (Accesos → Manuales de talleres)
// La protección está en netlify.toml (una pareja de reglas por manual). Al añadir un manual nuevo:
//   1. su carpeta en PortfolioOtto/manuales/<id>/
//   2. su pareja de reglas en netlify.toml (copia la de atardecer y cambia el id)
//   3. 'listo: true' aquí
// 'despues': los «Retos para casa» de cada manual (mismos títulos, mismo orden). Cada persona sube una foto por
// ejercicio desde el manual (fotos.js, tipo 'taller') y Otto la comenta desde el CRM, pestaña Fotos.
// El número de cada ejercicio es su posición (1, 2, 3): si cambias el orden, cambian las fotos ya subidas.
const MANUALES = {
  atardecer: { titulo: 'Callejera al atardecer', listo: true,
    despues: ['Tu esquina, tres luces', 'Una silueta con historia', 'Cruzar la luz'] },
  nocturna: { titulo: 'Callejera nocturna', listo: true,
    despues: ['Tu calle, de noche', 'Retrato de escaparate', 'Movimiento a propósito'] },
  iniciacion: { titulo: 'Primeros pasos', listo: true,
    despues: ['Tres diafragmas', 'Congelado o movido', 'Media hora sin automático'] },
  composicion: { titulo: 'Composición en la calle', listo: true,
    despues: ['Un sitio, cinco encuadres', 'Tres capas', 'Rompe una regla'] },
};
const URL_BASE = 'https://ottokols.es';
const urlManual = (id) => `${URL_BASE}/manuales/${id}/`;
// Enlace que pasa por el acceso: si no ha iniciado sesión, primero entra y luego va al manual
const urlEntrada = (id) => `${URL_BASE}/acceso.html?a=manual-${id}`;

module.exports = { MANUALES, urlManual, urlEntrada };
