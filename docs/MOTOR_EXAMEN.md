# Motor de examen (rediseño · etapa 2)

Evaluaciones de **una pregunta a la vez**, con reloj oficial del servidor, tiempo observable por pregunta, pausas
declaradas, guardado automático confiable y recuperación tras desconexiones. Separado de la calificación (no la toca)
y de LIEIA (LIEIA solo lee los intervalos).

| Pieza | Archivo |
|---|---|
| Máquina de estados (una pregunta activa, navegación, pausas, visibilidad, inactividad, cierre y regreso) | `src/lib/examen/motor.ts` |
| Reloj oficial (desfase con el servidor, hora límite) | `src/lib/examen/reloj.ts` |
| Guardado automático con revisiones y copia en el dispositivo | `src/lib/examen/guardado.ts` |
| Tiempo por pregunta y por categoría; conciliación con el servidor | `src/lib/examen/intervalos.ts` |
| Base de datos (tablas, funciones, reglas) | `supabase/migrations/20261030000035_motor_examen.sql` |
| Interfaz del estudiante | `src/pages/estudiante/ExamenUnaALaVez.tsx` (desde `Intento.tsx`) |
| Configuración del profesor | `src/pages/docente/ModoExamen.tsx` (Actividad → Configuración → «Modo de examen») |
| Pruebas | `tests/examen-motor.test.ts`, `supabase/pruebas/motor_examen.sql` |

## Para el profesor

En una **evaluación**, pestaña Configuración → **Modo de examen**:
- **Presentación:** «Una pregunta a la vez» (nuevo) o «Todas en una página» (clásico, como hasta ahora). Las evaluaciones que no se configuren siguen siendo clásicas.
- **Navegación:** libre (ir y volver, marcar para revisar) o **solo hacia adelante**: una pregunta ya vista no se reabre ni se modifica. El servidor lo impone; no basta con ocultar el botón.
- **Duración** del intento en minutos (opcional). Cuenta desde que el estudiante empieza y nunca pasa del cierre de la actividad.
- **Pausas declaradas** (opcional): número máximo y minutos en total. Durante la pausa **se ocultan las preguntas** y no se puede guardar ni navegar. Si se marca «la pausa detiene el reloj», el límite se desplaza por la pausa usada (hasta el máximo).
- Los intentos ya empezados conservan la configuración con la que empezaron.

## Para el estudiante

Una pregunta en pantalla. Arriba: respondidas, cuenta atrás oficial, estado del guardado («Guardado ✓», «Guardando…», «Sin conexión: guardado en este dispositivo») y «Pausar» si está permitido. Debajo: los números de las preguntas (verde = respondida, 🚩 = marcada). Abajo: «Anterior», «Marcar», «Siguiente» y, al final, «Revisar y entregar». Al llegar a cero, se entrega sola lo guardado.

## Medición del tiempo

Cada instante del intento pertenece a un solo tramo:

| Tramo | Significado |
|---|---|
| trabajo | pregunta activa, visible, con interacción (o pensando, sin pasar el umbral de inactividad) |
| inactividad | pregunta visible sin interacción durante más de 60 s |
| pausa_declarada | el estudiante pulsó «Pausar» |
| oculta | la página dejó de estar visible (otra pestaña o aplicación, pantalla apagada) |
| desconexion | la aplicación no estaba abierta (se sabe al volver; se corta en el último latido) |
| desconocido | tramo sin información fiable (hasta 5 s entre el último latido y el cierre), o que contradice al servidor |
| fuera_de_pregunta | pantalla de revisión: ninguna pregunta activa |

- Los tiempos están en **hora del servidor** (reloj local monotónico + desfase estimado con la menor ida y vuelta). Cambiar el reloj del dispositivo no da ni quita tiempo.
- La pérdida de **red** no cambia el tipo: la aplicación sigue observando y guardando en el dispositivo; el tramo se marca `sin_red`.
- El **servidor** registra sus propios eventos (apertura, cambio de pregunta, pausa, reanudación, entrega). El diario del navegador se valida al recibirlo (orden, sin solapes, dentro de la sesión, preguntas del intento) y se **concilia** con esos eventos: lo que los contradice pasa a «desconocido» (`conciliar()`).
- El tiempo observable de una pregunta es la suma de sus tramos de trabajo, aunque se haya vuelto a ella varias veces o haya habido pausas en medio. LIEIA lo reconstruye con `intervalosDePregunta()` → `reconstruirTiempo()`.

## Guardado automático confiable

- Cada cambio se escribe primero en el dispositivo y luego se envía con una **revisión** creciente. El servidor (`exam_save`) solo aplica una revisión mayor que la guardada, así que los reintentos y los envíos fuera de orden no pisan una respuesta más nueva.
- Sin red: queda en el dispositivo, se reintenta con espera creciente (1 s → 30 s) y al volver la conexión se envía sola. Si se cierra la pestaña o se recarga, al reabrir se recupera y se avisa.
- Rechazos definitivos (tiempo vencido, intento entregado, pregunta anterior en «solo adelante») no se reintentan y se informan.
- La vía antigua (`save_response`) respeta las mismas reglas: límite de tiempo, pausa y navegación.

## Garantías y límites

- Lo que impone el **servidor**: límite de tiempo (con 30 s de gracia por la red), pausas (permiso, número, total), navegación «solo adelante», una sola sesión por intento, idempotencia del diario y del guardado.
- Lo que depende del **navegador** (y por eso se concilia): la clasificación fina en trabajo, oculta e inactividad. Un navegador manipulado puede mentir sobre la visibilidad; no puede trabajar durante una pausa oficial ni fuera de la sesión sin que se marque como «desconocido».
- Sin probar todavía en teléfonos reales: en el móvil, apagar la pantalla cuenta como «oculta».

## Despliegue y reversión (no aplicado; requiere autorización)

**Qué cambia en producción:** 4 tablas nuevas (`exam_settings`, `exam_sessions`, `exam_events`, `exam_intervals`), una columna nueva con valor por defecto (`responses.client_rev`), funciones nuevas `exam_*`, un disparador al entregar, y dos funciones redefinidas (`assert_attempt_writable`, `save_response_for`). Estas dos solo añaden reglas cuando el intento tiene sesión de examen; sin sesión se comportan igual que antes. No se borra ni se modifica ningún dato.

**Procedimiento:** `npm run respaldo` → `npm run probar` (incluye `supabase/pruebas/motor_examen.sql`) → `npm run plan` → autorización → `npm run aplicar -- --plan CÓDIGO` → commit y `git push` para publicar la interfaz.

**Reversión** (por niveles, de menor a mayor):
1. **Apagar el modo** en una actividad: Configuración → Modo de examen → «Todas en una página». O para todas a la vez:
   `update public.exam_settings set presentacion = 'todas';`
   Los intentos nuevos vuelven a la interfaz clásica. Los que ya tienen sesión conservan sus reglas hasta entregarse.
2. **Quitar las reglas del servidor** sin borrar datos: una migración nueva que restaure las definiciones anteriores de `assert_attempt_writable` (migración 4) y `save_response_for` (migración 3), y deje sin uso las funciones `exam_*`:
   `revoke execute on function public.exam_open(uuid), public.exam_goto(uuid, uuid), public.exam_pause(uuid), public.exam_resume(uuid), public.exam_save(uuid, uuid, jsonb, bigint), public.exam_journal(uuid, jsonb), public.exam_ping(uuid) from authenticated;`
   La interfaz cae a la vista clásica (`exam_open` no responde y la página muestra el error con «Reintentar»). Para eso también hay que publicar un frontend sin el modo.
3. Las tablas nuevas **no se borran** (contienen datos de los estudiantes; regla 2 del proyecto). Quedan sin uso.
