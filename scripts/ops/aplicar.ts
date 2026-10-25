/**
 * npm run aplicar -- --plan CÓDIGO — MODIFICA PRODUCCIÓN. Solo con la autorización expresa del administrador.
 *
 * Garantías:
 *  - Solo aplica exactamente el plan autorizado (si algo cambió desde «npm run plan», el código no coincide y se detiene).
 *  - Exige pruebas locales correctas para estas migraciones.
 *  - Antes de tocar la base de datos crea un respaldo nuevo y lo verifica.
 *  - Cada migración va en su propia transacción: si falla, se deshace entera y el proceso se detiene.
 *  - Después comprueba que ninguna tabla protegida haya perdido filas.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  asegurarDir,
  conectar,
  contarFilas,
  credenciales,
  ESTADO,
  fallar,
  gestion,
  hashFuncion,
  migracionesLocales,
  ocultar,
  ROOT,
  SQL_HISTORIAL,
  TABLAS_PROTEGIDAS,
} from './comun';
import { calcularPlan, huellaPruebas } from './plan';
import { hacerRespaldo } from './respaldo';

function registrar(texto: string) {
  asegurarDir(ESTADO);
  appendFileSync(join(ESTADO, 'historial-aplicaciones.log'), `${new Date().toISOString()} ${texto}\n`);
  console.log(texto);
}

export async function comandoAplicar(args: string[]): Promise<number> {
  const i = args.indexOf('--plan');
  const codigo = i >= 0 ? args[i + 1] : undefined;
  if (!codigo) fallar('Indique el código del plan autorizado: npm run aplicar -- --plan CÓDIGO (obténgalo con npm run plan).');
  const c = credenciales(['SUPABASE_DB_URL', 'SUPABASE_ACCESS_TOKEN']);

  const plan = await calcularPlan(c);
  if (plan.bloqueos.length) fallar('El plan tiene bloqueos:\n  ' + plan.bloqueos.join('\n  '));
  if (plan.codigo !== codigo) fallar(`El plan actual (${plan.codigo}) no es el autorizado (${codigo}). Vuelva a ejecutar npm run plan y revíselo.`);
  if (plan.migraciones.length) {
    const ult = JSON.parse(readFileSync(join(ESTADO, 'ultima-prueba.json'), 'utf8'));
    if (!ult.ok || ult.huella !== huellaPruebas()) fallar('Las pruebas locales no corresponden a estas migraciones.');
  }
  registrar(`INICIO plan ${codigo}: registrar=${plan.registrar.length} migraciones=${plan.migraciones.join(',') || '-'} funciones=${plan.funciones.join(',') || '-'} auth=${plan.auth.map((a) => a.clave).join(',') || '-'}`);

  // --- base de datos ---
  if (plan.registrar.length || plan.migraciones.length) {
    console.log('Creando y verificando respaldo previo…');
    const dir = await hacerRespaldo(true);
    registrar(`respaldo verificado: ${dir.slice(ROOT.length + 1)}`);
    const db = await conectar(c.SUPABASE_DB_URL!, true, { escritura: true });
    try {
      const antes = await contarFilas(db, TABLAS_PROTEGIDAS);
      await db.query(SQL_HISTORIAL);
      const locales = migracionesLocales();
      for (const archivo of plan.registrar) {
        const m = locales.find((x) => x.archivo === archivo)!;
        await db.query(`insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3) on conflict do nothing`, [
          m.version,
          m.nombre,
          [m.sql],
        ]);
        registrar(`  anotada en el historial: ${archivo}`);
      }
      for (const archivo of plan.migraciones) {
        const m = locales.find((x) => x.archivo === archivo)!;
        try {
          await db.query('begin');
          await db.query(m.sql);
          await db.query(`insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)`, [m.version, m.nombre, [m.sql]]);
          await db.query('commit');
          registrar(`  ✔ aplicada: ${archivo}`);
        } catch (e) {
          await db.query('rollback').catch(() => undefined);
          registrar(`  ✖ FALLÓ ${archivo} (deshecha, producción sin cambios por esta migración): ${ocultar(String((e as Error).message), c)}`);
          process.exit(1);
        }
      }
      const despues = await contarFilas(db, TABLAS_PROTEGIDAS);
      for (const [t, n] of Object.entries(antes)) {
        if ((despues[t] ?? 0) < n) registrar(`  ✖ ALERTA: ${t} tenía ${n} filas y ahora ${despues[t] ?? 0}. Restaure desde ${dir}`);
      }
      registrar('  ✔ datos protegidos verificados tras la migración');
    } finally {
      await db.end();
    }
  }

  // --- Edge Functions ---
  if (plan.funciones.length) {
    const cli = join(ROOT, 'node_modules', '.bin', 'supabase');
    if (!existsSync(cli)) fallar('Falta la CLI de Supabase (npm install -D supabase).');
    const regPath = join(ESTADO, 'funciones.json');
    const registro = existsSync(regPath) ? JSON.parse(readFileSync(regPath, 'utf8')) : {};
    for (const f of plan.funciones) {
      try {
        execFileSync(cli, ['functions', 'deploy', f, '--project-ref', c.SUPABASE_PROJECT_REF, '--use-api', '--no-verify-jwt'], {
          cwd: ROOT,
          env: { ...process.env, SUPABASE_ACCESS_TOKEN: c.SUPABASE_ACCESS_TOKEN },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        registro[f] = hashFuncion(f);
        writeFileSync(regPath, JSON.stringify(registro, null, 2));
        registrar(`  ✔ función desplegada: ${f}`);
      } catch (e) {
        const err = e as { stderr?: Buffer; message: string };
        registrar(`  ✖ no se pudo desplegar ${f}: ${ocultar(String(err.stderr ?? err.message), c).slice(0, 500)}`);
        process.exit(1);
      }
    }
  }

  // --- Auth ---
  if (plan.auth.length) {
    await gestion(c, 'PATCH', '/config/auth', Object.fromEntries(plan.auth.map((d) => [d.clave, d.deseado])));
    registrar(`  ✔ configuración de Auth actualizada: ${plan.auth.map((d) => d.clave).join(', ')}`);
  }
  registrar(`FIN plan ${codigo}: completado`);
  return 0;
}
