/**
 * Sondas del simulador docente: solicitudes REST que NO deben prosperar (leer tablas privadas, llamar funciones
 * internas o de servidor, responder o guardar en un apartado futuro) y una comprobación de que la vista del apartado
 * abierto no contiene claves, rúbricas, explicaciones ni enunciados futuros. Se ejecutan con la sesión real del
 * profesor en su asignación de prueba; ninguna cambia el estado (todas deben ser rechazadas o son de solo lectura).
 */
export interface Respuesta { error: string | null; data?: unknown }
export interface ClienteSondas {
  tabla(nombre: string): Promise<Respuesta>;
  rpc(fn: string, args: Record<string, unknown>): Promise<Respuesta>;
  calificar(body: Record<string, unknown>): Promise<Respuesta>;
}
export interface ContextoSondas {
  practica: string;
  /** un apartado que NO está abierto para el simulador (null si no queda ninguno) */
  apartadoFuturo: string | null;
  /** textos privados (rúbricas, explicaciones, enunciados de otros apartados) que nunca deben llegar al navegador */
  secretos: string[];
}
export interface ResultadoSonda { nombre: string; esperado: string; obtenido: string; ok: boolean }

const TABLAS = ['pes_practicas', 'pes_ejercicios', 'pes_apartados', 'pes_claves', 'pes_asignaciones', 'pes_estado', 'pes_respuestas', 'pes_controles', 'pes_eventos', 'pes_calibraciones'];
const CERO = '00000000-0000-4000-8000-000000000000';
const nuevoId = () => globalThis.crypto.randomUUID();
const CAMPOS_PRIVADOS = ['"clave"', '"rubrica"', '"explicacion"', '"relTol"', '"correct"', '"accepted"', '"rubric"', '"modelJustification"', '"credit"'];

const rechazo = (nombre: string, f: () => Promise<Respuesta>) => async (): Promise<ResultadoSonda> => {
  try {
    const r = await f();
    return { nombre, esperado: 'rechazada', obtenido: r.error ? `rechazada: ${r.error.slice(0, 90)}` : `ACEPTADA (${JSON.stringify(r.data ?? null).slice(0, 80)})`, ok: !!r.error };
  } catch (e) {
    return { nombre, esperado: 'rechazada', obtenido: `rechazada: ${(e instanceof Error ? e.message : String(e)).slice(0, 90)}`, ok: true };
  }
};

export function sondas(c: ClienteSondas, ctx: ContextoSondas): (() => Promise<ResultadoSonda>)[] {
  const xs: (() => Promise<ResultadoSonda>)[] = TABLAS.map((t) => rechazo(`Leer la tabla ${t} por REST`, () => c.tabla(t)));
  const p = ctx.practica, a = ctx.apartadoFuturo ?? CERO;
  xs.push(
    rechazo('Pedir la clave del apartado (svc_pes_preparar)', () => c.rpc('svc_pes_preparar', { p_user: CERO, p_practica: p, p_apartado: a })),
    rechazo('Confirmar saltándose la función de calificación (svc_pes_confirmar)', () => c.rpc('svc_pes_confirmar', { p_user: CERO, p_practica: p, p_apartado: a, p_respuesta: {}, p_resultado: { status: 'correct', credit: 1 }, p_anticipado: false, p_idem: nuevoId() })),
    rechazo('Calcular la puntuación de otro (pes_puntaje)', () => c.rpc('pes_puntaje', { p_practica: p, p_user: CERO })),
    rechazo('Pedir el estado interno de otro (pes_actual_json)', () => c.rpc('pes_actual_json', { p_practica: p, p_user: CERO })),
    rechazo('Avanzar el estado directamente (pes_avanzar)', () => c.rpc('pes_avanzar', { p_practica: p, p_user: CERO, p_desde: null })),
    rechazo('Escribir en el diario (pes_log)', () => c.rpc('pes_log', { p_practica: p, p_user: CERO, p_apartado: null, p_tipo: 'falso', p_detalle: {} })),
  );
  if (ctx.apartadoFuturo) {
    xs.push(
      rechazo('Guardar un borrador en un apartado futuro', () => c.rpc('pes_borrador', { p_practica: p, p_apartado: a, p_texto: '{"text":"1"}', p_rev: 999999 })),
      rechazo('Omitir un apartado futuro', () => c.rpc('pes_omitir', { p_practica: p, p_apartado: a, p_idem: nuevoId() })),
      rechazo('Responder un apartado futuro', () => c.calificar({ action: 'pes', op: 'confirmar', practica_id: p, apartado_id: a, answer: { text: '1' }, anticipado: true, idem: nuevoId() })),
      rechazo('Pedir los números de un apartado futuro', () => c.calificar({ action: 'pes', op: 'variante', practica_id: p, apartado_id: a })),
    );
  }
  xs.push(async () => {
    const nombre = 'Vista del apartado abierto sin claves, rúbricas ni enunciados futuros';
    const r = await c.rpc('pes_actual', { p_practica: p });
    if (r.error) return { nombre, esperado: 'sin datos privados', obtenido: `no se pudo leer: ${r.error}`, ok: false };
    const texto = JSON.stringify(r.data);
    const fuga = [...CAMPOS_PRIVADOS.filter((x) => texto.includes(x)), ...ctx.secretos.filter((x) => x.trim().length >= 12 && texto.includes(x)).map((x) => `«${x.slice(0, 30)}…»`)];
    return { nombre, esperado: 'sin datos privados', obtenido: fuga.length ? `FUGA: ${fuga.join(', ')}` : 'sin datos privados', ok: fuga.length === 0 };
  });
  return xs;
}

export async function ejecutarSondas(c: ClienteSondas, ctx: ContextoSondas): Promise<ResultadoSonda[]> {
  const out: ResultadoSonda[] = [];
  for (const s of sondas(c, ctx)) out.push(await s());            // en serie: el informe sale en orden y sin carreras
  return out;
}
