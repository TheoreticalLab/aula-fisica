/**
 * Bienvenida animada tras iniciar sesión: el profesor (el mismo personaje de la portada) en su laboratorio,
 * con un matraz que burbujea y cohetes que despegan al pulsar su control. Se muestra una vez por inicio de
 * sesión, unos segundos, y se puede saltar. Con «reducir movimiento» queda quieta y dura menos.
 * Es solo una capa encima: no desmonta ni retrasa la página que se carga debajo.
 */
import { useEffect, useState } from 'react';
import { Cabeza, COLORES as C, Torso } from '@/components/AnimacionPortada';

const DURACION_MS = 4800;

function Cohete({ x, retraso, color }: { x: number; retraso: number; color: string }) {
  return (
    <g className="il-cohete" style={{ animationDelay: `${retraso}s` }}>
      <g transform={`translate(${x} 0)`}>
        {/* llama */}
        <path className="il-llama" d="M-3 152 Q0 166 3 152 Z" fill="#f59e0b" style={{ animationDelay: `${retraso}s` }} />
        <path d="M-1.6 152 Q0 160 1.6 152 Z" fill="#fde68a" />
        {/* cuerpo */}
        <path d="M-4 152 L-4 136 Q0 126 4 136 L4 152 Z" fill="#f8fafc" stroke={C.CONTORNO} strokeWidth="0.9" />
        <path d="M-4 147 L-8 153 L-4 152 Z M4 147 L8 153 L4 152 Z" fill={color} stroke={C.CONTORNO} strokeWidth="0.7" />
        <circle cx="0" cy="140" r="1.6" fill="#7dd3fc" stroke={C.CONTORNO} strokeWidth="0.5" />
      </g>
    </g>
  );
}

export function IntroLaboratorio({ nombre, onFin }: { nombre: string; onFin: () => void }) {
  const [saliendo, setSaliendo] = useState(false);
  useEffect(() => {
    const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = window.setTimeout(() => setSaliendo(true), reducir ? 1800 : DURACION_MS);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!saliendo) return;
    const t = window.setTimeout(onFin, 350);
    return () => window.clearTimeout(t);
  }, [saliendo, onFin]);

  return (
    <div
      role="dialog"
      aria-label="Bienvenida"
      className={`fixed inset-0 z-[55] flex flex-col items-center justify-center bg-gradient-to-b from-primario-50 to-white px-4 transition-opacity duration-300 dark:from-primario-950 dark:to-[#071022] ${saliendo ? 'opacity-0' : 'opacity-100'}`}
    >
      <svg viewBox="0 0 360 200" className="w-full max-w-xl text-primario-900 dark:text-primario-200" role="img" aria-label="El profesor en su laboratorio lanza pequeños cohetes">
        <style>{`
          .il-burbuja { animation: il-sube 1.6s ease-in infinite; }
          .il-cohete { animation: il-despega 2.4s cubic-bezier(.5,0,.8,.4) infinite; }
          .il-llama { transform-box: fill-box; transform-origin: top; animation: il-llama .15s ease-in-out infinite alternate; }
          .il-humo { animation: il-humo 2.4s ease-out infinite; }
          .il-boton { animation: il-boton 0.6s steps(2) infinite; }
          .il-brazo { transform-box: view-box; transform-origin: 272px 84px; animation: il-brazo 1.2s ease-in-out infinite; }
          .il-cuerpo { animation: il-respira 2.4s ease-in-out infinite; }
          .il-chispa { animation: il-chispa 1.2s ease-in-out infinite alternate; }
          @keyframes il-sube { 0% { transform: translateY(0); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateY(-34px); opacity: 0; } }
          @keyframes il-despega { 0%, 25% { transform: translateY(0); opacity: 1; } 85% { opacity: 1; } 100% { transform: translateY(-190px); opacity: 0; } }
          @keyframes il-llama { from { transform: scaleY(.6); } to { transform: scaleY(1.35); } }
          @keyframes il-humo { 0%, 25% { opacity: 0; transform: scale(.3); } 40% { opacity: .7; } 100% { opacity: 0; transform: scale(2.2); } }
          @keyframes il-boton { 0% { fill: #ef4444; } 100% { fill: #7f1d1d; } }
          @keyframes il-brazo { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-8deg); } }
          @keyframes il-respira { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-1.5px); } }
          @keyframes il-chispa { from { opacity: .2; } to { opacity: 1; } }
          @media (prefers-reduced-motion: reduce) {
            .il-burbuja, .il-cohete, .il-llama, .il-humo, .il-boton, .il-brazo, .il-cuerpo, .il-chispa { animation: none; }
          }
        `}</style>

        {/* suelo y mesa del laboratorio */}
        <line x1="10" y1="161" x2="350" y2="161" stroke="currentColor" strokeWidth="2" opacity="0.35" />
        <rect x="150" y="128" width="110" height="6" rx="2" fill="#8b6b4a" />
        <rect x="156" y="134" width="5" height="27" fill="#6b4f35" />
        <rect x="249" y="134" width="5" height="27" fill="#6b4f35" />

        {/* matraz Erlenmeyer con líquido que burbujea */}
        <path d="M176 100 h10 v8 l12 18 q2 3 -2 3 h-30 q-4 0 -2 -3 l12 -18 z" fill="#ffffff55" stroke={C.CONTORNO} strokeWidth="1.1" />
        <path d="M168 120 h30 l4 6 q1 2 -2 2 h-34 q-3 0 -2 -2 z" fill="#22c55e" opacity="0.85" />
        {[0, 0.5, 1.0].map((d, i) => (
          <circle key={i} className="il-burbuja" cx={178 + i * 4} cy={118} r={1.6 + (i % 2)} fill="#bbf7d0" style={{ animationDelay: `${d}s` }} />
        ))}
        {/* tubos de ensayo */}
        <rect x="208" y="112" width="34" height="4" rx="1" fill="#94a3b8" />
        {[
          ['#3b82f6', 212],
          ['#e11d48', 221],
          ['#eab308', 230],
        ].map(([color, x]) => (
          <g key={x as number}>
            <rect x={x as number} y="98" width="5" height="18" rx="2.5" fill="#ffffff66" stroke={C.CONTORNO} strokeWidth="0.8" />
            <rect x={(x as number) + 0.8} y="106" width="3.4" height="9.4" rx="1.7" fill={color as string} />
          </g>
        ))}

        {/* plataforma de lanzamiento y cohetes */}
        <rect x="282" y="152" width="56" height="9" rx="2" fill="#475569" />
        <g className="il-humo" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}><circle cx="296" cy="155" r="7" fill="#cbd5e1" /></g>
        <g className="il-humo" style={{ transformBox: 'fill-box', transformOrigin: 'center', animationDelay: '0.8s' }}><circle cx="310" cy="155" r="7" fill="#cbd5e1" /></g>
        <g className="il-humo" style={{ transformBox: 'fill-box', transformOrigin: 'center', animationDelay: '1.6s' }}><circle cx="324" cy="155" r="7" fill="#cbd5e1" /></g>
        <Cohete x={296} retraso={0} color="#ef4444" />
        <Cohete x={310} retraso={0.8} color="#2563eb" />
        <Cohete x={324} retraso={1.6} color="#16a34a" />
        {/* estrellitas */}
        {[[300, 30], [330, 54], [270, 44], [345, 20]].map(([x, y], i) => (
          <path key={i} className="il-chispa" d={`M${x} ${y - 4} L${x + 1.2} ${y - 1.2} L${x + 4} ${y} L${x + 1.2} ${y + 1.2} L${x} ${y + 4} L${x - 1.2} ${y + 1.2} L${x - 4} ${y} L${x - 1.2} ${y - 1.2} Z`}
            fill="#facc15" style={{ animationDelay: `${i * 0.3}s` }} />
        ))}

        {/* el profesor, de pie, con el control de lanzamiento en alto */}
        <g transform="translate(-170 21)">
          <g className="il-cuerpo">
            {/* piernas */}
            <line x1="268" y1="108" x2="265" y2="137" stroke={C.CONTORNO} strokeWidth="10.5" strokeLinecap="round" />
            <line x1="268" y1="108" x2="265" y2="137" stroke={C.PANTALON_LEJOS} strokeWidth="8.2" strokeLinecap="round" />
            <line x1="273" y1="108" x2="276" y2="137" stroke={C.CONTORNO} strokeWidth="10.5" strokeLinecap="round" />
            <line x1="273" y1="108" x2="276" y2="137" stroke={C.PANTALON} strokeWidth="8.2" strokeLinecap="round" />
            <path d="M259 137.5 h9 q4 0 4 2.5 h-14 z" fill={C.ZAPATO} stroke={C.CONTORNO} strokeWidth="0.8" />
            <path d="M272 137.5 h9 q5 0 5 2.5 h-15 z" fill={C.ZAPATO} stroke={C.CONTORNO} strokeWidth="0.8" />
            {/* brazo lejano: sujeta un matraz pequeño */}
            <line x1="266" y1="84" x2="258" y2="104" stroke={C.CONTORNO} strokeWidth="9" strokeLinecap="round" />
            <line x1="266" y1="84" x2="258" y2="104" stroke={C.BATA_SOMBRA} strokeWidth="7" strokeLinecap="round" />
            <circle cx="257" cy="107" r="3.6" fill={C.PIEL} stroke={C.CONTORNO} strokeWidth="0.8" />
            <path d="M255 100 h4 v4 l3 6 q1 2 -1 2 h-8 q-2 0 -1 -2 l3 -6 z" fill="#a855f7" opacity="0.8" stroke={C.CONTORNO} strokeWidth="0.6" />
            <Torso />
            <Cabeza />
            {/* brazo cercano en alto con el control de lanzamiento */}
            <g className="il-brazo">
              <line x1="272" y1="84" x2="286" y2="71" stroke={C.CONTORNO} strokeWidth="9" strokeLinecap="round" />
              <line x1="272" y1="84" x2="286" y2="71" stroke={C.BATA} strokeWidth="7" strokeLinecap="round" />
              <line x1="286" y1="71" x2="292" y2="56" stroke={C.CONTORNO} strokeWidth="8.4" strokeLinecap="round" />
              <line x1="286" y1="71" x2="292" y2="56" stroke={C.BATA} strokeWidth="6.4" strokeLinecap="round" />
              <rect x="288" y="44" width="9" height="11" rx="2" fill="#334155" stroke={C.CONTORNO} strokeWidth="0.8" />
              <circle className="il-boton" cx="292.5" cy="48" r="2" fill="#ef4444" />
              <line x1="295" y1="44" x2="298" y2="38" stroke="#334155" strokeWidth="1" />
              <circle cx="293" cy="56" r="3.7" fill={C.PIEL} stroke={C.CONTORNO} strokeWidth="0.8" />
            </g>
          </g>
        </g>

        {/* globo */}
        <g>
          <path d="M126 10 h80 a7 7 0 0 1 7 7 v14 a7 7 0 0 1 -7 7 h-60 l-14 9 l4 -9 h-10 a7 7 0 0 1 -7 -7 v-14 a7 7 0 0 1 7 -7 z" fill="#fff" stroke="#9ca3af" strokeWidth="1" />
          <text x="166" y="22" fontSize="9" textAnchor="middle" fill="#1f2937" fontWeight="700">¡3, 2, 1…</text>
          <text x="166" y="33" fontSize="9" textAnchor="middle" fill="#1f2937" fontWeight="700">despegue!</text>
        </g>
      </svg>
      <h1 className="mt-2 text-center font-serif text-2xl font-semibold text-primario-950 dark:text-white">¡Bienvenido{nombre ? `, ${nombre}` : ''}!</h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Preparando el laboratorio…</p>
      <button className="btn-primario mt-4" onClick={() => setSaliendo(true)}>Entrar al aula</button>
    </div>
  );
}
