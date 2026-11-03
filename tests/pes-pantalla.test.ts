/**
 * Pantalla del estudiante de la PES renderizada a HTML (sin navegador): textos obligatorios, un solo apartado a la
 * vista, avisos de espera mínima y de formato. La interacción real se prueba con la sesión contra la base
 * (scripts/pruebas-pg/pes-integracion.ts).
 */
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ApiPes, ResumenPes, VistaPes } from '@/api/pesTipos';

// sin servidor: el cliente de Supabase no se crea (en Node 18 su tiempo real pide WebSocket)
vi.mock('@/lib/supabase', () => {
  const sinServidor = async () => { throw new Error('sin servidor en esta prueba'); };
  return { supabase: {}, rpc: sinServidor, invocar: sinServidor, calificar: sinServidor, errorMessage: (e: unknown) => String(e), supabaseConfigured: false, SUPABASE_URL: '', SUPABASE_ANON_KEY: '', appBaseUrl: () => '' };
});
import { AlmacenMemoria } from '@/lib/examen/guardado';
import { SesionPes } from '@/lib/pesSesion';
import { Apartado, Condiciones, Final } from '@/pages/estudiante/PracticaExtraordinaria';

const html = (x: ReturnType<typeof h>) => renderToStaticMarkup(h(StaticRouter, { location: '/pes/p' }, x)).replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

const RESUMEN: ResumenPes = {
  id: 'p', titulo: 'PES 1', descripcion: 'Descripción', instrucciones: '', abre_at: null, cierra_at: '2026-11-20T23:59:00Z', cierre: '2026-11-20T23:59:00Z',
  estado_practica: 'publicada', p_max: 8, alfa: 2, factor_anticipado: 0.5, incremento: 0.2, ejercicios: 2, apartados: 7, cerrados: 0, minutos_espera: 24,
  minutos_referencia: 20, liberacion: [], control_politica: { modo: 'informativo', peso: 0, descripcion: '' }, estado: 'no_iniciada', aceptado_at: null, tiempo_extra_min: 0, factor_espera: 1, pegado_permitido: false, resultado: null,
};

function vista(revelado: Date, extra: Partial<VistaPes> = {}): VistaPes {
  return {
    estado: 'apartado_abierto', ejercicios: 2, ahora: new Date().toISOString(), cierre: '2026-11-20T23:59:00Z', cerrados: 0, apartados_total: 7,
    ejercicio: { posicion: 1, titulo: 'Caída', contexto: 'Una piedra cae.', apartados: 3 },
    apartado: { id: 'a1', letra: 'A', posicion: 1, etapa: 'prediccion', enunciado: 'ENUNCIADO-A ¿Qué ocurre?', formato: 'numeric', opciones: null, multiple: false, unidad_sugerida: 'm', figura: null, variante: false },
    revelado_at: revelado.toISOString(), t_min_s: 72, borrador: null, borrador_rev: 0, factor_anticipado: 0.5, pegado_permitido: false, ...extra,
  };
}
async function sesionCon(v: VistaPes) {
  const api = { actual: async () => v } as unknown as ApiPes;
  const s = new SesionPes('p', { api, almacen: new AlmacenMemoria(), reloj: () => Date.now(), nuevoId: () => 'x', temporizador: { poner: () => null, quitar: () => undefined } });
  await s.cargar();
  return s;
}

describe('PES · pantalla del estudiante', () => {
  it('condiciones: secuencial, irreversible, espera mínima, 50 %, omisión, pegado como barrera y aceptación explícita', () => {
    const t = html(h(Condiciones, { r: RESUMEN, onAceptar: async () => undefined, error: null }));
    expect(t).toContain('de uno en uno');
    expect(t).toContain('definitiva');
    expect(t).toContain('espera mínima');
    expect(t).toContain('se reduce al 50%');
    expect(t).toContain('vale 0');
    expect(t).toContain('no impide ni comprueba');
    expect(t).toContain('He leído las condiciones y las acepto');
    expect(t).toMatch(/<button[^>]*disabled[^>]*>Comenzar/);              // sin aceptar no se puede empezar
    expect(t).toContain('(S/N)<sup>2</sup>');                            // fórmula cuadrática
    expect(t).toContain('problema técnico persiste');
    expect(t).toContain('decláreselo a su profesor');
    expect(t).not.toContain('Control presencial');                        // sin política anunciada, no se menciona
  });
  it('condiciones: la política de control presencial y su efecto se comunican antes de empezar', () => {
    const r = { ...RESUMEN, control_politica: { modo: 'ajuste' as const, peso: 0.2, descripcion: 'Habrá un control presencial de un ejercicio realizado.' } };
    const t = html(h(Condiciones, { r, onAceptar: async () => undefined, error: null }));
    expect(t).toContain('Habrá un control presencial de un ejercicio realizado.');
    expect(t).toContain('1 − 0,2 × (1 − C)');
    const i = html(h(Condiciones, { r: { ...r, control_politica: { ...r.control_politica, modo: 'informativo' as const, peso: 0 } }, onAceptar: async () => undefined, error: null }));
    expect(i).toContain('no cambia la puntuación');
  });
  it('condiciones con adaptaciones: pegado permitido y tiempo adicional a la vista', () => {
    const t = html(h(Condiciones, { r: { ...RESUMEN, pegado_permitido: true, tiempo_extra_min: 60, factor_espera: 0.5 }, onAceptar: async () => undefined, error: null }));
    expect(t).toContain('adaptación de pegado');
    expect(t).toContain('incluye 60 min adicionales');
    expect(t).toContain('reducida por su adaptación');
  });
  it('apartado abierto antes de la espera mínima: un solo enunciado, cuenta atrás y confirmación «antes de tiempo»', async () => {
    const s = await sesionCon(vista(new Date()));
    const t = html(h(Apartado, { ses: s, e: s.e, practica: 'p' }));
    expect(t).toContain('ENUNCIADO-A');
    expect(t).toContain('Apartado A de 3');
    expect(t).toContain('Una piedra cae.');
    expect(t).toContain('Espera mínima');
    expect(t).toContain('Confirmar (antes de tiempo: 50%)');
    expect(t).toContain('Omitir apartado');
    expect(t).toContain('0 de 7 apartados cerrados');
    expect(t).toContain('Espera mínima: <strong class="font-mono">1:1');           // 72 s (1:12 o 1:11 según el segundo)
  });
  it('tras la espera mínima: confirmar sin reducción', async () => {
    const s = await sesionCon(vista(new Date(Date.now() - 600_000)));
    const t = html(h(Apartado, { ses: s, e: s.e, practica: 'p' }));
    expect(t).toContain('Puede confirmar sin reducción');
    expect(t).toContain('>Confirmar respuesta<');
  });
  it('errores de formato y acciones pendientes se muestran sin revelar la corrección', async () => {
    const s = await sesionCon(vista(new Date()));
    const e = { ...s.e, mensajes: ['No se reconoce la unidad.'], pendiente: { tipo: 'confirmar' as const, apartado: 'a1', idem: 'i' } };
    const t = html(h(Apartado, { ses: s, e, practica: 'p' }));
    expect(t).toContain('Revise el formato de su respuesta');
    expect(t).toContain('el apartado sigue abierto');
    expect(t).toContain('se enviará al recuperar la conexión');
    expect(t).not.toMatch(/correcta|incorrecta/i);
  });
  it('final: sin resultados publicados no se muestra puntuación; con ellos, validada, provisional y máxima', async () => {
    const s = await sesionCon({ ...vista(new Date()), estado: 'completada', apartado: undefined });
    expect(html(h(Final, { r: RESUMEN, e: s.e }))).toContain('cuando su profesor publique los resultados');
    const f = (P: number) => ({ S: 0, S_m: 0, P_base: 0, F_tiempo: 0, P });
    const control = { modo: 'ajuste' as const, peso: 0.2, C: 0.5, realizados: 1, factor: 0.9, validada_con_control: 2.025 };
    const r = { ...RESUMEN, resultado: { N: 2, P_max: 8, alfa: 2, puede_responder: false, provisional: f(3.5), validada: { ...f(2.25), completa: false }, maxima_alcanzable: f(4), control,
      apartados: 7, cerrados: 7, omitidos: 1, anticipados: 2, pendientes_revision: 1, sin_validar: 3 } };
    const t = html(h(Final, { r, e: s.e }));
    expect(t).toContain('2,25');
    expect(t).toContain('3,50');
    expect(t).toContain('4,00');
    expect(t).toContain('pendientes de revisión');
    expect(t).toContain('Control presencial: resultado 0,50 de 1');
    expect(t).toContain('validada con control 2,03');
  });
});
