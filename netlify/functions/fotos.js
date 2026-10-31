// Cuaderno de fotos (ottokols.es/cuaderno/) y muro público (mirardespacio.es/muro/).
//
//  GET  ?muro=1            -> público: fotos ya comentadas por Otto que su autor deja publicar
//  GET  (con sesión)       -> {yo, reto, salidas, mias, racha, limites}
//  POST (con sesión) {accion:'subir', tipo:'salida'|'reto'|'taller', refId, url, ancho, alto, texto, nombreMuro, publicable}
//  GET  (con sesión) ?taller=<id> -> {yo, mias}: sus fotos de los ejercicios de después de ese taller
//  POST (con sesión) {accion:'borrar', id}             -> solo mientras está pendiente
//  POST (con sesión) {accion:'publicable', id, valor}  -> el autor decide si sale en el muro
//  POST (con sesión) {accion:'avisos', valor}         -> MD+: recibir o no los emails del reto
//  POST (con sesión) {accion:'compartir', id, valor}   -> retos: si la ven los demás miembros (galería y constancia)
//
// Gamificación sin notas: solo se cuenta CUÁNTOS retos ha hecho cada uno y la racha, nunca si son mejores o peores.
//
// Las fotos se suben directamente del navegador a Cloudinary (ya reducidas a 2000 px);
// aquí se comprueba de verdad lo que ocupan antes de guardarlas.
// Quién entra:
//  - con sesión (Firebase; durante la migración también Netlify Identity): rol member (MD+), participante (solo fotos) o admin
//  - SIN cuenta, con su enlace personal ottokols.es/subir/?c=<clave> (lo manda Otto desde el CRM
//    a la gente de cada salida). Es la forma fácil: sin contraseñas. Solo fotos de salidas.
//  - con sesión y solo el manual de un taller (rol "taller-<id>"): únicamente las fotos de los
//    ejercicios de después de ESE taller (tipo 'taller', refId '<id>-<n>'), desde la página del manual.
// Las fotos de cada persona se reconocen por su email, entre por donde entre.
const { db, FieldValue, conLimite } = require('../lib/firestore');
const { usuarioDe } = require('../lib/cuentas');
const { enviar, esc, remitente } = require('../lib/correo');
const { SALIDA_DIAS, RETOS_GUARDADOS } = require('../lib/fotos-config');
const { MANUALES, urlManual } = require('../lib/manuales');

// ¿Puede subir fotos de los ejercicios de este taller? (tiene su manual, o es Otto)
const tieneManual = (yo, id) => !!(MANUALES[id] && yo && (yo.admin || (yo.manuales || []).includes(id)));
// refId de un ejercicio de taller: '<taller>-<n>' -> {id, n, titulo} o null
function ejercicioTaller(refId) {
  const m = /^([a-z0-9]+)-(\d{1,2})$/.exec(String(refId || ''));
  if (!m || !MANUALES[m[1]]) return null;
  const titulo = (MANUALES[m[1]].despues || [])[Number(m[2]) - 1];
  return titulo ? { id: m[1], n: Number(m[2]), titulo } : null;
}

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
const claveJugador = (n) => String(n || '').trim().replace(/^@+/, '').toLowerCase().replace(/[^\p{L}\p{N}._]+/gu, '_').slice(0, 40);
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
  // Fotos de una salida: solo quien no estaba en espera ni se dio de baja (un no presentado puede tener
  // el estado mal puesto; si sube fotos es que vino, así que se le deja)
  const suyas = new Set(q.docs.map((d) => d.data()).filter((x) => x.status !== 'espera' && x.status !== 'baja').map((x) => x.eventId));
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

// Retos seguidos en los que ha participado. No rompen la racha: el reto abierto y los retos que
// cerraron mientras la persona estaba de baja de MD+ (pausas). mejorRacha es la mejor que ha tenido
// nunca: las medallas de racha se quedan aunque luego la racha se corte.
function calcularRacha(lista, mias, pausas = []) {
  const hechos = new Set(mias.filter((f) => f.tipo === 'reto').map((f) => f.refId));
  const enPausa = (r) => { const fin = r.cierre || r.inicio; return pausas.some((p) => p.desde && p.desde <= fin && fin <= (p.hasta || '9999')); };
  const validos = lista.filter((r) => r.inicio && r.inicio <= hoy());
  let racha = 0;
  for (const r of validos) {
    if (hechos.has(r.id)) racha++;
    else if (retoAbierto(r) || enPausa(r)) continue;
    else break;
  }
  let seguidos = 0, mejorRacha = 0;
  for (const r of validos.slice().reverse()) {
    if (hechos.has(r.id)) { seguidos++; mejorRacha = Math.max(mejorRacha, seguidos); }
    else if (retoAbierto(r) || enPausa(r)) continue;
    else seguidos = 0;
  }
  return { racha, total: hechos.size, mejorRacha };
}

// Pausas (bajas de MD+) de cada persona, por email
async function pausasPorEmail(fs) {
  const q = await fs.collection('people').get();
  const res = {};
  q.docs.forEach((d) => { const p = d.data(); if (p.email && Array.isArray(p.pausas) && p.pausas.length) res[String(p.email).toLowerCase()] = p.pausas; });
  return res;
}

// Retos hechos y racha de cada persona (para las medallas junto al nombre)
async function logros(fs, lista) {
  const [q, pausas] = await Promise.all([fs.collection('fotos').where('tipo', '==', 'reto').get(), pausasPorEmail(fs)]);
  const porEmail = {};
  q.docs.forEach((d) => { const f = d.data(); (porEmail[f.email] = porEmail[f.email] || []).push(f); });
  const res = {};
  Object.entries(porEmail).forEach(([email, fs2]) => {
    const r = calcularRacha(lista, fs2, pausas[email]);
    res[email] = { retos: r.total, racha: r.racha, mejorRacha: r.mejorRacha, fotos: fs2 };
  });
  return res;
}

// Galería interna de los últimos retos cerrados (solo miembros, solo quien acepta compartir)
async function galeria(fs, lista, yo, mapa) {
  const cerrados = lista.filter((r) => r.inicio && r.inicio <= hoy() && !retoAbierto(r)).slice(0, RETOS_GUARDADOS);
  return Promise.all(cerrados.map(async (r) => {
    const q = await fs.collection('fotos').where('refId', '==', r.id).get();
    const fotos = q.docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((f) => f.tipo === 'reto' && f.compartir && f.url && !f.archivada)
      .sort((a, b) => ms(a.creada) - ms(b.creada))
      .map((f) => ({ id: f.id, nombre: f.nombreMuro || 'Anónimo', url: mini(f.url, 700), grande: mini(f.url, 1800),
        comentario: f.comentario || '', texto: f.texto || '', mia: f.email === yo.email,
        retos: (mapa[f.email] || {}).retos || 0, racha: (mapa[f.email] || {}).racha || 0, mejorRacha: (mapa[f.email] || {}).mejorRacha || 0, mejorRacha: (mapa[f.email] || {}).mejorRacha || 0 }));
    return { reto: { id: r.id, titulo: r.titulo, inicio: r.inicio }, fotos };
  }));
}

// Cuadro de constancia: cuántos retos ha hecho cada miembro (que acepta compartir) y su racha
async function constancia(fs, lista, yo, mapa) {
  const filas = Object.entries(mapa).map(([email, x]) => {
    const fs2 = x.fotos, r = { total: x.retos, racha: x.racha, mejorRacha: x.mejorRacha };
    const ultima = fs2.slice().sort((a, b) => ms(b.creada) - ms(a.creada))[0];
    return { nombre: (ultima && ultima.nombreMuro) || 'Anónimo', retos: r.total, racha: r.racha, mejorRacha: r.mejorRacha, yo: email === yo.email,
      visible: fs2.some((f) => f.compartir) };
  }).filter((x) => x.visible || x.yo)
    .sort((a, b) => b.retos - a.retos || b.racha - a.racha || a.nombre.localeCompare(b.nombre, 'es'));
  return filas.map(({ visible, ...x }) => x).slice(0, 40);
}

// Miniatura cuadrada para la cuadrícula del muro
const cuadrada = (url, lado) => String(url || '').replace('/image/upload/', `/image/upload/c_fill,g_auto,w_${lado},h_${lado},q_auto,f_auto/`);

const publica = (f) => ({
  id: f.id, nombre: f.nombreMuro || 'Anónimo', url: cuadrada(f.url, 560), grande: mini(f.url, 1800),
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
        .slice(0, 90)
        .map(publica);
      // Datos públicos: sin Vary por origen y con caché en la CDN (5 min, y sirve la anterior mientras se refresca)
      return res({ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, 200, lista, {
        'Cache-Control': 'public, max-age=60',
        'Netlify-CDN-Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
      });
    }

    let cuerpo = {};
    if (event.httpMethod === 'POST') cuerpo = JSON.parse(event.body || '{}');
    const yo = (await usuarioDe(event, context)) || (await porClave(fs, qs.c || cuerpo.clave));
    if (!yo || !yo.email || !(yo.fotos || (yo.manuales || []).length)) return res(h, 401, { error: 'sesion' });
    // Quien solo tiene el manual de un taller entra aquí únicamente para sus ejercicios de después
    const soloManual = !yo.fotos;
    const esDeTaller = (event.httpMethod === 'GET' && qs.taller) || (cuerpo.accion === 'subir' && cuerpo.tipo === 'taller')
      || ['borrar', 'publicable', 'responder'].includes(cuerpo.accion);
    if (soloManual && !esDeTaller) return res(h, 403, { error: 'solo-manual' });
    const misFotos = async () => (await fs.collection('fotos').where('email', '==', yo.email).get())
      .docs.map((d) => ({ id: d.id, ...d.data() }));

    // ---------- Ejercicios de después de un taller (desde la página del manual) ----------
    if (event.httpMethod === 'GET' && qs.taller) {
      const id = String(qs.taller);
      if (!tieneManual(yo, id)) return res(h, 403, { error: 'sin-manual' });
      const mias = (await misFotos()).filter((f) => f.tipo === 'taller' && f.url && !f.archivada && String(f.refId || '').startsWith(id + '-'));
      return res(h, 200, {
        yo: { nombre: yo.nombre, nombreCorto: yo.nombreCorto || (yo.nombre || '').split(' ')[0], email: yo.email },
        mias: mias.sort((a, b) => ms(b.creada) - ms(a.creada)).map((f) => ({
          id: f.id, refId: f.refId, url: mini(f.url, 900), grande: mini(f.url, 1800), texto: f.texto || '', estado: f.estado,
          comentario: f.comentario || '', publicable: !!f.publicable, enMuro: !!f.enMuro, nombreMuro: f.nombreMuro || '',
          creada: ms(f.creada), hilo: (f.hilo || []).map((m) => ({ de: m.de, texto: m.texto, en: m.en })),
        })),
        limites: { mb: MAX_BYTES / 1048576 },
      });
    }

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
        hechos: Array.from(new Set(mias.filter((f) => f.tipo === 'reto').map((f) => f.refId))),
        guardado: { salidaDias: SALIDA_DIAS, retos: RETOS_GUARDADOS },
        ...(yo.plus ? await (async () => {
          const pref = (await fs.collection('preferencias').doc(yo.email).get()).data() || {};
          let monturas = [];
          if (pref.jugador) {
            const j = await fs.collection('jugadores').doc(claveJugador(pref.jugador)).get();
            monturas = (j.exists && j.data().monturas) || [];
          }
          return { avisosRetos: !pref.sinAvisosRetos, juego: { jugador: pref.jugador || '', monturas } };
        })() : {}),
        ...(yo.plus && qs.vista === 'retos' ? await (async () => {
          const mapa = await logros(fs, lista);
          return { galeria: await galeria(fs, lista, yo, mapa), constancia: await constancia(fs, lista, yo, mapa) };
        })() : {}),
        mias: mias.filter((f) => f.url && !f.archivada).sort((a, b) => ms(b.creada) - ms(a.creada)).map((f) => ({
          id: f.id, tipo: f.tipo, refId: f.refId, donde: f.refNombre || nombres[f.refId] || '', url: mini(f.url, 900),
          grande: mini(f.url, 1800), texto: f.texto || '', estado: f.estado, comentario: f.comentario || '',
          enMuro: !!f.enMuro, publicable: !!f.publicable, compartir: !!f.compartir, destacada: !!f.destacada,
          nombreMuro: f.nombreMuro || '', creada: ms(f.creada), comentadaEn: ms(f.comentadaEn),
          hilo: (f.hilo || []).map((m) => ({ de: m.de, texto: m.texto, en: m.en })),
        })),
        // Quien fue de MD+ y ya no lo es: ve sus retos, medallas y racha en solo lectura (todo queda en pausa)
        exMiembro: !yo.plus && mias.some((f) => f.tipo === 'reto'),
        ...(yo.plus || mias.some((f) => f.tipo === 'reto') ? calcularRacha(lista, mias, (await pausasPorEmail(fs))[yo.email]) : {}),
        limites: { porSalida: POR_SALIDA, pendientes: PENDIENTES_MAX, mb: MAX_BYTES / 1048576 },
      });
    }
    if (event.httpMethod !== 'POST') return res(h, 405, {});

    const b = cuerpo;

    // Enlaza su nombre del juego del fotógrafo para ver aquí sus monturas
    if (b.accion === 'jugador' && yo.plus) {
      const nombre = String(b.nombre || '').trim().replace(/\s+/g, ' ');
      if (nombre && !/^@?[\p{L}\p{N}._ ]{2,24}$/u.test(nombre)) return res(h, 400, { error: 'nombre' });
      await fs.collection('preferencias').doc(yo.email).set({ jugador: nombre }, { merge: true });
      const j = nombre ? await fs.collection('jugadores').doc(claveJugador(nombre)).get() : null;
      return res(h, 200, { jugador: nombre, monturas: (j && j.exists && j.data().monturas) || [], existe: !!(j && j.exists) });
    }

    if (b.accion === 'avisos' && yo.plus) {
      await fs.collection('preferencias').doc(yo.email).set({ sinAvisosRetos: !b.valor, cambiado: FieldValue.serverTimestamp() }, { merge: true });
      return res(h, 200, { ok: true });
    }

    if (b.accion === 'borrar' || b.accion === 'publicable' || b.accion === 'compartir') {
      const ref = fs.collection('fotos').doc(String(b.id || ''));
      const snap = await ref.get();
      if (!snap.exists || snap.data().email !== yo.email) return res(h, 404, { error: 'no-existe' });
      if (b.accion === 'borrar') {
        if (snap.data().estado !== 'pendiente') return res(h, 400, { error: 'ya-comentada' });
        await ref.delete();
      } else if (b.accion === 'compartir') {
        await ref.update({ compartir: !!b.valor });
      } else {
        const valor = !!b.valor;
        await ref.update({ publicable: valor, ...(valor ? {} : { enMuro: false }) });
      }
      return res(h, 200, { ok: true });
    }

    // Respuesta de la persona en el hilo de una de sus fotos comentadas (solo ella y Otto lo ven)
    if (b.accion === 'responder') {
      const ref = fs.collection('fotos').doc(String(b.id || ''));
      const snap = await ref.get();
      if (!snap.exists || snap.data().email !== yo.email) return res(h, 404, { error: 'no-existe' });
      const f = snap.data();
      if (!f.comentario) return res(h, 400, { error: 'sin-comentario' });
      const texto = String(b.texto || '').replace(/\r/g, '').trim().slice(0, 1500);
      if (!texto) return res(h, 400, { error: 'vacio' });
      if ((f.hilo || []).length >= 60) return res(h, 400, { error: 'hilo-lleno' });
      await ref.update({ hilo: FieldValue.arrayUnion({ de: 'persona', texto, en: Date.now(), origen: 'web' }), sinLeer: true, respondidoEn: FieldValue.serverTimestamp() });
      const para = process.env.AVISO_A || remitente();
      if (para) {
        await conLimite(enviar({
          para, asunto: `💬 Respuesta en una foto · ${f.nombreMuro || yo.nombre || yo.email}`,
          html: `<p><strong>${esc(f.nombreMuro || yo.nombre || '')}</strong> (${esc(yo.email)}) ha respondido en el hilo de su foto${f.refNombre ? ` de <em>${esc(f.refNombre)}</em>` : ''}:</p>
            <blockquote style="border-left:3px solid #e8347a;margin:12px 0;padding-left:12px;">${esc(texto).replace(/\n/g, '<br>')}</blockquote>
            <p><img src="${mini(f.url, 600)}" width="300" style="max-width:100%;height:auto;"></p>
            <p>Contéstale desde el CRM, pestaña Fotos.</p>`,
          texto: `${f.nombreMuro || yo.email} ha respondido en su foto: ${texto}\n\nContéstale desde el CRM, pestaña Fotos.`,
        }).catch((e) => console.error('aviso respuesta', e.message)), 4000);
      }
      return res(h, 200, { ok: true });
    }

    if (b.accion !== 'subir') return res(h, 400, { error: 'accion' });
    const tipo = b.tipo === 'reto' ? 'reto' : b.tipo === 'taller' ? 'taller' : 'salida';
    if (soloManual && tipo !== 'taller') return res(h, 403, { error: 'solo-manual' });
    let enlace = null;
    const refId = String(b.refId || '');
    const url = String(b.url || '');
    let refNombre = '';
    let refFecha = hoy();
    let docId = null;
    const mias = await misFotos();
    if (mias.filter((f) => f.estado === 'pendiente').length >= PENDIENTES_MAX) return res(h, 400, { error: 'demasiadas' });

    if (tipo === 'reto') {
      if (!yo.plus) return res(h, 403, { error: 'solo-plus' });
      const r = await fs.collection('retos').doc(refId).get();
      if (!r.exists || !retoAbierto(r.data())) return res(h, 400, { error: 'reto-cerrado' });
      refNombre = r.data().titulo || 'Reto';
      refFecha = r.data().cierre || r.data().inicio || hoy();
      docId = `${refId}_${yo.id}`; // una foto por reto (se puede cambiar mientras no esté comentada)
      const previa = mias.find((f) => f.id === docId);
      if (previa && previa.estado !== 'pendiente') return res(h, 400, { error: 'ya-comentada' });
    } else if (tipo === 'taller') {
      const ej = ejercicioTaller(refId);
      if (!ej || !tieneManual(yo, ej.id)) return res(h, 403, { error: 'sin-manual' });
      refNombre = `Taller ${MANUALES[ej.id].titulo} · ${ej.titulo}`;
      enlace = urlManual(ej.id);
      docId = `${refId}_${yo.id}`; // una foto por ejercicio (se puede cambiar mientras no esté comentada)
      const previa = mias.find((f) => f.id === docId);
      if (previa && previa.estado !== 'pendiente') return res(h, 400, { error: 'ya-comentada' });
    } else {
      const s = (await salidasDe(fs, yo)).find((x) => x.id === refId);
      if (!s) return res(h, 400, { error: 'salida' });
      refNombre = [s.nombre, s.zona].filter(Boolean).join(' · ');
      refFecha = s.fecha;
      if (mias.filter((f) => f.refId === refId).length >= POR_SALIDA) return res(h, 400, { error: 'max-salida' });
    }

    const fallo = await comprobarImagen(url);
    if (fallo) return res(h, 400, { error: fallo });

    const foto = {
      userId: yo.id, email: yo.email, nombreCuenta: yo.nombre, origen: yo.porEnlace ? 'enlace' : 'cuenta',
      personaId: yo.personaId || null, tipo, refId, refNombre, refFecha, url,
      ancho: Number(b.ancho) || null, alto: Number(b.alto) || null,
      texto: limpio(b.texto, 600),
      nombreMuro: limpio(b.nombreMuro, 40) || yo.nombre || 'Anónimo',
      publicable: !!b.publicable,
      compartir: tipo === 'reto' && !!b.compartir,
      estado: 'pendiente', comentario: '', enMuro: false, destacada: false,
      ...(enlace ? { enlace } : {}),
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
