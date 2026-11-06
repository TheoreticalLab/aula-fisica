/**
 * Modo de bajo consumo (src/lib/consumo.ts) y filtro de presencia de Orbe Control (orbe-control/src/logica.ts).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BAJO_CONSUMO, CONSUMO, esperaReintento, fetchConLimite, hechaHaceMenosDe, marcarHecha, MODO_BAJO_CONSUMO, NORMAL, sondeo } from '@/lib/consumo';
import { aplicarCambioPresencia, EXPIRA_S, filtrar, type EnLinea } from '../orbe-control/src/logica';

describe('perfil de consumo', () => {
  it('el modo de bajo consumo está activo y reduce todo lo de fondo respecto al anterior', () => {
    expect(MODO_BAJO_CONSUMO).toBe(true);
    expect(CONSUMO).toBe(BAJO_CONSUMO);
    for (const k of ['presenciaMs', 'bloqueoPantallaMs', 'preguntaRelampagoMs', 'mensajesMs', 'controlPendienteMs', 'avisoAsistenciaMs',
      'botonAsistenciaMs', 'telemetriaVaciadoMs', 'controlOnlineMs', 'controlHistorialMs', 'controlAlertasMs'] as const) {
      expect(BAJO_CONSUMO[k], k).toBeGreaterThanOrEqual(NORMAL[k]);
    }
    expect(BAJO_CONSUMO.telemetriaV1ConV2EnPracticas).toBe(false);
    expect(BAJO_CONSUMO.orbeIaLecciones).toBe(false);
  });

  it('la presencia caduca en el servidor (150 s) con margen de 2,5 latidos', () => {
    expect(EXPIRA_S).toBe(150);
    expect(EXPIRA_S * 1000).toBeGreaterThanOrEqual(2.5 * BAJO_CONSUMO.presenciaMs);
    // y sigue siendo compatible con el aula anterior (latido de 25 s)
    expect(EXPIRA_S * 1000).toBeGreaterThan(2.5 * NORMAL.presenciaMs);
  });

  it('los límites de tiempo del navegador superan los del servidor (no abandona lo que el servidor aún completaría)', () => {
    // Edge Functions: pasarela de Supabase 150 s. Base de datos: espera de conexión de PostgREST (10 s) + sentencia (8 s).
    expect(BAJO_CONSUMO.funcionTimeoutMs).toBeGreaterThan(150_000);
    expect(BAJO_CONSUMO.peticionTimeoutMs).toBeGreaterThan(18_000);
  });

  it('el latido de estudio no supera la ventana que el servidor acepta en el primer latido (60 s)', () => {
    expect(BAJO_CONSUMO.latidoEstudioMinS).toBeLessThanOrEqual(55);
  });
});

describe('espera de reintento (backoff con variación)', () => {
  it('crece exponencialmente, con tope, y queda entre la mitad y el total', () => {
    expect(esperaReintento(0, 1000, 30_000, () => 0)).toBe(500);
    expect(esperaReintento(0, 1000, 30_000, () => 1)).toBe(1000);
    expect(esperaReintento(3, 1000, 30_000, () => 0)).toBe(4000);
    expect(esperaReintento(10, 1000, 30_000, () => 1)).toBe(30_000);
    const vals = Array.from({ length: 200 }, () => esperaReintento(2));
    expect(Math.min(...vals)).toBeGreaterThanOrEqual(2000);
    expect(Math.max(...vals)).toBeLessThanOrEqual(4000);
    expect(new Set(vals).size).toBeGreaterThan(20); // no todos reintentan a la vez
  });
});

describe('memoria de consultas por cambio de página', () => {
  it('no repite antes de tiempo', () => {
    marcarHecha('x', 1000);
    expect(hechaHaceMenosDe('x', 30_000, 20_000)).toBe(true);
    expect(hechaHaceMenosDe('x', 30_000, 40_000)).toBe(false);
    expect(hechaHaceMenosDe('nunca', 30_000, 40_000)).toBe(false);
    expect(hechaHaceMenosDe('x', 0, 1001)).toBe(false); // 0 = siempre consulta (modo normal)
  });
});

describe('sondeo amable', () => {
  let visible = 'visible';
  const oyentes: Record<string, (() => void)[]> = {};
  beforeEach(() => {
    vi.useFakeTimers();
    visible = 'visible';
    for (const k of Object.keys(oyentes)) delete oyentes[k];
    const objetivo = {
      addEventListener: (t: string, f: () => void) => { (oyentes[t] ??= []).push(f); },
      removeEventListener: (t: string, f: () => void) => { oyentes[t] = (oyentes[t] ?? []).filter((g) => g !== f); },
    };
    vi.stubGlobal('document', { get visibilityState() { return visible; }, ...objetivo });
    vi.stubGlobal('window', objetivo);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('consulta al montar y cada intervalo solo con la pestaña visible; al volver, enseguida', () => {
    const f = vi.fn();
    const parar = sondeo(f, 20_000, { minimoMs: 2_000 });
    expect(f).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(20_000);
    expect(f).toHaveBeenCalledTimes(2);
    visible = 'hidden';
    vi.advanceTimersByTime(60_000);
    expect(f).toHaveBeenCalledTimes(2); // oculta: nada
    visible = 'visible';
    oyentes.visibilitychange.forEach((g) => g());
    expect(f).toHaveBeenCalledTimes(3); // al volver
    oyentes.visibilitychange.forEach((g) => g());
    expect(f).toHaveBeenCalledTimes(3); // dos avisos seguidos: una sola consulta (mínimo 2 s)
    parar();
    vi.advanceTimersByTime(100_000);
    expect(f).toHaveBeenCalledTimes(3);
    expect(oyentes.visibilitychange).toHaveLength(0);
    expect(oyentes.online).toHaveLength(0);
  });
});

describe('fetch con límite de tiempo', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  function fetchColgado() {
    return vi.fn((_u: unknown, init?: RequestInit) => new Promise<Response>((_, rechazar) => {
      init?.signal?.addEventListener('abort', () => rechazar(new DOMException('aborted', 'AbortError')));
    }));
  }

  it('una petición a la base de datos que no responde falla con un error legible (no «Cargando» eterno)', async () => {
    vi.useFakeTimers();
    const f = fetchColgado();
    vi.stubGlobal('fetch', f);
    const p = fetchConLimite(25_000, 90_000)('https://x.supabase.co/rest/v1/rpc/my_classes', { method: 'POST' });
    const r = expect(p).rejects.toThrow(/Failed to fetch: el servidor tardó demasiado/);
    await vi.advanceTimersByTimeAsync(25_001);
    await r;
  });

  it('Edge Functions con más margen; Auth y Storage sin límite propio', async () => {
    vi.useFakeTimers();
    const f = fetchColgado();
    vi.stubGlobal('fetch', f);
    const lim = fetchConLimite(25_000, 90_000);
    let fallo = false;
    lim('https://x.supabase.co/functions/v1/calificar', {}).catch(() => { fallo = true; });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fallo).toBe(false);
    await vi.advanceTimersByTimeAsync(61_000);
    expect(fallo).toBe(true);
    let auth = false;
    lim('https://x.supabase.co/auth/v1/token', {}).catch(() => { auth = true; });
    lim('https://x.supabase.co/storage/v1/object/a', {}).catch(() => { auth = true; });
    await vi.advanceTimersByTimeAsync(200_000);
    expect(auth).toBe(false);
  });

  it('respeta la cancelación de quien llama y deja pasar las respuestas normales', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('ok')));
    const r = await fetchConLimite(25_000, 90_000)('https://x.supabase.co/rest/v1/profiles', {});
    expect(await r.text()).toBe('ok');
    vi.stubGlobal('fetch', fetchColgado());
    const c = new AbortController();
    const p = fetchConLimite(25_000, 90_000)('https://x.supabase.co/rest/v1/profiles', { signal: c.signal });
    c.abort();
    await expect(p).rejects.toThrow(/aborted/);
  });
});

describe('Orbe Control: un latido sin cambios no recarga la lista', () => {
  const AHORA = Date.parse('2026-11-06T15:00:00Z');
  const e = (id: string, hace: number, visible = true): EnLinea => ({ user_id: id, full_name: id, student_code: null, class_id: 'c', class_name: 'A', course_title: 'F',
    last_seen: new Date(AHORA - hace * 1000).toISOString(), conexiones: 1, visible, section: null, lesson_title: null, activity_title: null });
  const lista = [e('1', 30), e('2', 10, false)];

  it('latido de alguien en la lista con la misma visibilidad: actualiza la señal en memoria, sin consulta', () => {
    const r = aplicarCambioPresencia(lista, { eventType: 'UPDATE', new: { user_id: '1', visible: true, last_seen: new Date(AHORA).toISOString() } });
    expect(r.recargar).toBe(false);
    expect(r.lista[0].last_seen).toBe(new Date(AHORA).toISOString());
    expect(r.lista[1]).toBe(lista[1]);
    expect(lista[0].last_seen).not.toBe(new Date(AHORA).toISOString()); // no muta la lista original
  });
  it('señal más vieja que la conocida: no cambia nada', () => {
    const r = aplicarCambioPresencia(lista, { eventType: 'UPDATE', new: { user_id: '1', visible: true, last_seen: new Date(AHORA - 60_000).toISOString() } });
    expect(r).toEqual({ recargar: false, lista });
  });
  it('alta, baja, estudiante nuevo, cambio de visibilidad o evento incompleto: recarga', () => {
    const t = new Date(AHORA).toISOString();
    expect(aplicarCambioPresencia(lista, { eventType: 'INSERT', new: { user_id: '1', visible: true, last_seen: t } }).recargar).toBe(true);
    expect(aplicarCambioPresencia(lista, { eventType: 'DELETE', new: {} }).recargar).toBe(true);
    expect(aplicarCambioPresencia(lista, { eventType: 'UPDATE', new: { user_id: '9', visible: true, last_seen: t } }).recargar).toBe(true);
    expect(aplicarCambioPresencia(lista, { eventType: 'UPDATE', new: { user_id: '2', visible: true, last_seen: t } }).recargar).toBe(true);
    expect(aplicarCambioPresencia(lista, { eventType: 'UPDATE', new: { user_id: '1' } }).recargar).toBe(true);
  });
  it('la caducidad del panel acompaña a la del servidor (150 s)', () => {
    const l = [e('1', 100), e('2', 200)];
    expect(filtrar(l, '', '', 0, AHORA).map((x) => x.user_id)).toEqual(['1']);
  });
});
