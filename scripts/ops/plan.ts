/**
 * npm run plan — SOLO LECTURA. Calcula qué cambiaría en producción y genera un código de plan.
 * Nada se aplica sin que el administrador autorice ese código exacto (npm run aplicar -- --plan CÓDIGO).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  asegurarDir,
  conectar,
  credenciales,
  ESTADO,
  funcionesLocales,
  gestion,
  hashFuncion,
  migracionesAplicadas,
  migracionesLocales,
  ocultar,
  ROOT,
  sha256,
  ultimoRespaldo,
  type Credenciales,
} from './comun';
import { revisarMigraciones } from './lint-migraciones';
import { diferenciasAuth } from './estado';

export interface Plan {
  codigo: string;
  creado: string;
  registrar: string[]; // migraciones ya presentes en producción (aplicadas a mano) que solo hay que anotar en el historial
  migraciones: string[]; // archivos a aplicar
  funciones: string[];
  auth: { clave: string; actual: unknown; deseado: unknown }[];
  avisos: string[];
  bloqueos: string[];
}

/** Huella de todo lo que se prueba en local: si cambia, hay que volver a ejecutar npm run probar. */
export function huellaPruebas(): string {
  const dirP = join(ROOT, 'supabase', 'pruebas');
  const pruebas = readdirSync(dirP).filter((f) => f.endsWith('.sql')).sort().map((f) => readFileSync(join(dirP, f), 'utf8'));
  return sha256(migracionesLocales().map((m) => m.hash).join() + pruebas.join('\n'));
}

export async function calcularPlan(c: Credenciales): Promise<Plan> {
  const plan: Plan = { codigo: '', creado: new Date().toISOString(), registrar: [], migraciones: [], funciones: [], auth: [], avisos: [], bloqueos: [] };
  const locales = migracionesLocales();
  if (c.SUPABASE_DB_URL) {
    const db = await conectar(c.SUPABASE_DB_URL, true);
    try {
      const aplicadas = await migracionesAplicadas(db);
      const manual = aplicadas.size === 0 && (await db.query(`select to_regclass('public.profiles') as t`)).rows[0].t;
      for (const m of locales) {
        if (aplicadas.has(m.version)) continue;
        if (manual && m.version <= '20261025000003') plan.registrar.push(m.archivo);
        else plan.migraciones.push(m.archivo);
      }
    } finally {
      await db.end();
    }
  } else {
    plan.bloqueos.push('Falta SUPABASE_DB_URL: no se puede saber qué migraciones tiene producción.');
  }

  if (c.SUPABASE_ACCESS_TOKEN) {
    try {
      const remotas = await gestion<{ slug: string }[]>(c, 'GET', '/functions');
      const registro = existsSync(join(ESTADO, 'funciones.json')) ? JSON.parse(readFileSync(join(ESTADO, 'funciones.json'), 'utf8')) : {};
      for (const f of funcionesLocales()) {
        if (!remotas.some((r) => r.slug === f) || registro[f] !== hashFuncion(f)) plan.funciones.push(f);
      }
      plan.auth = diferenciasAuth(await gestion<Record<string, unknown>>(c, 'GET', '/config/auth'));
    } catch (e) {
      plan.bloqueos.push('No se pudo consultar la API de gestión: ' + ocultar(String(e), c));
    }
  } else {
    plan.bloqueos.push('Falta SUPABASE_ACCESS_TOKEN: no se pueden comprobar Edge Functions ni Auth.');
  }

  // revisión de operaciones destructivas en lo pendiente
  const pendientes = new Set(locales.filter((m) => plan.migraciones.includes(m.archivo)).map((m) => m.version));
  for (const p of revisarMigraciones({ soloVersiones: pendientes })) {
    (p.nivel === 'error' ? plan.bloqueos : plan.avisos).push(`${p.archivo}:${p.linea} ${p.mensaje}`);
  }

  // pruebas locales al día
  const prueba = join(ESTADO, 'ultima-prueba.json');
  const ult = existsSync(prueba) ? JSON.parse(readFileSync(prueba, 'utf8')) : null;
  if (plan.migraciones.length && (!ult || !ult.ok || ult.huella !== huellaPruebas())) {
    plan.bloqueos.push('Las pruebas locales no están al día con estas migraciones: ejecute npm run probar.');
  }
  if (plan.migraciones.length) {
    const r = ultimoRespaldo();
    if (!r) plan.avisos.push('No hay respaldo previo: «aplicar» creará y verificará uno antes de tocar nada.');
  }

  plan.codigo = sha256(JSON.stringify([plan.registrar, plan.migraciones.map((f) => [f, locales.find((m) => m.archivo === f)?.hash]), plan.funciones.map((f) => [f, hashFuncion(f)]), plan.auth])).slice(0, 8);
  return plan;
}

function resumenSql(sql: string): string {
  const cuenta = (re: RegExp) => (sql.match(re) || []).length;
  const partes = [
    [cuenta(/create table/gi), 'tablas nuevas'],
    [cuenta(/alter table/gi), 'cambios de tabla'],
    [cuenta(/create (or replace )?function/gi), 'funciones'],
    [cuenta(/create policy/gi), 'políticas RLS'],
    [cuenta(/drop policy/gi), 'políticas reemplazadas'],
    [cuenta(/create (unique )?index/gi), 'índices'],
    [cuenta(/create trigger/gi), 'disparadores'],
  ].filter(([n]) => (n as number) > 0);
  return partes.map(([n, t]) => `${n} ${t}`).join(', ') || 'sin cambios de estructura';
}

export async function comandoPlan(): Promise<number> {
  {
    const c = credenciales();
    const plan = await calcularPlan(c);
    asegurarDir(ESTADO);
    writeFileSync(join(ESTADO, 'plan.json'), JSON.stringify(plan, null, 2));
    const locales = migracionesLocales();
    console.log('═══ PLAN DE CAMBIOS EN PRODUCCIÓN ═══\n');
    if (plan.registrar.length) {
      console.log('Anotar en el historial (ya existen en producción, NO se ejecutan otra vez):');
      plan.registrar.forEach((f) => console.log(`  • ${f}`));
    }
    console.log('Migraciones de base de datos que se APLICARÍAN:');
    if (!plan.migraciones.length) console.log('  (ninguna)');
    for (const f of plan.migraciones) console.log(`  • ${f} — ${resumenSql(locales.find((m) => m.archivo === f)!.sql)}`);
    console.log('Edge Functions que se desplegarían:');
    console.log(plan.funciones.length ? plan.funciones.map((f) => `  • ${f}`).join('\n') : '  (ninguna)');
    console.log('Cambios de configuración de Auth:');
    console.log(plan.auth.length ? plan.auth.map((d) => `  • ${d.clave}: ${JSON.stringify(d.actual)} → ${JSON.stringify(d.deseado)}`).join('\n') : '  (ninguno)');
    if (plan.avisos.length) console.log('\nAvisos:\n' + plan.avisos.map((a) => `  ⚠ ${a}`).join('\n'));
    if (plan.bloqueos.length) {
      console.log('\nBLOQUEOS (hay que resolverlos antes de aplicar):\n' + plan.bloqueos.map((b) => `  ✖ ${b}`).join('\n'));
      return 1;
    }
    const nada = !plan.registrar.length && !plan.migraciones.length && !plan.funciones.length && !plan.auth.length;
    console.log(nada ? '\n✔ Producción ya está al día.' : `\nCódigo del plan: ${plan.codigo}\nPara aplicarlo hace falta la autorización expresa del administrador:\n  npm run aplicar -- --plan ${plan.codigo}`);
    return 0;
  }
}
