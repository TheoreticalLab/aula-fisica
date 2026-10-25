# Aula Virtual de Física Básica

Plataforma web para cursos introductorios de física universitaria. Cada lección tiene cinco secciones: teoría, fórmulas, ejemplos resueltos, simulación y práctica. Los ejercicios se corrigen en el servidor, y el progreso por concepto se calcula con respuestas verificables. El panel docente gestiona clases, contenido, actividades y calificaciones.

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, KaTeX y Recharts. Publicable en GitHub Pages.
- **Backend:** Supabase.
  - Postgres con Row Level Security.
  - Funciones SQL `SECURITY DEFINER`.
  - Autenticación por correo y contraseña.
  - Edge Function `calificar`, que hace la calificación automática.

El estado de cada función (terminada o pendiente) está en [`ETAPAS.md`](ETAPAS.md) y, dentro de la aplicación, en «Acerca del aula».

---

## 1. Requisitos

- Node.js 20 o superior y npm.
- Una cuenta gratuita de [Supabase](https://supabase.com) con un proyecto creado.
- Para publicar: una cuenta de GitHub.

## 2. Instalación local

```bash
npm install
cp .env.example .env.local      # complete VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm test                        # pruebas: calificación, física, contenido, seguridad
npm run dev                     # http://localhost:5173
```

## 3. Preparar la base de datos (una sola vez)

En Supabase → **SQL Editor**, ejecute **en este orden** el contenido de:

1. `supabase/migrations/20261025000001_esquema.sql`
2. `supabase/migrations/20261025000002_seguridad.sql`
3. `supabase/migrations/20261025000003_funciones.sql`

Si usa la CLI, `npx supabase link --project-ref <ref>` seguido de `npx supabase db push` hace lo mismo.

**Comprobar la seguridad:** ejecute `supabase/pruebas/rls.sql` en el editor SQL. Crea usuarios y datos ficticios dentro de una transacción, verifica las políticas y lo deshace todo. Debe terminar con el aviso «TODAS LAS PRUEBAS DE SEGURIDAD PASARON».

### Autenticación

En Authentication → URL Configuration:

- Ponga en **Site URL** la dirección pública de la aplicación, por ejemplo `https://usuario.github.io/aula-fisica/`.
- Añada esa misma dirección y `http://localhost:5173/` a **Redirect URLs**.

## 4. Desplegar la Edge Function de calificación

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase functions deploy calificar
# opcional: restringir los orígenes permitidos (CORS)
npx supabase secrets set ALLOWED_ORIGINS=https://usuario.github.io
```

La función usa `SUPABASE_SERVICE_ROLE_KEY`. Supabase la proporciona automáticamente en el servidor: **nunca** la ponga en `.env.local` ni en el frontend.

## 5. Cargar el curso inicial (bloques I–III)

Las claves de respuesta, las pistas y las explicaciones del contenido inicial están en `privado/`. Esa carpeta está excluida de git para que las respuestas no lleguen a un repositorio público. **Haga una copia de seguridad de `privado/`**: es la única copia de las claves del contenido inicial.

```bash
npm run semilla          # valida el contenido y genera privado/semilla.sql
```

Ejecute `privado/semilla.sql` en el editor SQL. La semilla no sobrescribe lo que el profesor haya editado desde la aplicación. Para forzar la actualización desde los archivos, use `npm run semilla -- --actualizar`.

## 6. Primer administrador

No hay registro público: el administrador crea todas las cuentas. El primero se crea así:

1. En Supabase → **Authentication → Users → Add user → Create new user**:
   - escriba su correo y una contraseña robusta;
   - marque **Auto Confirm User**.
2. En el editor SQL, ejecute esto, eligiendo el ID con el que entrará:
   ```sql
   select public.bootstrap_admin('su.correo@universidad.edu', 'orbe');
   ```
   Esta función solo se puede ejecutar desde el editor SQL; la API no tiene permiso.
3. Entre en el aula con ese **ID** y su contraseña. En **Cuentas** podrá:
   - crear profesores y estudiantes, uno a uno o por CSV, con contraseñas provisionales que se muestran una sola vez;
   - restablecer contraseñas;
   - suspender cuentas;
   - ver los accesos sospechosos.

Para las actualizaciones posteriores, siga [`FLUJO_DE_TRABAJO.md`](FLUJO_DE_TRABAJO.md). Con ese flujo, los cambios se preparan y se prueban en local, y solo se aplican en Supabase con su autorización.

## 7. Publicar en GitHub Pages

1. Suba el repositorio a GitHub. `privado/` y `.env*` no se suben.
2. En Settings → Secrets and variables → Actions → **Variables**, cree `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. En Settings → Pages, elija «Source: GitHub Actions».
4. Cada `push` a `main` ejecuta `.github/workflows/pages.yml`. El flujo:
   - instala las dependencias;
   - pasa las pruebas;
   - compila con la ruta base correcta;
   - comprueba con `npm run verificar-publicacion` que `dist/` no contenga claves ni secretos;
   - publica.

La aplicación usa rutas con `#`, como `…/#/curso/…`. Así funciona en GitHub Pages sin configuración adicional.

---

## Uso

**Profesor:**

1. Crea una clase en el Panel docente y comparte el código de 8 caracteres. Opcionalmente crea grupos, cada uno con su propio código.
2. Edita bloques, lecciones y ejercicios desde «Contenido» y «Banco de ejercicios». Las fórmulas se escriben con LaTeX y hay vista previa.
3. Crea actividades. Hay dos modalidades:
   - **Práctica de aprendizaje:** varios intentos, pistas, retroalimentación inmediata y refuerzo.
   - **Evaluación calificable:** sin ayudas y con calificación al entregar. Tiene fechas de apertura y cierre, número de intentos y una política para mostrar las respuestas correctas.
4. Revisa las respuestas de desarrollo, publica las calificaciones, consulta las estadísticas por pregunta y por concepto, y exporta a CSV.

**Estudiante:**

1. Se registra y se une a la clase con el código.
2. Estudia las lecciones, experimenta en el laboratorio y resuelve las prácticas. Las respuestas a medias se guardan solas.
3. Consulta sus calificaciones y su progreso por concepto.

## Seguridad

- **RLS en todas las tablas.** El rol `anon` no tiene acceso a nada.
- **Claves protegidas.** Las claves de respuesta están en `exercise_keys`, que solo puede leer el profesorado del curso. Los estudiantes nunca las reciben: la comparación se hace en la Edge Function y la base de datos solo devuelve la solución cuando la política de la actividad lo permite.
- **Calificaciones protegidas.** Los estudiantes no leen directamente `attempts` ni `responses`, y nadie puede escribirlas con la clave pública. La calificación automática pasa por funciones `svc_*`, que solo ejecuta `service_role`, y la manual por `grade_response()`, que comprueba que quien califica es profesor de la clase.
- **Roles.** El rol no se toma de los datos de registro y solo lo cambia un administrador.
- **Datos personales.** El nombre, el correo y la matrícula de un estudiante solo los ven él mismo, sus profesores y los administradores.
- **Contenido del profesor.** El Markdown se muestra sin HTML crudo. Los vídeos solo se insertan desde YouTube o Vimeo, o como archivos https.
- **CSV.** La exportación neutraliza las fórmulas para evitar la inyección en hojas de cálculo.

## Pruebas

| Orden | Qué comprueba |
|---|---|
| `npm test` | Motor de calificación (números, unidades, cifras significativas, diagnósticos); modelos físicos frente a resultados analíticos (conservación de la energía, alcance, ángulo crítico…); contenido (estructura, LaTeX con KaTeX, claves autoconsistentes); Edge Function con base de datos simulada; controles estáticos de seguridad |
| `supabase/pruebas/rls.sql` | Políticas RLS y permisos de las funciones en la base de datos real |
| `npm run verificar-publicacion` | Que `dist/` no contenga claves ni secretos |
| `npm run dev -- --port 5199` y luego `python3 pruebas/capturas.py` | Capturas en Chrome sin pantalla (móvil, escritorio, modo oscuro) de las lecciones y los simuladores, usando la vista previa sin base de datos `pruebas/vista-previa/` (solo desarrollo; no se publica) |

## Estructura

```
contenido/                 lecciones públicas (teoría, fórmulas, ejemplos, enunciados) + guía de redacción
privado/claves/            claves, pistas y explicaciones (NO se sube a git)
scripts/                   carga, validación y semilla del contenido; verificación de dist/
src/api/                   acceso a Supabase (tablas y RPC)
src/fisica/                modelos físicos de los simuladores
src/sims/                  catálogo y simuladores (SVG + Recharts)
src/pages/                 páginas públicas, del estudiante y del docente
supabase/migrations/       esquema, seguridad y funciones SQL
supabase/functions/        Edge Function «calificar» y motor de calificación compartido
supabase/pruebas/          pruebas de seguridad SQL
tests/                     pruebas Vitest
```
