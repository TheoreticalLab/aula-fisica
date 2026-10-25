# Aula Virtual de Física Básica — instrucciones para Claude Code

Aplicación React + TypeScript + Vite (GitHub Pages) con backend en Supabase (Postgres con RLS, funciones SQL
SECURITY DEFINER y Edge Functions). El administrador (el profesor) da instrucciones en español; responde en español.
Arquitectura: `ARQUITECTURA.md`. Procedimiento operativo para personas: `FLUJO_DE_TRABAJO.md`. Estado por etapas: `ETAPAS.md`.

## Reglas que no se rompen

1. **Producción solo con autorización explícita.** Nunca ejecutes `npm run aplicar`, `git push`, ni nada que escriba en
   Supabase o GitHub sin que el administrador apruebe *en este momento* el código de plan concreto (p. ej. «autorizo a1b2c3d4»).
   Una aprobación anterior no vale para un plan nuevo. Las consultas de solo lectura (`npm run estado`, `npm run plan`,
   `npm run respaldo`) no necesitan autorización.
2. **Los datos de estudiantes son intocables.** Perfiles, matrículas, intentos, respuestas, calificaciones y registros
   (`TABLAS_PROTEGIDAS` en `scripts/ops/comun.ts`) nunca pierden filas. Las migraciones son **aditivas**: `add column if not exists`,
   tablas nuevas, `create or replace function`, políticas nuevas. Prohibido `drop table`, `drop column`, `truncate`,
   `delete` sin `where`, cambios de tipo o renombres. Si algo así fuera imprescindible: explícalo, propón la alternativa
   aditiva, y solo con aprobación expresa marca la línea anterior con `-- @destructivo-autorizado: motivo`.
3. **Secretos fuera del repositorio.** Las credenciales están en `privado/credenciales.env` (excluido de git). No las leas
   en voz alta, no las imprimas, no las copies a otros archivos ni las pases por la línea de comandos. El frontend solo
   puede contener la URL y la clave publicable. `service_role`, tokens `sbp_…` y contraseñas viven solo en el servidor.
4. **Las claves de respuesta del contenido** están en `privado/claves/` y la tabla `exercise_keys`; jamás en `contenido/`,
   `src/` ni en `dist/`.
5. **Nunca edites una migración ya aplicada** (las que `npm run estado` marca como aplicadas). Crea una nueva.
6. **No presentes como terminado lo que no lo está.** Actualiza `ETAPAS.md` y la página «Acerca» (`src/pages/publico/Acerca.tsx`).

## Entorno de este equipo

- Un hook bloquea `npx`, `npm install`, `curl` y algunos scripts en línea: usa `./node_modules/.bin/<herramienta>` y escribe
  los scripts con la herramienta Write. Si hace falta instalar algo, pídeselo al usuario (`! comando` o terminal propia).
- Node 18. PostgreSQL local para pruebas (`LOCAL_DB_URL`, base desechable `aula_prueba`).

## Procedimiento para cualquier cambio

1. **Entender el estado:** `npm run estado` (código, migraciones aplicadas, funciones desplegadas, Auth, filas de datos).
2. **Implementar en local**:
   - Interfaz: `src/` (páginas en `src/pages`, acceso a datos en `src/api`).
   - Base de datos: **nueva** migración `supabase/migrations/AAAAMMDDHHMMSS_descripcion.sql` (marca de tiempo mayor que la última),
     con RLS en toda tabla nueva y `security definer set search_path = ''` en toda función que lo necesite; `revoke`/`grant`
     explícitos al final (anon nunca recibe permisos; las funciones `svc_*` solo `service_role`).
   - Pruebas SQL de lo nuevo en `supabase/pruebas/*.sql` (transacción con `rollback`, terminan con
     `select '…PASARON' as resultado`), y pruebas Vitest en `tests/`.
   - Edge Functions: `supabase/functions/<nombre>/handler.ts` (lógica pura con pruebas) + `index.ts` (Deno).
3. **Verificar**: `npm run verificar` (tipos, Vitest, compilación, secretos en dist/, revisión de migraciones).
4. **Probar la base de datos**: `npm run respaldo` (si hay credenciales) y `npm run probar` — aplica las migraciones sobre una
   copia local de los datos de producción, comprueba que no se pierden filas y ejecuta las pruebas de seguridad.
5. **Plan**: `npm run plan` → muestra migraciones, funciones y cambios de Auth pendientes, y un código de plan.
6. **Pedir autorización**: resume en lenguaje claro qué cambia, qué riesgos hay y que existe respaldo; pregunta con
   AskUserQuestion «¿Autoriza aplicar el plan XXXX en producción?». Sin un «sí» explícito, detente.
7. **Aplicar** (solo tras el «sí»): `npm run aplicar -- --plan XXXX`. Hace respaldo verificado, aplica cada migración en
   su transacción, comprueba los datos protegidos, despliega funciones y ajusta Auth. Muestra el resultado.
8. **Publicar el frontend** (si cambió `src/`): con autorización, `git add`, `git commit` y `git push` a `main`.
   GitHub Actions prueba, compila, verifica secretos y publica en Pages.

## Recetas frecuentes

- **«Agrega una nueva asignatura»**: es un dato, no un cambio de esquema. Lo normal es crearla desde el panel
  (Asignaturas y contenido → Crear). Si el administrador quiere que la cree Claude: migración de datos idempotente
  (`insert … on conflict do nothing`) con la asignatura, sus bloques y, si hay, lecciones; o contenido en `contenido/` +
  `npm run semilla` siguiendo `contenido/GUIA_REDACCION.md`. Después: verificar, probar, plan, autorización, aplicar.
- **Nueva sección/clase, matrículas, cuentas**: se hacen desde el panel (Panel docente, Cuentas). No requieren código.
- **Nuevo campo en una tabla**: migración con `add column if not exists … default …`; actualizar `src/api/tipos.ts`.
- **Cambio de una función SQL existente**: copia su definición vigente (de la última migración que la redefine),
  modifícala en una migración nueva con `create or replace` y conserva los `grant`.
- **Restaurar datos**: los respaldos están en `privado/respaldos/<fecha>/` (JSON por tabla). Restaurar en producción es una
  operación delicada: prepara el SQL, pruébalo con `npm run probar` y pide autorización expresa.
