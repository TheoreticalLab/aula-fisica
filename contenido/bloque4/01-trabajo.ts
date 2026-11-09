import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'trabajo',
  title: 'Trabajo mecánico',
  summary:
    'Una fuerza realiza trabajo cuando su punto de aplicación se desplaza y la fuerza tiene componente a lo largo del desplazamiento. El trabajo es un escalar con signo: positivo, negativo o nulo.',
  concepts: [
    { slug: 'trabajo-fuerza-constante', name: 'Trabajo de una fuerza constante: W = F d cos θ' },
    { slug: 'trabajo-signo', name: 'Signo del trabajo y trabajo nulo' },
    { slug: 'trabajo-friccion', name: 'Trabajo de la fricción' },
    { slug: 'trabajo-grafica-fx', name: 'Trabajo como área bajo la gráfica F–x' },
    { slug: 'trabajo-neto', name: 'Trabajo neto sobre un cuerpo' },
  ],
  theory: String.raw`## Un significado preciso para «trabajo»

En la vida diaria llamamos trabajo a cualquier esfuerzo: estudiar, cargar una mochila, sostener una caja. En física la palabra tiene un significado mucho más estrecho. Una fuerza **realiza trabajo** sobre un cuerpo cuando el cuerpo **se desplaza** y la fuerza tiene una **componente a lo largo de ese desplazamiento**.

Por eso, quien sostiene una caja quieta durante una hora se cansa (sus músculos consumen energía química), pero la fuerza que ejerce sobre la caja **no realiza trabajo**: la caja no se mueve. Y quien camina por un pasillo horizontal con la mochila al hombro tampoco realiza trabajo sobre ella con la fuerza vertical que la sostiene, porque esa fuerza es perpendicular al desplazamiento.

El trabajo es la forma en que una fuerza **transfiere energía** a un cuerpo o se la quita. En las próximas lecciones veremos que el trabajo total sobre un cuerpo es igual al cambio de su energía cinética.

## Trabajo de una fuerza constante

Si una fuerza constante $\vec F$ actúa sobre un cuerpo que se desplaza en línea recta una distancia $d$, y $\theta$ es el ángulo entre la fuerza y el desplazamiento, el trabajo es

$$W = F\,d\cos\theta .$$

Solo cuenta la **componente de la fuerza paralela al desplazamiento**, $F\cos\theta$. La componente perpendicular no acelera ni frena el cuerpo en la dirección del movimiento y no realiza trabajo.

La unidad SI del trabajo es el **joule**: $1\,\mathrm{J} = 1\,\mathrm{N\cdot m}$. Un joule es, más o menos, el trabajo necesario para levantar una manzana pequeña ($100\,\mathrm{g}$) un metro.

> **Cuidado.** El trabajo es un **escalar**: no tiene dirección, aunque sí tiene **signo**. No confunda el joule ($\mathrm{N\cdot m}$ de trabajo) con el momento de una fuerza, que también se expresa en $\mathrm{N\cdot m}$ pero es otra magnitud.

## El signo del trabajo

El signo lo decide $\cos\theta$:

- **$0^\circ \le \theta < 90^\circ$: trabajo positivo.** La fuerza tiene una componente en el sentido del movimiento y tiende a aumentar la rapidez. Ejemplo: el peso de un mango que cae del árbol.
- **$\theta = 90^\circ$: trabajo nulo.** La fuerza es perpendicular al desplazamiento. Ejemplos: la normal sobre una caja que desliza por el piso, el peso de una maleta que se lleva horizontalmente.
- **$90^\circ < \theta \le 180^\circ$: trabajo negativo.** La fuerza tiene una componente opuesta al movimiento y tiende a reducir la rapidez. Ejemplos: la fricción sobre un bloque que desliza; la tensión de la cuerda con la que se baja lentamente un balde a un pozo.

Un trabajo negativo no significa «trabajo pequeño»: significa que la fuerza **quita** energía al cuerpo.

## El trabajo de la fricción

Cuando un cuerpo desliza sobre una superficie, la fricción cinética $f_k = \mu_k N$ apunta siempre en sentido **opuesto** al deslizamiento, así que $\theta = 180^\circ$ y

$$W_f = -f_k\,d = -\mu_k N\,d .$$

Recuerde que la normal no siempre vale $mg$. Si se tira de una caja con una cuerda inclinada hacia arriba, la componente vertical de la tensión alivia el apoyo, la normal disminuye y el trabajo de la fricción también. Si se empuja la caja hacia abajo y adelante, ocurre lo contrario.

## Trabajo neto

Sobre un cuerpo suelen actuar varias fuerzas. El **trabajo neto** (o total) es la suma algebraica, con signos, de los trabajos de todas ellas:

$$W_{neto} = W_1 + W_2 + \dots$$

Da lo mismo calcularlo así o multiplicando la fuerza neta por el desplazamiento (si las fuerzas son constantes y el movimiento es rectilíneo). Para una caja empujada por el piso, la normal y el peso no hacen trabajo, la fuerza aplicada hace trabajo positivo y la fricción, negativo.

## El trabajo como área bajo la gráfica F–x

Si la fuerza paralela al desplazamiento cambia con la posición, la fórmula $F\,d\cos\theta$ ya no sirve tal cual. En su lugar, se dibuja la componente de la fuerza a lo largo del movimiento, $F_x$, frente a la posición $x$. El trabajo entre dos posiciones es el **área entre la gráfica y el eje $x$**:

- Para una fuerza constante, el área es un **rectángulo** de base $d$ y altura $F$: se recupera $W = F\,d$.
- Si la fuerza crece o decrece linealmente, el área es un **triángulo** o un **trapecio**.
- Las áreas **bajo el eje** (fuerza negativa) cuentan como trabajo negativo.

Esta idea es la misma que usamos en cinemática, donde el área bajo la gráfica $v$–$t$ era el desplazamiento.

## Errores frecuentes y límites del modelo

> **Error frecuente.** Usar el ángulo equivocado. En $W = F\,d\cos\theta$, $\theta$ es el ángulo **entre la fuerza y el desplazamiento**, no entre la fuerza y la vertical ni entre la superficie y el suelo.

> **Error frecuente.** Olvidar el signo del trabajo de la fricción o del peso cuando el cuerpo sube.

- El trabajo depende del **sistema de referencia**: medido desde una guagua en marcha, el desplazamiento de un pasajero es distinto que medido desde la acera. Trabajamos siempre en un sistema fijo al suelo.
- Tratamos los cuerpos como partículas: todas las partes se desplazan lo mismo. En cuerpos que se deforman o ruedan, el cálculo requiere más cuidado.`,
  formulas: [
    {
      name: 'Trabajo de una fuerza constante',
      latex: String.raw`W = F\,d\cos\theta`,
      description: 'Trabajo realizado por una fuerza constante cuando el cuerpo se desplaza en línea recta.',
      variables: [
        { symbol: String.raw`W`, meaning: 'Trabajo realizado por la fuerza', unit: 'J' },
        { symbol: String.raw`F`, meaning: 'Módulo de la fuerza', unit: 'N' },
        { symbol: String.raw`d`, meaning: 'Módulo del desplazamiento', unit: 'm' },
        { symbol: String.raw`\theta`, meaning: 'Ángulo entre la fuerza y el desplazamiento', unit: '° o rad' },
      ],
      notes: 'El signo de W lo da cos θ: positivo si θ < 90°, nulo si θ = 90°, negativo si θ > 90°.',
    },
    {
      name: 'Trabajo de la fricción cinética',
      latex: String.raw`W_f = -\mu_k N\,d`,
      description: 'La fricción cinética se opone al deslizamiento, así que su trabajo es negativo.',
      variables: [
        { symbol: String.raw`\mu_k`, meaning: 'Coeficiente de fricción cinética', unit: '— (adimensional)' },
        { symbol: String.raw`N`, meaning: 'Fuerza normal', unit: 'N' },
        { symbol: String.raw`d`, meaning: 'Distancia deslizada', unit: 'm' },
      ],
      notes: 'La normal solo vale mg en una superficie horizontal sin otras fuerzas verticales.',
    },
    {
      name: 'Trabajo neto',
      latex: String.raw`W_{neto} = \sum W_i = F_{neta}\,d`,
      description: 'Suma algebraica de los trabajos de todas las fuerzas; para fuerzas constantes y movimiento rectilíneo es la fuerza neta (a lo largo del movimiento) por la distancia.',
      variables: [
        { symbol: String.raw`W_i`, meaning: 'Trabajo de cada fuerza, con su signo', unit: 'J' },
        { symbol: String.raw`F_{neta}`, meaning: 'Componente de la fuerza neta a lo largo del desplazamiento', unit: 'N' },
      ],
    },
  ],
  examples: [
    {
      title: 'Tirar de una maleta con ruedas',
      statement: String.raw`En el aeropuerto, una viajera tira de su maleta con una fuerza de $35\,\mathrm{N}$ a lo largo del asa, que forma $50^\circ$ con el piso horizontal. Recorre $60\,\mathrm{m}$ en línea recta. ¿Qué trabajo realiza esa fuerza?`,
      steps: [
        String.raw`El desplazamiento es horizontal y la fuerza forma $\theta = 50^\circ$ con él.`,
        String.raw`$W = F\,d\cos\theta = (35\,\mathrm{N})(60\,\mathrm{m})\cos 50^\circ = 2100\,\mathrm{N\cdot m} \times 0.643 = 1350\,\mathrm{J}$.`,
      ],
      result: String.raw`$W \approx 1.35\times10^{3}\,\mathrm{J}$.`,
      interpretation:
        'Solo la componente horizontal de la fuerza (unos 22.5 N) realiza trabajo. La componente vertical alivia el peso que soportan las ruedas, pero no transfiere energía a lo largo del camino.',
    },
    {
      title: 'Trabajo neto sobre una caja',
      statement: String.raw`Un empleado empuja horizontalmente una caja de $20\,\mathrm{kg}$ con $90\,\mathrm{N}$ a lo largo de $5.0\,\mathrm{m}$ de un piso con $\mu_k = 0.30$. Calcule el trabajo de cada fuerza y el trabajo neto.`,
      steps: [
        String.raw`Fuerzas: empuje $F$, peso $mg$, normal $N$ y fricción $f_k$. El piso es horizontal y no hay otras fuerzas verticales: $N = mg = (20)(9.8) = 196\,\mathrm{N}$.`,
        String.raw`Empuje (paralelo al desplazamiento): $W_F = (90\,\mathrm{N})(5.0\,\mathrm{m}) = 450\,\mathrm{J}$.`,
        String.raw`Fricción: $f_k = \mu_k N = 0.30 \times 196\,\mathrm{N} = 58.8\,\mathrm{N}$ y $W_f = -(58.8\,\mathrm{N})(5.0\,\mathrm{m}) = -294\,\mathrm{J}$.`,
        String.raw`Peso y normal son perpendiculares al desplazamiento: $W_{mg} = W_N = 0$.`,
        String.raw`$W_{neto} = 450 - 294 + 0 + 0 = 156\,\mathrm{J}$. Comprobación: $F_{neta}\,d = (90 - 58.8)(5.0) = 156\,\mathrm{J}$ ✓.`,
      ],
      result: String.raw`$W_F = 450\,\mathrm{J}$, $W_f = -294\,\mathrm{J}$, $W_{mg} = W_N = 0$ y $W_{neto} = 156\,\mathrm{J}$.`,
      interpretation: 'El trabajo neto es positivo: la caja gana energía cinética. Más de la mitad del trabajo del empleado se la «come» la fricción.',
    },
    {
      title: 'Área bajo una gráfica F–x',
      statement: String.raw`La fuerza horizontal con que una grúa arrastra un contenedor vale $2000\,\mathrm{N}$ durante los primeros $3.0\,\mathrm{m}$ y luego disminuye linealmente hasta cero en $x = 7.0\,\mathrm{m}$. ¿Qué trabajo realiza en total?`,
      steps: [
        String.raw`De $0$ a $3.0\,\mathrm{m}$ el área es un rectángulo: $(2000\,\mathrm{N})(3.0\,\mathrm{m}) = 6000\,\mathrm{J}$.`,
        String.raw`De $3.0$ a $7.0\,\mathrm{m}$ es un triángulo de base $4.0\,\mathrm{m}$ y altura $2000\,\mathrm{N}$: $\tfrac12(4.0)(2000) = 4000\,\mathrm{J}$.`,
        String.raw`$W = 6000 + 4000 = 10\,000\,\mathrm{J}$.`,
      ],
      result: String.raw`$W = 1.0\times10^{4}\,\mathrm{J}$.`,
      interpretation: 'Si la fuerza se hubiera mantenido en 2000 N durante los 7 m, el trabajo sería 14 000 J; el valor obtenido es menor, como debe ser.',
    },
  ],
  simulation: {
    key: 'trabajo-energia',
    params: { m: 2, F: 20, phi: 30, muK: 0.2, d: 5, v0: 0, g: 9.8 },
    guide: String.raw`1. Con los valores iniciales, pulse **Iniciar** y observe las barras de trabajo de cada fuerza. ¿Cuáles son positivas, cuáles negativas y cuáles nulas?
2. Compruebe con la lectura de la normal que $N = mg - F\sin\varphi$ y calcule a mano el trabajo de la fricción, $-\mu_k N d$. Compárelo con la barra.
3. Cambie $\varphi$ a $0^\circ$ y luego a $-30^\circ$ (empuje hacia abajo). ¿Qué ocurre con la normal y con el trabajo de la fricción? ¿Y con el trabajo de la fuerza aplicada?
4. Ponga $\mu_k = 0$. ¿Qué fuerzas hacen trabajo ahora? Compare el trabajo neto con el trabajo de $F$.
5. Busque un valor de $F$ para el que el bloque, partiendo del reposo, no se mueva. ¿Cuánto trabajo hace cada fuerza en ese caso?`,
  },
  exercises: [
    {
      id: 'b4-trab-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['trabajo-fuerza-constante'],
      prompt: String.raw`En el supermercado, una persona empuja un carrito con una fuerza de $40\,\mathrm{N}$ dirigida a lo largo del manubrio, que forma $30^\circ$ por debajo de la horizontal. El carrito recorre $12\,\mathrm{m}$ en un pasillo recto y horizontal. ¿Qué trabajo realiza esa fuerza sobre el carrito?`,
      format: 'numeric',
      unitHint: 'J',
    },
    {
      id: 'b4-trab-02',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['trabajo-signo'],
      prompt: String.raw`Un obrero baja un saco de cemento desde una azotea con una cuerda, **a velocidad constante**. Considere el tramo en que el saco desciende. ¿Qué afirmación sobre los trabajos que realizan el peso del saco y la tensión de la cuerda es correcta?`,
      format: 'choice',
      options: [
        'El peso realiza trabajo positivo y la tensión, trabajo negativo.',
        'Ambos realizan trabajo positivo, porque el saco se mueve.',
        'Ninguno realiza trabajo, porque la velocidad es constante.',
        'El peso realiza trabajo negativo y la tensión, trabajo positivo.',
      ],
    },
    {
      id: 'b4-trab-03',
      category: 'grafica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['trabajo-grafica-fx'],
      prompt: String.raw`La gráfica muestra la componente horizontal de la fuerza que ejerce un remolcador sobre un bote, en función de la posición del bote. ¿Qué trabajo realiza esa fuerza entre $x = 0$ y $x = 8\,\mathrm{m}$?`,
      format: 'numeric',
      unitHint: 'J',
      figure: {
        kind: 'line',
        title: 'Fuerza frente a posición',
        x: { label: 'x', unit: 'm' },
        y: { label: 'F', unit: 'N' },
        series: [
          {
            name: 'F(x)',
            points: [
              [0, 10],
              [2, 10],
              [4, 10],
              [6, 5],
              [8, 0],
            ],
          },
        ],
      },
    },
    {
      id: 'b4-trab-04',
      category: 'vf_justificacion',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['trabajo-signo', 'trabajo-fuerza-constante'],
      prompt: String.raw`**Verdadero o falso:** una estudiante camina $50\,\mathrm{m}$ por un pasillo horizontal, con velocidad constante, llevando su mochila en la mano. La fuerza vertical con que sostiene la mochila no realiza trabajo sobre ella. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b4-trab-05',
      category: 'experimento',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['trabajo-friccion', 'trabajo-neto'],
      prompt: String.raw`En el simulador, fije $m = 4\,\mathrm{kg}$, $F = 30\,\mathrm{N}$, $\varphi = 20^\circ$ (la fuerza tira hacia arriba y adelante), $\mu_k = 0.25$, $d = 6\,\mathrm{m}$, $v_0 = 0$ y $g = 9.8\,\mathrm{m/s^2}$. Antes de ejecutar, calcule el **trabajo que realiza la fricción** sobre el bloque en los $6\,\mathrm{m}$ (con su signo). Luego ejecute la simulación y compruebe su resultado con las lecturas de la normal y de la fricción, y con la barra correspondiente.`,
      format: 'numeric',
      unitHint: 'J',
      simulation: { key: 'trabajo-energia', params: { m: 4, F: 30, phi: 20, muK: 0.25, d: 6, v0: 0, g: 9.8 } },
    },
    {
      id: 'b4-trab-06',
      category: 'error',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['trabajo-friccion'],
      prompt: String.raw`Un estudiante resolvió así este problema: *«Se arrastra una caja de $10\,\mathrm{kg}$ por un piso horizontal tirando de una cuerda con $50\,\mathrm{N}$ a $37^\circ$ sobre la horizontal. Si $\mu_k = 0.30$, ¿qué trabajo realiza la fricción en $8.0\,\mathrm{m}$?»*

1. Fuerzas verticales en equilibrio: $N + F\sin 37^\circ = mg$.
2. Normal: $N = mg - F\sin 37^\circ = 98 - 30.1 = 67.9\,\mathrm{N}$.
3. Fricción: $f_k = \mu_k N = 0.30 \times 67.9 = 20.4\,\mathrm{N}$.
4. Trabajo: $W_f = f_k\,d = 20.4 \times 8.0 = +163\,\mathrm{J}$.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'No hay ningún error'],
    },
    {
      id: 'b4-trab-07',
      category: 'numerica',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['trabajo-fuerza-constante', 'trabajo-signo'],
      prompt: String.raw`Un mango de $0.50\,\mathrm{kg}$ se desprende de una rama y cae verticalmente $3.0\,\mathrm{m}$ hasta el suelo. ¿Qué trabajo realiza el peso del mango durante la caída? Incluya el signo.`,
      format: 'numeric',
      unitHint: 'J',
    },
    {
      id: 'b4-trab-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['trabajo-neto', 'trabajo-friccion', 'trabajo-signo'],
      prompt: String.raw`Un trabajador arrastra un baúl de $30\,\mathrm{kg}$ una distancia de $12\,\mathrm{m}$ por un piso horizontal, tirando de una cuerda con una fuerza de $120\,\mathrm{N}$ que forma $25^\circ$ sobre la horizontal. El coeficiente de fricción cinética es $0.35$.

(a) Dibuje el diagrama de cuerpo libre del baúl.
(b) Calcule la normal y la fuerza de fricción.
(c) Calcule el trabajo de cada una de las cuatro fuerzas y el trabajo neto.
(d) Si el trabajador tirara horizontalmente con la misma fuerza, ¿el trabajo neto sería mayor o menor? Justifique con cálculos.`,
      format: 'open',
    },
  ],
};
