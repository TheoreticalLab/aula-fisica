"""Ejecuta el arnés de la calculadora en Chrome sin pantalla y muestra el resultado del guion.

Requiere el servidor del arnés:  ./node_modules/.bin/vite --config pruebas/calculadora/vite.config.ts --port 5199
    python3 pruebas/calculadora/ejecutar.py
"""
import html
import json
import os
import re
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PERFIL = os.path.join(RAIZ, 'pruebas', '.perfil_calculadora')
BASE = 'http://127.0.0.1:5199/pruebas/calculadora/'
CASOS = [('pantalla grande', '', '1280,900'), ('teléfono', '?movil=1', '412,860')]

fallos = 0
for nombre, query, tam in CASOS:
    proc = subprocess.run(
        ['google-chrome', '--headless=new', f'--user-data-dir={PERFIL}', '--no-first-run', '--disable-gpu',
         f'--window-size={tam}', '--virtual-time-budget=30000', '--dump-dom', BASE + query],
        capture_output=True, text=True, timeout=120)
    dom = proc.stdout
    if not dom.strip():
        print('Chrome no devolvió la página. Salida de error:'); print(proc.stderr[-1500:])
    m = re.search(r'<pre id="resultados" data-estado="(\w+)">(.*?)</pre>', dom, re.S)
    print(f'\n=== {nombre} ({tam}) ===')
    if not m or m.group(1) == 'corriendo':
        print('SIN RESULTADO'); print(dom[:800]); fallos += 1; continue
    datos = json.loads(html.unescape(m.group(2)))
    if 'error' in datos:
        print('ERROR DEL GUION:', datos['error'])
    for p in datos.get('pasos', []):
        print(('✔' if p['ok'] else '✖'), p['paso'], f"· {p['detalle']}" if p.get('detalle') else '')
    if not datos.get('ok'):
        fallos += 1
print('\nRESULTADO:', 'TODO CORRECTO' if not fallos else f'{fallos} caso(s) con fallos')
sys.exit(1 if fallos else 0)
