# Clases impartidas (migración 66)

> La teoría oficial describe el contenido estructurado de la asignatura. Las clases impartidas documentan lo que
> realmente se trabajó en el aula. La IA reconstruye y amplía el contenido visible, pero no sustituye la evidencia
> original ni la aprobación del profesor.

## 1. Diagnóstico y decisiones (2 de noviembre de 2026)

| Necesidad | Qué existía | Decisión |
|---|---|---|
| Subir fotos de forma segura | Canal de la regularización (Edge Function `entregas`: tipo real por bytes mágicos, SHA-256, rutas del servidor, URLs firmadas, buckets privados creados por el servidor; sin políticas de `storage.objects`) | **Reutilizado** con un bucket nuevo `archivo-clases` |
| Optimizar en el dispositivo | `src/lib/imagen.ts` (orientación, recodificación sin EXIF, WebP/JPEG) ajustado a capturas | Variante **pizarra**: lado corto 1600 px (mín. 1200), calidad ≥ 0,75, miniatura de 320 px |
| Claude | Orbe IA (`orbe-ia`): SDK oficial, clave solo en el servidor, interruptor, simulador, presupuesto mensual, límite diario, reservas | **Reutilizado**: propósito «clase», imágenes en base64 y respuesta larga por streaming |
| Modelos y precios | Un modelo y un precio globales en `orbe_ia_config` | **Registro verificado** `orbe_ia_modelos` (Haiku/Sonnet/Opus 5.5, imágenes, tarifas con fecha de vigencia) + comprobación en vivo con la API de modelos |
| Matemáticas | `Markdown` (react-markdown + remark-math + rehype-katex, sin HTML crudo) | **Reutilizado** para la clase ampliada |
| Apartado exacto de una lección | Sin identificadores en los títulos; HashRouter ocupa el «#» | Parámetro `?a=` y desplazamiento al título que coincide (`elegirEncabezado`) |
| Monitores | `class_monitors` + `is_class_monitor` | Habilitación por sección (`class_archive_settings.monitores_suben`) |
| Navegación | «Aprender» → `/temario` (6 entradas en la barra móvil) | Pestañas «Estudiar teoría | Clases impartidas» dentro de Aprender; rutas existentes intactas |
| Migraciones | Última aplicada: 65 (`control_por_defecto`, aplicada el 2 nov 12:49 UTC) | Nueva: **66** |

## 2. Modelo de datos

`class_sessions` (estado de las fotos independiente), `class_session_images` (1–4, orden con restricción diferible),
`class_ai_generations` (modelo exacto, tokens, costo, `request_id` único), `class_ai_versions` (versiones; una sola
publicada; editar o regenerar crea un borrador), `class_resource_links` (lección/unidad/ejercicio/simulador/brecha, con
claves foráneas y validación de curso y apartado), `class_audit_events`, `class_upload_delegates`, `class_archive_settings`,
`class_ai_prefs`, `orbe_ia_modelos`. Todas con RLS y **sin permisos directos**: solo funciones.

## 3. Permisos (en el servidor)

| Acción | Profesor/admin | Monitor habilitado | Estudiante delegado | Estudiante |
|---|---|---|---|---|
| Registrar clase y subir fotos | ✔ | ✔ (su sección) | ✔ (su sección, hasta el vencimiento) | ✘ |
| Editar su envío no publicado | ✔ (cualquiera) | ✔ (el suyo) | ✔ (el suyo) | ✘ |
| Aprobar/rechazar/retirar fotos | ✔ | ✘ | ✘ | ✘ |
| Generar con IA, editar, publicar la ampliada | ✔ | ✘ | ✘ | ✘ |
| Ver fotos pendientes o borradores | ✔ | solo lo suyo | solo lo suyo | ✘ |
| Ver lo publicado de su sección | ✔ | ✔ | ✔ | ✔ (haya asistido o no) |

Delegar no convierte al estudiante en monitor ni en administrador. Un estudiante de otra sección no ve archivos ni metadatos.

## 4. Dos procesos, dos aprobaciones

- **A · Fotos**: registrar → subir → enviar (pendiente) → el profesor aprueba o rechaza (puede corregir datos, sección y orden).
  Las fotos aprobadas se ven aunque no exista versión ampliada.
- **B · IA**: botón «Generar clase ampliada con IA» → diálogo (modelo, nivel, instrucciones, estimación del costo en USD
  típica y máxima, confirmación) → borrador → revisión y edición → «Aprobar y publicar clase ampliada».
  Nunca se ejecuta al subir fotos. Regenerar o editar no sustituye lo publicado.

## 5. Generación (Edge Function `orbe-ia`, acción `clase_generar`)

1. Estimación con las fotos reales y la tarifa del modelo (`_shared/clases/estimacion.ts`).
2. `svc_clase_ia_iniciar`: permiso de profesor de la sección, modelo del registro activo y con imágenes, idempotencia por
   `request_id` (doble clic o reintento de red = la misma generación), una sola en curso por clase (las de más de 15 min
   se cierran como «interrumpidas»), reserva en Orbe IA con el propósito «clase» y comprobación del presupuesto con la
   estimación máxima del modelo elegido.
3. En segundo plano (`EdgeRuntime.waitUntil`): lee las fotos del bucket en el servidor, las envía en orden («Pizarra n
   de N») como datos no confiables, con el contexto real (asignatura, sección, temas, unidades, lecciones con sus
   apartados, ejercicios y simuladores) y salida JSON por esquema.
4. `svc_clase_ia_finalizar`: costo real con los tokens facturados y la tarifa del modelo; borrador nuevo; enlaces
   validados (los identificadores inventados se descartan y se cuentan); nunca dos veces.
5. Simulador (Orbe IA con `api_real = false`): todo el flujo sin coste ni llamadas.

Contenido (decisión del profesor, 2 nov 2026): primero una «Nota sobre la lectura de las pizarras» con lo que no se lee
con seguridad («en la pizarra 2 se observa…; si fuera…, el procedimiento es el mismo sustituyendo…»); después el texto
LIMPIO con la lectura más probable (sin marcas «(dudoso)» ni «(inferido)»): tema, lo trabajado en cada pizarra, explicación,
desarrollo paso a paso, ejemplos, ampliaciones (separadas de lo trabajado en clase), errores frecuentes y conclusiones.
Se presenta solo como «Clase ampliada», sin aviso de IA.
Se depura: sin HTML, imágenes ni enlaces web.

## 6. Configuración necesaria

- `ANTHROPIC_API_KEY` en los secretos de las Edge Functions (ya existe para Orbe IA).
- Orbe IA encendido y con `api_real = true` para generar de verdad (si no, simulador).
- Tarifas: `orbe_ia_modelos` (administrador: `orbe_ia_modelo_actualizar`) con fecha de vigencia. Modelo por defecto de las
  clases: `orbe_ia_config.clase_model` (Sonnet); cada profesor puede guardar su preferido.
- El bucket `archivo-clases` lo crea la Edge Function en la primera subida (privado, 8 MB, WebP/JPEG/PNG).

## 7. Despliegue

`npm run plan` → migración 66 + funciones `entregas` y `orbe-ia` (y las demás que comparten `_shared`) → autorización →
`aplicar` → `git push` (aula y Orbe Control).

## 8. Limitaciones y pendientes

- **No se probó en navegador ni en teléfono** (sin Chrome en el entorno); tampoco una llamada real a Claude (las pruebas
  usan simulaciones de la API, como exige la especificación).
- Tiempo de ejecución: la generación corre en segundo plano dentro del límite de la Edge Function (unos 150 s en el plan
  gratuito, 400 s en los de pago). Un nivel «exhaustivo» con Opus podría superarlo: quedaría «interrumpida» y se puede
  reintentar con otro nivel o modelo.
- Recorte de fotos dentro de la plataforma: no implementado (se advierte y se recorta en el teléfono).
- Detección automática de rostros: no implementada (advertencia y revisión del profesor).
- Añadir a mano enlaces de tipo ejercicio o simulador: no implementado (sí lección con apartado, unidad y brecha).
- Exportación a PDF: vista de impresión del navegador («Guardar como PDF»).
- Retención: las fotos de clases no publicadas se borran al eliminar la clase; las publicadas forman parte del registro
  histórico (se retiran, no se borran).
