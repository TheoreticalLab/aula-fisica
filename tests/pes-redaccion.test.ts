import { describe, expect, it } from 'vitest';
import { construirApartado, construirEjercicio, formVacio, type FormApartado } from '@/lib/pesRedaccion';
import { decidirEntrada, respuestaVacia } from '@/lib/pesSesion';

const f = (x: Partial<FormApartado>): FormApartado => ({ ...formVacio(), enunciado: 'Calcule', ...x });

describe('PES · redacción docente de apartados (clave comprobada con el motor)', () => {
  it('numérico: valor con unidad y tolerancia; la propia clave se califica correcta', () => {
    const r = construirApartado(f({ valor: '9.8 m/s^2', tolerancia: '2' }), 'A');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.apartado.clave).toEqual({ format: 'numeric', value: '9.8 m/s^2', relTol: 0.02 });
  });
  it('numérico: rechaza valores que el motor no interpreta', () => {
    const r = construirApartado(f({ valor: 'nueve metros' }), 'B');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores[0]).toMatch(/^Apartado B:/);
  });
  it('selección: opciones por línea, una correcta (o varias con «varias respuestas»)', () => {
    expect(construirApartado(f({ formato: 'choice', opciones: 'a\nb\nc', correctas: [1] }), 'A').ok).toBe(true);
    expect(construirApartado(f({ formato: 'choice', opciones: 'a', correctas: [0] }), 'A').ok).toBe(false);
    expect(construirApartado(f({ formato: 'choice', opciones: 'a\nb', correctas: [] }), 'A').ok).toBe(false);
    expect(construirApartado(f({ formato: 'choice', opciones: 'a\nb\nc', correctas: [0, 2] }), 'A').ok).toBe(false);
    expect(construirApartado(f({ formato: 'choice', opciones: 'a\nb\nc', correctas: [0, 2], multiple: true }), 'A').ok).toBe(true);
  });
  it('verdadero/falso, texto y abierta (con rúbrica obligatoria)', () => {
    expect(construirApartado(f({ formato: 'truefalse', verdadero: null }), 'A').ok).toBe(false);
    expect(construirApartado(f({ formato: 'truefalse', verdadero: false, justificacion: 'Porque…' }), 'A').ok).toBe(true);
    expect(construirApartado(f({ formato: 'text', aceptadas: 'conservación\nse conserva' }), 'A').ok).toBe(true);
    expect(construirApartado(f({ formato: 'open', rubrica: 'corta' }), 'A').ok).toBe(false);
    const r = construirApartado(f({ formato: 'open', rubrica: 'Relaciona periodo y longitud' }), 'A');
    expect(r.ok && r.apartado.clave).toBeNull();
  });
  it('ejercicio: 3 a 5 apartados; pesos todos o ninguno, sumando 1', () => {
    const tres = [f({ valor: '1 m' }), f({ valor: '2 m' }), f({ valor: '3 m' })];
    expect(construirEjercicio(tres.slice(0, 2)).ok).toBe(false);
    expect(construirEjercicio(tres).ok).toBe(true);
    expect(construirEjercicio([{ ...tres[0], peso: '0.5' }, tres[1], tres[2]]).ok).toBe(false);
    expect(construirEjercicio([{ ...tres[0], peso: '0.5' }, { ...tres[1], peso: '0.3' }, { ...tres[2], peso: '0.3' }]).ok).toBe(false);
    expect(construirEjercicio([{ ...tres[0], peso: '0.5' }, { ...tres[1], peso: '0.3' }, { ...tres[2], peso: '0,2' }]).ok).toBe(true);
  });
});

describe('PES · bloqueo ordinario de pegado (con excepciones de accesibilidad)', () => {
  it('bloquea pegar y soltar; permite escribir, dictar, autocorregir y teclados IME', () => {
    expect(decidirEntrada('insertFromPaste', false)).toBe('pegado');
    expect(decidirEntrada('insertFromPasteAsQuotation', false)).toBe('pegado');
    expect(decidirEntrada('insertFromDrop', false)).toBe('arrastre');
    for (const t of ['insertText', 'insertReplacementText', 'insertCompositionText', 'deleteContentBackward', 'insertLineBreak', 'historyUndo', 'deleteByDrag'])
      expect(decidirEntrada(t, false)).toBe('permitir');
  });
  it('con la adaptación «pegado permitido» no se bloquea nada', () => {
    expect(decidirEntrada('insertFromPaste', true)).toBe('permitir');
    expect(decidirEntrada('insertFromDrop', true)).toBe('permitir');
  });
  it('respuesta vacía según el formato', () => {
    expect(respuestaVacia('numeric', { text: '  ' })).toBe(true);
    expect(respuestaVacia('choice', { selected: [] })).toBe(true);
    expect(respuestaVacia('truefalse', { value: false })).toBe(false);
  });
});
