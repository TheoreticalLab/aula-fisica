import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'segunda-ley-termodinamica',
  title: 'Segunda ley de la termodinámica y entropía',
  summary:
    'El calor fluye espontáneamente de lo caliente a lo frío, y ninguna máquina convierte todo el calor en trabajo. La eficiencia máxima es la de Carnot, e = 1 − Tc/Th; la entropía mide la dirección de los procesos.',
  concepts: [
    { slug: 'segunda-ley-termodinamica-enunciados', name: 'Enunciados de Kelvin–Planck y de Clausius' },
    { slug: 'segunda-ley-termodinamica-maquinas', name: 'Máquinas térmicas, eficiencia y ciclo de Carnot' },
    { slug: 'segunda-ley-termodinamica-refrigeradores', name: 'Refrigeradores y coeficiente de rendimiento' },
    { slug: 'segunda-ley-termodinamica-entropia', name: 'Entropía: ΔS = Q/T a temperatura constante' },
  ],
  theory: String.raw`## Lo que la primera ley no dice

La primera ley afirma que la energía se conserva, pero no dice **en qué sentido** ocurren los procesos. Un café caliente se enfría en la mesa; nunca se ha visto que una taza de café tibio se caliente sola tomando energía del aire, aunque eso no violaría la conservación de la energía. Un carro que frena convierte su energía cinética en energía interna de los frenos; los frenos calientes nunca devuelven esa energía para poner el carro en marcha. La **segunda ley de la termodinámica** recoge esta asimetría de la naturaleza.

## Dos enunciados equivalentes

- **Enunciado de Clausius:** el calor no fluye espontáneamente de un cuerpo frío a uno caliente. Para lograrlo hace falta suministrar trabajo, como hace un refrigerador.
- **Enunciado de Kelvin–Planck:** es imposible construir una máquina que, funcionando en ciclo, convierta **íntegramente** en trabajo el calor tomado de una sola fuente. Siempre hay que ceder parte del calor a una fuente más fría.

Se puede demostrar que si uno de los enunciados fallara, el otro también fallaría: son dos caras de la misma ley.

## Máquinas térmicas

Una **máquina térmica** funciona en ciclos: toma calor $Q_h$ de una fuente caliente a temperatura $T_h$ (la combustión en un motor, el vapor en una central eléctrica), realiza un trabajo $W$ y cede calor $|Q_c|$ a una fuente fría a $T_c$ (el aire, el agua del mar o de un río). Como en un ciclo $\Delta U = 0$, la primera ley da

$$W = Q_h - |Q_c| .$$

La **eficiencia** (o rendimiento) es la fracción del calor absorbido que se convierte en trabajo:

$$e = \frac{W}{Q_h} = 1 - \frac{|Q_c|}{Q_h} .$$

Por el enunciado de Kelvin–Planck, $|Q_c|$ nunca es cero, así que $e < 1$ (menos del $100\,\%$). Un motor de gasolina típico tiene $e \approx 0.25$–$0.30$; una central térmica moderna, alrededor de $0.40$. El resto de la energía sale como calor por el escape y el radiador, o por las torres de enfriamiento.

## El ciclo de Carnot: el límite máximo

Sadi Carnot demostró en 1824 que ninguna máquina que opere entre dos fuentes a $T_h$ y $T_c$ puede superar la eficiencia de una máquina ideal, reversible, que hoy lleva su nombre:

$$e_{Carnot} = 1 - \frac{T_c}{T_h} ,$$

con las temperaturas en **kelvin**. Esta fórmula dice algo profundo: la eficiencia máxima depende **solo de las temperaturas** de las fuentes, no del tipo de máquina ni de la sustancia de trabajo. Para mejorarla hay que aumentar $T_h$ o disminuir $T_c$. Por eso las centrales trabajan con vapor a más de $500\,^\circ\mathrm{C}$. Las máquinas reales, con fricción y pérdidas de calor, siempre quedan por debajo del límite de Carnot.

> **Error frecuente.** Usar grados Celsius en la eficiencia de Carnot. Entre $327\,^\circ\mathrm{C}$ y $27\,^\circ\mathrm{C}$, la eficiencia máxima es $1 - 300/600 = 0.50$, no $1 - 27/327 \approx 0.92$.

## Refrigeradores y aires acondicionados

Un **refrigerador** es una máquina térmica funcionando al revés: con un trabajo $W$ (el del compresor) extrae calor $Q_c$ del interior frío y cede $|Q_h| = Q_c + W$ al exterior caliente. Por eso la parte trasera de una nevera, o la unidad exterior de un aire acondicionado, expulsa aire caliente. Su desempeño se mide con el **coeficiente de rendimiento**

$$\mathrm{COP} = \frac{Q_c}{W} ,$$

que puede ser mayor que 1. Un aire acondicionado con COP $= 3$ extrae 3 J de calor de la habitación por cada joule de electricidad. Su máximo teórico es $\mathrm{COP}_{Carnot} = T_c/(T_h - T_c)$, mayor cuanto menor sea la diferencia de temperaturas.

## Entropía

Para expresar la segunda ley de forma cuantitativa se define la **entropía** $S$, una propiedad del estado del sistema. Cuando un sistema recibe un calor $Q$ de forma reversible y **a temperatura constante** $T$ (en kelvin), su entropía cambia en

$$\Delta S = \frac{Q}{T} ,$$

en $\mathrm{J/K}$. Si recibe calor, su entropía aumenta; si lo cede, disminuye. Al fundirse $1\,\mathrm{kg}$ de hielo a $0\,^\circ\mathrm{C}$, $\Delta S = 3.34\times10^{5}\,\mathrm{J}/273.15\,\mathrm{K} \approx 1.22\times10^{3}\,\mathrm{J/K}$: el agua líquida es un estado más desordenado que el hielo.

La segunda ley, en términos de entropía, dice: **en un sistema aislado, la entropía total nunca disminuye**; aumenta en todo proceso irreversible y se mantiene constante solo en los ideales reversibles. Cuando una cantidad de calor $Q$ pasa de una fuente caliente a otra fría, la fuente caliente pierde $Q/T_h$ y la fría gana $Q/T_c$, que es mayor porque $T_c < T_h$: la entropía total aumenta. El proceso contrario la haría disminuir, y por eso no ocurre solo.

La entropía puede disminuir en una parte del sistema (el agua que se congela en la nevera), siempre que aumente más en otra parte (el aire de la cocina que recibe el calor expulsado).

## Límites del modelo

La fórmula $\Delta S = Q/T$ solo vale cuando la temperatura del sistema se mantiene constante, como en un cambio de fase o en una fuente muy grande; si $T$ cambia, el cálculo requiere herramientas más avanzadas. La máquina de Carnot es una idealización: necesitaría funcionar infinitamente despacio y no produciría potencia útil.`,
  formulas: [
    {
      name: 'Eficiencia de una máquina térmica',
      latex: String.raw`e = \frac{W}{Q_h} = 1 - \frac{|Q_c|}{Q_h}`,
      description: 'Fracción del calor absorbido que se convierte en trabajo en cada ciclo.',
      variables: [
        { symbol: String.raw`W`, meaning: 'Trabajo neto por ciclo', unit: 'J' },
        { symbol: String.raw`Q_h`, meaning: 'Calor absorbido de la fuente caliente', unit: 'J' },
        { symbol: String.raw`|Q_c|`, meaning: 'Calor cedido a la fuente fría', unit: 'J' },
        { symbol: String.raw`e`, meaning: 'Eficiencia (0 ≤ e < 1)', unit: '— (adimensional)' },
      ],
    },
    {
      name: 'Eficiencia de Carnot',
      latex: String.raw`e_{Carnot} = 1 - \frac{T_c}{T_h}`,
      description: 'Eficiencia máxima posible de una máquina que opera entre dos fuentes.',
      variables: [
        { symbol: String.raw`T_h`, meaning: 'Temperatura absoluta de la fuente caliente', unit: 'K' },
        { symbol: String.raw`T_c`, meaning: 'Temperatura absoluta de la fuente fría', unit: 'K' },
      ],
      notes: 'Temperaturas siempre en kelvin.',
    },
    {
      name: 'Coeficiente de rendimiento de un refrigerador',
      latex: String.raw`\mathrm{COP} = \frac{Q_c}{W}, \qquad |Q_h| = Q_c + W`,
      description: 'Calor extraído del foco frío por cada joule de trabajo suministrado.',
      variables: [
        { symbol: String.raw`Q_c`, meaning: 'Calor extraído del interior frío', unit: 'J' },
        { symbol: String.raw`W`, meaning: 'Trabajo suministrado (compresor)', unit: 'J' },
        { symbol: String.raw`|Q_h|`, meaning: 'Calor expulsado al exterior', unit: 'J' },
      ],
    },
    {
      name: 'Cambio de entropía a temperatura constante',
      latex: String.raw`\Delta S = \frac{Q}{T}`,
      description: 'Cambio de entropía de un sistema que recibe el calor Q a temperatura absoluta constante.',
      variables: [
        { symbol: String.raw`\Delta S`, meaning: 'Cambio de entropía', unit: 'J/K' },
        { symbol: String.raw`Q`, meaning: 'Calor recibido (negativo si se cede)', unit: 'J' },
        { symbol: String.raw`T`, meaning: 'Temperatura absoluta (constante)', unit: 'K' },
      ],
    },
  ],
  examples: [
    {
      title: 'Eficiencia de un motor',
      statement: String.raw`En cada ciclo, un motor absorbe $2000\,\mathrm{J}$ de calor de la combustión y cede $1400\,\mathrm{J}$ al ambiente. Calcule el trabajo por ciclo y la eficiencia.`,
      steps: [
        String.raw`$W = Q_h - |Q_c| = 2000 - 1400 = 600\,\mathrm{J}$.`,
        String.raw`$e = \dfrac{W}{Q_h} = \dfrac{600}{2000} = 0.30$.`,
      ],
      result: String.raw`$W = 600\,\mathrm{J}$ y $e = 0.30 = 30\,\%$.`,
      interpretation: 'Es un valor típico de un motor de gasolina: el 70 % de la energía del combustible termina como calor en el escape y el radiador.',
    },
    {
      title: 'Límite de una central térmica',
      statement: String.raw`Una central produce vapor a $540\,^\circ\mathrm{C}$ y lo condensa con agua de mar a $30\,^\circ\mathrm{C}$. ¿Cuál es la máxima eficiencia posible?`,
      steps: [
        String.raw`Temperaturas absolutas: $T_h = 813.15\,\mathrm{K}$, $T_c = 303.15\,\mathrm{K}$.`,
        String.raw`$e_{Carnot} = 1 - \dfrac{303.15}{813.15} = 1 - 0.373 = 0.627$.`,
      ],
      result: String.raw`$e_{max} \approx 0.63 = 63\,\%$.`,
      interpretation:
        'Las centrales reales rondan el 35–45 %, por debajo del límite de Carnot por la fricción, las pérdidas de calor y porque sus ciclos no son reversibles.',
    },
    {
      title: 'Entropía al fundir hielo',
      statement: String.raw`Calcule el cambio de entropía de $1.0\,\mathrm{kg}$ de hielo que se funde a $0\,^\circ\mathrm{C}$ ($L_f = 3.34\times10^{5}\,\mathrm{J/kg}$).`,
      steps: [
        String.raw`Calor recibido: $Q = m\,L_f = 3.34\times10^{5}\,\mathrm{J}$, a temperatura constante $T = 273.15\,\mathrm{K}$.`,
        String.raw`$\Delta S = \dfrac{Q}{T} = \dfrac{3.34\times10^{5}\,\mathrm{J}}{273.15\,\mathrm{K}} = 1.22\times10^{3}\,\mathrm{J/K}$.`,
      ],
      result: String.raw`$\Delta S \approx +1.22\times10^{3}\,\mathrm{J/K}$.`,
      interpretation:
        'Es positivo: el sistema recibe calor y pasa a un estado más desordenado. Si el agua se congelara, su entropía disminuiría en la misma cantidad, y la del entorno que recibe el calor aumentaría al menos eso.',
    },
  ],
  simulation: null,
  exercises: [
    {
      id: 'b6-sl-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['segunda-ley-termodinamica-maquinas'],
      prompt: String.raw`En cada ciclo, una máquina térmica absorbe $5000\,\mathrm{J}$ de la fuente caliente y realiza $1500\,\mathrm{J}$ de trabajo. ¿Cuál es su eficiencia? Exprésela como fracción decimal (por ejemplo, 0.45) o como porcentaje con el signo % (por ejemplo, 45 %).`,
      format: 'numeric',
    },
    {
      id: 'b6-sl-02',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['segunda-ley-termodinamica-enunciados'],
      prompt: String.raw`**Verdadero o falso:** con suficientes avances tecnológicos (sin fricción, con aislamiento perfecto), podría construirse un motor que funcione en ciclos y convierta en trabajo todo el calor que absorbe. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b6-sl-03',
      category: 'conceptual',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['segunda-ley-termodinamica-refrigeradores'],
      prompt: String.raw`En un día caluroso, alguien deja abierta la puerta de la nevera en una cocina cerrada y aislada, con la idea de refrescarla. Al cabo de varias horas, ¿qué le ocurre a la temperatura de la cocina?`,
      format: 'choice',
      options: [
        'Baja, porque la nevera enfría el aire que entra en ella.',
        'No cambia, porque el calor que la nevera extrae por delante lo expulsa por detrás.',
        'Sube, porque la nevera expulsa por detrás el calor extraído más el trabajo del compresor.',
        'Baja al principio y luego se mantiene constante a la temperatura del interior de la nevera.',
      ],
    },
    {
      id: 'b6-sl-04',
      category: 'numerica',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['segunda-ley-termodinamica-maquinas'],
      prompt: String.raw`¿Cuál es la eficiencia máxima teórica de una máquina térmica que opera entre una fuente a $327\,^\circ\mathrm{C}$ y otra a $27\,^\circ\mathrm{C}$? Exprésela como fracción decimal o como porcentaje con el signo %.`,
      format: 'numeric',
    },
    {
      id: 'b6-sl-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['segunda-ley-termodinamica-entropia', 'segunda-ley-termodinamica-enunciados'],
      prompt: String.raw`Una cantidad de calor de $1200\,\mathrm{J}$ pasa por conducción de una fuente muy grande a $400\,\mathrm{K}$ a otra fuente muy grande a $300\,\mathrm{K}$ (las temperaturas de las fuentes no cambian apreciablemente). ¿Cuál es el cambio de entropía **total** de las dos fuentes?`,
      format: 'numeric',
      unitHint: 'J/K',
    },
    {
      id: 'b6-sl-06',
      category: 'numerica',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['segunda-ley-termodinamica-maquinas'],
      prompt: String.raw`¿Cuál es la eficiencia de Carnot de una máquina que opera entre $500\,\mathrm{K}$ y $350\,\mathrm{K}$? Exprésela como fracción decimal o como porcentaje con el signo %.`,
      format: 'numeric',
    },
    {
      id: 'b6-sl-07',
      category: 'seleccion',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['segunda-ley-termodinamica-maquinas', 'segunda-ley-termodinamica-enunciados'],
      prompt: String.raw`Un inventor asegura que su motor funciona entre una fuente a $400\,\mathrm{K}$ y el ambiente a $300\,\mathrm{K}$, y que en cada ciclo absorbe $1000\,\mathrm{J}$ y produce $400\,\mathrm{J}$ de trabajo. ¿Qué se puede afirmar?`,
      format: 'choice',
      options: [
        'Es posible, porque produce menos trabajo que el calor que absorbe.',
        'Es imposible, porque su eficiencia (40 %) supera la de Carnot entre esas temperaturas (25 %).',
        'Es posible solo si el motor no tiene fricción.',
        'Es imposible, porque violaría la primera ley de la termodinámica.',
      ],
    },
    {
      id: 'b6-sl-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['segunda-ley-termodinamica-refrigeradores', 'segunda-ley-termodinamica-entropia'],
      prompt: String.raw`Un aire acondicionado mantiene una habitación a $24\,^\circ\mathrm{C}$ mientras afuera hay $35\,^\circ\mathrm{C}$. En una hora extrae $3.6\times10^{6}\,\mathrm{J}$ de calor de la habitación y su COP real es $3.0$. (a) Calcule el trabajo que consume en una hora y su potencia media. (b) Calcule el calor que expulsa al exterior en esa hora. (c) Calcule el COP de Carnot entre esas temperaturas y compárelo con el real. (d) Calcule el cambio de entropía de la habitación y del exterior (trátelos como fuentes a temperatura constante) y verifique que la entropía total aumenta.`,
      format: 'open',
    },
  ],
};
