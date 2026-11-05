/**
 * Cuentas → «Cuentas duplicadas»: fusionar dos cuentas de un mismo estudiante sin perder datos (migración 82).
 * Flujo: posibles duplicados o búsqueda → principal (se conserva) y secundaria (se fusiona y desactiva) → comparar →
 * simular → resolver conflictos → confirmar → ejecutar (+ bloqueo en Auth) → verificar → historial y reversión.
 * Esta pantalla no decide nada: el servidor valida permisos, bloqueos, conflictos y la huella del plan.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import {
  fusionAuthResultado, fusionBuscar, fusionCandidatos, fusionDetalle, fusionEjecutar, fusionHistorial, fusionRegistrarFallo, fusionRevertir, fusionVistaPrevia,
  type CuentaEncontrada, type Decision, type Operacion, type ResumenCuenta, type VistaPrevia,
} from '@/api/fusion';
import { suspenderCuenta } from '@/api/docente';
import { duracion, impactoNotas, NOMBRE_TABLA, sinDecidir, TEXTO_CATEGORIA, TEXTO_DECISION } from '@/lib/fusion';
import { fecha, useAsync } from '@/lib/util';
import { Badge, Card, Empty, ErrorBox, Modal, Notice, Spinner, Tabs } from '@/components/ui';

type Vista = 'fusionar' | 'historial';
interface Eleccion { id: string; etiqueta: string }

export function FusionCuentas() {
  const [vista, setVista] = useState<Vista>('fusionar');
  const [principal, setPrincipal] = useState<Eleccion | null>(null);
  const [secundaria, setSecundaria] = useState<Eleccion | null>(null);
  return (
    <div className="space-y-4">
      <Notice>
        Fusione dos cuentas del <strong>mismo estudiante</strong>. Nada se borra: lo de la cuenta secundaria pasa a la principal y lo que no pueda pasar (o no valga)
        se conserva en la secundaria, que queda <strong>fusionada y desactivada</strong>. Antes de ejecutar verá una simulación exacta. Solo el administrador.
      </Notice>
      <Tabs<Vista> value={vista} onChange={setVista} tabs={[{ id: 'fusionar', label: 'Fusionar' }, { id: 'historial', label: 'Historial de fusiones' }]} />
      {vista === 'fusionar' ? (
        <>
          <Candidatos alElegir={(a, b) => { setPrincipal(a); setSecundaria(b); }} />
          <div className="grid gap-3 md:grid-cols-2">
            <Selector titulo="Cuenta PRINCIPAL (se conserva)" tono="green" eleccion={principal} alElegir={setPrincipal} />
            <Selector titulo="Cuenta SECUNDARIA (se fusiona y se desactiva)" tono="red" eleccion={secundaria} alElegir={setSecundaria} />
          </div>
          {principal && secundaria && (
            <div className="flex justify-center">
              <button className="btn-secundario" onClick={() => { setPrincipal(secundaria); setSecundaria(principal); }}>⇄ Intercambiar principal y secundaria</button>
            </div>
          )}
          {principal && secundaria && principal.id !== secundaria.id && <Plan key={`${principal.id}-${secundaria.id}`} p={principal} s={secundaria} />}
        </>
      ) : <Historial />}
    </div>
  );
}

function Candidatos({ alElegir }: { alElegir: (a: Eleccion, b: Eleccion) => void }) {
  const [prueba, setPrueba] = useState(false);
  const c = useAsync(() => fusionCandidatos(prueba), [prueba]);
  return (
    <Card title="Posibles duplicados (orientativo: verifique la identidad antes de fusionar)">
      <label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={prueba} onChange={(e) => setPrueba(e.target.checked)} /> Incluir cuentas «prueba-…»</label>
      {c.loading && !c.data ? <Spinner /> : <ErrorBox error={c.error} onRetry={() => void c.reload()} />}
      {c.data && c.data.length === 0 && <Empty>No se encontraron posibles duplicados.</Empty>}
      <ul className="divide-y divide-gray-100 text-sm dark:divide-white/10">
        {(c.data ?? []).map((x) => (
          <li key={`${x.cuenta_a}-${x.cuenta_b}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              <Badge tone={x.confianza === 'alta' ? 'red' : x.confianza === 'media' ? 'amber' : 'gray'}>Posible duplicación · confianza {x.confianza}</Badge>{' '}
              <strong className="font-mono">{x.login_a}</strong> ({x.nombre_a}, {x.intentos_a} intentos{x.activa_a ? '' : ', suspendida'}) ·{' '}
              <strong className="font-mono">{x.login_b}</strong> ({x.nombre_b}, {x.intentos_b} intentos{x.activa_b ? '' : ', suspendida'})
              <span className="block text-xs text-gray-500">{x.razones.join(' · ')}</span>
            </span>
            <button className="btn-secundario" onClick={() => alElegir({ id: x.cuenta_a, etiqueta: `${x.login_a} · ${x.nombre_a}` }, { id: x.cuenta_b, etiqueta: `${x.login_b} · ${x.nombre_b}` })}>Comparar</button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Selector({ titulo, tono, eleccion, alElegir }: { titulo: string; tono: 'green' | 'red'; eleccion: Eleccion | null; alElegir: (e: Eleccion | null) => void }) {
  const [texto, setTexto] = useState('');
  const [res, setRes] = useState<CuentaEncontrada[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function buscar() {
    setError(null);
    try { setRes(await fusionBuscar(texto.trim())); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }
  return (
    <section className={`tarjeta border-2 ${tono === 'green' ? 'border-emerald-400' : 'border-red-400'}`}>
      <h3 className={`mb-2 font-semibold ${tono === 'green' ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300'}`}>{titulo}</h3>
      {eleccion ? (
        <div className="flex items-center justify-between gap-2 text-sm"><span className="font-medium">{eleccion.etiqueta}</span><button className="enlace" onClick={() => alElegir(null)}>Cambiar</button></div>
      ) : (
        <>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void buscar(); }}>
            <input className="campo" placeholder="Nombre, matrícula, ID, correo o sección" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label={titulo} />
            <button className="btn-primario">Buscar</button>
          </form>
          <ErrorBox error={error} />
          <ul className="mt-2 max-h-60 overflow-y-auto text-sm">
            {(res ?? []).map((c) => (
              <li key={c.id}>
                <button className="w-full rounded px-2 py-1 text-left hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-white/10" disabled={c.fusionada}
                  onClick={() => alElegir({ id: c.id, etiqueta: `${c.login_id ?? '—'} · ${c.nombre}` })}>
                  <span className="font-mono">{c.login_id}</span> · {c.nombre} <span className="text-xs text-gray-500">{c.secciones ?? 'sin sección'} · {c.intentos} intentos{c.activa ? '' : ' · suspendida'}{c.fusionada ? ' · FUSIONADA' : ''}</span>
                </button>
              </li>
            ))}
            {res && res.length === 0 && <li className="text-gray-500">Sin resultados.</li>}
          </ul>
        </>
      )}
    </section>
  );
}

function Plan({ p, s }: { p: Eleccion; s: Eleccion }) {
  const nav = useNavigate();
  const { signOut } = useAuth();
  const [dec, setDec] = useState<Record<string, Decision>>({});
  const [vp, setVp] = useState<VistaPrevia | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usarId, setUsarId] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [verifique, setVerifique] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [resultado, setResultado] = useState<{ op: string; total: number; auth: 'ok' | 'error'; authError?: string } | null>(null);

  async function simular(d = dec) {
    setCargando(true); setError(null);
    try { setVp(await fusionVistaPrevia(p.id, s.id, d)); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setCargando(false); }
  }
  async function ejecutar() {
    if (!vp) return;
    setCargando(true); setError(null); setConfirmar(false);
    try {
      const r = await fusionEjecutar(p.id, s.id, vp.huella, dec, usarId, motivo.trim());
      // etapa de Supabase Auth (fuera de la transacción): bloquear la cuenta secundaria; si falla, queda pendiente y reintentable
      let auth: 'ok' | 'error' = 'ok'; let authError: string | undefined;
      try { await suspenderCuenta(s.id, true); await fusionAuthResultado(r.op, true); }
      catch (e) { auth = 'error'; authError = e instanceof Error ? e.message : String(e); await fusionAuthResultado(r.op, false, authError).catch(() => undefined); }
      setResultado({ op: r.op, total: r.total, auth, authError });
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setError(m);
      void fusionRegistrarFallo(p.id, s.id, m);
    } finally { setCargando(false); }
  }

  if (resultado) {
    return (
      <Card title="Fusión ejecutada">
        <Notice tone="ok">Se trasladaron o archivaron {resultado.total} registros. La cuenta secundaria quedó fusionada y desactivada (sin sesiones abiertas).</Notice>
        {resultado.auth === 'error' && <Notice tone="warn">No se pudo bloquear la cuenta en Supabase Auth ({resultado.authError}). Ya no puede operar en el aula; reintente el bloqueo desde «Historial de fusiones».</Notice>}
        <Verificacion op={resultado.op} />
      </Card>
    );
  }
  const pend = vp ? sinDecidir(vp.conflictos, dec) : [];
  const impacto = vp ? impactoNotas(vp.notas_principal_antes, vp.simulacion?.notas_principal_despues, vp.actividades) : [];
  return (
    <Card title="Comparación y simulación">
      {!vp && <button className="btn-primario" disabled={cargando} onClick={() => void simular()}>{cargando ? 'Analizando…' : 'Comparar y simular la fusión'}</button>}
      <ErrorBox error={error} />
      {error && /sesión/i.test(error) && <button className="btn-secundario mt-2" onClick={() => void signOut().then(() => nav('/ingresar', { state: { from: '/docente/cuentas' } }))}>Volver a iniciar sesión</button>}
      {vp && (
        <div className="space-y-4">
          <Comparacion p={vp.principal} s={vp.secundaria} />
          {vp.bloqueos.length > 0 && <Notice tone="warn"><strong>Operación bloqueada:</strong><ul className="list-disc pl-5">{vp.bloqueos.map((b) => <li key={b}>{b}</li>)}</ul></Notice>}
          {vp.avisos.length > 0 && <Notice><ul className="list-disc pl-5">{vp.avisos.map((a) => <li key={a}>{a}</li>)}</ul></Notice>}
          <section>
            <h3 className="mb-1 font-semibold">Actividades</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-500"><th className="p-1">Actividad</th><th className="p-1">Dónde</th><th className="p-1">Principal</th><th className="p-1">Secundaria</th></tr></thead>
                <tbody>{vp.actividades.map((a) => (
                  <tr key={a.activity_id} className="border-t border-gray-100 dark:border-white/10">
                    <td className="p-1">{a.titulo} <span className="text-xs text-gray-500">{a.modo === 'exam' ? 'examen' : 'práctica'} · {a.seccion}</span>{a.en_curso && <Badge tone="amber">en curso</Badge>}</td>
                    <td className="p-1"><Badge tone={a.categoria === 'ambas' ? 'red' : a.categoria === 'solo_secundaria' ? 'blue' : 'gray'}>{TEXTO_CATEGORIA[a.categoria]}</Badge></td>
                    <td className="p-1">{a.principal.intentos ? `${a.principal.intentos} · mejor ${a.principal.mejor ?? '—'}/${a.principal.maximo ?? '—'}` : '—'}</td>
                    <td className="p-1">{a.secundaria.intentos ? `${a.secundaria.intentos} · mejor ${a.secundaria.mejor ?? '—'}/${a.secundaria.maximo ?? '—'}` : '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
          {vp.conflictos.length > 0 && (
            <section className="space-y-2">
              <h3 className="font-semibold text-red-700 dark:text-red-300">Conflictos académicos detectados ({vp.conflictos.length})</h3>
              <p className="text-xs text-gray-500">Nunca se suman notas ni se elige la mayor automáticamente. Lo que no valga se conserva íntegro en la cuenta fusionada.</p>
              {vp.conflictos.map((c) => (
                <fieldset key={c.clave} className="tarjeta !py-2">
                  <legend className="px-1 text-sm font-medium">CONFLICTO · {c.titulo}</legend>
                  <p className="text-xs text-gray-500">Principal: {Object.entries(c.principal).map(([k, v]) => `${k} ${v ?? '—'}`).join(', ')} · Secundaria: {Object.entries(c.secundaria).map(([k, v]) => `${k} ${v ?? '—'}`).join(', ')}</p>
                  <div className="mt-1 flex flex-wrap gap-3 text-sm">
                    {c.opciones.map((o) => (
                      <label key={o} className="flex items-center gap-1">
                        <input type="radio" name={c.clave} checked={dec[c.clave] === o} onChange={() => { const d = { ...dec, [c.clave]: o }; setDec(d); setVp({ ...vp, simulacion: null, ejecutable: false }); }} /> {TEXTO_DECISION[o]}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </section>
          )}
          <div className="flex flex-wrap gap-2">
            <button className="btn-secundario" disabled={cargando} onClick={() => void simular()}>{cargando ? 'Simulando…' : 'Volver a simular con estas decisiones'}</button>
          </div>
          {vp.error_simulacion && <ErrorBox error={`La simulación encontró un problema: ${vp.error_simulacion}`} />}
          {vp.simulacion && (
            <section>
              <h3 className="mb-1 font-semibold">Resultado de la simulación (sin modificar nada)</h3>
              <ul className="grid gap-1 text-sm sm:grid-cols-2">
                {Object.entries(vp.simulacion.trasladadas).map(([t, n]) => <li key={t}>✔ {NOMBRE_TABLA[t] ?? t}: <strong>{n}</strong></li>)}
              </ul>
              <p className="mt-1 text-xs text-gray-500">Lo demás permanece sin cambios. Total: {vp.simulacion.total} registros trasladados o archivados.</p>
              {impacto.length > 0 && (
                <div className="mt-2 text-sm">
                  <p className="font-medium">Impacto en las notas de la principal (mejor intento entregado):</p>
                  <ul className="list-disc pl-5">{impacto.map((x) => <li key={x.activity_id}>{x.titulo}: {x.antes ?? 'sin nota'} → <strong>{x.despues ?? 'sin nota'}</strong></li>)}</ul>
                </div>
              )}
            </section>
          )}
          {vp.ejecutable && pend.length === 0 && (
            <section className="tarjeta space-y-2 border-2 border-amber-400">
              <h3 className="font-semibold">Confirmar la fusión</h3>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={usarId} onChange={(e) => setUsarId(e.target.checked)} />
                <span>La principal entrará con la matrícula de la secundaria (<strong className="font-mono">{vp.secundaria.login_id}</strong>) en lugar de <span className="font-mono">{vp.principal.login_id}</span></span>
              </label>
              <input className="campo" placeholder="Motivo (obligatorio): p. ej. «Activó dos veces su cuenta con un dígito de más»" maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={verifique} onChange={(e) => setVerifique(e.target.checked)} /> Verifiqué que las dos cuentas pertenecen a la misma persona.</label>
              <button className="btn-peligro" disabled={cargando || !verifique || motivo.trim().length < 5} onClick={() => setConfirmar(true)}>Ejecutar fusión…</button>
            </section>
          )}
        </div>
      )}
      <Modal open={confirmar} onClose={() => setConfirmar(false)} title="¿Ejecutar la fusión?">
        {vp && (
          <div className="space-y-2 text-sm">
            <p>Se CONSERVA: <strong>{vp.principal.login_id} · {vp.principal.nombre}</strong></p>
            <p>Se FUSIONA Y DESACTIVA: <strong>{vp.secundaria.login_id} · {vp.secundaria.nombre}</strong></p>
            <p>Registros afectados: <strong>{vp.simulacion?.total ?? 0}</strong> · Conflictos resueltos: {vp.conflictos.filter((c) => dec[c.clave] && dec[c.clave] !== 'pendiente').length} · Pendientes: {vp.conflictos.filter((c) => dec[c.clave] === 'pendiente').length}</p>
            <p className="text-xs text-gray-500">Se puede revertir mientras nada de lo trasladado cambie. Si el estudiante sigue trabajando, revertir exigirá una evaluación.</p>
            <div className="flex justify-end gap-2"><button className="btn-secundario" onClick={() => setConfirmar(false)}>Cancelar</button><button className="btn-peligro" onClick={() => void ejecutar()}>Sí, fusionar</button></div>
          </div>
        )}
      </Modal>
    </Card>
  );
}

function Comparacion({ p, s }: { p: ResumenCuenta; s: ResumenCuenta }) {
  const filas: [string, (c: ResumenCuenta) => string][] = [
    ['ID de acceso', (c) => c.login_id ?? '—'], ['Nombre', (c) => c.nombre], ['Matrícula registrada', (c) => c.matricula ?? '—'],
    ['Estado', (c) => (c.activa ? 'activa' : 'suspendida')], ['Secciones', (c) => c.secciones.map((x) => x.nombre).join(', ') || '—'],
    ['Prácticas', (c) => String(c.practicas)], ['Prácticas completadas', (c) => String(c.practicas_completadas)], ['Exámenes', (c) => String(c.examenes)],
    ['Calificaciones', (c) => `${c.promedio_mejores ?? '—'} % de media · ${c.notas_manuales} notas del registro`],
    ['Prácticas extraordinarias', (c) => String(c.practicas_extraordinarias)], ['Entregas en PDF', (c) => String(c.entregas_pdf)],
    ['Tiempo acumulado', (c) => duracion(c.tiempo_s)], ['Último acceso', (c) => (c.ultimo_acceso ? fecha(c.ultimo_acceso) : '—')], ['Creada', (c) => fecha(c.creada)],
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left"><th className="p-1">Información</th><th className="p-1 text-emerald-800 dark:text-emerald-300">Principal (se conserva)</th><th className="p-1 text-red-800 dark:text-red-300">Secundaria (se fusiona)</th></tr></thead>
        <tbody>{filas.map(([t, f]) => <tr key={t} className="border-t border-gray-100 dark:border-white/10"><td className="p-1 text-gray-500">{t}</td><td className="p-1">{f(p)}</td><td className="p-1">{f(s)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function Verificacion({ op }: { op: string }) {
  const d = useAsync(() => fusionDetalle(op), [op]);
  if (d.loading && !d.data) return <Spinner />;
  if (d.error) return <ErrorBox error={d.error} />;
  return (
    <div className="mt-2 text-sm">
      <p className="font-medium">Verificación: registros por tabla</p>
      <ul className="grid gap-1 sm:grid-cols-2">{Object.entries(d.data!.por_tabla).map(([t, n]) => <li key={t}>{NOMBRE_TABLA[t] ?? t}: {n}</li>)}</ul>
      <p className="mt-1 text-xs text-gray-500">El servidor comprobó, antes de confirmar, que ninguna respuesta ni evidencia quedó con otro dueño y que las notas de la principal son las previstas.</p>
    </div>
  );
}

function Historial() {
  const h = useAsync(() => fusionHistorial(), []);
  const [detalle, setDetalle] = useState<Operacion | null>(null);
  return (
    <Card title="Historial de fusiones">
      {h.loading && !h.data ? <Spinner /> : <ErrorBox error={h.error} onRetry={() => void h.reload()} />}
      {h.data && h.data.length === 0 && <Empty>Todavía no hay fusiones.</Empty>}
      <ul className="divide-y divide-gray-100 text-sm dark:divide-white/10">
        {(h.data ?? []).map((o) => (
          <li key={o.op} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              <strong className="font-mono">{o.login_secundaria}</strong> → <strong className="font-mono">{o.login_principal}</strong> · {o.nombre_principal}
              <span className="block text-xs text-gray-500">{fecha(o.created_at)} · {o.filas} registros · {o.motivo}{o.autorizado_por ? ` · ${o.autorizado_por}` : ''}</span>
            </span>
            <span className="flex items-center gap-2">
              <Badge tone={o.estado === 'completada' ? 'green' : o.estado === 'revertida' ? 'gray' : 'amber'}>
                {o.estado === 'auth_pendiente' ? 'Falta el bloqueo en Auth' : o.estado === 'completada' ? 'Fusionada' : o.estado === 'revertida' ? 'Revertida' : o.estado}
              </Badge>
              <button className="btn-texto" onClick={() => setDetalle(o)}>Detalles</button>
            </span>
          </li>
        ))}
      </ul>
      {detalle && <DetalleOperacion o={detalle} alCerrar={() => { setDetalle(null); void h.reload(); }} />}
    </Card>
  );
}

function DetalleOperacion({ o, alCerrar }: { o: Operacion; alCerrar: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function reintentarAuth() {
    setBusy(true); setError(null);
    try { await suspenderCuenta(o.secundaria, true); await fusionAuthResultado(o.op, true); setMsg('Cuenta bloqueada en Auth: fusión completada.'); }
    catch (e) { const m = e instanceof Error ? e.message : String(e); setError(m); await fusionAuthResultado(o.op, false, m).catch(() => undefined); }
    finally { setBusy(false); }
  }
  async function revertir() {
    setBusy(true); setError(null); setMsg(null);
    try {
      const r = await fusionRevertir(o.op, motivo.trim());
      if (!r.ok) { setError(`${r.motivo} (${r.cambios?.length ?? 0} registro(s) cambiaron: ${[...new Set((r.cambios ?? []).map((c) => NOMBRE_TABLA[c.tabla] ?? c.tabla))].join(', ')})`); return; }
      await suspenderCuenta(o.secundaria, false).catch(() => undefined);   // desbloqueo en Auth
      setMsg(`Fusión revertida: ${r.filas} registros devueltos; la cuenta secundaria vuelve a estar activa.`);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  return (
    <Modal open onClose={alCerrar} title="Detalle de la fusión">
      <div className="space-y-2 text-sm">
        <p><strong className="font-mono">{o.login_secundaria}</strong> → <strong className="font-mono">{o.login_principal}</strong> ({o.nombre_principal}) · {fecha(o.created_at)}</p>
        <p>Motivo: {o.motivo}</p>
        <Verificacion op={o.op} />
        {o.auth_error && <Notice tone="warn">Último error del bloqueo en Auth: {o.auth_error}</Notice>}
        {msg && <Notice tone="ok">{msg}</Notice>}
        <ErrorBox error={error} />
        {o.estado === 'auth_pendiente' && <button className="btn-secundario" disabled={busy} onClick={() => void reintentarAuth()}>Reintentar el bloqueo en Auth</button>}
        {(o.estado === 'completada' || o.estado === 'auth_pendiente') && (
          <div className="tarjeta space-y-2">
            <p className="font-medium">Revertir</p>
            <p className="text-xs text-gray-500">Devuelve lo trasladado si nada cambió desde la fusión; si el estudiante siguió trabajando sobre esos datos, se bloquea y muestra qué cambió.</p>
            <input className="campo" placeholder="Motivo de la reversión" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} />
            <button className="btn-peligro" disabled={busy || motivo.trim().length < 5} onClick={() => void revertir()}>{busy ? 'Revirtiendo…' : 'Revertir la fusión'}</button>
          </div>
        )}
      </div>
    </Modal>
  );
}
