import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'magnitudes-fisicas',
  title: 'Magnitudes físicas',
  summary:
    'Qué se puede medir en física, por qué toda medida es un número acompañado de una unidad y cómo las dimensiones permiten comprobar si una ecuación tiene sentido.',
  concepts: [
    { slug: 'mag-magnitud-unidad', name: 'Magnitud física: número y unidad' },
    { slug: 'mag-fundamentales-derivadas', name: 'Magnitudes fundamentales y derivadas' },
    { slug: 'mag-analisis-dimensional', name: 'Dimensiones y homogeneidad dimensional' },
  ],
  theory: String.raw`## ¿Qué es una magnitud física?

La física describe la naturaleza con números. Para ello necesita **magnitudes físicas**: propiedades de los cuerpos o de los fenómenos que se pueden **medir**, es decir, comparar con un patrón. La longitud de una cancha de béisbol, la masa de un aguacate, el tiempo que tarda el Metro de Santo Domingo entre dos estaciones o la temperatura del agua de la playa son magnitudes físicas.

No todo lo que se puede describir es una magnitud. La belleza de un atardecer o el sabor de un mango no se miden comparándolos con un patrón: no son magnitudes físicas. En cambio, el color de una luz sí puede convertirse en una magnitud (su longitud de onda), porque se puede medir con un instrumento.

## Medir es comparar: número y unidad

**Medir** una magnitud es averiguar cuántas veces contiene a otra cantidad de la misma especie que se toma como referencia, la **unidad**. Si decimos que un pasillo mide $12\,\mathrm{m}$, afirmamos que en él cabe $12$ veces la longitud patrón llamada metro.

Por eso el valor de una magnitud tiene siempre dos partes:

$$\text{valor} = \text{número} \times \text{unidad}, \qquad L = 12\,\mathrm{m}.$$

- El **número** no significa nada sin la unidad. «La mesa mide $1.2$» no informa de nada: ¿$1.2\,\mathrm{m}$? ¿$1.2\,\mathrm{ft}$?
- La misma longitud puede expresarse con distintos números si cambiamos la unidad: $1.2\,\mathrm{m} = 120\,\mathrm{cm}$. La magnitud no cambia; cambian el número y la unidad a la vez.

> **Error frecuente.** Escribir los cálculos solo con números y añadir la unidad «al final, a ojo». Arrastre las unidades en cada paso: le avisarán de muchos errores.

## Magnitudes fundamentales y derivadas

Hay cientos de magnitudes, pero no hace falta un patrón independiente para cada una. Basta elegir unas pocas, las **magnitudes fundamentales** (o básicas), y definir todas las demás a partir de ellas mediante ecuaciones. Estas últimas son las **magnitudes derivadas**.

El Sistema Internacional (SI) usa siete magnitudes fundamentales. En mecánica nos bastan las tres primeras:

- **Longitud**: unidad metro (m); dimensión $\mathrm{L}$.
- **Masa**: unidad kilogramo (kg); dimensión $\mathrm{M}$.
- **Tiempo**: unidad segundo (s); dimensión $\mathrm{T}$.
- **Corriente eléctrica**: unidad ampere (A); dimensión $\mathrm{I}$.
- **Temperatura termodinámica**: unidad kelvin (K); dimensión $\Theta$.
- **Cantidad de sustancia**: unidad mol (mol); dimensión $\mathrm{N}$.
- **Intensidad luminosa**: unidad candela (cd); dimensión $\mathrm{J}$.

Algunas magnitudes derivadas y su definición:

- **Área**: longitud × longitud. Unidad: $\mathrm{m^2}$.
- **Volumen**: longitud × longitud × longitud. Unidad: $\mathrm{m^3}$.
- **Velocidad**: desplazamiento ÷ tiempo. Unidad: $\mathrm{m/s}$.
- **Aceleración**: cambio de velocidad ÷ tiempo. Unidad: $\mathrm{m/s^2}$.
- **Densidad**: masa ÷ volumen. Unidad: $\mathrm{kg/m^3}$.
- **Fuerza**: masa × aceleración. Unidad: newton, $1\,\mathrm{N} = 1\,\mathrm{kg\cdot m/s^2}$.
- **Presión**: fuerza ÷ área. Unidad: pascal, $1\,\mathrm{Pa} = 1\,\mathrm{N/m^2}$.
- **Energía**: fuerza × distancia. Unidad: joule, $1\,\mathrm{J} = 1\,\mathrm{N\cdot m}$.

Que una magnitud sea fundamental es una **elección** del sistema de unidades, no una propiedad de la naturaleza. El SI elige la masa como fundamental y la fuerza como derivada; otros sistemas antiguos hacían lo contrario.

## Dimensiones

La **dimensión** de una magnitud indica cómo se construye a partir de las fundamentales, sin importar la unidad concreta. Se escribe entre corchetes. Por ejemplo, una velocidad puede medirse en m/s, km/h o mph, pero siempre es «longitud dividida entre tiempo»:

$$[v] = \mathrm{L\,T^{-1}}, \qquad [a] = \mathrm{L\,T^{-2}}, \qquad [\rho] = \mathrm{M\,L^{-3}}, \qquad [F] = \mathrm{M\,L\,T^{-2}}.$$

Los números puros (como $2$, $\tfrac12$ o $\pi$), los ángulos en radianes y los cocientes de dos magnitudes de la misma especie son **adimensionales**: su dimensión es $1$.

Para obtener la dimensión de un producto o cociente se opera con las dimensiones como si fueran letras de álgebra: se multiplican, se dividen y se elevan a potencias.

## Homogeneidad dimensional

Solo se pueden sumar, restar o igualar magnitudes **de la misma dimensión**. Sumar $5\,\mathrm{m}$ y $3\,\mathrm{s}$ no tiene sentido, como no lo tiene sumar manzanas y horas. De aquí sale el **principio de homogeneidad**: en una ecuación física correcta, **todos los términos tienen la misma dimensión**.

Este principio es una herramienta poderosa y sencilla:

1. **Detectar errores.** Si al final de un problema obtiene una «velocidad» con dimensiones $\mathrm{L\,T}$, hay un error algebraico en algún paso.
2. **Recordar fórmulas.** Si duda entre $x = \tfrac12 a t^2$ y $x = \tfrac12 a t$, basta comprobar dimensiones: solo la primera da $\mathrm{L}$.
3. **Deducir la forma de una ley.** Si se sabe de qué magnitudes depende un fenómeno, a menudo las dimensiones fijan cómo se combinan (lo verá en el ejemplo del péndulo).

> **Cuidado.** Una ecuación dimensionalmente correcta **no** es necesariamente correcta. El análisis dimensional no detecta factores numéricos: $x = a t^2$ y $x = \tfrac12 a t^2$ tienen las mismas dimensiones, pero solo una describe el movimiento con aceleración constante. La homogeneidad es una condición **necesaria**, no suficiente.

## Errores frecuentes

- Confundir la **magnitud** (longitud) con su **unidad** (metro) o con su **símbolo dimensional** ($\mathrm{L}$).
- Pensar que «derivada» significa «menos importante». La velocidad o la energía son derivadas y son centrales en física.
- Creer que la dimensión depende de la unidad elegida: $72\,\mathrm{km/h}$ y $20\,\mathrm{m/s}$ son la misma magnitud con la misma dimensión, $\mathrm{L\,T^{-1}}$.
- Olvidar que los argumentos de funciones como $\sin$ o $\cos$ deben ser adimensionales.`,
  formulas: [
    {
      name: 'Valor de una magnitud',
      latex: String.raw`Q = n \times u`,
      description: 'Toda magnitud medida se expresa como un número multiplicado por una unidad. Si se cambia la unidad, el número cambia en proporción inversa.',
      variables: [
        { symbol: String.raw`Q`, meaning: 'Valor de la magnitud', unit: 'la de la magnitud' },
        { symbol: String.raw`n`, meaning: 'Valor numérico (cuántas unidades contiene)', unit: '— (adimensional)' },
        { symbol: String.raw`u`, meaning: 'Unidad patrón de la misma especie', unit: 'm, kg, s, …' },
      ],
      notes: 'Un número sin unidad no describe una magnitud física (salvo que esta sea adimensional).',
    },
    {
      name: 'Dimensión de una magnitud derivada',
      latex: String.raw`[Q] = \mathrm{M}^{\alpha}\,\mathrm{L}^{\beta}\,\mathrm{T}^{\gamma}`,
      description: 'En mecánica, toda magnitud se expresa como producto de potencias de masa, longitud y tiempo.',
      variables: [
        { symbol: String.raw`[Q]`, meaning: 'Dimensión de la magnitud Q', unit: '—' },
        { symbol: String.raw`\mathrm{M},\,\mathrm{L},\,\mathrm{T}`, meaning: 'Dimensiones de masa, longitud y tiempo', unit: '—' },
        { symbol: String.raw`\alpha,\,\beta,\,\gamma`, meaning: 'Exponentes (números enteros o fraccionarios)', unit: '— (adimensional)' },
      ],
      notes: 'Ejemplos: [v] = L T⁻¹, [ρ] = M L⁻³, [F] = M L T⁻².',
    },
    {
      name: 'Dimensión de un producto de potencias',
      latex: String.raw`[a^{p}\,b^{q}] = [a]^{p}\,[b]^{q}`,
      description: 'Las dimensiones se multiplican, se dividen y se elevan a potencias igual que en álgebra. Los factores numéricos no tienen dimensión.',
      variables: [
        { symbol: String.raw`a,\,b`, meaning: 'Magnitudes físicas', unit: 'cualquiera' },
        { symbol: String.raw`p,\,q`, meaning: 'Exponentes', unit: '— (adimensional)' },
      ],
    },
    {
      name: 'Principio de homogeneidad',
      latex: String.raw`A = B + C \;\Rightarrow\; [A] = [B] = [C]`,
      description: 'En una ecuación física, cada término sumado o igualado debe tener la misma dimensión.',
      variables: [
        { symbol: String.raw`A,\,B,\,C`, meaning: 'Términos de la ecuación', unit: 'todos la misma' },
      ],
      notes: 'Es una condición necesaria pero no suficiente: no detecta errores en factores numéricos adimensionales.',
    },
  ],
  examples: [
    {
      title: 'Dimensiones y unidades de la densidad y la presión',
      statement: String.raw`La densidad se define como masa dividida entre volumen, $\rho = m/V$, y la presión como fuerza dividida entre área, $P = F/A$. Obtenga sus dimensiones y exprese sus unidades SI en función de kg, m y s.`,
      steps: [
        String.raw`Volumen: $[V] = \mathrm{L^3}$. Densidad: $[\rho] = \dfrac{[m]}{[V]} = \dfrac{\mathrm{M}}{\mathrm{L^3}} = \mathrm{M\,L^{-3}}$. Unidad SI: $\mathrm{kg/m^3}$.`,
        String.raw`Fuerza: $[F] = [m][a] = \mathrm{M}\cdot\mathrm{L\,T^{-2}} = \mathrm{M\,L\,T^{-2}}$.`,
        String.raw`Área: $[A] = \mathrm{L^2}$. Presión: $[P] = \dfrac{\mathrm{M\,L\,T^{-2}}}{\mathrm{L^2}} = \mathrm{M\,L^{-1}\,T^{-2}}$.`,
        String.raw`Unidad SI de la presión: $1\,\mathrm{Pa} = 1\,\mathrm{N/m^2} = 1\,\dfrac{\mathrm{kg\cdot m/s^2}}{\mathrm{m^2}} = 1\,\mathrm{kg/(m\cdot s^2)}$.`,
      ],
      result: String.raw`$[\rho] = \mathrm{M\,L^{-3}}$ (kg/m³) y $[P] = \mathrm{M\,L^{-1}\,T^{-2}}$ (Pa = kg/(m·s²)).`,
      interpretation: 'Las unidades con nombre propio (newton, pascal) son abreviaturas de combinaciones de kg, m y s. Saber «desarmarlas» permite comprobar dimensiones en cualquier fórmula.',
    },
    {
      title: 'Comprobar la homogeneidad de una ecuación',
      statement: String.raw`Compruebe que la ecuación $x = x_0 + v_0\,t + \tfrac12\,a\,t^2$ es dimensionalmente homogénea, donde $x$ y $x_0$ son posiciones, $v_0$ una velocidad, $a$ una aceleración y $t$ un tiempo.`,
      steps: [
        String.raw`Primer miembro y primer término: $[x] = [x_0] = \mathrm{L}$.`,
        String.raw`Segundo término: $[v_0\,t] = \mathrm{L\,T^{-1}}\cdot\mathrm{T} = \mathrm{L}$.`,
        String.raw`Tercer término: el factor $\tfrac12$ es adimensional, así que $[\tfrac12\,a\,t^2] = \mathrm{L\,T^{-2}}\cdot\mathrm{T^2} = \mathrm{L}$.`,
        String.raw`Todos los términos tienen dimensión $\mathrm{L}$.`,
      ],
      result: 'La ecuación es dimensionalmente homogénea.',
      interpretation: String.raw`El análisis no puede confirmar el factor $\tfrac12$: una ecuación con $2\,a\,t^2$ también pasaría la prueba. La homogeneidad descarta muchos errores, pero no todos.`,
    },
    {
      title: 'Forma del período de un péndulo',
      statement: String.raw`Se sospecha que el período $T$ de un péndulo simple (tiempo de una oscilación completa) depende solo de su longitud $\ell$ y de la aceleración de la gravedad $g$, en la forma $T = k\,\ell^{a}\,g^{b}$, con $k$ adimensional. Halle $a$ y $b$.`,
      steps: [
        String.raw`Dimensiones: $[T] = \mathrm{T}$, $[\ell] = \mathrm{L}$, $[g] = \mathrm{L\,T^{-2}}$, $[k] = 1$.`,
        String.raw`Sustituimos: $\mathrm{T} = \mathrm{L}^{a}\,(\mathrm{L\,T^{-2}})^{b} = \mathrm{L}^{a+b}\,\mathrm{T}^{-2b}$.`,
        String.raw`Igualamos exponentes. De $\mathrm{T}$: $1 = -2b \Rightarrow b = -\tfrac12$. De $\mathrm{L}$: $0 = a + b \Rightarrow a = \tfrac12$.`,
        String.raw`Por tanto $T = k\,\ell^{1/2}\,g^{-1/2} = k\sqrt{\ell/g}$.`,
      ],
      result: String.raw`$a = \tfrac12$ y $b = -\tfrac12$: $T = k\sqrt{\dfrac{\ell}{g}}$.`,
      interpretation: String.raw`La teoría completa da $k = 2\pi$ para oscilaciones pequeñas, pero ese número no sale del análisis dimensional. El resultado sí predice algo comprobable: si la longitud se multiplica por 4, el período se duplica.`,
    },
  ],
  simulation: null,
  exercises: [
    {
      id: 'b1-mag-01',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['mag-fundamentales-derivadas'],
      prompt: '¿Cuál de las siguientes es una magnitud **fundamental** del Sistema Internacional?',
      format: 'choice',
      options: ['Velocidad', 'Masa', 'Fuerza', 'Área'],
    },
    {
      id: 'b1-mag-02',
      category: 'conceptual',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['mag-fundamentales-derivadas'],
      prompt:
        'Complete con una palabra: una magnitud que se define a partir de otras mediante una ecuación (por ejemplo, la densidad como masa dividida entre volumen) se llama magnitud ________.',
      format: 'text',
    },
    {
      id: 'b1-mag-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['mag-analisis-dimensional'],
      prompt: String.raw`**Verdadero o falso:** la ecuación $x = v\,t^2$, donde $x$ es una distancia, $v$ una velocidad y $t$ un tiempo, es dimensionalmente homogénea. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b1-mag-04',
      category: 'error',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['mag-analisis-dimensional'],
      prompt: String.raw`Una estudiante quiere comprobar si la ecuación $F\,t = m\,v$ es dimensionalmente homogénea ($F$ es una fuerza, $t$ un tiempo, $m$ una masa y $v$ una velocidad). Su razonamiento es:

1. La fuerza es masa por aceleración: $[F] = \mathrm{M\,L\,T^{-2}}$.
2. Primer miembro: $[F\,t] = \mathrm{M\,L\,T^{-2}}\cdot\mathrm{T} = \mathrm{M\,L\,T^{-3}}$.
3. Segundo miembro: $[m\,v] = \mathrm{M}\cdot\mathrm{L\,T^{-1}} = \mathrm{M\,L\,T^{-1}}$.
4. Como los dos miembros tienen dimensiones distintas, la ecuación no es homogénea.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'No hay ningún error'],
    },
    {
      id: 'b1-mag-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['mag-analisis-dimensional'],
      prompt: String.raw`La rapidez $v$ de una onda en una cuerda tensa (como la de una guitarra) depende de la tensión $F$ de la cuerda, que es una fuerza, y de su masa por unidad de longitud $\mu$, que se mide en $\mathrm{kg/m}$. Suponga que $v = k\,F^{a}\,\mu^{b}$, con $k$ adimensional. Use el análisis dimensional para hallar el exponente $a$.`,
      format: 'numeric',
      unitHint: 'adimensional',
    },
    {
      id: 'b1-mag-06',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['mag-fundamentales-derivadas'],
      prompt: 'Marque **todas** las magnitudes que, en el SI, son **derivadas**.',
      format: 'choice',
      multiple: true,
      options: ['Velocidad', 'Tiempo', 'Densidad', 'Temperatura', 'Área'],
    },
    {
      id: 'b1-mag-07',
      category: 'seleccion',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['mag-analisis-dimensional', 'mag-fundamentales-derivadas'],
      prompt: String.raw`La presión se define como fuerza dividida entre área, $P = F/A$. ¿Cuáles son sus dimensiones?`,
      format: 'choice',
      options: [
        String.raw`$\mathrm{M\,L^{-1}\,T^{-2}}$`,
        String.raw`$\mathrm{M\,L\,T^{-2}}$`,
        String.raw`$\mathrm{M\,L^{2}\,T^{-2}}$`,
        String.raw`$\mathrm{M\,L^{-3}}$`,
      ],
    },
    {
      id: 'b1-mag-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['mag-analisis-dimensional', 'mag-magnitud-unidad'],
      prompt: String.raw`(a) Compruebe si cada una de estas ecuaciones es dimensionalmente homogénea ($v$, $v_0$: velocidades; $a$, $g$: aceleraciones; $x$, $h$: distancias; $t$: tiempo): (i) $v^2 = v_0^2 + 2\,a\,x$; (ii) $x = \tfrac12\,v\,t^2$; (iii) $t = \sqrt{2h/g}$.
(b) Un objeto se suelta desde una altura $h$. Suponga que su rapidez al llegar al suelo es $v = k\,g^{a}\,h^{b}\,m^{c}$, donde $m$ es su masa y $k$ es adimensional. Halle $a$, $b$ y $c$ por análisis dimensional.
(c) ¿Qué concluye sobre la influencia de la masa? ¿Puede el análisis dimensional decirle cuánto vale $k$? Explique cada paso.`,
      format: 'open',
    },
  ],
};
