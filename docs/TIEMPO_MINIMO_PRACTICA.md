# Tiempo mínimo de realización en prácticas

**Estado:** programado y probado en local (migración `20261104000078_tiempo_minimo_practica.sql`, Edge Function
`calificar` actualizada). Sin aplicar en producción. Desactivado en todas las prácticas.

## Qué hace

En una práctica ordinaria (no secuencial: el estudiante ve todos los ejercicios y los resuelve en el orden que quiera)
el profesor puede exigir un **tiempo mínimo de trabajo activo** antes de entregar.
Se configura en Panel docente → sección → la práctica → Configuración → «Tiempo mínimo de realización».

| Regla | Detalle |
|---|---|
| Qué cuenta | Solo el tiempo **activo**: la práctica en pantalla y alguna interacción (tocar, escribir, desplazarse) en los últimos 2 min. |
| Quién lo cuenta | El servidor, con latidos cada 10 s (como la lectura cronometrada). Solo suma el tiempo real entre latidos si el anterior fue hace ≤ 25 s y activo. Si el estudiante se va, cambia de pestaña o deja la página quieta, el reloj se detiene. Dos pestañas no duplican el tiempo. |
| Antes de cumplirlo | El estudiante **no puede entregar**. El botón muestra cuánto falta, y la Edge Function rechaza la entrega aunque se llame directamente. |
| Si la deja sin entregar | Al cierre se entrega lo guardado («Entregar y calificar» del editor de la actividad u Orbe Control), con la nota multiplicada por **tiempo activo ÷ mínimo**. Por ejemplo, 20 de 60 min da un tercio de la nota. Si el estudiante entrega él mismo después del cierre, se aplica la misma reducción. Una práctica abandonada sin ningún tiempo activo vale 0. |
| A quién afecta | Solo a intentos **empezados después de activarlo**. Sirve, por tanto, para prácticas ya publicadas que aún no se han intentado. Los intentos anteriores quedan exentos y las demás prácticas no cambian. |
| Cambios | Cambiar los minutos no altera a quien ya empezó: conserva el mínimo con el que empezó. Desactivarlo recalcula y devuelve las notas completas. Copiar la práctica a otra sección copia el mínimo. |
| Exámenes | No aplica: es solo para prácticas. |

**No hay entrega automática a la hora de cierre.** El aula no tiene tareas programadas. Los intentos abiertos se
entregan, como hasta ahora, con «Entregar y calificar» u Orbe Control; la reducción se aplica sola.

**Límites honestos:** es un indicador de trabajo, no una prueba de esfuerzo ni de autoría. Alguien puede tener la
práctica abierta e interactuar de vez en cuando sin trabajar, y no impide el uso de IA. Lo que sí impide es
«termino en 5 minutos, entrego y me voy», y abandonarla no evita la regla.

## Piezas

- Tablas `activity_min_time` (configuración por práctica) y `attempt_active_time` (contador por intento). Sin acceso por REST.
- `practica_latido`, `practica_tiempo_estado`, `practica_tiempo_config`, `practica_tiempo_guardar`, `practica_tiempo_intentos` y
  `svc_tiempo_minimo_verificar` (solo `service_role`).
- `recompute_attempt` (copia de la migración 59) añade al final la reducción. `actividad_copiar` (copia de la 73) copia el mínimo.
- Estudiante: `src/components/TiempoActivo.tsx` (latidos y barra), en `Intento.tsx` (también en la práctica asistida) y aviso en `Actividad.tsx`.
- Profesor: `src/pages/docente/ConfigTiempoMinimo.tsx` (activar, minutos y tiempo activo por intento).

## Pruebas

- `supabase/pruebas/tiempo_minimo.sql`: permisos; latidos (suma real, sin duplicar con dos pestañas, sin contar ausencias ni
  inactividad, no cuenta tras el cierre); exención de intentos anteriores; bloqueo de la entrega y permiso tras el cierre;
  examen sin mínimo; reducción de la nota (cumplida, exenta, sin mínimo, ⅓, 0 sin tiempo); lista del profesor; desactivar
  devuelve la nota; la copia lleva el mínimo. Mutaciones: 14 de 15 detectadas. La restante («reduce también la cumplida») es
  equivalente: con el mínimo cumplido el factor ya vale 1.
- `tests/tiempo-minimo.test.ts`: lógica del cliente y bloqueo en `calificar`. La entrega del profesor no se bloquea, y con la
  migración pendiente no se bloquea; ante un fallo desconocido no se entrega.
