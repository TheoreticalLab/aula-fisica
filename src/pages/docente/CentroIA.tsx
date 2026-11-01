/**
 * Centro de IA del profesor. Pieza principal: el ASISTENTE DE ACTIVIDADES — el profesor pide en lenguaje corriente
 * una práctica o un examen («10 problemas de choques, mitad intermedios, que abra el lunes a las 8 y cierre a las 10»),
 * Claude pregunta lo que falte y completa un borrador que el profesor puede corregir a mano. Al confirmar, el aula
 * elige las preguntas del banco y crea la actividad con las reglas del asistente «+ Crear actividad». Claude no crea
 * nada por su cuenta. Accesos a los demás usos de la IA (generar preguntas, LIEIA, configuración de Orbe IA).
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { asistenteRevisar, asistenteTurno, bancoDeLecciones, type ContextoAsistente, type Mensaje, type RespuestaAsistente } from '@/api/asistente';
import { crearDesdeBorrador } from '@/api/crearActividad';
import { aBorradorActividad, BORRADOR_VACIO, comprobar, fmtLocal, MODALIDADES, seleccionar, type BorradorIA, type Modalidad, type Nivel, type Seleccion } from '@/lib/asistenteActividad';
import { resumen } from '@/lib/plantillas';
import { useAction } from '@/lib/util';
import { Badge, Card, ErrorBox, Notice, PageTitle, Spinner } from '@/components/ui';

const MOTIVOS: Record<string, string> = {
  apagado: 'Orbe IA está apagado (Orbe IA → Configuración general).', limite_diario: 'Se alcanzó el límite diario de llamadas de Orbe IA.',
  presupuesto: 'Se agotó el presupuesto mensual de Orbe IA.', permiso: 'Su cuenta no puede usar Orbe IA.', sin_clave: 'Falta la clave de la API en el servidor.',
  proposito: 'Falta instalar la migración 56 (asistente de actividades).', formato: 'La respuesta no tuvo el formato esperado; repita el mensaje.',
  respuesta_cortada: 'La respuesta se cortó; repita el mensaje.', red: 'No se pudo conectar con Claude.', limite_api: 'Claude está ocupado; inténtelo en unos segundos.',
};
const CAMPOS: Record<string, string> = { seccion_id: 'sección', tipo: 'tipo', modalidad: 'modalidad', titulo: 'título', lecciones: 'temas', n: 'número de preguntas', abre: 'apertura', cierra: 'cierre' };
const NIV: Record<Nivel, string> = { basico: 'Básico', intermedio: 'Intermedio', desafiante: 'Desafiante' };
const EJEMPLO = 'Necesito una práctica de 10 problemas de choques inelásticos y conservación de la cantidad de movimiento para Física General 1-A, la mitad intermedios y algunos desafiantes, que abra el lunes a las 8:00 a. m. y cierre el miércoles a las 11:59 p. m.';

export default function CentroIA() {
  return (
    <div className="space-y-4">
      <PageTitle title="🤖 Centro de IA" subtitle="Pida lo que necesita en lenguaje corriente. La IA pregunta lo que falte, usted revisa y confirma; nada se crea ni se publica sin su visto bueno." back={{ to: '/docente', label: 'Panel docente' }} />
      <AsistenteActividades />
      <div className="grid gap-3 md:grid-cols-3">
        <Link to="/docente/generar-preguntas" className="tarjeta block hover:border-primario-400"><p className="font-semibold">✨ Generar preguntas</p><p className="text-xs text-gray-500">Preguntas nuevas para el banco, por temas y niveles, con coste estimado.</p></Link>
        <Link to="/docente/lieia" className="tarjeta block hover:border-primario-400"><p className="font-semibold">🔬 Interpretar un examen</p><p className="text-xs text-gray-500">LIEIA → Laboratorio científico → Interpretación IA.</p></Link>
        <Link to="/docente/orbe-ia" className="tarjeta block hover:border-primario-400"><p className="font-semibold">⚙️ Orbe IA</p><p className="text-xs text-gray-500">Encendido, llamadas reales, presupuesto y consumo (administración).</p></Link>
      </div>
    </div>
  );
}

function AsistenteActividades() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [b, setB] = useState<BorradorIA>(BORRADOR_VACIO);
  const [ctx, setCtx] = useState<ContextoAsistente | null>(null);
  const [estado, setEstado] = useState<Pick<RespuestaAsistente, 'faltan' | 'avisos' | 'listo' | 'simulado'>>({ faltan: [], avisos: [] });
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fin = useRef<HTMLDivElement>(null);

  // contexto (secciones y lecciones) y primera revisión: sin IA, sin coste
  const revisar = async (x: BorradorIA) => {
    try {
      const r = await asistenteRevisar(x);
      if (r.contexto) setCtx(r.contexto);
      if (r.ok && r.borrador) { setB(r.borrador); setEstado({ faltan: r.faltan, avisos: r.avisos, listo: r.listo }); }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  useEffect(() => { void revisar(BORRADOR_VACIO); }, []);
  useEffect(() => { fin.current?.scrollIntoView({ block: 'nearest' }); }, [mensajes]);

  async function enviar() {
    const t = texto.trim();
    if (!t) return;
    const conv: Mensaje[] = [...mensajes, { rol: 'profesor', texto: t }];
    setMensajes(conv); setTexto(''); setOcupado(true); setError(null);
    try {
      const r = await asistenteTurno(conv, b);
      if (!r.ok) { setError(MOTIVOS[r.motivo ?? ''] ?? `No se pudo (${r.motivo}).`); return; }
      setMensajes([...conv, { rol: 'asistente', texto: [r.mensaje, r.pregunta].filter(Boolean).join('\n\n') }]);
      if (r.borrador) setB(r.borrador);
      setEstado({ faltan: r.faltan, avisos: r.avisos, listo: r.listo, simulado: r.simulado });
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setOcupado(false); }
  }

  // edición manual del borrador (se revisa en el servidor sin IA, con una pequeña espera)
  const espera = useRef<ReturnType<typeof setTimeout>>();
  const editar = (p: Partial<BorradorIA>) => {
    const x = { ...b, ...p };
    setB(x);
    clearTimeout(espera.current);
    espera.current = setTimeout(() => void revisar(x), 500);
  };

  return (
    <Card title="Crear una práctica o un examen conversando">
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="max-h-[28rem] min-h-[12rem] space-y-2 overflow-y-auto rounded-lg bg-gray-50 p-3 dark:bg-white/5" aria-live="polite">
            {!mensajes.length && (
              <div className="text-sm text-gray-600 dark:text-gray-300">
                <p>Describa la actividad: sección, práctica o examen, cuántas preguntas, de qué temas, niveles, cuándo abre y cuándo cierra. Si falta algo, le preguntaré.</p>
                <button className="btn-texto mt-2 text-left text-xs" onClick={() => setTexto(EJEMPLO)}>Usar un ejemplo: «{EJEMPLO.slice(0, 90)}…»</button>
              </div>
            )}
            {mensajes.map((m, i) => (
              <div key={i} className={`max-w-[90%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${m.rol === 'profesor' ? 'ml-auto bg-primario-600 text-white' : 'bg-white shadow-sm dark:bg-primario-900/40'}`}>{m.texto}</div>
            ))}
            {ocupado && <p className="text-xs text-gray-500">Pensando…</p>}
            <div ref={fin} />
          </div>
          <div className="mt-2 flex gap-2">
            <textarea className="campo flex-1" rows={2} maxLength={2000} value={texto} placeholder="Escriba aquí…" disabled={ocupado}
              onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar(); } }} />
            <button className="btn-primario self-end" disabled={ocupado || !texto.trim()} onClick={() => void enviar()}>Enviar</button>
          </div>
          {estado.simulado && <p className="mt-1 text-xs text-gray-500">Simulador: con las llamadas reales de Orbe IA apagadas, la conversación entiende poco. Puede completar el borrador a mano a la derecha.</p>}
          <ErrorBox error={error} />
        </div>
        <div className="lg:col-span-2">
          {!ctx ? <Spinner /> : <EditorBorrador b={b} ctx={ctx} editar={editar} faltan={estado.faltan ?? []} avisos={estado.avisos ?? []} />}
        </div>
      </div>
      {ctx && estado.listo && <Preparar b={b} ctx={ctx} />}
    </Card>
  );
}

function EditorBorrador({ b, ctx, editar, faltan, avisos }: { b: BorradorIA; ctx: ContextoAsistente; editar: (p: Partial<BorradorIA>) => void; faltan: string[]; avisos: string[] }) {
  const sec = ctx.secciones.find((s) => s.id === b.seccion_id);
  const asig = sec ? ctx.asignaturas.find((a) => a.id === sec.course_id) : null;
  const unidades = asig ? [...new Set(asig.lecciones.map((l) => l.unidad))] : [];
  const falta = (k: string) => (faltan.includes(k) ? 'ring-2 ring-amber-400' : '');
  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium">Borrador {faltan.length ? <Badge tone="amber">falta: {faltan.map((f) => CAMPOS[f] ?? f).join(', ')}</Badge> : <Badge tone="green">completo</Badge>}</p>
      {avisos.map((a) => <p key={a} className="text-xs text-amber-700 dark:text-amber-300">⚠ {a}</p>)}
      <label className="block"><span className="etiqueta">Sección</span>
        <select className={`campo ${falta('seccion_id')}`} value={b.seccion_id ?? ''} onChange={(e) => editar({ seccion_id: e.target.value || null, lecciones: [] })}>
          <option value="">—</option>{ctx.secciones.map((s) => <option key={s.id} value={s.id}>{s.nombre} · {s.asignatura}</option>)}
        </select></label>
      <div className="grid grid-cols-2 gap-2">
        <label><span className="etiqueta">Tipo</span>
          <select className={`campo ${falta('tipo')}`} value={b.tipo ?? ''} onChange={(e) => editar({ tipo: (e.target.value || null) as BorradorIA['tipo'], modalidad: null })}>
            <option value="">—</option><option value="practica">Práctica</option><option value="examen">Examen</option>
          </select></label>
        <label><span className="etiqueta">Modalidad</span>
          <select className={`campo ${falta('modalidad')}`} value={b.modalidad ?? ''} onChange={(e) => editar({ modalidad: (e.target.value || null) as Modalidad | null })}>
            <option value="">—</option>
            {(Object.keys(MODALIDADES) as Modalidad[]).filter((m) => !b.tipo || MODALIDADES[m].tipo === b.tipo).map((m) => <option key={m} value={m}>{MODALIDADES[m].nombre}</option>)}
          </select></label>
      </div>
      <label className="block"><span className="etiqueta">Título</span><input className={`campo ${falta('titulo')}`} maxLength={160} value={b.titulo} onChange={(e) => editar({ titulo: e.target.value })} /></label>
      <details className={`rounded border border-gray-200 p-2 dark:border-white/10 ${falta('lecciones')}`} open={!b.lecciones.length && !!asig}>
        <summary className="cursor-pointer">Temas: {b.lecciones.length ? `${b.lecciones.length} lección(es)` : 'ninguno'}</summary>
        {!asig ? <p className="text-xs text-gray-500">Elija primero la sección.</p> : (
          <div className="mt-1 max-h-56 space-y-1 overflow-y-auto">
            {unidades.map((u) => (
              <div key={u}><p className="text-xs font-semibold text-gray-500">{u}</p>
                {asig.lecciones.filter((l) => l.unidad === u).map((l) => (
                  <label key={l.id} className="flex items-start gap-2 text-xs">
                    <input type="checkbox" checked={b.lecciones.includes(l.id)} onChange={(e) => editar({ lecciones: e.target.checked ? [...b.lecciones, l.id] : b.lecciones.filter((x) => x !== l.id) })} />
                    <span>{l.titulo} <span className="text-gray-500">({l.publicadas.basico}/{l.publicadas.intermedio}/{l.publicadas.desafiante})</span></span>
                  </label>
                ))}</div>
            ))}
          </div>
        )}
      </details>
      <div className="grid grid-cols-4 gap-2">
        <label><span className="etiqueta">Preguntas</span><input type="number" min={1} max={100} className={`campo ${falta('n')}`} value={b.n ?? ''} onChange={(e) => editar({ n: e.target.value ? Number(e.target.value) : null })} /></label>
        {(['basico', 'intermedio', 'desafiante'] as Nivel[]).map((k) => (
          <label key={k}><span className="etiqueta">{NIV[k]} %</span><input type="number" min={0} max={100} className="campo" value={b.niveles[k]} onChange={(e) => editar({ niveles: { ...b.niveles, [k]: Number(e.target.value) || 0 } })} /></label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label><span className="etiqueta">Abre</span><input type="datetime-local" className={`campo ${falta('abre')}`} value={b.abre ?? ''} onChange={(e) => editar({ abre: e.target.value || null })} /></label>
        <label><span className="etiqueta">Cierra</span><input type="datetime-local" className={`campo ${falta('cierra')}`} value={b.cierra ?? ''} onChange={(e) => editar({ cierra: e.target.value || null })} /></label>
      </div>
      <p className="text-xs text-gray-500">Hora de la República Dominicana. {b.abre && `Abre: ${fmtLocal(b.abre)}. `}{b.cierra && `Cierra: ${fmtLocal(b.cierra)}.`}</p>
      <div className="grid grid-cols-2 gap-2">
        {b.tipo === 'examen' && <label><span className="etiqueta">Duración (min)</span><input type="number" min={1} max={360} className="campo" placeholder="la de la modalidad" value={b.duracion_min ?? ''} onChange={(e) => editar({ duracion_min: e.target.value ? Number(e.target.value) : null })} /></label>}
        <label><span className="etiqueta">Intentos</span><input type="number" min={1} max={50} className="campo" placeholder="los de la modalidad" value={b.intentos ?? ''} onChange={(e) => editar({ intentos: e.target.value ? Number(e.target.value) : null })} /></label>
      </div>
      <label className="block"><span className="etiqueta">Instrucciones para los estudiantes</span><textarea className="campo" rows={2} maxLength={1500} value={b.instrucciones} onChange={(e) => editar({ instrucciones: e.target.value })} /></label>
    </div>
  );
}

/** Elegir las preguntas del banco y crear la actividad (cuando el borrador está completo). */
function Preparar({ b, ctx }: { b: BorradorIA; ctx: ContextoAsistente }) {
  const [sel, setSel] = useState<Seleccion | null>(null);
  const [publicar, setPublicar] = useState(true);
  const [creada, setCreada] = useState<string | null>(null);
  const accion = useAction();
  const sec = ctx.secciones.find((s) => s.id === b.seccion_id)!;
  const lecs = ctx.asignaturas.find((a) => a.id === sec.course_id)?.lecciones ?? [];
  // si el borrador cambia, hay que volver a elegir
  useEffect(() => { setSel(null); setCreada(null); }, [b]);
  const elegir = () => void accion.run(async () => setSel(seleccionar(await bancoDeLecciones(b.lecciones), b.lecciones, b.n ?? 0, b.niveles, Math.floor(Math.random() * 1e9))));
  const chk = sel ? comprobar(b, sel.ids, publicar) : null;
  const crear = () => void accion.run(async () => { const a = await crearDesdeBorrador(aBorradorActividad(b, sel!.ids, publicar), sec.id); setCreada(a.id); });
  return (
    <div className="mt-4 border-t border-gray-200 pt-4 dark:border-white/10">
      {!sel ? (
        <button className="btn-primario" disabled={accion.busy} onClick={elegir}>{accion.busy ? 'Eligiendo…' : 'Elegir las preguntas del banco'}</button>
      ) : creada ? (
        <Notice tone="ok">Actividad creada {publicar ? (b.abre ? `y programada: se abre ${fmtLocal(b.abre)}` : 'y publicada') : 'como borrador oculto'}. <Link className="enlace" to={`/docente/actividades/${creada}?creada=1`}>Abrirla</Link></Notice>
      ) : (
        <div className="space-y-2 text-sm">
          <p className="font-medium">{sel.ids.length} de {b.n} preguntas elegidas del banco (publicadas){sel.sustituidas ? `; ${sel.sustituidas} de un nivel cercano porque no había suficientes del pedido` : ''}.</p>
          {sel.faltan.length > 0 && (
            <Notice tone="warn">
              Faltan {sel.faltan.reduce((s, f) => s + f.cuantos, 0)}: {sel.faltan.map((f) => `${f.cuantos} en «${lecs.find((l) => l.id === f.leccion_id)?.titulo ?? '?'}»`).join('; ')}.
              Puede <Link className="enlace" to={`/docente/generar-preguntas?curso=${sec.course_id}`}>generarlas con IA</Link> (quedan como borradores para revisar y publicar) y volver aquí, o crear la actividad con las disponibles.
            </Notice>
          )}
          <ul className="list-disc pl-5 text-xs">{resumen(aBorradorActividad(b, sel.ids, publicar)).map((l) => <li key={l}>{l}</li>)}</ul>
          <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={publicar} onChange={(e) => setPublicar(e.target.checked)} />
            <span>{b.abre ? `Programarla: los estudiantes la verán y podrán empezar ${fmtLocal(b.abre)}` : 'Publicarla ahora'}<span className="block text-xs text-gray-500">Desmarcado: se guarda oculta para revisarla antes.</span></span></label>
          {chk?.errores.map((e) => <p key={e} className="text-xs text-red-700">✖ {e}</p>)}
          {chk?.avisos.map((a) => <p key={a} className="text-xs text-amber-700">⚠ {a}</p>)}
          <div className="flex gap-2">
            <button className="btn-primario" disabled={accion.busy || !!chk?.errores.length} onClick={crear}>{accion.busy ? 'Creando…' : 'Crear la actividad'}</button>
            <button className="btn-secundario" disabled={accion.busy} onClick={elegir}>Elegir otras preguntas</button>
          </div>
        </div>
      )}
      <ErrorBox error={accion.error} />
    </div>
  );
}
