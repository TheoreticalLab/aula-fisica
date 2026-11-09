import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'primera-ley-termodinamica',
  title: 'Primera ley de la termodinámica',
  summary:
    'La energía interna de un sistema cambia por el calor que recibe y el trabajo que realiza: ΔU = Q − W, con W el trabajo hecho POR el gas. En un diagrama P–V, ese trabajo es el área bajo la curva del proceso.',
  concepts: [
    { slug: 'primera-ley-termodinamica-enunciado', name: 'Primera ley: ΔU = Q − W y convención de signos' },
    { slug: 'primera-ley-termodinamica-trabajo-pv', name: 'Trabajo de un gas como área bajo la curva P–V' },
    { slug: 'primera-ley-termodinamica-procesos', name: 'Procesos isobárico, isocórico, isotérmico y adiabático' },
  ],
  theory: String.raw`## Dos formas de cambiar la energía interna

En la lección de calor vimos que la energía interna $U$ de un cuerpo puede aumentar al recibir calor, pero también al hacer trabajo sobre él: al inflar con una bomba de mano un neumático de bicicleta, la bomba se calienta. La **primera ley de la termodinámica** es el principio de conservación de la energía aplicado a estos intercambios:

$$\Delta U = Q - W .$$

Para aplicarla sin errores hay que fijar con cuidado los signos. En este curso usamos la convención habitual en física:

- $Q$ es el **calor que recibe el sistema**: $Q > 0$ si entra calor, $Q < 0$ si sale.
- $W$ es el **trabajo hecho POR el sistema (el gas) sobre los alrededores**: $W > 0$ si el gas se expande y empuja, $W < 0$ si el gas es comprimido (los alrededores hacen trabajo sobre él).
- $\Delta U = U_f - U_i$ es el cambio de energía interna.

Así, la energía interna aumenta con el calor que entra y disminuye con el trabajo que el gas entrega. Es como una cuenta bancaria: los depósitos son el calor recibido y los retiros, el trabajo realizado.

> **Cuidado.** Algunos libros de química usan $\Delta U = Q + W$, con $W$ el trabajo hecho **sobre** el gas. Las dos formas describen lo mismo, pero no se pueden mezclar. Aquí, $W$ siempre es el trabajo hecho **por** el gas.

Para un **gas ideal**, la energía interna depende **solo de la temperatura**: si $T$ no cambia, $\Delta U = 0$; si $T$ sube, $\Delta U > 0$. En cambio, $Q$ y $W$ dependen del camino seguido entre el estado inicial y el final.

## Trabajo de un gas en el diagrama P–V

Imagine un gas en un cilindro con un émbolo de área $A$. Si la presión es $P$, el gas empuja el émbolo con fuerza $F = PA$. Si el émbolo se desplaza $d$, el trabajo es $W = F\,d = P\,A\,d = P\,\Delta V$. Por tanto, a **presión constante**,

$$W = P\,\Delta V = P\,(V_f - V_i) .$$

En un diagrama $P$–$V$, ese producto es el **área del rectángulo** bajo la recta horizontal. En general, **el trabajo hecho por el gas es el área bajo la curva del proceso** en el diagrama $P$–$V$, entre $V_i$ y $V_f$:

- Si el gas se **expande** ($V$ aumenta), el área cuenta como positiva: $W > 0$.
- Si se **comprime**, el área cuenta como negativa: $W < 0$.
- Si la curva es una recta inclinada, el área es un **trapecio**: $W = \tfrac{1}{2}(P_i + P_f)(V_f - V_i)$.

Unidades: Pa por $\mathrm{m^3}$ da joules. Atajo: $1\,\mathrm{kPa\cdot L} = 1\,\mathrm{J}$.

## Procesos elementales

**Isocórico (volumen constante).** El gas está en un recipiente rígido: $\Delta V = 0$ y $W = 0$. Todo el calor se invierte en energía interna: $\Delta U = Q$. En el diagrama $P$–$V$ es una recta vertical. Ejemplo: una olla de presión cerrada que se calienta.

**Isobárico (presión constante).** $W = P\,\Delta V$ y $\Delta U = Q - P\,\Delta V$. Es una recta horizontal. Ejemplo: el aire de un globo que se calienta al sol a presión atmosférica. Al expandirse, parte del calor recibido se va en trabajo, así que se necesita más calor que a volumen constante para el mismo aumento de temperatura.

**Isotérmico (temperatura constante).** Para un gas ideal, $\Delta U = 0$, así que $Q = W$: todo el calor que entra sale como trabajo (o al revés en una compresión). La curva $P$–$V$ es una isoterma, $PV = \text{constante}$. El área bajo esa curva no es un rectángulo ni un trapecio, y su cálculo exacto requiere herramientas que no usamos en este curso; basta con saber que es positiva en una expansión y estimarla, si hace falta, con trapecios.

**Adiabático (sin intercambio de calor).** $Q = 0$, de modo que $\Delta U = -W$. Ocurre si el proceso es tan rápido que no da tiempo a intercambiar calor, o si el recipiente está muy bien aislado. En una **compresión** adiabática, $W < 0$ y la energía interna y la temperatura **suben**: así se calienta la bomba de bicicleta y así funciona la ignición del motor diésel. En una **expansión** adiabática el gas se enfría: el aire que sube por las laderas de la Cordillera Central se expande, se enfría y forma nubes. En el diagrama $P$–$V$, la curva adiabática es más empinada que la isoterma que pasa por el mismo punto.

## Ciclos

Si un gas recorre un **ciclo** y vuelve a su estado inicial, $\Delta U = 0$ y por tanto $Q_{neto} = W_{neto}$. El trabajo neto es el **área encerrada** por el ciclo en el diagrama $P$–$V$: positiva si se recorre en sentido horario. Esta es la base de las máquinas térmicas de la próxima lección.

## Errores frecuentes

- Usar $\Delta U = Q + W$ con $W$ hecho por el gas.
- Pensar que «isotérmico» significa «sin calor». Sin calor es adiabático; en el isotérmico sí hay calor, igual al trabajo.
- Olvidar convertir litros a $\mathrm{m^3}$ o kPa a Pa al calcular el trabajo.

## Límites del modelo

Las áreas en el diagrama $P$–$V$ solo tienen sentido si el proceso es lo bastante lento para que el gas tenga en todo momento una presión bien definida (proceso cuasiestático). En una explosión o en una expansión brusca hacia el vacío, el gas no pasa por estados de equilibrio y no se puede dibujar su camino.`,
  formulas: [
    {
      name: 'Primera ley de la termodinámica',
      latex: String.raw`\Delta U = Q - W`,
      description: 'Conservación de la energía: Q es el calor recibido por el sistema y W el trabajo hecho POR el sistema.',
      variables: [
        { symbol: String.raw`\Delta U`, meaning: 'Cambio de energía interna', unit: 'J' },
        { symbol: String.raw`Q`, meaning: 'Calor recibido por el sistema (negativo si lo cede)', unit: 'J' },
        { symbol: String.raw`W`, meaning: 'Trabajo hecho POR el gas (negativo si es comprimido)', unit: 'J' },
      ],
    },
    {
      name: 'Trabajo a presión constante',
      latex: String.raw`W = P\,\Delta V = P\,(V_f - V_i)`,
      description: 'Área del rectángulo bajo una recta horizontal en el diagrama P–V.',
      variables: [
        { symbol: String.raw`P`, meaning: 'Presión (constante)', unit: 'Pa' },
        { symbol: String.raw`\Delta V`, meaning: 'Cambio de volumen', unit: 'm³' },
      ],
    },
    {
      name: 'Trabajo en un tramo recto',
      latex: String.raw`W = \tfrac{1}{2}\,(P_i + P_f)\,(V_f - V_i)`,
      description: 'Área del trapecio bajo un segmento recto del diagrama P–V.',
      variables: [{ symbol: String.raw`P_i,\,P_f`, meaning: 'Presiones al inicio y al final del tramo', unit: 'Pa' }],
    },
    {
      name: 'Casos particulares',
      latex: String.raw`\text{isocórico: } W = 0;\quad \text{isotérmico (gas ideal): } \Delta U = 0;\quad \text{adiabático: } Q = 0;\quad \text{ciclo: } \Delta U = 0`,
      description: 'Lo que se anula en cada proceso elemental.',
      variables: [{ symbol: String.raw`\Delta U,\,Q,\,W`, meaning: 'Como en la primera ley', unit: 'J' }],
    },
  ],
  examples: [
    {
      title: 'Calor y trabajo',
      statement: String.raw`Un gas recibe $500\,\mathrm{J}$ de calor y, al expandirse, realiza $200\,\mathrm{J}$ de trabajo sobre un émbolo. ¿Cuánto cambia su energía interna?`,
      steps: [
        String.raw`Signos: entra calor, $Q = +500\,\mathrm{J}$; el gas hace trabajo, $W = +200\,\mathrm{J}$.`,
        String.raw`$\Delta U = Q - W = 500 - 200 = 300\,\mathrm{J}$.`,
      ],
      result: String.raw`$\Delta U = +300\,\mathrm{J}$.`,
      interpretation: 'De los 500 J recibidos, 200 J salen como trabajo y 300 J se quedan como energía interna: si es un gas ideal, su temperatura sube.',
    },
    {
      title: 'Expansión isobárica',
      statement: String.raw`Un gas a presión constante de $2.0\times10^{5}\,\mathrm{Pa}$ se expande de $0.010\,\mathrm{m^3}$ a $0.025\,\mathrm{m^3}$ mientras recibe $7500\,\mathrm{J}$ de calor. Calcule el trabajo y el cambio de energía interna.`,
      steps: [
        String.raw`$W = P\,\Delta V = (2.0\times10^{5}\,\mathrm{Pa})(0.025 - 0.010)\,\mathrm{m^3} = 3000\,\mathrm{J}$.`,
        String.raw`$\Delta U = Q - W = 7500 - 3000 = 4500\,\mathrm{J}$.`,
      ],
      result: String.raw`$W = 3.0\,\mathrm{kJ}$ y $\Delta U = 4.5\,\mathrm{kJ}$.`,
      interpretation: 'El trabajo es el área del rectángulo bajo la recta horizontal. Es positivo porque el gas se expande.',
    },
    {
      title: 'Un tramo recto en el diagrama P–V',
      statement: String.raw`Un gas pasa en línea recta, en el diagrama $P$–$V$, del estado $(0.010\,\mathrm{m^3},\,300\,\mathrm{kPa})$ al estado $(0.030\,\mathrm{m^3},\,100\,\mathrm{kPa})$. ¿Qué trabajo realiza?`,
      steps: [
        String.raw`El área bajo el segmento es un trapecio de bases $300\,\mathrm{kPa}$ y $100\,\mathrm{kPa}$ y ancho $\Delta V = 0.020\,\mathrm{m^3}$.`,
        String.raw`$W = \tfrac{1}{2}(3.0\times10^{5} + 1.0\times10^{5})\,\mathrm{Pa} \times 0.020\,\mathrm{m^3} = 4000\,\mathrm{J}$.`,
      ],
      result: String.raw`$W = 4.0\,\mathrm{kJ}$.`,
      interpretation:
        'Comprobación: el resultado está entre el área del rectángulo bajo la presión menor (2000 J) y el de la presión mayor (6000 J).',
    },
  ],
  simulation: null,
  exercises: [
    {
      id: 'b6-pl-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['primera-ley-termodinamica-enunciado'],
      prompt: String.raw`El gas de un cilindro recibe $1200\,\mathrm{J}$ de calor y, al expandirse, realiza $450\,\mathrm{J}$ de trabajo sobre el émbolo. ¿Cuál es el cambio de su energía interna?`,
      format: 'numeric',
      unitHint: 'J',
    },
    {
      id: 'b6-pl-02',
      category: 'grafica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['primera-ley-termodinamica-trabajo-pv'],
      prompt: String.raw`La gráfica muestra el proceso que sigue un gas en un diagrama $P$–$V$, desde $V = 2\,\mathrm{L}$ hasta $V = 6\,\mathrm{L}$. ¿Qué trabajo realiza el gas? Exprese el resultado en joules.`,
      format: 'numeric',
      unitHint: 'J',
      figure: {
        kind: 'line',
        title: 'Diagrama P–V',
        x: { label: 'V', unit: 'L' },
        y: { label: 'P', unit: 'kPa' },
        series: [
          {
            name: 'Proceso',
            points: [
              [2, 150],
              [3, 150],
              [4, 150],
              [5, 150],
              [6, 150],
            ],
          },
        ],
      },
    },
    {
      id: 'b6-pl-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['primera-ley-termodinamica-procesos'],
      prompt: String.raw`**Verdadero o falso:** en una expansión isotérmica de un gas ideal no hay intercambio de calor con los alrededores. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b6-pl-04',
      category: 'seleccion',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['primera-ley-termodinamica-procesos', 'primera-ley-termodinamica-enunciado'],
      prompt: String.raw`Al inflar un neumático de bicicleta, el aire dentro de la bomba se comprime tan rápido que prácticamente no intercambia calor. ¿Qué ocurre con ese aire durante la compresión?`,
      format: 'choice',
      options: [
        String.raw`$Q = 0$, $W < 0$ y $\Delta U > 0$: su temperatura sube.`,
        String.raw`$Q = 0$, $W > 0$ y $\Delta U < 0$: su temperatura baja.`,
        String.raw`$\Delta U = 0$ porque no entra calor, así que su temperatura no cambia.`,
        String.raw`$W = 0$ porque no hay calor, así que nada cambia.`,
      ],
    },
    {
      id: 'b6-pl-05',
      category: 'grafica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['primera-ley-termodinamica-trabajo-pv', 'primera-ley-termodinamica-enunciado'],
      prompt: String.raw`Un gas ideal sigue el proceso recto de la gráfica, desde el estado A ($1\,\mathrm{L}$, $400\,\mathrm{kPa}$) hasta el estado B ($4\,\mathrm{L}$, $100\,\mathrm{kPa}$). ¿Cuánto calor recibe el gas en este proceso? (Sugerencia: compare la temperatura de A y la de B.)`,
      format: 'numeric',
      unitHint: 'J',
      figure: {
        kind: 'line',
        title: 'Proceso A → B',
        x: { label: 'V', unit: 'L' },
        y: { label: 'P', unit: 'kPa' },
        series: [
          {
            name: 'A → B',
            points: [
              [1, 400],
              [2, 300],
              [3, 200],
              [4, 100],
            ],
          },
        ],
      },
    },
    {
      id: 'b6-pl-06',
      category: 'numerica',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['primera-ley-termodinamica-enunciado'],
      prompt: String.raw`Un émbolo comprime un gas haciendo sobre él un trabajo de $250\,\mathrm{J}$; durante la compresión el gas cede $100\,\mathrm{J}$ de calor al ambiente. ¿Cuál es el cambio de energía interna del gas?`,
      format: 'numeric',
      unitHint: 'J',
    },
    {
      id: 'b6-pl-07',
      category: 'error',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['primera-ley-termodinamica-enunciado', 'primera-ley-termodinamica-trabajo-pv'],
      prompt: String.raw`Un estudiante resolvió así: *«Un gas a presión constante de $2.0\times10^{5}\,\mathrm{Pa}$ se expande de $3.0\,\mathrm{L}$ a $5.0\,\mathrm{L}$ y recibe $1000\,\mathrm{J}$ de calor. Halle $\Delta U$.»*

1. Trabajo hecho por el gas: $W = P\,\Delta V$.
2. $\Delta V = 5.0 - 3.0 = 2.0\,\mathrm{L} = 2.0\times10^{-3}\,\mathrm{m^3}$.
3. $W = (2.0\times10^{5})(2.0\times10^{-3}) = 400\,\mathrm{J}$.
4. $\Delta U = Q + W = 1000 + 400 = 1400\,\mathrm{J}$.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'No hay ningún error'],
    },
    {
      id: 'b6-pl-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['primera-ley-termodinamica-procesos', 'primera-ley-termodinamica-trabajo-pv', 'primera-ley-termodinamica-enunciado'],
      prompt: String.raw`Un gas ideal recorre el ciclo rectangular A → B → C → D → A en el diagrama $P$–$V$, con A $= (1\,\mathrm{L},\,100\,\mathrm{kPa})$, B $= (1\,\mathrm{L},\,300\,\mathrm{kPa})$, C $= (3\,\mathrm{L},\,300\,\mathrm{kPa})$ y D $= (3\,\mathrm{L},\,100\,\mathrm{kPa})$. (a) Dibuje el ciclo y nombre el tipo de proceso de cada tramo. (b) Calcule el trabajo hecho por el gas en cada tramo, con su signo. (c) Calcule el trabajo neto y el calor neto del ciclo, y justifique con la primera ley. (d) Indique en qué tramos aumenta la temperatura del gas y explique cómo lo sabe.`,
      format: 'open',
    },
  ],
};
