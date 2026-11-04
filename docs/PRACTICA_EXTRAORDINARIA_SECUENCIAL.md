# Práctica Extraordinaria Secuencial (PES)

Modalidad exclusiva de práctica: problemas de 3 a 5 apartados que el estudiante ve **de uno en uno**, en orden y de
forma **irreversible**, con una **espera mínima** por apartado decidida por el servidor. Dificulta el uso mecánico de
asistentes externos (cada apartado depende de lo anterior y exige tiempo de trabajo); **no lo impide ni lo detecta**, y
no se debe presentar como si lo hiciera sin evidencia experimental.

Estado: etapas 1–3 programadas y probadas en local (rama `pes`). Migraciones 74 y 75 **sin aplicar**; frontend sin publicar.

## 1. Reglas

| Regla | Dónde se impone |
|---|---|
| Solo se entrega el apartado abierto (nunca los futuros, claves, rúbricas ni explicaciones) | `pes_actual_json` (servidor); tablas sin permisos REST |
| El tiempo empieza cuando el servidor muestra el apartado; recargar no lo reinicia | `pes_estado.revelado_at = now()` del servidor |
| Espera mínima T_min = (1 + incremento) · T_ref · factor de espera; por defecto 1,20 · T_ref | `pes_t_min` |
| Confirmar antes de T_min exige aceptar la reducción: m = 0,5 (configurable). Aviso: «Si avanza ahora, la puntuación obtenible en este apartado se reducirá al 50%. Esta decisión es irreversible» | `svc_pes_confirmar` |
| Omitir es definitivo y vale 0 | `pes_omitir` |
| Respuestas cerradas inmutables; diario de eventos de solo inserción | disparadores `pes_respuesta_cerrada`, `pes_respuesta_sin_borrado`, `pes_eventos_inmutable` |
| Transiciones idempotentes (clave por acción) y con bloqueo de fila: dos envíos simultáneos no saltan estados | `FOR UPDATE` en `pes_estado`, `pes_respuestas.idem` único |
| Publicar congela contenido, claves, pesos, parámetros, apertura, liberación y política de control; la fecha límite solo se amplía | `pes_congelada`, `pes_claves_congelada`, `pes_parametros_congelados` |
| Bloqueo ordinario de pegado y arrastre (dictado, autocorrección e IME permitidos; adaptación «pegado permitido») | `BarreraPegado` (navegador): **barrera de interacción, no garantía** |

## 2. Calificación (informativa: no entra en el Registro de Calificaciones)

S = Σ w·q · P_base = P_max·(S/N)^α · F = Σ w·q·m / S · P = P_base·F (0 si S = 0; nunca más de P_max).
Valores por defecto: P_max = 8, α = 2. Ejemplos: todo correcto 8; todo correcto y anticipado 4; mitad del crédito
anticipado 6; mitad del dominio 2; para N = 100, S = 10/25/50/75/100 → 0,08/0,50/2,00/4,50/8,00.

- **Provisional**: todo lo calificado (lo pendiente de revisión cuenta 0).
- **Validada**: solo lo que el profesor validó (`pes_validar`) o revisó (`pes_revisar`, con justificación).
- **Máxima alcanzable**: provisional + pendientes con crédito completo (con su m) + lo que aún puede responder a tiempo.
- **Control presencial**: con política «ajuste», validada × [1 − w·(1 − C)], w ≤ 0,3, C = mejor resultado.

La misma fórmula está en SQL (`pes_formula`, `pes_puntaje`) y en TypeScript (`src/lib/pes.ts`); una prueba de paridad
las compara con casos aleatorios.

## 3. Manual breve

**Crear** (aula: Panel docente → sección → *Prácticas extraordinarias*, u Orbe Control → 🧩 PES): título y fecha límite.

**Contenido** (solo en el aula, en borrador). Tres vías; nunca se trocean ni se agrupan preguntas sueltas automáticamente:
1. *Problema por etapas del banco*: 3 a 5 etapas consecutivas de un problema real (`exercise_bank_meta.problema`). No se
   puede empezar en una etapa que usa el resultado de una excluida. El panel informa del estado del banco: en noviembre de
   2026 hay **2 problemas de 7 etapas** por asignatura de Física General I/IA y **ninguno** en Física Básica, así que casi
   todo el contenido requiere preparación docente.
2. *Composición docente*: 3 a 5 preguntas del banco con una **situación común** escrita por el profesor (≥ 20 caracteres).
3. *Redactar apartados*: enunciado, formato, clave (comprobada con el propio motor de calificación), rúbrica, T_ref y peso.
4. *✨ Generar con IA* (migración 76): paquetes de 1 a 50 problemas de 3 a 5 apartados por etapas, repartidos entre las
   lecciones, dificultades y tipos elegidos (cálculo por etapas, conceptual, datos experimentales o gráfica, corrección de
   errores, variación de condiciones). Antes de empezar se muestra el coste estimado (presupuesto y límite diario de Orbe
   IA, propósito «generar»; con las llamadas reales apagadas, simulación sin coste). Un problema por llamada; el servidor
   lo verifica (numéricas: datos escritos en lo que verá el estudiante, fórmula recalculada con análisis dimensional y
   clave construida por el servidor; selección y V/F completas; a lo sumo una abierta, con rúbrica; si un apartado usa un
   resultado anterior, ese valor debe estar escrito en su enunciado) y lo guarda como **propuesta**. Nada entra en la
   práctica sin que el profesor lo añada tal cual, lo edite (se conservan las claves que no cambie) o lo descarte. La IA
   recibe solo el temario y el comienzo de enunciados existentes; nunca datos de estudiantes.

**Tiempos.** T_ref por defecto según formato y dificultad (minutos de la Práctica de Control). En *Carga temporal* →
*Calibración*, registre el tiempo que necesitó una persona para resolver cada apartado en papel; en borrador puede usar la
mediana como T_ref. El informe compara el tiempo esperado con la espera impuesta y avisa cuando la espera supera en más
del 50 % lo medido. La carga total se compara con el plazo (y con cada bloque de liberación): errores impiden publicar.

**Simulador docente** (🧪 en el editor): abre la práctica como estudiante de prueba, también en borrador, con la misma
pantalla y servidor; permite adelantar su reloj, simular cortes de red, inspeccionar la calificación de cada apartado,
ejecutar las sondas REST no autorizadas y reiniciar. No cuenta en listas, puntuaciones ni monitor.

**Control presencial**: defina la política (informativa o de ajuste, con su texto) **antes de publicar**: el estudiante la
lee en las condiciones. En Orbe Control → 🧩 PES → *Control presencial*: elija estudiante y ejercicio ya realizado; verá
sus respuestas y un equivalente (números nuevos para los apartados con variante, o preguntas del banco de la misma lección
y formato, con su respuesta); aplíquelo en persona y registre C (0 a 1) con una nota. Un control realizado se corrige
anulándolo (con motivo; conserva su resultado) y preparando otro.

**Publicar**: todos los estudiantes de la sección o una lista. Después: adaptaciones por estudiante (tiempo adicional =
plazo personal; factor de espera ≤ 1; pegado permitido), monitor, revisión de respuestas abiertas, validación,
publicación de resultados, cierre y archivo.

**Monitor** (aula y Orbe Control): estado, ejercicio y apartado actuales, tiempo en el apartado, avance, omitidos,
anticipados, validadas, tiempo total, puntuaciones, pendientes de revisión e indicadores. Los indicadores (respuestas muy
por debajo de la espera, pegados bloqueados, inactividad, reconexiones) son **para revisar, no pruebas de fraude**. El
historial de cada estudiante muestra respuestas, tiempos, decisiones, eventos y controles.

## 3 bis. Reutilizar problemas y auditoría de la generación con IA (migración 81)

**Reutilizar.** En el editor de una práctica en borrador → «Añadir un ejercicio» → **«♻️ Reutilizar de otras prácticas»**:
lista los problemas de sus otras prácticas extraordinarias, también de otra sección o asignatura. Se filtra por práctica
y por texto, y «Añadir a esta práctica» lo copia tal como quedó: apartados, etapas, pesos, tiempos, claves, rúbricas,
explicaciones y figuras. La copia es independiente y no gasta IA (`pes_reutilizables`, `pes_ejercicio_reutilizar`).

**Auditoría (4-nov, con los datos reales del respaldo: 37 paquetes, 117 llamadas):**

| Síntoma | Causa comprobada | Corrección |
|---|---|---|
| «Se detuvo / el servidor rechazó» con 5 apartados, nivel desafiante o tipos «errores» y «transferencia» | El límite de salida de «generar» era `least(max_output_tokens, 4000)`, y `max_output_tokens` (3000) es el ajuste de los chistes. Las 13 llamadas fallidas terminaron exactamente en 3000 tokens: la respuesta se cortaba. | Límite propio de 12 000 (solo se paga lo escrito), respuesta en streaming con más tiempo e instrucción de concisión. |
| Esas llamadas se cobraban sin dejar rastro | Al fallar no se anotaban ni el motivo ni el costo en el paquete, y el paquete se detenía | Una respuesta cortada, sin formato o rechazada por el modelo cuenta como problema descartado, con su motivo y su costo, y el paquete sigue (se para tras 3 descartes seguidos). |
| El presupuesto no contaba lo gastado en llamadas fallidas | La comprobación del presupuesto sumaba solo las llamadas «ok» (1,13 USD en 16 llamadas fallidas) | La reserva cuenta también las fallidas. Los paneles de gasto todavía muestran solo las «ok»: pendiente. |
| «El resultado declarado no coincide» y «el dato no aparece en el enunciado» | Casi todos eran anteriores al arreglo del 4-nov a las 12:28 (unidades, factores de 1000). Después, ninguno en unos 25 problemas. | Ya corregido; se mantiene vigilado. |
| «Falta la retroalimentación de la opción …» | La IA omitía el comentario de una opción incorrecta y se descartaba un problema válido | Se completa con un comentario genérico; el apartado queda, como toda selección, para la revisión del profesor. |

La estimación de costo previa se recalibró con 104 llamadas reales: entrada típica de 4300 tokens (antes se suponía 2500)
y salida máxima según el número de apartados.

## 4. Arquitectura

- Migración 74 (`pes_nucleo`): tablas `pes_practicas`, `pes_ejercicios`, `pes_apartados`, `pes_claves`,
  `pes_asignaciones`, `pes_estado`, `pes_respuestas`, `pes_controles`, `pes_eventos` (RLS activada y sin permisos para
  `anon`/`authenticated`: todo pasa por funciones `security definer` que comprueban usuario y estado).
- Migración 75 (`pes_seguimiento`): `pes_calibraciones`; monitor, historial, calibración, simulador y control presencial.
- Edge Function `calificar`, acción `pes` (`confirmar`, `variante`): califica con el motor existente (variantes con la
  semilla de la asignación) y nunca devuelve el acierto. Una respuesta ilegible no cierra el apartado.
- Frontend: `src/api/{pes,pesTipos}.ts`, `src/lib/{pes,pesSesion,pesRedaccion,pesMonitor,pesSondas,pesRed}.ts`,
  `src/components/{BarreraPegado,ListaPes}.tsx`, `src/pages/estudiante/PracticaExtraordinaria.tsx`,
  `src/pages/docente/{PesTab,PesEditor,PesSeguimiento,PesSimulador}.tsx`, `orbe-control/src/PesOrbe.tsx`.
- Las prácticas ordinarias, el motor de examen y el Registro de Calificaciones no se modifican.

## 5. Pruebas

| Prueba | Qué cubre |
|---|---|
| `supabase/pruebas/pes.sql` | secuencia, sin futuros ni claves, irreversibilidad, omisión, tiempos, m, idempotencia, permisos, congelado, banco, adaptaciones, puntuaciones, liberación, vencimiento |
| `supabase/pruebas/pes_seguimiento.sql` | simulador, calibración, monitor, historial, control presencial y su efecto, exclusión del simulador |
| `scripts/pruebas-pg/pes-integracion.ts` | flujo completo del estudiante contra PostgreSQL real y la lógica real de `calificar`: recargas, cortes de red, envíos duplicados y concurrentes (8 pestañas), errores de formato, reloj del navegador adelantado, variantes, vencimiento y tiempo adicional, fugas en todo lo recibido, paridad SQL ↔ TypeScript, simulador y sondas REST, carga de 100 ejercicios × 4 apartados |
| `tests/pes*.test.ts` | fórmula y ejemplos, carga temporal, redacción y claves, bloqueo de pegado, sesión, pantalla del estudiante (HTML), monitor, informe de tiempos, sondas, acción `pes` |
| Mutaciones (`privado/tmp/mutar-*.mjs`) | quitar una protección hace fallar la prueba que la vigila |

Ejecución local: `node privado/tmp/pruebas-sql-local.mjs && node privado/tmp/pruebas-pg.mjs`.

## 6. Riesgos y limitaciones

- **No probado todavía en un navegador ni un teléfono reales, ni a través de Supabase** (PostgREST/Deno): las pruebas
  usan PostgreSQL con todas las migraciones y la lógica de `calificar`, sin el transporte HTTP.
- El bloqueo de pegado se puede sortear (escribir copiando de otra pantalla, herramientas del navegador). Es una barrera.
- La espera mínima solo es justa si T_ref está calibrado; sin mediciones es una estimación por formato y dificultad.
- El «estado de conexión» del monitor es la última actividad registrada, no presencia en tiempo real.
- El banco tiene poco contenido secuencial; una práctica de 100 ejercicios exige mucho trabajo docente de redacción.
- Las respuestas abiertas quedan pendientes de revisión (cuentan 0 hasta revisarlas); no hay corrección asistida por IA.
- La puntuación es informativa: no pasa al Registro de Calificaciones.
- No se registra el cambio de pestaña o ventana (solo pegados y arrastres bloqueados y reconexiones, sin contenido).

## 7. Despliegue y reversión

1. `npm run respaldo` → `npm run probar` (aplica 74 y 75 sobre la copia de producción) → `npm run plan`.
2. Con autorización del plan concreto: `npm run aplicar -- --plan XXXX` (migraciones 74 y 75 y despliegue de `calificar`).
3. Con autorización: `git push` del frontend (aula y Orbe Control).

Reversión: las migraciones solo añaden tablas y funciones; sin prácticas publicadas no tienen efecto visible. Para dejar de
usarla basta con cerrar o archivar las PES; la acción `pes` de `calificar` no actúa sin datos. Borrar las tablas sería
destructivo y requeriría autorización expresa (`-- @destructivo-autorizado`), además del respaldo previo.
