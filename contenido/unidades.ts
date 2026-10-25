/**
 * Bloques del curso. Las lecciones de cada bloque se leen de contenido/<carpeta>/NN-slug.ts en orden.
 * Los bloques IV–VI se anuncian en el temario («en preparación») y se redactarán en la segunda etapa.
 */
export interface UnitMeta {
  slug: string;
  folder: string | null;
  title: string;
  summary: string;
  comingSoon: boolean;
  plannedTopics: string[];
}

export const COURSE = {
  id: '00000000-0000-4000-8000-00000000f15b',
  code: 'FIS-BASICA',
  title: 'Física Básica',
  description:
    'Curso introductorio de física para estudiantes universitarios: comprensión conceptual, interpretación de ecuaciones y gráficas, resolución progresiva de problemas y experimentos virtuales. Solo se usa álgebra, trigonometría elemental y gráficas.',
};

export const UNITS: UnitMeta[] = [
  {
    slug: 'fundamentos',
    folder: 'bloque1',
    title: 'Bloque I. Fundamentos',
    summary: 'Magnitudes y unidades, notación científica, mediciones, vectores y lectura de gráficas: el lenguaje común de toda la física.',
    comingSoon: false,
    plannedTopics: [],
  },
  {
    slug: 'cinematica',
    folder: 'bloque2',
    title: 'Bloque II. Cinemática',
    summary: 'Descripción del movimiento: posición, velocidad y aceleración, en una y dos dimensiones, y movimiento circular.',
    comingSoon: false,
    plannedTopics: [],
  },
  {
    slug: 'dinamica',
    folder: 'bloque3',
    title: 'Bloque III. Dinámica',
    summary: 'Las causas del movimiento: fuerzas, leyes de Newton, diagramas de cuerpo libre, fricción, tensión y planos inclinados.',
    comingSoon: false,
    plannedTopics: [],
  },
  {
    slug: 'energia-momento',
    folder: null,
    title: 'Bloque IV. Energía y cantidad de movimiento',
    summary: 'Trabajo, energía y su conservación; impulso, cantidad de movimiento y colisiones.',
    comingSoon: true,
    plannedTopics: [
      'Trabajo mecánico', 'Energía cinética', 'Energía potencial', 'Conservación de la energía', 'Potencia',
      'Impulso', 'Cantidad de movimiento', 'Colisiones sencillas',
    ],
  },
  {
    slug: 'oscilaciones-ondas',
    folder: null,
    title: 'Bloque V. Oscilaciones y ondas',
    summary: 'Movimiento periódico, sistemas masa-resorte y péndulo, ondas mecánicas y sonido.',
    comingSoon: true,
    plannedTopics: [
      'Movimiento periódico', 'Amplitud, período y frecuencia', 'Sistemas masa-resorte', 'Péndulo simple',
      'Movimiento armónico simple', 'Ondas mecánicas', 'Longitud de onda y velocidad de propagación',
      'Frecuencia y período de una onda', 'Ondas transversales y longitudinales', 'Superposición', 'Reflexión',
      'Sonido', 'Intensidad y efecto Doppler elemental',
    ],
  },
  {
    slug: 'termodinamica',
    folder: null,
    title: 'Bloque VI. Temperatura y termodinámica',
    summary: 'Temperatura, calor, cambios de fase, transferencia de calor, gases ideales y leyes de la termodinámica.',
    comingSoon: true,
    plannedTopics: [
      'Temperatura y equilibrio térmico', 'Escalas de temperatura', 'Dilatación térmica', 'Calor y energía interna',
      'Calor específico', 'Calorimetría', 'Cambios de fase', 'Conducción, convección y radiación', 'Gases ideales',
      'Primera ley de la termodinámica', 'Procesos termodinámicos elementales',
      'Segunda ley de la termodinámica y entropía introductoria',
    ],
  },
];
