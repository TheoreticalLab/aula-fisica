"""Capturas de la versión publicada en GitHub Pages (móvil), con Chrome sin pantalla.

    python3 pruebas/capturas_publicada.py
"""
import os
import subprocess

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'pruebas', 'capturas')
PERFIL = os.path.join(RAIZ, 'pruebas', '.perfil_chrome')
import sys

# Con «local» como argumento captura el servidor de desarrollo en lugar de la versión publicada.
LOCAL = len(sys.argv) > 1 and sys.argv[1] == 'local'
BASE = 'http://127.0.0.1:5173/' if LOCAL else 'https://orbefrancisco.github.io/aula-fisica-basica/'
PREFIJO = 'local' if LOCAL else 'publicada'
CASOS = [(f'{PREFIJO}-inicio', ''), (f'{PREFIJO}-activar', '#/activar'), (f'{PREFIJO}-ingresar', '#/ingresar')]

os.makedirs(SALIDA, exist_ok=True)
for nombre, ruta in CASOS:
    destino = os.path.join(SALIDA, nombre + '.png')
    subprocess.run(['google-chrome', '--headless=new', f'--user-data-dir={PERFIL}', '--no-first-run', '--hide-scrollbars',
                    '--window-size=412,900', '--virtual-time-budget=10000', f'--screenshot={destino}', BASE + ruta],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
    print(nombre, 'ok' if os.path.exists(destino) else 'FALLÓ')
