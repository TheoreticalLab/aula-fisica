/**
 * Construye, valida y escribe el banco preconstruido de un Maratón adaptativo.
 *
 *   ./node_modules/.bin/vite-node scripts/maraton/generar-banco.ts privado/maraton/fg1/banco.ts [--por 30] [--sin-escribir]
 *
 * - Construye `--por` variantes por plantilla (determinista dada la semilla privada del banco, que se crea la primera
 *   vez en privado/maraton/<id>/semilla.txt y nunca se publica).
 * - Valida cada variante (scripts/maraton/validar.ts). Si algo falla, no escribe nada.
 * - Escribe privado/datos/<marca>_maraton-banco-<id>.sql (idempotente: insert … on conflict do nothing) y un informe
 *   privado/maraton/<id>/informe.json con los recuentos reales. Aplicarlo en producción sigue el procedimiento normal
 *   (npm run respaldo → probar → plan → autorización → aplicar).
 */
import { randomInt } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { Banco } from './marco';
import { construirBanco, type BancoConstruido } from './validar';

const ROOT = resolve(__dirname, '..', '..');

export function lit(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}
const json = (v: unknown) => `${lit(JSON.stringify(v))}::jsonb`;

export function sqlBanco(c: BancoConstruido): string {
  const b = c.banco;
  const l: string[] = [];
  l.push(`-- Banco del Maratón adaptativo «${b.nombre}» (versión ${b.version}). Generado por scripts/maraton/generar-banco.ts.`);
  l.push('-- Contiene CLAVES Y SOLUCIONES: vive en privado/ y no se publica. Idempotente (on conflict do nothing).');
  l.push(`insert into public.maraton_bancos (id, nombre, descripcion, cursos, version) values (${lit(b.id)}, ${lit(b.nombre)}, ${lit(b.descripcion)},`);
  l.push(`  coalesce((select array_agg(id) from public.courses where code = any (array[${b.cursos.map(lit).join(', ')}])), '{}'), ${lit(b.version)})`);
  l.push('  on conflict (id) do nothing;');
  b.temas.forEach((t, i) => {
    l.push(`insert into public.maraton_temas (banco_id, codigo, nombre, unidad, fuente, practicas, examenes, cobertura, estado, orden) values (${[
      b.id, t.codigo, t.nombre, t.unidad, t.fuente, t.practicas, t.examenes, t.cobertura, t.estado,
    ].map(lit).join(', ')}, ${i + 1}) on conflict do nothing;`);
  });
  for (const p of b.plantillas) {
    const vs = c.variantes.get(p.id) ?? [];
    l.push(`insert into public.maraton_plantillas (id, banco_id, tema, subtema, nivel, titulo, metodo, t_min_s, t_max_s, unidades, etiquetas, fuente, estado) values (${[
      p.id, b.id, p.tema, p.subtema].map(lit).join(', ')}, ${p.nivel}, ${lit(p.titulo)}, ${lit(p.metodo)}, ${p.t_min_s}, ${p.t_max_s}, ${[1, 1.2, 1.4, 1.5, 1, 1, 1, 1, 1][p.nivel - 1]}, array[${p.etiquetas.map(lit).join(', ')}]::text[], ${lit(p.fuente)}, ${lit(p.estado ?? 'validada')}) on conflict (id) do nothing;`);
    for (const v of vs) {
      l.push(`insert into public.maraton_variantes (id, plantilla_id, n, enunciado, partes, datos, estado, huella) values (${lit(v.id)}, ${lit(p.id)}, ${v.n}, ${lit(v.enunciado)}, ${json(v.partes)}, ${json(v.datos)}, 'validada', ${lit(v.huella)}) on conflict (id) do nothing;`);
      l.push(`insert into public.maraton_claves (variante_id, clave, solucion, verificacion) values (${lit(v.id)}, ${json(v.clave)}, ${lit(v.solucion)}, ${json({ ...v.verificacion, semilla: v.semilla })}) on conflict (variante_id) do nothing;`);
      // etapas 2…n (niveles 7–9) y comprobación de razonamiento (ordinarios), migración 99
      (v.etapas ?? []).forEach((e, i) => {
        l.push(`insert into public.maraton_etapas (variante_id, numero, tipo, enunciado, partes) values (${lit(v.id)}, ${i + 2}, 'etapa', ${lit(e.enunciado)}, ${json(e.partes)}) on conflict do nothing;`);
        l.push(`insert into public.maraton_etapas_claves (variante_id, numero, clave) values (${lit(v.id)}, ${i + 2}, ${json(e.clave)}) on conflict do nothing;`);
      });
      if (v.comprobacion) {
        const k = v.comprobacion;
        l.push(`insert into public.maraton_etapas (variante_id, numero, tipo, enunciado, partes) values (${lit(v.id)}, 2, 'comprobacion', ${lit(k.enunciado)}, ${json([k.parte])}) on conflict do nothing;`);
        l.push(`insert into public.maraton_etapas_claves (variante_id, numero, clave, solucion) values (${lit(v.id)}, 2, ${json(k.clave)}, ${lit(k.solucion)}) on conflict do nothing;`);
      }
    }
  }
  return l.join('\n') + '\n';
}

export function informe(c: BancoConstruido) {
  const b = c.banco;
  const porTema = b.temas.map((t) => {
    const pls = b.plantillas.filter((p) => p.tema === t.codigo);
    return {
      tema: t.codigo, nombre: t.nombre, cobertura: t.cobertura, estado: t.estado,
      plantillas: pls.length,
      validadas: pls.filter((p) => (p.estado ?? 'validada') === 'validada').length,
      variantes: pls.reduce((s, p) => s + (c.variantes.get(p.id)?.length ?? 0), 0),
      niveles: [...new Set(pls.map((p) => p.nivel))].sort(),
    };
  });
  const porNivel = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
    const pls = b.plantillas.filter((p) => p.nivel === n && (p.estado ?? 'validada') === 'validada');
    return { nivel: n, plantillas: pls.length, variantes: pls.reduce((s, p) => s + (c.variantes.get(p.id)?.length ?? 0), 0) };
  });
  const todas = [...c.variantes.values()].flat();
  return {
    banco: b.id, version: b.version, generado: new Date().toISOString(),
    plantillas: b.plantillas.length,
    plantillas_validadas: b.plantillas.filter((p) => (p.estado ?? 'validada') === 'validada').length,
    plantillas_pendientes: b.plantillas.filter((p) => p.estado === 'pendiente_revision').length,
    variantes: todas.length,
    variantes_en_plantillas_validadas: b.plantillas.filter((p) => (p.estado ?? 'validada') === 'validada').reduce((s, p) => s + (c.variantes.get(p.id)?.length ?? 0), 0),
    desviacion_max_verificacion: Math.max(...todas.map((v) => v.verificacion.desviacion_max)),
    descartes: c.descartes,
    por_nivel: porNivel,
    por_tema: porTema,
  };
}

async function principal() {
  const args = process.argv.slice(2);
  const ruta = args.find((a) => a.endsWith('.ts'));
  if (!ruta) throw new Error('Indique el archivo del banco (p. ej. privado/maraton/fg1/banco.ts)');
  const por = Number(args[args.indexOf('--por') + 1]) || 30;
  const mod = (await import(resolve(ruta))) as { banco: Banco };
  const b = mod.banco;
  const dirBanco = dirname(resolve(ruta));
  const rutaSemilla = join(dirBanco, 'semilla.txt');
  if (!existsSync(rutaSemilla)) writeFileSync(rutaSemilla, String(randomInt(1, 2 ** 31 - 1)));
  const semilla = Number(readFileSync(rutaSemilla, 'utf8').trim());
  const t0 = Date.now();
  const c = construirBanco(b, por, semilla);
  const inf = informe(c);
  console.log(`Banco ${b.id}: ${inf.plantillas} plantillas (${inf.plantillas_validadas} validadas, ${inf.plantillas_pendientes} pendientes), ${inf.variantes} variantes, ${c.descartes} descartes, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  for (const n of inf.por_nivel) console.log(`  D${n.nivel}: ${n.plantillas} plantillas validadas, ${n.variantes} variantes`);
  if (c.errores.length) {
    console.error(`\n✖ ${c.errores.length} error(es):\n  ` + c.errores.slice(0, 40).join('\n  '));
    process.exit(1);
  }
  console.log(`  desviación máxima frente al verificador independiente: ${(inf.desviacion_max_verificacion * 100).toFixed(4)} %`);
  if (args.includes('--sin-escribir')) return;
  writeFileSync(join(dirBanco, 'informe.json'), JSON.stringify(inf, null, 2));
  const datos = join(ROOT, 'privado', 'datos');
  mkdirSync(datos, { recursive: true });
  const marca = args[args.indexOf('--marca') + 1]?.match(/^\d{14}$/)?.[0] ?? new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const archivo = join(datos, `${marca}_maraton-banco-${b.id}.sql`);
  writeFileSync(archivo, sqlBanco(c));
  console.log(`✔ ${archivo}`);
}

// vite-node no incluye la ruta del script en process.argv: se ejecuta cuando el primer argumento es un banco
if (!process.env.VITEST && process.argv.slice(2).some((a) => /banco\.ts$/.test(a))) {
  principal().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
