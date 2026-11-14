/**
 * Exportaciones del informe docente del Maratón adaptativo (CSV para Excel en español y XLSX sin dependencias).
 * El informe individual en PDF se obtiene imprimiendo la vista del estudiante (Imprimir → Guardar como PDF), como en
 * el resto del aula. Los informes de un participante solo contienen sus propios datos.
 */
import type { EstudianteResumen, FilaExportacion, ResumenDocente } from '@/api/maraton';
import { crearXlsx, type HojaXlsx } from '@/lib/exportacion/xlsx';
import { toCsv } from '@/lib/util';

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);
const min = (s: number | null | undefined) => (s == null ? null : Math.round(s / 6) / 10);
const dec = (x: number | null | undefined) => (x == null ? '' : String(x).replace('.', ','));

export const COLUMNAS_RESUMEN = [
  'ID', 'Estudiante', 'Participa', 'Jornadas completadas', 'Jornadas iniciadas', 'Jornadas para revisión', 'Vía cuota', 'Vía alternativa',
  'Presentados', 'Intentos válidos', 'Correctas', 'Incorrectas', '% aciertos', 'No puedo', 'Cambios', 'Comodines usados', 'Anticipadas',
  'Minutos registrados', 'Nivel máximo', 'Nivel máximo con acierto', 'Extremos resueltos', 'Nivel actual',
] as const;

export function filaResumen(e: EstudianteResumen): (string | number | null)[] {
  const r = e.resumen;
  return [
    e.login_id ?? '', e.nombre, e.participa ? 'sí' : 'no', r?.jornadas_completadas ?? 0, r?.jornadas_iniciadas ?? 0, r?.jornadas_revision ?? 0,
    r?.via_cuota ?? 0, r?.via_alternativa ?? 0, r?.presentados ?? 0, r?.intentos_validos ?? 0, r?.correctas ?? 0, r?.incorrectas ?? 0,
    r ? pct(r.correctas, r.intentos_validos) : null, r?.no_puedo ?? 0, r?.cambios ?? 0, e.comodines_usados ?? 0, r?.anticipadas ?? 0,
    min(r?.segundos), r?.nivel_maximo ?? null, r?.nivel_maximo_correcto ?? null, r?.extremos_resueltos ?? 0, e.nivel_actual,
  ];
}

/** CSV general (una fila por estudiante), con «;» y coma decimal para Excel en español */
export function csvResumen(d: ResumenDocente): string {
  return toCsv([[...COLUMNAS_RESUMEN], ...d.estudiantes.map((e) => filaResumen(e).map((x) => (typeof x === 'number' ? dec(x) : x)))]);
}

export const COLUMNAS_DETALLE = ['ID', 'Estudiante', 'Jornada', 'Fecha', 'Secuencia', 'Nivel', 'Tema', 'Plantilla', 'Variante', 'Presentado', 'Cerrado',
  'Acción', 'Resultado', 'Respuesta', 'Segundos', 'Anticipada', 'Unidades', 'Nivel después', 'Comodines restantes (usados)'] as const;

export function filaDetalle(f: FilaExportacion): (string | number | null)[] {
  return [f.login_id ?? '', f.nombre, f.jornada, f.fecha, f.secuencia, f.nivel, f.tema, f.plantilla_id, f.variante_id, f.presentada_at, f.cerrada_at ?? '',
    f.accion ?? '', f.resultado ?? '', (f.respuesta ?? []).join(' | '), f.segundos, f.anticipada ? 'sí' : f.anticipada === false ? 'no' : '', f.unidades, f.nivel_despues, f.comodines_despues];
}

export function csvDetalle(filas: FilaExportacion[]): string {
  return toCsv([[...COLUMNAS_DETALLE], ...filas.map((f) => filaDetalle(f).map((x) => (typeof x === 'number' ? dec(x) : x)))]);
}

/** Estadísticas por sección: agregados por jornada (participación, finalización y precisión) */
export function estadisticasSeccion(d: ResumenDocente): { jornada: number; fecha: string; participantes: number; completadas: number; revision: number; validos: number; correctas: number; precision: number | null; minutosMedios: number | null }[] {
  return (d.calendario ?? []).map((c) => {
    const js = d.estudiantes.flatMap((e) => (e.resumen?.por_jornada ?? []).filter((j) => j.numero === c.numero));
    const validos = js.reduce((s, j) => s + j.validos, 0), correctas = js.reduce((s, j) => s + j.correctas, 0);
    const iniciadas = js.filter((j) => j.estado !== 'pendiente');
    return {
      jornada: c.numero, fecha: c.fecha, participantes: iniciadas.length, completadas: js.filter((j) => j.estado === 'completada').length,
      revision: js.filter((j) => j.revision).length, validos, correctas, precision: pct(correctas, validos),
      minutosMedios: iniciadas.length ? Math.round(iniciadas.reduce((s, j) => s + j.segundos, 0) / iniciadas.length / 6) / 10 : null,
    };
  });
}

export function csvEstadisticas(d: ResumenDocente): string {
  const xs = estadisticasSeccion(d);
  return toCsv([['Jornada', 'Fecha', 'Participantes', 'Completadas', 'Para revisión', 'Intentos válidos', 'Correctas', '% aciertos', 'Minutos medios'],
    ...xs.map((x) => [x.jornada, x.fecha, x.participantes, x.completadas, x.revision, x.validos, x.correctas, dec(x.precision), dec(x.minutosMedios)])]);
}

export async function xlsxMaraton(d: ResumenDocente, detalle: FilaExportacion[]): Promise<Blob> {
  const obj = (cols: readonly string[], fila: (string | number | null)[]) => Object.fromEntries(cols.map((c, i) => [c, fila[i]]));
  const est = estadisticasSeccion(d);
  const jornadas = d.estudiantes.flatMap((e) => (e.resumen?.por_jornada ?? []).map((j) => ({
    ID: e.login_id ?? '', Estudiante: e.nombre, Jornada: j.numero, Fecha: j.fecha, Estado: j.estado, 'Vía': j.via ?? '', Revisión: j.revision ? 'sí' : '',
    Motivo: j.motivo ?? '', Presentados: j.presentados, 'Intentos válidos': j.validos, Correctas: j.correctas, Incorrectas: j.incorrectas, 'No puedo': j.no_puedo,
    Cambios: j.cambios, Anticipadas: j.anticipadas, Minutos: min(j.segundos), Unidades: j.unidades ?? null, 'Nivel medio': j.nivel_medio, 'Nivel máximo': j.nivel_maximo,
  })));
  const hojas: HojaXlsx[] = [
    { nombre: 'Resumen', columnas: [...COLUMNAS_RESUMEN], filas: d.estudiantes.map((e) => obj(COLUMNAS_RESUMEN, filaResumen(e))) },
    { nombre: 'Jornadas', columnas: Object.keys(jornadas[0] ?? { ID: '' }), filas: jornadas },
    { nombre: 'Problemas', columnas: [...COLUMNAS_DETALLE], filas: detalle.map((f) => obj(COLUMNAS_DETALLE, filaDetalle(f))) },
    { nombre: 'Sección', columnas: ['jornada', 'fecha', 'participantes', 'completadas', 'revision', 'validos', 'correctas', 'precision', 'minutosMedios'], filas: est },
  ];
  const r = await crearXlsx(hojas);
  return new Blob(r.partes as BlobPart[], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function descargarBlob(nombre: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
