/**
 * Valida UNA unidad de una biblioteca mientras se redacta (no necesita estar en curso.unidades).
 *   ./node_modules/.bin/vite-node scripts/biblioteca/validar-unidad.ts privado/biblioteca/mecanica u02-cinematica-1d
 * Los conceptos de las demás unidades presentes cuentan como conocidos (un ejercicio puede usar conceptos anteriores).
 */
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { MiniCapitulo, UnidadBiblioteca } from './tipos';
import { validarCadenas, validarMeta, validarMini } from './validar';

const ARCHIVO_MINI = /^(\d\d)-[a-z0-9-]+\.ts$/;

async function minisDe(d: string) {
  const out: { archivo: string; mini: MiniCapitulo }[] = [];
  for (const archivo of readdirSync(d).filter((f) => ARCHIVO_MINI.test(f)).sort()) {
    const mod = (await import(pathToFileURL(join(d, archivo)).href)) as { mini?: MiniCapitulo };
    if (!mod.mini) throw new Error(`${archivo} no exporta «mini»`);
    out.push({ archivo, mini: mod.mini });
  }
  return out;
}

async function main() {
  const [dirArg, carpeta] = process.argv.slice(2).filter((x) => !x.startsWith('-'));
  if (!dirArg || !carpeta) {
    console.error('Uso: vite-node scripts/biblioteca/validar-unidad.ts privado/biblioteca/<nombre> <carpeta-unidad>');
    process.exit(1);
  }
  const dir = resolve(dirArg);
  const carpetas = readdirSync(dir).filter((f) => existsSync(join(dir, f, 'unidad.ts'))).sort();
  if (!carpetas.includes(carpeta)) {
    console.error(`No existe la unidad ${carpeta}`);
    process.exit(1);
  }
  const conceptos = new Set<string>();
  const porUnidad = new Map<string, { archivo: string; mini: MiniCapitulo }[]>();
  for (const c of carpetas) {
    const minis = await minisDe(join(dir, c));
    porUnidad.set(c, minis);
    for (const { mini } of minis) for (const k of mini.conceptos) conceptos.add(k.slug);
  }
  const { unidad } = (await import(pathToFileURL(join(dir, carpeta, 'unidad.ts')).href)) as { unidad: UnidadBiblioteca };
  const minis = porUnidad.get(carpeta)!;
  const p: string[] = [];
  const ids = new Set<string>();
  const slugs = new Set<string>();
  const vistos = new Set<string>();
  for (const { archivo, mini } of minis) {
    for (const k of mini.conceptos) {
      if (vistos.has(k.slug)) p.push(`${archivo}: concepto repetido «${k.slug}»`);
      vistos.add(k.slug);
    }
    if (slugs.has(mini.slug)) p.push(`${archivo}: slug repetido`);
    slugs.add(mini.slug);
    for (const e of mini.ejercicios) {
      if (ids.has(e.id)) p.push(`${archivo}: id repetido «${e.id}»`);
      ids.add(e.id);
    }
    validarMini(`${carpeta}/${archivo}`, mini, conceptos, p);
    validarCadenas(`${carpeta}/${archivo}`, mini, p);
    if (unidad.banco) for (const e of mini.ejercicios) validarMeta(`${carpeta}/${archivo} ${e.id}`, e, conceptos, p);
  }
  // ids y conceptos no deben chocar con otras unidades
  for (const [c, otras] of porUnidad) {
    if (c === carpeta) continue;
    for (const { archivo, mini } of otras) {
      for (const e of mini.ejercicios) if (ids.has(e.id)) p.push(`id «${e.id}» repetido también en ${c}/${archivo}`);
      for (const k of mini.conceptos) if (vistos.has(k.slug)) p.push(`concepto «${k.slug}» repetido también en ${c}/${archivo}`);
    }
  }
  const nEj = minis.reduce((s, m) => s + m.mini.ejercicios.length, 0);
  const palabras = minis.reduce((s, m) => s + m.mini.teoria.split(/\s+/).length, 0);
  console.log(`${unidad.titulo}: ${minis.length} minicapítulos (${minis.filter((m) => m.mini.integradora).length} integradora), ${nEj} ejercicios, ${palabras} palabras de teoría.`);
  for (const { archivo, mini } of minis) {
    console.log(`  ${archivo.padEnd(42)} ${String(mini.teoria.split(/\s+/).length).padStart(5)} palabras · ${mini.ejemplos.length} ej. resueltos · ${mini.ejercicios.length} ejercicios${mini.simulacion ? ` · sim ${mini.simulacion.key}` : ''}`);
  }
  if (p.length) {
    console.error(`\n✖ ${p.length} problema(s):\n` + p.map((x) => ' - ' + x).join('\n'));
    process.exit(1);
  }
  console.log('\n✔ Unidad válida.');
}

void main();
