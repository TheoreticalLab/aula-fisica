# Estado del desarrollo por etapas

Leyenda: ✅ hecho y probado · 🟡 hecho, verificado solo parcialmente (ver nota) · ⬜ pendiente.

## Primera etapa

| Requisito | Estado | Nota |
|---|---|---|
| Aplicación navegable (React + TS + Vite + Tailwind), modo claro y oscuro, adaptada a móvil | ✅ | Barra de navegación inferior en el teléfono |
| Usuarios: registro, ingreso, recuperación de contraseña, roles estudiante, profesor y administrador | 🟡 | Requiere un proyecto Supabase real; no se pudo probar contra uno durante el desarrollo |
| Panel del profesor: clases, grupos, códigos, contenido, ejercicios, actividades, revisión, calificaciones, CSV | 🟡 | Ídem |
| Panel del estudiante: temario, lecciones, prácticas, actividades, calificaciones, progreso | 🟡 | Ídem |
| Actividades con lectura cronometrada (tiempo mínimo, pausa al salir de la plataforma, ejercicios bloqueados hasta completarla) | 🟡 | Migración `20261025000010_lectura_cronometrada.sql` + `supabase/pruebas/lectura.sql`; pendiente de aplicar en producción. Primera actividad: «Lectura: las leyes de Newton» (8 ejercicios) |
| Portada general «Aula Virtual de Física» (tres asignaturas) y panel de inicio del estudiante (mis cursos, continuar, próximas actividades, avisos, progreso) | ✅ | Avisos por sección: migración `20261025000009_avisos.sql` + `supabase/pruebas/avisos.sql`; «continuar» recuerda la última lección en el dispositivo; vista previa con datos de ejemplo en `pruebas/vista-previa/panel.html` |
| Bloques I–III con teoría, fórmulas, ejemplos, simulación y práctica (26 lecciones, 208 ejercicios) | ✅ | Validados por `tests/contenido.test.ts`: estructura, LaTeX y claves autoconsistentes |
| Corrección automática (unidades, cifras significativas, tolerancia, equivalencias, errores típicos) | ✅ | `tests/calificacion.test.ts` y `tests/handler.test.ts` |
| Persistencia de resultados e intentos, borradores, registro de envíos | 🟡 | SQL revisado; ejecute `supabase/pruebas/rls.sql` en su proyecto |
| RLS, protección de claves, calificaciones y datos personales | 🟡 | Controles estáticos en `tests/seguridad.test.ts`; pruebas reales con `supabase/pruebas/rls.sql` |

## Segunda etapa

| Requisito | Estado | Nota |
|---|---|---|
| Simuladores de cinemática y dinámica: vectores, movimiento rectilíneo, caída libre, proyectiles, MCU, fuerzas y plano inclinado | ✅ | Modelos validados en `tests/fisica.test.ts` |
| Gráficas en tiempo real y ejercicios basados en los datos del experimento | ✅ | Los ejercicios «experimento» llevan el simulador con los parámetros del enunciado |
| Banco de preguntas con filtros | ✅ | |
| Evaluaciones configurables (fechas, intentos, visualización de respuestas, publicación de notas) | ✅ | |
| Estadísticas por pregunta y por concepto | ✅ | |
| Bloques IV (Energía y cantidad de movimiento), V (Oscilaciones y ondas) y VI (Termodinámica) | ⬜ | Anunciados en el temario como «en preparación» |
| Simuladores masa-resorte, péndulo, ondas, sonido, transferencia de calor y gases ideales | ⬜ | Listados como pendientes en el laboratorio |
| Límite de tiempo por intento, prórrogas individuales, orden aleatorio | ⬜ | |
| Revisión por el profesor de las respuestas de desarrollo hechas en la práctica libre de una lección | ⬜ | Hoy el estudiante las compara con la solución modelo; el profesor solo revisa las de actividades asignadas |

## Tercera etapa

| Requisito | Estado |
|---|---|
| Personalización del aprendizaje (rutas según dominio) | ⬜ (ya existe la base: dominio por concepto y refuerzo automático) |
| Generación parametrizada de problemas | ⬜ |
| Herramientas de análisis pedagógico avanzadas | ⬜ |
| Respuestas de tipo expresión algebraica | ⬜ |

## Cómo añadir un bloque nuevo

1. **Contenido.** Hay dos caminos:
   - Desde la aplicación: Contenido → bloque → «+ Añadir lección». Es lo más sencillo para el profesor.
   - Desde archivos: escriba las lecciones en `contenido/bloqueN/` y las claves en `privado/claves/bloqueN/`, siguiendo `contenido/GUIA_REDACCION.md`. Después ponga `folder` y `comingSoon: false` en `contenido/unidades.ts` y ejecute `npm test` y `npm run semilla`.
2. **Simuladores.** Añada el modelo físico a `src/fisica/` con sus pruebas, la ficha a `src/sims/catalogo.ts` y el componente a `src/sims/Simulador.tsx`.
3. **Unidades del motor de calificación.** El motor ya reconoce las de termodinámica y ondas (K, °C, °F, J/(kg·K), Hz, Pa, atm, cal, L…). Las diferencias de temperatura se marcan con `temperatureInterval`.
