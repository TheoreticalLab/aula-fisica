/**
 * Bienvenida animada tras iniciar sesión: el profesor en su laboratorio escribe en la pizarra ecuaciones de
 * teoría cuántica de campos mientras mira al espectador.
 *  · La cabeza es la caricatura real del profesor (public/profesor.png), recortada en pantalla; el cuerpo
 *    (traje azul marino, camisa y corbata granate, como en la caricatura) es SVG para poder animar el brazo.
 *  · Las ecuaciones aparecen trazo a trazo con un punto de tiza; el brazo acompaña la escritura.
 *  · Una vez por inicio de sesión, ~9 s, con «Entrar al aula» para saltarla; con «reducir movimiento» queda
 *    quieta (todo escrito) y dura menos. Es solo una capa: la página carga debajo.
 */
import { useEffect, useState } from 'react';

const DURACION_MS = 9500;
// (el acceso indirecto permite compilar también este archivo fuera de Vite, p. ej. en la vista previa)
const IMAGEN = `${(import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'}profesor.png`;

// Colores de la caricatura
const TRAJE = '#26304f';
const TRAJE_OSCURO = '#1c2440';
const CONTORNO = '#141a30';
const CAMISA = '#f8fafc';
const CORBATA = '#7a1f35';
const PIEL = '#b8743f';

// Ecuaciones (texto con sub/superíndices): [texto, 'sup' | 'sub' | undefined]
type Trozo = [string, ('sup' | 'sub')?];
const ECUACIONES: { y: number; ancho: number; trozos: Trozo[] }[] = [
  { y: 44, ancho: 196, trozos: [['ℒ = ψ̄(iγ'], ['μ', 'sup'], ['∂'], ['μ', 'sub'], [' − m)ψ − ¼ F'], ['μν', 'sub'], ['F'], ['μν', 'sup']] },
  { y: 66, ancho: 178, trozos: [['Z[J] = ∫𝒟φ exp{ i∫d'], ['4', 'sup'], ['x (ℒ + Jφ) }']] },
  { y: 88, ancho: 110, trozos: [['(□ + m'], ['2', 'sup'], [') φ(x) = 0']] },
  { y: 110, ancho: 200, trozos: [['⟨0|T φ(x)φ(y)|0⟩ = ∫ '], ['d⁴p', 'sup'], ['/(2π)⁴ · i e'], ['−ip·(x−y)', 'sup'], [' / (p² − m² + iε)']] },
];
const INICIO = 0.7; // s
const POR_LINEA = 1.9; // s escribiendo cada línea
const PAUSA = 0.25;

function Linea({ i }: { i: number }) {
  const e = ECUACIONES[i];
  const t0 = INICIO + i * (POR_LINEA + PAUSA);
  return (
    <g>
      <clipPath id={`il-rev-${i}`}>
        <rect className="il-rev" x="24" y={e.y - 14} width={e.ancho + 6} height="20" style={{ animationDelay: `${t0}s`, animationDuration: `${POR_LINEA}s` }} />
      </clipPath>
      <text clipPath={`url(#il-rev-${i})`} x="26" y={e.y} fontSize="10" fill="#f1f5f0" fontFamily="'Cambria Math', 'STIX Two Math', Georgia, serif" fontStyle="italic">
        {e.trozos.map(([t, tipo], k) => (
          <tspan key={k} fontSize={tipo ? 7 : 10} baselineShift={tipo === 'sup' ? 'super' : tipo === 'sub' ? 'sub' : undefined}>{t}</tspan>
        ))}
      </text>
      {/* punto de tiza que recorre la línea mientras se escribe */}
      <circle className="il-tiza" cx="26" cy={e.y - 3} r="1.6" fill="#ffffff"
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

  // el brazo baja una línea cada vez que empieza la siguiente ecuación
  const pasos = ECUACIONES.map((_, i) => INICIO + i * (POR_LINEA + PAUSA));
  const total = pasos[pasos.length - 1] + POR_LINEA;
  const keyBrazo = ECUACIONES.map((e, i) => {
    const p = ((pasos[i] / total) * 100).toFixed(1);
    return `${p}% { transform: translateY(${(e.y - ECUACIONES[0].y) * 0.55}px) rotate(${-i * 6}deg); }`;
  }).join(' ');

  return (
    <div
      role="dialog"
      aria-label="Bienvenida"
      className={`fixed inset-0 z-[55] flex flex-col items-center justify-center bg-gradient-to-b from-primario-50 to-white px-4 transition-opacity duration-300 dark:from-primario-950 dark:to-[#071022] ${saliendo ? 'opacity-0' : 'opacity-100'}`}
    >
      <svg viewBox="0 0 400 240" className="w-full max-w-2xl" role="img" aria-label="El profesor escribe ecuaciones de teoría cuántica de campos en la pizarra de su laboratorio">
        <style>{`
          .il-rev { transform-box: fill-box; transform-origin: left; transform: scaleX(0); animation: il-rev linear forwards; }
          .il-tiza { opacity: 0; animation: il-tiza linear forwards; }
          .il-burbuja { animation: il-sube 1.6s ease-in infinite; }
          .il-brazo { transform-box: view-box; transform-origin: 268px 116px; animation: il-baja ${total}s steps(1, end) forwards; }
          .il-mano { transform-box: view-box; transform-origin: 268px 116px; animation: il-escribe .22s ease-in-out infinite alternate; }
          .il-cabeza { transform-box: view-box; transform-origin: 300px 100px; animation: il-cabeza 3.2s ease-in-out infinite; }
          @keyframes il-rev { to { transform: scaleX(1); } }
          @keyframes il-tiza { 0% { opacity: 1; transform: translateX(0); } 98% { opacity: 1; } 100% { opacity: 0; transform: translateX(var(--il-dx)); } }
          @keyframes il-sube { 0% { transform: translateY(0); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateY(-30px); opacity: 0; } }
          @keyframes il-baja { 0% { transform: none; } ${keyBrazo} 100% { transform: translateY(${(ECUACIONES[3].y - ECUACIONES[0].y) * 0.55}px) rotate(-18deg); } }
          @keyframes il-escribe { from { transform: rotate(-2.5deg); } to { transform: rotate(2.5deg); } }
          @keyframes il-cabeza { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-2deg); } }
          @media (prefers-reduced-motion: reduce) {
            .il-rev { animation: none; transform: none; }
            .il-tiza, .il-burbuja, .il-brazo, .il-mano, .il-cabeza { animation: none; }
          }
        `}</style>
        <defs>
          {/* recorte de la cabeza en las coordenadas de la imagen original (1086 × 1448) */}
          <clipPath id="il-cabeza-recorte"><ellipse cx="615" cy="262" rx="172" ry="222" /></clipPath>
        </defs>

        {/* pared y pizarra */}
        <rect x="14" y="16" width="236" height="110" rx="3" fill="#7a5a3a" />
        <rect x="19" y="21" width="226" height="100" rx="2" fill="#24423a" />
        <rect x="19" y="121" width="226" height="4" fill="#5d4329" />
        <rect x="40" y="119" width="10" height="3" rx="1" fill="#f8fafc" />
        {ECUACIONES.map((_, i) => <Linea key={i} i={i} />)}

        {/* mesa del laboratorio */}
        <rect x="14" y="178" width="180" height="6" rx="2" fill="#8b6b4a" />
        <rect x="20" y="184" width="5" height="40" fill="#6b4f35" />
        <rect x="183" y="184" width="5" height="40" fill="#6b4f35" />
        <line x1="0" y1="224" x2="400" y2="224" stroke="#94a3b8" strokeWidth="2" />
        {/* matraz Erlenmeyer burbujeante */}
        <path d="M40 146 h10 v8 l13 19 q2 4 -2 4 h-32 q-4 0 -2 -4 l13 -19 z" fill="#ffffff55" stroke={CONTORNO} strokeWidth="1.1" />
        <path d="M31 167 h28 l5 7 q1 3 -2 3 h-34 q-3 0 -2 -3 z" fill="#22c55e" opacity="0.85" />
        {[0, 0.5, 1.0].map((d, i) => <circle key={i} className="il-burbuja" cx={41 + i * 4} cy={166} r={1.5 + (i % 2)} fill="#bbf7d0" style={{ animationDelay: `${d}s` }} />)}
        {/* vaso de precipitados */}
        <path d="M78 152 h22 v24 q0 2 -2 2 h-18 q-2 0 -2 -2 z" fill="#ffffff55" stroke={CONTORNO} strokeWidth="1" />
        <rect x="79" y="164" width="20" height="13" fill="#3b82f6" opacity="0.7" />
        {/* gradilla con tubos de ensayo */}
        <rect x="112" y="166" width="44" height="4" rx="1" fill="#94a3b8" />
        {[['#e11d48', 116], ['#eab308', 126], ['#a855f7', 136], ['#0ea5e9', 146]].map(([c, x]) => (
          <g key={x as number}>
            <rect x={x as number} y="148" width="6" height="22" rx="3" fill="#ffffff66" stroke={CONTORNO} strokeWidth="0.8" />
            <rect x={(x as number) + 1} y="158" width="4" height="11" rx="2" fill={c as string} />
          </g>
        ))}
        {/* mechero */}
        <rect x="166" y="168" width="14" height="10" rx="2" fill="#64748b" />
        <rect x="171" y="156" width="4" height="12" fill="#94a3b8" />
        <path className="il-burbuja" d="M173 156 q-4 -6 0 -12 q4 6 0 12 z" fill="#60a5fa" opacity="0.8" style={{ animationDuration: '0.9s' }} />

        {/* el profesor: de frente, mirando al espectador; escribe con la mano derecha */}
        <g>
          {/* piernas y zapatos */}
          <path d="M286 168 L284 218 L296 218 L299 170 Z" fill={TRAJE_OSCURO} stroke={CONTORNO} strokeWidth="1" />
          <path d="M301 170 L304 218 L316 218 L314 168 Z" fill={TRAJE} stroke={CONTORNO} strokeWidth="1" />
          <path d="M280 217 h17 q3 0 3 4 v2 h-22 q-1 -6 2 -6 z" fill="#141414" />
          <path d="M303 217 h17 q3 0 3 6 h-22 v-2 q0 -4 2 -4 z" fill="#141414" />
          {/* brazo izquierdo (a la derecha del dibujo), relajado */}
          <path d="M330 110 q10 22 8 46" fill="none" stroke={CONTORNO} strokeWidth="11" strokeLinecap="round" />
          <path d="M330 110 q10 22 8 46" fill="none" stroke={TRAJE} strokeWidth="9" strokeLinecap="round" />
          <circle cx="338" cy="160" r="5" fill={PIEL} stroke={CONTORNO} strokeWidth="0.8" />
          {/* chaqueta */}
          <path d="M270 104 Q300 96 330 104 L338 170 Q300 176 262 170 Z" fill={TRAJE} stroke={CONTORNO} strokeWidth="1.2" />
          {/* camisa, corbata, cinturón */}
          <path d="M289 100 L311 100 L304 150 L296 150 Z" fill={CAMISA} />
          <path d="M297 102 h6 l-1 4 l3 32 l-5 6 l-5 -6 l3 -32 z" fill={CORBATA} stroke={CONTORNO} strokeWidth="0.6" />
          <path d="M289 100 L296 126 L284 116 Z M311 100 L304 126 L316 116 Z" fill={TRAJE_OSCURO} stroke={CONTORNO} strokeWidth="0.8" />
          <circle cx="300" cy="156" r="1.4" fill={CONTORNO} />
          <circle cx="300" cy="164" r="1.4" fill={CONTORNO} />
          {/* cabeza: la caricatura real, recortada */}
          <g className="il-cabeza">
            {imagenOk ? (
              <g transform="translate(213.9 31.5) scale(0.14)">
                <image href={IMAGEN} x="0" y="0" width="1086" height="1448" clipPath="url(#il-cabeza-recorte)" onError={() => setImagenOk(false)} />
              </g>
            ) : (
              <g>
                <circle cx="300" cy="66" r="26" fill={PIEL} stroke={CONTORNO} strokeWidth="1.2" />
                <path d="M276 60 Q276 38 300 38 Q324 38 324 60 Q318 46 300 46 Q282 46 276 60 Z" fill="#1d1815" />
              </g>
            )}
          </g>
          {/* brazo derecho (a la izquierda del dibujo) hacia la pizarra, con la tiza */}
          <g className="il-brazo">
            <g className="il-mano">
              <path d="M270 112 L246 96 L236 78" fill="none" stroke={CONTORNO} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M270 112 L246 96 L236 78" fill="none" stroke={TRAJE} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M238 82 l-4 -6" stroke={CAMISA} strokeWidth="5" strokeLinecap="round" />
              <circle cx="233" cy="72" r="5" fill={PIEL} stroke={CONTORNO} strokeWidth="0.8" />
              <rect x="226" y="64" width="3" height="8" rx="1" fill="#f8fafc" transform="rotate(-35 228 68)" />
            </g>
          </g>
        </g>
      </svg>
      <h1 className="mt-2 text-center font-serif text-2xl font-semibold text-primario-950 dark:text-white">¡Bienvenido{nombre ? `, ${nombre}` : ''}!</h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Preparando la clase…</p>
      <button className="btn-primario mt-4" onClick={() => setSaliendo(true)}>Entrar al aula</button>
    </div>
  );
}
