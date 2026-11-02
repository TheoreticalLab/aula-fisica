import { describe, expect, it } from 'vitest';
import { analizarExpresion, calificarExpresion, ErrorExpresion, type ExpresionClave } from '../supabase/functions/_shared/calificacion/expresiones';
import { grade } from '../supabase/functions/_shared/calificacion/calificar';

const clave = (esperada: string, variables: string[], extra: Partial<ExpresionClave> = {}): ExpresionClave => ({ esperada, variables, ...extra });

describe('Prácticas de Control · equivalencia algebraica', () => {
  const ep = clave('m*g*h', ['m', 'g', 'h']);
  it('acepta formas equivalentes, no solo el mismo texto', () => {
    for (const r of ['m*g*h', 'mgh', 'g h m', 'h·m·g', '(m g) h', 'Ep = m g h', 'm×g×h', '2*m*g*h/2']) {
      expect(calificarExpresion(ep, r), r).toMatchObject({ status: 'correct', credit: 1 });
    }
  });
  it('MRUA: x0 + v0 t + a t²/2 en varias escrituras', () => {
    const k = clave('x0 + v0*t + a*t^2/2', ['x0', 'v0', 'a', 't']);
    for (const r of ['x0+v0t+½', 'x0 + v0*t + 0.5*a*t^2', 'x0 + t(v0 + a t/2)', 'x0 + v0 t + (a t²)/2', 'x0+v0*t+a*t**2/2']) {
      const res = calificarExpresion(k, r);
      if (r.includes('½')) expect(res.status).toBe('invalid');   // símbolo no admitido: no es un cero, es «formato»
      else expect(res, r).toMatchObject({ status: 'correct' });
    }
    expect(calificarExpresion(k, 'x0 + v0 t + a t^2')).toMatchObject({ status: 'incorrect', code: 'expr_wrong' });
  });
  it('identidades trigonométricas y raíces', () => {
    expect(calificarExpresion(clave('sqrt(2*g*h)', ['g', 'h']), '√(2gh)').status).toBe('correct');
    expect(calificarExpresion(clave('(2*g*h)^(1/2)', ['g', 'h']), 'sqrt(2*g*h)').status).toBe('correct');
    expect(calificarExpresion(clave('sin(2*x)', ['x'], { dominio: { x: [-3, 3] } }), '2 sin(x) cos(x)').status).toBe('correct');
    expect(calificarExpresion(clave('v^2/(2*a)', ['v', 'a']), 'v*v/a/2').status).toBe('correct');
  });
  it('detecta el signo contrario', () => {
    expect(calificarExpresion(clave('-k*x', ['k', 'x']), 'k x')).toMatchObject({ status: 'incorrect', code: 'expr_sign' });
  });
  it('errores de escritura: «invalid» con un mensaje útil, nunca un cero silencioso', () => {
    expect(calificarExpresion(ep, 'm*g*z')).toMatchObject({ status: 'invalid', code: 'expr_invalid' });
    expect(calificarExpresion(ep, 'm*g*(h')).toMatchObject({ status: 'invalid' });
    expect(calificarExpresion(ep, '')).toMatchObject({ status: 'invalid' });
    expect(calificarExpresion(ep, 'm g h = 3')).toMatchObject({ status: 'invalid' });
    expect(calificarExpresion(clave('2*t', ['t']), 't2').status).toBe('invalid');   // ambiguo: no se adivina
  });
  it('seguridad: nunca ejecuta código; los nombres heredados de JavaScript no son variables ni funciones', () => {
    for (const ataque of ['constructor', 'process.exit(1)', 'alert(1)', '__proto__', 'toString(m)', 'm;g', '`m`', 'globalThis', 'require(m)']) {
      expect(() => analizarExpresion(ataque, ['m', 'g']), ataque).toThrow(ErrorExpresion);
    }
    expect(() => analizarExpresion('m+'.repeat(200) + 'm', ['m'])).toThrow(ErrorExpresion);   // longitud acotada
  });
  it('una clave mal escrita no penaliza: lanza (safeGrade la manda a revisión)', () => {
    expect(() => calificarExpresion(clave('m*g*', ['m', 'g']), 'm g')).toThrow();
  });
  it('integrado en el motor: clave de texto con expresión', () => {
    expect(grade({ format: 'text', accepted: [], expresion: { esperada: 'q/(4*pi*e0*r^2)', variables: ['q', 'e0', 'r'] } }, { text: 'q/(4 π e0 r²)' }).status).toBe('correct');
    expect(grade({ format: 'text', accepted: ['proporcional'] }, { text: 'proporcional' }).status).toBe('correct');   // sin expresión: igual que antes
  });
});
