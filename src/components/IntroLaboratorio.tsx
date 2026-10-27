/**
 * Bienvenida animada tras iniciar sesión: el profesor (su caricatura, ENTERA y sin recortes: public/profesor.png)
 * de pie tras la mesa de su laboratorio, mirando al espectador, con la tiza en la mano contra la pizarra, donde
 * se van escribiendo ecuaciones de teoría cuántica de campos.
 *  · La mesa delante tapa las piernas (la caricatura está en pose de marcha).
 *  · Cada ecuación tiene un ancho fijo (textLength): nunca se sale de la pizarra.
 *  · Una vez por inicio de sesión, ~9 s, con «Entrar al aula» para saltarla; con «reducir movimiento» queda
 *    quieta (todo escrito) y dura menos. Es solo una capa: la página carga debajo.
 */
import { useEffect, useState } from 'react';

const DURACION_MS = 9500;
// (el acceso indirecto permite compilar también este archivo fuera de Vite, p. ej. en la vista previa)
const IMAGEN = `${(import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'}profesor.png`;

// Caricatura original: 1086 × 1448 px. Escala y posición en la escena (viewBox 400 × 240).
const ESCALA = 0.17;
const X0 = 8;
const Y0 = 6;
// puño adelantado de la caricatura (≈ 930, 660 px) → posición de la tiza en la escena
const PUNO = { x: X0 + 930 * ESCALA, y: Y0 + 660 * ESCALA };

type Trozo = [string, ('sup' | 'sub')?];
const ECUACIONES: { trozos: Trozo[]; ancho: number }[] = [
  { ancho: 128, trozos: [['ℒ = ψ̄(iγ'], ['μ', 'sup'], ['∂'], ['μ', 'sub'], [' − m)ψ − ¼F'], ['μν', 'sub'], ['F'], ['μν', 'sup']] },
  { ancho: 138, trozos: [['Z[J] = ∫𝒟φ exp{ i∫d'], ['4', 'sup'], ['x (ℒ + Jφ) }']] },
  { ancho: 74, trozos: [['(□ + m'], ['2', 'sup'], [') φ(x) = 0']] },
  { ancho: 118, trozos: [['D'], ['F', 'sub'], ['(x − y) = ⟨0|T φ(x)φ(y)|0⟩']] },
  { ancho: 178, trozos: [['= ∫ d'], ['4', 'sup'], ['p/(2π)'], ['4', 'sup'], [' · i e'], ['−ip·(x−y)', 'sup'], [' / (p'], ['2', 'sup'], [' − m'], ['2', 'sup'], [' + iε)']] },
];
const X_TEXTO = PUNO.x + 9;
const Y_PRIMERA = 46;
const INTERLINEA = 21;
const INICIO = 0.6;
const POR_LINEA = 1.45;
const PAUSA = 0.2;

function Linea({ i }: { i: number }) {
  const e = ECUACIONES[i];
  const y = Y_PRIMERA + i * INTERLINEA;
  const t0 = INICIO + i * (POR_LINEA + PAUSA);
  return (
    <g>
      <clipPath id={`il-rev-${i}`}>
        <rect className="il-rev" x={X_TEXTO - 2} y={y - 13} width={e.ancho + 4} height="19" style={{ animationDelay: `${t0}s`, animationDuration: `${POR_LINEA}s` }} />
      </clipPath>
      <text clipPath={`url(#il-rev-${i})`} x={X_TEXTO} y={y} textLength={e.ancho} lengthAdjust="spacingAndGlyphs"
        fontSize="9.5" fill="#eef4ee" fontFamily="'Cambria Math', 'STIX Two Math', 'Latin Modern Math', Georgia, serif" fontStyle="italic">
        {e.trozos.map(([t, tipo], k) => (
          <tspan key={k} fontSize={tipo ? 6.5 : 9.5} baselineShift={tipo === 'sup' ? 'super' : tipo === 'sub' ? 'sub' : undefined}>{t}</tspan>
        ))}
      </text>
      <circle className="il-tiza" cx={X_TEXTO} cy={y - 3} r="1.5" fill="#ffffff"
        style={{ animationDelay: `${t0}s`, animationDuration: `${POR_LINEA}s`, ['--il-dx' as string]: `${e.ancho}px` }} />
    </g>
  );
}

export function IntroLaboratorio({ nombre, onFin }: { nombre: string; onFin: () => void }) {
  const [saliendo, setSaliendo] = useState(false);
  const [imagenOk, setImagenOk] = useState(true);
  useEffect(() => {
    const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = window.setTimeout(() => setSaliendo(true), reducir ? 2500 : DURACION_MS);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!saliendo) return;
    const t = window.setTimeout(onFin, 350);
    return () => window.clearTimeout(t);
  }, [saliendo, onFin]);

  const mesaY = Y0 + 845 * ESCALA; // a la altura del cinturón
  return (
    <div
      role="dialog"
      aria-label="Bienvenida"
      className={`fixed inset-0 z-[55] flex flex-col items-center justify-center bg-gradient-to-b from-slate-100 to-white px-4 transition-opacity duration-300 dark:from-primario-950 dark:to-[#071022] ${saliendo ? 'opacity-0' : 'opacity-100'}`}
    >
      <svg viewBox="0 0 400 240" className="w-full max-w-3xl drop-shadow-sm" role="img" aria-label="El profesor, en su laboratorio, escribe ecuaciones de teoría cuántica de campos en la pizarra">
        <style>{`
          .il-rev { transform-box: fill-box; transform-origin: left; transform: scaleX(0); animation: il-rev linear forwards; }
          .il-tiza { opacity: 0; animation: il-tiza linear forwards; }
          .il-burbuja { animation: il-sube 1.6s ease-in infinite; }
          .il-llama { transform-box: fill-box; transform-origin: bottom; animation: il-llama .5s ease-in-out infinite alternate; }
          .il-profe { transform-box: view-box; transform-origin: ${X0 + 560 * ESCALA}px ${mesaY}px; animation: il-escribe 1.1s ease-in-out infinite alternate; }
          @keyframes il-rev { to { transform: scaleX(1); } }
          @keyframes il-tiza { 0% { opacity: 1; transform: translateX(0); } 97% { opacity: 1; } 100% { opacity: 0; transform: translateX(var(--il-dx)); } }
          @keyframes il-sube { 0% { transform: translateY(0); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateY(-26px); opacity: 0; } }
          @keyframes il-llama { from { transform: scaleY(.85); } to { transform: scaleY(1.15); } }
          @keyframes il-escribe { from { transform: rotate(-1.2deg); } to { transform: rotate(0.8deg); } }
          @media (prefers-reduced-motion: reduce) {
            .il-rev { animation: none; transform: none; }
            .il-tiza, .il-burbuja, .il-llama, .il-profe { animation: none; }
          }
        `}</style>
        <defs>
          <linearGradient id="il-pared" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#e2e8f0" />
            <stop offset="1" stopColor="#f8fafc" />
          </linearGradient>
          <linearGradient id="il-madera" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#9a7652" />
            <stop offset="1" stopColor="#6f5137" />
          </linearGradient>
          <linearGradient id="il-pizarra" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#2c5146" />
            <stop offset="1" stopColor="#1d3a32" />
          </linearGradient>
        </defs>

        {/* pared, zócalo y pizarra */}
        <rect x="0" y="0" width="400" height="240" fill="url(#il-pared)" />
        <rect x="0" y="200" width="400" height="40" fill="#cbd5e1" />
        <rect x={PUNO.x - 4} y="20" width={400 - PUNO.x - 4} height="140" rx="3" fill="#7a5a3a" />
        <rect x={PUNO.x} y="24" width={400 - PUNO.x - 12} height="128" rx="2" fill="url(#il-pizarra)" />
        <rect x={PUNO.x - 4} y="152" width={400 - PUNO.x - 4} height="5" rx="1" fill="#5d4329" />
        <rect x={PUNO.x + 150} y="149" width="12" height="3" rx="1" fill="#f8fafc" />
        <rect x={PUNO.x + 166} y="149" width="9" height="3" rx="1" fill="#fde68a" />
        {/* restos de tiza borrada, para dar textura */}
        <path d={`M${PUNO.x + 120} 135 q20 -6 40 2 M${PUNO.x + 20} 30 q30 4 60 -2`} stroke="#ffffff10" strokeWidth="6" fill="none" />
        {ECUACIONES.map((_, i) => <Linea key={i} i={i} />)}

        {/* el profesor: su caricatura entera, de pie detrás de la mesa */}
        <g className="il-profe">
          {imagenOk ? (
            <image href={IMAGEN} x={X0} y={Y0} width={1086 * ESCALA} height={1448 * ESCALA} onError={() => setImagenOk(false)} />
          ) : (
            <text x={X0 + 90} y="100" fontSize="9" textAnchor="middle" fill="#64748b">(falta public/profesor.png)</text>
          )}
          {/* tiza en el puño adelantado */}
          <rect x={PUNO.x + 1} y={PUNO.y - 8} width="3.2" height="10" rx="1.2" fill="#f8fafc" stroke="#94a3b8" strokeWidth="0.4" transform={`rotate(48 ${PUNO.x + 2.6} ${PUNO.y - 3})`} />
        </g>

        {/* mesa de laboratorio delante (tapa las piernas) */}
        <rect x="0" y={mesaY} width={PUNO.x + 18} height="6" rx="1.5" fill="#3f4a5a" />
        <rect x="4" y={mesaY + 6} width={PUNO.x + 10} height={240 - mesaY - 6} fill="url(#il-madera)" />
        <rect x="12" y={mesaY + 14} width={(PUNO.x - 6) / 2} height={240 - mesaY - 22} rx="2" fill="none" stroke="#5d4329" strokeWidth="1.2" />
        <rect x={18 + (PUNO.x - 6) / 2} y={mesaY + 14} width={(PUNO.x - 6) / 2 - 6} height={240 - mesaY - 22} rx="2" fill="none" stroke="#5d4329" strokeWidth="1.2" />

        {/* sobre la mesa: matraz que burbujea, vaso, gradilla y mechero (en los extremos, sin tapar al profesor) */}
        <g transform={`translate(4 ${mesaY - 32})`}>
          <path d="M10 2 h9 v8 l12 18 q2 4 -2 4 h-28 q-4 0 -2 -4 l11 -18 z" fill="#ffffffaa" stroke="#334155" strokeWidth="1" />
          <path d="M2 22 h26 l3 6 q1 4 -3 4 h-25 q-4 0 -3 -4 z" fill="#22c55e" opacity="0.9" />
          {[0, 0.55, 1.1].map((d, i) => <circle key={i} className="il-burbuja" cx={12 + i * 4} cy={22} r={1.3 + (i % 2) * 0.6} fill="#dcfce7" style={{ animationDelay: `${d}s` }} />)}
          <path d="M36 12 h16 v18 q0 2 -2 2 h-12 q-2 0 -2 -2 z" fill="#ffffffaa" stroke="#334155" strokeWidth="0.9" />
          <rect x="37" y="21" width="14" height="10" fill="#3b82f6" opacity="0.75" />
        </g>
        {/* mechero */}
        <g transform={`translate(-2 ${mesaY - 26})`}>
          <rect x="62" y="16" width="10" height="10" rx="2" fill="#64748b" />
          <rect x="65.5" y="7" width="3" height="9" fill="#94a3b8" />
          <path className="il-llama" d="M67 7 q-3 -4 0 -9 q3 5 0 9 z" fill="#60a5fa" />
        </g>
        <g transform={`translate(${PUNO.x - 44} ${mesaY - 24})`}>
          <rect x="0" y="16" width="30" height="3" rx="1" fill="#94a3b8" />
          {['#e11d48', '#eab308', '#a855f7', '#0ea5e9'].map((c, i) => (
            <g key={c}>
              <rect x={2 + i * 7} y="0" width="4.6" height="19" rx="2.3" fill="#ffffffaa" stroke="#334155" strokeWidth="0.7" />
              <rect x={2.8 + i * 7} y="8" width="3" height="10" rx="1.5" fill={c} />
            </g>
          ))}
        </g>
      </svg>
      <h1 className="mt-3 text-center font-serif text-2xl font-semibold text-primario-950 dark:text-white">¡Bienvenido{nombre ? `, ${nombre}` : ''}!</h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Preparando la clase…</p>
      <button className="btn-primario mt-4" onClick={() => setSaliendo(true)}>Entrar al aula</button>
    </div>
  );
}
