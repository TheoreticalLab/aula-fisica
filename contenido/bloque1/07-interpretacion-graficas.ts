import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'interpretacion-graficas',
  title: 'Interpretación de gráficas',
  summary:
    'Cómo leer una gráfica física: variables y ejes, pendiente e intercepto de una recta, relaciones lineal, cuadrática e inversa, y el área bajo una gráfica formada por rectas.',
  concepts: [
    { slug: 'graf-pendiente-intercepto', name: 'Pendiente e intercepto de una recta' },
    { slug: 'graf-relaciones', name: 'Relaciones lineal, cuadrática e inversa' },
    { slug: 'graf-area', name: 'Área bajo una gráfica' },
  ],
  theory: String.raw`## Una gráfica es una tabla que se ve de un vistazo

En física, las gráficas muestran cómo cambia una magnitud cuando cambia otra. Una tabla con cien mediciones es difícil de interpretar; la misma información en una gráfica revela enseguida si la relación es una recta, una curva que crece cada vez más rápido o una que se aplana.

## Variables y ejes

- En el **eje horizontal** se coloca la **variable independiente**: la que se controla o elige (el tiempo, la masa que se cuelga de un resorte, el volumen de un recipiente).
- En el **eje vertical** se coloca la **variable dependiente**: la que responde (la posición, el alargamiento, la presión).
- Cada eje lleva el **nombre de la magnitud y su unidad**, por ejemplo «$t$ (s)» y «$x$ (m)». Sin unidades, una gráfica no se puede interpretar.

Se habla de «gráfica $y$–$x$» o «$y$ frente a $x$», nombrando primero la variable del eje vertical: la gráfica $x$–$t$ tiene la posición en el eje vertical y el tiempo en el horizontal.

> **Error frecuente.** Confundir la gráfica con la trayectoria. Una gráfica $x$–$t$ de un auto que va y vuelve por una calle recta tiene forma de «montaña», pero el auto nunca subió ninguna montaña: se movió sobre una línea.

**Leer datos** consiste en ir del valor de un eje, en línea recta, hasta la gráfica y de allí al otro eje. Leer **entre** puntos medidos (interpolar) suele ser fiable; leer **más allá** de ellos (extrapolar) es arriesgado, porque nada garantiza que la tendencia continúe.

## La recta: pendiente e intercepto

Cuando los puntos caen sobre una recta, la relación es **lineal**:

$$y = m\,x + b .$$

- La **pendiente** $m$ indica cuánto cambia $y$ por cada unidad que aumenta $x$. Se calcula con **dos puntos de la recta**, bien separados:
$$m = \frac{\Delta y}{\Delta x} = \frac{y_2 - y_1}{x_2 - x_1}.$$
- El **intercepto** (u ordenada en el origen) $b$ es el valor de $y$ cuando $x = 0$: el punto donde la recta corta el eje vertical.

La pendiente **tiene unidades**: las del eje vertical divididas entre las del horizontal. Y ahí está su significado físico. En una gráfica de volumen de agua (L) frente a tiempo (min), la pendiente en L/min es el **caudal**. En una gráfica de posición (m) frente a tiempo (s), la pendiente en m/s es la **velocidad**. En una gráfica de velocidad (m/s) frente a tiempo (s), la pendiente en m/s² es la **aceleración**.

El signo importa: pendiente positiva, $y$ crece con $x$; negativa, $y$ disminuye; cero, recta horizontal, $y$ no cambia.

> **Cuidado.** La pendiente **no** es $y/x$ en un punto, salvo que la recta pase por el origen. Si un tinaco ya tenía $20\,\mathrm{L}$ al empezar a llenarse, dividir el volumen final entre el tiempo total no da el caudal.

**Proporcionalidad directa.** Decimos que $y$ es directamente proporcional a $x$ ($y \propto x$) solo si $b = 0$: la recta pasa por el origen y, al duplicar $x$, se duplica $y$. Toda proporcionalidad directa es lineal, pero no toda relación lineal es una proporcionalidad.

## Relaciones no lineales

Dos relaciones aparecen muy a menudo en física:

- **Cuadrática**, $y = k\,x^2$: la gráfica es una parábola que se empina cada vez más. **Al duplicar $x$, $y$ se multiplica por 4**; al triplicarla, por 9. Ejemplo: la distancia de frenado de un auto crece con el cuadrado de su rapidez; ir al doble de rapidez requiere unas cuatro veces más distancia para detenerse.
- **Inversa**, $y = k/x$: la gráfica es una curva (hipérbola) que baja cada vez más despacio sin llegar nunca a cero. **Al duplicar $x$, $y$ se reduce a la mitad**; el producto $x\,y$ es constante. Ejemplo: el tiempo para recorrer una distancia fija es inversamente proporcional a la rapidez.

Para reconocerlas en una tabla, busque valores de $x$ que se dupliquen y observe qué le pasa a $y$. Otra técnica muy útil es **linealizar**: si sospecha que $y = k\,x^2$, represente $y$ frente a $x^2$; si sale una recta por el origen, la sospecha se confirma y la pendiente es $k$. Si sospecha $y = k/x$, represente $y$ frente a $1/x$.

> **Error frecuente.** Ver una curva decreciente y concluir que la relación es inversa. Una recta con pendiente negativa también decrece, pero corta los ejes; la relación inversa nunca llega a cero.

## Área bajo una gráfica

El **área** entre la gráfica y el eje horizontal también tiene significado físico, y sus unidades son las del eje vertical **multiplicadas** por las del horizontal.

El caso más importante es la gráfica velocidad–tiempo. Si la velocidad es constante, $v = 5\,\mathrm{m/s}$ durante $4\,\mathrm{s}$, el desplazamiento es $v\,\Delta t = 20\,\mathrm{m}$, que es justamente el área del rectángulo de base $4\,\mathrm{s}$ y altura $5\,\mathrm{m/s}$. Lo mismo ocurre cuando la gráfica está formada por segmentos rectos: el área se calcula dividiéndola en **rectángulos y triángulos** (o trapecios), y la suma de esas áreas es el **desplazamiento**.

- Rectángulo: base × altura.
- Triángulo: $\tfrac12$ × base × altura.
- Trapecio: $\tfrac12\,(y_1 + y_2)\,\Delta x$.

Si la gráfica está **por debajo del eje** (velocidades negativas), el área cuenta como **negativa**: el móvil se desplaza hacia $-x$. El desplazamiento total es la suma con signo; la **distancia recorrida** es la suma de las áreas sin signo.

En otras gráficas el área tiene otros significados: bajo una gráfica caudal–tiempo, el área es el volumen acumulado; bajo una gráfica de potencia–tiempo, la energía.

## Límites

Los datos reales tienen incertidumbre y no caen exactamente sobre una recta o una curva: se traza la recta que **mejor se ajusta** al conjunto, y la pendiente se calcula con puntos de esa recta, no necesariamente con datos medidos. Además, una relación encontrada en un intervalo de valores puede dejar de valer fuera de él: un resorte estirado demasiado ya no sigue una recta.`,
  formulas: [
    {
      name: 'Ecuación de una recta',
      latex: String.raw`y = m\,x + b`,
      description: 'Relación lineal entre la variable dependiente y y la independiente x.',
      variables: [
        { symbol: String.raw`y`, meaning: 'Variable dependiente (eje vertical)', unit: 'la de y' },
        { symbol: String.raw`x`, meaning: 'Variable independiente (eje horizontal)', unit: 'la de x' },
        { symbol: String.raw`m`, meaning: 'Pendiente', unit: 'unidad de y / unidad de x' },
        { symbol: String.raw`b`, meaning: 'Intercepto: valor de y cuando x = 0', unit: 'la de y' },
      ],
      notes: 'y es directamente proporcional a x solo si b = 0.',
    },
    {
      name: 'Pendiente entre dos puntos',
      latex: String.raw`m = \frac{\Delta y}{\Delta x} = \frac{y_2 - y_1}{x_2 - x_1}`,
      description: 'Cambio de la variable vertical por unidad de cambio de la horizontal. Use dos puntos de la recta, bien separados.',
      variables: [
        { symbol: String.raw`(x_1,\,y_1),\,(x_2,\,y_2)`, meaning: 'Dos puntos de la recta', unit: 'las de los ejes' },
      ],
      notes: 'En x–t la pendiente es la velocidad; en v–t, la aceleración.',
    },
    {
      name: 'Relaciones cuadrática e inversa',
      latex: String.raw`y = k\,x^2 \qquad\qquad y = \frac{k}{x}`,
      description: 'Cuadrática: al duplicar x, y se multiplica por 4. Inversa: al duplicar x, y se reduce a la mitad (x·y es constante).',
      variables: [
        { symbol: String.raw`k`, meaning: 'Constante de proporcionalidad', unit: 'la que haga homogénea la ecuación' },
      ],
      notes: 'Se linealizan representando y frente a x² o frente a 1/x.',
    },
    {
      name: 'Área bajo una gráfica de rectas',
      latex: String.raw`A_{\text{rect}} = b\,h, \qquad A_{\text{triáng}} = \tfrac12\,b\,h, \qquad A_{\text{trap}} = \tfrac12\,(y_1 + y_2)\,\Delta x`,
      description: 'El área entre la gráfica y el eje horizontal se calcula dividiéndola en figuras simples. Bajo una gráfica v–t es el desplazamiento.',
      variables: [
        { symbol: String.raw`b,\,\Delta x`, meaning: 'Base, medida en el eje horizontal', unit: 'la de x' },
        { symbol: String.raw`h,\,y_1,\,y_2`, meaning: 'Alturas, medidas en el eje vertical', unit: 'la de y' },
      ],
      notes: 'Las unidades del área son (unidad de y) × (unidad de x). Las áreas bajo el eje cuentan con signo negativo.',
    },
  ],
  examples: [
    {
      title: 'Pendiente e intercepto de un resorte',
      statement: String.raw`Se cuelgan masas de un resorte y se mide su longitud: $0\,\mathrm{g} \to 12.0\,\mathrm{cm}$; $100\,\mathrm{g} \to 14.5\,\mathrm{cm}$; $200\,\mathrm{g} \to 17.0\,\mathrm{cm}$; $300\,\mathrm{g} \to 19.5\,\mathrm{cm}$. Halle la pendiente y el intercepto de la gráfica longitud–masa, interprételos y prediga la longitud con $250\,\mathrm{g}$.`,
      steps: [
        String.raw`La masa es la variable independiente (eje horizontal) y la longitud la dependiente (eje vertical). Cada $100\,\mathrm{g}$ la longitud aumenta $2.5\,\mathrm{cm}$: los puntos están sobre una recta.`,
        String.raw`Pendiente con los puntos extremos: $m = \dfrac{19.5\,\mathrm{cm} - 12.0\,\mathrm{cm}}{300\,\mathrm{g} - 0\,\mathrm{g}} = \dfrac{7.5\,\mathrm{cm}}{300\,\mathrm{g}} = 0.025\,\mathrm{cm/g}$.`,
        String.raw`Intercepto: sin masa colgada ($M = 0$) la longitud es $b = 12.0\,\mathrm{cm}$.`,
        String.raw`Ecuación, llamando $M$ a la masa colgada para no confundirla con la pendiente: $L = 12.0\,\mathrm{cm} + (0.025\,\mathrm{cm/g})\,M$. Para $M = 250\,\mathrm{g}$: $L = 12.0 + 0.025\times250 = 18.25\,\mathrm{cm} \approx 18.3\,\mathrm{cm}$.`,
      ],
      result: String.raw`$m = 0.025\,\mathrm{cm/g}$ (es decir, $2.5\,\mathrm{cm}$ por cada $100\,\mathrm{g}$), $b = 12.0\,\mathrm{cm}$ y $L(250\,\mathrm{g}) \approx 18.3\,\mathrm{cm}$.`,
      interpretation: 'El intercepto es la longitud natural del resorte (sin carga) y la pendiente indica cuánto se estira por gramo. La longitud no es proporcional a la masa (b ≠ 0), pero el alargamiento L − 12.0 cm sí lo es. La predicción para 250 g es una interpolación, y por eso es fiable.',
    },
    {
      title: 'Reconocer una relación a partir de una tabla',
      statement: String.raw`(a) Distancia de frenado $d$ de un auto según su rapidez $v$: $10\,\mathrm{m/s} \to 6\,\mathrm{m}$; $20 \to 24\,\mathrm{m}$; $30 \to 54\,\mathrm{m}$; $40 \to 96\,\mathrm{m}$. (b) Tiempo $t$ para recorrer $120\,\mathrm{km}$ según la rapidez: $40\,\mathrm{km/h} \to 3.0\,\mathrm{h}$; $60 \to 2.0\,\mathrm{h}$; $80 \to 1.5\,\mathrm{h}$; $120 \to 1.0\,\mathrm{h}$. Identifique el tipo de relación en cada caso.`,
      steps: [
        String.raw`(a) Al duplicar $v$ de $10$ a $20\,\mathrm{m/s}$, $d$ pasa de $6$ a $24\,\mathrm{m}$: se multiplica por 4. De $20$ a $40$, de $24$ a $96$: otra vez por 4. Es **cuadrática**.`,
        String.raw`Constante: $k = d/v^2 = 6/100 = 0.06\,\mathrm{s^2/m}$, igual para todos los pares ($54/900 = 0.06$ ✓). La gráfica de $d$ frente a $v^2$ sería una recta por el origen de pendiente $0.06\,\mathrm{s^2/m}$.`,
        String.raw`(b) Al duplicar $v$ de $40$ a $80\,\mathrm{km/h}$, $t$ pasa de $3.0$ a $1.5\,\mathrm{h}$: se reduce a la mitad. Además $v\,t = 120\,\mathrm{km}$ en todos los casos. Es **inversa**: $t = (120\,\mathrm{km})/v$.`,
      ],
      result: String.raw`(a) Cuadrática, $d = (0.06\,\mathrm{s^2/m})\,v^2$. (b) Inversa, $t = (120\,\mathrm{km})/v$.`,
      interpretation: 'Las dos gráficas son curvas, pero se distinguen fácilmente con la prueba de duplicar. El resultado (a) explica por qué el exceso de velocidad es tan peligroso: a 20 m/s (72 km/h) se necesitan cuatro veces más metros para frenar que a 10 m/s.',
    },
    {
      title: 'Desplazamiento a partir de una gráfica velocidad–tiempo',
      statement: String.raw`La velocidad de un motoconcho aumenta de manera uniforme de $4\,\mathrm{m/s}$ a $10\,\mathrm{m/s}$ en $6\,\mathrm{s}$: su gráfica $v$–$t$ es un segmento recto. ¿Cuánto se desplaza en ese intervalo?`,
      steps: [
        String.raw`El desplazamiento es el área bajo la gráfica $v$–$t$ entre $t = 0$ y $t = 6\,\mathrm{s}$. La figura es un trapecio.`,
        String.raw`Dividimos en un rectángulo de altura $4\,\mathrm{m/s}$ y base $6\,\mathrm{s}$: $A_1 = (4\,\mathrm{m/s})(6\,\mathrm{s}) = 24\,\mathrm{m}$.`,
        String.raw`Y un triángulo encima, de base $6\,\mathrm{s}$ y altura $10 - 4 = 6\,\mathrm{m/s}$: $A_2 = \tfrac12(6\,\mathrm{s})(6\,\mathrm{m/s}) = 18\,\mathrm{m}$.`,
        String.raw`Total: $\Delta x = 24 + 18 = 42\,\mathrm{m}$. Con la fórmula del trapecio: $\tfrac12(4 + 10)(6) = 42\,\mathrm{m}$ ✓.`,
      ],
      result: String.raw`$\Delta x = 42\,\mathrm{m}$.`,
      interpretation: String.raw`Las unidades del área son $(\mathrm{m/s})\times\mathrm{s} = \mathrm{m}$, como corresponde a un desplazamiento. El resultado está entre $4\times6 = 24\,\mathrm{m}$ (si hubiera ido siempre a $4\,\mathrm{m/s}$) y $10\times6 = 60\,\mathrm{m}$ (si hubiera ido siempre a $10\,\mathrm{m/s}$): es razonable.`,
    },
  ],
  simulation: {
    key: 'movimiento-rectilineo',
    params: { x0: 0, v0: 2, a: 0, tMax: 10 },
    guide: String.raw`1. Con $x_0 = 0$, $v_0 = 2\,\mathrm{m/s}$ y $a = 0$, pulse **Iniciar**. Use la tabla de datos para calcular la pendiente de la gráfica $x$–$t$. ¿Con qué parámetro coincide?
2. Cambie $x_0$ a $10\,\mathrm{m}$. ¿Qué cambia en la recta $x$–$t$: la pendiente o el intercepto?
3. Ponga $x_0 = 0$, $v_0 = 0$ y $a = 1\,\mathrm{m/s^2}$. La gráfica $x$–$t$ ya no es una recta. Compare en la tabla $x$ en $t = 2\,\mathrm{s}$ y en $t = 4\,\mathrm{s}$, y en $t = 3\,\mathrm{s}$ y $t = 6\,\mathrm{s}$. ¿Qué tipo de relación es?
4. Con esos mismos parámetros, calcule el área del triángulo bajo la gráfica $v$–$t$ entre $0$ y $6\,\mathrm{s}$ y compárela con $x(6\,\mathrm{s}) - x(0)$.
5. Ponga $v_0 = 6\,\mathrm{m/s}$ y $a = -1\,\mathrm{m/s^2}$. ¿En qué instante corta la gráfica $v$–$t$ el eje del tiempo? Compare el área positiva (de $0$ a $6\,\mathrm{s}$) con la negativa (de $6$ a $10\,\mathrm{s}$) y relaciónelas con lo que muestra la tabla de posiciones.`,
  },
  exercises: [
    {
      id: 'b1-graf-01',
      category: 'grafica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['graf-pendiente-intercepto'],
      prompt: 'La gráfica muestra el volumen de agua en un tinaco mientras se llena con una tubería. ¿A qué ritmo entra el agua, en litros por minuto?',
      format: 'numeric',
      unitHint: 'L/min',
      figure: {
        kind: 'line',
        title: 'Volumen de agua en el tinaco',
        x: { label: 't', unit: 'min' },
        y: { label: 'V', unit: 'L' },
        series: [
          {
            name: 'V(t)',
            points: [
              [0, 20],
              [5, 120],
              [10, 220],
              [15, 320],
            ],
          },
        ],
      },
    },
    {
      id: 'b1-graf-02',
      category: 'grafica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['graf-relaciones'],
      prompt: 'La gráfica muestra la presión de un gas encerrado en un cilindro, a temperatura constante, para distintos volúmenes. ¿Qué tipo de relación hay entre la presión y el volumen?',
      format: 'choice',
      options: ['Lineal creciente', 'Lineal decreciente', 'Cuadrática', 'Inversa'],
      figure: {
        kind: 'line',
        title: 'Presión frente a volumen',
        x: { label: 'V', unit: 'L' },
        y: { label: 'P', unit: 'kPa' },
        series: [
          {
            name: 'P(V)',
            points: [
              [1, 120],
              [2, 60],
              [3, 40],
              [4, 30],
              [6, 20],
            ],
          },
        ],
      },
    },
    {
      id: 'b1-graf-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['graf-pendiente-intercepto', 'graf-relaciones'],
      prompt: String.raw`**Verdadero o falso:** si la gráfica de $y$ frente a $x$ es una línea recta, entonces $y$ es directamente proporcional a $x$. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b1-graf-04',
      category: 'grafica',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['graf-area'],
      prompt: String.raw`La gráfica muestra la velocidad de un carrito que parte del reposo sobre una vía recta. ¿Cuánto se desplaza entre $t = 0$ y $t = 10\,\mathrm{s}$?`,
      format: 'numeric',
      unitHint: 'm',
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
              [4, 8],
              [10, 8],
            ],
          },
        ],
      },
    },
    {
      id: 'b1-graf-05',
      category: 'experimento',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['graf-area', 'graf-pendiente-intercepto'],
      prompt: String.raw`En el simulador, fije $x_0 = -10\,\mathrm{m}$, $v_0 = 6\,\mathrm{m/s}$, $a = -1.5\,\mathrm{m/s^2}$ y una duración de $10\,\mathrm{s}$. Observe la gráfica $v$–$t$: es una recta que corta el eje del tiempo. Usando áreas bajo la gráfica $v$–$t$, determine la **distancia total recorrida** por el móvil entre $t = 0$ y $t = 8\,\mathrm{s}$. Compruebe su resultado con la tabla de posiciones.`,
      format: 'numeric',
      unitHint: 'm',
      simulation: { key: 'movimiento-rectilineo', params: { x0: -10, v0: 6, a: -1.5, tMax: 10 } },
    },
    {
      id: 'b1-graf-06',
      category: 'grafica',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['graf-pendiente-intercepto'],
      prompt: 'La gráfica muestra la posición de una persona que camina por un andén recto. ¿Cuál es la pendiente de la recta, con su signo y sus unidades?',
      format: 'numeric',
      unitHint: 'm/s',
      figure: {
        kind: 'line',
        title: 'Posición frente al tiempo',
        x: { label: 't', unit: 's' },
        y: { label: 'x', unit: 'm' },
        series: [
          {
            name: 'x(t)',
            points: [
              [0, 12],
              [2, 9],
              [4, 6],
              [6, 3],
              [8, 0],
            ],
          },
        ],
      },
    },
    {
      id: 'b1-graf-07',
      category: 'experimento',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['graf-relaciones'],
      prompt: String.raw`En el simulador, fije $x_0 = 0$, $v_0 = 0$, $a = 0.8\,\mathrm{m/s^2}$ y una duración de $10\,\mathrm{s}$. Observe que la gráfica $x$–$t$ es una curva. Lea en la tabla de datos la posición en $t = 5\,\mathrm{s}$ y en $t = 10\,\mathrm{s}$. ¿Cuánto vale el cociente $x(10\,\mathrm{s})/x(5\,\mathrm{s})$?`,
      format: 'numeric',
      unitHint: 'adimensional',
      simulation: { key: 'movimiento-rectilineo', params: { x0: 0, v0: 0, a: 0.8, tMax: 10 } },
    },
    {
      id: 'b1-graf-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['graf-relaciones', 'graf-pendiente-intercepto'],
      prompt: String.raw`Una bola rueda desde el reposo por una rampa larga. Se mide la distancia recorrida $d$ en distintos instantes:

- $t = 0\,\mathrm{s}$: $d = 0\,\mathrm{cm}$
- $t = 1\,\mathrm{s}$: $d = 5\,\mathrm{cm}$
- $t = 2\,\mathrm{s}$: $d = 20\,\mathrm{cm}$
- $t = 3\,\mathrm{s}$: $d = 45\,\mathrm{cm}$
- $t = 4\,\mathrm{s}$: $d = 80\,\mathrm{cm}$

(a) Dibuje la gráfica $d$–$t$ con los ejes rotulados. ¿Es una relación lineal? Justifique con los datos.
(b) Identifique el tipo de relación usando la prueba de duplicar el tiempo.
(c) Construya una tabla de $d$ frente a $t^2$, represéntela y calcule la pendiente con sus unidades.
(d) Escriba la ecuación que relaciona $d$ y $t$ y prediga $d$ para $t = 5\,\mathrm{s}$. ¿Es una interpolación o una extrapolación? ¿Qué podría hacer que la predicción falle?`,
      format: 'open',
    },
  ],
};
