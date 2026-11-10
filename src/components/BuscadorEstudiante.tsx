/**
 * Buscador global de estudiantes para el profesor: tecla «/» o Ctrl+K desde cualquier página → ficha del estudiante.
 * Usa la lista de estudiantes de sus secciones activas (la misma de Comunicación), que se pide al abrirlo por primera
 * vez y se filtra en el navegador: escribir no hace consultas.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { estudiantesBuscables } from '@/api/tablero';
import { buscarEstudiantes, type EstudianteBuscable } from '@/lib/tablero';
import { errorMessage } from '@/lib/supabase';
import { Modal, Spinner } from './ui';

/** Evento de ventana con el que cualquier botón abre el buscador. */
export const ABRIR_BUSCADOR = 'aula:buscar-estudiante';

const CADUCA_MS = 5 * 60_000;
let memoria: { cuando: number; lista: EstudianteBuscable[] } | null = null;

const escribiendo = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || !!el.closest('math-field, [contenteditable="true"]'));

export function BuscadorEstudiante() {
  const nav = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const [lista, setLista] = useState<EstudianteBuscable[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const abrir = () => setAbierto(true);
    const tecla = (e: KeyboardEvent) => {
      const atajo = (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !escribiendo(e.target));
      // en modo concentración (asistente de actividades, vista de examen) no se interrumpe
      if (!atajo || document.body.classList.contains('modo-concentracion')) return;
      e.preventDefault();
      setAbierto(true);
    };
    window.addEventListener(ABRIR_BUSCADOR, abrir);
    window.addEventListener('keydown', tecla);
    return () => {
      window.removeEventListener(ABRIR_BUSCADOR, abrir);
      window.removeEventListener('keydown', tecla);
    };
  }, []);

  useEffect(() => {
    if (!abierto) return;
    setQ('');
    setSel(0);
    setTimeout(() => campo.current?.focus(), 0);
    if (memoria && Date.now() - memoria.cuando < CADUCA_MS) return setLista(memoria.lista);
    setError('');
    estudiantesBuscables().then((l) => {
      memoria = { cuando: Date.now(), lista: l };
      setLista(l);
    }).catch((e) => setError(errorMessage(e)));
  }, [abierto]);

  const hallados = lista ? buscarEstudiantes(lista, q) : [];
  const ir = (e: EstudianteBuscable) => {
    setAbierto(false);
    nav(`/docente/clases/${e.class_id}/estudiantes/${e.user_id}`);
  };

  return (
    <Modal open={abierto} onClose={() => setAbierto(false)} title="Buscar un estudiante">
      <label className="block text-sm font-semibold" htmlFor="buscador-estudiante">Buscar un estudiante</label>
      <input id="buscador-estudiante" ref={campo} className="campo mt-1" type="search" autoComplete="off" placeholder="Nombre o matrícula" value={q}
        role="combobox" aria-expanded={hallados.length > 0} aria-controls="buscador-resultados" aria-activedescendant={hallados[sel] ? `buscado-${sel}` : undefined}
        onChange={(e) => { setQ(e.target.value); setSel(0); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, hallados.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
          else if (e.key === 'Enter' && hallados[sel]) { e.preventDefault(); ir(hallados[sel]); }
        }} />
      {error && <p className="mt-2 text-sm text-red-700 dark:text-red-300">No se pudo cargar la lista: {error}</p>}
      {!lista && !error && <Spinner />}
      <ul id="buscador-resultados" role="listbox" className="mt-2 divide-y divide-gray-100 dark:divide-white/10">
        {hallados.map((e, i) => (
          <li key={`${e.user_id}-${e.class_id}`} id={`buscado-${i}`} role="option" aria-selected={i === sel}>
            <button className={`flex min-h-[44px] w-full flex-wrap items-baseline gap-x-2 rounded-lg px-2 py-2 text-left text-sm ${i === sel ? 'bg-primario-50 dark:bg-white/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
              onMouseEnter={() => setSel(i)} onClick={() => ir(e)}>
              <span className="font-medium">{e.full_name}</span>
              {e.student_code && <span className="text-xs tabular-nums text-gray-500">{e.student_code}</span>}
              <span className="ml-auto text-xs text-gray-500">{e.class_name}</span>
            </button>
          </li>
        ))}
      </ul>
      {lista && q.trim().length >= 2 && !hallados.length && <p className="mt-2 text-sm text-gray-500">Nadie coincide en sus secciones activas.</p>}
      {lista && q.trim().length < 2 && <p className="mt-2 text-xs text-gray-500">{lista.length} estudiantes en sus secciones activas. Escriba al menos dos letras; Enter abre la ficha.</p>}
    </Modal>
  );
}
