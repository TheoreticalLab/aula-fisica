import { useEffect, useState } from 'react';

export type Tema = 'claro' | 'oscuro';

function inicial(): Tema {
  try {
    const t = localStorage.getItem('aula-tema');
    if (t === 'claro' || t === 'oscuro') return t;
  } catch {
    /* almacenamiento no disponible */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
}

export function useTema(): [Tema, () => void] {
  const [tema, setTema] = useState<Tema>(inicial);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'oscuro');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema === 'oscuro' ? '#0d1424' : '#14284b');
    try {
      localStorage.setItem('aula-tema', tema);
    } catch {
      /* ignorar */
    }
  }, [tema]);
  return [tema, () => setTema((t) => (t === 'oscuro' ? 'claro' : 'oscuro'))];
}

/** true si el modo oscuro está activo (para elegir colores de gráficas). */
export function useDark(): boolean {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}
