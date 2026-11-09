import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'mas',
  title: 'Movimiento armónico simple',
  summary:
    'El modelo común del resorte y del péndulo: x = A cos(ωt + φ), velocidad y aceleración máximas, a = −ω²x y el intercambio de energía cinética y potencial.',
  concepts: [
    { slug: 'mas-ecuacion', name: 'Ecuación del MAS: amplitud, frecuencia angular y fase' },
    { slug: 'mas-velocidad-aceleracion-maximas', name: 'Velocidad y aceleración en el MAS' },
    { slug: 'mas-energia', name: 'Energía en el MAS' },
  ],
  theory: String.raw`## Un modelo para muchas oscilaciones

El bloque unido a un resorte y el péndulo con ángulos pequeños tienen algo en común: la fuerza que los devuelve al equilibrio es **proporcional al desplazamiento y de sentido contrario**, $F = -k\,x$. Todo movimiento producido por una fuerza así se llama **movimiento armónico simple (MAS)**. Es el modelo de oscilación más importante de la física: describe, al menos de forma aproximada, las vibraciones de un diapasón, de las moléculas, de un edificio o de la membrana de un altavoz.

## La sombra de un movimiento circular

Hay una forma muy visual de obtener la ecuación del MAS sin cálculo. Imagine un punto $P$ que gira con movimiento circular uniforme en una circunferencia de radio $A$ con frecuencia angular $\omega$, e ilumínelo desde arriba de modo que su sombra caiga sobre el eje $x$. Mientras $P$ da vueltas, su sombra va y viene entre $-A$ y $+A$.

Si en $t = 0$ el radio de $P$ forma un ángulo $\varphi$ con el eje $x$, en el instante $t$ forma el ángulo $\omega t + \varphi$, y la sombra está en

$$x(t) = A\cos(\omega t + \varphi).$$

Se puede comprobar que el movimiento de esa sombra es **exactamente** el de un bloque unido a un resorte con $\omega = \sqrt{k/m}$. Cada símbolo tiene un significado claro:

- $A$, la **amplitud**: el desplazamiento máximo.
- $\omega$, la **frecuencia angular**: $\omega = 2\pi f = 2\pi/T$. Para un resorte, $\omega = \sqrt{k/m}$; para un péndulo, $\omega = \sqrt{g/L}$.
- $\omega t + \varphi$, la **fase**, un ángulo en radianes que indica en qué punto del ciclo está el oscilador.
- $\varphi$, la **fase inicial**, que depende de cómo se puso en marcha. Si se suelta desde $x = +A$ en reposo, $\varphi = 0$ y $x = A\cos(\omega t)$. Si parte del equilibrio moviéndose hacia $-x$, $\varphi = 90^\circ$ y la curva es un seno: $x = A\cos(\omega t + 90^\circ) = -A\sin(\omega t)$.

> **Cuidado.** El ángulo $\omega t + \varphi$ va en **radianes** si $\omega$ está en rad/s. Ponga la calculadora en modo radianes.

## Velocidad y aceleración

La rapidez de $P$ en la circunferencia es constante: $v_P = A\omega$ (como en el MCU, $v = \omega r$). La sombra se mueve más rápido cuando $P$ pasa por la parte de arriba o de abajo del círculo, porque entonces $P$ se mueve paralelo al eje $x$. Eso ocurre cuando la sombra está en el **centro** ($x = 0$). En los extremos, $P$ se mueve perpendicular al eje y la sombra se detiene un instante. Así:

$$v_{max} = A\,\omega .$$

La aceleración de $P$ es centrípeta, de módulo $A\omega^2$, apuntando hacia el centro. Su proyección sobre el eje es

$$a = -\omega^2\,x ,$$

de módulo máximo en los extremos:

$$a_{max} = A\,\omega^2 .$$

La relación $a = -\omega^2 x$ es la «firma» del MAS: **la aceleración es proporcional al desplazamiento y opuesta a él**. Es la segunda ley de Newton con la ley de Hooke: $a = F/m = -(k/m)\,x$.

| Posición | Velocidad | Aceleración |
|---|---|---|
| Extremo ($x = \pm A$) | cero | máxima, hacia el centro |
| Equilibrio ($x = 0$) | máxima | cero |

> **Error frecuente.** Creer que en el extremo, como la velocidad es cero, la aceleración también lo es. Es al revés: allí la fuerza es máxima. Tampoco la aceleración es constante, de modo que **no** se pueden usar las ecuaciones del MRUA.

## Energía en el MAS

En un oscilador sin fricción, la energía mecánica se conserva. En los extremos toda la energía es potencial elástica; al pasar por el equilibrio, toda es cinética:

$$E = \tfrac12 m v^2 + \tfrac12 k x^2 = \tfrac12 k A^2 = \tfrac12 m\,v_{max}^2 .$$

Consecuencias útiles:

1. **La energía total es proporcional al cuadrado de la amplitud.** Duplicar la amplitud cuadruplica la energía.
2. **La rapidez en cualquier posición** se obtiene de la conservación: $\tfrac12 m v^2 = \tfrac12 k (A^2 - x^2)$, es decir, $v = \omega\sqrt{A^2 - x^2}$.
3. La energía cinética y la potencial son iguales cuando $x = A/\sqrt{2} \approx 0.71\,A$, no en $x = A/2$.

## Errores frecuentes

- Confundir $\omega$ con $f$ al calcular $v_{max} = A\omega$.
- Calcular la aceleración con fórmulas del MRUA.
- Pensar que la energía es proporcional a la amplitud (es a su cuadrado).
- Usar la calculadora en grados para evaluar $\cos(\omega t + \varphi)$.

## Límites del modelo

El MAS exige una fuerza restauradora exactamente proporcional al desplazamiento. Los resortes reales lo cumplen solo para deformaciones moderadas, y los péndulos, solo para ángulos pequeños. Además, la fricción hace que la amplitud disminuya con el tiempo (oscilación **amortiguada**). Aun así, casi cualquier sistema que oscile con amplitud pequeña alrededor de un equilibrio estable se comporta como un MAS, y por eso el modelo es tan útil.`,
  formulas: [
    {
      name: 'Posición en el MAS',
      latex: String.raw`x(t) = A\cos(\omega t + \varphi)`,
      description: 'Posición medida desde el equilibrio. Es la proyección de un movimiento circular uniforme de radio A.',
      variables: [
        { symbol: String.raw`A`, meaning: 'Amplitud', unit: 'm' },
        { symbol: String.raw`\omega`, meaning: 'Frecuencia angular (√(k/m) en un resorte)', unit: 'rad/s' },
        { symbol: String.raw`\varphi`, meaning: 'Fase inicial', unit: 'rad' },
        { symbol: String.raw`t`, meaning: 'Tiempo', unit: 's' },
      ],
    },
    {
      name: 'Velocidad y aceleración máximas',
      latex: String.raw`v_{max} = A\,\omega, \qquad a_{max} = A\,\omega^2`,
      description: 'La rapidez es máxima en el equilibrio; la aceleración, en los extremos.',
      variables: [
        { symbol: String.raw`v_{max}`, meaning: 'Rapidez máxima', unit: 'm/s' },
        { symbol: String.raw`a_{max}`, meaning: 'Módulo de la aceleración máxima', unit: 'm/s²' },
      ],
    },
    {
      name: 'Aceleración en función de la posición',
      latex: String.raw`a = -\omega^2\,x`,
      description: 'La aceleración es proporcional al desplazamiento y de sentido contrario: es la característica del MAS.',
      variables: [
        { symbol: String.raw`a`, meaning: 'Aceleración (con signo)', unit: 'm/s²' },
        { symbol: String.raw`x`, meaning: 'Posición desde el equilibrio (con signo)', unit: 'm' },
      ],
    },
    {
      name: 'Energía mecánica del oscilador',
      latex: String.raw`E = \tfrac12 m v^2 + \tfrac12 k x^2 = \tfrac12 k A^2`,
      description: 'Sin fricción, la suma de energía cinética y potencial elástica es constante y proporcional a A².',
      variables: [
        { symbol: String.raw`E`, meaning: 'Energía mecánica total', unit: 'J' },
        { symbol: String.raw`k`, meaning: 'Constante elástica', unit: 'N/m' },
        { symbol: String.raw`v`, meaning: 'Velocidad en la posición x', unit: 'm/s' },
      ],
      notes: 'De ella: v = ω√(A² − x²).',
    },
  ],
  examples: [
    {
      title: 'Leer la ecuación de un oscilador',
      statement: String.raw`La posición de un oscilador es $x(t) = (0.08\,\mathrm{m})\cos(4\pi t)$, con $t$ en segundos. Determine la amplitud, la frecuencia, el período y la posición en $t = 0.125\,\mathrm{s}$.`,
      steps: [
        String.raw`Comparando con $x = A\cos(\omega t + \varphi)$: $A = 0.08\,\mathrm{m}$, $\omega = 4\pi\,\mathrm{rad/s}$ y $\varphi = 0$.`,
        String.raw`$f = \dfrac{\omega}{2\pi} = \dfrac{4\pi}{2\pi} = 2.0\,\mathrm{Hz}$ y $T = 1/f = 0.50\,\mathrm{s}$.`,
        String.raw`En $t = 0.125\,\mathrm{s}$ la fase vale $4\pi(0.125) = \pi/2\,\mathrm{rad}$, y $\cos(\pi/2) = 0$: $x = 0$.`,
      ],
      result: String.raw`$A = 0.08\,\mathrm{m}$, $f = 2.0\,\mathrm{Hz}$, $T = 0.50\,\mathrm{s}$ y $x(0.125\,\mathrm{s}) = 0$.`,
      interpretation: 'Partió del extremo (+A) y al cabo de un cuarto de período llega al equilibrio, como debe ser.',
    },
    {
      title: 'Rapidez y aceleración máximas',
      statement: String.raw`Un bloque oscila con amplitud $5.0\,\mathrm{cm}$ y frecuencia angular $10\,\mathrm{rad/s}$. Calcule su rapidez máxima y su aceleración máxima.`,
      steps: [
        String.raw`$A = 0.050\,\mathrm{m}$.`,
        String.raw`$v_{max} = A\omega = (0.050\,\mathrm{m})(10\,\mathrm{rad/s}) = 0.50\,\mathrm{m/s}$.`,
        String.raw`$a_{max} = A\omega^2 = (0.050\,\mathrm{m})(10\,\mathrm{rad/s})^2 = 5.0\,\mathrm{m/s^2}$.`,
      ],
      result: String.raw`$v_{max} = 0.50\,\mathrm{m/s}$ (en el equilibrio) y $a_{max} = 5.0\,\mathrm{m/s^2}$ (en los extremos).`,
      interpretation: 'El radián es adimensional, por eso (m)(rad/s) da m/s. La aceleración máxima es la mitad de g: un oscilador moderadamente rápido.',
    },
    {
      title: 'Rapidez a partir de la energía',
      statement: String.raw`Un bloque de $0.50\,\mathrm{kg}$ oscila en un resorte de $k = 200\,\mathrm{N/m}$ con amplitud $0.10\,\mathrm{m}$. Calcule la energía total y la rapidez del bloque cuando está en $x = 0.06\,\mathrm{m}$.`,
      steps: [
        String.raw`Energía total: $E = \tfrac12 k A^2 = \tfrac12 (200\,\mathrm{N/m})(0.10\,\mathrm{m})^2 = 1.0\,\mathrm{J}$.`,
        String.raw`Energía potencial en $x = 0.06\,\mathrm{m}$: $U = \tfrac12 (200)(0.06)^2\,\mathrm{J} = 0.36\,\mathrm{J}$.`,
        String.raw`Energía cinética: $K = E - U = 0.64\,\mathrm{J}$, así que $v = \sqrt{2K/m} = \sqrt{2(0.64)/0.50}\,\mathrm{m/s} = 1.6\,\mathrm{m/s}$.`,
      ],
      result: String.raw`$E = 1.0\,\mathrm{J}$ y $v = 1.6\,\mathrm{m/s}$ en $x = 0.06\,\mathrm{m}$.`,
      interpretation: String.raw`Comprobación: $\omega = \sqrt{200/0.50} = 20\,\mathrm{rad/s}$ y $v = \omega\sqrt{A^2 - x^2} = 20\sqrt{0.01 - 0.0036} = 1.6\,\mathrm{m/s}$ ✓. Es menor que $v_{max} = A\omega = 2.0\,\mathrm{m/s}$, como corresponde fuera del equilibrio.`,
    },
  ],
  simulation: {
    key: 'masa-resorte',
    params: { m: 1, k: 40, x0: 0.2, v0: 0, vertical: 0 },
    guide: String.raw`1. Con $x_0 = 0.20\,\mathrm{m}$ y $v_0 = 0$, pulse **Iniciar**. Lea la fase inicial: ¿cuánto vale? Compruebe que la ecuación mostrada es $x = A\cos(\omega t)$.
2. Compare las gráficas $x$–$t$ y $a$–$t$: ¿dónde es máxima la aceleración? ¿Qué signo tiene respecto a $x$?
3. Compruebe que la lectura «v máx» coincide con $A\omega$ y «a máx» con $A\omega^2$.
4. Ponga $x_0 = 0$ y $v_0 = 1.0\,\mathrm{m/s}$. ¿Qué amplitud y qué fase inicial resultan? ¿Por qué ahora la curva es un seno?
5. Observe las barras de energía: ¿cuándo es toda cinética? ¿Cuándo toda potencial? ¿Cambia la total?
6. Duplique $x_0$ (con $v_0 = 0$) y compare la energía total con la anterior.`,
  },
  exercises: [
    {
      id: 'b5-mas-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['mas-velocidad-aceleracion-maximas'],
      prompt: String.raw`Un bloque unido a un resorte oscila con amplitud $12\,\mathrm{cm}$ y período $0.80\,\mathrm{s}$. ¿Cuál es su rapidez máxima?`,
      format: 'numeric',
      unitHint: 'm/s',
    },
    {
      id: 'b5-mas-02',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['mas-velocidad-aceleracion-maximas'],
      prompt: 'En un movimiento armónico simple, ¿dónde son máximas la rapidez y el módulo de la aceleración?',
      format: 'choice',
      options: [
        'Ambas son máximas en los extremos.',
        'Ambas son máximas en el equilibrio.',
        'La rapidez es máxima en el equilibrio y la aceleración en los extremos.',
        'La rapidez es máxima en los extremos y la aceleración en el equilibrio.',
      ],
    },
    {
      id: 'b5-mas-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['mas-velocidad-aceleracion-maximas', 'mas-ecuacion'],
      prompt: String.raw`**Verdadero o falso:** en el movimiento armónico simple la aceleración es constante, por lo que se pueden usar las ecuaciones del MRUA. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b5-mas-04',
      category: 'experimento',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['mas-energia', 'mas-ecuacion'],
      prompt: String.raw`En el simulador, fije $m = 0.5\,\mathrm{kg}$, $k = 50\,\mathrm{N/m}$, resorte horizontal, posición inicial $x_0 = 0.10\,\mathrm{m}$ y velocidad inicial $v_0 = 1.0\,\mathrm{m/s}$. Antes de ejecutarlo, use la conservación de la energía para predecir la **amplitud** del movimiento. Luego compruébela con la lectura del simulador. ¿Cuánto vale la amplitud?`,
      format: 'numeric',
      unitHint: 'm',
      simulation: { key: 'masa-resorte', params: { m: 0.5, k: 50, x0: 0.1, v0: 1, vertical: 0 } },
    },
    {
      id: 'b5-mas-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['mas-energia'],
      prompt: String.raw`Un bloque de $0.25\,\mathrm{kg}$ oscila sin fricción unido a un resorte de $k = 100\,\mathrm{N/m}$ con amplitud $8.0\,\mathrm{cm}$. ¿Cuál es su rapidez cuando se encuentra a $4.0\,\mathrm{cm}$ del equilibrio?`,
      format: 'numeric',
      unitHint: 'm/s',
    },
    {
      id: 'b5-mas-06',
      category: 'grafica',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['mas-ecuacion', 'mas-velocidad-aceleracion-maximas'],
      prompt: 'La gráfica muestra la posición de un oscilador armónico. ¿Cuál es su rapidez máxima?',
      format: 'numeric',
      unitHint: 'm/s',
      figure: {
        kind: 'line',
        title: 'Posición frente al tiempo',
        x: { label: 't', unit: 's' },
        y: { label: 'x', unit: 'cm' },
        series: [
          {
            name: 'x(t)',
            points: [[0, 0], [0.025, 0.927], [0.05, 1.763], [0.075, 2.427], [0.1, 2.853], [0.125, 3], [0.15, 2.853], [0.175, 2.427], [0.2, 1.763], [0.225, 0.927], [0.25, 0], [0.275, -0.927], [0.3, -1.763], [0.325, -2.427], [0.35, -2.853], [0.375, -3], [0.4, -2.853], [0.425, -2.427], [0.45, -1.763], [0.475, -0.927], [0.5, 0], [0.525, 0.927], [0.55, 1.763], [0.575, 2.427], [0.6, 2.853], [0.625, 3], [0.65, 2.853], [0.675, 2.427], [0.7, 1.763], [0.725, 0.927], [0.75, 0], [0.775, -0.927], [0.8, -1.763], [0.825, -2.427], [0.85, -2.853], [0.875, -3], [0.9, -2.853], [0.925, -2.427], [0.95, -1.763], [0.975, -0.927], [1, 0]],
          },
        ],
      },
    },
    {
      id: 'b5-mas-07',
      category: 'conceptual',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['mas-energia'],
      prompt: 'Un bloque oscila unido a un resorte ideal. Si se lo pone a oscilar con el doble de amplitud, ¿qué ocurre con su energía mecánica total?',
      format: 'choice',
      options: ['No cambia.', 'Se duplica.', 'Se cuadruplica.', 'Se reduce a la mitad.'],
    },
    {
      id: 'b5-mas-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['mas-ecuacion', 'mas-velocidad-aceleracion-maximas', 'mas-energia'],
      prompt: String.raw`Un bloque de $0.40\,\mathrm{kg}$ unido a un resorte se mueve según $x(t) = (0.05\,\mathrm{m})\cos(10\,t)$, con $t$ en segundos.

(a) Identifique la amplitud, la frecuencia angular, la frecuencia y el período. (b) Calcule la constante del resorte. (c) Calcule la rapidez máxima y la aceleración máxima e indique dónde ocurren. (d) Calcule la energía mecánica total. (e) ¿En qué posiciones la energía cinética es igual a la potencial? Explique cada paso.`,
      format: 'open',
    },
  ],
};
