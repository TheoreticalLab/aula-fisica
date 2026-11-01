/**
 * Regularización de prácticas anteriores: reglas puras compartidas por las páginas del estudiante y del profesor
 * (probadas en tests/regularizacion.test.ts). Las reglas que importan para la seguridad se repiten en el servidor.
 */

export type Estado = 'borrador' | 'registrada' | 'localizada' | 'verificada' | 'no_localizada' | 'aclaracion' | 'observada' | 'convalidada';
export type Medio = 'correo' | 'otra';
export type Tipo = 'evidencia' | 'incidencia';
export type AccionDocente = 'localizada' | 'verificada' | 'no_localizada' | 'aclaracion' | 'observada' | 'convalidada' | 'revertir_convalidacion' | 'pendiente';
type Tono = 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'purple';

/** Etiquetas para el profesor y para el estudiante. Ningún estado es una calificación. */
export const ESTADO: Record<Estado, { docente: string; estudiante: string; tono: Tono }> = {
  borrador: { docente: 'Borrador', estudiante: 'Borrador (aún no enviado)', tono: 'gray' },
  registrada: { docente: 'Pendiente de verificación', estudiante: 'Registrada · pendiente de revisión', tono: 'blue' },
  localizada: { docente: 'Localizada', estudiante: 'El profesor localizó tu envío', tono: 'purple' },
  verificada: { docente: 'Verificada', estudiante: 'Verificada', tono: 'green' },
  no_localizada: { docente: 'No localizada', estudiante: 'El profesor no localizó el envío', tono: 'red' },
  aclaracion: { docente: 'Aclaración solicitada', estudiante: 'El profesor pide una aclaración', tono: 'amber' },
  observada: { docente: 'Observada', estudiante: 'Observada (el profesor la está revisando)', tono: 'amber' },
  convalidada: { docente: 'Convalidada', estudiante: 'Convalidada', tono: 'green' },
};

export const ACCIONES: { id: AccionDocente; etiqueta: string; ayuda: string; nota: 'no' | 'opcional' | 'obligatoria' }[] = [
  { id: 'localizada', etiqueta: 'Localizada', ayuda: 'Encontré el mensaje original en el canal indicado.', nota: 'opcional' },
  { id: 'verificada', etiqueta: 'Verificada', ayuda: 'Comprobé que el mensaje original corresponde a esta práctica y contiene la entrega.', nota: 'opcional' },
  { id: 'no_localizada', etiqueta: 'No localizada', ayuda: 'No encontré el envío.', nota: 'opcional' },
  { id: 'aclaracion', etiqueta: 'Solicitar aclaración', ayuda: 'El estudiante recibe un aviso y puede corregir y responder.', nota: 'obligatoria' },
  { id: 'observada', etiqueta: 'Observada', ayuda: 'Hay una inconsistencia que requiere revisión.', nota: 'obligatoria' },
  { id: 'convalidada', etiqueta: 'Convalidar', ayuda: 'Reconocer oficialmente la entrega histórica (no crea ninguna nota).', nota: 'opcional' },
  { id: 'revertir_convalidacion', etiqueta: 'Revertir convalidación', ayuda: 'Vuelve a «verificada». Queda en el historial.', nota: 'obligatoria' },
  { id: 'pendiente', etiqueta: 'Volver a pendiente', ayuda: 'Deshace una marca por error (queda en el historial).', nota: 'opcional' },
];

/** ¿Qué acciones tienen sentido en este estado? (el servidor vuelve a comprobarlo) */
export function accionesPosibles(estado: Estado, localizada: boolean): AccionDocente[] {
  if (estado === 'borrador') return [];
  if (estado === 'convalidada') return ['revertir_convalidacion'];
  const out: AccionDocente[] = [];
  if (estado !== 'localizada') out.push('localizada');
  if (localizada && estado !== 'verificada') out.push('verificada');
  if (estado === 'verificada') out.push('convalidada');
  if (estado !== 'no_localizada') out.push('no_localizada');
  out.push('aclaracion', 'observada');
  if (estado !== 'registrada') out.push('pendiente');
  return out;
}

export interface Borrador {
  tipo: Tipo; medio: Medio | null; otra_via: string | null; correo_remitente: string | null; motivo_incidencia: string | null; tieneCapturaPrincipal: boolean;
}

/** Lo que falta para poder registrar (mismo criterio que hist_faltantes en el servidor). */
export function faltantes(b: Borrador): string[] {
  const f: string[] = [];
  if (!b.medio) f.push('el medio de envío');
  if (b.medio === 'otra' && !(b.otra_via ?? '').trim()) f.push('especificar por cuál medio la enviaste');
  if (b.tipo === 'evidencia' && !b.tieneCapturaPrincipal) f.push('la captura principal del envío');
  if (b.tipo === 'incidencia' && !(b.motivo_incidencia ?? '').trim()) f.push('explicar qué pasó con la evidencia');
  return f;
}

/** Avisos que no impiden registrar pero ayudan al profesor a localizar el envío. */
export function recomendaciones(b: Borrador & { fecha_desconocida: boolean; fecha_declarada: string | null; tema: string }): string[] {
  const r: string[] = [];
  if (b.medio === 'correo' && !(b.correo_remitente ?? '').trim()) r.push('Escribe la dirección de correo desde la que enviaste la práctica: es lo que el profesor usará para buscarla.');
  if (!b.fecha_desconocida && !b.fecha_declarada) r.push('Indica la fecha aproximada o marca «No recuerdo la fecha».');
  if (!b.tema.trim()) r.push('Escribe el tema de la práctica si lo recuerdas.');
  return r;
}

export const correoValido = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());

// ----------------------------------------------------------------------------------------------------------------
// Búsqueda manual en el correo del profesor (no se conecta ni se consulta ningún correo)
// ----------------------------------------------------------------------------------------------------------------
const VACIAS = new Set(('de la el los las un una unos unas y o u en con por para del al que se su sus sobre como mas más muy es son fue ' +
  'practica práctica practicas prácticas profesor profe tarea trabajo entrega envio envío numero número tema mi mis lo le les ' +
  'esta este estas estos eso esa ese').split(' '));

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Palabras distintivas (≥ 4 letras, sin palabras vacías), en el orden en que aparecen. */
export function palabrasClave(texto: string, max = 4): string[] {
  const out: string[] = [];
  const vistas = new Set<string>();
  for (const w of texto.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    const n = sinTildes(w);
    if (w.length < 4 || VACIAS.has(w) || VACIAS.has(n) || vistas.has(n)) continue;
    vistas.add(n);
    out.push(w);
    if (out.length >= max) break;
  }
  return out;
}

function sumarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + dias));
  return t.toISOString().slice(0, 10);
}

export interface Busqueda { gmail: string; gmailConPalabras: string | null; desde: string | null; hasta: string | null; palabras: string[] }

/**
 * Texto para copiar en el buscador del correo institucional (sintaxis de Gmail/Google Workspace).
 * Con fecha declarada D y margen M: after:(D−M) before:(D+M+1) — «before» excluye ese día, así el día D+M queda dentro.
 */
export function busquedaCorreo(r: { correo_remitente: string | null; fecha_declarada: string | null; tema: string; descripcion: string }, margen: number): Busqueda {
  const partes: string[] = [];
  if (r.correo_remitente) partes.push(`from:${r.correo_remitente.trim()}`);
  let desde: string | null = null, hasta: string | null = null;
  if (r.fecha_declarada) {
    desde = sumarDias(r.fecha_declarada, -margen);
    hasta = sumarDias(r.fecha_declarada, margen);
    partes.push(`after:${desde.replace(/-/g, '/')}`, `before:${sumarDias(r.fecha_declarada, margen + 1).replace(/-/g, '/')}`);
  }
  const palabras = palabrasClave(`${r.tema} ${r.descripcion}`);
  const gmail = partes.join(' ');
  const conPalabras = palabras.length ? `${gmail} {${palabras.join(' ')}}`.trim() : null;
  return { gmail, gmailConPalabras: conPalabras, desde, hasta, palabras };
}

// ----------------------------------------------------------------------------------------------------------------
// Sugerencias: «Profesor, recuerdo otra práctica»
// ----------------------------------------------------------------------------------------------------------------
export interface Sugerencia { id: string; tema: string | null; descripcion: string; total_estimado: number | null; estado: string }

function fichas(s: string): Set<string> {
  return new Set(palabrasClave(s, 20).map((w) => sinTildes(w).replace(/s$/, '')));
}

/** Similitud de Jaccard entre las palabras distintivas de dos textos (0–1). */
export function similitud(a: string, b: string): number {
  const x = fichas(a), y = fichas(b);
  if (!x.size || !y.size) return 0;
  let c = 0;
  for (const w of x) if (y.has(w)) c++;
  return c / (x.size + y.size - c);
}

/** Agrupa sugerencias con temas parecidos (unión de pares con similitud ≥ umbral). Las que solo dan un total no se agrupan. */
export function agruparSugerencias<S extends Sugerencia>(sugs: S[], umbral = 0.34): S[][] {
  const conTema = sugs.filter((s) => s.tema);
  const padre = conTema.map((_, i) => i);
  const raiz = (i: number): number => (padre[i] === i ? i : (padre[i] = raiz(padre[i])));
  for (let i = 0; i < conTema.length; i++) {
    for (let j = i + 1; j < conTema.length; j++) {
      const a = `${conTema[i].tema} ${conTema[i].descripcion}`, b = `${conTema[j].tema} ${conTema[j].descripcion}`;
      if (similitud(conTema[i].tema!, conTema[j].tema!) >= umbral || similitud(a, b) >= umbral + 0.1) padre[raiz(i)] = raiz(j);
    }
  }
  const grupos = new Map<number, S[]>();
  conTema.forEach((s, i) => { const r = raiz(i); grupos.set(r, [...(grupos.get(r) ?? []), s]); });
  return [...grupos.values()].sort((a, b) => b.length - a.length);
}

/** Lo que dicen los estudiantes sobre cuántas prácticas hubo. */
export function estimacionTotal(sugs: { total_estimado: number | null }[]): { respuestas: number; mediana: number | null; moda: number | null; conteo: [number, number][] } {
  const v = sugs.map((s) => s.total_estimado).filter((x): x is number => typeof x === 'number').sort((a, b) => a - b);
  if (!v.length) return { respuestas: 0, mediana: null, moda: null, conteo: [] };
  const m = new Map<number, number>();
  for (const x of v) m.set(x, (m.get(x) ?? 0) + 1);
  const conteo = [...m.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const mitad = Math.floor(v.length / 2);
  return { respuestas: v.length, mediana: v.length % 2 ? v[mitad] : (v[mitad - 1] + v[mitad]) / 2, moda: conteo[0][0], conteo };
}

// ----------------------------------------------------------------------------------------------------------------
// Localizador del profesor
// ----------------------------------------------------------------------------------------------------------------
export interface Registro {
  id: string; class_id: string; class_name: string; course_id: string; course_title: string; group_id: string | null; group_name: string | null;
  user_id: string; full_name: string; student_code: string | null; practice_id: string; numero: number; practica_titulo: string; practica_archivada: boolean;
  tipo: Tipo; tema: string; descripcion: string; fecha_declarada: string | null; fecha_desconocida: boolean; medio: Medio | null;
  correo_remitente: string | null; otra_via: string | null; contacto: string | null; motivo_incidencia: string | null; estado: Estado;
  enviado_at: string | null; revisada_at: string | null; localizada_at: string | null; verificada_at: string | null; convalidada_at: string | null;
  nota_docente: string | null; respuesta_estudiante: string | null; actividad: string | null; calificacion: { score: number; max: number } | null;
  capturas: { id: string; posicion: number; bytes: number; ancho: number; alto: number; mime: string; sha256: string; igual_a_otros: number }[];
}

export interface Filtros {
  texto: string; curso: string; seccion: string; grupo: string; numero: string; medio: '' | Medio; tipo: '' | Tipo; estado: '' | Estado | 'por_revisar';
  desde: string; hasta: string;
}
export const FILTROS_VACIOS: Filtros = { texto: '', curso: '', seccion: '', grupo: '', numero: '', medio: '', tipo: '', estado: '', desde: '', hasta: '' };

export function filtrar(rs: Registro[], f: Filtros): Registro[] {
  const t = sinTildes(f.texto.trim().toLowerCase());
  return rs.filter((r) => {
    if (t && !sinTildes(`${r.full_name} ${r.student_code ?? ''} ${r.correo_remitente ?? ''} ${r.contacto ?? ''} ${r.tema}`.toLowerCase()).includes(t)) return false;
    if (f.curso && r.course_id !== f.curso) return false;
    if (f.seccion && r.class_id !== f.seccion) return false;
    if (f.grupo && (r.group_id ?? '') !== f.grupo) return false;
    if (f.numero && String(r.numero) !== f.numero) return false;
    if (f.medio && r.medio !== f.medio) return false;
    if (f.tipo && r.tipo !== f.tipo) return false;
    if (f.estado === 'por_revisar' ? !['registrada', 'aclaracion'].includes(r.estado) : f.estado && r.estado !== f.estado) return false;
    if ((f.desde || f.hasta) && !r.fecha_declarada) return false;
    if (f.desde && r.fecha_declarada! < f.desde) return false;
    if (f.hasta && r.fecha_declarada! > f.hasta) return false;
    return true;
  });
}

/** Totales para la vista general. Las posiciones del catálogo sin declarar no cuentan como nada. */
export function totales(rs: Registro[]) {
  const c = (e: Estado) => rs.filter((r) => r.estado === e).length;
  return {
    declaradas: rs.length,
    evidencias: rs.filter((r) => r.tipo === 'evidencia').length,
    incidencias: rs.filter((r) => r.tipo === 'incidencia').length,
    porLocalizar: c('registrada') + c('aclaracion'),
    localizadas: c('localizada'),
    verificadas: c('verificada'),
    convalidadas: c('convalidada'),
    noLocalizadas: c('no_localizada'),
    observadas: c('observada'),
    estudiantes: new Set(rs.map((r) => r.user_id)).size,
  };
}

/** Un estudiante con dos registros de la misma práctica (p. ej. después de unir dos posiciones del catálogo). */
export function duplicados(rs: Registro[]): Set<string> {
  const vistos = new Map<string, string[]>();
  for (const r of rs) if (r.tipo === 'evidencia') vistos.set(`${r.user_id}|${r.practice_id}`, [...(vistos.get(`${r.user_id}|${r.practice_id}`) ?? []), r.id]);
  return new Set([...vistos.values()].filter((v) => v.length > 1).flat());
}

export const kb = (b: number) => (b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`);
