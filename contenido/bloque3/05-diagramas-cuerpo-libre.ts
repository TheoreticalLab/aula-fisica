import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'diagramas-cuerpo-libre',
  title: 'Diagramas de cuerpo libre',
  summary:
    'Un diagrama de cuerpo libre aísla un cuerpo y representa todas las fuerzas que actúan sobre él, y solo esas. Es el paso que conecta la situación física con la segunda ley de Newton.',
  concepts: [
    { slug: 'dcl-procedimiento', name: 'Procedimiento para construir un DCL' },
    { slug: 'dcl-que-fuerzas-incluir', name: 'Qué fuerzas incluir en un DCL y cuáles no' },
    { slug: 'dcl-ejes-ecuaciones', name: 'Elección de ejes y ecuaciones a partir del DCL' },
  ],
  theory: String.raw`## ¿Para qué sirve un diagrama de cuerpo libre?

La segunda ley, $\vec F_{\text{neta}} = m\,\vec a$, exige sumar **todas** las fuerzas que actúan sobre un cuerpo. Olvidar una fuerza, o añadir una que no existe, lleva a un resultado equivocado aunque el álgebra sea perfecta. El **diagrama de cuerpo libre** (DCL) es la herramienta para no equivocarse en ese paso: se dibuja el cuerpo **aislado** de su entorno («libre») y se representan como flechas todas las fuerzas que los demás cuerpos ejercen sobre él.

Normalmente un DCL se dibuja. En esta aula lo **describiremos con tablas o listas**: para cada fuerza indicaremos su nombre y símbolo, el cuerpo que la ejerce (agente), su tipo (de contacto o a distancia) y su dirección. Esa descripción contiene exactamente la misma información que el dibujo, y le recomendamos hacer también el dibujo en papel.

## Procedimiento paso a paso

1. **Elija el cuerpo.** Decida qué objeto va a estudiar y represéntelo como un punto o un recuadro. Si hay varios cuerpos, haga un DCL para cada uno.
2. **Añada las fuerzas a distancia.** En los problemas de este curso, casi siempre es solo el **peso** $\vec W$, que la Tierra ejerce verticalmente hacia abajo, de magnitud $W = mg$.
3. **Recorra el contorno del cuerpo.** Cada cosa que lo **toca** puede ejercer una fuerza de contacto:
   - una superficie: la **normal** $\vec N$, perpendicular a la superficie, y, si hay rozamiento, la **fricción** $\vec f$, paralela a la superficie;
   - una cuerda o cable: la **tensión** $\vec T$, a lo largo de la cuerda y alejándose del cuerpo (una cuerda solo puede tirar);
   - una mano, un resorte u otro objeto que empuja o tira: una fuerza aplicada $\vec F$;
   - el aire o el agua: resistencia o empuje, si no son despreciables.
4. **Dibuje cada fuerza** como una flecha que sale del cuerpo, en su dirección, con su nombre. Si es posible, indique el agente: $\vec F_{\text{piso sobre caja}}$.
5. **Revise la lista.** Cada fuerza debe tener un agente concreto. Si no sabe qué cuerpo la ejerce, bórrela.
6. **Elija ejes.** Conviene que uno de los ejes tenga la dirección de la aceleración (si se conoce), por ejemplo, a lo largo de la superficie sobre la que se mueve el cuerpo.
7. **Descomponga** las fuerzas que no están sobre los ejes y **escriba la segunda ley en cada eje**: $F_{\text{neta},x} = m\,a_x$ y $F_{\text{neta},y} = m\,a_y$.

Las fuerzas normal, de fricción y de tensión, y el peso, se estudian con detalle en las lecciones siguientes. Aquí nos interesa reconocer **cuándo** aparecen y **hacia dónde** apuntan.

## Qué fuerzas no van en un DCL

Los errores más frecuentes consisten en añadir fuerzas que no existen o que no actúan sobre el cuerpo:

- **Fuerzas que el cuerpo ejerce sobre otros.** La fuerza de la caja sobre el piso actúa sobre el piso, no sobre la caja: va en el DCL del piso. En el DCL de un cuerpo, todas las fuerzas son «algo **sobre** el cuerpo».
- **La «fuerza del movimiento» o «del impulso».** Una pelota lanzada no lleva consigo la fuerza de la mano. Si nada la empuja en el sentido del movimiento, no hay fuerza en ese sentido: la pelota avanza por inercia.
- **El producto $m\,\vec a$.** No es una fuerza que ejerza ningún cuerpo, sino el resultado de sumar las fuerzas. Se escribe al otro lado de la ecuación, nunca en el diagrama.
- **La fuerza neta** como una flecha más. Es la suma de las fuerzas dibujadas; si la añade, la cuenta dos veces.
- **Una fuerza y sus componentes a la vez.** Si sustituye una fuerza oblicua por sus componentes, borre (o tache) la original.
- **«Fuerzas de inercia» o «fuerza centrífuga».** En un sistema de referencia inercial no existen: ningún cuerpo las ejerce.

## Un DCL descrito en texto

Una persona empuja una caja que desliza por un piso horizontal con rozamiento. Su DCL es:

| Fuerza | Símbolo | Agente | Tipo | Dirección |
|---|---|---|---|---|
| Peso | $\vec W$ | Tierra | A distancia | Vertical, hacia abajo |
| Normal | $\vec N$ | Piso | Contacto | Vertical, hacia arriba (perpendicular al piso) |
| Fricción | $\vec f$ | Piso | Contacto | Horizontal, opuesta al deslizamiento |
| Empuje | $\vec F$ | Mano | Contacto | Horizontal, en el sentido del empuje |

Con el eje $x$ horizontal en el sentido del movimiento y el eje $y$ vertical hacia arriba, las ecuaciones son $F - f = m\,a$ (eje $x$) y $N - W = 0$ (eje $y$, porque la caja no se acelera verticalmente).

## Elección de ejes

Cualquier par de ejes perpendiculares da el resultado correcto, pero una buena elección ahorra trabajo:

- Si el cuerpo se mueve sobre una superficie, tome un eje **paralelo** a la superficie y otro **perpendicular**. Así la aceleración tiene una sola componente y la otra ecuación es de equilibrio.
- Si conoce el sentido de la aceleración, haga que el sentido positivo coincida con él: las componentes saldrán positivas.
- Una vez elegidos los ejes, **cada componente lleva su signo**. Una fuerza que apunta hacia $-x$ tiene componente $x$ negativa.

En los planos inclinados conviene usar ejes paralelo y perpendicular al plano; el peso queda entonces oblicuo y hay que descomponerlo. Ese caso se estudia en la lección de planos inclinados.

> **Cuidado.** La normal no siempre es igual al peso. Si una cuerda tira de la caja hacia arriba, o una mano la aprieta contra el piso, la ecuación del eje vertical cambia y la normal también. El DCL y la segunda ley lo dicen; la intuición «la normal es el peso» no.

## Límites del modelo

En un DCL dibujamos todas las fuerzas como si actuaran sobre un mismo punto. Eso basta para estudiar la traslación, pero no para estudiar giros o vuelcos, para los que importa dónde se aplica cada fuerza. Además, cada flecha resume una fuerza que en realidad se reparte sobre una superficie (la normal actúa sobre toda la base de la caja).`,
  formulas: [
    {
      name: 'Segunda ley por ejes a partir del DCL',
      latex: String.raw`F_{\text{neta},x} = m\,a_x, \qquad F_{\text{neta},y} = m\,a_y`,
      description:
        'Se suman con signo las componentes de todas las fuerzas del DCL en cada eje y se igualan a la masa por la componente de la aceleración en ese eje.',
      variables: [
        { symbol: String.raw`F_{\text{neta},x},\,F_{\text{neta},y}`, meaning: 'Suma de las componentes de todas las fuerzas del DCL', unit: 'N' },
        { symbol: String.raw`m`, meaning: 'Masa del cuerpo aislado', unit: 'kg' },
        { symbol: String.raw`a_x,\,a_y`, meaning: 'Componentes de la aceleración', unit: 'm/s²' },
      ],
      notes: 'Si el cuerpo no se acelera en un eje (por ejemplo, el vertical para una caja sobre el piso), en ese eje la suma es cero.',
    },
    {
      name: 'Componentes de una fuerza oblicua',
      latex: String.raw`F_x = F\cos\theta, \qquad F_y = F\sin\theta`,
      description: 'Descomposición de una fuerza que forma un ángulo θ con el eje x elegido.',
      variables: [
        { symbol: String.raw`F`, meaning: 'Magnitud de la fuerza', unit: 'N' },
        { symbol: String.raw`\theta`, meaning: 'Ángulo entre la fuerza y el eje +x elegido', unit: '°' },
        { symbol: String.raw`F_x,\,F_y`, meaning: 'Componentes según los ejes elegidos', unit: 'N' },
      ],
      notes: 'Después de descomponer, use las componentes en lugar de la fuerza original, no además de ella.',
    },
    {
      name: 'Peso',
      latex: String.raw`W = m\,g`,
      description:
        'Magnitud de la fuerza gravitatoria que la Tierra ejerce sobre el cuerpo; aparece en casi todos los DCL, vertical hacia abajo.',
      variables: [
        { symbol: String.raw`W`, meaning: 'Peso', unit: 'N' },
        { symbol: String.raw`g`, meaning: 'Aceleración de la gravedad (9.8 m/s²)', unit: 'm/s²' },
      ],
      notes: 'Se estudia con detalle en la lección de peso y fuerza normal.',
    },
  ],
  examples: [
    {
      title: 'Caja empujada sobre un piso con rozamiento',
      statement: String.raw`Una persona empuja horizontalmente una caja de $20\,\mathrm{kg}$ con $80\,\mathrm{N}$. La caja desliza por un piso horizontal, que ejerce sobre ella una fricción de $50\,\mathrm{N}$. Construya el DCL y calcule la aceleración de la caja y la fuerza normal.`,
      steps: [
        String.raw`DCL de la caja: peso $W = mg = (20)(9.8) = 196\,\mathrm{N}$ (Tierra, hacia abajo); normal $N$ (piso, hacia arriba); fricción $f = 50\,\mathrm{N}$ (piso, opuesta al movimiento); empuje $F = 80\,\mathrm{N}$ (mano, hacia adelante).`,
        String.raw`Ejes: $x$ horizontal en el sentido del movimiento, $y$ vertical hacia arriba. Todas las fuerzas están sobre los ejes: no hay que descomponer.`,
        String.raw`Eje $x$: $F - f = m\,a \Rightarrow 80 - 50 = 20\,a \Rightarrow a = \dfrac{30\,\mathrm{N}}{20\,\mathrm{kg}} = 1.5\,\mathrm{m/s^2}$.`,
        String.raw`Eje $y$: $N - W = 0$ (no hay aceleración vertical) $\Rightarrow N = 196\,\mathrm{N}$.`,
      ],
      result: String.raw`$a = 1.5\,\mathrm{m/s^2}$ en el sentido del empuje; $N = 196\,\mathrm{N}$.`,
      interpretation:
        'La aceleración depende de la fuerza neta (30 N), no del empuje (80 N). El DCL tiene exactamente cuatro fuerzas, una por cada interacción: la Tierra, el piso (que ejerce dos, normal y fricción) y la mano.',
    },
    {
      title: 'Caja arrastrada con una cuerda inclinada',
      statement: String.raw`Una caja de $10\,\mathrm{kg}$ se arrastra por un piso horizontal sin rozamiento con una cuerda que forma $30^\circ$ sobre la horizontal y tira con $40\,\mathrm{N}$. Construya el DCL y calcule la aceleración de la caja y la fuerza normal.`,
      steps: [
        String.raw`DCL: peso $W = (10)(9.8) = 98\,\mathrm{N}$ (Tierra, hacia abajo); normal $N$ (piso, hacia arriba); tensión $T = 40\,\mathrm{N}$ (cuerda, a $30^\circ$ sobre la horizontal). No hay fricción.`,
        String.raw`Ejes: $x$ horizontal hacia donde tira la cuerda, $y$ vertical. Componentes de la tensión: $T_x = 40\cos 30^\circ = 34.6\,\mathrm{N}$, $T_y = 40\sin 30^\circ = 20.0\,\mathrm{N}$. Desde aquí se usan $T_x$ y $T_y$ en lugar de $T$.`,
        String.raw`Eje $x$: $T_x = m\,a \Rightarrow a = \dfrac{34.6\,\mathrm{N}}{10\,\mathrm{kg}} = 3.46\,\mathrm{m/s^2}$.`,
        String.raw`Eje $y$: $N + T_y - W = 0 \Rightarrow N = 98 - 20.0 = 78\,\mathrm{N}$.`,
      ],
      result: String.raw`$a \approx 3.5\,\mathrm{m/s^2}$ y $N = 78\,\mathrm{N}$.`,
      interpretation:
        'La normal es menor que el peso porque la cuerda sostiene parte de la caja. Solo la componente horizontal de la tensión acelera la caja; si la cuerda fuera horizontal, la aceleración sería mayor (4.0 m/s²).',
    },
    {
      title: 'Una pelota de béisbol en el aire',
      statement: String.raw`Un lanzador suelta una pelota de béisbol de $0.145\,\mathrm{kg}$. Desprecie la resistencia del aire. Construya el DCL de la pelota mientras vuela hacia el bateador y determine su aceleración.`,
      steps: [
        String.raw`¿Qué toca a la pelota en vuelo? Solo el aire, cuyo efecto despreciamos. La mano ya no la toca.`,
        String.raw`Fuerzas a distancia: el peso, $W = (0.145)(9.8) = 1.42\,\mathrm{N}$, vertical hacia abajo (la Tierra sobre la pelota).`,
        String.raw`El DCL tiene **una sola fuerza**. No hay «fuerza del lanzamiento» hacia adelante: ningún cuerpo la ejerce.`,
        String.raw`Segunda ley: $a = \dfrac{W}{m} = \dfrac{1.42\,\mathrm{N}}{0.145\,\mathrm{kg}} = 9.8\,\mathrm{m/s^2}$, vertical hacia abajo.`,
      ],
      result: String.raw`DCL: solo el peso, $1.42\,\mathrm{N}$ hacia abajo. Aceleración: $9.8\,\mathrm{m/s^2}$ hacia abajo.`,
      interpretation:
        'La pelota avanza horizontalmente por inercia (sin fuerza horizontal, su velocidad horizontal es constante) y su velocidad vertical cambia por el peso. Es justamente el movimiento de proyectiles del bloque de cinemática.',
    },
  ],
  simulation: {
    key: 'fuerzas',
    params: { m: 3, F: 20, theta: 0, muS: 0.4, muK: 0.3, g: 9.8 },
    guide: String.raw`1. Con los valores iniciales, observe el diagrama de cuerpo libre que dibuja el simulador. Haga una tabla con cada fuerza: nombre, agente, tipo y dirección.
2. Escriba las ecuaciones de la segunda ley en los ejes horizontal y vertical. Calcule la normal y, con la fricción que muestra el simulador, la aceleración. Ejecute la simulación y compare.
3. Reduzca la fuerza aplicada a $F = 5\,\mathrm{N}$. El bloque no se mueve. ¿Qué fuerza del DCL cambió de valor? ¿Cuánto vale ahora la fuerza neta?
4. Ponga $F = -20\,\mathrm{N}$. ¿Qué flechas del DCL cambian de sentido y cuáles no?
5. Ponga $F = 0$, $\mu_s = \mu_k = 0$ y una inclinación $\theta = 20^\circ$. Observe cómo cambia el DCL: ¿qué dirección tiene ahora la normal? ¿Por qué conviene tomar ejes paralelo y perpendicular al plano?`,
  },
  exercises: [
    {
      id: 'b3-dcl-01',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['dcl-que-fuerzas-incluir'],
      prompt:
        'Una pelota de béisbol vuela hacia el bateador después de salir de la mano del lanzador. Considere la resistencia del aire. ¿Qué fuerzas deben aparecer en el diagrama de cuerpo libre de la pelota? Marque todas las que correspondan.',
      format: 'choice',
      multiple: true,
      options: [
        'El peso de la pelota (la Tierra sobre la pelota).',
        'La fuerza del lanzamiento, que la impulsa hacia el bateador.',
        'La resistencia del aire, opuesta a la velocidad de la pelota.',
        'Una fuerza igual a m·a en el sentido del movimiento.',
        'La fuerza que la pelota ejerce sobre el aire.',
      ],
    },
    {
      id: 'b3-dcl-02',
      category: 'conceptual',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['dcl-procedimiento'],
      prompt:
        'Una persona empuja horizontalmente una caja que desliza por el piso de un almacén. El piso tiene rozamiento y el efecto del aire es despreciable. ¿Cuántas fuerzas aparecen en el diagrama de cuerpo libre de la caja? Escriba solo el número.',
      format: 'numeric',
    },
    {
      id: 'b3-dcl-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['dcl-que-fuerzas-incluir', 'ley1-equilibrio'],
      prompt: String.raw`**Verdadero o falso:** en el diagrama de cuerpo libre de un carro que avanza con velocidad constante por una carretera recta y horizontal, hay que dibujar una fuerza neta hacia adelante, que es la que lo mantiene en movimiento. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b3-dcl-04',
      category: 'experimento',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['dcl-procedimiento', 'dcl-ejes-ecuaciones'],
      prompt: String.raw`En el simulador, fije $m = 3\,\mathrm{kg}$, $F = -20\,\mathrm{N}$ (la fuerza apunta hacia $-x$), $\theta = 0^\circ$, $\mu_s = 0.4$, $\mu_k = 0.3$ y $g = 9.8\,\mathrm{m/s^2}$. Ejecute la simulación y anote el valor de la fricción cuando el bloque desliza. Construya el DCL del bloque en movimiento (tabla con cada fuerza, su agente y su dirección) y, con la segunda ley, calcule la aceleración **con signo**, tomando $+x$ hacia la derecha. Compare con la lectura del simulador.`,
      format: 'numeric',
      unitHint: 'm/s²',
      simulation: { key: 'fuerzas', params: { m: 3, F: -20, theta: 0, muS: 0.4, muK: 0.3, g: 9.8 } },
    },
    {
      id: 'b3-dcl-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['dcl-ejes-ecuaciones', 'dcl-procedimiento'],
      prompt: String.raw`En el aeropuerto, una viajera arrastra su maleta de $18\,\mathrm{kg}$ por un piso horizontal tirando de la manija con $60\,\mathrm{N}$, en una dirección que forma $40^\circ$ sobre la horizontal. El piso ejerce sobre la maleta una fricción de $25\,\mathrm{N}$ opuesta al movimiento. Construya el DCL, elija ejes y calcule la aceleración de la maleta.`,
      format: 'numeric',
      unitHint: 'm/s²',
    },
    {
      id: 'b3-dcl-06',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['dcl-que-fuerzas-incluir'],
      prompt:
        'Un bloque recibe un empujón en la parte baja de una rampa sin rozamiento y sube por ella. Mientras sube, ya nadie lo toca. ¿Qué fuerzas aparecen en su diagrama de cuerpo libre?',
      format: 'choice',
      options: [
        'El peso y la normal de la rampa.',
        'El peso, la normal y una fuerza dirigida hacia arriba de la rampa que mantiene el movimiento.',
        'El peso, la normal y la fricción.',
        'Solo la normal, porque la rampa sostiene al bloque.',
      ],
    },
    {
      id: 'b3-dcl-07',
      category: 'grafica',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['dcl-procedimiento', 'ley2-fuerza-neta-aceleracion'],
      prompt: String.raw`Una caja de $5.0\,\mathrm{kg}$ es empujada sobre un piso horizontal por una fuerza horizontal constante de $20\,\mathrm{N}$. Además del empuje, sobre la caja actúan su peso, la normal y la fricción del piso. La gráfica muestra su velocidad. Construya el DCL y determine la magnitud de la fuerza de fricción.`,
      format: 'numeric',
      unitHint: 'N',
      figure: {
        kind: 'line',
        title: 'Velocidad de la caja',
        x: { label: 't', unit: 's' },
        y: { label: 'v', unit: 'm/s' },
        series: [
          {
            name: 'v(t)',
            points: [
              [0, 0],
              [1, 1.5],
              [2, 3],
              [3, 4.5],
              [4, 6],
            ],
          },
        ],
      },
    },
    {
      id: 'b3-dcl-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['dcl-procedimiento', 'dcl-que-fuerzas-incluir', 'dcl-ejes-ecuaciones', 'ley3-pares-accion-reaccion'],
      prompt: String.raw`Un niño empuja horizontalmente con $50\,\mathrm{N}$ la caja 1 ($6.0\,\mathrm{kg}$), que a su vez empuja a la caja 2 ($4.0\,\mathrm{kg}$), situada delante y en contacto con ella. Las cajas deslizan juntas sobre un piso horizontal que ejerce una fricción de $12\,\mathrm{N}$ sobre la caja 1 y de $8.0\,\mathrm{N}$ sobre la caja 2. (a) Describa en sendas tablas el DCL de cada caja (fuerza, agente, tipo, dirección). (b) Identifique qué fuerzas de los dos diagramas forman un par de tercera ley. (c) Elija ejes, escriba la segunda ley para cada caja y calcule la aceleración y la fuerza entre las cajas. (d) Compruebe la aceleración con el DCL del sistema formado por las dos cajas y explique por qué la fuerza entre ellas no aparece en ese diagrama.`,
      format: 'open',
    },
  ],
};
