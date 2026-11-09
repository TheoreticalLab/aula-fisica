import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'pendulo-simple',
  title: 'Péndulo simple',
  summary:
    'Una masa colgada de un hilo oscila con un período que, para ángulos pequeños, solo depende de la longitud y de g: T = 2π√(L/g). Con él se mide la gravedad.',
  concepts: [
    { slug: 'pendulo-simple-periodo', name: 'Período del péndulo simple' },
    { slug: 'pendulo-simple-angulos-pequenos', name: 'Aproximación de ángulos pequeños' },
    { slug: 'pendulo-simple-medicion-g', name: 'Medición de g con un péndulo' },
  ],
  theory: String.raw`## El modelo de péndulo simple

Un **péndulo simple** es una idealización: una masa puntual $m$ colgada de un hilo **sin masa e inextensible** de longitud $L$, que oscila en un plano vertical sin rozamiento. Una plomada colgada de un cordel, una lámpara que se balancea o un columpio con el niño quieto se parecen bastante a este modelo.

La longitud $L$ se mide **desde el punto de suspensión hasta el centro de la masa**, no hasta el borde inferior.

## ¿Qué fuerza lo hace oscilar?

Sobre la masa actúan dos fuerzas: el **peso** $mg$, vertical, y la **tensión** del hilo, dirigida hacia el punto de suspensión. Cuando el hilo forma un ángulo $\theta$ con la vertical, descomponemos el peso en dos componentes:

- A lo largo del hilo: $mg\cos\theta$, que junto con la tensión mantiene la masa sobre su trayectoria circular.
- Perpendicular al hilo (tangente al arco): $mg\sin\theta$, dirigida **hacia la posición más baja**.

Esa componente tangencial es la **fuerza restauradora**: siempre empuja la masa hacia el equilibrio, igual que el resorte de la lección anterior.

## La aproximación de ángulos pequeños

Para ángulos pequeños, expresados en **radianes**, se cumple $\sin\theta \approx \theta$. Por ejemplo, $\sin(0.10) = 0.0998$: la diferencia es de 0.2 %. Además, el arco recorrido es $s = L\theta$. Entonces la fuerza restauradora queda

$$F \approx -mg\,\theta = -\frac{mg}{L}\,s .$$

Tiene la misma forma que la ley de Hooke, $F = -k\,x$, con una «constante elástica efectiva» $k_{ef} = mg/L$. Sustituyendo en el período del resorte, $T = 2\pi\sqrt{m/k_{ef}}$, la masa se cancela:

$$T = 2\pi\sqrt{\frac{L}{g}} .$$

## Lo que dice la fórmula

1. **No depende de la masa.** Una bola de acero y una de madera colgadas de hilos iguales oscilan al mismo ritmo. La razón es la misma por la que todos los cuerpos caen igual: la fuerza restauradora es proporcional al peso, y la inercia, a la masa; ambas crecen juntas.
2. **No depende de la amplitud** (si es pequeña). Galileo lo observó, según la tradición, mirando una lámpara que se balanceaba en la catedral de Pisa y comparando con su pulso.
3. **Crece con la longitud**, pero como raíz cuadrada: para duplicar el período hay que cuadruplicar $L$. Un péndulo de $1\,\mathrm{m}$ tarda unos $2\,\mathrm{s}$ por ciclo; uno de $25\,\mathrm{cm}$, alrededor de $1\,\mathrm{s}$.
4. **Disminuye si $g$ aumenta.** En la Luna, donde $g = 1.62\,\mathrm{m/s^2}$, un péndulo oscila unas $2.5$ veces más despacio que en la Tierra.

> **Cuidado.** ¿Qué es un ángulo «pequeño»? Con amplitudes de hasta unos $15^\circ$ el período real supera al de la fórmula en menos de un 0.5 %. A $30^\circ$ la diferencia ronda el 1.7 % y a $60^\circ$, el 7 %. Para ángulos grandes el período **sí** depende de la amplitud: aumenta con ella.

## Medir g con un péndulo

Despejando $g$ de la fórmula del período:

$$g = \frac{4\pi^2 L}{T^2} .$$

Basta con una cuerda, una masa pequeña, una cinta métrica y un cronómetro. El procedimiento recomendado es:

1. Medir $L$ desde el punto de suspensión hasta el centro de la masa.
2. Apartar la masa un ángulo pequeño (menos de unos $10^\circ$) y soltarla sin empujarla.
3. Cronometrar **varias** oscilaciones (10 o 20) y dividir entre su número.
4. Repetir con varias longitudes y representar $T^2$ frente a $L$. Debe salir una recta que pasa por el origen con pendiente $4\pi^2/g$. De la pendiente se obtiene $g$, y la recta permite detectar mediciones anómalas.

Este experimento clásico se hace en los laboratorios de física de primer año de todo el mundo, y con cuidado da $g$ con un error de menos del 1 %.

## Relojes de péndulo

Como su período es muy estable, el péndulo fue durante casi 300 años la base de los relojes más precisos. Un reloj de péndulo «adelanta» o «atrasa» si cambia $L$ (por ejemplo, el metal se dilata con el calor y el reloj atrasa) o si se traslada a un lugar con otra $g$. Para ajustarlo se sube o se baja la masa con un tornillo.

## Errores frecuentes

- Creer que una masa más pesada oscila más rápido.
- Usar el ángulo en grados en la aproximación $\sin\theta \approx \theta$; solo vale en radianes.
- Medir $L$ hasta el borde de la masa en vez de hasta su centro.
- Olvidar la raíz cuadrada o el factor $2\pi$ en el cálculo.
- Contar como oscilación completa la ida de un extremo al otro.

## Límites del modelo

El modelo ignora la masa del hilo, su elasticidad, el tamaño de la masa (un péndulo «físico» real tiene un período algo distinto) y la resistencia del aire, que poco a poco reduce la amplitud. Y, sobre todo, solo vale para **ángulos pequeños**.`,
  formulas: [
    {
      name: 'Período del péndulo simple',
      latex: String.raw`T = 2\pi\sqrt{\frac{L}{g}}`,
      description: 'Válido para amplitudes pequeñas (menores que unos 15°). No depende de la masa.',
      variables: [
        { symbol: String.raw`T`, meaning: 'Período', unit: 's' },
        { symbol: String.raw`L`, meaning: 'Longitud del péndulo (hasta el centro de la masa)', unit: 'm' },
        { symbol: String.raw`g`, meaning: 'Aceleración de la gravedad', unit: 'm/s²' },
      ],
    },
    {
      name: 'Medición de g',
      latex: String.raw`g = \frac{4\pi^2 L}{T^2}`,
      description: 'Se obtiene despejando g de la fórmula del período.',
      variables: [
        { symbol: String.raw`L`, meaning: 'Longitud medida', unit: 'm' },
        { symbol: String.raw`T`, meaning: 'Período medido', unit: 's' },
      ],
      notes: 'Con varias longitudes, la pendiente de la recta T² frente a L vale 4π²/g.',
    },
    {
      name: 'Fuerza restauradora (ángulos pequeños)',
      latex: String.raw`F = -mg\sin\theta \approx -\frac{mg}{L}\,s`,
      description: 'Componente tangencial del peso; para θ pequeño (en radianes) es proporcional al arco s.',
      variables: [
        { symbol: String.raw`\theta`, meaning: 'Ángulo del hilo con la vertical', unit: 'rad' },
        { symbol: String.raw`s`, meaning: 'Arco medido desde el punto más bajo (s = Lθ)', unit: 'm' },
        { symbol: String.raw`m`, meaning: 'Masa', unit: 'kg' },
      ],
    },
  ],
  examples: [
    {
      title: 'Péndulo de un metro',
      statement: String.raw`Calcule el período de un péndulo simple de $1.00\,\mathrm{m}$ de longitud en un lugar donde $g = 9.8\,\mathrm{m/s^2}$.`,
      steps: [
        String.raw`$\dfrac{L}{g} = \dfrac{1.00\,\mathrm{m}}{9.8\,\mathrm{m/s^2}} = 0.102\,\mathrm{s^2}$.`,
        String.raw`$\sqrt{0.102\,\mathrm{s^2}} = 0.319\,\mathrm{s}$.`,
        String.raw`$T = 2\pi\,(0.319\,\mathrm{s}) = 2.01\,\mathrm{s}$.`,
      ],
      result: String.raw`$T \approx 2.0\,\mathrm{s}$.`,
      interpretation: 'Cada ida (medio ciclo) dura casi exactamente un segundo. Por eso un péndulo de un metro se llamó históricamente «péndulo que bate segundos».',
    },
    {
      title: 'Medir g en el laboratorio',
      statement: String.raw`Un grupo de estudiantes construye un péndulo de $L = 0.800\,\mathrm{m}$ y cronometra $20$ oscilaciones completas en $35.9\,\mathrm{s}$. ¿Qué valor de $g$ obtienen?`,
      steps: [
        String.raw`Período: $T = \dfrac{35.9\,\mathrm{s}}{20} = 1.795\,\mathrm{s}$.`,
        String.raw`$T^2 = (1.795\,\mathrm{s})^2 = 3.222\,\mathrm{s^2}$.`,
        String.raw`$g = \dfrac{4\pi^2 L}{T^2} = \dfrac{4\pi^2\,(0.800\,\mathrm{m})}{3.222\,\mathrm{s^2}} = \dfrac{31.58\,\mathrm{m}}{3.222\,\mathrm{s^2}} = 9.80\,\mathrm{m/s^2}$.`,
      ],
      result: String.raw`$g \approx 9.80\,\mathrm{m/s^2}$.`,
      interpretation: 'Coincide con el valor aceptado. Un error de solo 0.1 s en el tiempo total cambiaría g en algo más de 0.5 %; por eso se cronometran muchas oscilaciones.',
    },
    {
      title: 'El mismo péndulo en la Luna',
      statement: String.raw`¿Cuántas veces más largo es el período de un péndulo en la Luna ($g_L = 1.62\,\mathrm{m/s^2}$) que en la Tierra ($9.8\,\mathrm{m/s^2}$)?`,
      steps: [
        String.raw`Con la misma $L$: $\dfrac{T_L}{T_T} = \dfrac{2\pi\sqrt{L/g_L}}{2\pi\sqrt{L/g_T}} = \sqrt{\dfrac{g_T}{g_L}}$.`,
        String.raw`$\sqrt{\dfrac{9.8}{1.62}} = \sqrt{6.05} = 2.46$.`,
      ],
      result: String.raw`El período en la Luna es unas $2.5$ veces mayor.`,
      interpretation: 'Con menos gravedad, la fuerza restauradora es menor y el péndulo va y viene más despacio. Un reloj de péndulo llevado a la Luna atrasaría muchísimo.',
    },
  ],
  simulation: null,
  exercises: [
    {
      id: 'b5-pend-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['pendulo-simple-periodo'],
      prompt: String.raw`Un columpio de un parque tiene cadenas de $2.5\,\mathrm{m}$. Modelándolo como un péndulo simple que oscila con amplitud pequeña, ¿cuál es su período?`,
      format: 'numeric',
      unitHint: 's',
    },
    {
      id: 'b5-pend-02',
      category: 'conceptual',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['pendulo-simple-periodo'],
      prompt: String.raw`Dos péndulos tienen hilos de la misma longitud. Uno lleva una bola de acero de $500\,\mathrm{g}$ y el otro una bola de madera de $50\,\mathrm{g}$, del mismo tamaño. Se sueltan desde un ángulo pequeño. Si se desprecia la resistencia del aire, ¿qué ocurre con sus períodos?`,
      format: 'choice',
      options: [
        'El de acero tiene un período 10 veces menor.',
        'El de acero tiene un período unas 3.2 veces menor.',
        'Ambos tienen el mismo período.',
        'El de madera tiene un período menor porque es más liviano.',
      ],
    },
    {
      id: 'b5-pend-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['pendulo-simple-angulos-pequenos'],
      prompt: String.raw`**Verdadero o falso:** el período de un péndulo simple es el mismo para cualquier amplitud, aunque se suelte desde $80^\circ$. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b5-pend-04',
      category: 'numerica',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['pendulo-simple-medicion-g'],
      prompt: String.raw`Para medir la gravedad, un estudiante usa un péndulo de $0.60\,\mathrm{m}$ (medidos hasta el centro de la masa) y cronometra $10$ oscilaciones completas en $15.6\,\mathrm{s}$. ¿Qué valor de $g$ obtiene?`,
      format: 'numeric',
      unitHint: 'm/s²',
    },
    {
      id: 'b5-pend-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['pendulo-simple-periodo', 'pendulo-simple-medicion-g'],
      prompt: String.raw`Un péndulo tiene en la Tierra ($g = 9.8\,\mathrm{m/s^2}$) un período de $2.00\,\mathrm{s}$. Una sonda lleva el mismo péndulo a otro planeta, donde se mide un período de $3.00\,\mathrm{s}$ con amplitud pequeña. ¿Cuál es la aceleración de la gravedad en ese planeta?`,
      format: 'numeric',
      unitHint: 'm/s²',
    },
    {
      id: 'b5-pend-06',
      category: 'grafica',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['pendulo-simple-medicion-g'],
      prompt: String.raw`Un grupo midió el período de un péndulo para cinco longitudes y representó $T^2$ frente a $L$. Use la gráfica para determinar el valor de $g$ en el laboratorio.`,
      format: 'numeric',
      unitHint: 'm/s²',
      figure: {
        kind: 'scatter',
        title: 'Cuadrado del período frente a la longitud',
        x: { label: 'L', unit: 'm' },
        y: { label: 'T²', unit: 's²' },
        series: [{ name: 'Mediciones', points: [[0.2, 0.806], [0.4, 1.611], [0.6, 2.417], [0.8, 3.223], [1.0, 4.028]] }],
      },
    },
    {
      id: 'b5-pend-07',
      category: 'error',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['pendulo-simple-periodo'],
      prompt: String.raw`Un estudiante calculó así el período de un péndulo de $90\,\mathrm{cm}$:

1. Datos: $L = 90\,\mathrm{cm} = 0.90\,\mathrm{m}$, $g = 9.8\,\mathrm{m/s^2}$.
2. Fórmula: $T = 2\pi\sqrt{L/g}$.
3. Sustitución: $T = 2\pi \times \dfrac{0.90}{9.8} = 2\pi \times 0.0918$.
4. Resultado: $T = 0.58\,\mathrm{s}$.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'No hay ningún error'],
    },
    {
      id: 'b5-pend-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['pendulo-simple-medicion-g', 'pendulo-simple-angulos-pequenos'],
      prompt: String.raw`Diseñe un experimento para medir $g$ con un péndulo simple usando materiales de casa. (a) Describa el montaje y cómo mediría $L$ y $T$. (b) Explique por qué conviene cronometrar 10 o más oscilaciones y soltar el péndulo desde un ángulo pequeño. (c) Si obtiene estos datos: $L = 0.50\,\mathrm{m}$, 10 oscilaciones en $14.2\,\mathrm{s}$, calcule $g$. (d) Explique cómo usaría varias longitudes y una gráfica para mejorar el resultado. (e) ¿Influiría usar una masa más pesada? Justifique.`,
      format: 'open',
    },
  ],
};
