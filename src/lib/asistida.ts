/**
 * Práctica con aprendizaje asistido: INTENTA → RECIBE AYUDA → CORRIGE → EXPLICA → DEMUESTRA (lógica pura, probada).
 * Métricas pedagógicas independientes de LIEIA. Nombres honestos: «rendimiento inicial DECLARADO» (no «dominio autónomo»),
 * «rendimiento posterior a la asistencia». Ninguna nota depende de la declaración de uso de IA.
 */
import { parseQuantity } from '@calif/calificar.ts';
import type { StudentAnswer } from '@/api/tipos';

export type Fase = 'inicial' | 'corregida' | 'reflexion' | 'transferencia';
export type Siguiente = Fase | 'completo';
export type Declaracion = 'autonomo' | 'consulto_ayuda' | 'no_pudo';
export type Fuente = 'ia' | 'libro' | 'apuntes' | 'persona' | 'video' | 'simulador' | 'ninguna';

export const DECLARACION: Record<Declaracion, string> = {
  autonomo: 'Lo resolví por mí mismo, sin utilizar IA ni ayuda externa.',
  consulto_ayuda: 'Consulté alguna ayuda antes de responder.',
  no_pudo: 'No conseguí resolverlo por mi cuenta.',
};
export const FUENTE: Record<Fuente, string> = {
  ia: 'Inteligencia artificial', libro: 'Libro o material académico', apuntes: 'Apuntes', persona: 'Explicación de otra persona',
  video: 'Videos educativos', simulador: 'Simuladores', ninguna: 'Ninguna ayuda',
};

export interface Paso {
  fase: Fase; version: number; answer: StudentAnswer | null; procedimiento: string | null; explicacion: string | null; no_se: boolean;
  declaracion: Declaracion | null; fuentes: Fuente[] | null; reflexion: Record<string, string> | null;
  referencias: { fuente: string; enlace?: string; concepto?: string; idea?: string }[] | null;
  status: string | null; credit: number | null; messages: string[] | null; created_at: string;
}
export interface EstadoItem {
  exercise_id: string; siguiente: Siguiente; correcciones: number; con_transferencia: boolean; pasos: Paso[];
  transferencia: { id: string; prompt: string; format: string; options: string[] | null; multiple: boolean; figure: unknown; unit_hint: string | null; concepts: string[] } | null;
  solucion: { answer: unknown; explanation: string } | null;
  calificacion: { credito: number; inicial: number; correccion: number; justificacion: number; transferencia: number | null; pesos: Pesos; estado_final: string | null } | null;
}
export interface Pesos { inicial: number; correccion: number; justificacion: number; transferencia: number }

export const PESOS_POR_DEFECTO: Pesos = { inicial: 20, correccion: 30, justificacion: 20, transferencia: 30 };

export const ultimo = (pasos: Paso[], fase: Fase) => [...pasos].filter((p) => p.fase === fase).sort((a, b) => b.version - a.version)[0] ?? null;

/** Pasos visibles para el estudiante en el móvil: 1 Intentar · 2 Aprender · 3 Explicar · 4 Comprobar (si hay transferencia). */
export function pasosVisibles(conTransferencia: boolean): { fase: Fase; titulo: string }[] {
  const l: { fase: Fase; titulo: string }[] = [{ fase: 'inicial', titulo: 'Intentar' }, { fase: 'corregida', titulo: 'Aprender' }, { fase: 'reflexion', titulo: 'Explicar' }];
  if (conTransferencia) l.push({ fase: 'transferencia', titulo: 'Comprobar' });
  return l;
}

/** Qué cambió entre la primera respuesta y la respuesta después de estudiar. */
export type Cambio = 'sin_cambio' | 'valor' | 'unidad' | 'valor_y_unidad' | 'opcion' | 'texto' | 'de_no_se_a_respuesta' | 'sin_comparar';
export const CAMBIO: Record<Cambio, string> = {
  sin_cambio: 'Mantuvo su respuesta', valor: 'Cambió el valor numérico', unidad: 'Cambió solo la unidad', valor_y_unidad: 'Cambió el valor y la unidad',
  opcion: 'Cambió la opción elegida', texto: 'Cambió su respuesta', de_no_se_a_respuesta: 'Pasó de «no sé» a una respuesta', sin_comparar: '—',
};

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

export function compararRespuestas(formato: string, ini: Paso | null, fin: Paso | null): { cambio: Cambio; procedimientoCambio: boolean } {
  const procedimientoCambio = !!fin && norm(ini?.procedimiento ?? '') !== norm(fin.procedimiento ?? '') && !!(fin.procedimiento ?? '').trim();
  if (!ini || !fin) return { cambio: 'sin_comparar', procedimientoCambio };
  if (ini.no_se) return { cambio: 'de_no_se_a_respuesta', procedimientoCambio };
  const a = ini.answer ?? {}, b = fin.answer ?? {};
  if (formato === 'choice' || formato === 'truefalse') {
    const ka = JSON.stringify([...(a.selected ?? [])].sort()) + String(a.value), kb = JSON.stringify([...(b.selected ?? [])].sort()) + String(b.value);
    return { cambio: ka === kb ? 'sin_cambio' : 'opcion', procedimientoCambio };
  }
  if (formato === 'numeric') {
    const qa = parseQuantity(a.text ?? ''), qb = parseQuantity(b.text ?? '');
    if (!qa.ok || !qb.ok) return { cambio: norm(a.text ?? '') === norm(b.text ?? '') ? 'sin_cambio' : 'texto', procedimientoCambio };
    const mismoValor = Math.abs(qa.q.value - qb.q.value) <= 1e-9 * Math.max(1, Math.abs(qa.q.value));
    const mismaUnidad = norm(qa.q.unitText) === norm(qb.q.unitText);
    return { cambio: mismoValor && mismaUnidad ? 'sin_cambio' : mismoValor ? 'unidad' : mismaUnidad ? 'valor' : 'valor_y_unidad', procedimientoCambio };
  }
  return { cambio: norm(a.text ?? '') === norm(b.text ?? '') ? 'sin_cambio' : 'texto', procedimientoCambio };
}

/** Caso para adaptar la reflexión (el resultado del primer intento solo se conoce tras guardar la corrección). */
export type Caso = 'no_sabia' | 'correcto' | 'incorrecto';
export function casoReflexion(pasos: Paso[]): Caso {
  const ini = ultimo(pasos, 'inicial');
  if (!ini || ini.no_se) return 'no_sabia';
  return ini.status === 'correct' ? 'correcto' : 'incorrecto';
}

export const PREGUNTAS: Record<Caso, { clave: string; texto: string; ejemplo?: string }[]> = {
  incorrecto: [
    { clave: 'error', texto: '¿Dónde estaba tu error?', ejemplo: 'Confundí el punto de equilibrio con el punto de retorno.' },
    { clave: 'porque', texto: '¿Por qué tu razonamiento inicial no era correcto?' },
    { clave: 'principio', texto: '¿Qué principio físico utilizaste para corregirlo?', ejemplo: 'Conservación de la energía mecánica.' },
  ],
  correcto: [
    { clave: 'comprobacion', texto: '¿Cómo comprobaste que tu respuesta era correcta?' },
    { clave: 'aprendizaje', texto: '¿Qué aprendiste o confirmaste?' },
    { clave: 'alternativa', texto: '¿Encontraste otra forma de resolver el problema? (opcional)' },
  ],
  no_sabia: [
    { clave: 'concepto', texto: '¿Qué concepto necesitabas comprender?' },
    { clave: 'paso', texto: '¿Cuál fue el paso que te permitió comenzar?' },
    { clave: 'semejante', texto: '¿Cómo resolverías ahora un ejercicio semejante?' },
  ],
};

/** Justificación presentada (mismo criterio que el servidor: alguna respuesta con ≥ 15 caracteres). */
export const reflexionPresentada = (r: Record<string, string> | null | undefined) => !!r && Object.values(r).some((v) => (v ?? '').trim().length >= 15);

/**
 * Nota compuesta de un ejercicio (espejo de asistida_credito en SQL, para vista previa y pruebas).
 * Sin transferencia, los pesos activos se reparten proporcionalmente (regla explícita y visible).
 */
export function notaCompuesta(p: Pesos, c: { inicial: boolean; correccion: number; justificacion: boolean; transferencia: number | null }) {
  const conT = c.transferencia !== null;
  const den = p.inicial + p.correccion + p.justificacion + (conT ? p.transferencia : 0);
  if (!den) return { credito: 0, efectivos: { ...p, transferencia: 0 } };
  const ef = (w: number) => Math.round((1000 * w) / den) / 10;
  return {
    credito: Math.round(1000 * ((p.inicial * (c.inicial ? 1 : 0) + p.correccion * c.correccion + p.justificacion * (c.justificacion ? 1 : 0) + (conT ? p.transferencia * c.transferencia! : 0)) / den)) / 1000,
    efectivos: { inicial: ef(p.inicial), correccion: ef(p.correccion), justificacion: ef(p.justificacion), transferencia: conT ? ef(p.transferencia) : 0 },
  };
}

/** Resumen de la sección para el profesor (proporciones sobre los ejercicios con primer intento). */
export function resumenSeccion(filas: { ejercicio: string; item: EstadoItem }[]) {
  const conIni = filas.filter((f) => ultimo(f.item.pasos, 'inicial'));
  const pct = (n: number, d: number) => (d ? n / d : null);
  const ini = conIni.map((f) => ultimo(f.item.pasos, 'inicial')!);
  const declaroAyuda = ini.filter((p) => p.declaracion === 'consulto_ayuda').length;
  const noPudo = ini.filter((p) => p.declaracion === 'no_pudo' || p.no_se).length;
  const inicialCorrecto = ini.filter((p) => p.status === 'correct').length;
  const fin = conIni.map((f) => ultimo(f.item.pasos, 'corregida')).filter((p): p is Paso => !!p);
  const finalCorrecto = fin.filter((p) => p.status === 'correct').length;
  const refl = conIni.filter((f) => reflexionPresentada(ultimo(f.item.pasos, 'reflexion')?.reflexion)).length;
  const tr = conIni.map((f) => ultimo(f.item.pasos, 'transferencia')).filter((p): p is Paso => !!p);
  const fuentes = new Map<Fuente, number>();
  conIni.forEach((f) => (ultimo(f.item.pasos, 'reflexion')?.fuentes ?? []).forEach((x) => fuentes.set(x, (fuentes.get(x) ?? 0) + 1)));
  // ejercicios donde más estudiantes pasaron de un primer intento no correcto a una respuesta correcta
  const porEjercicio = new Map<string, { con: number; corrigieron: number }>();
  conIni.forEach((f) => {
    const e = porEjercicio.get(f.ejercicio) ?? { con: 0, corrigieron: 0 };
    e.con++;
    const i = ultimo(f.item.pasos, 'inicial')!, c = ultimo(f.item.pasos, 'corregida');
    if (i.status !== 'correct' && c?.status === 'correct') e.corrigieron++;
    porEjercicio.set(f.ejercicio, e);
  });
  return {
    con_intento: conIni.length,
    declaro_ayuda: pct(declaroAyuda, conIni.length), no_pudo: pct(noPudo, conIni.length),
    rendimiento_inicial_declarado: pct(inicialCorrecto, conIni.length),
    rendimiento_posterior: pct(finalCorrecto, fin.length), con_correccion: fin.length,
    reflexion: pct(refl, conIni.length),
    transferencia: pct(tr.filter((p) => p.status === 'correct').length, tr.length), con_transferencia: tr.length,
    fuentes: [...fuentes.entries()].sort((a, b) => b[1] - a[1]),
    correcciones_por_ejercicio: [...porEjercicio.entries()].map(([ejercicio, v]) => ({ ejercicio, ...v })).sort((a, b) => b.corrigieron - a.corrigieron),
  };
}
