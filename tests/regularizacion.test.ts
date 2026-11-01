/** Regularización de prácticas anteriores: reglas del navegador (optimización, búsqueda, sugerencias, filtros). */
import { describe, expect, it } from 'vitest';
import { CALIDAD_MINIMA, LADO_CORTO_MINIMO, OBJETIVO_BYTES, optimizarCon, planificar, type Paso } from '../src/lib/imagen';
import {
  accionesPosibles, agruparSugerencias, busquedaCorreo, duplicados, estimacionTotal, faltantes, filtrar, FILTROS_VACIOS, palabrasClave,
  recomendaciones, similitud, totales, type Registro,
} from '../src/lib/regularizacion';

/** Codificador simulado: bytes ∝ píxeles × f(calidad), con una «densidad» que imita capturas con mucho texto. */
const simulado = (densidad: number) => async (p: Paso) => ({ blob: p, bytes: Math.round(p.ancho * p.alto * densidad * (0.25 + p.calidad ** 2)), tipo: 'image/webp' });

describe('caso 4: optimización de capturas grandes sin perder legibilidad', () => {
  it('nunca baja de 1080 px de lado corto ni de calidad 0,6', () => {
    for (const [w, h] of [[1170, 2532], [2880, 1800], [1290, 8000], [3840, 2160], [1080, 2400]]) {
      for (const p of planificar(w, h)) {
        expect(Math.min(p.ancho, p.alto)).toBeGreaterThanOrEqual(Math.min(LADO_CORTO_MINIMO, Math.min(w, h)) - 1);
        expect(p.calidad).toBeGreaterThanOrEqual(CALIDAD_MINIMA);
      }
    }
  });
  it('no amplía imágenes pequeñas', () => {
    expect(planificar(720, 1280).every((p) => p.ancho === 720 && p.alto === 1280)).toBe(true);
  });
  it('una captura de teléfono típica queda dentro del objetivo de 400 KB', async () => {
    const r = (await optimizarCon(1170, 2532, simulado(0.18)))!;
    expect(r.bytes).toBeLessThanOrEqual(OBJETIVO_BYTES);
    expect(Math.min(r.paso.ancho, r.paso.alto)).toBeGreaterThanOrEqual(LADO_CORTO_MINIMO);
  });
  it('una pantalla de escritorio de 4K (≈ 6 MB) se reduce a 1440 px y entra en el objetivo', async () => {
    const r = (await optimizarCon(3840, 2160, simulado(0.15)))!;
    expect(r.paso.alto).toBe(1440);
    expect(r.bytes).toBeLessThanOrEqual(OBJETIVO_BYTES);
  });
  it('una captura larga muy densa no se destruye para llegar a 400 KB: se acepta más grande con la legibilidad mínima', async () => {
    const r = (await optimizarCon(1290, 9000, simulado(0.3)))!;
    expect(r.bytes).toBeGreaterThan(OBJETIVO_BYTES);
    expect(Math.min(r.paso.ancho, r.paso.alto)).toBe(LADO_CORTO_MINIMO);
    expect(r.paso.calidad).toBe(CALIDAD_MINIMA);
  });
  it('si el codificador falla en un escalón, prueba el siguiente', async () => {
    let n = 0;
    const r = await optimizarCon(1170, 2532, async (p) => (n++ === 0 ? null : simulado(0.1)(p)));
    expect(r).not.toBeNull();
  });
});

describe('formulario del estudiante', () => {
  const base = { tipo: 'evidencia' as const, medio: 'correo' as const, otra_via: null, correo_remitente: 'a@b.co', motivo_incidencia: null, tieneCapturaPrincipal: true };
  it('caso 3: sin captura principal o sin medio no se puede registrar', () => {
    expect(faltantes(base)).toEqual([]);
    expect(faltantes({ ...base, tieneCapturaPrincipal: false })).toEqual(['la captura principal del envío']);
    expect(faltantes({ ...base, medio: null })).toContain('el medio de envío');
  });
  it('caso 2: «otra vía» exige especificar el canal', () => {
    expect(faltantes({ ...base, medio: 'otra', otra_via: '  ' })).toEqual(['especificar por cuál medio la enviaste']);
    expect(faltantes({ ...base, medio: 'otra', otra_via: 'Aplicación de mensajería' })).toEqual([]);
  });
  it('una incidencia no lleva captura pero sí explica qué pasó', () => {
    expect(faltantes({ ...base, tipo: 'incidencia', tieneCapturaPrincipal: false })).toEqual(['explicar qué pasó con la evidencia']);
    expect(faltantes({ ...base, tipo: 'incidencia', tieneCapturaPrincipal: false, motivo_incidencia: 'Perdí el teléfono' })).toEqual([]);
  });
  it('recomienda (sin exigir) la dirección de correo, la fecha y el tema', () => {
    expect(recomendaciones({ ...base, correo_remitente: '', fecha_desconocida: false, fecha_declarada: null, tema: '' })).toHaveLength(3);
    expect(recomendaciones({ ...base, fecha_desconocida: true, fecha_declarada: null, tema: 'Newton' })).toHaveLength(0);
  });
});

describe('caso 6: búsqueda manual en el correo del profesor', () => {
  it('remitente, intervalo con margen y palabras clave', () => {
    const b = busquedaCorreo({ correo_remitente: 'estudiante@ejemplo.com', fecha_declarada: '2026-09-15', tema: 'Práctica sobre las leyes de Newton', descripcion: 'plano inclinado' }, 5);
    expect(b.gmail).toBe('from:estudiante@ejemplo.com after:2026/09/10 before:2026/09/21');
    expect(b.desde).toBe('2026-09-10');
    expect(b.hasta).toBe('2026-09-20');
    expect(b.palabras).toEqual(['leyes', 'newton', 'plano', 'inclinado']);
    expect(b.gmailConPalabras).toBe('from:estudiante@ejemplo.com after:2026/09/10 before:2026/09/21 {leyes newton plano inclinado}');
  });
  it('cruza meses y años; sin fecha no pone intervalo', () => {
    expect(busquedaCorreo({ correo_remitente: 'x@y.z', fecha_declarada: '2026-12-29', tema: '', descripcion: '' }, 7).gmail).toBe('from:x@y.z after:2026/12/22 before:2027/01/06');
    expect(busquedaCorreo({ correo_remitente: 'x@y.z', fecha_declarada: null, tema: '', descripcion: '' }, 7).gmail).toBe('from:x@y.z');
  });
  it('palabrasClave descarta palabras vacías y repetidas (con o sin tilde)', () => {
    expect(palabrasClave('Práctica de cinemática: cinematica y MRUA del profesor')).toEqual(['cinemática', 'mrua']);
  });
});

describe('caso 9: sugerencias de prácticas adicionales', () => {
  const s = (id: string, tema: string | null, total: number | null = null) => ({ id, tema, descripcion: '', total_estimado: total, estado: 'pendiente' });
  it('agrupa temas parecidos y separa los distintos', () => {
    const g = agruparSugerencias([s('1', 'Práctica de energía y trabajo'), s('2', 'Energía, trabajo y potencia'), s('3', 'Vectores en el plano'), s('4', 'trabajo y energia'), s('5', null, 12)]);
    expect(g.map((x) => x.map((y) => y.id).sort())).toEqual([['1', '2', '4'], ['3']]);
    expect(similitud('Vectores', 'Energía')).toBe(0);
  });
  it('«creo que fueron doce»: mediana y moda de los totales declarados', () => {
    expect(estimacionTotal([s('1', null, 12), s('2', null, 12), s('3', null, 11), s('4', 'x')])).toEqual({ respuestas: 3, mediana: 12, moda: 12, conteo: [[12, 2], [11, 1]] });
    expect(estimacionTotal([]).mediana).toBeNull();
  });
});

const R = (o: Partial<Registro>): Registro => ({
  id: 'r', class_id: 'c1', class_name: 'S1', course_id: 'k1', course_title: 'Física', group_id: null, group_name: null, user_id: 'u1', full_name: 'Ana Pérez',
  student_code: '2020-0001', practice_id: 'p1', numero: 1, practica_titulo: '', practica_archivada: false, tipo: 'evidencia', tema: 'Newton', descripcion: '',
  fecha_declarada: '2026-09-15', fecha_desconocida: false, medio: 'correo', correo_remitente: 'ana@ejemplo.com', otra_via: null, contacto: null,
  motivo_incidencia: null, estado: 'registrada', enviado_at: null, revisada_at: null, localizada_at: null, verificada_at: null, convalidada_at: null,
  nota_docente: null, respuesta_estudiante: null, actividad: null, calificacion: null, capturas: [], ...o,
});

describe('localizador del profesor', () => {
  const rs = [
    R({ id: 'a' }),
    R({ id: 'b', numero: 2, practice_id: 'p2', medio: 'otra', correo_remitente: null, otra_via: 'Mensajería', fecha_declarada: null, fecha_desconocida: true }),
    R({ id: 'c', user_id: 'u2', full_name: 'Luis Gómez', numero: 2, practice_id: 'p2', estado: 'convalidada', class_id: 'c2', group_id: 'g1' }),
    R({ id: 'd', user_id: 'u2', full_name: 'Luis Gómez', tipo: 'incidencia', estado: 'aclaracion', fecha_declarada: '2026-10-02' }),
  ];
  it('caso 5: filtra todas las prácticas enviadas por correo', () => {
    expect(filtrar(rs, { ...FILTROS_VACIOS, medio: 'correo' }).map((r) => r.id)).toEqual(['a', 'c', 'd']);
  });
  it('filtra por estudiante (sin tildes), número, sección, grupo, tipo, estado y fecha declarada', () => {
    expect(filtrar(rs, { ...FILTROS_VACIOS, texto: 'gomez' }).map((r) => r.id)).toEqual(['c', 'd']);
    expect(filtrar(rs, { ...FILTROS_VACIOS, numero: '2' }).map((r) => r.id)).toEqual(['b', 'c']);
    expect(filtrar(rs, { ...FILTROS_VACIOS, seccion: 'c2' }).map((r) => r.id)).toEqual(['c']);
    expect(filtrar(rs, { ...FILTROS_VACIOS, grupo: 'g1' }).map((r) => r.id)).toEqual(['c']);
    expect(filtrar(rs, { ...FILTROS_VACIOS, tipo: 'incidencia' }).map((r) => r.id)).toEqual(['d']);
    expect(filtrar(rs, { ...FILTROS_VACIOS, estado: 'por_revisar' }).map((r) => r.id)).toEqual(['a', 'b', 'd']);
    expect(filtrar(rs, { ...FILTROS_VACIOS, desde: '2026-10-01', hasta: '2026-10-31' }).map((r) => r.id)).toEqual(['d']);
  });
  it('caso 13: los totales cuentan solo lo declarado (las posiciones vacías no son incumplimientos)', () => {
    const t = totales([R({ id: 'x1' }), R({ id: 'x2', numero: 2 }), R({ id: 'x3', numero: 3, tipo: 'incidencia' })]);
    expect(t).toMatchObject({ declaradas: 3, evidencias: 2, incidencias: 1, porLocalizar: 3, convalidadas: 0, estudiantes: 1 });
  });
  it('señala a un estudiante con dos registros de la misma práctica', () => {
    expect([...duplicados([R({ id: 'x' }), R({ id: 'y' }), R({ id: 'z', practice_id: 'p9' })])].sort()).toEqual(['x', 'y']);
  });
  it('acciones: verificar exige haber localizado; convalidar exige verificado; convalidado solo se revierte', () => {
    expect(accionesPosibles('registrada', false)).not.toContain('verificada');
    expect(accionesPosibles('localizada', true)).toContain('verificada');
    expect(accionesPosibles('localizada', true)).not.toContain('convalidada');
    expect(accionesPosibles('verificada', true)).toContain('convalidada');
    expect(accionesPosibles('convalidada', true)).toEqual(['revertir_convalidacion']);
    expect(accionesPosibles('borrador', false)).toEqual([]);
  });
});
