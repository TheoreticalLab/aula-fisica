import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'tercera-ley',
  title: 'Tercera ley de Newton: acción y reacción',
  summary:
    'Toda interacción produce dos fuerzas iguales en magnitud y opuestas, una sobre cada cuerpo. Como actúan sobre cuerpos distintos, nunca se cancelan entre sí.',
  concepts: [
    { slug: 'ley3-pares-accion-reaccion', name: 'Pares de fuerzas de acción y reacción' },
    { slug: 'ley3-cuerpos-distintos', name: 'Las fuerzas de un par actúan sobre cuerpos distintos' },
    { slug: 'ley3-par-vs-equilibrio', name: 'Par de tercera ley frente a fuerzas en equilibrio' },
    { slug: 'ley3-propulsion', name: 'Propulsión: caminar, nadar, rodar y cohetes' },
  ],
  theory: String.raw`## Las fuerzas vienen en pares

En la primera lección del bloque vimos que una fuerza es la medida de una **interacción** entre dos cuerpos. Una interacción es siempre mutua: si usted empuja a un amigo que lleva patines, usted también siente un empuje sobre sus manos; si un imán atrae un clip, el clip también atrae al imán. Newton lo formuló así:

> **Tercera ley.** Si un cuerpo A ejerce una fuerza sobre un cuerpo B, entonces B ejerce simultáneamente sobre A una fuerza de igual magnitud, en la misma dirección y en sentido opuesto.

$$\vec F_{\text{A sobre B}} = -\vec F_{\text{B sobre A}}$$

Las dos fuerzas forman un **par de acción y reacción** (o par de tercera ley). Tienen cuatro propiedades:

1. **Igual magnitud y sentidos opuestos**, a lo largo de la misma línea.
2. **Actúan sobre cuerpos distintos**: una sobre A y la otra sobre B.
3. **Son del mismo tipo**: si una es gravitatoria, la otra también; si una es una fuerza de contacto entre superficies, la otra también.
4. **Son simultáneas**: aparecen y desaparecen a la vez. Ninguna es «primero» ni «causa» de la otra; llamar «acción» a una y «reacción» a la otra es solo una convención.

Para encontrar la pareja de una fuerza basta con **intercambiar los nombres**: la pareja de «la fuerza de la mesa sobre el libro» es «la fuerza del libro sobre la mesa».

## Fuerzas iguales, efectos distintos

Cuando una guagua choca con un motoconcho, la fuerza que la guagua ejerce sobre el motoconcho es **igual en magnitud** a la que el motoconcho ejerce sobre la guagua. Lo que no es igual es el efecto: por la segunda ley, la aceleración es $a = F/m$, y la guagua tiene una masa decenas de veces mayor. El motoconcho sufre un cambio de velocidad enorme; la guagua, uno pequeño.

Lo mismo ocurre con la gravedad. La Tierra atrae a una manzana de $0.20\,\mathrm{kg}$ con unos $2\,\mathrm{N}$, y la manzana atrae a la Tierra con **exactamente esos mismos** $2\,\mathrm{N}$. La manzana acelera a $9.8\,\mathrm{m/s^2}$; la Tierra, con su masa de $6\times10^{24}\,\mathrm{kg}$, adquiere una aceleración imposible de medir.

> **Error frecuente.** «El cuerpo más grande, más rápido o más fuerte ejerce más fuerza». En una interacción, las dos fuerzas son siempre iguales en magnitud, sean cuales sean las masas o las velocidades.

## Cómo nos movemos: caminar, nadar, rodar y volar en cohete

Ningún cuerpo puede acelerarse a sí mismo empujándose: hace falta una fuerza **externa**, ejercida por otro cuerpo. La tercera ley explica de dónde sale:

- **Caminar.** Al dar un paso, su pie empuja el suelo **hacia atrás** (mediante el rozamiento). El suelo responde empujando su pie **hacia adelante**, y esa fuerza del suelo es la que lo acelera. Sobre hielo muy liso no hay rozamiento, el pie no puede empujar el suelo hacia atrás y no se puede arrancar.
- **Nadar o remar.** Las manos o los remos empujan el agua hacia atrás; el agua empuja al nadador o al bote hacia adelante.
- **Un carro o una guagua.** El motor hace girar las ruedas, que empujan el asfalto hacia atrás; el asfalto empuja las ruedas hacia adelante. El motor forma parte del carro y no puede acelerarlo por sí solo: la fuerza externa que lo acelera la ejerce el asfalto.
- **Un cohete.** El cohete expulsa gases a gran velocidad: ejerce sobre ellos una fuerza hacia atrás y los gases ejercen sobre el cohete una fuerza igual hacia adelante. El cohete **no necesita aire contra el que empujar**: por eso funciona en el vacío del espacio.
- **Empujar una pared.** Si empuja una pared con $100\,\mathrm{N}$, la pared lo empuja a usted con $100\,\mathrm{N}$. Si lleva patines, sale rodando hacia atrás; si está descalzo sobre el piso, el rozamiento con el suelo le impide retroceder.

## ¿Por qué no se cancelan?

Si las dos fuerzas de un par son iguales y opuestas, ¿por qué no se anulan? Porque **actúan sobre cuerpos distintos**. La fuerza neta de un cuerpo se obtiene sumando solo las fuerzas que actúan **sobre ese cuerpo**; sumar una fuerza que actúa sobre A con otra que actúa sobre B no tiene sentido.

Un ejemplo clásico es la «paradoja» del caballo y la carreta: si la carreta tira del caballo hacia atrás con la misma fuerza con que el caballo tira de ella hacia adelante, ¿cómo pueden moverse? Para saber si la **carreta** acelera, hay que mirar solo las fuerzas sobre la carreta: el tirón del caballo hacia adelante y el rozamiento del suelo hacia atrás. Si el tirón es mayor, acelera. Para saber si el **caballo** acelera, hay que mirar las fuerzas sobre el caballo: el empuje del suelo sobre sus cascos hacia adelante y el tirón de la carreta hacia atrás.

## Par de tercera ley o fuerzas en equilibrio

Un libro descansa sobre una mesa. Sobre él actúan su **peso** (la Tierra tira de él hacia abajo) y la **normal** (la mesa lo empuja hacia arriba). Las dos son iguales y opuestas, pero **no forman un par de acción y reacción**:

- Actúan sobre el **mismo cuerpo** (el libro).
- Son de **distinto tipo**: una es gravitatoria y la otra, de contacto.
- Son iguales solo porque el libro está en equilibrio (primera ley). Si la mesa estuviera dentro de un ascensor que acelera hacia arriba, la normal sería mayor que el peso. En cambio, las dos fuerzas de un par son iguales **siempre**.

Las parejas verdaderas son estas:

| Fuerza sobre el libro | Su pareja de tercera ley |
|---|---|
| Peso: la Tierra sobre el libro, hacia abajo | El libro sobre la Tierra (gravitatoria), hacia arriba |
| Normal: la mesa sobre el libro, hacia arriba | El libro sobre la mesa (contacto), hacia abajo |

> **Cuidado.** Dos fuerzas iguales y opuestas sobre el **mismo** cuerpo pueden estar en equilibrio, pero nunca son un par de tercera ley. Dos fuerzas de un par actúan siempre sobre cuerpos **distintos**.

## Límites del modelo

La tercera ley, tal como la hemos enunciado, se cumple en todas las situaciones de este curso: contactos, cuerdas, gravedad, imanes y cargas en reposo. Solo falla en su forma simple cuando intervienen cargas eléctricas que se mueven muy rápido: entonces parte del intercambio lo «transporta» el campo electromagnético, que no es un cuerpo en el sentido habitual.`,
  formulas: [
    {
      name: 'Tercera ley de Newton',
      latex: String.raw`\vec F_{\text{A sobre B}} = -\vec F_{\text{B sobre A}}`,
      description:
        'Las dos fuerzas de una interacción tienen igual magnitud y sentidos opuestos, y cada una actúa sobre un cuerpo distinto.',
      variables: [
        { symbol: String.raw`\vec F_{\text{A sobre B}}`, meaning: 'Fuerza que el cuerpo A ejerce sobre el cuerpo B', unit: 'N' },
        { symbol: String.raw`\vec F_{\text{B sobre A}}`, meaning: 'Fuerza que el cuerpo B ejerce sobre el cuerpo A', unit: 'N' },
      ],
      notes: 'Las dos fuerzas son del mismo tipo y simultáneas. Nunca se suman entre sí, porque actúan sobre cuerpos distintos.',
    },
    {
      name: 'Aceleraciones en una interacción',
      latex: String.raw`m_A\,a_A = m_B\,a_B \quad \Rightarrow \quad \frac{a_A}{a_B} = \frac{m_B}{m_A}`,
      description:
        'Si la única fuerza neta sobre cada cuerpo es la del par, los dos reciben la misma fuerza y el de menor masa acelera más (magnitudes; las aceleraciones tienen sentidos opuestos).',
      variables: [
        { symbol: String.raw`m_A,\,m_B`, meaning: 'Masas de los dos cuerpos', unit: 'kg' },
        { symbol: String.raw`a_A,\,a_B`, meaning: 'Magnitudes de sus aceleraciones', unit: 'm/s²' },
      ],
      notes: 'Solo vale si no hay otras fuerzas horizontales apreciables (por ejemplo, patinadores sobre hielo).',
    },
  ],
  examples: [
    {
      title: 'La manzana también atrae a la Tierra',
      statement: String.raw`La Tierra atrae a una manzana de $0.20\,\mathrm{kg}$ con una fuerza de $1.96\,\mathrm{N}$. ¿Con qué fuerza atrae la manzana a la Tierra y qué aceleración le produce? Masa de la Tierra: $5.97\times10^{24}\,\mathrm{kg}$.`,
      steps: [
        String.raw`Tercera ley: $\vec F_{\text{manzana sobre Tierra}} = -\vec F_{\text{Tierra sobre manzana}}$. La manzana tira de la Tierra con $1.96\,\mathrm{N}$, hacia arriba (hacia la manzana).`,
        String.raw`Segunda ley aplicada a la Tierra: $a_T = \dfrac{F}{m_T} = \dfrac{1.96\,\mathrm{N}}{5.97\times10^{24}\,\mathrm{kg}} = 3.3\times10^{-25}\,\mathrm{m/s^2}$.`,
        String.raw`Comparación con la manzana: $a_M = \dfrac{1.96\,\mathrm{N}}{0.20\,\mathrm{kg}} = 9.8\,\mathrm{m/s^2}$.`,
      ],
      result: String.raw`La manzana atrae a la Tierra con $1.96\,\mathrm{N}$ y le produce una aceleración de unos $3.3\times10^{-25}\,\mathrm{m/s^2}$.`,
      interpretation:
        'Las fuerzas son iguales; las aceleraciones difieren en un factor de unos 3×10²⁵, el cociente de las masas. Por eso decimos que la manzana cae hacia la Tierra y no al revés, aunque en rigor las dos se aceleran una hacia la otra.',
    },
    {
      title: 'Dos patinadores se empujan',
      statement: String.raw`Sobre una pista de hielo, Laura ($50\,\mathrm{kg}$) y Marcos ($75\,\mathrm{kg}$) están en reposo, frente a frente. Laura empuja a Marcos con una fuerza de $150\,\mathrm{N}$. Desprecie el rozamiento con el hielo. ¿Qué aceleración adquiere cada uno?`,
      steps: [
        String.raw`Tercera ley: si Laura empuja a Marcos con $150\,\mathrm{N}$ hacia adelante, Marcos empuja a Laura con $150\,\mathrm{N}$ hacia atrás, aunque él no «haga nada».`,
        String.raw`Sin rozamiento, esa es la única fuerza horizontal sobre cada uno. Marcos: $a_M = \dfrac{150\,\mathrm{N}}{75\,\mathrm{kg}} = 2.0\,\mathrm{m/s^2}$.`,
        String.raw`Laura: $a_L = \dfrac{150\,\mathrm{N}}{50\,\mathrm{kg}} = 3.0\,\mathrm{m/s^2}$, en sentido opuesto.`,
        String.raw`Comprobación: $a_L/a_M = 3.0/2.0 = 1.5 = m_M/m_L = 75/50$ ✓.`,
      ],
      result: String.raw`Marcos acelera a $2.0\,\mathrm{m/s^2}$ y Laura a $3.0\,\mathrm{m/s^2}$, en sentidos opuestos.`,
      interpretation:
        'Quien empuja también sale despedido. Las fuerzas son iguales, pero la persona de menor masa acelera más. No importa quién «inicia» el empujón: el resultado sería el mismo si fuera Marcos quien empujara.',
    },
    {
      title: 'Identificar los pares de un libro sobre la mesa',
      statement: String.raw`Un libro de $1.5\,\mathrm{kg}$ reposa sobre una mesa horizontal. Identifique las fuerzas que actúan sobre el libro, sus parejas de tercera ley y sus valores.`,
      steps: [
        String.raw`Fuerzas sobre el libro: el peso, $W = mg = (1.5)(9.8) = 14.7\,\mathrm{N}$, hacia abajo (la Tierra sobre el libro), y la normal, hacia arriba (la mesa sobre el libro).`,
        String.raw`El libro está en reposo: por la **primera ley**, $N - W = 0 \Rightarrow N = 14.7\,\mathrm{N}$.`,
        String.raw`Pareja del peso (intercambiando nombres): el libro sobre la Tierra, $14.7\,\mathrm{N}$ hacia arriba, aplicada en la Tierra.`,
        String.raw`Pareja de la normal: el libro sobre la mesa, $14.7\,\mathrm{N}$ hacia abajo, aplicada en la mesa.`,
      ],
      result: String.raw`Cuatro fuerzas de $14.7\,\mathrm{N}$: dos sobre el libro (peso y normal, que se equilibran) y sus dos parejas, una sobre la Tierra y otra sobre la mesa.`,
      interpretation:
        'Peso y normal valen lo mismo por la primera ley (equilibrio), no por la tercera. Que las cuatro fuerzas tengan el mismo valor es una coincidencia de esta situación de reposo: si alguien apoyara la mano sobre el libro, la normal y su pareja aumentarían, mientras que el peso y su pareja seguirían siendo de 14.7 N.',
    },
  ],
  simulation: null,
  exercises: [
    {
      id: 'b3-ley3-01',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['ley3-pares-accion-reaccion'],
      prompt: String.raw`Una guagua de $12\,000\,\mathrm{kg}$ choca de frente con un motoconcho de $250\,\mathrm{kg}$. Durante el choque, ¿cómo es la fuerza que la guagua ejerce sobre el motoconcho comparada con la que el motoconcho ejerce sobre la guagua?`,
      format: 'choice',
      options: [
        'Mucho mayor, porque la guagua tiene mucha más masa.',
        'Igual en magnitud y de sentido opuesto.',
        'Menor, porque el motoconcho sufre más daños.',
        'Depende de cuál de los dos iba más rápido.',
      ],
    },
    {
      id: 'b3-ley3-02',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['ley3-cuerpos-distintos'],
      prompt: String.raw`**Verdadero o falso:** las fuerzas de acción y reacción se anulan entre sí porque son iguales y opuestas; por eso la fuerza neta sobre cualquier cuerpo que interactúa con otro es cero. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b3-ley3-03',
      category: 'conceptual',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['ley3-par-vs-equilibrio', 'ley3-pares-accion-reaccion'],
      prompt:
        'Un libro descansa sobre una mesa. Su peso es la fuerza con que la Tierra lo atrae hacia abajo. Según la tercera ley de Newton, ¿cuál es la pareja (reacción) de ese peso?',
      format: 'choice',
      options: [
        'La fuerza normal que la mesa ejerce hacia arriba sobre el libro.',
        'La fuerza que el libro ejerce hacia abajo sobre la mesa.',
        'La fuerza gravitatoria que el libro ejerce hacia arriba sobre la Tierra.',
        'El peso no tiene reacción, porque es una fuerza a distancia.',
      ],
    },
    {
      id: 'b3-ley3-04',
      category: 'numerica',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['ley3-pares-accion-reaccion', 'ley2-fuerza-neta-aceleracion'],
      prompt: String.raw`Ana ($45\,\mathrm{kg}$) y Beto ($60\,\mathrm{kg}$) están en reposo, con patines, sobre una pista horizontal en la que el rozamiento es despreciable. Ana empuja a Beto con una fuerza constante de $90\,\mathrm{N}$ durante $0.50\,\mathrm{s}$. ¿Qué rapidez tiene **Ana** al terminar el empujón?`,
      format: 'numeric',
      unitHint: 'm/s',
    },
    {
      id: 'b3-ley3-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['ley3-pares-accion-reaccion', 'ley3-cuerpos-distintos', 'ley2-problemas-1d'],
      prompt: String.raw`Dos cajas están en contacto, una junto a otra, sobre un piso horizontal sin rozamiento. Usted empuja horizontalmente la caja A ($4.0\,\mathrm{kg}$) con $60\,\mathrm{N}$, y A empuja a la caja B ($2.0\,\mathrm{kg}$), que está delante. ¿Cuál es la magnitud de la fuerza que la caja **B ejerce sobre la caja A**?`,
      format: 'numeric',
      unitHint: 'N',
    },
    {
      id: 'b3-ley3-06',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['ley3-propulsion'],
      prompt: '¿Qué fuerza acelera hacia adelante a un cohete que viaja por el espacio vacío con los motores encendidos?',
      format: 'choice',
      options: [
        'La fuerza de los gases expulsados al empujar contra el aire que hay detrás del cohete.',
        'La fuerza que los gases expulsados ejercen sobre el cohete, pareja de la fuerza con que el cohete los empuja hacia atrás.',
        'Ninguna: en el vacío no hay nada contra lo que empujar, así que el cohete no puede acelerar.',
        'La atracción gravitatoria de la Tierra, que lo impulsa hacia adelante.',
      ],
    },
    {
      id: 'b3-ley3-07',
      category: 'error',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['ley3-cuerpos-distintos'],
      prompt: String.raw`Un estudiante intenta explicar por qué un caballo no podría mover una carreta:

1. El caballo tira de la carreta con una fuerza $\vec F$ hacia adelante.
2. Por la tercera ley, la carreta tira del caballo con una fuerza $-\vec F$, de igual magnitud y hacia atrás.
3. Como esas dos fuerzas son iguales y opuestas, se anulan, y la fuerza neta sobre la carreta es cero.
4. Por la segunda ley, si la fuerza neta sobre la carreta es cero, su aceleración es cero.
5. Por tanto, si la carreta parte del reposo, nunca podrá ponerse en movimiento.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'Paso 5', 'No hay ningún error'],
    },
    {
      id: 'b3-ley3-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['ley3-propulsion', 'ley3-par-vs-equilibrio', 'ley3-cuerpos-distintos'],
      prompt: String.raw`Una persona de $70\,\mathrm{kg}$ arranca a caminar sobre una acera horizontal y, durante el primer paso, acelera hacia adelante a $1.5\,\mathrm{m/s^2}$. (a) Haga una tabla con todas las fuerzas que actúan **sobre la persona** (agente, tipo y dirección) y, para cada una, su pareja de tercera ley (sobre qué cuerpo actúa y en qué dirección). (b) Calcule la fuerza horizontal que la acera ejerce sobre la persona y la que la persona ejerce sobre la acera. (c) Calcule la aceleración que esa fuerza produce sobre la Tierra (masa $5.97\times10^{24}\,\mathrm{kg}$) y comente el resultado. (d) Explique por qué la persona acelera aunque las dos fuerzas de cada par sean iguales y opuestas, y por qué no podría arrancar sobre hielo perfectamente liso.`,
      format: 'open',
    },
  ],
};
