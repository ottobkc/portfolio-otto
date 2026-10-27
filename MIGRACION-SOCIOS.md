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
4. Reglas de Firestore: pegar las nuevas de `PortfolioOtto/crm/firestore.rules` (exigen email verificado al admin).

Variable `SESION_SOCIOS` (la misma en los dos sitios): firma la cookie de sesión de los socios.

## Rama pendiente-alta (pagos)

El webhook de Stripe llama a `T.invitarIdentity(context, email)` (lib/talleres.js). Al sincronizar con main,
cambiar esa función por `require('./cuentas').invitarCon(context, email, 'plus')`: funciona igual en los dos modos.
Los talleres pagados que dan manual usan `require('./cuentas').darManual(context, email, tallerId)`.
