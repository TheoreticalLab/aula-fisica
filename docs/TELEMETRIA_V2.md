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

## 4. Plan por etapas

| Etapa | Contenido | Estado |
|---|---|---|
| A | Auditoría y modelo formal (el diccionario de eventos V2 se escribe con la ingesta, etapa C, para documentar solo eventos reales) | ✔ este documento |
| B | Motor puro de intervalos y reconstrucción (V1 → modelo; examen → modelo), calidad, pruebas de casos e invariantes, determinismo | ✔ `src/lib/telemetria/v2/{intervalos,modelo,reconstruir,adaptadores}.ts`, `tests/telemetria-v2.test.ts` (casos A–H, J–M, Q, R, T; propiedades del álgebra; 300 intentos aleatorios). Con los 77 intentos reales del respaldo: 0 invariantes violados, 330 ms en total |
| C | Ingesta V2: tabla propia versionada e idempotente, sincronización de reloj, bandera de activación | pendiente |
| D | Respuestas: historial de revisiones del servidor, instantánea de entrega, copia y reintento del borrador en la práctica clásica | pendiente |
| E–F | Integración con examen (diario existente) y práctica clásica y asistida (pregunta activa por control enfocado, observador corregido) | pendiente |
| G | Calidad de datos y abstenciones | pendiente |
| H | Vista docente «Telemetría V2 — Reconstrucción del intento» | pendiente |
| I | Exportación por niveles (A–E) desde el mismo motor | pendiente |
| J | Validación integral: SQL, navegador, móvil, carga | pendiente |
