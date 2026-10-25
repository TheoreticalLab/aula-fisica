import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'aplicaciones-newton',
  title: 'Aplicaciones de las leyes de Newton',
  summary:
    'Una estrategia ordenada para resolver problemas de dinámica, aplicada a sistemas de varios cuerpos, ascensores, frenado con fricción y movimiento circular uniforme, donde la fuerza neta apunta hacia el centro.',
  concepts: [
    { slug: 'aplicaciones-newton-estrategia', name: 'Estrategia de resolución de problemas de dinámica' },
    { slug: 'aplicaciones-newton-frenado', name: 'Dinámica y cinemática combinadas: frenado y distancia de frenado' },
    { slug: 'aplicaciones-newton-fuerza-centripeta', name: 'Fuerza neta centrípeta en el MCU' },
  ],
  theory: String.raw`## Una estrategia general

Casi todos los problemas de dinámica se resuelven con el mismo procedimiento. Seguirlo con disciplina evita la mayoría de los errores.

1. **Elegir el sistema.** Decida de qué cuerpo (o conjunto de cuerpos) va a estudiar el movimiento.
2. **Dibujar el diagrama de cuerpo libre** de cada cuerpo: solo las fuerzas que actúan **sobre** él, cada una con su agente (la Tierra, la mesa, la cuerda…). Si no puede decir quién ejerce una fuerza, esa fuerza no existe.
3. **Elegir ejes**, a ser posible con uno de ellos en la dirección de la aceleración (paralelo a una rampa, hacia el centro de una curva, en el sentido del movimiento de cada bloque).
4. **Escribir la segunda ley por componentes**: $\sum F_x = m\,a_x$ y $\sum F_y = m\,a_y$.
5. **Añadir las condiciones adicionales**: las cuerdas inextensibles imponen la misma aceleración; $f_s \le \mu_s N$ o $f_k = \mu_k N$; en un MCU, $a = v^2/r$.
6. **Resolver** algebraicamente y sustituir números al final.
7. **Comprobar**: unidades, signos, orden de magnitud y casos extremos (¿qué pasa si $\mu = 0$ o $\theta = 0$?).

## Sistemas de varios cuerpos

Cuando varios cuerpos se mueven juntos (vagones de un tren, bloques en contacto, masas unidas por cuerdas) hay dos maneras de plantear el problema, y conviene combinarlas:

- **Todo el conjunto como un solo sistema.** Las fuerzas entre las partes son **internas**: por la tercera ley aparecen en pares iguales y opuestos y se cancelan. Si todos tienen la misma aceleración, $\sum F_{ext} = (m_1 + m_2 + \dots)\,a$. Es la forma más rápida de obtener $a$.
- **Cada cuerpo por separado.** Es necesaria para calcular las fuerzas internas (tensiones, fuerzas de contacto).

Por ejemplo, si una persona empuja dos cajas en contacto, la fuerza que la primera caja ejerce sobre la segunda es la que acelera **solo** a la segunda (y vence su fricción). Por eso es menor que el empuje total.

## Ascensores

Ya vimos que la normal de una báscula en un ascensor vale $N = m(g + a_y)$. El mismo razonamiento sirve para el cable: si la cabina con sus pasajeros tiene una masa total $M$, la tensión del cable es $T = M(g + a_y)$. Al arrancar hacia arriba, el cable soporta más que el peso; al frenar mientras sube, menos. Los ascensores se diseñan con aceleraciones de alrededor de $1\,\mathrm{m/s^2}$ para que los pasajeros apenas lo noten.

## Dinámica y cinemática juntas: el frenado

Muchos problemas combinan las dos partes de la mecánica: **las fuerzas determinan la aceleración** (segunda ley) y **la aceleración determina el movimiento** (ecuaciones del MRUA). La aceleración es el puente entre ambas.

Un auto que frena bloqueando las ruedas desliza sobre el pavimento. En una carretera horizontal, $N = mg$, y la única fuerza horizontal es la fricción cinética, opuesta al movimiento: $-\mu_k mg = m\,a$, de modo que

$$a = -\mu_k\,g .$$

Con esta aceleración constante, la ecuación $v^2 = v_0^2 + 2a\,\Delta x$ con $v = 0$ da la **distancia de frenado**:

$$d = \frac{v_0^2}{2\,\mu_k\,g}.$$

Tres conclusiones importantes para la seguridad vial:

- **No depende de la masa**: un camión y un motoconcho con el mismo $\mu_k$ frenan en la misma distancia (en la práctica, los frenos y los neumáticos del camión son distintos).
- **Crece con el cuadrado de la rapidez**: al doble de rapidez, cuatro veces la distancia.
- **Depende del estado del pavimento**: con lluvia, $\mu_k$ puede bajar a la mitad y la distancia se duplica.

Los frenos ABS impiden que las ruedas se bloqueen. Una rueda que rueda sin deslizar tiene su punto de contacto momentáneamente quieto respecto al suelo, así que actúa la fricción **estática**, que puede ser mayor que la cinética. Además, el conductor conserva el control de la dirección.

## Movimiento circular uniforme: la fuerza neta apunta al centro

En la cinemática vimos que un cuerpo que recorre una circunferencia de radio $r$ con rapidez constante $v$ tiene una aceleración dirigida hacia el centro, la **aceleración centrípeta** $a_c = v^2/r$. Por la segunda ley, eso exige una **fuerza neta dirigida hacia el centro**:

$$\sum F_{\text{hacia el centro}} = m\,\frac{v^2}{r}.$$

La «fuerza centrípeta» **no es un tipo nuevo de fuerza**: es el nombre que se da a la fuerza neta en la dirección radial. La proporcionan fuerzas ordinarias, que hay que identificar en el diagrama de cuerpo libre:

- **Piedra atada a una cuerda** que gira en un círculo horizontal sobre una mesa lisa: la tensión. Si una piedra de $0.30\,\mathrm{kg}$ gira en un círculo de $0.80\,\mathrm{m}$ dando $2.0$ vueltas por segundo, $v = 2\pi r f = 10.1\,\mathrm{m/s}$ y $T = m v^2/r = 37.9\,\mathrm{N}$.
- **Auto en una curva plana**: la fricción **estática** del pavimento sobre los neumáticos, dirigida hacia el centro de la curva. Es estática porque los neumáticos no deslizan lateralmente.
- **La Luna alrededor de la Tierra**: la atracción gravitatoria.

En la curva plana, la normal equilibra el peso ($N = mg$) y la fricción debe valer $m v^2/r$. Como $f_s \le \mu_s mg$, la rapidez máxima con que se puede tomar la curva es

$$v_{max} = \sqrt{\mu_s\,g\,r}.$$

Tampoco depende de la masa, y disminuye mucho con el pavimento mojado.

> **Error frecuente.** Dibujar una «fuerza centrífuga» hacia afuera en el diagrama de cuerpo libre. Desde el suelo (un sistema de referencia inercial) esa fuerza no existe: no hay ningún agente que la ejerza. Si la sumara a la fuerza hacia el centro, la fuerza neta sería cero y el cuerpo seguiría en línea recta.

¿Por qué entonces nos sentimos «empujados hacia afuera» en una guagua que toma una curva? Por la **inercia**: nuestro cuerpo tiende a seguir en línea recta, mientras que la guagua gira. Lo que sentimos es el asiento o la puerta que nos empuja **hacia el centro** para obligarnos a girar con el vehículo. Si la cuerda de la piedra se rompe, la piedra no sale disparada radialmente hacia afuera: sale en línea recta, **tangente** a la circunferencia, con la velocidad que tenía en ese instante.

## Límites del modelo

Hemos supuesto coeficientes de fricción constantes, fuerzas de frenado constantes, cuerdas ideales y aire sin efecto. En el frenado real hay que sumar la **distancia de reacción**, la que se recorre antes de pisar el freno (con un tiempo de reacción de $1\,\mathrm{s}$, a $72\,\mathrm{km/h}$ son $20\,\mathrm{m}$ más). En curvas de autopista se usa además el **peralte** (inclinación de la calzada), que permite que una componente de la normal también apunte al centro.`,
  formulas: [
    {
      name: 'Segunda ley por componentes',
      latex: String.raw`\sum F_x = m\,a_x, \qquad \sum F_y = m\,a_y`,
      description:
        'Se aplica a cada cuerpo (o al conjunto, si comparten aceleración) con ejes elegidos de modo que uno siga la aceleración.',
      variables: [
        { symbol: String.raw`\sum F_x,\,\sum F_y`, meaning: 'Componentes de la fuerza neta', unit: 'N' },
        { symbol: String.raw`a_x,\,a_y`, meaning: 'Componentes de la aceleración', unit: 'm/s²' },
        { symbol: String.raw`m`, meaning: 'Masa del cuerpo o del sistema', unit: 'kg' },
      ],
      notes: 'Para un sistema de varios cuerpos con la misma aceleración, solo cuentan las fuerzas externas.',
    },
    {
      name: 'Frenado con fricción cinética (piso horizontal)',
      latex: String.raw`a = -\mu_k\,g`,
      description: 'Aceleración de un cuerpo que desliza sin otras fuerzas horizontales; el signo indica que se opone a la velocidad.',
      variables: [
        { symbol: String.raw`\mu_k`, meaning: 'Coeficiente de fricción cinética', unit: '— (adimensional)' },
        { symbol: String.raw`g`, meaning: 'Aceleración de la gravedad', unit: 'm/s²' },
      ],
    },
    {
      name: 'Distancia de frenado',
      latex: String.raw`d = \frac{v_0^2}{2\,\mu_k\,g}`,
      description: 'Distancia que recorre un cuerpo que desliza hasta detenerse, partiendo con rapidez v₀, sobre una superficie horizontal.',
      variables: [
        { symbol: String.raw`d`, meaning: 'Distancia de frenado', unit: 'm' },
        { symbol: String.raw`v_0`, meaning: 'Rapidez al empezar a frenar', unit: 'm/s' },
      ],
      notes: 'Proviene de v² = v₀² + 2a·Δx con v = 0 y a = −μk·g. No incluye la distancia de reacción.',
    },
    {
      name: 'Fuerza neta en el movimiento circular uniforme',
      latex: String.raw`\sum F_{c} = m\,\frac{v^2}{r}`,
      description: 'La suma de las componentes radiales de las fuerzas reales, dirigida hacia el centro, es igual a m·v²/r.',
      variables: [
        { symbol: String.raw`\sum F_c`, meaning: 'Fuerza neta hacia el centro (fuerza centrípeta)', unit: 'N' },
        { symbol: String.raw`v`, meaning: 'Rapidez', unit: 'm/s' },
        { symbol: String.raw`r`, meaning: 'Radio de la trayectoria', unit: 'm' },
      ],
      notes: 'No es una fuerza adicional: la proporcionan la tensión, la fricción, la gravedad, la normal…',
    },
    {
      name: 'Rapidez máxima en una curva plana',
      latex: String.raw`v_{max} = \sqrt{\mu_s\,g\,r}`,
      description: 'Rapidez máxima con la que un vehículo puede tomar una curva horizontal sin peralte sin derrapar.',
      variables: [{ symbol: String.raw`\mu_s`, meaning: 'Coeficiente de fricción estática neumático-pavimento', unit: '— (adimensional)' }],
    },
  ],
  examples: [
    {
      title: 'Distancia de frenado de un automóvil',
      statement: String.raw`Un auto circula a $72\,\mathrm{km/h}$ por una carretera horizontal seca. El conductor frena bruscamente y las ruedas se bloquean; $\mu_k = 0.70$. ¿Qué distancia recorre hasta detenerse y cuánto tarda?`,
      steps: [
        String.raw`Conversión: $v_0 = 72\,\mathrm{km/h} \times \dfrac{1000\,\mathrm{m}}{3600\,\mathrm{s}} = 20\,\mathrm{m/s}$.`,
        String.raw`Dinámica (eje $x$ en el sentido del movimiento): la fricción es la única fuerza horizontal, $-\mu_k mg = m a \Rightarrow a = -\mu_k g = -(0.70)(9.8\,\mathrm{m/s^2}) = -6.86\,\mathrm{m/s^2}$.`,
        String.raw`Cinemática: $0 = v_0^2 + 2a\,d \Rightarrow d = \dfrac{v_0^2}{2\mu_k g} = \dfrac{(20\,\mathrm{m/s})^2}{2(6.86\,\mathrm{m/s^2})} = 29.2\,\mathrm{m}$.`,
        String.raw`Tiempo: $0 = v_0 + a t \Rightarrow t = \dfrac{20\,\mathrm{m/s}}{6.86\,\mathrm{m/s^2}} = 2.92\,\mathrm{s}$.`,
      ],
      result: String.raw`$d \approx 29\,\mathrm{m}$ y $t \approx 2.9\,\mathrm{s}$.`,
      interpretation:
        'La masa del auto no apareció: se canceló. A 144 km/h (el doble) la distancia sería cuatro veces mayor, unos 117 m. Y a eso hay que sumarle la distancia recorrida durante el tiempo de reacción.',
    },
    {
      title: 'Dos cajas en contacto',
      statement: String.raw`Un trabajador empuja horizontalmente con $60\,\mathrm{N}$ una caja $A$ de $4.0\,\mathrm{kg}$, que a su vez empuja a una caja $B$ de $2.0\,\mathrm{kg}$ situada delante. Ambas deslizan por el piso con $\mu_k = 0.20$. Halle la aceleración y la fuerza que $A$ ejerce sobre $B$.`,
      steps: [
        String.raw`**Sistema $A + B$** ($6.0\,\mathrm{kg}$). Fuerzas externas horizontales: el empuje ($60\,\mathrm{N}$) y la fricción total $\mu_k (m_A + m_B) g = 0.20 \times 6.0 \times 9.8 = 11.76\,\mathrm{N}$. La fuerza entre las cajas es interna y no aparece.`,
        String.raw`$a = \dfrac{60\,\mathrm{N} - 11.76\,\mathrm{N}}{6.0\,\mathrm{kg}} = 8.04\,\mathrm{m/s^2}$.`,
        String.raw`**Caja $B$ sola.** Fuerzas horizontales: el empuje $P$ de $A$, hacia adelante, y su fricción $\mu_k m_B g = 3.92\,\mathrm{N}$, hacia atrás. Segunda ley: $P - 3.92\,\mathrm{N} = (2.0\,\mathrm{kg})(8.04\,\mathrm{m/s^2})$.`,
        String.raw`$P = 16.08\,\mathrm{N} + 3.92\,\mathrm{N} = 20.0\,\mathrm{N}$.`,
      ],
      result: String.raw`$a \approx 8.0\,\mathrm{m/s^2}$ y la fuerza de $A$ sobre $B$ vale $20\,\mathrm{N}$.`,
      interpretation:
        'Por la tercera ley, B empuja a A con 20 N hacia atrás. La fuerza de contacto es un tercio del empuje, la misma fracción que la masa de B en el total: con igual μk, la fricción no altera ese reparto.',
    },
    {
      title: 'Rapidez máxima en una curva plana',
      statement: String.raw`Una curva plana (sin peralte) de una carretera tiene un radio de $50\,\mathrm{m}$. El coeficiente de fricción estática entre los neumáticos y el pavimento es $0.60$ en seco y $0.30$ con lluvia. ¿Cuál es la rapidez máxima con la que se puede tomar la curva en cada caso?`,
      steps: [
        String.raw`DCL del auto (visto desde el suelo): peso hacia abajo, normal hacia arriba y fricción estática horizontal hacia el centro de la curva. No hay ninguna fuerza hacia afuera.`,
        String.raw`Vertical: $N = mg$. Radial: $f_s = m v^2/r$. Con la condición $f_s \le \mu_s N$: $m v^2/r \le \mu_s m g \Rightarrow v \le \sqrt{\mu_s g r}$.`,
        String.raw`En seco: $v_{max} = \sqrt{(0.60)(9.8\,\mathrm{m/s^2})(50\,\mathrm{m})} = \sqrt{294\,\mathrm{m^2/s^2}} = 17.1\,\mathrm{m/s} \approx 62\,\mathrm{km/h}$.`,
        String.raw`Con lluvia: $v_{max} = \sqrt{(0.30)(9.8)(50)}\,\mathrm{m/s} = 12.1\,\mathrm{m/s} \approx 44\,\mathrm{km/h}$.`,
      ],
      result: String.raw`$17\,\mathrm{m/s}$ ($62\,\mathrm{km/h}$) en seco y $12\,\mathrm{m/s}$ ($44\,\mathrm{km/h}$) con lluvia.`,
      interpretation:
        'Con la mitad de fricción, la rapidez máxima no se reduce a la mitad sino en un factor √2. Si el auto va más rápido, la fricción no basta para curvar su trayectoria y el auto sigue una línea más abierta (derrapa hacia afuera de la curva).',
    },
  ],
  simulation: {
    key: 'fuerzas',
    params: { m: 2, F: 20, theta: 0, muS: 0.4, muK: 0.3, g: 9.8 },
    guide: String.raw`1. Con $m = 2\,\mathrm{kg}$, $F = 20\,\mathrm{N}$, $\theta = 0$, $\mu_s = 0.4$ y $\mu_k = 0.3$, calcule la aceleración con la segunda ley **antes** de ejecutar. Después compruébela en el simulador.
2. Con esa aceleración, prediga la posición y la velocidad en $t = 2\,\mathrm{s}$ usando las ecuaciones del MRUA. Ejecute y compare con las lecturas en vivo.
3. Observe las gráficas $x$–$t$ y $v$–$t$. ¿Qué forma tienen? ¿Qué representa la pendiente de la gráfica $v$–$t$?
4. Duplique la masa sin cambiar $F$. ¿Se mueve el bloque? Si se mueve, ¿cómo cambia la aceleración? Explique por qué no se reduce simplemente a la mitad.
5. Ponga $F = 0$, $\theta = 30^\circ$, $\mu_s = 0.3$ y $\mu_k = 0.2$. Prediga la velocidad a los $3\,\mathrm{s}$ y compruébela.
6. Explique qué paso de la estrategia de resolución corresponde a cada lectura del simulador (fuerzas, fuerza neta, aceleración, posición).`,
  },
  exercises: [
    {
      id: 'b3-apl-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['aplicaciones-newton-frenado'],
      prompt: String.raw`Un motoconcho circula a $36\,\mathrm{km/h}$ por una calle horizontal. El conductor frena y las ruedas se bloquean. El coeficiente de fricción cinética entre los neumáticos y el asfalto es $0.50$. ¿Qué distancia recorre la moto hasta detenerse?`,
      format: 'numeric',
      unitHint: 'm',
    },
    {
      id: 'b3-apl-02',
      category: 'conceptual',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['aplicaciones-newton-fuerza-centripeta'],
      prompt: String.raw`Un automóvil toma una curva plana (sin peralte) con rapidez constante. Visto desde el suelo, ¿qué fuerza proporciona la fuerza neta dirigida hacia el centro de la curva?`,
      format: 'choice',
      options: [
        'La fuerza centrífuga, que equilibra el peso del auto.',
        'La fricción estática del pavimento sobre los neumáticos, dirigida hacia el centro de la curva.',
        'La fricción cinética del pavimento sobre los neumáticos, dirigida hacia afuera de la curva.',
        'La normal del pavimento, que en una curva se inclina hacia el centro.',
      ],
    },
    {
      id: 'b3-apl-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['aplicaciones-newton-frenado'],
      prompt: String.raw`**Verdadero o falso:** si un automóvil frena con las ruedas bloqueadas sobre el mismo pavimento, pero partiendo del doble de rapidez, su distancia de frenado también se duplica. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b3-apl-04',
      category: 'experimento',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['aplicaciones-newton-estrategia', 'ley2-fuerza-neta-aceleracion'],
      prompt: String.raw`En el simulador, fije $m = 5\,\mathrm{kg}$, $F = 30\,\mathrm{N}$, $\theta = 0$, $\mu_s = 0.4$, $\mu_k = 0.25$ y $g = 9.8\,\mathrm{m/s^2}$. Primero, con la segunda ley y las ecuaciones del MRUA, prediga la **distancia** que habrá recorrido el bloque en $t = 4\,\mathrm{s}$ (parte del reposo). Después ejecute la simulación, lea la posición en $t = 4\,\mathrm{s}$ y compare. Escriba el valor de esa distancia.`,
      format: 'numeric',
      unitHint: 'm',
      simulation: { key: 'fuerzas', params: { m: 5, F: 30, theta: 0, muS: 0.4, muK: 0.25, g: 9.8 } },
    },
    {
      id: 'b3-apl-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['aplicaciones-newton-estrategia', 'tension-sistemas-acoplados'],
      prompt: String.raw`Un bloque de $4.0\,\mathrm{kg}$ está sobre una mesa horizontal ($\mu_s = 0.35$, $\mu_k = 0.25$) y unido, mediante una cuerda ideal que pasa por una polea ideal en el borde, a un bloque de $2.0\,\mathrm{kg}$ que cuelga. Se suelta el sistema desde el reposo. ¿Qué rapidez tiene el bloque colgante después de descender $1.5\,\mathrm{m}$?`,
      format: 'numeric',
      unitHint: 'm/s',
    },
    {
      id: 'b3-apl-06',
      category: 'numerica',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['aplicaciones-newton-fuerza-centripeta'],
      prompt: String.raw`Una glorieta tiene un carril circular plano de $40\,\mathrm{m}$ de radio. El coeficiente de fricción estática entre los neumáticos y el pavimento es $0.50$. ¿Cuál es la rapidez máxima con la que un auto puede recorrerla sin derrapar?`,
      format: 'numeric',
      unitHint: 'm/s',
    },
    {
      id: 'b3-apl-07',
      category: 'error',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['aplicaciones-newton-frenado', 'peso-normal-masa-peso'],
      prompt: String.raw`Un estudiante resolvió así este problema: *«Un auto de $1200\,\mathrm{kg}$ va a $90\,\mathrm{km/h}$ por una carretera horizontal y frena con las ruedas bloqueadas ($\mu_k = 0.60$). ¿Cuál es su distancia de frenado?»*

1. $v_0 = 90\,\mathrm{km/h} = 25\,\mathrm{m/s}$.
2. En una carretera horizontal, la normal es $N = 1200\,\mathrm{N}$.
3. La fricción cinética es $f_k = \mu_k N = 0.60 \times 1200 = 720\,\mathrm{N}$.
4. La aceleración es $a = -f_k/m = -720/1200 = -0.60\,\mathrm{m/s^2}$.
5. Distancia: $d = v_0^2/(2|a|) = 625/1.2 = 521\,\mathrm{m}$.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'Paso 5', 'No hay ningún error'],
    },
    {
      id: 'b3-apl-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['aplicaciones-newton-fuerza-centripeta', 'aplicaciones-newton-estrategia', 'dcl-procedimiento'],
      prompt: String.raw`**Parte A.** Un auto toma una curva plana de $80\,\mathrm{m}$ de radio con rapidez constante.

(a) Dibuje el diagrama de cuerpo libre del auto, visto desde el suelo, e indique hacia dónde apunta la fuerza neta.
(b) Calcule la rapidez máxima sin derrapar con pavimento seco ($\mu_s = 0.70$) y mojado ($\mu_s = 0.40$), en m/s y en km/h.
(c) ¿Depende esa rapidez de la masa del auto? Justifique.
(d) Un pasajero dice que «la fuerza centrífuga lo empuja contra la puerta». Explique físicamente lo que ocurre.

**Parte B.** Una piedra de $0.25\,\mathrm{kg}$ gira en un círculo horizontal sobre una mesa lisa, atada a una cuerda de $0.60\,\mathrm{m}$ cuyo otro extremo está fijo en el centro. La cuerda se rompe si la tensión supera $40\,\mathrm{N}$.

(e) Calcule la rapidez máxima de la piedra y el número máximo de vueltas por segundo.
(f) Describa la trayectoria de la piedra si la cuerda se rompe.`,
      format: 'open',
    },
  ],
};
