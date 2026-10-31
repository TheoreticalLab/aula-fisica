/**
 * Informe de cobertura del banco de una unidad (sin claves: solo recuentos y metadatos).
 *   ./node_modules/.bin/vite-node scripts/biblioteca/informe-banco.ts privado/biblioteca/mecanica fisica-choques
 */
import { resolve } from 'node:path';
import { cargarBiblioteca } from './cargar';
import { FAMILIAS, TIPOS_PREGUNTA } from './tipos';

async function main() {
  const [dir, slug] = process.argv.slice(2);
  if (!dir || !slug) { console.error('Uso: informe-banco.ts <biblioteca> <slug-unidad>'); process.exit(1); }
  const b = await cargarBiblioteca(resolve(dir));
  const u = b.unidades.find((x) => x.meta.slug === slug);
  if (!u) { console.error(`No está la unidad ${slug}`); process.exit(1); }
  const ej = u.minis.flatMap((m) => m.mini.ejercicios.map((e) => ({ ...e, leccion: m.mini.slug, n: m.posicion })));
  const estructura = (e: (typeof ej)[number]) => e.meta?.problema?.id ?? e.id;
  const niveles = ['basico', 'intermedio', 'desafiante'] as const;
  console.log(`${u.meta.titulo}\n${u.minis.length} lecciones · ${ej.length} ejercicios (filas) · ${new Set(ej.map(estructura)).size} estructuras distintas\n`);
  console.log('| Nivel | Ejercicios | Estructuras distintas | Práctica | Banco |\n|---|---|---|---|---|');
  for (const n of niveles) {
    const l = ej.filter((e) => e.difficulty === n);
    console.log(`| ${n} | ${l.length} | ${new Set(l.map(estructura)).size} | ${l.filter((e) => (e.role ?? 'practice') === 'practice').length} | ${l.filter((e) => e.role === 'bank').length} |`);
  }
  console.log('\n| Lección | Fácil | Intermedio | Difícil | Numéricos | Tipos de pregunta |\n|---|---|---|---|---|---|');
  for (const m of u.minis) {
    const l = m.mini.ejercicios;
    const c = (d: string) => l.filter((e) => e.difficulty === d).length;
    console.log(`| ${String(m.posicion).padStart(2, '0')} ${m.mini.titulo} | ${c('basico')} | ${c('intermedio')} | ${c('desafiante')} | ${l.filter((e) => e.format === 'numeric').length} | ${[...new Set(l.map((e) => e.meta?.tipo))].join(', ')} |`);
  }
  console.log('\n| Familia | Estructuras | Ejercicios |\n|---|---|---|');
  for (const [k, v] of Object.entries(FAMILIAS)) {
    const l = ej.filter((e) => e.meta?.familia === k);
    console.log(`| ${k}. ${v} | ${new Set(l.map(estructura)).size} | ${l.map((e) => e.id.replace('mec-u9c-', '')).join(', ')} |`);
  }
  console.log('\n| Tipo de pregunta | Ejercicios |\n|---|---|');
  for (const [k, v] of Object.entries(TIPOS_PREGUNTA)) console.log(`| ${v} | ${ej.filter((e) => e.meta?.tipo === k).length} |`);
  const usa = (f: 'friccion' | 'energia' | 'cinematica' | 'plano') => ej.filter((e) => e.meta?.[f]).length;
  console.log(`\nUsan fricción: ${usa('friccion')} · energía: ${usa('energia')} · cinemática: ${usa('cinematica')} · planos: ${usa('plano')}`);
  console.log(`Intermedios con unidades anteriores: ${ej.filter((e) => e.difficulty === 'intermedio' && e.meta?.unidadesPrevias?.length).length}`);
  console.log(`Difíciles con ≥ 3 etapas (estructuras): ${new Set(ej.filter((e) => e.difficulty === 'desafiante' && (e.meta?.etapas ?? 0) >= 3).map(estructura)).size}`);
  console.log(`Con arrastre: ${ej.filter((e) => e.clave.answer.format === 'numeric' && e.clave.answer.arrastre).length}`);
  // cobertura por concepto (de esta unidad y previos)
  const nombre = new Map(b.unidades.flatMap((x) => x.minis.flatMap((m) => m.mini.conceptos.map((c) => [c.slug, c.name] as const))));
  const cuenta = new Map<string, { directo: number; previo: number }>();
  for (const e of ej) {
    for (const c of e.concepts) { const v = cuenta.get(c) ?? { directo: 0, previo: 0 }; v.directo++; cuenta.set(c, v); }
    for (const c of e.meta?.previos ?? []) { const v = cuenta.get(c) ?? { directo: 0, previo: 0 }; v.previo++; cuenta.set(c, v); }
  }
  console.log('\n| Concepto | Ejercicios que lo evalúan | Ejercicios que lo requieren como previo |\n|---|---|---|');
  for (const [c, v] of [...cuenta].sort((a, b) => a[0].localeCompare(b[0]))) console.log(`| ${c} — ${(nombre.get(c) ?? '').slice(0, 70)} | ${v.directo} | ${v.previo} |`);
}

void main();
