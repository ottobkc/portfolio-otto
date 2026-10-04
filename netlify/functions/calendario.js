// Archivo .ics para el botón "Apple / iPhone" de los correos de inscripción.
// /.netlify/functions/calendario?inicio=2026-10-11T08:00:00.000Z&fin=2026-10-11T11:00:00.000Z&zona=Huertas
const utc = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const limpio = (s) => String(s || '').replace(/[\r\n;,\\]/g, ' ').trim().slice(0, 80);

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const ini = new Date(q.inicio);
  const fin = q.fin ? new Date(q.fin) : new Date(ini.getTime() + 3 * 3600e3);
  if (isNaN(ini) || isNaN(fin) || fin <= ini) return { statusCode: 400, body: 'Fecha no válida' };
  const zona = limpio(q.zona);
  const titulo = limpio(q.titulo);
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mirar Despacio//Salidas//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:salida-${utc(ini)}@mirardespacio.es`,
    `DTSTAMP:${utc(new Date())}`,
    `DTSTART:${utc(ini)}`,
    `DTEND:${utc(fin)}`,
    `SUMMARY:${titulo || 'Mirar Despacio - Salida' + (zona ? ' ' + zona : '')}`,
    `DESCRIPTION:${titulo ? titulo + ' (Mirar Despacio)' : 'Salida fotográfica de Mirar Despacio' + (zona ? ' por la zona de ' + zona : '')}. El punto de encuentro se enviará por email antes de la fecha.`,
    `LOCATION:${zona ? zona + '\\, ' : ''}Madrid`,
    'URL:https://mirardespacio.es/salidas/',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="salida-mirar-despacio.ics"',
      'Cache-Control': 'public, max-age=86400',
    },
    body: ics,
  };
};
