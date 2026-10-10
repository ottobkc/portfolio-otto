# Galerías privadas de clientes

Cada sesión (pedidas, parejas, actores…) tiene su galería en `ottokols.es/galeria/?c=CÓDIGO`.
El cliente entra con el código, elige sus fotos, envía la selección y, cuando están editadas, las descarga en HD.

Otto lo gestiona todo desde **ottokols.es/crm/galerias.html** (misma cuenta que el CRM). No hace falta entrar ni en Cloudinary ni en R2.

## Flujo

1. **Crear la galería** en el panel: nombre de los clientes, sesión y número de fotos que pueden elegir (8, 15, 20 u otro). El código se crea solo o se escribe a mano.
2. **Vistas previas**: exportar de Lightroom en JPG (con un ajuste básico, mejor que el RAW plano) y arrastrarlas al panel. El navegador las reduce a 2000 px y las sube a Cloudinary como imágenes privadas («authenticated»). El cliente las ve siempre con marca de agua: la URL va firmada y la firma incluye la marca, así que no se puede pedir la foto limpia tocando la URL.
3. **Copiar el mensaje** del panel y mandarlo por WhatsApp. Lleva el enlace y el código.
4. **El cliente elige**. La selección se guarda sola mientras marca. Al pulsar «Enviar selección», a Otto le llega un email con los nombres de archivo listos para el filtro de texto de Lightroom. Desde el panel se puede reabrir si quieren cambiar algo.
5. **Entrega**: arrastrar las fotos editadas al panel. Van directas del navegador a Cloudflare R2 **sin recomprimir ni reducir**, del tamaño que sean. Además se crea una miniatura en Cloudinary para que el cliente las vea. Si se vuelve a subir una foto con el mismo nombre, sustituye a la anterior.
6. **Marcar como entregada**: se activan las descargas durante 30 días. El cliente descarga cada foto o todas en un ZIP (el ZIP se monta en su navegador; en el móvil es mejor una a una).
7. **Limpieza**: «Borrar vistas previas» libera Cloudinary (la portada se queda). «Borrar galería entera» lo quita todo.

## Configuración (una sola vez)

### Cloudinary
Ya están `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET` en Netlify (las usa la limpieza de fotos). No hay que tocar nada más.

### Cloudflare R2 (fotos HD)
1. Cloudflare → R2 → crear un bucket `ottokols-galerias-eu` con **Location → Specify jurisdiction → European Union (EU)**, para que las fotos de clientes estén garantizadas en la UE (RGPD). Sin acceso público. (La opción «location hint» no sirve para esto: es orientativa y no garantiza el sitio.)
2. R2 → Manage API tokens → crear un token con permiso **Object Read & Write** solo para ese bucket. Apuntar el *Access Key ID* y el *Secret Access Key* (el secreto solo se ve una vez).
3. En el bucket → Settings → **CORS policy**, pegar:

```json
[
  {
    "AllowedOrigins": ["https://ottokols.es"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length"],
    "MaxAgeSeconds": 3600
  }
]
```

4. En Netlify (sitio ottokols) → Site configuration → Environment variables, añadir:

| Variable | Valor |
|---|---|
| `R2_ACCOUNT_ID` | el Account ID de Cloudflare (sale en la página de R2) |
| `R2_ACCESS_KEY_ID` | del token |
| `R2_SECRET_ACCESS_KEY` | del token (marcar como secreta) |
| `R2_BUCKET` | `ottokols-galerias-eu` |
| `R2_JURISDICTION` | `eu` |

5. Opcional: `AVISO_GALERIAS` = email al que llegan los avisos de selección (si no, va al de siempre).

El panel muestra arriba «Cloudinary ✓ · R2 ✓» cuando todo está bien configurado.

## Archivos

- `netlify/lib/galerias.js` — firmas de Cloudinary y R2, códigos de acceso.
- `netlify/functions/galeria.js` — lo que usa el cliente (ver, guardar y enviar la selección, descargar).
- `netlify/functions/galerias-admin.js` — lo que usa el panel (solo la cuenta de administración).
- `PortfolioOtto/galeria/index.html` — la galería del cliente.
- `PortfolioOtto/crm/galerias.html` — el panel.
- Firestore: colección `galerias` (la protege la regla general del CRM: desde el navegador solo el admin).

## Seguridad

- Los códigos tienen 4 letras y 4 cifras. Quien prueba códigos que no existen se bloquea tras 15 intentos en una hora.
- Las vistas previas no se pueden abrir sin una URL firmada por el servidor, y siempre llevan marca de agua.
- Las HD se descargan con enlaces que caducan a las 6 horas (la página genera enlaces nuevos cada vez que se abre) y solo mientras la galería no ha caducado.
