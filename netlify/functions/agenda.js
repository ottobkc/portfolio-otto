// Agenda de Mirar Despacio: próximas salidas y talleres.
//  GET                 -> JSON para el calendario de la web (mirardespacio.es y zona de miembros)
//  GET ?formato=ics    -> calendario para suscribirse (Google, Apple, Outlook): se actualiza solo
//                         mirardespacio.es/agenda.ics apunta aquí
// Lee lo mismo que la web: salidas-data.json y talleres-data.json. No hay que tocar nada más:
// en cuanto pones una fecha en esos archivos, aparece en el calendario.
const BASE = 'https://mirardespacio.es/';
let cache = null;

const ORIGENES = /^https:\/\/((www\.)?mirardespacio\.es|([a-z0-9-]+--)?mirar-despacio\.netlify\.app|(www\.)?ottokols\.es)$/;
const pendiente = (v) => !v || /^por (determinar|confirmar|anunciar)/i.test(String(v).trim());

async function leer(nombre) {
  try {
    const r = await fetch(BASE + nombre + '?t=' + Date.now(), { signal: AbortSignal.timeout(5000) });
    return r.ok ? await r.json() : {};
  } catch (e) { return {}; }
}

async function eventos() {
  if (cache && Date.now() - cache.t < 120e3) return cache.e;
  const [s, t] = await Promise.all([leer('salidas-data.json'), leer('talleres-data.json')]);
  const ahora = Date.now();
  const lista = [];
  (s.proximas || []).filter((x) => x.activa && x.fechaISO && !pendiente(x.fecha)).forEach((x) => {
    const ini = new Date(x.fechaISO);
    const fin = x.fechaFinISO ? new Date(x.fechaFinISO) : new Date(ini.getTime() + 3 * 3600e3);
    if (isNaN(ini) || fin.getTime() < ahora) return;
    lista.push({ id: 'salida-' + x.fechaISO.slice(0, 10), tipo: 'salida', titulo: 'Salida' + (x.zona ? ' · ' + x.zona : ''),
      zona: x.zona || '', inicio: ini.toISOString(), fin: fin.toISOString(), url: BASE + 'salidas/#apuntarse', gratis: true });
  });
  const talleres = Object.fromEntries((t.talleres || []).map((x) => [x.id, x]));
  (t.ediciones || []).filter((e) => e.activa && e.fechaISO).forEach((e) => {
    const tl = talleres[e.taller] || {};
    const ini = new Date(e.fechaISO);
    const numeros = String(tl.duracion || '3').replace(',', '.').match(/[\d.]+/g) || ['3'];
    const horas = parseFloat(numeros.pop()) || 3;
    const fin = e.fechaFinISO ? new Date(e.fechaFinISO) : new Date(ini.getTime() + horas * 3600e3);
    if (isNaN(ini) || fin.getTime() < ahora) return;
    lista.push({ id: 'taller-' + e.id, tipo: 'taller', titulo: 'Taller · ' + (tl.titulo || e.taller), zona: e.zona || '',
      inicio: ini.toISOString(), fin: fin.toISOString(), url: BASE + 'talleres/#' + (e.taller || ''), precio: tl.precio || null });
  });
  lista.sort((a, b) => a.inicio.localeCompare(b.inicio));
  cache = { t: Date.now(), e: lista };
  return lista;
}

const utc = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const txt = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => '\\' + c).replace(/\r?\n/g, '\\n');

function ics(lista) {
  const l = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mirar Despacio//Agenda//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Mirar Despacio', 'X-WR-CALDESC:Salidas y talleres de fotografía callejera en Madrid', 'X-WR-TIMEZONE:Europe/Madrid',
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H', 'X-PUBLISHED-TTL:PT12H'];
  lista.forEach((e) => l.push('BEGIN:VEVENT', `UID:${e.id}@mirardespacio.es`, `DTSTAMP:${utc(new Date().toISOString())}`,
    `DTSTART:${utc(e.inicio)}`, `DTEND:${utc(e.fin)}`, `SUMMARY:${txt('Mirar Despacio · ' + e.titulo)}`,
    `DESCRIPTION:${txt((e.tipo === 'salida' ? 'Salida fotográfica de Mirar Despacio. El punto de encuentro se envía por email a quien se apunta.' : 'Taller de Mirar Despacio.') + ' Más información: ' + e.url)}`,
    `LOCATION:${txt((e.zona ? e.zona + ', ' : '') + 'Madrid')}`, `URL:${e.url}`, 'END:VEVENT'));
  l.push('END:VCALENDAR');
  return l.join('\r\n');
}

exports.handler = async (event) => {
  const o = event.headers.origin || '';
  const lista = await eventos();
  if ((event.queryStringParameters || {}).formato === 'ics') {
    return { statusCode: 200, headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'public, max-age=1800',
      'Content-Disposition': 'inline; filename="mirar-despacio.ics"' }, body: ics(lista) };
  }
  return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=120',
    'Access-Control-Allow-Origin': ORIGENES.test(o) ? o : 'https://mirardespacio.es', Vary: 'Origin' }, body: JSON.stringify(lista) };
};
