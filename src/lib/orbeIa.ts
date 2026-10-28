/**
 * Orbe IA · reglas del navegador (lógica pura, probada en tests/orbe-ia.test.ts). Imitan las del servidor para no
 * preguntar en vano; las que cuentan de verdad (intervalo, actividad, evaluaciones, presupuesto) se aplican en
 * orbe_ia_next y en la Edge Function.
 */
import type { ContextoRuta } from './tiempo';

export const SECCIONES_ORBE = new Set(['teoria', 'formulas', 'ejemplos', 'simulacion', 'comprension', 'practica']);
export const EVENTOS_ORBE = ['ejercicio_correcto', 'leccion_terminada', 'actividad_tras_intentos', 'fin_sesion'] as const;
export type EventoOrbe = (typeof EVENTOS_ORBE)[number];

/** Segundos sin teclear antes de considerar que el estudiante ya no está escribiendo. */
export const PAUSA_ESCRITURA_S = 15;

export interface RespuestaOrbe {
  activo: boolean;
  motivo?: string;
  espera?: number;
  intervalo_min?: number;
  reponer?: boolean;
  apartado?: string | null;
  chiste?: { id: string; texto: string };
}

export interface EstadoCliente {
  ruta: ContextoRuta | null;
  visible: boolean;
  escribiendo: boolean;
  otroEmergente: boolean;
  mostrando: boolean;
  ahora: number;
  proximo: number;
  apagadoHasta: number;
}

/** ¿Conviene preguntar ahora al servidor? Solo en lecciones (nunca en actividades ni intentos: ahí están las evaluaciones). */
export function debePreguntar(e: EstadoCliente): { ok: true; leccion: string; seccion: string } | { ok: false; motivo: string } {
  if (e.ahora < e.apagadoHasta) return { ok: false, motivo: 'apagado' };
  if (!e.ruta || e.ruta.kind !== 'leccion' || !e.ruta.ref) return { ok: false, motivo: 'contexto' };
  if (!SECCIONES_ORBE.has(e.ruta.section)) return { ok: false, motivo: 'contexto' };
  if (!e.visible) return { ok: false, motivo: 'oculta' };
  if (e.mostrando) return { ok: false, motivo: 'mostrando' };
  if (e.otroEmergente) return { ok: false, motivo: 'superposicion' };
  if (e.escribiendo) return { ok: false, motivo: 'escribiendo' };
  if (e.ahora < e.proximo) return { ok: false, motivo: 'espera' };
  return { ok: true, leccion: e.ruta.ref, seccion: e.ruta.section };
}

/** Cuándo volver a preguntar según la respuesta del servidor (y si el módulo está apagado para este estudiante). */
export function siguienteIntento(r: RespuestaOrbe | null, ahora: number): { proximo: number; apagadoHasta: number } {
  const min = 60_000;
  if (!r) return { proximo: ahora + 2 * min, apagadoHasta: 0 };          // error de red
  if (!r.activo) return { proximo: ahora + 30 * min, apagadoHasta: ahora + 30 * min };
  const intervalo = Math.max(1, r.intervalo_min ?? 10) * min;
  if (r.chiste) return { proximo: ahora + intervalo, apagadoHasta: 0 };
  switch (r.motivo) {
    case 'intervalo':
    case 'demasiado_pronto':
      return { proximo: ahora + Math.max(30, r.espera ?? 60) * 1000, apagadoHasta: 0 };
    case 'actividad':
      return { proximo: ahora + min, apagadoHasta: 0 };
    case 'evaluacion':
      return { proximo: ahora + 2 * min, apagadoHasta: 0 };
    case 'sin_chistes':
      return { proximo: ahora + Math.min(intervalo, 5 * min), apagadoHasta: 0 };
    default: // lección no habilitada, contexto, evento no habilitado…
      return { proximo: ahora + 5 * min, apagadoHasta: 0 };
  }
}

/** Misma normalización que orbe_ia_norm() en el servidor. */
export function normalizarApartado(s: string): string {
  return s.replace(/[$*_`#\\{}]/g, '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 160);
}

/**
 * Apartado que el estudiante tiene delante: el último encabezado que ya pasó por el 40 % superior de la ventana.
 * Es solo «visible», no «leído» ni «comprendido».
 */
export function apartadoVisible(encabezados: { texto: string; top: number }[], altoVentana: number): string | null {
  let actual: string | null = null;
  for (const h of encabezados) if (h.top <= altoVentana * 0.4) actual = h.texto;
  const t = actual?.replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, 160) : null;
}

/** ¿Está escribiendo? Foco en un campo de texto o una tecla en los últimos segundos. */
export function escribiendoAhora(activo: { tag: string; tipo?: string | null; editable?: boolean } | null, ultimaTecla: number, ahora: number): boolean {
  if (ahora - ultimaTecla < PAUSA_ESCRITURA_S * 1000) return true;
  if (!activo) return false;
  if (activo.editable) return true;
  const tag = activo.tag.toLowerCase();
  if (tag === 'textarea') return true;
  if (tag === 'input') return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'file', 'color', 'image'].includes((activo.tipo ?? 'text').toLowerCase());
  return false;
}
