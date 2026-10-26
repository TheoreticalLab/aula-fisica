/**
 * Catálogo de simuladores: datos puros (sin React) para que también lo usen las pruebas
 * de contenido y el editor del profesor. Cada simulador documenta su modelo y sus simplificaciones.
 */

export interface SimParam {
  name: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface SimInfo {
  key: string;
  title: string;
  block: string;
  description: string;
  model: string; // ecuaciones del modelo (Markdown + LaTeX)
  simplifications: string[];
  params: SimParam[];
}

export const SIMULATIONS: SimInfo[] = [
  {
    key: 'vectores',
    title: 'Suma de vectores',
    block: 'Fundamentos',
    description:
      'Dos vectores en el plano dados por magnitud y dirección. Muestra sus componentes, la suma y la diferencia, por el método del paralelogramo y por componentes.',
    model: String.raw`$A_x = A\cos\theta_A,\; A_y = A\sin\theta_A$; $\vec R = \vec A + \vec B$ con $R_x = A_x + B_x$, $R_y = A_y + B_y$, $R = \sqrt{R_x^2 + R_y^2}$ y $\theta_R$ medido desde el eje $+x$.`,
    simplifications: [
      'Los ángulos se miden en sentido antihorario desde el eje +x.',
      'Los vectores son genéricos: la unidad la fija la situación física (m, N, m/s…).',
    ],
    params: [
      { name: 'aMag', label: 'Magnitud de A', unit: 'u', min: 0, max: 10, step: 0.1, default: 5 },
      { name: 'aAng', label: 'Dirección de A', unit: '°', min: -180, max: 180, step: 1, default: 30 },
      { name: 'bMag', label: 'Magnitud de B', unit: 'u', min: 0, max: 10, step: 0.1, default: 4 },
      { name: 'bAng', label: 'Dirección de B', unit: '°', min: -180, max: 180, step: 1, default: 120 },
    ],
  },
  {
    key: 'movimiento-rectilineo',
    title: 'Movimiento rectilíneo',
    block: 'Cinemática',
    description:
      'Un móvil sobre una recta con posición inicial, velocidad inicial y aceleración constantes. Gráficas x–t, v–t y a–t en tiempo real.',
    model: String.raw`$x(t) = x_0 + v_0 t + \tfrac12 a t^2$, $\quad v(t) = v_0 + a t$, $\quad a = \text{constante}$.`,
    simplifications: [
      'El móvil se trata como una partícula.',
      'La aceleración es constante durante todo el intervalo (a = 0 reproduce el MRU).',
      'Movimiento en una dimensión; el signo indica el sentido respecto al eje x.',
    ],
    params: [
      { name: 'x0', label: 'Posición inicial', unit: 'm', min: -50, max: 50, step: 1, default: 0 },
      { name: 'v0', label: 'Velocidad inicial', unit: 'm/s', min: -20, max: 20, step: 0.5, default: 5 },
      { name: 'a', label: 'Aceleración', unit: 'm/s²', min: -5, max: 5, step: 0.1, default: 0 },
      { name: 'tMax', label: 'Duración', unit: 's', min: 2, max: 20, step: 1, default: 10 },
    ],
  },
  {
    key: 'caida-libre',
    title: 'Caída libre y lanzamiento vertical',
    block: 'Cinemática',
    description:
      'Un objeto se suelta o se lanza verticalmente desde una altura inicial. Gráficas y–t y v–t; altura máxima y tiempo de vuelo.',
    model: String.raw`Eje $y$ hacia arriba: $y(t) = y_0 + v_0 t - \tfrac12 g t^2$, $\quad v(t) = v_0 - g t$.`,
    simplifications: [
      'Sin resistencia del aire: todos los cuerpos caen con la misma aceleración, sea cual sea su masa.',
      'g se considera constante (altura pequeña frente al radio terrestre).',
      'La simulación se detiene al llegar al suelo (y = 0).',
    ],
    params: [
      { name: 'y0', label: 'Altura inicial', unit: 'm', min: 0, max: 100, step: 1, default: 20 },
      { name: 'v0', label: 'Velocidad inicial (+ arriba)', unit: 'm/s', min: -20, max: 30, step: 0.5, default: 0 },
      { name: 'g', label: 'Gravedad', unit: 'm/s²', min: 1, max: 25, step: 0.1, default: 9.8 },
    ],
  },
  {
    key: 'proyectiles',
    title: 'Lanzamiento de proyectiles',
    block: 'Cinemática',
    description:
      'Proyectil lanzado con rapidez y ángulo dados desde una altura inicial. Trayectoria, componentes de la velocidad, alcance, altura máxima y tiempo de vuelo.',
    model: String.raw`$x = v_0\cos\theta\, t$, $\quad y = h_0 + v_0\sin\theta\, t - \tfrac12 g t^2$, $\quad v_x = v_0\cos\theta$, $\quad v_y = v_0\sin\theta - g t$.`,
    simplifications: [
      'Sin resistencia del aire: la componente horizontal de la velocidad es constante.',
      'g constante y terreno horizontal en y = 0.',
      'El proyectil es una partícula (no gira ni tiene tamaño).',
    ],
    params: [
      { name: 'v0', label: 'Rapidez inicial', unit: 'm/s', min: 1, max: 40, step: 0.5, default: 20 },
      { name: 'angulo', label: 'Ángulo de lanzamiento', unit: '°', min: 0, max: 90, step: 1, default: 45 },
      { name: 'h0', label: 'Altura inicial', unit: 'm', min: 0, max: 50, step: 1, default: 0 },
      { name: 'g', label: 'Gravedad', unit: 'm/s²', min: 1, max: 25, step: 0.1, default: 9.8 },
    ],
  },
  {
    key: 'circular',
    title: 'Movimiento circular uniforme',
    block: 'Cinemática',
    description:
      'Una partícula recorre una circunferencia con rapidez constante. Muestra la velocidad tangencial, la aceleración centrípeta y las componentes x(t), y(t).',
    model: String.raw`$v = \dfrac{2\pi r}{T}$, $\quad \omega = \dfrac{2\pi}{T}$, $\quad a_c = \dfrac{v^2}{r} = \omega^2 r$, $\quad f = \dfrac1T$.`,
    simplifications: [
      'Rapidez constante: la única aceleración es la centrípeta (no hay aceleración tangencial).',
      'Giro antihorario empezando en el punto (r, 0).',
    ],
    params: [
      { name: 'r', label: 'Radio', unit: 'm', min: 0.5, max: 10, step: 0.1, default: 2 },
      { name: 'T', label: 'Período', unit: 's', min: 0.5, max: 10, step: 0.1, default: 4 },
    ],
  },
  {
    key: 'fuerzas',
    title: 'Fuerzas, fricción y plano inclinado',
    block: 'Dinámica',
    description:
      'Un bloque parte del reposo sobre una superficie horizontal o inclinada. Se aplica una fuerza paralela a la superficie. Diagrama de cuerpo libre, fuerza neta, aceleración y gráficas x–t y v–t.',
    model: String.raw`A lo largo del plano (positivo hacia arriba de la pendiente): $F_{neta} = F - mg\sin\theta - f$; perpendicular: $N = mg\cos\theta$. Si el bloque está en reposo, la fricción estática ajusta su valor hasta $\mu_s N$; en movimiento, $f_k = \mu_k N$ opuesta a la velocidad. $a = F_{neta}/m$.`,
    simplifications: [
      'El bloque es una partícula; no vuelca ni rota.',
      'La fuerza aplicada es paralela a la superficie y constante.',
      'Modelo de fricción de Coulomb: coeficientes constantes, independientes de la rapidez y del área de contacto.',
      'Si el bloque llega a detenerse, se vuelve a comprobar si la fricción estática puede mantenerlo en reposo.',
    ],
    params: [
      { name: 'm', label: 'Masa', unit: 'kg', min: 0.5, max: 20, step: 0.5, default: 2 },
      { name: 'F', label: 'Fuerza aplicada (paralela, + hacia arriba del plano)', unit: 'N', min: -50, max: 100, step: 1, default: 20 },
      { name: 'theta', label: 'Inclinación', unit: '°', min: 0, max: 60, step: 1, default: 0 },
      { name: 'muS', label: 'Coeficiente estático μs', unit: '', min: 0, max: 1, step: 0.01, default: 0.4 },
      { name: 'muK', label: 'Coeficiente cinético μk', unit: '', min: 0, max: 1, step: 0.01, default: 0.3 },
      { name: 'g', label: 'Gravedad', unit: 'm/s²', min: 1, max: 25, step: 0.1, default: 9.8 },
    ],
  },
  {
    key: 'trabajo-energia',
    title: 'Trabajo y energía cinética',
    block: 'Trabajo y energía',
    description:
      'Un bloque sobre una superficie horizontal recorre una distancia d bajo una fuerza constante que forma un ángulo φ con la horizontal, con fricción cinética. Muestra el trabajo de cada fuerza, el trabajo neto y el cambio de energía cinética.',
    model: String.raw`$W_F = F d\cos\varphi$, $\;N = mg - F\sin\varphi$, $\;W_f = -\mu_k N d$, $\;W_{mg} = W_N = 0$; $\;W_{neto} = \Delta K = \tfrac12 m v^2 - \tfrac12 m v_0^2$.`,
    simplifications: [
      'El bloque es una partícula que se mueve en línea recta sobre la superficie horizontal.',
      'La fuerza aplicada es constante en magnitud y dirección; si su componente vertical levantaría el bloque (N < 0), el modelo no se aplica.',
      'Fricción cinética de Coulomb: μk constante. Si la energía cinética llegara a cero antes de recorrer d, el bloque se detiene ahí.',
    ],
    params: [
      { name: 'm', label: 'Masa', unit: 'kg', min: 0.5, max: 20, step: 0.5, default: 2 },
      { name: 'F', label: 'Fuerza aplicada', unit: 'N', min: 0, max: 100, step: 1, default: 20 },
      { name: 'phi', label: 'Ángulo de la fuerza sobre la horizontal', unit: '°', min: -60, max: 60, step: 1, default: 0 },
      { name: 'muK', label: 'Coeficiente cinético μk', unit: '', min: 0, max: 1, step: 0.01, default: 0.2 },
      { name: 'd', label: 'Distancia recorrida', unit: 'm', min: 0.5, max: 20, step: 0.5, default: 5 },
      { name: 'v0', label: 'Rapidez inicial', unit: 'm/s', min: 0, max: 10, step: 0.1, default: 0 },
      { name: 'g', label: 'Gravedad', unit: 'm/s²', min: 1, max: 25, step: 0.1, default: 9.8 },
    ],
  },
  {
    key: 'conservacion-energia',
    title: 'Conservación de la energía en una pista',
    block: 'Energía',
    description:
      'Un bloque baja por una rampa recta, recorre un tramo horizontal y sube por otra rampa, una y otra vez. Barras de energía cinética, potencial, mecánica y térmica; con fricción, la energía mecánica disminuye y la térmica aumenta en la misma cantidad.',
    model: String.raw`$E_{mec} = K + U = \tfrac12 m v^2 + m g y$. Con fricción: $\Delta E_{mec} = -\mu_k N\,\Delta s$, con $N = mg\cos\theta$ en las rampas y $N = mg$ en el tramo horizontal. $E_{total} = E_{mec} + E_{térmica}$ se conserva.`,
    simplifications: [
      'El bloque es una partícula; las esquinas de la pista no disipan energía (transición ideal).',
      'Sin resistencia del aire. Fricción cinética de Coulomb con μk constante.',
      'El cero de energía potencial está en el tramo horizontal.',
    ],
    params: [
      { name: 'm', label: 'Masa', unit: 'kg', min: 0.5, max: 10, step: 0.5, default: 1 },
      { name: 'h0', label: 'Altura inicial', unit: 'm', min: 0.5, max: 10, step: 0.1, default: 5 },
      { name: 'v0', label: 'Rapidez inicial', unit: 'm/s', min: 0, max: 10, step: 0.1, default: 0 },
      { name: 'theta1', label: 'Inclinación de la rampa izquierda', unit: '°', min: 10, max: 70, step: 1, default: 40 },
      { name: 'theta2', label: 'Inclinación de la rampa derecha', unit: '°', min: 10, max: 70, step: 1, default: 30 },
      { name: 'L', label: 'Longitud del tramo horizontal', unit: 'm', min: 0, max: 10, step: 0.5, default: 4 },
      { name: 'muK', label: 'Coeficiente cinético μk', unit: '', min: 0, max: 0.5, step: 0.01, default: 0 },
      { name: 'g', label: 'Gravedad', unit: 'm/s²', min: 1, max: 25, step: 0.1, default: 9.8 },
    ],
  },
  {
    key: 'masa-resorte',
    title: 'Oscilador masa-resorte',
    block: 'Movimiento armónico simple',
    description:
      'Un bloque unido a un resorte ideal, horizontal o colgado verticalmente. Se eligen la posición y la velocidad iniciales; el simulador muestra la amplitud y la fase que resultan, las gráficas x–t, v–t y a–t, y las energías cinética, potencial y total.',
    model: String.raw`$\omega = \sqrt{k/m}$, $\;T = 2\pi/\omega$. Medida desde el equilibrio: $x(t) = A\cos(\omega t + \varphi)$ con $A = \sqrt{x_0^2 + (v_0/\omega)^2}$ y $\varphi$ tal que $A\cos\varphi = x_0$, $-A\omega\sin\varphi = v_0$. $E = \tfrac12 k A^2 = \tfrac12 m v^2 + \tfrac12 k x^2$. En vertical, el equilibrio está estirado $\Delta = mg/k$ y la frecuencia no cambia.`,
    simplifications: [
      'Resorte ideal: sin masa, lineal (ley de Hooke) para cualquier estiramiento del recorrido.',
      'Sin fricción ni resistencia del aire: la energía mecánica total se conserva.',
      'La coordenada x se mide desde la posición de equilibrio (en vertical, desde el equilibrio con el peso colgado), positiva hacia la derecha o hacia abajo.',
      'La integración numérica usa el método de Verlet, que conserva la energía dentro de la tolerancia numérica; se compara con la solución exacta.',
    ],
    params: [
      { name: 'm', label: 'Masa', unit: 'kg', min: 0.1, max: 5, step: 0.1, default: 1 },
      { name: 'k', label: 'Constante elástica', unit: 'N/m', min: 5, max: 200, step: 1, default: 40 },
      { name: 'x0', label: 'Posición inicial (desde el equilibrio)', unit: 'm', min: -0.5, max: 0.5, step: 0.01, default: 0.2 },
      { name: 'v0', label: 'Velocidad inicial', unit: 'm/s', min: -3, max: 3, step: 0.05, default: 0 },
      { name: 'vertical', label: 'Resorte vertical (0 = horizontal, 1 = vertical)', unit: '', min: 0, max: 1, step: 1, default: 0 },
      { name: 'g', label: 'Gravedad (solo vertical)', unit: 'm/s²', min: 1, max: 25, step: 0.1, default: 9.8 },
    ],
  },
  {
    key: 'colisiones',
    title: 'Colisiones en una dimensión',
    block: 'Cantidad de movimiento',
    description:
      'Dos carros sobre un riel sin fricción chocan de frente. Se elige el coeficiente de restitución: 1 para un choque elástico, 0 para uno perfectamente inelástico. Muestra velocidades, cantidad de movimiento y energía cinética antes y después.',
    model: String.raw`$p = m_1 v_1 + m_2 v_2$ se conserva. Con coeficiente de restitución $e = -\dfrac{v_2' - v_1'}{v_2 - v_1}$: $\;v_1' = \dfrac{p + m_2 e (v_2 - v_1)}{m_1 + m_2}$, $\;v_2' = \dfrac{p + m_1 e (v_1 - v_2)}{m_1 + m_2}$. La energía cinética solo se conserva si $e = 1$.`,
    simplifications: [
      'Riel horizontal sin fricción: durante el choque, las fuerzas externas horizontales son nulas.',
      'Los carros son partículas; el choque es instantáneo comparado con el resto del movimiento.',
      'Movimiento en una dimensión; el signo de la velocidad indica el sentido.',
    ],
    params: [
      { name: 'm1', label: 'Masa del carro 1', unit: 'kg', min: 0.1, max: 10, step: 0.1, default: 1 },
      { name: 'm2', label: 'Masa del carro 2', unit: 'kg', min: 0.1, max: 10, step: 0.1, default: 1 },
      { name: 'v1', label: 'Velocidad inicial del carro 1', unit: 'm/s', min: -5, max: 5, step: 0.1, default: 2 },
      { name: 'v2', label: 'Velocidad inicial del carro 2', unit: 'm/s', min: -5, max: 5, step: 0.1, default: 0 },
      { name: 'e', label: 'Coeficiente de restitución', unit: '', min: 0, max: 1, step: 0.05, default: 1 },
    ],
  },
];

export function getSimulation(key: string): SimInfo | undefined {
  return SIMULATIONS.find((s) => s.key === key);
}

/** Valores por defecto completados con los parámetros indicados (fuera de rango → se recortan). */
export function resolveParams(key: string, params?: Record<string, number>): Record<string, number> {
  const sim = getSimulation(key);
  if (!sim) return {};
  const out: Record<string, number> = {};
  for (const p of sim.params) {
    const v = params?.[p.name];
    out[p.name] = typeof v === 'number' && Number.isFinite(v) ? Math.min(p.max, Math.max(p.min, v)) : p.default;
  }
  return out;
}

/** Simuladores del temario completo que todavía no están implementados (se muestran como pendientes). */
export const PLANNED_SIMULATIONS: { title: string; block: string }[] = [
  { title: 'Sistemas masa-resorte', block: 'Oscilaciones y ondas' },
  { title: 'Péndulo simple', block: 'Oscilaciones y ondas' },
  { title: 'Propagación de ondas', block: 'Oscilaciones y ondas' },
  { title: 'Ondas sonoras', block: 'Oscilaciones y ondas' },
  { title: 'Transferencia de calor', block: 'Temperatura y termodinámica' },
  { title: 'Gases ideales y transformaciones termodinámicas', block: 'Temperatura y termodinámica' },
];
