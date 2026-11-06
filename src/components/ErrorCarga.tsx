/**
 * Si una parte del aula no se puede cargar (sin conexión, o una versión nueva recién publicada que la recarga
 * automática no resolvió), se muestra un aviso con «Recargar» en lugar de dejar la pantalla en blanco.
 */
import { Component, type ReactNode } from 'react';

export class ErrorCarga extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-lg p-8 text-center" role="alert">
        <p className="text-lg font-semibold">No se pudo cargar esta parte del aula.</p>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Puede ser la conexión o una versión nueva del aula recién publicada. Sus respuestas guardadas no se pierden.
        </p>
        <button className="btn-primario mt-4" onClick={() => window.location.reload()}>Recargar</button>
      </div>
    );
  }
}
