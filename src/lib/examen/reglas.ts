/** Reglas del examen explicadas al estudiante antes de empezar (lógica pura). */
import type { ConfigExamen } from './motor';

export function describirReglas(c: ConfigExamen): { titulo: string; lineas: string[] } | null {
  if (c.presentacion !== 'una_a_la_vez') return null;
  const min = (s: number) => Math.round(s / 60);
  const l: string[] = [];
  l.push('Verá una pregunta a la vez. Use «Siguiente» y «Anterior», o los números de arriba.');
  l.push(c.navegacion === 'libre'
    ? 'Puede volver a cualquier pregunta y marcarla con 🚩 para revisarla al final.'
    : 'Solo se avanza: una pregunta que deja atrás no se puede volver a abrir ni cambiar.');
  l.push(c.duracion_s ? `Tiene ${min(c.duracion_s)} minutos desde que pulse «Comenzar». El reloj lo lleva el servidor y sigue corriendo aunque cierre la página.` : 'No hay límite de tiempo por intento (solo la fecha de cierre).');
  if (c.pausas.permitidas) {
    l.push(`Puede pausar ${c.pausas.max_numero === 1 ? 'una vez' : `hasta ${c.pausas.max_numero} veces`} (${min(c.pausas.max_total_s)} min en total). Durante la pausa las preguntas se ocultan${c.pausas.detienen_reloj ? ' y el reloj se detiene' : ', pero el reloj sigue'}.`);
  } else l.push('Este examen no tiene pausas.');
  l.push('Sus respuestas se guardan solas. Si se va la internet, se guardan en su dispositivo y se envían al volver.');
  if (c.duracion_s) l.push('Al terminar el tiempo, se entrega automáticamente lo que haya guardado.');
  return { titulo: c.duracion_s ? `Examen de ${min(c.duracion_s)} minutos` : 'Examen de una pregunta a la vez', lineas: l };
}
