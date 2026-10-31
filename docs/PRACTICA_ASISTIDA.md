# Prácticas con aprendizaje asistido

**INTENTA → RECIBE AYUDA → CORRIGE → EXPLICA → DEMUESTRA.** El estudiante puede usar IA para aprender. El profesor
puede distinguir el **rendimiento inicial declarado**, el **rendimiento posterior a la asistencia**, la explicación y
lo que después **demuestra** en un ejercicio distinto. Es independiente de LIEIA, que sigue congelado y no se tocó.

| Pieza | Archivo |
|---|---|
| Datos, reglas del servidor y nota compuesta | `supabase/migrations/20261101000038_practica_asistida.sql` |
| Motor (acción `asistida` de la Edge Function `calificar`) | `supabase/functions/calificar/handler.ts` |
| Lógica pura (comparación, reflexión por caso, nota, resumen) | `src/lib/asistida.ts` |
| Estudiante | `src/pages/estudiante/PracticaAsistida.tsx` (desde `Intento.tsx`) |
| Profesor: configuración · proceso | `src/pages/docente/ConfigAsistida.tsx` · `src/pages/docente/ProcesoAprendizaje.tsx` |
| Asistente «+ Crear actividad» | plantilla «Práctica con aprendizaje asistido» (`src/lib/plantillas.ts`) |
| Pruebas | `tests/asistida.test.ts`, `tests/plantillas.test.ts`, `supabase/pruebas/practica_asistida.sql` |

## Auditoría previa (qué se reutilizó)

- **Intentos y respuestas** (`attempts`, `responses`): la nota compuesta de cada ejercicio se escribe en `responses.auto_credit`. El libro de calificaciones, la entrega y la revisión manual del profesor funcionan sin cambios.
- **Motor de calificación** (`calificar`, lógica pura con pruebas): nueva acción `asistida`.
- **Comprobación, pistas y solución clásicas** (`svc_check_context`, `get_hint`, `reveal_solution`) exigen retroalimentación inmediata o pistas activadas. Una práctica asistida se configura sin ninguna de las dos, así que esas vías quedan cerradas sin redefinir ninguna función existente.
- **Componentes** `EnunciadoEjercicio`, `EntradaRespuesta` y `SolucionBox`: los mismos que en la práctica tradicional.
- **Tutor IA integrado:** existe Orbe IA (Claude), pero **no se conectó en esta versión**. La práctica funciona con cualquier herramienta externa, no envía respuestas a terceros y no genera gasto. Integrarlo como tutor socrático requiere decidir el tratamiento de datos y el presupuesto (ver «Pendiente»).

## Flujo del estudiante (por ejercicio, un paso a la vez)

1. **Intentar.** «Primero intenta resolverlo por ti mismo» y el mensaje de la especificación. Respuesta, operaciones u explicación breve opcionales, o «No sé resolverlo todavía». Botón **Guardar mi primer intento** y, en la misma pantalla, la declaración: *sin IA ni ayuda externa* / *consulté alguna ayuda* / *no conseguí resolverlo*. Se indica que es voluntaria, que no cambia la nota y que no es una verificación técnica.
2. **Aprender.** «Ya guardamos tu primera respuesta…». Se muestran por separado **Tu respuesta inicial** (fija) y **Tu respuesta después de estudiar** (editable, empieza con la inicial). Botón **Guardar mi corrección**, con retroalimentación del motor y comprobaciones limitadas (`max_tries_per_item`, 2 por defecto).
3. **Explicar.** Las preguntas se adaptan al caso:
   - primer intento incorrecto: dónde estaba el error, por qué, qué principio usó;
   - correcto: cómo lo comprobó, qué confirmó, otra forma (sin obligar a inventar un error);
   - no sabía: qué concepto necesitaba, qué paso le permitió empezar, cómo resolvería uno semejante.

   Ayudas usadas (varias, con «Ninguna») y una referencia opcional (fuente, enlace, concepto, idea), sin pedir capturas ni acceso a cuentas. Tras explicar se muestra la solución, salvo que la actividad diga «nunca mostrar».
4. **Comprobar** (opcional). «Demuestra lo que aprendiste»: un ejercicio **distinto** elegido por el profesor del banco (mismo concepto, validado; nada se genera automáticamente). Un solo intento.

Indicador de progreso de 1 a 4. Cada paso tiene una acción principal. El borrador se guarda en el dispositivo; sin conexión no se avanza («Su respuesta sigue guardada en este dispositivo»). **Finalizar la práctica** entrega el intento.

## Garantías (las impone el servidor)

| Garantía | Cómo |
|---|---|
| Primer intento inmutable | índice único `(intento, ejercicio)` para `inicial` + disparador que rechaza todo `UPDATE` (ni siquiera el administrador de la base de datos lo cambia). Las correcciones y explicaciones son **versiones nuevas** |
| Sin oráculo antes del primer intento | la acción `asistida` solo valida que la respuesta se pueda interpretar, con un mensaje genérico que no revela ni la unidad esperada. El estudiante no ve el resultado de su primer intento hasta guardar la corrección (después ya no puede cambiarlo). Comprobación, pistas y solución clásicas, cerradas |
| Orden de las fases | `asistida_validar`: corrección solo tras el primer intento; explicación solo tras corregir; transferencia solo tras explicar y con ejercicio asignado; un solo intento de transferencia |
| Reintentos y dos pestañas | cada envío lleva un `client_id`: un reenvío devuelve lo ya guardado sin duplicar. Un segundo primer intento desde otra pestaña se rechaza. Las fases del intento se serializan con `for update` |
| Nada se da por guardado sin confirmación | el cliente solo avanza con la respuesta del servidor; si falla, el borrador sigue en el dispositivo y se muestra el error |
| Acceso | cada estudiante solo su intento; el profesorado solo sus secciones; las funciones `svc_*`, solo para la Edge Function |
| Privacidad | no se recogen chats externos; la referencia es opcional y la escribe el estudiante; nada se envía a proveedores de IA |

## Calificación (separada de los indicadores)

Por ejercicio: **intento inicial 20 % · corrección 30 % · explicación 20 % · transferencia 30 %**. Es una propuesta editable, no una escala validada.

- **Intento inicial:** cuenta por presentarlo. Un primer intento incorrecto no se penaliza.
- **Corrección:** el resultado del motor en la última versión.
- **Explicación:** presentada, con al menos una respuesta de una frase (≥ 15 caracteres). La calidad la puede ajustar el profesor con la calificación manual de la revisión.
- **Transferencia:** su resultado.

Sin transferencia, los pesos activos se reparten proporcionalmente (20/30/20 → 28,6/42,9/28,6 %), y la tarjeta de configuración lo muestra. **La declaración de uso de IA no interviene:** no da puntos por declarar «sin IA» ni quita por reconocer ayuda. Las prácticas tradicionales y las calificaciones históricas no cambian.

## Indicadores pedagógicos (no LIEIA)

- **Rendimiento inicial declarado:** proporción de primeros intentos correctos. Se basa en lo declarado; **no** es «dominio autónomo verificado».
- **Rendimiento posterior a la asistencia:** proporción de respuestas finales correctas.
- **Cambio:** valor, unidad, ambos, opción, de «no sé» a respuesta, y si cambió el procedimiento.
- **Explicación presentada.** No se juzga la autoría y no se marca nada como «generado por IA».
- **Transferencia:** resultado del ejercicio nuevo y su concepto.
- **Retención:** si el profesor vincula una actividad posterior (en «Verificación posterior»), se muestra la nota de cada estudiante en ella. Una verificación en casa no prueba trabajo autónomo; se interpreta mejor una supervisada.

## Exportación (Centro de Datos)

La migración 39 añade al Centro de Datos:
- **Datos originales:** `asistida_pasos` (una fila por versión, sin el identificador técnico del envío), `asistida_config` y `asistida_transferencias`.
- **Tabla derivada** `aprendizaje_asistido`: una fila por intento y ejercicio.
- **Diccionario:** la declaración y las fuentes figuran con naturaleza «declarado», con su limitación explícita.
- **Modo investigación:** los estudiantes aparecen con seudónimo.

## Para el profesor

- **Crear:** + Crear actividad → «Práctica con aprendizaje asistido». Opcionalmente marque el paso 4.
- **Configurar** (Actividad → Configuración → Aprendizaje asistido): ejercicio de transferencia por pregunta y, en «Opciones avanzadas», pesos y verificación posterior.
- **Seguir** (Actividad → Resultados → Proceso de aprendizaje): el resumen de la sección y una tabla por estudiante con primer intento, declaración, ayudas, respuesta final, cambio, explicación, transferencia y retención.

## Pruebas (los 18 casos de la especificación)

| # | Caso | Dónde |
|---|---|---|
| 1, 5 | Correcto sin ayuda; sin ayuda | `asistida.test.ts` (no se revela el resultado) |
| 2 | Incorrecto y luego corrige | Vitest + SQL |
| 3 | Declara haber usado IA | Vitest (se registra tal cual) + SQL (misma nota) |
| 4 | No sabe resolverlo | Vitest (`no_se`) |
| 6, 7 | Respuesta correcta con justificación ausente o pobre | Vitest (solo pierde la parte de explicación; el contenido no se juzga automáticamente) + SQL (50 %) |
| 8, 9 | Sin y con transferencia | Vitest (reparto) + SQL (transferencia con su propia clave, solo tras explicar) |
| 10 | Pérdida de conexión | Vitest (reintento idempotente) + SQL (`client_id` repetido) |
| 11 | Recarga durante la fase asistida | SQL (`asistida_estado` devuelve la fase exacta) |
| 12 | Modificar el primer intento | SQL (rechazado por el servidor y por el disparador) |
| 13 | Dos pestañas | SQL (segundo primer intento rechazado) |
| 14 | Acceso a datos de otro | SQL (estado, reflexión y fases, rechazados) |
| 15 | Unidades | Vitest (`compararRespuestas`: valor / unidad / ambos) |
| 16 | Compatibilidad con la práctica tradicional | SQL (la tradicional sigue con su comprobación; en la asistida está cerrada) |
| 17 | Vista del profesor | SQL (`asistida_proceso` con el primer intento, su resultado y la declaración) |
| 18 | Nota independiente de la declaración | Vitest + SQL |

La interfaz aún no se ha probado en un navegador ni en un teléfono.

## Pendiente

- **Tutor IA integrado (opcional):** una acción de Orbe IA que solo haga preguntas guía («¿qué principio usarías?»), sin dar la respuesta. Necesita su decisión sobre el envío del enunciado (nunca datos personales) y el presupuesto.
- **Análisis automático de las explicaciones:** solo como ayuda al profesor, nunca para calificar ni para detectar autoría.
- **Volver a tradicional:** hecho (migración 40). El botón «Desactivar el aprendizaje asistido» solo aparece si ningún estudiante ha registrado pasos; si ya los hay, cree una práctica tradicional nueva.
