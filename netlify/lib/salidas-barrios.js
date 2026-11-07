// Zonas del mapita de Madrid (ids de lib/zonas.js, ciudad Madrid) por las que pasó cada salida de Mirar Despacio.
// Clave: el día de la salida (campo «date» del evento en el CRM). Quien tiene marcado «vino» en esa salida
// ve esas zonas pintadas en «Mis salidas». Al añadir una salida nueva, añade aquí su día y sus zonas.
module.exports = {
  '2026-06-28': ['letras'],                          // Salida 1 · Barrio de las Letras hasta Santa Ana
  '2026-08-02': ['malasana'],                        // Salida 2 · Malasaña
  '2026-09-06': ['malasana', 'chueca'],              // Salida 3 · Tribunal y Chueca
  '2026-10-11': ['letras', 'austrias'],              // Salida 4 · Huertas, desde Plaza Mayor
  '2026-11-15': ['sol-gran-via', 'palacio', 'arguelles'], // Salida 5 · Gran Vía hasta el Templo de Debod
};
