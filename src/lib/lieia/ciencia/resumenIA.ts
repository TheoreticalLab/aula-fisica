/**
 * Resumen de un examen para la interpretación con IA: SOLO cifras agregadas por pregunta y los enunciados.
 * No se toma nada de la matriz de respuestas (seudónimos, respuestas individuales, tiempos). El servidor vuelve a
 * filtrarlo por lista blanca (supabase/functions/orbe-ia/lieia.ts) antes de enviarlo al modelo.
 */
import type { Factorial } from './factorial';
import type { Informe } from './informe';

export function resumenParaIA(inf: Informe, factorial: Factorial | null) {
  return {
    n: inf.examen?.n ?? 0,
    kr20: inf.examen?.confiabilidad.ok ? inf.examen.confiabilidad.valor.kr20 : null,
    factores: factorial?.ok ? factorial.m : null,
    unidimensional: factorial?.ok ? factorial.unidimensional.esencial : null,
    items: inf.preguntas.map((p) => {
      const e = inf.empirico.get(p.id);
      const a = inf.analisis.find((x) => x.id === p.id);
      return {
        posicion: p.posicion, enunciado: p.prompt.slice(0, 400), formato: p.format, conceptos: p.concepts.slice(0, 6),
        dificultad: a?.dificultadAPriori.valor ?? p.difficulty,
        n: e?.calificadas ?? 0,
        p: e?.p.ok ? e.p.valor.p : null,
        disc: e?.discriminacion.ok ? e.discriminacion.valor : null,
        omision: e && e.expuestos > 0 ? e.omisiones / e.expuestos : null,
      };
    }),
  };
}
