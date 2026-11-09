import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'energia-potencial',
  title: 'Energía potencial gravitatoria y elástica',
  summary:
    'La energía potencial es energía almacenada en la configuración de un sistema: la altura de un cuerpo en el campo gravitatorio (U = mgy) o la deformación de un resorte (U = ½kx²). Solo sus cambios tienen significado físico.',
  concepts: [
    { slug: 'energia-potencial-gravitatoria', name: 'Energía potencial gravitatoria: U = mgy' },
    { slug: 'energia-potencial-nivel-cero', name: 'Elección del nivel cero de energía potencial' },
    { slug: 'energia-potencial-hooke', name: 'Ley de Hooke: F = −kx' },
    { slug: 'energia-potencial-elastica', name: 'Energía potencial elástica: U = ½kx²' },
  ],
  theory: String.raw`## Energía almacenada

Un coco en lo alto de una palma no se mueve, pero «guarda» la posibilidad de moverse: si se desprende, ganará rapidez al caer. Un arco tensado o un resorte comprimido de un juguete también guardan energía que pueden liberar. Esa energía almacenada en la **posición o configuración** de un sistema se llama **energía potencial**, $U$.

La energía potencial está asociada a ciertas fuerzas, llamadas **conservativas**, cuyo trabajo depende solo de las posiciones inicial y final y no del camino seguido. El peso y la fuerza de un resorte ideal son conservativas; la fricción no lo es. Para una fuerza conservativa se define

$$W_{cons} = -\Delta U = U_i - U_f .$$

Es decir: cuando la fuerza realiza trabajo positivo, la energía potencial **disminuye**, y viceversa.

## Energía potencial gravitatoria

Cerca de la superficie terrestre el peso vale $mg$ y apunta hacia abajo. Si un cuerpo sube una altura $h$, el peso realiza un trabajo $-mgh$ (fuerza y desplazamiento opuestos). Si baja, $+mgh$. Lo mismo ocurre si el cuerpo sube por una escalera, una rampa o una trayectoria curva: solo cuenta el **desnivel vertical**. Esto conduce a

$$U_g = m\,g\,y ,$$

donde $y$ es la altura medida sobre un **nivel de referencia** elegido libremente.

### El nivel cero es una elección

¿Desde dónde se mide $y$? Desde donde uno quiera: el piso, la mesa, el nivel del mar. Cambiar el nivel cero suma la misma constante a todas las energías potenciales, pero **no cambia sus diferencias**, y lo único que tiene consecuencias físicas son las diferencias $\Delta U$. Dos estudiantes que eligen ceros distintos obtendrán valores distintos de $U$, pero el mismo $\Delta U$ y las mismas rapideces.

Consecuencias:

- $U_g$ **puede ser negativa**: basta con que el cuerpo esté por debajo del nivel cero (por ejemplo, un balde en el fondo de un pozo si el cero está en el brocal).
- Elija el cero donde simplifique las cuentas, normalmente en el punto más bajo del problema. Y **no lo cambie** a mitad del problema.

## Fuerza elástica y ley de Hooke

Al estirar o comprimir un resorte, este tira o empuja hacia su **longitud natural**. Para deformaciones no muy grandes, la fuerza es proporcional a la deformación (**ley de Hooke**):

$$F_x = -k\,x ,$$

donde $x$ es el **estiramiento o compresión medido desde la longitud natural** y $k$ es la **constante elástica**, en $\mathrm{N/m}$. Un resorte duro (la suspensión de un carro) tiene $k$ grande; uno blando (el de un bolígrafo), $k$ pequeña. El signo menos indica que la fuerza se opone a la deformación: si se estira hacia $+x$, el resorte tira hacia $-x$.

## Energía potencial elástica

Para estirar un resorte desde su longitud natural hasta una deformación $x$, hay que aplicar una fuerza que crece de $0$ a $kx$. En la gráfica fuerza–estiramiento, esa fuerza es una recta que pasa por el origen y el trabajo es el **área de un triángulo** de base $x$ y altura $kx$:

$$U_e = \tfrac12\,k\,x^2 .$$

Esa es la energía almacenada en el resorte. Observe:

- $U_e \ge 0$ tanto si se estira ($x > 0$) como si se comprime ($x < 0$), porque $x$ está al cuadrado.
- El cero de $U_e$ está **fijado** en la longitud natural; aquí no hay libertad de elección.
- Depende de $x^2$: al duplicar la deformación, la energía se **cuadruplica**.

## Errores frecuentes

> **Error frecuente.** Medir $x$ desde un extremo cualquiera o usar la longitud total del resorte. En $U_e = \tfrac12 k x^2$, $x$ es la **deformación** respecto a la longitud natural.

> **Error frecuente.** Calcular la energía para pasar de $x_1$ a $x_2$ como $\tfrac12 k (x_2 - x_1)^2$. Lo correcto es la diferencia $\tfrac12 k x_2^2 - \tfrac12 k x_1^2$.

> **Cuidado.** Convertir centímetros a metros antes de sustituir en $\tfrac12 k x^2$: como $x$ va al cuadrado, olvidar la conversión da un error de un factor $10\,000$.

## Límites del modelo

- $U_g = mgy$ supone $g$ constante, lo que vale para alturas pequeñas frente al radio terrestre (miles de kilómetros). Para satélites se usa otra expresión.
- La ley de Hooke deja de valer si el resorte se estira demasiado: se deforma permanentemente y ya no recupera su forma.
- La energía potencial pertenece al **sistema** (cuerpo y Tierra, o cuerpo y resorte), no al cuerpo solo, aunque por comodidad digamos «la energía potencial del coco».`,
  formulas: [
    {
      name: 'Energía potencial gravitatoria',
      latex: String.raw`U_g = m\,g\,y`,
      description: 'Energía potencial de un cuerpo a altura y sobre el nivel de referencia elegido.',
      variables: [
        { symbol: String.raw`U_g`, meaning: 'Energía potencial gravitatoria', unit: 'J' },
        { symbol: String.raw`m`, meaning: 'Masa', unit: 'kg' },
        { symbol: String.raw`g`, meaning: 'Aceleración de la gravedad', unit: 'm/s²' },
        { symbol: String.raw`y`, meaning: 'Altura sobre el nivel cero (negativa si está por debajo)', unit: 'm' },
      ],
      notes: 'Solo ΔU = mg Δy tiene significado físico; el nivel cero es arbitrario.',
    },
    {
      name: 'Ley de Hooke',
      latex: String.raw`F_x = -k\,x`,
      description: 'Fuerza que ejerce un resorte ideal deformado una cantidad x desde su longitud natural.',
      variables: [
        { symbol: String.raw`F_x`, meaning: 'Fuerza del resorte (con signo)', unit: 'N' },
        { symbol: String.raw`k`, meaning: 'Constante elástica', unit: 'N/m' },
        { symbol: String.raw`x`, meaning: 'Deformación desde la longitud natural', unit: 'm' },
      ],
    },
    {
      name: 'Energía potencial elástica',
      latex: String.raw`U_e = \tfrac12\,k\,x^2`,
      description: 'Energía almacenada en un resorte deformado una cantidad x.',
      variables: [
        { symbol: String.raw`U_e`, meaning: 'Energía potencial elástica', unit: 'J' },
        { symbol: String.raw`k`, meaning: 'Constante elástica', unit: 'N/m' },
        { symbol: String.raw`x`, meaning: 'Estiramiento o compresión', unit: 'm' },
      ],
      notes: 'Es el área del triángulo bajo la recta F = kx entre 0 y x.',
    },
    {
      name: 'Trabajo de una fuerza conservativa',
      latex: String.raw`W_{cons} = -\Delta U = U_i - U_f`,
      description: 'El trabajo del peso o de un resorte es igual a la disminución de la energía potencial correspondiente.',
      variables: [
        { symbol: String.raw`W_{cons}`, meaning: 'Trabajo de la fuerza conservativa', unit: 'J' },
        { symbol: String.raw`U_i,\,U_f`, meaning: 'Energía potencial inicial y final', unit: 'J' },
      ],
    },
  ],
  examples: [
    {
      title: 'Subir al mirador',
      statement: String.raw`Una turista de $55\,\mathrm{kg}$ sube por una escalera de caracol hasta un mirador situado $18\,\mathrm{m}$ por encima de la entrada. ¿Cuánto aumenta la energía potencial gravitatoria del sistema turista–Tierra? ¿Qué trabajo realiza el peso?`,
      steps: [
        String.raw`Tomamos el nivel cero en la entrada. Solo importa el desnivel, no la forma de la escalera: $\Delta y = 18\,\mathrm{m}$.`,
        String.raw`$\Delta U = m g \Delta y = (55\,\mathrm{kg})(9.8\,\mathrm{m/s^2})(18\,\mathrm{m}) = 9702\,\mathrm{J}$.`,
        String.raw`Trabajo del peso: $W_{mg} = -\Delta U = -9.7\times10^{3}\,\mathrm{J}$.`,
      ],
      result: String.raw`$\Delta U \approx 9.7\,\mathrm{kJ}$ y $W_{mg} \approx -9.7\,\mathrm{kJ}$.`,
      interpretation: 'El peso realiza trabajo negativo porque apunta hacia abajo mientras la turista sube. La energía la aportan sus músculos.',
    },
    {
      title: 'El mismo libro, dos niveles cero',
      statement: String.raw`Un libro de $1.5\,\mathrm{kg}$ está en un estante a $2.0\,\mathrm{m}$ del piso y cae sobre una mesa de $0.80\,\mathrm{m}$ de altura. Calcule $U$ inicial, $U$ final y $\Delta U$ tomando el cero (a) en el piso y (b) en la mesa.`,
      steps: [
        String.raw`(a) Cero en el piso: $U_i = (1.5)(9.8)(2.0) = 29.4\,\mathrm{J}$; $U_f = (1.5)(9.8)(0.80) = 11.8\,\mathrm{J}$; $\Delta U = -17.6\,\mathrm{J}$.`,
        String.raw`(b) Cero en la mesa: $U_i = (1.5)(9.8)(1.2) = 17.6\,\mathrm{J}$; $U_f = 0$; $\Delta U = -17.6\,\mathrm{J}$.`,
      ],
      result: String.raw`Los valores de $U$ dependen del cero elegido, pero en ambos casos $\Delta U = -17.6\,\mathrm{J}$.`,
      interpretation: 'La física (por ejemplo, la rapidez con que el libro llega a la mesa) depende solo de ΔU, así que ambos estudiantes obtendrán el mismo resultado.',
    },
    {
      title: 'Resorte de un juguete',
      statement: String.raw`Un lanzador de juguete tiene un resorte de constante $k = 320\,\mathrm{N/m}$. Para cargarlo, se comprime $4.0\,\mathrm{cm}$. ¿Qué fuerza hay que hacer al final y cuánta energía queda almacenada?`,
      steps: [
        String.raw`Convertimos: $x = 4.0\,\mathrm{cm} = 0.040\,\mathrm{m}$.`,
        String.raw`Fuerza (módulo): $F = k x = (320\,\mathrm{N/m})(0.040\,\mathrm{m}) = 12.8\,\mathrm{N}$.`,
        String.raw`Energía: $U_e = \tfrac12 (320\,\mathrm{N/m})(0.040\,\mathrm{m})^2 = 160 \times 0.0016 = 0.256\,\mathrm{J}$.`,
      ],
      result: String.raw`$F = 12.8\,\mathrm{N}$ y $U_e \approx 0.26\,\mathrm{J}$.`,
      interpretation: 'La energía almacenada es la mitad de F·x (12.8 × 0.040 = 0.512 J), porque la fuerza crece desde cero: es el área de un triángulo, no de un rectángulo.',
    },
  ],
  simulation: null,
  exercises: [
    {
      id: 'b4-epot-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['energia-potencial-gravitatoria'],
      prompt: String.raw`Un estudiante de $60\,\mathrm{kg}$ sube por las escaleras desde la planta baja (primer nivel) hasta el cuarto nivel de un edificio de la universidad. Cada nivel tiene $3.0\,\mathrm{m}$ de altura. ¿Cuánto aumenta la energía potencial gravitatoria del sistema estudiante–Tierra?`,
      format: 'numeric',
      unitHint: 'J',
    },
    {
      id: 'b4-epot-02',
      category: 'conceptual',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['energia-potencial-nivel-cero'],
      prompt: String.raw`Ana y Luis estudian la caída de una piedra desde un puente. Ana toma el nivel cero de energía potencial en el puente y Luis, en el río. ¿Cuál de las siguientes magnitudes calcularán **igual** los dos?`,
      format: 'choice',
      options: [
        'La energía potencial de la piedra antes de soltarla.',
        'La energía potencial de la piedra al llegar al agua.',
        'El cambio de energía potencial de la piedra durante la caída.',
        'Ninguna: todas dependen del nivel cero.',
      ],
    },
    {
      id: 'b4-epot-03',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['energia-potencial-elastica'],
      prompt: String.raw`Un resorte de constante $k = 200\,\mathrm{N/m}$ se comprime $5.0\,\mathrm{cm}$ desde su longitud natural. ¿Cuánta energía potencial elástica almacena?`,
      format: 'numeric',
      unitHint: 'J',
    },
    {
      id: 'b4-epot-04',
      category: 'grafica',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['energia-potencial-hooke', 'energia-potencial-elastica'],
      prompt: String.raw`En el laboratorio se midió la fuerza necesaria para mantener estirado un resorte en función de su estiramiento. Los datos aparecen en la gráfica. ¿Cuánta energía potencial elástica almacena el resorte cuando está estirado $0.20\,\mathrm{m}$?`,
      format: 'numeric',
      unitHint: 'J',
      figure: {
        kind: 'scatter',
        title: 'Fuerza aplicada frente a estiramiento',
        x: { label: 'x', unit: 'm' },
        y: { label: 'F', unit: 'N' },
        series: [
          {
            name: 'Mediciones',
            points: [
              [0, 0],
              [0.05, 7.5],
              [0.1, 15],
              [0.15, 22.5],
              [0.2, 30],
              [0.25, 37.5],
              [0.3, 45],
            ],
          },
        ],
      },
    },
    {
      id: 'b4-epot-05',
      category: 'error',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['energia-potencial-elastica'],
      prompt: String.raw`Un estudiante resolvió así este problema: *«Un resorte de constante $k = 400\,\mathrm{N/m}$ está estirado $0.10\,\mathrm{m}$. ¿Cuánta energía adicional hay que darle para estirarlo hasta $0.20\,\mathrm{m}$?»*

1. La energía elástica es $U_e = \tfrac12 k x^2$, con $x$ medido desde la longitud natural.
2. El estiramiento adicional es $\Delta x = 0.20 - 0.10 = 0.10\,\mathrm{m}$, así que $\Delta U = \tfrac12 k (\Delta x)^2$.
3. $\Delta U = \tfrac12 (400)(0.10)^2 = 2.0\,\mathrm{J}$.
4. Respuesta: hay que aportar $2.0\,\mathrm{J}$.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'No hay ningún error'],
    },
    {
      id: 'b4-epot-06',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['energia-potencial-nivel-cero', 'energia-potencial-gravitatoria'],
      prompt: String.raw`**Verdadero o falso:** la energía potencial gravitatoria de un cuerpo nunca puede ser negativa. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b4-epot-07',
      category: 'numerica',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['energia-potencial-nivel-cero', 'energia-potencial-gravitatoria'],
      prompt: String.raw`Un coco de $0.40\,\mathrm{kg}$ cuelga de una palma a $8.0\,\mathrm{m}$ sobre el suelo. Una persona lo observa desde un balcón situado a $3.0\,\mathrm{m}$ sobre el suelo. Tomando el **nivel cero en el balcón**, ¿cuál es la energía potencial gravitatoria del coco?`,
      format: 'numeric',
      unitHint: 'J',
    },
    {
      id: 'b4-epot-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['energia-potencial-hooke', 'energia-potencial-elastica', 'energia-potencial-gravitatoria'],
      prompt: String.raw`Se cuelga una masa de $0.50\,\mathrm{kg}$ de un resorte vertical y, en equilibrio, el resorte queda estirado $4.9\,\mathrm{cm}$.

(a) Determine la constante elástica del resorte con la ley de Hooke.
(b) Calcule la energía elástica almacenada en esa posición de equilibrio.
(c) Al colgar la masa, esta bajó $4.9\,\mathrm{cm}$. Calcule cuánto disminuyó la energía potencial gravitatoria y compárela con el resultado de (b).
(d) Las dos energías de (b) y (c) no coinciden. Explique adónde fue la diferencia si la masa se bajó lentamente con la mano, y qué habría pasado si se hubiera soltado de golpe.`,
      format: 'open',
    },
  ],
};
