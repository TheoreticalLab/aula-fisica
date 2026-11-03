/**
 * Copiar una práctica o evaluación a otras secciones (migración 73), también de otra asignatura (p. ej. de Física
 * General I a Física General IA). Copia la configuración completa, nunca datos de estudiantes; la copia queda oculta.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { teacherOverview } from '@/api/docente';
import { rpc } from '@/lib/supabase';
import { useAsync } from '@/lib/util';
import { ErrorBox, Modal, Notice, Spinner } from '@/components/ui';

interface Resultado {
  id: string; misma_asignatura: boolean; ejercicios: number; ejercicios_enlazados: number; ejercicios_copiados: number;
  registro: string | null; registro_por_definir: boolean;
}

export function CopiarActividad({ actividad, classId, onClose }: { actividad: { id: string; title: string }; classId: string; onClose: () => void }) {
  const secciones = useAsync(teacherOverview, []);
  const [destinos, setDestinos] = useState<Set<string>>(new Set());
  const [fechas, setFechas] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hechas, setHechas] = useState<{ seccion: string; r?: Resultado; error?: string }[]>([]);
  const lista = (secciones.data ?? []).filter((s) => !s.archived);
  const porAsignatura = new Map<string, typeof lista>();
  for (const s of lista) porAsignatura.set(s.course_title, [...(porAsignatura.get(s.course_title) ?? []), s]);

  async function copiar() {
    setBusy(true);
    const out: typeof hechas = [];
    for (const s of lista.filter((x) => destinos.has(x.class_id))) {
      try {
        out.push({ seccion: `${s.course_title} · ${s.name}`, r: await rpc<Resultado>('actividad_copiar', { p_activity: actividad.id, p_class: s.class_id, p_fechas: fechas }) });
      } catch (e) {
        out.push({ seccion: `${s.course_title} · ${s.name}`, error: e instanceof Error ? e.message : String(e) });
      }
    }
    setHechas(out);
    setDestinos(new Set());
    setBusy(false);
  }

  return (
    <Modal open onClose={onClose} title={`Copiar «${actividad.title}»`}>
      {secciones.loading ? <Spinner /> : secciones.error ? <ErrorBox error={secciones.error} /> : hechas.length ? (
        <div className="space-y-2 text-sm">
          {hechas.map((h) => (
            <div key={h.seccion} className="rounded border border-gray-200 p-2 dark:border-white/10">
              <p className="font-medium">{h.seccion}</p>
              {h.error ? <p className="text-red-700">✖ {h.error}</p> : h.r && (
                <>
                  <p>✓ Copiada con {h.r.ejercicios} ejercicio(s), <strong>oculta</strong> hasta que la revise y la publique.{' '}
                    <Link className="enlace" to={`/docente/actividades/${h.r.id}`}>Abrir la copia</Link></p>
                  {!h.r.misma_asignatura && (
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      Otra asignatura: {h.r.ejercicios_enlazados} ejercicio(s) enlazados con los de esa asignatura (mismo identificador)
                      {h.r.ejercicios_copiados > 0 && ` y ${h.r.ejercicios_copiados} copiado(s) a su banco como borradores`}.
                    </p>
                  )}
                  {h.r.registro && <p className="text-xs text-gray-600 dark:text-gray-300">Cuenta en el registro igual que la original{h.r.registro_por_definir ? ', pero con valor «por definir»: el valor fijo no cabía en esa sección' : ''}.</p>}
                </>
              )}
            </div>
          ))}
          <div className="flex justify-end gap-2">
            <button className="btn-secundario" onClick={() => setHechas([])}>Copiar a otras</button>
            <button className="btn-primario" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-gray-600 dark:text-gray-300">
            Se copia la actividad con su configuración (ejercicios, valores, examen, diseño, práctica asistida y su apartado del registro).
            No se copia nada de los estudiantes. La copia queda <strong>oculta</strong> para que la revise y la publique.
          </p>
          {[...porAsignatura.entries()].map(([asig, ss]) => (
            <fieldset key={asig}>
              <legend className="etiqueta">{asig}</legend>
              {ss.map((s) => (
                <label key={s.class_id} className="flex items-center gap-2 py-0.5">
                  <input type="checkbox" checked={destinos.has(s.class_id)}
                    onChange={(e) => setDestinos((d) => { const n = new Set(d); if (e.target.checked) n.add(s.class_id); else n.delete(s.class_id); return n; })} />
                  {s.name}{s.class_id === classId && <span className="text-xs text-gray-500">(esta misma sección: duplicar)</span>}
                </label>
              ))}
            </fieldset>
          ))}
          <label className="flex items-center gap-2"><input type="checkbox" checked={fechas} onChange={(e) => setFechas(e.target.checked)} /> Conservar las fechas de apertura y cierre</label>
          {!fechas && <Notice>Sin fechas, la copia queda abierta sin límite hasta que les ponga fechas.</Notice>}
          <div className="flex justify-end gap-2">
            <button className="btn-texto" onClick={onClose}>Cancelar</button>
            <button className="btn-primario" disabled={!destinos.size || busy} onClick={() => void copiar()}>{busy ? 'Copiando…' : `Copiar a ${destinos.size || ''} sección(es)`}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
