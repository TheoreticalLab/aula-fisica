import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'conservacion-energia',
  title: 'Conservación de la energía mecánica',
  summary:
    'Si solo las fuerzas conservativas realizan trabajo, la energía mecánica K + U se conserva. Con fricción, la energía mecánica disminuye y aparece en igual cantidad como energía térmica: la energía total se conserva siempre.',
  concepts: [
    { slug: 'conservacion-energia-mecanica', name: 'Conservación de la energía mecánica: K + U = constante' },
    { slug: 'conservacion-energia-friccion', name: 'Fricción y energía térmica' },
    { slug: 'conservacion-energia-fuerzas', name: 'Fuerzas conservativas y no conservativas' },
  ],
  theory: String.raw`## Un intercambio entre K y U

Suelte una pelota desde la azotea: a medida que cae pierde altura y gana rapidez. La energía potencial gravitatoria se transforma en energía cinética. Lance la pelota hacia arriba y ocurre lo contrario. En un columpio, en una montaña rusa o en un clavadista que salta desde las rocas, la energía pasa de una forma a otra continuamente.

Definimos la **energía mecánica** como la suma de la energía cinética y las energías potenciales:

$$E = K + U = \tfrac12 m v^2 + m g y \;\big(+\, \tfrac12 k x^2 \text{ si hay resortes}\big).$$

## La ley de conservación

Combinemos dos resultados de las lecciones anteriores. El teorema trabajo–energía dice $W_{neto} = \Delta K$. Si **solo** realizan trabajo fuerzas conservativas (peso, resortes), su trabajo es $W_{cons} = -\Delta U$. Entonces $\Delta K = -\Delta U$, es decir, $\Delta K + \Delta U = 0$:

$$K_i + U_i = K_f + U_f .$$

**Si solo las fuerzas conservativas realizan trabajo, la energía mecánica se conserva.**

Importa la palabra *realizan*. Puede haber otras fuerzas, siempre que **no hagan trabajo**: la normal de una pista sin fricción es perpendicular al movimiento, y la tensión de la cuerda de un péndulo también. Ninguna de las dos estropea la conservación.

## La gran ventaja: no importa el camino

La ley relaciona solo los estados inicial y final. Un bloque que se suelta desde una altura $h$ por una rampa sin fricción llega abajo con

$$v = \sqrt{2 g h},$$

sea la rampa recta, curva, empinada o suave. La forma de la rampa cambia el **tiempo** que tarda, pero no la **rapidez** final. Tampoco importa la masa: se cancela en ambos miembros. Resolver esto con las leyes de Newton en una pista curva sería muy difícil, porque la aceleración cambia en cada punto.

Otra consecuencia: un bloque que baja una rampa sin fricción y sube por otra llega **a la misma altura** de la que partió, cualquiera que sea la inclinación de la segunda rampa.

Un columpio en el parque ilustra bien la idea. En el punto más alto de cada vaivén el niño se detiene un instante: toda la energía es potencial. Al pasar por el punto más bajo la rapidez es máxima: toda la energía es cinética (si se toma el cero allí). La cadena tira del asiento, pero siempre perpendicularmente a su movimiento, así que no realiza trabajo y no altera el balance. Si nadie empuja y el rozamiento fuera nulo, el columpio volvería siempre a la misma altura.

## Con fricción: aparece la energía térmica

En la realidad, la fricción y la resistencia del aire están casi siempre presentes. La fricción cinética realiza trabajo negativo, $W_f = -f_k\,d$, y no tiene energía potencial asociada. El balance se escribe

$$K_i + U_i + W_{nc} = K_f + U_f ,$$

donde $W_{nc}$ es el trabajo de las fuerzas no conservativas. Con fricción $W_{nc} < 0$ y la energía mecánica **disminuye**.

¿Desaparece esa energía? No. Las superficies se calientan: frote las manos o observe cómo se calientan los frenos de una guagua después de bajar una loma. La energía mecánica perdida aparece como **energía térmica** (energía interna de los cuerpos y su entorno):

$$\Delta E_{térmica} = f_k\,d = -W_f .$$

Con todas las formas de energía incluidas, la **energía total se conserva siempre**. Es uno de los principios más sólidos de la física: la energía no se crea ni se destruye, solo se transforma o se transfiere.

## Cómo aplicar la conservación

1. Elija el sistema y los estados inicial y final.
2. Elija el nivel cero de energía potencial (y no lo cambie).
3. Escriba $K$ y $U$ en cada estado.
4. Pregúntese si hay fuerzas no conservativas que hagan trabajo. Si las hay, incluya $W_{nc}$ o la energía térmica.
5. Despeje la incógnita y compruebe que el resultado sea razonable.

## Errores frecuentes

> **Error frecuente.** Aplicar $K_i + U_i = K_f + U_f$ cuando hay fricción apreciable. Primero hay que preguntarse quién realiza trabajo.

> **Error frecuente.** Olvidar la energía cinética inicial cuando el cuerpo no parte del reposo.

> **Error frecuente.** Decir que la fricción «destruye» energía. La energía mecánica disminuye, pero la total se conserva.

## Límites del modelo

- Tratamos los cuerpos como partículas que deslizan. Una pelota que **rueda** reparte su energía cinética entre traslación y rotación y llega abajo más lentamente que un bloque sin fricción.
- La resistencia del aire depende de la rapidez; en caídas cortas de objetos compactos es despreciable, pero no para una hoja de papel ni para un paracaidista.
- En la pista del simulador, las esquinas son ideales y no disipan energía; en una pista real, cada cambio brusco de dirección produce pérdidas.`,
  formulas: [
    {
      name: 'Energía mecánica',
      latex: String.raw`E = K + U = \tfrac12 m v^2 + m g y`,
      description: 'Suma de la energía cinética y las energías potenciales (añada ½kx² si hay resortes).',
      variables: [
        { symbol: String.raw`E`, meaning: 'Energía mecánica', unit: 'J' },
        { symbol: String.raw`K`, meaning: 'Energía cinética', unit: 'J' },
        { symbol: String.raw`U`, meaning: 'Energía potencial', unit: 'J' },
        { symbol: String.raw`y`, meaning: 'Altura sobre el nivel cero', unit: 'm' },
      ],
    },
    {
      name: 'Conservación de la energía mecánica',
      latex: String.raw`K_i + U_i = K_f + U_f`,
      description: 'Válida cuando solo las fuerzas conservativas realizan trabajo.',
      variables: [
        { symbol: String.raw`K_i,\,K_f`, meaning: 'Energía cinética inicial y final', unit: 'J' },
        { symbol: String.raw`U_i,\,U_f`, meaning: 'Energía potencial inicial y final', unit: 'J' },
      ],
    },
    {
      name: 'Balance con fuerzas no conservativas',
      latex: String.raw`K_i + U_i + W_{nc} = K_f + U_f`,
      description: 'El trabajo de las fuerzas no conservativas cambia la energía mecánica.',
      variables: [
        { symbol: String.raw`W_{nc}`, meaning: 'Trabajo de las fuerzas no conservativas (fricción, empujes…)', unit: 'J' },
      ],
      notes: 'Con fricción, W_nc = −f_k·d < 0 y la energía térmica aumenta en f_k·d.',
    },
    {
      name: 'Rapidez tras descender una altura h',
      latex: String.raw`v = \sqrt{v_0^2 + 2 g h}`,
      description: 'Rapidez de un cuerpo que desciende un desnivel h sin fricción, por cualquier camino.',
      variables: [
        { symbol: String.raw`v_0`, meaning: 'Rapidez inicial', unit: 'm/s' },
        { symbol: String.raw`h`, meaning: 'Desnivel descendido', unit: 'm' },
      ],
    },
  ],
  examples: [
    {
      title: 'Montaña rusa',
      statement: String.raw`Un carrito de montaña rusa pasa por la cima de una loma de $25\,\mathrm{m}$ de altura con rapidez $4.0\,\mathrm{m/s}$. Despreciando la fricción, ¿con qué rapidez pasa por un valle situado a $5.0\,\mathrm{m}$ de altura?`,
      steps: [
        String.raw`Nivel cero en el suelo. Solo el peso realiza trabajo (la normal es perpendicular a la vía), así que se conserva la energía mecánica.`,
        String.raw`Dividiendo por $m$: $\tfrac12 v_i^2 + g y_i = \tfrac12 v_f^2 + g y_f$.`,
        String.raw`$v_f^2 = v_i^2 + 2g(y_i - y_f) = (4.0)^2 + 2(9.8)(20) = 16 + 392 = 408\,\mathrm{m^2/s^2}$.`,
        String.raw`$v_f = \sqrt{408} = 20.2\,\mathrm{m/s}$.`,
      ],
      result: String.raw`$v_f \approx 20\,\mathrm{m/s}$ (unos $73\,\mathrm{km/h}$).`,
      interpretation: 'El resultado no depende de la masa del carrito ni de la forma de la vía entre la cima y el valle; solo del desnivel de 20 m.',
    },
    {
      title: 'Tobogán con fricción',
      statement: String.raw`Un niño de $30\,\mathrm{kg}$ se suelta desde lo alto de un tobogán de $2.5\,\mathrm{m}$ de altura y llega abajo a $5.0\,\mathrm{m/s}$. ¿Cuánta energía mecánica se transformó en energía térmica?`,
      steps: [
        String.raw`Nivel cero abajo. Energía inicial: $E_i = m g h = (30)(9.8)(2.5) = 735\,\mathrm{J}$.`,
        String.raw`Energía final: $E_f = \tfrac12 m v^2 = \tfrac12 (30)(5.0)^2 = 375\,\mathrm{J}$.`,
        String.raw`Energía térmica: $\Delta E_{térmica} = E_i - E_f = 735 - 375 = 360\,\mathrm{J}$.`,
      ],
      result: String.raw`Se transformaron $360\,\mathrm{J}$ en energía térmica.`,
      interpretation: 'Sin fricción habría llegado a √(2gh) = 7.0 m/s. Casi la mitad de la energía mecánica calentó el tobogán y la ropa del niño.',
    },
    {
      title: 'Resorte que lanza un bloque',
      statement: String.raw`Un resorte de $k = 500\,\mathrm{N/m}$, comprimido $0.10\,\mathrm{m}$, lanza un bloque de $0.20\,\mathrm{kg}$ sobre una superficie horizontal sin fricción. ¿Con qué rapidez sale el bloque?`,
      steps: [
        String.raw`No hay cambio de altura ni fricción: la energía elástica se convierte en cinética. $\tfrac12 k x^2 = \tfrac12 m v^2$.`,
        String.raw`$\tfrac12 (500)(0.10)^2 = 2.5\,\mathrm{J}$.`,
        String.raw`$v = \sqrt{2(2.5\,\mathrm{J})/0.20\,\mathrm{kg}} = \sqrt{25}\,\mathrm{m/s} = 5.0\,\mathrm{m/s}$.`,
      ],
      result: String.raw`$v = 5.0\,\mathrm{m/s}$.`,
      interpretation: 'Equivalente: v = x·√(k/m). Un resorte más duro o más comprimido, o un bloque más ligero, dan mayor rapidez de salida.',
    },
  ],
  simulation: {
    key: 'conservacion-energia',
    params: { m: 1, h0: 5, v0: 0, theta1: 40, theta2: 30, L: 4, muK: 0, g: 9.8 },
    guide: String.raw`1. Con $\mu_k = 0$, pulse **Iniciar** y observe las barras. ¿Qué barras cambian y cuál permanece constante?
2. Lea la «Altura máx. en la rampa derecha». Cambie la inclinación de la rampa derecha. ¿Cambia la altura que alcanza? ¿Y el tiempo que tarda en llegar?
3. Lea la rapidez en el tramo horizontal y compárela con $\sqrt{2 g h_0}$. Cambie la masa: ¿cambia la rapidez?
4. Ponga $\mu_k = 0.1$. Observe la barra de energía térmica. Compruebe que la suma de la mecánica y la térmica se mantiene constante.
5. Con fricción, ¿en qué tramos crece la energía térmica? ¿Por qué crece más rápido en el tramo horizontal que en una rampa empinada, para la misma distancia recorrida?`,
  },
  exercises: [
    {
      id: 'b4-cons-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['conservacion-energia-mecanica'],
      prompt: String.raw`En un parque acuático, una persona se suelta desde el reposo en lo alto de un tobogán de $4.5\,\mathrm{m}$ de altura. Si el agua hace despreciable la fricción, ¿con qué rapidez llega al final del tobogán?`,
      format: 'numeric',
      unitHint: 'm/s',
    },
    {
      id: 'b4-cons-02',
      category: 'conceptual',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['conservacion-energia-mecanica'],
      prompt: String.raw`Desde la azotea de un edificio se lanzan dos pelotas iguales con la **misma rapidez**: la A verticalmente hacia arriba y la B horizontalmente. Despreciando la resistencia del aire, ¿cuál llega al suelo con mayor rapidez?`,
      format: 'choice',
      options: [
        'La A, porque sube más y cae desde mayor altura.',
        'La B, porque nunca pierde su velocidad horizontal.',
        'Llegan con la misma rapidez.',
        'Depende de la masa de las pelotas.',
      ],
    },
    {
      id: 'b4-cons-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['conservacion-energia-friccion'],
      prompt: String.raw`**Verdadero o falso:** cuando un bloque se desliza con fricción hasta detenerse, su energía se destruye, y por eso la conservación de la energía no se aplica a situaciones con fricción. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b4-cons-04',
      category: 'experimento',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['conservacion-energia-mecanica'],
      prompt: String.raw`En el simulador, fije $m = 2\,\mathrm{kg}$, $h_0 = 3\,\mathrm{m}$, $v_0 = 4\,\mathrm{m/s}$, $\theta_1 = 40^\circ$, $\theta_2 = 30^\circ$, $L = 4\,\mathrm{m}$, $\mu_k = 0$ y $g = 9.8\,\mathrm{m/s^2}$. Prediga con la conservación de la energía **la altura máxima que alcanza el bloque en la rampa derecha**. Después ejecute la simulación y compare con la lectura correspondiente.`,
      format: 'numeric',
      unitHint: 'm',
      simulation: { key: 'conservacion-energia', params: { m: 2, h0: 3, v0: 4, theta1: 40, theta2: 30, L: 4, muK: 0, g: 9.8 } },
    },
    {
      id: 'b4-cons-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['conservacion-energia-friccion', 'conservacion-energia-mecanica'],
      prompt: String.raw`Un bloque se suelta desde el reposo a $2.0\,\mathrm{m}$ de altura en una rampa sin fricción. Al llegar abajo recorre un tramo horizontal de $3.0\,\mathrm{m}$ con coeficiente de fricción cinética $0.20$, y luego sube por una segunda rampa sin fricción. ¿Hasta qué altura sube por la segunda rampa?`,
      format: 'numeric',
      unitHint: 'm',
    },
    {
      id: 'b4-cons-06',
      category: 'numerica',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['conservacion-energia-friccion'],
      prompt: String.raw`Una niña de $25\,\mathrm{kg}$ se suelta desde el reposo en lo alto de una chorrera de $3.0\,\mathrm{m}$ de altura en un parque y llega abajo con una rapidez de $5.0\,\mathrm{m/s}$. ¿Cuánta energía se transformó en energía térmica durante el descenso?`,
      format: 'numeric',
      unitHint: 'J',
    },
    {
      id: 'b4-cons-07',
      category: 'error',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['conservacion-energia-mecanica'],
      prompt: String.raw`Un estudiante resolvió así este problema: *«Un carrito de montaña rusa pasa por un punto a $20\,\mathrm{m}$ de altura con rapidez $5.0\,\mathrm{m/s}$. Sin fricción, ¿qué rapidez tiene a $8.0\,\mathrm{m}$ de altura?»*

1. Se conserva la energía mecánica: $\tfrac12 m v_i^2 + m g y_i = \tfrac12 m v_f^2 + m g y_f$.
2. Se cancela la masa y se despeja: $v_f^2 = v_i^2 + 2g(y_i - y_f)$.
3. Sustitución: $v_f^2 = 5.0 + 2(9.8)(12) = 240.2\,\mathrm{m^2/s^2}$.
4. Resultado: $v_f = \sqrt{240.2} = 15.5\,\mathrm{m/s}$.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'No hay ningún error'],
    },
    {
      id: 'b4-cons-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['conservacion-energia-mecanica', 'conservacion-energia-friccion', 'conservacion-energia-fuerzas'],
      prompt: String.raw`Un bloque de $2.0\,\mathrm{kg}$ comprime $0.20\,\mathrm{m}$ un resorte de constante $k = 800\,\mathrm{N/m}$ sobre una superficie horizontal. Al soltarlo, el resorte lo lanza (sin fricción mientras está en contacto con el resorte) y el bloque recorre luego un piso horizontal con $\mu_k = 0.25$ hasta llegar al pie de una rampa sin fricción, situada a $2.0\,\mathrm{m}$ del resorte.

(a) Calcule la rapidez con que el bloque abandona el resorte.
(b) Calcule su rapidez al llegar al pie de la rampa.
(c) Calcule la altura máxima que alcanza en la rampa.
(d) Haga un balance de todas las formas de energía (elástica, cinética, potencial y térmica) en los estados inicial y final, y compruebe que la energía total se conserva.`,
      format: 'open',
    },
  ],
};
