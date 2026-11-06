import { Suspense, useEffect } from 'react';
import { lazyConRecarga } from '@/lib/recargaVersion';
import { ErrorCarga } from '@/components/ErrorCarga';
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { Layout, RequireAuth, RequireTeacher } from '@/components/Layout';
import { Spinner } from '@/components/ui';
import { supabaseConfigured } from '@/lib/supabase';
import SinConfigurar from '@/pages/publico/SinConfigurar';
import Bienvenida from '@/pages/publico/Bienvenida';
import { Activar, CambiarClave, Ingresar, SinRegistro } from '@/pages/publico/Acceso';
const Acerca = lazyConRecarga(() => import('@/pages/publico/Acerca'));

// Estudiante
const Inicio = lazyConRecarga(() => import('@/pages/estudiante/Inicio'));
const Unirse = lazyConRecarga(() => import('@/pages/estudiante/Unirse'));
const Temario = lazyConRecarga(() => import('@/pages/estudiante/Temario'));
const ElegirCurso = lazyConRecarga(() => import('@/pages/estudiante/ElegirCurso'));
const Leccion = lazyConRecarga(() => import('@/pages/estudiante/Leccion'));
const Actividad = lazyConRecarga(() => import('@/pages/estudiante/Actividad'));
const Intento = lazyConRecarga(() => import('@/pages/estudiante/Intento'));
const Calificaciones = lazyConRecarga(() => import('@/pages/estudiante/Calificaciones'));
const Ayuda = lazyConRecarga(() => import('@/pages/Ayuda'));
const Cuenta = lazyConRecarga(() => import('@/pages/estudiante/Cuenta'));
const Evaluaciones = lazyConRecarga(() => import('@/pages/estudiante/Evaluaciones'));
const PracticaExtraordinaria = lazyConRecarga(() => import('@/pages/estudiante/PracticaExtraordinaria'));
const Practicar = lazyConRecarga(() => import('@/pages/estudiante/Evaluaciones').then((m) => ({ default: m.Practicar })));
const Progreso = lazyConRecarga(() => import('@/pages/estudiante/Progreso'));
const Laboratorio = lazyConRecarga(() => import('@/pages/estudiante/Laboratorio'));
const Perfil = lazyConRecarga(() => import('@/pages/estudiante/Perfil'));
const Asistencia = lazyConRecarga(() => import('@/pages/estudiante/Asistencia'));
const Entregas = lazyConRecarga(() => import('@/pages/estudiante/Entregas'));
const Regularizacion = lazyConRecarga(() => import('@/pages/estudiante/Regularizacion'));
const Clases = lazyConRecarga(() => import('@/pages/clases/Clases'));
const ClaseDetalle = lazyConRecarga(() => import('@/pages/clases/ClaseDetalle'));
const RegistrarClase = lazyConRecarga(() => import('@/pages/clases/RegistrarClase'));
const ClaseAdmin = lazyConRecarga(() => import('@/pages/docente/ClaseAdmin'));
// Docente
const InicioDocente = lazyConRecarga(() => import('@/pages/docente/InicioDocente'));
const Clase = lazyConRecarga(() => import('@/pages/docente/Clase'));
const PesEditor = lazyConRecarga(() => import('@/pages/docente/PesEditor'));
const PesSimulador = lazyConRecarga(() => import('@/pages/docente/PesSimulador'));
const Cursos = lazyConRecarga(() => import('@/pages/docente/Cursos'));
const CursoEditor = lazyConRecarga(() => import('@/pages/docente/CursoEditor'));
const LeccionEditor = lazyConRecarga(() => import('@/pages/docente/LeccionEditor'));
const Banco = lazyConRecarga(() => import('@/pages/docente/Banco'));
const GenerarPreguntas = lazyConRecarga(() => import('@/pages/docente/GenerarPreguntas'));
const CentroIA = lazyConRecarga(() => import('@/pages/docente/CentroIA'));
const EjercicioEditor = lazyConRecarga(() => import('@/pages/docente/EjercicioEditor'));
const ActividadEditor = lazyConRecarga(() => import('@/pages/docente/ActividadEditor'));
const CrearActividad = lazyConRecarga(() => import('@/pages/docente/CrearActividad'));
const VistaPrevia = lazyConRecarga(() => import('@/pages/docente/VistaPrevia'));
const VistaPanel = lazyConRecarga(() => import('@/pages/docente/VistaPanel'));
const RevisionIntento = lazyConRecarga(() => import('@/pages/docente/RevisionIntento'));
const TelemetriaIntento = lazyConRecarga(() => import('@/pages/docente/TelemetriaIntento'));
const TelemetriaPanel = lazyConRecarga(() => import('@/pages/docente/TelemetriaPanel'));
const RegularizacionDocente = lazyConRecarga(() => import('@/pages/docente/Regularizacion'));
const TelemetriaActividad = lazyConRecarga(() => import('@/pages/docente/TelemetriaActividad'));
const FichaEstudiante = lazyConRecarga(() => import('@/pages/docente/FichaEstudiante'));
const Lieia = lazyConRecarga(() => import('@/pages/docente/lieia/Lieia'));
const Cuentas = lazyConRecarga(() => import('@/pages/docente/Cuentas'));
const Analitica = lazyConRecarga(() => import('@/pages/docente/Analitica'));
const Comunicacion = lazyConRecarga(() => import('@/pages/docente/Comunicacion'));
const Seguridad = lazyConRecarga(() => import('@/pages/docente/Seguridad'));
const OrbeIaPanel = lazyConRecarga(() => import('@/pages/docente/OrbeIa'));
const RegistroCalificaciones = lazyConRecarga(() => import('@/pages/docente/RegistroCalificaciones'));
const Secretaria = lazyConRecarga(() => import('@/pages/estudiante/Secretaria'));
const Recuperar = lazyConRecarga(() => import('@/pages/publico/Recuperar'));
const Passkeys = lazyConRecarga(() => import('@/pages/estudiante/Passkeys'));
const GestionAcceso = lazyConRecarga(() => import('@/pages/docente/GestionAcceso'));

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
        <ErrorCarga>
        <Suspense fallback={<div className="p-8"><Spinner /></div>}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="ingresar" element={<Ingresar />} />
              <Route path="cambiar-clave" element={<CambiarClave />} />
              <Route path="activar" element={<Activar />} />
              <Route path="registro" element={<SinRegistro />} />
              <Route path="recuperar" element={<Recuperar />} />
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
              <Route path="pes/:practicaId" element={auth(<PracticaExtraordinaria />)} />
              <Route path="practicar" element={auth(<Practicar />)} />
              <Route path="laboratorio" element={auth(<Laboratorio />)} />
              <Route path="laboratorio/:simKey" element={auth(<Laboratorio />)} />
              <Route path="perfil" element={auth(<Perfil />)} />
              <Route path="ayuda" element={auth(<Ayuda />)} />
              <Route path="cuenta" element={auth(<Cuenta />)} />
              <Route path="asistencia" element={auth(<Asistencia />)} />
              <Route path="entregas" element={auth(<Entregas />)} />
              <Route path="practicas-anteriores" element={auth(<Regularizacion />)} />
              <Route path="clases" element={auth(<Clases />)} />
              <Route path="clases/registrar" element={auth(<RegistrarClase />)} />
              <Route path="clases/:sessionId" element={auth(<ClaseDetalle />)} />
              <Route path="clases/:sessionId/editar" element={auth(<RegistrarClase />)} />

              <Route path="docente" element={teacher(<InicioDocente />)} />
              <Route path="docente/clases/:classId" element={teacher(<Clase />)} />
              <Route path="docente/pes/:practicaId" element={teacher(<PesEditor />)} />
              <Route path="docente/pes/:practicaId/simulador" element={teacher(<PesSimulador />)} />
              <Route path="docente/cursos" element={teacher(<Cursos />)} />
              <Route path="docente/cursos/:courseId" element={teacher(<CursoEditor />)} />
              <Route path="docente/lecciones/:lessonId" element={teacher(<LeccionEditor />)} />
              <Route path="docente/ejercicios" element={teacher(<Banco />)} />
              <Route path="docente/generar-preguntas" element={teacher(<GenerarPreguntas />)} />
              <Route path="docente/centro-ia" element={teacher(<CentroIA />)} />
              <Route path="docente/ejercicios/:exerciseId" element={teacher(<EjercicioEditor />)} />
              <Route path="docente/actividades/:activityId" element={teacher(<ActividadEditor />)} />
              <Route path="docente/clases/:classId/nueva-actividad" element={teacher(<CrearActividad />)} />
              <Route path="docente/actividades/:activityId/vista-previa" element={teacher(<VistaPrevia />)} />
              <Route path="docente/clases/:classId/vista-estudiante" element={teacher(<VistaPanel />)} />
              <Route path="docente/intentos/:attemptId" element={teacher(<RevisionIntento />)} />
              <Route path="docente/intentos/:attemptId/telemetria" element={teacher(<TelemetriaIntento />)} />
              <Route path="docente/telemetria" element={teacher(<TelemetriaPanel />)} />
              <Route path="docente/practicas-anteriores" element={teacher(<RegularizacionDocente />)} />
              <Route path="docente/clases-impartidas/:sessionId" element={teacher(<ClaseAdmin />)} />
              <Route path="docente/actividades/:activityId/telemetria" element={teacher(<TelemetriaActividad />)} />
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
              <Route path="acceso-sin-contrasena" element={auth(<Passkeys />)} />
              {/* profesor, administrador o monitor delegado: los permisos los decide el servidor */}
              <Route path="gestion-acceso" element={auth(<GestionAcceso />)} />
              <Route path="docente/usuarios" element={<Navigate to="/docente/cuentas" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
        </ErrorCarga>
      </HashRouter>
    </AuthProvider>
  );
}
