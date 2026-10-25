import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'caida-libre',
  title: 'Caída libre',
  summary:
    'Un cuerpo que cae solo bajo la acción de la gravedad describe un MRUA con aceleración g hacia abajo, la misma para todos los cuerpos si se desprecia el aire.',
  concepts: [
    { slug: 'caida-libre-aceleracion', name: 'Aceleración de caída libre (a = −g) e independencia de la masa' },
    { slug: 'caida-libre-tiempo-impacto', name: 'Tiempo de caída y velocidad de impacto' },
    { slug: 'caida-libre-validez', name: 'Validez del modelo sin resistencia del aire' },
  ],
  theory: String.raw`## Soltar un objeto

Si usted suelta las llaves, un mango o una pelota, el objeto no cae con velocidad constante: **cae cada vez más rápido**. Llamamos **caída libre** al movimiento de un cuerpo sobre el que solo actúa la gravedad, sin que el aire ni ninguna otra cosa influya de forma apreciable. Cerca de la superficie terrestre ese movimiento tiene una propiedad notable: la velocidad cambia **lo mismo en cada segundo**, unos $9.8\,\mathrm{m/s}$ por segundo, siempre hacia abajo. Es decir, la caída libre es un **movimiento rectilíneo uniformemente acelerado (MRUA)** cuya aceleración tiene módulo

$$g = 9.8\,\mathrm{m/s^2}$$

y está dirigida **hacia abajo**. El número $g$, la *aceleración de la gravedad*, es un **módulo**: siempre es positivo. El signo de la aceleración lo decide el eje que elijamos. Tomaremos $g$ constante: entre el ecuador y los polos solo varía entre $9.78$ y $9.83\,\mathrm{m/s^2}$, y apenas cambia en caídas de unos cientos de metros.

## Eje vertical y signos

En esta lección usamos un eje $y$ **vertical con sentido positivo hacia arriba** y el origen en el suelo. Con esa elección:

- la aceleración vale $a = -g = -9.8\,\mathrm{m/s^2}$ durante toda la caída;
- un objeto que cae tiene velocidad **negativa**, y su valor absoluto (la rapidez) aumenta;
- la altura $y$ disminuye desde $y_0 = h$ hasta $y = 0$ al llegar al suelo.

Si el objeto se **suelta desde el reposo** ($v_0 = 0$), las ecuaciones del MRUA quedan

$$v(t) = -g\,t, \qquad y(t) = h - \tfrac12 g\,t^2 .$$

La rapidez crece de forma **lineal** con el tiempo: al cabo de $1\,\mathrm{s}$ la velocidad vale $-9.8\,\mathrm{m/s}$; a los $2\,\mathrm{s}$, $-19.6\,\mathrm{m/s}$; a los $3\,\mathrm{s}$, $-29.4\,\mathrm{m/s}$. La gráfica $v$–$t$ es una recta de pendiente $-g$. La altura, en cambio, disminuye con el **cuadrado** del tiempo: la gráfica $y$–$t$ es un trozo de parábola que se inclina cada vez más.

> **Cuidado.** También puede elegir el eje hacia abajo; entonces $a = +g$ y la velocidad de caída es positiva. Ambas elecciones son correctas si se mantienen de principio a fin. Lo que no se puede hacer es mezclar convenciones dentro del mismo problema.

## Galileo: la masa no importa

Durante casi dos mil años se aceptó la idea de Aristóteles de que los cuerpos pesados caen más rápido que los ligeros. Galileo Galilei, hacia 1600, la puso a prueba con planos inclinados (que hacen la caída más lenta y permiten medirla) y con razonamientos ingeniosos. Su conclusión fue que, **si se elimina el efecto del aire, todos los cuerpos caen con la misma aceleración, sea cual sea su masa**.

Uno de sus argumentos es puramente lógico. Si una piedra pesada cayera más rápido que una ligera, al atarlas juntas la ligera debería frenar a la pesada, y el conjunto caería más despacio que la pesada sola. Pero el conjunto pesa todavía más, así que también debería caer más rápido. La contradicción solo desaparece si todas caen igual.

En 1971, el astronauta David Scott soltó un martillo y una pluma en la Luna, donde no hay aire, y ambos llegaron al suelo a la vez. Allí la aceleración de caída es de unos $1.6\,\mathrm{m/s^2}$, pero es la misma para los dos objetos.

> **Error frecuente.** «La bola pesada cae antes porque la Tierra la atrae con más fuerza.» Es cierto que la atrae con más fuerza (su peso es mayor), pero también cuesta más cambiar su velocidad, porque tiene más masa. Los dos efectos se compensan exactamente, como se verá en Dinámica. La aceleración de caída no depende de la masa.

## Tiempo de caída y velocidad de impacto

Dos preguntas típicas: ¿cuánto tarda en llegar al suelo un objeto soltado desde una altura $h$? ¿Con qué rapidez llega?

Al llegar al suelo, $y = 0$, de modo que $0 = h - \tfrac12 g\,t^2$. Al despejar el tiempo,

$$t_c = \sqrt{\frac{2h}{g}} .$$

Si se sustituye ese tiempo en $v = -g\,t$, se obtiene la rapidez de impacto:

$$|v| = g\,t_c = \sqrt{2 g h} .$$

Observe que **ambas magnitudes crecen con la raíz cuadrada de la altura**, no en proporción a ella. Desde una altura cuatro veces mayor, la caída dura el doble y el impacto se produce con el doble de rapidez, no con el cuádruple. Por ejemplo, desde $5\,\mathrm{m}$ la caída dura unos $1.0\,\mathrm{s}$ y desde $20\,\mathrm{m}$, unos $2.0\,\mathrm{s}$.

## Lo que se recorre en cada segundo

Como la rapidez aumenta, el objeto recorre más distancia en cada segundo que en el anterior. Partiendo del reposo, durante el primer segundo cae $4.9\,\mathrm{m}$; durante el segundo, $14.7\,\mathrm{m}$; durante el tercero, $24.5\,\mathrm{m}$. Esas distancias están en la proporción $1 : 3 : 5 : 7\ldots$, la «ley de los números impares» que Galileo encontró experimentalmente. Las distancias **acumuladas** ($4.9$, $19.6$ y $44.1\,\mathrm{m}$) crecen como $1 : 4 : 9$, es decir, como $t^2$.

## ¿Cuándo podemos despreciar el aire?

En la Tierra, el aire ejerce sobre todo cuerpo en movimiento una fuerza de resistencia opuesta a su velocidad. Esa fuerza **crece con la rapidez** y depende mucho de la forma y del tamaño del cuerpo. Por eso una hoja de papel extendida cae despacio y balanceándose, mientras que la misma hoja arrugada en forma de bola cae casi como una piedra: la masa es la misma, lo que cambia es la resistencia.

Si un cuerpo cae durante el tiempo suficiente, la resistencia termina por compensar su peso y la velocidad deja de aumentar: se alcanza la **velocidad terminal**. Es de alrededor de $1\,\mathrm{m/s}$ para una hoja de papel extendida, unos $9\,\mathrm{m/s}$ para una gota de lluvia grande y unos $55\,\mathrm{m/s}$ (cerca de $200\,\mathrm{km/h}$) para un paracaidista con el paracaídas cerrado.

Criterio práctico: **el modelo de caída libre es una buena aproximación cuando la rapidez que alcanza el cuerpo es mucho menor que su velocidad terminal.** Funciona bien para objetos compactos y densos (piedras, llaves, canicas, una pelota de béisbol) que caen desde unos pocos metros o unas decenas de metros. Falla para objetos ligeros y extensos (plumas, hojas, globos), para caídas muy largas (gotas de lluvia, paracaidistas) y cuando la rapidez es muy alta.

> **Cuidado.** Que el aire no se pueda despreciar no contradice a Galileo: él afirmó que todos los cuerpos caen igual **en ausencia de aire**. En el aire, la diferencia entre una pluma y un martillo se debe a la resistencia, no a la masa.`,
  formulas: [
    {
      name: 'Velocidad en caída libre desde el reposo',
      latex: String.raw`v(t) = -g\,t`,
      description:
        'La velocidad aumenta en módulo 9.8 m/s cada segundo. El signo menos indica que apunta hacia abajo (eje y hacia arriba).',
      variables: [
        { symbol: String.raw`v(t)`, meaning: 'Velocidad en el instante t (negativa: hacia abajo)', unit: 'm/s' },
        { symbol: String.raw`g`, meaning: 'Módulo de la aceleración de la gravedad (9.8 en la Tierra)', unit: 'm/s²' },
        { symbol: String.raw`t`, meaning: 'Tiempo desde que se suelta el objeto', unit: 's' },
      ],
      notes: 'Válida mientras el objeto está en el aire y la resistencia del aire es despreciable.',
    },
    {
      name: 'Altura en caída libre desde el reposo',
      latex: String.raw`y(t) = h - \tfrac12 g\,t^2`,
      description: 'Altura sobre el suelo en función del tiempo para un objeto soltado desde la altura h.',
      variables: [
        { symbol: String.raw`y(t)`, meaning: 'Altura sobre el suelo en el instante t', unit: 'm' },
        { symbol: String.raw`h`, meaning: 'Altura desde la que se suelta (y₀)', unit: 'm' },
        { symbol: String.raw`g`, meaning: 'Módulo de la aceleración de la gravedad', unit: 'm/s²' },
        { symbol: String.raw`t`, meaning: 'Tiempo desde que se suelta el objeto', unit: 's' },
      ],
      notes: 'Es la ecuación del MRUA con y₀ = h, v₀ = 0 y a = −g.',
    },
    {
      name: 'Tiempo de caída',
      latex: String.raw`t_c = \sqrt{\dfrac{2h}{g}}`,
      description: 'Tiempo que tarda en llegar al suelo un objeto soltado desde el reposo a una altura h.',
      variables: [
        { symbol: String.raw`t_c`, meaning: 'Tiempo de caída', unit: 's' },
        { symbol: String.raw`h`, meaning: 'Altura de caída', unit: 'm' },
        { symbol: String.raw`g`, meaning: 'Módulo de la aceleración de la gravedad', unit: 'm/s²' },
      ],
      notes: 'Crece con la raíz cuadrada de la altura: cuadruplicar h duplica el tiempo. No depende de la masa.',
    },
    {
      name: 'Rapidez de impacto',
      latex: String.raw`|v| = \sqrt{2gh}`,
      description: 'Rapidez con que llega al suelo un objeto soltado desde el reposo a una altura h.',
      variables: [
        { symbol: String.raw`|v|`, meaning: 'Rapidez al llegar al suelo (módulo de la velocidad)', unit: 'm/s' },
        { symbol: String.raw`h`, meaning: 'Altura de caída', unit: 'm' },
        { symbol: String.raw`g`, meaning: 'Módulo de la aceleración de la gravedad', unit: 'm/s²' },
      ],
      notes: 'Con el eje hacia arriba, la velocidad de impacto es v = −√(2gh).',
    },
  ],
  examples: [
    {
      title: 'Una maceta que cae de un balcón',
      statement: String.raw`Una maceta cae, partiendo del reposo, desde el borde de un balcón situado a $12\,\mathrm{m}$ del suelo. ¿Cuánto tarda en llegar al suelo y con qué velocidad llega? Desprecie la resistencia del aire.`,
      steps: [
        String.raw`Eje $y$ vertical hacia arriba con origen en el suelo. Datos: $y_0 = h = 12\,\mathrm{m}$, $v_0 = 0$, $a = -g = -9.8\,\mathrm{m/s^2}$. Al llegar al suelo, $y = 0$.`,
        String.raw`Ecuación de la altura: $0 = 12\,\mathrm{m} - \tfrac12 (9.8\,\mathrm{m/s^2})\,t^2 \Rightarrow t^2 = \dfrac{12\,\mathrm{m}}{4.9\,\mathrm{m/s^2}} = 2.45\,\mathrm{s^2}$.`,
        String.raw`Tiempo de caída: $t = \sqrt{2.45\,\mathrm{s^2}} = 1.56\,\mathrm{s}$ (la raíz negativa no tiene sentido físico, porque la maceta se suelta en $t = 0$).`,
        String.raw`Velocidad al llegar: $v = -g\,t = -(9.8\,\mathrm{m/s^2})(1.56\,\mathrm{s}) = -15.3\,\mathrm{m/s}$.`,
        String.raw`Comprobación con la otra fórmula: $|v| = \sqrt{2gh} = \sqrt{2(9.8\,\mathrm{m/s^2})(12\,\mathrm{m})} = \sqrt{235\,\mathrm{m^2/s^2}} = 15.3\,\mathrm{m/s}$ ✓.`,
      ],
      result: String.raw`$t_c = 1.56\,\mathrm{s}$ y $v = -15.3\,\mathrm{m/s}$ (es decir, $15.3\,\mathrm{m/s}$ hacia abajo).`,
      interpretation:
        'Son unos 55 km/h, la rapidez de un automóvil en la ciudad: por eso un objeto que cae desde un cuarto piso es peligroso. Despreciar el aire es razonable: una maceta es compacta y pesada, y 15 m/s está muy por debajo de su velocidad terminal.',
    },
    {
      title: 'La altura de un puente',
      statement: String.raw`Desde un puente se suelta una piedra y se observa que tarda $2.0\,\mathrm{s}$ en tocar el agua del río. ¿A qué altura sobre el agua está el puente? ¿Con qué rapidez llega la piedra al agua?`,
      steps: [
        String.raw`Origen en la superficie del agua y eje hacia arriba. La altura del puente es la incógnita $h$; $v_0 = 0$ y $t_c = 2.0\,\mathrm{s}$.`,
        String.raw`De $0 = h - \tfrac12 g\,t_c^2$: $h = \tfrac12 g\,t_c^2 = \tfrac12 (9.8\,\mathrm{m/s^2})(2.0\,\mathrm{s})^2 = (4.9\,\mathrm{m/s^2})(4.0\,\mathrm{s^2}) = 19.6\,\mathrm{m}$.`,
        String.raw`Velocidad al llegar: $v = -g\,t_c = -(9.8\,\mathrm{m/s^2})(2.0\,\mathrm{s}) = -19.6\,\mathrm{m/s}$; la rapidez es $19.6\,\mathrm{m/s}$.`,
      ],
      result: String.raw`$h \approx 20\,\mathrm{m}$ y la piedra llega al agua a unos $20\,\mathrm{m/s}$ (unos $71\,\mathrm{km/h}$).`,
      interpretation:
        'Medir un tiempo de caída es un modo sencillo de estimar alturas. Como la altura depende del cuadrado del tiempo, un error del 5 % al medir el tiempo produce un error de alrededor del 10 % en la altura.',
    },
    {
      title: 'La ley de los números impares',
      statement: String.raw`Una piedra se suelta desde lo alto de un acantilado de $80\,\mathrm{m}$. Construya una tabla con la distancia total caída al final de cada uno de los cuatro primeros segundos y con la distancia recorrida **durante** cada segundo.`,
      steps: [
        String.raw`Distancia total caída desde el reposo: $d(t) = h - y(t) = \tfrac12 g\,t^2 = (4.9\,\mathrm{m/s^2})\,t^2$.`,
        String.raw`Totales: $d(1\,\mathrm{s}) = 4.9\,\mathrm{m}$; $d(2\,\mathrm{s}) = 19.6\,\mathrm{m}$; $d(3\,\mathrm{s}) = 44.1\,\mathrm{m}$; $d(4\,\mathrm{s}) = 78.4\,\mathrm{m}$. Como $78.4\,\mathrm{m} < 80\,\mathrm{m}$, a los $4\,\mathrm{s}$ la piedra sigue en el aire.`,
        String.raw`Durante cada segundo (restando totales consecutivos): $4.9\,\mathrm{m}$, $19.6 - 4.9 = 14.7\,\mathrm{m}$, $44.1 - 19.6 = 24.5\,\mathrm{m}$ y $78.4 - 44.1 = 34.3\,\mathrm{m}$.`,
        String.raw`Cocientes respecto al primer segundo: $14.7/4.9 = 3$, $24.5/4.9 = 5$, $34.3/4.9 = 7$.`,
      ],
      result: String.raw`Las distancias recorridas en segundos sucesivos están en la proporción $1 : 3 : 5 : 7$, y las acumuladas en la proporción $1 : 4 : 9 : 16$.`,
      interpretation:
        'Cada segundo la piedra recorre 9.8 m más que en el segundo anterior, porque su rapidez media en cada segundo aumenta 9.8 m/s. La piedra llega al agua poco después, a los 4.04 s.',
    },
  ],
  simulation: {
    key: 'caida-libre',
    params: { y0: 20, v0: 0, g: 9.8 },
    guide: String.raw`1. Con $y_0 = 20\,\mathrm{m}$ y $v_0 = 0$, pulse **Iniciar**. Anote el tiempo hasta el suelo y la velocidad de impacto, y compruébelos con $t_c = \sqrt{2h/g}$ y $|v| = \sqrt{2gh}$.
2. Observe la gráfica $v$–$t$. ¿Qué forma tiene? Use la tabla de datos (cada $0.5\,\mathrm{s}$) para comprobar cuánto cambia la velocidad en cada medio segundo. ¿Qué magnitud física representa la pendiente?
3. Observe la gráfica $y$–$t$. Con la tabla, calcule cuánto baja la piedra en cada intervalo de $0.5\,\mathrm{s}$. ¿Esas distancias son iguales? ¿Siguen la proporción $1 : 3 : 5\ldots$?
4. Cuadruplique la altura ($y_0 = 80\,\mathrm{m}$). Antes de simular, prediga el nuevo tiempo de caída y la nueva rapidez de impacto. ¿Se cuadruplicaron?
5. Cambie $g$ a $1.6\,\mathrm{m/s^2}$ (Luna) y a $3.7\,\mathrm{m/s^2}$ (Marte) con la misma altura. ¿Cómo cambian el tiempo de caída y la rapidez de impacto?
6. Fíjese en que el simulador no pide la masa del objeto. ¿Por qué no hace falta? ¿Qué simplificación del modelo lo permite?`,
  },
  exercises: [
    {
      id: 'b2-caida-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['caida-libre-tiempo-impacto'],
      prompt: String.raw`Un obrero deja caer un tornillo desde lo alto de un andamio, a $45\,\mathrm{m}$ del suelo. Despreciando la resistencia del aire, ¿cuánto tarda el tornillo en llegar al suelo?`,
      format: 'numeric',
      unitHint: 's',
    },
    {
      id: 'b2-caida-02',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['caida-libre-aceleracion', 'caida-libre-validez'],
      prompt: String.raw`**Verdadero o falso:** si se sueltan a la vez, desde $1.5\,\mathrm{m}$ de altura, una bola de boliche de $7\,\mathrm{kg}$ y una pelota de tenis de $0.06\,\mathrm{kg}$, la bola de boliche llega al suelo claramente antes, porque la Tierra la atrae con una fuerza mucho mayor. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b2-caida-03',
      category: 'grafica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['caida-libre-aceleracion'],
      prompt: String.raw`Un robot explorador suelta una piedra en un planeta sin atmósfera apreciable. La gráfica muestra la velocidad de la piedra (eje $y$ positivo hacia arriba). ¿Cuánto vale $g$ en ese planeta? Dé el **módulo** de la aceleración de caída.`,
      format: 'numeric',
      unitHint: 'm/s²',
      figure: {
        kind: 'line',
        title: 'Velocidad de la piedra frente al tiempo',
        x: { label: 't', unit: 's' },
        y: { label: 'v', unit: 'm/s' },
        series: [
          {
            name: 'v(t)',
            points: [
              [0, 0],
              [0.5, -1.85],
              [1, -3.7],
              [1.5, -5.55],
              [2, -7.4],
              [2.5, -9.25],
              [3, -11.1],
            ],
          },
        ],
      },
    },
    {
      id: 'b2-caida-04',
      category: 'experimento',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['caida-libre-tiempo-impacto'],
      prompt: String.raw`En el simulador, el objeto se suelta desde el reposo a $y_0 = 80\,\mathrm{m}$ con $g = 9.8\,\mathrm{m/s^2}$. Ejecute la simulación y anote el tiempo hasta el suelo y la velocidad de impacto. Luego reduzca la altura a la **cuarta parte**, $y_0 = 20\,\mathrm{m}$, sin cambiar nada más. Antes de volver a simular, prediga el resultado y después compruébelo. ¿Cuál es la **rapidez** de impacto desde $20\,\mathrm{m}$?`,
      format: 'numeric',
      unitHint: 'm/s',
      simulation: { key: 'caida-libre', params: { y0: 80, v0: 0, g: 9.8 } },
    },
    {
      id: 'b2-caida-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['caida-libre-tiempo-impacto'],
      prompt: String.raw`Para medir la profundidad de un pozo, una estudiante suelta una piedra desde el brocal y oye el golpe contra el agua $3.0\,\mathrm{s}$ después de soltarla. El sonido viaja a $340\,\mathrm{m/s}$ con velocidad constante. Despreciando la resistencia del aire, ¿a qué profundidad, medida desde el brocal, está el agua?`,
      format: 'numeric',
      unitHint: 'm',
    },
    {
      id: 'b2-caida-06',
      category: 'numerica',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['caida-libre-tiempo-impacto'],
      prompt: String.raw`Un coco se desprende de una palmera a $15\,\mathrm{m}$ sobre la arena de una playa. Despreciando la resistencia del aire, ¿con qué **rapidez** llega a la arena?`,
      format: 'numeric',
      unitHint: 'm/s',
    },
    {
      id: 'b2-caida-07',
      category: 'conceptual',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['caida-libre-validez', 'caida-libre-aceleracion'],
      prompt: String.raw`¿En cuáles de estas situaciones es razonable describir el movimiento como caída libre, es decir, despreciar la resistencia del aire? Marque **todas** las que apliquen.`,
      format: 'choice',
      multiple: true,
      options: [
        String.raw`Unas llaves que se caen del bolsillo desde $1.2\,\mathrm{m}$ de altura.`,
        'Un paracaidista 30 s después de saltar del avión, todavía con el paracaídas cerrado.',
        String.raw`Una canica de acero que se suelta desde un segundo piso, a $6\,\mathrm{m}$ del suelo.`,
        'Una hoja de papel extendida que se suelta desde una mesa.',
        'Un martillo y una pluma soltados por un astronauta en la superficie de la Luna.',
        String.raw`Una gota de lluvia que cae desde una nube situada a $2\,\mathrm{km}$ de altura.`,
      ],
    },
    {
      id: 'b2-caida-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['caida-libre-aceleracion', 'caida-libre-tiempo-impacto', 'caida-libre-validez'],
      prompt: String.raw`Desde la azotea de un edificio de $30\,\mathrm{m}$ se suelta una pelota A. Exactamente $1.0\,\mathrm{s}$ después se suelta, desde el mismo punto, una pelota B. (a) Escriba las ecuaciones de la altura de cada pelota, tomando $t = 0$ cuando se suelta A y el eje hacia arriba con origen en el suelo. (b) La distancia vertical entre las pelotas mientras ambas caen, ¿aumenta, disminuye o se mantiene constante? Justifíquelo con números, por ejemplo en $t = 1.0$, $1.5$ y $2.0\,\mathrm{s}$. (c) ¿A qué altura está B cuando A llega al suelo? (d) Explique por qué el resultado de (b) no depende de las masas de las pelotas y discuta si es razonable despreciar el aire en esta situación.`,
      format: 'open',
    },
  ],
};
