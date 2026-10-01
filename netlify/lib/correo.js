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

// Envuelve el texto (párrafos separados por línea en blanco) en una plantilla sencilla con la marca.
function plantilla(parrafos) {
  const cuerpo = parrafos.map((p) => `<p style="margin:0 0 16px;">${p}</p>`).join('\n');
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f5f3ef;">
<div style="max-width:520px;margin:0 auto;padding:32px 24px;font:16px/1.6 Georgia,serif;color:#1a1814;">
  <p style="margin:0 0 24px;"><img src="https://res.cloudinary.com/dybxateci/image/upload/w_96/v1785276700/logoMD_gizjap.png" width="48" height="48" alt="Mirar Despacio"></p>
  ${cuerpo}
  <p style="margin:24px 0 0;color:#6b655a;font-size:14px;">Otto · Mirar Despacio<br><a href="https://mirardespacio.es/salidas/" style="color:#e8347a;">mirardespacio.es</a> · <a href="https://instagram.com/ob.kc" style="color:#e8347a;">@ob.kc</a></p>
</div></body></html>`;
}

function aTexto(parrafos) {
  return parrafos.map((p) => p.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '')).join('\n\n') + '\n\nOtto · Mirar Despacio\nhttps://mirardespacio.es';
}

async function enviar({ para, asunto, parrafos, responderA, html }) {
  const t = smtp();
  if (!t) return false;
  await t.sendMail({
    from: `"Mirar Despacio" <${process.env.GMAIL_USER}>`,
    to: para,
    replyTo: responderA || process.env.GMAIL_USER,
    subject: asunto,
    html: html || plantilla(parrafos),
    text: aTexto(parrafos),
  });
  return true;
}

module.exports = { enviar, esc, hayCorreo: () => !!smtp() };
