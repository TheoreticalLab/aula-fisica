/** LIEIA · Pestaña «Qué puede y qué no puede inferirse»: hipótesis, datos, modelos y límites. */
import { Card } from '@/components/ui';

const HIPOTESIS: [string, string, string][] = [
  ['Independencia entre estudiantes', 'Sí, como hipótesis nula de cada detector: se rechaza cuando los datos son improbables bajo ella (valor p, corregido con Benjamini–Hochberg).', 'Aceptar la independencia no prueba que nadie colaboró: la potencia es limitada.'],
  ['Colaboración entre parejas', 'Errores idénticos improbables (D1) y respuestas iguales sincronizadas (D3). Juntas, compatibles con intercambio durante el examen.', 'No identifica el mecanismo (hablar, mensajería, mirar). La copia con retardo de minutos borra la huella temporal.'],
  ['Redes de intercambio', 'Grupos conectados en el grafo de parejas con evidencia.', 'Dos receptores de una misma fuente aparecen conectados entre sí (dependencia indirecta).'],
  ['Fuente central de distribución', 'Nodo que responde primero en más conexiones (dirección temporal de D3).', 'Identificación moderada en el laboratorio; una fuente externa al aula no se observa directamente.'],
  ['Asistencia externa o IA', 'Tiempo insensible a la dificultad (D6): tarda lo mismo en todo.', 'Una asistencia que imite los tiempos de un estudiante real no se distingue con telemetría. Aciertos «demasiado buenos» se confunden con alta habilidad.'],
  ['Coincidencias naturales y falsos positivos', 'Controles negativos del laboratorio: examen fácil, mismo ritmo, inicio escalonado, orden aleatorio, misma confusión.', 'D1 no distingue copiar de una causa común (estudiar juntos, mismo material).'],
  ['Conocimiento previo de preguntas concretas (filtración)', 'Con pares isomorfos en el examen: inconsistencia entre gemelas (acierta y responde rápido una, no la otra) más allá del modelo (D8).', 'Sin grupos isomorfos no es identificable. Una filtración que incluya todas las variantes tampoco.'],
  ['Efectos del diseño (orden, fatiga, aprendizaje)', 'Con orden aleatorio o contrabalanceado, el modelo de tiempos separa la posición (fatiga) del ítem; los experimentos de diseño miden qué características aportan o engañan.', 'Con orden fijo, posición e ítem están confundidos (se absorben juntos).'],
  ['Cambios de comportamiento con la dificultad','Modelo de dificultad (Rasch) frente al de tiempos (lognormal): gráfico por ítem y D6 por estudiante.', 'Pocos ítems o pocos estudiantes vuelven inestables las estimaciones.'],
];

export function Metodo() {
  return (
    <div className="space-y-4">
      <Card title="Principios">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li><strong>Correlación ≠ dependencia ≠ causalidad.</strong> Un valor p pequeño dice que los datos son improbables si los estudiantes respondieron de forma independiente <em>según el modelo</em>; no dice quién hizo qué ni por qué.</li>
          <li><strong>Nada automático.</strong> No hay sanciones, clasificaciones de culpabilidad ni avisos a estudiantes. El panel sugiere qué revisar.</li>
          <li><strong>Validación antes de uso.</strong> Cada detector se prueba con datos sintéticos de verdad conocida (controles negativos, positivos y adversariales). Solo los que controlan los falsos positivos se muestran con datos reales; si la probabilidad no está calibrada e informa poco, el panel se abstiene.</li>
          <li><strong>Datos mínimos.</strong> El servidor entrega seudónimos y huellas de las respuestas (no su contenido). Los nombres solo con «Mostrar nombres», que queda registrado. El laboratorio usa solo datos sintéticos.</li>
        </ul>
      </Card>
      <Card title="Hipótesis investigables">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs dark:border-white/10"><th className="py-1">Hipótesis</th><th>Qué puede inferirse</th><th>Qué NO puede inferirse</th></tr></thead>
            <tbody>{HIPOTESIS.map(([h, si, no]) => <tr key={h} className="border-b border-gray-100 align-top dark:border-white/5"><td className="py-1.5 font-medium">{h}</td><td className="pr-3">{si}</td><td>{no}</td></tr>)}</tbody>
          </table>
        </div>
      </Card>
      <Card title="Datos y modelos">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li><strong>Instrumentación:</strong> cada cambio de respuesta durante un intento queda registrado con la hora del servidor (desde la activación de LIEIA). Antes solo existía la última respuesta, sin tiempo por pregunta.</li>
          <li><strong>Habilidad y dificultad:</strong> modelo de Rasch con a priori normales (estimación MAP). El laboratorio genera datos con un modelo de 2 parámetros para medir la robustez ante errores de especificación.</li>
          <li><strong>Tiempos:</strong> modelo lognormal (exigencia de tiempo de cada ítem, velocidad de cada estudiante); los residuos quitan el orden común, la dificultad y el ritmo.</li>
          <li><strong>D1</strong> prueba binomial generalizada exacta (Poisson-binomial) sobre errores idénticos, con la popularidad de cada error estimada sin la pareja. <strong>D2</strong> correlación de residuos con prueba de permutación. <strong>D3</strong> sincronía con nula por bootstrap paramétrico del modelo de tiempos (respeta orden, velocidad e inicio). <strong>D4</strong> l_z, <strong>D5</strong> y <strong>D6</strong> con bootstrap paramétrico. <strong>D7</strong> distancia robusta (descriptiva).</li>
          <li><strong>Comparaciones múltiples:</strong> Benjamini–Hochberg (valores q). <strong>Posterior:</strong> mezcla beta-uniforme sobre los valores p, evaluada con diagramas de fiabilidad y ECE.</li>
          <li><strong>Calibración de preguntas:</strong> TRI de 2 parámetros por máxima verosimilitud marginal (EM con cuadratura), validada por recuperación de parámetros conocidos (cobertura de los intervalos ≈ 95 %). Estados: calibrado, provisional o no calibrado (a priori explícito).</li>
          <li><strong>Diseño del examen:</strong> información del test y su incertidumbre, tiempo esperado y riesgo de no terminar (equidad), equivalencia de versiones, selección óptima con cobertura de conceptos como restricción, y prueba experimental previa con el laboratorio.</li>
          <li><strong>Telemetría del proceso:</strong> en todas las prácticas y evaluaciones se registran (sin teclas ni contenido) la vista de cada pregunta, la primera interacción, las ráfagas de edición (inicio, duración, longitud y una huella de la respuesta), borrados, guardados, comprobaciones, envío, visibilidad, foco, inactividad y conexión, con reloj monotónico por sesión anclado al servidor. P1 (rápidas con envío diferido) está validado; P2 (regularidad) es un indicio de potencia limitada; P3 (apariciones de golpe) es descriptivo. Una espera prolongada nunca se presenta como prueba.</li>
          <li><strong>Supervivencia:</strong> Kaplan–Meier del tiempo hasta completar el examen (censura = entregó con preguntas en blanco).</li>
        </ul>
      </Card>
    </div>
  );
}
