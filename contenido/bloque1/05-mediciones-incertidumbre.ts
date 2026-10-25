import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'mediciones-incertidumbre',
  title: 'Mediciones e incertidumbre',
  summary:
    'Por qué ninguna medición es perfecta: precisión y exactitud, resolución de los instrumentos, incertidumbre absoluta y relativa, promedio de mediciones repetidas y cifras significativas.',
  concepts: [
    { slug: 'med-precision-exactitud', name: 'Precisión y exactitud' },
    { slug: 'med-incertidumbre', name: 'Incertidumbre absoluta y relativa' },
    { slug: 'med-promedio-dispersion', name: 'Promedio y semidispersión de mediciones repetidas' },
    { slug: 'med-cifras-significativas', name: 'Cifras significativas en las operaciones' },
  ],
  theory: String.raw`## Ninguna medición es perfecta

Si cinco compañeros miden con un cronómetro el tiempo que tarda una pelota en caer desde un balcón, obtendrán cinco valores ligeramente distintos. Ninguno «se equivocó»: toda medición tiene una **incertidumbre**, un margen dentro del cual creemos que está el valor de la magnitud. Por eso un resultado experimental completo tiene **tres** partes: el valor, la incertidumbre y la unidad:

$$t = (1.51 \pm 0.04)\,\mathrm{s}.$$

Esto se lee: «el mejor valor es $1.51\,\mathrm{s}$, y es razonable que el valor de la magnitud esté entre $1.47\,\mathrm{s}$ y $1.55\,\mathrm{s}$».

## Precisión y exactitud

Son dos ideas distintas que en el habla cotidiana se confunden:

- **Exactitud**: cuánto se acercan las mediciones al **valor verdadero** (o al valor de referencia aceptado).
- **Precisión**: cuánto se parecen las mediciones **entre sí** cuando se repiten.

Piense en los dardos de una diana. Dardos muy juntos pero lejos del centro: precisos, poco exactos. Dardos repartidos alrededor del centro: exactos en promedio, pero poco precisos. Lo ideal es que estén juntos y en el centro.

La falta de exactitud suele deberse a **errores sistemáticos**, que desplazan todas las medidas en el mismo sentido: una balanza que marca $0.3\,\mathrm{g}$ sin nada encima, un cronómetro que se pone en marcha siempre tarde, una regla con el extremo gastado. Repetir la medición **no** los elimina; hay que calibrar el instrumento o corregir el método. La falta de precisión se debe a **errores aleatorios** (tiempo de reacción, pequeñas variaciones del montaje), que hacen que las medidas fluctúen hacia arriba y hacia abajo. Estos sí se reducen al promediar muchas mediciones.

## La resolución del instrumento

La **resolución** es la menor variación que un instrumento puede mostrar. Fija la incertidumbre mínima de una lectura única. En este curso usaremos la convención habitual:

- **Instrumento analógico** (regla, probeta, termómetro de líquido): la incertidumbre de lectura es la **mitad de la división más pequeña**. Con una regla milimetrada, $\pm0.5\,\mathrm{mm} = \pm0.05\,\mathrm{cm}$.
- **Instrumento digital** (balanza electrónica, cronómetro, multímetro): la incertidumbre de lectura es **una unidad del último dígito**. Si la balanza muestra $25.3\,\mathrm{g}$, la incertidumbre de lectura es $\pm0.1\,\mathrm{g}$.

> **Cuidado.** Que un cronómetro muestre centésimas de segundo no significa que el tiempo se conozca con esa precisión: el tiempo de reacción humano es de un par de décimas de segundo. Por eso conviene repetir las mediciones.

## Mediciones repetidas: promedio y semidispersión

Si se mide $N$ veces la misma magnitud y se obtienen $x_1, x_2, \ldots, x_N$, el **mejor valor** es el **promedio**:

$$\overline{x} = \frac{x_1 + x_2 + \cdots + x_N}{N}.$$

Como estimación sencilla de la incertidumbre usaremos la **semidispersión**, la mitad del intervalo entre el valor máximo y el mínimo:

$$\Delta x = \frac{x_{max} - x_{min}}{2}.$$

Si la semidispersión resulta **menor que la resolución** del instrumento (por ejemplo, si todas las medidas coinciden), se toma como incertidumbre la resolución. En resumen: **la incertidumbre es la mayor de las dos**. En cursos de laboratorio más avanzados se usa la desviación estándar, que aprovecha mejor la información de todas las medidas; la semidispersión es una aproximación prudente y fácil de calcular.

## Cómo se escribe el resultado

1. Redondee la incertidumbre a **una cifra significativa**: $0.035\,\mathrm{s} \to 0.04\,\mathrm{s}$.
2. Redondee el valor a la **misma posición decimal** que la incertidumbre: $1.508\,\mathrm{s} \to 1.51\,\mathrm{s}$.
3. Escriba valor, incertidumbre y unidad: $t = (1.51 \pm 0.04)\,\mathrm{s}$.

Escribir $t = (1.508 \pm 0.04)\,\mathrm{s}$ no tiene sentido: si dudamos en las centésimas, la milésima es pura ficción.

## Incertidumbre absoluta y relativa

$\Delta x$ es la **incertidumbre absoluta**; tiene las unidades de la magnitud. La **incertidumbre relativa** compara la incertidumbre con el valor:

$$\varepsilon = \frac{\Delta x}{\overline{x}} \qquad (\times 100\,\% \text{ para expresarla en porcentaje}).$$

Es adimensional y permite comparar la calidad de mediciones distintas. Un error de $1\,\mathrm{cm}$ es enorme si se mide un lápiz ($1\,\mathrm{cm}$ en $15\,\mathrm{cm}$ es un $7\,\%$) y despreciable si se mide una cancha de béisbol ($1\,\mathrm{cm}$ en $100\,\mathrm{m}$ es un $0.01\,\%$).

## Cifras significativas

Las **cifras significativas** de un número son las que se conocen con fiabilidad más la primera dudosa. Reglas para contarlas:

- Las cifras distintas de cero siempre cuentan: $4.52$ tiene 3.
- Los ceros entre cifras no nulas cuentan: $305$ tiene 3.
- Los ceros a la izquierda **no** cuentan; solo sitúan el punto decimal: $0.0045$ tiene 2.
- Los ceros a la derecha **después** del punto decimal sí cuentan: $2.50$ tiene 3. Indican que se midió esa cifra.
- Los ceros finales de un entero son ambiguos ($1500$): use notación científica, $1.5\times10^{3}$ (2 cifras) o $1.50\times10^{3}$ (3 cifras).

**Al operar**, el resultado no puede ser más fiable que los datos:

- **Productos y cocientes**: el resultado lleva tantas cifras significativas como el dato que **menos** tenga. $12.5\,\mathrm{cm}\times3.2\,\mathrm{cm} = 40.0\,\mathrm{cm^2} \to 40\,\mathrm{cm^2}$ (dos cifras, mejor escrito $4.0\times10^{1}\,\mathrm{cm^2}$).
- **Sumas y restas**: lo que cuenta es la **posición decimal**. El resultado se redondea a la última posición decimal del dato **menos preciso**. $12.1\,\mathrm{m} + 0.235\,\mathrm{m} = 12.335\,\mathrm{m} \to 12.3\,\mathrm{m}$.
- Los **números exactos** (cantidades contadas, como «5 mediciones», o factores definidos, como el 2 de un perímetro o $1\,\mathrm{m} = 100\,\mathrm{cm}$) no limitan las cifras del resultado.
- Redondee **solo al final**; en los pasos intermedios conserve una o dos cifras más.

Las reglas de cifras significativas son una forma rápida de no aparentar más precisión de la que se tiene. Cuando se conoce la incertidumbre, es ella la que manda al redondear.`,
  formulas: [
    {
      name: 'Promedio',
      latex: String.raw`\overline{x} = \frac{x_1 + x_2 + \cdots + x_N}{N}`,
      description: 'Mejor estimación del valor de una magnitud medida N veces en las mismas condiciones.',
      variables: [
        { symbol: String.raw`\overline{x}`, meaning: 'Valor promedio', unit: 'la de la magnitud' },
        { symbol: String.raw`x_i`, meaning: 'Cada una de las mediciones', unit: 'la de la magnitud' },
        { symbol: String.raw`N`, meaning: 'Número de mediciones (exacto)', unit: '— (adimensional)' },
      ],
    },
    {
      name: 'Semidispersión',
      latex: String.raw`\Delta x = \frac{x_{max} - x_{min}}{2}`,
      description: 'Estimación sencilla de la incertidumbre de mediciones repetidas. Si resulta menor que la resolución del instrumento, se usa la resolución.',
      variables: [
        { symbol: String.raw`\Delta x`, meaning: 'Incertidumbre absoluta', unit: 'la de la magnitud' },
        { symbol: String.raw`x_{max},\,x_{min}`, meaning: 'Mayor y menor de las mediciones', unit: 'la de la magnitud' },
      ],
    },
    {
      name: 'Expresión del resultado',
      latex: String.raw`x = (\overline{x} \pm \Delta x)\,\text{unidad}`,
      description: 'La incertidumbre se redondea a una cifra significativa y el valor a la misma posición decimal.',
      variables: [
        { symbol: String.raw`\overline{x}`, meaning: 'Mejor valor', unit: 'la de la magnitud' },
        { symbol: String.raw`\Delta x`, meaning: 'Incertidumbre absoluta', unit: 'la de la magnitud' },
      ],
    },
    {
      name: 'Incertidumbre relativa',
      latex: String.raw`\varepsilon = \frac{\Delta x}{\overline{x}}\quad\left(\varepsilon_{\%} = \frac{\Delta x}{\overline{x}}\times100\,\%\right)`,
      description: 'Compara la incertidumbre con el valor medido; permite comparar la calidad de mediciones de magnitudes o tamaños distintos.',
      variables: [
        { symbol: String.raw`\varepsilon`, meaning: 'Incertidumbre relativa', unit: '— (adimensional) o %' },
      ],
    },
  ],
  examples: [
    {
      title: 'Lectura con una regla milimetrada',
      statement: String.raw`Con una regla graduada en milímetros se mide el largo de un cuaderno y se lee $23.4\,\mathrm{cm}$. Exprese el resultado con su incertidumbre y calcule la incertidumbre relativa.`,
      steps: [
        String.raw`La división más pequeña es $1\,\mathrm{mm} = 0.1\,\mathrm{cm}$. Como la regla es analógica, la incertidumbre de lectura es la mitad: $\Delta L = 0.05\,\mathrm{cm}$.`,
        String.raw`El valor se escribe con la misma posición decimal que la incertidumbre: $L = (23.40 \pm 0.05)\,\mathrm{cm}$.`,
        String.raw`Incertidumbre relativa: $\varepsilon = \dfrac{0.05\,\mathrm{cm}}{23.40\,\mathrm{cm}} = 0.0021 = 0.21\,\%$.`,
      ],
      result: String.raw`$L = (23.40 \pm 0.05)\,\mathrm{cm}$, con una incertidumbre relativa del $0.2\,\%$.`,
      interpretation: 'Una incertidumbre relativa de dos milésimas es muy pequeña: la regla es adecuada para esta medición. Con la misma regla, medir el grosor de una moneda (unos 2 mm) daría una incertidumbre relativa del 25 %.',
    },
    {
      title: 'Tiempo de caída medido cinco veces',
      statement: String.raw`Se mide cinco veces el tiempo que tarda una pelota en caer desde un balcón con un cronómetro que muestra centésimas: $1.52$, $1.48$, $1.55$, $1.50$ y $1.49\,\mathrm{s}$. Exprese el resultado.`,
      steps: [
        String.raw`Promedio: $\overline{t} = \dfrac{1.52 + 1.48 + 1.55 + 1.50 + 1.49}{5}\,\mathrm{s} = \dfrac{7.54}{5}\,\mathrm{s} = 1.508\,\mathrm{s}$.`,
        String.raw`Semidispersión: $\Delta t = \dfrac{1.55 - 1.48}{2}\,\mathrm{s} = 0.035\,\mathrm{s}$. Es mayor que la resolución ($0.01\,\mathrm{s}$), así que es la incertidumbre que tomamos.`,
        String.raw`Redondeo: $\Delta t \approx 0.04\,\mathrm{s}$ (una cifra), y el valor a las centésimas: $\overline{t} \approx 1.51\,\mathrm{s}$.`,
        String.raw`Incertidumbre relativa: $\varepsilon = 0.04/1.51 \approx 0.026 = 2.6\,\%$.`,
      ],
      result: String.raw`$t = (1.51 \pm 0.04)\,\mathrm{s}$, con una incertidumbre relativa de aproximadamente el $3\,\%$.`,
      interpretation: 'La incertidumbre la domina el tiempo de reacción, no la resolución del cronómetro: la dispersión (unas centésimas) es varias veces mayor que la última cifra que muestra la pantalla.',
    },
    {
      title: 'Área y perímetro de una hoja',
      statement: String.raw`Una hoja tamaño carta mide $27.9\,\mathrm{cm}$ por $21.6\,\mathrm{cm}$. Calcule su área y su perímetro con el número correcto de cifras significativas.`,
      steps: [
        String.raw`Área (producto): $A = 27.9\,\mathrm{cm}\times21.6\,\mathrm{cm} = 602.64\,\mathrm{cm^2}$. Ambos datos tienen 3 cifras significativas, así que el resultado lleva 3: $A = 603\,\mathrm{cm^2}$.`,
        String.raw`Perímetro (suma): $P = 2\,(27.9 + 21.6)\,\mathrm{cm} = 2\times49.5\,\mathrm{cm} = 99.0\,\mathrm{cm}$. La suma se redondea a las décimas, como los datos; el 2 es exacto y no limita.`,
      ],
      result: String.raw`$A = 603\,\mathrm{cm^2} = 6.03\times10^{2}\,\mathrm{cm^2}$ y $P = 99.0\,\mathrm{cm}$.`,
      interpretation: 'El perímetro tiene 3 cifras significativas por la regla de las décimas, no por contar cifras. Si la suma hubiera dado más de 100 cm, tendría 4 cifras significativas: en las sumas importa la posición decimal.',
    },
  ],
  simulation: null,
  exercises: [
    {
      id: 'b1-med-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['med-promedio-dispersion'],
      prompt: String.raw`Un grupo mide cinco veces el período de un péndulo y obtiene: $2.31$, $2.35$, $2.28$, $2.33$ y $2.33\,\mathrm{s}$. ¿Cuál es el valor promedio del período?`,
      format: 'numeric',
      unitHint: 's',
    },
    {
      id: 'b1-med-02',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['med-precision-exactitud'],
      prompt: String.raw`El valor de referencia de la aceleración de la gravedad en un laboratorio es $9.78\,\mathrm{m/s^2}$. Un grupo obtiene cuatro mediciones: $9.52$, $9.55$, $9.53$ y $9.54\,\mathrm{m/s^2}$. ¿Cómo se describen esas mediciones?`,
      format: 'choice',
      options: ['Precisas y exactas', 'Precisas pero poco exactas', 'Exactas pero poco precisas', 'Ni precisas ni exactas'],
    },
    {
      id: 'b1-med-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['med-cifras-significativas'],
      prompt: String.raw`**Verdadero o falso:** el número $0.00340$ tiene seis cifras significativas. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b1-med-04',
      category: 'error',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['med-promedio-dispersion', 'med-incertidumbre'],
      prompt: String.raw`Con un cronómetro que aprecia décimas de segundo, un estudiante mide cuatro veces el tiempo que tarda un carrito en bajar por una rampa: $4.2$, $4.5$, $4.4$ y $4.1\,\mathrm{s}$. Procede así:

1. Promedio: $\overline{t} = \dfrac{4.2 + 4.5 + 4.4 + 4.1}{4}\,\mathrm{s} = 4.3\,\mathrm{s}$.
2. Incertidumbre por semidispersión: $\Delta t = t_{max} - t_{min} = 4.5\,\mathrm{s} - 4.1\,\mathrm{s} = 0.4\,\mathrm{s}$.
3. Como $\Delta t$ es mayor que la resolución del cronómetro ($0.1\,\mathrm{s}$), toma $\Delta t$ como incertidumbre.
4. Resultado: $t = (4.3 \pm 0.4)\,\mathrm{s}$.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'No hay ningún error'],
    },
    {
      id: 'b1-med-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['med-cifras-significativas'],
      prompt: String.raw`Un cilindro de un material desconocido tiene una masa de $25.3\,\mathrm{g}$, medida con una balanza digital. Con un calibrador se mide su diámetro, $1.50\,\mathrm{cm}$, y su altura, $4.12\,\mathrm{cm}$. Calcule su densidad en $\mathrm{g/cm^3}$ y exprésela con el número correcto de cifras significativas.`,
      format: 'numeric',
      unitHint: 'g/cm³',
    },
    {
      id: 'b1-med-06',
      category: 'grafica',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['med-promedio-dispersion'],
      prompt: 'La gráfica muestra cinco mediciones del largo de un libro, hechas por cinco estudiantes con la misma regla graduada en milímetros. ¿Cuál es la semidispersión de las mediciones?',
      format: 'numeric',
      unitHint: 'cm',
      figure: {
        kind: 'scatter',
        title: 'Mediciones repetidas del largo de un libro',
        x: { label: 'Medición n.º' },
        y: { label: 'L', unit: 'cm' },
        series: [
          {
            name: 'L',
            points: [
              [1, 20.4],
              [2, 20.8],
              [3, 20.6],
              [4, 20.2],
              [5, 20.5],
            ],
          },
        ],
      },
    },
    {
      id: 'b1-med-07',
      category: 'numerica',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['med-cifras-significativas'],
      prompt: String.raw`Tres tramos de un mismo cable miden $1.25\,\mathrm{m}$, $0.0342\,\mathrm{m}$ y $12.1\,\mathrm{m}$, medidos con instrumentos distintos. ¿Cuál es la longitud total, escrita con el número correcto de cifras significativas?`,
      format: 'numeric',
      unitHint: 'm',
    },
    {
      id: 'b1-med-08',
      category: 'desarrollo',
      difficulty: 'intermedio',
      role: 'bank',
      concepts: ['med-promedio-dispersion', 'med-incertidumbre', 'med-precision-exactitud'],
      prompt: String.raw`Para medir el período de un péndulo, una estudiante cronometra **10 oscilaciones completas** cinco veces, con un cronómetro digital que muestra centésimas de segundo. Obtiene: $12.4$, $12.7$, $12.5$, $12.9$ y $12.6\,\mathrm{s}$.
(a) Calcule el promedio y la semidispersión del tiempo de 10 oscilaciones, y escriba el resultado con su incertidumbre.
(b) Obtenga el período de **una** oscilación con su incertidumbre.
(c) Calcule la incertidumbre relativa del período.
(d) ¿Por qué la incertidumbre es mucho mayor que la resolución del cronómetro? ¿Qué ventaja tiene cronometrar 10 oscilaciones en lugar de una?
(e) Si la estudiante pusiera en marcha el cronómetro siempre con retraso, ¿afectaría a la precisión o a la exactitud? Explique.`,
      format: 'open',
    },
  ],
};
