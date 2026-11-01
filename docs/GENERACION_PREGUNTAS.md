# Generación de preguntas con IA para el banco (migración 55)

**Dónde:** Banco de ejercicios → «✨ Generar con IA» (o Panel docente → Herramientas). Ruta `/docente/generar-preguntas`.
**Quién:** el profesorado de la asignatura (personal de la asignatura o profesor de alguna de sus secciones) y la
administración.

## Flujo

1. **Asignatura y temas:** se eligen lecciones (por unidad o una a una). Para cada lección se ve cuántas preguntas
   básicas, intermedias y desafiantes tiene ya el banco.
2. **Cantidad, niveles y formatos:** N preguntas (1 a 300; atajos 10, 25, 50, 100, 200), mezcla de niveles (por defecto
   30/50/20 %) y de formatos (numérica 60 %, selección 30 %, verdadero/falso 10 %). Las N se reparten por igual entre las
   lecciones (método del mayor resto) y niveles y formatos se intercalan para que cada lección reciba una mezcla.
3. **Coste estimado, antes de empezar:** preguntas, llamadas (lotes de 4 preguntas de una misma lección), tokens,
   **coste estimado y máximo posible** en US$ con los precios del modelo configurado en Orbe IA, coste por pregunta,
   presupuesto restante del mes y llamadas restantes hoy, con avisos si no cabe. Con las llamadas reales apagadas se
   generan preguntas de **simulación** sin coste, para probar el flujo. Si son reales, se pide confirmación con el coste.
4. **Generación por lotes** con barra de progreso y botón para detener. Se detiene sola si Orbe IA se apaga, se agota el
   presupuesto o el límite diario, o fallan tres lotes seguidos. Al final se muestran el **coste real**, lo creado, lo
   rechazado y por qué.
5. **Revisión:** todo queda como **borrador del banco** (no publicado, papel «bank», slug `ia-…`), con su clave, pistas y
   explicación, listo para revisar en el editor de ejercicios. Nada entra solo en una práctica o evaluación.

## Verificación en el servidor (capa C)

| Formato | Qué se comprueba | Etiqueta |
|---|---|---|
| Numérica | Datos con unidades que **aparecen en el enunciado**; fórmula (gramática cerrada) evaluada en SI con **análisis dimensional** (sumas coherentes, funciones con argumento adimensional, raíces pares); dimensiones de la fórmula = las de la unidad del resultado; resultado declarado = cálculo (≤ 1 %); la clave la construye el servidor con el valor recalculado y el motor de calificación debe aceptarla; errores típicos de la misma dimensión, fuera de la tolerancia | **cálculo comprobado** (aritmética y unidades; el planteamiento físico lo revisa el profesor) |
| Selección | 3–5 opciones distintas, índice correcto válido, retroalimentación para cada incorrecta | **revisar** |
| Verdadero/falso | valor y justificación modelo suficiente | **revisar** |
| Todas | enunciado 30–1500 caracteres sin HTML peligroso, pistas, explicación, conceptos de la lección (los ajenos se descartan), sin repetir enunciados existentes ni del mismo lote | — |

Lo rechazado no se guarda y se cuenta con su motivo.

## Privacidad y gasto

- Claude recibe solo títulos y resúmenes de lecciones, nombres de conceptos y el comienzo (160 caracteres) de hasta 30
  enunciados existentes para no repetirlos. Nunca claves de respuesta ni datos de estudiantes.
- Usa Orbe IA (propósito «generar»): interruptor general, llamadas reales o simulador, presupuesto mensual y límite diario
  comunes; el consumo aparece en Orbe IA → Consumo. Cada llamada reserva el coste máximo antes de ejecutarse y se rechaza
  si superaría el presupuesto.
- Esfuerzo de razonamiento «medio» (las preguntas de física lo necesitan más que los mensajes cortos).

## Estimación del coste

Por lote: ≈ 3000 tokens de entrada (instrucciones, lección, enunciados existentes) y 650 de salida por pregunta + 800 de
razonamiento; máximo: 4500 de entrada y el límite de salida (≤ 4000). Coste = tokens × precio por millón. Con Claude
Opus 5.5 (4 / 20 US$), 100 preguntas en 26 llamadas ≈ US$ 2,0 estimados (78 000 tokens de entrada ≈ US$ 0,31 y
85 800 de salida ≈ US$ 1,72; máximo posible ≈ US$ 2,5). Con Haiku 5.5 (0,1 / 0,5 US$) serían unos US$ 0,05. Es una estimación: el
coste real se registra con los tokens que factura la API.

## Pruebas

`tests/generacion.test.ts` (reparto, lotes, coste, análisis dimensional, verificación de cada formato, simulador con 97
semillas, flujo de un lote con el servidor simulado) y `supabase/pruebas/generacion_preguntas.sql` (permisos, contexto
sin claves, borradores no publicados, nunca más de lo pedido, lecciones ajenas rechazadas).

## Límites

- La comprobación numérica garantiza coherencia aritmética y dimensional, no que el planteamiento físico sea el adecuado
  (una fórmula equivocada pero dimensionalmente correcta pasaría): por eso todo queda como borrador para revisar.
- Sin figuras ni simulaciones; sin preguntas de desarrollo.
- Probado solo con el simulador: falta probar con la API real.
