/**
 * Página del Entrenador: el primer render con los datos ya cargados (antes de que el efecto copie st.data al estado
 * propio) no debe romperse. Ese render fallaba con «No se pudo cargar esta parte del aula».
 */
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { EstadoEntrenador } from '@/api/entrenador';

vi.mock('@/lib/supabase', () => {
  const sinServidor = async () => { throw new Error('sin servidor en esta prueba'); };
  return { supabase: {}, rpc: sinServidor, invocar: sinServidor, calificar: sinServidor, errorMessage: (e: unknown) => String(e), supabaseConfigured: false, SUPABASE_URL: '', SUPABASE_ANON_KEY: '', appBaseUrl: () => '' };
});
const cargado: { data: EstadoEntrenador | undefined } = { data: undefined };
vi.mock('@/lib/util', async (original) => ({
  ...(await original<typeof import('@/lib/util')>()),
  useAsync: () => ({ data: cargado.data, error: null, loading: false, reload: async () => {}, setData: () => {} }),
}));
import Entrenador from '@/pages/estudiante/Entrenador';

const resumen = { ejercicios: 3, correctos: 2, primer_intento: 1, sin_resolver: 1, hoy: 3, minutos: 7 };
const base: EstadoEntrenador = {
  entrenador: { id: 'e1', titulo: 'Entrenador — Laboratorio', descripcion: 'Practique **sin nota**.', intentos: 2, activo: true },
  prueba: false,
  temas: [{ codigo: 'pendulo', nombre: 'Péndulo simple' }, { codigo: 'ley_hooke', nombre: 'Ley de Hooke' }],
  resumen,
  actual: null,
};
const html = () => renderToStaticMarkup(h(StaticRouter, { location: '/entrenador/e1' }, h(Entrenador)));

describe('página del Entrenador', () => {
  it('sin ejercicio abierto: título, temas y botón ENTRENAR', () => {
    cargado.data = base;
    const s = html();
    expect(s).toContain('Entrenador — Laboratorio');
    expect(s).toContain('Péndulo simple');
    expect(s).toContain('ENTRENAR');
    expect(s).toContain('Ejercicios hechos');
  });

  it('con un ejercicio abierto tras un intento fallido: casillas, unidad y aviso de intentos', () => {
    cargado.data = {
      ...base,
      actual: {
        id: 'x1', tema: 'pendulo', estado: 'abierto', intentos: 1, intentos_max: 2, enunciado: 'Calcule el período.',
        partes: [{ etiqueta: 'Período', unidad: 's' }],
        respuestas: [{ n: 1, partes: ['3'], correcta: false, detalle: { partes: [{ correcta: false, codigo: 'incorrect', mensaje: null }] } }],
        solucion: null, valores: null,
      },
    };
    const s = html();
    expect(s).toContain('Calcule el período.');
    expect(s).toContain('Intento 2 de 2');
    expect(s).toContain('Le queda 1 intento.');
    expect(s).toContain('COMPROBAR');
  });

  it('sin datos todavía: indicador de carga, sin romperse', () => {
    cargado.data = undefined;
    expect(() => html()).not.toThrow();
  });
});
