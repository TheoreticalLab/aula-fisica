import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'posicion-desplazamiento',
  title: 'Posición, desplazamiento y trayectoria',
  summary:
    'Para describir un movimiento hay que elegir un sistema de referencia. Con él se definen la posición, el desplazamiento (cambio de posición, con signo) y la distancia recorrida (longitud del camino).',
  concepts: [
    { slug: 'posicion-desplazamiento-sistema-referencia', name: 'Sistema de referencia y posición' },
    { slug: 'posicion-desplazamiento-delta-x', name: 'Desplazamiento como cambio de posición' },
    { slug: 'posicion-desplazamiento-distancia', name: 'Distancia recorrida frente a desplazamiento' },
    { slug: 'posicion-desplazamiento-trayectoria', name: 'Trayectoria y desplazamiento en el plano' },
  ],
  theory: String.raw`## Describir un movimiento empieza por una pregunta: ¿respecto a qué?

Decir que «la guagua está a 300 metros» no significa nada si no aclaramos *a 300 metros de qué* y *en qué dirección*. El movimiento siempre se describe **respecto a algo**: un pasajero sentado está en reposo respecto a la guagua, pero se mueve respecto a la acera. Por eso, antes de calcular, la cinemática exige elegir un **sistema de referencia**.

Además, en este bloque trataremos los cuerpos como **partículas**: puntos sin tamaño que concentran toda la información sobre dónde está el objeto. Es una buena aproximación cuando el tamaño del cuerpo es pequeño frente a las distancias que recorre (un auto en una carretera de 50 km) o cuando solo nos interesa el movimiento de conjunto, no sus giros ni deformaciones.

## El sistema de referencia

Para un movimiento sobre una recta (una avenida, una vía del Metro de Santo Domingo, un pasillo), el sistema de referencia consta de:

1. Un **origen**: el punto que tomamos como $x = 0$ (un semáforo, una estación, la puerta del aula).
2. Un **eje** a lo largo de la recta, con un **sentido positivo** elegido por nosotros (por ejemplo, hacia el este).
3. Una **unidad de longitud** (el metro en el SI) y un **reloj** que marque el instante $t = 0$.

La elección es libre, pero una vez hecha **hay que respetarla en todo el problema**. Elegir bien simplifica las cuentas: suele convenir poner el origen en el punto de partida y el sentido positivo hacia donde empieza a moverse el cuerpo.

## Posición

La **posición** $x$ es la coordenada del cuerpo en ese eje. Es un número **con signo y con unidad**: $x = +250\,\mathrm{m}$ significa «250 m del lado positivo del origen» y $x = -150\,\mathrm{m}$, «150 m del lado negativo». El signo no indica que algo sea «menor» o «peor»: solo indica de qué lado del origen está el cuerpo.

La posición **depende del sistema de referencia**. Si una parada de guagua está a $300\,\mathrm{m}$ al este de un semáforo, su posición es $x = +300\,\mathrm{m}$ con origen en el semáforo y sentido positivo hacia el este; pero es $x = 0$ si el origen se pone en la propia parada, y $x = -300\,\mathrm{m}$ si el sentido positivo es hacia el oeste.

## Desplazamiento

El **desplazamiento** es el **cambio de posición** entre un instante inicial y uno final:

$$\Delta x = x_f - x_i .$$

La letra griega $\Delta$ (delta) se lee «cambio de» y significa siempre *valor final menos valor inicial*. Tres propiedades importantes:

- **Tiene signo.** $\Delta x > 0$ indica que el cuerpo terminó del lado positivo respecto a donde empezó; $\Delta x < 0$, del lado negativo; $\Delta x = 0$, que volvió al punto de partida.
- **Solo depende del punto inicial y del final**, no de lo que ocurrió entre medias. Si un perro corre en la playa 20 m hacia el mar y regresa 25 m, su desplazamiento es $-5\,\mathrm{m}$ (con el sentido positivo hacia el mar), aunque haya corrido mucho más.
- **No depende del origen elegido.** Si movemos el origen, todas las posiciones cambian en la misma cantidad y esa cantidad se cancela en la resta. Sí depende del sentido positivo: al invertirlo, cambia el signo de $\Delta x$.

## Distancia recorrida

La **distancia recorrida** $d$ es la **longitud total del camino** seguido. Es un escalar que **nunca es negativo** y que solo crece mientras el cuerpo se mueve. Si el movimiento sobre la recta tiene varios tramos, en cada uno de los cuales el cuerpo no cambia de sentido, la distancia es la suma de los valores absolutos de los desplazamientos de cada tramo:

$$d = |\Delta x_1| + |\Delta x_2| + \dots$$

Por eso siempre se cumple $d \ge |\Delta x|$. Las dos cantidades **coinciden solo si el cuerpo se mueve en línea recta sin cambiar de sentido**.

> **Error frecuente.** Calcular la distancia como $x_f - x_i$ cuando el cuerpo cambia de sentido. Hay que localizar los puntos de retorno, partir el movimiento en tramos y sumar las longitudes de cada tramo.

> **Cuidado.** El cuentakilómetros de un auto mide distancia recorrida. Un taxi que hace un viaje de ida y vuelta marca muchos kilómetros, aunque su desplazamiento sea cero.

## Trayectoria

La **trayectoria** es la línea que describe el cuerpo en el espacio: el conjunto de puntos por los que pasa. Puede ser recta (un tren en una vía recta) o curva (una pelota de béisbol bateada, un auto en una rotonda). La distancia recorrida es la longitud de la trayectoria.

En el plano, la posición necesita dos coordenadas $(x, y)$ y el desplazamiento es un **vector**: la flecha que va del punto inicial al final, con componentes $\Delta x$ y $\Delta y$. Su módulo se obtiene con el teorema de Pitágoras:

$$|\Delta\vec r| = \sqrt{(\Delta x)^2 + (\Delta y)^2}.$$

En un campo de béisbol, el bateador que da un jonrón recorre las cuatro bases (más de 100 m) y termina en el mismo punto de donde salió: su desplazamiento es nulo.

> **Error frecuente.** Confundir la **trayectoria** con la **gráfica posición–tiempo**. Un cuerpo que va y vuelve por una recta tiene una trayectoria que es un segmento recto, pero su gráfica $x$–$t$ es una línea que sube y luego baja. La gráfica no es un dibujo del camino: muestra cómo cambia la posición con el tiempo.

## Gráfica posición–tiempo

En la gráfica $x$–$t$ el tiempo va en el eje horizontal y la posición en el vertical. De ella se leen directamente:

- la posición en cada instante (la ordenada de cada punto);
- el desplazamiento entre dos instantes (la diferencia de ordenadas);
- los **puntos de retorno**, donde la gráfica pasa de subir a bajar o al revés: allí el cuerpo cambia de sentido.

Un tramo horizontal indica que el cuerpo está detenido: el tiempo pasa pero la posición no cambia.

## Límites del modelo

Hemos supuesto que el cuerpo es una partícula y que el sistema de referencia está en reposo (o se mueve sin acelerar). Para un autobús que gira o una persona que camina dentro de un tren en marcha, hay que precisar qué punto seguimos y respecto a qué sistema lo medimos. Las ideas de esta lección (posición con signo, desplazamiento como diferencia y distancia como longitud del camino) son la base de todo lo que sigue: velocidad, aceleración y movimientos con aceleración constante.`,
  formulas: [
    {
      name: 'Desplazamiento en una dimensión',
      latex: String.raw`\Delta x = x_f - x_i`,
      description:
        'Cambio de posición entre dos instantes. Tiene signo y solo depende de las posiciones inicial y final.',
      variables: [
        { symbol: String.raw`\Delta x`, meaning: 'Desplazamiento (con signo)', unit: 'm' },
        { symbol: String.raw`x_f`, meaning: 'Posición final', unit: 'm' },
        { symbol: String.raw`x_i`, meaning: 'Posición inicial', unit: 'm' },
      ],
      notes: 'No depende del origen elegido; cambia de signo si se invierte el sentido positivo del eje.',
    },
    {
      name: 'Distancia recorrida por tramos',
      latex: String.raw`d = |\Delta x_1| + |\Delta x_2| + \dots + |\Delta x_n| \ge |\Delta x|`,
      description:
        'Longitud total del camino. Se divide el movimiento en tramos sin cambio de sentido y se suman las longitudes de cada tramo.',
      variables: [
        { symbol: String.raw`d`, meaning: 'Distancia recorrida (nunca negativa)', unit: 'm' },
        { symbol: String.raw`\Delta x_k`, meaning: 'Desplazamiento del tramo k (sin cambio de sentido)', unit: 'm' },
        { symbol: String.raw`\Delta x`, meaning: 'Desplazamiento total', unit: 'm' },
      ],
      notes: 'La igualdad d = |Δx| solo se cumple si el cuerpo no cambia de sentido.',
    },
    {
      name: 'Módulo del desplazamiento en el plano',
      latex: String.raw`|\Delta\vec r| = \sqrt{(\Delta x)^2 + (\Delta y)^2}`,
      description:
        'Longitud de la flecha que une el punto inicial con el final cuando el movimiento ocurre en un plano.',
      variables: [
        { symbol: String.raw`|\Delta\vec r|`, meaning: 'Módulo del vector desplazamiento', unit: 'm' },
        { symbol: String.raw`\Delta x`, meaning: 'Componente x del desplazamiento', unit: 'm' },
        { symbol: String.raw`\Delta y`, meaning: 'Componente y del desplazamiento', unit: 'm' },
      ],
      notes: 'La dirección se obtiene con la tangente: tan θ = Δy/Δx, teniendo en cuenta el cuadrante.',
    },
  ],
  examples: [
    {
      title: 'Ida y vuelta de una guagua',
      statement: String.raw`Tomamos el origen en un semáforo y el sentido positivo hacia el este. Una guagua parte de una parada situada en $x = 300\,\mathrm{m}$, avanza hacia el este hasta $x = 1200\,\mathrm{m}$ y luego regresa hasta detenerse en $x = 700\,\mathrm{m}$. Calcule su desplazamiento y la distancia recorrida. Repita el cálculo del desplazamiento con el origen en la parada.`,
      steps: [
        String.raw`Desplazamiento total: $\Delta x = x_f - x_i = 700\,\mathrm{m} - 300\,\mathrm{m} = +400\,\mathrm{m}$.`,
        String.raw`La guagua cambia de sentido en $x = 1200\,\mathrm{m}$, así que dividimos el movimiento en dos tramos: $\Delta x_1 = 1200 - 300 = +900\,\mathrm{m}$ y $\Delta x_2 = 700 - 1200 = -500\,\mathrm{m}$.`,
        String.raw`Distancia recorrida: $d = |\Delta x_1| + |\Delta x_2| = 900\,\mathrm{m} + 500\,\mathrm{m} = 1400\,\mathrm{m}$.`,
        String.raw`Con el origen en la parada, las posiciones son $x_i' = 0$ y $x_f' = 400\,\mathrm{m}$: $\Delta x' = 400\,\mathrm{m} - 0 = +400\,\mathrm{m}$.`,
      ],
      result: String.raw`$\Delta x = +400\,\mathrm{m}$ (400 m hacia el este) y $d = 1400\,\mathrm{m} = 1.4\,\mathrm{km}$.`,
      interpretation:
        'La distancia es mayor que el módulo del desplazamiento porque la guagua cambió de sentido. Al mover el origen cambiaron las posiciones, pero no el desplazamiento: este solo depende de dónde empieza y dónde termina el movimiento.',
    },
    {
      title: 'Jonrón y doble en el béisbol',
      statement: String.raw`Las bases de un campo de béisbol forman un cuadrado de $27.4\,\mathrm{m}$ de lado (90 pies). Calcule la distancia recorrida y el módulo del desplazamiento de un bateador (a) que da un jonrón y recorre las cuatro bases, y (b) que da un doble y se queda en segunda base.`,
      steps: [
        String.raw`(a) Distancia: cuatro lados del cuadrado, $d = 4 \times 27.4\,\mathrm{m} = 109.6\,\mathrm{m} \approx 110\,\mathrm{m}$. El bateador termina en el home, de donde salió: $|\Delta\vec r| = 0$.`,
        String.raw`(b) Distancia: dos lados, $d = 2 \times 27.4\,\mathrm{m} = 54.8\,\mathrm{m}$.`,
        String.raw`Para el desplazamiento colocamos el origen en el home, el eje $x$ hacia primera base y el eje $y$ hacia tercera. Segunda base está en $(27.4\,\mathrm{m},\,27.4\,\mathrm{m})$, así que $\Delta x = \Delta y = 27.4\,\mathrm{m}$.`,
        String.raw`$|\Delta\vec r| = \sqrt{(27.4\,\mathrm{m})^2 + (27.4\,\mathrm{m})^2} = 27.4\sqrt{2}\,\mathrm{m} \approx 38.7\,\mathrm{m}$.`,
      ],
      result: String.raw`(a) $d \approx 110\,\mathrm{m}$, $|\Delta\vec r| = 0$. (b) $d = 54.8\,\mathrm{m}$, $|\Delta\vec r| \approx 38.7\,\mathrm{m}$, dirigido del home a segunda base (la diagonal del cuadrado).`,
      interpretation:
        'En ambos casos la distancia supera al desplazamiento, porque la trayectoria no es una recta en un solo sentido. La diagonal (38.7 m) es más corta que el camino por las bases (54.8 m), como debe ser: la línea recta es el camino más corto entre dos puntos.',
    },
    {
      title: 'Un perro en la playa, a partir de una tabla',
      statement: String.raw`Con el origen en una palmera y el sentido positivo hacia el mar, la posición de un perro es: $x = -5\,\mathrm{m}$ en $t = 0$; $x = 15\,\mathrm{m}$ en $t = 10\,\mathrm{s}$; $x = 15\,\mathrm{m}$ en $t = 20\,\mathrm{s}$; $x = -10\,\mathrm{m}$ en $t = 30\,\mathrm{s}$. Dentro de cada uno de esos intervalos el perro no cambia de sentido, y entre $10$ y $20\,\mathrm{s}$ permanece sentado. Halle el desplazamiento y la distancia entre $t = 0$ y $t = 30\,\mathrm{s}$, y describa su trayectoria.`,
      steps: [
        String.raw`Desplazamiento: $\Delta x = x_f - x_i = -10\,\mathrm{m} - (-5\,\mathrm{m}) = -5\,\mathrm{m}$.`,
        String.raw`Tramos: de 0 a 10 s, $\Delta x_1 = 15 - (-5) = +20\,\mathrm{m}$; de 10 a 20 s, $\Delta x_2 = 0$ (está quieto); de 20 a 30 s, $\Delta x_3 = -10 - 15 = -25\,\mathrm{m}$.`,
        String.raw`Distancia: $d = 20\,\mathrm{m} + 0 + 25\,\mathrm{m} = 45\,\mathrm{m}$.`,
        String.raw`La trayectoria es el segmento de recta entre $x = -10\,\mathrm{m}$ y $x = 15\,\mathrm{m}$, recorrido de ida y de vuelta. La gráfica $x$–$t$, en cambio, sube, se mantiene horizontal y baja.`,
      ],
      result: String.raw`$\Delta x = -5\,\mathrm{m}$ (terminó 5 m más lejos del mar que al empezar) y $d = 45\,\mathrm{m}$.`,
      interpretation:
        'El signo negativo del desplazamiento indica el sentido hacia tierra, según el eje elegido. El tramo horizontal de la gráfica no añade distancia: el perro estaba quieto.',
    },
  ],
  simulation: {
    key: 'movimiento-rectilineo',
    params: { x0: 10, v0: -4, a: 0, tMax: 10 },
    guide: String.raw`1. Con los valores iniciales ($x_0 = 10\,\mathrm{m}$, $v_0 = -4\,\mathrm{m/s}$, $a = 0$), pulse **Iniciar**. Lea en la tabla la posición inicial y la final, y calcule $\Delta x = x_f - x_i$. ¿Qué indica su signo?
2. Cambie $x_0$ a $-10\,\mathrm{m}$ sin tocar nada más. Compare las nuevas posiciones con las anteriores y calcule otra vez $\Delta x$. ¿Qué cambió y qué no?
3. Observe el instante en que el móvil pasa por $x = 0$. ¿Cambia algo en su movimiento cuando la posición pasa de positiva a negativa?
4. Ponga $x_0 = 0$, $v_0 = 8\,\mathrm{m/s}$, $a = -2\,\mathrm{m/s^2}$ y duración $8\,\mathrm{s}$. El móvil avanza, se detiene y regresa. Con la tabla, localice el punto de retorno y calcule el desplazamiento y la distancia recorrida. ¿Por qué no coinciden?
5. En esa misma simulación, compare el dibujo del móvil sobre la recta (su trayectoria) con la gráfica $x$–$t$. Explique por qué la gráfica es una curva aunque la trayectoria sea un segmento recto.`,
  },
  exercises: [
    {
      id: 'b2-pos-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['posicion-desplazamiento-delta-x', 'posicion-desplazamiento-sistema-referencia'],
      prompt: String.raw`En una calle recta se toma el origen frente a un colmado y el sentido positivo hacia el este. Un motoconcho parte de $x = 250\,\mathrm{m}$ y, después de recorrer la calle, se detiene en $x = -150\,\mathrm{m}$. ¿Cuál es su desplazamiento? Indique el signo según el eje elegido.`,
      format: 'numeric',
      unitHint: 'm',
    },
    {
      id: 'b2-pos-02',
      category: 'grafica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['posicion-desplazamiento-distancia'],
      prompt:
        'La gráfica muestra la posición de un carrito que se mueve sobre un riel recto. ¿Qué distancia total recorre entre t = 0 y t = 8 s?',
      format: 'numeric',
      unitHint: 'm',
      figure: {
        kind: 'line',
        title: 'Posición del carrito frente al tiempo',
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
              [4, 16],
              [5, 13],
              [6, 10],
              [7, 7],
              [8, 4],
            ],
          },
        ],
      },
    },
    {
      id: 'b2-pos-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['posicion-desplazamiento-distancia', 'posicion-desplazamiento-trayectoria'],
      prompt: String.raw`**Verdadero o falso:** la distancia recorrida por un cuerpo siempre es mayor o igual que el módulo de su desplazamiento, y ambas cantidades coinciden únicamente cuando el cuerpo se mueve en línea recta sin cambiar de sentido. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b2-pos-04',
      category: 'error',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['posicion-desplazamiento-distancia', 'posicion-desplazamiento-delta-x'],
      prompt: String.raw`Un estudiante resolvió así este problema: *«Una hormiga camina sobre una regla. Parte de $x = 2\,\mathrm{cm}$, va hasta $x = -6\,\mathrm{cm}$ y luego regresa hasta $x = 5\,\mathrm{cm}$, sin otros cambios de sentido. Halle la distancia recorrida y el desplazamiento.»*

1. Primer tramo: $\Delta x_1 = -6\,\mathrm{cm} - 2\,\mathrm{cm} = -8\,\mathrm{cm}$.
2. Segundo tramo: $\Delta x_2 = 5\,\mathrm{cm} - (-6\,\mathrm{cm}) = +11\,\mathrm{cm}$.
3. Distancia recorrida: $d = \Delta x_1 + \Delta x_2 = -8\,\mathrm{cm} + 11\,\mathrm{cm} = 3\,\mathrm{cm}$.
4. Desplazamiento: $\Delta x = 5\,\mathrm{cm} - 2\,\mathrm{cm} = 3\,\mathrm{cm}$.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'No hay ningún error'],
    },
    {
      id: 'b2-pos-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['posicion-desplazamiento-trayectoria', 'posicion-desplazamiento-distancia'],
      prompt: String.raw`Una atleta entrena en una pista **circular** de $400\,\mathrm{m}$ de perímetro. Sale de la línea de partida y se detiene después de recorrer exactamente $2.5$ vueltas. ¿Cuál es el **módulo** de su desplazamiento?`,
      format: 'numeric',
      unitHint: 'm',
    },
    {
      id: 'b2-pos-06',
      category: 'conceptual',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['posicion-desplazamiento-sistema-referencia', 'posicion-desplazamiento-delta-x'],
      prompt: String.raw`Ana y Luis describen el mismo viaje de una guagua por una avenida recta. Ana pone el origen en la terminal y Luis lo pone en un parque situado $2\,\mathrm{km}$ más al norte; los dos toman el sentido positivo hacia el norte. ¿Qué cantidades obtienen **iguales** los dos?`,
      format: 'choice',
      options: [
        'La posición inicial de la guagua.',
        'La posición final de la guagua.',
        'El desplazamiento y la distancia recorrida.',
        'Ninguna: todas las cantidades dependen del origen elegido.',
      ],
    },
    {
      id: 'b2-pos-07',
      category: 'experimento',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['posicion-desplazamiento-distancia', 'posicion-desplazamiento-delta-x'],
      prompt: String.raw`En el simulador fije $x_0 = -10\,\mathrm{m}$, $v_0 = 6\,\mathrm{m/s}$, $a = -1\,\mathrm{m/s^2}$ y duración $10\,\mathrm{s}$, y pulse **Iniciar**. El móvil avanza, se detiene un instante y regresa. Usando la tabla de datos (o la gráfica $x$–$t$), determine la **distancia total recorrida** entre $t = 0$ y $t = 10\,\mathrm{s}$.`,
      format: 'numeric',
      unitHint: 'm',
      simulation: { key: 'movimiento-rectilineo', params: { x0: -10, v0: 6, a: -1, tMax: 10 } },
    },
    {
      id: 'b2-pos-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: [
        'posicion-desplazamiento-sistema-referencia',
        'posicion-desplazamiento-trayectoria',
        'posicion-desplazamiento-distancia',
      ],
      prompt: String.raw`Un repartidor sale en motocicleta de un colmado y recorre, por calles rectas, $600\,\mathrm{m}$ hacia el este, luego $800\,\mathrm{m}$ hacia el norte y por último $1200\,\mathrm{m}$ hacia el oeste, donde entrega el pedido.

(a) Elija un sistema de referencia en el plano (origen y ejes) y escriba las coordenadas del punto de partida, de las dos esquinas donde gira y del punto de entrega.
(b) Calcule la distancia recorrida.
(c) Calcule el módulo y la dirección del desplazamiento.
(d) Repita (a) y (c) con el origen en el punto de entrega y muestre qué cambia y qué no.
(e) Dibuje la trayectoria y explique por qué la distancia y el módulo del desplazamiento son distintos.`,
      format: 'open',
    },
  ],
};
