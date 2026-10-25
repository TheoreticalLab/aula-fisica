import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'aceleracion',
  title: 'Aceleración',
  summary:
    'La aceleración mide cuánto cambia la velocidad por unidad de tiempo. Su signo indica el sentido del cambio, no si el móvil va más deprisa o más despacio; es la pendiente de la gráfica v–t.',
  concepts: [
    { slug: 'aceleracion-media', name: 'Aceleración media' },
    { slug: 'aceleracion-signo', name: 'Signo de la aceleración: acelerar y frenar' },
    { slug: 'aceleracion-pendiente-vt', name: 'Aceleración como pendiente de la gráfica v–t' },
  ],
  theory: String.raw`## Cuando la velocidad cambia

Una guagua que arranca en una parada, un auto que frena ante un semáforo en rojo y una pelota que rebota en el suelo tienen algo en común: su **velocidad cambia**. La magnitud que mide la rapidez de ese cambio es la **aceleración**.

Igual que la velocidad nos dice cuánto cambia la posición por cada segundo, la aceleración nos dice **cuánto cambia la velocidad por cada segundo**.

## Aceleración media

Si en el instante $t_i$ la velocidad es $v_i$ y en $t_f$ es $v_f$, la **aceleración media** en ese intervalo es

$$a_m = \frac{\Delta v}{\Delta t} = \frac{v_f - v_i}{t_f - t_i}.$$

Su unidad en el SI es $\mathrm{(m/s)/s} = \mathrm{m/s^2}$. Conviene leerla así: una aceleración de $2\,\mathrm{m/s^2}$ significa que **la velocidad cambia $2\,\mathrm{m/s}$ cada segundo**. Un auto que pasa de 0 a 100 km/h en 8 s tiene una aceleración media de unos $3.5\,\mathrm{m/s^2}$: cada segundo gana unos $3.5\,\mathrm{m/s}$ (unos 12.5 km/h).

> **Cuidado.** Velocidad grande no significa aceleración grande. Un avión en crucero a $250\,\mathrm{m/s}$ constantes tiene aceleración nula; un motoconcho que acaba de arrancar y apenas va a $1\,\mathrm{m/s}$ puede tener una aceleración considerable. La aceleración no depende de cuánta velocidad hay, sino de **cuánto cambia** y **en cuánto tiempo**.

## El signo de la aceleración

La aceleración, como la velocidad, tiene **signo**, y ese signo se refiere al **eje elegido**: $a > 0$ significa que la velocidad cambia hacia valores más positivos y $a < 0$, hacia valores más negativos. **El signo de $a$, por sí solo, no dice si el móvil va más deprisa o más despacio.** Para saberlo hay que compararlo con el signo de la velocidad:

| Velocidad | Aceleración | ¿Qué le pasa a la rapidez? |
|---|---|---|
| $v > 0$ | $a > 0$ | Aumenta: acelera hacia $+x$ |
| $v > 0$ | $a < 0$ | Disminuye: frena mientras va hacia $+x$ |
| $v < 0$ | $a < 0$ | Aumenta: acelera hacia $-x$ |
| $v < 0$ | $a > 0$ | Disminuye: frena mientras va hacia $-x$ |

La regla es sencilla: **si $v$ y $a$ tienen el mismo signo, la rapidez aumenta; si tienen signos opuestos, la rapidez disminuye.**

> **Error frecuente.** Pensar que «aceleración negativa» significa siempre «frenar». Un auto que circula en el sentido negativo del eje y frena tiene aceleración **positiva**. La palabra «desaceleración» del lenguaje cotidiano significa «perder rapidez», y no indica el signo de $a$; en física es mejor evitarla.

## Velocidad nula no significa aceleración nula

Imagine un carrito que sube por una rampa, se detiene un instante y empieza a bajar. En el punto más alto su velocidad es cero, pero su velocidad **sigue cambiando**: un instante antes era positiva y un instante después es negativa. Su aceleración en ese instante no es cero. Lo mismo ocurre con una pelota lanzada hacia arriba en el punto más alto de su vuelo.

Del mismo modo, cuando un cuerpo **invierte su sentido**, el cambio de velocidad puede ser mucho mayor que cualquiera de las rapideces. Si una pelota llega al suelo a $6\,\mathrm{m/s}$ hacia abajo y sale a $4\,\mathrm{m/s}$ hacia arriba, su velocidad cambia en $10\,\mathrm{m/s}$, no en $2\,\mathrm{m/s}$: hay que restar con signos.

## La aceleración en la gráfica v–t

En la gráfica velocidad–tiempo, la aceleración media entre dos instantes es la **pendiente de la secante** que une los dos puntos:

$$a_m = \frac{v_2 - v_1}{t_2 - t_1}.$$

Es la misma idea de la lección anterior, aplicada ahora a la velocidad en lugar de a la posición. Y, del mismo modo, la **aceleración instantánea** es la **pendiente de la recta tangente** a la gráfica $v$–$t$ en el instante considerado. En consecuencia:

- Un tramo **recto** de la gráfica $v$–$t$ indica aceleración **constante** (igual a su pendiente).
- Un tramo **horizontal** indica $a = 0$: velocidad constante, es decir, MRU.
- Un tramo que **sube** indica $a > 0$; uno que **baja**, $a < 0$, sin importar si está por encima o por debajo del eje $t$.
- Cuando la gráfica **cruza el eje** $t$, la velocidad cambia de signo: el móvil invierte su sentido.

> **Error frecuente.** Leer la aceleración en la **altura** de la gráfica $v$–$t$ en lugar de en su **pendiente**. Un tramo horizontal muy alto corresponde a mucha velocidad y aceleración nula.

## Lo que se ve en la gráfica x–t

En la gráfica $x$–$t$ la aceleración se reconoce por la **curvatura**. Si la pendiente de la gráfica (la velocidad) aumenta con el tiempo, la curva se dobla hacia arriba, como una sonrisa: $a > 0$. Si la pendiente disminuye, la curva se dobla hacia abajo: $a < 0$. Una recta, sin curvatura, corresponde a $a = 0$.

## La gráfica a–t

Si la aceleración es constante, la gráfica aceleración–tiempo es una recta horizontal a la altura $a$. En el simulador de esta lección la aceleración es constante, de modo que la gráfica $a$–$t$ es siempre horizontal, aunque la velocidad cambie de signo.

## Límites del modelo

La aceleración media resume un intervalo en un solo número: no informa de si el cambio de velocidad fue gradual o brusco. Un auto que frena suavemente durante 4 s y otro que mantiene la velocidad 3 s y frena de golpe en el último segundo pueden tener la misma aceleración media en esos 4 s, aunque los pasajeros los vivan de forma muy distinta. Por otra parte, aquí solo tratamos movimientos sobre una recta. En una curva, la velocidad cambia de dirección aunque su valor sea constante, y también hay aceleración; ese caso se estudiará en el movimiento circular.`,
  formulas: [
    {
      name: 'Aceleración media',
      latex: String.raw`a_m = \frac{\Delta v}{\Delta t} = \frac{v_f - v_i}{t_f - t_i}`,
      description: 'Cambio de velocidad dividido entre el tiempo en que se produce. Tiene signo.',
      variables: [
        { symbol: String.raw`a_m`, meaning: 'Aceleración media (con signo)', unit: 'm/s²' },
        { symbol: String.raw`v_i,\,v_f`, meaning: 'Velocidades inicial y final (con signo)', unit: 'm/s' },
        { symbol: String.raw`\Delta t`, meaning: 'Duración del intervalo', unit: 's' },
      ],
      notes: 'Las velocidades se restan con su signo: si el móvil invierte su sentido, |Δv| es la suma de las rapideces.',
    },
    {
      name: 'Aceleración como pendiente de la gráfica v–t',
      latex: String.raw`a = \frac{v_2 - v_1}{t_2 - t_1}`,
      description:
        'En un tramo recto de la gráfica v–t, la aceleración es su pendiente. En un tramo curvo, la aceleración instantánea es la pendiente de la tangente.',
      variables: [
        { symbol: String.raw`(t_1, v_1),\,(t_2, v_2)`, meaning: 'Dos puntos del tramo recto (o de la tangente)', unit: 's, m/s' },
        { symbol: String.raw`a`, meaning: 'Aceleración', unit: 'm/s²' },
      ],
      notes: 'La aceleración es la pendiente, no la altura, de la gráfica v–t.',
    },
    {
      name: 'Criterio para acelerar o frenar',
      latex: String.raw`a\,v > 0 \Rightarrow \text{la rapidez aumenta}; \quad a\,v < 0 \Rightarrow \text{la rapidez disminuye}`,
      description:
        'La rapidez aumenta cuando la aceleración y la velocidad tienen el mismo signo y disminuye cuando tienen signos opuestos.',
      variables: [
        { symbol: String.raw`a`, meaning: 'Aceleración (con signo)', unit: 'm/s²' },
        { symbol: String.raw`v`, meaning: 'Velocidad (con signo)', unit: 'm/s' },
      ],
      notes: 'Si v = 0 y a ≠ 0, el móvil está en reposo solo un instante y empieza a moverse en el sentido de a.',
    },
  ],
  examples: [
    {
      title: 'De 0 a 100 km/h',
      statement: String.raw`Un auto deportivo parte del reposo y alcanza $100\,\mathrm{km/h}$ en $8.0\,\mathrm{s}$ por una recta. Calcule su aceleración media.`,
      steps: [
        String.raw`Tomamos el sentido positivo hacia donde se mueve el auto. Convertimos al SI: $v_f = \dfrac{100}{3.6}\,\mathrm{m/s} = 27.8\,\mathrm{m/s}$; $v_i = 0$.`,
        String.raw`$a_m = \dfrac{v_f - v_i}{\Delta t} = \dfrac{27.8\,\mathrm{m/s} - 0}{8.0\,\mathrm{s}} = 3.47\,\mathrm{m/s^2}$.`,
      ],
      result: String.raw`$a_m \approx 3.5\,\mathrm{m/s^2}$.`,
      interpretation:
        'Cada segundo el auto gana unos 3.5 m/s. Es aproximadamente un tercio de la aceleración de caída libre (9.8 m/s²), un valor típico de un auto potente.',
    },
    {
      title: 'Una pelota que rebota',
      statement: String.raw`Una pelota llega al suelo con una velocidad de $6.0\,\mathrm{m/s}$ hacia abajo y sale rebotada a $4.0\,\mathrm{m/s}$ hacia arriba. El contacto con el suelo dura $0.020\,\mathrm{s}$. Calcule la aceleración media durante el contacto.`,
      steps: [
        String.raw`Elegimos el eje $y$ positivo hacia arriba. Entonces $v_i = -6.0\,\mathrm{m/s}$ (hacia abajo) y $v_f = +4.0\,\mathrm{m/s}$.`,
        String.raw`$\Delta v = v_f - v_i = 4.0\,\mathrm{m/s} - (-6.0\,\mathrm{m/s}) = +10.0\,\mathrm{m/s}$.`,
        String.raw`$a_m = \dfrac{\Delta v}{\Delta t} = \dfrac{10.0\,\mathrm{m/s}}{0.020\,\mathrm{s}} = +500\,\mathrm{m/s^2}$.`,
      ],
      result: String.raw`$a_m = +500\,\mathrm{m/s^2}$, es decir, $500\,\mathrm{m/s^2}$ hacia arriba.`,
      interpretation:
        'Es unas 50 veces la aceleración de caída libre: los choques breves producen aceleraciones enormes. Si se hubieran restado las rapideces sin signo (6 − 4 = 2 m/s), el resultado sería cinco veces menor y erróneo.',
    },
    {
      title: 'Frenar y dar marcha atrás con la misma aceleración',
      statement: String.raw`Un carrito se mueve sobre un riel con $v_0 = +10\,\mathrm{m/s}$ y una aceleración constante $a = -2.0\,\mathrm{m/s^2}$ durante $10\,\mathrm{s}$. Describa cómo cambia su rapidez.`,
      steps: [
        String.raw`Cada segundo la velocidad disminuye $2.0\,\mathrm{m/s}$: $v = 10,\,8,\,6,\,4,\,2,\,0\,\mathrm{m/s}$ en $t = 0, 1, \dots, 5\,\mathrm{s}$.`,
        String.raw`De $0$ a $5\,\mathrm{s}$: $v > 0$ y $a < 0$, signos opuestos: el carrito **frena** mientras avanza hacia $+x$.`,
        String.raw`En $t = 5\,\mathrm{s}$: $v = 0$, pero $a = -2.0\,\mathrm{m/s^2}$; el carrito no se queda quieto.`,
        String.raw`De $5$ a $10\,\mathrm{s}$: $v = -2,\,-4,\,\dots,\,-10\,\mathrm{m/s}$. Ahora $v < 0$ y $a < 0$, mismo signo: el carrito **acelera** hacia $-x$.`,
      ],
      result: String.raw`Con la misma aceleración $a = -2.0\,\mathrm{m/s^2}$, el carrito frena durante los primeros 5 s y gana rapidez durante los 5 s siguientes, ahora en sentido negativo.`,
      interpretation:
        'La gráfica v–t es una única recta de pendiente −2.0 m/s² que cruza el eje t en t = 5 s. El signo de a no cambió; lo que cambió fue el signo de v.',
    },
  ],
  simulation: {
    key: 'movimiento-rectilineo',
    params: { x0: 0, v0: 10, a: -2, tMax: 10 },
    guide: String.raw`1. Con $x_0 = 0$, $v_0 = 10\,\mathrm{m/s}$ y $a = -2\,\mathrm{m/s^2}$, pulse **Iniciar**. Observe la gráfica $v$–$t$: ¿qué forma tiene? Calcule su pendiente con dos puntos de la tabla y compárela con $a$.
2. Anote el instante en que $v = 0$. ¿Qué hace la gráfica $x$–$t$ en ese instante? ¿Y la gráfica $a$–$t$?
3. Clasifique cada tramo (antes y después de ese instante) como «frena» o «acelera» usando la regla de los signos de $v$ y $a$.
4. Cambie a $v_0 = -10\,\mathrm{m/s}$ y $a = +2\,\mathrm{m/s^2}$. Prediga, antes de iniciar, en qué tramo frenará el móvil. Compruébelo.
5. Compare dos simulaciones con la misma $v_0$ y aceleraciones $a = 1\,\mathrm{m/s^2}$ y $a = 3\,\mathrm{m/s^2}$. ¿Cómo cambia la gráfica $v$–$t$? ¿Y la curvatura de la gráfica $x$–$t$?`,
  },
  exercises: [
    {
      id: 'b2-acel-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['aceleracion-media'],
      prompt: String.raw`Un motoconcho que circula por una calle recta pasa de $4.0\,\mathrm{m/s}$ a $10\,\mathrm{m/s}$ en $3.0\,\mathrm{s}$, sin cambiar de sentido. ¿Cuál es su aceleración media?`,
      format: 'numeric',
      unitHint: 'm/s²',
    },
    {
      id: 'b2-acel-02',
      category: 'grafica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['aceleracion-pendiente-vt'],
      prompt: String.raw`La gráfica muestra la velocidad de una guagua en un tramo recto entre dos paradas. ¿Cuál es su aceleración entre $t = 8\,\mathrm{s}$ y $t = 10\,\mathrm{s}$? Indique el signo.`,
      format: 'numeric',
      unitHint: 'm/s²',
      figure: {
        kind: 'line',
        title: 'Velocidad de la guagua frente al tiempo',
        x: { label: 't', unit: 's' },
        y: { label: 'v', unit: 'm/s' },
        series: [
          {
            name: 'v(t)',
            points: [
              [0, 0],
              [1, 2],
              [2, 4],
              [3, 6],
              [4, 8],
              [5, 8],
              [6, 8],
              [7, 8],
              [8, 8],
              [9, 4],
              [10, 0],
            ],
          },
        ],
      },
    },
    {
      id: 'b2-acel-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['aceleracion-signo'],
      prompt: String.raw`**Verdadero o falso:** si en cierto instante la velocidad de un móvil es cero, su aceleración en ese instante también tiene que ser cero. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b2-acel-04',
      category: 'error',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['aceleracion-signo', 'aceleracion-media'],
      prompt: String.raw`Un estudiante resolvió así este problema: *«Con el eje positivo hacia el norte, una guagua viaja hacia el sur por una avenida recta y frena de $18\,\mathrm{m/s}$ a $6\,\mathrm{m/s}$ en $4.0\,\mathrm{s}$. Halle su aceleración media.»*

1. Como la guagua va hacia el sur: $v_i = -18\,\mathrm{m/s}$ y $v_f = -6\,\mathrm{m/s}$.
2. $\Delta v = v_f - v_i = -6\,\mathrm{m/s} - (-18\,\mathrm{m/s}) = +12\,\mathrm{m/s}$.
3. $a_m = \Delta v / \Delta t = (12\,\mathrm{m/s})/(4.0\,\mathrm{s}) = +3.0\,\mathrm{m/s^2}$.
4. Como la guagua está frenando, la aceleración tiene que ser negativa; por lo tanto, $a_m = -3.0\,\mathrm{m/s^2}$.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'No hay ningún error'],
    },
    {
      id: 'b2-acel-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['aceleracion-media', 'aceleracion-signo'],
      prompt: String.raw`Un lanzador de béisbol envía la pelota hacia el bateador a $137\,\mathrm{km/h}$. El bateador la golpea y la pelota sale en la dirección opuesta a $160\,\mathrm{km/h}$. El contacto entre la pelota y el bate dura $0.70\,\mathrm{ms}$. Suponga que el movimiento ocurre sobre una misma recta. ¿Cuál es el **módulo** de la aceleración media de la pelota durante el contacto?`,
      format: 'numeric',
      unitHint: 'm/s²',
    },
    {
      id: 'b2-acel-06',
      category: 'seleccion',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['aceleracion-signo'],
      prompt: String.raw`Cada opción da la velocidad y la aceleración de un móvil en cierto instante, medidas sobre el mismo eje. **Marque todas** las situaciones en que el móvil está **frenando** (su rapidez disminuye).`,
      format: 'choice',
      multiple: true,
      options: [
        String.raw`$v = +5\,\mathrm{m/s}$, $a = -2\,\mathrm{m/s^2}$`,
        String.raw`$v = -5\,\mathrm{m/s}$, $a = -2\,\mathrm{m/s^2}$`,
        String.raw`$v = -5\,\mathrm{m/s}$, $a = +2\,\mathrm{m/s^2}$`,
        String.raw`$v = +5\,\mathrm{m/s}$, $a = +2\,\mathrm{m/s^2}$`,
        String.raw`$v = 0$, $a = +2\,\mathrm{m/s^2}$`,
      ],
    },
    {
      id: 'b2-acel-07',
      category: 'experimento',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['aceleracion-signo', 'aceleracion-pendiente-vt'],
      prompt: String.raw`En el simulador fije $x_0 = 0$, $v_0 = -8\,\mathrm{m/s}$, $a = +2\,\mathrm{m/s^2}$ y duración $10\,\mathrm{s}$, y pulse **Iniciar**. Al principio el móvil frena y más tarde gana rapidez. Usando la tabla o la gráfica $v$–$t$, ¿en qué instante deja de frenar y empieza a ganar rapidez?`,
      format: 'numeric',
      unitHint: 's',
      simulation: { key: 'movimiento-rectilineo', params: { x0: 0, v0: -8, a: 2, tMax: 10 } },
    },
    {
      id: 'b2-acel-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['aceleracion-pendiente-vt', 'aceleracion-signo', 'aceleracion-media'],
      prompt: String.raw`Una guagua maniobra en una calle recta (eje positivo hacia el este). Su velocidad cambia linealmente con el tiempo dentro de cada tramo y toma estos valores:

| $t$ (s) | 0 | 5 | 15 | 20 | 25 | 30 |
|---|---|---|---|---|---|---|
| $v$ (m/s) | 0 | 10 | 10 | 0 | −5 | 0 |

(a) Dibuje la gráfica $v$–$t$.
(b) Calcule la aceleración en cada uno de los cinco tramos.
(c) Indique en qué tramos la guagua gana rapidez y en cuáles la pierde, justificándolo con los signos de $v$ y $a$.
(d) ¿Hay algún tramo en que la aceleración sea negativa y, sin embargo, la guagua gane rapidez? Explique qué está haciendo la guagua en ese tramo.
(e) Dibuje la gráfica $a$–$t$ y calcule la aceleración media entre $t = 0$ y $t = 30\,\mathrm{s}$.`,
      format: 'open',
    },
  ],
};
