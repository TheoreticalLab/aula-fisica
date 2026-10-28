# LIEIA · Experimentos de diseño de exámenes

Generado: 2026-10-28T01:10:23.997Z · semilla 20261028 · 20 réplicas por diseño y escenario · 36 estudiantes · 99 permutaciones · 5.8 min.
Reproducir: `./node_modules/.bin/vite-node scripts/lieia-disenos.ts 20`.

Cada contraste compara dos diseños con los mismos escenarios y semillas. «Aporta» = sube la potencia ≥ 10 puntos sin romper el control de falsos positivos; «engañosa» = algún control negativo supera el límite (IC superior > 7,5 %) solo con la característica; «resta» = baja la potencia ≥ 10 puntos.

## Orden aleatorio con fatiga, SIN corrección por posición

Referencia «fijo+fatiga» frente a «aleatorio+fatiga sin corrección»; escenario positivo: Copia en parejas; controles negativos: Independencia, Mismo ritmo y habilidad.

| Detector | Potencia referencia | Potencia con la característica | Peor FP con la característica | Veredicto |
|---|---|---|---|---|
| D1 Respuestas incorrectas idénticas | 95.0 % | 93.3 % | 3.1 % | **neutra** |
| D2 Tiempos acoplados | 38.3 % | 41.7 % | 2.8 % | **neutra** |
| D3 Sincronía de respuestas iguales | 83.3 % | 95.0 % | 3.6 % | **aporta** |
| D4 Ajuste de persona (l_z) | 0.0 % | 1.7 % | 0.6 % | **neutra** |
| D6 Tiempo insensible a la dificultad | 10.0 % | 6.7 % | 4.2 % | **neutra** |

## Orden aleatorio con fatiga, CON corrección por posición

Referencia «fijo+fatiga» frente a «aleatorio+fatiga»; escenario positivo: Copia en parejas; controles negativos: Independencia, Mismo ritmo y habilidad.

| Detector | Potencia referencia | Potencia con la característica | Peor FP con la característica | Veredicto |
|---|---|---|---|---|
| D1 Respuestas incorrectas idénticas | 98.3 % | 98.3 % | 3.8 % | **neutra** |
| D2 Tiempos acoplados | 40.0 % | 48.3 % | 2.8 % | **neutra** |
| D3 Sincronía de respuestas iguales | 91.7 % | 90.0 % | 3.6 % | **neutra** |
| D4 Ajuste de persona (l_z) | 1.7 % | 0.0 % | 0.6 % | **neutra** |
| D6 Tiempo insensible a la dificultad | 5.0 % | 6.7 % | 3.8 % | **neutra** |

## Más preguntas abiertas (70 % frente a 30 %)

Referencia «base» frente a «abiertas 70 %»; escenario positivo: Copia en parejas; controles negativos: Independencia, Mismo ritmo y habilidad.

| Detector | Potencia referencia | Potencia con la característica | Peor FP con la característica | Veredicto |
|---|---|---|---|---|
| D1 Respuestas incorrectas idénticas | 95.0 % | 93.3 % | 5.0 % | **neutra** |
| D3 Sincronía de respuestas iguales | 80.0 % | 95.0 % | 3.2 % | **aporta** |

## Pares isomorfos (versiones equivalentes, todos ven ambas)

Referencia «base» frente a «isomorfos»; escenario positivo: Filtración de preguntas; controles negativos: Independencia, Mismo ritmo y habilidad.

| Detector | Potencia referencia | Potencia con la característica | Peor FP con la característica | Veredicto |
|---|---|---|---|---|
| D8 Inconsistencia entre versiones isomorfas | 0.0 % | 81.7 % | 4.3 % | **aporta** |
| D5 Aciertos difíciles demasiado rápidos | 28.3 % | 40.0 % | 0.7 % | **aporta** |
| D4 Ajuste de persona (l_z) | 5.0 % | 3.3 % | 0.7 % | **neutra** |

## Versiones distintas por estudiante (una variante por grupo)

Referencia «isomorfos» frente a «isomorfos+versiones»; escenario positivo: Copia en parejas; controles negativos: Independencia, Mismo ritmo y habilidad.

| Detector | Potencia referencia | Potencia con la característica | Peor FP con la característica | Veredicto |
|---|---|---|---|---|
| D1 Respuestas incorrectas idénticas | 91.7 % | 93.5 % | 2.1 % | **neutra** |
| D3 Sincronía de respuestas iguales | 68.3 % | 19.4 % | 2.8 % | **resta** |

## Examen más largo (36 frente a 24 preguntas)

Referencia «base» frente a «36 ítems»; escenario positivo: Copia en parejas; controles negativos: Independencia, Mismo ritmo y habilidad.

| Detector | Potencia referencia | Potencia con la característica | Peor FP con la característica | Veredicto |
|---|---|---|---|---|
| D1 Respuestas incorrectas idénticas | 95.0 % | 93.3 % | 2.4 % | **neutra** |
| D3 Sincronía de respuestas iguales | 66.7 % | 98.3 % | 3.2 % | **aporta** |

## Orden contrabalanceado por bloques con fatiga

Referencia «fijo+fatiga» frente a «contrabalanceado+fatiga»; escenario positivo: Copia en parejas; controles negativos: Independencia, Mismo ritmo y habilidad.

| Detector | Potencia referencia | Potencia con la característica | Peor FP con la característica | Veredicto |
|---|---|---|---|---|
| D1 Respuestas incorrectas idénticas | 93.3 % | 98.3 % | 2.8 % | **neutra** |
| D3 Sincronía de respuestas iguales | 91.7 % | 83.3 % | 1.9 % | **neutra** |
| D6 Tiempo insensible a la dificultad | 5.0 % | 3.3 % | 5.1 % | **neutra** |

