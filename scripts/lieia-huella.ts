/** Huella del simulador (regresión: los escenarios existentes deben dar exactamente los mismos datos). */
import { createHash } from 'node:crypto';
import { simular, PARAMETROS_BASE, type Escenario } from '../src/lib/lieia/simulador';

export const ORIGINALES: Escenario[] = ['independiente', 'facil', 'misma_confusion', 'mismo_ritmo', 'inicio_escalonado', 'orden_aleatorio',
  'parejas', 'red', 'asistencia_ia', 'parejas_con_retardo', 'parejas_disfrazadas', 'ia_mimetica'];
const h = createHash('sha256');
for (const e of ORIGINALES) h.update(JSON.stringify(simular({ ...PARAMETROS_BASE, escenario: e }, 12345).examen));
console.log(h.digest('hex'));
