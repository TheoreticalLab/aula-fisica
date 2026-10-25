import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'lanzamiento-vertical',
  title: 'Lanzamiento vertical',
  summary:
    'Un objeto lanzado hacia arriba o hacia abajo se mueve con la misma aceleración −g que en la caída libre: sube frenando, se detiene un instante y baja acelerando.',
  concepts: [
    { slug: 'lanzamiento-vertical-subida', name: 'Tiempo de subida y altura máxima' },
    { slug: 'lanzamiento-vertical-punto-alto', name: 'Velocidad y aceleración en el punto más alto' },
    { slug: 'lanzamiento-vertical-simetria', name: 'Simetría entre la subida y la bajada' },
    { slug: 'lanzamiento-vertical-desde-altura', name: 'Lanzamientos desde una altura (hacia arriba o hacia abajo)' },
  ],
  theory: String.raw`## Lanzar hacia arriba

Cuando un pelotero lanza una pelota de béisbol verticalmente hacia arriba, la pelota sube cada vez más despacio, se detiene un instante y vuelve a bajar cada vez más rápido. Una vez que la pelota ha salido de la mano, y si despreciamos el aire, **lo único que actúa sobre ella es la gravedad**. Por tanto, su aceleración es la misma que en la caída libre: $g = 9.8\,\mathrm{m/s^2}$ hacia abajo, **durante todo el movimiento**: al subir, en el punto más alto y al bajar.

El lanzamiento vertical es, entonces, una caída libre con velocidad inicial distinta de cero. Con el eje $y$ **hacia arriba**, la aceleración es $a = -g$ y las ecuaciones del MRUA quedan

$$v = v_0 - g\,t, \qquad y = y_0 + v_0\,t - \tfrac12 g\,t^2, \qquad v^2 = v_0^2 - 2g\,(y - y_0).$$

El signo de $v_0$ indica el sentido del lanzamiento: **$v_0 > 0$ hacia arriba** y **$v_0 < 0$ hacia abajo**. La última ecuación no contiene el tiempo y es útil cuando se conocen alturas y velocidades.

## La subida: tiempo de subida y altura máxima

Mientras sube, la velocidad es positiva y disminuye $9.8\,\mathrm{m/s}$ cada segundo. Una pelota lanzada a $19.6\,\mathrm{m/s}$ lleva $9.8\,\mathrm{m/s}$ al cabo de $1\,\mathrm{s}$ y se detiene a los $2\,\mathrm{s}$. En general, la pelota deja de subir cuando $v = 0$:

$$0 = v_0 - g\,t_s \quad\Rightarrow\quad t_s = \frac{v_0}{g}.$$

Si sustituimos $t_s$ en la ecuación de la posición, obtenemos la altura máxima **medida desde el punto de lanzamiento**:

$$H = v_0\,t_s - \tfrac12 g\,t_s^2 = \frac{v_0^2}{g} - \frac{v_0^2}{2g} = \frac{v_0^2}{2g}.$$

Se llega a lo mismo con $v^2 = v_0^2 - 2gH$ y $v = 0$. Observe la dependencia con $v_0$: **si se duplica la rapidez de lanzamiento, el tiempo de subida se duplica, pero la altura máxima se cuadruplica.** Si el lanzamiento se hace desde una altura $y_0$, la altura máxima sobre el suelo es $y_0 + H$.

## El punto más alto: v = 0, pero a ≠ 0

> **Error frecuente.** «En el punto más alto la pelota se detiene, así que su aceleración es cero.» Es falso. En el punto más alto la **velocidad** es cero, pero la **aceleración** sigue siendo $-g$.

La aceleración mide cómo **cambia** la velocidad, no cuánto vale. Medio segundo antes del punto más alto la velocidad es $+4.9\,\mathrm{m/s}$; en el punto más alto, $0$; medio segundo después, $-4.9\,\mathrm{m/s}$. La velocidad sigue cambiando al mismo ritmo, $-9.8\,\mathrm{m/s}$ cada segundo, también al pasar por cero. Si la aceleración se anulara en ese instante, la velocidad dejaría de cambiar y la pelota se quedaría flotando en el aire, lo que nunca ocurre.

En la gráfica $v$–$t$, todo el movimiento (subida y bajada) es **una sola recta** de pendiente $-g$ que corta el eje del tiempo en $t_s$. Que corte el eje no significa que cambie su pendiente.

## Simetría entre la subida y la bajada

Sin aire, el movimiento de bajada es la «película» de la subida proyectada al revés:

- La pelota tarda **lo mismo en bajar que en subir**. Si vuelve al punto de lanzamiento, el tiempo total es $2t_s = 2v_0/g$.
- Al pasar por una misma altura, la rapidez es la misma al subir y al bajar; solo cambia el sentido de la velocidad. En particular, regresa al punto de lanzamiento con velocidad $-v_0$.
- La gráfica $y$–$t$ es una parábola simétrica respecto al instante $t_s$.

## Lanzar hacia abajo

Si se lanza un objeto hacia abajo, $v_0 < 0$. La aceleración sigue siendo $-g$, así que la rapidez aumenta desde el principio. El objeto llega al suelo antes y más rápido que si se soltara desde el reposo.

## Lanzamiento desde un edificio

Supongamos que desde una azotea de altura $h$ se lanza una piedra con velocidad $v_0$ (hacia arriba o hacia abajo). Con el origen en el suelo, $y_0 = h$, y la piedra llega al suelo cuando $y = 0$:

$$0 = h + v_0\,t - \tfrac12 g\,t^2 .$$

Es una ecuación de segundo grado en $t$. Tiene una raíz positiva, que es la respuesta, y una negativa, que se descarta: correspondería a un instante anterior al lanzamiento, cuando la piedra todavía estaba en la mano.

La rapidez de impacto se obtiene con $v^2 = v_0^2 + 2gh$. Como $v_0$ aparece al cuadrado, **la piedra llega al suelo con la misma rapidez tanto si se lanza hacia arriba como si se lanza hacia abajo** con la misma rapidez inicial. Esto concuerda con la simetría: la piedra lanzada hacia arriba vuelve a pasar por la azotea con velocidad $-v_0$ y desde allí repite exactamente el movimiento de la lanzada hacia abajo. Lo que cambia es el **tiempo**: la lanzada hacia arriba tarda $2v_0/g$ más.

> **Cuidado.** En estos problemas el error más común es el de signos. Fije el eje al principio (por ejemplo, hacia arriba con origen en el suelo), escriba $v_0$ con su signo y use siempre $a = -g$, tanto si el objeto sube como si baja.

## Límites del modelo

Con aire, la simetría se rompe: la resistencia frena el objeto tanto al subir como al bajar, de modo que alcanza menos altura, tarda más en bajar que en subir y vuelve a la mano con menos rapidez de la que salió. Para objetos compactos lanzados a pocos metros por segundo (una pelota de béisbol, una piedra, unas llaves), el efecto es pequeño y el modelo funciona bien.`,
  formulas: [
    {
      name: 'Velocidad',
      latex: String.raw`v = v_0 - g\,t`,
      description: 'La velocidad disminuye 9.8 m/s cada segundo, tanto al subir como al bajar (eje y hacia arriba).',
      variables: [
        { symbol: String.raw`v`, meaning: 'Velocidad en el instante t (+ hacia arriba)', unit: 'm/s' },
        { symbol: String.raw`v_0`, meaning: 'Velocidad de lanzamiento (+ hacia arriba, − hacia abajo)', unit: 'm/s' },
        { symbol: String.raw`g`, meaning: 'Módulo de la aceleración de la gravedad', unit: 'm/s²' },
        { symbol: String.raw`t`, meaning: 'Tiempo desde el lanzamiento', unit: 's' },
      ],
    },
    {
      name: 'Posición',
      latex: String.raw`y = y_0 + v_0\,t - \tfrac12 g\,t^2`,
      description: 'Altura en función del tiempo para un objeto lanzado verticalmente desde la altura y₀.',
      variables: [
        { symbol: String.raw`y`, meaning: 'Altura en el instante t', unit: 'm' },
        { symbol: String.raw`y_0`, meaning: 'Altura del punto de lanzamiento', unit: 'm' },
        { symbol: String.raw`v_0`, meaning: 'Velocidad de lanzamiento (con signo)', unit: 'm/s' },
        { symbol: String.raw`t`, meaning: 'Tiempo desde el lanzamiento', unit: 's' },
      ],
      notes: 'Para hallar cuándo llega al suelo se iguala y = 0 y se resuelve la ecuación de segundo grado; se descarta la raíz negativa.',
    },
    {
      name: 'Velocidad y posición sin el tiempo',
      latex: String.raw`v^2 = v_0^2 - 2g\,(y - y_0)`,
      description: 'Relaciona la velocidad con la altura sin necesidad de conocer el tiempo.',
      variables: [
        { symbol: String.raw`v`, meaning: 'Velocidad a la altura y', unit: 'm/s' },
        { symbol: String.raw`y - y_0`, meaning: 'Desplazamiento vertical desde el punto de lanzamiento', unit: 'm' },
      ],
      notes: 'Da v²: el signo de v (subiendo o bajando) hay que decidirlo por el contexto.',
    },
    {
      name: 'Tiempo de subida',
      latex: String.raw`t_s = \dfrac{v_0}{g}`,
      description: 'Tiempo que tarda en llegar al punto más alto un objeto lanzado hacia arriba con rapidez v₀.',
      variables: [
        { symbol: String.raw`t_s`, meaning: 'Tiempo de subida', unit: 's' },
        { symbol: String.raw`v_0`, meaning: 'Rapidez de lanzamiento hacia arriba', unit: 'm/s' },
      ],
      notes: 'Sin aire, el tiempo de bajada hasta el punto de lanzamiento es igual: el tiempo total es 2v₀/g.',
    },
    {
      name: 'Altura máxima',
      latex: String.raw`H = \dfrac{v_0^2}{2g}`,
      description: 'Altura máxima que se eleva el objeto por encima del punto de lanzamiento.',
      variables: [
        { symbol: String.raw`H`, meaning: 'Altura máxima sobre el punto de lanzamiento', unit: 'm' },
        { symbol: String.raw`v_0`, meaning: 'Rapidez de lanzamiento hacia arriba', unit: 'm/s' },
        { symbol: String.raw`g`, meaning: 'Módulo de la aceleración de la gravedad', unit: 'm/s²' },
      ],
      notes: 'Si se lanza desde una altura y₀, la altura máxima sobre el suelo es y₀ + H.',
    },
  ],
  examples: [
    {
      title: 'Una pelota de béisbol hacia arriba',
      statement: String.raw`Un receptor lanza una pelota de béisbol verticalmente hacia arriba a $19.6\,\mathrm{m/s}$. ¿Cuánto tarda en llegar al punto más alto? ¿Qué altura alcanza sobre su mano? ¿Cuándo y con qué velocidad vuelve a la mano?`,
      steps: [
        String.raw`Eje $y$ hacia arriba con origen en la mano: $y_0 = 0$, $v_0 = +19.6\,\mathrm{m/s}$, $a = -9.8\,\mathrm{m/s^2}$.`,
        String.raw`Tiempo de subida (en el punto más alto $v = 0$): $t_s = \dfrac{v_0}{g} = \dfrac{19.6\,\mathrm{m/s}}{9.8\,\mathrm{m/s^2}} = 2.0\,\mathrm{s}$.`,
        String.raw`Altura máxima: $H = \dfrac{v_0^2}{2g} = \dfrac{(19.6\,\mathrm{m/s})^2}{2(9.8\,\mathrm{m/s^2})} = \dfrac{384\,\mathrm{m^2/s^2}}{19.6\,\mathrm{m/s^2}} = 19.6\,\mathrm{m}$.`,
        String.raw`Regreso a la mano ($y = 0$): $0 = 19.6\,t - 4.9\,t^2 = t\,(19.6 - 4.9\,t)$. Las soluciones son $t = 0$ (el lanzamiento) y $t = 4.0\,\mathrm{s}$.`,
        String.raw`Velocidad al volver: $v = 19.6\,\mathrm{m/s} - (9.8\,\mathrm{m/s^2})(4.0\,\mathrm{s}) = -19.6\,\mathrm{m/s}$.`,
      ],
      result: String.raw`$t_s = 2.0\,\mathrm{s}$, $H = 19.6\,\mathrm{m}$; vuelve a la mano a los $4.0\,\mathrm{s}$ con $v = -19.6\,\mathrm{m/s}$.`,
      interpretation:
        'Se cumple la simetría: tarda 2.0 s en subir y 2.0 s en bajar, y vuelve con la misma rapidez con que salió, pero hacia abajo. Una altura de unos 20 m (un edificio de seis o siete pisos) es razonable para un lanzamiento fuerte de unos 70 km/h.',
    },
    {
      title: 'Una piedra lanzada hacia arriba desde una azotea',
      statement: String.raw`Desde la azotea de un edificio de $25\,\mathrm{m}$ se lanza una piedra verticalmente hacia arriba a $10\,\mathrm{m/s}$. Halle la altura máxima sobre el suelo, el tiempo que tarda en llegar al suelo y su velocidad de impacto.`,
      steps: [
        String.raw`Eje hacia arriba con origen en el suelo: $y_0 = 25\,\mathrm{m}$, $v_0 = +10\,\mathrm{m/s}$, $a = -9.8\,\mathrm{m/s^2}$.`,
        String.raw`Altura máxima: $H = \dfrac{(10\,\mathrm{m/s})^2}{2(9.8\,\mathrm{m/s^2})} = 5.1\,\mathrm{m}$ sobre la azotea, es decir, $25 + 5.1 = 30.1\,\mathrm{m}$ sobre el suelo. La alcanza en $t_s = 10/9.8 = 1.02\,\mathrm{s}$.`,
        String.raw`Llegada al suelo ($y = 0$): $0 = 25 + 10\,t - 4.9\,t^2$, o bien $4.9\,t^2 - 10\,t - 25 = 0$.`,
        String.raw`Fórmula general: $t = \dfrac{10 \pm \sqrt{10^2 + 4(4.9)(25)}}{2(4.9)} = \dfrac{10 \pm \sqrt{590}}{9.8} = \dfrac{10 \pm 24.29}{9.8}$. La raíz positiva es $t = 3.50\,\mathrm{s}$; la negativa ($-1.46\,\mathrm{s}$) se descarta.`,
        String.raw`Velocidad de impacto: $v = 10 - 9.8\,(3.50) = -24.3\,\mathrm{m/s}$. Comprobación: $v^2 = v_0^2 + 2gh = 100 + 2(9.8)(25) = 590\,\mathrm{m^2/s^2}$, y $\sqrt{590} = 24.3$ ✓.`,
      ],
      result: String.raw`Altura máxima $30.1\,\mathrm{m}$ sobre el suelo; llega al suelo a los $3.50\,\mathrm{s}$ con $v = -24.3\,\mathrm{m/s}$.`,
      interpretation:
        'La piedra sube 5.1 m, vuelve a pasar por la azotea a los 2.04 s con 10 m/s hacia abajo y desde allí sigue cayendo. El signo negativo de la velocidad de impacto indica que se mueve hacia abajo.',
    },
    {
      title: 'La misma piedra, lanzada hacia abajo',
      statement: String.raw`Desde la misma azotea de $25\,\mathrm{m}$ se lanza ahora la piedra verticalmente **hacia abajo** a $10\,\mathrm{m/s}$. ¿Cuánto tarda en llegar al suelo y con qué velocidad llega? Compare con el ejemplo anterior.`,
      steps: [
        String.raw`Ahora $v_0 = -10\,\mathrm{m/s}$ (hacia abajo) y $y_0 = 25\,\mathrm{m}$, $a = -9.8\,\mathrm{m/s^2}$.`,
        String.raw`Llegada al suelo: $0 = 25 - 10\,t - 4.9\,t^2$, o bien $4.9\,t^2 + 10\,t - 25 = 0$.`,
        String.raw`$t = \dfrac{-10 \pm \sqrt{590}}{9.8} = \dfrac{-10 \pm 24.29}{9.8}$. La raíz positiva es $t = 1.46\,\mathrm{s}$.`,
        String.raw`Velocidad de impacto: $v = -10 - 9.8\,(1.46) = -24.3\,\mathrm{m/s}$.`,
      ],
      result: String.raw`Llega al suelo a los $1.46\,\mathrm{s}$ con $v = -24.3\,\mathrm{m/s}$: la misma velocidad de impacto que en el ejemplo anterior.`,
      interpretation:
        'La diferencia de tiempos es 3.50 − 1.46 = 2.04 s = 2v₀/g: justo lo que tarda la piedra lanzada hacia arriba en subir y volver a la azotea. Desde ese momento ambos movimientos son idénticos. Observe además que la raíz negativa de este ejemplo (−3.50 s) coincide, salvo el signo, con la raíz positiva del anterior.',
    },
  ],
  simulation: {
    key: 'caida-libre',
    params: { y0: 0, v0: 15, g: 9.8 },
    guide: String.raw`1. Con $y_0 = 0$ y $v_0 = +15\,\mathrm{m/s}$, pulse **Iniciar**. Anote la altura máxima y el tiempo hasta la altura máxima, y compárelos con $H = v_0^2/(2g)$ y $t_s = v_0/g$.
2. Compare el tiempo hasta el suelo con el tiempo hasta la altura máxima. ¿Qué relación hay entre ellos? Compare también la rapidez de impacto con $v_0$.
3. En la gráfica $v$–$t$, localice el instante en que $v = 0$. ¿Cambia la pendiente de la recta en ese instante? ¿Cuánto vale la aceleración allí?
4. En la tabla de datos, compare las alturas en dos instantes situados a la misma distancia temporal del punto más alto (por ejemplo, $0.5\,\mathrm{s}$ antes y $0.5\,\mathrm{s}$ después). ¿Qué observa?
5. Duplique $v_0$ a $30\,\mathrm{m/s}$. ¿Por qué factor cambian el tiempo de subida y la altura máxima?
6. Ponga $y_0 = 30\,\mathrm{m}$ y compare $v_0 = +8\,\mathrm{m/s}$ con $v_0 = -8\,\mathrm{m/s}$. ¿Cambia el tiempo hasta el suelo? ¿Y la velocidad de impacto? Explique por qué.`,
  },
  exercises: [
    {
      id: 'b2-lanz-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['lanzamiento-vertical-subida'],
      prompt: String.raw`Una niña lanza una pelota verticalmente hacia arriba a $14\,\mathrm{m/s}$. Despreciando el aire, ¿cuánto se eleva la pelota por encima del punto de lanzamiento?`,
      format: 'numeric',
      unitHint: 'm',
    },
    {
      id: 'b2-lanz-02',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['lanzamiento-vertical-punto-alto'],
      prompt: String.raw`Una moneda se lanza verticalmente hacia arriba. Sin resistencia del aire, ¿qué se puede afirmar de su velocidad $v$ y de su aceleración $a$ en el instante en que alcanza el punto más alto?`,
      format: 'choice',
      options: [
        String.raw`$v = 0$ y $a = 0$.`,
        String.raw`$v = 0$ y $a = 9.8\,\mathrm{m/s^2}$ dirigida hacia abajo.`,
        String.raw`$v = 0$ y la aceleración cambia de sentido justo en ese instante: pasa de apuntar hacia abajo a apuntar hacia arriba.`,
        String.raw`$v$ es máxima y $a = 0$.`,
      ],
    },
    {
      id: 'b2-lanz-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['lanzamiento-vertical-simetria'],
      prompt: String.raw`**Verdadero o falso:** sin resistencia del aire, una pelota lanzada verticalmente hacia arriba que vuelve a la mano tarda más en bajar que en subir, porque al bajar parte del reposo. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b2-lanz-04',
      category: 'experimento',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['lanzamiento-vertical-subida'],
      prompt: String.raw`En el simulador se lanza un objeto desde el suelo ($y_0 = 0$) hacia arriba con $v_0 = 20\,\mathrm{m/s}$ y $g = 9.8\,\mathrm{m/s^2}$. Ejecute la simulación y anote la altura máxima. Luego cambie **solo** la gravedad a $g = 3.7\,\mathrm{m/s^2}$, el valor en Marte. Prediga primero la nueva altura máxima a partir de la terrestre y después compruébela en el simulador. ¿Qué altura máxima alcanza el objeto en Marte?`,
      format: 'numeric',
      unitHint: 'm',
      simulation: { key: 'caida-libre', params: { y0: 0, v0: 20, g: 9.8 } },
    },
    {
      id: 'b2-lanz-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['lanzamiento-vertical-desde-altura'],
      prompt: String.raw`Desde la azotea de un edificio de $30\,\mathrm{m}$ de altura se lanza una piedra verticalmente **hacia arriba** a $8.0\,\mathrm{m/s}$. La piedra sube, baja y cae junto al edificio hasta la acera. Despreciando el aire, ¿cuánto tiempo transcurre desde el lanzamiento hasta que la piedra llega a la acera?`,
      format: 'numeric',
      unitHint: 's',
    },
    {
      id: 'b2-lanz-06',
      category: 'grafica',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['lanzamiento-vertical-subida', 'mru-graficas'],
      prompt: String.raw`La gráfica muestra la velocidad (eje positivo hacia arriba) de una pelota lanzada verticalmente desde la mano hasta que vuelve a ella. Usando la gráfica, ¿cuánto se eleva la pelota por encima del punto de lanzamiento?`,
      format: 'numeric',
      unitHint: 'm',
      figure: {
        kind: 'line',
        title: 'Velocidad de la pelota frente al tiempo',
        x: { label: 't', unit: 's' },
        y: { label: 'v', unit: 'm/s' },
        series: [
          {
            name: 'v(t)',
            points: [
              [0, 14.7],
              [0.5, 9.8],
              [1, 4.9],
              [1.5, 0],
              [2, -4.9],
              [2.5, -9.8],
              [3, -14.7],
            ],
          },
        ],
      },
    },
    {
      id: 'b2-lanz-07',
      category: 'error',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['lanzamiento-vertical-punto-alto', 'lanzamiento-vertical-subida'],
      prompt: String.raw`Un estudiante resolvió así este problema: *«Se lanza una pelota verticalmente hacia arriba a $15\,\mathrm{m/s}$. ¿Cuánto tarda en llegar al punto más alto?»*

1. Eje $y$ hacia arriba: $v_0 = +15\,\mathrm{m/s}$ y $a = -9.8\,\mathrm{m/s^2}$.
2. En el punto más alto la velocidad es cero: $v = 0$.
3. Sustituyendo en la ecuación de la velocidad: $0 = 15 + 9.8\,t$.
4. Despejando: $t = -15/9.8 = -1.53\,\mathrm{s}$. Como un tiempo no puede ser negativo, se toma $t = 1.53\,\mathrm{s}$.

El resultado numérico coincide con el correcto, pero el razonamiento tiene un error. ¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'No hay ningún error'],
    },
    {
      id: 'b2-lanz-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['lanzamiento-vertical-desde-altura', 'lanzamiento-vertical-subida', 'caida-libre-aceleracion'],
      prompt: String.raw`Una pelota A se lanza verticalmente hacia arriba desde el suelo a $20\,\mathrm{m/s}$. En el mismo instante se suelta, desde el reposo, una pelota B situada $40\,\mathrm{m}$ exactamente encima de A. (a) Escriba las ecuaciones de posición de ambas pelotas con el eje hacia arriba y el origen en el suelo. (b) ¿En qué instante y a qué altura se cruzan? (c) ¿Qué velocidad tiene cada una en ese instante? ¿A está subiendo o bajando? (d) Explique por qué la distancia entre las pelotas disminuye a ritmo constante, aunque ambas estén aceleradas. (e) Dibuje cualitativamente las gráficas $y$–$t$ de ambas en los mismos ejes e indique el cruce.`,
      format: 'open',
    },
  ],
};
