/**
 * Clases impartidas (estudiante): historial cronológico de las clases publicadas de sus secciones (haya asistido o
 * no), con filtros por fecha, tema y unidad. Quien tiene permiso de carga (profesor, monitor habilitado o estudiante
 * delegado) ve además «+ Registrar clase» y sus envíos.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { clasesMias, clasesPuedoSubir, clasesSeccion, type ClaseResumen } from '@/api/clases';
import { Badge, Empty, ErrorBox, PageTitle, Spinner } from '@/components/ui';
import { ESTADO_FOTOS, fechaClase, filtrarClases } from '@/lib/clases';
import { useAsync } from '@/lib/util';

export default function Clases() {
  const st = useAsync(async () => {
    const [mias, subir] = await Promise.all([clasesMias(), clasesPuedoSubir().catch(() => [])]);
    // envíos propios (pendientes o rechazados) de las secciones donde puede subir
    const propias = (await Promise.all(subir.map((s) => clasesSeccion(s.class_id).catch(() => [] as ClaseResumen[])))).flat()
      .filter((c) => c.fotos_estado !== 'aprobada' && !c.ampliada_publicada);
    return { mias, subir, propias };
  }, []);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [texto, setTexto] = useState('');
  const [unidad, setUnidad] = useState('');
  const lista = useMemo(() => filtrarClases(st.data?.mias ?? [], { desde, hasta, texto, unidad }), [st.data, desde, hasta, texto, unidad]);
  const unidades = useMemo(() => [...new Map((st.data?.mias ?? []).filter((c) => c.unit_id).map((c) => [c.unit_id!, c.unidad ?? ''])).entries()], [st.data]);
  if (st.loading) return <Spinner />;
  if (st.error) return <ErrorBox error={st.error} onRetry={st.reload} />;
  const { subir, propias } = st.data!;
  return (
    <div className="space-y-4">
      <PageTitle title="Clases impartidas" subtitle="Lo que realmente se trabajó en el aula: las pizarras de cada clase y, cuando el profesor la publica, una versión ampliada."
        actions={subir.length > 0 ? <Link to="/clases/registrar" className="btn-primario">+ Registrar clase</Link> : undefined} />
      {propias.length > 0 && (
        <div className="tarjeta">
          <p className="font-medium">Mis envíos sin publicar</p>
          <ul className="mt-2 space-y-1 text-sm">
            {propias.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2">
                <Link className="enlace" to={`/clases/${c.id}/editar`}>{c.title}</Link>
                <span className="text-gray-500">{fechaClase(c.fecha)} · {c.seccion}</span>
                <Badge tone={ESTADO_FOTOS[c.fotos_estado].tono}>{ESTADO_FOTOS[c.fotos_estado].texto}</Badge>
                {c.fotos_motivo && <span className="text-xs text-red-700 dark:text-red-300">{c.fotos_motivo}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2 text-sm">
        <label><span className="etiqueta">Desde</span><input type="date" className="campo" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
        <label><span className="etiqueta">Hasta</span><input type="date" className="campo" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
        <label className="min-w-[12rem] flex-1"><span className="etiqueta">Tema</span><input className="campo" placeholder="Buscar por título o tema" value={texto} onChange={(e) => setTexto(e.target.value)} /></label>
        {unidades.length > 0 && (
          <label><span className="etiqueta">Unidad</span>
            <select className="campo" value={unidad} onChange={(e) => setUnidad(e.target.value)}>
              <option value="">Todas</option>{unidades.map(([id, t]) => <option key={id} value={id}>{t}</option>)}
            </select></label>
        )}
      </div>
      {lista.length === 0 ? <Empty>{st.data!.mias.length ? 'Ninguna clase coincide con los filtros.' : 'Todavía no hay clases publicadas en sus secciones.'}</Empty> : (
        <ul className="space-y-2">
          {lista.map((c) => (
            <li key={c.id}>
              <Link to={`/clases/${c.id}`} className="tarjeta block hover:border-primario-400">
                <p className="text-xs uppercase tracking-wide text-gray-500">{fechaClase(c.fecha)} · {c.asignatura} · {c.seccion}</p>
                <p className="font-serif text-lg font-semibold">{c.title}</p>
                {c.temas.length > 0 && <p className="text-sm text-gray-600 dark:text-gray-300">{c.temas.join(' · ')}</p>}
                <p className="mt-1 flex flex-wrap gap-2 text-xs">
                  {c.fotos_estado === 'aprobada' && <Badge tone="blue">{c.n_fotos} pizarra(s)</Badge>}
                  {c.ampliada_publicada ? <Badge tone="green">Clase ampliada</Badge> : <Badge>Solo fotografías</Badge>}
                  {c.unidad && <Badge>{c.unidad}</Badge>}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
