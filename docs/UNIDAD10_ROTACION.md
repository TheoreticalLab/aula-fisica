# Unidad 10. Rotación del cuerpo rígido y momento angular

Unidad nueva de Física General I (y IA), posición 10, slug `rotacion-momento-angular`. Se instala con estado
**preparado**: los estudiantes no la ven hasta que el profesor la publique desde el panel.

## Programa

| | Minicapítulo | Simulador |
|---|---|---|
| 10.1 | Cinemática de la rotación | `circular` |
| 10.2 | Relación entre magnitudes lineales y angulares | `circular` |
| 10.3 | Energía cinética de rotación y momento de inercia | — |
| 10.4 | Momento de inercia de cuerpos continuos y ejes paralelos | — |
| 10.5 | Torque | — |
| 10.6 | Segunda ley de Newton para la rotación | `polea-masiva` |
| 10.7 | Equilibrio estático del cuerpo rígido | — |
| 10.8 | Trabajo, potencia y energía en la rotación | `polea-masiva` |
| 10.9 | Rodadura sin deslizamiento | `rodadura` |
| 10.10 | Momento angular de una partícula y de un cuerpo rígido | — |
| 10.11 | Torque y cambio del momento angular | — |
| 10.12 | Conservación del momento angular | `momento-angular` |
| 10.13 | Choques con rotación | — |
| 10.14 | Introducción a la precesión y el giroscopio | — |
| 10.15 | Práctica integradora | varios |

## Piezas

| Pieza | Archivo |
|---|---|
| Motor físico (inercias, ejes paralelos, cinemática con α constante, torque, rodadura, polea con masa, conservación de L, plataforma, choque con barra, precesión) | `src/lib/fisica/rotacion.ts` · pruebas `tests/fisica-rotacion.test.ts` |
| Simuladores | `src/sims/Rodadura.tsx`, `src/sims/MomentoAngular.tsx`, `src/sims/PoleaMasiva.tsx` (fichas en `src/sims/catalogo.ts`) |
| Contenido (privado: contiene claves) | `privado/biblioteca/mecanica/u10-rotacion/` · guía `privado/biblioteca/mecanica/GUIA-ROTACION.md` |
| Validación | `vite-node scripts/biblioteca/validar-unidad.ts privado/biblioteca/mecanica u10-rotacion` |

## Instalación

1. `privado/biblioteca/mecanica/curso.ts`: `'u10-rotacion'` en `unidades` (después de `u09-choques`).
2. `./node_modules/.bin/vite-node scripts/generar-curso.ts privado/biblioteca/mecanica` → `privado/datos/<marca>_biblioteca-mecanica.sql`.
3. `npm run respaldo` → `npm run probar` → `npm run plan` → autorización → `npm run aplicar -- --plan CÓDIGO`.
4. Publicar el frontend (simuladores nuevos) con `git push` autorizado.
5. Panel docente → Asignaturas y contenido → publicar la Unidad 10 cuando se quiera abrir a los estudiantes.
