/**
 * Integración del motor de examen: sesiones simuladas de principio a fin con todas las piezas juntas (motor de tramos,
 * guardado con red que falla, servidor que impone revisiones, conciliación y reconstrucción del tiempo por pregunta).
 * Propiedades que deben cumplirse en TODAS las sesiones aleatorias.
 */
import { describe, expect, it } from 'vitest';
import {
  abrir, CONFIG_EXAMEN_POR_DEFECTO, crearMotor, entregar, inactividad, irA, latido, pausar, reanudar, visibilidad, type ConfigExamen, type EstadoMotor,
} from '../src/lib/examen/motor';
import { AlmacenMemoria, ColaGuardado, type Pendiente } from '../src/lib/examen/guardado';
import { conciliar, intervalosDePregunta, resumirTiempos, type EventoServidor } from '../src/lib/examen/intervalos';
import { reconstruirTiempo } from '../src/lib/lieia/d6';
import { crearAzar } from '../src/lib/lieia/azar';

const C: ConfigExamen = { ...CONFIG_EXAMEN_POR_DEFECTO, pausas: { permitidas: true, max_numero: 2, max_total_s: 600, detienen_reloj: true } };
const PREG = ['q1', 'q2', 'q3', 'q4', 'q5'];

interface Verdad { trabajo: Record<string, number>; eventos: EventoServidor[]; t: number }

/** Simula una sesión: devuelve el motor final y lo que «de verdad» pasó (para comparar). */
function sesion(semilla: number) {
  const az = crearAzar(semilla);
  let t = 1_000_000;
  const v: Verdad = { trabajo: Object.fromEntries(PREG.map((q) => [q, 0])), eventos: [{ t, tipo: 'apertura', exercise_id: 'q1' }], t };
  let m: EstadoMotor = abrir(crearMotor(PREG), t);
  const avanzar = (ms: number, trabaja: boolean) => { if (trabaja && m.activa && m.fase === 'trabajando' && m.visible && !m.inactivo) v.trabajo[m.activa] += ms; t += ms; };
  for (let paso = 0; paso < 40; paso++) {
    const r = az.u();
    if (r < 0.35) avanzar(Math.round(5000 + az.u() * 60000), true);
    else if (r < 0.55) { const q = az.elegir(PREG); const x = irA(m, t, q, C); if (x.ok && x.estado !== m) { m = x.estado; v.eventos.push({ t, tipo: 'ir_a', exercise_id: q }); } }
    else if (r < 0.65) { m = visibilidad(m, t, false); avanzar(Math.round(2000 + az.u() * 30000), false); m = visibilidad(m, t, true); }
    else if (r < 0.72) { m = inactividad(m, t, true); const d = Math.round(1000 + az.u() * 20000); t += d; if (m.activa) v.trabajo[m.activa] += 0; m = inactividad(m, t, false); }
    else if (r < 0.8 && m.fase === 'trabajando') {
      const x = pausar(m, t, C);
      if (x.ok) { m = x.estado; v.eventos.push({ t, tipo: 'pausa' }); t += Math.round(10000 + az.u() * 60000); const y = reanudar(m, t); m = y.estado; v.eventos.push({ t, tipo: 'reanudacion' }); }
    } else if (r < 0.86) {
      // la aplicación se cierra sin despedirse: último latido y regreso más tarde
      m = latido(m, t); t += Math.round(20000 + az.u() * 120000);
      m = abrir(m, t, { incertidumbre_ms: 5000 }); v.eventos.push({ t, tipo: 'apertura', exercise_id: m.activa });
    } else { m = latido(m, t); avanzar(Math.round(1000 + az.u() * 5000), true); }
  }
  m = entregar(m, t);
  v.eventos.push({ t, tipo: 'entrega' });
  v.t = t;
  return { m, v, inicio: 1_000_000 };
}

describe('Integración del motor de examen (50 sesiones aleatorias)', () => {
  const sesiones = Array.from({ length: 50 }, (_, k) => sesion(1000 + k));

  it('los tramos cubren todo el intento sin huecos ni solapes', () => {
    for (const { m, v, inicio } of sesiones) {
      const ts = m.tramos;
      expect(ts[0].inicio).toBe(inicio);
      for (let k = 1; k < ts.length; k++) expect(ts[k].inicio).toBe(ts[k - 1].fin);
      expect(ts[ts.length - 1].fin).toBe(v.t);
    }
  });

  it('el diario coherente concilia sin discrepancias con los eventos del servidor', () => {
    for (const { m, v } of sesiones) {
      const d = conciliar(m.tramos, v.eventos).discrepancias;
      expect(d.map((x) => `${x.motivo} ${JSON.stringify(x.tramo)} eventos=${JSON.stringify(v.eventos.filter((e) => Math.abs(e.t - x.tramo.inicio) < 200000))}`)).toEqual([]);
    }
  });

  it('el trabajo por pregunta coincide con el trabajo real y LIEIA lo reconstruye igual', () => {
    for (const { m, v } of sesiones) {
      const r = resumirTiempos(m.tramos);
      for (const q of PREG) {
        const real = v.trabajo[q];
        const medido = (r.por_pregunta[q]?.trabajo ?? 0);
        // la inactividad simulada se registra aparte; el trabajo medido no la incluye
        expect(medido).toBe(real);
        const rec = reconstruirTiempo(intervalosDePregunta(m.tramos, q));
        if (rec.estado === 'valido') expect(rec.trabajo * 1000).toBeCloseTo(real + (r.por_pregunta[q]?.inactividad ?? 0), 3);
      }
    }
  });

  it('una visita corta es válida, pero trabajo en una pregunta que el servidor no tenía activa se marca', () => {
    const ev: EventoServidor[] = [{ t: 0, tipo: 'apertura', exercise_id: 'q1' }, { t: 60_000, tipo: 'ir_a', exercise_id: 'q2' }, { t: 63_000, tipo: 'ir_a', exercise_id: 'q3' }, { t: 120_000, tipo: 'entrega' }];
    const corta = conciliar([{ inicio: 60_000, fin: 63_000, tipo: 'trabajo', exercise_id: 'q2' }], ev);
    expect(corta.discrepancias).toEqual([]);
    const ajena = conciliar([{ inicio: 80_000, fin: 110_000, tipo: 'trabajo', exercise_id: 'q1' }], ev);
    expect(ajena.discrepancias.map((d) => d.motivo)).toEqual(['la pregunta no estaba activa según el servidor']);
  });

  it('las pausas se registran como pausa y nunca como trabajo', () => {
    for (const { m, v } of sesiones) {
      const pausas: [number, number][] = [];
      v.eventos.forEach((e, k) => { if (e.tipo === 'pausa') pausas.push([e.t, v.eventos[k + 1].t]); });
      for (const tr of m.tramos.filter((x) => x.tipo === 'trabajo')) for (const [a, b] of pausas) expect(tr.fin <= a || tr.inicio >= b).toBe(true);
    }
  });
});

describe('Integración del guardado: red que falla y servidor con revisiones', () => {
  it('al final el servidor tiene la última respuesta de cada pregunta, sin perder ni retroceder ninguna', async () => {
    for (let semilla = 0; semilla < 20; semilla++) {
      const az = crearAzar(500 + semilla);
      const servidor = new Map<string, { rev: number; answer: unknown }>();
      let reloj = 1000;
      const enviar = async (p: Pendiente) => {
        if (az.bernoulli(0.35)) throw new Error('red');                       // 35 % de fallos
        const prev = servidor.get(p.exercise_id);
        if (!prev || p.rev > prev.rev) { servidor.set(p.exercise_id, { rev: p.rev, answer: p.answer }); return { rev: p.rev, aplicada: true }; }
        return { rev: prev.rev, aplicada: false };
      };
      const almacen = new AlmacenMemoria();
      let cola = new ColaGuardado('k', enviar, almacen, () => reloj, 1e9);
      const ultima = new Map<string, unknown>();
      for (let k = 0; k < 60; k++) {
        const q = az.elegir(PREG), a = { text: `${q}-${k}` };
        reloj += 1 + Math.floor(az.u() * 3);
        cola.cambiar(q, a); ultima.set(q, a);
        if (az.bernoulli(0.4)) await cola.vaciar();
        if (az.bernoulli(0.05)) { cola.detener(); cola = new ColaGuardado('k', enviar, almacen, () => reloj, 1e9); }   // recarga de la página
      }
      for (let i = 0; i < 50 && cola.hayPendientes(); i++) await cola.vaciar();
      cola.detener();
      expect(cola.hayPendientes()).toBe(false);
      for (const [q, a] of ultima) expect(servidor.get(q)?.answer).toEqual(a);
    }
  });
});
