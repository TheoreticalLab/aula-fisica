/**
 * Animación de la portada: un científico despeinado (caricatura, al estilo de los físicos clásicos) huye corriendo
 * de una onda electromagnética que lo persigue (campo eléctrico y magnético perpendiculares, viajando juntos).
 * SVG + CSS puro: ligero, escalable en el teléfono y respetuoso con «reducir movimiento».
 */
const ONDA_E = Array.from({ length: 81 }, (_, i) => {
  const x = i * 5;
  return `${i ? 'L' : 'M'}${x},${(95 - 24 * Math.sin((x / 40) * 2 * Math.PI)).toFixed(2)}`;
}).join(' ');
const ONDA_B = Array.from({ length: 81 }, (_, i) => {
  const x = i * 5;
  // el campo magnético, perpendicular: se dibuja «en perspectiva» como una sinusoide más baja e inclinada
  return `${i ? 'L' : 'M'}${x},${(95 + 9 * Math.sin((x / 40) * 2 * Math.PI) + 0.0).toFixed(2)}`;
}).join(' ');

export function AnimacionPortada({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 160" className={className} role="img" aria-label="Un científico despeinado huye corriendo de una onda electromagnética">
      <style>{`
        .ap-onda { animation: ap-viaja 0.9s linear infinite; }
        .ap-avance { animation: ap-avanza 3.2s ease-in-out infinite; }
        .ap-cuerpo { animation: ap-bota 0.36s ease-in-out infinite; }
        .ap-pierna-a { transform-box: view-box; transform-origin: 262px 112px; animation: ap-zancada 0.36s ease-in-out infinite; }
        .ap-pierna-b { transform-box: view-box; transform-origin: 262px 112px; animation: ap-zancada 0.36s ease-in-out infinite reverse; }
        .ap-brazo-a { transform-box: view-box; transform-origin: 262px 86px; animation: ap-braceo 0.36s ease-in-out infinite; }
        .ap-brazo-b { transform-box: view-box; transform-origin: 262px 86px; animation: ap-braceo 0.36s ease-in-out infinite reverse; }
        .ap-bata { transform-box: view-box; transform-origin: 256px 88px; animation: ap-ondea 0.3s ease-in-out infinite alternate; }
        .ap-gota { animation: ap-gota 0.9s ease-in infinite; }
        .ap-suelo { animation: ap-suelo 0.5s linear infinite; }
        .ap-chispa { animation: ap-chispa 0.6s ease-in-out infinite alternate; }
        .ap-linea { animation: ap-linea 0.5s linear infinite; }
        @keyframes ap-viaja { from { transform: translateX(-40px); } to { transform: translateX(0); } }
        @keyframes ap-avanza { 0%,100% { transform: translateX(0); } 50% { transform: translateX(14px); } }
        @keyframes ap-bota { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes ap-zancada { 0% { transform: rotate(34deg); } 50% { transform: rotate(-34deg); } 100% { transform: rotate(34deg); } }
        @keyframes ap-braceo { 0% { transform: rotate(-50deg); } 50% { transform: rotate(40deg); } 100% { transform: rotate(-50deg); } }
        @keyframes ap-ondea { from { transform: skewX(-6deg); } to { transform: skewX(8deg); } }
        @keyframes ap-gota { 0% { transform: translate(0,0); opacity: 0; } 20% { opacity: 1; } 100% { transform: translate(14px,-10px); opacity: 0; } }
        @keyframes ap-suelo { from { transform: translateX(0); } to { transform: translateX(-24px); } }
        @keyframes ap-chispa { from { opacity: .25; transform: scale(.7); } to { opacity: 1; transform: scale(1.15); } }
        @keyframes ap-linea { from { transform: translateX(10px); opacity: .9; } to { transform: translateX(-16px); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .ap-onda, .ap-avance, .ap-cuerpo, .ap-pierna-a, .ap-pierna-b, .ap-brazo-a, .ap-brazo-b, .ap-bata, .ap-gota, .ap-suelo, .ap-chispa, .ap-linea { animation: none; }
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

      {/* el científico */}
      <g className="ap-cuerpo">
        {/* pierna trasera */}
        <g className="ap-pierna-b">
          <line x1="262" y1="112" x2="262" y2="136" stroke="#3b3b3b" strokeWidth="5" strokeLinecap="round" />
          <ellipse cx="266" cy="138" rx="7" ry="3.5" fill="#1f1f1f" />
        </g>
        {/* brazo trasero */}
        <g className="ap-brazo-b">
          <line x1="262" y1="86" x2="262" y2="106" stroke="#e9e9e9" strokeWidth="5" strokeLinecap="round" />
          <circle cx="262" cy="108" r="3" fill="#f2c9a0" />
        </g>
        {/* bata de laboratorio */}
        <g className="ap-bata">
          <path d="M250 82 Q262 76 274 82 L276 116 L244 118 Z" fill="#f7f7f7" stroke="#9ca3af" strokeWidth="1.2" />
          <line x1="262" y1="82" x2="262" y2="116" stroke="#9ca3af" strokeWidth="1" />
          <rect x="266" y="96" width="6" height="5" rx="1" fill="none" stroke="#9ca3af" strokeWidth="1" />
          <line x1="268" y1="94" x2="268" y2="98" stroke="#264886" strokeWidth="1.5" />
        </g>
        {/* pierna delantera */}
        <g className="ap-pierna-a">
          <line x1="262" y1="112" x2="262" y2="136" stroke="#4a4a4a" strokeWidth="5" strokeLinecap="round" />
          <ellipse cx="266" cy="138" rx="7" ry="3.5" fill="#2a2a2a" />
        </g>
        {/* cabeza */}
        <circle cx="266" cy="66" r="13" fill="#f2c9a0" stroke="#c99b74" strokeWidth="1" />
        {/* pelo blanco alborotado, más largo hacia atrás por la carrera */}
        <g fill="#f5f5f5" stroke="#cbd5e1" strokeWidth="1">
          <circle cx="254" cy="58" r="7" />
          <circle cx="248" cy="66" r="6" />
          <circle cx="258" cy="51" r="6.5" />
          <circle cx="268" cy="50" r="6" />
          <circle cx="277" cy="55" r="5" />
          <circle cx="245" cy="57" r="4.5" />
          <circle cx="250" cy="74" r="4.5" />
        </g>
        {/* cejas, ojos asustados mirando hacia atrás, bigote y boca abierta */}
        <path d="M265 60 l6 -2 M272 61 l5 0" stroke="#e5e7eb" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="268" cy="65" r="3.2" fill="#fff" stroke="#374151" strokeWidth=".8" />
        <circle cx="275" cy="65" r="3" fill="#fff" stroke="#374151" strokeWidth=".8" />
        <circle cx="266.8" cy="65.4" r="1.3" fill="#111827" />
        <circle cx="273.8" cy="65.4" r="1.2" fill="#111827" />
        <path d="M268 72 q5 -3 10 0 q-5 3 -10 0 z" fill="#f5f5f5" stroke="#cbd5e1" strokeWidth=".8" />
        <ellipse cx="273" cy="76.5" rx="2.4" ry="2.8" fill="#7f1d1d" />
        {/* brazo delantero */}
        <g className="ap-brazo-a">
          <line x1="262" y1="86" x2="262" y2="106" stroke="#f3f3f3" strokeWidth="5" strokeLinecap="round" />
          <circle cx="262" cy="108" r="3" fill="#f2c9a0" />
        </g>
        {/* gotas de sudor */}
        <path className="ap-gota" d="M282 56 q2 3 0 5 q-2 -2 0 -5 z" fill="#93c5fd" />
        <path className="ap-gota" d="M284 64 q2 3 0 5 q-2 -2 0 -5 z" fill="#93c5fd" style={{ animationDelay: '.45s' }} />
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
