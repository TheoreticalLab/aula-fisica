import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'calor-energia-interna',
  title: 'Calor, energía interna y calor específico',
  summary:
    'El calor es energía que se transfiere por una diferencia de temperatura; la energía interna es la energía que el cuerpo contiene. El calor necesario para cambiar la temperatura depende de la masa y del calor específico: Q = mcΔT.',
  concepts: [
    { slug: 'calor-energia-interna-distincion', name: 'Calor, temperatura y energía interna' },
    { slug: 'calor-energia-interna-unidades', name: 'Caloría y joule' },
    { slug: 'calor-energia-interna-calor-especifico', name: 'Calor específico y capacidad calorífica: Q = mcΔT' },
  ],
  theory: String.raw`## Tres conceptos que no son lo mismo

En el lenguaje diario, «calor» y «temperatura» se usan casi como sinónimos («hace mucho calor»). En física son conceptos distintos, y hay un tercero que conviene separar de ambos.

- **Energía interna ($U$).** Es la energía total de las partículas de un cuerpo: la energía cinética de su movimiento desordenado y la energía potencial de sus interacciones. Es una propiedad del cuerpo: el cuerpo **tiene** energía interna.
- **Temperatura ($T$).** Mide la energía cinética **media** por partícula. No depende de cuántas partículas haya: una gota y una piscina pueden estar a la misma temperatura.
- **Calor ($Q$).** Es la energía que **se transfiere** de un cuerpo a otro **a causa de una diferencia de temperatura**. Es energía en tránsito: un cuerpo no «contiene calor», del mismo modo que una cuenta bancaria no contiene «transferencias».

Una piscina a $28\,^\circ\mathrm{C}$ tiene una temperatura mucho menor que una taza de café a $80\,^\circ\mathrm{C}$, pero una energía interna enormemente mayor, porque contiene muchísimas más moléculas. Si se vierte el café en la piscina, la energía fluye del café al agua de la piscina: lo decide la temperatura, no la energía interna.

> **Error frecuente.** Decir «el cuerpo caliente tiene más calor». Lo correcto es: tiene mayor temperatura y, al ponerse en contacto con uno más frío, le **transfiere** energía en forma de calor.

La energía interna también puede cambiar sin calor, mediante **trabajo**: al frotarse las manos, o al inflar con fuerza un neumático, la temperatura sube sin que ninguna llama intervenga. Esta equivalencia entre calor y trabajo la demostró James Joule en el siglo XIX, y la estudiaremos en la primera ley de la termodinámica.

## Unidades: caloría y joule

Como el calor es energía, su unidad en el SI es el **joule (J)**. Históricamente se usó la **caloría (cal)**, definida como el calor necesario para elevar $1\,^\circ\mathrm{C}$ la temperatura de $1\,\mathrm{g}$ de agua:

$$1\,\mathrm{cal} = 4.186\,\mathrm{J}, \qquad 1\,\mathrm{kcal} = 1000\,\mathrm{cal} = 4186\,\mathrm{J}.$$

La «Caloría» de las etiquetas de alimentos (con mayúscula) es en realidad una **kilocaloría**. Una galleta de $150$ Calorías aporta $150\,\mathrm{kcal} \approx 6.3\times10^{5}\,\mathrm{J}$.

## Calor específico

Si se pone al fuego una olla con $1\,\mathrm{kg}$ de agua y otra con $1\,\mathrm{kg}$ de aceite, el aceite se calienta mucho antes. Cada sustancia necesita una cantidad distinta de energía para elevar su temperatura. Experimentalmente se encuentra que el calor $Q$ necesario para cambiar la temperatura de un cuerpo en $\Delta T$, sin cambio de fase, es

$$Q = m\,c\,\Delta T .$$

- $m$ es la masa: el doble de masa requiere el doble de calor.
- $\Delta T = T_f - T_i$: el doble de aumento requiere el doble de calor.
- $c$ es el **calor específico** del material, en $\mathrm{J/(kg\cdot K)}$: la energía necesaria para elevar $1\,\mathrm{K}$ la temperatura de $1\,\mathrm{kg}$.

Valores típicos en $\mathrm{J/(kg\cdot K)}$: agua $4186$; hielo $2100$; aceite de cocina $\approx 2000$; aluminio $900$; vidrio $840$; arena seca $\approx 830$; hierro $450$; cobre $385$; plomo $130$.

El agua tiene un calor específico muy alto. Esto explica que el mar tarde en calentarse y en enfriarse, y que las islas como La Española tengan un clima más templado que el interior de los continentes a la misma latitud. Durante el día la arena de la playa se calienta mucho más que el mar con la misma radiación solar.

**Signo de Q.** Si $T_f > T_i$, $\Delta T > 0$ y $Q > 0$: el cuerpo **absorbe** calor. Si se enfría, $Q < 0$: el cuerpo **cede** calor.

> **Cuidado.** Como $\Delta T$ es una diferencia, da lo mismo expresarla en K o en °C. Sí importa que la masa esté en kilogramos si $c$ está en $\mathrm{J/(kg\cdot K)}$.

## Capacidad calorífica

Para un objeto concreto (una olla, un calorímetro) se usa su **capacidad calorífica** $C = m\,c$, en $\mathrm{J/K}$: la energía necesaria para elevar $1\,\mathrm{K}$ la temperatura **de ese objeto**. Entonces $Q = C\,\Delta T$. El calor específico es propiedad del material; la capacidad calorífica, del objeto.

## Límites del modelo

La relación $Q = m\,c\,\Delta T$ supone que $c$ es constante y que no hay cambios de fase. Para el agua líquida entre $0$ y $100\,^\circ\mathrm{C}$, $c$ varía menos de un $1\,\%$. Durante una fusión o una ebullición se absorbe calor sin que cambie la temperatura, y la fórmula deja de valer: ese caso se estudia en la lección de cambios de fase. En los gases, además, el calor específico depende de si el calentamiento ocurre a volumen o a presión constante.`,
  formulas: [
    {
      name: 'Calor sensible',
      latex: String.raw`Q = m\,c\,\Delta T`,
      description: 'Calor absorbido (Q > 0) o cedido (Q < 0) por un cuerpo cuya temperatura cambia sin cambio de fase.',
      variables: [
        { symbol: String.raw`Q`, meaning: 'Calor transferido al cuerpo', unit: 'J' },
        { symbol: String.raw`m`, meaning: 'Masa', unit: 'kg' },
        { symbol: String.raw`c`, meaning: 'Calor específico del material', unit: 'J/(kg·K)' },
        { symbol: String.raw`\Delta T`, meaning: 'Cambio de temperatura, T_f − T_i', unit: 'K o °C' },
      ],
    },
    {
      name: 'Capacidad calorífica',
      latex: String.raw`C = m\,c, \qquad Q = C\,\Delta T`,
      description: 'Energía necesaria para elevar 1 K la temperatura de un objeto concreto.',
      variables: [
        { symbol: String.raw`C`, meaning: 'Capacidad calorífica del objeto', unit: 'J/K' },
      ],
    },
    {
      name: 'Equivalencia caloría–joule',
      latex: String.raw`1\,\mathrm{cal} = 4.186\,\mathrm{J}, \qquad 1\,\mathrm{kcal} = 4186\,\mathrm{J}`,
      description: 'La «Caloría» de los alimentos es una kilocaloría.',
      variables: [
        { symbol: String.raw`\mathrm{cal}`, meaning: 'Caloría', unit: 'cal' },
        { symbol: String.raw`\mathrm{J}`, meaning: 'Joule, unidad SI de energía', unit: 'J' },
      ],
    },
  ],
  examples: [
    {
      title: 'Agua para el café',
      statement: String.raw`¿Cuánto calor hay que suministrar a $1.5\,\mathrm{L}$ de agua ($1.5\,\mathrm{kg}$) para llevarla de $25\,^\circ\mathrm{C}$ a $100\,^\circ\mathrm{C}$? Exprese el resultado en joules y en kilocalorías.`,
      steps: [
        String.raw`$\Delta T = 100 - 25 = 75\,\mathrm{K}$.`,
        String.raw`$Q = m\,c\,\Delta T = (1.5\,\mathrm{kg})(4186\,\mathrm{J/(kg\cdot K)})(75\,\mathrm{K}) = 4.71\times10^{5}\,\mathrm{J}$.`,
        String.raw`En kilocalorías: $Q = \dfrac{4.71\times10^{5}\,\mathrm{J}}{4186\,\mathrm{J/kcal}} = 112.5\,\mathrm{kcal}$.`,
      ],
      result: String.raw`$Q \approx 4.7\times10^{5}\,\mathrm{J} \approx 113\,\mathrm{kcal}$.`,
      interpretation:
        'Es positivo porque el agua absorbe energía. Comprobación rápida: 1 kcal eleva 1 °C un kilogramo de agua, así que 1.5 kg × 75 °C = 112.5 kcal.',
    },
    {
      title: 'Identificar un metal',
      statement: String.raw`Una pieza metálica de $0.50\,\mathrm{kg}$ absorbe $4.5\,\mathrm{kJ}$ y su temperatura sube $20\,^\circ\mathrm{C}$. ¿Cuál es su calor específico? ¿De qué metal podría tratarse?`,
      steps: [
        String.raw`Despejamos: $c = \dfrac{Q}{m\,\Delta T}$.`,
        String.raw`$c = \dfrac{4500\,\mathrm{J}}{(0.50\,\mathrm{kg})(20\,\mathrm{K})} = 450\,\mathrm{J/(kg\cdot K)}$.`,
        String.raw`Su capacidad calorífica es $C = m\,c = 225\,\mathrm{J/K}$.`,
      ],
      result: String.raw`$c = 450\,\mathrm{J/(kg\cdot K)}$, valor que coincide con el del hierro.`,
      interpretation:
        'Es unas nueve veces menor que el del agua: con la misma energía, un kilogramo de hierro se calienta nueve veces más que un kilogramo de agua.',
    },
  ],
  simulation: null,
  exercises: [
    {
      id: 'b6-cal-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['calor-energia-interna-calor-especifico'],
      prompt: String.raw`¿Cuánto calor se necesita para calentar $2.0\,\mathrm{kg}$ de agua ($c = 4186\,\mathrm{J/(kg\cdot K)}$) desde $20\,^\circ\mathrm{C}$ hasta $80\,^\circ\mathrm{C}$?`,
      format: 'numeric',
      unitHint: 'J',
    },
    {
      id: 'b6-cal-02',
      category: 'conceptual',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['calor-energia-interna-distincion'],
      prompt: String.raw`Compare una piscina con agua a $28\,^\circ\mathrm{C}$ y una taza de café a $80\,^\circ\mathrm{C}$. ¿Qué afirmación es correcta?`,
      format: 'choice',
      options: [
        'El café tiene más energía interna porque está a mayor temperatura.',
        'La piscina tiene mayor energía interna, aunque su temperatura sea menor, porque tiene muchas más moléculas.',
        'Ambos tienen la misma energía interna, porque los dos son agua.',
        'El café contiene más calor que la piscina.',
      ],
    },
    {
      id: 'b6-cal-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['calor-energia-interna-distincion'],
      prompt: String.raw`**Verdadero o falso:** el calor es la energía que contiene un cuerpo caliente. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b6-cal-04',
      category: 'grafica',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['calor-energia-interna-calor-especifico'],
      prompt: String.raw`Dos muestras, A y B, de $0.50\,\mathrm{kg}$ cada una y de materiales distintos, reciben calor sin cambiar de fase. La gráfica muestra su temperatura en función del calor absorbido. ¿Cuál es el calor específico de la sustancia A?`,
      format: 'numeric',
      unitHint: 'J/(kg·K)',
      figure: {
        kind: 'line',
        title: 'Temperatura frente a calor absorbido',
        x: { label: 'Q', unit: 'kJ' },
        y: { label: 'T', unit: '°C' },
        series: [
          {
            name: 'A',
            points: [
              [0, 20],
              [5, 32.5],
              [10, 45],
              [15, 57.5],
              [20, 70],
            ],
          },
          {
            name: 'B',
            points: [
              [0, 20],
              [5, 22.5],
              [10, 25],
              [15, 27.5],
              [20, 30],
            ],
          },
        ],
      },
    },
    {
      id: 'b6-cal-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['calor-energia-interna-calor-especifico'],
      prompt: String.raw`Un hervidor eléctrico de $1500\,\mathrm{W}$ contiene $1.2\,\mathrm{kg}$ de agua a $25\,^\circ\mathrm{C}$. Suponiendo que toda la energía eléctrica pasa al agua, ¿cuánto tiempo tarda en llevarla a $95\,^\circ\mathrm{C}$? (Recuerde que la potencia es la energía transferida por unidad de tiempo.)`,
      format: 'numeric',
      unitHint: 's',
    },
    {
      id: 'b6-cal-06',
      category: 'numerica',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['calor-energia-interna-unidades'],
      prompt: String.raw`La etiqueta de un paquete de galletas indica $150$ Calorías (alimentarias) por porción. ¿A cuántos joules equivale esa energía? Exprese el resultado en J.`,
      format: 'numeric',
      unitHint: 'J',
    },
    {
      id: 'b6-cal-07',
      category: 'error',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['calor-energia-interna-calor-especifico'],
      prompt: String.raw`Un estudiante calculó así el calor necesario para calentar una olla de aluminio de $300\,\mathrm{g}$ ($c = 900\,\mathrm{J/(kg\cdot K)}$) de $20\,^\circ\mathrm{C}$ a $70\,^\circ\mathrm{C}$:

1. Ecuación: $Q = m\,c\,\Delta T$.
2. Cambio de temperatura: $\Delta T = 70 - 20 = 50\,\mathrm{K}$.
3. Sustitución: $Q = (300)(900)(50)$.
4. Resultado: $Q = 1.35\times10^{7}\,\mathrm{J}$.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'No hay ningún error'],
    },
    {
      id: 'b6-cal-08',
      category: 'desarrollo',
      difficulty: 'intermedio',
      role: 'bank',
      concepts: ['calor-energia-interna-calor-especifico', 'calor-energia-interna-distincion'],
      prompt: String.raw`En una playa, $1.0\,\mathrm{kg}$ de agua de mar ($c \approx 4186\,\mathrm{J/(kg\cdot K)}$) y $1.0\,\mathrm{kg}$ de arena seca ($c \approx 830\,\mathrm{J/(kg\cdot K)}$) absorben cada uno $50\,\mathrm{kJ}$ de energía solar. (a) Calcule el aumento de temperatura de cada uno. (b) Explique con esos resultados por qué a mediodía la arena quema y el agua no. (c) Explique por qué las islas tienen un clima más templado que el interior de los continentes, usando correctamente los términos calor, temperatura y energía interna.`,
      format: 'open',
    },
  ],
};
