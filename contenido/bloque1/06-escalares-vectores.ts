import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'escalares-vectores',
  title: 'Escalares y vectores',
  summary:
    'Magnitudes que necesitan una dirección: representación de vectores, componentes con trigonometría, suma gráfica y por componentes, y cálculo de la magnitud y la dirección del resultado.',
  concepts: [
    { slug: 'vec-escalar-vector', name: 'Magnitudes escalares y vectoriales' },
    { slug: 'vec-componentes', name: 'Componentes de un vector' },
    { slug: 'vec-suma', name: 'Suma de vectores' },
  ],
  theory: String.raw`## No basta con «cuánto»: a veces importa «hacia dónde»

Si le dicen que la temperatura en Santiago es de $31\,^\circ\mathrm{C}$, la información está completa. Pero si un amigo le dice «camina $200\,\mathrm{m}$ y llegarás a la playa», le falta algo esencial: ¿hacia dónde? Hay dos tipos de magnitudes:

- **Escalares**: quedan completamente determinadas por un número y una unidad. Ejemplos: masa, tiempo, temperatura, energía, volumen, distancia recorrida, rapidez.
- **Vectoriales**: además del número y la unidad necesitan una **dirección** (con su sentido). Ejemplos: desplazamiento, velocidad, aceleración, fuerza.

Esta distinción permite separar pares de ideas que en el lenguaje común se confunden. La **distancia** recorrida es un escalar; el **desplazamiento** es un vector que va del punto de partida al de llegada. La **rapidez** es un escalar; la **velocidad** es un vector. Si da una vuelta completa a una pista de $400\,\mathrm{m}$, recorre una distancia de $400\,\mathrm{m}$, pero su desplazamiento es cero.

## Representación de un vector

Un vector se dibuja como una **flecha**: su longitud, a escala, es la **magnitud** (o módulo) y la punta indica la **dirección**. Se escribe con una flecha encima, $\vec A$, y su magnitud como $A$ o $|\vec A|$. La magnitud nunca es negativa.

Para dar la dirección usaremos, como el simulador, el **ángulo $\theta$ medido desde el eje $+x$ en sentido antihorario**. Así, $\theta = 90^\circ$ apunta hacia $+y$, $\theta = 180^\circ$ hacia $-x$, y $\theta = -90^\circ$ (o $270^\circ$) hacia $-y$. En problemas de navegación se usan también expresiones como «$30^\circ$ al norte del este», que con el eje $+x$ hacia el este y el $+y$ hacia el norte corresponde a $\theta = 30^\circ$.

Dos vectores son **iguales** si tienen la misma magnitud y la misma dirección, aunque estén dibujados en lugares distintos: un vector se puede trasladar paralelamente sin cambiarlo. El vector $-\vec B$ tiene la misma magnitud que $\vec B$ y la dirección opuesta.

## Componentes

Todo vector del plano puede descomponerse en dos vectores perpendiculares, uno a lo largo de cada eje. Las **componentes** son los números (con signo) que miden esas proyecciones. Con el triángulo rectángulo que forman el vector y sus proyecciones:

$$A_x = A\cos\theta, \qquad A_y = A\sin\theta .$$

Las componentes **sí pueden ser negativas**: el signo indica hacia qué lado del eje apunta la proyección. Un vector de $4.0\,\mathrm{u}$ a $150^\circ$ tiene $A_x = 4.0\cos150^\circ = -3.5\,\mathrm{u}$ y $A_y = 4.0\sin150^\circ = +2.0\,\mathrm{u}$: apunta hacia la izquierda y hacia arriba. Si usa siempre el ángulo medido desde $+x$, los signos salen solos.

> **Cuidado.** Si el ángulo se mide desde el eje $y$ (por ejemplo, «$25^\circ$ al este del norte»), el coseno corresponde a la componente $y$ y el seno a la $x$. Dibuje siempre el triángulo antes de elegir la función. Y compruebe que la calculadora esté en **grados**, no en radianes.

## Magnitud y dirección a partir de las componentes

El camino inverso usa el teorema de Pitágoras y la tangente:

$$A = \sqrt{A_x^2 + A_y^2}, \qquad \tan\theta = \frac{A_y}{A_x}.$$

La función $\tan^{-1}$ de la calculadora solo devuelve ángulos entre $-90^\circ$ y $90^\circ$, es decir, del primer y cuarto cuadrante. Si $A_x < 0$, el vector está en el segundo o tercer cuadrante y hay que **sumar $180^\circ$** al resultado de la calculadora. Por ejemplo, para $(-3, 4)$ la calculadora da $-53.1^\circ$, pero el vector apunta hacia arriba a la izquierda: $\theta = -53.1^\circ + 180^\circ = 126.9^\circ$. Un dibujo rápido evita este error.

## Suma de vectores: método gráfico

Sumar vectores no es sumar sus magnitudes. Si camina $3\,\mathrm{km}$ al este y luego $4\,\mathrm{km}$ al norte, ha caminado $7\,\mathrm{km}$, pero está a solo $5\,\mathrm{km}$ del punto de partida.

- **Método del triángulo (punta con cola)**: se dibuja $\vec A$; desde su punta se dibuja $\vec B$. La resultante $\vec R = \vec A + \vec B$ va desde la cola de $\vec A$ hasta la punta de $\vec B$.
- **Método del paralelogramo**: se dibujan $\vec A$ y $\vec B$ desde el mismo origen y se completa el paralelogramo; la resultante es la diagonal que parte del origen común.

Los dos métodos dan lo mismo, y el orden no importa: $\vec A + \vec B = \vec B + \vec A$. La magnitud de la suma está siempre entre la diferencia y la suma de las magnitudes:

$$|A - B| \le |\vec A + \vec B| \le A + B .$$

El máximo se alcanza cuando los vectores apuntan en la misma dirección y el mínimo cuando son opuestos.

**Restar** es sumar el opuesto: $\vec A - \vec B = \vec A + (-\vec B)$.

## Suma por componentes

El método gráfico ayuda a visualizar, pero es impreciso. El método analítico es más sencillo: **las componentes se suman como números**:

$$R_x = A_x + B_x, \qquad R_y = A_y + B_y .$$

El procedimiento completo es:

1. Descomponer cada vector: $A_x$, $A_y$, $B_x$, $B_y$, con sus signos.
2. Sumar por separado las componentes $x$ y las componentes $y$.
3. Calcular la magnitud $R = \sqrt{R_x^2 + R_y^2}$ y la dirección con $\tan\theta_R = R_y/R_x$, revisando el cuadrante.

Funciona igual para tres o más vectores, y para restas: $(\vec A - \vec B)_x = A_x - B_x$.

## Errores frecuentes

- Sumar magnitudes: $|\vec A + \vec B| = A + B$ solo si los vectores son paralelos y del mismo sentido.
- Sumar los ángulos o promediarlos para obtener la dirección de la resultante.
- Olvidar los signos de las componentes o el cuadrante del ángulo.
- Usar la calculadora en radianes.`,
  formulas: [
    {
      name: 'Componentes de un vector',
      latex: String.raw`A_x = A\cos\theta, \qquad A_y = A\sin\theta`,
      description: 'Proyecciones del vector sobre los ejes. Con θ medido desde +x en sentido antihorario, los signos salen automáticamente.',
      variables: [
        { symbol: String.raw`A`, meaning: 'Magnitud del vector (siempre ≥ 0)', unit: 'la del vector (m, N, m/s…)' },
        { symbol: String.raw`\theta`, meaning: 'Ángulo desde el eje +x, antihorario', unit: '°' },
        { symbol: String.raw`A_x,\,A_y`, meaning: 'Componentes (pueden ser negativas)', unit: 'la del vector' },
      ],
    },
    {
      name: 'Magnitud y dirección',
      latex: String.raw`A = \sqrt{A_x^2 + A_y^2}, \qquad \tan\theta = \frac{A_y}{A_x}`,
      description: 'Reconstruyen el vector a partir de sus componentes. Si A_x < 0, se suma 180° al ángulo que da la calculadora.',
      variables: [
        { symbol: String.raw`A`, meaning: 'Magnitud', unit: 'la del vector' },
        { symbol: String.raw`\theta`, meaning: 'Dirección medida desde +x', unit: '°' },
      ],
      notes: 'Haga siempre un dibujo para comprobar el cuadrante.',
    },
    {
      name: 'Suma por componentes',
      latex: String.raw`\vec R = \vec A + \vec B:\quad R_x = A_x + B_x,\quad R_y = A_y + B_y`,
      description: 'Las componentes de la resultante son la suma algebraica (con signo) de las componentes de los sumandos.',
      variables: [
        { symbol: String.raw`R_x,\,R_y`, meaning: 'Componentes de la resultante', unit: 'la de los vectores' },
        { symbol: String.raw`A_x,\,B_x,\,A_y,\,B_y`, meaning: 'Componentes de cada sumando', unit: 'la de los vectores' },
      ],
      notes: 'Para restar: (A − B)ₓ = Aₓ − Bₓ y (A − B)ᵧ = Aᵧ − Bᵧ.',
    },
    {
      name: 'Límites de la magnitud de la suma',
      latex: String.raw`|A - B| \le |\vec A + \vec B| \le A + B`,
      description: 'La magnitud de la resultante es máxima si los vectores son paralelos y del mismo sentido, y mínima si son opuestos.',
      variables: [
        { symbol: String.raw`A,\,B`, meaning: 'Magnitudes de los vectores', unit: 'la de los vectores' },
      ],
    },
  ],
  examples: [
    {
      title: 'Componentes de la velocidad de una pelota bateada',
      statement: String.raw`Una pelota de béisbol sale del bate con una rapidez de $15\,\mathrm{m/s}$ formando $40^\circ$ con la horizontal. Calcule las componentes horizontal y vertical de su velocidad.`,
      steps: [
        String.raw`Eje $+x$ horizontal en el sentido del golpe y eje $+y$ hacia arriba; el ángulo desde $+x$ es $\theta = 40^\circ$.`,
        String.raw`Componente horizontal: $v_x = v\cos\theta = (15\,\mathrm{m/s})\cos40^\circ = (15\,\mathrm{m/s})(0.766) = 11.5\,\mathrm{m/s}$.`,
        String.raw`Componente vertical: $v_y = v\sin\theta = (15\,\mathrm{m/s})\sin40^\circ = (15\,\mathrm{m/s})(0.643) = 9.64\,\mathrm{m/s}$.`,
        String.raw`Comprobación: $\sqrt{11.5^2 + 9.64^2} = \sqrt{132 + 93} = 15.0\,\mathrm{m/s}$ ✓.`,
      ],
      result: String.raw`$v_x \approx 11\,\mathrm{m/s}$ y $v_y \approx 9.6\,\mathrm{m/s}$ (con tres cifras: $11.5$ y $9.64\,\mathrm{m/s}$).`,
      interpretation: 'Como el ángulo es menor que 45°, la componente horizontal es mayor que la vertical. Cada componente es menor que la magnitud: un cateto nunca supera a la hipotenusa.',
    },
    {
      title: 'Magnitud y dirección a partir de las componentes',
      statement: String.raw`Una fuerza tiene componentes $F_x = -6.0\,\mathrm{N}$ y $F_y = -8.0\,\mathrm{N}$. Halle su magnitud y su dirección.`,
      steps: [
        String.raw`Magnitud: $F = \sqrt{(-6.0)^2 + (-8.0)^2}\,\mathrm{N} = \sqrt{36 + 64}\,\mathrm{N} = 10\,\mathrm{N}$.`,
        String.raw`Tangente: $\tan\theta = \dfrac{-8.0}{-6.0} = 1.33$. La calculadora da $\tan^{-1}(1.33) = 53.1^\circ$.`,
        String.raw`Pero las dos componentes son negativas: el vector está en el **tercer cuadrante**. Sumamos $180^\circ$: $\theta = 53.1^\circ + 180^\circ = 233.1^\circ$, equivalente a $-126.9^\circ$.`,
      ],
      result: String.raw`$F = 10\,\mathrm{N}$ con dirección $\theta = 233.1^\circ$ (o $-126.9^\circ$) desde el eje $+x$.`,
      interpretation: String.raw`La calculadora no distingue $(-6, -8)$ de $(6, 8)$, porque ambos dan el mismo cociente. Un dibujo rápido muestra que el vector apunta hacia abajo a la izquierda. Si se prefiere expresar la dirección entre $-180^\circ$ y $180^\circ$, como en los controles del simulador, se escribe $-126.9^\circ$.`,
    },
    {
      title: 'Suma de dos desplazamientos',
      statement: String.raw`Un ciclista recorre $3.0\,\mathrm{km}$ hacia el este y luego $5.0\,\mathrm{km}$ en dirección $60^\circ$ al norte del este. ¿A qué distancia y en qué dirección queda del punto de partida?`,
      steps: [
        String.raw`Ejes: $+x$ al este, $+y$ al norte. $\vec A$: $3.0\,\mathrm{km}$ a $0^\circ$; $\vec B$: $5.0\,\mathrm{km}$ a $60^\circ$.`,
        String.raw`Componentes: $A_x = 3.0\,\mathrm{km}$, $A_y = 0$; $B_x = 5.0\cos60^\circ = 2.5\,\mathrm{km}$, $B_y = 5.0\sin60^\circ = 4.33\,\mathrm{km}$.`,
        String.raw`Suma: $R_x = 3.0 + 2.5 = 5.5\,\mathrm{km}$; $R_y = 0 + 4.33 = 4.33\,\mathrm{km}$.`,
        String.raw`Magnitud: $R = \sqrt{5.5^2 + 4.33^2}\,\mathrm{km} = \sqrt{30.25 + 18.75}\,\mathrm{km} = \sqrt{49.0}\,\mathrm{km} = 7.0\,\mathrm{km}$.`,
        String.raw`Dirección: $\tan\theta = 4.33/5.5 = 0.787 \Rightarrow \theta = 38.2^\circ$ (primer cuadrante, no hay que corregir).`,
      ],
      result: String.raw`El ciclista queda a $7.0\,\mathrm{km}$ del punto de partida, en dirección $38^\circ$ al norte del este.`,
      interpretation: String.raw`Recorrió $8.0\,\mathrm{km}$, pero su desplazamiento mide $7.0\,\mathrm{km}$: está entre $|5.0 - 3.0| = 2.0$ y $5.0 + 3.0 = 8.0\,\mathrm{km}$, como debe ser. La dirección queda entre $0^\circ$ y $60^\circ$, más cerca de la del vector más largo.`,
    },
  ],
  simulation: {
    key: 'vectores',
    params: { aMag: 4, aAng: 0, bMag: 3, bAng: 90 },
    guide: String.raw`1. Con $\vec A = 4\,\mathrm{u}$ a $0^\circ$ y $\vec B = 3\,\mathrm{u}$ a $90^\circ$, lea $R_x$, $R_y$, $|\vec R|$ y el ángulo de $\vec R$. Compruebe $|\vec R|$ con el teorema de Pitágoras.
2. Cambie la dirección de $\vec B$ a $0^\circ$ y luego a $180^\circ$. Anote $|\vec R|$ en ambos casos. ¿Coinciden con $A + B$ y con $|A - B|$?
3. Vaya aumentando la dirección de $\vec B$ de $0^\circ$ a $180^\circ$ de $30^\circ$ en $30^\circ$. Describa cómo cambia $|\vec R|$.
4. Ponga $\vec A$ a $150^\circ$. ¿Qué signo tienen $A_x$ y $A_y$? Compárelos con $4\cos150^\circ$ y $4\sin150^\circ$.
5. Con $\vec A$ y $\vec B$ perpendiculares, compare $|\vec A + \vec B|$ con $|\vec A - \vec B|$. ¿Por qué son iguales? ¿Ocurre lo mismo si no son perpendiculares?`,
  },
  exercises: [
    {
      id: 'b1-vec-01',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['vec-escalar-vector'],
      prompt: 'Marque **todas** las magnitudes vectoriales.',
      format: 'choice',
      multiple: true,
      options: ['Desplazamiento', 'Masa', 'Velocidad', 'Temperatura', 'Fuerza', 'Tiempo'],
    },
    {
      id: 'b1-vec-02',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['vec-componentes'],
      prompt: String.raw`Un desplazamiento tiene una magnitud de $8.0\,\mathrm{m}$ y forma un ángulo de $30^\circ$ con el eje $+x$ (medido en sentido antihorario). ¿Cuánto vale su componente $x$?`,
      format: 'numeric',
      unitHint: 'm',
    },
    {
      id: 'b1-vec-03',
      category: 'experimento',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['vec-suma'],
      prompt: String.raw`En el simulador, $\vec A$ mide $6.0\,\mathrm{u}$ a $0^\circ$ y $\vec B$ mide $8.0\,\mathrm{u}$ a $90^\circ$. **Antes de ejecutarlo**, calcule la magnitud de $\vec R = \vec A + \vec B$. Después compruebe su resultado con la lectura $|\vec R|$ del simulador. ¿Cuánto vale $|\vec R|$?`,
      format: 'numeric',
      unitHint: 'u',
      simulation: { key: 'vectores', params: { aMag: 6, aAng: 0, bMag: 8, bAng: 90 } },
    },
    {
      id: 'b1-vec-04',
      category: 'error',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['vec-componentes'],
      prompt: String.raw`Un desplazamiento tiene componentes $R_x = -3.0\,\mathrm{m}$ y $R_y = 4.0\,\mathrm{m}$. Un estudiante calcula su magnitud y su dirección así:

1. Magnitud: $R = \sqrt{(-3.0)^2 + (4.0)^2}\,\mathrm{m} = \sqrt{25}\,\mathrm{m} = 5.0\,\mathrm{m}$.
2. Tangente: $\tan\theta = R_y/R_x = 4.0/(-3.0) = -1.33$.
3. La calculadora da $\tan^{-1}(-1.33) = -53.1^\circ$.
4. Conclusión: la dirección del vector es $\theta = -53.1^\circ$, es decir, $53.1^\circ$ por debajo del eje $+x$.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'No hay ningún error'],
    },
    {
      id: 'b1-vec-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['vec-suma', 'vec-componentes'],
      prompt: String.raw`Una lancha sale de un muelle y navega $12\,\mathrm{km}$ hacia el norte. Luego navega $20\,\mathrm{km}$ en dirección $30^\circ$ al sur del este. ¿A qué distancia en línea recta del muelle se encuentra al final?`,
      format: 'numeric',
      unitHint: 'km',
    },
    {
      id: 'b1-vec-06',
      category: 'numerica',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['vec-componentes'],
      prompt: String.raw`Una fuerza de $50\,\mathrm{N}$ actúa en dirección $\theta = 120^\circ$, medida desde el eje $+x$ en sentido antihorario. ¿Cuánto vale su componente $F_x$? Incluya el signo.`,
      format: 'numeric',
      unitHint: 'N',
    },
    {
      id: 'b1-vec-07',
      category: 'experimento',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['vec-suma', 'vec-componentes'],
      prompt: String.raw`En el simulador, $\vec A$ mide $5.0\,\mathrm{u}$ a $30^\circ$ y $\vec B$ mide $4.0\,\mathrm{u}$ a $120^\circ$. Calcule por componentes la **dirección** de $\vec R = \vec A + \vec B$ (ángulo desde el eje $+x$) y compruébela con la lectura del simulador.`,
      format: 'numeric',
      unitHint: '°',
      simulation: { key: 'vectores', params: { aMag: 5, aAng: 30, bMag: 4, bAng: 120 } },
    },
    {
      id: 'b1-vec-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['vec-suma', 'vec-componentes', 'vec-escalar-vector'],
      prompt: String.raw`Una persona camina $40\,\mathrm{m}$ hacia el norte y después $30\,\mathrm{m}$ hacia el noroeste (es decir, a $45^\circ$ entre el norte y el oeste). Tome $+x$ hacia el este y $+y$ hacia el norte.
(a) Escriba cada desplazamiento con su ángulo desde $+x$ y calcule sus componentes.
(b) Calcule la magnitud y la dirección del desplazamiento total.
(c) Haga un dibujo aproximado con el método del triángulo y compruebe que su resultado es coherente.
(d) Compare la distancia recorrida con la magnitud del desplazamiento y explique la diferencia.
(e) Calcule la magnitud de $\vec A - \vec B$ y compruebe (b) y (e) en el simulador usando la escala $1\,\mathrm{u} = 10\,\mathrm{m}$.`,
      format: 'open',
    },
  ],
};
