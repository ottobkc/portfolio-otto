// Envío de correos desde info@mirardespacio.es por SMTP.
// Variables de entorno en Netlify (proyecto ottokols):
//   SMTP_HOST  -> servidor de salida (p. ej. el de Dondominio)
//   SMTP_PORT  -> 465 (por defecto)
//   SMTP_USER  -> info@mirardespacio.es
//   SMTP_PASS  -> contraseña de ese buzón (secreta)
//   MAIL_FROM  -> opcional, por defecto SMTP_USER
//   AVISO_A    -> opcional: a dónde llega el aviso de cada inscripción (por defecto MAIL_FROM)
// No depende de ningún plan de pago de Netlify.
const nodemailer = require('nodemailer');

let transporte = null;
function smtp() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  if (!transporte) {
    const port = Number(process.env.SMTP_PORT) || 465;
    transporte = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporte;
}
const remitente = () => process.env.MAIL_FROM || process.env.SMTP_USER;

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function enviar({ para, asunto, html, texto, responderA }) {
  const t = smtp();
  if (!t) return false;
  await t.sendMail({
    from: `"Mirar Despacio" <${remitente()}>`,
    to: para,
    replyTo: responderA || remitente(),
    subject: asunto,
    html,
    text: texto,
  });
  return true;
}

module.exports = { enviar, esc, remitente, hayCorreo: () => !!smtp() };
