# Manual del Aula Virtual (LaTeX)

`manual_aula_virtual.tex`: manual para estudiantes, profesorado y administración. Solo usa paquetes estándar.

## Compilar

**Opción A · Overleaf (sin instalar nada):** cree un proyecto nuevo, suba `manual_aula_virtual.tex` y pulse *Recompile* (compilador pdfLaTeX).

**Opción B · en este equipo:**

```bash
sudo apt install texlive-latex-recommended texlive-latex-extra texlive-lang-spanish texlive-fonts-recommended
cd docs/manual
pdflatex manual_aula_virtual.tex
pdflatex manual_aula_virtual.tex   # segunda pasada: índice y referencias
```

El PDF (`manual_aula_virtual.pdf`) queda en la misma carpeta.

## Mantenimiento

Cuando cambie la plataforma, actualice también la página «Ayuda» (`src/pages/Ayuda.tsx`): ambos describen lo mismo.
Las capturas de pantalla se pueden añadir con `\includegraphics` (paquete `graphicx`) en las secciones correspondientes.
