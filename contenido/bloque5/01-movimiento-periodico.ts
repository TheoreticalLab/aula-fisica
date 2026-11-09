import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'movimiento-periodico',
  title: 'Movimiento periódico',
  summary:
    'Movimientos que se repiten a intervalos iguales de tiempo: amplitud, período, frecuencia y frecuencia angular, y cómo leerlos en una gráfica x–t.',
  concepts: [
    { slug: 'movimiento-periodico-definicion', name: 'Movimiento periódico y oscilación' },
    { slug: 'movimiento-periodico-periodo-frecuencia', name: 'Período y frecuencia' },
    { slug: 'movimiento-periodico-frecuencia-angular', name: 'Frecuencia angular' },
    { slug: 'movimiento-periodico-graficas', name: 'Lectura de gráficas x–t de oscilaciones' },
  ],
  theory: String.raw`## Movimientos que se repiten

Muchos movimientos de la naturaleza y de la técnica **se repiten idénticos a intervalos iguales de tiempo**: el péndulo de un reloj, las aspas de un ventilador, el pistón de un motor, las cuerdas de una guitarra, el latido del corazón (aproximadamente) o la Tierra en su órbita. A estos movimientos se les llama **periódicos**.

Un caso particular muy importante es la **oscilación** o **vibración**: un movimiento de ida y vuelta alrededor de una **posición de equilibrio**, que es la posición donde el cuerpo quedaría en reposo si nadie lo perturbara. Un columpio en un parque, una boya que sube y baja con el oleaje en la bahía de Samaná o la lengüeta de una armónica oscilan alrededor de su equilibrio.

No todo movimiento repetitivo es periódico en sentido estricto. Una pelota que rebota y cada vez sube menos **no** repite el mismo movimiento: cada rebote dura menos y llega más bajo. Decimos que es un movimiento *amortiguado*. En muchos casos reales el amortiguamiento es pequeño y el modelo periódico es una buena aproximación durante varios ciclos.

## Ciclo, período y frecuencia

Un **ciclo** u **oscilación completa** es el tramo de movimiento al cabo del cual el cuerpo vuelve a la **misma posición, moviéndose en el mismo sentido**. Para un columpio que se suelta desde atrás, un ciclo es: atrás → adelante → atrás.

> **Cuidado.** Ir de un extremo al otro es solo **medio ciclo**. El cuerpo está otra vez en un extremo, pero en el extremo opuesto.

- El **período** $T$ es el tiempo que dura un ciclo. Se mide en segundos.
- La **frecuencia** $f$ es el número de ciclos por unidad de tiempo. Su unidad es el **hertz** (Hz): $1\,\mathrm{Hz} = 1$ ciclo por segundo $= 1\,\mathrm{s^{-1}}$.

Período y frecuencia son **inversos**: si un ciclo dura $T = 0.25\,\mathrm{s}$, en un segundo caben $4$ ciclos, es decir, $f = 4\,\mathrm{Hz}$:

$$f = \frac{1}{T}.$$

Cuanto **mayor** es la frecuencia, **menor** es el período: las oscilaciones rápidas tienen períodos cortos.

En la práctica, el período se mide mejor **cronometrando varios ciclos** y dividiendo: si un péndulo hace $N = 20$ oscilaciones en $t = 36\,\mathrm{s}$, entonces $T = t/N = 1.8\,\mathrm{s}$. Así, el error del cronometraje manual (unas décimas de segundo al pulsar el botón) se reparte entre los 20 ciclos.

Otras unidades frecuentes: las revoluciones por minuto (rpm) en motores y lavadoras, y los latidos por minuto en medicina. Para pasarlas a hertz, se divide entre 60.

## Amplitud

La **amplitud** $A$ es el **desplazamiento máximo** medido **desde la posición de equilibrio**. Si un bloque oscila entre $x = -5\,\mathrm{cm}$ y $x = +5\,\mathrm{cm}$, su amplitud es $5\,\mathrm{cm}$, no $10\,\mathrm{cm}$. La distancia entre los dos extremos (la «excursión pico a pico») vale $2A$.

En un ciclo completo el cuerpo recorre una **distancia** de $4A$: del extremo al equilibrio ($A$), del equilibrio al otro extremo ($A$) y de regreso ($2A$). Su **desplazamiento** en un ciclo, en cambio, es cero, porque vuelve al mismo punto.

## Frecuencia angular

Cuando un punto gira con movimiento circular uniforme, su ángulo aumenta $2\pi$ radianes en cada vuelta. La rapidez con que cambia ese ángulo es la **frecuencia angular**

$$\omega = 2\pi f = \frac{2\pi}{T},$$

que se mide en **radianes por segundo** (rad/s). En las próximas lecciones veremos que la oscilación de un resorte o de un péndulo es la «sombra» de un movimiento circular, y por eso $\omega$ aparece en todas sus ecuaciones. Note que $\omega$ y $f$ **no** son lo mismo: difieren en un factor $2\pi$. Un error muy común es olvidar ese factor.

## Leer una gráfica posición–tiempo

La gráfica $x$–$t$ de una oscilación es una curva que se repite. De ella se leen:

1. **La posición de equilibrio:** la línea central, a medio camino entre máximos y mínimos.
2. **La amplitud:** la distancia vertical desde esa línea central hasta un máximo (o hasta un mínimo).
3. **El período:** la distancia horizontal entre **dos máximos consecutivos** (o entre dos mínimos, o entre dos cruces por el centro **en el mismo sentido**). La distancia entre un máximo y el mínimo siguiente es solo $T/2$.

Para leer el período con más precisión, mida el tiempo que ocupan varios ciclos y divida, igual que con el cronómetro.

La pendiente de la gráfica $x$–$t$ es la velocidad: es nula en los máximos y mínimos (el cuerpo se detiene un instante en los extremos) y máxima, en valor absoluto, al cruzar el equilibrio.

## Errores frecuentes

- Confundir $T$ con $f$: si una lavadora gira a $20$ vueltas por segundo, su período es $0.05\,\mathrm{s}$, no $20\,\mathrm{s}$.
- Tomar como amplitud la distancia entre extremos.
- Contar como ciclo completo el viaje de un extremo al otro.
- Usar $\omega = f$ olvidando el factor $2\pi$.

## Límites del modelo

El modelo de movimiento periódico supone que cada ciclo es idéntico al anterior. Los sistemas reales pierden energía por fricción y resistencia del aire, de modo que la amplitud disminuye poco a poco. Si la pérdida por ciclo es pequeña, el período casi no cambia y el modelo sigue siendo útil. Si queremos mantener la oscilación (un reloj, un columpio), hay que reponer la energía con un empujón periódico.`,
  formulas: [
    {
      name: 'Relación entre frecuencia y período',
      latex: String.raw`f = \frac{1}{T}`,
      description: 'La frecuencia es el número de ciclos por segundo; el período, la duración de un ciclo.',
      variables: [
        { symbol: String.raw`f`, meaning: 'Frecuencia', unit: 'Hz (= 1/s)' },
        { symbol: String.raw`T`, meaning: 'Período', unit: 's' },
      ],
    },
    {
      name: 'Período a partir de varios ciclos',
      latex: String.raw`T = \frac{t}{N}`,
      description: 'Si en un tiempo t se cuentan N ciclos completos, cada ciclo dura t/N.',
      variables: [
        { symbol: String.raw`t`, meaning: 'Tiempo total medido', unit: 's' },
        { symbol: String.raw`N`, meaning: 'Número de ciclos completos', unit: '— (adimensional)' },
      ],
    },
    {
      name: 'Frecuencia angular',
      latex: String.raw`\omega = 2\pi f = \frac{2\pi}{T}`,
      description: 'Ángulo (en radianes) que avanzaría por segundo el movimiento circular asociado a la oscilación.',
      variables: [
        { symbol: String.raw`\omega`, meaning: 'Frecuencia angular', unit: 'rad/s' },
        { symbol: String.raw`f`, meaning: 'Frecuencia', unit: 'Hz' },
        { symbol: String.raw`T`, meaning: 'Período', unit: 's' },
      ],
      notes: 'ω y f tienen las mismas dimensiones (1/s) pero no el mismo valor: difieren en el factor 2π.',
    },
  ],
  examples: [
    {
      title: 'Frecuencia cardíaca',
      statement: String.raw`En reposo, el corazón de una persona late $72$ veces por minuto. Determine la frecuencia en hertz y el período de cada latido.`,
      steps: [
        String.raw`Pasamos a ciclos por segundo: $f = \dfrac{72\ \text{latidos}}{60\,\mathrm{s}} = 1.2\,\mathrm{Hz}$.`,
        String.raw`El período es el inverso: $T = \dfrac{1}{f} = \dfrac{1}{1.2\,\mathrm{Hz}} = 0.833\,\mathrm{s}$.`,
      ],
      result: String.raw`$f = 1.2\,\mathrm{Hz}$ y $T \approx 0.83\,\mathrm{s}$.`,
      interpretation: 'Cada latido dura algo menos de un segundo, lo que concuerda con la experiencia de tomarse el pulso.',
    },
    {
      title: 'Centrifugado de una lavadora',
      statement: String.raw`El tambor de una lavadora centrifuga a $1200\,\mathrm{rpm}$. Calcule su frecuencia, su período y su frecuencia angular.`,
      steps: [
        String.raw`Convertimos rpm a vueltas por segundo: $f = \dfrac{1200\ \text{vueltas}}{60\,\mathrm{s}} = 20\,\mathrm{Hz}$.`,
        String.raw`Período: $T = \dfrac{1}{20\,\mathrm{Hz}} = 0.050\,\mathrm{s}$.`,
        String.raw`Frecuencia angular: $\omega = 2\pi f = 2\pi\,(20\,\mathrm{Hz}) = 126\,\mathrm{rad/s}$.`,
      ],
      result: String.raw`$f = 20\,\mathrm{Hz}$, $T = 0.050\,\mathrm{s}$ y $\omega \approx 126\,\mathrm{rad/s}$.`,
      interpretation: 'Cada vuelta dura cinco centésimas de segundo, demasiado rápido para seguirla con la vista; por eso el tambor parece un borrón.',
    },
    {
      title: 'Lectura de una gráfica x–t',
      statement: String.raw`La gráfica $x$–$t$ de una boya oscila entre $x = -0.30\,\mathrm{m}$ y $x = +0.30\,\mathrm{m}$ alrededor de $x = 0$. El primer máximo está en $t = 1.0\,\mathrm{s}$ y el cuarto máximo en $t = 10.0\,\mathrm{s}$. Determine la amplitud y el período.`,
      steps: [
        String.raw`La línea central es $x = 0$ y los extremos están a $0.30\,\mathrm{m}$ de ella: $A = 0.30\,\mathrm{m}$ (no $0.60\,\mathrm{m}$, que es la distancia entre extremos).`,
        String.raw`Entre el primer y el cuarto máximo hay **tres** ciclos completos (1→2, 2→3, 3→4), que ocupan $10.0\,\mathrm{s} - 1.0\,\mathrm{s} = 9.0\,\mathrm{s}$.`,
        String.raw`Período: $T = \dfrac{9.0\,\mathrm{s}}{3} = 3.0\,\mathrm{s}$.`,
      ],
      result: String.raw`$A = 0.30\,\mathrm{m}$ y $T = 3.0\,\mathrm{s}$.`,
      interpretation: 'Contar cuatro máximos no son cuatro ciclos: los ciclos son los intervalos entre máximos. Es el mismo razonamiento que contar los espacios entre los postes de una cerca.',
    },
  ],
  simulation: null,
  exercises: [
    {
      id: 'b5-per-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['movimiento-periodico-periodo-frecuencia'],
      prompt: String.raw`Un niño en un columpio completa $12$ oscilaciones en $30\,\mathrm{s}$. ¿Cuál es el período del columpio?`,
      format: 'numeric',
      unitHint: 's',
    },
    {
      id: 'b5-per-02',
      category: 'grafica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['movimiento-periodico-graficas', 'movimiento-periodico-periodo-frecuencia'],
      prompt: 'La gráfica muestra la posición de un objeto que oscila alrededor de x = 0. ¿Cuál es la frecuencia de la oscilación?',
      format: 'numeric',
      unitHint: 'Hz',
      figure: {
        kind: 'line',
        title: 'Posición frente al tiempo',
        x: { label: 't', unit: 's' },
        y: { label: 'x', unit: 'cm' },
        series: [
          {
            name: 'x(t)',
            points: [[0, 4], [0.05, 3.696], [0.1, 2.828], [0.15, 1.531], [0.2, 0], [0.25, -1.531], [0.3, -2.828], [0.35, -3.696], [0.4, -4], [0.45, -3.696], [0.5, -2.828], [0.55, -1.531], [0.6, 0], [0.65, 1.531], [0.7, 2.828], [0.75, 3.696], [0.8, 4], [0.85, 3.696], [0.9, 2.828], [0.95, 1.531], [1, 0], [1.05, -1.531], [1.1, -2.828], [1.15, -3.696], [1.2, -4], [1.25, -3.696], [1.3, -2.828], [1.35, -1.531], [1.4, 0], [1.45, 1.531], [1.5, 2.828], [1.55, 3.696], [1.6, 4]],
          },
        ],
      },
    },
    {
      id: 'b5-per-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['movimiento-periodico-periodo-frecuencia'],
      prompt: String.raw`**Verdadero o falso:** si se duplica la frecuencia de un movimiento periódico, su período también se duplica. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b5-per-04',
      category: 'error',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['movimiento-periodico-definicion', 'movimiento-periodico-periodo-frecuencia'],
      prompt: String.raw`Un estudiante resolvió así este problema: *«Un punto oscila entre $x = 2\,\mathrm{cm}$ y $x = 14\,\mathrm{cm}$ y tarda $0.30\,\mathrm{s}$ en ir de un extremo al otro. Calcule la amplitud, el período y la frecuencia.»*

1. La posición de equilibrio está en el punto medio: $x_{eq} = (2 + 14)/2 = 8\,\mathrm{cm}$.
2. Amplitud: $A = 14\,\mathrm{cm} - 8\,\mathrm{cm} = 6\,\mathrm{cm}$.
3. Período: $T = 0.30\,\mathrm{s}$, porque es el tiempo de recorrido entre los extremos.
4. Frecuencia: $f = 1/T = 3.3\,\mathrm{Hz}$.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'No hay ningún error'],
    },
    {
      id: 'b5-per-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['movimiento-periodico-periodo-frecuencia', 'movimiento-periodico-definicion'],
      prompt: String.raw`En una avenida hay dos luces de advertencia que parpadean con períodos de $0.8\,\mathrm{s}$ y $1.2\,\mathrm{s}$. En $t = 0$ se encienden a la vez. ¿Cuánto tiempo después vuelven a encenderse juntas **por primera vez**?`,
      format: 'numeric',
      unitHint: 's',
    },
    {
      id: 'b5-per-06',
      category: 'conceptual',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['movimiento-periodico-definicion'],
      prompt: '¿Cuál de los siguientes movimientos **no** es periódico?',
      format: 'choice',
      options: [
        'El minutero de un reloj.',
        'La Tierra en su órbita alrededor del Sol.',
        'Una pelota de baloncesto que se suelta y rebota cada vez más bajo hasta quedar quieta.',
        'Las aspas de un ventilador que gira a velocidad constante.',
      ],
    },
    {
      id: 'b5-per-07',
      category: 'numerica',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['movimiento-periodico-frecuencia-angular'],
      prompt: String.raw`La rueda de una bicicleta estática gira con frecuencia angular constante $\omega = 15.7\,\mathrm{rad/s}$. ¿Cuál es el período de giro?`,
      format: 'numeric',
      unitHint: 's',
    },
    {
      id: 'b5-per-08',
      category: 'desarrollo',
      difficulty: 'intermedio',
      role: 'bank',
      concepts: ['movimiento-periodico-graficas', 'movimiento-periodico-periodo-frecuencia', 'movimiento-periodico-frecuencia-angular'],
      prompt: String.raw`Un sensor registra la altura de una boya (medida desde el nivel medio del mar) cada $0.5\,\mathrm{s}$:

| $t$ (s) | 0 | 0.5 | 1.0 | 1.5 | 2.0 | 2.5 | 3.0 | 3.5 | 4.0 |
|---|---|---|---|---|---|---|---|---|---|
| $y$ (m) | 0 | 0.35 | 0.50 | 0.35 | 0 | −0.35 | −0.50 | −0.35 | 0 |

(a) Dibuje la gráfica $y$–$t$. (b) Determine la amplitud, el período, la frecuencia y la frecuencia angular. (c) ¿Qué distancia recorre la boya en $10\,\mathrm{s}$ y cuál es su desplazamiento en ese tiempo? (d) Indique en qué instantes de la tabla la boya está momentáneamente en reposo. Explique cada paso.`,
      format: 'open',
    },
  ],
};
