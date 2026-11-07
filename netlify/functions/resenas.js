// Opiniones de Google de las fichas de Mirar Despacio y Otto Kols, para enseñarlas en las webs.
//  GET ?ficha=md | ok  -> { nota, total, url, resenas: [{ autor, autorUrl, nota, texto, cuando }] }
//                         o { sinDatos: true } si aún no hay ficha, clave u opiniones (la web no enseña nada).
//
// Variables de entorno de Netlify:
//   GOOGLE_PLACES_KEY  -> clave de la API de Google Maps (Places API (New)), restringida a esa API
//   GOOGLE_PLACE_MD    -> identificador de lugar (place ID) de la ficha de Mirar Despacio
//   GOOGLE_PLACE_OK    -> el de la ficha de Otto Kols
//
// Se consulta a Google como mucho cada 6 horas por ficha (se guarda en Firestore, colección cache):
// así el coste es prácticamente cero y la web no depende de Google para cargar.
// Google solo devuelve hasta 5 opiniones y elige cuáles; las normas piden enseñar el nombre del autor
// con enlace y dejar claro que son de Google.
const { db, FieldValue } = require('../lib/firestore');

const ORIGENES = /^https:\/\/((www\.)?mirardespacio\.es|([a-z0-9-]+--)?mirar-despacio\.netlify\.app|(www\.)?ottokols\.es|([a-z0-9-]+--)?stalwart-panda-3d94db\.netlify\.app)$/;
const REFRESCO = 6 * 3600e3; // se pregunta a Google como mucho cada 6 horas por ficha
const FICHAS = { md: 'GOOGLE_PLACE_MD', ok: 'GOOGLE_PLACE_OK' };

const limpio = (s, n) => String(s || '').replace(/\s+\n/g, '\n').trim().slice(0, n);

async function deGoogle(placeId, clave) {
  const r = await fetch('https://places.googleapis.com/v1/places/' + encodeURIComponent(placeId) + '?languageCode=es&regionCode=ES', {
    headers: { 'X-Goog-Api-Key': clave, 'X-Goog-FieldMask': 'rating,userRatingCount,googleMapsUri,reviews' },
    signal: AbortSignal.timeout(8000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Google ' + r.status + ': ' + ((j.error && j.error.message) || ''));
  return {
    nota: Number(j.rating) || 0,
    total: Number(j.userRatingCount) || 0,
    url: j.googleMapsUri || '',
    resenas: (j.reviews || [])
      .map((v) => ({
        autor: limpio(v.authorAttribution && v.authorAttribution.displayName, 60),
        autorUrl: (v.authorAttribution && v.authorAttribution.uri) || '',
        nota: Number(v.rating) || 0,
        texto: limpio((v.originalText && v.originalText.text) || (v.text && v.text.text), 1200),
        cuando: v.publishTime || '',
      }))
      // Solo opiniones con texto y buena nota: las demás siguen en Google, donde cualquiera las ve
      .filter((v) => v.texto && v.nota >= 4),
  };
}

exports.handler = async (event) => {
  const o = (event.headers || {}).origin || '';
  const cab = {
    'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ORIGENES.test(o) ? o : 'https://mirardespacio.es', Vary: 'Origin',
    'Cache-Control': 'public, max-age=900', 'Netlify-CDN-Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=3600',
  };
  const ficha = FICHAS[(event.queryStringParameters || {}).ficha] ? event.queryStringParameters.ficha : 'md';
  const clave = process.env.GOOGLE_PLACES_KEY, placeId = process.env[FICHAS[ficha]];
  const vacio = { statusCode: 200, headers: cab, body: JSON.stringify({ sinDatos: true }) };
  if (!clave || !placeId) return vacio;

  const ref = db().collection('cache').doc('resenas-' + ficha);
  const guardado = (await ref.get().catch(() => null)) || null;
  const previo = guardado && guardado.exists ? guardado.data() : null;
  let datos = previo && previo.datos;
  if (!previo || previo.placeId !== placeId || Date.now() - (previo.en || 0) > REFRESCO) {
    try {
      datos = await deGoogle(placeId, clave);
      await ref.set({ datos, en: Date.now(), placeId, actualizado: FieldValue.serverTimestamp() });
      console.log('resenas', ficha, 'nota', datos.nota, 'total', datos.total, 'con texto', datos.resenas.length);
    } catch (e) {
      console.error('resenas', ficha, e.message); // si Google falla, se sirve lo último que había
    }
  }
  if (!datos || !datos.total) return vacio;
  return { statusCode: 200, headers: cab, body: JSON.stringify(datos) };
};
