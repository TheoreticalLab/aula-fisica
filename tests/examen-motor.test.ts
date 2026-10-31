import { describe, expect, it } from 'vitest';
import {
  abrir, anterior, CONFIG_EXAMEN_POR_DEFECTO, crearMotor, entregar, inactividad, irA, irRevision, latido, marcar, pausar, reanudar, red, siguiente,
  tramosHasta, visibilidad, type ConfigExamen, type EstadoMotor, type Tramo,
} from '../src/lib/examen/motor';
import { estimarDesfase, formatoCuenta, horaLimite, restante } from '../src/lib/examen/reloj';
import { AlmacenMemoria, ColaGuardado, ErrorDefinitivo, type Pendiente } from '../src/lib/examen/guardado';
import { conciliar, intervalosDePregunta, resumirTiempos, type EventoServidor } from '../src/lib/examen/intervalos';
import { reconstruirTiempo } from '../src/lib/lieia/d6';
import { describirReglas } from '../src/lib/examen/reglas';

const C: ConfigExamen = { ...CONFIG_EXAMEN_POR_DEFECTO, pausas: { permitidas: true, max_numero: 2, max_total_s: 300, detienen_reloj: true } };
const ok = (r: { ok: boolean; estado: EstadoMotor }) => { expect(r.ok).toBe(true); return r.estado; };
const s = (x: number) => x * 1000;
const particion = (ts: Tramo[]) => {
  for (let k = 1; k < ts.length; k++) expect(ts[k].inicio).toBe(ts[k - 1].fin);
  return ts.reduce((a, t) => a + t.fin - t.inicio, 0);
};

describe('Motor de examen · una pregunta activa y tramos', () => {
  it('cada instante pertenece a un solo tramo; el tiempo se reparte entre preguntas', () => {
    let e = abrir(crearMotor(['q1', 'q2', 'q3']), s(0));
    expect(e.activa).toBe('q1');
    e = ok(siguiente(e, s(40), C));
    e = ok(siguiente(e, s(100), C));
    e = ok(irA(e, s(130), 'q1', C));
    e = entregar(e, s(150));
    expect(particion(e.tramos)).toBe(s(150));
    const r = resumirTiempos(e.tramos);
    expect(r.por_pregunta.q1.trabajo).toBe(s(60));
    expect(r.por_pregunta.q2.trabajo).toBe(s(60));
    expect(r.por_pregunta.q3.trabajo).toBe(s(30));
    expect(r.visitas.q1).toBe(2);
    expect(e.visitadas).toEqual(['q1', 'q2', 'q3']);
  });
  it('navegación «solo adelante»: no se vuelve atrás, ni desde la revisión', () => {
    const c: ConfigExamen = { ...C, navegacion: 'solo_adelante' };
    let e = abrir(crearMotor(['q1', 'q2']), 0);
    e = ok(siguiente(e, s(10), c));
    const r = anterior(e, s(20), c);
    expect(r.ok).toBe(false);
    expect(irA(e, s(20), 'q1', c).ok).toBe(false);
    e = ok(irRevision(e, s(30), c));
    expect(irA(e, s(31), 'q1', c).ok).toBe(false);
  });
  it('revisión final: tiempo fuera de pregunta, no atribuido a ninguna', () => {
    let e = abrir(crearMotor(['q1']), 0);
    e = ok(siguiente(e, s(20), C)); // última → revisión
    expect(e.fase).toBe('revision');
    e = entregar(e, s(50));
    expect(resumirTiempos(e.tramos).total.fuera_de_pregunta).toBe(s(30));
  });
  it('marcar para revisar es reversible', () => {
    const e = marcar(marcar(crearMotor(['q1']), 'q1'), 'q1');
    expect(e.marcadas).toEqual([]);
  });
});

describe('Motor de examen · pausas declaradas, visibilidad, inactividad y red', () => {
  it('pausas con límite de número; la pausa separa el tiempo de trabajo', () => {
    let e = abrir(crearMotor(['q1']), 0);
    e = ok(pausar(e, s(30), C));
    expect(irA(e, s(31), 'q1', C).ok).toBe(false);          // en pausa no se navega
    e = ok(reanudar(e, s(90)));
    e = ok(pausar(e, s(100), C));
    e = ok(reanudar(e, s(110)));
    expect(pausar(e, s(120), C).ok).toBe(false);             // ya usó 2
    e = entregar(e, s(130));
    const r = resumirTiempos(e.tramos);
    expect(r.por_pregunta.q1.pausa_declarada).toBe(s(70));
    expect(r.por_pregunta.q1.trabajo).toBe(s(60));
    expect(e.pausas).toMatchObject({ n: 2, total_ms: s(70) });
  });
  it('sin pausas permitidas no se puede pausar', () => {
    expect(pausar(abrir(crearMotor(['q1']), 0), 1, CONFIG_EXAMEN_POR_DEFECTO).ok).toBe(false);
  });
  it('página oculta e inactividad son categorías propias; la pérdida de red solo se marca', () => {
    let e = abrir(crearMotor(['q1']), 0);
    e = visibilidad(e, s(10), false);
    e = visibilidad(e, s(25), true);
    e = inactividad(e, s(40), true);
    e = inactividad(e, s(100), false);
    e = red(e, s(110), false);
    e = red(e, s(120), true);
    e = entregar(e, s(130));
    const r = resumirTiempos(e.tramos);
    expect(r.total).toMatchObject({ oculta: s(15), inactividad: s(60), trabajo: s(55) });
    expect(e.tramos.find((t) => t.sin_red)).toMatchObject({ inicio: s(110), fin: s(120), tipo: 'trabajo' });
  });
});

describe('Motor de examen · recuperación tras cierre o desconexión', () => {
  it('al reabrir: se cierra en el último latido, el tramo incierto es «desconocido» y el resto «desconexión»', () => {
    let e = abrir(crearMotor(['q1', 'q2']), 0);
    e = latido(e, s(50));
    // la aplicación se cierra sin despedirse; vuelve a los 200 s
    e = abrir(e, s(200), { incertidumbre_ms: s(5) });
    e = entregar(e, s(230));
    expect(particion(e.tramos)).toBe(s(230));
    const r = resumirTiempos(e.tramos);
    expect(r.por_pregunta.q1).toMatchObject({ trabajo: s(80), desconocido: s(5), desconexion: s(145) });
    expect(e.activa).toBe('q1');                              // vuelve a la misma pregunta
  });
  it('una pausa declarada sigue vigente al volver', () => {
    let e = ok(pausar(abrir(crearMotor(['q1']), 0), s(10), C));
    e = latido(e, s(20));
    e = abrir(e, s(60));
    expect(e.fase).toBe('en_pausa');
  });
  it('tramosHasta incluye el tramo abierto sin modificar el estado', () => {
    const e = abrir(crearMotor(['q1']), 0);
    expect(tramosHasta(e, s(10))).toEqual([{ inicio: 0, fin: s(10), tipo: 'trabajo', exercise_id: 'q1' }]);
    expect(e.tramos).toEqual([]);
  });
});

describe('Reglas explicadas al estudiante antes de empezar', () => {
  it('describe duración, navegación y pausas; la presentación clásica no muestra reglas', () => {
    const r = describirReglas({ presentacion: 'una_a_la_vez', navegacion: 'solo_adelante', duracion_s: 3600, pausas: { permitidas: true, max_numero: 1, max_total_s: 300, detienen_reloj: true } })!;
    expect(r.titulo).toBe('Examen de 60 minutos');
    const t = r.lineas.join(' ');
    expect(t).toMatch(/Solo se avanza/);
    expect(t).toMatch(/pausar una vez \(5 min en total\).*el reloj se detiene/);
    expect(t).toMatch(/se entrega automáticamente/);
    expect(describirReglas(CONFIG_EXAMEN_POR_DEFECTO)!.lineas.join(' ')).toMatch(/no tiene pausas/);
    expect(describirReglas({ ...CONFIG_EXAMEN_POR_DEFECTO, presentacion: 'todas' })).toBeNull();
  });
});

describe('Reloj oficial del servidor', () => {
  it('desfase con la muestra de menor ida y vuelta', () => {
    const d = estimarDesfase([{ envio_local: 0, servidor: 10_500, recibo_local: 1000 }, { envio_local: 2000, servidor: 12_100, recibo_local: 2200 }])!;
    expect(d.desfase).toBe(10_000);
    expect(d.incertidumbre).toBe(100);
  });
  it('límite: duración + pausa (si detiene el reloj, hasta el máximo) y nunca después del cierre', () => {
    const base = { inicio: 0, duracion_s: 3600, pausas_ms: s(120), pausa_en_curso_desde: null, detienen_reloj: true, max_pausa_ms: s(300), cierre_actividad: null };
    expect(horaLimite(base, 0)).toBe(s(3720));
    expect(horaLimite({ ...base, pausa_en_curso_desde: s(1000) }, s(1400))).toBe(s(3900)); // tope de 300 s
    expect(horaLimite({ ...base, detienen_reloj: false }, 0)).toBe(s(3600));
    expect(horaLimite({ ...base, cierre_actividad: s(1800) }, 0)).toBe(s(1800));
    expect(horaLimite({ ...base, duracion_s: null, cierre_actividad: null }, 0)).toBeNull();
    expect(restante(s(100), s(150))).toBe(0);
    expect(formatoCuenta(s(3725))).toBe('1:02:05');
    expect(formatoCuenta(s(65))).toBe('1:05');
  });
});

describe('Guardado automático confiable', () => {
  const crear = (enviar: (p: Pendiente) => Promise<{ rev: number; aplicada: boolean }>, almacen = new AlmacenMemoria(), t = { v: 1000 }) =>
    ({ cola: new ColaGuardado('k', enviar, almacen, () => t.v, 1e9), almacen, t });

  it('se guarda primero en el dispositivo y se borra solo cuando el servidor confirma', async () => {
    const enviados: Pendiente[] = [];
    const { cola, almacen } = crear(async (p) => { enviados.push(p); return { rev: p.rev, aplicada: true }; });
    cola.cambiar('q1', { text: '10 J' });
    expect(almacen.leer('k')).toContain('10 J');
    expect(cola.estado('q1')).toBe('pendiente');
    await cola.vaciar();
    expect(enviados).toHaveLength(1);
    expect(cola.estado('q1')).toBe('guardado');
    expect(almacen.leer('k')).toBeNull();
  });
  it('sin conexión: queda pendiente; al recargar se recupera y se reenvía', async () => {
    const almacen = new AlmacenMemoria();
    const a = crear(async () => { throw new Error('red'); }, almacen);
    a.cola.cambiar('q1', { text: 'borrador' });
    await a.cola.vaciar();
    expect(a.cola.estado('q1')).toBe('sin_conexion');
    a.cola.detener();
    const recibidos: Pendiente[] = [];
    const b = crear(async (p) => { recibidos.push(p); return { rev: p.rev, aplicada: true }; }, almacen);
    expect(b.cola.recuperadas().map((p) => p.answer)).toEqual([{ text: 'borrador' }]);
    await b.cola.vaciar();
    expect(recibidos).toHaveLength(1);
    expect(b.cola.hayPendientes()).toBe(false);
  });
  it('revisiones crecientes; un cambio hecho mientras se enviaba no se pierde', async () => {
    let soltar: () => void = () => {};
    const { cola, t } = crear((p) => new Promise((r) => { soltar = () => r({ rev: p.rev, aplicada: true }); }));
    cola.cambiar('q1', { text: 'a' });
    const envio = cola.vaciar();
    t.v = 1000; // mismo ms: la revisión igualmente crece
    cola.cambiar('q1', { text: 'ab' });
    const revs = cola.recuperadas().map((p) => p.rev);
    soltar();
    await envio;
    expect(cola.estado('q1')).toBe('pendiente');
    expect(cola.recuperadas()[0].answer).toEqual({ text: 'ab' });
    expect(revs[0]).toBeGreaterThan(1000);
  });
  it('el servidor tenía una versión más nueva: no se pisa y se avisa', async () => {
    const { cola } = crear(async (p) => ({ rev: p.rev + 50, aplicada: false }));
    cola.cambiar('q1', { text: 'viejo' });
    await cola.vaciar();
    expect(cola.estado('q1')).toBe('guardado');
    expect(cola.mensaje('q1')).toMatch(/más reciente/);
  });
  it('rechazo definitivo (plazo vencido): no se reintenta y se informa', async () => {
    const { cola } = crear(async () => { throw new ErrorDefinitivo('El tiempo del examen terminó'); });
    cola.cambiar('q1', { text: 'tarde' });
    await cola.vaciar();
    expect(cola.estado('q1')).toBe('rechazado');
    expect(cola.mensaje('q1')).toMatch(/terminó/);
    expect(cola.hayPendientes()).toBe(false);
  });
});

describe('Conciliación con el servidor y tiempo observable por pregunta', () => {
  const ev: EventoServidor[] = [
    { t: 0, tipo: 'apertura', exercise_id: 'q1' }, { t: s(40), tipo: 'ir_a', exercise_id: 'q2' },
    { t: s(60), tipo: 'pausa' }, { t: s(120), tipo: 'reanudacion' }, { t: s(150), tipo: 'entrega' },
  ];
  it('un diario coherente se acepta tal cual', () => {
    let e = abrir(crearMotor(['q1', 'q2']), 0);
    e = ok(siguiente(e, s(40), C));
    e = ok(pausar(e, s(60), C));
    e = ok(reanudar(e, s(120)));
    e = entregar(e, s(150));
    const c = conciliar(e.tramos, ev);
    expect(c.discrepancias).toEqual([]);
    expect(c.tramos).toEqual(e.tramos);
  });
  it('lo que contradice al servidor se reclasifica como desconocido', () => {
    const diario: Tramo[] = [
      { inicio: 0, fin: s(40), tipo: 'trabajo', exercise_id: 'q1' },
      { inicio: s(40), fin: s(60), tipo: 'pausa_declarada', exercise_id: 'q2' },   // el servidor no vio esa pausa
      { inicio: s(60), fin: s(120), tipo: 'trabajo', exercise_id: 'q2' },          // trabajo durante la pausa oficial
      { inicio: s(120), fin: s(400), tipo: 'trabajo', exercise_id: 'q2' },         // más allá de la entrega
    ];
    const c = conciliar(diario, ev);
    expect(c.discrepancias.map((d) => d.motivo)).toEqual(['pausa no registrada por el servidor', 'trabajo durante una pausa oficial', 'fuera de la sesión registrada por el servidor']);
    expect(c.tramos.filter((t) => t.tipo === 'desconocido')).toHaveLength(3);
  });
  it('volver a una pregunta: LIEIA reconstruye su tiempo sumando sus tramos (el tiempo en otra pregunta se descuenta)', () => {
    let e = abrir(crearMotor(['q1', 'q2']), 0);
    e = ok(siguiente(e, s(30), C));                   // q1: 30 s
    e = ok(irA(e, s(80), 'q1', C));                   // q2: 50 s
    e = visibilidad(e, s(90), false);                 // q1: 10 s más, luego oculta 20 s
    e = visibilidad(e, s(110), true);
    e = entregar(e, s(125));                          // q1: 15 s más
    const r1 = reconstruirTiempo(intervalosDePregunta(e.tramos, 'q1'));
    expect(r1).toMatchObject({ estado: 'valido', t: 55 });
    expect(reconstruirTiempo(intervalosDePregunta(e.tramos, 'q2'))).toMatchObject({ estado: 'valido', t: 50 });
  });
});
