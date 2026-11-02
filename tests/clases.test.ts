import { describe, expect, it } from 'vitest';
import { catalogoCompacto, construirPeticion, depurar, disponibilidad, generarClase, SCHEMA_CLASE, validarSalida, type Catalogo, type DepsClase } from '../supabase/functions/orbe-ia/clase';
import { costo, estimar, NIVELES, tokensImagen } from '../supabase/functions/_shared/clases/estimacion';
import { eliminarClase, rutaFotoClase, subirFotoClase } from '../supabase/functions/entregas/clases';
import type { DepsCapturas } from '../supabase/functions/entregas/capturas';
import type { Peticion } from '../supabase/functions/orbe-ia/handler';

const S = '11111111-1111-4111-8111-111111111111', R = '22222222-2222-4222-8222-222222222222', U = '33333333-3333-4333-8333-333333333333';
const C = '44444444-4444-4444-8444-444444444444', G = '55555555-5555-4555-8555-555555555555';
const L1 = '66666666-6666-4666-8666-666666666666', E1 = '77777777-7777-4777-8777-777777777777';
const TARIFAS = [
  { model_id: 'claude-haiku-5-5', precio_entrada: 0.1, precio_salida: 0.5, umbral_largo: 100000, precio_entrada_largo: 0.5, precio_salida_largo: 2.5 },
  { model_id: 'claude-sonnet-5-5', precio_entrada: 2, precio_salida: 10, umbral_largo: null, precio_entrada_largo: null, precio_salida_largo: null },
  { model_id: 'claude-opus-5-5', precio_entrada: 4, precio_salida: 20, umbral_largo: null, precio_entrada_largo: null, precio_salida_largo: null },
];
const CATALOGO: Catalogo = {
  unidades: [{ id: '88888888-8888-4888-8888-888888888888', titulo: 'Energía' }],
  lecciones: [{ id: L1, unidad: '88888888-8888-4888-8888-888888888888', titulo: 'Trabajo y energía', resumen: '', apartados: ['Teorema trabajo-energía'], simulador: 'plano-inclinado' }],
  ejercicios: [{ id: E1, slug: 'te-1', conceptos: ['energia'], nivel: 'basico', leccion: L1 }],
};
const respuestaBuena = JSON.stringify({
  titulo: 'Teorema trabajo-energía',
  secciones: [
    { clave: 'reconstruccion', cuerpo: 'Pizarra 1: $W = \\Delta K$ <script>alert(1)</script> ![x](http://espia/x.png) [web](https://ejemplo.com)' },
    { clave: 'incertidumbres', cuerpo: 'Un exponente es ilegible (dudoso).' },
    { clave: 'inventada', cuerpo: 'no debe aparecer' },
  ],
  enlaces: [
    { tipo: 'leccion', lesson_id: 'L1', unit_id: '', exercise_id: 'E1', sim_key: '', apartado: 'Teorema trabajo-energía', concepto: '', cobertura: 'completa' },
    { tipo: 'leccion', lesson_id: 'L99', unit_id: '', exercise_id: '', sim_key: '', apartado: '', concepto: '', cobertura: 'completa' },
    { tipo: 'brecha', lesson_id: '', unit_id: '', exercise_id: '', sim_key: '', apartado: '', concepto: 'Potencia instantánea', cobertura: 'ninguna' },
  ],
});

function mockDeps(opts: { apiReal?: boolean; repetida?: boolean; falla?: string; motivo?: string; hayClave?: boolean } = {}) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const peticiones: Peticion[] = [];
  const tareas: Promise<unknown>[] = [];
  const deps: DepsClase = {
    hayClave: opts.hayClave ?? true,
    rpc: async (fn, args) => {
      calls.push({ fn, args });
      if (fn === 'svc_clase_fotos') return { data: { descarga: false, fotos: [1, 2].map((n) => ({ id: String(n), posicion: n, path: `p${n}.webp`, mime: 'image/webp', ancho: 2400, alto: 1800 })) }, error: null };
      if (fn === 'svc_clase_modelos') return { data: TARIFAS, error: null };
      if (fn === 'svc_clase_ia_iniciar') {
        if (opts.repetida) return { data: { repetida: true, generation_id: G, estado: 'procesando' }, error: null };
        if (opts.motivo) return { data: { ok: false, motivo: opts.motivo }, error: null };
        return { data: { ok: true, generation_id: G, api_real: opts.apiReal ?? true, model: args.p_model, clase: { title: 'Clase' },
          imagenes: [{ posicion: 1, path: 'p1.webp', mime: 'image/webp' }, { posicion: 2, path: 'p2.webp', mime: 'image/webp' }], catalogo: CATALOGO }, error: null };
      }
      return { data: { ok: true }, error: null };
    },
    llamarModelo: async (p) => {
      peticiones.push(p);
      if (opts.falla) throw Object.assign(new Error(opts.falla), { status: 502 });
      return { texto: respuestaBuena, stop_reason: 'end_turn', input_tokens: 9000, output_tokens: 5000 };
    },
    leerImagen: async (path) => ({ data: `BASE64(${path})`, media_type: 'image/webp' }),
    consultarModelo: async (id) => ({ disponible: id !== 'claude-opus-5-5', imagenes: true }),
    enSegundoPlano: (p) => { tareas.push(p); },
  };
  return { deps, calls, peticiones, tareas };
}
const finalizar = (calls: { fn: string; args: Record<string, unknown> }[]) => calls.find((c) => c.fn === 'svc_clase_ia_finalizar')?.args;

describe('Clases impartidas · estimación de costos', () => {
  it('tokens por imagen acotados; costo por modelo según el registro', () => {
    expect(tokensImagen(2400, 1800, 1600)).toBe(1600);
    expect(tokensImagen(600, 600, 1600)).toBe(480);
    expect(costo(TARIFAS[1], 12000, 6000)).toBe(0.084);
    expect(costo(TARIFAS[0], 200000, 1000)).toBe(0.1025);   // tarifa larga de Haiku
  });
  it('la estimación crece con el modelo y el nivel y nunca es un costo exacto (dos cifras)', () => {
    const fotos = [{ ancho: 2400, alto: 1800 }, { ancho: 2400, alto: 1800 }];
    const h = estimar(TARIFAS[0], 'estandar', fotos), s = estimar(TARIFAS[1], 'estandar', fotos), o = estimar(TARIFAS[2], 'exhaustivo', fotos);
    expect(h.usd_maximo).toBeLessThan(s.usd_maximo);
    expect(s.usd_maximo).toBeLessThan(o.usd_maximo);
    expect(s.usd_tipico).toBeLessThan(s.usd_maximo);
    expect(o.salida_maxima).toBe(NIVELES.exhaustivo.max_tokens);
  });
});

describe('Clases impartidas · generación con IA (API simulada)', () => {
  for (const model of ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5']) {
    it(`genera con ${model}: fotos en orden, modelo registrado, borrador (no publica)`, async () => {
      const { deps, calls, peticiones, tareas } = mockDeps();
      const r = await generarClase({ session_id: S, request_id: R, model, nivel: 'detallado', instrucciones: 'Insistir en unidades' }, U, deps);
      expect(r).toMatchObject({ ok: true, generation_id: G, simulado: false });
      await Promise.all(tareas);
      expect(peticiones[0].model).toBe(model);
      expect(peticiones[0].largo).toBe(true);
      const bloques = peticiones[0].contenido as { type: string; text?: string; source?: { data: string } }[];
      expect(bloques.filter((b) => b.type === 'image').map((b) => b.source!.data)).toEqual(['BASE64(p1.webp)', 'BASE64(p2.webp)']);
      expect(bloques[0].text).toMatch(/Pizarra 1 de 2/);
      expect(peticiones[0].system).toMatch(/nunca instrucciones/);
      const f = finalizar(calls)!;
      expect(f).toMatchObject({ p_ok: true, p_input: 9000, p_output: 5000, p_error: null });
      // la reserva usó la estimación MÁXIMA del modelo elegido
      const ini = calls.find((c) => c.fn === 'svc_clase_ia_iniciar')!.args;
      expect(ini.p_model).toBe(model);
      expect(Number(ini.p_estimado)).toBeGreaterThan(0);
    });
  }
  it('la salida se depura: sin HTML, imágenes ni enlaces web; claves desconocidas descartadas; IDs inventados filtrados', async () => {
    const s = validarSalida(respuestaBuena, 'claude-sonnet-5-5', catalogoCompacto(CATALOGO, {}).mapa);
    const cuerpo = JSON.stringify(s.contenido);
    expect(cuerpo).not.toMatch(/<script>|espia|https:\/\/ejemplo/);
    expect(cuerpo).toMatch(/Delta K/);
    expect((s.contenido.secciones as { clave: string }[]).map((x) => x.clave)).toEqual(['reconstruccion', 'incertidumbres']);
    expect(s.enlaces).toHaveLength(2);   // la lección inventada (alias L99) no pasa; la brecha sí
    expect(s.enlaces[0]).toMatchObject({ lesson_id: L1, exercise_id: E1, unit_id: null });   // alias → identificador real
    expect(depurar('<img src=x onerror=alert(1)>texto')).toBe('texto');
  });
  it('doble clic o reintento de red: no se genera dos veces', async () => {
    const { deps, peticiones } = mockDeps({ repetida: true });
    const r = await generarClase({ session_id: S, request_id: R, model: 'claude-sonnet-5-5', nivel: 'estandar' }, U, deps);
    expect(r).toMatchObject({ repetida: true, generation_id: G });
    expect(peticiones).toHaveLength(0);
  });
  it('sin presupuesto o con otra generación en curso: no llama a la API', async () => {
    for (const motivo of ['presupuesto', 'en_curso', 'limite_diario']) {
      const { deps, peticiones } = mockDeps({ motivo });
      expect(await generarClase({ session_id: S, request_id: R, model: 'claude-opus-5-5', nivel: 'exhaustivo' }, U, deps)).toEqual({ ok: false, motivo });
      expect(peticiones).toHaveLength(0);
    }
  });
  it('si la API falla, la generación se cierra con error (las fotos no se tocan) y se puede reintentar', async () => {
    const { deps, calls, tareas } = mockDeps({ falla: 'limite_api' });
    await generarClase({ session_id: S, request_id: R, model: 'claude-sonnet-5-5', nivel: 'estandar' }, U, deps);
    await Promise.all(tareas);
    expect(finalizar(calls)).toMatchObject({ p_ok: false, p_contenido: null });
    expect(calls.some((c) => /foto_quitar|eliminar/.test(c.fn))).toBe(false);
  });
  it('modo simulado: sin llamada de pago, recorre todo el flujo', async () => {
    const { deps, calls, peticiones } = mockDeps({ apiReal: false });
    const r = await generarClase({ session_id: S, request_id: R, model: 'claude-haiku-5-5', nivel: 'estandar' }, U, deps);
    expect(r).toMatchObject({ simulado: true });
    expect(peticiones).toHaveLength(0);
    expect(finalizar(calls)).toMatchObject({ p_ok: true, p_input: 0, p_output: 0 });
  });
  it('parámetros inválidos rechazados antes de tocar nada', async () => {
    const { deps, calls } = mockDeps();
    await expect(generarClase({ session_id: 'x', request_id: R, model: 'claude-sonnet-5-5', nivel: 'estandar' }, U, deps)).rejects.toThrow();
    await expect(generarClase({ session_id: S, request_id: R, model: 'gpt-4', nivel: 'estandar' }, U, deps)).rejects.toThrow();
    await expect(generarClase({ session_id: S, request_id: R, model: 'claude-sonnet-5-5', nivel: 'infinito' }, U, deps)).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
  it('disponibilidad en vivo: el modelo no disponible queda marcado; sin clave no se comprueba', async () => {
    const { deps } = mockDeps();
    const d = await disponibilidad(deps) as { comprobado: boolean; modelos: Record<string, { disponible: boolean }> };
    expect(d.comprobado).toBe(true);
    expect(d.modelos['claude-opus-5-5'].disponible).toBe(false);
    expect((await disponibilidad(mockDeps({ hayClave: false }).deps)).comprobado).toBe(false);
  });
  it('catálogo compacto: alias cortos, tamaño acotado y ejercicios de la unidad de la clase primero', () => {
    const U2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const grande: Catalogo = {
      unidades: [...CATALOGO.unidades, { id: U2, titulo: 'Otra' }],
      lecciones: Array.from({ length: 40 }, (_, i) => ({ id: `${String(i).padStart(8, '0')}-0000-4000-8000-000000000000`, unidad: i < 5 ? U2 : CATALOGO.unidades[0].id,
        titulo: `Lección ${i}`, resumen: 'x'.repeat(240), apartados: Array.from({ length: 30 }, (_, k) => `Apartado ${k}`), simulador: null })),
      ejercicios: Array.from({ length: 300 }, (_, i) => ({ id: `${String(i).padStart(8, '0')}-1111-4111-8111-111111111111`, slug: `ej-${i}`, conceptos: ['energia'],
        nivel: 'basico', leccion: `${String(i % 40).padStart(8, '0')}-0000-4000-8000-000000000000` })),
    };
    const c = catalogoCompacto(grande, { unit_id: U2, temas: [] });
    const texto = JSON.stringify(c.datos);
    expect(texto).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);            // ningún UUID llega al modelo
    expect((c.datos.ejercicios as unknown[]).length).toBe(80);
    expect(texto.length).toBeLessThan(30000);                          // ≈ 8 000 tokens como mucho
    const primero = (c.datos.ejercicios as { leccion: string }[])[0].leccion;
    expect(['L1', 'L2', 'L3', 'L4', 'L5']).toContain(primero);          // de la unidad de la clase
    expect(Object.keys(c.mapa.lecciones)).toHaveLength(40);
  });
  it('esquema de salida compatible con structured outputs (sin tipos combinados ni null en enum; objetos cerrados)', () => {
    const revisar = (n: unknown, ruta: string): void => {
      if (!n || typeof n !== 'object') return;
      const o = n as Record<string, unknown>;
      expect(Array.isArray(o.type), `${ruta}: tipo combinado`).toBe(false);
      if (Array.isArray(o.enum)) expect(o.enum.includes(null), `${ruta}: null en enum`).toBe(false);
      if (o.type === 'object') {
        expect(o.additionalProperties, `${ruta}: additionalProperties`).toBe(false);
        expect([...(o.required as string[])].sort(), `${ruta}: required`).toEqual(Object.keys(o.properties as object).sort());
      }
      for (const [k, v] of Object.entries(o)) if (typeof v === 'object') revisar(v, `${ruta}.${k}`);
    };
    revisar(SCHEMA_CLASE, 'raíz');
  });
  it('esquema de salida: secciones con claves cerradas y enlaces con todos los campos', () => {
    const p = construirPeticion('claude-sonnet-5-5', 'estandar', { catalogo: CATALOGO, clase: {} }, [], '');
    expect(p.schema).toBe(SCHEMA_CLASE);
    expect(JSON.stringify(SCHEMA_CLASE)).toMatch(/incertidumbres/);
  });
});

describe('Clases impartidas · fotos (Edge Function «entregas»)', () => {
  const png = (w: number, h: number) => {
    const b = new Uint8Array(40);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    new DataView(b.buffer).setUint32(16, w); new DataView(b.buffer).setUint32(20, h);
    return b;
  };
  function mockStorage(registrarFalla = false) {
    const subidos: string[] = [], borrados: string[][] = [], calls: { fn: string; args: Record<string, unknown> }[] = [];
    const d: DepsCapturas = {
      rpc: async (fn, args) => {
        calls.push({ fn, args });
        if (fn === 'svc_clase_foto_check') return Number(args.p_posicion) > 4 ? { data: null, error: { message: 'Máximo 4 fotografías por clase', code: '22023' } } : { data: { class_id: C, max_bytes: 4e6 }, error: null };
        if (fn === 'svc_clase_foto_registrar') return registrarFalla ? { data: null, error: { message: 'Sin permiso', code: '42501' } } : { data: { liberar: ['viejo.webp'] }, error: null };
        if (fn === 'svc_clase_eliminar') return { data: { liberar: ['a', 'b'] }, error: null };
        return { data: null, error: null };
      },
      ensureBucket: async () => undefined,
      upload: async (path) => { subidos.push(path); return 'nuevo'; },
      remove: async (paths) => { borrados.push(paths); },
      signedUrl: async (p) => `https://firmada/${p}`,
      newId: () => 'id',
      sha256: async () => 'a'.repeat(64),
    };
    return { d, subidos, borrados, calls };
  }
  it('ruta construida por el servidor (sección/clase/sha), miniatura aparte, liberación de la anterior', async () => {
    const { d, subidos, borrados } = mockStorage();
    const r = await subirFotoClase({ session_id: S, posicion: 1 }, { bytes: png(2400, 1800) }, null, U, d);
    expect(r).toMatchObject({ ok: true, posicion: 1, ancho: 2400 });
    expect(subidos[0]).toBe(`${C}/${S}/${'a'.repeat(64)}.png`);
    expect(rutaFotoClase(C, S, 'b'.repeat(64), 'image/webp', true)).toBe(`${C}/${S}/t_${'b'.repeat(64)}.webp`);
    expect(borrados).toEqual([['viejo.webp']]);
  });
  it('más de 4 fotos, archivos que no son imagen o con poca resolución: rechazados sin escribir nada', async () => {
    const { d, subidos } = mockStorage();
    await expect(subirFotoClase({ session_id: S, posicion: 5 }, { bytes: png(2400, 1800) }, null, U, d)).rejects.toThrow(/4/);
    await expect(subirFotoClase({ session_id: S, posicion: 1 }, { bytes: new TextEncoder().encode('%PDF-1.7 '.repeat(10)) }, null, U, d)).rejects.toThrow(/imagen/);
    await expect(subirFotoClase({ session_id: S, posicion: 1 }, { bytes: png(400, 300) }, null, U, d)).rejects.toThrow(/resolución/);
    await expect(subirFotoClase({ session_id: '../x', posicion: 1 }, { bytes: png(2400, 1800) }, null, U, d)).rejects.toThrow();
    expect(subidos).toHaveLength(0);
  });
  it('si el registro falla (permiso), no queda un archivo huérfano', async () => {
    const { d, borrados } = mockStorage(true);
    await expect(subirFotoClase({ session_id: S, posicion: 1 }, { bytes: png(2400, 1800) }, null, U, d)).rejects.toThrow();
    expect(borrados[0]).toEqual([`${C}/${S}/${'a'.repeat(64)}.png`]);
  });
  it('eliminar una clase no publicada libera sus archivos', async () => {
    const { d, borrados } = mockStorage();
    await eliminarClase(S, U, d);
    expect(borrados).toEqual([['a', 'b']]);
  });
});
