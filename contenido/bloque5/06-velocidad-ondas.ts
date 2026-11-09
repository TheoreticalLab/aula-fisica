import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'velocidad-ondas',
  title: 'Longitud de onda, frecuencia y velocidad de propagación',
  summary:
    'En una onda periódica, la onda avanza una longitud de onda en cada período: v = λf. La rapidez la fija el medio; en una cuerda, v = √(T/μ).',
  concepts: [
    { slug: 'velocidad-ondas-longitud-onda', name: 'Longitud de onda, período y frecuencia de una onda' },
    { slug: 'velocidad-ondas-relacion-fundamental', name: 'Relación fundamental v = λf' },
    { slug: 'velocidad-ondas-cuerda', name: 'Rapidez de una onda en una cuerda tensa' },
  ],
  theory: String.raw`## Ondas periódicas

Si el extremo de una cuerda larga se mueve arriba y abajo con un MAS, se genera una **onda periódica**: una sucesión regular de **crestas** (puntos más altos) y **valles** (puntos más bajos) que avanza por la cuerda. Una onda periódica tiene dos «caras»:

- **En el tiempo.** Si observamos **un punto fijo** de la cuerda, lo vemos oscilar. El tiempo que tarda en completar una oscilación es el **período** $T$ de la onda, y el número de oscilaciones por segundo es la **frecuencia** $f = 1/T$. Ambos los impone la **fuente**: cada punto de la cuerda oscila al mismo ritmo que la mano.
- **En el espacio.** Si tomamos **una foto** de la cuerda en un instante, vemos un patrón que se repite a lo largo de la cuerda. La distancia entre dos crestas consecutivas (o entre dos valles, o en general entre dos puntos que están en el mismo estado de oscilación) es la **longitud de onda** $\lambda$ (letra griega lambda), en metros.

La **amplitud** $A$ es, como en las oscilaciones, el desplazamiento máximo de un punto del medio desde su posición de equilibrio: la altura de una cresta medida desde la línea central, no la distancia entre una cresta y un valle.

> **Cuidado.** La distancia entre una cresta y el valle siguiente es $\lambda/2$, no $\lambda$. Y en una gráfica $y$–$x$ (foto) la separación horizontal entre crestas es $\lambda$; en una gráfica $y$–$t$ (un punto que oscila) es $T$. Fíjese siempre en qué hay en el eje horizontal.

## La relación fundamental

En el tiempo de un período, la fuente completa una oscilación y produce exactamente una «cresta + valle» nueva; mientras tanto, la cresta anterior ha avanzado justo una longitud de onda. Por tanto la onda avanza $\lambda$ en un tiempo $T$, y su rapidez es

$$v = \frac{\lambda}{T} = \lambda f .$$

Esta relación vale para **todas** las ondas periódicas: en cuerdas, en el agua, el sonido y también la luz.

## ¿Qué determina cada magnitud?

Esta es la parte conceptual más importante, y la que más se confunde:

1. **La rapidez $v$ la determina el medio**: su elasticidad (cuánto «tira» o «empuja» una parte sobre la vecina) y su inercia (cuánta masa hay que mover). No depende de la frecuencia ni de la amplitud.
2. **La frecuencia $f$ la determina la fuente.** Cada punto oscila al ritmo que le impone el anterior, y así hasta la fuente.
3. **La longitud de onda se ajusta**: $\lambda = v/f$.

Por eso, si con la misma cuerda y la misma tensión se mueve la mano el doble de rápido, la onda **no** viaja más rápido: las crestas salen más seguidas y quedan más juntas ($\lambda$ se reduce a la mitad).

Y cuando una onda pasa de un medio a otro (por ejemplo, de una cuerda delgada a una gruesa unida a ella), **la frecuencia no cambia**, porque el punto de unión oscila a un solo ritmo; lo que cambian son $v$ y, con ella, $\lambda$.

## Rapidez de una onda en una cuerda

Para una cuerda tensa, la rapidez de las ondas transversales es

$$v = \sqrt{\frac{F_T}{\mu}} ,$$

donde $F_T$ es la **tensión** de la cuerda (en newtons; usamos $F_T$ para no confundirla con el período $T$) y $\mu$ es la **densidad lineal de masa**, la masa por unidad de longitud:

$$\mu = \frac{m}{L} \quad (\mathrm{kg/m}).$$

La fórmula tiene la estructura típica: elasticidad (tensión) en el numerador e inercia (masa por metro) en el denominador.

- Cuerda **más tensa** → ondas más rápidas. Así se afina una guitarra: al tensar la clavija, la onda viaja más rápido y la nota sube.
- Cuerda **más pesada** (más gruesa) → ondas más lentas. Las cuerdas graves de la guitarra o del bajo son más gruesas o están entorchadas con alambre.

Por la raíz cuadrada, para duplicar la rapidez hay que cuadruplicar la tensión.

## Otros ejemplos

- **Olas del mar.** En una playa de Punta Cana las crestas pueden llegar separadas unos 10 m y con un período de 5 s: avanzan a unos 2 m/s.
- **Sonido.** En el aire a 20 °C, $v = 343\,\mathrm{m/s}$. La nota *la* de un diapasón ($440\,\mathrm{Hz}$) tiene $\lambda = 343/440 = 0.78\,\mathrm{m}$.

## Errores frecuentes

- Pensar que aumentar la frecuencia aumenta la rapidez de la onda.
- Escribir $v = \lambda\,T$ en vez de $v = \lambda/T$.
- Usar la masa total de la cuerda en lugar de $\mu = m/L$, o dejar la masa en gramos.
- Confundir la tensión $F_T$ con el período $T$.

## Límites del modelo

La fórmula $v = \sqrt{F_T/\mu}$ supone una cuerda perfectamente flexible, uniforme y con amplitudes pequeñas. Para cuerdas muy rígidas (como los alambres gruesos de un piano) la rapidez depende un poco de la frecuencia. La relación $v = \lambda f$, en cambio, es completamente general.`,
  formulas: [
    {
      name: 'Relación fundamental de las ondas',
      latex: String.raw`v = \lambda f = \frac{\lambda}{T}`,
      description: 'La onda avanza una longitud de onda en cada período.',
      variables: [
        { symbol: String.raw`v`, meaning: 'Rapidez de propagación', unit: 'm/s' },
        { symbol: String.raw`\lambda`, meaning: 'Longitud de onda', unit: 'm' },
        { symbol: String.raw`f`, meaning: 'Frecuencia (la impone la fuente)', unit: 'Hz' },
        { symbol: String.raw`T`, meaning: 'Período', unit: 's' },
      ],
    },
    {
      name: 'Rapidez de una onda en una cuerda',
      latex: String.raw`v = \sqrt{\frac{F_T}{\mu}}`,
      description: 'Depende solo de la tensión y de la masa por unidad de longitud de la cuerda.',
      variables: [
        { symbol: String.raw`F_T`, meaning: 'Tensión de la cuerda', unit: 'N' },
        { symbol: String.raw`\mu`, meaning: 'Densidad lineal de masa', unit: 'kg/m' },
      ],
    },
    {
      name: 'Densidad lineal de masa',
      latex: String.raw`\mu = \frac{m}{L}`,
      description: 'Masa de la cuerda por cada metro de longitud.',
      variables: [
        { symbol: String.raw`m`, meaning: 'Masa de la cuerda', unit: 'kg' },
        { symbol: String.raw`L`, meaning: 'Longitud de la cuerda', unit: 'm' },
      ],
    },
  ],
  examples: [
    {
      title: 'Olas en la playa',
      statement: String.raw`Desde un muelle se observa que las crestas de las olas están separadas $8.0\,\mathrm{m}$ y que pasa una cresta por el pilote cada $4.0\,\mathrm{s}$. ¿Con qué rapidez avanzan las olas?`,
      steps: [
        String.raw`La separación entre crestas es la longitud de onda: $\lambda = 8.0\,\mathrm{m}$. El tiempo entre crestas sucesivas en un punto fijo es el período: $T = 4.0\,\mathrm{s}$.`,
        String.raw`$v = \dfrac{\lambda}{T} = \dfrac{8.0\,\mathrm{m}}{4.0\,\mathrm{s}} = 2.0\,\mathrm{m/s}$.`,
      ],
      result: String.raw`$v = 2.0\,\mathrm{m/s}$.`,
      interpretation: 'Unos 7 km/h, el paso de una persona que camina rápido. La frecuencia es f = 0.25 Hz.',
    },
    {
      title: 'Cuerda de guitarra',
      statement: String.raw`Una cuerda de guitarra tiene $0.65\,\mathrm{m}$ de longitud y una masa de $5.0\,\mathrm{g}$, y está tensada con $80\,\mathrm{N}$. ¿Con qué rapidez viajan las ondas por ella?`,
      steps: [
        String.raw`Densidad lineal: $\mu = \dfrac{m}{L} = \dfrac{5.0\times10^{-3}\,\mathrm{kg}}{0.65\,\mathrm{m}} = 7.69\times10^{-3}\,\mathrm{kg/m}$.`,
        String.raw`$v = \sqrt{\dfrac{F_T}{\mu}} = \sqrt{\dfrac{80\,\mathrm{N}}{7.69\times10^{-3}\,\mathrm{kg/m}}} = \sqrt{1.04\times10^{4}\,\mathrm{m^2/s^2}} = 102\,\mathrm{m/s}$.`,
      ],
      result: String.raw`$v \approx 1.0\times10^{2}\,\mathrm{m/s}$.`,
      interpretation: 'Comprobación de unidades: N/(kg/m) = (kg·m/s²)·(m/kg) = m²/s², cuya raíz es m/s ✓.',
    },
    {
      title: 'Cambio de medio',
      statement: String.raw`Una onda de $50\,\mathrm{Hz}$ viaja por una cuerda delgada a $40\,\mathrm{m/s}$ y pasa a una cuerda más gruesa, unida a la primera, donde viaja a $20\,\mathrm{m/s}$. Calcule la longitud de onda en cada cuerda.`,
      steps: [
        String.raw`La frecuencia no cambia al pasar de una cuerda a otra: $f = 50\,\mathrm{Hz}$ en ambas.`,
        String.raw`Cuerda delgada: $\lambda_1 = \dfrac{v_1}{f} = \dfrac{40\,\mathrm{m/s}}{50\,\mathrm{Hz}} = 0.80\,\mathrm{m}$.`,
        String.raw`Cuerda gruesa: $\lambda_2 = \dfrac{20\,\mathrm{m/s}}{50\,\mathrm{Hz}} = 0.40\,\mathrm{m}$.`,
      ],
      result: String.raw`$\lambda_1 = 0.80\,\mathrm{m}$ y $\lambda_2 = 0.40\,\mathrm{m}$.`,
      interpretation: 'En el medio más lento las crestas se «amontonan»: la longitud de onda se reduce en la misma proporción que la rapidez.',
    },
  ],
  simulation: null,
  exercises: [
    {
      id: 'b5-vel-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['velocidad-ondas-relacion-fundamental'],
      prompt: String.raw`Una onda en una cuerda tiene una longitud de onda de $0.50\,\mathrm{m}$ y una frecuencia de $12\,\mathrm{Hz}$. ¿Con qué rapidez se propaga?`,
      format: 'numeric',
      unitHint: 'm/s',
    },
    {
      id: 'b5-vel-02',
      category: 'grafica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['velocidad-ondas-longitud-onda', 'velocidad-ondas-relacion-fundamental'],
      prompt: String.raw`La gráfica es una «foto» de una cuerda por la que viaja una onda periódica. La mano que la produce oscila con una frecuencia de $5.0\,\mathrm{Hz}$. ¿Con qué rapidez se propaga la onda?`,
      format: 'numeric',
      unitHint: 'm/s',
      figure: {
        kind: 'line',
        title: 'Forma de la cuerda en un instante',
        x: { label: 'x', unit: 'm' },
        y: { label: 'y', unit: 'cm' },
        series: [
          {
            name: 'y(x)',
            points: [[0, 0], [0.05, 1.913], [0.1, 3.536], [0.15, 4.619], [0.2, 5], [0.25, 4.619], [0.3, 3.536], [0.35, 1.913], [0.4, 0], [0.45, -1.913], [0.5, -3.536], [0.55, -4.619], [0.6, -5], [0.65, -4.619], [0.7, -3.536], [0.75, -1.913], [0.8, 0], [0.85, 1.913], [0.9, 3.536], [0.95, 4.619], [1, 5], [1.05, 4.619], [1.1, 3.536], [1.15, 1.913], [1.2, 0], [1.25, -1.913], [1.3, -3.536], [1.35, -4.619], [1.4, -5], [1.45, -4.619], [1.5, -3.536], [1.55, -1.913], [1.6, 0]],
          },
        ],
      },
    },
    {
      id: 'b5-vel-03',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['velocidad-ondas-cuerda'],
      prompt: '¿De qué depende la rapidez con que se propaga una onda transversal por una cuerda tensa?',
      format: 'choice',
      options: [
        'De la frecuencia con que se mueve la mano.',
        'De la amplitud de la onda.',
        'De la tensión de la cuerda y de su masa por unidad de longitud.',
        'De la longitud de onda que se produzca.',
      ],
    },
    {
      id: 'b5-vel-04',
      category: 'numerica',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['velocidad-ondas-cuerda'],
      prompt: String.raw`Una cuerda de $2.0\,\mathrm{m}$ de longitud y $40\,\mathrm{g}$ de masa se tensa con una fuerza de $50\,\mathrm{N}$. ¿Con qué rapidez viajan las ondas transversales por ella?`,
      format: 'numeric',
      unitHint: 'm/s',
    },
    {
      id: 'b5-vel-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['velocidad-ondas-cuerda', 'velocidad-ondas-relacion-fundamental'],
      prompt: String.raw`Un vibrador de $50\,\mathrm{Hz}$ produce ondas en una cuerda de densidad lineal $0.010\,\mathrm{kg/m}$, y se mide una longitud de onda de $0.60\,\mathrm{m}$. Si la tensión de la cuerda se **cuadruplica** y el vibrador sigue a $50\,\mathrm{Hz}$, ¿cuál será la nueva longitud de onda?`,
      format: 'numeric',
      unitHint: 'm',
    },
    {
      id: 'b5-vel-06',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['velocidad-ondas-relacion-fundamental'],
      prompt: String.raw`**Verdadero o falso:** si se duplica la frecuencia con que se agita el extremo de una cuerda, sin cambiar su tensión, la onda viaja el doble de rápido. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b5-vel-07',
      category: 'error',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['velocidad-ondas-relacion-fundamental', 'velocidad-ondas-longitud-onda'],
      prompt: String.raw`Un estudiante resolvió así este problema: *«Un bote anclado sube y baja $15$ veces en $1$ minuto por las olas, cuyas crestas están separadas $6.0\,\mathrm{m}$. ¿Con qué rapidez avanzan las olas?»*

1. Frecuencia: $f = 15/60\,\mathrm{s} = 0.25\,\mathrm{Hz}$.
2. Período: $T = 1/f = 4.0\,\mathrm{s}$.
3. Rapidez: $v = \lambda\,T = (6.0\,\mathrm{m})(4.0\,\mathrm{s})$.
4. Resultado: $v = 24\,\mathrm{m/s}$.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'No hay ningún error'],
    },
    {
      id: 'b5-vel-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['velocidad-ondas-cuerda', 'velocidad-ondas-relacion-fundamental', 'velocidad-ondas-longitud-onda'],
      prompt: String.raw`Dos cuerdas, A y B, están unidas por un nudo y sometidas a la misma tensión de $64\,\mathrm{N}$. La cuerda A tiene $\mu_A = 4.0\,\mathrm{g/m}$ y la B, $\mu_B = 16\,\mathrm{g/m}$. Un vibrador de $40\,\mathrm{Hz}$ conectado al extremo libre de A produce ondas que pasan a B.

(a) Calcule la rapidez de las ondas en cada cuerda. (b) ¿Cuál es la frecuencia en la cuerda B? Justifique. (c) Calcule la longitud de onda en cada cuerda. (d) Explique por qué una cuerda más gruesa produce, en una guitarra, notas más graves. Explique cada paso.`,
      format: 'open',
    },
  ],
};
