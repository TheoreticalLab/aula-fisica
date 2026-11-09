import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'calorimetria',
  title: 'Calorimetría y equilibrio de mezclas',
  summary:
    'Cuando cuerpos a distinta temperatura se mezclan en un recipiente aislado, el calor que ceden unos lo absorben otros: la suma de todos los calores es cero. Así se calcula la temperatura final y se miden calores específicos.',
  concepts: [
    { slug: 'calorimetria-balance', name: 'Balance de energía en mezclas: ΣQ = 0' },
    { slug: 'calorimetria-signos', name: 'Convención de signos del calor' },
    { slug: 'calorimetria-calorimetro', name: 'El calorímetro y la medida del calor específico' },
  ],
  theory: String.raw`## La idea: la energía se conserva

Al echar cubos de agua fría en una tina de agua caliente, o una pieza de metal recién forjada en un balde, los cuerpos intercambian energía hasta alcanzar una **temperatura común de equilibrio** $T_f$. Si el conjunto está aislado de los alrededores, la energía no se crea ni se pierde: toda la energía que ceden los cuerpos calientes la absorben los fríos.

La **calorimetría** es el conjunto de técnicas para medir calores aprovechando este principio. Su herramienta es el **calorímetro**: un recipiente bien aislado (como un termo o una hielera), con un termómetro y a menudo un agitador.

## Convención de signos

Para cada cuerpo $i$ que cambia de temperatura sin cambiar de fase,

$$Q_i = m_i\,c_i\,(T_f - T_{i}) ,$$

donde $T_i$ es su temperatura inicial y $T_f$ la final común. Con esta convención:

- **$Q > 0$:** el cuerpo **absorbe** calor (se calienta, $T_f > T_i$).
- **$Q < 0$:** el cuerpo **cede** calor (se enfría, $T_f < T_i$).

El signo no se elige a mano: sale solo si se escribe siempre «final menos inicial».

## La ecuación de balance

La conservación de la energía en un sistema aislado se escribe

$$\sum Q_i = Q_1 + Q_2 + Q_3 + \dots = 0 .$$

La suma es cero porque los calores negativos (cedidos) compensan exactamente a los positivos (absorbidos). Es equivalente a decir «calor cedido = calor absorbido» tomando valores absolutos, pero la forma $\sum Q = 0$ tiene una ventaja: no hace falta adivinar de antemano qué cuerpo se enfría y cuál se calienta, y se generaliza sin esfuerzo a tres o más cuerpos.

Para **dos cuerpos** sin cambio de fase, despejando $T_f$:

$$T_f = \frac{m_1 c_1 T_1 + m_2 c_2 T_2}{m_1 c_1 + m_2 c_2} .$$

Es un **promedio ponderado** de las temperaturas iniciales, con pesos iguales a las capacidades caloríficas $m\,c$. Por eso la temperatura final siempre queda entre las dos iniciales, y más cerca de la del cuerpo con mayor capacidad calorífica. Solo si $m_1 c_1 = m_2 c_2$ la temperatura final es el promedio simple.

> **Comprobación útil.** Si la temperatura final que obtiene no está entre la mayor y la menor de las iniciales, hay un error de signos (o un cambio de fase que no se tuvo en cuenta).

## Ejemplos cotidianos

- Al preparar un baño para un bebé se mezcla agua de la llave con agua hervida. Si las masas son iguales, la temperatura queda a mitad de camino; si se usa el triple de agua fría, queda mucho más cerca de la fría.
- Una piedra caliente echada en un sancocho apenas cambia su temperatura: el caldo, con mucha más masa y mayor calor específico, domina el promedio.
- En la cocina, una cuchara de metal dentro de una taza de chocolate caliente alcanza casi la temperatura del chocolate y apenas lo enfría.

## Medir un calor específico

Para medir el calor específico de un metal, se calienta una muestra de masa $m_m$ hasta una temperatura conocida $T_m$ (por ejemplo, en agua hirviendo) y se sumerge en una masa conocida de agua $m_a$ a temperatura $T_a$ dentro del calorímetro. Se agita y se mide $T_f$. Del balance,

$$m_m c_m (T_f - T_m) + m_a c_a (T_f - T_a) = 0 \;\Rightarrow\; c_m = \frac{m_a c_a (T_f - T_a)}{m_m (T_m - T_f)} .$$

Si el recipiente interior del calorímetro también cambia de temperatura, se añade su término $m_r c_r (T_f - T_a)$ a la suma: es un cuerpo más del sistema.

## Errores frecuentes

- Calcular la temperatura final como promedio simple cuando las masas o los materiales son distintos.
- Escribir algunos $\Delta T$ como «inicial menos final» y otros como «final menos inicial», con lo que la suma deja de tener sentido.
- Olvidar el recipiente cuando su capacidad calorífica no es despreciable.
- Aplicar $Q = m\,c\,\Delta T$ cuando hay hielo que se funde: en ese caso hay que añadir el calor latente, como veremos en la próxima lección.

## Límites del modelo

Ningún calorímetro es perfectamente aislante: siempre hay algún intercambio de calor con el aire, que se reduce haciendo la medida rápido y tapando el recipiente. Además se supone que el equilibrio se alcanza y que todo el sistema queda a una sola temperatura, lo que exige agitar la mezcla.`,
  formulas: [
    {
      name: 'Calor de cada cuerpo',
      latex: String.raw`Q_i = m_i\,c_i\,(T_f - T_i)`,
      description: 'Positivo si el cuerpo absorbe calor; negativo si lo cede. Siempre «final menos inicial».',
      variables: [
        { symbol: String.raw`Q_i`, meaning: 'Calor absorbido por el cuerpo i', unit: 'J' },
        { symbol: String.raw`m_i`, meaning: 'Masa del cuerpo i', unit: 'kg' },
        { symbol: String.raw`c_i`, meaning: 'Calor específico del cuerpo i', unit: 'J/(kg·K)' },
        { symbol: String.raw`T_i,\,T_f`, meaning: 'Temperatura inicial del cuerpo y final común', unit: '°C o K' },
      ],
    },
    {
      name: 'Balance en un sistema aislado',
      latex: String.raw`\sum Q_i = 0`,
      description: 'La energía que ceden unos cuerpos la absorben otros.',
      variables: [{ symbol: String.raw`\sum Q_i`, meaning: 'Suma de los calores de todos los cuerpos del sistema', unit: 'J' }],
    },
    {
      name: 'Temperatura final de dos cuerpos',
      latex: String.raw`T_f = \frac{m_1 c_1 T_1 + m_2 c_2 T_2}{m_1 c_1 + m_2 c_2}`,
      description: 'Promedio de las temperaturas ponderado por las capacidades caloríficas. Solo sin cambios de fase.',
      variables: [
        { symbol: String.raw`T_1,\,T_2`, meaning: 'Temperaturas iniciales', unit: '°C o K' },
        { symbol: String.raw`m_1 c_1,\,m_2 c_2`, meaning: 'Capacidades caloríficas de cada cuerpo', unit: 'J/K' },
      ],
    },
  ],
  examples: [
    {
      title: 'Mezcla de agua caliente y fría',
      statement: String.raw`Se mezclan $0.20\,\mathrm{kg}$ de agua a $80\,^\circ\mathrm{C}$ con $0.30\,\mathrm{kg}$ de agua a $20\,^\circ\mathrm{C}$ en un termo. ¿Cuál es la temperatura final?`,
      steps: [
        String.raw`Balance: $(0.20)(4186)(T_f - 80) + (0.30)(4186)(T_f - 20) = 0$.`,
        String.raw`El calor específico es el mismo y se cancela: $0.20\,T_f - 16 + 0.30\,T_f - 6 = 0$.`,
        String.raw`$0.50\,T_f = 22 \Rightarrow T_f = 44\,^\circ\mathrm{C}$.`,
        String.raw`Comprobación de signos: $Q_{cal} = (0.20)(4186)(44 - 80) = -3.01\times10^{4}\,\mathrm{J}$ (cede) y $Q_{fría} = (0.30)(4186)(44 - 20) = +3.01\times10^{4}\,\mathrm{J}$ (absorbe). Suman cero ✓.`,
      ],
      result: String.raw`$T_f = 44\,^\circ\mathrm{C}$.`,
      interpretation:
        'No es el promedio simple (50 °C): hay más agua fría, así que el resultado queda más cerca de 20 °C.',
    },
    {
      title: 'Medida del calor específico de un metal',
      statement: String.raw`Una pieza metálica de $0.100\,\mathrm{kg}$ a $100.0\,^\circ\mathrm{C}$ se sumerge en $0.200\,\mathrm{kg}$ de agua a $20.0\,^\circ\mathrm{C}$ dentro de un calorímetro de capacidad despreciable. La temperatura final es $24.0\,^\circ\mathrm{C}$. Halle el calor específico del metal.`,
      steps: [
        String.raw`Calor absorbido por el agua: $Q_a = (0.200)(4186)(24.0 - 20.0) = 3349\,\mathrm{J}$.`,
        String.raw`Del balance, $Q_m = -Q_a = -3349\,\mathrm{J}$: $(0.100)\,c_m\,(24.0 - 100.0) = -3349$.`,
        String.raw`$c_m = \dfrac{-3349\,\mathrm{J}}{(0.100\,\mathrm{kg})(-76.0\,\mathrm{K})} = 441\,\mathrm{J/(kg\cdot K)}$.`,
      ],
      result: String.raw`$c_m \approx 4.4\times10^{2}\,\mathrm{J/(kg\cdot K)}$.`,
      interpretation: 'El valor es cercano al del hierro (450 J/(kg·K)); la pequeña diferencia puede atribuirse a pérdidas de calor del calorímetro.',
    },
    {
      title: 'Tres cuerpos: el recipiente cuenta',
      statement: String.raw`Un vaso de aluminio de $0.15\,\mathrm{kg}$ ($c = 900\,\mathrm{J/(kg\cdot K)}$) contiene $0.20\,\mathrm{kg}$ de agua; ambos están a $22\,^\circ\mathrm{C}$. Se introduce una pieza de cobre de $0.080\,\mathrm{kg}$ ($c = 385\,\mathrm{J/(kg\cdot K)}$) a $150\,^\circ\mathrm{C}$. Halle la temperatura final.`,
      steps: [
        String.raw`Capacidades caloríficas: vaso $(0.15)(900) = 135\,\mathrm{J/K}$; agua $(0.20)(4186) = 837.2\,\mathrm{J/K}$; cobre $(0.080)(385) = 30.8\,\mathrm{J/K}$.`,
        String.raw`Balance: $135\,(T_f - 22) + 837.2\,(T_f - 22) + 30.8\,(T_f - 150) = 0$.`,
        String.raw`$1003\,T_f = 972.2 \times 22 + 30.8 \times 150 = 21388 + 4620 = 26008 \Rightarrow T_f = 25.9\,^\circ\mathrm{C}$.`,
      ],
      result: String.raw`$T_f \approx 25.9\,^\circ\mathrm{C}$.`,
      interpretation:
        'Aunque el cobre estaba muy caliente, su capacidad calorífica es pequeña: la temperatura del agua sube menos de 4 °C. El vaso absorbe parte del calor y no puede ignorarse.',
    },
  ],
  simulation: null,
  exercises: [
    {
      id: 'b6-calo-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['calorimetria-balance'],
      prompt: String.raw`Para preparar un baño se mezclan $1.0\,\mathrm{kg}$ de agua a $70\,^\circ\mathrm{C}$ con $3.0\,\mathrm{kg}$ de agua a $30\,^\circ\mathrm{C}$. Despreciando las pérdidas, ¿cuál es la temperatura final de la mezcla?`,
      format: 'numeric',
      unitHint: '°C',
    },
    {
      id: 'b6-calo-02',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['calorimetria-signos'],
      prompt: String.raw`Se echa una cuchara de acero a $90\,^\circ\mathrm{C}$ en un vaso de agua a $25\,^\circ\mathrm{C}$, en un recipiente aislado. Con la convención $Q = m\,c\,(T_f - T_i)$, ¿qué signos tienen el calor de la cuchara, $Q_c$, y el del agua, $Q_a$?`,
      format: 'choice',
      options: [
        String.raw`$Q_c > 0$ y $Q_a < 0$`,
        String.raw`$Q_c < 0$ y $Q_a > 0$`,
        String.raw`Ambos positivos`,
        String.raw`Ambos negativos`,
      ],
    },
    {
      id: 'b6-calo-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['calorimetria-balance'],
      prompt: String.raw`**Verdadero o falso:** al mezclar dos cuerpos en un recipiente aislado, la temperatura final es siempre el promedio de sus temperaturas iniciales. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b6-calo-04',
      category: 'numerica',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['calorimetria-balance', 'calorimetria-signos'],
      prompt: String.raw`Una pieza de aluminio de $0.20\,\mathrm{kg}$ ($c = 900\,\mathrm{J/(kg\cdot K)}$) a $90\,^\circ\mathrm{C}$ se sumerge en $0.50\,\mathrm{kg}$ de agua ($c = 4186\,\mathrm{J/(kg\cdot K)}$) a $20\,^\circ\mathrm{C}$, en un recipiente aislado de capacidad calorífica despreciable. ¿Cuál es la temperatura final?`,
      format: 'numeric',
      unitHint: '°C',
    },
    {
      id: 'b6-calo-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['calorimetria-calorimetro'],
      prompt: String.raw`Para identificar un metal, se calienta una muestra de $0.250\,\mathrm{kg}$ hasta $95.0\,^\circ\mathrm{C}$ y se sumerge en $0.400\,\mathrm{kg}$ de agua a $22.0\,^\circ\mathrm{C}$, dentro de un calorímetro de capacidad despreciable. La temperatura de equilibrio es $26.5\,^\circ\mathrm{C}$. ¿Cuál es el calor específico del metal?`,
      format: 'numeric',
      unitHint: 'J/(kg·K)',
    },
    {
      id: 'b6-calo-06',
      category: 'numerica',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['calorimetria-balance'],
      prompt: String.raw`Se mezclan $0.30\,\mathrm{kg}$ de agua a $90\,^\circ\mathrm{C}$ con $0.20\,\mathrm{kg}$ de agua a $15\,^\circ\mathrm{C}$ en un termo. ¿Cuál es la temperatura final?`,
      format: 'numeric',
      unitHint: '°C',
    },
    {
      id: 'b6-calo-07',
      category: 'error',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['calorimetria-signos', 'calorimetria-balance'],
      prompt: String.raw`Un estudiante resolvió así: *«Se mezclan $2.0\,\mathrm{kg}$ de agua a $80\,^\circ\mathrm{C}$ con $1.0\,\mathrm{kg}$ de agua a $20\,^\circ\mathrm{C}$. Halle la temperatura final.»*

1. Balance: $Q_{cal} + Q_{fría} = 0$.
2. $Q_{cal} = (2.0)(4186)(T_f - 80)$ y $Q_{fría} = (1.0)(4186)(T_f - 20)$.
3. Se cancela 4186: $2.0\,(T_f - 80) + 1.0\,(20 - T_f) = 0$.
4. $T_f = 140\,^\circ\mathrm{C}$.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'No hay ningún error'],
    },
    {
      id: 'b6-calo-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['calorimetria-calorimetro', 'calorimetria-signos', 'calorimetria-balance'],
      prompt: String.raw`Un calorímetro tiene un vaso interior de aluminio de $0.10\,\mathrm{kg}$ ($c = 900\,\mathrm{J/(kg\cdot K)}$) con $0.20\,\mathrm{kg}$ de agua, ambos a $20\,^\circ\mathrm{C}$. Se introduce una pieza de cobre de $0.15\,\mathrm{kg}$ ($c = 385\,\mathrm{J/(kg\cdot K)}$) a $100\,^\circ\mathrm{C}$. (a) Escriba la ecuación de balance indicando el signo esperado de cada calor. (b) Calcule la temperatura final. (c) Repita el cálculo ignorando el vaso y explique por qué se obtiene una temperatura mayor. (d) Compruebe que la suma de los calores es cero.`,
      format: 'open',
    },
  ],
};
