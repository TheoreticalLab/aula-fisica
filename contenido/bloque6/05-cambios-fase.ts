import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'cambios-fase',
  title: 'Cambios de fase y calor latente',
  summary:
    'Durante una fusión o una ebullición la sustancia absorbe calor sin cambiar de temperatura. Ese calor latente vale Q = mL, y en una curva de calentamiento aparece como un tramo horizontal.',
  concepts: [
    { slug: 'cambios-fase-calor-latente', name: 'Calor latente de fusión y de vaporización: Q = mL' },
    { slug: 'cambios-fase-curva-calentamiento', name: 'Curvas de calentamiento' },
    { slug: 'cambios-fase-mezclas-hielo', name: 'Balances de energía con cambios de fase' },
  ],
  theory: String.raw`## Fases de la materia

La misma sustancia puede presentarse como **sólido**, **líquido** o **gas** (vapor), según su temperatura y su presión. El agua es el ejemplo más familiar: hielo en el congelador, líquido en el vaso y vapor sobre la olla del arroz. Los nombres de los cambios son:

- **Fusión** (sólido → líquido) y **solidificación** (líquido → sólido).
- **Vaporización** (líquido → gas), que puede ser **evaporación** en la superficie a cualquier temperatura o **ebullición** en todo el volumen, y **condensación** (gas → líquido).
- **Sublimación** (sólido → gas), como el «hielo seco» de dióxido de carbono, y su inversa, la deposición.

## Calor sin cambio de temperatura

Ponga al fuego una olla con hielo picado y un termómetro. Mientras queda hielo, el termómetro marca $0\,^\circ\mathrm{C}$ aunque la llama siga entregando energía. Cuando se derrite el último trozo, la temperatura empieza a subir. Al llegar a $100\,^\circ\mathrm{C}$ (a nivel del mar), el agua hierve y la temperatura vuelve a quedarse fija hasta que se evapora toda.

¿A dónde va la energía si la temperatura no cambia? Se usa para **romper o debilitar las uniones** entre moléculas: aumenta la energía potencial de interacción, no la energía cinética media. Por eso la energía interna aumenta aunque la temperatura no lo haga. A esa energía se la llama **calor latente** («oculto»), porque no se manifiesta como un aumento de temperatura.

El calor necesario para cambiar de fase una masa $m$ a temperatura constante es

$$Q = \pm\,m\,L ,$$

donde $L$ es el **calor latente** de la transición, en $\mathrm{J/kg}$. Se usa el signo $+$ cuando la sustancia absorbe calor (fusión, vaporización) y $-$ cuando lo cede (solidificación, condensación): la energía que se necesita para fundir un kilogramo de hielo es la misma que se libera al congelar un kilogramo de agua.

Para el agua a presión atmosférica:

- Fusión a $0\,^\circ\mathrm{C}$: $L_f = 3.34\times10^{5}\,\mathrm{J/kg}$.
- Vaporización a $100\,^\circ\mathrm{C}$: $L_v = 2.26\times10^{6}\,\mathrm{J/kg}$.
- Calores específicos: hielo $2100$, agua líquida $4186$, vapor $\approx 2010\,\mathrm{J/(kg\cdot K)}$.

$L_v$ es casi siete veces $L_f$: separar las moléculas por completo, como ocurre en el vapor, cuesta mucha más energía que desordenar la estructura del hielo. Para comparar: fundir $1\,\mathrm{kg}$ de hielo requiere la misma energía que calentar $1\,\mathrm{kg}$ de agua unos $80\,^\circ\mathrm{C}$.

> **Error frecuente.** Usar $Q = m\,c\,\Delta T$ durante el cambio de fase. Allí $\Delta T = 0$, y la fórmula daría cero calor, lo cual es falso.

## Curvas de calentamiento

Si una muestra recibe calor a ritmo constante y se representa su temperatura frente al calor absorbido, se obtiene una **curva de calentamiento** formada por tramos:

1. **Tramos inclinados:** una sola fase cambia de temperatura. La pendiente es $\Delta T/Q = 1/(m\,c)$: cuanto **menor** el calor específico, **más empinado** el tramo.
2. **Tramos horizontales (mesetas):** coexisten dos fases a temperatura constante. La **longitud** de la meseta en el eje del calor es $m\,L$.

Para el hielo calentado hasta vapor, la curva tiene cinco tramos: hielo que se calienta, fusión, agua que se calienta, ebullición y vapor que se calienta. El calor total es la suma de los calores de cada tramo.

## El sudor y la quemadura de vapor

La evaporación absorbe calor de lo que la rodea. Por eso el sudor nos refresca: cada gramo de agua que se evapora de la piel se lleva unos $2.4\,\mathrm{kJ}$ (a la temperatura de la piel, $L_v$ es algo mayor que a $100\,^\circ\mathrm{C}$). En un día húmedo del Caribe el sudor se evapora con dificultad y la sensación de calor es mayor. A la inversa, el vapor a $100\,^\circ\mathrm{C}$ quema mucho más que el agua a $100\,^\circ\mathrm{C}$: al condensarse sobre la piel cede su calor latente, y solo después se enfría como agua.

## Mezclas con hielo

En un balance $\sum Q = 0$ con hielo hay que añadir el término $m\,L_f$ del hielo que se funde. Conviene comprobar primero **si se funde todo**: se compara el calor que puede ceder el líquido al enfriarse hasta $0\,^\circ\mathrm{C}$ con el que necesita el hielo para fundirse. Si no alcanza, la temperatura final es $0\,^\circ\mathrm{C}$ y queda hielo sin fundir.

## Límites del modelo

Las temperaturas de cambio de fase dependen de la presión: en la cima del Pico Duarte, a unos $3100\,\mathrm{m}$, el agua hierve cerca de $90\,^\circ\mathrm{C}$, y en una olla de presión por encima de $100\,^\circ\mathrm{C}$. Los valores de $L$ dados valen a presión atmosférica normal. Además, la evaporación ocurre a cualquier temperatura, y un líquido muy puro puede enfriarse por debajo de su punto de congelación sin solidificarse (sobreenfriamiento).`,
  formulas: [
    {
      name: 'Calor latente',
      latex: String.raw`Q = \pm\,m\,L`,
      description: 'Calor absorbido (+) o cedido (−) durante un cambio de fase, a temperatura constante.',
      variables: [
        { symbol: String.raw`Q`, meaning: 'Calor transferido', unit: 'J' },
        { symbol: String.raw`m`, meaning: 'Masa que cambia de fase', unit: 'kg' },
        { symbol: String.raw`L`, meaning: 'Calor latente (de fusión L_f o de vaporización L_v)', unit: 'J/kg' },
      ],
      notes: 'Agua: L_f = 3.34 × 10⁵ J/kg; L_v = 2.26 × 10⁶ J/kg.',
    },
    {
      name: 'Calor total en varias etapas',
      latex: String.raw`Q_{total} = m\,c_{hielo}\,\Delta T_1 + m\,L_f + m\,c_{agua}\,\Delta T_2 + \dots`,
      description: 'Se suma el calor de cada tramo de la curva de calentamiento: tramos con ΔT (mcΔT) y mesetas (mL).',
      variables: [
        { symbol: String.raw`c_{hielo},\,c_{agua}`, meaning: 'Calores específicos de cada fase', unit: 'J/(kg·K)' },
        { symbol: String.raw`\Delta T_1,\,\Delta T_2`, meaning: 'Cambios de temperatura en cada fase', unit: 'K' },
      ],
    },
  ],
  examples: [
    {
      title: 'Fundir hielo',
      statement: String.raw`¿Cuánto calor se necesita para fundir $0.50\,\mathrm{kg}$ de hielo que ya está a $0\,^\circ\mathrm{C}$?`,
      steps: [
        String.raw`El hielo está a la temperatura de fusión: solo hay cambio de fase, $Q = m\,L_f$.`,
        String.raw`$Q = (0.50\,\mathrm{kg})(3.34\times10^{5}\,\mathrm{J/kg}) = 1.67\times10^{5}\,\mathrm{J}$.`,
      ],
      result: String.raw`$Q = 1.67\times10^{5}\,\mathrm{J}$.`,
      interpretation:
        'Con esa misma energía se podría calentar medio kilogramo de agua líquida unos 80 °C: fundir hielo es «caro» en energía, por eso el hielo enfría tan bien las bebidas.',
    },
    {
      title: 'Del congelador al agua tibia',
      statement: String.raw`¿Cuánto calor hay que darle a $0.20\,\mathrm{kg}$ de hielo a $-10\,^\circ\mathrm{C}$ para convertirlo en agua a $30\,^\circ\mathrm{C}$?`,
      steps: [
        String.raw`Tramo 1, el hielo se calienta hasta $0\,^\circ\mathrm{C}$: $Q_1 = (0.20)(2100)(10) = 4200\,\mathrm{J}$.`,
        String.raw`Tramo 2, fusión a $0\,^\circ\mathrm{C}$: $Q_2 = (0.20)(3.34\times10^{5}) = 66\,800\,\mathrm{J}$.`,
        String.raw`Tramo 3, el agua se calienta de $0$ a $30\,^\circ\mathrm{C}$: $Q_3 = (0.20)(4186)(30) = 25\,116\,\mathrm{J}$.`,
        String.raw`Total: $Q = 4200 + 66\,800 + 25\,116 = 96\,116\,\mathrm{J}$.`,
      ],
      result: String.raw`$Q \approx 9.6\times10^{4}\,\mathrm{J}$.`,
      interpretation: 'La fusión aporta casi el 70 % del total, aunque en ese tramo la temperatura no cambia.',
    },
    {
      title: 'Hielo en un jugo',
      statement: String.raw`Se echan $0.050\,\mathrm{kg}$ de hielo a $0\,^\circ\mathrm{C}$ en $0.30\,\mathrm{kg}$ de jugo ($c \approx 4186\,\mathrm{J/(kg\cdot K)}$) a $25\,^\circ\mathrm{C}$, en un vaso aislado. ¿Cuál es la temperatura final?`,
      steps: [
        String.raw`¿Se funde todo? El jugo puede ceder, al enfriarse hasta $0\,^\circ\mathrm{C}$, $(0.30)(4186)(25) = 31\,395\,\mathrm{J}$. Fundir el hielo requiere $(0.050)(3.34\times10^{5}) = 16\,700\,\mathrm{J}$. Alcanza: se funde todo y $T_f > 0$.`,
        String.raw`Balance: $\underbrace{(0.050)(3.34\times10^{5})}_{\text{fusión}} + \underbrace{(0.050)(4186)(T_f - 0)}_{\text{agua de deshielo}} + \underbrace{(0.30)(4186)(T_f - 25)}_{\text{jugo}} = 0$.`,
        String.raw`$16\,700 + 209.3\,T_f + 1255.8\,T_f - 31\,395 = 0 \Rightarrow 1465.1\,T_f = 14\,695 \Rightarrow T_f = 10.0\,^\circ\mathrm{C}$.`,
      ],
      result: String.raw`$T_f \approx 10\,^\circ\mathrm{C}$.`,
      interpretation:
        'Si se añadiera la misma masa de agua a 0 °C en lugar de hielo, el jugo solo bajaría a unos 21 °C: la mayor parte del enfriamiento se debe al calor latente.',
    },
  ],
  simulation: null,
  exercises: [
    {
      id: 'b6-fase-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['cambios-fase-calor-latente'],
      prompt: String.raw`¿Cuánto calor se necesita para evaporar por completo $0.40\,\mathrm{kg}$ de agua que ya está hirviendo a $100\,^\circ\mathrm{C}$? Use $L_v = 2.26\times10^{6}\,\mathrm{J/kg}$.`,
      format: 'numeric',
      unitHint: 'J',
    },
    {
      id: 'b6-fase-02',
      category: 'grafica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['cambios-fase-curva-calentamiento'],
      prompt: String.raw`La gráfica es la curva de calentamiento de $0.20\,\mathrm{kg}$ de una sustancia que empieza en estado sólido y recibe calor a presión constante. ¿Cuánto calor absorbe la muestra mientras se funde? Exprese el resultado en kJ.`,
      format: 'numeric',
      unitHint: 'kJ',
      figure: {
        kind: 'line',
        title: 'Curva de calentamiento',
        x: { label: 'Q', unit: 'kJ' },
        y: { label: 'T', unit: '°C' },
        series: [
          {
            name: 'T(Q)',
            points: [
              [0, 20],
              [15.6, 80],
              [45.6, 80],
              [59.2, 120],
            ],
          },
        ],
      },
    },
    {
      id: 'b6-fase-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['cambios-fase-calor-latente', 'cambios-fase-curva-calentamiento'],
      prompt: String.raw`**Verdadero o falso:** mientras el agua hierve a presión atmosférica, si se sube la llama de la estufa su temperatura sigue aumentando por encima de $100\,^\circ\mathrm{C}$. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b6-fase-04',
      category: 'conceptual',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['cambios-fase-calor-latente'],
      prompt: String.raw`Una quemadura con vapor de agua a $100\,^\circ\mathrm{C}$ suele ser mucho más grave que una con la misma masa de agua líquida a $100\,^\circ\mathrm{C}$. ¿Por qué?`,
      format: 'choice',
      options: [
        'Porque el vapor está a mayor temperatura que el agua líquida.',
        'Porque el vapor, al condensarse sobre la piel, cede su calor latente de vaporización además del calor que cede al enfriarse.',
        'Porque el vapor tiene mayor calor específico que el agua líquida.',
        'Porque el vapor penetra en la piel y el agua líquida no.',
      ],
    },
    {
      id: 'b6-fase-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['cambios-fase-calor-latente', 'cambios-fase-curva-calentamiento'],
      prompt: String.raw`Se sacan $0.15\,\mathrm{kg}$ de hielo de un congelador a $-18\,^\circ\mathrm{C}$. ¿Cuánto calor deben absorber para convertirse en agua a $25\,^\circ\mathrm{C}$? Datos: $c_{hielo} = 2100\,\mathrm{J/(kg\cdot K)}$, $L_f = 3.34\times10^{5}\,\mathrm{J/kg}$, $c_{agua} = 4186\,\mathrm{J/(kg\cdot K)}$.`,
      format: 'numeric',
      unitHint: 'J',
    },
    {
      id: 'b6-fase-06',
      category: 'numerica',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['cambios-fase-calor-latente'],
      prompt: String.raw`¿Cuánto calor hay que extraer de $2.0\,\mathrm{kg}$ de agua a $0\,^\circ\mathrm{C}$ para congelarla por completo? Dé la magnitud. Use $L_f = 3.34\times10^{5}\,\mathrm{J/kg}$.`,
      format: 'numeric',
      unitHint: 'J',
    },
    {
      id: 'b6-fase-07',
      category: 'grafica',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['cambios-fase-curva-calentamiento', 'cambios-fase-calor-latente'],
      prompt: String.raw`La gráfica es la curva de calentamiento de $0.20\,\mathrm{kg}$ de una sustancia que empieza en estado sólido. A partir de ella, determine el calor latente de fusión de la sustancia, en J/kg.`,
      format: 'numeric',
      unitHint: 'J/kg',
      figure: {
        kind: 'line',
        title: 'Curva de calentamiento',
        x: { label: 'Q', unit: 'kJ' },
        y: { label: 'T', unit: '°C' },
        series: [
          {
            name: 'T(Q)',
            points: [
              [0, 20],
              [15.6, 80],
              [45.6, 80],
              [59.2, 120],
            ],
          },
        ],
      },
    },
    {
      id: 'b6-fase-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['cambios-fase-mezclas-hielo', 'cambios-fase-calor-latente'],
      prompt: String.raw`Se echan $0.040\,\mathrm{kg}$ de hielo a $0\,^\circ\mathrm{C}$ en $0.25\,\mathrm{kg}$ de refresco ($c \approx 4186\,\mathrm{J/(kg\cdot K)}$) a $28\,^\circ\mathrm{C}$, en un vaso aislado. (a) Compruebe si se funde todo el hielo. (b) Calcule la temperatura final. (c) Compare con lo que ocurriría si se añadieran $0.040\,\mathrm{kg}$ de agua a $0\,^\circ\mathrm{C}$ y explique la diferencia. (d) Dibuje cualitativamente la gráfica temperatura–tiempo del hielo y del refresco.`,
      format: 'open',
    },
  ],
};
