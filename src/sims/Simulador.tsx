import { lazy, Suspense, useState, type ComponentType, type LazyExoticComponent } from 'react';
import { getSimulation, resolveParams } from './catalogo';
import { Deslizadores, SimMarco } from './comun';
import type { SimProps } from './tipos';
import { Spinner } from '@/components/ui';

const COMPONENTES: Record<string, LazyExoticComponent<ComponentType<SimProps>>> = {
  vectores: lazy(() => import('./Vectores')),
  'movimiento-rectilineo': lazy(() => import('./Rectilineo')),
  'caida-libre': lazy(() => import('./CaidaLibre')),
  proyectiles: lazy(() => import('./Proyectiles')),
  circular: lazy(() => import('./Circular')),
  fuerzas: lazy(() => import('./Fuerzas')),
};

export function simulatorAvailable(key: string): boolean {
  return key in COMPONENTES && !!getSimulation(key);
}

export function Simulador({ simKey, params: initial, compact = false }: { simKey: string; params?: Record<string, number>; compact?: boolean }) {
  const info = getSimulation(simKey);
  const [params, setParams] = useState(() => resolveParams(simKey, initial));
  const Comp = COMPONENTES[simKey];
  if (!info || !Comp) {
    return <p className="text-sm text-red-700">Simulador no disponible: «{simKey}».</p>;
  }
  const changed = JSON.stringify(params) !== JSON.stringify(resolveParams(simKey, initial));
  return (
    <SimMarco info={info} compact={compact}>
      <details className="rounded-lg border border-gray-200 p-3 dark:border-white/10" open={!compact}>
        <summary className="cursor-pointer text-sm font-semibold text-primario-800 dark:text-primario-200">Parámetros</summary>
        <div className="mt-3">
          <Deslizadores info={info} params={params} onChange={setParams} />
          {initial && changed && (
            <button className="btn-texto mt-2 text-sm" onClick={() => setParams(resolveParams(simKey, initial))}>
              Volver a los valores {compact ? 'del enunciado' : 'iniciales'}
            </button>
          )}
        </div>
      </details>
      <Suspense fallback={<Spinner label="Cargando simulador…" />}>
        <Comp params={params} compact={compact} />
      </Suspense>
    </SimMarco>
  );
}
