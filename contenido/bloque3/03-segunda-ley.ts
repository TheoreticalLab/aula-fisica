import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'segunda-ley',
  title: 'Segunda ley de Newton',
  summary:
    'La fuerza neta sobre un cuerpo es igual a su masa por su aceleración. La aceleración tiene siempre la dirección de la fuerza neta y es tanto menor cuanto mayor es la masa.',
  concepts: [
    { slug: 'ley2-fuerza-neta-aceleracion', name: 'Relación entre fuerza neta y aceleración' },
    { slug: 'ley2-masa-inercial', name: 'Masa inercial' },
    { slug: 'ley2-unidades', name: 'El newton y la coherencia de unidades' },
    { slug: 'ley2-problemas-1d', name: 'Problemas de dinámica en una dimensión' },
  ],
  theory: String.raw`## ¿Qué hace una fuerza neta?

La primera ley dice qué ocurre cuando la fuerza neta es cero: la velocidad no cambia. La segunda ley responde a la pregunta siguiente: **¿qué ocurre cuando la fuerza neta no es cero?** La respuesta es que la velocidad cambia, es decir, el cuerpo **acelera**. La fuerza neta no determina la velocidad, sino **cuán rápido cambia** la velocidad.

Los experimentos con carritos sobre rieles casi sin rozamiento muestran dos regularidades:

- Con la misma masa, si se duplica la fuerza neta, se duplica la aceleración: $a$ es **proporcional** a $F_{\text{neta}}$.
- Con la misma fuerza neta, si se duplica la masa (por ejemplo, colocando un segundo carrito encima), la aceleración se reduce a la mitad: $a$ es **inversamente proporcional** a $m$.

Ambos hechos se resumen en una sola ecuación.

## La segunda ley de Newton

> **Segunda ley.** La fuerza neta que actúa sobre un cuerpo es igual al producto de su masa por su aceleración.

$$\vec F_{\text{neta}} = m\,\vec a .$$

Conviene leerla con cuidado:

1. **Es la fuerza neta**, la suma vectorial de *todas* las fuerzas sobre el cuerpo, no una de ellas. Si empuja una caja con $50\,\mathrm{N}$ y el piso la frena con $30\,\mathrm{N}$, lo que determina la aceleración son los $20\,\mathrm{N}$ de la neta.
2. **Es una igualdad entre vectores.** Como $m$ es positiva, **la aceleración tiene siempre la misma dirección y sentido que la fuerza neta**. Pero la aceleración no tiene por qué tener la dirección de la velocidad: un carro que avanza hacia el norte y frena tiene velocidad hacia el norte, y aceleración y fuerza neta hacia el sur. En el punto más alto de un lanzamiento vertical, la velocidad es cero y, aun así, la aceleración vale $9.8\,\mathrm{m/s^2}$ hacia abajo, porque el peso sigue actuando.
3. **Contiene a la primera ley como caso particular**: si $\vec F_{\text{neta}} = \vec 0$, entonces $\vec a = \vec 0$ y la velocidad es constante.
4. **Se aplica eje por eje.** En el plano, $F_{\text{neta},x} = m\,a_x$ y $F_{\text{neta},y} = m\,a_y$. Si un cuerpo se mueve sobre el suelo horizontal, $a_y = 0$ y las fuerzas verticales se compensan.

Escrita como $\vec a = \vec F_{\text{neta}}/m$, la ley muestra la relación causa–efecto: las fuerzas (causa) producen la aceleración (efecto).

## Masa inercial

La **masa** mide la **inercia** de un cuerpo: su resistencia a que le cambien la velocidad. Empuje un carrito de supermercado vacío y luego uno lleno con la misma fuerza: el lleno acelera mucho menos. Por eso a la masa que aparece en la segunda ley se le llama **masa inercial**. Es un escalar, siempre positivo, se mide en kilogramos y es aditivo: la masa de dos cuerpos juntos es la suma de sus masas.

> **Cuidado.** Masa y peso no son lo mismo. La masa (kg) es una propiedad del cuerpo y no depende del lugar. El peso es una fuerza (N): la atracción gravitatoria que la Tierra ejerce sobre el cuerpo. Un astronauta tiene la misma masa en la Tierra, en la Luna y en la Estación Espacial; incluso flotando, le cuesta lo mismo poner en marcha o frenar una caja pesada. La relación entre masa y peso se estudia en la lección de peso y fuerza normal.

## Unidades

La segunda ley define el **newton**: $1\,\mathrm{N}$ es la fuerza neta que comunica a $1\,\mathrm{kg}$ una aceleración de $1\,\mathrm{m/s^2}$,

$$1\,\mathrm{N} = 1\,\mathrm{kg\cdot m/s^2}.$$

Para que la ecuación dé resultados correctos, use siempre unidades del SI: masa en **kilogramos** (no en gramos), aceleración en $\mathrm{m/s^2}$ y fuerza en newtons. Un error de conversión de gramos a kilogramos cambia el resultado en un factor 1000.

## Cómo resolver un problema en una dimensión

1. **Elija el cuerpo** que va a estudiar y un **eje** con su sentido positivo (suele convenir el sentido del movimiento o de la aceleración).
2. **Identifique todas las fuerzas** que actúan sobre ese cuerpo, cada una con su agente. (La lección de diagramas de cuerpo libre sistematiza este paso.)
3. **Sume las fuerzas con signo** para obtener $F_{\text{neta}}$.
4. **Aplique** $F_{\text{neta}} = m\,a$ y despeje la incógnita.
5. Si hace falta, **conecte con la cinemática**: con fuerza neta constante, la aceleración es constante y valen las ecuaciones del movimiento uniformemente acelerado, como $v = v_0 + a\,t$.
6. **Compruebe** el signo y el orden de magnitud del resultado.

El camino puede recorrerse en los dos sentidos: de las fuerzas al movimiento (calcular $a$ y luego velocidades y posiciones) o del movimiento a las fuerzas (medir $a$ y deducir qué fuerza neta la produce).

> **Error frecuente.** Pensar que $m\,a$ es «una fuerza más» que hay que añadir a las otras. El producto $m\,a$ no es una fuerza ejercida por ningún cuerpo: es el resultado de sumar las fuerzas reales.

> **Error frecuente.** Creer que la fuerza determina la velocidad («si empujo con el doble, irá al doble de rápido»). La fuerza determina la aceleración. Con una fuerza neta constante, la velocidad sigue aumentando mientras la fuerza actúe.

## Límites del modelo

La segunda ley en la forma $\vec F_{\text{neta}} = m\,\vec a$ es válida en sistemas de referencia inerciales, para cuerpos de masa constante (un cohete que expulsa gases necesita un tratamiento más cuidadoso) y para rapideces mucho menores que la de la luz. Dentro de esos límites, que cubren casi toda la experiencia cotidiana, sus predicciones son excelentes.`,
  formulas: [
    {
      name: 'Segunda ley de Newton',
      latex: String.raw`\vec F_{\text{neta}} = m\,\vec a`,
      description: 'La suma vectorial de todas las fuerzas sobre un cuerpo es igual a su masa por su aceleración.',
      variables: [
        { symbol: String.raw`\vec F_{\text{neta}}`, meaning: 'Fuerza neta sobre el cuerpo', unit: 'N' },
        { symbol: String.raw`m`, meaning: 'Masa (inercial) del cuerpo', unit: 'kg' },
        { symbol: String.raw`\vec a`, meaning: 'Aceleración del cuerpo', unit: 'm/s²' },
      ],
      notes: 'La aceleración tiene siempre la dirección y el sentido de la fuerza neta. Válida en sistemas inerciales.',
    },
    {
      name: 'Segunda ley por componentes',
      latex: String.raw`F_{\text{neta},x} = m\,a_x, \qquad F_{\text{neta},y} = m\,a_y`,
      description: 'La ley vectorial equivale a una ecuación independiente para cada eje.',
      variables: [
        { symbol: String.raw`F_{\text{neta},x},\,F_{\text{neta},y}`, meaning: 'Componentes de la fuerza neta', unit: 'N' },
        { symbol: String.raw`a_x,\,a_y`, meaning: 'Componentes de la aceleración (con signo)', unit: 'm/s²' },
      ],
      notes: 'Si el cuerpo no se mueve en la dirección y, entonces a_y = 0 y las fuerzas en ese eje se compensan.',
    },
    {
      name: 'Aceleración producida por la fuerza neta',
      latex: String.raw`a = \frac{F_{\text{neta}}}{m}`,
      description: 'Forma causa–efecto de la ley: a mayor fuerza neta, mayor aceleración; a mayor masa, menor aceleración.',
      variables: [
        { symbol: String.raw`a`, meaning: 'Aceleración (en una dimensión, con signo)', unit: 'm/s²' },
        { symbol: String.raw`F_{\text{neta}}`, meaning: 'Fuerza neta (con signo)', unit: 'N' },
        { symbol: String.raw`m`, meaning: 'Masa', unit: 'kg' },
      ],
    },
    {
      name: 'Enlace con la cinemática',
      latex: String.raw`v = v_0 + \frac{F_{\text{neta}}}{m}\,t`,
      description:
        'Si la fuerza neta es constante, la aceleración es constante y la velocidad cambia linealmente con el tiempo (movimiento uniformemente acelerado).',
      variables: [
        { symbol: String.raw`v_0`, meaning: 'Velocidad en t = 0', unit: 'm/s' },
        { symbol: String.raw`v`, meaning: 'Velocidad en el instante t', unit: 'm/s' },
        { symbol: String.raw`t`, meaning: 'Tiempo transcurrido', unit: 's' },
      ],
      notes: 'Solo es válida mientras la fuerza neta se mantenga constante.',
    },
  ],
  examples: [
    {
      title: 'Empujar un carrito de supermercado',
      statement: String.raw`Un carrito de supermercado cargado, de $25\,\mathrm{kg}$, parte del reposo. La fuerza neta horizontal sobre él es de $40\,\mathrm{N}$ hacia adelante. ¿Qué aceleración adquiere y qué velocidad tiene al cabo de $3.0\,\mathrm{s}$?`,
      steps: [
        String.raw`Eje $x$ hacia adelante. Fuerza neta $F_{\text{neta}} = +40\,\mathrm{N}$; masa $m = 25\,\mathrm{kg}$.`,
        String.raw`Segunda ley: $a = \dfrac{F_{\text{neta}}}{m} = \dfrac{40\,\mathrm{N}}{25\,\mathrm{kg}} = 1.6\,\mathrm{m/s^2}$ (recuerde que $\mathrm{N/kg} = \mathrm{m/s^2}$).`,
        String.raw`Como la fuerza neta es constante, la aceleración también: $v = v_0 + a\,t = 0 + (1.6\,\mathrm{m/s^2})(3.0\,\mathrm{s}) = 4.8\,\mathrm{m/s}$.`,
      ],
      result: String.raw`$a = 1.6\,\mathrm{m/s^2}$ hacia adelante y $v = 4.8\,\mathrm{m/s}$ a los $3.0\,\mathrm{s}$.`,
      interpretation:
        '4.8 m/s son unos 17 km/h: un carrito que se mueve así por el pasillo ya va bastante rápido. En la práctica, la persona deja de empujar mucho antes.',
    },
    {
      title: 'Fuerza neta durante un frenado',
      statement: String.raw`Un carro de $1200\,\mathrm{kg}$ circula a $20\,\mathrm{m/s}$ por una calle recta y frena uniformemente hasta detenerse en $4.0\,\mathrm{s}$. ¿Cuál es la fuerza neta sobre el carro durante el frenado?`,
      steps: [
        String.raw`Eje $x$ en el sentido del movimiento: $v_0 = +20\,\mathrm{m/s}$, $v = 0$, $t = 4.0\,\mathrm{s}$.`,
        String.raw`Aceleración: $a = \dfrac{v - v_0}{t} = \dfrac{0 - 20\,\mathrm{m/s}}{4.0\,\mathrm{s}} = -5.0\,\mathrm{m/s^2}$.`,
        String.raw`Segunda ley: $F_{\text{neta}} = m\,a = (1200\,\mathrm{kg})(-5.0\,\mathrm{m/s^2}) = -6000\,\mathrm{N}$.`,
      ],
      result: String.raw`$F_{\text{neta}} = -6.0\times10^{3}\,\mathrm{N}$: $6000\,\mathrm{N}$ en sentido opuesto al movimiento.`,
      interpretation:
        'El signo negativo indica que la fuerza neta apunta hacia atrás mientras el carro avanza: fuerza neta y aceleración tienen el mismo sentido, la velocidad no. Una desaceleración de 5 m/s² (la mitad de g) es típica de un frenado firme.',
    },
    {
      title: 'Medir una masa a partir de una gráfica',
      statement: String.raw`En un riel de aire se aplica a un carrito una fuerza neta horizontal y se mide su aceleración. Resultados: $F = 2.0\,\mathrm{N}$, $a = 0.80\,\mathrm{m/s^2}$; $F = 4.0\,\mathrm{N}$, $a = 1.6\,\mathrm{m/s^2}$; $F = 6.0\,\mathrm{N}$, $a = 2.4\,\mathrm{m/s^2}$. Determine la masa del carrito.`,
      steps: [
        String.raw`Si se representa $a$ frente a $F$, los puntos caen sobre una recta que pasa por el origen: $a$ es proporcional a $F$, como predice la segunda ley.`,
        String.raw`La pendiente de esa recta es $\dfrac{\Delta a}{\Delta F} = \dfrac{2.4 - 0.80}{6.0 - 2.0} = 0.40\,\mathrm{(m/s^2)/N} = 0.40\,\mathrm{kg^{-1}}$.`,
        String.raw`Como $a = \dfrac{1}{m}\,F$, la pendiente es $\dfrac{1}{m}$: $m = \dfrac{1}{0.40\,\mathrm{kg^{-1}}} = 2.5\,\mathrm{kg}$.`,
        String.raw`Comprobación con un punto: $F/a = 4.0/1.6 = 2.5\,\mathrm{kg}$ ✓.`,
      ],
      result: String.raw`$m = 2.5\,\mathrm{kg}$.`,
      interpretation:
        'La pendiente de la gráfica a–F no es la masa, sino su inverso: un carrito más masivo daría una recta menos empinada. Usar la pendiente de varios puntos reduce el efecto de los errores de medida.',
    },
  ],
  simulation: {
    key: 'fuerzas',
    params: { m: 2, F: 10, theta: 0, muS: 0, muK: 0, g: 9.8 },
    guide: String.raw`1. Con los valores iniciales (sin fricción, $m = 2\,\mathrm{kg}$, $F = 10\,\mathrm{N}$), pulse **Iniciar** y lea la aceleración. Compruebe que $a = F/m$.
2. Duplique la fuerza ($F = 20\,\mathrm{N}$). ¿Qué le ocurre a la aceleración? ¿Y a la pendiente de la gráfica $v$–$t$?
3. Vuelva a $F = 10\,\mathrm{N}$ y duplique la masa ($m = 4\,\mathrm{kg}$). Compare la aceleración con la del paso 1.
4. Ponga $F = -10\,\mathrm{N}$ con $m = 2\,\mathrm{kg}$. ¿Qué signo tiene la aceleración? ¿Hacia dónde se mueve el bloque?
5. Añada fricción: $\mu_s = 0.3$, $\mu_k = 0.2$, $F = 20\,\mathrm{N}$, $m = 2\,\mathrm{kg}$. Lea la fricción y la fuerza neta. Compruebe que la aceleración es $F_{\text{neta}}/m$ y no $F/m$.
6. En ese último caso, lea la velocidad en dos instantes de la gráfica $v$–$t$ y calcule la pendiente. Compárela con la aceleración que muestra el simulador.`,
  },
  exercises: [
    {
      id: 'b3-ley2-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['ley2-fuerza-neta-aceleracion', 'ley2-unidades'],
      prompt: String.raw`Sobre un carrito de laboratorio de $450\,\mathrm{g}$ actúa una fuerza neta horizontal de $1.8\,\mathrm{N}$. ¿Qué aceleración adquiere?`,
      format: 'numeric',
      unitHint: 'm/s²',
    },
    {
      id: 'b3-ley2-02',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['ley2-fuerza-neta-aceleracion'],
      prompt:
        'Un carro avanza hacia el este por una avenida recta y el chofer frena. Mientras el carro sigue moviéndose hacia el este y reduce su rapidez, ¿hacia dónde apunta la fuerza neta sobre el carro?',
      format: 'choice',
      options: [
        'Hacia el este, porque el carro sigue moviéndose hacia el este.',
        'Hacia el oeste.',
        'No hay fuerza neta, porque el carro todavía se mueve.',
        'Verticalmente hacia abajo, porque los frenos aprietan las ruedas.',
      ],
    },
    {
      id: 'b3-ley2-03',
      category: 'grafica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['ley2-fuerza-neta-aceleracion', 'ley2-masa-inercial'],
      prompt:
        'En un experimento se aplican distintas fuerzas netas a un mismo carrito y se mide su aceleración. La gráfica muestra los resultados. ¿Cuál es la masa del carrito?',
      format: 'numeric',
      unitHint: 'kg',
      figure: {
        kind: 'line',
        title: 'Aceleración frente a fuerza neta',
        x: { label: 'F neta', unit: 'N' },
        y: { label: 'a', unit: 'm/s²' },
        series: [
          {
            name: 'a(F)',
            points: [
              [0, 0],
              [2, 0.5],
              [4, 1.0],
              [6, 1.5],
              [8, 2.0],
            ],
          },
        ],
      },
    },
    {
      id: 'b3-ley2-04',
      category: 'experimento',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['ley2-fuerza-neta-aceleracion', 'ley2-problemas-1d'],
      prompt: String.raw`En el simulador, fije $m = 4\,\mathrm{kg}$, $F = 30\,\mathrm{N}$, $\theta = 0^\circ$, $\mu_s = 0.5$, $\mu_k = 0.4$ y $g = 9.8\,\mathrm{m/s^2}$. Ejecute la simulación y lea la fuerza de fricción y la fuerza neta mientras el bloque se mueve. Con esos valores y la segunda ley, **calcule** la velocidad del bloque en $t = 5.0\,\mathrm{s}$ y compruébela con la lectura de $v$ o con la gráfica $v$–$t$. Escriba su resultado.`,
      format: 'numeric',
      unitHint: 'm/s',
      simulation: { key: 'fuerzas', params: { m: 4, F: 30, theta: 0, muS: 0.5, muK: 0.4, g: 9.8 } },
    },
    {
      id: 'b3-ley2-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['ley2-problemas-1d', 'ley2-fuerza-neta-aceleracion'],
      prompt: String.raw`Un bote de $400\,\mathrm{kg}$ parte del reposo en aguas tranquilas. El motor lo impulsa con $1200\,\mathrm{N}$ y el agua ejerce una fuerza de resistencia de $400\,\mathrm{N}$ opuesta al movimiento (suponga que es constante). Después de $10\,\mathrm{s}$ se apaga el motor. ¿Cuánto tiempo tarda el bote en detenerse **desde que se apaga el motor**?`,
      format: 'numeric',
      unitHint: 's',
    },
    {
      id: 'b3-ley2-06',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['ley2-fuerza-neta-aceleracion', 'ley2-masa-inercial'],
      prompt: String.raw`**Verdadero o falso:** si la fuerza neta sobre un cuerpo se duplica y, al mismo tiempo, su masa se reduce a la mitad, su aceleración se duplica. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b3-ley2-07',
      category: 'error',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['ley2-problemas-1d', 'ley2-fuerza-neta-aceleracion'],
      prompt: String.raw`Un estudiante resolvió así este problema: *«Se empuja un carrito de $2.0\,\mathrm{kg}$ con una fuerza horizontal de $10\,\mathrm{N}$ hacia la derecha. El piso ejerce sobre él una fuerza de rozamiento de $4.0\,\mathrm{N}$ hacia la izquierda. ¿Qué velocidad tiene a los $3.0\,\mathrm{s}$ si parte del reposo?»*

1. Datos: $m = 2.0\,\mathrm{kg}$, $F = 10\,\mathrm{N}$, $f = 4.0\,\mathrm{N}$, $v_0 = 0$, $t = 3.0\,\mathrm{s}$.
2. Segunda ley en el eje horizontal: $F_{\text{neta}} = m\,a$.
3. Fuerza neta: $F_{\text{neta}} = 10\,\mathrm{N}$.
4. Aceleración: $a = 10/2.0 = 5.0\,\mathrm{m/s^2}$.
5. Velocidad: $v = v_0 + a\,t = 0 + 5.0 \times 3.0 = 15\,\mathrm{m/s}$.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'Paso 5', 'No hay ningún error'],
    },
    {
      id: 'b3-ley2-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['ley2-problemas-1d', 'ley2-fuerza-neta-aceleracion', 'ley1-equilibrio'],
      prompt: String.raw`Un motoconcho (moto, conductor y pasajero: $180\,\mathrm{kg}$ en total) recorre una calle recta y horizontal. Parte del reposo y alcanza $12\,\mathrm{m/s}$ en $6.0\,\mathrm{s}$; mantiene esa velocidad durante $4.0\,\mathrm{s}$, y luego frena uniformemente hasta detenerse en $3.0\,\mathrm{s}$. (a) Calcule la aceleración en cada tramo. (b) Calcule la fuerza neta en cada tramo e indique su sentido. (c) Suponga que la resistencia del aire y de rodadura vale $150\,\mathrm{N}$, constante y opuesta al movimiento. Determine en cada tramo la fuerza horizontal (impulso o frenado) que la calle ejerce sobre las ruedas. (d) Explique por qué en el segundo tramo hace falta una fuerza de impulso aunque la aceleración sea cero.`,
      format: 'open',
    },
  ],
};
