/**
 * Generador reproducible de versiones de los problemas de choques. El código vive en
 * supabase/functions/_shared/fisica/variantes.ts (lo usa la función de calificación para las variantes por intento);
 * aquí se reexporta para la biblioteca y las pruebas. El navegador del estudiante NO lo necesita: los parámetros de su
 * versión le llegan del servidor y las respuestas nunca salen de él.
 */
export * from '../../../supabase/functions/_shared/fisica/variantes.ts';
