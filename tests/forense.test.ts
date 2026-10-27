import { describe, expect, it } from 'vitest';
import { categoria, evaluar, pareceAutomatizado, type ContextoEvento } from '../src/lib/forense';
import { describirUA } from '../supabase/functions/acceder/handler';

const base = (over: Partial<ContextoEvento> = {}, ev: Partial<ContextoEvento['evento']> = {}): ContextoEvento => ({
  evento: { reason: 'bad_password', success: false, browser: 'Firefox 131', os: 'Linux', country: 'DO', ip_hash: 'aaa', device_hash: 'ddd', created_at: '2026-10-27T13:00:00Z', ...ev },
  cuenta: { full_name: 'Prof. Orbe', student_code: null, role: 'admin' },
  historial_correctos: 20, navegadores: ['Firefox 130'], sistemas: ['Linux'], paises: ['DO'],
  origen_visto_en_correctos: true, dispositivo_reconocido: true, horas_habituales: [8, 9, 13, 14, 20], hora_evento: 9,
  rafaga_intentos: 1, rafaga_intervalos: [], correcto_despues: '2026-10-27T13:01:00Z', ids_mismo_origen_24h: 1, ...over,
});

describe('«¿Pude haber sido yo?»', () => {
  it('un fallo desde el contexto habitual es compatible con un error del titular (sin afirmarlo)', () => {
    const r = evaluar(base());
    expect(r.categoria).toBe('bajo');
    expect(r.texto).toMatch(/compatible con un error de autenticación del titular, aunque no demuestra/);
  });
  it('dispositivo, red, navegador, sistema y país distintos, en ráfaga regular: anómalo y compatible con automatización', () => {
    const r = evaluar(base(
      { origen_visto_en_correctos: false, dispositivo_reconocido: false, rafaga_intentos: 17, rafaga_intervalos: [3, 3.1, 2.9, 3, 3.2, 3], correcto_despues: null },
      { browser: 'Chrome 129', os: 'Android 14', country: 'US' },
    ));
    expect(r.puntuacion).toBeGreaterThan(80);
    expect(r.categoria).toBe('crítico');
    expect(r.automatizacion).toBe(true);
    expect(r.texto).toMatch(/compatibles con intentos automatizados/);
    expect(r.texto).not.toMatch(/atacante/);
  });
  it('sin historial ni metadatos: evidencia insuficiente', () => {
    const r = evaluar(base({ historial_correctos: 0, navegadores: [], sistemas: [], paises: [], origen_visto_en_correctos: false, dispositivo_reconocido: false, correcto_despues: null },
      { browser: null, os: null, country: null, device_hash: null }));
    expect(r.categoria).toBe('insuficiente');
    expect(r.texto).toBe('Evidencia insuficiente para clasificar.');
    expect(r.desconocido.length).toBeGreaterThanOrEqual(3);
  });
  it('cada señal declara si es hecho o inferencia y su peso', () => {
    for (const s of evaluar(base()).senales) {
      expect(['hecho', 'inferencia']).toContain(s.tipo);
      expect(typeof s.peso).toBe('number');
    }
  });
  it('automatización: solo con ritmo corto y regular', () => {
    expect(pareceAutomatizado([3, 3, 3, 3])).toBe(true);
    expect(pareceAutomatizado([3, 40, 7, 90])).toBe(false);
    expect(pareceAutomatizado([3, 3])).toBe(false);
  });
  it('las categorías son rangos de puntuación', () => {
    expect([10, 30, 50, 70, 95].map(categoria)).toEqual(['bajo', 'bajo-moderado', 'moderado', 'alto', 'crítico']);
  });
});

describe('caracterización del dispositivo (user-agent declarado)', () => {
  it('reconoce navegador, sistema y tipo', () => {
    expect(describirUA('Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0')).toEqual({ browser: 'Firefox 131', os: 'Linux', device_type: 'computadora' });
    expect(describirUA('Mozilla/5.0 (Linux; Android 14; SM-A15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36')).toEqual({ browser: 'Chrome 129', os: 'Android 14', device_type: 'teléfono' });
    expect(describirUA('')).toEqual({ browser: null, os: null, device_type: null });
  });
});
