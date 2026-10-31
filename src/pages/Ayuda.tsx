/** Guía breve dentro de la aplicación: para estudiantes y, si es profesor, también para el profesorado. */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { PageTitle } from '@/components/ui';

function Tema({ titulo, children, abierto = false }: { titulo: string; children: ReactNode; abierto?: boolean }) {
  return (
    <details className="tarjeta group" open={abierto}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-medium">
        {titulo}<span className="text-gray-400 transition group-open:rotate-180" aria-hidden>▾</span>
      </summary>
      <div className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">{children}</div>
    </details>
  );
}

const Pasos = ({ children }: { children: ReactNode }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>;

export default function Ayuda() {
  const { isTeacher } = useAuth();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageTitle title="Ayuda" subtitle="Guía breve para usar el aula. Toque un tema para abrirlo." />

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Para estudiantes</h2>
        <Tema titulo="¿Dónde está cada cosa?" abierto={!isTeacher}>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Inicio</strong>: lo pendiente, sus cursos y avisos.</li>
            <li><strong>Aprender</strong>: el temario con la teoría y la práctica de cada lección.</li>
            <li><strong>Practicar</strong>: prácticas asignadas. Puede comprobar, usar pistas y repetir.</li>
            <li><strong>Evaluaciones</strong>: exámenes y quizzes calificables. Se entregan una vez.</li>
            <li><strong>Asistencia</strong>: marcar presencia en clase y ver su registro.</li>
            <li><strong>Mi cuenta</strong>: calificaciones, progreso por asignatura, entregas en PDF, perfil y contraseña.</li>
          </ul>
        </Tema>
        <Tema titulo="Cómo hacer una evaluación de «una pregunta a la vez»">
          <Pasos>
            <li>Abra la evaluación y lea el recuadro <strong>«Antes de empezar»</strong>: duración, si puede volver atrás y si hay pausas.</li>
            <li>Pulse <strong>Comenzar</strong>. Si hay límite de tiempo, el reloj empieza en ese momento y lo lleva el servidor (sigue aunque cierre la página).</li>
            <li>Responda la pregunta en pantalla. Arriba verá <strong>«Guardado ✓»</strong>: no hace falta pulsar nada para guardar.</li>
            <li>Use <strong>Siguiente</strong> y <strong>Anterior</strong>, o los números de arriba. Con <strong>Marcar</strong> (🚩) señala las que quiere revisar.</li>
            <li>Al final, <strong>Revisar y entregar</strong> muestra cuáles faltan. Pulse <strong>Entregar el examen</strong>.</li>
          </Pasos>
          <p>Si el tiempo se acaba, se entrega sola lo que haya guardado.</p>
        </Tema>
        <Tema titulo="Prácticas con aprendizaje asistido (Intentar → Aprender → Explicar → Comprobar)">
          <Pasos>
            <li><strong>Intentar</strong>: resuélvelo primero por tu cuenta (o marca «No sé resolverlo todavía») y di cómo lo hiciste. Tu primera respuesta queda guardada tal cual.</li>
            <li><strong>Aprender</strong>: ahora puedes usar IA, libros, apuntes o preguntar a alguien. Corrige tu respuesta y pulsa «Guardar mi corrección».</li>
            <li><strong>Explicar</strong>: con tus palabras, qué aprendiste o dónde estaba el error, y qué ayudas usaste.</li>
            <li><strong>Comprobar</strong> (si está activado): un ejercicio nuevo con el mismo concepto, una sola vez.</li>
          </Pasos>
          <p>No necesitas acertar al principio. Declarar que usaste ayuda no te quita puntos, y decir que no la usaste no te da puntos extra.</p>
        </Tema>
        <Tema titulo="¿Y si se va la internet o se cierra la página?">
          <p>Siga respondiendo: verá «Sin conexión: guardado en este dispositivo». Las respuestas se envían solas cuando vuelve la red.</p>
          <p>Si se cierra la página o se apaga el teléfono, vuelva a entrar en la evaluación: continúa en la misma pregunta, con sus respuestas. El reloj oficial no se detiene mientras está fuera (salvo durante una pausa permitida).</p>
        </Tema>
        <Tema titulo="Pausas">
          <p>Si el profesor las permite, verá el botón <strong>⏸ Pausar</strong>. Durante la pausa las preguntas se ocultan y no se puede responder. Pulse <strong>Reanudar</strong> para seguir. El recuadro «Antes de empezar» indica cuántas pausas tiene y si detienen el reloj.</p>
        </Tema>
        <Tema titulo="Escribir respuestas numéricas con unidades">
          <p>Escriba el número y la unidad: <code>9.8 m/s^2</code>, <code>1.2e3 N</code>, <code>10290 J</code>. Puede usar coma o punto decimal y las teclas rápidas bajo el campo.</p>
          <p>Respete las mayúsculas de los símbolos (J, N, W, Pa). Si escribe «j», normalmente se entenderá como J y se le avisará de que el símbolo correcto es «J».</p>
        </Tema>
      </section>

      {isTeacher && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Para el profesorado</h2>
          <Tema titulo="Crear una práctica o un examen en 4 pasos" abierto>
            <Pasos>
              <li>Panel docente → <strong>+ Crear actividad</strong> (o, en la sección, pestaña Actividades).</li>
              <li><strong>Tipo</strong>: elija una plantilla (práctica libre, tarea con fecha, quiz rápido, examen parcial, examen estricto o en blanco).</li>
              <li><strong>Preguntas</strong>: márquelas en el banco (puede filtrar por lección y dificultad) o déjelo para después.</li>
              <li><strong>Reglas</strong>: título, fechas y, si es examen, duración y navegación. Lo demás está en «Opciones avanzadas».</li>
              <li><strong>Revisar</strong>: lea el resumen y pulse <strong>Crear y publicar</strong> o <strong>Guardar borrador</strong>.</li>
            </Pasos>
            <p>Antes de publicar un examen, ábralo con <strong>👁 Vista previa como estudiante</strong>.</p>
          </Tema>
          <Tema titulo="Prácticas con aprendizaje asistido">
            <p>Para que el uso de IA sirva para aprender: el estudiante intenta solo (y declara cómo), aprende con ayuda y corrige, explica lo aprendido y, si lo activa, resuelve un ejercicio de transferencia.</p>
            <Pasos>
              <li>+ Crear actividad → <strong>Práctica con aprendizaje asistido</strong>.</li>
              <li>Configuración → <strong>Aprendizaje asistido</strong>: elija el ejercicio de transferencia de cada pregunta; en opciones avanzadas, los pesos (20/30/20/30, editables) y una verificación posterior.</li>
              <li>Resultados → <strong>Proceso de aprendizaje</strong>: primera y segunda respuesta lado a lado, ayudas, cambio, explicación, transferencia y retención.</li>
            </Pasos>
            <p>La declaración de uso de IA no cambia la nota y no es una prueba de nada; tampoco una explicación «que parece de IA».</p>
          </Tema>
          <Tema titulo="Durante un examen: seguimiento en vivo y prórrogas">
            <p>En la actividad, pestaña <strong>Resultados</strong>, el panel <strong>En vivo</strong> muestra quién está respondiendo, en pausa o sin conexión, en qué pregunta va y cuánto le queda.</p>
            <p>Para dar más tiempo a un estudiante (conexión caída, adaptación), pulse <strong>+5 min</strong> en su fila. Puede escribir un motivo; queda registrado.</p>
          </Tema>
          <Tema titulo="Después: revisar, calificar y publicar notas">
            <Pasos>
              <li>Las respuestas de desarrollo aparecen en <strong>Respuestas por revisar</strong> (panel docente) y en la pestaña <strong>Revisión manual</strong> de la sección.</li>
              <li>En cada intento verá el <strong>tiempo por pregunta</strong> (trabajo, pausas, página oculta…). Es una descripción del proceso, no una prueba de nada.</li>
              <li>Cuando quiera que los estudiantes vean su nota, marque <strong>Calificaciones publicadas</strong> en la configuración de la actividad y guarde.</li>
              <li>Si quedaron intentos abiertos tras el cierre, en Resultados use <strong>Entregar y calificar</strong>.</li>
            </Pasos>
          </Tema>
          <Tema titulo="Seguimiento de estudiantes">
            <p>La pestaña <strong>Seguimiento</strong> de cada sección lista a quien puede necesitar apoyo: actividades cerradas sin entregar, cierres próximos, promedio por debajo del 70 % o notas bajando. Desde ahí puede abrir su ficha o escribirle.</p>
            <p>En los Resultados de cada actividad, <strong>Pendientes de entregar</strong> permite enviar un recordatorio a quien falta.</p>
          </Tema>
          <Tema titulo="Modo de examen: qué significa cada opción">
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Una pregunta a la vez</strong>: reloj oficial, tiempo por pregunta y recuperación tras desconexiones. «Todas en una página» es el modo clásico.</li>
              <li><strong>Navegación libre</strong>: se puede volver. <strong>Solo hacia adelante</strong>: una pregunta vista no se reabre ni se cambia (lo impone el servidor).</li>
              <li><strong>Duración</strong>: cuenta desde que el estudiante empieza; nunca pasa del cierre de la actividad.</li>
              <li><strong>Pausas</strong>: número y minutos en total; las preguntas se ocultan durante la pausa. Si «detienen el reloj», el límite se desplaza por la pausa usada.</li>
            </ul>
          </Tema>
          <Tema titulo="Indicadores de integridad (LIEIA)">
            <p>Los indicadores del laboratorio LIEIA son <strong>experimentales</strong>: describen qué tan inusual sería un patrón, no prueban nada y nunca deciden una calificación. D6 v1 está retirado; D6 v2 no se usa con datos reales hasta tener una referencia validada.</p>
          </Tema>
          <p className="text-sm text-gray-500">Más detalle técnico: <code>docs/MOTOR_EXAMEN.md</code>, <code>docs/TELEMETRIA.md</code>, <code>docs/CENTRO_DATOS.md</code>. Estado del desarrollo: <Link className="enlace" to="/acerca">Acerca</Link>.</p>
        </section>
      )}
    </div>
  );
}
