import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'primera-ley',
  title: 'Primera ley de Newton: inercia y equilibrio',
  summary:
    'Un cuerpo mantiene su velocidad (en reposo o en movimiento rectilíneo uniforme) mientras la fuerza neta sobre él sea cero. No hace falta una fuerza para mantener el movimiento, sino para cambiarlo.',
  concepts: [
    { slug: 'ley1-inercia', name: 'Inercia y primera ley de Newton' },
    { slug: 'ley1-equilibrio', name: 'Equilibrio: fuerza neta nula y velocidad constante' },
    { slug: 'ley1-sistemas-inerciales', name: 'Sistemas de referencia inerciales' },
    { slug: 'ley1-concepciones-aristotelicas', name: 'Concepciones aristotélicas sobre fuerza y movimiento' },
  ],
  theory: String.raw`## Una idea intuitiva… y equivocada

Empuje un carrito de supermercado y suéltelo: al poco rato se detiene. Deje de pedalear una bicicleta: se frena. La experiencia diaria parece decir que **para mantener un cuerpo en movimiento hay que seguir empujándolo** y que, sin fuerza, todo tiende al reposo. Así pensaba Aristóteles hace más de 2300 años, y así lo sigue pensando, sin decirlo, mucha gente hoy.

Galileo (hacia 1600) mostró que esa idea confunde la causa. Hizo rodar bolas por una rampa y las dejó subir por otra rampa enfrentada: la bola subía casi hasta la altura de la que había partido. Al hacer la segunda rampa menos empinada, la bola recorría más distancia para alcanzar esa altura. Si la segunda rampa fuera horizontal y no hubiera rozamiento, la bola **nunca se detendría**. Lo que frena al carrito y a la bicicleta no es la «falta de fuerza», sino **fuerzas que sí existen**: el rozamiento con el suelo y la resistencia del aire.

## La primera ley de Newton

Newton recogió la idea de Galileo como la primera de sus leyes del movimiento:

> **Primera ley (ley de inercia).** Si la fuerza neta que actúa sobre un cuerpo es cero, el cuerpo mantiene constante su velocidad: si estaba en reposo, sigue en reposo; si se movía, sigue moviéndose en línea recta con la misma rapidez.

La propiedad de los cuerpos de mantener su velocidad se llama **inercia**. Recuerde que la velocidad es un vector: «velocidad constante» significa que **no cambian ni la rapidez ni la dirección**. Por eso la ley también dice que, para cambiar cualquiera de las dos (acelerar, frenar o tomar una curva), hace falta una fuerza neta distinta de cero.

La inercia explica muchas experiencias cotidianas:

- Cuando la guagua frena de golpe, los pasajeros de pie «se van hacia adelante». Ninguna fuerza los empuja: sus cuerpos siguen moviéndose con la velocidad que tenían, mientras la guagua reduce la suya. El cinturón de seguridad sirve precisamente para ejercer la fuerza que los frene junto con el vehículo.
- Cuando la guagua arranca, los pasajeros «se van hacia atrás»: en realidad tienden a quedarse donde estaban mientras el vehículo avanza.
- En una curva, una bolsa sobre el asiento se desliza hacia el lado exterior: tiende a seguir en línea recta mientras el carro gira.
- Para sacar la salsa de tomate de la botella, se mueve la botella hacia abajo y se frena bruscamente: la salsa sigue bajando.

Cuanto mayor es la masa de un cuerpo, mayor es su inercia: cuesta más ponerlo en marcha o detenerlo. La lección de la segunda ley precisa esta idea.

## Equilibrio: fuerza neta cero

Un cuerpo está en **equilibrio** (de traslación) cuando la fuerza neta sobre él es cero. La primera ley dice que eso equivale a que su velocidad sea constante, lo que incluye dos casos:

- **Equilibrio estático**: el cuerpo está en reposo (un libro sobre la mesa, una lámpara colgada).
- **Equilibrio dinámico**: el cuerpo se mueve con velocidad constante (un paracaidista que desciende a velocidad terminal, un carro en una autopista recta con el control de crucero activado).

En el plano, la condición vectorial se escribe por componentes: la suma de las componentes $x$ y la suma de las componentes $y$ de todas las fuerzas deben anularse **por separado**.

> **Error frecuente.** «Si se mueve, hay una fuerza neta en la dirección del movimiento». No: si la velocidad es constante, la fuerza neta es **cero**. En el carro con control de crucero, el impulso hacia adelante que el asfalto ejerce sobre las ruedas motrices es igual a la suma de la resistencia del aire y del rozamiento de rodadura. Si el impulso fuera mayor, el carro aceleraría.

> **Error frecuente.** «Fuerza neta cero significa reposo». No: significa velocidad constante, que puede ser cero o no.

> **Cuidado.** Estar en reposo *un instante* no es estar en equilibrio. En el punto más alto de un lanzamiento vertical la pelota tiene velocidad cero, pero sobre ella sigue actuando su peso: su velocidad está cambiando y la pelota no está en equilibrio. Tampoco está en equilibrio un carro que toma una curva con rapidez constante, porque la dirección de su velocidad cambia.

## Sistemas de referencia inerciales

La primera ley no se cumple desde cualquier punto de vista. Imagine una pelota que rueda casi sin rozamiento por el piso de una guagua que frena. Una persona parada en la acera ve que la pelota sigue avanzando con la misma velocidad que tenía: no hay fuerza horizontal sobre ella y la ley se cumple. Un pasajero sentado, en cambio, ve que la pelota *se acelera* hacia adelante sin que nada la empuje: para él, la primera ley falla.

Se llama **sistema de referencia inercial** a aquel en el que se cumple la primera ley. La acera es (con muy buena aproximación) un sistema inercial; la guagua que frena, que arranca o que toma una curva, no lo es. Cualquier sistema que se mueva con **velocidad constante** respecto a uno inercial también es inercial: dentro de un avión que vuela en línea recta a velocidad constante, una pelota en reposo sobre la bandeja sigue en reposo, y es imposible notar el movimiento sin mirar por la ventanilla.

Las leyes de Newton solo son válidas en sistemas inerciales. En este curso describiremos siempre el movimiento desde el suelo, que tomaremos como inercial.

## Límites del modelo

La Tierra gira sobre sí misma y alrededor del Sol, así que el suelo no es un sistema inercial perfecto. Para movimientos de corta duración y pequeña extensión (los de un laboratorio, una calle o un estadio), los efectos de esa rotación son despreciables. Solo se notan en fenómenos de gran escala, como la circulación de los huracanes o el giro lento del plano de oscilación de un péndulo de Foucault.`,
  formulas: [
    {
      name: 'Primera ley de Newton',
      latex: String.raw`\vec F_{\text{neta}} = \vec 0 \quad \text{si y solo si} \quad \vec v = \text{constante}`,
      description:
        'La fuerza neta es nula exactamente cuando la velocidad no cambia ni en magnitud ni en dirección (reposo o movimiento rectilíneo uniforme).',
      variables: [
        { symbol: String.raw`\vec F_{\text{neta}}`, meaning: 'Suma vectorial de todas las fuerzas sobre el cuerpo', unit: 'N' },
        { symbol: String.raw`\vec v`, meaning: 'Velocidad del cuerpo (vector)', unit: 'm/s' },
      ],
      notes: 'Válida solo en sistemas de referencia inerciales.',
    },
    {
      name: 'Condiciones de equilibrio por componentes',
      latex: String.raw`F_{\text{neta},x} = F_{1x} + F_{2x} + \text{...} = 0, \qquad F_{\text{neta},y} = F_{1y} + F_{2y} + \text{...} = 0`,
      description: 'En equilibrio, las componentes de las fuerzas se compensan por separado en cada eje.',
      variables: [
        { symbol: String.raw`F_{ix},\,F_{iy}`, meaning: 'Componentes de cada fuerza que actúa sobre el cuerpo', unit: 'N' },
      ],
      notes: 'Son dos ecuaciones: permiten hallar hasta dos incógnitas (dos fuerzas desconocidas, o la magnitud y la dirección de una).',
    },
    {
      name: 'Fuerza equilibrante',
      latex: String.raw`\vec F_{\text{eq}} = -\left( \vec F_1 + \vec F_2 + \text{...} \right)`,
      description:
        'Fuerza que hay que añadir a un conjunto de fuerzas para que la neta sea cero: misma magnitud que su resultante y sentido contrario.',
      variables: [
        { symbol: String.raw`\vec F_{\text{eq}}`, meaning: 'Fuerza equilibrante', unit: 'N' },
        { symbol: String.raw`\vec F_1,\,\vec F_2`, meaning: 'Fuerzas conocidas que actúan sobre el cuerpo', unit: 'N' },
      ],
    },
  ],
  examples: [
    {
      title: 'Arrastrar una caja con velocidad constante',
      statement: String.raw`Una persona arrastra una caja por un piso horizontal con velocidad constante, tirando de una cuerda con $120\,\mathrm{N}$ a $30^\circ$ sobre la horizontal. El peso de la caja es $300\,\mathrm{N}$. Además de la cuerda y de la Tierra, el piso ejerce sobre la caja una fuerza vertical hacia arriba (la normal) y una fuerza horizontal opuesta al movimiento (la fricción). Calcule ambas.`,
      steps: [
        String.raw`Velocidad constante $\Rightarrow$ equilibrio: $F_{\text{neta},x} = 0$ y $F_{\text{neta},y} = 0$. Eje $x$ en el sentido del movimiento y eje $y$ hacia arriba.`,
        String.raw`Componentes del tirón: $T_x = 120\cos 30^\circ = 103.9\,\mathrm{N}$; $T_y = 120\sin 30^\circ = 60.0\,\mathrm{N}$.`,
        String.raw`Eje $x$: $T_x - f = 0 \Rightarrow f = 103.9\,\mathrm{N}$ (hacia atrás).`,
        String.raw`Eje $y$: $N + T_y - W = 0 \Rightarrow N = 300 - 60.0 = 240\,\mathrm{N}$ (hacia arriba).`,
      ],
      result: String.raw`Fricción $f \approx 104\,\mathrm{N}$ opuesta al movimiento; normal $N = 240\,\mathrm{N}$ hacia arriba.`,
      interpretation:
        'Aunque la caja se mueve, la fuerza neta es cero: el tirón no «gana» a la fricción, la iguala. Observe también que la normal es menor que el peso, porque la cuerda sostiene parte de la caja.',
    },
    {
      title: 'Una gota de lluvia a velocidad terminal',
      statement: String.raw`Una gota de lluvia de $3.4\times10^{-5}\,\mathrm{kg}$ cae, cerca del suelo, con una velocidad constante de unos $6.5\,\mathrm{m/s}$. ¿Qué fuerza ejerce el aire sobre ella? (El peso de un cuerpo de masa $m$ vale $mg$.)`,
      steps: [
        String.raw`Velocidad constante $\Rightarrow$ fuerza neta cero (equilibrio dinámico).`,
        String.raw`Fuerzas sobre la gota: su peso, hacia abajo, y la resistencia del aire, hacia arriba (opuesta a la velocidad).`,
        String.raw`Peso: $W = mg = (3.4\times10^{-5}\,\mathrm{kg})(9.8\,\mathrm{m/s^2}) = 3.3\times10^{-4}\,\mathrm{N}$.`,
        String.raw`Equilibrio vertical: $R - W = 0 \Rightarrow R = 3.3\times10^{-4}\,\mathrm{N}$.`,
      ],
      result: String.raw`El aire empuja la gota hacia arriba con $3.3\times10^{-4}\,\mathrm{N}$, igual a su peso.`,
      interpretation:
        'La gota se mueve hacia abajo y, sin embargo, la fuerza neta es cero. El valor de 6.5 m/s no se usa: en equilibrio, la resistencia es igual al peso sea cual sea la velocidad terminal. (La resistencia del aire crece con la rapidez; la gota acelera hasta que la resistencia iguala al peso y desde entonces cae con velocidad constante.)',
    },
    {
      title: 'Una pelota en el piso de una guagua que frena',
      statement: String.raw`Una guagua avanza a $15\,\mathrm{m/s}$ y empieza a frenar con una aceleración de magnitud $3.0\,\mathrm{m/s^2}$. En su piso hay una pelota que rueda sin rozamiento apreciable. Describa el movimiento de la pelota durante los primeros $2.0\,\mathrm{s}$ desde la acera y desde la guagua.`,
      steps: [
        String.raw`Desde la acera (sistema inercial): sobre la pelota no actúa ninguna fuerza horizontal, así que mantiene $v = 15\,\mathrm{m/s}$. En $2.0\,\mathrm{s}$ avanza $15 \times 2.0 = 30\,\mathrm{m}$.`,
        String.raw`La guagua: $v = 15 - 3.0 \times 2.0 = 9.0\,\mathrm{m/s}$ y avanza $15 \times 2.0 - \tfrac12 (3.0)(2.0)^2 = 24\,\mathrm{m}$.`,
        String.raw`Respecto a la guagua, la pelota avanzó $30 - 24 = 6.0\,\mathrm{m}$ hacia adelante y lleva $15 - 9.0 = 6.0\,\mathrm{m/s}$: un pasajero la ve acelerar a $3.0\,\mathrm{m/s^2}$ hacia el frente.`,
      ],
      result:
        'Desde la acera, la pelota sigue en MRU, como predice la primera ley. Desde la guagua, la pelota acelera hacia adelante sin que ninguna fuerza la empuje.',
      interpretation:
        'La guagua que frena no es un sistema de referencia inercial: en ella la primera ley no se cumple. Por eso los problemas de dinámica se plantean desde el suelo.',
    },
  ],
  simulation: {
    key: 'fuerzas',
    params: { m: 2, F: 0, theta: 0, muS: 0, muK: 0, g: 9.8 },
    guide: String.raw`1. Con los valores iniciales (sin fricción, $F = 0$, superficie horizontal), pulse **Iniciar**. Anote la fuerza neta y la gráfica $v$–$t$. ¿Qué dice la primera ley de este caso?
2. Ponga $F = 10\,\mathrm{N}$ y repita. ¿La velocidad es constante o cambia? ¿Qué forma tiene ahora la gráfica $v$–$t$? Concluya qué produce una fuerza neta distinta de cero.
3. Ahora fije $m = 5\,\mathrm{kg}$, $\mu_s = 0.4$, $\mu_k = 0.3$ y $F = 10\,\mathrm{N}$. El bloque no se mueve. Lea la fricción y la fuerza neta. ¿Qué fuerza equilibra a la aplicada?
4. Aumente $F$ de $1\,\mathrm{N}$ en $1\,\mathrm{N}$ y anote, en cada caso, la fricción que muestra el simulador. ¿Cómo cambia la fricción mientras el bloque sigue quieto? ¿A partir de qué valor de $F$ empieza a moverse?
5. En cualquiera de los casos anteriores, compare el peso con la normal. ¿Por qué no hay movimiento vertical?`,
  },
  exercises: [
    {
      id: 'b3-ley1-01',
      category: 'conceptual',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['ley1-inercia', 'ley1-concepciones-aristotelicas'],
      prompt: String.raw`Una sonda espacial viaja a $2000\,\mathrm{m/s}$ en una región tan alejada de estrellas y planetas que ninguna fuerza apreciable actúa sobre ella. Sus motores se apagan. ¿Qué ocurre a continuación?`,
      format: 'choice',
      options: [
        'Se va frenando poco a poco hasta detenerse, porque ya nada la impulsa.',
        'Se detiene casi de inmediato.',
        'Sigue moviéndose en línea recta a 2000 m/s.',
        'Sigue moviéndose, pero describe una curva hasta detenerse.',
      ],
    },
    {
      id: 'b3-ley1-02',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['ley1-equilibrio'],
      prompt: String.raw`**Verdadero o falso:** si la fuerza neta sobre un cuerpo es cero, el cuerpo está necesariamente en reposo. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b3-ley1-03',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['ley1-inercia', 'ley1-sistemas-inerciales'],
      prompt:
        'Un pasajero viaja de pie, sin agarrarse, en una guagua que circula por una avenida recta. El chofer frena bruscamente y el pasajero se precipita hacia adelante. ¿Cuál es la mejor explicación, vista desde la acera?',
      format: 'choice',
      options: [
        'Al frenar, aparece una fuerza de inercia que empuja al pasajero hacia adelante.',
        'El pasajero tiende a mantener la velocidad que tenía, mientras la guagua (y el piso bajo sus pies) reduce la suya.',
        'El aire del interior de la guagua sigue avanzando y empuja al pasajero hacia adelante.',
        'La fuerza del motor que impulsaba la guagua pasa al pasajero cuando se frena.',
      ],
    },
    {
      id: 'b3-ley1-04',
      category: 'experimento',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['ley1-equilibrio'],
      prompt: String.raw`En el simulador, fije $m = 5\,\mathrm{kg}$, $F = 15\,\mathrm{N}$, superficie horizontal ($\theta = 0^\circ$), $\mu_s = 0.4$, $\mu_k = 0.3$ y $g = 9.8\,\mathrm{m/s^2}$, y ejecute la simulación. Observe si el bloque se mueve. Aplicando la primera ley, **prediga** la magnitud de la fuerza de fricción que el piso ejerce sobre el bloque y compruébela con la lectura del simulador. Escriba ese valor.`,
      format: 'numeric',
      unitHint: 'N',
      simulation: { key: 'fuerzas', params: { m: 5, F: 15, theta: 0, muS: 0.4, muK: 0.3, g: 9.8 } },
    },
    {
      id: 'b3-ley1-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['ley1-equilibrio', 'fuer-fuerza-neta'],
      prompt: String.raw`Un bote navega por la bahía con velocidad constante. Las fuerzas horizontales sobre él son tres: la del motor, de $800\,\mathrm{N}$ hacia el este; la del viento, de $300\,\mathrm{N}$ hacia el noreste ($45^\circ$ al norte del este), y la que ejerce el agua, desconocida. (Las fuerzas verticales, peso y empuje del agua, se compensan.) ¿Cuál es la magnitud de la fuerza horizontal que ejerce el agua sobre el bote?`,
      format: 'numeric',
      unitHint: 'N',
    },
    {
      id: 'b3-ley1-06',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['ley1-equilibrio'],
      prompt: '¿En cuáles de estas situaciones la fuerza neta sobre el cuerpo es cero? Marque todas las que correspondan.',
      format: 'choice',
      multiple: true,
      options: [
        'Un libro en reposo sobre una mesa.',
        'Un ascensor que sube con velocidad constante.',
        'Un carro que toma una curva con una rapidez constante de 40 km/h.',
        'Una pelota en el punto más alto de un lanzamiento vertical.',
        'Un paracaidista que desciende con velocidad terminal constante.',
        'Un motoconcho que arranca en un semáforo.',
      ],
    },
    {
      id: 'b3-ley1-07',
      category: 'grafica',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['ley1-equilibrio'],
      prompt: String.raw`La gráfica muestra la velocidad de un ascensor que se mueve en línea recta (vertical) durante un viaje de $14\,\mathrm{s}$. ¿Durante cuántos segundos, en total, la fuerza neta sobre el ascensor es cero?`,
      format: 'numeric',
      unitHint: 's',
      figure: {
        kind: 'line',
        title: 'Velocidad frente al tiempo',
        x: { label: 't', unit: 's' },
        y: { label: 'v', unit: 'm/s' },
        series: [
          {
            name: 'v(t)',
            points: [
              [0, 0],
              [2, 1],
              [4, 2],
              [6, 2],
              [8, 2],
              [10, 2],
              [12, 1],
              [14, 0],
            ],
          },
        ],
      },
    },
    {
      id: 'b3-ley1-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['ley1-concepciones-aristotelicas', 'ley1-inercia', 'ley1-sistemas-inerciales'],
      prompt: String.raw`Un compañero afirma: «Cuando el lanzador suelta la pelota de béisbol, esta sigue avanzando hacia el bateador porque lleva consigo la fuerza del lanzamiento, que se va gastando por el camino». (a) Identifique la concepción errónea y relaciónela con las ideas de Aristóteles. (b) Enumere las fuerzas que actúan sobre la pelota después de que sale de la mano, indicando el agente de cada una. (c) Explique con la primera ley por qué la pelota sigue avanzando y por qué su velocidad cambia. (d) Un ambientador cuelga de un hilo del retrovisor de un carro. Cuando el carro arranca, el ambientador se inclina hacia atrás. Explique este hecho desde la acera (sistema inercial) y discuta por qué, para un pasajero, parece que «algo» empuja el ambientador hacia atrás.`,
      format: 'open',
    },
  ],
};
