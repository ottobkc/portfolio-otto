// Correos de la zona de socios (en español, desde info@mirardespacio.es), con el mismo diseño que
// los de las salidas. Sustituyen a los de Netlify Identity (PortfolioOtto/emails/).
const { esc } = require('./correo');
const { tarjeta, aTexto } = require('./plantillas-salida');

const WEB = 'https://mirardespacio.es';
const QUE = {
  socios: 'la zona de Mirar Despacio+', cuaderno: 'tu cuaderno de fotos', retos: 'el reto del mes',
};
const destinoTxt = (a) => (/^manual-/.test(a || '') ? 'el manual de tu taller' : QUE[a] || 'tu zona de Mirar Despacio');

// El enlace para entrar (caduca: Firebase lo da válido unas horas y de un solo uso)
function correoEnlace({ email, enlace, a }) {
  const html = tarjeta({
    titulo: 'Tu enlace para entrar · Mirar Despacio',
    nombre: '',
    intro: [`Aquí tienes tu enlace para entrar en ${destinoTxt(a)}. No hace falta contraseña: pulsas el botón y estás dentro.`],
    filas: [['📧', esc(email)], ['⏳', 'Sirve una sola vez y caduca en unas horas.'], ['📱', 'Ábrelo en el mismo móvil u ordenador donde quieras entrar.']],
    calendario: null,
    boton: { url: enlace, texto: 'Entrar en Mirar Despacio', antes: '' },
    cuerpo: [`Si caduca, pide otro en <a href="${WEB}/acceso/" style="color:#e8347a;">mirardespacio.es/acceso</a>.`,
      '<span style="font-size:13px;color:#8a8378;">Si no has pedido entrar, ignora este correo: sin el enlace nadie puede entrar con tu email.</span>'],
  });
  return { asunto: 'Tu enlace para entrar · Mirar Despacio', html, texto: aTexto(html) };
}

// Invitación: ya tiene cuenta. El botón lleva a la página de acceso con su email puesto
// (el enlace mágico caduca en horas; la invitación puede leerse días después).
function correoInvitacion({ email, que, a }) {
  const url = `${WEB}/acceso/?e=${encodeURIComponent(email)}${a ? '&a=' + encodeURIComponent(a) : ''}`;
  const html = tarjeta({
    titulo: 'Tu cuenta de Mirar Despacio',
    nombre: '',
    intro: ['Ya tienes cuenta en Mirar Despacio.', `Desde ella puedes entrar en ${que || destinoTxt(a)}.`],
    filas: [['📧', 'Entrarás siempre con este email: ' + esc(email)], ['🔑', 'Sin contraseñas: cada vez que quieras entrar te mando un enlace al correo.']],
    calendario: null,
    boton: { url, texto: 'Entrar por primera vez', antes: '' },
    cuerpo: ['<span style="font-size:13px;color:#8a8378;">Si no esperabas este correo, puedes ignorarlo.</span>'],
  });
  return { asunto: 'Tu cuenta de Mirar Despacio', html, texto: aTexto(html) };
}

module.exports = { correoEnlace, correoInvitacion, destinoTxt, WEB };
