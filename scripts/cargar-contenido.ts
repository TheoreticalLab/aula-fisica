/**
 * Carga el contenido inicial (contenido/) y, si existen, las claves privadas (privado/claves/).
 * Lo usan el generador de la semilla y las pruebas de contenido. Nunca lo importa el frontend.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { KeyMap, LessonDef } from '../contenido/tipos';
import { UNITS, type UnitMeta } from '../contenido/unidades';

export const ROOT = resolve(import.meta.dirname ?? new URL('.', import.meta.url).pathname, '..');

export interface LoadedLesson {
  file: string;
  position: number;
  lesson: LessonDef;
  keys: KeyMap | null;
}

export interface LoadedUnit {
  meta: UnitMeta;
  position: number;
  lessons: LoadedLesson[];
}

const LESSON_FILE = /^(\d\d)-[a-z0-9-]+\.ts$/;

export async function loadContent(): Promise<LoadedUnit[]> {
  const out: LoadedUnit[] = [];
  for (const [ui, meta] of UNITS.entries()) {
    const lessons: LoadedLesson[] = [];
    if (meta.folder) {
      const dir = join(ROOT, 'contenido', meta.folder);
      const files = existsSync(dir) ? readdirSync(dir).filter((f) => LESSON_FILE.test(f)).sort() : [];
      for (const file of files) {
        const mod = (await import(pathToFileURL(join(dir, file)).href)) as { leccion?: LessonDef };
        if (!mod.leccion) throw new Error(`${meta.folder}/${file} no exporta «leccion»`);
        const keyPath = join(ROOT, 'privado', 'claves', meta.folder, file);
        let keys: KeyMap | null = null;
        if (existsSync(keyPath)) {
          const kmod = (await import(pathToFileURL(keyPath).href)) as { claves?: KeyMap };
          if (!kmod.claves) throw new Error(`privado/claves/${meta.folder}/${file} no exporta «claves»`);
          keys = kmod.claves;
        }
        lessons.push({ file: `${meta.folder}/${file}`, position: Number(file.slice(0, 2)), lesson: mod.leccion, keys });
      }
    }
    out.push({ meta, position: ui + 1, lessons });
  }
  return out;
}

export function privateKeysPresent(): boolean {
  return existsSync(join(ROOT, 'privado', 'claves'));
}
