# Acceso sin contraseña y recuperación supervisada

**Objetivo:** que el estudiante no necesite al profesor cada vez que olvida su contraseña, sin abrir un acceso anónimo
ni dar a nadie (tampoco a los monitores) la posibilidad de entrar en cuentas ajenas.

**Estado:** implementado y probado en local (migración `20261104000077_acceso_sin_contrasena.sql`, Edge Function
`recuperar`, pantallas del aula y módulo de Orbe Control). **No aplicado en producción.** Todo nace **apagado**.

## 1. Piezas

| Pieza | Dónde | Qué hace |
|---|---|---|
| Sesiones persistentes | `src/lib/supabase.ts` (sin cambios) | supabase-js guarda la sesión y renueva el token (≈1 h) con el token de renovación: la sesión dura hasta «Salir», «Mis sesiones» o un cambio en Supabase Auth. No se alarga el JWT ni se cierran sesiones existentes. |
| Passkeys | `src/pages/estudiante/Passkeys.tsx`, botón en `Acceso.tsx` | `supabase.auth.registerPasskey()` (exige sesión válida; lo comprueba Supabase Auth), `auth.passkey.list/delete`, `auth.signInWithPasskey()`. La clave privada no sale del dispositivo. Interruptor `acceso_config.passkeys`. |
| Recuperación supervisada | `src/pages/publico/Recuperar.tsx` + función `recuperar` + migración 77 | Verificación **presencial** por el profesor o un monitor delegado; la sesión la crea Supabase Auth con un token de un solo uso. |
| Panel «Gestión de acceso estudiantil» | aula: `/gestion-acceso` (`src/pages/docente/GestionAcceso.tsx`); Orbe Control: pestaña 🔐 Acceso (`orbe-control/src/AccesoOrbe.tsx`) | Pendientes, aprobadas, rechazadas, historial, alertas y controles; filtros por sección, estudiante, responsable (monitor/profesor), fecha y estado. |
| Auditoría | tabla `acceso_eventos` | Inmutable (disparadores contra UPDATE, DELETE y TRUNCATE, también para el propietario); hora del servidor; sin contraseñas, tokens, secretos ni códigos. |

## 2. Flujo de recuperación (solo presencial)

1. **Solicitud** (sin sesión). El estudiante escribe su ID y elige «Profesor» o «Monitor de mi sección» (sin nombres).
   El navegador genera un secreto de 32 bytes que **solo guarda esta pestaña** (`sessionStorage`); al servidor llega
   su SHA-256. El servidor devuelve un **código de 6 caracteres** para mostrar en persona.
   La respuesta (y su duración mínima) es **la misma** exista o no la cuenta, sea o no elegible: las cuentas inexistentes,
   docentes o de secciones sin el servicio generan una solicitud «señuelo» que nadie ve y que vence sola.
2. **Verificación presencial.** El profesor (o un monitor con el permiso) ve la solicitud en su panel, comprueba la
   identidad con un documento, escribe el **código que muestra el dispositivo del estudiante** (ata la aprobación a ese
   dispositivo: impide sustituir una solicitud por otra), indica el método (carné, cédula, otro documento, conocimiento
   personal) y aprueba. **La aprobación no autentica**: vence en 10 minutos (configurable) y se anota en la auditoría.
3. **Canje** (un solo uso). El dispositivo, que consulta el estado cada 4 s, canjea con su secreto. El servidor vuelve a
   comprobar todo (interruptores, elegibilidad, permiso vigente del monitor), marca la solicitud como completada,
   **obliga a elegir contraseña nueva** (mismo mecanismo que la contraseña provisional) y deja un aviso interno al estudiante.
4. **Sesión oficial.** La función obtiene de Supabase Auth un token de un solo uso con
   `auth.admin.generateLink({ type: 'magiclink' })` — **no envía correo**; solo se usa `hashed_token` — y lo entrega
   únicamente a ese dispositivo, que lo verifica con `supabase.auth.verifyOtp({ token_hash, type })`. Quien crea la sesión
   es Supabase Auth. Luego: contraseña nueva obligatoria y oferta de activar una passkey.

Nadie inventa JWT, ni se crean sesiones en `localStorage` o en el frontend (lo comprueba `tests/acceso.test.ts`).
El monitor nunca ve tokens, contraseñas, enlaces ni el código (no se guarda: solo su hash ligado al id de la solicitud).

## 3. Permisos

- **Monitor** (`student_access_recovery_approve`, implementado como `acceso_monitores`): solo si el profesor se lo
  otorga en una sección concreta, la sección tiene activada la delegación y el interruptor general está encendido.
  **Ningún monitor actual lo recibe automáticamente.** Puede ver las solicitudes **dirigidas a monitores** de sus
  secciones, aprobar con verificación, rechazar con motivo, revocar sus propias aprobaciones sin canjear y ver ese
  historial. No puede: cambiar notas, reiniciar prácticas, ver o cambiar contraseñas, obtener tokens, crear cuentas,
  dar permisos, actuar en otras secciones, cancelar, configurar, ver alertas ni modificar la auditoría.
  Tampoco puede aprobar su propia solicitud, la de otro monitor (solo el profesor), una solicitud hecha desde una
  instalación del navegador en la que él inició sesión, ni más de 5 al día (configurable).
- **Profesor** de la sección (o administrador): todo lo anterior más cancelar, revocar cualquier aprobación sin
  canjear, alertas, interruptores de su sección y otorgar o **suspender al instante** el permiso de cada monitor
  (suspender anula sus aprobaciones sin canjear).
- **Sesión reciente:** aprobar, activar interruptores y otorgar permisos exigen una sesión válida (existente en
  `auth.sessions`) iniciada hace menos de 12 h (configurable). Desactivar o suspender nunca lo exige.
- Solo se recuperan cuentas de **estudiantes** activos (no suspendidos ni bloqueados en Auth). Las cuentas de profesor o
  administrador nunca son elegibles (y el intento genera una alerta).

Todo se comprueba en el servidor (funciones `SECURITY DEFINER`); las tablas no tienen permisos por REST.

## 4. Abusos considerados

| Riesgo | Defensa |
|---|---|
| Solicitudes masivas | Límite por red (30/h, con alerta) y por ID declarado (3 en 24 h, exista o no). |
| Enumeración de cuentas | Respuesta y tiempo uniformes; señuelos indistinguibles; los límites no dependen de que la cuenta exista. |
| Suplantación (pedir con la matrícula de otro) | Verificación presencial con documento; el código ata la aprobación al dispositivo que está delante. |
| Aprobación entre secciones | Papel calculado por sección en el servidor; el monitor solo ve lo dirigido a monitores de su sección. |
| Reutilización / repetición | Canje de un solo uso con bloqueo de fila; token de Supabase Auth de un solo uso; otras solicitudes activas de la cuenta se cancelan al aprobar. |
| Secuestro desde otro dispositivo | Sin el secreto del dispositivo no se puede consultar ni canjear (3 fallos → alerta). |
| Códigos adivinados | 5 códigos incorrectos cancelan la solicitud (alerta). |
| Recuperar cuentas docentes | No elegibles; alerta. |
| Sesión del monitor robada o antigua | Exige sesión reciente; límite diario; alerta de supervisión en cada aprobación de monitor; el profesor suspende al instante. |
| Monitor que se aprueba a sí mismo una cuenta ajena | Bloqueo si la solicitud sale de una instalación del navegador del monitor; alerta; aviso al estudiante; supervisión del profesor. Riesgo residual: ver §6. |
| Manipular el frontend / llamar REST/RPC directamente | Ninguna decisión está en el cliente; las tablas no tienen permisos; las funciones `svc_*` son solo de `service_role`. |

## 5. Activación progresiva (todo apagado por defecto)

1. Aplicar la migración y desplegar la función `recuperar` (con autorización del plan). Nada cambia para nadie.
2. Panel → `/gestion-acceso` → Controles (u Orbe Control → 🔐 Acceso → Controles), con sesión reciente:
   - Interruptor general «Recuperación supervisada».
   - En cada sección: «Recuperación supervisada» y, si se quiere, «Permitir que monitores designados aprueben».
   - Otorgar el permiso a monitores concretos. Suspender es inmediato.
3. **Passkeys:** antes de encender el interruptor, habilitar passkeys/WebAuthn en Supabase Auth (panel de Supabase) con
   el dominio `theoreticallab.github.io` como RP ID y origen permitido, y probar con la cuenta del profesor y una de prueba.

## 6. Limitaciones (documentadas, no ocultas)

- **No hay canal verificado externo.** Las cuentas usan correos técnicos aleatorios: el aviso al estudiante es interno
  (mensaje del aula). Si la recuperación la hizo otra persona, el titular lo nota porque su contraseña deja de servir;
  la auditoría y las alertas permiten al profesor reconstruir quién aprobó y cómo.
- **Un monitor delegado malicioso** podría, con la cuenta de un compañero y otro dispositivo, aprobar una solicitud
  que él mismo hizo. Es el riesgo inherente a delegar la verificación de identidad en una persona. Se mitiga (límite
  diario, alerta por cada aprobación de monitor, bloqueo por instalación compartida, cuentas de monitores solo por el
  profesor, suspensión inmediata), pero no se elimina. Por eso la delegación es opcional y por sección.
- **Registro de passkeys con sesión «reciente»:** lo controla Supabase Auth (exige sesión activa); el aula no puede
  imponer una antigüedad máxima a esa llamada.
- **Configuración real de Supabase no verificada desde aquí:** la duración de sesiones (`sessions_timebox`,
  `sessions_inactivity_timeout`) y la habilitación de passkeys del proyecto se comprueban con `npm run estado` y el panel
  de Supabase. `generateLink` (magiclink) y `verifyOtp` con `token_hash` son API oficiales, pero su prueba real solo
  puede hacerse en el proyecto (prueba local con GoTrue simulado).
- Si Supabase Auth no emite el token tras el canje, la solicitud queda usada y el estudiante pide otra (se registra y alerta).

## 7. Pruebas

- `supabase/pruebas/acceso_recuperacion.sql` (base local): todo apagado por defecto; activación solo por admin/profesor
  con sesión reciente; respuesta uniforme (cuenta inexistente, docente, sección sin servicio); visibilidad y aprobación
  por papel; sección ajena; estudiante; sesión antigua; código ajeno; método inválido; señuelo; canje sin secreto, de un
  solo uso, con contraseña obligatoria y aviso; sin secretos en la auditoría; flujo de monitor (otra sección, sesión
  antigua, mismo dispositivo, propia cuenta, cuenta de otro monitor, cancelar/administrar prohibido, historial);
  suspensión inmediata; límite diario; cancelación de otras solicitudes; rechazo con motivo; revocación; vencimientos;
  límite por ID; interruptor general; auditoría inmutable; datos académicos intactos. **Mutaciones:** 18/18 detectadas
  (`privado/tmp/mutar-acceso.mjs`).
- `tests/recuperar.test.ts` (Edge Function): solo hashes al servidor, respuesta uniforme, mensajes, canje sin correo en
  la respuesta, sin token si Supabase Auth no lo emite, entradas inválidas.
- `tests/acceso.test.ts`: lógica del cliente y flujo completo simulado dispositivo ↔ función ↔ GoTrue (token de un solo
  uso, otro dispositivo, estados finales, token rechazado) y comprobación de que el frontend no fabrica sesiones.
- Regresión: `npm run verificar` (tipos, 1 321 pruebas Vitest, compilación del aula y de Orbe Control, secretos en dist,
  revisión de migraciones) y `npm run probar` sobre la copia del respaldo de producción.

### Casos pedidos

| # | Caso | Cómo se comprueba |
|---|---|---|
| 1 | Sesión normal | `acceder` sin cambios; regresión completa. |
| 2 | Sesión persistente | Configuración de supabase-js sin cambios (renovación automática). Duración real del proyecto: verificar con `npm run estado`. |
| 3 | Passkey válida | Solo en el proyecto real (WebAuthn + Supabase Auth): pendiente de la prueba con la cuenta del profesor. |
| 4 | Passkey ajena | Idem (la rechaza Supabase Auth; la clave privada nunca sale del dispositivo). |
| 5 | Solicitud al profesor | SQL §2–4. |
| 6 | Solicitud al monitor | SQL §5. |
| 7 | Monitor aprueba | SQL §5. |
| 8 | Entre secciones | SQL §3 y §5 (profesor de B, monitor de B). |
| 9 | Matrícula ajena | Verificación presencial (humana) + código atado al dispositivo + canje solo con el secreto (SQL §4, `tests/acceso.test.ts`). |
| 10 | Otro dispositivo | SQL §4 y flujo simulado. |
| 11 | Vencida | SQL §6. |
| 12 | Revocada | SQL §5 (suspensión del monitor) y §6 (revocación). |
| 13 | Función administrativa sin permiso | SQL §0, §1, §5. |
| 14 | Trazabilidad | SQL §1, §3, §4 (actor, papel, sección, estudiante, método, resultado, motivo, hora del servidor). |
| 15 | Prácticas abiertas conservan respuestas | El canje solo toca `must_change_password`/`password_fingerprint`; SQL §8 comprueba que no se tocan intentos ni notas. |
| 16 | Exámenes sin cambios | Ni el motor de examen ni la calificación se modificaron; regresión completa. |
