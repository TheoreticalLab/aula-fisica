/**
 * LIEIA · Experimento factorial de diseño de exámenes (reproducible). Escribe src/lib/lieia/disenos.json y
 * docs/LIEIA_DISENO.md. Uso: ./node_modules/.bin/vite-node scripts/lieia-disenos.ts [réplicas=20]
 */
import { writeFileSync } from 'node:fs';
import { compararDisenos, construirDiseno, contrastar, type EspecDiseno } from '../src/lib/lieia/experimentosDiseno';
import { ESCENARIOS, type Escenario } from '../src/lib/lieia/simulador';
import { DETECTORES, type Detector } from '../src/lib/lieia/laboratorio';

const R = Number(process.argv[2] ?? 20);
const SEM = 20261028;
const AN = { permutaciones: 99, bootstrap: 99 };
const t0 = Date.now();
const base: EspecDiseno = { items: 24, fraccionAbiertas: 0.3, isomorfos: false, orden: 'fijo', versiones: false, fatiga: 0 };
const NEG: Escenario[] = ['independiente', 'mismo_ritmo'];

const contrastes: { titulo: string; caracteristica: string; a: { nombre: string; espec: EspecDiseno; corregir?: boolean }; b: { nombre: string; espec: EspecDiseno; corregir?: boolean }; positivo: Escenario; detectores: Detector[] }[] = [
  { titulo: 'Orden aleatorio con fatiga, SIN corrección por posición', caracteristica: 'orden aleatorio (sin corrección)',
    a: { nombre: 'fijo+fatiga', espec: { ...base, fatiga: 0.8 } }, b: { nombre: 'aleatorio+fatiga sin corrección', espec: { ...base, orden: 'aleatorio', fatiga: 0.8 }, corregir: false }, positivo: 'parejas', detectores: ['d1', 'd2', 'd3', 'd4', 'd6'] },
  { titulo: 'Orden aleatorio con fatiga, CON corrección por posición', caracteristica: 'orden aleatorio (con corrección)',
    a: { nombre: 'fijo+fatiga', espec: { ...base, fatiga: 0.8 } }, b: { nombre: 'aleatorio+fatiga', espec: { ...base, orden: 'aleatorio', fatiga: 0.8 } }, positivo: 'parejas', detectores: ['d1', 'd2', 'd3', 'd4', 'd6'] },
  { titulo: 'Más preguntas abiertas (70 % frente a 30 %)', caracteristica: 'preguntas abiertas',
    a: { nombre: 'base', espec: base }, b: { nombre: 'abiertas 70 %', espec: { ...base, fraccionAbiertas: 0.7 } }, positivo: 'parejas', detectores: ['d1', 'd3'] },
  { titulo: 'Pares isomorfos (versiones equivalentes, todos ven ambas)', caracteristica: 'pares isomorfos',
    a: { nombre: 'base', espec: base }, b: { nombre: 'isomorfos', espec: { ...base, isomorfos: true } }, positivo: 'filtracion', detectores: ['d8', 'd5', 'd4'] },
  { titulo: 'Versiones distintas por estudiante (una variante por grupo)', caracteristica: 'versiones por estudiante',
    a: { nombre: 'isomorfos', espec: { ...base, isomorfos: true } }, b: { nombre: 'isomorfos+versiones', espec: { ...base, isomorfos: true, versiones: true } }, positivo: 'parejas', detectores: ['d1', 'd3'] },
  { titulo: 'Examen más largo (36 frente a 24 preguntas)', caracteristica: 'más preguntas',
    a: { nombre: 'base', espec: base }, b: { nombre: '36 ítems', espec: { ...base, items: 36 } }, positivo: 'parejas', detectores: ['d1', 'd3'] },
  { titulo: 'Orden contrabalanceado por bloques con fatiga', caracteristica: 'contrabalanceo',
    a: { nombre: 'fijo+fatiga', espec: { ...base, fatiga: 0.8 } }, b: { nombre: 'contrabalanceado+fatiga', espec: { ...base, orden: 'contrabalanceado', fatiga: 0.8 } }, positivo: 'parejas', detectores: ['d1', 'd3', 'd6'] },
];

const resultados = contrastes.map((c, k) => {
  const escenarios: Escenario[] = [...NEG, c.positivo];
  const filas = compararDisenos(
    [{ nombre: c.a.nombre, diseno: construirDiseno(c.a.espec, SEM + k), analisis: { corregirPosicion: c.a.corregir ?? true } },
     { nombre: c.b.nombre, diseno: construirDiseno(c.b.espec, SEM + k), analisis: { corregirPosicion: c.b.corregir ?? true } }],
    escenarios, {}, R, SEM, AN);
  const conclusiones = contrastar(filas, c.a.nombre, c.b.nombre, NEG, c.positivo, c.detectores);
  console.log(`${c.titulo}: ${conclusiones.map((x) => `${x.detector} ${x.veredicto} (${(x.potenciaA * 100).toFixed(0)}→${(x.potenciaB * 100).toFixed(0)} %, FP ${(x.fprB * 100).toFixed(1)} %)`).join(' · ')}`);
  return { ...c, filas, conclusiones };
});

const salida = { generado: new Date().toISOString(), semilla: SEM, replicas: R, minutos: (Date.now() - t0) / 60000, contrastes: resultados.map((r) => ({ titulo: r.titulo, caracteristica: r.caracteristica, a: r.a.nombre, b: r.b.nombre, positivo: r.positivo, conclusiones: r.conclusiones, filas: r.filas })) };
writeFileSync('src/lib/lieia/disenos.json', JSON.stringify(salida));
const pct = (x: number) => `${(100 * x).toFixed(1)} %`;
const L: string[] = ['# LIEIA · Experimentos de diseño de exámenes', '',
  `Generado: ${salida.generado} · semilla ${SEM} · ${R} réplicas por diseño y escenario · 36 estudiantes · ${AN.permutaciones} permutaciones · ${salida.minutos.toFixed(1)} min.`,
  'Reproducir: `./node_modules/.bin/vite-node scripts/lieia-disenos.ts ' + R + '`.', '',
  'Cada contraste compara dos diseños con los mismos escenarios y semillas. «Aporta» = sube la potencia ≥ 10 puntos sin romper el control de falsos positivos; «engañosa» = algún control negativo supera el límite (IC superior > 7,5 %) solo con la característica; «resta» = baja la potencia ≥ 10 puntos.', ''];
for (const r of resultados) {
  L.push(`## ${r.titulo}`, '', `Referencia «${r.a.nombre}» frente a «${r.b.nombre}»; escenario positivo: ${ESCENARIOS[r.positivo].titulo}; controles negativos: ${NEG.map((e) => ESCENARIOS[e].titulo).join(', ')}.`, '',
    '| Detector | Potencia referencia | Potencia con la característica | Peor FP con la característica | Veredicto |', '|---|---|---|---|---|');
  for (const c of r.conclusiones) L.push(`| ${c.detector.toUpperCase()} ${DETECTORES[c.detector].nombre} | ${pct(c.potenciaA)} | ${pct(c.potenciaB)} | ${pct(c.fprB)} | **${c.veredicto}** |`);
  L.push('');
}
writeFileSync('docs/LIEIA_DISENO.md', L.join('\n') + '\n');
console.log(`Listo en ${salida.minutos.toFixed(1)} min`);
