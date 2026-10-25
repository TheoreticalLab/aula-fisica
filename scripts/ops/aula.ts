/**
 * Punto de entrada de las operaciones del aula: npm run <estado|respaldo|probar|plan|aplicar|revisar-migraciones>.
 * Vea FLUJO_DE_TRABAJO.md.
 */
import { ocultar } from './comun';

const [comando, ...args] = process.argv.slice(2);

async function ejecutar(): Promise<number> {
  switch (comando) {
    case 'estado':
      return (await import('./estado')).comandoEstado();
    case 'respaldo':
      return (await import('./respaldo')).comandoRespaldo();
    case 'probar':
      return (await import('./probar')).comandoProbar(args);
    case 'plan':
      return (await import('./plan')).comandoPlan();
    case 'aplicar':
      return (await import('./aplicar')).comandoAplicar(args);
    case 'comprobar-credenciales':
      return (await import('./comprobar-credenciales')).comandoComprobarCredenciales();
    case 'revisar-migraciones':
      return (await import('./lint-migraciones')).comandoLint();
    default:
      console.log('Uso: npm run estado | respaldo | probar [-- --limpio] | plan | aplicar -- --plan CÓDIGO | revisar-migraciones');
      return 1;
  }
}

ejecutar()
  .then((codigo) => process.exit(codigo))
  .catch((e) => {
    console.error('✖ ' + ocultar(String(e?.stack ?? e)));
    process.exit(1);
  });
