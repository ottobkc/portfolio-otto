// Panel de galerías de clientes (ottokols.es/crm/galerias.html). Solo Otto: el panel manda su sesión
// de Firebase (Authorization: Bearer <idToken>) y aquí se comprueba que es la cuenta de administración.
//
//  {accion:'listar'}                                   -> resumen de todas las galerías
//  {accion:'ver', id}                                  -> una galería completa (fotos, selección, finales)
//  {accion:'crear', titulo, subtitulo, max, codigo?}   -> nueva galería con su código de acceso
//  {accion:'editar', id, titulo, subtitulo, max, codigo}
//  {accion:'firmar', id, finales?}                     -> permiso para subir a Cloudinary desde el navegador
//  {accion:'anadir', id, fotos:[{public_id, format, width, height, arch}]}
//  {accion:'quitar', id, fotoId} / {accion:'portada', id, fotoId}
//  {accion:'estado', id, estado}                       -> p. ej. reabrir la selección
//  {accion:'subir-final', id, nombre, tipo}            -> URL temporal para subir una HD a R2
//  {accion:'confirmar-final', id, clave, nombre, bytes, previa, previaFormato}
//  {accion:'quitar-final', id, clave}
//  {accion:'entregar', id}                             -> pasa a "entregada" con caducidad
//  {accion:'borrar-previas', id}                       -> libera Cloudinary (deja la portada)
//  {accion:'borrar', id}                               -> borra todo: Cloudinary, R2 y la ficha
const crypto = require('crypto');
const { getAuth } = require('firebase-admin/auth');
const { db, FieldValue } = require('../lib/firestore');
const G = require('../lib/galerias');

const ADMIN = (process.env.CRM_ADMIN || 'ottobkc@gmail.com').toLowerCase();
const res = (code, obj) => ({ statusCode: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(obj) });
const MAX_FOTOS = 400;

function resumen(id, g) {
  return {
    id, titulo: g.titulo || '', subtitulo: g.subtitulo || '', codigo: g.codigo, max: g.max || 15, estado: g.estado,
    fotos: (g.fotos || []).length, elegidas: (g.seleccion || []).length, finales: (g.finales || []).length,
    creada: G.ms(g.creada), vista: G.ms(g.vista), enviadaEn: G.ms(g.enviadaEn), entregadaEn: G.ms(g.entregadaEn), caduca: G.ms(g.caduca),
  };
}

async function codigoLibre(fs, deseado, propio) {
  const c = deseado ? G.normalCodigo(deseado) : G.nuevoCodigo();
  if (!G.CODIGO_OK.test(c)) return { error: 'codigo-formato' };
  const q = await fs.collection('galerias').where('codigo', '==', c).limit(2).get();
  if (q.docs.some((d) => d.id !== propio)) return deseado ? { error: 'codigo-usado' } : codigoLibre(fs, null, propio);
  return { codigo: c };
}

const maxValido = (n) => Math.min(200, Math.max(1, Math.round(Number(n) || 15)));

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return res(405, {});
  try {
    const fs = db();
    const token = (event.headers.authorization || '').replace(/^Bearer\s+/i, '');
    let quien;
    try { quien = await getAuth().verifyIdToken(token); } catch (e) { return res(401, { error: 'sesion' }); }
    if ((quien.email || '').toLowerCase() !== ADMIN) return res(403, { error: 'no-admin' });

    const b = JSON.parse(event.body || '{}');
    const col = fs.collection('galerias');

    if (b.accion === 'listar') {
      const q = await col.get();
      const lista = q.docs.filter((d) => !d.data().archivada).map((d) => resumen(d.id, d.data())).sort((a, z) => z.creada - a.creada);
      return res(200, { galerias: lista, cloudinary: G.hayCloudinary(), r2: G.hayR2() });
    }

    if (b.accion === 'crear') {
      const titulo = G.limpio(b.titulo, 80);
      if (!titulo) return res(400, { error: 'titulo' });
      const c = await codigoLibre(fs, b.codigo, null);
      if (c.error) return res(400, c);
      const ref = col.doc();
      await ref.set({
        titulo, subtitulo: G.limpio(b.subtitulo, 120), max: maxValido(b.max), codigo: c.codigo,
        estado: 'seleccion', fotos: [], seleccion: [], finales: [], portada: null,
        creada: FieldValue.serverTimestamp(),
      });
      return res(200, { id: ref.id, codigo: c.codigo });
    }

    // A partir de aquí todas las acciones son sobre una galería concreta
    const ref = col.doc(String(b.id || ''));
    const snap = await ref.get();
    if (!snap.exists) return res(404, { error: 'no-existe' });
    const g = snap.data();
    const fotos = g.fotos || [];

    if (b.accion === 'ver') {
      return res(200, {
        ...resumen(snap.id, g), portada: g.portada,
        fotos: fotos.map((f) => ({ ...f, mini: G.urlPrevia(f, 'mini') })),
        seleccion: g.seleccion || [],
        finales: (g.finales || []).map((f) => ({ ...f, mini: f.previa ? G.urlPrevia({ id: f.previa, formato: f.previaFormato }, 'final') : null })),
      });
    }

    if (b.accion === 'editar') {
      const cambios = {};
      if (b.titulo != null) { cambios.titulo = G.limpio(b.titulo, 80); if (!cambios.titulo) return res(400, { error: 'titulo' }); }
      if (b.subtitulo != null) cambios.subtitulo = G.limpio(b.subtitulo, 120);
      if (b.max != null) cambios.max = maxValido(b.max);
      if (b.codigo != null && G.normalCodigo(b.codigo) !== g.codigo) {
        const c = await codigoLibre(fs, b.codigo, snap.id);
        if (c.error) return res(400, c);
        cambios.codigo = c.codigo;
      }
      await ref.update(cambios);
      return res(200, { ok: true, ...cambios });
    }

    if (b.accion === 'firmar') {
      if (!G.hayCloudinary()) return res(503, { error: 'sin-cloudinary' });
      return res(200, G.firmaSubida(b.finales ? `${snap.id}/finales` : snap.id));
    }

    if (b.accion === 'anadir') {
      // En transacción: el panel sube en paralelo y varios lotes pueden llegar a la vez
      const recibidas = (Array.isArray(b.fotos) ? b.fotos : []).map((f) => ({
        id: String(f.public_id || ''), formato: /^(jpe?g|png|webp)$/i.test(f.format || '') ? String(f.format).toLowerCase() : 'jpg',
        ancho: Number(f.width) || null, alto: Number(f.height) || null, arch: G.sinExtension(G.nombreArchivo(f.arch)),
      })).filter((f) => f.id.startsWith(`${G.CARPETA}/${snap.id}/`));
      const r = await fs.runTransaction(async (t) => {
        const d = (await t.get(ref)).data();
        const ya = d.fotos || [];
        const nuevas = recibidas.filter((f) => !ya.some((x) => x.id === f.id));
        if (ya.length + nuevas.length > MAX_FOTOS) return { error: 'demasiadas' };
        // Se ordenan por nombre de archivo: el orden de la cámara es el orden de la sesión
        const todas = ya.concat(nuevas).sort((a2, z2) => String(a2.arch).localeCompare(String(z2.arch), 'es', { numeric: true }));
        t.update(ref, { fotos: todas, ...(d.portada ? {} : { portada: (todas[0] || {}).id || null }) });
        return { total: todas.length };
      });
      if (r.error) return res(400, { error: r.error, max: MAX_FOTOS });
      return res(200, { ok: true, total: r.total });
    }

    if (b.accion === 'quitar') {
      const id = String(b.fotoId || '');
      await G.borrarPrevia(id).catch(() => {});
      await ref.update({
        fotos: fotos.filter((f) => f.id !== id),
        seleccion: (g.seleccion || []).filter((x) => x !== id),
        ...(g.portada === id ? { portada: (fotos.find((f) => f.id !== id) || {}).id || null } : {}),
      });
      return res(200, { ok: true });
    }

    if (b.accion === 'portada') {
      if (!fotos.some((f) => f.id === b.fotoId)) return res(400, { error: 'foto' });
      await ref.update({ portada: b.fotoId });
      return res(200, { ok: true });
    }

    if (b.accion === 'estado') {
      if (!G.ESTADOS.includes(b.estado)) return res(400, { error: 'estado' });
      await ref.update({ estado: b.estado });
      return res(200, { ok: true });
    }

    if (b.accion === 'subir-final') {
      if (!G.hayR2()) return res(503, { error: 'sin-r2' });
      const nombre = G.nombreArchivo(b.nombre) || 'foto.jpg';
      const clave = `${G.CARPETA}/${snap.id}/${crypto.randomBytes(6).toString('hex')}-${nombre}`;
      return res(200, { clave, url: G.urlR2('PUT', clave, 3600) });
    }

    if (b.accion === 'confirmar-final') {
      const clave = String(b.clave || '');
      if (!clave.startsWith(`${G.CARPETA}/${snap.id}/`)) return res(400, { error: 'clave' });
      // Comprueba que la foto llegó de verdad a R2 y cuánto ocupa
      const cabeza = await fetch(G.urlR2('HEAD', clave, 300), { method: 'HEAD' });
      if (!cabeza.ok) return res(400, { error: 'no-subida' });
      const final = {
        clave, nombre: G.nombreArchivo(b.nombre) || 'foto.jpg', bytes: Number(cabeza.headers.get('content-length')) || Number(b.bytes) || 0,
        previa: b.previa ? String(b.previa) : null, previaFormato: b.previaFormato ? String(b.previaFormato) : 'jpg',
      };
      const r = await fs.runTransaction(async (t) => {
        const d = (await t.get(ref)).data();
        const antes = d.finales || [];
        const vieja = antes.find((f) => f.nombre === final.nombre) || null;
        const finales = antes.filter((f) => f.nombre !== final.nombre).concat([final])
          .sort((a2, z2) => a2.nombre.localeCompare(z2.nombre, 'es', { numeric: true }));
        t.update(ref, { finales });
        return { vieja, total: finales.length };
      });
      // Si había otra con el mismo nombre (una versión corregida), se borra la anterior
      if (r.vieja && r.vieja.clave !== final.clave) {
        await G.borrarR2(r.vieja.clave).catch(() => {});
        if (r.vieja.previa) await G.borrarPrevia(r.vieja.previa).catch(() => {});
      }
      return res(200, { ok: true, total: r.total, reemplazada: !!r.vieja });
    }

    if (b.accion === 'quitar-final') {
      const f = (g.finales || []).find((x) => x.clave === b.clave);
      if (!f) return res(404, { error: 'no-existe' });
      await G.borrarR2(f.clave).catch(() => {});
      if (f.previa) await G.borrarPrevia(f.previa).catch(() => {});
      await ref.update({ finales: (g.finales || []).filter((x) => x.clave !== b.clave) });
      return res(200, { ok: true });
    }

    if (b.accion === 'entregar') {
      if (!(g.finales || []).length) return res(400, { error: 'sin-finales' });
      const dias = Math.min(365, Math.max(1, Number(b.dias) || G.DIAS_ENTREGA));
      await ref.update({ estado: 'entregada', entregadaEn: FieldValue.serverTimestamp(), caduca: new Date(Date.now() + dias * 864e5) });
      return res(200, { ok: true });
    }

    if (b.accion === 'borrar-previas') {
      const quedan = fotos.filter((f) => f.id === g.portada);
      await G.borrarPrevia(fotos.filter((f) => f.id !== g.portada).map((f) => f.id)).catch((e) => console.error('borrar previas', e.message));
      await ref.update({ fotos: quedan, seleccion: [], seleccionGuardada: (g.seleccion || []).map((id) => (fotos.find((f) => f.id === id) || {}).arch || id) });
      return res(200, { ok: true });
    }

    if (b.accion === 'borrar') {
      await G.borrarPrevias(snap.id).catch((e) => console.error('borrar previas', e.message));
      for (const f of g.finales || []) await G.borrarR2(f.clave).catch(() => {});
      await ref.delete();
      return res(200, { ok: true });
    }

    return res(400, { error: 'accion' });
  } catch (e) {
    console.error('galerias-admin', e);
    return res(500, { error: 'servidor' });
  }
};
