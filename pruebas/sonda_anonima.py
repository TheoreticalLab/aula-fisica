"""Comprueba desde fuera que la clave pública (sin iniciar sesión) no puede leer ni ejecutar nada.

    python3 pruebas/sonda_anonima.py

Lee VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY de .env.local. Solo hace lecturas (no modifica datos).
"""
import json
import os
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env = {}
for linea in open(os.path.join(RAIZ, '.env.local'), encoding='utf8'):
    if '=' in linea and not linea.lstrip().startswith('#'):
        k, v = linea.strip().split('=', 1)
        env[k] = v
URL = env['VITE_SUPABASE_URL']
KEY = env['VITE_SUPABASE_ANON_KEY']


def pedir(ruta, cuerpo=None):
    req = urllib.request.Request(URL + ruta, data=None if cuerpo is None else json.dumps(cuerpo).encode(),
                                 headers={'apikey': KEY, 'Content-Type': 'application/json'})
    try:
        r = urllib.request.urlopen(req, timeout=20)
        return r.status, r.read().decode()[:120]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:120]


fallos = 0
for tabla in ['exercise_keys', 'profiles', 'responses', 'attempts', 'lessons', 'exercises', 'classes', 'enrollments']:
    st, txt = pedir(f'/rest/v1/{tabla}?select=*&limit=1')
    ok = st in (401, 403) or (st == 200 and txt.strip() == '[]')
    fallos += not ok
    print(f"{'OK   ' if ok else 'FALLO'} lectura anónima de {tabla}: {st} {txt}")
for fn in ['svc_check_context', 'get_attempt', 'bootstrap_admin']:
    st, txt = pedir(f'/rest/v1/rpc/{fn}', {})
    ok = st in (401, 403, 404)
    fallos += not ok
    print(f"{'OK   ' if ok else 'FALLO'} ejecución anónima de {fn}: {st} {txt}")
print('\nTodo cerrado para usuarios anónimos.' if not fallos else f'\n{fallos} comprobaciones fallaron.')
