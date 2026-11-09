import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'transferencia-calor',
  title: 'Transferencia de calor: conducción, convección y radiación',
  summary:
    'El calor viaja por conducción a través de los materiales, por convección con el movimiento de fluidos y por radiación electromagnética, incluso en el vacío. Aislar consiste en frenar los tres mecanismos.',
  concepts: [
    { slug: 'transferencia-calor-conduccion', name: 'Conducción: H = kAΔT/L' },
    { slug: 'transferencia-calor-conveccion', name: 'Convección natural y forzada' },
    { slug: 'transferencia-calor-radiacion', name: 'Radiación térmica y ley de Stefan–Boltzmann' },
    { slug: 'transferencia-calor-aislamiento', name: 'Aislamiento térmico' },
  ],
  theory: String.raw`## Tres caminos para el calor

Cuando hay una diferencia de temperatura, la energía fluye del cuerpo caliente al frío. Lo hace por tres mecanismos, que casi siempre actúan a la vez:

- **Conducción:** la energía pasa de partícula en partícula dentro de un material, sin que el material se desplace.
- **Convección:** un fluido (aire, agua) se mueve y transporta consigo la energía.
- **Radiación:** la energía viaja como ondas electromagnéticas, sin necesidad de un medio material.

## Conducción

Al agarrar el mango de metal de un caldero que está al fuego, la mano se quema aunque el mango no toque la llama. Los átomos del extremo caliente vibran con más energía y la transmiten a sus vecinos; en los metales, además, los electrones libres transportan energía con gran eficacia.

Para una placa o barra de espesor $L$ y área $A$, con sus caras a temperaturas $T_C$ (caliente) y $T_F$ (fría), la **corriente de calor** (energía por unidad de tiempo) es

$$H = \frac{Q}{t} = \frac{k\,A\,(T_C - T_F)}{L} .$$

- $H$ se mide en watts.
- Es proporcional al **área**: una ventana grande deja pasar más calor que una pequeña.
- Es proporcional a la **diferencia de temperatura**.
- Es inversamente proporcional al **espesor**: una pared el doble de gruesa deja pasar la mitad.
- $k$ es la **conductividad térmica** del material, en $\mathrm{W/(m\cdot K)}$.

Valores típicos en $\mathrm{W/(m\cdot K)}$: cobre $385$; aluminio $205$; acero $50$; vidrio $0.8$; hormigón $0.8$; ladrillo $0.6$; agua $0.6$; madera $0.12$; poliestireno expandido (foam) $0.033$; aire quieto $0.026$.

Los metales son buenos conductores; la madera, el plástico y sobre todo el aire quieto son malos conductores (**aislantes**). Esto explica por qué una baldosa se siente más fría que una alfombra a la misma temperatura: la baldosa conduce mejor y extrae calor del pie más deprisa.

> **Cuidado.** La sensación de «frío» al tacto depende de la rapidez con que el objeto nos quita calor, no solo de su temperatura.

## Convección

En un fluido, la parte calentada se dilata, se vuelve menos densa y sube; la parte fría, más densa, baja. Se forma así una circulación, la **convección natural**, que transporta energía mucho más eficazmente que la conducción a través del fluido quieto. Ejemplos:

- El agua de una olla al fuego circula de abajo arriba.
- La **brisa marina**: de día la tierra se calienta más que el mar, el aire sobre la tierra sube y el aire fresco del mar ocupa su lugar. De noche ocurre lo contrario (brisa terrestre).
- Las nubes de tormenta de las tardes de verano se forman sobre el aire caliente que asciende.

Si el fluido se mueve por medios externos, como un abanico, un ventilador o el radiador de un carro con su bomba, la convección es **forzada**. Por eso un abanico refresca aunque no enfríe el aire: renueva la capa de aire caliente y húmedo que rodea la piel.

## Radiación

Todo cuerpo emite radiación electromagnética por el hecho de tener temperatura. A temperatura ambiente es radiación infrarroja, invisible; un hierro al rojo vivo emite además luz visible. Así nos llega la energía del Sol a través del vacío del espacio. La potencia emitida por una superficie viene dada por la **ley de Stefan–Boltzmann**:

$$P = e\,\sigma\,A\,T^4 ,$$

con $\sigma = 5.67\times10^{-8}\,\mathrm{W/(m^2\cdot K^4)}$, $A$ el área y $e$ la **emisividad** (entre 0 y 1): cerca de 1 para superficies oscuras y mates, incluida la piel humana, y pequeña para superficies pulidas y brillantes. $T$ debe estar en **kelvin**, porque aparece elevada a la cuarta potencia, no como diferencia.

Un cuerpo también absorbe la radiación de su entorno. Si el entorno está a $T_{amb}$, la potencia **neta** emitida es $P_{neta} = e\,\sigma\,A\,(T^4 - T_{amb}^4)$. Un buen emisor es también un buen absorbente: un techo pintado de blanco refleja buena parte del sol y se calienta mucho menos que uno negro.

## Aislamiento térmico

Aislar es frenar los tres mecanismos a la vez:

- Contra la **conducción**: materiales de baja $k$ y gran espesor. Casi todos los buenos aislantes (foam, fibra de vidrio, lana, plumas) funcionan atrapando aire en pequeñas celdas.
- Contra la **convección**: impedir que el aire circule (celdas cerradas, ventanas selladas).
- Contra la **radiación**: superficies reflectantes, como el interior plateado de un termo o las láminas reflectantes bajo los techos de zinc.

Un termo combina las tres ideas: doble pared de vidrio con vacío entre ambas (sin conducción ni convección), superficies plateadas (poca radiación) y un tapón aislante.

## Límites del modelo

La fórmula de conducción supone un estado estacionario (temperaturas que no cambian con el tiempo) y caras a temperatura uniforme. En una ventana real, finas capas de aire junto al vidrio aportan una resistencia adicional y reducen mucho el flujo calculado con el vidrio solo. La convección no tiene una fórmula sencilla de este nivel: depende de la forma del cuerpo y de la velocidad del fluido.`,
  formulas: [
    {
      name: 'Ley de conducción',
      latex: String.raw`H = \frac{Q}{t} = \frac{k\,A\,(T_C - T_F)}{L}`,
      description: 'Corriente de calor a través de una placa o barra en estado estacionario.',
      variables: [
        { symbol: String.raw`H`, meaning: 'Corriente de calor (energía por unidad de tiempo)', unit: 'W' },
        { symbol: String.raw`k`, meaning: 'Conductividad térmica del material', unit: 'W/(m·K)' },
        { symbol: String.raw`A`, meaning: 'Área perpendicular al flujo', unit: 'm²' },
        { symbol: String.raw`T_C - T_F`, meaning: 'Diferencia de temperatura entre las caras', unit: 'K' },
        { symbol: String.raw`L`, meaning: 'Espesor o longitud en la dirección del flujo', unit: 'm' },
      ],
    },
    {
      name: 'Ley de Stefan–Boltzmann',
      latex: String.raw`P = e\,\sigma\,A\,T^4`,
      description: 'Potencia radiada por una superficie a temperatura absoluta T.',
      variables: [
        { symbol: String.raw`P`, meaning: 'Potencia emitida', unit: 'W' },
        { symbol: String.raw`e`, meaning: 'Emisividad (0 a 1)', unit: '— (adimensional)' },
        { symbol: String.raw`\sigma`, meaning: 'Constante de Stefan–Boltzmann, 5.67 × 10⁻⁸', unit: 'W/(m²·K⁴)' },
        { symbol: String.raw`A`, meaning: 'Área de la superficie emisora', unit: 'm²' },
        { symbol: String.raw`T`, meaning: 'Temperatura absoluta de la superficie', unit: 'K' },
      ],
      notes: 'T siempre en kelvin.',
    },
    {
      name: 'Radiación neta',
      latex: String.raw`P_{neta} = e\,\sigma\,A\,(T^4 - T_{amb}^4)`,
      description: 'Potencia emitida menos potencia absorbida del entorno a temperatura T_amb.',
      variables: [{ symbol: String.raw`T_{amb}`, meaning: 'Temperatura absoluta del entorno', unit: 'K' }],
    },
  ],
  examples: [
    {
      title: 'Una ventana con aire acondicionado',
      statement: String.raw`Una ventana de vidrio ($k = 0.80\,\mathrm{W/(m\cdot K)}$) de $1.2\,\mathrm{m} \times 1.0\,\mathrm{m}$ y $4.0\,\mathrm{mm}$ de espesor separa una oficina a $24\,^\circ\mathrm{C}$ del exterior a $32\,^\circ\mathrm{C}$. Estime la corriente de calor por conducción a través del vidrio.`,
      steps: [
        String.raw`Datos en SI: $A = 1.2\,\mathrm{m^2}$, $L = 4.0\times10^{-3}\,\mathrm{m}$, $\Delta T = 32 - 24 = 8\,\mathrm{K}$.`,
        String.raw`$H = \dfrac{k\,A\,\Delta T}{L} = \dfrac{(0.80)(1.2)(8)}{4.0\times10^{-3}} = 1920\,\mathrm{W}$.`,
      ],
      result: String.raw`$H \approx 1.9\times10^{3}\,\mathrm{W}$, de afuera hacia adentro.`,
      interpretation:
        'Es una sobreestimación: las capas de aire pegadas a ambas caras del vidrio frenan mucho el flujo. Aun así, muestra por qué las ventanas son el punto débil del aislamiento y por qué conviene el doble vidrio.',
    },
    {
      title: 'Radiación del cuerpo humano',
      statement: String.raw`La piel de una persona ($A = 1.8\,\mathrm{m^2}$, $e = 0.97$) está a $34\,^\circ\mathrm{C}$ y la habitación a $25\,^\circ\mathrm{C}$. Calcule la potencia que emite la piel y la potencia neta que pierde por radiación.`,
      steps: [
        String.raw`Temperaturas absolutas: $T = 307.15\,\mathrm{K}$, $T_{amb} = 298.15\,\mathrm{K}$.`,
        String.raw`Emitida: $P = (0.97)(5.67\times10^{-8})(1.8)(307.15)^4 = 881\,\mathrm{W}$.`,
        String.raw`Absorbida del entorno: $(0.97)(5.67\times10^{-8})(1.8)(298.15)^4 = 782\,\mathrm{W}$.`,
        String.raw`Neta: $P_{neta} = 881 - 782 = 99\,\mathrm{W}$.`,
      ],
      result: String.raw`Emite unos $880\,\mathrm{W}$, pero la pérdida neta es de unos $100\,\mathrm{W}$.`,
      interpretation:
        'La potencia neta es del orden del metabolismo en reposo (unos 100 W). Por eso a 25 °C, desnudos, nos sentimos cómodos o algo frescos.',
    },
    {
      title: 'Una hielera de foam',
      statement: String.raw`Una hielera de poliestireno ($k = 0.033\,\mathrm{W/(m\cdot K)}$) tiene un área total de paredes de $0.80\,\mathrm{m^2}$ y $2.0\,\mathrm{cm}$ de espesor. Dentro hay hielo a $0\,^\circ\mathrm{C}$ y fuera, $30\,^\circ\mathrm{C}$. ¿Cuánto hielo se funde en una hora?`,
      steps: [
        String.raw`$H = \dfrac{(0.033)(0.80)(30)}{0.020} = 39.6\,\mathrm{W}$.`,
        String.raw`Energía en una hora: $Q = H\,t = (39.6\,\mathrm{W})(3600\,\mathrm{s}) = 1.43\times10^{5}\,\mathrm{J}$.`,
        String.raw`Hielo fundido: $m = \dfrac{Q}{L_f} = \dfrac{1.43\times10^{5}\,\mathrm{J}}{3.34\times10^{5}\,\mathrm{J/kg}} = 0.43\,\mathrm{kg}$.`,
      ],
      result: String.raw`Se funden unos $0.43\,\mathrm{kg}$ de hielo por hora.`,
      interpretation:
        'Con 2 cm de foam, una bolsa de 5 kg de hielo dura casi medio día, siempre que la hielera esté cerrada (sin convección) y a la sombra (sin radiación solar directa).',
    },
  ],
  simulation: null,
  exercises: [
    {
      id: 'b6-trans-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['transferencia-calor-conduccion'],
      prompt: String.raw`Una varilla de cobre ($k = 385\,\mathrm{W/(m\cdot K)}$) de $0.50\,\mathrm{m}$ de largo y $2.0\times10^{-4}\,\mathrm{m^2}$ de sección, aislada por los lados, tiene un extremo en agua hirviendo a $100\,^\circ\mathrm{C}$ y el otro a $20\,^\circ\mathrm{C}$. ¿Cuál es la corriente de calor a lo largo de la varilla?`,
      format: 'numeric',
      unitHint: 'W',
    },
    {
      id: 'b6-trans-02',
      category: 'conceptual',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['transferencia-calor-conduccion'],
      prompt: String.raw`Por la mañana, al salir de la cama, se pisa con un pie una baldosa y con el otro una alfombra, ambas en la misma habitación desde hace horas. La baldosa se siente mucho más fría. ¿Por qué?`,
      format: 'choice',
      options: [
        'Porque la baldosa está a menor temperatura que la alfombra.',
        'Porque la baldosa tiene mayor conductividad térmica y extrae calor del pie más rápidamente.',
        'Porque la alfombra produce calor.',
        'Porque la baldosa emite «frío» por radiación.',
      ],
    },
    {
      id: 'b6-trans-03',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['transferencia-calor-conveccion', 'transferencia-calor-radiacion'],
      prompt: String.raw`Marque **todas** las situaciones en las que el mecanismo principal de transferencia de calor es la **convección**.`,
      format: 'choice',
      multiple: true,
      options: [
        'La brisa que sopla del mar hacia la playa en una tarde soleada.',
        'La circulación del agua que se calienta en una olla al fuego.',
        'El mango metálico de una cuchara que se calienta dentro de una taza de café.',
        'La energía del Sol que llega a la Tierra.',
        'El aire caliente que sube sobre el asfalto de una carretera a mediodía.',
      ],
    },
    {
      id: 'b6-trans-04',
      category: 'vf_justificacion',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['transferencia-calor-radiacion'],
      prompt: String.raw`**Verdadero o falso:** si la temperatura absoluta de un objeto se duplica (por ejemplo, de $300\,\mathrm{K}$ a $600\,\mathrm{K}$), la potencia que emite por radiación también se duplica. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b6-trans-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['transferencia-calor-conduccion', 'transferencia-calor-aislamiento'],
      prompt: String.raw`Una hielera de foam ($k = 0.030\,\mathrm{W/(m\cdot K)}$) tiene paredes de $3.0\,\mathrm{cm}$ de espesor y un área total de $1.2\,\mathrm{m^2}$. Contiene hielo a $0\,^\circ\mathrm{C}$ y está en una playa a $31\,^\circ\mathrm{C}$. Considerando solo la conducción por las paredes, ¿cuántos kilogramos de hielo se funden en $6.0\,\mathrm{h}$? ($L_f = 3.34\times10^{5}\,\mathrm{J/kg}$.)`,
      format: 'numeric',
      unitHint: 'kg',
    },
    {
      id: 'b6-trans-06',
      category: 'numerica',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['transferencia-calor-radiacion'],
      prompt: String.raw`La resistencia de un calentador tiene un área de $0.010\,\mathrm{m^2}$, emisividad $0.90$ y está a $727\,^\circ\mathrm{C}$. ¿Qué potencia emite por radiación? ($\sigma = 5.67\times10^{-8}\,\mathrm{W/(m^2\cdot K^4)}$.)`,
      format: 'numeric',
      unitHint: 'W',
    },
    {
      id: 'b6-trans-07',
      category: 'grafica',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['transferencia-calor-conduccion'],
      prompt: String.raw`Una barra metálica de $0.20\,\mathrm{m}$ de largo y $1.0\times10^{-4}\,\mathrm{m^2}$ de sección, aislada por los lados, se somete a distintas diferencias de temperatura entre sus extremos. La gráfica muestra la corriente de calor medida en cada caso. Determine la conductividad térmica del metal.`,
      format: 'numeric',
      unitHint: 'W/(m·K)',
      figure: {
        kind: 'scatter',
        title: 'Corriente de calor frente a diferencia de temperatura',
        x: { label: 'ΔT', unit: 'K' },
        y: { label: 'H', unit: 'W' },
        series: [
          {
            name: 'Medidas',
            points: [
              [0, 0],
              [20, 2.05],
              [40, 4.1],
              [60, 6.15],
              [80, 8.2],
            ],
          },
        ],
      },
    },
    {
      id: 'b6-trans-08',
      category: 'desarrollo',
      difficulty: 'intermedio',
      role: 'bank',
      concepts: ['transferencia-calor-aislamiento', 'transferencia-calor-conduccion', 'transferencia-calor-radiacion'],
      prompt: String.raw`El techo de una casa es una losa de hormigón ($k = 0.80\,\mathrm{W/(m\cdot K)}$) de $10\,\mathrm{cm}$ de espesor y $50\,\mathrm{m^2}$. A mediodía la cara exterior está a $45\,^\circ\mathrm{C}$ y la interior a $30\,^\circ\mathrm{C}$. (a) Calcule la corriente de calor por conducción. (b) Repita el cálculo para una capa de $5.0\,\mathrm{cm}$ de foam ($k = 0.033\,\mathrm{W/(m\cdot K)}$) con la misma diferencia de temperatura y compare. (c) Explique por qué pintar el techo de blanco también ayuda y qué mecanismo de transferencia afecta. (d) Mencione otra medida para reducir la entrada de calor y el mecanismo que frena.`,
      format: 'open',
    },
  ],
};
