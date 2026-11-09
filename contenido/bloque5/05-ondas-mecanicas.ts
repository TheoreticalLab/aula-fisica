import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'ondas-mecanicas',
  title: 'Ondas mecánicas',
  summary:
    'Una perturbación que se propaga por un medio material: ondas transversales y longitudinales, pulsos y ondas periódicas, y por qué una onda transporta energía pero no materia.',
  concepts: [
    { slug: 'ondas-mecanicas-concepto', name: 'Onda mecánica, medio y pulso' },
    { slug: 'ondas-mecanicas-transversales-longitudinales', name: 'Ondas transversales y longitudinales' },
    { slug: 'ondas-mecanicas-transporte-energia', name: 'Transporte de energía sin transporte de materia' },
  ],
  theory: String.raw`## ¿Qué es una onda?

Si se sacude un extremo de una soga tensa, se forma una «joroba» que viaja a lo largo de la soga. Si se tira una piedra a un estanque, se forman círculos que se alejan del punto de impacto. Si un tambor suena, el aire transmite la vibración hasta los oídos. En los tres casos se propaga una **perturbación**: un cambio en el estado de un medio (posición de la soga, altura del agua, presión del aire) que **viaja de un lugar a otro**.

Una **onda mecánica** es una perturbación que se propaga a través de un **medio material** (sólido, líquido o gas) gracias a que las partes del medio están unidas entre sí: cada trozo de soga tira del siguiente, cada capa de aire empuja a la vecina. Por eso las ondas mecánicas **no se propagan en el vacío**. (La luz y las ondas de radio son ondas electromagnéticas, que no necesitan medio; no las estudiamos aquí.)

Distinguimos dos situaciones:

- Un **pulso**: una perturbación única y breve, como una sola sacudida de la soga.
- Una **onda periódica**: la fuente oscila de forma repetida y produce una sucesión de pulsos iguales, como cuando se mueve la mano arriba y abajo sin parar. Cada punto del medio realiza entonces una oscilación, a menudo un MAS.

## Transversales y longitudinales

Según la dirección en que se mueven las partículas del medio respecto a la dirección en que avanza la onda:

- **Onda transversal:** las partículas oscilan **perpendicularmente** a la dirección de propagación. Ejemplo: la soga que se agita arriba y abajo mientras la onda avanza horizontalmente; las cuerdas de una guitarra; las ondas sísmicas S.
- **Onda longitudinal:** las partículas oscilan **en la misma dirección** en que se propaga la onda. Forman zonas apretadas (**compresiones**) y zonas separadas (**rarefacciones** o enrarecimientos) que avanzan. Ejemplo: un resorte largo (un *slinky*) al que se empuja y tira por un extremo; el **sonido** en el aire; las ondas sísmicas P.

Algunas ondas son mixtas. En las olas del mar, el agua de la superficie describe aproximadamente círculos: sube y baja, y a la vez va un poco adelante y atrás.

Las ondas transversales necesitan que el medio resista a ser «cizallado», cosa que hacen los sólidos y las superficies de los líquidos, pero no el interior de un fluido. Por eso, en el interior del aire o del agua, el sonido solo puede ser longitudinal. Los sismólogos usan esto: las ondas S no atraviesan el núcleo externo de la Tierra, y así se descubrió que este es líquido.

## Lo que viaja es la energía, no la materia

Esta es la idea central de la lección. Cuando pasa una onda, **cada partícula del medio oscila alrededor de su posición de equilibrio y vuelve a ella**; no viaja con la onda. Lo que se desplaza de un lugar a otro es la **perturbación** y, con ella, la **energía** y la cantidad de movimiento.

Ejemplos que lo muestran:

- Un **corcho** o una gaviota flotando en el mar sube y baja cuando pasan las olas, pero en mar abierto no es arrastrado hasta la playa.
- En la **«ola»** que hace el público en el estadio Quisqueya, cada espectador solo se levanta y se sienta en su asiento, pero la ola recorre todo el estadio.
- Cuando el sonido de un altavoz llega a usted, no le llega el aire del altavoz: le llega la vibración.

Que la onda lleva energía es evidente: un tsunami derriba edificios a cientos de kilómetros del sismo que lo originó, y el sonido muy fuerte puede romper un vidrio. La energía que transporta una onda depende de su **amplitud**: para un mismo tipo de onda y una misma frecuencia, es proporcional al **cuadrado** de la amplitud, igual que la energía de un oscilador, $E = \tfrac12 kA^2$.

> **Error frecuente.** Confundir la **velocidad de la onda** (con qué rapidez avanza la perturbación) con la **velocidad de las partículas** del medio (con qué rapidez oscila cada trozo). Son cosas distintas: en una soga la onda puede avanzar a $20\,\mathrm{m/s}$ hacia la derecha mientras cada trozo sube y baja con una rapidez que depende de la amplitud y de la frecuencia de la mano.

## Rapidez de propagación

Un pulso avanza con una rapidez $v$ que depende de las propiedades del **medio** (su elasticidad y su inercia), no de cómo se agita la fuente. Si recorre una distancia $\Delta x$ en un tiempo $\Delta t$:

$$v = \frac{\Delta x}{\Delta t} .$$

En un medio uniforme, $v$ es constante: la onda avanza como un móvil en MRU. Un ejemplo práctico es localizar un sismo. Las ondas P viajan más rápido que las S; una estación que registra las P y, $\Delta t$ segundos después, las S, puede calcular su distancia al foco:

$$d = \frac{\Delta t}{\dfrac{1}{v_S} - \dfrac{1}{v_P}} .$$

## Límites del modelo

Hemos supuesto medios uniformes, sin pérdidas, en los que la onda avanza sin cambiar de forma. En la realidad la onda pierde energía por rozamiento interno y, si se extiende en dos o tres dimensiones, su energía se reparte en un área cada vez mayor, de modo que la amplitud disminuye al alejarse de la fuente.`,
  formulas: [
    {
      name: 'Rapidez de propagación de un pulso',
      latex: String.raw`v = \frac{\Delta x}{\Delta t}`,
      description: 'Distancia que avanza la perturbación por unidad de tiempo. Depende del medio.',
      variables: [
        { symbol: String.raw`v`, meaning: 'Rapidez de propagación de la onda', unit: 'm/s' },
        { symbol: String.raw`\Delta x`, meaning: 'Distancia recorrida por el pulso', unit: 'm' },
        { symbol: String.raw`\Delta t`, meaning: 'Tiempo empleado', unit: 's' },
      ],
    },
    {
      name: 'Distancia a un sismo (ondas P y S)',
      latex: String.raw`d = \frac{\Delta t}{\dfrac{1}{v_S} - \dfrac{1}{v_P}}`,
      description: 'Se obtiene igualando la distancia recorrida por ambas ondas: d/v_S − d/v_P = Δt.',
      variables: [
        { symbol: String.raw`d`, meaning: 'Distancia de la estación al foco', unit: 'm o km' },
        { symbol: String.raw`\Delta t`, meaning: 'Retraso de la llegada de las ondas S respecto a las P', unit: 's' },
        { symbol: String.raw`v_P,\,v_S`, meaning: 'Rapideces de las ondas P y S', unit: 'm/s o km/s' },
      ],
    },
    {
      name: 'Energía y amplitud',
      latex: String.raw`E \propto A^2`,
      description: 'Para un mismo tipo de onda y una misma frecuencia, la energía transportada es proporcional al cuadrado de la amplitud.',
      variables: [
        { symbol: String.raw`E`, meaning: 'Energía transportada', unit: 'J' },
        { symbol: String.raw`A`, meaning: 'Amplitud de la onda', unit: 'm' },
      ],
    },
  ],
  examples: [
    {
      title: 'Pulso en una soga',
      statement: String.raw`Un estudiante da una sacudida a una soga tensa y observa que el pulso recorre $6.0\,\mathrm{m}$ en $0.25\,\mathrm{s}$. ¿Con qué rapidez se propaga el pulso?`,
      steps: [
        String.raw`$v = \dfrac{\Delta x}{\Delta t} = \dfrac{6.0\,\mathrm{m}}{0.25\,\mathrm{s}} = 24\,\mathrm{m/s}$.`,
        String.raw`Si sacude la soga más fuerte (mayor amplitud), la rapidez no cambia: depende de la tensión y de la masa de la soga, no de la mano.`,
      ],
      result: String.raw`$v = 24\,\mathrm{m/s}$.`,
      interpretation: 'Unos 86 km/h: los pulsos en una soga son rápidos, por eso parece que la perturbación llega «al instante» al otro extremo.',
    },
    {
      title: 'Localizar un sismo',
      statement: String.raw`Una estación sismológica registra la llegada de las ondas S $20\,\mathrm{s}$ después de las ondas P. Si $v_P = 6.0\,\mathrm{km/s}$ y $v_S = 3.5\,\mathrm{km/s}$, ¿a qué distancia está el foco?`,
      steps: [
        String.raw`Ambas ondas recorren la misma distancia $d$; la S tarda $d/v_S$ y la P, $d/v_P$. La diferencia es $\Delta t$: $\dfrac{d}{v_S} - \dfrac{d}{v_P} = \Delta t$.`,
        String.raw`$\dfrac{1}{3.5} - \dfrac{1}{6.0} = 0.2857 - 0.1667 = 0.1190\,\mathrm{s/km}$.`,
        String.raw`$d = \dfrac{20\,\mathrm{s}}{0.1190\,\mathrm{s/km}} = 168\,\mathrm{km}$.`,
      ],
      result: String.raw`$d \approx 1.7\times10^{2}\,\mathrm{km}$.`,
      interpretation: 'Con tres estaciones se dibujan tres círculos y su intersección localiza el epicentro. Es el método clásico de las redes sismológicas.',
    },
    {
      title: 'Duplicar la amplitud',
      statement: String.raw`Una ola llega a un rompeolas con $0.5\,\mathrm{m}$ de amplitud y otra, con el mismo período, con $1.0\,\mathrm{m}$. ¿Cuántas veces más energía transporta la segunda?`,
      steps: [
        String.raw`Con la misma frecuencia, $E \propto A^2$: $\dfrac{E_2}{E_1} = \left(\dfrac{A_2}{A_1}\right)^2$.`,
        String.raw`$\left(\dfrac{1.0}{0.5}\right)^2 = 2^2 = 4$.`,
      ],
      result: 'La segunda ola transporta 4 veces más energía.',
      interpretation: 'Por eso un aumento moderado del oleaje durante una tormenta multiplica la fuerza con que el mar golpea el malecón.',
    },
  ],
  simulation: null,
  exercises: [
    {
      id: 'b5-ond-01',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['ondas-mecanicas-transversales-longitudinales'],
      prompt: '¿Cuál de las siguientes es una onda **transversal**?',
      format: 'choice',
      options: [
        'El sonido de una bocina que viaja por el aire.',
        'La onda que se forma en una soga tensa cuando se sacude su extremo hacia arriba y hacia abajo.',
        'Las compresiones que avanzan por un resorte largo cuando se empuja y se tira de su extremo a lo largo de su eje.',
        'Las ondas sísmicas P.',
      ],
    },
    {
      id: 'b5-ond-02',
      category: 'conceptual',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['ondas-mecanicas-transporte-energia'],
      prompt: 'Un corcho flota en mar abierto, lejos de la costa, mientras pasan olas regulares. ¿Qué hace el corcho?',
      format: 'choice',
      options: [
        'Viaja con las olas hasta la playa a la misma velocidad que ellas.',
        'Sube y baja (y se mece un poco adelante y atrás), pero en promedio permanece en el mismo lugar.',
        'Permanece completamente inmóvil, porque la onda solo afecta al agua.',
        'Se aleja de la costa, en sentido contrario a las olas.',
      ],
    },
    {
      id: 'b5-ond-03',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['ondas-mecanicas-concepto'],
      prompt: String.raw`Una soga de $12\,\mathrm{m}$ está atada a una pared. Se envía un pulso desde el extremo libre; el pulso llega a la pared, se refleja y regresa a la mano $0.80\,\mathrm{s}$ después de haber salido. ¿Con qué rapidez se propaga el pulso?`,
      format: 'numeric',
      unitHint: 'm/s',
    },
    {
      id: 'b5-ond-04',
      category: 'vf_justificacion',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['ondas-mecanicas-transversales-longitudinales', 'ondas-mecanicas-transporte-energia'],
      prompt: String.raw`**Verdadero o falso:** en una onda longitudinal las partículas del medio se mueven en la dirección de propagación; por eso, en el sonido, el aire que está junto a la bocina viaja hasta el oído del oyente. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b5-ond-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['ondas-mecanicas-concepto'],
      prompt: String.raw`Una estación sismológica en Santiago registra un temblor. Las ondas S llegan $30\,\mathrm{s}$ después que las ondas P. Si en esa región $v_P = 6.0\,\mathrm{km/s}$ y $v_S = 3.6\,\mathrm{km/s}$, ¿a qué distancia de la estación se produjo el sismo?`,
      format: 'numeric',
      unitHint: 'km',
    },
    {
      id: 'b5-ond-06',
      category: 'error',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['ondas-mecanicas-concepto'],
      prompt: String.raw`Un estudiante resolvió así este problema: *«Un pulso viaja por una cuerda de $15\,\mathrm{m}$ atada a un poste, se refleja en él y vuelve al punto de partida en $1.2\,\mathrm{s}$. ¿Cuál es su rapidez?»*

1. El pulso parte del extremo libre y vuelve a él: el tiempo de ida y vuelta es $1.2\,\mathrm{s}$.
2. Distancia recorrida por el pulso en ese tiempo: $15\,\mathrm{m}$.
3. Rapidez: $v = \Delta x/\Delta t$.
4. Resultado: $v = 15/1.2 = 12.5\,\mathrm{m/s}$.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'No hay ningún error'],
    },
    {
      id: 'b5-ond-07',
      category: 'grafica',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['ondas-mecanicas-concepto'],
      prompt: String.raw`La gráfica muestra la forma de una cuerda (desplazamiento vertical $y$ frente a la posición $x$) en dos instantes: $t = 0$ y $t = 0.50\,\mathrm{s}$. El pulso avanza hacia la derecha sin deformarse. ¿Con qué rapidez se propaga?`,
      format: 'numeric',
      unitHint: 'm/s',
      figure: {
        kind: 'line',
        title: 'Forma de la cuerda en dos instantes',
        x: { label: 'x', unit: 'm' },
        y: { label: 'y', unit: 'cm' },
        series: [
          { name: 't = 0', points: [[0, 0], [1.5, 0], [2, 10], [2.5, 0], [8, 0]] },
          { name: 't = 0.50 s', points: [[0, 0], [4.5, 0], [5, 10], [5.5, 0], [8, 0]] },
        ],
      },
    },
    {
      id: 'b5-ond-08',
      category: 'desarrollo',
      difficulty: 'intermedio',
      role: 'bank',
      concepts: ['ondas-mecanicas-transversales-longitudinales', 'ondas-mecanicas-transporte-energia', 'ondas-mecanicas-concepto'],
      prompt: String.raw`Explique, con sus palabras y con ejemplos: (a) la diferencia entre una onda transversal y una longitudinal, con un ejemplo de cada una y un dibujo esquemático que indique la dirección de oscilación y la de propagación; (b) por qué se dice que una onda transporta energía pero no materia (use el ejemplo de «la ola» en un estadio o el de un corcho en el mar); (c) por qué el sonido no se propaga en el vacío; (d) la diferencia entre la velocidad de propagación de una onda en una soga y la velocidad con que se mueve un trozo de la soga.`,
      format: 'open',
    },
  ],
};
