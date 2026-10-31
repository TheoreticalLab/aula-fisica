import { describe, expect, it } from 'vitest';
import {
  admitir, buscarQuorum, centro, compararRadio, distanciaM, franjaActiva, instanteLocal, mensajeQuorum, PARAMETROS_QUORUM, proximaFranja, type Candidato,
} from '../src/lib/quorum';
import { mulberry32 } from '../src/lib/fisica/variantes';

// en esta latitud, 1 m ≈ 9.0e-6° de latitud y ≈ 9.5e-6° de longitud
const O = { lat: 18.4861, lng: -69.9312 };
const N = (m: number) => m / 111_195;                       // grados de latitud por metro
const E = (m: number) => m / (111_195 * Math.cos((O.lat * Math.PI) / 180));
const en = (norte: number, este: number, precision = 10) => ({ lat: O.lat + N(norte), lng: O.lng + E(este), precision });
const cand = (id: string, norte: number, este: number, precision = 10, dispositivo = `d-${id}`): Candidato => ({ id, dispositivo, ...en(norte, este, precision) });

describe('distancia y comparación con incertidumbre', () => {
  it('semiverseno: metros correctos a esta escala', () => {
    expect(distanciaM(en(0, 0), en(30, 40))).toBeCloseTo(50, 0);
  });
  it('compatible, incompatible e inconclusa', () => {
    expect(compararRadio(en(0, 0, 10), en(45, 0, 10), 50)).toBe('compatible');
    expect(compararRadio(en(0, 0, 10), en(80, 0, 10), 50)).toBe('incompatible');   // 80 − 20 = 60 > 50
    expect(compararRadio(en(0, 0, 10), en(65, 0, 10), 50)).toBe('inconclusa');     // 65 − 20 = 45 ≤ 50
  });
});

describe('formación del quórum', () => {
  it('Caso 1 · dos estudiantes próximos: no hay quórum', () => {
    expect(buscarQuorum(cand('A', 0, 0), [cand('B', 10, 0)])).toBeNull();
  });
  it('Caso 2 · tres estudiantes próximos: quórum', () => {
    const g = buscarQuorum(cand('A', 0, 0), [cand('B', 20, 0), cand('C', 0, 25)]);
    expect(g?.map((x) => x.id).sort()).toEqual(['A', 'B', 'C']);
  });
  it('Caso 3 · tres estudiantes separados (cada par a más de 50 m): no hay quórum', () => {
    expect(buscarQuorum(cand('A', 0, 0), [cand('B', 60, 0), cand('C', 0, 60)])).toBeNull();
    // A cerca de B y de C, pero B y C a 70 m entre sí: el máximo de las distancias supera R_q
    expect(buscarQuorum(cand('A', 0, 0), [cand('B', 35, 0), cand('C', -35, 0)])).toBeNull();
  });
  it('mediciones imprecisas no cuentan; tres cuentas en un mismo dispositivo no forman quórum', () => {
    expect(buscarQuorum(cand('A', 0, 0), [cand('B', 10, 0, 80), cand('C', 0, 10)])).toBeNull();
    expect(buscarQuorum(cand('A', 0, 0, 10, 'x'), [cand('B', 10, 0, 10, 'x'), cand('C', 0, 10, 10, 'x')])).toBeNull();
  });
  it('con más candidatos encuentra un grupo válido y nunca uno inválido (500 casos aleatorios)', () => {
    const rnd = mulberry32(9);
    for (let k = 0; k < 500; k++) {
      const yo = cand('Y', 0, 0);
      const otros = Array.from({ length: 1 + Math.floor(rnd() * 8) }, (_, i) => cand(`c${i}`, (rnd() - 0.5) * 200, (rnd() - 0.5) * 200, 5 + rnd() * 50));
      const g = buscarQuorum(yo, otros);
      if (g) {
        expect(g).toHaveLength(3);
        expect(g[0].id).toBe('Y');
        for (const a of g) for (const b of g) expect(distanciaM(a, b)).toBeLessThanOrEqual(PARAMETROS_QUORUM.radioQuorumM + 1e-9);
        expect(new Set(g.map((x) => x.dispositivo)).size).toBe(3);
      }
    }
  });
  it('centro inicial: media del grupo', () => {
    const c = centro([en(0, 0), en(30, 0), en(0, 30)]);
    expect(distanciaM(c, en(10, 10))).toBeLessThan(0.01);
  });
});

describe('validación progresiva', () => {
  const ahora = 1_800_000_000_000;
  const c0 = en(0, 0, 10);
  const ref = (id: string, n: number, e: number, vigente = true) => ({ id, ...en(n, e, 10), vigenteHasta: vigente ? ahora + 60_000 : ahora - 1 });
  const refs = [ref('A', 0, 0), ref('B', 15, 0), ref('C', 0, 15)];
  it('Caso 4 · un cuarto estudiante cerca de los admitidos y dentro de la zona: presente', () => {
    expect(admitir(en(40, 10, 8), c0, refs, ahora)).toMatchObject({ resultado: 'presente', referencia: 'B' });
  });
  it('Caso 5 · propagación: cerca de un admitido pero a más de 100 m de C₀: NO', () => {
    const lejano = [...refs, ref('D', 90, 0), ref('E', 95, 0)];               // admitidos dentro de la zona…
    const r = admitir(en(140, 0, 5), c0, lejano, ahora);                      // …a 45 m de E, pero a 140 m de C₀
    expect(r).toMatchObject({ resultado: 'fuera_de_zona', motivo: 'lejos_del_centro' });
  });
  it('una cadena de admitidos a 80 m no desplaza la zona: siempre d(P, C₀) ≤ R_a', () => {
    let validos = [...refs];
    let ultimo = 0;
    for (let paso = 1; paso <= 6; paso++) {
      const norte = paso * 45;
      const r = admitir(en(norte, 0, 5), c0, validos, ahora);
      if (r.resultado === 'presente') { validos = [...validos, ref(`P${paso}`, norte, 0)]; ultimo = norte; }
    }
    expect(ultimo).toBeLessThanOrEqual(100);
  });
  it('Caso 6 · precisión insuficiente: inconclusa (no ausente)', () => {
    expect(admitir(en(10, 0, 120), c0, refs, ahora)).toEqual({ resultado: 'inconclusa', motivo: 'precision' });
  });
  it('Caso 11 · referencia caducada no autoriza', () => {
    const soloViejas = [ref('A', 0, 0, false), ref('B', 15, 0, false)];
    expect(admitir(en(10, 0, 8), c0, soloViejas, ahora)).toEqual({ resultado: 'inconclusa', motivo: 'sin_referencias_vigentes' });
    // una vieja muy cerca y una vigente lejos: decide solo la vigente
    expect(admitir(en(80, 0, 5), c0, [ref('A', 75, 0, false), ref('B', 0, 0)], ahora).resultado).not.toBe('presente');
  });
  it('lejos de todos los admitidos (dentro de la zona): fuera de zona; en el borde incierto: inconclusa', () => {
    const solo = [ref('A', -40, 0)];
    expect(admitir(en(60, 0, 5), c0, solo, ahora)).toMatchObject({ resultado: 'fuera_de_zona', motivo: 'lejos_de_los_admitidos' });
    expect(admitir(en(105, 0, 8), c0, [ref('Z', 95, 0)], ahora)).toEqual({ resultado: 'inconclusa', motivo: 'zona_incierta' });
  });
});

describe('mensajes al estudiante', () => {
  it('los textos de la especificación', () => {
    expect(mensajeQuorum({ estado: 'esperando', participantes: 1, quorum: 3 }).texto).toMatch(/^Esperando compañeros: 1\/3/);
    expect(mensajeQuorum({ estado: 'esperando', participantes: 2, quorum: 3 }).texto).toMatch(/^Esperando compañeros: 2\/3/);
    expect(mensajeQuorum({ estado: 'activada' }).texto).toContain('Se ha alcanzado el quórum de proximidad');
    expect(mensajeQuorum({ estado: 'presente' }).texto).toBe('✅ Presente registrado correctamente.');
    expect(mensajeQuorum({ estado: 'fuera_de_zona' }).texto).toBe('No se ha podido confirmar tu presencia dentro de la zona habilitada.');
    expect(mensajeQuorum({ estado: 'inconclusa', motivo: 'precision' }).texto).toBe('Tu ubicación no tiene precisión suficiente. Intenta nuevamente o solicita validación al docente.');
    expect(mensajeQuorum({ estado: 'fuera_de_horario', proxima: new Date(Date.UTC(2026, 10, 2, 20, 0)).toISOString() }).texto).toMatch(/4:00/);
  });
  it('una medición inconclusa nunca se presenta como ausencia', () => {
    for (const motivo of ['precision', 'sin_referencias_vigentes', 'zona_incierta', 'proximidad_incierta']) {
      const m = mensajeQuorum({ estado: 'inconclusa', motivo });
      expect(m.tono).toBe('warn');
      expect(m.texto).not.toMatch(/ausente/i);
      expect(m.texto).toMatch(/intenta|docente/i);
    }
  });
});

describe('horario en America/Santo_Domingo', () => {
  // lunes 2 de noviembre de 2026, 16:00 en Santo Domingo = 20:00 UTC (UTC−4, sin horario de verano)
  const lunes16 = Date.UTC(2026, 10, 2, 20, 0);
  const horarios = [{ diaSemana: 1, hora: '16:00' }];
  it('hora local → instante', () => expect(instanteLocal(2026, 11, 2, 16, 0)).toBe(lunes16));
  it('Caso 9 · antes de la hora y después de la ventana: sin franja; dentro: la franja', () => {
    expect(franjaActiva(horarios, lunes16 - 60_000)).toBeNull();
    expect(franjaActiva(horarios, lunes16)).toBe(lunes16);
    expect(franjaActiva(horarios, lunes16 + 19 * 60_000)).toBe(lunes16);
    expect(franjaActiva(horarios, lunes16 + 20 * 60_000)).toBeNull();
    expect(franjaActiva(horarios, lunes16 + 7 * 86_400_000 + 60_000)).toBe(lunes16 + 7 * 86_400_000);
  });
  it('clase nocturna cuya ventana cruza la medianoche', () => {
    const domingo2350 = instanteLocal(2026, 11, 1, 23, 50);
    expect(franjaActiva([{ diaSemana: 7, hora: '23:50' }], domingo2350 + 15 * 60_000)).toBe(domingo2350);
  });
  it('próxima franja', () => {
    expect(proximaFranja(horarios, lunes16 - 3600_000)).toBe(lunes16);
    expect(proximaFranja(horarios, lunes16 + 60_000)).toBe(lunes16 + 7 * 86_400_000);
  });
});
