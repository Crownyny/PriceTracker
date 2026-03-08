"""Verifica la sintaxis de los archivos de fuentes sin necesidad de importarlos.

Uso:
    conda run -n SCRAPPING python temp/check_syntax.py
"""
import ast
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

TARGETS = [
    "app/sources/amazon.py",
    "app/sources/mercadolibre.py",
    "app/sources/exito.py",
    "app/sources/base.py",
    "app/worker.py",
]

errors = []
for rel in TARGETS:
    path = ROOT / rel
    try:
        source = path.read_text(encoding="utf-8")
        ast.parse(source, filename=str(path))
        print(f"  OK  {rel}")
    except SyntaxError as e:
        print(f"  ERR {rel}:{e.lineno}: {e.msg}")
        errors.append(rel)
    except FileNotFoundError:
        print(f"  MISSING {rel}")
        errors.append(rel)

print()
if errors:
    print(f"FAILED: {len(errors)} file(s) have errors.")
    sys.exit(1)
else:
    print("All files pass syntax check.")
