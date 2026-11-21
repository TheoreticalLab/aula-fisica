/**
 * Preguntas de la plataforma en una práctica (migración 108): capa de datos (sin la migración no rompe nada) y la
 * tarjeta del profesor con respuestas, pendientes y excluidos.
 */
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ConsultaActividadDocente } from '@/api/actividadConsultas';

const respuestas: Record<string, unknown> = {};
vi.mock('@/lib/supabase', () => {
  const rpc = async (fn: string) => {
    const r = respuestas[fn];
    if (r instanceof Error) throw r;
    return r;
  };
  return { supabase: {}, rpc, invocar: rpc, calificar: rpc, errorMessage: (e: unknown) => String(e), supabaseConfigured: false, SUPABASE_URL: '', SUPABASE_ANON_KEY: '', appBaseUrl: () => '' };
});
const cargado: { data: ConsultaActividadDocente[] | undefined } = { data: undefined };
vi.mock('@/lib/util', async (original) => ({
  ...(await original<typeof import('@/lib/util')>()),
  useAsync: () => ({ data: cargado.data, error: null, loading: false, reload: async () => {}, setData: () => {} }),
}));
import { API_CONSULTAS_ACTIVIDAD } from '@/api/actividadConsultas';
import { ConsultasActividad } from '@/components/ConsultasActividad';

describe('preguntas de la plataforma en una práctica', () => {
  it('sin la migración: el estudiante no ve pregunta y el profesor no ve tarjetas', async () => {
    const ausente = new Error('Could not find the function public.actividad_consulta_pendiente');
    respuestas.actividad_consulta_pendiente = ausente;
    respuestas.actividad_consultas_docente = ausente;
    expect(await API_CONSULTAS_ACTIVIDAD.pendiente('a')).toBeNull();
    expect(await API_CONSULTAS_ACTIVIDAD.docente('a')).toEqual([]);
  });

  it('otros errores sí se informan', async () => {
    respuestas.actividad_consulta_pendiente = new Error('sin conexión');
    await expect(API_CONSULTAS_ACTIVIDAD.pendiente('a')).rejects.toThrow('sin conexión');
  });

  it('tras responder sin nada pendiente devuelve null (el cuadro se cierra)', async () => {
    respuestas.actividad_declarar = undefined;
    expect(await API_CONSULTAS_ACTIVIDAD.declarar('q', false)).toBeNull();
    respuestas.actividad_declarar = { id: 'q2', titulo: 'Otra', texto: '¿?' };
    expect(await API_CONSULTAS_ACTIVIDAD.declarar('q', true)).toEqual({ id: 'q2', titulo: 'Otra', texto: '¿?' });
  });

  it('tarjeta del profesor: conteos, respuestas, pendientes (empezó o no) y excluidos', () => {
    cargado.data = [{
      id: 'q', titulo: 'Uso de inteligencia artificial', texto: '¿Está usando inteligencia artificial para resolver esta práctica?',
      activa: true, created_at: '2026-11-21T21:00:00Z', cerrada_at: null,
      respuestas: [{ user_id: '1', nombre: 'Ana', respuesta: false, created_at: '2026-11-21T21:05:00Z' }, { user_id: '2', nombre: 'Beto', respuesta: true, created_at: '2026-11-21T21:06:00Z' }],
      pendientes: [{ user_id: '3', nombre: 'Carla', empezo: true }, { user_id: '4', nombre: 'Dani', empezo: false }],
      excluidos: [{ user_id: '5', nombre: 'Eva' }, { user_id: '6', nombre: 'Fede' }],
    }];
    const s = renderToStaticMarkup(h(ConsultasActividad, { activityId: 'a' })).replace(/&#x27;/g, "'");
    expect(s).toContain('Pregunta de la plataforma: Uso de inteligencia artificial');
    expect(s).toMatch(/<strong>1<\/strong> «Sí» · <strong>1<\/strong> «No» · <strong>2<\/strong> sin responder/);
    expect(s).toContain('no se pregunta a Eva, Fede');
    expect(s).toContain('Pendiente (la verá al volver a la práctica)');
    expect(s).toContain('Pendiente (no ha abierto la práctica)');
    expect(s).toContain('Cerrar la pregunta');
  });

  it('sin preguntas no muestra nada', () => {
    cargado.data = [];
    expect(renderToStaticMarkup(h(ConsultasActividad, { activityId: 'a' }))).toBe('');
  });
});
