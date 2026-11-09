import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'dilatacion-termica',
  title: 'Dilatación térmica',
  summary:
    'Casi todos los materiales se expanden al calentarse. El cambio de longitud, de área o de volumen es proporcional al tamaño inicial y al cambio de temperatura; el agua entre 0 °C y 4 °C es una excepción importante.',
  concepts: [
    { slug: 'dilatacion-termica-lineal', name: 'Dilatación lineal: ΔL = αL₀ΔT' },
    { slug: 'dilatacion-termica-superficial-volumetrica', name: 'Dilatación superficial y volumétrica' },
    { slug: 'dilatacion-termica-agua-anomala', name: 'Comportamiento anómalo del agua' },
    { slug: 'dilatacion-termica-aplicaciones', name: 'Juntas de dilatación y láminas bimetálicas' },
  ],
  theory: String.raw`## Por qué los cuerpos se dilatan

Las puertas de madera se atascan en la temporada de lluvias, los cables del tendido eléctrico cuelgan más en una tarde calurosa que en la madrugada, y los puentes tienen unas ranuras metálicas en forma de peine en sus extremos. Detrás de todos estos fenómenos (salvo el de la madera, que absorbe humedad) está la **dilatación térmica**: al aumentar la temperatura, la mayoría de los materiales aumentan de tamaño.

La explicación microscópica es sencilla. En un sólido, los átomos vibran alrededor de posiciones de equilibrio. Al subir la temperatura vibran con mayor amplitud y, por la forma de las fuerzas entre átomos, la distancia media entre ellos crece un poco. Ese pequeño aumento, repetido a lo largo de miles de millones de átomos, se nota a escala macroscópica.

## Dilatación lineal

Si una varilla de longitud $L_0$ sufre un cambio de temperatura $\Delta T$, el cambio de longitud es, con muy buena aproximación,

$$\Delta L = \alpha\,L_0\,\Delta T .$$

- $\Delta L$ es **proporcional a $L_0$**: una varilla el doble de larga se alarga el doble, porque cada tramo se alarga lo mismo.
- $\Delta L$ es **proporcional a $\Delta T$** (para cambios moderados de temperatura).
- $\alpha$ es el **coeficiente de dilatación lineal**, propio de cada material. Se mide en $\mathrm{K}^{-1}$ o $(^\circ\mathrm{C})^{-1}$, que son lo mismo porque se multiplica por una diferencia de temperatura.

Valores típicos: acero y hormigón $1.2\times10^{-5}\,\mathrm{K}^{-1}$; cobre $1.7\times10^{-5}\,\mathrm{K}^{-1}$; aluminio $2.4\times10^{-5}\,\mathrm{K}^{-1}$; vidrio común $9\times10^{-6}\,\mathrm{K}^{-1}$; vidrio Pyrex $3.2\times10^{-6}\,\mathrm{K}^{-1}$.

Son números pequeños: un riel de acero de $10\,\mathrm{m}$ que se calienta $30\,^\circ\mathrm{C}$ se alarga $3.6\,\mathrm{mm}$. Pero si el riel está fijo en sus extremos y no puede alargarse, aparecen fuerzas enormes que lo deforman.

> **Cuidado.** En la fórmula aparece $\Delta T = T_f - T_i$, no la temperatura final. Si $\Delta T < 0$ (enfriamiento), $\Delta L$ es negativo: el cuerpo se contrae.

## Dilatación superficial y volumétrica

Una placa se dilata en sus dos dimensiones y un bloque en sus tres. Para un material que se dilata igual en todas las direcciones (isótropo):

$$\Delta A = 2\alpha\,A_0\,\Delta T, \qquad \Delta V = \beta\,V_0\,\Delta T, \quad \text{con } \beta \approx 3\alpha \text{ en los sólidos.}$$

El factor 2 o 3 aparece porque cada lado crece en la proporción $\alpha\,\Delta T$, y el área o el volumen acumulan ese crecimiento en dos o tres direcciones.

Un hecho que sorprende: **un agujero en una placa se agranda al calentarla**, como si el agujero fuera del mismo material. Todas las distancias de la placa, incluido el diámetro del hueco, crecen en la misma proporción. Por eso una tapa metálica atascada en un frasco de vidrio se afloja al ponerla bajo el chorro de agua caliente: el metal tiene un $\alpha$ mayor que el vidrio y la tapa se agranda más que la boca del frasco.

Los líquidos solo tienen coeficiente volumétrico $\beta$, en general mayor que el de los sólidos: agua $2.1\times10^{-4}\,\mathrm{K}^{-1}$ (a $20\,^\circ\mathrm{C}$), gasolina $9.5\times10^{-4}\,\mathrm{K}^{-1}$. Un tanque de combustible lleno «hasta el tope» puede derramarse al calentarse al sol, porque la gasolina se dilata más que el tanque.

## El comportamiento anómalo del agua

El agua es una excepción notable. Entre $0\,^\circ\mathrm{C}$ y $4\,^\circ\mathrm{C}$ **se contrae al calentarse**, y su densidad es máxima a unos $4\,^\circ\mathrm{C}$. Además, al congelarse aumenta su volumen alrededor de un $9\,\%$, por lo que el hielo flota.

Las consecuencias son importantes. En invierno, en los lagos de países fríos, el agua de la superficie se enfría y, al llegar a $4\,^\circ\mathrm{C}$, se hunde por ser más densa. Cuando toda el agua alcanza esa temperatura, la superficie sigue enfriándose, pero ya no se hunde: se congela arriba y la capa de hielo aísla el agua de abajo, donde los peces sobreviven. Por la misma razón, una botella de vidrio llena de agua puede romperse en el congelador.

## Aplicaciones: juntas de dilatación y láminas bimetálicas

- **Juntas de dilatación.** Los puentes, las losas de hormigón de las aceras, las vías del tren y las tuberías largas se construyen con espacios o uniones flexibles que permiten la dilatación sin que aparezcan esfuerzos peligrosos. En el Caribe, donde la superficie de una losa expuesta al sol puede pasar de unos $25\,^\circ\mathrm{C}$ de madrugada a más de $55\,^\circ\mathrm{C}$ a mediodía, estas juntas son imprescindibles.
- **Láminas bimetálicas.** Dos láminas de metales con distinto $\alpha$ (por ejemplo, latón y acero) se sueldan una sobre otra. Al calentarse, la de mayor $\alpha$ se alarga más y la pareja se curva, quedando el metal de menor $\alpha$ en la parte interior (cóncava) de la curva. Así funcionan muchos termostatos de planchas y hornos.

## Límites del modelo

Las fórmulas son aproximaciones válidas cuando $\alpha\,\Delta T$ es mucho menor que 1, lo que se cumple en casi todas las situaciones cotidianas. Los coeficientes cambian algo con la temperatura, y algunos materiales, como la madera o ciertos cristales, se dilatan de forma distinta según la dirección.`,
  formulas: [
    {
      name: 'Dilatación lineal',
      latex: String.raw`\Delta L = \alpha\,L_0\,\Delta T`,
      description: 'Cambio de longitud de un cuerpo alargado al cambiar su temperatura.',
      variables: [
        { symbol: String.raw`\Delta L`, meaning: 'Cambio de longitud (negativo si se contrae)', unit: 'm' },
        { symbol: String.raw`\alpha`, meaning: 'Coeficiente de dilatación lineal', unit: '1/K = 1/°C' },
        { symbol: String.raw`L_0`, meaning: 'Longitud inicial', unit: 'm' },
        { symbol: String.raw`\Delta T`, meaning: 'Cambio de temperatura (T_f − T_i)', unit: 'K o °C' },
      ],
    },
    {
      name: 'Dilatación superficial',
      latex: String.raw`\Delta A = 2\alpha\,A_0\,\Delta T`,
      description: 'Cambio de área de una placa de material isótropo. Vale también para el área de un agujero en la placa.',
      variables: [
        { symbol: String.raw`\Delta A`, meaning: 'Cambio de área', unit: 'm²' },
        { symbol: String.raw`A_0`, meaning: 'Área inicial', unit: 'm²' },
      ],
    },
    {
      name: 'Dilatación volumétrica',
      latex: String.raw`\Delta V = \beta\,V_0\,\Delta T, \qquad \beta \approx 3\alpha \text{ (sólidos)}`,
      description: 'Cambio de volumen de un sólido o de un líquido. Los líquidos se describen solo con β.',
      variables: [
        { symbol: String.raw`\Delta V`, meaning: 'Cambio de volumen', unit: 'm³' },
        { symbol: String.raw`\beta`, meaning: 'Coeficiente de dilatación volumétrica', unit: '1/K' },
        { symbol: String.raw`V_0`, meaning: 'Volumen inicial', unit: 'm³' },
      ],
      notes: 'El agua entre 0 °C y 4 °C tiene β negativo: se contrae al calentarse.',
    },
  ],
  examples: [
    {
      title: 'Un riel de acero al sol',
      statement: String.raw`Un riel de acero ($\alpha = 1.2\times10^{-5}\,\mathrm{K}^{-1}$) mide $12\,\mathrm{m}$ a $20\,^\circ\mathrm{C}$. ¿Cuánto se alarga cuando el sol lo calienta hasta $45\,^\circ\mathrm{C}$?`,
      steps: [
        String.raw`Cambio de temperatura: $\Delta T = 45 - 20 = 25\,^\circ\mathrm{C} = 25\,\mathrm{K}$.`,
        String.raw`$\Delta L = \alpha\,L_0\,\Delta T = (1.2\times10^{-5}\,\mathrm{K}^{-1})(12\,\mathrm{m})(25\,\mathrm{K}) = 3.6\times10^{-3}\,\mathrm{m}$.`,
      ],
      result: String.raw`$\Delta L = 3.6\,\mathrm{mm}$.`,
      interpretation:
        'Parece poco, pero si los rieles se colocaran sin separación, ese alargamiento impedido produciría fuerzas capaces de torcer la vía. Por eso se dejan pequeños espacios o se usan uniones especiales.',
    },
    {
      title: 'Una tapa que se afloja',
      statement: String.raw`La tapa de aluminio ($\alpha = 2.4\times10^{-5}\,\mathrm{K}^{-1}$) de un frasco tiene un diámetro interior de $8.000\,\mathrm{cm}$ a $25\,^\circ\mathrm{C}$. ¿Cuánto aumenta su diámetro si se calienta hasta $85\,^\circ\mathrm{C}$ con agua caliente?`,
      steps: [
        String.raw`El diámetro de un hueco se dilata como cualquier longitud del material: $\Delta D = \alpha\,D_0\,\Delta T$.`,
        String.raw`$\Delta T = 85 - 25 = 60\,\mathrm{K}$.`,
        String.raw`$\Delta D = (2.4\times10^{-5})(8.000\,\mathrm{cm})(60) = 0.0115\,\mathrm{cm} = 0.115\,\mathrm{mm}$.`,
      ],
      result: String.raw`El diámetro pasa a $8.012\,\mathrm{cm}$: aumenta unos $0.12\,\mathrm{mm}$.`,
      interpretation:
        'La boca de vidrio también se calienta, pero su coeficiente es casi tres veces menor; la diferencia, de décimas de milímetro, basta para que la tapa ceda.',
    },
    {
      title: 'Gasolina que se derrama',
      statement: String.raw`Un tanque de acero ($\alpha = 1.2\times10^{-5}\,\mathrm{K}^{-1}$) se llena por completo con $60.0\,\mathrm{L}$ de gasolina ($\beta = 9.5\times10^{-4}\,\mathrm{K}^{-1}$) a $20\,^\circ\mathrm{C}$. El vehículo queda al sol y ambos llegan a $35\,^\circ\mathrm{C}$. ¿Cuánta gasolina se derrama?`,
      steps: [
        String.raw`$\Delta T = 15\,\mathrm{K}$. Dilatación de la gasolina: $\Delta V_g = (9.5\times10^{-4})(60.0\,\mathrm{L})(15) = 0.855\,\mathrm{L}$.`,
        String.raw`El volumen interior del tanque se dilata como si fuera de acero macizo, con $\beta = 3\alpha = 3.6\times10^{-5}\,\mathrm{K}^{-1}$: $\Delta V_t = (3.6\times10^{-5})(60.0\,\mathrm{L})(15) = 0.0324\,\mathrm{L}$.`,
        String.raw`Derrame: $\Delta V_g - \Delta V_t = 0.855 - 0.032 = 0.823\,\mathrm{L}$.`,
      ],
      result: String.raw`Se derraman unos $0.82\,\mathrm{L}$ de gasolina.`,
      interpretation:
        'El líquido se dilata unas 25 veces más que el recipiente. Por eso no conviene llenar un tanque hasta el borde y dejarlo al sol.',
    },
  ],
  simulation: null,
  exercises: [
    {
      id: 'b6-dil-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['dilatacion-termica-lineal'],
      prompt: String.raw`Un tramo de puente de acero ($\alpha = 1.2\times10^{-5}\,\mathrm{K}^{-1}$) mide $250\,\mathrm{m}$ en una madrugada a $15\,^\circ\mathrm{C}$. ¿Cuánto se alarga cuando su temperatura llega a $40\,^\circ\mathrm{C}$ a mediodía?`,
      format: 'numeric',
      unitHint: 'm',
    },
    {
      id: 'b6-dil-02',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['dilatacion-termica-aplicaciones'],
      prompt: String.raw`Una lámina bimetálica recta está formada por una tira de latón ($\alpha = 1.9\times10^{-5}\,\mathrm{K}^{-1}$) soldada a una tira de acero ($\alpha = 1.2\times10^{-5}\,\mathrm{K}^{-1}$). ¿Qué ocurre al calentarla?`,
      format: 'choice',
      options: [
        'Sigue recta, porque ambas tiras se calientan lo mismo.',
        'Se curva y el latón queda en la parte interior (cóncava) de la curva.',
        'Se curva y el acero queda en la parte interior (cóncava) de la curva.',
        'Se acorta, porque los dos metales se oponen entre sí.',
      ],
    },
    {
      id: 'b6-dil-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['dilatacion-termica-superficial-volumetrica'],
      prompt: String.raw`**Verdadero o falso:** al calentar una placa metálica con un agujero circular en el centro, el agujero se hace más pequeño porque el metal se expande hacia dentro. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b6-dil-04',
      category: 'error',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['dilatacion-termica-superficial-volumetrica'],
      prompt: String.raw`Un estudiante calculó así cuánto aumenta el volumen de un cubo de aluminio ($\alpha = 2.4\times10^{-5}\,\mathrm{K}^{-1}$) de $1000\,\mathrm{cm^3}$ al calentarlo de $20\,^\circ\mathrm{C}$ a $70\,^\circ\mathrm{C}$:

1. Datos: $V_0 = 1000\,\mathrm{cm^3}$, $\Delta T = 70 - 20 = 50\,\mathrm{K}$.
2. Ecuación: $\Delta V = \beta\,V_0\,\Delta T$.
3. Coeficiente: $\beta = \alpha = 2.4\times10^{-5}\,\mathrm{K}^{-1}$.
4. Resultado: $\Delta V = (2.4\times10^{-5})(1000)(50) = 1.2\,\mathrm{cm^3}$.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'No hay ningún error'],
    },
    {
      id: 'b6-dil-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['dilatacion-termica-lineal', 'dilatacion-termica-aplicaciones'],
      prompt: String.raw`En un taller se quiere montar un anillo de acero ($\alpha = 1.2\times10^{-5}\,\mathrm{K}^{-1}$) sobre un eje. A $20\,^\circ\mathrm{C}$ el diámetro interior del anillo es $5.000\,\mathrm{cm}$ y el del eje, $5.006\,\mathrm{cm}$. ¿Hasta qué temperatura hay que calentar el anillo (sin calentar el eje) para que su diámetro interior iguale al del eje?`,
      format: 'numeric',
      unitHint: '°C',
    },
    {
      id: 'b6-dil-06',
      category: 'conceptual',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['dilatacion-termica-agua-anomala'],
      prompt: String.raw`En los países de inviernos fríos, los lagos se congelan de arriba hacia abajo y los peces sobreviven en el agua líquida del fondo. ¿Qué propiedad del agua lo explica?`,
      format: 'choice',
      options: [
        'El agua se dilata siempre al calentarse, como todos los líquidos.',
        'El fondo del lago recibe calor del Sol a través del agua.',
        'La densidad del agua es máxima cerca de 4 °C y el hielo es menos denso que el agua líquida.',
        'El agua del fondo está a mayor presión y por eso nunca puede congelarse.',
      ],
    },
    {
      id: 'b6-dil-07',
      category: 'numerica',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['dilatacion-termica-lineal'],
      prompt: String.raw`Un cable de cobre ($\alpha = 1.7\times10^{-5}\,\mathrm{K}^{-1}$) tendido entre dos postes mide $40\,\mathrm{m}$ a $32\,^\circ\mathrm{C}$ por la tarde. ¿Cuánto se acorta cuando, de madrugada, su temperatura baja a $22\,^\circ\mathrm{C}$? Dé la magnitud del acortamiento.`,
      format: 'numeric',
      unitHint: 'mm',
    },
    {
      id: 'b6-dil-08',
      category: 'desarrollo',
      difficulty: 'intermedio',
      role: 'bank',
      concepts: ['dilatacion-termica-lineal', 'dilatacion-termica-aplicaciones'],
      prompt: String.raw`Una acera se construye con losas de hormigón ($\alpha = 1.2\times10^{-5}\,\mathrm{K}^{-1}$) de $15\,\mathrm{m}$ de largo. En un año, la temperatura de las losas varía entre $18\,^\circ\mathrm{C}$ y $60\,^\circ\mathrm{C}$. (a) Calcule el máximo cambio de longitud de una losa. (b) Explique qué ocurriría si las losas se colocaran sin separación entre ellas. (c) Proponga un ancho mínimo razonable para la junta si las losas se colocan a la temperatura mínima, y explique por qué los rieles del tren y los puentes necesitan soluciones parecidas.`,
      format: 'open',
    },
  ],
};
