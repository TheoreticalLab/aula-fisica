# Regularización de prácticas anteriores mediante evidencias

Sirve para reconstruir las prácticas que los estudiantes entregaron **antes** del aula virtual (por correo u otra vía).
El estudiante no vuelve a subir el trabajo: declara qué práctica entregó, por qué medio, cuándo y desde qué cuenta, y
adjunta **una captura de pantalla del envío** (más, opcionalmente, dos complementarias). El profesor usa esos datos para
encontrar el mensaje original en su propio correo, verificarlo y, si procede, convalidar la práctica.

- La plataforma **no se conecta** al correo del profesor ni pide permisos de acceso: genera un texto de búsqueda para copiar y pegar.
- **No se piden** PDF, documentos de Word ni copias de los trabajos. El servidor rechaza cualquier archivo que no sea una imagen real.
- Las capturas **no se envían** a ningún servicio de inteligencia artificial ni a otros servicios externos.
- **Ninguna acción crea notas.** Declarar, convalidar y calificar son tres cosas distintas.

## Piezas

| Pieza | Archivo |
|---|---|
| Esquema y reglas (aditivo) | `supabase/migrations/20261101000045_regularizacion_practicas.sql` |
| Pruebas SQL (casos 1–3, 5–13) | `supabase/pruebas/regularizacion.sql` |
| Subida, consulta y borrado de capturas | `supabase/functions/entregas/capturas.ts` (dentro de la función `entregas`, que ya subía los PDF) |
| Optimización de imágenes en el navegador | `src/lib/imagen.ts` |
| Reglas puras (formulario, búsqueda, sugerencias, filtros) | `src/lib/regularizacion.ts` |
| Acceso a datos | `src/api/regularizacion.ts` |
| Estudiante | `src/pages/estudiante/Regularizacion.tsx` → **Mi cuenta → Prácticas anteriores** (`/practicas-anteriores`) |
| Profesor | `src/pages/docente/Regularizacion.tsx` → **Panel docente → Prácticas anteriores** (todas las secciones) y pestaña **Prácticas anteriores** de cada sección |
| Pruebas Vitest | `tests/regularizacion.test.ts` (caso 4 y reglas), `tests/regularizacion-capturas.test.ts` (servidor de capturas) |

### Datos (PostgreSQL)

| Tabla | Contenido |
|---|---|
| `hist_settings` | Por sección: abierta o no (nace cerrada), mensaje, margen de búsqueda (7 días), máximo por captura ya optimizada (2 MB), espacio reservado (300 MB), registros por estudiante (40) |
| `hist_practices` | Catálogo histórico por sección. Al activar: 10 posiciones **provisionales** (una estimación). El profesor las titula, añade, archiva, une o vincula a una actividad |
| `hist_declarations` | Una declaración por práctica y estudiante: tipo (`evidencia` o `incidencia`), tema, descripción, fecha **declarada** (o «no recuerdo»), medio, correo remitente u otra vía + contacto, estado y, por separado, quién y cuándo localizó, verificó y convalidó |
| `hist_captures` | Solo **metadatos**: ruta privada, formato, bytes, ancho, alto, SHA-256 de lo guardado y (declarado por el navegador) SHA-256 y tamaño del archivo original. **Sin columnas binarias** |
| `hist_suggestions` | «Profesor, recuerdo otra práctica»: tema, descripción, fecha aproximada, comentarios, total estimado |
| `hist_events` | Historial: quién, cuándo, de qué estado a cuál, con nota. Solo se añade |

Las tablas no tienen permisos directos (RLS activada, sin políticas): todo pasa por funciones `hist_*` que comprueban el
papel con `auth.uid()`. Las funciones `svc_hist_*` solo las puede llamar la función `entregas` (service_role).

### Imágenes (almacenamiento privado `regularizacion`)

- Ruta: `<sección>/<estudiante>/<sha256>.<webp|jpg|png>`. La misma imagen del mismo estudiante se guarda **una sola vez**
  aunque la use en varias declaraciones (una captura de un correo que entregaba dos prácticas). Nunca se comparten
  archivos entre estudiantes: la ruta incluye al estudiante.
- Ver una captura: enlace firmado de **5 minutos**, solo para el autor, el profesorado de la sección, el personal del
  curso o el administrador. No hay enlaces públicos permanentes.
- Al reemplazar o quitar una captura, o al eliminar un borrador, se borra el archivo si ya nadie lo usa.
- Cuota por sección configurable; el profesor ve el espacio usado por su sección y por todo el módulo.

### Optimización en el navegador (antes de subir)

1. Se lee la imagen (respetando la orientación) y se vuelve a codificar: esto **elimina los metadatos** (EXIF, ubicación GPS).
2. Formato WebP si el navegador sabe codificarlo; si no, JPEG.
3. Escalones: lado corto a 1440 px (si era mayor) con calidad 0,85 → 0,75 → 0,65; después lado corto 1080 px con 0,8 → 0,7 → 0,6.
   Se queda con el primero que pese ≤ 400 KB.
4. **Legibilidad primero**: nunca baja de 1080 px de lado corto (ni amplía imágenes pequeñas) ni de calidad 0,6. Si una
   captura larga no llega a 400 KB con esos mínimos, se acepta más grande; solo se rechaza si supera el máximo de la
   sección (2 MB por defecto), con el consejo de recortarla o dividirla.
5. El servidor vuelve a comprobar que es una imagen real por su firma (no por la extensión), lee sus dimensiones
   (mínimo 200 px por lado) y calcula el SHA-256.

## Estados

| Estado | Significado | Lo decide |
|---|---|---|
| Borrador | Guardado, aún no enviado | estudiante |
| Registrada (pendiente de verificación) | Enviada con medio y captura principal (o motivo, si es incidencia) y la declaración aceptada | estudiante |
| Localizada | El profesor encontró el mensaje original en el canal indicado | profesor |
| Verificada | El mensaje original corresponde a la práctica y contiene la entrega. **Exige** haberla localizado | profesor |
| Convalidada | Reconocimiento oficial de la entrega histórica. **Exige** verificada. No crea nota | profesor |
| No localizada | No se encontró el envío | profesor |
| Aclaración solicitada | El estudiante recibe un aviso (Centro de Comunicación), corrige y responde; vuelve a «registrada» | profesor (nota obligatoria) |
| Observada | Hay una inconsistencia que requiere revisión | profesor (nota obligatoria) |

- El estudiante puede corregir mientras el profesor no haya actuado (y cuando le piden una aclaración). Desde la primera
  acción del profesor, el registro queda bloqueado para el estudiante.
- «Revertir convalidación» (con nota) y «Volver a pendiente» deshacen errores; todo queda en el historial.
- Una **incidencia** (perdió la evidencia) se ve aparte y se trata igual, pero nunca cuenta sola como entrega acreditada.

## Lo que el sistema NO hace

- No interpreta las posiciones provisionales sin declarar como prácticas no entregadas ni crea ceros.
- No convierte sugerencias en actividades oficiales: confirmar una sugerencia solo añade una práctica al catálogo histórico.
- No crea ni modifica notas. Una práctica puede vincularse a una actividad de la sección (una actividad, una práctica
  como máximo); la ficha muestra «Declarada · Convalidada · Calificada» por separado. Cualquier nota la pone el profesor
  en el Registro de Calificaciones, según las reglas académicas.
- No presenta coincidencias como pruebas: si la misma imagen exacta aparece en registros de otros estudiantes, la ficha
  lo señala como observación para revisar.

## Manual breve

**Profesor.** Sección → pestaña **Prácticas anteriores** → «Activar y abrir con 10 prácticas provisionales» (o «Preparar
sin abrir»). En **Catálogo y configuración** puede titular las prácticas, cambiar la cantidad, unir dos posiciones que
resultaron ser la misma, vincular con una actividad y ver el almacenamiento. En **Localizador** filtre (por ejemplo,
«Correo» + «Por localizar»), abra la ficha, copie el texto de búsqueda en su correo, localice el mensaje y marque
**Localizada**, luego **Verificada** y, si procede, **Convalidar**. Puede aplicar una acción a varios registros a la vez.
En **Sugerencias** verá agrupadas las prácticas que los estudiantes recuerdan y cuántas creen que hubo.

**Estudiante.** Mi cuenta → **Prácticas anteriores** → «+ Registrar una práctica»: 1) elegir la práctica, 2) indicar el
medio y la fecha, 3) adjuntar la captura del envío (no el documento), 4) aceptar la declaración y **REGISTRAR EVIDENCIA**.
Puede guardar borradores y registrar varios a la vez. Si perdió la captura: «Perdí la captura del envío». Si recuerda
otra práctica o cree que hubo más de diez: «Profesor, recuerdo otra práctica».

## Despliegue

1. `npm run respaldo` y `npm run probar` → debe aparecer `regularizacion.sql: PRUEBAS PASARON` (y no se pierden filas).
2. `npm run plan` → la migración 45 y la función `entregas`. Autorización del administrador.
3. `npm run aplicar -- --plan CÓDIGO`.
4. `git push origin main` (frontend).
5. Prueba real: con un teléfono, registrar una práctica con una captura grande y comprobar en la ficha del profesor el
   tamaño final, la legibilidad y el texto de búsqueda.

**Reversión:** cerrar la regularización en la sección (los estudiantes dejan de poder registrar; nada se borra). Las
tablas y las capturas quedan como estaban. La función `entregas` anterior puede volver a desplegarse sin efecto sobre
los PDF.

## Pruebas (resultado real)

- Vitest: `tests/regularizacion.test.ts` (20) y `tests/regularizacion-capturas.test.ts` (12) **pasan**; suite completa 975/975.
  Cubren el caso 4 (optimización con codificador simulado: objetivo, mínimos de legibilidad, capturas largas), 2, 3, 5,
  6, 9, 11 (enlace denegado sin firmar nada), 12 (ningún argumento a la base lleva bytes) y 13.
- SQL: `supabase/pruebas/regularizacion.sql` cubre los casos 1–3 y 5–13 contra la base. **Pendiente de ejecutar** con
  `npm run probar` (en esta sesión no hay acceso a PostgreSQL).
- Sin probar todavía en un navegador real ni en teléfonos (lienzo, WebP, subida a Supabase Storage).
