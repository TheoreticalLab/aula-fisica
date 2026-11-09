import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'sonido',
  title: 'El sonido',
  summary:
    'El sonido es una onda mecánica longitudinal de presión. Su rapidez depende del medio y de la temperatura; su frecuencia determina el tono, y la mezcla de armónicos, el timbre. Eco y rango audible.',
  concepts: [
    { slug: 'sonido-naturaleza', name: 'El sonido como onda longitudinal de presión' },
    { slug: 'sonido-velocidad', name: 'Rapidez del sonido en distintos medios y con la temperatura' },
    { slug: 'sonido-tono-timbre', name: 'Tono, timbre y rango audible' },
    { slug: 'sonido-eco', name: 'Eco y medición de distancias' },
  ],
  theory: String.raw`## ¿Qué es el sonido?

Cuando la membrana de una bocina se mueve hacia afuera, empuja y **comprime** la capa de aire vecina; cuando retrocede, deja una zona de aire **enrarecido** (a menor presión). Cada capa empuja a la siguiente, y así se propaga una sucesión de **compresiones y rarefacciones**. El sonido es, por tanto, una **onda mecánica longitudinal**: las moléculas de aire oscilan adelante y atrás en la misma dirección en que avanza la onda, y lo que viaja es una variación de **presión**.

Esas variaciones son minúsculas. En una conversación normal la presión del aire cambia en unas centésimas de pascal, frente a los cien mil pascales de la presión atmosférica. Aun así, el oído las detecta: el tímpano vibra con ellas y el oído interno las convierte en señales nerviosas.

Como toda onda mecánica, el sonido **necesita un medio**: se propaga en gases, líquidos y sólidos, pero **no en el vacío**. Si se coloca un despertador dentro de una campana de la que se extrae el aire, se le ve vibrar pero se deja de oír.

## Rapidez del sonido

La rapidez del sonido depende del **medio**, no de la frecuencia ni de la intensidad: los graves y los agudos de una orquesta llegan juntos al público.

| Medio | Rapidez aproximada |
|---|---|
| Aire a 20 °C | $343\,\mathrm{m/s}$ |
| Agua | $1480\,\mathrm{m/s}$ |
| Acero | $5000$–$6000\,\mathrm{m/s}$ |

> **Error frecuente.** Pensar que el sonido va más rápido en el aire «porque es más ligero». Aunque el agua y el acero son mucho más densos, son muchísimo más difíciles de comprimir (más rígidos), y ese efecto domina: en ellos el sonido es más rápido.

En el aire, la rapidez aumenta con la **temperatura**, porque las moléculas se mueven más deprisa y transmiten antes los empujones. Cerca de las temperaturas ambientales se usa la aproximación

$$v \approx 331\,\mathrm{m/s} + 0.6\,T_C ,$$

con $T_C$ en grados Celsius (el coeficiente $0.6$ tiene unidades de m/s por °C). Así, a $0\,^\circ\mathrm{C}$, $v = 331\,\mathrm{m/s}$; a $20\,^\circ\mathrm{C}$, $343\,\mathrm{m/s}$; en una tarde calurosa de Santo Domingo a $32\,^\circ\mathrm{C}$, unos $350\,\mathrm{m/s}$.

## Tono, sonoridad y timbre

Nuestro oído distingue tres cualidades del sonido, cada una ligada a una propiedad física de la onda:

- **Tono (altura):** si el sonido es **agudo** o **grave**. Depende de la **frecuencia**: más frecuencia, más agudo. La nota *la* de afinación tiene $440\,\mathrm{Hz}$; la voz masculina hablada ronda los $100$–$150\,\mathrm{Hz}$ y la femenina, $200$–$250\,\mathrm{Hz}$.
- **Sonoridad (volumen):** si es fuerte o débil. Depende de la **amplitud** de la onda, es decir, de su intensidad. Lo estudiaremos en la próxima lección con los decibelios.
- **Timbre:** lo que distingue un *la* de $440\,\mathrm{Hz}$ tocado en una guitarra del mismo *la* tocado en un saxofón o cantado. Los instrumentos reales no emiten una sola frecuencia, sino la fundamental **más sus armónicos** ($2f$, $3f$, …) en proporciones distintas. Esa mezcla, que se ve como una forma de onda distinta, es el timbre. Gracias a él reconocemos la voz de una persona por teléfono o distinguimos una güira de una tambora.

## Rango audible

El oído humano joven percibe frecuencias entre unos **$20\,\mathrm{Hz}$** y **$20\,000\,\mathrm{Hz}$**. Con la edad se pierde sensibilidad a las más altas.

- Por debajo de $20\,\mathrm{Hz}$: **infrasonido**. Lo producen los sismos, las olas grandes y los elefantes para comunicarse a distancia.
- Por encima de $20\,\mathrm{kHz}$: **ultrasonido**. Lo usan los murciélagos y los delfines para orientarse (ecolocalización) y la medicina en las ecografías.

Con $\lambda = v/f$ en el aire a $20\,^\circ\mathrm{C}$, los sonidos audibles tienen longitudes de onda desde unos $17\,\mathrm{m}$ ($20\,\mathrm{Hz}$) hasta $1.7\,\mathrm{cm}$ ($20\,\mathrm{kHz}$). Por eso los sonidos graves «doblan» las esquinas y atraviesan paredes con más facilidad que los agudos: sus longitudes de onda son comparables al tamaño de los obstáculos.

## El eco

El sonido se refleja en superficies grandes y duras: paredes, acantilados, el fondo del mar. Si el sonido reflejado llega con un retraso de más de una décima de segundo, el oído lo percibe separado: es un **eco**. Si $t$ es el tiempo desde que se emite el sonido hasta que vuelve el eco, el sonido ha recorrido **ida y vuelta**, y la distancia al obstáculo es

$$d = \frac{v\,t}{2} .$$

Así funcionan la **ecosonda** de los barcos pesqueros, el **sonar** de los submarinos, los sensores de estacionamiento de los carros y la ecolocalización de los murciélagos.

Un cálculo parecido, sin ida y vuelta, se usa en las tormentas: la luz del relámpago llega prácticamente al instante y el trueno tarda unos $3\,\mathrm{s}$ por kilómetro.

## Límites del modelo

La fórmula $v \approx 331 + 0.6\,T_C$ es una aproximación lineal válida para temperaturas ambientales; en rigor $v$ es proporcional a la raíz de la temperatura absoluta. También ignoramos el viento y la humedad, que modifican ligeramente la rapidez del sonido en el aire.`,
  formulas: [
    {
      name: 'Rapidez del sonido en el aire',
      latex: String.raw`v \approx 331\,\mathrm{m/s} + \left(0.6\,\tfrac{\mathrm{m/s}}{^\circ\mathrm{C}}\right) T_C`,
      description: 'Aproximación lineal válida a temperaturas ambientales.',
      variables: [
        { symbol: String.raw`v`, meaning: 'Rapidez del sonido en el aire', unit: 'm/s' },
        { symbol: String.raw`T_C`, meaning: 'Temperatura del aire', unit: '°C' },
      ],
    },
    {
      name: 'Longitud de onda de un sonido',
      latex: String.raw`\lambda = \frac{v}{f}`,
      description: 'La frecuencia la fija la fuente; la rapidez, el medio.',
      variables: [
        { symbol: String.raw`\lambda`, meaning: 'Longitud de onda', unit: 'm' },
        { symbol: String.raw`f`, meaning: 'Frecuencia', unit: 'Hz' },
      ],
    },
    {
      name: 'Distancia por eco',
      latex: String.raw`d = \frac{v\,t}{2}`,
      description: 'El sonido recorre dos veces la distancia al obstáculo (ida y vuelta).',
      variables: [
        { symbol: String.raw`d`, meaning: 'Distancia al obstáculo', unit: 'm' },
        { symbol: String.raw`t`, meaning: 'Tiempo entre la emisión y la llegada del eco', unit: 's' },
      ],
    },
  ],
  examples: [
    {
      title: 'Eco en un acantilado',
      statement: String.raw`En un mirador frente al mar, una excursionista grita y oye el eco del acantilado de enfrente $1.5\,\mathrm{s}$ después. El aire está a $20\,^\circ\mathrm{C}$. ¿A qué distancia está el acantilado?`,
      steps: [
        String.raw`Rapidez del sonido: $v = 331 + 0.6(20) = 343\,\mathrm{m/s}$.`,
        String.raw`En $1.5\,\mathrm{s}$ el sonido recorre $v\,t = (343\,\mathrm{m/s})(1.5\,\mathrm{s}) = 514.5\,\mathrm{m}$, de ida y vuelta.`,
        String.raw`Distancia: $d = \dfrac{514.5\,\mathrm{m}}{2} = 257\,\mathrm{m}$.`,
      ],
      result: String.raw`$d \approx 2.6\times10^{2}\,\mathrm{m}$.`,
      interpretation: 'Olvidar dividir entre 2 duplicaría la distancia. Con retrasos menores que 0.1 s (obstáculos a menos de unos 17 m) el eco se funde con el sonido original y no se distingue.',
    },
    {
      title: 'Rapidez en un día caluroso',
      statement: String.raw`Calcule la rapidez del sonido a $30\,^\circ\mathrm{C}$ y la longitud de onda de un tono de $440\,\mathrm{Hz}$ a esa temperatura.`,
      steps: [
        String.raw`$v = 331 + 0.6(30) = 331 + 18 = 349\,\mathrm{m/s}$.`,
        String.raw`$\lambda = \dfrac{v}{f} = \dfrac{349\,\mathrm{m/s}}{440\,\mathrm{Hz}} = 0.793\,\mathrm{m}$.`,
      ],
      result: String.raw`$v = 349\,\mathrm{m/s}$ y $\lambda = 0.79\,\mathrm{m}$.`,
      interpretation: 'La frecuencia (el tono) no cambia con la temperatura; lo que cambia es la rapidez y, con ella, la longitud de onda. Por eso los instrumentos de viento, cuya λ fija el tubo, desafinan un poco con el calor.',
    },
    {
      title: '¿A qué distancia cayó el rayo?',
      statement: String.raw`Durante una tormenta se ve un relámpago y el trueno se oye $3.0\,\mathrm{s}$ después. Con $v = 343\,\mathrm{m/s}$, ¿a qué distancia cayó el rayo?`,
      steps: [
        String.raw`La luz llega prácticamente al instante, así que el retraso es el tiempo que tarda el sonido en recorrer la distancia (solo de ida).`,
        String.raw`$d = v\,t = (343\,\mathrm{m/s})(3.0\,\mathrm{s}) = 1029\,\mathrm{m}$.`,
      ],
      result: String.raw`$d \approx 1.0\,\mathrm{km}$.`,
      interpretation: 'Regla práctica: unos 3 segundos por kilómetro. Aquí no se divide entre 2, porque el sonido no va y vuelve.',
    },
  ],
  simulation: null,
  exercises: [
    {
      id: 'b5-son-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['sonido-velocidad'],
      prompt: String.raw`Con la aproximación lineal, ¿cuál es la rapidez del sonido en el aire a $25\,^\circ\mathrm{C}$?`,
      format: 'numeric',
      unitHint: 'm/s',
    },
    {
      id: 'b5-son-02',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['sonido-eco'],
      prompt: String.raw`La ecosonda de una lancha emite un pulso de sonido hacia el fondo y recibe el eco $0.80\,\mathrm{s}$ después. Si en el agua el sonido viaja a $1480\,\mathrm{m/s}$, ¿qué profundidad tiene el mar en ese punto?`,
      format: 'numeric',
      unitHint: 'm',
    },
    {
      id: 'b5-son-03',
      category: 'conceptual',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['sonido-tono-timbre'],
      prompt: 'Una guitarra y una flauta tocan la misma nota (la misma frecuencia fundamental) con el mismo volumen. Aun así, un oyente distingue cuál es cuál. ¿Qué propiedad del sonido lo permite?',
      format: 'choice',
      options: [
        'El tono, porque cada instrumento produce una frecuencia fundamental distinta.',
        'El timbre, porque cada instrumento mezcla los armónicos en proporciones distintas.',
        'La rapidez del sonido, que es distinta para cada instrumento.',
        'La amplitud, porque la guitarra siempre suena más fuerte.',
      ],
    },
    {
      id: 'b5-son-04',
      category: 'vf_justificacion',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['sonido-velocidad', 'sonido-naturaleza'],
      prompt: String.raw`**Verdadero o falso:** el sonido viaja más rápido en el aire que en el agua o en el acero, porque el aire es menos denso y ofrece menos resistencia. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b5-son-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['sonido-velocidad'],
      prompt: String.raw`Una persona golpea con un martillo un extremo de un riel de acero. Otra persona, con el oído pegado al otro extremo, oye dos golpes: uno que llega por el riel y otro, $0.50\,\mathrm{s}$ después, que llega por el aire. Si $v_{aire} = 343\,\mathrm{m/s}$ y $v_{acero} = 5000\,\mathrm{m/s}$, ¿qué longitud tiene el riel?`,
      format: 'numeric',
      unitHint: 'm',
    },
    {
      id: 'b5-son-06',
      category: 'grafica',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['sonido-velocidad'],
      prompt: String.raw`La gráfica muestra la rapidez del sonido en el aire en función de la temperatura. Úsela para determinar la longitud de onda de un tono de $700\,\mathrm{Hz}$ cuando el aire está a $30\,^\circ\mathrm{C}$.`,
      format: 'numeric',
      unitHint: 'm',
      figure: {
        kind: 'line',
        title: 'Rapidez del sonido en el aire',
        x: { label: 'Temperatura', unit: '°C' },
        y: { label: 'v', unit: 'm/s' },
        series: [{ name: 'v(T)', points: [[0, 331], [10, 337], [20, 343], [30, 349], [40, 355]] }],
      },
    },
    {
      id: 'b5-son-07',
      category: 'error',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['sonido-eco'],
      prompt: String.raw`Un estudiante resolvió así este problema: *«Un niño grita frente a una pared y oye el eco $2.0\,\mathrm{s}$ después. El aire está a $20\,^\circ\mathrm{C}$. ¿A qué distancia está la pared?»*

1. $v = 331 + 0.6(20) = 343\,\mathrm{m/s}$.
2. El tiempo de ida y vuelta del sonido es $t = 2.0\,\mathrm{s}$.
3. La distancia a la pared es $d = v\,t = (343)(2.0)$.
4. $d = 686\,\mathrm{m}$.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'No hay ningún error'],
    },
    {
      id: 'b5-son-08',
      category: 'desarrollo',
      difficulty: 'intermedio',
      role: 'bank',
      concepts: ['sonido-naturaleza', 'sonido-tono-timbre', 'sonido-velocidad'],
      prompt: String.raw`(a) Explique por qué el sonido es una onda longitudinal y por qué no se propaga en el vacío. (b) Calcule las longitudes de onda, en el aire a $20\,^\circ\mathrm{C}$, de los extremos del rango audible ($20\,\mathrm{Hz}$ y $20\,\mathrm{kHz}$). (c) Un murciélago emite ultrasonido de $50\,\mathrm{kHz}$: calcule su longitud de onda y explique por qué le sirve para detectar insectos pequeños. (d) Explique la diferencia entre tono y timbre con un ejemplo musical. Explique cada paso.`,
      format: 'open',
    },
  ],
};
