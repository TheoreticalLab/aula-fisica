/**
 * Carga del motor (caso S, parte del navegador): reconstruir y analizar muchos intentos grandes. Mide tiempos y
 * comprueba que nada se degrada (invariantes) al crecer el volumen. La parte del servidor (ingesta concurrente en
 * PostgreSQL) está en scripts/ops/carga-telemetria.ts.
 */
import { describe, expect, it } from 'vitest';
import { reconstruir } from '../src/lib/telemetria/v2/reconstruir';
import { analizarIntentos, porPregunta, resumen } from '../src/lib/telemetria/v2/estadistica';
import type { EventoNorm, TipoEvento } from '../src/lib/telemetria/v2/modelo';
import type { PaqueteIntento } from '../src/lib/telemetria/v2/fuente';
import { mulberry32 } from '../src/lib/fisica/variantes';

const T0 = 1_800_000_000_000;
const TIPOS: TipoEvento[] = ['interaccion', 'edicion', 'guardado_confirmado', 'visible', 'oculta', 'inactividad_inicio', 'inactividad_fin', 'pregunta_activada', 'foco_perdido', 'foco_ganado'];

function intentoGrande(semilla: number, eventos: number, preguntas: string[]): EventoNorm[] {
  const rnd = mulberry32(semilla);
  const out: EventoNorm[] = [];
  let tau = 0, sesion = 0, seq = 0;
  out.push({ sesion: `s${sesion}`, seq: ++seq, tipo: 'sesion_inicio', fuente: 'cliente', tau: 0, recibido: T0, datos: { visible: true } });
  for (let i = 0; i < eventos; i++) {
    tau += Math.floor(rnd() * 20_000);
    if (rnd() < 0.005) { sesion++; seq = 0; out.push({ sesion: `s${sesion}`, seq: ++seq, tipo: 'sesion_inicio', fuente: 'cliente', tau: 0, recibido: T0 + tau, datos: { visible: true } }); continue; }
    const tipo = TIPOS[Math.floor(rnd() * TIPOS.length)];
    const base = out.filter((e) => e.sesion === `s${sesion}`)[0];
    const tauSes = tau - ((base.recibido as number) - T0);
    out.push({ sesion: `s${sesion}`, seq: ++seq, tipo, fuente: 'cliente', tau: tauSes, recibido: T0 + tau + Math.floor(rnd() * 40_000),
      pregunta: preguntas[Math.floor(rnd() * preguntas.length)], datos: { inicio_tau: Math.max(0, tauSes - 3000), fin_tau: tauSes, vacia: rnd() < 0.2, desde_tau: Math.max(0, tauSes - 70_000) } });
  }
  return out;
}

describe('carga del motor de reconstrucción', () => {
  const preguntas = Array.from({ length: 20 }, (_, i) => `P${i}`);
  it('200 intentos de 800 eventos y 20 preguntas: invariantes intactos y tiempo acotado', () => {
    const t0 = performance.now();
    let eventos = 0, fallos = 0;
    for (let k = 0; k < 200; k++) {
      const ev = intentoGrande(k, 800, preguntas);
      eventos += ev.length;
      const r = reconstruir({ intento: { inicio: T0, fin: null }, preguntas, eventos: ev, modalidad: 'practica', atribucion: 'control', origen: 'v2' });
      if (r.invariantes.length) fallos++;
    }
    const ms = performance.now() - t0;
    console.log(`[carga] ${eventos} eventos en 200 intentos: ${ms.toFixed(0)} ms (${(ms / 200).toFixed(1)} ms por intento, ${Math.round(eventos / (ms / 1000))} eventos/s)`);
    expect(fallos).toBe(0);
    expect(ms / 200).toBeLessThan(250);            // presupuesto generoso por intento en el navegador del profesor
  }, 120_000);

  it('análisis de una actividad con 400 intentos (el máximo que devuelve el servidor)', () => {
    const items = preguntas.slice(0, 10).map((id, i) => ({ exercise_id: id, slug: id, dificultad: i % 2 ? 'intermedio' : 'basico', formato: 'numeric', titulo: id, conceptos: [`c${i % 3}`] }));
    const datos = Array.from({ length: 400 }, (_, k) => {
      const rnd = mulberry32(1000 + k);
      const v2: PaqueteIntento['v2'] = [];
      let t = 0, seq = 0;
      v2.push({ session_id: `s${k}`, client_seq: ++seq, event_type: 'session_started', question_id: null, t_mono: 0, received_at: new Date(T0).toISOString(), payload: { visible: true } });
      for (const it of items) {
        v2.push({ session_id: `s${k}`, client_seq: ++seq, event_type: 'question_activated', question_id: it.exercise_id, t_mono: t, received_at: new Date(T0 + t).toISOString(), payload: {} });
        for (let j = 0; j < 8; j++) { t += 5000 + Math.floor(rnd() * 20_000); v2.push({ session_id: `s${k}`, client_seq: ++seq, event_type: 'heartbeat', question_id: null, t_mono: t, received_at: new Date(T0 + t).toISOString(), payload: {} }); }
      }
      const paquete: PaqueteIntento = {
        intento: { id: `A${k}`, inicio: new Date(T0).toISOString(), entrega: new Date(T0 + t).toISOString(), estado: 'submitted', modo: 'practice', actividad: 'X', leccion: null, presentacion: null },
        items, v1: [], v2, tramos: [], servidor: [], revisiones: [], evaluaciones: [], respuestas: [], instantanea: null,
      };
      return { estudiante: { user_id: `u${k}`, full_name: `E${k}`, student_code: null }, numero: 1, paquete };
    });
    const t0 = performance.now();
    const a = analizarIntentos(datos);
    const p = porPregunta(a);
    const r = resumen(a);
    const ms = performance.now() - t0;
    console.log(`[carga] análisis de 400 intentos × 10 preguntas: ${ms.toFixed(0)} ms`);
    expect(r.intentos).toBe(400);
    expect(p.every((f) => f.metricas.T_focus.n === 400)).toBe(true);
    expect(ms).toBeLessThan(30_000);
  }, 120_000);
});
