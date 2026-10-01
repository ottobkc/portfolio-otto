// Envío de correos desde info@mirardespacio.es (Google Workspace) por SMTP de Gmail.
// Variables de entorno en Netlify:
//   GMAIL_USER          -> info@mirardespacio.es
//   GMAIL_APP_PASSWORD  -> contraseña de aplicación de esa cuenta (16 letras)
// No depende de ningún plan de pago de Netlify.
const nodemailer = require('nodemailer');

let transporte = null;
function smtp() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null;
  if (!transporte) {
    transporte = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, '') },
    });
  }
  return transporte;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Misma estructura y estética que los correos de Mirar Despacio+ (PortfolioOtto/emails/):
// tarjeta blanca sobre crema, logo centrado, título en Georgia, texto en Helvetica,
// cuadro con los datos de la salida, botón negro redondeado y pie gris.
// c = { titulo, parrafos: [html], detalles: [[etiqueta, valor]], boton: {texto, url}, nota }
const F_TEXTO = "font-family:Helvetica,Arial,sans-serif;";
function plantilla(c) {
  const parrafos = (c.parrafos || []).map((p) => `<p style="margin:0 0 12px;">${p}</p>`).join('');
  const detalles = (c.detalles || []).length
    ? `<tr><td style="padding:12px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;border-radius:8px;">
            ${c.detalles.map(([k, v]) => `<tr><td style="padding:10px 16px 0;${F_TEXTO}font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#8a8477;">${k}</td></tr>
            <tr><td style="padding:2px 16px 10px;font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#1a1814;">${v}</td></tr>`).join('')}
          </table>
        </td></tr>`
    : '';
  const boton = c.boton
    ? `<tr><td align="center" style="padding:28px 32px 4px;">
          <a href="${c.boton.url}" style="display:inline-block;background:#1a1814;color:#f5f3ef;${F_TEXTO}font-size:16px;text-decoration:none;padding:14px 28px;border-radius:999px;">${c.boton.texto}</a>
        </td></tr>`
    : '';
  const nota = c.nota
    ? `<tr><td style="padding:20px 32px 0;${F_TEXTO}font-size:13px;line-height:1.5;color:#8a8477;">${c.nota}</td></tr>`
    : '';
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${c.titulo}</title></head>
<body style="margin:0;padding:0;background:#f5f3ef;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e3ded4;">
        <tr><td style="padding:32px 32px 8px;text-align:center;">
          <img src="https://res.cloudinary.com/dybxateci/image/upload/w_160/v1785276700/logoMD_gizjap.png" width="80" alt="Mirar Despacio" style="display:inline-block;">
        </td></tr>
        <tr><td style="padding:8px 32px 0;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;color:#1a1814;text-align:center;">
          ${c.titulo}
        </td></tr>
        <tr><td style="padding:16px 32px 0;${F_TEXTO}font-size:16px;line-height:1.6;color:#4a453c;">
          ${parrafos}
        </td></tr>
        ${detalles}${boton}${nota}
        <tr><td style="padding:28px 32px 0;"></td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #e3ded4;${F_TEXTO}font-size:12px;color:#8a8477;text-align:center;">
          Mirar Despacio · <a href="https://mirardespacio.es" style="color:#8a8477;">mirardespacio.es</a> · <a href="https://instagram.com/ob.kc" style="color:#8a8477;">@ob.kc</a> · Otto
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function aTexto(c) {
  const t = (h) => h.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');
  const partes = [t(c.titulo), ...(c.parrafos || []).map(t)];
  if ((c.detalles || []).length) partes.push(c.detalles.map(([k, v]) => `${k}: ${t(v)}`).join('\n'));
  if (c.boton) partes.push(`${c.boton.texto}: ${c.boton.url}`);
  if (c.nota) partes.push(t(c.nota));
  return partes.join('\n\n') + '\n\nOtto · Mirar Despacio\nhttps://mirardespacio.es';
}

async function enviar({ para, asunto, contenido, responderA, html }) {
  const t = smtp();
  if (!t) return false;
  await t.sendMail({
    from: `"Mirar Despacio" <${process.env.GMAIL_USER}>`,
    to: para,
    replyTo: responderA || process.env.GMAIL_USER,
    subject: asunto,
    html: html || plantilla(contenido),
    text: aTexto(contenido),
  });
  return true;
}

module.exports = { enviar, esc, plantilla, hayCorreo: () => !!smtp() };
