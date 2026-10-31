# LIEIA · D6 v2 — Sensibilidad temporal a la dificultad

Código: `src/lib/lieia/d6.ts` (detector), `src/lib/lieia/d6Validacion.ts` (batería de simulación),
`tests/lieia-d6.test.ts` (pruebas). Versión: `d6-2.0`. El D6 v1 (`detectores.ts`) se conserva sin cambios para poder
reproducir los informes anteriores; **todavía es el que usa el Laboratorio** hasta que se conecte la v2 (ver «Pendiente»).

> Lo que dice este indicador es **qué tan improbable sería el patrón de tiempos si el estudiante se comportara como la
> población de referencia**. No es la probabilidad de que haya usado IA, ni de culpa. Es una razón para mirar, no una
> conclusión.

## 1. Por qué una v2 (auditoría del 30-10-2026)

| Problema del D6 v1 | Consecuencia | Corrección en la v2 |
|---|---|---|
| La «normalidad» (exigencia temporal de cada ítem) se estimaba con la misma sección investigada | El resultado de un estudiante dependía de sus compañeros; con mucha contaminación, lo anómalo pasaba a ser lo normal | Referencia **externa**, calibrada con otra cohorte, **versionada** y fija durante la evaluación |
| Medía sensibilidad a la *intensidad temporal* del ítem, no a su *dificultad* | Confundía «ítem largo» con «ítem difícil» | Se separan μ_j (intensidad temporal) y D_j (dificultad) |
| Si no había variación, la pendiente valía 1 («normal») | Un valor inventado cuando el indicador no es identificable | Estado **NO IDENTIFICABLE**, sin número |
| Solo exigía ≥ 8 respuestas | Mínimo arbitrario; no miraba la cobertura de niveles | Cobertura de niveles + **criterio de precisión** derivado de la referencia |
| No distinguía aciertos de errores ni respuestas omitidas | Mezclaba patrones distintos | Se informan por separado; las omisiones y los tiempos ausentes se excluyen y se cuentan (nunca valen 0) |

## 2. Modelo

**D6-A (sensibilidad):** `log T_ij = μ_j + α_i + β_i (D_j − D_ref) + ε_ij`, con `ε_ij ~ N(0, σ_j²)`.

- `T_ij`: tiempo **observable** atribuible a la pregunta. Si no se observó, o la pregunta no se respondió, se excluye.
  Los tiempos *parciales* (con una pausa, pestaña oculta o desconexión dentro) se excluyen por defecto (ver §5).
- `μ_j, σ_j, D_j, D_ref`: de la referencia. `α_i`: velocidad general del estudiante (no interviene en la pendiente).
- `β_i`: desviación de la sensibilidad respecto de la referencia. En la población de referencia `β_i ~ N(0, τ_β²)`.
- Estimación por mínimos cuadrados ponderados (pesos `1/σ_j²`), con error típico `SE`. Comprobación robusta con
  Theil–Sen; si no coincide en signo con la principal, se avisa.
- Contraste unilateral de **insensibilidad** (el tiempo crece menos con la dificultad que en la referencia):
  `z = β̂ / √(SE² + τ_β²)`, `p = Φ(z)`. Se informa también β solo con las respuestas correctas.

**D6-B (rapidez relativa):** cuenta las respuestas **correctas** con `log T − μ_j < −z_r·√(σ_j² + τ_α²)` (`z_r = 2`).
La p integra sobre la velocidad personal `α ~ N(0, τ_α²)`: una binomial ingenua trataría como independientes los ítems
de una persona y castigaría a quien es rápido en general. Las incorrectas rápidas se cuentan aparte (descriptivo).

## 3. Estados de D6-A (lo que verá el profesor)

| Estado | Cuándo | ¿Hay β? | ¿Hay p? |
|---|---|---|---|
| Datos insuficientes | menos de 2 respuestas con tiempo | no | no |
| **No identificable** | todas las respuestas evaluables son de un mismo nivel | no | no |
| Referencia no informativa | en la referencia el tiempo casi no crece con la dificultad (`se_max = 0`) | sí | no |
| Precisión insuficiente | `SE > se_max` | sí, con su SE | no |
| Contraste parcial | dos niveles y `SE ≤ se_max` | sí | sí |
| Identificable | tres niveles y `SE ≤ se_max` | sí | sí |

Junto al estado se muestran: pendiente, IC 95 %, SE, cobertura de niveles, n evaluables, omitidas, sin tiempo, sin
referencia, parciales, versión de la referencia y del detector, y las advertencias.

## 4. De dónde sale `se_max` (no es un mínimo arbitrario)

La insensibilidad completa (tardar lo mismo en todo) equivale a `β = −pendiente_μ_D`, donde `pendiente_μ_D` es cuánto
crece `μ_j` con `D_j` en la referencia. Para tener potencia ≥ 80 % frente a ella con α = 0,05 unilateral hace falta
`|pendiente_μ_D| / √(SE² + τ_β²) ≥ z_0,95 + z_0,80 = 2,486`, de donde
`se_max = √((|pendiente_μ_D| / 2,486)² − τ_β²)` (0 si no es posible). Así el número de preguntas necesario depende de
cuánto discrimina la referencia y de qué niveles cubra el examen, y no de un umbral fijado a mano.

Consecuencia práctica (simulación): con la referencia simulada (`pendiente_μ_D ≈ 0,50`, `τ_β ≈ 0,10`, `se_max ≈ 0,18`)
un examen de 4 ítems por nivel queda justo por encima del umbral (SE ≈ 0,16); con otra semilla (`pendiente ≈ 0,46`,
`se_max ≈ 0,15`) el mismo examen se abstiene. **Si se quiere usar D6-A, conviene ≥ 5–6 ítems por nivel, o incluir
ítems de los niveles extremos** (6 básicos + 6 desafiantes da SE ≈ 0,13).

## 5. Batería de validación — SIMULACIÓN, no validación empírica

`bateriaD6()` (semilla 2026, 20 réplicas × 60 estudiantes; referencia calibrada con 300 estudiantes honestos sintéticos,
30 ítems; examen de 12 ítems, 4 por nivel salvo donde se indica). Los datos son sintéticos y, salvo en los escenarios de
telemetría y de población distinta, siguen el mismo modelo que el detector supone: estas cifras comprueban la lógica y
las tasas nominales, **no** el rendimiento con estudiantes reales. FPR = positivos (p < 0,05) entre honestos evaluados;
sensibilidad = positivos entre «contaminados» evaluados. IC de Wilson al 95 %.

| Escenario | Referencia | FPR | Sensibilidad | Abstención (honestos) | Alarma de deriva |
|---|---|---|---|---|---|
| Contaminación 0 % | externa | 4,9 % [3,8–6,3] | — | 0 % | 0/20 |
| Contaminación 20 % | externa | 4,8 % [3,6–6,3] | 83,8 % [78,6–87,9] | 0 % | 16/20 |
| Contaminación 50 % | externa | 5,0 % [3,5–7,0] | 84,3 % [81,2–87,0] | 0 % | 20/20 |
| Contaminación 80 % | externa | 7,9 % [5,1–12,0] (n = 240) | 85,3 % [82,9–87,4] | 0 % | 20/20 |
| Contaminación 100 % | externa | — | 83,7 % [81,5–85,7] | — | 20/20 |
| Contaminación 0 % | propia cohorte (como v1) | 4,6 % | — | 30 % | — |
| Contaminación 20–100 % | propia cohorte (como v1) | — | — (abstención 100 %) | 100 % | — |
| Solo nivel básico | externa | — | — | 100 % (no identificable) | 0/20 |
| Básico + intermedio (6 + 6) | externa | — | — | 100 % (precisión insuficiente) | 0/20 |
| Básico + desafiante (6 + 6) | externa | 5,1 % [3,9–6,7] | 97,1 % [94,1–98,6] | 0 % | 20/20 |
| 3 niveles, 2 ítems por nivel | externa | — | — | 100 % (precisión insuficiente) | 0/20 |
| 30 % de tiempos perdidos | externa | 8,3 % [5,4–12,4] (n = 242) | 77,1 % [66,0–85,4] | 74,8 % | 8/20 |
| 20 % de pausas **no** detectadas | externa | **8,8 % [7,1–10,7]** | 80,8 % | 0 % | 17/20 |
| 20 % de pausas detectadas y excluidas | externa | 5,3 % [3,7–7,6] | 81,0 % | 45,0 % | 5/20 |
| Población distinta de la referencia (γ 0,3 frente a 0,5), sin contaminación | externa | **27,0 % [24,6–29,6]** | — | 0 % | 20/20 |
| Copia rápida y correcta (20 %) — D6-A | externa | 5,5 % | 2,9 % | 0 % | 0/20 |
| Copia rápida y correcta (20 %) — **D6-B** | externa | 2,9 % [2,0–4,1] | 100 % [98,4–100] | 1,6 % | — |

FPR agregada con contaminación 0–80 %: compatible con el 5 % nominal en la semilla 2026 y en otras cinco semillas
probadas (4,5 %–5,7 %); en una sexta (99) la referencia exigía más precisión y el examen de 12 ítems se abstuvo por
completo (§4), que es el comportamiento buscado. La sensibilidad no cae al aumentar la contaminación (el resultado de cada estudiante es
idéntico sea quien sea su grupo, comprobado en `tests/lieia-d6.test.ts`). Con la referencia tomada de la propia cohorte,
en cuanto hay contaminación la referencia deja de ser informativa y no se detecta nada: es la razón del cambio.

## 6. Límites conocidos (y lo que hace el sistema con ellos)

1. **Transporte de la referencia.** Si la cohorte evaluada no se parece a la de calibración, la FPR se dispara (27 % en
   la simulación). `diagnosticoReferencia()` compara la media de β̂ de la cohorte con 0 y da la **alarma de deriva**: en
   la simulación salta en 20/20 cohortes de población distinta y en 0/20 cohortes honestas. Pero también salta con
   contaminación ≥ 20 %: con estos datos **no se puede distinguir** una población distinta de un problema extendido. La
   alarma no cambia ningún resultado individual (la normalidad no depende del grupo); pide a una persona que revise o
   recalibre la referencia antes de priorizar por D6-A.
2. **Pausas no detectadas** inflan la FPR (≈ 9 %). Por eso los tiempos parciales se excluyen por defecto, y por eso la
   telemetría v2 (etapa 3) debe registrar las pausas y el tiempo activo por pregunta.
3. **Tiempos perdidos** aumentan la abstención; el detector no imputa.
4. **D6-B** no distingue copia de respuestas transcritas desde papel o muy entrenadas. D6-A no ve la copia rápida
   (no es insensibilidad): por eso son dos indicadores.
5. La dificultad **declarada** (nivel − 2) es una aproximación: la referencia queda marcada como *provisional* hasta
   tener dificultad empírica y ≥ 20 tiempos por ítem.
6. Nada de lo anterior es validación empírica. Para eso hacen falta sesiones con verdad conocida (p. ej. sesiones de
   control declaradas), que no existen todavía.

## 7. Pendiente

- Calibrar una referencia real (cohorte de calibración distinta de la investigada; necesita los tiempos activos de la
  telemetría v2) y guardarla versionada.
- Conectar D6 v2 al Laboratorio LIEIA y al panel de investigación (estados, cobertura, alarma de deriva), manteniendo
  el D6 v1 visible solo como histórico.
