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

## 5. Pendiente (no implementado)

| Etapa | Falta |
|---|---|
| 5 · Psicometría | TRI (Rasch/2PL) integrada en el informe por examen con su incertidumbre; DIF; dependencia local estimada; análisis factorial |
| 6 · Simulación | simular un diseño concreto antes de aplicarlo (duración, omisiones, potencia/tamaño muestral) desde esta pantalla |
| 7 · Conversacional | explorador en lenguaje natural (requiere la capa B de IA) |
| 8 · Aprendizaje | calibración progresiva versionada y reapertura de informes guardados con comparación entre versiones |
| Generación asistida | crear preguntas nuevas (borrador + validación matemática, unidades, soluciones, revisión) |
| Modos | K, M, N, O, P, R; versiones del modo G con el generador de variantes |

## 6. IA (capa B)

Existe una integración con Claude (`orbe-ia`, claves solo en el servidor, límites de gasto), pero el laboratorio **no**
la usa todavía: todo el análisis es local y determinista y no envía datos a servicios externos. Cuando se conecte,
deberá: recibir solo enunciados y metadatos (nunca identidades ni respuestas completas), devolver propuestas marcadas
como «IA, sin validar», pasar por la capa C y quedar en caché por versión del examen.
