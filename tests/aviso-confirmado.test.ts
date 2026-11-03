import { describe, expect, it } from 'vitest';
import { estadoConfirmacion, fusionarCola, type MensajeVivo } from '../src/lib/mensajes';

const m = (o: Partial<MensajeVivo>): MensajeVivo => ({ id: 'x', kind: 'importante', body: 'b', sender_name: 'P', created_at: '2026-11-03T10:00:00Z', expires_at: null, delivered_at: null, ...o });

describe('Aviso con lectura obligatoria · migración 70', () => {
  it('primero la espera; después la casilla; «Entendido» solo con la casilla marcada', () => {
    expect(estadoConfirmacion(20, false)).toEqual({ esperando: true, cajaHabilitada: false, botonHabilitado: false });
    expect(estadoConfirmacion(5, true)).toEqual({ esperando: true, cajaHabilitada: false, botonHabilitado: false });
    expect(estadoConfirmacion(0, false)).toEqual({ esperando: false, cajaHabilitada: true, botonHabilitado: false });
    expect(estadoConfirmacion(0, true)).toEqual({ esperando: false, cajaHabilitada: true, botonHabilitado: true });
  });
  it('el aviso de puntos perdidos (urgente) va antes que los demás y conserva su confirmación', () => {
    const cola = fusionarCola([], [
      m({ id: 'a', kind: 'informativo', created_at: '2026-11-03T09:00:00Z' }),
      m({ id: 'b', kind: 'urgente', confirmacion: { tipo: 'caja', espera: 20, caja: 'He leído…' } }),
    ], new Set());
    expect(cola.map((x) => x.id)).toEqual(['b', 'a']);
    expect(cola[0].confirmacion?.espera).toBe(20);
  });
});
