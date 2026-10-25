/**
 * Vista previa de lecciones SIN base de datos, solo para desarrollo y capturas de pantalla.
 * Carga la parte pública del contenido (contenido/), nunca las claves. No forma parte de la compilación.
 *   http://localhost:5173/pruebas/vista-previa/?l=bloque2/08-proyectiles&s=simulacion
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'katex/dist/katex.min.css';
import '../../src/index.css';
import type { LessonDef } from '../../contenido/tipos';
import { Markdown } from '../../src/components/Markdown';
import { Card } from '../../src/components/ui';
import { EnunciadoEjercicio, EntradaRespuesta } from '../../src/components/Ejercicio';
import { EjemploResuelto, FormulaCard } from '../../src/pages/estudiante/Leccion';
import { Simulador } from '../../src/sims/Simulador';
import { DIFICULTAD } from '../../src/lib/util';

const mods = import.meta.glob('../../contenido/bloque*/*.ts');
const params = new URLSearchParams(location.search);
const l = params.get('l') ?? 'bloque2/04-mru';
const s = params.get('s') ?? 'teoria';

async function main() {
  const loader = mods[`../../contenido/${l}.ts`];
  const root = createRoot(document.getElementById('root')!);
  if (!loader) {
    root.render(<p>No existe {l}</p>);
    return;
  }
  const { leccion } = (await loader()) as { leccion: LessonDef };
  root.render(
    <StrictMode>
      <main className="mx-auto max-w-5xl space-y-4 p-4">
        <h1 className="font-serif text-2xl font-semibold text-primario-900 dark:text-white">{leccion.title}</h1>
        {s === 'teoria' && <article className="tarjeta"><Markdown>{leccion.theory}</Markdown></article>}
        {s === 'formulas' && <div className="grid gap-4 md:grid-cols-2">{leccion.formulas.map((f, i) => <FormulaCard key={i} f={f} />)}</div>}
        {s === 'ejemplos' && leccion.examples.map((e, i) => <EjemploResuelto key={i} ex={e} n={i + 1} />)}
        {s === 'simulacion' && leccion.simulation && (
          <>
            <Card title="Actividad guiada"><Markdown>{leccion.simulation.guide}</Markdown></Card>
            <div className="tarjeta"><Simulador simKey={leccion.simulation.key} params={leccion.simulation.params} /></div>
          </>
        )}
        {s === 'practica' &&
          leccion.exercises.map((e, i) => {
            const ex = { ...e, options: e.options ?? null, multiple: !!e.multiple, figure: e.figure ?? null, simulation: e.simulation ?? null, unit_hint: e.unitHint ?? null, slug: e.id, lesson_id: null };
            return (
              <article key={e.id} className="tarjeta">
                <h3 className="font-serif text-lg font-semibold">Ejercicio {i + 1} · {DIFICULTAD[e.difficulty]} · {e.category}</h3>
                <EnunciadoEjercicio ex={ex} />
                <div className="mt-3"><EntradaRespuesta ex={ex} answer={{}} onChange={() => undefined} disabled={false} /></div>
              </article>
            );
          })}
      </main>
    </StrictMode>,
  );
}
void main();
