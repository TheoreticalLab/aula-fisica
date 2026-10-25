import { Link, useParams } from 'react-router-dom';
import { getSimulation, PLANNED_SIMULATIONS, SIMULATIONS } from '@/sims/catalogo';
import { Simulador } from '@/sims/Simulador';
import { Badge, PageTitle } from '@/components/ui';

export default function Laboratorio() {
  const { simKey } = useParams();
  const info = simKey ? getSimulation(simKey) : undefined;
  if (simKey && info) {
    return (
      <div>
        <PageTitle title={info.title} subtitle={info.block} back={{ to: '/laboratorio', label: 'Laboratorio' }} />
        <div className="tarjeta">
          <Simulador key={simKey} simKey={simKey} />
        </div>
      </div>
    );
  }
  return (
    <div>
      <PageTitle title="Laboratorio virtual" subtitle="Experimentos interactivos: cambie los parámetros, observe el fenómeno y analice las gráficas." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SIMULATIONS.map((s) => (
          <Link key={s.key} to={`/laboratorio/${s.key}`} className="tarjeta block transition hover:-translate-y-0.5 hover:border-primario-400">
            <p className="text-xs font-semibold uppercase tracking-wide text-acento-600">{s.block}</p>
            <h2 className="font-serif text-lg font-semibold">{s.title}</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{s.description}</p>
          </Link>
        ))}
      </div>
      <h2 className="mb-2 mt-8 text-lg font-semibold">En desarrollo</h2>
      <ul className="flex flex-wrap gap-2">
        {PLANNED_SIMULATIONS.map((s) => (
          <li key={s.title}><Badge>{s.title}</Badge></li>
        ))}
      </ul>
    </div>
  );
}
