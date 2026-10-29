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
    pendiente: [
      'Bloques IV (Energía y cantidad de movimiento), V (Oscilaciones y ondas) y VI (Termodinámica): anunciados en el temario, sin lecciones todavía.',
      'Otras asignaturas: creadas desde el panel; sus lecciones están en preparación.',
    ],
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
      'Vista previa del panel de inicio del estudiante por sección («Ver como estudiante»), con el mismo componente y los datos que vería un estudiante recién inscrito.',
      'Vista previa «como estudiante» de cada práctica o evaluación: los mismos componentes que ve el estudiante, calificados con el mismo motor, sin guardar nada.',
      'Lectura cronometrada antes de los ejercicios: el servidor cuenta el tiempo real de lectura, se detiene si el estudiante sale de la plataforma y los ejercicios se habilitan al cumplir el mínimo.',
    ],
    pendiente: ['Límite de tiempo por intento.', 'Prórrogas individuales.', 'Orden aleatorio de preguntas y opciones.'],
  },
  {
    area: 'Seguimiento',
    hecho: [
      'Dominio por concepto calculado a partir de respuestas verificables (acierto al primer intento, uso de pistas, evaluaciones), no de páginas visitadas.',
      'Estadísticas por actividad y por concepto, libro de calificaciones y exportación a CSV.',
      'Panel de inicio del estudiante: mis cursos, continuar donde lo dejó, próximas actividades, avisos de la sección y del sistema, progreso y calificaciones recientes.',
    ],
    pendiente: ['Personalización del aprendizaje y análisis pedagógico avanzado (etapa 3).'],
  },
  {
    area: 'Orbe IA (humor contextual)',
    hecho: [
      'En funcionamiento: chistes de física por lección, subsección y apartado de la teoría, generados con Claude, revisados por el profesor y reutilizados con todos los estudiantes. A la IA solo le llega el contenido académico, nunca datos personales. Se activa solo desde el panel del profesor.',
      'Reglas en el servidor: un mensaje como máximo cada 10 minutos (configurable), solo tras actividad reciente comprobada, nunca durante una evaluación ni mientras el estudiante escribe, sin repetir chistes; presupuesto mensual y límite diario de llamadas.',
      'Copiar el banco de chistes entre asignaturas con el mismo contenido (por ejemplo, Física General 1 y 1-A).',
      'Orbe Control con Claude: redactar mensajes (el nombre lo pone el teléfono, Claude no lo ve), pulso de la clase y pregunta relámpago con resultados en vivo y bloqueo de pantalla a quien salga sin responder.',
    ],
    pendiente: ['Probar la pregunta relámpago en teléfonos reales (apagar la pantalla del móvil cuenta como salir).', 'Eventos académicos: hoy solo «ejercicio de práctica resuelto»; terminar lección, resolver tras varios intentos y fin de sesión están previstos.'],
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
