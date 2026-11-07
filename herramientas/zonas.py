"""Zonas para «Mis salidas» de MD+: barrios céntricos de las capitales de provincia y el mapita del centro
de Madrid (celdas de Voronoi a partir del centro aproximado de cada zona: es un esquema, no un plano).
Escribe el mismo archivo en MirarDespacio/js/zonas.js (navegador) y netlify/lib/zonas.js (servidor).
Uso: python3 herramientas/zonas.py   (necesita scipy y shapely)"""
import json, math, os, re, unicodedata
import numpy as np
from scipy.spatial import Voronoi
from shapely.geometry import Polygon, box

RAIZ = os.path.join(os.path.dirname(__file__), '..')
slug = lambda s: re.sub(r'[^a-z0-9]+', '-', unicodedata.normalize('NFD', s.lower()).encode('ascii', 'ignore').decode()).strip('-')

MADRID = [  # (nombre, lat, lng) centro aproximado
    ('Gran Vía y Sol', 40.4195, -3.7040), ('Austrias y Plaza Mayor', 40.4150, -3.7100),
    ('Palacio y Plaza de España', 40.4205, -3.7145), ('La Latina y Rastro', 40.4100, -3.7090),
    ('Lavapiés', 40.4085, -3.7005), ('Letras y Huertas', 40.4145, -3.6985),
    ('Malasaña', 40.4255, -3.7045), ('Chueca y Salesas', 40.4225, -3.6965),
    ('Conde Duque', 40.4282, -3.7105), ('Argüelles y Debod', 40.4280, -3.7200),
    ('Prado y Atocha', 40.4105, -3.6925), ('El Retiro', 40.4150, -3.6835),
    ('Salamanca', 40.4270, -3.6820), ('Chamberí', 40.4345, -3.7000),
    ('Madrid Río y Matadero', 40.3980, -3.7065),
]
IDS_MADRID = {'Gran Vía y Sol': 'sol-gran-via', 'Austrias y Plaza Mayor': 'austrias', 'Palacio y Plaza de España': 'palacio',
              'La Latina y Rastro': 'latina', 'Letras y Huertas': 'letras', 'Chueca y Salesas': 'chueca',
              'Argüelles y Debod': 'arguelles', 'Prado y Atocha': 'prado', 'El Retiro': 'retiro', 'Madrid Río y Matadero': 'madrid-rio'}

OTRAS = {
    'Barcelona': ['Barri Gòtic', 'El Born', 'El Raval', 'Barceloneta', 'Eixample', 'Gràcia', 'Poble-sec', 'Sant Antoni', 'Poblenou'],
    'Valencia': ['Ciutat Vella', 'El Carmen', 'Ruzafa', 'El Cabanyal', 'Benimaclet', 'Ensanche', 'Ciudad de las Artes'],
    'Sevilla': ['Centro', 'Santa Cruz', 'Triana', 'La Alameda', 'Macarena', 'El Arenal', 'San Bernardo'],
    'Zaragoza': ['Casco Histórico', 'El Tubo', 'La Magdalena', 'San Pablo', 'Centro', 'El Gancho'],
    'Málaga': ['Centro Histórico', 'Soho', 'La Malagueta', 'El Perchel', 'La Trinidad', 'El Palo'],
    'Murcia': ['Centro', 'Santa Eulalia', 'San Antolín', 'La Catedral', 'El Carmen'],
    'Palma': ['Centro Histórico', 'La Lonja', 'Santa Catalina', 'El Terreno', 'Portixol'],
    'Las Palmas de Gran Canaria': ['Vegueta', 'Triana', 'Las Canteras', 'Guanarteme', 'Alcaravaneras'],
    'Bilbao': ['Casco Viejo', 'Abando', 'Bilbao La Vieja', 'San Francisco', 'Indautxu', 'Deusto'],
    'Alicante': ['Casco Antiguo', 'Barrio de Santa Cruz', 'Centro', 'El Postiguet', 'San Blas'],
    'Córdoba': ['Judería', 'San Basilio', 'Centro', 'San Lorenzo', 'Santa Marina', 'Ribera'],
    'Valladolid': ['Centro', 'Plaza Mayor', 'La Antigua', 'San Martín', 'Las Moreras'],
    'A Coruña': ['Ciudad Vieja', 'Pescadería', 'Monte Alto', 'Orzán y Riazor', 'Ensanche'],
    'Vitoria-Gasteiz': ['Casco Viejo', 'Ensanche', 'Coronación', 'El Anglo'],
    'Granada': ['Albaicín', 'Realejo', 'Sacromonte', 'Centro', 'Plaza Nueva'],
    'Oviedo': ['Casco Antiguo', 'Centro', 'El Fontán', 'Campo San Francisco'],
    'Santa Cruz de Tenerife': ['Centro', 'El Toscal', 'Barrio de Duggi', 'Los Llanos'],
    'Pamplona': ['Casco Antiguo', 'Primer Ensanche', 'Segundo Ensanche', 'La Rochapea', 'San Juan'],
    'Almería': ['Centro', 'La Alcazaba', 'La Chanca', 'Zapillo'],
    'Donostia-San Sebastián': ['Parte Vieja', 'Centro', 'Gros', 'Amara', 'El Antiguo'],
    'Santander': ['Centro', 'Puertochico', 'El Sardinero', 'Cuatro Caminos'],
    'Castellón de la Plana': ['Centro', 'El Grao', 'Casco Antiguo'],
    'Burgos': ['Centro Histórico', 'Catedral', 'San Pedro de la Fuente', 'Gamonal'],
    'Albacete': ['Centro', 'Carretas', 'El Ensanche'],
    'Logroño': ['Casco Antiguo', 'Calle Laurel', 'Centro'],
    'Badajoz': ['Casco Antiguo', 'Alcazaba', 'San Roque'],
    'Salamanca': ['Casco Histórico', 'Plaza Mayor', 'Barrio del Oeste', 'Garrido'],
    'Huelva': ['Centro', 'Barrio Obrero', 'El Molino de la Vega'],
    'Lleida': ['Centre Històric', 'La Seu Vella', 'Cappont'],
    'Tarragona': ['Part Alta', 'El Serrallo', 'Eixample'],
    'León': ['Barrio Húmedo', 'Barrio Romántico', 'Centro', 'San Mamés'],
    'Cádiz': ['Casco Antiguo', 'La Viña', 'El Pópulo', 'Santa María', 'Extramuros'],
    'Jaén': ['Casco Antiguo', 'La Magdalena', 'Centro'],
    'Ourense': ['Casco Vello', 'Centro', 'A Ponte'],
    'Girona': ['Barri Vell', 'El Call', 'Mercadal', 'Sant Narcís'],
    'Lugo': ['Casco Histórico', 'Muralla', 'Centro'],
    'Cáceres': ['Ciudad Monumental', 'Centro', 'Barrio de San Antonio'],
    'Guadalajara': ['Casco Antiguo', 'Centro'],
    'Toledo': ['Casco Histórico', 'Judería', 'Santa Teresa', 'Azucaica'],
    'Pontevedra': ['Zona Monumental', 'Centro', 'A Moureira'],
    'Palencia': ['Centro', 'Calle Mayor', 'El Cristo'],
    'Ciudad Real': ['Centro', 'Plaza Mayor', 'Barrio del Pilar'],
    'Zamora': ['Casco Antiguo', 'Centro', 'Barrio de San Frontis'],
    'Ávila': ['Intramuros', 'Centro', 'Barrio de San Nicolás'],
    'Cuenca': ['Casco Antiguo', 'Ciudad Moderna', 'Barrio de San Antón'],
    'Huesca': ['Casco Antiguo', 'Centro'],
    'Segovia': ['Recinto Amurallado', 'Barrio de San Millán', 'El Salvador', 'San Lorenzo'],
    'Soria': ['Casco Antiguo', 'Centro'],
    'Teruel': ['Centro Histórico', 'El Arrabal', 'Ensanche'],
    'Ceuta': ['Centro', 'El Recinto'],
    'Melilla': ['Melilla la Vieja', 'Centro Modernista'],
}

# Mapa de Madrid: proyección simple (equirectangular corregida) y celdas de Voronoi recortadas a un rectángulo
lat0, lat1, lng0, lng1 = 40.3925, 40.4400, -3.7265, -3.6770
K = 10000
cx = math.cos(math.radians((lat0 + lat1) / 2))
W, H = (lng1 - lng0) * cx * K, (lat1 - lat0) * K
esc = 520 / W
pt = lambda la, ln: (((ln - lng0) * cx * K) * esc, ((lat1 - la) * K) * esc)
P = np.array([pt(la, ln) for _, la, ln in MADRID])
lejos = np.array([[-5000, -5000], [5000, -5000], [-5000, 5000], [5000, 5000]])
vor = Voronoi(np.vstack([P, lejos]))
marco = box(0, 0, W * esc, H * esc)
zonas_m = []
for i, (nombre, la, ln) in enumerate(MADRID):
    reg = vor.regions[vor.point_region[i]]
    poly = Polygon([vor.vertices[v] for v in reg]).intersection(marco)
    poly = poly.buffer(-2.2)  # separación entre celdas
    d = 'M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in list(poly.exterior.coords)[:-1]) + ' Z'
    zonas_m.append({'id': IDS_MADRID.get(nombre, slug(nombre)), 'nombre': nombre, 'd': d, 'x': round(P[i][0], 1), 'y': round(P[i][1], 1)})

datos = [{'ciudad': 'Madrid', 'mapa': {'ancho': round(W * esc), 'alto': round(H * esc)}, 'zonas': zonas_m}] + [
    {'ciudad': c, 'zonas': [{'id': slug(z), 'nombre': z} for z in zs]} for c, zs in sorted(OTRAS.items())]
for c in datos:
    ids = [z['id'] for z in c['zonas']]; assert len(ids) == len(set(ids)), c['ciudad']
js = ('// Zonas de «Mis salidas» (MD+). GENERADO por herramientas/zonas.py: no editar a mano.\n'
      '// Madrid lleva un mapita esquemático del centro (celdas de Voronoi, no es un plano exacto).\n'
      '(function (datos) {\n  if (typeof module !== "undefined" && module.exports) module.exports = datos;\n  else window.ZONAS_MD = datos;\n})('
      + json.dumps(datos, ensure_ascii=False) + ');\n')
for p in ('MirarDespacio/js/zonas.js', 'netlify/lib/zonas.js'):
    open(os.path.join(RAIZ, p), 'w').write(js)
print(len(datos), 'ciudades ·', len(zonas_m), 'zonas en Madrid ·', round(W * esc), 'x', round(H * esc))
