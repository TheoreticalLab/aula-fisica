import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'cantidad-movimiento',
  title: 'Cantidad de movimiento y su conservación',
  summary:
    'La cantidad de movimiento p = mv es un vector. En un sistema aislado (fuerza externa neta nula), la cantidad de movimiento total se conserva: lo explican el retroceso de un arma, el empuje entre patinadores y las explosiones.',
  concepts: [
    { slug: 'cantidad-movimiento-definicion', name: 'Cantidad de movimiento: p = mv' },
    { slug: 'cantidad-movimiento-sistema-aislado', name: 'Sistema aislado y fuerzas internas y externas' },
    { slug: 'cantidad-movimiento-conservacion', name: 'Conservación de la cantidad de movimiento' },
    { slug: 'cantidad-movimiento-retroceso', name: 'Retroceso y explosiones en una dimensión' },
  ],
  theory: String.raw`## La cantidad de movimiento

En la lección anterior introdujimos la **cantidad de movimiento** (o momento lineal) de un cuerpo:

$$\vec p = m\,\vec v .$$

Combina en una sola magnitud cuánta masa se mueve y con qué velocidad. Una guagua lenta y una bala rápida pueden tener la misma cantidad de movimiento; detenerlas requiere el mismo impulso.

Conviene compararla con la energía cinética, $K = \tfrac12 m v^2$:

| | Cantidad de movimiento | Energía cinética |
|---|---|---|
| Tipo | **Vector** | Escalar |
| Signo (en 1D) | Positivo o negativo según el sentido | Nunca negativa |
| Dependencia con $v$ | Proporcional a $v$ | Proporcional a $v^2$ |
| Unidad | $\mathrm{kg\cdot m/s}$ | $\mathrm{J}$ |

En una dimensión elegimos un eje y un sentido positivo. Un cuerpo que se mueve en sentido negativo tiene $p < 0$. La cantidad de movimiento **total** de un sistema de varios cuerpos es la **suma vectorial** (con signos, en 1D) de las de cada uno:

$$P = p_1 + p_2 + \dots = m_1 v_1 + m_2 v_2 + \dots$$

Dos carros iguales que se acercan con la misma rapidez tienen $P = 0$, aunque los dos se muevan.

## Fuerzas internas y externas

Para hablar de conservación, primero hay que elegir un **sistema**: un conjunto de cuerpos. Las fuerzas entre cuerpos del sistema son **internas**; las que ejercen cuerpos de fuera son **externas**.

Por la tercera ley de Newton, las fuerzas internas vienen en pares iguales y opuestos y actúan durante el mismo tiempo. Sus impulsos son iguales y opuestos y se cancelan en la suma: **las fuerzas internas no pueden cambiar la cantidad de movimiento total**. Solo las externas pueden hacerlo:

$$\vec F_{ext,neta}\,\Delta t = \Delta \vec P .$$

## La ley de conservación

Un sistema es **aislado** cuando la fuerza externa neta sobre él es cero. Entonces $\Delta P = 0$:

$$P_i = P_f \quad\Rightarrow\quad m_1 v_{1i} + m_2 v_{2i} = m_1 v_{1f} + m_2 v_{2f} .$$

**En un sistema aislado, la cantidad de movimiento total se conserva.** Los cuerpos pueden intercambiar cantidad de movimiento entre sí, pero la suma no cambia.

Dos observaciones prácticas:

- Basta con que la fuerza externa neta sea cero **en la dirección que estudiamos**. Un carro sobre un riel horizontal sin fricción tiene peso y normal, pero se cancelan; en la dirección horizontal el sistema es aislado.
- En choques y explosiones, las fuerzas internas son tan grandes y breves que las externas (fricción, peso) apenas producen impulso durante ese instante. Por eso la conservación vale **justo antes y justo después** del evento, aunque haya fricción.

## Retroceso

Un rifle en reposo dispara una bala. Antes, $P = 0$. Las fuerzas de los gases sobre la bala y sobre el arma son internas, así que después también $P = 0$:

$$0 = m_b v_b + m_r v_r \quad\Rightarrow\quad v_r = -\frac{m_b}{m_r}\,v_b .$$

El rifle sale hacia atrás (signo menos) con una rapidez mucho menor que la de la bala, porque su masa es mucho mayor. Lo mismo explica que un bote retroceda cuando alguien salta de él al muelle, o que un cohete avance al expulsar gases hacia atrás.

## Explosiones

En una explosión, un cuerpo se separa en fragmentos por fuerzas internas. Si el cuerpo se movía, la cantidad de movimiento total después es **la misma que antes**, no cero. La energía cinética, en cambio, **aumenta**: la aporta la energía química de la pólvora o la energía elástica de un resorte comprimido. Es un buen ejemplo de que $P$ y $K$ son magnitudes distintas que obedecen leyes distintas.

## Errores frecuentes

> **Error frecuente.** Sumar las rapideces sin signos. La cantidad de movimiento es un vector: el sentido importa.

> **Error frecuente.** Aplicar la conservación a un sistema que no es aislado, por ejemplo, a un carro que frena por la fricción del suelo. El carro pierde cantidad de movimiento porque la fricción es externa; el sistema carro–Tierra sí la conserva, aunque el cambio de velocidad de la Tierra es imperceptible.

> **Error frecuente.** Suponer que si se conserva $P$, también se conserva $K$. En el retroceso y en las explosiones, $K$ aumenta.

## Límites del modelo

- Trabajamos en una dimensión. En dos o tres dimensiones la conservación se aplica a cada componente por separado.
- Tratamos los cuerpos como partículas y las masas como constantes. Un cohete, cuya masa cambia, requiere un análisis más cuidadoso, aunque la idea física es la misma.`,
  formulas: [
    {
      name: 'Cantidad de movimiento',
      latex: String.raw`\vec p = m\,\vec v`,
      description: 'Producto de la masa por la velocidad; tiene la dirección de la velocidad.',
      variables: [
        { symbol: String.raw`\vec p`, meaning: 'Cantidad de movimiento', unit: 'kg·m/s' },
        { symbol: String.raw`m`, meaning: 'Masa', unit: 'kg' },
        { symbol: String.raw`\vec v`, meaning: 'Velocidad (con signo en 1D)', unit: 'm/s' },
      ],
    },
    {
      name: 'Cambio de la cantidad de movimiento total',
      latex: String.raw`\vec F_{ext,neta}\,\Delta t = \Delta \vec P`,
      description: 'Solo las fuerzas externas cambian la cantidad de movimiento total de un sistema.',
      variables: [
        { symbol: String.raw`\vec F_{ext,neta}`, meaning: 'Fuerza externa neta sobre el sistema', unit: 'N' },
        { symbol: String.raw`\vec P`, meaning: 'Cantidad de movimiento total del sistema', unit: 'kg·m/s' },
      ],
    },
    {
      name: 'Conservación en un sistema aislado (1D)',
      latex: String.raw`m_1 v_{1i} + m_2 v_{2i} = m_1 v_{1f} + m_2 v_{2f}`,
      description: 'Si la fuerza externa neta es cero, la cantidad de movimiento total antes y después es la misma.',
      variables: [
        { symbol: String.raw`v_{1i},\,v_{2i}`, meaning: 'Velocidades iniciales (con signo)', unit: 'm/s' },
        { symbol: String.raw`v_{1f},\,v_{2f}`, meaning: 'Velocidades finales (con signo)', unit: 'm/s' },
      ],
    },
    {
      name: 'Velocidad de retroceso',
      latex: String.raw`v_2 = -\frac{m_1}{m_2}\,v_1`,
      description: 'Dos cuerpos inicialmente en reposo que se separan por fuerzas internas.',
      variables: [
        { symbol: String.raw`m_1,\,v_1`, meaning: 'Masa y velocidad del cuerpo expulsado', unit: 'kg, m/s' },
        { symbol: String.raw`m_2,\,v_2`, meaning: 'Masa y velocidad del cuerpo que retrocede', unit: 'kg, m/s' },
      ],
      notes: 'El signo menos indica sentido opuesto.',
    },
  ],
  examples: [
    {
      title: 'Retroceso de un rifle',
      statement: String.raw`Un rifle de $3.5\,\mathrm{kg}$, en reposo y sin apoyar, dispara una bala de $8.0\,\mathrm{g}$ que sale a $380\,\mathrm{m/s}$. ¿Con qué velocidad retrocede el rifle?`,
      steps: [
        String.raw`Sistema: rifle + bala. Las fuerzas de los gases son internas; las externas (peso y sostén) se equilibran: el sistema es aislado en la dirección horizontal.`,
        String.raw`Positivo en el sentido de la bala. $P_i = 0 = (0.0080)(380) + (3.5)\,v_r$.`,
        String.raw`$v_r = -\dfrac{3.04\,\mathrm{kg\cdot m/s}}{3.5\,\mathrm{kg}} = -0.87\,\mathrm{m/s}$.`,
      ],
      result: String.raw`$v_r \approx -0.87\,\mathrm{m/s}$: el rifle retrocede a $0.87\,\mathrm{m/s}$.`,
      interpretation: 'Apoyado en el hombro, el retroceso lo absorbe el sistema rifle + tirador, de masa mucho mayor, y la velocidad de retroceso es menor.',
    },
    {
      title: 'Patinadores que se empujan',
      statement: String.raw`Dos patinadores en reposo sobre hielo, de $80\,\mathrm{kg}$ y $50\,\mathrm{kg}$, se empujan mutuamente. El de $50\,\mathrm{kg}$ sale hacia la izquierda a $2.4\,\mathrm{m/s}$. ¿Qué velocidad adquiere el otro?`,
      steps: [
        String.raw`Positivo hacia la derecha. Sobre hielo la fricción es despreciable: sistema aislado y $P_i = 0$.`,
        String.raw`$0 = (50)(-2.4) + (80)\,v \Rightarrow v = \dfrac{120}{80} = +1.5\,\mathrm{m/s}$.`,
      ],
      result: String.raw`$v = +1.5\,\mathrm{m/s}$: el patinador de $80\,\mathrm{kg}$ sale hacia la derecha a $1.5\,\mathrm{m/s}$.`,
      interpretation: 'Ambos reciben impulsos iguales y opuestos (120 N·s), pero el más pesado cambia menos su velocidad.',
    },
    {
      title: 'Un cohete de feria que se parte en dos',
      statement: String.raw`Un cohete de $0.80\,\mathrm{kg}$ avanza horizontalmente a $10\,\mathrm{m/s}$ cuando explota en dos fragmentos. Uno de $0.30\,\mathrm{kg}$ sale hacia atrás a $5.0\,\mathrm{m/s}$. Halle la velocidad del otro y compare la energía cinética antes y después.`,
      steps: [
        String.raw`Positivo hacia adelante. $P_i = (0.80)(10) = 8.0\,\mathrm{kg\cdot m/s}$.`,
        String.raw`Después: $8.0 = (0.30)(-5.0) + (0.50)\,v \Rightarrow 0.50\,v = 9.5 \Rightarrow v = 19\,\mathrm{m/s}$.`,
        String.raw`$K_i = \tfrac12(0.80)(10)^2 = 40\,\mathrm{J}$; $K_f = \tfrac12(0.30)(5.0)^2 + \tfrac12(0.50)(19)^2 = 3.75 + 90.25 = 94\,\mathrm{J}$.`,
      ],
      result: String.raw`El fragmento de $0.50\,\mathrm{kg}$ sale a $+19\,\mathrm{m/s}$; la energía cinética pasa de $40\,\mathrm{J}$ a $94\,\mathrm{J}$.`,
      interpretation: 'La cantidad de movimiento se conserva; la energía cinética aumenta 54 J, que provienen de la energía química de la pólvora.',
    },
  ],
  simulation: null,
  exercises: [
    {
      id: 'b4-cmov-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['cantidad-movimiento-definicion'],
      prompt: String.raw`Un motoconcho (moto, conductor y pasajero: $180\,\mathrm{kg}$ en total) circula a $54\,\mathrm{km/h}$. ¿Cuál es el módulo de su cantidad de movimiento?`,
      format: 'numeric',
      unitHint: 'kg·m/s',
    },
    {
      id: 'b4-cmov-02',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['cantidad-movimiento-definicion'],
      prompt: String.raw`¿Cuál de los siguientes cuerpos tiene **mayor** cantidad de movimiento (en módulo)?`,
      format: 'choice',
      options: [
        String.raw`Una bala de $10\,\mathrm{g}$ a $400\,\mathrm{m/s}$.`,
        String.raw`Una pelota de béisbol de $0.145\,\mathrm{kg}$ a $40\,\mathrm{m/s}$.`,
        String.raw`Un corredor de $70\,\mathrm{kg}$ a $9.0\,\mathrm{m/s}$.`,
        String.raw`Un carro de $1000\,\mathrm{kg}$ a $1.5\,\mathrm{m/s}$.`,
      ],
    },
    {
      id: 'b4-cmov-03',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['cantidad-movimiento-retroceso', 'cantidad-movimiento-conservacion'],
      prompt: String.raw`Un rifle de $4.0\,\mathrm{kg}$, en reposo y suspendido libremente, dispara una bala de $10\,\mathrm{g}$ que sale a $400\,\mathrm{m/s}$. Tome como positivo el sentido en que sale la bala. ¿Cuál es la **velocidad** de retroceso del rifle (con su signo)?`,
      format: 'numeric',
      unitHint: 'm/s',
    },
    {
      id: 'b4-cmov-04',
      category: 'vf_justificacion',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['cantidad-movimiento-sistema-aislado', 'cantidad-movimiento-conservacion'],
      prompt: String.raw`**Verdadero o falso:** un carro frena por la fricción del asfalto hasta detenerse. Como su cantidad de movimiento pasa de $m v$ a cero, este ejemplo demuestra que la ley de conservación de la cantidad de movimiento no siempre se cumple. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b4-cmov-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['cantidad-movimiento-retroceso', 'cantidad-movimiento-conservacion'],
      prompt: String.raw`Un objeto de $6.0\,\mathrm{kg}$ se desliza por una superficie horizontal sin fricción a $+4.0\,\mathrm{m/s}$ cuando una pequeña carga explosiva interna lo parte en dos fragmentos que siguen moviéndose a lo largo de la misma recta. El fragmento de $2.0\,\mathrm{kg}$ sale a $+14\,\mathrm{m/s}$. ¿Cuál es la **velocidad** (con su signo) del fragmento de $4.0\,\mathrm{kg}$?`,
      format: 'numeric',
      unitHint: 'm/s',
    },
    {
      id: 'b4-cmov-06',
      category: 'error',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['cantidad-movimiento-conservacion', 'cantidad-movimiento-retroceso'],
      prompt: String.raw`Un estudiante resolvió así este problema: *«Dos patinadores de $50\,\mathrm{kg}$ y $75\,\mathrm{kg}$ están en reposo sobre hielo y se empujan. El de $50\,\mathrm{kg}$ sale a $+3.0\,\mathrm{m/s}$. ¿Cuál es la velocidad del otro?»*

1. Sobre hielo no hay fricción apreciable: el sistema es aislado y $P_i = 0$.
2. Conservación: $0 = (50)(3.0) + (75)\,v$.
3. Despeje: $v = \dfrac{(50)(3.0)}{75} = +2.0\,\mathrm{m/s}$.
4. El patinador de $75\,\mathrm{kg}$ se mueve a $2.0\,\mathrm{m/s}$ en el mismo sentido que el otro.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'No hay ningún error'],
    },
    {
      id: 'b4-cmov-07',
      category: 'conceptual',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['cantidad-movimiento-sistema-aislado'],
      prompt: String.raw`¿Qué condición debe cumplir un sistema de cuerpos para que su cantidad de movimiento total se conserve?`,
      format: 'choice',
      options: [
        'Que no haya fuerzas internas entre los cuerpos.',
        'Que la fuerza externa neta sobre el sistema sea cero.',
        'Que la energía cinética total se conserve.',
        'Que todos los cuerpos tengan la misma masa.',
      ],
    },
    {
      id: 'b4-cmov-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['cantidad-movimiento-conservacion', 'cantidad-movimiento-retroceso', 'cantidad-movimiento-sistema-aislado'],
      prompt: String.raw`Un pescador de $60\,\mathrm{kg}$ está de pie en un bote de $40\,\mathrm{kg}$ en reposo junto al muelle. Salta horizontalmente hacia el muelle con una velocidad de $3.0\,\mathrm{m/s}$ respecto al agua. Desprecie la resistencia del agua.

(a) Defina el sistema, identifique las fuerzas internas y externas, y justifique que la cantidad de movimiento horizontal se conserva.
(b) Calcule la velocidad del bote justo después del salto.
(c) Calcule la energía cinética total antes y después. ¿De dónde sale la energía?
(d) Explique por qué es más fácil saltar a tierra desde un barco grande que desde un bote pequeño.`,
      format: 'open',
    },
  ],
};
