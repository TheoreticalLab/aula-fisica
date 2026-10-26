import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analizarTexto, formatoTiempo, segundosSugeridos } from '@/lib/lectura';
import { sqlActividad, tiempoLectura, type ActividadDef } from '../scripts/generar-actividad';

const migracion = readFileSync(new URL('../supabase/migrations/20261025000010_lectura_cronometrada.sql', import.meta.url), 'utf8');

describe('tiempo mínimo de lectura', () => {
  it('cuenta palabras y fórmulas por separado', () => {
    const t = analizarTexto(String.raw`La fuerza neta $\sum F$ vale $m a$.

$$F = ma$$

Fin del texto.`);
    expect(t.formulasLinea).toBe(2);
    expect(t.formulasBloque).toBe(1);
    expect(t.palabras).toBe(7); // La fuerza neta vale · Fin del texto → sin contar las fórmulas
  });

  it('sugiere 130 palabras por minuto, redondeando a medio minuto y con un mínimo de 1 minuto', () => {
    expect(segundosSugeridos('hola')).toBe(60);
    const mil = Array.from({ length: 1300 }, () => 'palabra').join(' ');
    expect(segundosSugeridos(mil)).toBe(600); // 1300 / 130 = 10 min
    expect(segundosSugeridos(mil + '\n\n$$a=b$$')).toBe(630); // +15 s → se redondea a 10:30
  });

  it('formatea minutos y segundos', () => {
    expect(formatoTiempo(75)).toBe('1:15');
    expect(formatoTiempo(690)).toBe('11:30');
    expect(formatoTiempo(-3)).toBe('0:00');
  });
});

describe('migración de lectura cronometrada', () => {
  it('es aditiva: no borra tablas, columnas ni datos', () => {
    expect(migracion).not.toMatch(/drop\s+(table|column)|truncate|delete\s+from/i);
  });

  it('el servidor exige la lectura completa antes de empezar los ejercicios', () => {
    const inicio = migracion.slice(migracion.indexOf('function public.start_activity_attempt'));
    expect(inicio).toMatch(/reading_min_seconds is not null and not exists[\s\S]+completed_at is not null/);
    expect(inicio).toMatch(/Primero complete el tiempo de lectura/);
  });

  it('solo suma tiempo real entre latidos seguidos (≤ 25 s) y nunca más del mínimo', () => {
    expect(migracion).toMatch(/v_gap > 0 and v_gap <= 25/);
    expect(migracion).toMatch(/least\(v_min, seconds_read \+ v_add\)/);
  });

  it('los estudiantes no pueden escribir su progreso directamente', () => {
    expect(migracion).toMatch(/alter table public\.reading_progress enable row level security/);
    expect(migracion).toMatch(/revoke all on public\.reading_progress from anon, authenticated/);
    expect(migracion).toMatch(/grant select on public\.reading_progress to authenticated/);
    expect(migracion).not.toMatch(/grant (insert|update|delete)[^;]*reading_progress/i);
  });

  it('las funciones nuevas no son ejecutables por anónimos', () => {
    expect(migracion).toMatch(/revoke execute on function public\.reading_beat\(uuid, boolean\), public\.my_reading\(uuid\)[\s\S]+from public, anon/);
  });
});

describe('generador de actividades con lectura', () => {
  const act: ActividadDef = {
    clave: 'prueba-lectura', seccion: 'S', curso: 'C', titulo: 'T', instrucciones: 'I',
    ajustes: { modo: 'practice', intentosPorEjercicio: 3, pistas: true, revelar: 'immediate', publicada: false },
    lectura: { texto: Array.from({ length: 260 }, () => 'palabra').join(' ') },
    ejercicios: [],
  };

  it('calcula el tiempo del texto si no se indica', () => {
    expect(tiempoLectura(act)).toBe(120);
    expect(tiempoLectura({ ...act, lectura: { texto: 'x', minSegundos: 90 } })).toBe(90);
  });

  it('inserta el texto y el tiempo en la actividad', () => {
    const sql = sqlActividad(act);
    expect(sql).toMatch(/reading_text, reading_min_seconds\)/);
    expect(sql).toMatch(/, 120\)\s*\non conflict \(id\) do nothing/);
  });

  it('sin lectura no toca las columnas nuevas (funciona antes de la migración 10)', () => {
    expect(sqlActividad({ ...act, lectura: undefined })).not.toMatch(/reading_/);
  });
});
