# Programa académico con seguimiento de lo impartido · Física General III

Migración `20261103000071_programa_academico.sql` · biblioteca `privado/biblioteca/electromagnetismo/` ·
datos `privado/datos/*_biblioteca-electromagnetismo.sql`.

## Principio: un curso nativo, no un módulo paralelo

Física General III usa **la misma arquitectura** que Física General I. No hay un apartado «Contenidos» aparte: el programa
vive en el Temario, en la página de cada lección y en el editor de contenidos de siempre.

| Programa (instrucción del profesor) | Pieza existente reutilizada |
|---|---|
| Asignatura Física General III | `courses` (código `FIS-GEN-3`, ya existía, vacía) y su sección «Física General 3» |
| 5 unidades académicas | `units`, con su estado borrador / preparado / publicado / archivado |
| 12 capítulos (21–32) | `lessons`: teoría, fórmulas (ecuaciones con variables y unidades), ejemplos, simulación, práctica |
| Subtemas («contenidos principales») | `concepts` (los mismos que miden el dominio y vinculan ejercicios y controles) |
| Objetivos, errores frecuentes, conexiones | `lessons.study` (estructura de estudio de la biblioteca) |
| Carga idempotente y sin pisar ediciones | biblioteca `scripts/generar-curso.ts` + `customized` + `privado/datos/` + `npm run aplicar` |
| Vista del estudiante | `Temario.tsx` y `Leccion.tsx` (mismas tarjetas desplegables, barras de progreso y pestañas) |
| Edición docente | `CursoEditor.tsx` (crear, reordenar, ocultar, mover capítulos; publicar unidades) y `LeccionEditor.tsx` |
| Clases impartidas asociadas | `class_sessions` (migración 66) |
| Vínculos con ejercicios / exámenes | `exercises.concepts` (ya relaciona cada pregunta con subtemas) y `activity_items` |
| Lectura | `study_visits` (tiempo de estudio efectivo; nunca se convierte en nota) |
| Permisos | `is_course_staff`, `is_class_teacher`, `lesson_visible_to_me`, `activity_visible_to_me`, RLS |

## Lo que se añadió (y por qué)

Solo lo que la arquitectura no podía expresar:

- `courses.programa` — activa el seguimiento en una asignatura; las demás no cambian en nada.
- `concepts.position / nivel / hidden / descripcion / customized` — orden, nivel (**esencial**, **complementario**,
  **profundización**), ocultar un subtema y su descripción; el instalador no pisa lo editado. La política `concepts_select`
  oculta a los estudiantes los subtemas ocultos.
- `program_coverage` — **lo impartido por sección**: subtema, fecha, clase impartida y nota. Desmarcar anula (historial).
- `program_links` — vínculos del capítulo o de un subtema con prácticas, evaluaciones, ejercicios, simuladores, clases y
  material (PDF, vídeo, imagen o enlace **https**), por sección o para todas, con publicar / despublicar.
- `program_notes` — observaciones docentes (nunca las ven los estudiantes).
- Funciones: `programa_seccion`, `programa_marcar`, `programa_desmarcar`, `programa_capitulo`, `programa_enlace_guardar`,
  `programa_enlace_retirar`, `programa_nota_guardar`, `programa_nota_retirar`, `programa_mio`.
- Biblioteca: modo `programa` (capítulos sin ejercicios; exige ficha completa: introducción, ≥ 3 objetivos, subtemas con
  nivel, ideas fundamentales, ecuaciones con variables, ejemplo, aplicaciones, ≥ 2 errores y referencia).
- Interfaz: pestaña «Programa impartido» en la sección; en el editor del capítulo, «Datos y subtemas», «Objetivos y estudio»
  (también útil para las demás asignaturas) y «Material, vínculos y notas»; en el Temario y la lección, el programa con lo
  previsto, lo impartido y lo disponible; en Orbe Control, la pestaña «📚 Programa».

## Tres estados que no se mezclan

- **Previsto**: está en el programa (unidad «preparada» o «publicada»).
- **Impartido**: el profesor lo marcó en la sección del estudiante, con fecha.
- **Disponible para estudiar**: la unidad está «publicada» (el material se ve).

Una unidad **preparada** muestra a los estudiantes el programa sin el material; **publicada**, también el material.
El programa se instala en **borrador**: nada se ve hasta que el profesor lo decide. El texto de la biblioteca lo redactó la
IA a partir del programa del profesor y debe revisarlo antes de publicarlo.

## Pruebas

- `supabase/pruebas/programa_academico.sql`: permisos entre secciones y asignaturas, aislamiento entre secciones,
  previsto / impartido / disponible, subtemas ocultos, vínculos solo https y publicados, historial (anular, no borrar),
  un subtema impartido no se puede borrar, «customized».
- `tests/programa.test.ts`: avance, estado del capítulo, fechas, URL y fecha de Santo Domingo.
- Comparación funcional con Física General I sobre la copia local de producción (`privado/tmp/comparar-fg3-local.mjs`).

## Límites conocidos

- No hay subida directa de PDF o imágenes: el material se enlaza por https (p. ej. un archivo compartido de Drive).
- Los capítulos no tienen ejercicios: el profesor los añade (banco, generación con IA o actividades) cuando quiera.
