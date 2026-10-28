# LIEIA · Validación de la telemetría del proceso de respuesta

Generado 2026-10-28T01:55:07.551Z · semilla 20261029 · 20 réplicas por escenario · 30 estudiantes × 16 preguntas · 0.2 min.
Reproducir: `./node_modules/.bin/vite-node scripts/lieia-proceso.ts 20`. Se usan las MISMAS funciones que con datos reales (reconstruir → analizarProceso).

## Veredictos

| Detector | Estado | Peor tasa de falsos positivos (IC 95 %) | Potencia en su objetivo |
|---|---|---|---|
| P1 Respuestas rápidas con envío diferido | validado | 3.2 % (2.0 %–4.9 %) en «Interrupciones» | Respuestas rápidas con envío diferido: 100.0 % |
| P2 Regularidad anómala de los intervalos | validado_limitado | 3.3 % (2.2 %–5.1 %) en «Resolución normal» | Ritmo artificialmente regular: 25.0 %; Respuestas pegadas (asistencia externa): 23.8 % |
| P3 Respuestas que aparecen de golpe | descriptivo (no validable) | — | Las frecuencias simuladas no dicen nada de la realidad: en el simulador los honestos nunca pegan |

## Por escenario (tasa de señalados a α = 0,05)

| Escenario | Tipo | P1 FP / potencia | P2 FP / potencia | Con muchos «pegados» (pos / neg) | Error de reconstrucción (mediana · p90) | Primeras vistas recuperadas |
|---|---|---|---|---|---|---|
| Resolución normal | negativo | 1.5 % / — | 3.3 % / — | — / 0.0 % | 0.05 s · 0.06 s | 100.0 % |
| Revisión prolongada | negativo | 1.5 % / — | 3.3 % / — | — / 0.0 % | 0.05 s · 0.06 s | 100.0 % |
| Rápidos que entregan enseguida | negativo | 1.8 % / — | 3.3 % / — | — / 0.0 % | 0.05 s · 0.06 s | 100.0 % |
| Muchas correcciones | negativo | 2.5 % / — | 3.3 % / — | — / 0.0 % | 0.05 s · 0.06 s | 100.0 % |
| Interrupciones | negativo | 3.2 % / — | 3.3 % / — | — / 0.0 % | 0.05 s · 0.06 s | 100.0 % |
| Conexión deficiente | negativo | 2.4 % / — | 3.3 % / — | — / 0.0 % | 0.06 s · 0.08 s | 70.5 % |
| Respuestas rápidas con envío diferido | positivo | 1.2 % / 100.0 % | 2.5 % / 8.8 % | 0.0 % / 0.0 % | 0.05 s · 0.06 s | 100.0 % |
| Respuestas pegadas (asistencia externa) | positivo | 0.8 % / 6.3 % | 0.2 % / 23.8 % | 100.0 % / 0.0 % | 0.05 s · 0.06 s | 100.0 % |
| Ritmo artificialmente regular | positivo | 2.1 % / 0.0 % | 0.0 % / 25.0 % | 0.0 % / 0.0 % | 0.05 s · 0.06 s | 100.0 % |
| Envío diferido con revisión simulada (adversarial) | adversarial | 0.4 % / 6.3 % | 1.9 % / 12.5 % | 0.0 % / 0.0 % | 0.05 s · 0.06 s | 100.0 % |
| Asistencia tecleada a mano (adversarial) | adversarial | 0.8 % / 6.3 % | 0.4 % / 22.5 % | 0.0 % / 0.0 % | 0.05 s · 0.06 s | 100.0 % |
| Ritmo regular con ruido (adversarial) | adversarial | 2.1 % / 0.0 % | 0.0 % / 25.0 % | 0.0 % / 0.0 % | 0.05 s · 0.06 s | 100.0 % |

## Robustez ante pérdida de eventos

| Pérdida | FP P1 | FP P2 | Potencia P1 (envío diferido) | Potencia P2 (ritmo regular) | Pérdida observada | Primeras vistas recuperadas | Error de reconstrucción |
|---|---|---|---|---|---|---|---|
| 0.0 % | 1.7 % | 3.3 % | 100.0 % | 25.0 % | 0.0 % | 100.0 % | 0.05 s |
| 10.0 % | 3.0 % | 3.3 % | 95.0 % | 25.0 % | 9.9 % | 90.1 % | 0.05 s |
| 30.0 % | 4.7 % | 3.3 % | 87.2 % | 25.0 % | 29.1 % | 69.9 % | 0.05 s |
| 50.0 % | 0.6 % | 3.6 % | 54.2 % | 10.8 % | 48.7 % | 49.5 % | 0.06 s |

## Límites

- Los comportamientos «legítimos» del laboratorio los define el simulador: que un detector controle los falsos positivos aquí no garantiza que lo haga con los hábitos reales de una sección. Por eso los resultados reales se presentan con incertidumbre, sin sanciones y con explicaciones alternativas.
- Quien simula actividad durante la espera (adversarial) o teclea a mano una respuesta externa reduce o anula la señal.
- Los eventos del navegador pueden perderse, retrasarse o manipularse: la reconstrucción cuantifica la pérdida observable (huecos de secuencia), no la manipulación.
