# Despliegue del rediseño (etapas 1–2 y siguientes) — guía paso a paso

Todo está en commits locales y verificado con `npm run verificar` (758 pruebas, compilación, secretos y migraciones).
Desde la sesión de Claude Code **no** se pueden leer las credenciales, conectar con PostgreSQL ni publicar en
GitHub, así que estos pasos los ejecuta el administrador en su terminal.

## Qué se despliega

| Pieza | Tipo | Riesgo |
|---|---|---|
| `20261030000035_motor_examen.sql` | migración aditiva: 4 tablas nuevas, `responses.client_rev` (con valor por defecto), funciones `exam_*`, disparador al entregar, y `assert_attempt_writable` y `save_response_for` redefinidas (solo añaden reglas cuando el intento tiene sesión de examen) | bajo: las evaluaciones sin configurar no cambian |
| `20261031000036_exportar_motor_examen.sql` | migración aditiva: Centro de Datos con 4 fuentes nuevas | muy bajo |
| `20261101000040_desactivar_asistida.sql` | función nueva `assisted_settings_disable` (solo si no hay pasos de estudiantes; borra solo la configuración de la actividad) | muy bajo |
| `20261101000039_exportar_asistida.sql` | migración aditiva: Centro de Datos con 4 fuentes más (prórrogas y práctica asistida); `export_fila` seudonimiza también `teacher_id` | muy bajo |
| `20261101000038_practica_asistida.sql` + función `calificar` | migración aditiva: tablas `assisted_settings`, `assisted_transfer`, `assisted_steps` y funciones `asistida_*`, `assisted_settings_*` y `svc_asistida_*`; la función `calificar` gana la acción `asistida` | bajo: no redefine funciones existentes; las prácticas tradicionales no cambian. Reversión: no crear prácticas asistidas (las tablas quedan sin uso) |
| `20261101000037_prorrogas_examen.sql` | migración aditiva: `exam_sessions.extra_s` (por defecto 0), registro `exam_extensions`, función `exam_extend`; `exam_deadline` y `exam_monitor` redefinidas (suman o muestran la prórroga) | muy bajo: sin prórrogas, el límite es idéntico |
| Función `calificar` | Edge Function: política de mayúsculas en unidades y categorías de error | bajo: afecta solo a respuestas nuevas; no recalifica nada |
| Frontend | asistente «+ Crear actividad», Practicar/Evaluaciones, motor de examen, seguimiento en vivo, D6 v1 marcado como obsoleto | bajo: si la migración 35 no está, la interfaz cae a la clásica |
| LIEIA D6 v2 | **no se despliega como indicador**: experimental, no conectado | ninguno |
| `20261101000041_banco_ejercicios.sql` | migración aditiva: tabla `exercise_bank_meta` (solo profesorado), `svc_respuesta_etapa` (solo service_role) y `banco_rendimiento` | muy bajo: no redefine nada |
| Función `calificar` (arrastre) | Edge Function: acepta en una etapa la respuesta coherente con la etapa anterior del mismo estudiante | muy bajo: solo actúa en claves con `arrastre` (las de la Unidad 9 nueva) |
| Datos privados `privado/datos/…_biblioteca-mecanica.sql` | Unidad 9 «Física de los choques» (15 lecciones, 135 ejercicios con claves y metadatos) en Física General I y IA; las unidades `cantidad-movimiento` y `colisiones` pasan a **archivado**; la nueva hereda el estado de la U9 anterior (en FIS-GEN-1 estaba publicada) | bajo: nada se borra; las actividades con ejercicios antiguos siguen funcionando. Reversión en `docs/UNIDAD9_CHOQUES.md` |

## Pasos

1. `npm run respaldo` — respaldo verificado en `privado/respaldos/<fecha>/`.
2. `npm run probar` — aplica las migraciones sobre una copia local con los datos de producción, comprueba que no se pierden filas y ejecuta todas las pruebas SQL. Deben aparecer, entre otras:
   - `motor_examen.sql: PRUEBAS PASARON`
   - `exportar_motor_examen.sql: PRUEBAS PASARON`
3. `npm run plan` — debe listar las migraciones 35 y 36 y la función `calificar`. Anote el código.
4. `npm run aplicar -- --plan CÓDIGO` — respaldo previo, cada migración en su transacción, comprobación de datos protegidos y despliegue de la función.
5. `git push origin main` — GitHub Actions prueba, compila, verifica secretos y publica en Pages. Hay 9 commits locales nuevos (de `e049f55` a `2ed204d`, y los que se añadan).

Si `probar` falla, pegue la salida a Claude: no se aplica nada hasta que pase.

**Unidad 9 (choques):** antes del paso 1, genere el archivo de datos de la biblioteca:
`./node_modules/.bin/vite-node scripts/generar-curso.ts privado/biblioteca/mecanica` (valida todo y escribe
`privado/datos/<marca>_biblioteca-mecanica.sql`). En `probar` debe aparecer `banco_ejercicios.sql: PRUEBAS PASARON`, y en
`plan`, la migración 41, la función `calificar` y ese archivo de datos. Después de aplicar, en el panel: Contenido →
Física General I → «Unidad 9. Física de los choques» (revise el estado) y Banco → filtros del banco pedagógico.

## Comprobación después de desplegar (10 minutos)

1. Docente → una sección de prueba → **+ Crear actividad** → «Quiz rápido» → elegir 3 preguntas → título → **Crear y publicar**.
2. Con una cuenta de estudiante de prueba: Evaluaciones → el quiz → leer «Antes de empezar» → **Comenzar**. Comprobar:
   - una pregunta en pantalla, la cuenta atrás y «Guardado ✓»;
   - Siguiente, Anterior y Marcar;
   - el modo avión: «Sin conexión», y al volver la red se guarda sola;
   - recargar la página: vuelve a la misma pregunta;
   - Revisar y entregar.
3. Docente → la actividad → **Resultados**: el panel «En vivo» mientras el estudiante responde. Después, en la revisión del intento, el «Tiempo por pregunta».
4. Opcional, prueba automática en Chrome con el servidor simulado: `npm install --no-save playwright-core`, compilar la copia de prueba (instrucciones al principio de `privado/tmp/e2e-examen.cjs`) y `node privado/tmp/e2e-examen.cjs`.

## Reversión

- **Motor de examen** (por niveles; detalle en `docs/MOTOR_EXAMEN.md`):
  1. Apagar el modo en las actividades: `update public.exam_settings set presentacion = 'todas';`
  2. Si hiciera falta, una migración que restaure `assert_attempt_writable` (migración 4) y `save_response_for` (migración 3).
  3. Las tablas nuevas **no** se borran: contienen datos de los estudiantes.
- **Centro de Datos (36):** sin efecto si no se usan las fuentes nuevas. Para retirarlas, una migración con la versión de la 34 de `export_fuente` y `export_begin`.
- **Función `calificar`:** volver a desplegar la versión anterior:
  `git checkout e049f55~1 -- supabase/functions/_shared/calificacion` → `npm run plan` → `npm run aplicar -- --plan CÓDIGO`. Luego `git checkout HEAD -- supabase/functions/_shared/calificacion`. Las respuestas calificadas mientras tanto conservan su calificación.
- **Frontend:** `git revert` de los commits de interfaz y `git push`. Pages publica la versión anterior.
