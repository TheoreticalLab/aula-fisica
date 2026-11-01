# Examen adaptativo (migración 53)

Una evaluación puede administrarse de forma adaptativa: cada estudiante recibe las preguntas **una a una**, elegidas
del banco calibrado de la evaluación según sus respuestas. Se configura en la actividad → Modo de examen → «Examen
adaptativo».

## Requisitos

- Evaluación (no práctica), sin intentos todavía (después la configuración no cambia).
- Al menos **15 preguntas calibradas** (TRI 2PL) entre las de la evaluación. Se calibran en LIEIA → Calibración de ítems
  con exámenes ya aplicados. Opcionalmente se admiten las de calibración provisional.
- Activarlo fija «una pregunta a la vez» y «solo hacia adelante» (se conservan duración y pausas).

## Cómo funciona

1. **Al empezar** se copia la calibración del banco en el intento (`exam_adaptive_pool`): la selección y la nota de ese
   intento no cambian aunque las preguntas se recalibren después. Primera pregunta: la de máxima información en θ = 0.
2. **Al pulsar «Siguiente»** en la última pregunta asignada, el navegador espera a que la respuesta esté guardada y llama a
   `calificar` (acción `adaptativo`). La función califica en el servidor las respuestas dadas (incluidas las variantes
   por intento) **sin devolver el resultado** y `svc_adaptativo_siguiente`:
   - estima la habilidad θ por EAP (a priori normal estándar, rejilla de −4 a 4 cada 0,1; el crédito parcial o manual
     entra como verosimilitud P^c (1 − P)^(1−c), con P = 1 / (1 + e^(−a(θ − b))));
   - decide si termina: máximo de preguntas, o mínimo alcanzado y error típico de θ ≤ el objetivo, o banco agotado;
   - si no, asigna la pregunta de máxima información de Fisher a²P(1 − P) en θ entre las restantes, eligiendo entre las k
     mejores con una semilla del intento («randomesque», control de exposición reproducible);
   - es idempotente: repetir la llamada (doble clic, red) devuelve la misma siguiente pregunta.
3. **Nota.** El número de aciertos no es comparable entre estudiantes que vieron preguntas de distinta dificultad. La
   nota es `puntuación máxima × dominio`, donde **dominio** = proporción de aciertos esperada en TODO el banco con el θ
   final (curva característica del banco). Se recalcula al entregar y con cada calificación manual (`recompute_attempt`).
   El profesor ve θ, su error típico y el dominio en el estado del intento; el estudiante, su nota cuando se publique.

## Garantías y límites

- El estudiante no recibe nunca si acertó: solo qué pregunta sigue. Aun así, la dificultad de la siguiente pregunta da
  una pista indirecta (propio de cualquier examen adaptativo).
- «Solo hacia adelante» con la gracia de 10 s del motor: un cambio de respuesta en esos segundos cuenta para la nota final
  (que usa las respuestas definitivas) aunque la selección se hiciera con la anterior.
- Si se entrega antes de terminar (o vence el tiempo), la nota usa solo lo respondido; las no respondidas cuentan como
  incorrectas.
- La calidad depende de la calibración: con bancos calibrados con pocos estudiantes, la precisión real es menor que la
  nominal. Validación en este repositorio solo con datos sintéticos.

## Pruebas

- `supabase/pruebas/examen_adaptativo.sql`: permisos y requisitos; una sola pregunta al empezar (la de b ≈ 0); EAP del
  servidor igual a una implementación independiente (1e−6); tras acertar la siguiente es más difícil y tras fallar más
  fácil; idempotencia; fin al máximo; nota = máximo × dominio (no los aciertos); el crédito manual cambia la nota; una
  recalibración posterior no; la configuración se bloquea con intentos.
- `tests/examen-adaptativo.test.ts`: orden creciente en el motor del cliente y acción `adaptativo` (créditos calculados en
  el servidor, también con variantes; nada de aciertos en la respuesta).
