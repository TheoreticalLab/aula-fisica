/**
 * Instala una biblioteca académica en sus asignaturas (una copia independiente en cada una).
 *
 *   ./node_modules/.bin/vite-node scripts/generar-curso.ts privado/biblioteca/mecanica
 *
 * 1. Carga y VALIDA toda la biblioteca (estructura A–K, LaTeX, claves con el motor de calificación y la
 *    comprobación física independiente de cada numérico). Si algo falla, no genera nada.
 * 2. Escribe privado/datos/<marca>_biblioteca-<nombre>.sql: un archivo de «datos privados» (contiene claves)
 *    que sigue el flujo normal: npm run probar → plan → autorización → aplicar.
 *
 * El SQL es idempotente y respeta al profesor: crea lo que falta y actualiza solo lo que NO se haya
 * personalizado desde el panel (columna customized). Nunca borra nada ni cambia el estado de una unidad ya
 * instalada (eso lo decide el profesor); el estado de la biblioteca solo se usa en la primera instalación.
 */
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ROOT } from './cargar-contenido';
import { cargarBiblioteca, type BibliotecaCargada } from './biblioteca/cargar';
import { validarBiblioteca } from './biblioteca/validar';
import type { EstudioLeccion } from './biblioteca/tipos';

const TAG = '$aula_b7$';
function q(s: string | null | undefined): string {
  if (s === null || s === undefined) return 'null';
  if (s.includes(TAG)) throw new Error(`El texto contiene el delimitador ${TAG}`);
  return `${TAG}${s}${TAG}`;
}
const j = (v: unknown) => (v === undefined || v === null ? 'null' : `${q(JSON.stringify(v))}::jsonb`);
const arr = (xs: string[]) => `array[${xs.map(q).join(', ')}]::text[]`;
const set = (tabla: string, cols: string[]) => cols.map((c) => `${c} = excluded.${c}`).join(', ') + (tabla ? '' : '');

export function sqlBiblioteca(b: BibliotecaCargada): string {
  const out: string[] = [];
  const nMinis = b.unidades.reduce((s, u) => s + u.minis.length, 0);
  const nEj = b.unidades.reduce((s, u) => s + u.minis.reduce((t, m) => t + m.mini.ejercicios.length, 0), 0);
  out.push(`-- Biblioteca «${b.curso.nombre}» generada por scripts/generar-curso.ts. CONTIENE CLAVES DE RESPUESTA: no la publique.`);
  out.push(`-- ${b.unidades.length} unidades · ${nMinis} minicapítulos · ${nEj} ejercicios · asignaturas: ${b.curso.instancias.map((i) => i.codigo).join(', ')}`);
  out.push(`select set_config('aula.origen', 'biblioteca', true);`);
  const descripcion = b.curso.presentacion.split('\n').find((l) => l.trim() && !l.startsWith('#'))?.replace(/[*_`]/g, '').slice(0, 300) ?? '';

  for (const inst of b.curso.instancias) {
    const C = `(select id from public.courses where code = ${q(inst.codigo)})`;
    out.push(`\n-- ===================== ${inst.titulo} (${inst.codigo}) =====================`);
    out.push(`insert into public.courses (code, title, description, presentation, objectives)
values (${q(inst.codigo)}, ${q(inst.titulo)}, ${q(descripcion)}, ${q(b.curso.presentacion)}, ${j(b.curso.objetivos)})
on conflict (code) do update set
  presentation = case when courses.presentation = '' then excluded.presentation else courses.presentation end,
  objectives = case when courses.objectives = '[]'::jsonb then excluded.objectives else courses.objectives end;`);
    out.push(`insert into public.course_staff (course_id, user_id) select ${C}, p.id from public.profiles p where p.role = 'admin' on conflict do nothing;`);
    for (const s of inst.secciones ?? []) {
      out.push(`do $sec$ declare v_clase uuid; begin
  select c.id into v_clase from public.classes c join public.courses k on k.id = c.course_id
    where c.name = ${q(s.nombre)} and k.code = ${q(s.desde)};
  if v_clase is not null then
    -- las actividades apuntan a ejercicios de la asignatura de origen: con actividades no se mueve
    if exists (select 1 from public.activities where class_id = v_clase) then
      raise exception 'La sección % ya tiene actividades: no se mueve automáticamente', ${q(s.nombre)};
    end if;
    update public.classes set course_id = ${C} where id = v_clase;
  end if;
end $sec$;`);
    }

    for (const u of b.unidades) {
      out.push(`\n-- ${inst.codigo} · ${u.meta.titulo}`);
      out.push(`insert into public.units (course_id, slug, position, title, summary, status)
values (${C}, ${q(u.meta.slug)}, ${u.posicion}, ${q(u.meta.titulo)}, ${q(u.meta.resumen)}, ${q(u.meta.estadoInicial)})
on conflict (course_id, slug) do update set ${set('', ['position', 'title', 'summary'])} where units.customized = false;`);
      const unitId = `(select id from public.units where course_id = ${C} and slug = ${q(u.meta.slug)})`;
      for (const { posicion, mini: m } of u.minis) {
        const practica = m.ejercicios.filter((e) => (e.role ?? 'practice') === 'practice');
        const config = Object.fromEntries((['basico', 'intermedio', 'desafiante'] as const).map((d) => [d, practica.filter((e) => e.difficulty === d).length]));
        const estudio: EstudioLeccion = {
          objetivos: m.objetivos, errores: m.errores, preguntas: m.preguntas, autoevaluacion: m.autoevaluacion, conexiones: m.conexiones,
          ...(m.integradora ? { integradora: true } : {}),
        };
        out.push(`insert into public.lessons (unit_id, course_id, slug, position, title, summary, theory, formulas, examples, simulation, study, practice_config)
values (${unitId}, ${C}, ${q(m.slug)}, ${posicion}, ${q(m.titulo)}, ${q(m.resumen)}, ${q(m.teoria)}, ${j(m.formulas)}, ${j(m.ejemplos)}, ${j(m.simulacion)}, ${j(estudio)}, ${j(config)})
on conflict (course_id, slug) do update set ${set('', ['unit_id', 'position', 'title', 'summary', 'theory', 'formulas', 'examples', 'simulation', 'study', 'practice_config'])} where lessons.customized = false;`);
        const lessonId = `(select id from public.lessons where course_id = ${C} and slug = ${q(m.slug)})`;
        for (const c of m.conceptos) {
          out.push(`insert into public.concepts (course_id, lesson_id, slug, name) values (${C}, ${lessonId}, ${q(c.slug)}, ${q(c.name)})
on conflict (course_id, slug) do update set lesson_id = excluded.lesson_id, name = excluded.name;`);
        }
        m.ejercicios.forEach((e, i) => {
          out.push(`insert into public.exercises (course_id, lesson_id, slug, position, category, difficulty, role, format, concepts, prompt, options, multiple, figure, simulation, unit_hint, points)
values (${C}, ${lessonId}, ${q(e.id)}, ${i + 1}, ${q(e.category)}::public.exercise_category, ${q(e.difficulty)}::public.exercise_difficulty,
  ${q(e.role ?? 'practice')}::public.exercise_role, ${q(e.format)}::public.exercise_format, ${arr(e.concepts)}, ${q(e.prompt)}, ${j(e.options)},
  ${!!e.multiple}, ${j(e.figure)}, ${j(e.simulation)}, ${q(e.unitHint ?? null)}, ${e.points ?? 1})
on conflict (course_id, slug) do update set ${set('', ['lesson_id', 'position', 'category', 'difficulty', 'role', 'format', 'concepts', 'prompt', 'options', 'multiple', 'figure', 'simulation', 'unit_hint', 'points'])} where exercises.customized = false;`);
          out.push(`insert into public.exercise_keys (exercise_id, answer, hints, explanation)
select e.id, ${j(e.clave.answer)}, ${j(e.clave.hints)}, ${q(e.clave.explanation)} from public.exercises e where e.course_id = ${C} and e.slug = ${q(e.id)}
on conflict (exercise_id) do update set ${set('', ['answer', 'hints', 'explanation'])} where exercise_keys.customized = false;`);
        });
      }
    }
    // verificación final dentro de la misma transacción
    const slugsEj = b.unidades.flatMap((u) => u.minis.flatMap((m) => m.mini.ejercicios.map((e) => e.id)));
    out.push(`do $chk$ begin
  if (select count(*) from public.units where course_id = ${C} and slug = any(${arr(b.unidades.map((u) => u.meta.slug))})) <> ${b.unidades.length} then
    raise exception 'Faltan unidades en ${inst.codigo}';
  end if;
  if (select count(*) from public.lessons where course_id = ${C} and slug = any(${arr(b.unidades.flatMap((u) => u.minis.map((m) => m.mini.slug)))})) <> ${nMinis} then
    raise exception 'Faltan minicapítulos en ${inst.codigo}';
  end if;
  if (select count(*) from public.exercises e join public.exercise_keys k on k.exercise_id = e.id
      where e.course_id = ${C} and e.slug = any(${arr(slugsEj)})) <> ${nEj} then
    raise exception 'Faltan ejercicios o claves en ${inst.codigo}';
  end if;
end $chk$;`);
  }
  return out.join('\n') + '\n';
}

async function main() {
  const ruta = process.argv.slice(2).find((x) => !x.startsWith('-'));
  if (!ruta) {
    console.error('Uso: vite-node scripts/generar-curso.ts privado/biblioteca/<nombre>');
    process.exit(1);
  }
  const dir = resolve(ruta);
  if (!dir.startsWith(join(ROOT, 'privado') + '/')) {
    console.error('La biblioteca (con sus claves) debe estar dentro de privado/.');
    process.exit(1);
  }
  const b = await cargarBiblioteca(dir);
  const problemas = validarBiblioteca(b);
  const nMinis = b.unidades.reduce((s, u) => s + u.minis.length, 0);
  const nEj = b.unidades.reduce((s, u) => s + u.minis.reduce((t, m) => t + m.mini.ejercicios.length, 0), 0);
  console.log(`Biblioteca «${b.curso.nombre}»: ${b.unidades.length} unidades, ${nMinis} minicapítulos, ${nEj} ejercicios.`);
  if (problemas.length) {
    console.error(`✖ ${problemas.length} problema(s); no se genera nada:\n` + problemas.map((x) => ' - ' + x).join('\n'));
    process.exit(1);
  }
  if (process.argv.includes('--solo-validar')) {
    console.log('✔ Validación correcta (no se generó SQL).');
    return;
  }
  const datos = join(ROOT, 'privado', 'datos');
  mkdirSync(datos, { recursive: true });
  // un archivo anterior de esta biblioteca que todavía no se aplicó queda sustituido por el nuevo
  const regPath = join(ROOT, 'privado', 'estado', 'datos-aplicados.json');
  const aplicados: Record<string, string> = existsSync(regPath) ? JSON.parse(readFileSync(regPath, 'utf8')) : {};
  const sufijo = `_biblioteca-${b.curso.nombre}.sql`;
  for (const f of readdirSync(datos).filter((f) => f.endsWith(sufijo) && !aplicados[f])) unlinkSync(join(datos, f));
  const archivo = `${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}${sufijo}`;
  writeFileSync(join(datos, archivo), sqlBiblioteca(b), { mode: 0o600 });
  console.log(`✔ Validación correcta. privado/datos/${archivo}`);
  console.log('Siguiente (en su terminal): npm run respaldo → npm run probar → npm run plan → npm run aplicar -- --plan CÓDIGO');
}

if (!process.env.VITEST) void main();
