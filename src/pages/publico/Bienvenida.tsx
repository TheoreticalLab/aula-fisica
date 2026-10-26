/**
 * Portada pública: solo el acceso al aula. A propósito no describe cursos, secciones ni contenidos:
 * quien no ha entrado no debe saber qué asignaturas hay. Cada estudiante ve sus cursos al ingresar.
 */
import { Link } from 'react-router-dom';
import { Ingresar } from './Acceso';
import { AnimacionPortada } from '@/components/AnimacionPortada';

export default function Bienvenida() {
  return (
    <div className="flex min-h-[75vh] flex-col items-center justify-center py-6">
      <AnimacionPortada className="mb-2 w-full max-w-md text-primario-900 dark:text-primario-200" />
      <h1 className="text-center font-serif text-3xl font-semibold text-primario-950 dark:text-white sm:text-4xl">Aula Virtual de Física</h1>
      <p className="mb-6 mt-2 text-center text-sm text-gray-600 dark:text-gray-400">Ingrese con su ID y su contraseña.</p>
      <div className="w-full max-w-md">
        <Ingresar titulo={null} />
      </div>
      <Link to="/activar" className="btn-secundario mt-4 w-full max-w-md text-center">Activar mi cuenta</Link>
    </div>
  );
}
