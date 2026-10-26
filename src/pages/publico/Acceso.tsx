import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { invocar, rpc, supabase, errorMessage } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthContext';
import { ErrorBox, Field, Notice } from '@/components/ui';
import { problemasContrasena } from '../../../supabase/functions/_shared/cuentas.ts';

function Marco({ title, children }: { title: string | null; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-md">
      {title && <h1 className="mb-4 text-center font-serif text-2xl font-semibold text-primario-900 dark:text-white">{title}</h1>}
      <div className="tarjeta">{children}</div>
    </div>
  );
}

interface SesionAcceso {
  access_token: string;
  refresh_token: string;
  must_change_password: boolean;
}

/** Inicio de sesión con ID y contraseña. La verificación la hace la Edge Function «acceder» en el servidor. */
export function Ingresar({ titulo = 'Ingresar al aula' }: { titulo?: string | null }) {
  const { session, profile } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (session && profile) return <Navigate to={profile.must_change_password ? '/cambiar-clave' : loc.state?.from ?? '/'} replace />;
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const s = await invocar<SesionAcceso>('acceder', { id: id.trim(), password });
      const { error: se } = await supabase.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
      if (se) throw se;
      nav(s.must_change_password ? '/cambiar-clave' : loc.state?.from ?? '/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setPassword('');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Marco title={titulo}>
      <form onSubmit={submit}>
        <Field label="ID de usuario" hint="El que le entregó su profesor (por ejemplo, su matrícula).">
          {(fid) => (
            <input id={fid} className="campo" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={40}
              value={id} onChange={(e) => setId(e.target.value)} />
          )}
        </Field>
        <Field label="Contraseña">
          {(fid) => <input id={fid} type="password" autoComplete="current-password" required className="campo" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <ErrorBox error={error} />
        <button className="btn-primario w-full" disabled={busy}>{busy ? 'Verificando…' : 'Ingresar'}</button>
      </form>
      <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        ¿Primera vez? <Link to="/activar" className="enlace">Active su cuenta con la clave de su sección</Link>.
        ¿Olvidó su contraseña? Pida al profesor que la restablezca.
      </p>
    </Marco>
  );
}

/** Cambio de contraseña: obligatorio con la contraseña provisional y disponible desde el perfil. */
export function CambiarClave() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const nav = useNavigate();
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!session) return <Navigate to="/ingresar" replace />;
  const obligatoria = !!profile?.must_change_password;
  const problemas = p1 ? problemasContrasena(p1, profile?.login_id ?? undefined) : [];
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (problemas.length) return setError(problemas.join(' '));
    if (p1 !== p2) return setError('Las contraseñas no coinciden.');
    setBusy(true);
    try {
      const { error: ue } = await supabase.auth.updateUser({ password: p1 });
      if (ue) throw ue;
      await rpc('confirm_password_changed');
      await refreshProfile();
      nav('/', { replace: true });
    } catch (err) {
      const m = errorMessage(err);
      setError(/same|different|igual/i.test(m) ? 'La nueva contraseña debe ser distinta de la provisional.' : m);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Marco title={obligatoria ? 'Elija su contraseña' : 'Cambiar contraseña'}>
      {obligatoria && (
        <Notice>
          Está usando una contraseña provisional. Para continuar, elija una contraseña personal: al menos 10 caracteres, con letras y números, sin su ID.
        </Notice>
      )}
      <form onSubmit={submit}>
        <Field label="Contraseña nueva">
          {(id) => <input id={id} type="password" autoComplete="new-password" required className="campo" value={p1} onChange={(e) => setP1(e.target.value)} maxLength={72} />}
        </Field>
        {problemas.length > 0 && <ul className="-mt-2 mb-3 list-disc pl-5 text-xs text-acento-700 dark:text-acento-300">{problemas.map((x) => <li key={x}>{x}</li>)}</ul>}
        <Field label="Repita la contraseña">
          {(id) => <input id={id} type="password" autoComplete="new-password" required className="campo" value={p2} onChange={(e) => setP2(e.target.value)} maxLength={72} />}
        </Field>
        <ErrorBox error={error} />
        <button className="btn-primario w-full" disabled={busy}>{busy ? 'Guardando…' : 'Guardar contraseña'}</button>
      </form>
      <div className="mt-3 flex justify-between text-sm">
        {obligatoria ? (
          <button className="enlace" onClick={() => void signOut()}>Salir</button>
        ) : (
          <Link className="enlace" to="/perfil">Volver</Link>
        )}
      </div>
    </Marco>
  );
}

/** Activación de la cuenta con la clave de la sección que entrega el profesor. */
export function Activar() {
  const { session } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ clave: '', id: '', nombre: '', p1: '', p2: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (session) return <Navigate to="/" replace />;
  const problemas = f.p1 ? problemasContrasena(f.p1, f.id) : [];
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (problemas.length) return setError(problemas.join(' '));
    if (f.p1 !== f.p2) return setError('Las contraseñas no coinciden.');
    setBusy(true);
    try {
      const r = await invocar<{ access_token?: string; refresh_token?: string; seccion: string }>('activar', {
        clave: f.clave.trim(),
        id: f.id.trim(),
        nombre: f.nombre.trim(),
        password: f.p1,
      });
      if (r.access_token && r.refresh_token) {
        await supabase.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token });
        nav('/', { replace: true });
      } else {
        nav('/ingresar', { replace: true });
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Marco title="Activar mi cuenta">
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
        Use la <strong>clave de su sección</strong> que le dio el profesor. Solo se hace una vez; después entrará con su ID y su contraseña.
      </p>
      <form onSubmit={submit}>
        <Field label="Clave de la sección">
          {(id) => <input id={id} className="campo text-center font-mono uppercase tracking-[0.25em]" required maxLength={12} autoComplete="off" autoCapitalize="characters" value={f.clave} onChange={set('clave')} />}
        </Field>
        <Field label="Su ID (matrícula)" hint="Con este ID entrará siempre al aula.">
          {(id) => <input id={id} className="campo font-mono" required maxLength={40} autoComplete="username" autoCapitalize="none" spellCheck={false} value={f.id} onChange={set('id')} />}
        </Field>
        <Field label="Nombre y apellidos">
          {(id) => <input id={id} className="campo" required maxLength={120} autoComplete="name" value={f.nombre} onChange={set('nombre')} />}
        </Field>
        <Field label="Elija su contraseña" hint="Al menos 10 caracteres, con letras y números, sin su ID.">
          {(id) => <input id={id} type="password" className="campo" required maxLength={72} autoComplete="new-password" value={f.p1} onChange={set('p1')} />}
        </Field>
        {problemas.length > 0 && <ul className="-mt-2 mb-3 list-disc pl-5 text-xs text-acento-700 dark:text-acento-300">{problemas.map((x) => <li key={x}>{x}</li>)}</ul>}
        <Field label="Repita la contraseña">
          {(id) => <input id={id} type="password" className="campo" required maxLength={72} autoComplete="new-password" value={f.p2} onChange={set('p2')} />}
        </Field>
        <ErrorBox error={error} />
        <button className="btn-primario w-full" disabled={busy}>{busy ? 'Activando…' : 'Activar mi cuenta'}</button>
      </form>
      <p className="mt-3 text-sm">¿Ya activó su cuenta? <Link to="/ingresar" className="enlace">Ingresar</Link></p>
    </Marco>
  );
}

/** Ya no hay registro público ni recuperación por correo. */
export function SinRegistro() {
  return (
    <Marco title="Cuentas del aula">
      <p className="text-sm">
        Para crear su cuenta necesita la <strong>clave de su sección</strong>, que le da el profesor en clase. Con ella activa su cuenta una
        sola vez y después entra con su ID y su contraseña. Si olvidó su contraseña, pídale al profesor que la restablezca.
      </p>
      <Link to="/activar" className="btn-primario mt-4 w-full">Activar mi cuenta</Link>
      <Link to="/ingresar" className="btn-texto mt-2 w-full">Ya tengo cuenta: ingresar</Link>
    </Marco>
  );
}
