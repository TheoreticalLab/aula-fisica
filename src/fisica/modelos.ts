/**
 * Modelos físicos de los simuladores. Funciones puras, en unidades SI, validadas por tests/fisica.test.ts.
 * Las soluciones son analíticas (no hay integración numérica), así que no acumulan error con el paso de tiempo.
 */

export const G_ESTANDAR = 9.8; // m/s², valor usado en el curso

export const gradosARad = (g: number) => (g * Math.PI) / 180;
export const radAGrados = (r: number) => (r * 180) / Math.PI;

// ---------------------------------------------------------------------------
// Vectores en el plano
// ---------------------------------------------------------------------------

export interface Vec2 {
  x: number;
  y: number;
}

export function vectorPolar(magnitud: number, anguloGrados: number): Vec2 {
  const t = gradosARad(anguloGrados);
  return { x: magnitud * Math.cos(t), y: magnitud * Math.sin(t) };
}

export function magnitud(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

/** Ángulo en grados en (−180, 180], medido desde +x en sentido antihorario. */
export function direccionGrados(v: Vec2): number {
  return radAGrados(Math.atan2(v.y, v.x));
}

export const sumar = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const restar = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const escalar = (k: number, a: Vec2): Vec2 => ({ x: k * a.x, y: k * a.y });

// ---------------------------------------------------------------------------
// Movimiento rectilíneo con aceleración constante
// ---------------------------------------------------------------------------

export interface EstadoLineal {
  t: number;
  x: number;
  v: number;
  a: number;
}

export function mrua(x0: number, v0: number, a: number, t: number): EstadoLineal {
  return { t, x: x0 + v0 * t + 0.5 * a * t * t, v: v0 + a * t, a };
}

/** Instante (> 0) en que la velocidad se anula, o null si no ocurre. */
export function tiempoVelocidadCero(v0: number, a: number): number | null {
  if (a === 0) return null;
  const t = -v0 / a;
  return t > 0 ? t : null;
}

// ---------------------------------------------------------------------------
// Caída libre y lanzamiento vertical (eje y hacia arriba)
// ---------------------------------------------------------------------------

export interface ResultadoVertical {
  alturaMaxima: number; // m (desde el suelo)
  tiempoSubida: number; // s (0 si se lanza hacia abajo o se suelta)
  tiempoVuelo: number; // s hasta y = 0
  velocidadImpacto: number; // m/s (negativa: hacia abajo)
}

export function estadoVertical(y0: number, v0: number, g: number, t: number): { t: number; y: number; v: number } {
  return { t, y: y0 + v0 * t - 0.5 * g * t * t, v: v0 - g * t };
}

export function lanzamientoVertical(y0: number, v0: number, g: number): ResultadoVertical {
  const tiempoSubida = v0 > 0 ? v0 / g : 0;
  const alturaMaxima = v0 > 0 ? y0 + (v0 * v0) / (2 * g) : y0;
  // y0 + v0 t − g t²/2 = 0  →  raíz positiva
  const tiempoVuelo = (v0 + Math.sqrt(v0 * v0 + 2 * g * y0)) / g;
  const velocidadImpacto = -Math.sqrt(v0 * v0 + 2 * g * y0);
  return { alturaMaxima, tiempoSubida, tiempoVuelo, velocidadImpacto };
}

// ---------------------------------------------------------------------------
// Proyectiles (sin rozamiento del aire)
// ---------------------------------------------------------------------------

export interface ResultadoProyectil {
  vx: number;
  vy0: number;
  tiempoVuelo: number;
  alcance: number;
  alturaMaxima: number;
  tiempoAlturaMaxima: number;
  rapidezImpacto: number;
  anguloImpactoGrados: number; // por debajo de la horizontal (positivo)
}

export function estadoProyectil(v0: number, anguloGrados: number, h0: number, g: number, t: number) {
  const th = gradosARad(anguloGrados);
  const vx = v0 * Math.cos(th);
  const vy0 = v0 * Math.sin(th);
  return { t, x: vx * t, y: h0 + vy0 * t - 0.5 * g * t * t, vx, vy: vy0 - g * t };
}

export function proyectil(v0: number, anguloGrados: number, h0: number, g: number): ResultadoProyectil {
  const th = gradosARad(anguloGrados);
  const vx = v0 * Math.cos(th);
  const vy0 = v0 * Math.sin(th);
  const tiempoVuelo = (vy0 + Math.sqrt(vy0 * vy0 + 2 * g * h0)) / g;
  const tiempoAlturaMaxima = vy0 > 0 ? vy0 / g : 0;
  const alturaMaxima = h0 + (vy0 > 0 ? (vy0 * vy0) / (2 * g) : 0);
  const vyImpacto = vy0 - g * tiempoVuelo;
  return {
    vx,
    vy0,
    tiempoVuelo,
    alcance: vx * tiempoVuelo,
    alturaMaxima,
    tiempoAlturaMaxima,
    rapidezImpacto: Math.hypot(vx, vyImpacto),
    anguloImpactoGrados: radAGrados(Math.atan2(-vyImpacto, vx)),
  };
}

// ---------------------------------------------------------------------------
// Movimiento circular uniforme
// ---------------------------------------------------------------------------

export function mcu(r: number, T: number) {
  const omega = (2 * Math.PI) / T;
  const v = omega * r;
  return { omega, v, f: 1 / T, ac: (v * v) / r };
}

export function estadoMcu(r: number, T: number, t: number) {
  const { omega, v, ac } = mcu(r, T);
  const fase = omega * t;
  return {
    t,
    anguloGrados: radAGrados(fase) % 360,
    x: r * Math.cos(fase),
    y: r * Math.sin(fase),
    vx: -v * Math.sin(fase),
    vy: v * Math.cos(fase),
    ax: -ac * Math.cos(fase),
    ay: -ac * Math.sin(fase),
  };
}

// ---------------------------------------------------------------------------
// Bloque en un plano (horizontal o inclinado) con fuerza aplicada y fricción de Coulomb
// ---------------------------------------------------------------------------

export interface ParametrosBloque {
  m: number; // kg
  F: number; // N, paralela al plano, + hacia arriba de la pendiente
  theta: number; // grados
  muS: number;
  muK: number;
  g: number;
}

export interface FuerzasBloque {
  peso: number;
  pesoParalelo: number; // m g sinθ (apunta hacia abajo de la pendiente)
  pesoPerpendicular: number; // m g cosθ
  normal: number;
  /** Fuerza de fricción con signo (eje + hacia arriba del plano). */
  friccion: number;
  tipoFriccion: 'estatica' | 'cinetica' | 'ninguna';
  fuerzaNeta: number;
  aceleracion: number;
}

/** Fuerzas cuando el bloque está en reposo. Indica si permanece en reposo. */
export function fuerzasEnReposo(p: ParametrosBloque): FuerzasBloque & { permaneceEnReposo: boolean } {
  const th = gradosARad(p.theta);
  const peso = p.m * p.g;
  const pesoParalelo = peso * Math.sin(th);
  const pesoPerpendicular = peso * Math.cos(th);
  const normal = pesoPerpendicular;
  const empuje = p.F - pesoParalelo; // fuerza neta sin fricción
  const fsMax = p.muS * normal;
  if (Math.abs(empuje) <= fsMax + 1e-12) {
    return {
      peso, pesoParalelo, pesoPerpendicular, normal,
      friccion: -empuje,
      tipoFriccion: Math.abs(empuje) < 1e-12 ? 'ninguna' : 'estatica',
      fuerzaNeta: 0, aceleracion: 0, permaneceEnReposo: true,
    };
  }
  const sentido = Math.sign(empuje); // el bloque arranca hacia donde empuja la fuerza neta
  const friccion = -sentido * p.muK * normal;
  const fuerzaNeta = empuje + friccion;
  if (fuerzaNeta * sentido <= 0) {
    // Solo ocurre si μk > μs (físicamente atípico): la fricción cinética detendría el bloque al instante.
    return {
      peso, pesoParalelo, pesoPerpendicular, normal,
      friccion: -empuje, tipoFriccion: 'estatica',
      fuerzaNeta: 0, aceleracion: 0, permaneceEnReposo: true,
    };
  }
  return {
    peso, pesoParalelo, pesoPerpendicular, normal,
    friccion, tipoFriccion: p.muK > 0 ? 'cinetica' : 'ninguna',
    fuerzaNeta, aceleracion: fuerzaNeta / p.m, permaneceEnReposo: false,
  };
}

/** Fuerzas con el bloque moviéndose con velocidad v ≠ 0. */
export function fuerzasEnMovimiento(p: ParametrosBloque, v: number): FuerzasBloque {
  const th = gradosARad(p.theta);
  const peso = p.m * p.g;
  const pesoParalelo = peso * Math.sin(th);
  const pesoPerpendicular = peso * Math.cos(th);
  const normal = pesoPerpendicular;
  const friccion = -Math.sign(v) * p.muK * normal;
  const fuerzaNeta = p.F - pesoParalelo + friccion;
  return {
    peso, pesoParalelo, pesoPerpendicular, normal,
    friccion, tipoFriccion: p.muK > 0 ? 'cinetica' : 'ninguna',
    fuerzaNeta, aceleracion: fuerzaNeta / p.m,
  };
}

export interface TramoBloque {
  t0: number;
  x0: number;
  v0: number;
  a: number;
  fuerzas: FuerzasBloque;
  enReposo: boolean;
}

/**
 * Movimiento del bloque partiendo del reposo, por tramos de aceleración constante.
 * Cuando la velocidad se anula, se vuelve a evaluar la fricción estática.
 * Devuelve los tramos hasta tMax (como mucho 8, suficiente para cualquier caso de este modelo).
 */
export function tramosBloque(p: ParametrosBloque, tMax: number): TramoBloque[] {
  const tramos: TramoBloque[] = [];
  let t = 0;
  let x = 0;
  let v = 0;
  for (let i = 0; i < 8 && t < tMax; i++) {
    if (Math.abs(v) < 1e-12) {
      const r = fuerzasEnReposo(p);
      if (r.permaneceEnReposo) {
        tramos.push({ t0: t, x0: x, v0: 0, a: 0, fuerzas: r, enReposo: true });
        break;
      }
      // arranca: el tramo dura hasta tMax (la aceleración tiene el sentido del movimiento, nunca vuelve a cero)
      tramos.push({ t0: t, x0: x, v0: 0, a: r.aceleracion, fuerzas: r, enReposo: false });
      break;
    }
    const f = fuerzasEnMovimiento(p, v);
    const tramo: TramoBloque = { t0: t, x0: x, v0: v, a: f.aceleracion, fuerzas: f, enReposo: false };
    tramos.push(tramo);
    const tStop = f.aceleracion !== 0 && Math.sign(f.aceleracion) !== Math.sign(v) ? -v / f.aceleracion : Infinity;
    if (t + tStop >= tMax) break;
    x = x + v * tStop + 0.5 * f.aceleracion * tStop * tStop;
    t = t + tStop;
    v = 0;
  }
  return tramos;
}

export function estadoBloque(tramos: TramoBloque[], t: number) {
  let tr = tramos[0];
  for (const c of tramos) if (c.t0 <= t) tr = c;
  const dt = t - tr.t0;
  return {
    t,
    x: tr.x0 + tr.v0 * dt + 0.5 * tr.a * dt * dt,
    v: tr.v0 + tr.a * dt,
    a: tr.a,
    fuerzas: tr.fuerzas,
    enReposo: tr.enReposo,
  };
}
