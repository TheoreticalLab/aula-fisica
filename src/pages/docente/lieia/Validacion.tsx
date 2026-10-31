/** LIEIA · Pestaña «Validación»: evidencia (versionada) que decide qué detectores se usan con datos reales. */
import datos from '@/lib/lieia/validacion.json';
import { DETECTORES, type Detector } from '@/lib/lieia/laboratorio';
import { ESCENARIOS, type Escenario } from '@/lib/lieia/simulador';
import { ESTADO_TEXTO, OBSOLETOS, obsoleto, type Estado } from '@/lib/lieia/validacion';
import { Badge, Card } from '@/components/ui';
import { LineasBarrido, useTema } from './graficos';

export interface Validacion {
  generado: string; semilla: number; replicas: number; minutos: number; fprMax: number;
  parametrosBase: { estudiantes: number; items: number };
  veredictos: Record<Detector, { estado: Estado; fpr: { escenario: Escenario; fpr: number; ic: [number, number]; ok: boolean }[]; potencia: { escenario: Escenario; potencia: number | null }[]; limitaciones: string[] }>;
  posterior: Record<'d1' | 'd2', { calibrada: boolean; informativa: boolean; ece: number; fraccionAlta: number }>;
  escenarios: Record<Escenario, { centroRecuperado: { aciertos: number; total: number } | null; detectores: Record<Detector, { fpr: number; potencia: number | null }> }>;
  sensibilidad: Record<string, { valor: number; detectores: Record<string, { fpr: number; potencia: number | null }> }[]>;
}
export const VALIDACION = datos as unknown as Validacion;
export const TONO_ESTADO: Record<Estado, 'green' | 'amber' | 'gray' | 'red'> = { validado: 'green', validado_limitado: 'amber', sin_potencia: 'gray', no_validado: 'red' };
/** ¿Se puede mostrar este detector como evidencia sobre datos reales? Nunca si está metodológicamente obsoleto. */
export const habilitado = (d: Detector) => !obsoleto(d) && ['validado', 'validado_limitado'].includes(VALIDACION.veredictos[d]?.estado ?? 'no_validado');
export const posteriorHabilitada = (d: 'd1' | 'd2') => VALIDACION.posterior[d].calibrada && VALIDACION.posterior[d].informativa;

const pct = (x: number | null | undefined) => (x === null || x === undefined ? '—' : `${(100 * x).toFixed(1)} %`);
const NOMBRES = Object.fromEntries(Object.entries(DETECTORES).map(([k, v]) => [k, `${k.toUpperCase()} ${v.nombre}`]));

export function Validacion() {
  const t = useTema();
  const v = VALIDACION;
  const escenarios = Object.keys(v.escenarios) as Escenario[];
  return (
    <div className="space-y-4">
      <Card title="Veredicto por detector (protocolo de aceptación)">
        <p className="mb-2 text-xs text-gray-500">
          Batería del {new Date(v.generado).toLocaleString('es-DO')} · semilla {v.semilla} · {v.replicas} réplicas por escenario · {v.parametrosBase.estudiantes} estudiantes × {v.parametrosBase.items} ítems · {v.minutos.toFixed(1)} min.
          Reproducible con <code>./node_modules/.bin/vite-node scripts/lieia-validar.ts {v.replicas}</code>. Criterio: límite superior del IC 95 % de falsos positivos ≤ {pct(v.fprMax)} en cada control negativo y entre los no implicados de cada escenario positivo.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs dark:border-white/10"><th className="py-1">Detector</th><th>Estado</th><th className="text-right">Peor FPR (IC 95 %)</th><th>Potencia en su objetivo</th><th>Con datos reales</th></tr></thead>
            <tbody>
              {(Object.keys(DETECTORES) as Detector[]).map((d) => {
                const x = v.veredictos[d];
                const peor = [...x.fpr].sort((a, b) => b.ic[1] - a.ic[1])[0];
                return (
                  <tr key={d} className="border-b border-gray-100 align-top dark:border-white/5">
                    <td className="py-1.5"><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: t.color(d) }} />{NOMBRES[d]}<span className="block text-xs text-gray-500">{DETECTORES[d].hipotesis}</span></td>
                    <td>{obsoleto(d)
                      ? <><Badge tone="red">Obsoleto (metodología)</Badge><span className="block text-xs text-gray-500">Veredicto simulado histórico: {ESTADO_TEXTO[x.estado]} — no aplicable</span></>
                      : <Badge tone={TONO_ESTADO[x.estado]}>{ESTADO_TEXTO[x.estado]}</Badge>}</td>
                    <td className="text-right tabular-nums">{peor ? <>{pct(peor.fpr)} <span className="text-xs text-gray-500">({pct(peor.ic[0])}–{pct(peor.ic[1])})</span><span className="block text-xs text-gray-500">{ESCENARIOS[peor.escenario].titulo}</span></> : '—'}</td>
                    <td className="text-xs">{x.potencia.map((p) => <span key={p.escenario} className="block">{ESCENARIOS[p.escenario].titulo}: <strong>{pct(p.potencia)}</strong></span>)}</td>
                    <td className="text-xs">{habilitado(d) ? '✓ se muestra (valores p y q)' : obsoleto(d) ? '✗ retirado (resultados históricos marcados como obsoletos)' : '✗ abstención (no se muestra como evidencia)'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {(Object.entries(OBSOLETOS) as [Detector, NonNullable<(typeof OBSOLETOS)[Detector]>][]).map(([d, o]) => (
          <div key={d} className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-500/30 dark:bg-red-500/10">
            <p className="font-medium">{d.toUpperCase()} ({o.version}) retirado el {o.desde} por defectos metodológicos</p>
            <p className="mt-1 text-xs">La batería simulada no podía revelarlos porque generaba los datos con el mismo modelo que el detector suponía. Sus resultados anteriores se conservan, pero son de una versión obsoleta y no deben usarse para priorizar revisiones.</p>
            <ol className="mt-1 list-decimal pl-5 text-xs">{o.defectos.map((x) => <li key={x}>{x}</li>)}</ol>
            <p className="mt-1 text-xs">Sustituto: {o.sustituto}. Detalle: <code>{o.documento}</code>.</p>
          </div>
        ))}
        <ul className="mt-2 list-disc pl-5 text-sm">
          {(Object.keys(DETECTORES) as Detector[]).flatMap((d) => v.veredictos[d].limitaciones.map((l) => <li key={d + l}><strong>{d.toUpperCase()}</strong>: {l}</li>))}
          {(['d1', 'd2'] as const).map((d) => (
            <li key={d}>Probabilidad posterior {d.toUpperCase()}: ECE {v.posterior[d].ece.toFixed(3)}, {v.posterior[d].calibrada ? 'sin sobreconfianza' : 'con sobreconfianza'}; {pct(v.posterior[d].fraccionAlta)} de las parejas dependientes reciben ≥ 0,5 → {posteriorHabilitada(d) ? 'se muestra' : 'no se muestra como porcentaje (abstención); se usan valores q'}.</li>
          ))}
          {v.escenarios.red?.centroRecuperado && <li>Fuente central de una red (3 receptores): identificada en {v.escenarios.red.centroRecuperado.aciertos}/{v.escenarios.red.centroRecuperado.total} réplicas.</li>}
        </ul>
      </Card>

      <Card title="Tasa de alertas por escenario (α = 0,05)">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b text-left dark:border-white/10"><th className="py-1">Escenario</th>{(Object.keys(DETECTORES) as Detector[]).map((d) => <th key={d} className="text-right">{d.toUpperCase()}</th>)}</tr></thead>
            <tbody>
              {escenarios.map((e) => (
                <tr key={e} className="border-b border-gray-100 dark:border-white/5">
                  <td className="py-1">{ESCENARIOS[e].titulo} <Badge tone={ESCENARIOS[e].tipo === 'negativo' ? 'green' : ESCENARIOS[e].tipo === 'positivo' ? 'blue' : 'purple'}>{ESCENARIOS[e].tipo}</Badge></td>
                  {(Object.keys(DETECTORES) as Detector[]).map((d) => {
                    const m = v.escenarios[e].detectores[d];
                    return <td key={d} className="text-right tabular-nums"><span className={m.fpr > 0.075 ? 'text-red-600' : ''}>FP {pct(m.fpr)}</span>{m.potencia !== null && <span className="block font-semibold">pot {pct(m.potencia)}</span>}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Sensibilidad: intensidad de la copia"><LineasBarrido filas={v.sensibilidad.intensidad} detectores={['d1', 'd2', 'd3']} campo="potencia" nombres={NOMBRES} etiquetaX="probabilidad de copiar cada ítem" /></Card>
        <Card title="Sensibilidad: retardo de la copia"><LineasBarrido filas={v.sensibilidad.retardoMediano} detectores={['d1', 'd2', 'd3']} campo="potencia" nombres={NOMBRES} etiquetaX="segundos" /></Card>
        <Card title="Sensibilidad: número de ítems"><LineasBarrido filas={v.sensibilidad.itemsPotencia} detectores={['d1', 'd2', 'd3']} campo="potencia" nombres={NOMBRES} etiquetaX="ítems" /></Card>
        <Card title="Falsos positivos según el tamaño de la sección"><LineasBarrido filas={v.sensibilidad.estudiantesFpr} detectores={['d1', 'd2', 'd3', 'd6']} campo="fpr" nombres={NOMBRES} etiquetaX="estudiantes" /></Card>
      </div>
    </div>
  );
}
