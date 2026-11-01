/**
 * Prácticas anteriores · «Prácticas realizadas sin envío por correo»: reglas puras (probadas en tests/practicas-libres.test.ts).
 * Las reglas que importan para la seguridad se repiten en el servidor (migración 47).
 *
 * Sugerencias de agrupación: algoritmo LOCAL y DETERMINISTA (sin IA externa): normalización (minúsculas, sin tildes,
 * singular aproximado), palabras vacías, siglas de física (MRU, MRUA…), un pequeño tesauro de temas y la cantidad total
 * de ejercicios. Solo SUGIERE: ninguna agrupación se aplica sin que el profesor la confirme.
 */

/** Debe coincidir con public.hist_libre_version() del servidor. */
export const VERSION_DECLARACION = 'sin-correo-v1';

export const TEXTO_INFORMACION = [
  'Esta sección permite registrar las prácticas que realizaste antes de comenzar a utilizar el Aula Virtual y que no fueron entregadas por correo electrónico.',
  'Debes indicar el nombre de cada práctica, la cantidad total de ejercicios que contenía y cuántos ejercicios realizaste realmente.',
  'No es necesario adjuntar fotografías de todos los ejercicios. Una fotografía representativa de una parte del trabajo realizado será suficiente para el registro inicial.',
  'Sin embargo, debes conservar tus cuadernos, hojas o materiales originales, cuando todavía los tengas disponibles.',
  '**El profesor podrá solicitar posteriormente la presentación de la práctica completa para verificar la cantidad de ejercicios declarados.**',
  'Si existen diferencias entre la información registrada y el trabajo presentado, el profesor podrá solicitar aclaraciones y realizar las correcciones correspondientes.',
  'Registra únicamente ejercicios que realmente hayas realizado. No debes declarar como completados ejercicios que no trabajaste.',
  'Si no conservas fotografías porque la actividad fue realizada en clase o en la pizarra, podrás indicarlo para que el profesor determine cómo verificarla.',
  'La información registrada inicialmente quedará pendiente de revisión y validación.',
];

export const TEXTO_DECLARACION = 'Declaro que la información proporcionada corresponde a mi trabajo académico real y entiendo que el profesor podrá solicitar evidencias adicionales para verificarla.';

export const MODALIDADES = [
  ['cuaderno', 'En mi cuaderno'], ['hojas', 'En hojas independientes'], ['clase', 'Durante la clase'],
  ['pizarra', 'En la pizarra'], ['casa', 'En casa'], ['otra', 'Otra modalidad'],
] as const;
export type Modalidad = (typeof MODALIDADES)[number][0];

export type EstadoLibre = 'declarado' | 'pendiente' | 'evidencia_solicitada' | 'en_revision' | 'validado' | 'correccion_solicitada';
type Tono = 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'purple';
export const ESTADO_LIBRE: Record<EstadoLibre, { docente: string; estudiante: string; tono: Tono }> = {
  declarado: { docente: 'Declarado · pendiente de revisión', estudiante: 'Declarado · pendiente de revisión', tono: 'blue' },
  pendiente: { docente: 'Respondido · pendiente de revisión', estudiante: 'Respondido · pendiente de revisión', tono: 'blue' },
  evidencia_solicitada: { docente: 'Evidencia adicional solicitada', estudiante: 'El profesor pide evidencia adicional', tono: 'amber' },
  en_revision: { docente: 'En revisión', estudiante: 'En revisión por el profesor', tono: 'purple' },
  validado: { docente: 'Validado', estudiante: 'Validado por el profesor', tono: 'green' },
  correccion_solicitada: { docente: 'Corrección solicitada', estudiante: 'El profesor pide una corrección', tono: 'amber' },
};

export interface RegistroLibre {
  id: string; class_id: string; user_id: string; nombre: string; nombre_original: string; total_declarado: number; realizados_declarados: number;
  total_inicial: number; realizados_inicial: number; modalidades: Modalidad[]; modalidad_otra: string | null; sin_foto: boolean;
  explicacion_sin_foto: string | null; observaciones: string | null; estado: EstadoLibre; grupo_elegido: string | null; grupo_id: string | null;
  total_oficial: number | null; total_oficial_grupo: number | null; realizados_verificados: number | null; validado_at: string | null;
  revision_presencial_at: string | null; solicitud_tipo: 'fotos' | 'presencial' | 'explicacion' | 'correccion' | null; solicitud: string | null;
  solicitud_at: string | null; respuesta: string | null; material_no_disponible: boolean; respondido_at: string | null; nota_docente: string | null;
  declaracion_at: string; created_at: string; updated_at: string; falta_foto: boolean; editable?: boolean;
  fotos: { id: string; posicion: number; bytes: number; ancho: number; alto: number }[];
}

/** Clasificaciones que ve el estudiante y el profesor además del estado. */
export function etiquetas(r: Pick<RegistroLibre, 'realizados_declarados' | 'sin_foto' | 'falta_foto'>): string[] {
  const e: string[] = [];
  if (r.realizados_declarados === 0) e.push('Práctica declarada como no realizada');
  else if (r.sin_foto) e.push('Sin evidencia fotográfica; pendiente de verificación');
  else if (r.falta_foto) e.push('Falta la fotografía');
  return e;
}

/** Validación de cantidades (la misma que en el servidor). null = correcto. */
export function errorCantidades(total: number | null, realizados: number | null, max: number): string | null {
  if (total === null || !Number.isInteger(total) || total < 1) return 'La cantidad total de ejercicios debe ser un número entero positivo.';
  if (total > max) return `La cantidad total no puede superar ${max} ejercicios.`;
  if (realizados === null || !Number.isInteger(realizados) || realizados < 0) return 'Los ejercicios realizados deben ser un número entero (0 o más).';
  if (realizados > total) return 'No puedes declarar más ejercicios realizados que los que tenía la práctica.';
  return null;
}

/** Total oficial efectivo: el corregido en el registro, si no el de la práctica consolidada. null si el profesor no lo ha fijado. */
export const totalOficial = (r: Pick<RegistroLibre, 'total_oficial' | 'total_oficial_grupo'>) => r.total_oficial ?? r.total_oficial_grupo ?? null;

/** «Cumplimiento declarado» = Σ realizados / Σ totales × 100, SOLO de lo declarado. No es una nota ni un cumplimiento verificado. */
export function estadisticas(rs: Pick<RegistroLibre, 'total_declarado' | 'realizados_declarados'>[]) {
  const total = rs.reduce((s, r) => s + r.total_declarado, 0);
  const realizados = rs.reduce((s, r) => s + r.realizados_declarados, 0);
  return { practicas: rs.length, total, realizados, cumplimiento: total > 0 ? (100 * realizados) / total : null };
}
export const pct = (v: number | null) => (v === null ? '—' : `${v.toLocaleString('es-DO', { maximumFractionDigits: 1, minimumFractionDigits: v % 1 ? 1 : 0 })} %`);

// ----------------------------------------------------------------------------------------------------------------
// Similitud de nombres
// ----------------------------------------------------------------------------------------------------------------
const VACIAS = new Set(('de la el los las lo un una unos unas y e o u en con por para del al a sobre segun mi mis su sus mas ' +
  'practica practicas ejercicio ejercicios problema problemas tarea tareas tema unidad clase actividad hoja hojas parte').split(' '));

const SIGLAS: Record<string, string> = {
  mru: 'movimiento rectilineo uniforme', mrua: 'movimiento rectilineo uniformemente acelerado', mruv: 'movimiento rectilineo uniformemente variado',
  mcu: 'movimiento circular uniforme', mcua: 'movimiento circular uniformemente acelerado', mcuv: 'movimiento circular uniformemente variado',
};

/** Temas amplios (peso débil): dos nombres del mismo tema comparten una ficha «#tema». */
const TEMAS: Record<string, string[]> = {
  cinematica: ['cinematica', 'movimiento', 'velocidad', 'rectilineo', 'caida', 'proyectil', 'parabolico', 'tiro', 'desplazamiento'],
  dinamica: ['dinamica', 'newton', 'fuerza'],
  friccion: ['friccion', 'rozamiento'],
  energia: ['energia', 'trabajo', 'potencia', 'conservacion'],
  momento: ['impulso', 'choque', 'colision', 'momentum', 'cantidad'],
  vectores: ['vector', 'vectorial', 'componente'],
  rotacion: ['rotacion', 'torque', 'angular', 'circular'],
};
const TEMA_DE = new Map(Object.entries(TEMAS).flatMap(([t, ws]) => ws.map((w) => [w, t] as const)));

export const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

function singular(w: string): string {
  if (w.length >= 5 && w.endsWith('es') && !/[aeiou]es$/.test(w.slice(-3))) return w.slice(0, -2);  // leyes→ley, colisiones→colision
  if (w.length > 4 && w.endsWith('s')) return w.slice(0, -1);                                       // fuerzas→fuerza
  return w;
}

/** Fichas de un nombre: palabras normalizadas + siglas expandidas + temas («#…»). */
export function fichas(nombre: string): Set<string> {
  const out = new Set<string>();
  for (const bruto of sinTildes(nombre.toLowerCase()).split(/[^a-z0-9ñ]+/)) {
    if (!bruto) continue;
    const palabras = SIGLAS[bruto] ? SIGLAS[bruto].split(' ') : [bruto];
    for (const p of palabras) {
      const w = singular(p);
      if (VACIAS.has(w) || VACIAS.has(p) || VACIAS.has(p.replace(/s$/, '')) || (w.length < 3 && !/^\d+$/.test(w))) continue;
      out.add(w);
      const t = TEMA_DE.get(w);
      if (t) out.add(`#${t}`);
    }
  }
  return out;
}

/** Jaccard entre las fichas de dos nombres (0–1). */
export function similitudNombres(a: string, b: string): number {
  const x = fichas(a), y = fichas(b);
  if (!x.size || !y.size) return 0;
  let c = 0;
  for (const w of x) if (y.has(w)) c++;
  return c / (x.size + y.size - c);
}

/** Puntuación nombre + cantidad total: igual total suma; totales muy distintos restan. */
export function puntuacion(a: { nombre: string; total: number }, b: { nombre: string; total: number }): number {
  const j = similitudNombres(a.nombre, b.nombre);
  const dif = Math.abs(a.total - b.total) / Math.max(a.total, b.total);
  return j + (a.total === b.total ? 0.1 : dif > 0.5 ? -0.15 : 0);
}
export const UMBRAL_SUGERENCIA = 0.45;

export function moda(xs: number[]): number | null {
  if (!xs.length) return null;
  const m = new Map<number, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
}

export interface Sugerencia {
  clave: string; ids: string[]; nombres: { nombre: string; n: number }[]; estudiantes: number; totalHabitual: number | null; totales: number[];
  grupoSugerido: { id: string; nombre: string; puntuacion: number } | null;
}

/**
 * Agrupa los registros SIN práctica consolidada que parecen la misma práctica (unión de pares con puntuación ≥ umbral
 * o nombre normalizado idéntico) y propone, si la hay, la práctica consolidada más parecida. No aplica nada.
 */
export function sugerirAgrupaciones(registros: Pick<RegistroLibre, 'id' | 'user_id' | 'nombre' | 'total_declarado' | 'grupo_id' | 'grupo_elegido'>[],
  grupos: { id: string; nombre_oficial: string; total_oficial: number | null }[], umbral = UMBRAL_SUGERENCIA): Sugerencia[] {
  const libres = registros.filter((r) => !r.grupo_id).slice().sort((a, b) => a.id.localeCompare(b.id));
  const padre = libres.map((_, i) => i);
  const raiz = (i: number): number => (padre[i] === i ? i : (padre[i] = raiz(padre[i])));
  const clave = (s: string) => [...fichas(s)].filter((w) => !w.startsWith('#')).sort().join(' ');
  for (let i = 0; i < libres.length; i++) {
    for (let j = i + 1; j < libres.length; j++) {
      const a = libres[i], b = libres[j];
      const igual = clave(a.nombre) !== '' && clave(a.nombre) === clave(b.nombre);
      if (igual || puntuacion({ nombre: a.nombre, total: a.total_declarado }, { nombre: b.nombre, total: b.total_declarado }) >= umbral) padre[raiz(i)] = raiz(j);
    }
  }
  const porRaiz = new Map<number, typeof libres>();
  libres.forEach((r, i) => porRaiz.set(raiz(i), [...(porRaiz.get(raiz(i)) ?? []), r]));
  const out: Sugerencia[] = [];
  for (const rs of porRaiz.values()) {
    const cuenta = new Map<string, number>();
    for (const r of rs) cuenta.set(r.nombre.trim(), (cuenta.get(r.nombre.trim()) ?? 0) + 1);
    const nombres = [...cuenta.entries()].map(([nombre, n]) => ({ nombre, n })).sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre));
    const totales = [...new Set(rs.map((r) => r.total_declarado))].sort((a, b) => a - b);
    const totalHabitual = moda(rs.map((r) => r.total_declarado));
    let grupoSugerido: Sugerencia['grupoSugerido'] = null;
    // el estudiante pudo elegir una práctica consolidada: es la mejor pista
    const elegido = moda(rs.map((r) => r.grupo_elegido).filter((g): g is string => !!g).map((g) => grupos.findIndex((x) => x.id === g)).filter((i) => i >= 0));
    if (elegido !== null) grupoSugerido = { id: grupos[elegido].id, nombre: grupos[elegido].nombre_oficial, puntuacion: 1 };
    else {
      for (const g of grupos) {
        const p = Math.max(...nombres.map((x) => puntuacion({ nombre: x.nombre, total: totalHabitual ?? 1 }, { nombre: g.nombre_oficial, total: g.total_oficial ?? totalHabitual ?? 1 })));
        if (p >= umbral && (!grupoSugerido || p > grupoSugerido.puntuacion)) grupoSugerido = { id: g.id, nombre: g.nombre_oficial, puntuacion: p };
      }
    }
    out.push({ clave: rs.map((r) => r.id).sort().join(','), ids: rs.map((r) => r.id), nombres, estudiantes: new Set(rs.map((r) => r.user_id)).size, totalHabitual, totales, grupoSugerido });
  }
  return out.sort((a, b) => b.ids.length - a.ids.length || a.nombres[0].nombre.localeCompare(b.nombres[0].nombre));
}

/** Registros propios con nombre parecido (para advertir antes de duplicar). */
export function parecidosPropios<R extends Pick<RegistroLibre, 'id' | 'nombre' | 'total_declarado'>>(nombre: string, total: number | null, propios: R[], excluir?: string): R[] {
  if (!nombre.trim()) return [];
  return propios.filter((r) => r.id !== excluir && (similitudNombres(nombre, r.nombre) >= 0.5
    || (total !== null && puntuacion({ nombre, total }, { nombre: r.nombre, total: r.total_declarado }) >= 0.6)));
}

/** Registros de la modalidad POR CORREO con tema o práctica parecidos (posible duplicado entre modalidades). */
export function parecidosCorreo<C extends { tema: string | null; practica: string | null; numero: number }>(nombre: string, correo: C[]): C[] {
  if (!nombre.trim()) return [];
  return correo.filter((c) => Math.max(similitudNombres(nombre, c.tema ?? ''), similitudNombres(nombre, c.practica ?? '')) >= 0.5);
}

// ----------------------------------------------------------------------------------------------------------------
// Vistas del profesor
// ----------------------------------------------------------------------------------------------------------------
export interface EstudianteSeccion { user_id: string; full_name: string; student_code: string | null; group_name: string | null }

export function porEstudiante(estudiantes: EstudianteSeccion[], registros: RegistroLibre[]) {
  return estudiantes.map((e) => {
    const rs = registros.filter((r) => r.user_id === e.user_id);
    const st = estadisticas(rs);
    return {
      ...e, ...st,
      conFoto: rs.filter((r) => r.fotos.some((f) => f.posicion === 1)).length,
      sinEvidencia: rs.filter((r) => r.realizados_declarados > 0 && !r.fotos.some((f) => f.posicion === 1)).length,
      pendientes: rs.filter((r) => r.estado !== 'validado').length,
      validados: rs.filter((r) => r.estado === 'validado').length,
      verificados: rs.reduce((s, r) => s + (r.estado === 'validado' ? r.realizados_verificados ?? 0 : 0), 0),
    };
  });
}

/** Por práctica consolidada: cuántos la registraron, total habitual, discrepancias y POSIBLES omisiones (no incumplimientos). */
export function porPractica<G extends { id: string; nombre_oficial: string; total_oficial: number | null }>(grupos: G[], registros: RegistroLibre[], estudiantes: EstudianteSeccion[]) {
  return grupos.map((g) => {
    const rs = registros.filter((r) => r.grupo_id === g.id);
    const conRegistro = new Set(rs.map((r) => r.user_id));
    const totales = [...new Set(rs.map((r) => r.total_declarado))].sort((a, b) => a - b);
    const totalHabitual = moda(rs.map((r) => r.total_declarado));
    return {
      ...g, registros: rs, estudiantes: conRegistro.size, totalHabitual, totales,
      discrepancias: g.total_oficial === null ? (totales.length > 1 ? rs.length : 0) : rs.filter((r) => r.total_declarado !== g.total_oficial).length,
      sinRegistro: estudiantes.filter((e) => !conRegistro.has(e.user_id)),
      nombresOriginales: [...new Set(rs.map((r) => r.nombre_original))],
    };
  });
}
