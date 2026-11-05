/**
 * Quiz y exámenes protegidos (migración 85), lado del navegador.
 *  · useVigilanciaSalida: avisa al servidor cuando el estudiante sale del examen (pestaña u app ocultas, más de 5 s sin
 *    foco, cerrar o recargar, ir a otra parte del aula). El servidor bloquea la pantalla con el bloqueo con código de
 *    siempre (BloqueoPantalla, montado en Layout) y deja de aceptar respuestas. El aviso usa keepalive para llegar aunque
 *    se cierre la pestaña; si no llega, se reintenta al volver. Reabrir el examen lo detecta además el servidor.
 *  · BarreraCopiado: no deja pegar ni arrastrar texto en las respuestas (BarreraPegado de las PES) ni copiar, cortar o
 *    seleccionar el enunciado; cada intento se anota. Es una barrera de la página: no controla otros dispositivos.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal } from './ui';
import { useAuth } from '@/auth/AuthContext';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase';
import { examEventoCopia, examSalida, examSalirAutorizado } from '@/api/examen';
import { blurEsSalida, crearLimitador, ESPERA_SIN_FOCO, vigilanciaSuspendida, type MotivoSalida, type TipoCopia } from '@/lib/examen/integridad';
import { BarreraPegado } from './BarreraPegado';

const PENDIENTE = 'aula.examen.salida';
let navegacion: { attemptId: string; t: number } | null = null;

export function useVigilanciaSalida(attemptId: string, activo: boolean) {
  const { session } = useAuth();
  const token = useRef<string | undefined>(undefined);
  token.current = session?.access_token;
  const vigente = useRef(activo);
  vigente.current = activo;

  useEffect(() => {
    if (!activo) return;
    if (navegacion?.attemptId === attemptId) { window.clearTimeout(navegacion.t); navegacion = null; }
    const limitar = crearLimitador(3000);
    const avisar = (motivo: MotivoSalida) => {
      if (!vigente.current || vigilanciaSuspendida() || !limitar(motivo)) return;
      try { sessionStorage.setItem(PENDIENTE, JSON.stringify({ attemptId, motivo })); } catch { /* sin almacenamiento */ }
      if (!token.current) return;
      void fetch(`${SUPABASE_URL}/rest/v1/rpc/exam_salida`, {
        method: 'POST', keepalive: true,
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token.current}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_attempt: attemptId, p_motivo: motivo }),
      }).then((r) => { if (r.ok) try { sessionStorage.removeItem(PENDIENTE); } catch { /* */ } }).catch(() => undefined);
    };
    // un aviso que no llegó (sin red al salir): se reenvía al volver o al cargar la página
    const reenviar = () => {
      let p: { attemptId: string; motivo: MotivoSalida } | null = null;
      try { p = JSON.parse(sessionStorage.getItem(PENDIENTE) ?? 'null'); } catch { /* */ }
      if (p?.attemptId === attemptId) void examSalida(attemptId, p.motivo).then(() => { try { sessionStorage.removeItem(PENDIENTE); } catch { /* */ } }).catch(() => undefined);
    };
    reenviar();
    let sinFoco: number | undefined;
    const visibilidad = () => {
      if (document.visibilityState === 'hidden') avisar('oculta');
      else reenviar();
    };
    const cierre = () => avisar('cierre');
    const blur = () => {
      window.clearTimeout(sinFoco);
      sinFoco = window.setTimeout(() => { if (!document.hasFocus() && blurEsSalida(document.activeElement)) avisar('sin_foco'); }, ESPERA_SIN_FOCO);
    };
    const focus = () => window.clearTimeout(sinFoco);
    document.addEventListener('visibilitychange', visibilidad);
    window.addEventListener('pagehide', cierre);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', focus);
    return () => {
      document.removeEventListener('visibilitychange', visibilidad);
      window.removeEventListener('pagehide', cierre);
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', focus);
      window.clearTimeout(sinFoco);
      // el examen deja la pantalla sin haberse entregado (otra página del aula): también es salir. Se espera un
      // instante: si el mismo examen se vuelve a montar enseguida (React en desarrollo), no se sale de nada.
      if (vigente.current) navegacion = { attemptId, t: window.setTimeout(() => avisar('navegacion'), 400) };
    };
  }, [attemptId, activo]);
}

/**
 * Botón «Salir» de una evaluación protegida: no hay salida libre. Pide un código temporal del profesor (lo verifica el
 * servidor: caduca, vale para esta evaluación y, si así se generó, para un solo estudiante; 5 fallos → 10 min).
 * Con el código, la salida y la vuelta siguiente no bloquean; el tiempo oficial sigue corriendo.
 */
export function BotonSalirExamen({ attemptId, onAutorizada }: { attemptId: string; onAutorizada: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const probar = async () => {
    setOcupado(true); setMsg(null);
    try {
      const r = await examSalirAutorizado(attemptId, codigo.trim());
      if (r.ok) { setAbierto(false); onAutorizada(); return; }
      setMsg(r.espera_hasta ? `Demasiados intentos. Espere hasta las ${new Date(r.espera_hasta).toLocaleTimeString('es-DO')}.` : 'Código incorrecto o vencido.');
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
  };
  return (
    <>
      <button type="button" className="btn-secundario" onClick={() => { setAbierto(true); setCodigo(''); setMsg(null); }}>Salir</button>
      <Modal open={abierto} onClose={() => setAbierto(false)} title="Salir del examen">
        <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">
          Para salir antes de entregar necesita un <strong>código del profesor</strong>. Sus respuestas guardadas se conservan y el tiempo del examen sigue corriendo.
          Si sale sin código, la pantalla se bloqueará.
        </p>
        <form onSubmit={(e) => { e.preventDefault(); void probar(); }} className="flex flex-wrap gap-2">
          <input className="campo w-40 font-mono tracking-widest" inputMode="numeric" autoComplete="off" maxLength={32} value={codigo}
            onChange={(e) => setCodigo(e.target.value)} placeholder="Código" aria-label="Código del profesor" autoFocus />
          <button className="btn-primario" disabled={ocupado || codigo.trim().length < 4}>{ocupado ? 'Comprobando…' : 'Salir con el código'}</button>
          <button type="button" className="btn-texto" onClick={() => setAbierto(false)}>Seguir en el examen</button>
        </form>
        {msg && <p className="mt-2 text-sm text-red-700 dark:text-red-400" role="alert">{msg}</p>}
      </Modal>
    </>
  );
}

export function BarreraCopiado({ attemptId, activo, children }: { attemptId: string; activo: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const limitar = useRef(crearLimitador(2000));
  // un aviso por tipo cada 2 s: la tecla y el evento que provoca cuentan como UN intento (gana el primero: la tecla)
  const anotar = useRef<(tipo: TipoCopia, via: 'teclado' | 'menu' | 'evento', resultado?: 'bloqueado' | 'detectado') => void>(() => undefined);
  anotar.current = (tipo, via, resultado = 'bloqueado') => {
    if (limitar.current(tipo)) void examEventoCopia(attemptId, tipo, resultado, via).catch(() => undefined);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el || !activo) return;
    const editable = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|MATH-FIELD)$/.test(t.tagName));
    const copiar = (e: Event) => { e.preventDefault(); anotar.current('copia', 'evento'); };
    // menú contextual: fuera de los campos de respuesta no se abre (copiar el enunciado); dentro sí (corrector
    // ortográfico, accesibilidad) y pegar desde él lo impide el evento «paste»
    const menu = (e: Event) => { if (!editable(e.target)) { e.preventDefault(); anotar.current('copia', 'menu'); } };
    // Ctrl/Cmd + C, X, V: se anota como intento aunque no haya nada seleccionable; la acción la impiden copy/cut/paste
    const tecla = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'c' || k === 'x') anotar.current('copia', 'teclado');
      else if (k === 'v') anotar.current('pegado', 'teclado');
    };
    el.addEventListener('copy', copiar, true);
    el.addEventListener('cut', copiar, true);
    el.addEventListener('contextmenu', menu, true);
    document.addEventListener('keydown', tecla, true);
    return () => {
      el.removeEventListener('copy', copiar, true);
      el.removeEventListener('cut', copiar, true);
      el.removeEventListener('contextmenu', menu, true);
      document.removeEventListener('keydown', tecla, true);
    };
  }, [activo]);

  if (!activo) return <>{children}</>;
  return (
    <div ref={ref} className="sin-copiar">
      <BarreraPegado permitido={false} onBloqueo={(t) => anotar.current(t, 'evento')}>{children}</BarreraPegado>
    </div>
  );
}
