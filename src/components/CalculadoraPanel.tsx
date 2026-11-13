/**
 * Panel de la calculadora científica integrada (se carga la primera vez que se abre). Vive en el mismo documento:
 * no abre ventanas, pestañas ni iframes, así que usarla no cambia la visibilidad de la página ni el foco de la ventana
 * y no activa la vigilancia del examen (IntegridadExamen). Todo se calcula en el navegador (src/lib/calculadora/motor),
 * sin peticiones al servidor ni telemetría propia; el historial solo existe en memoria mientras dura la actividad.
 * Permanece montado (oculto) al cerrarlo, así que conserva la operación, ANS, el historial y la posición.
 */
import { useEffect, useRef, useState, type KeyboardEvent as KE, type PointerEvent as PE } from 'react';
import { createPortal } from 'react-dom';
import { evaluar, formatear, type ModoAngulo } from '@/lib/calculadora/motor';

interface Linea { expr: string; texto: string }
type Tecla = { r: string; ins?: string; accion?: 'igual' | 'del' | 'ac' | 'signo' | 'modo' | 'copiar' | 'pegar'; titulo?: string; tono?: 'op' | 'fn' | 'igual' | 'borrar' };

const TECLAS: Tecla[] = [
  { r: 'sin', ins: 'sin(', tono: 'fn' }, { r: 'cos', ins: 'cos(', tono: 'fn' }, { r: 'tan', ins: 'tan(', tono: 'fn' }, { r: 'π', ins: 'π', tono: 'fn' }, { r: 'e', ins: 'e', tono: 'fn', titulo: 'Número de Euler' },
  { r: 'sin⁻¹', ins: 'asin(', tono: 'fn' }, { r: 'cos⁻¹', ins: 'acos(', tono: 'fn' }, { r: 'tan⁻¹', ins: 'atan(', tono: 'fn' }, { r: 'log', ins: 'log(', tono: 'fn', titulo: 'Logaritmo decimal' }, { r: 'ln', ins: 'ln(', tono: 'fn', titulo: 'Logaritmo natural' },
  { r: 'x²', ins: '^2', tono: 'fn' }, { r: 'x³', ins: '^3', tono: 'fn' }, { r: 'xʸ', ins: '^', tono: 'fn', titulo: 'Potencia' }, { r: '√', ins: '√(', tono: 'fn', titulo: 'Raíz cuadrada' }, { r: 'ʸ√x', ins: 'root(', tono: 'fn', titulo: 'Raíz de índice y: root(índice, número)' },
  { r: 'eˣ', ins: 'exp(', tono: 'fn' }, { r: '1/x', ins: '^(-1)', tono: 'fn', titulo: 'Inverso' }, { r: '|x|', ins: 'abs(', tono: 'fn', titulo: 'Valor absoluto' }, { r: 'n!', ins: '!', tono: 'fn', titulo: 'Factorial' }, { r: 'EXP', ins: 'E', tono: 'fn', titulo: 'Notación científica: 3E8 = 3×10⁸' },
  { r: '7', ins: '7' }, { r: '8', ins: '8' }, { r: '9', ins: '9' }, { r: 'DEL', accion: 'del', tono: 'borrar', titulo: 'Borrar el último carácter' }, { r: 'AC', accion: 'ac', tono: 'borrar', titulo: 'Limpiar' },
  { r: '4', ins: '4' }, { r: '5', ins: '5' }, { r: '6', ins: '6' }, { r: '×', ins: '×', tono: 'op' }, { r: '÷', ins: '÷', tono: 'op' },
  { r: '1', ins: '1' }, { r: '2', ins: '2' }, { r: '3', ins: '3' }, { r: '+', ins: '+', tono: 'op' }, { r: '−', ins: '−', tono: 'op' },
  { r: '0', ins: '0' }, { r: '.', ins: '.' }, { r: '(', ins: '(', tono: 'op' }, { r: ')', ins: ')', tono: 'op' }, { r: '%', ins: '%', tono: 'op', titulo: 'Porcentaje' },
  { r: '(−)', accion: 'signo', tono: 'op', titulo: 'Cambiar el signo' }, { r: ',', ins: ',', tono: 'op', titulo: 'Separador de root(índice, número)' }, { r: 'ANS', ins: 'ANS', tono: 'fn', titulo: 'Resultado anterior' }, { r: '=', accion: 'igual', tono: 'igual' },
];

const TONO: Record<NonNullable<Tecla['tono']> | 'num', string> = {
  num: 'bg-white hover:bg-gray-50 dark:bg-white/10 dark:hover:bg-white/15',
  op: 'bg-primario-50 text-primario-800 hover:bg-primario-100 dark:bg-primario-800/40 dark:text-primario-100 dark:hover:bg-primario-800/60',
  fn: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10',
  borrar: 'bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-100',
  igual: 'col-span-2 bg-primario-800 text-white hover:bg-primario-700 dark:bg-primario-500 dark:hover:bg-primario-400',
};

const MAX_HISTORIAL = 8;

export default function CalculadoraPanel({ abierta, onCerrar }: { abierta: boolean; onCerrar: () => void }) {
  const [expr, setExpr] = useState('');
  const [salida, setSalida] = useState<{ texto: string; error?: boolean } | null>(null);
  const [ans, setAns] = useState(0);
  const [modo, setModo] = useState<ModoAngulo>('DEG');
  const [historial, setHistorial] = useState<Linea[]>([]);
  const [memoria, setMemoria] = useState<string | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ dx: number; dy: number } | null>(null);
  const recienCalculado = useRef(false);

  // al abrir, el foco pasa al panel (teclado físico); el foco se mueve DENTRO del documento: no es salida del examen
  useEffect(() => { if (abierta) panel.current?.focus({ preventScroll: true }); }, [abierta]);

  // si la ventana cambia de tamaño, el panel no puede quedar fuera de la pantalla
  useEffect(() => {
    const ajustar = () => setPos((p) => (p ? limitar(p, panel.current) : p));
    window.addEventListener('resize', ajustar);
    return () => window.removeEventListener('resize', ajustar);
  }, []);

  function insertar(s: string) {
    setSalida(null);
    // tras «=», un número empieza una operación nueva; un operador continúa desde ANS
    if (recienCalculado.current) {
      recienCalculado.current = false;
      if (/^[×÷+−^%!]/.test(s) || s === '^2' || s === '^3' || s === '^(-1)') { setExpr('ANS' + s); return; }
      setExpr(s);
      return;
    }
    setExpr((e) => (e + s).slice(0, 200));
  }

  function calcular() {
    if (!expr.trim()) return;
    const r = evaluar(expr, { modo, ans });
    recienCalculado.current = r.ok;
    if (r.ok) {
      setSalida({ texto: r.texto });
      setAns(r.valor);
      setHistorial((h) => [{ expr, texto: r.texto }, ...h].slice(0, MAX_HISTORIAL));
    } else setSalida({ texto: r.error, error: true });
  }

  function accion(a: NonNullable<Tecla['accion']>) {
    if (a === 'igual') return calcular();
    if (a === 'modo') return setModo((m) => (m === 'DEG' ? 'RAD' : 'DEG'));
    if (a === 'copiar') { if (salida && !salida.error) setMemoria(salida.texto); return; }
    if (a === 'pegar') { if (memoria) insertar(memoria); return; }
    recienCalculado.current = false;
    setSalida(null);
    if (a === 'ac') return setExpr('');
    if (a === 'del') return setExpr((e) => (e.endsWith('ANS') ? e.slice(0, -3) : e.slice(0, -1)));
    if (a === 'signo') return setExpr((e) => (e ? `−(${e})` : '−'));
  }

  function teclado(e: KE<HTMLDivElement>) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    let manejada = true;
    if (k === 'Enter' || k === '=') calcular();
    else if (k === 'Backspace') accion('del');
    else if (k === 'Delete') accion('ac');
    else if (k === 'Escape') onCerrar();
    else if (/^[0-9.+\-*/^()%!,]$/.test(k)) insertar(k === '*' ? '×' : k === '/' ? '÷' : k === '-' ? '−' : k);
    else if (/^[a-zA-Z]$/.test(k)) insertar(k === 'E' ? 'E' : k.toLowerCase());
    else manejada = false;
    if (manejada) { e.preventDefault(); e.stopPropagation(); }
  }

  // arrastre en pantallas medianas y grandes (en el teléfono el panel va fijo abajo)
  function iniciarArrastre(e: PE<HTMLDivElement>) {
    if (!window.matchMedia('(min-width: 640px)').matches || !panel.current) return;
    const r = panel.current.getBoundingClientRect();
    arrastre.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function mover(e: PE<HTMLDivElement>) {
    if (!arrastre.current) return;
    setPos(limitar({ x: e.clientX - arrastre.current.dx, y: e.clientY - arrastre.current.dy }, panel.current));
  }
  function soltar(e: PE<HTMLDivElement>) {
    arrastre.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }

  const estilo = pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : undefined;

  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-label="Calculadora científica"
      aria-hidden={!abierta}
      tabIndex={-1}
      hidden={!abierta}
      onKeyDown={teclado}
      style={estilo}
      data-calculadora=""
      className="fixed inset-x-0 bottom-0 z-40 max-h-[62vh] overflow-y-auto rounded-t-2xl border border-gray-200 bg-white text-tinta shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-primario-300 dark:border-white/10 dark:bg-primario-950 dark:text-gray-100 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:max-h-[calc(100vh-2rem)] sm:w-[320px] sm:rounded-2xl"
    >
      <div
        className="flex cursor-default items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-white/10 sm:cursor-move"
        onPointerDown={iniciarArrastre} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}
      >
        <span className="text-sm font-semibold">🧮 Calculadora</span>
        <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => accion('modo')}
          className="rounded-md border border-gray-300 px-2 py-0.5 text-xs font-semibold tabular-nums dark:border-white/20"
          aria-label={`Unidad de ángulo: ${modo === 'DEG' ? 'grados' : 'radianes'}. Pulse para cambiar.`}>{modo}</button>
        <span className="flex-1" />
        <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={onCerrar}
          className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10" aria-label="Cerrar la calculadora">✕</button>
      </div>

      <div className="px-3 pt-2">
        <div className="min-h-[1.5rem] break-all text-right font-mono text-sm text-gray-600 dark:text-gray-300" aria-label="Operación">{expr || ' '}</div>
        <div aria-live="polite" className={`min-h-[2rem] break-all text-right font-mono ${salida?.error ? 'text-sm text-red-700 dark:text-red-300' : 'text-2xl font-semibold tabular-nums'}`}>
          {salida ? (salida.error ? salida.texto : `= ${salida.texto}`) : ' '}
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
          <button type="button" className="rounded px-1.5 py-0.5 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-white/10" onClick={() => accion('copiar')} disabled={!salida || salida.error}
            title="Guarda el resultado en la memoria de la calculadora (no usa el portapapeles)">Copiar</button>
          <button type="button" className="rounded px-1.5 py-0.5 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-white/10" onClick={() => accion('pegar')} disabled={!memoria}
            title="Inserta el número guardado">Pegar{memoria ? ` ${memoria}` : ''}</button>
          <span className="flex-1" />
          <span className="tabular-nums">ANS = {formatear(ans)}</span>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-1.5 p-3">
        {TECLAS.map((t) => (
          <button key={t.r} type="button" title={t.titulo ?? t.r} aria-label={t.titulo ?? t.r}
            onClick={() => (t.accion ? accion(t.accion) : insertar(t.ins!))}
            className={`min-h-[40px] rounded-lg text-sm font-medium transition sm:min-h-[36px] ${TONO[t.tono ?? 'num']}`}>{t.r}</button>
        ))}
      </div>

      {historial.length > 0 && (
        <div className="border-t border-gray-200 px-3 py-2 dark:border-white/10">
          <p className="mb-1 text-xs font-medium text-gray-500">Historial (solo en esta sesión)</p>
          <ul className="space-y-0.5">
            {historial.map((h, i) => (
              <li key={i}>
                <button type="button" className="flex w-full justify-between gap-2 rounded px-1 py-0.5 text-left font-mono text-xs hover:bg-gray-100 dark:hover:bg-white/10"
                  onClick={() => insertar(h.texto)} title="Insertar este resultado">
                  <span className="truncate text-gray-500">{h.expr}</span><span className="shrink-0 tabular-nums">= {h.texto}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>,
    document.body,
  );
}

function limitar(p: { x: number; y: number }, el: HTMLElement | null) {
  const w = el?.offsetWidth ?? 320, h = el?.offsetHeight ?? 400;
  return { x: Math.min(Math.max(8, p.x), Math.max(8, window.innerWidth - w - 8)), y: Math.min(Math.max(8, p.y), Math.max(8, window.innerHeight - h - 8)) };
}
