/**
 * Fusión de cuentas (migración 82) · caso 7: dos administradores fusionan a la vez cuentas relacionadas.
 * Dos conexiones reales a PostgreSQL: A fusiona S → P y B, al mismo tiempo, S → Q (misma secundaria). La segunda espera
 * al bloqueo de la primera y, al continuar, ve que S ya está fusionada: se rechaza sin dejar estados a medias.
 * Después, B intenta el sentido contrario (P → S): también se rechaza.
 *
 * Uso: node privado/tmp/pruebas-sql-local.mjs && node privado/tmp/pruebas-pg.mjs fusion
 * Crea datos con el prefijo fb820000 en la base desechable (la bitácora de fusiones es inmutable: no se borran).
 */
import pg from 'pg';

const URL = process.env.PES_PG_URL ?? 'postgresql://postgres@127.0.0.1:55432/aula_prueba_local';
const U = (n: number) => `fb820000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const AD = U(2), SES = U(201), P = U(11), S = U(12), Q = U(13), C = U(91), A = U(92), ACT = U(93), ATT = U(94);
let fallos = 0;
const ok = (cond: boolean, msg: string) => { console.log(`${cond ? '✔' : '✖'} ${msg}`); if (!cond) fallos++; };

async function conectar() {
  const c = new pg.Client({ connectionString: URL });
  await c.connect();
  return c;
}
async function comoAdmin(c: pg.Client) {
  await c.query('begin');
  await c.query('set local role authenticated');
  await c.query(`select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true), set_config('request.path', '/rpc/prueba', true)`,
    [JSON.stringify({ sub: AD, role: 'authenticated', session_id: SES }), AD]);
}

const raiz = await conectar();
try {
  await raiz.query(`
    insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
      ('${AD}', 'fb02@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"admin-conc"}', '{}', now(), now()),
      ('${P}', 'fb11@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"conc-p"}', '{}', now(), now()),
      ('${S}', 'fb12@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"conc-s"}', '{}', now(), now()),
      ('${Q}', 'fb13@cuentas.aula.invalid', 'authenticated', 'authenticated', '{"login_id":"conc-q"}', '{}', now(), now());
    update public.profiles set must_change_password = false, active = true where id::text like 'fb820000-%';
    update public.profiles set role = 'admin' where id = '${AD}';
    insert into auth.sessions (id, user_id, created_at) values ('${SES}', '${AD}', now());
    insert into public.courses (id, title) values ('${C}', 'Curso concurrencia');
    insert into public.classes (id, course_id, name, join_code) values ('${A}', '${C}', 'Sección concurrencia', 'CONCUR01');
    insert into public.enrollments (class_id, user_id) values ('${A}', '${P}'), ('${A}', '${S}'), ('${A}', '${Q}');
    insert into public.activities (id, class_id, title, mode, published) values ('${ACT}', '${A}', 'Práctica concurrencia', 'practice', true);
    insert into public.attempts (id, user_id, course_id, activity_id, mode, status, submitted_at, score, max_score)
      values ('${ATT}', '${S}', '${C}', '${ACT}', 'practice', 'submitted', now(), 70, 100);`);

  const a = await conectar(), b = await conectar();
  await comoAdmin(a);
  await comoAdmin(b);
  const hA = (await a.query(`select public.fusion_vista_previa($1, $2) ->> 'huella' h`, [P, S])).rows[0].h as string;
  const hB = (await b.query(`select public.fusion_vista_previa($1, $2) ->> 'huella' h`, [Q, S])).rows[0].h as string;
  // A ejecuta y mantiene la transacción abierta (con los bloqueos); B lanza la suya, que debe quedar esperando
  await a.query(`select public.fusion_ejecutar($1, $2, $3, '{}', false, 'Concurrencia A')`, [P, S, hA]);
  let bTermino = false;
  const promesaB = b.query(`select public.fusion_ejecutar($1, $2, $3, '{}', false, 'Concurrencia B')`, [Q, S, hB])
    .then(() => ({ ok: true as const }), (e: Error) => ({ ok: false as const, msg: e.message }))
    .finally(() => { bTermino = true; });
  await new Promise((r) => setTimeout(r, 800));
  ok(!bTermino, 'la segunda fusión espera al bloqueo de la primera (no avanza en paralelo)');
  await a.query('commit');
  const rB = await promesaB;
  ok(!rB.ok && /fusionada|cambiaron/i.test(rB.ok ? '' : rB.msg), `la segunda se rechaza al ver la cuenta ya fusionada (${rB.ok ? 'se ejecutó' : rB.msg})`);
  await b.query('rollback');

  // estado final coherente: una sola fusión vigente; el intento de S está en P y solo en P
  const ops = await raiz.query(`select count(*)::int n from public.fusion_operaciones where secundaria = $1 and estado <> 'revertida'`, [S]);
  ok(ops.rows[0].n === 1, 'una sola fusión vigente para la secundaria');
  const att = await raiz.query(`select user_id from public.attempts where id = $1`, [ATT]);
  ok(att.rows[0].user_id === P, 'el intento quedó en la principal de la fusión que ganó');
  const sAct = await raiz.query(`select active from public.profiles where id = $1`, [S]);
  ok(sAct.rows[0].active === false, 'la secundaria quedó desactivada');

  // sentido contrario (P → S) después: rechazado
  await comoAdmin(b);
  const hC = (await b.query(`select public.fusion_vista_previa($1, $2) v`, [S, P])).rows[0].v as { bloqueos: string[]; huella: string };
  ok(hC.bloqueos.length > 0, `el sentido contrario queda bloqueado (${hC.bloqueos.join('; ')})`);
  const rC = await b.query(`select public.fusion_ejecutar($1, $2, $3, '{}', false, 'Sentido contrario')`, [S, P, hC.huella]).then(() => 'ejecutó', (e: Error) => e.message);
  ok(rC !== 'ejecutó', 'y no se ejecuta');
  await b.query('rollback');
  await a.end();
  await b.end();
} catch (e) {
  console.log('✖ error inesperado:', e instanceof Error ? e.message : e);
  fallos++;
} finally {
  await raiz.end();
}
console.log(fallos ? `\n✖ ${fallos} fallo(s)` : '\n✔ CONCURRENCIA DE FUSIONES: TODO PASÓ');
process.exit(fallos ? 1 : 0);
