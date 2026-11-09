import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'temperatura',
  title: 'Temperatura y equilibrio térmico',
  summary:
    'La temperatura indica si dos cuerpos en contacto intercambiarán energía. La ley cero justifica los termómetros, y las escalas Celsius, Fahrenheit y Kelvin se relacionan con fórmulas lineales.',
  concepts: [
    { slug: 'temperatura-equilibrio-termico', name: 'Equilibrio térmico y ley cero de la termodinámica' },
    { slug: 'temperatura-escalas', name: 'Escalas Celsius, Fahrenheit y Kelvin y sus conversiones' },
    { slug: 'temperatura-diferencias', name: 'Diferencias de temperatura en cada escala' },
  ],
  theory: String.raw`## ¿Qué mide la temperatura?

En la vida diaria decimos que algo está «caliente» o «frío» según lo que sentimos al tocarlo. Esa sensación engaña: una baldosa y una alfombra que llevan horas en la misma habitación están a la misma temperatura, pero la baldosa se siente más fría. La física necesita una definición que no dependa de nuestra piel.

A escala microscópica, los átomos y moléculas de cualquier cuerpo están en movimiento permanente: vibran, giran y se trasladan. La **temperatura** es una medida de la energía cinética media de ese movimiento desordenado. Cuanto mayor es la temperatura, más rápido, en promedio, se mueven las partículas.

Desde el punto de vista macroscópico, la temperatura es la magnitud que decide **hacia dónde fluye la energía** cuando dos cuerpos se ponen en contacto: la energía pasa espontáneamente del cuerpo de mayor temperatura al de menor temperatura. A esa energía en tránsito la llamaremos **calor** en la lección 3.

## Equilibrio térmico y ley cero

Si se sirve un jugo frío y se deja sobre la mesa, el jugo se calienta y el aire que lo rodea se enfría un poco, hasta que ambos alcanzan la misma temperatura. A partir de ese momento ya no hay intercambio neto de energía: decimos que están en **equilibrio térmico**.

La **ley cero de la termodinámica** afirma:

> Si dos cuerpos A y B están, cada uno por separado, en equilibrio térmico con un tercer cuerpo C, entonces A y B están en equilibrio térmico entre sí.

Parece obvia, pero es la base de todo termómetro. El termómetro hace el papel del cuerpo C: lo ponemos en contacto con A, esperamos a que alcance el equilibrio y leemos su indicación; luego hacemos lo mismo con B. Si las lecturas coinciden, sabemos que A y B no intercambiarían energía al tocarse, aunque nunca los hayamos puesto en contacto.

> **Cuidado.** Un termómetro mide **su propia** temperatura. Por eso hay que esperar a que llegue al equilibrio con el cuerpo, y conviene que sea pequeño para no alterar la temperatura de lo que mide.

## Escalas de temperatura

Un termómetro aprovecha alguna propiedad que cambia con la temperatura: la longitud de una columna de líquido, la resistencia eléctrica de un metal o la presión de un gas. Para convertir esa propiedad en un número hace falta una **escala**, definida con puntos de referencia.

- **Celsius (°C):** asigna $0\,^\circ\mathrm{C}$ a la fusión del hielo y $100\,^\circ\mathrm{C}$ a la ebullición del agua a presión atmosférica normal. Es la escala de uso diario en casi todo el mundo, incluida la República Dominicana.
- **Fahrenheit (°F):** usada en Estados Unidos. El hielo funde a $32\,^\circ\mathrm{F}$ y el agua hierve a $212\,^\circ\mathrm{F}$. Entre esos dos puntos hay $180$ grados Fahrenheit, frente a $100$ grados Celsius.
- **Kelvin (K):** es la escala **absoluta** del SI. Su cero, el **cero absoluto**, es la temperatura más baja posible, en la que la energía del movimiento térmico es mínima. Un kelvin tiene el mismo tamaño que un grado Celsius, y $0\,\mathrm{K} = -273.15\,^\circ\mathrm{C}$. En la escala Kelvin no hay temperaturas negativas y se escribe «K», sin el símbolo de grado.

Las conversiones se obtienen con una relación lineal entre escalas:

$$T_K = T_C + 273.15, \qquad T_F = 1.8\,T_C + 32 .$$

El factor $1.8 = 180/100$ compara el tamaño de los grados, y el $32$ corrige la diferencia de ceros. Para pasar de Fahrenheit a Celsius se despeja: $T_C = (T_F - 32)/1.8$.

## Temperaturas y diferencias de temperatura

Hay que distinguir una **temperatura** (un estado, «el agua está a $30\,^\circ\mathrm{C}$») de una **diferencia de temperatura** (un cambio, «el agua se calentó $30\,^\circ\mathrm{C}$»). Como el kelvin y el grado Celsius tienen el mismo tamaño,

$$\Delta T_K = \Delta T_C, \qquad \Delta T_F = 1.8\,\Delta T_C .$$

Si el día en Santiago pasa de $24\,^\circ\mathrm{C}$ a $33\,^\circ\mathrm{C}$, la temperatura subió $9\,^\circ\mathrm{C}$, es decir, $9\,\mathrm{K}$, y **no** $282.15\,\mathrm{K}$. En las diferencias, el $273.15$ y el $32$ se cancelan.

> **Error frecuente.** Sumar $273$ a una diferencia de temperatura. Solo se suma al convertir una temperatura concreta.

## ¿Cuándo es obligatorio usar kelvin?

En las fórmulas donde aparece una **diferencia** $\Delta T$ (calor, dilatación, conducción) da igual usar °C o K. En las que aparece la **temperatura misma**, multiplicando o dividiendo (gases ideales, radiación, eficiencia de Carnot), hay que usar la escala absoluta. Decir que $20\,^\circ\mathrm{C}$ es «el doble de caliente» que $10\,^\circ\mathrm{C}$ no tiene sentido: en kelvin, $293.15\,\mathrm{K}$ es apenas un $3.5\,\%$ mayor que $283.15\,\mathrm{K}$.

## Límites del modelo

La idea de una temperatura única para todo el cuerpo supone equilibrio. Una plancha recién encendida o una olla al fuego tienen temperaturas distintas en cada punto; en esos casos hablamos de la temperatura de cada región pequeña. Además, cada termómetro tiene un rango útil: el de mercurio no sirve por debajo de $-39\,^\circ\mathrm{C}$, donde el mercurio se solidifica, y para medir un horno de fundición se usan pirómetros que detectan la radiación emitida.`,
  formulas: [
    {
      name: 'Celsius a Kelvin',
      latex: String.raw`T_K = T_C + 273.15`,
      description: 'Convierte una temperatura de la escala Celsius a la escala absoluta.',
      variables: [
        { symbol: String.raw`T_K`, meaning: 'Temperatura absoluta', unit: 'K' },
        { symbol: String.raw`T_C`, meaning: 'Temperatura en grados Celsius', unit: '°C' },
      ],
      notes: 'En muchos problemas basta con 273 en lugar de 273.15.',
    },
    {
      name: 'Celsius a Fahrenheit',
      latex: String.raw`T_F = 1.8\,T_C + 32`,
      description: 'Convierte una temperatura de Celsius a Fahrenheit. Despejando: T_C = (T_F − 32)/1.8.',
      variables: [
        { symbol: String.raw`T_F`, meaning: 'Temperatura en grados Fahrenheit', unit: '°F' },
        { symbol: String.raw`T_C`, meaning: 'Temperatura en grados Celsius', unit: '°C' },
      ],
    },
    {
      name: 'Diferencias de temperatura',
      latex: String.raw`\Delta T_K = \Delta T_C, \qquad \Delta T_F = 1.8\,\Delta T_C`,
      description: 'Los cambios de temperatura no llevan los desplazamientos 273.15 y 32.',
      variables: [
        { symbol: String.raw`\Delta T_K,\,\Delta T_C`, meaning: 'Cambio de temperatura en kelvin y en grados Celsius', unit: 'K = °C' },
        { symbol: String.raw`\Delta T_F`, meaning: 'Cambio de temperatura en grados Fahrenheit', unit: '°F' },
      ],
    },
  ],
  examples: [
    {
      title: 'Una fiebre en tres escalas',
      statement: String.raw`Un termómetro clínico marca $39.5\,^\circ\mathrm{C}$. Exprese esa temperatura en kelvin y en grados Fahrenheit.`,
      steps: [
        String.raw`Kelvin: $T_K = T_C + 273.15 = 39.5 + 273.15 = 312.65\,\mathrm{K}$.`,
        String.raw`Fahrenheit: $T_F = 1.8\,T_C + 32 = 1.8(39.5) + 32 = 71.1 + 32 = 103.1\,^\circ\mathrm{F}$.`,
      ],
      result: String.raw`$T = 312.65\,\mathrm{K} \approx 313\,\mathrm{K}$ y $T = 103.1\,^\circ\mathrm{F}$.`,
      interpretation:
        'La temperatura normal del cuerpo ronda los 37 °C (98.6 °F). Una lectura de 103 °F en un termómetro estadounidense indica, igual que 39.5 °C, una fiebre alta.',
    },
    {
      title: 'Temperatura en la que coinciden Celsius y Fahrenheit',
      statement: String.raw`¿Existe una temperatura que se exprese con el mismo número en las escalas Celsius y Fahrenheit? Hállela.`,
      steps: [
        String.raw`Buscamos $T_F = T_C = x$. Sustituimos en $T_F = 1.8\,T_C + 32$: $x = 1.8\,x + 32$.`,
        String.raw`Despejamos: $x - 1.8\,x = 32 \Rightarrow -0.8\,x = 32 \Rightarrow x = -40$.`,
        String.raw`Comprobación: $1.8(-40) + 32 = -72 + 32 = -40$ ✓.`,
      ],
      result: String.raw`$-40\,^\circ\mathrm{C} = -40\,^\circ\mathrm{F}$.`,
      interpretation:
        'Las dos escalas son rectas con pendientes distintas, así que se cortan en un único punto. No existe un valor equivalente entre Celsius y Kelvin, porque esas rectas son paralelas (misma pendiente, distinto cero).',
    },
    {
      title: 'Un cambio de temperatura',
      statement: String.raw`En un día de verano en Santiago, la temperatura sube de $24\,^\circ\mathrm{C}$ a las 7:00 a $33\,^\circ\mathrm{C}$ a las 14:00. Exprese el aumento en kelvin y en grados Fahrenheit.`,
      steps: [
        String.raw`Diferencia en Celsius: $\Delta T_C = 33 - 24 = 9\,^\circ\mathrm{C}$.`,
        String.raw`En kelvin, el tamaño del grado es el mismo: $\Delta T_K = 9\,\mathrm{K}$.`,
        String.raw`En Fahrenheit: $\Delta T_F = 1.8 \times 9 = 16.2\,^\circ\mathrm{F}$ (sin sumar 32).`,
      ],
      result: String.raw`$\Delta T = 9\,\mathrm{K} = 16.2\,^\circ\mathrm{F}$.`,
      interpretation:
        'Comprobación: 24 °C = 75.2 °F y 33 °C = 91.4 °F; la diferencia es 16.2 °F, como se obtuvo directamente.',
    },
  ],
  simulation: null,
  exercises: [
    {
      id: 'b6-temp-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['temperatura-escalas'],
      prompt: String.raw`Una tarde típica en Santo Domingo alcanza $30.0\,^\circ\mathrm{C}$. Un turista estadounidense quiere saber cuánto es en su escala. Exprese esa temperatura en grados Fahrenheit.`,
      format: 'numeric',
      unitHint: '°F',
    },
    {
      id: 'b6-temp-02',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['temperatura-escalas'],
      prompt: String.raw`El nitrógeno líquido hierve a $77\,\mathrm{K}$ a presión atmosférica. Exprese esa temperatura en grados Celsius.`,
      format: 'numeric',
      unitHint: '°C',
    },
    {
      id: 'b6-temp-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['temperatura-diferencias'],
      prompt: String.raw`**Verdadero o falso:** si la temperatura de un vaso de agua aumenta $10\,^\circ\mathrm{C}$, en la escala Kelvin aumenta $283.15\,\mathrm{K}$. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b6-temp-04',
      category: 'seleccion',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['temperatura-equilibrio-termico'],
      prompt: String.raw`Un bloque de cobre A y un bloque de madera B nunca se han tocado. Se coloca un termómetro en contacto con A hasta que la lectura se estabiliza, y luego con B, también hasta estabilizarse: en ambos casos marca $26.0\,^\circ\mathrm{C}$. ¿Qué se puede concluir?`,
      format: 'choice',
      options: [
        'Si se ponen en contacto, el cobre cederá energía a la madera porque es mejor conductor.',
        'A y B están en equilibrio térmico entre sí: al ponerlos en contacto no habrá flujo neto de energía entre ellos.',
        'No se puede concluir nada sobre A y B, porque nunca estuvieron en contacto directo.',
        'A y B tienen la misma energía interna.',
      ],
    },
    {
      id: 'b6-temp-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['temperatura-escalas'],
      prompt: String.raw`Un laboratorio define una escala de temperatura «X» lineal en la que el hielo funde a $-20\,^\circ\mathrm{X}$ y el agua hierve (a presión normal) a $180\,^\circ\mathrm{X}$. Un termómetro graduado en esta escala marca $50\,^\circ\mathrm{X}$. ¿Qué temperatura es en grados Celsius?`,
      format: 'numeric',
      unitHint: '°C',
    },
    {
      id: 'b6-temp-06',
      category: 'conceptual',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['temperatura-equilibrio-termico'],
      prompt: String.raw`Al tomarse la temperatura con un termómetro clínico, se recomienda dejarlo varios minutos bajo la lengua antes de leerlo. ¿Cuál es la razón física?`,
      format: 'choice',
      options: [
        'El termómetro necesita tiempo para «absorber» la temperatura, que es una sustancia que pasa del cuerpo al termómetro.',
        'El termómetro indica su propia temperatura; hay que esperar a que alcance el equilibrio térmico con el cuerpo.',
        'La temperatura del cuerpo sube mientras el termómetro está en la boca, y hay que esperar al valor máximo.',
        'Es solo una costumbre: la lectura es la misma desde el primer segundo.',
      ],
    },
    {
      id: 'b6-temp-07',
      category: 'grafica',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['temperatura-escalas', 'temperatura-diferencias'],
      prompt: String.raw`La gráfica relaciona la lectura de un termómetro en grados Fahrenheit con la lectura en grados Celsius. A partir de la gráfica, ¿cuántos grados Fahrenheit aumenta la lectura por cada grado Celsius de aumento? (Dé solo el número.)`,
      format: 'numeric',
      figure: {
        kind: 'line',
        title: 'Temperatura en °F frente a temperatura en °C',
        x: { label: 'T_C', unit: '°C' },
        y: { label: 'T_F', unit: '°F' },
        series: [
          {
            name: 'T_F(T_C)',
            points: [
              [-40, -40],
              [0, 32],
              [20, 68],
              [50, 122],
              [100, 212],
            ],
          },
        ],
      },
    },
    {
      id: 'b6-temp-08',
      category: 'desarrollo',
      difficulty: 'intermedio',
      role: 'bank',
      concepts: ['temperatura-escalas', 'temperatura-diferencias'],
      prompt: String.raw`Un compañero afirma: «Si el agua de un vaso pasa de $10\,^\circ\mathrm{C}$ a $20\,^\circ\mathrm{C}$, su temperatura se duplicó». (a) Exprese ambas temperaturas en kelvin y calcule el cociente entre ellas. (b) Explique por qué la afirmación es incorrecta y qué significa que la escala Kelvin sea absoluta. (c) Indique el cambio de temperatura en °C, en K y en °F, y explique por qué en las diferencias no se suma 273.15 ni 32.`,
      format: 'open',
    },
  ],
};
