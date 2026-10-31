# Telemetría V2 — Observatorio del proceso de aprendizaje

Principio: distinguir siempre **lo observado, lo reconstruido, lo estimado, lo desconocido y lo interpretado**. La
telemetría describe interacciones con la plataforma; no revela pensamientos, intenciones ni fuentes externas, y no es
evidencia de uso de IA. Los detectores LIEIA (incluido D6) **no se modifican**: V2 solo ofrece una interfaz de datos
versionada que podrán usar en el futuro.

Documentos relacionados: `docs/TELEMETRIA.md` (capa V1 y diario de tramos del examen), `docs/MOTOR_EXAMEN.md`,
`docs/PRACTICA_ASISTIDA.md`, `docs/CENTRO_DATOS.md`.

---

## 1. Auditoría del sistema existente (etapa A)

Fuente: código del repositorio y el respaldo de producción del 2026-10-31 (`privado/tmp/auditar-telemetria.cjs`, solo
recuentos; no se imprimieron datos personales).

### 1.1 Arquitectura actual

| Pieza | Dónde | Qué hace |
|---|---|---|
| Eventos V1 | `telemetry_events` (migración 29), `src/lib/telemetria/{cola,rastreador}.ts`, `src/components/Telemetria.tsx` | Todas las prácticas y evaluaciones. Sesión por carga de página + secuencia (idempotente por `(session_id, seq)`), reloj monotónico `t_ms`, hora de pared del cliente (orientativa), `received_at` del servidor, `data` en lista blanca. Cola en `localStorage` (tope 3000), lotes de 200, envío cada 10 s, al ocultar la página y al salir |
| Rastreador semántico | `rastreador.ts` | Vista de pregunta (IntersectionObserver), primera interacción, ráfagas de edición (huella FNV y longitud, nunca el texto), guardado, comprobación, envío, visibilidad, foco, inactividad (60 s), conexión |
| Reconstrucción V1 | `src/lib/lieia/proceso.ts` (**LIEIA, congelado**) | Ancla cada sesión al servidor con `mín(recepción − t_ms)` y alinea los eventos |
| Diario de tramos del examen | `exam_intervals`, `exam_events`, `exam_sessions` (migración 35), `src/lib/examen/{motor,intervalos,reloj,guardado}.ts` | Solo evaluaciones «una pregunta a la vez»: partición completa del tiempo en tramos (trabajo, inactividad, pausa declarada, oculta, desconexión, desconocido, fuera de pregunta) en hora del servidor, desfase estimado estilo NTP, conciliación con los hechos oficiales del servidor, guardado con revisiones (`responses.client_rev`) y copia en el dispositivo |
| Huellas de respuesta | `exam_item_events` (migración 27, disparador de LIEIA) | Una huella por cada cambio de respuesta guardado (sin contenido) |
| Respuestas | `responses` (una fila por intento y pregunta) | Se sobrescribe en cada guardado: **no hay historial de revisiones** |
| Práctica asistida | `assisted_steps` (migración 38) | Versiones inmutables por fase (inicial, corregida, explicación, transferencia) |
| Exportación | Centro de Datos (migraciones 34, 36, 39) | Fuentes en lista blanca, seudonimización, manifiesto |

### 1.2 Datos reales (respaldo de producción)

10 749 eventos V1 en 77 intentos (de 111), 157 sesiones de navegador (93 navegaciones, 50 recargas, 14 atrás/adelante).
El motor de examen V2 **no se ha usado todavía en producción** (0 tramos, 0 sesiones de examen).

| Caso histórico | Encontrado | Causa técnica |
|---|---|---|
| 401 eventos, 4 sesiones, 1 recarga, 38 eventos con > 30 s de retraso | intento `6f98…` (práctica entregada) | Cada carga de página es una sesión nueva. Los «retrasos» se miden respecto del evento más rápido de la sesión: la cola se envía cada 10 s y en lotes de 200 (5 269 eventos llegaron con > 5 s, lo esperable); los > 30 s (349 en total) se producen con la página oculta (el navegador frena los temporizadores en segundo plano) y al recuperar la conexión. **La reconstrucción V1 no los coloca al final**: usa el reloj monotónico, no el orden de llegada |
| 10 preguntas «vistas» en menos de 40 s | 41 intentos con ≥ 5 preguntas «vistas» en los primeros 40 s de una sesión | En la práctica clásica todas las preguntas están en una sola página: desplazarse por ella las expone. Además, el observador usa `threshold: 0.5` con `isIntersecting`, de modo que, según la especificación del navegador, una pregunta que cruzó el 50 % queda marcada como visible mientras quede algún píxel en pantalla, y una pregunta más alta que dos pantallas nunca alcanza el 50 % (**causa probable; confirmar en navegador**) |
| Modificaciones sin primera visualización | 4 preguntas de 418 con cambios | Pregunta alta (figura o simulación) que nunca llega al 50 % visible (ver arriba) |
| Respuesta escrita que aparece como no respondida | 1 caso (práctica libre en curso), sin ningún guardado confirmado de esa pregunta | **Fallo confirmado en el código** de la práctica clásica: el guardado automático espera 1.2 s y se **cancela** si el componente se desmonta antes (salir de la página); un guardado fallido no se reintenta; no hay copia del borrador en el dispositivo (el examen sí la tiene). 5 guardados fallidos de 1 350 |
| Tiempo cronológico frente a activo; tiempos por diferencias entre respuestas consecutivas | — | La práctica no tiene «pregunta activa»: varias preguntas están en pantalla a la vez y el tiempo no se puede atribuir a una sola sin un criterio observable. Las diferencias entre respuestas consecutivas no miden el tiempo de cada pregunta |
| Revisitas y respuestas correctas introducidas en intervenciones breves | — | Son patrones observables legítimos (volver a revisar, escribir lo ya resuelto en papel); no se interpretan |
| Confusión entre edición, guardado y entrega | — | V1 registra `borrador_guardado` con `ok`, pero la base no guarda revisiones: no se puede saber qué versión confirmada precedió a la final ni con qué versión se calificó |

Otros: 489 eventos con la hora del dispositivo desviada más de 1 minuto respecto del servidor (por eso la hora de pared
del cliente nunca se usa para ordenar); 8 huecos de secuencia (eventos perdidos); ningún retroceso del reloj monotónico.

### 1.3 Límites de observabilidad

- El navegador solo observa lo que pasa dentro de la plataforma, y sus eventos pueden perderse, retrasarse o
  manipularse: son **declarados por el cliente**. Son autoritativos solo los hechos del servidor (apertura, cambio de
  pregunta aceptado, pausa, guardado confirmado, entrega, calificación).
- Página visible ≠ estudiante mirando; foco ≠ atención; inactividad ≠ pensar o abandonar; oculta ≠ ayuda externa.
- En la práctica clásica de varias preguntas, la atribución del tiempo a una pregunta es **ambigua** salvo cuando el
  estudiante interactúa con los controles de esa pregunta.
- Entre dos sesiones (recarga, otro dispositivo) hay un intervalo **sin observación**.

### 1.4 Riesgos de migración

- LIEIA lee `telemetry_events` (V1) y `exam_intervals`: V2 no cambia esas tablas ni su significado.
- Añadir tipos de evento a la tabla V1 alteraría lo que lee LIEIA: los eventos V2 van a una tabla propia.
- El guardado de la práctica es crítico: cualquier cambio debe conservar `save_response` y no duplicar escrituras.
- Volumen: con historial de revisiones, una práctica con guardado automático puede generar muchas filas: hay que
  consolidar y poner topes.

### 1.5 Componentes reutilizables

`cola.ts` (sesión + secuencia + persistencia), `estimarDesfase` (reloj del examen), el diario y la conciliación del
examen, `exam_item_events`, `assisted_steps`, `client_rev`, el Centro de Datos (seudonimización, manifiesto) y las
políticas RLS de lectura del intento.

---

## 2. Modelo formal de tiempos

### 2.1 Reloj

Cada sesión del navegador $s$ tiene un reloj monotónico $\tau$ (ms desde su inicio). Se ancla al reloj del servidor con
$A_s = \min_e (r_e - \tau_e)$, donde $r_e$ es la hora de recepción del evento $e$: la red solo retrasa, así que el
mínimo es la mejor cota disponible. Hora reconstruida de un evento: $t_e = A_s + \tau_e$. Con muestras de
sincronización (V2), $A_s$ se estima con la muestra de menor ida y vuelta y su incertidumbre es la mitad de esa ida y
vuelta. **Los tiempos crudos ($\tau_e$, $r_e$, hora del dispositivo) se conservan; los reconstruidos se calculan aparte.**

### 2.2 Estado multidimensional

Para cada instante $t$ y sesión $s$ con observación:

| Dimensión | Valores | Fuente |
|---|---|---|
| `vis(t)` | visible · oculta · desconocida | eventos de visibilidad (cliente) |
| `foco(t)` | con foco · sin foco · desconocido | foco de la ventana (cliente) |
| `red(t)` | en línea · sin red · desconocida | eventos de conexión (cliente) |
| `pausa(t)` | declarada · no | servidor (examen) o cliente (práctica) |
| `inact(t)` | inactiva · activa | sin señales de interacción durante más de $\theta$ = 60 s (parámetro) |
| `activa(t)` | pregunta · ninguna · ambigua | servidor (examen); control enfocado (práctica V2); V1: ambigua |
| `expuestas(t)` | conjunto de preguntas | observador de visibilidad en pantalla |

Las dimensiones **se superponen** (una página puede estar oculta y sin red a la vez).

### 2.3 Partición del intento (mutuamente excluyente)

Cada instante del intervalo $[t_{ini}, t_{fin}]$ del intento recibe **una sola** categoría, por este orden de prioridad:

1. `sin_observacion`: ninguna sesión lo cubre (antes de la primera, entre sesiones, después de la última).
2. `conflicto`: dos sesiones lo cubren a la vez (dos pestañas o dispositivos).
3. `pausa_declarada`.
4. `oculta`: página no visible.
5. `inactiva`: visible, sin interacción durante más de $\theta$.
6. `sin_foco`: visible y activa, pero la ventana no tiene el foco.
7. `observable_activo`: visible, con foco y con señales recientes.

$\sum_c T_c = T_{wall}$ por construcción. La conectividad no es una categoría de la partición: un estudiante sin red
sigue siendo observado por su navegador; se informa como dimensión superpuesta ($T_{disconnected}$).

### 2.4 Métricas por pregunta $q$ ($\mu$ = medida de Lebesgue, en ms)

| Variable | Definición | ¿Aditiva entre preguntas? |
|---|---|---|
| $T_{wall}(q)$ | desde la primera exposición o activación hasta la última desactivación | no |
| $T_{exposure}(q)$ | $\mu\{t: q \in \text{expuestas}(t),\ \text{vis}=\text{visible}\}$ | no (varias preguntas a la vez) |
| $T_{focus}(q)$ | $\mu\{t: \text{activa}(t)=q,\ \text{categoría} \in \{\text{observable\_activo}, \text{inactiva}\}\}$ | sí |
| $T_{interaction}(q)$ | $\mu\left(\bigcup_e [t_e, t_e + w)\right)$ para las interacciones $e$ atribuidas a $q$, recortadas a $T_{focus}(q)$; $w$ = 5 s | sí |
| $T_{edit}(q)$ | $\mu(\bigcup$ ráfagas de edición de $q)$, de su primer a su último cambio | sí |
| $T_{candidate\_work}(q)$ | $T_{focus}(q) - \mu(\text{inactiva} \cap \text{activa}=q)$ | sí. **No es tiempo cognitivo** |
| $T_{declared\_pause}$, $T_{hidden}$, $T_{idle}$, $T_{unknown}$ | medida de la categoría correspondiente | partición |
| $T_{disconnected}$ | $\mu\{t: \text{red}=\text{sin red}\}$ | superpuesta |
| $T_{until\_first\_response}(q)$ | primera respuesta no vacía − primera exposición (o activación) | — |
| $T_{until\_submit}$ | entrega confirmada por el servidor − inicio del intento | — |

Cuando `activa(t)` es **ambigua** (práctica V1), $T_{focus}(q)$, $T_{interaction}(q)$ y $T_{candidate\_work}(q)$ son
**no identificables**: se informa el tiempo ambiguo del intento, no un reparto inventado.

### 2.5 Invariantes (se comprueban en cada reconstrucción, con tolerancia explícita)

1. Ningún intervalo tiene duración negativa; los intervalos de la partición están ordenados y no se solapan.
2. $\sum_c T_c = T_{wall}$ (tolerancia 1 ms por redondeo).
3. $\sum_q T_{focus}(q) \le T_{observable\_activo} + T_{inactiva}$.
4. La hora del servidor no retrocede; un evento duplicado (misma sesión y secuencia) no cambia ningún resultado.
5. Una pregunta no activa no acumula foco; una pausa no acumula trabajo; una desconexión no se clasifica como inactividad.
6. Lo no cubierto queda como `sin_observacion`; nada se fuerza para que cuadre.
7. Determinismo: los mismos eventos, versión y parámetros dan exactamente el mismo resultado.

Cada métrica lleva un estado: `observado` · `reconstruido` · `estimado` · `no_identificable` · `informacion_insuficiente`
· `dato_temporal_invalido`. **Un valor no identificable nunca se convierte en cero.**

---

## 3. Motor de reconstrucción (etapa B)

`reconstruir(entrada)` es puro: no lee el reloj del sistema ni la red. La entrada son **eventos normalizados**
(`modelo.ts`), que los adaptadores producen a partir de cada fuente sin modificarla (`desdeV1`, `desdeDiarioExamen`;
cada evento conserva `ref` al registro original). Pasos:

1. Deduplicar por (sesión, secuencia).
2. Anclar cada sesión al servidor: muestras de sincronización si las hay (menor ida y vuelta, incertidumbre = media ida
   y vuelta); si no, cota por recepción $\min(r - \tau)$. Se informan huecos de secuencia, duplicados, eventos muy
   retrasados (> 30 s) y retrocesos del reloj monotónico.
3. Máquina de estados por sesión (§2.2). Con la página visible y activa, un silencio mayor que $\theta$ + 15 s (el
   detector de inactividad habría emitido algo) se clasifica como **desconocido** (navegador suspendido). La
   inactividad empieza $\theta$ después de la última interacción. Una «salida» cierra la observación hasta el siguiente evento.
4. Partición por prioridad (§2.3) y dimensiones superpuestas (sin red, exposición).
5. Métricas por pregunta (§2.4) con su estado; visitas reconstruidas con pregunta activa conocida, o «apariciones en
   pantalla» (estimado) si no; calidad separada por dimensión (temporal con cobertura, atribución, completitud,
   respuesta, sincronización).
6. Continuidad entre sesiones consecutivas: `misma_pestana` (recarga: continuidad probable), `otra_pestana`,
   `simultaneas` (conflicto) o `desconocida`. Nunca se fusionan.
7. Invariantes (§2.5) en cada ejecución; las violaciones se devuelven en `invariantes`, no se ocultan.

**Datos V1 de la práctica:** varias preguntas en pantalla y sin pregunta activa → foco, trabajo candidato y visitas
por pregunta son **no identificables**; la exposición es *estimada* (observador poco fiable); la interacción con los
controles sí es atribuible. Resultado con el respaldo real: la única respuesta «escrita sin confirmar» coincide con la
encontrada por la auditoría independiente. (Una primera versión marcaba 53 por un artefacto: V1 emite el cambio al
*cerrar* la ráfaga, 2 s después del último cambio y después del guardado; el motor usa ahora el final real de la ráfaga.)

## 4. Arquitectura y esquema de datos (etapas C–D, migración 42)

Niveles que **nunca se mezclan**: eventos originales (V1 `telemetry_events`, V2 `telemetry_v2_events`, diario del
examen, hechos del servidor, revisiones) → proyección reconstruida (`reconstruir`, en el navegador del profesor, a
partir de los originales; no se guarda) → variables derivadas (métricas por pregunta con estado) → exportación. Cada
salida lleva `version` del motor y `parametros`; reprocesar con un motor nuevo no modifica ningún registro original.

| Tabla / función | Contenido | Quién |
|---|---|---|
| `telemetry_v2_events` | sobre V2: `event_id` (único), `schema_version` = 2, `attempt_id`, `session_id`, `tab_id`, `client_seq` (único por sesión), `event_type`, `question_id`, `active_question_id`, `t_mono` (reloj monotónico), `client_wall` (orientativa; se anula si difiere > 1 día), `received_at` (servidor; es también la confirmación, porque la ingesta es síncrona), `visibility`, `connectivity`, `response_rev`, `payload` (lista blanca, ≤ 600 B), `quality_flags` | escribe solo `telemetry_v2_ingest` (dueño del intento, bandera encendida, identidad desde la sesión autenticada); no hay lectura directa |
| `telemetry_v2_flags` | bandera por asignatura (apagada por defecto) | `telemetry_v2_set` (equipo de la asignatura), `telemetry_v2_flag` (profesorado) |
| `telemetry_v2_sync(intento)` | hora del servidor (ms) y si la V2 está activa | estudiante dueño |
| `response_revisions` | historial de los **guardados** del contenido de cada respuesta (disparador del servidor) | nadie la escribe directamente; lectura vía `telemetria_v2_intento` |
| `attempt_snapshots` | al entregar: revisión, estado y huella de cada respuesta entregada | disparador; inmutable |
| `telemetria_v2_intento(intento)` | intento, preguntas, V1, V2, diario y hechos del examen, revisiones, comprobaciones y calificaciones (`response_events`), respuestas actuales e instantánea | profesorado que puede revisar el intento; queda en `analytics_audit` |
| `telemetry_v2_monitor(horas)` | ingesta por hora, tipos, indicadores de calidad, cola máxima declarada, banderas | administración |

## 5. Diccionario de eventos V2

Todos son **declarados por el cliente**. Los hechos autoritativos (inicio, guardado aceptado, entrega, pausas y cambio
de pregunta del examen, calificación) están en las tablas del servidor.

| Evento | Qué acción lo genera | Datos | Garantía | Qué NO permite inferir |
|---|---|---|---|---|
| `session_started` / `session_resumed` | carga de la página / vuelta desde la caché del navegador | `navegacion`, `visible` | una sesión = un reloj monotónico | que sea la misma persona o el mismo dispositivo que otra sesión |
| `session_ended` | salida de la página (`pagehide`) | — | best effort (el navegador puede no avisar) | que el estudiante dejara de trabajar |
| `clock_sync` | llamada a `telemetry_v2_sync` (al empezar y cada 5 min) | `envio_tau`, `servidor_ms`, `recibo_tau` | ancla con incertidumbre = ida y vuelta / 2 | — |
| `heartbeat` | cada 30 s con la página visible | `pendientes` (cola), `n` (descartados) | señal de vida | actividad del estudiante |
| `page_visible` / `page_hidden` | cambio de visibilidad de la página | — | estado de la pestaña | que mirara la pantalla / que usara otra herramienta |
| `focus_gained` / `focus_lost` | foco de la ventana | — | — | atención |
| `idle_started` / `idle_ended` | 60 s sin puntero, tecla, desplazamiento ni toque / su fin | `desde_tau`, `duracion_ms` | política de inactividad | que pensara o abandonara |
| `connection_lost` / `connection_restored` | eventos de red del navegador | — | — | que dejara de trabajar (el navegador sigue observando) |
| `question_exposure_started` / `_ended` | la pregunta ocupa ≥ ½ pantalla o se ve ≥ ½ de ella | — | exposición | lectura |
| `question_activated` / `_deactivated` | foco o toque dentro de la tarjeta de una pregunta | — | atribución por control | que la pregunta fuera lo único en lo que pensaba |
| `answer_draft_changed` | ráfaga de cambios (se cierra 2 s después del último) | `inicio_tau`, `fin_tau`, `n`, `len`, `delta`, `h` (huella FNV), `vacia`, `primera`, `borrado`, `tipo_cambio` (introducida, modificada, reemplazada, vaciada, restaurada) | sin contenido | qué escribió; si copió o pegó; autoría |
| `answer_draft_restored` | se recuperó un borrador del dispositivo | `len`, `h` | — | — |
| `answer_save_requested` / `_confirmed` / `_failed` | guardado automático / respuesta del servidor / error | `codigo`, `intentos` | la confirmación es la respuesta del servidor; la revisión queda en `response_revisions` | — |
| `answer_checked` | botón Comprobar (solicitada, recibida, error) | `fase` | el resultado oficial está en `response_events` | comprensión |
| `attempt_submit_requested` | botón Entregar | — | la entrega oficial es `attempts.submitted_at` | — |
| `simulation_event` | (reservado para simuladores; aún sin emisores) | `accion`, `param`, `valor` | — | — |

## 6. Estados de una respuesta

| Estado | Dónde se ve |
|---|---|
| Nunca modificada | sin ediciones ni revisiones |
| Borrador en el dispositivo | copia local (`aula-borrador:…`); evento `answer_draft_changed` sin guardado confirmado posterior |
| Guardado pendiente | «Sin guardar en el servidor: copia en este dispositivo»; reintentos 2 s, 5 s, 15 s y cada 30 s |
| Guardado confirmado | revisión en `response_revisions` (la 1 = primera respuesta, nunca se consolida) |
| Conflicto de revisión | práctica: copia local distinta de una respuesta guardada después en otro dispositivo → no se sobrescribe; se ofrece elegir. Examen: `client_rev` (las revisiones viejas no pisan las nuevas) |
| Incluida en la entrega | `attempt_snapshots.revisiones[].rev` |
| Evaluada | `response_events` (comprobación o entrega, con la respuesta y el resultado del motor) |
| No evaluable | estado `pending_review` / código `key_error` |

La auditoría de la reconstrucción responde «¿se escribió algo?, ¿qué versión quedó confirmada?, ¿cuál se entregó?,
¿qué evaluó el servidor?, ¿por qué apareció vacía?» con un diagnóstico: `nunca_escrita`, `escrita_sin_guardar`,
`guardada_y_vaciada`, `guardada` o `sin_historial` (intentos anteriores a la migración 42).

## 7. Seguridad, privacidad y retención

- Identidad siempre desde la sesión autenticada del servidor; el cliente no elige el estudiante. Preguntas validadas
  contra el intento. Lotes ≤ 200 eventos, payload en lista blanca ≤ 600 B, tope de 50 000 eventos V2 por intento.
- Lectura: estudiante, nada (ve solo el estado de guardado); profesorado, sus secciones (`can_review_attempt`,
  auditado); administración, el monitor agregado; investigación: el Centro de Datos con seudónimos (pendiente de
  añadir las fuentes V2).
- Los registros confirmados no se alteran: sin permisos de escritura para usuarios; revisiones e instantáneas las
  escriben disparadores. Un evento del navegador **puede falsificarse**: por eso se distingue de los hechos del servidor.
- No se almacena: contraseñas, texto fuera de las respuestas, portapapeles, capturas, audio, vídeo, historial de
  navegación, otras aplicaciones, reconocimiento facial ni identificadores entre dispositivos.
- Retención: eventos V1 y V2, 365 días (limpieza automática); revisiones e instantáneas, como el resto del registro
  académico (tablas protegidas: nunca pierden filas en un despliegue). El estudiante ve el aviso de lo que se registra.

## 8. Coste (datos reales del respaldo)

Mediana 112 eventos V1 por intento (p90 275, máx. 565); `data` medio 28 B. Estimación en PostgreSQL ≈ 0.3–0.4 KB por
evento con índices → ≈ 40 KB por intento y capa (p90 ≈ 100 KB). Con V1 y V2 a la vez, ≈ el doble. Revisiones: unas
pocas por respuesta de ≈ 0.3 KB (los guardados seguidos se consolidan). El motor reconstruyó los 77 intentos reales en
330 ms (≈ 4 ms por intento) en el navegador del profesor. El cliente limita a 20 eventos/s (lo esencial nunca se
descarta), lotes de 100 y 3 000 eventos en cola.

## 9. Manual de análisis para el profesorado

1. Revisión del intento → **Telemetría V2 — Reconstrucción del intento**. La cabecera dice la fuente (examen, V2 o V1) y
   sus límites.
2. **Resumen**: duración cronológica y partición del tiempo (activa, inactiva, sin foco, oculta, pausa, desconocido,
   simultánea, sin observación), sesiones y relación entre ellas, eventos tardíos o perdidos; tabla por pregunta.
   «No identificable» significa que los datos no permiten calcularlo; no es cero.
3. **Cronología**: una fila por pregunta (en pantalla, activa, edición) y marcas (▲ edición, ● guardado, ✕ fallo,
   ◆ comprobación, ▶ activación, ⚑ entrega). Acercar, desplazar, filtrar y pulsar una marca para ver su detalle.
4. **Ficha** de una pregunta: tiempos con su estado, secuencia, calidad por dimensión, primera y última respuesta,
   versión entregada, comprobaciones.
5. **Investigación avanzada**: sesiones (ancla, incertidumbre, huecos, duplicados, retrasos), eventos y exportación A–E.
6. Interpretación: describe el proceso observable. No convierta anomalías en acusaciones ni penalice por indicadores
   temporales. Compare solo actividades equivalentes y con buena cobertura.

## 10. Compatibilidad con LIEIA

LIEIA y D6 **no cambian**: siguen leyendo V1 y el diario del examen; el observador V1 de visibilidad se dejó tal cual
(aunque tiene el defecto documentado) para no alterar sus entradas. `paraLieia()` (`fuente.ts`) ofrece una interfaz
versionada (`telemetria-v2/lieia@1`: tiempo reconstruido, de interacción y de edición, pausas, calidad, cobertura, estado
de respuesta, resultado, versión del motor y huella de parámetros) en la que un valor no identificable es `null` con su
estado. **No está conectada** a ningún detector ni recalcula resultados históricos.

## 11. Despliegue y reversión

1. `npm run respaldo` → `npm run probar` (debe aparecer `telemetria_v2.sql: PRUEBAS PASARON`) → `npm run plan` (migración
   42) → autorización → `npm run aplicar -- --plan CÓDIGO` → `git push` (interfaz).
2. Tras aplicar, todo sigue apagado: el historial de revisiones y las instantáneas empiezan a registrarse (no cambian
   nada visible); la V2 del navegador solo se activa al encender la bandera de una asignatura (Análisis → Telemetría).
   Despliegue progresivo: una asignatura de prueba, comprobar el monitor y una reconstrucción, después el resto.
3. Reversión: apagar las banderas. Si hiciera falta, una migración que elimine los dos disparadores nuevos
   (`responses_revision_*`, `attempts_instantanea`); los datos registrados se conservan. La interfaz anterior: `git revert`.

## 12. Pruebas

| Qué | Dónde |
|---|---|
| Álgebra de intervalos (propiedades), casos A–H, J–M, Q, R, T, invariantes con 300 intentos aleatorios, determinismo | `tests/telemetria-v2.test.ts` |
| Ruta V2 completa con reloj simulado y eventos retrasados (error 0 frente a la cronología conocida), idempotencia, cola persistente, presupuestos, tipos de cambio | `tests/telemetria-v2-cliente.test.ts` |
| Fuente, auditoría de respuestas, interfaz LIEIA, exportación (coincide con la vista; CSV seguro; JSON reproducible) | `tests/telemetria-v2-fuente.test.ts` |
| Borradores de la práctica clásica (casos G y H del lado del cliente, conflicto entre dispositivos) y criterio de exposición | `tests/borradores.test.ts` |
| Servidor: permisos, idempotencia, lista blanca, bandera, revisiones y consolidación, instantánea, lectura por profesorado (caso I del lado del servidor, O/P con `practica_asistida.sql`) | `supabase/pruebas/telemetria_v2.sql` |
| Datos reales: 77 intentos del respaldo sin invariantes violados | `privado/tmp/reconstruir-respaldo.ts` |

**No verificado todavía:** navegador real (escritorio y móvil, cambios de pestaña, suspensión, red intermitente,
dos pestañas reales), carga simultánea (caso S) y las pruebas SQL (requieren `npm run probar`).

## 13. Plan por etapas

| Etapa | Contenido | Estado |
|---|---|---|
| A | Auditoría y modelo formal (el diccionario de eventos V2 se escribe con la ingesta, etapa C, para documentar solo eventos reales) | ✔ este documento |
| B | Motor puro de intervalos y reconstrucción (V1 → modelo; examen → modelo), calidad, pruebas de casos e invariantes, determinismo | ✔ `src/lib/telemetria/v2/{intervalos,modelo,reconstruir,adaptadores}.ts`, `tests/telemetria-v2.test.ts` (casos A–H, J–M, Q, R, T; propiedades del álgebra; 300 intentos aleatorios). Con los 77 intentos reales del respaldo: 0 invariantes violados, 330 ms en total |
| C | Ingesta V2: tabla propia versionada e idempotente, sincronización de reloj, bandera de activación | ✔ código (migración 42 + `supabase/pruebas/telemetria_v2.sql`); **pendiente de aplicar** |
| D | Respuestas: historial de revisiones del servidor, instantánea de entrega, copia y reintento del borrador en la práctica clásica | ✔ código (migración 42; `src/lib/borradores.ts`, `Ejercicio.tsx`); pendiente de aplicar y de probar en navegador |
| E–F | Práctica clásica (pregunta activa por control enfocado, exposición corregida, guardados) y examen (reconstrucción desde su diario conciliado, que ya tiene la pregunta activa del servidor) | ✔ práctica clásica y examen. **Práctica asistida:** sus fases e historial inmutable ya están en `assisted_steps`; aún no se integran en la reconstrucción |
| G | Calidad de datos y abstenciones | ✔ calidad por dimensión, estados de métrica, invariantes, monitor |
| H | Vista docente «Telemetría V2 — Reconstrucción del intento» y panel «Telemetría» | ✔ `src/pages/docente/{TelemetriaIntento,TelemetriaPanel}.tsx`; sin probar en navegador |
| I | Exportación por niveles (A–E) desde el mismo motor | ✔ por intento (`exportar.ts`); exportación masiva seudonimizada: pendiente (fuentes nuevas en el Centro de Datos) |
| J | Validación integral: SQL, navegador, móvil, carga | ⬜ pendiente: `npm run probar`, navegador y teléfono reales, carga simultánea |
| — | Análisis estadístico descriptivo entre intentos, actividades y conceptos (fase 11) | ⬜ pendiente |
