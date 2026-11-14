/**
 * Motor físico de la rotación del cuerpo rígido (eje fijo o rodadura sin deslizamiento) y del momento angular.
 * Unidades SI. Lo usan los simuladores «rodadura», «momento-angular» y «polea-masiva» y las comprobaciones
 * `verificar()` de la Unidad 10 de la biblioteca, para que clave, simulador y motor no puedan discrepar.
 */

export const G_POR_DEFECTO = 9.8;

/** Formas para la rodadura: factor β = I_cm / (M R²). */
export type Forma = 'aro' | 'cilindro' | 'esfera' | 'esfera-hueca' | 'bloque';
export const FORMAS: Forma[] = ['aro', 'cilindro', 'esfera', 'esfera-hueca', 'bloque'];
export const NOMBRE_FORMA: Record<Forma, string> = {
  aro: 'Aro (anillo delgado)', cilindro: 'Cilindro macizo (disco)', esfera: 'Esfera maciza',
  'esfera-hueca': 'Esfera hueca (cascarón)', bloque: 'Bloque que desliza sin fricción',
};
/** β = I/(MR²). El bloque no rueda: β = 0 (desliza sin fricción). */
export const BETA: Record<Forma, number> = { aro: 1, cilindro: 0.5, esfera: 0.4, 'esfera-hueca': 2 / 3, bloque: 0 };

// ── Momentos de inercia (eje indicado) ──
export const inerciaAro = (M: number, R: number) => M * R * R;
export const inerciaDisco = (M: number, R: number) => 0.5 * M * R * R;
export const inerciaEsfera = (M: number, R: number) => 0.4 * M * R * R;
export const inerciaEsferaHueca = (M: number, R: number) => (2 / 3) * M * R * R;
export const inerciaBarraCentro = (M: number, L: number) => (M * L * L) / 12;
export const inerciaBarraExtremo = (M: number, L: number) => (M * L * L) / 3;
/** Cilindro hueco de radios R1 < R2 respecto de su eje. */
export const inerciaCilindroHueco = (M: number, R1: number, R2: number) => 0.5 * M * (R1 * R1 + R2 * R2);
/** Teorema de ejes paralelos: I = I_cm + M d². */
export const ejesParalelos = (Icm: number, M: number, d: number) => Icm + M * d * d;
/** Sistema de partículas: I = Σ m r². */
export const inerciaParticulas = (ms: number[], rs: number[]) => ms.reduce((s, m, i) => s + m * rs[i] * rs[i], 0);

// ── Cinemática con α constante ──
export const theta = (theta0: number, w0: number, alfa: number, t: number) => theta0 + w0 * t + 0.5 * alfa * t * t;
export const omega = (w0: number, alfa: number, t: number) => w0 + alfa * t;
/** ω² = ω0² + 2αΔθ (devuelve ω ≥ 0). */
export const omegaDesplazamiento = (w0: number, alfa: number, dTheta: number) => Math.sqrt(Math.max(0, w0 * w0 + 2 * alfa * dTheta));
export const rpmARad = (rpm: number) => (rpm * 2 * Math.PI) / 60;
export const radARpm = (w: number) => (w * 60) / (2 * Math.PI);

// ── Dinámica ──
/** Módulo del torque de una fuerza F aplicada a distancia r del eje, con ángulo φ entre r y F. */
export const torque = (r: number, F: number, phiRad: number) => r * F * Math.sin(phiRad);
/** Energía cinética de rotación. */
export const energiaRotacion = (I: number, w: number) => 0.5 * I * w * w;

/** Rodadura sin deslizamiento por un plano de inclinación θ y longitud L desde el reposo. */
export function rodadura(forma: Forma, thetaRad: number, L: number, g = G_POR_DEFECTO, M = 1, R = 0.1) {
  const b = BETA[forma];
  const a = (g * Math.sin(thetaRad)) / (1 + b);
  const v = Math.sqrt(2 * a * L);
  const t = Math.sqrt((2 * L) / a);
  const Ktras = 0.5 * M * v * v;
  const Krot = b * Ktras;            // ½ I ω² = ½ β M R² (v/R)² = β · ½ M v²
  const friccion = b * M * a;        // f = I α / R = β M a (estática, hacia arriba del plano)
  const normal = M * g * Math.cos(thetaRad);
  const muMin = forma === 'bloque' ? 0 : (b * Math.tan(thetaRad)) / (1 + b);
  return { a, v, t, w: R > 0 ? v / R : 0, Ktras, Krot, fraccionRot: b / (1 + b), friccion, normal, muMin, h: L * Math.sin(thetaRad) };
}

/** Máquina de Atwood con polea de masa M y radio R (cuerda sin deslizar). m2 > m1 ⇒ m2 baja. */
export function poleaMasiva(m1: number, m2: number, M: number, R: number, formaPolea: 'disco' | 'aro' = 'disco', g = G_POR_DEFECTO) {
  const I = formaPolea === 'disco' ? inerciaDisco(M, R) : inerciaAro(M, R);
  const a = ((m2 - m1) * g) / (m1 + m2 + I / (R * R));   // aceleración de m2 hacia abajo (positiva si m2 > m1)
  const T1 = m1 * (g + a);                               // tensión del lado de m1 (que sube con a)
  const T2 = m2 * (g - a);                               // tensión del lado de m2
  return { I, a, alfa: a / R, T1, T2, torqueNeto: (T2 - T1) * R };
}

/** Plataforma giratoria con dos masas m a distancia r del eje (simétricas): I = Ip + 2 m r². */
export const inerciaPlataforma = (Ip: number, m: number, r: number) => Ip + 2 * m * r * r;

/** Conservación del momento angular al cambiar I (sin torque externo). */
export function conservacionL(I1: number, w1: number, I2: number) {
  const L = I1 * w1;
  const w2 = L / I2;
  const K1 = energiaRotacion(I1, w1);
  const K2 = energiaRotacion(I2, w2);
  return { L, w2, K1, K2, trabajoInterno: K2 - K1 };
}

/**
 * Partícula de masa m y rapidez v (perpendicular a la barra) que se incrusta a distancia d del pivote de una barra
 * uniforme de masa M y longitud L que gira alrededor de un extremo, inicialmente en reposo.
 */
export function choqueBarra(m: number, v: number, M: number, L: number, d: number) {
  const Ib = inerciaBarraExtremo(M, L);
  const I = Ib + m * d * d;
  const Lang = m * v * d;
  const w = Lang / I;
  const Ki = 0.5 * m * v * v;
  const Kf = energiaRotacion(I, w);
  // altura máxima del centro de masa del conjunto tras el choque (barra vertical colgando, gira hacia arriba)
  const ycm = (M * (L / 2) + m * d) / (M + m);
  const cosTheta = 1 - Kf / ((M + m) * G_POR_DEFECTO * ycm);
  return { I, L: Lang, w, Ki, Kf, fraccionPerdida: 1 - Kf / Ki, thetaMax: cosTheta >= -1 ? Math.acos(Math.max(-1, Math.min(1, cosTheta))) : Math.PI };
}

/** Velocidad angular de precesión de un trompo/giroscopio: Ω = M g r / (I ω). */
export const precesion = (M: number, r: number, I: number, w: number, g = G_POR_DEFECTO) => (M * g * r) / (I * w);

/** Evolución de la plataforma cuando el radio cambia linealmente de r1 a r2 durante tc segundos. */
export function evolucionPlataforma(Ip: number, m: number, r1: number, r2: number, w0: number, tc: number, t: number) {
  const s = Math.min(1, Math.max(0, t / tc));
  const r = r1 + (r2 - r1) * s;
  const I1 = inerciaPlataforma(Ip, m, r1);
  const I = inerciaPlataforma(Ip, m, r);
  const w = (I1 * w0) / I;
  return { r, I, w, L: I * w, K: energiaRotacion(I, w) };
}
