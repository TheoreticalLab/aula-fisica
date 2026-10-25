import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { joinClass } from '@/api/estudiante';
import { ErrorBox, Field, Notice, PageTitle } from '@/components/ui';
import { useAction } from '@/lib/util';

export default function Unirse() {
  const [code, setCode] = useState('');
  const [ok, setOk] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  async function submit(e: FormEvent) {
    e.preventDefault();
    setOk(null);
    setMsg(null);
    const r = await run(() => joinClass(code));
    if (!r) return;
    if (!r.ok) setMsg(r.error ?? 'No se pudo completar la matrícula.');
    else setOk(r.already ? 'Ya estaba matriculado en esa clase.' : `Matrícula completada: ${r.class_name}${r.group_name ? ` (grupo ${r.group_name})` : ''}.`);
  }
  return (
    <div className="mx-auto max-w-md">
      <PageTitle title="Unirme a una clase" />
      <form className="tarjeta" onSubmit={submit}>
        <Field label="Código de la clase" hint="Son 8 letras y números; no distingue mayúsculas.">
          {(id) => (
            <input id={id} className="campo text-center font-mono text-xl uppercase tracking-[0.3em]" value={code} maxLength={12} autoComplete="off" autoCapitalize="characters"
              onChange={(e) => setCode(e.target.value.toUpperCase())} required />
          )}
        </Field>
        <ErrorBox error={error ?? msg} />
        {ok && <Notice tone="ok">{ok} <Link to="/" className="enlace">Ir al inicio</Link></Notice>}
        <button className="btn-primario w-full" disabled={busy || code.replace(/\W/g, '').length < 6}>{busy ? 'Comprobando…' : 'Unirme'}</button>
      </form>
    </div>
  );
}
