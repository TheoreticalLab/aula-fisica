/**
 * Panel del estudiante (vista). Recibe los datos ya preparados; la carga está en Inicio.tsx.
 * Orden pensado para el móvil: continuar → avisos → mis cursos → próximas actividades → progreso → accesos.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { MyActivity, MyGrade } from '@/api/tipos';
import { fecha, porcentaje, puntaje, relativo } from '@/lib/util';

export interface CursoPanel {
  classId: string;
  courseId: string;
  curso: string;
  seccion: string;
  profesores: string[];
  lecciones: number;
  practicaResuelta: number;
  practicaTotal: number;
  dominio: number | null;
  dominados: number;
  dificultad: number;
  siguiente: { lessonId: string; titulo: string } | null;
}

export interface ContinuarItem {
  tipo: 'leccion' | 'practica' | 'actividad';
  titulo: string;
  detalle: string;
  enlace: string;
}

export interface AvisoPanel {
  id: string;
  titulo: string;
  cuerpo: string;
  origen: string;
  fecha: string;
  fijado: boolean;
  automatico: boolean;
  enlace?: string;
}

export interface DatosPanel {
  nombre: string;
  esProfesor: boolean;
  cursos: CursoPanel[];
  continuar: ContinuarItem[];
  actividades: MyActivity[];
  avisos: AvisoPanel[];
  notas: MyGrade[];
}

function Bloque({ titulo, accion, children, className = '' }: { titulo: string; accion?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-serif text-xl font-semibold text-primario-950 dark:text-white">{titulo}</h2>
        {accion}
      </div>
      {children}
    </section>
  );
}

function Barra({ valor, color = 'bg-primario-600 dark:bg-primario-400' }: { valor: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round(Math.max(0, Math.min(1, valor)) * 100)}%` }} />
    </div>
  );
}

function saludo(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

const ICONO_CONTINUAR = { leccion: '📖', practica: '✏️', actividad: '📝' } as const;

export function PanelEstudiante({ d }: { d: DatosPanel }) {
  const ahora = Date.now();
  const proximas = d.actividades
    .filter((a) => !a.closes_at || new Date(a.closes_at).getTime() > ahora)
    .sort((a, b) => (a.closes_at ? new Date(a.closes_at).getTime() : Infinity) - (b.closes_at ? new Date(b.closes_at).getTime() : Infinity))
    .slice(0, 5);
  const totalDom = d.cursos.reduce((s, c) => s + c.dominados, 0);
  const totalDif = d.cursos.reduce((s, c) => s + c.dificultad, 0);

  return (
    <div className="space-y-8 pb-4">
      {/* Saludo */}
      <header className="-mx-4 -mt-5 bg-primario-950 px-5 pb-6 pt-6 text-white sm:rounded-b-3xl sm:px-8">
        <p className="text-sm text-primario-200">{saludo()},</p>
        <h1 className="font-serif text-3xl font-semibold leading-tight">{d.nombre || 'estudiante'}</h1>
        <p className="mt-1 text-sm text-primario-200">
          {d.cursos.length ? `${d.cursos.length === 1 ? 'Su curso' : `Sus ${d.cursos.length} cursos`}: ${d.cursos.map((c) => c.curso).join(' · ')}` : 'Todavía no está en ningún curso.'}
          {d.esProfesor && <> · <Link to="/docente" className="underline">Panel docente</Link></>}
        </p>
        <nav className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Acceso rápido">
          {[
            ['Mis cursos', '/temario'],
            ['Laboratorio', '/laboratorio'],
            ['Calificaciones', '/calificaciones'],
            ...(d.cursos[0] ? [['Mi progreso', `/curso/${d.cursos[0].courseId}/progreso`]] : []),
            ['Mi perfil', '/perfil'],
          ].map(([t, to]) => (
            <Link key={to} to={to} className="whitespace-nowrap rounded-full bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20">{t}</Link>
          ))}
        </nav>
      </header>

      {!d.cursos.length && (
        <div className="rounded-2xl border border-dashed border-primario-300 p-6 text-center">
          <p className="font-serif text-lg font-semibold">Únase a su sección</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Pida al profesor la clave de su sección y escríbala aquí.</p>
          <Link to="/unirse" className="btn-primario mt-4">Escribir la clave de mi sección</Link>
        </div>
      )}

      {/* Continuar */}
      {d.continuar.length > 0 && (
        <Bloque titulo="Continuar donde lo dejé">
          <ul className="space-y-3">
            {d.continuar.map((c, i) => (
              <li key={c.enlace + i}>
                <Link to={c.enlace} className={`flex items-center gap-4 rounded-2xl p-4 transition hover:-translate-y-0.5 ${i === 0 ? 'bg-acento-100 dark:bg-acento-700/25' : 'border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5'}`}>
                  <span className="text-2xl" aria-hidden>{ICONO_CONTINUAR[c.tipo]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-primario-950 dark:text-white">{c.titulo}</span>
                    <span className="block truncate text-sm text-gray-600 dark:text-gray-400">{c.detalle}</span>
                  </span>
                  <span className="text-xl text-primario-700 dark:text-acento-300" aria-hidden>→</span>
                </Link>
              </li>
            ))}
          </ul>
        </Bloque>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-8">
          {/* Avisos */}
          {d.avisos.length > 0 && (
            <Bloque titulo="Avisos">
              <ul className="space-y-3">
                {d.avisos.map((a) => {
                  const contenido = (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-primario-950 dark:text-white">{a.fijado && '📌 '}{a.titulo}</p>
                        <span className="shrink-0 text-xs text-gray-500">{relativo(a.fecha)}</span>
                      </div>
                      {a.cuerpo && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-gray-300">{a.cuerpo}</p>}
                      <p className="mt-1 text-xs text-gray-500">{a.origen}</p>
                    </>
                  );
                  const cls = `block rounded-2xl border-l-4 bg-white p-4 dark:bg-white/5 ${a.automatico ? 'border-primario-300' : 'border-acento-500'}`;
                  return <li key={a.id}>{a.enlace ? <Link to={a.enlace} className={cls}>{contenido}</Link> : <div className={cls}>{contenido}</div>}</li>;
                })}
              </ul>
            </Bloque>
          )}

          {/* Mis cursos */}
          {d.cursos.length > 0 && (
            <Bloque titulo="Mis cursos">
              <ul className="grid gap-4 sm:grid-cols-2">
                {d.cursos.map((c) => (
                  <li key={c.classId} className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-acento-600 dark:text-acento-300">{c.seccion}</p>
                    <h3 className="font-serif text-xl font-semibold text-primario-950 dark:text-white">{c.curso}</h3>
                    {c.profesores.length > 0 && <p className="text-sm text-gray-500">Docente: {c.profesores.join(', ')}</p>}
                    {c.lecciones > 0 ? (
                      <div className="mt-4 space-y-2 text-sm">
                        <div>
                          <div className="mb-1 flex justify-between text-gray-600 dark:text-gray-400"><span>Ejercicios resueltos</span><span>{c.practicaResuelta}/{c.practicaTotal}</span></div>
                          <Barra valor={c.practicaTotal ? c.practicaResuelta / c.practicaTotal : 0} />
                        </div>
                        <div>
                          <div className="mb-1 flex justify-between text-gray-600 dark:text-gray-400"><span>Dominio de conceptos</span><span>{c.dominio === null ? 'sin datos' : porcentaje(c.dominio)}</span></div>
                          <Barra valor={c.dominio ?? 0} color="bg-emerald-600" />
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-gray-500">Las lecciones de este curso están en preparación.</p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link to={`/curso/${c.courseId}`} className="btn-primario min-h-[40px] flex-1 whitespace-nowrap text-sm">Entrar al curso</Link>
                      {c.siguiente && (
                        <Link to={`/curso/${c.courseId}/leccion/${c.siguiente.lessonId}`} className="btn-secundario min-h-[40px] flex-1 whitespace-nowrap text-sm" title={c.siguiente.titulo}>
                          Siguiente lección
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Bloque>
          )}
        </div>

        <div className="space-y-8">
          {/* Próximas actividades */}
          <Bloque titulo="Próximas actividades">
            {proximas.length ? (
              <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-white/5">
                {proximas.map((a) => {
                  const pronto = a.closes_at && new Date(a.closes_at).getTime() - ahora < 48 * 3600_000;
                  return (
                    <li key={a.id}>
                      <Link to={a.in_progress ? `/intento/${a.in_progress}` : `/actividad/${a.id}`} className="block p-4 hover:bg-gray-50 dark:hover:bg-white/5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-primario-950 dark:text-white">{a.title}</p>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${a.mode === 'exam' ? 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200' : 'bg-primario-100 text-primario-800 dark:bg-primario-800/50 dark:text-primario-100'}`}>
                            {a.mode === 'exam' ? 'Evaluación' : 'Práctica'}
                          </span>
                        </div>
                        <p className={`mt-1 text-sm ${pronto ? 'font-medium text-red-700 dark:text-red-300' : 'text-gray-500'}`}>
                          {a.submitted ? 'Entregada · ' : a.in_progress ? 'En curso · ' : ''}
                          {a.closes_at ? `Cierra ${relativo(a.closes_at)} (${fecha(a.closes_at)})` : 'Sin fecha límite'}
                        </p>
                        <p className="text-xs text-gray-500">{a.class_name}</p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-white/15">No tiene actividades pendientes. 🎉</p>
            )}
          </Bloque>

          {/* Progreso */}
          {d.cursos.some((c) => c.lecciones > 0) && (
            <Bloque titulo="Mi progreso">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-900/20">
                    <p className="text-3xl font-semibold text-emerald-700 dark:text-emerald-300">{totalDom}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">conceptos dominados</p>
                  </div>
                  <div className="rounded-xl bg-red-50 p-3 dark:bg-red-900/20">
                    <p className="text-3xl font-semibold text-red-700 dark:text-red-300">{totalDif}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">para reforzar</p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-gray-500">
                  Se calcula con sus respuestas: acertar al primer intento cuenta más que acertar tras varios intentos o con pistas.
                </p>
                {d.cursos[0] && <Link to={`/curso/${d.cursos[0].courseId}/progreso`} className="enlace mt-2 inline-block text-sm">Ver detalle por concepto →</Link>}
              </div>
            </Bloque>
          )}

          {/* Notas recientes */}
          {d.notas.length > 0 && (
            <Bloque titulo="Calificaciones recientes" accion={<Link to="/calificaciones" className="text-sm enlace">Todas</Link>}>
              <ul className="space-y-2">
                {d.notas.slice(0, 3).map((g) => (
                  <li key={g.activity_id} className="flex items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 text-sm dark:bg-white/5">
                    <span className="truncate">{g.title}</span>
                    <span className="font-semibold tabular-nums">{puntaje(g.best_score, g.max_score)}</span>
                  </li>
                ))}
              </ul>
            </Bloque>
          )}
        </div>
      </div>
    </div>
  );
}
