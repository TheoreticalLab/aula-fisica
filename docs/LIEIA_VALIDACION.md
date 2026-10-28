# LIEIA · Informe de validación

Generado: 2026-10-28T01:20:17.801Z · semilla 20261027 · 30 réplicas por escenario · 36 estudiantes × 24 ítems · 199 permutaciones / 199 remuestreos · duración 6.7 min.

Reproducir: `./node_modules/.bin/vite-node scripts/lieia-validar.ts 30` (mismos resultados con la misma semilla).

## Veredicto por detector

| Detector | Estado | Peor tasa de falsos positivos (IC 95 %) | Potencia en su escenario objetivo |
|---|---|---|---|
| D1 Respuestas incorrectas idénticas | Validado | 2.9 % (2.7 %–3.1 %) en «Orden aleatorio de preguntas» | Copia en parejas: 96.7 %; Red con fuente central: 97.8 % |
| D2 Tiempos acoplados | Validado con limitaciones (solo indicio) | 3.7 % (3.5 %–4.0 %) en «Filtración de preguntas» | Copia en parejas: 41.1 %; Red con fuente central: 41.1 % |
| D3 Sincronía de respuestas iguales | Validado | 5.7 % (5.3 %–6.0 %) en «Red con fuente central» | Copia en parejas: 87.8 %; Red con fuente central: 86.7 % |
| D4 Ajuste de persona (l_z) | Sin potencia demostrada | 1.3 % (0.8 %–2.2 %) en «Orden aleatorio de preguntas» | Asistencia externa / IA: 13.3 % |
| D5 Aciertos difíciles demasiado rápidos | Sin potencia demostrada | 1.3 % (0.8 %–2.2 %) en «Red con fuente central» | Asistencia externa / IA: 17.8 % |
| D6 Tiempo insensible a la dificultad | Validado | 5.1 % (3.9 %–6.6 %) en «Examen fácil» | Asistencia externa / IA: 100.0 % |
| D7 Anomalía multivariante (descriptiva) | No validado (falsos positivos no controlados) | 20.4 % (18.1 %–22.9 %) en «Independencia» | Asistencia externa / IA: 100.0 % |
| D8 Inconsistencia entre versiones isomorfas | Validado | 1.6 % (1.0 %–2.6 %) en «Filtración de preguntas» | Filtración de preguntas: 85.6 % |

Criterio: límite superior del IC ≤ 7.5 % en cada control negativo (Independencia, Examen fácil, Mismo ritmo y habilidad, Inicio escalonado, Orden aleatorio de preguntas, Misma confusión (causa común)) y entre las unidades no implicadas de los escenarios positivos y adversariales.

- **D1**: Señala al 40 % de las parejas con una misma confusión (causa común legítima): no distingue copiar de haber estudiado juntos.

## Probabilidad posterior de dependencia

- **D1**: ECE 0.001 · sin sobreconfianza · 26.0 % de las parejas dependientes reciben ≥ 0,5 → **no informativa: abstención**.
- **D2**: ECE 0.003 · sin sobreconfianza · 0.0 % de las parejas dependientes reciben ≥ 0,5 → **no informativa: abstención**.

## Resultados por escenario (tasa de alertas a α = 0,05)

| Escenario | Tipo | D1 | D2 | D3 | D4 | D5 | D6 | D7 | D8 |
|---|---|---|---|---|---|---|---|---|---|
| Independencia | negativo | FP 2.5 % | FP 3.2 % | FP 2.8 % | FP 0.5 % | FP 0.9 % | FP 3.8 % | FP 20.4 % | FP 0.0 % |
| Examen fácil | negativo | FP 0.8 % | FP 3.1 % | FP 2.9 % | FP 0.1 % | FP 0.7 % | FP 5.1 % | FP 15.6 % | FP 0.0 % |
| Misma confusión (causa común) | negativo | FP 2.4 % | FP 3.0 % | FP 2.8 % | FP 0.8 % | FP 0.8 % | FP 4.9 % | FP 18.6 % | FP 0.0 % |
| Mismo ritmo y habilidad | negativo | FP 2.4 % | FP 3.3 % | FP 3.2 % | FP 0.6 % | FP 0.4 % | FP 4.6 % | FP 18.9 % | FP 0.0 % |
| Inicio escalonado | negativo | FP 2.5 % | FP 3.2 % | FP 2.9 % | FP 0.5 % | FP 0.9 % | FP 3.8 % | FP 20.4 % | FP 0.0 % |
| Orden aleatorio de preguntas | negativo | FP 2.9 % | FP 3.2 % | FP 4.1 % | FP 1.3 % | FP 0.8 % | FP 4.8 % | FP 20.3 % | FP 0.0 % |
| Copia en parejas | positivo | FP 2.4 % · pot 96.7 % | FP 3.5 % · pot 41.1 % | FP 5.1 % · pot 87.8 % | FP 0.7 % · pot 2.2 % | FP 0.4 % · pot 2.2 % | FP 2.3 % · pot 8.9 % | FP 16.0 % · pot 37.8 % | FP 0.0 % |
| Red con fuente central | positivo | FP 2.3 % · pot 97.8 % | FP 3.7 % · pot 41.1 % | FP 5.7 % · pot 86.7 % | FP 1.1 % · pot 0.0 % | FP 1.3 % · pot 7.8 % | FP 3.5 % · pot 7.8 % | FP 16.8 % · pot 50.0 % | FP 0.0 % |
| Asistencia externa / IA | positivo | FP 2.3 % | FP 3.6 % | FP 3.1 % | FP 0.1 % · pot 13.3 % | FP 0.3 % · pot 17.8 % | FP 0.9 % · pot 100.0 % | FP 13.8 % · pot 100.0 % | FP 0.0 % |
| Filtración de preguntas | positivo | FP 2.6 % | FP 3.7 % | FP 3.5 % | FP 0.6 % · pot 6.7 % | FP 1.2 % · pot 32.2 % | FP 2.8 % · pot 24.4 % | FP 13.2 % · pot 87.8 % | FP 1.6 % · pot 85.6 % |
| Copia con retardo largo (adversarial) | adversarial | FP 2.5 % · pot 97.8 % | FP 3.0 % · pot 2.2 % | FP 3.0 % · pot 3.3 % | FP 0.7 % · pot 2.2 % | FP 0.6 % · pot 1.1 % | FP 3.6 % · pot 8.9 % | FP 18.0 % · pot 25.6 % | FP 0.0 % |
| Copia disfrazada (adversarial) | adversarial | FP 2.6 % · pot 41.1 % | FP 3.3 % · pot 46.7 % | FP 4.7 % · pot 81.1 % | FP 0.6 % · pot 0.0 % | FP 0.6 % · pot 2.2 % | FP 2.4 % · pot 8.9 % | FP 17.2 % · pot 40.0 % | FP 0.0 % |
| IA que imita los tiempos (adversarial) | adversarial | FP 2.3 % | FP 3.4 % | FP 3.4 % | FP 0.1 % · pot 13.3 % | FP 0.4 % · pot 0.0 % | FP 4.5 % · pot 2.2 % | FP 15.4 % · pot 67.8 % | FP 0.0 % |

Fuente central identificada (red con 3 receptores): 18/30 réplicas.

## Sensibilidad

**Probabilidad de copiar cada ítem (copia en parejas)** (potencia)

| valor | D1 | D2 | D3 |
|---|---|---|---|
| 0.2 | 26.7 % | 6.7 % | 43.3 % |
| 0.35 | 53.3 % | 6.7 % | 60.0 % |
| 0.5 | 73.3 % | 20.0 % | 70.0 % |
| 0.7 | 100.0 % | 33.3 % | 73.3 % |
| 0.9 | 100.0 % | 70.0 % | 76.7 % |

**Retardo mediano de la copia, en segundos** (potencia)

| valor | D1 | D2 | D3 |
|---|---|---|---|
| 10 | 100.0 % | 40.0 % | 100.0 % |
| 30 | 100.0 % | 30.0 % | 63.3 % |
| 90 | 100.0 % | 3.3 % | 10.0 % |
| 240 | 100.0 % | 0.0 % | 0.0 % |
| 600 | 100.0 % | 0.0 % | 0.0 % |

**Número de ítems (copia en parejas)** (potencia)

| valor | D1 | D2 | D3 |
|---|---|---|---|
| 10 | 80.0 % | 40.0 % | 26.7 % |
| 16 | 90.0 % | 43.3 % | 50.0 % |
| 24 | 100.0 % | 33.3 % | 73.3 % |
| 40 | 93.3 % | 50.0 % | 100.0 % |

**Número de estudiantes (independencia)** (falsos positivos)

| valor | D1 | D2 | D3 | D4 | D5 | D6 |
|---|---|---|---|---|---|---|
| 12 | 2.1 % | 1.2 % | 4.1 % | 0.8 % | 0.8 % | 3.3 % |
| 20 | 2.9 % | 1.8 % | 2.3 % | 2.0 % | 0.0 % | 5.5 % |
| 36 | 2.5 % | 2.9 % | 2.8 % | 0.0 % | 0.6 % | 2.5 % |
| 60 | 2.5 % | 3.5 % | 2.9 % | 1.3 % | 0.3 % | 4.8 % |

**Intensidad de la asistencia externa** (potencia)

| valor | D4 | D5 | D6 |
|---|---|---|---|
| 0.5 | 30.0 % | 30.0 % | 100.0 % |
| 0.7 | 13.3 % | 20.0 % | 100.0 % |
| 0.9 | 0.0 % | 10.0 % | 100.0 % |

## Qué NO puede inferirse

- Ningún detector prueba fraude ni identifica la causa: un valor p pequeño indica que los datos son improbables bajo independencia, no quién hizo qué.
- D1 no distingue copia de causa común (misma confusión, mismo material de estudio).
- La copia con retardo de varios minutos borra la huella temporal (D2, D3).
- La asistencia que imita los tiempos de un estudiante real no se distingue con telemetría (adversarial «IA que imita los tiempos»).
- Los resultados dependen de que el modelo generador del laboratorio represente razonablemente la realidad; por eso el panel muestra incertidumbre y abstención.
