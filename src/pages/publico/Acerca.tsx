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
      'Física General I · Unidad 9 «Física de los choques» (instalada; pendiente de revisar en navegador y teléfono): 15 lecciones del fenómeno al modelo, laboratorio «choque seguido de fricción» y un banco de 135 ejercicios verificados con el motor físico (42 fáciles, 44 intermedios, 49 difíciles), con problemas por etapas.',
    ],
  },
  {
    area: 'Ejercicios y calificación',
    hecho: [
      'Selección simple y múltiple, verdadero o falso con justificación, respuesta numérica, texto corto y desarrollo con revisión manual.',
      'Calificación en el servidor: unidades y conversiones, dimensiones, tolerancia, cifras significativas, respuestas equivalentes y diagnóstico de errores típicos.',
      'Pistas progresivas, explicación de la solución, problemas de refuerzo por concepto y registro de cada envío.',
    ],
    pendiente: [
      'Respuestas de tipo expresión algebraica por equivalencia (no por texto): programadas y probadas para las Prácticas de Control (claves de texto con «expresion»); pendiente de aplicar la migración 62, desplegar «calificar» y un editor visual de estas claves en el Banco.',
      'Una versión numérica distinta para cada intento: el generador reproducible por semillas ya existe para los choques, pero la plataforma aún no sortea ni guarda los parámetros por intento.',
      'Arrastre de errores en problemas por etapas: programado y probado; requiere aplicar la migración 41 y desplegar la función «calificar».',
    ],
  },
  {
    area: 'Actividades y evaluaciones',
    hecho: [
      'Modo práctica (varios intentos, pistas, retroalimentación inmediata) y modo evaluación (sin pistas, se califica al entregar).',
      'Fechas de apertura y cierre, número de intentos, política de visualización de respuestas, publicación de calificaciones y revisión manual.',
      'Vista previa del panel de inicio del estudiante por sección («Ver como estudiante»), con el mismo componente y los datos que vería un estudiante recién inscrito.',
      'Vista previa «como estudiante» de cada práctica o evaluación: los mismos componentes que ve el estudiante, calificados con el mismo motor, sin guardar nada.',
      'Lectura cronometrada antes de los ejercicios: el servidor cuenta el tiempo real de lectura, se detiene si el estudiante sale de la plataforma y los ejercicios se habilitan al cumplir el mínimo.',
      'Evaluaciones de una pregunta a la vez: límite de tiempo con el reloj oficial del servidor, navegación libre o solo hacia adelante, pausas declaradas, guardado automático con recuperación tras desconexiones, tiempo por pregunta, seguimiento en vivo y prórrogas individuales.',
      'Asistente «+ Crear actividad» en cuatro pasos con plantillas (práctica, tarea, quiz, parcial, examen estricto).',
      'Banco de ejercicios por origen y preguntas desde las clases (programado y probado; pendiente de aplicar): el banco se filtra por de dónde salió cada ejercicio (contenido, profesorado, IA por temas, IA desde una clase impartida, variantes de control) y «Proponer preguntas de esta clase» genera borradores sobre lo trabajado en una clase, sin publicar hasta que el profesor los revise.',
      'Prácticas extraordinarias secuenciales (aplicadas y publicadas, incluida la generación de problemas con IA; reutilizar problemas de otras prácticas y la corrección de las respuestas cortadas de la IA, programadas y probadas, pendientes de aplicar): problemas de 3 a 5 apartados que se muestran de uno en uno y de forma irreversible, con una espera mínima por apartado decidida por el servidor; avanzar antes reduce la puntuación del apartado y omitir vale 0. El contenido sale de problemas por etapas reales del banco o lo prepara el profesor. Incluye monitor, simulador docente, calibración de tiempos, control presencial desde Orbe Control y generación de problemas por apartados con IA en paquetes, que el profesor revisa antes de añadir. Dificulta el uso mecánico de asistentes externos; no lo impide ni lo detecta.',
      'Copiar una práctica o evaluación a otra sección, también entre Física General I y IA (aplicado): copia la configuración completa, nunca datos de estudiantes, y queda oculta para revisarla.',
      'Física General III con programa académico (aplicado; pendiente de la revisión del profesor): cinco unidades y doce capítulos (electrostática, circuitos, magnetismo, inducción, corriente alterna y ondas) con objetivos, subtemas esenciales, complementarios y de profundización, ecuaciones y ejemplos; el estudiante ve qué está previsto, qué se impartió en su sección y qué material está disponible; el profesor marca lo impartido desde el aula o desde Orbe Control.',
      'Puntos perdidos y alerta urgente (aplicados): el registro y «Mis notas» muestran los puntos perdidos (en cada apartado con nota, lo que vale menos lo que se sacó, descontando los extras); quien pierde más de 21 recibe un aviso urgente del profesor, con lectura obligatoria (espera, casilla y «Entendido»), hasta 10 veces y cada 24 h desde que leyó el anterior.',
      'Partes de un apartado del registro (aplicadas): un apartado, como Práctica, puede dividirse en una parte calificada a mano por el profesor y otra calculada con las actividades del aula; el estudiante ve las dos.',
      'Resumen semanal del profesor y mapa para tutoría (programados y probados; pendientes de aplicar): lo pendiente de la semana en el Panel docente y en Orbe Control, y en la ficha de cada estudiante su dominio por concepto en práctica, evaluaciones y controles, como señal pedagógica (no prueba de uso de IA).',
      'Huellas de archivos (aplicadas; pendientes de probar con estudiantes reales): una imagen o un PDF que ya subió otro estudiante de la asignatura no se guarda, aunque la imagen tenga otra resolución o compresión; el profesor ve cada coincidencia y puede autorizarla si es un trabajo en grupo.',
      'Clases impartidas (programadas y probadas; pendientes de aplicar y de probar en navegador y teléfono): archivo de las pizarras de cada clase, subidas por el profesor o por quien él autorice, publicadas tras su revisión; y, solo si el profesor lo pide, una versión ampliada con Claude (Haiku, Sonnet u Opus, con el costo estimado antes de confirmar) que también requiere su aprobación, con enlaces a la teoría y registro de los temas aún no desarrollados.',
      'Prácticas de Control (programadas y probadas; pendientes de aplicar en producción y de probar en clase): verificación breve, individual y presencial que el profesor activa desde la asistencia de Orbe Control, con un problema de transferencia distinto para cada estudiante y un ajuste parcial y anunciado de la nota de la práctica (la nota original no se modifica). Incluye VTA (Verificación de Transferencia y Autonomía) en LIEIA, separada de los indicadores de integridad.',
      'Fusión de cuentas duplicadas (programada y probada; pendiente de aplicar): el administrador une dos cuentas del mismo estudiante sin perder datos, con simulación previa exacta, conflictos que decide él (nunca se suma ni se elige la mayor), la cuenta secundaria fusionada y desactivada, bitácora inmutable y reversión cuando nada cambió.',
      'Suspensión automática por inactividad (aplicada; desactivada hasta que el administrador la active): una cuenta de estudiante que pasa 10 días sin usar el aula queda suspendida; la reactiva el profesor o el propio estudiante con «Recuperar acceso» (verificación en persona). Profesores nunca. Se puede pausar en vacaciones.',
      'Tiempo mínimo de realización en prácticas (aplicado; pendiente de probar con estudiantes): el profesor exige minutos de trabajo activo (práctica en pantalla y con actividad, contados por el servidor); antes no se puede entregar y, si se deja sin entregar, al cierre se entrega lo guardado con la nota proporcional al tiempo cumplido. Solo para intentos empezados después de activarlo.',
      'Seguimiento de estudiantes que pueden necesitar apoyo y recordatorios a quien no ha entregado.',
    ],
    pendiente: [
      'Reserva de enunciados (corrección de seguridad programada y probada; pendiente de aplicar): un estudiante ya no podrá leer por consultas directas los enunciados de una práctica, evaluación o control antes de empezar, ni qué ejercicios la componen; en las evaluaciones de una pregunta a la vez solo recibirá las preguntas que el servidor le haya abierto. Los ejercicios publicados en las lecciones siguen siendo material de estudio: si una evaluación los usa, su contenido no es secreto.',
      'Probar el modo de una pregunta a la vez en teléfonos reales.',
      'Orden aleatorio de opciones por actividad (instalado; pendiente de probar en una actividad real): solo cambia la presentación, cada opción conserva su letra.',
      'Centro de IA (programado; pendiente de instalar y de probar con la API real): pida en lenguaje corriente una práctica o un examen («10 problemas de choques, mitad intermedios, que abra el lunes a las 8») y la IA pregunta lo que falte; usted revisa el borrador, el aula elige las preguntas del banco y crea la actividad cuando usted confirma. También desde Orbe Control.',
      'Generar preguntas con IA para el banco (programado; pendiente de instalar y de probar con la API real): por temas, niveles y formatos, de 1 a 300 preguntas, con el coste estimado antes de empezar. Las numéricas llegan con el cálculo y las unidades comprobados en el servidor; todo queda como borrador para que el profesor lo revise.',
      'Exámenes adaptativos (instalados; pendiente de probar con un banco calibrado real): cada estudiante recibe las preguntas una a una según sus respuestas, y la nota es el dominio estimado en todo el banco, no el número de aciertos.',
      'Números distintos para cada estudiante (instalado; pendiente de probar el piloto con estudiantes): en las preguntas con variante, cada intento recibe sus propios datos y el servidor calcula y califica su respuesta, sin enviarla al navegador. Hay un ejercicio piloto en la Unidad 9 (choque totalmente inelástico seguido de frenado).',
    ],
  },
  {
    area: 'Seguimiento',
    hecho: [
      'Dominio por concepto calculado a partir de respuestas verificables (acierto al primer intento, uso de pistas, evaluaciones), no de páginas visitadas.',
      'Estadísticas por actividad y por concepto, libro de calificaciones y exportación a CSV.',
      'Panel de inicio del estudiante: mis cursos, continuar donde lo dejó, próximas actividades, avisos de la sección y del sistema, progreso y calificaciones recientes.',
      'Práctica clásica: lo escrito se copia en el dispositivo hasta que el servidor lo confirma, los guardados fallidos se reintentan y, al volver, se recupera sin sobrescribir lo guardado desde otro dispositivo.',
    ],
    pendiente: [
      'Personalización del aprendizaje y análisis pedagógico avanzado (etapa 3).',
      'Asistencia autónoma por quórum de proximidad (instalada; pendiente de probar con teléfonos en el aula): a la hora de clase, tres estudiantes juntos activan la asistencia sin el profesor; los demás se validan por cercanía a compañeros ya registrados, sin que la zona pueda desplazarse. El profesor conserva todo el control.',
      'Telemetría V2 (instalada; pendiente de probar en navegador y teléfono): reconstrucción científica de cada intento por intervalos (lo observado, lo reconstruido, lo estimado y lo desconocido), historial de guardados de respuestas, instantánea de la entrega, exportación por niveles y monitor. Nace apagada; se activa por asignatura.',
      'Regularización de prácticas anteriores (instalada; pendiente de probar con teléfonos reales): los estudiantes indican qué prácticas entregaron antes del aula, por qué medio y cuándo, con una captura del envío (no el documento); el profesor las localiza en su propio correo con el texto de búsqueda que genera la plataforma, las verifica y las convalida, sin que eso cree notas.',
      'Prácticas realizadas sin envío por correo (instalada; pendiente de probar con teléfonos): cada estudiante registra libremente las prácticas hechas en el cuaderno, en clase o en la pizarra (nombre, total de ejercicios, cuántos hizo y una foto representativa o una explicación); el profesor consolida los nombres equivalentes con sugerencias que él confirma, detecta posibles omisiones, pide evidencia y valida la cantidad verificada. El «cumplimiento declarado» no es una nota.',
      'Acceso sin contraseña y recuperación supervisada (aplicado y publicado, apagado hasta que el profesor lo active; pendiente de probar en producción): passkeys de Supabase Auth («Entrar con passkey», administrar credenciales) y «Recuperar acceso» para estudiantes que olvidaron la contraseña: el profesor o un monitor designado verifica la identidad EN PERSONA y escribe el código del dispositivo del estudiante; la sesión la crea Supabase Auth con un token de un solo uso y se exige contraseña nueva. Permiso de monitores solo por sección y otorgado a mano, suspensión inmediata, alertas y auditoría inmutable (Gestión de acceso estudiantil, en el aula y en Orbe Control).',
      'LIEIA · laboratorio científico (pendiente de probar con exámenes reales): analiza un examen sin clasificación manual, mide lo que los datos permiten (y se abstiene cuando no), ajusta la TRI cuando hay muestra, propone investigaciones que el profesor no había pedido, simula diseños antes de aplicarlos y crea exámenes nuevos como borradores. También instalados: preguntas en lenguaje corriente (por reglas, sin IA), análisis factorial (¿una dimensión o varias?), funcionamiento diferencial entre grupos, calibración progresiva entre aplicaciones e interpretación con IA a través de Orbe IA (Claude recibe solo cifras agregadas, y el servidor descarta lo que cite datos inexistentes, afirme causas o hable de conducta). El diseñador elige preguntas existentes del banco, por defecto solo de los temas de lo analizado.',
    ],
  },
  {
    area: 'Orbe IA (inteligencia artificial del aula)',
    hecho: [
      'Un solo panel para todos los usos de Claude en el aula (interpretación de exámenes en LIEIA, Orbe Control y humor contextual): interruptor general, llamadas reales o simulador sin coste, modelo, presupuesto mensual y límite diario comunes, y consumo por uso (el desglose por uso llega con la migración 54, pendiente de instalar). A Claude nunca le llegan nombres ni identificadores de estudiantes.',
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
