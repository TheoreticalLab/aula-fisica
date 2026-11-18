import { describe, expect, it } from 'vitest';
import { contrastar, duracion, indicadores, informeMarkdown, textoPlano, type InformeAurora, type PresentacionReg } from '@/lib/aurora/contraste';

const P = (k: number, o: Partial<PresentacionReg> = {}): PresentacionReg => ({
  id: `p${k}`, jornada: 1, secuencia: k, titulo: `Problema ${k}`, tema: `t${k}`, nivel: 3, variante_id: `v${k}`, plantilla_id: `pl${k}`,
  presentada_at: `2026-11-16T20:${String(10 * k).padStart(2, '0')}:00Z`, cerrada_at: `2026-11-16T20:${String(10 * k + 5).padStart(2, '0')}:00Z`,
  accion: 'respuesta', resultado: 'correcta', segundos: 300, segundos_cliente: 290, t_min_s: 120, anticipada: false,
  respuesta: { partes: ['1 m/s'] }, procedimiento: null, etapas_total: 1, etapas: [], ...o,
});

function base(over: Partial<InformeAurora> = {}): InformeAurora {
  return {
    entrevista: {
      id: 'e', titulo: 'AURORA-07', titulo_informe: 'AURORA-07 — Informe de entrevista y contraste técnico: S1', estado: 'finalizada', jornadas: [1, 2],
      nodo_actual: 'fin', habilitada_at: '2026-11-18T13:00:00Z', iniciada_at: '2026-11-18T13:05:00Z', finalizada_at: '2026-11-18T13:40:00Z', habilitada_por: 'Prof',
      guion: {
        inicio: 'intro',
        nodos: {
          intro: { tipo: 'info', texto: 'Hola', siguiente: 'reap' },
          reap: { tipo: 'opcion', texto: '¿Reapareció?', afirmacion: 'reaparicion', opciones: [{ valor: 'maraton_mismos_datos', texto: 'Sí, mismos datos' }, { valor: 'no', texto: 'No' }], siguiente: 'papel' },
          papel: { tipo: 'opcion', texto: '¿Papel?', afirmacion: 'papel', opciones: [{ valor: 'si', texto: 'Sí' }, { valor: 'no', texto: 'No' }], siguiente: 'rec' },
          rec: { tipo: 'opcion', texto: '¿Qué encontró?', afirmacion: 'recarga_resultado', opciones: [{ valor: 'distinto', texto: 'Otro ejercicio' }, { valor: 'otro', texto: 'Otra cosa', pide_texto: true }], siguiente: 'con' },
          con: { tipo: 'opcion', texto: '¿Conexión?', afirmacion: 'conexion', opciones: [{ valor: 'si_alguna', texto: 'Sí' }, { valor: 'no', texto: 'No' }], siguiente: 'int' },
          int: { tipo: 'opcion', texto: '¿Qué pasó?', afirmacion: 'intervalo', episodio: 'p2', opciones: [{ valor: 'deje_volvi', texto: 'Dejé y volví' }, { valor: 'continuo', texto: 'Continuo' }], siguiente: 'proc' },
          proc: { tipo: 'texto', texto: 'Explique el procedimiento', revision: true, episodio: 'p2', siguiente: 'fin' },
          fin: { tipo: 'fin', texto: 'Gracias' },
        },
      },
    },
    estudiante: { nombre: 'S1', login_id: '100' },
    maraton: { titulo: 'Maratón', seccion: 'A', fecha_inicio: '2026-11-16' },
    respuestas: [],
    jornadas: [{ numero: 1, fecha: '2026-11-16', estado: 'completada', iniciada_at: '2026-11-16T20:10:00Z', cerrada_at: '2026-11-16T22:00:00Z', correctas: 2, incorrectas: 0, intentos_validos: 2, presentados: 2, segundos: 3600, via: 'alternativa', no_puedo: 0, cambios: 0 }],
    // p2: abierto 4 h 45 min con 4 min de actividad
    presentaciones: [P(1), P(2, { presentada_at: '2026-11-16T21:34:00Z', cerrada_at: '2026-11-17T02:20:00Z', segundos_cliente: 255 })],
    eventos: [],
    visitas: [],
    ...over,
  };
}
const R = (nodo: string, valor: string | null, texto: string | null = null, mostrada = valor ?? texto ?? '') =>
  ({ nodo, pregunta: `Pregunta ${nodo}`, valor, texto, mostrada, at: '2026-11-18T13:10:00Z' });

describe('AURORA-07 · contraste técnico', () => {
  it('«el mismo ejercicio con los mismos datos» queda contradicho si ninguna variante se repitió, y corroborado si se repitió', () => {
    const a = contrastar(base({ respuestas: [R('reap', 'maraton_mismos_datos')] }));
    expect(a.hallazgos[0].clasificacion).toBe('contradicha');
    const b = contrastar(base({ respuestas: [R('reap', 'maraton_mismos_datos')], presentaciones: [P(1), P(2, { variante_id: 'v1' })] }));
    expect(b.hallazgos[0].clasificacion).toBe('corroborada');
    expect(contrastar(base({ respuestas: [R('reap', 'no')] })).hallazgos[0].clasificacion).toBe('corroborada');
  });

  it('el papel es compatible si hay problemas con mucho tiempo abierto y poca actividad; si no, no verificable', () => {
    expect(contrastar(base({ respuestas: [R('papel', 'si')] })).hallazgos[0].clasificacion).toBe('compatible');
    expect(contrastar(base({ respuestas: [R('papel', 'si')], presentaciones: [P(1)] })).hallazgos[0].clasificacion).toBe('no_verificable');
    expect(contrastar(base({ respuestas: [R('papel', 'no')] })).hallazgos[0].clasificacion).toBe('no_verificable');
  });

  it('«al recargar salió otro ejercicio» se contradice cuando cada cambio tiene una acción registrada', () => {
    expect(contrastar(base({ respuestas: [R('rec', 'distinto')] })).hallazgos[0].clasificacion).toBe('contradicha');
    const sinAccion = base({ respuestas: [R('rec', 'distinto')], presentaciones: [P(1, { accion: null, cerrada_at: null }), P(2)] });
    expect(contrastar(sinAccion).hallazgos[0].clasificacion).toBe('compatible');
  });

  it('las desconexiones solo se apoyan en los registros de la página de inicio', () => {
    expect(contrastar(base({ respuestas: [R('con', 'si_alguna')] })).hallazgos[0].clasificacion).toBe('no_verificable');
    const v = { seccion: 'inicio', pestana: 'abc', inicio: '2026-11-17T22:20:22Z', ultimo_latido: '2026-11-17T22:21:02Z', efectivo_s: 23, oculto_s: 15, inactivo_s: 1, tras_desconexion: true };
    const c = contrastar(base({ respuestas: [R('con', 'si_alguna')], visitas: [v] }));
    expect(c.hallazgos[0].clasificacion).toBe('compatible');
    expect(c.hallazgos[0].fundamento).toMatch(/1 vez/);
  });

  it('el intervalo de un episodio usa el reloj del servidor; la medida del navegador nunca contradice', () => {
    const a = contrastar(base({ respuestas: [R('int', 'deje_volvi')] }));
    expect(a.hallazgos[0].clasificacion).toBe('compatible');
    expect(a.hallazgos[0].fundamento).toMatch(/4 h 46 min/);
    const b = contrastar(base({ respuestas: [R('int', 'continuo')] }));
    expect(b.hallazgos[0].clasificacion).toBe('no_verificable');
    expect(b.hallazgos.some((h) => h.clasificacion === 'contradicha')).toBe(false);
  });

  it('procedimientos y respuestas abiertas van a revisión humana, sin clasificación automática', () => {
    const c = contrastar(base({ respuestas: [R('proc', null, 'Usé W = ΔK'), R('rec', 'otro', 'se congeló', 'Otra cosa: se congeló')] }));
    expect(c.hallazgos.map((h) => h.nodo)).toEqual([]);
    expect(c.pendientes.map((p) => p.origen)).toEqual(['Procedimiento: «Problema 2» (jornada 1)', 'Respuesta abierta']);
  });

  it('indicadores: pausas, repeticiones y pestañas', () => {
    const i = indicadores(base());
    expect(i.pausas.map((p) => p.id)).toEqual(['p2']);
    expect(i.variantesRepetidas).toEqual([]);
    expect(i.cambiosSinAccion).toBe(0);
    expect(duracion(255)).toBe('4 min 15 s');
    expect(duracion(17160)).toBe('4 h 46 min');
  });
});

describe('AURORA-07 · informe', () => {
  it('contiene las secciones pedidas, las declaraciones completas y el método', () => {
    const md = informeMarkdown(base({ respuestas: [R('reap', 'maraton_mismos_datos', null, 'Sí, mismos datos'), R('proc', null, 'Conservación: mgh = μmgd')] }), '2026-11-18T14:00:00Z');
    expect(md.startsWith('# AURORA\\-07 — Informe de entrevista y contraste técnico: S1')).toBe(true);
    for (const s of ['## 1. Declaraciones completas', '## 2. Contraste técnico', '## 3. Inconsistencias verificables', '## 4. Puntos pendientes de revisión humana',
      '## 5. Registros disponibles', '## 6. Telemetría disponible y telemetría inexistente']) expect(md).toContain(s);
    expect(md).toContain('Contradicha por registros fiables');
    expect(md).toContain('Conservación: mgh = μmgd');
    expect(md).toMatch(/no intervino ningún modelo de lenguaje/);
    expect(md).toMatch(/No se interpreta la conducta ni se usa la rapidez/);
  });

  it('el texto del estudiante no puede inyectar formato, enlaces ni imágenes', () => {
    expect(textoPlano('![x](http://a.b/c.png) [l](u) $x$ <b>')).toBe('\\!\\[x\\]\\(http://a\\.b/c\\.png\\) \\[l\\]\\(u\\) \\$x\\$ \\<b\\>');
    const md = informeMarkdown(base({ respuestas: [R('proc', null, '![x](http://evil/x.png)')] }));
    expect(md).not.toContain('![x](');
  });
});
