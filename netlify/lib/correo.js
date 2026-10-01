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

async function enviar({ para, asunto, html, texto, responderA }) {
  const t = smtp();
  if (!t) return false;
  await t.sendMail({
    from: `"Mirar Despacio" <${process.env.GMAIL_USER}>`,
    to: para,
    replyTo: responderA || process.env.GMAIL_USER,
    subject: asunto,
    html,
    text: texto,
  });
  return true;
}

module.exports = { enviar, esc, hayCorreo: () => !!smtp() };
