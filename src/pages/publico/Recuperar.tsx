/**
 * «Solicitar acceso sin contraseña» (estudiantes que olvidaron su contraseña), con verificación PRESENCIAL.
 * El dispositivo guarda un secreto aleatorio (solo en esta pestaña) y muestra un código. El profesor o un monitor
 * delegado comprueba la identidad en persona y escribe ese código. Al aprobarse, este dispositivo canjea la
 * aprobación (un solo uso) y Supabase Auth crea la sesión con un token de un solo uso (auth.verifyOtp).
 * Después se elige una contraseña nueva (obligatorio) y se ofrece activar una passkey.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { completarAcceso, configPublica, estadoSolicitud, solicitarAcceso } from '@/api/acceso';
import {
  borrarPendiente, esFinal, formatoCodigo, guardarPendiente, leerPendiente, mensajeEstado, nuevoSecreto, pasoRecuperacion, restante, type EstadoSolicitud, type Pendiente,
} from '@/lib/acceso';
import { contextoAcceso } from '@/lib/instalacion';
import { errorMessage, supabase } from '@/lib/supabase';
import { useAsync } from '@/lib/util';
import { ErrorBox, Field, Notice, Spinner } from '@/components/ui';

const CONSULTA_MS = 4000;

function almacen(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export default function Recuperar() {
  const { session } = useAuth();
  const cfg = useAsync(() => configPublica(), []);
  const [pendiente, setPendiente] = useState<Pendiente | null>(() => {
    const s = almacen();
    return s ? leerPendiente(s, Date.now()) : null;
  });
  if (session && !pendiente) return <Navigate to="/" replace />;
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-center font-serif text-2xl font-semibold text-primario-900 dark:text-white">Acceso sin contraseña</h1>
      <div className="tarjeta">
        {cfg.loading ? <Spinner /> : !cfg.data?.recuperacion ? (
          <>
            <p className="text-sm">Este servicio no está disponible ahora. Si olvidó su contraseña, pida al profesor que la restablezca.</p>
            <ErrorBox error={cfg.error ? 'No se pudo consultar el servicio.' : null} onRetry={() => void cfg.reload()} />
            <Link to="/ingresar" className="btn-texto mt-3 w-full">Volver a ingresar</Link>
          </>
        ) : pendiente ? (
          <Espera p={pendiente} alTerminar={() => { const s = almacen(); if (s) borrarPendiente(s); setPendiente(null); }} />
        ) : (
          <Solicitud monitores={cfg.data.monitores} minutos={cfg.data.minutos_solicitud} alCrear={(p) => { const s = almacen(); if (s) guardarPendiente(s, p); setPendiente(p); }} />
        )}
      </div>
    </div>
  );
}

function Solicitud({ monitores, minutos, alCrear }: { monitores: boolean; minutos: number; alCrear: (p: Pendiente) => void }) {
  const [id, setId] = useState('');
  const [destinatario, setDestinatario] = useState<'profesor' | 'monitor'>('profesor');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const secreto = nuevoSecreto();
      const r = await solicitarAcceso(id.trim(), destinatario, secreto, contextoAcceso().install_id);
      alCrear({ solicitud: r.solicitud, secreto, codigo: r.codigo, expira: r.expira, destinatario });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={enviar}>
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
        Si olvidó su contraseña, pida acceso desde <strong>este dispositivo</strong> y acérquese en persona a quien elija, con su carné o cédula.
        Le mostrará un código que esa persona escribirá tras comprobar su identidad. La solicitud vence en {minutos} minutos.
      </p>
      <Field label="Su ID de usuario" hint="El mismo con el que entra (por ejemplo, su matrícula).">
        {(fid) => <input id={fid} className="campo" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={40} value={id} onChange={(e) => setId(e.target.value)} />}
      </Field>
      <fieldset className="mb-4">
        <legend className="mb-1 text-sm font-medium">¿Quién verificará su identidad?</legend>
        <label className="flex items-center gap-2 py-1 text-sm"><input type="radio" name="dest" checked={destinatario === 'profesor'} onChange={() => setDestinatario('profesor')} /> Profesor</label>
        {monitores && <label className="flex items-center gap-2 py-1 text-sm"><input type="radio" name="dest" checked={destinatario === 'monitor'} onChange={() => setDestinatario('monitor')} /> Monitor de mi sección</label>}
      </fieldset>
      <ErrorBox error={error} />
      <button className="btn-primario w-full" disabled={busy}>{busy ? 'Enviando…' : 'Solicitar acceso sin contraseña'}</button>
      <p className="mt-3 text-xs text-gray-500">
        Por seguridad, la respuesta es la misma aunque el ID no exista o su sección no use este servicio: si nadie ve su solicitud, hable con el profesor.
        Nadie le pedirá su contraseña.
      </p>
      <Link to="/ingresar" className="btn-texto mt-2 w-full">Volver a ingresar</Link>
    </form>
  );
}

function Espera({ p, alTerminar }: { p: Pendiente; alTerminar: () => void }) {
  const nav = useNavigate();
  const [estado, setEstado] = useState<EstadoSolicitud>('pendiente');
  const [error, setError] = useState<string | null>(null);
  const [ahora, setAhora] = useState(Date.now());
  const canjeando = useRef(false);

  useEffect(() => {
    let vivo = true;
    const reloj = setInterval(() => setAhora(Date.now()), 1000);
    async function consultar() {
      if (!vivo || canjeando.current) return;
      canjeando.current = true;
      try {
        // la sesión la crea Supabase Auth al verificar el token de un solo uso
        const r = await pasoRecuperacion(p, {
          estado: estadoSolicitud,
          completar: completarAcceso,
          verificarOtp: (token_hash, tipo) => supabase.auth.verifyOtp({ token_hash, type: tipo }),
        });
        if (!vivo) return;
        setEstado(r.estado);
        if (r.sesion) {
          alTerminar();
          nav('/cambiar-clave', { replace: true, state: { tras_recuperacion: true } });
          return;
        }
        canjeando.current = false;
      } catch (err) {
        // un canje fallido no se reintenta: la aprobación es de un solo uso
        if (vivo) {
          setError(errorMessage(err));
          setEstado('completada');
        }
      }
    }
    void consultar();
    const t = setInterval(() => void consultar(), CONSULTA_MS);
    return () => {
      vivo = false;
      clearInterval(t);
      clearInterval(reloj);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.solicitud]);

  const vencida = Date.parse(p.expira) <= ahora && estado === 'pendiente';
  const final = esFinal(estado) || vencida;
  return (
    <div className="text-center">
      {!final && (
        <>
          <p className="text-sm">Muestre este código en persona {p.destinatario === 'monitor' ? 'al monitor de su sección' : 'al profesor'}, junto con su carné o cédula:</p>
          <p className="my-4 select-all font-mono text-4xl font-bold tracking-[0.3em] text-primario-900 dark:text-white" aria-label={`Código ${p.codigo.split('').join(' ')}`}>{formatoCodigo(p.codigo)}</p>
          <p className="text-xs text-gray-500">Vence en {restante(p.expira, ahora)} · No cierre esta pestaña: el acceso solo se completa en este dispositivo.</p>
        </>
      )}
      <Notice tone={estado === 'aprobada' ? 'ok' : final ? 'warn' : 'info'}>{vencida ? mensajeEstado('vencida') : mensajeEstado(estado)}</Notice>
      <ErrorBox error={error} />
      {final && <button className="btn-primario mt-3 w-full" onClick={alTerminar}>Nueva solicitud</button>}
      {!final && <button className="btn-texto mt-3 w-full" onClick={alTerminar}>Cancelar en este dispositivo</button>}
    </div>
  );
}
