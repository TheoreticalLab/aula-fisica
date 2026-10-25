import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'proyectiles',
  title: 'Movimiento de proyectiles',
  summary:
    'Un proyectil combina un MRU horizontal y una caída libre vertical que ocurren a la vez y no se influyen: la trayectoria resultante es una parábola.',
  concepts: [
    { slug: 'proyectiles-independencia', name: 'Independencia de los movimientos horizontal y vertical' },
    { slug: 'proyectiles-componentes', name: 'Componentes de la velocidad inicial' },
    { slug: 'proyectiles-vuelo-altura', name: 'Tiempo de vuelo y altura máxima' },
    { slug: 'proyectiles-alcance', name: 'Alcance y ángulos complementarios' },
    { slug: 'proyectiles-lanzamiento-horizontal', name: 'Lanzamiento horizontal desde una altura' },
  ],
  theory: String.raw`## Movimiento en dos dimensiones

Un batazo de béisbol, el balón que un portero despeja, el chorro de agua de una manguera o un clavadista que salta desde una roca hacia el mar: todos describen una **curva** en un plano vertical. Llamamos **proyectil** a un cuerpo que, una vez lanzado, se mueve solo bajo la acción de la gravedad. Si despreciamos el aire, su trayectoria es una **parábola**.

Estudiar una curva parece más difícil que estudiar una recta, pero hay una idea que lo simplifica todo.

## Independencia de los movimientos

Galileo observó que el movimiento de un proyectil se puede descomponer en **dos movimientos rectilíneos que ocurren a la vez y no se influyen entre sí**:

- **Horizontal (eje $x$):** ninguna fuerza actúa en esa dirección (sin aire), así que la componente horizontal de la velocidad **no cambia**. Es un **MRU**.
- **Vertical (eje $y$, hacia arriba):** la gravedad produce una aceleración $-g$. Es un **lanzamiento vertical**, exactamente como en la lección anterior.

Lo único que comparten ambos movimientos es el **tiempo** $t$.

Un experimento clásico lo demuestra. Desde la misma altura y en el mismo instante, se suelta una bola y se lanza otra horizontalmente. Las dos llegan al suelo **a la vez**. La segunda avanza mucho en horizontal, pero ese avance no afecta a su caída: verticalmente, ambas parten con velocidad cero y tienen la misma aceleración.

## Componentes de la velocidad inicial

Si el proyectil sale con rapidez $v_0$ formando un ángulo $\theta$ **sobre la horizontal**, descomponemos la velocidad inicial como cualquier vector:

$$v_{0x} = v_0\cos\theta, \qquad v_{0y} = v_0\sin\theta .$$

Por ejemplo, un balón pateado a $20\,\mathrm{m/s}$ y $30^\circ$ sale con $v_{0x} = 17.3\,\mathrm{m/s}$ y $v_{0y} = 10.0\,\mathrm{m/s}$.

## Las ecuaciones del movimiento

Con el origen en el suelo, justo debajo del punto de lanzamiento, y el proyectil a una altura inicial $h_0$:

$$x = v_{0x}\,t, \qquad y = h_0 + v_{0y}\,t - \tfrac12 g\,t^2,$$

$$v_x = v_{0x} \ (\text{constante}), \qquad v_y = v_{0y} - g\,t .$$

En cada instante, la velocidad es la suma vectorial de sus componentes: su módulo es $v = \sqrt{v_x^2 + v_y^2}$ y es **tangente a la trayectoria**.

La estrategia para resolver casi cualquier problema es siempre la misma: **usar el movimiento vertical para hallar el tiempo** (cuándo llega a cierta altura) y **usar ese tiempo en el movimiento horizontal** (cuánto avanza).

## Altura máxima y tiempo de vuelo

En el punto más alto, la componente **vertical** de la velocidad se anula: $v_y = 0$. Igual que en el lanzamiento vertical,

$$t_s = \frac{v_0\sin\theta}{g}, \qquad H = h_0 + \frac{(v_0\sin\theta)^2}{2g}.$$

Si el proyectil aterriza a la misma altura desde la que salió (por ejemplo, $h_0 = 0$ en terreno horizontal), la bajada dura lo mismo que la subida y el **tiempo de vuelo** es

$$t_v = \frac{2v_0\sin\theta}{g}.$$

> **Error frecuente.** «En el punto más alto la velocidad es cero.» No: solo se anula la componente vertical. La componente horizontal sigue valiendo $v_0\cos\theta$, de modo que el proyectil pasa por el punto más alto moviéndose horizontalmente. La aceleración allí, como en todo el vuelo, es $g$ hacia abajo.

## El alcance

El **alcance** $R$ es la distancia horizontal recorrida hasta volver al suelo. En terreno horizontal ($h_0 = 0$) es la velocidad horizontal por el tiempo de vuelo:

$$R = v_0\cos\theta \cdot \frac{2v_0\sin\theta}{g} = \frac{v_0^2\,\sin(2\theta)}{g},$$

donde se usó la identidad $2\sin\theta\cos\theta = \sin(2\theta)$.

De esta fórmula se deducen dos resultados notables:

- **Máximo alcance a $45^\circ$**, porque $\sin(2\theta)$ vale como máximo $1$, cuando $2\theta = 90^\circ$.
- **Los ángulos complementarios dan el mismo alcance.** Si $\theta_1 + \theta_2 = 90^\circ$, entonces $\sin(2\theta_2) = \sin(180^\circ - 2\theta_1) = \sin(2\theta_1)$. Un balón pateado a $30^\circ$ cae en el mismo sitio que uno pateado a $60^\circ$ con la misma rapidez. El de $60^\circ$ sube más y tarda más en caer, pero avanza más despacio en horizontal.

> **Cuidado.** La fórmula $R = v_0^2\sin(2\theta)/g$ **solo es válida si el proyectil aterriza a la misma altura desde la que se lanzó** y no hay resistencia del aire. Si se lanza desde un acantilado, una azotea o un trampolín, hay que hallar el tiempo de vuelo con la ecuación vertical (igualando $y = 0$, con una ecuación de segundo grado) y después calcular $x = v_{0x}\,t$.

## Lanzamiento horizontal desde una altura

Es el caso $\theta = 0$: el cuerpo sale con velocidad horizontal $v_0$ desde una altura $h$ (una pelota que rueda y cae de una mesa, un paquete que se lanza desde una avioneta). Verticalmente parte del reposo, así que **cae exactamente igual que si se soltara**:

$$t = \sqrt{\frac{2h}{g}}, \qquad x = v_0\,t = v_0\sqrt{\frac{2h}{g}}.$$

El tiempo de caída depende solo de la altura, no de la rapidez horizontal. Si la pelota sale más rápido, cae más lejos, pero en el mismo tiempo.

## Errores frecuentes y límites del modelo

- Usar $\sin$ donde corresponde $\cos$: si $\theta$ se mide desde la horizontal, $v_{0x}$ lleva el coseno.
- Pensar que la componente horizontal se va «gastando»: sin aire, permanece constante.
- Tener la calculadora en radianes cuando los ángulos están en grados.

En la realidad, el aire reduce la componente horizontal de la velocidad y la altura alcanzada. La trayectoria deja de ser simétrica: la bajada es más empinada que la subida. En un batazo largo, el alcance real puede ser mucho menor que el que predice el modelo, y el ángulo óptimo es menor de $45^\circ$. El modelo funciona bien para objetos densos y lentos, como una piedra lanzada con la mano o una bola de petanca.`,
  formulas: [
    {
      name: 'Componentes de la velocidad inicial',
      latex: String.raw`v_{0x} = v_0\cos\theta, \qquad v_{0y} = v_0\sin\theta`,
      description: 'Descomposición de la velocidad de lanzamiento en sus partes horizontal y vertical.',
      variables: [
        { symbol: String.raw`v_0`, meaning: 'Rapidez de lanzamiento', unit: 'm/s' },
        { symbol: String.raw`\theta`, meaning: 'Ángulo de lanzamiento sobre la horizontal', unit: '°' },
        { symbol: String.raw`v_{0x},\,v_{0y}`, meaning: 'Componentes horizontal y vertical de la velocidad inicial', unit: 'm/s' },
      ],
    },
    {
      name: 'Ecuaciones del movimiento',
      latex: String.raw`x = v_{0x}\,t, \quad y = h_0 + v_{0y}\,t - \tfrac12 g\,t^2, \quad v_x = v_{0x}, \quad v_y = v_{0y} - g\,t`,
      description: 'MRU en horizontal y lanzamiento vertical en vertical, con el mismo tiempo t.',
      variables: [
        { symbol: String.raw`x,\,y`, meaning: 'Posición horizontal y altura del proyectil', unit: 'm' },
        { symbol: String.raw`h_0`, meaning: 'Altura inicial de lanzamiento', unit: 'm' },
        { symbol: String.raw`v_x,\,v_y`, meaning: 'Componentes de la velocidad en el instante t', unit: 'm/s' },
        { symbol: String.raw`t`, meaning: 'Tiempo desde el lanzamiento', unit: 's' },
      ],
      notes: 'Origen en el suelo bajo el punto de lanzamiento; eje y hacia arriba. Sin aire.',
    },
    {
      name: 'Tiempo de vuelo y altura máxima (terreno horizontal)',
      latex: String.raw`t_v = \dfrac{2v_0\sin\theta}{g}, \qquad H = \dfrac{v_0^2\sin^2\theta}{2g}`,
      description: 'Para un proyectil que sale del suelo y aterriza a la misma altura.',
      variables: [
        { symbol: String.raw`t_v`, meaning: 'Tiempo de vuelo', unit: 's' },
        { symbol: String.raw`H`, meaning: 'Altura máxima sobre el punto de lanzamiento', unit: 'm' },
      ],
      notes: 'H es válida para cualquier altura de lanzamiento (medida desde el punto de lanzamiento); t_v solo si aterriza a la misma altura.',
    },
    {
      name: 'Alcance en terreno horizontal',
      latex: String.raw`R = \dfrac{v_0^2\,\sin(2\theta)}{g}`,
      description: 'Distancia horizontal recorrida hasta volver a la altura de lanzamiento. Máxima para θ = 45°; igual para ángulos complementarios.',
      variables: [
        { symbol: String.raw`R`, meaning: 'Alcance horizontal', unit: 'm' },
        { symbol: String.raw`v_0`, meaning: 'Rapidez de lanzamiento', unit: 'm/s' },
        { symbol: String.raw`\theta`, meaning: 'Ángulo de lanzamiento sobre la horizontal', unit: '°' },
      ],
      notes: 'Solo es válida si el punto de llegada está a la misma altura que el de salida y no hay resistencia del aire.',
    },
    {
      name: 'Lanzamiento horizontal desde una altura',
      latex: String.raw`t = \sqrt{\dfrac{2h}{g}}, \qquad x = v_0\,\sqrt{\dfrac{2h}{g}}`,
      description: 'Tiempo de caída y distancia horizontal de un cuerpo lanzado horizontalmente desde la altura h.',
      variables: [
        { symbol: String.raw`h`, meaning: 'Altura de lanzamiento sobre el suelo', unit: 'm' },
        { symbol: String.raw`v_0`, meaning: 'Rapidez horizontal de lanzamiento', unit: 'm/s' },
        { symbol: String.raw`x`, meaning: 'Distancia horizontal al punto de impacto', unit: 'm' },
      ],
      notes: 'El tiempo de caída es el mismo que si el cuerpo se soltara desde el reposo.',
    },
  ],
  examples: [
    {
      title: 'Un balón pateado desde el suelo',
      statement: String.raw`Un futbolista patea un balón desde el césped con una rapidez de $20\,\mathrm{m/s}$ y un ángulo de $30^\circ$ sobre la horizontal. Despreciando el aire, halle el tiempo de vuelo, la altura máxima y el alcance.`,
      steps: [
        String.raw`Componentes: $v_{0x} = 20\cos 30^\circ = 17.3\,\mathrm{m/s}$; $v_{0y} = 20\sin 30^\circ = 10.0\,\mathrm{m/s}$.`,
        String.raw`Tiempo de vuelo (sale y llega al césped): $t_v = \dfrac{2v_{0y}}{g} = \dfrac{2(10.0\,\mathrm{m/s})}{9.8\,\mathrm{m/s^2}} = 2.04\,\mathrm{s}$.`,
        String.raw`Altura máxima: $H = \dfrac{v_{0y}^2}{2g} = \dfrac{(10.0\,\mathrm{m/s})^2}{19.6\,\mathrm{m/s^2}} = 5.10\,\mathrm{m}$.`,
        String.raw`Alcance con el movimiento horizontal: $R = v_{0x}\,t_v = (17.3\,\mathrm{m/s})(2.04\,\mathrm{s}) = 35.3\,\mathrm{m}$.`,
        String.raw`Comprobación con la fórmula: $R = \dfrac{(20\,\mathrm{m/s})^2\sin 60^\circ}{9.8\,\mathrm{m/s^2}} = \dfrac{400 \times 0.866}{9.8}\,\mathrm{m} = 35.3\,\mathrm{m}$ ✓.`,
      ],
      result: String.raw`$t_v = 2.04\,\mathrm{s}$, $H = 5.10\,\mathrm{m}$ y $R = 35.3\,\mathrm{m}$.`,
      interpretation:
        'Un despeje de unos 35 m es razonable para una patada de 72 km/h. En el punto más alto el balón no está quieto: se mueve horizontalmente a 17.3 m/s.',
    },
    {
      title: 'Una pelota que rueda y cae de una mesa',
      statement: String.raw`Una canica rueda sobre una mesa de $1.2\,\mathrm{m}$ de altura y sale por el borde con una velocidad horizontal de $2.5\,\mathrm{m/s}$. ¿A qué distancia del pie de la mesa cae? ¿Con qué rapidez y con qué ángulo llega al suelo?`,
      steps: [
        String.raw`Es un lanzamiento horizontal: $v_{0x} = 2.5\,\mathrm{m/s}$, $v_{0y} = 0$, $h = 1.2\,\mathrm{m}$.`,
        String.raw`Tiempo de caída (movimiento vertical): $t = \sqrt{\dfrac{2h}{g}} = \sqrt{\dfrac{2(1.2\,\mathrm{m})}{9.8\,\mathrm{m/s^2}}} = \sqrt{0.245\,\mathrm{s^2}} = 0.495\,\mathrm{s}$.`,
        String.raw`Distancia horizontal: $x = v_{0x}\,t = (2.5\,\mathrm{m/s})(0.495\,\mathrm{s}) = 1.24\,\mathrm{m}$.`,
        String.raw`Componentes de la velocidad al llegar: $v_x = 2.5\,\mathrm{m/s}$; $v_y = -g\,t = -(9.8)(0.495) = -4.85\,\mathrm{m/s}$.`,
        String.raw`Rapidez: $v = \sqrt{2.5^2 + 4.85^2} = 5.46\,\mathrm{m/s}$. Ángulo bajo la horizontal: $\tan\alpha = \dfrac{4.85}{2.5} = 1.94 \Rightarrow \alpha = 62.7^\circ$.`,
      ],
      result: String.raw`Cae a $1.24\,\mathrm{m}$ del pie de la mesa, con una rapidez de $5.46\,\mathrm{m/s}$ y una inclinación de $62.7^\circ$ por debajo de la horizontal.`,
      interpretation:
        'La caída dura lo mismo (0.495 s) que si la canica se soltara desde el borde: el movimiento horizontal no influye en el vertical. La velocidad final es más vertical que horizontal porque v_y creció durante la caída y v_x no cambió.',
    },
    {
      title: 'Lanzamiento oblicuo desde una altura',
      statement: String.raw`Desde lo alto de un acantilado de $15\,\mathrm{m}$ sobre el mar se lanza una piedra a $20\,\mathrm{m/s}$ y $30^\circ$ sobre la horizontal. ¿A qué distancia horizontal del pie del acantilado cae al agua? ¿Por qué no sirve la fórmula del alcance?`,
      steps: [
        String.raw`Componentes: $v_{0x} = 17.3\,\mathrm{m/s}$; $v_{0y} = 10.0\,\mathrm{m/s}$. Origen en el nivel del mar, bajo el punto de lanzamiento: $h_0 = 15\,\mathrm{m}$.`,
        String.raw`Movimiento vertical hasta el agua ($y = 0$): $0 = 15 + 10.0\,t - 4.9\,t^2$, o bien $4.9\,t^2 - 10.0\,t - 15 = 0$.`,
        String.raw`Raíz positiva: $t = \dfrac{10.0 + \sqrt{10.0^2 + 4(4.9)(15)}}{2(4.9)} = \dfrac{10.0 + \sqrt{394}}{9.8} = \dfrac{10.0 + 19.85}{9.8} = 3.05\,\mathrm{s}$.`,
        String.raw`Movimiento horizontal: $x = v_{0x}\,t = (17.3\,\mathrm{m/s})(3.05\,\mathrm{s}) = 52.8\,\mathrm{m}$.`,
      ],
      result: String.raw`La piedra cae al agua a $52.8\,\mathrm{m}$ del pie del acantilado, $3.05\,\mathrm{s}$ después del lanzamiento.`,
      interpretation:
        'La fórmula R = v₀² sin(2θ)/g daría 35.3 m: es la distancia a la que la piedra vuelve a pasar a la altura del acantilado (a los 2.04 s). Desde allí sigue cayendo 15 m más mientras avanza otros 17.4 m. La fórmula del alcance solo vale si la llegada está a la misma altura que la salida.',
    },
  ],
  simulation: {
    key: 'proyectiles',
    params: { v0: 20, angulo: 45, h0: 0, g: 9.8 },
    guide: String.raw`1. Con $v_0 = 20\,\mathrm{m/s}$, $45^\circ$ y $h_0 = 0$, pulse **Iniciar**. Observe las gráficas $v_x$–$t$ y $v_y$–$t$. ¿Qué forma tiene cada una? ¿Qué le dicen sobre la independencia de los movimientos?
2. Anote el alcance, la altura máxima y el tiempo de vuelo, y compárelos con $R = v_0^2\sin(2\theta)/g$, $H = v_0^2\sin^2\theta/(2g)$ y $t_v = 2v_0\sin\theta/g$.
3. Sin cambiar $v_0$, pruebe ángulos de $15^\circ$, $30^\circ$, $45^\circ$, $60^\circ$ y $75^\circ$. ¿Con cuál se obtiene el mayor alcance? ¿Qué pares de ángulos dan el mismo alcance? ¿En qué se diferencian sus trayectorias?
4. Ponga el ángulo en $0^\circ$ y $h_0 = 20\,\mathrm{m}$. Cambie $v_0$ entre $5$ y $15\,\mathrm{m/s}$. ¿Cambia el tiempo de vuelo? ¿Y el alcance? Explique por qué.
5. Con $h_0 = 20\,\mathrm{m}$ y $v_0 = 20\,\mathrm{m/s}$, busque el ángulo que da el mayor alcance. ¿Sigue siendo $45^\circ$?
6. Con $h_0 = 0$, compare la rapidez y el ángulo de impacto con $v_0$ y $\theta$. ¿Qué simetría observa? ¿Se mantiene si $h_0 > 0$?`,
  },
  exercises: [
    {
      id: 'b2-proy-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['proyectiles-componentes'],
      prompt: String.raw`Un jugador de baloncesto lanza el balón con una rapidez de $25\,\mathrm{m/s}$ formando un ángulo de $40^\circ$ sobre la horizontal. ¿Cuánto vale la componente **horizontal** de la velocidad inicial?`,
      format: 'numeric',
      unitHint: 'm/s',
    },
    {
      id: 'b2-proy-02',
      category: 'conceptual',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['proyectiles-independencia'],
      prompt: String.raw`Un balón se patea desde el suelo con un ángulo de $50^\circ$ sobre la horizontal. Sin resistencia del aire, ¿qué se puede afirmar de su velocidad y de su aceleración en el punto más alto de la trayectoria?`,
      format: 'choice',
      options: [
        'La velocidad es cero y la aceleración es cero.',
        String.raw`La velocidad es cero y la aceleración es $g$, dirigida hacia abajo.`,
        String.raw`La velocidad es horizontal y distinta de cero, y la aceleración es $g$, dirigida hacia abajo.`,
        'La velocidad es horizontal y distinta de cero, y la aceleración es cero.',
      ],
    },
    {
      id: 'b2-proy-03',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['proyectiles-lanzamiento-horizontal', 'proyectiles-independencia'],
      prompt: String.raw`Un niño lanza horizontalmente una pelota desde una azotea de $20\,\mathrm{m}$ de altura con una rapidez de $6.0\,\mathrm{m/s}$. Despreciando el aire, ¿a qué distancia horizontal de la base del edificio cae la pelota?`,
      format: 'numeric',
      unitHint: 'm',
    },
    {
      id: 'b2-proy-04',
      category: 'experimento',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['proyectiles-alcance', 'proyectiles-vuelo-altura'],
      prompt: String.raw`En el simulador, un proyectil sale del suelo ($h_0 = 0$) con $v_0 = 20\,\mathrm{m/s}$ y un ángulo de $30^\circ$. Ejecute la simulación y anote el alcance. Después, sin cambiar $v_0$ ni $h_0$, busque el **otro** ángulo de lanzamiento que produce el mismo alcance. ¿Cuál es la altura máxima del proyectil lanzado con ese segundo ángulo?`,
      format: 'numeric',
      unitHint: 'm',
      simulation: { key: 'proyectiles', params: { v0: 20, angulo: 30, h0: 0, g: 9.8 } },
    },
    {
      id: 'b2-proy-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['proyectiles-vuelo-altura', 'proyectiles-independencia'],
      prompt: String.raw`Desde el borde de un acantilado de $12\,\mathrm{m}$ de altura sobre una playa, un niño patea un balón con una rapidez de $15\,\mathrm{m/s}$ y un ángulo de $35^\circ$ sobre la horizontal. El balón cae en la arena. Despreciando el aire, ¿a qué distancia horizontal del pie del acantilado cae?`,
      format: 'numeric',
      unitHint: 'm',
    },
    {
      id: 'b2-proy-06',
      category: 'grafica',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['proyectiles-componentes', 'proyectiles-independencia'],
      prompt: String.raw`La gráfica muestra las componentes horizontal ($v_x$) y vertical ($v_y$, positiva hacia arriba) de la velocidad de un proyectil que sale del suelo y vuelve a él. ¿Con qué **rapidez** fue lanzado?`,
      format: 'numeric',
      unitHint: 'm/s',
      figure: {
        kind: 'line',
        title: 'Componentes de la velocidad frente al tiempo',
        x: { label: 't', unit: 's' },
        y: { label: 'v', unit: 'm/s' },
        series: [
          {
            name: 'v_x',
            points: [
              [0, 10],
              [0.5, 10],
              [1, 10],
              [1.5, 10],
              [2, 10],
              [2.5, 10],
              [3, 10],
            ],
          },
          {
            name: 'v_y',
            points: [
              [0, 14.7],
              [0.5, 9.8],
              [1, 4.9],
              [1.5, 0],
              [2, -4.9],
              [2.5, -9.8],
              [3, -14.7],
            ],
          },
        ],
      },
    },
    {
      id: 'b2-proy-07',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['proyectiles-alcance'],
      prompt: String.raw`**Verdadero o falso:** en terreno horizontal y sin aire, una piedra lanzada a $70^\circ$ sobre la horizontal llega más lejos que otra lanzada a $20^\circ$ con la misma rapidez, porque sube más alto y permanece más tiempo en el aire. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b2-proy-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['proyectiles-alcance', 'proyectiles-vuelo-altura', 'proyectiles-componentes'],
      prompt: String.raw`Un jardinero de béisbol quiere devolver la pelota al receptor, que está a $80\,\mathrm{m}$, sin que bote. La lanza con una rapidez de $30\,\mathrm{m/s}$ y la pelota sale y llega aproximadamente a la misma altura. (a) Determine los **dos** ángulos de lanzamiento posibles. (b) Para cada uno, calcule el tiempo de vuelo y la altura máxima. (c) Si un corredor intenta anotar mientras la pelota vuela, ¿qué ángulo conviene usar? Justifique. (d) Explique por qué existen dos soluciones y en qué se basa la condición de validez de la fórmula del alcance que usó. (e) Comente cómo cambiaría el resultado real si se tuviera en cuenta la resistencia del aire.`,
      format: 'open',
    },
  ],
};
