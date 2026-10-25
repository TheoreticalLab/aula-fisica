# Flujo de trabajo: actualizar el aula con instrucciones a Claude Code

Con este flujo, pides los cambios en lenguaje natural («agrega una asignatura», «añade un campo de observaciones a las notas»…). Claude Code los prepara y los prueba, te enseña exactamente qué va a cambiar en producción y solo los aplica cuando le das tu autorización expresa.

```
  tu instrucción
        │
        ▼
  1. estado ───► 2. cambios en local ───► 3. verificar ───► 4. respaldo + probar ───► 5. plan
                                                                                         │
                                                       te muestra el plan y su código ◄──┘
                                                                     │
                                                    «Autorizo el plan a1b2c3d4»  (solo tú)
                                                                     │
                                                                     ▼
                       6. aplicar: respaldo verificado → migraciones → comprobación de datos → funciones → Auth
                                                                     │
                                                                     ▼
                                     7. publicar la interfaz (git push → GitHub Pages), también con tu autorización
```

## Las órdenes

| Orden | ¿Modifica producción? | Qué hace |
|---|---|---|
| `npm run estado` | No | Compara el código con producción: migraciones, funciones, configuración de Auth, número de filas de cada tabla y git |
| `npm run verificar` | No | Tipos, 400+ pruebas automáticas, compilación, búsqueda de secretos en lo publicable y revisión de las migraciones |
| `npm run respaldo` | No (solo lee) | Copia consistente de todas las tablas (y de las cuentas de Auth) en `privado/respaldos/<fecha>/`, verificada con SHA-256 |
| `npm run probar` | No | Crea una base de datos **local** desechable, carga el último respaldo y aplica las migraciones nuevas. Comprueba que ninguna tabla protegida pierde filas y ejecuta las pruebas de seguridad |
| `npm run plan` | No | Lista lo que se aplicaría y genera un **código de plan**. Si hay operaciones destructivas o las pruebas no están al día, se bloquea |
| `npm run aplicar -- --plan CÓDIGO` | **Sí** | Aplica solo ese plan: si algo cambió desde que lo viste, el código ya no coincide y se detiene |

### Garantías de `aplicar`
- **Respaldo previo:** antes de tocar la base de datos crea un respaldo y lo verifica.
- **Una transacción por migración:** si una falla, se deshace entera y el proceso se para.
- **Comprobación de datos:** al terminar comprueba que estudiantes, matrículas, respuestas y calificaciones siguen todos ahí.
- **Registro:** cada aplicación queda anotada en `privado/estado/historial-aplicaciones.log`.

## Reglas de seguridad del flujo

1. **Migraciones solo aditivas.** Una migración puede añadir tablas, columnas, funciones y políticas, pero no puede borrar tablas, columnas ni datos. La revisión automática bloquea `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `DELETE` sin condición, los cambios de tipo, la desactivación de RLS y los permisos al rol anónimo.
2. **Nunca se edita una migración ya aplicada.** Cada cambio es un archivo nuevo, numerado con fecha y hora.
3. **Credenciales solo en `privado/credenciales.env`.** Esa carpeta está excluida de git. Ni el repositorio ni la página publicada contienen tokens, contraseñas ni la clave `service_role`, y una prueba automática lo vigila.
4. **Tu autorización es por plan.** Decir «sí» a un plan no autoriza el siguiente.

## Configuración inicial (una sola vez)

1. **Herramientas.** En una terminal:
   ```
   sudo apt install -y postgresql
   sudo -u postgres createuser --superuser dirac
   cd /home/dirac/Documents/Apps/Aula_Fisica_Basica && npm install -D pg @types/pg supabase
   ```
2. **Credenciales.** Copia la plantilla:
   ```
   cp scripts/ops/credenciales.ejemplo.env privado/credenciales.env
   ```
   Ábrela con el editor de texto y rellena estos dos valores; pégalos tú, **no en el chat**:
   - `SUPABASE_ACCESS_TOKEN`: créalo en <https://supabase.com/dashboard/account/tokens>.
   - `SUPABASE_DB_URL`: en Supabase, botón **Connect** → **Session pooler** → la URI. Sustituye `[YOUR-PASSWORD]` por la contraseña de la base de datos. Si no la recuerdas: **Project Settings → Database → Reset database password**.
3. **Comprobación.** Pide a Claude «revisa el estado» (ejecuta `npm run estado`).

## Restaurar datos si algo saliera mal

Los respaldos de `privado/respaldos/` contienen cada tabla en JSON, más un manifiesto con el número de filas y su huella. Para restaurar, pide a Claude que prepare la restauración: la probará antes en local y te pedirá autorización.

**Guarda copia de la carpeta `privado/` fuera del equipo** (por ejemplo, en un disco externo cifrado). Contiene datos personales y hashes de contraseñas: no la subas a servicios públicos.
