"""Capturas de pantalla de la vista previa con Chrome sin pantalla (requiere «npm run dev -- --port 5199»).

    python3 pruebas/capturas.py
"""
import os
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'pruebas', 'capturas')
PERFIL = os.path.join(RAIZ, 'pruebas', '.perfil_chrome')
BASE = 'http://127.0.0.1:5199/pruebas/vista-previa/'

CASOS = [
    ('mru-teoria-movil', 'l=bloque2/04-mru&s=teoria', '412,1800'),
    ('mru-formulas-movil-oscuro', 'l=bloque2/04-mru&s=formulas&tema=oscuro', '412,1600'),
    ('proyectiles-sim', 'l=bloque2/08-proyectiles&s=simulacion', '1280,1900'),
    ('proyectiles-sim-movil', 'l=bloque2/08-proyectiles&s=simulacion', '412,2600'),
    ('fuerzas-sim', 'l=bloque3/09-planos-inclinados&s=simulacion', '1280,2000'),
    ('vectores-sim', 'l=bloque1/06-escalares-vectores&s=simulacion', '1280,1500'),
    ('caida-sim-oscuro', 'l=bloque2/06-caida-libre&s=simulacion&tema=oscuro', '1280,1700'),
    ('circular-sim', 'l=bloque2/09-mcu&s=simulacion', '1280,1500'),
    ('mrua-practica-movil', 'l=bloque2/05-mrua&s=practica', '412,5000'),
    ('graficas-practica', 'l=bloque1/07-interpretacion-graficas&s=practica', '1280,5200'),
    ('fric-ejemplos', 'l=bloque3/07-friccion&s=ejemplos', '1280,2200'),
]


def main():
    os.makedirs(SALIDA, exist_ok=True)
    solo = sys.argv[1:] or None
    for nombre, query, tam in CASOS:
        if solo and nombre not in solo:
            continue
        destino = os.path.join(SALIDA, nombre + '.png')
        subprocess.run([
            'google-chrome', '--headless=new', f'--user-data-dir={PERFIL}', '--no-first-run', '--hide-scrollbars',
            f'--window-size={tam}', '--virtual-time-budget=8000', f'--screenshot={destino}', BASE + '?' + query,
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90)
        print(nombre, 'ok' if os.path.exists(destino) else 'FALLÓ')


if __name__ == '__main__':
    main()
