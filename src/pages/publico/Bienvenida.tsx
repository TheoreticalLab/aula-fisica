/**
 * Portada pública: solo el acceso al aula. A propósito no describe cursos, secciones ni contenidos:
 * quien no ha entrado no debe saber qué asignaturas hay. Cada estudiante ve sus cursos al ingresar.
 */
import { Link } from 'react-router-dom';
import { Ingresar } from './Acceso';

export default function Bienvenida() {
  return (
    <div className="flex min-h-[75vh] flex-col items-center justify-center py-6">
      <svg viewBox="0 0 64 64" className="mb-4 h-16 w-16" aria-hidden>
        <rect width="64" height="64" rx="14" fill="#14284b" />
        <path d="M10 50 Q 32 -2 54 50" fill="none" stroke="#e3ad42" strokeWidth="4" strokeLinecap="round" />
        <circle cx="32" cy="24" r="5" fill="#fff" />
        <path d="M10 52 H54" stroke="#afc4e8" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <h1 className="text-center font-serif text-3xl font-semibold text-primario-950 dark:text-white sm:text-4xl">Aula Virtual de Física</h1>
      <p className="mb-6 mt-2 text-center text-sm text-gray-600 dark:text-gray-400">Ingrese con su ID y su contraseña.</p>
      <div className="w-full max-w-md">
        <Ingresar titulo={null} />
      </div>
      <Link to="/activar" className="btn-secundario mt-4 w-full max-w-md text-center">Activar mi cuenta</Link>
    </div>
  );
}
