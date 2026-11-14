/**
 * Convierte una Práctica Extraordinaria Secuencial (PES) escrita en privado/actividades/<nombre>.ts en un archivo de
 * «datos privados» privado/datos/<marca>_<clave>.sql, que pasa por el flujo normal (probar → plan → autorización → aplicar).
 *
 *   ./node_modules/.bin/vite-node scripts/generar-pes.ts privado/actividades/<nombre>.ts
 *
 * El SQL NO escribe las tablas pes_* directamente: llama, en nombre de un profesor de la sección, a las mismas funciones
 * que usa el panel (pes_crear, pes_ejercicio_redactado y, si se pide, pes_publicar), así que se aplican todas sus
 * validaciones (3–5 apartados, pesos, claves, fecha límite futura, asignación a los estudiantes matriculados).
 * Es idempotente: si la sección ya tiene una PES con ese título, no hace nada. Contiene claves: vive en privado/.
 * Antes de escribir, cada clave se comprueba con el motor de calificación: la clave se califica como correcta y los
 * errores típicos no.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { grade, validateNumericKey } from '../supabase/functions/_shared/calificacion/calificar';
import type { AnswerKey, NumericKey } from '../supabase/functions/_shared/calificacion/tipos';
import { checkMarkdown } from './validar-contenido';
import { ROOT } from './cargar-contenido';

export interface ApartadoPes {
  enunciado: string;
  /** solo numéricos y de selección (los abiertos necesitan rúbrica y revisión docente) */
  formato: 'numeric' | 'choice';
  opciones?: string[];
  unidad?: string;
  clave: AnswerKey;
  explicacion: string;
  /** tiempo de referencia en segundos: la espera mínima del estudiante es (1 + incremento) · t_ref */
  t_ref_s: number;
  etapa?: 'prediccion' | 'formulacion' | 'resolucion' | 'interpretacion' | 'transferencia' | 'otra';
}

export interface PesDef {
  /** nombre corto y estable (archivo de datos) */
  clave: string;
  /** nombre exacto de la sección y código de la asignatura */
  seccion: string;
  curso: string;
  titulo: string;
  descripcion: string;
  instrucciones: string;
  /** ISO 8601 con desfase explícito */
  abre?: string;
  cierre: string;
  p_max?: number;
  alfa?: number;
  factor_anticipado?: number;
  incremento?: number;
  /** true: se publica (visible y asignada a los estudiantes matriculados) al aplicar el archivo */
  publicar: boolean;
  ejercicios: { titulo: string; contexto: string; apartados: ApartadoPes[] }[];
}

const ISO = /(Z|[+-]\d{2}:\d{2})$/;

export function validarPes(d: PesDef): string[] {
  const p: string[] = [];
  if (!/^[a-z0-9-]+$/.test(d.clave)) p.push(`clave inválida: ${d.clave}`);
  if (!d.titulo.trim() || d.titulo.length > 160) p.push('título vacío o de más de 160 caracteres');
  if (d.instrucciones.length > 8000 || d.descripcion.length > 4000) p.push('instrucciones o descripción demasiado largas');
  checkMarkdown('instrucciones', d.instrucciones, p);
  for (const [k, v] of [['abre', d.abre], ['cierre', d.cierre]] as const) {
    if (v !== undefined && (!ISO.test(v) || Number.isNaN(Date.parse(v)))) p.push(`${k} inválida (ISO 8601 con desfase): ${v}`);
  }
  if (d.abre && Date.parse(d.abre) >= Date.parse(d.cierre)) p.push('la apertura debe ser anterior al cierre');
  if (!d.ejercicios.length) p.push('sin ejercicios');
  d.ejercicios.forEach((e, i) => {
    const at = `ejercicio ${i + 1}`;
    if (e.apartados.length < 3 || e.apartados.length > 5) p.push(`${at}: debe tener de 3 a 5 apartados (tiene ${e.apartados.length})`);
    if (e.titulo.length > 200 || e.contexto.length > 8000) p.push(`${at}: título o contexto demasiado largo`);
    checkMarkdown(`${at} contexto`, e.contexto, p);
    e.apartados.forEach((a, j) => {
      const ap = `${at}${String.fromCharCode(65 + j)}`;
      checkMarkdown(`${ap} enunciado`, a.enunciado, p);
      checkMarkdown(`${ap} explicación`, a.explicacion, p);
      if (!a.enunciado.trim() || a.enunciado.length > 8000) p.push(`${ap}: enunciado vacío o largo`);
      if (!(a.t_ref_s >= 10 && a.t_ref_s <= 7200)) p.push(`${ap}: t_ref_s fuera de 10–7200`);
      if (a.clave.format !== a.formato) p.push(`${ap}: la clave no coincide con el formato`);
      if (a.formato === 'numeric') {
        const k = a.clave as NumericKey;
        for (const e2 of validateNumericKey(k)) p.push(`${ap}: ${e2}`);
        const r = grade(k, { text: k.value });
        if (r.status !== 'correct') p.push(`${ap}: la clave no se califica como correcta (${r.status})`);
        for (const ce of k.commonErrors ?? []) {
          const x = grade(k, { text: ce.value });
          if (x.status === 'correct') p.push(`${ap}: el error típico «${ce.value}» se califica como correcto`);
        }
      }
      if (a.formato === 'choice' && (!a.opciones || a.opciones.length < 2)) p.push(`${ap}: faltan opciones`);
    });
  });
  return p;
}

/** literal SQL con dólares (el texto no puede contener la etiqueta) */
function dolar(s: string): string {
  const tag = `$pes_${createHash('sha256').update(s).digest('hex').slice(0, 6)}$`;
  if (s.includes(tag)) throw new Error('el texto contiene la etiqueta de cita');
  return `${tag}${s}${tag}`;
}

export function sqlPes(d: PesDef, origen: string): string {
  const crear = {
    titulo: d.titulo, descripcion: d.descripcion, instrucciones: d.instrucciones, abre_at: d.abre ?? null, cierra_at: d.cierre,
    ...(d.p_max !== undefined && { p_max: d.p_max }), ...(d.alfa !== undefined && { alfa: d.alfa }),
    ...(d.factor_anticipado !== undefined && { factor_anticipado: d.factor_anticipado }), ...(d.incremento !== undefined && { incremento: d.incremento }),
  };
  const l: string[] = [];
  l.push(`-- Práctica extraordinaria secuencial «${d.titulo}» (sección «${d.seccion}», ${d.curso}). Generado por scripts/generar-pes.ts desde ${origen}.`);
  l.push(`-- CONTIENE CLAVES: vive en privado/. Idempotente: si la sección ya tiene una PES con este título, no hace nada.`);
  l.push(`-- Usa las funciones del panel (pes_crear, pes_ejercicio_redactado${d.publicar ? ', pes_publicar' : ''}) en nombre de un profesor de la sección.`);
  l.push(`do $bloque$`);
  l.push(`declare v_class uuid; v_prof uuid; v_pes uuid;`);
  l.push(`begin`);
  l.push(`  select c.id into v_class from public.classes c join public.courses co on co.id = c.course_id`);
  l.push(`   where co.code = ${dolar(d.curso)} and c.name = ${dolar(d.seccion)} and not c.archived;`);
  l.push(`  if v_class is null then raise exception 'No existe la sección activa «%» de %', ${dolar(d.seccion)}, ${dolar(d.curso)}; end if;`);
  l.push(`  if exists (select 1 from public.pes_practicas where class_id = v_class and titulo = ${dolar(d.titulo)}) then return; end if;`);
  l.push(`  select t.user_id into v_prof from public.class_teachers t join public.profiles p on p.id = t.user_id`);
  l.push(`   where t.class_id = v_class and p.role in ('teacher', 'admin') and p.active and not p.must_change_password`);
  l.push(`   order by (p.role = 'teacher') desc, t.user_id limit 1;`);
  l.push(`  if v_prof is null then raise exception 'La sección no tiene un profesor activo'; end if;`);
  l.push(`  perform set_config('request.jwt.claims', json_build_object('sub', v_prof, 'role', 'authenticated')::text, true);`);
  l.push(`  perform set_config('request.jwt.claim.sub', v_prof::text, true);`);
  l.push(`  v_pes := public.pes_crear(v_class, ${dolar(JSON.stringify(crear))}::jsonb);`);
  for (const e of d.ejercicios) {
    const obj = {
      titulo: e.titulo, contexto: e.contexto,
      apartados: e.apartados.map((a) => ({
        enunciado: a.enunciado, formato: a.formato, opciones: a.opciones ?? null, unidad_sugerida: a.unidad ?? null, clave: a.clave,
        explicacion: a.explicacion, t_ref_s: a.t_ref_s, etapa: a.etapa ?? 'resolucion',
      })),
    };
    l.push(`  perform public.pes_ejercicio_redactado(v_pes, ${dolar(JSON.stringify(obj))}::jsonb);`);
  }
  if (d.publicar) l.push(`  perform public.pes_publicar(v_pes, null);`);
  l.push(`  perform set_config('request.jwt.claims', '', true);`);
  l.push(`  perform set_config('request.jwt.claim.sub', '', true);`);
  l.push(`end $bloque$;`);
  return l.join('\n') + '\n';
}

async function principal() {
  const ruta = process.argv.slice(2).find((a) => a.endsWith('.ts'));
  if (!ruta) throw new Error('Indique el archivo de la PES (privado/actividades/<nombre>.ts)');
  const mod = (await import(pathToFileURL(resolve(ruta)).href)) as { pes: PesDef };
  const d = mod.pes;
  const errores = validarPes(d);
  if (errores.length) {
    console.error(`✖ ${errores.length} problema(s):\n  ${errores.join('\n  ')}`);
    process.exit(1);
  }
  const n = d.ejercicios.reduce((s, e) => s + e.apartados.length, 0);
  const marca = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const dir = join(ROOT, 'privado', 'datos');
  mkdirSync(dir, { recursive: true });
  const archivo = join(dir, `${marca}_${d.clave}.sql`);
  writeFileSync(archivo, sqlPes(d, basename(ruta)));
  console.log(`✔ ${d.ejercicios.length} ejercicios y ${n} apartados verificados con el motor de calificación.`);
  console.log(`✔ ${archivo.slice(ROOT.length + 1)}`);
  console.log('Siguiente: npm run probar → npm run plan → autorización → npm run aplicar -- --plan CÓDIGO');
}

if (!process.env.VITEST && process.argv.slice(2).some((a) => a.endsWith('.ts'))) {
  principal().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
