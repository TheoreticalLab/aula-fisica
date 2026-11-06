import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { esperaReintento } from '@/lib/consumo';
import type { Profile } from '@/api/tipos';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /** No se pudo leer el perfil tras varios intentos (servidor saturado o sin conexión): se ofrece «Reintentar». */
  profileError: string | null;
  isTeacher: boolean;
  isAdmin: boolean;
  /** true tras abrir el enlace de «recuperar contraseña» */
  recovering: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);
/** Intentos de lectura del perfil antes de mostrar el error (con espera creciente y aleatoria entre ellos). */
const INTENTOS_PERFIL = 3;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const turno = useRef(0);

  const loadProfile = useCallback(async (s: Session | null) => {
    const mio = ++turno.current;
    if (!s) {
      setProfile(null);
      setProfileError(null);
      return;
    }
    let ultimo = '';
    for (let i = 0; i < INTENTOS_PERFIL; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, esperaReintento(i, 1_000, 8_000)));
      if (mio !== turno.current) return; // llegó otra sesión mientras tanto
      const { data, error } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
      if (mio !== turno.current) return;
      if (!error) {
        setProfile((data as Profile) ?? null);
        setProfileError(null);
        return;
      }
      ultimo = error.message;
    }
    // se conserva el perfil que ya hubiera (un fallo al refrescar no expulsa a nadie)
    setProfileError(ultimo || 'No se pudo cargar su perfil');
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) return;
    let active = true;
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!active) return;
        setSession(data.session);
        await loadProfile(data.session);
      })
      .catch(() => {
        if (active) setProfileError('No se pudo comprobar la sesión');
      })
      .finally(() => {
        // pase lo que pase, la pantalla deja de esperar: o muestra el aula, o el acceso, o un error con «Reintentar»
        if (active) setLoading(false);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'SIGNED_OUT') {
        // fuera del callback para no bloquear el cliente de autenticación
        setTimeout(() => void loadProfile(s), 0);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value: AuthState = {
    session,
    profile,
    loading,
    profileError,
    isTeacher: profile?.role === 'teacher' || profile?.role === 'admin',
    isAdmin: profile?.role === 'admin',
    recovering,
    refreshProfile: () => loadProfile(session),
    signOut: async () => {
      await supabase.auth.signOut();
      setRecovering(false);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fuera de AuthProvider');
  return v;
}
