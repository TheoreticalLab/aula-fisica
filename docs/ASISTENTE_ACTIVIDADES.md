# Asistente de actividades con IA (migración 56)

El profesor pide en lenguaje corriente la práctica o el examen que necesita y la IA, con preguntas y respuestas,
completa un **borrador**. Al confirmar, el aula elige las preguntas del banco y crea la actividad en la sección.

**Dónde:** aula → Panel docente → **🤖 Centro de IA** (`/docente/centro-ia`) y **Orbe Control → ✨ IA** en el teléfono.

## Flujo

1. **Conversación.** Ejemplo: «Necesito una práctica de 10 problemas de choques inelásticos y conservación de la
   cantidad de movimiento para Física General 1-A, la mitad intermedios y algunos desafiantes, que abra el lunes a las
   8 a. m. y cierre el miércoles a las 11:59 p. m.». Claude interpreta sección, tipo, modalidad, temas (elige las
   lecciones), cantidad, niveles y fechas (a partir de la hora actual de la República Dominicana) y, si falta algo o es
   ambiguo («a las 8: ¿mañana o noche?»), hace **una pregunta** cada vez.
2. **Borrador visible y editable.** A la derecha (o debajo, en el teléfono) está el borrador con lo que falta resaltado.
   El profesor puede corregir cualquier campo a mano; esa revisión **no usa IA ni cuesta nada**.
3. **Lo que falta lo decide el servidor**, no el modelo: sección, tipo, modalidad, temas, número de preguntas y título;
   en un examen, apertura y cierre; en una tarea, cierre. Si Claude no pregunta y falta algo, pregunta el servidor.
4. **Elegir preguntas.** Con el borrador completo, el aula elige preguntas **publicadas** del banco: reparto por igual
   entre las lecciones y mezcla de niveles pedida; si no hay suficientes de un nivel, usa el más cercano de la misma
   lección (y lo dice); si aun así faltan, ofrece generarlas con IA (quedan como borradores para revisar) o crear con las
   disponibles. Se puede volver a elegir otras.
5. **Crear.** Se muestra el resumen en lenguaje llano (el mismo del asistente «+ Crear actividad») y el profesor elige
   **programarla** (publicada, se abre a la hora indicada) o **guardarla oculta** para revisarla. La actividad se crea
   oculta, se completa (preguntas, modo de examen, aprendizaje asistido) y solo al final se publica, con las MISMAS
   reglas del asistente clásico (`src/lib/plantillas.ts`, `src/api/crearActividad.ts`).

## Modalidades

| Tipo | Modalidad | Plantilla |
|---|---|---|
| Práctica | libre · asistida · tarea | Práctica libre · Aprendizaje asistido · Tarea con fecha |
| Examen | quiz · parcial · estricto · clásico | Quiz rápido · Examen parcial · Examen estricto · Evaluación en blanco |

La duración del examen y los intentos, si no se dicen, son los de la modalidad. El examen adaptativo se configura
después en la actividad (Modo de examen), porque exige un banco calibrado.

## Garantías

- **Claude no crea nada.** Devuelve un borrador; la actividad la construye el aula con reglas fijas y solo tras la
  confirmación del profesor.
- **Validación en el servidor:** solo secciones del profesor y lecciones de la asignatura de esa sección (las ajenas se
  quitan con aviso); cantidades acotadas; fechas válidas y cierre posterior a la apertura; aviso si en esas lecciones no
  hay suficientes preguntas publicadas.
- **Qué recibe Claude:** hora local, nombres de sus secciones, títulos de las lecciones de sus asignaturas con cuántas
  preguntas publicadas hay por nivel, y la conversación (últimos 12 mensajes). Usa referencias cortas (S1, L12); nunca
  identificadores, enunciados, claves ni datos de estudiantes.
- **Gasto:** Orbe IA, propósito «asistente» (interruptor, presupuesto, límite diario y simulador comunes). Con las
  llamadas reales apagadas responde un simulador que entiende lo básico (tipo, cantidad, sección, temas) para probar.
  Cada mensaje es una llamada (≈ 6 000–12 000 tokens de entrada según el número de lecciones; con Claude Opus 5.5,
  unos US$ 0,03–0,06 por mensaje).

## Pruebas

`tests/asistente-actividad.test.ts` (hora local, selección del banco con sustitución y faltantes, construcción con las
reglas de la plantilla, validación del borrador, faltantes decididos por el servidor, referencias sin identificadores,
simulador, turnos con Claude simulado, revisión sin coste) y `supabase/pruebas/asistente_actividades.sql` (solo sus
secciones y asignaturas, lecciones visibles, conteo de publicadas, sin enunciados, permisos, propósito).

## Límites

- Probado solo con el simulador; falta probarlo con la API real y en el teléfono.
- No configura el examen adaptativo ni las transferencias de la práctica asistida (se hacen después en la actividad).
- En Orbe Control los temas se eligen por la conversación (o en el Centro de IA del aula); el resto se edita también a
  mano.
