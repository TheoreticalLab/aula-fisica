"""Capturas del rediseño (portada y panel del estudiante con datos de ejemplo) desde el servidor de desarrollo.

    python3 pruebas/capturas_rediseno.py      (requiere vite en http://127.0.0.1:5173/)
"""
import os
import subprocess

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'pruebas', 'capturas')
BASE = 'http://127.0.0.1:5173/'
MOVIL = '412,4600'
ESCRITORIO = '1366,3000'
CASOS = [
    ('rediseno-portada-movil', '', MOVIL, False),
    ('rediseno-portada-movil-oscuro', '', MOVIL, True),
    ('rediseno-portada-escritorio', '', ESCRITORIO, False),
    ('rediseno-panel-movil', 'pruebas/vista-previa/panel.html', MOVIL, False),
    ('rediseno-panel-movil-oscuro', 'pruebas/vista-previa/panel.html?tema=oscuro', MOVIL, True),
    ('rediseno-panel-escritorio', 'pruebas/vista-previa/panel.html', '1366,1700', False),
    ('rediseno-panel-vacio-movil', 'pruebas/vista-previa/panel.html?vacio=1', '412,1100', False),
]

os.makedirs(SALIDA, exist_ok=True)
for nombre, ruta, tam, oscuro in CASOS:
    destino = os.path.join(SALIDA, nombre + '.png')
    if os.path.exists(destino):
        os.remove(destino)
    perfil = os.path.join(RAIZ, 'pruebas', '.perfil_chrome' + ('_oscuro' if oscuro else ''))
    args = ['google-chrome', '--headless=new', f'--user-data-dir={perfil}', '--no-first-run', '--hide-scrollbars',
            f'--window-size={tam}', '--virtual-time-budget=15000', f'--screenshot={destino}']
    if oscuro:
        args += ['--force-dark-mode', '--blink-settings=preferredColorScheme=0']
    else:
        args += ['--blink-settings=preferredColorScheme=1']
    subprocess.run(args + [BASE + ruta], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
    print(nombre, 'ok' if os.path.exists(destino) else 'FALLÓ')
