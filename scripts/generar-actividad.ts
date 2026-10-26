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
import { loadContent, ROOT } from './cargar-contenido';
import { checkMarkdown } from './validar-contenido';
import { analizarTexto, MAX_SEGUNDOS, MIN_SEGUNDOS, segundosSugeridos } from '../src/lib/lectura';

export function tiempoLectura(a: { lectura?: { texto: string; minSegundos?: number } }): number {
  return a.lectura ? a.lectura.minSegundos ?? segundosSugeridos(a.lectura.texto) : 0;
}

export interface EjercicioActividad {
  id: string;
  /** Slug de la lección del curso a la que pertenece (para estadísticas y el banco del profesor). */
  leccion: string;
  category: ExerciseCategory;
  difficulty: Difficulty;
  concepts: string[];
  prompt: string;
  format: 'choice' | 'numeric';
  options?: string[];
  figure?: ExerciseDef['figure'];
  unitHint?: string;
  points?: number;
  clave: ExerciseKeyDef;
}

export interface ActividadDef {
  /** Nombre corto y estable (se usa en el nombre del archivo y para el id de la actividad). */
  clave: string;
  /** Nombre exacto de la sección (clase) donde se crea. */
  seccion: string;
  /** Código de la asignatura (courses.code). */
  curso: string;
  titulo: string;
  instrucciones: string;
  ajustes: { modo: 'practice' | 'exam'; intentosPorEjercicio: number; pistas: boolean; revelar: 'immediate' | 'after_submit' | 'after_close' | 'never'; publicada: boolean };
  /** Lectura cronometrada antes de los ejercicios (requiere la migración 10). Sin minSegundos, se calcula del texto. */
  lectura?: { texto: string; minSegundos?: number };
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
  if (a.ajustes.modo === 'exam' && (a.ajustes.revelar === 'immediate' || a.ajustes.pistas)) p.push('en evaluación no puede haber pistas ni retroalimentación inmediata');
  const ids = new Set<string>();
  for (const e of a.ejercicios) {
    const at = `${e.id}:`;
    if (ids.has(e.id)) p.push(`${at} id repetido`);
    ids.add(e.id);
    if (!lecciones.has(e.leccion)) p.push(`${at} la lección «${e.leccion}» no existe`);
    for (const c of e.concepts) if (!conceptos.has(c)) p.push(`${at} el concepto «${c}» no existe`);
    if (!e.prompt.trim()) p.push(`${at} enunciado vacío`);
    // fórmulas que KaTeX no pueda dibujar
    checkMarkdown(`${e.id} enunciado`, e.prompt, p);
    (e.options ?? []).forEach((o, i) => checkMarkdown(`${e.id} opción ${i + 1}`, o, p));
    e.clave.hints.forEach((h, i) => checkMarkdown(`${e.id} pista ${i + 1}`, h, p));
    checkMarkdown(`${e.id} explicación`, e.clave.explanation, p);
    if (!e.clave.hints.length) p.push(`${at} sin pistas`);
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
    } else if (k.format === 'numeric') {
      for (const m of validateNumericKey(k)) p.push(`${at} ${m}`);
      for (const v of [k.value, ...(k.alternatives ?? [])]) {
        const r = grade(k, { text: v });
        if (r.status !== 'correct') p.push(`${at} «${v}» debería ser correcta y sale ${r.status} (${r.messages.join(' ')})`);
      }
      for (const ce of k.commonErrors ?? []) {
        if (grade(k, { text: ce.value }).status === 'correct') p.push(`${at} el error típico «${ce.value}» cae dentro de la tolerancia`);
      }
    }
  }
  return p;
}

export function sqlActividad(a: ActividadDef): string {
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
  out.push(`\n-- la actividad (sin publicar: el profesor la abre desde su panel)${lec ? ` · lectura cronometrada de ${lec.seg} s` : ''}`);
  out.push(`insert into public.activities (id, class_id, title, instructions, mode, max_tries_per_item, reveal_policy, hints_enabled, published, created_by${lec ? ', reading_text, reading_min_seconds' : ''})
values ('${actId}', ${clase}, ${q(a.titulo)}, ${q(a.instrucciones)}, ${q(s.modo)}::public.activity_mode, ${s.intentosPorEjercicio},
  ${q(s.revelar)}::public.reveal_policy, ${s.pistas}, ${s.publicada}, (select id from public.profiles where role = 'admin' order by created_at limit 1)${lec ? `, ${q(lec.texto)}, ${lec.seg}` : ''})
on conflict (id) do nothing;`);
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
  end if;
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
  console.log(`✔ ${actividad.ejercicios.length} ejercicios verificados con el motor de calificación (${nc} de selección, ${actividad.ejercicios.length - nc} numéricos).`);
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
