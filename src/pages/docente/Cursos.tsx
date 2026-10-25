import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createCourse, listCourses } from '@/api/docente';
import { useAction, useAsync } from '@/lib/util';
import { Card, Empty, ErrorBox, Field, PageTitle, Spinner } from '@/components/ui';

export default function Cursos() {
  const list = useAsync(listCourses, []);
  const nav = useNavigate();
  const [f, setF] = useState({ title: '', code: '', description: '' });
  const action = useAction();
  async function crear(e: FormEvent) {
    e.preventDefault();
    const c = await action.run(() => createCourse({ title: f.title.trim(), code: f.code.trim() || null, description: f.description.trim() }));
    if (c) nav(`/docente/cursos/${c.id}`);
  }
  if (list.loading) return <Spinner />;
  return (
    <div className="space-y-5">
      <PageTitle title="Contenido" subtitle="Cursos, bloques (unidades) y lecciones. Varias clases pueden usar el mismo curso." back={{ to: '/docente', label: 'Panel docente' }} />
      <ErrorBox error={list.error} />
      {list.data?.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.data.map((c) => (
            <li key={c.id}>
              <Link to={`/docente/cursos/${c.id}`} className="tarjeta block hover:border-primario-400">
                <p className="font-semibold">{c.title}</p>
                <p className="text-sm text-gray-500">{c.code} {c.archived && <span className="ml-1 rounded bg-acento-100 px-1 text-xs text-acento-700">Archivada</span>}</p>
                <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">{c.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No hay cursos todavía.</Empty>
      )}
      <Card title="Crear un curso vacío">
        <form onSubmit={crear} className="max-w-xl">
          <Field label="Título">{(id) => <input id={id} className="campo" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required />}</Field>
          <Field label="Código (opcional)">{(id) => <input id={id} className="campo" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />}</Field>
          <Field label="Descripción">{(id) => <textarea id={id} className="campo" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />}</Field>
          <ErrorBox error={action.error} />
          <button className="btn-primario" disabled={action.busy}>Crear curso</button>
        </form>
      </Card>
    </div>
  );
}
