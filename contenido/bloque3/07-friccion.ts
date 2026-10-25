import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'friccion',
  title: 'Fuerza de fricción',
  summary:
    'La fricción es la componente de la fuerza de contacto paralela a la superficie. En reposo se ajusta hasta un valor máximo μs·N; cuando hay deslizamiento vale μk·N y se opone al movimiento relativo.',
  concepts: [
    { slug: 'friccion-estatica', name: 'Fricción estática: se ajusta hasta μs·N' },
    { slug: 'friccion-cinetica', name: 'Fricción cinética: f = μk·N' },
    { slug: 'friccion-coeficientes', name: 'Coeficientes de fricción y su medida' },
  ],
  theory: String.raw`## Una fuerza paralela a la superficie

En la lección anterior vimos que una superficie empuja a lo que se apoya en ella con una fuerza perpendicular, la normal. Pero la fuerza de contacto también puede tener una componente **paralela** a la superficie: la **fuerza de fricción** (o de rozamiento) $\vec f$. Es la que impide que una caja pesada se mueva cuando la empujamos suavemente, la que frena un disco de hockey sobre el hielo y la que nos permite caminar sin resbalar.

Su origen es microscópico. Aun las superficies que parecen lisas tienen rugosidades, y en los pocos puntos donde se tocan de verdad se forman uniones entre los átomos de ambos materiales. Para que una superficie deslice sobre otra hay que romper continuamente esas uniones.

Distinguimos dos situaciones: las superficies **no deslizan** una respecto de la otra (fricción estática) o **sí deslizan** (fricción cinética).

## Fricción estática: una fuerza que se ajusta

Empuje horizontalmente una caja pesada que está en el piso. Si empuja con $10\,\mathrm{N}$ y la caja no se mueve, la fricción vale $10\,\mathrm{N}$ y apunta en sentido contrario; si empuja con $40\,\mathrm{N}$ y sigue quieta, la fricción vale $40\,\mathrm{N}$. La fricción estática **toma el valor que haga falta** para mantener las superficies sin deslizar, igual que la normal toma el valor necesario para que la caja no atraviese el suelo.

Pero tiene un límite. Experimentalmente, la fricción estática máxima es proporcional a la normal:

$$f_s \le \mu_s\,N .$$

El número adimensional $\mu_s$ es el **coeficiente de fricción estática** y depende de los dos materiales en contacto. Mientras la fuerza que tiende a hacer deslizar el cuerpo no supere $\mu_s N$, el cuerpo permanece en reposo.

> **Error frecuente.** Escribir siempre $f_s = \mu_s N$. Esa igualdad solo se cumple en el instante en que el cuerpo está **a punto** de deslizar. En los demás casos, el valor de $f_s$ se obtiene de la segunda ley ($\sum F = 0$ si está en reposo), y $\mu_s N$ solo sirve para comprobar que ese valor es posible.

## Fricción cinética

Cuando las superficies deslizan, la fricción es aproximadamente constante, proporcional a la normal y **opuesta a la velocidad relativa** de deslizamiento:

$$f_k = \mu_k\,N .$$

$\mu_k$ es el **coeficiente de fricción cinética**. Para casi todos los pares de materiales, $\mu_k < \mu_s$: cuesta más **arrancar** un objeto que **mantenerlo** en movimiento. Por eso, al empujar un mueble, hay que hacer un esfuerzo grande para que empiece a moverse y luego basta con menos fuerza.

Valores orientativos (dependen mucho del estado de las superficies):

- Caucho sobre asfalto seco: $\mu_s \approx 1.0$, $\mu_k \approx 0.8$. Mojado: $\mu_k \approx 0.5$ o menos.
- Madera sobre madera: $\mu_s \approx 0.5$, $\mu_k \approx 0.3$.
- Acero sobre acero (seco): $\mu_s \approx 0.7$, $\mu_k \approx 0.6$.
- Hielo sobre hielo: $\mu_s \approx 0.1$, $\mu_k \approx 0.03$.

## La gráfica fricción frente a fuerza aplicada

Imagine que tira horizontalmente de un bloque con una fuerza $F$ que aumenta poco a poco, y representa la fricción frente a $F$:

1. Mientras el bloque está en reposo, $f_s = F$: la gráfica es una **recta de pendiente 1** que sale del origen.
2. Cuando $F$ alcanza $\mu_s N$, el bloque empieza a deslizar.
3. La fricción **cae** bruscamente al valor $\mu_k N$ y queda **constante**, aunque $F$ siga aumentando. A partir de ahí, el exceso $F - \mu_k N$ es la fuerza neta que acelera el bloque: $a = (F - \mu_k N)/m$.

La altura del pico mide $\mu_s N$ y la altura de la meseta, $\mu_k N$. Si se conoce la normal, de esa gráfica se obtienen ambos coeficientes. Es justamente el experimento que se hace en el laboratorio con un dinamómetro.

## ¿De qué depende la fricción?

- **De la normal, no del peso.** Si empuja una caja hacia abajo, la normal y la fricción aumentan. Si tira de ella con una cuerda inclinada hacia arriba, la normal disminuye y la fricción también. Solo en una superficie horizontal sin otras fuerzas verticales coincide $N$ con $mg$.
- **De los materiales y del estado de las superficies** (secas, mojadas, aceitadas), a través de $\mu_s$ y $\mu_k$.
- **Casi no depende del área aparente de contacto.** Un ladrillo apoyado de canto o de plano necesita la misma fuerza para deslizar. Con más área, el peso se reparte sobre más puntos y cada punto aprieta menos; el área de contacto *real* resulta casi la misma.
- **Casi no depende de la rapidez** de deslizamiento, al menos para rapideces moderadas.

## La fricción no siempre se opone al movimiento

La fricción se opone al **deslizamiento relativo** entre las superficies, no necesariamente al movimiento del cuerpo. Al caminar, su zapato empuja el suelo hacia atrás, y la fricción estática del suelo sobre el zapato apunta **hacia adelante**: es la fuerza que lo impulsa. Del mismo modo, una guagua que arranca acelera gracias a la fricción estática del pavimento sobre las ruedas, dirigida hacia adelante. Si el suelo está muy liso (hielo, aceite), no hay fricción suficiente y las ruedas patinan.

## Límites del modelo

Las leyes $f_s \le \mu_s N$ y $f_k = \mu_k N$ son **empíricas** y aproximadas (modelo de Coulomb). Los coeficientes varían con la temperatura, la humedad, el pulido o la presencia de lubricantes, y no son propiedades exactas de un material. A rapideces altas, o con superficies muy blandas o muy pulidas, el modelo deja de ser preciso. Aun así, describe bien la mayoría de las situaciones cotidianas.`,
  formulas: [
    {
      name: 'Fricción estática',
      latex: String.raw`0 \le f_s \le \mu_s\,N`,
      description:
        'Mientras no hay deslizamiento, la fricción estática toma el valor necesario para mantener el reposo relativo, hasta un máximo μs·N.',
      variables: [
        { symbol: String.raw`f_s`, meaning: 'Módulo de la fricción estática', unit: 'N' },
        { symbol: String.raw`\mu_s`, meaning: 'Coeficiente de fricción estática', unit: '— (adimensional)' },
        { symbol: String.raw`N`, meaning: 'Fuerza normal', unit: 'N' },
      ],
      notes: 'El valor de f_s se calcula con la segunda ley; la desigualdad solo dice si ese valor es posible.',
    },
    {
      name: 'Fricción cinética',
      latex: String.raw`f_k = \mu_k\,N`,
      description: 'Fricción entre superficies que deslizan. Se opone a la velocidad relativa de deslizamiento.',
      variables: [
        { symbol: String.raw`f_k`, meaning: 'Módulo de la fricción cinética', unit: 'N' },
        { symbol: String.raw`\mu_k`, meaning: 'Coeficiente de fricción cinética (normalmente μk < μs)', unit: '— (adimensional)' },
      ],
    },
    {
      name: 'Fuerza horizontal mínima para iniciar el movimiento',
      latex: String.raw`F_{min} = \mu_s\,N = \mu_s\,m\,g`,
      description: 'Para un cuerpo en reposo sobre una superficie horizontal, empujado con una fuerza horizontal y sin otras fuerzas verticales.',
      variables: [{ symbol: String.raw`F_{min}`, meaning: 'Fuerza que pone el cuerpo a punto de deslizar', unit: 'N' }],
    },
    {
      name: 'Aceleración con fricción cinética (horizontal)',
      latex: String.raw`a = \frac{F - \mu_k\,N}{m}`,
      description: 'Cuerpo que desliza en el sentido de una fuerza horizontal F, sobre una superficie horizontal.',
      variables: [
        { symbol: String.raw`a`, meaning: 'Aceleración en el sentido de F', unit: 'm/s²' },
        { symbol: String.raw`F`, meaning: 'Fuerza aplicada horizontal', unit: 'N' },
        { symbol: String.raw`m`, meaning: 'Masa', unit: 'kg' },
      ],
      notes: 'Solo vale si el cuerpo ya desliza (o si F > μs·N, de modo que empieza a deslizar).',
    },
  ],
  examples: [
    {
      title: 'Empujar una caja: ¿se mueve o no?',
      statement: String.raw`Una caja de $30\,\mathrm{kg}$ reposa sobre un piso horizontal; $\mu_s = 0.50$ y $\mu_k = 0.35$. Halle la fricción si se empuja horizontalmente con (a) $100\,\mathrm{N}$ y (b) $160\,\mathrm{N}$. En el caso (b), calcule la aceleración.`,
      steps: [
        String.raw`Verticalmente no hay aceleración ni otras fuerzas: $N = mg = (30\,\mathrm{kg})(9.8\,\mathrm{m/s^2}) = 294\,\mathrm{N}$.`,
        String.raw`Fricción estática máxima: $\mu_s N = 0.50 \times 294\,\mathrm{N} = 147\,\mathrm{N}$.`,
        String.raw`(a) $100\,\mathrm{N} < 147\,\mathrm{N}$: la caja no se mueve. Por la segunda ley, $\sum F_x = 0$, así que $f_s = 100\,\mathrm{N}$, opuesta al empuje (no $147\,\mathrm{N}$).`,
        String.raw`(b) $160\,\mathrm{N} > 147\,\mathrm{N}$: la caja desliza. La fricción es cinética: $f_k = \mu_k N = 0.35 \times 294\,\mathrm{N} = 102.9\,\mathrm{N}$.`,
        String.raw`Aceleración: $a = \dfrac{F - f_k}{m} = \dfrac{160\,\mathrm{N} - 102.9\,\mathrm{N}}{30\,\mathrm{kg}} = 1.90\,\mathrm{m/s^2}$.`,
      ],
      result: String.raw`(a) $f_s = 100\,\mathrm{N}$ y la caja sigue en reposo. (b) $f_k \approx 103\,\mathrm{N}$ y $a \approx 1.9\,\mathrm{m/s^2}$.`,
      interpretation:
        'Primero se comprueba si hay deslizamiento comparando con μs·N; solo después se elige la fórmula de la fricción. Una vez en marcha, mantener la caja a velocidad constante requeriría solo 103 N.',
    },
    {
      title: 'Medir μk empujando a velocidad constante',
      statement: String.raw`Para mover un refrigerador de $40\,\mathrm{kg}$ por el piso de la cocina con velocidad constante hay que empujarlo horizontalmente con $120\,\mathrm{N}$. ¿Cuál es el coeficiente de fricción cinética?`,
      steps: [
        String.raw`Velocidad constante significa aceleración nula: $\sum F_x = 0$, así que $f_k = F = 120\,\mathrm{N}$.`,
        String.raw`Normal: $N = mg = (40\,\mathrm{kg})(9.8\,\mathrm{m/s^2}) = 392\,\mathrm{N}$.`,
        String.raw`$\mu_k = \dfrac{f_k}{N} = \dfrac{120\,\mathrm{N}}{392\,\mathrm{N}} = 0.306$.`,
      ],
      result: String.raw`$\mu_k \approx 0.31$ (adimensional).`,
      interpretation:
        'Un valor entre 0.2 y 0.5 es razonable para un electrodoméstico sobre baldosa. Observe que el coeficiente no tiene unidades: es un cociente entre dos fuerzas.',
    },
    {
      title: 'Coeficientes a partir de una gráfica',
      statement: String.raw`Se tira de un bloque de madera de $5.0\,\mathrm{kg}$ con una fuerza horizontal creciente. La gráfica de la fricción frente a la fuerza aplicada sube como una recta de pendiente 1 hasta $24.5\,\mathrm{N}$, cae a $14.7\,\mathrm{N}$ y luego se mantiene constante. Halle $\mu_s$ y $\mu_k$.`,
      steps: [
        String.raw`Normal: $N = mg = (5.0\,\mathrm{kg})(9.8\,\mathrm{m/s^2}) = 49\,\mathrm{N}$.`,
        String.raw`El pico es la fricción estática máxima: $\mu_s = \dfrac{24.5\,\mathrm{N}}{49\,\mathrm{N}} = 0.50$.`,
        String.raw`La meseta es la fricción cinética: $\mu_k = \dfrac{14.7\,\mathrm{N}}{49\,\mathrm{N}} = 0.30$.`,
      ],
      result: String.raw`$\mu_s = 0.50$ y $\mu_k = 0.30$.`,
      interpretation: 'Se cumple μk < μs, como en casi todos los pares de materiales. Los valores son típicos de madera sobre madera.',
    },
  ],
  simulation: {
    key: 'fuerzas',
    params: { m: 2, F: 0, theta: 0, muS: 0.4, muK: 0.3, g: 9.8 },
    guide: String.raw`1. Con $\theta = 0$, $m = 2\,\mathrm{kg}$, $\mu_s = 0.4$ y $\mu_k = 0.3$, calcule $\mu_s N$. Luego ponga $F = 5\,\mathrm{N}$ y ejecute. ¿Se mueve el bloque? ¿Qué tipo de fricción indica el simulador y cuánto vale?
2. Repita con $F = 6$ y $7\,\mathrm{N}$. Anote la fricción en cada caso. ¿Qué relación hay entre la fricción y $F$ mientras el bloque está en reposo?
3. Ponga $F = 8\,\mathrm{N}$. Anote el tipo y el valor de la fricción, y la aceleración. Compruebe que $a = (F - \mu_k N)/m$.
4. Con los datos de los pasos 1 a 3 (y alguno más, por ejemplo $F = 15\,\mathrm{N}$), dibuje a mano la gráfica de la fricción frente a $F$. Señale el pico y la meseta.
5. Con $F = 8\,\mathrm{N}$, baje $\mu_k$ a $0.1$ sin cambiar $\mu_s$. ¿Cambia la fuerza necesaria para arrancar? ¿Y la aceleración?
6. Ponga $F = -10\,\mathrm{N}$. ¿Hacia dónde apunta ahora la fricción? Explique por qué.`,
  },
  exercises: [
    {
      id: 'b3-fric-01',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['friccion-estatica'],
      prompt: String.raw`Una caja de $20\,\mathrm{kg}$ está en reposo sobre un piso horizontal, con $\mu_s = 0.45$. Usted la empuja horizontalmente con $40\,\mathrm{N}$ y la caja no se mueve. ¿Cuánto vale la fuerza de fricción sobre la caja?`,
      format: 'choice',
      options: [
        String.raw`$0\,\mathrm{N}$, porque la caja no se mueve.`,
        String.raw`$40\,\mathrm{N}$, en sentido contrario al empuje.`,
        String.raw`$88.2\,\mathrm{N}$, en sentido contrario al empuje.`,
        String.raw`$128.2\,\mathrm{N}$, en sentido contrario al empuje.`,
      ],
    },
    {
      id: 'b3-fric-02',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['friccion-estatica', 'friccion-coeficientes'],
      prompt: String.raw`Un escritorio de $25\,\mathrm{kg}$ está sobre un piso horizontal; el coeficiente de fricción estática entre ambos es $0.40$. ¿Qué fuerza horizontal mínima hay que aplicar para que empiece a moverse?`,
      format: 'numeric',
      unitHint: 'N',
    },
    {
      id: 'b3-fric-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['friccion-cinetica'],
      prompt: String.raw`**Verdadero o falso:** un ladrillo que desliza apoyado sobre su cara más grande sufre una fricción cinética mucho mayor que si desliza apoyado sobre su cara más pequeña, porque hay más superficie en contacto. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b3-fric-04',
      category: 'grafica',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['friccion-coeficientes', 'friccion-cinetica'],
      prompt: String.raw`Se tira de un bloque de $5.0\,\mathrm{kg}$, apoyado sobre una mesa horizontal, con una fuerza horizontal que aumenta poco a poco. La gráfica muestra la fuerza de fricción frente a la fuerza aplicada. ¿Cuál es el coeficiente de fricción **cinética** entre el bloque y la mesa?`,
      format: 'numeric',
      figure: {
        kind: 'line',
        title: 'Fricción frente a fuerza aplicada',
        x: { label: 'F aplicada', unit: 'N' },
        y: { label: 'f', unit: 'N' },
        series: [
          {
            name: 'f(F)',
            points: [
              [0, 0],
              [5, 5],
              [10, 10],
              [15, 15],
              [20, 20],
              [24.5, 24.5],
              [25, 14.7],
              [30, 14.7],
              [35, 14.7],
              [40, 14.7],
            ],
          },
        ],
      },
    },
    {
      id: 'b3-fric-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['friccion-cinetica', 'peso-normal-fuerza-normal'],
      prompt: String.raw`Un trabajador empuja una caja de $20\,\mathrm{kg}$ por un piso horizontal mediante una barra que forma $30^\circ$ **por debajo** de la horizontal (empuja hacia adelante y hacia abajo). El coeficiente de fricción cinética es $0.40$. ¿Con qué fuerza debe empujar a lo largo de la barra para que la caja se mueva con velocidad constante?`,
      format: 'numeric',
      unitHint: 'N',
    },
    {
      id: 'b3-fric-06',
      category: 'experimento',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['friccion-estatica'],
      prompt: String.raw`En el simulador, fije $m = 3\,\mathrm{kg}$, $\theta = 0$, $\mu_s = 0.5$, $\mu_k = 0.35$, $g = 9.8\,\mathrm{m/s^2}$ y $F = 14\,\mathrm{N}$. Ejecute la simulación y observe el tipo de fricción que actúa. ¿Cuál es el **módulo** de la fuerza de fricción sobre el bloque? (Después, si quiere, pruebe con $F = 15\,\mathrm{N}$ y compare.)`,
      format: 'numeric',
      unitHint: 'N',
      simulation: { key: 'fuerzas', params: { m: 3, F: 14, theta: 0, muS: 0.5, muK: 0.35, g: 9.8 } },
    },
    {
      id: 'b3-fric-07',
      category: 'error',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['friccion-estatica'],
      prompt: String.raw`Un estudiante resolvió así este problema: *«Una caja de $10\,\mathrm{kg}$ está en reposo sobre un piso horizontal, con $\mu_s = 0.50$ y $\mu_k = 0.40$. Se la empuja horizontalmente con $30\,\mathrm{N}$. ¿Cuánto vale la fricción?»*

1. La normal es $N = mg = (10)(9.8) = 98\,\mathrm{N}$.
2. La fricción estática máxima es $\mu_s N = (0.50)(98) = 49\,\mathrm{N}$.
3. Como $30\,\mathrm{N} < 49\,\mathrm{N}$, la caja no se mueve.
4. Por lo tanto, la fricción vale $f = \mu_s N = 49\,\mathrm{N}$.
5. La fuerza neta es $30 - 49 = -19\,\mathrm{N}$, dirigida en sentido contrario al empuje.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'Paso 5', 'No hay ningún error'],
    },
    {
      id: 'b3-fric-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['friccion-coeficientes', 'friccion-estatica', 'friccion-cinetica'],
      prompt: String.raw`En el laboratorio, una estudiante tira horizontalmente con un dinamómetro de un bloque de madera de $0.80\,\mathrm{kg}$ apoyado sobre una tabla horizontal. Aumenta la fuerza poco a poco: la lectura máxima, justo antes de que el bloque empiece a deslizar, es $3.1\,\mathrm{N}$. Después, para mantenerlo deslizando con velocidad constante, el dinamómetro marca $2.2\,\mathrm{N}$.

(a) Calcule $\mu_s$ y $\mu_k$.
(b) Dibuje cualitativamente la gráfica de la fricción frente a la fuerza aplicada durante el experimento y explique cada tramo.
(c) La estudiante coloca el bloque sobre otra cara, cuya área es el doble. ¿Qué lecturas espera? Justifique.
(d) Coloca ahora una pesa de $0.40\,\mathrm{kg}$ encima del bloque. Prediga las dos lecturas del dinamómetro.
(e) Mencione dos fuentes de error experimental en este procedimiento.`,
      format: 'open',
    },
  ],
};
