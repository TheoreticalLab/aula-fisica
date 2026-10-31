/** «Mi cuenta»: todo lo personal en una sola página (progreso por asignatura, perfil, seguridad, trámites y ayuda). */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { myClasses } from '@/api/estudiante';
import { useAsync } from '@/lib/util';
import { PageTitle } from '@/components/ui';

function Acceso({ to, icono, titulo, texto }: { to: string; icono: string; titulo: string; texto: ReactNode }) {
  return (
    <Link to={to} className="tarjeta flex min-h-[72px] items-center gap-3 hover:border-primario-400">
      <span className="text-2xl" aria-hidden>{icono}</span>
      <span><span className="block font-medium">{titulo}</span><span className="block text-xs text-gray-500">{texto}</span></span>
    </Link>
  );
}

export default function Cuenta() {
  const { profile, signOut } = useAuth();
  const clases = useAsync(() => myClasses(), []);
  const activas = (clases.data ?? []).filter((c) => !c.archived);
  const cursos = [...new Map(activas.map((c) => [c.course_id, c])).values()];
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageTitle title="Mi cuenta" subtitle={profile?.full_name} />

      {cursos.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Mi progreso</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {cursos.map((c) => <Acceso key={c.course_id} to={`/curso/${c.course_id}/progreso`} icono="📈" titulo={c.course_title} texto={`Dominio por concepto · ${c.name}`} />)}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">Mis cosas</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Acceso to="/calificaciones" icono="📊" titulo="Calificaciones" texto="Notas publicadas por sus profesores." />
          <Acceso to="/asistencia" icono="✅" titulo="Asistencia" texto="Marcar presencia y ver su registro." />
          <Acceso to="/entregas" icono="📎" titulo="Entregas en PDF" texto="Subir trabajos a los buzones de la sección." />
          <Acceso to="/laboratorio" icono="🧪" titulo="Laboratorio virtual" texto="Simuladores de física." />
          <Acceso to="/unirse" icono="➕" titulo="Unirme a una clase" texto="Con el código que le dio su profesor." />
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Cuenta y seguridad</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Acceso to="/perfil" icono="👤" titulo="Mi perfil" texto="Datos, sesiones abiertas y dispositivos." />
          <Acceso to="/cambiar-clave" icono="🔑" titulo="Cambiar contraseña" texto="Use una contraseña que no use en otro sitio." />
          <Acceso to="/ayuda" icono="❓" titulo="Ayuda" texto="Cómo navegar, responder, pausar y entregar." />
        </div>
        <p className="mt-2 text-xs text-gray-500">El modo claro u oscuro se cambia con el botón del sol o la luna de la barra superior.</p>
      </section>

      <button className="btn-secundario w-full text-red-700 dark:text-red-300 sm:w-auto" onClick={() => void signOut()}>Cerrar sesión</button>
    </div>
  );
}
