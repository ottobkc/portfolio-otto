// Cada día (netlify.toml) avisa a IndexNow de las páginas de las dos webs con lastmod de ayer u hoy.
// Así también se avisa de lo que se publica solo en mirardespacio.es (ese sitio no tiene funciones).
const { avisar } = require('../lib/indexnow');
const dia = (offset) => new Date(Date.now() + offset * 864e5).toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).slice(0, 10);

exports.handler = async () => {
  const informe = await avisar(dia(-1));
  console.log('indexnow', informe.join(' | '));
  return { statusCode: 200, body: informe.join('\n') };
};
