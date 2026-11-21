// Sesiones navideñas (ottokols.es/navidad/) — configuración.
// Dos tipos de hueco:
//  · calle: tardes, a la hora azul y con las luces encendidas
//  · casa:  voy a casa de la familia (mañanas de fin de semana/festivo y primera hora de la tarde)
// Lunes y miércoles no hay sesiones (clase por la tarde).
// Sábado 12 (taller nocturno) y sábado 19 (taller de atardecer): sin sesiones por la tarde.
// Domingos 13 y 20 por la mañana: reservados para la salida 6 hasta decidir cuál de los dos.

const CALLE = {
  '2026-12-01': ['17:30', '18:15', '19:00'],
  '2026-12-03': ['17:30', '18:15', '19:00'],
  '2026-12-04': ['17:30', '18:15', '19:00'],
  '2026-12-05': ['17:30', '18:15', '19:00'],
  '2026-12-06': ['17:30', '18:15', '19:00'],
  '2026-12-08': ['17:30', '18:15', '19:00'],
  '2026-12-10': ['17:30', '18:15', '19:00'],
  '2026-12-11': ['17:30', '18:15', '19:00'],
  '2026-12-13': ['17:30', '18:15', '19:00'],
  '2026-12-15': ['17:30', '18:15', '19:00'],
  '2026-12-17': ['17:30', '18:15', '19:00'],
  '2026-12-18': ['17:30', '18:15', '19:00'],
  '2026-12-20': ['17:30', '18:15', '19:00'],
  '2026-12-22': ['17:30', '18:15', '19:00'],
};

const CASA = {
  '2026-12-01': ['15:45'],
  '2026-12-03': ['15:45'],
  '2026-12-04': ['15:45'],
  '2026-12-05': ['11:00', '12:30', '15:45'],
  '2026-12-06': ['11:00', '12:30', '15:45'],
  '2026-12-08': ['11:00', '12:30', '15:45'],
  '2026-12-10': ['15:45'],
  '2026-12-11': ['15:45'],
  '2026-12-12': ['11:00', '12:30'],
  '2026-12-13': ['15:45'],
  '2026-12-15': ['15:45'],
  '2026-12-17': ['15:45'],
  '2026-12-18': ['15:45'],
  '2026-12-19': ['11:00', '12:30'],
  '2026-12-20': ['15:45'],
  '2026-12-22': ['15:45'],
};

// Una sesión en casa a las 15:45 termina hacia las 16:45: bloquea la primera de calle (17:30)
// para que dé tiempo a llegar al centro.
const BLOQUEA = { '15:45': '17:30' };

const MODALIDADES = {
  mini: { nombre: 'Minisesión en la calle', precio: 90, tipo: 'calle', huecos: 1, detalle: '25–30 min · 1 sitio · 10 fotos editadas' },
  paseo: { nombre: 'Sesión paseo', precio: 150, tipo: 'calle', huecos: 2, detalle: '1 hora · hasta 3 sitios · 20 fotos editadas' },
  casa: { nombre: 'En casa', precio: 120, tipo: 'casa', huecos: 1, detalle: '45 min · en vuestra casa · 15 fotos editadas · desplazamiento incluido en Madrid capital' },
  bono: { nombre: 'Bono regalo', precio: null, tipo: null, huecos: 0, detalle: 'Cualquiera de las tres, para regalar · válido hasta el 30 de junio de 2027' },
};

const ZONAS = ['Sol y Gran Vía', 'Plaza Mayor y Austrias', 'Barrio de las Letras', 'Malasaña', 'Otro sitio (cuéntamelo)'];

module.exports = { CALLE, CASA, BLOQUEA, MODALIDADES, ZONAS };
