/**
 * Telemetría V2 · contratos del motor de reconstrucción (ver docs/TELEMETRIA_V2.md §2).
 * El motor es puro: no lee el reloj del sistema ni la red. La misma entrada, versión y parámetros → la misma salida.
 */

export const VERSION_MOTOR = 'telemetria-v2/reconstruccion@1.0.0';

export interface Parametros {
  /** Sin interacción durante más de esto (con la página visible) = inactiva. */
  inactividad_ms: number;
  /** Con la página visible y activa, el cliente emite algo al menos cada inactividad_ms + margen (el detector de
   *  inactividad lo garantiza); un silencio más largo indica que el navegador estuvo suspendido: «desconocido». */
  margen_vida_ms: number;
  /** Duración atribuida a una interacción puntual para T_interaction (estimación declarada). */
  ventana_interaccion_ms: number;
  /** Tolerancia de las comprobaciones de invariantes. */
  tolerancia_ms: number;
  /** Umbral para contar un evento como «muy retrasado». */
  retraso_alto_ms: number;
}

export const PARAMETROS_POR_DEFECTO: Parametros = {
  inactividad_ms: 60_000, margen_vida_ms: 15_000, ventana_interaccion_ms: 5_000, tolerancia_ms: 1, retraso_alto_ms: 30_000,
};

export type TipoEvento =
  | 'sesion_inicio' | 'sesion_fin' | 'latido' | 'sincronizacion'
  | 'visible' | 'oculta' | 'foco_ganado' | 'foco_perdido' | 'conexion_perdida' | 'conexion_restaurada'
  | 'inactividad_inicio' | 'inactividad_fin'
  | 'exposicion_inicio' | 'exposicion_fin' | 'pregunta_activada' | 'pregunta_desactivada'
  | 'interaccion' | 'edicion' | 'guardado_solicitado' | 'guardado_confirmado' | 'guardado_fallido' | 'comprobacion'
  | 'pausa_inicio' | 'pausa_fin' | 'apertura' | 'entrega' | 'entrega_solicitada'
  | 'estado';

/**
 * Evento normalizado (independiente de la fuente: V1, V2, diario del examen, servidor).
 *  - `tau`: reloj monotónico de la sesión del navegador (ms desde su inicio). Se ancla con `recibido`.
 *  - `t`: hora absoluta del servidor (ms) cuando ya se conoce (hechos del servidor, tramos conciliados del examen).
 */
export interface EventoNorm {
  sesion: string;
  seq: number;
  tipo: TipoEvento;
  fuente: 'cliente' | 'servidor' | 'diario';
  tau?: number | null;
  t?: number | null;
  recibido?: number | null;
  pregunta?: string | null;
  datos?: Record<string, unknown>;
  /** referencia al registro original (tabla:id) para la auditoría */
  ref?: string;
}

export type Atribucion = 'servidor' | 'control' | 'unica' | 'ambigua';

export interface Entrada {
  intento: { inicio: number; fin: number | null };
  preguntas: string[];
  eventos: EventoNorm[];
  modalidad: 'practica' | 'examen' | 'asistida';
  /** Cómo se sabe qué pregunta está activa: servidor (examen), control enfocado (práctica V2), única pregunta, o no se sabe. */
  atribucion: Atribucion;
  /** Origen de los datos, para las advertencias (p. ej. 'v1' marca la exposición como poco fiable). */
  origen: 'v1' | 'v2' | 'diario_examen';
  parametros?: Partial<Parametros>;
}

export type EstadoMetrica = 'observado' | 'reconstruido' | 'estimado' | 'no_identificable' | 'informacion_insuficiente' | 'dato_temporal_invalido';

export interface Metrica { valor: number | null; estado: EstadoMetrica; nota?: string }

export type Categoria = 'sin_observacion' | 'conflicto' | 'desconocido' | 'pausa_declarada' | 'oculta' | 'inactiva' | 'sin_foco' | 'observable_activo';
export const CATEGORIAS: Categoria[] = ['sin_observacion', 'conflicto', 'desconocido', 'pausa_declarada', 'oculta', 'inactiva', 'sin_foco', 'observable_activo'];

export interface Tramo { inicio: number; fin: number; cat: Categoria }

export interface InfoSesion {
  sesion: string;
  eventos: number;
  ancla: number | null;
  ancla_tipo: 'sincronizacion' | 'cota_recepcion' | 'absoluta' | 'invalida';
  incertidumbre_ms: number | null;
  cobertura: { inicio: number; fin: number } | null;
  huecos_secuencia: number;
  duplicados: number;
  muy_retrasados: number;
  retraso_max_ms: number | null;
  reloj_retrocede: number;
  /** identificador de pestaña (sobrevive a las recargas de esa pestaña), si la fuente lo registra */
  pestana: string | null;
}

/** Relación entre dos sesiones consecutivas (fase 3.4): nunca se fusionan como si la observación fuera continua. */
export interface Continuidad {
  de: string; a: string; hueco_ms: number;
  tipo: 'misma_pestana' | 'otra_pestana' | 'simultaneas' | 'desconocida';
}

export type NivelCalidad = 'buena' | 'parcial' | 'baja' | 'sin_datos';

export interface CalidadPregunta {
  temporal: NivelCalidad;
  cobertura: number | null;          // fracción observada de la ventana de la pregunta
  atribucion: Atribucion;
  completitud: 'completa' | 'con_perdidas' | 'sin_datos';
  respuesta: 'confirmada' | 'escrito_sin_confirmar' | 'sin_respuesta' | 'sin_datos';
  sincronizacion: { guardados_ok: number; guardados_fallidos: number };
}

export interface ResultadoPregunta {
  pregunta: string;
  T_wall: Metrica;
  T_exposure: Metrica;
  T_focus: Metrica;
  T_interaction: Metrica;
  T_edit: Metrica;
  T_candidate_work: Metrica;
  T_until_first_response: Metrica;
  visitas: Metrica;
  ediciones: number;
  borrados: number;
  primera_exposicion: number | null;
  primera_activacion: number | null;
  primera_respuesta: number | null;
  ultimo_guardado_confirmado: number | null;
  calidad: CalidadPregunta;
  advertencias: string[];
}

export interface EventoReconstruido {
  sesion: string; seq: number; tipo: TipoEvento; fuente: EventoNorm['fuente']; pregunta: string | null;
  t: number | null; tau: number | null; recibido: number | null; retraso_ms: number | null; ref?: string;
}

export interface Reconstruccion {
  version: string;
  parametros: Parametros;
  origen: Entrada['origen'];
  modalidad: Entrada['modalidad'];
  dominio: { inicio: number; fin: number };
  T_wall: number;
  particion: Tramo[];
  totales: Record<Categoria, number>;
  T_disconnected: Metrica;
  sin_red: { inicio: number; fin: number }[];
  sesiones: InfoSesion[];
  continuidades: Continuidad[];
  preguntas: ResultadoPregunta[];
  eventos: EventoReconstruido[];
  invariantes: string[];
  advertencias: string[];
}
