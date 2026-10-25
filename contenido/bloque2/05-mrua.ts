import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'mrua',
  title: 'Movimiento rectilíneo uniformemente acelerado',
  summary:
    'Movimiento en línea recta con aceleración constante: la velocidad cambia lo mismo en cada segundo, la gráfica v–t es una recta y el desplazamiento es el área de un trapecio.',
  concepts: [
    { slug: 'mrua-ecuacion-velocidad', name: 'Ecuación de la velocidad del MRUA' },
    { slug: 'mrua-ecuacion-posicion', name: 'Ecuación de la posición del MRUA' },
    { slug: 'mrua-ecuacion-sin-tiempo', name: 'Relación entre velocidad y desplazamiento (sin el tiempo)' },
    { slug: 'mrua-velocidad-media-area', name: 'Velocidad media y área del trapecio en la gráfica v–t' },
    { slug: 'mrua-graficas', name: 'Gráficas x–t, v–t y a–t del MRUA' },
    { slug: 'mrua-frenado', name: 'Distancia de frenado y tiempo de reacción' },
  ],
  theory: String.raw`## Aceleración constante

Un cuerpo describe un **movimiento rectilíneo uniformemente acelerado (MRUA)** cuando se mueve sobre una recta con **aceleración constante**: su velocidad cambia **lo mismo en cada segundo**. Son ejemplos aproximados una guagua que arranca en una parada, un avión que acelera por la pista antes de despegar, un auto que frena con los frenos apretados de forma uniforme y, como veremos más adelante, un objeto en caída libre.

El MRU de la lección anterior es el caso particular $a = 0$.

## La velocidad cambia linealmente

Tomamos $t = 0$ al empezar a contar y llamamos $v_0$ a la velocidad en ese instante. Como $a = \Delta v/\Delta t$ es constante, en un tiempo $t$ la velocidad cambia en $a\,t$:

$$v = v_0 + a\,t .$$

La gráfica $v$–$t$ es una **recta** con ordenada en el origen $v_0$ y pendiente $a$. Todas las magnitudes llevan su signo respecto al eje elegido.

## El desplazamiento es un área

En el MRU vimos que el desplazamiento es el área del rectángulo bajo la gráfica $v$–$t$. La idea sigue valiendo cuando la velocidad cambia: si dividimos el intervalo en tramos muy cortos, en cada uno la velocidad casi no cambia, y el desplazamiento de ese tramo es el área de un rectángulo estrecho. Al sumar todos los rectángulos se obtiene el área bajo la gráfica. Por eso:

> **El desplazamiento entre dos instantes es el área entre la gráfica $v$–$t$ y el eje del tiempo**, contada como positiva por encima del eje y como negativa por debajo.

En el MRUA esa figura es un **trapecio** de bases $v_0$ y $v$ y altura $t$:

$$\Delta x = \frac{v_0 + v}{2}\,t .$$

Comparando con $\Delta x = v_m\,t$, la **velocidad media** del MRUA es el promedio de la velocidad inicial y la final:

$$v_m = \frac{v_0 + v}{2}.$$

> **Cuidado.** Este promedio solo vale cuando la aceleración es **constante**. En la lección de rapidez vimos que, en general, la velocidad media no es el promedio de las velocidades.

## La ecuación de la posición

El trapecio se puede partir en un rectángulo de altura $v_0$ y un triángulo de base $t$ y altura $a\,t$. Sus áreas son $v_0\,t$ y $\tfrac12 (t)(a\,t)$. Sumándolas:

$$x = x_0 + v_0\,t + \tfrac12\,a\,t^2 .$$

El término $v_0\,t$ es lo que el móvil recorrería en MRU; el término $\tfrac12 a\,t^2$ es la corrección debida a la aceleración. Como $t$ aparece al cuadrado, la gráfica $x$–$t$ es una **parábola**: se curva hacia arriba si $a > 0$ y hacia abajo si $a < 0$.

Una consecuencia curiosa, descubierta por Galileo: si el móvil **parte del reposo**, las distancias recorridas en el primer segundo, en el segundo, en el tercero… están en la proporción $1 : 3 : 5 : 7 \dots$ (los números impares), porque las posiciones crecen como $1, 4, 9, 16\dots$

## Una ecuación sin el tiempo

Muchas veces no conocemos el tiempo ni nos interesa: por ejemplo, para saber cuántos metros necesita un auto para detenerse. Despejando $t = (v - v_0)/a$ de la ecuación de la velocidad y sustituyéndolo en $\Delta x = \tfrac{v_0 + v}{2}\,t$:

$$\Delta x = \frac{(v + v_0)(v - v_0)}{2a} = \frac{v^2 - v_0^2}{2a} \quad\Rightarrow\quad v^2 = v_0^2 + 2\,a\,\Delta x .$$

> **Cuidado.** Esta ecuación da $v^2$, no $v$. Al sacar la raíz cuadrada hay dos posibilidades, $+|v|$ y $-|v|$, y hay que decidir el signo con un argumento físico: ¿el móvil va hacia $+x$ o hacia $-x$ en ese momento?

## Gráficas del MRUA

- **$a$–$t$:** recta horizontal a la altura $a$.
- **$v$–$t$:** recta de pendiente $a$. Si cruza el eje $t$, el móvil invierte su sentido en ese instante.
- **$x$–$t$:** parábola. En el instante en que $v = 0$, la tangente es horizontal (vértice de la parábola): es el punto de retorno.

## Frenado

Un vehículo que frena hasta detenerse ($v = 0$) con aceleración de módulo $|a|$ recorre, según la ecuación sin tiempo,

$$d_f = \frac{v_0^2}{2\,|a|}.$$

La distancia de frenado es **proporcional al cuadrado de la velocidad**: a doble velocidad, **cuatro veces** más distancia. A eso hay que sumar la distancia que se recorre durante el **tiempo de reacción** $t_r$ (de 0.7 a 1.5 s en un conductor atento), en el que el vehículo sigue en MRU: $v_0\,t_r$. Por eso la velocidad excesiva es tan peligrosa: en una guagua a $90\,\mathrm{km/h}$ que frena a $5\,\mathrm{m/s^2}$, la distancia de frenado es más de $60\,\mathrm{m}$, sin contar el tiempo de reacción.

> **Error frecuente.** Usar en el frenado una aceleración positiva cuando el sentido positivo es el del movimiento. Si $v_0 > 0$ y el auto frena, $a < 0$; si se pone $a > 0$, la ecuación da una distancia negativa, sin sentido físico.

## Límites del modelo

Las ecuaciones suponen que la aceleración es exactamente constante durante **todo** el intervalo. En un frenado real, el auto se detiene y se queda quieto; la ecuación $x = x_0 + v_0 t + \tfrac12 a t^2$, en cambio, predice que después de detenerse empezaría a moverse hacia atrás. El simulador de esta lección sigue el modelo matemático, así que sí invierte el sentido. Al resolver un problema de frenado hay que aplicar las ecuaciones **solo hasta el instante en que $v = 0$**. Tampoco es exactamente constante la aceleración de una guagua que arranca (el conductor cambia de marcha), pero el modelo da buenas estimaciones en tramos cortos.`,
  formulas: [
    {
      name: 'Velocidad en el MRUA',
      latex: String.raw`v = v_0 + a\,t`,
      description: 'La velocidad cambia la misma cantidad, a, en cada segundo.',
      variables: [
        { symbol: String.raw`v`, meaning: 'Velocidad en el instante t', unit: 'm/s' },
        { symbol: String.raw`v_0`, meaning: 'Velocidad en t = 0', unit: 'm/s' },
        { symbol: String.raw`a`, meaning: 'Aceleración (constante, con signo)', unit: 'm/s²' },
        { symbol: String.raw`t`, meaning: 'Tiempo transcurrido desde t = 0', unit: 's' },
      ],
    },
    {
      name: 'Posición en el MRUA',
      latex: String.raw`x = x_0 + v_0\,t + \tfrac12\,a\,t^2`,
      description:
        'Área del trapecio bajo la gráfica v–t: rectángulo (v₀t) más triángulo (½at²), sumada a la posición inicial.',
      variables: [
        { symbol: String.raw`x`, meaning: 'Posición en el instante t', unit: 'm' },
        { symbol: String.raw`x_0`, meaning: 'Posición en t = 0', unit: 'm' },
        { symbol: String.raw`v_0`, meaning: 'Velocidad en t = 0', unit: 'm/s' },
        { symbol: String.raw`a`, meaning: 'Aceleración', unit: 'm/s²' },
        { symbol: String.raw`t`, meaning: 'Tiempo', unit: 's' },
      ],
      notes: 'La gráfica x–t es una parábola; su vértice corresponde al instante en que v = 0.',
    },
    {
      name: 'Velocidad y desplazamiento sin el tiempo',
      latex: String.raw`v^2 = v_0^2 + 2\,a\,\Delta x`,
      description: 'Relaciona velocidades y desplazamiento cuando no se conoce (o no interesa) el tiempo.',
      variables: [
        { symbol: String.raw`v,\,v_0`, meaning: 'Velocidades final e inicial', unit: 'm/s' },
        { symbol: String.raw`a`, meaning: 'Aceleración', unit: 'm/s²' },
        { symbol: String.raw`\Delta x`, meaning: 'Desplazamiento (con signo)', unit: 'm' },
      ],
      notes: 'Da v²: el signo de v se elige con un argumento físico.',
    },
    {
      name: 'Velocidad media y desplazamiento (área del trapecio)',
      latex: String.raw`v_m = \frac{v_0 + v}{2}, \qquad \Delta x = \frac{v_0 + v}{2}\,t`,
      description:
        'Con aceleración constante, la velocidad media es el promedio de la inicial y la final; el desplazamiento es el área del trapecio bajo la gráfica v–t.',
      variables: [
        { symbol: String.raw`v_m`, meaning: 'Velocidad media en el intervalo', unit: 'm/s' },
        { symbol: String.raw`v_0,\,v`, meaning: 'Velocidades al inicio y al final del intervalo', unit: 'm/s' },
        { symbol: String.raw`t`, meaning: 'Duración del intervalo', unit: 's' },
      ],
      notes: 'Solo es válida si la aceleración es constante en todo el intervalo.',
    },
    {
      name: 'Distancia de detención',
      latex: String.raw`d = v_0\,t_r + \frac{v_0^2}{2\,|a|}`,
      description:
        'Distancia recorrida durante el tiempo de reacción (MRU) más la distancia de frenado hasta detenerse (MRUA).',
      variables: [
        { symbol: String.raw`d`, meaning: 'Distancia total de detención', unit: 'm' },
        { symbol: String.raw`v_0`, meaning: 'Rapidez al ver el obstáculo', unit: 'm/s' },
        { symbol: String.raw`t_r`, meaning: 'Tiempo de reacción', unit: 's' },
        { symbol: String.raw`|a|`, meaning: 'Módulo de la aceleración de frenado', unit: 'm/s²' },
      ],
      notes: 'La parte de frenado es proporcional a v₀²: a doble rapidez, cuatro veces más distancia.',
    },
  ],
  examples: [
    {
      title: 'Una guagua que arranca',
      statement: String.raw`Una guagua parte del reposo en una parada y acelera uniformemente a $1.5\,\mathrm{m/s^2}$ durante $8.0\,\mathrm{s}$. ¿Qué velocidad alcanza y qué distancia recorre en ese tiempo?`,
      steps: [
        String.raw`Origen en la parada y sentido positivo hacia donde avanza la guagua: $x_0 = 0$, $v_0 = 0$, $a = +1.5\,\mathrm{m/s^2}$, $t = 8.0\,\mathrm{s}$.`,
        String.raw`Velocidad: $v = v_0 + a\,t = 0 + (1.5\,\mathrm{m/s^2})(8.0\,\mathrm{s}) = 12\,\mathrm{m/s}$.`,
        String.raw`Posición: $x = 0 + 0 + \tfrac12 (1.5\,\mathrm{m/s^2})(8.0\,\mathrm{s})^2 = 0.75 \times 64\,\mathrm{m} = 48\,\mathrm{m}$.`,
        String.raw`Comprobación con el área: la gráfica $v$–$t$ es un triángulo de base $8.0\,\mathrm{s}$ y altura $12\,\mathrm{m/s}$; su área es $\tfrac12 (8.0)(12) = 48\,\mathrm{m}$ ✓. También $v_m = (0 + 12)/2 = 6.0\,\mathrm{m/s}$ y $6.0 \times 8.0 = 48\,\mathrm{m}$ ✓.`,
      ],
      result: String.raw`$v = 12\,\mathrm{m/s}$ (unos 43 km/h) y $\Delta x = 48\,\mathrm{m}$.`,
      interpretation:
        'Es un arranque razonable para una guagua urbana. Si hubiera ido todo el tiempo a 12 m/s habría recorrido el doble (96 m): como partió del reposo, su velocidad media es solo la mitad de la final.',
    },
    {
      title: 'Distancia de detención',
      statement: String.raw`Un conductor circula a $72\,\mathrm{km/h}$ cuando ve un obstáculo. Tarda $0.75\,\mathrm{s}$ en reaccionar y luego frena con una aceleración de módulo $5.0\,\mathrm{m/s^2}$. ¿Qué distancia recorre desde que ve el obstáculo hasta detenerse? Compare con el caso en que circula a $36\,\mathrm{km/h}$.`,
      steps: [
        String.raw`Conversión: $v_0 = 72/3.6 = 20\,\mathrm{m/s}$. Sentido positivo hacia donde avanza el auto, así que al frenar $a = -5.0\,\mathrm{m/s^2}$.`,
        String.raw`Reacción (MRU): $d_r = v_0\,t_r = (20\,\mathrm{m/s})(0.75\,\mathrm{s}) = 15\,\mathrm{m}$.`,
        String.raw`Frenado ($v = 0$): $0 = v_0^2 + 2a\,\Delta x \Rightarrow \Delta x = \dfrac{-v_0^2}{2a} = \dfrac{-(20\,\mathrm{m/s})^2}{2(-5.0\,\mathrm{m/s^2})} = 40\,\mathrm{m}$.`,
        String.raw`Total: $d = 15 + 40 = 55\,\mathrm{m}$.`,
        String.raw`A $36\,\mathrm{km/h} = 10\,\mathrm{m/s}$: $d_r = 7.5\,\mathrm{m}$ y $\Delta x = \dfrac{(10)^2}{2(5.0)} = 10\,\mathrm{m}$; total $17.5\,\mathrm{m}$.`,
      ],
      result: String.raw`A $72\,\mathrm{km/h}$ necesita $55\,\mathrm{m}$; a $36\,\mathrm{km/h}$, $17.5\,\mathrm{m}$.`,
      interpretation:
        'Al duplicar la velocidad, la distancia de reacción se duplica (7.5 → 15 m), pero la de frenado se cuadruplica (10 → 40 m). La distancia total pasa a ser más del triple.',
    },
    {
      title: 'Subir por una rampa y regresar',
      statement: String.raw`Un carrito empieza a subir por una rampa con $v_0 = 8.0\,\mathrm{m/s}$ y tiene una aceleración constante de $-2.0\,\mathrm{m/s^2}$ (eje positivo rampa arriba, origen en el punto de partida). Halle su velocidad y su posición a los $6.0\,\mathrm{s}$, y la distancia que ha recorrido.`,
      steps: [
        String.raw`Velocidad: $v = 8.0 + (-2.0)(6.0) = -4.0\,\mathrm{m/s}$. Es negativa: el carrito ya está bajando.`,
        String.raw`Posición: $x = 0 + (8.0)(6.0) + \tfrac12(-2.0)(6.0)^2 = 48 - 36 = 12\,\mathrm{m}$.`,
        String.raw`Comprobación con el área: de 0 a 4.0 s la gráfica $v$–$t$ forma un triángulo sobre el eje, de área $\tfrac12(4.0)(8.0) = 16\,\mathrm{m}$; de 4.0 a 6.0 s, un triángulo bajo el eje, de área $-\tfrac12(2.0)(4.0) = -4\,\mathrm{m}$. Total: $16 - 4 = 12\,\mathrm{m}$ ✓.`,
        String.raw`El carrito se detiene en $t = 8.0/2.0 = 4.0\,\mathrm{s}$, en $x = 16\,\mathrm{m}$; después baja $4\,\mathrm{m}$. Distancia: $16 + 4 = 20\,\mathrm{m}$.`,
        String.raw`Comprobación con la ecuación sin tiempo: $v^2 = 8.0^2 + 2(-2.0)(12) = 16\,\mathrm{m^2/s^2}$, $v = \pm 4.0\,\mathrm{m/s}$. Elegimos el signo negativo porque, en $t = 6.0\,\mathrm{s}$, el carrito baja.`,
      ],
      result: String.raw`$v = -4.0\,\mathrm{m/s}$, $x = 12\,\mathrm{m}$; desplazamiento $12\,\mathrm{m}$ y distancia recorrida $20\,\mathrm{m}$.`,
      interpretation:
        'La ecuación sin tiempo da la misma rapidez (4.0 m/s) al subir y al bajar por el punto x = 12 m: por sí sola no distingue entre ambos pasos. El signo lo decide la situación física.',
    },
  ],
  simulation: {
    key: 'movimiento-rectilineo',
    params: { x0: -40, v0: 0, a: 2, tMax: 10 },
    guide: String.raw`1. Con $x_0 = -40\,\mathrm{m}$, $v_0 = 0$ y $a = 2\,\mathrm{m/s^2}$, pulse **Iniciar**. Describa la forma de las tres gráficas ($x$–$t$, $v$–$t$ y $a$–$t$).
2. Con la tabla, calcule cuánto avanza el móvil en cada segundo (de 0 a 1 s, de 1 a 2 s, de 2 a 3 s…). ¿Qué patrón siguen esos números?
3. Lea $v$ en $t = 6\,\mathrm{s}$ y calcule el área del triángulo bajo la gráfica $v$–$t$ entre 0 y 6 s. Compárela con $x(6\,\mathrm{s}) - x_0$.
4. Ponga $x_0 = 0$, $v_0 = 15\,\mathrm{m/s}$ y $a = -3\,\mathrm{m/s^2}$. Localice el instante en que el móvil se detiene y su posición en ese momento. Compruebe la posición con $v^2 = v_0^2 + 2a\,\Delta x$.
5. En esa misma simulación, observe qué ocurre después de que el móvil se detiene. ¿Haría lo mismo un auto real que frena? Explique qué hipótesis del modelo deja de valer.`,
  },
  exercises: [
    {
      id: 'b2-mrua-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['mrua-ecuacion-velocidad'],
      prompt: String.raw`Un tren del Metro sale de una estación desde el reposo con una aceleración constante de $1.2\,\mathrm{m/s^2}$. ¿Qué velocidad tiene a los $15\,\mathrm{s}$?`,
      format: 'numeric',
      unitHint: 'm/s',
    },
    {
      id: 'b2-mrua-02',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['mrua-ecuacion-sin-tiempo', 'mrua-frenado'],
      prompt: String.raw`Un auto circula a $25\,\mathrm{m/s}$ por una carretera recta y frena con una aceleración constante de módulo $5.0\,\mathrm{m/s^2}$ hasta detenerse. ¿Qué distancia recorre mientras frena?`,
      format: 'numeric',
      unitHint: 'm',
    },
    {
      id: 'b2-mrua-03',
      category: 'grafica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['mrua-velocidad-media-area', 'mrua-graficas'],
      prompt: String.raw`La gráfica muestra la velocidad de un ciclista que acelera de manera uniforme por una recta. ¿Cuál es su desplazamiento entre $t = 0$ y $t = 6\,\mathrm{s}$?`,
      format: 'numeric',
      unitHint: 'm',
      figure: {
        kind: 'line',
        title: 'Velocidad del ciclista frente al tiempo',
        x: { label: 't', unit: 's' },
        y: { label: 'v', unit: 'm/s' },
        series: [
          {
            name: 'v(t)',
            points: [
              [0, 4],
              [1, 6],
              [2, 8],
              [3, 10],
              [4, 12],
              [5, 14],
              [6, 16],
            ],
          },
        ],
      },
    },
    {
      id: 'b2-mrua-04',
      category: 'vf_justificacion',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['mrua-frenado', 'mrua-ecuacion-sin-tiempo'],
      prompt: String.raw`**Verdadero o falso:** si un conductor circula al doble de velocidad y frena con la misma aceleración, la distancia que recorre mientras frena (sin contar el tiempo de reacción) también se duplica. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b2-mrua-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['mrua-ecuacion-posicion', 'mru-encuentro'],
      prompt: String.raw`Un semáforo cambia a verde y un auto arranca desde el reposo con una aceleración constante de $2.0\,\mathrm{m/s^2}$. En ese mismo instante lo adelanta un motoconcho que circula a $12\,\mathrm{m/s}$ constantes por el carril de al lado. ¿A qué distancia del semáforo alcanza el auto al motoconcho?`,
      format: 'numeric',
      unitHint: 'm',
    },
    {
      id: 'b2-mrua-06',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['mrua-ecuacion-posicion', 'mrua-graficas'],
      prompt: String.raw`Una canica se suelta desde el reposo en una rampa y baja con aceleración constante. Durante el primer segundo recorre $0.40\,\mathrm{m}$. ¿Qué distancia recorre durante el **segundo** segundo (entre $t = 1\,\mathrm{s}$ y $t = 2\,\mathrm{s}$)?`,
      format: 'choice',
      options: [
        String.raw`$0.40\,\mathrm{m}$`,
        String.raw`$0.80\,\mathrm{m}$`,
        String.raw`$1.20\,\mathrm{m}$`,
        String.raw`$1.60\,\mathrm{m}$`,
      ],
    },
    {
      id: 'b2-mrua-07',
      category: 'experimento',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['mrua-frenado', 'mrua-ecuacion-sin-tiempo'],
      prompt: String.raw`En el simulador fije $x_0 = 0$, $v_0 = 12\,\mathrm{m/s}$, $a = -3\,\mathrm{m/s^2}$ y duración $8\,\mathrm{s}$, y pulse **Iniciar**. El móvil representa un vehículo que frena. Con la tabla de datos, determine la **distancia de frenado**, es decir, la distancia que recorre desde $t = 0$ hasta que se detiene. Después compruebe su lectura con la ecuación $v^2 = v_0^2 + 2a\,\Delta x$.`,
      format: 'numeric',
      unitHint: 'm',
      simulation: { key: 'movimiento-rectilineo', params: { x0: 0, v0: 12, a: -3, tMax: 8 } },
    },
    {
      id: 'b2-mrua-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['mrua-frenado', 'mrua-ecuacion-sin-tiempo', 'mrua-velocidad-media-area'],
      prompt: String.raw`Un conductor circula a $90\,\mathrm{km/h}$ por una carretera recta cuando ve un perro inmóvil en la vía, a $50\,\mathrm{m}$ delante. Su tiempo de reacción es $0.80\,\mathrm{s}$ y, al frenar, la aceleración tiene un módulo de $6.0\,\mathrm{m/s^2}$.

(a) Calcule la distancia total que necesita para detenerse. ¿Alcanza al perro?
(b) Si lo alcanza, ¿con qué velocidad (en km/h) llegaría a la posición del perro?
(c) ¿Cuál es la velocidad máxima (en km/h) a la que podría circular para detenerse justo antes de llegar al perro, con el mismo tiempo de reacción y la misma aceleración de frenado?
(d) Dibuje la gráfica $v$–$t$ del caso (c) e interprete la distancia de 50 m como un área.`,
      format: 'open',
    },
  ],
};
