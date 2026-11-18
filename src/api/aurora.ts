/**
 * AURORA-07 (migración 105): entrevista automatizada con guion determinista. El servidor guarda cada respuesta y elige
 * la pregunta siguiente; el estudiante solo recibe la pregunta actual y su propia conversación.
 */
import { rpc } from '@/lib/supabase';
import type { InformeAurora } from '@/lib/aurora/contraste';

export interface NodoPublico {
  nodo: string;
  tipo: 'info' | 'opcion' | 'texto' | 'fin';
  texto: string;
  boton?: string;
  max?: number;
  opcional?: boolean;
  opciones?: { valor: string; texto: string; pide_texto?: boolean }[];
}
export interface EstadoAurora {
  id: string;
  titulo: string;
  estado: 'abierta' | 'finalizada';
  finalizada_at: string | null;
  historial: { pregunta: string; respuesta: string; at: string }[];
  actual: NodoPublico | null;
}

export const API_AURORA = {
  pendiente: () => rpc<{ id: string; titulo: string; iniciada: boolean }[]>('aurora_pendiente'),
  estado: (id: string) => rpc<EstadoAurora>('aurora_estado', { p_id: id }),
  responder: (id: string, nodo: string, valor: string | null, texto: string | null, idem: string) =>
    rpc<EstadoAurora>('aurora_responder', { p_id: id, p_nodo: nodo, p_valor: valor, p_texto: texto, p_idem: idem }),
  informe: (id: string) => rpc<InformeAurora>('aurora_informe', { p_id: id }),
  habilitar: (id: string) => rpc<InformeAurora>('aurora_habilitar', { p_id: id }),
};
