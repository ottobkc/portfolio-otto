// Mapa de pegatinas de Mirar Despacio (Leaflet + Firestore, colección "pegatinas")
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
const esUrlSegura = (u) => { try { return new URL(u).protocol === 'https:'; } catch { return false; } };

const map = L.map('stickerMap', { scrollWheelZoom: false }).setView([40.4168, -3.7038], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap', maxZoom: 18
}).addTo(map);
const capa = L.layerGroup().addTo(map);
let pendiente = null;

onSnapshot(collection(db, 'pegatinas'), (snap) => {
  capa.clearLayers();
  snap.docs.forEach((d) => {
    const p = d.data();
    if (typeof p.lat !== 'number' || typeof p.lng !== 'number') return;
    const foto = p.photo && esUrlSegura(p.photo)
      ? `<img src="${esc(p.photo)}" alt="" style="width:100%;border-radius:4px;margin-bottom:6px" onerror="this.remove()">` : '';
    const nombre = p.name ? `<strong>${esc(p.name)}</strong><br>` : '';
    L.marker([p.lat, p.lng]).bindPopup(`<div style="max-width:200px">${foto}${nombre}<small>Pegatina de Mirar Despacio</small></div>`).addTo(capa);
  });
}, () => {});

map.on('click', (e) => {
  if (pendiente) map.removeLayer(pendiente);
  pendiente = L.marker(e.latlng, { opacity: 0.6 }).addTo(map);
  $('stickerLat').value = e.latlng.lat;
  $('stickerLng').value = e.latlng.lng;
  $('stickerCoordsHint').textContent = `Punto marcado: ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`;
});

$('stickerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const lat = parseFloat($('stickerLat').value), lng = parseFloat($('stickerLng').value);
  const msg = $('stickerMsg');
  if (isNaN(lat) || isNaN(lng)) { msg.textContent = 'Primero toca el mapa para marcar dónde está.'; return; }
  const name = $('stickerName').value.trim();
  const photo = $('stickerPhoto').value.trim();
  if (photo && !esUrlSegura(photo)) { msg.textContent = 'El enlace de la foto tiene que empezar por https://'; return; }
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  try {
    await addDoc(collection(db, 'pegatinas'), { lat, lng, name: name || null, photo: photo || null, createdAt: serverTimestamp() });
    msg.textContent = 'Gracias, ya está en el mapa.';
    e.target.reset();
    $('stickerCoordsHint').textContent = 'Aún no has marcado ningún punto en el mapa.';
    if (pendiente) { map.removeLayer(pendiente); pendiente = null; }
  } catch {
    msg.textContent = 'No se ha podido guardar. Prueba otra vez.';
  } finally {
    btn.disabled = false;
  }
});
