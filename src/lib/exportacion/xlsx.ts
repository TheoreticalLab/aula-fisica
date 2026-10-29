/**
 * Centro de Datos · escritor de libros Excel (.xlsx, Office Open XML) sin dependencias.
 *  · Una hoja por tabla, encabezado en negrita, fila superior fija y filtros automáticos.
 *  · Textos como «inlineStr»: Excel nunca los evalúa como fórmulas (no hace falta alterar el valor).
 *  · Más de 1 048 575 filas: la tabla continúa en hojas «(2)», «(3)»… Nunca se trunca en silencio.
 *  · Una celda admite como máximo 32 767 caracteres: si un texto lo supera se marca y se cuenta como advertencia
 *    (el valor completo queda en CSV y JSON Lines).
 */
import { crearZip, type EntradaZip } from './zip';
import { utf8, type Fila } from './formato';

export interface HojaXlsx { nombre: string; columnas: string[]; filas: Fila[] }
export interface ResultadoXlsx { partes: Uint8Array[]; hojas: { nombre: string; tabla: string; filas: number }[]; advertencias: string[] }

export const FILAS_MAX = 1_048_575;          // filas de datos por hoja (más el encabezado)
const CELDA_MAX = 32_767;

const escapar = (s: string) =>
  s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function letraColumna(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function nombreHoja(base: string, usados: Set<string>): string {
  const limpio = base.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || 'Hoja';
  let n = limpio, k = 2;
  while (usados.has(n.toLowerCase())) n = `${limpio.slice(0, 27)} (${k++})`;
  usados.add(n.toLowerCase());
  return n;
}

function celda(ref: string, v: unknown, contar: () => void, estilo = 0): string {
  if (v === null || v === undefined || v === '') return '';
  const s = estilo ? ` s="${estilo}"` : '';
  if (typeof v === 'number') return Number.isFinite(v) ? `<c r="${ref}"${s}><v>${v}</v></c>` : '';
  if (typeof v === 'boolean') return `<c r="${ref}" t="b"${s}><v>${v ? 1 : 0}</v></c>`;
  let t = typeof v === 'string' ? v : JSON.stringify(v);
  if (t.length > CELDA_MAX) { t = `${t.slice(0, CELDA_MAX - 60)} …[TEXTO RECORTADO EN EXCEL: el valor completo está en CSV/JSON]`; contar(); }
  return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${escapar(t)}</t></is></c>`;
}

function hojaXml(columnas: string[], filas: Fila[], contar: () => void): Uint8Array[] {
  const ultima = letraColumna(Math.max(columnas.length - 1, 0));
  const trozos: Uint8Array[] = [];
  trozos.push(utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>'
    + `<row r="1">${columnas.map((c, i) => celda(`${letraColumna(i)}1`, c, contar, 1)).join('')}</row>`));
  const letras = columnas.map((_, i) => letraColumna(i));
  let buf = '';
  filas.forEach((f, k) => {
    const r = k + 2;
    let fila = `<row r="${r}">`;
    for (let i = 0; i < columnas.length; i++) fila += celda(`${letras[i]}${r}`, f[columnas[i]], contar);
    buf += fila + '</row>';
    if (buf.length > 1_000_000) { trozos.push(utf8(buf)); buf = ''; }
  });
  trozos.push(utf8(buf + `</sheetData><autoFilter ref="A1:${ultima}${filas.length + 1}"/></worksheet>`));
  return trozos;
}

const unirBytes = (xs: Uint8Array[]) => {
  const out = new Uint8Array(xs.reduce((s, x) => s + x.length, 0));
  let o = 0;
  for (const x of xs) { out.set(x, o); o += x.length; }
  return out;
};

export async function crearXlsx(hojas: HojaXlsx[], opciones: { filasMax?: number; fecha?: Date } = {}): Promise<ResultadoXlsx> {
  const max = opciones.filasMax ?? FILAS_MAX;
  const usados = new Set<string>();
  const advertencias: string[] = [];
  const reales: { nombre: string; tabla: string; columnas: string[]; filas: Fila[] }[] = [];
  for (const h of hojas) {
    const trozos = Math.max(1, Math.ceil(h.filas.length / max));
    if (trozos > 1) advertencias.push(`La tabla «${h.nombre}» (${h.filas.length} filas) supera el límite de Excel y se reparte en ${trozos} hojas.`);
    for (let k = 0; k < trozos; k++) {
      reales.push({ nombre: nombreHoja(k ? `${h.nombre} (${k + 1})` : h.nombre, usados), tabla: h.nombre, columnas: h.columnas, filas: h.filas.slice(k * max, (k + 1) * max) });
    }
  }
  let recortadas = 0;
  const contar = () => { recortadas++; };
  const entradas: EntradaZip[] = [];
  const ct = reales.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
  entradas.push({ ruta: '[Content_Types].xml', datos: utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + ct + '</Types>') });
  entradas.push({ ruta: '_rels/.rels', datos: utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') });
  entradas.push({ ruta: 'xl/workbook.xml', datos: utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
    + reales.map((h, i) => `<sheet name="${escapar(h.nombre).replace(/"/g, '&quot;')}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets>'
    + '<definedNames>' + reales.map((h, i) => `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${escapar(h.nombre).replace(/'/g, "''")}'!$A$1:$${letraColumna(Math.max(h.columnas.length - 1, 0))}$${h.filas.length + 1}</definedName>`).join('') + '</definedNames></workbook>') });
  entradas.push({ ruta: 'xl/_rels/workbook.xml.rels', datos: utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + reales.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
    + `<Relationship Id="rId${reales.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`) });
  entradas.push({ ruta: 'xl/styles.xml', datos: utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
    + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
    + '<borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs>'
    + '<cellXfs count="2"><xf fontId="0"/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>') });
  reales.forEach((h, i) => entradas.push({ ruta: `xl/worksheets/sheet${i + 1}.xml`, datos: unirBytes(hojaXml(h.columnas, h.filas, contar)) }));
  if (recortadas) advertencias.push(`${recortadas} celda(s) superaban los 32 767 caracteres que admite Excel y se recortaron SOLO en el .xlsx (el valor completo está en CSV y JSON).`);
  const partes = await crearZip(entradas, { fecha: opciones.fecha });
  return { partes, hojas: reales.map((h) => ({ nombre: h.nombre, tabla: h.tabla, filas: h.filas.length })), advertencias };
}
