/**
 * Carga una biblioteca académica desde privado/biblioteca/<nombre>/:
 *   curso.ts            → export const curso: CursoBiblioteca
 *   <unidad>/unidad.ts  → export const unidad: UnidadBiblioteca
 *   <unidad>/NN-*.ts    → export const mini: MiniCapitulo   (en orden por NN)
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { CursoBiblioteca, MiniCapitulo, UnidadBiblioteca } from './tipos';

export interface MiniCargado {
  archivo: string;
  posicion: number;
  mini: MiniCapitulo;
}

export interface UnidadCargada {
  carpeta: string;
  posicion: number;
  meta: UnidadBiblioteca;
  minis: MiniCargado[];
}

export interface BibliotecaCargada {
  dir: string;
  curso: CursoBiblioteca;
  unidades: UnidadCargada[];
}

const ARCHIVO_MINI = /^(\d\d)-[a-z0-9-]+\.ts$/;

export async function cargarBiblioteca(dir: string): Promise<BibliotecaCargada> {
  const rutaCurso = join(dir, 'curso.ts');
  if (!existsSync(rutaCurso)) throw new Error(`No existe ${rutaCurso}`);
  const { curso } = (await import(pathToFileURL(rutaCurso).href)) as { curso: CursoBiblioteca };
  const unidades: UnidadCargada[] = [];
  for (const [i, carpeta] of curso.unidades.entries()) {
    const d = join(dir, carpeta);
    if (!existsSync(join(d, 'unidad.ts'))) throw new Error(`Falta ${carpeta}/unidad.ts`);
    const { unidad } = (await import(pathToFileURL(join(d, 'unidad.ts')).href)) as { unidad: UnidadBiblioteca };
    const minis: MiniCargado[] = [];
    for (const archivo of readdirSync(d).filter((f) => ARCHIVO_MINI.test(f)).sort()) {
      const mod = (await import(pathToFileURL(join(d, archivo)).href)) as { mini?: MiniCapitulo };
      if (!mod.mini) throw new Error(`${carpeta}/${archivo} no exporta «mini»`);
      minis.push({ archivo, posicion: Number(archivo.slice(0, 2)), mini: mod.mini });
    }
    unidades.push({ carpeta, posicion: i + 1, meta: unidad, minis });
  }
  return { dir, curso, unidades };
}
