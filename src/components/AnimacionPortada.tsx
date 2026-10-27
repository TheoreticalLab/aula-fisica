/**
 * Animación de la portada: el profesor, caricaturizado como científico (bata blanca, camisa, corbata granate,
 * pantalón azul marino, barba y cabello corto), huye corriendo de una onda electromagnética que lo persigue
 * (campos eléctrico y magnético perpendiculares, viajando juntos).
 *
 * Vista de TRES CUARTOS coherente, como en la caricatura de referencia: el torso y la cara miran hacia la dirección de
 * la carrera (abertura de la bata, corbata, ojos y nariz desplazados hacia el frente; oreja y nuca hacia atrás), y
 * brazos y piernas oscilan adelante-atrás en ese mismo plano. El brazo y la pierna del lado lejano se dibujan detrás
 * del cuerpo y en contrafase con los del lado cercano; cada brazo va al revés que la pierna de su lado.
 *
 * Ciclo de zancada (0.45 s): la pierna cercana va adelante en 0 %, apoya bajo el cuerpo en 25 %, empuja atrás en 50 % y
 * se recoge (talón arriba) en 75 %. El cuerpo está más bajo en el apoyo (25 % y 75 %) y más alto en la fase de vuelo.
 * La cabeza no gira ni se deforma: solo acompaña el bote. El faldón de la bata y la corbata ondean hacia atrás.
 *
 * SVG + CSS puro: ligero, nítido a cualquier tamaño y respetuoso con «reducir movimiento» (pose fija de carrera).
 * La versión anterior (científico despeinado) se conserva en AnimacionPortadaEinstein.tsx.
 */
import type { CSSProperties } from 'react';

const ONDA_E = Array.from({ length: 81 }, (_, i) => {
  const x = i * 5;
  return `${i ? 'L' : 'M'}${x},${(95 - 24 * Math.sin((x / 40) * 2 * Math.PI)).toFixed(2)}`;
}).join(' ');
const ONDA_B = Array.from({ length: 81 }, (_, i) => {
  const x = i * 5;
  // el campo magnético, perpendicular: se dibuja «en perspectiva» como una sinusoide más baja
  return `${i ? 'L' : 'M'}${x},${(95 + 9 * Math.sin((x / 40) * 2 * Math.PI)).toFixed(2)}`;
}).join(' ');

// colores tomados de la caricatura de referencia
const PIEL = '#bd7a4a';
const PIEL_SOMBRA = '#9c5d34';
const CONTORNO = '#1b2240';
const PELO = '#1d1815';
const BARBA = '#261d18';
const BATA = '#ffffff';
const BATA_SOMBRA = '#d9e1ee';
const CAMISA = '#f6f8fb';
const CORBATA = '#7a1f35';
const PUNTOS = '#e3a9b7';
const PANTALON = '#27305a';
const PANTALON_LEJOS = '#1d2447';
const ZAPATO = '#141414';
/** Colores del personaje, para reutilizarlo en otras escenas (bienvenida del laboratorio). */
export const COLORES = { PIEL, PIEL_SOMBRA, CONTORNO, BATA, BATA_SOMBRA, PANTALON, PANTALON_LEJOS, ZAPATO };

// medio ciclo de zancada: brazo y pierna del lado lejano van en contrafase
const CONTRAFASE: CSSProperties = { animationDelay: '-0.225s' };

function Pierna({ lejos = false }: { lejos?: boolean }) {
  const color = lejos ? PANTALON_LEJOS : PANTALON;
  const fase = lejos ? CONTRAFASE : undefined;
  return (
    <g className={lejos ? 'ap-muslo ap-lejos' : 'ap-muslo'} style={fase}>
      <line x1={270} y1={108} x2={270} y2={123} stroke={CONTORNO} strokeWidth={11} strokeLinecap="round" />
      <line x1={270} y1={108} x2={270} y2={123} stroke={color} strokeWidth={8.6} strokeLinecap="round" />
      <g className={lejos ? 'ap-rodilla ap-lejos' : 'ap-rodilla'} style={fase}>
        <line x1={270} y1={123} x2={270} y2={135} stroke={CONTORNO} strokeWidth={10} strokeLinecap="round" />
        <line x1={270} y1={123} x2={270} y2={135} stroke={color} strokeWidth={7.8} strokeLinecap="round" />
        {/* zapato apuntando hacia la dirección de la carrera */}
        <path
          d="M265 135.5 q0 -2.5 3 -2.5 h5 q2.5 0 4.5 1.8 l4.5 1.6 q2 0.8 1.6 3.1 h-17.2 q-1.4 0 -1.4 -1.4 z"
          fill={ZAPATO}
          stroke={CONTORNO}
          strokeWidth={0.8}
        />
      </g>
    </g>
  );
}

// Hombros en profundidad: el lejano queda detrás del torso; el cercano, sobre el centro del torso (vista 3/4).
function Brazo({ lejos = false }: { lejos?: boolean }) {
  const x = lejos ? 266 : 272;
  const manga = lejos ? BATA_SOMBRA : BATA;
  return (
    <g className={lejos ? 'ap-brazo ap-lejos' : 'ap-brazo'} style={{ transformOrigin: `${x}px 84px`, ...(lejos ? CONTRAFASE : {}) }}>
      <line x1={x} y1={84} x2={x} y2={96} stroke={CONTORNO} strokeWidth={9} strokeLinecap="round" />
      <line x1={x} y1={84} x2={x} y2={96} stroke={manga} strokeWidth={7} strokeLinecap="round" />
      {/* antebrazo doblado hacia adelante, como al correr */}
      <g transform={`rotate(-85 ${x} 96)`}>
        <line x1={x} y1={96} x2={x} y2={106} stroke={CONTORNO} strokeWidth={8.4} strokeLinecap="round" />
        <line x1={x} y1={96} x2={x} y2={106} stroke={manga} strokeWidth={6.4} strokeLinecap="round" />
        <circle cx={x} cy={108.6} r={3.7} fill={PIEL} stroke={CONTORNO} strokeWidth={0.8} />
        <path d={`M${x - 2.2} 107.6 h4.4 M${x - 2.2} 109.4 h4.4`} stroke={PIEL_SOMBRA} strokeWidth={0.5} />
      </g>
    </g>
  );
}

// Cabeza en 3/4 hacia la derecha: nuca y oreja atrás, rasgos hacia el frente, el ojo lejano más estrecho.
export function Cabeza() {
  return (
    <g>
      <path
        d="M257.5 50 Q257 37 271 36.5 Q286 37 285.8 51 Q286.2 64 280 70 Q273 75 266 71 Q258.5 65 257.5 50 Z"
        fill={PIEL}
        stroke={CONTORNO}
        strokeWidth={1.1}
      />
      {/* cabello corto: cubre la nuca, línea recta en la frente, patilla delante de la oreja */}
      <path
        d="M257.6 57 Q255.2 38 271 36.3 Q286.6 37 285.9 49 Q284.9 45 283 43.8 Q279 41.9 274 42.3 Q268.2 43 265.8 46 Q264.8 50 265 54 Q262 51 258.8 53 Z"
        fill={PELO}
      />
      <path d="M257.8 56.6 Q257.2 50 259.2 46 L262.6 51.2 Q260.2 52 258.8 53 Z" fill="#4a3f38" opacity={0.6} />
      {/* oreja, hacia atrás */}
      <ellipse cx={262.3} cy={56.5} rx={3} ry={4.4} fill={PIEL} stroke={CONTORNO} strokeWidth={0.9} />
      <path d="M261.7 54.2 q1.5 2.3 0 4.6" fill="none" stroke={PIEL_SOMBRA} strokeWidth={0.8} />
      <path d="M265.6 55 Q266.2 62.5 269 68 L267.6 58.5 Z" fill={PIEL_SOMBRA} opacity={0.35} />
      {/* barba completa: patilla, mandíbula y mentón */}
      <path
        d="M265 53.4 Q263.8 63 268.2 70 Q273.6 75.6 280.2 71.6 Q285.6 66 285.8 54.5 Q284.8 60.4 283.2 63 Q279.7 61.5 276.7 61.8 Q272.2 61.8 269.7 64.4 Q266.8 60 266.8 53.4 Z"
        fill={BARBA}
      />
      {/* bigote y sonrisa, desplazados hacia el frente */}
      <path d="M271.8 63.6 Q277.6 60 284.2 62.8 Q277.8 62.1 271.8 63.6 Z" fill={PELO} stroke={PELO} strokeWidth={0.9} />
      <path d="M273.4 65.4 Q278.6 68.7 283.2 65 Q278.4 66.6 273.4 65.4 Z" fill="#b5654a" />
      {/* cejas y ojos (el lejano, más estrecho por la perspectiva) */}
      <path d="M269.6 48.6 Q273.3 46.6 276.9 48.2 M280.1 48.2 Q283.1 46.8 285.3 48.5" fill="none" stroke={PELO} strokeWidth={1.9} strokeLinecap="round" />
      <ellipse cx={273.5} cy={53.2} rx={2.8} ry={2.1} fill="#fff" stroke={CONTORNO} strokeWidth={0.6} />
      <ellipse cx={282.6} cy={53.2} rx={2.1} ry={2} fill="#fff" stroke={CONTORNO} strokeWidth={0.6} />
      <circle cx={274.2} cy={53.4} r={1.55} fill="#3a2214" />
      <circle cx={283.1} cy={53.4} r={1.4} fill="#3a2214" />
      <circle cx={274.7} cy={52.8} r={0.45} fill="#fff" />
      <circle cx={283.5} cy={52.8} r={0.4} fill="#fff" />
      <path d="M270.6 52.6 Q273.5 50.6 276.4 52.4 M280.6 52.4 Q282.7 50.8 284.8 52.6" fill="none" stroke={CONTORNO} strokeWidth={0.9} strokeLinecap="round" />
      {/* nariz ancha, que asoma hacia el frente */}
      <path d="M279.6 54 Q280.6 57.4 284 58.6 Q283.8 60.6 281.2 60.4 Q279.6 60.9 278 60.1 Q276.8 59.3 278 58.3" fill="none" stroke={PIEL_SOMBRA} strokeWidth={1} strokeLinecap="round" />
      <ellipse cx={279.3} cy={59.9} rx={0.75} ry={0.45} fill="#7a4425" />
    </g>
  );
}

// Torso en 3/4: espalda redondeada a la izquierda, pecho a la derecha; la abertura de la bata y la corbata, al frente.
export function Torso() {
  return (
    <g>
      <rect x={270} y={68} width={8.5} height={12} rx={3} fill={PIEL_SOMBRA} />
      <path
        d="M263 78 Q270 75 277 78 Q283 81 283.6 88 L285 121 Q270 124.6 255 122 L257.5 92 Q258 82 263 78 Z"
        fill={BATA}
        stroke={CONTORNO}
        strokeWidth={1.1}
      />
      <path d="M263 78 Q258 82 257.5 92 L255 122 L259.6 122.6 L261.2 90 Q261.6 82 265 79 Z" fill={BATA_SOMBRA} />
      {/* abertura al frente: camisa, cinturón y pantalón */}
      <path d="M275 78.6 L281.9 82.4 L283.5 106 L276 106 Z" fill={CAMISA} />
      <path d="M276 106 L283.5 106 L284.4 121.4 L276.6 121.8 Z" fill={PANTALON} />
      <rect x={275.9} y={104.4} width={7.8} height={3} fill="#111827" />
      <rect x={278.6} y={104.8} width={3.2} height={2.2} fill="none" stroke="#b8c0cc" strokeWidth={0.7} />
      <path d="M275 78.6 L276.4 121.9 M282 83 L284.5 121.4" stroke={CONTORNO} strokeWidth={0.9} fill="none" />
      <path d="M275 78.6 L277.6 89 L275.7 96" fill="none" stroke={CONTORNO} strokeWidth={0.8} />
      <path d="M264.5 107 h6 v5.4 h-6" fill="none" stroke="#9aa6bd" strokeWidth={0.8} />
      {/* cuello de la camisa y corbata granate (ondea hacia atrás) */}
      <path d="M275.4 78.2 L278.8 81.2 L276.8 83.6 Z M282 79.6 L278.8 81.2 L280.6 83.6 Z" fill={CAMISA} stroke={CONTORNO} strokeWidth={0.6} />
      <g className="ap-corbata">
        <path d="M277.2 79.4 h3.4 l-0.5 2.9 h-2.4 z" fill={CORBATA} stroke={CONTORNO} strokeWidth={0.6} />
        <path d="M277.7 82.3 h2.4 l1.6 15.6 l-2.8 2.9 l-2.8 -2.9 z" fill={CORBATA} stroke={CONTORNO} strokeWidth={0.6} />
        {[
          [278.9, 85.8],
          [279.6, 89.6],
          [278.3, 93],
          [279.8, 96.2],
          [278.8, 98.8],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={0.5} fill={PUNTOS} />
        ))}
      </g>
    </g>
  );
}

export function AnimacionPortada({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 160" className={className} role="img" aria-label="Un científico con bata blanca huye corriendo de una onda electromagnética">
      <style>{`
        .ap-onda { animation: ap-viaja 0.9s linear infinite; }
        .ap-avance { animation: ap-avanza 3.2s ease-in-out infinite; }
        /* ciclo de zancada 0.45 s. El muslo gira a ritmo constante (linear) para que el pie apoyado retroceda a
           ~110-140 u/s, la misma velocidad que el suelo (24 u cada 0.21 s = 114 u/s): así el pie no «patina». */
        .ap-suelo { animation: ap-suelo 0.21s linear infinite; }
        .ap-chispa { animation: ap-chispa 0.6s ease-in-out infinite alternate; }
        .ap-linea { animation: ap-linea 0.3s linear infinite; }
        .ap-cuerpo { animation: ap-bota 0.45s ease-in-out infinite; }
        .ap-muslo { transform-box: view-box; transform-origin: 270px 108px; animation: ap-muslo 0.45s linear infinite; }
        .ap-rodilla { transform-box: view-box; transform-origin: 270px 123px; animation: ap-rodilla 0.45s linear infinite; }
        .ap-brazo { transform-box: view-box; animation: ap-brazo 0.45s ease-in-out infinite; }
        .ap-faldon { transform-box: view-box; transform-origin: 259px 98px; animation: ap-faldon 0.45s ease-in-out infinite; }
        .ap-corbata { transform-box: view-box; transform-origin: 278.9px 81px; animation: ap-corbata 0.45s ease-in-out infinite; }
        .ap-gota { animation: ap-gota 0.9s ease-in infinite; }
        @keyframes ap-viaja { from { transform: translateX(-40px); } to { transform: translateX(0); } }
        @keyframes ap-avanza { 0%,100% { transform: translateX(0); } 50% { transform: translateX(14px); } }
        @keyframes ap-suelo { from { transform: translateX(0); } to { transform: translateX(-24px); } }
        @keyframes ap-chispa { from { opacity: .25; transform: scale(.7); } to { opacity: 1; transform: scale(1.15); } }
        @keyframes ap-linea { from { transform: translateX(10px); opacity: .9; } to { transform: translateX(-16px); opacity: 0; } }
        @keyframes ap-bota { 0%,50%,100% { transform: translateY(-3px); } 25%,75% { transform: translateY(0); } }
        @keyframes ap-muslo { 0%,100% { transform: rotate(-28deg); } 50% { transform: rotate(26deg); } }
        @keyframes ap-rodilla { 0%,100% { transform: rotate(10deg); } 20% { transform: rotate(4deg); } 35% { transform: rotate(6deg); } 50% { transform: rotate(20deg); } 75% { transform: rotate(75deg); } }
        @keyframes ap-brazo { 0%,100% { transform: rotate(35deg); } 50% { transform: rotate(-42deg); } }
        @keyframes ap-faldon { 0%,50%,100% { transform: rotate(-3deg); } 25%,75% { transform: rotate(9deg); } }
        @keyframes ap-corbata { 0%,50%,100% { transform: rotate(8deg); } 25%,75% { transform: rotate(18deg); } }
        @keyframes ap-gota { 0% { transform: translate(0,0); opacity: 0; } 20% { opacity: 1; } 100% { transform: translate(-12px,-9px); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .ap-onda, .ap-avance, .ap-suelo, .ap-chispa, .ap-linea, .ap-cuerpo, .ap-muslo, .ap-rodilla, .ap-brazo,
          .ap-faldon, .ap-corbata, .ap-gota { animation: none; }
          /* sin movimiento: una pose fija de carrera (zancada abierta), no un personaje de pie */
          .ap-muslo { transform: rotate(-30deg); } .ap-muslo.ap-lejos { transform: rotate(28deg); }
          .ap-rodilla { transform: rotate(10deg); } .ap-rodilla.ap-lejos { transform: rotate(55deg); }
          .ap-brazo { transform: rotate(35deg); } .ap-brazo.ap-lejos { transform: rotate(-45deg); }
          .ap-corbata { transform: rotate(10deg); }
          .ap-gota { opacity: 0; }
        }
      `}</style>
      <defs>
        <clipPath id="ap-zona-onda"><rect x="0" y="40" width="200" height="110" /></clipPath>
        <filter id="ap-brillo" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="ap-desvanece" x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id="ap-mascara"><rect x="0" y="40" width="200" height="110" fill="url(#ap-desvanece)" /></mask>
      </defs>

      {/* suelo que corre */}
      <g className="ap-suelo" opacity="0.5">
        {Array.from({ length: 18 }, (_, i) => <line key={i} x1={i * 24} y1={141} x2={i * 24 + 12} y2={141} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />)}
      </g>

      {/* la onda electromagnética que persigue: E (dorado) y B (azul), perpendiculares */}
      <g className="ap-avance">
        <g clipPath="url(#ap-zona-onda)" mask="url(#ap-mascara)">
          <g className="ap-onda" filter="url(#ap-brillo)">
            <path d={ONDA_B} fill="none" stroke="#7aa5e8" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
            <path d={ONDA_E} fill="none" stroke="#e3ad42" strokeWidth="3.5" strokeLinecap="round" />
          </g>
        </g>
        {/* frente de la onda con chispas */}
        <g filter="url(#ap-brillo)">
          <circle className="ap-chispa" cx="203" cy="80" r="3" fill="#ffe08a" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
          <circle className="ap-chispa" cx="198" cy="108" r="2.4" fill="#afc4e8" style={{ transformBox: 'fill-box', transformOrigin: 'center', animationDelay: '.2s' }} />
          <circle className="ap-chispa" cx="208" cy="95" r="2" fill="#ffffff" style={{ transformBox: 'fill-box', transformOrigin: 'center', animationDelay: '.4s' }} />
        </g>
        <text x="22" y="58" fontSize="12" fontStyle="italic" fill="#e3ad42" fontFamily="Georgia, serif">E</text>
        <text x="22" y="120" fontSize="12" fontStyle="italic" fill="#7aa5e8" fontFamily="Georgia, serif">B</text>
        <text x="88" y="152" fontSize="10" fill="currentColor" opacity="0.6" fontFamily="Georgia, serif">c = 3×10⁸ m/s</text>
      </g>

      {/* líneas de velocidad detrás del científico */}
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5">
        <line className="ap-linea" x1="226" y1="78" x2="236" y2="78" />
        <line className="ap-linea" x1="222" y1="96" x2="234" y2="96" style={{ animationDelay: '.15s' }} />
        <line className="ap-linea" x1="228" y1="112" x2="238" y2="112" style={{ animationDelay: '.3s' }} />
      </g>

      {/* el científico, ligeramente inclinado hacia adelante; orden de dibujo = profundidad (lo lejano primero) */}
      <g transform="rotate(4 270 140)">
        <g className="ap-cuerpo">
          <Brazo lejos />
          <Pierna lejos />
          <Pierna />
          <path className="ap-faldon" d="M258.5 96 L246.5 124 Q253 127.5 262 121.5 Z" fill={BATA_SOMBRA} stroke={CONTORNO} strokeWidth={1} />
          <Torso />
          <Cabeza />
          <Brazo />
          {/* gotas de sudor, en la nuca */}
          <path className="ap-gota" d="M254 42 q2 3 0 5 q-2 -2 0 -5 z" fill="#93c5fd" />
          <path className="ap-gota" d="M251.5 50 q2 3 0 5 q-2 -2 0 -5 z" fill="#93c5fd" style={{ animationDelay: '.45s' }} />
        </g>
      </g>

      {/* globo de diálogo */}
      <g>
        <path d="M296 6 h50 a7 7 0 0 1 7 7 v18 a7 7 0 0 1 -7 7 h-34 l-12 10 l3 -10 h-7 a7 7 0 0 1 -7 -7 v-18 a7 7 0 0 1 7 -7 z" fill="#fff" stroke="#9ca3af" strokeWidth="1" />
        <text x="321" y="19" fontSize="10" textAnchor="middle" fill="#1f2937" fontWeight="700">¡Ay, que</text>
        <text x="321" y="31" fontSize="10" textAnchor="middle" fill="#1f2937" fontWeight="700">me alcanza!</text>
      </g>
    </svg>
  );
}
