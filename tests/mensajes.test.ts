import { describe, expect, it } from 'vitest';
import { fusionarCola, porMarcarRecibidos, type MensajeVivo } from '../src/lib/mensajes';

const m = (id: string, kind: MensajeVivo['kind'], minuto: number, extra: Partial<MensajeVivo> = {}): MensajeVivo => ({
  id, kind, body: `msg ${id}`, sender_name: 'Prof.', created_at: `2026-10-27T10:${String(minuto).padStart(2, '0')}:00Z`,
  expires_at: null, delivered_at: null, ...extra,
});

describe('cola de mensajes emergentes', () => {
  it('no duplica un mensaje que llega por Realtime y por la recuperación de pendientes', () => {
    const cola = fusionarCola([m('a', 'importante', 1)], [m('a', 'importante', 1), m('b', 'informativo', 2)], new Set());
    expect(cola.map((x) => x.id)).toEqual(['a', 'b']);
  });
  it('los urgentes van primero; a igual tipo, por orden de envío', () => {
    const cola = fusionarCola([], [m('i', 'informativo', 1), m('u2', 'urgente', 5), m('u1', 'urgente', 3), m('p', 'importante', 2)], new Set());
    expect(cola.map((x) => x.id)).toEqual(['u1', 'u2', 'p', 'i']);
  });
  it('lo ya respondido en este navegador no reaparece aunque el servidor aún no lo sepa (sin conexión)', () => {
    const cola = fusionarCola([], [m('a', 'urgente', 1), m('b', 'importante', 2)], new Set(['a']));
    expect(cola.map((x) => x.id)).toEqual(['b']);
  });
  it('los mensajes vencidos no se muestran', () => {
    const ahora = new Date('2026-10-27T12:00:00Z').getTime();
    const cola = fusionarCola([], [m('v', 'importante', 1, { expires_at: '2026-10-27T11:00:00Z' }), m('w', 'importante', 2, { expires_at: '2026-10-27T13:00:00Z' })], new Set(), ahora);
    expect(cola.map((x) => x.id)).toEqual(['w']);
  });
  it('solo se marca la recepción técnica de lo no recibido y una sola vez', () => {
    const srv = [m('a', 'informativo', 1), m('b', 'informativo', 2, { delivered_at: '2026-10-27T10:03:00Z' }), m('c', 'urgente', 3)];
    expect(porMarcarRecibidos(srv, new Set(['c']))).toEqual(['a']);
  });
});
