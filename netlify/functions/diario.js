// Diario de salidas por tu cuenta (Mirar Despacio+): cada miembro apunta cuándo y por dónde salió a
// hacer fotos, con qué cámara, cuántas hizo y con cuántas se queda. De ahí salen sus cifras del mes,
// la racha de meses seguidos y las zonas que lleva recorridas.
//
//  GET  (con sesión)                                   -> { entradas, resumen }
//  POST (con sesión) {accion:'apuntar', fecha, ciudad, zonaId | zona, camara, hechas, quedadas, nota}
//  POST (con sesión) {accion:'borrar', id}
//
// Las capitales de provincia tienen sus barrios céntricos (netlify/lib/zonas.js, generado por
// herramientas/zonas.py); Madrid además un mapita. Siempre se puede escribir otra zona a mano.
// Quien tiene «vino» en una salida de Mirar Despacio suma las zonas de esa salida (lib/salidas-barrios.js).
// Solo para MD+ (y Otto).
const { db, FieldValue } = require('../lib/firestore');
const { usuarioDe } = require('../lib/cuentas');
const ZONAS = require('../lib/zonas');
const SALIDAS_BARRIOS = require('../lib/salidas-barrios');

const ORIGENES = /^https:\/\/((www\.)?mirardespacio\.es|([a-z0-9-]+--)?mirar-despacio\.netlify\.app|(www\.)?ottokols\.es)$/;
const cab = (o) => ({
  'Access-Control-Allow-Origin': ORIGENES.test(o || '') ? o : 'https://mirardespacio.es',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin',
});
const res = (h, code, obj) => ({ statusCode: code, headers: h, body: JSON.stringify(obj) });
const limpio = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const hoy = () => new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).slice(0, 10);
const entero = (v, max) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0; };
const CAMARAS = ['movil', 'compacta', 'sin-espejo', 'reflex', 'analogica', 'otra'];
const MAX_DIA = 5;
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// Ciudad conocida (por nombre, sin importar tildes ni mayúsculas) -> {ciudad, zonas}
const CIUDAD = {};
for (const c of ZONAS) CIUDAD[norm(c.ciudad)] = c;
const ciudadDe = (s) => CIUDAD[norm(s)] || null;
const MADRID = ciudadDe('Madrid');

function resumen(entradas, deSalidas = []) {
  const mes = hoy().slice(0, 7);
  const delMes = entradas.filter((e) => e.fecha.slice(0, 7) === mes);
  const suma = (l, k) => l.reduce((n, e) => n + (Number(e[k]) || 0), 0);
  const tasa = (l) => { const h = suma(l, 'hechas'); return h ? Math.round((suma(l, 'quedadas') / h) * 1000) / 10 : null; };
  // Racha: meses seguidos (hasta este o el anterior) con al menos una salida
  const meses = new Set(entradas.map((e) => e.fecha.slice(0, 7)));
  let racha = 0;
  let [y, m] = mes.split('-').map(Number);
  if (!meses.has(mes)) { m -= 1; if (!m) { m = 12; y -= 1; } }
  while (meses.has(`${y}-${String(m).padStart(2, '0')}`)) { racha++; m -= 1; if (!m) { m = 12; y -= 1; } }
  // Zonas recorridas por ciudad: ids de la lista y, aparte, las escritas a mano
  const porCiudad = {};
  const anotar = (ciudad, id, nombre) => {
    const c = porCiudad[ciudad] = porCiudad[ciudad] || { ciudad, ids: new Set(), libres: {} };
    if (id) c.ids.add(id); else if (nombre) c.libres[norm(nombre)] = c.libres[norm(nombre)] || nombre;
  };
  for (const e of entradas) anotar(e.ciudad, e.zonaId, e.zonaId ? '' : e.zona);
  for (const id of deSalidas) anotar('Madrid', id);
  const zonas = Object.values(porCiudad).map((c) => {
    const lista = ciudadDe(c.ciudad);
    return { ciudad: c.ciudad, ids: [...c.ids], libres: Object.values(c.libres), total: lista ? lista.zonas.length : null };
  });
  const nZonas = zonas.reduce((n, c) => n + c.ids.length + c.libres.length, 0);
  return {
    mes: { salidas: delMes.length, hechas: suma(delMes, 'hechas'), quedadas: suma(delMes, 'quedadas'), tasa: tasa(delMes) },
    total: { salidas: entradas.length, hechas: suma(entradas, 'hechas'), quedadas: suma(entradas, 'quedadas'), tasa: tasa(entradas) },
    racha, zonas, nZonas, conMD: [...new Set(deSalidas)],
    ciudad: entradas[0] ? entradas[0].ciudad : (deSalidas.length ? 'Madrid' : ''),
  };
}

exports.handler = async (event, context) => {
  const h = cab((event.headers || {}).origin);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: h, body: '' };
  const yo = await usuarioDe(event, context);
  if (!yo) return res(h, 401, { error: 'sesion' });
  const roles = yo.roles || [];
  if (!roles.includes('member') && !roles.includes('admin')) return res(h, 403, { error: 'solo-plus' });
  const fs = db();
  const col = fs.collection('diario');
  const mias = async () => {
    const q = await col.where('email', '==', yo.email).get();
    return q.docs.map((d) => ({ id: d.id, ...d.data(), creada: undefined }))
      .sort((a, b) => (b.fecha > a.fecha ? 1 : b.fecha < a.fecha ? -1 : 0)).slice(0, 500);
  };
  // Zonas de Madrid de las salidas de Mirar Despacio a las que consta que vino («vino» en el CRM)
  const zonasDeSalidas = async () => {
    try {
      const ps = await fs.collection('people').where('email', '==', yo.email).get();
      const ids = [];
      for (const p of ps.docs) {
        const su = await fs.collection('signups').where('personId', '==', p.id).get();
        for (const s of su.docs) if (s.data().attended) ids.push(s.data().eventId);
      }
      const validas = new Set(MADRID.zonas.map((z) => z.id));
      const out = [];
      for (const id of [...new Set(ids)]) {
        const ev = await fs.collection('events').doc(id).get();
        const dia = ev.exists ? String(ev.data().date || '').slice(0, 10) : '';
        out.push(...(SALIDAS_BARRIOS[dia] || []).filter((z) => validas.has(z)));
      }
      return out;
    } catch (e) { console.error('diario salidas', e.message); return []; }
  };
  const todo = async () => {
    const [entradas, deSalidas] = await Promise.all([mias(), zonasDeSalidas()]);
    return res(h, 200, { entradas, resumen: resumen(entradas, deSalidas) });
  };
  try {
    if (event.httpMethod === 'GET') return await todo();
    if (event.httpMethod !== 'POST') return res(h, 405, { error: 'metodo' });
    const b = JSON.parse(event.body || '{}');

    if (b.accion === 'borrar') {
      const ref = col.doc(limpio(b.id, 40));
      const d = await ref.get();
      if (!d.exists || d.data().email !== yo.email) return res(h, 404, { error: 'no-existe' });
      await ref.delete();
      return await todo();
    }

    if (b.accion === 'apuntar') {
      const fecha = /^\d{4}-\d{2}-\d{2}$/.test(b.fecha || '') ? b.fecha : '';
      if (!fecha || fecha > hoy() || fecha < '2020-01-01') return res(h, 400, { error: 'fecha' });
      const lista = ciudadDe(b.ciudad);
      const ciudad = lista ? lista.ciudad : limpio(b.ciudad, 40);
      if (!ciudad) return res(h, 400, { error: 'ciudad' });
      const entrada = { email: yo.email, fecha, ciudad };
      const z = lista && b.zonaId ? lista.zonas.find((x) => x.id === b.zonaId) : null;
      if (b.zonaId && !z) return res(h, 400, { error: 'zona' });
      if (z) { entrada.zonaId = z.id; entrada.zona = z.nombre; } else {
        entrada.zona = limpio(b.zona, 60);
        if (!entrada.zona) return res(h, 400, { error: 'zona' });
      }
      entrada.camara = CAMARAS.includes(b.camara) ? b.camara : '';
      entrada.hechas = entero(b.hechas, 5000);
      entrada.quedadas = Math.min(entero(b.quedadas, 5000), entrada.hechas || 5000);
      entrada.nota = limpio(b.nota, 400);
      const eseDia = (await mias()).filter((e) => e.fecha === fecha).length;
      if (eseDia >= MAX_DIA) return res(h, 429, { error: 'demasiadas' });
      await col.add({ ...entrada, creada: FieldValue.serverTimestamp() });
      return await todo();
    }
    return res(h, 400, { error: 'accion' });
  } catch (e) {
    console.error('diario', e.message);
    return res(h, 500, { error: 'error' });
  }
};

exports._resumen = resumen;
