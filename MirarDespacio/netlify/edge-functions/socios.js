// Zona de socios de mirardespacio.es: protege las páginas privadas ANTES de servirlas y gestiona la
// cookie de sesión. Sustituye a las reglas «Role» de Netlify Identity (que con sesiones externas son
// solo para el plan Enterprise).
//
// Cookie md_socio = base64url(JSON {u: uid, e: email, r: roles, x: caduca en s}) + "." + HMAC-SHA256
// firmada con SESION_SOCIOS (variable de entorno, la misma en ottokols.es). HttpOnly: el navegador
// no puede leerla ni cambiarla. Dura 12 h; al caducar, /acceso/ la renueva sola si la sesión de
// Firebase sigue abierta (así un cambio de acceso hecho en el CRM se nota como mucho en 12 h).
//
// Rutas:
//   /socios/*  /retos/*        -> member o admin (Mirar Despacio+)
//   /cuaderno/*                -> member, participante o admin
//   /manuales/<id>/*           -> taller-<id> o admin. Ser MD+ NO da acceso.
//   /manuales/* (cualquier otra) -> solo admin
//   /api/socios/enlace         -> pide el enlace para entrar (lo manda ottokols.es)
//   /api/socios/sesion         -> {idToken} de Firebase -> crea la cookie y devuelve el acceso
//   /api/socios/salir          -> borra la cookie
// Si algo falla aquí, Netlify devuelve error y NO sirve la página (onError: 'fail').
const COOKIE = 'md_socio';
const DURA = 12 * 3600;
const FUNCION = 'https://ottokols.es/.netlify/functions/socios';
const enc = new TextEncoder();

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

function secreto() {
  const s = Netlify.env.get('SESION_SOCIOS') || '';
  if (s.length < 32) throw new Error('Falta SESION_SOCIOS');
  return s;
}
let claveCache = null;
async function clave() {
  if (!claveCache) claveCache = await crypto.subtle.importKey('raw', enc.encode(secreto()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  return claveCache;
}

async function firmar(datos) {
  const cuerpo = b64url(enc.encode(JSON.stringify(datos)));
  const firma = await crypto.subtle.sign('HMAC', await clave(), enc.encode(cuerpo));
  return cuerpo + '.' + b64url(firma);
}

// Devuelve {u, e, r, x} si la cookie es buena y no ha caducado; si no, null
async function leerCookie(request) {
  const m = (request.headers.get('cookie') || '').match(/(?:^|;\s*)md_socio=([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await clave(), deB64url(m[2]), enc.encode(m[1]));
    if (!ok) return null;
    const d = JSON.parse(new TextDecoder().decode(deB64url(m[1])));
    if (!d || typeof d.x !== 'number' || d.x < Date.now() / 1000 || !Array.isArray(d.r)) return null;
    return d;
  } catch (e) {
    if (/SESION_SOCIOS/.test(e.message)) throw e;
    return null;
  }
}

// Qué hace falta para cada ruta. null = no es una ruta protegida.
export function reglaPara(ruta) {
  let p;
  try { p = decodeURIComponent(ruta); } catch (e) { p = ruta; }
  p = p.toLowerCase().replace(/\/{2,}/g, '/');
  const plus = (r) => r.includes('member') || r.includes('admin');
  let m;
  if ((m = p.match(/^\/manuales\/([a-z0-9-]+)(\/|$)/))) return { a: 'manual-' + m[1], puede: (r) => r.includes('admin') || r.includes('taller-' + m[1]) };
  if (/^\/manuales(\/|$|\.)/.test(p)) return { a: '', puede: (r) => r.includes('admin') };
  if (/^\/socios(\/|$|\.)/.test(p)) return { a: 'socios', puede: plus };
  if (/^\/retos(\/|$|\.)/.test(p)) return { a: 'retos', puede: plus };
  if (/^\/cuaderno(\/|$|\.)/.test(p)) return { a: 'cuaderno', puede: (r) => plus(r) || r.includes('participante') };
  return null;
}

const json = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
});
const cookie = (valor, edad) => `${COOKIE}=${valor}; Path=/; Max-Age=${edad}; HttpOnly; Secure; SameSite=Lax`;

async function llamarFuncion(request, context, cuerpo, token) {
  return fetch(FUNCION, {
    method: 'POST',
    headers: {
      'content-type': 'application/json', 'x-md-clave': secreto(), 'x-md-ip': context.ip || '',
      ...(token ? { authorization: 'Bearer ' + token } : {}),
    },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(8000),
  });
}

async function api(request, context, que) {
  if (request.method !== 'POST') return json({ error: 'metodo' }, 405);
  // Solo desde las propias páginas de la web (frena que otra web las use a escondidas)
  const origen = request.headers.get('origin');
  const url = new URL(request.url);
  if (origen && origen !== url.origin) return json({ error: 'origen' }, 403);

  if (que === 'salir') return json({ ok: true }, 200, { 'set-cookie': cookie('', 0) });

  let b = {};
  try { b = await request.json(); } catch (e) { return json({ error: 'datos' }, 400); }

  if (que === 'enlace') {
    const r = await llamarFuncion(request, context, { accion: 'enlace', email: String(b.email || '').slice(0, 160), a: String(b.a || '').slice(0, 40), web: url.origin });
    return json(await r.json().catch(() => ({})), r.status);
  }

  if (que === 'sesion') {
    const token = String(b.idToken || '');
    if (!token || token.length > 4096) return json({ error: 'sesion' }, 401);
    const r = await llamarFuncion(request, context, { accion: 'quien', entrada: !!b.entrada }, token);
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.uid) return json({ error: 'sesion' }, 401, { 'set-cookie': cookie('', 0) });
    const roles = (d.roles || []).filter((x) => typeof x === 'string').slice(0, 40);
    const x = Math.floor(Date.now() / 1000) + DURA;
    const valor = await firmar({ u: d.uid, e: d.email, r: roles, x });
    return json({ email: d.email, nombre: d.nombre || '', roles, caduca: x }, 200, { 'set-cookie': cookie(valor, DURA) });
  }
  return json({ error: 'ruta' }, 404);
}

export default async (request, context) => {
  const url = new URL(request.url);
  const a = url.pathname.match(/^\/api\/socios\/(enlace|sesion|salir)\/?$/);
  if (a) return api(request, context, a[1]);

  const regla = reglaPara(url.pathname);
  if (!regla) return context.next();

  const yo = await leerCookie(request);
  if (!yo || !regla.puede(yo.r)) {
    const destino = new URL('/acceso/', url.origin);
    if (regla.a) destino.searchParams.set('a', regla.a);
    destino.searchParams.set('volver', url.pathname + url.search);
    if (yo) destino.searchParams.set('sin', '1'); // tiene sesión, pero no ese acceso
    return new Response(null, { status: 302, headers: { location: destino.pathname + destino.search, 'cache-control': 'no-store' } });
  }

  const res = await context.next();
  const h = new Headers(res.headers);
  h.set('cache-control', 'private, no-store');
  h.set('x-robots-tag', 'noindex, nofollow');
  h.set('referrer-policy', 'same-origin');
  return new Response(res.body, { status: res.status, headers: h });
};

export const config = {
  path: ['/socios', '/socios/*', '/retos', '/retos/*', '/cuaderno', '/cuaderno/*', '/manuales', '/manuales/*', '/api/socios/*'],
  onError: 'fail',
};
