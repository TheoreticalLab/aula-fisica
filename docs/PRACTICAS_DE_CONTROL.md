# Prácticas de Control y VTA (migración 62)

> Una solución entregada demuestra que existe un producto académico. Una Práctica de Control comprueba si el estudiante
> puede aplicar **de forma autónoma** lo trabajado. No es un detector de IA: es una verificación breve, individual,
> presencial, anunciada y revisable, cuyo objetivo es aumentar el incentivo de aprender, no el número de sanciones.

## 1. Diagnóstico de lo que existía (auditoría del 2 de noviembre de 2026)

| Necesidad | Qué existía | Decisión |
|---|---|---|
| Evaluación con reloj oficial, autoguardado y reconexión | Motor de exámenes «una a la vez» (migr. 35): `exam_settings`, `exam_sessions`, `exam_deadline`, `exam_save` con revisión, diario de tiempo, `ExamenUnaALaVez.tsx` | **Reutilizado**: cada control es una actividad `exam` oculta |
| Un problema distinto por estudiante | `attempt_item_orders` (migr. 28), que respetan `get_attempt`, la entrega y `recompute_attempt` | **Reutilizado**: un disparador al crear el intento fija SU ejercicio |
| Tiempo adicional | `exam_extensions` + `exam_sessions.extra_s` (migr. 37) | **Reutilizado** (adaptaciones antes y durante) |
| Cerrar y entregar lo guardado | Acción `finalize` de la Edge Function `calificar` | **Reutilizada** |
| Corrección numérica, unidades, tolerancias, cifras significativas, errores típicos, selección, V/F, texto, abiertas | Motor `_shared/calificacion` (servidor) | **Reutilizado** |
| Expresiones algebraicas | **No existía** (figuraba como pendiente en «Acerca») | **Nuevo**: `expresiones.ts` (equivalencia numérica en puntos aleatorios, analizador propio, sin `eval`) |
| Variantes paramétricas | Plantillas por intento (migr. 51), hoy solo choques | Se usan si el ejercicio del banco las tiene |
| Transferencia | `assisted_transfer` (solo práctica asistida) | No se acopla; catálogo propio con metadatos (`control_items`) |
| Generación con IA | `generar` (migr. 55): deja los ítems **sin publicar** hasta la revisión docente | Puerta de entrada al catálogo: solo ejercicios publicados y aprobados |
| Asistencia | `attendance_*` (migr. 24, 26, 43) sin relación con actividades | Se vincula por `control_sessions.attendance_session_id`; la asistencia **no** se modifica |
| Libro de calificaciones | `official_scores` (mejor intento por actividad vinculada, migr. 16), sin ajustes por actividad | `official_scores` multiplica por `control_factor()` al LEER; la nota original no cambia |
| Dominio por competencia | `concept_mastery` (calculado, sin historial) y `exercises.concepts` | La competencia = concepto (`concepts.slug`); la necesidad usa evidencia supervisada |
| Revisión manual con traza | `grade_response` + `response_events` | **Reutilizado** para las respuestas abiertas |
| LIEIA | Detectores de integridad D1–D8, psicometría | VTA va en una pestaña propia, sin tocar detectores ni umbrales |
| Exámenes adaptativos (migr. 53) | `assign_attempt_items` con rama adaptativa | Sin conflicto: el control no crea `exam_adaptive` ni `exam_designs`, y su ejercicio se fija antes |

## 2. Componentes nuevos

- **Tablas** (RLS activada, sin permisos directos; todo pasa por funciones `security definer`):
  `control_items` (catálogo de transferencia), `control_policies` (política versionada e inmutable),
  `control_sessions`, `control_assignments`, `control_audit`.
- **Ciclo**: `control_preparar` → (`control_sustituir`, `control_exentar`, `control_tiempo_extra`) → `control_iniciar`
  → (`control_agregar` para tardíos, `control_incidencia`) → `control_cerrar` + `calificar/finalize` → revisión
  (`control_revision` + `grade_response`) → `control_confirmar` (o `control_desconfirmar`). `control_cancelar` anula.
- **Nota**: `control_factor(práctica, estudiante)` y `control_resultado`; `official_scores` y `my_grade_breakdown`
  redefinidas (copia literal + factor); `control_ajustes` para el profesor.
- **Estudiante**: `my_control_pendiente()` (aviso que lleva al intento), `control_aviso()` (aviso de verificación).
- **VTA**: `vta_datos`, `vta_seccion`, `vta_estudiante`.
- **Edge Function `calificar`**: en un control, un formato no interpretable va a `pending_review` (no a 0).
- **Motor**: `TextKey.expresion = { esperada, variables, dominio?, tolerancia? }`.
- **Interfaz**: Orbe Control (`ControlPractica.tsx` dentro de la asistencia), editor de la práctica (`ConfigControl.tsx`),
  `AvisoVerificacion.tsx`, `AvisoControl.tsx`, LIEIA → «VTA», desglose de notas del estudiante.

## 3. Regla de nota

    N_final = N_original × [1 − w × (1 − C/100)]        w ≤ 0,30 (límite institucional), 0,20 por defecto

- **La nota original nunca se modifica**: el factor se aplica al leer. No puede aplicarse dos veces por
  sincronizaciones ni recálculos.
- **Varias verificaciones** de una misma práctica: cuenta el **mejor** resultado confirmado (regla agregada única).
- **Aviso previo, siempre** (migración 63). Cada política elige su alcance:
  - **«nuevas»**: rige a quien entrega **después** del anuncio.
  - **«todas»** (prácticas ya dadas): rige **también a las entregas anteriores**, pero solo en los controles iniciados
    al menos `anticipacion_horas` después del anuncio (24 h por defecto; «para la próxima clase») y mientras sea la
    versión vigente. Un control iniciado antes es solo diagnóstico. Al anunciarla se publica (opcional, activado por
    defecto) un aviso fijado en la sección durante 21 días.
  - Sin política aplicable, el control es diagnóstico (factor 1). Cambiar la política crea una versión nueva; las
    versiones son inmutables y cada control conserva la regla con la que se hizo (corrección de un defecto de la 62,
    que dejaba de aplicar una versión anterior a quien entregó bajo ella).
  - Con varios controles cuenta el **más favorable** al estudiante (`control_mejor`).
- **Solo con confirmación**: hace falta intento entregado, sin corrección pendiente, sin incidencia, sesión no
  cancelada y confirmación expresa del profesor.
- Ejemplo: 90 en la práctica y 50/100 en el control → 90 × (1 − 0,2 × 0,5) = **81**. Con 100/100 se conserva el 90.

## 4. Selección individual (reproducible)

Para cada estudiante elegible (orden pseudoaleatorio por la semilla de la sesión), sobre los candidatos que **caben en
el tiempo** del control y **no son ejercicios de la propia práctica**:

1. Fichas **aprobadas** del catálogo que transfieren un ítem de la práctica o una de sus competencias (validado = 1).
2. Respaldo: ejercicios **publicados con clave** del banco de una competencia de la práctica (validado = 0,5), sin abiertas.

    puntaje = 0,30·necesidad + 0,25·diagnóstico + 0,15·cobertura + 0,10·tiempo + 0,10·validado + 0,10·azar

- **necesidad** = 1 − media de los últimos 10 créditos en evaluaciones supervisadas en esa competencia (sin datos: 1).
- **diagnóstico** = 1 si el ítem de la práctica salió bien (≥ 0,8): es la evidencia más útil de verificar; 0,7 si
  parcial; 0,4 si bajo. +0,1 si declaró ayuda en la práctica asistida (información pedagógica: autonomía no verificada;
  nunca penaliza).
- **cobertura** = penaliza que la sesión repita la misma competencia o el mismo ejercicio.
- **tiempo** = 1 − |minutos/duración − 0,7|.
- **azar** = uniforme reproducible `md5(semilla:estudiante:ejercicio)`.

Cada asignación guarda sus componentes, la semilla, la versión del algoritmo (`vta-sel-1`) y las 4 mejores
alternativas. El profesor puede **cambiar** el problema antes de que el estudiante empiece (queda en la auditoría).
Espejo en TypeScript: `src/lib/control.ts` (probado en `tests/control.test.ts`).

**Tiempo estimado** sin ficha (heurística): selección o V/F 2 min, texto 3, numérica básica 4 / intermedia 6 /
desafiante 9, abierta 8. Las fichas fijan su tiempo (1–10 min, comprobado por la base).

**Mecanismos de transferencia** (metadato de la ficha, elegido por el profesor): contextual, paramétrica, conceptual y
estructural. **No** se generan automáticamente: el sistema prioriza problemas aprobados. Las variantes paramétricas por
intento se usan cuando el ejercicio del banco tiene plantilla (hoy: choques). La IA puede proponer problemas con
«Generar preguntas» (quedan sin publicar); solo un ejercicio publicado y una ficha aprobada pueden afectar a una nota.

## 5. Situaciones especiales

| Situación | Política implementada |
|---|---|
| Ausente | Estado «ausente» al iniciar (según la asistencia vinculada). Factor 1. Se puede dar el control si llega (tardío) o en una sesión de recuperación |
| Llegada tardía / presente sin control | «Dar control» (`control_agregar`): se le asigna problema y se amplía la ventana; su tiempo cuenta desde que abre |
| Sin ejercicio elegible | «Sin problema adecuado»: el profesor puede sustituir uno manualmente. Factor 1 |
| Práctica sin entregar | «No entregó la práctica»: no recibe control y no hay penalización adicional |
| Práctica aún sin corregir | Recibe control; el ajuste se calcula con la nota original vigente cuando se lea |
| Reconexión / recarga | El aviso retoma el mismo intento; el reloj es del servidor; el autoguardado conserva lo escrito |
| Tiempo agotado | El intento se entrega con lo guardado al finalizar (acción `finalize`) |
| Exención justificada | `control_exentar` con motivo (auditado). Factor 1 |
| Tiempo adicional autorizado | `control_tiempo_extra` con motivo; antes de empezar se copia a la sesión del examen, después es una prórroga |
| Error de generación | No hay generación en vivo: si no hay candidatos, «sin problema adecuado» |
| Error de corrección (clave rota) | Va a revisión manual (`pending_review`), no a 0 |
| Formato no interpretable | En un control: revisión docente, no 0 |
| Respuesta en blanco | Cuenta 0, pero se marca «EN BLANCO» para que el profesor compruebe antes de confirmar (puede registrar incidencia) |
| Revisión del profesor | `control_revision` + `grade_response` (traza en `response_events`); `control_desconfirmar` con motivo |
| Recuperación | Nueva sesión marcada como recuperación; cuenta el mejor resultado |
| Activación accidental o duplicada | Una sola sesión abierta por práctica; preparar es idempotente por petición; iniciar dos veces no duplica; «Anular» cancela sin efecto en notas |
| Distintas secciones | Cada práctica pertenece a una sección; solo su profesorado ve y maneja sus controles |
| Versiones de la práctica | Las políticas son versiones inmutables; cada control se rige por la que el estudiante conocía antes de hacerlo |
| Práctica ya entregada | Política «también entregas anteriores» con antelación mínima antes del control y aviso fijado en la sección |
| Fallo de red o del sistema | Incidencia: ese control deja de contar |

## 6. Seguridad

- El estudiante solo ve SU control (`activity_visible_to_me` redefinida), solo su ejercicio y nunca claves, rúbricas
  ni el catálogo (tablas sin permisos; `exercise_keys` solo profesorado). No puede escribir notas ni créditos.
- Toda acción sensible valida en el servidor el profesorado de la sección. Todas quedan en `control_audit`.
- Probado en `supabase/pruebas/practicas_de_control.sql` (aislamiento entre secciones, permisos, claves, intentos
  individuales, idempotencia, retroactividad, pendientes, encadenamiento, incidencias, cancelación, revisión).

## 7. VTA · Verificación de Transferencia y Autonomía

Pestaña propia en LIEIA, separada de los indicadores de integridad. Por estudiante: controles confirmados, rendimiento
en prácticas y supervisado, brecha media ajustada por dificultad (0,10 por nivel de dificultad del control por encima
de la práctica) con error típico, competencias verificadas (control ≥ 70) y pendientes, historial y recuperaciones.
Con menos de 3 controles no se interpreta. Etiquetas no acusatorias: «Conviene reforzar la resolución autónoma»,
«Coherente», «Sin conclusión», «Datos insuficientes». La selección diagnóstica (sección 4) y la nota (sección 3) son
procesos distintos.

## 8. Guía rápida del profesor

1. **Antes de que entreguen** (o, para una práctica ya dada, antes del control): Actividad (la práctica) →
   Configuración → «Práctica de Control · política de nota»: ajuste máximo, duración, a qué entregas se aplica
   (posteriores, o también anteriores con antelación mínima), condiciones y política de ayudas → «Anunciar política».
   Los estudiantes ven el aviso en la práctica y, si lo deja marcado, un aviso fijado en la sección.
2. (Recomendado) En «Problemas de transferencia», cree y apruebe fichas a partir de las sugerencias del banco.
3. **En clase**: Orbe Control → Asistencia → abra la asistencia como siempre (o use la pestaña **🎯 Control**, que
   detecta la asistencia abierta de la sección o permite seguir sin ella). En «PRÁCTICA DE CONTROL» elija la
   práctica (o deje «Ninguna»), la duración → «Preparar controles». Revise la vista previa, cambie problemas, exente o
   dé tiempo adicional si hace falta.
4. Cuando la presencia esté comprobada → «Iniciar control». A los estudiantes presentes les aparece «Comenzar ahora».
5. Siga los estados en vivo. Para llegadas tardías: «Dar control». Para fallos: «Incidencia».
6. «Finalizar control» → «Revisar» las respuestas abiertas (rúbrica) → «Confirmar resultados».
7. «Ver ajustes de nota» (o Configuración → «Ajustes de la nota por controles»): original, control, factor y final.

## 9. Despliegue

1. `npm run verificar` y `npm run probar` (migración 62 sobre la copia de producción).
2. `npm run plan` → debe listar la **migración 62** y la función **calificar**.
3. Autorización → `npm run aplicar -- --plan XXXX` → `git push` (publica el aula y Orbe Control).
4. Reversión: la migración es aditiva. Para desactivar el efecto en notas basta con no anunciar políticas o retirar la
   vigente (`control_politica_retirar`); las sesiones pueden cancelarse. Las funciones redefinidas
   (`official_scores`, `my_grade_breakdown`, `activity_visible_to_me`) son copias literales + el control: sin sesiones
   de control se comportan exactamente igual que antes.

## 10. Limitaciones (honestas)

- **Corrección preliminar con IA de respuestas conceptuales: no implementada.** Las abiertas van a revisión docente
  con rúbrica. Añadirla requiere un propósito nuevo en Orbe IA (coste por respuesta y modo simulado ya disponibles) y
  una prueba de calibración con respuestas reales; nunca confirmaría notas por sí sola.
- **Generación automática de variantes de transferencia contextual/estructural: no implementada.** Hay catálogo,
  validación y revisión docente; los problemas los crea el profesor (o Orbe IA, sin publicar hasta revisarlos).
- Equivalencia algebraica: sin editor visual en el Banco (la clave se escribe en JSON). Es una prueba numérica en
  8 puntos, no simbólica.
- El tiempo estimado del banco es una heurística por formato y dificultad (las fichas lo fijan a mano).
- La web del aula no tiene el monitor del control (se usa Orbe Control); sí la configuración, los ajustes y VTA.
- Pruebas de extremo a extremo **en navegador y teléfono: no ejecutadas** (el sandbox no tiene Chrome); las pruebas
  SQL y Vitest cubren el servidor, la corrección y la lógica.
- No hay entrega automática por el servidor al agotarse el tiempo (como en los exámenes actuales): la hace el
  navegador del estudiante o el botón «Finalizar control».
