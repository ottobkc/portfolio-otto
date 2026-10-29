// Service worker mínimo para que la zona de socios se pueda instalar como app.
// No intercepta peticiones (sin «fetch»): todo va a la red como siempre y la protección
// de la función edge «socios» no cambia. Solo existe para que el navegador la reconozca como app.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
