# Estado del desarrollo por etapas

Leyenda: ✅ hecho y probado · 🟡 hecho, verificado solo parcialmente (ver nota) · ⬜ pendiente.

## Primera etapa

| Requisito | Estado | Nota |
|---|---|---|
| Aplicación navegable (React + TS + Vite + Tailwind), modo claro y oscuro, adaptada a móvil | ✅ | Barra de navegación inferior en el teléfono |
| Usuarios: registro, ingreso, recuperación de contraseña, roles estudiante, profesor y administrador | 🟡 | Requiere un proyecto Supabase real; no se pudo probar contra uno durante el desarrollo |
| Panel del profesor: clases, grupos, códigos, contenido, ejercicios, actividades, revisión, calificaciones, CSV | 🟡 | Ídem |
| Panel del estudiante: temario, lecciones, prácticas, actividades, calificaciones, progreso | 🟡 | Ídem |
| Vista previa del panel de inicio del estudiante por sección (botón «Ver como estudiante») | ✅ | `src/pages/docente/VistaPanel.tsx`; el panel real y la vista previa comparten `src/lib/panel.ts` (`tests/panel-construir.test.ts`). Muestra a un estudiante recién inscrito y sin grupo |
| Vista previa «como estudiante» de prácticas y evaluaciones (lectura, ejercicios, pistas, entrega simulada; no guarda nada) | ✅ | `src/pages/docente/VistaPrevia.tsx` y `src/lib/simulacion.ts` (mismas reglas que el servidor; `tests/vista-previa.test.ts`). No requiere cambios en la base de datos |
| Actividades con lectura cronometrada (tiempo mínimo, pausa al salir de la plataforma, ejercicios bloqueados hasta completarla) | 🟡 | Migración `20261025000010_lectura_cronometrada.sql` + `supabase/pruebas/lectura.sql`; pendiente de aplicar en producción. Primera actividad: «Lectura: las leyes de Newton» (8 ejercicios) |
| Portada pública reducida a una pantalla de acceso (ingresar / activar cuenta), sin nombrar asignaturas; «Estado del desarrollo» solo para el profesorado | ✅ | La web compilada no contiene nombres de asignaturas. Cada estudiante solo puede leer sus propios cursos (RLS `is_enrolled_course`) |
| Portada general «Aula Virtual de Física» (reemplazada por la pantalla de acceso) (tres asignaturas) y panel de inicio del estudiante (mis cursos, continuar, próximas actividades, avisos, progreso) | ✅ | Avisos por sección: migración `20261025000009_avisos.sql` + `supabase/pruebas/avisos.sql`; «continuar» recuerda la última lección en el dispositivo; vista previa con datos de ejemplo en `pruebas/vista-previa/panel.html` |
| Bloques I–III con teoría, fórmulas, ejemplos, simulación y práctica (26 lecciones, 208 ejercicios) | ✅ | Validados por `tests/contenido.test.ts`: estructura, LaTeX y claves autoconsistentes |
| Corrección automática (unidades, cifras significativas, tolerancia, equivalencias, errores típicos) | ✅ | `tests/calificacion.test.ts` y `tests/handler.test.ts` |
| Persistencia de resultados e intentos, borradores, registro de envíos | 🟡 | SQL revisado; ejecute `supabase/pruebas/rls.sql` en su proyecto |
| RLS, protección de claves, calificaciones y datos personales | 🟡 | Controles estáticos en `tests/seguridad.test.ts`; pruebas reales con `supabase/pruebas/rls.sql` |
| Ficha completa del estudiante (accesos, sesiones de estudio, actividades intentadas y no intentadas, respuestas y errores, calificaciones, dominio, mensajes, historial de la cuenta) | 🟡 | Migración `20261027000022` + `supabase/pruebas/ficha_estudiante.sql`; `src/pages/docente/FichaEstudiante.tsx`. Pendiente de aplicar en producción |
| Ficha del estudiante · pestaña «Exámenes»: por evaluación, nota e intentos, respuestas pregunta por pregunta (con calificación manual), cronología de la telemetría e integridad LIEIA de ese estudiante (sus indicadores y las parejas en que aparece) | 🟡 | `src/pages/docente/ExamenesEstudiante.tsx`, `src/lib/lieia/integridadEstudiante.ts`, `tests/lieia-ficha.test.ts`. Solo interfaz: usa las funciones del servidor ya aplicadas (`lieia_exam_data`, `lieia_reveal`, `lieia_telemetry`), auditadas igual. No probada aún con datos reales en el navegador |
| Entregas en PDF (prácticas y exámenes escritos) con autorización previa del profesor y revisión aceptado/rechazado | 🟡 | Migración `20261027000023` + Edge Function `entregas` (almacenamiento privado, verifica que sea un PDF real) + `supabase/pruebas/entregas_pdf.sql` y `tests/entregas.test.ts`. Pendiente de aplicar; la subida real se prueba tras desplegar |
| Asistencia con código (abrir en Orbe Control o en la sección, presentes en vivo, corrección manual, historial y CSV) | 🟡 | Migración `20261027000024` + `supabase/pruebas/asistencia.sql`. Pendiente de aplicar en producción |
| Laboratorio LIEIA (integridad académica): instrumentación de tiempos por pregunta, simulador con verdad conocida, 7 detectores, validación con controles negativos/positivos/adversariales, análisis de evaluaciones reales solo con detectores validados | 🟡 | `src/lib/lieia/`, `src/pages/docente/lieia/`, migración `20261027000027` + `supabase/pruebas/lieia.sql`, `tests/lieia.test.ts`. Validación reproducible: `scripts/lieia-validar.ts` → `docs/LIEIA_VALIDACION.md`. Validados: D1, D3, D6 (D2 con limitaciones; D4, D5 sin potencia demostrada; D7 no validado). Pendiente de aplicar; los tiempos por pregunta existen solo desde la activación |
| LIEIA · diseño experimental y calibración de exámenes: diseñador (orden aleatorio/contrabalanceado/anclas, versiones isomorfas, papeles), calibración 2PL validada, información, tiempos y equidad, selección óptima, prueba experimental previa, experimentos de diseño, detector D8 | 🟡 | Migración `20261028000028` + `supabase/pruebas/diseno_examenes.sql`, `tests/lieia-diseno.test.ts`, `docs/LIEIA_DISENO.md`, `docs/LIEIA_CALIBRACION.md`. Corrige el registro de respuestas vacías de la migración 27. Pendiente de aplicar; sin datos reales consentidos todavía |
| LIEIA · telemetría del proceso de respuesta en todas las prácticas y evaluaciones (sin teclas ni contenido), cronología por pregunta, vista longitudinal, detectores P1–P3 y laboratorio del proceso | 🟡 | Migración `20261028000029` + `supabase/pruebas/telemetria.sql`; `src/lib/telemetria/`, `tests/telemetria.test.ts`, `tests/lieia-proceso.test.ts`, `docs/LIEIA_PROCESO.md`. P1 validado, P2 con limitaciones, P3 descriptivo. Pendiente de aplicar; no probado en dispositivos reales |
| Centro de seguridad (Beta): eventos de acceso con procedencia, detecciones por reglas, «¿Pude haber sido yo?», todos los usuarios que ingresan, «Fallaron y luego entraron» | 🟡 | Migraciones `20261027000020` y `20261027000021` + `supabase/pruebas/seguridad_forense.sql` y `acceso_tras_fallos.sql`; pendiente de aplicar en producción. Sin MFA ni proveedor/VPN (requieren servicio externo) |

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
| Herramientas de análisis pedagógico avanzadas | 🟡 Analítica de tiempo de aprendizaje (migración 12, `docente/analitica`): tiempo efectivo por estudiante y subsección, solo para el profesor. Pendiente: relacionarlo con resultados e intentos |
| Respuestas de tipo expresión algebraica | ⬜ |
| Orbe IA · humor contextual con Claude: chistes por lección/subsección/apartado, generados en lote (Edge Function `orbe-ia`), revisados por el profesor y reutilizados; reglas de aparición y límites de gasto en el servidor; panel «ORBE IA — HUMOR CONTEXTUAL» (`/docente/orbe-ia`) | 🟡 Migración `20261028000030_orbe_ia.sql` + `supabase/pruebas/orbe_ia.sql`, `supabase/functions/orbe-ia/`, `tests/orbe-ia.test.ts`. Todo nace apagado (módulo, estudiantes, API real, aprobación automática). Pendiente de aplicar; sin clave de API configurada; probado solo con el simulador. Nivel C: solo «ejercicio de práctica resuelto» está conectado. Migraciones 30 aplicada (2026-10-28); 31 (copiar el banco entre asignaturas con el mismo contenido, `supabase/pruebas/orbe_ia_copiar.sql`) y 32 (sin activación por parte del estudiante: solo decide el panel del profesor, `supabase/pruebas/orbe_ia_activacion.sql`) pendientes de aplicar |

## Cómo añadir un bloque nuevo

1. **Contenido.** Hay dos caminos:
   - Desde la aplicación: Contenido → bloque → «+ Añadir lección». Es lo más sencillo para el profesor.
   - Desde archivos: escriba las lecciones en `contenido/bloqueN/` y las claves en `privado/claves/bloqueN/`, siguiendo `contenido/GUIA_REDACCION.md`. Después ponga `folder` y `comingSoon: false` en `contenido/unidades.ts` y ejecute `npm test` y `npm run semilla`.
2. **Simuladores.** Añada el modelo físico a `src/fisica/` con sus pruebas, la ficha a `src/sims/catalogo.ts` y el componente a `src/sims/Simulador.tsx`.
3. **Unidades del motor de calificación.** El motor ya reconoce las de termodinámica y ondas (K, °C, °F, J/(kg·K), Hz, Pa, atm, cal, L…). Las diferencias de temperatura se marcan con `temperatureInterval`.
