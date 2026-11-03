/**
 * Panel docente · sección → «Programa impartido» (migración 71; solo asignaturas con programa). Seguimiento de lo
 * que realmente se impartió: marque subtemas con la fecha y, si quiere, la clase impartida y una nota. Desmarcar
 * anula la marca (queda en el historial). Muestra el avance por unidad y capítulo y la lectura de los estudiantes
 * (tiempo de estudio: no es dominio ni nota).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { programaDesmarcar, programaMarcar, programaSeccion } from '@/api/programa';
import { avanceSubtemas, fechasImpartido, fraccion, hoySantoDomingo, NIVELES, sumarAvances, type CapituloSeccion } from '@/lib/programa';
import { useAction, useAsync } from '@/lib/util';
import { Badge, Empty, ErrorBox, Notice, ProgressBar, Spinner } from '@/components/ui';

export function TabPrograma({ classId }: { classId: string }) {
  const st = useAsync(() => programaSeccion(classId), [classId]);
  const accion = useAction();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [fecha, setFecha] = useState(hoySantoDomingo());
  const [sesion, setSesion] = useState('');
  const [nota, setNota] = useState('');
  if (st.loading && !st.data) return <Spinner />;
  if (st.error) return <ErrorBox error={st.error} onRetry={st.reload} />;
  const p = st.data!;
  if (!p.programa) return <Empty>Esta asignatura no usa el seguimiento del programa.</Empty>;
  const capitulos = p.unidades.flatMap((u) => u.capitulos);
  const total = sumarAvances(capitulos.map((c) => avanceSubtemas(c.subtemas)));
  const alternar = (ids: string[], marcar: boolean) => setSel((s) => { const n = new Set(s); ids.forEach((i) => (marcar ? n.add(i) : n.delete(i))); return n; });

  async function marcar() {
    const r = await accion.run(() => programaMarcar(classId, [...sel], fecha, sesion || null, nota.trim() || null));
    if (r !== undefined) { setSel(new Set()); setNota(''); st.reload(); }
  }
  async function desmarcar(id: string, nombre: string, f: string) {
    if (!window.confirm(`¿Quitar «${nombre}» como impartido el ${fechasImpartido([f])}? La marca queda anulada en el historial.`)) return;
    if ((await accion.run(() => programaDesmarcar(id))) !== undefined) st.reload();
  }

  return (
    <div className="space-y-4">
      <div className="tarjeta">
        <ProgressBar tone="green" value={fraccion(total.esencialesImpartidos, total.esenciales)}
          label={`Subtemas esenciales impartidos en esta sección: ${total.esencialesImpartidos} de ${total.esenciales} · todos: ${total.impartidos} de ${total.total}`} />
        <p className="mt-2 text-xs text-gray-500">
          Marque lo que se impartió en clase (cada sección lleva su propio avance). Los estudiantes ven qué subtemas se impartieron y cuándo; la lectura
          del material se muestra como tiempo de estudio, nunca como dominio. La estructura del programa (capítulos, subtemas, objetivos, ecuaciones,
          material) se edita en Contenido → la asignatura → cada capítulo.
        </p>
      </div>
      {sel.size > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-end gap-2 rounded-xl border border-primario-200 bg-white/95 p-3 shadow-lg dark:border-white/15 dark:bg-primario-950/95">
          <span className="text-sm font-medium">{sel.size} subtema(s) seleccionado(s)</span>
          <label className="text-sm"><span className="etiqueta">Fecha</span><input type="date" className="campo !py-1" value={fecha} max={hoySantoDomingo()} onChange={(e) => setFecha(e.target.value)} /></label>
          <label className="text-sm"><span className="etiqueta">Clase impartida (opcional)</span>
            <select className="campo !py-1" value={sesion} onChange={(e) => setSesion(e.target.value)}>
              <option value="">— ninguna —</option>
              {p.sesiones.map((s) => <option key={s.id} value={s.id}>{fechasImpartido([s.fecha])} · {s.titulo}</option>)}
            </select></label>
          <label className="min-w-[12rem] flex-1 text-sm"><span className="etiqueta">Nota (opcional)</span><input className="campo !py-1" maxLength={500} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="p. ej. solo la idea, sin demostración" /></label>
          <button className="btn-primario !py-1.5" disabled={accion.busy || !fecha} onClick={() => void marcar()}>Marcar como impartidos</button>
          <button className="btn-texto" onClick={() => setSel(new Set())}>Cancelar</button>
        </div>
      )}
      <ErrorBox error={accion.error} />
      {p.unidades.map((u) => {
        const av = sumarAvances(u.capitulos.map((c) => avanceSubtemas(c.subtemas)));
        return (
          <details key={u.id} className="tarjeta" open>
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2">
              <h3 className="font-serif text-lg font-semibold">{u.titulo}</h3>
              <Badge tone={u.estado === 'publicado' ? 'green' : u.estado === 'preparado' ? 'amber' : 'gray'}>
                {u.estado === 'publicado' ? 'Publicada' : u.estado === 'preparado' ? 'Programa visible, material no' : 'Borrador'}
              </Badge>
              <span className="ml-auto text-xs text-gray-500">esenciales impartidos {av.esencialesImpartidos}/{av.esenciales}</span>
            </summary>
            <div className="mt-3 space-y-4">
              {u.capitulos.map((c) => <Capitulo key={c.id} c={c} estudiantes={p.estudiantes} sel={sel} alternar={alternar} desmarcar={desmarcar} />)}
            </div>
          </details>
        );
      })}
      {p.unidades.length === 0 && <Notice>La asignatura no tiene unidades.</Notice>}
    </div>
  );
}

function Capitulo({ c, estudiantes, sel, alternar, desmarcar }: {
  c: CapituloSeccion; estudiantes: number; sel: Set<string>; alternar: (ids: string[], marcar: boolean) => void;
  desmarcar: (id: string, nombre: string, fecha: string) => void;
}) {
  const av = avanceSubtemas(c.subtemas);
  const pendientes = c.subtemas.filter((s) => !s.oculto && !s.impartido.length).map((s) => s.id);
  return (
    <section className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="font-semibold">{c.titulo}</h4>
        {c.oculto && <Badge tone="amber">Oculto</Badge>}
        <span className="text-xs text-gray-500">{av.impartidos}/{av.total} impartidos · {c.enlaces} vínculo(s) · {c.notas} nota(s)</span>
        <span className="text-xs text-gray-500" title="Estudiantes de la sección que estudiaron el material del capítulo (tiempo efectivo)">
          · lectura: {c.lectores}/{estudiantes} estudiantes, {Number(c.minutos)} min
        </span>
        <span className="ml-auto flex gap-2 text-xs">
          {pendientes.length > 0 && <button className="btn-texto" onClick={() => alternar(pendientes, true)}>Seleccionar pendientes</button>}
          <Link className="enlace" to={`/docente/lecciones/${c.id}`}>Editar capítulo</Link>
        </span>
      </div>
      <ProgressBar tone="green" value={fraccion(av.impartidos, av.total)} />
      <ul className="mt-2 space-y-1">
        {c.subtemas.map((s) => (
          <li key={s.id} className={`flex flex-wrap items-center gap-2 text-sm ${s.oculto ? 'opacity-50' : ''}`}>
            <input type="checkbox" checked={sel.has(s.id)} onChange={(e) => alternar([s.id], e.target.checked)} aria-label={`Seleccionar ${s.nombre}`} />
            <Badge tone={NIVELES[s.nivel].tono}>{NIVELES[s.nivel].etiqueta}</Badge>
            <span className="min-w-0 flex-1">{s.nombre}{s.oculto && ' (oculto)'}</span>
            {s.impartido.map((k) => (
              <span key={k.id} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                title={[k.sesion && `Clase: ${k.sesion}`, k.nota].filter(Boolean).join(' · ') || undefined}>
                ✓ {fechasImpartido([k.fecha])}{k.sesion ? ' · clase' : ''}
                <button className="ml-1 text-emerald-900/60 hover:text-red-700 dark:text-emerald-200/60" aria-label="Quitar esta marca" onClick={() => desmarcar(k.id, s.nombre, k.fecha)}>✕</button>
              </span>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
