# LIEIA · D6 — Sensibilidad temporal a la dificultad

| Versión | Estado | Código |
|---|---|---|
| D6 v1 (`d6-1`) | **RETIRADO** el 2026-10-30 por defectos metodológicos. Resultados históricos conservados y marcados como obsoletos en el panel. | `src/lib/lieia/detectores.ts` (sin cambios) |
| D6 v2 (`d6-2.1`) | **EXPERIMENTAL.** No se usa con datos reales hasta tener una referencia real apropiada y una validación independiente. | `src/lib/lieia/d6.ts`, `d6Validacion.ts`, `tests/lieia-d6.test.ts` |

Evaluación final por simulación: `docs/LIEIA_D6_VALIDACION.md` (generada por `scripts/lieia-d6-validar.ts`).

> D6 dice **qué tan improbable sería el patrón de tiempos si el estudiante se comportara como la población de
> referencia**. No es la probabilidad de que haya usado IA, ni de culpa. Es una razón para mirar, no una conclusión.

## 1. Defectos del D6 v1 (confirmados en el código)

1. La «normalidad» (β_j, σ_j, τ_i de `ajustarTiempos`) se estimaba con la misma sección investigada: el resultado de un estudiante dependía de sus compañeros.
2. El regresor era la intensidad temporal media de la pregunta (β_j), no su dificultad: medía «tarda más donde todos tardan».
3. Sin variación entre preguntas, `pend()` devolvía 1 («normal»): un valor inventado cuando el indicador no es identificable.
4. Solo exigía `respondidas ≥ 8`: mínimo arbitrario, sin comprobar cobertura de niveles ni precisión.
5. El tiempo por pregunta (`duraciones()`) era el intervalo entre primeras respuestas consecutivas: incluía pausas, pestaña oculta, lectura de otras preguntas y revisiones.
6. No distinguía respuestas correctas de incorrectas.
7. (Adicional) La nula del remuestreo usaba parámetros estimados con los mismos datos, incluido el propio estudiante.

La batería simulada lo daba por «Validado» porque generaba los datos con el mismo modelo que el detector suponía.
Ahora `validacion.ts → OBSOLETOS` lo retira: `habilitado('d6')` es falso, la ficha y la vista de datos reales lo muestran en gris como «valor histórico v1 — no usar», y el informe de validación lo marca como obsoleto.

## 2. Modelo D6 v2

**D6-A (sensibilidad).** `log T_ij = μ_j + α_i + β_i (D_j − D_ref) + ε_ij`. Referencia EXTERNA (otra cohorte), versionada y fija; la varianza de cada residuo incluye la incertidumbre de μ̂_j. `z = β̂/√(SE² + τ_β²)`, `p = Φ(z)`.

**D6-B (rapidez relativa).** Correctas con `log T − μ_j < −2·√(σ_j² + se_μ² + τ_α²)`. La p integra sobre la velocidad personal α ~ N(0, τ_α²) **de la referencia**. No se estima ni se descuenta la velocidad del propio estudiante: una normalización interna borraría la rapidez de quien recibe ayuda durante todo el examen (comprobado: sensibilidad 1,3 % con normalización interna frente a 85,8 % con la referencia, en el escenario ×0,3).

## 3. Tiempo observable: reconstrucción de intervalos

Una pregunta **no** se excluye por contener una pausa. `reconstruirTiempo()` suma los intervalos de trabajo y descuenta pausa declarada, pestaña oculta, desconexión y el tiempo en otras preguntas. La inactividad con la pregunta visible cuenta como trabajo hasta 5 min (pensar); el exceso queda sin clasificar. Solo se excluye la observación cuando no se puede reconstruir: intervalos inconsistentes, sin trabajo identificado, o con tiempo sin clasificar que haga la ambigüedad mayor del 10 % (`ln(t_max/t_min) > 0,1`). Nunca se imputa ni vale 0.

**Sesgo por pausas que dependen de la dificultad** (pausas más frecuentes en preguntas difíciles y largas; evaluación final, sesgo medio de β̂ en honestos):

| Estrategia | Sesgo de β̂ | Consecuencia |
|---|---|---|
| Intervalos reconstruidos (la de D6 v2.1) | −0,001 ± 0,002 | sin sesgo detectable |
| Reloj de pared (pausas sin descontar) | +0,056 ± 0,002 | oculta la insensibilidad (sensibilidad 76 % frente a 89 %) y sube la FPR sin puerta a 7,7 % |
| Pausas que la telemetría no registra | +0,057 ± 0,002 | igual que el reloj de pared |
| Excluir la pregunta que tiene una pausa (la de D6 v2.0) | −0,054 ± 0,003 | sesgo en sentido contrario y pérdida de cobertura (la mayoría queda con precisión insuficiente) |
| Bordes de pausa sin registrar (huecos de 2 s o 60 s) | −0,007 ± 0,002 | sesgo pequeño pero detectable; más abstención |

Por eso la telemetría de la etapa 2 registra las pausas como intervalos con hora del servidor.

## 4. Estados (sin valores de sustitución)

| Estado | Cuándo | β | p |
|---|---|---|---|
| Sensibilidad identificable | tres niveles con tiempos válidos y SE ≤ se_max | sí | sí |
| Contraste parcial | dos niveles con tiempos válidos y SE ≤ se_max | sí | sí |
| Precisión insuficiente | niveles distintos, SE > se_max | sí (con SE) | no |
| Datos temporales inválidos | se respondieron ≥ 2 niveles, pero los tiempos válidos cubren < 2 | no | no |
| Sensibilidad no identificable | lo respondido es de un solo nivel | no | no |
| Sin datos · Referencia no informativa · **Referencia no aplicable** | ver §5 | — | no |

## 5. Política de abstención cuando la referencia no es aplicable

Un 27–29 % de falsos positivos bajo cambio poblacional es inaceptable, así que la alarma ya no es solo un aviso: **si no se demuestra que la referencia describe a la cohorte, todos los resultados individuales de la cohorte se abstienen** (estado «Referencia no aplicable», p = null). Nunca se recalibra con la sección investigada.

Requisitos (todos):
1. **Contexto** (antes de mirar los datos): referencia calibrada (no provisional), mismo protocolo, misma asignatura, misma modalidad (examen o práctica), misma versión de telemetría, y vigente.
2. **Equivalencia** (la carga de la prueba es demostrar la compatibilidad, no detectar la incompatibilidad): con la localización y la escala robustas (Huber) de los z de la cohorte, la tasa de falsos positivos en el peor caso plausible (límite de confianza unilateral del 95 % de la localización; escala estimada si es significativamente mayor que 1) debe ser ≤ 10 % (2α). Para D6-B se evalúa la misma condición sobre la velocidad general estandarizada, calculando su efecto sobre la tasa de D6-B.

**Lo que se gana** (evaluación final): sin la puerta, una población distinta da 28,6 % de falsos positivos (sensibilidad 0,3 frente a 0,5), 15,3 % (dispersión de β ×2,5) y 22,2 % en D6-B (población más rápida). Con la puerta, 0 % de la cohorte evaluada en los dos primeros y en D6-B; en el de dispersión, el 4,3 % de los honestos recibe resultado, con una FPR del 9,6 % [7,7–11,9] entre ellos. Es decir, la garantía de la puerta es «≤ 10 %», no «5 %».

**Lo que cuesta** (y no se puede evitar con los datos de una sola sección): una población distinta y una contaminación extensa producen el mismo desplazamiento en la cohorte. Una política que protege contra lo primero tiene que abstenerse en lo segundo:

| Contaminación de la cohorte | Cohortes donde D6-A da resultados | Sensibilidad entre todos los contaminados |
|---|---|---|
| 0 % | 70 % (el 12 % de las referencias no alcanza la precisión con 12 preguntas; del resto, un 20 % de cohortes honestas no demuestra la equivalencia) | — |
| 5 % | 51 % | 45,6 % |
| 10 % | 16 % | 13,8 % |
| ≥ 20 % | 0 % | 0 % |

Con contaminación ≥ 20 % D6 no dice nada individual: la cohorte entera se aparta de la referencia, y eso se presenta como observación **de la cohorte**, no de nadie en particular. Para que D6 funcione con contaminación alta hace falta establecer la aplicabilidad **sin usar las respuestas investigadas**. La vía recomendada es una referencia de la **misma población** en condiciones controladas, por ejemplo una actividad supervisada con las mismas familias de problemas. Eso necesita una decisión docente y datos que todavía no existen.

## 6. Rapidez legítima

D6-B controla la tasa global (2,8 % de señalados entre honestos de una cohorte normal), pero no distingue la rapidez extrema legítima: señala al 7,3 % de los estudiantes honestos con velocidad en el percentil 90 y al 42,6 % de los del percentil 99. Por eso D6-B nunca debe leerse sin la revisión humana de las respuestas.

## 7. Diseño del examen: consecuencia de la calibración actual, no regla universal

La precisión de β̂ depende de la separación de dificultades y de la variabilidad de los tiempos, no del número de preguntas en sí. Con las referencias simuladas (pendiente ≈ 0,50; τ_β ≈ 0,10):

| Diseño | Preguntas | Referencias con precisión suficiente |
|---|---|---|
| Tres niveles × 4 | 12 | 88 % |
| **Solo extremos 4 + 4** | **8** | **88 %** (igual que 12 repartidas: las intermedias no aportan a la pendiente) |
| Tres niveles × 5 | 15 | 97 % |
| Extremos 3 + 3 con familias calibradas de rango amplio (D = ±1,5)* | 6 | 99 % |
| Tres niveles × 2 en tres evaluaciones acumuladas* | 18 (6 por examen) | 99 % |

\* Requieren supuestos: familias de problemas isomorfos con dificultad empírica más separada (hay que calibrarlas); β_i estable a lo largo del semestre (no comprobado).

D6 **no obliga a alargar los exámenes**. Si el examen no permite la precisión, D6 se abstiene («Precisión insuficiente»). Para quien quiera usarlo, lo eficiente es: pocas preguntas en los extremos de dificultad, familias calibradas de rango amplio, o acumular la evidencia a lo largo del semestre.

## 8. Validación: reglas que se siguieron

- Protocolo (umbrales, reglas, semillas, configuración), escenarios y diseños **congelados** antes de la evaluación final (huellas `eedb7558` / `40a5c6fe` / `41bff7b4`). El script de evaluación se niega a correr si cambian, y una prueba lo impide en silencio.
- Semillas de desarrollo (1, 3, 5, 7, 11, 42, 99, 314, 2026, 2718) separadas de las de evaluación (50 000–50 099). Ajusté con las primeras. Las segundas se ejecutaron una sola vez.
- Por escenario se informan: FPR entre evaluados, señalados entre todos, cobertura, sensibilidad entre evaluados y entre todos, cohortes aplicables, abstenciones por causa y lo que habría pasado sin la puerta, con IC de Wilson y distribución entre semillas (mediana, P5–P95).
- Antes de congelar fijé que los escenarios que aíslan otro factor (cobertura, telemetría, contexto, tamaño) usaran un 5 % de contaminación, porque con un 20 % la puerta los dejaba sin ningún evaluado y no medían su factor. El efecto de la contaminación se estudia aparte (0–100 %).
- La variación entre semillas es grande: la FPR por semilla de D6-A con contaminación 0 % va de 1,7 % a 8,3 % (P5–P95). La tasa agregada es 4,3 % [4,0–4,7].

## 9. Pendiente

- Referencia real: cohorte de calibración distinta de la investigada (o de la misma población en condiciones controladas), con los intervalos de la telemetría de la etapa 2.
- Validación independiente con casos de verdad conocida (no simulados).
- Solo después, conectar D6 v2 al Laboratorio y al panel de investigación, con sus estados, la aplicabilidad y las advertencias.
