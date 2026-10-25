/** Ilustración de la portada: una trayectoria parabólica con sus componentes de velocidad, como en una pizarra. */
export function IlustracionPortada({ className = '' }: { className?: string }) {
  // parábola y = 4·h·x(1−x) en coordenadas del dibujo
  const puntos = Array.from({ length: 41 }, (_, i) => {
    const x = i / 40;
    return `${30 + x * 300},${190 - 150 * 4 * x * (1 - x)}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 360 230" className={className} role="img" aria-label="Trayectoria de un proyectil con sus componentes de velocidad">
      <defs>
        <pattern id="cuadricula" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
        </pattern>
        <marker id="punta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="#e3ad42" />
        </marker>
        <marker id="punta-clara" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="#afc4e8" />
        </marker>
      </defs>
      <rect width="360" height="230" fill="url(#cuadricula)" />
      {/* ejes */}
      <path d="M30 200V20M20 190H345" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5" />
      <text x="338" y="208" fontSize="12" fill="currentColor" fillOpacity="0.7" fontStyle="italic">x</text>
      <text x="16" y="24" fontSize="12" fill="currentColor" fillOpacity="0.7" fontStyle="italic">y</text>
      {/* trayectoria */}
      <polyline points={puntos} fill="none" stroke="#e3ad42" strokeWidth="2.5" strokeDasharray="6 6" strokeLinecap="round" />
      {/* proyectil en x = 0.28 */}
      <circle cx={30 + 0.28 * 300} cy={190 - 150 * 4 * 0.28 * 0.72} r="7" fill="#fff" />
      <line x1={114} y1={69} x2={164} y2={69} stroke="#afc4e8" strokeWidth="2.5" markerEnd="url(#punta-clara)" />
      {/* componentes coherentes con la pendiente de la curva en ese punto (vy/vx ≈ 0.88) */}
      <line x1={114} y1={69} x2={114} y2={25} stroke="#afc4e8" strokeWidth="2.5" markerEnd="url(#punta-clara)" />
      <line x1={114} y1={69} x2={162} y2={27} stroke="#e3ad42" strokeWidth="2.5" markerEnd="url(#punta)" />
      <text x={168} y={74} fontSize="13" fill="#afc4e8" fontStyle="italic">vₓ</text>
      <text x={96} y={30} fontSize="13" fill="#afc4e8" fontStyle="italic">v</text>
      <text x={104} y={34} fontSize="9" fill="#afc4e8" fontStyle="italic">y</text>
      <text x={166} y={24} fontSize="14" fill="#e3ad42" fontStyle="italic" fontWeight="600">v</text>
      {/* ecuación manuscrita */}
      <text x="180" y="150" textAnchor="middle" fontSize="15" fill="currentColor" fillOpacity="0.85" fontFamily="Georgia, serif" fontStyle="italic">
        y = v₀ sen θ · t − ½ g t²
      </text>
      <text x="180" y="172" textAnchor="middle" fontSize="12" fill="currentColor" fillOpacity="0.55" fontFamily="Georgia, serif">
        g = 9.8 m/s²
      </text>
    </svg>
  );
}
