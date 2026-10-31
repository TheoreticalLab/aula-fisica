# LIEIA · D6 v2 — Evaluación final por simulación (d6-2.1)

> **Simulación, no validación empírica.** Datos sintéticos. Ningún número de este informe describe a estudiantes reales.

Generado: 2026-10-31T01:17:44.979Z · 9.3 min · 100 semillas de EVALUACIÓN (50000–50099), distintas de las de desarrollo (1, 3, 5, 7, 11, 42, 99, 314, 2026, 2718) · 3 cohortes de 60 estudiantes por escenario y semilla · referencia nueva por semilla (300 estudiantes de calibración).

Protocolo, escenarios y diseños congelados antes de ejecutar (huellas `eedb7558` / `40a5c6fe` / `41bff7b4`); el script se niega a correr si cambian. Reproducir: `./node_modules/.bin/vite-node scripts/lieia-d6-validar.ts`.

## Cómo leer las tablas

- **FPR (evaluados)**: señalados (p < 0,05) entre los honestos que recibieron un resultado. **FPR (todos)**: señalados entre TODOS los honestos.
- **Sensibilidad (evaluados / todos)**: lo mismo entre los estudiantes con el comportamiento simulado. En los escenarios de «rápidos legítimos» esa columna es una tasa de FALSOS positivos (son honestos).
- **Cobertura**: fracción que recibió un resultado. Una FPR baja con cobertura baja no es un éxito: el detector se abstuvo.
- **Cohortes aplicables**: fracción de cohortes en que la referencia se declaró aplicable (si no, toda la cohorte se abstiene).
- **Sin la puerta**: lo que habría pasado sin la política de abstención por aplicabilidad (para medir qué evita y qué cuesta).
- Cada celda: tasa agregada [IC de Wilson 95 %] y, debajo, la mediana entre semillas con su rango P5–P95.

## Referencias calibradas (variación entre semillas)

| Parámetro | Mediana | P5–P95 |
|---|---|---|
| pendiente_mu_D | 0.501 | 0.450–0.551 |
| tau_beta | 0.100 | 0.082–0.110 |
| tau_alpha | 0.349 | 0.328–0.375 |
| se_max | 0.174 | 0.149–0.199 |

## Contaminación de la cohorte

| Escenario | Det. | FPR (evaluados) | FPR (todos) | Cobertura honestos | Sensibilidad (evaluados) | Sensibilidad (todos) | Cohortes aplicables | Sin la puerta: FPR / sens. |
|---|---|---|---|---|---|---|---|---|
| Contaminación 0 % (insensibles) | D6-A | 4.3 % [4.0 %–4.7 %]<br><small>semillas: 4.2 % (P5–P95 1.7 %–8.3 %)</small> | 3.1 % | 70.3 % | — | — | 70.3 % | 5.2 % / — |
| Contaminación 0 % (insensibles) | D6-B | 2.8 % [2.6 %–3.1 %]<br><small>semillas: 2.8 % (P5–P95 0.6 %–5.1 %)</small> | 2.8 % | 98.8 % | — | — | 100.0 % | 2.8 % / — |
| Contaminación 5 % (insensibles) | D6-A | 3.5 % [3.2 %–3.9 %]<br><small>semillas: 3.5 % (P5–P95 0.9 %–7.0 %)</small> | 1.8 % | 51.0 % | 89.3 % [86.2 %–91.8 %]<br><small>semillas: 100.0 % (P5–P95 66.7 %–100.0 %)</small> | 45.6 % | 51.0 % | 4.9 % / 89.5 % |
| Contaminación 10 % (insensibles) | D6-A | 2.6 % [2.1 %–3.3 %]<br><small>semillas: 2.8 % (P5–P95 0.0 %–5.6 %)</small> | 0.4 % | 16.3 % | 84.7 % [80.1 %–88.4 %]<br><small>semillas: 83.3 % (P5–P95 66.7 %–100.0 %)</small> | 13.8 % | 16.3 % | 5.3 % / 88.9 % |
| Contaminación 20 % (insensibles) | D6-A | — | 0.0 % | 0.0 % | — | 0.0 % | 0.0 % | 4.9 % / 88.7 % |
| Contaminación 50 % (insensibles) | D6-A | — | 0.0 % | 0.0 % | — | 0.0 % | 0.0 % | 5.2 % / 89.3 % |
| Contaminación 80 % (insensibles) | D6-A | — | 0.0 % | 0.0 % | — | 0.0 % | 0.0 % | 5.0 % / 88.8 % |
| Contaminación 100 % (insensibles) | D6-A | — | — | — | — | 0.0 % | 0.0 % | — / 88.1 % |

## Rapidez y asistencia (D6-B)

| Escenario | Det. | FPR (evaluados) | FPR (todos) | Cobertura honestos | Sensibilidad (evaluados) | Sensibilidad (todos) | Cohortes aplicables | Sin la puerta: FPR / sens. |
|---|---|---|---|---|---|---|---|---|
| Copia rápida y correcta (20 %) | D6-A | 4.4 % [4.1 %–4.8 %]<br><small>semillas: 4.2 % (P5–P95 2.1 %–8.3 %)</small> | 3.3 % | 74.0 % | 2.5 % [2.0 %–3.1 %]<br><small>semillas: 2.8 % (P5–P95 0.0 %–8.3 %)</small> | 1.8 % | 74.0 % | 4.9 % / 2.9 % |
| Copia rápida y correcta (20 %) | D6-B | 0.8 % [0.3 %–1.6 %]<br><small>semillas: 0.0 % (P5–P95 0.0 %–2.2 %)</small> | 0.0 % | 5.6 % | 100.0 % [98.2 %–100.0 %]<br><small>semillas: 100.0 % (P5–P95 100.0 %–100.0 %)</small> | 5.7 % | 5.7 % | 2.7 % / 100.0 % |
| Asistencia en todo el examen, ×0,3 en tiempo (20 %) | D6-A | 4.5 % [4.2 %–4.9 %]<br><small>semillas: 4.2 % (P5–P95 2.1 %–8.3 %)</small> | 3.5 % | 77.3 % | 2.3 % [1.8 %–2.9 %]<br><small>semillas: 2.8 % (P5–P95 0.0 %–8.3 %)</small> | 1.8 % | 77.3 % | 4.9 % / 2.4 % |
| Asistencia en todo el examen, ×0,3 en tiempo (20 %) | D6-B | 0.7 % [0.3 %–1.4 %]<br><small>semillas: 0.0 % (P5–P95 0.0 %–2.1 %)</small> | 0.0 % | 7.2 % | 81.4 % [76.3 %–85.7 %]<br><small>semillas: 83.3 % (P5–P95 75.0 %–100.0 %)</small> | 6.0 % | 7.3 % | 2.7 % / 85.8 % |
| Asistencia en todo el examen, ×0,6 en tiempo (20 %) | D6-B | 2.6 % [2.3 %–2.9 %]<br><small>semillas: 2.1 % (P5–P95 0.0 %–5.4 %)</small> | 2.2 % | 84.0 % | 23.1 % [21.7 %–24.7 %]<br><small>semillas: 22.2 % (P5–P95 11.1 %–36.1 %)</small> | 19.7 % | 85.0 % | 2.9 % / 24.6 % |
| Rápidos legítimos (10 % con velocidad en el P90) | D6-B | 2.7 % [2.4 %–3.0 %]<br><small>semillas: 2.5 % (P5–P95 0.6 %–4.9 %)</small> | 2.6 % | 98.5 % | 7.3 % [6.2 %–8.6 %]<br><small>semillas: 5.6 % (P5–P95 0.0 %–22.2 %)</small> | 7.2 % | 99.7 % | 2.7 % / 7.4 % |
| Rápidos legítimos (10 % con velocidad en el P99) | D6-B | 2.5 % [2.3 %–2.8 %]<br><small>semillas: 2.5 % (P5–P95 0.0 %–4.9 %)</small> | 2.0 % | 81.8 % | 42.6 % [40.1 %–45.1 %]<br><small>semillas: 41.7 % (P5–P95 23.5 %–60.0 %)</small> | 34.9 % | 83.0 % | 3.0 % / 43.8 % |
- Asistencia en todo el examen, ×0,3 en tiempo (20 %) · D6-B con normalización INTERNA (descontando la velocidad propia): sensibilidad 1.3 % frente a 85.8 % con la referencia; FPR 0.8 %.
- Asistencia en todo el examen, ×0,6 en tiempo (20 %) · D6-B con normalización INTERNA (descontando la velocidad propia): sensibilidad 1.3 % frente a 24.6 % con la referencia; FPR 0.9 %.

## Población distinta de la de calibración

| Escenario | Det. | FPR (evaluados) | FPR (todos) | Cobertura honestos | Sensibilidad (evaluados) | Sensibilidad (todos) | Cohortes aplicables | Sin la puerta: FPR / sens. |
|---|---|---|---|---|---|---|---|---|
| Población distinta: sensibilidad 0,3 frente a 0,5 | D6-A | — | 0.0 % | 0.0 % | — | — | 0.0 % | 28.6 % / — |
| Población distinta: dispersión de β × 2,5 | D6-A | 9.6 % [7.7 %–11.9 %]<br><small>semillas: 10.0 % (P5–P95 6.7 %–13.3 %)</small> | 0.4 % | 4.3 % | — | — | 4.3 % | 15.3 % / — |
| Población distinta: más rápida en general (−0,5 en log T) | D6-B | — | 0.0 % | 0.0 % | — | — | 0.0 % | 22.2 % / — |
| Población distinta (0,3) + 20 % insensibles | D6-A | — | 0.0 % | 0.0 % | — | 0.0 % | 0.0 % | 28.0 % / 89.0 % |
| Cohorte pequeña (15 estudiantes), 5 % insensibles | D6-A | 2.3 % [1.5 %–3.5 %]<br><small>semillas: 0.0 % (P5–P95 0.0 %–7.1 %)</small> | 0.5 % | 20.0 % | 85.0 % [73.9 %–91.9 %]<br><small>semillas: 100.0 % (P5–P95 0.0 %–100.0 %)</small> | 17.0 % | 20.0 % | 5.2 % / 89.4 % |
| Cohorte pequeña (15 estudiantes), 5 % insensibles | D6-B | 2.1 % [1.7 %–2.6 %]<br><small>semillas: 2.4 % (P5–P95 0.0 %–7.1 %)</small> | 1.8 % | 84.1 % | 9.4 % [6.4 %–13.6 %]<br><small>semillas: 0.0 % (P5–P95 0.0 %–50.0 %)</small> | 8.0 % | 85.3 % | 2.7 % / 11.3 % |

## Cobertura de niveles (diseño del examen)

| Escenario | Det. | FPR (evaluados) | FPR (todos) | Cobertura honestos | Sensibilidad (evaluados) | Sensibilidad (todos) | Cohortes aplicables | Sin la puerta: FPR / sens. |
|---|---|---|---|---|---|---|---|---|
| Solo nivel básico (12) | D6-A | — | 0.0 % | 0.0 % | — | 0.0 % | 0.0 % | — / — |
| Básico + intermedio (6 + 6) | D6-A | — | 0.0 % | 0.0 % | — | 0.0 % | 0.0 % | — / — |
| Básico + desafiante (4 + 4) | D6-A | 3.7 % [3.3 %–4.1 %]<br><small>semillas: 3.5 % (P5–P95 0.9 %–7.9 %)</small> | 1.8 % | 49.7 % | 85.9 % [82.4 %–88.8 %]<br><small>semillas: 100.0 % (P5–P95 66.7 %–100.0 %)</small> | 42.7 % | 49.7 % | 4.9 % / 87.6 % |
| Básico + desafiante (6 + 6) | D6-A | 3.9 % [3.5 %–4.3 %]<br><small>semillas: 3.5 % (P5–P95 1.8 %–7.0 %)</small> | 2.1 % | 53.7 % | 94.4 % [92.0 %–96.1 %]<br><small>semillas: 100.0 % (P5–P95 66.7 %–100.0 %)</small> | 50.7 % | 53.7 % | 4.9 % / 95.3 % |
| Tres niveles, 2 por nivel | D6-A | — | 0.0 % | 0.0 % | — | 0.0 % | 0.0 % | — / — |
| Tres niveles, 6 por nivel | D6-A | 3.5 % [3.2 %–3.9 %]<br><small>semillas: 3.5 % (P5–P95 1.8 %–7.0 %)</small> | 2.1 % | 58.0 % | 94.1 % [91.7 %–95.8 %]<br><small>semillas: 100.0 % (P5–P95 66.7 %–100.0 %)</small> | 54.6 % | 58.0 % | 4.7 % / 95.3 % |

## Telemetría imperfecta y pausas

| Escenario | Det. | FPR (evaluados) | FPR (todos) | Cobertura honestos | Sensibilidad (evaluados) | Sensibilidad (todos) | Cohortes aplicables | Sin la puerta: FPR / sens. |
|---|---|---|---|---|---|---|---|---|
| 30 % de preguntas sin registro de tiempo | D6-A | 2.9 % [2.1 %–4.0 %]<br><small>semillas: 0.0 % (P5–P95 0.0 %–6.9 %)</small> | 0.2 % | 7.6 % | 88.9 % [77.8 %–94.8 %]<br><small>semillas: 100.0 % (P5–P95 66.7 %–100.0 %)</small> | 5.3 % | 23.7 % | 5.1 % / 87.6 % |
| 30 % de preguntas sin registro de tiempo | D6-B | 2.2 % [2.0 %–2.4 %]<br><small>semillas: 2.4 % (P5–P95 0.6 %–4.1 %)</small> | 2.1 % | 96.8 % | 9.9 % [8.1 %–12.0 %]<br><small>semillas: 11.1 % (P5–P95 0.0 %–22.2 %)</small> | 9.9 % | 100.0 % | 2.2 % / 9.9 % |
| Pausas más frecuentes en preguntas difíciles y largas · intervalos reconstruidos | D6-A | 4.1 % [3.7 %–4.6 %]<br><small>semillas: 4.1 % (P5–P95 1.8 %–7.0 %)</small> | 2.0 % | 48.0 % | 86.8 % [83.3 %–89.7 %]<br><small>semillas: 100.0 % (P5–P95 50.0 %–100.0 %)</small> | 41.7 % | 48.0 % | 5.3 % / 88.6 % |
| Pausas más frecuentes en preguntas difíciles y largas · intervalos reconstruidos | D6-B | 2.8 % [2.5 %–3.0 %]<br><small>semillas: 2.9 % (P5–P95 1.2 %–4.7 %)</small> | 2.7 % | 98.8 % | 9.6 % [7.8 %–11.7 %]<br><small>semillas: 11.1 % (P5–P95 0.0 %–22.2 %)</small> | 9.6 % | 100.0 % | 2.8 % / 9.6 % |
| Pausas más frecuentes en preguntas difíciles y largas · reloj de pared (pausas sin descontar) | D6-A | 5.2 % [4.6 %–5.9 %]<br><small>semillas: 5.3 % (P5–P95 1.8 %–8.8 %)</small> | 1.3 % | 25.7 % | 75.8 % [69.8 %–80.8 %]<br><small>semillas: 83.3 % (P5–P95 33.3 %–100.0 %)</small> | 19.4 % | 25.7 % | 7.7 % / 76.3 % |
| Pausas más frecuentes en preguntas difíciles y largas · reloj de pared (pausas sin descontar) | D6-B | 2.4 % [2.2 %–2.6 %]<br><small>semillas: 2.4 % (P5–P95 0.6 %–4.8 %)</small> | 2.4 % | 98.7 % | 6.3 % [4.9 %–8.1 %]<br><small>semillas: 0.0 % (P5–P95 0.0 %–22.2 %)</small> | 6.3 % | 100.0 % | 2.4 % / 6.3 % |
| Pausas más frecuentes en preguntas difíciles y largas · excluir la pregunta con pausa | D6-A | 2.8 % [1.1 %–6.9 %]<br><small>semillas: 0.0 % (P5–P95 0.0 %–4.5 %)</small> | 0.0 % | 0.8 % | 100.0 % [56.6 %–100.0 %]<br><small>semillas: 100.0 % (P5–P95 100.0 %–100.0 %)</small> | 0.6 % | 3.7 % | 7.7 % / 91.3 % |
| Pausas más frecuentes en preguntas difíciles y largas · excluir la pregunta con pausa | D6-B | 2.7 % [2.5 %–3.0 %]<br><small>semillas: 2.4 % (P5–P95 0.6 %–5.3 %)</small> | 2.6 % | 97.5 % | 10.4 % [8.5 %–12.5 %]<br><small>semillas: 11.1 % (P5–P95 0.0 %–33.3 %)</small> | 10.3 % | 99.7 % | 2.7 % / 10.4 % |
| Pausas en difíciles NO registradas por la telemetría | D6-A | 5.0 % [4.5 %–5.7 %]<br><small>semillas: 5.3 % (P5–P95 1.8 %–8.8 %)</small> | 1.4 % | 27.3 % | 74.8 % [69.0 %–79.8 %]<br><small>semillas: 66.7 % (P5–P95 33.3 %–100.0 %)</small> | 20.4 % | 27.3 % | 7.1 % / 77.8 % |
| Pausas en difíciles NO registradas por la telemetría | D6-B | 2.6 % [2.4 %–2.9 %]<br><small>semillas: 2.4 % (P5–P95 0.6 %–4.8 %)</small> | 2.6 % | 98.8 % | 8.4 % [6.8 %–10.4 %]<br><small>semillas: 11.1 % (P5–P95 0.0 %–22.2 %)</small> | 8.4 % | 100.0 % | 2.6 % / 8.4 % |
| Pausas con bordes sin registrar (huecos de 2 s o 60 s) | D6-A | 3.6 % [3.1 %–4.1 %]<br><small>semillas: 3.0 % (P5–P95 0.0 %–7.4 %)</small> | 1.0 % | 29.4 % | 87.4 % [82.8 %–90.9 %]<br><small>semillas: 100.0 % (P5–P95 50.0 %–100.0 %)</small> | 25.4 % | 37.0 % | 5.4 % / 86.8 % |
| Pausas con bordes sin registrar (huecos de 2 s o 60 s) | D6-B | 2.6 % [2.4 %–2.9 %]<br><small>semillas: 2.4 % (P5–P95 0.6 %–4.7 %)</small> | 2.6 % | 98.3 % | 7.9 % [6.3 %–9.9 %]<br><small>semillas: 11.1 % (P5–P95 0.0 %–22.2 %)</small> | 7.9 % | 99.7 % | 2.6 % / 7.9 % |
- 30 % de preguntas sin registro de tiempo: sesgo medio de β̂ en honestos 0.000 ± 0.003 (n = 3895).
- Pausas más frecuentes en preguntas difíciles y largas · intervalos reconstruidos: sesgo medio de β̂ en honestos -0.001 ± 0.002 (n = 15048).
- Pausas más frecuentes en preguntas difíciles y largas · reloj de pared (pausas sin descontar): sesgo medio de β̂ en honestos 0.056 ± 0.002 (n = 15048).
- Pausas más frecuentes en preguntas difíciles y largas · excluir la pregunta con pausa: sesgo medio de β̂ en honestos -0.054 ± 0.003 (n = 5025).
- Pausas en difíciles NO registradas por la telemetría: sesgo medio de β̂ en honestos 0.057 ± 0.002 (n = 15048).
- Pausas con bordes sin registrar (huecos de 2 s o 60 s): sesgo medio de β̂ en honestos -0.007 ± 0.002 (n = 11574).

## Contexto

| Escenario | Det. | FPR (evaluados) | FPR (todos) | Cobertura honestos | Sensibilidad (evaluados) | Sensibilidad (todos) | Cohortes aplicables | Sin la puerta: FPR / sens. |
|---|---|---|---|---|---|---|---|---|
| Referencia de examen aplicada a una práctica | D6-A | — | 0.0 % | 0.0 % | — | 0.0 % | 0.0 % | 4.9 % / 87.5 % |
| Referencia de examen aplicada a una práctica | D6-B | — | 0.0 % | 0.0 % | — | 0.0 % | 0.0 % | 2.8 % / 8.3 % |

## Abstenciones por causa (D6-A, todas las semillas)

| Escenario | Sensibilidad identificable | Contraste parcial | Precisión insuficiente | Datos temporales inválidos | Sensibilidad no identificable | Sin datos | Referencia no informativa | Referencia no aplicable |
|---|---|---|---|---|---|---|---|---|
| Contaminación 0 % (insensibles) | 70.3 % | 0.0 % | 12.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 17.7 % |
| Contaminación 5 % (insensibles) | 51.0 % | 0.0 % | 12.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 37.0 % |
| Contaminación 10 % (insensibles) | 16.3 % | 0.0 % | 12.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 71.7 % |
| Contaminación 20 % (insensibles) | 0.0 % | 0.0 % | 12.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 88.0 % |
| Contaminación 50 % (insensibles) | 0.0 % | 0.0 % | 12.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 88.0 % |
| Contaminación 80 % (insensibles) | 0.0 % | 0.0 % | 12.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 88.0 % |
| Contaminación 100 % (insensibles) | 0.0 % | 0.0 % | 12.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 88.0 % |
| Copia rápida y correcta (20 %) | 74.0 % | 0.0 % | 12.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 14.0 % |
| Asistencia en todo el examen, ×0,3 en tiempo (20 %) | 77.3 % | 0.0 % | 12.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 10.7 % |
| Población distinta: sensibilidad 0,3 frente a 0,5 | 0.0 % | 0.0 % | 12.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 88.0 % |
| Población distinta: dispersión de β × 2,5 | 4.3 % | 0.0 % | 12.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 83.7 % |
| Población distinta (0,3) + 20 % insensibles | 0.0 % | 0.0 % | 12.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 88.0 % |
| Cohorte pequeña (15 estudiantes), 5 % insensibles | 20.0 % | 0.0 % | 12.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 68.0 % |
| Solo nivel básico (12) | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 100.0 % | 0.0 % | 0.0 % | 0.0 % |
| Básico + intermedio (6 + 6) | 0.0 % | 0.0 % | 100.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % |
| Básico + desafiante (4 + 4) | 0.0 % | 49.7 % | 12.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 38.3 % |
| Básico + desafiante (6 + 6) | 0.0 % | 53.7 % | 1.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 45.3 % |
| Tres niveles, 2 por nivel | 0.0 % | 0.0 % | 100.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % |
| Tres niveles, 6 por nivel | 58.0 % | 0.0 % | 1.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 41.0 % |
| 30 % de preguntas sin registro de tiempo | 7.5 % | 0.0 % | 77.1 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 15.3 % |
| Pausas más frecuentes en preguntas difíciles y largas · intervalos reconstruidos | 48.0 % | 0.0 % | 12.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 40.0 % |
| Pausas más frecuentes en preguntas difíciles y largas · reloj de pared (pausas sin descontar) | 25.7 % | 0.0 % | 12.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 62.3 % |
| Pausas más frecuentes en preguntas difíciles y largas · excluir la pregunta con pausa | 0.8 % | 0.0 % | 70.1 % | 0.1 % | 0.0 % | 0.0 % | 0.0 % | 28.9 % |
| Pausas en difíciles NO registradas por la telemetría | 27.3 % | 0.0 % | 12.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 60.7 % |
| Pausas con bordes sin registrar (huecos de 2 s o 60 s) | 29.3 % | 0.0 % | 32.2 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 38.4 % |
| Referencia de examen aplicada a una práctica | 0.0 % | 0.0 % | 12.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 88.0 % |

## Diseño del examen frente a la calibración actual

Proporción de las referencias calibradas (una por semilla) con las que cada diseño alcanza la precisión exigida (potencia ≥ 80 % frente a la insensibilidad completa). Es una consecuencia de la calibración (σ de los tiempos, pendiente y τ_β), no una regla universal.

| Diseño | Preguntas | Referencias con precisión suficiente | Potencia (mediana, P5–P95) |
|---|---|---|---|
| Tres niveles × 2 (6 preguntas) | 6 | 0.0 % | 64.9 % (56.4 %–73.4 %) |
| Tres niveles × 3 (9 preguntas) | 9 | 27.0 % | 76.7 % (69.3 %–84.2 %) |
| Tres niveles × 4 (12 preguntas) | 12 | 88.0 % | 83.9 % (76.7 %–90.6 %) |
| Tres niveles × 5 (15 preguntas) | 15 | 97.0 % | 88.7 % (82.4 %–94.0 %) |
| Tres niveles × 6 (18 preguntas) | 18 | 99.0 % | 91.7 % (86.3 %–96.3 %) |
| Solo extremos: 2 básicas + 2 desafiantes (4) | 4 | 0.0 % | 64.8 % (56.4 %–73.4 %) |
| Solo extremos: 3 básicas + 3 desafiantes (6) | 6 | 27.0 % | 76.7 % (69.3 %–84.2 %) |
| Solo extremos: 4 básicas + 4 desafiantes (8) | 8 | 88.0 % | 83.9 % (76.7 %–90.6 %) |
| Solo extremos: 5 básicas + 5 desafiantes (10) | 10 | 97.0 % | 88.7 % (82.4 %–94.0 %) |
| Solo extremos: 6 básicas + 6 desafiantes (12) | 12 | 99.0 % | 91.7 % (86.3 %–96.3 %) |
| Extremos 3 + 3 con familias calibradas de rango amplio (D = ±1,5) * | 6 | 99.0 % | 93.2 % (88.6 %–97.3 %) |
| Extremos 4 + 4 con familias calibradas de rango amplio (D = ±1,5) * | 8 | 99.0 % | 96.1 % (92.6 %–98.7 %) |
| Tres niveles × 2 en 3 evaluaciones acumuladas (18) * | 18 | 99.0 % | 91.8 % (86.4 %–96.5 %) |
- \* Extremos 3 + 3 con familias calibradas de rango amplio (D = ±1,5): Supone familias de problemas isomorfos con dificultad EMPÍRICA más separada que la de los niveles declarados; hay que calibrarlas.
- \* Extremos 4 + 4 con familias calibradas de rango amplio (D = ±1,5): Supone familias de problemas isomorfos con dificultad EMPÍRICA más separada que la de los niveles declarados; hay que calibrarlas.
- \* Tres niveles × 2 en 3 evaluaciones acumuladas (18): Supone que la sensibilidad individual β_i es estable entre evaluaciones del semestre (no comprobado).

Escenarios evaluados: 30.
