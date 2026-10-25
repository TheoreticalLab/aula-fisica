/**
 * Utilidades de cuentas compartidas por las Edge Functions y el panel de administración.
 * Sin dependencias: funciona en Deno, en el navegador y en Node (Vitest).
 */

export const LOGIN_RE = /^[a-z0-9][a-z0-9._-]{2,39}$/;

export function normalizarId(id: string): string {
  return (id ?? '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
}

export function idValido(id: string): boolean {
  return LOGIN_RE.test(normalizarId(id));
}

// Sin caracteres ambiguos al dictar o leer en papel (0/O, 1/l/I).
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

function aleatorioUniforme(n: number): number {
  // muestreo por rechazo: sin sesgo de módulo
  const limite = Math.floor(256 / n) * n;
  const b = new Uint8Array(1);
  for (;;) {
    crypto.getRandomValues(b);
    if (b[0] < limite) return b[0] % n;
  }
}

/**
 * Contraseña provisional: 12 caracteres aleatorios (~70 bits de entropía) en 3 bloques legibles,
 * p. ej. «Kp7m-Qx3r-Tz9w». Siempre contiene mayúsculas, minúsculas y dígitos.
 */
export function generarContrasena(): string {
  for (;;) {
    const chars = Array.from({ length: 12 }, () => ALFABETO[aleatorioUniforme(ALFABETO.length)]);
    const s = chars.join('');
    if (/[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
  }
}

/** Correo técnico aleatorio de una cuenta (no se usa para enviar nada y no revela el ID). */
export function correoTecnico(dominio: string): string {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return `u${[...b].map((x) => x.toString(16).padStart(2, '0')).join('')}@${dominio}`;
}

/** Reglas para la contraseña que elige el usuario. Devuelve los problemas (vacío = válida). */
export function problemasContrasena(pw: string, id?: string): string[] {
  const p: string[] = [];
  if (pw.length < 10) p.push('Debe tener al menos 10 caracteres.');
  if (pw.length > 72) p.push('Debe tener como máximo 72 caracteres.');
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(pw) || !/[0-9]/.test(pw)) p.push('Debe combinar letras y números.');
  if (/^(.)\1+$/.test(pw)) p.push('No puede repetir un único carácter.');
  if (id && normalizarId(pw).includes(normalizarId(id))) p.push('No puede contener su ID.');
  return p;
}

export interface FilaCuenta {
  login_id: string;
  full_name: string;
  student_code?: string;
  role?: 'student' | 'teacher';
  secciones?: string[]; // nombres o códigos de sección tal como vienen en el CSV
}

export interface ResultadoCsv {
  filas: FilaCuenta[];
  errores: { linea: number; mensaje: string }[];
}

function separarCsv(linea: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (q) {
      if (ch === '"' && linea[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/**
 * Lee un CSV de cuentas (separador «;» o «,»). Columnas reconocidas (encabezado obligatorio):
 *   id | nombre | matricula (opcional) | rol (opcional: estudiante/profesor) | secciones (opcional, separadas por «|»)
 */
export function leerCsvCuentas(texto: string): ResultadoCsv {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/);
  const errores: ResultadoCsv['errores'] = [];
  const filas: FilaCuenta[] = [];
  const primera = lineas.findIndex((l) => l.trim());
  if (primera < 0) return { filas, errores: [{ linea: 1, mensaje: 'El archivo está vacío.' }] };
  const sep = (lineas[primera].match(/;/g)?.length ?? 0) >= (lineas[primera].match(/,/g)?.length ?? 0) ? ';' : ',';
  const enc = separarCsv(lineas[primera], sep).map((h) => h.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());
  const col = (...nombres: string[]) => enc.findIndex((h) => nombres.includes(h));
  const cId = col('id', 'login', 'usuario', 'login_id');
  const cNom = col('nombre', 'nombre completo', 'full_name', 'estudiante');
  const cMat = col('matricula', 'student_code', 'codigo');
  const cRol = col('rol', 'role');
  const cSec = col('secciones', 'seccion', 'clases', 'clase');
  if (cId < 0 || cNom < 0) return { filas, errores: [{ linea: primera + 1, mensaje: 'El encabezado debe incluir las columnas «id» y «nombre».' }] };
  const vistos = new Set<string>();
  for (let i = primera + 1; i < lineas.length; i++) {
    if (!lineas[i].trim()) continue;
    const c = separarCsv(lineas[i], sep);
    const id = normalizarId(c[cId] ?? '');
    const nombre = (c[cNom] ?? '').replace(/\s+/g, ' ').trim();
    if (!LOGIN_RE.test(id)) {
      errores.push({ linea: i + 1, mensaje: `ID inválido «${c[cId] ?? ''}» (3 a 40 letras, dígitos, punto, guion o guion bajo).` });
      continue;
    }
    if (!nombre) {
      errores.push({ linea: i + 1, mensaje: `Falta el nombre de ${id}.` });
      continue;
    }
    if (vistos.has(id)) {
      errores.push({ linea: i + 1, mensaje: `ID repetido en el archivo: ${id}.` });
      continue;
    }
    vistos.add(id);
    const rolTxt = cRol >= 0 ? (c[cRol] ?? '').toLowerCase() : '';
    filas.push({
      login_id: id,
      full_name: nombre.slice(0, 120),
      student_code: cMat >= 0 && c[cMat] ? c[cMat].slice(0, 40) : undefined,
      role: /^prof|^teach|^doc/.test(rolTxt) ? 'teacher' : 'student',
      secciones: cSec >= 0 && c[cSec] ? c[cSec].split('|').map((s) => s.trim()).filter(Boolean) : [],
    });
  }
  if (filas.length > 300) errores.push({ linea: 0, mensaje: 'Máximo 300 cuentas por importación; divida el archivo.' });
  return { filas, errores };
}
