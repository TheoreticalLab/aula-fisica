import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'peso-normal',
  title: 'Peso y fuerza normal',
  summary:
    'La masa mide la inercia y el peso es la fuerza con que la Tierra atrae un cuerpo. La normal es la fuerza perpendicular con que una superficie empuja lo que se apoya en ella, y no siempre vale lo mismo que el peso.',
  concepts: [
    { slug: 'peso-normal-masa-peso', name: 'Diferencia entre masa y peso (W = mg)' },
    { slug: 'peso-normal-fuerza-normal', name: 'Fuerza normal: dirección y valor' },
    { slug: 'peso-normal-peso-aparente', name: 'Peso aparente y básculas en ascensores' },
  ],
  theory: String.raw`## Masa y peso no son lo mismo

En el lenguaje cotidiano decimos «peso 70 kilos», pero en física **masa** y **peso** son magnitudes distintas.

- La **masa** $m$ mide la **inercia** de un cuerpo: cuánto se resiste a cambiar su velocidad. Es un escalar, se mide en kilogramos y **no depende del lugar**. Un astronauta de $80\,\mathrm{kg}$ tiene $80\,\mathrm{kg}$ en Santo Domingo, en la Luna o flotando en la Estación Espacial.
- El **peso** $\vec W$ es la **fuerza gravitatoria** que la Tierra (o el astro en que estemos) ejerce sobre el cuerpo. Es un vector dirigido hacia abajo (hacia el centro de la Tierra), se mide en newtons y **sí depende del lugar**.

Cerca de la superficie terrestre, todos los cuerpos en caída libre aceleran con $g = 9.8\,\mathrm{m/s^2}$. Si la única fuerza es el peso, la segunda ley de Newton da $W = m\,g$. Por eso

$$W = m\,g .$$

Como $1\,\mathrm{N} = 1\,\mathrm{kg\cdot m/s^2}$, también se puede leer $g$ como $9.8\,\mathrm{N/kg}$: cada kilogramo de masa pesa $9.8\,\mathrm{N}$. En la Luna, $g \approx 1.6\,\mathrm{m/s^2}$, así que el astronauta pesa unos $128\,\mathrm{N}$ en lugar de $784\,\mathrm{N}$. Su masa no cambió; cambió la atracción gravitatoria.

> **Error frecuente.** Escribir «$W = 70\,\mathrm{kg}$». Un peso se expresa en newtons. Cuando alguien dice que «pesa 70 kilos», en realidad informa su masa; su peso es $70 \times 9.8 = 686\,\mathrm{N}$.

El peso actúa siempre, esté el cuerpo quieto, subiendo o cayendo. Mientras $g$ no cambie, el peso tampoco cambia: **no depende de la velocidad ni de la aceleración** del cuerpo.

## La fuerza normal

Cuando un cuerpo se apoya en una superficie, la superficie lo empuja. Esa fuerza de contacto se llama **fuerza normal** $\vec N$. «Normal» significa **perpendicular**: la normal es siempre perpendicular a la superficie de contacto y apunta hacia afuera de ella, hacia el cuerpo.

¿De dónde sale? Ninguna superficie es perfectamente rígida. Al apoyar un libro en una mesa, la mesa se comprime una cantidad minúscula, y sus átomos, como diminutos resortes, empujan hacia arriba. La normal **se ajusta** al valor necesario para que el cuerpo no atraviese la superficie. Por eso no hay una «fórmula de la normal»: su valor se obtiene, en cada caso, de la segunda ley aplicada en la dirección perpendicular a la superficie.

Tres propiedades que conviene recordar:

1. La normal es **perpendicular** a la superficie, no necesariamente vertical. En una rampa está inclinada.
2. Una superficie **solo empuja**, nunca tira: $N \ge 0$. Si los cálculos dan $N < 0$, el cuerpo ha perdido el contacto.
3. La normal y el peso **no forman un par de acción y reacción**, aunque a veces tengan igual módulo. Actúan sobre el **mismo** cuerpo y son de naturaleza distinta. La reacción del peso del libro es la fuerza con que el libro atrae a la Tierra; la reacción de la normal es la fuerza con que el libro empuja la mesa.

## ¿Cuándo la normal no es igual al peso?

Si un cuerpo reposa sobre una superficie horizontal y no actúa ninguna otra fuerza vertical, la aceleración vertical es cero y $N - mg = 0$, así que $N = mg$. **Basta que cambie alguna de esas condiciones para que $N \ne mg$.**

**Una fuerza empuja hacia abajo.** Si apoya la mano sobre el libro y empuja con $F$, la mesa debe sostener también ese empuje: $N = mg + F$.

**Una fuerza tira hacia arriba con un ángulo.** Al arrastrar una maleta con una correa que forma un ángulo $\alpha$ sobre la horizontal, la componente vertical de la tensión, $F\sin\alpha$, ayuda a sostenerla. Con aceleración vertical nula:

$$N + F\sin\alpha - mg = 0 \quad\Rightarrow\quad N = mg - F\sin\alpha .$$

**La superficie está inclinada.** Sobre una rampa de ángulo $\theta$ solo la componente del peso perpendicular a la rampa presiona contra ella. Si no hay otras fuerzas perpendiculares, $N = mg\cos\theta$, que es menor que $mg$. Este caso se estudia con detalle en la lección de planos inclinados.

**El apoyo está acelerado: ascensores.** Una persona sobre una báscula dentro de un ascensor sube y baja con él. Tomemos el eje $y$ hacia arriba. Sobre la persona actúan el peso, hacia abajo, y la normal de la báscula, hacia arriba. La segunda ley da $N - mg = m\,a_y$, es decir,

$$N = m\,(g + a_y).$$

- Si el ascensor acelera hacia arriba ($a_y > 0$: arranca subiendo o frena mientras baja), $N > mg$.
- Si se mueve con velocidad constante, en cualquier sentido, $a_y = 0$ y $N = mg$.
- Si acelera hacia abajo ($a_y < 0$: arranca bajando o frena mientras sube), $N < mg$.
- Si el cable se rompiera, todo caería con $a_y = -g$ y $N = 0$.

> **Cuidado.** Lo que decide la normal es el **sentido de la aceleración**, no el de la velocidad. Un ascensor que baja y está frenando tiene aceleración hacia arriba.

## Peso aparente

Una báscula de baño no mide la masa ni el peso: mide la **fuerza con que se la comprime**, que por la tercera ley es igual en módulo a la normal que ejerce sobre la persona. Luego divide entre $9.8$ y muestra «kilogramos». A esa lectura se le llama **peso aparente**. En un ascensor que arranca hacia arriba la báscula marca más; al frenar en el piso de destino marca menos. Lo que cambia es la normal, no el peso.

La sensación de «ingravidez» de los astronautas en órbita se explica igual: ellos y su nave caen juntos alrededor de la Tierra, de modo que el suelo de la nave no necesita empujarlos ($N = 0$). Su peso, sin embargo, no ha desaparecido: a la altura de la Estación Espacial sigue siendo cerca del 90 % del que tienen en la superficie, y es precisamente lo que los mantiene en órbita.

## Límites del modelo

- Usamos $g = 9.8\,\mathrm{m/s^2}$ constante. En realidad $g$ varía un poco con la latitud y la altitud (entre unos $9.78$ y $9.83\,\mathrm{m/s^2}$ en la superficie).
- Tratamos los cuerpos como partículas: el peso actúa en un punto y la normal es una sola fuerza, aunque en realidad está repartida por toda la superficie de contacto.
- Suponemos superficies indeformables a escala visible: la normal aparece sin que el apoyo se hunda de forma apreciable.`,
  formulas: [
    {
      name: 'Peso',
      latex: String.raw`W = m\,g`,
      description: 'Módulo de la fuerza gravitatoria sobre un cuerpo cerca de la superficie de un astro. Su dirección es vertical y hacia abajo.',
      variables: [
        { symbol: String.raw`W`, meaning: 'Módulo del peso', unit: 'N' },
        { symbol: String.raw`m`, meaning: 'Masa del cuerpo', unit: 'kg' },
        { symbol: String.raw`g`, meaning: 'Aceleración de la gravedad (9.8 en la Tierra)', unit: 'm/s² = N/kg' },
      ],
      notes: 'La masa es la misma en cualquier lugar; el peso cambia con g.',
    },
    {
      name: 'Normal con fuerza inclinada hacia arriba',
      latex: String.raw`N = m\,g - F\sin\alpha`,
      description:
        'Superficie horizontal, cuerpo sin aceleración vertical y una fuerza F que tira formando un ángulo α sobre la horizontal. Si la fuerza empuja hacia abajo con ese ángulo, el signo cambia: N = mg + F sin α.',
      variables: [
        { symbol: String.raw`N`, meaning: 'Fuerza normal', unit: 'N' },
        { symbol: String.raw`F`, meaning: 'Módulo de la fuerza aplicada', unit: 'N' },
        { symbol: String.raw`\alpha`, meaning: 'Ángulo de la fuerza sobre la horizontal', unit: '°' },
      ],
      notes: 'Si resultara N < 0, el cuerpo se despega de la superficie y la fórmula deja de valer.',
    },
    {
      name: 'Normal sobre un apoyo acelerado verticalmente',
      latex: String.raw`N = m\,(g + a_y)`,
      description:
        'Cuerpo sobre un piso horizontal (ascensor, báscula) que acelera verticalmente, con el eje y hacia arriba. Es la lectura de una báscula: el peso aparente.',
      variables: [
        { symbol: String.raw`a_y`, meaning: 'Aceleración vertical (positiva hacia arriba)', unit: 'm/s²' },
        { symbol: String.raw`N`, meaning: 'Normal = peso aparente', unit: 'N' },
      ],
      notes: 'Lo que importa es el signo de la aceleración, no el sentido de la velocidad.',
    },
    {
      name: 'Normal sobre una superficie inclinada',
      latex: String.raw`N = m\,g\cos\theta`,
      description:
        'Bloque sobre una rampa de ángulo θ cuando ninguna otra fuerza tiene componente perpendicular a la rampa.',
      variables: [{ symbol: String.raw`\theta`, meaning: 'Inclinación de la superficie respecto a la horizontal', unit: '°' }],
    },
  ],
  examples: [
    {
      title: 'Un robot en la Tierra y en Marte',
      statement: String.raw`Un robot explorador tiene una masa de $25\,\mathrm{kg}$. Calcule su peso en la Tierra y en Marte ($g_M = 3.7\,\mathrm{m/s^2}$). ¿Cuál es su masa en Marte?`,
      steps: [
        String.raw`En la Tierra: $W_T = m\,g = (25\,\mathrm{kg})(9.8\,\mathrm{m/s^2}) = 245\,\mathrm{N}$.`,
        String.raw`En Marte: $W_M = m\,g_M = (25\,\mathrm{kg})(3.7\,\mathrm{m/s^2}) = 92.5\,\mathrm{N}$.`,
        String.raw`La masa es una propiedad del cuerpo y no depende del lugar: sigue siendo $25\,\mathrm{kg}$.`,
      ],
      result: String.raw`$W_T \approx 2.5\times10^{2}\,\mathrm{N}$, $W_M \approx 93\,\mathrm{N}$ y $m = 25\,\mathrm{kg}$ en ambos lugares.`,
      interpretation:
        'En Marte el robot pesa unas 2.6 veces menos, pero cuesta lo mismo acelerarlo horizontalmente, porque su inercia (su masa) es la misma.',
    },
    {
      title: 'Arrastrar una maleta con la correa inclinada',
      statement: String.raw`Una viajera arrastra por el piso del aeropuerto una maleta de $18\,\mathrm{kg}$ tirando de la correa con $60\,\mathrm{N}$, a $40^\circ$ sobre la horizontal. La maleta no se despega del piso. ¿Cuánto vale la normal?`,
      steps: [
        String.raw`Fuerzas verticales sobre la maleta: el peso $mg$ hacia abajo, la normal $N$ hacia arriba y la componente vertical de la tensión, $F\sin40^\circ$, hacia arriba.`,
        String.raw`La maleta no sube ni baja, así que $a_y = 0$: $N + F\sin40^\circ - mg = 0$.`,
        String.raw`Peso: $mg = (18\,\mathrm{kg})(9.8\,\mathrm{m/s^2}) = 176.4\,\mathrm{N}$. Componente vertical: $(60\,\mathrm{N})\sin40^\circ = 38.6\,\mathrm{N}$.`,
        String.raw`$N = 176.4\,\mathrm{N} - 38.6\,\mathrm{N} = 137.8\,\mathrm{N}$.`,
      ],
      result: String.raw`$N \approx 138\,\mathrm{N}$, menor que el peso ($176\,\mathrm{N}$).`,
      interpretation:
        'La correa sostiene parte del peso, así que el piso empuja menos. Por eso tirar «hacia arriba» facilita arrastrar objetos: como veremos, la fricción es proporcional a la normal.',
    },
    {
      title: 'Báscula en un ascensor',
      statement: String.raw`Una persona de $70\,\mathrm{kg}$ está de pie sobre una báscula dentro del ascensor de una torre. El ascensor arranca hacia arriba con una aceleración de $1.2\,\mathrm{m/s^2}$. ¿Qué fuerza marca la báscula? ¿Qué «masa» muestra su pantalla, que está calibrada dividiendo entre $9.8$?`,
      steps: [
        String.raw`Eje $y$ hacia arriba. Fuerzas sobre la persona: peso $mg$ hacia abajo y normal $N$ de la báscula hacia arriba. La aceleración es $a_y = +1.2\,\mathrm{m/s^2}$.`,
        String.raw`Segunda ley: $N - mg = m\,a_y \Rightarrow N = m\,(g + a_y) = (70\,\mathrm{kg})(9.8 + 1.2)\,\mathrm{m/s^2} = 770\,\mathrm{N}$.`,
        String.raw`La báscula indica $770\,\mathrm{N} / 9.8\,\mathrm{m/s^2} = 78.6\,\mathrm{kg}$.`,
      ],
      result: String.raw`La báscula soporta $770\,\mathrm{N}$ y muestra unos $78.6\,\mathrm{kg}$, aunque la masa de la persona sigue siendo $70\,\mathrm{kg}$ y su peso, $686\,\mathrm{N}$.`,
      interpretation:
        'La normal debe sostener el peso y, además, proporcionar la fuerza neta hacia arriba que acelera a la persona. Cuando el ascensor alcance velocidad constante, la lectura volverá a 686 N.',
    },
  ],
  simulation: {
    key: 'fuerzas',
    params: { m: 5, F: 0, theta: 0, muS: 1, muK: 0.8, g: 9.8 },
    guide: String.raw`1. Con la superficie horizontal ($\theta = 0$) y $F = 0$, lea el **peso** y la **normal**. Compruebe que $W = mg$ y que, en este caso, $N = W$.
2. Duplique la masa. ¿Cómo cambian el peso y la normal? ¿Se mueve el bloque?
3. Vuelva a $m = 5\,\mathrm{kg}$ y cambie $g$ a $1.6\,\mathrm{m/s^2}$ (la Luna). Anote el nuevo peso. ¿Ha cambiado la masa del bloque?
4. Con $g = 9.8\,\mathrm{m/s^2}$, incline la superficie a $30^\circ$, $45^\circ$ y $60^\circ$. Anote la normal en cada caso y calcule el cociente $N/W$. Compárelo con $\cos\theta$.
5. A $60^\circ$ el bloque desliza. ¿Cambia la normal porque el bloque se mueva? Explique por qué la normal es perpendicular a la superficie y no vertical.`,
  },
  exercises: [
    {
      id: 'b3-peso-01',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['peso-normal-masa-peso'],
      prompt: String.raw`Una astronauta tiene una masa de $60\,\mathrm{kg}$ en la Tierra. Viaja a la Luna, donde $g \approx 1.6\,\mathrm{m/s^2}$. ¿Qué afirmación es correcta?`,
      format: 'choice',
      options: [
        'Su masa y su peso en la Luna son los mismos que en la Tierra.',
        'Su masa sigue siendo 60 kg, pero su peso es unas seis veces menor que en la Tierra.',
        'Su masa es unas seis veces menor, pero su peso es el mismo que en la Tierra.',
        'En la Luna su peso es cero, porque allí no hay atmósfera.',
      ],
    },
    {
      id: 'b3-peso-02',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['peso-normal-masa-peso'],
      prompt: String.raw`Un dinamómetro indica que una maleta tiene un peso de $196\,\mathrm{N}$ en la Tierra. ¿Cuál es su masa?`,
      format: 'numeric',
      unitHint: 'kg',
    },
    {
      id: 'b3-peso-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['peso-normal-fuerza-normal'],
      prompt: String.raw`**Verdadero o falso:** si un objeto está apoyado sobre una superficie horizontal, la fuerza normal sobre él es siempre igual a su peso. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b3-peso-04',
      category: 'numerica',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['peso-normal-fuerza-normal'],
      prompt: String.raw`Un niño tira de un carrito de juguete de $12\,\mathrm{kg}$ por un piso horizontal mediante una cuerda que forma $30^\circ$ con la horizontal. La tensión de la cuerda es $50\,\mathrm{N}$ y el carrito no se levanta del piso. ¿Cuánto vale la fuerza normal del piso sobre el carrito?`,
      format: 'numeric',
      unitHint: 'N',
    },
    {
      id: 'b3-peso-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['peso-normal-peso-aparente', 'ley2-fuerza-neta-aceleracion'],
      prompt: String.raw`Una persona de $60\,\mathrm{kg}$ está de pie sobre una báscula en un ascensor que **baja** y está **frenando** para detenerse en un piso. El módulo de su aceleración es $1.5\,\mathrm{m/s^2}$. ¿Qué fuerza ejerce la báscula sobre la persona?`,
      format: 'numeric',
      unitHint: 'N',
    },
    {
      id: 'b3-peso-06',
      category: 'experimento',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['peso-normal-fuerza-normal'],
      prompt: String.raw`En el simulador, fije $m = 4\,\mathrm{kg}$, $F = 0$, $\theta = 25^\circ$, $\mu_s = 0.6$, $\mu_k = 0.5$ y $g = 9.8\,\mathrm{m/s^2}$. Ejecute la simulación y lea el valor de la **fuerza normal** sobre el bloque. Compruebe después su lectura con un cálculo.`,
      format: 'numeric',
      unitHint: 'N',
      simulation: { key: 'fuerzas', params: { m: 4, F: 0, theta: 25, muS: 0.6, muK: 0.5, g: 9.8 } },
    },
    {
      id: 'b3-peso-07',
      category: 'grafica',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['peso-normal-peso-aparente'],
      prompt: String.raw`Una persona de $60\,\mathrm{kg}$ viaja de pie sobre una báscula en un ascensor. La gráfica muestra la fuerza que indica la báscula durante el viaje. Tome el eje $y$ hacia arriba. ¿Cuál es la aceleración del ascensor entre $t = 0$ y $t = 2\,\mathrm{s}$? Indique el signo.`,
      format: 'numeric',
      unitHint: 'm/s²',
      figure: {
        kind: 'line',
        title: 'Lectura de la báscula frente al tiempo',
        x: { label: 't', unit: 's' },
        y: { label: 'Lectura', unit: 'N' },
        series: [
          {
            name: 'N(t)',
            points: [
              [0, 690],
              [1, 690],
              [2, 690],
              [2.2, 588],
              [4, 588],
              [6, 588],
              [8, 588],
              [8.2, 486],
              [9, 486],
              [10, 486],
            ],
          },
        ],
      },
    },
    {
      id: 'b3-peso-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['peso-normal-peso-aparente', 'peso-normal-masa-peso', 'dcl-procedimiento'],
      prompt: String.raw`Un estudiante de $75\,\mathrm{kg}$ se sube a una báscula en el ascensor de su edificio y anota las lecturas durante un viaje hacia arriba: el ascensor arranca con una aceleración de $2.0\,\mathrm{m/s^2}$, luego sube con velocidad constante y finalmente frena con una aceleración de módulo $2.0\,\mathrm{m/s^2}$.

(a) Dibuje el diagrama de cuerpo libre del estudiante e indique el sistema de ejes.
(b) Calcule la fuerza que marca la báscula en cada una de las tres fases y la «masa» que mostraría una báscula calibrada para dividir entre $9.8$.
(c) ¿Cambia el peso del estudiante durante el viaje? ¿Y su masa? Explique.
(d) ¿Qué marcaría la báscula si el ascensor cayera libremente? Interprete el resultado.`,
      format: 'open',
    },
  ],
};
