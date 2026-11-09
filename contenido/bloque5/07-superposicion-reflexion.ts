import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'superposicion-reflexion',
  title: 'Superposición, interferencia, reflexión y ondas estacionarias',
  summary:
    'Cuando dos ondas coinciden, sus desplazamientos se suman: interferencia constructiva y destructiva. Reflexión en extremos fijos y libres, y ondas estacionarias en una cuerda.',
  concepts: [
    { slug: 'superposicion-reflexion-principio', name: 'Principio de superposición' },
    { slug: 'superposicion-reflexion-interferencia', name: 'Interferencia constructiva y destructiva' },
    { slug: 'superposicion-reflexion-reflexion', name: 'Reflexión en extremo fijo y libre' },
    { slug: 'superposicion-reflexion-estacionarias', name: 'Ondas estacionarias en cuerdas' },
  ],
  theory: String.raw`## El principio de superposición

¿Qué ocurre cuando dos pulsos que viajan en sentidos opuestos por una cuerda se encuentran? A diferencia de dos pelotas, **no chocan**: se atraviesan y cada uno sigue su camino como si el otro no existiera. Mientras se solapan, el desplazamiento de cada punto de la cuerda es la **suma** de los desplazamientos que produciría cada pulso por separado:

$$y = y_1 + y_2 .$$

Este es el **principio de superposición**. Los desplazamientos se suman **con su signo**: un pulso hacia arriba ($+3\,\mathrm{cm}$) y otro hacia abajo ($-2\,\mathrm{cm}$) dan, en el punto donde coinciden, $+1\,\mathrm{cm}$. El principio vale para ondas de amplitud no demasiado grande, que es lo habitual en cuerdas, en el sonido y en el agua.

## Interferencia

La superposición de dos o más ondas se llama **interferencia**.

- **Interferencia constructiva:** las ondas llegan **en fase** (cresta con cresta, valle con valle) y la amplitud resultante es la **suma** de las amplitudes.
- **Interferencia destructiva:** llegan **en oposición de fase** (cresta con valle) y la amplitud resultante es la **diferencia**. Si las amplitudes son iguales, se anulan.

Con dos fuentes que emiten en fase, como dos altavoces conectados al mismo amplificador, lo que decide el tipo de interferencia en un punto es la **diferencia de caminos** $\Delta d = |d_1 - d_2|$ desde cada fuente:

$$\Delta d = n\,\lambda \;\;\text{(constructiva)}, \qquad \Delta d = \left(n + \tfrac12\right)\lambda \;\;\text{(destructiva)}, \qquad n = 0, 1, 2, \ldots$$

Si una onda recorre media longitud de onda más que la otra, llega «al revés» y la anula.

> **Cuidado.** En la interferencia destructiva **la energía no se destruye**. Se redistribuye: donde hay menos energía (zonas silenciosas) hay más en otros lugares (zonas reforzadas). Además, si dos pulsos se cancelan en un instante, un momento después reaparecen y siguen su camino; en el instante de la cancelación la energía está en forma de movimiento de la cuerda.

Los audífonos con **cancelación de ruido** aprovechan la interferencia destructiva: un micrófono capta el ruido y un circuito emite una onda invertida que lo anula dentro del oído.

## Reflexión

Cuando una onda llega al final de su medio, se **refleja** total o parcialmente.

- **Extremo fijo** (la cuerda atada a una pared): el pulso regresa **invertido**. Si llega hacia arriba, vuelve hacia abajo. La razón: el extremo no puede moverse, así que la cuerda tira de la pared hacia arriba y, por la tercera ley de Newton, la pared tira de la cuerda hacia abajo.
- **Extremo libre** (la cuerda termina en un anillo que desliza sin fricción por un poste): el pulso regresa **derecho**, sin invertirse.

Cuando una onda pasa a otro medio, parte se transmite y parte se refleja. El eco es la reflexión del sonido en una pared o una montaña.

## Ondas estacionarias

Si una cuerda está fija en sus dos extremos y se la hace vibrar, las ondas que van y las que regresan reflejadas se superponen. Para ciertas frecuencias el resultado es un patrón que **no viaja**: algunos puntos no se mueven nunca (**nodos**) y otros oscilan con amplitud máxima (**antinodos** o vientres). Es una **onda estacionaria**. Es lo que vemos en la cuerda de una guitarra o de un violín.

Como los extremos fijos deben ser nodos, y la distancia entre nodos consecutivos es $\lambda/2$, en la cuerda deben caber un número entero de medias longitudes de onda:

$$L = n\,\frac{\lambda_n}{2} \quad\Rightarrow\quad \lambda_n = \frac{2L}{n}, \qquad n = 1, 2, 3, \ldots$$

Con $f = v/\lambda$, las frecuencias posibles son

$$f_n = n\,\frac{v}{2L} = n\,f_1 .$$

- El modo $n = 1$ (**fundamental** o primer armónico) tiene un solo vientre en el centro y $\lambda_1 = 2L$.
- El modo $n$ tiene $n$ vientres y $n + 1$ nodos (contando los extremos).
- Las frecuencias de los modos son múltiplos enteros de la fundamental: **armónicos**.

Al pisar un traste de la guitarra se acorta $L$ y la frecuencia fundamental sube. Al tensar la cuerda, $v$ aumenta y también sube.

> **Error frecuente.** Pensar que en el modo fundamental cabe una longitud de onda completa en la cuerda. Cabe **media**: $L = \lambda_1/2$.

## Límites del modelo

El principio de superposición falla para ondas muy intensas (por ejemplo, ondas de choque). En cuerdas reales los extremos no están perfectamente fijos y hay pérdidas, de modo que las ondas estacionarias se amortiguan si no se las alimenta. Los instrumentos reales vibran en varios modos a la vez: la mezcla de armónicos es lo que da su timbre, como veremos en la lección de sonido.`,
  formulas: [
    {
      name: 'Principio de superposición',
      latex: String.raw`y = y_1 + y_2`,
      description: 'El desplazamiento resultante es la suma (con signo) de los desplazamientos de cada onda.',
      variables: [
        { symbol: String.raw`y_1,\,y_2`, meaning: 'Desplazamientos producidos por cada onda por separado', unit: 'm' },
        { symbol: String.raw`y`, meaning: 'Desplazamiento resultante', unit: 'm' },
      ],
    },
    {
      name: 'Condiciones de interferencia (fuentes en fase)',
      latex: String.raw`\Delta d = n\lambda \;\;\text{(constr.)}, \qquad \Delta d = \left(n + \tfrac12\right)\lambda \;\;\text{(destr.)}`,
      description: 'Según la diferencia de caminos desde dos fuentes que emiten en fase.',
      variables: [
        { symbol: String.raw`\Delta d`, meaning: 'Diferencia de distancias a las dos fuentes', unit: 'm' },
        { symbol: String.raw`n`, meaning: 'Número entero (0, 1, 2…)', unit: '— (adimensional)' },
        { symbol: String.raw`\lambda`, meaning: 'Longitud de onda', unit: 'm' },
      ],
    },
    {
      name: 'Longitudes de onda estacionarias (dos extremos fijos)',
      latex: String.raw`\lambda_n = \frac{2L}{n}`,
      description: 'En la cuerda caben n medias longitudes de onda.',
      variables: [
        { symbol: String.raw`L`, meaning: 'Longitud de la cuerda entre los extremos fijos', unit: 'm' },
        { symbol: String.raw`n`, meaning: 'Número del modo (número de vientres)', unit: '— (adimensional)' },
      ],
    },
    {
      name: 'Frecuencias de los armónicos',
      latex: String.raw`f_n = n\,\frac{v}{2L} = n\,f_1`,
      description: 'Frecuencias en que puede vibrar una cuerda fija en ambos extremos.',
      variables: [
        { symbol: String.raw`f_n`, meaning: 'Frecuencia del modo n', unit: 'Hz' },
        { symbol: String.raw`v`, meaning: 'Rapidez de las ondas en la cuerda', unit: 'm/s' },
        { symbol: String.raw`f_1`, meaning: 'Frecuencia fundamental', unit: 'Hz' },
      ],
    },
  ],
  examples: [
    {
      title: 'Dos pulsos que se cruzan',
      statement: String.raw`Por una cuerda viajan, en sentidos opuestos, un pulso de $3.0\,\mathrm{cm}$ hacia arriba y otro de $2.0\,\mathrm{cm}$ hacia abajo. ¿Cuál es el desplazamiento de la cuerda en el punto y el instante en que coinciden sus picos? ¿Y después de cruzarse?`,
      steps: [
        String.raw`Tomamos positivo hacia arriba: $y_1 = +3.0\,\mathrm{cm}$, $y_2 = -2.0\,\mathrm{cm}$.`,
        String.raw`Superposición: $y = y_1 + y_2 = +3.0 - 2.0 = +1.0\,\mathrm{cm}$.`,
        String.raw`Después de cruzarse, cada pulso sigue con su forma y su amplitud originales: $3.0\,\mathrm{cm}$ hacia arriba y $2.0\,\mathrm{cm}$ hacia abajo.`,
      ],
      result: String.raw`$y = +1.0\,\mathrm{cm}$ al coincidir; luego los pulsos siguen intactos.`,
      interpretation: 'Interferencia destructiva parcial: las amplitudes se restan porque los pulsos tienen sentidos opuestos.',
    },
    {
      title: 'Armónicos de una cuerda',
      statement: String.raw`Una cuerda de $0.80\,\mathrm{m}$, fija en ambos extremos, transmite ondas a $240\,\mathrm{m/s}$. Calcule la frecuencia fundamental y las de los dos armónicos siguientes.`,
      steps: [
        String.raw`Fundamental: $\lambda_1 = 2L = 1.60\,\mathrm{m}$ y $f_1 = \dfrac{v}{2L} = \dfrac{240\,\mathrm{m/s}}{1.60\,\mathrm{m}} = 150\,\mathrm{Hz}$.`,
        String.raw`Segundo armónico: $f_2 = 2 f_1 = 300\,\mathrm{Hz}$ ($\lambda_2 = 0.80\,\mathrm{m}$, dos vientres).`,
        String.raw`Tercer armónico: $f_3 = 3 f_1 = 450\,\mathrm{Hz}$ ($\lambda_3 = 0.533\,\mathrm{m}$, tres vientres).`,
      ],
      result: String.raw`$f_1 = 150\,\mathrm{Hz}$, $f_2 = 300\,\mathrm{Hz}$, $f_3 = 450\,\mathrm{Hz}$.`,
      interpretation: 'Las frecuencias forman la serie 1 : 2 : 3. Una cuerda pulsada vibra a la vez en varios de estos modos.',
    },
    {
      title: 'Dos altavoces',
      statement: String.raw`Dos altavoces emiten en fase un tono de $343\,\mathrm{Hz}$ en el aire ($v = 343\,\mathrm{m/s}$). Una persona está a $3.0\,\mathrm{m}$ de uno y a $4.5\,\mathrm{m}$ del otro. ¿Oye un refuerzo o una atenuación del sonido?`,
      steps: [
        String.raw`Longitud de onda: $\lambda = \dfrac{v}{f} = \dfrac{343\,\mathrm{m/s}}{343\,\mathrm{Hz}} = 1.0\,\mathrm{m}$.`,
        String.raw`Diferencia de caminos: $\Delta d = 4.5\,\mathrm{m} - 3.0\,\mathrm{m} = 1.5\,\mathrm{m} = 1.5\,\lambda$.`,
        String.raw`$1.5\,\lambda = (1 + \tfrac12)\lambda$: corresponde a $n = 1$ en la condición destructiva.`,
      ],
      result: 'Interferencia destructiva: el sonido se atenúa en ese punto.',
      interpretation: 'Si la persona se mueve medio metro, cambia Δd y puede pasar a una zona de refuerzo. En una sala real las reflexiones en las paredes hacen que la cancelación no sea total.',
    },
  ],
  simulation: null,
  exercises: [
    {
      id: 'b5-sup-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['superposicion-reflexion-principio'],
      prompt: String.raw`Dos pulsos viajan en sentidos opuestos por una cuerda: uno de $4.0\,\mathrm{cm}$ hacia arriba y otro de $1.5\,\mathrm{cm}$ hacia abajo. ¿Cuál es el desplazamiento (con signo, positivo hacia arriba) del punto de la cuerda donde coinciden sus picos?`,
      format: 'numeric',
      unitHint: 'cm',
    },
    {
      id: 'b5-sup-02',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['superposicion-reflexion-reflexion'],
      prompt: 'Un pulso hacia arriba viaja por una cuerda cuyo otro extremo está firmemente atado a una pared. ¿Cómo regresa el pulso reflejado?',
      format: 'choice',
      options: [
        'Hacia arriba, igual que llegó.',
        'Invertido, hacia abajo.',
        'No regresa: la pared absorbe toda la energía.',
        'Regresa con el doble de amplitud.',
      ],
    },
    {
      id: 'b5-sup-03',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['superposicion-reflexion-estacionarias'],
      prompt: String.raw`Una cuerda de $1.2\,\mathrm{m}$, fija en ambos extremos, vibra formando una onda estacionaria con **tres vientres**. ¿Cuál es la longitud de onda?`,
      format: 'numeric',
      unitHint: 'm',
    },
    {
      id: 'b5-sup-04',
      category: 'vf_justificacion',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['superposicion-reflexion-interferencia'],
      prompt: String.raw`**Verdadero o falso:** cuando dos ondas interfieren destructivamente, la energía que transportaban se destruye. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b5-sup-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['superposicion-reflexion-estacionarias'],
      prompt: String.raw`Una cuerda de $0.75\,\mathrm{m}$ entre sus extremos fijos tiene una densidad lineal de $4.0\,\mathrm{g/m}$ y está tensada con $90\,\mathrm{N}$. ¿Cuál es la frecuencia de su **segundo** armónico?`,
      format: 'numeric',
      unitHint: 'Hz',
    },
    {
      id: 'b5-sup-06',
      category: 'grafica',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['superposicion-reflexion-principio'],
      prompt: String.raw`La gráfica muestra, en un mismo instante, los desplazamientos que producirían por separado dos pulsos que se están cruzando en una cuerda. ¿Cuál es el desplazamiento real de la cuerda en $x = 3\,\mathrm{m}$ (con signo, positivo hacia arriba)?`,
      format: 'numeric',
      unitHint: 'cm',
      figure: {
        kind: 'line',
        title: 'Desplazamiento de cada pulso por separado',
        x: { label: 'x', unit: 'm' },
        y: { label: 'y', unit: 'cm' },
        series: [
          { name: 'Pulso 1', points: [[0, 0], [1, 0], [3, 4], [5, 0], [8, 0]] },
          { name: 'Pulso 2', points: [[0, 0], [2, 0], [4, -2], [6, 0], [8, 0]] },
        ],
      },
    },
    {
      id: 'b5-sup-07',
      category: 'error',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['superposicion-reflexion-estacionarias'],
      prompt: String.raw`Un estudiante calculó así la frecuencia fundamental de una cuerda de $0.90\,\mathrm{m}$, fija en ambos extremos, en la que las ondas viajan a $180\,\mathrm{m/s}$:

1. Los dos extremos fijos son nodos.
2. En el modo fundamental hay un solo vientre, en el centro.
3. Entre los dos nodos cabe una longitud de onda completa: $\lambda = L = 0.90\,\mathrm{m}$.
4. $f_1 = v/\lambda = 180/0.90 = 200\,\mathrm{Hz}$.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'No hay ningún error'],
    },
    {
      id: 'b5-sup-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['superposicion-reflexion-estacionarias', 'superposicion-reflexion-reflexion', 'superposicion-reflexion-principio'],
      prompt: String.raw`La cuerda *la* de una guitarra mide $0.65\,\mathrm{m}$ entre la cejuela y el puente y su frecuencia fundamental es $110\,\mathrm{Hz}$.

(a) Explique, usando la reflexión y la superposición, cómo se forma una onda estacionaria en la cuerda. (b) Dibuje los tres primeros modos e indique nodos y vientres. (c) Calcule la rapidez de las ondas en la cuerda. (d) Calcule las frecuencias del segundo y el tercer armónico. (e) ¿A qué distancia del puente hay que pisar la cuerda para que su fundamental sea $220\,\mathrm{Hz}$? Explique cada paso.`,
      format: 'open',
    },
  ],
};
