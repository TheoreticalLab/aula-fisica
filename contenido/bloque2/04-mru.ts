import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'mru',
  title: 'Movimiento rectilíneo uniforme',
  summary:
    'Movimiento en línea recta con velocidad constante: la posición cambia lo mismo en cada intervalo de tiempo igual.',
  concepts: [
    { slug: 'mru-ecuacion-posicion', name: 'Ecuación de posición del MRU' },
    { slug: 'mru-graficas', name: 'Gráficas x–t y v–t del MRU' },
    { slug: 'mru-encuentro', name: 'Problemas de encuentro y persecución' },
  ],
  theory: String.raw`## ¿Qué es un movimiento uniforme?

Un cuerpo describe un **movimiento rectilíneo uniforme (MRU)** cuando se mueve sobre una línea recta con **velocidad constante**: misma rapidez y mismo sentido en todo momento. En consecuencia, **recorre desplazamientos iguales en intervalos de tiempo iguales**.

Ejemplos aproximados de la vida diaria:

- Un automóvil en una autopista recta con el control de crucero activado.
- Una persona sobre una escalera o banda transportadora de un aeropuerto.
- Una gota de lluvia que, tras caer un buen trecho, alcanza su velocidad terminal.

En todos ellos la aceleración es cero: nada cambia la velocidad.

## La posición crece linealmente con el tiempo

Elegimos un eje $x$ a lo largo de la recta y un origen. Si en el instante $t = 0$ el móvil está en $x_0$ y su velocidad es $v$, en cada segundo avanza $v$ metros (o retrocede, si $v < 0$). Al cabo de un tiempo $t$ habrá recorrido $v\,t$ y su posición será

$$x(t) = x_0 + v\,t .$$

Esta ecuación dice tres cosas:

1. **$x_0$** es el punto de partida: dónde estaba el móvil cuando empezamos a contar el tiempo.
2. **$v$** indica cuántos metros cambia la posición por cada segundo. Su **signo** indica el sentido: positivo si avanza hacia $+x$ y negativo si avanza hacia $-x$.
3. La posición es una **función lineal** del tiempo.

> **Cuidado.** La ecuación $d = v\,t$ solo da la *distancia recorrida* cuando el móvil parte del origen y no cambia de sentido. La ecuación general es $x = x_0 + v\,t$.

## Interpretación gráfica

**Gráfica posición–tiempo ($x$–$t$).** Es una **recta**. Su ordenada en el origen es $x_0$ y su **pendiente es la velocidad**:

$$v = \frac{\Delta x}{\Delta t} = \frac{x_2 - x_1}{t_2 - t_1}.$$

Una recta más empinada indica mayor rapidez. Una pendiente negativa indica movimiento hacia $-x$. Una recta horizontal indica reposo.

**Gráfica velocidad–tiempo ($v$–$t$).** Es una **recta horizontal**, porque $v$ no cambia. El **área** entre la recta y el eje del tiempo, entre $t_1$ y $t_2$, es el desplazamiento $\Delta x = v\,(t_2 - t_1)$. El área es un rectángulo de base $\Delta t$ y altura $v$. Si $v < 0$, el área queda bajo el eje y el desplazamiento es negativo.

**Gráfica aceleración–tiempo ($a$–$t$).** Coincide con el eje del tiempo: $a = 0$.

## Encuentro de dos móviles

Si dos móviles se mueven sobre la misma recta, cada uno tiene su propia ecuación, **medida desde el mismo origen y con el mismo sentido positivo**:

$$x_A = x_{0A} + v_A\,t, \qquad x_B = x_{0B} + v_B\,t.$$

Se encuentran cuando ocupan la misma posición en el mismo instante: $x_A(t) = x_B(t)$. Esa igualdad es una ecuación de primer grado en $t$. En la gráfica $x$–$t$, el encuentro es el **punto donde se cortan las dos rectas**.

## Límites del modelo

El MRU es una idealización. En la práctica, ningún vehículo mantiene la velocidad exactamente constante: arranca, frena y toma curvas. Aun así, el modelo describe bien los tramos en los que la velocidad casi no cambia. Además, es la base para estudiar el movimiento con aceleración.`,
  formulas: [
    {
      name: 'Ecuación de posición',
      latex: String.raw`x(t) = x_0 + v\,t`,
      description: 'Posición del móvil en cualquier instante cuando la velocidad es constante.',
      variables: [
        { symbol: String.raw`x(t)`, meaning: 'Posición en el instante t', unit: 'm' },
        { symbol: String.raw`x_0`, meaning: 'Posición en t = 0 (posición inicial)', unit: 'm' },
        { symbol: String.raw`v`, meaning: 'Velocidad (constante, con signo)', unit: 'm/s' },
        { symbol: String.raw`t`, meaning: 'Tiempo transcurrido desde t = 0', unit: 's' },
      ],
      notes: 'Todas las posiciones se miden desde el mismo origen; el signo de v indica el sentido del movimiento.',
    },
    {
      name: 'Velocidad como pendiente',
      latex: String.raw`v = \frac{\Delta x}{\Delta t} = \frac{x_2 - x_1}{t_2 - t_1}`,
      description: 'En el MRU la velocidad es la pendiente de la recta x–t y vale lo mismo en cualquier intervalo.',
      variables: [
        { symbol: String.raw`\Delta x`, meaning: 'Desplazamiento en el intervalo', unit: 'm' },
        { symbol: String.raw`\Delta t`, meaning: 'Duración del intervalo', unit: 's' },
      ],
    },
    {
      name: 'Tiempo de encuentro',
      latex: String.raw`t_e = \frac{x_{0B} - x_{0A}}{v_A - v_B}`,
      description:
        'Resulta de igualar las posiciones de dos móviles en MRU; solo tiene sentido físico si sale positivo.',
      variables: [
        { symbol: String.raw`x_{0A},\,x_{0B}`, meaning: 'Posiciones iniciales de A y B', unit: 'm' },
        { symbol: String.raw`v_A,\,v_B`, meaning: 'Velocidades de A y B (con signo)', unit: 'm/s' },
        { symbol: String.raw`t_e`, meaning: 'Instante del encuentro', unit: 's' },
      ],
      notes: 'Si v_A = v_B los móviles nunca se encuentran (rectas paralelas), salvo que partan del mismo punto.',
    },
  ],
  examples: [
    {
      title: 'Posición de un ciclista',
      statement: String.raw`Un ciclista pasa por el kilómetro $2.0$ de una carretera recta a $t = 0$ y mantiene una velocidad de $6.0\,\mathrm{m/s}$ en el sentido en que crecen los kilómetros. ¿En qué kilómetro estará $5.0$ minutos después?`,
      steps: [
        String.raw`Elegimos el origen en el kilómetro 0 y el sentido positivo hacia donde crecen los kilómetros. Entonces $x_0 = 2.0\,\mathrm{km} = 2000\,\mathrm{m}$ y $v = +6.0\,\mathrm{m/s}$.`,
        String.raw`Convertimos el tiempo al SI: $t = 5.0\,\mathrm{min} \times 60\,\mathrm{s/min} = 300\,\mathrm{s}$.`,
        String.raw`Aplicamos la ecuación de posición: $x = x_0 + v\,t = 2000\,\mathrm{m} + (6.0\,\mathrm{m/s})(300\,\mathrm{s}) = 2000\,\mathrm{m} + 1800\,\mathrm{m} = 3800\,\mathrm{m}$.`,
      ],
      result: String.raw`$x = 3.8\times10^{3}\,\mathrm{m}$, es decir, el ciclista estará en el kilómetro $3.8$.`,
      interpretation: 'En 5 minutos avanzó 1.8 km. Una rapidez de 6 m/s equivale a 21.6 km/h, un valor razonable para una bicicleta.',
    },
    {
      title: 'Velocidad a partir de una gráfica',
      statement: String.raw`La gráfica $x$–$t$ de un carrito es una recta que pasa por $(0\,\mathrm{s},\,12\,\mathrm{m})$ y $(4.0\,\mathrm{s},\,2.0\,\mathrm{m})$. Determine su velocidad y escriba la ecuación de posición.`,
      steps: [
        String.raw`La pendiente es la velocidad: $v = \dfrac{\Delta x}{\Delta t} = \dfrac{2.0\,\mathrm{m} - 12\,\mathrm{m}}{4.0\,\mathrm{s} - 0} = \dfrac{-10\,\mathrm{m}}{4.0\,\mathrm{s}} = -2.5\,\mathrm{m/s}$.`,
        String.raw`La ordenada en el origen es la posición inicial: $x_0 = 12\,\mathrm{m}$.`,
        String.raw`Ecuación de posición: $x(t) = 12\,\mathrm{m} - (2.5\,\mathrm{m/s})\,t$.`,
      ],
      result: String.raw`$v = -2.5\,\mathrm{m/s}$ y $x(t) = 12 - 2.5\,t$ (en metros y segundos).`,
      interpretation: 'El signo negativo indica que el carrito se mueve hacia valores decrecientes de x, es decir, se acerca al origen.',
    },
    {
      title: 'Encuentro de dos autobuses',
      statement: String.raw`Dos ciudades están separadas $120\,\mathrm{km}$. A las 8:00 sale un autobús A de la primera hacia la segunda a $60\,\mathrm{km/h}$, y a la misma hora sale un autobús B de la segunda hacia la primera a $40\,\mathrm{km/h}$. ¿A qué hora y a qué distancia de la primera ciudad se cruzan?`,
      steps: [
        String.raw`Origen en la primera ciudad y sentido positivo hacia la segunda. Así: $x_{0A} = 0$, $v_A = +60\,\mathrm{km/h}$; $x_{0B} = 120\,\mathrm{km}$, $v_B = -40\,\mathrm{km/h}$ (B viaja hacia $-x$).`,
        String.raw`Ecuaciones: $x_A = 60\,t$ y $x_B = 120 - 40\,t$ (en km y h). Trabajamos en km y h porque todos los datos están en esas unidades y son coherentes entre sí.`,
        String.raw`Encuentro: $60\,t = 120 - 40\,t \Rightarrow 100\,t = 120 \Rightarrow t = 1.2\,\mathrm{h}$.`,
        String.raw`Posición: $x_A = 60 \times 1.2 = 72\,\mathrm{km}$. Comprobación: $x_B = 120 - 40\times1.2 = 72\,\mathrm{km}$ ✓.`,
        String.raw`$1.2\,\mathrm{h} = 1\,\mathrm{h}\;12\,\mathrm{min}$.`,
      ],
      result: String.raw`Se cruzan a las 9:12, a $72\,\mathrm{km}$ de la primera ciudad.`,
      interpretation:
        'Las rapideces se suman porque los autobuses se acercan uno al otro: la distancia entre ellos disminuye 100 km cada hora.',
    },
  ],
  simulation: {
    key: 'movimiento-rectilineo',
    params: { x0: -20, v0: 4, a: 0, tMax: 10 },
    guide: String.raw`1. Con $a = 0$, pulse **Iniciar** y observe la gráfica $x$–$t$. ¿Qué forma tiene? ¿Y la gráfica $v$–$t$?
2. Lea en la gráfica la posición en $t = 5\,\mathrm{s}$ y compruébela con $x = x_0 + v\,t$.
3. Cambie $v_0$ a un valor negativo. ¿Qué le ocurre a la pendiente de la recta $x$–$t$?
4. Ponga $v_0 = 0$. Describa ambas gráficas e interprete físicamente el resultado.
5. Compare dos simulaciones con la misma $v_0$ y distinta $x_0$. ¿En qué se parecen las rectas y en qué se diferencian?`,
  },
  exercises: [
    {
      id: 'b2-mru-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['mru-ecuacion-posicion'],
      prompt: String.raw`Un tren avanza por una vía recta a velocidad constante de $25\,\mathrm{m/s}$. ¿Qué distancia recorre en $40\,\mathrm{s}$?`,
      format: 'numeric',
      unitHint: 'm',
    },
    {
      id: 'b2-mru-02',
      category: 'grafica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['mru-graficas'],
      prompt: 'La gráfica muestra la posición de una persona que camina por un pasillo recto. ¿Cuál es su velocidad?',
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
              [0, 3],
              [2, 6],
              [4, 9],
              [6, 12],
              [8, 15],
            ],
          },
        ],
      },
    },
    {
      id: 'b2-mru-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['mru-graficas'],
      prompt: String.raw`**Verdadero o falso:** en un MRU, la gráfica velocidad–tiempo es una recta inclinada cuya pendiente es la velocidad. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b2-mru-04',
      category: 'error',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['mru-ecuacion-posicion'],
      prompt: String.raw`Un estudiante resolvió así este problema: *«Un auto está en $x_0 = 500\,\mathrm{m}$ y se mueve a $-15\,\mathrm{m/s}$. ¿Dónde estará a los $20\,\mathrm{s}$?»*

1. Datos: $x_0 = 500\,\mathrm{m}$, $v = -15\,\mathrm{m/s}$, $t = 20\,\mathrm{s}$.
2. Ecuación: $x = x_0 + v\,t$.
3. Sustitución: $x = 500 + 15 \times 20$.
4. Resultado: $x = 800\,\mathrm{m}$.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'No hay ningún error'],
    },
    {
      id: 'b2-mru-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['mru-encuentro', 'mru-ecuacion-posicion'],
      prompt: String.raw`Un ladrón huye en motocicleta por una avenida recta a $20\,\mathrm{m/s}$. Cuando pasa frente a una patrulla detenida, esta tarda $10\,\mathrm{s}$ en arrancar y luego lo persigue a $30\,\mathrm{m/s}$ constantes (suponga que alcanza esa velocidad instantáneamente). ¿Cuánto tiempo, **contado desde que la patrulla arranca**, tarda en alcanzarlo?`,
      format: 'numeric',
      unitHint: 's',
    },
    {
      id: 'b2-mru-06',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['mru-graficas'],
      prompt: String.raw`Dos corredores, A y B, se mueven con MRU. En la misma gráfica $x$–$t$, la recta de A es más empinada que la de B y ambas tienen pendiente positiva. ¿Qué se puede afirmar?`,
      format: 'choice',
      options: [
        'A partió más lejos del origen que B.',
        'A tiene mayor rapidez que B.',
        'A tiene mayor aceleración que B.',
        'B se mueve en sentido contrario a A.',
      ],
    },
    {
      id: 'b2-mru-07',
      category: 'numerica',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['mru-encuentro'],
      prompt: String.raw`Dos ciclistas parten al mismo tiempo de dos puntos separados $3.0\,\mathrm{km}$ y van uno hacia el otro por la misma carretera recta, a $5.0\,\mathrm{m/s}$ y $7.5\,\mathrm{m/s}$. ¿Cuánto tardan en encontrarse?`,
      format: 'numeric',
      unitHint: 's',
    },
    {
      id: 'b2-mru-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['mru-encuentro', 'mru-graficas'],
      prompt: String.raw`Un autobús sale de una terminal a las 7:00 a $50\,\mathrm{km/h}$. Un automóvil sale de la misma terminal a las 7:30, por la misma ruta, a $80\,\mathrm{km/h}$. (a) Escriba las ecuaciones de posición de ambos tomando $t = 0$ a las 7:00. (b) Determine la hora y la posición del encuentro. (c) Dibuje cualitativamente ambas gráficas $x$–$t$ e indique el punto de encuentro. Explique cada paso.`,
      format: 'open',
    },
  ],
};
