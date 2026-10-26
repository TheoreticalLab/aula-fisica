/** Descripción legible de un navegador a partir de su «user agent» (aproximada: el navegador puede mentir). */
export function describirNavegador(ua: string | null | undefined): { navegador: string; sistema: string; movil: boolean } {
  const u = ua ?? '';
  const navegador = /Edg\//.test(u)
    ? 'Edge'
    : /OPR\/|Opera/.test(u)
      ? 'Opera'
      : /SamsungBrowser/.test(u)
        ? 'Samsung Internet'
        : /Firefox\//.test(u)
          ? 'Firefox'
          : /Chrome\/|CriOS/.test(u)
            ? 'Chrome'
            : /Safari\//.test(u)
              ? 'Safari'
              : u
                ? 'Otro navegador'
                : 'Navegador desconocido';
  const sistema = /Android/.test(u)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(u)
      ? 'iPhone/iPad'
      : /Windows/.test(u)
        ? 'Windows'
        : /Mac OS X|Macintosh/.test(u)
          ? 'Mac'
          : /CrOS/.test(u)
            ? 'Chromebook'
            : /Linux/.test(u)
              ? 'Linux'
              : 'sistema desconocido';
  return { navegador, sistema, movil: /Mobile|Android|iPhone|iPad/.test(u) };
}
