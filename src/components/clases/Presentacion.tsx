/** Clases impartidas: presentación pura de la clase ampliada y de «Dónde estudiar» (sin acceso a datos). */
import { Link } from 'react-router-dom';
import type { Contenido, Enlace } from '@/lib/clases';
import { Markdown } from '@/components/Markdown';
import { Badge } from '@/components/ui';
import { casoCobertura, COBERTURA, urlEnlace } from '@/lib/clases';
import { SECCIONES } from '../../../supabase/functions/_shared/clases/estimacion';

/** Orden y títulos vigentes (la nota sobre la lectura de las pizarras primero), también para versiones ya generadas. */
export function ordenarSecciones(secciones: Contenido['secciones']): Contenido['secciones'] {
  const pos = new Map<string, number>(SECCIONES.map(([c], i) => [c, i]));
  const titulo = new Map<string, string>(SECCIONES.map(([c, t]) => [c, t]));
  return secciones
    .map((s, i) => ({ s: s.clave && titulo.has(s.clave) ? { ...s, titulo: titulo.get(s.clave)! } : s, i }))
    .filter(({ s }) => s.cuerpo.trim() !== '')
    .sort((a, b) => (pos.get(a.s.clave ?? '') ?? 100 + a.i) - (pos.get(b.s.clave ?? '') ?? 100 + b.i))
    .map(({ s }) => s);
}

export function ClaseAmpliada({ contenido }: { contenido: Contenido; aviso?: boolean }) {
  return (
    <div className="space-y-5">
      {ordenarSecciones(contenido.secciones).map((s, i) => (
        <section key={i} className={s.clave === 'incertidumbres' ? 'rounded-lg border border-amber-300 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-900/10' : ''}>
          <h2 className="mb-2 font-serif text-lg font-semibold">{s.titulo}</h2>
          <Markdown>{s.cuerpo}</Markdown>
        </section>
      ))}
    </div>
  );
}

const ICONO: Record<string, string> = { leccion: '📘', unidad: '🗂️', ejercicio: '✏️', simulador: '🧪', brecha: '🚧' };

export function DondeEstudiar({ enlaces, courseId, docente = false }: { enlaces: Enlace[]; courseId: string; docente?: boolean }) {
  const visibles = enlaces.filter((e) => e.estado !== 'rechazado');
  const caso = casoCobertura(visibles);
  const teoria = visibles.filter((e) => e.tipo !== 'brecha');
  const brechas = visibles.filter((e) => e.tipo === 'brecha');
  if (!visibles.length) return <p className="text-sm text-gray-500">Todavía no hay referencias a la teoría para esta clase.</p>;
  return (
    <div className="space-y-3">
      {caso === 'C' && <p className="rounded-lg bg-blue-50 p-3 text-sm dark:bg-blue-900/20">Este contenido fue trabajado en clase, pero todavía no está desarrollado en la teoría oficial de la plataforma. La clase ampliada puede servir como material provisional de estudio.</p>}
      {caso === 'B' && <p className="text-sm text-gray-600 dark:text-gray-300">Parte de lo trabajado está en la teoría; lo demás se indica abajo como pendiente.</p>}
      {teoria.length > 0 && (
        <ul className="space-y-1.5">
          {teoria.map((e) => {
            const url = urlEnlace(e, courseId);
            const texto = e.tipo === 'leccion' ? `${e.leccion ?? 'Lección'}${e.apartado ? ` › ${e.apartado}` : ''}`
              : e.tipo === 'unidad' ? `Unidad: ${e.unidad ?? ''}` : e.tipo === 'ejercicio' ? `Ejercicio ${e.ejercicio ?? ''}${e.leccion ? ` (${e.leccion})` : ''}`
              : `Simulador de «${e.leccion ?? ''}»`;
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span aria-hidden="true">{ICONO[e.tipo]}</span>
                {url ? <Link to={url} className="enlace">{texto}</Link> : <span>{texto}</span>}
                {e.cobertura && <Badge tone={e.cobertura === 'completa' ? 'green' : e.cobertura === 'parcial' ? 'amber' : 'gray'}>{COBERTURA[e.cobertura]}</Badge>}
                {docente && e.estado === 'sugerido' && <Badge tone="purple">sugerido por IA</Badge>}
              </li>
            );
          })}
        </ul>
      )}
      {brechas.length > 0 && (
        <div>
          <p className="text-sm font-medium">Trabajado en clase, aún no incorporado a la teoría:</p>
          <ul className="mt-1 list-disc pl-5 text-sm">{brechas.map((e) => <li key={e.id}>{e.concepto}{docente && e.estado === 'sugerido' ? ' (sugerido)' : ''}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
