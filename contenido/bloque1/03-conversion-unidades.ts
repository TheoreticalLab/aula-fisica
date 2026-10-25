import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'conversion-unidades',
  title: 'Conversión de unidades',
  summary:
    'Cómo cambiar de unidad sin cambiar la magnitud: factores de conversión, cadenas de factores y conversiones de unidades compuestas, áreas, volúmenes y densidades.',
  concepts: [
    { slug: 'conv-factor-conversion', name: 'Factores de conversión' },
    { slug: 'conv-unidades-compuestas', name: 'Conversión de unidades compuestas' },
    { slug: 'conv-area-volumen', name: 'Conversión de áreas, volúmenes y densidades' },
  ],
  theory: String.raw`## Cambiar de unidad no cambia la magnitud

Una guagua que va a $72\,\mathrm{km/h}$ y una que va a $20\,\mathrm{m/s}$ se mueven exactamente igual de rápido. Al convertir unidades **no cambia la magnitud física**: solo cambian a la vez el número y la unidad con que la expresamos. Si la unidad nueva es más pequeña, el número crece; si es más grande, el número disminuye.

Convertir es imprescindible por dos razones:

- Las fórmulas del curso dan resultados coherentes si **todos los datos están en el SI** (m, kg, s y sus derivadas). Mezclar km con s, o g con m³, produce resultados absurdos.
- Los datos cotidianos llegan en muchas unidades: velocidades en km/h, volúmenes en litros o galones, masas en libras, tiempos en minutos.

## El factor de conversión es un «uno»

Una equivalencia como $1\,\mathrm{h} = 3600\,\mathrm{s}$ puede escribirse como un cociente que vale **exactamente uno**:

$$\frac{3600\,\mathrm{s}}{1\,\mathrm{h}} = 1 \qquad \text{o bien} \qquad \frac{1\,\mathrm{h}}{3600\,\mathrm{s}} = 1 .$$

Multiplicar una cantidad por $1$ no la cambia. Por eso podemos multiplicar por un **factor de conversión** tantas veces como queramos. El truco consiste en elegir la versión del factor que **cancela la unidad que queremos eliminar**: la unidad vieja debe quedar en el denominador si estaba en el numerador, y al revés.

$$2.5\,\mathrm{h}\times\frac{3600\,\mathrm{s}}{1\,\mathrm{h}} = 9000\,\mathrm{s}.$$

Las unidades se cancelan como factores algebraicos. Si al final quedan unidades extrañas (como $\mathrm{h^2/s}$), el factor se colocó al revés.

## Cadenas de factores y unidades compuestas

Para convertir unidades compuestas se encadenan varios factores, uno por cada unidad que hay que cambiar. Por ejemplo, para pasar de km/h a m/s hay que cambiar los kilómetros (numerador) y las horas (denominador):

$$72\,\frac{\mathrm{km}}{\mathrm{h}}\times\frac{1000\,\mathrm{m}}{1\,\mathrm{km}}\times\frac{1\,\mathrm{h}}{3600\,\mathrm{s}} = \frac{72\,000}{3600}\,\frac{\mathrm{m}}{\mathrm{s}} = 20\,\mathrm{m/s}.$$

Como $1000/3600 = 1/3.6$, resulta un atajo útil:

$$v\,[\mathrm{m/s}] = \frac{v\,[\mathrm{km/h}]}{3.6}, \qquad v\,[\mathrm{km/h}] = 3.6\times v\,[\mathrm{m/s}].$$

Para comprobar el sentido: el metro por segundo es una unidad **más grande** que el kilómetro por hora (recorrer un metro cada segundo es más rápido que un kilómetro cada hora), así que el número en m/s debe ser **menor**.

## Áreas y volúmenes: el factor también se eleva

Un metro cuadrado es un cuadrado de $100\,\mathrm{cm}$ de lado, de modo que contiene $100\times100 = 10^{4}$ centímetros cuadrados. En general, **si la unidad está elevada a una potencia, el factor también**:

$$1\,\mathrm{m^2} = (100\,\mathrm{cm})^2 = 10^{4}\,\mathrm{cm^2}, \qquad 1\,\mathrm{m^3} = (100\,\mathrm{cm})^3 = 10^{6}\,\mathrm{cm^3}.$$

Equivalencias de volumen que conviene recordar:

- $1\,\mathrm{L} = 1\,\mathrm{dm^3} = 1000\,\mathrm{cm^3}$ y $1\,\mathrm{mL} = 1\,\mathrm{cm^3}$.
- $1\,\mathrm{m^3} = 1000\,\mathrm{L}$: un cubo de un metro de lado contiene mil litros, como un tinaco grande.

> **Error frecuente.** Escribir $1\,\mathrm{m^3} = 100\,\mathrm{cm^3}$ o $1\,\mathrm{m^2} = 100\,\mathrm{cm^2}$. Imagine el cubo: en cada arista caben 100 cubitos de 1 cm, y el volumen tiene tres aristas.

## Densidades: g/cm³ y kg/m³

La densidad combina una masa y un volumen, así que se convierten los dos:

$$1\,\frac{\mathrm{g}}{\mathrm{cm^3}}\times\frac{1\,\mathrm{kg}}{1000\,\mathrm{g}}\times\frac{10^{6}\,\mathrm{cm^3}}{1\,\mathrm{m^3}} = 1000\,\frac{\mathrm{kg}}{\mathrm{m^3}}.$$

El agua tiene una densidad de $1.00\,\mathrm{g/cm^3} = 1000\,\mathrm{kg/m^3}$, es decir, un litro de agua tiene una masa de un kilogramo. Este dato sirve para comprobar resultados: la densidad de un sólido o un líquido común está entre unos cientos y unos veinte mil $\mathrm{kg/m^3}$; la del aire es de apenas $1.2\,\mathrm{kg/m^3}$.

## Unidades fuera del SI

Algunas equivalencias útiles (las dos primeras son exactas por definición):

- $1\,\mathrm{in} = 2.54\,\mathrm{cm}$ y $1\,\mathrm{ft} = 12\,\mathrm{in} = 30.48\,\mathrm{cm}$.
- $1\,\mathrm{mi} \approx 1.609\,\mathrm{km}$; $1\,\mathrm{lb} \approx 0.4536\,\mathrm{kg}$; $1\,\text{galón (EE. UU.)} \approx 3.785\,\mathrm{L}$.

## Cómo evitar errores

1. Escriba **siempre** las unidades en cada factor y tache las que se cancelan.
2. Antes de calcular, prevea si el número debe crecer o disminuir.
3. Al terminar, pregúntese si el resultado es razonable: una persona no camina a $50\,\mathrm{m/s}$ ni una piedra tiene una densidad de $2\,\mathrm{kg/m^3}$.
4. Las equivalencias exactas (como $1\,\mathrm{km} = 1000\,\mathrm{m}$) no limitan la precisión del resultado: la precisión la fijan los datos medidos.`,
  formulas: [
    {
      name: 'Factor de conversión',
      latex: String.raw`\frac{3600\,\mathrm{s}}{1\,\mathrm{h}} = 1`,
      description: 'Un factor de conversión es un cociente entre dos cantidades iguales expresadas en unidades distintas; vale 1 y por eso no altera la magnitud.',
      variables: [
        { symbol: String.raw`\mathrm{h}`, meaning: 'hora (unidad de partida)', unit: 'h' },
        { symbol: String.raw`\mathrm{s}`, meaning: 'segundo (unidad de llegada)', unit: 's' },
      ],
      notes: 'Se coloca de modo que la unidad que se quiere eliminar quede en el lado opuesto de la fracción y se cancele.',
    },
    {
      name: 'Rapidez: km/h y m/s',
      latex: String.raw`v\,[\mathrm{m/s}] = \frac{v\,[\mathrm{km/h}]}{3.6}`,
      description: 'Resulta de encadenar 1000 m/1 km y 1 h/3600 s; como 1000/3600 = 1/3.6, basta dividir entre 3.6.',
      variables: [
        { symbol: String.raw`v\,[\mathrm{m/s}]`, meaning: 'Valor numérico de la rapidez en metros por segundo', unit: 'm/s' },
        { symbol: String.raw`v\,[\mathrm{km/h}]`, meaning: 'Valor numérico de la rapidez en kilómetros por hora', unit: 'km/h' },
      ],
      notes: 'Para pasar de m/s a km/h, se multiplica por 3.6.',
    },
    {
      name: 'Áreas y volúmenes',
      latex: String.raw`1\,\mathrm{m^2} = 10^{4}\,\mathrm{cm^2},\qquad 1\,\mathrm{m^3} = 10^{6}\,\mathrm{cm^3} = 10^{3}\,\mathrm{L}`,
      description: 'Si la unidad está elevada a una potencia, el factor de conversión de la longitud se eleva a la misma potencia.',
      variables: [
        { symbol: String.raw`\mathrm{cm^2},\,\mathrm{m^2}`, meaning: 'Unidades de área', unit: 'cm², m²' },
        { symbol: String.raw`\mathrm{cm^3},\,\mathrm{m^3},\,\mathrm{L}`, meaning: 'Unidades de volumen (1 L = 1000 cm³)', unit: 'cm³, m³, L' },
      ],
    },
    {
      name: 'Densidad: g/cm³ y kg/m³',
      latex: String.raw`1\,\mathrm{g/cm^3} = 1000\,\mathrm{kg/m^3}`,
      description: 'Se convierten a la vez la masa (g → kg, divide entre 10³) y el volumen (cm³ → m³, divide entre 10⁶); el efecto neto es multiplicar por 1000.',
      variables: [
        { symbol: String.raw`\rho`, meaning: 'Densidad (masa por unidad de volumen)', unit: 'kg/m³ (SI) o g/cm³' },
      ],
      notes: 'Agua: 1.00 g/cm³ = 1000 kg/m³.',
    },
  ],
  examples: [
    {
      title: 'Rapidez en una autopista',
      statement: String.raw`Un automóvil circula a $90\,\mathrm{km/h}$ por la autopista Duarte. Exprese su rapidez en m/s.`,
      steps: [
        String.raw`Hay que cambiar km por m (numerador) y h por s (denominador).`,
        String.raw`Cadena de factores: $90\,\dfrac{\mathrm{km}}{\mathrm{h}}\times\dfrac{1000\,\mathrm{m}}{1\,\mathrm{km}}\times\dfrac{1\,\mathrm{h}}{3600\,\mathrm{s}}$.`,
        String.raw`Se cancelan km y h: $\dfrac{90\times1000}{3600}\,\dfrac{\mathrm{m}}{\mathrm{s}} = \dfrac{90\,000}{3600}\,\mathrm{m/s} = 25\,\mathrm{m/s}$.`,
        String.raw`Comprobación con el atajo: $90/3.6 = 25$ ✓.`,
      ],
      result: String.raw`$v = 25\,\mathrm{m/s}$.`,
      interpretation: 'El número disminuye porque el m/s es una unidad mayor que el km/h. El auto avanza 25 m cada segundo: en un segundo de distracción recorre el largo de unos seis automóviles.',
    },
    {
      title: 'Volumen de una botella',
      statement: String.raw`Una botella de refresco contiene $2.5\,\mathrm{L}$. Exprese su volumen en $\mathrm{cm^3}$ y en $\mathrm{m^3}$.`,
      steps: [
        String.raw`Con $1\,\mathrm{L} = 1000\,\mathrm{cm^3}$: $2.5\,\mathrm{L}\times\dfrac{1000\,\mathrm{cm^3}}{1\,\mathrm{L}} = 2500\,\mathrm{cm^3}$.`,
        String.raw`Con $1\,\mathrm{m^3} = 10^{6}\,\mathrm{cm^3}$: $2500\,\mathrm{cm^3}\times\dfrac{1\,\mathrm{m^3}}{10^{6}\,\mathrm{cm^3}} = 2.5\times10^{-3}\,\mathrm{m^3}$.`,
        String.raw`Comprobación directa: $1\,\mathrm{m^3} = 1000\,\mathrm{L}$, así que $2.5\,\mathrm{L} = 2.5/1000\,\mathrm{m^3} = 2.5\times10^{-3}\,\mathrm{m^3}$ ✓.`,
      ],
      result: String.raw`$V = 2500\,\mathrm{cm^3} = 2.5\times10^{-3}\,\mathrm{m^3}$.`,
      interpretation: 'El metro cúbico es una unidad enorme para una botella: se necesitarían 400 botellas como esta para llenar un cubo de un metro de lado.',
    },
    {
      title: 'Densidad y masa del agua de mar',
      statement: String.raw`El agua de mar tiene una densidad de $1.03\,\mathrm{g/cm^3}$. (a) Exprésela en $\mathrm{kg/m^3}$. (b) ¿Qué masa tienen $2.0\,\mathrm{L}$ de agua de mar?`,
      steps: [
        String.raw`(a) $1.03\,\dfrac{\mathrm{g}}{\mathrm{cm^3}}\times\dfrac{1\,\mathrm{kg}}{1000\,\mathrm{g}}\times\dfrac{10^{6}\,\mathrm{cm^3}}{1\,\mathrm{m^3}} = 1.03\times10^{3}\,\mathrm{kg/m^3} = 1030\,\mathrm{kg/m^3}$.`,
        String.raw`(b) Volumen en el SI: $V = 2.0\,\mathrm{L} = 2.0\times10^{-3}\,\mathrm{m^3}$.`,
        String.raw`Masa: $m = \rho\,V = (1030\,\mathrm{kg/m^3})(2.0\times10^{-3}\,\mathrm{m^3}) = 2.06\,\mathrm{kg} \approx 2.1\,\mathrm{kg}$.`,
      ],
      result: String.raw`(a) $\rho = 1030\,\mathrm{kg/m^3}$; (b) $m \approx 2.1\,\mathrm{kg}$.`,
      interpretation: 'Dos litros de agua dulce tendrían 2.0 kg. El agua de mar es algo más densa por las sales disueltas; por eso se flota un poco mejor en la playa que en un río.',
    },
  ],
  simulation: null,
  exercises: [
    {
      id: 'b1-conv-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['conv-unidades-compuestas'],
      prompt: String.raw`Una guagua avanza por una avenida recta a $54\,\mathrm{km/h}$ constantes. ¿Qué distancia recorre en $12\,\mathrm{s}$? Exprese el resultado en metros.`,
      format: 'numeric',
      unitHint: 'm',
    },
    {
      id: 'b1-conv-02',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['conv-factor-conversion'],
      prompt: String.raw`¿Cuál de las siguientes expresiones convierte correctamente $2.5\,\mathrm{h}$ a segundos?`,
      format: 'choice',
      options: [
        String.raw`$2.5\,\mathrm{h}\times\dfrac{1\,\mathrm{h}}{3600\,\mathrm{s}}$`,
        String.raw`$2.5\,\mathrm{h}\times\dfrac{3600\,\mathrm{s}}{1\,\mathrm{h}}$`,
        String.raw`$2.5\,\mathrm{h}\times\dfrac{60\,\mathrm{s}}{1\,\mathrm{h}}$`,
        String.raw`$\dfrac{2.5\,\mathrm{h}}{3600\,\mathrm{s}}$`,
      ],
    },
    {
      id: 'b1-conv-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['conv-area-volumen'],
      prompt: String.raw`**Verdadero o falso:** como $1\,\mathrm{m} = 100\,\mathrm{cm}$, se cumple que $1\,\mathrm{m^2} = 100\,\mathrm{cm^2}$. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b1-conv-04',
      category: 'error',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['conv-area-volumen', 'conv-factor-conversion'],
      prompt: String.raw`La densidad del hielo es $0.92\,\mathrm{g/cm^3}$. Un estudiante la convierte a $\mathrm{kg/m^3}$ así:

1. Masa: $1\,\mathrm{g} = 10^{-3}\,\mathrm{kg}$.
2. Volumen: $1\,\mathrm{cm} = 10^{-2}\,\mathrm{m}$, por lo tanto $1\,\mathrm{cm^3} = 10^{-2}\,\mathrm{m^3}$.
3. Sustitución: $0.92\,\dfrac{\mathrm{g}}{\mathrm{cm^3}} = 0.92\times\dfrac{10^{-3}\,\mathrm{kg}}{10^{-2}\,\mathrm{m^3}}$.
4. Resultado: $0.092\,\mathrm{kg/m^3}$.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'No hay ningún error'],
    },
    {
      id: 'b1-conv-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['conv-area-volumen', 'conv-unidades-compuestas'],
      prompt: String.raw`Una piscina rectangular mide $25\,\mathrm{m}$ de largo, $10\,\mathrm{m}$ de ancho y tiene una profundidad uniforme de $1.8\,\mathrm{m}$. Se llena con una manguera que entrega $40\,\mathrm{L/min}$. ¿Cuántas horas tarda en llenarse?`,
      format: 'numeric',
      unitHint: 'h',
    },
    {
      id: 'b1-conv-06',
      category: 'numerica',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['conv-unidades-compuestas'],
      prompt: String.raw`Un velocista recorre $100\,\mathrm{m}$ en $10.0\,\mathrm{s}$. ¿Cuál es su rapidez media en kilómetros por hora?`,
      format: 'numeric',
      unitHint: 'km/h',
    },
    {
      id: 'b1-conv-07',
      category: 'numerica',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['conv-area-volumen'],
      prompt: String.raw`Un bloque de aluminio tiene una masa de $54\,\mathrm{g}$ y ocupa un volumen de $20\,\mathrm{cm^3}$. Calcule su densidad en $\mathrm{kg/m^3}$.`,
      format: 'numeric',
      unitHint: 'kg/m³',
    },
    {
      id: 'b1-conv-08',
      category: 'desarrollo',
      difficulty: 'intermedio',
      role: 'bank',
      concepts: ['conv-factor-conversion', 'conv-area-volumen'],
      prompt: String.raw`Un grifo mal cerrado deja caer una gota cada $2.0\,\mathrm{s}$. Cada gota tiene un volumen de $0.050\,\mathrm{cm^3}$.
(a) ¿Cuántas gotas caen en un mes de 30 días?
(b) ¿Qué volumen de agua se pierde en ese mes? Exprese el resultado en $\mathrm{cm^3}$, en litros y en $\mathrm{m^3}$.
(c) Con una densidad del agua de $1000\,\mathrm{kg/m^3}$, ¿qué masa de agua se pierde?
Escriba cada factor de conversión con sus unidades y comente si el resultado le parece importante para un hogar.`,
      format: 'open',
    },
  ],
};
