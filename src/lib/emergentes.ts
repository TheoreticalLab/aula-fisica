/**
 * Coordinación de los avisos que se dibujan encima de la página (mensajes del profesor, bloqueo de pantalla,
 * aviso de asistencia, Orbe IA): cada uno declara cuándo está visible y los de menor prioridad (Orbe IA)
 * esperan o se retiran para no superponerse.
 */
import { useEffect } from 'react';

const activos = new Set<string>();
const oyentes = new Set<() => void>();

export function marcarEmergente(id: string, visible: boolean) {
  const antes = activos.has(id);
  if (visible) activos.add(id);
  else activos.delete(id);
  if (antes !== visible) oyentes.forEach((f) => f());
}

/** ¿Hay algún aviso visible (aparte de `excepto`)? */
export function hayEmergente(excepto?: string): boolean {
  for (const a of activos) if (a !== excepto) return true;
  return false;
}

export function suscribirEmergentes(f: () => void): () => void {
  oyentes.add(f);
  return () => {
    oyentes.delete(f);
  };
}

/** Declara un aviso visible mientras `visible` sea verdadero (y lo retira al desmontar). */
export function useEmergente(id: string, visible: boolean) {
  useEffect(() => {
    marcarEmergente(id, visible);
    return () => marcarEmergente(id, false);
  }, [id, visible]);
}
