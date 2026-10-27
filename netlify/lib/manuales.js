// Manuales web de los talleres (viven en ottokols.es/manuales/<id>/).
// Solo los ve quien tiene el rol "taller-<id>" en Netlify Identity (o el admin):
//   - automáticamente, quien paga una plaza de ese taller o canjea un bono de ese taller
//   - a mano, a quien Otto le dé acceso desde el CRM (Accesos → Manuales de talleres)
// La protección está en netlify.toml (una pareja de reglas por manual). Al añadir un manual nuevo:
//   1. su carpeta en PortfolioOtto/manuales/<id>/
//   2. su pareja de reglas en netlify.toml (copia la de atardecer y cambia el id)
//   3. 'listo: true' aquí
const MANUALES = {
  atardecer: { titulo: 'Callejera al atardecer', listo: true },
  nocturna: { titulo: 'Callejera nocturna', listo: false },
  iniciacion: { titulo: 'Primeros pasos', listo: false },
  composicion: { titulo: 'Composición en la calle', listo: false },
};
const URL_BASE = 'https://ottokols.es';
const urlManual = (id) => `${URL_BASE}/manuales/${id}/`;
// Enlace que pasa por el acceso: si no ha iniciado sesión, primero entra y luego va al manual
const urlEntrada = (id) => `${URL_BASE}/acceso.html?a=manual-${id}`;

module.exports = { MANUALES, urlManual, urlEntrada };
