import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { celdaCsv, jsonl, sha256, tablaCsv, utf8, type Fila } from '../src/lib/exportacion/formato';
import { crearZip, leerZip, unir } from '../src/lib/exportacion/zip';
import { crearXlsx } from '../src/lib/exportacion/xlsx';
import { literal, scriptSqlite } from '../src/lib/exportacion/sqlite';
import { calcularDerivados } from '../src/lib/exportacion/metricas';
import { exportar, ExportacionFallida, type Rpc } from '../src/lib/exportacion/motor';
import { FUENTES } from '../src/lib/exportacion/catalogo';

const ROOT = join(__dirname, '..');
const txt = (b: Uint8Array) => new TextDecoder().decode(b);

// ---------------------------------------------------------------------------------------------------------
// Datos sintéticos con la forma real de las tablas
const U1 = 'aaaaaaaa-0000-4000-8000-000000000001', U2 = 'aaaaaaaa-0000-4000-8000-000000000002';
const A1 = 'bbbbbbbb-0000-4000-8000-000000000001', A2 = 'bbbbbbbb-0000-4000-8000-000000000002', A3 = 'bbbbbbbb-0000-4000-8000-000000000003';
const ACT = 'cccccccc-0000-4000-8000-000000000001';
const E = (k: number) => `eeeeeeee-0000-4000-8000-00000000000${k}`;
const S1 = 'dddddddd-0000-4000-8000-000000000001', S2 = 'dddddddd-0000-4000-8000-000000000002';
const T0 = Date.parse('2026-10-20T14:00:00Z');
const at = (s: number, micro = '') => new Date(T0 + s * 1000).toISOString().replace('Z', `${micro}+00:00`);

function conjunto(): Record<string, Fila[]> {
  const tel: Fila[] = [];
  let id = 1;
  const ev = (a: string, u: string, s: string, seq: number, kind: string, ex: string | null, tms: number, recibido: number, data: Fila = {}) =>
    tel.push({ id: id++, attempt_id: a, user_id: u, session_id: s, seq, kind, exercise_id: ex, t_ms: tms, client_wall: null, received_at: at(recibido, '123'), data });
  // intento 1 del estudiante 1: secuencia normal, un evento perdido (seq 5) y uno que llega 60 s tarde y desordenado
  ev(A1, U1, S1, 1, 'sesion_inicio', null, 0, 1, { navegacion: 'navigate' });
  ev(A1, U1, S1, 2, 'pregunta_vista', E(1), 2000, 3, { visible: true });
  ev(A1, U1, S1, 3, 'primera_interaccion', E(1), 9000, 10);
  ev(A1, U1, S1, 4, 'respuesta_cambio', E(1), 20000, 21, { len: 4, delta: 4, rafaga_ms: 900, h: 'ab12' });
  ev(A1, U1, S1, 7, 'pregunta_vista', E(2), 30000, 31, { visible: true });
  ev(A1, U1, S1, 6, 'respuesta_cambio', E(1), 25000, 90, { len: 6, delta: 2, rafaga_ms: 400, h: 'cd34' });   // tardía
  ev(A1, U1, S1, 8, 'envio', null, 60000, 61);
  // intento 2 del estudiante 1 (segundo intento) y del estudiante 2
  ev(A2, U1, S2, 1, 'sesion_inicio', null, 0, 1001);
  ev(A2, U1, S2, 2, 'pregunta_vista', E(1), 1000, 1002, { visible: true });
  ev(A2, U1, S2, 3, 'envio', null, 50000, 1051);
  return {
    estudiantes: [{ id: U1, full_name: 'Ana Pérez', role: 'student' }, { id: U2, full_name: 'Luis Gómez', role: 'student' }],
    actividades: [{ id: ACT, title: 'Parcial', mode: 'exam' }],
    actividad_items: [1, 2, 3].map((k) => ({ activity_id: ACT, exercise_id: E(k), position: k, points: 1 })),
    intentos: [
      { id: A1, user_id: U1, activity_id: ACT, course_id: null, lesson_id: null, mode: 'exam', status: 'submitted', attempt_number: 1, started_at: at(0), submitted_at: at(61), score: 1, max_score: 3 },
      { id: A2, user_id: U1, activity_id: ACT, course_id: null, lesson_id: null, mode: 'exam', status: 'submitted', attempt_number: 2, started_at: at(1000), submitted_at: at(1051), score: 2, max_score: 3 },
      { id: A3, user_id: U2, activity_id: ACT, course_id: null, lesson_id: null, mode: 'exam', status: 'submitted', attempt_number: 1, started_at: at(0), submitted_at: at(80), score: 3, max_score: 3 },
    ],
    respuestas: [
      { id: 'r1', attempt_id: A1, exercise_id: E(1), user_id: U1, answer: { text: '=HYPERLINK("http://x")' }, status: 'correct', auto_credit: 1, tries: 2, hints_used: 0 },
      { id: 'r2', attempt_id: A3, exercise_id: E(2), user_id: U2, answer: { text: 'Respuesta "abierta", con coma\ny salto' }, status: 'incorrect', auto_credit: 0, tries: 1, engine_code: 'missing_unit' },
    ],
    eventos_respuesta: [{ id: 1, response_id: 'r1', user_id: U1, kind: 'check', answer: { text: 'x' }, result: { status: 'correct' }, created_at: at(22) }],
    telemetria: tel,
    eventos_pregunta: [{ id: 1, attempt_id: A1, exercise_id: E(1), user_id: U1, answer_hash: 'ab12', created_at: at(21) }],
  };
}

// Servidor simulado: mismas reglas que export_begin / export_page / export_finish (paginación por clave)
function servidor(datos: Record<string, Fila[]>, opts: { extra?: Record<string, number>; fallaEn?: string } = {}) {
  const registro: { fn: string; args: Record<string, unknown> }[] = [];
  const claveDe = (_t: string, f: Fila) => String(typeof f.id === 'number' ? String(f.id).padStart(12, '0') : f.id ?? JSON.stringify(f));
  const rpc: Rpc = async <T,>(fn: string, args: Record<string, unknown>) => {
    registro.push({ fn, args });
    if (fn === 'export_begin') {
      return { export_id: '12345678-aaaa-4bbb-8ccc-000000000000', as_of: '2026-10-29T00:00:00Z', modo: args.p_modo, contenido: ['academico', 'respuestas', 'telemetria'],
        conteos: Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, v.length + (opts.extra?.[k] ?? 0)])), ids_publicos: [] } as T;
    }
    if (fn === 'export_esquema') return {} as T;
    if (fn === 'export_finish') return null as T;
    if (fn === 'export_page') {
      const t = String(args.p_tabla);
      if (t === opts.fallaEn) throw new Error('fallo de red simulado');
      const lim = Number(args.p_limit);
      const orden = [...datos[t]].sort((a, b) => claveDe(t, a).localeCompare(claveDe(t, b)));
      const resto = orden.filter((f) => args.p_after === null || claveDe(t, f) > String(args.p_after));
      const filas = resto.slice(0, lim);
      return { filas, siguiente: filas.length ? claveDe(t, filas[filas.length - 1]) : null, n: filas.length, fin: filas.length < lim } as T;
    }
    throw new Error(fn);
  };
  return { rpc, registro, finish: () => registro.find((r) => r.fn === 'export_finish')?.args };
}

const congelar = <T,>(x: T): T => {
  if (x && typeof x === 'object') { Object.values(x as object).forEach(congelar); Object.freeze(x); }
  return x;
};

// ---------------------------------------------------------------------------------------------------------
describe('Centro de Datos · formatos básicos', () => {
  it('SHA-256 coincide con los vectores de referencia (incluidos los límites de bloque)', () => {
    expect(sha256(utf8(''))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256(utf8('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256(utf8('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
    expect(sha256(utf8('a'.repeat(1000)))).toBe('41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3');
  });

  it('Prueba 13 · CSV: neutraliza fórmulas sin tocar números ni el valor en JSON', () => {
    expect(celdaCsv('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(celdaCsv('+1+1')).toBe("'+1+1");
    expect(celdaCsv('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(celdaCsv('-3.5')).toBe('-3.5');
    expect(celdaCsv(-3.5)).toBe('-3.5');
    expect(celdaCsv('a, "b"\nc')).toBe('"a, ""b""\nc"');
    expect(celdaCsv({ text: '=1+1' })).toBe('"{""text"":""=1+1""}"');
    expect(jsonl([{ a: '=1+1' }])).toBe('{"a":"=1+1"}\n');
    expect(tablaCsv(['a'], [{ a: 1 }]).startsWith('﻿a\r\n1')).toBe(true);
  });

  it('ZIP: se lee de vuelta byte a byte (CRC verificado) con nombres UTF-8', async () => {
    const entradas = [{ ruta: 'AULA/acentuación ñ.csv', datos: utf8('á,é\r\n1,2\r\n') }, { ruta: 'AULA/vacío.txt', datos: new Uint8Array() }];
    const zip = unir(await crearZip(entradas, { comprimir: false }));
    const leido = await leerZip(zip);
    expect([...leido.keys()]).toEqual(entradas.map((e) => e.ruta));
    expect(txt(leido.get('AULA/acentuación ñ.csv')!)).toBe('á,é\r\n1,2\r\n');
  });

  it('Excel: textos como cadenas (nunca fórmulas), reparto en hojas al superar el límite y aviso al recortar celdas', async () => {
    const filas = Array.from({ length: 7 }, (_, i) => ({ n: i, t: i === 0 ? '=CMD()' : i === 1 ? 'x'.repeat(40_000) : `v${i}` }));
    const x = await crearXlsx([{ nombre: 'datos', columnas: ['n', 't'], filas }], { filasMax: 3 });
    expect(x.hojas.map((h) => [h.nombre, h.filas])).toEqual([['datos', 3], ['datos (2)', 3], ['datos (3)', 1]]);
    expect(x.advertencias.join(' ')).toMatch(/reparte en 3 hojas/);
    expect(x.advertencias.join(' ')).toMatch(/1 celda\(s\) superaban/);
    const libro = await leerZip(unir(x.partes));
    const h1 = txt(libro.get('xl/worksheets/sheet1.xml')!);
    expect(h1).toContain('<is><t xml:space="preserve">=CMD()</t></is>');
    expect(h1).not.toContain('<f>');
    expect((h1.match(/<row /g) ?? []).length).toBe(4);   // encabezado + 3
    expect(txt(libro.get('xl/workbook.xml')!)).toContain('name="datos (3)"');
  });

  it('SQLite: tablas con clave, relaciones e índices; un registro por fila; comillas escapadas', () => {
    const s = scriptSqlite([
      { nombre: 'intentos', columnas: ['id', 'user_id', 'score'], filas: [{ id: 'a', user_id: 'u', score: 1.5 }, { id: "b'c", user_id: 'u', score: null }], clave: ['id'] },
      { nombre: 'respuestas', columnas: ['id', 'attempt_id'], filas: [{ id: 'r', attempt_id: 'a' }], clave: ['id'], relaciones: { attempt_id: 'intentos.id' } },
    ], { diccionario: [{ tabla: 'intentos', variable: 'id' }], manifiesto: { id: 'x' } }).join('');
    expect(s).toContain('PRIMARY KEY ("id")');
    expect(s).toContain('FOREIGN KEY ("attempt_id") REFERENCES "intentos" ("id")');
    expect(s).toContain('CREATE INDEX "ix_respuestas_attempt_id"');
    expect(s).toContain("('b''c', 'u', NULL)");
    expect(s).toContain('"score" REAL');
    expect(literal(true)).toBe('1');
  });

  it('SQLite: una tabla vacía sin esquema conocido produce SQL válido (encontrado al validar con SQLite real)', () => {
    const s = scriptSqlite([{ nombre: 'grupos', columnas: [], filas: [] }], { diccionario: [], manifiesto: { a: 'b' } }).join('');
    expect(s).toContain('CREATE TABLE "grupos" ("_sin_columnas_conocidas" TEXT);');
    expect(s).not.toMatch(/\(\s*\)/);
    expect(s).not.toMatch(/INSERT INTO "_diccionario" VALUES\n;/);
  });
});

describe('Centro de Datos · métricas y cronologías', () => {
  it('Pruebas 1, 2, 6, 8 y 9 · intentos separados, relaciones, eventos tardíos conservados y originales intactos', () => {
    const d = congelar(conjunto());
    const der = calcularDerivados(d);                 // con los datos congelados: nada se modifica
    // un registro por intento y pregunta (3 intentos × 3 preguntas de la actividad), con los intentos por separado
    expect(der.metricas_pregunta).toHaveLength(9);
    expect(der.metricas_intento.map((m) => [m.user_id, m.attempt_number])).toEqual([[U1, 1], [U1, 2], [U2, 1]]);
    // cada evento original tiene su versión normalizada (mismo id), y la tardía no se pierde ni se reordena el original
    expect(der.eventos_normalizados).toHaveLength(d.telemetria.length);
    expect(new Set(der.eventos_normalizados.map((e) => e.id))).toEqual(new Set(d.telemetria.map((e) => e.id)));
    const tardia = der.eventos_normalizados.find((e) => e.seq === 6)!;
    expect(tardia.tardio).toBe(true);
    expect(tardia.retraso_recepcion_s).toBeCloseTo(64, 0);
    expect(der.eventos_normalizados.find((e) => e.seq === 7)!.hueco_previo).toBe(0);
    expect(der.eventos_normalizados.find((e) => e.seq === 6)!.hueco_previo).toBe(1);   // falta la secuencia 5
    expect(d.telemetria.map((e) => e.seq)).toEqual([1, 2, 3, 4, 7, 6, 8, 1, 2, 3]);    // orden original intacto
    // cronología de la pregunta 1 del primer intento (segundos desde el inicio)
    const p1 = der.metricas_pregunta.find((m) => m.attempt_id === A1 && m.exercise_id === E(1))!;
    expect(p1.primera_vista_s).toBeCloseTo(3, 0);
    expect(p1.cambios).toBe(2);
    expect(p1.estado).toBe('correct');
    expect(der.metricas_pregunta.find((m) => m.attempt_id === A3 && m.exercise_id === E(2))!.telemetria).toBe(false);  // sin eventos: no se inventa
    expect(der.calidad_datos.find((c) => c.attempt_id === A1)!.perdidos).toBe(1);
    // modificaciones de las tres fuentes, identificadas por su origen
    expect(new Set(der.modificaciones.map((m) => m.fuente))).toEqual(new Set(['telemetria', 'eventos_pregunta', 'eventos_respuesta']));
    expect(der.sesiones_telemetria.find((s) => s.session_id === S1)!.navegacion).toBe('navigate');
  });
});

describe('Centro de Datos · motor de exportación', () => {
  it('Pruebas 4, 5, 7 y 12 · todas las filas (con páginas pequeñas), recuentos iguales y los cuatro formatos equivalentes', async () => {
    const d = conjunto();
    const s = servidor(d);
    const r = await exportar({ rpc: s.rpc, alcance: { tipo: 'actividad', ids: [ACT] }, modo: 'identificado', contenido: ['respuestas', 'telemetria'],
      formatos: ['csv', 'json', 'excel', 'sqlite'], tamPagina: 3, version: '0.1.0', ahora: () => new Date('2026-10-29T12:00:00Z') });
    expect(r.manifiesto.completa).toBe(true);
    expect(s.registro.filter((x) => x.fn === 'export_page' && x.args.p_tabla === 'telemetria')).toHaveLength(4);   // 10 filas en páginas de 3
    expect(s.finish()).toMatchObject({ p_estado: 'completada', p_manifiesto_sha256: r.manifiestoSha });
    const zip = await leerZip(unir(r.partes));
    expect(r.nombre).toBe('AULA_EXPORTACION_2026-10-29_12345678.zip');
    const manifest = JSON.parse(txt(zip.get('AULA_EXPORTACION/manifest.json')!));
    for (const a of manifest.archivos) expect(sha256(zip.get(`AULA_EXPORTACION/${a.ruta}`)!), a.ruta).toBe(a.sha256);
    // misma cantidad de registros en CSV, JSON Lines, Excel y SQL para cada tabla
    const libro = await leerZip(zip.get('AULA_EXPORTACION/excel/datos_completos.xlsx')!);
    const nombresHojas = [...txt(libro.get('xl/workbook.xml')!).matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]);
    const sql = txt(zip.get('AULA_EXPORTACION/base_datos/investigacion.sql')!);
    for (const [tabla, n] of Object.entries(manifest.registros_por_tabla as Record<string, number>)) {
      const carpeta = [...zip.keys()].find((k) => k.endsWith(`/${tabla}.csv`))!;
      const csv = txt(zip.get(carpeta)!);
      const filasCsv = csv.split('\r\n').filter(Boolean).length - 1;            // sin saltos dentro de campos en estas tablas, salvo respuestas
      if (tabla !== 'respuestas') expect(filasCsv, `CSV ${tabla}`).toBe(n);
      expect(txt(zip.get(`AULA_EXPORTACION/json/${tabla}.jsonl`)!).split('\n').filter(Boolean).length, `JSONL ${tabla}`).toBe(n);
      const hoja = nombresHojas.indexOf(tabla) + 1;
      expect((txt(libro.get(`xl/worksheets/sheet${hoja}.xml`)!).match(/<row /g) ?? []).length - 1, `Excel ${tabla}`).toBe(n);
      const bloque = sql.split(`CREATE TABLE "${tabla}" (`)[1]?.split('CREATE TABLE ')[0] ?? '';
      expect((bloque.match(/^\(.*\)[,;]$/gm) ?? []).length, `SQL ${tabla}`).toBe(n);
    }
    // marcas temporales con su precisión original (microsegundos incluidos)
    expect(txt(zip.get('AULA_EXPORTACION/telemetria/eventos_originales.csv')!)).toContain(at(1, '123'));
    expect(zip.has('AULA_EXPORTACION/README.md') && zip.has('AULA_EXPORTACION/diccionario_datos.csv')).toBe(true);
    expect(txt(zip.get('AULA_EXPORTACION/diccionario_datos.csv')!)).toContain('t_intento_s');
  });

  it('Prueba 14 · recuento distinto, fallo de red o cancelación: sin archivo y registrado como no completada', async () => {
    const d = conjunto();
    const a = servidor(d, { extra: { telemetria: 1 } });
    await expect(exportar({ rpc: a.rpc, alcance: { tipo: 'todo', ids: [] }, modo: 'identificado', contenido: ['telemetria'], formatos: ['csv'], tamPagina: 4 }))
      .rejects.toMatchObject({ motivo: 'incompleta' });
    expect(a.finish()).toMatchObject({ p_estado: 'incompleta', p_manifiesto_sha256: null });

    const b = servidor(d, { fallaEn: 'telemetria' });
    await expect(exportar({ rpc: b.rpc, alcance: { tipo: 'todo', ids: [] }, modo: 'identificado', contenido: ['telemetria'], formatos: ['csv'] }))
      .rejects.toBeInstanceOf(ExportacionFallida);
    expect(b.finish()).toMatchObject({ p_estado: 'error' });

    const ctl = new AbortController();
    const c = servidor(d);
    const p = exportar({ rpc: c.rpc, alcance: { tipo: 'todo', ids: [] }, modo: 'identificado', contenido: ['telemetria'], formatos: ['csv'], tamPagina: 1,
      senal: ctl.signal, alProgreso: (x) => { if (x.tabla === 'telemetria' && (x.filas ?? 0) >= 2) ctl.abort(); } });
    await expect(p).rejects.toMatchObject({ motivo: 'cancelada' });
    expect(c.finish()).toMatchObject({ p_estado: 'cancelada' });
  });

  it('Prueba 15 · modo investigación: ni el nombre del archivo ni el manifiesto llevan datos personales', async () => {
    const d = conjunto();
    // el servidor ya entrega seudónimos en este modo; simulamos esa salida
    const seud = (u: unknown) => (u === U1 ? 'E-AAAAAAAAAAAA' : u === U2 ? 'E-BBBBBBBBBBBB' : u);
    const inv: Record<string, Fila[]> = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v.map((f) => {
      const g: Fila = { ...f };
      if ('user_id' in g) g.user_id = seud(g.user_id);
      if (k === 'estudiantes') { g.id = seud(g.id); delete g.full_name; }
      return g;
    })]));
    const r = await exportar({ rpc: servidor(inv).rpc, alcance: { tipo: 'estudiante', ids: [U1] }, modo: 'investigacion', contenido: ['telemetria'], formatos: ['csv', 'json', 'excel', 'sqlite'] });
    // se descomprime (con Node 20 el ZIP va comprimido) y se revisa el contenido real de cada archivo, también dentro del .xlsx
    const archivos = await leerZip(unir(r.partes));
    const textos: string[] = [];
    for (const [ruta, datos] of archivos) {
      textos.push(ruta);
      if (ruta.endsWith('.xlsx')) for (const [r2, d2] of await leerZip(datos)) textos.push(r2, txt(d2));
      else textos.push(txt(datos));
    }
    const todo = textos.join('\n');
    expect(r.nombre).not.toMatch(/Ana|Luis|aaaaaaaa/);
    expect(JSON.stringify(r.manifiesto)).not.toMatch(/Ana|Luis|aaaaaaaa-0000/);
    expect(todo).not.toMatch(/Ana Pérez|Luis Gómez|aaaaaaaa-0000-4000-8000-00000000000[12]/);
    expect(todo).toContain('E-AAAAAAAAAAAA');
  });

  it('Prueba 11 · cientos de miles de eventos: completo, sin pérdidas y en tiempo razonable', async () => {
    const intentos: Fila[] = [], tel: Fila[] = [];
    let id = 1;
    for (let a = 0; a < 400; a++) {
      const aid = `ffffffff-0000-4000-8000-${String(a).padStart(12, '0')}`;
      intentos.push({ id: aid, user_id: `u${a % 40}`, activity_id: ACT, mode: 'exam', status: 'submitted', attempt_number: 1, started_at: at(0), submitted_at: at(3600), score: 5, max_score: 10 });
      for (let q = 1; q <= 500; q++) {
        tel.push({ id: id++, attempt_id: aid, user_id: `u${a % 40}`, session_id: `s${a}`, seq: q, kind: q % 10 ? 'respuesta_cambio' : 'pregunta_vista',
          exercise_id: E(1 + (q % 3)), t_ms: q * 1000, client_wall: null, received_at: at(q + 1), data: { len: q % 50, delta: 1 } });
      }
    }
    const d = { intentos, telemetria: tel, actividad_items: [1, 2, 3].map((k) => ({ activity_id: ACT, exercise_id: E(k), position: k })) };
    const inicio = Date.now();
    const r = await exportar({ rpc: servidor(d).rpc, alcance: { tipo: 'todo', ids: [] }, modo: 'identificado', contenido: ['telemetria'], formatos: ['csv', 'json'] });
    const segundos = (Date.now() - inicio) / 1000;
    expect(tel.length).toBe(200_000);
    expect((r.manifiesto.registros_por_tabla as Record<string, number>).eventos_originales).toBe(200_000);
    expect((r.manifiesto.registros_por_tabla as Record<string, number>).eventos_normalizados).toBe(200_000);
    expect((r.manifiesto.registros_por_tabla as Record<string, number>).metricas_pregunta).toBe(1200);
    expect(r.manifiesto.completa).toBe(true);
    expect(segundos).toBeLessThan(120);
  }, 180_000);
});

describe('Centro de Datos · coherencia con el servidor', () => {
  const sql = readFileSync(join(ROOT, 'supabase/migrations/20261029000034_centro_datos.sql'), 'utf8');
  // definición VIGENTE de la lista blanca: la última migración que redefine export_fuente
  const vigente = readdirSync(join(ROOT, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort()
    .map((f) => readFileSync(join(ROOT, 'supabase/migrations', f), 'utf8')).filter((t) => /create or replace function public\.export_fuente\(/.test(t)).pop()!;

  it('cada fuente del catálogo existe en la lista blanca vigente del servidor (y viceversa), también en export_begin', () => {
    const servidorFuentes = [...vigente.matchAll(/when '([a-z_]+)' then grupo := '([a-z]+)'/g)].map((m) => [m[1], m[2]] as [string, string]);
    expect(new Map(servidorFuentes)).toEqual(new Map(FUENTES.map((f) => [f.nombre, f.grupo])));
    const todas = [...(vigente.match(/todas constant text\[\] := array\[([^\]]+)\]/)?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(new Set(todas)).toEqual(new Set(FUENTES.map((f) => f.nombre)));
  });

  it('Prueba 10 y seguridad · lista blanca, sin SQL a partir de la entrada, permisos y columnas sensibles fuera', () => {
    expect(sql).toMatch(/select \* into f from public\.export_fuente\(p_tabla\);\s+if f\.grupo is null or not \(f\.grupo = any \(d\.contenido\)\)/);
    expect(sql).toMatch(/d\.actor_id is distinct from auth\.uid\(\) or not public\.is_teacher\(\)/);
    expect(sql).not.toMatch(/format\([^)]*p_tabla/);                       // el nombre pedido nunca entra en el SQL
    for (const c of ['password_fingerprint', 'join_code', 'code,secret,geo_lat,geo_lng', 'lat,lng,device_hash', 'unlock_code_hash', 'code_hash', 'storage_path']) expect(sql).toContain(c);
    expect(sql).toMatch(/'full_name', 'email', 'student_code', 'login_id', 'original_name', 'audience'/);
    expect(sql).toMatch(/extensions\.hmac\(convert_to\(p_user::text, 'UTF8'\), \(select secret from public\.data_export_secret/);
    expect(sql).toMatch(/revoke all on public\.data_export_secret, public\.data_exports, public\.data_export_users, public\.data_export_attempts from anon, authenticated/);
    expect(sql).toMatch(/Solo el administrador puede exportar las claves de respuesta/);
    expect(sql).not.toMatch(/(login_attempts|security_audit|known_devices|auth\.users|account_events)/);
  });
});
