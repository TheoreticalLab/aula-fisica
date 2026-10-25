/** «Continuar donde lo dejé»: la última lección abierta se recuerda en este dispositivo (sin datos en el servidor). */
export interface UltimaLeccion {
  courseId: string;
  lessonId: string;
  titulo: string;
  bloque?: string;
  seccion: string;
  fecha: string;
}

const clave = (userId: string) => `aula-ultima-leccion:${userId}`;

export function guardarUltimaLeccion(userId: string | undefined, l: Omit<UltimaLeccion, 'fecha'>) {
  if (!userId) return;
  try {
    localStorage.setItem(clave(userId), JSON.stringify({ ...l, fecha: new Date().toISOString() }));
  } catch {
    /* almacenamiento no disponible */
  }
}

export function leerUltimaLeccion(userId: string | undefined): UltimaLeccion | null {
  if (!userId) return null;
  try {
    const v = JSON.parse(localStorage.getItem(clave(userId)) ?? 'null') as UltimaLeccion | null;
    return v && v.lessonId && v.courseId ? v : null;
  } catch {
    return null;
  }
}

export const NOMBRE_SECCION: Record<string, string> = {
  teoria: 'Teoría',
  formulas: 'Fórmulas',
  ejemplos: 'Ejemplos',
  simulacion: 'Simulación',
  practica: 'Práctica',
};
