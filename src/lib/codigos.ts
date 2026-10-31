/** Nombre legible de los códigos del motor de calificación (supabase/functions/_shared/calificacion). */
export const CODIGO_ERROR: Record<string, string> = {
  unit_mismatch: 'unidad de otra magnitud',
  missing_unit: 'sin unidad',
  expected_unit: 'unidad no pedida',
  sign: 'signo cambiado',
  kmh: 'conversión km/h–m/s',
  time_conversion: 'conversión de tiempo',
  power_of_ten: 'potencia de 10',
  factor_two: 'factor 2',
  mass_weight: 'masa/peso',
  common_error: 'error típico previsto',
  wrong_value: 'valor incorrecto',
  wrong_option: 'opción incorrecta',
  choice_partial: 'selección incompleta',
  wrong_text: 'respuesta escrita incorrecta',
  sig_figs: 'cifras significativas',
  parse_error: 'formato no reconocido',
  unit_format: 'unidad mal escrita o no reconocida',
  blank: 'sin responder',
  empty: 'sin responder',
  manual: 'requiere revisión del profesor',
};

export const nombreCodigo = (c: string | null | undefined) => (c ? CODIGO_ERROR[c] ?? c.replace(/_/g, ' ') : '—');
