import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'tension',
  title: 'Tensión, cuerdas y poleas',
  summary:
    'Una cuerda tensa tira de los cuerpos a los que está atada. Si es ideal (sin masa e inextensible), transmite la misma tensión en toda su longitud y obliga a los cuerpos que une a moverse con la misma rapidez y la misma magnitud de aceleración.',
  concepts: [
    { slug: 'tension-cuerda-ideal', name: 'Tensión en una cuerda ideal' },
    { slug: 'tension-poleas', name: 'Poleas ideales' },
    { slug: 'tension-sistemas-acoplados', name: 'Cuerpos unidos por cuerdas (mesa y polea, máquina de Atwood)' },
  ],
  theory: String.raw`## ¿Qué es la tensión?

Cuando una cuerda, un cable o una cadena está tensa, tira de los objetos atados a sus extremos. Esa fuerza se llama **tensión** $\vec T$. Tiene tres características:

1. Actúa **a lo largo de la cuerda**.
2. **Siempre tira** del cuerpo, alejándose de él; una cuerda no puede empujar. Si al resolver un problema obtiene $T < 0$, la cuerda está floja y el planteamiento debe revisarse.
3. Se mide en newtons, como cualquier fuerza.

En el diagrama de cuerpo libre de un objeto atado, la tensión se dibuja en el punto de unión, apuntando a lo largo de la cuerda y **hacia afuera** del objeto.

## La cuerda ideal

En la mayoría de los problemas usamos un modelo simplificado, la **cuerda ideal**, que tiene dos propiedades.

**Sin masa.** Tomemos un trozo cualquiera de cuerda. Por un extremo lo tira el resto de la cuerda con una tensión $T_1$ y por el otro, con $T_2$. Según la segunda ley, $T_1 - T_2 = m_{trozo}\,a$. Si la masa del trozo es cero, $T_1 = T_2$ aunque la cuerda esté acelerando. Conclusión: **en una cuerda ideal la tensión tiene el mismo valor en todos sus puntos.** Una cuerda real tiene masa, y en ella la tensión es algo mayor arriba que abajo. Cuando la masa de la cuerda es mucho menor que la de los cuerpos que une, la diferencia es despreciable.

**Inextensible.** La cuerda no se estira. Por eso, si dos cuerpos están unidos por una cuerda tensa, recorren la misma distancia en el mismo tiempo: tienen **la misma rapidez y la misma magnitud de aceleración**. Esta es una **ecuación de ligadura**, una condición adicional que se suma a las ecuaciones de Newton.

> **Error frecuente.** Creer que la tensión de una cuerda que sostiene un objeto es siempre igual a su peso. Eso solo es cierto si el objeto **no acelera**. Una grúa que empieza a subir una carga tira con más fuerza que el peso; si la baja acelerando, con menos.

## Un objeto colgado

Para un objeto de masa $m$ que cuelga de una cuerda vertical, con el eje $y$ hacia arriba, la segunda ley da $T - mg = m\,a_y$:

$$T = m\,(g + a_y).$$

En reposo o con velocidad constante, $T = mg$. Al acelerar hacia arriba, $T > mg$, y al acelerar hacia abajo, $T < mg$. Observe que es la misma estructura que la normal en un ascensor: la cuerda, como la báscula, ajusta su fuerza a la aceleración. Es la razón por la que un cable puede romperse al arrancar bruscamente aunque soporte sin problema la carga en reposo.

## Poleas ideales

Una **polea** es una rueda que gira alrededor de un eje y por cuyo borde pasa una cuerda. Una **polea ideal** no tiene masa y gira sin fricción. Su único efecto es **cambiar la dirección** de la cuerda sin cambiar la tensión: a ambos lados de una polea ideal la tensión es la misma.

El soporte que sostiene la polea, en cambio, sí siente las dos ramas de la cuerda. Si las dos ramas cuelgan verticalmente, el soporte debe tirar hacia arriba con $2T$.

## Dos bloques sobre una mesa

Dos bloques, $A$ y $B$, están sobre una mesa horizontal sin fricción, unidos por una cuerda. Una fuerza $F$ tira de $A$, y $A$ arrastra a $B$ mediante la cuerda. Como la cuerda es inextensible, ambos tienen la misma aceleración $a$.

- **Tratando ambos como un solo sistema**: la tensión es una fuerza **interna** (la cuerda tira de $A$ hacia atrás y de $B$ hacia adelante con el mismo módulo) y se cancela. Queda $F = (m_A + m_B)\,a$.
- **Para hallar la tensión** se aísla un bloque. Sobre $B$ solo actúa horizontalmente la tensión: $T = m_B\,a$.

Así, $T = \dfrac{m_B}{m_A + m_B}\,F$, que es **menor** que $F$: la cuerda solo tiene que acelerar al bloque de atrás.

## Bloque en la mesa y bloque colgante

Un bloque de masa $m_1$ sobre una mesa horizontal sin fricción está unido, mediante una cuerda que pasa por una polea en el borde, a un bloque colgante de masa $m_2$. El colgante baja y el de la mesa avanza, ambos con la misma $a$. Tomando como sentido positivo el del movimiento de cada bloque:

- Bloque de la mesa: $T = m_1\,a$.
- Bloque colgante: $m_2\,g - T = m_2\,a$.

Sumando, $m_2\,g = (m_1 + m_2)\,a$:

$$a = \frac{m_2}{m_1 + m_2}\,g, \qquad T = \frac{m_1 m_2}{m_1 + m_2}\,g.$$

**Comprobaciones:** $a < g$, porque el peso del bloque colgante tiene que acelerar a los dos bloques; y $T < m_2 g$, porque el bloque colgante acelera hacia abajo. Si $m_1$ fuera despreciable frente a $m_2$, tendríamos $a \approx g$ (caída libre) y $T \approx 0$.

## Máquina de Atwood

Dos masas $m_1 < m_2$ cuelgan de los extremos de una cuerda que pasa por una polea ideal. La más pesada baja y la otra sube, con la misma $a$. Con el sentido positivo hacia arriba para $m_1$ y hacia abajo para $m_2$:

$$T - m_1 g = m_1 a, \qquad m_2 g - T = m_2 a,$$

de donde

$$a = \frac{m_2 - m_1}{m_1 + m_2}\,g, \qquad T = \frac{2\,m_1 m_2}{m_1 + m_2}\,g.$$

La tensión queda **entre** los dos pesos: mayor que $m_1 g$ (porque acelera hacia arriba a $m_1$) y menor que $m_2 g$. Si $m_1 = m_2$, $a = 0$: el sistema queda en equilibrio o se mueve con velocidad constante. La máquina de Atwood se inventó en el siglo XVIII para estudiar la gravedad con aceleraciones pequeñas y fáciles de medir.

## Límites del modelo

Las cuerdas reales se estiran un poco y tienen masa. Las poleas reales tienen masa y fricción en el eje, de modo que la tensión no es exactamente igual a ambos lados. Cuando la polea tiene una masa apreciable, hace falta la dinámica de rotación, que se estudia más adelante.`,
  formulas: [
    {
      name: 'Objeto colgado de una cuerda',
      latex: String.raw`T = m\,(g + a_y)`,
      description: 'Tensión de una cuerda vertical que sostiene un cuerpo con aceleración vertical a_y (eje hacia arriba).',
      variables: [
        { symbol: String.raw`T`, meaning: 'Tensión de la cuerda', unit: 'N' },
        { symbol: String.raw`m`, meaning: 'Masa del cuerpo colgado', unit: 'kg' },
        { symbol: String.raw`a_y`, meaning: 'Aceleración vertical (positiva hacia arriba)', unit: 'm/s²' },
      ],
      notes: 'Solo si a_y = 0 (reposo o velocidad constante) la tensión es igual al peso.',
    },
    {
      name: 'Dos bloques sobre una mesa sin fricción',
      latex: String.raw`a = \frac{F}{m_A + m_B}, \qquad T = m_B\,a`,
      description: 'Una fuerza F tira del bloque A, que arrastra al bloque B mediante una cuerda ideal.',
      variables: [
        { symbol: String.raw`F`, meaning: 'Fuerza aplicada sobre A', unit: 'N' },
        { symbol: String.raw`m_A,\,m_B`, meaning: 'Masas de los bloques (B es el que va detrás)', unit: 'kg' },
        { symbol: String.raw`T`, meaning: 'Tensión de la cuerda que une A y B', unit: 'N' },
      ],
    },
    {
      name: 'Bloque en una mesa sin fricción y bloque colgante',
      latex: String.raw`a = \frac{m_2\,g}{m_1 + m_2}, \qquad T = \frac{m_1 m_2}{m_1 + m_2}\,g`,
      description: 'El bloque m1 está sobre la mesa; m2 cuelga de una cuerda que pasa por una polea ideal en el borde.',
      variables: [
        { symbol: String.raw`m_1`, meaning: 'Masa del bloque sobre la mesa', unit: 'kg' },
        { symbol: String.raw`m_2`, meaning: 'Masa del bloque colgante', unit: 'kg' },
      ],
      notes: 'Si hay fricción cinética en la mesa, el numerador de a pasa a ser m₂g − μk·m₁g.',
    },
    {
      name: 'Máquina de Atwood',
      latex: String.raw`a = \frac{m_2 - m_1}{m_1 + m_2}\,g, \qquad T = \frac{2\,m_1 m_2}{m_1 + m_2}\,g`,
      description: 'Dos masas colgadas de los extremos de una cuerda ideal que pasa por una polea ideal; m2 > m1 baja.',
      variables: [
        { symbol: String.raw`m_1,\,m_2`, meaning: 'Masas colgadas (m₂ > m₁)', unit: 'kg' },
        { symbol: String.raw`a`, meaning: 'Magnitud de la aceleración de cada masa', unit: 'm/s²' },
      ],
      notes: 'La tensión queda entre m₁g y m₂g.',
    },
  ],
  examples: [
    {
      title: 'Subir una cubeta desde un pozo',
      statement: String.raw`Se sube desde un pozo una cubeta con agua de $12\,\mathrm{kg}$ mediante una cuerda vertical. Al empezar a subir, la cubeta acelera hacia arriba a $0.50\,\mathrm{m/s^2}$. ¿Cuál es la tensión de la cuerda? ¿Y cuando sube con velocidad constante?`,
      steps: [
        String.raw`Fuerzas sobre la cubeta: tensión $T$ hacia arriba y peso $mg$ hacia abajo. Eje $y$ hacia arriba.`,
        String.raw`Segunda ley: $T - mg = m\,a_y \Rightarrow T = m\,(g + a_y)$.`,
        String.raw`Al arrancar: $T = (12\,\mathrm{kg})(9.8 + 0.50)\,\mathrm{m/s^2} = 123.6\,\mathrm{N}$.`,
        String.raw`Con velocidad constante, $a_y = 0$: $T = mg = (12\,\mathrm{kg})(9.8\,\mathrm{m/s^2}) = 117.6\,\mathrm{N}$.`,
      ],
      result: String.raw`$T \approx 124\,\mathrm{N}$ al arrancar y $T \approx 118\,\mathrm{N}$ con velocidad constante.`,
      interpretation:
        'Al arrancar, la cuerda debe sostener el peso y además proporcionar la fuerza neta que acelera la cubeta. La diferencia, m·a = 6 N, es pequeña porque la aceleración también lo es.',
    },
    {
      title: 'Bloque en la mesa arrastrado por un bloque colgante',
      statement: String.raw`Un bloque de $3.0\,\mathrm{kg}$ sobre una mesa horizontal sin fricción está unido por una cuerda ideal, que pasa por una polea ideal en el borde de la mesa, a un bloque de $2.0\,\mathrm{kg}$ que cuelga. Se suelta el sistema. Halle la aceleración y la tensión.`,
      steps: [
        String.raw`Sentido positivo: hacia la polea para el bloque de la mesa ($m_1 = 3.0\,\mathrm{kg}$) y hacia abajo para el colgante ($m_2 = 2.0\,\mathrm{kg}$). Ambos tienen la misma $a$ (cuerda inextensible).`,
        String.raw`Bloque de la mesa (horizontal): $T = m_1\,a$. Colgante: $m_2 g - T = m_2\,a$.`,
        String.raw`Sumando: $m_2 g = (m_1 + m_2)\,a \Rightarrow a = \dfrac{(2.0\,\mathrm{kg})(9.8\,\mathrm{m/s^2})}{5.0\,\mathrm{kg}} = 3.92\,\mathrm{m/s^2}$.`,
        String.raw`Tensión: $T = m_1 a = (3.0\,\mathrm{kg})(3.92\,\mathrm{m/s^2}) = 11.8\,\mathrm{N}$. Comprobación con el colgante: $T = m_2(g - a) = (2.0)(9.8 - 3.92) = 11.8\,\mathrm{N}$ ✓.`,
      ],
      result: String.raw`$a = 3.92\,\mathrm{m/s^2}$ y $T \approx 11.8\,\mathrm{N}$.`,
      interpretation:
        'La tensión (11.8 N) es menor que el peso del bloque colgante (19.6 N): si fueran iguales, el bloque colgante no aceleraría. Y a < g, como debe ser.',
    },
    {
      title: 'Máquina de Atwood',
      statement: String.raw`De los extremos de una cuerda ideal que pasa por una polea ideal cuelgan dos masas de $4.0\,\mathrm{kg}$ y $6.0\,\mathrm{kg}$. Se sueltan desde el reposo. Calcule la aceleración y la tensión.`,
      steps: [
        String.raw`$m_1 = 4.0\,\mathrm{kg}$ sube y $m_2 = 6.0\,\mathrm{kg}$ baja. Sentido positivo: hacia arriba para $m_1$ y hacia abajo para $m_2$.`,
        String.raw`Ecuaciones: $T - m_1 g = m_1 a$ y $m_2 g - T = m_2 a$.`,
        String.raw`Sumando: $(m_2 - m_1)\,g = (m_1 + m_2)\,a \Rightarrow a = \dfrac{2.0\,\mathrm{kg}}{10\,\mathrm{kg}}\,(9.8\,\mathrm{m/s^2}) = 1.96\,\mathrm{m/s^2}$.`,
        String.raw`Tensión: $T = m_1(g + a) = (4.0\,\mathrm{kg})(9.8 + 1.96)\,\mathrm{m/s^2} = 47.0\,\mathrm{N}$. Comprobación: $m_2(g - a) = (6.0)(7.84) = 47.0\,\mathrm{N}$ ✓.`,
      ],
      result: String.raw`$a = 1.96\,\mathrm{m/s^2}$ y $T \approx 47\,\mathrm{N}$.`,
      interpretation:
        'La tensión está entre los dos pesos (39.2 N y 58.8 N). La aceleración es solo un quinto de g, por eso la máquina de Atwood permite estudiar la caída con aceleraciones fáciles de medir.',
    },
  ],
  simulation: null,
  exercises: [
    {
      id: 'b3-tens-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['tension-cuerda-ideal'],
      prompt: String.raw`Una maceta de $4.5\,\mathrm{kg}$ cuelga en reposo de una cuerda vertical atada al techo de un balcón. ¿Cuál es la tensión de la cuerda?`,
      format: 'numeric',
      unitHint: 'N',
    },
    {
      id: 'b3-tens-02',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['tension-cuerda-ideal', 'ley2-fuerza-neta-aceleracion'],
      prompt: String.raw`**Verdadero o falso:** una grúa sube un contenedor con **velocidad constante** mediante un cable vertical. Como el contenedor sube, la tensión del cable es mayor que el peso del contenedor. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b3-tens-03',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['tension-cuerda-ideal'],
      prompt: String.raw`Dos equipos juegan a «tirar de la cuerda». Cada equipo tira de su extremo con una fuerza horizontal de $200\,\mathrm{N}$ y la cuerda (ligera) no se mueve. ¿Cuánto vale la tensión de la cuerda?`,
      format: 'choice',
      options: [String.raw`$0\,\mathrm{N}$`, String.raw`$100\,\mathrm{N}$`, String.raw`$200\,\mathrm{N}$`, String.raw`$400\,\mathrm{N}$`],
    },
    {
      id: 'b3-tens-04',
      category: 'numerica',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['tension-sistemas-acoplados', 'tension-cuerda-ideal'],
      prompt: String.raw`Dos bloques sobre una mesa horizontal sin fricción están unidos por una cuerda ideal. Se tira del bloque delantero ($m_A = 4.0\,\mathrm{kg}$) con una fuerza horizontal de $30\,\mathrm{N}$, y este arrastra al bloque trasero ($m_B = 2.0\,\mathrm{kg}$). ¿Cuál es la tensión de la cuerda que une los bloques?`,
      format: 'numeric',
      unitHint: 'N',
    },
    {
      id: 'b3-tens-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['tension-sistemas-acoplados', 'tension-poleas'],
      prompt: String.raw`Un bloque de $5.0\,\mathrm{kg}$ está sobre una mesa horizontal ($\mu_s = 0.30$, $\mu_k = 0.20$). Una cuerda ideal lo une, pasando por una polea ideal en el borde de la mesa, a un bloque de $3.0\,\mathrm{kg}$ que cuelga. Se suelta el sistema desde el reposo. ¿Cuál es la tensión de la cuerda mientras los bloques se mueven?`,
      format: 'numeric',
      unitHint: 'N',
    },
    {
      id: 'b3-tens-06',
      category: 'conceptual',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['tension-cuerda-ideal', 'tension-sistemas-acoplados'],
      prompt: String.raw`Dos bloques unidos por una cuerda tensa se mueven juntos. ¿Qué propiedad de la cuerda ideal garantiza que ambos tengan la misma magnitud de aceleración? Responda con una palabra o una frase corta.`,
      format: 'text',
    },
    {
      id: 'b3-tens-07',
      category: 'error',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['tension-sistemas-acoplados', 'tension-poleas'],
      prompt: String.raw`Un estudiante resolvió así una máquina de Atwood con $m_1 = 2.0\,\mathrm{kg}$ y $m_2 = 3.0\,\mathrm{kg}$ (cuerda y polea ideales). Se pide la tensión.

1. Tomo como positivo el sentido del movimiento: hacia arriba para $m_1$ y hacia abajo para $m_2$.
2. Para $m_2$: $m_2 g - T = m_2 a$.
3. Para $m_1$: $T - m_1 g = m_1 a$.
4. Sumando: $(m_2 - m_1)\,g = (m_1 + m_2)\,a$, así que $a = \dfrac{1.0}{5.0}(9.8) = 1.96\,\mathrm{m/s^2}$.
5. La tensión sostiene a $m_1$, luego $T = m_1 g = (2.0)(9.8) = 19.6\,\mathrm{N}$.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'Paso 5', 'No hay ningún error'],
    },
    {
      id: 'b3-tens-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['tension-sistemas-acoplados', 'tension-poleas', 'dcl-procedimiento'],
      prompt: String.raw`Una máquina de Atwood tiene masas $m_1 = 1.20\,\mathrm{kg}$ y $m_2 = 1.00\,\mathrm{kg}$, con cuerda y polea ideales. Se suelta desde el reposo cuando $m_1$ está a $1.50\,\mathrm{m}$ sobre el piso.

(a) Dibuje el diagrama de cuerpo libre de cada masa y de la polea.
(b) Calcule la aceleración del sistema y la tensión de la cuerda.
(c) ¿Cuánto tarda $m_1$ en llegar al piso y con qué rapidez llega?
(d) ¿Con qué fuerza tira hacia arriba el soporte que sostiene la polea? ¿Es igual al peso total de las dos masas? Explique.
(e) Analice qué ocurre con $a$ y $T$ si $m_1 = m_2$ y si $m_1$ es mucho mayor que $m_2$.`,
      format: 'open',
    },
  ],
};
