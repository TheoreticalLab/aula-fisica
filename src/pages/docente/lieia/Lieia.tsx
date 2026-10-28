/** LIEIA · Laboratorio de Inferencia Estocástica de Integridad Académica (solo profesorado). */
import { useState } from 'react';
import { PageTitle, Tabs } from '@/components/ui';
import { Laboratorio } from './Laboratorio';
import { Calibracion } from './Calibracion';
import { Metodo } from './Metodo';
import { Reales } from './Reales';
import { Validacion } from './Validacion';

type Tab = 'laboratorio' | 'validacion' | 'calibracion' | 'reales' | 'metodo';

export default function Lieia() {
  const [tab, setTab] = useState<Tab>('laboratorio');
  return (
    <div className="space-y-4">
      <PageTitle title="Laboratorio LIEIA" subtitle="Inferencia estocástica de integridad académica: experimentos con verdad conocida, validación y análisis de evaluaciones reales." back={{ to: '/docente', label: 'Panel docente' }} />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { id: 'laboratorio', label: '🧪 Laboratorio' }, { id: 'validacion', label: '✔ Validación' }, { id: 'calibracion', label: '📐 Calibración de ítems' },
        { id: 'reales', label: '📋 Evaluaciones reales' }, { id: 'metodo', label: 'Qué puede y qué no puede inferirse' },
      ]} />
      {tab === 'laboratorio' && <Laboratorio />}
      {tab === 'validacion' && <Validacion />}
      {tab === 'calibracion' && <Calibracion />}
      {tab === 'reales' && <Reales />}
      {tab === 'metodo' && <Metodo />}
    </div>
  );
}
