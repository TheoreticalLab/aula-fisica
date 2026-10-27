/**
 * «¿Pude haber sido yo?» — evaluación EXPLICABLE de un intento frente al historial de accesos correctos de la cuenta.
 * Reglas verificables con pesos visibles (no un modelo opaco). La puntuación es una CATEGORÍA de anomalía, no una
 * probabilidad de ataque. Probado en tests/forense.test.ts.
 */

export interface ContextoEvento {
  evento: { reason: string; success: boolean; browser: string | null; os: string | null; country: string | null; ip_hash: string | null; device_hash: string | null; created_at: string };
  cuenta: { full_name: string; student_code: string | null; role: string } | null;
  historial_correctos: number;
  navegadores: string[];
  sistemas: string[];
  paises: string[];
  origen_visto_en_correctos: boolean;
  dispositivo_reconocido: boolean;
  horas_habituales: number[];
  hora_evento: number;
  rafaga_intentos: number;
  rafaga_intervalos: number[];
  correcto_despues: string | null;
  ids_mismo_origen_24h: number;
}

export interface Senal {
  texto: string;
  peso: number; // + aumenta la sospecha, − la reduce
  tipo: 'hecho' | 'inferencia';
}

export interface Evaluacion {
  senales: Senal[];
  desconocido: string[];
  puntuacion: number | null; // null = evidencia insuficiente
  categoria: 'bajo' | 'bajo-moderado' | 'moderado' | 'alto' | 'crítico' | 'insuficiente';
  automatizacion: boolean;
  texto: string;
}

/** Umbrales configurables de las categorías (no son probabilidades). */
export const UMBRALES = { bajo: 20, bajoModerado: 40, moderado: 60, alto: 80 };
export const BASE = 30;

const familia = (s: string | null) => (s ?? '').replace(/\s*[\d.]+.*$/, '').trim().toLowerCase();

/** Intervalos muy cortos y muy regulares: compatible con automatización (no la demuestra). */
export function pareceAutomatizado(intervalos: number[]): boolean {
  if (intervalos.length < 4) return false;
  const media = intervalos.reduce((s, x) => s + x, 0) / intervalos.length;
  const desv = Math.sqrt(intervalos.reduce((s, x) => s + (x - media) ** 2, 0) / intervalos.length);
  return media < 10 && desv < 1.5;
}

export function categoria(p: number): Evaluacion['categoria'] {
  if (p <= UMBRALES.bajo) return 'bajo';
  if (p <= UMBRALES.bajoModerado) return 'bajo-moderado';
  if (p <= UMBRALES.moderado) return 'moderado';
  if (p <= UMBRALES.alto) return 'alto';
  return 'crítico';
}

export function evaluar(c: ContextoEvento): Evaluacion {
  const s: Senal[] = [];
  const desconocido: string[] = [];
  const e = c.evento;
  const hayHistorial = c.historial_correctos > 0;
  let comparables = 0;

  if (!c.cuenta) s.push({ texto: 'El identificador no corresponde a ninguna cuenta.', peso: 10, tipo: 'hecho' });
  if (!hayHistorial) desconocido.push('No hay accesos correctos previos de esta cuenta (90 días) con los que comparar.');

  // dispositivo
  if (!e.device_hash) desconocido.push('El intento no trae identificador de instalación (navegador antiguo, privado o borrado).');
  else if (c.dispositivo_reconocido) { s.push({ texto: 'Desde un dispositivo reconocido por accesos correctos anteriores.', peso: -25, tipo: 'hecho' }); comparables++; }
  else if (hayHistorial) { s.push({ texto: 'Desde una instalación no reconocida para esta cuenta.', peso: 15, tipo: 'hecho' }); comparables++; }

  // origen de red
  if (!e.ip_hash) desconocido.push('Origen de red no disponible.');
  else if (c.origen_visto_en_correctos) { s.push({ texto: 'El origen de red coincide con accesos correctos anteriores.', peso: -20, tipo: 'hecho' }); comparables++; }
  else if (hayHistorial) { s.push({ texto: 'Origen de red no observado en los accesos correctos de la cuenta.', peso: 10, tipo: 'hecho' }); comparables++; }

  // navegador y sistema (declarados: falsificables)
  if (e.browser && c.navegadores.length) {
    const ok = c.navegadores.some((b) => familia(b) === familia(e.browser));
    s.push({ texto: ok ? `Navegador habitual (${e.browser}).` : `Navegador distinto del habitual (${e.browser}; antes: ${c.navegadores.join(', ')}).`, peso: ok ? -8 : 10, tipo: 'hecho' });
    comparables++;
  } else if (!e.browser) desconocido.push('Navegador no registrado.');
  if (e.os && c.sistemas.length) {
    const ok = c.sistemas.some((o) => familia(o) === familia(e.os));
    s.push({ texto: ok ? `Sistema operativo habitual (${e.os}).` : `Sistema operativo distinto del habitual (${e.os}; antes: ${c.sistemas.join(', ')}).`, peso: ok ? -8 : 10, tipo: 'hecho' });
    comparables++;
  }

  // país aproximado (cabecera de red)
  if (!e.country) desconocido.push('País aproximado no disponible (la plataforma no envió la cabecera).');
  else if (c.paises.length) {
    const ok = c.paises.includes(e.country);
    s.push({ texto: ok ? `País aproximado habitual (${e.country}).` : `País aproximado distinto del habitual (${e.country}; antes: ${c.paises.join(', ')}).`, peso: ok ? -5 : 15, tipo: 'hecho' });
    comparables++;
  }

  // horario (solo con historial suficiente)
  if (c.historial_correctos >= 5) {
    const ok = c.horas_habituales.some((h) => Math.min(Math.abs(h - c.hora_evento), 24 - Math.abs(h - c.hora_evento)) <= 1);
    s.push({ texto: ok ? 'Hora compatible con los accesos habituales.' : 'Hora poco habitual para esta cuenta.', peso: ok ? -5 : 5, tipo: 'inferencia' });
  }

  // volumen y ritmo
  if (c.rafaga_intentos >= 10) s.push({ texto: `${c.rafaga_intentos} intentos fallidos de esta cuenta en ±1 hora.`, peso: 25, tipo: 'hecho' });
  else if (c.rafaga_intentos >= 5) s.push({ texto: `${c.rafaga_intentos} intentos fallidos de esta cuenta en ±1 hora.`, peso: 10, tipo: 'hecho' });
  const auto = pareceAutomatizado(c.rafaga_intervalos);
  if (auto) s.push({ texto: 'Intervalos muy cortos y regulares entre intentos: compatible con un proceso automatizado.', peso: 25, tipo: 'inferencia' });
  if (c.ids_mismo_origen_24h >= 5) s.push({ texto: `El mismo origen probó ${c.ids_mismo_origen_24h} identificadores distintos en 24 h.`, peso: 20, tipo: 'hecho' });
  if (c.correcto_despues) s.push({ texto: 'Hubo un acceso correcto poco después (compatible con un error del titular, o con una contraseña acertada).', peso: -5, tipo: 'inferencia' });
  if (c.cuenta && (c.cuenta.role === 'admin' || c.cuenta.role === 'teacher')) s.push({ texto: 'Cuenta privilegiada: mayor sensibilidad.', peso: 5, tipo: 'hecho' });

  const fuertes = s.some((x) => Math.abs(x.peso) >= 20);
  if (comparables < 2 && !fuertes) {
    return { senales: s, desconocido, puntuacion: null, categoria: 'insuficiente', automatizacion: auto, texto: 'Evidencia insuficiente para clasificar.' };
  }
  const puntuacion = Math.max(0, Math.min(100, BASE + s.reduce((t, x) => t + x.peso, 0)));
  const cat = categoria(puntuacion);
  const coincidencias = s.filter((x) => x.peso < 0 && x.tipo === 'hecho').length;
  const texto =
    puntuacion <= UMBRALES.bajoModerado && coincidencias >= 2
      ? 'Este intento comparte varias características con accesos legítimos anteriores. Es compatible con un error de autenticación del titular, aunque no demuestra quién realizó el intento.'
      : puntuacion > UMBRALES.moderado
        ? auto
          ? 'Este comportamiento es anómalo respecto al historial de la cuenta y presenta indicadores compatibles con intentos automatizados.'
          : 'El intento presenta diferencias importantes respecto al historial habitual de la cuenta.'
        : 'El intento mezcla coincidencias y diferencias con el historial de la cuenta; conviene revisarlo.';
  return { senales: s, desconocido, puntuacion, categoria: cat, automatizacion: auto, texto };
}
