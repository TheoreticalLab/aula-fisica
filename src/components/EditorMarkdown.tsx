import { useRef, useState } from 'react';
import { Markdown } from './Markdown';

const AYUDA = [
  ['## Título', 'Encabezado de sección'],
  ['**negrita**  *cursiva*', 'Énfasis'],
  ['- elemento', 'Lista'],
  ['> Cuidado. …', 'Recuadro de aviso'],
  ['$v = \\dfrac{\\Delta x}{\\Delta t}$', 'Fórmula en línea'],
  ['$$x = x_0 + v t$$', 'Fórmula destacada'],
  ['![descripción](https://…/imagen.png)', 'Imagen (enlace https)'],
  ['```video\nhttps://www.youtube.com/watch?v=…\n```', 'Vídeo de YouTube o Vimeo'],
  ['| a | b |\n|---|---|\n| 1 | 2 |', 'Tabla'],
];

const SNIPPETS: [string, string][] = [
  ['Fórmula', '$  $'],
  ['Bloque', '\n$$\n\n$$\n'],
  ['Fracción', '\\dfrac{}{}'],
  ['Vector', '\\vec{F}'],
  ['Unidad', '\\,\\mathrm{m/s}'],
  ['Δ', '\\Delta '],
  ['θ', '\\theta '],
  ['μ', '\\mu '],
  ['·', '\\cdot '],
  ['×', '\\times '],
  ['Imagen', '![descripción](https://)'],
  ['Vídeo', '\n```video\nhttps://\n```\n'],
];

/** Editor de Markdown + LaTeX con vista previa. Pensado para profesores sin conocimientos de programación. */
export function EditorMarkdown({ value, onChange, rows = 10, label, id }: { value: string; onChange: (v: string) => void; rows?: number; label?: string; id?: string }) {
  const [mode, setMode] = useState<'editar' | 'vista' | 'ambos'>('editar');
  const [help, setHelp] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const insert = (s: string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + s + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      const pos = start + (s.indexOf('  ') >= 0 ? s.indexOf('  ') + 1 : s.length);
      el?.setSelectionRange(pos, pos);
    });
  };
  return (
    <div className="mb-3">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        {label && <label htmlFor={id} className="etiqueta mb-0">{label}</label>}
        <div className="ml-auto flex gap-1 text-xs">
          {(['editar', 'ambos', 'vista'] as const).map((m) => (
            <button type="button" key={m} onClick={() => setMode(m)}
              className={`rounded px-2 py-1 ${mode === m ? 'bg-primario-800 text-white dark:bg-primario-500' : 'bg-gray-100 dark:bg-white/10'}`}>
              {m === 'editar' ? 'Editar' : m === 'vista' ? 'Vista previa' : 'Ambos'}
            </button>
          ))}
          <button type="button" className="rounded bg-gray-100 px-2 py-1 dark:bg-white/10" onClick={() => setHelp((h) => !h)}>Ayuda</button>
        </div>
      </div>
      {help && (
        <div className="mb-2 rounded-lg bg-gray-50 p-2 text-xs dark:bg-white/5">
          <table className="w-full">
            <tbody>
              {AYUDA.map(([c, d]) => (
                <tr key={d}><td className="whitespace-pre py-0.5 pr-3 font-mono">{c}</td><td>{d}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {mode !== 'vista' && (
        <div className="mb-1 flex flex-wrap gap-1">
          {SNIPPETS.map(([l, s]) => (
            <button type="button" key={l} onClick={() => insert(s)} className="rounded border border-gray-300 px-2 py-0.5 text-xs dark:border-white/20">{l}</button>
          ))}
        </div>
      )}
      <div className={mode === 'ambos' ? 'grid gap-2 lg:grid-cols-2' : ''}>
        {mode !== 'vista' && (
          <textarea ref={ref} id={id} className="campo font-mono text-sm" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} spellCheck />
        )}
        {mode !== 'editar' && (
          <div className="min-h-[6rem] rounded-lg border border-dashed border-gray-300 p-3 dark:border-white/20">
            {value.trim() ? <Markdown>{value}</Markdown> : <p className="text-sm text-gray-400">(vacío)</p>}
          </div>
        )}
      </div>
    </div>
  );
}
