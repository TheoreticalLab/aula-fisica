/**
 * Orbe IA · mensaje humorístico para el estudiante (montado una vez en el Layout, como el receptor de mensajes).
 *  · Solo en lecciones (nunca en actividades ni intentos), con la pestaña visible, sin otro aviso en pantalla y
 *    cuando el estudiante no está escribiendo. El servidor decide el resto (intervalo, actividad, evaluaciones).
 *  · Tarjeta discreta: no quita el foco, se cierra al instante, se retira sola a los 20 s y cede el sitio a los
 *    avisos del profesor. «No mostrar más» desactiva Orbe IA para el estudiante (reversible en su perfil).
 *  · No envía nada personal: la lección, la subsección y, en la teoría, el encabezado que tiene delante.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { supabaseConfigured } from '@/lib/supabase';
import { contextoDeRuta } from '@/lib/tiempo';
import { hayEmergente, suscribirEmergentes, useEmergente } from '@/lib/emergentes';
import { apartadoVisible, debePreguntar, escribiendoAhora, siguienteIntento, type EventoOrbe } from '@/lib/orbeIa';
import { orbeCerrar, orbeReponer, orbeSiguiente } from '@/api/orbeIa';
import { TarjetaEmergente } from './Emergente';

const ID = 'orbe-ia';
const DURACION_MS = 20_000;
const TICK_MS = 20_000;

/** Encabezados de la teoría visibles en la página (solo el texto y su posición). */
function apartadoDeLaPagina(): string | null {
  const hs = [...document.querySelectorAll<HTMLElement>('main h2, main h3')].map((h) => ({ texto: h.innerText || h.textContent || '', top: h.getBoundingClientRect().top }));
  return apartadoVisible(hs, window.innerHeight);
}

function elementoActivo() {
  const a = document.activeElement as HTMLElement | null;
  if (!a || a === document.body) return null;
  return { tag: a.tagName, tipo: a.getAttribute('type'), editable: a.isContentEditable };
}

export function OrbeIa() {
  const { session, profile } = useAuth();
  const location = useLocation();
  const activo = supabaseConfigured && !!session && profile?.role === 'student' && profile.active !== false;
  const [chiste, setChiste] = useState<{ id: string; texto: string } | null>(null);
  // primera consulta tras un minuto en la página: el servidor exige además la actividad mínima configurada
  const st = useRef({ proximo: Date.now() + 60_000, apagadoHasta: 0, ultimaTecla: 0, ultimaReposicion: 0, evento: null as EventoOrbe | null, pidiendo: false });
  useEmergente(ID, !!chiste);

  const visibleRef = useRef<{ id: string; texto: string } | null>(null);
  visibleRef.current = chiste;

  const cerrar = useCallback((accion: 'cerrado' | 'no_mostrar_mas' | 'caducado') => {
    const c = visibleRef.current;
    if (!c) return;
    visibleRef.current = null;
    setChiste(null);
    orbeCerrar(c.id, accion).catch(() => undefined);
    if (accion === 'no_mostrar_mas') st.current.apagadoHasta = Date.now() + 24 * 3600_000;
  }, []);

  // teclas: para no interrumpir a quien escribe una respuesta
  useEffect(() => {
    if (!activo) return;
    const f = () => { st.current.ultimaTecla = Date.now(); };
    window.addEventListener('keydown', f, true);
    window.addEventListener('input', f, true);
    return () => {
      window.removeEventListener('keydown', f, true);
      window.removeEventListener('input', f, true);
    };
  }, [activo]);

  // eventos académicos (nivel C): se atienden en la próxima consulta, no en el instante de la respuesta
  useEffect(() => {
    if (!activo) return;
    const f = (e: Event) => { st.current.evento = (e as CustomEvent<EventoOrbe>).detail ?? null; };
    // el estudiante volvió a activarlos en su perfil
    const g = () => { st.current.apagadoHasta = 0; st.current.proximo = Date.now() + 60_000; };
    window.addEventListener('orbe-ia:evento', f);
    window.addEventListener('orbe-ia:reactivar', g);
    return () => {
      window.removeEventListener('orbe-ia:evento', f);
      window.removeEventListener('orbe-ia:reactivar', g);
    };
  }, [activo]);

  // cede el sitio a cualquier aviso del profesor
  useEffect(() => suscribirEmergentes(() => { if (hayEmergente(ID)) cerrar('caducado'); }), [cerrar]);

  // se retira sola
  useEffect(() => {
    if (!chiste) return;
    const t = window.setTimeout(() => cerrar('caducado'), DURACION_MS);
    return () => window.clearTimeout(t);
  }, [chiste, cerrar]);

  useEffect(() => {
    if (!activo) return;
    const intentar = async () => {
      const s = st.current;
      const ahora = Date.now();
      const ruta = contextoDeRuta(location.pathname, location.search);
      const d = debePreguntar({
        ruta, visible: document.visibilityState === 'visible', escribiendo: escribiendoAhora(elementoActivo(), s.ultimaTecla, ahora),
        otroEmergente: hayEmergente(ID), mostrando: !!chiste || s.pidiendo, ahora, proximo: s.proximo, apagadoHasta: s.apagadoHasta,
      });
      if (!d.ok) return;
      s.pidiendo = true;
      const evento = s.evento;
      s.evento = null;
      const apartado = !evento && d.seccion === 'teoria' ? apartadoDeLaPagina() : null;
      try {
        const r = await orbeSiguiente(d.leccion, d.seccion, apartado, evento);
        Object.assign(s, siguienteIntento(r, ahora));
        if (r.chiste) {
          // pudo empezar a escribir o llegar un aviso mientras tanto: entonces no se muestra
          if (hayEmergente(ID) || escribiendoAhora(elementoActivo(), s.ultimaTecla, Date.now())) orbeCerrar(r.chiste.id, 'caducado').catch(() => undefined);
          else setChiste(r.chiste);
        } else if (r.motivo === 'sin_chistes' && r.reponer && ahora - s.ultimaReposicion > 10 * 60_000) {
          s.ultimaReposicion = ahora;
          orbeReponer(d.leccion, d.seccion, r.apartado ?? null, evento).catch(() => undefined);
        }
      } catch {
        Object.assign(s, siguienteIntento(null, ahora));
      } finally {
        s.pidiendo = false;
      }
    };
    const t = window.setInterval(() => void intentar(), TICK_MS);
    return () => window.clearInterval(t);
  }, [activo, location.pathname, location.search, chiste]);

  if (!activo || !chiste) return null;
  return (
    <TarjetaEmergente etiqueta="Orbe IA" className="border-l-4 !border-l-violet-500">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">🤖 Orbe IA</p>
        <button className="btn-texto -mr-1 -mt-1 px-2" aria-label="Cerrar" onClick={() => cerrar('cerrado')}>✕</button>
      </div>
      <p className="mt-1 text-sm leading-relaxed">{chiste.texto}</p>
      <div className="mt-2 text-right">
        <button className="btn-texto text-xs text-gray-500" onClick={() => cerrar('no_mostrar_mas')}>No mostrar más</button>
      </div>
    </TarjetaEmergente>
  );
}
