/** Clases impartidas: presentación pura de la clase ampliada y de «Dónde estudiar» (sin acceso a datos). */
import { Link } from 'react-router-dom';
import type { Contenido, Enlace } from '@/lib/clases';
import { Markdown } from '@/components/Markdown';
import { Badge } from '@/components/ui';
import { casoCobertura, COBERTURA, urlEnlace } from '@/lib/clases';

export function ClaseAmpliada({ contenido, aviso = true }: { contenido: Contenido; aviso?: boolean }) {
  return (
    <div className="space-y-5">
      {aviso && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
          Versión ampliada con inteligencia artificial a partir de las fotografías de las pizarras y aprobada por el profesor. Distingue lo visible en la pizarra de lo
          inferido; las «ampliaciones» son material complementario, no necesariamente lo dicho en clase. Sin audio, no recoge las explicaciones orales.
        </p>
      )}
      {contenido.secciones.map((s, i) => (
        <section key={i} className={s.clave === 'incertidumbres' ? 'rounded-lg border border-amber-300 p-3 dark:border-amber-800' : ''}>
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
