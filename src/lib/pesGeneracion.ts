/**
 * Generación con IA de problemas por apartados para la Práctica Extraordinaria Secuencial (orbe-ia, acción «pes_generar»):
 * reparto del paquete entre lecciones, dificultades y tipos, estimación del coste antes de empezar y conversión de una
 * propuesta al formulario de redacción (para editarla antes de añadirla) conservando sus claves si no se cambian.
 */
import { intercalar, reparto, type DatosEstimacion } from '@/lib/generacion';
import type { ApartadoRedactado, EtapaPes, FormatoPes } from '@/api/pesTipos';
import { formVacio, type FormApartado } from '@/lib/pesRedaccion';

export type NivelPes = 'basico' | 'intermedio' | 'desafiante';
export type TipoProblemaPes = 'calculo' | 'conceptual' | 'datos' | 'errores' | 'transferencia';
export interface EspecificacionPes { leccion_id: string; dificultad: NivelPes; tipo: TipoProblemaPes; apartados: 3 | 4 | 5 }

export const NIVELES_PES: { id: NivelPes; t: string }[] = [
  { id: 'basico', t: 'Básico' }, { id: 'intermedio', t: 'Intermedio' }, { id: 'desafiante', t: 'Desafiante' },
];
export const TIPOS_PES: { id: TipoProblemaPes; t: string; d: string }[] = [
  { id: 'calculo', t: 'Cálculo por etapas', d: 'Predicción, planteamiento, cálculo con unidades e interpretación' },
  { id: 'conceptual', t: 'Conceptual', d: 'Predicción, explicación e interpretación (como mucho un apartado numérico)' },
  { id: 'datos', t: 'Datos experimentales o gráfica', d: 'Una tabla de mediciones que hay que leer y analizar' },
  { id: 'errores', t: 'Corrección de errores', d: 'La solución de un estudiante ficticio con un error físico que hay que encontrar y corregir' },
  { id: 'transferencia', t: 'Variación de condiciones', d: 'Una situación base y un cambio de condiciones en los apartados finales' },
];
export const MAX_PAQUETE = 50;

/** N problemas repartidos por igual entre las lecciones, con la mezcla de dificultades y tipos elegida (intercalados). */
export function planificarPes(n: number, lecciones: string[], niveles: NivelPes[], tipos: TipoProblemaPes[], apartados: 3 | 4 | 5): EspecificacionPes[] {
  if (!lecciones.length || !niveles.length || !tipos.length || n <= 0) return [];
  const m = Math.min(n, MAX_PAQUETE);
  const ls = intercalar(reparto(m, Object.fromEntries(lecciones.map((l) => [l, 1])) as Record<string, number>));
  const ns = intercalar(reparto(m, Object.fromEntries(niveles.map((x) => [x, 1])) as Record<NivelPes, number>));
  const ts = intercalar(reparto(m, Object.fromEntries(tipos.map((x) => [x, 1])) as Record<TipoProblemaPes, number>));
  return Array.from({ length: m }, (_, i) => ({ leccion_id: ls[i], dificultad: ns[i], tipo: ts[i], apartados }));
}

/** Tokens por problema: entrada (instrucciones + lección + existentes) y salida (apartados + razonamiento). */
export const TOKENS_PES = { entradaTipica: 2500, entradaMaxima: 4000, salidaPorApartado: 550, razonamiento: 900 };

export interface EstimacionPes {
  llamadas: number; costoTipico: number; costoMaximo: number; simulado: boolean; restantePresupuesto: number; llamadasRestantesHoy: number;
  cabeHoy: boolean; cabePresupuesto: boolean; avisos: string[];
}

export function estimarPes(n: number, apartados: number, d: DatosEstimacion): EstimacionPes {
  const llamadas = Math.min(n, MAX_PAQUETE);
  const precio = (ent: number, sal: number) => (ent * d.precio_entrada + sal * d.precio_salida) / 1e6;
  const simulado = !d.api_real;
  const salida = Math.min(d.max_salida, apartados * TOKENS_PES.salidaPorApartado + TOKENS_PES.razonamiento);
  const costoTipico = simulado ? 0 : llamadas * precio(TOKENS_PES.entradaTipica, salida);
  const costoMaximo = simulado ? 0 : llamadas * precio(TOKENS_PES.entradaMaxima, d.max_salida);
  const restantePresupuesto = Math.max(0, d.presupuesto_mes - d.gastado_mes);
  const llamadasRestantesHoy = Math.max(0, d.limite_diario - d.llamadas_hoy);
  const avisos: string[] = [];
  if (!d.encendido) avisos.push('Orbe IA está apagado: enciéndalo en Orbe IA → Configuración general.');
  if (simulado) avisos.push('Las llamadas reales están apagadas: se generarán problemas de SIMULACIÓN (sin coste) para probar el flujo.');
  const cabeHoy = llamadas <= llamadasRestantesHoy;
  if (!cabeHoy) avisos.push(`Hacen falta ${llamadas} llamadas y hoy quedan ${llamadasRestantesHoy} (límite diario ${d.limite_diario}): se generarán ${llamadasRestantesHoy} hoy.`);
  const cabePresupuesto = simulado || costoMaximo <= restantePresupuesto;
  if (!cabePresupuesto) avisos.push(`El coste máximo posible (US$ ${costoMaximo.toFixed(2)}) supera lo que queda del presupuesto del mes (US$ ${restantePresupuesto.toFixed(2)}): el servidor parará cuando se agote.`);
  return { llamadas, costoTipico, costoMaximo, simulado, restantePresupuesto, llamadasRestantesHoy, cabeHoy, cabePresupuesto, avisos };
}

/** Motivos de la función en lenguaje claro. */
export const MOTIVO_IA: Record<string, string> = {
  apagado: 'Orbe IA está apagado', proposito: 'propósito no permitido', permiso: 'sin permiso', limite_diario: 'se alcanzó el límite diario de llamadas',
  presupuesto: 'se agotó el presupuesto del mes', sin_clave: 'falta la clave de la API en el servidor', rechazo_modelo: 'el modelo rechazó la petición',
  respuesta_cortada: 'la respuesta salió incompleta', formato: 'la respuesta no tenía el formato pedido', limite_api: 'la API está saturada; espere un poco',
  servidor_api: 'error del servicio de IA', red: 'error de red', autenticacion: 'la clave de la API no es válida', peticion_invalida: 'la API rechazó la petición',
};

// ---------------------------------------------------------------------------------------------------------------
/** Propuesta → formulario de redacción (conserva la clave original de cada apartado por si no se modifica). */
export function aFormulario(p: { titulo: string; contexto: string; apartados: ApartadoRedactado[] }): { titulo: string; contexto: string; aps: FormApartado[] } {
  const aps = p.apartados.map((a): FormApartado => {
    const f: FormApartado = { ...formVacio(a.etapa as EtapaPes), enunciado: a.enunciado, formato: a.formato as FormatoPes, minutos: Math.round((a.t_ref_s / 60) * 2) / 2,
      rubrica: a.rubrica ?? '', explicacion: a.explicacion ?? '', claveOriginal: a.clave ?? null };
    const k = (a.clave ?? {}) as Record<string, unknown>;
    if (a.formato === 'numeric') { f.valor = String(k.value ?? ''); f.tolerancia = typeof k.relTol === 'number' && k.relTol > 0 ? String(Math.round(k.relTol * 1000) / 10) : '2'; }
    if (a.formato === 'choice') { f.opciones = (a.opciones ?? []).join('\n'); f.opcionesOriginales = f.opciones; f.correctas = Array.isArray(k.correct) ? (k.correct as number[]) : []; f.multiple = !!a.multiple; }
    if (a.formato === 'truefalse') { f.verdadero = typeof k.value === 'boolean' ? k.value : null; f.justificacion = String(k.modelJustification ?? ''); }
    if (a.formato === 'text') f.aceptadas = Array.isArray(k.accepted) ? (k.accepted as string[]).join('\n') : '';
    return f;
  });
  return { titulo: p.titulo, contexto: p.contexto, aps };
}
