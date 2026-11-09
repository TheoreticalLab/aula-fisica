import type { LessonDef } from '../tipos';

export const leccion: LessonDef = {
  slug: 'colisiones',
  title: 'Colisiones en una dimensión',
  summary:
    'En todo choque entre dos cuerpos aislados se conserva la cantidad de movimiento; la energía cinética solo se conserva en los choques elásticos. El coeficiente de restitución clasifica los choques entre elásticos (e = 1) y perfectamente inelásticos (e = 0).',
  concepts: [
    { slug: 'colisiones-tipos', name: 'Choques elásticos, inelásticos y perfectamente inelásticos' },
    { slug: 'colisiones-perfectamente-inelastica', name: 'Choque perfectamente inelástico: los cuerpos quedan unidos' },
    { slug: 'colisiones-energia-perdida', name: 'Energía cinética transformada en un choque' },
    { slug: 'colisiones-restitucion', name: 'Coeficiente de restitución' },
  ],
  theory: String.raw`## Qué sabemos de un choque

En un choque, dos cuerpos interactúan durante un tiempo muy breve con fuerzas muy grandes. No necesitamos conocer esas fuerzas: como son **internas** al sistema formado por los dos cuerpos, y las externas (fricción, peso) son despreciables durante el instante del choque, la **cantidad de movimiento total se conserva**:

$$m_1 v_1 + m_2 v_2 = m_1 v_1' + m_2 v_2' .$$

Aquí $v_1, v_2$ son las velocidades justo antes del choque y $v_1', v_2'$ justo después, todas **con signo** sobre un mismo eje. Esta ecuación vale para cualquier choque: entre bolas de billar, entre carros, entre una pelota y un bate.

Pero es una sola ecuación, y en general hay dos incógnitas (las dos velocidades finales). Hace falta otra condición, que depende de **qué pasa con la energía cinética**.

## Tipos de choque

- **Elástico.** La energía cinética total también se conserva. Los cuerpos rebotan sin deformarse permanentemente ni calentarse. Las bolas de billar y los carros de laboratorio con imanes se aproximan mucho a este caso.
- **Inelástico.** Se conserva la cantidad de movimiento, pero parte de la energía cinética se transforma en energía térmica, sonido y deformación. Es el caso más común: una pelota de béisbol contra el bate, dos carros que chocan y se separan.
- **Perfectamente inelástico.** Los cuerpos **quedan unidos** y se mueven juntos después del choque. Es el caso en que se pierde la máxima energía cinética compatible con la conservación de la cantidad de movimiento.

> **Cuidado.** En un choque perfectamente inelástico **no** se pierde, en general, toda la energía cinética: los cuerpos unidos siguen moviéndose con la velocidad que exige la conservación de $p$. Solo si la cantidad de movimiento total es cero quedan en reposo.

## Choque perfectamente inelástico

Si los cuerpos quedan unidos, $v_1' = v_2' = v'$ y la conservación da directamente

$$v' = \frac{m_1 v_1 + m_2 v_2}{m_1 + m_2} .$$

La energía cinética transformada se calcula restando: $K_{perdida} = K_{antes} - K_{después}$.

## El coeficiente de restitución

Para describir cualquier choque intermedio se usa el **coeficiente de restitución**, que compara la rapidez con que los cuerpos se separan después del choque con la rapidez con que se acercaban antes:

$$e = -\frac{v_2' - v_1'}{v_2 - v_1} = \frac{\text{rapidez de separación}}{\text{rapidez de acercamiento}} .$$

- $e = 1$: choque **elástico** (se separan tan rápido como se acercaban).
- $0 < e < 1$: choque **inelástico**.
- $e = 0$: choque **perfectamente inelástico** (no se separan).

Para una pelota que rebota en el suelo, que no se mueve, $e = v'/v$, y como la rapidez al llegar es $\sqrt{2 g h_1}$ y al salir $\sqrt{2 g h_2}$,

$$e = \sqrt{\frac{h_2}{h_1}} .$$

Una pelota de baloncesto bien inflada tiene $e \approx 0.8$; una de plastilina, casi $0$.

## Choque elástico con un blanco en reposo

Si el cuerpo 1 choca elásticamente con el cuerpo 2 en reposo, resolviendo la conservación de $p$ junto con $e = 1$ se obtiene

$$v_1' = \frac{m_1 - m_2}{m_1 + m_2}\,v_1, \qquad v_2' = \frac{2 m_1}{m_1 + m_2}\,v_1 .$$

Tres casos que conviene recordar:

- **Masas iguales:** $v_1' = 0$ y $v_2' = v_1$. Los cuerpos intercambian sus velocidades, como en una carambola directa de billar.
- **Proyectil ligero contra blanco pesado** ($m_1 \ll m_2$): $v_1' \approx -v_1$. Rebota casi con la misma rapidez, como una pelota contra una pared.
- **Proyectil pesado contra blanco ligero** ($m_1 \gg m_2$): el proyectil casi no se frena y el blanco sale con casi el doble de su velocidad.

## Errores frecuentes

> **Error frecuente.** Olvidar los signos. Si un cuerpo se mueve hacia la izquierda, su velocidad es negativa en la ecuación de conservación.

> **Error frecuente.** Promediar las velocidades en un choque perfectamente inelástico. La velocidad común es un promedio **ponderado por las masas**, no un promedio simple.

> **Error frecuente.** Suponer que la energía cinética se conserva en todo choque. Solo ocurre si es elástico.

## Límites del modelo

- Suponemos un choque instantáneo y frontal: los cuerpos se mueven sobre la misma recta antes y después. Los choques oblicuos requieren tratar las componentes $x$ e $y$ por separado.
- Si hay fricción, la conservación de $p$ vale solo **justo antes y justo después** del choque; después, la fricción frena a los cuerpos.
- El coeficiente de restitución depende de los materiales y también, algo, de la rapidez del impacto.`,
  formulas: [
    {
      name: 'Conservación de la cantidad de movimiento en un choque',
      latex: String.raw`m_1 v_1 + m_2 v_2 = m_1 v_1' + m_2 v_2'`,
      description: 'Vale en todo choque entre dos cuerpos cuando las fuerzas externas son despreciables durante el choque.',
      variables: [
        { symbol: String.raw`v_1,\,v_2`, meaning: 'Velocidades justo antes del choque (con signo)', unit: 'm/s' },
        { symbol: String.raw`v_1',\,v_2'`, meaning: 'Velocidades justo después del choque (con signo)', unit: 'm/s' },
      ],
    },
    {
      name: 'Choque perfectamente inelástico',
      latex: String.raw`v' = \frac{m_1 v_1 + m_2 v_2}{m_1 + m_2}`,
      description: 'Velocidad común de dos cuerpos que quedan unidos tras el choque.',
      variables: [
        { symbol: String.raw`v'`, meaning: 'Velocidad del conjunto después del choque', unit: 'm/s' },
        { symbol: String.raw`m_1,\,m_2`, meaning: 'Masas de los cuerpos', unit: 'kg' },
      ],
    },
    {
      name: 'Coeficiente de restitución',
      latex: String.raw`e = -\frac{v_2' - v_1'}{v_2 - v_1}`,
      description: 'Cociente entre la rapidez de separación y la de acercamiento: 1 en un choque elástico, 0 en uno perfectamente inelástico.',
      variables: [
        { symbol: String.raw`e`, meaning: 'Coeficiente de restitución', unit: '— (adimensional, 0 a 1)' },
      ],
      notes: 'Para una pelota que rebota en el suelo: e = √(h₂/h₁).',
    },
    {
      name: 'Choque elástico con blanco en reposo',
      latex: String.raw`v_1' = \frac{m_1 - m_2}{m_1 + m_2}\,v_1, \qquad v_2' = \frac{2 m_1}{m_1 + m_2}\,v_1`,
      description: 'Velocidades finales cuando el cuerpo 1 choca elásticamente con el cuerpo 2 inicialmente en reposo.',
      variables: [
        { symbol: String.raw`v_1`, meaning: 'Velocidad inicial del cuerpo 1', unit: 'm/s' },
        { symbol: String.raw`v_1',\,v_2'`, meaning: 'Velocidades finales', unit: 'm/s' },
      ],
    },
  ],
  examples: [
    {
      title: 'Choque por alcance en la autopista',
      statement: String.raw`Un carro de $1000\,\mathrm{kg}$ que viaja a $20\,\mathrm{m/s}$ choca por detrás contra otro de $1500\,\mathrm{kg}$ que va a $10\,\mathrm{m/s}$ en el mismo sentido, y quedan enganchados. Halle la velocidad justo después del choque y la energía cinética transformada.`,
      steps: [
        String.raw`Positivo en el sentido del movimiento. Choque perfectamente inelástico: $v' = \dfrac{(1000)(20) + (1500)(10)}{2500} = \dfrac{35\,000}{2500} = 14\,\mathrm{m/s}$.`,
        String.raw`$K_{antes} = \tfrac12(1000)(20)^2 + \tfrac12(1500)(10)^2 = 200\,000 + 75\,000 = 275\,000\,\mathrm{J}$.`,
        String.raw`$K_{después} = \tfrac12(2500)(14)^2 = 245\,000\,\mathrm{J}$.`,
        String.raw`$K_{perdida} = 275\,000 - 245\,000 = 30\,000\,\mathrm{J}$.`,
      ],
      result: String.raw`$v' = 14\,\mathrm{m/s}$ y se transforman $3.0\times10^{4}\,\mathrm{J}$ (un 11 % de la energía cinética).`,
      interpretation: 'La pérdida es pequeña porque las velocidades eran parecidas: la rapidez de acercamiento era solo 10 m/s. En un choque frontal la pérdida sería mucho mayor.',
    },
    {
      title: 'Choque elástico de dos carros de laboratorio',
      statement: String.raw`Un carro de $0.50\,\mathrm{kg}$ que se mueve a $4.0\,\mathrm{m/s}$ choca elásticamente con otro de $1.5\,\mathrm{kg}$ en reposo. Halle las velocidades después del choque.`,
      steps: [
        String.raw`$v_1' = \dfrac{0.50 - 1.5}{2.0}(4.0) = -2.0\,\mathrm{m/s}$.`,
        String.raw`$v_2' = \dfrac{2(0.50)}{2.0}(4.0) = +2.0\,\mathrm{m/s}$.`,
        String.raw`Comprobación de $p$: antes $2.0\,\mathrm{kg\cdot m/s}$; después $(0.50)(-2.0) + (1.5)(2.0) = 2.0\,\mathrm{kg\cdot m/s}$ ✓.`,
        String.raw`Comprobación de $K$: antes $4.0\,\mathrm{J}$; después $1.0 + 3.0 = 4.0\,\mathrm{J}$ ✓.`,
      ],
      result: String.raw`$v_1' = -2.0\,\mathrm{m/s}$ (rebota) y $v_2' = +2.0\,\mathrm{m/s}$.`,
      interpretation: 'El carro ligero rebota porque choca con uno más pesado. La rapidez de separación (4.0 m/s) es igual a la de acercamiento, como corresponde a e = 1.',
    },
    {
      title: 'Coeficiente de restitución de una pelota',
      statement: String.raw`Una pelota se suelta desde $2.0\,\mathrm{m}$ y rebota hasta $1.28\,\mathrm{m}$. ¿Cuál es el coeficiente de restitución entre la pelota y el piso?`,
      steps: [
        String.raw`Rapidez al llegar: $v = \sqrt{2 g h_1} = \sqrt{2(9.8)(2.0)} = 6.26\,\mathrm{m/s}$. Rapidez al salir: $v' = \sqrt{2(9.8)(1.28)} = 5.01\,\mathrm{m/s}$.`,
        String.raw`$e = v'/v = 5.01/6.26 = 0.80$. Equivalente: $e = \sqrt{h_2/h_1} = \sqrt{0.64} = 0.80$.`,
      ],
      result: String.raw`$e = 0.80$.`,
      interpretation: 'La pelota conserva el 80 % de su rapidez en cada rebote, pero solo el 64 % de su energía cinética: e² = 0.64.',
    },
  ],
  simulation: {
    key: 'colisiones',
    params: { m1: 1, m2: 1, v1: 2, v2: 0, e: 1 },
    guide: String.raw`1. Con masas iguales, $v_2 = 0$ y $e = 1$, ejecute el choque. ¿Qué les ocurre a las velocidades? Compare la energía cinética antes y después.
2. Ponga $e = 0$. Lea la velocidad común después del choque y compruébela con $v' = (m_1 v_1 + m_2 v_2)/(m_1 + m_2)$. ¿Qué fracción de la energía cinética se pierde?
3. Con $e = 1$, aumente $m_2$ hasta $10\,\mathrm{kg}$. ¿Qué le pasa al carro 1? Repita con $m_1 = 10\,\mathrm{kg}$ y $m_2 = 1\,\mathrm{kg}$.
4. Elija $v_2$ negativa (choque frontal) y varíe $e$ entre 0 y 1. En todos los casos, ¿qué lectura permanece igual antes y después? ¿Cuál cambia?
5. Busque una combinación de masas y velocidades en la que, con $e = 0$, los carros queden en reposo. ¿Cuánto vale la cantidad de movimiento total en ese caso?`,
  },
  exercises: [
    {
      id: 'b4-col-01',
      category: 'numerica',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['colisiones-perfectamente-inelastica'],
      prompt: String.raw`En un patio de maniobras, un vagón de $10\,000\,\mathrm{kg}$ que se mueve a $3.0\,\mathrm{m/s}$ choca con otro vagón de $5000\,\mathrm{kg}$ en reposo, y ambos quedan enganchados. ¿Con qué rapidez se mueven juntos justo después del choque?`,
      format: 'numeric',
      unitHint: 'm/s',
    },
    {
      id: 'b4-col-02',
      category: 'conceptual',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['colisiones-tipos'],
      prompt: String.raw`Dos carros chocan sobre un riel horizontal sin fricción y quedan unidos. ¿Qué se puede afirmar de la cantidad de movimiento total $P$ y de la energía cinética total $K$ del sistema?`,
      format: 'choice',
      options: [
        String.raw`Se conservan $P$ y $K$.`,
        String.raw`Se conserva $P$, pero $K$ disminuye.`,
        String.raw`Se conserva $K$, pero $P$ disminuye.`,
        String.raw`Ni $P$ ni $K$ se conservan, porque los carros se deforman.`,
      ],
    },
    {
      id: 'b4-col-03',
      category: 'vf_justificacion',
      difficulty: 'basico',
      role: 'practice',
      concepts: ['colisiones-energia-perdida', 'colisiones-perfectamente-inelastica'],
      prompt: String.raw`**Verdadero o falso:** en un choque perfectamente inelástico entre dos cuerpos siempre se pierde toda la energía cinética del sistema. Justifique su respuesta.`,
      format: 'truefalse',
    },
    {
      id: 'b4-col-04',
      category: 'experimento',
      difficulty: 'intermedio',
      role: 'practice',
      concepts: ['colisiones-energia-perdida', 'colisiones-restitucion'],
      prompt: String.raw`En el simulador, fije $m_1 = 2\,\mathrm{kg}$, $m_2 = 1\,\mathrm{kg}$, $v_1 = 3\,\mathrm{m/s}$, $v_2 = -1\,\mathrm{m/s}$ y $e = 0.5$. Ejecute el choque y lea las velocidades después del choque. Con esas lecturas, calcule la **energía cinética transformada** en el choque (energía cinética perdida). Compruebe su resultado con la lectura del simulador.`,
      format: 'numeric',
      unitHint: 'J',
      simulation: { key: 'colisiones', params: { m1: 2, m2: 1, v1: 3, v2: -1, e: 0.5 } },
    },
    {
      id: 'b4-col-05',
      category: 'numerica',
      difficulty: 'desafiante',
      role: 'practice',
      concepts: ['colisiones-tipos', 'colisiones-restitucion'],
      prompt: String.raw`Una bola de $0.20\,\mathrm{kg}$ que se mueve a $+3.0\,\mathrm{m/s}$ choca frontal y **elásticamente** con otra bola de $0.40\,\mathrm{kg}$ en reposo. ¿Cuál es la **velocidad** (con su signo) de la primera bola justo después del choque?`,
      format: 'numeric',
      unitHint: 'm/s',
    },
    {
      id: 'b4-col-06',
      category: 'numerica',
      difficulty: 'basico',
      role: 'reinforcement',
      concepts: ['colisiones-perfectamente-inelastica'],
      prompt: String.raw`Un carro de $1200\,\mathrm{kg}$ que va a $15\,\mathrm{m/s}$ choca por detrás contra un carro de $1800\,\mathrm{kg}$ detenido en un semáforo, y ambos quedan trabados. ¿Con qué rapidez se mueven juntos justo después del choque?`,
      format: 'numeric',
      unitHint: 'm/s',
    },
    {
      id: 'b4-col-07',
      category: 'error',
      difficulty: 'intermedio',
      role: 'reinforcement',
      concepts: ['colisiones-restitucion'],
      prompt: String.raw`Un estudiante resolvió así este problema: *«Una pelota se suelta desde $1.0\,\mathrm{m}$ de altura y rebota hasta $0.64\,\mathrm{m}$. ¿Cuál es el coeficiente de restitución con el piso?»*

1. Rapidez justo antes del choque: $v = \sqrt{2 g h_1} = \sqrt{2(9.8)(1.0)} = 4.43\,\mathrm{m/s}$.
2. Rapidez justo después: $v' = \sqrt{2 g h_2} = \sqrt{2(9.8)(0.64)} = 3.54\,\mathrm{m/s}$.
3. Coeficiente de restitución: $e = \dfrac{h_2}{h_1} = \dfrac{0.64}{1.0} = 0.64$.
4. Conclusión: la pelota conserva el $64\,\%$ de su rapidez en el rebote.

¿En qué paso está el primer error?`,
      format: 'choice',
      options: ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'No hay ningún error'],
    },
    {
      id: 'b4-col-08',
      category: 'desarrollo',
      difficulty: 'desafiante',
      role: 'bank',
      concepts: ['colisiones-perfectamente-inelastica', 'colisiones-energia-perdida'],
      prompt: String.raw`**Péndulo balístico.** Una bala de $10\,\mathrm{g}$ que viaja horizontalmente a $300\,\mathrm{m/s}$ se incrusta en un bloque de madera de $2.0\,\mathrm{kg}$ que cuelga en reposo de unos hilos. El conjunto sube como un péndulo.

(a) Calcule la velocidad del bloque con la bala justo después del choque. Justifique por qué se conserva la cantidad de movimiento durante el choque.
(b) Calcule la altura máxima que sube el conjunto. Justifique por qué ahora se puede usar la conservación de la energía mecánica.
(c) Calcule qué porcentaje de la energía cinética de la bala se transformó en el choque. ¿En qué formas de energía?
(d) Explique por qué sería un error aplicar la conservación de la energía mecánica desde el instante anterior al choque hasta el punto más alto.`,
      format: 'open',
    },
  ],
};
