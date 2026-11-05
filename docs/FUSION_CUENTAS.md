# Fusión de cuentas duplicadas de estudiantes — diagnóstico y diseño

**Estado:** implementado y probado en local el 4-nov-2026 (migración `20261104000082_fusion_cuentas.sql` y la pestaña
Cuentas → «Cuentas duplicadas»). **Sin aplicar en producción**; no se ha ejecutado ninguna fusión real.

Decisiones del administrador:
- **Conflictos:** el intento que no vale queda en la cuenta fusionada.
- **ID de acceso:** se elige en cada fusión; la principal puede quedarse con la matrícula de la secundaria.
- **Reversión:** incluida, con evaluación previa.

Fuentes de la auditoría (todas reales, nada supuesto):
- **Catálogo de PostgreSQL** de la base local con las 81 migraciones aplicadas
  (`privado/tmp/auditoria-fusion.mjs` y `auditoria-fusion-2.mjs`; resultados en `privado/tmp/auditoria-fusion*.json`).
- **Código** de las funciones del servidor (`entregas`, `acceder`, `admin-cuentas`) y de las migraciones que redefinen
  el cálculo de notas.
- **Respaldo de producción** del 4-nov 23:15 (`privado/tmp/duplicados-respaldo.py`; solo lectura, local).

## 1. Cómo se representa un estudiante

- **`auth.users`** (Supabase Auth): correo técnico aleatorio y contraseña; sesiones en `auth.sessions` (tokens de
  renovación) e identidades en `auth.identities`.
- **`public.profiles`** (mismo `id` que `auth.users`, ON DELETE CASCADE): `login_id` (el ID con el que entra, único),
  `full_name`, `student_code`, `role`, `active`, `must_change_password`, `suspended_at`.
- **Inicio de sesión:** la función `acceder` busca el perfil por `login_id`, rechaza si `active = false` (respuesta
  genérica) y entra con el correo técnico. La recuperación presencial (migración 77) y la reactivación por
  inactividad (migración 79) solo aceptan cuentas activas o suspendidas por inactividad.
- **Bloqueo en el servidor:** `account_ok(usuario)` (activa, sin contraseña provisional, sin regularización pendiente,
  sin inactividad vencida) condiciona casi todas las políticas RLS y las funciones.

## 2. Inventario de dependencias (catálogo real)

- **172 claves foráneas** hacia `profiles(id)` o `auth.users(id)` en **128 tablas**. Todas las tablas de `public`
  tienen RLS.
- **61 tablas con datos propios del estudiante** (`user_id` con ON DELETE CASCADE: si se borrara la cuenta, se
  borrarían). Por su «ancla»:

| Ancla | Tablas |
|---|---|
| **Intento** (`attempt_id`) — viajan con su intento | attempts, responses, response_revisions, response_events, attempt_snapshots, attempt_active_time, assisted_steps, exam_sessions, exam_events, exam_intervals, exam_item_events, exam_adaptive_state, telemetry_events, telemetry_v2_events, control_assignments |
| **Práctica extraordinaria** (`practica_id`) | pes_asignaciones, pes_estado, pes_respuestas, pes_controles |
| **Sección** (`class_id`) | enrollments, grade_entries, grade_history, grade_part_scores, extra_points, class_monitors, class_upload_delegates, acceso_solicitudes, acceso_monitores, hist_captures, hist_cierres, hist_declarations, hist_libres, hist_libre_fotos, hist_libre_avisos, hist_suggestions, duplicate_requests, attendance_quorum_requests, lost_alerts |
| **Sesión de asistencia** | attendance_records, attendance_rejections |
| **Buzón de entregas** | upload_files, upload_permissions; upload_fingerprints (huellas) |
| **Lectura / estudio** | reading_progress, study_visits, study_clock |
| **Mensajes** | live_message_recipients, quick_poll_recipients, screen_locks |
| **Cuenta (no académicas)** | cuenta_actividad, cuenta_suspensiones, known_devices, presence_connections, orbe_ia_prefs, orbe_ia_deliveries, class_ai_prefs, attendance_failures, join_failures |
| **Profesorado** (no aplica a estudiantes) | class_teachers, course_staff |

- **Columnas de «autor»** con ON DELETE SET NULL (graded_by, assigned_by, actor…): registran quién hizo algo. Si el
  autor fue el propio estudiante (por ejemplo, un monitor que asignó puntos, o eventos de la regularización),
  pueden trasladarse a la principal sin cambiar ninguna nota.
- **Sin clave foránea:** `acceso_eventos` y `acceso_alertas` (auditoría inmutable) y `data_export_users`. Se dejan
  intactas; la fusión registra la correspondencia entre las dos cuentas.
- **31 restricciones de unicidad con usuario.** Son los puntos de colisión:
  - un solo intento en curso por actividad;
  - una matrícula por sección;
  - una nota manual por sección y apartado del registro;
  - una asignación y un estado por práctica extraordinaria; una respuesta PES por apartado;
  - un registro de asistencia por sesión;
  - un progreso de lectura por actividad;
  - un destinatario por mensaje;
  - preferencias y relojes únicos por usuario.
- **Disparadores que impiden mover filas:**
  - `assisted_steps_inmutable`: ningún paso de la práctica asistida se modifica.
  - `pes_respuesta_cerrada`: una respuesta PES confirmada no cambia, ni siquiera su `user_id`.
  - `pes_eventos_inmutable`: el diario de la PES no se modifica.
- **Disparador que altera fechas:** `touch_updated_at` en responses y activities. Si se moviera una respuesta,
  cambiaría su fecha de «última modificación».
- **Archivos (PDF, capturas, fotos):** la ruta incluye el id del usuario, pero la descarga se autoriza por la fila
  en la base (`svc_upload_file_path(usuario, archivo)`), no por la ruta. No hace falta mover archivos.
- **Cálculo de notas:** el registro y «Mis notas» usan el **mejor intento entregado** por actividad. Si se
  juntaran los intentos de las dos cuentas para la misma actividad, se tomaría automáticamente el mayor.

## 3. Situación real en producción (respaldo del 4-nov)

- **47 cuentas de estudiante (38 activas).** El detector propuesto (ID de acceso a una distancia de 1 o 2
  caracteres, o nombres coincidentes) encuentra:
  - **Un caso claro:** `100838260` y `1008383260` (un dígito de más, mismo nombre, misma sección). La cuenta
    antigua tiene 5 intentos y está suspendida; la nueva está activa y sin intentos.
  - **Dos pares parecidos solo por la matrícula y con nombres distintos**, probablemente estudiantes diferentes:
    justo el caso en que el detector debe orientar y nunca fusionar.
  - **Las cuentas «prueba-…»**, que son de prueba del profesor: conviene excluirlas del detector.

## 4. Diseño propuesto

**Principio:** nada se borra ni se sobrescribe. Cada fila académica de la cuenta secundaria se **traslada** a la
principal (cambiando solo `user_id`, con sus fechas, respuestas y notas intactas) o se **queda** en la secundaria,
que pasa a ser un archivo histórico desactivado. Cada traslado queda anotado fila a fila, lo que permite revertir.

### 4.1 Reglas por tipo de dato

| Caso | Regla |
|---|---|
| Actividad hecha en una sola cuenta | Se trasladan el intento y todas sus filas dependientes (respuestas, revisiones, eventos, telemetría, examen, instantáneas, tiempo activo). |
| **Misma actividad en las dos cuentas** (ambas entregadas) | **Conflicto académico.** El administrador elige qué cuenta vale. Los intentos de la cuenta elegida quedan en la principal; los de la otra se conservan íntegros en la cuenta fusionada, como historial que no cuenta. Así el cálculo de notas no cambia y nunca se elige el mayor automáticamente. Opción «pendiente»: no se traslada ninguno de los dos hasta resolverlo, y las notas no cambian. |
| Nota manual del registro en el mismo apartado (`grade_entries`, `grade_part_scores`) | Conflicto, con la misma decisión. Su historial (`grade_history`) se traslada siempre. |
| Puntos extra | Se trasladan todos y se avisa si coinciden sección y motivo (posible doble crédito). |
| Misma práctica extraordinaria en las dos cuentas | Si ambas tienen respuestas: conflicto por práctica completa. Si no, se traslada la que las tenga. |
| **Examen en curso** en cualquiera de las dos cuentas (sesión del motor de examen abierta) | **Bloquea la fusión** hasta que se entregue o cierre. |
| Práctica en curso en la secundaria y en la principal para la misma actividad | Bloquea (no puede haber dos intentos abiertos). |
| Matrícula en secciones | Se traslada la de las secciones donde la principal no está matriculada. Si ambas lo están, se conserva la de la principal (no se duplican inscripciones). |
| Monitor o delegado de subida en la secundaria | Se traslada si la principal no lo es; queda señalado en la vista previa. |
| Asistencia, lectura, mensajes, alertas, preferencias (unicidad) | Si choca, se conserva la fila de la principal y la otra queda en la secundaria (sin borrar). Sin choque, se traslada. |
| Registros inmutables (pasos asistidos, respuestas PES, diario PES) | Se trasladan: se añade a sus disparadores una única excepción, que solo permite cambiar `user_id` durante una fusión en curso de esa misma transacción. El diario PES y la auditoría de acceso se dejan con su identidad original. |
| Fecha de última modificación | La excepción de `touch_updated_at` en la fusión mantiene la fecha original. |

### 4.2 Proceso en etapas, con estado persistente

1. **Vista previa** (no modifica nada). Muestra:
   - qué se trasladaría y qué se quedaría;
   - los conflictos y las decisiones necesarias;
   - los bloqueos (exámenes en curso, cuenta ya fusionada, una cuenta de profesor…);
   - el impacto en notas, exámenes y secciones.

   Genera una **versión del plan**: una huella del estado de las dos cuentas.
2. **Decisiones** del administrador sobre cada conflicto, registradas.
3. **Ejecución** en **una sola transacción** de PostgreSQL:
   - **Antes de mover nada:** bloqueo de ambas cuentas (cerrojo de transacción y `FOR UPDATE`). Se comprueba que la huella no cambió; si cambió, hay que simular de nuevo.
   - **Traslados:** las filas académicas pasan a la principal y cada una queda anotada.
   - **Cuenta secundaria:**
     - queda desactivada y marcada «FUSIONADA»;
     - se cierran sus sesiones abiertas (se borran sus filas de `auth.sessions`);
     - un disparador impide reactivarla (incluido «Reactivar» de Cuentas) o usarla como principal de otra fusión.

   Si algo falla, la transacción entera se deshace.
4. **Bloqueo en Supabase Auth** (etapa separada, porque no forma parte de la transacción). Se reintenta si falla. Aunque no se completara, la cuenta ya no puede operar: `active = false` hace que `acceder` la rechace y que `account_ok` le niegue todo en el servidor.
5. **Verificación automática:**
   - ninguna referencia rota;
   - notas de la principal iguales a las previstas en la vista previa;
   - intentos completos.
6. **Reversión** (cuando sea técnicamente posible): devuelve las filas anotadas que no hayan cambiado desde la fusión. Si la principal siguió trabajando sobre esos datos, exige una evaluación administrativa.

**Bitácora inmutable** de cada operación: quién, cuándo, cuentas, estado anterior y posterior, decisiones, filas
afectadas, errores y resultado. Solo el **administrador**, con sesión reciente, puede ver, simular, ejecutar o
revertir. Todo se valida en el servidor; estudiantes y monitores reciben acceso denegado.

**Detector de duplicados (orientativo):**
- ID de acceso parecidos (distancia de edición, dígitos de más o de menos);
- nombres coincidentes;
- misma sección.

Muestra un nivel de confianza y las razones. Nunca fusiona por sí mismo.

**Interfaz:** Panel docente → Cuentas → «Cuentas duplicadas»: buscar, elegir principal y secundaria (con la principal
señalada sin ambigüedad), comparar, simular, resolver conflictos, confirmar, ejecutar, verificar e historial.

**Motor de examen y reglas de calificación: sin cambios.** Los únicos componentes existentes que se tocan son tres
disparadores de inmutabilidad y `touch_updated_at` (una excepción acotada y probada), y un disparador nuevo en `profiles`.

## 4 bis. Implementación y pruebas

| Caso pedido | Cómo se comprueba |
|---|---|
| 1. Prácticas distintas | `supabase/pruebas/fusion_cuentas.sql`: todas aparecen en la principal. |
| 2. Misma práctica en las dos | Conflicto detectado. La decisión «secundaria» (práctica 6) y la decisión «principal» (práctica 8) se respetan, y nunca se toma la mayor automáticamente. |
| 3. Examen finalizado | Intento, puntuación, fechas, sesión del motor, eventos, instantánea, telemetría y eventos de respuesta, intactos y en la principal. |
| 4. Examen en curso | Bloquea la vista previa y la ejecución. |
| 5. Relaciones indirectas | Ninguna respuesta, revisión o evidencia queda con otro dueño. El servidor lo verifica antes de confirmar. |
| 6. Repetir o encadenar una fusión | Bloqueado; además, una cuenta solo puede ser secundaria de una fusión vigente (índice único). |
| 7. Dos administradores a la vez | `scripts/pruebas-pg/fusion-concurrencia.ts` (dos conexiones reales): la segunda espera al bloqueo y se rechaza, sin estados a medias. |
| 8. Estudiante por REST · 9. Monitor | Acceso denegado (también al profesor y al anónimo). |
| 10. Fallo a mitad | Un fallo provocado deshace todo; queda constancia del intento en la bitácora. |
| 11. Falla Supabase Auth | La fusión queda «falta el bloqueo en Auth», con el error registrado, y se puede reintentar. La cuenta ya no opera. |
| 12. Sesiones abiertas | Se cierran en la transacción. Con un token emitido antes, `account_ok` le niega todo. |
| 13. Varias secciones | La matrícula de la sección B pasa a la principal; la de A no se duplica. |
| 14. Datos incompatibles | La cuenta de profesor, la misma cuenta y las cuentas fusionadas se bloquean con un informe. |
| Reversión | Bloqueada si un dato trasladado cambió después; si nada cambió, todo vuelve a su estado (notas, PES, matrículas, ID de acceso y cuenta activa). |
| Registro completo | Una prueba falla si aparece una tabla con datos del estudiante sin estrategia de fusión. |

- **Mutaciones:** 15 de 15 detectadas (`privado/tmp/mutar-fusion.mjs`).
- **Vitest:** `tests/fusion.test.ts`.
- **Errores reales que encontraron las pruebas durante el desarrollo:**
  - alias de tabla que chocaban con variables;
  - una columna `t` en `exam_events` que confundía la copia de la fila;
  - la razón «un ID contiene al otro», que no describía el caso real (un dígito insertado en medio).

**Pendiente:** probar la pantalla en un navegador; aplicar con autorización; y, al usarla en producción por primera vez,
revisar con calma la vista previa del caso `100838260` / `1008383260` antes de ejecutar.

## 5. Riesgos identificados

- **Doble crédito o nota alterada** si los intentos de la misma actividad se juntaran (el cálculo toma el mejor).
  Lo evita la regla de conflicto; la verificación posterior compara las notas con las previstas.
- **Futuras tablas con `user_id` que no se contemplen.** Una prueba automática exigirá que toda clave foránea hacia
  `profiles` esté clasificada en el registro de la fusión; una migración nueva sin clasificar hará fallar `verificar`.
- **Excepciones en disparadores de inmutabilidad.** Se acotan a «solo cambia `user_id`, de la secundaria a la
  principal, dentro de una fusión en curso de esta misma transacción». No se pueden activar desde fuera.
- **Supabase Auth fuera de la transacción.** Por eso va como etapa con estado y reintento; la desactivación en la base
  ya impide operar.
- **Sesiones abiertas** de la secundaria: se cierran en la transacción. Un token de acceso ya emitido sigue siendo
  válido hasta una hora, pero `account_ok` le niega todo.
- **Reversión parcial** si la principal siguió trabajando: no se promete una reversión atómica completa.
- **Fusionar a dos personas distintas** (matrículas parecidas): el detector es solo orientativo, y la vista previa
  muestra nombres, secciones y actividad para verificar la identidad antes de confirmar.
