import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'concepto-fuerza',
  title: 'El concepto de fuerza',
  summary:
    'Una fuerza es la medida de una interacción entre dos cuerpos. Es un vector, se mide en newtons y, cuando actúan varias, su efecto conjunto es la fuerza neta: su suma vectorial.',
  concepts: [
    { slug: 'fuer-interaccion', name: 'La fuerza como interacción entre dos cuerpos' },
    { slug: 'fuer-vector-newton', name: 'Carácter vectorial de la fuerza y el newton' },
    { slug: 'fuer-contacto-distancia', name: 'Fuerzas de contacto y fuerzas a distancia' },
    { slug: 'fuer-fuerza-neta', name: 'Fuerza neta como suma vectorial' },
  ],
  theory: String.raw`## ¿Qué es una fuerza?

En el lenguaje diario, una fuerza es un empujón o un tirón. La física precisa esa idea: **una fuerza es la medida de una interacción entre dos cuerpos**. Siempre hay dos participantes: el cuerpo que *ejerce* la fuerza (el agente) y el cuerpo que la *recibe*. Cuando un bateador golpea la pelota, el bate ejerce una fuerza sobre la pelota; cuando usted empuja una puerta, su mano ejerce una fuerza sobre la puerta; cuando una fruta cae del árbol, la Tierra ejerce una fuerza sobre la fruta.

Por eso conviene nombrar cada fuerza por sus dos participantes: «la fuerza **del bate sobre la pelota**», «la fuerza **de la Tierra sobre el mango**». Si no puede decir quién ejerce una fuerza, probablemente esa fuerza no existe.

Una fuerza puede producir dos tipos de efectos:

- **Cambiar la velocidad** del cuerpo: ponerlo en marcha, frenarlo o desviarlo (cambiar la dirección de su velocidad también es un cambio de velocidad).
- **Deformarlo**: estirar un resorte, abollar una lata, aplastar una pelota de playa.

> **Error frecuente.** «La pelota sigue subiendo porque lleva dentro la fuerza del bate». Un cuerpo no *posee* fuerzas ni las almacena. La fuerza del bate existe solo mientras el bate y la pelota están en contacto (unas milésimas de segundo). Después, sobre la pelota actúan solo el peso y la resistencia del aire.

## Una fuerza es un vector

Empujar una caja con $50\,\mathrm{N}$ hacia el este no produce el mismo efecto que empujarla con $50\,\mathrm{N}$ hacia el norte. Para describir una fuerza hay que dar su **magnitud** (cuánto empuja o tira), su **dirección** y su **sentido**. La fuerza es, por tanto, una **magnitud vectorial** y se representa con una flecha: $\vec F$. Su magnitud se escribe $F$ (sin flecha) y es siempre positiva.

En problemas de una dimensión basta con un eje y un signo: $F = +30\,\mathrm{N}$ significa 30 N en el sentido positivo del eje, y $F = -30\,\mathrm{N}$, 30 N en el sentido opuesto. El signo indica el sentido, no que la fuerza sea «menor que cero».

Cuando el cuerpo puede girar o deformarse, también importa el **punto de aplicación** (no es lo mismo empujar una puerta cerca de las bisagras que cerca del pomo). En este bloque trataremos los cuerpos como **partículas**: todas las fuerzas actúan sobre un mismo punto y solo nos interesa el movimiento de traslación.

## La unidad: el newton

La unidad de fuerza del SI es el **newton** (N). Como verá en la lección de la segunda ley, un newton es la fuerza neta que comunica a una masa de $1\,\mathrm{kg}$ una aceleración de $1\,\mathrm{m/s^2}$:

$$1\,\mathrm{N} = 1\,\mathrm{kg\cdot m/s^2}.$$

Algunos órdenes de magnitud para tener referencias:

- La Tierra atrae a una manzana de unos $100\,\mathrm{g}$ con aproximadamente $1\,\mathrm{N}$.
- Para abrir una puerta se empuja con unas decenas de newtons.
- La Tierra atrae a una persona de $70\,\mathrm{kg}$ con unos $690\,\mathrm{N}$.
- El motor de una guagua impulsa el vehículo con varios miles de newtons.

Las fuerzas se miden con un **dinamómetro**: un resorte cuyo alargamiento es proporcional a la fuerza que tira de él.

## Fuerzas de contacto y fuerzas a distancia

Una clasificación útil distingue dos grupos:

- **Fuerzas de contacto**: solo existen mientras los cuerpos se tocan. Ejemplos: el empuje de una mano, la fuerza que el piso ejerce hacia arriba sobre sus pies (*normal*), el roce que se opone al deslizamiento (*fricción*), el tirón de una cuerda (*tensión*), el empuje del agua sobre un bote y la resistencia del aire.
- **Fuerzas a distancia**: actúan sin contacto, a través del espacio vacío. Ejemplos: la atracción gravitatoria (el **peso** es la fuerza gravitatoria que la Tierra ejerce sobre un cuerpo), la fuerza entre cargas eléctricas y la fuerza de un imán sobre un clip.

A escala atómica, todas las fuerzas de contacto son en realidad fuerzas eléctricas entre los átomos de las superficies que se «tocan». La clasificación es macroscópica, pero resulta muy práctica para identificar fuerzas: **todo lo que toca al cuerpo puede ejercer una fuerza de contacto, y a distancia solo actúan la gravedad y las fuerzas eléctricas y magnéticas**. Las fuerzas normal, de fricción y de tensión se estudian en detalle en lecciones posteriores de este bloque.

## Fuerza neta: la suma vectorial

Casi siempre actúan varias fuerzas a la vez sobre un cuerpo. El movimiento del cuerpo responde a su efecto conjunto, la **fuerza neta** (o resultante), que es la **suma vectorial** de todas las fuerzas que actúan **sobre ese cuerpo**:

$$\vec F_{\text{neta}} = \vec F_1 + \vec F_2 + \vec F_3 + \text{...}$$

En una dimensión, la suma se hace con signos. En el juego de la cuerda, si un equipo tira con $600\,\mathrm{N}$ hacia la derecha ($+$) y el otro con $550\,\mathrm{N}$ hacia la izquierda ($-$), la fuerza neta sobre la cuerda es $+600 - 550 = +50\,\mathrm{N}$, es decir, $50\,\mathrm{N}$ hacia la derecha.

En el plano, la forma segura de sumar es **por componentes**:

1. Elija ejes $x$ e $y$ y descomponga cada fuerza: $F_x = F\cos\theta$, $F_y = F\sin\theta$, con $\theta$ medido en sentido antihorario desde el eje $+x$.
2. Sume por separado las componentes $x$ y las componentes $y$ de todas las fuerzas.
3. Recomponga: $F_{\text{neta}} = \sqrt{F_{\text{neta},x}^2 + F_{\text{neta},y}^2}$ y $\tan\theta = F_{\text{neta},y}/F_{\text{neta},x}$.

> **Cuidado.** La calculadora devuelve para $\tan^{-1}$ un ángulo entre $-90^\circ$ y $90^\circ$. Si $F_{\text{neta},x} < 0$, la dirección real está en el segundo o en el tercer cuadrante: sume $180^\circ$ al resultado. Haga siempre un esquema para comprobar el cuadrante.

> **Error frecuente.** Sumar magnitudes: «30 N más 40 N son 70 N». Eso solo es cierto si las dos fuerzas tienen la misma dirección y el mismo sentido. Si son opuestas, la neta es de 10 N; si son perpendiculares, de 50 N. En general, la magnitud de la suma de dos fuerzas está entre la diferencia y la suma de sus magnitudes: $|F_1 - F_2| \le F_{\text{neta}} \le F_1 + F_2$.

Solo se suman fuerzas que actúan **sobre el mismo cuerpo**. Sumar la fuerza que usted ejerce sobre una caja con la que la caja ejerce sobre usted no tiene sentido físico: actúan sobre cuerpos distintos.

## Límites del modelo

Tratar el cuerpo como partícula impide estudiar giros y vuelcos. Además, cuando decimos «la mano empuja con 40 N» resumimos en una sola flecha una fuerza que en realidad se reparte sobre toda la zona de contacto. Para el movimiento de traslación de un cuerpo pequeño o rígido, esta simplificación funciona muy bien.`,
  formulas: [
    {
      name: 'Componentes de una fuerza',
      latex: String.raw`F_x = F\cos\theta, \qquad F_y = F\sin\theta`,
      description: 'Proyecciones de una fuerza sobre los ejes cuando se conoce su magnitud y su dirección.',
      variables: [
        { symbol: String.raw`F`, meaning: 'Magnitud de la fuerza (positiva)', unit: 'N' },
        { symbol: String.raw`\theta`, meaning: 'Ángulo medido en sentido antihorario desde el eje +x', unit: '°' },
        { symbol: String.raw`F_x,\,F_y`, meaning: 'Componentes de la fuerza (con signo)', unit: 'N' },
      ],
      notes: 'Las componentes llevan signo: una fuerza que apunta hacia −x tiene F_x negativa.',
    },
    {
      name: 'Fuerza neta por componentes',
      latex: String.raw`F_{\text{neta},x} = F_{1x} + F_{2x} + F_{3x} + \text{...}, \qquad F_{\text{neta},y} = F_{1y} + F_{2y} + F_{3y} + \text{...}`,
      description: 'La componente x de la fuerza neta es la suma (con signos) de las componentes x de todas las fuerzas que actúan sobre el cuerpo; igual para y.',
      variables: [
        { symbol: String.raw`F_{1x},\,F_{1y}`, meaning: 'Componentes de la fuerza 1 (y así para las demás)', unit: 'N' },
        { symbol: String.raw`F_{\text{neta},x},\,F_{\text{neta},y}`, meaning: 'Componentes de la fuerza neta', unit: 'N' },
      ],
      notes: 'Solo se suman fuerzas que actúan sobre el mismo cuerpo.',
    },
    {
      name: 'Magnitud y dirección de la fuerza neta',
      latex: String.raw`F_{\text{neta}} = \sqrt{F_{\text{neta},x}^2 + F_{\text{neta},y}^2}, \qquad \tan\theta = \frac{F_{\text{neta},y}}{F_{\text{neta},x}}`,
      description: 'Reconstruye el vector fuerza neta a partir de sus componentes.',
      variables: [
        { symbol: String.raw`F_{\text{neta}}`, meaning: 'Magnitud de la fuerza neta', unit: 'N' },
        { symbol: String.raw`\theta`, meaning: 'Dirección de la fuerza neta, desde el eje +x', unit: '°' },
      ],
      notes: 'Si la componente x es negativa, sume 180° al ángulo que da la calculadora.',
    },
    {
      name: 'Definición del newton',
      latex: String.raw`1\,\mathrm{N} = 1\,\mathrm{kg\cdot m/s^2}`,
      description: 'Fuerza neta que comunica a 1 kg una aceleración de 1 m/s² (se justifica con la segunda ley de Newton).',
      variables: [
        { symbol: String.raw`\mathrm{N}`, meaning: 'Newton, unidad SI de fuerza', unit: 'N' },
        { symbol: String.raw`\mathrm{kg\cdot m/s^2}`, meaning: 'Unidades básicas equivalentes', unit: 'kg·m/s²' },
      ],
    },
  ],
  examples: [
    {
      title: 'Juego de la cuerda en la playa',
      statement: String.raw`En un juego de la cuerda, dos personas tiran hacia la izquierda con $320\,\mathrm{N}$ y $290\,\mathrm{N}$, y otras dos tiran hacia la derecha con $350\,\mathrm{N}$ y $240\,\mathrm{N}$. Todas las fuerzas son horizontales. ¿Cuál es la fuerza neta sobre la cuerda?`,
      steps: [
        String.raw`Eje $x$ horizontal con sentido positivo hacia la derecha. Las fuerzas hacia la izquierda llevan signo negativo.`,
        String.raw`Suma con signos: $F_{\text{neta}} = (+350\,\mathrm{N}) + (+240\,\mathrm{N}) + (-320\,\mathrm{N}) + (-290\,\mathrm{N})$.`,
        String.raw`$F_{\text{neta}} = 590\,\mathrm{N} - 610\,\mathrm{N} = -20\,\mathrm{N}$.`,
      ],
      result: String.raw`$F_{\text{neta}} = -20\,\mathrm{N}$: $20\,\mathrm{N}$ hacia la izquierda.`,
      interpretation:
        'Aunque sobre la cuerda actúan 1200 N «en total», casi todo se compensa: lo que decide hacia dónde cambia su velocidad es una neta de solo 20 N. Sumar las magnitudes no tiene ningún significado físico aquí.',
    },
    {
      title: 'Dos pescadores arrastran una yola',
      statement: String.raw`Dos pescadores arrastran una yola por la arena con cuerdas horizontales. Uno tira con $300\,\mathrm{N}$ a $20^\circ$ y el otro con $250\,\mathrm{N}$ a $-35^\circ$, ambos ángulos medidos desde el eje $+x$ (que apunta hacia el mar). Calcule la magnitud y la dirección de la fuerza neta que ejercen las dos cuerdas.`,
      steps: [
        String.raw`Componentes de la fuerza 1: $F_{1x} = 300\cos 20^\circ = 281.9\,\mathrm{N}$; $F_{1y} = 300\sin 20^\circ = 102.6\,\mathrm{N}$.`,
        String.raw`Componentes de la fuerza 2: $F_{2x} = 250\cos(-35^\circ) = 204.8\,\mathrm{N}$; $F_{2y} = 250\sin(-35^\circ) = -143.4\,\mathrm{N}$.`,
        String.raw`Suma por ejes: $F_{\text{neta},x} = 281.9 + 204.8 = 486.7\,\mathrm{N}$; $F_{\text{neta},y} = 102.6 - 143.4 = -40.8\,\mathrm{N}$.`,
        String.raw`Magnitud: $F_{\text{neta}} = \sqrt{486.7^2 + (-40.8)^2} = 488.4\,\mathrm{N}$.`,
        String.raw`Dirección: $\tan\theta = \dfrac{-40.8}{486.7} \Rightarrow \theta = -4.8^\circ$. Como la componente x es positiva, el ángulo de la calculadora es el correcto.`,
      ],
      result: String.raw`$F_{\text{neta}} \approx 488\,\mathrm{N}$ dirigida a $4.8^\circ$ por debajo del eje $+x$.`,
      interpretation:
        'La neta (488 N) es menor que la suma de magnitudes (550 N) porque las cuerdas no son paralelas: sus componentes y se compensan casi por completo. Su dirección queda más cerca de la del tirón más fuerte, como cabe esperar.',
    },
    {
      title: 'La fuerza que equilibra a otras dos',
      statement: String.raw`Sobre una argolla actúan dos cuerdas: una tira con $50\,\mathrm{N}$ hacia $+x$ y otra con $80\,\mathrm{N}$ hacia $+y$. ¿Qué tercera fuerza hay que aplicar para que la fuerza neta sobre la argolla sea cero?`,
      steps: [
        String.raw`Suma de las dos fuerzas conocidas: componentes $(50\,\mathrm{N},\,80\,\mathrm{N})$.`,
        String.raw`Para que la neta sea cero, la tercera fuerza debe tener las componentes opuestas: $F_{3x} = -50\,\mathrm{N}$, $F_{3y} = -80\,\mathrm{N}$.`,
        String.raw`Magnitud: $F_3 = \sqrt{50^2 + 80^2} = 94.3\,\mathrm{N}$.`,
        String.raw`Dirección: $\tan^{-1}\left( \dfrac{-80}{-50} \right) = 58.0^\circ$ según la calculadora, pero el vector está en el tercer cuadrante (ambas componentes negativas): $\theta = 58.0^\circ + 180^\circ = 238.0^\circ$, equivalente a $-122.0^\circ$.`,
      ],
      result: String.raw`$F_3 = 94.3\,\mathrm{N}$ a $238^\circ$ (o $-122^\circ$) desde el eje $+x$.`,
      interpretation:
        'La fuerza que equilibra a un grupo de fuerzas tiene la misma magnitud que su resultante y sentido contrario. El ángulo de 58° que da directamente la calculadora apuntaría justo al revés: por eso hay que comprobar siempre el cuadrante.',
    },
  ],
  simulation: {
    key: 'vectores',
    params: { aMag: 6, aAng: 0, bMag: 8, bAng: 90 },
    guide: String.raw`En esta actividad, interprete los vectores **A** y **B** como dos fuerzas que actúan sobre el mismo cuerpo, con $1\,\mathrm{u} = 1\,\mathrm{N}$. El vector **R** es la fuerza neta.

1. Con los valores iniciales ($6\,\mathrm{N}$ a $0^\circ$ y $8\,\mathrm{N}$ a $90^\circ$), lea $R$ y su ángulo. Compruebe con $\sqrt{6^2 + 8^2}$ y $\tan^{-1}(8/6)$.
2. Cambie la dirección de B a $0^\circ$ y luego a $180^\circ$. Anote $R$ en cada caso: son la neta máxima y la mínima posibles con esas dos magnitudes.
3. Mueva poco a poco la dirección de B entre $0^\circ$ y $180^\circ$ y observe cómo $R$ disminuye de forma continua. ¿Para qué ángulo entre A y B, aproximadamente, la neta vale $12\,\mathrm{N}$?
4. Ponga dos fuerzas de igual magnitud, $5\,\mathrm{N}$, a $30^\circ$ y $-150^\circ$. ¿Cuánto vale la neta? ¿Qué significa físicamente?
5. Elija dos fuerzas cualesquiera, calcule usted $R_x$, $R_y$, $R$ y su ángulo por componentes, y solo después compare con las lecturas del simulador.`,
  },
  exercises: [
    {
      id: 'b3-fuer-01',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['fuer-contacto-distancia'],
      prompt: '¿Cuál de las siguientes es una fuerza **a distancia**?',
      format: 'choice',
      options: [
        'La fuerza que una cuerda tensa ejerce sobre un balde.',
        'La fuerza con que un imán atrae un clip que está a 2 cm de él.',
        'La fuerza que el agua del mar ejerce hacia arriba sobre un bote.',
        'La fuerza de rozamiento del asfalto sobre los neumáticos de un motoconcho.',
      ],
    },
    {
      id: 'b3-fuer-02',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['fuer-fuerza-neta'],
      prompt: String.raw`Una guagua se queda sin batería en una calle horizontal. Dos personas la empujan hacia adelante con fuerzas horizontales de $350\,\mathrm{N}$ y $420\,\mathrm{N}$, mientras el suelo y el aire ejercen en conjunto $500\,\mathrm{N}$ horizontales hacia atrás. ¿Cuál es la magnitud de la fuerza neta horizontal sobre la guagua?`,
      format: 'numeric',
      unitHint: 'N',
    },
    {
      id: 'b3-fuer-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['fuer-fuerza-neta', 'fuer-vector-newton'],
      prompt: String.raw`**Verdadero o falso:** si sobre un cuerpo actúan únicamente dos fuerzas, de $30\,\mathrm{N}$ y $40\,\mathrm{N}$, la fuerza neta sobre él vale $70\,\mathrm{N}$. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b3-fuer-04',
      category: 'experimento',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['fuer-fuerza-neta', 'vec-suma'],
      prompt: String.raw`En el simulador, interprete A y B como dos fuerzas sobre una argolla ($1\,\mathrm{u} = 1\,\mathrm{N}$). Fije $A = 6\,\mathrm{N}$ a $0^\circ$ y $B = 8\,\mathrm{N}$ a $120^\circ$, y lea la fuerza neta. Se quiere añadir una **tercera** fuerza para que la argolla quede con fuerza neta cero. ¿Qué magnitud debe tener esa tercera fuerza?`,
      format: 'numeric',
      unitHint: 'N',
      simulation: { key: 'vectores', params: { aMag: 6, aAng: 0, bMag: 8, bAng: 120 } },
    },
    {
      id: 'b3-fuer-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['fuer-fuerza-neta', 'vec-componentes'],
      prompt: String.raw`Tres cuerdas tiran de una argolla en un plano horizontal: $F_1 = 50\,\mathrm{N}$ a $30^\circ$, $F_2 = 70\,\mathrm{N}$ a $150^\circ$ y $F_3 = 30\,\mathrm{N}$ a $-90^\circ$ (ángulos medidos en sentido antihorario desde el eje $+x$). Determine la **dirección** de la fuerza neta, expresada como un ángulo entre $-180^\circ$ y $180^\circ$ medido desde el eje $+x$.`,
      format: 'numeric',
      unitHint: '°',
    },
    {
      id: 'b3-fuer-06',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['fuer-fuerza-neta'],
      prompt: String.raw`Sobre un carrito actúan solo dos fuerzas, de $6\,\mathrm{N}$ y $8\,\mathrm{N}$, cuyas direcciones no se conocen. ¿Cuál de estos valores **no** puede tener la magnitud de la fuerza neta?`,
      format: 'choice',
      options: ['2 N', '7 N', '10 N', '14 N', '15 N'],
    },
    {
      id: 'b3-fuer-07',
      category: 'numerica',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['fuer-fuerza-neta', 'vec-componentes'],
      prompt: String.raw`Dos perros tiran de un mismo juguete con fuerzas horizontales de $9.0\,\mathrm{N}$ cada uno. Las cuerdas forman entre sí un ángulo de $60^\circ$. ¿Cuál es la magnitud de la fuerza neta que ejercen sobre el juguete?`,
      format: 'numeric',
      unitHint: 'N',
    },
    {
      id: 'b3-fuer-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['fuer-interaccion', 'fuer-contacto-distancia', 'fuer-fuerza-neta'],
      prompt: String.raw`Una chichigua (cometa) permanece quieta en el aire, sostenida por su hilo en un día de brisa. (a) Enumere todas las fuerzas que actúan sobre la chichigua; para cada una indique qué cuerpo la ejerce y si es de contacto o a distancia. (b) Como la chichigua permanece quieta, la fuerza neta sobre ella es cero (lo justificaremos con la primera ley de Newton). Explique qué condición deben cumplir entonces las componentes de las fuerzas. (c) El peso de la chichigua es $1.5\,\mathrm{N}$ (vertical hacia abajo) y el hilo tira de ella con $4.0\,\mathrm{N}$ en una dirección que forma $240^\circ$ con el eje $+x$ horizontal (hacia abajo y hacia atrás). Calcule la magnitud y la dirección de la fuerza que debe ejercer el aire. (d) Comente si el resultado es razonable.`,
      format: 'open',
    },
  ],
};
