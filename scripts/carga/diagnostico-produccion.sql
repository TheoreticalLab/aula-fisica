-- =============================================================================
-- Diagnóstico de E/S en PRODUCCIÓN — SOLO LECTURA y barato (catálogos y vistas de estadísticas; ningún recorrido de
-- tablas de datos, salvo realtime.subscription, que tiene una fila por suscripción abierta).
-- No cambia nada: no hace reset de estadísticas, no crea objetos, no toca datos, no bloquea tablas.
--
-- CÓMO EJECUTARLO (Supabase → SQL Editor → «New query», pegar este archivo):
--   · El editor muestra SOLO el resultado de la última sentencia: seleccione UN bloque (de «-- N)» a su «;»),
--     pulse «Run» (o Ctrl+Enter, que ejecuta la selección) y descargue el resultado con «Export → CSV».
--   · Cuándo: justo DESPUÉS de una clase (las estadísticas son acumuladas desde el último reinicio o reset) y otra vez
--     tras la primera clase con el modo de bajo consumo, para comparar periodos equivalentes. Anote la hora (bloque 1).
--   · Si un bloque da «does not exist», esa vista no existe en su versión de PostgreSQL: anótelo y siga.
--   · Lo que NO da SQL (CPU, memoria, swap, IOPS y el presupuesto de Disk IO) está en el panel:
--       Project → Reports → Database (o Observability): gráficos «CPU usage», «Memory usage» (incluye swap),
--       «Disk IOPS», «Disk throughput» y «Disk IO budget» / «Disk IO % consumed». Elija el rango de una clase
--       (y el de cualquier incidente que quiera explicar) y haga una captura de cada gráfico.
--       Settings → Compute and Disk: tamaño de cómputo (Nano/Micro…), IOPS y rendimiento base del disco.
--       Logs → Postgres / Auth: errores y 429 durante esas horas.
-- =============================================================================

-- 1) ¿Desde cuándo cuentan las estadísticas? (para convertir totales en tasas)
select now() ahora, pg_postmaster_start_time() arranque, (select stats_reset from pg_stat_database where datname = current_database()) reset_bd,
       (select stats_reset from pg_stat_wal) reset_wal, (select stats_reset from pg_stat_statements_info) reset_statements;

-- 2) Volumen de WAL (escritura): registros, páginas completas y bytes por hora desde el último reset
select wal_records, wal_fpi, pg_size_pretty(wal_bytes) wal, wal_buffers_full, wal_write, wal_sync,
       round(wal_bytes / greatest(extract(epoch from now() - stats_reset), 1) * 3600 / 1048576, 1) mb_wal_por_hora
from pg_stat_wal;

-- 3) Puntos de control y escrituras de páginas (si checkpoints_req es alto, el WAL obliga a puntos de control extra)
select * from pg_stat_bgwriter;

-- 4) Aciertos de caché por base de datos (lecturas a disco vs memoria) y archivos temporales (operaciones en disco)
select datname, blks_read, blks_hit, round(100.0 * blks_hit / greatest(blks_hit + blks_read, 1), 2) acierto_pct,
       xact_commit, xact_rollback, tup_inserted, tup_updated, tup_deleted, temp_files, pg_size_pretty(temp_bytes) temp
from pg_stat_database where datname = current_database();

-- 5) Las 15 sentencias que más WAL generan (escrituras)
select calls, round(total_exec_time::numeric) total_ms, round(mean_exec_time::numeric, 2) media_ms, pg_size_pretty(wal_bytes::bigint) wal,
       wal_fpi, shared_blks_dirtied ensuciados, shared_blks_written escritos, left(regexp_replace(query, '\s+', ' ', 'g'), 140) consulta
from pg_stat_statements order by wal_bytes desc limit 15;

-- 6) Las 15 con más lecturas físicas (bloques leídos de disco: si la base no cabe en memoria)
select calls, round(total_exec_time::numeric) total_ms, shared_blks_read leidos_disco, shared_blks_hit en_cache,
       round(100.0 * shared_blks_hit / greatest(shared_blks_hit + shared_blks_read, 1), 1) acierto_pct, left(regexp_replace(query, '\s+', ' ', 'g'), 140) consulta
from pg_stat_statements order by shared_blks_read desc limit 15;

-- 7) Las 20 con más tiempo acumulado y las más frecuentes (incluye realtime.list_changes si Realtime está activo)
select calls, round(total_exec_time::numeric) total_ms, round(mean_exec_time::numeric, 2) media_ms, rows, left(regexp_replace(query, '\s+', ' ', 'g'), 140) consulta
from pg_stat_statements order by total_exec_time desc limit 20;
select calls, round(total_exec_time::numeric) total_ms, round(mean_exec_time::numeric, 2) media_ms, left(regexp_replace(query, '\s+', ' ', 'g'), 140) consulta
from pg_stat_statements order by calls desc limit 20;

-- 8) Tablas más escritas y si sus actualizaciones son HOT (sin tocar índices) y si se recorren enteras
select schemaname, relname, n_tup_ins ins, n_tup_upd upd, n_tup_hot_upd hot, n_tup_del del, n_live_tup vivas, n_dead_tup muertas,
       seq_scan, seq_tup_read, idx_scan, last_autovacuum, autovacuum_count, last_autoanalyze
from pg_stat_all_tables where n_tup_ins + n_tup_upd + n_tup_del > 0 order by n_tup_ins + n_tup_upd + n_tup_del desc limit 25;

-- 9) Tamaño de las tablas más grandes de TODOS los esquemas (incluye realtime, auth, storage, net, cron, supabase_functions)
select n.nspname esquema, c.relname tabla, pg_size_pretty(pg_total_relation_size(c.oid)) total, pg_total_relation_size(c.oid) bytes
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p', 'm') order by pg_total_relation_size(c.oid) desc limit 25;
select pg_size_pretty(pg_database_size(current_database())) tamano_base;

-- 10) Realtime: ranuras de replicación (WAL retenido) y suscripciones por tabla
select slot_name, plugin, slot_type, active, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) wal_retenido,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)) sin_confirmar
from pg_replication_slots;
select entity::regclass tabla, count(*) suscripciones from realtime.subscription group by 1 order by 2 desc;

-- 11) Conexiones por aplicación y estado (PostgREST, Realtime, Auth, Supavisor…), y esperas en este momento
select usename, application_name, state, wait_event_type, count(*) from pg_stat_activity group by 1, 2, 3, 4 order by 5 desc;

-- 11b) Bloqueos en este momento: quién espera y quién lo bloquea (vacío = sin bloqueos)
select w.pid esperando, w.wait_event_type, left(w.query, 80) consulta_esperando, b.pid bloqueando, b.state, left(b.query, 80) consulta_bloqueando,
       now() - w.query_start espera_desde
from pg_stat_activity w join lateral unnest(pg_blocking_pids(w.pid)) bp(pid) on true join pg_stat_activity b on b.pid = bp.pid;

-- 11c) Esperas por bloqueo acumuladas y sentencias con archivos temporales (operaciones en disco)
select calls, temp_blks_written, round(total_exec_time::numeric) total_ms, left(regexp_replace(query, '\s+', ' ', 'g'), 120) consulta
from pg_stat_statements where temp_blks_written > 0 order by temp_blks_written desc limit 10;
select datname, deadlocks, conflicts from pg_stat_database where datname = current_database();

-- 12) Configuración relevante de la instancia
select name, setting, unit from pg_settings where name in ('shared_buffers', 'effective_cache_size', 'work_mem', 'max_connections', 'checkpoint_timeout',
  'max_wal_size', 'wal_compression', 'synchronous_commit', 'full_page_writes', 'autovacuum_naptime', 'wal_level', 'max_replication_slots');

-- 12b) Tiempo máximo por sentencia de cada rol (Supabase: anon 3 s y authenticated 8 s por defecto). El aula corta en el
--      navegador a los 25 s: por encima de esto nunca corta una consulta que el servidor fuera a terminar.
select rolname, rolconfig from pg_roles where rolname in ('anon', 'authenticated', 'service_role', 'authenticator', 'postgres');

-- 13) Tareas programadas y su historial (si pg_cron está instalado; si da error «no existe», no lo está)
-- select jobid, schedule, command, active from cron.job;
-- select count(*), max(end_time) from cron.job_run_details;
