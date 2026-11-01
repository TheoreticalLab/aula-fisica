/**
 * ✨ IA en Orbe Control: crear una práctica o un examen conversando desde el teléfono. Misma lógica que el Centro de IA
 * del aula (src/lib/asistenteActividad.ts y plantillas.ts): Claude completa un borrador preguntando lo que falte; el
 * profesor lo corrige si quiere y confirma; el teléfono elige las preguntas del banco y crea la actividad (oculta,
 * completa y, si se pide, publicada o programada). Claude no crea nada por su cuenta.
 */
import { useEffect, useRef, useState } from 'react';
import { rpc, supabase } from './supabase';
import { MOTIVOS_IA } from './ia';
import { aBorradorActividad, BORRADOR_VACIO, comprobar, fmtLocal, MODALIDADES, seleccionar, type BorradorIA, type EjercicioBanco, type Modalidad, type Seleccion } from '../../src/lib/asistenteActividad';
import { aActividad, resumen, type Borrador } from '../../src/lib/plantillas';

interface Mensaje { rol: 'profesor' | 'asistente'; texto: string }
interface Ctx { ahora: string; secciones: { id: string; nombre: string; asignatura: string; course_id: string }[]; asignaturas: { id: string; titulo: string; lecciones: { id: string; titulo: string; unidad: string }[] }[] }
interface Resp { ok: boolean; motivo?: string; simulado?: boolean; mensaje?: string; pregunta?: string; borrador?: BorradorIA; faltan?: string[]; avisos?: string[]; listo?: boolean; contexto?: Ctx }
const CAMPOS: Record<string, string> = { seccion_id: 'sección', tipo: 'tipo', modalidad: 'modalidad', titulo: 'título', lecciones: 'temas', n: 'n.º de preguntas', abre: 'apertura', cierra: 'cierre' };

async function orbeIa(body: Record<string, unknown>): Promise<Resp> {
  const { data, error } = await supabase.functions.invoke('orbe-ia', { body });
  if (error) throw new Error(error.message);
  return data as Resp;
}

/** Igual que crearDesdeBorrador del aula: oculta → preguntas → modo de examen / asistida → publicar. */
async function crear(b: Borrador, classId: string): Promise<string> {
  const { data: act, error } = await supabase.from('activities').insert({ ...aActividad(b, classId), published: false }).select('id').single();
  if (error) throw new Error(error.message);
  if (b.preguntas.length) {
    const r = await supabase.from('activity_items').insert(b.preguntas.map((p, i) => ({ activity_id: act.id, exercise_id: p.exercise_id, points: p.points, position: i + 1 })));
    if (r.error) throw new Error(r.error.message);
  }
  if (b.mode === 'exam' && b.examen) await rpc('exam_settings_save', { p_activity: act.id, p_cfg: b.examen });
  if (b.asistida) await rpc('assisted_settings_save', { p_activity: act.id, p_cfg: { transferencia: b.asistida.transferencia }, p_transferencias: null });
  if (b.publicar) { const u = await supabase.from('activities').update({ published: true }).eq('id', act.id); if (u.error) throw new Error(u.error.message); }
  return act.id as string;
}

export function AsistenteIA() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [b, setB] = useState<BorradorIA>(BORRADOR_VACIO);
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [est, setEst] = useState<Resp>({ ok: true, faltan: [] });
  const [texto, setTexto] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<Seleccion | null>(null);
  const [publicar, setPublicar] = useState(true);
  const [creada, setCreada] = useState<string | null>(null);
  const fin = useRef<HTMLDivElement>(null);

  const revisar = async (x: BorradorIA) => {
    try { const r = await orbeIa({ action: 'asistente_revisar', borrador: x }); if (r.contexto) setCtx(r.contexto); if (r.ok && r.borrador) { setB(r.borrador); setEst(r); } }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  useEffect(() => { void revisar(BORRADOR_VACIO); }, []);
  useEffect(() => { fin.current?.scrollIntoView({ block: 'nearest' }); }, [mensajes]);
  useEffect(() => { setSel(null); setCreada(null); }, [b]);

  async function enviar() {
    const t = texto.trim();
    if (!t) return;
    const conv: Mensaje[] = [...mensajes, { rol: 'profesor', texto: t }];
    setMensajes(conv); setTexto(''); setBusy(true); setError(null);
    try {
      const r = await orbeIa({ action: 'asistente_actividad', mensajes: conv, borrador: b });
      if (!r.ok) { setError(MOTIVOS_IA[r.motivo ?? ''] ?? r.motivo ?? 'No se pudo'); return; }
      setMensajes([...conv, { rol: 'asistente', texto: [r.mensaje, r.pregunta].filter(Boolean).join('\n\n') }]);
      if (r.borrador) setB(r.borrador);
      setEst(r);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  const editar = (p: Partial<BorradorIA>) => { const x = { ...b, ...p }; setB(x); void revisar(x); };

  async function elegir() {
    setBusy(true); setError(null);
    try {
      const { data, error: e } = await supabase.from('exercises').select('id, lesson_id, difficulty, format, published').in('lesson_id', b.lecciones).eq('published', true).limit(3000);
      if (e) throw new Error(e.message);
      setSel(seleccionar((data ?? []) as EjercicioBanco[], b.lecciones, b.n ?? 0, b.niveles, Math.floor(Math.random() * 1e9)));
    } catch (x) { setError(x instanceof Error ? x.message : String(x)); }
    finally { setBusy(false); }
  }
  async function confirmar() {
    if (!sel || !b.seccion_id) return;
    setBusy(true); setError(null);
    try { setCreada(await crear(aBorradorActividad(b, sel.ids, publicar), b.seccion_id)); }
    catch (x) { setError(x instanceof Error ? x.message : String(x)); }
    finally { setBusy(false); }
  }

  const sec = ctx?.secciones.find((s) => s.id === b.seccion_id);
  const lecs = sec ? ctx!.asignaturas.find((a) => a.id === sec.course_id)?.lecciones ?? [] : [];
  const chk = sel ? comprobar(b, sel.ids, publicar) : null;
  return (
    <section className="tarjeta">
      <h2>✨ Crear con IA</h2>
      <p className="tenue pequeno">Pida una práctica o un examen: sección, cuántas preguntas, temas, niveles, cuándo abre y cierra. Le preguntaré lo que falte; nada se crea sin su confirmación.</p>
      <div className="chat">
        {mensajes.map((m, i) => <p key={i} className={m.rol === 'profesor' ? 'burbuja propia' : 'burbuja'}>{m.texto}</p>)}
        {busy && <p className="tenue pequeno">Un momento…</p>}
        <div ref={fin} />
      </div>
      <textarea rows={3} maxLength={2000} value={texto} disabled={busy} placeholder="Ej.: examen estricto de 8 problemas de choques para 1-A, el jueves de 8 a 9 a. m." onChange={(e) => setTexto(e.target.value)} />
      <div className="fila"><button className="boton" disabled={busy || !texto.trim()} onClick={() => void enviar()}>Enviar</button></div>
      {est.simulado && <p className="tenue pequeno">Simulador: active las llamadas reales en Orbe IA para una conversación de verdad; mientras, complete el borrador abajo.</p>}
      {error && <p className="error">{error}</p>}

      {ctx && (
        <div className="tarjeta borrador">
          <h3>Borrador {est.faltan?.length ? <span className="etiqueta-aviso">falta: {est.faltan.map((f) => CAMPOS[f] ?? f).join(', ')}</span> : <span className="etiqueta-ok">completo</span>}</h3>
          {est.avisos?.map((a) => <p key={a} className="aviso pequeno">⚠ {a}</p>)}
          <label>Sección<select value={b.seccion_id ?? ''} onChange={(e) => editar({ seccion_id: e.target.value || null, lecciones: [] })}>
            <option value="">—</option>{ctx.secciones.map((s) => <option key={s.id} value={s.id}>{s.nombre} · {s.asignatura}</option>)}</select></label>
          <label>Modalidad<select value={b.modalidad ?? ''} onChange={(e) => { const m = (e.target.value || null) as Modalidad | null; editar({ modalidad: m, tipo: m ? MODALIDADES[m].tipo : null }); }}>
            <option value="">—</option>{(Object.keys(MODALIDADES) as Modalidad[]).map((m) => <option key={m} value={m}>{MODALIDADES[m].tipo === 'examen' ? 'Examen' : 'Práctica'} · {MODALIDADES[m].nombre}</option>)}</select></label>
          <label>Título<input maxLength={160} value={b.titulo} onChange={(e) => setB({ ...b, titulo: e.target.value })} onBlur={() => editar({})} /></label>
          <label>Preguntas<input type="number" min={1} max={100} value={b.n ?? ''} onChange={(e) => editar({ n: e.target.value ? Number(e.target.value) : null })} /></label>
          <p className="pequeno">Temas: {b.lecciones.length ? b.lecciones.map((id) => lecs.find((l) => l.id === id)?.titulo ?? '?').join(' · ') : 'ninguno (dígalos en el chat o elíjalos en el Centro de IA del aula)'}</p>
          <p className="pequeno">Niveles: {b.niveles.basico} % básico · {b.niveles.intermedio} % intermedio · {b.niveles.desafiante} % desafiante</p>
          <label>Abre<input type="datetime-local" value={b.abre ?? ''} onChange={(e) => editar({ abre: e.target.value || null })} /></label>
          <label>Cierra<input type="datetime-local" value={b.cierra ?? ''} onChange={(e) => editar({ cierra: e.target.value || null })} /></label>
          {(b.abre || b.cierra) && <p className="tenue pequeno">{b.abre && `Abre ${fmtLocal(b.abre)}. `}{b.cierra && `Cierra ${fmtLocal(b.cierra)}.`}</p>}

          {est.listo && !sel && <div className="fila"><button className="boton" disabled={busy} onClick={() => void elegir()}>Elegir preguntas del banco</button></div>}
          {sel && !creada && (
            <>
              <p className="pequeno"><strong>{sel.ids.length} de {b.n}</strong> preguntas elegidas{sel.faltan.length ? `; faltan ${sel.faltan.reduce((s, f) => s + f.cuantos, 0)} (genérelas en el aula: Banco → Generar con IA)` : ''}.</p>
              <ul className="pequeno">{resumen(aBorradorActividad(b, sel.ids, publicar)).map((l) => <li key={l}>{l}</li>)}</ul>
              <label className="casilla"><input type="checkbox" checked={publicar} onChange={(e) => setPublicar(e.target.checked)} /> {b.abre ? `Programarla (se abre ${fmtLocal(b.abre)})` : 'Publicarla ahora'}</label>
              {chk?.errores.map((x) => <p key={x} className="error pequeno">✖ {x}</p>)}
              {chk?.avisos.map((x) => <p key={x} className="aviso pequeno">⚠ {x}</p>)}
              <div className="fila">
                <button className="boton" disabled={busy || !!chk?.errores.length} onClick={() => void confirmar()}>{busy ? 'Creando…' : 'Crear la actividad'}</button>
                <button className="boton secundario" disabled={busy} onClick={() => void elegir()}>Otras preguntas</button>
              </div>
            </>
          )}
          {creada && <p className="ok">✔ Actividad creada {publicar ? (b.abre ? `y programada (${fmtLocal(b.abre)})` : 'y publicada') : 'como borrador oculto'}. Puede revisarla en el aula: sección → Actividades.</p>}
        </div>
      )}
    </section>
  );
}
