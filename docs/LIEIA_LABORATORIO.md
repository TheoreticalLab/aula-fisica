# LIEIA · Laboratorio científico de diseño experimental, psicometría e investigación educativa

LIEIA deja de ser solo un laboratorio de integridad académica: ahora es un laboratorio que **analiza exámenes, propone
investigaciones y diseña exámenes nuevos**. La línea original (detectores D1–D6, D6 v2, telemetría de proceso) sigue
intacta como una investigación más, en sus pestañas «Integridad: …».

## 1. Auditoría del sistema existente (1-nov-2026)

| Pieza | Dónde | Estado |
|---|---|---|
| Detectores D1–D6, D6 v2.1 (experimental), validación con verdad conocida | `src/lib/lieia/{detectores,d6,validacion,laboratorio}.ts` | Reutilizable, **no se modifica** (algoritmos y umbrales intactos por decisión del profesor). D6 v1 ya estaba marcado como obsoleto |
| Telemetría de proceso y V2 | migraciones 29, 42, 44; `src/lib/telemetria/v2` | Reutilizable; el laboratorio usa solo el intervalo de edición de `lieia_exam_data` |
| Datos reales de un examen | `lieia_exam_data` (migraciones 27–28): seudónimos, acierto, primera/última edición, cambios, huella anónima de la respuesta, orden | **Reutilizado** como fuente empírica |
| Diseño de exámenes manual (roles «normal/ancla/isomorfa…», versiones) | `exam_designs`, `exam_design_items` (migr. 28), `DisenoExamen.tsx` | Conservado como **configuración avanzada**; mezcla dimensiones (ver §2) |
| Calibración 2PL, información, selección óptima, equivalencia | `src/lib/lieia/diseno.ts`, `item_calibrations` | Reutilizado (información a priori en el comparador) |
| Estadística (Wilson, BH, χ², KM, ROC) | `src/lib/lieia/estadistica.ts` | Reutilizado |
| Banco de preguntas y metadatos (tema, tipo, etapas, previos, familia, dimensional, parámetros) | `exercises`, `exercise_bank_meta` (migr. 41), `src/lib/banco.ts` | Reutilizado para la clasificación a priori |
| Rendimiento histórico del banco | `banco_rendimiento` | Reutilizado (historial de cada pregunta en el diseñador) |
| Generador reproducible de variantes | `src/lib/fisica/variantes.ts` | Disponible (no conectado aún al modo isomorfo) |
| IA | Edge Function `orbe-ia` (Claude, humor contextual; claves en el servidor) | **No se usa** en el laboratorio todavía (ver §6) |
| Calificaciones | `grade_entries`… | No se tocan |

Defectos o límites encontrados: la tabla de roles mezcla función experimental, tipo cognitivo y relación entre preguntas;
no había clasificación automática, ni motor de hipótesis, ni persistencia de investigaciones; la tabla `lieia_audit`
solo admite dos acciones (por eso el historial del laboratorio va dentro de cada registro).

## 2. Arquitectura

```
src/lib/lieia/ciencia/
  modelo.ts        cinco dimensiones independientes, procedencia (a_priori / empirica / simulada), confianza cualitativa, umbrales
  contenido.ts     análisis del contenido y clasificación multietiqueta con evidencia y alternativas; revisión del profesor
  psicometria.ts   TCT con abstención: dificultad (Wilson), discriminación ítem-resto, KR-20 (bootstrap), omisiones, phi + BH, contraste
  relaciones.ts    grafo: isomorfismo, mismo método, prerrequisito, conceptos, similitud textual (≠ redundancia), correlación empírica
  descubrimiento.ts fichas de investigación con factibilidad (analizable / datos insuficientes / requiere nueva evaluación)
  disenador.ts     modos de diseño con criterio explícito, reproducibles por semilla; comparador por dimensión
  informe.ts       orquestador, diagnóstico multidimensional, recomendaciones, resumen con cifras calculadas, versión (caché)
src/api/lieiaCiencia.ts            carga (datos existentes) y persistencia
src/pages/docente/lieia/Ciencia.tsx flujo principal (primera pestaña de LIEIA)
supabase/migrations/20261101000048_lieia_laboratorio.sql   lieia_research (investigaciones, diseños, revisiones, informes)
```

Capas: **A** (determinista: todo lo anterior), **B** (IA: no conectada), **C** (validación científica: abstención por
tamaño muestral, BH, rótulos de procedencia, «no causal», «no es prueba de conducta», reutilización de datos declarada).

## 3. Decisiones científicas

- **Procedencia separada:** cada valor dice si es a priori (contenido), empírico (respuestas reales) o simulado. La
  dificultad del autor nunca se presenta como calibrada; con n = 0 se dice «sin respuestas para calibrar».
- **Confianza cualitativa** (alta = metadato explícito del banco; media = categoría/formato; baja = palabras del
  enunciado). No hay porcentajes de confianza porque no existe una calibración que los respalde.
- **Complejidad algebraica ≠ exigencia cognitiva:** se informan por separado.
- **Omisión** = sin respuesta guardada. Una respuesta sin calificar (abierta pendiente) no es omisión.
- **Umbrales de abstención:** dificultad n ≥ 10; discriminación n ≥ 20; KR-20 n ≥ 20 y ≥ 3 preguntas; correlaciones n ≥ 30.
- **Comparaciones múltiples:** asociaciones entre preguntas con q de Benjamini-Hochberg (FDR 10 %), rotuladas exploratorias.
- **Reutilización de datos:** cuando una hipótesis nace de los mismos datos (p. ej. «asociación no prevista»), la ficha
  advierte que debe confirmarse en otra aplicación.
- **Asistencia externa:** solo como diseño prospectivo, consentido, con condiciones declaradas; los datos existentes
  nunca se presentan como prueba; sin sanciones ni puntuaciones de culpabilidad.
- **Diseñador:** ningún diseño es «mejor» sin criterio; cada modo declara el suyo. La información del comparador es bajo
  el modelo 2PL a priori (no calibrado) y solo sirve para comparar diseños entre sí.
- **Borradores:** los exámenes se crean ocultos, con la metodología en las instrucciones; nunca se publican solos.

## 4. Qué está implementado (y probado)

Flujo vertical completo: **seleccionar examen → analizar → descubrir investigaciones → diseñar → revisar (quitar
preguntas, alternativa por semilla, comparar) → crear examen borrador**, más guardar/posponer/descartar fichas y
corregir la clasificación (persistido si la migración 48 está instalada).

- Clasificación multidimensional automática (16 habilidades, funciones en el examen), con evidencia y revisión.
- Psicometría clásica con incertidumbre y abstención; contraste «difíciles correctas / fáciles omitidas» descriptivo.
- Grafo de relaciones teóricas y empíricas; evaluación de redundancia con lo que falta para afirmarla.
- 13 líneas de fichas: dependencias, conceptual–cálculo, errores sistemáticos (huellas idénticas), redundancia,
  mecanismos de omisión, contraste, dificultad prevista vs observada, confiabilidad, isomorfos, orden, retención,
  transferencia, asistencia externa (prospectiva) y descubrimiento abierto.
- Modos de diseño implementados: A, B, C, D, E, F, G, H, I, J, L, Q. Rechazados con motivo: K, M (adaptativo sin
  calibración), N, O (se planifica desde su ficha), P (requiere IA), R (requiere modelo de información).
- Diagnóstico en 10 dimensiones (sin puntuación única) y hasta 6 recomendaciones con su porqué.

Pruebas: `tests/lieia-ciencia.test.ts` (17, con verdad conocida: dos factores latentes, prerrequisito, error repetido,
omisión por posición; y negativos: n pequeño, respuestas al azar) y `supabase/pruebas/lieia_laboratorio.sql`
(persistencia, acceso, integridad de notas).

### Etapas 5, 6 y 8 (parcial), añadidas después

- **Psicometría avanzada** (`tri.ts`): 2PL por examen reutilizando la calibración marginal validada; abstención con
  n < 50, «provisional» con n < 200; a y b con errores típicos; curva de precisión (ET de θ con banda 10–90 %);
  dependencia local por Q3 de Yen (media + 0,2). Limitación verificada en pruebas: con menos de ~10 preguntas, un par
  dependiente arrastra θ y Q3 no lo detecta (se avisa). DIF no se calcula: los datos seudonimizados no traen grupo.
- **Simulador** (`simulacion.ts`): estudiantes sintéticos (habilidad, velocidad, propensión a omitir, límite de
  tiempo, orden fijo/inverso/aleatorio, quitar preguntas), 200 réplicas reproducibles; puntuación, KR-20 simulado
  [p10–p90], fracción que termina, omisiones por tiempo y por desconocimiento por pregunta; parámetros calibrados si la
  TRI está ajustada y a priori si no (se rotula). Comparación de escenarios y «Simular este diseño» en el diseñador.
  Tamaño muestral analítico (correlación, dos proporciones) contrastado con valores de referencia (85; 93 por grupo).
- **Historial** (`historial.ts`): reabre investigaciones guardadas, compara el resultado de entonces con el actual y
  separa las **registradas antes de los datos** (guardadas con n = 0: contraste confirmatorio) de las **exploratorias**
  (necesitan otra aplicación); lista los diseños con enlaces a sus borradores.

Pruebas: `tests/lieia-ciencia-etapas.test.ts` (9, con parámetros verdaderos conocidos y valores de referencia).

### Completado después (migración 49 y módulos nuevos)

- **Calibración progresiva** (migración 49): `item_calibration_history` guarda cada versión de la calibración (disparador
  que nunca bloquea; las actuales se copian como primera versión). El diseñador y el simulador usan la calibración
  guardada más reciente; «Psicometría avanzada» muestra la evolución de b ± ET y avisa si cambia más de lo que explica
  su incertidumbre.
- **DIF** (`dif.ts`): Mantel-Haenszel entre los dos subgrupos más numerosos (estratos por puntuación en el resto),
  clases A/B/C del ETS, BH; mínimo 20 por subgrupo. Los subgrupos llegan por `lieia_exam_groups` con los mismos
  seudónimos que `lieia_exam_data`, sin nombres.
- **Modos de diseño K, M, N, O, P, R**: antes/después con formas paralelas; adaptativo (solo con ≥ 15 calibradas:
  especificación + rendimiento simulado; el motor de examen aún no lo administra y se dice); robustez (mismo concepto
  en otro tipo o formato); asistencia externa (formas A/B, consentimiento, asignación cruzada reproducible guardada);
  por hipótesis escrita (conceptos detectados por palabras, sin IA); exploratorio (máxima reducción esperada de la
  varianza de los parámetros: Σ ET(b)² × información de Fisher esperada).
- **Potencia por simulación** de un diseño correlacional concreto (con la atenuación por pocas preguntas).
- **Explorador** (`explorador.ts`, pestaña «Preguntar»): intenciones por palabras clave → procedimientos validados;
  las cifras salen solo del informe; sin IA.

Pruebas: `tests/lieia-ciencia-pendientes.test.ts` (11: DIF con ítem sesgado conocido y negativo, modos, asignación,
potencia simulada frente a analítica, explorador con n = 0) y `supabase/pruebas/lieia_calibracion.sql`.

### Análisis factorial exploratorio (`factorial.ts`, sin migración)

Pregunta: ¿el examen mide una dimensión o varias? Es el supuesto de la TRI 2PL. En «Psicometría avanzada».

- **Correlaciones tetracóricas**, no phi: con preguntas 0/1 la phi depende de la dificultad y produce «factores de
  dificultad». Máxima verosimilitud por tabla 2×2 con la normal bivariada de Genz (BVND; comprobada contra integración
  numérica en sus tres ramas) y bisección en ρ; corrección de 0,5 si hay celdas vacías; datos por pares (omitida = 0,
  sin calificar = fuera del par). Matriz no definida positiva → suavizado por autovalores, con aviso.
- **Número de factores: análisis paralelo de Horn** (percentil 95 de los autovalores de 50 conjuntos independientes con
  las mismas proporciones de acierto y el mismo n; semilla fija). Si ningún autovalor supera al azar, se dice que no hay
  estructura común detectable.
- **Extracción por ejes principales** iterada (comunalidades iniciales = correlación múltiple al cuadrado; casos Heywood
  acotados y avisados) y **varimax** con normalización de Kaiser. Asignación con |carga| ≥ 0,4; carga cruzada si la
  segunda es ≥ 0,3 y la diferencia < 0,2.
- **Unidimensionalidad esencial**: un factor en el análisis paralelo y razón entre el primer y el segundo autovalor ≥ 3.
- **KMO y Bartlett solo con matriz bien condicionada** (menor autovalor ≥ 0,1). Hallazgo de la simulación: ambos usan la
  inversa de R y, con ruido de muestreo, se vuelven arbitrarios aunque las cargas sean buenas (un factor con KMO
  poblacional 0,995 dio 0,53 con n = 400 y K = 40, con comunalidades estimadas 0,355 frente a 0,36). Informarlos habría
  desaconsejado interpretar estructuras fuertes; por eso se omiten y se explica.
- **Abstención**: n ≥ 100 y ≥ 5 estudiantes por pregunta; se excluyen preguntas con acierto < 5 % o > 95 % o con menos
  de la mitad calificadas. Confianza «media» solo con n ≥ 300, matriz bien condicionada, KMO ≥ 0,7 y sin Heywood; si no,
  «baja». Nunca «alta».
- **Interpretación**: un factor es un patrón de correlación, no una habilidad demostrada. La etiqueta propuesta sale de
  los conceptos compartidos por la mayoría de sus preguntas (a priori, confianza baja).
- Coste medido: ≈ 1,5 s para 40 preguntas y 200 estudiantes en el navegador (se calcula al pulsar el botón).

Pruebas: `tests/lieia-factorial.test.ts` (16): normal bivariada frente a fórmula cerrada e integración numérica,
tetracórica frente a normales dicotomizadas, autovalores, varimax, KMO; estructuras conocidas de 1, 2 y 0 factores
(recupera las cargas y agrupa las preguntas), reproducibilidad, abstenciones y el caso de matriz mal condicionada.

## 5. Pendiente (no implementado)

| Etapa | Falta |
|---|---|
| 5 · Psicometría | rotación oblicua (los factores de un examen suelen correlacionar; varimax los fuerza a ser independientes), análisis factorial confirmatorio y modelos jerárquicos |
| 7 · Conversacional | el explorador «Preguntar» sigue siendo por palabras clave; la IA solo interpreta el informe (§6), no responde preguntas libres; sin caché de interpretaciones |
| Motor de examen | asignar condiciones experimentales por estudiante automáticamente. (Los exámenes adaptativos ya se administran: migración 53, `docs/EXAMEN_ADAPTATIVO.md`; el modo M del diseñador sigue produciendo solo la especificación simulada) |
| Generación asistida | crear preguntas nuevas con IA (borrador + validación + revisión). Las variantes por intento (migración 51) ya generan versiones numéricas validadas de las plantillas de choques |
| Modos | versiones del modo G con el generador de variantes |

## 6. IA (capa B)

Conectada (migración 52, pendiente de instalar): pestaña **«Interpretación IA»**, acción `lieia` de la Edge Function
`orbe-ia` (`supabase/functions/orbe-ia/lieia.ts`). Todo lo demás del laboratorio sigue siendo local y determinista.

- **Qué recibe el modelo:** por pregunta, posición, enunciado (≤ 400 caracteres), formato, conceptos, dificultad a
  priori y cifras agregadas (n, proporción de acierto, discriminación, omisión); del examen, n, KR-20 y la estructura
  factorial si se calculó. El navegador arma el resumen sin tocar la matriz de respuestas (`resumenIA.ts`) y el
  servidor lo **reconstruye por lista blanca**: cualquier otro campo (seudónimos, respuestas, ids) se descarta. El
  profesor ve exactamente lo que se enviará antes de pedirlo.
- **Gasto y encendido:** comparte el interruptor, el presupuesto mensual, el límite diario y el simulador de Orbe IA
  (propósito `lieia` en `orbe_ia_usage`). Con las llamadas reales apagadas responde el simulador, sin coste.
- **Capa C (determinista, en el servidor):** cada propuesta se descarta si cita una cifra decimal o un porcentaje que no
  está en los datos, una pregunta inexistente, afirma una causa («se debe a», «demuestra»…) o habla de copia, trampa,
  fraude o uso de IA. Lo descartado se muestra con el motivo. Todo llega etiquetado «IA, sin validar».
- **No hay caché** por versión del examen todavía: cada petición es una llamada (limitada por Orbe IA).

Pruebas: `tests/lieia-ia.test.ts` (10: lista blanca sin fugas, acotación, resumen del cliente sin la matriz, capa C con
cifras inventadas, preguntas inexistentes, causas y acusaciones, simulador, permisos, API real y registro de tokens) y
`supabase/pruebas/lieia_ia.sql` (propósito, apagado, reserva simulada sin coste, permisos, propósitos anteriores).
