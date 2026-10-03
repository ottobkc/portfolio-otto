// Cuaderno de fotos (ottokols.es/cuaderno/) y muro público (mirardespacio.es/muro/).
//
//  GET  ?muro=1            -> público: fotos ya comentadas por Otto que su autor deja publicar
//  GET  (con sesión)       -> {yo, reto, salidas, mias, racha, limites}
//  POST (con sesión) {accion:'subir', tipo:'salida'|'reto', refId, url, ancho, alto, texto, nombreMuro, publicable}
//  POST (con sesión) {accion:'borrar', id}             -> solo mientras está pendiente
//  POST (con sesión) {accion:'publicable', id, valor}  -> el autor decide si sale en el muro
//
// Las fotos se suben directamente del navegador a Cloudinary (ya reducidas a 2000 px);
// aquí se comprueba de verdad lo que ocupan antes de guardarlas.
// Quién entra:
//  - con sesión de Netlify Identity: rol member (MD+), participante (solo fotos) o admin
//  - SIN cuenta, con su enlace personal ottokols.es/subir/?c=<clave> (lo manda Otto desde el CRM
//    a la gente de cada salida). Es la forma fácil: sin contraseñas. Solo fotos de salidas.
// Las fotos de cada persona se reconocen por su email, entre por donde entre.
const { db, FieldValue, conLimite } = require('../lib/firestore');
const { usuarioDe } = require('../lib/identidad');
const { enviar, esc, remitente } = require('../lib/correo');

const MAX_BYTES = 6 * 1024 * 1024;
const POR_SALIDA = 5;
const PENDIENTES_MAX = 15;
const DIAS_SALIDA = 30; // se pueden subir fotos de las salidas de los últimos 30 días
const URL_OK = /^https:\/\/res\.cloudinary\.com\/dybxateci\/image\/upload\/(?:v\d+\/)?[\w\-/]+\.(?:jpe?g|png|webp)$/i;

const ORIGENES = /^https:\/\/((www\.)?mirardespacio\.es|([a-z0-9-]+--)?mirar-despacio\.netlify\.app|(www\.)?ottokols\.es)$/;
const cab = (o) => ({
  'Access-Control-Allow-Origin': ORIGENES.test(o || '') ? o : 'https://mirardespacio.es',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
  Vary: 'Origin',
});
const CLAVE_OK = /^[A-Za-z0-9]{16,40}$/;
const res = (h, code, obj, extra) => ({ statusCode: code, headers: { ...h, ...(extra || {}) }, body: JSON.stringify(obj) });
const ms = (t) => (t && t.toMillis ? t.toMillis() : t ? new Date(t).getTime() : 0);
const limpio = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const hoy = () => new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).slice(0, 10);

// Miniatura servida por Cloudinary (más ligera para el muro y las listas)
const mini = (url, ancho) => String(url || '').replace('/image/upload/', `/image/upload/c_limit,w_${ancho},q_auto,f_auto/`);

async function retos(fs) {
  const q = await fs.collection('retos').get();
  return q.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.inicio || '').localeCompare(String(a.inicio || '')));
}
const retoAbierto = (r) => r && r.activo && (!r.cierre || r.cierre >= hoy());

// Persona del CRM a partir de su enlace personal
async function porClave(fs, clave) {
  if (!CLAVE_OK.test(clave || '')) return null;
  const q = await fs.collection('people').where('claveFotos', '==', clave).limit(1).get();
  if (q.empty) return null;
  const d = q.docs[0], p = d.data();
  if (!p.email) return null;
  return {
    id: 'p_' + d.id, personaId: d.id, email: String(p.email).toLowerCase(), nombre: [p.name, p.apellidos].filter(Boolean).join(' '),
    nombreCorto: p.name || '', roles: [], plus: false, fotos: true, porEnlace: true,
  };
}

// Solo las salidas recientes a las que esa persona estaba apuntada en el CRM (no en lista de espera).
// Así, quien tiene MD+ online y no viene a salidas no ve nada de salidas.
async function salidasDe(fs, yo) {
  let personaId = yo.personaId;
  if (!personaId) {
    const variantes = Array.from(new Set([yo.email, yo.emailOriginal].filter(Boolean)));
    const q = await fs.collection('people').where('email', 'in', variantes).limit(1).get();
    if (q.empty) return [];
    personaId = q.docs[0].id;
  }
  const [todas, q] = await Promise.all([
    salidasRecientes(fs), fs.collection('signups').where('personId', '==', personaId).get(),
  ]);
  const suyas = new Set(q.docs.map((d) => d.data()).filter((x) => x.status !== 'espera').map((x) => x.eventId));
  return todas.filter((s) => suyas.has(s.id));
}

async function salidasRecientes(fs) {
  const desde = new Date(Date.now() - DIAS_SALIDA * 864e5).toISOString().slice(0, 10);
  const q = await fs.collection('events').where('date', '>=', desde).get();
  return q.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((e) => e.date && e.date <= hoy())
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((e) => ({ id: e.id, nombre: e.name || 'Salida', fecha: e.date, zona: e.location || '' }));
}

// Retos seguidos en los que ha participado (el reto abierto aún no rompe la racha)
function calcularRacha(lista, mias) {
  const hechos = new Set(mias.filter((f) => f.tipo === 'reto').map((f) => f.refId));
  let racha = 0;
  for (const r of lista) {
    if (!r.inicio || r.inicio > hoy()) continue;
    if (hechos.has(r.id)) racha++;
    else if (retoAbierto(r)) continue;
    else break;
  }
  return { racha, total: hechos.size };
}

const publica = (f) => ({
  id: f.id, nombre: f.nombreMuro || 'Anónimo', url: mini(f.url, 1000), grande: mini(f.url, 1800),
  ancho: f.ancho || null, alto: f.alto || null, comentario: f.comentario || '', donde: f.refNombre || '',
  tipo: f.tipo, destacada: !!f.destacada, fecha: ms(f.comentadaEn),
});

async function comprobarImagen(url) {
  if (!URL_OK.test(url)) return 'url';
  try {
    const r = await fetch(url, { method: 'HEAD' });
    if (!r.ok) return 'no-existe';
    if (!/^image\//.test(r.headers.get('content-type') || '')) return 'tipo';
    const n = Number(r.headers.get('content-length') || 0);
    if (n > MAX_BYTES) return 'grande';
    return null;
  } catch (e) {
    return 'no-existe';
  }
}

exports.handler = async (event, context) => {
  const h = cab(event.headers.origin);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: h, body: '' };
  try {
    const fs = db();
    const qs = event.queryStringParameters || {};

    // ---------- Muro público ----------
    if (event.httpMethod === 'GET' && qs.muro) {
      const q = await fs.collection('fotos').where('enMuro', '==', true).get();
      const lista = q.docs.map((d) => ({ id: d.id, ...d.data() }))
        .filter((f) => f.publicable)
        .sort((a, b) => (b.destacada - a.destacada) || (ms(b.comentadaEn) - ms(a.comentadaEn)))
        .slice(0, 90).map(publica);
      return res(h, 200, lista, { 'Cache-Control': 'public, max-age=120' });
    }

    let cuerpo = {};
    if (event.httpMethod === 'POST') cuerpo = JSON.parse(event.body || '{}');
    const yo = usuarioDe(context) || (await porClave(fs, qs.c || cuerpo.clave));
    if (!yo || !yo.fotos || !yo.email) return res(h, 401, { error: 'sesion' });
    const misFotos = async () => (await fs.collection('fotos').where('email', '==', yo.email).get())
      .docs.map((d) => ({ id: d.id, ...d.data() }));

    // ---------- Mi cuaderno ----------
    if (event.httpMethod === 'GET') {
      const [lista, salidas, mias] = await Promise.all([retos(fs), salidasDe(fs, yo), misFotos()]);
      const abierto = lista.find(retoAbierto) || null;
      const reto = abierto && {
        id: abierto.id, titulo: abierto.titulo, enunciado: abierto.enunciado || '', pista: abierto.pista || '',
        cierre: abierto.cierre || '', participantes: (await fs.collection('fotos').where('refId', '==', abierto.id).count().get()).data().count,
      };
      const nombres = Object.fromEntries(lista.map((r) => [r.id, r.titulo]));
      return res(h, 200, {
        yo: { nombre: yo.nombre, nombreCorto: yo.nombreCorto || (yo.nombre || '').split(' ')[0], email: yo.email, plus: yo.plus, porEnlace: !!yo.porEnlace },
        reto: yo.plus ? reto : reto && { titulo: reto.titulo, bloqueado: true },
        historial: yo.plus ? lista.filter((r) => r.inicio && r.inicio <= hoy())
          .map((r) => ({ id: r.id, titulo: r.titulo, inicio: r.inicio, cierre: r.cierre || '', abierto: retoAbierto(r) })) : [],
        salidas,
        mias: mias.sort((a, b) => ms(b.creada) - ms(a.creada)).map((f) => ({
          id: f.id, tipo: f.tipo, refId: f.refId, donde: f.refNombre || nombres[f.refId] || '', url: mini(f.url, 900),
          grande: mini(f.url, 1800), texto: f.texto || '', estado: f.estado, comentario: f.comentario || '',
          enMuro: !!f.enMuro, publicable: !!f.publicable, destacada: !!f.destacada, creada: ms(f.creada), comentadaEn: ms(f.comentadaEn),
        })),
        ...(yo.plus ? calcularRacha(lista, mias) : {}),
        limites: { porSalida: POR_SALIDA, pendientes: PENDIENTES_MAX, mb: MAX_BYTES / 1048576 },
      });
    }
    if (event.httpMethod !== 'POST') return res(h, 405, {});

    const b = cuerpo;

    if (b.accion === 'borrar' || b.accion === 'publicable') {
      const ref = fs.collection('fotos').doc(String(b.id || ''));
      const snap = await ref.get();
      if (!snap.exists || snap.data().email !== yo.email) return res(h, 404, { error: 'no-existe' });
      if (b.accion === 'borrar') {
        if (snap.data().estado !== 'pendiente') return res(h, 400, { error: 'ya-comentada' });
        await ref.delete();
      } else {
        const valor = !!b.valor;
        await ref.update({ publicable: valor, ...(valor ? {} : { enMuro: false }) });
      }
      return res(h, 200, { ok: true });
    }

    if (b.accion !== 'subir') return res(h, 400, { error: 'accion' });
    const tipo = b.tipo === 'reto' ? 'reto' : 'salida';
    const refId = String(b.refId || '');
    const url = String(b.url || '');
    let refNombre = '';
    let docId = null;
    const mias = await misFotos();
    if (mias.filter((f) => f.estado === 'pendiente').length >= PENDIENTES_MAX) return res(h, 400, { error: 'demasiadas' });

    if (tipo === 'reto') {
      if (!yo.plus) return res(h, 403, { error: 'solo-plus' });
      const r = await fs.collection('retos').doc(refId).get();
      if (!r.exists || !retoAbierto(r.data())) return res(h, 400, { error: 'reto-cerrado' });
      refNombre = r.data().titulo || 'Reto';
      docId = `${refId}_${yo.id}`; // una foto por reto (se puede cambiar mientras no esté comentada)
      const previa = mias.find((f) => f.id === docId);
      if (previa && previa.estado !== 'pendiente') return res(h, 400, { error: 'ya-comentada' });
    } else {
      const s = (await salidasDe(fs, yo)).find((x) => x.id === refId);
      if (!s) return res(h, 400, { error: 'salida' });
      refNombre = [s.nombre, s.zona].filter(Boolean).join(' · ');
      if (mias.filter((f) => f.refId === refId).length >= POR_SALIDA) return res(h, 400, { error: 'max-salida' });
    }

    const fallo = await comprobarImagen(url);
    if (fallo) return res(h, 400, { error: fallo });

    const foto = {
      userId: yo.id, email: yo.email, nombreCuenta: yo.nombre, origen: yo.porEnlace ? 'enlace' : 'cuenta',
      personaId: yo.personaId || null, tipo, refId, refNombre, url,
      ancho: Number(b.ancho) || null, alto: Number(b.alto) || null,
      texto: limpio(b.texto, 600),
      nombreMuro: limpio(b.nombreMuro, 40) || yo.nombre || 'Anónimo',
      publicable: !!b.publicable,
      estado: 'pendiente', comentario: '', enMuro: false, destacada: false,
      creada: FieldValue.serverTimestamp(),
    };
    const ref = docId ? fs.collection('fotos').doc(docId) : fs.collection('fotos').doc();
    await ref.set(foto);

    // Aviso a Otto (no bloquea si falla)
    const para = process.env.AVISO_A || remitente();
    if (para) {
      await conLimite(enviar({
        para, asunto: `📷 Foto nueva en el cuaderno · ${foto.nombreMuro}`,
        html: `<p><strong>${esc(foto.nombreMuro)}</strong> (${esc(yo.email)}) ha subido una foto de <em>${esc(refNombre)}</em>.</p>
          ${foto.texto ? `<p>“${esc(foto.texto)}”</p>` : ''}
          <p><img src="${mini(url, 800)}" width="400" style="max-width:100%;height:auto;"></p>
          <p>Coméntala desde el CRM, pestaña Fotos.</p>`,
        texto: `${foto.nombreMuro} ha subido una foto de ${refNombre}. Coméntala desde el CRM, pestaña Fotos.`,
      }).catch((e) => console.error('aviso foto', e.message)), 4000);
    }
    return res(h, 200, { ok: true, id: ref.id });
  } catch (e) {
    console.error('fotos', e);
    return res(h, 500, { error: 'servidor' });
  }
};
