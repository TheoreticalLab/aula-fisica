/**
 * Piezas de la estructura de estudio de un minicapítulo (lessons.study): objetivos, errores frecuentes,
 * preguntas conceptuales, autoevaluación breve y conexiones. Ninguna es una evaluación calificada:
 * sirven para estudiar, así que sus respuestas se muestran cuando el estudiante las pide.
 */
import { useState } from 'react';
import type { LessonStudy } from '@/api/tipos';
import { InlineMd, Markdown } from './Markdown';

export function Objetivos({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="mb-4 rounded-xl border border-primario-200 bg-primario-50/60 p-4 dark:border-primario-700/50 dark:bg-primario-900/20">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-primario-800 dark:text-primario-200">Objetivos de aprendizaje</h2>
      <p className="mb-1 text-sm text-gray-600 dark:text-gray-300">Al terminar este minicapítulo, usted podrá:</p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {items.map((o, i) => <li key={i}><InlineMd>{o}</InlineMd></li>)}
      </ul>
    </section>
  );
}

export function Conexiones({ texto }: { texto: string }) {
  if (!texto.trim()) return null;
  return (
    <section className="mt-6 rounded-xl border-l-4 border-acento-500 bg-acento-100/40 p-4 dark:bg-acento-700/10">
      <h2 className="mb-1 font-serif text-lg font-semibold">Conexiones con temas anteriores</h2>
      <Markdown className="text-sm">{texto}</Markdown>
    </section>
  );
}

export function ErroresFrecuentes({ items }: { items: NonNullable<LessonStudy['errores']> }) {
  if (!items.length) return null;
  return (
    <section className="tarjeta">
      <h2 className="mb-3 font-serif text-lg font-semibold">Errores conceptuales frecuentes</h2>
      <ul className="space-y-3">
        {items.map((e, i) => (
          <li key={i} className="rounded-lg border border-red-200 p-3 dark:border-red-900/50">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">✗ <InlineMd>{e.error}</InlineMd></p>
            <Markdown className="mt-1 text-sm">{e.aclaracion}</Markdown>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PreguntasConceptuales({ items }: { items: NonNullable<LessonStudy['preguntas']> }) {
  const [abiertas, setAbiertas] = useState<Set<number>>(new Set());
  if (!items.length) return null;
  const alternar = (i: number) => setAbiertas((s) => {
    const n = new Set(s);
    if (n.has(i)) n.delete(i); else n.add(i);
    return n;
  });
  return (
    <section className="tarjeta">
      <h2 className="mb-1 font-serif text-lg font-semibold">Preguntas conceptuales</h2>
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">Piense su respuesta antes de abrir la explicación.</p>
      <ol className="space-y-3">
        {items.map((q, i) => (
          <li key={i} className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
            <div className="flex gap-2"><span className="font-semibold">{i + 1}.</span><Markdown className="flex-1">{q.pregunta}</Markdown></div>
            <button className="btn-texto mt-1 text-sm" onClick={() => alternar(i)} aria-expanded={abiertas.has(i)}>
              {abiertas.has(i) ? 'Ocultar la explicación' : 'Ver la explicación'}
            </button>
            {abiertas.has(i) && <div className="mt-2 rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-900/20"><Markdown>{q.respuesta}</Markdown></div>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function PreguntaAuto({ q, n }: { q: NonNullable<LessonStudy['autoevaluacion']>[number]; n: number }) {
  const [sel, setSel] = useState<number | null>(null);
  const [visto, setVisto] = useState(false);
  const ok = sel === q.correcta;
  return (
    <li className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
      <div className="mb-2 flex gap-2"><span className="font-semibold">{n}.</span><Markdown className="flex-1">{q.pregunta}</Markdown></div>
      <fieldset className="space-y-2" disabled={visto}>
        {q.opciones.map((o, i) => (
          <label key={i} className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 ${
            visto && i === q.correcta ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
            : visto && i === sel ? 'border-red-400 bg-red-50 dark:bg-red-900/20'
            : sel === i ? 'border-primario-500 bg-primario-50 dark:bg-primario-900/40' : 'border-gray-200 dark:border-white/10'}`}>
            <input type="radio" className="mt-1" checked={sel === i} onChange={() => setSel(i)} />
            <InlineMd>{o}</InlineMd>
          </label>
        ))}
      </fieldset>
      {!visto ? (
        <button className="btn-secundario mt-2 text-sm" disabled={sel === null} onClick={() => setVisto(true)}>Comprobar</button>
      ) : (
        <div className={`mt-2 rounded-lg p-3 text-sm ${ok ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`} role="status">
          <p className="font-semibold">{ok ? '✓ Correcto' : '✗ No es correcto'}</p>
          <Markdown>{q.explicacion}</Markdown>
          <button className="btn-texto mt-1 text-xs" onClick={() => { setSel(null); setVisto(false); }}>Intentar de nuevo</button>
        </div>
      )}
    </li>
  );
}

export function Autoevaluacion({ items }: { items: NonNullable<LessonStudy['autoevaluacion']> }) {
  if (!items.length) return null;
  return (
    <section className="tarjeta">
      <h2 className="mb-1 font-serif text-lg font-semibold">Comprueba tu comprensión</h2>
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">Evaluación breve para usted: no cuenta para la calificación.</p>
      <ol className="space-y-3">{items.map((q, i) => <PreguntaAuto key={i} q={q} n={i + 1} />)}</ol>
    </section>
  );
}

/** ¿Tiene el minicapítulo material para la pestaña «Comprensión»? */
export function tieneComprension(s?: LessonStudy): boolean {
  return !!(s?.preguntas?.length || s?.autoevaluacion?.length);
}
