// Copia de seguridad semanal del CRM (Firestore).
// Se ejecuta sola cada lunes (ver netlify.toml) y manda a AVISO_A un correo con un .json.gz
// que contiene TODAS las colecciones: personas, inscripciones, salidas, ingresos, bonos,
// accesos, pegatinas, ranking y jugadores del juego...
// Para restaurar algo, ese archivo se puede volver a cargar en Firestore con un script.
const zlib = require('zlib');
const { db } = require('../lib/firestore');
const { enviar, remitente } = require('../lib/correo');

// Fechas de Firestore -> texto ISO, para que el JSON se pueda leer y volver a cargar
function limpiar(v) {
  if (v && typeof v.toDate === 'function') return { __fecha: v.toDate().toISOString() };
  if (Array.isArray(v)) return v.map(limpiar);
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = limpiar(v[k]); return o; }
  return v;
}

async function copia() {
  const fs = db();
  const colecciones = await fs.listCollections();
  const datos = { creada: new Date().toISOString(), proyecto: 'mirardespaciocrm', colecciones: {} };
  const resumen = [];
  for (const c of colecciones) {
    const snap = await c.get();
    datos.colecciones[c.id] = snap.docs.map((d) => ({ id: d.id, ...limpiar(d.data()) }));
    resumen.push([c.id, snap.size]);
  }
  return { datos, resumen };
}

exports.handler = async () => {
  try {
    const { datos, resumen } = await copia();
    const dia = datos.creada.slice(0, 10);
    const gz = zlib.gzipSync(Buffer.from(JSON.stringify(datos)));
    const filas = resumen.sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, n]) => `<tr><td style="padding:2px 14px 2px 0;">${k}</td><td style="text-align:right;">${n}</td></tr>`).join('');
    const html = `<!doctype html><html><body style="font:15px/1.5 system-ui,sans-serif;color:#1a1814;">
<p>Copia de seguridad semanal del CRM de Mirar Despacio (${dia}). Guarda el archivo adjunto en tu NAS o en Drive.</p>
<table>${filas}</table>
<p style="color:#6b655a;font-size:13px;">Si algún día se pierde algo, con este archivo se puede recuperar. No lo reenvíes: contiene datos personales.</p></body></html>`;
    await enviar({
      para: process.env.AVISO_A || remitente(),
      asunto: `Copia de seguridad del CRM · ${dia}`,
      html,
      texto: 'Copia de seguridad semanal del CRM de Mirar Despacio (' + dia + '). ' + resumen.map(([k, n]) => k + ': ' + n).join(', '),
      adjuntos: [{ filename: `crm-mirardespacio-${dia}.json.gz`, content: gz, contentType: 'application/gzip' }],
    });
    console.log('copia enviada', resumen);
    return { statusCode: 200, body: 'ok' };
  } catch (e) {
    console.error('copia-seguridad', e);
    return { statusCode: 500, body: 'error' };
  }
};

exports.copia = copia;
