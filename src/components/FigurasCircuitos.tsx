/**
 * Esquemas de circuitos con capacitores para el contenido (bloque ```figura```), con las mismas reglas que
 * FigurasChoques: solo dibujan lo que la clave nombra, sin parámetros del contenido y sin resultados.
 * Cada capacitor lleva su nombre y su capacitancia; la batería, su borne + (placa larga) y su voltaje.
 * Colores adaptados al modo oscuro. El fondo del dibujo es el de la tarjeta.
 */
import type { ReactNode } from 'react';
import { useDark } from '@/lib/tema';

interface Tinta { cable: string; cap: string; bat: string; texto: string }
function useTinta(): Tinta {
  return useDark()
    ? { cable: '#d1d5db', cap: '#8fb0ff', bat: '#f87171', texto: '#e5e7eb' }
    : { cable: '#1f2937', cap: '#1d4ed8', bat: '#b91c1c', texto: '#1f2937' };
}

const FUENTE = 'Inter, system-ui, sans-serif';
const MARGEN = 70;
const ABAJO = 30;
type P = [number, number];

function Cable({ pts, t }: { pts: P[]; t: Tinta }) {
  return <polyline points={pts.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={t.cable} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />;
}
function Nodo({ x, y, t }: { x: number; y: number; t: Tinta }) {
  return <circle cx={x} cy={y} r={4.5} fill={t.cable} />;
}
function Texto({ x, y, children, tam = 15, anc = 'middle', color, negrita = false }: { x: number; y: number; children: ReactNode; tam?: number; anc?: 'start' | 'middle' | 'end'; color: string; negrita?: boolean }) {
  return <text x={x} y={y} fontSize={tam} textAnchor={anc} fill={color} fontWeight={negrita ? 700 : 500} fontFamily={FUENTE}>{children}</text>;
}
function Nombre({ i }: { i: number }) {
  return <>C<tspan fontSize="0.72em" dy="0.25em">{i}</tspan></>;
}

/** Capacitor en un cable horizontal de x1 a x2, centrado en cx. */
function CapH({ x1, x2, y, cx, i, valor, abajo = false, t }: { x1: number; x2: number; y: number; cx: number; i: number; valor: string; abajo?: boolean; t: Tinta }) {
  const g = 6;
  return (
    <g>
      <Cable pts={[[x1, y], [cx - g, y]]} t={t} />
      <Cable pts={[[cx + g, y], [x2, y]]} t={t} />
      {[cx - g, cx + g].map((x) => <line key={x} x1={x} y1={y - 17} x2={x} y2={y + 17} stroke={t.cap} strokeWidth={4} strokeLinecap="round" />)}
      {abajo ? (
        <>
          <Texto x={cx} y={y + 40} color={t.cap} negrita><Nombre i={i} /></Texto>
          <Texto x={cx} y={y + 58} tam={13} color={t.texto}>{valor}</Texto>
        </>
      ) : (
        <>
          <Texto x={cx} y={y - 44} tam={13} color={t.texto}>{valor}</Texto>
          <Texto x={cx} y={y - 24} color={t.cap} negrita><Nombre i={i} /></Texto>
        </>
      )}
    </g>
  );
}

/** Capacitor en un cable vertical de y1 a y2, centrado en cy. */
function CapV({ x, y1, y2, cy, i, valor, t }: { x: number; y1: number; y2: number; cy: number; i: number; valor: string; t: Tinta }) {
  const g = 6;
  return (
    <g>
      <Cable pts={[[x, y1], [x, cy - g]]} t={t} />
      <Cable pts={[[x, cy + g], [x, y2]]} t={t} />
      {[cy - g, cy + g].map((y) => <line key={y} x1={x - 17} y1={y} x2={x + 17} y2={y} stroke={t.cap} strokeWidth={4} strokeLinecap="round" />)}
      <Texto x={x + 26} y={cy - 2} anc="start" color={t.cap} negrita><Nombre i={i} /></Texto>
      <Texto x={x + 26} y={cy + 16} tam={13} anc="start" color={t.texto}>{valor}</Texto>
    </g>
  );
}

/** Batería en un cable vertical; borne + (placa larga) arriba. */
function BateriaV({ x, y1, y2, cy, valor, t }: { x: number; y1: number; y2: number; cy: number; valor: string; t: Tinta }) {
  return (
    <g>
      <Cable pts={[[x, y1], [x, cy - 6]]} t={t} />
      <Cable pts={[[x, cy + 6], [x, y2]]} t={t} />
      <line x1={x - 22} y1={cy - 6} x2={x + 22} y2={cy - 6} stroke={t.bat} strokeWidth={3.5} strokeLinecap="round" />
      <line x1={x - 11} y1={cy + 6} x2={x + 11} y2={cy + 6} stroke={t.bat} strokeWidth={6} strokeLinecap="round" />
      <Texto x={x + 28} y={cy - 10} tam={16} anc="start" color={t.bat} negrita>+</Texto>
      <Texto x={x + 28} y={cy + 22} tam={18} anc="start" color={t.bat} negrita>−</Texto>
      <Texto x={x - 28} y={cy + 6} anc="end" color={t.bat} negrita>{valor}</Texto>
    </g>
  );
}

/** Batería en un cable horizontal; borne + (placa larga) a la izquierda. */
function BateriaH({ x1, x2, y, cx, valor, t }: { x1: number; x2: number; y: number; cx: number; valor: string; t: Tinta }) {
  return (
    <g>
      <Cable pts={[[x1, y], [cx - 6, y]]} t={t} />
      <Cable pts={[[cx + 6, y], [x2, y]]} t={t} />
      <line x1={cx - 6} y1={y - 22} x2={cx - 6} y2={y + 22} stroke={t.bat} strokeWidth={3.5} strokeLinecap="round" />
      <line x1={cx + 6} y1={y - 11} x2={cx + 6} y2={y + 11} stroke={t.bat} strokeWidth={6} strokeLinecap="round" />
      <Texto x={cx - 18} y={y - 28} tam={16} color={t.bat} negrita>+</Texto>
      <Texto x={cx + 18} y={y - 28} tam={18} color={t.bat} negrita>−</Texto>
      <Texto x={cx} y={y + 42} color={t.bat} negrita>{valor}</Texto>
    </g>
  );
}

function Esquema({ w, h, descripcion, children }: { w: number; h: number; descripcion: string; children: ReactNode }) {
  return (
    <figure className="not-prose my-4 mx-auto max-w-2xl overflow-x-auto rounded-lg border border-gray-200 bg-white p-2 dark:border-white/10 dark:bg-gray-900">
      <svg viewBox={`${-MARGEN} 0 ${w + 2 * MARGEN} ${h + ABAJO}`} className="block h-auto w-full min-w-[300px]" role="img" aria-label={descripcion}>{children}</svg>
    </figure>
  );
}

/** [C1 en serie con C2] en paralelo con C3; ese conjunto en serie con C4 y C5; batería de 200 V. */
function Circuito1() {
  const t = useTinta();
  const top = 70, bot = 290, low = 160;
  return (
    <Esquema w={560} h={330} descripcion="Batería de 200 V. C1 (12 µF) en serie con C2 (6 µF); esa rama en paralelo con C3 (6 µF); ese conjunto en serie con C4 (15 µF) y C5 (6 µF).">
      <BateriaV x={60} y1={top} y2={bot} cy={180} valor="200 V" t={t} />
      <Cable pts={[[60, top], [130, top]]} t={t} />
      <CapH x1={130} x2={240} y={top} cx={185} i={1} valor="12 µF" t={t} />
      <CapH x1={240} x2={350} y={top} cx={295} i={2} valor="6 µF" t={t} />
      <Cable pts={[[130, top], [130, low]]} t={t} />
      <CapH x1={130} x2={350} y={low} cx={240} i={3} valor="6 µF" abajo t={t} />
      <Cable pts={[[350, low], [350, top]]} t={t} />
      <Nodo x={130} y={top} t={t} />
      <Nodo x={350} y={top} t={t} />
      <CapH x1={350} x2={500} y={top} cx={425} i={4} valor="15 µF" t={t} />
      <CapV x={500} y1={top} y2={bot} cy={180} i={5} valor="6 µF" t={t} />
      <Cable pts={[[500, bot], [60, bot]]} t={t} />
    </Esquema>
  );
}

/** C1 en serie con { C5 en paralelo con [ (C2 ∥ C3) en serie con C4 ] }; batería de 200 V. */
function Circuito2() {
  const t = useTinta();
  const top = 70, bot = 290, low = 160;
  return (
    <Esquema w={600} h={330} descripcion="Batería de 200 V. C1 (15 µF) en serie con un bloque: C5 (2 µF) en paralelo con la rama formada por C2 (3 µF) y C3 (1 µF) en paralelo, en serie con C4 (12 µF).">
      <BateriaV x={60} y1={top} y2={bot} cy={180} valor="200 V" t={t} />
      <CapH x1={60} x2={190} y={top} cx={125} i={1} valor="15 µF" t={t} />
      <Nodo x={190} y={top} t={t} />
      <CapV x={190} y1={top} y2={bot} cy={180} i={5} valor="2 µF" t={t} />
      <Nodo x={190} y={bot} t={t} />
      <Cable pts={[[190, top], [290, top]]} t={t} />
      <CapH x1={290} x2={430} y={top} cx={360} i={2} valor="3 µF" t={t} />
      <Cable pts={[[290, top], [290, low]]} t={t} />
      <CapH x1={290} x2={430} y={low} cx={360} i={3} valor="1 µF" abajo t={t} />
      <Cable pts={[[430, low], [430, top]]} t={t} />
      <Nodo x={290} y={top} t={t} />
      <Nodo x={430} y={top} t={t} />
      <Cable pts={[[430, top], [540, top]]} t={t} />
      <CapV x={540} y1={top} y2={bot} cy={180} i={4} valor="12 µF" t={t} />
      <Cable pts={[[540, bot], [60, bot]]} t={t} />
    </Esquema>
  );
}

/** Puente: arriba C1–a–C2, abajo C3–b–C4, C5 entre a y b; la batería une los extremos izquierdo y derecho. */
function Puente() {
  const t = useTinta();
  const top = 70, bot = 250, mid = 160, xl = 120, xm = 280, xr = 440;
  return (
    <Esquema w={560} h={380} descripcion="Batería de 200 V entre los extremos izquierdo y derecho. Rama superior: C1 (3 µF), punto a, C2 (2 µF). Rama inferior: C3 (6 µF), punto b, C4 (4 µF). C5 (5 µF) une los puntos a y b.">
      <Cable pts={[[xl, top], [xl, bot]]} t={t} />
      <Cable pts={[[xr, top], [xr, bot]]} t={t} />
      <CapH x1={xl} x2={xm} y={top} cx={200} i={1} valor="3 µF" t={t} />
      <CapH x1={xm} x2={xr} y={top} cx={360} i={2} valor="2 µF" t={t} />
      <CapH x1={xl} x2={xm} y={bot} cx={200} i={3} valor="6 µF" abajo t={t} />
      <CapH x1={xm} x2={xr} y={bot} cx={360} i={4} valor="4 µF" abajo t={t} />
      <CapV x={xm} y1={top} y2={bot} cy={mid} i={5} valor="5 µF" t={t} />
      {([[xm, top], [xm, bot], [xl, mid], [xr, mid]] as P[]).map(([x, y]) => <Nodo key={`${x}-${y}`} x={x} y={y} t={t} />)}
      <Texto x={xm - 14} y={top - 10} anc="end" color={t.texto} negrita>a</Texto>
      <Texto x={xm - 14} y={bot + 22} anc="end" color={t.texto} negrita>b</Texto>
      <Cable pts={[[xl, mid], [60, mid], [60, 340], [230, 340]]} t={t} />
      <BateriaH x1={230} x2={330} y={340} cx={280} valor="200 V" t={t} />
      <Cable pts={[[330, 340], [500, 340], [500, mid], [xr, mid]]} t={t} />
    </Esquema>
  );
}

export const FIGURAS_CIRCUITOS: Record<string, () => JSX.Element> = {
  'capacitores-circuito-1': Circuito1,
  'capacitores-circuito-2': Circuito2,
  'capacitores-puente': Puente,
};
