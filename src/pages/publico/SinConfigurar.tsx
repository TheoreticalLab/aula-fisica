export default function SinConfigurar() {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-3 font-serif text-2xl font-semibold text-primario-900 dark:text-white">Aula Virtual de Física</h1>
      <div className="tarjeta">
        <h2 className="mb-2 text-lg font-semibold">Falta conectar la base de datos</h2>
        <p className="mb-3 text-sm">
          Esta compilación no tiene los datos del proyecto Supabase. Sin base de datos no hay usuarios, lecciones ni ejercicios, así que la
          aplicación no puede funcionar.
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Copie <code>.env.example</code> como <code>.env.local</code>.</li>
          <li>Escriba en él <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> (Supabase → Project Settings → API).</li>
          <li>Vuelva a ejecutar <code>npm run dev</code> o <code>npm run build</code>.</li>
        </ol>
        <p className="mt-3 text-sm">El archivo <code>README.md</code> explica la instalación completa.</p>
      </div>
    </div>
  );
}
