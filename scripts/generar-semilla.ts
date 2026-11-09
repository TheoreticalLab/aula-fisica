/**
 * Genera privado/semilla.sql con el curso inicial (bloques, lecciones, conceptos, ejercicios y claves).
 *
 *   npm run semilla                 # inserta lo que falte; NO sobrescribe ediciones del profesor
 *   npm run semilla -- --actualizar # sobrescribe con el contenido de los archivos
 *   npm run semilla -- --bloques energia-momento,termodinamica --datos bloques-nuevos
 *       # solo esos bloques, como archivo de datos privados (privado/datos/<marca>_<nombre>.sql) para
 *       # plan/aplicar: sin begin/commit (aplicar abre la transacción), marca los bloques como disponibles
 *       # y comprueba al final que llegaron todas las lecciones y claves
 *
 * El archivo resultante contiene claves de respuesta: se guarda en privado/ (excluido de git) y se
 * ejecuta una vez en el editor SQL de Supabase. No lo suba a ningún sitio público.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { COURSE } from '../contenido/unidades';
import { loadContent, ROOT } from './cargar-contenido';
import { validateContent } from './validar-contenido';

const UPDATE = process.argv.includes('--actualizar');
const opcion = (n: string) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const BLOQUES = opcion('--bloques')?.split(',');
const DATOS = opcion('--datos');
const TAG = '$aula_q7$';
const PART_MARK = '--@@PARTE@@';

function q(s: string | null | undefined): string {
  if (s === null || s === undefined) return 'null';
  if (s.includes(TAG)) throw new Error(`El texto contiene el delimitador ${TAG}`);
  return `${TAG}${s}${TAG}`;
}
const j = (v: unknown) => (v === undefined || v === null ? 'null' : `${q(JSON.stringify(v))}::jsonb`);
const arr = (xs: string[]) => `array[${xs.map(q).join(', ')}]::text[]`;
const conflict = (target: string, sets: string[]) =>
  UPDATE ? `on conflict ${target} do update set ${sets.map((c) => `${c} = excluded.${c}`).join(', ')}` : `on conflict ${target} do nothing`;

async function main() {
  const all = await loadContent();
  const problems = validateContent(all, { requireKeys: true });
  const units = BLOQUES ? all.filter((u) => BLOQUES.includes(u.meta.slug)) : all;
  if (BLOQUES && units.length !== BLOQUES.length) throw new Error(`Bloques desconocidos en --bloques: ${BLOQUES.join(', ')}`);
  if (DATOS && !/^[a-z0-9-]+$/.test(DATOS)) throw new Error('--datos: use un nombre en minúsculas con guiones');
  if (problems.length) {
    console.error('El contenido tiene problemas; corríjalos antes de generar la semilla:\n' + problems.map((p) => ' - ' + p).join('\n'));
    process.exit(1);
  }
  const C = `'${COURSE.id}'::uuid`;
  const out: string[] = [];
  out.push('-- Semilla generada por scripts/generar-semilla.ts. CONTIENE CLAVES DE RESPUESTA: no la publique.');
  out.push(`-- Modo: ${UPDATE ? 'actualizar (sobrescribe)' : 'insertar solo lo que falta'}`);
  out.push('begin;');
  // escrituras de la semilla: no cuentan como personalizaciones del profesor (migración 11)
  out.push(`select set_config('aula.origen', 'biblioteca', true);`);
  out.push(
    `insert into public.courses (id, code, title, description) values (${C}, ${q(COURSE.code)}, ${q(COURSE.title)}, ${q(COURSE.description)}) ${conflict('(id)', ['code', 'title', 'description'])};`,
  );
  let nLessons = 0;
  let nExercises = 0;
  let firstWithLessons = true;
  for (const u of units) {
    // cada bloque con lecciones empieza una parte nueva (para pegar en el editor SQL por partes)
    if (u.lessons.length) {
      if (!firstWithLessons) out.push(PART_MARK);
      firstWithLessons = false;
    }
    out.push(`\n-- ${u.meta.title}`);
    out.push(
      `insert into public.units (course_id, slug, position, title, summary, coming_soon, planned_topics) values (${C}, ${q(u.meta.slug)}, ${u.position}, ${q(u.meta.title)}, ${q(u.meta.summary)}, ${u.meta.comingSoon}, ${arr(u.meta.plannedTopics)}) ${conflict('(course_id, slug)', ['position', 'title', 'summary', 'coming_soon', 'planned_topics'])};`,
    );
    if (DATOS && !u.meta.comingSoon && u.lessons.length) {
      out.push(`update public.units set coming_soon = false, updated_at = now() where course_id = ${C} and slug = ${q(u.meta.slug)} and coming_soon;`);
    }
    for (const ll of u.lessons) {
      const L = ll.lesson;
      nLessons++;
      out.push(`\n-- ${ll.file}: ${L.title}`);
      out.push(
        `insert into public.lessons (unit_id, course_id, slug, position, title, summary, theory, formulas, examples, simulation)
select u.id, ${C}, ${q(L.slug)}, ${ll.position}, ${q(L.title)}, ${q(L.summary)}, ${q(L.theory)}, ${j(L.formulas)}, ${j(L.examples)}, ${j(L.simulation)}
from public.units u where u.course_id = ${C} and u.slug = ${q(u.meta.slug)}
${conflict('(course_id, slug)', ['unit_id', 'position', 'title', 'summary', 'theory', 'formulas', 'examples', 'simulation'])};`,
      );
      const lessonId = `(select id from public.lessons where course_id = ${C} and slug = ${q(L.slug)})`;
      for (const c of L.concepts) {
        out.push(
          `insert into public.concepts (course_id, lesson_id, slug, name) values (${C}, ${lessonId}, ${q(c.slug)}, ${q(c.name)}) ${conflict('(course_id, slug)', ['lesson_id', 'name'])};`,
        );
      }
      L.exercises.forEach((e, i) => {
        nExercises++;
        out.push(
          `insert into public.exercises (course_id, lesson_id, slug, position, category, difficulty, role, format, concepts, prompt, options, multiple, figure, simulation, unit_hint, points)
values (${C}, ${lessonId}, ${q(e.id)}, ${i + 1}, ${q(e.category)}, ${q(e.difficulty)}, ${q(e.role)}, ${q(e.format)}, ${arr(e.concepts)}, ${q(e.prompt)}, ${j(e.options)}, ${!!e.multiple}, ${j(e.figure)}, ${j(e.simulation)}, ${q(e.unitHint ?? null)}, ${e.points ?? 1})
${conflict('(course_id, slug)', ['lesson_id', 'position', 'category', 'difficulty', 'role', 'format', 'concepts', 'prompt', 'options', 'multiple', 'figure', 'simulation', 'unit_hint', 'points'])};`,
        );
        const k = ll.keys?.[e.id];
        if (k) {
          out.push(
            `insert into public.exercise_keys (exercise_id, answer, hints, explanation)
select e.id, ${j(k.answer)}, ${j(k.hints)}, ${q(k.explanation)} from public.exercises e where e.course_id = ${C} and e.slug = ${q(e.id)}
${conflict('(exercise_id)', ['answer', 'hints', 'explanation'])};`,
          );
        }
      });
    }
  }
  if (DATOS) {
    const slugs = units.flatMap((u) => u.lessons.map((l) => l.lesson.slug));
    const ids = units.flatMap((u) => u.lessons.flatMap((l) => l.lesson.exercises.map((e) => e.id)));
    const body = out.slice(out.indexOf('begin;') + 1).filter((l) => l !== PART_MARK && !l.startsWith('insert into public.courses'));
    const check = `do $chk$ begin
  if (select count(*) from public.lessons where course_id = ${C} and slug = any(${arr(slugs)})) <> ${slugs.length} then
    raise exception 'Faltan lecciones de los bloques cargados';
  end if;
  if (select count(*) from public.exercises e join public.exercise_keys k on k.exercise_id = e.id
      where e.course_id = ${C} and e.slug = any(${arr(ids)})) <> ${ids.length} then
    raise exception 'Faltan ejercicios o claves de los bloques cargados';
  end if;
end $chk$;`;
    const marca = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    const path = join(ROOT, 'privado', 'datos', `${marca}_${DATOS}.sql`);
    const header = [
      `-- Bloques ${units.map((u) => u.meta.title).join(' · ')} del curso inicial, generados por scripts/generar-semilla.ts.`,
      '-- CONTIENE CLAVES DE RESPUESTA: no lo publique. Solo inserta lo que falta (no sobrescribe ediciones del profesor).',
    ];
    writeFileSync(path, [...header, ...body, check].join('\n') + '\n', 'utf8');
    console.log(`Datos escritos en ${path}: ${units.length} bloques, ${nLessons} lecciones, ${nExercises} ejercicios.`);
    return;
  }
  out.push('\n-- Los administradores forman parte del equipo docente del curso inicial');
  out.push(`insert into public.course_staff (course_id, user_id) select ${C}, p.id from public.profiles p where p.role = 'admin' on conflict do nothing;`);
  out.push('commit;');
  mkdirSync(join(ROOT, 'privado'), { recursive: true });
  const path = join(ROOT, 'privado', 'semilla.sql');
  writeFileSync(path, out.filter((l) => l !== PART_MARK).join('\n') + '\n', 'utf8');
  // también por partes: cada una es una transacción completa y se pueden ejecutar en orden
  const body = out.slice(out.indexOf('begin;') + 1, out.lastIndexOf('commit;'));
  const chunks: string[][] = [[]];
  for (const l of body) {
    if (l === PART_MARK) chunks.push([]);
    else chunks[chunks.length - 1].push(l);
  }
  chunks.forEach((c, i) => {
    const p = join(ROOT, 'privado', `semilla-parte${i + 1}.sql`);
    const header = `-- Semilla, parte ${i + 1} de ${chunks.length}. Ejecútelas en orden. CONTIENE CLAVES DE RESPUESTA: no la publique.`;
    writeFileSync(p, [header, 'begin;', ...c, 'commit;'].join('\n') + '\n', 'utf8');
  });
  console.log(`Semilla escrita en ${path} (y en ${chunks.length} partes): ${units.length} bloques, ${nLessons} lecciones, ${nExercises} ejercicios.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
