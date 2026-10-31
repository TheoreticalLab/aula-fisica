# Asistencia autónoma por quórum de proximidad

Segundo mecanismo de activación de la asistencia. El mecanismo manual del profesor (código rotativo + ubicación del
profesor + radio de 100 m, migraciones 24–26) **no cambia**.

## Qué se reutiliza

| Existente | Uso |
|---|---|
| `attendance_sessions` | la sesión activada por quórum es una sesión más (`activacion = 'quorum'`); centro `geo_lat/geo_lng`, radio `geo_radius_m` (100 m por defecto) |
| `attendance_records` (clave única sesión + estudiante) | deduplicación: un estudiante nunca queda dos veces; métodos nuevos `quorum` y `proximidad` (se amplió la lista; los anteriores siguen válidos) |
| `geo_distance_m` (semiverseno) | todas las distancias |
| huella del identificador de instalación | un dispositivo no puede marcar a dos estudiantes; tres cuentas en un dispositivo no forman quórum |
| `attendance_rejections` | rechazos «lejos» y «dispositivo compartido» |
| `attendance_close`, `attendance_set`, `attendance_start`, `attendance_new_code` | control del profesor intacto: cerrar, marcar o quitar a mano, abrir con código (cierra la de quórum), habilitar también un código |
| `attendance_live`, `attendance_set_location` | misma firma; se añadieron activación, franja, quórum inicial, validación e incidencias, y el registro auditado del cambio de centro |
| página Asistencia y pestaña Asistencia de la sección | se añadió el panel de quórum y la tarjeta de configuración |
| Orbe Control · Asistencia (`orbe-control/src/Asistencia.tsx`) | la vista en vivo muestra «Activada por quórum» (hora programada, activación real, quórum inicial, validación de cada presente e incidencias) con los mismos controles (cerrar, marcar, quitar, habilitar también código); y la tarjeta «Asistencia autónoma por quórum» (`QuorumConfig.tsx`) configura la sección elegida con las mismas funciones del servidor que el panel web |

Nuevo: horario semanal por sección (`class_schedules`, hora de America/Santo_Domingo), configuración
(`attendance_quorum_settings`), solicitudes temporales (`attendance_quorum_requests`) e incidencias
(`attendance_quorum_events`). Migración `20261101000043_asistencia_quorum.sql`. Todo se decide en funciones del servidor.

## Reglas (parámetros configurables por sección; valores iniciales)

- **Ventana:** desde la hora programada y durante 20 min se puede formar el quórum (cerrar la ventana no cierra una
  asistencia ya activada, que dura 90 min o hasta que el profesor la cierre).
- **Quórum:** 3 estudiantes distintos, matriculados, con dispositivos distintos, cuyas solicitudes llegaron dentro de
  los últimos 120 s, con mediciones de antigüedad ≤ 60 s y precisión ≤ 40 m, y $\max_{i,j} d(P_i,P_j) \le R_q = 50$ m.
  Una cuenta tiene una sola posición vigente por franja (una solicitud nueva reemplaza a la anterior).
- **Activación inmediata y atómica:** al cumplirse, la misma llamada crea la sesión y registra a los tres. Un candado
  transaccional por sección serializa las decisiones y un índice único `(sección, franja)` impide dos sesiones de quórum
  en la misma franja aunque dos grupos lo alcancen a la vez. Si ya hay una sesión manual abierta, se usa esa (con su
  código); si el profesor cerró la de quórum, no se reabre en esa franja.
- **Centro $C_0$:** media de las posiciones del quórum (incertidumbre: precisión media). No se mueve; solo el profesor
  puede cambiarlo (`attendance_set_location`, queda registrado).
- **Validación progresiva:** un estudiante que llega queda presente si $d(P, C_0) \le R_a = 100$ m **y**
  $\min_i d(P, P_i) \le R_p = 50$ m sobre las referencias **vigentes** (posición de cada admitido durante 15 min). La
  zona no se desplaza: la condición $d(P, C_0) \le R_a$ se exige siempre.
- **Incertidumbre:** frente a un radio $R$, compatible si $d \le R$; incompatible si $d - (a_1 + a_2) > R$; inconclusa en
  otro caso. Una medición imprecisa o antigua no decide nada. **Inconclusa no es ausencia**: el estudiante puede
  reintentar y el profesor puede validarlo a mano.
- **Referencias caducadas:** no autorizan. Un estudiante ya presente puede renovar su referencia con una medición
  puntual desde su mismo dispositivo y dentro de la zona; no es necesario para conservar su asistencia.

## Privacidad y retención

La ubicación se pide solo al pulsar un botón; no hay seguimiento. El estudiante nunca recibe posiciones de otros. El
profesor ve distancias y precisiones, no coordenadas. Solicitudes: 7 días. Coordenadas de los registros por quórum o
proximidad: 30 días (se conservan distancias). Incidencias: 180 días.

## Seguridad y limitaciones residuales

El servidor impone identidad (sesión autenticada), matrícula, horario, ventana de simultaneidad, antigüedad y precisión
declaradas, dispositivos distintos y consistencia; el cliente no puede activar una sesión llamando a otra función (el
núcleo de admisión no es invocable) ni registrar a otro estudiante.

**No puede certificar la posición física.** La ubicación, su precisión y su antigüedad las informa el dispositivo, y
con herramientas de simulación de ubicación pueden falsearse; el identificador de instalación se puede borrar o
cambiar; una persona con varios teléfonos y varias cuentas podría reunir un quórum. Las reglas impiden lo habitual
(marcar desde casa, que un compañero marque por otro con su teléfono), no un ataque deliberado. El profesor ve el
quórum inicial, cada validación con su distancia y referencia, y las incidencias, y puede corregir.

## Pruebas

| Caso | Dónde |
|---|---|
| 1–6, 9, 11, cadena que no desplaza la zona, mensajes, horario con cruce de medianoche, 500 quórums aleatorios válidos | `tests/quorum.test.ts` (lógica pura, réplica de las reglas del servidor) |
| 1–12 en el servidor (incluidos 7: repetición y doble sesión bloqueada por el índice; 8: sesión manual; 12: permisos) | `supabase/pruebas/asistencia_quorum.sql` (requiere `npm run probar`) |

El caso 7 se prueba de forma secuencial y con el índice único; la simultaneidad real (dos conexiones a la vez) la
garantizan el candado transaccional y el índice, pero no se ejecutó con conexiones concurrentes. Sin probar todavía en
teléfonos reales dentro de un edificio.
