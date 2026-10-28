/**
 * LIEIA · Simulador de exámenes con verdad conocida (solo datos sintéticos; nunca toca registros reales).
 *
 * Modelo generador (deliberadamente MÁS rico que el que ajustan los detectores, para medir robustez):
 *  - Aciertos: TRI de 2 parámetros, P = logística(a_j(θ_i − b_j)), con discriminación a_j variable (los detectores
 *    ajustan Rasch, de 1 parámetro: error de especificación controlado).
 *  - Respuestas incorrectas: en selección, cada distractor tiene un atractivo propio; en respuestas abiertas hay
 *    errores típicos compartidos y errores idiosincrásicos.
 *  - Tiempos: log d = β_j − τ_i + ε con β_j ligado a la dificultad; orden común o aleatorio; inicio con latencia.
 *  - Mecanismos inyectados: copia entre parejas (con retardo), red con fuente central, asistencia externa / IA,
 *    y variantes adversariales; controles negativos: misma confusión, mismo ritmo, examen fácil, inicio escalonado.
 */
import { crearAzar, type Azar } from './azar';
import { logistica } from './estadistica';
import { clavePareja, type ExamenObservado, type RespuestaObservada, type Verdad } from './tipos';

export type Escenario =
  | 'independiente' | 'facil' | 'misma_confusion' | 'mismo_ritmo' | 'inicio_escalonado' | 'orden_aleatorio'
  | 'parejas' | 'red' | 'asistencia_ia'
  | 'parejas_con_retardo' | 'parejas_disfrazadas' | 'ia_mimetica';

export interface ParametrosSim {
  escenario: Escenario;
  estudiantes: number;
  items: number;
  fraccionSeleccion: number; // resto: respuestas abiertas (numéricas)
  dificultadMedia: number;
  intensidad: number;        // probabilidad de copiar cada ítem (parejas, red) o de acertar con ayuda (IA)
  implicados: number;        // nº de parejas, receptores de la red o estudiantes asistidos
  retardoMediano: number;    // segundos entre la respuesta de la fuente y la del que copia
}

export const PARAMETROS_BASE: ParametrosSim = {
  escenario: 'independiente', estudiantes: 36, items: 24, fraccionSeleccion: 0.7, dificultadMedia: 0,
  intensidad: 0.7, implicados: 3, retardoMediano: 25,
};

export const ESCENARIOS: Record<Escenario, { titulo: string; tipo: 'negativo' | 'positivo' | 'adversarial'; descripcion: string }> = {
  independiente: { titulo: 'Independencia', tipo: 'negativo', descripcion: 'Nadie colabora. Cualquier alerta es un falso positivo.' },
  facil: { titulo: 'Examen fácil', tipo: 'negativo', descripcion: 'Casi todos aciertan: muchas coincidencias correctas, legítimas.' },
  misma_confusion: { titulo: 'Misma confusión (causa común)', tipo: 'negativo', descripcion: 'Un grupo comparte la misma idea errónea (estudiaron juntos): eligen la misma respuesta incorrecta sin copiar durante el examen.' },
  mismo_ritmo: { titulo: 'Mismo ritmo y habilidad', tipo: 'negativo', descripcion: 'Parejas independientes con igual habilidad y velocidad: se parecen sin colaborar.' },
  inicio_escalonado: { titulo: 'Inicio escalonado', tipo: 'negativo', descripcion: 'El examen empieza en tres tandas: sincronía legítima dentro de cada tanda.' },
  orden_aleatorio: { titulo: 'Orden aleatorio de preguntas', tipo: 'negativo', descripcion: 'Cada estudiante ve las preguntas en otro orden; nadie colabora.' },
  parejas: { titulo: 'Copia en parejas', tipo: 'positivo', descripcion: 'Cada copiador espera la respuesta de su fuente y la reproduce con un retardo corto.' },
  red: { titulo: 'Red con fuente central', tipo: 'positivo', descripcion: 'Un estudiante (o alguien externo a través de él) distribuye respuestas a varios receptores.' },
  asistencia_ia: { titulo: 'Asistencia externa / IA', tipo: 'positivo', descripcion: 'Aciertan casi todo sin importar la dificultad y tardan lo mismo en preguntas fáciles y difíciles.' },
  parejas_con_retardo: { titulo: 'Copia con retardo largo (adversarial)', tipo: 'adversarial', descripcion: 'El copiador espera entre 2 y 15 minutos: borra la huella temporal.' },
  parejas_disfrazadas: { titulo: 'Copia disfrazada (adversarial)', tipo: 'adversarial', descripcion: 'El copiador cambia la mayoría de las respuestas incorrectas copiadas por otras incorrectas.' },
  ia_mimetica: { titulo: 'IA que imita los tiempos (adversarial)', tipo: 'adversarial', descripcion: 'Asistencia que tarda más en lo difícil, como un estudiante real.' },
};

interface ItemGen { a: number; b: number; beta: number; opciones: number | null; atractivo: number[]; tipicos: string[] }

function generarItems(az: Azar, p: ParametrosSim): ItemGen[] {
  const media = p.escenario === 'facil' ? -2.3 : p.dificultadMedia;
  return Array.from({ length: p.items }, (_, j) => {
    const b = az.normal(media, 1);
    const seleccion = az.u() < p.fraccionSeleccion;
    const opciones = seleccion ? 4 : null;
    const atractivo = seleccion ? [0, 1, 2].map(() => -Math.log(1 - az.u()) + 0.2) : [1.6, 0.9, 0.5].map((w) => w * (0.6 + az.u()));
    return { a: 0.7 + az.u() * 1.0, b, beta: Math.log(70) + 0.25 * b + az.normal(0, 0.3), opciones, atractivo, tipicos: [0, 1, 2].map((k) => `i${j}e${k}`) };
  });
}

/** Respuesta incorrecta según el atractivo de cada error (o un error idiosincrásico en las abiertas). */
function incorrecta(az: Azar, it: ItemGen, est: number, preferida: number | null): string {
  if (preferida !== null && az.u() < 0.9) return it.opciones ? `op${preferida + 1}` : it.tipicos[preferida];
  if (it.opciones) return `op${az.categorica(it.atractivo) + 1}`;
  if (az.u() < 0.45) return `i-unico-${est}-${az.entero(1e6)}`;
  return it.tipicos[az.categorica(it.atractivo)];
}

export function simular(p: ParametrosSim, semilla: number): { examen: ExamenObservado; verdad: Verdad } {
  const az = crearAzar(semilla);
  const n = p.estudiantes, m = p.items;
  const items = generarItems(az, p);
  const theta = Array.from({ length: n }, () => az.normal());
  const tau = Array.from({ length: n }, () => az.normal(0, 0.25));
  const verdad: Verdad = { parejas: new Set(), indirectas: new Set(), causaComun: new Set(), asistidos: new Set(), receptores: new Set(), centro: null };

  // controles negativos que imitan dependencia
  const preferencia: (number | null)[][] = Array.from({ length: n }, () => new Array(m).fill(null));
  if (p.escenario === 'misma_confusion') {
    const grupo = az.barajar([...Array(n).keys()]).slice(0, Math.max(2, p.implicados + 1));
    for (let j = 0; j < m; j++) if (az.u() < 0.6) { const c = az.entero(3); for (const g of grupo) preferencia[g][j] = c; }
    for (const g of grupo) for (const h of grupo) if (g < h) verdad.causaComun.add(clavePareja(g, h));
  }
  if (p.escenario === 'mismo_ritmo') {
    const orden = az.barajar([...Array(n).keys()]);
    for (let k = 0; k < p.implicados; k++) { const [x, y] = [orden[2 * k], orden[2 * k + 1]]; theta[y] = theta[x]; tau[y] = tau[x]; }
  }

  const inicio = Array.from({ length: n }, (_, i) => (p.escenario === 'inicio_escalonado' ? (i % 3) * 300 : 0) + az.u() * 40);
  const ordenes = Array.from({ length: n }, () => (p.escenario === 'orden_aleatorio' ? az.barajar([...Array(m).keys()]) : [...Array(m).keys()]));
  const resp: RespuestaObservada[][] = Array.from({ length: n }, () => Array.from({ length: m }, () => ({ respuesta: null, correcta: null, t: null, primera: null, cambios: 0 })));

  // quiénes son asistidos / copiadores (se generan después de sus fuentes)
  const elegidos = az.barajar([...Array(n).keys()]);
  const fuenteDe = new Map<number, number>();
  const asistidos = new Set<number>();
  const copia = ['parejas', 'parejas_con_retardo', 'parejas_disfrazadas'].includes(p.escenario);
  if (copia) {
    for (let k = 0; k < p.implicados; k++) { const [s, c] = [elegidos[2 * k], elegidos[2 * k + 1]]; fuenteDe.set(c, s); verdad.parejas.add(clavePareja(s, c)); }
  } else if (p.escenario === 'red') {
    const centro = elegidos[0];
    verdad.centro = centro;
    for (let k = 1; k <= p.implicados; k++) { fuenteDe.set(elegidos[k], centro); verdad.parejas.add(clavePareja(centro, elegidos[k])); }
    for (let a = 1; a <= p.implicados; a++) for (let b = a + 1; b <= p.implicados; b++) verdad.indirectas.add(clavePareja(elegidos[a], elegidos[b]));
  } else if (p.escenario === 'asistencia_ia' || p.escenario === 'ia_mimetica') {
    for (let k = 0; k < p.implicados; k++) { asistidos.add(elegidos[k]); verdad.asistidos.add(elegidos[k]); }
  }

  const generarIndependiente = (i: number) => {
    let t = inicio[i];
    for (const j of ordenes[i]) {
      const it = items[j];
      let correcta: boolean, d: number;
      if (asistidos.has(i)) {
        correcta = az.u() < p.intensidad + (1 - p.intensidad) * logistica(it.a * (theta[i] - it.b)) * 0.5;
        d = p.escenario === 'ia_mimetica' ? Math.exp(it.beta - 0.1 + az.normal(0, 0.3)) : Math.exp(Math.log(55) + az.normal(0, 0.2));
      } else {
        correcta = az.u() < logistica(it.a * (theta[i] - it.b));
        d = Math.exp(it.beta - tau[i] + az.normal(0, 0.35));
      }
      t += d;
      resp[i][j] = { respuesta: correcta ? 'ok' : incorrecta(az, it, i, preferencia[i][j]), correcta, t, primera: t, cambios: 1 };
    }
  };
  for (const c of fuenteDe.keys()) verdad.receptores.add(c);
  // primero las fuentes y los independientes; luego los copiadores (necesitan las respuestas de su fuente)
  for (let i = 0; i < n; i++) if (!fuenteDe.has(i)) generarIndependiente(i);
  for (const [c, s] of fuenteDe) {
    const ordenFuente = [...Array(m).keys()].filter((j) => resp[s][j].t !== null).sort((x, y) => (resp[s][x].t as number) - (resp[s][y].t as number));
    let t = inicio[c];
    for (const j of ordenFuente) {
      const it = items[j];
      const propia = Math.exp(it.beta - tau[c] + az.normal(0, 0.35));
      if (az.u() < p.intensidad) {
        const retardo = p.escenario === 'parejas_con_retardo' ? 120 + az.u() * 780 : p.retardoMediano * Math.exp(az.normal(0, 0.5));
        t = p.escenario === 'parejas_con_retardo' ? t + propia * 0.6 : Math.max(t + 3, (resp[s][j].t as number) + retardo);
        let r = resp[s][j].respuesta as string;
        const ok = resp[s][j].correcta as boolean;
        if (!ok && p.escenario === 'parejas_disfrazadas' && az.u() < 0.75) r = incorrecta(az, it, c, null);
        resp[c][j] = { respuesta: r, correcta: ok, t, primera: t, cambios: 1 };
      } else {
        t += propia;
        const ok = az.u() < logistica(it.a * (theta[c] - it.b));
        resp[c][j] = { respuesta: ok ? 'ok' : incorrecta(az, it, c, null), correcta: ok, t, primera: t, cambios: 1 };
      }
    }
  }

  const examen: ExamenObservado = {
    items: items.map((it, j) => ({ id: `P${j + 1}`, opciones: it.opciones, orden: j + 1 })),
    estudiantes: Array.from({ length: n }, (_, i) => ({
      id: `E${String(i + 1).padStart(2, '0')}`, inicio: inicio[i],
      fin: Math.max(...resp[i].map((r) => r.t ?? 0)),
      oculto: asistidos.has(i) ? 200 + az.u() * 700 : -Math.log(1 - az.u()) * 30,
    })),
    r: resp,
    conTiempos: true,
  };
  return { examen, verdad };
}
