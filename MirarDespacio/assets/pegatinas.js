// Mapa de pegatinas de Mirar Despacio (Leaflet + Firestore "pegatinas" + fotos en Cloudinary)
// - El punto aparece al momento.
// - La foto se sube a Cloudinary (carpeta pegatinas, preset sin firma) y solo se muestra
//   cuando Otto la aprueba desde la pestaña Pegatinas del CRM (fotoAprobada: true).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dybxateci/image/upload';
const UPLOAD_PRESET = 'pegatinas_web';

const app = initializeApp({
  apiKey: "AIzaSyDfRTs1pF5-iV2dlNFY-dlFv4A-HcxZeTk",
  authDomain: "mirardespaciocrm.firebaseapp.com",
  projectId: "mirardespaciocrm",
  storageBucket: "mirardespaciocrm.firebasestorage.app",
  messagingSenderId: "328402994544",
  appId: "1:328402994544:web:abab2ce9d54d286eb7fbb5"
}, "pegatinas");
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);
const esc = (t) => { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; };
const esFotoPropia = (u) => typeof u === 'string' && u.startsWith('https://res.cloudinary.com/dybxateci/');
const esUrlSegura = (u) => { try { return new URL(u).protocol === 'https:'; } catch { return false; } };

const map = L.map('stickerMap', { scrollWheelZoom: false }).setView([40.4168, -3.7038], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap', maxZoom: 19
}).addTo(map);
const capa = L.layerGroup().addTo(map);
let pendiente = null;

// Miniatura pequeña a partir de la URL de Cloudinary
const mini = (u) => u.replace('/upload/', '/upload/c_fill,w_220,h_220,q_auto,f_auto/');

onSnapshot(collection(db, 'pegatinas'), (snap) => {
  capa.clearLayers();
  snap.docs.forEach((d) => {
    const p = d.data();
    if (typeof p.lat !== 'number' || typeof p.lng !== 'number') return;
    // Fotos nuevas: solo si están aprobadas. Pegatinas antiguas (sin el campo) se muestran como antes.
    const mostrar = p.photo && (p.fotoAprobada === true || (p.fotoAprobada === undefined && esUrlSegura(p.photo)));
    const src = mostrar ? (esFotoPropia(p.photo) ? mini(p.photo) : p.photo) : null;
    const foto = src ? `<img src="${esc(src)}" alt="" style="width:100%;max-width:180px;border-radius:4px;margin-bottom:6px" onerror="this.remove()">` : '';
    const nombre = p.name ? `<strong>${esc(p.name)}</strong><br>` : '';
    L.marker([p.lat, p.lng]).bindPopup(`<div style="max-width:190px">${foto}${nombre}<small>Pegatina de Mirar Despacio</small></div>`).addTo(capa);
  });
}, () => {});

function marcar(lat, lng, centrar) {
  if (pendiente) map.removeLayer(pendiente);
  pendiente = L.marker([lat, lng], { opacity: 0.6 }).addTo(map);
  if (centrar) map.setView([lat, lng], 16);
  $('stickerLat').value = lat;
  $('stickerLng').value = lng;
  $('stickerCoordsHint').textContent = `Punto marcado: ${lat.toFixed(4)}, ${lng.toFixed(4)}. Puedes moverlo tocando otro sitio del mapa.`;
}

map.on('click', (e) => marcar(e.latlng.lat, e.latlng.lng, false));

$('stickerGeo').addEventListener('click', () => {
  const msg = $('stickerCoordsHint');
  if (!navigator.geolocation || !window.isSecureContext) {
    msg.textContent = 'Tu navegador no deja usar la ubicación aquí. Toca el sitio en el mapa.';
    return;
  }
  const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const ok = (pos) => marcar(pos.coords.latitude, pos.coords.longitude, true);
  const fallo = (err) => {
    if (err && err.code === 1) {
      msg.textContent = esIOS
        ? 'El iPhone no deja a Safari usar tu ubicación. Actívalo en Ajustes → Privacidad y seguridad → Localización → Sitios web de Safari → "Al usar la app", recarga la página y vuelve a probar. O toca el sitio en el mapa.'
        : 'No has dado permiso de ubicación. Actívalo en el candado de la barra de direcciones y vuelve a probar, o toca el sitio en el mapa.';
    } else {
      msg.textContent = 'No he podido saber dónde estás (a veces pasa en interiores). Prueba otra vez o toca el sitio en el mapa.';
    }
  };
  msg.textContent = 'Buscando tu ubicación…';
  // Primer intento preciso; si tarda o falla por señal, segundo intento más rápido y menos exigente.
  navigator.geolocation.getCurrentPosition(ok, (err) => {
    if (err && err.code === 1) return fallo(err);
    navigator.geolocation.getCurrentPosition(ok, fallo, { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 });
  }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
});

// Vista previa y reducción de la foto antes de subirla (máx. 1600 px, JPEG)
let fotoLista = null;
$('stickerFoto').addEventListener('change', async (e) => {
  fotoLista = null;
  const f = e.target.files && e.target.files[0];
  const prev = $('stickerPreview');
  if (!f) { prev.style.display = 'none'; return; }
  try {
    fotoLista = await reducir(f, 1600);
    prev.src = URL.createObjectURL(fotoLista);
    prev.style.display = 'block';
  } catch {
    fotoLista = f; // si no se puede reducir (p. ej. HEIC en algunos navegadores), se sube tal cual
    prev.style.display = 'none';
  }
});

function reducir(file, max) {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => b ? ok(b) : mal(new Error()), 'image/jpeg', 0.85);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = mal;
    img.src = URL.createObjectURL(file);
  });
}

async function subirFoto(blob) {
  const fd = new FormData();
  fd.append('file', blob);
  fd.append('upload_preset', UPLOAD_PRESET);
  const r = await fetch(CLOUDINARY_URL, { method: 'POST', body: fd });
  if (!r.ok) throw new Error('subida');
  const d = await r.json();
  return d.secure_url;
}

$('stickerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const lat = parseFloat($('stickerLat').value), lng = parseFloat($('stickerLng').value);
  const msg = $('stickerMsg');
  if (isNaN(lat) || isNaN(lng)) { msg.textContent = 'Primero usa tu ubicación o toca el mapa para marcar dónde está.'; return; }
  const name = $('stickerName').value.trim();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  let photo = null;
  try {
    if (fotoLista) {
      msg.textContent = 'Subiendo la foto…';
      try { photo = await subirFoto(fotoLista); }
      catch { msg.textContent = 'No se ha podido subir la foto; guardo el punto sin ella.'; }
    }
    await addDoc(collection(db, 'pegatinas'), {
      lat, lng, name: name || null, photo, fotoAprobada: false, createdAt: serverTimestamp()
    });
    msg.textContent = photo ? 'Gracias, ya está en el mapa. La foto aparecerá cuando la revise.' : 'Gracias, ya está en el mapa.';
    if (window.umami) window.umami.track('pegatina-marcada', { foto: !!photo });
    e.target.reset();
    fotoLista = null;
    $('stickerPreview').style.display = 'none';
    $('stickerCoordsHint').textContent = 'O toca en el mapa el sitio donde la has visto.';
    if (pendiente) { map.removeLayer(pendiente); pendiente = null; }
  } catch {
    msg.textContent = 'No se ha podido guardar. Prueba otra vez.';
  } finally {
    btn.disabled = false;
  }
});
