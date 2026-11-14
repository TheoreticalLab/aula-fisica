# Maratón académico adaptativo

**Estado (14-nov-2026).** **Aplicado en producción** con el plan `b11c6f34`: migración 94, Edge Function `maraton`, banco FG1 y borrador cargados (respaldo previo `privado/respaldos/20261114-221627`). El borrador «MARATÓN DE RECUPERACIÓN — FÍSICA GENERAL 1» existe en la sección «Física General 1» **sin fecha e invisible** para los estudiantes. Falta publicar el frontend (§ 14 A.5) y que el profesor lo programe y publique (§ 14 B).

El maratón **administra problemas y produce informes verificables**. No asigna, no escribe y no sugiere calificaciones. Los puntos de recuperación los decide el profesor con criterios comunicados a todos.

---

## 1. Auditoría de la arquitectura existente y riesgos

| Pieza | Qué hay en el aula | Uso en el maratón |
|---|---|---|
| Frontend | React 18 + TS + Vite + Tailwind; `HashRouter` con páginas en carga diferida; `src/api/*` es la única capa que habla con Supabase | Páginas nuevas (estudiante, configurador, informe) y una pestaña de sección |
| Autenticación y roles | Supabase Auth con cuentas por ID; `profiles.role` = student / teacher / admin; `account_ok`, `is_teacher`, `is_class_teacher`, `can_view_keys` | Reutilizados para todas las comprobaciones |
| Asignaturas y secciones | `courses`, `classes`, `class_groups`, `class_teachers`, `enrollments` | El maratón pertenece a una sección y, opcionalmente, a un grupo |
| Actividades | `activities` solo admite `mode` practice / exam. Muchas funciones ramifican por `mode` (controles, tablero, exámenes, registro) | **No se usa.** Un tercer modo rompería esas ramas, y un práctica/examen arrastraría el maratón a controles y al registro de notas |
| Prácticas extraordinarias (PES) | Motor aparte, con tablas propias, puntuación informativa, bloqueo de fila e idempotencia | **Modelo arquitectónico seguido** |
| Examen adaptativo (mig. 53) | TRI 2PL ligada a `attempts`/`activity_items` | Se reutilizan sus patrones (selección en el servidor, bloqueo, repetición idempotente), no sus tablas |
| Motor de calificación | `_shared/calificacion` (magnitudes con unidad, tolerancias, dimensiones); Edge Function `calificar` con `handler.ts` puro + `index.ts` Deno | Reutilizado sin cambios desde la Edge Function nueva `maraton` |
| Registro de calificaciones | `official_scores` recorre solo `activity_grade_links` | El maratón no está en `activities`: **no puede entrar al registro** |
| Tiempo activo | `practica_latido`: latido cada 10 s con una escritura por latido | **No se reutiliza el latido** (ver riesgos) |
| Telemetría y presencia | V1/V2, `presence_ping`, `study_beat` | No se añade telemetría nueva |
| Publicación y fechas | `published`, `opens_at`/`closes_at`; zona `America/Santo_Domingo` en SQL | El maratón tiene su propio estado y calendario, calculados en el servidor |
| Operación | `npm run verificar / probar / plan / aplicar`, `TABLAS_PROTEGIDAS`, pruebas SQL con `rollback` | Seguido íntegramente |

**Riesgos detectados y cómo se tratan**

- **Rendimiento (incidente del 2-nov).** La hipótesis principal fue un flujo constante de escrituras pequeñas, con cada commit forzando un fsync. Por eso el maratón **no tiene latidos ni sondeos**:
  - El tiempo de cada problema se mide en el navegador y viaja con la acción.
  - El servidor lo acota al reloj real transcurrido.
  - Cada acción del estudiante es **una transacción**: unas 4–6 filas, cada pocos minutos.
  - Pocos índices nuevos, todos usados por las consultas del motor.
- **Publicar Edge Functions durante una clase.** La función es nueva (`maraton`); `calificar` no cambia.
- **Datos de estudiantes.** Todo es aditivo: tablas nuevas, funciones nuevas, sin tocar tablas existentes. Las tablas con participación se añadieron a `TABLAS_PROTEGIDAS`.

## 2. Auditoría académica de Física General 1 y matriz de cobertura

Fuentes revisadas:
- Unidades y lecciones publicadas en la sección «Física General 1» (curso FIS-GEN-1).
- Reconstrucciones de las clases registradas (23, 24, 30 y 31-oct).
- Prácticas: Práctica 1, Cantidad de Mov., repaso, restitución entre paredes, PES de recuperación, refuerzos personales.
- El examen del 13-nov.

FG1-A se usó solo como contraste.

| Tema | Fuente académica | Unidad | Prácticas relacionadas | Exámenes | Cobertura | En el banco |
|---|---|---|---|---|---|---|
| Cinemática 1D (MRU, MRUA, caída libre) | u02 publicada | 2 | PES de recuperación (~15 problemas); dentro del rebote | c4 | media | ✅ D1–D3 (repaso) |
| Trabajo (signo, ángulo, rozamiento) | u05-01…06 | 5 | Práctica 1; refuerzo A | c2, d2 | alta | ✅ D1–D3 |
| Teorema trabajo-energía (con rozamiento) | u05-08…11, u04-15 | 5 | refuerzo A, F; repaso | c2, n3, d2 | alta | ✅ D1–D6 |
| Energía potencial elástica / resorte | u06 | 6 | Práctica 1; PES | d1(d) | media | ✅ D1–D3 |
| Conservación de la energía | u07; clase 23-oct | 7 | repaso u7 | n2, d1(d) | media | ✅ D1–D6 |
| Movimiento armónico simple | u08; clases 23 y 24-oct | 8 | repaso; refuerzo F6–F8 | c1, n1, n2, d1 | alta | ✅ D1–D6 |
| Cantidad de movimiento e impulso | u09c 02–06; clase 30-oct | 9 | Práctica Cantidad de Mov.; refuerzo D | n4, d3 | alta | ✅ D1–D4 |
| Colisiones (elásticas, inelásticas, parciales, e, pérdida de energía) | u09c 07–13, 15; clases 30 y 31-oct | 9 | Cantidad de Mov.; repaso; restitución; refuerzo B, C, G | c3, c4, n5, n6, d3 | alta | ✅ D1–D6 |
| Rebotes y colisiones sucesivas | u09c-13; clase 31-oct | 9 | Restitución entre paredes (C–F) | — | media | ✅ D3–D6 |
| Proyectiles | u03 publicada | 3 | repaso (6 ítems) | — | baja | ⏸ pendiente de revisión |
| Leyes de Newton / plano inclinado / Atwood | u04 publicada | 4 | PES (1 ítem) | d2(a) | baja | ⏸ pendiente de revisión |
| Movimiento circular | u03-13, u04-19 | 3–4 | — | — | sin evidencia | ✖ excluido |
| Potencia | u05-12 (solo FG1-A) | 5 | — | — | baja | ✖ excluido |
| Centro de masa | solo mencionado | — | — | — | sin evidencia | ✖ excluido |
| Retroceso y explosiones | unidad archivada; FG1-A | — | — | — | sin evidencia | ✖ excluido |
| Colisiones 2D | u09c-14; FG1-A | 9 | — | — | baja | ✖ excluido |
| Rotación | unidad 10 en preparación | 10 | — | — | sin evidencia | ✖ excluido |

> **A confirmar por el profesor:** la cinemática 1D se clasificó como «media» por las lecciones publicadas y la práctica de recuperación. No hay registro fotográfico de esas clases (los registros empiezan el 23-oct). Si no se impartió en FG1, basta con desmarcar el tema en Contenido.

## 3. Arquitectura

```
Navegador (estudiante)                     Supabase
 Maraton.tsx ── maraton_iniciar / estado / no_puedo / cambiar ──▶ funciones SQL (security definer)
     │                                                       │  bloqueo de la inscripción (FOR UPDATE)
     └── Edge Function «maraton» { responder } ──▶ svc_maraton_clave (clave del problema ABIERTO)
                       │ evaluarRespuesta (motor _shared/calificacion)
                       └──────────────────────▶ svc_maraton_responder (idempotente, máquina de estados)
Profesor: MaratonTab / MaratonEditor / MaratonInforme ── maraton_crear, guardar, cambiar_estado, duplicar,
          resumen, historial, exportar, incidencia, banco_* (todas comprueban is_class_teacher / can_view_keys)
```

Archivos:

| Capa | Archivos |
|---|---|
| Migración | `supabase/migrations/20261114160000_maraton_adaptativo.sql` (reversión en `supabase/reversion/…_revertir.sql`) |
| Edge Function | `supabase/functions/maraton/{handler.ts,index.ts,evaluar.ts}`; `supabase/config.toml` |
| API | `src/api/maraton.ts` |
| Lógica pura | `src/lib/maraton/{config.ts,motor.ts,indicadores.ts,exportar.ts}` |
| Páginas | `src/pages/estudiante/Maraton.tsx`, `src/pages/docente/{MaratonTab,MaratonEditor,MaratonInforme}.tsx`, `src/components/ListaMaratones.tsx` |
| Integración | `src/App.tsx` (rutas), `src/pages/docente/Clase.tsx` + `src/lib/tablero.ts` (pestaña), `src/pages/docente/CrearActividad.tsx` (tarjeta), `src/pages/estudiante/{Evaluaciones,Inicio}.tsx` |
| Banco (marco, en git) | `scripts/maraton/{marco.ts,validar.ts,generar-banco.ts,concurrencia.ts}` |
| Banco FG1 (privado, fuera de git) | `privado/maraton/fg1/*.ts`, `privado/maraton/fg1/semilla.txt`, `informe.json` |
| Datos privados | `privado/datos/20261114170000_maraton-banco-fg1.sql`, `privado/datos/20261114170100_maraton-fg1-borrador.sql` |
| Pruebas | `supabase/pruebas/maraton_adaptativo.sql`, `supabase/pruebas/maraton_borrador_fg1.sql`, `tests/maraton-*.test.ts` (6) |

## 4. Modelo de datos

Todas las tablas tienen RLS y **ningún permiso directo** para `anon` ni `authenticated`; todo pasa por funciones.

| Tabla | Contenido |
|---|---|
| `maraton_bancos` | Banco (id, nombre, `cursos` que pueden usarlo, versión) |
| `maraton_temas` | Matriz de cobertura: fuente, prácticas, exámenes, cobertura, estado verificado / pendiente / excluido |
| `maraton_plantillas` | Tema, subtema, nivel 1–6, `t_min_s`, `t_max_s`, unidades nominales, etiquetas, fuente curricular, método de verificación, estado de validación, revisión docente |
| `maraton_variantes` | Enunciado, partes (etiqueta + unidad sugerida), datos, huella |
| `maraton_claves` 🔒 | Clave por parte (`NumericKey`), solución desarrollada, verificación independiente |
| `maraton_actividades` | Sección, grupo opcional, banco, textos, responsable, estado borrador / publicado / archivado, `fecha_inicio` (null = pendiente), `config` jsonb, `calificacion_automatica` (check `= false`), `origen_id` |
| `maraton_inscripciones` | Estado mínimo para seleccionar: nivel, comodines usados, secuencia, problema actual, 8 plantillas recientes, conteo por tema; `prueba` para el recorrido del profesor |
| `maraton_jornadas` | Contadores del día: unidades, intentos válidos, correctas, incorrectas, «no puedo», cambios, presentados, anticipadas, segundos; estado, vía, revisión, reapertura |
| `maraton_presentaciones` | Historial forense: problema, nivel, tiempos, decisión, respuesta, procedimiento, segundos acreditados e informados, unidades, nivel después, comodines antes y después, `idem`. Únicos `(inscripción, variante)` y `(inscripción, secuencia)`. **Inmutable una vez cerrada** (disparador) |
| `maraton_eventos`, `maraton_incidencias` | Solo admiten añadir filas (disparador) |

## 5. Máquina de estados (determinista)

| Acción | Nivel siguiente | Unidades | Comodines |
|---|---|---|---|
| Respuesta correcta | `min(N, L + ascenso)` → D6 permanece en D6 | ponderación(L) × min(1, t/t_min) | — |
| Respuesta incorrecta (intento válido) | `max(1, L − descenso)` | ponderación(L) × min(1, t/t_min) | — |
| «No puedo resolverlo» | `max(1, L − descenso_no_puedo)` | 0 | no consume |
| Cambiar ejercicio | L (mismo nivel) | 0 | +1 (atómico; falla si no quedan) |
| Cierre por plazo o límite | L | 0 | — |

Valores predeterminados: ascenso = descenso = descenso_no_puedo = 1; N = 6; nivel inicial D2. Con «adaptación» desactivada el nivel queda fijo. Con `nivel_al_iniciar_jornada = continuar`, el nivel pasa de una jornada a la siguiente.

## 6. Reglas de selección (servidor)

1. Plantillas del banco con `estado = 'validada'`, del nivel actual, en los temas elegidos, sin las plantillas excluidas.
2. Orden de preferencia:
   1. no recientes (las 8 últimas del estudiante);
   2. el tema menos presentado al estudiante, relativo a la `distribucion` configurada;
   3. `random()` en PostgreSQL. El azar es del servidor y no expone semillas.
3. Dentro de la plantilla, una variante validada **nunca presentada a ese estudiante**. Lo garantiza el índice único. Un problema sustituido no vuelve.
4. Si un nivel se agotara, se usa el nivel más cercano (primero hacia abajo) y se registra el evento `nivel_sin_problemas`.

No se lee el historial completo para elegir: solo la fila de la inscripción y un `not exists` sobre el índice único.

## 7. Fórmulas del contador

- Segundos acreditados = `min(reloj del servidor desde la presentación, t_max del problema, tiempo activo informado por el navegador)`.
- Una respuesta es **anticipada** si los segundos acreditados son menores que `t_min`. Recibe unidades = ponderación × segundos / `t_min`, no el crédito completo. «No puedo» se puede usar sin esperar.
- `t_min`/`t_max` de cada problema = los de la plantilla × `t_min_factor`, o el mínimo por nivel configurado.
  - Banco FG1: D1 60 s, D2 120 s, D3 180 s, D4 240 s, D5 300 s, D6 420 s, más 45 s por parte adicional.
  - Topes: 10, 15, 20, 25, 30 y 35 min.
- **Vía A:** unidades ≥ cuota (12).
- **Vía B:** segundos ≥ 60 min **y** intentos válidos ≥ 8.
- **Límites de protección:** 90 min, 18 intentos válidos o 30 problemas presentados. Al alcanzarlos se hace un cierre seguro y la jornada queda `cerrada_limite` para revisión. **No se declara incumplida.**

**Por qué D5 = D6 = 1.** Esto lo comprueban las simulaciones de `tests/maraton-motor.test.ts`.
- Con estos pesos, un estudiante que acierta casi todo y vive en D6 termina por la vía B: al menos 60 min y 8 intentos. No termina antes que un estudiante medio.
- Con pesos «según dificultad» (D5 = 2.5, D6 = 3) terminaría por la cuota en menos de 60 min.
- La vía B y los límites impiden que alguien quede atrapado indefinidamente.

## 8. Configuración de jornadas

- La jornada `k` corresponde a la fecha `fecha_inicio + (k − 1)`, o a la fecha `k` del calendario personalizado.
- Abre a la hora de apertura diaria. La jornada 1 abre además no antes de la hora de inicio.
- Cierra al final del minuto de la hora límite, en la zona configurada (`America/Santo_Domingo`).
- Todo se calcula en el servidor (`maraton_hoy`, `maraton_calendario`).
- Un envío que ya estaba en curso tiene un margen de gracia (120 s).
- Una jornada en curso cuyo plazo terminó se cierra como `incompleta` la próxima vez que el estudiante abre el maratón. El problema abierto se retira sin crédito.
- Las jornadas no completadas **no bloquean** las siguientes. La continuidad es una condición académica que el informe muestra jornada por jornada; el profesor la valora.
- Las incidencias quedan auditadas:
  - **reabrir** una jornada, con plazo de hasta 14 días: tiene prioridad sobre la de hoy;
  - **justificarla**;
  - dejar una **nota**.

## 9. Validación de respuestas (sin IA)

`supabase/functions/maraton/evaluar.ts`, sobre el motor existente.

- **Validez = forma, nunca la clave.** Cada casilla debe contener una magnitud legible, con unidad cuando la pide. Vacío, texto arbitrario o un número sin la unidad pedida no son un intento válido: no se escribe nada y el estudiante corrige y reenvía. Por eso «no válido» no revela si el valor era correcto.
- **Corrección.** Tolerancia relativa del 2 % (D1–D4) o del 3 % (D5–D6). Se aceptan unidades equivalentes (km/h ↔ m/s). Una unidad de otra dimensión es un intento válido e incorrecto. Las respuestas de varias partes son correctas si todas las partes lo son.
- **Procedimiento.** Se guarda para revisión humana; no se califica automáticamente.

## 10. Estructura y estado del banco FG1

ASIGNATURA → TEMA → SUBTEMA → DIFICULTAD → PLANTILLA → VARIANTE. Cada problema tiene: identificador, tema, subtema, nivel, enunciado, datos, respuesta, solución desarrollada, método de verificación, tolerancia, tiempo mínimo, unidades, etiquetas, fuente curricular y estado.

**Recuentos reales, construidos y validados:**
- 74 plantillas: **69 validadas**, 5 pendientes de revisión docente.
- 30 variantes por plantilla: **2 220 variantes**. **2 070** están en plantillas validadas y son presentables.

| Nivel | Plantillas validadas | Variantes |
|---|---|---|
| D1 | 11 | 330 |
| D2 | 15 | 450 |
| D3 | 15 | 450 |
| D4 | 10 | 300 |
| D5 | 10 | 300 |
| D6 | 8 | 240 |

| Tema | Plantillas | Niveles | Variantes |
|---|---|---|---|
| Colisiones | 16 | D1–D6 | 480 |
| MAS | 13 | D1–D6 | 390 |
| Trabajo-energía | 7 (+1 pendiente) | D1–D6 | 210 (+30) |
| Cinemática 1D | 7 | D1–D3 | 210 |
| Cantidad de movimiento e impulso | 7 | D1–D4 | 210 |
| Conservación de la energía | 6 | D1–D6 | 180 |
| Colisiones sucesivas | 6 | D3–D6 | 180 |
| Trabajo | 4 | D1–D3 | 120 |
| Energía potencial | 3 | D1–D3 | 90 |
| Proyectiles (pendiente) | 2 | D2–D3 | 60 |
| Newton (pendiente) | 2 | D2–D3 | 60 |

**Validación de cada variante** (`scripts/maraton/validar.ts`). Si una variante falla, el banco no se escribe.
1. Datos y respuestas finitos y no nulos.
2. **Verificación independiente**: simulación RK4, bisección o planteamiento alternativo. Desviación máxima observada: 0.0205 %.
3. Consistencia dimensional de cada unidad frente a la magnitud declarada.
4. Corrección automática:
   - la clave escrita se califica como correcta;
   - un valor desplazado 3 × la tolerancia, como incorrecto;
   - vacío, texto o un número sin unidad, como no válidos.
5. Sin ambigüedad: cada error típico (olvidar ½, restar rapideces, usar grados en lugar de radianes, complemento del porcentaje…) queda fuera de la tolerancia. Si no queda fuera, la variante se descarta.
6. Los números del enunciado son los de los datos.
7. LaTeX bien formado (además, en Vitest, KaTeX en modo estricto).

**Problemas D6:**
- trabajo-energía inverso con normal reducida y frenado posterior;
- bloque en pista con fondo rugoso (cruces sucesivos);
- plastilina que se incrusta en un oscilador;
- choque elástico que pone en marcha un oscilador;
- choque parcialmente inelástico con frenado de ambos bloques;
- cadena de choques entre tres carritos;
- bloque entre paredes (número de choques y tiempo, con logaritmos);
- rebotes hasta una altura umbral.

Todos combinan contenidos impartidos.

Revisión manual: siete variantes D5–D6 se recalcularon a mano. Coinciden.

Reconstruir el banco:
```
./node_modules/.bin/vite-node scripts/maraton/generar-banco.ts privado/maraton/fg1/banco.ts --marca AAAAMMDDHHMMSS
```
Un archivo de datos ya aplicado no se edita. Una versión nueva del banco requiere otra marca e identificadores nuevos (cambie `version`).

## 11. Seguridad

- **El navegador nunca recibe** clave, solución, nivel, ponderación, unidades, cuota, umbrales, plantilla, tema ni variante del problema actual. Lo comprueba `maraton_adaptativo.sql` § 2.
- **El navegador no controla** el nivel, las unidades, los comodines, el estado de finalización, la fecha efectiva ni los intentos válidos. Todo lo decide `maraton_cerrar` / `maraton_continuar` en una transacción con `SELECT … FOR UPDATE` sobre la inscripción.
- **Idempotencia.** Cada acción lleva un `idem` UUID (índice único).
  - Repetir la acción devuelve el estado sin cambios (`ya_procesada`).
  - Actuar sobre un problema ya cerrado devuelve `ya_cerrada`.
  - Actuar fuera de plazo devuelve `jornada_cerrada`.
- **Acceso:**
  - **estudiantes:** solo los matriculados en la sección o el grupo, solo si el maratón está publicado y con la cuenta en regla (`account_ok`);
  - **profesorado de la sección:** modo prueba, también sobre el borrador;
  - **profesorado de la asignatura:** claves del banco (`can_view_keys`);
  - **funciones `svc_*`:** solo `service_role`.
- **Historial:** las presentaciones cerradas, los eventos y las incidencias no se pueden modificar ni borrar, salvo el reinicio del recorrido de **prueba** del profesor.
- **Sin IA** en ninguna operación durante la ejecución.

## 12. Informes

- **Estudiante.** Disponible al terminar la última jornada, o en la fecha configurada. Muestra:
  - jornadas completadas, problemas presentados, intentos válidos, correctas e incorrectas, sustituidos, «no puedo», tiempo;
  - temas abordados, trabajo por tipo de problema, nivel máximo, extremos resueltos y evolución.

  No muestra unidades, ponderaciones ni calificaciones. Se imprime como PDF.
- **Profesor** (exclusivo de la sección):
  - **A.** Rendimiento general, por nivel y por tema.
  - **B.** Recorrido adaptativo (eje X: ejercicio; eje Y: D1–D6), con puntos inspeccionables por tipo de decisión.
  - **C.** Comportamiento: «no puedo» por nivel y su frecuencia relativa, cambios por nivel, tiempo antes de abandonar, rachas, permanencia máxima en D6, entradas a D5–D6, oscilaciones.
  - **D.** Evolución por jornada y por tema.
  - **E.** Historial forense completo: qué problema recibió y cuándo, qué respondió, el procedimiento, el tiempo, la decisión, el nivel antes y después, la siguiente pregunta, los comodines y los eventos.
  - **F.** Exportaciones: CSV resumen, CSV de problemas, CSV de la sección, Excel con cuatro hojas, informe individual en PDF (impresión).
- **Indicadores de consistencia (descriptivos):**
  - aciertos altos en D5–D6 con fallos en D1–D2 del mismo tema;
  - aciertos extremos en menos de la mitad del tiempo mínimo;
  - cambios bruscos de tiempo entre jornadas;
  - jornadas con precisión muy dispar;
  - la misma respuesta en tres o más problemas;
  - rachas de respuestas anticipadas.

  Son **observaciones con sus referencias**: sin puntuación de sospecha y sin detectores de autoría. Siempre van acompañadas del aviso de interpretación.

## 13. Pruebas

| # | Requisito | Dónde se prueba | Resultado |
|---|---|---|---|
| 1–6 | D1→D2, D5→D6, D6→D6, D6→D5, D2→D1, D1→D1 | `maraton_adaptativo.sql` § 3 (servidor); `maraton-motor.test.ts` | ✔ |
| 7 | «No puedo» en todos los niveles | SQL § 4 (D6→…→D1→D1); Vitest | ✔ |
| 8–10 | Cambio sin alterar el nivel; consumo; no superar el máximo | SQL § 5; concurrencia § 4 (6 cambios simultáneos) | ✔ |
| 11–12 | Unidades (12.9 tras 11 respuestas) y cuota | SQL § 3; Vitest | ✔ |
| 13 | Finalización alternativa | SQL § 7; Vitest | ✔ |
| 14 | Límites (intentos, tiempo, presentados) | SQL § 6 y § 8; Vitest | ✔ |
| 15–16 | Recarga y reanudación | SQL § 2 y § 9; concurrencia § 1 | ✔ |
| 17 | Catorce jornadas | SQL § 10 (14 días; el nivel continúa; después termina) | ✔ |
| 18 | Integridad del historial | SQL § 11 | ✔ |
| 19–20 | Privacidad entre estudiantes y entre secciones | SQL § 2, § 10, § 12, § 13 | ✔ |
| 21–22 | Respuestas y parámetros protegidos | SQL § 2; `maraton-handler.test.ts`; `maraton-evaluar.test.ts` | ✔ |
| 23 | Informes | SQL § 10 y § 12; `maraton-indicadores.test.ts` | ✔ |
| 24 | Sin escritura de notas | SQL § 14; `maraton_borrador_fg1.sql`; concurrencia | ✔ |
| 25 | Borrador inaccesible | SQL § 1 y § 13; `maraton_borrador_fg1.sql` (todos los estudiantes reales de la sección, copia de producción) | ✔ |
| 26 | Creación y duplicación | SQL § 1 y § 13 | ✔ |
| 27 | Compatibilidad | `npm run probar` sobre la copia de producción: 86/86 pruebas SQL; `npm run verificar`: 99 archivos, 1 814 pruebas Vitest, compilación y escaneo de secretos | ✔ |
| 28 | Concurrencia | `scripts/maraton/concurrencia.ts`: 300 estudiantes y 40 conexiones; inicio, respuestas, doble envío, comodines, finalización e informes | ✔ |
| 29 | Variantes físicamente válidas | Validación del generador (2 220 variantes); `maraton-banco.test.ts` | ✔ |
| 30 | Consistencia de la dificultad | SQL § 3 (nivel presentado = nivel de la plantilla); banco: tiempos mínimos crecientes, D5–D6 de varias etapas | ✔ |
| — | Muchos D6 no acortan la jornada; el excepcional no queda atrapado | `maraton-motor.test.ts` (simulaciones) | ✔ |

Latencias medidas en local con 300 estudiantes simultáneos y 40 conexiones:

| Operación | p95 |
|---|---|
| Inicio | 0.65 s |
| Respuesta | 0.29 s |
| Cuatro envíos simultáneos del mismo problema | 0.35 s (se cuenta uno) |
| Informe de la sección | 0.37 s |
| Historial individual | 0.06 s |

Son medidas en un PostgreSQL local, no en la instancia de Supabase.

Cómo repetir:

| Prueba | Comando |
|---|---|
| Vitest | `npm run verificar` |
| Base de datos | `npm run probar` |
| Concurrencia | con la base local con la migración aplicada: `MARATON_DB_URL=… ./node_modules/.bin/vite-node scripts/maraton/concurrencia.ts --banco privado/datos/20261114170000_maraton-banco-fg1.sql` |

## 14. Procedimiento de publicación

**A. Instalar en producción** (administrador, en su terminal):
1. `npm run respaldo`
2. `npm run probar`
3. `npm run plan`. Debe listar:
   - la migración `20261114160000_maraton_adaptativo.sql`;
   - la función `maraton` (nueva);
   - los datos privados `…170000_maraton-banco-fg1.sql` y `…170100_maraton-fg1-borrador.sql`.
4. Autorizar el código del plan y ejecutar `npm run aplicar -- --plan XXXX`. Mejor fuera del horario de clase.
5. Publicar el frontend (`git push` a `main`), con autorización.

Después de A, el borrador existe en la sección «Física General 1», sin fecha e invisible. No se envía ninguna notificación ni se crea ninguna nota.

**B. Programar y publicar el maratón** (profesor, en el panel):
1. Panel docente → «Física General 1» → Evaluación → **Maratón adaptativo** → «MARATÓN DE RECUPERACIÓN — FÍSICA GENERAL 1» → **Configurar**.
2. Configuración:
   - fijar la **fecha** y la hora de inicio;
   - revisar las horas diarias;
   - **sustituir el apartado «[PENDIENTE…]»** de las instrucciones por los criterios de la recuperación. Mientras exista, no se puede publicar.
3. Contenido: revisar la matriz de cobertura y las vistas previas. Opcionalmente, validar las plantillas pendientes.
4. Revisión y publicación: **Abrir en modo prueba** y recorrer una jornada; después, «Reiniciar mi prueba».
5. **Publicar para los estudiantes…** Solo se habilita si la revisión no tiene errores.

## 15. Duplicar maratones

Revisión y publicación → Duplicar → elegir la sección de destino y el nombre.

La copia:
- es una instancia **nueva** en borrador;
- tiene la misma configuración;
- no tiene fecha;
- no comparte participantes, respuestas ni estadísticas.

Solo se puede copiar a secciones cuya asignatura esté en `cursos` del banco. El banco FG1 admite FIS-GEN-1 y FIS-GEN-1A.

## 16. Configurar otras secciones y asignaturas

- **Otra sección de FG1 o FG1-A:** «Crear actividad → Maratón adaptativo» en esa sección, o duplicar.
- **Otra asignatura:**
  1. Crear un banco nuevo con el mismo marco: carpeta `privado/maraton/<id>/` con `banco.ts` (temas con evidencia y plantillas con `generar` + `verificar` independiente).
  2. Generarlo con `generar-banco.ts` (los `cursos` se resuelven por código de asignatura).
  3. Aplicar con el procedimiento normal.

  Las tablas, el motor y las páginas no cambian.

## 17. Restaurar una jornada

| Caso | Qué hacer |
|---|---|
| Falla técnica verificable | Informe → estudiante → **Incidencias** → «Reabrir la jornada» con plazo y motivo. El estudiante la ve como «Jornada reabierta hasta…» y la completa antes que la del día |
| Jornada que no debe exigirse | «Justificar la jornada» |
| Jornada cerrada por un límite | Queda para revisión; el profesor la valora con el historial. No se reabre: el límite volvería a cerrarla |

Todo queda en `maraton_incidencias` y `maraton_eventos`, con autor y fecha. Nada se borra.

## 18. Limitaciones conocidas

- **No está aplicado ni publicado.** Las credenciales de producción no son legibles desde el entorno de Claude Code (sandbox) y aplicar requiere autorización expresa. El borrador **no está guardado** en la base de producción.
- La interfaz se comprobó con tipos, compilación y pruebas de la lógica, pero **no se ha probado en un navegador ni en un teléfono** contra un servidor real. La Edge Function se probó como `handler.ts` puro, no en el runtime de Deno.
- **Tiempo activo.** Lo informa el navegador; el servidor lo acota al reloj real y al tope del problema. Un cliente manipulado podría declarar como activo todo el tiempo transcurrido, hasta el tope. El tiempo registrado no prueba que el estudiante estudiara.
- **Las reglas se congelan** cuando hay participantes. Después solo se editan los textos y los informes.
- **No hay «límite de permanencia en D6 por jornada».** Contradiría la regla de no descender por acertar. La vía B y los límites cubren el riesgo de jornadas interminables.
- Las jornadas perdidas no bloquean las siguientes. La continuidad se informa y la decide el profesor.
- El banco y su generador viven en `privado/` (no están en git): conviene incluirlo en las copias de seguridad.
- Cinco plantillas quedan pendientes de revisión (proyectiles, Newton y plano inclinado). Seis temas sin evidencia quedan excluidos.
- Las pruebas SQL usan la fecha del servidor. Ejecutarlas justo a medianoche (hora de Santo Domingo) podría dar un falso fallo.
- El PDF del informe se obtiene con «Imprimir → Guardar como PDF», como en el resto del aula.
- Las pruebas de carga se hicieron en un PostgreSQL local. En la instancia de Supabase el presupuesto de disco puede diferir; el diseño hace una transacción por acción del estudiante y ninguna escritura periódica.

## 19. Manual breve para el profesor

1. **Dónde está.** Panel docente → sección → grupo «Evaluación» → pestaña **Maratón adaptativo**. También en «+ Crear actividad» → tarjeta **Maratón adaptativo**.
2. **Configurar.** Tiene cuatro pestañas:
   - **Configuración:** nombre, instrucciones, fechas, carga, dificultad, comodines, informes y seguridad;
   - **Contenido:** temas del banco y vistas previas con clave, solución y verificación;
   - **Revisión y publicación;**
   - **Informe.**
3. **Antes de publicar**, las instrucciones deben explicar a los estudiantes: duración; continuidad; dificultad adaptativa; cantidad variable de ejercicios; comodines; qué pasa al abandonar o cambiar; duración orientativa; cómo avisar de una incidencia; que el sistema genera informes y no notas; y los **criterios de la recuperación** (los decide usted, iguales para todos).
4. **Probar.** «Abrir en modo prueba» le muestra exactamente lo que ve el estudiante. No aparece en los informes.
5. **Durante el maratón.** Consulte el **Informe**:
   - la cuadrícula de jornadas (✔ completada, ✖ no completada, ⚠ cerrada por límite, J justificada);
   - para cada estudiante, el recorrido, el comportamiento, la evolución y el historial.

   Atienda las incidencias desde «Incidencias».
6. **Al terminar.** Los estudiantes ven su informe descriptivo. Usted exporta CSV, Excel o PDF y decide la recuperación con sus criterios.

   Recuerde: resolver problemas extremos no prueba el uso de ayudas externas; «No puedo» es una autoevaluación; los indicadores son observaciones, no conclusiones.

## 20. Decisiones técnicas

| Decisión | Motivo |
|---|---|
| Motor separado de `activities` | Aislamiento total del registro de notas, de los controles y de los exámenes |
| Variantes **preconstruidas y almacenadas**, no generadas en la ejecución | Permiten revisar cada problema, auditar exactamente qué variante recibió cada estudiante y validar todo antes de publicar. La selección es aleatoria en el servidor |
| Edge Function nueva en lugar de ampliar `calificar` | Desplegarla no toca la función que califica exámenes y prácticas en curso |
| Sin latidos | Ver § 1 (rendimiento) |
| Retroalimentación «ninguna» por defecto | El maratón es evaluativo. Mostrar «correcto/incorrecto» es configurable |
