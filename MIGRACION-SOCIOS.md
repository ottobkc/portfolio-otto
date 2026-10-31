# Migración de la zona de socios: de Netlify Identity a Firebase

Objetivo: entrar sin contraseña (enlace al correo), roles en Firestore y toda la zona de socios en
mirardespacio.es. ottokols.es se queda con los servicios de fotografía y el CRM.

## Respaldo y vuelta atrás

- Código: la rama `respaldo-antes-migracion-socios` es una copia exacta de producción antes de empezar (commit 3424840).
- Netlify: en cada sitio, Deploys → el deploy anterior → «Publish deploy» devuelve la versión anterior al momento.
- Cuentas: el CRM (Accesos y MD+ → Cuentas → «Descargar respaldo») guarda todos los usuarios de Identity en
  `respaldo_identity` y los descarga como JSON. Identity NO se borra hasta el final de la fase 3.
- Mientras `CUENTAS_MODO` no sea `firebase`, Identity sigue mandando: basta con volver al deploy anterior.

## Fases

| Fase | Sitio | Qué cambia para la gente | Cómo se prueba | Vuelta atrás |
|---|---|---|---|---|
| 1 | ottokols.es | Nada. El CRM escribe en Identity **y** en Firestore (`CUENTAS_MODO` sin poner = `doble`) | Respaldo, informe y «Copiar a Firebase» desde el CRM; cambiar un acceso y ver que sale en los dos | Publish deploy anterior |
| 2 | mirardespacio.es | Aparece la zona nueva (acceso con enlace, manuales, recursos…) protegida por la función edge `socios`. La antigua sigue igual | Deploy Preview: entrar, URLs en mayúsculas, `%2F`, rol equivocado, sin cookie | Publish deploy anterior |
| 3 | los dos | Redirecciones 301 de ottokols.es; `CUENTAS_MODO=firebase`; «Unir actividad» en el CRM | Probar las URL antiguas y el CRM | Quitar `CUENTAS_MODO` y Publish deploy anterior |

## Antes de la fase 2 (Firebase Console, proyecto mirardespaciocrm)

1. Authentication → Sign-in method → Email/Password: activar **Email link (passwordless sign-in)**.
2. Authentication → Settings → Authorized domains: añadir `mirardespacio.es` (y el dominio de las Deploy Previews: `mirar-despacio.netlify.app`).
3. Authentication → Settings → User actions: «Enable create (sign-up)» sigue **desactivado**.

Las reglas de Firestore no cambian: el admin se reconoce por su email, y para entrar con ese email hace
falta leer el correo de Otto (el enlace solo llega a su buzón).

## Cómo funciona la zona nueva (mirardespacio.es)

- `/acceso/`: pide el email y la función edge `socios` le pide a ottokols.es (función `socios`) que mande
  el enlace. Solo llega si el email tiene cuenta con algún acceso; la respuesta en pantalla es siempre la misma.
- El enlace vuelve a `/acceso/`, entra con Firebase y pide la cookie `md_socio` (firmada con `SESION_SOCIOS`, 12 h).
- La función edge comprueba la cookie antes de servir `/socios/`, `/retos/`, `/cuaderno/` y `/manuales/<id>/`.
- Las páginas usan `/js/sesion.js`, que imita al widget de Identity (mismas llamadas), y llaman a las funciones
  de ottokols.es por `/api/f/*` (proxy de netlify.toml).
- Desde la fase 3, las páginas de la zona viven solo en MirarDespacio/ (socios/, manuales/, cuaderno/, retos/, subir/, js/)
  y se editan ahí. ottokols.es solo redirige las direcciones antiguas.

## Pruebas en la Deploy Preview (fase 2)

1. Sin entrar: `/socios/`, `/retos/`, `/cuaderno/`, `/manuales/atardecer/` → todas llevan a `/acceso/`.
2. Variantes: `/MANUALES/atardecer/`, `/manuales/atardecer/index.html`, `/manuales%2Fatardecer/`, `/socios/dof-calculator.html` → nunca enseñan contenido sin entrar.
3. Pedir enlace con un email con manual → llega el correo en español → entra directo al manual.
4. Con esa cuenta, `/socios/` y otro manual → «no tiene acceso a esa parte».
5. Con una cuenta MD+: portada, una herramienta, retos, cuaderno, subir una foto de prueba.
6. Cerrar sesión → `/socios/` vuelve a pedir el email.
7. Un email sin cuenta → mismo mensaje y no llega nada.

Variable `SESION_SOCIOS` (la misma en los dos sitios): firma la cookie de sesión de los socios.

## Rama pendiente-alta (pagos)

El webhook de Stripe llama a `T.invitarIdentity(context, email)` (lib/talleres.js). Al sincronizar con main,
cambiar esa función por `require('./cuentas').invitarCon(context, email, 'plus')`: funciona igual en los dos modos.
Los talleres pagados que dan manual usan `require('./cuentas').darManual(context, email, tallerId)`.

## Fase 3, paso a paso

1. Netlify → stalwart-panda-3d94db → Environment variables: `CUENTAS_MODO` = `firebase` (Production y Deploy Previews).
2. Publicar la rama `socios-fase3` en main (solo construye ottokols.es).
3. Comprobar: ottokols.es/acceso.html, /recursos.html, /manuales/atardecer/, /subir/?c=… llevan a mirardespacio.es; el CRM
   lista las cuentas (Accesos → Cuentas) y cambiar un acceso funciona.
4. CRM → Accesos → Cuentas: «4 · Unir la actividad antigua», «5a» (prueba) y «5b» (aviso a los socios).
5. Firebase → Authentication → Configuración → Dominios autorizados: quitar `deploy-preview-2--mirar-despacio.netlify.app`.
6. Pasada una semana sin problemas: Netlify → stalwart-panda → Identity → desactivarlo.

Vuelta atrás de la fase 3: quitar `CUENTAS_MODO` y «Publish deploy» del deploy anterior de ottokols.es. Las cuentas de
Identity siguen ahí hasta el paso 6.
