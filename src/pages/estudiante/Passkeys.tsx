/**
 * «Activar acceso sin contraseña» y «Administrar credenciales registradas» (passkeys de Supabase Auth).
 * El registro exige una sesión válida (Supabase Auth lo comprueba). La clave privada nunca sale del dispositivo
 * del usuario: ni el aula, ni el profesor, ni los monitores la ven. Detrás del interruptor acceso_config.passkeys.
 */
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { anotarEventoPropio, panelAcceso } from '@/api/acceso';
import { soportaPasskeys } from '@/lib/acceso';
import { errorMessage, supabase } from '@/lib/supabase';
import { useAsync } from '@/lib/util';
import { Empty, ErrorBox, Notice, PageTitle, Spinner } from '@/components/ui';

interface Credencial { id: string; friendly_name?: string; created_at: string; last_used_at?: string }

const fecha = (s?: string) => (s ? new Date(s).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export default function Passkeys() {
  const loc = useLocation() as { state?: { tras_recuperacion?: boolean } };
  const panel = useAsync(() => panelAcceso(), []);
  const lista = useAsync(async () => {
    const { data, error } = await supabase.auth.passkey.list();
    if (error) throw error;
    return (data ?? []) as Credencial[];
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const soporta = soportaPasskeys(typeof window === 'undefined' ? undefined : (window as unknown as { PublicKeyCredential?: unknown; isSecureContext?: boolean }));

  async function registrar() {
    setBusy(true);
    setError(null);
    setAviso(null);
    try {
      const { error: e } = await supabase.auth.registerPasskey();
      if (e) throw e;
      void anotarEventoPropio('passkey_registrada');
      setAviso('Listo: la próxima vez podrá entrar con «Entrar con passkey» (huella, rostro o PIN de este dispositivo).');
      await lista.reload();
    } catch (err) {
      const m = errorMessage(err);
      setError(/NotAllowed|abort|cancel/i.test(m) ? 'Se canceló el registro en el dispositivo.' : m);
    } finally {
      setBusy(false);
    }
  }

  async function eliminar(c: Credencial) {
    if (!confirm(`¿Eliminar la credencial «${c.friendly_name || 'sin nombre'}»? Ese dispositivo ya no podrá entrar sin contraseña.`)) return;
    setBusy(true);
    setError(null);
    try {
      const { error: e } = await supabase.auth.passkey.delete({ passkeyId: c.id });
      if (e) throw e;
      void anotarEventoPropio('passkey_eliminada');
      await lista.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (panel.loading) return <Spinner />;
  const activo = !!panel.data?.passkeys;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageTitle title="Acceso sin contraseña" subtitle="Passkeys: entre con la huella, el rostro o el PIN de su dispositivo." back={{ to: '/cuenta', label: 'Mi cuenta' }} />
      {loc.state?.tras_recuperacion && <Notice tone="ok">Contraseña nueva guardada. Para no depender de ella, active el acceso sin contraseña en este dispositivo.</Notice>}
      <ErrorBox error={panel.error} onRetry={() => void panel.reload()} />
      {!activo ? (
        <Notice>El acceso sin contraseña todavía no está activado en el aula.</Notice>
      ) : (
        <>
          <section className="tarjeta space-y-3">
            <h2 className="font-semibold">Activar acceso sin contraseña</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Se crea una credencial en este dispositivo. La parte secreta se queda en su teléfono o computadora: nadie más la ve, ni el profesor ni los monitores.
              Puede registrar varios dispositivos.
            </p>
            {!soporta && <Notice tone="warn">Este navegador no admite passkeys. Use un navegador actualizado (Chrome, Safari, Edge o Firefox).</Notice>}
            <button className="btn-primario" disabled={busy || !soporta} onClick={() => void registrar()}>{busy ? 'Esperando al dispositivo…' : 'Activar en este dispositivo'}</button>
            {aviso && <Notice tone="ok">{aviso}</Notice>}
            <ErrorBox error={error} />
          </section>
          <section className="tarjeta">
            <h2 className="mb-2 font-semibold">Administrar credenciales registradas</h2>
            {lista.loading ? <Spinner /> : lista.error ? <ErrorBox error={errorMessage(lista.error)} onRetry={() => void lista.reload()} /> : (lista.data ?? []).length === 0 ? (
              <Empty>No hay credenciales registradas.</Empty>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-white/10">
                {(lista.data ?? []).map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      <span className="block font-medium">{c.friendly_name || 'Passkey'}</span>
                      <span className="block text-xs text-gray-500">Registrada: {fecha(c.created_at)} · Último uso: {fecha(c.last_used_at)}</span>
                    </span>
                    <button className="btn-secundario text-red-700 dark:text-red-300" disabled={busy} onClick={() => void eliminar(c)}>Eliminar</button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-gray-500">Si pierde un dispositivo, elimine aquí su credencial. Sus sesiones abiertas se cierran en <Link className="enlace" to="/perfil">Mi perfil</Link>.</p>
          </section>
          <Notice>¿Olvidó la contraseña y no tiene passkey? En la pantalla de ingreso use «Recuperar acceso»: el profesor o un monitor de su sección verificará su identidad en persona.</Notice>
        </>
      )}
    </div>
  );
}
