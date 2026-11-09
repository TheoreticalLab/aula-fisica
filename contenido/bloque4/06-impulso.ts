import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'impulso',
  title: 'Impulso y fuerza media',
  summary:
    'El impulso de una fuerza es su efecto acumulado en el tiempo, J = F·Δt, y es igual al cambio de la cantidad de movimiento. Alargar el tiempo de contacto reduce la fuerza media: así funcionan los airbags y los guantes de béisbol.',
  concepts: [
    { slug: 'impulso-definicion', name: 'Impulso de una fuerza: J = F·Δt' },
    { slug: 'impulso-teorema', name: 'Teorema impulso–cantidad de movimiento: J = Δp' },
    { slug: 'impulso-fuerza-media', name: 'Fuerza media y tiempo de contacto' },
    { slug: 'impulso-grafica-ft', name: 'Impulso como área bajo la gráfica F–t' },
  ],
  theory: String.raw`## Golpes, choques y tiempos cortos

Cuando un bate golpea una pelota de béisbol, la fuerza entre ambos es enorme, pero dura apenas un milisegundo. En un choque de carros, en un salto que termina en el suelo o en un penal de fútbol pasa lo mismo: fuerzas grandes, muy breves y que cambian rápidamente. Seguir esa fuerza instante a instante es difícil. Lo que sí podemos medir con facilidad es su **efecto total**: cuánto cambió la velocidad del cuerpo. Para eso se definen el impulso y la cantidad de movimiento.

## Cantidad de movimiento

La **cantidad de movimiento** (o momento lineal) de un cuerpo es el producto de su masa por su velocidad:

$$\vec p = m\,\vec v .$$

Es un **vector**, con la dirección y el sentido de la velocidad, y se mide en $\mathrm{kg\cdot m/s}$. En una dimensión basta con un signo: si elegimos positivo hacia la derecha, un cuerpo que se mueve hacia la izquierda tiene $p < 0$. La estudiaremos con detalle en la próxima lección.

## Impulso

El **impulso** de una fuerza constante $\vec F$ que actúa durante un intervalo $\Delta t$ es

$$\vec J = \vec F\,\Delta t .$$

También es un vector, con la dirección de la fuerza, y se mide en $\mathrm{N\cdot s}$. Como $1\,\mathrm{N\cdot s} = 1\,\mathrm{kg\cdot m/s}$, tiene las mismas unidades que la cantidad de movimiento, y no por casualidad.

## El teorema impulso–cantidad de movimiento

Si la fuerza neta sobre un cuerpo es constante, la segunda ley de Newton dice $\vec F_{neta} = m\,\vec a = m\,\dfrac{\Delta \vec v}{\Delta t}$. Multiplicando por $\Delta t$:

$$\vec J_{neto} = \vec F_{neta}\,\Delta t = m\,\Delta\vec v = \Delta \vec p = \vec p_f - \vec p_i .$$

**El impulso neto sobre un cuerpo es igual al cambio de su cantidad de movimiento.** Es la segunda ley de Newton escrita de otra forma, y vale también cuando la fuerza varía, si se usa el impulso total.

## Fuerza media

En un choque real la fuerza no es constante: crece desde cero, alcanza un máximo y vuelve a cero. Definimos la **fuerza media** como la fuerza constante que, actuando durante el mismo tiempo, produciría el mismo impulso:

$$\overline{F} = \frac{\Delta p}{\Delta t} .$$

Esta ecuación encierra la idea más útil de la lección: **para un mismo cambio de cantidad de movimiento, cuanto más largo es el tiempo de contacto, menor es la fuerza media.**

- Un **airbag** o un cinturón de seguridad no evitan que el pasajero pase de $60\,\mathrm{km/h}$ a cero: el cambio de $p$ es el mismo. Lo que hacen es alargar el frenado de unos milisegundos (contra el tablero) a una décima de segundo o más, y así reducen la fuerza muchas veces.
- El receptor de béisbol retrocede la mano al atrapar una recta, y el guante tiene relleno: ambos alargan el contacto.
- Al saltar desde un muro, doblamos las rodillas al caer.
- Al revés: el bateador quiere una fuerza grande, y una pelota que **rebota** sufre un cambio de cantidad de movimiento mayor que una que solo se detiene.

> **Cuidado.** Cuando un cuerpo rebota, $\Delta p$ se calcula con signos. Si una pelota llega a $+20\,\mathrm{m/s}$ y sale a $-15\,\mathrm{m/s}$, el cambio de velocidad es $-35\,\mathrm{m/s}$, no $-5\,\mathrm{m/s}$.

## El impulso como área bajo la gráfica F–t

Si se representa la fuerza frente al tiempo, el **impulso es el área entre la curva y el eje del tiempo**. Para una fuerza constante es un rectángulo, $F\,\Delta t$; para un pulso con forma triangular, $\tfrac12 F_{max}\,\Delta t$. La fuerza media es la altura del rectángulo que tiene **la misma área y la misma base** que el pulso real. Por eso el pico de la fuerza siempre es mayor que su valor medio.

## Errores frecuentes

> **Error frecuente.** Restar las rapideces en un rebote en lugar de las velocidades con signo.

> **Error frecuente.** Olvidar convertir milisegundos a segundos: $1\,\mathrm{ms} = 10^{-3}\,\mathrm{s}$.

> **Error frecuente.** Confundir la fuerza media con la fuerza máxima. Las lesiones dependen sobre todo del pico.

> **Error frecuente.** Olvidar el peso. Al caer de pie, la fuerza del suelo debe frenar al cuerpo **y además** sostener su peso: $N_{media} = \Delta p/\Delta t + mg$.

## Límites del modelo

- El teorema impulso–cantidad de movimiento trata el cuerpo como una partícula. En un choque real, parte del cuerpo se deforma.
- La forma exacta del pulso de fuerza depende de los materiales; el impulso (el área) lo fijan las velocidades antes y después, pero el pico no.
- En choques muy breves, las fuerzas como el peso o la fricción suelen ser despreciables frente a la fuerza de contacto. No ocurre así en contactos largos, como la caída sobre un colchón.`,
  formulas: [
    {
      name: 'Impulso de una fuerza constante',
      latex: String.raw`\vec J = \vec F\,\Delta t`,
      description: 'Efecto acumulado de una fuerza durante un intervalo de tiempo.',
      variables: [
        { symbol: String.raw`\vec J`, meaning: 'Impulso', unit: 'N·s' },
        { symbol: String.raw`\vec F`, meaning: 'Fuerza (constante o media)', unit: 'N' },
        { symbol: String.raw`\Delta t`, meaning: 'Duración de la acción', unit: 's' },
      ],
    },
    {
      name: 'Teorema impulso–cantidad de movimiento',
      latex: String.raw`\vec J_{neto} = \Delta \vec p = m\,\vec v_f - m\,\vec v_i`,
      description: 'El impulso neto sobre un cuerpo es igual al cambio de su cantidad de movimiento.',
      variables: [
        { symbol: String.raw`\vec p`, meaning: 'Cantidad de movimiento, m·v', unit: 'kg·m/s' },
        { symbol: String.raw`\vec v_i,\,\vec v_f`, meaning: 'Velocidad inicial y final (con signo)', unit: 'm/s' },
      ],
      notes: '1 N·s = 1 kg·m/s.',
    },
    {
      name: 'Fuerza media',
      latex: String.raw`\overline{F} = \frac{\Delta p}{\Delta t}`,
      description: 'Fuerza constante que produciría el mismo cambio de cantidad de movimiento en el mismo tiempo.',
      variables: [
        { symbol: String.raw`\overline{F}`, meaning: 'Fuerza neta media', unit: 'N' },
        { symbol: String.raw`\Delta t`, meaning: 'Tiempo de contacto', unit: 's' },
      ],
      notes: 'Para un mismo Δp, alargar Δt reduce la fuerza media.',
    },
  ],
  examples: [
    {
      title: 'Batazo',
      statement: String.raw`Una pelota de béisbol de $0.145\,\mathrm{kg}$ llega al bate a $38\,\mathrm{m/s}$ y sale en sentido contrario a $45\,\mathrm{m/s}$. El contacto dura $1.2\,\mathrm{ms}$. Calcule el impulso sobre la pelota y la fuerza media del bate.`,
      steps: [
        String.raw`Sentido positivo: hacia donde sale la pelota. Entonces $v_i = -38\,\mathrm{m/s}$ y $v_f = +45\,\mathrm{m/s}$.`,
        String.raw`$J = m(v_f - v_i) = 0.145\,[45 - (-38)] = 0.145 \times 83 = 12.0\,\mathrm{N\cdot s}$.`,
        String.raw`$\Delta t = 1.2\,\mathrm{ms} = 1.2\times10^{-3}\,\mathrm{s}$; $\overline{F} = \dfrac{12.0\,\mathrm{N\cdot s}}{1.2\times10^{-3}\,\mathrm{s}} = 1.0\times10^{4}\,\mathrm{N}$.`,
      ],
      result: String.raw`$J \approx 12\,\mathrm{N\cdot s}$ en el sentido de salida y $\overline{F} \approx 1.0\times10^{4}\,\mathrm{N}$.`,
      interpretation: 'Es una fuerza unas 7000 veces mayor que el peso de la pelota. Si se hubieran restado las rapideces (45 − 38), el impulso habría salido casi doce veces menor.',
    },
    {
      title: 'Airbag frente a tablero',
      statement: String.raw`En un choque, un pasajero de $70\,\mathrm{kg}$ que viaja a $15\,\mathrm{m/s}$ queda detenido. Compare la fuerza media sobre él si se detiene en $0.010\,\mathrm{s}$ contra el tablero o en $0.15\,\mathrm{s}$ con el airbag.`,
      steps: [
        String.raw`El cambio de cantidad de movimiento es el mismo en ambos casos: $|\Delta p| = (70)(15) = 1050\,\mathrm{kg\cdot m/s}$.`,
        String.raw`Contra el tablero: $\overline{F} = 1050/0.010 = 1.05\times10^{5}\,\mathrm{N}$.`,
        String.raw`Con el airbag: $\overline{F} = 1050/0.15 = 7.0\times10^{3}\,\mathrm{N}$.`,
      ],
      result: String.raw`La fuerza media se reduce $15$ veces: de unos $105\,\mathrm{kN}$ a $7\,\mathrm{kN}$.`,
      interpretation: 'El airbag no reduce el impulso, que está fijado por la velocidad inicial: reparte el mismo impulso en un tiempo quince veces mayor y sobre una superficie más amplia.',
    },
    {
      title: 'Impulso a partir de una gráfica',
      statement: String.raw`La fuerza de un pie sobre un balón de $0.45\,\mathrm{kg}$ en reposo crece linealmente de $0$ a $900\,\mathrm{N}$ en $4.0\,\mathrm{ms}$ y vuelve a cero, también linealmente, en otros $4.0\,\mathrm{ms}$. ¿Con qué rapidez sale el balón?`,
      steps: [
        String.raw`El pulso es un triángulo de base $8.0\,\mathrm{ms} = 8.0\times10^{-3}\,\mathrm{s}$ y altura $900\,\mathrm{N}$.`,
        String.raw`$J = \tfrac12 (8.0\times10^{-3}\,\mathrm{s})(900\,\mathrm{N}) = 3.6\,\mathrm{N\cdot s}$.`,
        String.raw`$v_f = J/m = 3.6/0.45 = 8.0\,\mathrm{m/s}$ (parte del reposo).`,
      ],
      result: String.raw`$v_f = 8.0\,\mathrm{m/s}$; la fuerza media fue $J/\Delta t = 450\,\mathrm{N}$, la mitad del pico.`,
      interpretation: 'Un tiro real de un futbolista es bastante más rápido (20–30 m/s): su pie aplica fuerzas mayores, aunque durante un tiempo parecido.',
    },
  ],
  simulation: {
    key: 'laboratorio-choques',
    params: { m1: 2, m2: 1, v1: 6, v2: 0, e: 0, mu: 0.25, g: 9.8, separacion: 1.2, dt_ms: 10 },
    guide: String.raw`1. Pulse **Iniciar**. En la etapa A (el choque), lea el impulso sobre cada bloque. ¿Cómo son entre sí?
2. Compruebe que el impulso sobre el bloque 2 es igual a su cambio de cantidad de movimiento, $m_2(v_2' - v_2)$.
3. Abra la gráfica **F–t (modelo)**. Lea el pico y la fuerza media, y compruebe que la media es $|J|/\Delta t$.
4. Cambie la duración del contacto de $10\,\mathrm{ms}$ a $50\,\mathrm{ms}$. ¿Cambia el impulso? ¿Qué le pasa a la fuerza media? Relacione el resultado con el funcionamiento de un airbag.
5. Cambie el tipo de choque a **Elástico**. ¿Aumenta o disminuye el impulso sobre el bloque 2? Explique por qué un rebote requiere más impulso.`,
  },
  exercises: [
    {
      id: 'b4-imp-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['impulso-teorema'],
      prompt: String.raw`Una pelota de béisbol de $0.145\,\mathrm{kg}$ llega al bate a $40\,\mathrm{m/s}$ y sale en sentido opuesto a $50\,\mathrm{m/s}$. ¿Cuál es el **módulo** del impulso que el bate ejerce sobre la pelota?`,
      format: 'numeric',
      unitHint: 'N·s',
    },
    {
      id: 'b4-imp-02',
      category: 'conceptual',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['impulso-fuerza-media'],
      prompt: String.raw`En un choque frontal, un pasajero con cinturón y airbag pasa de $50\,\mathrm{km/h}$ al reposo. Comparado con el mismo choque sin airbag, ¿qué hace el airbag?`,
      format: 'choice',
      options: [
        'Reduce el cambio de cantidad de movimiento del pasajero.',
        'Reduce el impulso que recibe el pasajero.',
        'Aumenta el tiempo de frenado y, con ello, reduce la fuerza media sobre el pasajero.',
        'Aumenta el tiempo de frenado y, con ello, aumenta el impulso.',
      ],
    },
    {
      id: 'b4-imp-03',
      category: 'grafica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['impulso-grafica-ft'],
      prompt: String.raw`La gráfica muestra la fuerza que ejerce una raqueta sobre una pelota de tenis durante el golpe. ¿Cuál es el impulso que recibe la pelota? (Observe la unidad del eje del tiempo.)`,
      format: 'numeric',
      unitHint: 'N·s',
      figure: {
        kind: 'line',
        title: 'Fuerza de la raqueta frente al tiempo',
        x: { label: 't', unit: 'ms' },
        y: { label: 'F', unit: 'N' },
        series: [
          {
            name: 'F(t)',
            points: [
              [0, 0],
              [1, 400],
              [2, 800],
              [3, 1200],
              [4, 900],
              [5, 600],
              [6, 300],
              [7, 0],
            ],
          },
        ],
      },
    },
    {
      id: 'b4-imp-04',
      category: 'experimento',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['impulso-fuerza-media', 'impulso-teorema'],
      prompt: String.raw`En el simulador, fije $m_1 = 2\,\mathrm{kg}$, $m_2 = 1\,\mathrm{kg}$, $v_1 = 6\,\mathrm{m/s}$, $v_2 = 0$, $e = 0$ (choque totalmente inelástico), $\mu_k = 0.25$, $g = 9.8\,\mathrm{m/s^2}$, separación $1.2\,\mathrm{m}$ y duración del contacto $10\,\mathrm{ms}$. Ejecute la simulación y lea el impulso que recibe el bloque 2 en el choque. Con ese valor, calcule la **fuerza media** que el bloque 1 ejerce sobre el bloque 2 durante el contacto. Compruebe su resultado en la gráfica F–t.`,
      format: 'numeric',
      unitHint: 'N',
      simulation: {
        key: 'laboratorio-choques',
        params: { m1: 2, m2: 1, v1: 6, v2: 0, e: 0, mu: 0.25, g: 9.8, separacion: 1.2, dt_ms: 10 },
      },
    },
    {
      id: 'b4-imp-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['impulso-fuerza-media', 'impulso-teorema'],
      prompt: String.raw`Una persona de $70\,\mathrm{kg}$ salta desde un muro de $1.0\,\mathrm{m}$ de altura (parte del reposo) y cae de pie sobre el suelo. Al doblar las rodillas, tarda $0.20\,\mathrm{s}$ en detenerse por completo. ¿Cuál es la **fuerza media que ejerce el suelo** sobre la persona durante el frenado?`,
      format: 'numeric',
      unitHint: 'N',
    },
    {
      id: 'b4-imp-06',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['impulso-fuerza-media'],
      prompt: String.raw`**Verdadero o falso:** el receptor de béisbol mueve el guante hacia atrás al atrapar la pelota para que esta reciba un impulso menor. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b4-imp-07',
      category: 'numerica',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['impulso-teorema', 'impulso-fuerza-media'],
      prompt: String.raw`Una pelota de tenis de $0.058\,\mathrm{kg}$ choca perpendicularmente contra una pared a $20\,\mathrm{m/s}$ y rebota en sentido opuesto a $15\,\mathrm{m/s}$. El contacto dura $5.0\,\mathrm{ms}$. ¿Cuál es el **módulo** de la fuerza media que la pared ejerce sobre la pelota?`,
      format: 'numeric',
      unitHint: 'N',
    },
    {
      id: 'b4-imp-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['impulso-teorema', 'impulso-fuerza-media', 'impulso-grafica-ft'],
      prompt: String.raw`Se deja caer un huevo de $60\,\mathrm{g}$ desde $1.5\,\mathrm{m}$ de altura. En un caso cae sobre el piso de cerámica y se detiene en $2.0\,\mathrm{ms}$; en otro, cae sobre un cojín y se detiene en $0.10\,\mathrm{s}$.

(a) Calcule la rapidez del huevo justo antes del impacto.
(b) Calcule el impulso que recibe en cada caso. ¿Es distinto? Explique.
(c) Calcule la fuerza media de frenado en cada caso y compárela con el peso del huevo.
(d) Dibuje cualitativamente, en una misma gráfica F–t, los dos pulsos de fuerza, y explique qué tienen en común y en qué se diferencian.`,
      format: 'open',
    },
  ],
};
