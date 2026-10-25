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
