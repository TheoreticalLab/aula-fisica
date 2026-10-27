import { describe, expect, it } from 'vitest';
import { agrupar, combinarTodos, edadSenal, estadoSync, filtrar, haceTexto, unicos, type EnLinea } from '../orbe-control/src/logica';

const AHORA = new Date('2026-10-27T15:00:00Z').getTime();
const e = (id: string, nombre: string, clase: string, hace: number, extra: Partial<EnLinea> = {}): EnLinea => ({
  user_id: id, full_name: nombre, student_code: `M-${id}`, class_id: clase, class_name: `Sección ${clase}`, course_title: 'Física General I',
  last_seen: new Date(AHORA - hace * 1000).toISOString(), conexiones: 1, visible: true, section: null, lesson_title: null, activity_title: null, ...extra,
});

describe('Orbe Control', () => {
  it('la edad de la señal usa el reloj del servidor, no el del teléfono', () => {
    // teléfono atrasado 60 s: offset +60 000 ms
    expect(edadSenal(new Date(AHORA).toISOString(), 60_000, AHORA - 60_000)).toBe(0);
    expect(haceTexto(12)).toBe('hace 12 segundos');
    expect(haceTexto(130)).toBe('hace 2 minutos');
  });
  it('filtra por sección y por nombre o matrícula, sin acentos; quita las señales caducadas', () => {
    const l = [e('1', 'Juan Pérez', 'A', 10), e('2', 'María Rodríguez', 'A', 20), e('3', 'Pedro Martínez', 'B', 8), e('4', 'Caducado', 'A', 200)];
    expect(filtrar(l, '', '', 0, AHORA).map((x) => x.user_id)).toEqual(['1', '2', '3']);
    expect(filtrar(l, 'A', '', 0, AHORA).map((x) => x.user_id)).toEqual(['1', '2']);
    expect(filtrar(l, '', 'perez', 0, AHORA).map((x) => x.user_id)).toEqual(['1']);
    expect(filtrar(l, '', 'm-3', 0, AHORA).map((x) => x.user_id)).toEqual(['3']);
  });
  it('cuenta estudiantes únicos y agrupa por asignatura y sección', () => {
    const l = [e('1', 'Juan', 'A', 1), e('1', 'Juan', 'B', 1), e('2', 'Ana', 'A', 1)];
    expect(unicos(l)).toBe(2);
    const g = agrupar(l);
    expect(g.map((x) => x.titulo)).toEqual(['Física General I — Sección A', 'Física General I — Sección B']);
    expect(g[0].alumnos.map((a) => a.full_name)).toEqual(['Ana', 'Juan']);
  });
  it('vista «Todos»: incluye a los desconectados, marca a los conectados y respeta filtro y búsqueda', () => {
    const alumnos = [
      { user_id: '1', full_name: 'Juan Pérez', student_code: 'M-1', class_id: 'A', class_name: 'Sección A', course_title: 'Física General I' },
      { user_id: '2', full_name: 'Ana Gómez', student_code: 'M-2', class_id: 'A', class_name: 'Sección A', course_title: 'Física General I' },
      { user_id: '3', full_name: 'Luis Díaz', student_code: 'M-3', class_id: 'B', class_name: 'Sección B', course_title: 'Física General I' },
    ];
    const vivos = [e('1', 'Juan Pérez', 'A', 10), e('3', 'Luis Díaz', 'B', 300)]; // Luis: señal caducada
    const ultimas = new Map([['2', '2026-10-26T10:00:00Z'], ['3', new Date(AHORA - 300_000).toISOString()]]);
    const t = combinarTodos(alumnos, vivos, ultimas, '', '', 0, AHORA);
    expect(t.map((x) => [x.user_id, x.online])).toEqual([['1', true], ['2', false], ['3', false]]);
    expect(t[1].last_seen).toBe('2026-10-26T10:00:00Z');
    expect(combinarTodos(alumnos, vivos, ultimas, 'A', '', 0, AHORA)).toHaveLength(2);
    expect(combinarTodos(alumnos, vivos, ultimas, '', 'gomez', 0, AHORA).map((x) => x.user_id)).toEqual(['2']);
  });
  it('no presenta datos viejos como actuales', () => {
    expect(estadoSync(AHORA - 5_000, true, AHORA)).toBe('conectado');
    expect(estadoSync(AHORA - 45_000, true, AHORA)).toBe('reconectando');
    expect(estadoSync(AHORA - 1_000, false, AHORA)).toBe('reconectando');
    expect(estadoSync(null, true, AHORA)).toBe('reconectando');
  });
});
