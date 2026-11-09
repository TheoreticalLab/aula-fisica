import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'masa-resorte',
  title: 'Sistema masa-resorte',
  summary:
    'Un bloque unido a un resorte oscila alrededor del equilibrio porque la fuerza elástica siempre apunta hacia él. Ley de Hooke, período T = 2π√(m/k) y resorte vertical.',
  concepts: [
    { slug: 'masa-resorte-hooke', name: 'Ley de Hooke y fuerza restauradora' },
    { slug: 'masa-resorte-periodo', name: 'Período del sistema masa-resorte' },
    { slug: 'masa-resorte-vertical', name: 'Resorte vertical y estiramiento de equilibrio' },
  ],
  theory: String.raw`## La ley de Hooke

Si estiramos o comprimimos un resorte, este ejerce una fuerza que intenta devolverlo a su **longitud natural**. Para deformaciones no muy grandes, esa fuerza es **proporcional a la deformación** y de sentido opuesto. Es la **ley de Hooke**:

$$F = -k\,x .$$

Aquí $x$ es la deformación medida desde la longitud natural (positiva si el resorte se estira, negativa si se comprime, con el eje elegido) y $k$ es la **constante elástica** del resorte, en N/m. Un resorte rígido, como el de la suspensión de un carro, tiene $k$ grande; uno blando, como el de un bolígrafo, tiene $k$ pequeña.

El **signo menos** es la clave de todo lo que sigue: la fuerza siempre apunta **hacia el equilibrio**. Si el bloque está a la derecha ($x > 0$), el resorte tira hacia la izquierda; si está a la izquierda ($x < 0$), empuja hacia la derecha. Por eso se le llama **fuerza restauradora**.

> **Cuidado.** $k$ no es la fuerza del resorte. Es la fuerza **por cada metro** de deformación. Un resorte de $k = 200\,\mathrm{N/m}$ estirado $5\,\mathrm{cm}$ ejerce $200 \times 0.05 = 10\,\mathrm{N}$.

## ¿Por qué oscila el bloque?

Pongamos un bloque de masa $m$ sobre una mesa sin fricción, unido a un resorte. Lo apartamos una distancia $A$ del equilibrio y lo soltamos:

1. En el extremo, el resorte tira con fuerza máxima hacia el equilibrio y el bloque empieza a acelerar.
2. A medida que se acerca, la fuerza disminuye, pero el bloque sigue ganando rapidez.
3. Al pasar por el equilibrio la fuerza es cero, pero el bloque lleva su **máxima rapidez**: por inercia, sigue de largo.
4. Ahora el resorte se comprime y lo frena, hasta detenerlo en el extremo opuesto, a la distancia $A$.
5. El proceso se repite en sentido contrario.

Sin fricción, el bloque oscila indefinidamente entre $-A$ y $+A$. El resorte transforma energía cinética en energía potencial elástica y viceversa.

## El período depende de m y de k

El tiempo que dura un ciclo resulta ser

$$T = 2\pi\sqrt{\frac{m}{k}} .$$

Esta fórmula se entiende con sentido común:

- **Más masa → período mayor.** Un cuerpo con más inercia tarda más en acelerarse y en frenarse.
- **Resorte más rígido → período menor.** Un $k$ grande produce fuerzas grandes y el bloque va y viene rápido.
- **La amplitud no aparece.** Si se suelta el bloque desde más lejos, recorre más distancia, pero también la fuerza es mayor y va más rápido: las dos cosas se compensan exactamente. Un oscilador cuyo período no depende de la amplitud se llama **isócrono**.

Por la raíz cuadrada, para **duplicar** el período hay que **cuadruplicar** la masa (o dividir $k$ entre cuatro).

La frecuencia y la frecuencia angular son

$$f = \frac{1}{2\pi}\sqrt{\frac{k}{m}}, \qquad \omega = \sqrt{\frac{k}{m}} .$$

## Resorte vertical

Si colgamos el bloque de un resorte vertical, el peso estira el resorte hasta que la fuerza elástica lo equilibra: $k\,\Delta = mg$. El **estiramiento de equilibrio** es

$$\Delta = \frac{mg}{k} .$$

Este es un método sencillo para medir $k$ en el laboratorio: se cuelgan masas conocidas, se mide cuánto se estira el resorte y se calcula $k = mg/\Delta$. Si se representa la fuerza frente al estiramiento, los puntos forman una recta cuya pendiente es $k$.

Lo sorprendente es que, si ahora tiramos del bloque hacia abajo y lo soltamos, **oscila alrededor de la nueva posición de equilibrio con el mismo período** que en horizontal, $T = 2\pi\sqrt{m/k}$. La gravedad solo desplaza el centro de la oscilación; no cambia la «rigidez» del sistema. Combinando las dos ecuaciones ($m/k = \Delta/g$) se obtiene un resultado curioso:

$$T = 2\pi\sqrt{\frac{\Delta}{g}} ,$$

de modo que basta medir cuánto se estira el resorte para predecir su período.

## Ejemplos cotidianos

- La **suspensión** de un carro o de una guagua: el chasis es la masa y los resortes, el resorte. Cuando el vehículo pasa por un badén, rebota con una frecuencia de 1 a 2 Hz; los amortiguadores se encargan de frenar esa oscilación.
- Una **balanza de resorte** de los colmados o de los mercados: mide el estiramiento de equilibrio $\Delta = mg/k$.
- Los **edificios altos** y los puentes se comportan como osciladores con masa y rigidez. Los ingenieros cuidan que sus períodos no coincidan con los de los sismos o el viento.

## Errores frecuentes

- Pensar que una amplitud mayor produce un período mayor. En el modelo ideal, no cambia.
- Escribir $T = 2\pi\sqrt{k/m}$ (invertido). Compruebe con el sentido común: más masa debe dar más período.
- Olvidar convertir centímetros a metros antes de usar $k$ en N/m.
- Creer que la gravedad cambia el período del resorte vertical.

## Límites del modelo

Suponemos un **resorte ideal**: sin masa, que cumple la ley de Hooke en todo el recorrido. Si se estira demasiado, el resorte se deforma de forma permanente y la ley deja de valer. También ignoramos la fricción y la resistencia del aire, que en la realidad hacen que la amplitud disminuya poco a poco. Si la masa del resorte no es despreciable frente a la del bloque, el período medido sale algo mayor que el calculado.`,
  formulas: [
    {
      name: 'Ley de Hooke',
      latex: String.raw`F = -k\,x`,
      description: 'Fuerza que ejerce el resorte: proporcional a la deformación y dirigida hacia la posición de equilibrio.',
      variables: [
        { symbol: String.raw`F`, meaning: 'Fuerza del resorte sobre el bloque (con signo)', unit: 'N' },
        { symbol: String.raw`k`, meaning: 'Constante elástica del resorte', unit: 'N/m' },
        { symbol: String.raw`x`, meaning: 'Deformación desde la longitud natural (con signo)', unit: 'm' },
      ],
      notes: 'El signo menos indica que la fuerza se opone a la deformación. Para el módulo: |F| = k|x|.',
    },
    {
      name: 'Período del sistema masa-resorte',
      latex: String.raw`T = 2\pi\sqrt{\frac{m}{k}}`,
      description: 'Duración de un ciclo. No depende de la amplitud ni, en vertical, de la gravedad.',
      variables: [
        { symbol: String.raw`T`, meaning: 'Período', unit: 's' },
        { symbol: String.raw`m`, meaning: 'Masa del bloque', unit: 'kg' },
        { symbol: String.raw`k`, meaning: 'Constante elástica', unit: 'N/m' },
      ],
    },
    {
      name: 'Frecuencia angular',
      latex: String.raw`\omega = \sqrt{\frac{k}{m}}, \qquad f = \frac{\omega}{2\pi}`,
      description: 'Frecuencia angular y frecuencia del oscilador.',
      variables: [
        { symbol: String.raw`\omega`, meaning: 'Frecuencia angular', unit: 'rad/s' },
        { symbol: String.raw`f`, meaning: 'Frecuencia', unit: 'Hz' },
      ],
    },
    {
      name: 'Estiramiento de equilibrio (resorte vertical)',
      latex: String.raw`\Delta = \frac{m\,g}{k}`,
      description: 'Cuánto se estira un resorte vertical cuando se le cuelga un cuerpo en reposo.',
      variables: [
        { symbol: String.raw`\Delta`, meaning: 'Estiramiento en el equilibrio', unit: 'm' },
        { symbol: String.raw`g`, meaning: 'Aceleración de la gravedad', unit: 'm/s²' },
      ],
      notes: 'Combinada con el período: T = 2π√(Δ/g).',
    },
  ],
  examples: [
    {
      title: 'Medir k y predecir el período',
      statement: String.raw`Al colgar un cuerpo de $200\,\mathrm{g}$ de un resorte vertical, este se estira $4.0\,\mathrm{cm}$ hasta quedar en equilibrio. (a) ¿Cuál es la constante del resorte? (b) ¿Con qué período oscilará el cuerpo si se le da un pequeño tirón hacia abajo?`,
      steps: [
        String.raw`Unidades del SI: $m = 0.200\,\mathrm{kg}$, $\Delta = 0.040\,\mathrm{m}$.`,
        String.raw`En equilibrio, $k\,\Delta = mg$: $k = \dfrac{mg}{\Delta} = \dfrac{(0.200\,\mathrm{kg})(9.8\,\mathrm{m/s^2})}{0.040\,\mathrm{m}} = 49\,\mathrm{N/m}$.`,
        String.raw`Período: $T = 2\pi\sqrt{\dfrac{m}{k}} = 2\pi\sqrt{\dfrac{0.200\,\mathrm{kg}}{49\,\mathrm{N/m}}} = 2\pi\,(0.0639\,\mathrm{s}) = 0.40\,\mathrm{s}$.`,
        String.raw`Comprobación con $T = 2\pi\sqrt{\Delta/g} = 2\pi\sqrt{0.040/9.8}\,\mathrm{s} = 0.40\,\mathrm{s}$ ✓.`,
      ],
      result: String.raw`(a) $k = 49\,\mathrm{N/m}$; (b) $T \approx 0.40\,\mathrm{s}$.`,
      interpretation: 'Unas 2.5 oscilaciones por segundo: un rebote rápido, como el de un juguete colgado de un resorte blando.',
    },
    {
      title: 'Suspensión de un carro',
      statement: String.raw`Un carro de $1000\,\mathrm{kg}$ se apoya sobre cuatro resortes que, en conjunto, equivalen a un solo resorte de $k = 1.6\times10^{5}\,\mathrm{N/m}$. Si los amortiguadores estuvieran gastados, ¿con qué período y frecuencia rebotaría el carro?`,
      steps: [
        String.raw`$T = 2\pi\sqrt{\dfrac{m}{k}} = 2\pi\sqrt{\dfrac{1000\,\mathrm{kg}}{1.6\times10^{5}\,\mathrm{N/m}}} = 2\pi\sqrt{6.25\times10^{-3}\,\mathrm{s^2}}$.`,
        String.raw`$\sqrt{6.25\times10^{-3}} = 0.0791$, así que $T = 2\pi \times 0.0791\,\mathrm{s} = 0.50\,\mathrm{s}$.`,
        String.raw`$f = 1/T = 2.0\,\mathrm{Hz}$.`,
      ],
      result: String.raw`$T \approx 0.50\,\mathrm{s}$ y $f \approx 2.0\,\mathrm{Hz}$.`,
      interpretation: 'Dos rebotes por segundo: es el balanceo molesto que se nota en un carro con los amortiguadores en mal estado tras pasar un badén.',
    },
    {
      title: 'Cambiar la masa',
      statement: String.raw`Un bloque oscila en un resorte con período $0.60\,\mathrm{s}$. Se sustituye por otro bloque de **cuatro veces** su masa en el mismo resorte. ¿Cuál es el nuevo período?`,
      steps: [
        String.raw`Como $T \propto \sqrt{m}$ con el mismo $k$: $\dfrac{T_2}{T_1} = \sqrt{\dfrac{m_2}{m_1}} = \sqrt{4} = 2$.`,
        String.raw`$T_2 = 2 \times 0.60\,\mathrm{s} = 1.2\,\mathrm{s}$.`,
      ],
      result: String.raw`$T_2 = 1.2\,\mathrm{s}$.`,
      interpretation: 'Cuadruplicar la masa solo duplica el período, por la raíz cuadrada. Razonar con cocientes evita tener que conocer k.',
    },
  ],
  simulation: {
    key: 'masa-resorte',
    params: { m: 0.5, k: 20, x0: 0.1, v0: 0, vertical: 0 },
    guide: String.raw`1. Con los valores iniciales, pulse **Iniciar** y anote el período $T$ que indica el simulador. Compruébelo con $T = 2\pi\sqrt{m/k}$.
2. Cambie la posición inicial $x_0$ a $0.20\,\mathrm{m}$ y luego a $0.40\,\mathrm{m}$. ¿Cambia el período? ¿Qué cambia?
3. Cuadruplique la masa ($m = 2.0\,\mathrm{kg}$) sin tocar $k$. ¿Por qué factor se multiplica $T$?
4. Vuelva a $m = 0.5\,\mathrm{kg}$ y cuadruplique $k$ ($k = 80\,\mathrm{N/m}$). ¿Qué le ocurre a $T$ ahora?
5. Active el resorte vertical (vertical = 1). Lea el estiramiento de equilibrio $mg/k$ y compare el período con el del resorte horizontal.
6. Observe la lectura «Fuerza restauradora $-kx$»: ¿qué signo tiene cuando $x > 0$? ¿Y cuando $x < 0$?`,
  },
  exercises: [
    {
      id: 'b5-mres-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['masa-resorte-hooke'],
      prompt: String.raw`Un resorte de constante $k = 250\,\mathrm{N/m}$ se estira $6.0\,\mathrm{cm}$ desde su longitud natural. ¿Cuál es el **módulo** de la fuerza que ejerce?`,
      format: 'numeric',
      unitHint: 'N',
    },
    {
      id: 'b5-mres-02',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['masa-resorte-periodo'],
      prompt: String.raw`Un bloque de $0.80\,\mathrm{kg}$ unido a un resorte de constante $20\,\mathrm{N/m}$ oscila sobre una mesa horizontal sin fricción. ¿Cuál es su período?`,
      format: 'numeric',
      unitHint: 's',
    },
    {
      id: 'b5-mres-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['masa-resorte-periodo'],
      prompt: String.raw`**Verdadero o falso:** si un bloque unido a un resorte ideal se suelta desde el doble de distancia al equilibrio, tarda el doble de tiempo en completar una oscilación. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b5-mres-04',
      category: 'experimento',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['masa-resorte-periodo'],
      prompt: String.raw`En el simulador, fije $m = 0.5\,\mathrm{kg}$, $k = 20\,\mathrm{N/m}$, $x_0 = 0.10\,\mathrm{m}$, $v_0 = 0$ y el resorte horizontal. Anote el período que indica el simulador. Sin cambiar $k$, ¿qué masa hace falta para que el período sea **el doble** del que anotó? Calcúlela y luego compruébela en el simulador.`,
      format: 'numeric',
      unitHint: 'kg',
      simulation: { key: 'masa-resorte', params: { m: 0.5, k: 20, x0: 0.1, v0: 0, vertical: 0 } },
    },
    {
      id: 'b5-mres-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['masa-resorte-vertical', 'masa-resorte-periodo'],
      prompt: String.raw`Se cuelga un cuerpo de $0.30\,\mathrm{kg}$ de un resorte vertical de constante desconocida y, en equilibrio, el resorte queda estirado $12\,\mathrm{cm}$. Luego se tira del cuerpo un poco hacia abajo y se suelta. ¿Con qué período oscila?`,
      format: 'numeric',
      unitHint: 's',
    },
    {
      id: 'b5-mres-06',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['masa-resorte-periodo'],
      prompt: '¿Cuál de estos cambios **aumenta** el período de un sistema masa-resorte?',
      format: 'choice',
      options: [
        'Usar un resorte más rígido (mayor k).',
        'Usar un bloque de mayor masa.',
        'Soltar el bloque desde más lejos del equilibrio.',
        'Colocar el resorte en vertical en lugar de en horizontal.',
      ],
    },
    {
      id: 'b5-mres-07',
      category: 'grafica',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['masa-resorte-hooke'],
      prompt: 'En el laboratorio se midió la fuerza necesaria para estirar un resorte en función del estiramiento. ¿Cuál es la constante elástica del resorte?',
      format: 'numeric',
      unitHint: 'N/m',
      figure: {
        kind: 'scatter',
        title: 'Fuerza frente al estiramiento',
        x: { label: 'Estiramiento', unit: 'cm' },
        y: { label: 'F', unit: 'N' },
        series: [{ name: 'Mediciones', points: [[0, 0], [2, 1.0], [4, 2.0], [6, 3.0], [8, 4.0]] }],
      },
    },
    {
      id: 'b5-mres-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['masa-resorte-hooke', 'masa-resorte-vertical', 'masa-resorte-periodo'],
      prompt: String.raw`Un grupo de laboratorio quiere medir la constante $k$ de un resorte por dos métodos. **Método estático:** al colgar $0.50\,\mathrm{kg}$, el resorte se estira $9.8\,\mathrm{cm}$. **Método dinámico:** con la misma masa oscilando, cronometran $10$ oscilaciones en $6.3\,\mathrm{s}$.

(a) Calcule $k$ con cada método. (b) Compare los resultados y comente si son compatibles. (c) ¿Por qué conviene cronometrar 10 oscilaciones y no una sola? (d) Mencione una suposición del modelo que podría explicar una diferencia entre ambos métodos. Explique cada paso.`,
      format: 'open',
    },
  ],
};
