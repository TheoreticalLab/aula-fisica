import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './estilos.css';

/** Aviso de nueva versión: el Service Worker nuevo espera hasta que el profesor pulse «Actualizar». */
function Actualizacion() {
  const [esperando, setEsperando] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
    let recargando = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!recargando) {
        recargando = true;
        location.reload();
      }
    });
    void navigator.serviceWorker.register('./sw.js', { scope: './' }).then((reg) => {
      if (reg.waiting && navigator.serviceWorker.controller) setEsperando(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nuevo = reg.installing;
        nuevo?.addEventListener('statechange', () => {
          if (nuevo.state === 'installed' && navigator.serviceWorker.controller) setEsperando(nuevo);
        });
      });
      // comprobar actualizaciones al volver a la app
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void reg.update());
    });
  }, []);
  if (!esperando) return null;
  return (
    <div className="actualizacion">
      Nueva versión disponible
      <button className="boton pequeno" onClick={() => esperando.postMessage('activar')}>Actualizar</button>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Actualizacion />
  </StrictMode>,
);
