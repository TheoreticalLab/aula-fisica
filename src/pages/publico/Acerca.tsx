import { PLANNED_SIMULATIONS, SIMULATIONS } from '@/sims/catalogo';
import { Badge, PageTitle } from '@/components/ui';

/** Estado real del desarrollo: lo terminado y lo pendiente, sin funciones ficticias. */
const ESTADO: { area: string; hecho: string[]; pendiente: string[] }[] = [
  {
    area: 'Contenido',
    hecho: [
      'Bloques I (Fundamentos), II (Cinemática) y III (Dinámica): 26 lecciones con teoría, fórmulas, ejemplos resueltos, simulación cuando corresponde y práctica.',
      'Ocho ejercicios por lección: conjunto de práctica (3 básicos, 1 intermedio, 1 desafiante), 2 de refuerzo y 1 de desarrollo para el banco.',
    ],
    pendiente: ['Bloques IV (Energía y cantidad de movimiento), V (Oscilaciones y ondas) y VI (Termodinámica): anunciados en el temario, sin lecciones todavía.'],
  },
  {
    area: 'Ejercicios y calificación',
    hecho: [
      'Selección simple y múltiple, verdadero o falso con justificación, respuesta numérica, texto corto y desarrollo con revisión manual.',
      'Calificación en el servidor: unidades y conversiones, dimensiones, tolerancia, cifras significativas, respuestas equivalentes y diagnóstico de errores típicos.',
      'Pistas progresivas, explicación de la solución, problemas de refuerzo por concepto y registro de cada envío.',
    ],
    pendiente: ['Respuestas de tipo expresión algebraica.', 'Generación parametrizada de problemas (etapa 3).'],
  },
  {
    area: 'Actividades y evaluaciones',
    hecho: [
      'Modo práctica (varios intentos, pistas, retroalimentación inmediata) y modo evaluación (sin pistas, se califica al entregar).',
      'Fechas de apertura y cierre, número de intentos, política de visualización de respuestas, publicación de calificaciones y revisión manual.',
    ],
    pendiente: ['Límite de tiempo por intento.', 'Prórrogas individuales.', 'Orden aleatorio de preguntas y opciones.'],
  },
  {
    area: 'Seguimiento',
    hecho: [
      'Dominio por concepto calculado a partir de respuestas verificables (acierto al primer intento, uso de pistas, evaluaciones), no de páginas visitadas.',
      'Estadísticas por actividad y por concepto, libro de calificaciones y exportación a CSV.',
    ],
    pendiente: ['Personalización del aprendizaje y análisis pedagógico avanzado (etapa 3).'],
  },
];

export default function Acerca() {
  return (
    <div>
      <PageTitle title="Acerca del aula" subtitle="Lo que ya funciona y lo que falta, por etapas de desarrollo." />
      <div className="space-y-4">
        {ESTADO.map((e) => (
          <section key={e.area} className="tarjeta">
            <h2 className="mb-2 text-lg font-semibold">{e.area}</h2>
            <ul className="space-y-1 text-sm">
              {e.hecho.map((h) => (
                <li key={h} className="flex gap-2"><Badge tone="green">Disponible</Badge><span>{h}</span></li>
              ))}
              {e.pendiente.map((h) => (
                <li key={h} className="flex gap-2"><Badge>Pendiente</Badge><span>{h}</span></li>
              ))}
            </ul>
          </section>
        ))}
        <section className="tarjeta">
          <h2 className="mb-2 text-lg font-semibold">Simuladores</h2>
          <ul className="space-y-1 text-sm">
            {SIMULATIONS.map((s) => (
              <li key={s.key} className="flex gap-2"><Badge tone="green">Disponible</Badge><span>{s.title}</span></li>
            ))}
            {PLANNED_SIMULATIONS.map((s) => (
              <li key={s.title} className="flex gap-2"><Badge>Pendiente</Badge><span>{s.title} ({s.block})</span></li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
