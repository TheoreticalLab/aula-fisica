/**
 * Presentación pública de las asignaturas (portada). Es texto de presentación, no datos de la base:
 * el contenido real de cada curso se gestiona desde el panel docente.
 */
export interface AsignaturaPublica {
  codigo: string;
  titulo: string;
  lema: string;
  descripcion: string;
  temas: string[];
  estado: string;
  disponible: boolean;
  color: 'azul' | 'dorado' | 'verde';
}

export const ASIGNATURAS: AsignaturaPublica[] = [
  {
    codigo: 'FIS-BASICA',
    titulo: 'Física Básica',
    lema: 'El punto de partida',
    descripcion:
      'Magnitudes y unidades, vectores, movimiento y leyes de Newton, explicados con álgebra, trigonometría y gráficas. Pensada para quien empieza.',
    temas: ['Fundamentos', 'Cinemática', 'Dinámica'],
    estado: '26 lecciones con simuladores y práctica',
    disponible: true,
    color: 'azul',
  },
  {
    codigo: 'FIS-GEN-1',
    titulo: 'Física General I',
    lema: 'Mecánica',
    descripcion:
      'El movimiento y sus causas con más profundidad: cinemática y dinámica, trabajo y energía, cantidad de movimiento y sistemas de partículas.',
    temas: ['Movimiento', 'Fuerzas', 'Energía'],
    estado: 'Lecciones en preparación',
    disponible: false,
    color: 'dorado',
  },
  {
    codigo: 'FIS-GEN-3',
    titulo: 'Física General III',
    lema: 'Electricidad y magnetismo',
    descripcion:
      'Carga y campo eléctrico, ley de Gauss, potencial, circuitos y leyes de Kirchhoff, y campo magnético: la física de la electricidad que usamos a diario.',
    temas: ['Campo eléctrico', 'Potencial', 'Circuitos'],
    estado: 'Lecciones en preparación',
    disponible: false,
    color: 'verde',
  },
];
