import { Link } from 'react-router-dom';
import { SIMULATIONS } from '@/sims/catalogo';

const BLOQUES = [
  { n: 'I', t: 'Fundamentos', d: 'Magnitudes, unidades, notación científica, mediciones, vectores y gráficas.', ok: true },
  { n: 'II', t: 'Cinemática', d: 'Posición, velocidad, aceleración, caída libre, proyectiles y movimiento circular.', ok: true },
  { n: 'III', t: 'Dinámica', d: 'Leyes de Newton, diagramas de cuerpo libre, fricción, tensión y planos inclinados.', ok: true },
  { n: 'IV', t: 'Energía y cantidad de movimiento', d: 'Trabajo, energía, potencia, impulso y colisiones.', ok: false },
  { n: 'V', t: 'Oscilaciones y ondas', d: 'Resortes, péndulos, ondas mecánicas y sonido.', ok: false },
  { n: 'VI', t: 'Temperatura y termodinámica', d: 'Calor, gases ideales y leyes de la termodinámica.', ok: false },
];

export default function Bienvenida() {
  return (
    <div className="space-y-10">
      <section className="-mx-4 -mt-5 bg-gradient-to-br from-primario-900 via-primario-800 to-primario-700 px-6 py-12 text-white sm:rounded-b-3xl">
        <p className="mb-2 text-sm uppercase tracking-widest text-acento-300">Curso introductorio universitario</p>
        <h1 className="max-w-2xl font-serif text-3xl font-semibold leading-tight sm:text-4xl">Aula Virtual de Física Básica</h1>
        <p className="mt-4 max-w-2xl text-primario-100">
          Teoría explicada con ejemplos cotidianos, ecuaciones interpretadas paso a paso, ejercicios con corrección inmediata y
          experimentos virtuales con gráficas en tiempo real. Solo se necesita álgebra, trigonometría elemental y ganas de razonar.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/ingresar" className="btn-acento">Ingresar con mi ID</Link>
          <Link to="/activar" className="btn border border-white/40 text-white hover:bg-white/10">Activar mi cuenta con la clave de mi sección</Link>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-semibold text-primario-900 dark:text-white">Cómo se aprende aquí</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ['Teoría', 'Ideas físicas antes que fórmulas, con ejemplos de la vida diaria.'],
            ['Fórmulas', 'Cada ecuación con el significado y la unidad de cada variable.'],
            ['Ejemplos', 'Problemas resueltos paso a paso, con comprobación del resultado.'],
            ['Simulación', 'Cambie parámetros y observe el fenómeno y sus gráficas.'],
            ['Práctica', 'Ejercicios con pistas, explicación de errores y refuerzo.'],
          ].map(([t, d], i) => (
            <div key={t} className="tarjeta">
              <p className="font-serif text-3xl text-acento-500">{i + 1}</p>
              <h3 className="font-semibold">{t}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-semibold text-primario-900 dark:text-white">Temario</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BLOQUES.map((b) => (
            <div key={b.n} className={`tarjeta ${b.ok ? '' : 'opacity-70'}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-acento-600">Bloque {b.n}</p>
              <h3 className="font-serif text-lg font-semibold">{b.t}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{b.d}</p>
              {!b.ok && <p className="mt-2 text-xs font-medium text-gray-500">En preparación</p>}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-semibold text-primario-900 dark:text-white">Laboratorio virtual</h2>
        <div className="flex flex-wrap gap-2">
          {SIMULATIONS.map((s) => (
            <span key={s.key} className="rounded-full bg-primario-100 px-3 py-1 text-sm text-primario-800 dark:bg-primario-800/50 dark:text-primario-100">{s.title}</span>
          ))}
        </div>
      </section>

      <section className="tarjeta">
        <h2 className="mb-2 text-xl font-semibold">¿Es usted profesor?</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          El administrador del aula crea las cuentas de profesores y estudiantes. Desde el panel docente se gestionan las asignaturas y
          secciones, se matricula a los estudiantes por su ID, se editan lecciones y ejercicios, se programan prácticas y evaluaciones,
          se revisan respuestas y se exportan las calificaciones.
        </p>
      </section>
    </div>
  );
}
