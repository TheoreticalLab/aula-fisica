/**
 * Vista previa del profesor: simula en el navegador lo que el servidor haría con un estudiante, con el MISMO
 * motor de calificación y las mismas reglas (intentos, penalización por pistas y reintentos, cuándo se cierra un
 * ejercicio y cuándo se muestra la solución). No guarda nada. Las claves las lee el profesor (RLS: can_view_keys).
 */
import { grade } from '@calif/calificar.ts';
import type { AccionesEjercicio, Activity, CheckResponse, ExerciseKeyRow, ReadingState, ResponseStatus, Solution, StudentAnswer } from '@/api/tipos';

interface EstadoItem {
  answer: StudentAnswer;
  status: ResponseStatus;
  credit: number | null;
  tries: number;
  hintsUsed: number;
  revealed: boolean;
}

export interface Simulador extends AccionesEjercicio {
  /** Califica todo lo respondido, como al entregar. */
  entregar: (puntos: Map<string, number>) => { score: number; max: number; porEjercicio: Map<string, { status: ResponseStatus; credit: number; messages: string[] }> };
  respuesta: (exerciseId: string) => StudentAnswer | undefined;
}

type ActSim = Pick<Activity, 'mode' | 'reveal_policy' | 'hints_enabled' | 'max_tries_per_item'>;

export function crearSimulador(act: ActSim, claves: Map<string, ExerciseKeyRow>, opciones: Map<string, number>): Simulador {
  const estado = new Map<string, EstadoItem>();
  const maxTries = act.max_tries_per_item ?? 3;
  const de = (id: string): EstadoItem => {
    let e = estado.get(id);
    if (!e) {
      e = { answer: {}, status: 'draft', credit: null, tries: 0, hintsUsed: 0, revealed: false };
      estado.set(id, e);
    }
    return e;
  };
  const cerrado = (e: EstadoItem) => ['correct', 'revealed', 'pending_review'].includes(e.status) || e.revealed || e.tries >= maxTries;
  const solucion = (id: string): Solution => {
    const k = claves.get(id);
    if (!k) throw new Error('Este ejercicio no tiene clave de respuesta.');
    return { answer: k.answer, explanation: k.explanation };
  };

  return {
    async comprobar(_att, id, answer): Promise<CheckResponse> {
      if (act.mode !== 'practice' || act.reveal_policy !== 'immediate') throw new Error('Esta actividad no tiene retroalimentación inmediata');
      const k = claves.get(id);
      if (!k) throw new Error('Este ejercicio no tiene clave de respuesta.');
      const e = de(id);
      if (cerrado(e)) throw new Error('Este ejercicio ya está cerrado');
      const result = grade(k.answer, answer, opciones.get(id));
      if (result.status === 'invalid') return { result, recorded: false };
      // misma penalización que svc_record_check: mínimo 40 % si al final acierta
      const factor = Math.max(0.4, 1 - 0.2 * e.tries - 0.1 * e.hintsUsed);
      if (result.status === 'correct') {
        e.status = 'correct';
        e.credit = Math.max(e.credit ?? 0, factor);
      } else if (result.status === 'partial') {
        e.status = 'partial';
        e.credit = Math.max(e.credit ?? 0, result.credit * factor);
      } else if (result.status === 'pending_review') {
        e.status = 'pending_review';
        e.credit = null;
      } else {
        e.status = e.status === 'partial' ? 'partial' : 'incorrect';
        e.credit = e.credit ?? 0;
      }
      e.tries += 1;
      e.answer = answer;
      const locked = cerrado(e);
      return {
        result,
        recorded: true,
        state: { status: e.status, credit: e.credit, tries: e.tries, max_tries: maxTries, locked, solution: locked ? solucion(id) : null },
      };
    },
    async pista(_att, id) {
      if (act.mode !== 'practice') throw new Error('Las pistas no están disponibles en evaluaciones');
      if (!act.hints_enabled) throw new Error('El profesor desactivó las pistas en esta actividad');
      const hints = claves.get(id)?.hints ?? [];
      const e = de(id);
      if (e.hintsUsed >= hints.length) return { hint: null, index: e.hintsUsed, total: hints.length };
      e.hintsUsed += 1;
      return { hint: hints[e.hintsUsed - 1], index: e.hintsUsed, total: hints.length };
    },
    async verSolucion(_att, id) {
      if (act.mode !== 'practice' || act.reveal_policy !== 'immediate') throw new Error('La solución no está disponible en esta actividad');
      const e = de(id);
      e.revealed = true;
      if (e.status !== 'correct' && e.status !== 'partial') e.status = 'revealed';
      return solucion(id);
    },
    async guardar(_att, id, answer) {
      de(id).answer = answer;
    },
    async refuerzo() {
      return []; // en la vista previa no se ofrecen problemas de otras lecciones
    },
    respuesta: (id) => estado.get(id)?.answer,
    entregar(puntos) {
      let score = 0;
      let max = 0;
      const porEjercicio = new Map<string, { status: ResponseStatus; credit: number; messages: string[] }>();
      for (const [id, pts] of puntos) {
        max += pts;
        const k = claves.get(id);
        const e = de(id);
        if (act.mode === 'practice' && e.status !== 'draft') {
          // en práctica cuenta lo ya comprobado (con su penalización)
          const credit = e.credit ?? 0;
          score += credit * pts;
          porEjercicio.set(id, { status: e.status, credit, messages: [] });
          continue;
        }
        const r = k ? grade(k.answer, e.answer, opciones.get(id)) : null;
        const credit = r && r.status !== 'invalid' && r.status !== 'pending_review' ? r.credit : 0;
        const status: ResponseStatus = !r || r.status === 'invalid' ? 'incorrect' : (r.status as ResponseStatus);
        score += credit * pts;
        porEjercicio.set(id, { status, credit, messages: r?.messages ?? [] });
      }
      return { score: Math.round(score * 100) / 100, max, porEjercicio };
    },
  };
}

/** Lectura cronometrada simulada con las mismas reglas que reading_beat (solo suma tramos de ≤ 25 s). */
export function lecturaSimulada(minSegundos: number, ahora: () => number = Date.now) {
  let leidos = 0;
  let ultimo: number | null = null;
  let pausas = 0;
  const estado = (): ReadingState => ({ seconds_read: Math.floor(leidos), min_seconds: minSegundos, completed: leidos >= minSegundos, pauses: pausas });
  return {
    estado: async () => estado(),
    latido: async (visible: boolean): Promise<ReadingState> => {
      if (leidos < minSegundos) {
        const t = ahora();
        if (ultimo !== null) {
          const gap = (t - ultimo) / 1000;
          if (gap > 0 && gap <= 25) leidos = Math.min(minSegundos, leidos + Math.floor(gap));
          if (!visible) pausas += 1;
        }
        ultimo = visible ? t : null;
      }
      return estado();
    },
    completar: () => {
      leidos = minSegundos;
    },
  };
}
