/** Centro de mando del profesor: lógica pura del tablero. La base de datos se prueba en supabase/pruebas/tablero_docente.sql. */
import { describe, expect, it } from 'vitest';
import {
  GRUPOS_SECCION, bandeja, buscarEstudiantes, deSeccion, grupoDePestana, porDia, riesgo, seccionValida, siguientePorRevisar, tableroDesdeResumen,
  textoEvento, totales, type EventoTablero, type SeccionTablero, type Tablero,
} from '@/lib/tablero';
import type { SeccionResumen } from '@/api/tipos';
import type { Aviso } from '@/lib/resumenSemanal';
import { HERRAMIENTAS_DOCENTE, herramientasPorGrupo } from '@/lib/herramientasDocente';

const sec = (p: Partial<SeccionTablero> & { class_id: string }): SeccionTablero => ({
  name: `Sección ${p.class_id}`, term: '2026-2', course_id: 'k1', course_title: 'Física', laboratorio: false, estudiantes: 30, abiertas: 0, por_revisar: 0,
  conectados: 0, archivos_por_revisar: 0, solicitudes_acceso: 0, asistencia: null, examenes: [], no_entregaron: 0, sin_entrar: 0, ...p,
});
const tablero = (secciones: SeccionTablero[]): Tablero => ({ ahora: '2026-11-10T15:00:00Z', vivo: true, secciones });

describe('tablero sin la migración 92', () => {
  const resumen = [
    { class_id: 'a', name: 'A', term: '', archived: false, course_id: 'k1', course_title: 'Física', students: 28, open_activities: 2, pending_review: 3 },
    { class_id: 'z', name: 'Vieja', term: '2025', archived: true, course_id: 'k1', course_title: 'Física', students: 9, open_activities: 0, pending_review: 0 },
  ] as unknown as SeccionResumen[];
  const t = tableroDesdeResumen(resumen, new Date('2026-11-10T15:00:00Z'));

  it('usa lo conocido, omite las archivadas y deja lo desconocido en null', () => {
    expect(t.vivo).toBe(false);
    expect(t.secciones).toHaveLength(1);
    expect(t.secciones[0]).toMatchObject({ class_id: 'a', estudiantes: 28, abiertas: 2, por_revisar: 3, conectados: null, no_entregaron: null, term: null });
  });
  it('los totales no inventan conectados y la bandeja solo trae lo que se sabe', () => {
    expect(totales(t.secciones)).toMatchObject({ estudiantes: 28, conectados: null, presentes: null, enExamen: 0 });
    expect(bandeja(t.secciones).map((p) => p.clave)).toEqual(['a-revision']);
    expect(riesgo(t.secciones)).toEqual([]);
  });
});

describe('sección elegida', () => {
  const t = tablero([sec({ class_id: 'a' }), sec({ class_id: 'b' })]);
  it('una sección que ya no existe equivale a «todas»', () => {
    expect(seccionValida(t, 'b')).toBe('b');
    expect(seccionValida(t, 'x')).toBeNull();
    expect(seccionValida(t, null)).toBeNull();
    expect(deSeccion(t, null)).toHaveLength(2);
    expect(deSeccion(t, 'b').map((s) => s.class_id)).toEqual(['b']);
  });
});

describe('totales', () => {
  it('suma conectados, exámenes y asistencia de hoy', () => {
    const x = totales([
      sec({ class_id: 'a', conectados: 4, abiertas: 1, asistencia: { session_id: 's', abierta: true, abierta_en: '', presentes: 20 },
        examenes: [{ activity_id: 'e', title: 'Parcial', closes_at: null, en_curso: 7, entregados: 3, convocados: 30 }] }),
      sec({ class_id: 'b', conectados: 1, abiertas: 2 }),
    ]);
    expect(x).toEqual({ estudiantes: 60, conectados: 5, abiertas: 3, enExamen: 7, examenes: 1, presentes: 20, asistenciaAbierta: true });
  });
});

describe('bandeja de pendientes', () => {
  const secs = [
    sec({ class_id: 'a', name: 'A', por_revisar: 2, archivos_por_revisar: 5 }),
    sec({ class_id: 'b', name: 'B', laboratorio: true, por_revisar: 9, archivos_por_revisar: 1, solicitudes_acceso: 1 }),
  ];
  const semana: (Aviso & { ruta: string | null })[] = [
    { clave: 'a-coinc', texto: '2 coincidencias', tono: 'amber', seccion: 'Física · A', destino: { pestana: 'coincidencias', class_id: 'a' }, ruta: '/docente/clases/a?t=coincidencias' },
    { clave: 'otra', texto: 'de otra sección', tono: 'red', seccion: 'Otra', destino: { pestana: 'control', class_id: 'zz' }, ruta: null },
    { clave: 'k1-banco', texto: '3 preguntas sin publicar', tono: 'gray', seccion: 'Física', destino: { pagina: 'banco', course_id: 'k1' }, ruta: '/docente/ejercicios?curso=k1&estado=borrador' },
  ];
  const b = bandeja(secs, semana);

  it('ordena por urgencia y, dentro, por cantidad', () => {
    expect(b.map((p) => p.clave)).toEqual(['b-acceso', 'b-revision', 'a-revision', 'a-archivos', 'b-archivos', 'semana-a-coinc', 'semana-k1-banco']);
  });
  it('cada pendiente lleva a donde se resuelve', () => {
    const ruta = Object.fromEntries(b.map((p) => [p.clave, p.ruta]));
    expect(ruta['b-acceso']).toBe('/gestion-acceso');
    expect(ruta['a-revision']).toBe('/docente/clases/a?t=revision');
    expect(ruta['a-archivos']).toBe('/docente/clases/a?t=entregas');
    expect(ruta['b-archivos']).toBe('/docente/clases/b?t=controles');
  });
  it('singular y plural', () => {
    expect(b.find((p) => p.clave === 'b-archivos')!.texto).toBe('1 control entregado sin revisar');
    expect(b.find((p) => p.clave === 'a-archivos')!.texto).toBe('5 archivos recibidos sin revisar');
    expect(b.find((p) => p.clave === 'b-acceso')!.texto).toContain('1 solicitud de acceso espera');
  });
  it('al filtrar una sección, los avisos de la semana de las demás no aparecen', () => {
    expect(bandeja([secs[1]], semana).map((p) => p.clave)).toEqual(['b-acceso', 'b-revision', 'b-archivos', 'semana-k1-banco']);
  });
  it('sin pendientes, vacía', () => expect(bandeja([sec({ class_id: 'c' })])).toEqual([]));
});

describe('estudiantes en riesgo', () => {
  it('solo recuentos, de mayor a menor, con destino en la sección', () => {
    const r = riesgo([sec({ class_id: 'a', name: 'A', no_entregaron: 1, sin_entrar: 6 }), sec({ class_id: 'b', name: 'B', no_entregaron: 4 })]);
    expect(r.map((x) => [x.clave, x.n])).toEqual([['a-sinentrar', 6], ['b-noentrego', 4], ['a-noentrego', 1]]);
    expect(r[2].texto).toBe('1 estudiante no entregó alguna actividad cerrada este mes');
    expect(r[1].ruta).toBe('/docente/clases/b?t=seguimiento');
    expect(r[0].ruta).toBe('/docente/clases/a?t=estudiantes');
  });
});

describe('línea de tiempo', () => {
  const ev = (p: Partial<EventoTablero>): EventoTablero => ({ tipo: 'entregas', class_id: 'a', seccion: 'A', titulo: 'Práctica 3', modo: 'practice', n: 2, cuando: '2026-11-10T14:00:00Z', ref: 'act1', ...p });

  it('texto y destino de cada tipo', () => {
    expect(textoEvento(ev({}))).toMatchObject({ texto: '2 entregas de «Práctica 3»', ruta: '/docente/actividades/act1' });
    expect(textoEvento(ev({ tipo: 'archivos', modo: 'control', n: 1, titulo: 'Control 2' }))).toMatchObject({ texto: '1 archivo subido a «Control 2»', ruta: '/docente/clases/a?t=controles' });
    expect(textoEvento(ev({ tipo: 'archivos', modo: 'buzon' })).ruta).toBe('/docente/clases/a?t=entregas');
    expect(textoEvento(ev({ tipo: 'asistencia', modo: 'cerrada', n: 25 })).texto).toBe('Asistencia pasada: 25 presentes');
    expect(textoEvento(ev({ tipo: 'aviso', titulo: 'Cambio de aula' })).texto).toBe('Aviso publicado: «Cambio de aula»');
    expect(textoEvento(ev({ tipo: 'cierre', n: 1 })).texto).toBe('Cerró «Práctica 3»: entregó 1 estudiante');
  });
  it('agrupa por día de Santo Domingo: hoy, ayer y fecha', () => {
    const ahora = new Date('2026-11-10T15:00:00Z'); // 11:00 en Santo Domingo
    const d = porDia([
      ev({ cuando: '2026-11-10T02:30:00Z', ref: 'noche' }), // 22:30 del día 9 en Santo Domingo → ayer
      ev({ cuando: '2026-11-10T14:00:00Z', ref: 'hoy' }),
      ev({ cuando: '2026-11-07T14:00:00Z', ref: 'antes' }),
    ], ahora);
    expect(d.map((g) => g.dia.toLowerCase())).toEqual(['hoy', 'ayer', expect.stringContaining('7 de noviembre')]);
    expect(d.map((g) => g.eventos.map((e) => e.ref))).toEqual([['hoy'], ['noche'], ['antes']]);
  });
});

describe('buscador de estudiantes', () => {
  const lista = [
    { user_id: '1', full_name: 'María José Pérez', student_code: '100123456', class_id: 'a', class_name: 'A', course_title: 'Física' },
    { user_id: '2', full_name: 'José Ángel Núñez', student_code: '100999888', class_id: 'a', class_name: 'A', course_title: 'Física' },
    { user_id: '3', full_name: 'Ana Peña', student_code: null, class_id: 'b', class_name: 'B', course_title: 'Física' },
  ];
  const nombres = (q: string) => buscarEstudiantes(lista, q).map((e) => e.user_id);

  it('ignora tildes y mayúsculas; todas las palabras deben aparecer', () => {
    expect(nombres('nunez')).toEqual(['2']);
    expect(nombres('PEREZ maria')).toEqual(['1']);
    expect(nombres('jose')).toEqual(['2', '1']); // primero quien empieza por la consulta
    expect(nombres('jose xyz')).toEqual([]);
  });
  it('por matrícula: exacta o por su comienzo', () => {
    expect(nombres('100999888')).toEqual(['2']);
    expect(nombres('1001')).toEqual(['1']);
  });
  it('menos de dos caracteres no busca; respeta el límite', () => {
    expect(nombres('a')).toEqual([]);
    expect(buscarEstudiantes(lista, 'pe', 1)).toHaveLength(1);
  });
});

describe('pestañas de la sección agrupadas', () => {
  it('cada pestaña pertenece a un solo grupo y no falta ninguna', () => {
    const todas = GRUPOS_SECCION.flatMap((g) => [...g.pestanas]);
    expect(new Set(todas).size).toBe(todas.length);
    expect([...todas].sort()).toEqual(['actividades', 'asistencia', 'avisos', 'calificaciones', 'clases', 'coincidencias', 'controles', 'entregas', 'estadisticas',
      'estudiantes', 'pes', 'programa', 'regularizacion', 'revision', 'seguimiento']);
  });
  it('los enlaces ?t= existentes caen en su grupo; lo desconocido, en el primero', () => {
    expect(grupoDePestana('revision')).toBe('evaluacion');
    expect(grupoDePestana('seguimiento')).toBe('personas');
    expect(grupoDePestana('controles')).toBe('entregas');
    expect(grupoDePestana('programa')).toBe('clases');
    expect(grupoDePestana('loquesea')).toBe('personas');
  });
});

describe('revisar la siguiente', () => {
  const cola = [{ attempt_id: 'i1', response_id: 'r1' }, { attempt_id: 'i1', response_id: 'r2' }, { attempt_id: 'i2', response_id: 'r3' }];
  it('pasa al primer intento distinto del actual; al final, null', () => {
    expect(siguientePorRevisar(cola, 'i1')).toEqual({ attempt_id: 'i2', response_id: 'r3' });
    expect(siguientePorRevisar(cola, 'i2')).toEqual({ attempt_id: 'i1', response_id: 'r1' });
    expect(siguientePorRevisar(cola.slice(0, 2), 'i1')).toBeNull();
  });
});

describe('herramientas del profesor', () => {
  it('las de administración solo para el administrador; rutas sin repetir', () => {
    const rutas = HERRAMIENTAS_DOCENTE.map((h) => h.to);
    expect(new Set(rutas).size).toBe(rutas.length);
    const profe = herramientasPorGrupo(false).flatMap((g) => g.items);
    expect(profe.some((h) => h.admin)).toBe(false);
    expect(herramientasPorGrupo(true).flatMap((g) => g.items)).toHaveLength(HERRAMIENTAS_DOCENTE.length);
  });
});
