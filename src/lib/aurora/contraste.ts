/**
 * AURORA-07 (migración 105): contraste de las declaraciones de la entrevista con los registros disponibles e informe para
 * el profesor. Reglas fijas y deterministas, sin modelos de lenguaje. Solo se clasifican afirmaciones TÉCNICAS (conexión,
 * recargas, repetición de ejercicios, uso de papel, salidas de la pantalla, intervalos); las explicaciones y los
 * procedimientos quedan para revisión humana. La velocidad nunca se usa como prueba de nada.
 */

export type Clasificacion = 'corroborada' | 'compatible' | 'contradicha' | 'no_verificable';
export const NOMBRE_CLASIFICACION: Record<Clasificacion, string> = {
  corroborada: 'Corroborada',
  compatible: 'Compatible, no confirmada',
  contradicha: 'Contradicha por registros fiables',
  no_verificable: 'No verificable',
};

export interface OpcionGuion { valor: string; texto: string; pide_texto?: boolean; siguiente?: string }
export interface NodoGuion {
  tipo: 'info' | 'opcion' | 'texto' | 'fin';
  texto: string;
  boton?: string;
  opciones?: OpcionGuion[];
  siguiente?: string;
  ramas?: { si: { nodo: string; en: string[] }; ir: string }[];
  max?: number;
  opcional?: boolean;
  /** código de la afirmación técnica que se contrasta (ver REGLAS) */
  afirmacion?: string;
  /** presentación del maratón a la que se refiere la pregunta */
  episodio?: string;
  /** respuesta que debe leer el profesor (procedimientos, explicaciones) */
  revision?: boolean;
}
export interface Guion { inicio: string; nodos: Record<string, NodoGuion> }

export interface RespuestaAurora { nodo: string; pregunta: string; valor: string | null; texto: string | null; mostrada: string; at: string }
export interface EtapaReg { etapa: number; at: string; correcta: boolean; segundos_cliente: number | null; respuesta: unknown }
export interface PresentacionReg {
  id: string; jornada: number; secuencia: number; titulo: string | null; tema: string; nivel: number;
  variante_id: string; plantilla_id: string; presentada_at: string; cerrada_at: string | null;
  accion: string | null; resultado: string | null; segundos: number | null; segundos_cliente: number | null;
  t_min_s: number; anticipada: boolean | null; respuesta: unknown; procedimiento: string | null; etapas_total: number;
  etapas: EtapaReg[];
}
export interface VisitaReg {
  seccion: string; pestana: string; inicio: string; ultimo_latido: string;
  efectivo_s: number; oculto_s: number; inactivo_s: number; tras_desconexion: boolean;
}
export interface JornadaReg { numero: number; fecha: string; estado: string; iniciada_at: string | null; cerrada_at: string | null; correctas: number; incorrectas: number; intentos_validos: number; presentados: number; segundos: number; via: string | null; no_puedo: number; cambios: number }
export interface EventoReg { tipo: string; jornada: number | null; at: string; datos: unknown }
export interface InformeAurora {
  entrevista: {
    id: string; titulo: string; titulo_informe: string; estado: 'preparada' | 'abierta' | 'finalizada'; jornadas: number[];
    guion: Guion; nodo_actual: string | null; habilitada_at: string | null; iniciada_at: string | null; finalizada_at: string | null;
    habilitada_por: string | null;
  };
  estudiante: { nombre: string; login_id: string | null };
  maraton: { titulo: string; seccion: string | null; fecha_inicio: string | null };
  respuestas: RespuestaAurora[];
  jornadas: JornadaReg[];
  presentaciones: PresentacionReg[];
  eventos: EventoReg[];
  visitas: VisitaReg[];
}

export interface Hallazgo { nodo: string; pregunta: string; declaracion: string; clasificacion: Clasificacion; fundamento: string }
export interface Pendiente { origen: string; detalle: string }

const ZONA = 'America/Santo_Domingo';
const fmtHora = new Intl.DateTimeFormat('es-DO', { timeZone: ZONA, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' });
export const hora = (iso: string | null | undefined) => (iso ? fmtHora.format(new Date(iso)) : '—');
const dia = (iso: string) => fmtDia.format(new Date(iso));
export function duracion(s: number | null | undefined): string {
  if (s == null || !Number.isFinite(s)) return '—';
  const t = Math.round(s);
  if (t < 60) return `${t} s`;
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), r = t % 60;
  return h ? `${h} h ${m} min` : r ? `${m} min ${r} s` : `${m} min`;
}

/** Segundos que el problema estuvo abierto según el reloj del servidor. */
export const abiertoS = (p: PresentacionReg) => (p.cerrada_at ? (Date.parse(p.cerrada_at) - Date.parse(p.presentada_at)) / 1000 : null);

export interface Indicadores {
  /** problemas abiertos ≥ 10 min con menos de la mitad de ese tiempo registrado como actividad por el navegador */
  pausas: PresentacionReg[];
  variantesRepetidas: string[];
  plantillasRepetidas: string[];
  temasRepetidos: string[];
  /** problemas que aparecieron sin que el anterior de la misma jornada se cerrara con una acción registrada */
  cambiosSinAccion: number;
  desconexiones: VisitaReg[];
  pestanas: number;
}

const repetidos = (xs: string[]) => [...new Set(xs.filter((x, i) => xs.indexOf(x) !== i))];

export function indicadores(inf: InformeAurora): Indicadores {
  const ps = [...inf.presentaciones].sort((a, b) => a.secuencia - b.secuencia);
  const pausas = ps.filter((p) => {
    const ab = abiertoS(p);
    return ab != null && ab >= 600 && p.segundos_cliente != null && p.segundos_cliente < ab / 2;
  });
  let cambiosSinAccion = 0;
  for (let k = 1; k < ps.length; k++) {
    const a = ps[k - 1], b = ps[k];
    if (a.jornada === b.jornada && (!a.cerrada_at || !a.accion)) cambiosSinAccion++;
  }
  return {
    pausas,
    variantesRepetidas: repetidos(ps.map((p) => p.variante_id)),
    plantillasRepetidas: repetidos(ps.map((p) => p.plantilla_id)),
    temasRepetidos: repetidos(ps.map((p) => p.tema)),
    cambiosSinAccion,
    desconexiones: inf.visitas.filter((v) => v.tras_desconexion),
    pestanas: new Set(inf.visitas.map((v) => v.pestana)).size,
  };
}

const listaPausas = (ps: PresentacionReg[]) =>
  ps.map((p) => `«${p.titulo ?? p.plantilla_id}» (jornada ${p.jornada}: abierto ${duracion(abiertoS(p))}, actividad registrada ${duracion(p.segundos_cliente)})`).join('; ');
const NOTA_ACTIVIDAD = 'El navegador solo cuenta como actividad el tiempo con la página visible y alguna interacción en los últimos 2 min; no distingue entre página oculta, trabajo en papel o inactividad, y es una medida del propio navegador.';

type Regla = (valor: string, ctx: { inf: InformeAurora; ind: Indicadores; nodo: NodoGuion; r: RespuestaAurora }) => [Clasificacion, string, Pendiente?] | null;

/** Reglas por código de afirmación. Devuelven la clasificación, su fundamento y, si procede, un punto para revisión humana. */
export const REGLAS: Record<string, Regla> = {
  conexion: (v, { ind }) => {
    const d = ind.desconexiones;
    const base = 'El maratón no registra desconexiones.';
    const ev = d.length ? ` En la página de inicio del aula, esos días, el navegador envió datos tras una desconexión ${d.length} ${d.length === 1 ? 'vez' : 'veces'} (${d.map((x) => hora(x.inicio)).join(', ')}).` : ' En la página de inicio del aula no consta ningún envío tras una desconexión esos días.';
    if (v === 'si_varias' || v === 'si_alguna') return [d.length ? 'compatible' : 'no_verificable', base + ev];
    return ['no_verificable', base + ev];
  },
  dispositivo: (v, { ind }) => {
    const ev = 'El maratón no registra el dispositivo.' + (ind.pestanas ? ` En la página de inicio del aula constan ${ind.pestanas} pestañas o navegadores distintos esos días (una recarga conserva la misma).` : ' No hay visitas a la página de inicio del aula esos días.');
    return [v === 'varios' && ind.pestanas > 1 ? 'compatible' : 'no_verificable', ev];
  },
  recarga: () => ['no_verificable', 'Las recargas de la página del maratón no se registran. Al recargar, el servidor devuelve el mismo problema abierto.'],
  recarga_resultado: (v, { ind }) => {
    if (v === 'mismo') return ['compatible', 'Es como funciona el sistema: el problema abierto se conserva al recargar. La recarga en sí no se registra.'];
    if (v === 'distinto') {
      return ind.cambiosSinAccion === 0
        ? ['contradicha', 'Cada cambio de problema en estas jornadas corresponde a una acción registrada por el servidor (respuesta, «No puedo», cambio de ejercicio o cierre); una recarga no cambia el problema abierto.']
        : ['compatible', `Hay ${ind.cambiosSinAccion} cambio(s) de problema sin una acción registrada en el anterior.`];
    }
    if (v === 'perdi_texto') return ['compatible', 'La página del maratón no conserva lo escrito sin enviar cuando se recarga. La recarga en sí no se registra.'];
    return null;
  },
  reaparicion: (v, { ind }) => {
    const var0 = ind.variantesRepetidas.length === 0, pl0 = ind.plantillasRepetidas.length === 0;
    if (v === 'maraton_mismos_datos') {
      return var0
        ? ['contradicha', 'El servidor registra la variante (enunciado con sus datos) de cada problema presentado: ninguna se repitió en estas jornadas, y el sistema excluye las variantes que el estudiante ya recibió.']
        : ['corroborada', `Variantes repetidas: ${ind.variantesRepetidas.join(', ')}.`];
    }
    if (v === 'maraton_mismo_tipo') {
      if (!pl0) return ['corroborada', `Se repitió el mismo tipo de problema (plantilla) con otros datos: ${ind.plantillasRepetidas.join(', ')}.`];
      return ind.temasRepetidos.length
        ? ['compatible', `Ningún tipo de problema (plantilla) se repitió, pero hubo varios problemas del mismo tema (${ind.temasRepetidos.join(', ')}), que pueden parecer del mismo tipo.`]
        : ['contradicha', 'Ningún tipo de problema (plantilla) ni tema se repitió en estas jornadas.'];
    }
    if (v === 'curso') {
      return ['no_verificable', 'Los problemas del maratón son de los mismos tipos que los del curso; los registros del maratón no permiten saber si vio uno igual en clase, exámenes o prácticas.',
        { origen: 'Ejercicios vistos antes', detalle: 'Preguntar cuál ejercicio y dónde lo vio, y compararlo con el enunciado registrado.' }];
    }
    if (v === 'no') return var0 && pl0 ? ['corroborada', 'Ninguna variante ni tipo de problema se repitió en estas jornadas.'] : ['compatible', 'Hubo tipos de problema repetidos con otros datos.'];
    return ['no_verificable', 'Sin una afirmación concreta que contrastar.'];
  },
  previo: (v) => {
    if (v === 'si' || v === 'en_parte') {
      return ['no_verificable', 'Los registros del maratón no muestran trabajo hecho fuera de él.',
        { origen: 'Ejercicios resueltos antes', detalle: 'Pedir el ejercicio y la resolución previa que menciona.' }];
    }
    return ['no_verificable', 'Los registros del maratón no muestran trabajo hecho fuera de él.'];
  },
  papel: (v, { ind }) => {
    if (v === 'si' || v === 'algunos') {
      return ind.pausas.length
        ? ['compatible', `En ${ind.pausas.length} problema(s) el ejercicio estuvo abierto bastante más tiempo del que el navegador registró como actividad: ${listaPausas(ind.pausas)}. Es lo esperable al trabajar en papel sin tocar la pantalla, aunque admite otras explicaciones. ${NOTA_ACTIVIDAD}`]
        : ['no_verificable', `No hay registros sobre el uso de papel. ${NOTA_ACTIVIDAD}`];
    }
    return ['no_verificable', 'No hay registros sobre el uso de papel.'];
  },
  hojas: (v) => (v === 'si'
    ? ['no_verificable', 'Se comprueba pidiendo las hojas.', { origen: 'Hojas de cálculo', detalle: 'Solicitar las hojas y compararlas con las respuestas y las horas registradas.' }]
    : ['no_verificable', 'Declara no conservar las hojas.']),
  fuera_pantalla: (v, { ind }) => {
    if (v === 'no') {
      return ['compatible', `Los registros no lo contradicen. ${NOTA_ACTIVIDAD}${ind.pausas.length ? ` Problemas con mucho tiempo abierto y poca actividad registrada: ${listaPausas(ind.pausas)}.` : ''}`];
    }
    const humano: Record<string, string> = {
      si_persona: 'Declara haber consultado a otra persona: aclarar a quién, en qué problemas y para qué.',
      si_ia: 'Declara haber usado una herramienta de inteligencia artificial: aclarar cuál, en qué problemas y para qué.',
      si_pagina: 'Declara haber usado otra página o aplicación: aclarar cuál y para qué.',
    };
    return ['no_verificable', `No se registran las aplicaciones, pestañas ni dispositivos usados fuera de la página. ${NOTA_ACTIVIDAD}`,
      humano[v] ? { origen: 'Recursos fuera de la página', detalle: humano[v] } : undefined];
  },
  intervalo: (v, { inf, nodo }) => {
    const p = inf.presentaciones.find((x) => x.id === nodo.episodio);
    if (!p) return ['no_verificable', 'No se encontró el registro del problema.'];
    const ab = abiertoS(p) ?? 0, ac = p.segundos_cliente ?? 0;
    const datos = `«${p.titulo ?? p.plantilla_id}»: presentado ${hora(p.presentada_at)}, cerrado ${hora(p.cerrada_at)} (reloj del servidor: ${duracion(ab)}); actividad registrada por el navegador: ${duracion(ac)}.`;
    if (v === 'deje_volvi') return [ab - ac >= 600 ? 'compatible' : 'no_verificable', `${datos} ${NOTA_ACTIVIDAD}`];
    if (v === 'continuo') return [ac >= ab / 2 ? 'compatible' : 'no_verificable', `${datos} ${NOTA_ACTIVIDAD} La única medida disponible no es concluyente.`];
    if (v === 'tecnico') {
      const d = inf.visitas.filter((x) => x.tras_desconexion && dia(x.inicio) === dia(p.presentada_at));
      return [d.length ? 'compatible' : 'no_verificable', `${datos} El maratón no registra fallos técnicos.${d.length ? ` Ese día, en la página de inicio, constan envíos tras una desconexión (${d.map((x) => hora(x.inicio)).join(', ')}).` : ''}`];
    }
    return ['no_verificable', datos];
  },
  evolucion: (v, { inf }) => {
    const nota = `Jornadas contrastadas: ${inf.entrevista.jornadas.join(' y ')}.`;
    if (v === 'estudio') return ['compatible', `Hubo pausas entre sesiones de trabajo en las que pudo estudiar; los registros no muestran qué hizo en ellas. ${nota}`];
    if (v === 'ayuda' || v === 'herramientas') {
      return ['no_verificable', `No hay registros de ayudas externas. ${nota}`,
        { origen: 'Evolución del rendimiento', detalle: 'Declara ayuda u otras herramientas: aclarar cuáles, cuándo y en qué problemas.' }];
    }
    return ['no_verificable', `Explicación personal; no hay registros que la confirmen ni la contradigan. ${nota}`];
  },
};

/** Clasifica cada declaración técnica y reúne los puntos para revisión humana. */
export function contrastar(inf: InformeAurora): { hallazgos: Hallazgo[]; pendientes: Pendiente[]; ind: Indicadores } {
  const ind = indicadores(inf);
  const hallazgos: Hallazgo[] = [];
  const pendientes: Pendiente[] = [];
  for (const r of inf.respuestas) {
    const nodo = inf.entrevista.guion.nodos[r.nodo];
    if (!nodo) continue;
    const opcion = nodo.opciones?.find((o) => o.valor === r.valor);
    if (nodo.afirmacion && r.valor != null) {
      const regla = REGLAS[nodo.afirmacion];
      const res = regla?.(r.valor, { inf, ind, nodo, r });
      if (res) {
        hallazgos.push({ nodo: r.nodo, pregunta: r.pregunta, declaracion: r.mostrada, clasificacion: res[0], fundamento: res[1] });
        if (res[2]) pendientes.push(res[2]);
      }
    }
    if (nodo.revision && r.texto) {
      const p = nodo.episodio ? inf.presentaciones.find((x) => x.id === nodo.episodio) : undefined;
      pendientes.push({ origen: p ? `Procedimiento: «${p.titulo ?? p.plantilla_id}» (jornada ${p.jornada})` : 'Explicación del estudiante',
        detalle: p ? 'Comparar el procedimiento declarado con las respuestas registradas de ese problema (anexo de registros).' : `«${r.pregunta.split('\n')[0]}»: leer la explicación completa (declaraciones).` });
    }
    if (opcion?.pide_texto && r.texto && !nodo.revision) {
      pendientes.push({ origen: 'Respuesta abierta', detalle: `«${r.pregunta.split('\n')[0]}»: leer la explicación del estudiante.` });
    }
  }
  return { hallazgos, pendientes, ind };
}

/** Texto del estudiante dentro del Markdown: sin formato, enlaces, imágenes ni fórmulas. */
export function textoPlano(s: string): string {
  return s.replace(/([\\`*_{}[\]()#+\-.!|$<>~])/g, '\\$1').replace(/\r?\n/g, '  \n');
}
const celda = (s: string) => textoPlano(s).replace(/ {2}\n/g, ' ');
const json = (x: unknown) => (x == null ? '—' : typeof x === 'string' ? x : JSON.stringify(x));
const partes = (x: unknown): string => {
  const o = x as { partes?: unknown[] } | null;
  return Array.isArray(o?.partes) ? o!.partes.map((p) => json(p)).join(' · ') : json(x);
};

const ESTADO: Record<InformeAurora['entrevista']['estado'], string> = {
  preparada: 'Preparada (no habilitada: el estudiante todavía no la ve)', abierta: 'Habilitada, sin terminar', finalizada: 'Terminada',
};
const ACCION: Record<string, string> = { respuesta: 'Respuesta', no_puedo: '«No puedo»', cambio: 'Cambio de ejercicio', cierre: 'Cierre de jornada' };

/** Documento del informe en Markdown (se muestra en la página y se descarga). */
export function informeMarkdown(inf: InformeAurora, generado = new Date().toISOString()): string {
  const { hallazgos, pendientes, ind } = contrastar(inf);
  const e = inf.entrevista;
  const L: string[] = [];
  L.push(`# ${textoPlano(e.titulo_informe)}`, '');
  L.push(`- **Estudiante:** ${textoPlano(inf.estudiante.nombre)}${inf.estudiante.login_id ? ` (${textoPlano(inf.estudiante.login_id)})` : ''}`);
  L.push(`- **Actividad:** ${textoPlano(inf.maraton.titulo)}${inf.maraton.seccion ? ` · ${textoPlano(inf.maraton.seccion)}` : ''} · jornadas ${e.jornadas.join(' y ')}`);
  L.push(`- **Entrevista:** ${ESTADO[e.estado]}. Habilitada ${hora(e.habilitada_at)}${e.habilitada_por ? ` por ${textoPlano(e.habilitada_por)}` : ''}; iniciada ${hora(e.iniciada_at)}; terminada ${hora(e.finalizada_at)}.`);
  L.push(`- **Informe generado:** ${hora(generado)}.`, '');
  L.push('> **Método.** AURORA-07 siguió un guion de preguntas y ramas preparado de antemano; durante la entrevista no intervino ningún modelo de lenguaje ni servicio externo. '
    + 'Este informe se calcula con reglas fijas a partir de las respuestas y de los registros del servidor. Solo se clasifican afirmaciones técnicas. '
    + 'No se interpreta la conducta ni se usa la rapidez de resolución como prueba de deshonestidad; los procedimientos matemáticos y las explicaciones quedan para la evaluación del profesor.', '');

  L.push('## 1. Declaraciones completas', '');
  if (!inf.respuestas.length) L.push('_Todavía no hay respuestas._', '');
  inf.respuestas.forEach((r, k) => {
    L.push(`**${k + 1}. AURORA-07** (${hora(r.at)})  `, textoPlano(r.pregunta), '', `**Estudiante:** ${textoPlano(r.mostrada)}`, '');
  });

  L.push('## 2. Contraste técnico', '');
  if (!hallazgos.length) L.push('_Sin afirmaciones técnicas que contrastar todavía._', '');
  else {
    L.push('| # | Afirmación | Clasificación | Fundamento |', '|---|---|---|---|');
    hallazgos.forEach((h, k) => L.push(`| ${k + 1} | ${celda(h.declaracion)} — _${celda(h.pregunta.split('\n')[0])}_ | **${NOMBRE_CLASIFICACION[h.clasificacion]}** | ${celda(h.fundamento)} |`));
    L.push('');
  }

  L.push('## 3. Inconsistencias verificables', '');
  const contra = hallazgos.filter((h) => h.clasificacion === 'contradicha');
  if (!contra.length) L.push('Ninguna afirmación técnica queda contradicha por registros fiables.', '');
  else contra.forEach((h) => L.push(`- ${celda(h.declaracion)}: ${celda(h.fundamento)}`));
  L.push('');

  L.push('## 4. Puntos pendientes de revisión humana', '');
  const vistos = new Set<string>();
  const ps = pendientes.filter((p) => { const k = p.origen + p.detalle; if (vistos.has(k)) return false; vistos.add(k); return true; });
  if (!ps.length) L.push('_Ninguno por ahora._');
  ps.forEach((p) => L.push(`- **${textoPlano(p.origen)}.** ${textoPlano(p.detalle)}`));
  L.push('- **Rendimiento y procedimientos.** La calidad y autoría de los procedimientos y la explicación de la evolución del rendimiento corresponden al juicio del profesor.', '');

  L.push('## 5. Registros disponibles', '');
  L.push('### Jornadas', '', '| Jornada | Fecha | Estado | Inicio | Cierre | Respuestas | Bien | Mal | «No puedo» | Cambios | Tiempo acreditado |', '|---|---|---|---|---|---|---|---|---|---|---|');
  inf.jornadas.forEach((j) => L.push(`| ${j.numero} | ${j.fecha} | ${j.estado} | ${hora(j.iniciada_at)} | ${hora(j.cerrada_at)} | ${j.intentos_validos} | ${j.correctas} | ${j.incorrectas} | ${j.no_puedo} | ${j.cambios} | ${duracion(j.segundos)} |`));
  L.push('', '### Problemas', '', 'Reloj del servidor (fiable): hora de presentación, de cierre y de cada etapa. Actividad: medida del navegador (ver nota).', '');
  L.push('| # | J | Nivel | Problema | Presentado | Cerrado | Abierto | Actividad | Acción | Resultado | Respuesta |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const p of [...inf.presentaciones].sort((a, b) => a.secuencia - b.secuencia)) {
    L.push(`| ${p.secuencia} | ${p.jornada} | D${p.nivel} | ${celda(p.titulo ?? p.plantilla_id)} | ${hora(p.presentada_at)} | ${hora(p.cerrada_at)} | ${duracion(abiertoS(p))} | ${duracion(p.segundos_cliente)} | ${p.accion ? ACCION[p.accion] ?? p.accion : 'abierto'} | ${p.resultado ?? '—'} | ${celda(partes(p.respuesta))} |`);
  }
  const conEtapas = inf.presentaciones.filter((p) => p.etapas.length);
  if (conEtapas.length) {
    L.push('', '### Etapas', '', '| Problema | Etapa | Entregada | Actividad acumulada | Resultado | Respuesta |', '|---|---|---|---|---|---|');
    for (const p of conEtapas) for (const s of p.etapas) {
      L.push(`| ${celda(p.titulo ?? p.plantilla_id)} (J${p.jornada}) | ${s.etapa} | ${hora(s.at)} | ${duracion(s.segundos_cliente)} | ${s.correcta ? 'bien' : 'mal'} | ${celda(partes(s.respuesta))} |`);
    }
  }
  const conProc = inf.presentaciones.filter((p) => p.procedimiento);
  if (conProc.length) {
    L.push('', '### Procedimientos escritos durante el maratón', '');
    for (const p of conProc) L.push(`- **${celda(p.titulo ?? p.plantilla_id)}** (J${p.jornada}): ${textoPlano(p.procedimiento!)}`);
  }
  if (inf.eventos.length) {
    L.push('', '### Eventos del maratón', '');
    for (const ev of inf.eventos) L.push(`- ${hora(ev.at)} · jornada ${ev.jornada ?? '—'} · ${textoPlano(ev.tipo)}${ev.datos ? ` · ${celda(json(ev.datos))}` : ''}`);
  }
  L.push('', '### Visitas a la página de inicio del aula esos días', '');
  if (!inf.visitas.length) L.push('_Ninguna._');
  else {
    L.push('| Inicio | Último latido | Pestaña | Efectivo | Oculta | Inactiva | Tras desconexión |', '|---|---|---|---|---|---|---|');
    inf.visitas.forEach((v) => L.push(`| ${hora(v.inicio)} | ${hora(v.ultimo_latido)} | ${textoPlano(v.pestana)} | ${duracion(v.efectivo_s)} | ${duracion(v.oculto_s)} | ${duracion(v.inactivo_s)} | ${v.tras_desconexion ? 'sí' : 'no'} |`));
  }
  L.push('', '### Indicadores calculados', '');
  L.push(`- Variantes repetidas: ${ind.variantesRepetidas.length ? ind.variantesRepetidas.join(', ') : 'ninguna'} · tipos de problema repetidos: ${ind.plantillasRepetidas.length ? ind.plantillasRepetidas.join(', ') : 'ninguno'} · temas repetidos: ${ind.temasRepetidos.join(', ') || 'ninguno'}.`);
  L.push(`- Cambios de problema sin acción registrada: ${ind.cambiosSinAccion}.`);
  L.push(`- Problemas abiertos ≥ 10 min con menos de la mitad registrada como actividad: ${ind.pausas.length ? listaPausas(ind.pausas) : 'ninguno'}.`, '');

  L.push('## 6. Telemetría disponible y telemetría inexistente', '');
  L.push('- **Fiable (reloj del servidor):** hora de presentación y cierre de cada problema, hora de cada etapa, acción, respuestas, procedimientos escritos, variante y tipo de problema, eventos de la jornada.');
  L.push(`- **Del navegador:** tiempo de actividad por problema. ${NOTA_ACTIVIDAD} Se conserva al recargar en el mismo navegador, pero empieza de cero en otro navegador o dispositivo.`);
  L.push('- **Indirecta:** visitas a la página de inicio del aula (pestaña, tiempo efectivo, oculta, inactiva y envíos tras una desconexión). El maratón no usa esta medición.');
  L.push('- **No existe:** recargas, desconexiones y dispositivo en la página del maratón; pestañas o aplicaciones usadas fuera de ella; uso de papel, calculadora o apuntes; pulsaciones de teclado, copiar y pegar.', '');
  return L.join('\n');
}
