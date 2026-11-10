/**
 * Asignaturas de laboratorio (migración 84): reglas puras de los controles fotográficos, probadas en
 * tests/laboratorio.test.ts. Los estados los calcula la base de datos; aquí solo se cuentan, se filtran y se nombran.
 */
export type EstadoControl = 'pendiente' | 'entregado' | 'aprobado' | 'requiere_correccion';

export const ESTADO_CONTROL: Record<EstadoControl, { texto: string; tono: 'gray' | 'blue' | 'green' | 'amber'; corto: string }> = {
  pendiente: { texto: 'Pendiente', tono: 'gray', corto: '·' },
  entregado: { texto: 'Entregado', tono: 'blue', corto: 'E' },
  aprobado: { texto: 'Aprobado', tono: 'green', corto: '✓' },
  requiere_correccion: { texto: 'Requiere corrección', tono: 'amber', corto: '!' },
};

/** Formatos que el servidor acepta (por su firma). La app convierte cualquier imagen legible a WebP o JPEG antes de enviar. */
export const FORMATOS_CONTROL = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** Tope del servidor por imagen (el buzón de cada control admite 5 MB). */
export const MAX_BYTES_CONTROL = 5 * 1048576;
/** Margen para el envío: la app apunta a ≈1,6 MB y nunca envía más de esto. */
export const MAX_BYTES_ENVIO = Math.floor(4.5 * 1048576);

/** Entregados = con imagen vigente sin revisar o aprobada («requiere corrección» no cuenta: hay que volver a subir). */
export function contar(estados: EstadoControl[]) {
  return {
    total: estados.length,
    entregados: estados.filter((e) => e === 'entregado' || e === 'aprobado').length,
    aprobados: estados.filter((e) => e === 'aprobado').length,
    porCorregir: estados.filter((e) => e === 'requiere_correccion').length,
    sinRevisar: estados.filter((e) => e === 'entregado').length,
    pendientes: estados.filter((e) => e === 'pendiente').length,
  };
}

/**
 * Práctica por controles (migración 91; la nota la calcula official_scores en el servidor): cada control que cuenta
 * vale lo mismo y suma si está entregado o aprobado. Con la Práctica entera para los controles: 30/7 ≈ 4,29 cada uno.
 */
export function practicaPorControles(enPractica: number, cuentan: number, valor = 30): { porControl: number; nota: number } | null {
  if (cuentan <= 0) return null;
  const k = Math.max(0, Math.min(enPractica, cuentan));
  return { porControl: Math.round((valor / cuentan) * 100) / 100, nota: Math.round(((valor * k) / cuentan) * 100) / 100 };
}

export type FiltroLab ='todos' | 'completos' | 'pendientes' | 'correccion' | 'sin_revisar';
export const FILTROS_LAB: { id: FiltroLab; texto: string }[] = [
  { id: 'todos', texto: 'Todos' },
  { id: 'completos', texto: 'Con todos entregados' },
  { id: 'pendientes', texto: 'Con controles pendientes' },
  { id: 'correccion', texto: 'Con correcciones' },
  { id: 'sin_revisar', texto: 'Con entregas sin revisar' },
];

export function cumpleFiltro(estados: EstadoControl[], filtro: FiltroLab): boolean {
  const c = contar(estados);
  switch (filtro) {
    case 'completos': return c.total > 0 && c.entregados === c.total;
    case 'pendientes': return c.entregados < c.total;
    case 'correccion': return c.porCorregir > 0;
    case 'sin_revisar': return c.sinRevisar > 0;
    default: return true;
  }
}

/** Valida el archivo elegido antes de procesarlo (el servidor vuelve a comprobarlo por su firma). */
export function motivoArchivo(nombre: string, tipo: string, bytes: number): string | null {
  if (bytes <= 0) return 'El archivo está vacío.';
  if (/\.pdf$/i.test(nombre) || tipo === 'application/pdf') return 'El control se entrega como una fotografía, no como PDF.';
  if (!tipo.startsWith('image/') && !/\.(png|jpe?g|webp|heic|heif|gif|bmp)$/i.test(nombre)) return 'Elija una imagen (JPG, PNG o WEBP).';
  if (bytes > 40 * 1048576) return 'La imagen es demasiado grande (más de 40 MB).';
  return null;
}

/** «Abre…», «Cierra…» o null si el control no tiene fechas. */
export function textoFechas(abre: string | null, cierra: string | null, fmt: (s: string) => string): string | null {
  if (abre && cierra) return `Del ${fmt(abre)} al ${fmt(cierra)}`;
  if (abre) return `Abre el ${fmt(abre)}`;
  if (cierra) return `Cierra el ${fmt(cierra)}`;
  return null;
}
