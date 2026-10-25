import { useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '@/auth/AuthContext';
import {
  adminListUsers,
  adminSetRole,
  adminSuspiciousLogins,
  crearCuentas,
  restablecerCuenta,
  suspenderCuenta,
  teacherOverview,
  type CuentaNueva,
  type ResultadoCuenta,
} from '@/api/docente';
import type { Role, SeccionResumen } from '@/api/tipos';
import { downloadText, fecha, toCsv, useAction, useAsync } from '@/lib/util';
import { Badge, Card, Empty, ErrorBox, Field, Modal, Notice, PageTitle, Spinner, Tabs } from '@/components/ui';
import { leerCsvCuentas, normalizarId, idValido, type FilaCuenta } from '../../../supabase/functions/_shared/cuentas.ts';

type Tab = 'cuentas' | 'crear' | 'importar' | 'accesos';

/** Credenciales recién generadas: se muestran UNA vez; se pueden descargar o imprimir para entregarlas. */
function Credenciales({ resultados, onCerrar }: { resultados: ResultadoCuenta[]; onCerrar: () => void }) {
  const ok = resultados.filter((r) => r.password);
  const mal = resultados.filter((r) => r.error);
  const descargar = () =>
    downloadText(`credenciales-${new Date().toISOString().slice(0, 10)}.csv`, toCsv([['ID', 'Nombre', 'Contraseña provisional'], ...ok.map((r) => [r.login_id, r.full_name, r.password])]));
  return (
    <Modal open onClose={onCerrar} title="Credenciales generadas">
      <Notice tone="warn">
        Estas contraseñas provisionales <strong>solo se muestran ahora</strong>: el sistema no las guarda. Descárguelas o imprímalas y entréguelas
        a cada estudiante. Al entrar por primera vez deberá cambiarla.
      </Notice>
      {ok.length > 0 && (
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-sm" id="tabla-credenciales">
            <thead><tr className="text-left text-xs uppercase text-gray-500"><th className="py-1 pr-2">ID</th><th className="py-1 pr-2">Nombre</th><th className="py-1">Contraseña provisional</th></tr></thead>
            <tbody>
              {ok.map((r) => (
                <tr key={r.login_id} className="border-t border-gray-100 dark:border-white/10">
                  <td className="py-1 pr-2 font-mono">{r.login_id}</td>
                  <td className="py-1 pr-2">{r.full_name}</td>
                  <td className="py-1 font-mono">{r.password}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {mal.length > 0 && (
        <div className="mt-3 text-sm">
          <p className="font-semibold text-red-700 dark:text-red-300">No se crearon {mal.length}:</p>
          <ul className="list-disc pl-5">{mal.map((r) => <li key={r.login_id + r.error}>{r.login_id || '(vacío)'}: {r.error}</li>)}</ul>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {ok.length > 0 && <button className="btn-primario" onClick={descargar}>Descargar CSV</button>}
        {ok.length > 0 && <button className="btn-secundario" onClick={() => window.print()}>Imprimir</button>}
        <button className="btn-texto" onClick={onCerrar}>He guardado las credenciales</button>
      </div>
    </Modal>
  );
}

function SelectorSecciones({ secciones, valor, onChange }: { secciones: SeccionResumen[]; valor: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
      {secciones.filter((s) => !s.archived).map((s) => {
        const on = valor.includes(s.class_id);
        return (
          <button key={s.class_id} type="button" onClick={() => onChange(on ? valor.filter((x) => x !== s.class_id) : [...valor, s.class_id])}
            className={`rounded-full border px-2 py-0.5 text-xs ${on ? 'border-primario-600 bg-primario-600 text-white' : 'border-gray-300 dark:border-white/20'}`}>
            {s.course_title} · {s.name}
          </button>
        );
      })}
    </div>
  );
}

export default function Cuentas() {
  const { isAdmin, profile } = useAuth();
  const [tab, setTab] = useState<Tab>('cuentas');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const lista = useAsync(() => (isAdmin ? adminListUsers(query) : Promise.resolve([])), [query, isAdmin]);
  const secciones = useAsync(() => (isAdmin ? teacherOverview() : Promise.resolve([])), [isAdmin]);
  const sospechosos = useAsync(() => (isAdmin && tab === 'accesos' ? adminSuspiciousLogins() : Promise.resolve([])), [isAdmin, tab]);
  const action = useAction();
  const [resultados, setResultados] = useState<ResultadoCuenta[] | null>(null);
  const [nueva, setNueva] = useState<{ login_id: string; full_name: string; student_code: string; role: 'student' | 'teacher'; class_ids: string[] }>({
    login_id: '', full_name: '', student_code: '', role: 'student', class_ids: [],
  });
  const [csv, setCsv] = useState<{ filas: FilaCuenta[]; errores: { linea: number; mensaje: string }[] } | null>(null);

  // secciones del CSV → ids, por nombre o código de matrícula (sin distinguir mayúsculas)
  const mapaSecciones = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of secciones.data ?? []) {
      m.set(s.name.trim().toLowerCase(), s.class_id);
      m.set(s.join_code.toLowerCase(), s.class_id);
    }
    return m;
  }, [secciones.data]);
  const seccionesNoEncontradas = useMemo(
    () => [...new Set((csv?.filas ?? []).flatMap((f) => f.secciones ?? []).filter((s) => !mapaSecciones.has(s.trim().toLowerCase())))],
    [csv, mapaSecciones],
  );

  if (!isAdmin) return <ErrorBox error="Solo los administradores gestionan las cuentas." />;

  async function crearUna(e: FormEvent) {
    e.preventDefault();
    const c: CuentaNueva = { login_id: normalizarId(nueva.login_id), full_name: nueva.full_name.trim(), role: nueva.role, class_ids: nueva.class_ids };
    if (nueva.student_code.trim()) c.student_code = nueva.student_code.trim();
    const r = await action.run(() => crearCuentas([c]));
    if (r) {
      setResultados(r.resultados);
      if (r.resultados[0]?.password) setNueva({ login_id: '', full_name: '', student_code: '', role: 'student', class_ids: nueva.class_ids });
      await lista.reload();
    }
  }
  async function importar() {
    if (!csv?.filas.length) return;
    const cuentas: CuentaNueva[] = csv.filas.map((f) => ({
      login_id: f.login_id,
      full_name: f.full_name,
      student_code: f.student_code,
      role: f.role,
      class_ids: (f.secciones ?? []).map((s) => mapaSecciones.get(s.trim().toLowerCase())).filter((x): x is string => !!x),
    }));
    const r = await action.run(() => crearCuentas(cuentas));
    if (r) {
      setResultados(r.resultados);
      setCsv(null);
      await lista.reload();
    }
  }
  async function restablecer(id: string, nombre: string) {
    if (!window.confirm(`¿Generar una contraseña provisional nueva para ${nombre}? La actual dejará de funcionar.`)) return;
    const r = await action.run(() => restablecerCuenta(id));
    if (r) {
      setResultados([{ login_id: r.login_id, full_name: r.full_name, password: r.password }]);
      await lista.reload();
    }
  }
  async function suspender(id: string, nombre: string, suspender: boolean) {
    if (!window.confirm(suspender ? `¿Suspender la cuenta de ${nombre}? No podrá entrar ni ver nada; sus datos se conservan.` : `¿Reactivar la cuenta de ${nombre}?`)) return;
    if (await action.run(() => suspenderCuenta(id, suspender))) await lista.reload();
  }

  return (
    <div>
      <PageTitle title="Cuentas" subtitle="Solo el administrador crea cuentas. No hay registro público ni se piden correos personales." />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { id: 'cuentas', label: 'Cuentas' }, { id: 'crear', label: 'Crear una cuenta' }, { id: 'importar', label: 'Importar CSV' }, { id: 'accesos', label: 'Accesos sospechosos' },
      ]} />
      <ErrorBox error={action.error} />
      {resultados && <Credenciales resultados={resultados} onCerrar={() => setResultados(null)} />}

      {tab === 'cuentas' && (
        <>
          <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); }}>
            <input className="campo" placeholder="Buscar por ID, nombre o matrícula" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
            <button className="btn-primario">Buscar</button>
          </form>
          {lista.loading ? <Spinner /> : lista.data?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase text-gray-500"><th className="py-1 pr-2">ID</th><th className="py-1 pr-2">Nombre</th><th className="py-1 pr-2">Secciones</th><th className="py-1 pr-2">Estado</th><th className="py-1 pr-2">Rol</th><th className="py-1">Acciones</th></tr></thead>
                <tbody>
                  {lista.data.map((u) => (
                    <tr key={u.id} className="border-t border-gray-100 align-top dark:border-white/10">
                      <td className="py-2 pr-2 font-mono">{u.login_id ?? <span className="text-gray-400">sin ID</span>}</td>
                      <td className="py-2 pr-2">{u.full_name}{u.student_code && <span className="block text-xs text-gray-500">{u.student_code}</span>}</td>
                      <td className="py-2 pr-2 text-xs">{u.classes.join(', ') || '—'}</td>
                      <td className="py-2 pr-2 space-y-1">
                        {!u.active ? <Badge tone="red">Suspendida</Badge> : u.must_change_password ? <Badge tone="amber">Contraseña provisional</Badge> : <Badge tone="green">Activa</Badge>}
                        {u.failed_logins_24h > 0 && <span className="block text-xs text-red-700 dark:text-red-300">{u.failed_logins_24h} fallos (24 h)</span>}
                        <span className="block text-xs text-gray-500">Último acceso: {fecha(u.last_sign_in_at)}</span>
                      </td>
                      <td className="py-2 pr-2">
                        <select className="campo py-1 text-sm" value={u.role} disabled={u.id === profile?.id || action.busy} aria-label={`Rol de ${u.full_name}`}
                          onChange={async (e) => {
                            const role = e.target.value as Role;
                            if (!window.confirm(`¿Cambiar el rol de ${u.full_name}?${role === 'student' ? ' Perderá el acceso a sus cursos y clases como profesor.' : ''}`)) return;
                            await action.run(() => adminSetRole(u.id, role));
                            await lista.reload();
                          }}>
                          <option value="student">Estudiante</option>
                          <option value="teacher">Profesor</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </td>
                      <td className="py-2">
                        {u.id !== profile?.id && (
                          <div className="flex flex-wrap gap-1">
                            <button className="btn-secundario min-h-[32px] px-2 py-0 text-xs" disabled={action.busy} onClick={() => restablecer(u.id, u.full_name)}>Restablecer contraseña</button>
                            <button className={`${u.active ? 'btn-peligro' : 'btn-secundario'} min-h-[32px] px-2 py-0 text-xs`} disabled={action.busy}
                              onClick={() => suspender(u.id, u.full_name, u.active)}>{u.active ? 'Suspender' : 'Reactivar'}</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty>No hay cuentas que coincidan.</Empty>}
        </>
      )}

      {tab === 'crear' && (
        <Card>
          <form onSubmit={crearUna} className="max-w-xl">
            <Field label="ID de acceso" hint="Por ejemplo, la matrícula. De 3 a 40 caracteres: letras, dígitos, punto, guion o guion bajo.">
              {(id) => <input id={id} className="campo font-mono" required value={nueva.login_id} onChange={(e) => setNueva({ ...nueva, login_id: e.target.value })} maxLength={40} />}
            </Field>
            {nueva.login_id && !idValido(nueva.login_id) && <p className="-mt-2 mb-2 text-xs text-red-700">ID no válido.</p>}
            <Field label="Nombre completo">{(id) => <input id={id} className="campo" required value={nueva.full_name} onChange={(e) => setNueva({ ...nueva, full_name: e.target.value })} maxLength={120} />}</Field>
            <Field label="Matrícula (opcional)">{(id) => <input id={id} className="campo" value={nueva.student_code} onChange={(e) => setNueva({ ...nueva, student_code: e.target.value })} maxLength={40} />}</Field>
            <Field label="Rol">
              {(id) => (
                <select id={id} className="campo" value={nueva.role} onChange={(e) => setNueva({ ...nueva, role: e.target.value as 'student' | 'teacher' })}>
                  <option value="student">Estudiante</option>
                  <option value="teacher">Profesor</option>
                </select>
              )}
            </Field>
            {nueva.role === 'student' && (
              <div className="mb-3">
                <p className="etiqueta">Matricular en (opcional)</p>
                <SelectorSecciones secciones={secciones.data ?? []} valor={nueva.class_ids} onChange={(v) => setNueva({ ...nueva, class_ids: v })} />
              </div>
            )}
            <button className="btn-primario" disabled={action.busy || !idValido(nueva.login_id) || !nueva.full_name.trim()}>Crear cuenta</button>
          </form>
        </Card>
      )}

      {tab === 'importar' && (
        <Card>
          <p className="mb-2 text-sm">
            Archivo CSV (separado por «;» o «,», como lo guarda Excel) con encabezado. Columnas: <code>id</code>, <code>nombre</code> y, opcionalmente,{' '}
            <code>matricula</code>, <code>rol</code> (estudiante/profesor) y <code>secciones</code> (nombres o códigos de sección separados por «|»).
          </p>
          <button className="btn-texto mb-2 text-sm" onClick={() => downloadText('plantilla-cuentas.csv', toCsv([['id', 'nombre', 'matricula', 'rol', 'secciones'], ['100-12345', 'Ana López Pérez', '100-12345', 'estudiante', (secciones.data ?? [])[0]?.name ?? 'Nombre de la sección']]))}>
            Descargar plantilla
          </button>
          <input type="file" accept=".csv,text/csv" className="block text-sm" aria-label="Archivo CSV"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setCsv(leerCsvCuentas(await f.text()));
            }} />
          {csv && (
            <div className="mt-4">
              {csv.errores.length > 0 && (
                <Notice tone="warn">
                  <p className="font-semibold">Líneas con problemas (no se importarán):</p>
                  <ul className="list-disc pl-5">{csv.errores.map((x, i) => <li key={i}>Línea {x.linea}: {x.mensaje}</li>)}</ul>
                </Notice>
              )}
              {seccionesNoEncontradas.length > 0 && (
                <Notice tone="warn">Secciones que no existen (se ignorarán): {seccionesNoEncontradas.join(', ')}</Notice>
              )}
              <p className="mb-2 text-sm">{csv.filas.length} cuentas listas para crear.</p>
              <div className="max-h-72 overflow-auto rounded border border-gray-200 dark:border-white/10">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-100 dark:bg-primario-900"><tr className="text-left"><th className="px-2 py-1">ID</th><th className="px-2 py-1">Nombre</th><th className="px-2 py-1">Rol</th><th className="px-2 py-1">Secciones</th></tr></thead>
                  <tbody>{csv.filas.map((f) => (
                    <tr key={f.login_id} className="border-t border-gray-100 dark:border-white/10">
                      <td className="px-2 py-1 font-mono">{f.login_id}</td><td className="px-2 py-1">{f.full_name}</td>
                      <td className="px-2 py-1">{f.role === 'teacher' ? 'Profesor' : 'Estudiante'}</td><td className="px-2 py-1 text-xs">{f.secciones?.join(', ')}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <button className="btn-primario mt-3" disabled={action.busy || !csv.filas.length || csv.filas.length > 300} onClick={importar}>
                {action.busy ? 'Creando cuentas…' : `Crear ${csv.filas.length} cuentas`}
              </button>
            </div>
          )}
        </Card>
      )}

      {tab === 'accesos' && (
        <Card title="IDs con 3 o más intentos fallidos en las últimas 72 horas">
          <p className="mb-2 text-xs text-gray-500">
            Tras 5 fallos en 15 minutos, el ID queda bloqueado 15 minutos (también los IDs que no existen, para no revelar cuáles son válidos).
            Las IP se guardan solo como huella anónima.
          </p>
          {sospechosos.loading ? <Spinner /> : sospechosos.data?.length ? (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-gray-500"><th className="py-1 pr-2">ID intentado</th><th className="py-1 pr-2">Fallos</th><th className="py-1 pr-2">Orígenes</th><th className="py-1 pr-2">Bloqueos</th><th className="py-1">Último</th></tr></thead>
              <tbody>{sospechosos.data.map((s) => (
                <tr key={s.login_id} className="border-t border-gray-100 dark:border-white/10">
                  <td className="py-1 pr-2 font-mono">{s.login_id} {!s.existe && <Badge>no existe</Badge>}</td>
                  <td className="py-1 pr-2">{s.fallos}</td><td className="py-1 pr-2">{s.ips}</td><td className="py-1 pr-2">{s.bloqueos}</td><td className="py-1">{fecha(s.ultimo)}</td>
                </tr>
              ))}</tbody>
            </table>
          ) : <Empty>Sin actividad sospechosa.</Empty>}
        </Card>
      )}
    </div>
  );
}
