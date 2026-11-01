/**
 * Asistente de actividades con IA: lógica compartida (aula y Orbe Control) y acción del servidor (validación del
 * borrador, lo que falta, referencias, simulador, turno con Claude simulado y revisión sin coste).
 */
import { describe, expect, it, vi } from 'vitest';
import { aBorradorActividad, BORRADOR_VACIO, comprobar, localAISO, seleccionar, type BorradorIA, type EjercicioBanco } from '@/lib/asistenteActividad';
import { construirPeticion, faltantes, interpretar, normalizar, revisarBorrador, simular, turnoAsistente, type Ctx } from '../supabase/functions/orbe-ia/asistente.ts';
import type { Deps, Peticion, RespuestaModelo } from '../supabase/functions/orbe-ia/handler.ts';

const S1 = '10000000-0000-4000-8000-000000000001', S2 = '10000000-0000-4000-8000-000000000002';
const C1 = '20000000-0000-4000-8000-000000000001', C2 = '20000000-0000-4000-8000-000000000002';
const LA = '30000000-0000-4000-8000-00000000000a', LB = '30000000-0000-4000-8000-00000000000b', LX = '30000000-0000-4000-8000-0000000000ff';
const PROF = '40000000-0000-4000-8000-000000000001';
const CTX: Ctx = {
  ahora: '2026-11-02T10:00', dia_semana: 'lunes',
  secciones: [{ id: S1, nombre: 'Física General 1-A', asignatura: 'Física General I', course_id: C1 }, { id: S2, nombre: 'Física Básica', asignatura: 'Física Básica', course_id: C2 }],
  asignaturas: [
    { id: C1, titulo: 'Física General I', lecciones: [
      { id: LA, titulo: 'Choques totalmente inelásticos', unidad: 'Unidad 9', publicadas: { basico: 4, intermedio: 3, desafiante: 2 } },
      { id: LB, titulo: 'Conservación de la cantidad de movimiento', unidad: 'Unidad 9', publicadas: { basico: 2, intermedio: 2, desafiante: 1 } }] },
    { id: C2, titulo: 'Física Básica', lecciones: [{ id: LX, titulo: 'Vectores', unidad: 'Unidad 1', publicadas: { basico: 5, intermedio: 0, desafiante: 0 } }] },
  ],
};
const completo: BorradorIA = { ...BORRADOR_VACIO, seccion_id: S1, tipo: 'examen', modalidad: 'estricto', titulo: 'Quiz de choques', lecciones: [LA, LB], n: 6,
  niveles: { basico: 0, intermedio: 50, desafiante: 50 }, abre: '2026-11-05T08:00', cierra: '2026-11-05T09:00', duracion_min: 40, intentos: null, instrucciones: '' };

describe('lógica compartida', () => {
  it('la hora local de la República Dominicana es UTC−4 todo el año', () => {
    expect(localAISO('2026-11-05T08:00')).toBe('2026-11-05T12:00:00.000Z');
    expect(localAISO('2026-07-05T08:00')).toBe('2026-07-05T12:00:00.000Z');
    expect(localAISO('mañana')).toBeNull();
  });
  it('elige del banco por lección y nivel, sustituye por un nivel cercano y dice lo que falta', () => {
    const banco: EjercicioBanco[] = [
      ...Array.from({ length: 3 }, (_, i) => ({ id: `a-int-${i}`, lesson_id: LA, difficulty: 'intermedio' as const, format: 'numeric', published: true })),
      { id: 'a-des-0', lesson_id: LA, difficulty: 'desafiante', format: 'numeric', published: true },
      { id: 'b-bas-0', lesson_id: LB, difficulty: 'basico', format: 'choice', published: true },
      { id: 'b-oculta', lesson_id: LB, difficulty: 'desafiante', format: 'numeric', published: false },
    ];
    const s = seleccionar(banco, [LA, LB], 6, { basico: 0, intermedio: 50, desafiante: 50 }, 3);
    // LA: 3 pedidas (2 int + 1 des, por mayor resto) → 2 int + 1 des; LB: 3 pedidas, solo 1 básica publicada → sustituye 1 y faltan 2
    expect(s.ids.filter((x) => x.startsWith('a-'))).toHaveLength(3);
    expect(s.ids).toContain('b-bas-0');
    expect(s.ids).not.toContain('b-oculta');
    expect(s.sustituidas).toBe(1);
    expect(s.faltan.reduce((t, f) => t + f.cuantos, 0)).toBe(2);
    expect(new Set(s.ids).size).toBe(s.ids.length);
    expect(seleccionar(banco, [LA, LB], 6, { basico: 0, intermedio: 50, desafiante: 50 }, 3)).toEqual(s);   // reproducible
  });
  it('construye la actividad con las reglas de la plantilla (examen estricto, duración, fechas)', () => {
    const a = aBorradorActividad(completo, ['e1', 'e2'], true);
    expect(a).toMatchObject({ mode: 'exam', titulo: 'Quiz de choques', opens_at: '2026-11-05T12:00:00.000Z', closes_at: '2026-11-05T13:00:00.000Z', publicar: true, hints_enabled: false });
    expect(a.examen).toMatchObject({ presentacion: 'una_a_la_vez', navegacion: 'solo_adelante', duracion_s: 2400 });
    expect(a.preguntas).toEqual([{ exercise_id: 'e1', points: null }, { exercise_id: 'e2', points: null }]);
    const asistida = aBorradorActividad({ ...completo, tipo: 'practica', modalidad: 'asistida' }, ['e1'], false);
    expect(asistida.asistida).toEqual({ transferencia: false });
  });
  it('comprueba con las reglas del asistente clásico', () => {
    expect(comprobar({ ...completo, seccion_id: null }, ['e1'], false).errores[0]).toMatch(/sección/);
    expect(comprobar({ ...completo, cierra: '2026-11-05T07:00' }, ['e1'], false).errores.join()).toMatch(/cierre debe ser posterior/);
    expect(comprobar(completo, [], true).errores.join()).toMatch(/al menos una pregunta/);
  });
});

describe('servidor: validación del borrador', () => {
  it('solo secciones y lecciones del profesor; lecciones de otra asignatura se quitan', () => {
    const { borrador, avisos } = normalizar({ ...completo, lecciones: [LA, LX], seccion_id: S1 }, CTX);
    expect(borrador.lecciones).toEqual([LA]);
    expect(avisos.join()).toMatch(/no son de la asignatura/);
    expect(normalizar({ ...completo, seccion_id: 'ajena' }, CTX).borrador.seccion_id).toBeNull();
  });
  it('fechas inválidas o cierre antes de la apertura; n fuera de rango; modalidad incoherente con el tipo', () => {
    expect(normalizar({ ...completo, abre: 'mañana' }, CTX).borrador.abre).toBeNull();
    const r = normalizar({ ...completo, cierra: '2026-11-04T09:00' }, CTX);
    expect(r.borrador.cierra).toBeNull();
    expect(r.avisos.join()).toMatch(/anterior a la apertura/);
    expect(normalizar({ ...completo, n: 500 }, CTX).borrador.n).toBeNull();
    expect(normalizar({ ...completo, tipo: 'practica', modalidad: 'estricto' }, CTX).borrador.modalidad).toBeNull();
    expect(normalizar({ ...completo, tipo: null, modalidad: 'quiz' }, CTX).borrador.tipo).toBe('examen');
  });
  it('avisa si en esas lecciones no hay suficientes preguntas publicadas', () => {
    expect(normalizar({ ...completo, n: 20 }, CTX).avisos.join()).toMatch(/hay 14 preguntas publicadas y pidió 20/);
  });
  it('lo que falta lo decide el servidor: el examen necesita apertura y cierre; la tarea, cierre', () => {
    expect(faltantes(normalizar(completo, CTX).borrador)).toEqual([]);
    expect(faltantes(normalizar({ ...completo, abre: null, cierra: null }, CTX).borrador)).toEqual(['abre', 'cierra']);
    expect(faltantes(normalizar({ ...completo, tipo: 'practica', modalidad: 'tarea', abre: null, cierra: null }, CTX).borrador)).toEqual(['cierra']);
    expect(faltantes(normalizar({ ...completo, tipo: 'practica', modalidad: 'libre', abre: null, cierra: null }, CTX).borrador)).toEqual([]);
    expect(faltantes(normalizar(BORRADOR_VACIO, CTX).borrador)).toEqual(['seccion_id', 'tipo', 'modalidad', 'lecciones', 'n', 'titulo']);
  });
});

describe('servidor: conversación', () => {
  it('el modelo trabaja con referencias cortas (sin identificadores) y la hora local', () => {
    const p = construirPeticion(CTX, [{ rol: 'profesor', texto: 'quiero un quiz' }], completo, 'm', 2000);
    expect(p.user).toContain('Ahora: 2026-11-02T10:00 (lunes)');
    expect(p.user).toContain('S1. Física General 1-A');
    expect(p.user).toContain('L2. Unidad 9 → Conservación de la cantidad de movimiento (2/2/1)');
    expect(p.user).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(p.effort).toBe('medium');
  });
  it('traduce las referencias de la respuesta a ids reales e ignora las inexistentes', () => {
    const r = interpretar(JSON.stringify({ mensaje: 'Listo.', pregunta: '', borrador: { seccion: 'S1', tipo: 'examen', modalidad: 'quiz', titulo: 'T', lecciones: ['L1', 'L9'], n: 5,
      niveles: { basico: 50, intermedio: 50, desafiante: 0 }, abre: '2026-11-05T08:00', cierra: '', duracion_min: 0, intentos: 0, instrucciones: '' } }), CTX);
    expect(r.borrador).toMatchObject({ seccion_id: S1, lecciones: [LA], cierra: null, duracion_min: null });
    expect(() => interpretar('no json', CTX)).toThrow();
  });
  it('el simulador entiende lo básico: tipo, cantidad, sección y temas', () => {
    const r = simular([{ rol: 'profesor', texto: 'Un examen de 8 problemas de choques inelásticos para Física General 1-A' }], BORRADOR_VACIO, CTX);
    expect(r.borrador).toMatchObject({ tipo: 'examen', modalidad: 'parcial', n: 8, seccion_id: S1, lecciones: [LA] });
  });

  function servidor(o: { reserva?: Record<string, unknown>; texto?: string } = {}) {
    const llamadas: { fn: string; args: Record<string, unknown> }[] = [];
    const modelo = vi.fn(async (_p: Peticion): Promise<RespuestaModelo> => ({ texto: o.texto ?? '{}', stop_reason: 'end_turn', input_tokens: 6000, output_tokens: 500 }));
    const deps: Deps = {
      hayClave: true, llamarModelo: modelo,
      rpc: async (fn, args) => {
        llamadas.push({ fn, args });
        if (fn === 'svc_asistente_contexto') return { data: CTX, error: null };
        if (fn === 'svc_orbe_ia_reservar_uso') return { data: { ok: true, usage_id: 1, api_real: false, model: 'claude-opus-5-5', max_tokens: 2000, ...o.reserva }, error: null };
        if (fn === 'svc_orbe_ia_finalizar_uso') return { data: null, error: null };
        return { data: null, error: { message: 'desconocida' } };
      },
    };
    return { deps, llamadas, modelo };
  }
  it('turno con el simulador: no llama a la API; si falta algo, el servidor pregunta', async () => {
    const s = servidor();
    const r = await turnoAsistente({ mensajes: [{ rol: 'profesor', texto: 'Una práctica de 5 preguntas para Física Básica' }], borrador: BORRADOR_VACIO }, PROF, s.deps);
    expect(r).toMatchObject({ ok: true, simulado: true, listo: false });
    expect(s.modelo).not.toHaveBeenCalled();
    expect(r.faltan).toEqual(['lecciones']);
    expect(r.pregunta).toMatch(/temas/);
    expect(s.llamadas.find((c) => c.fn === 'svc_orbe_ia_reservar_uso')!.args).toMatchObject({ p_purpose: 'asistente' });
  });
  it('turno con Claude: borrador completo, listo para crear; tokens registrados', async () => {
    const texto = JSON.stringify({ mensaje: 'Perfecto: examen estricto de 6 preguntas el jueves de 8 a 9.', pregunta: '', borrador: { seccion: 'S1', tipo: 'examen', modalidad: 'estricto', titulo: 'Quiz de choques',
      lecciones: ['L1', 'L2'], n: 6, niveles: { basico: 0, intermedio: 50, desafiante: 50 }, abre: '2026-11-05T08:00', cierra: '2026-11-05T09:00', duracion_min: 40, intentos: 0, instrucciones: '' } });
    const s = servidor({ reserva: { api_real: true }, texto });
    const r = await turnoAsistente({ mensajes: [{ rol: 'profesor', texto: 'examen estricto…' }], borrador: BORRADOR_VACIO }, PROF, s.deps);
    expect(r).toMatchObject({ ok: true, simulado: false, listo: true, pregunta: '', faltan: [] });
    expect(r.borrador).toMatchObject({ seccion_id: S1, lecciones: [LA, LB], n: 6, duracion_min: 40, intentos: null });
    expect(s.llamadas.find((c) => c.fn === 'svc_orbe_ia_finalizar_uso')!.args).toMatchObject({ p_ok: true, p_input: 6000, p_output: 500 });
  });
  it('si Claude no pregunta pero falta algo, pregunta el servidor', async () => {
    const texto = JSON.stringify({ mensaje: 'Entendido.', pregunta: '', borrador: { seccion: 'S1', tipo: 'examen', modalidad: 'quiz', titulo: 'Q', lecciones: ['L1'], n: 5,
      niveles: { basico: 1, intermedio: 1, desafiante: 1 }, abre: '', cierra: '', duracion_min: 0, intentos: 0, instrucciones: '' } });
    const r = await turnoAsistente({ mensajes: [{ rol: 'profesor', texto: 'quiz' }], borrador: BORRADOR_VACIO }, PROF, servidor({ reserva: { api_real: true }, texto }).deps);
    expect(r.faltan).toEqual(['abre', 'cierra']);
    expect(r.pregunta).toMatch(/abrirse/);
  });
  it('revisar un borrador editado a mano no usa Orbe IA y devuelve las secciones y lecciones', async () => {
    const s = servidor();
    const r = await revisarBorrador({ borrador: completo }, PROF, s.deps);
    expect(r).toMatchObject({ ok: true, listo: true });
    expect((r.contexto as Ctx).secciones).toHaveLength(2);
    expect(s.llamadas.map((c) => c.fn)).toEqual(['svc_asistente_contexto']);
  });
  it('sin presupuesto o apagado: no llama al modelo; conversación inválida: error 400', async () => {
    const s = servidor({ reserva: { ok: false, motivo: 'apagado' } });
    expect(await turnoAsistente({ mensajes: [{ rol: 'profesor', texto: 'hola' }] }, PROF, s.deps)).toEqual({ ok: false, motivo: 'apagado' });
    await expect(turnoAsistente({ mensajes: [] }, PROF, s.deps)).rejects.toMatchObject({ status: 400 });
  });
});
