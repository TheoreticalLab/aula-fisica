import { useRef, type ReactNode, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { ASIGNATURAS } from '@/lib/asignaturas';
import { IlustracionPortada } from '@/components/IlustracionPortada';

/** Icono de trazo fino (24×24) */
function Icono({ d }: { d: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d}
    </svg>
  );
}

const PROPUESTA: { titulo: string; texto: string; icono: ReactNode }[] = [
  { titulo: 'Teoría clara', texto: 'Explicaciones breves, con ejemplos de la vida diaria antes que fórmulas.', icono: <path d="M4 5h11a3 3 0 0 1 3 3v12H7a3 3 0 0 1-3-3zM8 9h6M8 13h6" /> },
  { titulo: 'Comprensión conceptual', texto: 'Primero la idea física; después, el cálculo.', icono: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" /> },
  { titulo: 'Fórmulas con sentido', texto: 'Cada ecuación explicada: qué significa cada letra y en qué unidad se mide.', icono: <path d="M5 7h6M8 4v6M14 6l5 5M19 6l-5 5M5 17h6M14 15h5M14 19h5" /> },
  { titulo: 'Ejemplos resueltos', texto: 'Problemas paso a paso, con la comprobación del resultado.', icono: <path d="M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" /> },
  { titulo: 'Práctica que enseña', texto: 'Si se equivoca, el aula le dice por qué: unidades, signos, conversiones…', icono: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /> },
  { titulo: 'Simulaciones', texto: 'Cambie los datos y vea el fenómeno y sus gráficas en tiempo real.', icono: <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3" /> },
  { titulo: 'Su progreso, a la vista', texto: 'Sepa qué conceptos domina y cuáles conviene repasar.', icono: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /> },
];

const PASOS: { titulo: string; texto: string }[] = [
  { titulo: 'Teoría', texto: 'Lea la idea central con ejemplos cotidianos.' },
  { titulo: 'Fórmulas', texto: 'Entienda qué dice cada ecuación y sus unidades.' },
  { titulo: 'Ejemplos', texto: 'Siga un problema resuelto, paso a paso.' },
  { titulo: 'Simulación', texto: 'Experimente: cambie los datos y observe.' },
  { titulo: 'Práctica', texto: 'Resuelva ejercicios con pistas y corrección inmediata.' },
  { titulo: 'Progreso', texto: 'Vea qué domina y repase lo que le cuesta.' },
];

const COLOR = {
  azul: { borde: 'border-t-primario-500', etiqueta: 'text-primario-600 dark:text-primario-300', fondo: 'bg-primario-50 dark:bg-primario-900/40' },
  dorado: { borde: 'border-t-acento-500', etiqueta: 'text-acento-600 dark:text-acento-300', fondo: 'bg-acento-100/70 dark:bg-acento-700/20' },
  verde: { borde: 'border-t-emerald-600', etiqueta: 'text-emerald-700 dark:text-emerald-300', fondo: 'bg-emerald-50 dark:bg-emerald-900/20' },
};

function Titulo({ antetitulo, children, id }: { antetitulo: string; children: ReactNode; id?: string }) {
  return (
    <header className="mb-6 sm:mb-8" id={id}>
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-acento-600 dark:text-acento-300">{antetitulo}</p>
      <h2 className="font-serif text-2xl font-semibold leading-tight text-primario-950 dark:text-white sm:text-3xl">{children}</h2>
    </header>
  );
}

export default function Bienvenida() {
  const comoFunciona = useRef<HTMLElement>(null);
  const acceso = useRef<HTMLElement>(null);
  const ir = (r: RefObject<HTMLElement>) => r.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div>
      {/* ---------- Portada ---------- */}
      <section className="relative overflow-hidden bg-primario-950 text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-acento-500/10 blur-3xl" aria-hidden />
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 pb-12 pt-10 sm:px-8 md:grid-cols-[1.15fr_1fr] md:pb-20 md:pt-16">
          <div>
            <p className="mb-4 text-sm text-primario-200">
              Física Básica · Física General I · Física General III
            </p>
            <h1 className="font-serif text-[2.6rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Aula Virtual
              <br />
              de Física
            </h1>
            <p className="mt-5 font-serif text-xl italic text-acento-300 sm:text-2xl">Entender la física antes que memorizarla.</p>
            <p className="mt-4 max-w-xl text-[1.05rem] leading-relaxed text-primario-100">
              Aquí cada tema se aprende como en una buena clase: primero la idea, luego la ecuación y su sentido, un ejemplo resuelto,
              un experimento para jugar con los datos y ejercicios que le dicen en qué se equivocó.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link to="/ingresar" className="btn-acento px-6 text-base">Ingresar con mi ID</Link>
              <Link to="/activar" className="btn border border-white/40 px-6 text-base text-white hover:bg-white/10">Activar mi cuenta</Link>
              <button type="button" onClick={() => ir(comoFunciona)} className="btn px-3 text-base text-primario-100 underline-offset-4 hover:underline">
                ¿Cómo funciona? ↓
              </button>
            </div>
          </div>
          <IlustracionPortada className="mx-auto w-full max-w-md text-primario-100" />
        </div>
      </section>

      {/* ---------- Propuesta ---------- */}
      <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <Titulo antetitulo="Lo que encontrará">Un aula pensada para comprender, no solo para aprobar</Titulo>
        {/* en el móvil, icono a la izquierda y texto al lado: la lista se lee rápido sin tarjetas altas */}
        <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {PROPUESTA.map((p, i) => (
            <li key={p.titulo} className={`flex gap-4 rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-white/10 dark:bg-white/5 sm:block sm:p-5 ${i === 0 ? 'lg:col-span-2' : ''}`}>
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-acento-100 text-acento-700 dark:bg-acento-700/25 dark:text-acento-200 sm:mb-3">
                <Icono d={p.icono} />
              </span>
              <div>
                <h3 className="font-serif text-lg font-semibold text-primario-950 dark:text-white">{p.titulo}</h3>
                <p className="mt-1 text-[0.95rem] leading-relaxed text-gray-600 dark:text-gray-400">{p.texto}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- Cómo se aprende ---------- */}
      <section ref={comoFunciona} className="scroll-mt-20 border-y border-gray-200/70 bg-white dark:border-white/10 dark:bg-primario-950/40">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
          <Titulo antetitulo="Cómo funciona">Cómo se aprende aquí</Titulo>
          <p className="-mt-3 mb-8 max-w-2xl text-gray-600 dark:text-gray-400">
            Cada lección sigue el mismo recorrido. Puede avanzar a su ritmo y volver atrás cuando lo necesite.
          </p>
          <ol className="relative grid gap-6 md:grid-cols-6 md:gap-4">
            <span className="absolute left-[1.15rem] top-2 h-[calc(100%-1rem)] w-px bg-acento-300 md:left-0 md:top-[1.15rem] md:h-px md:w-full" aria-hidden />
            {PASOS.map((p, i) => (
              <li key={p.titulo} className="relative flex gap-4 md:block">
                <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primario-900 font-serif text-base font-semibold text-acento-300 ring-4 ring-white dark:bg-acento-500 dark:text-primario-950 dark:ring-primario-950">
                  {i + 1}
                </span>
                <div className="md:mt-3">
                  <h3 className="font-semibold text-primario-950 dark:text-white">{p.titulo}</h3>
                  <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{p.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- Asignaturas ---------- */}
      <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <Titulo antetitulo="Asignaturas">Tres cursos, una misma manera de aprender</Titulo>
        <div className="grid gap-5 md:grid-cols-3">
          {ASIGNATURAS.map((a) => {
            const c = COLOR[a.color];
            return (
              <article key={a.codigo} className={`flex flex-col rounded-2xl border border-t-4 border-gray-200/80 bg-white p-6 dark:border-white/10 dark:bg-white/5 ${c.borde}`}>
                <p className={`text-xs font-semibold uppercase tracking-[0.15em] ${c.etiqueta}`}>{a.lema}</p>
                <h3 className="mt-1 font-serif text-2xl font-semibold text-primario-950 dark:text-white">{a.titulo}</h3>
                <p className="mt-3 flex-1 leading-relaxed text-gray-700 dark:text-gray-300">{a.descripcion}</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {a.temas.map((t) => <li key={t} className={`rounded-full px-3 py-1 text-xs font-medium text-primario-900 dark:text-gray-100 ${c.fondo}`}>{t}</li>)}
                </ul>
                <p className={`mt-4 text-sm ${a.disponible ? 'font-medium text-emerald-700 dark:text-emerald-300' : 'text-gray-500'}`}>
                  {a.disponible ? '● ' : '○ '}{a.estado}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      {/* ---------- Acceso ---------- */}
      <section ref={acceso} className="scroll-mt-20 bg-primario-50/70 dark:bg-white/[0.03]">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
          <Titulo antetitulo="Acceso">¿Cómo entro al aula?</Titulo>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-primario-950/60">
              <p className="text-sm font-semibold text-primario-600 dark:text-primario-300">Ya tengo cuenta</p>
              <h3 className="mt-1 font-serif text-xl font-semibold text-primario-950 dark:text-white">Entre con su ID y su contraseña</h3>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Su ID es su matrícula (o el que le indicó su profesor).</p>
              <Link to="/ingresar" className="btn-primario mt-5 w-full sm:w-auto">Ingresar con mi ID</Link>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-primario-950/60">
              <p className="text-sm font-semibold text-acento-600 dark:text-acento-300">Es mi primera vez</p>
              <h3 className="mt-1 font-serif text-xl font-semibold text-primario-950 dark:text-white">Active su cuenta con la clave de su sección</h3>
              <ol className="mt-3 space-y-2 text-gray-700 dark:text-gray-300">
                {['Pida a su profesor la clave de su sección (8 letras y números).', 'Escriba la clave, su matrícula y su nombre.', 'Elija su contraseña. ¡Listo! Ya está dentro de su curso.'].map((t, i) => (
                  <li key={t} className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-acento-200 text-xs font-bold text-acento-700">{i + 1}</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
              <Link to="/activar" className="btn-acento mt-5 w-full sm:w-auto">Activar mi cuenta</Link>
            </div>
          </div>
          <aside className="mt-5 rounded-2xl border border-dashed border-primario-300 p-5 text-sm leading-relaxed text-gray-700 dark:border-white/20 dark:text-gray-300">
            <p className="font-semibold text-primario-950 dark:text-white">¿Problemas para entrar?</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Si olvidó su contraseña, pida a su profesor que la restablezca: le dará una provisional.</li>
              <li>Si la clave de la sección no funciona, puede que la activación ya esté cerrada: consulte a su profesor.</li>
              <li>Tras varios intentos fallidos el acceso se bloquea 15 minutos por seguridad.</li>
            </ul>
          </aside>
        </div>
      </section>
    </div>
  );
}
