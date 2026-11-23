// Netlify la llama sola al terminar cada despliegue de ottokols.es: avisa a IndexNow de lo cambiado hoy.
const { avisar } = require('../lib/indexnow');
const hoy = () => new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).slice(0, 10);

exports.handler = async () => {
  const informe = await avisar(hoy());
  console.log('indexnow tras despliegue', informe.join(' | '));
  return { statusCode: 200, body: 'ok' };
};
