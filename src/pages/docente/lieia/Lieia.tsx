/** LIEIA · Laboratorio de Inferencia Estocástica de Integridad Académica (solo profesorado). */
import { useState } from 'react';
import { PageTitle, Tabs } from '@/components/ui';
import { Laboratorio } from './Laboratorio';
import { Ciencia } from './Ciencia';
import { Calibracion } from './Calibracion';
import { LabProceso } from './LabProceso';
import { Metodo } from './Metodo';
import { Reales } from './Reales';
import { Validacion } from './Validacion';
import { Vta } from './Vta';

type Tab = 'ciencia' | 'laboratorio' | 'validacion' | 'calibracion' | 'proceso' | 'reales' | 'vta' | 'metodo';

export default function Lieia() {
  const [tab, setTab] = useState<Tab>('ciencia');
  return (
    <div className="space-y-4">
      <PageTitle title="Laboratorio LIEIA" subtitle="Diseño experimental, psicometría e investigación educativa. La línea original de integridad académica sigue disponible como una investigación más." back={{ to: '/docente', label: 'Panel docente' }} />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { id: 'ciencia', label: '🔬 Laboratorio científico' }, { id: 'laboratorio', label: '🧪 Integridad: laboratorio' }, { id: 'validacion', label: '✔ Validación' }, { id: 'calibracion', label: '📐 Calibración de ítems' }, { id: 'proceso', label: '⏱ Proceso de respuesta' },
        { id: 'reales', label: '📋 Evaluaciones reales' }, { id: 'vta', label: '🎯 VTA · Transferencia y autonomía' }, { id: 'metodo', label: 'Qué puede y qué no puede inferirse' },
      ]} />
      {tab === 'ciencia' && <Ciencia />}
      {tab === 'laboratorio' && <Laboratorio />}
      {tab === 'validacion' && <Validacion />}
      {tab === 'calibracion' && <Calibracion />}
      {tab === 'proceso' && <LabProceso />}
      {tab === 'reales' && <Reales />}
      {tab === 'vta' && <Vta />}
      {tab === 'metodo' && <Metodo />}
    </div>
  );
}
