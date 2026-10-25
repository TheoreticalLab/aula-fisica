# Guía de redacción del contenido inicial

Esta guía describe cómo están escritas las lecciones de `contenido/` y sus claves de `privado/claves/`. La siguen los autores del contenido inicial. El profesor que edite desde el panel no necesita leerla, porque la interfaz aplica las mismas reglas.

## Archivos

- Lección pública: `contenido/bloqueN/NN-slug.ts`. Exporta `export const leccion: LessonDef` (tipos en `contenido/tipos.ts`).
- Claves privadas: `privado/claves/bloqueN/NN-slug.ts`. Exporta `export const claves: KeyMap`, con **exactamente** los mismos ids de ejercicio que la lección.
- Modelo de referencia: `contenido/bloque2/04-mru.ts` y `privado/claves/bloque2/04-mru.ts`. Use el mismo nivel de detalle y rigor.
- Nunca ponga respuestas, pistas ni explicaciones en el archivo público. El enunciado no debe delatar la respuesta.

## Público y nivel

- Estudiantes universitarios de primer curso. Se usa álgebra, trigonometría elemental y gráficas. **No se usa cálculo**: ni derivadas, ni integrales, ni límites. Los conceptos (velocidad instantánea, área bajo la curva…) se explican con pendientes de rectas, tablas y áreas de figuras simples.
- Sencillo no significa impreciso. Distinga distancia de desplazamiento, rapidez de velocidad, masa de peso, etc. Respete los signos y el carácter vectorial.
- Español neutro con tildes correctas. Use ejemplos cotidianos (también del Caribe: guaguas, motoconchos, béisbol, playas, el Metro de Santo Domingo…), sin abusar.

## Formato

- Markdown con encabezados `##` dentro de `theory`. Use listas y citas `>` para avisos («**Cuidado.**», «**Error frecuente.**»).
- Matemáticas con KaTeX: `$...$` en línea y `$$...$$` en bloque. Use solo comandos soportados por KaTeX: `\frac`, `\dfrac`, `\tfrac`, `\sqrt`, `\vec`, `\Delta`, `\theta`, `\mu`, `\cdot`, `\times`, `\approx`, `\le`, `\ge`, `\sin`, `\cos`, `\tan`, `\mathrm{}`, `\text{}`, `\,`, `\quad`, `\Rightarrow`, `\circ`, `\pm`, `\overline{}`, `\left( \right)`. No use `\SI`, `\unit`, `\si` ni paquetes de LaTeX.
- Unidades dentro de fórmulas: `12\,\mathrm{m/s}`, `9.8\,\mathrm{m/s^2}`, `30^\circ`.
- Todas las cadenas con LaTeX deben ir en `String.raw\`...\``. Dentro de ellas **no** use el carácter de acento grave (backtick) ni la secuencia `${`.
- Punto decimal: `3.5`, nunca `3,5`.
- g = 9.8 m/s², salvo que el enunciado diga otra cosa.

## Estructura de cada lección

1. `theory`: 700–1300 palabras. Idea física, ejemplos cotidianos, interpretación de la ecuación, errores frecuentes y límites del modelo.
2. `formulas`: de 2 a 5. Cada una con su significado y una tabla de variables (`symbol` en LaTeX, `meaning`, `unit`).
3. `examples`: de 2 a 3 ejemplos resueltos paso a paso: planteamiento, conversión de unidades, sustitución con unidades, resultado y, al final, interpretación física o comprobación de que el resultado es razonable.
4. `simulation`: la indicada en el encargo, o `null`. La `guide` propone de 4 a 6 pasos concretos de exploración.
5. `exercises`: **8 por lección**, con ids `bN-<abreviatura>-01` … `-08`, únicos en todo el curso:
   - 5 con `role: 'practice'`: tres `basico`, un `intermedio` y un `desafiante`.
   - 2 con `role: 'reinforcement'` (`basico` o `intermedio`): variantes de los de práctica sobre los mismos conceptos, para reforzar a quien falló.
   - 1 con `role: 'bank'`, `category: 'desarrollo'`, `format: 'open'`: problema de desarrollo para revisión manual.
   - Mezcle categorías: en cada lección, al menos 4 categorías distintas. En el bloque deben aparecer todas: `seleccion`, `vf_justificacion`, `numerica`, `grafica` (con `figure`), `conceptual`, `error` (solución con pasos numerados; la respuesta es el paso con el primer error), `desarrollo` y `experimento` (con `simulation`, en las lecciones que tienen simulador).
   - `concepts`: slugs definidos en `concepts` de alguna lección. Al crear conceptos nuevos, use como prefijo el slug de la lección (p. ej. `mrua-ecuacion-velocidad`).

## Formatos de respuesta y claves

| format | Entrada del estudiante | Clave |
|---|---|---|
| `choice` | elige opción(es) | `correct: [índices desde 0]`; `optionFeedback` explica por qué cada opción incorrecta es errónea (recomendado) |
| `truefalse` | V/F y justificación escrita | `value`, `modelJustification` |
| `numeric` | número con unidad | `value: '20 m/s'` (ver sintaxis abajo); opcionales `relTol` (por defecto 0.02), `absTol` (en SI), `sigFigs`, `strictSigFigs`, `alternatives`, `commonErrors` y `expectUnit` (exige esa unidad exacta: útil en conversiones, donde cualquier unidad equivalente sería aceptada) |
| `text` | palabra o frase corta | `accepted: ['inercia', ...]` (se compara sin mayúsculas, tildes ni puntuación) |
| `open` | texto libre | `rubric` con puntos por criterio |

Cada clave lleva `hints` (2–3 pistas progresivas, de la más general a la más concreta, sin dar el resultado) y `explanation` (solución completa con LaTeX).

`commonErrors` son valores erróneos típicos (con unidad) con un mensaje que diagnostica el error: conversión olvidada, signo cambiado, uso de la masa en lugar del peso, etc. Inclúyalos en casi todas las preguntas numéricas: son la principal forma de «explicar los errores».

### Sintaxis de valores numéricos (la entiende el motor de calificación)

- Número: `25`, `-4.9`, `3.0e8`, `1.5×10^3` o `6.02e23`.
- Unidad tras un espacio. Multiplicación con `·` o `*`; división con `/`. **Todo lo que va después de la primera `/` está en el denominador**: `J/kg·K` = J/(kg·K). Se admiten paréntesis. Exponentes con `^2`, `²` o `³`.
- Unidades reconocidas: m, g, s, min, h, N, J, W, Pa, Hz, L, K, °C, °F, mol, rad, ° (grados), rev, rpm, %, ft, in, mi, mph, lb, atm, cal, mmHg y u (unidad genérica de los vectores del simulador). Se admiten prefijos (k, c, m, µ, n, M, G…): km, cm, mm, kg, ms, kN, kJ, kPa…
- Ejemplos: `9.8 m/s^2`, `72 km/h`, `2.5 kg·m/s`, `1.2e3 kg/m^3`, `35 °`, `0.25` (adimensional).
- Si la respuesta es adimensional (un coeficiente de fricción, un cociente), escriba solo el número.
- Para ángulos, use `°`, p. ej. `36.9 °`.
- La tolerancia por defecto es del 2 %. Si el resultado puede ser 0, añada `absTol`.
- Si el sentido importa, el signo forma parte de la respuesta. Si el enunciado pide una magnitud (módulo), dé el valor positivo y explique la convención en el enunciado.

## Experimentos

Una pregunta de categoría `experimento` lleva `simulation: { key, params }` con parámetros válidos del catálogo `src/sims/catalogo.ts`. El estudiante puede ejecutar la simulación. Pida algo que se pueda medir o leer en ella (lista de lecturas en el encargo) y que se pueda calcular con el modelo del simulador. Pida, por ejemplo, que fije los parámetros indicados, lea un resultado y lo compare o use en un cálculo. La clave debe coincidir con lo que muestra el simulador.

Lecturas que muestra cada simulador:

- `vectores`: Ax, Ay, Bx, By, Rx, Ry, |R| y ángulo de R (A + B); también |A − B| y su ángulo.
- `movimiento-rectilineo`: t, x, v y a en vivo; gráficas x–t, v–t y a–t; tabla de datos cada 1 s.
- `caida-libre`: t, y y v en vivo; altura máxima, tiempo hasta la altura máxima, tiempo hasta el suelo y velocidad de impacto; gráficas y–t y v–t; tabla cada 0.5 s.
- `proyectiles`: alcance horizontal, altura máxima, tiempo de vuelo, velocidad de impacto (módulo y ángulo); x, y, vx y vy en vivo; trayectoria y–x y gráficas vx–t y vy–t.
- `circular`: v, ω, f y a_c; ángulo, x e y en vivo; gráficas x–t e y–t.
- `fuerzas`: peso, componentes del peso, normal, fricción (estática o cinética y su valor), fuerza neta y aceleración; t, x y v en vivo (hasta 10 s); gráficas x–t y v–t. Parte del reposo. Si |F − mg sinθ| ≤ μs·N, el bloque no se mueve. Si no, a = (F − mg sinθ − μk·N·signo(movimiento))/m.

## Comprobación

- Verifique **cada** resultado numérico con Python (`python3 -c "..."`), incluidos los `commonErrors`.
- Revise que las opciones correctas, los índices y las justificaciones coincidan.
- Compruebe que ningún enunciado contenga la respuesta.
