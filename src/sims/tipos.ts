export interface SimProps {
  params: Record<string, number>;
  /** Vista reducida (dentro de un ejercicio). */
  compact?: boolean;
  /** Permite al simulador cambiar varios parámetros a la vez (p. ej. un botón «Elástico» que fija e = 1). */
  setParams?: (p: Record<string, number>) => void;
}
