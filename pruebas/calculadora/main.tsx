/**
 * Arnés de integración de la calculadora en un navegador real. Monta un examen simulado con los componentes REALES
 * (CalculadoraProvider, BotonCalculadora, CalculadoraPanel y useVigilanciaSalida, el hook que bloquea al salir) y
 * ejecuta un guion: responder, abrir la calculadora, operar con botones y teclado, cambiar DEG/RAD, arrastrar,
 * cambiar de pregunta y volver, cerrar y reabrir, y por último simular un cambio de pestaña.
 * fetch está interceptado: se cuenta cada aviso de salida (rpc/exam_salida) que se enviaría al servidor.
 * El resultado queda en <pre id="resultados"> (JSON) para leerlo con Chrome sin pantalla (--dump-dom).
 */
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { BotonCalculadora, CalculadoraProvider } from '../../src/components/Calculadora';
import { useVigilanciaSalida } from '../../src/components/IntegridadExamen';

const avisos: { motivo: string }[] = [];
const fetchReal = window.fetch.bind(window);
window.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
  if (String(url).includes('/rpc/exam_salida')) {
    avisos.push(JSON.parse(String(init?.body ?? '{}')).p_motivo ? { motivo: JSON.parse(String(init?.body)).p_motivo } : { motivo: '?' });
    return new Response('null', { status: 200 });
  }
  if (String(url).includes('/rest/v1/') || String(url).includes('/functions/v1/')) return new Response('null', { status: 200 });
  return fetchReal(url, init);
}) as typeof fetch;

// eventos de salida que el navegador entrega a la vigilancia, contados aparte
const senales = { blurVentana: 0, visibilidad: 0, pagehide: 0 };
window.addEventListener('blur', () => senales.blurVentana++);
document.addEventListener('visibilitychange', () => senales.visibilidad++);
window.addEventListener('pagehide', () => senales.pagehide++);

const PREGUNTAS = ['¿Rapidez máxima del oscilador?', '¿Trabajo neto?', '¿Velocidad después del choque?'];
const respuestas = new Map<number, string>();
let segundos = 0;

function ExamenSimulado() {
  const [activa, setActiva] = useState(0);
  const [, refrescar] = useState(0);
  const [texto, setTexto] = useState('');
  useVigilanciaSalida('intento-de-prueba', true);
  useEffect(() => { const t = setInterval(() => { segundos++; refrescar((x) => x + 1); }, 1000); return () => clearInterval(t); }, []);
  useEffect(() => { setTexto(respuestas.get(activa) ?? ''); }, [activa]);
  return (
    <div className="mx-auto max-w-3xl p-3">
      <div className="sticky top-0 z-30 mb-3 flex flex-wrap items-center gap-2 border-b bg-white/95 px-3 py-2">
        <span id="reloj" className="tabular-nums">⏱ {segundos}</span>
        <span className="flex-1" />
        <BotonCalculadora />
      </div>
      <div className="mb-3 flex gap-2">
        {PREGUNTAS.map((_, i) => <button key={i} id={`ir-${i}`} className="btn-secundario" onClick={() => setActiva(i)}>{i + 1}</button>)}
      </div>
      <div className="tarjeta">
        <p id="enunciado">{PREGUNTAS[activa]}</p>
        <input id="respuesta" className="campo" value={texto} onChange={(e) => { setTexto(e.target.value); respuestas.set(activa, e.target.value); }} />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><CalculadoraProvider permitida><ExamenSimulado /></CalculadoraProvider></StrictMode>,
);

// ---------------------------------------------------------------------------------------------------------------
const pasos: { paso: string; ok: boolean; detalle?: string }[] = [];
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s);
const panel = () => $('[data-calculadora]');
const visible = () => !!panel() && !panel()!.hidden;
const resultado = () => panel()?.querySelector('[aria-live]')?.textContent?.trim() ?? '';
const tecla = (etiqueta: string) => {
  const b = [...(panel()?.querySelectorAll('button') ?? [])].find((x) => x.getAttribute('aria-label') === etiqueta);
  if (!b) throw new Error(`No existe la tecla ${etiqueta}`);
  b.click();
};
const botonAbrir = () => [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('🧮 Calculadora') && !b.closest('[data-calculadora]'))!;
const escribir = (el: HTMLInputElement, v: string) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
const teclear = (k: string) => panel()!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
const registrar = (paso: string, ok: boolean, detalle?: string) => pasos.push({ paso, ok, detalle });

async function guion() {
  await espera(800);
  const movil = new URLSearchParams(location.search).has('movil');
  const reloj0 = segundos;

  escribir($<HTMLInputElement>('#respuesta')!, '1.6 m/s');
  await espera(50);
  registrar('1. Examen abierto y respuesta escrita en la pregunta 1', respuestas.get(0) === '1.6 m/s');

  botonAbrir().click();
  await espera(300);
  registrar('2. Abrir la calculadora (carga diferida)', visible());

  for (const t of ['2', '+', '3', '×', '4', '=']) tecla(t);
  await espera(50);
  registrar('3a. Operación con botones: 2+3×4', resultado() === '= 14', resultado());

  tecla('Limpiar');
  for (const k of ['(', '2', '+', '3', ')', '*', '4', 'Enter']) teclear(k);
  await espera(50);
  registrar('3b. Operación con teclado físico: (2+3)*4', resultado() === '= 20', resultado());

  const modo = [...panel()!.querySelectorAll('button')].find((b) => b.getAttribute('aria-label')?.startsWith('Unidad de ángulo'))!;
  modo.click();
  await espera(30);
  tecla('Limpiar');
  for (const t of ['cos', 'π', ')', '=']) tecla(t);
  await espera(50);
  registrar('3c. Cambiar a RAD y calcular cos(π)', modo.textContent === 'RAD' && resultado() === '= -1', `${modo.textContent} ${resultado()}`);
  modo.click();

  if (!movil) {
    const cabecera = panel()!.firstElementChild as HTMLElement;
    const r0 = panel()!.getBoundingClientRect();
    const op = { bubbles: true, pointerId: 1, isPrimary: true, pointerType: 'mouse' } as PointerEventInit;
    cabecera.dispatchEvent(new PointerEvent('pointerdown', { ...op, clientX: r0.left + 30, clientY: r0.top + 10 }));
    cabecera.dispatchEvent(new PointerEvent('pointermove', { ...op, clientX: r0.left - 200, clientY: r0.top - 150 }));
    cabecera.dispatchEvent(new PointerEvent('pointerup', { ...op, clientX: r0.left - 200, clientY: r0.top - 150 }));
    await espera(50);
    const r1 = panel()!.getBoundingClientRect();
    registrar('3d. Arrastrar el panel', Math.abs(r1.left - (r0.left - 230)) < 2 && r1.top >= 8, `${Math.round(r0.left)},${Math.round(r0.top)} → ${Math.round(r1.left)},${Math.round(r1.top)}`);
  }

  $<HTMLButtonElement>('#ir-1')!.click();
  await espera(50);
  const enP2 = $('#enunciado')!.textContent === PREGUNTAS[1];
  $<HTMLButtonElement>('#ir-0')!.click();
  await espera(50);
  registrar('4-5. Cambiar de pregunta y regresar: la respuesta se conserva', enP2 && $<HTMLInputElement>('#respuesta')!.value === '1.6 m/s');
  registrar('4-5. …y la calculadora sigue abierta con su resultado', visible() && resultado() === '= -1', resultado());

  panel()!.querySelector<HTMLButtonElement>('button[aria-label="Cerrar la calculadora"]')!.click();
  await espera(50);
  registrar('6. Cerrar la calculadora', !visible());
  botonAbrir().click();
  await espera(50);
  const hist = panel()!.querySelectorAll('ul li').length;
  registrar('7. Reabrir: conserva resultado, ANS e historial', visible() && resultado() === '= -1' && hist === 3, `${resultado()} · historial ${hist}`);

  teclear('Escape');
  await espera(50);
  registrar('7b. Escape cierra la calculadora', !visible());

  registrar('8. La respuesta guardada no cambió', respuestas.get(0) === '1.6 m/s' && respuestas.size === 1);
  registrar('Reloj: siguió corriendo durante el uso', segundos > reloj0, `${reloj0} → ${segundos} s`);
  registrar('Sin señales de salida durante el uso de la calculadora', senales.blurVentana === 0 && senales.visibilidad === 0 && senales.pagehide === 0, JSON.stringify(senales));
  registrar('Sin avisos de salida enviados al servidor durante el uso', avisos.length === 0, JSON.stringify(avisos));

  if (movil) {
    botonAbrir().click();
    await espera(50);
    const r = panel()!.getBoundingClientRect();
    registrar('Pantalla pequeña: el panel cabe en el ancho', r.left >= 0 && r.right <= window.innerWidth + 0.5, `${Math.round(r.left)}–${Math.round(r.right)} de ${window.innerWidth}`);
    registrar('Pantalla pequeña: sin desplazamiento horizontal', document.documentElement.scrollWidth <= window.innerWidth, `${document.documentElement.scrollWidth} ≤ ${window.innerWidth}`);
    registrar('Pantalla pequeña: alto limitado (el enunciado sigue visible)', r.height <= window.innerHeight * 0.63, `${Math.round(r.height)} de ${window.innerHeight}`);
    tecla('Limpiar');
    for (const t of ['√', '1', '4', '4', ')', '=']) tecla(t);
    await espera(50);
    registrar('Pantalla pequeña: √(144) con botones táctiles', resultado() === '= 12', resultado());
    teclear('Escape');
    await espera(50);
  }

  // 9-10. cambio real de pestaña (simulado: la página pasa a «oculta») → la vigilancia debe avisar como siempre
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
  await espera(100);
  registrar('9-10. Cambio de pestaña: la vigilancia avisa al servidor (bloqueo)', avisos.length === 1 && avisos[0].motivo === 'oculta', JSON.stringify(avisos));

  const el = $('#resultados')!;
  el.textContent = JSON.stringify({ movil, ok: pasos.every((p) => p.ok), pasos }, null, 1);
  el.setAttribute('data-estado', 'listo');
}

guion().catch((e) => {
  const el = $('#resultados')!;
  el.textContent = JSON.stringify({ ok: false, error: String(e), pasos }, null, 1);
  el.setAttribute('data-estado', 'error');
});
