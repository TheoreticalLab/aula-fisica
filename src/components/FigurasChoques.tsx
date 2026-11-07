/**
 * Figuras SVG de choques unidimensionales que el contenido inserta con un bloque de código:
 *
 * ```figura
 * choque-1d
 * ```
 *
 * Solo dibujan lo que la clave nombra (no reciben HTML ni parámetros del contenido). Sin fórmulas de resultados:
 * las flechas muestran sentidos y tamaños relativos físicamente correctos. Cada panel es un SVG propio con su título
 * en HTML, para que el texto siga legible en un celular. Colores por bloque, adaptados al modo oscuro.
 */
import type { ReactNode } from 'react';
import { useDark } from '@/lib/tema';

const W = 480;
const SERIF = 'Georgia, "Times New Roman", serif';

interface Tinta { linea: string; suave: string; a: string; b: string; fondo: string }
function useTinta(): Tinta {
  const dark = useDark();
  return dark
    ? { linea: '#d1d5db', suave: '#9ca3af', a: '#7aa5e8', b: '#eec770', fondo: '#111827' }
    : { linea: '#374151', suave: '#6b7280', a: '#264886', b: '#b07a12', fondo: '#ffffff' };
}

/** Bloque centrado en x, apoyado en el piso (y = 96). */
function Bloque({ x, color, letra, t, ancho = 40 }: { x: number; color: string; letra: string; t: Tinta; ancho?: number }) {
  return (
    <g>
      <rect x={x - ancho / 2} y={58} width={ancho} height={38} rx={4} fill={color} />
      <text x={x} y={84} fontSize={20} fontWeight={700} textAnchor="middle" fill={t.fondo} fontFamily="system-ui, sans-serif">{letra}</text>
    </g>
  );
}

/** Flecha horizontal de velocidad desde x0 hasta x1 (a la altura y), con su etiqueta encima. */
function Flecha({ x0, x1, y = 40, color, etiqueta, discontinua = false }: { x0: number; x1: number; y?: number; color: string; etiqueta: ReactNode; discontinua?: boolean }) {
  const s = Math.sign(x1 - x0) || 1;
  const punta = 11;
  return (
    <g>
      <line x1={x0} y1={y} x2={x1 - s * punta} y2={y} stroke={color} strokeWidth={3.5} strokeDasharray={discontinua ? '7 5' : undefined} />
      <polygon points={`${x1},${y} ${x1 - s * punta},${y - 7} ${x1 - s * punta},${y + 7}`} fill={color} />
      <text x={(x0 + x1) / 2} y={y - 11} fontSize={19} textAnchor="middle" fill={color} fontFamily={SERIF} fontStyle="italic">{etiqueta}</text>
    </g>
  );
}

/** Pared rígida vertical con rayado hacia el lado exterior. */
function Pared({ x, lado, t }: { x: number; lado: 'izq' | 'der'; t: Tinta }) {
  const d = lado === 'izq' ? -1 : 1;
  return (
    <g stroke={t.linea}>
      <line x1={x} y1={22} x2={x} y2={100} strokeWidth={4} />
      {[30, 44, 58, 72, 86, 100].map((y) => <line key={y} x1={x} y1={y} x2={x + d * 10} y2={y - 10} strokeWidth={1.5} />)}
    </g>
  );
}

function Piso({ x0 = 8, x1 = W - 8, t }: { x0?: number; x1?: number; t: Tinta }) {
  return <line x1={x0} y1={97} x2={x1} y2={97} stroke={t.linea} strokeWidth={2} />;
}

/** Línea discontinua del centro (L/2). */
function Centro({ x, t, rotulo = true }: { x: number; t: Tinta; rotulo?: boolean }) {
  return (
    <g>
      <line x1={x} y1={14} x2={x} y2={106} stroke={t.suave} strokeWidth={1.5} strokeDasharray="4 4" />
      {rotulo && <text x={x} y={124} fontSize={16} textAnchor="middle" fill={t.suave} fontFamily={SERIF} fontStyle="italic">L/2</text>}
    </g>
  );
}

function Panel({ titulo, alto = 112, descripcion, children }: { titulo: string; alto?: number; descripcion: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{titulo}</p>
      <svg viewBox={`0 0 ${W} ${alto}`} className="block h-auto w-full" role="img" aria-label={descripcion}>{children}</svg>
    </div>
  );
}

function Marco({ pie, children }: { pie: string; children: ReactNode }) {
  return (
    <figure className="not-prose my-4 mx-auto max-w-xl space-y-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-gray-900">
      {children}
      <figcaption className="text-xs text-gray-500 dark:text-gray-400">{pie}</figcaption>
    </figure>
  );
}

/** Eje con el sentido positivo. */
function EjeX({ x, y, t }: { x: number; y: number; t: Tinta }) {
  return (
    <g>
      <line x1={x} y1={y} x2={x + 34} y2={y} stroke={t.suave} strokeWidth={1.5} />
      <polygon points={`${x + 40},${y} ${x + 32},${y - 5} ${x + 32},${y + 5}`} fill={t.suave} />
      <text x={x + 46} y={y + 5} fontSize={15} fill={t.suave} fontFamily={SERIF} fontStyle="italic">+x</text>
    </g>
  );
}

function Sub({ base, sub, prima = false }: { base: string; sub: string; prima?: boolean }) {
  return <>{base}{prima ? '′' : ''}<tspan fontSize={13} dy={5}>{sub}</tspan></>;
}

/** Parte A: choque de dos bloques, antes y después (sentidos de referencia, sin valores). */
function Choque1D() {
  const t = useTinta();
  return (
    <Marco pie="Las flechas marcan el sentido positivo elegido para cada velocidad; el signo real de cada una lo decide el cálculo.">
      <Panel titulo="Antes del choque" alto={104} descripcion="Bloque 1 de masa m1 con velocidad u1 hacia la derecha y bloque 2 de masa m2 con velocidad u2 hacia la derecha, más lenta.">
        <EjeX x={12} y={16} t={t} />
        <Piso t={t} />
        <Bloque x={150} color={t.a} letra="1" t={t} />
        <Flecha x0={174} x1={262} color={t.a} etiqueta={<Sub base="u" sub="1" />} />
        <Bloque x={320} color={t.b} letra="2" t={t} />
        <Flecha x0={344} x1={386} color={t.b} etiqueta={<Sub base="u" sub="2" />} />
      </Panel>
      <Panel titulo="Después del choque" alto={104} descripcion="Los mismos bloques después del choque, con velocidades v1 y v2.">
        <Piso t={t} />
        <Bloque x={186} color={t.a} letra="1" t={t} />
        <Flecha x0={210} x1={250} color={t.a} etiqueta={<Sub base="v" sub="1" />} discontinua />
        <Bloque x={356} color={t.b} letra="2" t={t} />
        <Flecha x0={380} x1={452} color={t.b} etiqueta={<Sub base="v" sub="2" />} discontinua />
      </Panel>
      <p className="text-xs text-gray-600 dark:text-gray-300">
        <span style={{ color: t.a }}>■</span> bloque 1 (masa <i>m</i>₁) · <span style={{ color: t.b }}>■</span> bloque 2 (masa <i>m</i>₂) · flecha continua: antes · flecha discontinua: después
      </p>
    </Marco>
  );
}

/** Parte B: un bloque choca contra una pared rígida. Rebote elástico: misma longitud de flecha, sentido opuesto. */
function ChoquePared() {
  const t = useTinta();
  const pared = 430;
  return (
    <Marco pie="Pared fija y rígida. La longitud de cada flecha es proporcional a la rapidez.">
      <Panel titulo="Se acerca a la pared" alto={104} descripcion="Un bloque se mueve hacia una pared fija a la derecha con velocidad v.">
        <EjeX x={12} y={16} t={t} />
        <Piso x1={pared} t={t} />
        <Pared x={pared} lado="der" t={t} />
        <Bloque x={200} color={t.a} letra="A" t={t} />
        <Flecha x0={224} x1={324} color={t.a} etiqueta="v" />
      </Panel>
      <Panel titulo="Choque contra la pared" alto={104} descripcion="El bloque en contacto con la pared durante el choque.">
        <Piso x1={pared} t={t} />
        <Pared x={pared} lado="der" t={t} />
        <Bloque x={pared - 22} color={t.a} letra="A" t={t} />
        <g stroke={t.linea} strokeWidth={2}>
          {[[-14, -26], [0, -32], [14, -26]].map(([dx, dy], i) => <line key={i} x1={pared - 22 + dx * 0.5} y1={52} x2={pared - 22 + dx} y2={52 + dy * 0.6} />)}
        </g>
      </Panel>
      <Panel titulo="Se aleja de la pared" alto={104} descripcion="Después del choque el bloque se mueve hacia la izquierda con velocidad v prima, flecha de la misma longitud.">
        <Piso x1={pared} t={t} />
        <Pared x={pared} lado="der" t={t} />
        <Bloque x={260} color={t.a} letra="A" t={t} />
        <Flecha x0={236} x1={136} color={t.a} etiqueta="v′" discontinua />
      </Panel>
    </Marco>
  );
}

const PI = 40, PD = 440, C = (PI + PD) / 2; // paredes y centro: L = 400 unidades del dibujo

/** Parte C: dos bloques iguales entre dos paredes, simétricos respecto al centro, con velocidades opuestas. */
function BloquesEntreParedes() {
  const t = useTinta();
  return (
    <Marco pie="Bloques de igual masa m, sin fricción, entre dos paredes rígidas. Primer choque entre los bloques: en el centro, en t = 0.">
      <Panel titulo="Configuración inicial" alto={160} descripcion="Dos paredes separadas una distancia L. El bloque A, a la izquierda del centro, se mueve hacia la derecha con velocidad +v0; el bloque B, a la derecha, hacia la izquierda con −v0.">
        <EjeX x={52} y={16} t={t} />
        <Piso x0={PI} x1={PD} t={t} />
        <Pared x={PI} lado="izq" t={t} />
        <Pared x={PD} lado="der" t={t} />
        <Centro x={C} t={t} rotulo={false} />
        <Bloque x={C - 90} color={t.a} letra="A" t={t} />
        <Flecha x0={C - 66} x1={C - 8} color={t.a} etiqueta={<>+<Sub base="v" sub="0" /></>} />
        <Bloque x={C + 90} color={t.b} letra="B" t={t} />
        <Flecha x0={C + 66} x1={C + 8} color={t.b} etiqueta={<>−<Sub base="v" sub="0" /></>} />
        {/* cotas: L entre paredes y L/2 hasta el centro */}
        <g stroke={t.suave} strokeWidth={1.5} fill={t.suave}>
          <line x1={PI} y1={124} x2={C} y2={124} />
          <polygon points={`${PI},124 ${PI + 8},120 ${PI + 8},128`} /><polygon points={`${C},124 ${C - 8},120 ${C - 8},128`} />
          <line x1={PI} y1={152} x2={PD} y2={152} />
          <polygon points={`${PI},152 ${PI + 8},148 ${PI + 8},156`} /><polygon points={`${PD},152 ${PD - 8},148 ${PD - 8},156`} />
        </g>
        <text x={(PI + C) / 2} y={119} fontSize={16} textAnchor="middle" fill={t.suave} fontFamily={SERIF} fontStyle="italic">L/2</text>
        <text x={C} y={147} fontSize={16} textAnchor="middle" fill={t.suave} fontFamily={SERIF} fontStyle="italic">L</text>
        <text x={C + 6} y={12} fontSize={13} fill={t.suave} fontFamily="system-ui, sans-serif">centro</text>
      </Panel>
    </Marco>
  );
}

/** Partes B3 y D: secuencia de tres estados (aproximación, separación, regreso al centro tras rebotar). */
function SecuenciaChoques() {
  const t = useTinta();
  const r = 0.8; // las flechas después del choque son más cortas (choque inelástico); las paredes no cambian la rapidez
  const largo = 92;
  return (
    <Marco pie="Flecha continua: antes del choque entre los bloques; discontinua: después. La longitud de cada flecha es proporcional a la rapidez.">
      <Panel titulo="1 · Aproximación" alto={128} descripcion="Los bloques A y B se acercan al centro desde posiciones simétricas, con velocidades opuestas de igual magnitud.">
        <Piso x0={PI} x1={PD} t={t} />
        <Pared x={PI} lado="izq" t={t} /><Pared x={PD} lado="der" t={t} />
        <Centro x={C} t={t} />
        <Bloque x={C - 130} color={t.a} letra="A" t={t} />
        <Flecha x0={C - 106} x1={C - 106 + largo} color={t.a} etiqueta={<Sub base="v" sub="A" />} />
        <Bloque x={C + 130} color={t.b} letra="B" t={t} />
        <Flecha x0={C + 106} x1={C + 106 - largo} color={t.b} etiqueta={<Sub base="v" sub="B" />} />
      </Panel>
      <Panel titulo="2 · Separación después del choque" alto={128} descripcion="Justo después de chocar en el centro, los bloques se separan hacia las paredes con velocidades opuestas, de menor magnitud.">
        <Piso x0={PI} x1={PD} t={t} />
        <Pared x={PI} lado="izq" t={t} /><Pared x={PD} lado="der" t={t} />
        <Centro x={C} t={t} />
        <Bloque x={C - 21} color={t.a} letra="A" t={t} />
        <Flecha x0={C - 45} x1={C - 45 - largo * r} color={t.a} etiqueta={<Sub base="v" sub="A" prima />} discontinua />
        <Bloque x={C + 21} color={t.b} letra="B" t={t} />
        <Flecha x0={C + 45} x1={C + 45 + largo * r} color={t.b} etiqueta={<Sub base="v" sub="B" prima />} discontinua />
      </Panel>
      <Panel titulo="3 · Regreso al centro tras rebotar en las paredes" alto={128} descripcion="Después de rebotar elásticamente en las paredes, los bloques vuelven hacia el centro desde posiciones simétricas, con la misma rapidez que tenían al separarse.">
        <Piso x0={PI} x1={PD} t={t} />
        <Pared x={PI} lado="izq" t={t} /><Pared x={PD} lado="der" t={t} />
        <Centro x={C} t={t} />
        <Bloque x={PI + 54} color={t.a} letra="A" t={t} />
        <Flecha x0={PI + 78} x1={PI + 78 + largo * r} color={t.a} etiqueta={<Sub base="v" sub="A" prima />} discontinua />
        <Bloque x={PD - 54} color={t.b} letra="B" t={t} />
        <Flecha x0={PD - 78} x1={PD - 78 - largo * r} color={t.b} etiqueta={<Sub base="v" sub="B" prima />} discontinua />
      </Panel>
    </Marco>
  );
}

export const FIGURAS: Record<string, () => JSX.Element> = {
  'choque-1d': Choque1D,
  'choque-pared': ChoquePared,
  'bloques-entre-paredes': BloquesEntreParedes,
  'secuencia-choques': SecuenciaChoques,
};

export function FiguraContenido({ clave }: { clave: string }) {
  const F = FIGURAS[clave.trim()];
  if (!F) return <p className="text-sm text-red-600">Figura no disponible («{clave.trim()}»). Recargue la página para obtener la versión más reciente del aula.</p>;
  return <F />;
}
