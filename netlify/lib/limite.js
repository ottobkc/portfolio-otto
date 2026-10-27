// Límite de peticiones por persona (por IP, guardada como huella, nunca la IP tal cual).
// Frena a quien intente llenar el CRM de inscripciones falsas o probar códigos a lo loco.
// Si algo falla al contar, deja pasar: nunca bloquea a alguien de verdad por un error nuestro.
const crypto = require('crypto');

async function permitir(fs, event, nombre, max, ventanaMin = 60) {
  const hd = (event && event.headers) || {};
  const ip = hd['x-nf-client-connection-ip'] || String(hd['x-forwarded-for'] || '').split(',')[0].trim();
  if (!ip) return true;
  const tramo = Math.floor(Date.now() / (ventanaMin * 60e3));
  const huella = crypto.createHash('sha256').update(ip + '|' + (process.env.AVISOS_SECRET || process.env.FIREBASE_CLIENT_EMAIL || 'md')).digest('hex').slice(0, 24);
  const ref = fs.collection('limites').doc(`${nombre}-${huella}-${tramo}`);
  try {
    return await fs.runTransaction(async (t) => {
      const s = await t.get(ref);
      const n = (s.exists ? s.data().n : 0) + 1;
      t.set(ref, { n, hasta: new Date((tramo + 1) * ventanaMin * 60e3) });
      return n <= max;
    });
  } catch (e) {
    console.warn('limite:', e.message);
    return true;
  }
}

// Borra los contadores viejos (lo llama la tarea diaria)
async function limpiar(fs) {
  const q = await fs.collection('limites').where('hasta', '<', new Date(Date.now() - 864e5)).get();
  await Promise.all(q.docs.map((d) => d.ref.delete()));
  return q.size;
}

module.exports = { permitir, limpiar };
