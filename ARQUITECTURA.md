# Arquitectura del Aula Virtual de Física Básica

Este documento explica cómo está construido el programa: qué piezas tiene, qué hace cada una, por qué se eligió Supabase y qué pasaría si se cambiara. Está pensado para decidir con conocimiento de causa, no para programar.

---

## 1. La idea en una frase

El aula tiene dos mitades:

- **El frontend** es la página web que se ve en el teléfono. Es «tonta» en el sentido de que no guarda nada ni conoce las respuestas correctas.
- **El backend** es un servidor que guarda los datos, decide quién puede ver qué y califica las respuestas sin enseñárselas a nadie.

```
 ┌──────────────────────────┐          Internet           ┌──────────────────────────────────────┐
 │  NAVEGADOR DEL ESTUDIANTE│  ───── pide / envía ─────▶   │              SUPABASE                │
 │  (teléfono o computadora)│                              │                                      │
 │                          │  ◀──── responde ──────────   │  ┌────────────┐  ┌────────────────┐  │
 │  Página web (frontend)   │                              │  │ Autenticac.│  │ Base de datos  │  │
 │  React + simuladores     │                              │  │ (cuentas)  │  │ Postgres + RLS │  │
 └──────────────────────────┘                              │  └────────────┘  └────────────────┘  │
            ▲                                              │  ┌────────────────────────────────┐  │
            │ descarga la página una vez                   │  │ Función «calificar» (servidor) │  │
 ┌──────────────────────────┐                              │  │ compara la respuesta con la    │  │
 │  GITHUB PAGES            │                              │  │ clave, que nunca sale de aquí  │  │
 │  (solo archivos fijos:   │                              │  └────────────────────────────────┘  │
 │  HTML, JS, CSS)          │                              └──────────────────────────────────────┘
 └──────────────────────────┘
```

**Analogía:** GitHub Pages es la imprenta que reparte el cuaderno en blanco a cada estudiante. Supabase es la oficina del profesor: ahí está el archivo de notas y ahí están guardadas bajo llave las soluciones. El cuaderno puede pedirle a la oficina «¿está bien mi respuesta?», pero nunca puede abrir el cajón de las soluciones.

---

## 2. Las piezas, una por una

### 2.1 Frontend: la página web

| Tecnología | Para qué sirve |
|---|---|
| **React** | Construye la interfaz por componentes: una tarjeta de ejercicio, un simulador, el temario… |
| **TypeScript** | JavaScript con tipos. El compilador detecta errores antes de publicar; por eso «compila sin errores» es una garantía útil |
| **Vite** | Empaqueta todo en unos pocos archivos que el navegador descarga rápido |
| **Tailwind CSS** | El diseño visual: colores institucionales, modo oscuro, adaptación al móvil |
| **KaTeX** | Dibuja las fórmulas escritas en LaTeX (`$v = \Delta x/\Delta t$`) |
| **Recharts** | Las gráficas de los enunciados y las gráficas en tiempo real de los simuladores |
| **SVG** | Los dibujos animados de los simuladores (bloque, proyectil, vectores…) |

Qué hace el frontend:
- Muestra lecciones, simuladores y ejercicios.
- Recoge lo que escribe el estudiante.
- Se lo manda al servidor.
- Muestra lo que el servidor le contesta.

Qué no hace nunca:
- Calificar.
- Conocer las claves.
- Decidir permisos. Aunque alguien manipulara la página en su teléfono, no ganaría nada, porque las decisiones se toman en el servidor.

**Los simuladores** sí funcionan enteramente en el navegador. Son modelos físicos analíticos (`src/fisica/modelos.ts`) sin datos secretos, así que no necesitan servidor.

### 2.2 GitHub Pages: dónde vive la página

GitHub Pages es un alojamiento gratuito de **archivos fijos**. No ejecuta programas ni guarda datos: solo entrega los archivos HTML, JS y CSS cuando alguien abre el enlace.

Cada vez que se sube un cambio a GitHub, un proceso automático (`.github/workflows/pages.yml`):
1. ejecuta las pruebas;
2. compila la página;
3. verifica que no contenga claves;
4. la publica.

Se puede sustituir por Netlify, Vercel, Cloudflare Pages o un servidor de la universidad sin tocar el código.

### 2.3 Backend: Supabase

Supabase es un servicio que junta en un solo lugar tres cosas que, de otro modo, habría que montar y mantener por separado:

| Componente | Qué hace en el aula |
|---|---|
| **Autenticación** | Registro, inicio de sesión, recuperación de contraseña por correo. Entrega a cada usuario un «pase» firmado digitalmente (JWT) que identifica quién es |
| **Base de datos Postgres** | Guarda todo: cursos, lecciones, ejercicios, claves, clases, matrículas, intentos, respuestas y calificaciones |
| **Edge Functions** | Pequeños programas que corren en el servidor. El aula tiene uno: **`calificar`** |

#### ¿Qué es «Row Level Security» (RLS)?

Es la pieza central de la seguridad. En una base de datos normal, quien tiene acceso a una tabla la ve entera. Con RLS, **cada fila** lleva una regla que la base de datos comprueba en cada consulta. Ejemplos reales del aula:

- Tabla `exercise_keys` (soluciones): *solo el profesorado del curso puede leer una fila.* No hay ninguna regla que permita leerla a un estudiante, así que para él la tabla está vacía.
- Tabla `profiles` (datos personales): *cada uno ve su perfil; un profesor ve el de sus estudiantes; nadie ve el de otros estudiantes.*
- Tabla `lessons`: *un estudiante solo ve las lecciones no ocultas de los cursos en los que está matriculado.*

Estas reglas están escritas en `supabase/migrations/20261025000002_seguridad.sql`. Las hace cumplir el propio Postgres, no la página web.

#### ¿Qué son las funciones SQL «SECURITY DEFINER»?

Algunas operaciones necesitan más lógica que «ver o no ver una fila». Por ejemplo, «empezar un intento solo si la actividad está abierta y quedan intentos». Para eso hay funciones dentro de la base de datos (`20261025000003_funciones.sql`) que la página llama por su nombre (`start_activity_attempt`, `get_attempt`, `save_response`…). Cada función comprueba quién la llama y si tiene derecho a hacerlo.

Ejemplo clave: `get_attempt` le devuelve al estudiante su intento, pero **oculta** si cada respuesta es correcta hasta que la configuración de la actividad lo permite («al entregar», «después del cierre» o «nunca»).

---

## 3. Recorrido completo: un estudiante responde un ejercicio

Ejercicio: «¿Qué velocidad tiene el tren?». El estudiante escribe `72 km/h` y la clave guardada es `20 m/s`.

```
 Estudiante              Página web                Función «calificar»            Base de datos
     │  escribe 72 km/h     │                             │                             │
     │─────────────────────▶│  (se guarda solo como       │                             │
     │                      │   borrador cada 1.2 s)      │                             │
     │  pulsa «Comprobar»   │                             │                             │
     │─────────────────────▶│  envía {intento, ejercicio, │                             │
     │                      │   "72 km/h"} + su pase JWT  │                             │
     │                      │────────────────────────────▶│  1. ¿El pase es válido?     │
     │                      │                             │  2. pide contexto ─────────▶│ ¿es su intento? ¿está
     │                      │                             │                             │ abierto? ¿quedan intentos?
     │                      │                             │◀──────────── clave «20 m/s» │ (solo a la función)
     │                      │                             │  3. califica:               │
     │                      │                             │     72 km/h = 20 m/s ✓      │
     │                      │                             │  4. registra ──────────────▶│ guarda respuesta, intento,
     │                      │                             │                             │ crédito y registro
     │                      │◀──── «Correcto» (+ solución │                             │
     │◀─────────────────────│      solo si corresponde)   │                             │
```

Puntos importantes:
- La clave `20 m/s` **viaja solo dentro del servidor**: de la base de datos a la función. Nunca llega al teléfono antes de tiempo.
- Si el estudiante escribe `20 m`, la función responde «su unidad corresponde a una longitud, pero se pide una velocidad». Si escribe `5.56 m/s`, responde «difiere en un factor 3.6: revise la conversión km/h–m/s».
- La función usa una llave maestra (`service_role`) que solo existe en el servidor de Supabase. Aun así, no decide permisos por su cuenta: llama a funciones SQL (`svc_*`) que hacen las comprobaciones.

En una **evaluación** el recorrido cambia:
1. Mientras el estudiante trabaja, sus respuestas solo se guardan como borradores.
2. Al pulsar «Entregar», la función califica todo de una vez.
3. El estudiante ve los resultados según la política de la actividad, y la nota cuando el profesor la publica.

---

## 4. Los datos: qué tablas hay

```
 CONTENIDO (lo edita el profesor)            DOCENCIA (clases y estudiantes)           RESULTADOS
 ───────────────────────────────            ─────────────────────────────            ──────────────
 courses        (curso: Física Básica)       classes        (Sección 11, 2026-2)       attempts   (intentos)
  └ units       (bloques I…VI)                └ class_groups  (grupos, con código)      └ responses (respuesta
     └ lessons  (teoría, fórmulas,            └ class_teachers (profesores)                  por ejercicio:
                 ejemplos, simulación)        └ enrollments   (matrículas)                   crédito, intentos,
        └ exercises (enunciados)              └ activities    (prácticas y evaluaciones)     pistas usadas…)
           └ exercise_keys  🔒 claves,          └ activity_items (ejercicios elegidos)        └ response_events
                            pistas,                                                          (registro de
                            explicaciones                                                    cada envío)
 concepts (conceptos para medir el dominio)
 profiles (nombre, correo, matrícula, rol)
```

Separaciones deliberadas:

- **Contenido vs. clases.** Un mismo curso lo pueden usar varias clases y varios profesores. Si editas una lección, cambia para todas las secciones.
- **Enunciado vs. clave.** Están en tablas distintas para que la regla de seguridad sea simple: la tabla de claves es invisible para estudiantes, sin excepciones.

---

## 5. Cómo se calcula el progreso

El progreso **no** cuenta páginas visitadas. Cada respuesta verificable aporta un valor de dominio a los conceptos de su ejercicio:

| Situación | Valor |
|---|---|
| Acierto al primer intento, sin pistas | 100 % |
| Acierto al primer intento, con pistas | 75 % |
| Acierto tras varios intentos | 50 % |
| Vio la solución o no acertó | 0 % |
| Evaluación | El crédito obtenido (solo cuando la actividad permite ver los resultados) |

Para cada concepto se promedian sus últimas 10 respuestas y se clasifica como *dominado* (≥ 80 %), *en progreso* (≥ 50 %) o *con dificultad*. Con menos de 2 respuestas, aparece como «pocos datos». Cuando el estudiante falla, el sistema le ofrece ejercicios de refuerzo que trabajan el mismo concepto.

---

## 6. Dónde está cada cosa en la carpeta

```
Aula_Fisica_Basica/
├── src/                     FRONTEND (lo que se publica)
│   ├── pages/estudiante/    pantallas del estudiante
│   ├── pages/docente/       panel del profesor
│   ├── sims/  fisica/       simuladores y sus modelos físicos
│   └── api/                 la única parte que «habla» con Supabase  ◀── lo que cambiaría si se cambia de backend
├── supabase/                BACKEND
│   ├── migrations/          tablas, reglas de seguridad y funciones SQL
│   ├── functions/calificar/ la función que califica
│   └── functions/_shared/calificacion/   motor de calificación (unidades, cifras…), reutilizable en cualquier backend
├── contenido/               lecciones de los bloques I–III (públicas)
├── privado/                 claves de respuesta y semilla SQL (NO se publican; haga copia de seguridad)
├── tests/                   408 pruebas automáticas
└── scripts/                 validación del contenido, generación de la semilla, verificación de la publicación
```

---

## 7. ¿Por qué Supabase?

Las razones:

1. **Cumple los requisitos de seguridad del encargo** sin escribir un servidor completo: autenticación real, reglas por fila hechas cumplir por la base de datos y una función en el servidor para calificar.
2. **Postgres es una base de datos de verdad**, estándar y libre. Los datos se pueden exportar o migrar a cualquier otro Postgres en cualquier momento; no quedan atrapados.
3. **Gratis a esta escala.** El plan gratuito admite decenas de miles de usuarios al mes y 500 MB de datos, de sobra para varios cursos.
4. **Sin servidor que mantener.** No hay que instalar actualizaciones ni vigilar una máquina.
5. **Se puede instalar en un servidor propio** (es software libre) si un día la universidad quiere tener los datos en casa, con el mismo código.

Sus desventajas, para decidir con honestidad:

- **Depende de una empresa externa.** Los datos personales de los estudiantes se guardan en sus servidores (en la región que elijas al crear el proyecto). Conviene confirmar si la UASD tiene normas sobre esto.
- **El plan gratuito pausa el proyecto tras 7 días sin actividad.** Se reactiva con un clic y no se pierde nada, pero hay que acordarse en vacaciones.
- **El plan gratuito no incluye copias de seguridad descargables automáticas.** Conviene exportar las calificaciones a CSV al final de cada periodo (el panel lo permite) o pasar al plan de pago (25 USD/mes).
- **La configuración inicial es técnica:** ejecutar el SQL y desplegar la función con la línea de comandos. Se hace una sola vez.

---

## 8. Si no se usa Supabase: qué cambia

Se reutilizan sin cambios:
- toda la interfaz;
- las 26 lecciones;
- los simuladores;
- el motor de calificación (`_shared/calificacion`), escrito para funcionar en cualquier sitio que ejecute JavaScript, incluido Google Apps Script.

Habría que rehacer:
- `src/api/` (cómo pide y guarda datos la página);
- las reglas de seguridad y las funciones de `supabase/migrations/`, traducidas al sistema elegido;
- el inicio de sesión.

| Alternativa | Cómo quedaría | Ventaja principal | Inconveniente principal | Trabajo estimado |
|---|---|---|---|---|
| **Google Apps Script + Hojas** | Las tablas pasan a ser hojas; las claves, una hoja privada; la calificación, Apps Script | Gratis, conocido, datos visibles en Hojas | Lento con muchos estudiantes a la vez (1–3 s por respuesta, límites de concurrencia); las reglas de seguridad hay que programarlas a mano | Alto |
| **Firebase** | Firestore + reglas de seguridad + Cloud Functions | Rápido y robusto | Calificar en el servidor exige plan con tarjeta (coste real casi nulo); otro modelo de datos | Alto |
| **PocketBase en un servidor propio** | Un programa con base de datos y reglas por colección | Datos en casa, sencillo | Alguien debe mantener el servidor y hacer copias | Medio |
| **Supabase en un servidor propio** | El mismo sistema, instalado en una máquina de la universidad | Cero cambios en el código | Lo más técnico de mantener (Docker) | Bajo en código, alto en operación |

**Sin backend no se puede:** si todo estuviera en la página, las respuestas correctas viajarían al teléfono de cada estudiante y no habría forma de guardar notas de manera fiable.

---

## 9. Cuentas gestionadas por el administrador: acceso con ID y contraseña (migración 4)

**Decisión:** no hay registro público ni correos personales. El administrador crea todas las cuentas y el estudiante entra con su **ID** y una **contraseña provisional** que debe cambiar la primera vez.

```
 Navegador                     Edge Function «acceder»                Base de datos             Supabase Auth
    │  ID + contraseña               │                                    │                          │
    │──────────────────────────────▶ │  svc_login_check(ID, huella IP) ──▶ │ ¿bloqueado? ¿existe?     │
    │                                │ ◀── correo técnico de la cuenta ─── │ (5 fallos/15 min por ID, │
    │                                │                                    │  30 por IP → bloqueo)    │
    │                                │  verificar contraseña ────────────────────────────────────────▶ │ (bcrypt)
    │                                │  svc_login_record(intento) ───────▶ │ registro sin contraseña  │
    │ ◀── sesión (o error genérico) ─│                                    │                          │
    │  si es provisional → pantalla «Elija su contraseña» → updateUser → confirm_password_changed()   │
```

**Piezas y decisiones:**

- **Supabase Auth sigue guardando las contraseñas** (bcrypt) y las sesiones.
  - Cada cuenta tiene un **correo técnico aleatorio** (`u3f9…@cuentas.aula-fisica.invalid`) que no se usa para nada, no revela el ID y el navegador nunca conoce.
  - El ID está en `profiles.login_id`.
- **La traducción del ID a la cuenta ocurre en el servidor**, en la función `acceder`.
  - La respuesta es **idéntica** para un ID inexistente, una cuenta suspendida o una contraseña incorrecta, con un tiempo mínimo de respuesta igual. Así no se puede averiguar qué IDs existen.
  - Los bloqueos por exceso de intentos también se aplican a los IDs inexistentes, por el mismo motivo.
- **El registro de intentos** está en `login_attempts`:
  - qué ID, si acertó y el motivo;
  - la IP solo como huella anónima (hash con un secreto del servidor);
  - nunca la contraseña;
  - se conserva 180 días.

  Solo el administrador lo ve, en «Accesos sospechosos».
- **La administración de cuentas** está en la función `admin-cuentas`, que solo puede usar un administrador:
  - crea cuentas una a una o por **CSV** (hasta 300), con matrícula opcional en secciones;
  - restablece contraseñas;
  - suspende y reactiva cuentas.

  Las contraseñas provisionales (12 caracteres aleatorios, unos 70 bits) se generan en el servidor y **se muestran una sola vez** para descargarlas o imprimirlas; no se guardan en ningún sitio.
- **Contraseña provisional obligatoria de cambiar**, comprobado en el servidor:
  - mientras no se cambie, la cuenta no ve clases ni contenido ni puede responder;
  - la base de datos verifica que el hash de la contraseña cambió realmente (`confirm_password_changed`).
- **Suspensión:**
  - la cuenta queda bloqueada en Auth (no puede entrar ni renovar la sesión);
  - además, todas las funciones de permisos la tratan como inexistente desde ese instante;
  - los datos se conservan.
- **Defensa en profundidad contra el registro público:**
  - se desactiva en Auth (`disable_signup`);
  - aunque alguien lo reactivara, una cuenta creada sin ID asignado por el servidor nace **inactiva** y sin permisos;
  - el rol, el ID y el nombre solo se toman de `app_metadata`, que solo puede escribir el servidor.
- **Auditoría:** `account_events` registra creación, restablecimiento, suspensión, matrícula y cambio de contraseña. Nunca contiene contraseñas.

**Límites conocidos (a comprobar en producción):**
- **Límite de inicios de sesión por IP.** Supabase Auth limita los inicios de sesión por IP. Como la función `acceder` verifica las contraseñas desde los servidores de Supabase, ese límite podría aplicarse al conjunto de accesos y no a cada estudiante.
  - Hay que comprobarlo en la primera prueba real, con un grupo entrando a la vez.
  - Si ocurre, se sube el límite en la configuración de Auth (`supabase/auth-deseado.json`).
- **Quien conozca el correo técnico de una cuenta** podría intentar contraseñas directamente contra Auth, saltándose los bloqueos por ID. Los correos son aleatorios y no se muestran a nadie salvo a los profesores en la base de datos, y las contraseñas provisionales son largas y aleatorias, así que el riesgo práctico es muy bajo.
  - La protección completa sería el «Password verification hook» de Supabase, que requiere un plan de pago.

## 10. Varias asignaturas y secciones (migración 5)

| Concepto | Tabla | Ya existía | Nuevo |
|---|---|---|---|
| Asignatura (Física Básica, Física General I, III…) | `courses` + su contenido | Crear, editar, equipo docente | **Archivar** |
| Sección o grupo de clase | `classes` (+ `class_groups` para subgrupos) | Crear, archivar, código de matrícula | **Matrícula por ID** (una o varias secciones), selector de sección en el panel |
| Matrícula | `enrollments` | Por código | Por ID (profesor) o al crear la cuenta (administrador, también por CSV) |
| Actividades | `activities` (de una sección; opcionalmente de un subgrupo) | Prácticas y evaluaciones por sección | **Copiar a otras secciones** de la misma asignatura: cada copia tiene sus propias notas |
| Calificaciones e historial | `attempts`, `responses` | Independientes por sección y actividad | El libro de notas incluye el ID |
| Panel docente | — | Lista de clases | **Resumen de todas las secciones** con estudiantes, actividades abiertas, revisión pendiente y media |

**Aislamiento:** un estudiante solo ve el contenido de las asignaturas en cuyas secciones está matriculado, y las actividades de **su** sección (y de su subgrupo). Las políticas RLS y las funciones del servidor lo aplican. `supabase/pruebas/cuentas_y_secciones.sql` lo comprueba.

---

## 11. Resumen para decidir

| Pregunta | Respuesta |
|---|---|
| ¿Qué ve el estudiante? | Un enlace web; entra con el ID y la contraseña provisional que le entrega el profesor, y la cambia al primer acceso |
| ¿Dónde están los datos? | En Supabase (Postgres), en la región elegida al crear el proyecto |
| ¿Puede un estudiante ver las soluciones? | No: están en una tabla sin acceso para estudiantes, y la calificación ocurre en el servidor |
| ¿Cuánto cuesta? | 0 USD con los planes gratuitos de GitHub Pages y Supabase |
| ¿Qué hay que mantener? | Nada de servidores; solo reactivar el proyecto si se pausa y exportar notas cada periodo |
| ¿Se puede cambiar después? | Sí: los datos son Postgres estándar y la interfaz, el contenido y el motor de calificación son independientes del backend |
