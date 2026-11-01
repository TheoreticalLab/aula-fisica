#!/usr/bin/env python3
"""
Guarda o cambia las credenciales de producción en privado/credenciales.env sin abrir el archivo a mano.

    cd ~/Documents/Apps/Aula_Fisica_Basica
    python3 scripts/ops/guardar_credenciales.py

- Lo que escribe NO se ve en pantalla (como una contraseña) y nunca se imprime: solo su longitud y los 4 últimos
  caracteres, para que pueda comprobar que pegó el correcto.
- Quita espacios y saltos de línea sobrantes al pegar y valida el formato de cada credencial.
- Antes de cambiar nada guarda una copia del archivo (privado/credenciales.env.anterior).
- Escribe de forma segura (archivo temporal + reemplazo) y deja el archivo legible solo por usted (permisos 600).
- Conserva las demás líneas y comentarios del archivo tal como están.
- Opcional: comprueba el token con la API de gestión de Supabase (solo lectura: datos del proyecto).

Ejecútelo en su propia terminal: necesita escribir de forma oculta, y la terminal de Claude Code no lo permite.
Solo usa la biblioteca estándar de Python.
"""
from __future__ import annotations

import argparse
import getpass
import json
import os
import re
import shutil
import stat
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
ARCHIVO = RAIZ / "privado" / "credenciales.env"

# clave → (descripción, ¿es secreta?, validador que devuelve un mensaje de error o None)
def _token(v: str) -> str | None:
    return None if re.fullmatch(r"sbp_[A-Za-z0-9]{30,}", v) else "debe empezar por «sbp_» seguido de al menos 30 letras o números (sin espacios)"

def _db(v: str) -> str | None:
    if not re.match(r"^postgres(ql)?://", v):
        return "debe empezar por «postgresql://» (la cadena de conexión que da Supabase en Connect → URI)"
    if "[YOUR-PASSWORD]" in v:
        return "todavía contiene [YOUR-PASSWORD]: sustitúyalo por la contraseña de la base de datos"
    return None

def _ref(v: str) -> str | None:
    return None if re.fullmatch(r"[a-z0-9]{20}", v) else "debe tener 20 letras minúsculas o números (está en la dirección del panel: supabase.com/dashboard/project/<ref>)"

def _local(v: str) -> str | None:
    if not re.match(r"^postgres(ql)?://", v):
        return "debe empezar por «postgresql://»"
    if re.search(r"supabase\.(co|com)|pooler|amazonaws", v):
        return "esta base debe ser LOCAL, no la de Supabase"
    return None

CLAVES: dict[str, tuple[str, bool, object]] = {
    "SUPABASE_ACCESS_TOKEN": ("Token de acceso de Supabase (sbp_…): desplegar funciones y revisar Auth", True, _token),
    "SUPABASE_DB_URL": ("Conexión a la base de datos de producción (postgresql://…)", True, _db),
    "SUPABASE_PROJECT_REF": ("Identificador del proyecto (20 caracteres)", False, _ref),
    "LOCAL_DB_URL": ("Base local desechable para «probar» (opcional)", False, _local),
    "LOCAL_ADMIN_DB_URL": ("Base local de administración para «probar» (opcional)", False, _local),
}


def enmascarar(v: str) -> str:
    """Nunca muestra el valor: solo longitud y los 4 últimos caracteres."""
    return f"{len(v)} caracteres, termina en «…{v[-4:]}»" if len(v) > 8 else f"{len(v)} caracteres"


def limpiar(v: str) -> str:
    """Quita espacios, tabulaciones, saltos de línea (al pegar en dos líneas) y comillas exteriores."""
    v = re.sub(r"\s+", "", v)
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "'\"":
        v = v[1:-1]
    return v


def leer(archivo: Path) -> list[str]:
    return archivo.read_text(encoding="utf-8").splitlines() if archivo.exists() else []


def valor_actual(lineas: list[str], clave: str) -> str | None:
    for l in lineas:
        s = l.strip()
        if s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        if k.strip() == clave:
            return v.strip().strip("'\"")
    return None


def con_valor(lineas: list[str], clave: str, valor: str) -> list[str]:
    """Sustituye la línea de la clave (la primera; las repetidas se comentan) o la añade al final."""
    salida, puesta = [], False
    for l in lineas:
        s = l.strip()
        if not s.startswith("#") and "=" in s and s.split("=", 1)[0].strip() == clave:
            if puesta:
                salida.append(f"# (repetida, desactivada) {clave}=…")
                continue
            salida.append(f"{clave}={valor}")
            puesta = True
        else:
            salida.append(l)
    if not puesta:
        salida.append(f"{clave}={valor}")
    return salida


def escribir(archivo: Path, lineas: list[str]) -> None:
    """Copia de seguridad del archivo anterior y escritura atómica con permisos 600."""
    archivo.parent.mkdir(parents=True, exist_ok=True)
    if archivo.exists():
        anterior = archivo.with_name(archivo.name + ".anterior")
        shutil.copy2(archivo, anterior)
        os.chmod(anterior, stat.S_IRUSR | stat.S_IWUSR)
    fd, tmp = tempfile.mkstemp(dir=archivo.parent, prefix=".credenciales-", text=True)
    try:
        os.chmod(tmp, stat.S_IRUSR | stat.S_IWUSR)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write("\n".join(lineas).rstrip("\n") + "\n")
        os.replace(tmp, archivo)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise
    os.chmod(archivo, stat.S_IRUSR | stat.S_IWUSR)


def comprobar_token(token: str, ref: str) -> str:
    """Consulta de SOLO LECTURA a la API de gestión: datos del proyecto. Devuelve un mensaje para el usuario."""
    req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{ref}", headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            p = json.loads(r.read().decode("utf-8"))
            return f"✔ Token válido: proyecto «{p.get('name', '?')}» ({p.get('status', '?')}, región {p.get('region', '?')})."
    except urllib.error.HTTPError as e:
        if e.code == 401:
            return "✖ Supabase rechaza el token (401): está caducado, revocado o mal copiado. Genere otro."
        if e.code in (403, 404):
            return f"✖ El token no tiene acceso a este proyecto ({e.code}): créelo con la cuenta dueña del proyecto o con permisos sobre él."
        return f"✖ La API de gestión respondió {e.code}."
    except (urllib.error.URLError, TimeoutError) as e:
        return f"⚠ No se pudo conectar con Supabase para comprobarlo ({getattr(e, 'reason', e)}). El token quedó guardado igualmente."


def pedir(clave: str) -> str | None:
    desc, secreta, valida = CLAVES[clave]
    print(f"\n{clave}: {desc}")
    for intento in range(3):
        crudo = getpass.getpass("Pegue el valor (no se verá) y pulse Enter: ") if secreta else input("Escriba o pegue el valor: ")
        v = limpiar(crudo)
        if not v:
            print("  (vacío: no se cambia)")
            return None
        error = valida(v)  # type: ignore[operator]
        if error:
            print(f"  ✖ No parece válido: {error}.")
            continue
        print(f"  Recibido: {enmascarar(v) if secreta else v}")
        if input("  ¿Guardarlo? [s/N]: ").strip().lower() in ("s", "si", "sí"):
            return v
        print("  No se guarda.")
        return None
    print("  Demasiados intentos; no se cambia.")
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description="Guarda credenciales en privado/credenciales.env de forma segura.")
    ap.add_argument("--archivo", type=Path, default=ARCHIVO, help=argparse.SUPPRESS)  # para pruebas
    ap.add_argument("--solo-token", action="store_true", help="pedir solo el SUPABASE_ACCESS_TOKEN (lo más habitual)")
    args = ap.parse_args()
    archivo: Path = args.archivo

    if not sys.stdin.isatty():
        print("Ejecútelo en su propia terminal (necesita escribir de forma oculta).", file=sys.stderr)
        return 1
    lineas = leer(archivo)
    print(f"Archivo: {archivo}")
    print("Estado actual:")
    for k, (desc, secreta, _) in CLAVES.items():
        v = valor_actual(lineas, k)
        print(f"  {k:22} {'(sin valor)' if not v else enmascarar(v) if secreta else v}")

    if args.solo_token:
        elegidas = ["SUPABASE_ACCESS_TOKEN"]
    else:
        print("\n¿Qué quiere cambiar?")
        claves = list(CLAVES)
        for i, k in enumerate(claves, 1):
            print(f"  {i}. {k}")
        print("  (Enter = 1, el token; varias separadas por comas, p. ej. 1,2)")
        eleccion = input("Opción: ").strip() or "1"
        try:
            elegidas = [claves[int(x) - 1] for x in eleccion.replace(" ", "").split(",") if x]
        except (ValueError, IndexError):
            print("Opción no válida.")
            return 1

    cambios: dict[str, str] = {}
    for k in elegidas:
        v = pedir(k)
        if v is not None:
            cambios[k] = v
    if not cambios:
        print("\nNo se cambió nada.")
        return 0
    for k, v in cambios.items():
        lineas = con_valor(lineas, k, v)
    escribir(archivo, lineas)
    print(f"\n✔ Guardado en {archivo} (permisos 600). Copia del anterior: {archivo.name}.anterior")

    token = cambios.get("SUPABASE_ACCESS_TOKEN")
    ref = cambios.get("SUPABASE_PROJECT_REF") or valor_actual(lineas, "SUPABASE_PROJECT_REF")
    if token and ref and input("\n¿Comprobar ahora el token con Supabase (solo lectura)? [S/n]: ").strip().lower() not in ("n", "no"):
        print(comprobar_token(token, ref))
    print("\nSiguiente paso: npm run plan")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nCancelado. (Si ya apareció «✔ Guardado», ese cambio quedó hecho; si no, no se cambió nada.)")
        sys.exit(130)
