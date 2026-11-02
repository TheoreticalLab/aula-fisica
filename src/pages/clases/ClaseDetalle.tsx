/**
 * Página de una clase impartida (estudiante y profesor): encabezado, pizarras originales, clase ampliada aprobada y
 * «Dónde estudiar». El estudiante nunca recibe borradores ni puede generar con IA desde aquí.
 * «Exportar a PDF» abre la vista de impresión (sin otra llamada a Claude ni copia del contenido).
 */
import { Link, useParams } from 'react-router-dom';
import { claseDetalle } from '@/api/clases';
import { ClaseAmpliada, DondeEstudiar, GaleriaPizarras } from '@/components/clases/Componentes';
import { Card, ErrorBox, Notice, PageTitle, Spinner } from '@/components/ui';
import { fechaClase } from '@/lib/clases';
import { useAsync } from '@/lib/util';

export default function ClaseDetalle() {
  const { sessionId = '' } = useParams();
  const st = useAsync(() => claseDetalle(sessionId), [sessionId]);
  if (st.loading) return <Spinner />;
  if (st.error || !st.data) return <ErrorBox error={st.error ?? 'Clase no disponible'} />;
  const c = st.data;
  return (
    <div className="space-y-4">
      <PageTitle title={c.title} back={{ to: '/clases', label: 'Clases impartidas' }}
        subtitle={<>{fechaClase(c.fecha)} · {c.asignatura} · {c.seccion}{c.unidad ? ` · ${c.unidad}` : ''}</>}
        actions={<div className="no-print flex gap-2">
          {c.publicada && <button className="btn-secundario" onClick={() => window.print()}>Exportar a PDF</button>}
          {c.papel === 'docente' && <Link className="btn-secundario" to={`/docente/clases-impartidas/${c.id}`}>Administrar</Link>}
        </div>} />
      {c.temas.length > 0 && <p className="text-sm text-gray-600 dark:text-gray-300">Temas: {c.temas.join(' · ')}</p>}
      {c.descripcion && <p className="text-sm">{c.descripcion}</p>}

      <Card title="Pizarras originales">
        {c.fotos_visibles && c.imagenes.length ? <GaleriaPizarras sessionId={c.id} n={c.imagenes.length} />
          : <p className="text-sm text-gray-500">Las fotografías de esta clase no están publicadas.</p>}
      </Card>

      <Card title="Clase ampliada">
        {c.publicada ? <ClaseAmpliada contenido={c.publicada.contenido} />
          : <Notice>Las fotografías de esta clase están disponibles. La versión ampliada aún no ha sido publicada.</Notice>}
      </Card>

      <Card title="Dónde estudiar">
        <DondeEstudiar enlaces={c.enlaces} courseId={c.course_id} />
      </Card>
    </div>
  );
}
