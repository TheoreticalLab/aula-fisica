# LIEIA · Validación de la calibración 2PL

Generado 2026-10-28T01:12:44.567Z · semilla 7070 · 30 réplicas × 20 ítems por tamaño de muestra. Parámetros verdaderos: a ~ U(0,6; 2,0), b ~ N(0, 1), θ ~ N(0, 1).
Reproducir: `./node_modules/.bin/vite-node scripts/lieia-calibracion-validar.ts 30`.

| Estudiantes | RMSE de b | RMSE de a | Correlación b̂–b | Cobertura IC 95 % de b | Cobertura IC 95 % de a | Estados (calibrado / provisional / no calibrado) | Cobertura de b entre los «calibrados» |
|---|---|---|---|---|---|---|---|
| 40 | 0.425 | 0.382 | 0.937 | 96.8 % | 95.5 % | 0 / 574 / 26 | — (0) |
| 100 | 0.286 | 0.322 | 0.968 | 94.5 % | 94.7 % | 241 / 349 / 10 | 93.4 % (241) |
| 300 | 0.175 | 0.207 | 0.986 | 95.2 % | 96.7 % | 545 / 55 / 0 | 95.2 % (545) |

Método: máxima verosimilitud marginal (EM con cuadratura). Errores típicos por producto cruzado de gradientes por estudiante. Una cobertura cercana al 95 % indica intervalos honestos. (La primera versión, de verosimilitud conjunta, se descartó: su error crecía con la muestra y su cobertura caía al 20 %.)
