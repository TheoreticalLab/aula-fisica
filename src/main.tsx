import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'katex/dist/katex.min.css';
import './index.css';
import App from './App';
import { instalarRecargaPorVersion } from './lib/recargaVersion';

// tras publicar una versión nueva, quien tenía el aula abierta la recarga una vez en vez de quedarse «Cargando…»
instalarRecargaPorVersion();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
