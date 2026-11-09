import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'gases-ideales',
  title: 'Gases ideales',
  summary:
    'La presión, el volumen, la temperatura absoluta y la cantidad de un gas diluido se relacionan con la ecuación de estado PV = nRT. Las leyes de Boyle, Charles y Gay-Lussac son casos particulares.',
  concepts: [
    { slug: 'gases-ideales-mol', name: 'Cantidad de sustancia: mol, masa molar y número de Avogadro' },
    { slug: 'gases-ideales-ecuacion-estado', name: 'Ecuación de estado del gas ideal: PV = nRT' },
    { slug: 'gases-ideales-leyes', name: 'Leyes de Boyle, Charles y Gay-Lussac' },
    { slug: 'gases-ideales-temperatura-absoluta', name: 'Temperatura absoluta en las leyes de los gases' },
  ],
  theory: String.raw`## Variables de estado de un gas

Para describir un gas encerrado en un recipiente basta con unas pocas magnitudes macroscópicas, llamadas **variables de estado**:

- La **presión** $P$: la fuerza por unidad de área que el gas ejerce sobre las paredes, debida a los choques de las moléculas. Se mide en pascales ($1\,\mathrm{Pa} = 1\,\mathrm{N/m^2}$); la presión atmosférica normal es $1\,\mathrm{atm} = 1.013\times10^{5}\,\mathrm{Pa} = 101.3\,\mathrm{kPa}$.
- El **volumen** $V$, en $\mathrm{m^3}$ ($1\,\mathrm{L} = 10^{-3}\,\mathrm{m^3}$).
- La **temperatura absoluta** $T$, en kelvin.
- La **cantidad de gas** $n$, en moles.

## El mol

Un **mol** es la cantidad de sustancia que contiene $N_A = 6.022\times10^{23}$ entidades (el **número de Avogadro**). Si un gas tiene $N$ moléculas, $n = N/N_A$. La **masa molar** $M$ es la masa de un mol: $4.0\,\mathrm{g/mol}$ para el helio, $32\,\mathrm{g/mol}$ para el oxígeno ($\mathrm{O_2}$), $28\,\mathrm{g/mol}$ para el nitrógeno ($\mathrm{N_2}$) y unos $29\,\mathrm{g/mol}$ para el aire. Así, $n = m/M$.

## La ecuación de estado

Experimentalmente, para cualquier gas suficientemente diluido se cumple

$$P\,V = n\,R\,T, \qquad R = 8.314\,\mathrm{J/(mol\cdot K)} .$$

Un gas que la cumple exactamente se llama **gas ideal**. Es un modelo en el que las moléculas son puntos que no se atraen entre sí y solo interactúan al chocar. El aire de una habitación, el gas de un neumático o el helio de un globo se comportan casi como gases ideales.

Lo notable es que la ecuación **no depende del tipo de gas**: a igual presión, volumen y temperatura, un litro de helio y un litro de oxígeno contienen el mismo número de moléculas (aunque el oxígeno tenga más masa).

> **Cuidado.** En $PV = nRT$, la temperatura debe estar en **kelvin** y la presión debe ser **absoluta**. Si un manómetro de neumático indica $220\,\mathrm{kPa}$, mide la presión **manométrica**, es decir, el exceso sobre la atmosférica; la absoluta es $220 + 101 = 321\,\mathrm{kPa}$.

## Casos particulares: las leyes de los gases

Si la cantidad de gas no cambia ($n$ constante), la ecuación de estado implica

$$\frac{P_1 V_1}{T_1} = \frac{P_2 V_2}{T_2} .$$

Manteniendo constante una variable más, se obtienen las leyes históricas:

- **Ley de Boyle** ($T$ constante): $P_1 V_1 = P_2 V_2$. Presión y volumen son inversamente proporcionales. Al empujar el émbolo de una jeringa tapada hasta la mitad de su volumen, la presión se duplica. En un diagrama $P$–$V$, cada temperatura da una curva llamada **isoterma** (una hipérbola).
- **Ley de Charles** ($P$ constante): $V_1/T_1 = V_2/T_2$. El volumen es proporcional a la temperatura absoluta. Un globo inflado que se deja al sol en un carro cerrado se agranda.
- **Ley de Gay-Lussac** ($V$ constante): $P_1/T_1 = P_2/T_2$. La presión es proporcional a la temperatura absoluta. Por eso un aerosol vacío no debe tirarse al fuego y la presión de los neumáticos sube después de un viaje largo.

## ¿Por qué la temperatura absoluta?

Si se mide el volumen de un gas a presión constante a varias temperaturas y se representa $V$ frente a $T$ en °C, se obtiene una recta. Prolongada hacia temperaturas bajas, esa recta corta el eje en $-273.15\,^\circ\mathrm{C}$ **para cualquier gas**. Ese es el **cero absoluto**, y es la razón de ser de la escala Kelvin: con $T$ en kelvin, el volumen es directamente proporcional a la temperatura.

> **Error frecuente.** Usar °C en las proporciones. Calentar un gas de $20\,^\circ\mathrm{C}$ a $40\,^\circ\mathrm{C}$ no duplica su presión: $313.15/293.15 \approx 1.07$, apenas un $7\,\%$ más.

## Unidades coherentes

Con $R = 8.314\,\mathrm{J/(mol\cdot K)}$, use $P$ en Pa y $V$ en $\mathrm{m^3}$; el producto $PV$ queda en joules. Un atajo útil: $1\,\mathrm{kPa\cdot L} = 1\,\mathrm{J}$. En las proporciones ($P_1V_1/T_1 = P_2V_2/T_2$) basta con usar las mismas unidades de presión y de volumen a ambos lados, pero la temperatura **siempre** en kelvin.

## Interpretación microscópica

La presión de un gas es el efecto promedio de una cantidad enorme de choques de moléculas contra las paredes. Si se calienta el gas a volumen constante, las moléculas se mueven más rápido y chocan con más frecuencia y con más fuerza: la presión sube, como dice la ley de Gay-Lussac. Si se reduce el volumen a temperatura constante, las moléculas recorren menos distancia entre choque y choque y golpean las paredes más a menudo: la presión también sube, como dice la ley de Boyle. En un gas ideal, la energía cinética media de traslación de cada molécula es proporcional a la temperatura absoluta, lo que confirma que la temperatura mide la agitación molecular.

## Límites del modelo

El modelo de gas ideal falla a presiones muy altas, cuando el volumen propio de las moléculas deja de ser despreciable, y a temperaturas bajas, cerca de la licuefacción, cuando las atracciones entre moléculas importan. Ningún gas real llega a volumen cero en el cero absoluto: antes se licúa o se solidifica. Aun así, para el aire en condiciones ordinarias el error es menor que un $1\,\%$.`,
  formulas: [
    {
      name: 'Ecuación de estado del gas ideal',
      latex: String.raw`P\,V = n\,R\,T`,
      description: 'Relaciona las variables de estado de un gas ideal.',
      variables: [
        { symbol: String.raw`P`, meaning: 'Presión absoluta', unit: 'Pa' },
        { symbol: String.raw`V`, meaning: 'Volumen', unit: 'm³' },
        { symbol: String.raw`n`, meaning: 'Cantidad de sustancia', unit: 'mol' },
        { symbol: String.raw`R`, meaning: 'Constante de los gases, 8.314', unit: 'J/(mol·K)' },
        { symbol: String.raw`T`, meaning: 'Temperatura absoluta', unit: 'K' },
      ],
    },
    {
      name: 'Cantidad de gas fija',
      latex: String.raw`\frac{P_1 V_1}{T_1} = \frac{P_2 V_2}{T_2}`,
      description: 'Relación entre dos estados de la misma cantidad de gas. Incluye las leyes de Boyle, Charles y Gay-Lussac.',
      variables: [
        { symbol: String.raw`P_1,\,V_1,\,T_1`, meaning: 'Estado inicial', unit: 'Pa, m³, K' },
        { symbol: String.raw`P_2,\,V_2,\,T_2`, meaning: 'Estado final', unit: 'Pa, m³, K' },
      ],
      notes: 'T siempre en kelvin; P y V en las mismas unidades a ambos lados.',
    },
    {
      name: 'Moles, masa y número de moléculas',
      latex: String.raw`n = \frac{m}{M} = \frac{N}{N_A}`,
      description: 'Cantidad de sustancia a partir de la masa o del número de moléculas.',
      variables: [
        { symbol: String.raw`m`, meaning: 'Masa del gas', unit: 'g o kg' },
        { symbol: String.raw`M`, meaning: 'Masa molar', unit: 'g/mol o kg/mol' },
        { symbol: String.raw`N`, meaning: 'Número de moléculas', unit: '—' },
        { symbol: String.raw`N_A`, meaning: 'Número de Avogadro, 6.022 × 10²³', unit: '1/mol' },
      ],
    },
  ],
  examples: [
    {
      title: 'El aire de un aula',
      statement: String.raw`Un aula mide $4.0\,\mathrm{m} \times 5.0\,\mathrm{m} \times 3.0\,\mathrm{m}$. El aire está a $1.0\,\mathrm{atm}$ y $27\,^\circ\mathrm{C}$. ¿Cuántos moles de aire hay? ¿Qué masa tienen, si $M = 29\,\mathrm{g/mol}$?`,
      steps: [
        String.raw`$V = 60\,\mathrm{m^3}$; $P = 1.013\times10^{5}\,\mathrm{Pa}$; $T = 27 + 273.15 = 300.15\,\mathrm{K}$.`,
        String.raw`$n = \dfrac{P\,V}{R\,T} = \dfrac{(1.013\times10^{5})(60)}{(8.314)(300.15)} = 2.44\times10^{3}\,\mathrm{mol}$.`,
        String.raw`$m = n\,M = (2436\,\mathrm{mol})(0.029\,\mathrm{kg/mol}) = 71\,\mathrm{kg}$.`,
      ],
      result: String.raw`$n \approx 2.4\times10^{3}\,\mathrm{mol}$ y $m \approx 71\,\mathrm{kg}$.`,
      interpretation: 'El aire de un aula pesa tanto como un estudiante adulto: el aire no es «nada», aunque no lo notemos.',
    },
    {
      title: 'Un neumático después del viaje',
      statement: String.raw`La presión absoluta de un neumático es $3.0\,\mathrm{atm}$ a $25\,^\circ\mathrm{C}$. Tras un viaje, el aire interior llega a $45\,^\circ\mathrm{C}$. Si el volumen no cambia, ¿cuál es la nueva presión absoluta?`,
      steps: [
        String.raw`Volumen y cantidad constantes: ley de Gay-Lussac, $\dfrac{P_1}{T_1} = \dfrac{P_2}{T_2}$.`,
        String.raw`$T_1 = 298.15\,\mathrm{K}$, $T_2 = 318.15\,\mathrm{K}$.`,
        String.raw`$P_2 = P_1\,\dfrac{T_2}{T_1} = (3.0\,\mathrm{atm})\,\dfrac{318.15}{298.15} = 3.20\,\mathrm{atm}$.`,
      ],
      result: String.raw`$P_2 \approx 3.2\,\mathrm{atm}$.`,
      interpretation:
        'Un aumento del 7 %. Si se hubieran usado °C, se habría obtenido 5.4 atm, un resultado absurdo. Por eso la presión de los neumáticos se revisa en frío.',
    },
    {
      title: 'Una jeringa tapada',
      statement: String.raw`Una jeringa tapada contiene $60\,\mathrm{mL}$ de aire a $1.0\,\mathrm{atm}$. Se empuja el émbolo lentamente (sin que cambie la temperatura) hasta que el volumen es $20\,\mathrm{mL}$. ¿Cuál es la presión?`,
      steps: [
        String.raw`Temperatura constante: ley de Boyle, $P_1 V_1 = P_2 V_2$.`,
        String.raw`$P_2 = P_1\,\dfrac{V_1}{V_2} = (1.0\,\mathrm{atm})\,\dfrac{60\,\mathrm{mL}}{20\,\mathrm{mL}} = 3.0\,\mathrm{atm}$.`,
      ],
      result: String.raw`$P_2 = 3.0\,\mathrm{atm}$.`,
      interpretation: 'El volumen se redujo a un tercio y la presión se triplicó. Aquí no hace falta convertir a SI, porque las unidades se cancelan en el cociente.',
    },
  ],
  simulation: null,
  exercises: [
    {
      id: 'b6-gas-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['gases-ideales-ecuacion-estado', 'gases-ideales-mol'],
      prompt: String.raw`Un tanque de $20\,\mathrm{L}$ contiene helio a $27\,^\circ\mathrm{C}$ y a una presión absoluta de $1.5\times10^{6}\,\mathrm{Pa}$. ¿Cuántos moles de helio contiene?`,
      format: 'numeric',
      unitHint: 'mol',
    },
    {
      id: 'b6-gas-02',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['gases-ideales-leyes'],
      prompt: String.raw`Una cantidad fija de gas ideal se comprime lentamente a temperatura constante hasta la mitad de su volumen inicial. ¿Qué le ocurre a su presión?`,
      format: 'choice',
      options: ['Se reduce a la mitad.', 'No cambia, porque la temperatura es constante.', 'Se duplica.', 'Se cuadruplica.'],
    },
    {
      id: 'b6-gas-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['gases-ideales-temperatura-absoluta', 'gases-ideales-leyes'],
      prompt: String.raw`**Verdadero o falso:** si un gas encerrado en un recipiente rígido se calienta de $20\,^\circ\mathrm{C}$ a $40\,^\circ\mathrm{C}$, su presión se duplica. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b6-gas-04',
      category: 'grafica',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['gases-ideales-ecuacion-estado', 'gases-ideales-leyes'],
      prompt: String.raw`La gráfica muestra la presión de $0.25\,\mathrm{mol}$ de un gas ideal en función de su volumen, medidos a una temperatura que se mantuvo constante. ¿A qué temperatura se hicieron las medidas?`,
      format: 'numeric',
      unitHint: 'K',
      figure: {
        kind: 'line',
        title: 'Isoterma P–V',
        x: { label: 'V', unit: 'L' },
        y: { label: 'P', unit: 'kPa' },
        series: [
          {
            name: 'P(V)',
            points: [
              [1, 600],
              [1.5, 400],
              [2, 300],
              [3, 200],
              [4, 150],
              [6, 100],
            ],
          },
        ],
      },
    },
    {
      id: 'b6-gas-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['gases-ideales-leyes', 'gases-ideales-temperatura-absoluta'],
      prompt: String.raw`Por la mañana, a $20\,^\circ\mathrm{C}$, el manómetro de una gasolinera indica que un neumático tiene $220\,\mathrm{kPa}$ (presión manométrica). Tras un viaje por la autopista, el aire interior está a $50\,^\circ\mathrm{C}$. Suponiendo que el volumen del neumático no cambia y que la presión atmosférica es $101\,\mathrm{kPa}$, ¿qué presión **manométrica** indicaría ahora el manómetro?`,
      format: 'numeric',
      unitHint: 'kPa',
    },
    {
      id: 'b6-gas-06',
      category: 'numerica',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['gases-ideales-leyes', 'gases-ideales-temperatura-absoluta'],
      prompt: String.raw`Un globo contiene $2.0\,\mathrm{L}$ de aire a $27\,^\circ\mathrm{C}$. Se calienta hasta $87\,^\circ\mathrm{C}$ a presión constante. ¿Cuál es su nuevo volumen?`,
      format: 'numeric',
      unitHint: 'L',
    },
    {
      id: 'b6-gas-07',
      category: 'conceptual',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['gases-ideales-mol', 'gases-ideales-ecuacion-estado'],
      prompt: String.raw`Dos recipientes idénticos contienen gases que se comportan como ideales, a la misma presión y a la misma temperatura: uno tiene helio ($M = 4.0\,\mathrm{g/mol}$) y el otro oxígeno ($M = 32\,\mathrm{g/mol}$). ¿Qué tienen en común?`,
      format: 'choice',
      options: [
        'La misma masa de gas.',
        'El mismo número de moléculas.',
        'La misma densidad.',
        'Nada: la ecuación de estado depende del tipo de gas.',
      ],
    },
    {
      id: 'b6-gas-08',
      category: 'desarrollo',
      difficulty: 'intermedio',
      role: 'bank',
      concepts: ['gases-ideales-temperatura-absoluta', 'gases-ideales-leyes'],
      prompt: String.raw`En un experimento a presión constante, una muestra de gas ocupa $2.00\,\mathrm{L}$ a $0\,^\circ\mathrm{C}$ y $2.73\,\mathrm{L}$ a $100\,^\circ\mathrm{C}$. (a) Suponiendo que $V$ varía linealmente con $T$ en °C, calcule la pendiente de la recta $V$–$T$ y extrapole a qué temperatura en °C el volumen sería cero. (b) Explique qué significado tiene ese valor y por qué ningún gas real llega a volumen cero. (c) Prediga el volumen a $50\,^\circ\mathrm{C}$ con la recta y con la ley de Charles en kelvin, y compare.`,
      format: 'open',
    },
  ],
};
