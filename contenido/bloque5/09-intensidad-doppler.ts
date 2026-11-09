import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'intensidad-doppler',
  title: 'Intensidad del sonido, decibelios y efecto Doppler',
  summary:
    'La intensidad de una fuente puntual disminuye con el cuadrado de la distancia; el nivel sonoro se mide en decibelios. Si la fuente o el oyente se mueven, la frecuencia percibida cambia: efecto Doppler.',
  concepts: [
    { slug: 'intensidad-doppler-intensidad', name: 'Intensidad de una onda y ley del inverso del cuadrado' },
    { slug: 'intensidad-doppler-decibelios', name: 'Nivel de intensidad sonora en decibelios' },
    { slug: 'intensidad-doppler-efecto-doppler', name: 'Efecto Doppler' },
  ],
  theory: String.raw`## Intensidad

Una onda transporta energía. Para medir cuánta llega a un lugar se usa la **intensidad** $I$: la **potencia que atraviesa cada metro cuadrado** de superficie colocada perpendicular a la dirección de propagación. Se mide en W/m².

Consideremos una **fuente puntual** que emite sonido con potencia $P$ por igual en todas las direcciones. A una distancia $r$, esa potencia se reparte sobre la superficie de una esfera de radio $r$, cuya área es $4\pi r^2$. Por tanto,

$$I = \frac{P}{4\pi r^2} .$$

Es la **ley del inverso del cuadrado**: si la distancia se **duplica**, el área se cuadruplica y la intensidad se reduce a la **cuarta parte**; si la distancia se triplica, a la novena parte. Por eso el sonido de un concierto se debilita tan rápido al alejarse del escenario. La misma ley vale para la luz de un bombillo.

> **Cuidado.** La intensidad no es la potencia. La potencia (W) es una propiedad de la fuente; la intensidad (W/m²) depende de dónde está el receptor.

## El oído y la escala de decibelios

El oído humano es asombroso: percibe intensidades desde unos $I_0 = 1\times10^{-12}\,\mathrm{W/m^2}$ (el **umbral de audición**, a $1000\,\mathrm{Hz}$) hasta cerca de $1\,\mathrm{W/m^2}$ (el **umbral de dolor**): ¡un factor de un billón! Además, nuestra sensación de volumen no crece en proporción a la intensidad: un sonido diez veces más intenso no nos parece diez veces más fuerte, sino aproximadamente el doble.

Por ambas razones se usa una escala **logarítmica**, el **nivel de intensidad sonora** $\beta$, medido en **decibelios** (dB):

$$\beta = 10\,\log\frac{I}{I_0}, \qquad I_0 = 1\times10^{-12}\,\mathrm{W/m^2},$$

donde $\log$ es el logaritmo en base 10. Algunas consecuencias:

- En el umbral de audición, $I = I_0$ y $\beta = 10\log 1 = 0\,\mathrm{dB}$. (Cero decibelios no es «silencio absoluto», sino lo mínimo que se oye.)
- **Cada factor 10 en la intensidad suma 10 dB.** Un factor 100 suma 20 dB; un factor 1000, 30 dB.
- **Duplicar la intensidad suma unos 3 dB** ($10\log 2 = 3.0$). Dos motores iguales funcionando juntos suenan 3 dB más que uno.
- **Duplicar la distancia** a una fuente puntual divide la intensidad entre 4 y **resta unos 6 dB** ($10\log 4 = 6.0$).

Para despejar la intensidad a partir del nivel: $I = I_0 \cdot 10^{\beta/10}$.

| Sonido | Nivel aproximado |
|---|---|
| Umbral de audición | 0 dB |
| Susurro | 20–30 dB |
| Conversación normal | 60 dB |
| Tráfico intenso de una avenida | 80–85 dB |
| Discoteca, concierto, bocina de un colmado a todo volumen | 100–110 dB |
| Umbral de dolor | 120 dB |

La exposición prolongada a más de unos $85\,\mathrm{dB}$ daña el oído de forma permanente. Por eso se recomienda protección auditiva en talleres y fábricas, y moderar el volumen de los audífonos.

## El efecto Doppler

Cuando una ambulancia se acerca con la sirena encendida, se oye más **aguda** que cuando está detenida; al pasar y alejarse, se oye más **grave**. Este cambio de frecuencia por el movimiento de la fuente o del receptor es el **efecto Doppler**.

**Fuente en movimiento.** La fuente emite una cresta en cada período, pero entre una cresta y la siguiente se ha desplazado. Delante de ella, las crestas quedan más juntas (menor $\lambda$); detrás, más separadas. Como la rapidez del sonido en el aire no cambia, al receptor de delante le llegan más crestas por segundo: frecuencia mayor. Para una fuente que se mueve con rapidez $v_s$ en línea recta **hacia** un receptor en reposo:

$$f' = f\,\frac{v}{v - v_s} \quad \text{(acercándose)}, \qquad f' = f\,\frac{v}{v + v_s} \quad \text{(alejándose)}.$$

**Receptor en movimiento.** Si es el receptor quien se mueve con rapidez $v_o$ hacia una fuente en reposo, la longitud de onda no cambia, pero el receptor «sale al encuentro» de las crestas y las recibe más seguido:

$$f' = f\,\frac{v + v_o}{v} \quad \text{(acercándose)}, \qquad f' = f\,\frac{v - v_o}{v} \quad \text{(alejándose)}.$$

En todas las fórmulas $v$ es la rapidez del sonido en el aire (en reposo) y las rapideces se toman positivas. Una regla para no equivocarse con los signos: **acercamiento → frecuencia mayor; alejamiento → frecuencia menor.**

> **Error frecuente.** Creer que, mientras la ambulancia se acerca a velocidad constante, el tono sube cada vez más. No: mientras se acerca en línea recta hacia el oyente, la frecuencia percibida es **constante** (más aguda que la emitida); cambia bruscamente a un valor más grave cuando pasa. Lo que sí aumenta al acercarse es la **intensidad**.

El efecto Doppler tiene muchas aplicaciones: los radares de velocidad de la policía, los radares meteorológicos que miden la velocidad del viento en un huracán, las ecografías Doppler que miden la velocidad de la sangre y, con la luz, la medición de la velocidad con que se alejan las galaxias.

## Límites del modelo

La ley del inverso del cuadrado supone una fuente puntual que emite igual en todas direcciones y un espacio sin obstáculos ni absorción; en una sala, las reflexiones en las paredes la modifican. Las fórmulas del efecto Doppler aquí presentadas valen para movimientos en la línea que une fuente y receptor, con rapideces menores que la del sonido y sin viento.`,
  formulas: [
    {
      name: 'Intensidad de una fuente puntual',
      latex: String.raw`I = \frac{P}{4\pi r^2}`,
      description: 'La potencia se reparte sobre una esfera de radio r: ley del inverso del cuadrado.',
      variables: [
        { symbol: String.raw`I`, meaning: 'Intensidad', unit: 'W/m²' },
        { symbol: String.raw`P`, meaning: 'Potencia de la fuente', unit: 'W' },
        { symbol: String.raw`r`, meaning: 'Distancia a la fuente', unit: 'm' },
      ],
    },
    {
      name: 'Nivel de intensidad sonora',
      latex: String.raw`\beta = 10\,\log\frac{I}{I_0}`,
      description: 'Escala logarítmica: cada factor 10 en la intensidad suma 10 dB.',
      variables: [
        { symbol: String.raw`\beta`, meaning: 'Nivel de intensidad sonora', unit: 'dB' },
        { symbol: String.raw`I_0`, meaning: 'Intensidad de referencia (umbral de audición), 1 × 10⁻¹² W/m²', unit: 'W/m²' },
      ],
      notes: 'Para despejar: I = I₀ · 10^(β/10).',
    },
    {
      name: 'Efecto Doppler: fuente en movimiento',
      latex: String.raw`f' = f\,\frac{v}{v \mp v_s}`,
      description: 'Signo − si la fuente se acerca al receptor; signo + si se aleja.',
      variables: [
        { symbol: String.raw`f'`, meaning: 'Frecuencia percibida', unit: 'Hz' },
        { symbol: String.raw`f`, meaning: 'Frecuencia emitida', unit: 'Hz' },
        { symbol: String.raw`v`, meaning: 'Rapidez del sonido', unit: 'm/s' },
        { symbol: String.raw`v_s`, meaning: 'Rapidez de la fuente', unit: 'm/s' },
      ],
    },
    {
      name: 'Efecto Doppler: receptor en movimiento',
      latex: String.raw`f' = f\,\frac{v \pm v_o}{v}`,
      description: 'Signo + si el receptor se acerca a la fuente; signo − si se aleja.',
      variables: [
        { symbol: String.raw`v_o`, meaning: 'Rapidez del receptor (observador)', unit: 'm/s' },
      ],
    },
  ],
  examples: [
    {
      title: 'Intensidad y nivel cerca de un altavoz',
      statement: String.raw`Un altavoz emite $20\,\mathrm{W}$ de potencia sonora por igual en todas direcciones. Calcule la intensidad y el nivel sonoro a $10\,\mathrm{m}$.`,
      steps: [
        String.raw`$I = \dfrac{P}{4\pi r^2} = \dfrac{20\,\mathrm{W}}{4\pi (10\,\mathrm{m})^2} = \dfrac{20}{1257}\,\mathrm{W/m^2} = 1.59\times10^{-2}\,\mathrm{W/m^2}$.`,
        String.raw`$\dfrac{I}{I_0} = \dfrac{1.59\times10^{-2}}{1\times10^{-12}} = 1.59\times10^{10}$.`,
        String.raw`$\beta = 10\log(1.59\times10^{10}) = 10\,(10.20) = 102\,\mathrm{dB}$.`,
      ],
      result: String.raw`$I = 1.6\times10^{-2}\,\mathrm{W/m^2}$ y $\beta \approx 102\,\mathrm{dB}$.`,
      interpretation: 'El nivel de una discoteca. A 20 m la intensidad sería la cuarta parte y el nivel, unos 96 dB.',
    },
    {
      title: 'Sumar fuentes iguales',
      statement: String.raw`Un generador eléctrico produce $80\,\mathrm{dB}$ en el patio de una casa. ¿Qué nivel se tendría con dos generadores iguales funcionando a la vez? ¿Y con diez?`,
      steps: [
        String.raw`Las **intensidades** se suman: dos generadores dan $2I$; diez, $10I$. Los decibelios no se suman directamente.`,
        String.raw`Dos: $\beta_2 = 10\log\dfrac{2I}{I_0} = 10\log 2 + 10\log\dfrac{I}{I_0} = 3.0 + 80 = 83\,\mathrm{dB}$.`,
        String.raw`Diez: $\beta_{10} = 10\log 10 + 80 = 10 + 80 = 90\,\mathrm{dB}$.`,
      ],
      result: String.raw`$83\,\mathrm{dB}$ con dos y $90\,\mathrm{dB}$ con diez.`,
      interpretation: 'Dos generadores no dan 160 dB. Para subir 10 dB hacen falta diez fuentes iguales.',
    },
    {
      title: 'Sirena de una ambulancia',
      statement: String.raw`Una ambulancia emite una sirena de $800\,\mathrm{Hz}$ y se mueve a $30\,\mathrm{m/s}$ por una avenida recta. Un peatón está parado en la acera, en la línea de la avenida. Con $v = 343\,\mathrm{m/s}$, ¿qué frecuencia oye mientras la ambulancia se acerca y mientras se aleja?`,
      steps: [
        String.raw`Acercándose (fuente en movimiento, signo −): $f' = 800\,\dfrac{343}{343 - 30}\,\mathrm{Hz} = 800\,\dfrac{343}{313}\,\mathrm{Hz} = 877\,\mathrm{Hz}$.`,
        String.raw`Alejándose (signo +): $f' = 800\,\dfrac{343}{343 + 30}\,\mathrm{Hz} = 800\,\dfrac{343}{373}\,\mathrm{Hz} = 736\,\mathrm{Hz}$.`,
      ],
      result: String.raw`$877\,\mathrm{Hz}$ al acercarse y $736\,\mathrm{Hz}$ al alejarse.`,
      interpretation: 'Comprobación: al acercarse la frecuencia es mayor que la emitida y al alejarse, menor. El salto de unos 140 Hz al pasar la ambulancia es muy notorio para el oído.',
    },
  ],
  simulation: null,
  exercises: [
    {
      id: 'b5-dop-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['intensidad-doppler-intensidad'],
      prompt: String.raw`Una fuente puntual emite $0.50\,\mathrm{W}$ de potencia sonora uniformemente en todas direcciones. ¿Cuál es la intensidad a $5.0\,\mathrm{m}$ de ella?`,
      format: 'numeric',
      unitHint: 'W/m²',
    },
    {
      id: 'b5-dop-02',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['intensidad-doppler-decibelios'],
      prompt: String.raw`En una oficina, la intensidad del sonido es $1.0\times10^{-5}\,\mathrm{W/m^2}$. ¿Cuál es el nivel de intensidad sonora? Escriba **solo el número** de decibelios.`,
      format: 'numeric',
      unitHint: 'dB (solo el número)',
    },
    {
      id: 'b5-dop-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['intensidad-doppler-intensidad'],
      prompt: String.raw`**Verdadero o falso:** si una persona duplica su distancia a una fuente puntual de sonido, la intensidad que recibe se reduce a la mitad. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b5-dop-04',
      category: 'numerica',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['intensidad-doppler-efecto-doppler'],
      prompt: String.raw`Un carro se acerca en línea recta a $25\,\mathrm{m/s}$ hacia una persona parada en la carretera, tocando una bocina de $500\,\mathrm{Hz}$. Con $v = 343\,\mathrm{m/s}$, ¿qué frecuencia oye la persona?`,
      format: 'numeric',
      unitHint: 'Hz',
    },
    {
      id: 'b5-dop-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['intensidad-doppler-decibelios', 'intensidad-doppler-intensidad'],
      prompt: String.raw`Un altavoz, que puede considerarse una fuente puntual, produce un nivel de $96\,\mathrm{dB}$ a $3.0\,\mathrm{m}$. ¿Qué nivel produce a $12\,\mathrm{m}$? Escriba **solo el número** de decibelios.`,
      format: 'numeric',
      unitHint: 'dB (solo el número)',
    },
    {
      id: 'b5-dop-06',
      category: 'conceptual',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['intensidad-doppler-efecto-doppler'],
      prompt: 'Un tren se acerca a velocidad constante a un cruce tocando su silbato, pasa frente a una persona parada junto a la vía y se aleja. ¿Qué oye la persona?',
      format: 'choice',
      options: [
        'Un tono cada vez más agudo mientras el tren se acerca, y cada vez más grave mientras se aleja.',
        'Un tono constante más agudo que el emitido mientras se acerca, que pasa a un tono constante más grave cuando se aleja.',
        'Siempre el mismo tono que emite el silbato, solo que más fuerte cuando el tren está cerca.',
        'Un tono más grave mientras se acerca y más agudo mientras se aleja.',
      ],
    },
    {
      id: 'b5-dop-07',
      category: 'grafica',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['intensidad-doppler-intensidad'],
      prompt: 'Con un sonómetro se midió la intensidad del sonido de una fuente puntual a distintas distancias. Use la gráfica para determinar la potencia sonora de la fuente.',
      format: 'numeric',
      unitHint: 'W',
      figure: {
        kind: 'line',
        title: 'Intensidad frente a la distancia',
        x: { label: 'r', unit: 'm' },
        y: { label: 'I', unit: 'W/m²' },
        series: [{ name: 'I(r)', points: [[1, 0.159], [2, 0.0398], [3, 0.0177], [4, 0.00995], [5, 0.00637]] }],
      },
    },
    {
      id: 'b5-dop-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['intensidad-doppler-intensidad', 'intensidad-doppler-decibelios', 'intensidad-doppler-efecto-doppler'],
      prompt: String.raw`En un concierto al aire libre se miden $110\,\mathrm{dB}$ a $5.0\,\mathrm{m}$ de una torre de altavoces (considérela una fuente puntual).

(a) Calcule la intensidad a esa distancia y la potencia sonora de la torre. (b) ¿A qué distancia mínima debe estar una persona para que el nivel no supere $85\,\mathrm{dB}$? (c) Un ciclista se acerca a la torre a $15\,\mathrm{m/s}$ mientras suena una nota de $600\,\mathrm{Hz}$. ¿Qué frecuencia percibe ($v = 343\,\mathrm{m/s}$)? (d) Explique por qué los niveles en decibelios de dos fuentes no se suman directamente. Explique cada paso.`,
      format: 'open',
    },
  ],
};
