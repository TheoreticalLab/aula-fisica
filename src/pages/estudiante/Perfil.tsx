import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { myClasses, updateMyProfile } from '@/api/estudiante';
import { useAction, useAsync } from '@/lib/util';
import { Card, ErrorBox, Field, Notice, PageTitle } from '@/components/ui';
import { AVISO_PRIVACIDAD } from '@/lib/tiempo';
import { rpc, supabase } from '@/lib/supabase';
import { describirNavegador } from '@/lib/sesiones';import { Spinner } from '@/components/ui';

interface SesionAbierta {
  id: string;
  created_at: string;
  last_active: string | null;
  user_agent: string | null;
  ip: string | null;
  current: boolean;
}
const cuando = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export default function Perfil() {
  const { profile, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [code, setCode] = useState(profile?.student_code ?? '');
  const [ok, setOk] = useState(false);
  const action = useAction();
  const classes = useAsync(myClasses, []);
  const otras = useAction();
  const [otrasOk, setOtrasOk] = useState(false);
  async function cerrarOtras() {
    setOtrasOk(false);
    const r = await otras.run(async () => {
      // revoca las sesiones de los demás dispositivos (sus tokens de renovación); esta sesión se conserva
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) throw new Error(error.message);
      return true;
    });
    if (r) setOtrasOk(true);
    await sesiones.reload();
  }
  const sesiones = useAsync(() => rpc<SesionAbierta[]>('my_sessions'), []);
  const cerrar = useAction();
  async function cerrarUna(id: string) {
    await cerrar.run(() => rpc<boolean>('revoke_my_session', { p_session: id }));
    await sesiones.reload();
  }
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
      <Card title="Sesiones abiertas">
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
          Dispositivos donde su cuenta tiene la sesión abierta. Si no reconoce uno o lo dejó abierto, ciérrelo: ese
          dispositivo queda fuera en cuanto caduca su acceso temporal (como mucho, alrededor de una hora).
        </p>
        {sesiones.loading && !sesiones.data ? <Spinner /> : (
          <ul className="mb-3 divide-y divide-gray-100 dark:divide-white/10">
            {(sesiones.data ?? []).map((s) => {
              const d = describirNavegador(s.user_agent);
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <p className="font-medium">
                      {d.movil ? '📱' : '💻'} {d.navegador} en {d.sistema}
                      {s.current && <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800 dark:bg-green-900/40 dark:text-green-200">Esta sesión</span>}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      IP {s.ip ?? '—'} · iniciada {cuando(s.created_at)} · última actividad {cuando(s.last_active)}
                    </p>
                  </div>
                  {!s.current && (
                    <button className="btn-secundario !py-1 text-xs" disabled={cerrar.busy} onClick={() => void cerrarUna(s.id)}>Cerrar</button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <ErrorBox error={sesiones.error || cerrar.error || otras.error} />
        {otrasOk && <Notice tone="ok">Listo: se cerraron las sesiones en los demás dispositivos.</Notice>}
        {(sesiones.data ?? []).filter((s) => !s.current).length > 1 && (
          <button className="btn-secundario" disabled={otras.busy} onClick={() => void cerrarOtras()}>
            {otras.busy ? 'Cerrando…' : 'Cerrar todas las demás'}
          </button>
        )}
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
