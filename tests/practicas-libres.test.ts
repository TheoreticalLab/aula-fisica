/** Prácticas anteriores · sin envío por correo: reglas del navegador (casos 2, 4, 5, 6, 15, 16, 18 y apoyo de 8 y 11). */
import { describe, expect, it } from 'vitest';
import {
  errorCantidades, estadisticas, etiquetas, fichas, parecidosCorreo, parecidosPropios, porEstudiante, porPractica, puntuacion, similitudNombres,
  sugerirAgrupaciones, totalOficial, VERSION_DECLARACION, type RegistroLibre,
} from '../src/lib/practicasLibres';
import { readFileSync } from 'node:fs';

let n = 0;
const R = (o: Partial<RegistroLibre>): RegistroLibre => ({
  id: `r${String(++n).padStart(3, '0')}`, class_id: 'c', user_id: 'u1', nombre: 'Cinemática', nombre_original: o.nombre ?? 'Cinemática',
  total_declarado: 12, realizados_declarados: 10, total_inicial: 12, realizados_inicial: 10, modalidades: ['cuaderno'], modalidad_otra: null,
  sin_foto: false, explicacion_sin_foto: null, observaciones: null, estado: 'declarado', grupo_elegido: null, grupo_id: null, total_oficial: null,
  total_oficial_grupo: null, realizados_verificados: null, validado_at: null, revision_presencial_at: null, solicitud_tipo: null, solicitud: null,
  solicitud_at: null, respuesta: null, material_no_disponible: false, respondido_at: null, nota_docente: null, declaracion_at: '', created_at: '',
  updated_at: '', falta_foto: false, fotos: [{ id: 'f', posicion: 1, bytes: 1, ancho: 1, alto: 1 }], ...o,
});

describe('cantidades', () => {
  it('caso 1: 9 de 15 es válido', () => expect(errorCantidades(15, 9, 200)).toBeNull());
  it('caso 2: 16 de 15 se rechaza; también negativos, decimales, cero total y el máximo configurable', () => {
    expect(errorCantidades(15, 16, 200)).toMatch(/más ejercicios realizados/);
    expect(errorCantidades(15, -1, 200)).not.toBeNull();
    expect(errorCantidades(15, 2.5, 200)).not.toBeNull();
    expect(errorCantidades(0, 0, 200)).not.toBeNull();
    expect(errorCantidades(201, 3, 200)).toMatch(/200/);
  });
  it('caso 18: cero realizados es válido y se clasifica como «no realizada» (sin pedir foto)', () => {
    expect(errorCantidades(10, 0, 200)).toBeNull();
    expect(etiquetas({ realizados_declarados: 0, sin_foto: false, falta_foto: false })).toEqual(['Práctica declarada como no realizada']);
    expect(etiquetas({ realizados_declarados: 4, sin_foto: true, falta_foto: false })).toEqual(['Sin evidencia fotográfica; pendiente de verificación']);
  });
  it('la versión del texto de responsabilidad coincide con la del servidor', () => {
    const sql = readFileSync('supabase/migrations/20261101000047_practicas_sin_correo.sql', 'utf8');
    expect(sql).toContain(`select '${VERSION_DECLARACION}'::text`);
  });
});

describe('caso 4: estadísticas del estudiante («cumplimiento declarado»)', () => {
  it('cinco prácticas', () => {
    const rs = [R({ total_declarado: 12, realizados_declarados: 10 }), R({ total_declarado: 15, realizados_declarados: 15 }), R({ total_declarado: 10, realizados_declarados: 7 }),
      R({ total_declarado: 18, realizados_declarados: 12 }), R({ total_declarado: 5, realizados_declarados: 0 })];
    const s = estadisticas(rs);
    expect(s).toMatchObject({ practicas: 5, total: 60, realizados: 44 });
    expect(s.cumplimiento).toBeCloseTo(73.333, 2);
  });
  it('sin registros no hay porcentaje (no es un 0 %)', () => expect(estadisticas([]).cumplimiento).toBeNull());
  it('total oficial: el corregido en el registro manda; si no, el de la práctica consolidada; si no, ninguno', () => {
    expect(totalOficial({ total_oficial: 14, total_oficial_grupo: 15 })).toBe(14);
    expect(totalOficial({ total_oficial: null, total_oficial_grupo: 15 })).toBe(15);
    expect(totalOficial({ total_oficial: null, total_oficial_grupo: null })).toBeNull();
  });
});

describe('casos 5 y 6: prácticas parecidas con nombres distintos', () => {
  it('normaliza tildes, plurales, palabras vacías y siglas', () => {
    expect([...fichas('Práctica de las Leyes de Newton')]).toEqual(['ley', 'newton', '#dinamica']);
    expect(fichas('MRUA').has('acelerado')).toBe(true);
    expect(similitudNombres('Movimiento rectilíneo', 'MRUA')).toBeGreaterThanOrEqual(0.5);
    expect(similitudNombres('Segunda ley de Newton', 'Leyes de Newton')).toBeGreaterThanOrEqual(0.7);
    expect(similitudNombres('Vectores', 'Trabajo y energía')).toBe(0);
  });
  it('sugiere agrupar sin modificar ningún registro (no fusiona)', () => {
    const rs = [
      R({ user_id: 'a', nombre: 'Leyes de Newton', total_declarado: 15 }), R({ user_id: 'b', nombre: 'Segunda ley de Newton', total_declarado: 15 }),
      R({ user_id: 'c', nombre: 'Movimiento rectilíneo', total_declarado: 12 }), R({ user_id: 'd', nombre: 'MRUA', total_declarado: 12 }),
      R({ user_id: 'e', nombre: 'Vectores', total_declarado: 8 }),
    ];
    const copia = JSON.stringify(rs);
    const s = sugerirAgrupaciones(rs, []);
    const grupos = s.map((x) => x.nombres.map((y) => y.nombre).sort());
    expect(grupos).toContainEqual(['Leyes de Newton', 'Segunda ley de Newton']);
    expect(grupos).toContainEqual(['MRUA', 'Movimiento rectilíneo']);
    expect(grupos).toContainEqual(['Vectores']);
    expect(JSON.stringify(rs)).toBe(copia);                     // nada cambió: solo es una sugerencia
    expect(s.find((x) => x.nombres.some((y) => y.nombre === 'MRUA'))!.totalHabitual).toBe(12);
  });
  it('totales muy distintos restan; los ya agrupados no se vuelven a sugerir; propone la práctica consolidada más parecida', () => {
    expect(puntuacion({ nombre: 'Fricción', total: 10 }, { nombre: 'Fricción estática', total: 40 })).toBeLessThan(puntuacion({ nombre: 'Fricción', total: 10 }, { nombre: 'Fricción estática', total: 10 }));
    const s = sugerirAgrupaciones([R({ nombre: 'Rozamiento', total_declarado: 10 }), R({ nombre: 'Fricción', grupo_id: 'g1' })],
      [{ id: 'g1', nombre_oficial: 'Fricción y rozamiento', total_oficial: 10 }]);
    expect(s).toHaveLength(1);
    expect(s[0].grupoSugerido?.id).toBe('g1');
  });
  it('es determinista (mismo resultado en cualquier orden)', () => {
    const rs = [R({ nombre: 'Energía' }), R({ nombre: 'Trabajo y energía' }), R({ nombre: 'Choques' }), R({ nombre: 'Colisiones y choques' })];
    const a = sugerirAgrupaciones(rs, []).map((x) => x.clave), b = sugerirAgrupaciones([...rs].reverse(), []).map((x) => x.clave);
    expect(a).toEqual(b);
  });
});

describe('duplicados', () => {
  it('advierte de un registro propio parecido (sin bloquear)', () => {
    const propios = [R({ id: 'x', nombre: 'Leyes de Newton', total_declarado: 15 })];
    expect(parecidosPropios('Ley de Newton', 15, propios).map((r) => r.id)).toEqual(['x']);
    expect(parecidosPropios('Ley de Newton', 15, propios, 'x')).toEqual([]);
    expect(parecidosPropios('Vectores', 8, propios)).toEqual([]);
  });
  it('caso 16: la misma práctica en la modalidad por correo', () => {
    const correo = [{ tema: 'Práctica sobre las leyes de Newton', practica: '', numero: 3 }, { tema: 'Vectores', practica: 'Práctica de vectores', numero: 1 }];
    expect(parecidosCorreo('Leyes de Newton', correo).map((c) => c.numero)).toEqual([3]);
  });
});

describe('vistas del profesor', () => {
  const estudiantes = ['a', 'b', 'c', 'd', 'e'].map((u) => ({ user_id: u, full_name: u.toUpperCase(), student_code: null, group_name: null }));
  it('caso 15: tras consolidar, lista quién NO tiene registro (posible omisión, no incumplimiento)', () => {
    const rs = [R({ user_id: 'a', grupo_id: 'g' }), R({ user_id: 'b', grupo_id: 'g', total_declarado: 11 }), R({ user_id: 'c', grupo_id: 'g' })];
    const p = porPractica([{ id: 'g', nombre_oficial: 'Fricción', total_oficial: 12 }], rs, estudiantes)[0];
    expect(p.estudiantes).toBe(3);
    expect(p.sinRegistro.map((e) => e.user_id)).toEqual(['d', 'e']);
    expect(p.discrepancias).toBe(1);                              // el que declaró 11 de un total oficial 12
    expect(p.totalHabitual).toBe(12);
  });
  it('por estudiante: con foto, sin evidencia, validados y verificados por separado', () => {
    const rs = [R({ user_id: 'a', estado: 'validado', realizados_verificados: 8 }), R({ user_id: 'a', fotos: [], sin_foto: true }), R({ user_id: 'a', realizados_declarados: 0, fotos: [] })];
    const f = porEstudiante(estudiantes, rs)[0];
    expect(f).toMatchObject({ practicas: 3, conFoto: 1, sinEvidencia: 1, validados: 1, pendientes: 2, verificados: 8 });
    expect(porEstudiante(estudiantes, rs)[1].cumplimiento).toBeNull();
  });
});
