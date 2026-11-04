# Suspensión automática por inactividad

**Estado:** programado y probado en local (migración `20261104000079_suspension_inactividad.sql` y la configuración
pública de `recuperar`). Sin aplicar en producción. Desactivado por defecto.

## Reglas

| Regla | Detalle |
|---|---|
| A quién | Solo a **estudiantes**. Profesores y administradores, nunca. |
| Plazo | **10 días** sin uso, configurable entre 3 y 365. Se cuenta desde lo más reciente de tres fechas: el último uso, la creación de la cuenta o la activación de la regla. |
| Qué es «uso» | Tener el aula abierta con la sesión iniciada. Lo registra el latido de conexión que el aula ya envía (también desde versiones anteriores del aula en caché), como mucho una escritura cada 5 minutos por cuenta. **Iniciar sesión no cuenta**: quien vuelve tras 10 días queda suspendido al entrar. |
| Efecto | Vencido el plazo, la cuenta deja de estar habilitada en el servidor: es la misma condición que el bloqueo de la regularización, añadida a `account_ok`. Al volver, el aula marca la suspensión (`profiles.active = false`, con su registro en `cuenta_suspensiones`) y le muestra «Cuenta suspendida por inactividad» con el botón «Recuperar acceso». El administrador también puede marcar de una vez todas las vencidas. |
| Reactivar | **El profesor**: Cuentas → Inactividad → «Reactivar seleccionadas» (administrador o profesor de su sección), o «Reactivar» en Cuentas. **El estudiante**: «Recuperar acceso», con verificación en persona por el profesor o un monitor designado, si la recuperación está activada en su sección. Toda reactivación reinicia el contador. Las cuentas suspendidas por el administrador no se reactivan por esta vía. |
| Activación | Cuentas → Inactividad (solo el administrador). Al activarla, o al reanudarla tras una pausa (por ejemplo, después de unas vacaciones), **todos tienen 10 días desde ese momento**. |

Sin tareas programadas: la suspensión no ocurre a una hora fija. La cuenta deja de estar habilitada en cuanto vence
el plazo, y queda *marcada* como suspendida cuando el estudiante vuelve o cuando el administrador pulsa
«Marcar ya las vencidas». El efecto para el estudiante es el mismo.

## Avisos

- Un puente o unas vacaciones de 10 días suspenderían a muchos estudiantes. Conviene pausar la regla durante los
  periodos sin clases y reanudarla al volver.
- Con la regla activa, la pantalla de ingreso avisa del plazo y enlaza «Recuperar acceso».
- El inicio de sesión de una cuenta ya marcada como suspendida responde lo mismo que una contraseña incorrecta
  (es la regla anti-enumeración de siempre). Por eso el aviso de la pantalla de ingreso remite a «Recuperar acceso».

## Pruebas

- `supabase/pruebas/suspension_inactividad.sql`:
  - apagada por defecto; solo el administrador configura;
  - gracia de 10 días desde la activación;
  - plazo vencido, cuenta que nunca se usó, profesor exento y exención fuera de REST;
  - el latido de un bloqueado no registra uso;
  - la presencia marca la suspensión y explica el motivo;
  - lista y «marcar ya»;
  - reactivación por el profesor sin tocar las suspensiones del administrador;
  - recuperación presencial que reactiva (las cuentas suspendidas por el administrador no son elegibles);
  - «Reactivar» de Cuentas reinicia el contador;
  - pausar y reanudar da días nuevos.
  - Mutaciones: 14 de 14 detectadas (`privado/tmp/mutar-inactividad.mjs`). Las pruebas encontraron un error real,
    ya corregido: «reactivar» tocaba el contador de cuentas suspendidas por el administrador.
- Regresión: todas las pruebas SQL (incluida la recuperación de la migración 77, cuyas funciones se ampliaron),
  Vitest y `npm run probar` sobre la copia del respaldo.
