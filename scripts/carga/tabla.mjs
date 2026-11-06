// Pruebas de carga · tabla Markdown «antes / después» a partir de privado/carga/*.json (para el informe).
// Uso: node scripts/carga/tabla.mjs [sostenida|entrada]
import { existsSync, readFileSync } from 'node:fs';

// Uso: node scripts/carga/tabla.mjs [sostenida|entrada] [prefijo «después», p. ej. despues88]
const modo = process.argv[2] ?? 'sostenida';
const DESPUES = process.argv[3] ?? 'despues';
const ns = [1, 5, 10, 15, 20, 25, 50];
const leer = (p, n) => {
  const f = `privado/carga/${p === 'despues' ? DESPUES : p}-${modo}-${n}.json`;
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
};
const pct = (a, d) => (a ? `${d >= a ? '+' : '−'}${Math.abs(Math.round((100 * (d - a)) / a))} %` : '—');
const fmt = (x, dec = 1) => (x === undefined || x === null ? '—' : Number(x).toLocaleString('es-DO', { maximumFractionDigits: dec }));
console.log(`| Est. | Peticiones/est·min (antes → después) | Commits/s | Filas escritas | WAL (MB) | Sincronizaciones WAL/s | Escrito a disco (MB) | p95 (ms) | p99 (ms) | Carga inicial p95 (ms) | CPU PG % | Errores | Respuestas confirmadas / faltantes |`);
console.log('|---:|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const n of ns) {
  const a = leer('antes', n), d = leer('despues', n);
  if (!a && !d) continue;
  const e = (r) => r && r.escritura.filas_insertadas + r.escritura.filas_actualizadas + r.escritura.filas_borradas;
  const par = (fa, fd, dec = 1, conPct = true) => `${fmt(fa, dec)} → ${fmt(fd, dec)}${conPct && a && d ? ` (${pct(fa, fd)})` : ''}`;
  console.log(`| ${n} | ${par(a?.peticiones_estudiante_min, d?.peticiones_estudiante_min)} | ${par(a?.escritura.commits_por_s, d?.escritura.commits_por_s, 2)} | ${par(e(a), e(d), 0)} | ${par(a?.escritura.wal_mb, d?.escritura.wal_mb, 2)} | ${par(a?.escritura.wal_sync_por_s, d?.escritura.wal_sync_por_s, 2)} | ${par(a?.escritura.disco_escrito_mb_proc, d?.escritura.disco_escrito_mb_proc, 0)} | ${par(a?.latencia_ms.p95, d?.latencia_ms.p95, 0, false)} | ${par(a?.latencia_ms.p99, d?.latencia_ms.p99, 0, false)} | ${par(a?.carga_inicial_ms.p95, d?.carga_inicial_ms.p95, 0, false)} | ${par(a?.cpu_pg_pct_medio, d?.cpu_pg_pct_medio, 1, false)} | ${a?.errores_total ?? '—'} / ${d?.errores_total ?? '—'} | ${a ? `${a.integridad.respuestas_confirmadas}/${a.integridad.respuestas_faltantes}` : '—'} · ${d ? `${d.integridad.respuestas_confirmadas}/${d.integridad.respuestas_faltantes}` : '—'} |`);
}
