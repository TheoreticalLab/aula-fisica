/** Tipos de la Práctica Extraordinaria Secuencial (sin dependencias de ejecución: los usan la sesión y las pruebas). */
import type { StudentAnswer } from '@/api/tipos';

export type EstadoPes = 'no_iniciada' | 'apartado_abierto' | 'esperando_liberacion' | 'completada' | 'vencida';
export type FormatoPes = 'choice' | 'truefalse' | 'numeric' | 'text' | 'open';
export type EtapaPes = 'prediccion' | 'formulacion' | 'resolucion' | 'interpretacion' | 'transferencia' | 'otra';

export interface ApartadoVisible {
  id: string; letra: string; posicion: number; etapa: EtapaPes; enunciado: string; formato: FormatoPes;
  opciones: string[] | null; multiple: boolean; unidad_sugerida: string | null; figura: unknown; variante: boolean;
}

/** Lo que el servidor entrega al estudiante (pes_actual / pes_iniciar). */
export interface VistaPes {
  estado: EstadoPes;
  ejercicios: number; ahora: string; cierre: string | null; cerrados: number; apartados_total: number;
  proximo_ejercicio?: number; disponible_desde?: string | null;
  ejercicio?: { posicion: number; titulo: string; contexto: string; apartados: number };
  apartado?: ApartadoVisible;
  revelado_at?: string; t_min_s?: number; borrador?: string | null; borrador_rev?: number;
  factor_anticipado?: number; pegado_permitido?: boolean;
}

export interface Formula { S: number; S_m: number; P_base: number; F_tiempo: number; P: number }
export interface PuntajeServidor {
  N: number; P_max: number; alfa: number; puede_responder: boolean;
  provisional: Formula; validada: Formula & { completa: boolean }; maxima_alcanzable: Formula;
  control: { modo: 'informativo' | 'ajuste'; peso: number; C: number | null; realizados: number; factor: number; validada_con_control: number };
  apartados: number; cerrados: number; omitidos: number; anticipados: number; pendientes_revision: number; sin_validar: number;
}

export interface ResumenPes {
  id: string; titulo: string; descripcion: string; instrucciones: string;
  abre_at: string | null; cierra_at: string | null; cierre: string | null; estado_practica: 'publicada' | 'cerrada';
  p_max: number; alfa: number; factor_anticipado: number; incremento: number;
  ejercicios: number; apartados: number; cerrados: number; minutos_espera: number; minutos_referencia: number;
  liberacion: { desde: string; ejercicios: number }[]; control_politica: PoliticaControlPes;
  estado: EstadoPes | null; aceptado_at: string | null; tiempo_extra_min: number; factor_espera: number; pegado_permitido: boolean;
  resultado: PuntajeServidor | null;
}

export type ResultadoConfirmar =
  | { confirmado: false; mensajes: string[] }
  | { confirmado: true; estado: { repetida: boolean; accion: string; actual: VistaPes } };
export interface ResultadoOmitir { repetida: boolean; accion: string; actual: VistaPes }
export type EventoCliente = 'pegado_bloqueado' | 'arrastre_bloqueado' | 'ventana_oculta' | 'ventana_visible' | 'reconexion';

/** Operaciones del estudiante. La sesión (lib/pesSesion) las recibe inyectadas: así se prueba contra la base real. */
export interface ApiPes {
  misPracticas(): Promise<ResumenPes[]>;
  iniciar(practica: string): Promise<VistaPes>;
  actual(practica: string): Promise<VistaPes>;
  borrador(practica: string, apartado: string, texto: string, rev: number): Promise<{ rev: number }>;
  confirmar(practica: string, apartado: string, answer: StudentAnswer, anticipado: boolean, idem: string): Promise<ResultadoConfirmar>;
  omitir(practica: string, apartado: string, idem: string): Promise<ResultadoOmitir>;
  evento(practica: string, tipo: EventoCliente): Promise<void>;
  variante(practica: string, apartado: string): Promise<Record<string, number> | null>;
}

export interface PesListaItem {
  id: string; titulo: string; estado: 'borrador' | 'publicada' | 'cerrada' | 'archivada'; abre_at: string | null; cierra_at: string | null;
  resultados_publicados: boolean; publicada_at: string | null; ejercicios: number; apartados: number; asignados: number;
  por_estado: Partial<Record<EstadoPes, number>>; pendientes_revision: number;
}
export interface ApartadoDocente extends Omit<ApartadoVisible, 'variante'> {
  peso: number; t_ref_s: number; origen_exercise_id: string | null; clave: Record<string, unknown> | null; rubrica: string; explicacion: string;
}
export interface EjercicioDocente {
  id: string; posicion: number; titulo: string; contexto: string; origen: 'problema_banco' | 'composicion_docente' | 'redactado'; origen_ref: string | null;
  apartados: ApartadoDocente[];
}
export interface PracticaPes {
  id: string; class_id: string; course_id: string; titulo: string; descripcion: string; instrucciones: string;
  estado: PesListaItem['estado']; abre_at: string | null; cierra_at: string | null; p_max: number; alfa: number; factor_anticipado: number;
  incremento: number; liberacion: { desde: string; ejercicios: number }[]; version: number; resultados_publicados: boolean;
  control_politica: PoliticaControlPes;
}
export interface AsignacionPes {
  user_id: string; nombre: string; codigo: string | null; tiempo_extra_min: number; factor_espera: number; pegado_permitido: boolean;
  nota_adaptacion: string | null; aceptado_at: string | null; estado: EstadoPes | null; cierre: string | null; puntaje: PuntajeServidor;
}
export interface DetallePes { practica: PracticaPes; ejercicios: EjercicioDocente[]; asignaciones: AsignacionPes[] }
export interface EtapaBanco {
  etapa: number; exercise_id: string; formato: FormatoPes; tipo: string | null; con_clave: boolean; publicado: boolean;
  depende_de_la_anterior: boolean; extracto: string; t_ref_s: number;
}
export interface ProblemaBanco {
  id: string; titulo: string | null; total: number; etapas: EtapaBanco[];
  estado: 'listo' | 'requiere_seleccion' | 'incompleto' | 'insuficiente'; motivo: string;
}
export interface InformeBanco { problemas: ProblemaBanco[]; listos: number; requieren_seleccion: number; preguntas_sueltas: number }
export interface ApartadoRedactado {
  enunciado: string; formato: FormatoPes; opciones?: string[]; multiple?: boolean; unidad_sugerida?: string; etapa: EtapaPes;
  peso?: number | null; t_ref_s: number; clave: Record<string, unknown> | null; rubrica?: string; explicacion?: string;
}
export interface RespuestaDocente {
  id: string; user_id: string; nombre: string; ejercicio: number; letra: string; enunciado: string; formato: FormatoPes; rubrica: string;
  respuesta: StudentAnswer | null; accion: 'confirmada' | 'anticipada' | 'omitida'; segundos: number; t_min_s: number; m: number; q: number;
  revision: 'auto' | 'pendiente' | 'revisada'; validada: boolean; nota_revision: string | null; cerrado_at: string;
}
export interface DatosPractica {
  titulo?: string; descripcion?: string; instrucciones?: string; abre_at?: string | null; cierra_at?: string | null;
  p_max?: number; alfa?: number; factor_anticipado?: number; incremento?: number; liberacion?: { desde: string; ejercicios: number }[];
}

// Seguimiento docente (migración 75)
export interface PoliticaControlPes { modo: 'informativo' | 'ajuste'; peso: number; descripcion: string }
export interface RespuestaHistorial {
  id: string; ejercicio: number; ejercicio_id: string; letra: string; etapa: EtapaPes; enunciado: string; formato: FormatoPes; opciones: string[] | null;
  respuesta: StudentAnswer | null; accion: 'confirmada' | 'anticipada' | 'omitida'; revelado_at: string; cerrado_at: string; segundos: number; t_min_s: number;
  m: number; q: number; revision: 'auto' | 'pendiente' | 'revisada'; validada: boolean; codigo: string | null; nota_revision: string | null;
}
export interface ControlResumen { id: string; ejercicio: number; estado: 'preparado' | 'realizado' | 'anulado'; resultado: number | null; nota: string | null; preparado_at: string; cerrado_at: string | null }
export interface HistorialPes {
  estudiante: { user_id: string; nombre: string; codigo: string | null };
  respuestas: RespuestaHistorial[];
  eventos: { tipo: string; at: string; ejercicio: number | null; letra: string | null; detalle: Record<string, unknown> }[];
  controles: ControlResumen[];
  puntaje: PuntajeServidor;
}
export interface InformeTiemposServidor {
  incremento: number; estado: string;
  apartados: { id: string; ejercicio: number; letra: string; formato: FormatoPes; t_ref_s: number; t_min_s: number;
    calibraciones: { id: string; segundos: number; fuente: 'papel' | 'simulador'; nota: string | null; at: string }[]; piloto_s: number | null }[];
}
export interface PilotoDetalle {
  puntaje: PuntajeServidor;
  respuestas: { ejercicio: number; letra: string; respuesta: StudentAnswer | null; accion: string; segundos: number; t_min_s: number; m: number; q: number;
    revision: string; estado: string | null; codigo: string | null; adelantado: boolean }[];
}
export interface ApartadoControl {
  id: string; letra: string; etapa: EtapaPes; enunciado: string; formato: FormatoPes; opciones: string[] | null; clave: Record<string, unknown> | null;
  rubrica: string; explicacion: string; variante: boolean; respuesta: StudentAnswer | null; accion: string | null; q: number | null; segundos: number | null;
}
export interface ControlPreparado {
  id: string; semilla: string; politica: PoliticaControlPes;
  propuesta: {
    ejercicio: { posicion: number; titulo: string; contexto: string; origen: string };
    apartados: ApartadoControl[];
    candidatos: { exercise_id: string; enunciado: string; formato: FormatoPes; opciones: string[] | null; clave: Record<string, unknown>; leccion: string | null }[];
  };
}
export interface ControlListaItem { id: string; user_id: string; nombre: string; ejercicio: number; estado: ControlResumen['estado']; resultado: number | null; nota: string | null; semilla: string; preparado_at: string; cerrado_at: string | null }
