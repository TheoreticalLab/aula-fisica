import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'potencia',
  title: 'Potencia y eficiencia',
  summary:
    'La potencia mide la rapidez con que se realiza trabajo o se transfiere energía. Se mide en watts; el kilovatio-hora es una unidad de energía. La eficiencia compara la potencia útil con la consumida.',
  concepts: [
    { slug: 'potencia-media', name: 'Potencia media: P = W/Δt' },
    { slug: 'potencia-fuerza-velocidad', name: 'Potencia y velocidad: P = F·v' },
    { slug: 'potencia-kwh', name: 'El kilovatio-hora como unidad de energía' },
    { slug: 'potencia-eficiencia', name: 'Eficiencia de una máquina' },
  ],
  theory: String.raw`## No solo cuánto, sino qué tan rápido

Dos estudiantes de la misma masa suben las escaleras hasta el tercer piso: uno caminando y otro corriendo. Ambos ganan la misma energía potencial y, por tanto, sus músculos realizan el mismo trabajo. Sin embargo, el que corre termina más agitado. La diferencia está en la **rapidez** con que se realiza el trabajo, y esa magnitud se llama **potencia**.

La **potencia media** es el trabajo realizado (o la energía transferida) dividido por el tiempo empleado:

$$P = \frac{W}{\Delta t}.$$

Su unidad SI es el **watt**: $1\,\mathrm{W} = 1\,\mathrm{J/s}$. Algunas referencias:

- Un bombillo LED: unos $10\,\mathrm{W}$.
- Una persona que sube escaleras a buen ritmo: unos $200$–$400\,\mathrm{W}$ de potencia mecánica.
- Un aire acondicionado doméstico: $1$–$2\,\mathrm{kW}$.
- El motor de un carro compacto: unos $70$–$100\,\mathrm{kW}$.

En los motores todavía se usa el **caballo de fuerza**, $1\,\mathrm{hp} \approx 746\,\mathrm{W}$.

## Potencia, fuerza y velocidad

Si una fuerza constante $F$ empuja un cuerpo a lo largo de su movimiento y el cuerpo avanza una distancia $d$ en un tiempo $\Delta t$, entonces $P = F\,d/\Delta t$. Como $d/\Delta t$ es la velocidad media,

$$P = F\,v .$$

Si la fuerza forma un ángulo $\theta$ con la velocidad, solo cuenta la componente paralela: $P = F\,v\cos\theta$.

Esta relación explica por qué un carro necesita mucha más potencia para ir rápido. A velocidad constante, el motor debe compensar las fuerzas de resistencia (aire y rodadura); la potencia necesaria es esa fuerza por la velocidad. Y como la resistencia del aire también crece con la rapidez, la potencia crece todavía más deprisa. También explica por qué un camión cargado sube una cuesta lentamente: con la potencia máxima de su motor fija, una fuerza grande solo es posible a poca velocidad.

## El kilovatio-hora

Si se despeja la energía de la definición de potencia, $W = P\,\Delta t$. Cuando la potencia está en kilovatios y el tiempo en horas, la energía queda en **kilovatios-hora**:

$$1\,\mathrm{kW\cdot h} = (1000\,\mathrm{W})(3600\,\mathrm{s}) = 3.6\times10^{6}\,\mathrm{J}.$$

> **Cuidado.** El kilovatio-hora es una unidad de **energía**, no de potencia. La factura de la luz cobra energía consumida (kW·h); la potencia (kW) indica cuán rápido se consume.

Por ejemplo, un abanico de $60\,\mathrm{W}$ encendido $10\,\mathrm{h}$ consume $0.060\,\mathrm{kW} \times 10\,\mathrm{h} = 0.60\,\mathrm{kW\cdot h}$.

## Eficiencia

Ninguna máquina convierte toda la energía que recibe en trabajo útil. Un motor eléctrico se calienta, una bomba de agua tiene fricción interna, el motor de un carro expulsa gases calientes. La **eficiencia** (o rendimiento) es la fracción útil:

$$\eta = \frac{P_{útil}}{P_{consumida}} = \frac{W_{útil}}{E_{consumida}} .$$

Es adimensional y siempre está entre 0 y 1 (o entre 0 % y 100 %). Valores típicos: motor eléctrico, 80–95 %; motor de gasolina, 20–30 %; músculo humano, alrededor del 20 %. La energía que no se aprovecha no desaparece: se transforma, sobre todo, en energía térmica.

## Potencia y energía en la vida diaria

Conviene tener una idea de los órdenes de magnitud. Una persona adulta consume, en reposo, unos $100\,\mathrm{W}$: es la potencia con que su cuerpo transforma la energía química de los alimentos, y equivale a unas $2000$ kilocalorías diarias. Cuando hace ejercicio intenso puede llegar a consumir cerca de $1\,\mathrm{kW}$, pero solo una quinta parte se convierte en trabajo mecánico; el resto calienta el cuerpo, y por eso sudamos.

En casa, los aparatos que más energía consumen no son siempre los de mayor potencia, sino los que están encendidos más tiempo. Una plancha de $1.2\,\mathrm{kW}$ usada media hora gasta $0.6\,\mathrm{kW\cdot h}$; una nevera de $150\,\mathrm{W}$ cuyo compresor funciona unas $12\,\mathrm{h}$ al día gasta $1.8\,\mathrm{kW\cdot h}$ diarios, el triple. Para ahorrar electricidad hay que pensar en potencia **y** en tiempo de uso.

## Errores frecuentes

> **Error frecuente.** Confundir potencia con energía. Un motor «de 2 kW» no «tiene» 2 kW guardados: puede entregar 2000 J cada segundo.

> **Error frecuente.** Mezclar unidades: kW con segundos o W con horas. Use J, W y s, o bien kW·h, kW y h, pero de forma coherente.

> **Error frecuente.** Usar la potencia consumida en lugar de la útil (o al revés) al aplicar la eficiencia. La útil es siempre la **menor** de las dos.

## Límites del modelo

- $P = W/\Delta t$ es una potencia **media**. La potencia en un instante puede ser mayor o menor; $P = F\,v$ con la velocidad en ese instante da la potencia instantánea.
- Hemos supuesto fuerzas constantes y movimiento rectilíneo. En la práctica, motores y personas no entregan potencia constante.
- La eficiencia de una máquina depende de las condiciones de funcionamiento (carga, velocidad, temperatura); los valores que usamos son aproximados.`,
  formulas: [
    {
      name: 'Potencia media',
      latex: String.raw`P = \frac{W}{\Delta t}`,
      description: 'Trabajo realizado (o energía transferida) por unidad de tiempo.',
      variables: [
        { symbol: String.raw`P`, meaning: 'Potencia media', unit: 'W' },
        { symbol: String.raw`W`, meaning: 'Trabajo o energía transferida', unit: 'J' },
        { symbol: String.raw`\Delta t`, meaning: 'Intervalo de tiempo', unit: 's' },
      ],
    },
    {
      name: 'Potencia de una fuerza',
      latex: String.raw`P = F\,v\cos\theta`,
      description: 'Potencia que entrega una fuerza sobre un cuerpo que se mueve con velocidad v.',
      variables: [
        { symbol: String.raw`F`, meaning: 'Módulo de la fuerza', unit: 'N' },
        { symbol: String.raw`v`, meaning: 'Rapidez del cuerpo', unit: 'm/s' },
        { symbol: String.raw`\theta`, meaning: 'Ángulo entre la fuerza y la velocidad', unit: '°' },
      ],
    },
    {
      name: 'Kilovatio-hora',
      latex: String.raw`1\,\mathrm{kW\cdot h} = 3.6\times10^{6}\,\mathrm{J}`,
      description: 'Unidad práctica de energía eléctrica: la energía que entrega 1 kW durante 1 h.',
      variables: [
        { symbol: String.raw`\mathrm{kW\cdot h}`, meaning: 'Kilovatio-hora (unidad de energía)', unit: 'J' },
      ],
    },
    {
      name: 'Eficiencia',
      latex: String.raw`\eta = \frac{P_{útil}}{P_{consumida}}`,
      description: 'Fracción de la potencia consumida que se aprovecha como trabajo útil.',
      variables: [
        { symbol: String.raw`\eta`, meaning: 'Eficiencia', unit: '— (adimensional, 0 a 1)' },
        { symbol: String.raw`P_{útil}`, meaning: 'Potencia útil entregada', unit: 'W' },
        { symbol: String.raw`P_{consumida}`, meaning: 'Potencia consumida', unit: 'W' },
      ],
    },
  ],
  examples: [
    {
      title: 'Subir corriendo las escaleras',
      statement: String.raw`Una estudiante de $55\,\mathrm{kg}$ sube corriendo una escalera de $12\,\mathrm{m}$ de desnivel en $15\,\mathrm{s}$. ¿Qué potencia media desarrolla contra la gravedad?`,
      steps: [
        String.raw`Trabajo para subir (sin cambio de rapidez): $W = m g h = (55)(9.8)(12) = 6468\,\mathrm{J}$.`,
        String.raw`$P = W/\Delta t = 6468\,\mathrm{J} / 15\,\mathrm{s} = 431\,\mathrm{W}$.`,
      ],
      result: String.raw`$P \approx 4.3\times10^{2}\,\mathrm{W}$, algo más de medio caballo de fuerza.`,
      interpretation: 'Caminando en 45 s, el trabajo sería el mismo y la potencia, un tercio. Con una eficiencia muscular del 20 %, su cuerpo consume unos 2 kW mientras corre.',
    },
    {
      title: 'Potencia para mantener la velocidad',
      statement: String.raw`Un carro circula a $108\,\mathrm{km/h}$ constantes por una autopista horizontal. Las fuerzas de resistencia (aire y rodadura) suman $750\,\mathrm{N}$. ¿Qué potencia debe entregar el motor a las ruedas?`,
      steps: [
        String.raw`$v = 108/3.6 = 30\,\mathrm{m/s}$.`,
        String.raw`A velocidad constante, la fuerza de tracción iguala a la resistencia: $F = 750\,\mathrm{N}$.`,
        String.raw`$P = F\,v = (750\,\mathrm{N})(30\,\mathrm{m/s}) = 22\,500\,\mathrm{W}$.`,
      ],
      result: String.raw`$P = 22.5\,\mathrm{kW}$ (unos $30\,\mathrm{hp}$).`,
      interpretation: 'Es solo una parte de la potencia máxima de un motor típico; el resto queda disponible para acelerar o subir cuestas.',
    },
    {
      title: 'Consumo de un aire acondicionado',
      statement: String.raw`Un aire acondicionado de $1.5\,\mathrm{kW}$ funciona $6.0\,\mathrm{h}$ cada noche. ¿Cuánta energía consume en un mes de $30$ días, en kW·h y en joules?`,
      steps: [
        String.raw`Por noche: $E = P\,\Delta t = (1.5\,\mathrm{kW})(6.0\,\mathrm{h}) = 9.0\,\mathrm{kW\cdot h}$.`,
        String.raw`En el mes: $30 \times 9.0 = 270\,\mathrm{kW\cdot h}$.`,
        String.raw`En joules: $270 \times 3.6\times10^{6}\,\mathrm{J} = 9.72\times10^{8}\,\mathrm{J}$.`,
      ],
      result: String.raw`$270\,\mathrm{kW\cdot h} \approx 9.7\times10^{8}\,\mathrm{J}$.`,
      interpretation: 'El kilovatio-hora es mucho más cómodo para la energía doméstica que el joule, que resulta una unidad muy pequeña.',
    },
  ],
  simulation: null,
  exercises: [
    {
      id: 'b4-pot-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['potencia-media'],
      prompt: String.raw`En una obra, un malacate eléctrico sube un palé de bloques de $200\,\mathrm{kg}$ a velocidad constante hasta una altura de $15\,\mathrm{m}$ en $30\,\mathrm{s}$. ¿Qué potencia media entrega el malacate a la carga?`,
      format: 'numeric',
      unitHint: 'W',
    },
    {
      id: 'b4-pot-02',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['potencia-kwh'],
      prompt: String.raw`Un aire acondicionado de $1.2\,\mathrm{kW}$ funciona $8.0$ horas diarias durante un mes de $30$ días. ¿Cuánta energía consume en el mes? Exprese el resultado en kilovatios-hora.`,
      format: 'numeric',
      unitHint: 'kW·h',
    },
    {
      id: 'b4-pot-03',
      category: 'seleccion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['potencia-media'],
      prompt: String.raw`Dos hermanos de la misma masa suben la misma escalera. Pedro tarda $40\,\mathrm{s}$ y María, $20\,\mathrm{s}$. ¿Qué afirmación es correcta?`,
      format: 'choice',
      options: [
        'María realiza el doble de trabajo que Pedro.',
        'Ambos realizan el mismo trabajo, y María desarrolla el doble de potencia.',
        'Ambos desarrollan la misma potencia, porque suben la misma altura.',
        'Pedro desarrolla más potencia, porque está más tiempo haciendo fuerza.',
      ],
    },
    {
      id: 'b4-pot-04',
      category: 'numerica',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['potencia-fuerza-velocidad'],
      prompt: String.raw`Una guagua de $8000\,\mathrm{kg}$ sube una cuesta recta inclinada $5.0^\circ$ con una rapidez constante de $12\,\mathrm{m/s}$. Despreciando la fricción y la resistencia del aire, ¿qué potencia debe entregar el motor para vencer la componente del peso a lo largo de la cuesta?`,
      format: 'numeric',
      unitHint: 'W',
    },
    {
      id: 'b4-pot-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['potencia-eficiencia', 'potencia-media'],
      prompt: String.raw`Una bomba eléctrica consume $750\,\mathrm{W}$ y tiene una eficiencia del $60\,\%$. Se usa para subir agua desde la cisterna hasta un tinaco situado $12\,\mathrm{m}$ más arriba. ¿Cuántos litros de agua sube por minuto? (Un litro de agua tiene una masa de $1.0\,\mathrm{kg}$; desprecie la energía cinética del agua.)`,
      format: 'numeric',
      unitHint: 'L/min',
    },
    {
      id: 'b4-pot-06',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['potencia-kwh'],
      prompt: String.raw`**Verdadero o falso:** el kilovatio-hora (kW·h) que aparece en la factura de electricidad es una unidad de potencia. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b4-pot-07',
      category: 'error',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['potencia-eficiencia', 'potencia-media'],
      prompt: String.raw`Un estudiante resolvió así este problema: *«Un montacargas con motor de $2.0\,\mathrm{kW}$ de potencia consumida y eficiencia de $75\,\%$ sube $300\,\mathrm{kg}$ a una altura de $10\,\mathrm{m}$. ¿Cuánto tarda?»*

1. Trabajo útil: $W = m g h = (300)(9.8)(10) = 29\,400\,\mathrm{J}$.
2. Potencia útil: $P_{útil} = \eta\,P_{consumida} = 0.75 \times 2000 = 1500\,\mathrm{W}$.
3. Tiempo: $\Delta t = W / P_{consumida} = 29\,400 / 2000 = 14.7\,\mathrm{s}$.
4. El montacargas tarda $14.7\,\mathrm{s}$.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'No hay ningún error'],
    },
    {
      id: 'b4-pot-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['potencia-fuerza-velocidad', 'potencia-eficiencia', 'potencia-kwh'],
      prompt: String.raw`Un ascensor de $800\,\mathrm{kg}$ (cabina y pasajeros) sube con rapidez constante de $1.5\,\mathrm{m/s}$. Su motor eléctrico tiene una eficiencia del $80\,\%$.

(a) Calcule la tensión del cable y la potencia útil que entrega el motor.
(b) Calcule la potencia eléctrica que consume.
(c) Si el ascensor sube $30\,\mathrm{m}$, ¿cuánta energía eléctrica consume? Exprésela en joules y en kW·h.
(d) ¿Adónde va la energía que no se aprovecha? ¿Qué ocurre con la energía potencial cuando el ascensor baja?`,
      format: 'open',
    },
  ],
};
