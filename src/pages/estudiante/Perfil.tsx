import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { myClasses, updateMyProfile } from '@/api/estudiante';
import { useAction, useAsync } from '@/lib/util';
import { Card, ErrorBox, Field, Notice, PageTitle } from '@/components/ui';
import { AVISO_PRIVACIDAD } from '@/lib/tiempo';

export default function Perfil() {
  const { profile, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [code, setCode] = useState(profile?.student_code ?? '');
  const [ok, setOk] = useState(false);
  const action = useAction();
  const classes = useAsync(myClasses, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setOk(false);
    const r = await action.run(async () => {
      await updateMyProfile(profile.id, { full_name: name.trim(), student_code: code.trim() || null });
      await refreshProfile();
      return true;
    });
    if (r) setOk(true);
  }
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageTitle title="Mi perfil" />
      <Card>
        <form onSubmit={submit}>
          <Field label="Nombre completo">{(id) => <input id={id} className="campo" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />}</Field>
          <Field label="Matrícula">{(id) => <input id={id} className="campo" value={code} onChange={(e) => setCode(e.target.value)} maxLength={40} />}</Field>
          <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
            ID de acceso: <strong>{profile?.login_id ?? '—'}</strong> · Rol: {profile?.role === 'admin' ? 'administrador' : profile?.role === 'teacher' ? 'profesor' : 'estudiante'} ·{' '}
            <Link className="enlace" to="/cambiar-clave">Cambiar contraseña</Link>
          </p>
          <ErrorBox error={action.error} />
          {ok && <Notice tone="ok">Datos guardados.</Notice>}
          <button className="btn-primario" disabled={action.busy}>Guardar</button>
        </form>
        {profile?.role === 'student' && <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">{AVISO_PRIVACIDAD}</p>}
      </Card>
      <Card title="Mis clases">
        {classes.data?.length ? (
          <ul className="space-y-1 text-sm">
            {classes.data.map((c) => (
              <li key={c.class_id}>
                <strong>{c.name}</strong> {c.term && `(${c.term})`} · {c.course_title}
                {c.group_name && ` · grupo ${c.group_name}`}
                {c.teachers.length > 0 && <span className="text-gray-500"> · Prof. {c.teachers.join(', ')}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Sin clases.</p>
        )}
      </Card>
    </div>
  );
}
