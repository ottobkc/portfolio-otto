// IndexNow: avisa a Bing (y a los buscadores que lo usan, como Yandex o Seznam) de las páginas cambiadas,
// para que las revisen en horas y no en semanas. Google no usa IndexNow; para él está el sitemap.
// La clave es pública por diseño: tiene que estar en https://<web>/<clave>.txt de cada web.
const CLAVE = 'c810eafedef72354aaefe374ad37c4da';
const WEBS = ['https://mirardespacio.es', 'https://ottokols.es'];

// URLs del sitemap con lastmod desde «desde» (AAAA-MM-DD); sin «desde», todas
async function urlsCambiadas(web, desde) {
  const r = await fetch(web + '/sitemap.xml', { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('sitemap ' + web + ' ' + r.status);
  const xml = await r.text();
  const urls = [];
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = (m[1].match(/<loc>([^<]+)<\/loc>/) || [])[1];
    const mod = (m[1].match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1] || '';
    if (loc && (!desde || mod.slice(0, 10) >= desde)) urls.push(loc.trim());
  }
  return urls;
}

async function avisar(desde) {
  const informe = [];
  for (const web of WEBS) {
    try {
      const urlList = await urlsCambiadas(web, desde);
      if (!urlList.length) { informe.push(web + ': nada nuevo'); continue; }
      const r = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ host: new URL(web).host, key: CLAVE, keyLocation: web + '/' + CLAVE + '.txt', urlList }),
        signal: AbortSignal.timeout(10000),
      });
      informe.push(web + ': ' + urlList.length + ' URLs → ' + r.status);
    } catch (e) { informe.push(web + ': error ' + e.message); }
  }
  return informe;
}

module.exports = { avisar, CLAVE };
