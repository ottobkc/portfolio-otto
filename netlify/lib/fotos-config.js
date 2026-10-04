// Cuánto se guardan las fotos en Cloudinary (lo usan fotos.js y limpieza-fotos.js).
// Las fotos que están en el muro público no se borran nunca de forma automática.
module.exports = {
  SALIDA_DIAS: 90,      // fotos de salidas: se borran 90 días después de la salida
  RETOS_GUARDADOS: 3,   // retos: se guardan las fotos de los 3 últimos retos cerrados (más el abierto)
};
