// Conexión mínima con Stripe, sin librerías externas.
// Variables de entorno de Netlify:
//   STRIPE_SECRET_KEY      -> clave secreta (sk_test_… para pruebas, sk_live_… de verdad).
//                             Vale una clave restringida con permiso de LECTURA en
//                             Checkout Sessions, Subscriptions e Invoices, y de ESCRITURA en Payment Links.
//   STRIPE_WEBHOOK_SECRET  -> "Signing secret" del webhook (whsec_…)
const crypto = require('crypto');

const API = 'https://api.stripe.com/v1';

// Lee el cuerpo tal cual llegó (Stripe firma el texto exacto, no el JSON ya interpretado)
function cuerpo(event) {
  return event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || '';
}

// Comprueba la firma del aviso. Devuelve el evento ya interpretado o lanza un error.
function verificar(event, secreto, toleranciaSeg = 300) {
  const raw = cuerpo(event);
  const cab = event.headers['stripe-signature'] || event.headers['Stripe-Signature'] || '';
  const partes = cab.split(',').map((x) => x.split('='));
  const t = (partes.find(([k]) => k === 't') || [])[1];
  const firmas = partes.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || !firmas.length) throw new Error('sin-firma');
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranciaSeg) throw new Error('firma-caducada');
  const esperada = crypto.createHmac('sha256', secreto).update(`${t}.${raw}`, 'utf8').digest('hex');
  const ok = firmas.some((f) => f.length === esperada.length && crypto.timingSafeEqual(Buffer.from(f), Buffer.from(esperada)));
  if (!ok) throw new Error('firma-incorrecta');
  return JSON.parse(raw);
}

// Llamada a la API de Stripe. params se envía como formulario (así lo pide Stripe).
async function api(ruta, { metodo = 'GET', params } = {}) {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('Falta STRIPE_SECRET_KEY');
  const qs = params ? new URLSearchParams(params).toString() : '';
  const url = API + ruta + (metodo === 'GET' && qs ? (ruta.includes('?') ? '&' : '?') + qs : '');
  const r = await fetch(url, {
    method: metodo,
    headers: {
      Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY,
      ...(metodo !== 'GET' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: metodo !== 'GET' ? qs : undefined,
    signal: AbortSignal.timeout(8000),
  });
  const j = await r.json();
  if (!r.ok) throw new Error('Stripe: ' + ((j.error && j.error.message) || r.status));
  return j;
}

// Quita parámetros y barras finales para comparar enlaces de pago
const normalizarUrl = (u) => String(u || '').trim().split('?')[0].replace(/\/+$/, '').toLowerCase();

// URL pública (buy.stripe.com/…) de un enlace de pago a partir de su id (plink_…)
async function urlDeEnlace(id) {
  if (!id) return '';
  const pl = await api('/payment_links/' + encodeURIComponent(id));
  return pl.url || '';
}

// Desactiva el enlace de pago que tenga esta URL (para cerrar un taller completo)
async function desactivarEnlace(url) {
  const buscado = normalizarUrl(url);
  if (!buscado) return 'sin-enlace';
  let despues = null;
  for (let pagina = 0; pagina < 10; pagina++) {
    const lista = await api('/payment_links', { params: { limit: 100, active: 'true', ...(despues ? { starting_after: despues } : {}) } });
    const pl = (lista.data || []).find((x) => normalizarUrl(x.url) === buscado);
    if (pl) {
      await api('/payment_links/' + pl.id, { metodo: 'POST', params: { active: 'false' } });
      return 'desactivado';
    }
    if (!lista.has_more || !lista.data.length) break;
    despues = lista.data[lista.data.length - 1].id;
  }
  return 'no-encontrado';
}

module.exports = { verificar, api, normalizarUrl, urlDeEnlace, desactivarEnlace };
