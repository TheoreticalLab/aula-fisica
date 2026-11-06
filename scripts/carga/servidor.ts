/**
 * Pruebas de carga · PostgreSQL LOCAL desechable (privado/tmp/pgprueba, base aula_prueba = copia del último respaldo).
 * Nunca se conecta a producción: escucha solo en 127.0.0.1 y no lee credenciales.
 * Configuración «de instancia pequeña» (para que la E/S se parezca a la de un plan Nano/Micro): shared_buffers de
 * 128 MB, fsync y full_page_writes activados (por defecto), puntos de control cada 5 min y pg_stat_statements.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { readdirSync, readFileSync, rmSync } from 'node:fs';
import pg from 'pg';

export const PUERTO = 55432;
export const URL_DB = `postgresql://postgres@127.0.0.1:${PUERTO}/aula_prueba`;
const DATOS = 'privado/tmp/pgprueba';
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface Servidor { srv: ChildProcess; pid: number; registro: () => string; esperas: () => { espera: number; interbloqueo: number } }

export async function arrancar(): Promise<Servidor> {
  for (let i = 0; i < 120; i++) {
    let pid = 0;
    try { pid = Number(readFileSync(`${DATOS}/postmaster.pid`, 'utf8').split('\n')[0]); } catch { break; }
    let vivo = false;
    try { process.kill(pid, 0); vivo = readFileSync(`/proc/${pid}/cmdline`, 'utf8').includes('postgres'); } catch { /* no existe */ }
    if (!vivo) { try { rmSync(`${DATOS}/postmaster.pid`); } catch { /* */ } break; }
    await esperar(500);
  }
  const srv = spawn('/usr/lib/postgresql/16/bin/postgres', ['-D', DATOS, '-c', 'listen_addresses=127.0.0.1', '-c', `port=${PUERTO}`,
    '-c', 'unix_socket_directories=', '-c', 'max_connections=120', '-c', 'shared_buffers=128MB', '-c', 'checkpoint_timeout=5min',
    '-c', 'shared_preload_libraries=pg_stat_statements', '-c', 'pg_stat_statements.track=all', '-c', 'track_io_timing=on',
    '-c', 'track_wal_io_timing=on', '-c', 'log_lock_waits=on', '-c', 'deadlock_timeout=200ms', '-c', 'logging_collector=off',
    '-c', 'log_min_messages=warning'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let registro = '';
  const esperas = { espera: 0, interbloqueo: 0 };
  srv.stderr?.on('data', (d) => {
    const t = String(d);
    registro = (registro + t).slice(-20000);
    for (const l of t.split('\n')) {
      if (l.includes('still waiting for')) esperas.espera++;
      else if (l.includes('deadlock detected')) esperas.interbloqueo++;
    }
  });
  for (let i = 0; i < 80; i++) {
    const c = new pg.Client({ connectionString: URL_DB });
    try {
      await c.connect();
      await c.query('create extension if not exists pg_stat_statements');
      await c.end();
      return { srv, pid: srv.pid!, registro: () => registro, esperas: () => esperas };
    } catch { await esperar(250); }
  }
  srv.kill('SIGINT');
  throw new Error('no arrancó PostgreSQL: ' + registro.slice(-500));
}

export async function parar(s: Servidor) {
  if (s.srv.exitCode !== null || s.srv.signalCode !== null) return;
  const salida = new Promise((r) => s.srv.once('exit', r));
  s.srv.kill('SIGINT');
  const t = setTimeout(() => s.srv.kill('SIGTERM'), 60_000);
  await salida;
  clearTimeout(t);
}

function procesos(pidRaiz: number): number[] {
  const r: number[] = [];
  for (const d of readdirSync('/proc')) {
    if (!/^\d+$/.test(d)) continue;
    try {
      const st = readFileSync(`/proc/${d}/stat`, 'utf8');
      const ppid = Number(st.slice(st.lastIndexOf(')') + 2).split(' ')[1]);
      if (Number(d) === pidRaiz || ppid === pidRaiz) r.push(Number(d));
    } catch { /* terminado */ }
  }
  return r;
}

/** CPU acumulada (ms) de PostgreSQL: utime+stime de todos sus procesos + lo recogido de los que terminaron. */
export function cpuPostgresMs(pidRaiz: number): number {
  let total = 0;
  for (const p of procesos(pidRaiz)) {
    try {
      const st = readFileSync(`/proc/${p}/stat`, 'utf8');
      const c = st.slice(st.lastIndexOf(')') + 2).split(' ');
      total += (Number(c[11]) + Number(c[12])) * 10;
      if (p === pidRaiz) total += (Number(c[13]) + Number(c[14])) * 10;
    } catch { /* */ }
  }
  return total;
}

/** Memoria residente (MB) de PostgreSQL. */
export function rssPostgresMb(pidRaiz: number): number {
  let kb = 0;
  for (const p of procesos(pidRaiz)) {
    try { kb += Number((readFileSync(`/proc/${p}/status`, 'utf8').match(/VmRSS:\s+(\d+)/) ?? [0, 0])[1]); } catch { /* */ }
  }
  return Math.round(kb / 1024);
}

/** Bytes que los procesos VIVOS de PostgreSQL han mandado escribir a disco (/proc/<pid>/io, write_bytes). */
export function escrituraDiscoBytes(pidRaiz: number): { escritos: number; leidos: number } {
  let w = 0, r = 0;
  for (const p of procesos(pidRaiz)) {
    try {
      const io = readFileSync(`/proc/${p}/io`, 'utf8');
      w += Number((io.match(/^write_bytes:\s+(\d+)/m) ?? [0, 0])[1]);
      r += Number((io.match(/^read_bytes:\s+(\d+)/m) ?? [0, 0])[1]);
    } catch { /* sin permiso o terminado */ }
  }
  return { escritos: w, leidos: r };
}
