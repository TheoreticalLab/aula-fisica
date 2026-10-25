import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'sistema-internacional',
  title: 'El Sistema Internacional de Unidades',
  summary:
    'Las siete unidades básicas del SI, las unidades derivadas con nombre propio, los prefijos decimales y las reglas para escribir correctamente valores y símbolos.',
  concepts: [
    { slug: 'si-unidades-basicas', name: 'Unidades básicas y derivadas del SI' },
    { slug: 'si-prefijos', name: 'Prefijos del SI' },
    { slug: 'si-escritura', name: 'Reglas de escritura de unidades y símbolos' },
  ],
  theory: String.raw`## ¿Por qué un sistema único?

Durante siglos cada región tuvo sus propias unidades: varas, leguas, tareas, quintales, libras… Aún hoy en el Caribe se compran los plátanos por unidad, la gasolina por galones y el terreno por tareas, mientras que en el laboratorio se trabaja en metros y kilogramos. Esta mezcla tiene costos reales: en 1999 la sonda espacial *Mars Climate Orbiter* se perdió porque un equipo entregó datos de impulso en unidades inglesas (libra-fuerza·segundo) y otro los interpretó como si estuvieran en unidades del SI (newton·segundo), que son unas 4.45 veces más pequeñas.

El **Sistema Internacional de Unidades (SI)** es el acuerdo mundial que evita estos problemas. Es **coherente**: las unidades derivadas se obtienen de las básicas sin factores numéricos extra. Por ejemplo, $1\,\mathrm{N} = 1\,\mathrm{kg}\cdot 1\,\mathrm{m/s^2}$, sin ningún «$\times 9.8$» ni «$\times 1000$» escondido. Por eso, si todos los datos de un problema están en unidades SI, el resultado sale automáticamente en unidades SI.

## Las siete unidades básicas

- **metro (m)**, de longitud. Desde 1983 se define a partir de la rapidez de la luz: es la distancia que la luz recorre en el vacío en $1/299\,792\,458$ de segundo.
- **kilogramo (kg)**, de masa. Desde 2019 se define fijando el valor de la constante de Planck. Antes era la masa de un cilindro metálico guardado cerca de París.
- **segundo (s)**, de tiempo. Se define a partir de la frecuencia de una transición del átomo de cesio-133, que es exactamente $9\,192\,631\,770\,\mathrm{Hz}$.
- **ampere (A)**, de corriente eléctrica.
- **kelvin (K)**, de temperatura termodinámica.
- **mol (mol)**, de cantidad de sustancia.
- **candela (cd)**, de intensidad luminosa.

Hoy todas se definen a partir de **constantes de la naturaleza** con valores fijados por convenio. La ventaja es que cualquier laboratorio bien equipado del mundo puede reproducirlas sin depender de un objeto guardado en un único lugar.

## Unidades derivadas con nombre propio

Algunas combinaciones de unidades básicas se usan tanto que reciben un nombre:

- **newton**, fuerza: $1\,\mathrm{N} = 1\,\mathrm{kg\cdot m/s^2}$.
- **joule**, energía: $1\,\mathrm{J} = 1\,\mathrm{N\cdot m}$.
- **watt**, potencia: $1\,\mathrm{W} = 1\,\mathrm{J/s}$.
- **pascal**, presión: $1\,\mathrm{Pa} = 1\,\mathrm{N/m^2}$.
- **hertz**, frecuencia: $1\,\mathrm{Hz} = 1\,\mathrm{s^{-1}}$ (un ciclo por segundo).

También se aceptan junto al SI unidades de uso cotidiano como el minuto (min), la hora (h), el litro (L), la tonelada (t) y el grado Celsius (°C). Son legítimas, pero **antes de sustituir en una fórmula conviene pasarlas a unidades SI**.

## Prefijos

Los prefijos permiten expresar cantidades muy grandes o muy pequeñas sin escribir muchos ceros. Cada prefijo multiplica la unidad por una potencia de 10:

- tera (T) $= 10^{12}$; giga (G) $= 10^{9}$; mega (M) $= 10^{6}$; kilo (k) $= 10^{3}$; hecto (h) $= 10^{2}$; deca (da) $= 10^{1}$.
- deci (d) $= 10^{-1}$; centi (c) $= 10^{-2}$; mili (m) $= 10^{-3}$; micro (µ) $= 10^{-6}$; nano (n) $= 10^{-9}$; pico (p) $= 10^{-12}$.

Así, $3.2\,\mathrm{GHz} = 3.2\times10^{9}\,\mathrm{Hz}$ (la frecuencia de un procesador) y $120\,\mathrm{nm} = 1.20\times10^{-7}\,\mathrm{m}$ (el tamaño de un virus).

Dos detalles importantes:

1. **El kilogramo es la única unidad básica que ya lleva prefijo.** Los prefijos de masa se aplican al gramo: se escribe $\mathrm{mg}$ (miligramo), no «µkg».
2. **El exponente afecta también al prefijo.** $1\,\mathrm{cm^2}$ significa $(1\,\mathrm{cm})^2 = (10^{-2}\,\mathrm{m})^2 = 10^{-4}\,\mathrm{m^2}$, no $10^{-2}\,\mathrm{m^2}$.

> **Cuidado.** $\mathrm{m}$ es metro y también el prefijo mili; $\mathrm{M}$ es mega. El contexto lo aclara: en $\mathrm{mm}$ la primera m es el prefijo y la segunda la unidad. Pero $\mathrm{Mm}$ (megámetro) y $\mathrm{mm}$ (milímetro) difieren en un factor $10^9$.

## Reglas de escritura

Los símbolos del SI son **símbolos matemáticos, no abreviaturas**. Por eso:

- **No llevan punto** ni **plural**: $5\,\mathrm{kg}$, no «5 kgs» ni «5 kg.».
- **Respetan mayúsculas y minúsculas.** Se escriben en minúscula, salvo los que vienen de un nombre propio: N (Newton), Pa (Pascal), W (Watt), K (Kelvin). El litro admite L para no confundirlo con el número 1. Los prefijos desde mega hacia arriba van en mayúscula (M, G, T), y desde kilo hacia abajo en minúscula: **k** de kilo es minúscula, así que «Km» es incorrecto.
- **Se separan del número con un espacio**: $25\,\mathrm{m}$, $36\,^\circ\mathrm{C}$. La excepción son los grados de ángulo, que van pegados: $30^\circ$.
- **El prefijo va pegado a la unidad**, sin espacio ni punto: $\mathrm{km}$, $\mu\mathrm{s}$. No se combinan dos prefijos: $\mathrm{ns}$, no «mµs».
- **Productos y cocientes**: $\mathrm{N\cdot m}$ (o N m con espacio); $\mathrm{m/s}$ o $\mathrm{m\cdot s^{-1}}$. Nunca dos barras seguidas: $\mathrm{m/s^2}$, no «m/s/s».
- **Los nombres de las unidades se escriben en minúscula**, aunque procedan de un nombre propio: «tres newtons», «diez kelvin». No se mezclan nombres y símbolos: «km/hora» es incorrecto; escriba km/h o «kilómetros por hora».
- Los símbolos de uso popular como «seg», «hr», «mts» o «cc» **no** son del SI: use s, h, m y cm³ (o mL).

En este curso usamos el **punto decimal** ($3.5$). El SI admite punto o coma decimal, y recomienda agrupar las cifras largas de tres en tres con un espacio fino: $299\,792\,458$.

## Errores frecuentes

- Escribir «Kg», «KM» o «Seg».
- Olvidar que $1\,\mathrm{km^2} = 10^{6}\,\mathrm{m^2}$ (y no $10^{3}\,\mathrm{m^2}$).
- Sustituir en una fórmula datos en km, h o g sin convertirlos, y obtener un resultado que no está en unidades SI.`,
  formulas: [
    {
      name: 'Significado de un prefijo',
      latex: String.raw`1\,(\text{prefijo})\,u = 10^{n}\,u`,
      description: 'Un prefijo equivale a multiplicar la unidad por la potencia de 10 correspondiente.',
      variables: [
        { symbol: String.raw`u`, meaning: 'Unidad sin prefijo (m, g, s, W, Hz…)', unit: 'la de la magnitud' },
        { symbol: String.raw`n`, meaning: 'Exponente del prefijo (k: 3, M: 6, m: −3, µ: −6, n: −9…)', unit: '— (entero)' },
      ],
      notes: 'Ejemplos: 1 km = 10³ m; 1 µs = 10⁻⁶ s; 1 GW = 10⁹ W.',
    },
    {
      name: 'Prefijo en una unidad elevada a una potencia',
      latex: String.raw`1\,\mathrm{cm^{2}} = (10^{-2}\,\mathrm{m})^{2} = 10^{-4}\,\mathrm{m^{2}}`,
      description: 'El exponente se aplica a la unidad completa, prefijo incluido. En general, (10ⁿ u)ᵖ = 10ⁿᵖ uᵖ.',
      variables: [
        { symbol: String.raw`\mathrm{cm^2}`, meaning: 'Centímetro cuadrado (unidad de área)', unit: 'cm²' },
        { symbol: String.raw`\mathrm{m^2}`, meaning: 'Metro cuadrado (unidad SI de área)', unit: 'm²' },
      ],
      notes: 'Del mismo modo, 1 cm³ = 10⁻⁶ m³ y 1 km² = 10⁶ m².',
    },
    {
      name: 'Unidades derivadas con nombre propio',
      latex: String.raw`1\,\mathrm{N} = 1\,\mathrm{kg\cdot m/s^{2}},\quad 1\,\mathrm{J} = 1\,\mathrm{N\cdot m},\quad 1\,\mathrm{W} = 1\,\mathrm{J/s},\quad 1\,\mathrm{Hz} = 1\,\mathrm{s^{-1}}`,
      description: 'Las unidades con nombre son abreviaturas de combinaciones de unidades básicas; en el SI coherente no aparecen factores numéricos.',
      variables: [
        { symbol: String.raw`\mathrm{N}`, meaning: 'newton (fuerza)', unit: 'kg·m/s²' },
        { symbol: String.raw`\mathrm{J}`, meaning: 'joule (energía)', unit: 'kg·m²/s²' },
        { symbol: String.raw`\mathrm{W}`, meaning: 'watt (potencia)', unit: 'kg·m²/s³' },
        { symbol: String.raw`\mathrm{Hz}`, meaning: 'hertz (frecuencia)', unit: '1/s' },
      ],
    },
  ],
  examples: [
    {
      title: 'Elegir el prefijo adecuado',
      statement: String.raw`Exprese con un prefijo conveniente, de modo que el número quede entre $1$ y $1000$: (a) el diámetro de un glóbulo rojo, $0.000\,0075\,\mathrm{m}$; (b) la potencia de una planta solar pequeña, $47\,000\,\mathrm{W}$; (c) la frecuencia de un procesador, $3\,200\,000\,000\,\mathrm{Hz}$.`,
      steps: [
        String.raw`(a) $0.000\,0075\,\mathrm{m} = 7.5\times10^{-6}\,\mathrm{m}$. Como $10^{-6}$ es el prefijo micro: $7.5\,\mu\mathrm{m}$.`,
        String.raw`(b) $47\,000\,\mathrm{W} = 47\times10^{3}\,\mathrm{W}$. Como $10^{3}$ es kilo: $47\,\mathrm{kW}$.`,
        String.raw`(c) $3\,200\,000\,000\,\mathrm{Hz} = 3.2\times10^{9}\,\mathrm{Hz}$. Como $10^{9}$ es giga: $3.2\,\mathrm{GHz}$.`,
      ],
      result: String.raw`(a) $7.5\,\mu\mathrm{m}$; (b) $47\,\mathrm{kW}$; (c) $3.2\,\mathrm{GHz}$.`,
      interpretation: 'El prefijo no cambia la magnitud, solo la forma de escribirla. Elegir bien el prefijo hace que el número sea fácil de leer y de comparar.',
    },
    {
      title: 'Corregir la escritura de un informe',
      statement: String.raw`Un informe dice: «La guagua recorrió 12 Kms en 0.5 hrs, a una rapidez media de 24 Km/hr. El motor entrega 150 Kw.» Corrija la escritura según las reglas del SI.`,
      steps: [
        String.raw`«Kms»: el prefijo kilo es **k** minúscula y los símbolos no llevan plural. Se escribe $12\,\mathrm{km}$.`,
        String.raw`«hrs»: el símbolo de la hora es h, sin plural. Se escribe $0.5\,\mathrm{h}$.`,
        String.raw`«Km/hr»: se escribe $24\,\mathrm{km/h}$.`,
        String.raw`«Kw»: kilo es k minúscula y watt (de James Watt) es W mayúscula. Se escribe $150\,\mathrm{kW}$.`,
      ],
      result: String.raw`«La guagua recorrió 12 km en 0.5 h, a una rapidez media de 24 km/h. El motor entrega 150 kW.»`,
      interpretation: 'Las mayúsculas importan: «Kw» no es nada, mientras que «mW» (miliwatt) y «MW» (megawatt) se diferencian en un factor de mil millones.',
    },
    {
      title: 'Bacterias en fila',
      statement: String.raw`Una bacteria tiene una longitud de unos $2\,\mu\mathrm{m}$. ¿Cuántas bacterias puestas una tras otra cubren $1\,\mathrm{cm}$?`,
      steps: [
        String.raw`Pasamos las dos longitudes a metros: $1\,\mathrm{cm} = 10^{-2}\,\mathrm{m}$ y $2\,\mu\mathrm{m} = 2\times10^{-6}\,\mathrm{m}$.`,
        String.raw`Número de bacterias: $N = \dfrac{10^{-2}\,\mathrm{m}}{2\times10^{-6}\,\mathrm{m}} = 0.5\times10^{4} = 5000$.`,
      ],
      result: String.raw`Unas $5000$ bacterias.`,
      interpretation: 'El resultado es adimensional, porque es un cociente de dos longitudes: las unidades se cancelan. Basta con expresar ambas en la misma unidad antes de dividir.',
    },
  ],
  simulation: null,
  exercises: [
    {
      id: 'b1-si-01',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['si-unidades-basicas'],
      prompt: '¿Cuál es la unidad **básica** del SI para la masa?',
      format: 'choice',
      options: ['El gramo (g)', 'El kilogramo (kg)', 'El newton (N)', 'La libra (lb)'],
    },
    {
      id: 'b1-si-02',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['si-prefijos'],
      prompt: String.raw`Cada hoja de un paquete de papel tiene un espesor de $0.10\,\mathrm{mm}$. ¿Cuántas hojas hay en una pila de $5.0\,\mathrm{cm}$ de altura?`,
      format: 'numeric',
      unitHint: 'número de hojas',
    },
    {
      id: 'b1-si-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['si-escritura', 'si-prefijos'],
      prompt: String.raw`**Verdadero o falso:** «Km» es una forma correcta de escribir el símbolo del kilómetro. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b1-si-04',
      category: 'error',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['si-prefijos'],
      prompt: String.raw`Una central eléctrica tiene una potencia de $0.75\,\mathrm{GW}$. Un estudiante la expresa en kilowatts así:

1. Los prefijos valen $\mathrm{G} = 10^{9}$ y $\mathrm{k} = 10^{3}$.
2. $0.75\,\mathrm{GW} = 0.75\times10^{9}\,\mathrm{W} = 7.5\times10^{8}\,\mathrm{W}$.
3. Como el kilowatt es más pequeño que el gigawatt, multiplica por $10^{3}$: $7.5\times10^{8}\times10^{3} = 7.5\times10^{11}$.
4. Resultado: $0.75\,\mathrm{GW} = 7.5\times10^{11}\,\mathrm{kW}$.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'No hay ningún error'],
    },
    {
      id: 'b1-si-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['si-prefijos', 'si-unidades-basicas'],
      prompt: String.raw`El reloj interno de un procesador funciona a $3.2\,\mathrm{GHz}$: cada ciclo dura $1/f$. La luz viaja a $3.00\times10^{8}\,\mathrm{m/s}$. ¿Qué distancia recorre la luz durante **un** ciclo del procesador? Exprese el resultado en centímetros.`,
      format: 'numeric',
      unitHint: 'cm',
    },
    {
      id: 'b1-si-06',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['si-prefijos'],
      prompt: String.raw`¿Qué prefijo del SI equivale a multiplicar la unidad por $10^{-3}$?`,
      format: 'choice',
      options: ['micro (µ)', 'mili (m)', 'centi (c)', 'mega (M)'],
    },
    {
      id: 'b1-si-07',
      category: 'conceptual',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['si-escritura'],
      prompt: 'Marque **todas** las expresiones escritas correctamente según las reglas del SI.',
      format: 'choice',
      multiple: true,
      options: [
        String.raw`$5\,\mathrm{kg}$`,
        '5 Kg',
        String.raw`$20\,^\circ\mathrm{C}$`,
        String.raw`$3.0\,\mathrm{m/s}$`,
        '12 kms',
        String.raw`$9.8\,\mathrm{m/s^2}$`,
        '30 seg',
      ],
    },
    {
      id: 'b1-si-08',
      category: 'desarrollo',
      difficulty: 'intermedio',
      role: 'bank',
      concepts: ['si-escritura', 'si-prefijos', 'si-unidades-basicas'],
      prompt: String.raw`Un compañero escribió en su informe de laboratorio: «Se midió una masa de 250 grs. y un tiempo de 3.5 seg. La muestra tenía un espesor de 0.000 012 mts y el haz láser una longitud de onda de 0.000 000 65 m. La potencia del láser era de 5 mW, es decir, 5 MW.»

(a) Identifique y corrija cada error de escritura de unidades, explicando la regla que se incumple.
(b) Exprese el espesor y la longitud de onda con el prefijo SI más conveniente (número entre 1 y 1000).
(c) Explique por qué la última frase es físicamente incorrecta y en qué factor se diferencian las dos potencias.`,
      format: 'open',
    },
  ],
};
