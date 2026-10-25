"""Prueba de punta a punta del aula contra Supabase, con su cuenta de administrador.

    python3 pruebas/prueba_e2e.py

Pide su ID y su contraseña sin mostrarlos, y los pasa solo al proceso de prueba (no se guardan).
La prueba entra por el mismo camino que la interfaz y crea datos marcados con «PRUEBA».
"""
import getpass
import os
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

id_admin = input('ID de administrador [orbe]: ').strip() or 'orbe'
clave = getpass.getpass('Contraseña (no se verá): ')
entorno = dict(os.environ, AULA_ADMIN_ID=id_admin, AULA_ADMIN_PASSWORD=clave)
r = subprocess.run([os.path.join(RAIZ, 'node_modules', '.bin', 'vite-node'), 'pruebas/e2e/prueba_e2e.ts'], cwd=RAIZ, env=entorno)
sys.exit(r.returncode)
