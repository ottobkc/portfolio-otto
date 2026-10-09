// Galería privada de un cliente (ottokols.es/galeria/). Se entra solo con el código de acceso.
//
//  GET  ?c=CODIGO                                   -> datos de la galería según su estado
//  POST {c, accion:'guardar', seleccion:[ids]}      -> guarda la selección mientras eligen (sin avisar)
//  POST {c, accion:'enviar',  seleccion:[ids]}      -> selección definitiva: se cierra y se avisa a Otto
//
// Estados: 'seleccion' (eligiendo) -> 'enviada' (Otto edita) -> 'entregada' (descargan las HD).
// Otto puede reabrir la selección desde el panel si quieren cambiar algo.
const { db, FieldValue, conLimite } = require('../lib/firestore');
const { permitir } = require('../lib/limite');
const { enviar, esc, remitente } = require('../lib/correo');
const G = require('../lib/galerias');

const ORIGENES = /^https:\/\/((www\.)?ottokols\.es|([a-z0-9-]+--)?ottokols\.netlify\.app)$/;
const cab = (o) => ({
  'Access-Control-Allow-Origin': ORIGENES.test(o || '') ? o : 'https://ottokols.es',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  Vary: 'Origin',
});
const res = (h, code, obj) => ({ statusCode: code, headers: h, body: JSON.stringify(obj) });

async function porCodigo(fs, codigo) {
  const c = G.normalCodigo(codigo);
  if (!G.CODIGO_OK.test(c)) return null;
  const q = await fs.collection('galerias').where('codigo', '==', c).limit(1).get();
  return q.empty ? null : q.docs[0];
}

const fechaLarga = (t) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' }).format(new Date(t));

function vista(g) {
  const fotos = g.fotos || [];
  const portada = fotos.find((f) => f.id === g.portada) || fotos[0];
  const base = {
    titulo: g.titulo || '', subtitulo: g.subtitulo || '', max: g.max || 15, estado: g.estado,
    portada: portada ? G.urlPrevia(portada, 'grande') : null,
    seleccion: (g.seleccion || []).filter((id) => fotos.some((f) => f.id === id)),
    total: fotos.length,
  };
  if (g.estado === 'entregada') {
    const caduca = G.ms(g.caduca);
    const vivo = !caduca || caduca > Date.now();
    return {
      ...base,
      caduca: caduca ? fechaLarga(caduca) : '',
      caducada: !vivo,
      finales: vivo && G.hayR2() ? (g.finales || []).map((f) => ({
        nombre: f.nombre, bytes: f.bytes || 0,
        url: G.descargaR2(f.clave, f.nombre, 6 * 3600),
        mini: f.previa ? G.urlPrevia({ id: f.previa, formato: f.previaFormato }, 'final') : null,
      })) : [],
    };
  }
  return {
    ...base,
    fotos: fotos.map((f) => ({ id: f.id, arch: f.arch || '', ancho: f.ancho || null, alto: f.alto || null, mini: G.urlPrevia(f, 'mini'), grande: G.urlPrevia(f, 'grande') })),
  };
}

exports.handler = async (event) => {
  const h = cab(event.headers.origin);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: h, body: '' };
  try {
    const fs = db();
    if (!(await permitir(fs, event, 'galeria', 120))) return res(h, 429, { error: 'demasiados' });
    const b = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : {};
    const codigo = (event.queryStringParameters || {}).c || b.c;
    const snap = await porCodigo(fs, codigo);
    if (!snap) {
      // Los códigos que no existen cuentan aparte y con un límite más corto: frena a quien pruebe a lo loco
      await permitir(fs, event, 'galeria-fallo', 15);
      return res(h, 404, { error: 'codigo' });
    }
    const g = snap.data();
    if (g.archivada) return res(h, 410, { error: 'archivada' });

    if (event.httpMethod === 'GET') {
      if (!g.vista) snap.ref.update({ vista: FieldValue.serverTimestamp() }).catch(() => {});
      return res(h, 200, vista(g));
    }
    if (event.httpMethod !== 'POST') return res(h, 405, {});

    if (b.accion === 'guardar' || b.accion === 'enviar') {
      if (g.estado !== 'seleccion') return res(h, 409, { error: 'cerrada', estado: g.estado });
      const validos = new Set((g.fotos || []).map((f) => f.id));
      const sel = Array.from(new Set((Array.isArray(b.seleccion) ? b.seleccion : []).map(String))).filter((id) => validos.has(id));
      const max = g.max || 15;
      if (sel.length > max) return res(h, 400, { error: 'max', max });
      if (b.accion === 'guardar') {
        await snap.ref.update({ seleccion: sel, guardada: FieldValue.serverTimestamp() });
        return res(h, 200, { ok: true });
      }
      if (!sel.length) return res(h, 400, { error: 'vacia' });
      await snap.ref.update({ seleccion: sel, estado: 'enviada', enviadaEn: FieldValue.serverTimestamp() });

      // Aviso a Otto con los nombres de archivo, listos para buscarlos en Lightroom
      const para = process.env.AVISO_GALERIAS || process.env.AVISO_A || remitente();
      if (para) {
        const archivos = sel.map((id) => ((g.fotos || []).find((f) => f.id === id) || {}).arch || id);
        await conLimite(enviar({
          para,
          asunto: `📸 Selección recibida · ${g.titulo} (${sel.length} fotos)`,
          html: `<p><strong>${esc(g.titulo)}</strong> ha enviado su selección: ${sel.length} de ${max} fotos.</p>
            <p>Para buscarlas en Lightroom (cópialo en el filtro de texto):</p>
            <p style="font-family:monospace;font-size:13px;background:#f3f1ec;padding:10px;">${esc(archivos.join(', '))}</p>
            <p>Las tienes también en el panel de galerías: ottokols.es/crm/galerias.html</p>`,
          texto: `${g.titulo} ha enviado su selección (${sel.length} fotos): ${archivos.join(', ')}`,
        }).catch((e) => console.error('aviso galeria', e.message)), 4000);
      }
      return res(h, 200, { ok: true });
    }
    return res(h, 400, { error: 'accion' });
  } catch (e) {
    console.error('galeria', e);
    return res(h, 500, { error: 'servidor' });
  }
};
