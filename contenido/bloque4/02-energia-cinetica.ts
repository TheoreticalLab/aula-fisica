import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'energia-cinetica',
  title: 'Energía cinética y teorema trabajo–energía',
  summary:
    'La energía cinética, K = ½mv², mide la energía asociada al movimiento. El trabajo neto sobre un cuerpo es igual al cambio de su energía cinética.',
  concepts: [
    { slug: 'energia-cinetica-definicion', name: 'Energía cinética: K = ½mv²' },
    { slug: 'energia-cinetica-teorema', name: 'Teorema trabajo–energía: W_neto = ΔK' },
    { slug: 'energia-cinetica-frenado', name: 'Distancia de frenado y trabajo de la fricción' },
  ],
  theory: String.raw`## La energía del movimiento

Un camión que avanza puede derribar un muro; una pelota de béisbol lanzada a gran velocidad puede romper una ventana. Todo cuerpo en movimiento tiene una capacidad de producir cambios que un cuerpo en reposo no tiene. Esa capacidad se mide con la **energía cinética**:

$$K = \tfrac12\,m\,v^2 .$$

Aquí $m$ es la masa y $v$ la **rapidez** (el módulo de la velocidad). La unidad es la misma del trabajo, el joule: $1\,\mathrm{kg\cdot m^2/s^2} = 1\,\mathrm{N\cdot m} = 1\,\mathrm{J}$.

Tres propiedades importantes:

1. **Nunca es negativa.** La masa es positiva y $v^2 \ge 0$. Vale cero solo si el cuerpo está en reposo.
2. **Es un escalar.** No depende de la dirección del movimiento: un carro a $20\,\mathrm{m/s}$ hacia el norte tiene la misma energía cinética que a $20\,\mathrm{m/s}$ hacia el sur.
3. **Crece con el cuadrado de la rapidez.** Si la rapidez se duplica, la energía cinética se **cuadruplica**; si se triplica, se multiplica por nueve. Por eso un choque a $100\,\mathrm{km/h}$ es mucho más destructivo que uno a $50\,\mathrm{km/h}$, y no solo el doble.

## El teorema trabajo–energía

En la lección anterior vimos que el trabajo transfiere energía. El **teorema trabajo–energía** dice exactamente cuánto:

$$W_{neto} = \Delta K = \tfrac12\,m\,v_f^2 - \tfrac12\,m\,v_i^2 .$$

**El trabajo neto realizado sobre un cuerpo es igual al cambio de su energía cinética.**

Es fácil ver de dónde sale en el caso más sencillo. Si una fuerza neta constante $F$ actúa a lo largo de un desplazamiento $d$, la aceleración es $a = F/m$ y, por cinemática del MRUA, $v_f^2 = v_i^2 + 2ad$. Multiplicando por $\tfrac12 m$:

$$\tfrac12 m v_f^2 - \tfrac12 m v_i^2 = m\,a\,d = F\,d = W_{neto}.$$

El teorema, sin embargo, vale también cuando las fuerzas cambian, y es una de las herramientas más útiles de la mecánica.

Su lectura física:

- Si $W_{neto} > 0$, la rapidez **aumenta**.
- Si $W_{neto} < 0$, la rapidez **disminuye**.
- Si $W_{neto} = 0$, la rapidez **no cambia** (aunque la dirección de la velocidad sí puede cambiar, como en un movimiento circular uniforme).

## Por qué es tan útil

El teorema relaciona directamente **fuerzas y distancias** con **rapideces**, sin pasar por la aceleración ni por el tiempo. Muchos problemas que con las leyes de Newton requieren varias ecuaciones se resuelven en una línea.

**Distancia de frenado.** Un carro de masa $m$ que va a rapidez $v$ frena con las ruedas bloqueadas sobre asfalto horizontal. La única fuerza que hace trabajo es la fricción, $f_k = \mu_k m g$. Hasta detenerse:

$$-\mu_k m g\,d = 0 - \tfrac12 m v^2 \quad\Rightarrow\quad d = \frac{v^2}{2\mu_k g}.$$

La masa se cancela, y la distancia de frenado es proporcional a $v^2$: a doble rapidez, **cuatro veces** la distancia. Es la razón física de los límites de velocidad en zonas escolares y del peligro de los motoconchos que van «volando» por la avenida.

**Atrapar una pelota.** Cuando el receptor de béisbol recibe una recta, el guante realiza un trabajo negativo igual a toda la energía cinética de la pelota. Si la mano retrocede una distancia mayor, la misma energía se quita con una fuerza menor: $\overline{F}\,d = \tfrac12 m v^2$. Por eso se «acompaña» la pelota con la mano en lugar de ponerla rígida. La misma idea explica las zonas de deformación de los carros modernos, diseñadas para hundirse varios decímetros en un choque: cuanto mayor es la distancia de frenado del pasajero, menor es la fuerza media que sufre.

## Errores frecuentes

> **Error frecuente.** Olvidar elevar al cuadrado la rapidez o olvidar el factor $\tfrac12$.

> **Error frecuente.** Usar el trabajo de **una** fuerza en lugar del trabajo **neto**. El teorema se refiere a la suma de los trabajos de todas las fuerzas.

> **Error frecuente.** Calcular $\Delta K$ como $\tfrac12 m (v_f - v_i)^2$. Lo correcto es la diferencia de las energías: $\tfrac12 m v_f^2 - \tfrac12 m v_i^2$.

> **Cuidado.** Las velocidades en $\mathrm{km/h}$ deben pasarse a $\mathrm{m/s}$ antes de calcular $K$ en joules: $1\,\mathrm{m/s} = 3.6\,\mathrm{km/h}$.

## Límites del modelo

- El teorema, tal como lo usamos, trata el cuerpo como una partícula. En un cuerpo que se deforma (un carro que se abolla, una persona que salta doblando las rodillas) parte de la energía se reparte entre sus partes y el cálculo requiere más cuidado.
- La energía cinética depende del sistema de referencia: un pasajero sentado en el Metro de Santo Domingo tiene $K = 0$ respecto al vagón y $K \ne 0$ respecto al andén. El teorema se cumple en cualquier sistema inercial, siempre que se use el mismo para el trabajo y para las rapideces.
- Para rapideces cercanas a la de la luz, $\tfrac12 m v^2$ deja de ser válida; en la vida cotidiana es excelente.`,
  formulas: [
    {
      name: 'Energía cinética',
      latex: String.raw`K = \tfrac12\,m\,v^2`,
      description: 'Energía asociada al movimiento de un cuerpo de masa m con rapidez v.',
      variables: [
        { symbol: String.raw`K`, meaning: 'Energía cinética', unit: 'J' },
        { symbol: String.raw`m`, meaning: 'Masa', unit: 'kg' },
        { symbol: String.raw`v`, meaning: 'Rapidez (módulo de la velocidad)', unit: 'm/s' },
      ],
      notes: 'K ≥ 0 siempre; no depende de la dirección del movimiento.',
    },
    {
      name: 'Teorema trabajo–energía',
      latex: String.raw`W_{neto} = \Delta K = \tfrac12\,m\,v_f^2 - \tfrac12\,m\,v_i^2`,
      description: 'El trabajo neto sobre un cuerpo es igual al cambio de su energía cinética.',
      variables: [
        { symbol: String.raw`W_{neto}`, meaning: 'Suma de los trabajos de todas las fuerzas', unit: 'J' },
        { symbol: String.raw`v_i,\,v_f`, meaning: 'Rapidez inicial y final', unit: 'm/s' },
      ],
    },
    {
      name: 'Distancia de frenado en superficie horizontal',
      latex: String.raw`d = \frac{v^2}{2\mu_k g}`,
      description: 'Distancia que recorre un cuerpo que desliza con rapidez inicial v hasta detenerse, si la única fuerza que hace trabajo es la fricción cinética.',
      variables: [
        { symbol: String.raw`d`, meaning: 'Distancia de frenado', unit: 'm' },
        { symbol: String.raw`\mu_k`, meaning: 'Coeficiente de fricción cinética', unit: '— (adimensional)' },
        { symbol: String.raw`g`, meaning: 'Aceleración de la gravedad', unit: 'm/s²' },
      ],
      notes: 'No depende de la masa; es proporcional al cuadrado de la rapidez.',
    },
  ],
  examples: [
    {
      title: 'Energía cinética de una guagua',
      statement: String.raw`Una guagua de $9000\,\mathrm{kg}$ circula a $54\,\mathrm{km/h}$. ¿Cuál es su energía cinética? ¿Y si acelera hasta $108\,\mathrm{km/h}$?`,
      steps: [
        String.raw`Convertimos: $54\,\mathrm{km/h} \div 3.6 = 15\,\mathrm{m/s}$ y $108\,\mathrm{km/h} \div 3.6 = 30\,\mathrm{m/s}$.`,
        String.raw`$K_1 = \tfrac12 (9000\,\mathrm{kg})(15\,\mathrm{m/s})^2 = 4500 \times 225 = 1.01\times10^{6}\,\mathrm{J}$.`,
        String.raw`$K_2 = \tfrac12 (9000\,\mathrm{kg})(30\,\mathrm{m/s})^2 = 4500 \times 900 = 4.05\times10^{6}\,\mathrm{J}$.`,
      ],
      result: String.raw`$K_1 \approx 1.0\,\mathrm{MJ}$ y $K_2 \approx 4.1\,\mathrm{MJ}$.`,
      interpretation: 'Al duplicar la rapidez, la energía cinética se multiplica por cuatro: los frenos deben disipar cuatro veces más energía para detenerla.',
    },
    {
      title: 'Rapidez final con el teorema trabajo–energía',
      statement: String.raw`Un bloque de $2.0\,\mathrm{kg}$ que se mueve a $3.0\,\mathrm{m/s}$ sobre una mesa horizontal recibe un empuje horizontal de $12\,\mathrm{N}$ a lo largo de $4.0\,\mathrm{m}$. El coeficiente de fricción cinética es $0.20$. ¿Con qué rapidez termina?`,
      steps: [
        String.raw`Normal: $N = mg = 19.6\,\mathrm{N}$; fricción: $f_k = 0.20 \times 19.6 = 3.92\,\mathrm{N}$.`,
        String.raw`Trabajo neto: $W_{neto} = (12 - 3.92)\,\mathrm{N} \times 4.0\,\mathrm{m} = 32.3\,\mathrm{J}$ (peso y normal no trabajan).`,
        String.raw`Energía cinética inicial: $K_i = \tfrac12 (2.0)(3.0)^2 = 9.0\,\mathrm{J}$.`,
        String.raw`$K_f = K_i + W_{neto} = 9.0 + 32.3 = 41.3\,\mathrm{J}$, así que $v_f = \sqrt{2K_f/m} = \sqrt{41.3\,\mathrm{m^2/s^2}} = 6.43\,\mathrm{m/s}$.`,
      ],
      result: String.raw`$v_f \approx 6.4\,\mathrm{m/s}$.`,
      interpretation: 'El trabajo neto es positivo y la rapidez aumenta. Observe que no hizo falta calcular ni la aceleración ni el tiempo.',
    },
    {
      title: 'Distancia de frenado',
      statement: String.raw`Un carro circula a $72\,\mathrm{km/h}$ por una carretera horizontal y frena con las ruedas bloqueadas. Si $\mu_k = 0.60$ (asfalto seco), ¿qué distancia recorre hasta detenerse?`,
      steps: [
        String.raw`$v = 72 / 3.6 = 20\,\mathrm{m/s}$.`,
        String.raw`Teorema trabajo–energía: $-\mu_k m g\,d = 0 - \tfrac12 m v^2$, de donde $d = \dfrac{v^2}{2\mu_k g}$.`,
        String.raw`$d = \dfrac{(20\,\mathrm{m/s})^2}{2(0.60)(9.8\,\mathrm{m/s^2})} = \dfrac{400}{11.76}\,\mathrm{m} = 34\,\mathrm{m}$.`,
      ],
      result: String.raw`$d \approx 34\,\mathrm{m}$.`,
      interpretation: 'A 144 km/h (el doble) la distancia sería cuatro veces mayor, unos 136 m. Sobre asfalto mojado (μk menor) también aumentaría.',
    },
  ],
  simulation: {
    key: 'trabajo-energia',
    params: { m: 2, F: 20, phi: 0, muK: 0.2, d: 5, v0: 0, g: 9.8 },
    guide: String.raw`1. Pulse **Iniciar** con los valores iniciales. Compare, en cada instante, la barra del trabajo neto con la barra de $\Delta K$. ¿Qué observa?
2. Con la rapidez final que muestra el simulador, calcule $K_f = \tfrac12 m v_f^2$ y compruebe que coincide con el trabajo neto.
3. Duplique la distancia $d$. ¿Se duplica la rapidez final? ¿Qué magnitud sí se duplica?
4. Ponga $F = 0$, $v_0 = 6\,\mathrm{m/s}$ y $\mu_k = 0.3$. El bloque frena por la fricción: ¿qué distancia recorre? Compárela con $d = v_0^2/(2\mu_k g)$.
5. En el caso anterior, cambie la masa. ¿Cambia la distancia de frenado? Explique por qué.`,
  },
  exercises: [
    {
      id: 'b4-ecin-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['energia-cinetica-definicion'],
      prompt: String.raw`Un automóvil de $1200\,\mathrm{kg}$ circula a $72\,\mathrm{km/h}$. ¿Cuál es su energía cinética?`,
      format: 'numeric',
      unitHint: 'J',
    },
    {
      id: 'b4-ecin-02',
      category: 'conceptual',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['energia-cinetica-definicion'],
      prompt: String.raw`Un ciclista aumenta su rapidez de $5\,\mathrm{m/s}$ a $15\,\mathrm{m/s}$. ¿Por qué factor se multiplica su energía cinética? Escriba solo el número.`,
      format: 'numeric',
    },
    {
      id: 'b4-ecin-03',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['energia-cinetica-teorema'],
      prompt: String.raw`Una caja desliza por un piso horizontal y, por efecto de la fricción, su rapidez disminuye de $4\,\mathrm{m/s}$ a $2\,\mathrm{m/s}$. ¿Qué se puede afirmar sobre el trabajo neto realizado sobre la caja en ese tramo?`,
      format: 'choice',
      options: [
        'Es positivo, porque la caja recorrió una distancia.',
        'Es cero, porque la caja sigue moviéndose.',
        'Es negativo e igual en valor a la disminución de su energía cinética.',
        'No se puede saber sin conocer la duración del tramo.',
      ],
    },
    {
      id: 'b4-ecin-04',
      category: 'experimento',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['energia-cinetica-teorema'],
      prompt: String.raw`En el simulador, fije $m = 2\,\mathrm{kg}$, $F = 20\,\mathrm{N}$, $\varphi = 0^\circ$, $\mu_k = 0.2$, $d = 5\,\mathrm{m}$, $v_0 = 0$ y $g = 9.8\,\mathrm{m/s^2}$. Use el teorema trabajo–energía para **predecir la rapidez final** del bloque al completar los $5\,\mathrm{m}$. Después ejecute la simulación y compare con la lectura «Rapidez al final».`,
      format: 'numeric',
      unitHint: 'm/s',
      simulation: { key: 'trabajo-energia', params: { m: 2, F: 20, phi: 0, muK: 0.2, d: 5, v0: 0, g: 9.8 } },
    },
    {
      id: 'b4-ecin-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['energia-cinetica-frenado', 'energia-cinetica-teorema'],
      prompt: String.raw`Un carro circula a $90\,\mathrm{km/h}$ por una autopista horizontal. Ante un obstáculo, el conductor frena bruscamente y las ruedas se bloquean. El coeficiente de fricción cinética entre los neumáticos y el asfalto es $0.70$. Usando el teorema trabajo–energía, determine la distancia que recorre el carro desde que se bloquean las ruedas hasta detenerse.`,
      format: 'numeric',
      unitHint: 'm',
    },
    {
      id: 'b4-ecin-06',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['energia-cinetica-teorema'],
      prompt: String.raw`**Verdadero o falso:** si el trabajo neto realizado sobre un cuerpo durante un intervalo es cero, el cuerpo estuvo en reposo durante ese intervalo. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b4-ecin-07',
      category: 'numerica',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['energia-cinetica-teorema', 'energia-cinetica-definicion'],
      prompt: String.raw`Una pelota de béisbol de $0.145\,\mathrm{kg}$ llega al guante del receptor a $40\,\mathrm{m/s}$ y queda detenida en él. ¿Qué trabajo realiza el guante sobre la pelota? Incluya el signo.`,
      format: 'numeric',
      unitHint: 'J',
    },
    {
      id: 'b4-ecin-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['energia-cinetica-teorema', 'energia-cinetica-frenado'],
      prompt: String.raw`Un bloque de $5.0\,\mathrm{kg}$ parte del reposo sobre un piso horizontal. Se le aplica una fuerza horizontal de $40\,\mathrm{N}$ durante los primeros $6.0\,\mathrm{m}$ y luego se deja de empujar. El coeficiente de fricción cinética es $0.30$ en todo el recorrido.

(a) Calcule el trabajo de cada fuerza durante los primeros $6.0\,\mathrm{m}$ y la rapidez del bloque al final de ese tramo.
(b) Usando el teorema trabajo–energía, calcule la distancia adicional que recorre hasta detenerse.
(c) Compruebe que el trabajo total de la fricción en todo el recorrido es igual, en valor, al trabajo de la fuerza aplicada. Explique por qué debe ser así.`,
      format: 'open',
    },
  ],
};
