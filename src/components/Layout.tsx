import { useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useTema } from '@/lib/tema';
import { Spinner } from './ui';

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="Inicio">
      <svg viewBox="0 0 64 64" className="h-9 w-9 shrink-0" aria-hidden>
        <rect width="64" height="64" rx="14" fill="#14284b" />
        <path d="M10 50 Q 32 -2 54 50" fill="none" stroke="#e3ad42" strokeWidth="4" strokeLinecap="round" />
        <circle cx="32" cy="24" r="5" fill="#fff" />
        <path d="M10 52 H54" stroke="#afc4e8" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="leading-tight">
        <span className="block font-serif text-base font-semibold text-white sm:text-lg">Aula Virtual de Física</span>
        <span className="hidden text-xs text-primario-200 sm:block">Comprender · Plantear · Resolver · Experimentar</span>
      </span>
    </Link>
  );
}

function ThemeButton() {
  const [tema, toggle] = useTema();
  return (
    <button onClick={toggle} className="flex h-10 w-10 items-center justify-center rounded-lg text-primario-100 hover:bg-white/10"
      aria-label={tema === 'oscuro' ? 'Activar modo claro' : 'Activar modo oscuro'} title={tema === 'oscuro' ? 'Modo claro' : 'Modo oscuro'}>
      {tema === 'oscuro' ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      )}
    </button>
  );
}

const topLink = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-white/15 text-white' : 'text-primario-100 hover:bg-white/10'}`;

export function Layout() {
  const { session, profile, isTeacher, isAdmin, signOut, loading } = useAuth();
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  const docente = loc.pathname.startsWith('/docente');
  if (loading) return <div className="p-8"><Spinner /></div>;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 bg-primario-900 shadow-md dark:bg-primario-950">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2 sm:px-4">
          <Logo />
          <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Principal">
            {session && (
              <>
                <NavLink to="/" end className={topLink}>Inicio</NavLink>
                <NavLink to="/laboratorio" className={topLink}>Laboratorio</NavLink>
                <NavLink to="/calificaciones" className={topLink}>Calificaciones</NavLink>
                {isTeacher && <NavLink to="/docente" className={topLink}>Panel docente</NavLink>}
                {isAdmin && <NavLink to="/docente/cuentas" className={topLink}>Cuentas</NavLink>}
              </>
            )}
          </nav>
          <div className="ml-auto flex items-center md:ml-2">
            <ThemeButton />
            {session ? (
              <div className="relative">
                <button onClick={() => setMenu((m) => !m)} className="ml-1 flex h-10 items-center gap-2 rounded-lg px-2 text-sm text-white hover:bg-white/10" aria-expanded={menu} aria-haspopup="menu">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-acento-500 font-semibold text-primario-950">
                    {(profile?.full_name || profile?.login_id || '?').trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden max-w-[10rem] truncate lg:inline">{profile?.full_name || profile?.login_id}</span>
                </button>
                {menu && (
                  <div role="menu" className="absolute right-0 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg dark:border-white/10 dark:bg-primario-950" onClick={() => setMenu(false)}>
                    <p className="px-3 py-2 text-xs text-gray-500">ID: {profile?.login_id ?? '—'}<br />{profile?.role === 'admin' ? 'Administrador' : profile?.role === 'teacher' ? 'Profesor' : 'Estudiante'}</p>
                    <Link role="menuitem" to="/perfil" className="block px-3 py-2 hover:bg-gray-100 dark:hover:bg-white/10">Mi perfil</Link>
                    <Link role="menuitem" to="/unirse" className="block px-3 py-2 hover:bg-gray-100 dark:hover:bg-white/10">Unirme a una clase</Link>
                    {isTeacher && <Link role="menuitem" to={docente ? '/' : '/docente'} className="block px-3 py-2 hover:bg-gray-100 dark:hover:bg-white/10 md:hidden">{docente ? 'Vista de estudiante' : 'Panel docente'}</Link>}
                    {isAdmin && <Link role="menuitem" to="/docente/cuentas" className="block px-3 py-2 hover:bg-gray-100 dark:hover:bg-white/10 md:hidden">Cuentas</Link>}
                    <Link role="menuitem" to="/cambiar-clave" className="block px-3 py-2 hover:bg-gray-100 dark:hover:bg-white/10">Cambiar contraseña</Link>
                    <Link role="menuitem" to="/acerca" className="block px-3 py-2 hover:bg-gray-100 dark:hover:bg-white/10">Acerca del aula</Link>
                    <button role="menuitem" onClick={() => void signOut()} className="block w-full px-3 py-2 text-left text-red-700 hover:bg-gray-100 dark:text-red-300 dark:hover:bg-white/10">Cerrar sesión</button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/ingresar" className="btn-acento ml-1 min-h-[40px]">Ingresar</Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-5 md:pb-10">
        {session && profile && !profile.active ? (
          <div className="mx-auto max-w-md tarjeta text-center">
            <h1 className="mb-2 font-serif text-xl font-semibold">Cuenta no habilitada</h1>
            <p className="mb-4 text-sm">Su cuenta está suspendida o todavía no ha sido autorizada. Consulte al profesor o al administrador del aula.</p>
            <button className="btn-secundario" onClick={() => void signOut()}>Salir</button>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
      <footer className="hidden border-t border-gray-200 py-4 text-center text-xs text-gray-500 dark:border-white/10 md:block">
        Aula Virtual de Física · <Link to="/acerca" className="enlace">Estado del desarrollo</Link>
      </footer>
      {session && <BottomNav docente={docente && isTeacher} />}
    </div>
  );
}

function BottomNav({ docente }: { docente: boolean }) {
  const item = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] ${isActive ? 'text-primario-800 dark:text-acento-300' : 'text-gray-500 dark:text-gray-400'}`;
  const icon = (d: ReactNode) => <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-white/10 dark:bg-primario-950 md:hidden" aria-label="Navegación inferior">
      {docente ? (
        <>
          <NavLink to="/docente" end className={item}>{icon(<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />)}Panel</NavLink>
          <NavLink to="/docente/cursos" className={item}>{icon(<path d="M4 5h11a3 3 0 0 1 3 3v12H7a3 3 0 0 1-3-3zM18 8h2v12" />)}Contenido</NavLink>
          <NavLink to="/docente/ejercicios" className={item}>{icon(<path d="M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" />)}Ejercicios</NavLink>
          <NavLink to="/" end className={item}>{icon(<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />)}Estudiante</NavLink>
        </>
      ) : (
        <>
          <NavLink to="/" end className={item}>{icon(<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />)}Inicio</NavLink>
          <NavLink to="/temario" className={item}>{icon(<path d="M4 5h11a3 3 0 0 1 3 3v12H7a3 3 0 0 1-3-3zM18 8h2v12" />)}Temario</NavLink>
          <NavLink to="/laboratorio" className={item}>{icon(<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3" />)}Laboratorio</NavLink>
          <NavLink to="/calificaciones" className={item}>{icon(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />)}Notas</NavLink>
        </>
      )}
    </nav>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Spinner />;
  if (!session) return <Navigate to="/ingresar" replace state={{ from: loc.pathname + loc.search }} />;
  return <>{children}</>;
}

export function RequireTeacher({ children }: { children: ReactNode }) {
  const { session, isTeacher, profile, loading } = useAuth();
  if (loading || (session && !profile)) return <Spinner />;
  if (!session) return <Navigate to="/ingresar" replace />;
  if (!isTeacher) return <p className="py-8 text-center">Esta sección es solo para profesores.</p>;
  return <>{children}</>;
}
