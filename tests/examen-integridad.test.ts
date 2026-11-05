/** Quiz y exámenes protegidos (migración 85): reglas puras e integración estática. El servidor se prueba en
 *  supabase/pruebas/examen_bloqueo_salida.sql. */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  blurEsSalida, confirmarSinSalida, crearLimitador, ESPERA_SIN_FOCO, reglasIntegridad, suspenderVigilancia, vigilanciaSuspendida,
} from '../src/lib/examen/integridad';
import { describirReglas } from '../src/lib/examen/reglas';
import type { ConfigExamen } from '../src/lib/examen/motor';

const base: ConfigExamen = { presentacion: 'una_a_la_vez', navegacion: 'libre', duracion_s: 900, pausas: { permitidas: false, max_numero: 0, max_total_s: 0, detienen_reloj: false } };

describe('reglas que lee el estudiante antes de empezar', () => {
  it('sin protecciones no añade nada (las evaluaciones de siempre no cambian)', () => {
    expect(reglasIntegridad(undefined)).toEqual([]);
    expect(reglasIntegridad({ bloquear_al_salir: false, impedir_copiar: false })).toEqual([]);
    expect(describirReglas({ ...base, presentacion: 'todas' })).toBeNull();
    expect(describirReglas(base)?.lineas[0]).toMatch(/una pregunta a la vez/);
  });
  it('bloquear al salir: explica qué cuenta como salir, el código y que el reloj sigue', () => {
    const l = reglasIntegridad({ bloquear_al_salir: true, impedir_copiar: false }).join(' ');
    expect(l).toMatch(/cambia de pestaña o de aplicación/);
    expect(l).toMatch(/recarga o cierra/);
    expect(l).toMatch(/código que le dará el profesor/);
    expect(l).toMatch(/el reloj sigue corriendo/);
  });
  it('impedir copiar: avisa que se registra', () => {
    expect(reglasIntegridad({ bloquear_al_salir: false, impedir_copiar: true })[0]).toMatch(/copiar el enunciado ni pegar.*registrados/);
  });
  it('también en la evaluación clásica (todas las preguntas en una página), y primero en «una a la vez»', () => {
    const c = describirReglas({ ...base, presentacion: 'todas', integridad: { bloquear_al_salir: true, impedir_copiar: true } });
    expect(c?.titulo).toBe('Evaluación protegida');
    expect(c?.lineas).toHaveLength(3);
    const u = describirReglas({ ...base, integridad: { bloquear_al_salir: true, impedir_copiar: false } });
    expect(u?.titulo).toBe('Examen de 15 minutos');
    expect(u?.lineas[0]).toMatch(/No salga del examen/);
  });
});

describe('detección de salida', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  it('5 s fuera de foco, como la pregunta relámpago', () => { expect(ESPERA_SIN_FOCO).toBe(5000); });
  it('el foco dentro de un vídeo o simulación incrustados (iframe) no es salir', () => {
    expect(blurEsSalida({ tagName: 'IFRAME' })).toBe(false);
    expect(blurEsSalida({ tagName: 'iframe' })).toBe(false);
    expect(blurEsSalida({ tagName: 'BODY' })).toBe(true);
    expect(blurEsSalida(null)).toBe(true);
  });
  it('limitador: un aviso por tipo cada intervalo', () => {
    const lim = crearLimitador(2000);
    expect(lim('pegado', 0)).toBe(true);
    expect(lim('pegado', 1500)).toBe(false);
    expect(lim('copia', 1500)).toBe(true);
    expect(lim('pegado', 2500)).toBe(true);
  });
  it('el diálogo para confirmar la entrega no cuenta como salida; la vigilancia vuelve poco después', () => {
    let durante = false;
    vi.stubGlobal('window', { confirm: () => { durante = vigilanciaSuspendida(); return true; } });
    expect(confirmarSinSalida('¿Entregar?')).toBe(true);
    expect(durante).toBe(true);
    expect(vigilanciaSuspendida(Date.now() + 1000)).toBe(true);
    expect(vigilanciaSuspendida(Date.now() + 2000)).toBe(false);
  });
  it('suspender no acorta una suspensión mayor', () => {
    const t = 1_000_000_000_000;
    suspenderVigilancia(10_000, t);
    suspenderVigilancia(1_000, t);
    expect(vigilanciaSuspendida(t + 5_000)).toBe(true);
  });
});

describe('integración (estática)', () => {
  const intento = readFileSync('src/pages/estudiante/Intento.tsx', 'utf8');
  const comp = readFileSync('src/components/IntegridadExamen.tsx', 'utf8');
  const css = readFileSync('src/index.css', 'utf8');
  const api = readFileSync('src/api/examen.ts', 'utf8');
  const mig = readFileSync('supabase/migrations/20261105000085_examen_bloqueo_al_salir.sql', 'utf8');

  it('la página del intento vigila la salida, protege el contenido en ambas interfaces y confirma sin contar como salida', () => {
    expect(intento).toMatch(/useVigilanciaSalida\(attemptId, vigilar\)/);
    expect(intento.match(/<BarreraCopiado attemptId=\{attempt\.id\} activo=\{sinCopiar\}>/g)).toHaveLength(2);
    expect(intento).toMatch(/confirmarSinSalida\(msg\)/);
    expect(intento).not.toMatch(/window\.confirm/);
    expect(intento).toMatch(/examEntrada\(attemptId\)/);
  });
  it('el aviso de salida llega aunque se cierre la pestaña (keepalive) y se reintenta al volver', () => {
    expect(comp).toMatch(/rpc\/exam_salida/);
    expect(comp).toMatch(/keepalive: true/);
    expect(comp).toMatch(/visibilitychange/);
    expect(comp).toMatch(/pagehide/);
    expect(comp).toMatch(/sessionStorage\.setItem\(PENDIENTE/);
  });
  it('copiar: copy/cut/menú contextual bloqueados; pegar y arrastrar con la barrera de las PES', () => {
    expect(comp).toMatch(/addEventListener\('copy'/);
    expect(comp).toMatch(/addEventListener\('cut'/);
    expect(comp).toMatch(/addEventListener\('contextmenu'/);
    expect(comp).toMatch(/<BarreraPegado permitido=\{false\}/);
  });
  it('los campos de respuesta siguen admitiendo escritura (iOS) aunque el enunciado no se seleccione', () => {
    expect(css).toMatch(/\.sin-copiar \{[^}]*user-select: none/);
    expect(css).toMatch(/\.sin-copiar input,\s*\.sin-copiar textarea[^{]*\{[^}]*user-select: text/);
  });
  it('abrir el examen dos veces seguidas en la misma página (React en desarrollo) no cuenta como reingreso', () => {
    expect(api).toMatch(/examOpen = \(attemptId: string\) => unaVez\(`open:/);
    expect(api).toMatch(/examEntrada = \(attemptId: string\) => unaVez\(`entrada:/);
  });
  it('migración aditiva, con RLS, sin permisos para anon y con ayudantes internos no invocables', () => {
    expect(mig).not.toMatch(/drop (table|column)|truncate|alter column .* type|rename/i);
    expect(mig).toMatch(/exam_integridad_eventos enable row level security/);
    expect(mig).not.toMatch(/grant [^;]* to anon/i);
    for (const f of ['exam_bloqueado(uuid)', 'exam_protegido(uuid)', 'exam_registrar(uuid, text, text)', 'exam_registrar_entrada(uuid)']) {
      expect(mig).toContain(`revoke all on function public.${f} from public, anon, authenticated;`);
      expect(mig).not.toContain(`grant execute on function public.${f}`);
    }
  });
});
