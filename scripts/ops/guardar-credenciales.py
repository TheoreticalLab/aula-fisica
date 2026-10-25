"""Guarda de forma segura el token y la contraseña en privado/credenciales.env.

    python3 scripts/ops/guardar-credenciales.py

Pide los valores sin mostrarlos en pantalla (puede pegarlos con Ctrl+Shift+V), comprueba su formato,
codifica la contraseña para la URI y deja el archivo con permisos 600. Deje un valor vacío para conservar el actual.
"""
import getpass
import os
import re
import urllib.parse

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RUTA = os.path.join(RAIZ, 'privado', 'credenciales.env')
PLANTILLA = os.path.join(RAIZ, 'scripts', 'ops', 'credenciales.ejemplo.env')


def leer():
    texto = open(RUTA if os.path.exists(RUTA) else PLANTILLA, encoding='utf8').read()
    return texto.split('\n')


def valor(lineas, clave):
    for l in lineas:
        if l.startswith(clave + '='):
            return l.split('=', 1)[1].strip()
    return ''


def poner(lineas, clave, v):
    for i, l in enumerate(lineas):
        if l.startswith(clave + '='):
            lineas[i] = f'{clave}={v}'
            return
    lineas.append(f'{clave}={v}')


def main():
    lineas = leer()
    ref = valor(lineas, 'SUPABASE_PROJECT_REF') or 'rzymcllygsqiplkygymx'

    print('1) Token personal de Supabase (https://supabase.com/dashboard/account/tokens), empieza por sbp_')
    tok = getpass.getpass('   Pegue el token (no se verá) y pulse Enter: ').strip()
    if tok:
        if not re.fullmatch(r'sbp_[A-Za-z0-9]{30,}', tok):
            print('   ✖ Eso no parece un token sbp_…; no se guardó.')
        else:
            poner(lineas, 'SUPABASE_ACCESS_TOKEN', tok)
            print('   ✔ token guardado')

    print('\n2) Contraseña de la base de datos (Project Settings → Database → Reset database password)')
    pw = getpass.getpass('   Pegue la contraseña (no se verá) y pulse Enter: ').strip()
    if pw:
        if pw.startswith('[') and pw.endswith(']'):
            pw = pw[1:-1]
        actual = valor(lineas, 'SUPABASE_DB_URL')
        m = re.match(r'postgres(?:ql)?://[^:/@]+:[^@]*@([^/]+)/(\w+)', actual)
        host = m.group(1) if m else ''
        if not host:
            host = input('   No hay URI previa. Escriba el servidor del Session pooler (p. ej. aws-0-us-east-1.pooler.supabase.com:5432): ').strip()
        base = m.group(2) if m else 'postgres'
        uri = f'postgresql://postgres.{ref}:{urllib.parse.quote(pw, safe="")}@{host}/{base}'
        poner(lineas, 'SUPABASE_DB_URL', uri)
        print('   ✔ contraseña guardada (codificada en la URI)')

    os.makedirs(os.path.dirname(RUTA), exist_ok=True)
    with open(RUTA, 'w', encoding='utf8') as f:
        f.write('\n'.join(lineas))
    os.chmod(RUTA, 0o600)
    print('\nListo. Archivo privado/credenciales.env actualizado (permisos 600). Avise a Claude para que lo compruebe.')


if __name__ == '__main__':
    main()
