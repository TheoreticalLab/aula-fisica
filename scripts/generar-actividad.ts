/**
 * Convierte una actividad escrita en privado/actividades/<nombre>.ts (enunciados + claves) en un archivo de
 * «datos privados» privado/datos/<marca>_<nombre>.sql, que luego pasa por el flujo normal:
 * npm run probar → npm run plan → autorización → npm run aplicar.
 *
 *   ./node_modules/.bin/vite-node scripts/generar-actividad.ts privado/actividades/practica-1d.ts
 *
 * Antes de escribir nada comprueba cada ejercicio con el mismo motor que califica en el servidor: la clave
 * se califica como correcta, las alternativas también, y los errores típicos no. El SQL resultante es
 * idempotente (no duplica si se ejecuta dos veces) y termina con una verificación que aborta la transacción
 * si algo no cuadra. Contiene claves de respuesta: vive en privado/ (excluido de git).
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import type { Difficulty, ExerciseCategory, ExerciseDef, ExerciseKeyDef } from '../contenido/tipos';
import { grade, validateNumericKey } from '../supabase/functions/_shared/calificacion/calificar';
import { validarClaveVariante } from './biblioteca/validar';
import type { EjercicioBiblioteca } from './biblioteca/tipos';
import { loadContent, ROOT } from './cargar-contenido';
import { COURSE } from '../contenido/unidades';
import { checkMarkdown } from './validar-contenido';
import { analizarTexto, MAX_SEGUNDOS, MIN_SEGUNDOS, segundosSugeridos } from '../src/lib/lectura';

export function tiempoLectura(a: { lectura?: { texto: string; minSegundos?: number } }): number {
  return a.lectura ? a.lectura.minSegundos ?? segundosSugeridos(a.lectura.texto) : 0;
}

export interface EjercicioActividad {
  id: string;
  /** Slug de la lección del curso a la que pertenece (para estadísticas y el banco del profesor). Opcional en las
   *  asignaturas sin lecciones (laboratorio). */
  leccion?: string;
  category: ExerciseCategory;
  difficulty: Difficulty;
  concepts: string[];
  prompt: string;
  /** 'open' = desarrollo escrito con rúbrica (revisión docente). */
  format: 'choice' | 'numeric' | 'open';
  options?: string[];
  figure?: ExerciseDef['figure'];
  unitHint?: string;
  points?: number;
  clave: ExerciseKeyDef;
}

export interface ActividadDef {
  /** Nombre corto y estable (se usa en el nombre del archivo y para el id de la actividad). */
  clave: string;
  /** Nombre exacto de la sección (clase) donde se crea, o '*' = una copia en CADA sección activa de la asignatura
   *  (al menos una; las secciones creadas después se cubren aplicando de nuevo el archivo). */
  seccion: string;
  /** Código de la asignatura (courses.code). */
  curso: string;
  titulo: string;
  instrucciones: string;
  ajustes: {
    modo: 'practice' | 'exam'; intentosPorEjercicio: number; pistas: boolean; revelar: 'immediate' | 'after_submit' | 'after_close' | 'never'; publicada: boolean;
    /** Intentos por estudiante (sin indicar: sin límite). */
    maxIntentos?: number;
  };
  /** Motor de examen (migraciones 35 y 85): una pregunta a la vez, duración oficial y protecciones. */
  examen?: {
    duracionMin: number; navegacion: 'libre' | 'solo_adelante'; sinSaltos: boolean;
    /** Bloquear al salir: el código fijo se genera al azar y nadie lo conoce; el profesor usa códigos temporales. */
    bloquearAlSalir: boolean; impedirCopiar: boolean;
  };
  /** Apertura y cierre programados (ISO 8601 con desfase explícito, p. ej. '2026-11-13T18:00:00-04:00').
   *  El servidor no entrega preguntas ni deja empezar antes de la apertura, y el reloj del examen no pasa del cierre. */
  apertura?: string;
  cierre?: string;
  /** Calculadora científica integrada permitida (migración 93). Sin indicar: no (y no se toca la columna). */
  calculadora?: boolean;
  /** Puntuación total esperada (se comprueba). */
  puntosTotales?: number;
  /** Lectura cronometrada antes de los ejercicios (requiere la migración 10). Sin minSegundos, se calcula del texto. */
  lectura?: { texto: string; minSegundos?: number };
  /** Solo con una sección concreta: slug de la lección del curso a la que se asocia la actividad (activities.lesson_id). */
  leccionActividad?: string;
  /**
   * Solo con una sección concreta: slug de una unidad del curso que debe quedar PUBLICADA para los estudiantes, en la
   * misma transacción que la actividad. Pasa de «borrador»/«preparado» a «publicado»; si está archivada u oculta, aborta
   * (eso lo decide el profesor). Si la actividad tiene leccionActividad, esa lección debe pertenecer a esta unidad.
   */
  publicarUnidad?: string;
  ejercicios: EjercicioActividad[];
}

const TAG = '$aula_a9$';
function q(s: string | null | undefined): string {
  if (s === null || s === undefined) return 'null';
  if (s.includes(TAG)) throw new Error(`El texto contiene el delimitador ${TAG}`);
  return `${TAG}${s}${TAG}`;
}
const j = (v: unknown) => (v === undefined || v === null ? 'null' : `${q(JSON.stringify(v))}::jsonb`);
const arr = (xs: string[]) => `array[${xs.map(q).join(', ')}]::text[]`;

/** uuid estable a partir de un texto (para que la actividad no se duplique al repetir el archivo). */
export function uuidEstable(texto: string): string {
  const h = createHash('sha256').update(texto).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export async function validarActividad(a: ActividadDef): Promise<string[]> {
  const p: string[] = [];
  const units = await loadContent();
  const lecciones = new Set(units.flatMap((u) => u.lessons.map((l) => l.lesson.slug)));
  const conceptos = new Set(units.flatMap((u) => u.lessons.flatMap((l) => l.lesson.concepts.map((c) => c.slug))));
  if (!/^[a-z0-9-]+$/.test(a.clave)) p.push(`clave de actividad inválida: ${a.clave}`);
  if (!a.ejercicios.length) p.push('la actividad no tiene ejercicios');
  checkMarkdown('instrucciones', a.instrucciones, p);
  if (a.lectura) {
    if (!a.lectura.texto.trim()) p.push('la lectura no tiene texto');
    checkMarkdown('lectura', a.lectura.texto, p);
    const seg = tiempoLectura(a);
    if (seg < MIN_SEGUNDOS || seg > MAX_SEGUNDOS) p.push(`tiempo de lectura fuera de rango: ${seg} s`);
  }
  if (a.seccion === '*' && (a.leccionActividad || a.publicarUnidad)) p.push('leccionActividad y publicarUnidad solo se admiten con una sección concreta');
  for (const [k, v] of [['leccionActividad', a.leccionActividad], ['publicarUnidad', a.publicarUnidad]] as const) {
    if (v !== undefined && !/^[a-z0-9-]+$/.test(v)) p.push(`${k} inválido: ${v}`);
  }
  if (a.ajustes.modo === 'exam' && (a.ajustes.revelar === 'immediate' || a.ajustes.pistas)) p.push('en evaluación no puede haber pistas ni retroalimentación inmediata');
  if (a.examen && a.ajustes.modo !== 'exam') p.push('el motor de examen solo se aplica a evaluaciones');
  if (a.examen && (a.examen.duracionMin < 1 || a.examen.duracionMin > 360)) p.push('duración del examen fuera de 1–360 min');
  if (a.examen?.sinSaltos && a.examen.navegacion !== 'solo_adelante') p.push('«sin saltos» requiere navegación solo hacia adelante');
  if (a.ajustes.maxIntentos !== undefined && (a.ajustes.maxIntentos < 1 || a.ajustes.maxIntentos > 50)) p.push('intentos por estudiante fuera de 1–50');
  for (const [k, v] of [['apertura', a.apertura], ['cierre', a.cierre]] as const) {
    if (v !== undefined && (!/(Z|[+-]\d{2}:\d{2})$/.test(v) || Number.isNaN(Date.parse(v)))) p.push(`${k} inválida (ISO 8601 con desfase explícito): ${v}`);
  }
  if (a.seccion === '*' && (a.apertura || a.cierre || a.calculadora)) p.push('apertura, cierre y calculadora solo se admiten con una sección concreta');
  if (a.apertura && a.cierre && Date.parse(a.apertura) >= Date.parse(a.cierre)) p.push('la apertura debe ser anterior al cierre');
  if (a.examen && a.apertura && a.cierre && a.examen.duracionMin * 60_000 > Date.parse(a.cierre) - Date.parse(a.apertura)) {
    p.push('la duración del examen supera la ventana entre apertura y cierre');
  }
  if (a.puntosTotales !== undefined) {
    const suma = a.ejercicios.reduce((s, e) => s + (e.points ?? 1), 0);
    if (suma !== a.puntosTotales) p.push(`los puntos suman ${suma}, no ${a.puntosTotales}`);
  }
  const ids = new Set<string>();
  for (const e of a.ejercicios) {
    const at = `${e.id}:`;
    if (ids.has(e.id)) p.push(`${at} id repetido`);
    ids.add(e.id);
    // contenido/ solo describe la asignatura de COURSE; en otras (lecciones de la biblioteca, ya en la base de datos)
    // la comprobación la hace el propio SQL, que aborta si algún ejercicio queda sin lección
    const local = a.curso === COURSE.code;
    if (local && e.leccion !== undefined && !lecciones.has(e.leccion)) p.push(`${at} la lección «${e.leccion}» no existe`);
    for (const c of e.concepts) if (local && !conceptos.has(c)) p.push(`${at} el concepto «${c}» no existe`);
    if (!e.prompt.trim()) p.push(`${at} enunciado vacío`);
    // fórmulas que KaTeX no pueda dibujar
    checkMarkdown(`${e.id} enunciado`, e.prompt, p);
    (e.options ?? []).forEach((o, i) => checkMarkdown(`${e.id} opción ${i + 1}`, o, p));
    e.clave.hints.forEach((h, i) => checkMarkdown(`${e.id} pista ${i + 1}`, h, p));
    checkMarkdown(`${e.id} explicación`, e.clave.explanation, p);
    // en una evaluación no hay pistas (no se muestran); en una práctica son obligatorias
    if (!e.clave.hints.length && a.ajustes.modo !== 'exam') p.push(`${at} sin pistas`);
    if (e.points !== undefined && !(e.points > 0)) p.push(`${at} puntos no válidos`);
    if (!e.clave.explanation.trim()) p.push(`${at} sin explicación`);
    const k = e.clave.answer;
    if (k.format !== e.format) p.push(`${at} el formato de la clave (${k.format}) no coincide con el del ejercicio (${e.format})`);
    if (k.format === 'choice') {
      const n = e.options?.length ?? 0;
      if (n < 2) p.push(`${at} necesita al menos 2 opciones`);
      if (!k.correct.length || k.correct.some((i) => i < 0 || i >= n)) p.push(`${at} índice de opción correcta fuera de rango`);
      if (grade(k, { selected: k.correct }, n).status !== 'correct') p.push(`${at} la opción correcta no se califica como correcta`);
      for (const i of Object.keys(k.optionFeedback ?? {}).map(Number)) {
        if (k.correct.includes(i)) p.push(`${at} hay retroalimentación de error en una opción correcta (${i})`);
      }
    } else if (k.format === 'numeric' && k.variante) {
      // variante por intento: se prueba con muchas versiones (la misma comprobación que la biblioteca)
      validarClaveVariante(at, e as unknown as EjercicioBiblioteca, p, false);
    } else if (k.format === 'numeric') {
      for (const m of validateNumericKey(k)) p.push(`${at} ${m}`);
      for (const v of [k.value, ...(k.alternatives ?? [])]) {
        const r = grade(k, { text: v });
        if (r.status !== 'correct') p.push(`${at} «${v}» debería ser correcta y sale ${r.status} (${r.messages.join(' ')})`);
      }
      for (const ce of k.commonErrors ?? []) {
        if (grade(k, { text: ce.value }).status === 'correct') p.push(`${at} el error típico «${ce.value}» cae dentro de la tolerancia`);
      }
    } else if (k.format === 'open') {
      if (!k.rubric.trim()) p.push(`${at} la pregunta de desarrollo no tiene rúbrica`);
      checkMarkdown(`${e.id} rúbrica`, k.rubric, p);
      if (grade(k, { text: 'respuesta' }).status !== 'pending_review') p.push(`${at} el desarrollo no queda pendiente de revisión`);
    }
  }
  return p;
}

/** Ejercicios (de la asignatura, compartidos por sus secciones) y sus claves: idempotente por (curso, slug). */
function sqlEjercicios(a: ActividadDef, curso: string, out: string[]) {
  a.ejercicios.forEach((e, i) => {
    out.push(`\n-- ${e.id}`);
    out.push(`insert into public.exercises (course_id, lesson_id, slug, position, category, difficulty, role, format, concepts, prompt, options, multiple, figure, simulation, unit_hint, points, published, created_by)
select ${curso}, ${e.leccion ? `(select l.id from public.lessons l where l.course_id = ${curso} and l.slug = ${q(e.leccion)})` : 'null'}, ${q(e.id)}, ${i + 1},
  ${q(e.category)}::public.exercise_category, ${q(e.difficulty)}::public.exercise_difficulty, 'bank'::public.exercise_role, ${q(e.format)}::public.exercise_format,
  ${arr(e.concepts)}, ${q(e.prompt)}, ${j(e.options)}, false, ${j(e.figure)}, null, ${q(e.unitHint ?? null)}, ${e.points ?? 1}, true,
  (select id from public.profiles where role = 'admin' order by created_at limit 1)
on conflict (course_id, slug) do nothing;`);
    out.push(`insert into public.exercise_keys (exercise_id, answer, hints, explanation)
select e.id, ${j(e.clave.answer)}, ${j(e.clave.hints)}, ${q(e.clave.explanation)} from public.exercises e where e.course_id = ${curso} and e.slug = ${q(e.id)}
on conflict (exercise_id) do nothing;`);
  });
}

/**
 * Una copia de la actividad en CADA sección activa de la asignatura (seccion: '*'). Id estable por sección
 * (md5 de asignatura + clave + sección): repetir el archivo no duplica nada y cubre las secciones nuevas. La
 * actividad se crea oculta, se comprueba (preguntas, claves, puntos, configuración de examen) y SOLO entonces se
 * publica, en la misma transacción. Una actividad ya existente no se toca (si el profesor la ocultó, sigue oculta).
 */
function sqlTodasLasSecciones(a: ActividadDef): string {
  const curso = `(select id from public.courses where code = ${q(a.curso)})`;
  const n = a.ejercicios.length;
  const s = a.ajustes;
  const x = a.examen;
  const total = a.ejercicios.reduce((t, e) => t + (e.points ?? 1), 0);
  const out: string[] = [];
  out.push(`-- Datos privados generados por scripts/generar-actividad.ts («${a.clave}»). CONTIENE CLAVES DE RESPUESTA: no lo publique.`);
  out.push(`-- Actividad: ${a.titulo} · todas las secciones activas de ${a.curso} · ${n} ejercicios · ${total} puntos. Idempotente.`);
  out.push(`do $chk$ begin
  if ${curso} is null then raise exception 'No existe la asignatura %', ${q(a.curso)}; end if;
  if not exists (select 1 from public.classes c where c.course_id = ${curso} and not c.archived) then
    raise exception 'La asignatura % no tiene ninguna sección activa: créela en el panel («Crear una sección») y vuelva a aplicar', ${q(a.curso)};
  end if;
end $chk$;`);
  sqlEjercicios(a, curso, out);
  out.push(`\ndo $act$
declare v_curso uuid := ${curso}; c record; v_act uuid; v_nueva boolean; v_n integer := 0;
begin
  for c in select cl.id, cl.name from public.classes cl where cl.course_id = v_curso and not cl.archived order by cl.created_at loop
    v_act := md5(${q(`actividad:${a.curso}:${a.clave}:`)} || c.id::text)::uuid;
    v_nueva := not exists (select 1 from public.activities where id = v_act);
    insert into public.activities (id, class_id, title, instructions, mode, max_tries_per_item, max_attempts, reveal_policy, hints_enabled, published, created_by)
      values (v_act, c.id, ${q(a.titulo)}, ${q(a.instrucciones)}, ${q(s.modo)}::public.activity_mode, ${s.intentosPorEjercicio}, ${s.maxIntentos ?? 'null'},
        ${q(s.revelar)}::public.reveal_policy, ${s.pistas}, false, (select id from public.profiles where role = 'admin' order by created_at limit 1))
      on conflict (id) do nothing;
    insert into public.activity_items (activity_id, exercise_id, position)
      select v_act, e.id, x.pos from unnest(${arr(a.ejercicios.map((e) => e.id))}) with ordinality as x(slug, pos)
      join public.exercises e on e.course_id = v_curso and e.slug = x.slug
      on conflict (activity_id, exercise_id) do nothing;${x ? `
    insert into public.exam_settings (activity_id, presentacion, navegacion, duracion_s, pausas_permitidas, sin_saltos, bloquear_al_salir, impedir_copiar, codigo_salida_hash)
      values (v_act, 'una_a_la_vez', ${q(x.navegacion)}, ${x.duracionMin * 60}, false, ${x.sinSaltos}, ${x.bloquearAlSalir}, ${x.impedirCopiar},
        ${x.bloquearAlSalir ? `extensions.crypt(encode(extensions.gen_random_bytes(24), 'base64'), extensions.gen_salt('bf'))` : 'null'})
      on conflict (activity_id) do nothing;` : ''}
    -- comprobaciones ANTES de publicar
    if (select count(*) from public.activity_items where activity_id = v_act) <> ${n} then raise exception 'La actividad de % no quedó con ${n} ejercicios', c.name; end if;
    if (select count(*) from public.activity_items i join public.exercise_keys k on k.exercise_id = i.exercise_id where i.activity_id = v_act) <> ${n} then
      raise exception 'Faltan claves de respuesta en la actividad de %', c.name;
    end if;
    if (select sum(coalesce(i.points, e.points)) from public.activity_items i join public.exercises e on e.id = i.exercise_id where i.activity_id = v_act) <> ${total} then
      raise exception 'La actividad de % no suma ${total} puntos', c.name;
    end if;
    if exists (select 1 from public.activity_items i join public.exercises e on e.id = i.exercise_id join public.exercise_keys k on k.exercise_id = e.id
               where i.activity_id = v_act and k.answer ->> 'format' <> e.format::text) then
      raise exception 'Formato de clave distinto del de la pregunta en %', c.name;
    end if;${x ? `
    if not exists (select 1 from public.exam_settings where activity_id = v_act and presentacion = 'una_a_la_vez' and duracion_s = ${x.duracionMin * 60}) then
      raise exception 'Falta la configuración de examen en %', c.name;
    end if;` : ''}
    if v_nueva and ${s.publicada} then update public.activities set published = true where id = v_act; end if;
    v_n := v_n + 1;
  end loop;
  raise notice 'Actividad «%» en % sección(es)', ${q(a.titulo)}, v_n;
end $act$;`);
  return out.join('\n') + '\n';
}

export function sqlActividad(a: ActividadDef): string {
  if (a.seccion === '*') return sqlTodasLasSecciones(a);
  const actId = uuidEstable(`actividad:${a.curso}:${a.clave}`);
  const curso = `(select id from public.courses where code = ${q(a.curso)})`;
  const clase = `(select c.id from public.classes c where c.course_id = ${curso} and c.name = ${q(a.seccion)} and not c.archived)`;
  const n = a.ejercicios.length;
  const out: string[] = [];
  out.push(`-- Datos privados generados por scripts/generar-actividad.ts («${a.clave}»). CONTIENE CLAVES DE RESPUESTA: no lo publique.`);
  out.push(`-- Actividad: ${a.titulo} · sección ${a.seccion} · ${n} ejercicios. Idempotente: no duplica nada si se repite.`);
  out.push(`do $chk$ begin
  if ${curso} is null then raise exception 'No existe la asignatura %', ${q(a.curso)}; end if;
  if (select count(*) from public.classes c where c.course_id = ${curso} and c.name = ${q(a.seccion)} and not c.archived) <> 1 then
    raise exception 'Debe haber exactamente una sección activa llamada %', ${q(a.seccion)};
  end if;
end $chk$;`);
  a.ejercicios.forEach((e, i) => {
    out.push(`\n-- ${e.id}`);
    out.push(`insert into public.exercises (course_id, lesson_id, slug, position, category, difficulty, role, format, concepts, prompt, options, multiple, figure, simulation, unit_hint, points, published, created_by)
select ${curso}, (select l.id from public.lessons l where l.course_id = ${curso} and l.slug = ${q(e.leccion)}), ${q(e.id)}, ${i + 1},
  ${q(e.category)}::public.exercise_category, ${q(e.difficulty)}::public.exercise_difficulty, 'bank'::public.exercise_role, ${q(e.format)}::public.exercise_format,
  ${arr(e.concepts)}, ${q(e.prompt)}, ${j(e.options)}, false, ${j(e.figure)}, null, ${q(e.unitHint ?? null)}, ${e.points ?? 1}, true,
  (select id from public.profiles where role = 'admin' order by created_at limit 1)
on conflict (course_id, slug) do nothing;`);
    out.push(`insert into public.exercise_keys (exercise_id, answer, hints, explanation)
select e.id, ${j(e.clave.answer)}, ${j(e.clave.hints)}, ${q(e.clave.explanation)} from public.exercises e where e.course_id = ${curso} and e.slug = ${q(e.id)}
on conflict (exercise_id) do nothing;`);
  });
  const s = a.ajustes;
  const lec = a.lectura ? { texto: a.lectura.texto, seg: tiempoLectura(a) } : null;
  const leccionAct = a.leccionActividad ? `(select l.id from public.lessons l where l.course_id = ${curso} and l.slug = ${q(a.leccionActividad)})` : null;
  if (a.publicarUnidad) {
    out.push(`\n-- la unidad «${a.publicarUnidad}» queda publicada para los estudiantes (no toca otras unidades; idempotente)`);
    out.push(`do $uni$ declare v_u record; begin
  select u.id, u.status, u.hidden into v_u from public.units u where u.course_id = ${curso} and u.slug = ${q(a.publicarUnidad)};
  if not found then raise exception 'No existe la unidad % en la asignatura %', ${q(a.publicarUnidad)}, ${q(a.curso)}; end if;
  if v_u.status = 'archivado' then raise exception 'La unidad % está archivada: no se publica automáticamente', ${q(a.publicarUnidad)}; end if;
  if v_u.hidden then raise exception 'La unidad % está oculta: no se publica automáticamente', ${q(a.publicarUnidad)}; end if;
  if v_u.status <> 'publicado' then update public.units set status = 'publicado' where id = v_u.id; end if;${a.leccionActividad ? `
  if not exists (select 1 from public.lessons l where l.unit_id = v_u.id and l.slug = ${q(a.leccionActividad)}) then
    raise exception 'La lección % no pertenece a la unidad %', ${q(a.leccionActividad)}, ${q(a.publicarUnidad)};
  end if;` : ''}
end $uni$;`);
  }
  out.push(`\n-- la actividad (${s.publicada ? 'publicada' : 'sin publicar: el profesor la abre desde su panel'})${lec ? ` · lectura cronometrada de ${lec.seg} s` : ''}`);
  const ts = (v: string | undefined) => (v ? `${q(v)}::timestamptz` : 'null');
  out.push(`insert into public.activities (id, class_id, title, instructions, mode, max_tries_per_item, max_attempts, opens_at, closes_at, ${a.calculadora ? 'calculadora, ' : ''}reveal_policy, hints_enabled, published, created_by${lec ? ', reading_text, reading_min_seconds' : ''}${leccionAct ? ', lesson_id' : ''})
values ('${actId}', ${clase}, ${q(a.titulo)}, ${q(a.instrucciones)}, ${q(s.modo)}::public.activity_mode, ${s.intentosPorEjercicio}, ${s.maxIntentos ?? 'null'},
  ${ts(a.apertura)}, ${ts(a.cierre)},${a.calculadora ? ' true,' : ''}
  ${q(s.revelar)}::public.reveal_policy, ${s.pistas}, ${s.publicada}, (select id from public.profiles where role = 'admin' order by created_at limit 1)${lec ? `, ${q(lec.texto)}, ${lec.seg}` : ''}${leccionAct ? `, ${leccionAct}` : ''})
on conflict (id) do nothing;`);
  const x = a.examen;
  if (x) {
    out.push(`insert into public.exam_settings (activity_id, presentacion, navegacion, duracion_s, pausas_permitidas, sin_saltos, bloquear_al_salir, impedir_copiar, codigo_salida_hash)
values ('${actId}', 'una_a_la_vez', ${q(x.navegacion)}, ${x.duracionMin * 60}, false, ${x.sinSaltos}, ${x.bloquearAlSalir}, ${x.impedirCopiar},
  ${x.bloquearAlSalir ? `extensions.crypt(encode(extensions.gen_random_bytes(24), 'base64'), extensions.gen_salt('bf'))` : 'null'})
on conflict (activity_id) do nothing;`);
  }
  out.push(`insert into public.activity_items (activity_id, exercise_id, position)
select '${actId}', e.id, x.pos from unnest(${arr(a.ejercicios.map((e) => e.id))}) with ordinality as x(slug, pos)
join public.exercises e on e.course_id = ${curso} and e.slug = x.slug
on conflict (activity_id, exercise_id) do nothing;`);
  out.push(`\ndo $chk$ begin
  if (select count(*) from public.activity_items where activity_id = '${actId}') <> ${n} then raise exception 'La actividad no quedó con ${n} ejercicios'; end if;
  if (select count(*) from public.activity_items i join public.exercise_keys k on k.exercise_id = i.exercise_id where i.activity_id = '${actId}') <> ${n} then
    raise exception 'Faltan claves de respuesta en la actividad';
  end if;
  if exists (select 1 from public.activity_items i join public.exercises e on e.id = i.exercise_id where i.activity_id = '${actId}' and e.lesson_id is null) then
    raise exception 'Algún ejercicio quedó sin lección';
  end if;${a.puntosTotales !== undefined ? `
  if (select sum(coalesce(i.points, e.points)) from public.activity_items i join public.exercises e on e.id = i.exercise_id where i.activity_id = '${actId}') <> ${a.puntosTotales} then
    raise exception 'La actividad no suma ${a.puntosTotales} puntos';
  end if;` : ''}${x ? `
  if not exists (select 1 from public.exam_settings where activity_id = '${actId}' and presentacion = 'una_a_la_vez' and navegacion = ${q(x.navegacion)}
                 and duracion_s = ${x.duracionMin * 60} and bloquear_al_salir = ${x.bloquearAlSalir} and sin_saltos = ${x.sinSaltos}) then
    raise exception 'La configuración del examen no quedó como se pidió';
  end if;` : ''}${a.apertura ? `
  if (select opens_at from public.activities where id = '${actId}') is distinct from ${ts(a.apertura)}
     or (select closes_at from public.activities where id = '${actId}') is distinct from ${ts(a.cierre)} then
    raise exception 'La apertura o el cierre no quedaron como se pidió';
  end if;` : ''}${leccionAct ? `
  if (select lesson_id from public.activities where id = '${actId}') is null then raise exception 'La actividad quedó sin lección asociada'; end if;` : ''}${a.publicarUnidad ? `
  if not exists (select 1 from public.units where course_id = ${curso} and slug = ${q(a.publicarUnidad)} and status = 'publicado' and not hidden) then
    raise exception 'La unidad % no quedó publicada', ${q(a.publicarUnidad)};
  end if;` : ''}
end $chk$;`);
  return out.join('\n') + '\n';
}

async function main() {
  const ruta = process.argv.slice(2).find((x) => x.endsWith('.ts'));
  if (!ruta) {
    console.error('Uso: vite-node scripts/generar-actividad.ts privado/actividades/<nombre>.ts');
    process.exit(1);
  }
  const abs = resolve(ruta);
  if (!abs.startsWith(join(ROOT, 'privado') + '/')) {
    console.error('La actividad (con sus claves) debe estar dentro de privado/.');
    process.exit(1);
  }
  const { actividad } = (await import(pathToFileURL(abs).href)) as { actividad: ActividadDef };
  const problemas = await validarActividad(actividad);
  if (problemas.length) {
    console.error('La actividad tiene problemas; corríjalos:\n' + problemas.map((x) => ' - ' + x).join('\n'));
    process.exit(1);
  }
  const dir = join(ROOT, 'privado', 'datos');
  mkdirSync(dir, { recursive: true });
  // conserva el nombre (y por tanto el orden) si la actividad ya se había generado antes
  const previo = existsSync(dir) ? readdirSync(dir).find((f) => f.endsWith(`_${actividad.clave}.sql`)) : undefined;
  const marca = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const archivo = previo ?? `${marca}_${actividad.clave}.sql`;
  writeFileSync(join(dir, archivo), sqlActividad(actividad), { mode: 0o600 });
  const nc = actividad.ejercicios.filter((e) => e.format === 'choice').length;
  const nn = actividad.ejercicios.filter((e) => e.format === 'numeric').length;
  const nd = actividad.ejercicios.filter((e) => e.format === 'open').length;
  const pts = actividad.ejercicios.reduce((t, e) => t + (e.points ?? 1), 0);
  console.log(`✔ ${actividad.ejercicios.length} ejercicios verificados con el motor de calificación (${nc} de selección, ${nn} numéricos, ${nd} de desarrollo; ${pts} puntos).`);
  if (actividad.lectura) {
    const t = analizarTexto(actividad.lectura.texto);
    const seg = tiempoLectura(actividad);
    console.log(`✔ Lectura: ${t.palabras} palabras, ${t.formulasLinea} fórmulas en línea, ${t.formulasBloque} destacadas → mínimo ${Math.floor(seg / 60)} min ${seg % 60} s.`);
  }
  console.log(`✔ privado/datos/${archivo} (desde ${basename(abs)})`);
  console.log('Siguiente: npm run probar → npm run plan → autorización → npm run aplicar -- --plan CÓDIGO');
}

// vite-node no deja la ruta del script en process.argv: se ejecuta siempre salvo cuando lo importan las pruebas
if (!process.env.VITEST) void main();
