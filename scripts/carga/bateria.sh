#!/usr/bin/env bash
# Batería de pruebas de carga (copia LOCAL; nunca producción): antes/después alternados para cada número de
# estudiantes, en carga sostenida y en entrada simultánea, y una prueba larga con 15 estudiantes.
# Uso (desde la raíz del proyecto): bash scripts/carga/bateria.sh <sostenida|entrada|larga|todo> [minutos_sostenida] [minutos_larga]
# Requisitos: node privado/tmp/probar-local.mjs (copia del respaldo) y vite-node scripts/carga/preparar.ts.
set -u
PARTE=${1:-todo}
MS=${2:-5}
ML=${3:-30}
VN=./node_modules/.bin/vite-node
pkill -f "postgres -D privado/tmp/pgprueba" 2>/dev/null; sleep 1
if [ "$PARTE" = sostenida ] || [ "$PARTE" = todo ]; then
  for n in 1 5 10 15 20 25 50; do
    for p in antes despues; do
      $VN scripts/carga/simular.ts -- $p sostenida $n $MS $p-sostenida-$n 2>&1 | tail -1
    done
  done
fi
if [ "$PARTE" = entrada ] || [ "$PARTE" = todo ]; then
  for n in 5 10 15 25 50; do
    for p in antes despues; do
      $VN scripts/carga/simular.ts -- $p entrada $n 2 $p-entrada-$n 2>&1 | tail -1
    done
  done
fi
# orden de despliegue: las cuatro combinaciones navegador × base, 15 estudiantes, con pestañas ocultas mucho rato y
# temporizadores estrangulados (peor caso para la caducidad de la presencia)
if [ "$PARTE" = orden ]; then
  for fe in antes despues; do
    for bd in antes despues; do
      BD=$bd ESTRANGULAR=1 $VN scripts/carga/simular.ts -- $fe sostenida 15 8 orden-fe_$fe-bd_$bd 2>&1 | tail -1
    done
  done
fi
# perfil «después» completo (navegador + migraciones 87 y 88) con 5–50 estudiantes, para comparar con «antes»
if [ "$PARTE" = final ]; then
  for n in 5 10 15 25 50; do
    $VN scripts/carga/simular.ts -- despues sostenida $n $MS despues88-sostenida-$n 2>&1 | tail -1
  done
fi
if [ "$PARTE" = larga ] || [ "$PARTE" = todo ]; then
  $VN scripts/carga/simular.ts -- despues sostenida 15 $ML despues-larga-15 2>&1 | tail -1
fi
echo "BATERÍA ($PARTE) TERMINADA"
