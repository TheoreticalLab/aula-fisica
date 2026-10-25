import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'notacion-cientifica',
  title: 'Notación científica y órdenes de magnitud',
  summary:
    'Cómo escribir y operar con números muy grandes o muy pequeños, cómo comparar cantidades por su orden de magnitud y cómo hacer estimaciones razonadas.',
  concepts: [
    { slug: 'not-notacion-cientifica', name: 'Notación científica' },
    { slug: 'not-operaciones', name: 'Operaciones en notación científica' },
    { slug: 'not-orden-magnitud', name: 'Órdenes de magnitud y estimaciones' },
  ],
  theory: String.raw`## Números enormes y diminutos

La física trata con cantidades de tamaños muy dispares. La distancia de la Tierra al Sol es de unos $150\,000\,000\,000\,\mathrm{m}$; la masa de un electrón, de $0.000\,000\,000\,000\,000\,000\,000\,000\,000\,000\,911\,\mathrm{kg}$. Escritos así, estos números son difíciles de leer, de copiar sin errores y de comparar. La **notación científica** resuelve el problema.

## Forma normalizada

Un número está en notación científica cuando se escribe como

$$N = a \times 10^{n}, \qquad 1 \le |a| < 10,$$

donde $a$ es la **mantisa** (o coeficiente) y $n$ un **exponente entero**. Así:

- $150\,000\,000\,000\,\mathrm{m} = 1.5\times10^{11}\,\mathrm{m}$.
- $0.000\,0072\,\mathrm{m} = 7.2\times10^{-6}\,\mathrm{m}$.
- $9.11\times10^{-31}\,\mathrm{kg}$ es la masa del electrón.

**Regla práctica.** Desplace el punto decimal hasta que quede una sola cifra distinta de cero a su izquierda. Cuente cuántos lugares lo desplazó: ese es el valor de $|n|$. Si el número original era **mayor que 10**, el exponente es **positivo**; si era **menor que 1**, es **negativo**.

> **Error frecuente.** Escribir $45\times10^{-5}$ o $0.45\times10^{-3}$. Son números correctos (los dos valen $4.5\times10^{-4}$), pero no están en forma normalizada, porque la mantisa no está entre 1 y 10.

La notación científica también aclara **cuántas cifras son significativas**. Escribir «$1500\,\mathrm{m}$» es ambiguo: no sabemos si los ceros se midieron. En cambio, $1.5\times10^{3}\,\mathrm{m}$ tiene dos cifras significativas y $1.500\times10^{3}\,\mathrm{m}$ tiene cuatro. Lo estudiará con detalle en la lección de mediciones.

## Operaciones

Las reglas salen de las propiedades de las potencias:

- **Producto**: se multiplican las mantisas y se **suman** los exponentes. $(3.0\times10^{4})(2.0\times10^{-7}) = 6.0\times10^{-3}$.
- **Cociente**: se dividen las mantisas y se **restan** los exponentes. $\dfrac{8.0\times10^{5}}{2.0\times10^{-2}} = 4.0\times10^{7}$. Fíjese en el signo: $5 - (-2) = 7$.
- **Potencia**: se eleva la mantisa y se **multiplica** el exponente. $(2.0\times10^{3})^{3} = 8.0\times10^{9}$.
- **Raíz cuadrada**: conviene que el exponente sea par. $\sqrt{1.6\times10^{7}} = \sqrt{16\times10^{6}} = 4.0\times10^{3}$.
- **Suma y resta**: **no** se suman los exponentes. Primero se expresan los dos números con la misma potencia de 10 y luego se suman las mantisas: $2.0\times10^{3} + 5.0\times10^{2} = 2.0\times10^{3} + 0.50\times10^{3} = 2.5\times10^{3}$.

Si al terminar la mantisa no queda entre 1 y 10, se renormaliza: $12\times10^{4} = 1.2\times10^{5}$ y $0.6\times10^{-2} = 6\times10^{-3}$.

**En la calculadora**, use la tecla EXP, EE o «×10ˣ» para introducir el exponente: $3.0\times10^{8}$ se teclea 3 EXP 8. Si teclea «3 × 10 EXP 8», la calculadora entiende $3\times10\times10^{8} = 3\times10^{9}$, un error de un factor 10.

## Órdenes de magnitud

El **orden de magnitud** de una cantidad es la potencia de 10 más cercana a ella. Sirve para comparar tamaños de un vistazo: decir que dos cantidades «difieren en tres órdenes de magnitud» significa que una es unas mil veces mayor que la otra.

En una escala logarítmica, el punto medio entre $10^{n}$ y $10^{n+1}$ no es $5\times10^{n}$, sino $\sqrt{10}\times10^{n} \approx 3.16\times10^{n}$. Por eso, en este curso usaremos la regla:

- si la mantisa cumple $a < \sqrt{10} \approx 3.16$, el orden de magnitud de $a\times10^{n}$ es $10^{n}$;
- si $a \ge 3.16$, el orden de magnitud es $10^{n+1}$.

Por ejemplo, la altura de una persona ($1.7\,\mathrm{m}$) es del orden de $10^{0}\,\mathrm{m} = 1\,\mathrm{m}$, y la masa de un auto ($1.2\times10^{3}\,\mathrm{kg}$) del orden de $10^{3}\,\mathrm{kg}$. Algunos textos toman simplemente el exponente $n$, sin redondear; ambas convenciones coinciden cuando la mantisa es pequeña y solo difieren en casos de frontera, que no importan para el uso que se le da a esta idea: comparar escalas.

## Estimaciones

Muchas veces no hace falta un valor exacto, sino saber si algo es del orden de cien, de un millón o de mil millones. Una **estimación** (o problema de Fermi, por el físico Enrico Fermi, famoso por hacerlas) consiste en:

1. Descomponer la pregunta en factores que se puedan estimar.
2. Asignar a cada factor un valor redondo y razonable, **declarando las suposiciones**.
3. Operar en notación científica y quedarse con el orden de magnitud.

Ejemplo: ¿cuántos litros de agua bebe una persona en toda su vida? Unos $2\,\mathrm{L}$ al día, $365$ días al año, unos $75$ años: $2\times365\times75 \approx 5\times10^{4}\,\mathrm{L}$. El orden de magnitud es $10^{5}\,\mathrm{L}$, porque $5 > 3.16$; dicho de otro modo, decenas de miles de litros, no cientos ni millones.

Las estimaciones también sirven para **detectar errores**: si un cálculo dice que una persona bebe $10^{9}\,\mathrm{L}$ en su vida, algo ha salido mal.

## Errores frecuentes

- Sumar los exponentes al sumar dos números.
- Equivocarse de signo al dividir con exponentes negativos.
- Olvidar renormalizar la mantisa.
- Confundir $10^{-3}$ (una milésima) con $-10^{3}$ (menos mil).`,
  formulas: [
    {
      name: 'Notación científica',
      latex: String.raw`N = a \times 10^{n}, \qquad 1 \le |a| < 10`,
      description: 'Todo número real distinto de cero puede escribirse como una mantisa entre 1 y 10 multiplicada por una potencia entera de 10.',
      variables: [
        { symbol: String.raw`a`, meaning: 'Mantisa o coeficiente; sus cifras son las significativas', unit: 'la de la magnitud' },
        { symbol: String.raw`n`, meaning: 'Exponente entero (positivo si |N| ≥ 10, negativo si |N| < 1)', unit: '— (entero)' },
      ],
    },
    {
      name: 'Producto y cociente',
      latex: String.raw`(a\times10^{m})(b\times10^{n}) = ab\times10^{m+n}, \qquad \frac{a\times10^{m}}{b\times10^{n}} = \frac{a}{b}\times10^{m-n}`,
      description: 'Se operan por separado las mantisas y las potencias de 10; al final se renormaliza si hace falta.',
      variables: [
        { symbol: String.raw`a,\,b`, meaning: 'Mantisas', unit: '—' },
        { symbol: String.raw`m,\,n`, meaning: 'Exponentes enteros', unit: '—' },
      ],
    },
    {
      name: 'Potencia',
      latex: String.raw`(a\times10^{m})^{p} = a^{p}\times10^{mp}`,
      description: 'La mantisa se eleva a la potencia y el exponente se multiplica por ella.',
      variables: [
        { symbol: String.raw`p`, meaning: 'Exponente al que se eleva el número', unit: '—' },
      ],
      notes: 'Para sumas y restas no hay atajo: primero se igualan las potencias de 10.',
    },
    {
      name: 'Orden de magnitud',
      latex: String.raw`a\times10^{n} \to 10^{n} \text{ si } a < \sqrt{10} \approx 3.16; \quad 10^{n+1} \text{ si } a \ge 3.16`,
      description: 'Potencia de 10 más cercana a la cantidad en escala logarítmica.',
      variables: [
        { symbol: String.raw`a`, meaning: 'Mantisa (entre 1 y 10)', unit: '—' },
        { symbol: String.raw`n`, meaning: 'Exponente de la notación científica', unit: '—' },
      ],
    },
  ],
  examples: [
    {
      title: 'Cuántas veces es más masiva la Tierra que la Luna',
      statement: String.raw`La masa de la Tierra es $5.97\times10^{24}\,\mathrm{kg}$ y la de la Luna, $7.35\times10^{22}\,\mathrm{kg}$. ¿Cuántas veces es mayor la masa de la Tierra?`,
      steps: [
        String.raw`Planteamos el cociente: $\dfrac{5.97\times10^{24}\,\mathrm{kg}}{7.35\times10^{22}\,\mathrm{kg}}$. Las unidades se cancelan.`,
        String.raw`Mantisas: $5.97/7.35 = 0.812$. Potencias: $10^{24-22} = 10^{2}$.`,
        String.raw`Resultado: $0.812\times10^{2} = 8.12\times10^{1} = 81.2$.`,
      ],
      result: String.raw`La Tierra tiene unas $81$ veces la masa de la Luna.`,
      interpretation: 'La mantisa intermedia (0.812) no estaba entre 1 y 10, por eso se renormalizó. Comprobación rápida: 6/7 ≈ 0.86 y 10² = 100, así que el resultado debía estar cerca de 86.',
    },
    {
      title: 'Suma y potencia',
      statement: String.raw`Calcule (a) $4.6\times10^{5}\,\mathrm{m} + 2.3\times10^{4}\,\mathrm{m}$ y (b) $(3.0\times10^{-4}\,\mathrm{m})^{2}$.`,
      steps: [
        String.raw`(a) Igualamos potencias: $2.3\times10^{4} = 0.23\times10^{5}$. Sumamos mantisas: $(4.6 + 0.23)\times10^{5} = 4.83\times10^{5}\,\mathrm{m}$.`,
        String.raw`Como $4.6\times10^{5}$ solo tiene precisión hasta las décimas de $10^{5}$ (es decir, hasta $10^{4}\,\mathrm{m}$), el resultado se redondea a $4.8\times10^{5}\,\mathrm{m}$.`,
        String.raw`(b) Elevamos mantisa y multiplicamos exponente: $3.0^{2}\times10^{-4\times2} = 9.0\times10^{-8}\,\mathrm{m^2}$.`,
      ],
      result: String.raw`(a) $4.8\times10^{5}\,\mathrm{m}$; (b) $9.0\times10^{-8}\,\mathrm{m^2}$.`,
      interpretation: 'En la suma, el número pequeño apenas cambia al grande: sumarle 23 km a 460 km cambia la segunda cifra. En la potencia, la unidad también se eleva al cuadrado: el resultado es un área.',
    },
    {
      title: 'Segundos vividos',
      statement: String.raw`¿Cuántos segundos ha vivido una persona de $20$ años? Dé el resultado en notación científica y su orden de magnitud.`,
      steps: [
        String.raw`Un año tiene aproximadamente $365.25\,\mathrm{d}\times24\,\mathrm{h/d}\times3600\,\mathrm{s/h} = 3.16\times10^{7}\,\mathrm{s}$.`,
        String.raw`En 20 años: $20\times3.16\times10^{7}\,\mathrm{s} = 63.1\times10^{7}\,\mathrm{s} = 6.31\times10^{8}\,\mathrm{s}$.`,
        String.raw`Orden de magnitud: la mantisa $6.31$ es mayor que $3.16$, así que redondeamos hacia arriba: $10^{9}\,\mathrm{s}$.`,
      ],
      result: String.raw`Unos $6.3\times10^{8}\,\mathrm{s}$; orden de magnitud $10^{9}\,\mathrm{s}$.`,
      interpretation: 'Un dato útil para estimar: un año tiene unos π × 10⁷ segundos. A los 31 o 32 años, una persona cumple mil millones de segundos.',
    },
  ],
  simulation: null,
  exercises: [
    {
      id: 'b1-not-01',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['not-notacion-cientifica'],
      prompt: String.raw`Un grano de arena de playa tiene un diámetro de $0.000\,450\,\mathrm{m}$. ¿Cuál es su expresión correcta en notación científica normalizada?`,
      format: 'choice',
      options: [
        String.raw`$4.50\times10^{-4}\,\mathrm{m}$`,
        String.raw`$4.50\times10^{4}\,\mathrm{m}$`,
        String.raw`$45.0\times10^{-5}\,\mathrm{m}$`,
        String.raw`$4.50\times10^{-3}\,\mathrm{m}$`,
      ],
    },
    {
      id: 'b1-not-02',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['not-operaciones'],
      prompt: String.raw`La luz viaja a $3.00\times10^{8}\,\mathrm{m/s}$ y tarda unos $5.00\times10^{2}\,\mathrm{s}$ en llegar del Sol a la Tierra. ¿Qué distancia recorre en ese tiempo? Exprese el resultado en notación científica con el número correcto de cifras significativas.`,
      format: 'numeric',
      unitHint: 'm',
    },
    {
      id: 'b1-not-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['not-operaciones'],
      prompt: String.raw`**Verdadero o falso:** $2.0\times10^{3} + 3.0\times10^{4} = 5.0\times10^{7}$. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b1-not-04',
      category: 'error',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['not-operaciones'],
      prompt: String.raw`Un estudiante calcula el cociente $\dfrac{6.4\times10^{-3}}{1.6\times10^{5}}$ así:

1. Divide las mantisas: $6.4/1.6 = 4.0$.
2. Divide las potencias: $10^{-3}/10^{5} = 10^{-3+5} = 10^{2}$.
3. Combina los resultados: $4.0\times10^{2}$.
4. Comprueba que está normalizado, porque $1 \le 4.0 < 10$.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'No hay ningún error'],
    },
    {
      id: 'b1-not-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['not-operaciones', 'not-orden-magnitud'],
      prompt: String.raw`El radio del Sol es $6.96\times10^{8}\,\mathrm{m}$ y el de la Tierra, $6.37\times10^{6}\,\mathrm{m}$. Considerando ambos como esferas, ¿cuántas veces es mayor el **volumen** del Sol que el de la Tierra? Dé el resultado en notación científica con tres cifras significativas.`,
      format: 'numeric',
      unitHint: 'adimensional',
    },
    {
      id: 'b1-not-06',
      category: 'numerica',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['not-operaciones'],
      prompt: String.raw`Una hoja de papel tiene un espesor de $1.0\times10^{-4}\,\mathrm{m}$. ¿Qué altura alcanza una pila de $5.0\times10^{3}$ hojas? Dé el resultado con el número correcto de cifras significativas.`,
      format: 'numeric',
      unitHint: 'm',
    },
    {
      id: 'b1-not-07',
      category: 'seleccion',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['not-orden-magnitud'],
      prompt: 'El corazón de una persona en reposo late unas 70 veces por minuto. ¿Cuál es el orden de magnitud del número de latidos en un día?',
      format: 'choice',
      options: [String.raw`$10^{3}$`, String.raw`$10^{4}$`, String.raw`$10^{5}$`, String.raw`$10^{6}$`],
    },
    {
      id: 'b1-not-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['not-orden-magnitud', 'not-operaciones'],
      prompt: String.raw`Estime cuántas pelotas de béisbol cabrían en un salón de clase de $8\,\mathrm{m}\times6\,\mathrm{m}\times3\,\mathrm{m}$. Una pelota de béisbol tiene un diámetro de unos $7.4\,\mathrm{cm}$.
(a) Calcule el volumen del salón y el de una pelota (en $\mathrm{m^3}$, en notación científica).
(b) Haga una primera estimación dividiendo volúmenes.
(c) Las esferas apiladas dejan huecos entre ellas. Proponga y justifique una corrección razonable.
(d) Dé el orden de magnitud del resultado y explique por qué ese orden no depende mucho de los detalles de sus suposiciones.`,
      format: 'open',
    },
  ],
};
