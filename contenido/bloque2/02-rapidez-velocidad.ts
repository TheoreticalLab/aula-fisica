import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'rapidez-velocidad',
  title: 'Rapidez y velocidad',
  summary:
    'La rapidez media compara la distancia recorrida con el tiempo; la velocidad media compara el desplazamiento con el tiempo y tiene signo. La velocidad instantánea es la pendiente de la recta tangente a la gráfica x–t.',
  concepts: [
    { slug: 'rapidez-velocidad-rapidez-media', name: 'Rapidez media' },
    { slug: 'rapidez-velocidad-velocidad-media', name: 'Velocidad media y pendiente de la secante' },
    { slug: 'rapidez-velocidad-instantanea', name: 'Velocidad instantánea como pendiente de la tangente' },
    { slug: 'rapidez-velocidad-unidades', name: 'Unidades y conversiones de velocidad' },
  ],
  theory: String.raw`## Qué tan deprisa y hacia dónde

En la vida diaria usamos «rapidez» y «velocidad» como sinónimos. En física no lo son. La **rapidez** responde a *qué tan deprisa* se mueve algo. La **velocidad** responde además a *hacia dónde*: incluye el sentido del movimiento. La diferencia es la misma que hay entre distancia recorrida y desplazamiento.

## Rapidez media

La **rapidez media** en un intervalo es la distancia recorrida dividida entre el tiempo empleado:

$$r_m = \frac{d}{\Delta t}.$$

Es un escalar y **nunca es negativa**. Si un corredor recorre $5\,\mathrm{km}$ por el Malecón en $25\,\mathrm{min}$, su rapidez media es $5000\,\mathrm{m}/1500\,\mathrm{s} \approx 3.3\,\mathrm{m/s}$, aunque en algunos tramos haya ido más deprisa y en otros más despacio, o se haya detenido en un semáforo. La rapidez media no dice nada de esos detalles: es la rapidez constante que habría permitido recorrer la misma distancia en el mismo tiempo.

## Velocidad media

La **velocidad media** es el desplazamiento dividido entre el tiempo:

$$v_m = \frac{\Delta x}{\Delta t} = \frac{x_f - x_i}{t_f - t_i}.$$

Tiene **signo**: positivo si el desplazamiento fue hacia $+x$ y negativo si fue hacia $-x$. Si un taxi hace un viaje de ida y vuelta y termina donde empezó, su velocidad media es **cero**, aunque su rapidez media sea de decenas de km/h.

En general $|v_m| \le r_m$, porque $|\Delta x| \le d$. Ambas coinciden en valor absoluto solo si el móvil no cambia de sentido.

> **Error frecuente.** Calcular la rapidez media de un viaje como el **promedio de las rapideces** de cada tramo. Si una persona va a la playa a $90\,\mathrm{km/h}$ y vuelve a $60\,\mathrm{km/h}$, su rapidez media no es $75\,\mathrm{km/h}$: pasa más tiempo en el tramo lento, y ese tramo pesa más. Hay que dividir la distancia **total** entre el tiempo **total**.

## Interpretación gráfica: la pendiente de una secante

En la gráfica $x$–$t$, elija dos puntos de la curva, $(t_1, x_1)$ y $(t_2, x_2)$, y únalos con una recta (una **secante**). Su pendiente es

$$\frac{x_2 - x_1}{t_2 - t_1} = v_m .$$

Es decir, **la velocidad media entre dos instantes es la pendiente de la secante que une los dos puntos correspondientes de la gráfica $x$–$t$**. En el MRU la gráfica es una recta y todas las secantes coinciden con ella; por eso la velocidad media vale lo mismo en cualquier intervalo. Cuando la gráfica es curva, cada intervalo da una pendiente distinta.

## Velocidad instantánea: la pendiente de la tangente

El velocímetro de un auto no muestra una media de todo el viaje: muestra lo que pasa **en este momento**. ¿Cómo se define la velocidad en un instante si en un instante no hay desplazamiento?

La idea es calcular velocidades medias en intervalos **cada vez más cortos** que empiezan en el instante que nos interesa. Por ejemplo, para una pelota que rueda por una rampa con $x = t^2$ (en metros y segundos), las velocidades medias a partir de $t = 3\,\mathrm{s}$ son:

| Intervalo | $\Delta x$ | $\Delta t$ | $v_m$ |
|---|---|---|---|
| de 3 s a 5 s | $25 - 9 = 16\,\mathrm{m}$ | $2\,\mathrm{s}$ | $8.0\,\mathrm{m/s}$ |
| de 3 s a 4 s | $16 - 9 = 7\,\mathrm{m}$ | $1\,\mathrm{s}$ | $7.0\,\mathrm{m/s}$ |
| de 3 s a 3.5 s | $12.25 - 9 = 3.25\,\mathrm{m}$ | $0.5\,\mathrm{s}$ | $6.5\,\mathrm{m/s}$ |
| de 3 s a 3.1 s | $9.61 - 9 = 0.61\,\mathrm{m}$ | $0.1\,\mathrm{s}$ | $6.1\,\mathrm{m/s}$ |

Los valores se acercan cada vez más a $6\,\mathrm{m/s}$. Gráficamente, al acercar el segundo punto, la secante gira hasta confundirse con la **recta tangente**: la recta que toca la curva en el punto de $t = 3\,\mathrm{s}$ y sigue su misma inclinación justo allí.

> **Velocidad instantánea.** Es la pendiente de la recta tangente a la gráfica $x$–$t$ en el instante considerado. Para calcularla, se dibuja la tangente, se eligen dos puntos cualesquiera **de la tangente** (bien separados, para leerlos con precisión) y se divide la diferencia de posiciones entre la diferencia de tiempos.

Consecuencias que se leen directamente en la gráfica:

- Si la tangente sube, $v > 0$; si baja, $v < 0$; si es horizontal, $v = 0$ en ese instante (punto de retorno o reposo).
- Cuanto más empinada es la tangente, mayor es la rapidez.
- La **rapidez instantánea** es el valor absoluto de la velocidad instantánea, $|v|$. Es lo que marca el velocímetro.

> **Cuidado.** La velocidad instantánea **no** es $x/t$ en un punto. Ese cociente es la pendiente de la recta que une el origen de la gráfica con el punto, y solo coincide con la velocidad si el movimiento es uniforme y empezó en $x = 0$.

## Unidades

En el SI la velocidad se mide en metros por segundo, $\mathrm{m/s}$. En las carreteras se usa el $\mathrm{km/h}$:

$$1\,\mathrm{km/h} = \frac{1000\,\mathrm{m}}{3600\,\mathrm{s}} = \frac{1}{3.6}\,\mathrm{m/s}, \qquad 1\,\mathrm{m/s} = 3.6\,\mathrm{km/h}.$$

Para pasar de km/h a m/s se divide entre 3.6; para pasar de m/s a km/h se multiplica por 3.6. En el béisbol y en los países anglosajones también se usan millas por hora: $1\,\mathrm{mph} \approx 0.447\,\mathrm{m/s} \approx 1.61\,\mathrm{km/h}$. Como comprobación rápida de órdenes de magnitud: una persona camina a unos $1.4\,\mathrm{m/s}$ (5 km/h), un velocista de élite corre a unos $10\,\mathrm{m/s}$ y una guagua en la autopista va a unos $25\,\mathrm{m/s}$ (90 km/h).

## Límites del modelo

Una tangente dibujada a mano tiene incertidumbre: dos estudiantes trazarán rectas algo distintas y obtendrán valores ligeramente diferentes. Esto no es un defecto del concepto, sino de la medición. Con una tabla de datos se obtiene una buena estimación usando un intervalo corto alrededor del instante de interés (por ejemplo, de $t - 0.5\,\mathrm{s}$ a $t + 0.5\,\mathrm{s}$).`,
  formulas: [
    {
      name: 'Rapidez media',
      latex: String.raw`r_m = \frac{d}{\Delta t}`,
      description: 'Distancia total recorrida dividida entre el tiempo total. Nunca es negativa.',
      variables: [
        { symbol: String.raw`r_m`, meaning: 'Rapidez media', unit: 'm/s' },
        { symbol: String.raw`d`, meaning: 'Distancia recorrida', unit: 'm' },
        { symbol: String.raw`\Delta t`, meaning: 'Tiempo empleado', unit: 's' },
      ],
      notes: 'Incluye los tiempos en que el móvil estuvo detenido.',
    },
    {
      name: 'Velocidad media',
      latex: String.raw`v_m = \frac{\Delta x}{\Delta t} = \frac{x_f - x_i}{t_f - t_i}`,
      description:
        'Desplazamiento dividido entre el tiempo. Tiene signo; es la pendiente de la secante a la gráfica x–t entre los dos instantes.',
      variables: [
        { symbol: String.raw`v_m`, meaning: 'Velocidad media (con signo)', unit: 'm/s' },
        { symbol: String.raw`\Delta x`, meaning: 'Desplazamiento', unit: 'm' },
        { symbol: String.raw`t_i,\,t_f`, meaning: 'Instantes inicial y final', unit: 's' },
      ],
      notes: 'Se cumple |v_m| ≤ r_m; son iguales solo si el móvil no cambia de sentido.',
    },
    {
      name: 'Velocidad instantánea (pendiente de la tangente)',
      latex: String.raw`v(t_0) = \frac{x_B - x_A}{t_B - t_A}\quad \text{con } A \text{ y } B \text{ sobre la recta tangente en } t_0`,
      description:
        'Pendiente de la recta tangente a la gráfica x–t en el instante t₀. Su valor absoluto es la rapidez instantánea.',
      variables: [
        { symbol: String.raw`v(t_0)`, meaning: 'Velocidad instantánea en t₀', unit: 'm/s' },
        { symbol: String.raw`(t_A, x_A),\,(t_B, x_B)`, meaning: 'Dos puntos de la recta tangente (no de la curva)', unit: 's, m' },
      ],
      notes: 'Se aproxima con la velocidad media en un intervalo muy corto que contenga a t₀.',
    },
    {
      name: 'Conversión de unidades',
      latex: String.raw`1\,\mathrm{m/s} = 3.6\,\mathrm{km/h}`,
      description: 'Para pasar de km/h a m/s se divide entre 3.6; de m/s a km/h se multiplica por 3.6.',
      variables: [
        { symbol: String.raw`\mathrm{m/s}`, meaning: 'Metro por segundo (unidad SI)', unit: 'm/s' },
        { symbol: String.raw`\mathrm{km/h}`, meaning: 'Kilómetro por hora', unit: 'km/h' },
      ],
      notes: 'Proviene de 1 km = 1000 m y 1 h = 3600 s.',
    },
  ],
  examples: [
    {
      title: 'Ida y vuelta a la playa',
      statement: String.raw`Una familia viaja $30\,\mathrm{km}$ por una carretera recta hasta la playa a $90\,\mathrm{km/h}$ constantes y regresa por el mismo camino a $60\,\mathrm{km/h}$. Calcule la rapidez media y la velocidad media del viaje completo.`,
      steps: [
        String.raw`Tiempo de ida: $t_1 = \dfrac{30\,\mathrm{km}}{90\,\mathrm{km/h}} = \dfrac{1}{3}\,\mathrm{h} = 20\,\mathrm{min}$. Tiempo de vuelta: $t_2 = \dfrac{30\,\mathrm{km}}{60\,\mathrm{km/h}} = 0.5\,\mathrm{h} = 30\,\mathrm{min}$.`,
        String.raw`Distancia total: $d = 60\,\mathrm{km}$. Tiempo total: $\Delta t = 20 + 30 = 50\,\mathrm{min} = \tfrac{5}{6}\,\mathrm{h}$.`,
        String.raw`Rapidez media: $r_m = \dfrac{60\,\mathrm{km}}{5/6\,\mathrm{h}} = 72\,\mathrm{km/h} = \dfrac{72}{3.6}\,\mathrm{m/s} = 20\,\mathrm{m/s}$.`,
        String.raw`Velocidad media: la familia termina donde empezó, $\Delta x = 0$, así que $v_m = 0$.`,
      ],
      result: String.raw`$r_m = 72\,\mathrm{km/h} = 20\,\mathrm{m/s}$ y $v_m = 0$.`,
      interpretation:
        'La rapidez media (72 km/h) es menor que el promedio de las rapideces (75 km/h) porque el viaje lento dura más y pesa más en la media. La velocidad media es nula porque el desplazamiento total es nulo.',
    },
    {
      title: 'Velocidad instantánea con la tangente',
      statement: String.raw`La posición de una pelota que rueda por una rampa es $x = (1\,\mathrm{m/s^2})\,t^2$. Se dibuja la recta tangente a la gráfica $x$–$t$ en $t = 3\,\mathrm{s}$ y se observa que pasa por los puntos $(1.5\,\mathrm{s},\,0)$ y $(4.5\,\mathrm{s},\,18\,\mathrm{m})$. Halle la velocidad instantánea en $t = 3\,\mathrm{s}$ y compárela con la velocidad media entre $t = 3\,\mathrm{s}$ y $t = 4\,\mathrm{s}$.`,
      steps: [
        String.raw`Pendiente de la tangente: $v(3\,\mathrm{s}) = \dfrac{18\,\mathrm{m} - 0}{4.5\,\mathrm{s} - 1.5\,\mathrm{s}} = \dfrac{18\,\mathrm{m}}{3.0\,\mathrm{s}} = 6.0\,\mathrm{m/s}$.`,
        String.raw`Comprobación: la tangente debe pasar por el punto de la curva en $t = 3\,\mathrm{s}$, $x = 9\,\mathrm{m}$. En efecto, $0 + 6.0\,\mathrm{m/s}\times(3 - 1.5)\,\mathrm{s} = 9\,\mathrm{m}$ ✓.`,
        String.raw`Velocidad media entre 3 s y 4 s: $v_m = \dfrac{16\,\mathrm{m} - 9\,\mathrm{m}}{1\,\mathrm{s}} = 7.0\,\mathrm{m/s}$.`,
      ],
      result: String.raw`$v(3\,\mathrm{s}) = 6.0\,\mathrm{m/s}$; la velocidad media entre 3 s y 4 s es $7.0\,\mathrm{m/s}$.`,
      interpretation:
        'La velocidad media del intervalo es mayor que la instantánea al inicio del intervalo porque la pelota va cada vez más deprisa. Al acortar el intervalo, la velocidad media se acerca a 6.0 m/s (ver la tabla de la teoría).',
    },
    {
      title: 'La carrera de 100 m',
      statement: String.raw`Un velocista recorre $100\,\mathrm{m}$ en línea recta en $9.58\,\mathrm{s}$. Calcule su rapidez media en m/s y en km/h.`,
      steps: [
        String.raw`Como no cambia de sentido, la rapidez media y el valor de la velocidad media coinciden: $r_m = \dfrac{100\,\mathrm{m}}{9.58\,\mathrm{s}} = 10.4\,\mathrm{m/s}$.`,
        String.raw`Conversión: $10.44\,\mathrm{m/s} \times 3.6 = 37.6\,\mathrm{km/h}$.`,
      ],
      result: String.raw`$r_m \approx 10.4\,\mathrm{m/s} \approx 37.6\,\mathrm{km/h}$.`,
      interpretation:
        'Es una media: el corredor parte del reposo, así que en la salida va mucho más despacio y en la parte central de la carrera supera los 12 m/s (más de 43 km/h).',
    },
  ],
  simulation: {
    key: 'movimiento-rectilineo',
    params: { x0: 0, v0: 0, a: 1, tMax: 10 },
    guide: String.raw`1. Con $x_0 = 0$, $v_0 = 0$ y $a = 1\,\mathrm{m/s^2}$, pulse **Iniciar**. ¿La gráfica $x$–$t$ es una recta? ¿Qué indica eso sobre la velocidad?
2. Con la tabla, calcule la velocidad media entre $t = 2\,\mathrm{s}$ y $t = 8\,\mathrm{s}$, luego entre $4\,\mathrm{s}$ y $6\,\mathrm{s}$. Compare ambos valores con la lectura de $v$ en $t = 5\,\mathrm{s}$.
3. Calcule la velocidad media entre $t = 5\,\mathrm{s}$ y $t = 6\,\mathrm{s}$. ¿Es mayor o menor que $v(5\,\mathrm{s})$? Explique por qué.
4. Sobre la gráfica $x$–$t$, trace a ojo la tangente en $t = 6\,\mathrm{s}$, lea dos de sus puntos y calcule su pendiente. Compárela con la lectura de $v$ en ese instante.
5. Ponga $v_0 = 8\,\mathrm{m/s}$ y $a = -2\,\mathrm{m/s^2}$. Localice el instante en que la tangente es horizontal. ¿Qué marca allí el indicador de $v$? Compare la rapidez media y la velocidad media de toda la simulación.`,
  },
  exercises: [
    {
      id: 'b2-vel-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['rapidez-velocidad-rapidez-media', 'rapidez-velocidad-unidades'],
      prompt: String.raw`Una corredora completa $5.0\,\mathrm{km}$ por el Malecón en $25\,\mathrm{min}$, con algunas paradas breves en los semáforos. ¿Cuál fue su rapidez media en **m/s**?`,
      format: 'numeric',
      unitHint: 'm/s',
    },
    {
      id: 'b2-vel-02',
      category: 'grafica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['rapidez-velocidad-velocidad-media'],
      prompt:
        'La gráfica muestra la posición de un robot de limpieza que se mueve por un pasillo recto. ¿Cuál es su velocidad media entre t = 0 y t = 8 s? Indique el signo.',
      format: 'numeric',
      unitHint: 'm/s',
      figure: {
        kind: 'line',
        title: 'Posición del robot frente al tiempo',
        x: { label: 't', unit: 's' },
        y: { label: 'x', unit: 'm' },
        series: [
          {
            name: 'x(t)',
            points: [
              [0, 0],
              [1, 4],
              [2, 8],
              [3, 12],
              [4, 12],
              [5, 12],
              [6, 6],
              [7, 0],
              [8, -6],
            ],
          },
        ],
      },
    },
    {
      id: 'b2-vel-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['rapidez-velocidad-rapidez-media', 'rapidez-velocidad-velocidad-media'],
      prompt: String.raw`**Verdadero o falso:** en cualquier intervalo de tiempo, la rapidez media de un móvil es igual al valor absoluto de su velocidad media. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b2-vel-04',
      category: 'grafica',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['rapidez-velocidad-instantanea'],
      prompt: String.raw`La gráfica muestra la posición de un auto que frena en una calle recta (serie «x(t)») y la recta tangente a esa curva en $t = 4\,\mathrm{s}$ (serie «tangente»). ¿Cuál es la velocidad instantánea del auto en $t = 4\,\mathrm{s}$?`,
      format: 'numeric',
      unitHint: 'm/s',
      figure: {
        kind: 'line',
        title: 'Posición del auto y tangente en t = 4 s',
        x: { label: 't', unit: 's' },
        y: { label: 'x', unit: 'm' },
        series: [
          {
            name: 'x(t)',
            points: [
              [0, 0],
              [0.5, 5.75],
              [1, 11],
              [1.5, 15.75],
              [2, 20],
              [2.5, 23.75],
              [3, 27],
              [3.5, 29.75],
              [4, 32],
              [4.5, 33.75],
              [5, 35],
              [5.5, 35.75],
              [6, 36],
            ],
          },
          {
            name: 'tangente',
            points: [
              [0, 16],
              [0.5, 18],
              [1, 20],
              [1.5, 22],
              [2, 24],
              [2.5, 26],
              [3, 28],
              [3.5, 30],
              [4, 32],
              [4.5, 34],
              [5, 36],
              [5.5, 38],
              [6, 40],
            ],
          },
        ],
      },
    },
    {
      id: 'b2-vel-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['rapidez-velocidad-rapidez-media'],
      prompt: String.raw`Un conductor debe recorrer $120\,\mathrm{km}$ por una autopista con una rapidez media de $60\,\mathrm{km/h}$ para llegar a tiempo. Por el tráfico, recorre los primeros $60\,\mathrm{km}$ a solo $40\,\mathrm{km/h}$. ¿Con qué rapidez constante debe recorrer los $60\,\mathrm{km}$ restantes para conseguir la rapidez media prevista?`,
      format: 'numeric',
      unitHint: 'km/h',
    },
    {
      id: 'b2-vel-06',
      category: 'conceptual',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['rapidez-velocidad-rapidez-media', 'rapidez-velocidad-velocidad-media'],
      prompt: String.raw`Carla y Pedro salen juntos de la universidad y llegan juntos al mismo restaurante. Carla va por la avenida recta; Pedro da un rodeo por calles laterales y recorre más distancia. ¿Qué se puede afirmar sobre el trayecto completo?`,
      format: 'choice',
      options: [
        'Ambos tienen la misma rapidez media y la misma velocidad media.',
        'Ambos tienen la misma velocidad media, pero Pedro tiene mayor rapidez media.',
        'Pedro tiene mayor velocidad media y mayor rapidez media.',
        'Carla tiene mayor velocidad media, porque fue en línea recta.',
      ],
    },
    {
      id: 'b2-vel-07',
      category: 'experimento',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['rapidez-velocidad-velocidad-media', 'rapidez-velocidad-instantanea'],
      prompt: String.raw`En el simulador fije $x_0 = 0$, $v_0 = 0$, $a = 2\,\mathrm{m/s^2}$ y duración $10\,\mathrm{s}$, y pulse **Iniciar**. Con la tabla de datos, calcule la **velocidad media** entre $t = 1\,\mathrm{s}$ y $t = 6\,\mathrm{s}$. ¿Es igual a la velocidad instantánea al principio del intervalo? ¿Y al final?`,
      format: 'numeric',
      unitHint: 'm/s',
      simulation: { key: 'movimiento-rectilineo', params: { x0: 0, v0: 0, a: 2, tMax: 10 } },
    },
    {
      id: 'b2-vel-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['rapidez-velocidad-instantanea', 'rapidez-velocidad-velocidad-media', 'rapidez-velocidad-unidades'],
      prompt: String.raw`Un carrito se mueve sobre un riel recto. Su posición se registra en la tabla:

| $t$ (s) | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| $x$ (m) | 0 | 0.5 | 2.0 | 4.5 | 8.0 | 12.5 | 18.0 |

(a) Dibuje la gráfica $x$–$t$ con escalas adecuadas.
(b) Calcule las velocidades medias en los intervalos $[2, 6]$, $[2, 4]$ y $[2, 3]\,\mathrm{s}$. ¿Qué tendencia observa?
(c) Trace la tangente a la curva en $t = 2\,\mathrm{s}$, lea dos de sus puntos y estime la velocidad instantánea en ese instante. Exprésela en m/s y en km/h.
(d) Explique, sin usar fórmulas, por qué la velocidad media en $[1, 3]\,\mathrm{s}$ es una mejor estimación de $v(2\,\mathrm{s})$ que la velocidad media en $[2, 3]\,\mathrm{s}$.`,
      format: 'open',
    },
  ],
};
