import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { Layout, RequireAuth, RequireTeacher } from '@/components/Layout';
import { Spinner } from '@/components/ui';
import { supabaseConfigured } from '@/lib/supabase';
import SinConfigurar from '@/pages/publico/SinConfigurar';
import Bienvenida from '@/pages/publico/Bienvenida';
import { Activar, CambiarClave, Ingresar, SinRegistro } from '@/pages/publico/Acceso';
const Acerca = lazy(() => import('@/pages/publico/Acerca'));

// Estudiante
const Inicio = lazy(() => import('@/pages/estudiante/Inicio'));
const Unirse = lazy(() => import('@/pages/estudiante/Unirse'));
const Temario = lazy(() => import('@/pages/estudiante/Temario'));
const ElegirCurso = lazy(() => import('@/pages/estudiante/ElegirCurso'));
const Leccion = lazy(() => import('@/pages/estudiante/Leccion'));
const Actividad = lazy(() => import('@/pages/estudiante/Actividad'));
const Intento = lazy(() => import('@/pages/estudiante/Intento'));
const Calificaciones = lazy(() => import('@/pages/estudiante/Calificaciones'));
const Evaluaciones = lazy(() => import('@/pages/estudiante/Evaluaciones'));
const Practicar = lazy(() => import('@/pages/estudiante/Evaluaciones').then((m) => ({ default: m.Practicar })));
const Progreso = lazy(() => import('@/pages/estudiante/Progreso'));
const Laboratorio = lazy(() => import('@/pages/estudiante/Laboratorio'));
const Perfil = lazy(() => import('@/pages/estudiante/Perfil'));
const Asistencia = lazy(() => import('@/pages/estudiante/Asistencia'));
const Entregas = lazy(() => import('@/pages/estudiante/Entregas'));
// Docente
const InicioDocente = lazy(() => import('@/pages/docente/InicioDocente'));
const Clase = lazy(() => import('@/pages/docente/Clase'));
const Cursos = lazy(() => import('@/pages/docente/Cursos'));
const CursoEditor = lazy(() => import('@/pages/docente/CursoEditor'));
const LeccionEditor = lazy(() => import('@/pages/docente/LeccionEditor'));
const Banco = lazy(() => import('@/pages/docente/Banco'));
const EjercicioEditor = lazy(() => import('@/pages/docente/EjercicioEditor'));
const ActividadEditor = lazy(() => import('@/pages/docente/ActividadEditor'));
const CrearActividad = lazy(() => import('@/pages/docente/CrearActividad'));
const VistaPrevia = lazy(() => import('@/pages/docente/VistaPrevia'));
const VistaPanel = lazy(() => import('@/pages/docente/VistaPanel'));
const RevisionIntento = lazy(() => import('@/pages/docente/RevisionIntento'));
const FichaEstudiante = lazy(() => import('@/pages/docente/FichaEstudiante'));
const Lieia = lazy(() => import('@/pages/docente/lieia/Lieia'));
const Cuentas = lazy(() => import('@/pages/docente/Cuentas'));
const Analitica = lazy(() => import('@/pages/docente/Analitica'));
const Comunicacion = lazy(() => import('@/pages/docente/Comunicacion'));
const Seguridad = lazy(() => import('@/pages/docente/Seguridad'));
const OrbeIaPanel = lazy(() => import('@/pages/docente/OrbeIa'));
const RegistroCalificaciones = lazy(() => import('@/pages/docente/RegistroCalificaciones'));
const Secretaria = lazy(() => import('@/pages/estudiante/Secretaria'));

function Home() {
  const { session, loading } = useAuth();
  if (loading) return <Spinner />;
  return session ? <Inicio /> : <Bienvenida />;
}

/** Con contraseña provisional, el único sitio accesible es el cambio de contraseña. */
function ForzarCambioClave() {
  const { session, profile } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => {
    if (session && profile?.must_change_password && loc.pathname !== '/cambiar-clave') nav('/cambiar-clave', { replace: true });
  }, [session, profile, loc.pathname, nav]);
  return null;
}

const auth = (el: JSX.Element) => <RequireAuth>{el}</RequireAuth>;
const teacher = (el: JSX.Element) => <RequireTeacher>{el}</RequireTeacher>;

export default function App() {
  if (!supabaseConfigured) return <SinConfigurar />;
  return (
    <AuthProvider>
      <HashRouter>
        <ForzarCambioClave />
        <Suspense fallback={<div className="p-8"><Spinner /></div>}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="ingresar" element={<Ingresar />} />
              <Route path="cambiar-clave" element={<CambiarClave />} />
              <Route path="activar" element={<Activar />} />
              <Route path="registro" element={<SinRegistro />} />
              <Route path="recuperar" element={<SinRegistro />} />
              {/* el estado del desarrollo menciona asignaturas: solo para el profesorado */}
              <Route path="acerca" element={teacher(<Acerca />)} />

              <Route path="unirse" element={auth(<Unirse />)} />
              <Route path="temario" element={auth(<ElegirCurso />)} />
              <Route path="curso/:courseId" element={auth(<Temario />)} />
              <Route path="curso/:courseId/leccion/:lessonId" element={auth(<Leccion />)} />
              <Route path="curso/:courseId/progreso" element={auth(<Progreso />)} />
              <Route path="actividad/:activityId" element={auth(<Actividad />)} />
              <Route path="intento/:attemptId" element={auth(<Intento />)} />
              <Route path="calificaciones" element={auth(<Calificaciones />)} />
              <Route path="evaluaciones" element={auth(<Evaluaciones />)} />
              <Route path="practicar" element={auth(<Practicar />)} />
              <Route path="laboratorio" element={auth(<Laboratorio />)} />
              <Route path="laboratorio/:simKey" element={auth(<Laboratorio />)} />
              <Route path="perfil" element={auth(<Perfil />)} />
              <Route path="asistencia" element={auth(<Asistencia />)} />
              <Route path="entregas" element={auth(<Entregas />)} />

              <Route path="docente" element={teacher(<InicioDocente />)} />
              <Route path="docente/clases/:classId" element={teacher(<Clase />)} />
              <Route path="docente/cursos" element={teacher(<Cursos />)} />
              <Route path="docente/cursos/:courseId" element={teacher(<CursoEditor />)} />
              <Route path="docente/lecciones/:lessonId" element={teacher(<LeccionEditor />)} />
              <Route path="docente/ejercicios" element={teacher(<Banco />)} />
              <Route path="docente/ejercicios/:exerciseId" element={teacher(<EjercicioEditor />)} />
              <Route path="docente/actividades/:activityId" element={teacher(<ActividadEditor />)} />
              <Route path="docente/clases/:classId/nueva-actividad" element={teacher(<CrearActividad />)} />
              <Route path="docente/actividades/:activityId/vista-previa" element={teacher(<VistaPrevia />)} />
              <Route path="docente/clases/:classId/vista-estudiante" element={teacher(<VistaPanel />)} />
              <Route path="docente/intentos/:attemptId" element={teacher(<RevisionIntento />)} />
              <Route path="docente/clases/:classId/estudiantes/:userId" element={teacher(<FichaEstudiante />)} />
              <Route path="docente/estudiantes/:userId" element={teacher(<FichaEstudiante />)} />
              <Route path="docente/lieia" element={teacher(<Lieia />)} />
              <Route path="docente/cuentas" element={teacher(<Cuentas />)} />
              <Route path="docente/analitica" element={teacher(<Analitica />)} />
              <Route path="docente/comunicacion" element={teacher(<Comunicacion />)} />
              <Route path="docente/seguridad" element={teacher(<Seguridad />)} />
              <Route path="docente/orbe-ia" element={teacher(<OrbeIaPanel />)} />
              <Route path="docente/clases/:classId/registro" element={teacher(<RegistroCalificaciones />)} />
              <Route path="secretaria" element={auth(<Secretaria />)} />
              <Route path="docente/usuarios" element={<Navigate to="/docente/cuentas" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </HashRouter>
    </AuthProvider>
  );
}
