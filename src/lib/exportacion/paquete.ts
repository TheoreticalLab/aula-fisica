/**
 * Centro de Datos · construcción de los archivos de una exportación: CSV, JSON Lines, Excel, script SQLite,
 * manifiesto (con SHA-256 de cada archivo), README y diccionario de datos.
 */
import { DERIVADAS, FUENTES, GRUPOS, nombreSalida, variable, VERSION_ESQUEMA, VERSION_METRICAS } from './catalogo';
import { columnasDe, jsonl, sha256, tablaCsv, utf8, type Fila } from './formato';
import { scriptSqlite, type TablaSql } from './sqlite';
import { crearXlsx } from './xlsx';
import { crearZip } from './zip';
import { COLUMNAS_DERIVADAS } from './metricas';

export type Formato = 'excel' | 'csv' | 'json' | 'sqlite';

export interface ColumnaEsquema { columna: string; tipo: string; nulo: boolean; descripcion: string | null }

export interface EntradaPaquete {
  exportId: string;
  modo: 'identificado' | 'investigacion';
  alcance: { tipo: string; ids_publicos: unknown[]; desde?: string | null; hasta?: string | null };
  contenido: string[];
  asOf: string;
  datos: Record<string, Fila[]>;              // originales, por nombre de fuente (export_fuente)
  derivados: Record<string, Fila[]>;
  esperados: Record<string, number>;          // recuentos del servidor (export_begin)
  esquema: Record<string, ColumnaEsquema[]>;
  formatos: Formato[];
  version: string;
  fecha: Date;
  advertencias: string[];
}

export interface ResultadoPaquete {
  nombre: string;
  tipo: string;
  partes: Uint8Array[];
  manifiesto: Record<string, unknown>;
  manifiestoSha: string;
  advertencias: string[];
}

interface TablaSalida { nombre: string; carpeta: string; origen: 'original' | 'calculado'; tablaOriginal: string; descripcion: string; columnas: string[];
  filas: Fila[]; clave: string[]; relaciones?: Record<string, string>; tipos: Record<string, string> }

function tablasDeSalida(e: EntradaPaquete): TablaSalida[] {
  const out: TablaSalida[] = [];
  for (const f of FUENTES) {
    const filas = e.datos[f.nombre];
    if (!filas) continue;
    const esq = e.esquema[f.nombre] ?? [];
    out.push({
      nombre: nombreSalida(f.nombre), carpeta: f.carpeta, origen: 'original', tablaOriginal: f.tablaOriginal, descripcion: f.descripcion,
      columnas: columnasDe(filas, esq.map((c) => c.columna)), filas, clave: f.clave, relaciones: f.relaciones,
      tipos: Object.fromEntries(esq.map((c) => [c.columna, c.tipo])),
    });
  }
  for (const d of DERIVADAS) {
    const filas = e.derivados[d.nombre];
    if (!filas) continue;
    out.push({ nombre: d.nombre, carpeta: d.carpeta, origen: 'calculado', tablaOriginal: '', descripcion: d.descripcion, columnas: columnasDe(filas, COLUMNAS_DERIVADAS[d.nombre]), filas,
      clave: d.clave, relaciones: d.relaciones, tipos: {} });
  }
  return out;
}

function unidadPorNombre(c: string): string | undefined {
  if (/_s$|_seconds$/.test(c)) return 's';
  if (/_ms$/.test(c)) return 'ms';
  if (/_at$|_utc$|^client_wall$/.test(c)) return 'fecha-hora UTC';
  return undefined;
}

export function diccionario(tablas: TablaSalida[]): Fila[] {
  const filas: Fila[] = [];
  for (const t of tablas) {
    for (const c of t.columnas) {
      const v = variable(t.nombre, c);
      const nulos = t.filas.reduce((n, f) => n + (f[c] === null || f[c] === undefined ? 1 : 0), 0);
      filas.push({
        tabla: t.nombre, variable: c, tipo: t.tipos[c] ?? 'calculado', unidad: v?.unidad ?? unidadPorNombre(c) ?? null,
        naturaleza: v?.naturaleza ?? (t.origen === 'calculado' ? 'calculado' : 'registrado_por_el_sistema'),
        fuente: t.origen === 'original' ? `public.${t.tablaOriginal}.${c}` : `calculado (${VERSION_METRICAS})`,
        descripcion: v?.descripcion ?? (t.origen === 'original' ? `Columna «${c}» de ${t.tablaOriginal}.` : `Columna «${c}» de la tabla calculada ${t.nombre}.`),
        calculo: v?.calculo ?? null, limitaciones: v?.limitaciones ?? null, relacion: t.relaciones?.[c] ?? null,
        valores_nulos: nulos, filas: t.filas.length,
      });
    }
  }
  return filas;
}

const COLUMNAS_DICCIONARIO = ['tabla', 'variable', 'tipo', 'unidad', 'naturaleza', 'fuente', 'descripcion', 'calculo', 'limitaciones', 'relacion', 'valores_nulos', 'filas'];

function readme(m: Record<string, unknown>, tablas: TablaSalida[]): string {
  const lineas = [
    '# Exportación del Aula Virtual — Centro de Datos', '',
    `- Exportación: \`${m.id_exportacion}\` · generada: ${m.fecha_exportacion} · corte de los datos (as_of): ${m.corte_datos}`,
    `- Modo: **${m.modo === 'investigacion' ? 'investigación (seudonimizado)' : 'identificado'}** · alcance: ${(m.alcance as { tipo: string }).tipo}`,
    `- Completa: **${m.completa ? 'sí' : 'NO'}** (cada tabla tiene exactamente las filas que el servidor contó para este alcance y corte).`, '',
    '## Contenido', '',
    '| Tabla | Carpeta | Filas | Origen | Descripción |', '|---|---|---|---|---|',
    ...tablas.map((t) => `| ${t.nombre} | ${t.carpeta} | ${t.filas.length} | ${t.origen} | ${t.descripcion.replace(/\|/g, '/')} |`), '',
    '## Cómo usarla', '',
    '- **diccionario_datos.csv**: qué significa cada variable, su tipo, unidad, origen (observado, registrado, inferido o calculado), cálculo y limitaciones.',
    '- **CSV**: UTF-8 con BOM, separador coma, CRLF. Los textos que empiezan con = + - @ llevan un apóstrofo delante para que Excel no los ejecute; JSON y SQL conservan el valor original.',
    '- **JSON Lines** (`json/*.jsonl`): una fila por línea con la estructura original (objetos anidados). En Python: `pandas.read_json(ruta, lines=True)`.',
    '- **Excel**: una hoja por tabla, con filtros. Las tablas de más de 1 048 575 filas continúan en hojas «(2)», «(3)»…',
    '- **SQLite**: `sqlite3 investigacion.sqlite < base_datos/investigacion.sql` crea la base con tablas, claves, relaciones, índices, `_diccionario` y `_manifiesto`.',
    '- Las tablas se relacionan por sus identificadores (por ejemplo `metricas_pregunta.attempt_id = intentos.id`, `eventos_originales.attempt_id = intentos.id`).', '',
    '## Verificación', '',
    '`manifest.json` contiene la huella SHA-256 de cada archivo y el recuento de filas por tabla. Para comprobar un archivo: `sha256sum ruta` (Linux/macOS) o `Get-FileHash ruta` (Windows).',
    'Repetir la misma exportación permite comparar recuentos y huellas para detectar cambios en los datos.', '',
    '## Limitaciones importantes', '',
    '- Las tablas **originales** son los registros tal como están en la base de datos; las **calculadas** (métricas, eventos normalizados, intervalos) se derivan de ellas y nunca las sustituyen.',
    '- Los eventos del navegador pueden perderse, llegar tarde o manipularse: son indicios, no evidencia infalible. La ausencia de eventos no equivale a inactividad; página oculta, inactividad y desconexión pueden superponerse.',
    '- Una respuesta que aparece de golpe o un tiempo anómalo no prueban fraude.',
    '- Instantánea: solo se incluyen filas creadas hasta el corte; filas que se actualizan (respuestas, intentos) reflejan su último estado (ver `updated_at`, `submitted_at`).',
    m.modo === 'investigacion'
      ? '- Modo investigación: personas como seudónimos estables (E-…, P-…), sin nombres, correos, matrículas ni ID de acceso. **Seudonimizar no es anonimizar**: los textos libres (respuestas abiertas, comentarios) pueden contener datos personales.'
      : '- Modo identificado: contiene datos personales. Guárdela cifrada y no la comparta fuera del ámbito autorizado.',
    '- Nunca se exportan contraseñas, tokens, códigos de desbloqueo o de asistencia, ubicación exacta, rutas de archivos ni registros de seguridad.',
  ];
  return lineas.join('\n') + '\n';
}

export async function construirPaquete(e: EntradaPaquete): Promise<ResultadoPaquete> {
  const tablas = tablasDeSalida(e);
  const advertencias = [...e.advertencias];
  const sinColumnas = tablas.filter((t) => !t.columnas.length).map((t) => t.nombre);
  if (sinColumnas.length) advertencias.push(`Tablas vacías cuyo esquema no se pudo obtener (se exportan sin columnas): ${sinColumnas.join(', ')}.`);
  const dicc = diccionario(tablas);
  const raiz = 'AULA_EXPORTACION/';
  const archivos: { ruta: string; datos: Uint8Array }[] = [];
  const fecha = e.fecha.toISOString().slice(0, 10);

  const recuentos = Object.fromEntries(tablas.map((t) => [t.nombre, t.filas.length]));
  const esperados = Object.fromEntries(Object.entries(e.esperados).map(([k, v]) => [nombreSalida(k), v]));
  const completa = Object.entries(esperados).every(([k, v]) => recuentos[k] === v);
  if (!completa) advertencias.push('Algún recuento no coincide con el del servidor: la exportación NO está completa.');
  const omitidas = FUENTES.filter((f) => !e.datos[f.nombre]).map((f) => ({ tabla: nombreSalida(f.nombre), motivo: e.contenido.includes(f.grupo) ? 'no disponible' : `no seleccionada (${GRUPOS[f.grupo]})` }));
  const vacias = tablas.filter((t) => t.filas.length === 0).map((t) => t.nombre);

  const base: Record<string, unknown> = {
    id_exportacion: e.exportId, fecha_exportacion: e.fecha.toISOString(), corte_datos: e.asOf, zona_horaria_presentacion: 'America/Santo_Domingo (las marcas se guardan en UTC)',
    version_esquema: VERSION_ESQUEMA, version_aplicacion: e.version, version_metricas: VERSION_METRICAS, modo: e.modo,
    alcance: { tipo: e.alcance.tipo, ids: e.alcance.ids_publicos, desde: e.alcance.desde ?? null, hasta: e.alcance.hasta ?? null },
    contenido: e.contenido, formatos: e.formatos,
    totales: {
      estudiantes: recuentos.estudiantes ?? 0, actividades: recuentos.actividades ?? 0, intentos: recuentos.intentos ?? 0,
      eventos_telemetria: recuentos.eventos_originales ?? 0, eventos_respuesta: recuentos.eventos_respuesta ?? 0, eventos_pregunta: recuentos.eventos_pregunta ?? 0,
    },
    registros_por_tabla: recuentos, registros_esperados_servidor: esperados, completa,
    consistencia: 'Filas creadas hasta corte_datos; las filas actualizables reflejan su último estado. Alcance y permisos resueltos en el servidor (export_begin).',
    tablas_omitidas: omitidas, tablas_vacias: vacias,
    excluido_siempre: ['autenticación y sesiones', 'registros de seguridad y accesos', 'contraseñas y huellas de contraseña', 'códigos de desbloqueo y de asistencia',
      'coordenadas y huella del dispositivo', 'rutas internas de archivos', 'texto completo de la teoría de las lecciones'],
  };

  const formatos = new Set(e.formatos);
  if (formatos.has('csv')) for (const t of tablas) archivos.push({ ruta: `${t.carpeta}/${t.nombre}.csv`, datos: utf8(tablaCsv(t.columnas, t.filas)) });
  if (formatos.has('json')) for (const t of tablas) archivos.push({ ruta: `json/${t.nombre}.jsonl`, datos: utf8(jsonl(t.filas)) });
  if (formatos.has('sqlite')) {
    const ts: TablaSql[] = tablas.map((t) => ({ nombre: t.nombre, columnas: t.columnas, filas: t.filas, clave: t.clave, relaciones: t.relaciones, tipos: t.tipos }));
    const trozos = scriptSqlite(ts, { diccionario: dicc, manifiesto: { id_exportacion: e.exportId, corte_datos: e.asOf, modo: e.modo, version_esquema: VERSION_ESQUEMA, completa: String(completa) } });
    archivos.push({ ruta: 'base_datos/investigacion.sql', datos: unirTextos(trozos) });
  }
  if (formatos.has('excel')) {
    const x = await crearXlsx([
      ...tablas.map((t) => ({ nombre: t.nombre, columnas: t.columnas, filas: t.filas })),
      { nombre: 'diccionario', columnas: COLUMNAS_DICCIONARIO, filas: dicc },
      { nombre: 'manifiesto', columnas: ['clave', 'valor'], filas: Object.entries(base).map(([clave, v]) => ({ clave, valor: typeof v === 'string' ? v : JSON.stringify(v) })) },
    ], { fecha: e.fecha });
    advertencias.push(...x.advertencias);
    archivos.push({ ruta: 'excel/datos_completos.xlsx', datos: unirTextos(x.partes) });
  }

  // solo Excel: un único .xlsx con las hojas «diccionario» y «manifiesto»; si no, un ZIP con todo
  const soloExcel = formatos.size === 1 && formatos.has('excel');
  if (!soloExcel) archivos.push({ ruta: 'diccionario_datos.csv', datos: utf8(tablaCsv(COLUMNAS_DICCIONARIO, dicc)) });
  const manifiesto = { ...base, advertencias, archivos: archivos.map((a) => ({ ruta: a.ruta, bytes: a.datos.length, sha256: sha256(a.datos) })) };
  if (!soloExcel) {
    const r = utf8(readme(manifiesto, tablas));
    archivos.push({ ruta: 'README.md', datos: r });
    manifiesto.archivos.push({ ruta: 'README.md', bytes: r.length, sha256: sha256(r) });
  }
  const manifiestoBytes = utf8(JSON.stringify(manifiesto, null, 2));
  const manifiestoSha = sha256(manifiestoBytes);
  const sufijo = `${fecha}_${e.exportId.slice(0, 8)}${completa ? '' : '_INCOMPLETA'}`;

  if (soloExcel) {
    const x = archivos.find((a) => a.ruta === 'excel/datos_completos.xlsx')!;
    return { nombre: `AULA_EXPORTACION_${sufijo}.xlsx`, tipo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', partes: [x.datos], manifiesto, manifiestoSha, advertencias };
  }
  const partes = await crearZip([{ ruta: `${raiz}manifest.json`, datos: manifiestoBytes }, ...archivos.map((a) => ({ ruta: raiz + a.ruta, datos: a.datos }))], { fecha: e.fecha });
  return { nombre: `AULA_EXPORTACION_${sufijo}.zip`, tipo: 'application/zip', partes, manifiesto, manifiestoSha, advertencias };
}

function unirTextos(trozos: (string | Uint8Array)[]): Uint8Array {
  const bytes = trozos.map((t) => (typeof t === 'string' ? utf8(t) : t));
  const out = new Uint8Array(bytes.reduce((s, b) => s + b.length, 0));
  let o = 0;
  for (const b of bytes) { out.set(b, o); o += b.length; }
  return out;
}
