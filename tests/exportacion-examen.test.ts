import { describe, expect, it } from 'vitest';
import { calcularDerivados, COLUMNAS_DERIVADAS } from '../src/lib/exportacion/metricas';
import { DERIVADAS } from '../src/lib/exportacion/catalogo';

const t = (s: number) => new Date(Date.UTC(2026, 10, 2, 10, 0, 0) + s * 1000).toISOString();
const A = 'a0000000-0000-4000-8000-000000000001', U = 'u0000000-0000-4000-8000-000000000001';

describe('Centro de Datos · tiempos del motor de examen', () => {
  const d = {
    intentos: [{ id: A, user_id: U, activity_id: 'act', mode: 'exam', status: 'submitted', started_at: t(0), submitted_at: t(200) }],
    actividad_items: [{ activity_id: 'act', exercise_id: 'q1', position: 1 }, { activity_id: 'act', exercise_id: 'q2', position: 2 }],
    examen_sesiones: [{ attempt_id: A, extra_s: 300 }],
    examen_eventos: [
      { attempt_id: A, tipo: 'apertura', exercise_id: 'q1', t: t(0) }, { attempt_id: A, tipo: 'ir_a', exercise_id: 'q2', t: t(40) },
      { attempt_id: A, tipo: 'pausa', exercise_id: null, t: t(70) }, { attempt_id: A, tipo: 'reanudacion', exercise_id: null, t: t(100) },
      { attempt_id: A, tipo: 'ir_a', exercise_id: 'q1', t: t(130) }, { attempt_id: A, tipo: 'entrega', exercise_id: null, t: t(200) },
    ],
    examen_tramos: [
      { attempt_id: A, user_id: U, seq: 1, tipo: 'trabajo', exercise_id: 'q1', inicio: t(0), fin: t(40) },
      { attempt_id: A, user_id: U, seq: 2, tipo: 'trabajo', exercise_id: 'q2', inicio: t(40), fin: t(70) },
      { attempt_id: A, user_id: U, seq: 3, tipo: 'pausa_declarada', exercise_id: 'q2', inicio: t(70), fin: t(100) },
      { attempt_id: A, user_id: U, seq: 4, tipo: 'oculta', exercise_id: 'q2', inicio: t(100), fin: t(110) },
      { attempt_id: A, user_id: U, seq: 5, tipo: 'trabajo', exercise_id: 'q2', inicio: t(110), fin: t(130) },
      { attempt_id: A, user_id: U, seq: 6, tipo: 'trabajo', exercise_id: 'q1', inicio: t(130), fin: t(160) },
      { attempt_id: A, user_id: U, seq: 7, tipo: 'trabajo', exercise_id: 'q2', inicio: t(160), fin: t(200) },   // el servidor tenía activa q1: se reclasifica
    ],
  };
  const der = calcularDerivados(d);
  const fila = (q: string) => der.tiempos_examen.find((f) => f.exercise_id === q)!;

  it('está en el catálogo con sus columnas fijas', () => {
    expect(DERIVADAS.some((x) => x.nombre === 'tiempos_examen')).toBe(true);
    expect(Object.keys(fila('q1')).sort()).toEqual([...COLUMNAS_DERIVADAS.tiempos_examen].sort());
  });
  it('una fila por pregunta, en el orden de la actividad, con el tiempo por categoría', () => {
    expect(der.tiempos_examen.map((f) => f.exercise_id)).toEqual(['q1', 'q2']);
    expect(fila('q1')).toMatchObject({ posicion: 1, trabajo_s: 70, visitas: 2, tiempo_observable_s: 70, estado_tiempo: 'valido', prorroga_s: 300 });
    expect(fila('q2')).toMatchObject({ trabajo_s: 50, pausa_s: 30, oculta_s: 10, desconocido_s: 40, discrepancias_intento: 1 });
  });
  it('práctica asistida: una fila por intento y ejercicio con el proceso completo', () => {
    const pasos = [
      { id: 1, attempt_id: A, exercise_id: 'q1', user_id: U, fase: 'inicial', version: 1, answer: { text: '0.049 m' }, declaracion: 'autonomo', no_se: false, status: 'incorrect', credit: 0, created_at: t(0) },
      { id: 2, attempt_id: A, exercise_id: 'q1', user_id: U, fase: 'corregida', version: 1, answer: { text: '0.098 cm' }, status: 'incorrect', credit: 0, created_at: t(60) },
      { id: 3, attempt_id: A, exercise_id: 'q1', user_id: U, fase: 'corregida', version: 2, answer: { text: '0.098 m' }, procedimiento: 'energía', status: 'correct', credit: 1, created_at: t(90) },
      { id: 4, attempt_id: A, exercise_id: 'q1', user_id: U, fase: 'reflexion', version: 1, reflexion: { error: 'Confundí equilibrio y retorno' }, fuentes: ['ia', 'libro'], created_at: t(120) },
      { id: 5, attempt_id: A, exercise_id: 'q2', user_id: U, fase: 'inicial', version: 1, no_se: true, declaracion: 'no_pudo', status: 'incorrect', credit: 0, created_at: t(130) },
    ];
    const der2 = calcularDerivados({ ...d, ejercicios: [{ id: 'q1', format: 'numeric' }, { id: 'q2', format: 'numeric' }], asistida_pasos: pasos });
    const f1 = der2.aprendizaje_asistido.find((f) => f.exercise_id === 'q1')!, f2 = der2.aprendizaje_asistido.find((f) => f.exercise_id === 'q2')!;
    expect(Object.keys(f1).sort()).toEqual([...COLUMNAS_DERIVADAS.aprendizaje_asistido].sort());
    expect(f1).toMatchObject({ inicial_respuesta: '0.049 m', declaracion: 'autonomo', inicial_estado: 'incorrect', correcciones: 2, final_respuesta: '0.098 m',
      final_estado: 'correct', cambio: 'valor', procedimiento_cambio: true, reflexion_presentada: true, fuentes: 'ia,libro', fase_alcanzada: 'reflexion', activity_id: 'act' });
    expect(f2).toMatchObject({ inicial_no_se: true, inicial_respuesta: null, declaracion: 'no_pudo', final_respuesta: null, cambio: null, fase_alcanzada: 'inicial' });
  });
  it('sin tramos de examen no hay filas (no se inventan)', () => {
    expect(calcularDerivados({ intentos: d.intentos }).tiempos_examen).toEqual([]);
  });
});
