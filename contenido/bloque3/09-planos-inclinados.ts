import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'planos-inclinados',
  title: 'Planos inclinados',
  summary:
    'Sobre una rampa conviene usar ejes paralelo y perpendicular a la superficie. El peso se descompone en mg sen θ, a lo largo del plano, y mg cos θ, contra él. Con eso se analizan rampas con y sin fricción, el ángulo crítico y el empuje cuesta arriba.',
  concepts: [
    { slug: 'planos-inclinados-descomposicion', name: 'Descomposición del peso en un plano inclinado' },
    { slug: 'planos-inclinados-friccion', name: 'Plano inclinado con fricción' },
    { slug: 'planos-inclinados-angulo-critico', name: 'Ángulo crítico: tan θ = μs' },
  ],
  theory: String.raw`## Rampas por todas partes

Las rampas de acceso para sillas de ruedas, las calles empinadas de una ciudad con lomas, el tobogán de un parque acuático o la rampa por la que se sube una nevera a un camión son **planos inclinados**: superficies planas que forman un ángulo $\theta$ con la horizontal. Para estudiarlos no hace falta ninguna física nueva: solo la segunda ley, el peso, la normal y la fricción. Lo nuevo es **elegir bien los ejes**.

## Elección de ejes

Un bloque que se mueve sobre una rampa lo hace **a lo largo de ella**: su aceleración es paralela a la superficie. Por eso tomamos:

- el eje $x$ **paralelo** al plano (por ejemplo, positivo hacia arriba de la pendiente);
- el eje $y$ **perpendicular** al plano, positivo hacia afuera de la superficie.

Con estos ejes, $a_y = 0$ siempre que el bloque no se despegue, y toda la aceleración queda en el eje $x$. La normal apunta en $+y$ y la fricción está sobre el eje $x$, de modo que **la única fuerza que hay que descomponer es el peso**. Con ejes horizontal y vertical habría que descomponer la normal, la fricción y la aceleración: el problema se complica sin necesidad.

## Descomposición del peso

El peso es vertical y forma un ángulo $\theta$ con el eje $y$ (la perpendicular al plano). Para verlo, observe que si se inclina el plano un ángulo $\theta$, su perpendicular también gira $\theta$ respecto a la vertical. Las componentes son:

$$W_\parallel = mg\sin\theta \quad(\text{a lo largo del plano, pendiente abajo}),$$
$$W_\perp = mg\cos\theta \quad(\text{perpendicular al plano, hacia la superficie}).$$

**Compruebe siempre los casos extremos.** Si $\theta = 0$ (piso horizontal), $\sin0^\circ = 0$ y $\cos0^\circ = 1$: nada empuja el bloque a lo largo del piso y todo el peso presiona contra él. Si $\theta = 90^\circ$ (pared vertical), todo el peso es paralelo a la superficie: el bloque cae libremente. Si su descomposición no cumple estos dos casos, ha intercambiado seno y coseno.

> **Error frecuente.** Escribir $mg\cos\theta$ para la componente paralela, por costumbre de «el coseno va con $x$». Esa regla vale para ángulos medidos desde el eje $x$, pero aquí $\theta$ se mide desde el eje $y$.

## La normal en el plano

En el eje perpendicular no hay aceleración. Si las únicas fuerzas con componente perpendicular son el peso y la normal,

$$N - mg\cos\theta = 0 \quad\Rightarrow\quad N = mg\cos\theta .$$

La normal es **menor** que el peso y disminuye al aumentar la inclinación. Si además se empuja el bloque contra el plano, o se tira de él hacia afuera, la normal cambia; siempre se obtiene de la segunda ley en el eje $y$.

## Plano sin fricción

Si no hay fricción, la única fuerza a lo largo del plano es $mg\sin\theta$, pendiente abajo. La segunda ley da $mg\sin\theta = m\,a$:

$$a = g\sin\theta \quad(\text{pendiente abajo}).$$

**La aceleración no depende de la masa**: una canica y una bola de bolos bajan igual por una rampa lisa, por la misma razón que caen igual en caída libre. Galileo usó planos poco inclinados precisamente para «diluir» la gravedad y poder medir la caída con los relojes de su época. Si el bloque se lanza hacia arriba, la aceleración sigue siendo $g\sin\theta$ pendiente abajo: el bloque frena, se detiene y vuelve.

## Plano con fricción

**¿Se queda quieto?** La fricción estática debe equilibrar $mg\sin\theta$, lo que es posible si $mg\sin\theta \le \mu_s N = \mu_s\,mg\cos\theta$. Dividiendo entre $mg\cos\theta$:

$$\tan\theta \le \mu_s .$$

El ángulo al que el bloque está **a punto de deslizar** es el **ángulo crítico**:

$$\tan\theta_c = \mu_s .$$

No depende de la masa ni de $g$. Es la base de un método sencillo para medir $\mu_s$: se inclina una tabla poco a poco hasta que el objeto empieza a deslizar y se mide el ángulo. Mientras el bloque esté en reposo, la fricción estática vale $mg\sin\theta$, **no** $\mu_s mg\cos\theta$.

**Si desliza hacia abajo**, la fricción cinética apunta pendiente arriba (opuesta a la velocidad) y, con el eje $x$ pendiente abajo,

$$a = g\,(\sin\theta - \mu_k\cos\theta).$$

Si $\tan\theta = \mu_k$, el bloque, una vez en movimiento, baja con **velocidad constante**. Como normalmente $\mu_k < \mu_s$, hay un intervalo de ángulos en que el bloque quieto no arranca solo, pero si se le da un empujón sigue bajando.

## Subir un bloque con una fuerza paralela al plano

Ahora empujamos el bloque con una fuerza $F$ paralela al plano, pendiente arriba. El sentido de la fricción **depende de hacia dónde tendería a deslizar** el bloque:

- Si $F$ es pequeña, el bloque tiende a bajar y la fricción estática apunta **hacia arriba**. Queda en reposo si $F \ge mg\sin\theta - \mu_s N$.
- Si $F$ es grande, el bloque tiende a subir y la fricción apunta **hacia abajo**. Arranca hacia arriba si $F > mg\sin\theta + \mu_s N$.
- Entre esos dos valores, el bloque permanece en reposo y la fricción estática se ajusta (incluso puede valer cero, si $F = mg\sin\theta$).

Una vez que sube, la aceleración pendiente arriba es

$$a = \frac{F - mg\sin\theta - \mu_k\,mg\cos\theta}{m}.$$

> **Cuidado.** La fricción no «va siempre pendiente arriba». Se opone al deslizamiento (o a la tendencia a deslizar), y esa tendencia depende de las demás fuerzas.

## Límites del modelo

Suponemos una rampa perfectamente plana, un bloque que no vuelca ni rueda, y coeficientes de fricción constantes. Un objeto que **rueda** (una pelota, un carrito con ruedas) baja de manera distinta, porque parte de su energía se invierte en girar; eso se estudia más adelante.`,
  formulas: [
    {
      name: 'Componentes del peso en un plano inclinado',
      latex: String.raw`W_\parallel = mg\sin\theta, \qquad W_\perp = mg\cos\theta`,
      description:
        'Con ejes paralelo y perpendicular al plano. La componente paralela apunta pendiente abajo; la perpendicular, hacia la superficie.',
      variables: [
        { symbol: String.raw`W_\parallel`, meaning: 'Componente del peso paralela al plano', unit: 'N' },
        { symbol: String.raw`W_\perp`, meaning: 'Componente del peso perpendicular al plano', unit: 'N' },
        { symbol: String.raw`\theta`, meaning: 'Inclinación del plano respecto a la horizontal', unit: '°' },
      ],
      notes: 'Compruebe con θ = 0 (todo perpendicular) y θ = 90° (todo paralelo).',
    },
    {
      name: 'Plano sin fricción',
      latex: String.raw`a = g\sin\theta, \qquad N = mg\cos\theta`,
      description: 'Bloque sobre un plano liso, sin otras fuerzas: acelera pendiente abajo, sea cual sea su masa.',
      variables: [{ symbol: String.raw`a`, meaning: 'Aceleración pendiente abajo', unit: 'm/s²' }],
    },
    {
      name: 'Bloque que desliza hacia abajo con fricción',
      latex: String.raw`a = g\,(\sin\theta - \mu_k\cos\theta)`,
      description: 'Aceleración pendiente abajo de un bloque que ya desliza hacia abajo.',
      variables: [{ symbol: String.raw`\mu_k`, meaning: 'Coeficiente de fricción cinética', unit: '— (adimensional)' }],
      notes: 'Si sale negativa, el bloque que baja va frenando (y se detendrá).',
    },
    {
      name: 'Ángulo crítico',
      latex: String.raw`\tan\theta_c = \mu_s`,
      description: 'Inclinación máxima a la que un bloque puede permanecer en reposo sin otras fuerzas que el peso, la normal y la fricción.',
      variables: [
        { symbol: String.raw`\theta_c`, meaning: 'Ángulo crítico', unit: '°' },
        { symbol: String.raw`\mu_s`, meaning: 'Coeficiente de fricción estática', unit: '— (adimensional)' },
      ],
      notes: 'No depende de la masa ni de g.',
    },
    {
      name: 'Bloque empujado pendiente arriba (fuerza paralela)',
      latex: String.raw`a = \frac{F - mg\sin\theta - \mu_k\,mg\cos\theta}{m}`,
      description:
        'Aceleración pendiente arriba de un bloque que sube. Para que arranque desde el reposo hace falta F > mg sen θ + μs·mg cos θ.',
      variables: [{ symbol: String.raw`F`, meaning: 'Fuerza aplicada, paralela al plano y pendiente arriba', unit: 'N' }],
    },
  ],
  examples: [
    {
      title: 'Caja en una rampa lisa',
      statement: String.raw`Una caja de $15\,\mathrm{kg}$ se suelta desde el reposo en una rampa de $20^\circ$ recubierta de un plástico muy liso, de modo que la fricción es despreciable. Halle la normal y la aceleración.`,
      steps: [
        String.raw`Ejes: $x$ paralelo al plano, positivo pendiente abajo; $y$ perpendicular. Peso: $mg = (15\,\mathrm{kg})(9.8\,\mathrm{m/s^2}) = 147\,\mathrm{N}$.`,
        String.raw`Eje $y$: $N = mg\cos20^\circ = (147\,\mathrm{N})(0.940) = 138\,\mathrm{N}$.`,
        String.raw`Eje $x$: $mg\sin20^\circ = m\,a \Rightarrow a = g\sin20^\circ = (9.8\,\mathrm{m/s^2})(0.342) = 3.35\,\mathrm{m/s^2}$.`,
      ],
      result: String.raw`$N \approx 138\,\mathrm{N}$ y $a \approx 3.35\,\mathrm{m/s^2}$ pendiente abajo.`,
      interpretation:
        'La aceleración es aproximadamente un tercio de g, porque sen 20° ≈ 0.34. La masa no intervino en el cálculo de a: una caja de 30 kg bajaría con la misma aceleración.',
    },
    {
      title: '¿Desliza la caja? ¿Con qué aceleración?',
      statement: String.raw`Una caja descansa sobre una rampa de $30^\circ$. Entre la caja y la rampa, $\mu_s = 0.45$ y $\mu_k = 0.30$. ¿Permanece en reposo? Si no, ¿con qué aceleración baja?`,
      steps: [
        String.raw`Criterio de reposo: $\tan\theta \le \mu_s$. Aquí $\tan30^\circ = 0.577 > 0.45$: la fricción estática no alcanza y la caja desliza.`,
        String.raw`Eje $x$ pendiente abajo. Fuerzas: $mg\sin\theta$ a favor y $f_k = \mu_k mg\cos\theta$ en contra (la caja baja).`,
        String.raw`$a = g(\sin30^\circ - \mu_k\cos30^\circ) = (9.8\,\mathrm{m/s^2})(0.500 - 0.30 \times 0.866) = (9.8)(0.240) = 2.35\,\mathrm{m/s^2}$.`,
      ],
      result: String.raw`La caja desliza con $a \approx 2.35\,\mathrm{m/s^2}$ pendiente abajo.`,
      interpretation:
        'Es menor que g sen 30° = 4.9 m/s² (lo que tendría sin fricción), como debe ser. El ángulo crítico de este par de superficies es arctan(0.45) ≈ 24°; a 30° ya está superado.',
    },
    {
      title: 'Subir una caja empujándola por la rampa',
      statement: String.raw`Se empuja una caja de $10\,\mathrm{kg}$ con una fuerza paralela a una rampa de $25^\circ$; $\mu_s = 0.40$ y $\mu_k = 0.30$. (a) ¿Qué fuerza mínima hace que la caja, en reposo, empiece a subir? (b) ¿Qué fuerza la mantiene subiendo con velocidad constante?`,
      steps: [
        String.raw`Datos: $mg = 98\,\mathrm{N}$; $mg\sin25^\circ = 41.4\,\mathrm{N}$; $N = mg\cos25^\circ = 88.8\,\mathrm{N}$.`,
        String.raw`(a) Para que arranque hacia arriba, la fuerza debe vencer la componente del peso **y** la fricción estática máxima, que ahora apunta pendiente abajo: $F > mg\sin\theta + \mu_s N = 41.4 + 0.40 \times 88.8 = 41.4 + 35.5 = 76.9\,\mathrm{N}$.`,
        String.raw`(b) Con velocidad constante, $a = 0$ y la fricción es cinética, pendiente abajo: $F = mg\sin\theta + \mu_k N = 41.4 + 0.30 \times 88.8 = 41.4 + 26.6 = 68.1\,\mathrm{N}$.`,
      ],
      result: String.raw`(a) Algo más de $76.9\,\mathrm{N}$. (b) $68.1\,\mathrm{N}$.`,
      interpretation:
        'Como μk < μs, cuesta menos mantener la caja subiendo que hacerla arrancar. Observe que en ambos casos hace falta más fuerza que el peso paralelo (41.4 N), pero menos que el peso total (98 N): la rampa «ahorra» fuerza a cambio de recorrer más distancia.',
    },
  ],
  simulation: {
    key: 'fuerzas',
    params: { m: 2, F: 0, theta: 15, muS: 0.4, muK: 0.3, g: 9.8 },
    guide: String.raw`1. Con $F = 0$, $\mu_s = 0.4$ y $\mu_k = 0.3$, lea las componentes del peso para $\theta = 15^\circ$. Compruebe que valen $mg\sin\theta$ y $mg\cos\theta$, y que la normal coincide con la componente perpendicular.
2. Aumente $\theta$ de grado en grado. ¿A qué ángulo empieza a deslizar el bloque? Compare con el ángulo cuya tangente es $\mu_s$, es decir, $\theta_c = \tan^{-1}(\mu_s)$.
3. Cambie la masa a $5\,\mathrm{kg}$ y repita el paso 2. ¿Cambia el ángulo crítico? ¿Por qué?
4. Ponga $\mu_s = 0$ y $\mu_k = 0$, y $\theta = 30^\circ$. Lea la aceleración (recuerde que el simulador toma positivo pendiente arriba) y compárela con $g\sin\theta$.
5. Con $\theta = 30^\circ$, $\mu_s = 0.4$ y $\mu_k = 0.3$, busque el intervalo de valores de $F$ para los que el bloque queda en reposo. ¿Hacia dónde apunta la fricción en cada extremo del intervalo?
6. Con $F = 20\,\mathrm{N}$ en las mismas condiciones, lea la aceleración y compruébela con $a = (F - mg\sin\theta - \mu_k mg\cos\theta)/m$.`,
  },
  exercises: [
    {
      id: 'b3-plano-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['planos-inclinados-descomposicion'],
      prompt: String.raw`Una caja de $8.0\,\mathrm{kg}$ está sobre una rampa inclinada $35^\circ$. ¿Cuánto vale la componente de su peso **paralela** a la rampa?`,
      format: 'numeric',
      unitHint: 'N',
    },
    {
      id: 'b3-plano-02',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['planos-inclinados-descomposicion'],
      prompt: String.raw`Desde lo alto de una misma rampa **sin fricción** se sueltan, desde el reposo, un bloque de $1\,\mathrm{kg}$ y otro de $5\,\mathrm{kg}$. ¿Qué se puede afirmar sobre sus aceleraciones?`,
      format: 'choice',
      options: [
        'El bloque de 5 kg acelera cinco veces más, porque su peso es cinco veces mayor.',
        'El bloque de 1 kg acelera más, porque tiene menos inercia.',
        'Ambos tienen la misma aceleración, g sen θ.',
        'Ambos tienen la misma aceleración, g, porque caen por efecto de la gravedad.',
      ],
    },
    {
      id: 'b3-plano-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['planos-inclinados-friccion'],
      prompt: String.raw`**Verdadero o falso:** un libro de masa $m$ está en reposo sobre una tabla inclinada un ángulo $\theta$ (menor que el ángulo crítico). La fuerza de fricción sobre el libro vale $\mu_s\,mg\cos\theta$. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b3-plano-04',
      category: 'experimento',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['planos-inclinados-friccion', 'planos-inclinados-angulo-critico'],
      prompt: String.raw`En el simulador, fije $m = 2\,\mathrm{kg}$, $F = 0$, $\theta = 30^\circ$, $\mu_s = 0.5$, $\mu_k = 0.4$ y $g = 9.8\,\mathrm{m/s^2}$. Antes de ejecutar, prediga si el bloque deslizará. Luego ejecute la simulación y lea la **aceleración** del bloque con el signo que da el simulador (positivo pendiente arriba). Compruebe su lectura con un cálculo.`,
      format: 'numeric',
      unitHint: 'm/s²',
      simulation: { key: 'fuerzas', params: { m: 2, F: 0, theta: 30, muS: 0.5, muK: 0.4, g: 9.8 } },
    },
    {
      id: 'b3-plano-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['planos-inclinados-friccion', 'planos-inclinados-descomposicion'],
      prompt: String.raw`Un bloque de $12\,\mathrm{kg}$ está sobre un plano inclinado $40^\circ$, con $\mu_s = 0.35$. Sin ayuda, el bloque deslizaría hacia abajo. ¿Cuál es la fuerza **mínima**, paralela al plano y dirigida pendiente arriba, que lo mantiene en reposo?`,
      format: 'numeric',
      unitHint: 'N',
    },
    {
      id: 'b3-plano-06',
      category: 'numerica',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['planos-inclinados-descomposicion'],
      prompt: String.raw`Un patinador baja, sin impulsarse, por una rampa recta inclinada $15^\circ$. Desprecie la fricción y la resistencia del aire. ¿Cuál es el módulo de su aceleración?`,
      format: 'numeric',
      unitHint: 'm/s²',
    },
    {
      id: 'b3-plano-07',
      category: 'numerica',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['planos-inclinados-angulo-critico'],
      prompt: String.raw`Para medir el coeficiente de fricción estática entre una goma de borrar y un cuaderno, una estudiante coloca la goma sobre el cuaderno y lo inclina lentamente. Si $\mu_s = 0.60$, ¿a qué ángulo empezará a deslizar la goma?`,
      format: 'numeric',
      unitHint: '°',
    },
    {
      id: 'b3-plano-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['planos-inclinados-friccion', 'planos-inclinados-angulo-critico', 'dcl-procedimiento'],
      prompt: String.raw`Unos mudanceros suben una caja de $25\,\mathrm{kg}$ a un camión por una rampa inclinada $20^\circ$. Entre la caja y la rampa, $\mu_s = 0.50$ y $\mu_k = 0.35$. Empujan con una fuerza paralela a la rampa.

(a) Dibuje el diagrama de cuerpo libre de la caja y justifique la elección de ejes.
(b) ¿Se queda la caja en reposo sobre la rampa si nadie la empuja? Justifique con el ángulo crítico.
(c) Determine el intervalo de valores de la fuerza para los que la caja permanece en reposo. Indique hacia dónde apunta la fricción en cada extremo.
(d) ¿Qué fuerza hace falta para subirla con velocidad constante?
(e) Si la rampa estuviera mojada y $\mu_s$ bajara a $0.30$, ¿cambiaría su respuesta a (b)?`,
      format: 'open',
    },
  ],
};
