import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'mcu',
  title: 'Movimiento circular uniforme',
  summary:
    'Una partícula que recorre una circunferencia con rapidez constante tiene velocidad de dirección cambiante y, por eso, una aceleración dirigida hacia el centro: la aceleración centrípeta.',
  concepts: [
    { slug: 'mcu-periodo-frecuencia', name: 'Período, frecuencia y rpm' },
    { slug: 'mcu-velocidad-angular', name: 'Velocidad angular en rad/s' },
    { slug: 'mcu-rapidez-tangencial', name: 'Rapidez tangencial' },
    { slug: 'mcu-direccion-velocidad', name: 'La velocidad cambia de dirección aunque la rapidez sea constante' },
    { slug: 'mcu-aceleracion-centripeta', name: 'Aceleración centrípeta' },
  ],
  theory: String.raw`## Girar con rapidez constante

Un punto de una aspa de un ventilador de techo, un caballito de un carrusel, la ropa en el tambor de una lavadora o un carro que da la vuelta a una rotonda sin acelerar ni frenar: todos recorren una **circunferencia** con **rapidez constante**. Ese movimiento se llama **movimiento circular uniforme (MCU)**.

«Uniforme» se refiere a la **rapidez**, no a la velocidad. Como veremos, en el MCU la velocidad cambia continuamente, porque cambia su dirección.

## Período, frecuencia y rpm

Como el movimiento se repite vuelta tras vuelta, conviene describirlo con dos magnitudes:

- El **período** $T$ es el tiempo que tarda en dar una vuelta completa. Se mide en segundos.
- La **frecuencia** $f$ es el número de vueltas por unidad de tiempo. Si una vuelta dura $T$, en un segundo se dan $1/T$ vueltas:

$$f = \frac{1}{T}.$$

La frecuencia se mide en $\mathrm{s^{-1}}$, unidad que se llama **hercio** ($\mathrm{Hz}$). En motores, ventiladores y discos es habitual expresarla en **revoluciones por minuto** (rpm). Como un minuto tiene $60\,\mathrm{s}$, para pasar de rpm a Hz se divide entre 60: un ventilador a $300\,\mathrm{rpm}$ da $5\,\mathrm{vueltas/s}$, es decir, $f = 5\,\mathrm{Hz}$ y $T = 0.2\,\mathrm{s}$.

## Ángulos en radianes y velocidad angular

Para medir cuánto ha girado la partícula usamos el ángulo $\theta$ barrido por el radio. En física se mide en **radianes**: un ángulo de $1\,\mathrm{rad}$ es el que abarca un arco de longitud igual al radio. En general,

$$\theta\,(\mathrm{rad}) = \frac{\text{longitud del arco}}{r}.$$

Una vuelta completa abarca toda la circunferencia, $2\pi r$, así que equivale a $2\pi\,\mathrm{rad} = 360^\circ$ (y $1\,\mathrm{rad} \approx 57.3^\circ$). Como es un cociente de dos longitudes, el radián no tiene dimensiones: puede aparecer o desaparecer de las unidades sin alterar el resultado.

La **velocidad angular** $\omega$ es el ángulo barrido por unidad de tiempo. En el MCU es constante: en un período se barren $2\pi\,\mathrm{rad}$, de modo que

$$\omega = \frac{2\pi}{T} = 2\pi f \quad (\mathrm{rad/s}).$$

Todos los puntos de un objeto rígido que gira (un disco, un aspa, una noria) comparten el mismo $T$, la misma $f$ y la misma $\omega$.

## Rapidez tangencial

En un período la partícula recorre la circunferencia completa, $2\pi r$. Su rapidez es, por tanto,

$$v = \frac{2\pi r}{T} = \omega\,r .$$

Esta rapidez **sí depende del radio**: en un carrusel, el caballito exterior recorre una circunferencia más grande en el mismo tiempo que el interior, y va más rápido. En la fórmula $v = \omega r$, la unidad $\mathrm{rad/s} \cdot \mathrm{m}$ se reduce a $\mathrm{m/s}$, porque el radián no tiene dimensiones.

> **Cuidado.** La relación $v = \omega r$ solo es válida con $\omega$ en $\mathrm{rad/s}$. Si usa grados por segundo o rpm, el resultado será incorrecto.

## La velocidad cambia aunque la rapidez sea constante

La velocidad es un **vector**: tiene módulo (la rapidez) y dirección. En el MCU, el vector velocidad es en cada instante **tangente a la circunferencia**, es decir, perpendicular al radio. Al avanzar la partícula, esa dirección gira continuamente. Su módulo no cambia, pero el vector sí. Y si la velocidad cambia, **hay aceleración**.

Una prueba sencilla: si a un niño que hace girar una piedra atada a una cuerda se le rompe la cuerda, la piedra sale en **línea recta, en la dirección tangente** que llevaba en ese instante. No sale disparada hacia afuera a lo largo del radio, ni sigue curvándose. Sin la cuerda, nada desvía su velocidad.

> **Error frecuente.** «En el MCU no hay aceleración porque la rapidez es constante.» Falso. La aceleración mide el cambio del vector velocidad, y en el MCU su dirección cambia en todo momento.

## Aceleración centrípeta: una justificación geométrica

Consideremos dos posiciones cercanas $P_1$ y $P_2$, que la partícula ocupa con un intervalo $\Delta t$ muy corto. Entre ellas el radio gira un ángulo pequeño $\Delta\theta$.

1. **Triángulo de posiciones.** El centro $O$, $P_1$ y $P_2$ forman un triángulo isósceles: dos lados miden $r$, el ángulo entre ellos es $\Delta\theta$ y el tercer lado es la cuerda $P_1P_2$. Si el intervalo es muy corto, la cuerda casi coincide con el arco recorrido, que mide $v\,\Delta t$.
2. **Triángulo de velocidades.** Las velocidades $\vec v_1$ y $\vec v_2$ son perpendiculares a sus radios, así que también forman entre sí el ángulo $\Delta\theta$. Si se dibujan desde un mismo punto, $\vec v_1$, $\vec v_2$ y el cambio $\Delta\vec v = \vec v_2 - \vec v_1$ forman otro triángulo isósceles, con dos lados iguales a $v$ y el mismo ángulo $\Delta\theta$.
3. **Semejanza.** Los dos triángulos son semejantes, así que sus lados son proporcionales:

$$\frac{|\Delta\vec v|}{v} = \frac{v\,\Delta t}{r} \quad\Rightarrow\quad \frac{|\Delta\vec v|}{\Delta t} = \frac{v^2}{r}.$$

4. **Dirección.** En un triángulo isósceles con un ángulo $\Delta\theta$ muy pequeño, el lado desigual $\Delta\vec v$ es casi perpendicular a los otros dos. Es decir, $\Delta\vec v$ es perpendicular a la velocidad y apunta **hacia el centro**.

La **aceleración centrípeta** («que busca el centro») tiene, por tanto, módulo

$$a_c = \frac{v^2}{r} = \omega^2 r$$

y está dirigida en todo momento hacia el centro de la circunferencia.

Se puede comprobar numéricamente. Si se calcula la aceleración media $|\Delta\vec v|/\Delta t$ en intervalos cada vez más cortos, se obtiene $0.64\,v^2/r$ en media vuelta (la velocidad se invierte: $|\Delta\vec v| = 2v$), $0.90\,v^2/r$ en un cuarto de vuelta, $0.97\,v^2/r$ en un octavo y $0.999\,v^2/r$ en un arco de $10^\circ$. El valor se acerca cada vez más a $v^2/r$.

## Consecuencias

- **Con el mismo período**, $a_c = \omega^2 r$ crece en proporción al radio.
- **Con la misma rapidez**, $a_c = v^2/r$ es mayor cuanto más cerrada es la curva (menor radio).
- **Si se duplica la rapidez** en la misma curva, la aceleración centrípeta se **cuadruplica**. Por eso es tan peligroso tomar una curva demasiado rápido.

En el MCU no hay aceleración a lo largo de la trayectoria (por eso la rapidez no cambia): toda la aceleración es centrípeta. Qué agente produce esa aceleración (la tensión de una cuerda, la fricción de los neumáticos, la gravedad en el caso de un satélite) es materia de la Dinámica.`,
  formulas: [
    {
      name: 'Período y frecuencia',
      latex: String.raw`f = \dfrac{1}{T}, \qquad f\,(\mathrm{Hz}) = \dfrac{n\,(\mathrm{rpm})}{60}`,
      description: 'La frecuencia es el número de vueltas por segundo; el período, el tiempo de una vuelta.',
      variables: [
        { symbol: String.raw`T`, meaning: 'Período (tiempo de una vuelta)', unit: 's' },
        { symbol: String.raw`f`, meaning: 'Frecuencia (vueltas por segundo)', unit: 'Hz = 1/s' },
        { symbol: String.raw`n`, meaning: 'Frecuencia en revoluciones por minuto', unit: 'rpm' },
      ],
    },
    {
      name: 'Velocidad angular',
      latex: String.raw`\omega = \dfrac{2\pi}{T} = 2\pi f`,
      description: 'Ángulo barrido por unidad de tiempo; en una vuelta se barren 2π rad.',
      variables: [
        { symbol: String.raw`\omega`, meaning: 'Velocidad angular', unit: 'rad/s' },
        { symbol: String.raw`T`, meaning: 'Período', unit: 's' },
        { symbol: String.raw`f`, meaning: 'Frecuencia', unit: 'Hz' },
      ],
      notes: 'Es la misma para todos los puntos de un cuerpo rígido que gira.',
    },
    {
      name: 'Rapidez tangencial',
      latex: String.raw`v = \dfrac{2\pi r}{T} = \omega\,r`,
      description: 'Rapidez con que la partícula recorre la circunferencia; la velocidad es tangente a ella.',
      variables: [
        { symbol: String.raw`v`, meaning: 'Rapidez tangencial', unit: 'm/s' },
        { symbol: String.raw`r`, meaning: 'Radio de la circunferencia', unit: 'm' },
        { symbol: String.raw`\omega`, meaning: 'Velocidad angular (en rad/s)', unit: 'rad/s' },
      ],
      notes: 'v = ωr solo es válida con ω en rad/s.',
    },
    {
      name: 'Aceleración centrípeta',
      latex: String.raw`a_c = \dfrac{v^2}{r} = \omega^2 r`,
      description: 'Aceleración debida al cambio de dirección de la velocidad. Apunta siempre hacia el centro.',
      variables: [
        { symbol: String.raw`a_c`, meaning: 'Módulo de la aceleración centrípeta', unit: 'm/s²' },
        { symbol: String.raw`v`, meaning: 'Rapidez tangencial', unit: 'm/s' },
        { symbol: String.raw`r`, meaning: 'Radio', unit: 'm' },
        { symbol: String.raw`\omega`, meaning: 'Velocidad angular', unit: 'rad/s' },
      ],
      notes: 'A igual radio, duplicar la rapidez cuadruplica a_c.',
    },
  ],
  examples: [
    {
      title: 'Una noria',
      statement: String.raw`Una noria (rueda de la fortuna) de $8.0\,\mathrm{m}$ de radio da una vuelta cada $40\,\mathrm{s}$ con rapidez constante. Halle la frecuencia, la velocidad angular, la rapidez de una cabina y su aceleración centrípeta.`,
      steps: [
        String.raw`Frecuencia: $f = \dfrac{1}{T} = \dfrac{1}{40\,\mathrm{s}} = 0.025\,\mathrm{Hz}$ (1.5 vueltas por minuto).`,
        String.raw`Velocidad angular: $\omega = \dfrac{2\pi}{T} = \dfrac{2\pi\,\mathrm{rad}}{40\,\mathrm{s}} = 0.157\,\mathrm{rad/s}$.`,
        String.raw`Rapidez: $v = \omega\,r = (0.157\,\mathrm{rad/s})(8.0\,\mathrm{m}) = 1.26\,\mathrm{m/s}$. Con la otra fórmula: $v = 2\pi(8.0\,\mathrm{m})/(40\,\mathrm{s}) = 1.26\,\mathrm{m/s}$ ✓.`,
        String.raw`Aceleración centrípeta: $a_c = \dfrac{v^2}{r} = \dfrac{(1.257\,\mathrm{m/s})^2}{8.0\,\mathrm{m}} = 0.197\,\mathrm{m/s^2}$. Con la otra fórmula: $a_c = \omega^2 r = (0.157\,\mathrm{rad/s})^2(8.0\,\mathrm{m}) = 0.197\,\mathrm{m/s^2}$ ✓.`,
      ],
      result: String.raw`$f = 0.025\,\mathrm{Hz}$, $\omega = 0.157\,\mathrm{rad/s}$, $v = 1.26\,\mathrm{m/s}$ y $a_c = 0.197\,\mathrm{m/s^2}$, dirigida hacia el eje de la noria.`,
      interpretation:
        'La cabina se mueve a paso de persona (unos 4.5 km/h) y su aceleración centrípeta es solo un 2 % de g: por eso el paseo es tranquilo.',
    },
    {
      title: 'El centrifugado de una lavadora',
      statement: String.raw`El tambor de una lavadora, de $0.25\,\mathrm{m}$ de radio, centrifuga a $1200\,\mathrm{rpm}$. Halle el período, la velocidad angular, la rapidez de la ropa pegada a la pared del tambor y su aceleración centrípeta.`,
      steps: [
        String.raw`Frecuencia en Hz: $f = \dfrac{1200\,\mathrm{vueltas}}{60\,\mathrm{s}} = 20\,\mathrm{Hz}$. Período: $T = 1/f = 0.050\,\mathrm{s}$.`,
        String.raw`Velocidad angular: $\omega = 2\pi f = 2\pi(20\,\mathrm{Hz}) = 126\,\mathrm{rad/s}$.`,
        String.raw`Rapidez: $v = \omega\,r = (126\,\mathrm{rad/s})(0.25\,\mathrm{m}) = 31.4\,\mathrm{m/s}$.`,
        String.raw`Aceleración centrípeta: $a_c = \omega^2 r = (125.7\,\mathrm{rad/s})^2(0.25\,\mathrm{m}) = 3.95\times10^{3}\,\mathrm{m/s^2}$.`,
        String.raw`Comparación con $g$: $a_c/g = 3950/9.8 \approx 400$.`,
      ],
      result: String.raw`$T = 0.050\,\mathrm{s}$, $\omega = 126\,\mathrm{rad/s}$, $v = 31.4\,\mathrm{m/s}$ y $a_c \approx 3.9\times10^{3}\,\mathrm{m/s^2}$, unas 400 veces $g$.`,
      interpretation:
        'La ropa va a unos 113 km/h. La pared del tambor obliga a la ropa a curvar su trayectoria, pero el agua puede escapar por los agujeros: allí nada la desvía y sale en la dirección tangente. Así se escurre la ropa.',
    },
    {
      title: 'Un carro en una rotonda',
      statement: String.raw`Un carro da la vuelta a una rotonda de $25\,\mathrm{m}$ de radio a $36\,\mathrm{km/h}$ constantes. ¿Cuánto vale su aceleración centrípeta? ¿Cuánto tardaría en dar una vuelta completa? ¿Qué ocurre si duplica la rapidez?`,
      steps: [
        String.raw`Conversión al SI: $v = 36\,\mathrm{km/h} \times \dfrac{1000\,\mathrm{m}}{3600\,\mathrm{s}} = 10\,\mathrm{m/s}$.`,
        String.raw`Aceleración centrípeta: $a_c = \dfrac{v^2}{r} = \dfrac{(10\,\mathrm{m/s})^2}{25\,\mathrm{m}} = 4.0\,\mathrm{m/s^2}$.`,
        String.raw`Período: $T = \dfrac{2\pi r}{v} = \dfrac{2\pi(25\,\mathrm{m})}{10\,\mathrm{m/s}} = 15.7\,\mathrm{s}$.`,
        String.raw`A $72\,\mathrm{km/h} = 20\,\mathrm{m/s}$: $a_c = \dfrac{(20\,\mathrm{m/s})^2}{25\,\mathrm{m}} = 16\,\mathrm{m/s^2}$, cuatro veces más.`,
      ],
      result: String.raw`$a_c = 4.0\,\mathrm{m/s^2}$ (unos $0.4\,g$), hacia el centro de la rotonda, y $T = 15.7\,\mathrm{s}$. Al doble de rapidez, $a_c = 16\,\mathrm{m/s^2}$.`,
      interpretation:
        'Una aceleración de 16 m/s² equivale a 1.6 g, más de lo que los neumáticos de un carro común pueden proporcionar: el carro no lograría seguir la curva y se saldría por la tangente.',
    },
  ],
  simulation: {
    key: 'circular',
    params: { r: 2, T: 4 },
    guide: String.raw`1. Con $r = 2\,\mathrm{m}$ y $T = 4\,\mathrm{s}$, pulse **Iniciar**. Anote $v$, $\omega$, $f$ y $a_c$, y compruébelos con $v = 2\pi r/T$, $\omega = 2\pi/T$, $f = 1/T$ y $a_c = v^2/r$.
2. Observe los vectores velocidad y aceleración durante el giro. ¿Qué ángulo forman entre sí? ¿Hacia dónde apunta la aceleración en cada instante?
3. Mantenga $T = 4\,\mathrm{s}$ y duplique el radio. ¿Qué magnitudes cambian y en qué factor? ¿Cuáles no cambian?
4. Vuelva a $r = 2\,\mathrm{m}$ y reduzca el período a la mitad. ¿Por qué factor cambian $v$ y $a_c$?
5. Observe las gráficas $x$–$t$ e $y$–$t$. ¿Qué forma tienen? Lea en ellas el período y el radio.
6. Con $r = 2\,\mathrm{m}$, busque el período con el que $a_c$ vale aproximadamente $9.8\,\mathrm{m/s^2}$. Compruebe su resultado con la fórmula $a_c = 4\pi^2 r/T^2$.`,
  },
  exercises: [
    {
      id: 'b2-mcu-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['mcu-velocidad-angular', 'mcu-periodo-frecuencia'],
      prompt: String.raw`Un ventilador de techo gira a $120\,\mathrm{rpm}$. ¿Cuál es su velocidad angular en $\mathrm{rad/s}$?`,
      format: 'numeric',
      unitHint: 'rad/s',
    },
    {
      id: 'b2-mcu-02',
      category: 'conceptual',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['mcu-direccion-velocidad'],
      prompt: String.raw`Visto desde arriba, un niño hace girar una piedra atada a una cuerda en una circunferencia horizontal, en sentido antihorario. Justo cuando la piedra pasa por el punto más al este de la circunferencia (moviéndose hacia el norte), la cuerda se rompe. Vista desde arriba (es decir, sin considerar la caída vertical), ¿cómo se mueve la piedra inmediatamente después?`,
      format: 'choice',
      options: [
        'En línea recta hacia el este, alejándose radialmente del centro.',
        'En línea recta hacia el norte, en la dirección tangente a la circunferencia en ese punto.',
        'Siguiendo un arco de circunferencia cada vez más abierto, que poco a poco se endereza.',
        'Hacia el oeste, en dirección al centro de la circunferencia.',
      ],
    },
    {
      id: 'b2-mcu-03',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['mcu-rapidez-tangencial'],
      prompt: String.raw`La rueda de una bicicleta tiene un radio de $0.35\,\mathrm{m}$ y da una vuelta cada $0.50\,\mathrm{s}$. ¿Con qué rapidez se mueve, respecto al eje de la rueda, un punto del borde de la llanta?`,
      format: 'numeric',
      unitHint: 'm/s',
    },
    {
      id: 'b2-mcu-04',
      category: 'experimento',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['mcu-aceleracion-centripeta'],
      prompt: String.raw`En el simulador, una partícula gira con $r = 3.0\,\mathrm{m}$ y $T = 2.0\,\mathrm{s}$. Ejecute la simulación y anote la rapidez y la aceleración centrípeta. Después reduzca el período a la **mitad** ($T = 1.0\,\mathrm{s}$) sin cambiar el radio. Prediga primero el resultado y compruébelo luego en el simulador. ¿Cuánto vale ahora la aceleración centrípeta?`,
      format: 'numeric',
      unitHint: 'm/s²',
      simulation: { key: 'circular', params: { r: 3, T: 2 } },
    },
    {
      id: 'b2-mcu-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['mcu-aceleracion-centripeta', 'mcu-periodo-frecuencia'],
      prompt: String.raw`Una centrífuga para entrenar pilotos hace girar una cabina en una circunferencia de $9.0\,\mathrm{m}$ de radio. ¿A cuántas revoluciones por minuto debe girar para que la aceleración centrípeta de la cabina sea $7g$, con $g = 9.8\,\mathrm{m/s^2}$?`,
      format: 'numeric',
      unitHint: 'rpm',
    },
    {
      id: 'b2-mcu-06',
      category: 'grafica',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['mcu-rapidez-tangencial', 'mcu-periodo-frecuencia'],
      prompt: String.raw`Una partícula describe un MCU alrededor del origen. La gráfica muestra su coordenada $x$ en función del tiempo. A partir de la gráfica, determine la rapidez tangencial de la partícula.`,
      format: 'numeric',
      unitHint: 'm/s',
      figure: {
        kind: 'line',
        title: 'Coordenada x frente al tiempo',
        x: { label: 't', unit: 's' },
        y: { label: 'x', unit: 'm' },
        series: [
          {
            name: 'x(t)',
            points: [
              [0, 2],
              [0.25, 1.848],
              [0.5, 1.414],
              [0.75, 0.765],
              [1, 0],
              [1.25, -0.765],
              [1.5, -1.414],
              [1.75, -1.848],
              [2, -2],
              [2.25, -1.848],
              [2.5, -1.414],
              [2.75, -0.765],
              [3, 0],
              [3.25, 0.765],
              [3.5, 1.414],
              [3.75, 1.848],
              [4, 2],
              [4.25, 1.848],
              [4.5, 1.414],
              [4.75, 0.765],
              [5, 0],
              [5.25, -0.765],
              [5.5, -1.414],
              [5.75, -1.848],
              [6, -2],
              [6.25, -1.848],
              [6.5, -1.414],
              [6.75, -0.765],
              [7, 0],
              [7.25, 0.765],
              [7.5, 1.414],
              [7.75, 1.848],
              [8, 2],
            ],
          },
        ],
      },
    },
    {
      id: 'b2-mcu-07',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['mcu-aceleracion-centripeta'],
      prompt: String.raw`Un carro toma una curva circular de radio fijo con rapidez constante. Si el conductor toma la misma curva al **doble** de rapidez, ¿qué le ocurre a la aceleración centrípeta?`,
      format: 'choice',
      options: [
        'No cambia, porque el radio de la curva es el mismo.',
        'Se duplica.',
        'Se cuadruplica.',
        'Se reduce a la mitad.',
        'Sigue siendo cero, porque la rapidez es constante.',
      ],
    },
    {
      id: 'b2-mcu-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['mcu-aceleracion-centripeta', 'mcu-direccion-velocidad', 'mcu-rapidez-tangencial'],
      prompt: String.raw`Un carro de carreras da vueltas a una pista circular de $50\,\mathrm{m}$ de radio con rapidez constante, y tarda $20\,\mathrm{s}$ en cada vuelta. (a) Calcule su rapidez, su velocidad angular y su aceleración centrípeta. (b) Dibuje los vectores velocidad en dos puntos separados un cuarto de vuelta y, a partir de ellos, el vector $\Delta\vec v$. ¿Hacia dónde apunta $\Delta\vec v$? (c) Calcule el módulo de $\Delta\vec v$ en ese cuarto de vuelta y la aceleración media $|\Delta\vec v|/\Delta t$. Compárela con $v^2/r$ y explique la diferencia. (d) Explique, sin usar cálculo, por qué la aceleración instantánea apunta hacia el centro de la pista.`,
      format: 'open',
    },
  ],
};
