/**
 * Aviso al entrar: «Regularización de prácticas anteriores pendiente».
 * Aparece al principio de CADA acceso (cada vez que se abre la plataforma o se inicia sesión) mientras el estudiante no
 * haya marcado que terminó en una sección donde está abierta (y el profesor no haya desactivado el recordatorio), o
 * mientras tenga una aclaración pendiente. «Más tarde» lo cierra solo durante esa visita.
 * No interrumpe exámenes ni prácticas en curso.
 */
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { pendientes, type Pendiente } from '@/api/regularizacion';

const EXCLUIDAS = /^\/(practicas-anteriores|intento\/|actividad\/|cambiar-clave)/;

export function RecordatorioRegularizacion({ pausado = false }: { pausado?: boolean }) {
  const { session, isTeacher } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [lista, setLista] = useState<Pendiente[] | null>(null);
  // una clave por inicio de sesión y por pestaña: cada acceso nuevo vuelve a mostrar el aviso
  const clave = session ? `aula:recordatorio-regularizacion:${session.user.id}:${session.user.last_sign_in_at ?? ''}` : null;
  const excluida = EXCLUIDAS.test(loc.pathname);
  const visto = clave ? sessionStorage.getItem(clave) === '1' : true;

  useEffect(() => {
    if (!clave || isTeacher || visto || excluida || pausado || lista !== null) return;
    let vivo = true;
    pendientes().then((p) => { if (vivo) setLista(p); }).catch(() => undefined);
    return () => { vivo = false; };
  }, [clave, isTeacher, visto, excluida, pausado, lista]);

  if (!clave || isTeacher || visto || excluida || pausado || !lista?.length) return null;
  const cerrar = () => { sessionStorage.setItem(clave, '1'); setLista([]); };
  const aclaraciones = lista.reduce((s, p) => s + p.aclaraciones, 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center">
      <div role="alertdialog" aria-modal="true" aria-labelledby="rec-reg-titulo"
        className="w-full rounded-t-2xl bg-white p-5 shadow-xl dark:bg-primario-950 sm:max-w-lg sm:rounded-2xl">
        <p className="text-3xl" aria-hidden="true">🗂️</p>
        <h2 id="rec-reg-titulo" className="mt-1 font-serif text-xl font-semibold">Regularización de prácticas anteriores pendiente</h2>
        <p className="mt-2 text-sm">
          El profesor necesita que indiques qué prácticas le entregaste antes del aula virtual, con una captura del envío. No tienes que volver a subir los trabajos.
        </p>
        <ul className="mt-3 space-y-1 text-sm">
          {lista.map((p) => (
            <li key={p.class_id} className="rounded-lg bg-gray-100 px-3 py-2 dark:bg-white/10">
              <span className="font-medium">{p.course_title} · {p.class_name}</span>
              <span className="block text-xs text-gray-600 dark:text-gray-300">
                {p.aclaraciones > 0 ? `El profesor pide una aclaración en ${p.aclaraciones} registro(s). ` : ''}
                {p.sin_terminar ? (p.registradas ? `Llevas ${p.registradas} registrada(s); cuando termines, pulsa «Terminé».` : 'Aún no has registrado ninguna práctica.') : ''}
                {p.borradores ? ` Tienes ${p.borradores} borrador(es) sin enviar.` : ''}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-gray-500">Este aviso aparecerá cada vez que entres hasta que marques que terminaste{aclaraciones ? ' y respondas las aclaraciones' : ''}.</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button className="btn-primario flex-1" onClick={() => { cerrar(); nav('/practicas-anteriores'); }}>Regularizar ahora</button>
          <button className="btn-secundario" onClick={cerrar}>Más tarde</button>
        </div>
      </div>
    </div>
  );
}
