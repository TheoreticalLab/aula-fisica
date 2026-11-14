import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { registrarEntradaClasica } from '@/lib/examen/integridad';

/**
 * Defecto del examen FG1 (13-nov-2026): 6 de 8 estudiantes quedaron bloqueados 1–3 s después de empezar, sin salir.
 * Secuencia real en Intento.tsx: el intento aún no ha cargado (usaMotor = false) → la «apertura» resuelve «clasico»;
 * el intento carga (usaMotor = true) → exam_open (motor) se repite, pero useAsync conserva «clasico» mientras recarga;
 * exam_integridad responde antes (bloquear_al_salir = true) → se registraba una entrada clásica tras la del motor.
 */
describe('registro de la entrada clásica', () => {
  it('la secuencia del incidente ya no registra ninguna entrada clásica', () => {
    const estados = [
      { vigilar: false, usaMotor: false, aperturaCargando: true, modo: undefined },        // primer render
      { vigilar: false, usaMotor: false, aperturaCargando: false, modo: 'clasico' },       // apertura sin motor
      { vigilar: false, usaMotor: true, aperturaCargando: false, modo: 'clasico' },        // intento cargado, efecto aún no corre
      { vigilar: false, usaMotor: true, aperturaCargando: true, modo: 'clasico' },         // exam_open (motor) en curso
      { vigilar: true, usaMotor: true, aperturaCargando: true, modo: 'clasico' },          // integridad responde ANTES: aquí fallaba
      { vigilar: true, usaMotor: true, aperturaCargando: false, modo: 'una_a_la_vez' },    // exam_open responde
    ];
    expect(estados.map(registrarEntradaClasica)).toEqual([false, false, false, false, false, false]);
  });

  it('una evaluación protegida en la interfaz clásica sí registra su entrada (una vez resuelta la apertura)', () => {
    expect(registrarEntradaClasica({ vigilar: true, usaMotor: true, aperturaCargando: false, modo: 'clasico' })).toBe(true);
  });

  it('sin protección o sin motor no se registra nada', () => {
    expect(registrarEntradaClasica({ vigilar: false, usaMotor: true, aperturaCargando: false, modo: 'clasico' })).toBe(false);
    expect(registrarEntradaClasica({ vigilar: true, usaMotor: false, aperturaCargando: false, modo: 'clasico' })).toBe(false);
  });

  it('Intento.tsx decide la entrada clásica con esta regla, no con el dato de apertura a secas', () => {
    const src = readFileSync('src/pages/estudiante/Intento.tsx', 'utf8');
    expect(src).toMatch(/registrarEntradaClasica\(\{ vigilar, usaMotor, aperturaCargando: apertura\.loading, modo: apertura\.data\?\.modo \}\)/);
    expect(src).not.toMatch(/const clasica = apertura\.data\?\.modo === 'clasico'/);
  });
});
