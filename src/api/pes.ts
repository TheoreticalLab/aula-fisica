/**
 * Práctica Extraordinaria Secuencial (migración 74). El estudiante solo recibe el apartado abierto; las claves y las
 * rúbricas nunca salen del servidor. Confirmar pasa por la función «calificar» (acción «pes»).
 */
import { invocar, rpc, supabase } from '@/lib/supabase';
import type { DatosMonitor } from '@/lib/pesMonitor';
import type { ClienteSondas } from '@/lib/pesSondas';
import type {
  ApartadoRedactado, ApiPes, ControlListaItem, ControlPreparado, DatosPractica, DetallePes, HistorialPes, InformeBanco, InformeTiemposServidor, PesListaItem,
  PilotoDetalle, PoliticaControlPes, PuntajeServidor, RespuestaDocente, ResultadoConfirmar, ResultadoOmitir, ResumenPes, VistaPes,
  GeneracionPes, PropuestaPes, ResultadoGeneracionPes,
} from './pesTipos';
import type { EspecificacionPes } from '@/lib/pesGeneracion';

export type * from './pesTipos';

export const API_PES: ApiPes = {
  misPracticas: () => rpc<ResumenPes[]>('pes_mis_practicas'),
  iniciar: (practica) => rpc<VistaPes>('pes_iniciar', { p_practica: practica }),
  actual: (practica) => rpc<VistaPes>('pes_actual', { p_practica: practica }),
  borrador: (practica, apartado, texto, rev) => rpc<{ rev: number }>('pes_borrador', { p_practica: practica, p_apartado: apartado, p_texto: texto, p_rev: rev }),
  confirmar: (practica, apartado, answer, anticipado, idem) =>
    invocar<ResultadoConfirmar>('calificar', { action: 'pes', op: 'confirmar', practica_id: practica, apartado_id: apartado, answer, anticipado, idem }),
  omitir: (practica, apartado, idem) => rpc<ResultadoOmitir>('pes_omitir', { p_practica: practica, p_apartado: apartado, p_idem: idem }),
  evento: (practica, tipo) => rpc<void>('pes_evento_cliente', { p_practica: practica, p_tipo: tipo }),
  variante: async (practica, apartado) =>
    (await invocar<{ parametros: Record<string, number> | null }>('calificar', { action: 'pes', op: 'variante', practica_id: practica, apartado_id: apartado })).parametros,
};

// Profesorado
export const pesLista = (classId: string) => rpc<PesListaItem[]>('pes_lista_docente', { p_class: classId });
export const pesDetalle = (practica: string) => rpc<DetallePes>('pes_detalle_docente', { p_practica: practica });
export const pesCrear = (classId: string, datos: DatosPractica) => rpc<string>('pes_crear', { p_class: classId, p: datos });
export const pesEditar = (practica: string, datos: DatosPractica) => rpc<void>('pes_editar', { p_practica: practica, p: datos });
export const pesBorrar = (practica: string) => rpc<void>('pes_borrar_practica', { p_practica: practica });
export const pesBancoProblemas = (classId: string) => rpc<InformeBanco>('pes_banco_problemas', { p_class: classId });
export const pesDesdeProblema = (practica: string, problema: string, desde: number, hasta: number, tRef?: number[] | null) =>
  rpc<string>('pes_ejercicio_desde_problema', { p_practica: practica, p_problema: problema, p_desde: desde, p_hasta: hasta, p_pesos: null, p_t_ref: tRef ?? null });
export const pesDesdeBanco = (practica: string, ejercicios: string[], titulo: string, contexto: string, tRef?: number[] | null) =>
  rpc<string>('pes_ejercicio_desde_banco', { p_practica: practica, p_exercises: ejercicios, p_titulo: titulo, p_contexto: contexto, p_pesos: null, p_t_ref: tRef ?? null, p_etapas: null });
export const pesRedactado = (practica: string, datos: { titulo: string; contexto: string; apartados: ApartadoRedactado[] }) =>
  rpc<string>('pes_ejercicio_redactado', { p_practica: practica, p: datos });
export const pesBorrarEjercicio = (ejercicio: string) => rpc<void>('pes_borrar_ejercicio', { p_ejercicio: ejercicio });
export const pesPublicar = (practica: string, estudiantes?: string[] | null) =>
  rpc<{ version: number; asignados: number }>('pes_publicar', { p_practica: practica, p_estudiantes: estudiantes ?? null });
export const pesCambiarEstado = (practica: string, estado: 'cerrada' | 'archivada') => rpc<void>('pes_cambiar_estado', { p_practica: practica, p_estado: estado });
export const pesAdaptacion = (practica: string, user: string, a: { tiempo_extra_min: number; factor_espera: number; pegado: boolean; nota: string }) =>
  rpc<void>('pes_adaptacion', { p_practica: practica, p_user: user, p_tiempo_extra_min: a.tiempo_extra_min, p_factor_espera: a.factor_espera, p_pegado: a.pegado, p_nota: a.nota });
export const pesRevisar = (respuesta: string, q: number, nota: string) => rpc<void>('pes_revisar', { p_respuesta: respuesta, p_q: q, p_nota: nota });
export const pesValidar = (practica: string, user?: string | null) => rpc<number>('pes_validar', { p_practica: practica, p_user: user ?? null });
export const pesPublicarResultados = (practica: string, publicar: boolean) => rpc<void>('pes_publicar_resultados', { p_practica: practica, p_publicar: publicar });
export const pesRespuestasDocente = (practica: string, soloPendientes = true) =>
  rpc<RespuestaDocente[]>('pes_respuestas_docente', { p_practica: practica, p_solo_pendientes: soloPendientes });

// Seguimiento docente (migración 75)
export const pesMonitor = (practica: string) => rpc<DatosMonitor>('pes_monitor', { p_practica: practica });
export const pesHistorial = (practica: string, user: string) => rpc<HistorialPes>('pes_historial', { p_practica: practica, p_user: user });
export const pesCalibrar = (apartado: string, segundos: number, fuente: 'papel' | 'simulador', nota: string) =>
  rpc<string>('pes_calibrar', { p_apartado: apartado, p_segundos: segundos, p_fuente: fuente, p_nota: nota });
export const pesCalibracionBorrar = (id: string) => rpc<void>('pes_calibracion_borrar', { p_id: id });
export const pesInformeTiempos = (practica: string) => rpc<InformeTiemposServidor>('pes_informe_tiempos', { p_practica: practica });
export const pesAplicarCalibracion = (practica: string) => rpc<number>('pes_aplicar_calibracion', { p_practica: practica });
export const pesPilotoIniciar = (practica: string) => rpc<ResumenPes>('pes_piloto_iniciar', { p_practica: practica });
export const pesPilotoResumen = (practica: string) => rpc<ResumenPes | null>('pes_piloto_resumen', { p_practica: practica });
export const pesPilotoReiniciar = (practica: string) => rpc<ResumenPes>('pes_piloto_reiniciar', { p_practica: practica });
export const pesPilotoAdelantar = (practica: string, segundos: number) => rpc<void>('pes_piloto_adelantar', { p_practica: practica, p_segundos: segundos });
export const pesPilotoDetalle = (practica: string) => rpc<PilotoDetalle>('pes_piloto_detalle', { p_practica: practica });
export const pesPoliticaControl = (practica: string, p: PoliticaControlPes) => rpc<void>('pes_politica_control', { p_practica: practica, p });
export const pesControlPreparar = (practica: string, user: string, ejercicio: string) =>
  rpc<ControlPreparado>('pes_control_preparar', { p_practica: practica, p_user: user, p_ejercicio: ejercicio });
export const pesControlRegistrar = (control: string, resultado: number, nota: string) =>
  rpc<PuntajeServidor>('pes_control_registrar', { p_control: control, p_resultado: resultado, p_nota: nota });
export const pesControlAnular = (control: string, motivo: string) => rpc<void>('pes_control_anular', { p_control: control, p_motivo: motivo });
export const pesControles = (practica: string) => rpc<ControlListaItem[]>('pes_controles_lista', { p_practica: practica });

/** Cliente real de las sondas del simulador: las mismas vías que tendría un navegador (REST de tablas, RPC y «calificar»). */
export const CLIENTE_SONDAS: ClienteSondas = {
  tabla: async (t) => { const { data, error } = await supabase.from(t).select('*').limit(1); return { error: error?.message ?? null, data }; },
  rpc: async (fn, args) => { const { data, error } = await supabase.rpc(fn, args); return { error: error?.message ?? null, data }; },
  calificar: async (body) => { try { return { error: null, data: await invocar('calificar', body) }; } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; } },
};

// Problemas por apartados generados con IA (migración 76 y acción «pes_generar» de orbe-ia)
export const pesGenerarIniciar = (practica: string, spec: object, n: number) => rpc<string>('pes_generar_iniciar', { p_practica: practica, p_spec: spec, p_solicitados: n });
export const pesGenerarProblema = (generacion: string, especificacion: EspecificacionPes) =>
  invocar<ResultadoGeneracionPes>('orbe-ia', { action: 'pes_generar', generacion_id: generacion, especificacion });
export const pesGeneraciones = (practica: string) => rpc<GeneracionPes[]>('pes_generaciones_lista', { p_practica: practica });
export const pesPropuestas = (practica: string, estado: 'pendiente' | 'aceptada' | 'descartada' | null = 'pendiente') =>
  rpc<PropuestaPes[]>('pes_propuestas', { p_practica: practica, p_estado: estado });
export const pesPropuestaAceptar = (propuesta: string, problema?: { titulo: string; contexto: string; apartados: ApartadoRedactado[] } | null) =>
  rpc<string>('pes_propuesta_aceptar', { p_propuesta: propuesta, p_problema: problema ?? null });
export const pesPropuestaDescartar = (propuesta: string) => rpc<void>('pes_propuesta_descartar', { p_propuesta: propuesta });
