// Seguimiento después de cada salida: a quien tiene marcado «vino» se le escribe una vez, al día siguiente
// de que Otto lo marque (lo lanza tareas-diarias cada mañana), con los próximos talleres.
// No promete las fotos en el muro (Otto tarda días en comentarlas): «mientras las veo, echa un vistazo a esto».
// Respeta la baja de «novedades» (people.aceptaNovedades === false).
const { enviar } = require('./correo');
const { tarjeta, fechaLarga, aTexto } = require('./plantillas-salida');
const { urlBaja } = require('./avisos');
const T = require('./talleres');

const WEB = 'https://mirardespacio.es';
const DIAS = 21; // salidas de las últimas 3 semanas (por si Otto marca «vino» tarde)
const hoyMadrid = (offset = 0) => new Date(Date.now() + offset * 864e5).toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).slice(0, 10);
const nombrePila = (n) => String(n || '').trim().split(/\s+/)[0] || '';

// Próximas fechas de taller con plaza (las 3 primeras)
function proximosTalleres(d) {
  const ahora = Date.now();
  return (d.ediciones || [])
    .filter((e) => e.activa && e.fechaISO && new Date(e.fechaISO).getTime() > ahora)
    .sort((a, b) => a.fechaISO.localeCompare(b.fechaISO))
    .slice(0, 3)
    .map((e) => ({ e, t: (d.talleres || []).find((x) => x.id === e.taller) }))
    .filter((x) => x.t);
}

function correo(nombre, email, salida, talleres) {
  const utm = '?utm_source=email&utm_campaign=post-salida';
  const filas = talleres.map(({ e, t }) => ['📷',
    `<a href="${WEB}/talleres/${t.id}/${utm}" style="color:#1a1814;"><strong>${t.titulo}</strong></a> · ${fechaLarga(e.fechaISO, e.fecha)} · ${e.hora || t.hora} h · ${t.precio} €`]);
  const intro = [
    `Gracias por venir ${salida ? 'a la salida de ' + salida : 'a la salida'}. Estos días voy a ir viendo vuestras fotos con calma, comentándolas y subiendo las mejores al muro; te aviso cuando estén.`,
    talleres.length
      ? 'Mientras tanto, por si te quedaste con ganas de más: estos son los próximos talleres. Son en grupos de 8, con un tema concreto y mucha práctica en la calle.'
      : 'Mientras tanto, te dejo por aquí lo que viene: talleres en grupos de 8, con un tema concreto y mucha práctica en la calle.',
  ];
  const baja = `<span style="font-size:13px;color:#8a8378;">Te escribo porque viniste a una salida de Mirar Despacio. ¿Prefieres no recibir novedades? <a href="${urlBaja(email, 'novedades')}" style="color:#8a8378;">Date de baja aquí</a>.</span>`;
  const html = tarjeta({
    titulo: 'Gracias por venir', nombre: nombrePila(nombre), intro, filas, calendario: null,
    boton: { url: `${WEB}/talleres/${utm}`, texto: 'Ver los talleres', antes: 'Todos se pueden regalar, por si alguien te viene a la cabeza estas navidades.' },
    cuerpo: ['Un abrazo y hasta la próxima,<br>Otto', baja],
  });
  return { para: email, asunto: 'Gracias por venir (y lo que viene)', html, texto: aTexto(html) };
}

// Devuelve una línea para el resumen diario
async function correosPostSalida(fs, FieldValue) {
  const desde = hoyMadrid(-DIAS), hasta = hoyMadrid(-1);
  const evs = (await fs.collection('events').get()).docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((e) => !e.id.startsWith('taller-') && e.date && String(e.date).slice(0, 10) >= desde && String(e.date).slice(0, 10) <= hasta);
  if (!evs.length) return '';
  const d = await T.datos().catch(() => ({}));
  const talleres = proximosTalleres(d);
  let n = 0;
  for (const ev of evs) {
    const sus = await fs.collection('signups').where('eventId', '==', ev.id).get();
    for (const s of sus.docs) {
      const su = s.data();
      if (!su.attended || su.postSalidaEn) continue;
      const p = su.personId ? await fs.collection('people').doc(su.personId).get() : null;
      const per = p && p.exists ? p.data() : null;
      if (!per || !per.email || per.aceptaNovedades === false) { await s.ref.update({ postSalidaEn: 'omitido' }); continue; }
      const barrio = String(ev.name || '').replace(/^Salida\s*\d*\s*[·:-]?\s*/i, '').trim();
      try {
        if (!(await enviar(correo(per.name, per.email, barrio, talleres)))) continue; // sin SMTP: se reintenta mañana
        await s.ref.update({ postSalidaEn: FieldValue.serverTimestamp() });
        n++;
      } catch (e) { console.error('post-salida', per.email, e.message); }
    }
  }
  return n ? `Seguimiento de salida: ${n} ${n === 1 ? 'correo' : 'correos'} con los próximos talleres.` : '';
}

module.exports = { correosPostSalida, _correo: correo, _proximosTalleres: proximosTalleres };
