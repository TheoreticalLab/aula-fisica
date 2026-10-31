# Unidad 9. Física de los choques: cantidad de movimiento, impulso y energía

Rediseño de la Unidad 9 de Física General I (y IA) y banco de ejercicios. Principio pedagógico:
**fenómeno → observación → predicción → concepto → modelo → simulación → problemas**.

## Estrategia de migración (sin tocar datos de estudiantes)

| Antes | Después |
|---|---|
| Unidad 9 «Cantidad de movimiento» (`cantidad-movimiento`, 11 lecciones) y Unidad 10 «Colisiones y aplicaciones» (`colisiones`, 11 lecciones) | Unidad 9 «Física de los choques» (`fisica-choques`, 15 lecciones, posición 9) |

- **Identificadores nuevos.** Lecciones `u9c-…`, conceptos `u9c-…`, ejercicios `mec-u9c-NN-k`. Ningún identificador
  antiguo se reutiliza para un contenido distinto.
- **Las unidades antiguas se archivan, no se borran** (`curso.ts → archivar`). Los estudiantes dejan de verlas; sus
  lecciones, ejercicios, claves, actividades, intentos, respuestas y calificaciones quedan intactos, y las actividades
  ya creadas con esos ejercicios siguen funcionando. El profesor puede volver a publicarlas desde el panel.
- Las carpetas antiguas siguen en `privado/biblioteca/mecanica/` como referencia (no se instalan).
- **Reversión:** volver a poner `'u09-cantidad-movimiento', 'u10-colisiones'` en `curso.ts → unidades`, quitar
  `archivar`, reinstalar la biblioteca y, en el panel, archivar «Física de los choques» y publicar las antiguas.

## Piezas

| Pieza | Archivo |
|---|---|
| Motor físico (choques 1D/2D, restitución, frenado sin extrapolar, distancia conocida, plano, caída, rebote con peso, resorte, pulso de contacto, laboratorio en dos etapas) | `src/lib/fisica/choques.ts` · pruebas `tests/fisica-choques.test.ts` |
| Laboratorio «choque seguido de fricción» | `src/sims/LaboratorioChoques.tsx` (clave `laboratorio-choques` en `src/sims/catalogo.ts`) |
| Versiones parametrizadas reproducibles (semillas, rangos válidos, respuestas del motor) | `src/lib/fisica/variantes.ts` · `tests/variantes.test.ts` |
| Arrastre de errores en problemas por etapas | `supabase/functions/_shared/calificacion/arrastre.ts`, `calificar/handler.ts` · `tests/arrastre.test.ts`, `tests/handler.test.ts` |
| Metadatos del banco, filtros y rendimiento | `src/lib/banco.ts`, `src/pages/docente/Banco.tsx` · `tests/banco.test.ts` |
| Base de datos | `supabase/migrations/20261101000041_banco_ejercicios.sql` · `supabase/pruebas/banco_ejercicios.sql` |
| Contenido (privado: contiene claves) | `privado/biblioteca/mecanica/u09-choques/` (15 minicapítulos, `PLAN.md`) |
| Validación y cobertura | `scripts/biblioteca/validar.ts` (metadatos, cadenas, arrastre), `tests/banco-u9.test.ts`, `scripts/biblioteca/informe-banco.ts` |

## Laboratorio interactivo

- **Entradas:** masas, velocidades con signo, coeficiente de restitución (botones «Elástico / Parcialmente / Totalmente
  inelástico»), fricción cinética posterior μk, g, separación inicial y duración del contacto (solo para la gráfica de fuerza).
- **Controles:** iniciar, pausar, reiniciar, velocidad ×0.25 (cámara lenta) a ×2 y deslizador de tiempo.
- **Lecturas en cada instante:** x, v, p y K de cada bloque y totales.
- **Etapa A (choque):** velocidades después, p antes y después, K antes y después, K transformada, impulso sobre cada bloque.
- **Etapa B (fricción):** fuerza de fricción, aceleración, tiempo de frenado, distancia, trabajo de la fricción y energía
  transformada. La pista cambia de aspecto al empezar la etapa B. p **no** se conserva en la etapa B (impulso externo de la fricción).
- **Gráficas:** x–t, v–t, p–t, K–t y F–t. La de fuerza usa un **modelo de contacto declarado** (pulso semisinusoidal con el
  impulso del choque y la duración elegida); se explica que solo el área está fijada por la física.
- **Balance de energía:** K inicial = transformada en el choque + transformada por fricción + K que queda.
- Caso de referencia (2 kg a 6 m/s + 1 kg, μk = 0.25, g = 10): 12 J en el choque y 24 J en el deslizamiento, d = 3.2 m (prueba automática).

## Problemas por etapas y arrastre

Los problemas integradores de 9.15 tienen 7 etapas (sistema · tipo de choque · qué se conserva · velocidades · dinámica
posterior · cálculo · verificación), cada una calificada por separado. Las etapas numéricas que dependen de una anterior
llevan en su clave un **arrastre**: si el estudiante se equivocó en la etapa 4 pero aplicó bien la física en la 6 con SU
valor, la etapa 6 cuenta como correcta con el aviso «coherente con su resultado anterior». La Edge Function obtiene la
respuesta anterior con `svc_respuesta_etapa` (mismo estudiante, mismo intento, mismo minicapítulo; solo `service_role`).
La expresión se evalúa con una gramática cerrada (sin `eval`). Si la migración 41 no está aplicada, se califica sin arrastre.

## Parametrización

`src/lib/fisica/variantes.ts` genera versiones de las familias A, B, C, D, E, G y L a partir de una semilla
(mulberry32): mismos parámetros y respuestas para la misma semilla, rangos y rejilla del enunciado, respuestas
calculadas con el motor a partir de los valores redondeados y reglas de validez (no se aceptan versiones casi en el
límite, ni ángulos que crearían energía cinética, ni planos en que μk ≥ tan θ). Las pruebas recorren cientos de semillas.

**Limitación:** la plataforma todavía no sortea una versión distinta por intento. Eso exige generar la clave en el
servidor y guardar los parámetros asignados en cada intento (migración y Edge Function nuevas). Hoy las versiones se usan
para crear ejercicios distintos del banco y para auditar.

## Panel docente (Banco de ejercicios)

Además de los filtros de siempre (asignatura, lección, dificultad, tipo, rol, búsqueda), con la migración 41 aparecen:
tipo de pregunta, tipo de choque, número de etapas, familia, concepto previo, y «usa fricción / energía / cinemática /
planos inclinados». Cada ejercicio muestra sus metadatos y, si hay respuestas, acierto, acierto al primer intento,
intentos de media y error más frecuente. «Rendimiento por tipo y conceptos previos» resume el acierto por tipo de pregunta
y los conceptos previos con menos acierto (agregados, sin identificar estudiantes; el profesor de sección ve solo a los
suyos). La clave y la solución se revisan abriendo el ejercicio, como siempre. Para usar ejercicios en una práctica o
evaluación: sección → «+ Crear actividad».

## Seguridad

- Claves, pistas y soluciones solo en `privado/` y en `exercise_keys` (RLS: solo profesorado). Los metadatos del banco no
  contienen respuestas (el validador lo comprueba) y solo los lee el profesorado (`exercise_bank_meta`, RLS + prueba SQL).
- `npm run verificar` comprueba ahora también que ningún texto de las claves de la biblioteca aparezca en `dist/`.
- La unidad se instala como **«preparado»** (no visible para estudiantes) hasta que el profesor la publique.
