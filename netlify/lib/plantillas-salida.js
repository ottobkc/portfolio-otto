// Plantillas de los correos de inscripción a las salidas.
// Copian los correos que Otto ya mandaba a mano:
//  - tarjeta()  -> "Email_Confirmacion_Salida4_Octubre": barra degradado, logo, tarjeta crema
//                  con 📅 🕙 📍, botones de calendario y firma "Un abrazo, Otto".
//  - recibido() -> "Email_Confirmacion_Solicitud_ProximaSalida": cabecera crema con lema,
//                  "Recibido." y tarjeta oscura de estado. Para cuando aún no hay fecha.
const { esc } = require('./correo');

const LOGO = 'https://res.cloudinary.com/dybxateci/image/upload/v1785276700/logoMD_gizjap.png';
const CAL = 'https://ottokols.es/.netlify/functions/calendario';

const p = (html, margen = '16px 0 0 0') =>
  `<p style="font-size:16px; line-height:1.6; margin:${margen};">${html}</p>`;

// Fecha bonita a partir de fechaISO: "Domingo 11 de octubre"
function fechaLarga(iso, respaldo) {
  if (!iso) return respaldo;
  const d = new Date(iso);
  if (isNaN(d)) return respaldo;
  const t = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' }).format(d);
  return t.charAt(0).toUpperCase() + t.slice(1).replace(',', '');
}

function utc(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function enlacesCalendario(s) {
  if (!s.iso) return null;
  const ini = new Date(s.iso);
  const fin = s.finISO ? new Date(s.finISO) : new Date(ini.getTime() + 3 * 3600e3);
  if (isNaN(ini) || isNaN(fin)) return null;
  const titulo = s.tituloCal || ('Mirar Despacio - Salida ' + (s.zona || ''));
  const detalles = s.detallesCal || ('Salida fotográfica de Mirar Despacio' + (s.zona ? ' por la zona de ' + s.zona : '') +
    '. El punto de encuentro se enviará por email antes de la fecha.');
  const google = 'https://www.google.com/calendar/render?action=TEMPLATE' +
    '&text=' + encodeURIComponent(titulo.trim()) +
    '&dates=' + utc(ini) + '/' + utc(fin) +
    '&details=' + encodeURIComponent(detalles) +
    '&location=' + encodeURIComponent((s.zona ? s.zona + ', ' : '') + 'Madrid');
  const apple = CAL + '?inicio=' + encodeURIComponent(ini.toISOString()) +
    '&fin=' + encodeURIComponent(fin.toISOString()) + '&zona=' + encodeURIComponent(s.zona || '') +
    (s.tituloCal ? '&titulo=' + encodeURIComponent(s.tituloCal) : '');
  return { google, apple };
}

const boton = (url, texto) => `<td style="padding: 0 6px;">
                  <a href="${url}"
                     style="display:inline-block; padding:12px 20px; background-color:#1a1814; color:#ffffff; text-decoration:none; border-radius:8px; font-family: Helvetica, Arial, sans-serif; font-size:14px;">
                    ${texto}
                  </a>
                </td>`;

// Diseño "tarjeta" (correo de la cuarta salida)
// o = { titulo, nombre, intro: [html], filas: [[emoji, html]], calendario: {google, apple}|null, boton: {url, texto, antes}|null, cuerpo: [html] }
function tarjeta(o) {
  const filas = o.filas.map(([icono, txt], i) =>
    `<p style="font-size:16px; margin:${i === o.filas.length - 1 ? '0' : '0 0 10px 0'}; color:#1a1814;">${icono} <strong>${txt}</strong></p>`).join('\n                  ');
  const cal = o.calendario ? `
        <tr>
          <td style="padding: 20px 32px 0 32px; color:#1a1814;">
            <p style="font-size:16px; line-height:1.6; margin:0 0 12px 0; text-align:center;">
              Pulsa aquí para añadirlo a tu calendario:
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" align="center">
              <tr>
                ${boton(o.calendario.google, '📅 Google Calendar')}
                ${boton(o.calendario.apple, '🍏 Apple / iPhone')}
              </tr>
            </table>
          </td>
        </tr>` : '';
  const btn = o.boton ? `
        <tr>
          <td style="padding: 20px 32px 0 32px; color:#1a1814;">
            ${o.boton.antes ? `<p style="font-size:16px; line-height:1.6; margin:0 0 12px 0; text-align:center;">${o.boton.antes}</p>` : ''}
            <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>${boton(o.boton.url, o.boton.texto)}</tr></table>
          </td>
        </tr>` : '';
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${o.titulo}</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f3ef; font-family: Georgia, 'Times New Roman', serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3ef; padding: 32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow: 0 2px 12px rgba(26,24,20,0.08);">
        <tr>
          <td style="height:6px; background-color:#e8347a; background: linear-gradient(90deg, #e8821a, #e8347a);"></td>
        </tr>
        <tr>
          <td align="center" style="padding: 28px 24px 8px 24px;">
            <img src="${LOGO}" alt="Mirar Despacio" width="180" style="display:block; max-width:180px; height:auto;">
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 32px 0 32px; color:#1a1814;">
            ${p(`Hola${o.nombre ? ' ' + esc(o.nombre) : ''},`)}
            ${o.intro.map((t) => p(t)).join('\n            ')}
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 32px 0 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3ef; border-radius:10px;">
              <tr>
                <td style="padding: 20px 24px;">
                  ${filas}
                </td>
              </tr>
            </table>
          </td>
        </tr>${cal}${btn}
        <tr>
          <td style="padding: 20px 32px 0 32px; color:#1a1814;">
            ${o.cuerpo.map((t, i) => p(t, i === 0 ? '0' : '16px 0 0 0')).join('\n            ')}
          </td>
        </tr>
        <tr>
          <td style="padding: 24px 32px 32px 32px; color:#1a1814;">
            <p style="font-size:16px; line-height:1.6; margin:0;">
              Un abrazo,<br>
              <strong>Otto</strong><br>
              <span style="color:#8a8378; font-size:14px;">Mirar Despacio</span>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// Diseño "recibido" (correo de solicitud sin fecha)
// o = { titulo, nombre, cabecera, parrafos: [html], estado }
function recibido(o) {
  const parrafos = o.parrafos.map((t, i) =>
    `<p style="font-family: Georgia, serif; font-size:15px; color:#4a453d; line-height:1.7; margin:${i === o.parrafos.length - 1 ? '0' : '0 0 18px 0'};">${t}</p>`).join('\n      ');
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${o.titulo}</title>
</head>
<body style="margin:0; padding:0; background-color:#e8e5df;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#e8e5df; padding:30px 0;">
<tr>
<td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#f5f3ef; max-width:600px; width:100%;">
  <tr>
    <td style="background-color:#f5f3ef; padding:36px 40px 24px 40px; text-align:center; border-bottom:1px solid #e5e1d8;">
      <img src="${LOGO}" alt="Mirar Despacio" width="220" style="display:block; margin:0 auto; max-width:220px; height:auto;">
      <div style="font-family: Georgia, serif; font-style:italic; font-size:14px; color:#8a6a45; margin-top:14px;">
        Fotografía callejera, sin prisa
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:40px 40px 20px 40px;">
      <h1 style="font-family: Georgia, serif; font-size:24px; color:#1a1814; margin:0 0 20px 0; line-height:1.3;">
        ${o.cabecera}
      </h1>
      ${parrafos}
    </td>
  </tr>
  <tr>
    <td style="padding:10px 40px 20px 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1814; border-radius:10px;">
        <tr>
          <td style="padding:26px 30px;">
            <div style="font-family: Georgia, serif; font-size:12px; letter-spacing:1.5px; color:#c8a97a; text-transform:uppercase; margin-bottom:10px;">
              Estado
            </div>
            <div style="font-family: Georgia, serif; font-size:18px; color:#f5f3ef;">
              ${o.estado}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 40px 40px 40px;">
      <p style="font-family: Georgia, serif; font-size:15px; color:#4a453d; line-height:1.7; margin:0 0 20px 0;">
        Cualquier duda, respondes a este email sin problema.
      </p>
      <p style="font-family: Georgia, serif; font-size:15px; color:#1a1814; margin:0;">
        Hasta pronto,<br>
        <strong>Otto</strong><br>
        <em style="color:#c8a97a;">Mirar Despacio</em>
      </p>
    </td>
  </tr>
  <tr>
    <td style="background-color:#1a1814; padding:20px 40px; text-align:center;">
      <div style="font-family: Georgia, serif; font-size:11px; color:#6b6558;">
        Mirar Despacio · <a href="https://mirardespacio.es" style="color:#6b6558;">mirardespacio.es</a>
      </div>
    </td>
  </tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

// Versión en texto plano (para clientes de correo sin HTML)
function aTexto(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<title>[\s\S]*?<\/title>/g, '')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/a>/g, '$2: $1')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/(p|h1|div|tr)>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .split('\n').map((l) => l.trim()).filter((l, i, a) => l || (a[i - 1] && a[i - 1].trim()))
    .join('\n').trim();
}

module.exports = { tarjeta, recibido, fechaLarga, enlacesCalendario, aTexto };
