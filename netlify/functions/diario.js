// Diario de salidas por tu cuenta (Mirar Despacio+): cada miembro apunta cuándo y por dónde salió a
// hacer fotos, con qué cámara, cuántas hizo y con cuántas se queda. De ahí salen sus cifras del mes,
// la racha de meses seguidos y los barrios que lleva recorridos.
//
//  GET  (con sesión)                                   -> { entradas, resumen }
//  POST (con sesión) {accion:'apuntar', fecha, ciudad, barrio | zona, camara, hechas, quedadas, nota}
//  POST (con sesión) {accion:'borrar', id}
//
// Madrid usa la lista oficial de barrios (netlify/lib/barrios-madrid.js): se guarda el id del barrio.
// En otras ciudades la zona es texto libre. Solo para MD+ (y Otto).
const { db, FieldValue } = require('../lib/firestore');
const { usuarioDe } = require('../lib/cuentas');
const BARRIOS = require('../lib/barrios-madrid');
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

const BARRIO = {};
for (const d of BARRIOS) for (const b of d.barrios) BARRIO[b.id] = { ...b, distrito: d.distrito };
const esMadrid = (c) => /^madrid$/i.test(String(c || '').trim());
const claveZona = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

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
  // Barrios y zonas recorridos
  const madrid = [...new Set([...entradas.filter((e) => e.barrio).map((e) => e.barrio), ...deSalidas])];
  const otras = {};
  for (const e of entradas) {
    if (e.barrio || !e.zona) continue;
    const c = e.ciudad || 'Otra ciudad';
    otras[c] = otras[c] || {};
    otras[c][claveZona(e.zona)] = otras[c][claveZona(e.zona)] || e.zona;
  }
  return {
    mes: { salidas: delMes.length, hechas: suma(delMes, 'hechas'), quedadas: suma(delMes, 'quedadas'), tasa: tasa(delMes) },
    total: { salidas: entradas.length, hechas: suma(entradas, 'hechas'), quedadas: suma(entradas, 'quedadas'), tasa: tasa(entradas) },
    racha,
    barriosMadrid: madrid, barriosMadridTotal: Object.keys(BARRIO).length, barriosSalidas: [...new Set(deSalidas)],
    zonas: Object.entries(otras).map(([ciudad, z]) => ({ ciudad, zonas: Object.values(z) })),
    ciudad: entradas[0] ? entradas[0].ciudad : '',
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
  // Barrios de las salidas de Mirar Despacio a las que consta que vino (marcado «vino» en el CRM)
  const barriosDeSalidas = async () => {
    try {
      const ps = await fs.collection('people').where('email', '==', yo.email).get();
      const ids = [];
      for (const p of ps.docs) {
        const su = await fs.collection('signups').where('personId', '==', p.id).get();
        for (const s of su.docs) if (s.data().attended) ids.push(s.data().eventId);
      }
      const out = [];
      for (const id of [...new Set(ids)]) {
        const ev = await fs.collection('events').doc(id).get();
        const dia = ev.exists ? String(ev.data().date || '').slice(0, 10) : '';
        out.push(...(SALIDAS_BARRIOS[dia] || []).filter((b) => BARRIO[b]));
      }
      return out;
    } catch (e) { console.error('diario salidas', e.message); return []; }
  };
  try {
    if (event.httpMethod === 'GET') {
      const [entradas, deSalidas] = await Promise.all([mias(), barriosDeSalidas()]);
      return res(h, 200, { entradas, resumen: resumen(entradas, deSalidas) });
    }
    if (event.httpMethod !== 'POST') return res(h, 405, { error: 'metodo' });
    const b = JSON.parse(event.body || '{}');

    if (b.accion === 'borrar') {
      const ref = col.doc(limpio(b.id, 40));
      const d = await ref.get();
      if (!d.exists || d.data().email !== yo.email) return res(h, 404, { error: 'no-existe' });
      await ref.delete();
      const [entradas, deSalidas] = await Promise.all([mias(), barriosDeSalidas()]);
      return res(h, 200, { entradas, resumen: resumen(entradas, deSalidas) });
    }

    if (b.accion === 'apuntar') {
      const fecha = /^\d{4}-\d{2}-\d{2}$/.test(b.fecha || '') ? b.fecha : '';
      if (!fecha || fecha > hoy() || fecha < '2020-01-01') return res(h, 400, { error: 'fecha' });
      const ciudad = limpio(b.ciudad, 40) || 'Madrid';
      const entrada = { email: yo.email, fecha, ciudad: esMadrid(ciudad) ? 'Madrid' : ciudad };
      if (esMadrid(ciudad)) {
        if (!BARRIO[b.barrio]) return res(h, 400, { error: 'barrio' });
        entrada.barrio = b.barrio;
        entrada.zona = BARRIO[b.barrio].nombre;
      } else {
        entrada.zona = limpio(b.zona, 60);
        if (!entrada.zona) return res(h, 400, { error: 'zona' });
      }
      entrada.camara = CAMARAS.includes(b.camara) ? b.camara : '';
      entrada.hechas = entero(b.hechas, 5000);
      entrada.quedadas = Math.min(entero(b.quedadas, 5000), entrada.hechas || 5000);
      entrada.nota = limpio(b.nota, 400);
      const hoyMias = (await mias()).filter((e) => e.fecha === fecha).length;
      if (hoyMias >= MAX_DIA) return res(h, 429, { error: 'demasiadas' });
      await col.add({ ...entrada, creada: FieldValue.serverTimestamp() });
      const [entradas, deSalidas] = await Promise.all([mias(), barriosDeSalidas()]);
      return res(h, 200, { entradas, resumen: resumen(entradas, deSalidas) });
    }
    return res(h, 400, { error: 'accion' });
  } catch (e) {
    console.error('diario', e.message);
    return res(h, 500, { error: 'error' });
  }
};

exports._resumen = resumen;
